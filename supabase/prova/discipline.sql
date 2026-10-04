-- Le discipline della palestra (Judo, Lotta, Pilates, Yoga…): la lista sta in
-- impostazioni.discipline, la cura la segreteria e la leggono tutti; le liste
-- di musica ne portano una (musica_sale.disciplina) senza chiave esterna.
-- Si lancia dopo finto-supabase.sql e tutti i file dello schema.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'maura@ods.it'),
  ('33333333-3333-3333-3333-333333333333', 'luca@ods.it'),
  ('66666666-6666-6666-6666-666666666666', 'lotta@sale.ods-corsi.it');
insert into persone (id, nome, cognome, ruolo, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Maura', 'Uno', 'istruttore', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Luca', 'Rossi', 'iscritto', '33333333-3333-3333-3333-333333333333');
insert into sale (id, nome) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Lotta'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Tatami');
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
\echo '--- 1. La lista di partenza ---'
select atteso('Judo, Lotta, Pilates, Yoga',
  (select string_agg(d->>'id', ', ' order by ord) from impostazioni, jsonb_array_elements(discipline) with ordinality as t(d, ord)),
  'judo, lotta, pilates, yoga');

\echo ''
\echo '--- 2. Anna, segreteria: la cura e ci associa le liste ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('cambia la lista',
  tenta($$update impostazioni set discipline = '[{"id":"judo","nome":"Judo"},{"id":"lotta","nome":"Lotta"},{"id":"karate","nome":"Karate"}]' where id$$), 'FATTO (1 righe)');
select atteso('la rilegge com''è', tenta($$select string_agg(d->>'nome', ', ') from impostazioni, jsonb_array_elements(discipline) d$$), 'Judo, Lotta, Karate');
select atteso('la svuota (array vuoto)', tenta($$update impostazioni set discipline = '[]' where id$$), 'FATTO (1 righe)');
select atteso('la toglie del tutto (nulla)', tenta($$update impostazioni set discipline = null where id$$), 'FATTO (1 righe)');
select atteso('un oggetto invece di un array no',
  tenta($$update impostazioni set discipline = '{"judo":"Judo"}' where id$$), 'NEGATO: …');
select atteso('un testo invece di un array no',
  tenta($$update impostazioni set discipline = '"judo"' where id$$), 'NEGATO: …');
select atteso('un array oltre i 4000 byte no',
  tenta($$update impostazioni set discipline = jsonb_build_array(jsonb_build_object('id', 'x', 'nome', repeat('a', 4000))) where id$$), 'NEGATO: …');
select atteso('più di 50 voci no, anche se piccole',
  tenta($$update impostazioni set discipline = (select jsonb_agg(jsonb_build_object('id', 'd' || i, 'nome', 'D')) from generate_series(1, 51) i) where id$$), 'NEGATO: …');
select atteso('uno sotto i 4000 byte sì',
  tenta($$update impostazioni set discipline = jsonb_build_array(jsonb_build_object('id', 'x', 'nome', repeat('a', 3000))) where id$$), 'FATTO (1 righe)');
select atteso('rimette la lista',
  tenta($$update impostazioni set discipline = '[{"id":"judo","nome":"Judo"},{"id":"lotta","nome":"Lotta"},{"id":"yoga","nome":"Yoga"}]' where id$$), 'FATTO (1 righe)');

select atteso('una lista per la Lotta, della disciplina lotta',
  tenta($$insert into musica_sale (id, sala_id, nome, link, disciplina) values
    ('c0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Randori',
     'https://www.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG', 'lotta')$$), 'FATTO (1 righe)');
select atteso('una per tutte le sale, per tutte le discipline',
  tenta($$insert into musica_sale (id, nome, link, disciplina) values
    ('c0000000-0000-0000-0000-000000000002', 'Riscaldamento', 'https://open.spotify.com/playlist/37i9dQZF1DX76Wlfdnj7AP', 'tutte')$$), 'FATTO (1 righe)');
select atteso('una del Tatami senza disciplina',
  tenta($$insert into musica_sale (id, sala_id, nome, link) values
    ('c0000000-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000002', 'Bambini', 'spotify:playlist:37i9dQZF1DXdPec7aLTmlC')$$), 'FATTO (1 righe)');
select atteso('senza disciplina resta nulla', tenta($$select coalesce(disciplina, 'nulla') from musica_sale where nome = 'Bambini'$$), 'nulla');
select atteso('«Judo» maiuscolo no',
  tenta($$insert into musica_sale (nome, link, disciplina) values ('X', 'https://youtu.be/dQw4w9WgXcQ', 'Judo')$$), 'NEGATO: …');
select atteso('con uno spazio no',
  tenta($$insert into musica_sale (nome, link, disciplina) values ('X', 'https://youtu.be/dQw4w9WgXcQ', 'judo kids')$$), 'NEGATO: …');
select atteso('vuota no',
  tenta($$insert into musica_sale (nome, link, disciplina) values ('X', 'https://youtu.be/dQw4w9WgXcQ', '')$$), 'NEGATO: …');
select atteso('oltre 30 caratteri no',
  tenta($$insert into musica_sale (nome, link, disciplina) values ('X', 'https://youtu.be/dQw4w9WgXcQ', repeat('a', 31))$$), 'NEGATO: …');
select atteso('30 caratteri sì, con numeri e trattini',
  tenta($$insert into musica_sale (id, nome, link, disciplina) values ('c0000000-0000-0000-0000-000000000004', 'Y', 'https://youtu.be/dQw4w9WgXcQ', repeat('a', 28) || '-9')$$), 'FATTO (1 righe)');
select atteso('la cambia con un update', tenta($$update musica_sale set disciplina = 'yoga' where id = 'c0000000-0000-0000-0000-000000000004'$$), 'FATTO (1 righe)');
select atteso('e la toglie', tenta($$update musica_sale set disciplina = null where id = 'c0000000-0000-0000-0000-000000000004'$$), 'FATTO (1 righe)');
select atteso('l''update con un formato sbagliato no', tenta($$update musica_sale set disciplina = 'Yoga' where id = 'c0000000-0000-0000-0000-000000000004'$$), 'NEGATO: …');
delete from musica_sale where id = 'c0000000-0000-0000-0000-000000000004';
reset role;

\echo ''
\echo '--- 3. Maura, istruttrice: la legge e non la cambia ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('legge le discipline', tenta($$select string_agg(d->>'id', ', ') from impostazioni, jsonb_array_elements(discipline) d$$), 'judo, lotta, yoga');
select atteso('non le cambia', tenta($$update impostazioni set discipline = '[]' where id$$), 'a vuoto (0 righe)');
select atteso('legge la disciplina delle liste', tenta($$select string_agg(coalesce(disciplina, '-'), ',' order by nome) from musica_sale$$), '-,lotta,tutte');
select atteso('non la cambia sulle liste', tenta($$update musica_sale set disciplina = 'yoga'$$), 'a vuoto (0 righe)');
reset role;

\echo ''
\echo '--- 4. Luca, iscritto ---'
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('la legge (non è un dato di persone)', tenta($$select jsonb_array_length(discipline)::text from impostazioni$$), '3');
select atteso('non la cambia', tenta($$update impostazioni set discipline = '[]' where id$$), 'a vuoto (0 righe)');
select atteso('le liste di musica non le vede', tenta($$select count(*)::text from musica_sale$$), '0');
reset role;

\echo ''
\echo '--- 5. Il tablet della Lotta ---'
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('legge le discipline', tenta($$select string_agg(d->>'nome', ', ') from impostazioni, jsonb_array_elements(discipline) d$$), 'Judo, Lotta, Yoga');
select atteso('non le cambia', tenta($$update impostazioni set discipline = '[]' where id$$), 'a vuoto (0 righe)');
select atteso('non le cambia nemmeno con salva_timer_sala', tenta($$select salva_timer_sala('{"coach":"classico"}')::text$$), '');
select atteso('e la lista è com''era', tenta($$select jsonb_array_length(discipline)::text from impostazioni$$), '3');
select atteso('musica_sala() dà la disciplina: la sua sala e tutte le sale',
  tenta($$select string_agg(nome || '=' || coalesce(disciplina, '-'), ', ') from musica_sala()$$), 'Randori=lotta, Riscaldamento=tutte');
select atteso('la colonna si chiama disciplina',
  tenta($$select disciplina from musica_sala() where nome = 'Randori'$$), 'lotta');
select atteso('la tabella non la legge', tenta($$select count(*)::text from musica_sale$$), '0');
reset role;

\echo ''
\echo '--- 6. Chi non ha fatto l''accesso ---'
select chi('');
set role anon;
select atteso('le discipline no', tenta($$select discipline::text from impostazioni$$), 'NEGATO: …');
select atteso('non le cambia', tenta($$update impostazioni set discipline = '[]' where id$$), 'NEGATO: …');
select atteso('musica_sala() resta negata', tenta($$select count(*)::text from musica_sala()$$), 'NEGATO: …');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('un utente non tablet resta negato', tenta($$select count(*)::text from musica_sala()$$), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 7. Togliere o rinominare una disciplina non tocca le liste (nessuna chiave esterna) ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('toglie la Lotta dalla lista', tenta($$update impostazioni set discipline = '[{"id":"judo","nome":"Judo"}]' where id$$), 'FATTO (1 righe)');
select atteso('la rinomina', tenta($$update impostazioni set discipline = '[{"id":"judo","nome":"Judo kids"}]' where id$$), 'FATTO (1 righe)');
select atteso('la lista di musica ha ancora «lotta»', tenta($$select disciplina from musica_sale where nome = 'Randori'$$), 'lotta');
reset role;
select atteso('nessuna chiave esterna sulla colonna',
  (select count(*)::text from pg_constraint where conrelid = 'musica_sale'::regclass and contype = 'f' and conkey @> array[(select attnum from pg_attribute where attrelid = 'musica_sale'::regclass and attname = 'disciplina')]),
  '0');
select atteso('il vincolo del formato c''è',
  (select count(*)::text from pg_constraint where conrelid = 'musica_sale'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%disciplina%'), '1');
select atteso('il vincolo della lista c''è',
  (select count(*)::text from pg_constraint where conname = 'impostazioni_discipline_check'), '1');
