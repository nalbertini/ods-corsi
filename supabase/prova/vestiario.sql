-- Gli ordini di vestiario: il catalogo e la data di chiusura li tiene la
-- segreteria; chi non ha un accesso legge il catalogo da `vestiario()` e
-- manda un ordine da `invia_ordine_vestiario()`, e da nient'altro. Gli ordini
-- li vede e li cambia solo la segreteria (e il ruolo doppio).
-- Gli stessi casi, con gli stessi messaggi, di `scripts/prova-vestiario.mjs`.
-- Si lancia dopo finto-supabase.sql, i file dello schema e 47-vestiario.sql.
-- Le date sono contate da oggi: «chiude oggi» è aperto, «chiude ieri» no.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'maura@ods.it'),
  ('33333333-3333-3333-3333-333333333333', 'luca@ods.it'),
  ('66666666-6666-6666-6666-666666666666', 'lotta@ods.it'),
  ('77777777-7777-7777-7777-777777777777', 'doppio@ods.it');
insert into persone (id, nome, cognome, ruolo, anche_istruttore, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', false, '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Maura', 'Uno', 'istruttore', false, '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Luca', 'Rossi', 'iscritto', false, '33333333-3333-3333-3333-333333333333'),
  ('aaaaaaaa-0000-0000-0000-000000000006', 'Dora', 'Doppio', 'staff', true, '77777777-7777-7777-7777-777777777777');
insert into sale (id, nome) values ('bbbbbbbb-0000-0000-0000-000000000001', 'Lotta');
insert into postazioni (id, nome, sala_id, utente_id) values
  ('dddddddd-0000-0000-0000-000000000001', 'Tablet Lotta', 'bbbbbbbb-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666666');

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

-- Il catalogo della prova: Judogi (120, 130, 140) e Costumino (S, M).
create or replace function cat(chiude date, prezzo numeric default 35) returns jsonb language sql as $$
  select jsonb_build_object('chiude', chiude, 'capi', jsonb_build_array(
    jsonb_build_object('capo', 'Judogi', 'taglie', jsonb_build_array('120', '130', '140'), 'prezzo', prezzo, 'nota', 'Altezza + 10 cm. I campioni sono in segreteria.'),
    jsonb_build_object('capo', 'Costumino', 'taglie', jsonb_build_array('S', 'M'), 'prezzo', 30)))
$$;
create or replace function riga(per_chi text, capo text, taglia text, quanti int default 1) returns jsonb language sql as $$
  select jsonb_build_object('per_chi', per_chi, 'capo', capo, 'taglia', taglia, 'quanti', quanti)
$$;
-- Ogni ordine ha un telefono suo, se non lo dice: il limite di tre ordini
-- all'ora per telefono ha la sua prova (3b) e non deve fermare le altre.
create sequence telefoni;
create or replace function ordine(righe jsonb, altro jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object('nome', 'Paola', 'cognome', 'Rossi', 'telefono', '340 ' || lpad(nextval('telefoni')::text, 7, '0'), 'righe', righe) || altro
$$;
-- Un id tenuto da un caso all'altro (le variabili di psql non entrano nei $$).
create or replace function tieni(n text, v text) returns text language sql as $$ select set_config('prova.' || n, coalesce(v, ''), false) $$;
create or replace function preso(n text) returns uuid language sql as $$ select nullif(current_setting('prova.' || n, true), '')::uuid $$;
grant execute on function tenta(text), atteso(text, text, text), chi(text), cat(date, numeric), riga(text, text, text, int),
  ordine(jsonb, jsonb), tieni(text, text), preso(text) to anon, authenticated;
grant usage on sequence telefoni to anon, authenticated;

\echo ''
\echo '--- 0. prima di ogni catalogo ---'
select chi('');
set role anon;
select atteso('la pagina è chiusa', coalesce(vestiario()->>'aperti', 'false'), 'false');
select atteso('e un ordine non entra', tenta($$select invia_ordine_vestiario(ordine(jsonb_build_array(riga('Luca Rossi', 'Judogi', '130'))))::text$$), 'NEGATO: Gli ordini sono chiusi…');
reset role;
-- Il catalogo salvato senza data: c'è il catalogo, non una raccolta.
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('senza data si salva il catalogo e nessuna raccolta', tenta($$select coalesce(salva_vestiario(cat(null))::text, 'nessuna raccolta')$$), 'nessuna raccolta');
select atteso('le raccolte restano zero', (select count(*)::text from raccolte_vestiario), '0');
select atteso('il banco senza raccolta rifiuta, e dice cosa fare',
  tenta($$select scrivi_ordine_vestiario(ordine(jsonb_build_array(riga('Luca Rossi', 'Judogi', '130'))), null::text)::text$$),
  'NEGATO: Non c''è ancora una raccolta: salva prima il catalogo con la data di chiusura');
reset role;
select chi('');
set role anon;
select atteso('la pagina vede il catalogo', vestiario()->'capi'->0->>'capo', 'Judogi');
select atteso('ma è chiusa', coalesce(vestiario()->>'aperti', 'false'), 'false');
select atteso('e l''ordine non entra', tenta($$select invia_ordine_vestiario(ordine(jsonb_build_array(riga('Luca Rossi', 'Judogi', '130'))))::text$$), 'NEGATO: Gli ordini sono chiusi…');
reset role;

\echo ''
\echo '--- 1. il catalogo: lo salva la segreteria, lo legge la pagina pubblica ---'
select chi('');
set role anon;
select atteso('anon non lo salva', tenta($$select salva_vestiario(cat(current_date + 7))::text$$), 'NEGATO: …');
reset role;
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('un istruttore non lo salva', tenta($$select salva_vestiario(cat(current_date + 7))::text$$), 'NEGATO: …');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria sì, e ha una raccolta', tenta($$select (salva_vestiario(jsonb_set(cat(current_date + 7), '{capi,1,taglie}', '["S", " S", "M", "S"]')) is not null)::text$$), 'true');
select atteso('due capi con lo stesso nome no (due prezzi sono due capi)',
  tenta($$select salva_vestiario(jsonb_set(cat(current_date + 7), '{capi,1,capo}', '"Judogi"'))::text$$), 'NEGATO: …Judogi…');
select atteso('«Judogi» e «judogi» sono lo stesso capo',
  tenta($$select salva_vestiario(jsonb_set(cat(current_date + 7), '{capi,1,capo}', '"judogi"'))::text$$), 'NEGATO: «judogi» c''è due volte: due prezzi sono due capi, con due nomi diversi');
select atteso('un capo senza prezzo no', tenta($$select salva_vestiario(cat(current_date + 7, 0))::text$$), 'NEGATO: …prezzo…');
select atteso('51 capi no', tenta($$select salva_vestiario(jsonb_build_object('chiude', current_date + 7, 'capi',
  (select jsonb_agg(jsonb_build_object('capo', 'Capo ' || n, 'taglie', jsonb_build_array('S'), 'prezzo', 10)) from generate_series(1, 51) n)))::text$$),
  'NEGATO: Il catalogo ha al massimo 50 capi');
select atteso('31 taglie no', tenta($$select salva_vestiario(jsonb_set(cat(current_date + 7), '{capi,0,taglie}', (select jsonb_agg(n::text) from generate_series(1, 31) n)))::text$$),
  'NEGATO: Le taglie del capo «Judogi» sono troppe o troppo lunghe');
select atteso('una taglia di 21 caratteri no', tenta(format($$select salva_vestiario(jsonb_set(cat(current_date + 7), '{capi,0,taglie}', jsonb_build_array(%L)))::text$$, repeat('x', 21))),
  'NEGATO: Le taglie del capo «Judogi» sono troppe o troppo lunghe');
select atteso('un nome di capo di 81 lettere no', tenta(format($$select salva_vestiario(jsonb_set(cat(current_date + 7), '{capi,0,capo}', to_jsonb(%L::text)))::text$$, repeat('J', 81))),
  'NEGATO: Il nome del capo «' || repeat('J', 80) || '» è troppo lungo');
select atteso('un prezzo oltre 9999 no', tenta($$select salva_vestiario(cat(current_date + 7, 10000))::text$$), 'NEGATO: «Judogi» non ha un prezzo');
select atteso('un prezzo coi millesimi no', tenta($$select salva_vestiario(cat(current_date + 7, 35.125))::text$$), 'NEGATO: «Judogi» non ha un prezzo');
select atteso('una data che non c''è no', tenta($$select salva_vestiario(jsonb_set(cat(current_date + 7), '{chiude}', '"2026-02-30"'))::text$$), 'NEGATO: La data di chiusura non sembra una data');
select atteso('un capo senza taglie no', tenta($$select salva_vestiario(jsonb_set(cat(current_date + 7), '{capi,0,taglie}', '[]'))::text$$), 'NEGATO: …taglie…');
reset role;
select chi('');
set role anon;
select atteso('la pagina vede il capo', vestiario()->'capi'->0->>'capo', 'Judogi');
select atteso('il costumino con le taglie doppie tolte', vestiario()->'capi'->1->>'taglie', '["S", "M"]');
select atteso('le taglie', vestiario()->'capi'->0->>'taglie', '["120", "130", "140"]');
select atteso('il prezzo, quello di prima dei rifiuti', vestiario()->'capi'->0->>'prezzo', '35');
select atteso('la nota', vestiario()->'capi'->0->>'nota', 'Altezza + 10 cm. I campioni sono in segreteria.');
select atteso('la data di chiusura', vestiario()->>'chiude', (current_date + 7)::text);
select atteso('ed è aperta', vestiario()->>'aperti', 'true');
select atteso('le raccolte non le legge', tenta($$select count(*)::text from raccolte_vestiario$$), 'NEGATO: …');
select atteso('le impostazioni nemmeno', tenta($$select count(*)::text from impostazioni$$), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 2. aperti fino alla data di chiusura compresa ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select salva_vestiario(cat(current_date)) is not null;
reset role;
select chi('');
set role anon;
select atteso('chiude oggi: aperti', vestiario()->>'aperti', 'true');
select atteso('e l''ordine entra', tenta($$select (invia_ordine_vestiario(ordine(jsonb_build_array(riga('Luca Rossi', 'Judogi', '130'))))->>'id' is not null)::text$$), 'true');
reset role;
-- Proroga il giorno stesso della chiusura: la raccolta è ancora aperta, resta quella.
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select tieni('oggi', (select id::text from raccolte_vestiario where chiude = current_date));
select tieni('quante', (select count(*)::text from raccolte_vestiario));
select salva_vestiario(cat(current_date + 7));
select atteso('chiude oggi, prorogata di una settimana: le raccolte sono quelle', (select count(*)::text from raccolte_vestiario), current_setting('prova.quante'));
select atteso('e la sua data è fra una settimana', (select chiude::text from raccolte_vestiario where id = preso('oggi')), (current_date + 7)::text);
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select salva_vestiario(cat(current_date - 1)) is not null;
reset role;
select chi('');
set role anon;
select atteso('chiude ieri: chiusi', vestiario()->>'aperti', 'false');
select atteso('e l''ordine chiamato da sé è rifiutato', tenta($$select invia_ordine_vestiario(ordine(jsonb_build_array(riga('Luca Rossi', 'Judogi', '130'))))::text$$), 'NEGATO: Gli ordini sono chiusi…');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select tieni('raccolte2', (select count(*)::text from raccolte_vestiario));
select tieni('ieri', (select id::text from raccolte_vestiario where chiude = current_date - 1));
select salva_vestiario(cat(null));
select atteso('senza data: nessuna raccolta nuova', (select count(*)::text from raccolte_vestiario), current_setting('prova.raccolte2'));
select atteso('e quella di adesso tiene la sua data', (select chiude::text from raccolte_vestiario where id = preso('ieri')), (current_date - 1)::text);
reset role;
select chi('');
set role anon;
select atteso('ancora chiusi', vestiario()->>'aperti', 'false');
select atteso('e rifiutato', tenta($$select invia_ordine_vestiario(ordine(jsonb_build_array(riga('Luca Rossi', 'Judogi', '130'))))::text$$), 'NEGATO: Gli ordini sono chiusi…');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select salva_vestiario(jsonb_build_object('chiude', current_date + 7, 'capi', '[]'::jsonb)) is not null;
reset role;
select chi('');
set role anon;
select atteso('senza capi: chiusi', vestiario()->>'aperti', 'false');
select atteso('e rifiutato', tenta($$select invia_ordine_vestiario(ordine(jsonb_build_array(riga('Luca Rossi', 'Judogi', '130'))))::text$$), 'NEGATO: Gli ordini sono chiusi…');
reset role;

\echo ''
\echo '--- 3. cosa non entra in un ordine ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select salva_vestiario(cat(current_date + 7)) is not null;
select tieni('prima', (select count(*)::text from ordini_vestiario));
reset role;
select chi('');
set role anon;
select atteso('un capo fuori catalogo, e dice quale', tenta($$select invia_ordine_vestiario(ordine(jsonb_build_array(riga('Luca Rossi', 'Judogi rosa', '130'))))::text$$), 'NEGATO: …Judogi rosa…');
select atteso('una taglia fuori catalogo, e dice quale', tenta($$select invia_ordine_vestiario(ordine(jsonb_build_array(riga('Luca Rossi', 'Judogi', '200'))))::text$$), 'NEGATO: …taglia 200…');
select atteso('zero righe', tenta($$select invia_ordine_vestiario(ordine('[]'))::text$$), 'NEGATO: …almeno un capo…');
select atteso('righe che non sono un elenco', tenta($$select invia_ordine_vestiario(ordine('"tre judogi"'))::text$$), 'NEGATO: …almeno un capo…');
select atteso('quantità 0', tenta($$select invia_ordine_vestiario(ordine(jsonb_build_array(riga('Luca Rossi', 'Judogi', '130', 0))))::text$$), 'NEGATO: …quantità…');
select atteso('quantità 11, oltre il limite di 10', tenta($$select invia_ordine_vestiario(ordine(jsonb_build_array(riga('Luca Rossi', 'Judogi', '130', 11))))::text$$), 'NEGATO: …quantità…');
select atteso('senza telefono', tenta($$select invia_ordine_vestiario(ordine(jsonb_build_array(riga('Luca Rossi', 'Judogi', '130')), '{"telefono": ""}'))::text$$), 'NEGATO: …telefono…');
select atteso('un telefono di tre cifre', tenta($$select invia_ordine_vestiario(ordine(jsonb_build_array(riga('Luca Rossi', 'Judogi', '130')), '{"telefono": "123"}'))::text$$), 'NEGATO: …telefono…');
select atteso('un''email sbagliata', tenta($$select invia_ordine_vestiario(ordine(jsonb_build_array(riga('Luca Rossi', 'Judogi', '130')), '{"email": "paola"}'))::text$$), 'NEGATO: …email…');
select atteso('senza il cognome di chi ordina', tenta($$select invia_ordine_vestiario(ordine(jsonb_build_array(riga('Luca Rossi', 'Judogi', '130')), '{"cognome": " "}'))::text$$), 'NEGATO: …cognome…');
select atteso('una riga senza per chi', tenta($$select invia_ordine_vestiario(ordine(jsonb_build_array(riga(' ', 'Judogi', '130'))))::text$$), 'NEGATO: …per chi…');
select atteso('21 righe no', tenta($$select invia_ordine_vestiario(ordine((select jsonb_agg(riga('Luca Rossi', 'Judogi', '130')) from generate_series(1, 21))))::text$$),
  'NEGATO: Un ordine ha al massimo 20 righe: dividilo in due');
select atteso('un nome di 81 lettere no', tenta(format($$select invia_ordine_vestiario(ordine(jsonb_build_array(riga('Luca Rossi', 'Judogi', '130')), jsonb_build_object('nome', %L)))::text$$, repeat('a', 81))),
  'NEGATO: Un campo non va: nome e cognome sono troppo lunghi');
select atteso('un cognome di 81 lettere no', tenta(format($$select invia_ordine_vestiario(ordine(jsonb_build_array(riga('Luca Rossi', 'Judogi', '130')), jsonb_build_object('cognome', %L)))::text$$, repeat('a', 81))),
  'NEGATO: Un campo non va: nome e cognome sono troppo lunghi');
select atteso('per chi di 161 lettere no', tenta(format($$select invia_ordine_vestiario(ordine(jsonb_build_array(riga(%L, 'Judogi', '130'))))::text$$, repeat('a', 161))),
  'NEGATO: Un campo non va: «per chi» è troppo lungo');
select atteso('un telefono di 31 caratteri no', tenta(format($$select invia_ordine_vestiario(ordine(jsonb_build_array(riga('Luca Rossi', 'Judogi', '130')), jsonb_build_object('telefono', %L)))::text$$, '333' || repeat(' .', 12) || ' 123456')),
  'NEGATO: Il telefono non sembra giusto: servono da 6 a 15 cifre (spazi e + davanti vanno bene)');
select atteso('un''email di 161 caratteri no', tenta(format($$select invia_ordine_vestiario(ordine(jsonb_build_array(riga('Luca Rossi', 'Judogi', '130')), jsonb_build_object('email', %L)))::text$$, repeat('a', 150) || '@esempio.it')),
  'NEGATO: L''email non sembra giusta: scrivila come nome@esempio.it');
select tieni('spazi', invia_ordine_vestiario(ordine(jsonb_build_array(riga(' Luca Rossi ', ' Judogi ', '130')), '{"email": " Paola.Rossi@Esempio.IT "}'))->>'id');
select atteso('dieci sì', tenta($$select (invia_ordine_vestiario(ordine(jsonb_build_array(riga('Luca Rossi', 'Judogi', '130', 10))))->>'id' is not null)::text$$), 'true');
reset role;
-- Un catalogo cambiato a mano nelle impostazioni, con un prezzo storto: il
-- rifiuto dice cosa non va, non l'errore grezzo dei numeri.
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
update impostazioni set vestiario = jsonb_set(vestiario, '{0,prezzo}', '"trentacinque"') where id;
reset role;
select chi('');
set role anon;
select atteso('un prezzo scritto in lettere a mano', tenta($$select invia_ordine_vestiario(ordine(jsonb_build_array(riga('Luca Rossi', 'Judogi', '130'))))::text$$), 'NEGATO: …non ha un prezzo giusto…');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
update impostazioni set vestiario = jsonb_set(vestiario, '{0,prezzo}', '0.001') where id;
reset role;
select chi('');
set role anon;
select atteso('un prezzo di un millesimo a mano', tenta($$select invia_ordine_vestiario(ordine(jsonb_build_array(riga('Luca Rossi', 'Judogi', '130'))))::text$$), 'NEGATO: …non ha un prezzo giusto…');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
update impostazioni set vestiario = jsonb_set(vestiario, '{0,prezzo}', '"NaN"') where id;
reset role;
select chi('');
set role anon;
select atteso('un prezzo «NaN» a mano', tenta($$select invia_ordine_vestiario(ordine(jsonb_build_array(riga('Luca Rossi', 'Judogi', '130'))))::text$$), 'NEGATO: …non ha un prezzo giusto…');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
update impostazioni set vestiario = jsonb_set(vestiario, '{0,prezzo}', '1e6') where id;
reset role;
select chi('');
set role anon;
select atteso('un prezzo di un milione a mano', tenta($$select invia_ordine_vestiario(ordine(jsonb_build_array(riga('Luca Rossi', 'Judogi', '130'))))::text$$), 'NEGATO: …non ha un prezzo giusto…');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('dei rifiutati non è entrato niente', (select count(*) - current_setting('prova.prima')::int from ordini_vestiario)::text, '2');
select atteso('« Judogi » con gli spazi entra come Judogi', (select concat_ws(' · ', per_chi, capo) from righe_vestiario where ordine_id = preso('spazi')), 'Luca Rossi · Judogi');
select atteso('e l''email si salva in minuscolo', (select email::text from ordini_vestiario where id = preso('spazi')), 'paola.rossi@esempio.it');
select salva_vestiario(cat(current_date + 7)) is not null;
reset role;

\echo ''
\echo '--- 3b. tre ordini all''ora dallo stesso telefono ---'
select chi('');
set role anon;
select tieni('t1', invia_ordine_vestiario(ordine(jsonb_build_array(riga('Luca Rossi', 'Judogi', '130')), '{"telefono": "347 000 1111"}'))->>'id');
select atteso('il secondo', tenta($$select (invia_ordine_vestiario(ordine(jsonb_build_array(riga('Sara Rossi', 'Judogi', '120')), '{"telefono": "347 000 1111"}'))->>'id' is not null)::text$$), 'true');
select atteso('il terzo', tenta($$select (invia_ordine_vestiario(ordine(jsonb_build_array(riga('Sara Rossi', 'Costumino', 'S')), '{"telefono": "347 000 1111"}'))->>'id' is not null)::text$$), 'true');
select atteso('il quarto no', tenta($$select invia_ordine_vestiario(ordine(jsonb_build_array(riga('Luca Rossi', 'Costumino', 'M')), '{"telefono": "347 000 1111"}'))::text$$), 'NEGATO: …Da questo telefono…');
select atteso('nemmeno scritto in un altro modo: contano le cifre', tenta($$select invia_ordine_vestiario(ordine(jsonb_build_array(riga('Luca Rossi', 'Costumino', 'M')), '{"telefono": "347-0001111"}'))::text$$), 'NEGATO: …Da questo telefono…');
select atteso('nemmeno col +39 davanti', tenta($$select invia_ordine_vestiario(ordine(jsonb_build_array(riga('Luca Rossi', 'Costumino', 'M')), '{"telefono": "+39 347 0001111"}'))::text$$), 'NEGATO: …Da questo telefono…');
select atteso('nemmeno col 0039 davanti', tenta($$select invia_ordine_vestiario(ordine(jsonb_build_array(riga('Luca Rossi', 'Costumino', 'M')), '{"telefono": "0039 3470001111"}'))::text$$), 'NEGATO: …Da questo telefono…');
select atteso('un altro telefono passa ancora', tenta($$select (invia_ordine_vestiario(ordine(jsonb_build_array(riga('Luca Rossi', 'Costumino', 'M')), '{"telefono": "347 000 2222"}'))->>'id' is not null)::text$$), 'true');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
update ordini_vestiario set annullato = true where id = preso('t1');
reset role;
select chi('');
set role anon;
select atteso('annullato uno dei tre, il quarto passa', tenta($$select (invia_ordine_vestiario(ordine(jsonb_build_array(riga('Luca Rossi', 'Costumino', 'M')), '{"telefono": "347 000 1111"}'))->>'id' is not null)::text$$), 'true');
reset role;

-- Due chiamate insieme non devono passare il limite tutte e due: la funzione
-- si mette in fila con un lucchetto della transazione.
-- Una richiesta enorme si rifiuta prima di prendere il lucchetto: se no tiene ferme quelle vere (come invia_iscrizione, PR #328).
select chi('');
set role anon;
select atteso('un ordine troppo pesante (200 kB in un campo) no, detto per chi usa l''app',
  tenta(format($$select invia_ordine_vestiario(ordine(jsonb_build_array(riga('Luca Rossi', 'Judogi', '130')), jsonb_build_object('zavorra', %L)))::text$$, repeat('x', 200000))),
  'NEGATO: …troppo grande…');
reset role;
select atteso('la misura si controlla prima del lucchetto',
  (select (strpos(d, 'pg_column_size(dati)') > 0 and strpos(d, 'pg_column_size(dati)') < strpos(d, 'pg_advisory_xact_lock'))::text
   from (select pg_get_functiondef('invia_ordine_vestiario(jsonb)'::regprocedure) d) x), 'true');
select atteso('invia_ordine_vestiario si mette in fila', (pg_get_functiondef('invia_ordine_vestiario(jsonb)'::regprocedure) ~ 'pg_advisory_xact_lock')::text, 'true');

select atteso('un 39 che fa parte del numero resta', vestiario_cifre('393 123 4567'), '3931234567');

\echo ''
\echo '--- 3c. lo stesso ordine mandato due volte ---'
select tieni('doppio', gen_random_uuid()::text);
select chi('');
set role anon;
select tieni('primo', invia_ordine_vestiario(ordine(jsonb_build_array(riga('Luca Rossi', 'Judogi', '130', 2)), jsonb_build_object('id', preso('doppio'), 'telefono', '348 555 0001')))::text);
select atteso('il primo invio ha l''id del dispositivo', (current_setting('prova.primo')::jsonb->>'id'), current_setting('prova.doppio'));
select tieni('secondo', invia_ordine_vestiario(ordine(jsonb_build_array(riga('Luca Rossi', 'Judogi', '130', 2)), jsonb_build_object('id', preso('doppio'), 'telefono', '348 555 0001')))::text);
select atteso('il secondo risponde con lo stesso ordine', (select concat_ws(' · ', x->>'id', (x->>'totale')::float8) from (select current_setting('prova.secondo')::jsonb x) y),
  current_setting('prova.doppio') || ' · 70');
select tieni('terzo', invia_ordine_vestiario(ordine(jsonb_build_array(riga('Sara Rossi', 'Costumino', 'S')), jsonb_build_object('id', preso('doppio'), 'nome', 'Altro', 'telefono', '+39 348 5550001')))::text);
select atteso('con dati diversi, e lo stesso telefono col +39, risponde con quello già salvato', (select concat_ws(' · ', x->>'id', (x->>'totale')::float8) from (select current_setting('prova.terzo')::jsonb x) y),
  current_setting('prova.doppio') || ' · 70');
select atteso('con un altro telefono è rifiutato, senza le righe di quell''ordine',
  tenta($$select invia_ordine_vestiario(ordine(jsonb_build_array(riga('Sara Rossi', 'Costumino', 'S')), jsonb_build_object('id', preso('doppio'), 'telefono', '348 555 0002')))::text$$),
  'NEGATO: Quest''ordine non si può rimandare: ricarica la pagina e rifallo');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('un ordine solo', (select count(*)::text from ordini_vestiario where id = preso('doppio')), '1');
select atteso('e non è cambiato', (select concat_ws(' · ', nome, totale::float8, (select string_agg(concat_ws(' ', per_chi, capo, quanti), ', ') from righe_vestiario where ordine_id = preso('doppio'))) from ordini_vestiario where id = preso('doppio')),
  'Paola · 70 · Luca Rossi Judogi 2');
reset role;

\echo ''
\echo '--- 4. un ordine salvato ---'
select chi('');
set role anon;
select tieni('a', invia_ordine_vestiario(ordine(jsonb_build_array(riga('Luca Rossi', 'Judogi', '130')), '{"telefono": "333 123 4567", "codice_fiscale": "RSSPLA80A41L219X", "nato_il": "1980-01-01"}'))->>'id');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('chi ordina: nome, cognome, telefono, senza email',
  (select concat_ws(' · ', nome, cognome, telefono, coalesce(email::text, 'nessuna email')) from ordini_vestiario where id = preso('a')), 'Paola · Rossi · 333 123 4567 · nessuna email');
select atteso('la riga: per chi, capo, taglia, quantità, prezzo',
  (select string_agg(concat_ws(' · ', per_chi, capo, taglia, quanti, prezzo::float8), ' | ') from righe_vestiario where ordine_id = preso('a')), 'Luca Rossi · Judogi · 130 · 1 · 35');
select atteso('arriva da saldare e non annullato', (select concat_ws(' ', saldato::text, annullato::text) from ordini_vestiario where id = preso('a')), 'false false');
select atteso('niente pagato, dal link, con l''ora d''arrivo',
  (select concat_ws(' · ', pagato::float8, coalesce(pagato_con, '-'), coalesce(pagato_il::text, '-'), dal_banco::text, (creato_il > now() - interval '1 minute')::text) from ordini_vestiario where id = preso('a')), '0 · - · - · false · true');
select atteso('nessuna colonna per codice fiscale o data di nascita',
  (select count(*)::text from information_schema.columns where table_name in ('ordini_vestiario', 'righe_vestiario') and column_name ~ 'fiscale|nat'), '0');
reset role;

\echo ''
\echo '--- 5. il totale lo fa il catalogo ---'
select chi('');
set role anon;
select tieni('b', r->>'id') from (select invia_ordine_vestiario(ordine(jsonb_build_array(riga('Luca Rossi', 'Judogi', '130', 2) || '{"prezzo": 0.5}'), '{"totale": 1}')) r) x;
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('due judogi a 35 € con un totale finto di 1 €: 70 €', (select totale::float8::text from ordini_vestiario where id = preso('b')), '70');
select atteso('il prezzo nella riga è quello del catalogo', (select string_agg(prezzo::float8::text, ',') from righe_vestiario where ordine_id = preso('b')), '35');
select salva_vestiario(cat(current_date + 7, 40)) is not null;
select atteso('il catalogo passa a 40 €: l''ordine resta a 70 €', (select totale::float8::text from ordini_vestiario where id = preso('b')), '70');
select atteso('e la riga a 35 €', (select string_agg(prezzo::float8::text, ',') from righe_vestiario where ordine_id = preso('b')), '35');
reset role;
select chi('');
set role anon;
select atteso('chi ordina adesso vede il totale del server', (invia_ordine_vestiario(ordine(jsonb_build_array(riga('Luca Rossi', 'Judogi', '130', 2))))->>'totale')::float8::text, '80');
reset role;

\echo ''
\echo '--- 6. proroga e raccolta nuova ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select salva_vestiario(cat(current_date + 7)) is not null;
select tieni('raccolte', (select count(*)::text from raccolte_vestiario));
select tieni('ottobre', (select raccolta_id::text from ordini_vestiario where id = preso('a')));
select atteso('proroga di una settimana, con la raccolta aperta', tenta($$select (salva_vestiario(cat(current_date + 14)) is not null)::text$$), 'true');
select atteso('le raccolte sono le stesse', (select count(*)::text from raccolte_vestiario), current_setting('prova.raccolte'));
select atteso('l''ordine resta nella sua', (select raccolta_id::text from ordini_vestiario where id = preso('a')), current_setting('prova.ottobre'));
select atteso('che dice la data nuova', (select chiude::text from raccolte_vestiario where id = preso('ottobre')), (current_date + 14)::text);
select salva_vestiario(cat(null));
select atteso('salvato senza data, con la raccolta aperta: sempre la stessa', (select count(*)::text from raccolte_vestiario), current_setting('prova.raccolte'));
select atteso('e non perde la sua data', (select chiude::text from raccolte_vestiario where id = preso('ottobre')), (current_date + 14)::text);
-- Chiusa a ieri: è ancora una proroga (all'indietro), la stessa raccolta.
select salva_vestiario(cat(current_date - 1)) is not null;
select atteso('chiusa a ieri: sempre la stessa', (select count(*)::text from raccolte_vestiario), current_setting('prova.raccolte'));
-- A raccolta chiusa, la stessa data con un prezzo cambiato non è una raccolta nuova.
select salva_vestiario(cat(current_date - 1, 40));
select atteso('raccolta chiusa, stessa data e un prezzo nuovo: le raccolte sono quelle', (select count(*)::text from raccolte_vestiario), current_setting('prova.raccolte'));
select atteso('e l''ordine resta lì', (select raccolta_id::text from ordini_vestiario where id = preso('a')), current_setting('prova.ottobre'));
select atteso('con la raccolta chiusa, una data nuova', tenta($$select (salva_vestiario(cat(current_date + 30)) is not null)::text$$), 'true');
select atteso('apre una raccolta in più', (select count(*) - current_setting('prova.raccolte')::int from raccolte_vestiario)::text, '1');
select tieni('marzo', (select id::text from raccolte_vestiario where chiude = current_date + 30));
select atteso('la nuova è vuota', (select count(*)::text from ordini_vestiario where raccolta_id = preso('marzo')), '0');
select atteso('l''ordine di prima resta nella sua', (select raccolta_id::text from ordini_vestiario where id = preso('a')), current_setting('prova.ottobre'));
select atteso('che tiene la sua data', (select chiude::text from raccolte_vestiario where id = preso('ottobre')), (current_date - 1)::text);
reset role;
select chi('');
set role anon;
select tieni('c', invia_ordine_vestiario(ordine(jsonb_build_array(riga('Luca Rossi', 'Judogi', '140'))))->>'id');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('un ordine nuovo va nella nuova', ((select raccolta_id from ordini_vestiario where id = preso('c')) = preso('marzo') and preso('marzo') is not null)::text, 'true');
reset role;

\echo ''
\echo '--- 7. un ordine per famiglia ---'
select chi('');
set role anon;
select tieni('famiglia', invia_ordine_vestiario(ordine(jsonb_build_array(riga('Luca Rossi', 'Judogi', '130'), riga('Sara Rossi', 'Costumino', 'S'))))->>'id');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('un ordine, due righe per due bambini', (select string_agg(per_chi, ', ' order by per_chi) from righe_vestiario where ordine_id = preso('famiglia')), 'Luca Rossi, Sara Rossi');
select atteso('un totale solo', (select totale::float8::text from ordini_vestiario where id = preso('famiglia')), '65');
reset role;

\echo ''
\echo '--- 8. chi vede gli ordini ---'
select chi('');
set role anon;
select atteso('anon non legge gli ordini', tenta($$select count(*)::text from ordini_vestiario$$), 'NEGATO: …');
select atteso('né le righe', tenta($$select count(*)::text from righe_vestiario$$), 'NEGATO: …');
select atteso('non li segna saldati', tenta($$update ordini_vestiario set saldato = true$$), 'NEGATO: …');
select atteso('né il pagato né il banco', tenta($$update ordini_vestiario set pagato = 1, dal_banco = true$$), 'NEGATO: …');
select atteso('non cambia le righe', tenta($$update righe_vestiario set prezzo = 0$$), 'NEGATO: …');
select atteso('non chiama segna_vestiario', tenta(format($$select segna_vestiario(%L, 'bonifico')::text$$, preso('a'))), 'NEGATO: …');
select atteso('non scrive un ordine da sé', tenta($$insert into ordini_vestiario (nome, cognome, telefono) values ('X', 'Y', '3331234567')$$), 'NEGATO: …');
select atteso('non scrive dal banco', tenta($$select scrivi_ordine_vestiario(ordine(jsonb_build_array(riga('Luca Rossi', 'Judogi', '130'))), 'bonifico')::text$$), 'NEGATO: …');
select atteso('non corregge', tenta($$select correggi_ordine_vestiario(preso('a'), jsonb_build_array(riga('Luca Rossi', 'Judogi', '130')))::text$$), 'NEGATO: …');
reset role;
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('un istruttore non legge gli ordini', tenta($$select count(*)::text from ordini_vestiario$$), '0');
select atteso('né le righe', tenta($$select count(*)::text from righe_vestiario$$), '0');
select atteso('né le raccolte', tenta($$select count(*)::text from raccolte_vestiario$$), '0');
select atteso('non li segna saldati', tenta($$update ordini_vestiario set saldato = true$$), 'NEGATO: …');
select atteso('né il pagato né il banco', tenta($$update ordini_vestiario set pagato = 1, dal_banco = true$$), 'NEGATO: …');
select atteso('nemmeno con segna_vestiario', tenta(format($$select segna_vestiario(%L, 'bonifico')::text$$, preso('a'))), 'NEGATO: …');
select atteso('non cambia le righe', tenta($$update righe_vestiario set prezzo = 0$$), 'NEGATO: …');
select atteso('non li cancella', tenta($$delete from ordini_vestiario$$), 'NEGATO: …');
select atteso('non scrive un ordine da sé', tenta($$insert into ordini_vestiario (nome, cognome, telefono) values ('X', 'Y', '3331234567')$$), 'NEGATO: …');
select atteso('non scrive dal banco', tenta($$select scrivi_ordine_vestiario(ordine(jsonb_build_array(riga('Luca Rossi', 'Judogi', '130'))), 'bonifico')::text$$), 'NEGATO: …');
select atteso('non corregge', tenta($$select correggi_ordine_vestiario(preso('a'), jsonb_build_array(riga('Luca Rossi', 'Judogi', '130')))::text$$), 'NEGATO: …');
reset role;
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('un iscritto non legge gli ordini', tenta($$select count(*)::text from ordini_vestiario$$), '0');
select atteso('né le righe', tenta($$select count(*)::text from righe_vestiario$$), '0');
select atteso('né le raccolte', tenta($$select count(*)::text from raccolte_vestiario$$), '0');
select atteso('non li segna saldati', tenta($$update ordini_vestiario set saldato = true$$), 'NEGATO: …');
select atteso('né il pagato né il banco', tenta($$update ordini_vestiario set pagato = 1, dal_banco = true$$), 'NEGATO: …');
select atteso('nemmeno con segna_vestiario', tenta(format($$select segna_vestiario(%L, 'bonifico')::text$$, preso('a'))), 'NEGATO: …');
select atteso('non cambia le righe', tenta($$update righe_vestiario set prezzo = 0$$), 'NEGATO: …');
select atteso('non li cancella', tenta($$delete from ordini_vestiario$$), 'NEGATO: …');
reset role;
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('il tablet non legge gli ordini', tenta($$select count(*)::text from ordini_vestiario$$), '0');
select atteso('né le righe', tenta($$select count(*)::text from righe_vestiario$$), '0');
select atteso('né le raccolte', tenta($$select count(*)::text from raccolte_vestiario$$), '0');
select atteso('non li segna saldati', tenta($$update ordini_vestiario set saldato = true$$), 'NEGATO: …');
select atteso('né il pagato né il banco', tenta($$update ordini_vestiario set pagato = 1, dal_banco = true$$), 'NEGATO: …');
select atteso('nemmeno con segna_vestiario', tenta(format($$select segna_vestiario(%L, 'bonifico')::text$$, preso('a'))), 'NEGATO: …');
select atteso('non cambia le righe', tenta($$update righe_vestiario set prezzo = 0$$), 'NEGATO: …');
select atteso('non li cancella', tenta($$delete from ordini_vestiario$$), 'NEGATO: …');
reset role;
select chi('77777777-7777-7777-7777-777777777777');
set role authenticated;
select atteso('il ruolo doppio li legge', tenta($$select (count(*) > 0)::text from ordini_vestiario$$), 'true');
select atteso('e le righe', tenta($$select (count(*) > 0)::text from righe_vestiario$$), 'true');
select segna_vestiario(preso('famiglia'), 'bonifico');
select atteso('e li segna', (select concat_ws(' ', saldato::text, (pagato = totale)::text) from ordini_vestiario where id = preso('famiglia')), 'true true');
reset role;

\echo ''
\echo '--- 9. la segreteria: saldato, annullato, spostato ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('il saldato non si cambia a mano, nemmeno dalla segreteria', tenta(format($$update ordini_vestiario set saldato = true where id = %L$$, preso('a'))), 'NEGATO: …');
select atteso('né il pagato', tenta(format($$update ordini_vestiario set pagato = 1 where id = %L$$, preso('a'))), 'NEGATO: …');
select segna_vestiario(preso('a'), 'bonifico');
select atteso('segna SALDATO: pagato il totale, con bonifico, oggi',
  (select concat_ws(' · ', saldato::text, (pagato = totale)::text, pagato_con, (pagato_il = (now() at time zone 'Europe/Rome')::date)::text) from ordini_vestiario where id = preso('a')), 'true · true · bonifico · true');
select segna_vestiario(preso('a'), null);
select atteso('toglie il segno: pagato 0, come e quando vuoti',
  (select concat_ws(' · ', saldato::text, pagato::float8, coalesce(pagato_con, '-'), coalesce(pagato_il::text, '-')) from ordini_vestiario where id = preso('a')), 'false · 0 · - · -');
select atteso('come fuori da bonifico, satispay o contanti: rifiutato', tenta(format($$select segna_vestiario(%L, 'assegno')::text$$, preso('a'))), 'NEGATO: …');
select atteso('e resta da saldare', (select saldato::text from ordini_vestiario where id = preso('a')), 'false');
select atteso('annulla', tenta(format($$update ordini_vestiario set annullato = true where id = %L$$, preso('a'))), 'FATTO (1 righe)');
select atteso('un annullato non si segna', tenta(format($$select segna_vestiario(%L, 'contanti')::text$$, preso('a'))), 'NEGATO: Rimetti l''ordine prima di segnarlo…');
select atteso('e resta da saldare', (select saldato::text from ordini_vestiario where id = preso('a')), 'false');
select atteso('rimette', tenta(format($$update ordini_vestiario set annullato = false where id = %L$$, preso('a'))), 'FATTO (1 righe)');
select atteso('sposta alla raccolta nuova', tenta(format($$update ordini_vestiario set raccolta_id = %L where id = %L$$, preso('marzo'), preso('a'))), 'FATTO (1 righe)');
select atteso('ed è lì, da saldare e non annullato',
  (select concat_ws(' ', (raccolta_id = preso('marzo'))::text, saldato::text, annullato::text) from ordini_vestiario where id = preso('a')), 'true false false');
-- Un ordine non si cancella, si annulla: resta visibile. E le righe si
-- cambiano solo da correggi_ordine_vestiario, che rifà il totale.
select atteso('la segreteria non cancella un ordine', tenta(format($$delete from ordini_vestiario where id = %L$$, preso('a'))), 'NEGATO: …');
select atteso('né cambia una riga a mano', tenta(format($$update righe_vestiario set prezzo = 0 where ordine_id = %L$$, preso('a'))), 'NEGATO: …');
select atteso('né il totale a mano', tenta(format($$update ordini_vestiario set totale = 0 where id = %L$$, preso('a'))), 'NEGATO: …');
select atteso('né il pagato né il banco a mano', tenta(format($$update ordini_vestiario set pagato = 1, dal_banco = true where id = %L$$, preso('a'))), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 10. la segreteria corregge le righe e scrive dal banco ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select salva_vestiario(cat(current_date + 30)) is not null;
reset role;
select chi('');
set role anon;
select tieni('d', invia_ordine_vestiario(ordine(jsonb_build_array(riga('Luca Rossi', 'Judogi', '130', 2))))->>'id');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select salva_vestiario(cat(current_date + 30, 40)) is not null;
select tieni('d1', (select id::text from righe_vestiario where ordine_id = preso('d')));
select atteso('taglia cambiata e una riga in più: il totale nuovo',
  tenta($$select correggi_ordine_vestiario(preso('d'), jsonb_build_array(
    riga('Luca Rossi', 'Judogi', '140', 2) || jsonb_build_object('id', preso('d1'), 'prezzo', 1),
    riga('Sara Rossi', 'Judogi', '120')))::float8::text$$), '110');
select atteso('la riga vecchia tiene 35 €, la nuova prende 40 €',
  (select string_agg(concat_ws(' · ', per_chi, taglia, quanti, prezzo::float8), ' | ' order by per_chi) from righe_vestiario where ordine_id = preso('d')),
  'Luca Rossi · 140 · 2 · 35 | Sara Rossi · 120 · 1 · 40');
select atteso('il totale dell''ordine', (select totale::float8::text from ordini_vestiario where id = preso('d')), '110');
select tieni('d2', (select id::text from righe_vestiario where ordine_id = preso('d') and per_chi = 'Sara Rossi'));
select atteso('riga tolta e quantità cambiata',
  tenta($$select correggi_ordine_vestiario(preso('d'), jsonb_build_array(riga('Sara Rossi', 'Judogi', '120', 3) || jsonb_build_object('id', preso('d2'))))::float8::text$$), '120');
select atteso('resta una riga', (select string_agg(concat_ws(' · ', per_chi, quanti, prezzo::float8), ' | ') from righe_vestiario where ordine_id = preso('d')), 'Sara Rossi · 3 · 40');
select atteso('una riga di un altro ordine no',
  tenta($$select correggi_ordine_vestiario(preso('d'), jsonb_build_array(riga('Luca Rossi', 'Judogi', '130') || jsonb_build_object('id', (select id from righe_vestiario where ordine_id = preso('famiglia') limit 1))))::text$$),
  'NEGATO: Una riga non è di quest''ordine: ricarica la pagina');
select atteso('un ordine che non c''è più', tenta($$select correggi_ordine_vestiario(gen_random_uuid(), jsonb_build_array(riga('Luca Rossi', 'Judogi', '130')))::text$$),
  'NEGATO: L''ordine non c''è più: ricarica la pagina');
select atteso('un capo fuori catalogo in una riga nuova no', tenta($$select correggi_ordine_vestiario(preso('d'), jsonb_build_array(riga('Sara Rossi', 'Felpa', 'S')))::text$$), 'NEGATO: …Felpa…');
select atteso('togliere tutte le righe no: si annulla', tenta($$select correggi_ordine_vestiario(preso('d'), '[]')::text$$), 'NEGATO: …almeno un capo…');
select atteso('e l''ordine resta com''era', (select totale::float8::text from ordini_vestiario where id = preso('d')), '120');
-- La taglia 120 tolta dal catalogo: la riga che l'ha si corregge lo stesso nella quantità.
select salva_vestiario(jsonb_set(cat(current_date + 30, 40), '{capi,0,taglie}', '["130", "140"]'));
select atteso('taglia tolta dal catalogo, cambia solo la quantità: va',
  tenta($$select correggi_ordine_vestiario(preso('d'), jsonb_build_array(riga('Sara Rossi', 'Judogi', '120', 2) || jsonb_build_object('id', preso('d2'))))::float8::text$$), '80');
select salva_vestiario(cat(current_date + 30, 40));
-- Una riga che cambia capo prende il prezzo di adesso.
reset role;
select chi('');
set role anon;
select tieni('e', invia_ordine_vestiario(ordine(jsonb_build_array(riga('Luca Rossi', 'Judogi', '130'))))->>'id');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select tieni('e1', (select id::text from righe_vestiario where ordine_id = preso('e')));
select atteso('da Judogi a Costumino S, con il suo id: 30 € e il totale nuovo',
  tenta($$select correggi_ordine_vestiario(preso('e'), jsonb_build_array(riga('Luca Rossi', 'Costumino', 'S') || jsonb_build_object('id', preso('e1'))))::float8::text$$), '30');
select atteso('la riga ha il prezzo di adesso', (select concat_ws(' · ', capo, taglia, prezzo::float8) from righe_vestiario where id = preso('e1')), 'Costumino · S · 30');
select atteso('e l''ordine il totale nuovo', (select totale::float8::text from ordini_vestiario where id = preso('e')), '30');
-- Un ordine mandato con l'id del dispositivo, rimandato dopo la chiusura: risponde con quello salvato.
select tieni('rimandato', gen_random_uuid()::text);
reset role;
select chi('');
set role anon;
select tieni('primo_r', invia_ordine_vestiario(ordine(jsonb_build_array(riga('Luca Rossi', 'Judogi', '130')), jsonb_build_object('id', preso('rimandato'), 'telefono', '349 000 0001')))->>'id');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
-- Le righe restano nell'ordine in cui sono state scritte, anche dopo una correzione.
reset role;
select chi('');
set role anon;
select tieni('tre', invia_ordine_vestiario(ordine(jsonb_build_array(riga('Uno', 'Judogi', '130'), riga('Due', 'Judogi', '140'), riga('Tre', 'Costumino', 'S'))))->>'id');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('le righe nell''ordine scritto', (select string_agg(per_chi, ',' order by posizione) from righe_vestiario where ordine_id = preso('tre')), 'Uno,Due,Tre');
select atteso('con le posizioni 1, 2, 3', (select string_agg(posizione::text, ',' order by posizione) from righe_vestiario where ordine_id = preso('tre')), '1,2,3');
select correggi_ordine_vestiario(preso('tre'), (select jsonb_agg(riga(per_chi, capo, taglia, case when per_chi = 'Uno' then 2 else quanti end) || jsonb_build_object('id', id) order by posizione)
  from righe_vestiario where ordine_id = preso('tre')));
select atteso('cambiata la prima, sempre 1, 2, 3', (select string_agg(per_chi || ' ' || quanti, ',' order by posizione) from righe_vestiario where ordine_id = preso('tre')), 'Uno 2,Due 1,Tre 1');
select correggi_ordine_vestiario(preso('tre'), (select jsonb_agg(riga(per_chi, capo, taglia, quanti) || jsonb_build_object('id', id) order by case per_chi when 'Tre' then 0 else posizione end)
  from righe_vestiario where ordine_id = preso('tre')));
select atteso('mandate in un altro ordine, tornano in quello', (select string_agg(per_chi, ',' order by posizione) from righe_vestiario where ordine_id = preso('tre')), 'Tre,Uno,Due');
-- Correzione di un saldato. RESTA SALDATO: il pagato segue il totale nuovo.
reset role;
select chi('');
set role anon;
select tieni('s1', invia_ordine_vestiario(ordine(jsonb_build_array(riga('Uno', 'Costumino', 'S'))))->>'id');
select tieni('s2', invia_ordine_vestiario(ordine(jsonb_build_array(riga('Due', 'Costumino', 'S'))))->>'id');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select segna_vestiario(preso('s1'), 'satispay');
select correggi_ordine_vestiario(preso('s1'), (select jsonb_agg(riga(per_chi, capo, taglia, 2) || jsonb_build_object('id', id)) from righe_vestiario where ordine_id = preso('s1')));
select atteso('corretto da 30 a 60, resta saldato: pagato 60',
  (select concat_ws(' · ', saldato::text, totale::float8, pagato::float8, pagato_con) from ordini_vestiario where id = preso('s1')), 'true · 60 · 60 · satispay');
-- TOGLI IL SEGNO, prima di salvare la correzione: il pagato di prima resta, con come e quando.
select segna_vestiario(preso('s2'), 'contanti');
select segna_vestiario(preso('s2'), null, true);
select correggi_ordine_vestiario(preso('s2'), (select jsonb_agg(riga(per_chi, capo, taglia, 2) || jsonb_build_object('id', id)) from righe_vestiario where ordine_id = preso('s2')));
select atteso('TOGLI IL SEGNO: da saldare, pagato 30 su 60, contanti, oggi',
  (select concat_ws(' · ', saldato::text, totale::float8, pagato::float8, pagato_con, (pagato_il = (now() at time zone 'Europe/Rome')::date)::text) from ordini_vestiario where id = preso('s2')), 'false · 60 · 30 · contanti · true');
-- TOGLI IL SEGNO dentro la correzione, in una transazione sola.
reset role;
select chi('');
set role anon;
select tieni('s3', invia_ordine_vestiario(ordine(jsonb_build_array(riga('Tre', 'Costumino', 'S'))))->>'id');
select tieni('s4', invia_ordine_vestiario(ordine(jsonb_build_array(riga('Quattro', 'Costumino', 'S', 2))))->>'id');
select tieni('s5', invia_ordine_vestiario(ordine(jsonb_build_array(riga('Cinque', 'Judogi', '130'))))->>'id');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select segna_vestiario(preso('s3'), 'contanti');
select correggi_ordine_vestiario(preso('s3'), (select jsonb_agg(riga(per_chi, capo, taglia, 2) || jsonb_build_object('id', id)) from righe_vestiario where ordine_id = preso('s3')), true);
select atteso('togli_segno col totale che sale: da saldare, pagato il vecchio totale, come e quando restano',
  (select concat_ws(' · ', saldato::text, totale::float8, pagato::float8, pagato_con, (pagato_il = (now() at time zone 'Europe/Rome')::date)::text) from ordini_vestiario where id = preso('s3')), 'false · 60 · 30 · contanti · true');
select segna_vestiario(preso('s4'), 'satispay');
select correggi_ordine_vestiario(preso('s4'), (select jsonb_agg(riga(per_chi, capo, taglia, 1) || jsonb_build_object('id', id)) from righe_vestiario where ordine_id = preso('s4')), true);
select atteso('togli_segno col totale che scende: si ignora, resta saldato col totale nuovo',
  (select concat_ws(' · ', saldato::text, totale::float8, pagato::float8, pagato_con) from ordini_vestiario where id = preso('s4')), 'true · 30 · 30 · satispay');
select segna_vestiario(preso('s5'), 'bonifico');
select correggi_ordine_vestiario(preso('s5'), (select jsonb_agg(riga(per_chi, capo, '140', quanti) || jsonb_build_object('id', id)) from righe_vestiario where ordine_id = preso('s5')), true);
select atteso('togli_segno col totale uguale: si ignora',
  (select concat_ws(' · ', saldato::text, totale::float8, pagato::float8, pagato_con) from ordini_vestiario where id = preso('s5')), 'true · 40 · 40 · bonifico');
-- Il limite dei 60 all'ora è per il link: gli ordini dal banco non contano.
select atteso('prima: meno di 60 dal link nell''ultima ora',
  (select (count(*) < 60)::text from ordini_vestiario where creato_il > now() - interval '1 hour' and not annullato and not dal_banco), 'true');
select atteso('60 ordini dal banco', (select count(scrivi_ordine_vestiario(ordine(jsonb_build_array(riga('Banco', 'Costumino', 'S'))), null::text))::text from generate_series(1, 60)), '60');
reset role;
select chi('');
set role anon;
select atteso('e uno dal link passa ancora',
  tenta($$select (invia_ordine_vestiario(ordine(jsonb_build_array(riga('Luca Rossi', 'Costumino', 'S'))))->>'id' is not null)::text$$), 'true');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
-- La raccolta chiude: il genitore non può più, la segreteria sì.
select salva_vestiario(cat(current_date - 1)) is not null;
select tieni('banco', scrivi_ordine_vestiario(ordine(jsonb_build_array(riga('Marco Bianchi', 'Costumino', 'M')), '{"nome": "Anna", "cognome": "Bianchi"}'), null::text)::text);
select atteso('dal banco, a raccolta chiusa, si scrive', (select concat_ws(' · ', cognome, totale::float8, saldato::text) from ordini_vestiario where id = preso('banco')), 'Bianchi · 30 · false');
select atteso('dal banco, senza come: niente pagato, ed è dal banco', (select concat_ws(' · ', pagato::float8, coalesce(pagato_con, '-'), dal_banco::text) from ordini_vestiario where id = preso('banco')), '0 · - · true');
select atteso('nella raccolta di adesso', (select raccolta_id = preso('marzo') from ordini_vestiario where id = preso('banco'))::text, 'true');
select tieni('saldato', scrivi_ordine_vestiario(ordine(jsonb_build_array(riga('Marco Bianchi', 'Judogi', '140')), '{"nome": "Anna", "cognome": "Bianchi"}'), 'bonifico')::text);
select atteso('e anche già saldato', (select saldato::text from ordini_vestiario where id = preso('saldato')), 'true');
select atteso('pagato il totale, con quel come, oggi',
  (select concat_ws(' · ', (pagato = totale)::text, pagato_con, (pagato_il = (now() at time zone 'Europe/Rome')::date)::text) from ordini_vestiario where id = preso('saldato')), 'true · bonifico · true');
select atteso('dal banco con un come sbagliato no', tenta($$select scrivi_ordine_vestiario(ordine(jsonb_build_array(riga('Marco Bianchi', 'Costumino', 'M'))), 'assegno')::text$$), 'NEGATO: …');
select atteso('dal banco valgono le stesse regole sulle righe', tenta($$select scrivi_ordine_vestiario(ordine(jsonb_build_array(riga('Marco Bianchi', 'Judogi', '999'))), null::text)::text$$), 'NEGATO: …taglia 999…');
-- Dal banco con l'id del dispositivo: rimandato (la risposta si era persa) è lo stesso ordine.
select tieni('banco_id', gen_random_uuid()::text);
select atteso('dal banco con un id: è quello dell''ordine',
  tenta($$select scrivi_ordine_vestiario(ordine(jsonb_build_array(riga('Marco Bianchi', 'Costumino', 'M')), jsonb_build_object('id', preso('banco_id'), 'telefono', '350 000 0001')), 'bonifico')::text$$), current_setting('prova.banco_id'));
select atteso('rimandato, risponde con lo stesso id',
  tenta($$select scrivi_ordine_vestiario(ordine(jsonb_build_array(riga('Marco Bianchi', 'Costumino', 'M')), jsonb_build_object('id', preso('banco_id'), 'telefono', '+39 350 0000001')), 'bonifico')::text$$), current_setting('prova.banco_id'));
select atteso('e non ne crea un altro', (select count(*)::text from ordini_vestiario where telefono like '%350%000%0001%'), '1');
select atteso('con un altro telefono è rifiutato',
  tenta($$select scrivi_ordine_vestiario(ordine(jsonb_build_array(riga('Marco Bianchi', 'Costumino', 'M')), jsonb_build_object('id', preso('banco_id'), 'telefono', '350 000 0002')), 'bonifico')::text$$),
  'NEGATO: Quest''ordine non si può rimandare: ricarica la pagina e rifallo');
reset role;
select chi('');
set role anon;
select atteso('a raccolta chiusa, lo stesso ordine rimandato risponde con quello salvato',
  tenta($$select invia_ordine_vestiario(ordine(jsonb_build_array(riga('Luca Rossi', 'Judogi', '130')), jsonb_build_object('id', preso('rimandato'), 'telefono', '349 000 0001')))->>'id'$$), current_setting('prova.rimandato'));
reset role;

\echo ''
\echo '--- 11. come il modulo: tipi, foto e tabelle delle taglie (51-vestiario-foto.sql) ---'
-- Il catalogo coi tipi e le foto: un capo senza tipo va lo stesso.
create or replace function cat_foto(capo0 jsonb default '{}', tabelle jsonb default '{"judogi": "tabella-judogi.png"}') returns jsonb language sql as $$
  select jsonb_set(jsonb_set(cat(current_date + 30), '{capi,0}', (cat(current_date + 30)->'capi'->0) || '{"tipo": "judogi", "foto": "judogi-1.jpg"}' || capo0), '{tabelle}', tabelle)
$$;
grant execute on function cat_foto(jsonb, jsonb) to anon, authenticated;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('tipo, foto e tabelle si salvano; il costumino senza tipo va', tenta($$select (salva_vestiario(cat_foto()) is not null)::text$$), 'true');
select atteso('un tipo fuori dai tre no', tenta($$select salva_vestiario(cat_foto('{"tipo": "felpe"}'))::text$$), 'NEGATO: "Judogi": il tipo non si capisce');
select atteso('una foto con la barra no', tenta($$select salva_vestiario(cat_foto('{"foto": "cartella/judogi.jpg"}'))::text$$), 'NEGATO: La foto di "Judogi" non si capisce: ricaricala');
select atteso('una foto che è un indirizzo no', tenta($$select salva_vestiario(cat_foto('{"foto": "http://esempio.it/judogi.jpg"}'))::text$$), 'NEGATO: La foto di "Judogi" non si capisce: ricaricala');
select atteso('una foto con .. no', tenta($$select salva_vestiario(cat_foto('{"foto": "su..giu.jpg"}'))::text$$), 'NEGATO: La foto di "Judogi" non si capisce: ricaricala');
select atteso('la regola del nome del file, come nell''app',
  (select string_agg(n || '=' || vestiario_nome_file(n)::text, ' ' order by k)
   from unnest(array['JUDOGI-1.JPG', 'a.b_c-d.webp', 'foto judogi.jpg', 'fötö.jpg', 'a?b#c.jpg', '.x.jpg']) with ordinality u(n, k)),
  'JUDOGI-1.JPG=true a.b_c-d.webp=true foto judogi.jpg=false fötö.jpg=false a?b#c.jpg=false .x.jpg=false');
select atteso('un''altra estensione dopo, o una barra dopo: no', concat_ws(' ', vestiario_nome_file('a.jpg.html')::text, vestiario_nome_file('a.jpg/x')::text), 'false false');
select atteso('un nome di 120 caratteri va, di 121 no', concat_ws(' ', vestiario_nome_file(repeat('a', 116) || '.jpg')::text, vestiario_nome_file(repeat('a', 117) || '.jpg')::text), 'true false');
select atteso('una foto con lo spazio no', tenta($$select salva_vestiario(cat_foto('{"foto": "foto judogi.jpg"}'))::text$$), 'NEGATO: La foto di "Judogi" non si capisce: ricaricala');
select atteso('una foto che non è un''immagine no', tenta($$select salva_vestiario(cat_foto('{"foto": "judogi.gif"}'))::text$$), 'NEGATO: La foto di "Judogi" non si capisce: ricaricala');
select atteso('una tabella che è un indirizzo no', tenta($$select salva_vestiario(cat_foto('{}', '{"judogi": "http://esempio.it/t.png"}'))::text$$), 'NEGATO: La tabella delle taglie di "JUDOGI" non si capisce: ricaricala');
select atteso('una tabella di un tipo che non c''è no', tenta($$select salva_vestiario(cat_foto('{}', '{"felpe": "t.png"}'))::text$$), 'NEGATO: La tabella delle taglie non si capisce: ricaricala');
reset role;
select chi('');
set role anon;
select atteso('la pagina vede tipo e foto', (select concat_ws(' · ', c->>'tipo', c->>'foto') from (select vestiario()->'capi'->0 c) x), 'judogi · judogi-1.jpg');
select atteso('il capo senza tipo resta senza', coalesce(vestiario()->'capi'->1->>'tipo', 'nessuno'), 'nessuno');
select atteso('e le tabelle delle taglie', vestiario()->'tabelle'->>'judogi', 'tabella-judogi.png');
reset role;
-- Le stesse regole valgono anche per il catalogo scritto a mano nelle impostazioni.
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('a mano, una foto che è un indirizzo no', tenta($$update impostazioni set vestiario = '[{"capo": "J", "foto": "https://x.it/a.jpg"}]' where id$$), 'NEGATO: …');
select atteso('a mano, un tipo fuori dai tre no', tenta($$update impostazioni set vestiario = '[{"capo": "J", "tipo": "felpe"}]' where id$$), 'NEGATO: …');
select atteso('a mano, la tabella di un tipo che non c''è no', tenta($$update impostazioni set vestiario_tabelle = '{"felpe": "t.png"}' where id$$), 'NEGATO: …');
select atteso('a mano, una tabella che è un indirizzo no', tenta($$update impostazioni set vestiario_tabelle = '{"judogi": "http://x/t.png"}' where id$$), 'NEGATO: …');
select atteso('a mano, tabelle oltre i 1000 byte no', tenta(format($$update impostazioni set vestiario_tabelle = jsonb_build_object('judogi', %L) where id$$, repeat('a', 1000) || '.png')), 'NEGATO: …');
-- Senza la chiave «tabelle» restano com'erano; con un oggetto vuoto si tolgono.
select salva_vestiario(cat_foto() - 'tabelle');
select atteso('salvato senza «tabelle»: restano com''erano', vestiario()->'tabelle'->>'judogi', 'tabella-judogi.png');
select salva_vestiario(cat_foto('{}', '{}'));
select atteso('salvato con «tabelle» vuote: si tolgono', vestiario()->>'tabelle', '{}');
select salva_vestiario(cat_foto());
reset role;

-- Il contenitore delle foto: pubblico in lettura, piccolo, solo immagini.
select atteso('il contenitore «vestiario» c''è ed è pubblico', (select public::text from storage.buckets where id = 'vestiario'), 'true');
select atteso('pesa al massimo 1 MB', (select file_size_limit::text from storage.buckets where id = 'vestiario'), '1048576');
select atteso('solo jpeg, png e webp', (select array_to_string(array(select unnest(allowed_mime_types) order by 1), ',') from storage.buckets where id = 'vestiario'), 'image/jpeg,image/png,image/webp');
insert into storage.objects (bucket_id, name) values ('vestiario', 'tabella-judogi.png');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria carica una foto', tenta($$insert into storage.objects (bucket_id, name) values ('vestiario', 'judogi-1.jpg')$$), 'FATTO (1 righe)');
select atteso('la cambia', tenta($$update storage.objects set name = 'judogi-2.jpg' where bucket_id = 'vestiario' and name = 'judogi-1.jpg'$$), 'FATTO (1 righe)');
select atteso('e la cancella', tenta($$delete from storage.objects where bucket_id = 'vestiario' and name = 'judogi-2.jpg'$$), 'FATTO (1 righe)');
select atteso('un nome che non è una foto del catalogo no, nemmeno dalla segreteria', tenta($$insert into storage.objects (bucket_id, name) values ('vestiario', 'cartella/pagina.html')$$), 'NEGATO: …');
select atteso('né rinominarla così', tenta($$update storage.objects set name = 'cartella/pagina.html' where bucket_id = 'vestiario' and name = 'tabella-judogi.png'$$), 'NEGATO: …');
reset role;
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('un istruttore non carica', tenta($$insert into storage.objects (bucket_id, name) values ('vestiario', 'mia.jpg')$$), 'NEGATO: …');
select atteso('senza where non cancella niente', tenta($$delete from storage.objects$$), 'a vuoto (0 righe)');
select atteso('senza where non rinomina niente', tenta($$update storage.objects set name = 'x.jpg'$$), 'a vuoto (0 righe)');
select atteso('non cambia', tenta($$update storage.objects set name = 'altra.png' where bucket_id = 'vestiario'$$), 'a vuoto (0 righe)');
select atteso('non cancella', tenta($$delete from storage.objects where bucket_id = 'vestiario'$$), 'a vuoto (0 righe)');
reset role;
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('un iscritto non carica', tenta($$insert into storage.objects (bucket_id, name) values ('vestiario', 'mia.jpg')$$), 'NEGATO: …');
select atteso('senza where non cancella niente', tenta($$delete from storage.objects$$), 'a vuoto (0 righe)');
select atteso('senza where non rinomina niente', tenta($$update storage.objects set name = 'x.jpg'$$), 'a vuoto (0 righe)');
select atteso('non cambia', tenta($$update storage.objects set name = 'altra.png' where bucket_id = 'vestiario'$$), 'a vuoto (0 righe)');
select atteso('non cancella', tenta($$delete from storage.objects where bucket_id = 'vestiario'$$), 'a vuoto (0 righe)');
select atteso('non elenca', (select count(*)::text from storage.objects where bucket_id = 'vestiario'), '0');
reset role;
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('il tablet non carica', tenta($$insert into storage.objects (bucket_id, name) values ('vestiario', 'mia.jpg')$$), 'NEGATO: …');
select atteso('senza where non cancella niente', tenta($$delete from storage.objects$$), 'a vuoto (0 righe)');
select atteso('senza where non rinomina niente', tenta($$update storage.objects set name = 'x.jpg'$$), 'a vuoto (0 righe)');
select atteso('non cambia', tenta($$update storage.objects set name = 'altra.png' where bucket_id = 'vestiario'$$), 'a vuoto (0 righe)');
select atteso('non cancella', tenta($$delete from storage.objects where bucket_id = 'vestiario'$$), 'a vuoto (0 righe)');
select atteso('non elenca', (select count(*)::text from storage.objects where bucket_id = 'vestiario'), '0');
reset role;
select chi('');
set role anon;
select atteso('chi non ha un accesso non carica', tenta($$insert into storage.objects (bucket_id, name) values ('vestiario', 'mia.jpg')$$), 'NEGATO: …');
select atteso('e non elenca i file', (select count(*)::text from storage.objects where bucket_id = 'vestiario'), '0');
select atteso('né li cancella', tenta($$delete from storage.objects where bucket_id = 'vestiario'$$), 'a vuoto (0 righe)');
reset role;
select atteso('la tabella è ancora lì', (select count(*)::text from storage.objects where bucket_id = 'vestiario'), '1');

\echo ''
\echo 'Vestiario: tutto a posto.'
