-- Le ricevute: le fa e le annulla solo la segreteria, il numero va avanti da
-- sé e riparte ogni anno, i conti li fa il server, e una ricevuta fatta non
-- si cambia e non si cancella.
-- Si lancia dopo finto-supabase.sql e i file dello schema, fino a 16-ricevute.sql.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'maura@ods.it');
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Maura', 'Uno', 'istruttore', 'maura@ods.it', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Manuela', 'Albertini', 'iscritto', null, null);

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
-- Una ricevuta come quella del programma di prima: quota e annuale, pagate col bonifico.
create or replace function ricevuta(giorno text, numero int default null, pagato int default 36800) returns jsonb language sql as $$
  select jsonb_build_object(
    'data', giorno, 'numero', numero, 'persona_id', 'aaaaaaaa-0000-0000-0000-000000000003',
    'ente', jsonb_build_object('nome', 'Asd Il Centro Judo'),
    'intestatario', jsonb_build_object('nome', 'Manuela', 'cognome', 'Albertini', 'codiceFiscale', 'LBRMNL14H53L219X'),
    'voci', jsonb_build_array(
      jsonb_build_object('descrizione', 'QUOTA ASSOCIATIVA', 'quantita', 1, 'prezzo', 5000, 'dal', '2026-09-01', 'al', '2027-07-31',
        'pagamenti', jsonb_build_array(jsonb_build_object('data', giorno, 'importo', 5000, 'metodo', 'Bonifico'))),
      jsonb_build_object('descrizione', 'Annuale Lotta 3', 'quantita', 1, 'prezzo', 36800, 'dal', '2026-09-01', 'al', '2027-06-30',
        'pagamenti', jsonb_build_array(jsonb_build_object('data', giorno, 'importo', pagato, 'metodo', 'Bonifico')))),
    'anticipo', 0)
$$;
-- L'anticipo: i soldi dati prima, fuori dalle voci. Gli stessi casi di «con un anticipo» in scripts/prova-ricevuta.mjs.
create or replace function ricevuta_anticipo(numero int, quota_pagata int, annuale int, annuale_pagato int, anticipo int) returns jsonb language sql as $$
  select ricevuta('2026-09-10', numero) || jsonb_build_object('anticipo', anticipo, 'voci', jsonb_build_array(
    jsonb_build_object('descrizione', 'QUOTA ASSOCIATIVA', 'quantita', 1, 'prezzo', 5000, 'dal', '2026-09-01', 'al', '2027-07-31',
      'pagamenti', jsonb_build_array(jsonb_build_object('data', '2026-09-10', 'importo', quota_pagata, 'metodo', 'Bonifico'))),
    jsonb_build_object('descrizione', 'Annuale Lotta 3 · sconto famiglia 20% su 368,00 €', 'quantita', 1, 'prezzo', annuale, 'dal', '2026-09-01', 'al', '2027-06-30',
      'pagamenti', jsonb_build_array(jsonb_build_object('data', '2026-09-10', 'importo', annuale_pagato, 'metodo', 'Bonifico')))))
$$;
grant execute on function tenta(text), atteso(text, text, text), chi(text), ricevuta(text, int, int), ricevuta_anticipo(int, int, int, int, int) to anon, authenticated;

\echo ''
\echo '--- 1. la segreteria ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la prima di un programma che ne aveva già 115', (select (emetti_ricevuta(ricevuta('2026-09-01', 116)))->>'numero'), '116');
select atteso('la seguente va avanti da sé', (select (emetti_ricevuta(ricevuta('2026-09-02')))->>'numero'), '117');
select atteso('un numero già preso no', tenta($$select emetti_ricevuta(ricevuta('2026-09-03', 116))::text$$), 'NEGATO: La ricevuta numero 116 del 2026 c’è già…');
select atteso('a gennaio si riparte da 1', (select (emetti_ricevuta(ricevuta('2027-01-10')))->>'numero'), '1');
select atteso('il totale lo conta il server', (select totale || '/' || pagato from ricevute where numero = 116), '41800/41800');
select atteso('pagata in parte', (select (emetti_ricevuta(ricevuta('2026-09-04', null, 18000)))->>'pagato'), '23000');
select atteso('chi l''ha fatta, lo scrive il server', (select p.nome from ricevute r join persone p on p.id = r.creata_da where r.numero = 116), 'Anna');
select atteso('pagato più del totale no', tenta($$select emetti_ricevuta(ricevuta('2026-09-05', null, 99999))::text$$), 'NEGATO: Si è pagato più del totale…');
select atteso('senza voci no', tenta($$select emetti_ricevuta(ricevuta('2026-09-05') || '{"voci": []}')::text$$), 'NEGATO: Serve almeno una voce');
select atteso('senza il nome del socio no',
  tenta($$select emetti_ricevuta(ricevuta('2026-09-05') || '{"intestatario": {"cognome": "Albertini"}}')::text$$), 'NEGATO: Servono nome e cognome del socio');
select atteso('un prezzo sotto zero no',
  tenta($$select emetti_ricevuta(ricevuta('2026-09-05') || '{"voci": [{"descrizione": "Sconto", "prezzo": -100}]}')::text$$), 'NEGATO: Il prezzo di «Sconto» non va');
select atteso('le date al contrario no',
  tenta($$select emetti_ricevuta(ricevuta('2026-09-05') || '{"voci": [{"descrizione": "Trimestre", "prezzo": 100, "dal": "2026-12-01", "al": "2026-10-01"}]}')::text$$), 'NEGATO: Le date di «Trimestre» sono al contrario');
select atteso('i campi in più delle voci si buttano',
  (select emetti_ricevuta(ricevuta('2026-09-06') || '{"voci": [{"descrizione": "Stage", "prezzo": 2000, "chissà": 1}]}')->'voci'->0 ? 'chissà')::text, 'false');
select atteso('non la cambia a mano', tenta($$update ricevute set totale = 0$$), 'NEGATO: …');
select atteso('non la cancella', tenta($$delete from ricevute$$), 'NEGATO: …');
select atteso('non la scrive a mano',
  tenta($$insert into ricevute (anno, numero, data, ente, intestatario, voci, totale, pagato) values (2026, 500, '2026-09-01', '{}', '{}', '[{}]', 0, 0)$$), 'NEGATO: …');
select atteso('la annulla', tenta($$select annulla_ricevuta((select id from ricevute where numero = 117))::text$$), '');
select atteso('annullata resta, col suo numero', (select count(*)::text from ricevute where numero = 117 and annullata_il is not null), '1');
select atteso('due volte no', tenta($$select annulla_ricevuta((select id from ricevute where numero = 117))::text$$), 'NEGATO: ricevuta inesistente o già annullata');
select atteso('il numero dell''annullata non si riusa', (select (emetti_ricevuta(ricevuta('2026-09-07')))->>'numero'), '120');
select atteso('una ricevuta annullata non lascia quote da pagare', (select count(*)::text from quote_ricevute where anno = 2026 and numero = 117), '0');
select atteso('la stessa persona, ricevuta non annullata: la sua quota c''è', (select count(*)::text || '/' || min(mancano) from quote_ricevute where anno = 2026 and numero = 116 and persona_id = 'aaaaaaaa-0000-0000-0000-000000000003'), '1/0');
select emetti_ricevuta(ricevuta_anticipo(301, 0, 29440, 29440, 2000));
select emetti_ricevuta(ricevuta_anticipo(302, 0, 29440, 29440, 5000));
select emetti_ricevuta(ricevuta_anticipo(303, 0, 29440, 0, 34440));
select emetti_ricevuta(ricevuta_anticipo(304, 2000, 29440, 0, 10000));
select atteso('con un anticipo: totale, pagato e anticipo', (select totale || '/' || pagato || '/' || anticipo from ricevute where numero = 301), '34440/29440/2000');
select atteso('anticipo parziale: la quota manca di quel che resta', (select mancano::text from quote_ricevute where numero = 301), '3000');
select atteso('l''anticipo che copre la quota: non manca niente', (select mancano::text from quote_ricevute where numero = 302), '0');
select atteso('anticipo pari al totale: non manca niente', (select mancano::text from quote_ricevute where numero = 303), '0');
select atteso('anticipo e quota pagata in parte: manca la quota, non di più', (select mancano::text from quote_ricevute where numero = 304), '3000');
select atteso('un anticipo oltre il totale no', tenta($$select emetti_ricevuta(ricevuta_anticipo(305, 0, 29440, 29440, 5001))::text$$), 'NEGATO: Si è pagato più del totale…');
select atteso('i dati dell''associazione', tenta($$update impostazioni set ricevute = '{"nome": "Asd Il Centro Judo", "codiceFiscale": "10002760014"}'$$), 'FATTO (1 righe)');
reset role;

\echo ''
\echo '--- 2. un istruttore: le ricevute non le vede e non le fa ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('non le vede', (select count(*)::text from ricevute), '0');
select atteso('non ne fa', tenta($$select emetti_ricevuta(ricevuta('2026-09-08'))::text$$), 'NEGATO: la ricevuta la fa la segreteria');
select atteso('non le annulla', tenta($$select annulla_ricevuta(gen_random_uuid())::text$$), 'NEGATO: la ricevuta la annulla la segreteria');
select atteso('non cambia i dati dell''associazione', tenta($$update impostazioni set ricevute = '{}'$$), 'a vuoto (0 righe)');
reset role;

\echo ''
\echo '--- 3. chi non ha fatto l''accesso ---'
select chi('');
set role anon;
select atteso('non le vede', tenta($$select count(*)::text from ricevute$$), 'NEGATO: …');
select atteso('non ne fa', tenta($$select emetti_ricevuta(ricevuta('2026-09-08'))::text$$), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 4. la persona si cancella, la ricevuta resta ---'
delete from persone where id = 'aaaaaaaa-0000-0000-0000-000000000003';
select atteso('resta col socio scritto dentro', (select intestatario->>'cognome' from ricevute where numero = 116), 'Albertini');
