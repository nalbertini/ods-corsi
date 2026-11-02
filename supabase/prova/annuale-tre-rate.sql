-- La ricevuta di un annuale non si emette con più di 3 rate (`fai_ricevuta`, il corpo comune di tutte le strade):
--   · le rate si contano come `rateAnnuale` (src/lib/ricevute.ts): l'anticipo (> 0), ogni pagamento > 0 sulle voci
--     «Annuale …», più 1 se resta un da dare (> 0). La quota associativa e le altre voci non contano; un pagamento a 0 neanche;
--   · con più di 3 rate `emetti_ricevuta`, `emetti_ricevuta_da_pagamento`, `emetti_ricevuta_da_movimento` ed
--     `emetti_ricevuta_satispay` rifiutano (22023) e non lasciano niente: né il numero preso né il pagamento annullato;
--   · la chiave del modulo già emesso viene prima: ripetuto dà la stessa ricevuta, anche se i dati nel frattempo sono cambiati;
--   · chi non è della segreteria trova 42501 prima di ogni conteggio.
-- Le stesse regole di `cosaNonVa` (src/lib/ricevute.ts) e della modalità prova, provate da scripts/prova-ricevuta.mjs
-- (stessi casi, stessi messaggi). Le ricevute già emesse con 4 rate restano: il blocco è solo per quelle nuove.
-- Il messaggio ha «L'annuale» con l'apostrofo diritto o curvo: qui `_` li prende tutti e due (il «…» finale accende il confronto con i caratteri jolly di `atteso).
-- Si lancia dopo finto-supabase.sql e i file dello schema. Nomi tutti inventati.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('33333333-3333-3333-3333-333333333333', 'lia@ods.it'),
  ('66666666-6666-6666-6666-666666666666', 'ada@ods.it');
-- Anna: segreteria. Ada: amministrazione. Lia: iscritta, senza ruolo da segreteria.
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Lia', 'Blu', 'iscritto', 'lia@ods.it', '33333333-3333-3333-3333-333333333333'),
  ('aaaaaaaa-0000-0000-0000-000000000030', 'Ada', 'Conti', 'amministrazione', 'ada@ods.it', '66666666-6666-6666-6666-666666666666'),
  ('aaaaaaaa-0000-0000-0000-000000000010', 'Paolo', 'Bianchi', 'iscritto', null, null);
insert into voci_contabili (nome, tipo, di_sistema) values ('Corsi e altri pagamenti', 'entrata', false) on conflict do nothing;

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
-- Un pagamento di una voce.
create or replace function pg(quanto int, metodo text default 'Bonifico', giorno text default '2026-09-10') returns jsonb language sql immutable as $$
  select jsonb_build_object('data', giorno, 'importo', quanto, 'metodo', metodo) $$;
-- Una voce con i suoi pagamenti.
create or replace function voce(descrizione text, prezzo int, pagamenti jsonb) returns jsonb language sql immutable as $$
  select jsonb_build_object('descrizione', descrizione, 'quantita', 1, 'prezzo', prezzo, 'pagamenti', pagamenti) $$;
-- La ricevuta di Paolo con queste voci, più quel che cambia il caso (l'anticipo, la chiave).
create or replace function dati(voci jsonb, extra jsonb default '{}', giorno text default '2026-09-10') returns jsonb language sql immutable as $$
  select jsonb_build_object('persona_id', 'aaaaaaaa-0000-0000-0000-000000000010', 'data', giorno,
    'intestatario', jsonb_build_object('nome', 'Paolo', 'cognome', 'Bianchi'), 'voci', voci) || extra $$;
-- Un annuale da 500 € con questi pagamenti, e l'anticipo.
create or replace function annuale(anticipo int, pagamenti jsonb, extra jsonb default '{}') returns jsonb language sql immutable as $$
  select dati(jsonb_build_array(voce('Annuale Judo adulti', 50000, pagamenti)), jsonb_build_object('anticipo', anticipo) || extra) $$;
create or replace function fatta(d jsonb) returns text language plpgsql as $$
begin return (emetti_ricevuta(d) ? 'id')::text; end $$;
create or replace function ric(d jsonb) returns text language plpgsql as $$
begin return rifiuto(format('select emetti_ricevuta(%L)', d)); end $$;
create or replace function da_pag(n int, d jsonb) returns text language plpgsql as $$
begin return rifiuto(format('select emetti_ricevuta_da_pagamento(%L, %L)', d, pd(n))); end $$;
create or replace function sat(d jsonb) returns text language plpgsql as $$
begin return rifiuto(format('select emetti_ricevuta_satispay(%L, %L)', d, 'dddddddd-0000-0000-0000-000000000001')); end $$;
create or replace function id_voce(n text, t text) returns uuid language sql stable security definer set search_path = public as $$
  select id from voci_contabili where nome = n and tipo::text = t $$;
create or replace function id_cassa(n text) returns uuid language sql stable security definer set search_path = public as $$
  select id from casse where nome = n $$;
create or replace function id_mov(d text) returns uuid language sql stable security definer set search_path = public as $$
  select id from movimenti where descrizione = d $$;
create or replace function da_mov(d jsonb, m text) returns text language plpgsql as $$
begin return rifiuto(format('select emetti_ricevuta_da_movimento(%L, %L)', d, id_mov(m))); end $$;
-- Quel che la segreteria non legge si legge da superutente.
create or replace function quante() returns int language sql security definer set search_path = public as $$
  select count(*)::int from ricevute $$;
create or replace function ultimo() returns int language sql security definer set search_path = public as $$
  select coalesce(max(numero), 0) from ricevute where anno = 2026 $$;
create or replace function numero(id text) returns int language sql security definer set search_path = public as $$
  select numero from ricevute where ricevute.id = numero.id::uuid $$;
create or replace function diretto_attivo(n int) returns boolean language sql security definer set search_path = public as $$
  select annullato_il is null and ricevuta_id is null from pagamenti_diretti where id = pd(n) $$;
create or replace function diretti_attivi_del_movimento(m text) returns int language sql security definer set search_path = public as $$
  select count(*)::int from pagamenti_diretti where movimento_id = id_mov(m) and annullato_il is null $$;
create or replace function satispay_ricevuta() returns text language sql security definer set search_path = public as $$
  select coalesce(ricevuta_id::text, 'nessuna') from pagamenti_satispay where id = 'dddddddd-0000-0000-0000-000000000001' $$;
create or replace function ricevuta_con_chiave(k text) returns text language sql security definer set search_path = public as $$
  select coalesce(id::text, 'nessuna') from ricevute where chiave = k::uuid $$;
grant execute on function chi(text), rifiuto(text), atteso(text, text, text), pg(int, text, text), voce(text, int, jsonb), dati(jsonb, jsonb, text),
  annuale(int, jsonb, jsonb), fatta(jsonb), ric(jsonb), da_pag(int, jsonb), pd(int), sat(jsonb), id_voce(text, text), id_cassa(text), id_mov(text),
  da_mov(jsonb, text), quante(), ultimo(), numero(text), diretto_attivo(int), diretti_attivi_del_movimento(text), satispay_ricevuta(),
  ricevuta_con_chiave(text) to anon, authenticated;

-- I pagamenti a mano di Paolo (10/09): 01 e 02 da 100 € in bonifico, 03 da 100 €. Un Satispay arrivato da 30 €. Un bonifico da 420 €.
insert into pagamenti_diretti (id, persona_id, data, importo, metodo, voce, creato_da)
select pd(n), 'aaaaaaaa-0000-0000-0000-000000000010', '2026-09-10', 10000, 'Bonifico', 'ALTRO', 'aaaaaaaa-0000-0000-0000-000000000001' from generate_series(1, 3) n;
insert into pagamenti_satispay (id, chi, importo, stato, pagato_il, persona_id) values
  ('dddddddd-0000-0000-0000-000000000001', 'Bianchi Paolo', 3000, 'pagato', '2026-09-10 10:00+02', 'aaaaaaaa-0000-0000-0000-000000000010');
insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione, persona_id) values
  ('entrata', '2026-10-15', 42000, id_voce('Corsi e altri pagamenti', 'entrata'), id_cassa('Conto Corrente'), 'Bonifico Paolo annuale', 'aaaaaaaa-0000-0000-0000-000000000010');

\set ANNA '''11111111-1111-1111-1111-111111111111'''
\set ADA '''66666666-6666-6666-6666-666666666666'''
\set LIA '''33333333-3333-3333-3333-333333333333'''
\set QUATTRO '''22023 L_annuale si paga in al massimo 3 rate: con questi importi sarebbero 4. Unisci dei versamenti o saldalo prima di fare la ricevuta…'''
\set CINQUE '''22023 L_annuale si paga in al massimo 3 rate: con questi importi sarebbero 5. Unisci dei versamenti o saldalo prima di fare la ricevuta…'''
\set NO_RUOLO '''42501 la ricevuta la fa la segreteria'''

\echo ''
\echo '--- 1. emetti_ricevuta: più di 3 rate no ---'
select chi(:ANNA);
set role authenticated;
select quante() as prima, ultimo() as num \gset
select atteso('anticipo, 2 pagamenti e il da dare: 4 rate, no', ric(annuale(5000, jsonb_build_array(pg(10000), pg(10000)))), :QUATTRO);
select atteso('anticipo e 3 pagamenti che saldano: 4 rate, no', ric(annuale(5000, jsonb_build_array(pg(10000), pg(10000), pg(25000)))), :QUATTRO);
select atteso('3 pagamenti e il da dare: 4 rate, no', ric(annuale(0, jsonb_build_array(pg(10000), pg(10000), pg(10000)))), :QUATTRO);
select atteso('anticipo e 4 pagamenti che saldano: 5 rate, il numero giusto nel messaggio', ric(annuale(5000, jsonb_build_array(pg(10000), pg(10000), pg(10000), pg(15000)))), :CINQUE);
select atteso('una chiave nuova non cambia niente', ric(annuale(5000, jsonb_build_array(pg(10000), pg(10000)), '{"chiave": "bbbbbbbb-0000-0000-0000-000000000009"}')), :QUATTRO);
select atteso('nessuna riga in ricevute', (quante() - :prima)::text, '0');
select atteso('il numero successivo non è avanzato', ultimo()::text, :num::text);
reset role;

\echo ''
\echo '--- 2. fino a 3 rate sì, e quel che non è annuale non conta ---'
select chi(:ANNA);
set role authenticated;
select atteso('anticipo, 2 pagamenti che saldano: 3 rate, sì', fatta(annuale(5000, jsonb_build_array(pg(20000), pg(25000)))), 'true');
select atteso('…col numero dopo l''ultimo', ultimo()::text, (:num + 1)::text);
select atteso('anticipo, un pagamento e il da dare: 3 rate, sì', fatta(annuale(5000, jsonb_build_array(pg(10000)))), 'true');
select atteso('annuale pagato in un colpo, sì', fatta(annuale(0, jsonb_build_array(pg(50000)))), 'true');
select atteso('un pagamento a 0 € come quarto non conta, sì', fatta(annuale(5000, jsonb_build_array(pg(20000), pg(25000), pg(0)))), 'true');
select atteso('3 pagamenti sulla quota associativa e 1 sull''annuale, sì', fatta(dati(jsonb_build_array(
  voce('Quota associativa', 5000, jsonb_build_array(pg(1000), pg(1000), pg(3000))),
  voce('Annuale Judo adulti', 50000, jsonb_build_array(pg(10000)))))), 'true');
select atteso('4 pagamenti sulla quota e l''annuale pagato in un colpo, sì', fatta(dati(jsonb_build_array(
  voce('Quota associativa', 5000, jsonb_build_array(pg(1250), pg(1250), pg(1250), pg(1250))),
  voce('Annuale Judo adulti', 50000, jsonb_build_array(pg(50000)))))), 'true');
select atteso('una ricevuta senza annuale con 5 pagamenti, sì', fatta(dati(jsonb_build_array(
  voce('Trimestre Judo adulti', 15000, jsonb_build_array(pg(3000), pg(3000), pg(3000), pg(3000), pg(3000)))))), 'true');
reset role;

\echo ''
\echo '--- 3. la chiave già emessa viene prima ---'
select chi(:ANNA);
set role authenticated;
select atteso('il modulo con 3 rate nasce', fatta(annuale(5000, jsonb_build_array(pg(20000), pg(25000)), '{"chiave": "bbbbbbbb-0000-0000-0000-000000000001"}')), 'true');
select quante() as prima3, ultimo() as num3 \gset
select atteso('ripetuto con gli stessi dati dà la stessa ricevuta',
  (emetti_ricevuta(annuale(5000, jsonb_build_array(pg(20000), pg(25000)), '{"chiave": "bbbbbbbb-0000-0000-0000-000000000001"}'))->>'id')::text,
  ricevuta_con_chiave('bbbbbbbb-0000-0000-0000-000000000001'));
select atteso('ripetuto con dati che ora sarebbero 4 rate dà ancora la stessa, senza rifiuto',
  (emetti_ricevuta(annuale(5000, jsonb_build_array(pg(10000), pg(10000), pg(10000), pg(15000)), '{"chiave": "bbbbbbbb-0000-0000-0000-000000000001"}'))->>'id')::text,
  ricevuta_con_chiave('bbbbbbbb-0000-0000-0000-000000000001'));
select atteso('…e non ne fa un''altra', (quante() - :prima3)::text || '/' || (ultimo() - :num3)::text, '0/0');
reset role;

\echo ''
\echo '--- 4. chi non è della segreteria trova 42501, prima del conteggio ---'
select chi(:LIA);
set role authenticated;
select atteso('iscritta con 4 rate: 42501, non il conteggio', ric(annuale(5000, jsonb_build_array(pg(10000), pg(10000)))), :NO_RUOLO);
reset role;

\echo ''
\echo '--- 5. dal pagamento a mano ---'
select chi(:ANNA);
set role authenticated;
select quante() as prima5, ultimo() as num5 \gset
select atteso('anticipo, il suo pagamento e un altro, e il da dare: 4 rate, no',
  da_pag(1, annuale(5000, jsonb_build_array(pg(10000), pg(10000, 'POS')))), :QUATTRO);
select atteso('…il pagamento a mano non è annullato', diretto_attivo(1)::text, 'true');
select atteso('…e nessuna ricevuta, numero fermo', (quante() - :prima5)::text || '/' || (ultimo() - :num5)::text, '0/0');
select atteso('anticipo, il suo pagamento e il da dare: 3 rate, sì', da_pag(1, annuale(5000, jsonb_build_array(pg(10000)))), 'nessun errore');
select atteso('…e il pagamento a mano diventa della ricevuta', diretto_attivo(1)::text, 'false');
reset role;

\echo ''
\echo '--- 6. dal movimento (bonifico da 420 €, 200 € assegnati a Paolo) ---'
select chi(:ADA);
set role authenticated;
select atteso('si assegnano 200 € all''annuale', rifiuto(format('select assegna_movimento(%L, %L)', id_mov('Bonifico Paolo annuale'),
  jsonb_build_array(jsonb_build_object('persona_id', 'aaaaaaaa-0000-0000-0000-000000000010', 'voce', 'Annuale Judo Kids', 'importo', 20000)))), 'nessun errore');
reset role;
select chi(:ANNA);
set role authenticated;
select quante() as prima6, ultimo() as num6 \gset
select atteso('anticipo, 2 bonifici e il da dare: 4 rate, no',
  da_mov(dati(jsonb_build_array(voce('Annuale Judo Kids', 42000, jsonb_build_array(pg(10000, 'Bonifico', '2026-10-15'), pg(10000, 'Bonifico', '2026-10-15')))),
    '{"anticipo": 5000}', '2026-10-15'), 'Bonifico Paolo annuale'), :QUATTRO);
select atteso('…i soldi assegnati restano da assegnare, non annullati', diretti_attivi_del_movimento('Bonifico Paolo annuale')::text, '1');
select atteso('…e nessuna ricevuta, numero fermo', (quante() - :prima6)::text || '/' || (ultimo() - :num6)::text, '0/0');
select atteso('2 bonifici e il da dare: 3 rate, sì',
  da_mov(dati(jsonb_build_array(voce('Annuale Judo Kids', 42000, jsonb_build_array(pg(10000, 'Bonifico', '2026-10-15'), pg(10000, 'Bonifico', '2026-10-15')))),
    '{}', '2026-10-15'), 'Bonifico Paolo annuale'), 'nessun errore');
select atteso('…le assegnazioni diventano della ricevuta', diretti_attivi_del_movimento('Bonifico Paolo annuale')::text, '0');
reset role;

\echo ''
\echo '--- 7. con Satispay ---'
select chi(:ANNA);
set role authenticated;
select quante() as prima7, ultimo() as num7 \gset
select atteso('anticipo, Satispay, POS e il da dare: 4 rate, no',
  sat(annuale(5000, jsonb_build_array(pg(3000, 'Satispay'), pg(10000, 'POS')))), :QUATTRO);
select atteso('…il Satispay resta senza ricevuta', satispay_ricevuta(), 'nessuna');
select atteso('…e numero fermo', (quante() - :prima7)::text || '/' || (ultimo() - :num7)::text, '0/0');
select atteso('anticipo, Satispay e il da dare: 3 rate, sì', sat(annuale(5000, jsonb_build_array(pg(3000, 'Satispay')))), 'nessun errore');
reset role;
