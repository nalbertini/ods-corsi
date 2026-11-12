-- Il doppio turno (145-doppio-turno.sql): un corso con due lezioni lo stesso
-- giorno. Chi è presente a un turno non è nell'appello dell'altro, né presente
-- né assente: tablet di sala, area istruttore col PIN, statistiche. Nelle
-- frequenze il giorno vale una lezione sola. Un ASSENTE messo prima resta
-- salvato e si ignora; con la presenza tolta, o il turno annullato, torna.
-- Si lancia dopo finto-supabase.sql e tutti i file dello schema fino a
-- 145-doppio-turno.sql.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('22222222-2222-2222-2222-222222222222', 'maura@ods.it'),
  ('33333333-3333-3333-3333-333333333333', 'segreteria@ods.it'),
  ('66666666-6666-6666-6666-666666666666', 'judo@ods.it');
insert into persone (id, nome, cognome, ruolo, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Maura', 'Uno', 'istruttore', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Sonia', 'Banco', 'staff', '33333333-3333-3333-3333-333333333333');
insert into persone (id, nome, cognome, ruolo) values
  ('aaaaaaaa-0000-0000-0000-000000000011', 'Giulia', 'Rossi', 'iscritto'),
  ('aaaaaaaa-0000-0000-0000-000000000012', 'Luca', 'Greco', 'iscritto'),
  ('aaaaaaaa-0000-0000-0000-000000000013', 'Sara', 'Bianchi', 'iscritto');
insert into sale (id, nome) values ('bbbbbbbb-0000-0000-0000-000000000001', 'Judo');
insert into postazioni (id, nome, sala_id, utente_id) values
  ('dddddddd-0000-0000-0000-000000000001', 'Tablet Judo', 'bbbbbbbb-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666666');
insert into corsi (id, nome, sala_id, istruttore_id) values
  ('cccccccc-0000-0000-0000-000000000001', 'Judo kids', 'bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002');
-- Ieri, alle 17:30 (A) e alle 18:30 (B): nella finestra di recupero del tablet.
insert into sessioni (id, corso_id, inizio, fine) values
  ('eeeeeeee-0000-0000-0000-00000000000a', 'cccccccc-0000-0000-0000-000000000001', current_date - 1 + time '17:30', current_date - 1 + time '18:30'),
  ('eeeeeeee-0000-0000-0000-00000000000b', 'cccccccc-0000-0000-0000-000000000001', current_date - 1 + time '18:30', current_date - 1 + time '19:30');
insert into iscrizioni (corso_id, persona_id, dal)
  select 'cccccccc-0000-0000-0000-000000000001', id, current_date - 30 from persone where ruolo = 'iscritto';
-- Giulia è venuta alle 17:30. Luca era segnato ASSENTE alle 17:30 ed è venuto alle 18:30.
-- Sara non è venuta a nessuno dei due.
insert into presenze (sessione_id, persona_id, stato) values
  ('eeeeeeee-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000011', 'presente'),
  ('eeeeeeee-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000012', 'assente'),
  ('eeeeeeee-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000013', 'assente'),
  ('eeeeeeee-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-000000000012', 'presente'),
  ('eeeeeeee-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-000000000013', 'assente');
select imposta_pin('aaaaaaaa-0000-0000-0000-000000000002', '4321');

create or replace function chi(u text) returns void language plpgsql as $$
begin perform set_config('prova.utente', u, false); end $$;
create or replace function tenta(sql text) returns text language plpgsql as $$
declare n int; esito text;
begin
  if sql ~* '^\s*select' then execute sql into esito; else execute sql; end if;
  get diagnostics n = row_count;
  return coalesce(esito, case when n = 0 then 'a vuoto (0 righe)' else 'FATTO (' || n || ' righe)' end);
exception when others then return 'NEGATO: ' || sqlerrm;
end $$;
create or replace function atteso(cosa text, avuto text, voluto text) returns text language plpgsql as $$
begin
  if avuto is distinct from voluto and not (voluto like '%…' and avuto like replace(voluto, '…', '%')) then
    raise exception '% · atteso «%», avuto «%»', cosa, voluto, avuto;
  end if;
  return 'ok  ' || cosa || ' → ' || avuto;
end $$;
grant execute on function tenta(text), atteso(text, text, text), chi(text) to anon, authenticated;

\echo ''
\echo '--- 1. il tablet di sala ---'
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('i nomi delle 18:30: Giulia (presente alle 17:30) non c''è',
  (select string_agg(nome, ' ' order by nome) from elenco_sala('eeeeeeee-0000-0000-0000-00000000000b')), 'Luca Sara');
select atteso('i nomi delle 17:30: Luca (presente alle 18:30) non c''è, anche se era ASSENTE',
  (select string_agg(nome, ' ' order by nome) from elenco_sala('eeeeeeee-0000-0000-0000-00000000000a')), 'Giulia Sara');
select atteso('gli iscritti di ogni turno', (select string_agg(iscritti::text, ' ' order by inizio) from lezioni_sala(current_date - 1, current_date - 1)), '2 2');
select atteso('Giulia tocca il nome alle 18:30: non si scrive', segna_dal_tablet('eeeeeeee-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-000000000011'), 'altro_turno');
reset role;
select atteso('e alle 18:30 non c''è una riga sua', (select count(*)::text from presenze where sessione_id = 'eeeeeeee-0000-0000-0000-00000000000b' and persona_id = 'aaaaaaaa-0000-0000-0000-000000000011'), '0');
select atteso('l''ASSENTE di Luca alle 17:30 resta salvato', (select stato::text from presenze where sessione_id = 'eeeeeeee-0000-0000-0000-00000000000a' and persona_id = 'aaaaaaaa-0000-0000-0000-000000000012'), 'assente');

\echo ''
\echo '--- 2. l''area istruttore col PIN ---'
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('l''appello delle 18:30, senza Giulia',
  (select string_agg(nome || ':' || coalesce(stato::text, '-'), ' ' order by nome) from appello_con_pin('4321', 'eeeeeeee-0000-0000-0000-00000000000b')), 'Luca:presente Sara:assente');
select atteso('segnare Giulia presente alle 18:30 col PIN non scrive', segna_con_pin('4321', 'eeeeeeee-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-000000000011', 'presente')::text, 'true');
reset role;
select atteso('e la riga non c''è', (select count(*)::text from presenze where sessione_id = 'eeeeeeee-0000-0000-0000-00000000000b' and persona_id = 'aaaaaaaa-0000-0000-0000-000000000011'), '0');

\echo ''
\echo '--- 3. statistiche e frequenze ---'
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('statistiche: iscritti e assenti per turno, senza chi è presente all''altro',
  (select string_agg((l->>'iscritti') || '/' || (l->>'presenti') || '/' || (l->>'assenti'), ' ' order by l->>'inizio')
     from jsonb_array_elements(statistiche(current_date - 2, now())->'lezioni') l), '2/1/1 2/1/1');
select atteso('frequenze: Giulia 1 su 1, Luca 1 su 1, Sara 0 su 1 (il giorno vale una lezione)',
  (select string_agg(pe.nome || ' ' || f.presenti || '/' || f.dovute, ', ' order by pe.nome) from frequenze(30) f join persone pe on pe.id = f.persona_id),
  'Giulia 1/1, Luca 1/1, Sara 0/1');
reset role;

\echo ''
\echo '--- 4. la presenza tolta, il turno annullato ---'
delete from presenze where sessione_id = 'eeeeeeee-0000-0000-0000-00000000000b' and persona_id = 'aaaaaaaa-0000-0000-0000-000000000012';
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('tolta la presenza delle 18:30, Luca torna alle 17:30 com''era: ASSENTE',
  (select string_agg(nome || ':' || coalesce(stato::text, '-'), ' ' order by nome) from appello_con_pin('4321', 'eeeeeeee-0000-0000-0000-00000000000a')), 'Giulia:presente Luca:assente Sara:assente');
reset role;
update sessioni set stato = 'annullata' where id = 'eeeeeeee-0000-0000-0000-00000000000a';
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('annullate le 17:30, Giulia torna alle 18:30',
  (select string_agg(nome, ' ' order by nome) from appello_con_pin('4321', 'eeeeeeee-0000-0000-0000-00000000000b')), 'Giulia Luca Sara');
reset role;

\echo ''
\echo '--- 5. tre turni, e un giustificato ---'
update sessioni set stato = 'prevista' where id = 'eeeeeeee-0000-0000-0000-00000000000a';
insert into sessioni (id, corso_id, inizio, fine) values
  ('eeeeeeee-0000-0000-0000-00000000000c', 'cccccccc-0000-0000-0000-000000000001', current_date - 1 + time '19:30', current_date - 1 + time '20:30');
-- Sara: GIUSTIFICATA alle 17:30, presente alle 19:30.
update presenze set stato = 'giustificato' where sessione_id = 'eeeeeeee-0000-0000-0000-00000000000a' and persona_id = 'aaaaaaaa-0000-0000-0000-000000000013';
insert into presenze (sessione_id, persona_id, stato) values ('eeeeeeee-0000-0000-0000-00000000000c', 'aaaaaaaa-0000-0000-0000-000000000013', 'presente');
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('presente alle 19:30: Sara non è alle 17:30 (dove era GIUSTIFICATA) né alle 18:30',
  (select string_agg(nome, ' ' order by nome) from appello_con_pin('4321', 'eeeeeeee-0000-0000-0000-00000000000a'))
  || ' / ' || (select string_agg(nome, ' ' order by nome) from appello_con_pin('4321', 'eeeeeeee-0000-0000-0000-00000000000b')), 'Giulia Luca / Luca');
select atteso('gli iscritti dei tre turni', (select string_agg(iscritti::text, ' ' order by inizio) from lezioni_sala(current_date - 1, current_date - 1)), '2 1 2');
reset role;
select atteso('la giustifica resta salvata', (select stato::text from presenze where sessione_id = 'eeeeeeee-0000-0000-0000-00000000000a' and persona_id = 'aaaaaaaa-0000-0000-0000-000000000013'), 'giustificato');

\echo ''
\echo '--- 6. la regola non si chiama da fuori ---'
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('la segreteria', tenta($$select presente_altrove('eeeeeeee-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-000000000011')::text$$), 'NEGATO: permission denied…');
reset role;
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('un istruttore', tenta($$select presente_altrove('eeeeeeee-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-000000000011')::text$$), 'NEGATO: permission denied…');
reset role;
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('il tablet', tenta($$select presente_altrove('eeeeeeee-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-000000000011')::text$$), 'NEGATO: permission denied…');
reset role;
select chi('');
set role anon;
select atteso('senza accesso', tenta($$select presente_altrove('eeeeeeee-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-000000000011')::text$$), 'NEGATO: permission denied…');
reset role;

\echo ''
\echo 'Il doppio turno: tutto come previsto.'
