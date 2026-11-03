-- Dove stanno le persone in ogni foto del sito (pannello SITO › Immagini):
-- un punto x,y in percentuale per foto, nella tabella `sito_punti`. La scrive e
-- la legge solo la segreteria; il generatore del sito (chiave anon) legge solo
-- `sito_punti_pubblici()`, che dice nome, x, y e nient'altro. Il file 138 mette
-- i punti di partenza e si rilancia senza duplicarli né sovrascrivere quelli cambiati.
-- Gli stessi casi, nella metà di prova, in `scripts/prova-sito.mjs` (segreteriaProva).
-- Si lancia dopo finto-supabase.sql e i file dello schema, 138-sito-punti.sql compreso.
\set ON_ERROR_STOP on

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'maura@ods.it'),
  ('33333333-3333-3333-3333-333333333333', 'luca@ods.it');
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Maura', 'Uno', 'istruttore', 'maura@ods.it', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Luca', 'Rossi', 'iscritto', 'luca@ods.it', '33333333-3333-3333-3333-333333333333');

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

select count(*) as partenza from sito_punti \gset
\echo ''
\echo '--- 1. i punti di partenza ci sono ---'
select atteso('ci sono tutti i 37 punti del codice', :'partenza', '37');
select atteso('la foto dei judoka parte da 50,0', (select x || ',' || y from sito_punti where nome = '2c07ede0-631c-46b8-92d2-5ba6f421527c.jpg'), '50,0');
select atteso('la foto di aikido parte da 50,5', (select x || ',' || y from sito_punti where nome = 'fbfe492b-1c27-400d-bd74-983f26de7ffe.jpg'), '50,5');
select atteso('la foto degli istruttori parte da 50,25', (select x || ',' || y from sito_punti where nome = '814a717b-91a2-441c-b34c-ef376d4781c6.jpg'), '50,25');

\echo ''
\echo '--- 2. chi non ha un accesso legge solo la funzione ---'
select chi('');
set role anon;
select atteso('la funzione pubblica dà i punti', tenta($$select x || ',' || y from sito_punti_pubblici() where nome = '814a717b-91a2-441c-b34c-ef376d4781c6.jpg'$$), '50,25');
select atteso('solo nome, x e y', tenta($$select string_agg(k, ', ' order by k) from (select distinct jsonb_object_keys(to_jsonb(p)) k from sito_punti_pubblici() p) x$$), 'nome, x, y');
select atteso('la tabella non si legge', tenta($$select count(*)::text from sito_punti$$), 'NEGATO: …');
select atteso('non scrive', tenta($$insert into sito_punti (nome, x, y) values ('0b9f6c1e-3a4d-4c1b-8e2a-5d7f9a1c2b3e.jpg', 10, 10)$$), 'NEGATO: …');
select atteso('non aggiorna', tenta($$update sito_punti set x = 1$$), 'NEGATO: …');
select atteso('non cancella', tenta($$delete from sito_punti$$), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 3. un istruttore e un iscritto non scrivono ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('l’istruttore non scrive', tenta($$insert into sito_punti (nome, x, y) values ('0b9f6c1e-3a4d-4c1b-8e2a-5d7f9a1c2b3e.jpg', 10, 10)$$), 'NEGATO: …');
select atteso('non aggiorna', tenta($$update sito_punti set x = 1$$), 'a vuoto (0 righe)');
select atteso('non cancella', tenta($$delete from sito_punti$$), 'a vuoto (0 righe)');
select atteso('non vede la tabella', tenta($$select count(*)::text from sito_punti$$), '0');
select atteso('la funzione pubblica la vede lo stesso', tenta($$select count(*)::text from sito_punti_pubblici()$$), :'partenza');
reset role;
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('l’iscritto non scrive', tenta($$insert into sito_punti (nome, x, y) values ('0b9f6c1e-3a4d-4c1b-8e2a-5d7f9a1c2b3e.jpg', 10, 10)$$), 'NEGATO: …');
select atteso('non aggiorna', tenta($$update sito_punti set x = 1$$), 'a vuoto (0 righe)');
select atteso('non cancella', tenta($$delete from sito_punti$$), 'a vuoto (0 righe)');
reset role;

\echo ''
\echo '--- 4. la segreteria scrive, aggiorna, cancella ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('vede i punti', tenta($$select count(*)::text from sito_punti$$), :'partenza');
select atteso('aggiunge un punto', tenta($$insert into sito_punti (nome, x, y) values ('0b9f6c1e-3a4d-4c1b-8e2a-5d7f9a1c2b3e.jpg', 30, 70)$$), 'FATTO (1 righe)');
select atteso('anche .png e .webp', tenta($$insert into sito_punti (nome, x, y) values ('1b9f6c1e-3a4d-4c1b-8e2a-5d7f9a1c2b3e.png', 0, 100), ('2b9f6c1e-3a4d-4c1b-8e2a-5d7f9a1c2b3e.webp', 100, 0)$$), 'FATTO (2 righe)');
select atteso('lo sposta', tenta($$update sito_punti set x = 40, y = 60 where nome = '0b9f6c1e-3a4d-4c1b-8e2a-5d7f9a1c2b3e.jpg'$$), 'FATTO (1 righe)');
select atteso('la funzione pubblica lo dà spostato', tenta($$select x || ',' || y from sito_punti_pubblici() where nome = '0b9f6c1e-3a4d-4c1b-8e2a-5d7f9a1c2b3e.jpg'$$), '40,60');
select atteso('cambiato_il c’è', tenta($$select (cambiato_il is not null)::text from sito_punti where nome = '0b9f6c1e-3a4d-4c1b-8e2a-5d7f9a1c2b3e.jpg'$$), 'true');
select atteso('x = 101 no', tenta($$insert into sito_punti (nome, x, y) values ('3b9f6c1e-3a4d-4c1b-8e2a-5d7f9a1c2b3e.jpg', 101, 50)$$), 'NEGATO: …');
select atteso('y = -1 no', tenta($$insert into sito_punti (nome, x, y) values ('3b9f6c1e-3a4d-4c1b-8e2a-5d7f9a1c2b3e.jpg', 50, -1)$$), 'NEGATO: …');
select atteso('spostarlo fuori dalla foto no', tenta($$update sito_punti set x = 101 where nome = '0b9f6c1e-3a4d-4c1b-8e2a-5d7f9a1c2b3e.jpg'$$), 'NEGATO: …');
select atteso('«a.html» no', tenta($$insert into sito_punti (nome, x, y) values ('a.html', 50, 50)$$), 'NEGATO: …');
select atteso('un uuid con .html no', tenta($$insert into sito_punti (nome, x, y) values ('3b9f6c1e-3a4d-4c1b-8e2a-5d7f9a1c2b3e.html', 50, 50)$$), 'NEGATO: …');
select atteso('un nome con «/» no', tenta($$insert into sito_punti (nome, x, y) values ('x/3b9f6c1e-3a4d-4c1b-8e2a-5d7f9a1c2b3e.jpg', 50, 50)$$), 'NEGATO: …');
select atteso('un uuid maiuscolo no', tenta($$insert into sito_punti (nome, x, y) values ('3B9F6C1E-3A4D-4C1B-8E2A-5D7F9A1C2B3E.jpg', 50, 50)$$), 'NEGATO: …');
select atteso('lo stesso nome due volte no', tenta($$insert into sito_punti (nome, x, y) values ('0b9f6c1e-3a4d-4c1b-8e2a-5d7f9a1c2b3e.jpg', 1, 1)$$), 'NEGATO: …');
select atteso('cancella un punto', tenta($$delete from sito_punti where nome = '2b9f6c1e-3a4d-4c1b-8e2a-5d7f9a1c2b3e.webp'$$), 'FATTO (1 righe)');
reset role;

\echo ''
\echo '--- 5. rilanciare il file non duplica né sovrascrive ---'
update sito_punti set x = 7, y = 9 where nome = '814a717b-91a2-441c-b34c-ef376d4781c6.jpg';
select count(*) as prima from sito_punti \gset
\i supabase/138-sito-punti.sql
select atteso('i punti sono gli stessi di prima', (select count(*)::text from sito_punti), :'prima');
select atteso('un punto cambiato resta com’è', (select x || ',' || y from sito_punti where nome = '814a717b-91a2-441c-b34c-ef376d4781c6.jpg'), '7,9');
select atteso('un punto di partenza c’è ancora', (select x || ',' || y from sito_punti where nome = '2c07ede0-631c-46b8-92d2-5ba6f421527c.jpg'), '50,0');

\echo ''
\echo 'Punti delle foto del sito: tutto a posto.'
