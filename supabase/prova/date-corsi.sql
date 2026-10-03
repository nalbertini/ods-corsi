-- SALVA LE DATE (34-date-corsi.sql): scrive inizio e fine dei corsi e toglie
-- le lezioni da ricorrenza di domani in poi che restano fuori, tranne quelle
-- con l'appello o una prova. Le straordinarie, oggi e il passato non si toccano.
-- Lo fa solo la segreteria.
-- Si lancia dopo finto-supabase.sql e i file dello schema fino a
-- 34-date-corsi.sql, su un database vuoto.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';
reset role;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'maura@ods.it'),
  ('33333333-3333-3333-3333-333333333333', 'luca@ods.it'),
  ('55555555-5555-5555-5555-555555555555', 'tatami@ods.it');
insert into persone (id, nome, cognome, ruolo, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Maura', 'Uno', 'istruttore', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Luca', 'Rossi', 'iscritto', '33333333-3333-3333-3333-333333333333'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'Sara', 'Rossi', 'iscritto', null),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'Pia', 'Provetta', 'iscritto', null),
  ('aaaaaaaa-0000-0000-0000-000000000006', 'Fabio', 'Sostituto', 'istruttore', null);
insert into sale (id, nome) values ('bbbbbbbb-0000-0000-0000-000000000001', 'Tatami');
insert into postazioni (id, nome, sala_id, utente_id) values
  ('dddddddd-0000-0000-0000-000000000001', 'Tablet Tatami', 'bbbbbbbb-0000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555555');
insert into corsi (id, nome, istruttore_id) values
  ('cccccccc-0000-0000-0000-000000000001', 'Judo', 'aaaaaaaa-0000-0000-0000-000000000002');
-- Tutti i giorni alle 18, così il giorno di una lezione è il suo numero.
insert into ricorrenze (id, corso_id, giorno, ora, durata_min, dal)
  select ('ffffffff-0000-0000-0000-00000000000' || g)::uuid, 'cccccccc-0000-0000-0000-000000000001', g, '18:00', 60, current_date - 30
  from generate_series(0, 6) g;
-- Da tre giorni fa a fra venti, una al giorno; più due straordinarie alle 19.
insert into sessioni (corso_id, ricorrenza_id, inizio, fine)
  select 'cccccccc-0000-0000-0000-000000000001', ('ffffffff-0000-0000-0000-00000000000' || extract(dow from current_date + d))::uuid,
    (current_date + d) + time '18:00', (current_date + d) + time '19:00'
  from generate_series(-3, 20) d;
insert into sessioni (corso_id, inizio, fine) values
  ('cccccccc-0000-0000-0000-000000000001', (current_date + 2) + time '19:00', (current_date + 2) + time '20:00'),
  ('cccccccc-0000-0000-0000-000000000001', (current_date + 15) + time '19:00', (current_date + 15) + time '20:00');

-- Il giorno di una lezione, contato da oggi.
create or replace function fra_quanti(s sessioni) returns int language sql stable as $$
  select (s.inizio at time zone 'Europe/Rome')::date - current_date
$$;
create or replace function lezione(giorni int) returns uuid language sql stable as $$
  select id from sessioni s where ricorrenza_id is not null and fra_quanti(s) = giorni
$$;
-- L'appello fra 2 e fra 14 giorni, una prova fra 3 e fra 16.
insert into presenze (sessione_id, persona_id, stato) values
  (lezione(2), 'aaaaaaaa-0000-0000-0000-000000000004', 'presente'),
  (lezione(14), 'aaaaaaaa-0000-0000-0000-000000000004', 'assente');
insert into prove (sessione_id, persona_id) values
  (lezione(3), 'aaaaaaaa-0000-0000-0000-000000000005'),
  (lezione(16), 'aaaaaaaa-0000-0000-0000-000000000005');

create or replace function chi(u text) returns void language plpgsql as $$
begin perform set_config('prova.utente', u, false); end $$;
-- Il codice dell'errore, per distinguere un permesso negato da un check.
create or replace function codice(sql text) returns text language plpgsql as $$
begin
  execute sql;
  return 'nessun errore';
exception when others then return sqlstate;
end $$;
create or replace function atteso(cosa text, avuto text, voluto text) returns text language plpgsql as $$
begin
  if avuto is distinct from voluto and not (voluto like '%…' and avuto like replace(voluto, '…', '%')) then
    raise exception '% · atteso «%», avuto «%»', cosa, voluto, avuto;
  end if;
  return 'ok  ' || cosa || ' → ' || avuto;
end $$;
-- Il risultato in una riga: tolte, restano, prima e ultima contate da oggi.
create or replace function esito(j json) returns text language sql as $$
  select concat_ws(' ', j->>'tolte', j->>'restano',
    coalesce(((j->>'prima')::date - current_date)::text, '-'), coalesce(((j->>'ultima')::date - current_date)::text, '-'))
$$;
-- Le lezioni da ricorrenza rimaste, coi giorni da oggi; e le straordinarie.
create or replace function giorni() returns text language sql stable as $$
  select string_agg(fra_quanti(s)::text, ' ' order by inizio) from sessioni s where ricorrenza_id is not null
$$;
create or replace function straordinarie() returns text language sql stable as $$
  select string_agg(fra_quanti(s)::text, ' ' order by inizio) from sessioni s where ricorrenza_id is null
$$;
create or replace function date_corsi() returns text language sql stable as $$
  select coalesce((inizio_corsi - current_date)::text, '-') || ' ' || coalesce((fine_corsi - current_date)::text, '-') from impostazioni
$$;
-- Con le prime tre rimaste: corso, giorno da oggi e ora, nell'ordine del json.
create or replace function tutto(j json) returns text language sql as $$
  select esito(j) || ' | ' || coalesce((
    select string_agg(x->>'corso' || ' ' || (((x->>'inizio')::timestamptz at time zone 'Europe/Rome')::date - current_date)
      || ' ' || to_char((x->>'inizio')::timestamptz at time zone 'Europe/Rome', 'HH24:MI'), ', ' order by n)
    from json_array_elements(j->'rimaste') with ordinality as r(x, n)), '-')
$$;
grant execute on function codice(text), atteso(text, text, text), chi(text), esito(json), tutto(json) to anon, authenticated;

\echo ''
\echo '--- 1. la segreteria accorcia la fine: fra 10 giorni ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('contare prima: toglierebbe 8, restano il 14 e il 16',
  (select tutto(j) from (select salva_date_corsi(null::date, current_date + 10, true) j) x), '8 2 14 16 | Judo 14 18:00, Judo 16 18:00');
reset role;
select atteso('contare non scrive le date', date_corsi(), '- -');
select atteso('contare non toglie lezioni', giorni(), '-3 -2 -1 0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('tolte le 8 senza appello né prova, restano quella con l''appello (14) e quella con la prova (16), come diceva il conto',
  (select tutto(j) from (select salva_date_corsi(null::date, current_date + 10) j) x), '8 2 14 16 | Judo 14 18:00, Judo 16 18:00');
reset role;
select atteso('la fine è scritta', date_corsi(), '- 10');
select atteso('dopo il 10 restano solo il 14 e il 16; il passato e oggi ci sono',
  giorni(), '-3 -2 -1 0 1 2 3 4 5 6 7 8 9 10 14 16');
select atteso('le straordinarie restano tutte, anche dopo la fine', straordinarie(), '2 15');
select atteso('l''appello e le prove restano', (select count(*)::text from presenze) || ' ' || (select count(*)::text from prove), '2 2');

\echo ''
\echo '--- 2. risalvate le stesse date: niente da togliere ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('tolte 0, restano le stesse due', tutto(salva_date_corsi(null::date, current_date + 10)), '0 2 14 16 | Judo 14 18:00, Judo 16 18:00');
reset role;
select atteso('il calendario non cambia', giorni(), '-3 -2 -1 0 1 2 3 4 5 6 7 8 9 10 14 16');

\echo ''
\echo '--- 3. l''inizio spostato avanti: fra 5 giorni ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('contare prima: toglierebbe 2; restano 4, e fra le rimaste le prime tre',
  (select tutto(j) from (select salva_date_corsi(current_date + 5, current_date + 10, true) j) x), '2 4 2 16 | Judo 2 18:00, Judo 3 18:00, Judo 14 18:00');
reset role;
select atteso('contare non scrive le date', date_corsi(), '- 10');
select atteso('contare non toglie lezioni', giorni(), '-3 -2 -1 0 1 2 3 4 5 6 7 8 9 10 14 16');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('tolte quelle di domani e fra 4 giorni; restano 2 (appello), 3 (prova), 14 e 16, come diceva il conto',
  (select tutto(j) from (select salva_date_corsi(current_date + 5, current_date + 10) j) x), '2 4 2 16 | Judo 2 18:00, Judo 3 18:00, Judo 14 18:00');
reset role;
select atteso('le date sono scritte', date_corsi(), '5 10');
select atteso('oggi e il passato restano, anche se prima dell''inizio',
  giorni(), '-3 -2 -1 0 2 3 5 6 7 8 9 10 14 16');
select atteso('la straordinaria prima dell''inizio resta', straordinarie(), '2 15');

\echo ''
\echo '--- 4. chi non è la segreteria non salva le date, e niente cambia ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('l''istruttore no', codice($$select salva_date_corsi(current_date + 7, current_date + 8)$$), '42501');
select atteso('l''istruttore nemmeno per contare', codice($$select salva_date_corsi(current_date + 7, current_date + 8, true)$$), '42501');
reset role;
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('l''iscritto no', codice($$select salva_date_corsi(current_date + 7, current_date + 8)$$), '42501');
select atteso('l''iscritto nemmeno per contare', codice($$select salva_date_corsi(current_date + 7, current_date + 8, true)$$), '42501');
reset role;
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('il tablet no', codice($$select salva_date_corsi(current_date + 7, current_date + 8)$$), '42501');
select atteso('il tablet nemmeno per contare', codice($$select salva_date_corsi(current_date + 7, current_date + 8, true)$$), '42501');
reset role;
select chi('');
set role anon;
select atteso('chi non ha fatto l''accesso no', codice($$select salva_date_corsi(current_date + 7, current_date + 8)$$), '42501');
select atteso('chi non ha fatto l''accesso nemmeno per contare', codice($$select salva_date_corsi(current_date + 7, current_date + 8, true)$$), '42501');
reset role;
select atteso('le date sono quelle di prima', date_corsi(), '5 10');
select atteso('le lezioni sono quelle di prima', giorni(), '-3 -2 -1 0 2 3 5 6 7 8 9 10 14 16');

\echo ''
\echo '--- 5. date sbagliate: il check le ferma, e niente si toglie ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la fine prima dell''inizio no', codice($$select salva_date_corsi(current_date + 7, current_date + 6)$$), '23514');
select atteso('più di 400 giorni no', codice($$select salva_date_corsi(current_date + 1, current_date + 402)$$), '23514');
reset role;
select atteso('le date sono quelle di prima', date_corsi(), '5 10');
select atteso('le lezioni sono quelle di prima', giorni(), '-3 -2 -1 0 2 3 5 6 7 8 9 10 14 16');

\echo ''
\echo '--- 6. tolte le date: niente fuori, niente da togliere ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('tolte 0, restano 0, nessun giorno', esito(salva_date_corsi(null::date, null::date)), '0 0 - -');
reset role;
select atteso('le date sono vuote', date_corsi(), '- -');
select atteso('le lezioni restano', giorni(), '-3 -2 -1 0 2 3 5 6 7 8 9 10 14 16');

\echo ''
\echo '--- 7. date infinite: il check le ferma, e niente si toglie ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la fine infinita no', codice($$select salva_date_corsi(null::date, 'infinity'::date)$$), '23514');
select atteso('l''inizio infinito no', codice($$select salva_date_corsi('infinity'::date, null::date)$$), '23514');
select atteso('l''inizio a meno infinito no', codice($$select salva_date_corsi('-infinity'::date, current_date + 10)$$), '23514');
select atteso('da oggi all''infinito no', codice($$select salva_date_corsi(current_date, 'infinity'::date)$$), '23514');
reset role;
select atteso('le date sono quelle di prima', date_corsi(), '- -');
select atteso('le lezioni sono quelle di prima', giorni(), '-3 -2 -1 0 2 3 5 6 7 8 9 10 14 16');

\echo ''
\echo '--- 8. annullata, col sostituto, con la sola presenza dell''istruttore: si tolgono ---'
reset role;
update sessioni set stato = 'annullata' where id = lezione(6);
update sessioni set istruttore_id = 'aaaaaaaa-0000-0000-0000-000000000006' where id = lezione(7);
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select segna_istruttori_lezione(lezione(8), array['aaaaaaaa-0000-0000-0000-000000000002']::uuid[]);
reset role;
select atteso('la presenza dell''istruttore c''è', (select count(*)::text from presenze_istruttori where sessione_id = lezione(8)), '1');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('fine fra 5 giorni: tolte le 5 dopo (annullata, sostituto, istruttore comprese), restano 14 e 16',
  esito(salva_date_corsi(null::date, current_date + 5)), '5 2 14 16');
reset role;
select atteso('dopo il 5 restano solo il 14 e il 16', giorni(), '-3 -2 -1 0 2 3 5 14 16');
select atteso('la presenza dell''istruttore se n''è andata con la lezione', (select count(*)::text from presenze_istruttori), '0');
select atteso('l''appello e le prove restano', (select count(*)::text from presenze) || ' ' || (select count(*)::text from prove), '2 2');

\echo ''
\echo 'TUTTO A POSTO'
