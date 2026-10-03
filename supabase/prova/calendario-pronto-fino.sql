-- Fin dove è pronto il calendario (calendario_pronto_fino, 05-segreteria.sql
-- e 30-pronto-fino-dalle-ricorrenze.sql): conta solo le lezioni dell'orario,
-- non le straordinarie, che se cadono lontano fermerebbero
-- allunga_calendario (12-calendario-da-se.sql).
-- Si lancia dopo finto-supabase.sql e i file dello schema, su un database vuoto.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';
reset role;

insert into auth.users (id, email) values
  ('22222222-2222-2222-2222-222222222222', 'maura@ods.it');
insert into persone (id, nome, cognome, ruolo, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Maura', 'Uno', 'istruttore', '22222222-2222-2222-2222-222222222222');
insert into corsi (id, nome, istruttore_id) values
  ('cccccccc-0000-0000-0000-000000000001', 'Judo', 'aaaaaaaa-0000-0000-0000-000000000002');
-- Tutti i giorni, così il conto delle lezioni è il conto dei giorni.
insert into ricorrenze (corso_id, giorno, ora, durata_min, dal)
  select 'cccccccc-0000-0000-0000-000000000001', g, '18:00', 60, current_date - 30 from generate_series(0, 6) g;

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

-- Una straordinaria: una lezione senza ricorrenza, alle 10, fra `giorni` giorni.
create or replace function straordinaria(giorni int) returns void language sql as $$
  insert into sessioni (corso_id, inizio, fine) values ('cccccccc-0000-0000-0000-000000000001',
    (current_date + giorni) + time '10:00', (current_date + giorni) + time '11:00')
$$;

-- Ogni caso riparte da qui: lezioni dell'orario da oggi a oggi + 60.
\echo ''
\echo '--- 1. una straordinaria lontana non sposta la fine del calendario ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('l''istruttore prepara il calendario fino a oggi + 60',
  (select allunga_calendario()::text), (current_date + 60)::text);
reset role;
select straordinaria(120);
set role authenticated;
select atteso('con una straordinaria a oggi + 120 il calendario è pronto fino a oggi + 60',
  (select calendario_pronto_fino()::text), (current_date + 60)::text);

\echo '--- 2. con la straordinaria lontana, allunga_calendario ricrea l''orario ---'
reset role;
delete from sessioni where ricorrenza_id is not null and inizio >= current_date + 20;
set role authenticated;
select atteso('allunga_calendario arriva di nuovo a oggi + 60',
  (select allunga_calendario()::text), (current_date + 60)::text);
select atteso('le lezioni dell''orario da oggi + 20 ci sono di nuovo',
  (select count(*)::text from sessioni where ricorrenza_id is not null and inizio >= current_date + 20), '41');

\echo '--- 3. solo straordinarie: il calendario non è pronto ---'
reset role;
delete from sessioni;
select straordinaria(5);
select straordinaria(120);
set role authenticated;
select atteso('con solo straordinarie calendario_pronto_fino è vuoto',
  (select coalesce(calendario_pronto_fino()::text, 'vuoto')), 'vuoto');

\echo '--- 4. nessuna lezione: il calendario non è pronto ---'
reset role;
delete from sessioni;
set role authenticated;
select atteso('senza lezioni calendario_pronto_fino è vuoto',
  (select coalesce(calendario_pronto_fino()::text, 'vuoto')), 'vuoto');

\echo '--- 5. una straordinaria vicina non cambia niente ---'
select atteso('di nuovo pronto fino a oggi + 60', (select allunga_calendario()::text), (current_date + 60)::text);
reset role;
select straordinaria(5);
set role authenticated;
select atteso('con una straordinaria a oggi + 5 il calendario è pronto fino a oggi + 60',
  (select calendario_pronto_fino()::text), (current_date + 60)::text);

\echo '--- 6. le lezioni di un orario cancellato non contano più ---'
reset role;
delete from sessioni where ricorrenza_id is null;
insert into ricorrenze (id, corso_id, giorno, ora, durata_min, dal) values
  ('dddddddd-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 0, '20:00', 60, current_date - 30);
insert into sessioni (corso_id, ricorrenza_id, inizio, fine)
  select 'cccccccc-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001',
    (current_date + g) + time '20:00', (current_date + g) + time '21:00'
  from generate_series(61, 90) g;
set role authenticated;
select atteso('con la seconda ricorrenza il calendario arriva a oggi + 90',
  (select calendario_pronto_fino()::text), (current_date + 90)::text);
reset role;
-- Come il job o la segreteria: il trigger sulle lezioni frena solo gli istruttori.
select chi('');
delete from ricorrenze where id = 'dddddddd-0000-0000-0000-000000000001';
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('cancellata la ricorrenza, le sue lezioni restano senza orario',
  (select count(*)::text from sessioni where inizio >= current_date + 61), '30');
select atteso('e il calendario torna pronto fino a oggi + 60',
  (select calendario_pronto_fino()::text), (current_date + 60)::text);

\echo '--- 7. l''ultima lezione annullata conta ancora ---'
reset role;
delete from sessioni where ricorrenza_id is null;
update sessioni set stato = 'annullata' where inizio >= current_date + 60;
set role authenticated;
select atteso('con l''ultima lezione annullata resta pronto fino a oggi + 60',
  (select calendario_pronto_fino()::text), (current_date + 60)::text);

\echo '--- 8. senza accesso no ---'
reset role;
select chi('');
set role anon;
select atteso('chi non ha fatto l''accesso non legge fin dove è pronto il calendario',
  tenta('select calendario_pronto_fino()::text'), 'NEGATO: permission denied…');
reset role;

\echo ''
\echo 'TUTTO A POSTO'
