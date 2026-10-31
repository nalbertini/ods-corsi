-- I metodi di pagamento spenti da REGOLE → COME SI PAGA (126-metodi-pagamento.sql):
-- tutti accesi all'inizio, solo id veri, la segreteria li
-- cambia, l'amministrazione e gli altri no, e chiunque (anche senza accesso)
-- legge l'elenco con `metodi_spenti()`.
-- Si lancia dopo finto-supabase.sql e i file dello schema, su un database suo.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';
reset role;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'ada@ods.it'),
  ('55555555-5555-5555-5555-555555555555', 'maura@ods.it');
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Ada', 'Conti', 'amministrazione', 'ada@ods.it', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'Maura', 'Uno', 'istruttore', 'maura@ods.it', '55555555-5555-5555-5555-555555555555');

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
\echo '--- 1. All''inizio niente è spento ---'
select atteso('nessun metodo spento', (select cardinality(metodi_spenti())::text), '0');
select atteso('la tabella ha la riga', (select count(*)::text from impostazioni), '1');

\echo ''
\echo '--- 2. Anna, segreteria: spegne e riaccende ---'
set role authenticated;
select chi('11111111-1111-1111-1111-111111111111');
select atteso('spegne POS e assegno', tenta($$update impostazioni set metodi_spenti = '{pos,assegno}' where id$$), 'FATTO (1 righe)');
select atteso('li legge', (select array_to_string(metodi_spenti, ',') from impostazioni where id), 'pos,assegno');
select atteso('un id che non esiste no', tenta($$update impostazioni set metodi_spenti = '{bitcoin}' where id$$), 'NEGATO: …');
select atteso('il resto delle impostazioni è intatto', (select mesi_presenze::text from impostazioni where id), '24');

\echo ''
\echo '--- 3. Chi non è in segreteria ---'
select chi('22222222-2222-2222-2222-222222222222');
select atteso('l''amministrazione non li cambia', tenta($$update impostazioni set metodi_spenti = '{}' where id$$), 'NEGATO: l''amministrazione cambia solo il listino');
select chi('55555555-5555-5555-5555-555555555555');
select atteso('l''istruttore non li cambia', tenta($$update impostazioni set metodi_spenti = '{}' where id$$), 'a vuoto (0 righe)');

\echo ''
\echo '--- 4. Anche chi non ha un accesso li legge, con la funzione ---'
reset role;
set role anon;
select atteso('anon legge gli spenti', (select array_to_string(metodi_spenti(), ',')), 'pos,assegno');
select atteso('ma non la tabella', tenta($$select metodi_spenti from impostazioni$$), 'NEGATO: …');
reset role;
