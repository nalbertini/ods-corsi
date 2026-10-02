-- Il calendario che si allunga da sé (12-calendario-da-se.sql): chi lo può
-- allungare, fin dove, e che non lo rifaccia a ogni lettura.
-- Si lancia dopo finto-supabase.sql e i file dello schema fino a
-- 12-calendario-da-se.sql, su un database vuoto.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';
reset role;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'maura@ods.it');
insert into persone (id, nome, cognome, ruolo, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Maura', 'Uno', 'istruttore', '22222222-2222-2222-2222-222222222222');
insert into corsi (id, nome, istruttore_id) values
  ('cccccccc-0000-0000-0000-000000000001', 'Judo', 'aaaaaaaa-0000-0000-0000-000000000002');
-- Tutti i giorni, così il conto delle lezioni è il conto dei giorni.
insert into ricorrenze (corso_id, giorno, ora, durata_min, dal)
  select 'cccccccc-0000-0000-0000-000000000001', g, '18:00', 60, current_date - 30 from generate_series(0, 6) g;

create or replace function prova_come(u text) returns void language plpgsql as $$
begin perform set_config('prova.utente', u, false); end $$;
grant execute on function prova_come(text) to anon, authenticated;

\echo ''
\echo '--- 1. il calendario è vuoto: lo allunga anche un istruttore ---'
select prova_come('22222222-2222-2222-2222-222222222222');
set role authenticated;
do $$
declare fino date; n int;
begin
  select allunga_calendario() into fino;
  select count(*) into n from sessioni;
  raise notice '1  pronto fino al %, % lezioni', fino, n;
  if fino <> current_date + 60 then raise exception 'atteso fino a oggi + 60, avuto %', fino; end if;
  if n <> 61 then raise exception 'attese 61 lezioni (da oggi a oggi + 60), avute %', n; end if;
  if (select min(inizio) from sessioni) < current_date then raise exception 'non deve creare lezioni passate'; end if;
end $$;

\echo '--- 2. il segnale non resta acceso: l''istruttore non chiama materializza_sessioni da sé ---'
do $$
begin
  perform materializza_sessioni(current_date, current_date + 90);
  raise exception 'l''istruttore ha rigenerato da sé';
exception when raise_exception then
  if sqlerrm not like 'solo la segreteria%' then raise; end if;
  raise notice '2  negato: %', sqlerrm;
end $$;

\echo '--- 3. con più di metà del periodo davanti non fa niente ---'
do $$
declare fino date; n int;
begin
  select allunga_calendario() into fino;
  select count(*) into n from sessioni;
  if fino <> current_date + 60 or n <> 61 then raise exception 'non doveva cambiare niente: fino al %, % lezioni', fino, n; end if;
  raise notice '3  fermo: fino al %, % lezioni', fino, n;
end $$;

\echo '--- 4. a meno di metà periodo dalla fine lo allunga, senza duplicare ---'
reset role;
delete from sessioni where inizio >= current_date + 20;
set role authenticated;
do $$
declare fino date; n int;
begin
  select allunga_calendario() into fino;
  select count(*) into n from sessioni;
  if fino <> current_date + 60 or n <> 61 then raise exception 'atteso di nuovo fino a oggi + 60 con 61 lezioni: fino al %, %', fino, n; end if;
  raise notice '4  riallungato: fino al %, % lezioni', fino, n;
end $$;

\echo '--- 5. segue i giorni scelti in IMPOSTAZIONI ---'
reset role;
update impostazioni set giorni_calendario = 180;
set role authenticated;
do $$
declare fino date;
begin
  select allunga_calendario() into fino;
  if fino <> current_date + 180 then raise exception 'atteso fino a oggi + 180, avuto %', fino; end if;
  raise notice '5  con 180 giorni: fino al %', fino;
end $$;

\echo '--- 5b. con la fine dei corsi, tutto fino a lì, e niente oltre ---'
reset role;
update impostazioni set giorni_calendario = 60, fine_corsi = current_date + 250;
set role authenticated;
do $$
declare fino date; n int;
begin
  select allunga_calendario() into fino;
  if fino <> current_date + 250 then raise exception 'atteso fino a oggi + 250, avuto %', fino; end if;
  raise notice '5b con la fine dei corsi: fino al %', fino;
end $$;
-- Il RIGENERA della segreteria chiede di più: il trigger non lo lascia uscire.
select prova_come('11111111-1111-1111-1111-111111111111');
do $$
declare n int;
begin
  perform materializza_sessioni(current_date, current_date + 300);
  select count(*) into n from sessioni where inizio >= current_date + 251;
  if n <> 0 then raise exception 'lezioni dopo la fine dei corsi: %', n; end if;
  raise notice '5b e la segreteria non va oltre';
end $$;
select prova_come('22222222-2222-2222-2222-222222222222');

\echo '--- 5c. con l''inizio dei corsi, niente prima ---'
reset role;
delete from sessioni;
update impostazioni set inizio_corsi = current_date + 10, fine_corsi = current_date + 40;
set role authenticated;
do $$
declare fino date; n int; primo date;
begin
  select allunga_calendario() into fino;
  select count(*), min((inizio at time zone 'Europe/Rome')::date) into n, primo from sessioni;
  if primo <> current_date + 10 or fino <> current_date + 40 or n <> 31 then
    raise exception 'attese 31 lezioni da oggi + 10 a oggi + 40: % dal % al %', n, primo, fino;
  end if;
  raise notice '5c dal % al %, % lezioni', primo, fino, n;
end $$;

\echo '--- 5d. a corsi finiti non allunga ---'
reset role;
delete from sessioni;
update impostazioni set inizio_corsi = current_date - 100, fine_corsi = current_date - 1;
set role authenticated;
do $$
declare fino date;
begin
  select allunga_calendario() into fino;
  if fino is not null then raise exception 'a corsi finiti ha creato lezioni fino al %', fino; end if;
  raise notice '5d corsi finiti: niente';
end $$;

\echo '--- 5e. la fine prima dell''inizio no ---'
reset role;
do $$
begin
  update impostazioni set inizio_corsi = current_date, fine_corsi = current_date - 1;
  raise exception 'ha accettato la fine prima dell''inizio';
exception when check_violation then
  raise notice '5e negato: %', sqlerrm;
end $$;
update impostazioni set inizio_corsi = null, fine_corsi = null;

\echo '--- 6. senza accesso no ---'
reset role;
select prova_come('');
set role anon;
do $$
begin
  perform allunga_calendario();
  raise exception 'chi non ha fatto l''accesso ha allungato il calendario';
exception when insufficient_privilege then
  raise notice '6  negato: %', sqlerrm;
end $$;
reset role;

\echo ''
\echo 'TUTTO A POSTO'
