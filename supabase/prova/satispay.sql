-- Satispay nel modulo di iscrizione: l'importo lo calcola il database dal
-- listino, un pagamento per richiesta (mai due in attesa), lo stato lo scrive
-- solo la Edge Function (service_role), e un pagamento arrivato entra in una
-- ricevuta una volta sola, con l'importo giusto.
-- Dalla sezione 8, prima paghi e poi mandi (83-satispay-prima.sql): il
-- pagamento nasce dal corso e dalla formula, senza richiesta, e la richiesta
-- lo prende con sé solo se è pagato, suo e libero.
-- Si lancia dopo finto-supabase.sql e i file dello schema, fino a 83-satispay-prima.sql.
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
  ('cccccccc-0000-0000-0000-000000000003', 'Corso nuovo'),
  ('cccccccc-0000-0000-0000-000000000004', 'Pesi');

-- Il listino in euro, come lo salva LISTINO. «Corso nuovo» non c'è: è senza prezzo.
update impostazioni set listino = '{
  "quota": 50, "saldoEntro": "2026-08-31", "offerte": [],
  "corsi": [
    {"corso": "Judo 3", "corsoId": "cccccccc-0000-0000-0000-000000000001", "eta": "", "orari": [], "prezzi": [{"saldo": 350, "annuale": 400, "trimestre": 150}]},
    {"corso": "Lotta 3", "corsoId": "cccccccc-0000-0000-0000-000000000002", "eta": "", "orari": [], "prezzi": [{"annuale": 368, "trimestre": 140}]},
    {"corso": "Pesi", "corsoId": "cccccccc-0000-0000-0000-000000000004", "eta": "", "orari": [], "prezzi": [{"etichetta": "1 GIORNO", "annuale": 340}, {"etichetta": "2 GIORNI", "annuale": 450}]}
  ]}' where id;

-- Le richieste, come le lascia invia_iscrizione().
create or replace function richiesta(id uuid, nome text, cognome text, corsi uuid[], formula text, stato text default 'nuova') returns void language sql as $$
  insert into richieste_iscrizione (id, nome, cognome, nato_il, nato_a, codice_fiscale, indirizzo, cap, comune, email, telefono, corsi, formula, stato)
  values (id, nome, cognome, '1990-01-01', 'Torino', 'XXXYYY90A01L219Z', 'via Roma 1', '10093', 'Collegno', 'prova@ods.it', '3331234567', corsi, formula, stato::stato_richiesta)
$$;
select richiesta('eeeeeeee-0000-0000-0000-000000000001', 'Paolo', 'Bianchi', array['cccccccc-0000-0000-0000-000000000001']::uuid[], 'annuale');
select richiesta('eeeeeeee-0000-0000-0000-000000000002', 'Sara', 'Verdi', array['cccccccc-0000-0000-0000-000000000001']::uuid[], 'trimestre');
select richiesta('eeeeeeee-0000-0000-0000-000000000003', 'Gino', 'Neri', array['cccccccc-0000-0000-0000-000000000002']::uuid[], 'annuale');
select richiesta('eeeeeeee-0000-0000-0000-000000000007', 'Teo', 'Due', array['cccccccc-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000002']::uuid[], 'annuale');
select richiesta('eeeeeeee-0000-0000-0000-000000000008', 'Pia', 'Pesi', array['cccccccc-0000-0000-0000-000000000004']::uuid[], 'annuale');
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
select atteso('un corso a riga sola: quota + annuale (Lotta 3, 368 €)',
  importo_iscrizione('eeeeeeee-0000-0000-0000-000000000003', '2026-10-20')::text, (5000 + 36800)::text);
-- Solo i casi semplici (decisione del 2026-10-20): con più corsi valgono le offerte, con più righe i giorni; li conferma la segreteria.
select atteso('due corsi: nessun importo, lo conferma la segreteria',
  coalesce(importo_iscrizione('eeeeeeee-0000-0000-0000-000000000007', '2026-10-20')::text, 'null'), 'null');
select atteso('un corso con più righe di prezzo: nessun importo',
  coalesce(importo_iscrizione('eeeeeeee-0000-0000-0000-000000000008', '2026-10-20')::text, 'null'), 'null');
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
    {"corso": "Lotta 3", "corsoId": "cccccccc-0000-0000-0000-000000000002", "eta": "", "orari": [], "prezzi": [{"annuale": 368, "trimestre": 140}]},
    {"corso": "Pesi", "corsoId": "cccccccc-0000-0000-0000-000000000004", "eta": "", "orari": [], "prezzi": [{"etichetta": "1 GIORNO", "annuale": 340}, {"etichetta": "2 GIORNI", "annuale": 450}]}
  ]}' where id;

\echo ''
\echo '--- 2. satispay_prepara: un pagamento per richiesta ---'
set role service_role;
select atteso('una richiesta che non c''è',
  tenta($$select satispay_prepara('eeeeeeee-0000-0000-0000-0000000000ff')::text$$), 'NEGATO: Questa richiesta non si può più pagare online: scrivi alla segreteria');
select atteso('una richiesta già accolta',
  tenta($$select satispay_prepara('eeeeeeee-0000-0000-0000-000000000005')::text$$), 'NEGATO: Questa richiesta non si può più pagare online: scrivi alla segreteria');
select atteso('una richiesta rifiutata',
  tenta($$select satispay_prepara('eeeeeeee-0000-0000-0000-000000000006')::text$$), 'NEGATO: Questa richiesta non si può più pagare online: scrivi alla segreteria');
select atteso('un corso senza prezzo: col bonifico',
  tenta($$select satispay_prepara('eeeeeeee-0000-0000-0000-000000000004')::text$$), 'NEGATO: Un corso non ha ancora il prezzo: paga col bonifico');
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
select satispay_creato((:'sara_ancora'::jsonb->>'id')::uuid, 'SP-4', 'https://online.satispay.com/pay/SP-4');
select satispay_creato((:'sara_ancora'::jsonb->>'id')::uuid, 'SP-falso', 'https://altrove');
select atteso('satispay_creato una seconda volta non riscrive id e link',
  (select satispay_id || ' ' || link from pagamenti_satispay where id = (:'sara_ancora'::jsonb->>'id')::uuid), 'SP-4 https://online.satispay.com/pay/SP-4');
select atteso('satispay_stato: quello in attesa, non quello andato male', satispay_stato('eeeeeeee-0000-0000-0000-000000000002')->>'stato', 'attesa');
select atteso('satispay_stato: Paolo è pagato', satispay_stato('eeeeeeee-0000-0000-0000-000000000001')->>'stato', 'pagato');
select atteso('satispay_stato: senza pagamenti, niente', coalesce(satispay_stato('eeeeeeee-0000-0000-0000-000000000003')::text, 'niente'), 'niente');
reset role;
set role service_role;
select atteso('ACCEPTED dopo CANCELED: errore che si vede, non un pagato in silenzio', (rifiuto($$select satispay_esito('SP-2', 'ACCEPTED')$$) <> 'nessun errore')::text, 'true');
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
select atteso('Satispay nella ricevuta per 500 € su 450 arrivati: no',
  tenta(format($$select emetti_ricevuta_satispay(%L::jsonb, %L::uuid)::text$$, ricevuta_satispay('aaaaaaaa-0000-0000-0000-000000000005', 5000, 45000), :'pagato_paolo')), 'NEGATO: …');
select atteso('400 € Satispay e 50 € in contanti su 450 arrivati: no',
  tenta(format($$select emetti_ricevuta_satispay(%L::jsonb, %L::uuid)::text$$,
    jsonb_set(ricevuta_satispay('aaaaaaaa-0000-0000-0000-000000000005', 5000, 40000), '{voci,0,pagamenti,0,metodo}', '"Contanti"'), :'pagato_paolo')), 'NEGATO: …');
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
\echo '--- 7. la ricevuta annullata e la richiesta cancellata non bloccano i soldi ---'
select atteso('accolta: il pagamento sa di quale scheda è',
  (select persona_id::text from pagamenti_satispay where id = :'pagato_paolo'), 'aaaaaaaa-0000-0000-0000-000000000005');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select annulla_ricevuta((:'fatta'::jsonb->>'id')::uuid);
select emetti_ricevuta_satispay(ricevuta_satispay('aaaaaaaa-0000-0000-0000-000000000005'), :'pagato_paolo') as rifatta \gset
select atteso('ricevuta annullata: il pagamento entra in quella nuova',
  (select ricevuta_id::text from pagamenti_satispay where id = :'pagato_paolo'), :'rifatta'::jsonb->>'id');
reset role;

-- Gino paga, è accolto, e la sua richiesta poi si cancella: i soldi restano suoi.
set role service_role;
select satispay_creato((:'gino'::jsonb->>'id')::uuid, 'SP-3', 'https://online.satispay.com/pay/SP-3');
select satispay_esito('SP-3', 'ACCEPTED');
reset role;
update richieste_iscrizione set stato = 'accolta', persona_id = 'aaaaaaaa-0000-0000-0000-000000000006'
  where id = 'eeeeeeee-0000-0000-0000-000000000003';
delete from richieste_iscrizione where id = 'eeeeeeee-0000-0000-0000-000000000003';
select importo as importo_gino from pagamenti_satispay where satispay_id = 'SP-3' \gset
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('richiesta cancellata: la ricevuta di Gino col suo pagamento si fa lo stesso',
  tenta(format($$select (emetti_ricevuta_satispay(%L::jsonb, %L::uuid)->>'pagato')$$,
    jsonb_build_object('data', '2026-10-20', 'persona_id', 'aaaaaaaa-0000-0000-0000-000000000006',
      'ente', jsonb_build_object('nome', 'Asd Il Centro Judo'), 'intestatario', jsonb_build_object('nome', 'Gino', 'cognome', 'Neri'),
      'voci', jsonb_build_array(jsonb_build_object('descrizione', 'Iscrizione', 'quantita', 1, 'prezzo', :importo_gino,
        'pagamenti', jsonb_build_array(jsonb_build_object('data', '2026-10-20', 'importo', :importo_gino, 'metodo', 'Satispay')))),
      'anticipo', 0),
    (select id from pagamenti_satispay where satispay_id = 'SP-3'))), :'importo_gino');
reset role;

\echo ''
\echo '--- 8. prima paghi: importo_corso, la stessa regola di importo_iscrizione ---'
set role service_role;
select atteso('annuale a saldo: come importo_iscrizione per la stessa scelta',
  importo_corso('cccccccc-0000-0000-0000-000000000001', 'annuale', '2026-08-31')::text,
  importo_iscrizione('eeeeeeee-0000-0000-0000-000000000001', '2026-08-31')::text);
select atteso('annuale a saldo: quota + 350 €',
  importo_corso('cccccccc-0000-0000-0000-000000000001', 'annuale', '2026-08-31')::text, (5000 + 35000)::text);
select atteso('annuale pieno, il giorno dopo: come importo_iscrizione',
  importo_corso('cccccccc-0000-0000-0000-000000000001', 'annuale', '2026-09-01')::text,
  importo_iscrizione('eeeeeeee-0000-0000-0000-000000000001', '2026-09-01')::text);
select atteso('trimestre: quota + 150 €',
  importo_corso('cccccccc-0000-0000-0000-000000000001', 'trimestre', '2026-10-20')::text, (5000 + 15000)::text);
select atteso('un corso a riga sola senza saldo: quota + 368 €',
  importo_corso('cccccccc-0000-0000-0000-000000000002', 'annuale', '2026-08-31')::text, (5000 + 36800)::text);
select atteso('un corso con più righe di prezzo: nessun importo, come importo_iscrizione',
  coalesce(importo_corso('cccccccc-0000-0000-0000-000000000004', 'annuale', '2026-10-20')::text, 'null') || ' '
    || coalesce(importo_iscrizione('eeeeeeee-0000-0000-0000-000000000008', '2026-10-20')::text, 'null'), 'null null');
select atteso('un corso senza prezzo: nessun importo',
  coalesce(importo_corso('cccccccc-0000-0000-0000-000000000003', 'annuale', '2026-10-20')::text, 'null'), 'null');
select atteso('un corso che non c''è: nessun importo',
  coalesce(importo_corso('cccccccc-0000-0000-0000-0000000000ff', 'annuale', '2026-10-20')::text, 'null'), 'null');
reset role;

\echo ''
\echo '--- 9. satispay_prepara_prima: il pagamento nasce senza richiesta ---'
set role service_role;
select satispay_prepara_prima('cccccccc-0000-0000-0000-000000000001', 'annuale', 'Luca', 'Rossi', 'luca.prima@esempio.it') as pa \gset
select atteso('in attesa, con l''importo del database (oggi il saldo è chiuso)',
  (:'pa'::jsonb->>'stato') || ' ' || (:'pa'::jsonb->>'importo'),
  'attesa ' || importo_corso('cccccccc-0000-0000-0000-000000000001', 'annuale', (now() at time zone 'Europe/Rome')::date));
select atteso('ancora senza id e link di Satispay',
  coalesce(:'pa'::jsonb->>'satispay_id', 'null') || ' ' || coalesce(:'pa'::jsonb->>'link', 'null'), 'null null');
reset role;
select atteso('la riga: senza richiesta, con corso, formula, nome, cognome, email',
  (select coalesce(richiesta_id::text, 'senza richiesta') || ' ' || corso_id || ' ' || formula || ' ' || nome || ' ' || cognome || ' ' || email || ' ' || chi
     from pagamenti_satispay where id = (:'pa'::jsonb->>'id')::uuid),
  'senza richiesta cccccccc-0000-0000-0000-000000000001 annuale Luca Rossi luca.prima@esempio.it Rossi Luca');
set role service_role;
select atteso('lo stesso modulo una seconda volta: lo stesso pagamento',
  satispay_prepara_prima('cccccccc-0000-0000-0000-000000000001', 'annuale', 'Luca', 'Rossi', 'luca.prima@esempio.it')->>'id', :'pa'::jsonb->>'id');
select satispay_creato((:'pa'::jsonb->>'id')::uuid, 'SP-P1', 'https://online.satispay.com/pay/SP-P1');
select atteso('dopo satispay_creato torna con l''id e il link di Satispay',
  ((satispay_prepara_prima('cccccccc-0000-0000-0000-000000000001', 'annuale', 'Luca', 'Rossi', 'luca.prima@esempio.it')->>'id') = (:'pa'::jsonb->>'id'))::text
    || ' ' || (satispay_prepara_prima('cccccccc-0000-0000-0000-000000000001', 'annuale', 'Luca', 'Rossi', 'luca.prima@esempio.it')->>'link'),
  'true https://online.satispay.com/pay/SP-P1');
select atteso('stessa scelta, un''altra email: un altro pagamento (mai quello di un altro)',
  ((satispay_prepara_prima('cccccccc-0000-0000-0000-000000000001', 'annuale', 'Luca', 'Rossi', 'altro.luca@esempio.it')->>'id') <> (:'pa'::jsonb->>'id'))::text, 'true');
select atteso('un nome oltre gli 80 caratteri: detto per chi paga',
  tenta(format($$select satispay_prepara_prima('cccccccc-0000-0000-0000-000000000001', 'annuale', %L, 'Rossi', 'luca.prima@esempio.it')::text$$, repeat('L', 81))),
  'NEGATO: Un campo non va: nome e cognome hanno al massimo 80 caratteri');
select atteso('un''altra formula: un altro pagamento',
  ((satispay_prepara_prima('cccccccc-0000-0000-0000-000000000001', 'trimestre', 'Luca', 'Rossi', 'luca.prima@esempio.it')->>'id') <> (:'pa'::jsonb->>'id'))::text, 'true');
select atteso('un corso senza prezzo: col bonifico',
  tenta($$select satispay_prepara_prima('cccccccc-0000-0000-0000-000000000003', 'annuale', 'Luca', 'Rossi', 'luca.prima@esempio.it')::text$$),
  'NEGATO: Un corso non ha ancora il prezzo: paga col bonifico');
select atteso('un corso con più righe di prezzo: col bonifico',
  tenta($$select satispay_prepara_prima('cccccccc-0000-0000-0000-000000000004', 'annuale', 'Luca', 'Rossi', 'luca.prima@esempio.it')::text$$),
  'NEGATO: Un corso non ha ancora il prezzo: paga col bonifico');
select atteso('un corso che non c''è: rifiutato per chi paga',
  rifiuto($$select satispay_prepara_prima('cccccccc-0000-0000-0000-0000000000ff', 'annuale', 'Luca', 'Rossi', 'luca.prima@esempio.it')$$), '22023 …');
select atteso('una formula che non c''è: rifiutata per chi paga',
  rifiuto($$select satispay_prepara_prima('cccccccc-0000-0000-0000-000000000001', 'mensile', 'Luca', 'Rossi', 'luca.prima@esempio.it')$$), '22023 …');
select atteso('senza nome: no',
  tenta($$select satispay_prepara_prima('cccccccc-0000-0000-0000-000000000001', 'annuale', ' ', 'Rossi', 'luca.prima@esempio.it')::text$$), 'NEGATO: …');
-- Annullato in Satispay: si riprova con un pagamento nuovo.
select satispay_prepara_prima('cccccccc-0000-0000-0000-000000000002', 'annuale', 'Gino', 'Neri', 'gino.prima@esempio.it') as pg \gset
select satispay_creato((:'pg'::jsonb->>'id')::uuid, 'SP-P3', 'https://online.satispay.com/pay/SP-P3');
select satispay_esito('SP-P3', 'CANCELED');
select atteso('dopo un pagamento non andato: uno nuovo, in attesa',
  ((satispay_prepara_prima('cccccccc-0000-0000-0000-000000000002', 'annuale', 'Gino', 'Neri', 'gino.prima@esempio.it')->>'id') <> (:'pg'::jsonb->>'id'))::text
    || ' ' || (satispay_prepara_prima('cccccccc-0000-0000-0000-000000000002', 'annuale', 'Gino', 'Neri', 'gino.prima@esempio.it')->>'stato'), 'true attesa');
reset role;

\echo ''
\echo '--- 10. invia_iscrizione col pagamento: solo se è pagato, suo e libero ---'
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
select count(*) as richieste_prima from richieste_iscrizione \gset

select atteso('un pagamento ancora in attesa: no', manda_con(:'pa'::jsonb->>'id'), '22023 Il pagamento Satispay non è ancora arrivato: conferma in Satispay e riprova');
select atteso('e nessuna richiesta entrata', (select count(*) from richieste_iscrizione)::text, :'richieste_prima');
set role service_role;
select atteso('Satispay lo conferma', satispay_esito('SP-P1', 'ACCEPTED')->>'stato', 'pagato');
reset role;
select atteso('pagato, ma per la formula trimestre: no', manda_con(:'pa'::jsonb->>'id', '{"formula": "trimestre"}'), '22023 Il pagamento Satispay era per un altro corso o un’altra formula: rimetti la scelta di prima, o chiama la segreteria');
select atteso('pagato, ma per un altro corso: no',
  manda_con(:'pa'::jsonb->>'id', '{"corsi": ["cccccccc-0000-0000-0000-000000000002"]}'), '22023 …');
select atteso('pagato per un corso, e la richiesta ne ha due: no',
  manda_con(:'pa'::jsonb->>'id', '{"corsi": ["cccccccc-0000-0000-0000-000000000001", "cccccccc-0000-0000-0000-000000000002"]}'), '22023 …');
select atteso('un pagamento che non c''è: no', manda_con('dddddddd-0000-0000-0000-0000000000ff'), '22023 Questo pagamento Satispay non vale più: paga di nuovo in fondo al modulo');
select atteso('un pagamento del flusso vecchio, già della sua richiesta: no', manda_con(:'pagato_paolo'), '22023 …');
select atteso('e ancora nessuna richiesta entrata', (select count(*) from richieste_iscrizione)::text, :'richieste_prima');
select atteso('e il pagamento ancora libero', (select coalesce(richiesta_id::text, 'libero') from pagamenti_satispay where id = (:'pa'::jsonb->>'id')::uuid), 'libero');

select atteso('pagato, a nome e email di un altro (chi ha trovato l''id): no',
  manda_con(:'pa'::jsonb->>'id', jsonb_build_object('nome', 'Gino', 'cognome', 'Neri', 'codice_fiscale', cf_prova('NREGNI', (current_date - interval '30 years')::date))),
  '22023 Il pagamento Satispay è a un altro nome o un’altra email: rimetti quelli di prima, o chiama la segreteria');
select atteso('pagato, stessi nome e cognome ma un''altra email: no',
  manda_con(:'pa'::jsonb->>'id'), '22023 Il pagamento Satispay è a un altro nome o un’altra email: rimetti quelli di prima, o chiama la segreteria');
select atteso('e ancora nessuna richiesta entrata, dopo gli altri nomi', (select count(*) from richieste_iscrizione)::text, :'richieste_prima');
select atteso('pagato, stesso corso, formula, nome ed email: la richiesta entra', manda_con(:'pa'::jsonb->>'id', '{"email": "Luca.Prima@esempio.it "}'), 'nessun errore');
select id as nuova from richieste_iscrizione where email = 'luca.prima@esempio.it' \gset
select atteso('e il pagamento è collegato a lei',
  (select richiesta_id::text from pagamenti_satispay where id = (:'pa'::jsonb->>'id')::uuid), :'nuova');
select atteso('satispay_stato della richiesta: pagata, come dopo la conferma di oggi',
  satispay_stato(:'nuova')->>'stato', 'pagato');
select atteso('lo stesso pagamento una seconda volta, un''altra email: no', manda_con(:'pa'::jsonb->>'id'), '22023 Questo pagamento Satispay non vale più: paga di nuovo in fondo al modulo');
select atteso('la risposta si è persa e si rimanda lo stesso: nessun errore', manda_con(:'pa'::jsonb->>'id', '{"email": "luca.prima@esempio.it"}'), 'nessun errore');
select atteso('e le richieste entrate sono una', (select count(*) - :richieste_prima from richieste_iscrizione)::text, '1');
select atteso('il pagamento ha l''ora in cui è stato preso', (select (preso_il is not null)::text from pagamenti_satispay where id = (:'pa'::jsonb->>'id')::uuid), 'true');
set role service_role;
select atteso('satispay_stato_pagamento lo dice collegato', satispay_stato_pagamento((:'pa'::jsonb->>'id')::uuid)->>'collegato', 'true');
reset role;
-- La segreteria cancella la richiesta (anche dopo averne fatto la ricevuta): il pagamento torna senza richiesta, ma è già stato preso.
delete from richieste_iscrizione where id = :'nuova';
select atteso('cancellata la richiesta: il pagamento resta, senza richiesta', (select coalesce(richiesta_id::text, 'senza richiesta') from pagamenti_satispay where id = (:'pa'::jsonb->>'id')::uuid), 'senza richiesta');
select atteso('e non si riusa, nemmeno da chi l''ha pagato', manda_con(:'pa'::jsonb->>'id', '{"email": "luca.prima@esempio.it"}'), '22023 Questo pagamento Satispay non vale più: paga di nuovo in fondo al modulo');
set role service_role;
select atteso('e prepara non lo ripropone: se ne fa uno nuovo',
  ((satispay_prepara_prima('cccccccc-0000-0000-0000-000000000001', 'annuale', 'Luca', 'Rossi', 'luca.prima@esempio.it')->>'id') <> (:'pa'::jsonb->>'id'))::text, 'true');
reset role;

\echo ''
\echo '--- 11. senza pagamento: come prima ---'
select chi('');
set role anon;
select invia_iscrizione(modulo()) as senza \gset
reset role;
select atteso('invia_iscrizione senza pagamento: la richiesta entra',
  (select stato::text from richieste_iscrizione where id = :'senza'), 'nuova');
set role service_role;
select atteso('satispay_prepara del flusso vecchio funziona ancora',
  (satispay_prepara(:'senza')->>'stato') || ' ' || (satispay_prepara(:'senza')->>'importo'),
  'attesa ' || importo_iscrizione(:'senza', (now() at time zone 'Europe/Rome')::date));
reset role;
select atteso('e il pagamento vecchio ha la sua richiesta',
  (select count(*)::text from pagamenti_satispay where richiesta_id = :'senza'), '1');

\echo ''
\echo '--- 12. il pagato senza richiesta: lo legge la segreteria, non chi paga ---'
insert into auth.users (id, email) values ('44444444-4444-4444-4444-444444444444', 'ada@ods.it');
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000004', 'Ada', 'Conti', 'amministrazione', 'ada@ods.it', '44444444-4444-4444-4444-444444444444');
set role service_role;
select satispay_prepara_prima('cccccccc-0000-0000-0000-000000000001', 'trimestre', 'Sara', 'Verdi', 'sara.prima@esempio.it') as ps \gset
select satispay_creato((:'ps'::jsonb->>'id')::uuid, 'SP-P2', 'https://online.satispay.com/pay/SP-P2');
select satispay_esito('SP-P2', 'ACCEPTED');
-- Sara ricarica la pagina dopo aver pagato: il modulo riparte e prepara di nuovo.
select atteso('pagato e non ancora preso: prepara lo ritrova pagato, non se ne paga un altro',
  (satispay_prepara_prima('cccccccc-0000-0000-0000-000000000001', 'trimestre', 'Sara', 'Verdi', ' Sara.Prima@esempio.it')->>'id' = :'ps'::jsonb->>'id')::text
    || ' ' || (satispay_prepara_prima('cccccccc-0000-0000-0000-000000000001', 'trimestre', 'Sara', 'Verdi', 'sara.prima@esempio.it')->>'stato'), 'true pagato');
reset role;
-- Chi legge il pagato di Sara, che non ha mandato la richiesta.
create or replace function sara(ps uuid) returns text language sql as $$
  select coalesce((select nome || ' ' || cognome || ' ' || email || ' ' || importo || ' ' || stato || ' ' || coalesce(richiesta_id::text, 'senza richiesta')
    from pagamenti_satispay where id = ps), 'non la vede')
$$;
grant execute on function sara(uuid) to anon, authenticated;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria la vede', tenta(format('select sara(%L)', :'ps'::jsonb->>'id')), 'Sara Verdi sara.prima@esempio.it 20000 pagato senza richiesta');
reset role;
select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('l''amministrazione la vede', tenta(format('select sara(%L)', :'ps'::jsonb->>'id')), 'Sara Verdi sara.prima@esempio.it 20000 pagato senza richiesta');
reset role;
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('un iscritto no', (tenta(format('select sara(%L)', :'ps'::jsonb->>'id')) ~ '^(non la vede|NEGATO)')::text, 'true');
reset role;
select chi('');
set role anon;
select atteso('anon no', (tenta(format('select sara(%L)', :'ps'::jsonb->>'id')) ~ '^(non la vede|NEGATO)')::text, 'true');
reset role;

\echo ''
\echo '--- 13. le funzioni nuove: solo la Edge Function ---'
select chi('');
set role anon;
select atteso('anon: importo_corso no', tenta($$select importo_corso('cccccccc-0000-0000-0000-000000000001', 'annuale', '2026-10-20')::text$$), 'NEGATO: …');
select atteso('anon: satispay_prepara_prima no',
  tenta($$select satispay_prepara_prima('cccccccc-0000-0000-0000-000000000001', 'annuale', 'X', 'Y', 'x@esempio.it')::text$$), 'NEGATO: …');
select atteso('anon: satispay_stato_pagamento no', tenta(format($$select satispay_stato_pagamento(%L)::text$$, :'ps'::jsonb->>'id')), 'NEGATO: …');
select atteso('anon: un pagamento senza richiesta non lo crea',
  non_scrive($$insert into pagamenti_satispay (chi, importo, stato, corso_id, formula, nome, cognome, email) values ('Y X', 100, 'pagato', 'cccccccc-0000-0000-0000-000000000001', 'annuale', 'X', 'Y', 'x@esempio.it')$$), 'non scrive');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('segreteria: importo_corso no', tenta($$select importo_corso('cccccccc-0000-0000-0000-000000000001', 'annuale', '2026-10-20')::text$$), 'NEGATO: …');
select atteso('segreteria: satispay_prepara_prima no',
  tenta($$select satispay_prepara_prima('cccccccc-0000-0000-0000-000000000001', 'annuale', 'X', 'Y', 'x@esempio.it')::text$$), 'NEGATO: …');
select atteso('segreteria: non collega a mano un pagamento',
  non_scrive(format($$update pagamenti_satispay set richiesta_id = %L where id = %L$$, :'senza', :'ps'::jsonb->>'id')), 'non scrive');
reset role;
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('iscritto: satispay_prepara_prima no',
  tenta($$select satispay_prepara_prima('cccccccc-0000-0000-0000-000000000001', 'annuale', 'X', 'Y', 'x@esempio.it')::text$$), 'NEGATO: …');
reset role;
select atteso('e il pagato di Sara resta senza richiesta',
  (select coalesce(richiesta_id::text, 'senza richiesta') from pagamenti_satispay where id = (:'ps'::jsonb->>'id')::uuid), 'senza richiesta');

\echo ''
\echo 'Satispay: tutto a posto.'
