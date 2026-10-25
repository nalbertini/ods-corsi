-- Le gare: la segreteria le scrive, l'istruttore le legge (quelle dei suoi corsi
-- e quelle che accompagna), l'iscritto vede solo le sue; senza accesso niente.
-- Si lancia dopo finto-supabase.sql, i file dello schema e il file delle gare
-- (supabase/117-gare.sql).
--
--
-- Lo schema che questa prova si aspetta (lo fissa lei: il file SQL lo segue):
--
--   gare               id uuid pk · nome text not null (non vuoto) · dal date not null
--                      · al date (null, o >= dal) · luogo, indirizzo, organizzatore,
--                      note text · annullata boolean not null default false
--   gare_voci          id uuid pk · gara_id → gare on delete cascade
--                      · voce text not null · importo int not null check (> 0)  [centesimi]
--   gare_accompagnatori  gara_id → gare on delete cascade · persona_id → persone
--                      · pk (gara_id, persona_id)
--   gare_atleti        id uuid pk · gara_id → gare on delete cascade
--                      · persona_id → persone on delete cascade · nota text
--                      · unique (gara_id, persona_id)
--                      · pagato_il date · pagato_importo int · pagato_metodo text
--                      · pagato_voci jsonb  [le voci di quel momento: [{voce, importo}]]
--                      (le quattro colonne pagato_* o tutte vuote o tutte piene)
--   incassa_gara(atleta uuid, metodo text, data date default current_date) returns jsonb
--                      · solo la segreteria · una volta sola per atleta
--                      · scrive pagato_* con il totale delle voci di adesso e quelle
--                        voci, e un pagamento diretto (`registra_pagamento_diretto`,
--                        voce «Gare») per la persona: così entra in CONTABILITÀ
--
--   Chi legge cosa (RLS, nessun accesso ad anon):
--     staff        tutto, e scrive
--     istruttore   le gare di cui accompagna, o in cui c'è un atleta iscritto a un
--                  corso che insegna (`corsi_istruttori`), con voci e atleti; non scrive
--     iscritto     le sue gare (`persona_id = persona_corrente()`) e quelle dei suoi
--                  figli del nucleo (`iscritto_puo_vedere`), con le voci; mai le righe
--                  degli altri atleti
--   Una gara passata (l'ultimo giorno, `coalesce(al, dal)`, è prima di oggi) non si
--   cancella, ma si può annullare. `unisci_persone` (29) lascia una sola riga per
--   gara, e tiene quella pagata.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'maura@ods.it'),
  ('33333333-3333-3333-3333-333333333333', 'luca@ods.it'),
  ('44444444-4444-4444-4444-444444444444', 'piero@ods.it'),
  ('55555555-5555-5555-5555-555555555555', 'gianni@ods.it'),
  ('77777777-7777-7777-7777-777777777777', 'zeno@ods.it'),
  ('88888888-8888-8888-8888-888888888888', 'papa@ods.it'),
  ('99999999-9999-9999-9999-999999999999', 'marco@ods.it'),
  -- Il tablet: un utente senza scheda in `persone`.
  ('66666666-6666-6666-6666-666666666666', 'tablet@ods.it');
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  -- Maura insegna Judo; Piero Pesi; Gianni accompagna e non insegna; Zeno non ha niente a che fare.
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Maura', 'Uno', 'istruttore', 'maura@ods.it', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'Piero', 'Quattro', 'istruttore', 'piero@ods.it', '44444444-4444-4444-4444-444444444444'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'Gianni', 'Cinque', 'istruttore', 'gianni@ods.it', '55555555-5555-5555-5555-555555555555'),
  ('aaaaaaaa-0000-0000-0000-000000000007', 'Zeno', 'Sette', 'istruttore', 'zeno@ods.it', '77777777-7777-7777-7777-777777777777'),
  -- Gli atleti: Luca (Judo), Sara (la figlia del papà), Marco (Pesi).
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Luca', 'Rossi', 'iscritto', 'luca@ods.it', '33333333-3333-3333-3333-333333333333'),
  ('aaaaaaaa-0000-0000-0000-000000000008', 'Paolo', 'Bianchi', 'iscritto', 'papa@ods.it', '88888888-8888-8888-8888-888888888888'),
  ('aaaaaaaa-0000-0000-0000-000000000009', 'Marco', 'Verdi', 'iscritto', 'marco@ods.it', '99999999-9999-9999-9999-999999999999'),
  -- Due schede della stessa persona, per l'unione.
  ('aaaaaaaa-0000-0000-0000-000000000030', 'Teo', 'Doppio', 'iscritto', null, null),
  ('aaaaaaaa-0000-0000-0000-000000000031', 'Teo', 'Doppio', 'iscritto', null, null);
insert into persone (id, nome, cognome, ruolo, nucleo) values
  ('aaaaaaaa-0000-0000-0000-000000000010', 'Sara', 'Bianchi', 'iscritto', 'aaaaaaaa-0000-0000-0000-000000000008');

insert into sale (id, nome) values ('bbbbbbbb-0000-0000-0000-000000000001', 'Tatami');
insert into corsi (id, nome, sala_id, istruttore_id) values
  ('cccccccc-0000-0000-0000-000000000001', 'Judo', 'bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002'),
  ('cccccccc-0000-0000-0000-000000000002', 'Pesi', 'bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000004');
insert into corsi_istruttori (corso_id, persona_id) values
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002'),
  ('cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000004');
insert into iscrizioni (corso_id, persona_id, dal, al) values
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003', '2026-09-14', null),
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000010', '2026-09-14', null),
  ('cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000009', '2026-09-14', null);

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

-- --- 1. la segreteria: i vincoli ------------------------------------------
\echo ''
\echo '--- 1. la segreteria crea una gara, e i vincoli ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('una gara con nome e data', tenta($$insert into gare (id, nome, dal, al, luogo, organizzatore) values ('99990000-0000-0000-0000-000000000001', 'Trofeo Varese', '2026-11-14', '2026-11-15', 'PalaWhirlpool', 'FIJLKAM Lombardia')$$), 'FATTO (1 righe)');
select atteso('compare con 0 atleti', (select count(*)::text from gare_atleti where gara_id = '99990000-0000-0000-0000-000000000001'), '0');
select atteso('e non è annullata', (select annullata::text from gare where id = '99990000-0000-0000-0000-000000000001'), 'false');
select atteso('senza nome no', riuscito($$insert into gare (nome, dal) values ('', '2026-11-14')$$), 'no');
select atteso('un nome di soli spazi no', riuscito($$insert into gare (nome, dal) values ('   ', '2026-11-14')$$), 'no');
select atteso('senza data no', riuscito($$insert into gare (nome, dal) values ('Senza data', null)$$), 'no');
select atteso('AL prima di DAL no', riuscito($$insert into gare (nome, dal, al) values ('Al contrario', '2026-11-15', '2026-11-14')$$), 'no');
select atteso('AL uguale a DAL sì', riuscito($$insert into gare (nome, dal, al) values ('Un giorno', '2026-11-15', '2026-11-15')$$), 'sì');
select atteso('AL vuoto sì: una gara di un giorno', riuscito($$insert into gare (nome, dal) values ('Solo DAL', '2026-11-15')$$), 'sì');
select atteso('una voce con importo', riuscito($$insert into gare_voci (gara_id, voce, importo) values ('99990000-0000-0000-0000-000000000001', 'Iscrizione', 3000)$$), 'sì');
select atteso('altre due voci insieme', tenta($$insert into gare_voci (gara_id, voce, importo) values ('99990000-0000-0000-0000-000000000001', 'Trasferimento in pullman', 1500), ('99990000-0000-0000-0000-000000000001', 'Hotel, una notte', 4500)$$), 'FATTO (2 righe)');
select atteso('una voce a zero no', riuscito($$insert into gare_voci (gara_id, voce, importo) values ('99990000-0000-0000-0000-000000000001', 'Gratis', 0)$$), 'no');
select atteso('una voce in negativo no', riuscito($$insert into gare_voci (gara_id, voce, importo) values ('99990000-0000-0000-0000-000000000001', 'Sconto', -500)$$), 'no');
select atteso('una voce senza nome no', riuscito($$insert into gare_voci (gara_id, voce, importo) values ('99990000-0000-0000-0000-000000000001', '', 500)$$), 'no');
select atteso('il totale a atleta è la somma delle voci', (select sum(importo)::text from gare_voci where gara_id = '99990000-0000-0000-0000-000000000001'), '9000');
reset role;

-- Le altre gare, scritte dal proprietario: Pesi, la passata, due gare di due giorni.
insert into gare (id, nome, dal, al) values
  ('99990000-0000-0000-0000-000000000002', 'Gara Torino', '2026-12-05', null),
  ('99990000-0000-0000-0000-000000000003', 'Gara di settembre', current_date - 30, null),
  -- Finita ieri dopo due giorni: conta l'ultimo giorno, non il primo.
  ('99990000-0000-0000-0000-000000000004', 'Gara di due giorni appena finita', current_date - 2, current_date - 1),
  -- Comincia ieri e finisce domani: è ancora in corso.
  ('99990000-0000-0000-0000-000000000005', 'Gara in corso', current_date - 1, current_date + 1);
insert into gare_voci (gara_id, voce, importo) values ('99990000-0000-0000-0000-000000000002', 'Iscrizione', 2500);
-- Gianni accompagna il Trofeo e non insegna niente.
insert into gare_accompagnatori (gara_id, persona_id) values
  ('99990000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000005');
insert into gare_atleti (id, gara_id, persona_id, nota) values
  ('99991111-0000-0000-0000-000000000001', '99990000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003', '−66 kg'),
  ('99991111-0000-0000-0000-000000000002', '99990000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000010', null),
  ('99991111-0000-0000-0000-000000000003', '99990000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000009', null),
  ('99991111-0000-0000-0000-000000000004', '99990000-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000009', null),
  -- Una gara senza voci, con un atleta (Teo, senza corsi: la vede solo la segreteria): non ha quota.
  ('99991111-0000-0000-0000-000000000005', '99990000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000030', null);

-- --- 2. una gara passata non si cancella -----------------------------------
\echo ''
\echo '--- 2. una gara passata non si cancella, si annulla ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('una gara passata non si cancella', riuscito($$delete from gare where id = '99990000-0000-0000-0000-000000000003'$$), 'no');
select atteso('e resta lì', (select count(*)::text from gare where id = '99990000-0000-0000-0000-000000000003'), '1');
select atteso('finita ieri, cominciata due giorni fa: è passata', riuscito($$delete from gare where id = '99990000-0000-0000-0000-000000000004'$$), 'no');
select atteso('cominciata ieri e finisce domani: è in corso, si cancella', riuscito($$delete from gare where id = '99990000-0000-0000-0000-000000000005'$$), 'sì');
select atteso('con lei se ne vanno i suoi atleti', (select count(*)::text from gare_atleti where id = '99991111-0000-0000-0000-000000000004'), '0');
select atteso('una gara passata si annulla', riuscito($$update gare set annullata = true where id = '99990000-0000-0000-0000-000000000003'$$), 'sì');
select atteso('annullata resta in elenco', (select annullata::text from gare where id = '99990000-0000-0000-0000-000000000003'), 'true');
select atteso('una gara futura si cancella', riuscito($$delete from gare where nome = 'Solo DAL'$$), 'sì');
reset role;

-- --- 4. un atleta una volta sola -------------------------------------------
\echo ''
\echo '--- 4. un atleta una volta sola per gara ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la stessa persona due volte nella stessa gara no', riuscito($$insert into gare_atleti (gara_id, persona_id) values ('99990000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003')$$), 'no');
select atteso('riaggiungerla con «se non c''è già» non duplica', tenta($$insert into gare_atleti (gara_id, persona_id) values ('99990000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003') on conflict (gara_id, persona_id) do nothing$$), 'a vuoto (0 righe)');
select atteso('la stessa persona in un''altra gara sì', riuscito($$insert into gare_atleti (gara_id, persona_id) values ('99990000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000003')$$), 'sì');
select atteso('la segreteria toglie un atleta', riuscito($$delete from gare_atleti where gara_id = '99990000-0000-0000-0000-000000000002' and persona_id = 'aaaaaaaa-0000-0000-0000-000000000003'$$), 'sì');
select atteso('e nell''altra gara Luca c''è ancora', (select count(*)::text from gare_atleti where gara_id = '99990000-0000-0000-0000-000000000001' and persona_id = 'aaaaaaaa-0000-0000-0000-000000000003'), '1');
reset role;

-- --- 5. chi viene archiviato resta ------------------------------------------
\echo ''
\echo '--- 5. chi viene archiviato dopo la gara resta nell''elenco ---'
update persone set attiva = false where id = 'aaaaaaaa-0000-0000-0000-000000000009';
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('l''archiviato resta nella sua gara', (select count(*)::text from gare_atleti where persona_id = 'aaaaaaaa-0000-0000-0000-000000000009'), '1');
reset role;
update persone set attiva = true where id = 'aaaaaaaa-0000-0000-0000-000000000009';

-- --- 16. il pagamento registra importo e voci di quel momento ----------------
\echo ''
\echo '--- 16. incassa: importo e voci di quel momento ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('incassa Luca in contanti', (incassa_gara('99991111-0000-0000-0000-000000000001', 'Contanti', date '2026-10-25'))->>'pagato_importo', '9000');
select atteso('registra importo, metodo e data',
  (select pagato_importo || ' ' || pagato_metodo || ' ' || pagato_il from gare_pagamenti() where id = '99991111-0000-0000-0000-000000000001'), '9000 Contanti 2026-10-25');
select atteso('e le tre voci di adesso', (select jsonb_array_length(pagato_voci)::text from gare_pagamenti() where id = '99991111-0000-0000-0000-000000000001'), '3');
select atteso('entra in CONTABILITÀ come pagamento diretto, voce Gare',
  (select importo || ' ' || voce || ' ' || metodo from pagamenti_diretti where persona_id = 'aaaaaaaa-0000-0000-0000-000000000003'), '9000 Gare Contanti');
-- L'id si legge in un'altra istruzione: dentro la stessa la riga appena scritta non si vede.
select (incassa_gara('99991111-0000-0000-0000-000000000003', 'Contanti', date '2026-10-25'))->>'pagamento_id' as pagamento_id \gset
select atteso('e dice quale pagamento, per farne la ricevuta',
  (select voce from pagamenti_diretti where id = :'pagamento_id'), 'Gare');
reset role;
select atteso('«Gare» è una voce di sistema delle entrate, una sola (le prove della contabilità la saltano per nome)',
  (select string_agg(tipo || ' ' || di_sistema || ' ' || attiva, ', ') from voci_contabili where nome = 'Gare'), 'entrata true true');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('una seconda volta no', rifiuto($$select incassa_gara('99991111-0000-0000-0000-000000000001', 'Contanti')$$), '22023 …');
select atteso('e il pagamento diretto resta uno', (select count(*)::text from pagamenti_diretti where persona_id = 'aaaaaaaa-0000-0000-0000-000000000003'), '1');
select atteso('senza voci la gara non ha quota: non si incassa', rifiuto($$select incassa_gara('99991111-0000-0000-0000-000000000005', 'Contanti')$$), '22023 …');
-- Le voci cambiano: chi ha pagato non cambia.
select atteso('la segreteria cambia l''hotel', riuscito($$update gare_voci set importo = 4000 where voce = 'Hotel, una notte'$$), 'sì');
select atteso('e aggiunge la cena', riuscito($$insert into gare_voci (gara_id, voce, importo) values ('99990000-0000-0000-0000-000000000001', 'Cena', 2000)$$), 'sì');
select atteso('chi ha pagato ha pagato quel che ha pagato',
  (select pagato_importo::text from gare_pagamenti() where id = '99991111-0000-0000-0000-000000000001'), '9000');
select atteso('con le voci di allora (l''hotel a 45 euro)',
  (select (select (v->>'importo') from jsonb_array_elements(pagato_voci) v where v->>'voce' = 'Hotel, una notte') from gare_pagamenti() where id = '99991111-0000-0000-0000-000000000001'), '4500');
select atteso('chi paga dopo paga il totale nuovo', (incassa_gara('99991111-0000-0000-0000-000000000002', 'Bonifico', date '2026-10-24'))->>'pagato_importo', '10500');
select atteso('Sara ha le quattro voci', (select jsonb_array_length(pagato_voci)::text from gare_pagamenti() where id = '99991111-0000-0000-0000-000000000002'), '4');
select atteso('un bonifico entra in CONTABILITÀ col suo metodo', (select metodo from pagamenti_diretti where persona_id = 'aaaaaaaa-0000-0000-0000-000000000010'), 'Bonifico');
-- Il pagamento lo scrive solo `incassa_gara`, che scrive anche CONTABILITÀ: a mano resterebbe fuori dai conti.
select atteso('la segreteria non segna pagato a mano', riuscito($$update gare_atleti set pagato_il = current_date, pagato_importo = 100, pagato_metodo = 'Contanti', pagato_voci = '[]' where id = '99991111-0000-0000-0000-000000000005'$$), 'no');
select atteso('né aggiunge un atleta già pagato', riuscito($$insert into gare_atleti (gara_id, persona_id, pagato_il, pagato_importo, pagato_metodo, pagato_voci) values ('99990000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000003', current_date, 100, 'Contanti', '[]')$$), 'no');
select atteso('la nota sì', riuscito($$update gare_atleti set nota = '−73 kg' where id = '99991111-0000-0000-0000-000000000005'$$), 'sì');
reset role;
-- Chi ha pagato resta nell'elenco: togliendolo, il pagamento in CONTABILITÀ resterebbe senza la sua gara.
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('né si cancella la gara di chi ha pagato', riuscito($$delete from gare where id = '99990000-0000-0000-0000-000000000001'$$), 'no');
select atteso('chi ha pagato non si toglie', riuscito($$delete from gare_atleti where id = '99991111-0000-0000-0000-000000000001'$$), 'no');
reset role;
-- Una gara annullata non si incassa, anche se ha voci e atleti.
insert into gare (id, nome, dal, annullata) values ('99990000-0000-0000-0000-000000000006', 'Gara annullata', current_date + 20, true);
insert into gare_voci (gara_id, voce, importo) values ('99990000-0000-0000-0000-000000000006', 'Iscrizione', 2000);
insert into gare_atleti (id, gara_id, persona_id) values ('99991111-0000-0000-0000-000000000006', '99990000-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000003');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('una gara annullata non si incassa', rifiuto($$select incassa_gara('99991111-0000-0000-0000-000000000006', 'Contanti')$$), '22023 …');
reset role;
delete from gare where id = '99990000-0000-0000-0000-000000000006';

-- --- 10. istruttore e anon -------------------------------------------------
\echo ''
\echo '--- 10. l''istruttore legge e non scrive; anon niente ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('Maura legge la gara dei suoi atleti', (select count(*)::text from gare where nome = 'Trofeo Varese'), '1');
select atteso('non crea una gara', riuscito($$insert into gare (nome, dal) values ('Mia gara', '2026-12-01')$$), 'no');
select atteso('non la cambia', riuscito($$update gare set nome = 'Cambiata' where nome = 'Trofeo Varese'$$), 'no');
select atteso('non la cancella', riuscito($$delete from gare where nome = 'Trofeo Varese'$$), 'no');
select atteso('non cambia le voci', riuscito($$update gare_voci set importo = 1 where voce = 'Iscrizione'$$), 'no');
select atteso('non aggiunge voci', riuscito($$insert into gare_voci (gara_id, voce, importo) values ('99990000-0000-0000-0000-000000000001', 'Mia voce', 100)$$), 'no');
select atteso('non aggiunge atleti', riuscito($$insert into gare_atleti (gara_id, persona_id) values ('99990000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000009')$$), 'no');
select atteso('non toglie atleti', riuscito($$delete from gare_atleti where gara_id = '99990000-0000-0000-0000-000000000001'$$), 'no');
select atteso('non cambia le note', riuscito($$update gare_atleti set nota = 'x' where gara_id = '99990000-0000-0000-0000-000000000001'$$), 'no');
select atteso('non incassa', rifiuto($$select incassa_gara('99991111-0000-0000-0000-000000000002', 'Contanti')$$), '42501 …');
reset role;
select chi('');
set role anon;
select atteso('anon non legge le gare', tenta($$select count(*)::text from gare$$), 'NEGATO: …');
select atteso('né le voci', tenta($$select count(*)::text from gare_voci$$), 'NEGATO: …');
select atteso('né gli atleti', tenta($$select count(*)::text from gare_atleti$$), 'NEGATO: …');
select atteso('né gli accompagnatori', tenta($$select count(*)::text from gare_accompagnatori$$), 'NEGATO: …');
select atteso('anon non scrive una gara', riuscito($$insert into gare (nome, dal) values ('Abusiva', '2026-12-01')$$), 'no');
select atteso('né un atleta', riuscito($$insert into gare_atleti (gara_id, persona_id) values ('99990000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000009')$$), 'no');
select atteso('né incassa', rifiuto($$select incassa_gara('99991111-0000-0000-0000-000000000002', 'Contanti')$$), '42501 …');
reset role;

-- --- 18. chi accompagna, chi insegna ---------------------------------------
\echo ''
\echo '--- 18. l''istruttore legge le gare dei suoi corsi e quelle che accompagna ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('Maura (Judo): la gara dei suoi atleti e basta', (select string_agg(nome, ', ' order by nome) from gare), 'Trofeo Varese');
select atteso('e vede chi ci va', (select count(*)::text from gare_atleti), '2');
select atteso('e le voci', (select count(*)::text from gare_voci), '4');
-- Quanto ha pagato un atleta è affare suo e della segreteria, non dell'istruttore.
select atteso('ma non quanto hanno pagato', tenta($$select pagato_importo::text from gare_atleti limit 1$$), 'NEGATO: …');
select atteso('né come', tenta($$select pagato_metodo from gare_atleti limit 1$$), 'NEGATO: …');
select atteso('né dalla funzione dei pagamenti', (select count(*)::text from gare_pagamenti()), '0');
reset role;
-- Luca e Sara lasciano il Judo ieri: la gara non è più dei suoi atleti.
update iscrizioni set al = current_date - 1 where corso_id = 'cccccccc-0000-0000-0000-000000000001';
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('Maura: chi ha lasciato il Judo non le porta più la gara', (select count(*)::text from gare), '0');
reset role;
update iscrizioni set al = null where corso_id = 'cccccccc-0000-0000-0000-000000000001';
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
reset role;
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('Gianni accompagna: legge la gara anche senza corsi', (select string_agg(nome, ', ' order by nome) from gare), 'Trofeo Varese');
select atteso('e chi ci va', (select count(*)::text from gare_atleti), '2');
select atteso('ma non quanto hanno pagato', tenta($$select pagato_importo::text from gare_atleti limit 1$$), 'NEGATO: …');
reset role;
-- Luca (Judo) va anche a Torino: Piero vede la gara per Marco, ma non Luca.
insert into gare_atleti (gara_id, persona_id) values ('99990000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000003');
select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('Piero (Pesi): solo la gara di Marco', (select string_agg(nome, ', ' order by nome) from gare), 'Gara Torino');
select atteso('e solo i suoi atleti, non Luca che va alla stessa gara', (select count(*)::text from gare_atleti), '1');
reset role;
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('Maura vede Luca anche a Torino, ma non Marco', (select count(*)::text from gare_atleti where gara_id = '99990000-0000-0000-0000-000000000002'), '1');
reset role;
delete from gare_atleti where gara_id = '99990000-0000-0000-0000-000000000002' and persona_id = 'aaaaaaaa-0000-0000-0000-000000000003';
select chi('77777777-7777-7777-7777-777777777777');
set role authenticated;
select atteso('Zeno non insegna né accompagna: nessuna gara', (select count(*)::text from gare), '0');
select atteso('nessun atleta', (select count(*)::text from gare_atleti), '0');
select atteso('nessuna voce', (select count(*)::text from gare_voci), '0');
reset role;
-- Più accompagnatori sulla stessa gara.
insert into gare_accompagnatori (gara_id, persona_id) values ('99990000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000007');
select chi('77777777-7777-7777-7777-777777777777');
set role authenticated;
select atteso('accompagnata anche da Zeno: ora la legge', (select string_agg(nome, ', ' order by nome) from gare), 'Gara Torino');
reset role;
delete from gare_accompagnatori where persona_id = 'aaaaaaaa-0000-0000-0000-000000000007';

-- --- 19. l'iscritto vede le sue gare ---------------------------------------
\echo ''
\echo '--- 19. l''iscritto vede solo le sue gare, non gli altri atleti ---'
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('Luca vede le sue gare', (select string_agg(nome, ', ' order by nome) from gare), 'Trofeo Varese');
select atteso('con le voci', (select count(*)::text from gare_voci where gara_id = '99990000-0000-0000-0000-000000000001'), '4');
select atteso('la riga è solo la sua', (select count(*)::text from gare_atleti), '1');
select atteso('Sara, nella stessa gara, non la vede', (select count(*)::text from gare_atleti where persona_id = 'aaaaaaaa-0000-0000-0000-000000000010'), '0');
select atteso('né le voci di una gara non sua', (select count(*)::text from gare_voci where gara_id = '99990000-0000-0000-0000-000000000002'), '0');
select atteso('vede quanto ha pagato', (select pagato_importo::text from gare_pagamenti() where gara_id = '99990000-0000-0000-0000-000000000001'), '9000');
select atteso('non si segna da pagare', riuscito($$update gare_atleti set pagato_importo = 0 where gara_id = '99990000-0000-0000-0000-000000000001'$$), 'no');
select atteso('non si aggiunge a una gara', riuscito($$insert into gare_atleti (gara_id, persona_id) values ('99990000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000003')$$), 'no');
select atteso('non si toglie', riuscito($$delete from gare_atleti where persona_id = 'aaaaaaaa-0000-0000-0000-000000000003'$$), 'no');
select atteso('non incassa', rifiuto($$select incassa_gara('99991111-0000-0000-0000-000000000001', 'Contanti')$$), '42501 …');
reset role;
select chi('88888888-8888-8888-8888-888888888888');
set role authenticated;
select atteso('il padre vede la gara della figlia', (select string_agg(nome, ', ' order by nome) from gare), 'Trofeo Varese');
select atteso('e solo la riga di lei', (select persona_id::text from gare_atleti), 'aaaaaaaa-0000-0000-0000-000000000010');
reset role;
select chi('99999999-9999-9999-9999-999999999999');
set role authenticated;
select atteso('Marco vede la sua e non il Trofeo', (select string_agg(nome, ', ' order by nome) from gare), 'Gara Torino');
select atteso('una sola riga: la sua', (select count(*)::text from gare_atleti), '1');
reset role;
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('Luca non vede il pagamento di Sara', (select count(*)::text from gare_pagamenti() where persona_id = 'aaaaaaaa-0000-0000-0000-000000000010'), '0');
reset role;
select chi('88888888-8888-8888-8888-888888888888');
set role authenticated;
select atteso('il padre vede quanto ha pagato la figlia', (select pagato_importo::text from gare_pagamenti()), '10500');
reset role;

-- --- il tablet ---------------------------------------------------------------
\echo ''
\echo '--- il tablet (un utente senza scheda) non vede né scrive le gare ---'
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('nessuna gara', (select count(*)::text from gare), '0');
select atteso('nessuna voce', (select count(*)::text from gare_voci), '0');
select atteso('nessun accompagnatore', (select count(*)::text from gare_accompagnatori), '0');
select atteso('nessun atleta', (select count(*)::text from gare_atleti), '0');
select atteso('nessun pagamento', (select count(*)::text from gare_pagamenti()), '0');
select atteso('non scrive una gara', riuscito($$insert into gare (nome, dal) values ('Dal tablet', '2026-12-01')$$), 'no');
select atteso('né un atleta', riuscito($$insert into gare_atleti (gara_id, persona_id) values ('99990000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000003')$$), 'no');
select atteso('non incassa', rifiuto($$select incassa_gara('99991111-0000-0000-0000-000000000005', 'Contanti')$$), '42501 …');
reset role;

-- --- 13. unendo due schede resta una sola iscrizione -----------------------
\echo ''
\echo '--- 13. unire due schede iscritte alla stessa gara ---'
-- La scheda che se ne va ha già pagato il Trofeo, ed è anche l'unica nella gara di Torino.
insert into gare_atleti (gara_id, persona_id, nota) values
  ('99990000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000030', null);
insert into gare_atleti (gara_id, persona_id, pagato_il, pagato_importo, pagato_metodo, pagato_voci) values
  ('99990000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000031', '2026-10-20', 9000, 'Bonifico', '[{"voce": "Iscrizione", "importo": 3000}, {"voce": "Trasferimento in pullman", "importo": 1500}, {"voce": "Hotel, una notte", "importo": 4500}]'),
  ('99990000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000031', null, null, null, null);
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('l''unione va', tenta($$select unisci_persone('aaaaaaaa-0000-0000-0000-000000000030', 'aaaaaaaa-0000-0000-0000-000000000031')$$), '…');
select atteso('una sola iscrizione al Trofeo', (select count(*)::text from gare_atleti where gara_id = '99990000-0000-0000-0000-000000000001' and persona_id = 'aaaaaaaa-0000-0000-0000-000000000030'), '1');
select atteso('e chi se ne va non c''è più', (select count(*)::text from gare_atleti where persona_id = 'aaaaaaaa-0000-0000-0000-000000000031'), '0');
select atteso('il pagamento non si perde', (select pagato_importo || ' ' || pagato_metodo from gare_pagamenti() where gara_id = '99990000-0000-0000-0000-000000000001' and persona_id = 'aaaaaaaa-0000-0000-0000-000000000030'), '9000 Bonifico');
select atteso('la gara in cui c''era solo l''altra scheda passa a chi resta', (select count(*)::text from gare_atleti where gara_id = '99990000-0000-0000-0000-000000000002' and persona_id = 'aaaaaaaa-0000-0000-0000-000000000030'), '1');
reset role;

\echo ''
\echo 'TUTTO A POSTO'
