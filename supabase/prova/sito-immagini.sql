-- Le immagini del sito (pannello SITO): il contenitore «sito» è pubblico in
-- lettura (le pagine le mostrano a chiunque), ma le carica e le cancella solo
-- la segreteria, e solo con un nome fatto da un uuid minuscolo e dall'estensione
-- (.jpg, .png, .webp): niente cartelle, niente .html, niente nomi di chi carica.
-- Gli stessi casi di `scripts/prova-sito.mjs` (sezione Immagini).
-- Si lancia dopo finto-supabase.sql, i file dello schema e 58-sito-immagini.sql.
\set ON_ERROR_STOP on

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'maura@ods.it'),
  ('33333333-3333-3333-3333-333333333333', 'luca@ods.it'),
  ('66666666-6666-6666-6666-666666666666', 'lotta@sale.ods-corsi.it');
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Maura', 'Uno', 'istruttore', 'maura@ods.it', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Luca', 'Rossi', 'iscritto', 'luca@ods.it', '33333333-3333-3333-3333-333333333333');
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

-- Il contenitore: pubblico, piccolo, solo immagini.
select atteso('il contenitore «sito» c''è ed è pubblico', (select public::text from storage.buckets where id = 'sito'), 'true');
select atteso('pesa al massimo 1 MB', (select file_size_limit::text from storage.buckets where id = 'sito'), '1048576');
select atteso('solo jpeg, png e webp', (select array_to_string(array(select unnest(allowed_mime_types) order by 1), ',') from storage.buckets where id = 'sito'), 'image/jpeg,image/png,image/webp');
select atteso('tre policy sui file del sito (carica, vede, cancella), nessuna di modifica',
  (select count(*)::text from pg_policies where schemaname = 'storage' and tablename = 'objects'
     and (qual like '%''sito''%' or with_check like '%''sito''%')), '3');

-- La segreteria.
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria carica uuid.jpg', tenta($$insert into storage.objects (bucket_id, name) values ('sito', '0b9f6c1e-3a4d-4c1b-8e2a-5d7f9a1c2b3e.jpg')$$), 'FATTO (1 righe)');
select atteso('anche .png', tenta($$insert into storage.objects (bucket_id, name) values ('sito', '1b9f6c1e-3a4d-4c1b-8e2a-5d7f9a1c2b3e.png')$$), 'FATTO (1 righe)');
select atteso('anche .webp', tenta($$insert into storage.objects (bucket_id, name) values ('sito', '2b9f6c1e-3a4d-4c1b-8e2a-5d7f9a1c2b3e.webp')$$), 'FATTO (1 righe)');
select atteso('e le vede', (select count(*)::text from storage.objects where bucket_id = 'sito'), '3');
select atteso('«pagina.html» no', tenta($$insert into storage.objects (bucket_id, name) values ('sito', 'pagina.html')$$), 'NEGATO: …');
select atteso('un uuid con .html no', tenta($$insert into storage.objects (bucket_id, name) values ('sito', '3b9f6c1e-3a4d-4c1b-8e2a-5d7f9a1c2b3e.html')$$), 'NEGATO: …');
select atteso('una cartella («a/b.jpg») no', tenta($$insert into storage.objects (bucket_id, name) values ('sito', 'a/b.jpg')$$), 'NEGATO: …');
select atteso('un uuid dentro una cartella no', tenta($$insert into storage.objects (bucket_id, name) values ('sito', 'x/3b9f6c1e-3a4d-4c1b-8e2a-5d7f9a1c2b3e.jpg')$$), 'NEGATO: …');
select atteso('il nome di chi carica («Foto Mario.JPG») no', tenta($$insert into storage.objects (bucket_id, name) values ('sito', 'Foto Mario.JPG')$$), 'NEGATO: …');
select atteso('un uuid maiuscolo no', tenta($$insert into storage.objects (bucket_id, name) values ('sito', '3B9F6C1E-3A4D-4C1B-8E2A-5D7F9A1C2B3E.jpg')$$), 'NEGATO: …');
select atteso('un uuid con estensione maiuscola no', tenta($$insert into storage.objects (bucket_id, name) values ('sito', '3b9f6c1e-3a4d-4c1b-8e2a-5d7f9a1c2b3e.JPG')$$), 'NEGATO: …');
select atteso('e la segreteria cancella', tenta($$delete from storage.objects where bucket_id = 'sito' and name = '2b9f6c1e-3a4d-4c1b-8e2a-5d7f9a1c2b3e.webp'$$), 'FATTO (1 righe)');
reset role;

-- Chi è autenticato ma non è segreteria: istruttore, iscritto, tablet.
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('un istruttore non carica', tenta($$insert into storage.objects (bucket_id, name) values ('sito', '4b9f6c1e-3a4d-4c1b-8e2a-5d7f9a1c2b3e.jpg')$$), 'NEGATO: …');
select atteso('né cancella', tenta($$delete from storage.objects where bucket_id = 'sito'$$), 'a vuoto (0 righe)');
select atteso('né elenca', (select count(*)::text from storage.objects where bucket_id = 'sito'), '0');
reset role;
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('un iscritto non carica', tenta($$insert into storage.objects (bucket_id, name) values ('sito', '4b9f6c1e-3a4d-4c1b-8e2a-5d7f9a1c2b3e.jpg')$$), 'NEGATO: …');
select atteso('né cancella', tenta($$delete from storage.objects where bucket_id = 'sito'$$), 'a vuoto (0 righe)');
reset role;
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('il tablet non carica', tenta($$insert into storage.objects (bucket_id, name) values ('sito', '4b9f6c1e-3a4d-4c1b-8e2a-5d7f9a1c2b3e.jpg')$$), 'NEGATO: …');
select atteso('né cancella', tenta($$delete from storage.objects where bucket_id = 'sito'$$), 'a vuoto (0 righe)');
reset role;

-- Chi non ha un accesso: i file si leggono dall'indirizzo pubblico, non dalla tabella.
select chi('');
set role anon;
select atteso('chi non ha un accesso non carica', tenta($$insert into storage.objects (bucket_id, name) values ('sito', '4b9f6c1e-3a4d-4c1b-8e2a-5d7f9a1c2b3e.jpg')$$), 'NEGATO: …');
select atteso('né cancella', tenta($$delete from storage.objects where bucket_id = 'sito'$$), 'a vuoto (0 righe)');
select atteso('né elenca', (select count(*)::text from storage.objects where bucket_id = 'sito'), '0');
reset role;
select atteso('i due file della segreteria sono ancora lì', (select count(*)::text from storage.objects where bucket_id = 'sito'), '2');

\echo ''
\echo 'Immagini del sito: tutto a posto.'
