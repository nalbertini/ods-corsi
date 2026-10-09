-- Le segnalazioni della segreteria: le legge e le scrive solo lei, sempre a
-- nome di chi scrive; si risponde a un filo, non a una risposta; un
-- messaggio non si cambia, di un filo si cambia solo se è chiuso, e niente
-- si cancella. Gli allegati (dalla sezione 6): solo la segreteria li vede,
-- li carica (max 3, tipi e peso del bucket) e li toglie chi li ha mandati;
-- 30 giorni dopo la chiusura del filo si tolgono da soli, il testo resta.
-- Un filo nuovo è un'idea o una correzione, e la segreteria la cambia dopo
-- (sezione 4b); quelli di prima restano senza, e si chiudono lo stesso.
-- Si lancia dopo finto-supabase.sql, i file dello schema,
-- 25-segnalazioni.sql, 32-segnalazioni-allegati.sql e 38-segnalazioni-categoria.sql.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'maura@ods.it'),
  ('33333333-3333-3333-3333-333333333333', 'luca@ods.it'),
  ('44444444-4444-4444-4444-444444444444', 'bea@ods.it'),
  ('66666666-6666-6666-6666-666666666666', 'lotta@sale.ods-corsi.it');
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Maura', 'Uno', 'istruttore', 'maura@ods.it', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Luca', 'Rossi', 'iscritto', 'luca@ods.it', '33333333-3333-3333-3333-333333333333'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'Bea', 'Banco', 'staff', 'bea@ods.it', '44444444-4444-4444-4444-444444444444');
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
grant execute on function tenta(text), atteso(text, text, text), chi(text) to anon, authenticated;

\echo ''
\echo '--- 1. la segreteria apre un filo e risponde ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
-- Con `returning`, come fa l'app (`.select('id').single()`): chi apre deve
-- poter rileggere la riga, se no il filo nuovo non si apre e chi riprova lo duplica.
select atteso('apre un filo e ne rilegge l''id',
  tenta($$insert into segnalazioni (id, titolo, testo, categoria)
    values ('eeeeeeee-0000-0000-0000-000000000001', 'La stampa delle ricevute', 'Esce tagliata a destra', 'correzione') returning id$$), 'FATTO (1 righe)');
select atteso('l''autore è lei',
  (select p.nome from segnalazioni s join persone p on p.id = s.autore_id where s.id = 'eeeeeeee-0000-0000-0000-000000000001'), 'Anna');
select atteso('a nome di un altro no',
  tenta($$insert into segnalazioni (titolo, testo, autore_id, categoria)
    values ('Altro', 'Scritto da Bea', 'aaaaaaaa-0000-0000-0000-000000000004', 'idea')$$), 'NEGATO: …');
select atteso('un filo senza titolo no', tenta($$insert into segnalazioni (testo, categoria) values ('Senza titolo', 'idea')$$), 'NEGATO: …');
select atteso('un testo vuoto no', tenta($$insert into segnalazioni (titolo, testo, categoria) values ('Vuoto', '   ', 'idea')$$), 'NEGATO: …');
select atteso('risponde al filo',
  tenta($$insert into segnalazioni (id, padre_id, testo)
    values ('eeeeeeee-0000-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-000000000001', 'Anche col margine stretto')$$), 'FATTO (1 righe)');
select atteso('una risposta col titolo no',
  tenta($$insert into segnalazioni (padre_id, titolo, testo)
    values ('eeeeeeee-0000-0000-0000-000000000001', 'Titolo', 'Risposta')$$), 'NEGATO: …');
select atteso('una risposta già chiusa no',
  tenta($$insert into segnalazioni (padre_id, testo, chiusa_il)
    values ('eeeeeeee-0000-0000-0000-000000000001', 'Risposta', now())$$), 'NEGATO: …');
select atteso('a una risposta non si risponde',
  tenta($$insert into segnalazioni (padre_id, testo)
    values ('eeeeeeee-0000-0000-0000-000000000002', 'Risposta alla risposta')$$), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 2. un altro della segreteria la legge, risponde e la chiude ---'
select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('vede il filo e la risposta', (select count(*)::text from segnalazioni), '2');
select atteso('risponde',
  tenta($$insert into segnalazioni (padre_id, testo) values ('eeeeeeee-0000-0000-0000-000000000001', 'Sistemato')$$), 'FATTO (1 righe)');
select atteso('chiude il filo',
  tenta($$update segnalazioni set chiusa_il = now() where id = 'eeeeeeee-0000-0000-0000-000000000001'$$), 'FATTO (1 righe)');
select atteso('e lo riapre',
  tenta($$update segnalazioni set chiusa_il = null where id = 'eeeeeeee-0000-0000-0000-000000000001'$$), 'FATTO (1 righe)');
select atteso('una risposta non si chiude',
  tenta($$update segnalazioni set chiusa_il = now() where id = 'eeeeeeee-0000-0000-0000-000000000002'$$), 'a vuoto (0 righe)');
select atteso('il testo non si cambia', tenta($$update segnalazioni set testo = 'Riscritto'$$), 'NEGATO: …');
select atteso('il titolo non si cambia', tenta($$update segnalazioni set titolo = 'Altro titolo'$$), 'NEGATO: …');
select atteso('l''autore non si cambia',
  tenta($$update segnalazioni set autore_id = 'aaaaaaaa-0000-0000-0000-000000000004'$$), 'NEGATO: …');
select atteso('niente si cancella', tenta($$delete from segnalazioni$$), 'NEGATO: …');
select atteso('ed è tutto ancora lì', (select count(*)::text from segnalazioni where chiusa_il is null), '3');
reset role;

\echo ''
\echo '--- 3. istruttore, iscritto e tablet non vedono niente ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('l''istruttore non vede niente', (select count(*)::text from segnalazioni), '0');
select atteso('non apre un filo', tenta($$insert into segnalazioni (titolo, testo, categoria) values ('Io', 'Dall''istruttore', 'idea')$$), 'NEGATO: …');
select atteso('non risponde',
  tenta($$insert into segnalazioni (padre_id, testo) values ('eeeeeeee-0000-0000-0000-000000000001', 'Dall''istruttore')$$), 'NEGATO: …');
select atteso('non chiude', tenta($$update segnalazioni set chiusa_il = now()$$), 'a vuoto (0 righe)');
reset role;
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('l''iscritto non vede niente', (select count(*)::text from segnalazioni), '0');
select atteso('e non scrive', tenta($$insert into segnalazioni (titolo, testo, categoria) values ('Io', 'Dall''iscritto', 'idea')$$), 'NEGATO: …');
reset role;
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('il tablet non vede niente', (select count(*)::text from segnalazioni), '0');
select atteso('e non scrive', tenta($$insert into segnalazioni (titolo, testo, categoria) values ('Io', 'Dal tablet', 'idea')$$), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 4. chi non ha fatto l''accesso ---'
select chi('');
set role anon;
select atteso('non legge', tenta($$select count(*)::text from segnalazioni$$), 'NEGATO: …');
select atteso('non scrive', tenta($$insert into segnalazioni (titolo, testo, categoria) values ('Io', 'Da fuori', 'idea')$$), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 4b. la categoria: idea o correzione ---'
-- Il filo nuovo la sceglie (la policy di insert, non un vincolo: i fili di
-- prima restano senza e si chiudono lo stesso); la risposta non ce l'ha; la
-- segreteria la cambia dopo, gli altri no.
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('apre un''idea',
  tenta($$insert into segnalazioni (id, titolo, testo, categoria)
    values ('eeeeeeee-0000-0000-0000-0000000000c1', 'Un tasto per stampare', 'Servirebbe al banco', 'idea')$$), 'FATTO (1 righe)');
select atteso('la categoria è quella', (select categoria from segnalazioni where id = 'eeeeeeee-0000-0000-0000-0000000000c1'), 'idea');
select atteso('una categoria che non c''è no',
  tenta($$insert into segnalazioni (titolo, testo, categoria) values ('Altro', 'Boh', 'altro')$$), 'NEGATO: …');
select atteso('un filo nuovo senza categoria no',
  tenta($$insert into segnalazioni (titolo, testo) values ('Senza', 'Niente categoria')$$), 'NEGATO: …');
select atteso('una risposta con la categoria no',
  tenta($$insert into segnalazioni (padre_id, testo, categoria)
    values ('eeeeeeee-0000-0000-0000-0000000000c1', 'Risposta', 'idea')$$), 'NEGATO: …');
select atteso('una risposta senza va',
  tenta($$insert into segnalazioni (id, padre_id, testo)
    values ('eeeeeeee-0000-0000-0000-0000000000c2', 'eeeeeeee-0000-0000-0000-0000000000c1', 'Anche per le ricevute')$$), 'FATTO (1 righe)');
reset role;
select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('un''altra segreteria la cambia',
  tenta($$update segnalazioni set categoria = 'correzione' where id = 'eeeeeeee-0000-0000-0000-0000000000c1'$$), 'FATTO (1 righe)');
select atteso('ed è cambiata', (select categoria from segnalazioni where id = 'eeeeeeee-0000-0000-0000-0000000000c1'), 'correzione');
select atteso('non in una che non c''è',
  tenta($$update segnalazioni set categoria = 'altro' where id = 'eeeeeeee-0000-0000-0000-0000000000c1'$$), 'NEGATO: …');
select atteso('a una risposta non si mette',
  tenta($$update segnalazioni set categoria = 'idea' where id = 'eeeeeeee-0000-0000-0000-0000000000c2'$$), 'a vuoto (0 righe)');
reset role;
select atteso('la risposta resta senza', coalesce((select categoria from segnalazioni where id = 'eeeeeeee-0000-0000-0000-0000000000c2'), 'nessuna'), 'nessuna');
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('l''istruttore non la cambia',
  tenta($$update segnalazioni set categoria = 'idea' where id = 'eeeeeeee-0000-0000-0000-0000000000c1'$$), 'a vuoto (0 righe)');
reset role;
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('l''iscritto nemmeno',
  tenta($$update segnalazioni set categoria = 'idea' where id = 'eeeeeeee-0000-0000-0000-0000000000c1'$$), 'a vuoto (0 righe)');
reset role;
select chi('');
set role anon;
select atteso('chi non ha l''accesso nemmeno',
  tenta($$update segnalazioni set categoria = 'idea' where id = 'eeeeeeee-0000-0000-0000-0000000000c1'$$), 'NEGATO: …');
reset role;
select atteso('ed è ancora una correzione', (select categoria from segnalazioni where id = 'eeeeeeee-0000-0000-0000-0000000000c1'), 'correzione');

-- Un filo di prima delle categorie: entrato senza, si chiude e si riapre.
insert into segnalazioni (id, autore_id, titolo, testo) values
  ('eeeeeeee-0000-0000-0000-0000000000c3', 'aaaaaaaa-0000-0000-0000-000000000001', 'Di prima', 'Senza categoria');
select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('un filo di prima si chiude',
  tenta($$update segnalazioni set chiusa_il = now() where id = 'eeeeeeee-0000-0000-0000-0000000000c3'$$), 'FATTO (1 righe)');
select atteso('e si riapre',
  tenta($$update segnalazioni set chiusa_il = null where id = 'eeeeeeee-0000-0000-0000-0000000000c3'$$), 'FATTO (1 righe)');
select atteso('gli si risponde',
  tenta($$insert into segnalazioni (padre_id, testo) values ('eeeeeeee-0000-0000-0000-0000000000c3', 'Vista')$$), 'FATTO (1 righe)');
select atteso('e gli si dà una categoria',
  tenta($$update segnalazioni set categoria = 'idea' where id = 'eeeeeeee-0000-0000-0000-0000000000c3'$$), 'FATTO (1 righe)');
reset role;

\echo ''
\echo '--- 5. rilanciato su un database con un filo senza titolo ---'
-- La prima versione del vincolo lasciava entrare un filo con titolo null
-- (scrivendo all'API: l'app lo chiede sempre). Rilanciare il file deve
-- dargli un titolo e rimettere il vincolo, non fermarsi a metà.
alter table segnalazioni drop constraint segnalazioni_check;
alter table segnalazioni add constraint segnalazioni_check
  check (padre_id is null and char_length(btrim(titolo)) between 1 and 120
      or padre_id is not null and titolo is null and chiusa_il is null);
insert into segnalazioni (id, autore_id, testo)
  values ('eeeeeeee-0000-0000-0000-000000000009', 'aaaaaaaa-0000-0000-0000-000000000001', 'Entrato senza titolo');
\ir ../25-segnalazioni.sql
select atteso('il vincolo nuovo c''è',
  (select count(*)::text from pg_constraint where conname = 'segnalazioni_check'
     and pg_get_constraintdef(oid) like '%titolo IS NOT NULL%'), '1');
select atteso('il filo ha un titolo',
  (select titolo from segnalazioni where id = 'eeeeeeee-0000-0000-0000-000000000009'), 'Senza titolo');
-- Rilanciato 25-, 38- rilanciato dopo rimette le sue regole sulla categoria.
\ir ../38-segnalazioni-categoria.sql
select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('dopo i due file, la segreteria cambia ancora la categoria',
  tenta($$update segnalazioni set categoria = 'idea' where id = 'eeeeeeee-0000-0000-0000-0000000000c1'$$), 'FATTO (1 righe)');
select atteso('e un filo nuovo senza categoria è ancora no',
  tenta($$insert into segnalazioni (titolo, testo) values ('Senza', 'Niente categoria')$$), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 6. gli allegati: il bucket e la tabella ---'
select atteso('il file nuovo c''è', coalesce(to_regclass('public.segnalazioni_allegati')::text, 'manca'), 'segnalazioni_allegati');
select atteso('il bucket è privato, 10 MB, solo immagini e PDF',
  (select public::text || ' ' || file_size_limit || ' ' || (select string_agg(t, ',' order by t) from unnest(allowed_mime_types) t)
     from storage.buckets where id = 'segnalazioni'),
  'false 10485760 application/pdf,image/heic,image/heif,image/jpeg,image/png,image/webp');

-- Anna e Bea scrivono ognuna un messaggio; i file stanno in <id messaggio>/<nome>.
insert into segnalazioni (id, autore_id, titolo, testo) values
  ('eeeeeeee-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-000000000001', 'Con allegati', 'Guarda lo screenshot');
insert into segnalazioni (id, padre_id, autore_id, testo) values
  ('eeeeeeee-0000-0000-0000-0000000000a2', 'eeeeeeee-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-000000000004', 'Anche io, ecco il PDF');

select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('carica il file nello Storage su un messaggio suo',
  tenta($$insert into storage.objects (bucket_id, name) values ('segnalazioni', 'eeeeeeee-0000-0000-0000-0000000000a1/schermata.png')$$), 'FATTO (1 righe)');
select atteso('registra l''allegato',
  tenta($$insert into segnalazioni_allegati (id, messaggio_id, nome, tipo, peso)
    values ('cccccccc-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-0000000000a1', 'schermata.png', 'image/png', 2048)$$), 'FATTO (1 righe)');
select atteso('l''autore è lei',
  (select p.nome from segnalazioni_allegati a join persone p on p.id = a.autore_id where a.id = 'cccccccc-0000-0000-0000-000000000001'), 'Anna');
select atteso('su un messaggio di Bea no',
  tenta($$insert into segnalazioni_allegati (messaggio_id, nome, tipo, peso)
    values ('eeeeeeee-0000-0000-0000-0000000000a2', 'intruso.png', 'image/png', 10)$$), 'NEGATO: …');
select atteso('nemmeno il file nello Storage',
  tenta($$insert into storage.objects (bucket_id, name) values ('segnalazioni', 'eeeeeeee-0000-0000-0000-0000000000a2/intruso.png')$$), 'NEGATO: …');
select atteso('a nome di Bea no',
  tenta($$insert into segnalazioni_allegati (messaggio_id, nome, tipo, peso, autore_id)
    values ('eeeeeeee-0000-0000-0000-0000000000a1', 'x.png', 'image/png', 10, 'aaaaaaaa-0000-0000-0000-000000000004')$$), 'NEGATO: …');
select atteso('un tipo non ammesso (.exe) no',
  tenta($$insert into segnalazioni_allegati (messaggio_id, nome, tipo, peso)
    values ('eeeeeeee-0000-0000-0000-0000000000a1', 'x.exe', 'application/x-msdownload', 10)$$), 'NEGATO: …');
select atteso('10 MB giusti vanno',
  tenta($$insert into segnalazioni_allegati (messaggio_id, nome, tipo, peso)
    values ('eeeeeeee-0000-0000-0000-0000000000a1', 'grande.pdf', 'application/pdf', 10485760)$$), 'FATTO (1 righe)');
select atteso('un byte di più no',
  tenta($$insert into segnalazioni_allegati (messaggio_id, nome, tipo, peso)
    values ('eeeeeeee-0000-0000-0000-0000000000a1', 'troppo.pdf', 'application/pdf', 10485761)$$), 'NEGATO: …');
-- Due righe insieme vedevano tutte e due lo stesso conteggio: dieci in
-- parallelo entravano tutte, e così due in una insert sola.
select atteso('due insieme, oltre il terzo, no',
  tenta($$insert into segnalazioni_allegati (messaggio_id, nome, tipo, peso)
    values ('eeeeeeee-0000-0000-0000-0000000000a1', 'terzo.webp', 'image/webp', 10), ('eeeeeeee-0000-0000-0000-0000000000a1', 'quarto.jpg', 'image/jpeg', 10)$$),
  'NEGATO: Questo messaggio ha già 3 allegati…');
select atteso('il terzo va',
  tenta($$insert into segnalazioni_allegati (messaggio_id, nome, tipo, peso)
    values ('eeeeeeee-0000-0000-0000-0000000000a1', 'terzo.webp', 'image/webp', 10)$$), 'FATTO (1 righe)');
select atteso('il quarto no',
  tenta($$insert into segnalazioni_allegati (messaggio_id, nome, tipo, peso)
    values ('eeeeeeee-0000-0000-0000-0000000000a1', 'quarto.jpg', 'image/jpeg', 10)$$), 'NEGATO: …');
select atteso('la riga non si cambia', tenta($$update segnalazioni_allegati set nome = 'altro.png'$$), 'NEGATO: …');
select atteso('né si cancella a mano', tenta($$delete from segnalazioni_allegati$$), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 7. chi li vede ---'
-- Il file di Anna e la riga ci sono; un'altra segreteria li vede, gli altri no.
insert into storage.objects (bucket_id, name) values ('segnalazioni', 'eeeeeeee-0000-0000-0000-0000000000a1/grande.pdf');
select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('un''altra segreteria vede le righe', (select count(*)::text from segnalazioni_allegati), '3');
select atteso('e i file', (select count(*)::text from storage.objects where bucket_id = 'segnalazioni'), '2');
reset role;
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('l''istruttore non vede le righe', (select count(*)::text from segnalazioni_allegati), '0');
select atteso('né i file', (select count(*)::text from storage.objects where bucket_id = 'segnalazioni'), '0');
select atteso('non allega',
  tenta($$insert into segnalazioni_allegati (messaggio_id, nome, tipo, peso)
    values ('eeeeeeee-0000-0000-0000-0000000000a1', 'i.png', 'image/png', 10)$$), 'NEGATO: …');
reset role;
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('l''iscritto non vede le righe', (select count(*)::text from segnalazioni_allegati), '0');
select atteso('né i file', (select count(*)::text from storage.objects where bucket_id = 'segnalazioni'), '0');
reset role;
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('il tablet non vede le righe', (select count(*)::text from segnalazioni_allegati), '0');
select atteso('né i file', (select count(*)::text from storage.objects where bucket_id = 'segnalazioni'), '0');
reset role;
select chi('');
set role anon;
select atteso('chi non ha l''accesso non legge', tenta($$select count(*)::text from segnalazioni_allegati$$), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 8. toglierlo: solo chi l''ha mandato ---'
select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('un''altra segreteria non lo toglie',
  tenta($$select togli_allegato('cccccccc-0000-0000-0000-000000000001')::text$$), 'NEGATO: …');
select atteso('il file di un altro non si cancella dallo Storage',
  tenta($$delete from storage.objects where bucket_id = 'segnalazioni' and name = 'eeeeeeee-0000-0000-0000-0000000000a1/schermata.png'$$), 'a vuoto (0 righe)');
reset role;
select atteso('è ancora lì', (select count(*)::text from segnalazioni_allegati where id = 'cccccccc-0000-0000-0000-000000000001'), '1');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('chi l''ha mandato lo toglie', tenta($$select togli_allegato('cccccccc-0000-0000-0000-000000000001')::text$$), '');
reset role;
select atteso('la riga non c''è più', (select count(*)::text from segnalazioni_allegati where id = 'cccccccc-0000-0000-0000-000000000001'), '0');
select atteso('né il file nello Storage',
  (select count(*)::text from storage.objects where bucket_id = 'segnalazioni' and name = 'eeeeeeee-0000-0000-0000-0000000000a1/schermata.png'), '0');
select atteso('il testo del messaggio è intatto',
  (select testo from segnalazioni where id = 'eeeeeeee-0000-0000-0000-0000000000a1'), 'Guarda lo screenshot');
select atteso('nel filo resta la traccia: chi e quando, non cosa',
  (select p.nome || ' ' || (t.tolto_il is not null)::text from segnalazioni_allegati_tolti t join persone p on p.id = t.tolto_da
     where t.messaggio_id = 'eeeeeeee-0000-0000-0000-0000000000a1'), 'Anna true');
select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('la traccia la vede la segreteria', (select count(*)::text from segnalazioni_allegati_tolti), '1');
select atteso('la traccia non si scrive a mano',
  tenta($$insert into segnalazioni_allegati_tolti (messaggio_id) values ('eeeeeeee-0000-0000-0000-0000000000a1')$$), 'NEGATO: …');
reset role;
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('l''istruttore non vede la traccia', (select count(*)::text from segnalazioni_allegati_tolti), '0');
reset role;

\echo ''
\echo '--- 9. la pulizia: 30 giorni dopo la chiusura ---'
-- Il filo a1 ha due allegati (grande.pdf, terzo.webp). Aperto, o chiuso da
-- meno di 30 giorni: restano. Chiuso da più: si tolgono, file e righe; i
-- messaggi no. L'allegato sta su un messaggio, la scadenza è quella del filo.
insert into segnalazioni_allegati (messaggio_id, nome, tipo, peso, autore_id)
  values ('eeeeeeee-0000-0000-0000-0000000000a2', 'bea.pdf', 'application/pdf', 10, 'aaaaaaaa-0000-0000-0000-000000000004');
insert into storage.objects (bucket_id, name) values ('segnalazioni', 'eeeeeeee-0000-0000-0000-0000000000a2/bea.pdf');
select atteso('aperto: non toglie niente', pulisci_allegati()::text, '0');
update segnalazioni set chiusa_il = now() - interval '29 days 23 hours' where id = 'eeeeeeee-0000-0000-0000-0000000000a1';
select atteso('chiuso da meno di 30 giorni: restano', pulisci_allegati()::text, '0');
select atteso('le righe sono tre', (select count(*)::text from segnalazioni_allegati), '3');
update segnalazioni set chiusa_il = now() - interval '30 days 1 hour' where id = 'eeeeeeee-0000-0000-0000-0000000000a1';
select atteso('chiuso da più di 30 giorni: toglie tutti e tre', pulisci_allegati()::text, '3');
select atteso('niente righe', (select count(*)::text from segnalazioni_allegati), '0');
select atteso('niente file', (select count(*)::text from storage.objects where bucket_id = 'segnalazioni'), '0');
select atteso('i messaggi restano', (select count(*)::text from segnalazioni where id in ('eeeeeeee-0000-0000-0000-0000000000a1', 'eeeeeeee-0000-0000-0000-0000000000a2')), '2');
select atteso('una seconda volta non trova niente', pulisci_allegati()::text, '0');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la pulizia non la lancia la segreteria', tenta($$select pulisci_allegati()::text$$), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 10. i file senza riga: il tetto, il filo chiuso, la pulizia ---'
-- Il limite di 3 vale per i file nello Storage, non solo per le righe: chi
-- carica i file e non scrive le righe non lo aggira.
insert into segnalazioni (id, autore_id, titolo, testo) values
  ('eeeeeeee-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-000000000001', 'Solo file', 'Senza righe');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('il primo file va', tenta($$insert into storage.objects (bucket_id, name) values ('segnalazioni', 'eeeeeeee-0000-0000-0000-0000000000b1/f1.png')$$), 'FATTO (1 righe)');
select atteso('il secondo va', tenta($$insert into storage.objects (bucket_id, name) values ('segnalazioni', 'eeeeeeee-0000-0000-0000-0000000000b1/f2.png')$$), 'FATTO (1 righe)');
select atteso('il terzo va', tenta($$insert into storage.objects (bucket_id, name) values ('segnalazioni', 'eeeeeeee-0000-0000-0000-0000000000b1/f3.png')$$), 'FATTO (1 righe)');
select atteso('il quarto no, anche senza righe', tenta($$insert into storage.objects (bucket_id, name) values ('segnalazioni', 'eeeeeeee-0000-0000-0000-0000000000b1/f4.png')$$), 'NEGATO: …');
reset role;
-- L'app carica dall'API di Storage, che prova la policy con una insert
-- annullata e scrive la riga vera da superutente, senza RLS: il limite deve
-- tenere anche lì. Il parallelo vero in psql non si fa: si guarda che il turno
-- venga prima del conteggio.
select atteso('il quarto no nemmeno dalla porta di Storage',
  tenta($$insert into storage.objects (bucket_id, name) values ('segnalazioni', 'eeeeeeee-0000-0000-0000-0000000000b1/f5.png')$$),
  'NEGATO: Questo messaggio ha già 3 allegati…');
select atteso('file e righe degli allegati si contano uno alla volta',
  (select string_agg(proname || ' ' || (strpos(prosrc, 'pg_advisory_xact_lock') between 1 and strpos(prosrc, 'count(*)'))::text, ', ' order by proname)
     from pg_proc where proname in ('limita_allegati', 'limita_file_allegati')),
  'limita_allegati true, limita_file_allegati true');

-- Su un filo chiuso non si allega più.
insert into segnalazioni (id, autore_id, titolo, testo, chiusa_il) values
  ('eeeeeeee-0000-0000-0000-0000000000b2', 'aaaaaaaa-0000-0000-0000-000000000001', 'Chiuso', 'Fatto', now() - interval '40 days');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('su un filo chiuso il file no', tenta($$insert into storage.objects (bucket_id, name) values ('segnalazioni', 'eeeeeeee-0000-0000-0000-0000000000b2/f1.png')$$), 'NEGATO: …');
select atteso('né la riga', tenta($$insert into segnalazioni_allegati (messaggio_id, nome, tipo, peso) values ('eeeeeeee-0000-0000-0000-0000000000b2', 'f1.png', 'image/png', 10)$$), 'NEGATO: …');
reset role;

-- Un file rimasto senza riga, su un filo chiuso da più di 30 giorni, se ne va
-- con la pulizia: la promessa è che i file spariscono, non solo le righe.
insert into storage.objects (bucket_id, name) values ('segnalazioni', 'eeeeeeee-0000-0000-0000-0000000000b2/orfano.png');
select atteso('la pulizia toglie anche il file senza riga', pulisci_allegati()::text, '0');
select atteso('e non resta nel contenitore',
  (select count(*)::text from storage.objects where bucket_id = 'segnalazioni' and name like 'eeeeeeee-0000-0000-0000-0000000000b2/%'), '0');
select atteso('quelli del filo aperto restano',
  (select count(*)::text from storage.objects where bucket_id = 'segnalazioni' and name like 'eeeeeeee-0000-0000-0000-0000000000b1/%'), '3');

-- Chi non è segreteria non scopre se un allegato esiste: la risposta è la stessa.
insert into segnalazioni_allegati (id, messaggio_id, nome, tipo, peso, autore_id)
  values ('cccccccc-0000-0000-0000-0000000000b1', 'eeeeeeee-0000-0000-0000-0000000000b1', 'f1.png', 'image/png', 10, 'aaaaaaaa-0000-0000-0000-000000000001');
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('l''iscritto riceve lo stesso no per un id vero e uno finto',
  tenta($$select togli_allegato('cccccccc-0000-0000-0000-0000000000b1')::text$$),
  tenta($$select togli_allegato('cccccccc-0000-0000-0000-00000000ffff')::text$$));
reset role;

\echo ''
\echo '--- 11. gli allegati: chi può, su quale messaggio, con che nome ---'
-- d1: filo aperto di Anna; d2: risposta di Bea; d3: risposta di Anna; d4: filo
-- chiuso di Anna; d5: sua risposta in un filo chiuso; d6: filo con 3 righe e
-- nessun file.
insert into segnalazioni (id, autore_id, titolo, testo) values
  ('eeeeeeee-0000-0000-0000-0000000000d1', 'aaaaaaaa-0000-0000-0000-000000000001', 'Aperto', 'Filo aperto');
insert into segnalazioni (id, padre_id, autore_id, testo) values
  ('eeeeeeee-0000-0000-0000-0000000000d2', 'eeeeeeee-0000-0000-0000-0000000000d1', 'aaaaaaaa-0000-0000-0000-000000000004', 'Di Bea'),
  ('eeeeeeee-0000-0000-0000-0000000000d3', 'eeeeeeee-0000-0000-0000-0000000000d1', 'aaaaaaaa-0000-0000-0000-000000000001', 'Di Anna');
insert into segnalazioni (id, autore_id, titolo, testo, chiusa_il) values
  ('eeeeeeee-0000-0000-0000-0000000000d4', 'aaaaaaaa-0000-0000-0000-000000000001', 'Chiuso da poco', 'Fatto', now());
insert into segnalazioni (id, padre_id, autore_id, testo) values
  ('eeeeeeee-0000-0000-0000-0000000000d5', 'eeeeeeee-0000-0000-0000-0000000000d4', 'aaaaaaaa-0000-0000-0000-000000000001', 'Risposta in un filo chiuso');
insert into segnalazioni (id, autore_id, titolo, testo) values
  ('eeeeeeee-0000-0000-0000-0000000000d6', 'aaaaaaaa-0000-0000-0000-000000000001', 'Tre righe', 'Righe senza file');
insert into segnalazioni_allegati (messaggio_id, nome, tipo, peso, autore_id)
  select 'eeeeeeee-0000-0000-0000-0000000000d6', 'r' || n || '.png', 'image/png', 10, 'aaaaaaaa-0000-0000-0000-000000000001' from generate_series(1, 3) n;

select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('una sua risposta in un filo aperto: il file va',
  tenta($$insert into storage.objects (bucket_id, name) values ('segnalazioni', 'eeeeeeee-0000-0000-0000-0000000000d3/r.png')$$), 'FATTO (1 righe)');
select atteso('e la riga',
  tenta($$insert into segnalazioni_allegati (messaggio_id, nome, tipo, peso) values ('eeeeeeee-0000-0000-0000-0000000000d3', 'r.png', 'image/png', 10)$$), 'FATTO (1 righe)');
select atteso('su una risposta di Bea no (file)',
  tenta($$insert into storage.objects (bucket_id, name) values ('segnalazioni', 'eeeeeeee-0000-0000-0000-0000000000d2/r.png')$$), 'NEGATO: …');
select atteso('su una risposta di Bea no (riga)',
  tenta($$insert into segnalazioni_allegati (messaggio_id, nome, tipo, peso) values ('eeeeeeee-0000-0000-0000-0000000000d2', 'r.png', 'image/png', 10)$$), 'NEGATO: …');
select atteso('su una sua risposta in un filo chiuso no (file)',
  tenta($$insert into storage.objects (bucket_id, name) values ('segnalazioni', 'eeeeeeee-0000-0000-0000-0000000000d5/r.png')$$), 'NEGATO: …');
select atteso('su una sua risposta in un filo chiuso no (riga)',
  tenta($$insert into segnalazioni_allegati (messaggio_id, nome, tipo, peso) values ('eeeeeeee-0000-0000-0000-0000000000d5', 'r.png', 'image/png', 10)$$), 'NEGATO: …');
select atteso('su un messaggio che non c''è no',
  tenta($$insert into storage.objects (bucket_id, name) values ('segnalazioni', 'eeeeeeee-0000-0000-0000-0000000000ff/r.png')$$), 'NEGATO: …');
select atteso('con tre righe già scritte il file non va',
  tenta($$insert into storage.objects (bucket_id, name) values ('segnalazioni', 'eeeeeeee-0000-0000-0000-0000000000d6/nuovo.png')$$), 'NEGATO: …');
-- Il nome deve essere <id del messaggio>/<nome>, con un nome solo.
select atteso('un nome senza cartella no',
  tenta($$insert into storage.objects (bucket_id, name) values ('segnalazioni', 'r.png')$$), 'NEGATO: …');
select atteso('una cartella che non è un id no',
  tenta($$insert into storage.objects (bucket_id, name) values ('segnalazioni', 'cartella/r.png')$$), 'NEGATO: …');
select atteso('un nome vuoto no',
  tenta($$insert into storage.objects (bucket_id, name) values ('segnalazioni', 'eeeeeeee-0000-0000-0000-0000000000d1/')$$), 'NEGATO: …');
select atteso('un sotto-percorso no',
  tenta($$insert into storage.objects (bucket_id, name) values ('segnalazioni', 'eeeeeeee-0000-0000-0000-0000000000d1/a/r.png')$$), 'NEGATO: …');
select atteso('un nome di 201 caratteri no',
  tenta($$insert into storage.objects (bucket_id, name) values ('segnalazioni', 'eeeeeeee-0000-0000-0000-0000000000d1/' || repeat('a', 201))$$), 'NEGATO: …');
select atteso('uno di 200 va',
  tenta($$insert into storage.objects (bucket_id, name) values ('segnalazioni', 'eeeeeeee-0000-0000-0000-0000000000d1/' || repeat('a', 200))$$), 'FATTO (1 righe)');
-- La riga: nome, tipi e peso (i tipi ammessi sono quelli del contenitore).
select atteso('una riga senza nome no',
  tenta($$insert into segnalazioni_allegati (messaggio_id, nome, tipo, peso) values ('eeeeeeee-0000-0000-0000-0000000000d1', '', 'image/png', 10)$$), 'NEGATO: …');
select atteso('una riga con nome di 201 caratteri no',
  tenta($$insert into segnalazioni_allegati (messaggio_id, nome, tipo, peso) values ('eeeeeeee-0000-0000-0000-0000000000d1', repeat('a', 201), 'image/png', 10)$$), 'NEGATO: …');
select atteso('un peso negativo no',
  tenta($$insert into segnalazioni_allegati (messaggio_id, nome, tipo, peso) values ('eeeeeeee-0000-0000-0000-0000000000d1', 'n.png', 'image/png', -1)$$), 'NEGATO: …');
select atteso('una GIF no',
  tenta($$insert into segnalazioni_allegati (messaggio_id, nome, tipo, peso) values ('eeeeeeee-0000-0000-0000-0000000000d1', 'g.gif', 'image/gif', 10)$$), 'NEGATO: …');
select atteso('un HEIC va',
  tenta($$insert into segnalazioni_allegati (messaggio_id, nome, tipo, peso) values ('eeeeeeee-0000-0000-0000-0000000000d1', 'f.heic', 'image/heic', 10)$$), 'FATTO (1 righe)');
select atteso('il controllo dice sì sul suo messaggio', (select puo_allegare('eeeeeeee-0000-0000-0000-0000000000d1')::text), 'true');
select atteso('no su quello di Bea', (select puo_allegare('eeeeeeee-0000-0000-0000-0000000000d2')::text), 'false');
select atteso('no con tre righe', (select puo_allegare('eeeeeeee-0000-0000-0000-0000000000d6')::text), 'false');
select atteso('no in un filo chiuso', (select puo_allegare('eeeeeeee-0000-0000-0000-0000000000d5')::text), 'false');
select atteso('il file di un messaggio suo lo cancella lei',
  tenta($$delete from storage.objects where bucket_id = 'segnalazioni' and name = 'eeeeeeee-0000-0000-0000-0000000000d3/r.png'$$), 'FATTO (1 righe)');
select atteso('un file non si rinomina verso un altro messaggio',
  tenta($$update storage.objects set name = 'eeeeeeee-0000-0000-0000-0000000000d6/x.png' where bucket_id = 'segnalazioni' and name like 'eeeeeeee-0000-0000-0000-0000000000d1/a%'$$), 'a vuoto (0 righe)');
select atteso('togliere un allegato che non c''è dice che non c''è più',
  tenta($$select togli_allegato('cccccccc-0000-0000-0000-00000000fff0')::text$$), 'NEGATO: Questo allegato non c''è più');
reset role;

select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('Bea sulla sua risposta: il file va',
  tenta($$insert into storage.objects (bucket_id, name) values ('segnalazioni', 'eeeeeeee-0000-0000-0000-0000000000d2/b.png')$$), 'FATTO (1 righe)');
select atteso('Bea su una risposta di Anna no',
  tenta($$insert into storage.objects (bucket_id, name) values ('segnalazioni', 'eeeeeeee-0000-0000-0000-0000000000d3/b.png')$$), 'NEGATO: …');
select atteso('Bea sul filo di Anna no (riga)',
  tenta($$insert into segnalazioni_allegati (messaggio_id, nome, tipo, peso) values ('eeeeeeee-0000-0000-0000-0000000000d1', 'b.png', 'image/png', 10)$$), 'NEGATO: …');
select atteso('Bea non cancella il file di Anna',
  tenta($$delete from storage.objects where bucket_id = 'segnalazioni' and name like 'eeeeeeee-0000-0000-0000-0000000000d1/a%'$$), 'a vuoto (0 righe)');
reset role;

-- Gli altri: nessuno carica, nessuno scrive righe, nessuno cancella.
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('l''istruttore non carica file',
  tenta($$insert into storage.objects (bucket_id, name) values ('segnalazioni', 'eeeeeeee-0000-0000-0000-0000000000d1/i.png')$$), 'NEGATO: …');
select atteso('non cancella file', tenta($$delete from storage.objects where bucket_id = 'segnalazioni'$$), 'a vuoto (0 righe)');
select atteso('il controllo dice no', (select puo_allegare('eeeeeeee-0000-0000-0000-0000000000d1')::text), 'false');
select atteso('e per il file no',
  (select puo_caricare_allegato('eeeeeeee-0000-0000-0000-0000000000d1/i.png')::text), 'false');
select atteso('non toglie un allegato', tenta($$select togli_allegato('cccccccc-0000-0000-0000-0000000000b1')::text$$), 'NEGATO: …');
reset role;
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('l''iscritto non carica file',
  tenta($$insert into storage.objects (bucket_id, name) values ('segnalazioni', 'eeeeeeee-0000-0000-0000-0000000000d1/i.png')$$), 'NEGATO: …');
select atteso('non cancella file', tenta($$delete from storage.objects where bucket_id = 'segnalazioni'$$), 'a vuoto (0 righe)');
select atteso('non scrive righe',
  tenta($$insert into segnalazioni_allegati (messaggio_id, nome, tipo, peso) values ('eeeeeeee-0000-0000-0000-0000000000d1', 'i.png', 'image/png', 10)$$), 'NEGATO: …');
reset role;
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('il tablet non carica file',
  tenta($$insert into storage.objects (bucket_id, name) values ('segnalazioni', 'eeeeeeee-0000-0000-0000-0000000000d1/t.png')$$), 'NEGATO: …');
select atteso('né scrive righe',
  tenta($$insert into segnalazioni_allegati (messaggio_id, nome, tipo, peso) values ('eeeeeeee-0000-0000-0000-0000000000d1', 't.png', 'image/png', 10)$$), 'NEGATO: …');
reset role;
select chi('');
set role anon;
select atteso('chi non ha l''accesso non carica file',
  tenta($$insert into storage.objects (bucket_id, name) values ('segnalazioni', 'eeeeeeee-0000-0000-0000-0000000000d1/a.png')$$), 'NEGATO: …');
select atteso('non scrive righe',
  tenta($$insert into segnalazioni_allegati (messaggio_id, nome, tipo, peso) values ('eeeeeeee-0000-0000-0000-0000000000d1', 'a.png', 'image/png', 10)$$), 'NEGATO: …');
select atteso('non legge i file', tenta($$select count(*)::text from storage.objects where bucket_id = 'segnalazioni'$$), '0');
select atteso('non cancella file', tenta($$delete from storage.objects where bucket_id = 'segnalazioni'$$), 'a vuoto (0 righe)');
select atteso('non chiama il controllo', tenta($$select puo_allegare('eeeeeeee-0000-0000-0000-0000000000d1')::text$$), 'NEGATO: …');
select atteso('né quello del file', tenta($$select puo_caricare_allegato('eeeeeeee-0000-0000-0000-0000000000d1/a.png')::text$$), 'NEGATO: …');
select atteso('né toglie un allegato', tenta($$select togli_allegato('cccccccc-0000-0000-0000-0000000000b1')::text$$), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 12. chi era segreteria e non lo è più ---'
-- Il messaggio resta suo (autore_id), il filo è aperto: a fermarlo è solo
-- `e_staff()` dentro `puo_allegare`. Dario scrive da segreteria, poi gli
-- cambiano il ruolo (le segnalazioni non lo impediscono: restano a suo nome).
insert into auth.users (id, email) values ('77777777-7777-7777-7777-777777777777', 'dario@ods.it');
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000007', 'Dario', 'Ex', 'staff', 'dario@ods.it', '77777777-7777-7777-7777-777777777777');
insert into segnalazioni (id, autore_id, titolo, testo) values
  ('eeeeeeee-0000-0000-0000-0000000000e1', 'aaaaaaaa-0000-0000-0000-000000000007', 'Di Dario', 'Scritto da segreteria');

select chi('77777777-7777-7777-7777-777777777777');
set role authenticated;
select atteso('finché è segreteria, il controllo dice sì',
  (select puo_allegare('eeeeeeee-0000-0000-0000-0000000000e1')::text), 'true');
reset role;

update persone set ruolo = 'istruttore' where id = 'aaaaaaaa-0000-0000-0000-000000000007';
select chi('77777777-7777-7777-7777-777777777777');
select atteso('(da superutente) il messaggio è ancora a suo nome',
  (select autore_id::text from segnalazioni where id = 'eeeeeeee-0000-0000-0000-0000000000e1'), 'aaaaaaaa-0000-0000-0000-000000000007');
set role authenticated;
select atteso('ma il controllo dice no', (select puo_allegare('eeeeeeee-0000-0000-0000-0000000000e1')::text), 'false');
select atteso('e per il file no',
  (select puo_caricare_allegato('eeeeeeee-0000-0000-0000-0000000000e1/d.png')::text), 'false');
select atteso('il file non si carica',
  tenta($$insert into storage.objects (bucket_id, name) values ('segnalazioni', 'eeeeeeee-0000-0000-0000-0000000000e1/d.png')$$), 'NEGATO: …');
select atteso('la riga non si scrive',
  tenta($$insert into segnalazioni_allegati (messaggio_id, nome, tipo, peso) values ('eeeeeeee-0000-0000-0000-0000000000e1', 'd.png', 'image/png', 10)$$), 'NEGATO: …');
reset role;

-- Stesso con l'accesso tolto (`attiva = false`): ruolo_corrente() è null.
update persone set ruolo = 'staff', attiva = false where id = 'aaaaaaaa-0000-0000-0000-000000000007';
set role authenticated;
select atteso('con l''accesso tolto il controllo dice no',
  (select puo_allegare('eeeeeeee-0000-0000-0000-0000000000e1')::text), 'false');
reset role;
