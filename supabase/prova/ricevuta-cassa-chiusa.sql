-- I contanti in un giorno di cassa già chiusa non entrano neanche dalla ricevuta (92-ricevuta-cassa-chiusa.sql):
--   · `emetti_ricevuta` rifiuta un pagamento in contanti con importo > 0 e data (la sua, o se manca quella della
--     ricevuta) fino all'ultima chiusura non annullata della Cassa Contanti; carta, POS e bonifico passano;
--   · la chiave del modulo già usata dà la ricevuta già fatta, anche se nel frattempo il giorno si è chiuso;
--   · `emetti_ricevuta_satispay` rifiuta allo stesso modo, e il Satispay resta senza ricevuta;
--   · `emetti_ricevuta_da_pagamento`: i contanti del pagamento a mano (registrato prima della chiusura) passano,
--     altri contanti in giorni chiusi no;
--   · `cassa_contanti_chiusa_fino()` dà alla segreteria la data della chiusura (per l'avviso), senza aprirle le chiusure.
-- Le stesse regole di `contantiInGiornoChiuso` (src/lib/contabilita.ts) e della modalità prova, provate da
-- scripts/prova-contabilita.mjs e scripts/prova-pagamenti.mjs.
-- Si lancia dopo finto-supabase.sql e i file dello schema, fino a 92-ricevuta-cassa-chiusa.sql.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'maura@ods.it'),
  ('33333333-3333-3333-3333-333333333333', 'lia@ods.it'),
  ('44444444-4444-4444-4444-444444444444', 'tablet@ods.it'),
  ('66666666-6666-6666-6666-666666666666', 'ada@ods.it');
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Maura', 'Uno', 'istruttore', 'maura@ods.it', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Lia', 'Blu', 'iscritto', 'lia@ods.it', '33333333-3333-3333-3333-333333333333'),
  ('aaaaaaaa-0000-0000-0000-000000000030', 'Ada', 'Conti', 'amministrazione', 'ada@ods.it', '66666666-6666-6666-6666-666666666666'),
  ('aaaaaaaa-0000-0000-0000-000000000010', 'Paolo', 'Bianchi', 'iscritto', null, null);
insert into sale (id, nome) values ('eeeeeeee-0000-0000-0000-000000000001', 'Tatami');
insert into postazioni (id, nome, sala_id, utente_id) values
  ('eeeeeeee-0000-0000-0000-000000000002', 'Tablet Tatami', 'eeeeeeee-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444');

-- I pagamenti a mano di Paolo, registrati prima della chiusura: id `cccccccc-…-0000000000NN`.
--   01-02: 30 € Contanti del 10/09 · 03: 30 € POS del 10/09
create or replace function diretto(n int, metodo text default 'Contanti') returns uuid language sql as $$
  insert into pagamenti_diretti (id, persona_id, data, importo, metodo, voce, creato_da)
  values (('cccccccc-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, 'aaaaaaaa-0000-0000-0000-000000000010', '2026-09-10', 3000, metodo,
          'ALTRO', 'aaaaaaaa-0000-0000-0000-000000000001')
  returning id
$$;
select diretto(1), diretto(2), diretto(3, 'POS');
-- Un Satispay arrivato, di Paolo, da 30 €.
insert into pagamenti_satispay (id, chi, importo, stato, pagato_il, persona_id) values
  ('dddddddd-0000-0000-0000-000000000001', 'Bianchi Paolo', 3000, 'pagato', '2026-09-10 10:00+02', 'aaaaaaaa-0000-0000-0000-000000000010');

create or replace function chi(u text) returns void language plpgsql as $$
begin perform set_config('prova.utente', u, false); end $$;
-- Un rifiuto della funzione, col suo codice e la sua frase: una funzione che manca (42883) non vale.
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
create or replace function pd(n int) returns uuid language sql immutable as $$
  select ('cccccccc-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid $$;
-- Un pagamento di una voce: data null = senza data.
create or replace function pg(quanto int, metodo text default 'Contanti', giorno text default '2026-09-10') returns jsonb language sql immutable as $$
  select jsonb_strip_nulls(jsonb_build_object('data', giorno, 'importo', quanto, 'metodo', metodo)) $$;
-- La ricevuta di Paolo del giorno dato, con una voce da `prezzo` e i suoi pagamenti, più quel che cambia il caso.
create or replace function dati(prezzo int, pagamenti jsonb, giorno text default '2026-09-10', extra jsonb default '{}') returns jsonb language sql immutable as $$
  select jsonb_build_object('persona_id', 'aaaaaaaa-0000-0000-0000-000000000010', 'data', giorno,
    'intestatario', jsonb_build_object('nome', 'Paolo', 'cognome', 'Bianchi'),
    'voci', jsonb_build_array(jsonb_build_object('descrizione', 'ALTRO', 'quantita', 1, 'prezzo', prezzo, 'pagamenti', pagamenti))) || extra $$;
-- Fatta? Una ricevuta che torna con l'id.
create or replace function fatta(d jsonb) returns text language plpgsql as $$
begin return (emetti_ricevuta(d) ? 'id')::text; end $$;
-- Le chiamate per nome, cercate quando si chiamano (plpgsql).
create or replace function da(n int, d jsonb) returns jsonb language plpgsql as $$
begin return emetti_ricevuta_da_pagamento(d, pd(n)); end $$;
create or replace function fino() returns text language plpgsql as $$
begin return cassa_contanti_chiusa_fino()::text; end $$;
-- Quel che la segreteria non legge si legge da superutente.
create or replace function stato(n int) returns text language plpgsql security definer set search_path = public as $$
declare x pagamenti_diretti;
begin
  select * into x from pagamenti_diretti where id = pd(n);
  if x.annullato_il is null and x.annullato_da is null and x.ricevuta_id is null then return 'attivo'; end if;
  return 'annullato · ' || case when x.ricevuta_id is null then 'senza ricevuta' else 'con ricevuta' end;
end $$;
create or replace function quante() returns int language sql security definer set search_path = public as $$
  select count(*)::int from ricevute $$;
create or replace function ultimo() returns int language sql security definer set search_path = public as $$
  select coalesce(max(numero), 0) from ricevute where anno = 2026 $$;
create or replace function numero(id text) returns int language sql security definer set search_path = public as $$
  select numero from ricevute where ricevute.id = numero.id::uuid $$;
create or replace function satispay_ricevuta() returns text language sql security definer set search_path = public as $$
  select coalesce(ricevuta_id::text, 'nessuna') from pagamenti_satispay where id = 'dddddddd-0000-0000-0000-000000000001' $$;
create or replace function previsto() returns bigint language sql security definer set search_path = public as $$
  select previsto_cassa((select id from casse where nome = 'Cassa Contanti'), date '2026-09-10') $$;
grant execute on function rifiuto(text), atteso(text, text, text), chi(text), pd(int), pg(int, text, text), dati(int, jsonb, text, jsonb),
  fatta(jsonb), da(int, jsonb), fino(), stato(int), quante(), ultimo(), numero(text), satispay_ricevuta(), previsto() to anon, authenticated;

-- Prima della chiusura: la ricevuta del 9 col modulo di chiave K.
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select emetti_ricevuta(dati(3000, jsonb_build_array(pg(3000, 'Contanti', '2026-09-09')), '2026-09-09',
  '{"chiave": "bbbbbbbb-0000-0000-0000-000000000001"}'))->>'id' as rk \gset
reset role;

-- La Cassa Contanti chiusa fino al 10/09 (com'è dopo `chiudi_cassa`: i numeri non contano qui).
update casse set dal = '2026-09-01' where nome = 'Cassa Contanti';
insert into chiusure_cassa (id, cassa_id, dal, data, previsto, contato, differenza, chiusa_da) values
  ('ffffffff-0000-0000-0000-000000000010', (select id from casse where nome = 'Cassa Contanti'), '2026-09-01', '2026-09-10', 0, 0, 0,
   'aaaaaaaa-0000-0000-0000-000000000030');

\set CHIUSO '''22023 Quel giorno la cassa è già chiusa: scegli una data dopo la chiusura'''

\echo ''
\echo '--- 1. chiusa fino al 10: i contanti di quei giorni non entrano dalla ricevuta ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select quante() as prima, ultimo() as num \gset
select atteso('contanti 30 € datati 10 no', rifiuto($$select emetti_ricevuta(dati(3000, jsonb_build_array(pg(3000))))$$), :CHIUSO);
select atteso('«CONTANTI » no', rifiuto($$select emetti_ricevuta(dati(3000, jsonb_build_array(pg(3000, 'CONTANTI '))))$$), :CHIUSO);
select atteso('contanti datati 5 no', rifiuto($$select emetti_ricevuta(dati(3000, jsonb_build_array(pg(3000, 'Contanti', '2026-09-05'))))$$), :CHIUSO);
select atteso('ricevuta del 20 con contanti datati 10 no', rifiuto($$select emetti_ricevuta(dati(3000, jsonb_build_array(pg(3000)), '2026-09-20'))$$), :CHIUSO);
select atteso('pagamento senza data e ricevuta del 10 no', rifiuto($$select emetti_ricevuta(dati(3000, jsonb_build_array(pg(3000, 'Contanti', null))))$$), :CHIUSO);
select atteso('basta uno: POS del 10 e contanti del 20 vanno, contanti del 5 no',
  rifiuto($$select emetti_ricevuta(dati(9000, jsonb_build_array(pg(3000, 'POS'), pg(3000, 'Contanti', '2026-09-20'), pg(3000, 'Contanti', '2026-09-05')), '2026-09-20'))$$), :CHIUSO);
select atteso('una chiave nuova non cambia niente', rifiuto($$select emetti_ricevuta(dati(3000, jsonb_build_array(pg(3000)), '2026-09-10', '{"chiave": "bbbbbbbb-0000-0000-0000-000000000009"}'))$$), :CHIUSO);
select atteso('nessuna riga in ricevute', (quante() - :prima)::text, '0');
select atteso('contanti datati 11 sì', fatta(dati(3000, jsonb_build_array(pg(3000, 'Contanti', '2026-09-11')), '2026-09-11')), 'true');
select atteso('…col numero dopo l''ultimo: nessuno preso dai rifiuti', ultimo()::text, (:num + 1)::text);
select atteso('ricevuta del 10 con contanti datati 20 sì', fatta(dati(3000, jsonb_build_array(pg(3000, 'Contanti', '2026-09-20')))), 'true');
reset role;

\echo ''
\echo '--- 2. carta, POS e bonifico non toccano la cassa ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('carta del 10 sì', fatta(dati(3000, jsonb_build_array(pg(3000, 'Carta')))), 'true');
select atteso('POS del 10 sì', fatta(dati(3000, jsonb_build_array(pg(3000, 'POS')))), 'true');
select atteso('bonifico del 10 sì', fatta(dati(3000, jsonb_build_array(pg(3000, 'Bonifico')))), 'true');
reset role;

\echo ''
\echo '--- 3. la chiave del modulo: la ricevuta del 9 già fatta torna, anche a cassa chiusa ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select quante() as prima \gset
select atteso('la stessa chiamata con la chiave K dà la stessa ricevuta, senza errore',
  emetti_ricevuta(dati(3000, jsonb_build_array(pg(3000, 'Contanti', '2026-09-09')), '2026-09-09', '{"chiave": "bbbbbbbb-0000-0000-0000-000000000001"}'))->>'id', :'rk');
select atteso('…nessuna ricevuta nuova', (quante() - :prima)::text, '0');
reset role;

\echo ''
\echo '--- 4. col Satispay: lo stesso rifiuto, e il Satispay resta senza ricevuta ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select quante() as prima \gset
select atteso('Satispay 30 € e contanti 30 € datati 10 no',
  rifiuto($$select emetti_ricevuta_satispay(dati(6000, jsonb_build_array(pg(3000, 'Satispay'), pg(3000))), 'dddddddd-0000-0000-0000-000000000001')$$), :CHIUSO);
select atteso('nessuna ricevuta nuova', (quante() - :prima)::text, '0');
select atteso('…e il Satispay non ha ricevuta', satispay_ricevuta(), 'nessuna');
select atteso('con i contanti datati 11 sì',
  (emetti_ricevuta_satispay(dati(6000, jsonb_build_array(pg(3000, 'Satispay'), pg(3000, 'Contanti', '2026-09-11')), '2026-09-11'), 'dddddddd-0000-0000-0000-000000000001') ? 'id')::text, 'true');
reset role;

\echo ''
\echo '--- 5. FANNE LA RICEVUTA: i contanti del pagamento a mano registrato prima della chiusura passano, altri no ---'
select previsto() as cassa \gset
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select quante() as prima \gset
select atteso('30 € contanti del 10 del pagamento a mano, più 20 € contanti datati 5, no',
  rifiuto($$select da(1, dati(5000, jsonb_build_array(pg(3000), pg(2000, 'Contanti', '2026-09-05'))))$$), :CHIUSO);
select atteso('pagamento a mano col POS, più 20 € contanti del 10, no',
  rifiuto($$select da(3, dati(5000, jsonb_build_array(pg(3000, 'POS'), pg(2000))))$$), :CHIUSO);
select atteso('nessuna ricevuta nuova', (quante() - :prima)::text, '0');
select atteso('…e i pagamenti a mano sono com''erano', stato(1) || ' / ' || stato(3), 'attivo / attivo');
select atteso('30 € contanti del 10, come il pagamento a mano, sì', (da(1, dati(3000, jsonb_build_array(pg(3000)))) ? 'id')::text, 'true');
select atteso('…il pagamento a mano è annullato e legato alla ricevuta', stato(1), 'annullato · con ricevuta');
select atteso('…anche senza data, nella ricevuta del 10', (da(2, dati(3000, jsonb_build_array(pg(3000, 'Contanti', null)))) ? 'id')::text, 'true');
select atteso('pagamento a mano col POS, da solo, sì', (da(3, dati(3000, jsonb_build_array(pg(3000, 'POS')))) ? 'id')::text, 'true');
reset role;
select atteso('il previsto della Cassa Contanti al 10 non è cambiato', previsto()::text, :'cassa');

\echo ''
\echo '--- 6. cassa_contanti_chiusa_fino(): la data, per segreteria e amministrazione ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('segreteria: il 10', fino(), '2026-09-10');
select atteso('…ma le chiusure restano dell''amministrazione', (select count(*)::text from chiusure_cassa), '0');
reset role;
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('amministrazione: il 10', fino(), '2026-09-10');
reset role;
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('istruttore no', left(rifiuto('select fino()'), 5), '42501');
reset role;
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('iscritto no', left(rifiuto('select fino()'), 5), '42501');
reset role;
select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('tablet no', left(rifiuto('select fino()'), 5), '42501');
reset role;
select chi('');
set role anon;
select atteso('chi non ha accesso no', left(rifiuto('select fino()'), 5), '42501');
reset role;
select atteso('anon non ha execute', has_function_privilege('anon', 'cassa_contanti_chiusa_fino()', 'execute')::text, 'false');
-- `fai_ricevuta` col suo `tranne` salta il giorno chiuso: la chiamano solo le funzioni del database.
select atteso('fai_ricevuta: authenticated non ha execute', has_function_privilege('authenticated', 'fai_ricevuta(jsonb,date)', 'execute')::text, 'false');
select atteso('fai_ricevuta: anon non ha execute', has_function_privilege('anon', 'fai_ricevuta(jsonb,date)', 'execute')::text, 'false');

\echo ''
\echo '--- 7. la chiusura annullata non chiude più; vale l''ultima non annullata ---'
update chiusure_cassa set annullata_il = now(), annullata_da = 'aaaaaaaa-0000-0000-0000-000000000030'
  where id = 'ffffffff-0000-0000-0000-000000000010';
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('senza chiusure attive: null', coalesce(fino(), 'null'), 'null');
select atteso('contanti datati 10 sì', fatta(dati(3000, jsonb_build_array(pg(3000)))), 'true');
reset role;
insert into chiusure_cassa (id, cassa_id, dal, data, previsto, contato, differenza, chiusa_da) values
  ('ffffffff-0000-0000-0000-000000000009', (select id from casse where nome = 'Cassa Contanti'), '2026-09-01', '2026-09-09', 0, 0, 0,
   'aaaaaaaa-0000-0000-0000-000000000030');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('chiusa fino al 9: il 9', fino(), '2026-09-09');
select atteso('contanti datati 10, anticipo 50 € e un pagamento a 0 € sì',
  fatta(dati(8000, jsonb_build_array(pg(3000), pg(0, 'Contanti', '2026-09-05')), '2026-09-10', '{"anticipo": 5000}')), 'true');
select atteso('contanti datati 9 no', rifiuto($$select emetti_ricevuta(dati(3000, jsonb_build_array(pg(3000, 'Contanti', '2026-09-09'))))$$), :CHIUSO);
reset role;

\echo ''
\echo 'TUTTO A POSTO'
