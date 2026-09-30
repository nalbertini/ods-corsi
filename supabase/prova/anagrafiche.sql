-- Nascita, residenza e genitore degli iscritti importati: li vede e li
-- cambia solo la segreteria, e se ne vanno con la persona.
-- Si lancia dopo finto-supabase.sql, i sette file dello schema e
-- 18-anagrafiche.sql.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'maura@ods.it'),
  ('33333333-3333-3333-3333-333333333333', 'luca@ods.it');
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Maura', 'Uno', 'istruttore', 'maura@ods.it', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Luca', 'Rossi', 'iscritto', 'luca@ods.it', '33333333-3333-3333-3333-333333333333'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'Sara', 'Rossi', 'iscritto', null, null);

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
\echo '--- 1. la segreteria ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('scrive i dati di Sara, col genitore',
  tenta($$insert into anagrafiche (persona_id, nato_il, nato_a, codice_fiscale, comune, indirizzo, genitore_nome, genitore_cognome, genitore_nato)
    values ('aaaaaaaa-0000-0000-0000-000000000004', '2016-05-04', 'Torino', 'RSSSRA16E44L219X', 'Collegno', 'via Roma 1', 'Luca', 'Rossi', 'Torino, 15/03/1980')$$), 'FATTO (1 righe)');
select atteso('il server scrive chi è stato', (select p.nome from anagrafiche a join persone p on p.id = a.cambiata_da), 'Anna');
select atteso('un altro import aggiunge il CAP e lascia il resto',
  tenta($$insert into anagrafiche (persona_id, cap) values ('aaaaaaaa-0000-0000-0000-000000000004', '10093')
    on conflict (persona_id) do update set cap = excluded.cap$$), 'FATTO (1 righe)');
select atteso('e il resto c''è', (select comune || ' ' || cap from anagrafiche), 'Collegno 10093');
select atteso('un codice fiscale in minuscolo no',
  tenta($$update anagrafiche set codice_fiscale = 'rsssra16e44l219x'$$), 'NEGATO: …');
select atteso('un CAP di quattro cifre no', tenta($$update anagrafiche set cap = '1009'$$), 'NEGATO: …');
select atteso('un indirizzo vuoto no', tenta($$update anagrafiche set indirizzo = '  '$$), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 2. un istruttore: fa l''appello, ma gli indirizzi non li vede ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('vede le persone', (select count(*)::text from persone where ruolo = 'iscritto'), '2');
select atteso('non vede i dati anagrafici', (select count(*)::text from anagrafiche), '0');
select atteso('non li scrive',
  tenta($$insert into anagrafiche (persona_id, comune) values ('aaaaaaaa-0000-0000-0000-000000000003', 'Rivoli')$$), 'NEGATO: …');
select atteso('non li cambia', tenta($$update anagrafiche set comune = 'Rivoli'$$), 'a vuoto (0 righe)');
reset role;

\echo ''
\echo '--- 3. un iscritto con l''accesso e chi non ha fatto l''accesso ---'
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('l''iscritto non vede niente', (select count(*)::text from anagrafiche), '0');
reset role;
select chi('');
set role anon;
select atteso('anon nemmeno', tenta($$select count(*)::text from anagrafiche$$), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 4. la persona se ne va, e i suoi dati con lei ---'
delete from persone where id = 'aaaaaaaa-0000-0000-0000-000000000004';
select atteso('non resta niente', (select count(*)::text from anagrafiche), '0');
