-- Il timer sul database: la libreria della palestra, i timer personali, quelli
-- dei corsi, lo storico e le preferenze, visti da chi li usa.
-- Si lancia dopo finto-supabase.sql e gli otto file dello schema.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'maura@ods.it'),
  ('44444444-4444-4444-4444-444444444444', 'federico@ods.it'),
  ('33333333-3333-3333-3333-333333333333', 'luca@ods.it'),
  ('66666666-6666-6666-6666-666666666666', 'lotta@sale.ods-corsi.it');
insert into persone (id, nome, cognome, ruolo, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Maura', 'Uno', 'istruttore', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000006', 'Federico', 'Due', 'istruttore', '44444444-4444-4444-4444-444444444444'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Luca', 'Rossi', 'iscritto', '33333333-3333-3333-3333-333333333333');
insert into sale (id, nome) values ('bbbbbbbb-0000-0000-0000-000000000001', 'Lotta');
insert into postazioni (id, nome, sala_id, utente_id) values
  ('dddddddd-0000-0000-0000-000000000001', 'Tablet Lotta', 'bbbbbbbb-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666666');
insert into corsi (id, nome, sala_id, istruttore_id) values
  ('cccccccc-0000-0000-0000-000000000001', 'Lotta 2', 'bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002');
insert into sessioni (id, corso_id, inizio, fine) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', now() - interval '10 minutes', now() + interval '50 minutes');

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
\echo '--- 1. Maura, istruttrice: un timer suo e uno della palestra ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('crea un timer suo',
  tenta($$insert into timer (id, persona_id, nome, schema) values
    ('f0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', 'Tabata di Maura', '{"mode":"interval"}')$$), 'FATTO (1 righe)');
select atteso('crea un timer della palestra',
  tenta($$insert into timer (id, nome, schema) values
    ('f0000000-0000-0000-0000-000000000002', 'Riscaldamento judo', '{"mode":"circuit"}')$$), 'FATTO (1 righe)');
select atteso('non ne crea uno a nome di Federico',
  tenta($$insert into timer (persona_id, nome, schema) values ('aaaaaaaa-0000-0000-0000-000000000006', 'Falso', '{}')$$), 'NEGATO: …');
select atteso('il server scrive chi l''ha creato', (select p.nome from timer t join persone p on p.id = t.creato_da where t.id = 'f0000000-0000-0000-0000-000000000002'), 'Maura');
select atteso('lo stesso timer mandato due volte dalla coda resta uno',
  tenta($$insert into timer (id, persona_id, nome, schema) values
    ('f0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', 'Tabata di Maura', '{"mode":"interval","work":20}')
    on conflict (id) do update set nome = excluded.nome, schema = excluded.schema$$), 'FATTO (1 righe)');
select atteso('e ha lo schema dell''ultima', (select schema->>'work' from timer where id = 'f0000000-0000-0000-0000-000000000001'), '20');
select atteso('uno schema che non è un oggetto no',
  tenta($$insert into timer (nome, schema) values ('Rotto', '[1,2]')$$), 'NEGATO: …');
select atteso('un nome vuoto no',
  tenta($$insert into timer (nome, schema) values ('  ', '{}')$$), 'NEGATO: …');
select atteso('il suo non lo regala alla palestra',
  tenta($$update timer set persona_id = null where id = 'f0000000-0000-0000-0000-000000000001'$$), 'NEGATO: …');
select atteso('lega il suo timer al corso',
  tenta($$insert into corsi_timer (corso_id, timer_id) values ('cccccccc-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001')$$), 'FATTO (1 righe)');
select atteso('il server scrive chi l''ha legato', (select p.nome from corsi_timer c join persone p on p.id = c.collegato_da), 'Maura');
select atteso('salva le sue preferenze',
  tenta($$insert into preferenze_timer (impostazioni) values ('{"coach":"spietato"}')$$), 'FATTO (1 righe)');
select atteso('e le risalva sopra',
  tenta($$insert into preferenze_timer (impostazioni) values ('{"coach":"distratto"}')
    on conflict (persona_id) do update set impostazioni = excluded.impostazioni$$), 'FATTO (1 righe)');
select atteso('le ritrova', (select impostazioni->>'coach' from preferenze_timer), 'distratto');
select atteso('un allenamento fatto a lezione',
  tenta($$insert into allenamenti (id, timer_id, nome, sessione_id, secondi, completato) values
    ('a1000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'Tabata di Maura',
     'eeeeeeee-0000-0000-0000-000000000001', 240, true)$$), 'FATTO (1 righe)');
select atteso('mandato due volte resta uno',
  tenta($$insert into allenamenti (id, nome, secondi, completato) values
    ('a1000000-0000-0000-0000-000000000001', 'Tabata di Maura', 240, true) on conflict (id) do nothing$$), 'a vuoto (0 righe)');
select atteso('non si finge un tablet',
  tenta($$insert into allenamenti (nome, secondi, completato, postazione_id, persona_id) values
    ('Finto', 10, true, 'dddddddd-0000-0000-0000-000000000001', null)$$), 'FATTO (1 righe)');
select atteso('perché il server scrive chi è davvero',
  (select string_agg(coalesce(p.nome, '—') || '/' || coalesce(a.postazione_id::text, '—'), ', ') from allenamenti a left join persone p on p.id = a.persona_id where a.nome = 'Finto'), 'Maura/—');
select atteso('un allenamento dal futuro arriva adesso',
  tenta($$insert into allenamenti (nome, secondi, completato, finito_il) values ('Futuro', 10, true, now() + interval '3 days')$$), 'FATTO (1 righe)');
select atteso('con l''ora di adesso', (select (finito_il <= now())::text from allenamenti where nome = 'Futuro'), 'true');
reset role;

\echo ''
\echo '--- 2. Federico, un altro istruttore ---'
select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('vede la palestra e il timer del corso, non gli altri di Maura',
  (select string_agg(nome, ', ' order by nome) from timer), 'Riscaldamento judo, Tabata di Maura');
reset role;
-- Maura ne fa un altro, che non lega a niente.
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
insert into timer (id, persona_id, nome, schema) values
  ('f0000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002', 'Segreto di Maura', '{}');
reset role;
select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('quello non legato di Maura non lo vede', (select count(*)::text from timer where id = 'f0000000-0000-0000-0000-000000000003'), '0');
select atteso('cura il timer della palestra',
  tenta($$update timer set nome = 'Riscaldamento judo (15'')' where id = 'f0000000-0000-0000-0000-000000000002'$$), 'FATTO (1 righe)');
select atteso('e resta scritto che l''ha cambiato lui', (select p.nome from timer t join persone p on p.id = t.cambiato_da where t.id = 'f0000000-0000-0000-0000-000000000002'), 'Federico');
select atteso('ma chi l''ha creato resta Maura', (select p.nome from timer t join persone p on p.id = t.creato_da where t.id = 'f0000000-0000-0000-0000-000000000002'), 'Maura');
select atteso('non lo butta: l''ha creato Maura',
  tenta($$delete from timer where id = 'f0000000-0000-0000-0000-000000000002'$$), 'a vuoto (0 righe)');
select atteso('non cambia quello di Maura legato al corso',
  tenta($$update timer set nome = 'Mio' where id = 'f0000000-0000-0000-0000-000000000001'$$), 'a vuoto (0 righe)');
select atteso('non lo prende con la stessa chiave',
  tenta($$insert into timer (id, persona_id, nome, schema) values
    ('f0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000006', 'Mio', '{}')
    on conflict (id) do update set nome = excluded.nome$$), 'NEGATO: …');
select atteso('non lega un timer che non vede',
  tenta($$insert into corsi_timer (corso_id, timer_id) values ('cccccccc-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000003')$$), 'NEGATO: …');
select atteso('lega quello della palestra al corso: le sostituzioni si decidono all''ultimo',
  tenta($$insert into corsi_timer (corso_id, timer_id) values ('cccccccc-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000002')$$), 'FATTO (1 righe)');
select atteso('non vede le preferenze di Maura', (select count(*)::text from preferenze_timer), '0');
select atteso('non le cambia',
  tenta($$update preferenze_timer set impostazioni = '{}'$$), 'a vuoto (0 righe)');
select atteso('vede lo storico della palestra', (select count(*)::text from allenamenti), '3');
select atteso('non lo corregge', tenta($$update allenamenti set secondi = 1$$), 'NEGATO: …');
select atteso('non lo cancella', tenta($$delete from allenamenti$$), 'a vuoto (0 righe)');
reset role;

\echo ''
\echo '--- 3. il tablet della sala: apre i timer, non li scrive ---'
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('vede la palestra e quelli del corso', (select string_agg(nome, ', ' order by nome) from timer), 'Riscaldamento judo (15''), Tabata di Maura');
select atteso('sa quali sono del corso', (select count(*)::text from corsi_timer where corso_id = 'cccccccc-0000-0000-0000-000000000001'), '2');
select atteso('non crea un timer', tenta($$insert into timer (nome, schema) values ('Del tablet', '{}')$$), 'NEGATO: …');
select atteso('non cambia un timer', tenta($$update timer set nome = 'Tablet'$$), 'a vuoto (0 righe)');
select atteso('non lega un timer', tenta($$insert into corsi_timer (corso_id, timer_id) values ('cccccccc-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000003')$$), 'NEGATO: …');
select atteso('non slega un timer', tenta($$delete from corsi_timer$$), 'a vuoto (0 righe)');
select atteso('scrive l''allenamento della lezione',
  tenta($$insert into allenamenti (id, timer_id, nome, sessione_id, secondi, completato) values
    ('a1000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000002', 'Riscaldamento judo',
     'eeeeeeee-0000-0000-0000-000000000001', 900, false)$$), 'FATTO (1 righe)');
select atteso('a nome del tablet', (select postazione_id::text from allenamenti where id = 'a1000000-0000-0000-0000-000000000002'), 'dddddddd-0000-0000-0000-000000000001');
select atteso('rimandato dalla coda resta uno',
  tenta($$insert into allenamenti (id, nome, secondi, completato) values
    ('a1000000-0000-0000-0000-000000000002', 'Riscaldamento judo', 900, false) on conflict (id) do nothing$$), 'a vuoto (0 righe)');
select atteso('vede solo il suo storico', (select count(*)::text from allenamenti), '1');
select atteso('non ha preferenze', tenta($$insert into preferenze_timer (impostazioni) values ('{}')$$), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 4. un iscritto con l''accesso ---'
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('non crea un timer', tenta($$insert into timer (nome, schema) values ('Mio', '{}')$$), 'NEGATO: …');
select atteso('non scrive nello storico', tenta($$insert into allenamenti (nome, secondi, completato) values ('Mio', 1, true)$$), 'NEGATO: …');
select atteso('non legge lo storico', (select count(*)::text from allenamenti), '0');
select atteso('non salva preferenze', tenta($$insert into preferenze_timer (impostazioni) values ('{}')$$), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 5. chi non ha un accesso ---'
select chi('');
set role anon;
select atteso('non legge i timer', tenta($$select count(*)::text from timer$$), 'NEGATO: …');
select atteso('non legge lo storico', tenta($$select count(*)::text from allenamenti$$), 'NEGATO: …');
select atteso('non legge i collegamenti', tenta($$select count(*)::text from corsi_timer$$), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 6. la segreteria, e chi se ne va ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('toglie un timer della palestra che non ha creato',
  tenta($$delete from timer where id = 'f0000000-0000-0000-0000-000000000002'$$), 'FATTO (1 righe)');
select atteso('lo storico resta, senza il timer', (select coalesce(timer_id::text, 'nessuno') from allenamenti where id = 'a1000000-0000-0000-0000-000000000002'), 'nessuno');
select atteso('e il collegamento se ne va con lui', (select count(*)::text from corsi_timer), '1');
select atteso('toglie una riga dello storico', tenta($$delete from allenamenti where nome = 'Futuro'$$), 'FATTO (1 righe)');
reset role;
-- Chi ha insegnato non si elimina (28-elimina-istruttore.sql): prima la si
-- toglie dai corsi e dalle lezioni.
update corsi set istruttore_id = null where istruttore_id = 'aaaaaaaa-0000-0000-0000-000000000002';
delete from corsi_istruttori where persona_id = 'aaaaaaaa-0000-0000-0000-000000000002';
update sessioni set istruttore_id = null where istruttore_id = 'aaaaaaaa-0000-0000-0000-000000000002';
delete from presenze_istruttori where persona_id = 'aaaaaaaa-0000-0000-0000-000000000002';
delete from persone where id = 'aaaaaaaa-0000-0000-0000-000000000002';
select atteso('i timer di Maura se ne vanno con lei', (select count(*)::text from timer), '0');
select atteso('lo storico resta', (select count(*)::text from allenamenti), '3');

\echo ''
\echo 'Tutto a posto.'
