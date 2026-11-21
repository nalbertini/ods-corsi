-- La carta (PayPal) non c'è più (169-via-la-carta.sql): né le funzioni, né le colonne, né il metodo da
-- spegnere in REGOLE → COME SI PAGA. Satispay dal modulo va come prima, e si ferma da spento.
-- Si lancia dopo finto-supabase.sql e i file dello schema, su un database suo.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

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
grant execute on function rifiuto(text), atteso(text, text, text) to anon, authenticated, service_role;

insert into corsi (id, nome) values ('cccccccc-0000-0000-0000-000000000001', 'Judo 3');
update impostazioni set listino = '{"quota": 50, "offerte": [],
  "corsi": [{"corso": "Judo 3", "corsoId": "cccccccc-0000-0000-0000-000000000001", "eta": "", "orari": [], "prezzi": [{"annuale": 400, "trimestre": 150}]}]}' where id;

\echo ''
\echo '--- 1. Le funzioni e le colonne della carta non ci sono più ---'
select atteso('carta_prepara_prima', coalesce(to_regprocedure('public.carta_prepara_prima(jsonb)')::text, 'via'), 'via');
select atteso('carta_creato', coalesce(to_regprocedure('public.carta_creato(uuid, text)')::text, 'via'), 'via');
select atteso('carta_esito', coalesce(to_regprocedure('public.carta_esito(text, text)')::text, 'via'), 'via');
select atteso('carta_stato_pagamento', coalesce(to_regprocedure('public.carta_stato_pagamento(uuid)')::text, 'via'), 'via');
select atteso('pagamento_prima col circuito',
  coalesce(to_regprocedure('public.pagamento_prima(text, uuid, text, text, text, text, uuid)')::text, 'via'), 'via');
select atteso('pagamenti_satispay senza circuito né paypal_id',
  (select count(*)::text from information_schema.columns
    where table_schema = 'public' and table_name = 'pagamenti_satispay' and column_name in ('circuito', 'paypal_id')), '0');
select atteso('nessuna funzione parla ancora di PayPal o di circuito',
  coalesce((select string_agg(proname, ', ' order by proname) from pg_proc
             where pronamespace = 'public'::regnamespace and (prosrc ilike '%paypal%' or prosrc ilike '%circuito%')), 'nessuna'), 'nessuna');

\echo ''
\echo '--- 2. La carta non si spegne più: non c''è fra i metodi ---'
select atteso('metodi_spenti con la carta', rifiuto($$update impostazioni set metodi_spenti = '{carta}' where id$$),
  '23514 new row for relation "impostazioni" violates check constraint "impostazioni_metodi_spenti_validi"');
select atteso('…gli altri sì', rifiuto($$update impostazioni set metodi_spenti = '{satispay,pos}' where id$$), 'nessun errore');
update impostazioni set metodi_spenti = '{}' where id;

\echo ''
\echo '--- 3. Satispay dal modulo va come prima ---'
select atteso('pagamento_prima non si chiama da fuori',
  (has_function_privilege('anon', 'public.pagamento_prima(uuid, text, text, text, text, uuid)', 'execute')
   or has_function_privilege('authenticated', 'public.pagamento_prima(uuid, text, text, text, text, uuid)', 'execute')
   or has_function_privilege('service_role', 'public.pagamento_prima(uuid, text, text, text, text, uuid)', 'execute'))::text, 'false');
-- Le funzioni rifatte dal 169 tengono i permessi di prima: chi può chiamarle fra anon, authenticated e service_role.
select atteso('i permessi delle funzioni rifatte restano quelli di prima',
  (select string_agg(f || ':' || concat_ws(',', case when has_function_privilege('anon', f, 'execute') then 'anon' end,
      case when has_function_privilege('authenticated', f, 'execute') then 'authenticated' end,
      case when has_function_privilege('service_role', f, 'execute') then 'service_role' end), ' ' order by f)
   from unnest(array['emetti_ricevuta_satispay(jsonb,uuid)', 'invia_iscrizione_0(jsonb)', 'pagamenti_satispay_unione()',
     'pagamento_metodo_acceso()', 'registra_pagamento_diretto(jsonb)', 'satispay_creato(uuid,text,text)',
     'satispay_prepara_prima(uuid,text,text,text,text,uuid)', 'satispay_stato_pagamento(uuid)']) f),
  'emetti_ricevuta_satispay(jsonb,uuid):authenticated invia_iscrizione_0(jsonb): pagamenti_satispay_unione(): pagamento_metodo_acceso(): registra_pagamento_diretto(jsonb):authenticated satispay_creato(uuid,text,text):service_role satispay_prepara_prima(uuid,text,text,text,text,uuid):service_role satispay_stato_pagamento(uuid):service_role');
set role service_role;
select satispay_prepara_prima('cccccccc-0000-0000-0000-000000000001', 'annuale', 'Luca', 'Rossi', 'luca@esempio.it',
  '11111111-1111-1111-1111-111111111111') as primo \gset
select atteso('il pagamento nasce in attesa, corso e quota del listino', (:'primo'::jsonb->>'stato') || ' ' || (:'primo'::jsonb->>'importo'), 'attesa 45000');
select atteso('lo stesso browser ritrova lo stesso pagamento',
  satispay_prepara_prima('cccccccc-0000-0000-0000-000000000001', 'annuale', 'Luca', 'Rossi', 'luca@esempio.it',
    '11111111-1111-1111-1111-111111111111')->>'id', :'primo'::jsonb->>'id');
select atteso('un altro browser ne fa uno suo',
  (satispay_prepara_prima('cccccccc-0000-0000-0000-000000000001', 'annuale', 'Luca', 'Rossi', 'luca@esempio.it',
    '22222222-2222-2222-2222-222222222222')->>'id' <> :'primo'::jsonb->>'id')::text, 'true');
select atteso('senza chiave no', rifiuto($$select satispay_prepara_prima('cccccccc-0000-0000-0000-000000000001', 'annuale', 'Luca', 'Rossi',
  'luca@esempio.it', null)$$), '22023 Ricarica la pagina e riprova a pagare');
reset role;

\echo ''
\echo '--- 4. Spento, Satispay non apre pagamenti nuovi ---'
update impostazioni set metodi_spenti = '{satispay}' where id;
set role service_role;
select atteso('Satispay spento', rifiuto($$select satispay_prepara_prima('cccccccc-0000-0000-0000-000000000001', 'annuale', 'Anna', 'Neri',
  'anna@esempio.it', '33333333-3333-3333-3333-333333333333')$$), '22023 Satispay per ora non è attivo: paga in palestra o col bonifico');
reset role;
select atteso('…e nessun pagamento nasce per Anna', (select count(*)::text from pagamenti_satispay where email = 'anna@esempio.it'), '0');
