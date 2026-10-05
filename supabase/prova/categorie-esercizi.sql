-- Una sola categorizzazione degli esercizi: le vecchie categorie (A corpo
-- libero, Attrezzi, Core, Cardio, Mobilità) diventano voci dell'elenco delle
-- discipline (impostazioni.discipline), accanto a Judo, Lotta, Pilates, Yoga;
-- gli esercizi (impostazioni.esercizi) perdono il campo `categoria`. Una
-- disciplina scritta vince; se non c'è, la categoria diventa la voce con lo
-- stesso nome («Judo» compreso); «tutte» resta com'è.
-- `42-categorie-esercizi.sql` si deve poter rilanciare: la prova lo lancia
-- più volte, su dati vecchi e su dati già convertiti.
-- Si lancia dopo finto-supabase.sql e tutti i file dello schema.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'maura@ods.it'),
  ('66666666-6666-6666-6666-666666666666', 'lotta@sale.ods-corsi.it');
insert into persone (id, nome, cognome, ruolo, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Maura', 'Uno', 'istruttore', '22222222-2222-2222-2222-222222222222');
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

-- L'elenco delle voci, e gli esercizi come «nome=voce» (un trattino se non ne hanno).
create or replace function voci() returns text language sql as $$
  select string_agg(d->>'id', ', ' order by ord) from impostazioni, jsonb_array_elements(discipline) with ordinality as t(d, ord) $$;
create or replace function esercizi_letti() returns text language sql as $$
  select string_agg((e->>'nome') || '=' || coalesce(e->>'disciplina', '-'), ', ' order by ord)
  from impostazioni, jsonb_array_elements(esercizi) with ordinality as t(e, ord) $$;
-- Quanti esercizi hanno ancora una chiave che non sia id, nome, disciplina.
create or replace function esercizi_con_altro() returns text language sql as $$
  select count(*)::text from impostazioni, jsonb_array_elements(esercizi) e,
    lateral (select 1 from jsonb_object_keys(e) k where k not in ('id', 'nome', 'disciplina') limit 1) altro $$;

\echo ''
\echo '--- 1. Dati di prima: l''elenco di sempre e gli esercizi con la categoria ---'
update impostazioni set
  discipline = '[{"id":"judo","nome":"Judo"},{"id":"lotta","nome":"Lotta"},{"id":"pilates","nome":"Pilates"},{"id":"yoga","nome":"Yoga"}]',
  esercizi = '[
    {"id":"a","nome":"Squat","categoria":"Core"},
    {"id":"b","nome":"Randori","categoria":"A corpo libero","disciplina":"judo"},
    {"id":"c","nome":"Ukemi","categoria":"Judo"},
    {"id":"d","nome":"Burpee","categoria":"A corpo libero"},
    {"id":"e","nome":"Corsa","categoria":"Cardio","disciplina":"tutte"},
    {"id":"f","nome":"Libero"},
    {"id":"g","nome":"Asana","categoria":"Mobilità","disciplina":"yoga"},
    {"id":"h","nome":"Kata","categoria":"A corpo libero","disciplina":"karate"},
    {"id":"i","nome":"Strano","categoria":"Boh"},
    {"id":"j","nome":"Presa","categoria":"Judo","disciplina":"lotta"},
    {"id":"k","nome":"Panca","categoria":"Attrezzi"},
    {"id":"l","nome":"Plank","disciplina":"core"}
  ]';
select atteso('prima: quattro voci', voci(), 'judo, lotta, pilates, yoga');

\ir ../42-categorie-esercizi.sql

\echo ''
\echo '--- 2. Dopo: cinque voci in più, una sola categorizzazione ---'
select atteso('le cinque ex categorie accanto alle quattro, nell''ordine',
  voci(), 'judo, lotta, pilates, yoga, corpo-libero, attrezzi, core, cardio, mobilita');
select atteso('con i loro nomi',
  (select string_agg(d->>'nome', ', ') from impostazioni, jsonb_array_elements(discipline) d where d->>'id' in ('corpo-libero', 'attrezzi', 'core', 'cardio', 'mobilita')),
  'A corpo libero, Attrezzi, Core, Cardio, Mobilità');
select atteso('«Tutte» non è una voce', (select count(*)::text from impostazioni, jsonb_array_elements(discipline) d where d->>'id' = 'tutte' or d->>'nome' = 'Tutte'), '0');
select atteso('gli esercizi: vince la disciplina, se no la categoria diventa la voce, «tutte» e le altre restano',
  esercizi_letti(),
  'Squat=core, Randori=judo, Ukemi=judo, Burpee=corpo-libero, Corsa=tutte, Libero=-, Asana=yoga, Kata=karate, Strano=-, Presa=lotta, Panca=attrezzi, Plank=core');
select atteso('nessun esercizio ha più la categoria (restano id, nome e voce)',
  (select count(*)::text from impostazioni, jsonb_array_elements(esercizi) e where e ? 'categoria'), '0');
select atteso('né altre chiavi', esercizi_con_altro(), '0');
select atteso('id e ordine non cambiano', (select string_agg(e->>'id', '' order by ord) from impostazioni, jsonb_array_elements(esercizi) with ordinality t(e, ord)), 'abcdefghijkl');
select atteso('un esercizio senza voce non ne riceve una',
  (select (e ? 'disciplina')::text from impostazioni, jsonb_array_elements(esercizi) e where e->>'nome' = 'Libero'), 'false');
select atteso('l''elenco nuovo sta nei limiti dell''app (20 voci, 4000 byte)',
  (select (jsonb_array_length(discipline) <= 20 and octet_length(discipline::text) <= 4000)::text from impostazioni), 'true');
select atteso('una riga nuova parte con le nove voci (il valore di partenza della colonna)',
  (select (pg_get_expr(d.adbin, d.adrelid) like '%corpo-libero%' and pg_get_expr(d.adbin, d.adrelid) like '%mobilita%')::text
   from pg_attrdef d join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
   where d.adrelid = 'impostazioni'::regclass and a.attname = 'discipline'), 'true');

\echo ''
\echo '--- 3. Rilanciarlo non cambia niente ---'
create temp table dopo as select discipline, esercizi from impostazioni;
\ir ../42-categorie-esercizi.sql
select atteso('stesse voci, stessi esercizi', (select (i.discipline = d.discipline and i.esercizi = d.esercizi)::text from impostazioni i, dopo d), 'true');
select atteso('sempre nove voci', (select jsonb_array_length(discipline)::text from impostazioni), '9');

\echo ''
\echo '--- 4. Un elenco che la segreteria ha già cambiato ---'
update impostazioni set
  discipline = '[{"id":"lotta","nome":"Lotta"},{"id":"karate","nome":"Karate"},{"id":"core","nome":"Il mio core"}]',
  esercizi = '[{"id":"a","nome":"Squat","categoria":"Core"},{"id":"b","nome":"Mawashi","categoria":"A corpo libero","disciplina":"karate"}]';
\ir ../42-categorie-esercizi.sql
select atteso('le sue voci restano, nell''ordine, e si aggiungono solo quelle che mancano',
  voci(), 'lotta, karate, core, corpo-libero, attrezzi, cardio, mobilita');
select atteso('una voce che c''è già (core) non si duplica e tiene il suo nome',
  (select string_agg(d->>'nome', '|') from impostazioni, jsonb_array_elements(discipline) d where d->>'id' = 'core'), 'Il mio core');
select atteso('Judo, tolto dalla segreteria, non torna', (select count(*)::text from impostazioni, jsonb_array_elements(discipline) d where d->>'id' = 'judo'), '0');
select atteso('gli esercizi seguono', esercizi_letti(), 'Squat=core, Mawashi=karate');
select atteso('senza categoria', esercizi_con_altro(), '0');

\echo ''
\echo '--- 5. Elenco vuoto, mai toccato, catalogo mai toccato ---'
update impostazioni set discipline = '[]', esercizi = '[]';
\ir ../42-categorie-esercizi.sql
select atteso('elenco vuoto: le cinque voci servono lo stesso', voci(), 'corpo-libero, attrezzi, core, cardio, mobilita');
select atteso('catalogo vuoto: resta vuoto', (select esercizi::text from impostazioni), '[]');
update impostazioni set discipline = null, esercizi = null;
\ir ../42-categorie-esercizi.sql
select atteso('elenco nullo: resta nullo (l''app usa quello di partenza, che ha già le nove voci)', (select coalesce(discipline::text, 'nullo') from impostazioni), 'nullo');
select atteso('catalogo nullo: resta nullo (i tablet tengono il loro)', (select coalesce(esercizi::text, 'nullo') from impostazioni), 'nullo');

-- Si rimette lo stato di prima per i ruoli.
update impostazioni set
  discipline = '[{"id":"judo","nome":"Judo"},{"id":"core","nome":"Core"},{"id":"cardio","nome":"Cardio"}]',
  esercizi = '[{"id":"a","nome":"Squat","disciplina":"core"},{"id":"b","nome":"Libero"}]';

\echo ''
\echo '--- 6. Anna, segreteria: scrive il catalogo; l''app non aggiornata che scrive ancora la categoria non rompe niente ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('salva il catalogo nuovo (id, nome, voce)',
  tenta($$update impostazioni set esercizi = '[{"id":"a","nome":"Squat","disciplina":"core"},{"id":"b","nome":"Libero"}]' where id$$), 'FATTO (1 righe)');
select atteso('una copia vecchia che scrive ancora la categoria: il database la accetta (la legge e la ripulisce l''app)',
  tenta($$update impostazioni set esercizi = '[{"id":"a","nome":"Squat","categoria":"Core"}]' where id$$), 'FATTO (1 righe)');
select atteso('rimette il catalogo nuovo',
  tenta($$update impostazioni set esercizi = '[{"id":"a","nome":"Squat","disciplina":"core"},{"id":"b","nome":"Libero"}]' where id$$), 'FATTO (1 righe)');
reset role;

\echo ''
\echo '--- 7. Gli altri: leggono, non scrivono ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('l''istruttrice legge il catalogo', tenta($$select string_agg(e->>'nome' || '=' || coalesce(e->>'disciplina', '-'), ', ') from impostazioni, jsonb_array_elements(esercizi) e$$), 'Squat=core, Libero=-');
select atteso('non lo cambia', tenta($$update impostazioni set esercizi = '[]' where id$$), 'a vuoto (0 righe)');
reset role;
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('il tablet legge il catalogo, senza categoria', tenta($$select count(*)::text from impostazioni, jsonb_array_elements(esercizi) e where e ? 'categoria'$$), '0');
select atteso('e l''elenco', tenta($$select jsonb_array_length(discipline)::text from impostazioni$$), '3');
select atteso('non cambia il catalogo', tenta($$update impostazioni set esercizi = '[]' where id$$), 'a vuoto (0 righe)');
reset role;
select chi('');
set role anon;
select atteso('chi non ha fatto l''accesso non lo legge', tenta($$select esercizi::text from impostazioni$$), 'NEGATO: …');
reset role;
