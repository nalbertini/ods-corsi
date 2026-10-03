-- Per quanto si tengono le presenze, per l'informativa privacy: chi non ha un
-- accesso legge i mesi scelti dalla segreteria da `mesi_presenze_pubblici()`,
-- e nient'altro della tabella delle impostazioni; anche dopo aver rilanciato
-- `06-iscrizioni.sql`, che toglie ad `anon` le funzioni che non conosce.
-- Si lancia dopo finto-supabase.sql, i sei file dello schema e
-- 31-informativa-mesi.sql.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'maura@ods.it');
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Maura', 'Uno', 'istruttore', 'maura@ods.it', '22222222-2222-2222-2222-222222222222');

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
\echo '--- 1. chi non ha un accesso ---'
select chi('');
set role anon;
select atteso('i mesi di partenza', tenta('select mesi_presenze_pubblici()::text'), '24');
select atteso('la tabella non la vede', tenta('select count(*)::text from impostazioni'), 'NEGATO: …');
select atteso('e non la cambia', tenta('update impostazioni set mesi_presenze = 1 where id'), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 2. un istruttore la chiama, e i mesi non li cambia ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('istruttore legge', tenta('select mesi_presenze_pubblici()::text'), '24');
select atteso('istruttore non cambia', tenta('update impostazioni set mesi_presenze = 12 where id'), 'a vuoto (0 righe)');
reset role;

\echo ''
\echo '--- 3. la segreteria sceglie 36 mesi ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('segreteria', tenta('update impostazioni set mesi_presenze = 36 where id'), 'FATTO (1 righe)');
reset role;
select chi('');
set role anon;
select atteso('l''informativa legge 36', tenta('select mesi_presenze_pubblici()::text'), '36');
reset role;

\echo ''
\echo '--- 4. dopo aver rilanciato 06-iscrizioni.sql ---'
\ir ../06-iscrizioni.sql
-- 06 toglie ad `anon` anche gli aiuti della prova, che stanno in `public`:
-- glieli si ridà, e solo quelli.
grant execute on function tenta(text), atteso(text, text, text), chi(text) to anon, authenticated;
select chi('');
set role anon;
select atteso('anon la chiama ancora', tenta('select mesi_presenze_pubblici()::text'), '36');
select atteso('e la tabella resta chiusa', tenta('select count(*)::text from impostazioni'), 'NEGATO: …');
reset role;

\echo ''
\echo 'Mesi delle presenze per l''informativa: tutto a posto.'
