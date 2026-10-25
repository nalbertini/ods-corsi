-- La carta di credito/debito nel modulo di iscrizione (113-carta.sql): paga PayPal, solo con i campi
-- carta ospitati e Apple Pay / Google Pay. Il pagamento sta in `pagamenti_satispay` (il nome non
-- cambia) con `circuito = 'carta'`; l'importo lo calcola il database dal listino, mai il telefono.
-- Stato e ordine li scrive solo la Edge Function (service_role); nessun dato della carta si salva.
-- La metà di prova: scripts/prova-pagamento-carta.mjs, stessi casi e stessi messaggi.
-- Si lancia dopo finto-supabase.sql e i file dello schema (il 113 compreso).
--
-- Cosa si assume del 113 (lo decide il file SQL, queste prove lo fissano):
--   · `pagamenti_satispay.circuito text not null default 'satispay'` ammette 'satispay' e 'carta';
--     `paypal_id text unique`; nessuna colonna per i dati della carta;
--   · `carta_prepara_prima(dati jsonb)` con dati = {corso, formula, nome, cognome, email, chiave} risponde
--     {stato, id, importo, paypal_id, pagato_il} come `satispay_prepara_prima` (paypal_id null finché
--     `carta_creato` non l'ha scritto). Importo dal listino. Un solo pagamento vivo per scelta,
--     persona e circuito; in attesa da meno di 30 minuti si riusa, da più di 30 se ne fa uno nuovo
--     (il vecchio non è più in attesa); già pagato e non preso, si ritrova; solo con la stessa chiave
--     (il browser che l'ha fatto), che è obbligatoria;
--   · `carta_creato(id uuid, paypal_id text)` scrive l'id dell'ordine una volta sola (come
--     `satispay_creato`); un paypal_id già usato da un altro pagamento rifiuta;
--   · `carta_esito(paypal_id text, stato text)`, stato = 'attesa' | 'pagato' | 'non-andato' (lo calcola
--     la Edge Function con `statoCarta`); risponde {stato, ...}; il pagato resta pagato, il non andato
--     non diventa pagato, un paypal_id mai visto rifiuta; confermato dopo 30 minuti diventa pagato
--     comunque (finisce in PAGAMENTI come «Carta senza richiesta»);
--   · `carta_stato_pagamento(id uuid)` risponde {stato, importo, pagato_il, collegato, paypal_id, creato_il};
--   · le quattro funzioni le esegue solo `service_role`;
--   · `invia_iscrizione` accetta l'id di un pagamento con carta nella chiave `pagamento_satispay`, con gli
--     stessi controlli di Satispay e i testi della carta (22023);
--   · `emetti_ricevuta_satispay` con un pagamento carta vuole il metodo «Carta»: 22023
--     «Con la carta sono arrivati X: nel pagato di questa ricevuta ce ne sono Y»;
--   · `registra_pagamento_diretto` con metodo «Carta», se alla persona sono già arrivati soldi con la carta
--     dal modulo non in una ricevuta valida: 22023 «Con la carta sono già arrivati X dal modulo: fai la
--     ricevuta con quelli»;
--   · esiste la cassa «Carta».
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'maura@ods.it'),
  ('33333333-3333-3333-3333-333333333333', 'luca@ods.it'),
  ('99999999-9999-9999-9999-999999999999', 'tablet@ods.it');
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Maura', 'Uno', 'istruttore', 'maura@ods.it', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Luca', 'Rossi', 'iscritto', 'luca@ods.it', '33333333-3333-3333-3333-333333333333'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'Paolo', 'Bianchi', 'iscritto', null, null),
  ('aaaaaaaa-0000-0000-0000-000000000006', 'Sara', 'Verdi', 'iscritto', null, null),
  ('aaaaaaaa-0000-0000-0000-000000000007', 'Gino', 'Neri', 'iscritto', null, null),
  ('aaaaaaaa-0000-0000-0000-000000000008', 'Ugo', 'Gialli', 'iscritto', null, null),
  ('aaaaaaaa-0000-0000-0000-000000000009', 'Rita', 'Blu', 'iscritto', null, null);
insert into corsi (id, nome) values
  ('cccccccc-0000-0000-0000-000000000001', 'Judo 3'),
  ('cccccccc-0000-0000-0000-000000000002', 'Lotta 3'),
  ('cccccccc-0000-0000-0000-000000000003', 'Corso nuovo'),
  ('cccccccc-0000-0000-0000-000000000004', 'Pesi');
insert into sale (id, nome) values ('bbbbbbbb-0000-0000-0000-000000000001', 'Tatami');
insert into postazioni (id, nome, sala_id, utente_id) values
  ('dddddddd-0000-0000-0000-000000000001', 'Tablet', 'bbbbbbbb-0000-0000-0000-000000000001', '99999999-9999-9999-9999-999999999999');

-- Il listino in euro, come lo salva LISTINO. «Corso nuovo» non c'è: è senza prezzo.
update impostazioni set listino = '{
  "quota": 50, "saldoEntro": "2026-08-31", "offerte": [],
  "corsi": [
    {"corso": "Judo 3", "corsoId": "cccccccc-0000-0000-0000-000000000001", "eta": "", "orari": [], "prezzi": [{"saldo": 350, "annuale": 400, "trimestre": 150}]},
    {"corso": "Lotta 3", "corsoId": "cccccccc-0000-0000-0000-000000000002", "eta": "", "orari": [], "prezzi": [{"annuale": 368, "trimestre": 140}]},
    {"corso": "Pesi", "corsoId": "cccccccc-0000-0000-0000-000000000004", "eta": "", "orari": [], "prezzi": [{"etichetta": "1 GIORNO", "annuale": 340}, {"etichetta": "2 GIORNI", "annuale": 450}]}
  ]}' where id;

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
-- Un rifiuto con il suo codice e la sua frase: una funzione che manca (42883) non vale.
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
-- Una scrittura che non passa: rifiutata, o a vuoto perché nessuna policy la lascia.
create or replace function non_scrive(sql text) returns text language sql as $$
  select case when tenta(sql) ~ '^(NEGATO|a vuoto)' then 'non scrive' else tenta(sql) end
$$;
-- Una ricevuta di una voce sola, di `importo` centesimi, pagata tutta col `metodo`.
create or replace function ricevuta_con(persona text, importo int, metodo text, pagato int default null) returns jsonb language sql as $$
  select jsonb_build_object(
    'data', '2026-10-20', 'persona_id', persona,
    'ente', jsonb_build_object('nome', 'Asd Il Centro Judo'),
    'intestatario', jsonb_build_object('nome', 'Paolo', 'cognome', 'Bianchi'),
    'voci', jsonb_build_array(jsonb_build_object('descrizione', 'Annuale Judo 3', 'quantita', 1, 'prezzo', importo,
      'pagamenti', jsonb_build_array(jsonb_build_object('data', '2026-10-20', 'importo', coalesce(pagato, importo), 'metodo', metodo)))),
    'anticipo', 0)
$$;
-- I dati della scelta di Luca Rossi per il corso e la formula, con la chiave del browser che li manda (sempre lo stesso).
create or replace function scelta(corso text, formula text, nome text, cognome text, email text) returns jsonb language sql as $$
  select jsonb_build_object('corso', corso, 'formula', formula, 'nome', nome, 'cognome', cognome, 'email', email,
    'chiave', '11111111-1111-1111-1111-111111111111')
$$;
grant execute on function tenta(text), rifiuto(text), atteso(text, text, text), chi(text), non_scrive(text),
  ricevuta_con(text, int, text, int), scelta(text, text, text, text, text) to anon, authenticated, service_role;

\echo ''
\echo '--- 1. la tabella: il circuito, l''id dell''ordine, e niente dati della carta ---'
select atteso('il circuito c''è, di default Satispay: i pagamenti di prima non cambiano',
  (select column_default || ' ' || is_nullable from information_schema.columns where table_name = 'pagamenti_satispay' and column_name = 'circuito'),
  '''satispay''::text NO');
select atteso('l''id dell''ordine c''è', (select count(*)::text from information_schema.columns where table_name = 'pagamenti_satispay' and column_name = 'paypal_id'), '1');
select atteso('nessuna colonna per i dati della carta',
  (select count(*)::text from information_schema.columns where table_schema = 'public' and table_name = 'pagamenti_satispay'
     and column_name ~* '(numero|cvv|cvc|scadenza|titolare|^pan$|carta_|token|iban)'), '0');
insert into pagamenti_satispay (chi, importo, stato) values ('Vecchio Pagamento', 100, 'pagato');
select atteso('un pagamento scritto come prima è Satispay',
  (select circuito from pagamenti_satispay where chi = 'Vecchio Pagamento'), 'satispay');
select atteso('un circuito che non c''è: no',
  tenta($$insert into pagamenti_satispay (chi, importo, stato, circuito) values ('X', 100, 'pagato', 'bitcoin')$$), 'NEGATO: …');
select atteso('la carta: sì', tenta($$insert into pagamenti_satispay (chi, importo, stato, circuito) values ('Carta Prova', 100, 'pagato', 'carta')$$), 'FATTO (1 righe)');
select atteso('lo stesso id dell''ordine su due pagamenti: no',
  tenta($$insert into pagamenti_satispay (chi, importo, stato, circuito, paypal_id) values ('Y', 100, 'pagato', 'carta', 'PP-DOPPIO'), ('Z', 100, 'pagato', 'carta', 'PP-DOPPIO')$$), 'NEGATO: …');
delete from pagamenti_satispay where chi in ('Vecchio Pagamento', 'Carta Prova');
select atteso('esiste la cassa Carta', (select count(*)::text from casse where nome = 'Carta'), '1');

\echo ''
\echo '--- 2. carta_prepara_prima: il pagamento nasce senza richiesta, e ne vive uno solo ---'
set role service_role;
select carta_prepara_prima(scelta('cccccccc-0000-0000-0000-000000000001', 'annuale', 'Luca', 'Rossi', 'luca.carta@esempio.it')) as pa \gset
select atteso('in attesa, con l''importo del database (oggi il saldo è chiuso)',
  (:'pa'::jsonb->>'stato') || ' ' || (:'pa'::jsonb->>'importo'),
  'attesa ' || importo_corso('cccccccc-0000-0000-0000-000000000001', 'annuale', (now() at time zone 'Europe/Rome')::date));
select atteso('ancora senza id dell''ordine', coalesce(:'pa'::jsonb->>'paypal_id', 'null'), 'null');
reset role;
select atteso('la riga: carta, senza richiesta, con corso, formula, nome, cognome, email',
  (select circuito || ' ' || coalesce(richiesta_id::text, 'senza richiesta') || ' ' || corso_id || ' ' || formula || ' ' || nome || ' ' || cognome || ' ' || email || ' ' || chi
     from pagamenti_satispay where id = (:'pa'::jsonb->>'id')::uuid),
  'carta senza richiesta cccccccc-0000-0000-0000-000000000001 annuale Luca Rossi luca.carta@esempio.it Rossi Luca');
set role service_role;
select atteso('doppio tocco: lo stesso modulo una seconda volta, lo stesso pagamento',
  carta_prepara_prima(scelta('cccccccc-0000-0000-0000-000000000001', 'annuale', 'Luca', 'Rossi', 'luca.carta@esempio.it'))->>'id', :'pa'::jsonb->>'id');
select atteso('…anche con le maiuscole e gli spazi diversi',
  carta_prepara_prima(scelta('cccccccc-0000-0000-0000-000000000001', 'annuale', ' Luca ', 'Rossi', ' Luca.Carta@esempio.it'))->>'id', :'pa'::jsonb->>'id');
-- Chi conosce nome, cognome, email e scelta di un altro non ritrova il suo pagamento: serve la chiave del suo browser.
select atteso('un altro browser (un''altra chiave): un altro pagamento, mai quello di Luca',
  ((carta_prepara_prima(scelta('cccccccc-0000-0000-0000-000000000001', 'annuale', 'Luca', 'Rossi', 'luca.carta@esempio.it')
     || '{"chiave": "22222222-2222-2222-2222-222222222222"}')->>'id') <> (:'pa'::jsonb->>'id'))::text, 'true');
select atteso('senza chiave: rifiutato per chi paga',
  tenta($$select carta_prepara_prima(scelta('cccccccc-0000-0000-0000-000000000001', 'annuale', 'Luca', 'Rossi', 'luca.carta@esempio.it') - 'chiave')::text$$),
  'NEGATO: Ricarica la pagina e riprova a pagare');
select atteso('una chiave che non si capisce: rifiutata per chi paga',
  tenta($$select carta_prepara_prima(scelta('cccccccc-0000-0000-0000-000000000001', 'annuale', 'Luca', 'Rossi', 'luca.carta@esempio.it') || '{"chiave": "x"}')::text$$),
  'NEGATO: Ricarica la pagina e riprova a pagare');
reset role;
select atteso('un solo pagamento vivo per la scelta e la carta, nel browser di Luca',
  (select count(*)::text from pagamenti_satispay where circuito = 'carta' and stato = 'attesa' and email = 'luca.carta@esempio.it'
     and chiave = '11111111-1111-1111-1111-111111111111'), '1');
set role service_role;
select carta_creato((:'pa'::jsonb->>'id')::uuid, 'PP-1');
select atteso('dopo carta_creato torna con lo stesso pagamento e l''id dell''ordine',
  ((carta_prepara_prima(scelta('cccccccc-0000-0000-0000-000000000001', 'annuale', 'Luca', 'Rossi', 'luca.carta@esempio.it'))->>'id') = (:'pa'::jsonb->>'id'))::text
    || ' ' || (carta_prepara_prima(scelta('cccccccc-0000-0000-0000-000000000001', 'annuale', 'Luca', 'Rossi', 'luca.carta@esempio.it'))->>'paypal_id'),
  'true PP-1');
select carta_creato((:'pa'::jsonb->>'id')::uuid, 'PP-FALSO');
reset role;
select atteso('carta_creato una seconda volta non riscrive l''ordine',
  (select paypal_id from pagamenti_satispay where id = (:'pa'::jsonb->>'id')::uuid), 'PP-1');
-- La Edge Function di Satispay prende l'id che le si manda: con quello di un pagamento con la carta non vede né scrive niente.
set role service_role;
select atteso('satispay_stato_pagamento con un pagamento con la carta: niente',
  coalesce(satispay_stato_pagamento((:'pa'::jsonb->>'id')::uuid)::text, 'niente'), 'niente');
select satispay_creato((:'pa'::jsonb->>'id')::uuid, 'S-FALSO', 'https://esempio.it');
reset role;
select atteso('satispay_creato con un pagamento con la carta non scrive',
  (select coalesce(satispay_id, 'null') from pagamenti_satispay where id = (:'pa'::jsonb->>'id')::uuid), 'null');
set role service_role;
select atteso('stessa scelta, un''altra email: un altro pagamento (mai quello di un altro)',
  ((carta_prepara_prima(scelta('cccccccc-0000-0000-0000-000000000001', 'annuale', 'Luca', 'Rossi', 'altro.luca@esempio.it'))->>'id') <> (:'pa'::jsonb->>'id'))::text, 'true');
select atteso('un''altra formula: un altro pagamento',
  ((carta_prepara_prima(scelta('cccccccc-0000-0000-0000-000000000001', 'trimestre', 'Luca', 'Rossi', 'luca.carta@esempio.it'))->>'id') <> (:'pa'::jsonb->>'id'))::text, 'true');
select atteso('un id dell''ordine già di un altro pagamento: no',
  (rifiuto(format($$select carta_creato(%L::uuid, 'PP-1')$$, (carta_prepara_prima(scelta('cccccccc-0000-0000-0000-000000000001', 'annuale', 'Luca', 'Rossi', 'altro.luca@esempio.it'))->>'id'))) <> 'nessun errore')::text, 'true');
select atteso('un nome oltre gli 80 caratteri: detto per chi paga',
  tenta(format($$select carta_prepara_prima(scelta('cccccccc-0000-0000-0000-000000000001', 'annuale', %L, 'Rossi', 'luca.carta@esempio.it'))::text$$, repeat('L', 81))),
  'NEGATO: Un campo non va: nome e cognome hanno al massimo 80 caratteri');
select atteso('un corso senza prezzo: col bonifico',
  tenta($$select carta_prepara_prima(scelta('cccccccc-0000-0000-0000-000000000003', 'annuale', 'Luca', 'Rossi', 'luca.carta@esempio.it'))::text$$),
  'NEGATO: Un corso non ha ancora il prezzo: paga col bonifico');
select atteso('un corso con più righe di prezzo: col bonifico',
  tenta($$select carta_prepara_prima(scelta('cccccccc-0000-0000-0000-000000000004', 'annuale', 'Luca', 'Rossi', 'luca.carta@esempio.it'))::text$$),
  'NEGATO: Un corso non ha ancora il prezzo: paga col bonifico');
select atteso('un corso che non c''è: rifiutato per chi paga',
  rifiuto($$select carta_prepara_prima(scelta('cccccccc-0000-0000-0000-0000000000ff', 'annuale', 'Luca', 'Rossi', 'luca.carta@esempio.it'))$$), '22023 …');
select atteso('una formula che non c''è: rifiutata per chi paga',
  rifiuto($$select carta_prepara_prima(scelta('cccccccc-0000-0000-0000-000000000001', 'mensile', 'Luca', 'Rossi', 'luca.carta@esempio.it'))$$), '22023 …');
select atteso('senza nome: no',
  tenta($$select carta_prepara_prima(scelta('cccccccc-0000-0000-0000-000000000001', 'annuale', ' ', 'Rossi', 'luca.carta@esempio.it'))::text$$), 'NEGATO: …');

-- La carta e Satispay non si scambiano il pagamento, né l'una né l'altra.
select satispay_prepara_prima('cccccccc-0000-0000-0000-000000000001', 'annuale', 'Luca', 'Rossi', 'luca.carta@esempio.it') as sat \gset
select atteso('Satispay con la stessa scelta: un altro pagamento, non quello della carta',
  ((:'sat'::jsonb->>'id') <> (:'pa'::jsonb->>'id'))::text, 'true');
reset role;
select atteso('…che è Satispay', (select circuito from pagamenti_satispay where id = (:'sat'::jsonb->>'id')::uuid), 'satispay');
set role service_role;
select atteso('…e Satispay ritrova il suo, non quello della carta',
  satispay_prepara_prima('cccccccc-0000-0000-0000-000000000001', 'annuale', 'Luca', 'Rossi', 'luca.carta@esempio.it')->>'id', :'sat'::jsonb->>'id');
select atteso('…e la carta ritrova il suo, non quello di Satispay',
  carta_prepara_prima(scelta('cccccccc-0000-0000-0000-000000000001', 'annuale', 'Luca', 'Rossi', 'luca.carta@esempio.it'))->>'id', :'pa'::jsonb->>'id');
reset role;

\echo ''
\echo '--- 3. in attesa da più di 30 minuti: se ne fa uno nuovo; da meno, si riprende lo stesso ---'
set role service_role;
select carta_prepara_prima(scelta('cccccccc-0000-0000-0000-000000000002', 'annuale', 'Gino', 'Neri', 'gino.carta@esempio.it')) as pg \gset
select carta_creato((:'pg'::jsonb->>'id')::uuid, 'PP-G1');
reset role;
update pagamenti_satispay set creato_il = now() - interval '29 minutes' where id = (:'pg'::jsonb->>'id')::uuid;
set role service_role;
select atteso('abbandonato da 29 minuti: si riprende lo stesso ordine',
  (carta_prepara_prima(scelta('cccccccc-0000-0000-0000-000000000002', 'annuale', 'Gino', 'Neri', 'gino.carta@esempio.it'))->>'id') || ' ' || (carta_prepara_prima(scelta('cccccccc-0000-0000-0000-000000000002', 'annuale', 'Gino', 'Neri', 'gino.carta@esempio.it'))->>'paypal_id'),
  (:'pg'::jsonb->>'id') || ' PP-G1');
reset role;
update pagamenti_satispay set creato_il = now() - interval '31 minutes' where id = (:'pg'::jsonb->>'id')::uuid;
set role service_role;
select carta_prepara_prima(scelta('cccccccc-0000-0000-0000-000000000002', 'annuale', 'Gino', 'Neri', 'gino.carta@esempio.it')) as pg2 \gset
select atteso('abbandonato da 31 minuti: un pagamento nuovo, in attesa',
  ((:'pg2'::jsonb->>'id') <> (:'pg'::jsonb->>'id'))::text || ' ' || (:'pg2'::jsonb->>'stato'), 'true attesa');
reset role;
select atteso('…e ne vive uno solo', (select count(*)::text from pagamenti_satispay where circuito = 'carta' and stato = 'attesa' and email = 'gino.carta@esempio.it'), '1');
select atteso('…il vecchio non è più in attesa', (select (stato <> 'attesa')::text from pagamenti_satispay where id = (:'pg'::jsonb->>'id')::uuid), 'true');

\echo ''
\echo '--- 4. carta_esito: lo stato come lo calcola la Edge Function ---'
set role service_role;
select atteso('in attesa: niente', carta_esito('PP-1', 'attesa')->>'stato', 'attesa');
select atteso('pagato: pagato', carta_esito('PP-1', 'pagato')->>'stato', 'pagato');
reset role;
select atteso('…con l''ora in cui è arrivato', (select (pagato_il is not null)::text from pagamenti_satispay where paypal_id = 'PP-1'), 'true');
set role service_role;
select atteso('pagato una seconda volta: resta pagato', carta_esito('PP-1', 'pagato')->>'stato', 'pagato');
select atteso('non andato dopo pagato: resta pagato', carta_esito('PP-1', 'non-andato')->>'stato', 'pagato');
select atteso('un ordine che non è nostro: errore', (rifiuto($$select carta_esito('PP-ignoto', 'pagato')$$) <> 'nessun errore')::text, 'true');
select carta_creato((:'pg2'::jsonb->>'id')::uuid, 'PP-G2');
select atteso('non andato in attesa: non andato', carta_esito('PP-G2', 'non-andato')->>'stato', 'non-andato');
select atteso('pagato dopo non andato: errore che si vede, non un pagato in silenzio', (rifiuto($$select carta_esito('PP-G2', 'pagato')$$) <> 'nessun errore')::text, 'true');
select atteso('dopo un non andato: un pagamento nuovo, in attesa',
  ((carta_prepara_prima(scelta('cccccccc-0000-0000-0000-000000000002', 'annuale', 'Gino', 'Neri', 'gino.carta@esempio.it'))->>'id') <> (:'pg2'::jsonb->>'id'))::text, 'true');
-- La conferma arriva tardi: i soldi ci sono, il pagamento è pagato comunque.
select carta_prepara_prima(scelta('cccccccc-0000-0000-0000-000000000002', 'trimestre', 'Tardi', 'Arrivato', 'tardi@esempio.it')) as pt \gset
select carta_creato((:'pt'::jsonb->>'id')::uuid, 'PP-T1');
reset role;
update pagamenti_satispay set creato_il = now() - interval '2 hours' where paypal_id = 'PP-T1';
set role service_role;
select atteso('confermato dopo 2 ore: pagato comunque', carta_esito('PP-T1', 'pagato')->>'stato', 'pagato');
select atteso('carta_stato_pagamento: stato e importo',
  (carta_stato_pagamento((:'pt'::jsonb->>'id')::uuid)->>'stato') || ' ' || (carta_stato_pagamento((:'pt'::jsonb->>'id')::uuid)->>'importo'),
  'pagato ' || importo_corso('cccccccc-0000-0000-0000-000000000002', 'trimestre', (now() at time zone 'Europe/Rome')::date));
select atteso('…e non ancora collegato', carta_stato_pagamento((:'pt'::jsonb->>'id')::uuid)->>'collegato', 'false');
select atteso('un pagamento che non c''è: niente', coalesce(carta_stato_pagamento('dddddddd-0000-0000-0000-0000000000ff')::text, 'null'), 'null');
select atteso('pagato e non preso: un altro browser coi dati di Luca non lo ritrova',
  ((carta_prepara_prima(scelta('cccccccc-0000-0000-0000-000000000001', 'annuale', 'Luca', 'Rossi', 'luca.carta@esempio.it')
     || '{"chiave": "33333333-3333-3333-3333-333333333333"}')->>'id') <> (:'pa'::jsonb->>'id'))::text, 'true');
select atteso('…il browser di Luca sì (la pagina ricaricata)',
  carta_prepara_prima(scelta('cccccccc-0000-0000-0000-000000000001', 'annuale', 'Luca', 'Rossi', 'luca.carta@esempio.it'))->>'stato', 'pagato');
reset role;
select atteso('Luca: la carta pagata e senza richiesta è una riga che si vede in PAGAMENTI',
  (select count(*)::text from pagamenti_satispay where circuito = 'carta' and stato = 'pagato' and richiesta_id is null and email = 'luca.carta@esempio.it'), '1');

\echo ''
\echo '--- 5. chi non è la Edge Function non tocca niente ---'
select chi('');
set role anon;
select atteso('anon: carta_prepara_prima no', tenta($$select carta_prepara_prima(scelta('cccccccc-0000-0000-0000-000000000001', 'annuale', 'X', 'Y', 'x@esempio.it'))::text$$), 'NEGATO: …');
select atteso('anon: carta_creato no', tenta($$select carta_creato(gen_random_uuid(), 'PP-x')::text$$), 'NEGATO: …');
select atteso('anon: carta_esito no', tenta($$select carta_esito('PP-1', 'pagato')::text$$), 'NEGATO: …');
select atteso('anon: carta_stato_pagamento no', tenta(format($$select carta_stato_pagamento(%L)::text$$, :'pa'::jsonb->>'id')), 'NEGATO: …');
select atteso('anon: la tabella non la vede', tenta('select count(*)::text from pagamenti_satispay'), 'NEGATO: …');
select atteso('anon: non scrive', non_scrive($$insert into pagamenti_satispay (chi, importo, stato, circuito) values ('X', 100, 'pagato', 'carta')$$), 'non scrive');
reset role;

select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('segreteria: carta_prepara_prima no', tenta($$select carta_prepara_prima(scelta('cccccccc-0000-0000-0000-000000000001', 'annuale', 'X', 'Y', 'x@esempio.it'))::text$$), 'NEGATO: …');
select atteso('segreteria: carta_creato no', tenta($$select carta_creato(gen_random_uuid(), 'PP-x')::text$$), 'NEGATO: …');
select atteso('segreteria: carta_esito no', tenta($$select carta_esito('PP-1', 'pagato')::text$$), 'NEGATO: …');
select atteso('segreteria: carta_stato_pagamento no', tenta(format($$select carta_stato_pagamento(%L)::text$$, :'pa'::jsonb->>'id')), 'NEGATO: …');
select atteso('segreteria: vede i pagamenti, anche quelli con la carta',
  tenta($$select count(*) filter (where circuito = 'carta')::text from pagamenti_satispay$$), (select count(*)::text from pagamenti_satispay where circuito = 'carta'));
select atteso('segreteria: non inserisce', non_scrive($$insert into pagamenti_satispay (chi, importo, stato, circuito) values ('X', 100, 'pagato', 'carta')$$), 'non scrive');
select atteso('segreteria: non segna pagato a mano', non_scrive($$update pagamenti_satispay set stato = 'pagato' where circuito = 'carta'$$), 'non scrive');
select atteso('segreteria: non cambia il circuito', non_scrive($$update pagamenti_satispay set circuito = 'satispay' where circuito = 'carta'$$), 'non scrive');
select atteso('segreteria: non cancella', non_scrive($$delete from pagamenti_satispay$$), 'non scrive');
reset role;

select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('istruttore: non vede i pagamenti', (tenta('select count(*)::text from pagamenti_satispay') ~ '^(0|NEGATO)')::text, 'true');
select atteso('istruttore: carta_esito no', tenta($$select carta_esito('PP-1', 'pagato')::text$$), 'NEGATO: …');
select atteso('istruttore: carta_prepara_prima no', tenta($$select carta_prepara_prima(scelta('cccccccc-0000-0000-0000-000000000001', 'annuale', 'X', 'Y', 'x@esempio.it'))::text$$), 'NEGATO: …');
select atteso('istruttore: non scrive', non_scrive($$update pagamenti_satispay set stato = 'pagato'$$), 'non scrive');
reset role;

select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('iscritto: non vede i pagamenti', (tenta('select count(*)::text from pagamenti_satispay') ~ '^(0|NEGATO)')::text, 'true');
select atteso('iscritto: carta_prepara_prima no', tenta($$select carta_prepara_prima(scelta('cccccccc-0000-0000-0000-000000000001', 'annuale', 'X', 'Y', 'x@esempio.it'))::text$$), 'NEGATO: …');
select atteso('iscritto: carta_esito no', tenta($$select carta_esito('PP-1', 'pagato')::text$$), 'NEGATO: …');
select atteso('iscritto: non inserisce', non_scrive($$insert into pagamenti_satispay (chi, importo, stato, circuito) values ('X', 100, 'pagato', 'carta')$$), 'non scrive');
reset role;

select chi('99999999-9999-9999-9999-999999999999');
set role authenticated;
select atteso('tablet: non vede i pagamenti', (tenta('select count(*)::text from pagamenti_satispay') ~ '^(0|NEGATO)')::text, 'true');
select atteso('tablet: carta_prepara_prima no', tenta($$select carta_prepara_prima(scelta('cccccccc-0000-0000-0000-000000000001', 'annuale', 'X', 'Y', 'x@esempio.it'))::text$$), 'NEGATO: …');
select atteso('tablet: carta_esito no', tenta($$select carta_esito('PP-1', 'pagato')::text$$), 'NEGATO: …');
select atteso('tablet: carta_stato_pagamento no', tenta(format($$select carta_stato_pagamento(%L)::text$$, :'pa'::jsonb->>'id')), 'NEGATO: …');
select atteso('tablet: non scrive', non_scrive($$update pagamenti_satispay set stato = 'pagato'$$), 'non scrive');
reset role;

\echo ''
\echo '--- 6. invia_iscrizione col pagamento con la carta: solo se è pagato, suo e libero ---'
-- Un modulo di Luca Rossi, maggiorenne, ogni volta con un'email nuova: il limite per email non c'entra.
create or replace function cf_prova(lettere text, nato date)
  returns text language sql stable security definer set search_path = public as $$
  select x || cf_controllo(x) from (
    select lettere || to_char(nato, 'YY') || substr('ABCDEHLMPRST', extract(month from nato)::int, 1)
           || lpad(extract(day from nato)::int::text, 2, '0') || 'L219' as x) q
$$;
create sequence if not exists prova_n;
create or replace function modulo(cambi jsonb default '{}') returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'nome', 'Luca', 'cognome', 'Rossi', 'nato_il', (current_date - interval '30 years')::date,
    'nato_a', 'Torino', 'codice_fiscale', cf_prova('RSSLCU', (current_date - interval '30 years')::date), 'indirizzo', 'Via Roma 1',
    'cap', '10093', 'comune', 'Collegno', 'email', 'luca' || nextval('prova_n') || '@esempio.it', 'telefono', '347 111 2233',
    'corsi', jsonb_build_array('cccccccc-0000-0000-0000-000000000001'), 'formula', 'annuale', 'regolamento', true
  ) || cambi
$$;
-- La richiesta mandata da anon col pagamento: l'esito, «22023 …» se rifiutata.
create or replace function manda_con(pagamento text, cambi jsonb default '{}') returns text language plpgsql as $$
declare dati jsonb := modulo(cambi || jsonb_build_object('pagamento_satispay', pagamento)); esito text;
begin
  perform set_config('prova.utente', '', false);
  set role anon;
  esito := rifiuto(format($q$select invia_iscrizione(%L::jsonb)$q$, dati));
  reset role;
  return esito;
end $$;
grant execute on function modulo(jsonb) to anon;
-- Il pagamento di Luca (annuale, Judo 3, luca.carta@esempio.it) torna in attesa per questa sezione: un nuovo ordine.
select id as luca_pagato from pagamenti_satispay where paypal_id = 'PP-1' \gset
update pagamenti_satispay set stato = 'attesa', pagato_il = null where id = :'luca_pagato';
select count(*) as richieste_prima from richieste_iscrizione \gset

select atteso('la carta ancora in attesa: no', manda_con(:'luca_pagato', '{"email": "luca.carta@esempio.it"}'),
  '22023 Il pagamento con la carta non è ancora arrivato: aspetta la conferma e riprova');
select atteso('e nessuna richiesta entrata', (select count(*) from richieste_iscrizione)::text, :'richieste_prima');
set role service_role;
select atteso('la carta passa', carta_esito('PP-1', 'pagato')->>'stato', 'pagato');
reset role;
select atteso('pagata, ma per la formula trimestre: no', manda_con(:'luca_pagato', '{"email": "luca.carta@esempio.it", "formula": "trimestre"}'),
  '22023 Il pagamento con la carta era per un altro corso o un’altra formula: rimetti la scelta di prima, o chiama la segreteria');
select atteso('pagata, ma per un altro corso: no',
  manda_con(:'luca_pagato', '{"email": "luca.carta@esempio.it", "corsi": ["cccccccc-0000-0000-0000-000000000002"]}'),
  '22023 Il pagamento con la carta era per un altro corso o un’altra formula: rimetti la scelta di prima, o chiama la segreteria');
select atteso('pagata per un corso, e la richiesta ne ha due: no',
  manda_con(:'luca_pagato', '{"email": "luca.carta@esempio.it", "corsi": ["cccccccc-0000-0000-0000-000000000001", "cccccccc-0000-0000-0000-000000000002"]}'),
  '22023 Il pagamento con la carta era per un altro corso o un’altra formula: rimetti la scelta di prima, o chiama la segreteria');
-- Un id che non c'è non dice di che circuito era: il testo resta quello di Satispay, come nell'app.
select atteso('un pagamento che non c''è: no', manda_con('dddddddd-0000-0000-0000-0000000000ff'),
  '22023 Questo pagamento Satispay non vale più: paga di nuovo in fondo al modulo');
select atteso('a nome e email di un altro (chi ha trovato l''id): no',
  manda_con(:'luca_pagato', jsonb_build_object('nome', 'Gino', 'cognome', 'Neri', 'email', 'gino@esempio.it', 'codice_fiscale', cf_prova('NREGNI', (current_date - interval '30 years')::date))),
  '22023 Il pagamento con la carta è a un altro nome o un’altra email: rimetti quelli di prima, o chiama la segreteria');
select atteso('stessi nome e cognome ma un''altra email: no', manda_con(:'luca_pagato'),
  '22023 Il pagamento con la carta è a un altro nome o un’altra email: rimetti quelli di prima, o chiama la segreteria');
select atteso('e nessuna richiesta entrata, dopo i rifiuti', (select count(*) from richieste_iscrizione)::text, :'richieste_prima');
select atteso('e il pagamento ancora libero', (select coalesce(richiesta_id::text, 'libero') from pagamenti_satispay where id = :'luca_pagato'), 'libero');
select atteso('un pagamento Satispay in attesa: i testi di Satispay, non quelli della carta',
  manda_con(:'sat'::jsonb->>'id', '{"email": "luca.carta@esempio.it"}'), '22023 Il pagamento Satispay non è ancora arrivato: conferma in Satispay e riprova');
select atteso('pagata, stesso corso, formula, nome ed email: la richiesta entra', manda_con(:'luca_pagato', '{"email": "Luca.Carta@esempio.it "}'), 'nessun errore');
select id as nuova from richieste_iscrizione where email = 'luca.carta@esempio.it' \gset
select atteso('e il pagamento è collegato a lei', (select richiesta_id::text from pagamenti_satispay where id = :'luca_pagato'), :'nuova');
select atteso('lo stesso pagamento una seconda volta, un''altra email: no', manda_con(:'luca_pagato'),
  '22023 Questo pagamento con la carta non vale più: paga di nuovo in fondo al modulo');
select atteso('la risposta si è persa e si rimanda lo stesso: nessun errore', manda_con(:'luca_pagato', '{"email": "luca.carta@esempio.it"}'), 'nessun errore');
select atteso('e le richieste entrate sono una', (select count(*) - :richieste_prima from richieste_iscrizione)::text, '1');
set role service_role;
select atteso('carta_stato_pagamento lo dice collegato', carta_stato_pagamento(:'luca_pagato')->>'collegato', 'true');
reset role;
select atteso('un pagamento non andato: no', manda_con(:'pg2'::jsonb->>'id', jsonb_build_object('nome', 'Gino', 'cognome', 'Neri', 'email', 'gino.carta@esempio.it',
    'corsi', jsonb_build_array('cccccccc-0000-0000-0000-000000000002'), 'codice_fiscale', cf_prova('NREGNI', (current_date - interval '30 years')::date))),
  '22023 Il pagamento con la carta non è ancora arrivato: aspetta la conferma e riprova');

\echo ''
\echo '--- 7. la ricevuta col pagamento con la carta: il metodo è «Carta», e una volta sola ---'
-- Paolo paga con la carta, la richiesta arriva ed è accolta: la sua scheda è la 5.
set role service_role;
select carta_prepara_prima(scelta('cccccccc-0000-0000-0000-000000000001', 'annuale', 'Paolo', 'Bianchi', 'paolo@esempio.it')) as pp \gset
select carta_creato((:'pp'::jsonb->>'id')::uuid, 'PP-P1');
select carta_esito('PP-P1', 'pagato');
reset role;
select atteso('Paolo: la richiesta con la carta entra', manda_con(:'pp'::jsonb->>'id',
  jsonb_build_object('nome', 'Paolo', 'cognome', 'Bianchi', 'email', 'paolo@esempio.it', 'codice_fiscale', cf_prova('BNCPLA', (current_date - interval '30 years')::date))),
  'nessun errore');
update richieste_iscrizione set stato = 'accolta', persona_id = 'aaaaaaaa-0000-0000-0000-000000000005' where email = 'paolo@esempio.it';
select importo as quanto from pagamenti_satispay where id = (:'pp'::jsonb->>'id')::uuid \gset
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la ricevuta con Satispay per i soldi della carta: no, e lo dice',
  (rifiuto(format($$select emetti_ricevuta_satispay(%L::jsonb, %L::uuid)$$, ricevuta_con('aaaaaaaa-0000-0000-0000-000000000005', :quanto, 'Satispay'), :'pp'::jsonb->>'id'))
    like '22023 Con la carta sono arrivati % nel pagato di questa ricevuta ce ne sono 0 €')::text, 'true');
select atteso('la ricevuta con la carta per meno di quanto è arrivato: no',
  (rifiuto(format($$select emetti_ricevuta_satispay(%L::jsonb, %L::uuid)$$, ricevuta_con('aaaaaaaa-0000-0000-0000-000000000005', :quanto, 'Carta', :quanto - 1000), :'pp'::jsonb->>'id'))
    like '22023 Con la carta sono arrivati % nel pagato di questa ricevuta ce ne sono % €')::text, 'true');
select atteso('la ricevuta per un''altra persona: no',
  tenta(format($$select emetti_ricevuta_satispay(%L::jsonb, %L::uuid)::text$$, ricevuta_con('aaaaaaaa-0000-0000-0000-000000000006', :quanto, 'Carta'), :'pp'::jsonb->>'id')), 'NEGATO: …');
select atteso('e nessuna ricevuta fatta', (select count(*)::text from ricevute), '0');
select emetti_ricevuta_satispay(ricevuta_con('aaaaaaaa-0000-0000-0000-000000000005', :quanto, 'Carta'), (:'pp'::jsonb->>'id')::uuid) as fatta \gset
select atteso('la ricevuta giusta (Carta, tutto quel che è arrivato): fatta, col totale pagato', (:'fatta'::jsonb->>'pagato'), :'quanto');
select atteso('il pagamento sa in quale ricevuta è entrato', (select ricevuta_id::text from pagamenti_satispay where id = (:'pp'::jsonb->>'id')::uuid), :'fatta'::jsonb->>'id');
select atteso('una seconda volta: no',
  tenta(format($$select emetti_ricevuta_satispay(%L::jsonb, %L::uuid)::text$$, ricevuta_con('aaaaaaaa-0000-0000-0000-000000000005', :quanto, 'Carta'), :'pp'::jsonb->>'id')), 'NEGATO: …');
select atteso('e la ricevuta resta una', (select count(*)::text from ricevute), '1');
reset role;
select atteso('un pagamento Satispay con un metodo Carta nella ricevuta: no, come prima vuole Satispay',
  (select (rifiuto(format($$select emetti_ricevuta_satispay(%L::jsonb, %L::uuid)$$, ricevuta_con('aaaaaaaa-0000-0000-0000-000000000006', 100, 'Carta'), id)) <> 'nessun errore')::text
     from (select id from pagamenti_satispay where circuito = 'satispay' limit 1) x), 'true');

\echo ''
\echo '--- 8. il pagamento a mano con «Carta» quando c''è una carta libera dal modulo ---'
-- Soldi della carta del modulo, come li lasciano carta_esito e accogli_iscrizione.
--   Sara: 300 € liberi, più uno in attesa e uno non andato. Gino: 30,50 € liberi.
--   Rita: tutto in una ricevuta. Ugo: solo in attesa e non andati. Paolo: la sua è nella ricevuta della sezione 7.
insert into ricevute (id, anno, numero, data, persona_id, ente, intestatario, voci, totale, pagato, chiave) values
  ('dddddddd-0000-0000-0000-000000000123', 2026, 123, '2026-09-10', 'aaaaaaaa-0000-0000-0000-000000000009', '{}', '{"nome": "Rita", "cognome": "Blu"}',
   '[{"descrizione": "Quota", "quantita": 1, "prezzo": 4000, "pagamenti": [{"data": "2026-09-10", "importo": 4000, "metodo": "Carta"}]}]', 4000, 4000,
   'bbbbbbbb-0000-0000-0000-000000000003');
insert into pagamenti_satispay (chi, importo, stato, persona_id, ricevuta_id, circuito) values
  ('Verdi Sara', 30000, 'pagato', 'aaaaaaaa-0000-0000-0000-000000000006', null, 'carta'),
  ('Verdi Sara', 9900, 'attesa', 'aaaaaaaa-0000-0000-0000-000000000006', null, 'carta'),
  ('Verdi Sara', 9900, 'non-andato', 'aaaaaaaa-0000-0000-0000-000000000006', null, 'carta'),
  ('Neri Gino', 3050, 'pagato', 'aaaaaaaa-0000-0000-0000-000000000007', null, 'carta'),
  ('Blu Rita', 4000, 'pagato', 'aaaaaaaa-0000-0000-0000-000000000009', 'dddddddd-0000-0000-0000-000000000123', 'carta'),
  ('Gialli Ugo', 7000, 'attesa', 'aaaaaaaa-0000-0000-0000-000000000008', null, 'carta'),
  ('Gialli Ugo', 7000, 'non-andato', 'aaaaaaaa-0000-0000-0000-000000000008', null, 'carta');
create or replace function pag(persona text, importo int, metodo text) returns jsonb language sql as $$
  select jsonb_build_object('persona_id', persona, 'data', '2026-10-20', 'importo', importo, 'metodo', metodo, 'voce', 'Quota associativa')
$$;
grant execute on function pag(text, int, text) to authenticated;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('Sara, «Carta» a mano no: 300 € liberi',
  rifiuto($$select registra_pagamento_diretto(pag('aaaaaaaa-0000-0000-0000-000000000006', 701, 'Carta'))$$),
  '22023 Con la carta sono già arrivati 300 € dal modulo: fai la ricevuta con quelli');
select atteso('« carta » minuscolo e con gli spazi, uguale',
  rifiuto($$select registra_pagamento_diretto(pag('aaaaaaaa-0000-0000-0000-000000000006', 702, ' carta '))$$),
  '22023 Con la carta sono già arrivati 300 € dal modulo: fai la ricevuta con quelli');
select atteso('qualunque importo: anche quanto è arrivato',
  rifiuto($$select registra_pagamento_diretto(pag('aaaaaaaa-0000-0000-0000-000000000006', 30000, 'Carta'))$$),
  '22023 Con la carta sono già arrivati 300 € dal modulo: fai la ricevuta con quelli');
select atteso('Gino: i centesimi si dicono',
  rifiuto($$select registra_pagamento_diretto(pag('aaaaaaaa-0000-0000-0000-000000000007', 703, 'Carta'))$$),
  '22023 Con la carta sono già arrivati 30,50 € dal modulo: fai la ricevuta con quelli');
select atteso('Sara, in contanti sì', (registra_pagamento_diretto(pag('aaaaaaaa-0000-0000-0000-000000000006', 704, 'Contanti')))->>'importo', '704');
select atteso('Sara, Satispay a mano sì: i suoi soldi liberi sono della carta, non di Satispay',
  (registra_pagamento_diretto(pag('aaaaaaaa-0000-0000-0000-000000000006', 705, 'Satispay')))->>'importo', '705');
select atteso('Rita, la sua carta è già nella ricevuta: «Carta» a mano sì',
  (registra_pagamento_diretto(pag('aaaaaaaa-0000-0000-0000-000000000009', 706, 'Carta')))->>'importo', '706');
select atteso('Ugo, solo in attesa e non andati: «Carta» a mano sì',
  (registra_pagamento_diretto(pag('aaaaaaaa-0000-0000-0000-000000000008', 707, 'Carta')))->>'importo', '707');
select atteso('Paolo, la sua carta è nella ricevuta della sezione 7: «Carta» a mano sì',
  (registra_pagamento_diretto(pag('aaaaaaaa-0000-0000-0000-000000000005', 708, 'Carta')))->>'importo', '708');
reset role;
select atteso('i rifiutati non hanno scritto niente',
  (select count(*)::text from pagamenti_diretti where importo in (701, 702, 30000, 703)), '0');
