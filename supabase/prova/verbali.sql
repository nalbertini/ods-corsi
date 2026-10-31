-- I verbali delle riunioni dei soci e del direttivo (ASD): li scrive e li legge
-- solo la segreteria; istruttori, iscritti, tablet e anon non vedono niente,
-- nemmeno i PDF nello Storage. Si lancia dopo finto-supabase.sql, i file dello
-- schema e i file dei verbali (supabase/127-verbali.sql e 133-verbali-semplici.sql).
--
-- Lo schema che questa prova si aspetta (lo fissa lei: il file SQL lo segue):
--
--   verbali            id uuid pk · anno int not null (1990..2100) · numero int not null
--                      · unique (anno, numero) · tipo text not null in ('soci','direttivo',
--                      'soci_direttivo','straordinaria','elettiva') · data date not null
--                      · ora_inizio, ora_fine time · luogo text · odg text[] not null default '{}'
--                      · presidente_id, segretario_id → persone on delete set null
--                      · aventi_diritto, presenti, deleghe int (>= 0) · testo text
--                      · stato text not null default 'bozza' in ('bozza','firmato')
--                      · firmato_il date (piena se e solo se stato = 'firmato')
--                      · storico boolean not null default false · creato_il timestamptz
--   verbali_delibere   id · verbale_id → verbali on delete cascade · posizione int
--                      · titolo text not null non vuoto · argomento text not null in ('bilancio',
--                      'elezioni','quote','statuto','sede_affitto','assicurazioni','corsi',
--                      'istruttori','varie','altro') · esito in ('approvata','respinta','rinviata')
--                      · come_votato text · anno_rif int · bilancio_tipo in ('preventivo','consuntivo')
--                      (solo se argomento = 'bilancio') · note text
--   verbali_cariche    id · verbale_id → verbali on delete cascade · carica text not null
--                      · persona_id → persone · dal date · al date (null, o >= dal)
--   verbali_allegati   id · verbale_id → verbali on delete cascade · tipo in ('firmato',
--                      'convocazione','fogli_firme','bilancio','copia_coperta','altro')
--                      · nome text not null · percorso text not null · peso int
--                      · caricato_il · caricato_da → persone · convocazione_inviata_il date
--                      · sostituito_il timestamptz (null = in vigore) · motivo_sostituzione text
--                      (non vuoto se sostituito_il c'è) · un solo 'firmato' in vigore per
--                      verbale (indice unico parziale)
--   verbali_rettifiche id · verbale_id → verbali on delete cascade · data date not null
--                      · motivo text not null · testo text not null · autore_id → persone · creato_il
--   verbali_segretari  persona_id uuid pk → persone
--   bucket Storage `verbali`: privato, solo application/pdf, 20 MB
--   firma_verbale(verbale uuid, data date) returns void
--                      · solo la segreteria · solo da bozza · serve un allegato 'firmato' in vigore
--                      (se no P0001, messaggio in italiano) · data non nel futuro · a senso unico
--   sostituisci_pdf_firmato(verbale uuid, nuovo_allegato uuid, motivo text) returns void
--                      · solo la segreteria · solo su un verbale firmato · motivo non vuoto
--                      · il vecchio firmato resta con sostituito_il e motivo · il nuovo allegato
--                      (già in tabella, caricato con un altro tipo per non violare l'indice)
--                      diventa 'firmato' in vigore · deve essere di quel verbale
--   prossimo_numero_verbale(anno int) returns int · max(numero)+1 per l'anno, 1 se non ce ne sono
--                      · solo la segreteria
--
--   Un firmato non si cambia né si cancella (verbale, delibere, cariche); si aggiungono ancora
--   allegati, rettifiche e si sostituisce il PDF. Le rettifiche nascono solo su un firmato e non
--   si cambiano mai. Gli allegati non si cancellano (solo si sostituisce il firmato), tranne
--   quelli di una bozza. Due delibere «bilancio» dello stesso tipo e anno in un verbale sono un
--   avviso dell'app, non un vincolo del database.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'maura@ods.it'),
  ('33333333-3333-3333-3333-333333333333', 'luca@ods.it'),
  -- Il tablet: un utente senza scheda in `persone`.
  ('66666666-6666-6666-6666-666666666666', 'tablet@ods.it');
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Maura', 'Uno', 'istruttore', 'maura@ods.it', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Luca', 'Rossi', 'iscritto', 'luca@ods.it', '33333333-3333-3333-3333-333333333333'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'Paola', 'Presidente', 'iscritto', null, null),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'Sergio', 'Segretario', 'iscritto', null, null),
  -- Una scheda che poi si cancella: il verbale non deve perdere il suo posto.
  ('aaaaaaaa-0000-0000-0000-000000000006', 'Temp', 'Cancellabile', 'iscritto', null, null);

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
-- Un rifiuto della funzione, col suo codice: una funzione che manca (42883) non vale.
create or replace function rifiuto(sql text) returns text language plpgsql as $$
begin
  execute sql;
  return 'nessun errore';
exception when others then return sqlstate || ' ' || sqlerrm;
end $$;
-- Riuscito o no, senza dire come: un permesso tolto e una riga che l'RLS nasconde valgono lo stesso.
create or replace function riuscito(sql text) returns text language sql as $$
  select case when tenta(sql) like 'FATTO%' then 'sì' else 'no' end
$$;
create or replace function atteso(cosa text, avuto text, voluto text) returns text language plpgsql as $$
begin
  if avuto is distinct from voluto and not (voluto like '%…' and avuto like replace(voluto, '…', '%')) then
    raise exception '% · atteso «%», avuto «%»', cosa, voluto, avuto;
  end if;
  return 'ok  ' || cosa || ' → ' || avuto;
end $$;
grant execute on function tenta(text), rifiuto(text), riuscito(text), atteso(text, text, text), chi(text) to anon, authenticated;


-- I verbali di partenza, scritti dal proprietario: b1 bozza, f1 firmato (col suo PDF).
insert into verbali (id, anno, numero, tipo, data, stato, firmato_il) values
  ('dddddddd-0000-0000-0000-000000000001', 2031, 1, 'direttivo', '2031-02-10', 'bozza', null),
  ('dddddddd-0000-0000-0000-000000000002', 2031, 2, 'soci', '2031-03-12', 'firmato', '2031-03-20');
insert into verbali_delibere (id, verbale_id, posizione, titolo, argomento) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001', 1, 'Quote 2031', 'quote'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-000000000002', 1, 'Approvazione bilancio', 'bilancio');
insert into verbali_cariche (id, verbale_id, carica, persona_id, dal) values
  ('ffffffff-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001', 'Presidente', 'aaaaaaaa-0000-0000-0000-000000000004', '2031-02-10'),
  ('ffffffff-0000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-000000000002', 'Presidente', 'aaaaaaaa-0000-0000-0000-000000000004', '2031-03-12');
insert into verbali_allegati (id, verbale_id, tipo, nome, percorso) values
  ('99999999-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001', 'convocazione', 'convocazione.pdf', 'dddddddd-0000-0000-0000-000000000001' || '/convocazione.pdf'),
  ('99999999-0000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-000000000002', 'firmato', 'firmato.pdf', 'dddddddd-0000-0000-0000-000000000002' || '/firmato.pdf');
insert into verbali_rettifiche (id, verbale_id, data, motivo, testo) values
  ('88888888-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000002', '2031-04-01', 'Errore di battitura', 'Dove si legge «dieci» va letto «undici».');
insert into verbali_segretari (persona_id) values ('aaaaaaaa-0000-0000-0000-000000000005');
insert into storage.buckets (id, name) values ('verbali', 'verbali') on conflict do nothing;
insert into storage.objects (bucket_id, name) values ('verbali', 'dddddddd-0000-0000-0000-000000000002' || '/firmato.pdf');

-- --- 1. accesso: solo la segreteria ---
\echo ''
\echo '--- 1. accesso: solo la segreteria ---'

select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria vede i due verbali', (select count(*)::text from verbali where anno = 2031), '2');
select atteso('e le delibere, le cariche, gli allegati, le rettifiche', (select (select count(*) from verbali_delibere) || ',' || (select count(*) from verbali_cariche) || ',' || (select count(*) from verbali_allegati) || ',' || (select count(*) from verbali_rettifiche)), '2,2,2,1');
select atteso('e i segretari', (select count(*)::text from verbali_segretari), '1');
select atteso('e i PDF nello Storage', (select count(*)::text from storage.objects where bucket_id = 'verbali'), '1');
select atteso('carica un PDF', tenta($$insert into storage.objects (bucket_id, name) values ('verbali', 'dddddddd-0000-0000-0000-000000000001' || '/bozza.pdf')$$), 'FATTO (1 righe)');
select atteso('aggiunge un segretario alla lista', tenta($$insert into verbali_segretari (persona_id) values ('aaaaaaaa-0000-0000-0000-000000000004')$$), 'FATTO (1 righe)');
select atteso('e lo toglie', tenta($$delete from verbali_segretari where persona_id = 'aaaaaaaa-0000-0000-0000-000000000004'$$), 'FATTO (1 righe)');
select atteso('un segretario che non è una persona no', rifiuto($$insert into verbali_segretari (persona_id) values (gen_random_uuid())$$), '23503 …');
reset role;
select atteso('il bucket è privato, solo PDF, 20 MB', (select public || ' ' || file_size_limit || ' ' || allowed_mime_types::text from storage.buckets where id = 'verbali'), 'false 20971520 {application/pdf}');
reset role;

select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('l''istruttore: non vede nessuna riga', (select (select count(*) from verbali) || ',' || (select count(*) from verbali_delibere) || ',' || (select count(*) from verbali_cariche) || ',' || (select count(*) from verbali_allegati) || ',' || (select count(*) from verbali_rettifiche) || ',' || (select count(*) from verbali_segretari)), '0,0,0,0,0,0');
select atteso('l''istruttore: né i PDF nello Storage', (select count(*)::text from storage.objects where bucket_id = 'verbali'), '0');
select atteso('l''istruttore: non crea un verbale', riuscito($$insert into verbali (anno, numero, tipo, data) values (2040, 1, 'soci', '2040-01-01')$$), 'no');
select atteso('l''istruttore: non cambia il verbale', riuscito($$update verbali set luogo = 'x' where id = 'dddddddd-0000-0000-0000-000000000001'$$), 'no');
select atteso('l''istruttore: non lo cancella', riuscito($$delete from verbali where id = 'dddddddd-0000-0000-0000-000000000001'$$), 'no');
select atteso('l''istruttore: non scrive una delibera', riuscito($$insert into verbali_delibere (verbale_id, titolo, argomento) values ('dddddddd-0000-0000-0000-000000000001', 'x', 'altro')$$), 'no');
select atteso('l''istruttore: né una carica', riuscito($$insert into verbali_cariche (verbale_id, carica) values ('dddddddd-0000-0000-0000-000000000001', 'x')$$), 'no');
select atteso('l''istruttore: né un allegato', riuscito($$insert into verbali_allegati (verbale_id, tipo, nome, percorso) values ('dddddddd-0000-0000-0000-000000000001', 'altro', 'x.pdf', 'x')$$), 'no');
select atteso('l''istruttore: né una rettifica', riuscito($$insert into verbali_rettifiche (verbale_id, data, motivo, testo) values ('dddddddd-0000-0000-0000-000000000002', '2031-05-01', 'x', 'x')$$), 'no');
select atteso('l''istruttore: né un segretario', riuscito($$insert into verbali_segretari (persona_id) values ('aaaaaaaa-0000-0000-0000-000000000003')$$), 'no');
select atteso('l''istruttore: non carica un PDF', riuscito($$insert into storage.objects (bucket_id, name) values ('verbali', 'dddddddd-0000-0000-0000-000000000001' || '/x.pdf')$$), 'no');
select atteso('l''istruttore: non firma', rifiuto($$select firma_verbale('dddddddd-0000-0000-0000-000000000001', current_date)$$), '42501 …');
select atteso('l''istruttore: non sostituisce il PDF', rifiuto($$select sostituisci_pdf_firmato('dddddddd-0000-0000-0000-000000000002', '99999999-0000-0000-0000-000000000001', 'x')$$), '42501 …');
select atteso('l''istruttore: non chiede il prossimo numero', rifiuto($$select prossimo_numero_verbale(2031)$$), '42501 …');
reset role;

select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('l''iscritto: non vede nessuna riga', (select (select count(*) from verbali) || ',' || (select count(*) from verbali_delibere) || ',' || (select count(*) from verbali_cariche) || ',' || (select count(*) from verbali_allegati) || ',' || (select count(*) from verbali_rettifiche) || ',' || (select count(*) from verbali_segretari)), '0,0,0,0,0,0');
select atteso('l''iscritto: né i PDF nello Storage', (select count(*)::text from storage.objects where bucket_id = 'verbali'), '0');
select atteso('l''iscritto: non crea un verbale', riuscito($$insert into verbali (anno, numero, tipo, data) values (2040, 1, 'soci', '2040-01-01')$$), 'no');
select atteso('l''iscritto: non cambia il verbale', riuscito($$update verbali set luogo = 'x' where id = 'dddddddd-0000-0000-0000-000000000001'$$), 'no');
select atteso('l''iscritto: non lo cancella', riuscito($$delete from verbali where id = 'dddddddd-0000-0000-0000-000000000001'$$), 'no');
select atteso('l''iscritto: non scrive una delibera', riuscito($$insert into verbali_delibere (verbale_id, titolo, argomento) values ('dddddddd-0000-0000-0000-000000000001', 'x', 'altro')$$), 'no');
select atteso('l''iscritto: né una carica', riuscito($$insert into verbali_cariche (verbale_id, carica) values ('dddddddd-0000-0000-0000-000000000001', 'x')$$), 'no');
select atteso('l''iscritto: né un allegato', riuscito($$insert into verbali_allegati (verbale_id, tipo, nome, percorso) values ('dddddddd-0000-0000-0000-000000000001', 'altro', 'x.pdf', 'x')$$), 'no');
select atteso('l''iscritto: né una rettifica', riuscito($$insert into verbali_rettifiche (verbale_id, data, motivo, testo) values ('dddddddd-0000-0000-0000-000000000002', '2031-05-01', 'x', 'x')$$), 'no');
select atteso('l''iscritto: né un segretario', riuscito($$insert into verbali_segretari (persona_id) values ('aaaaaaaa-0000-0000-0000-000000000003')$$), 'no');
select atteso('l''iscritto: non carica un PDF', riuscito($$insert into storage.objects (bucket_id, name) values ('verbali', 'dddddddd-0000-0000-0000-000000000001' || '/x.pdf')$$), 'no');
select atteso('l''iscritto: non firma', rifiuto($$select firma_verbale('dddddddd-0000-0000-0000-000000000001', current_date)$$), '42501 …');
select atteso('l''iscritto: non sostituisce il PDF', rifiuto($$select sostituisci_pdf_firmato('dddddddd-0000-0000-0000-000000000002', '99999999-0000-0000-0000-000000000001', 'x')$$), '42501 …');
select atteso('l''iscritto: non chiede il prossimo numero', rifiuto($$select prossimo_numero_verbale(2031)$$), '42501 …');
reset role;

select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('il tablet (utente senza scheda): non vede nessuna riga', (select (select count(*) from verbali) || ',' || (select count(*) from verbali_delibere) || ',' || (select count(*) from verbali_cariche) || ',' || (select count(*) from verbali_allegati) || ',' || (select count(*) from verbali_rettifiche) || ',' || (select count(*) from verbali_segretari)), '0,0,0,0,0,0');
select atteso('il tablet (utente senza scheda): né i PDF nello Storage', (select count(*)::text from storage.objects where bucket_id = 'verbali'), '0');
select atteso('il tablet (utente senza scheda): non crea un verbale', riuscito($$insert into verbali (anno, numero, tipo, data) values (2040, 1, 'soci', '2040-01-01')$$), 'no');
select atteso('il tablet (utente senza scheda): non cambia il verbale', riuscito($$update verbali set luogo = 'x' where id = 'dddddddd-0000-0000-0000-000000000001'$$), 'no');
select atteso('il tablet (utente senza scheda): non lo cancella', riuscito($$delete from verbali where id = 'dddddddd-0000-0000-0000-000000000001'$$), 'no');
select atteso('il tablet (utente senza scheda): non scrive una delibera', riuscito($$insert into verbali_delibere (verbale_id, titolo, argomento) values ('dddddddd-0000-0000-0000-000000000001', 'x', 'altro')$$), 'no');
select atteso('il tablet (utente senza scheda): né una carica', riuscito($$insert into verbali_cariche (verbale_id, carica) values ('dddddddd-0000-0000-0000-000000000001', 'x')$$), 'no');
select atteso('il tablet (utente senza scheda): né un allegato', riuscito($$insert into verbali_allegati (verbale_id, tipo, nome, percorso) values ('dddddddd-0000-0000-0000-000000000001', 'altro', 'x.pdf', 'x')$$), 'no');
select atteso('il tablet (utente senza scheda): né una rettifica', riuscito($$insert into verbali_rettifiche (verbale_id, data, motivo, testo) values ('dddddddd-0000-0000-0000-000000000002', '2031-05-01', 'x', 'x')$$), 'no');
select atteso('il tablet (utente senza scheda): né un segretario', riuscito($$insert into verbali_segretari (persona_id) values ('aaaaaaaa-0000-0000-0000-000000000003')$$), 'no');
select atteso('il tablet (utente senza scheda): non carica un PDF', riuscito($$insert into storage.objects (bucket_id, name) values ('verbali', 'dddddddd-0000-0000-0000-000000000001' || '/x.pdf')$$), 'no');
select atteso('il tablet (utente senza scheda): non firma', rifiuto($$select firma_verbale('dddddddd-0000-0000-0000-000000000001', current_date)$$), '42501 …');
select atteso('il tablet (utente senza scheda): non sostituisce il PDF', rifiuto($$select sostituisci_pdf_firmato('dddddddd-0000-0000-0000-000000000002', '99999999-0000-0000-0000-000000000001', 'x')$$), '42501 …');
select atteso('il tablet (utente senza scheda): non chiede il prossimo numero', rifiuto($$select prossimo_numero_verbale(2031)$$), '42501 …');
reset role;

select chi('');
set role anon;
select atteso('anon non legge i verbali', tenta($$select count(*)::text from verbali$$), 'NEGATO: …');
select atteso('né le delibere', tenta($$select count(*)::text from verbali_delibere$$), 'NEGATO: …');
select atteso('né le cariche', tenta($$select count(*)::text from verbali_cariche$$), 'NEGATO: …');
select atteso('né gli allegati', tenta($$select count(*)::text from verbali_allegati$$), 'NEGATO: …');
select atteso('né le rettifiche', tenta($$select count(*)::text from verbali_rettifiche$$), 'NEGATO: …');
select atteso('né i segretari', tenta($$select count(*)::text from verbali_segretari$$), 'NEGATO: …');
select atteso('anon non scrive un verbale', riuscito($$insert into verbali (anno, numero, tipo, data) values (2040, 1, 'soci', '2040-01-01')$$), 'no');
select atteso('né un PDF nello Storage', riuscito($$insert into storage.objects (bucket_id, name) values ('verbali', 'dddddddd-0000-0000-0000-000000000001' || '/x.pdf')$$), 'no');
select atteso('né vede i PDF', (select count(*)::text from storage.objects where bucket_id = 'verbali'), '0');
select atteso('né firma', rifiuto($$select firma_verbale('dddddddd-0000-0000-0000-000000000001', current_date)$$), '42501 …');
select atteso('né sostituisce', rifiuto($$select sostituisci_pdf_firmato('dddddddd-0000-0000-0000-000000000002', '99999999-0000-0000-0000-000000000001', 'x')$$), '42501 …');
select atteso('né chiede il numero', rifiuto($$select prossimo_numero_verbale(2031)$$), '42501 …');
reset role;

-- --- 2. il numero è unico nell'anno ---------------------------------------
\echo ''
\echo '--- 2. numero unico per anno, e il prossimo numero ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('un verbale completo', tenta($$insert into verbali (id, anno, numero, tipo, data, ora_inizio, ora_fine, luogo, odg, presidente_id, segretario_id, aventi_diritto, presenti, deleghe, testo, storico) values ('dddddddd-0000-0000-0000-000000000003', 2032, 1, 'soci_direttivo', '2032-01-15', '18:00', '20:00', 'Sede', array['Bilancio', 'Varie'], 'aaaaaaaa-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000005', 40, 25, 3, 'Si apre la seduta…', true)$$), 'FATTO (1 righe)');
select atteso('nasce in bozza', (select stato || ' ' || coalesce(firmato_il::text, 'senza data') from verbali where id = 'dddddddd-0000-0000-0000-000000000003'), 'bozza senza data');
select atteso('e il testo si cerca', (select count(*)::text from verbali where testo ilike '%seduta%' and anno = 2032), '1');
select atteso('lo stesso numero nello stesso anno no', rifiuto($$insert into verbali (anno, numero, tipo, data) values (2032, 1, 'soci', '2032-02-01')$$), '23505 …');
select atteso('lo stesso numero in un altro anno sì', riuscito($$insert into verbali (anno, numero, tipo, data) values (2033, 1, 'soci', '2033-02-01')$$), 'sì');
select atteso('il prossimo numero di un anno vuoto è 1', prossimo_numero_verbale(2099)::text, '1');
select atteso('il prossimo numero è il massimo più uno', prossimo_numero_verbale(2031)::text, '3');
select atteso('anche con un buco: 2032 ha solo l''1', prossimo_numero_verbale(2032)::text, '2');
select atteso('due numeri sparsi (7 e 3) si scrivono', tenta($$insert into verbali (anno, numero, tipo, data) values (2034, 7, 'soci', '2034-01-01'), (2034, 3, 'soci', '2034-01-01')$$), 'FATTO (2 righe)');
select atteso('con un 7 e un 3, il prossimo è l''8', prossimo_numero_verbale(2034)::text, '8');
reset role;

-- --- 3. la bozza si cambia, il firmato no -----------------------------------
\echo ''
\echo '--- 3. la bozza si cambia e si cancella; il firmato no ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la bozza si cambia', riuscito($$update verbali set luogo = 'Palestra', presenti = 12 where id = 'dddddddd-0000-0000-0000-000000000001'$$), 'sì');
select atteso('anche il testo', riuscito($$update verbali set testo = 'Nuovo testo' where id = 'dddddddd-0000-0000-0000-000000000001'$$), 'sì');
select atteso('una delibera della bozza si cambia', riuscito($$update verbali_delibere set esito = 'respinta' where id = 'eeeeeeee-0000-0000-0000-000000000001'$$), 'sì');
select atteso('una carica della bozza si cambia', riuscito($$update verbali_cariche set carica = 'Vice' where id = 'ffffffff-0000-0000-0000-000000000001'$$), 'sì');
select atteso('una bozza non torna indietro di anno e numero uguali ad altri', rifiuto($$update verbali set anno = 2031, numero = 2 where id = 'dddddddd-0000-0000-0000-000000000001'$$), '23505 …');
-- il firmato
select atteso('il firmato non si cambia', riuscito($$update verbali set luogo = 'Altrove' where id = 'dddddddd-0000-0000-0000-000000000002'$$), 'no');
select atteso('né il testo', riuscito($$update verbali set testo = 'Riscritto' where id = 'dddddddd-0000-0000-0000-000000000002'$$), 'no');
select atteso('né si riporta in bozza', riuscito($$update verbali set stato = 'bozza', firmato_il = null where id = 'dddddddd-0000-0000-0000-000000000002'$$), 'no');
select atteso('né si cambia la data di firma', riuscito($$update verbali set firmato_il = '2031-03-21' where id = 'dddddddd-0000-0000-0000-000000000002'$$), 'no');
select atteso('né si cancella', riuscito($$delete from verbali where id = 'dddddddd-0000-0000-0000-000000000002'$$), 'no');
select atteso('le sue delibere non si cambiano', riuscito($$update verbali_delibere set esito = 'respinta' where id = 'eeeeeeee-0000-0000-0000-000000000002'$$), 'no');
select atteso('né si cancellano', riuscito($$delete from verbali_delibere where id = 'eeeeeeee-0000-0000-0000-000000000002'$$), 'no');
select atteso('le sue cariche non si cambiano', riuscito($$update verbali_cariche set carica = 'Altro' where id = 'ffffffff-0000-0000-0000-000000000002'$$), 'no');
select atteso('né si cancellano', riuscito($$delete from verbali_cariche where id = 'ffffffff-0000-0000-0000-000000000002'$$), 'no');
select atteso('e il verbale è com''era', (select stato || ' ' || firmato_il || ' ' || coalesce(luogo, '-') from verbali where id = 'dddddddd-0000-0000-0000-000000000002'), 'firmato 2031-03-20 -');
-- ma si aggiunge ancora
select atteso('al firmato si aggiunge una convocazione', riuscito($$insert into verbali_allegati (verbale_id, tipo, nome, percorso, convocazione_inviata_il) values ('dddddddd-0000-0000-0000-000000000002', 'convocazione', 'conv.pdf', 'dddddddd-0000-0000-0000-000000000002' || '/conv.pdf', '2031-03-01')$$), 'sì');
select atteso('e un foglio firme', riuscito($$insert into verbali_allegati (verbale_id, tipo, nome, percorso) values ('dddddddd-0000-0000-0000-000000000002', 'fogli_firme', 'fogli.pdf', 'dddddddd-0000-0000-0000-000000000002' || '/fogli.pdf')$$), 'sì');
select atteso('e una rettifica', riuscito($$insert into verbali_rettifiche (verbale_id, data, motivo, testo) values ('dddddddd-0000-0000-0000-000000000002', '2031-05-01', 'Nome sbagliato', 'Dove c''è Rossi leggere Rosso.')$$), 'sì');
select atteso('le rettifiche si leggono', (select count(*)::text from verbali_rettifiche where verbale_id = 'dddddddd-0000-0000-0000-000000000002'), '2');
select atteso('una rettifica non si cambia', riuscito($$update verbali_rettifiche set testo = 'Altro' where id = '88888888-0000-0000-0000-000000000001'$$), 'no');
select atteso('né si cancella', riuscito($$delete from verbali_rettifiche where id = '88888888-0000-0000-0000-000000000001'$$), 'no');
select atteso('e il testo è quello di prima', (select testo from verbali_rettifiche where id = '88888888-0000-0000-0000-000000000001'), 'Dove si legge «dieci» va letto «undici».');
select atteso('una rettifica su una bozza no: non c''è niente da rettificare', riuscito($$insert into verbali_rettifiche (verbale_id, data, motivo, testo) values ('dddddddd-0000-0000-0000-000000000001', '2031-05-01', 'x', 'x')$$), 'no');
-- gli allegati
select atteso('un allegato del firmato non si cancella', riuscito($$delete from verbali_allegati where verbale_id = 'dddddddd-0000-0000-0000-000000000002' and nome = 'conv.pdf'$$), 'no');
select atteso('nemmeno il PDF firmato', riuscito($$delete from verbali_allegati where id = '99999999-0000-0000-0000-000000000002'$$), 'no');
select atteso('un allegato di una bozza si toglie', riuscito($$delete from verbali_allegati where id = '99999999-0000-0000-0000-000000000001'$$), 'sì');
reset role;

-- La bozza che si cancella porta via tutto.
insert into verbali (id, anno, numero, tipo, data) values ('dddddddd-0000-0000-0000-000000000004', 2037, 1, 'soci', '2037-01-01');
insert into verbali_delibere (verbale_id, titolo, argomento) values ('dddddddd-0000-0000-0000-000000000004', 'x', 'altro');
insert into verbali_cariche (verbale_id, carica) values ('dddddddd-0000-0000-0000-000000000004', 'x');
insert into verbali_allegati (verbale_id, tipo, nome, percorso) values ('dddddddd-0000-0000-0000-000000000004', 'altro', 'x.pdf', 'x'), ('dddddddd-0000-0000-0000-000000000004', 'firmato', 'f.pdf', 'x');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la bozza si cancella', riuscito($$delete from verbali where id = 'dddddddd-0000-0000-0000-000000000004'$$), 'sì');
select atteso('con lei delibere, cariche e allegati', (select (select count(*) from verbali_delibere where verbale_id = 'dddddddd-0000-0000-0000-000000000004') || ',' || (select count(*) from verbali_cariche where verbale_id = 'dddddddd-0000-0000-0000-000000000004') || ',' || (select count(*) from verbali_allegati where verbale_id = 'dddddddd-0000-0000-0000-000000000004')), '0,0,0');
reset role;

-- --- 4. firma_verbale --------------------------------------------------------
\echo ''
\echo '--- 4. firma_verbale: serve il PDF firmato, a senso unico ---'
-- Storico: si firma con numero, data, tipo e PDF; i dati veri li chiede solo un verbale nuovo (vedi in fondo).
insert into verbali (id, anno, numero, tipo, data, storico) values ('dddddddd-0000-0000-0000-000000000005', 2038, 1, 'direttivo', '2020-01-10', true);
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('senza il PDF firmato non si firma, e dice perché', rifiuto($$select firma_verbale('dddddddd-0000-0000-0000-000000000005', current_date)$$), 'P0001 …');
select atteso('il messaggio è in italiano e parla del PDF', (select (rifiuto($$select firma_verbale('dddddddd-0000-0000-0000-000000000005', current_date)$$) ilike '%pdf%')::text), 'true');
select atteso('e il verbale resta in bozza', (select stato || ' ' || coalesce(firmato_il::text, '-') from verbali where id = 'dddddddd-0000-0000-0000-000000000005'), 'bozza -');
select atteso('una convocazione non basta', riuscito($$insert into verbali_allegati (verbale_id, tipo, nome, percorso) values ('dddddddd-0000-0000-0000-000000000005', 'convocazione', 'c.pdf', 'x')$$), 'sì');
select atteso('ancora no', rifiuto($$select firma_verbale('dddddddd-0000-0000-0000-000000000005', current_date)$$), 'P0001 …');
reset role;
-- Un PDF firmato già sostituito non è più in vigore.
insert into verbali_allegati (id, verbale_id, tipo, nome, percorso, sostituito_il, motivo_sostituzione) values
  ('99999999-0000-0000-0000-0000000000a1', 'dddddddd-0000-0000-0000-000000000005', 'firmato', 'vecchio.pdf', 'x', now(), 'Scansione illeggibile');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('un PDF firmato sostituito non vale', rifiuto($$select firma_verbale('dddddddd-0000-0000-0000-000000000005', current_date)$$), 'P0001 …');
select atteso('il PDF firmato in vigore sì', riuscito($$insert into verbali_allegati (verbale_id, tipo, nome, percorso) values ('dddddddd-0000-0000-0000-000000000005', 'firmato', 'firmato.pdf', 'dddddddd-0000-0000-0000-000000000005' || '/firmato.pdf')$$), 'sì');
reset role;
-- Non staff, anche con il PDF a posto.
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('l''istruttore non firma', rifiuto($$select firma_verbale('dddddddd-0000-0000-0000-000000000005', current_date)$$), '42501 …');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('rifiutata con un errore, non in silenzio', (rifiuto($$select firma_verbale('dddddddd-0000-0000-0000-000000000005', current_date + 1)$$) = 'nessun errore')::text, 'false');
select atteso('e il verbale è ancora in bozza', (select stato from verbali where id = 'dddddddd-0000-0000-0000-000000000005'), 'bozza');
select atteso('una data dopo la riunione sì', rifiuto($$select firma_verbale('dddddddd-0000-0000-0000-000000000005', '2020-01-11')$$), 'nessun errore');
select atteso('stato e data di firma vanno insieme', (select stato || ' ' || (firmato_il = '2020-01-11')::text from verbali where id = 'dddddddd-0000-0000-0000-000000000005'), 'firmato true');
select atteso('una seconda volta no', (rifiuto($$select firma_verbale('dddddddd-0000-0000-0000-000000000005', current_date)$$) = 'nessun errore')::text, 'false');
select atteso('e la data resta la prima', (select (firmato_il = '2020-01-11')::text from verbali where id = 'dddddddd-0000-0000-0000-000000000005'), 'true');
select atteso('firmato, ora non si cambia più', riuscito($$update verbali set luogo = 'x' where id = 'dddddddd-0000-0000-0000-000000000005'$$), 'no');
select atteso('un verbale che non c''è no', (rifiuto($$select firma_verbale(gen_random_uuid(), current_date)$$) = 'nessun errore')::text, 'false');
reset role;

-- Un verbale nuovo (non storico) è «la riunione» + il PDF firmato: ora, luogo, ordine del giorno,
-- presidente, segretario e presenti stanno nel PDF e non servono per firmare.
insert into verbali (id, anno, numero, tipo, data) values ('dddddddd-0000-0000-0000-000000000009', 2042, 1, 'direttivo', '2020-02-01');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('non storico senza PDF firmato no, e parla del PDF', (rifiuto($$select firma_verbale('dddddddd-0000-0000-0000-000000000009', current_date)$$) ilike '%pdf%')::text, 'true');
reset role;
insert into verbali_allegati (verbale_id, tipo, nome, percorso) values ('dddddddd-0000-0000-0000-000000000009', 'firmato', 'f.pdf', 'x');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('una firma prima della riunione no', (rifiuto($$select firma_verbale('dddddddd-0000-0000-0000-000000000009', '2020-01-31')$$) ilike '%prima della riunione%')::text, 'true');
select atteso('una firma nel futuro no, e lo dice', (rifiuto($$select firma_verbale('dddddddd-0000-0000-0000-000000000009', current_date + 1)$$) ilike '%futuro%')::text, 'true');
select atteso('una firma senza data no, e lo dice', (rifiuto($$select firma_verbale('dddddddd-0000-0000-0000-000000000009', null)$$) ilike '%Scrivi la data della firma%')::text, 'true');
select atteso('il non storico con solo numero, data, tipo e PDF si firma', rifiuto($$select firma_verbale('dddddddd-0000-0000-0000-000000000009', '2020-02-01')$$), 'nessun errore');
select atteso('e risulta firmato con la sua data', (select stato || ' ' || firmato_il from verbali where id = 'dddddddd-0000-0000-0000-000000000009'), 'firmato 2020-02-01');
reset role;

-- --- 5. sostituisci_pdf_firmato ----------------------------------------------
\echo ''
\echo '--- 5. sostituire il PDF firmato: il vecchio resta, con il motivo ---'
-- b6 è una bozza col suo PDF firmato; f1 ('dddddddd-0000-0000-0000-000000000002') è firmato, col PDF 9…02 in vigore.
insert into verbali (id, anno, numero, tipo, data) values ('dddddddd-0000-0000-0000-000000000006', 2039, 1, 'soci', '2039-01-10');
insert into verbali_allegati (id, verbale_id, tipo, nome, percorso) values
  ('99999999-0000-0000-0000-0000000000b1', 'dddddddd-0000-0000-0000-000000000006', 'firmato', 'f.pdf', 'x'),
  ('99999999-0000-0000-0000-0000000000b2', 'dddddddd-0000-0000-0000-000000000006', 'altro', 'n.pdf', 'x'),
  -- Il nuovo PDF del firmato f1: caricato come «altro» per non toccare l'indice del PDF in vigore.
  ('99999999-0000-0000-0000-0000000000c1', 'dddddddd-0000-0000-0000-000000000002', 'altro', 'nuovo.pdf', 'dddddddd-0000-0000-0000-000000000002' || '/nuovo.pdf'),
  -- Un allegato di un altro verbale.
  ('99999999-0000-0000-0000-0000000000d1', 'dddddddd-0000-0000-0000-000000000001', 'altro', 'estraneo.pdf', 'x');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('su una bozza no', (rifiuto($$select sostituisci_pdf_firmato('dddddddd-0000-0000-0000-000000000006', '99999999-0000-0000-0000-0000000000b2', 'Errore')$$) = 'nessun errore')::text, 'false');
select atteso('senza motivo no', (rifiuto($$select sostituisci_pdf_firmato('dddddddd-0000-0000-0000-000000000002', '99999999-0000-0000-0000-0000000000c1', '')$$) = 'nessun errore')::text, 'false');
select atteso('con un motivo di soli spazi no', (rifiuto($$select sostituisci_pdf_firmato('dddddddd-0000-0000-0000-000000000002', '99999999-0000-0000-0000-0000000000c1', '   ')$$) = 'nessun errore')::text, 'false');
select atteso('con motivo null no', (rifiuto($$select sostituisci_pdf_firmato('dddddddd-0000-0000-0000-000000000002', '99999999-0000-0000-0000-0000000000c1', null)$$) = 'nessun errore')::text, 'false');
select atteso('con l''allegato di un altro verbale no', (rifiuto($$select sostituisci_pdf_firmato('dddddddd-0000-0000-0000-000000000002', '99999999-0000-0000-0000-0000000000d1', 'Errore')$$) = 'nessun errore')::text, 'false');
select atteso('con un allegato che non c''è no', (rifiuto($$select sostituisci_pdf_firmato('dddddddd-0000-0000-0000-000000000002', gen_random_uuid(), 'Errore')$$) = 'nessun errore')::text, 'false');
select atteso('dopo tutti i rifiuti il PDF in vigore è sempre il primo', (select string_agg(nome, ',') from verbali_allegati where verbale_id = 'dddddddd-0000-0000-0000-000000000002' and tipo = 'firmato' and sostituito_il is null), 'firmato.pdf');
reset role;
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('l''istruttore non sostituisce', rifiuto($$select sostituisci_pdf_firmato('dddddddd-0000-0000-0000-000000000002', '99999999-0000-0000-0000-0000000000c1', 'Errore')$$), '42501 …');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria sostituisce, con il motivo', rifiuto($$select sostituisci_pdf_firmato('dddddddd-0000-0000-0000-000000000002', '99999999-0000-0000-0000-0000000000c1', 'Mancava la firma in fondo')$$), 'nessun errore');
select atteso('il vecchio resta, con il motivo e la data', (select motivo_sostituzione || ' ' || (sostituito_il is not null)::text from verbali_allegati where id = '99999999-0000-0000-0000-000000000002'), 'Mancava la firma in fondo true');
select atteso('il nuovo è il firmato in vigore', (select tipo || ' ' || coalesce(sostituito_il::text, 'in vigore') from verbali_allegati where id = '99999999-0000-0000-0000-0000000000c1'), 'firmato in vigore');
select atteso('uno solo in vigore', (select count(*)::text from verbali_allegati where verbale_id = 'dddddddd-0000-0000-0000-000000000002' and tipo = 'firmato' and sostituito_il is null), '1');
select atteso('e due firmati in tutto: la storia resta', (select count(*)::text from verbali_allegati where verbale_id = 'dddddddd-0000-0000-0000-000000000002' and tipo = 'firmato'), '2');
select atteso('il verbale è ancora firmato, con la sua data', (select stato || ' ' || firmato_il from verbali where id = 'dddddddd-0000-0000-0000-000000000002'), 'firmato 2031-03-20');
select atteso('si può sostituire ancora: il vecchio di prima resta', (select (rifiuto($$select sostituisci_pdf_firmato('dddddddd-0000-0000-0000-000000000002', '99999999-0000-0000-0000-0000000000c1', 'Ancora')$$) = 'nessun errore')::text), 'true');
reset role;

-- --- 6. chi viene cancellato non porta via il verbale -------------------------
\echo ''
\echo '--- 6. la persona cancellata lascia il verbale al suo posto ---'
insert into verbali (id, anno, numero, tipo, data, presidente_id, segretario_id, stato, firmato_il) values
  ('dddddddd-0000-0000-0000-000000000007', 2040, 1, 'soci', '2040-01-10', 'aaaaaaaa-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000006', 'firmato', '2040-01-20');
insert into verbali_cariche (verbale_id, carica, persona_id) values ('dddddddd-0000-0000-0000-000000000007', 'Consigliere', 'aaaaaaaa-0000-0000-0000-000000000006');
delete from persone where id = 'aaaaaaaa-0000-0000-0000-000000000006';
select atteso('il verbale c''è ancora', (select count(*)::text from verbali where id = 'dddddddd-0000-0000-0000-000000000007'), '1');
select atteso('senza presidente né segretario', (select coalesce(presidente_id::text, '-') || ' ' || coalesce(segretario_id::text, '-') from verbali where id = 'dddddddd-0000-0000-0000-000000000007'), '- -');
select atteso('è ancora firmato', (select stato from verbali where id = 'dddddddd-0000-0000-0000-000000000007'), 'firmato');
select atteso('la carica resta, senza il nome', (select count(*)::text from verbali_cariche where verbale_id = 'dddddddd-0000-0000-0000-000000000007'), '1');

-- --- 7. i vincoli sui valori -----------------------------------------------
\echo ''
\echo '--- 7. i vincoli sui valori ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('un tipo che non c''è no', rifiuto($$insert into verbali (anno, numero, tipo, data) values (2035, 1, 'assemblea', '2035-01-01')$$), '23514 …');
select atteso('tutti i cinque tipi sì', tenta($$insert into verbali (anno, numero, tipo, data) values (2035, 1, 'soci', '2035-01-01'), (2035, 2, 'direttivo', '2035-01-01'), (2035, 3, 'soci_direttivo', '2035-01-01'), (2035, 4, 'straordinaria', '2035-01-01'), (2035, 5, 'elettiva', '2035-01-01')$$), 'FATTO (5 righe)');
select atteso('senza data no', rifiuto($$insert into verbali (anno, numero, tipo, data) values (2035, 6, 'soci', null)$$), '23502 …');
select atteso('l''anno 1989 no', rifiuto($$insert into verbali (anno, numero, tipo, data) values (1989, 1, 'soci', '1989-01-01')$$), '23514 …');
select atteso('l''anno 2101 no', rifiuto($$insert into verbali (anno, numero, tipo, data) values (2101, 1, 'soci', '2101-01-01')$$), '23514 …');
select atteso('l''anno 1990 sì (un verbale storico)', riuscito($$insert into verbali (anno, numero, tipo, data, storico) values (1990, 1, 'soci', '1990-01-01', true)$$), 'sì');
select atteso('presenti negativi no', rifiuto($$insert into verbali (anno, numero, tipo, data, presenti) values (2036, 1, 'soci', '2036-01-01', -1)$$), '23514 …');
select atteso('deleghe negative no', rifiuto($$insert into verbali (anno, numero, tipo, data, deleghe) values (2036, 1, 'soci', '2036-01-01', -1)$$), '23514 …');
select atteso('aventi diritto negativi no', rifiuto($$insert into verbali (anno, numero, tipo, data, aventi_diritto) values (2036, 1, 'soci', '2036-01-01', -5)$$), '23514 …');
select atteso('zero presenti sì', riuscito($$insert into verbali (anno, numero, tipo, data, presenti, deleghe, aventi_diritto) values (2036, 1, 'soci', '2036-01-01', 0, 0, 0)$$), 'sì');
-- Questi tre li ferma il vincolo; la segreteria non arriva nemmeno lì (la policy vuole una bozza), per questo li prova il proprietario.
reset role;
select atteso('firmato_il su una bozza no', rifiuto($$insert into verbali (anno, numero, tipo, data, stato, firmato_il) values (2036, 2, 'soci', '2036-01-01', 'bozza', '2036-01-02')$$), '23514 …');
select atteso('firmato senza data di firma no', rifiuto($$insert into verbali (anno, numero, tipo, data, stato, firmato_il) values (2036, 2, 'soci', '2036-01-01', 'firmato', null)$$), '23514 …');
select atteso('uno stato che non c''è no', rifiuto($$insert into verbali (anno, numero, tipo, data, stato) values (2036, 2, 'soci', '2036-01-01', 'archiviato')$$), '23514 …');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria non crea un verbale già firmato', rifiuto($$insert into verbali (anno, numero, tipo, data, stato, firmato_il) values (2036, 2, 'soci', '2036-01-01', 'firmato', '2036-01-02')$$), '42501 …');
select atteso('un presidente che non è una persona no', rifiuto($$insert into verbali (anno, numero, tipo, data, presidente_id) values (2036, 2, 'soci', '2036-01-01', gen_random_uuid())$$), '23503 …');
select atteso('né un segretario', rifiuto($$insert into verbali (anno, numero, tipo, data, segretario_id) values (2036, 2, 'soci', '2036-01-01', gen_random_uuid())$$), '23503 …');
-- delibere
select atteso('una delibera sul bilancio', riuscito($$insert into verbali_delibere (verbale_id, posizione, titolo, argomento, esito, come_votato, anno_rif, bilancio_tipo) values ('dddddddd-0000-0000-0000-000000000001', 2, 'Consuntivo 2030', 'bilancio', 'approvata', 'all''unanimità', 2030, 'consuntivo')$$), 'sì');
select atteso('tutti i dieci argomenti sì', tenta($$insert into verbali_delibere (verbale_id, titolo, argomento) select 'dddddddd-0000-0000-0000-000000000001', a, a from unnest(array['bilancio','elezioni','quote','statuto','sede_affitto','assicurazioni','corsi','istruttori','varie','altro']) a$$), 'FATTO (10 righe)');
select atteso('un argomento che non c''è no', rifiuto($$insert into verbali_delibere (verbale_id, titolo, argomento) values ('dddddddd-0000-0000-0000-000000000001', 'x', 'sport')$$), '23514 …');
select atteso('un esito che non c''è no', rifiuto($$insert into verbali_delibere (verbale_id, titolo, argomento, esito) values ('dddddddd-0000-0000-0000-000000000001', 'x', 'altro', 'sospesa')$$), '23514 …');
select atteso('gli esiti sì', tenta($$insert into verbali_delibere (verbale_id, titolo, argomento, esito) values ('dddddddd-0000-0000-0000-000000000001', 'a', 'altro', 'approvata'), ('dddddddd-0000-0000-0000-000000000001', 'b', 'altro', 'respinta'), ('dddddddd-0000-0000-0000-000000000001', 'c', 'altro', 'rinviata')$$), 'FATTO (3 righe)');
select atteso('un tipo di bilancio che non c''è no', rifiuto($$insert into verbali_delibere (verbale_id, titolo, argomento, bilancio_tipo) values ('dddddddd-0000-0000-0000-000000000001', 'x', 'bilancio', 'assestamento')$$), '23514 …');
select atteso('il tipo di bilancio su un''altra delibera no', rifiuto($$insert into verbali_delibere (verbale_id, titolo, argomento, bilancio_tipo) values ('dddddddd-0000-0000-0000-000000000001', 'x', 'quote', 'preventivo')$$), '23514 …');
select atteso('titolo vuoto no', rifiuto($$insert into verbali_delibere (verbale_id, titolo, argomento) values ('dddddddd-0000-0000-0000-000000000001', '', 'altro')$$), '23514 …');
select atteso('titolo di soli spazi no', rifiuto($$insert into verbali_delibere (verbale_id, titolo, argomento) values ('dddddddd-0000-0000-0000-000000000001', '   ', 'altro')$$), '23514 …');
select atteso('senza titolo no', rifiuto($$insert into verbali_delibere (verbale_id, titolo, argomento) values ('dddddddd-0000-0000-0000-000000000001', null, 'altro')$$), '23502 …');
select atteso('senza argomento no', rifiuto($$insert into verbali_delibere (verbale_id, titolo) values ('dddddddd-0000-0000-0000-000000000001', 'x')$$), '23502 …');
select atteso('una delibera di un verbale che non c''è no', rifiuto($$insert into verbali_delibere (verbale_id, titolo, argomento) values (gen_random_uuid(), 'x', 'altro')$$), '42501 …');
-- il numero del verbale parte da 1; un firmato non si crea già firmato; le colonne di audit non le sceglie la segreteria
select atteso('numero 0 no', rifiuto($$insert into verbali (anno, numero, tipo, data) values (2050, 0, 'soci', '2050-01-01')$$), '23514 …');
select atteso('un verbale che nasce firmato no', rifiuto($$insert into verbali (anno, numero, tipo, data, stato, firmato_il) values (2050, 1, 'soci', '2050-01-01', 'firmato', '2050-01-02')$$), '42501 …');
select atteso('un allegato già sostituito alla nascita no', rifiuto($$insert into verbali_allegati (verbale_id, tipo, nome, percorso, sostituito_il, motivo_sostituzione) values ('dddddddd-0000-0000-0000-000000000001', 'altro', 'x.pdf', 'x', now(), 'ok')$$), '42501 …');
select atteso('chi ha caricato non lo sceglie la segreteria', rifiuto($$insert into verbali_allegati (verbale_id, tipo, nome, percorso, caricato_da) values ('dddddddd-0000-0000-0000-000000000001', 'altro', 'x.pdf', 'x', 'aaaaaaaa-0000-0000-0000-000000000001')$$), '42501 …');
select atteso('né l''autore di una rettifica', rifiuto($$insert into verbali_rettifiche (verbale_id, data, motivo, testo, autore_id) values ('dddddddd-0000-0000-0000-000000000002', '2031-05-01', 'x', 'x', 'aaaaaaaa-0000-0000-0000-000000000001')$$), '42501 …');
-- 8. due delibere sullo stesso bilancio: l'app avvisa, il database lascia
select atteso('due delibere sul consuntivo 2030 nello stesso verbale: il database le lascia (è un avviso dell''app)', tenta($$insert into verbali_delibere (verbale_id, titolo, argomento, anno_rif, bilancio_tipo) values ('dddddddd-0000-0000-0000-000000000001', 'Consuntivo 2030 bis', 'bilancio', 2030, 'consuntivo')$$), 'FATTO (1 righe)');
select atteso('e ora sono due', (select count(*)::text from verbali_delibere where verbale_id = 'dddddddd-0000-0000-0000-000000000001' and bilancio_tipo = 'consuntivo' and anno_rif = 2030), '2');
-- cariche
select atteso('una carica con le date', riuscito($$insert into verbali_cariche (verbale_id, carica, persona_id, dal, al) values ('dddddddd-0000-0000-0000-000000000001', 'Consigliere', 'aaaaaaaa-0000-0000-0000-000000000003', '2031-02-10', '2034-02-10')$$), 'sì');
select atteso('una carica senza fine sì', riuscito($$insert into verbali_cariche (verbale_id, carica, persona_id, dal) values ('dddddddd-0000-0000-0000-000000000001', 'Tesoriere', 'aaaaaaaa-0000-0000-0000-000000000003', '2031-02-10')$$), 'sì');
select atteso('una carica che finisce nello stesso giorno sì', riuscito($$insert into verbali_cariche (verbale_id, carica, dal, al) values ('dddddddd-0000-0000-0000-000000000001', 'Revisore', '2031-02-10', '2031-02-10')$$), 'sì');
select atteso('AL prima di DAL no', rifiuto($$insert into verbali_cariche (verbale_id, carica, dal, al) values ('dddddddd-0000-0000-0000-000000000001', 'Revisore', '2031-02-10', '2031-02-09')$$), '23514 …');
select atteso('senza nome della carica no', rifiuto($$insert into verbali_cariche (verbale_id, carica) values ('dddddddd-0000-0000-0000-000000000001', null)$$), '23502 …');
select atteso('una persona che non c''è no', rifiuto($$insert into verbali_cariche (verbale_id, carica, persona_id) values ('dddddddd-0000-0000-0000-000000000001', 'Consigliere', gen_random_uuid())$$), '23503 …');
-- allegati
select atteso('un tipo di allegato che non c''è no', rifiuto($$insert into verbali_allegati (verbale_id, tipo, nome, percorso) values ('dddddddd-0000-0000-0000-000000000001', 'foto', 'x.pdf', 'x')$$), '23514 …');
select atteso('senza nome no', rifiuto($$insert into verbali_allegati (verbale_id, tipo, nome, percorso) values ('dddddddd-0000-0000-0000-000000000001', 'altro', null, 'x')$$), '23502 …');
select atteso('senza percorso no', rifiuto($$insert into verbali_allegati (verbale_id, tipo, nome, percorso) values ('dddddddd-0000-0000-0000-000000000001', 'altro', 'x.pdf', null)$$), '23502 …');
select atteso('la convocazione con la data d''invio', riuscito($$insert into verbali_allegati (verbale_id, tipo, nome, percorso, peso, convocazione_inviata_il) values ('dddddddd-0000-0000-0000-000000000001', 'convocazione', 'c2.pdf', 'dddddddd-0000-0000-0000-000000000001' || '/c2.pdf', 1000, '2031-02-01')$$), 'sì');
reset role;
-- un allegato sostituito senza motivo non vale (il proprietario scrive, i vincoli restano)
select atteso('sostituito senza motivo no', rifiuto($$insert into verbali_allegati (verbale_id, tipo, nome, percorso, sostituito_il) values ('dddddddd-0000-0000-0000-000000000001', 'altro', 'x.pdf', 'x', now())$$), '23514 …');
select atteso('sostituito con motivo vuoto no', rifiuto($$insert into verbali_allegati (verbale_id, tipo, nome, percorso, sostituito_il, motivo_sostituzione) values ('dddddddd-0000-0000-0000-000000000001', 'altro', 'x.pdf', 'x', now(), '  ')$$), '23514 …');
insert into verbali (id, anno, numero, tipo, data) values ('dddddddd-0000-0000-0000-000000000008', 2041, 1, 'soci', '2041-01-01');
insert into verbali_allegati (verbale_id, tipo, nome, percorso) values ('dddddddd-0000-0000-0000-000000000008', 'firmato', 'in-vigore.pdf', 'x');
select atteso('un solo PDF firmato in vigore per verbale', rifiuto($$insert into verbali_allegati (verbale_id, tipo, nome, percorso) values ('dddddddd-0000-0000-0000-000000000008', 'firmato', 'secondo.pdf', 'x')$$), '23505 …');
select atteso('uno sostituito accanto a uno in vigore sì', riuscito($$insert into verbali_allegati (verbale_id, tipo, nome, percorso, sostituito_il, motivo_sostituzione) values ('dddddddd-0000-0000-0000-000000000008', 'firmato', 'vecchio.pdf', 'x', now(), 'Pagina mancante')$$), 'sì');
-- rettifiche
select atteso('una rettifica senza motivo no', rifiuto($$insert into verbali_rettifiche (verbale_id, data, testo) values ('dddddddd-0000-0000-0000-000000000002', '2031-05-01', 'x')$$), '23502 …');
select atteso('senza testo no', rifiuto($$insert into verbali_rettifiche (verbale_id, data, motivo) values ('dddddddd-0000-0000-0000-000000000002', '2031-05-01', 'x')$$), '23502 …');
select atteso('senza data no', rifiuto($$insert into verbali_rettifiche (verbale_id, motivo, testo) values ('dddddddd-0000-0000-0000-000000000002', 'x', 'x')$$), '23502 …');

-- --- 9. le funzioni di servizio non si chiamano a mano -------------------------
\echo ''
\echo '--- 9. i trigger dei verbali non li chiama nessuno ---'
select atteso('nessuna funzione di trigger dei verbali è chiamabile da anon o authenticated',
  (select coalesce(string_agg(proname, ', '), 'nessuna') from pg_proc
    where pronamespace = 'public'::regnamespace and prorettype = 'trigger'::regtype and proname like '%verbal%'
      and (has_function_privilege('anon', oid, 'execute') or has_function_privilege('authenticated', oid, 'execute'))), 'nessuna');
select atteso('anon non può chiamare le tre funzioni',
  has_function_privilege('anon', 'firma_verbale(uuid, date)', 'execute')::text || ',' || has_function_privilege('anon', 'sostituisci_pdf_firmato(uuid, uuid, text)', 'execute')::text || ',' || has_function_privilege('anon', 'prossimo_numero_verbale(int)', 'execute')::text, 'false,false,false');
select atteso('authenticated sì (poi è il corpo a chiedere la segreteria)',
  has_function_privilege('authenticated', 'firma_verbale(uuid, date)', 'execute')::text || ',' || has_function_privilege('authenticated', 'sostituisci_pdf_firmato(uuid, uuid, text)', 'execute')::text || ',' || has_function_privilege('authenticated', 'prossimo_numero_verbale(int)', 'execute')::text, 'true,true,true');
select atteso('le tabelle dei verbali non hanno permessi per anon',
  (select count(*)::text from information_schema.role_table_grants where grantee = 'anon' and table_name like 'verbali%'), '0');

\echo ''
\echo 'TUTTO A POSTO'
