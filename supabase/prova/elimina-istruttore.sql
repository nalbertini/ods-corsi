-- Eliminare un istruttore: solo la segreteria, solo un istruttore, e solo
-- se non ha mai insegnato (corsi non archiviati, lezioni in calendario,
-- presenze da istruttore). Il blocco vale anche per chi cancella la riga
-- direttamente; un iscritto si cancella come prima.
-- Si lancia dopo finto-supabase.sql, i file dello schema e
-- 28-elimina-istruttore.sql.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'maura@ods.it'),
  ('33333333-3333-3333-3333-333333333333', 'luca@ods.it'),
  ('55555555-5555-5555-5555-555555555555', 'pino@ods.it'),
  ('66666666-6666-6666-6666-666666666666', 'lotta@sale.ods-corsi.it');
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Maura', 'Uno', 'istruttore', 'maura@ods.it', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Luca', 'Rossi', 'iscritto', 'luca@ods.it', '33333333-3333-3333-3333-333333333333'),
  -- Mai insegnato, con l'account.
  ('aaaaaaaa-0000-0000-0000-000000000005', 'Pino', 'Nuovo', 'istruttore', 'pino@ods.it', '55555555-5555-5555-5555-555555555555'),
  -- Il secondo istruttore della Lotta, in `corsi_istruttori`.
  ('aaaaaaaa-0000-0000-0000-000000000006', 'Gino', 'Due', 'istruttore', null, null),
  -- Teneva un corso ora archiviato: le lezioni passate sono sue.
  ('aaaaaaaa-0000-0000-0000-000000000007', 'Rita', 'Vecchia', 'istruttore', null, null),
  -- Nessun corso, ma ha messo il PIN in una lezione.
  ('aaaaaaaa-0000-0000-0000-000000000008', 'Teo', 'Passato', 'istruttore', null, null),
  ('aaaaaaaa-0000-0000-0000-000000000009', 'Sara', 'Bianchi', 'iscritto', null, null),
  -- Mai insegnato, ma si allena alla Lotta.
  ('aaaaaaaa-0000-0000-0000-000000000010', 'Ugo', 'Allievo', 'istruttore', null, null),
  -- Una scheda legata, per sbaglio o apposta, all'account del tablet.
  ('aaaaaaaa-0000-0000-0000-000000000011', 'Zeno', 'Tablet', 'istruttore', null, '66666666-6666-6666-6666-666666666666');
insert into sale (id, nome) values ('bbbbbbbb-0000-0000-0000-000000000001', 'Lotta');
insert into postazioni (id, nome, sala_id, utente_id) values
  ('dddddddd-0000-0000-0000-000000000001', 'Tablet Lotta', 'bbbbbbbb-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666666');
insert into corsi (id, nome, sala_id, istruttore_id, attivo) values
  ('cccccccc-0000-0000-0000-000000000001', 'Lotta', 'bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', true),
  ('cccccccc-0000-0000-0000-000000000002', 'Judo', 'bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000007', false);
insert into corsi_istruttori (corso_id, persona_id) values
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000006');
insert into sessioni (id, corso_id, inizio, fine, sala_id, istruttore_id) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', now() - interval '7 days', now() - interval '7 days' + interval '1 hour',
   'bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000002', now() - interval '90 days', now() - interval '90 days' + interval '1 hour',
   'bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000007');
insert into iscrizioni (corso_id, persona_id, dal) values
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000010', current_date - 30);
insert into presenze_istruttori (sessione_id, persona_id, stato, prevista) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000008', 'confermata', false);

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
\echo '--- 1. chi non è della segreteria non elimina ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('un istruttore no', tenta($$select elimina_istruttore('aaaaaaaa-0000-0000-0000-000000000005')::text$$), 'NEGATO: Non hai il permesso…');
reset role;
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('un iscritto no', tenta($$select elimina_istruttore('aaaaaaaa-0000-0000-0000-000000000005')::text$$), 'NEGATO: Non hai il permesso…');
reset role;
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('il tablet no', tenta($$select elimina_istruttore('aaaaaaaa-0000-0000-0000-000000000005')::text$$), 'NEGATO: Non hai il permesso…');
reset role;
select chi('');
set role anon;
select atteso('chi non ha accesso nemmeno la chiama', tenta($$select elimina_istruttore('aaaaaaaa-0000-0000-0000-000000000005')::text$$), 'NEGATO: permission denied…');
reset role;
select atteso('Pino c''è ancora', (select count(*)::text from persone where nome = 'Pino'), '1');

\echo ''
\echo '--- 2. la segreteria: chi ha insegnato resta ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('il titolare di un corso no', tenta($$select elimina_istruttore('aaaaaaaa-0000-0000-0000-000000000002')::text$$),
  'NEGATO: Maura Uno insegna ancora in Lotta: prima va tolto dai corsi');
select atteso('il secondo istruttore nemmeno', tenta($$select elimina_istruttore('aaaaaaaa-0000-0000-0000-000000000006')::text$$),
  'NEGATO: Gino Due insegna ancora in Lotta: prima va tolto dai corsi');
select atteso('chi ha lezioni di un corso archiviato no', tenta($$select elimina_istruttore('aaaaaaaa-0000-0000-0000-000000000007')::text$$),
  'NEGATO: Rita Vecchia ha delle lezioni in calendario…');
select atteso('chi ha una presenza da istruttore no', tenta($$select elimina_istruttore('aaaaaaaa-0000-0000-0000-000000000008')::text$$),
  'NEGATO: Teo Passato ha delle presenze da istruttore…');
select atteso('chi è di segreteria no', tenta($$select elimina_istruttore('aaaaaaaa-0000-0000-0000-000000000001')::text$$),
  'NEGATO: Si eliminano solo gli istruttori…');
select atteso('un iscritto da qui no', tenta($$select elimina_istruttore('aaaaaaaa-0000-0000-0000-000000000003')::text$$),
  'NEGATO: Si eliminano solo gli istruttori…');
select atteso('chi è anche allievo no', tenta($$select elimina_istruttore('aaaaaaaa-0000-0000-0000-000000000010')::text$$),
  'NEGATO: Ugo Allievo è anche allievo…');
select atteso('e la sua iscrizione resta', (select count(*)::text from iscrizioni where persona_id = 'aaaaaaaa-0000-0000-0000-000000000010'), '1');
select atteso('l''account di un tablet non si dà da togliere', tenta($$select elimina_istruttore('aaaaaaaa-0000-0000-0000-000000000011')::text$$),
  'NEGATO: L''account di Zeno è quello di un tablet…');
select atteso('nemmeno cancellando la riga a mano', tenta($$delete from persone where id = 'aaaaaaaa-0000-0000-0000-000000000008'$$),
  'NEGATO: Teo Passato ha delle presenze da istruttore…');
select atteso('e la sua presenza resta', (select count(*)::text from presenze_istruttori), '1');

\echo ''
\echo '--- 3. la segreteria: chi non ha mai insegnato se ne va ---'
select atteso('Pino, e dice quale account togliere', tenta($$select elimina_istruttore('aaaaaaaa-0000-0000-0000-000000000005')::text$$),
  '55555555-5555-5555-5555-555555555555');
select atteso('Pino non c''è più', (select count(*)::text from persone where nome = 'Pino'), '0');
select atteso('tolto dalla Lotta, Gino si elimina', tenta($$delete from corsi_istruttori where persona_id = 'aaaaaaaa-0000-0000-0000-000000000006'$$), 'FATTO (1 righe)');
select atteso('senza account non c''è niente da togliere', tenta($$select coalesce(elimina_istruttore('aaaaaaaa-0000-0000-0000-000000000006')::text, 'nessun account')$$),
  'nessun account');
select atteso('un iscritto si cancella come prima', tenta($$delete from persone where id = 'aaaaaaaa-0000-0000-0000-000000000009'$$), 'FATTO (1 righe)');
select atteso('una persona che non c''è', tenta($$select elimina_istruttore('aaaaaaaa-0000-0000-0000-000000000005')::text$$), 'NEGATO: Questa persona non c''è più');
reset role;
