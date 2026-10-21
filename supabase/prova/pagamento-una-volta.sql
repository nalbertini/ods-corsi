-- Il pagamento a mano non conta due volte gli stessi soldi (87-pagamento-una-volta.sql):
--   · con la chiave di una ricevuta valida della stessa persona (il modulo ripreso dopo «Lascia stare»)
--     `registra_pagamento_diretto` rifiuta: quei soldi sono già nella ricevuta;
--   · con metodo Satispay, se alla persona sono già arrivati soldi Satispay dal modulo che non stanno in
--     nessuna ricevuta valida, rifiuta: la ricevuta va fatta con quelli.
-- Annullata, di un'altra persona, senza chiave, o con un altro metodo: si registra come prima.
-- Si lancia dopo finto-supabase.sql e i file dello schema, fino a 87-pagamento-una-volta.sql.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'maura@ods.it'),
  ('66666666-6666-6666-6666-666666666666', 'ada@ods.it');
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Maura', 'Uno', 'istruttore', 'maura@ods.it', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000030', 'Ada', 'Conti', 'amministrazione', 'ada@ods.it', '66666666-6666-6666-6666-666666666666'),
  ('aaaaaaaa-0000-0000-0000-000000000010', 'Paolo', 'Bianchi', 'iscritto', null, null),
  ('aaaaaaaa-0000-0000-0000-000000000011', 'Sara', 'Verdi', 'iscritto', null, null),
  ('aaaaaaaa-0000-0000-0000-000000000012', 'Gino', 'Neri', 'iscritto', null, null),
  ('aaaaaaaa-0000-0000-0000-000000000013', 'Ugo', 'Gialli', 'iscritto', null, null);

-- Le ricevute, come le lascia `emetti_ricevuta` con la chiave del modulo.
--   120/2026 Paolo, valida (chiave …01) · 121/2026 Paolo, annullata (chiave …02) · 122/2026 Sara, valida (chiave …03)
insert into ricevute (id, anno, numero, data, persona_id, ente, intestatario, voci, totale, pagato, chiave, annullata_il) values
  ('dddddddd-0000-0000-0000-000000000120', 2026, 120, '2026-09-10', 'aaaaaaaa-0000-0000-0000-000000000010', '{}', '{"nome": "Paolo", "cognome": "Bianchi"}',
   '[{"descrizione": "Quota", "quantita": 1, "prezzo": 5000, "pagamenti": [{"data": "2026-09-10", "importo": 5000, "metodo": "Satispay"}]}]', 5000, 5000,
   'bbbbbbbb-0000-0000-0000-000000000001', null),
  ('dddddddd-0000-0000-0000-000000000121', 2026, 121, '2026-09-10', 'aaaaaaaa-0000-0000-0000-000000000010', '{}', '{"nome": "Paolo", "cognome": "Bianchi"}',
   '[{"descrizione": "Quota", "quantita": 1, "prezzo": 1000, "pagamenti": [{"data": "2026-09-10", "importo": 1000, "metodo": "Satispay"}]}]', 1000, 1000,
   'bbbbbbbb-0000-0000-0000-000000000002', now()),
  ('dddddddd-0000-0000-0000-000000000122', 2026, 122, '2026-09-10', 'aaaaaaaa-0000-0000-0000-000000000011', '{}', '{"nome": "Sara", "cognome": "Verdi"}',
   '[{"descrizione": "Quota", "quantita": 1, "prezzo": 4000, "pagamenti": [{"data": "2026-09-10", "importo": 4000, "metodo": "Satispay"}]}]', 4000, 4000,
   'bbbbbbbb-0000-0000-0000-000000000003', null);

-- I Satispay del modulo, come li lasciano satispay_esito e accogli_iscrizione.
--   Paolo: 300 € liberi, 10 € in una ricevuta annullata (liberi anche quelli), 50 € nella 120 (non liberi),
--          più uno in attesa e uno non andato (soldi mai arrivati). Liberi in tutto: 310 €.
--   Gino: 30,50 € liberi. Sara: tutto nella 122. Ugo: solo in attesa e non andati.
--   E uno pagato senza persona (la richiesta non è ancora accolta).
insert into pagamenti_satispay (chi, importo, stato, persona_id, ricevuta_id) values
  ('Bianchi Paolo', 30000, 'pagato', 'aaaaaaaa-0000-0000-0000-000000000010', null),
  ('Bianchi Paolo', 1000, 'pagato', 'aaaaaaaa-0000-0000-0000-000000000010', 'dddddddd-0000-0000-0000-000000000121'),
  ('Bianchi Paolo', 5000, 'pagato', 'aaaaaaaa-0000-0000-0000-000000000010', 'dddddddd-0000-0000-0000-000000000120'),
  ('Bianchi Paolo', 9900, 'attesa', 'aaaaaaaa-0000-0000-0000-000000000010', null),
  ('Bianchi Paolo', 9900, 'non-andato', 'aaaaaaaa-0000-0000-0000-000000000010', null),
  ('Neri Gino', 3050, 'pagato', 'aaaaaaaa-0000-0000-0000-000000000012', null),
  ('Verdi Sara', 4000, 'pagato', 'aaaaaaaa-0000-0000-0000-000000000011', 'dddddddd-0000-0000-0000-000000000122'),
  ('Gialli Ugo', 7000, 'attesa', 'aaaaaaaa-0000-0000-0000-000000000013', null),
  ('Gialli Ugo', 7000, 'non-andato', 'aaaaaaaa-0000-0000-0000-000000000013', null),
  ('Senza Scheda', 8000, 'pagato', null, null);

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
-- Un pagamento a mano buono di Paolo, più quel che cambia il caso. Ogni caso ha il suo importo, per contarlo.
create or replace function pag(extra jsonb default '{}') returns jsonb language sql as $$
  select '{"persona_id": "aaaaaaaa-0000-0000-0000-000000000010", "data": "2026-09-10", "importo": 5000, "metodo": "Contanti", "voce": "Quota associativa"}'::jsonb || extra
$$;
-- Quante righe ha scritto un importo: la segreteria non legge tutto quel che legge il superutente, e non serve.
create or replace function scritti(quanto int) returns text language sql security definer set search_path = public as $$
  select count(*)::text from pagamenti_diretti where importo = quanto
$$;
grant execute on function rifiuto(text), atteso(text, text, text), chi(text), pag(jsonb), scritti(int) to anon, authenticated;

\echo ''
\echo '--- 1. la chiave di una ricevuta valida della stessa persona: già pagato ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('con la chiave della 120 di Paolo no',
  rifiuto($$select registra_pagamento_diretto(pag('{"importo": 101, "chiave": "bbbbbbbb-0000-0000-0000-000000000001"}'))$$),
  '22023 Questo pagamento è già nella ricevuta n. 120/2026: non va registrato di nuovo');
select atteso('anche con la carta no',
  rifiuto($$select registra_pagamento_diretto(pag('{"importo": 102, "metodo": "Carta", "chiave": "bbbbbbbb-0000-0000-0000-000000000001"}'))$$),
  '22023 Questo pagamento è già nella ricevuta n. 120/2026: non va registrato di nuovo');
select atteso('la chiave con gli spazi è la stessa',
  rifiuto($$select registra_pagamento_diretto(pag('{"importo": 103, "chiave": " bbbbbbbb-0000-0000-0000-000000000001 "}'))$$),
  '22023 Questo pagamento è già nella ricevuta n. 120/2026: non va registrato di nuovo');
select atteso('e non ha scritto niente', scritti(101)::int + scritti(102)::int + scritti(103)::int || '', '0');

\echo ''
\echo '--- 2. annullata, sconosciuta o senza chiave: come prima ---'
select atteso('con la chiave della 121 annullata sì',
  (registra_pagamento_diretto(pag('{"importo": 201, "chiave": "bbbbbbbb-0000-0000-0000-000000000002"}')))->>'importo', '201');
select atteso('con una chiave che nessuna ricevuta ha sì',
  (registra_pagamento_diretto(pag('{"importo": 202, "chiave": "bbbbbbbb-0000-0000-0000-000000000099"}')))->>'importo', '202');
select atteso('senza chiave sì', (registra_pagamento_diretto(pag('{"importo": 203}')))->>'importo', '203');
select atteso('con la chiave vuota sì', (registra_pagamento_diretto(pag('{"importo": 204, "chiave": ""}')))->>'importo', '204');

\echo ''
\echo '--- 3. la chiave di una ricevuta di un''altra persona: non è sua ---'
select atteso('Paolo con la chiave della 122 di Sara sì',
  (registra_pagamento_diretto(pag('{"importo": 301, "chiave": "bbbbbbbb-0000-0000-0000-000000000003"}')))->>'importo', '301');

\echo ''
\echo '--- 4. una chiave che non è un uuid ---'
select atteso('una chiave rotta no',
  rifiuto($$select registra_pagamento_diretto(pag('{"importo": 401, "chiave": "non-una-chiave"}'))$$),
  '22023 La ricevuta non si capisce: ricarica la pagina');
select atteso('e non ha scritto niente', scritti(401), '0');

\echo ''
\echo '--- 5. Satispay a mano con soldi Satispay del modulo ancora liberi ---'
select atteso('Paolo, Satispay a mano no: 300 liberi più 10 di un''annullata',
  rifiuto($$select registra_pagamento_diretto(pag('{"importo": 501, "metodo": "Satispay"}'))$$),
  '22023 Con Satispay sono già arrivati 310 € dal modulo: fai la ricevuta con quelli');
select atteso('« satispay » minuscolo e con gli spazi, uguale',
  rifiuto($$select registra_pagamento_diretto(pag('{"importo": 502, "metodo": " satispay "}'))$$),
  '22023 Con Satispay sono già arrivati 310 € dal modulo: fai la ricevuta con quelli');
select atteso('qualunque importo: anche quanto è arrivato',
  rifiuto($$select registra_pagamento_diretto(pag('{"importo": 31000, "metodo": "Satispay"}'))$$),
  '22023 Con Satispay sono già arrivati 310 € dal modulo: fai la ricevuta con quelli');
select atteso('Gino: i centesimi si dicono',
  rifiuto($$select registra_pagamento_diretto(pag('{"persona_id": "aaaaaaaa-0000-0000-0000-000000000012", "importo": 503, "metodo": "Satispay"}'))$$),
  '22023 Con Satispay sono già arrivati 30,50 € dal modulo: fai la ricevuta con quelli');
select atteso('e non ha scritto niente', scritti(501)::int + scritti(502)::int + scritti(31000)::int + scritti(503)::int || '', '0');

\echo ''
\echo '--- 6. Satispay a mano quando i soldi del modulo non sono liberi, o un altro metodo ---'
select atteso('Paolo, in contanti sì', (registra_pagamento_diretto(pag('{"importo": 601}')))->>'importo', '601');
select atteso('Paolo, con la carta sì', (registra_pagamento_diretto(pag('{"importo": 602, "metodo": "Carta"}')))->>'importo', '602');
select atteso('Sara, il suo Satispay è già nella 122: Satispay a mano sì',
  (registra_pagamento_diretto(pag('{"persona_id": "aaaaaaaa-0000-0000-0000-000000000011", "importo": 603, "metodo": "Satispay"}')))->>'importo', '603');
select atteso('Ugo, solo in attesa e non andati, e il Satispay di Paolo o senza persona non è suo: sì',
  (registra_pagamento_diretto(pag('{"persona_id": "aaaaaaaa-0000-0000-0000-000000000013", "importo": 604, "metodo": "Satispay"}')))->>'importo', '604');
reset role;

\echo ''
\echo '--- 7. i ruoli ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('istruttore con la chiave della 120: prima il ruolo',
  left(rifiuto($$select registra_pagamento_diretto(pag('{"importo": 701, "chiave": "bbbbbbbb-0000-0000-0000-000000000001"}'))$$), 5), '42501');
select atteso('istruttore con la chiave rotta: prima il ruolo',
  left(rifiuto($$select registra_pagamento_diretto(pag('{"importo": 702, "chiave": "non-una-chiave"}'))$$), 5), '42501');
select atteso('istruttore con Satispay: prima il ruolo',
  left(rifiuto($$select registra_pagamento_diretto(pag('{"importo": 703, "metodo": "Satispay"}'))$$), 5), '42501');
reset role;
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('amministrazione con la chiave della 120 no',
  rifiuto($$select registra_pagamento_diretto(pag('{"importo": 704, "chiave": "bbbbbbbb-0000-0000-0000-000000000001"}'))$$),
  '22023 Questo pagamento è già nella ricevuta n. 120/2026: non va registrato di nuovo');
select atteso('amministrazione con Satispay per Paolo no',
  rifiuto($$select registra_pagamento_diretto(pag('{"importo": 705, "metodo": "Satispay"}'))$$),
  '22023 Con Satispay sono già arrivati 310 € dal modulo: fai la ricevuta con quelli');
select atteso('amministrazione con la chiave dell''annullata sì',
  (registra_pagamento_diretto(pag('{"importo": 706, "chiave": "bbbbbbbb-0000-0000-0000-000000000002"}')))->>'importo', '706');
reset role;
select atteso('i rifiuti dei ruoli non hanno scritto niente', (select count(*)::text from pagamenti_diretti where importo between 701 and 705), '0');
select atteso('il Satispay del modulo non è cambiato', (select string_agg(coalesce(ricevuta_id::text, 'libero'), ',' order by importo) from pagamenti_satispay where stato = 'pagato'),
  'dddddddd-0000-0000-0000-000000000121,libero,dddddddd-0000-0000-0000-000000000122,dddddddd-0000-0000-0000-000000000120,libero,libero');

\echo ''
\echo 'TUTTO A POSTO'
