-- Il certificato medico, il documento e il pagamento: li vede e li cambia
-- solo la segreteria. Il file del certificato resta nell'app, in un
-- contenitore privato che apre solo lei; ne esiste uno solo per persona, un
-- file nuovo prende il posto del vecchio insieme alla data, e sparisce da sé
-- 30 giorni dopo la scadenza o quando la persona è disattivata
-- (`45-certificati-online.sql`). Quelli di prima della carta restano apribili.
-- Si lancia dopo finto-supabase.sql e i file dello schema.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'maura@ods.it'),
  ('33333333-3333-3333-3333-333333333333', 'luca@ods.it'),
  ('44444444-4444-4444-4444-444444444444', 'tablet@ods.it');
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Maura', 'Uno', 'istruttore', 'maura@ods.it', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Luca', 'Rossi', 'iscritto', 'luca@ods.it', '33333333-3333-3333-3333-333333333333'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'Sara', 'Bianchi', 'iscritto', null, null),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'Ugo', 'Scaduto', 'iscritto', null, null),
  ('aaaaaaaa-0000-0000-0000-000000000006', 'Elisa', 'Quasi', 'iscritto', null, null),
  ('aaaaaaaa-0000-0000-0000-000000000007', 'Gino', 'Senzadata', 'iscritto', null, null),
  ('aaaaaaaa-0000-0000-0000-000000000008', 'Lia', 'Lontana', 'iscritto', null, null),
  ('aaaaaaaa-0000-0000-0000-000000000009', 'Pia', 'Senzascheda', 'iscritto', null, null),
  ('aaaaaaaa-0000-0000-0000-000000000010', 'Nora', 'Futura', 'iscritto', null, null);
insert into sale (id, nome) values ('bbbbbbbb-0000-0000-0000-000000000001', 'Tatami');
insert into postazioni (id, nome, sala_id, utente_id) values
  ('dddddddd-0000-0000-0000-000000000001', 'Tablet Tatami', 'bbbbbbbb-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444');

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
grant execute on function tenta(text), atteso(text, text, text), chi(text) to anon, authenticated;

-- Un database di prima: il contenitore c'era già, col certificato di Luca
-- caricato allora. Se `45-certificati-online.sql` l'ha già fatto, non cambia
-- niente: le regole del contenitore sono quelle del file.
insert into storage.buckets (id, name, public) values ('certificati', 'certificati', false) on conflict (id) do nothing;
insert into storage.objects (bucket_id, name) values ('certificati', 'aaaaaaaa-0000-0000-0000-000000000003/certificato-1.pdf');

\echo ''
\echo '--- 1. il contenitore: privato, dieci mega, foto e PDF ---'
select atteso('è privato', (select public::text from storage.buckets where id = 'certificati'), 'false');
select atteso('pesa al massimo 10 MB', (select file_size_limit::text from storage.buckets where id = 'certificati'), '10485760');
select atteso('foto e PDF, come quello delle richieste',
  (select (allowed_mime_types @> array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'] and cardinality(allowed_mime_types) = 6)::text from storage.buckets where id = 'certificati'), 'true');

\echo ''
\echo '--- 2. la segreteria ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('scrive la scadenza (e il file di prima, com''era)',
  tenta($$insert into schede_iscritti (persona_id, certificato_scade, certificato_file) values
    ('aaaaaaaa-0000-0000-0000-000000000003', current_date + 200, 'aaaaaaaa-0000-0000-0000-000000000003/certificato-1.pdf')$$), 'FATTO (1 righe)');
select atteso('il file di prima non ha una data di caricamento',
  (select (certificato_caricato_il is null)::text from schede_iscritti), 'true');
select atteso('il documento non è ancora in segreteria', (select documento_in_segreteria::text from schede_iscritti), 'false');
select atteso('segna il documento in segreteria',
  tenta($$update schede_iscritti set documento_in_segreteria = true where persona_id = 'aaaaaaaa-0000-0000-0000-000000000003'$$), 'FATTO (1 righe)');
select atteso('il server scrive chi è stato', (select p.nome from schede_iscritti s join persone p on p.id = s.cambiata_da), 'Anna');
select atteso('chi non ha scritto niente del pagamento deve pagare', (select pagamento::text from schede_iscritti), 'da_pagare');
select atteso('segna il pagamento del trimestre',
  tenta($$update schede_iscritti set pagamento = 'pagato', pagato_fino = current_date + 90 where persona_id = 'aaaaaaaa-0000-0000-0000-000000000003'$$), 'FATTO (1 righe)');
select atteso('uno stato inventato no',
  tenta($$update schede_iscritti set pagamento = 'gratis' where persona_id = 'aaaaaaaa-0000-0000-0000-000000000003'$$), 'NEGATO: …');
select atteso('vede il file di prima', (select count(*)::text from storage.objects where bucket_id = 'certificati'), '1');

-- Un file nuovo: prima nel contenitore, poi con la data in un passaggio solo.
select atteso('carica un file nuovo', tenta($$insert into storage.objects (bucket_id, name) values ('certificati', 'aaaaaaaa-0000-0000-0000-000000000003/certificato-2.png')$$), 'FATTO (1 righe)');
select atteso('un tipo che non è una foto né un PDF no',
  tenta($$insert into storage.objects (bucket_id, name) values ('certificati', 'aaaaaaaa-0000-0000-0000-000000000003/certificato-3.exe')$$), 'NEGATO: …');
select atteso('un nome fuori dalla regola no',
  tenta($$insert into storage.objects (bucket_id, name) values ('certificati', 'aaaaaaaa-0000-0000-0000-000000000003/radiografia.pdf')$$), 'NEGATO: …');
select atteso('la cartella di uno che non c''è no',
  tenta($$insert into storage.objects (bucket_id, name) values ('certificati', 'aaaaaaaa-0000-0000-0000-0000000000ff/certificato-1.pdf')$$), 'NEGATO: …');
select atteso('file e data insieme: il file nuovo prende il posto del vecchio',
  tenta($$select salva_certificato('aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000003/certificato-2.png', current_date + 300)::text$$), '');
select atteso('la scheda ha il file nuovo e la data nuova',
  (select certificato_file || ' ' || (certificato_scade = current_date + 300) from schede_iscritti where persona_id = 'aaaaaaaa-0000-0000-0000-000000000003'),
  'aaaaaaaa-0000-0000-0000-000000000003/certificato-2.png true');
select atteso('ora ha una data di caricamento', (select (certificato_caricato_il::date = current_date)::text from schede_iscritti where persona_id = 'aaaaaaaa-0000-0000-0000-000000000003'), 'true');
select atteso('il vecchio non c''è più, nemmeno nel contenitore',
  (select string_agg(name, ', ') from storage.objects where bucket_id = 'certificati'), 'aaaaaaaa-0000-0000-0000-000000000003/certificato-2.png');
select atteso('una riga sola per persona', (select count(*)::text from schede_iscritti where persona_id = 'aaaaaaaa-0000-0000-0000-000000000003'), '1');
select atteso('il pagamento e il documento non si toccano',
  (select pagamento || ' ' || documento_in_segreteria from schede_iscritti), 'pagato true');

-- Cosa non entra: e se non entra, non cambia niente.
select atteso('senza la data no',
  tenta($$select salva_certificato('aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000003/certificato-2.png', null)::text$$), 'NEGATO: Serve la data di scadenza del certificato');
select atteso('una data più di tre anni avanti no: probabilmente l''anno è sbagliato',
  tenta($$select salva_certificato('aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000003/certificato-2.png', current_date + 1100)::text$$), 'NEGATO: La data è troppo lontana: controlla l''anno.');
select atteso('fra tre anni esatti sì',
  tenta($$select salva_certificato('aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000003/certificato-2.png', (current_date + interval '3 years')::date)::text$$), '');
select atteso('e si rimette com''era', tenta($$select salva_certificato('aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000003/certificato-2.png', current_date + 300)::text$$), '');
select atteso('un file mai caricato no',
  tenta($$select salva_certificato('aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000003/certificato-9.pdf', current_date + 10)::text$$), 'NEGATO: Il file non è stato caricato: riprova');
select atteso('il file di un''altra persona no',
  tenta($$select salva_certificato('aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000004/certificato-1.pdf', current_date + 10)::text$$), 'NEGATO: Il file non è di questa persona');
select atteso('un passaggio fallito lascia file e data com''erano',
  (select certificato_file || ' ' || (certificato_scade = current_date + 300) || ' ' || (select count(*) from storage.objects where bucket_id = 'certificati')
     from schede_iscritti where persona_id = 'aaaaaaaa-0000-0000-0000-000000000003'),
  'aaaaaaaa-0000-0000-0000-000000000003/certificato-2.png true 1');

-- Sara ha già la scheda, senza certificato: il file la riempie, il resto resta.
select atteso('Sara, pagato in parte, senza certificato',
  tenta($$insert into schede_iscritti (persona_id, pagamento, pagamento_nota) values
    ('aaaaaaaa-0000-0000-0000-000000000004', 'in_parte', 'mancano 50 €')$$), 'FATTO (1 righe)');
select atteso('il file di Luca non va sulla scheda di Sara',
  tenta($$update schede_iscritti set certificato_file = 'aaaaaaaa-0000-0000-0000-000000000003/certificato-2.png' where persona_id = 'aaaaaaaa-0000-0000-0000-000000000004'$$), 'NEGATO: …');
insert into storage.objects (bucket_id, name) values ('certificati', 'aaaaaaaa-0000-0000-0000-000000000004/certificato-1.jpg');
select atteso('il file di Sara va sulla sua',
  tenta($$select salva_certificato('aaaaaaaa-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000004/certificato-1.jpg', current_date + 50)::text$$), '');
select atteso('e il pagamento resta com''era', (select pagamento || ' ' || pagamento_nota from schede_iscritti where persona_id = 'aaaaaaaa-0000-0000-0000-000000000004'), 'in_parte mancano 50 €');
reset role;

\echo ''
\echo '--- 3. un istruttore: fa l''appello, ma i certificati non li vede, nemmeno se ci sono ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('vede le persone', (select count(*)::text from persone where ruolo = 'iscritto'), '8');
select atteso('non vede le schede', (select count(*)::text from schede_iscritti), '0');
select atteso('non sa chi ha un file', (select count(*)::text from schede_iscritti where certificato_file is not null), '0');
select atteso('non vede i file', (select count(*)::text from storage.objects where bucket_id = 'certificati'), '0');
select atteso('non scrive una scheda',
  tenta($$insert into schede_iscritti (persona_id, pagamento) values ('aaaaaaaa-0000-0000-0000-000000000002', 'pagato')$$), 'NEGATO: …');
select atteso('non segna un pagamento', tenta($$update schede_iscritti set pagamento = 'pagato'$$), 'a vuoto (0 righe)');
select atteso('non carica un certificato',
  tenta($$insert into storage.objects (bucket_id, name) values ('certificati', 'aaaaaaaa-0000-0000-0000-000000000003/certificato-4.pdf')$$), 'NEGATO: …');
select atteso('non cancella un file', tenta($$delete from storage.objects where bucket_id = 'certificati'$$), 'a vuoto (0 righe)');
select atteso('non lo mette sulla scheda',
  tenta($$select salva_certificato('aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000003/certificato-2.png', current_date + 1)::text$$), 'NEGATO: solo la segreteria');
reset role;

\echo ''
\echo '--- 4. un iscritto con l''accesso: nemmeno il suo ---'
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('non vede la sua scheda', (select count(*)::text from schede_iscritti), '0');
select atteso('non vede il suo file', (select count(*)::text from storage.objects where bucket_id = 'certificati'), '0');
select atteso('non ne carica uno',
  tenta($$insert into storage.objects (bucket_id, name) values ('certificati', 'aaaaaaaa-0000-0000-0000-000000000003/certificato-4.pdf')$$), 'NEGATO: …');
select atteso('non lo mette sulla sua scheda',
  tenta($$select salva_certificato('aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000003/certificato-2.png', current_date + 1)::text$$), 'NEGATO: solo la segreteria');
reset role;

\echo ''
\echo '--- 5. il tablet di sala ---'
select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('non vede le schede', (select count(*)::text from schede_iscritti), '0');
select atteso('non vede i file', (select count(*)::text from storage.objects where bucket_id = 'certificati'), '0');
select atteso('non ne carica',
  tenta($$insert into storage.objects (bucket_id, name) values ('certificati', 'aaaaaaaa-0000-0000-0000-000000000003/certificato-4.pdf')$$), 'NEGATO: …');
select atteso('non lo mette su una scheda',
  tenta($$select salva_certificato('aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000003/certificato-2.png', current_date + 1)::text$$), 'NEGATO: solo la segreteria');
reset role;

\echo ''
\echo '--- 6. chi non ha un accesso ---'
select chi('');
set role anon;
select atteso('non legge le schede', tenta($$select count(*)::text from schede_iscritti$$), 'NEGATO: …');
select atteso('non vede i file', (select count(*)::text from storage.objects where bucket_id = 'certificati'), '0');
select atteso('non carica un certificato',
  tenta($$insert into storage.objects (bucket_id, name) values ('certificati', 'aaaaaaaa-0000-0000-0000-000000000003/certificato-3.pdf')$$), 'NEGATO: …');
select atteso('non chiama la funzione',
  tenta($$select salva_certificato('aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000003/certificato-2.png', current_date + 1)::text$$), 'NEGATO: permission denied for function salva_certificato');
reset role;

\echo ''
\echo '--- 7. trenta giorni dopo la scadenza il file se ne va, la data resta ---'
insert into storage.objects (bucket_id, name) values
  ('certificati', 'aaaaaaaa-0000-0000-0000-000000000005/certificato-1.pdf'),
  ('certificati', 'aaaaaaaa-0000-0000-0000-000000000006/certificato-1.pdf'),
  ('certificati', 'aaaaaaaa-0000-0000-0000-000000000007/certificato-1.pdf'),
  ('certificati', 'aaaaaaaa-0000-0000-0000-000000000010/certificato-1.pdf');
insert into schede_iscritti (persona_id, certificato_scade, certificato_file, certificato_caricato_il) values
  ('aaaaaaaa-0000-0000-0000-000000000005', current_date - 30, 'aaaaaaaa-0000-0000-0000-000000000005/certificato-1.pdf', now() - interval '200 days'),
  ('aaaaaaaa-0000-0000-0000-000000000006', current_date - 29, 'aaaaaaaa-0000-0000-0000-000000000006/certificato-1.pdf', null),
  ('aaaaaaaa-0000-0000-0000-000000000007', null, 'aaaaaaaa-0000-0000-0000-000000000007/certificato-1.pdf', null),
  ('aaaaaaaa-0000-0000-0000-000000000010', current_date + 5, 'aaaaaaaa-0000-0000-0000-000000000010/certificato-1.pdf', null);
select atteso('la pulizia toglie un file solo: quello scaduto da 30 giorni', pulisci_certificati()::text, '1');
select atteso('la scheda di Ugo: niente file, la data c''è ancora',
  (select coalesce(certificato_file, 'senza file') || ' ' || (certificato_scade = current_date - 30) from schede_iscritti where persona_id = 'aaaaaaaa-0000-0000-0000-000000000005'), 'senza file true');
select atteso('il giorno di caricamento resta: dice che un file c''è stato, e che è stato cancellato',
  (select (certificato_caricato_il is not null)::text from schede_iscritti where persona_id = 'aaaaaaaa-0000-0000-0000-000000000005'), 'true');
select atteso('e il file di Ugo non è più nel contenitore',
  (select count(*)::text from storage.objects where bucket_id = 'certificati' and name like 'aaaaaaaa-0000-0000-0000-000000000005/%'), '0');
select atteso('chi è scaduto da 29 giorni lo tiene ancora',
  (select (certificato_file is not null)::text from schede_iscritti where persona_id = 'aaaaaaaa-0000-0000-0000-000000000006'), 'true');
select atteso('chi non ha una data lo tiene: manca solo la data',
  (select (certificato_file is not null)::text from schede_iscritti where persona_id = 'aaaaaaaa-0000-0000-0000-000000000007'), 'true');
select atteso('chi è ancora valido lo tiene',
  (select (certificato_file is not null)::text from schede_iscritti where persona_id = 'aaaaaaaa-0000-0000-0000-000000000010'), 'true');
select atteso('una seconda volta non c''è più niente da togliere', pulisci_certificati()::text, '0');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria non la lancia dall''app',
  tenta($$select pulisci_certificati()::text$$), 'NEGATO: permission denied for function pulisci_certificati');
reset role;
set role anon;
select atteso('chi non ha un accesso nemmeno', tenta($$select pulisci_certificati()::text$$), 'NEGATO: permission denied for function pulisci_certificati');
reset role;

-- Un file rimasto nel contenitore senza una scheda che lo tenga (un caricamento a metà) se ne va dopo un giorno.
insert into storage.objects (bucket_id, name, created_at) values
  ('certificati', 'aaaaaaaa-0000-0000-0000-000000000009/certificato-7.pdf', now() - interval '2 days'),
  ('certificati', 'aaaaaaaa-0000-0000-0000-000000000009/certificato-8.pdf', now());
select atteso('la pulizia toglie anche il file senza scheda, ma solo se non è di oggi (potrebbe essere in arrivo)', pulisci_certificati()::text, '1');
select atteso('quello di oggi resta', (select string_agg(name, ', ') from storage.objects where bucket_id = 'certificati' and name like 'aaaaaaaa-0000-0000-0000-000000000009/%'), 'aaaaaaaa-0000-0000-0000-000000000009/certificato-8.pdf');
delete from storage.objects where bucket_id = 'certificati' and name like 'aaaaaaaa-0000-0000-0000-000000000009/%';

\echo ''
\echo '--- 8. la segreteria disattiva la persona: il file se ne va, la data resta ---'
insert into storage.objects (bucket_id, name) values ('certificati', 'aaaaaaaa-0000-0000-0000-000000000008/certificato-1.pdf');
insert into schede_iscritti (persona_id, certificato_scade, certificato_file, certificato_caricato_il) values
  ('aaaaaaaa-0000-0000-0000-000000000008', current_date + 100, 'aaaaaaaa-0000-0000-0000-000000000008/certificato-1.pdf', now() - interval '20 days');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('cambiare un altro dato non tocca il file',
  tenta($$update persone set telefono = '011 123456' where id = 'aaaaaaaa-0000-0000-0000-000000000008'$$), 'FATTO (1 righe)');
select atteso('il file c''è ancora', (select count(*)::text from storage.objects where bucket_id = 'certificati' and name like 'aaaaaaaa-0000-0000-0000-000000000008/%'), '1');
select atteso('disattiva Lia', tenta($$update persone set attiva = false where id = 'aaaaaaaa-0000-0000-0000-000000000008'$$), 'FATTO (1 righe)');
select atteso('il file non c''è più', (select count(*)::text from storage.objects where bucket_id = 'certificati' and name like 'aaaaaaaa-0000-0000-0000-000000000008/%'), '0');
select atteso('nella scheda niente nome di file, la data resta',
  (select coalesce(certificato_file, 'senza file') || ' ' || (certificato_scade = current_date + 100) from schede_iscritti where persona_id = 'aaaaaaaa-0000-0000-0000-000000000008'), 'senza file true');
select atteso('il giorno di caricamento resta anche qui: la scheda sa che il file c''era',
  (select (certificato_caricato_il is not null)::text from schede_iscritti where persona_id = 'aaaaaaaa-0000-0000-0000-000000000008'), 'true');
select atteso('riattivarla non lo riporta', tenta($$update persone set attiva = true where id = 'aaaaaaaa-0000-0000-0000-000000000008'$$), 'FATTO (1 righe)');
select atteso('il file è sempre andato', (select count(*)::text from storage.objects where bucket_id = 'certificati' and name like 'aaaaaaaa-0000-0000-0000-000000000008/%'), '0');
select atteso('chi non ha una scheda si disattiva lo stesso', tenta($$update persone set attiva = false where id = 'aaaaaaaa-0000-0000-0000-000000000009'$$), 'FATTO (1 righe)');
reset role;

\echo ''
\echo '--- 9. la segreteria toglie il file (e la data) di un certificato sbagliato ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('cancella il file di Luca', tenta($$delete from storage.objects where bucket_id = 'certificati' and name like 'aaaaaaaa-0000-0000-0000-000000000003/%'$$), 'FATTO (1 righe)');
select atteso('e toglie il nome dalla scheda, la scadenza resta',
  tenta($$update schede_iscritti set certificato_file = null where persona_id = 'aaaaaaaa-0000-0000-0000-000000000003'$$), 'FATTO (1 righe)');
select atteso('la scadenza c''è ancora', (select (certificato_scade is not null and certificato_file is null)::text from schede_iscritti where persona_id = 'aaaaaaaa-0000-0000-0000-000000000003'), 'true');
reset role;

-- Chi è disattivata non riceve un file nuovo: la regola «riattivarla non lo riporta» non si aggira.
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('un file per una persona disattivata no',
  tenta($$select salva_certificato('aaaaaaaa-0000-0000-0000-000000000009', 'aaaaaaaa-0000-0000-0000-000000000009/certificato-2.pdf', current_date + 10)::text$$), 'NEGATO: Persona inesistente');
select atteso('una persona che non c''è dà lo stesso testo, qualunque sia il file',
  tenta($$select salva_certificato('aaaaaaaa-0000-0000-0000-0000000000ff', 'aaaaaaaa-0000-0000-0000-0000000000ff/certificato-1.pdf', current_date + 10)::text$$), 'NEGATO: Persona inesistente');
reset role;

\echo ''
\echo '--- 10. la persona che se ne va si porta via la scheda ---'
delete from persone where id = 'aaaaaaaa-0000-0000-0000-000000000004';
-- Cancellata la persona dal database, il suo file non resta nel contenitore.
insert into persone (id, nome, cognome, ruolo) values ('aaaaaaaa-0000-0000-0000-000000000011', 'Tea', 'Cancellata', 'iscritto');
insert into storage.objects (bucket_id, name) values ('certificati', 'aaaaaaaa-0000-0000-0000-000000000011/certificato-1.pdf');
insert into schede_iscritti (persona_id, certificato_scade, certificato_file) values
  ('aaaaaaaa-0000-0000-0000-000000000011', current_date + 100, 'aaaaaaaa-0000-0000-0000-000000000011/certificato-1.pdf');
delete from persone where id = 'aaaaaaaa-0000-0000-0000-000000000011';
select atteso('con la persona se ne va anche il file', (select count(*)::text from storage.objects where bucket_id = 'certificati' and name like 'aaaaaaaa-0000-0000-0000-000000000011/%'), '0');
select atteso('la scheda di Sara non c''è più', (select count(*)::text from schede_iscritti where persona_id = 'aaaaaaaa-0000-0000-0000-000000000004'), '0');

\echo ''
\echo 'Tutto a posto.'
