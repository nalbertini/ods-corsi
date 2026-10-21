-- Da dove arrivano le richieste di iscrizione (74-provenienza-richieste.sql).
--
-- Il link al modulo porta un'etichetta (`?da=home`, `?da=corso-karate`…) e il
-- modulo chiede, facoltativo, «Come ci hai conosciuto?» con otto scelte chiuse.
-- `invia_iscrizione` le pulisce (spazi ai lati via, minuscolo) e scarta in
-- silenzio quelle che non vanno: un'etichetta sbagliata non ferma mai una
-- richiesta. La colonna ha il suo vincolo, anche per chi scrive a mano.
-- Le vede solo la segreteria, come il resto della richiesta, e non passano
-- alla scheda della persona accolta.
-- I numeri stanno in `richieste_contate`, senza dati personali: una richiesta
-- eliminata quando è ancora nuova (lo spam) non conta più, una accolta o
-- rifiutata eliminata resta contata; la scrive solo il trigger e la legge solo
-- la segreteria; `richieste_da_dove(da, a)` li dà a STATISTICHE.
-- Le stesse regole, nella metà di prova, le rifà `src/lib/richiesteProva.ts`
-- (scripts/prova-richieste.mjs).
-- Si lancia dopo finto-supabase.sql e i file dello schema; a metà rilancia
-- 74-provenienza-richieste.sql, per vedere che si può rilanciare.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('33333333-3333-3333-3333-333333333333', 'carla@ods.it'),
  ('55555555-5555-5555-5555-555555555555', 'maura@ods.it'),
  ('77777777-7777-7777-7777-777777777777', 'luca@ods.it'),
  ('99999999-9999-9999-9999-999999999999', 'tablet@ods.it');
-- Anna: segreteria. Carla: solo amministrazione (i conti, non le persone). Maura: istruttore. Luca: iscritto.
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Carla', 'Conti', 'amministrazione', 'carla@ods.it', '33333333-3333-3333-3333-333333333333'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'Maura', 'Uno', 'istruttore', 'maura@ods.it', '55555555-5555-5555-5555-555555555555'),
  ('aaaaaaaa-0000-0000-0000-000000000007', 'Luca', 'Iscritto', 'iscritto', 'luca@ods.it', '77777777-7777-7777-7777-777777777777');
insert into sale (id, nome) values ('bbbbbbbb-0000-0000-0000-000000000001', 'Tatami');
insert into postazioni (id, nome, sala_id, utente_id) values
  ('dddddddd-0000-0000-0000-000000000001', 'Tablet', 'bbbbbbbb-0000-0000-0000-000000000001', '99999999-9999-9999-9999-999999999999');
insert into corsi (id, nome) values
  ('cccccccc-0000-0000-0000-000000000001', 'Karate'),
  ('cccccccc-0000-0000-0000-000000000002', 'Judo');

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
create or replace function esito(sql text) returns text language plpgsql as $$
begin execute sql; return 'ok';
exception when others then return sqlstate || ' ' || sqlerrm;
end $$;
-- Una chiamata fatta da ognuno degli accessi: solo il codice dell'esito, «ok» se è andata.
create or replace function matrice(q text) returns text language plpgsql as $$
declare u record; r text; fuori text := '';
begin
  for u in select * from (values
    ('anna', '11111111-1111-1111-1111-111111111111', 'authenticated'),
    ('conti', '33333333-3333-3333-3333-333333333333', 'authenticated'),
    ('maura', '55555555-5555-5555-5555-555555555555', 'authenticated'),
    ('luca', '77777777-7777-7777-7777-777777777777', 'authenticated'),
    ('tablet', '99999999-9999-9999-9999-999999999999', 'authenticated'),
    ('anon', '00000000-0000-0000-0000-000000000000', 'anon')) as t(nome, id, ruolo) loop
    perform set_config('prova.utente', u.id, false);
    execute format('set role %I', u.ruolo);
    r := esito(q);
    reset role;
    fuori := fuori || case when fuori = '' then '' else ' ' end || u.nome || ':' || left(r, 5);
  end loop;
  return fuori;
end $$;
-- Come in iscrizioni.sql: un codice fiscale giusto per Luca Rossi di trent'anni.
create or replace function cf_prova(lettere text, nato date)
  returns text language sql stable security definer set search_path = public as $$
  select x || cf_controllo(x) from (
    select lettere || to_char(nato, 'YY') || substr('ABCDEHLMPRST', extract(month from nato)::int, 1)
           || lpad(extract(day from nato)::int::text, 2, '0') || 'L219' as x) q
$$;
-- Una richiesta valida, ogni volta con un'email nuova: il limite per email non c'entra.
create sequence if not exists prova_n;
create or replace function richiesta(cambi jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object(
    'nome', 'Luca', 'cognome', 'Rossi', 'nato_il', (current_date - interval '30 years')::date,
    'nato_a', 'Torino', 'codice_fiscale', cf_prova('RSSLCU', (current_date - interval '30 years')::date), 'indirizzo', 'Via Roma 1',
    'cap', '10093', 'comune', 'Collegno', 'email', 'luca' || nextval('prova_n') || '@esempio.it', 'telefono', '347 111 2233',
    'corsi', jsonb_build_array('cccccccc-0000-0000-0000-000000000001'), 'formula', 'annuale', 'regolamento', true
  ) || cambi
$$;
-- Manda una richiesta da anon e dice cosa si è salvato: «provenienza|conosciuto», «—» per niente.
create or replace function manda(cambi jsonb) returns text language plpgsql as $$
declare nuova uuid; fuori text;
begin
  perform set_config('prova.utente', '', false);
  set role anon;
  begin nuova := invia_iscrizione(richiesta(cambi)); exception when others then reset role; return 'NEGATO: ' || sqlerrm; end;
  reset role;
  select coalesce(provenienza, '—') || '|' || coalesce(conosciuto, '—') into fuori from richieste_iscrizione where id = nuova;
  return fuori;
end $$;
grant usage, select on sequence prova_n to anon, authenticated;
grant execute on function tenta(text), atteso(text, text, text), esito(text), matrice(text), chi(text), cf_prova(text, date), richiesta(jsonb) to anon, authenticated;

\echo ''
\echo '--- 1. l''etichetta del link: si salva pulita, o non si salva ---'
select atteso('dalla pagina di un corso', manda('{"provenienza": "corso-karate"}'), 'corso-karate|—');
select atteso('spazi ai lati e maiuscole: puliti', manda('{"provenienza": "  Instagram "}'), 'instagram|—');
select atteso('91 caratteri: la richiesta arriva, senza etichetta', manda(jsonb_build_object('provenienza', repeat('a', 91))), '—|—');
select atteso('90 caratteri vanno', manda(jsonb_build_object('provenienza', repeat('a', 90))), repeat('a', 90) || '|—');
select atteso('un pezzo di codice: senza etichetta', manda('{"provenienza": "<script>alert(1)</script>"}'), '—|—');
select atteso('una barra: senza etichetta', manda('{"provenienza": "a/b"}'), '—|—');
select atteso('una formula da foglio di calcolo: senza etichetta', manda('{"provenienza": "=1+1"}'), '—|—');
select atteso('vuota: senza etichetta', manda('{"provenienza": ""}'), '—|—');
select atteso('uno spazio in mezzo: senza etichetta', manda('{"provenienza": "volantino ottobre"}'), '—|—');
select atteso('due trattini di fila: senza etichetta', manda('{"provenienza": "volantino--ottobre"}'), '—|—');
select atteso('un numero invece del testo: senza etichetta', manda('{"provenienza": 12}'), '—|—');
select atteso('un elenco invece del testo: senza etichetta', manda('{"provenienza": ["home"]}'), '—|—');
select atteso('null: senza etichetta', manda('{"provenienza": null}'), '—|—');
select atteso('senza la chiave, come oggi', manda('{}'), '—|—');
select atteso('cifre e trattini vanno', manda('{"provenienza": "volantino-2026"}'), 'volantino-2026|—');

\echo ''
\echo '--- 2. «come ci hai conosciuto»: una delle otto scelte, o niente ---'
select atteso('Instagram', manda('{"conosciuto": "instagram"}'), '—|instagram');
select atteso('Amici o parenti', manda('{"conosciuto": "amici-parenti"}'), '—|amici-parenti');
select atteso('Passando davanti, con gli spazi', manda('{"conosciuto": " Passando-Davanti "}'), '—|passando-davanti');
select atteso('tutte e otto le scelte', (select string_agg(split_part(manda(jsonb_build_object('conosciuto', k)), '|', 2), ',' order by k)
  from unnest(array['amici-parenti', 'sito', 'instagram', 'facebook', 'google', 'volantino', 'passando-davanti', 'altro']) k),
  'altro,amici-parenti,facebook,google,instagram,passando-davanti,sito,volantino');
select atteso('una scelta inventata: si scarta', manda('{"conosciuto": "tiktok"}'), '—|—');
select atteso('un testo libero: si scarta', manda('{"conosciuto": "me l''ha detto Mario"}'), '—|—');
select atteso('un numero: si scarta', manda('{"conosciuto": 3}'), '—|—');
select atteso('le due insieme', manda('{"provenienza": "home", "conosciuto": "google"}'), 'home|google');
select atteso('un''etichetta sbagliata non ferma un campo sbagliato: l''errore è quello di sempre',
  manda('{"provenienza": "a/b", "cap": "1009"}'), 'NEGATO: Un campo non va: il CAP ha 5 cifre');

\echo ''
\echo '--- 3. il vincolo vale anche per chi scrive a mano ---'
select atteso('la segreteria non scrive un''etichetta con lo spazio', (select esito($$update richieste_iscrizione set provenienza = 'A B' where provenienza = 'home'$$)), '23514 …');
select atteso('né una scelta inventata', (select esito($$update richieste_iscrizione set conosciuto = 'tiktok' where provenienza = 'home'$$)), '23514 …');
select atteso('né 91 caratteri', (select esito($$update richieste_iscrizione set provenienza = repeat('a', 91) where provenienza = 'home'$$)), '23514 …');

\echo ''
\echo '--- 4. chi le vede: la segreteria, nessun altro ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria legge l''etichetta', (select count(*)::text from richieste_iscrizione where provenienza = 'corso-karate'), '1');
reset role;
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('l''istruttore non legge nessuna richiesta, né l''etichetta', (select count(*)::text from richieste_iscrizione where provenienza is not null), '0');
reset role;
select chi('77777777-7777-7777-7777-777777777777');
set role authenticated;
select atteso('l''iscritto nemmeno', (select count(*)::text from richieste_iscrizione where provenienza is not null), '0');
reset role;
select atteso('chi legge i conteggi: solo la segreteria (gli altri leggono zero righe, anon niente)',
  matrice($$select 1 / count(*) from richieste_contate$$), 'anna:ok conti:22012 maura:22012 luca:22012 tablet:22012 anon:42501');
select atteso('nessuno li scrive dall''app: inserire', matrice($$insert into richieste_contate (giorno, corsi) values (current_date, '{}')$$),
  'anna:42501 conti:42501 maura:42501 luca:42501 tablet:42501 anon:42501');
select atteso('cambiare', matrice($$update richieste_contate set provenienza = 'home'$$), 'anna:42501 conti:42501 maura:42501 luca:42501 tablet:42501 anon:42501');
select atteso('togliere', matrice($$delete from richieste_contate$$), 'anna:42501 conti:42501 maura:42501 luca:42501 tablet:42501 anon:42501');
select atteso('il riquadro di STATISTICHE: solo la segreteria',
  matrice($$select richieste_da_dove(current_date - 30, current_date)$$), 'anna:ok conti:42501 maura:42501 luca:42501 tablet:42501 anon:42501');
select atteso('nel conteggio niente nomi, email, codici fiscali, telefoni',
  (select string_agg(column_name::text, ',' order by ordinal_position) from information_schema.columns where table_schema = 'public' and table_name = 'richieste_contate'),
  'id,richiesta_id,giorno,provenienza,conosciuto,corsi,stato');

\echo ''
\echo '--- 5. i numeri: per persona, arrivate nel periodo e come stanno oggi ---'
-- Si riparte da zero: le richieste di prima sono servite alle regole.
delete from richieste_contate;
delete from richieste_iscrizione;
select manda('{"provenienza": "home", "conosciuto": "instagram"}');
select manda('{"provenienza": "home", "corsi": ["cccccccc-0000-0000-0000-000000000002"]}');
select manda('{"provenienza": "instagram", "conosciuto": "amici-parenti", "corsi": ["cccccccc-0000-0000-0000-000000000001", "cccccccc-0000-0000-0000-000000000002"]}');
select manda('{}');
select manda('{"provenienza": "a/b"}');
select manda('{"conosciuto": "tiktok"}');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select accogli_iscrizione((select id from richieste_iscrizione where provenienza = 'home' and conosciuto = 'instagram'));
select rifiuta_iscrizione((select id from richieste_iscrizione where provenienza = 'instagram'));
create temp table d as select richieste_da_dove(current_date - 30, current_date) x;
reset role;
create or replace function conta(dove text, valore text, stato text default null) returns text language sql as $$
  select coalesce(sum((r->>'n')::int), 0)::text from d, jsonb_array_elements(d.x->'righe') r
  where (case dove when 'provenienza' then r->>'provenienza' else r->>'conosciuto' end) is not distinct from valore
    and (stato is null or r->>'stato' = stato)
$$;
select atteso('home: 2 arrivate', conta('provenienza', 'home'), '2');
select atteso('home: 1 accolta', conta('provenienza', 'home', 'accolta'), '1');
select atteso('home: nessuna rifiutata', conta('provenienza', 'home', 'rifiutata'), '0');
select atteso('instagram: 1 arrivata', conta('provenienza', 'instagram'), '1');
select atteso('instagram: rifiutata', conta('provenienza', 'instagram', 'rifiutata'), '1');
select atteso('senza etichetta (anche quella sbagliata): 3', conta('provenienza', null), '3');
select atteso('senza etichetta: tutte da guardare', conta('provenienza', null, 'nuova'), '3');
select atteso('come ci hanno conosciuto: Instagram 1', conta('conosciuto', 'instagram'), '1');
select atteso('come ci hanno conosciuto: non si sa 4 (anche la scelta inventata)', conta('conosciuto', null), '4');
select atteso('ogni riga dice i suoi corsi, per il filtro (chi ne chiede due ha tutti e due)',
  (select string_agg(r->>'corsi', ' ' order by r->>'corsi') from d, jsonb_array_elements(d.x->'righe') r where r->>'provenienza' = 'instagram'),
  '["cccccccc-0000-0000-0000-000000000001", "cccccccc-0000-0000-0000-000000000002"]');
select atteso('da quando si conta: oggi', (select x->>'dal' from d), current_date::text);
select atteso('fuori dal periodo non conta', (select jsonb_array_length(richieste_da_dove(current_date - 60, current_date - 31)->'righe')::text), '0');
select atteso('il periodo al contrario: un errore detto', tenta($$select richieste_da_dove(current_date, current_date - 1)::text$$), 'NEGATO: il periodo è al contrario');

\echo ''
\echo '--- 6. la persona accolta non porta l''etichetta; eliminata da nuova non conta più, accolta o rifiutata sì ---'
select atteso('persone non ha la provenienza', (select count(*)::text from information_schema.columns where table_schema = 'public' and table_name = 'persone' and column_name in ('provenienza', 'conosciuto')), '0');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria elimina una richiesta da home', tenta($$delete from richieste_iscrizione where provenienza = 'home' and stato = 'nuova'$$), 'FATTO (1 righe)');
drop table d;
create temp table d as select richieste_da_dove(current_date - 30, current_date) x;
reset role;
select atteso('eliminata da nuova (come lo spam): home scende a 1', conta('provenienza', 'home'), '1');
select atteso('e non resta nessuna riga senza legame', (select count(*)::text from richieste_contate where richiesta_id is null), '0');
-- Un'accolta si elimina solo quando la sua scheda non c'è più (90-richieste-accolte-restano.sql).
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('l''accolta con la scheda resta', tenta($$delete from richieste_iscrizione where stato = 'accolta'$$), 'a vuoto (0 righe)');
reset role;
delete from persone where id in (select persona_id from richieste_iscrizione where stato = 'accolta');
set role authenticated;
select atteso('la segreteria elimina l''accolta senza scheda e la rifiutata', tenta($$delete from richieste_iscrizione where stato in ('accolta', 'rifiutata')$$), 'FATTO (2 righe)');
drop table d;
create temp table d as select richieste_da_dove(current_date - 30, current_date) x;
reset role;
select atteso('l''accolta eliminata resta contata', conta('provenienza', 'home', 'accolta'), '1');
select atteso('la rifiutata eliminata resta contata', conta('provenienza', 'instagram', 'rifiutata'), '1');
select atteso('e le loro righe non sono più legate a niente', (select count(*)::text from richieste_contate where richiesta_id is null), '2');

\echo ''
\echo '--- 7. si rilancia senza perdere niente ---'
\ir ../74-provenienza-richieste.sql
select atteso('i conteggi ci sono ancora', (select count(*)::text from richieste_contate), '5');
select atteso('dal link della segreteria', manda('{"provenienza": "segreteria"}'), 'segreteria|—');
select atteso('e il trigger c''è una volta sola: una richiesta nuova, una riga', (select count(*)::text from richieste_contate where provenienza = 'segreteria'), '1');
-- Il giorno segue la richiesta anche se cambia la sua data (a mano, o spostata da un import): quello di Roma.
update richieste_iscrizione set creata_il = '2026-03-01 23:30:00+00' where provenienza = 'segreteria';
select atteso('la data cambiata: il giorno ricalcolato, a Roma è già il 2 marzo', (select giorno::text from richieste_contate where provenienza = 'segreteria'), '2026-03-02');
select atteso('anon chiama ancora invia_iscrizione e non i conteggi',
  (select has_function_privilege('anon', 'invia_iscrizione(jsonb)', 'execute')::text || '/' || has_function_privilege('anon', 'richieste_da_dove(date, date)', 'execute')::text), 'true/false');
