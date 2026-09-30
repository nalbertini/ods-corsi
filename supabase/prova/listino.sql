-- Il listino: lo cambia solo la segreteria, e lo legge anche chi non ha un
-- accesso, dalla funzione `listino()` e da nient'altro.
-- Si lancia dopo finto-supabase.sql, i sei file dello schema e
-- 19-listino.sql.
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
select atteso('mai cambiato: vale il foglio', coalesce(listino()::text, 'vuoto'), 'vuoto');
select atteso('la tabella non la vede', tenta('select count(*)::text from impostazioni'), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 2. un istruttore non lo cambia ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('istruttore', tenta($$update impostazioni set listino = '{"quota": 1}' where id$$), 'a vuoto (0 righe)');
reset role;

\echo ''
\echo '--- 3. la segreteria sì ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('segreteria', tenta($$update impostazioni set listino = '{"quota": 55, "saldoEntro": "2026-09-15", "corsi": [{"corso": "Lotta 3", "prezzi": [{"annuale": 490}]}], "offerte": []}' where id$$), 'FATTO (1 righe)');
select atteso('non un elenco', tenta($$update impostazioni set listino = '[1, 2]' where id$$), 'NEGATO: …impostazioni_listino_check…');
select atteso('non troppo grande', tenta(format($$update impostazioni set listino = jsonb_build_object('x', %L) where id$$, repeat('a', 70000))), 'NEGATO: …impostazioni_listino_check…');
reset role;

\echo ''
\echo '--- 4. e la pagina di iscrizione lo vede ---'
select chi('');
set role anon;
select atteso('la quota nuova', (listino()->>'quota'), '55');
select atteso('il corso nuovo', (listino()->'corsi'->0->>'corso'), 'Lotta 3');
reset role;

\echo ''
\echo '--- 5. rimesso il foglio ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('vuoto', tenta('update impostazioni set listino = null where id'), 'FATTO (1 righe)');
reset role;
set role anon;
select atteso('di nuovo il foglio', coalesce(listino()::text, 'vuoto'), 'vuoto');
reset role;

\echo ''
\echo 'Listino: tutto a posto.'
