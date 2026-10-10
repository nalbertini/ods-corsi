-- Gli orari dei corsi aperti, per chi si iscrive senza un accesso: il passo
-- «Ti iscrivi anche tu?» cerca i corsi del genitore alla stessa ora del figlio
-- dal calendario vero. `orari_aperti()` dice solo corso, giorno, ora e durata
-- dei corsi attivi, delle ricorrenze non finite; le tabelle restano chiuse.
-- Gli stessi orari, nella metà di prova, li dà `orariAperti()` di
-- `src/lib/richiesteProva.ts` (scripts/prova-richieste.mjs).
-- Si lancia dopo finto-supabase.sql, i file dello schema e 48-orari-aperti.sql;
-- alla fine rilancia 06-iscrizioni.sql.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it');
insert into persone (id, nome, cognome, ruolo, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', '11111111-1111-1111-1111-111111111111');
insert into corsi (id, nome) values
  ('cccccccc-0000-0000-0000-000000000001', 'Judo 3'),
  ('cccccccc-0000-0000-0000-000000000002', 'Preparazione atletica 3');
insert into corsi (id, nome, attivo) values ('cccccccc-0000-0000-0000-000000000003', 'Corso chiuso', false);
insert into ricorrenze (corso_id, giorno, ora, durata_min, dal, al) values
  -- Judo 3: il lunedì senza fine, il giovedì che finisce oggi (oggi c'è ancora), il mercoledì finito ieri.
  ('cccccccc-0000-0000-0000-000000000001', 1, '18:00', 60, current_date - 30, null),
  ('cccccccc-0000-0000-0000-000000000001', 4, '18:00', 90, current_date - 30, current_date),
  ('cccccccc-0000-0000-0000-000000000001', 3, '17:00', 60, current_date - 30, current_date - 1),
  ('cccccccc-0000-0000-0000-000000000002', 5, '19:30', 45, current_date - 30, current_date + 200),
  -- Il corso archiviato ha ancora la sua ricorrenza: non si vede lo stesso.
  ('cccccccc-0000-0000-0000-000000000003', 2, '18:00', 60, current_date - 30, null);

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
\echo '--- 1. chi non ha un accesso legge gli orari dei corsi aperti ---'
select chi('');
set role anon;
-- Ogni orario come «corso giorno ora durata», col corso detto dall'ultima cifra dell'id.
select atteso('gli orari: corsi attivi, ricorrenze non finite (oggi compreso)',
  tenta($$select string_agg(right(corso_id::text, 1) || ' ' || giorno || ' ' || to_char(ora, 'HH24:MI') || ' ' || durata_min, '; ' order by corso_id, giorno) from orari_aperti()$$),
  '1 1 18:00 60; 1 4 18:00 90; 2 5 19:30 45');
select atteso('solo corso, giorno, ora e durata: niente sala, date, istruttori',
  tenta($$select string_agg(k, ', ' order by k) from (select distinct jsonb_object_keys(to_jsonb(o)) k from orari_aperti() o) x$$),
  'corso_id, durata_min, giorno, ora');
select atteso('un corso archiviato non c’è',
  tenta($$select count(*)::text from orari_aperti() where corso_id = 'cccccccc-0000-0000-0000-000000000003'$$), '0');
select atteso('una ricorrenza finita ieri non c’è',
  tenta($$select count(*)::text from orari_aperti() where giorno = 3$$), '0');

\echo ''
\echo '--- 2. le tabelle restano chiuse ---'
select atteso('non legge le ricorrenze', tenta($$select count(*)::text from ricorrenze$$), 'NEGATO: …');
select atteso('non legge le sessioni', tenta($$select count(*)::text from sessioni$$), 'NEGATO: …');
select atteso('non legge i corsi', tenta($$select count(*)::text from corsi$$), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 3. anche con un accesso la funzione risponde uguale ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria vede gli stessi orari',
  tenta($$select count(*)::text from orari_aperti()$$), '3');
reset role;

\echo ''
\echo '--- 4. dopo aver rilanciato 06-iscrizioni.sql ---'
-- 06 toglie ad `anon` le funzioni che non conosce: se il 48 c'è già, deve
-- ridargli orari_aperti(), come fa per il vestiario.
\ir ../06-iscrizioni.sql
-- 06 toglie ad `anon` anche gli aiuti della prova, che stanno in `public`:
-- glieli si ridà, e solo quelli.
grant execute on function tenta(text), atteso(text, text, text), chi(text) to anon, authenticated;
select chi('');
set role anon;
select atteso('anon chiama ancora orari_aperti()',
  tenta($$select count(*)::text from orari_aperti()$$), '3');
select atteso('e le ricorrenze restano chiuse', tenta($$select count(*)::text from ricorrenze$$), 'NEGATO: …');
reset role;
