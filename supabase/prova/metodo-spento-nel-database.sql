-- Un metodo di pagamento online spento da REGOLE → COME SI PAGA (126) non apre pagamenti nuovi neanche
-- chiamando le funzioni SQL da soli, senza la Edge Function (129-metodo-spento-nel-database.sql):
-- l'iscritto con la sessione che chiama `satispay_prepara_quota` (lo stesso vale per saldo e corso) e il
-- modulo con la carta (`carta_prepara_prima`) sono rifiutati con Satispay o la carta spenti; accesi, passano.
-- I pagamenti già scritti (anche quelli in attesa) restano come sono.
-- Si lancia dopo finto-supabase.sql e i file dello schema, su un database suo.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

create or replace function chi(u text) returns void language plpgsql as $$
begin perform set_config('prova.utente', u, false); end $$;
create or replace function rifiuto(sql text) returns text language plpgsql as $$
begin
  execute sql;
  return 'nessun errore';
exception when others then return sqlstate || ' ' || sqlerrm;
end $$;
create or replace function atteso(cosa text, avuto text, voluto text) returns text language plpgsql as $$
begin
  if avuto is distinct from voluto and not (voluto like '%…' and avuto like replace(voluto, '…', '%')) then
    raise exception '% · atteso «%», avuto «%»', cosa, voluto, avuto;
  end if;
  return 'ok  ' || cosa || ' → ' || avuto;
end $$;
grant execute on function chi(text), rifiuto(text), atteso(text, text, text) to anon, authenticated, service_role;

insert into auth.users (id, email, email_confirmed_at) values ('55555555-5555-5555-5555-555555555555', 'bruno@fam.it', now());
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000006', 'Bruno', 'Solo', 'iscritto', 'bruno@fam.it', '55555555-5555-5555-5555-555555555555');
insert into anagrafiche (persona_id, nato_il) values ('aaaaaaaa-0000-0000-0000-000000000006', current_date - interval '30 years');
insert into corsi (id, nome) values ('cccccccc-0000-0000-0000-000000000001', 'Judo 3');
update impostazioni set listino = '{"quota": 50, "offerte": [],
  "corsi": [{"corso": "Judo 3", "corsoId": "cccccccc-0000-0000-0000-000000000001", "eta": "", "orari": [], "prezzi": [{"annuale": 400, "trimestre": 150}]}]}' where id;

\echo ''
\echo '--- 1. Satispay spento: Bruno, con la sessione, non prepara la quota ---'
update impostazioni set metodi_spenti = '{satispay}' where id;
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('la quota con Satispay spento', rifiuto($$select satispay_prepara_quota('aaaaaaaa-0000-0000-0000-000000000006')$$),
  '22023 Satispay per ora non è attivo: paga in palestra o col bonifico');
reset role;
select atteso('…e nessun pagamento nasce', (select count(*)::text from pagamenti_satispay), '0');

\echo ''
\echo '--- 2. La carta spenta: il modulo non prepara il pagamento, anche dalla Edge Function ---'
update impostazioni set metodi_spenti = '{carta}' where id;
set role service_role;
select atteso('la carta spenta', rifiuto($$select carta_prepara_prima('{"corso": "cccccccc-0000-0000-0000-000000000001", "formula": "annuale",
  "nome": "Luca", "cognome": "Rossi", "email": "luca@esempio.it", "chiave": "11111111-1111-1111-1111-111111111111"}')$$),
  '22023 La carta per ora non è attiva: paga in palestra o col bonifico');
reset role;
select atteso('…e nessun pagamento nasce', (select count(*)::text from pagamenti_satispay), '0');

\echo ''
\echo '--- 3. Spento uno, l''altro passa; accesi, passano tutti e due ---'
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('con la carta spenta Satispay va', satispay_prepara_quota('aaaaaaaa-0000-0000-0000-000000000006')->>'stato', 'attesa');
reset role;
update impostazioni set metodi_spenti = '{}' where id;
set role service_role;
select atteso('accesa, la carta va', carta_prepara_prima('{"corso": "cccccccc-0000-0000-0000-000000000001", "formula": "annuale",
  "nome": "Luca", "cognome": "Rossi", "email": "luca@esempio.it", "chiave": "11111111-1111-1111-1111-111111111111"}')->>'stato', 'attesa');
reset role;
select atteso('…due pagamenti in attesa', (select count(*)::text from pagamenti_satispay where stato = 'attesa'), '2');

\echo ''
\echo '--- 4. Spegnere non tocca quel che c''è già ---'
update impostazioni set metodi_spenti = '{satispay,carta}' where id;
with x as (update pagamenti_satispay set stato = 'pagato', pagato_il = now() where stato = 'attesa' returning 1)
  select atteso('un pagamento arrivato si scrive lo stesso', count(*)::text, '2') from x;
insert into pagamenti_satispay (chi, importo, stato) values ('Vecchio Pagamento', 100, 'pagato');
select atteso('…e uno già pagato si registra', (select count(*)::text from pagamenti_satispay where chi = 'Vecchio Pagamento'), '1');
