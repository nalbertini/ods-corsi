-- Il ruolo «amministrazione»: segue i soldi (ricevute, pagamenti, listino) e
-- non vede le persone. Si può avere insieme alla segreteria
-- (`anche_amministrazione`) e all'insegnamento (`anche_istruttore`).
-- Le stesse regole di `src/lib/ruoli.ts`, provate da scripts/prova-ruoli.mjs.
-- Si lancia dopo finto-supabase.sql e i file dello schema, su un database suo.
--
-- REGOLA PER CHI VERRÀ: la contabilità (movimenti, casse, rendiconto) non
-- esiste ancora. Quando ci sarà, ogni sua tabella avrà policy e funzioni solo
-- con `e_amministrazione()`: la segreteria che non ha anche il ruolo non la
-- vede. Oggi non c'è niente da provare: la regola sta qui.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'ada@ods.it'),
  ('33333333-3333-3333-3333-333333333333', 'sandro@ods.it'),
  ('44444444-4444-4444-4444-444444444444', 'ivo@ods.it'),
  ('55555555-5555-5555-5555-555555555555', 'maura@ods.it'),
  ('66666666-6666-6666-6666-666666666666', 'senza@ods.it'),
  ('77777777-7777-7777-7777-777777777777', 'luca@ods.it');
-- Anna: solo segreteria. Ada: solo amministrazione. Sandro: segreteria e
-- amministrazione. Ivo: amministrazione e istruttore. Maura: istruttore.
insert into persone (id, nome, cognome, ruolo, anche_istruttore, anche_amministrazione, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', false, false, 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Ada', 'Conti', 'amministrazione', false, false, 'ada@ods.it', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Sandro', 'Doppio', 'staff', false, true, 'sandro@ods.it', '33333333-3333-3333-3333-333333333333'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'Ivo', 'Conti', 'amministrazione', true, false, 'ivo@ods.it', '44444444-4444-4444-4444-444444444444'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'Maura', 'Uno', 'istruttore', false, false, 'maura@ods.it', '55555555-5555-5555-5555-555555555555'),
  ('aaaaaaaa-0000-0000-0000-000000000007', 'Luca', 'Rossi', 'iscritto', false, false, 'luca@ods.it', '77777777-7777-7777-7777-777777777777'),
  ('aaaaaaaa-0000-0000-0000-000000000009', 'Manuela', 'Albertini', 'iscritto', false, false, null, null);
-- Una scheda, un corso con la sua lezione di oggi (Ivo la insegna) e un'iscrizione.
insert into schede_iscritti (persona_id) values ('aaaaaaaa-0000-0000-0000-000000000007');
insert into sale (id, nome) values ('bbbbbbbb-0000-0000-0000-000000000001', 'Tatami');
insert into corsi (id, nome, sala_id, istruttore_id) values
  ('cccccccc-0000-0000-0000-000000000001', 'Judo', 'bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000004');
insert into corsi_istruttori (corso_id, persona_id) values ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000004');
insert into sessioni (id, corso_id, inizio, fine, sala_id, istruttore_id) values
  ('eeeeeeee-0000-0000-0000-000000000101', 'cccccccc-0000-0000-0000-000000000001', now() - interval '1 hour', now() + interval '1 hour', 'bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000004');
insert into iscrizioni (corso_id, persona_id) values ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000007');

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
create or replace function ricevuta(giorno text) returns jsonb language sql as $$
  select jsonb_build_object(
    'data', giorno, 'persona_id', 'aaaaaaaa-0000-0000-0000-000000000009',
    'ente', jsonb_build_object('nome', 'Asd Il Centro Judo'),
    'intestatario', jsonb_build_object('nome', 'Manuela', 'cognome', 'Albertini'),
    'voci', jsonb_build_array(jsonb_build_object('descrizione', 'QUOTA ASSOCIATIVA', 'quantita', 1, 'prezzo', 5000, 'dal', '2026-09-01', 'al', '2027-07-31',
      'pagamenti', jsonb_build_array(jsonb_build_object('data', giorno, 'importo', 5000, 'metodo', 'Bonifico')))),
    'anticipo', 0)
$$;
create or replace function pag() returns jsonb language sql as $$
  select '{"persona_id": "aaaaaaaa-0000-0000-0000-000000000009", "data": "2026-09-10", "importo": 5000, "metodo": "Contanti", "voce": "Quota associativa"}'::jsonb
$$;
grant execute on function tenta(text), atteso(text, text, text), chi(text), ricevuta(text), pag() to anon, authenticated;

\echo ''
\echo '--- 1. chi è cosa: e_staff() ed e_amministrazione(), mai null ---'
select chi('11111111-1111-1111-1111-111111111111');
select atteso('la segreteria: staff sì', e_staff()::text, 'true');
select atteso('la segreteria senza il flag: amministrazione no', e_amministrazione()::text, 'false');
select chi('22222222-2222-2222-2222-222222222222');
select atteso('l''amministrazione: staff no', e_staff()::text, 'false');
select atteso('l''amministrazione: amministrazione sì', e_amministrazione()::text, 'true');
select chi('33333333-3333-3333-3333-333333333333');
select atteso('segreteria e amministrazione: staff sì', e_staff()::text, 'true');
select atteso('segreteria e amministrazione: amministrazione sì', e_amministrazione()::text, 'true');
select chi('44444444-4444-4444-4444-444444444444');
select atteso('amministrazione e istruttore: staff no', e_staff()::text, 'false');
select atteso('amministrazione e istruttore: amministrazione sì', e_amministrazione()::text, 'true');
select chi('55555555-5555-5555-5555-555555555555');
select atteso('l''istruttore: amministrazione no', e_amministrazione()::text, 'false');
select chi('77777777-7777-7777-7777-777777777777');
select atteso('l''iscritto: amministrazione no', e_amministrazione()::text, 'false');
select chi('66666666-6666-6666-6666-666666666666');
select atteso('senza riga in persone: staff è falso, non null', coalesce(e_staff()::text, 'NULL'), 'false');
select atteso('senza riga in persone: amministrazione è falso, non null', coalesce(e_amministrazione()::text, 'NULL'), 'false');
select chi('');
select atteso('senza accesso: staff è falso, non null', coalesce(e_staff()::text, 'NULL'), 'false');
select atteso('senza accesso: amministrazione è falso, non null', coalesce(e_amministrazione()::text, 'NULL'), 'false');

\echo ''
\echo '--- 2. l''amministrazione legge i soldi, e non le persone ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria emette una ricevuta', (emetti_ricevuta(ricevuta('2026-09-01')))->>'numero', '1');
select atteso('la segreteria registra un pagamento', (registra_pagamento_diretto(pag()))->>'importo', '5000');
reset role;
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('legge le ricevute', tenta($$select count(*)::text from ricevute$$), '1');
select atteso('legge i pagamenti', tenta($$select count(*)::text from pagamenti_diretti$$), '1');
select atteso('delle persone vede solo se stessa', tenta($$select string_agg(nome, ',') from persone$$), 'Ada');
select atteso('le schede non le vede', tenta($$select count(*)::text from schede_iscritti$$), '0');
select atteso('i nomi di chi ha pagato li vede, e solo quelli', tenta($$select string_agg(nome || ' ' || cognome, ',') from nomi_persone(array['aaaaaaaa-0000-0000-0000-000000000009']::uuid[])$$), 'Manuela Albertini');
reset role;

\echo ''
\echo '--- 3. l''amministrazione non scrive su persone, corsi, iscrizioni, schede, lezioni, tablet ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('non aggiunge una persona', tenta($$insert into persone (nome, cognome, ruolo) values ('X', 'Y', 'iscritto')$$), 'NEGATO: …');
select atteso('non cambia una persona', tenta($$update persone set cognome = 'Cambiato'$$), 'a vuoto (0 righe)');
select atteso('non toglie una persona', tenta($$delete from persone where id = 'aaaaaaaa-0000-0000-0000-000000000009'$$), 'a vuoto (0 righe)');
select atteso('non cambia il proprio ruolo', tenta($$update persone set ruolo = 'staff' where id = 'aaaaaaaa-0000-0000-0000-000000000002'$$), 'a vuoto (0 righe)');
select atteso('non crea un corso', tenta($$insert into corsi (nome) values ('Corso abusivo')$$), 'NEGATO: …');
select atteso('non cambia un corso', tenta($$update corsi set nome = 'Altro'$$), 'a vuoto (0 righe)');
select atteso('non toglie un corso', tenta($$delete from corsi$$), 'a vuoto (0 righe)');
select atteso('non iscrive nessuno', tenta($$insert into iscrizioni (corso_id, persona_id) values ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000009')$$), 'NEGATO: …');
select atteso('non toglie un''iscrizione', tenta($$delete from iscrizioni$$), 'a vuoto (0 righe)');
select atteso('non scrive una scheda', tenta($$insert into schede_iscritti (persona_id) values ('aaaaaaaa-0000-0000-0000-000000000009')$$), 'NEGATO: …');
select atteso('non cambia una scheda', tenta($$update schede_iscritti set documento_in_segreteria = true$$), 'a vuoto (0 righe)');
select atteso('non aggiunge una lezione', tenta($$insert into sessioni (corso_id, inizio, fine) values ('cccccccc-0000-0000-0000-000000000001', now(), now() + interval '1 hour')$$), 'NEGATO: …');
select atteso('non annulla una lezione', tenta($$update sessioni set stato = 'annullata'$$), 'a vuoto (0 righe)');
select atteso('non crea un tablet', tenta($$insert into postazioni (nome, sala_id, utente_id) values ('Tablet', 'bbbbbbbb-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666666')$$), 'NEGATO: …');
reset role;
select atteso('le persone sono rimaste come prima', (select string_agg(cognome, ',' order by cognome) from persone),
  'Albertini,Conti,Conti,Doppio,Rossi,Segreteria,Uno');

\echo ''
\echo '--- 4. ricevute e pagamenti: amministrazione, segreteria e segreteria+amministrazione fanno e disfano ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('l''amministrazione emette una ricevuta', (emetti_ricevuta(ricevuta('2026-09-02')))->>'numero', '2');
select atteso('l''amministrazione registra un pagamento', (registra_pagamento_diretto(pag()))->>'importo', '5000');
select atteso('chi l''ha registrato lo mette il server', (select p.nome from pagamenti_diretti d join persone p on p.id = d.creato_da order by d.creato_il desc limit 1), 'Ada');
select atteso('l''amministrazione annulla la ricevuta 2', tenta($$select annulla_ricevuta((select id from ricevute where numero = 2))::text$$), '');
select atteso('l''amministrazione annulla un pagamento', tenta($$select annulla_pagamento_diretto((select id from pagamenti_diretti order by creato_il desc limit 1))::text$$), '');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria emette ancora', (emetti_ricevuta(ricevuta('2026-09-03')))->>'numero', '3');
select atteso('la segreteria annulla ancora la ricevuta 3', tenta($$select annulla_ricevuta((select id from ricevute where numero = 3))::text$$), '');
select atteso('la segreteria registra ancora', (registra_pagamento_diretto(pag()))->>'importo', '5000');
select atteso('la segreteria annulla ancora un pagamento', tenta($$select annulla_pagamento_diretto((select id from pagamenti_diretti where annullato_il is null order by creato_il desc limit 1))::text$$), '');
reset role;
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('segreteria e amministrazione emette', (emetti_ricevuta(ricevuta('2026-09-04')))->>'numero', '4');
select atteso('segreteria e amministrazione registra', (registra_pagamento_diretto(pag()))->>'importo', '5000');
reset role;
select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('amministrazione e istruttore emette', (emetti_ricevuta(ricevuta('2026-09-05')))->>'numero', '5');
reset role;

\echo ''
\echo '--- 5. le statistiche restano della segreteria ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('l''amministrazione no', tenta($$select statistiche(now() - interval '7 days', now())::text$$), 'NEGATO: le statistiche sono della segreteria');
reset role;
select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('amministrazione e istruttore no', tenta($$select statistiche(now() - interval '7 days', now())::text$$), 'NEGATO: le statistiche sono della segreteria');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria sì', tenta($$select (statistiche(now() - interval '7 days', now())) is not null$$), 'true');
reset role;

\echo ''
\echo '--- 6. PIN e ruoli: solo la segreteria ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('l''amministrazione non imposta un PIN', tenta($$select imposta_pin('aaaaaaaa-0000-0000-0000-000000000005', '1234')::text$$), 'NEGATO: il PIN lo cambia la segreteria');
select atteso('non vede chi ha un PIN', tenta($$select count(*)::text from pin_impostati()$$), 'NEGATO: solo la segreteria');
select atteso('non fa nessuno amministrazione', tenta($$update persone set anche_amministrazione = true where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$), 'a vuoto (0 righe)');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('un PIN a chi è solo amministrazione no', tenta($$select imposta_pin('aaaaaaaa-0000-0000-0000-000000000002', '1234')::text$$), 'NEGATO: …');
select atteso('un PIN a chi è amministrazione e istruttore sì', tenta($$select imposta_pin('aaaaaaaa-0000-0000-0000-000000000004', '4321')::text$$), '');
select atteso('la segreteria cambia un ruolo', tenta($$update persone set anche_amministrazione = true where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$), 'FATTO (1 righe)');
select atteso('e lo toglie', tenta($$update persone set anche_amministrazione = false where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$), 'FATTO (1 righe)');
reset role;
-- Creare account, invitare e il backup sono funzioni di Supabase
-- (supabase/functions/{invita,backup}): guardano `ruolo = 'staff'` e un
-- `amministrazione` non ci passa. Non si provano da qui.

\echo ''
\echo '--- 7. le presenze: solo chi insegna ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('l''amministrazione non segna una presenza',
  tenta($$insert into presenze (sessione_id, persona_id, stato) values ('eeeeeeee-0000-0000-0000-000000000101', 'aaaaaaaa-0000-0000-0000-000000000007', 'presente')$$), 'NEGATO: …');
reset role;
select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('amministrazione e istruttore la segna',
  tenta($$insert into presenze (sessione_id, persona_id, stato) values ('eeeeeeee-0000-0000-0000-000000000101', 'aaaaaaaa-0000-0000-0000-000000000007', 'presente')$$), 'FATTO (1 righe)');
select atteso('ma non vede lo stesso le schede', tenta($$select count(*)::text from schede_iscritti$$), '0');
select atteso('e i pagamenti li vede lo stesso', tenta($$select (count(*) > 0)::text from pagamenti_diretti$$), 'true');
reset role;

\echo ''
\echo '--- 8. il listino: lo legge e lo cambia come la segreteria ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('l''amministrazione lo cambia', tenta($$update impostazioni set listino = '{"quota": 1}' where id$$), 'FATTO (1 righe)');
select atteso('ma non le altre impostazioni', tenta($$update impostazioni set mesi_presenze = 99 where id$$), 'NEGATO: l''amministrazione cambia solo il listino');
select atteso('lo legge', coalesce(listino()::text, 'vuoto'), '{"quota": 1}');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria lo cambia ancora', tenta($$update impostazioni set listino = '{"quota": 2}' where id$$), 'FATTO (1 righe)');
reset role;
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('l''istruttore no', tenta($$update impostazioni set listino = '{"quota": 3}' where id$$), 'a vuoto (0 righe)');
reset role;

\echo ''
\echo '--- 9. gli altri non guadagnano niente ---'
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('l''istruttore non chiede i nomi dei pagamenti', tenta($$select count(*)::text from nomi_persone(array['aaaaaaaa-0000-0000-0000-000000000009']::uuid[])$$), 'NEGATO: i nomi li vede chi segue i pagamenti');
reset role;
-- Istruttore, iscritto e chi non ha accesso: né ricevute né pagamenti, né le funzioni.
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('l''istruttore non legge le ricevute', tenta($$select count(*)::text from ricevute$$), '0');
select atteso('l''istruttore non legge i pagamenti', tenta($$select count(*)::text from pagamenti_diretti$$), '0');
select atteso('l''istruttore non emette', tenta($$select emetti_ricevuta(ricevuta('2026-09-06'))::text$$), 'NEGATO: la ricevuta la fa la segreteria');
select atteso('l''istruttore non registra', tenta($$select registra_pagamento_diretto(pag())::text$$), 'NEGATO: il pagamento lo registra la segreteria');
reset role;
select chi('77777777-7777-7777-7777-777777777777');
set role authenticated;
select atteso('l''iscritto non legge le ricevute', tenta($$select count(*)::text from ricevute$$), '0');
select atteso('l''iscritto non legge i pagamenti', tenta($$select count(*)::text from pagamenti_diretti$$), '0');
reset role;
select chi('');
set role anon;
select atteso('anon non legge le ricevute', tenta($$select count(*)::text from ricevute$$), 'NEGATO: …');
select atteso('anon non legge i pagamenti', tenta($$select count(*)::text from pagamenti_diretti$$), 'NEGATO: …');
select atteso('anon non emette', tenta($$select emetti_ricevuta(ricevuta('2026-09-06'))::text$$), 'NEGATO: …');
reset role;
\echo ''
\echo '--- 10. i vincoli sui ruoli doppi ---'
select atteso('anche_amministrazione solo con staff: istruttore no',
  tenta($$insert into persone (nome, cognome, ruolo, anche_amministrazione) values ('A', 'B', 'istruttore', true)$$), 'NEGATO: …');
select atteso('anche_amministrazione solo con staff: amministrazione no',
  tenta($$insert into persone (nome, cognome, ruolo, anche_amministrazione) values ('A', 'B', 'amministrazione', true)$$), 'NEGATO: …');
select atteso('anche_amministrazione solo con staff: iscritto no',
  tenta($$insert into persone (nome, cognome, ruolo, anche_amministrazione) values ('A', 'B', 'iscritto', true)$$), 'NEGATO: …');
select atteso('anche_amministrazione con staff sì',
  tenta($$insert into persone (nome, cognome, ruolo, anche_amministrazione) values ('A', 'B', 'staff', true)$$), 'FATTO (1 righe)');
select atteso('anche_istruttore con amministrazione sì',
  tenta($$insert into persone (nome, cognome, ruolo, anche_istruttore) values ('C', 'D', 'amministrazione', true)$$), 'FATTO (1 righe)');
select atteso('anche_istruttore con staff sì (come prima)',
  tenta($$insert into persone (nome, cognome, ruolo, anche_istruttore) values ('E', 'F', 'staff', true)$$), 'FATTO (1 righe)');
select atteso('anche_istruttore con istruttore no',
  tenta($$insert into persone (nome, cognome, ruolo, anche_istruttore) values ('G', 'H', 'istruttore', true)$$), 'NEGATO: …');
select atteso('anche_istruttore con iscritto no',
  tenta($$insert into persone (nome, cognome, ruolo, anche_istruttore) values ('I', 'L', 'iscritto', true)$$), 'NEGATO: …');

\echo ''
\echo '--- 11. l''account, il PIN sul tablet e l''eliminazione ---'
insert into auth.users (id, email, email_confirmed_at) values
  ('88888888-8888-8888-8888-888888888888', 'nina@ods.it', now()),
  ('99999999-9999-9999-9999-999999999999', 'tablet@ods.it', now());
insert into persone (id, nome, cognome, ruolo, email) values
  ('aaaaaaaa-0000-0000-0000-000000000010', 'Nina', 'Conti', 'amministrazione', 'nina@ods.it');
insert into persone (id, nome, cognome, ruolo, anche_istruttore) values
  ('aaaaaaaa-0000-0000-0000-000000000011', 'Eli', 'Nuova', 'amministrazione', true),
  ('aaaaaaaa-0000-0000-0000-000000000012', 'Aldo', 'Solo', 'amministrazione', false);
insert into postazioni (id, nome, sala_id, utente_id) values
  ('dddddddd-0000-0000-0000-000000000001', 'Tablet', 'bbbbbbbb-0000-0000-0000-000000000001', '99999999-9999-9999-9999-999999999999');
-- Al primo accesso l'account si lega alla persona con la stessa email.
select chi('88888888-8888-8888-8888-888888888888');
set role authenticated;
select atteso('l''amministrazione si lega al suo account', tenta($$select (collega_utente() = 'aaaaaaaa-0000-0000-0000-000000000010')::text$$), 'true');
reset role;
-- Non si lega chi non ha l'email confermata, né una persona senza accesso.
insert into auth.users (id, email, email_confirmed_at) values ('88888888-8888-8888-8888-000000000001', 'nonconf@ods.it', null);
insert into auth.users (id, email, email_confirmed_at) values ('88888888-8888-8888-8888-000000000002', 'spenta@ods.it', now());
insert into persone (id, nome, cognome, ruolo, email, attiva) values
  ('aaaaaaaa-0000-0000-0000-000000000030', 'Nora', 'Nonconfermata', 'amministrazione', 'nonconf@ods.it', true),
  ('aaaaaaaa-0000-0000-0000-000000000031', 'Sara', 'Spenta', 'amministrazione', 'spenta@ods.it', false);
select chi('88888888-8888-8888-8888-000000000001');
set role authenticated;
select atteso('un''email non confermata non si lega', tenta($$select coalesce(collega_utente()::text, 'niente')$$), 'niente');
reset role;
select atteso('…e la riga resta libera', (select utente_id::text from persone where id = 'aaaaaaaa-0000-0000-0000-000000000030'), null);
select chi('88888888-8888-8888-8888-000000000002');
set role authenticated;
select atteso('una persona senza accesso non si lega', tenta($$select coalesce(collega_utente()::text, 'niente')$$), 'niente');
reset role;
select atteso('…e la riga resta libera', (select utente_id::text from persone where id = 'aaaaaaaa-0000-0000-0000-000000000031'), null);
-- Il PIN che la segreteria ha dato ad amministrazione e istruttore (sezione 6) apre l'area sul tablet.
select chi('99999999-9999-9999-9999-999999999999');
set role authenticated;
select atteso('il suo PIN sul tablet', tenta($$select nome from entra_con_pin('4321')$$), 'Ivo');
reset role;
-- Chi insegna anche si elimina come un istruttore; chi non insegna no.
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('amministrazione e istruttore, senza storia, si elimina', tenta($$select elimina_istruttore('aaaaaaaa-0000-0000-0000-000000000011')::text$$), 'FATTO (1 righe)');
select atteso('e non c''è più', (select count(*)::text from persone where id = 'aaaaaaaa-0000-0000-0000-000000000011'), '0');
select atteso('solo amministrazione no', tenta($$select elimina_istruttore('aaaaaaaa-0000-0000-0000-000000000012')::text$$), 'NEGATO: Si eliminano solo gli istruttori e la segreteria: a Aldo si toglie l''accesso');
reset role;

\echo ''
\echo '--- 12. chi ha pagato: la ricerca per nome dell''amministrazione ---'
insert into persone (id, nome, cognome, ruolo) values
  ('aaaaaaaa-0000-0000-0000-000000000020', 'Marco', 'Bianchi', 'iscritto'),
  ('aaaaaaaa-0000-0000-0000-000000000021', 'Chiara', 'Bianchi', 'iscritto'),
  ('aaaaaaaa-0000-0000-0000-000000000022', 'Luca', 'Biancotto', 'iscritto');
insert into persone (id, nome, cognome, ruolo, attiva) values
  ('aaaaaaaa-0000-0000-0000-000000000023', 'Bianca', 'Spenta', 'iscritto', false);
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('l''amministrazione cerca per nome', tenta($$select string_agg(nome || ' ' || cognome, ',' order by cognome, nome) from cerca_pagatori('bian')$$), 'Chiara Bianchi,Marco Bianchi,Luca Biancotto');
select atteso('anche senza accenti e maiuscole', tenta($$select count(*)::text from cerca_pagatori('BIANCHI')$$), '2');
select atteso('due lettere non bastano', tenta($$select count(*)::text from cerca_pagatori('bi')$$), '0');
select atteso('chi non è più attivo non esce', tenta($$select count(*)::text from cerca_pagatori('spenta')$$), '0');
select atteso('escono solo id, nome e cognome', (select string_agg(p.parameter_name, ',' order by p.ordinal_position) from information_schema.routines r join information_schema.parameters p on p.specific_name = r.specific_name where r.routine_name = 'cerca_pagatori' and p.parameter_mode = 'OUT'), 'persona_id,nome,cognome');
reset role;
insert into persone (nome, cognome, ruolo)
  select 'Nome' || i, 'Verdi', 'iscritto' from generate_series(1, 12) i;
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('al massimo otto', tenta($$select count(*)::text from cerca_pagatori('verdi')$$), '8');
select atteso('un testo oltre cento lettere non cerca', tenta($$select count(*)::text from cerca_pagatori('verdi' || repeat('x', 100))$$), '0');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria la usa lo stesso', tenta($$select count(*)::text from cerca_pagatori('bianchi')$$), '2');
reset role;
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('l''istruttore no', tenta($$select count(*)::text from cerca_pagatori('bianchi')$$), 'NEGATO: i nomi li vede chi segue i pagamenti');
reset role;
select chi('');
set role anon;
select atteso('anon no', tenta($$select count(*)::text from cerca_pagatori('bianchi')$$), 'NEGATO: …');
reset role;

-- Un tetto di ricerche, come per le prove: chi le ripete per scaricare l'elenco si ferma.
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('dopo troppe ricerche, una pausa',
  (select (count(*) filter (where esito = 'NEGATO: troppe ricerche: riprova fra qualche minuto') > 0)::text
     from (select tenta($$select count(*)::text from cerca_pagatori('bianchi')$$) as esito from generate_series(1, 70)) x),
  'true');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('il tetto è di chi cerca: la segreteria cerca ancora', tenta($$select count(*)::text from cerca_pagatori('bianchi')$$), '2');
reset role;
