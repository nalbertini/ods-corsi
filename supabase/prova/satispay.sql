-- Satispay nel modulo di iscrizione: l'importo lo calcola il database dal
-- listino, un pagamento per richiesta (mai due in attesa), lo stato lo scrive
-- solo la Edge Function (service_role), e un pagamento arrivato entra in una
-- ricevuta una volta sola, con l'importo giusto.
-- Si lancia dopo finto-supabase.sql e i file dello schema, fino a 73-satispay.sql.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'maura@ods.it'),
  ('33333333-3333-3333-3333-333333333333', 'luca@ods.it');
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Maura', 'Uno', 'istruttore', 'maura@ods.it', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Luca', 'Rossi', 'iscritto', 'luca@ods.it', '33333333-3333-3333-3333-333333333333'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'Paolo', 'Bianchi', 'iscritto', null, null),
  ('aaaaaaaa-0000-0000-0000-000000000006', 'Sara', 'Verdi', 'iscritto', null, null);
insert into corsi (id, nome) values
  ('cccccccc-0000-0000-0000-000000000001', 'Judo 3'),
  ('cccccccc-0000-0000-0000-000000000002', 'Lotta 3'),
  ('cccccccc-0000-0000-0000-000000000003', 'Corso nuovo');

-- Il listino in euro, come lo salva LISTINO. «Corso nuovo» non c'è: è senza prezzo.
update impostazioni set listino = '{
  "quota": 50, "saldoEntro": "2026-08-31", "offerte": [],
  "corsi": [
    {"corso": "Judo 3", "corsoId": "cccccccc-0000-0000-0000-000000000001", "eta": "", "orari": [], "prezzi": [{"saldo": 350, "annuale": 400, "trimestre": 150}]},
    {"corso": "Lotta 3", "corsoId": "cccccccc-0000-0000-0000-000000000002", "eta": "", "orari": [], "prezzi": [{"annuale": 368, "trimestre": 140}]}
  ]}' where id;

-- Le richieste, come le lascia invia_iscrizione().
create or replace function richiesta(id uuid, nome text, cognome text, corsi uuid[], formula text, stato text default 'nuova') returns void language sql as $$
  insert into richieste_iscrizione (id, nome, cognome, nato_il, nato_a, codice_fiscale, indirizzo, cap, comune, email, telefono, corsi, formula, stato)
  values (id, nome, cognome, '1990-01-01', 'Torino', 'XXXYYY90A01L219Z', 'via Roma 1', '10093', 'Collegno', 'prova@ods.it', '3331234567', corsi, formula, stato::stato_richiesta)
$$;
select richiesta('eeeeeeee-0000-0000-0000-000000000001', 'Paolo', 'Bianchi', array['cccccccc-0000-0000-0000-000000000001']::uuid[], 'annuale');
select richiesta('eeeeeeee-0000-0000-0000-000000000002', 'Sara', 'Verdi', array['cccccccc-0000-0000-0000-000000000001']::uuid[], 'trimestre');
select richiesta('eeeeeeee-0000-0000-0000-000000000003', 'Gino', 'Neri', array['cccccccc-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000002']::uuid[], 'annuale');
select richiesta('eeeeeeee-0000-0000-0000-000000000004', 'Ugo', 'Gialli', array['cccccccc-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000003']::uuid[], 'annuale');
select richiesta('eeeeeeee-0000-0000-0000-000000000005', 'Ada', 'Accolta', array['cccccccc-0000-0000-0000-000000000001']::uuid[], 'annuale', 'accolta');
select richiesta('eeeeeeee-0000-0000-0000-000000000006', 'Ivo', 'Rifiutato', array['cccccccc-0000-0000-0000-000000000001']::uuid[], 'annuale', 'rifiutata');

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
-- La ricevuta di Paolo Bianchi: quota e annuale di Judo 3, pagate con Satispay.
create or replace function ricevuta_satispay(persona text, quota_pagata int default 5000, annuale_pagato int default 40000) returns jsonb language sql as $$
  select jsonb_build_object(
    'data', '2026-10-20', 'persona_id', persona,
    'ente', jsonb_build_object('nome', 'Asd Il Centro Judo'),
    'intestatario', jsonb_build_object('nome', 'Paolo', 'cognome', 'Bianchi'),
    'voci', jsonb_build_array(
      jsonb_build_object('descrizione', 'QUOTA ASSOCIATIVA', 'quantita', 1, 'prezzo', 5000,
        'pagamenti', jsonb_build_array(jsonb_build_object('data', '2026-10-20', 'importo', quota_pagata, 'metodo', 'Satispay'))),
      jsonb_build_object('descrizione', 'Annuale Judo 3', 'quantita', 1, 'prezzo', 40000,
        'pagamenti', jsonb_build_array(jsonb_build_object('data', '2026-10-20', 'importo', annuale_pagato, 'metodo', 'Satispay')))),
    'anticipo', 0)
$$;
grant execute on function tenta(text), rifiuto(text), atteso(text, text, text), chi(text), non_scrive(text), ricevuta_satispay(text, int, int) to anon, authenticated, service_role;

\echo ''
\echo '--- 1. l''importo lo fa il database, dal listino ---'
set role service_role;
select atteso('quota + annuale a saldo, l''ultimo giorno del saldo',
  importo_iscrizione('eeeeeeee-0000-0000-0000-000000000001', '2026-08-31')::text, (5000 + 35000)::text);
select atteso('quota + annuale pieno, il giorno dopo',
  importo_iscrizione('eeeeeeee-0000-0000-0000-000000000001', '2026-09-01')::text, (5000 + 40000)::text);
select atteso('quota + trimestre',
  importo_iscrizione('eeeeeeee-0000-0000-0000-000000000002', '2026-10-20')::text, (5000 + 15000)::text);
select atteso('due annuali: sconto famiglia del 20% su quello che costa meno (Lotta 3, 368 €)',
  importo_iscrizione('eeeeeeee-0000-0000-0000-000000000003', '2026-10-20')::text, (5000 + 40000 + 36800 - 7360)::text);
select atteso('un corso senza prezzo: nessun importo',
  coalesce(importo_iscrizione('eeeeeeee-0000-0000-0000-000000000004', '2026-10-20')::text, 'null'), 'null');
reset role;
update impostazioni set listino = null where id;
set role service_role;
select atteso('senza listino: nessun importo',
  coalesce(importo_iscrizione('eeeeeeee-0000-0000-0000-000000000001', '2026-10-20')::text, 'null'), 'null');
reset role;
update impostazioni set listino = '{
  "quota": 50, "saldoEntro": "2026-08-31", "offerte": [],
  "corsi": [
    {"corso": "Judo 3", "corsoId": "cccccccc-0000-0000-0000-000000000001", "eta": "", "orari": [], "prezzi": [{"saldo": 350, "annuale": 400, "trimestre": 150}]},
    {"corso": "Lotta 3", "corsoId": "cccccccc-0000-0000-0000-000000000002", "eta": "", "orari": [], "prezzi": [{"annuale": 368, "trimestre": 140}]}
  ]}' where id;

\echo ''
\echo '--- 2. satispay_prepara: un pagamento per richiesta ---'
set role service_role;
select atteso('una richiesta che non c''è',
  tenta($$select satispay_prepara('eeeeeeee-0000-0000-0000-0000000000ff')::text$$), 'NEGATO: Questa richiesta non si può più pagare online: paga in segreteria');
select atteso('una richiesta già accolta',
  tenta($$select satispay_prepara('eeeeeeee-0000-0000-0000-000000000005')::text$$), 'NEGATO: Questa richiesta non si può più pagare online: paga in segreteria');
select atteso('una richiesta rifiutata',
  tenta($$select satispay_prepara('eeeeeeee-0000-0000-0000-000000000006')::text$$), 'NEGATO: Questa richiesta non si può più pagare online: paga in segreteria');
select atteso('un corso senza prezzo: col bonifico o in segreteria',
  tenta($$select satispay_prepara('eeeeeeee-0000-0000-0000-000000000004')::text$$), 'NEGATO: Un corso non ha ancora il prezzo: paga col bonifico o in segreteria');
reset role;
select atteso('e niente scritto', (select count(*)::text from pagamenti_satispay), '0');

set role service_role;
select satispay_prepara('eeeeeeee-0000-0000-0000-000000000001') as primo \gset
select atteso('la prima volta: in attesa, con l''importo del database',
  (:'primo'::jsonb->>'stato') || ' ' || (:'primo'::jsonb->>'importo'), 'attesa 45000');
select atteso('ancora senza id di Satispay', coalesce(:'primo'::jsonb->>'satispay_id', 'null'), 'null');
select satispay_prepara('eeeeeeee-0000-0000-0000-000000000001') as secondo \gset
select atteso('la seconda volta: la stessa riga', :'secondo'::jsonb->>'id', :'primo'::jsonb->>'id');
select satispay_creato((:'primo'::jsonb->>'id')::uuid, 'SP-1', 'https://online.satispay.com/pay/SP-1');
select atteso('dopo satispay_creato torna con l''id e il link di Satispay',
  (satispay_prepara('eeeeeeee-0000-0000-0000-000000000001')->>'satispay_id') || ' ' || (satispay_prepara('eeeeeeee-0000-0000-0000-000000000001')->>'link'),
  'SP-1 https://online.satispay.com/pay/SP-1');
reset role;
select atteso('una sola riga per Paolo, in attesa',
  (select string_agg(stato || ' ' || chi, ', ') from pagamenti_satispay where richiesta_id = 'eeeeeeee-0000-0000-0000-000000000001'), 'attesa Bianchi Paolo');

\echo ''
\echo '--- 3. satispay_esito: lo stato come lo dice Satispay ---'
set role service_role;
select atteso('PENDING: niente', satispay_esito('SP-1', 'PENDING')->>'stato', 'attesa');
select atteso('ACCEPTED: pagato', satispay_esito('SP-1', 'ACCEPTED')->>'stato', 'pagato');
reset role;
select pagato_il as pagato_prima from pagamenti_satispay where satispay_id = 'SP-1' \gset
select pg_sleep(0.01);
set role service_role;
select atteso('ACCEPTED una seconda volta: resta pagato', satispay_esito('SP-1', 'ACCEPTED')->>'stato', 'pagato');
reset role;
select atteso('e pagato_il non cambia', (select pagato_il::text from pagamenti_satispay where satispay_id = 'SP-1'), :'pagato_prima');
select atteso('una sola riga pagata', (select count(*)::text from pagamenti_satispay where stato = 'pagato'), '1');
set role service_role;
select atteso('CANCELED dopo ACCEPTED: resta pagato', satispay_esito('SP-1', 'CANCELED')->>'stato', 'pagato');
select atteso('prepara dopo il pagamento: pagato, con l''importo',
  (satispay_prepara('eeeeeeee-0000-0000-0000-000000000001')->>'stato') || ' ' || (satispay_prepara('eeeeeeee-0000-0000-0000-000000000001')->>'importo'), 'pagato 45000');
reset role;
select atteso('e nessuna riga nuova', (select count(*)::text from pagamenti_satispay where richiesta_id = 'eeeeeeee-0000-0000-0000-000000000001'), '1');

set role service_role;
select atteso('un id che Satispay non ha dato a noi: errore', (rifiuto($$select satispay_esito('SP-ignoto', 'ACCEPTED')$$) <> 'nessun errore')::text, 'true');
reset role;
select atteso('e niente scritto', (select count(*)::text from pagamenti_satispay where stato = 'pagato' or satispay_id = 'SP-ignoto'), '1');

set role service_role;
select satispay_prepara('eeeeeeee-0000-0000-0000-000000000002') as sara \gset
select satispay_creato((:'sara'::jsonb->>'id')::uuid, 'SP-2', 'https://online.satispay.com/pay/SP-2');
select atteso('CANCELED in attesa: non andato', satispay_esito('SP-2', 'CANCELED')->>'stato', 'non-andato');
select satispay_prepara('eeeeeeee-0000-0000-0000-000000000002') as sara_ancora \gset
select atteso('dopo un pagamento non andato: una riga nuova, in attesa',
  ((:'sara_ancora'::jsonb->>'id') <> (:'sara'::jsonb->>'id'))::text || ' ' || (:'sara_ancora'::jsonb->>'stato'), 'true attesa');
reset role;
select atteso('satispay_stato: quello in attesa, non quello andato male', satispay_stato('eeeeeeee-0000-0000-0000-000000000002')->>'stato', 'attesa');
select atteso('satispay_stato: Paolo è pagato', satispay_stato('eeeeeeee-0000-0000-0000-000000000001')->>'stato', 'pagato');
select atteso('satispay_stato: senza pagamenti, niente', coalesce(satispay_stato('eeeeeeee-0000-0000-0000-000000000003')::text, 'niente'), 'niente');
reset role;
select atteso('Sara ha due righe: una non andata, una in attesa',
  (select string_agg(stato, ', ' order by creato_il, stato) from pagamenti_satispay where richiesta_id = 'eeeeeeee-0000-0000-0000-000000000002'), 'non-andato, attesa');
select atteso('due righe in attesa per la stessa richiesta: il database non le tiene',
  tenta($$insert into pagamenti_satispay (richiesta_id, chi, importo, stato) values ('eeeeeeee-0000-0000-0000-000000000002', 'Verdi Sara', 20000, 'attesa')$$), 'NEGATO: …');

\echo ''
\echo '--- 4. chi non è la Edge Function non tocca niente ---'
select chi('');
set role anon;
select atteso('anon: importo_iscrizione no', tenta($$select importo_iscrizione('eeeeeeee-0000-0000-0000-000000000001', '2026-10-20')::text$$), 'NEGATO: …');
select atteso('anon: satispay_prepara no', tenta($$select satispay_prepara('eeeeeeee-0000-0000-0000-000000000003')::text$$), 'NEGATO: …');
select atteso('anon: satispay_stato no', tenta($$select satispay_stato('eeeeeeee-0000-0000-0000-000000000001')::text$$), 'NEGATO: …');
select atteso('anon: satispay_creato no', tenta($$select satispay_creato(gen_random_uuid(), 'SP-x', 'x')::text$$), 'NEGATO: …');
select atteso('anon: satispay_esito no', tenta($$select satispay_esito('SP-2', 'ACCEPTED')::text$$), 'NEGATO: …');
select atteso('anon: la tabella non la vede', tenta('select count(*)::text from pagamenti_satispay'), 'NEGATO: …');
select atteso('anon: non scrive', non_scrive($$insert into pagamenti_satispay (chi, importo, stato) values ('X', 100, 'pagato')$$), 'non scrive');
reset role;

select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('segreteria: importo_iscrizione no', tenta($$select importo_iscrizione('eeeeeeee-0000-0000-0000-000000000001', '2026-10-20')::text$$), 'NEGATO: …');
select atteso('segreteria: satispay_prepara no', tenta($$select satispay_prepara('eeeeeeee-0000-0000-0000-000000000003')::text$$), 'NEGATO: …');
select atteso('segreteria: satispay_creato no', tenta($$select satispay_creato(gen_random_uuid(), 'SP-x', 'x')::text$$), 'NEGATO: …');
select atteso('segreteria: satispay_esito no', tenta($$select satispay_esito('SP-2', 'ACCEPTED')::text$$), 'NEGATO: …');
select atteso('segreteria: vede i pagamenti', tenta('select count(*)::text from pagamenti_satispay'), '3');
select atteso('segreteria: non inserisce', non_scrive($$insert into pagamenti_satispay (chi, importo, stato) values ('X', 100, 'pagato')$$), 'non scrive');
select atteso('segreteria: non segna pagato a mano', non_scrive($$update pagamenti_satispay set stato = 'pagato'$$), 'non scrive');
select atteso('segreteria: non cancella', non_scrive($$delete from pagamenti_satispay$$), 'non scrive');
reset role;
select atteso('e i pagamenti sono quelli di prima', (select string_agg(stato, ',' order by stato) from pagamenti_satispay), 'attesa,non-andato,pagato');

select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('istruttore: non vede i pagamenti', (tenta('select count(*)::text from pagamenti_satispay') ~ '^(0|NEGATO)')::text, 'true');
select atteso('istruttore: satispay_esito no', tenta($$select satispay_esito('SP-2', 'ACCEPTED')::text$$), 'NEGATO: …');
select atteso('istruttore: non scrive', non_scrive($$update pagamenti_satispay set stato = 'pagato'$$), 'non scrive');
reset role;

select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('iscritto: non vede i pagamenti', (tenta('select count(*)::text from pagamenti_satispay') ~ '^(0|NEGATO)')::text, 'true');
select atteso('iscritto: non inserisce', non_scrive($$insert into pagamenti_satispay (chi, importo, stato) values ('X', 100, 'pagato')$$), 'non scrive');
reset role;

\echo ''
\echo '--- 5. la richiesta se ne va, il pagamento resta ---'
delete from richieste_iscrizione where id = 'eeeeeeee-0000-0000-0000-000000000002';
select atteso('i pagamenti di Sara restano, col suo nome',
  (select count(*)::text || ' ' || min(chi) from pagamenti_satispay where richiesta_id is null), '2 Verdi Sara');

\echo ''
\echo '--- 6. il pagamento entra in una ricevuta, una volta ---'
-- Paolo è accolto: la sua richiesta porta alla sua scheda.
update richieste_iscrizione set stato = 'accolta', persona_id = 'aaaaaaaa-0000-0000-0000-000000000005'
  where id = 'eeeeeeee-0000-0000-0000-000000000001';
select id as pagato_paolo from pagamenti_satispay where satispay_id = 'SP-1' \gset
set role service_role;
select satispay_prepara('eeeeeeee-0000-0000-0000-000000000003') as gino \gset
reset role;

select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('istruttore: non la emette',
  tenta(format($$select emetti_ricevuta_satispay(%L::jsonb, %L::uuid)::text$$, ricevuta_satispay('aaaaaaaa-0000-0000-0000-000000000005'), :'pagato_paolo')), 'NEGATO: …');
reset role;

select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('un pagamento non ancora pagato: no',
  tenta(format($$select emetti_ricevuta_satispay(%L::jsonb, %L::uuid)::text$$, ricevuta_satispay('aaaaaaaa-0000-0000-0000-000000000005'), :'gino'::jsonb->>'id')), 'NEGATO: …');
select atteso('Satispay nella ricevuta per 400 € invece di 450 €: no',
  tenta(format($$select emetti_ricevuta_satispay(%L::jsonb, %L::uuid)::text$$, ricevuta_satispay('aaaaaaaa-0000-0000-0000-000000000005', 0, 40000), :'pagato_paolo')), 'NEGATO: …');
select atteso('la ricevuta per un''altra persona: no',
  tenta(format($$select emetti_ricevuta_satispay(%L::jsonb, %L::uuid)::text$$, ricevuta_satispay('aaaaaaaa-0000-0000-0000-000000000006'), :'pagato_paolo')), 'NEGATO: …');
select atteso('e nessuna ricevuta fatta', (select count(*)::text from ricevute), '0');
select emetti_ricevuta_satispay(ricevuta_satispay('aaaaaaaa-0000-0000-0000-000000000005'), :'pagato_paolo') as fatta \gset
select atteso('la ricevuta giusta: fatta, col totale pagato', (:'fatta'::jsonb->>'pagato'), '45000');
select atteso('il pagamento sa in quale ricevuta è entrato',
  (select ricevuta_id::text from pagamenti_satispay where id = :'pagato_paolo'), :'fatta'::jsonb->>'id');
select atteso('una seconda volta: no',
  tenta(format($$select emetti_ricevuta_satispay(%L::jsonb, %L::uuid)::text$$, ricevuta_satispay('aaaaaaaa-0000-0000-0000-000000000005'), :'pagato_paolo')), 'NEGATO: …');
select atteso('e la ricevuta resta una', (select count(*)::text from ricevute), '1');
reset role;

\echo ''
\echo 'Satispay: tutto a posto.'
