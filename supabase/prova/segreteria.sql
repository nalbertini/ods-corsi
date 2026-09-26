-- La segreteria: quello che succede alle lezioni quando cambia un corso.
-- Si lancia dopo finto-supabase.sql e i cinque file dello schema.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'maura@ods.it'),
  ('33333333-3333-3333-3333-333333333333', 'estraneo@ods.it'),
  ('44444444-4444-4444-4444-444444444444', 'luca@ods.it');
-- Anna è già legata; Maura e Luca hanno solo l'email in anagrafica.
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Maura', 'Uno', 'istruttore', 'MAURA@ods.it', null),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Federico', 'Due', 'istruttore', null, null),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'Luca', 'Rossi', 'iscritto', 'luca@ods.it', null),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'Sara', 'Bianchi', 'iscritto', null, null),
  ('aaaaaaaa-0000-0000-0000-000000000006', 'Katia', 'Tre', 'istruttore', null, null);
insert into sale (id, nome) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Lotta'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Tatami'),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'Pesi');
insert into corsi (id, nome, sala_id, istruttore_id) values
  ('cccccccc-0000-0000-0000-000000000001', 'Lotta 2', 'bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002');
-- Due giorni: uno cominciato un mese fa, uno che comincia domani.
insert into ricorrenze (id, corso_id, giorno, ora, durata_min, dal) values
  ('dddddddd-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', extract(dow from current_date + 3)::int, '17:00', 60, current_date - 30),
  ('dddddddd-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000001', extract(dow from current_date + 1)::int, '18:00', 60, current_date + 1);
select materializza_sessioni(current_date - 30, current_date + 30);
insert into iscrizioni (corso_id, persona_id, dal) values
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000004', current_date - 30),
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000005', current_date - 30);

-- Luca c'era all'ultima lezione passata, Sara no. Una lezione futura ha già
-- un appello (una presenza segnata in anticipo, per assurdo): non deve sparire.
insert into presenze (sessione_id, persona_id, stato)
  select id, 'aaaaaaaa-0000-0000-0000-000000000004', 'presente' from sessioni where inizio < now() order by inizio desc limit 1;
insert into presenze (sessione_id, persona_id, stato)
  select id, 'aaaaaaaa-0000-0000-0000-000000000005', 'assente' from sessioni where inizio < now() order by inizio desc limit 1;
insert into presenze (sessione_id, persona_id, stato)
  select id, 'aaaaaaaa-0000-0000-0000-000000000004', 'giustificato' from sessioni
  where inizio > now() and ricorrenza_id = 'dddddddd-0000-0000-0000-000000000001' order by inizio limit 1;
-- Una lezione futura con un sostituto e in un'altra sala, decisi a mano.
update sessioni set istruttore_id = 'aaaaaaaa-0000-0000-0000-000000000003', sala_id = 'bbbbbbbb-0000-0000-0000-000000000002'
  where id = (select id from sessioni where inizio > now() order by inizio desc limit 1);

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

\echo ''
\echo '--- 1. il corso cambia sala e istruttore ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
update corsi set sala_id = 'bbbbbbbb-0000-0000-0000-000000000003', istruttore_id = 'aaaaaaaa-0000-0000-0000-000000000006'
  where id = 'cccccccc-0000-0000-0000-000000000001';
reset role;
select atteso('le lezioni future vanno in Pesi con Katia',
  (select count(*)::text from sessioni where inizio > now()
     and sala_id = 'bbbbbbbb-0000-0000-0000-000000000003' and istruttore_id = 'aaaaaaaa-0000-0000-0000-000000000006')
  , (select (count(*) - 1)::text from sessioni where inizio > now()));
select atteso('tranne quella decisa a mano',
  (select sa.nome || ' con ' || p.nome from sessioni s join sale sa on sa.id = s.sala_id join persone p on p.id = s.istruttore_id
     where s.inizio > now() order by s.inizio desc limit 1), 'Tatami con Federico');
select atteso('le passate restano in Lotta con Maura',
  (select count(*)::text from sessioni where inizio < now()
     and (sala_id <> 'bbbbbbbb-0000-0000-0000-000000000001' or istruttore_id <> 'aaaaaaaa-0000-0000-0000-000000000002')), '0');

\echo ''
\echo '--- 2. togliere un giorno ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('un istruttore non può', tenta($$select chiudi_ricorrenza('dddddddd-0000-0000-0000-000000000001')::text$$), 'NEGATO: …');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select chiudi_ricorrenza('dddddddd-0000-0000-0000-000000000001');
select chiudi_ricorrenza('dddddddd-0000-0000-0000-000000000002');
reset role;
select atteso('la ricorrenza cominciata si chiude a ieri',
  (select (al = current_date - 1)::text from ricorrenze where id = 'dddddddd-0000-0000-0000-000000000001'), 'true');
select atteso('quella non ancora cominciata sparisce',
  (select count(*)::text from ricorrenze where id = 'dddddddd-0000-0000-0000-000000000002'), '0');
select atteso('restano le passate e la futura con un appello',
  (select string_agg(case when inizio < now() then 'passata' else 'futura con appello' end, ',' order by inizio desc)
     from (select distinct on (inizio < now()) inizio from sessioni order by inizio < now(), inizio desc) x), 'futura con appello,passata');
select atteso('nessuna futura senza appello',
  (select count(*)::text from sessioni s where s.inizio > now() and not exists (select 1 from presenze p where p.sessione_id = s.id)), '0');

\echo ''
\echo '--- 3. archiviare ---'
-- Rigenerato, con una lezione straordinaria in più.
insert into ricorrenze (corso_id, giorno, ora, durata_min, dal)
  values ('cccccccc-0000-0000-0000-000000000001', extract(dow from current_date + 2)::int, '19:00', 60, current_date);
select materializza_sessioni(current_date, current_date + 30) > 0 as rigenerate;
insert into sessioni (corso_id, inizio, fine) values ('cccccccc-0000-0000-0000-000000000001', now() + interval '5 days 3 hours', now() + interval '5 days 4 hours');
update corsi set attivo = false where id = 'cccccccc-0000-0000-0000-000000000001';
select atteso('archiviato: future solo quelle con un appello',
  (select count(*)::text from sessioni s where s.inizio > now()), '1');
select atteso('le passate restano', (select (count(*) > 0)::text from sessioni where inizio < now()), 'true');
select atteso('e il calendario non lo rigenera', (select materializza_sessioni(current_date, current_date + 30)::text), '0');
update corsi set attivo = true where id = 'cccccccc-0000-0000-0000-000000000001';

\echo ''
\echo '--- 4. quanto viene ciascuno ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('Luca', (select presenti || '/' || dovute from frequenze(60) where persona_id = 'aaaaaaaa-0000-0000-0000-000000000004'), '1/…');
select atteso('Sara, stesse lezioni, nessuna presenza',
  (select presenti::text from frequenze(60) where persona_id = 'aaaaaaaa-0000-0000-0000-000000000005'), '0');
select atteso('stesse lezioni dovute',
  (select count(distinct dovute)::text from frequenze(60)), '1');
select atteso('fin dove è pronto il calendario', (select (calendario_pronto_fino() >= current_date)::text), 'true');
reset role;
select chi('');
set role anon;
select atteso('senza accesso', tenta($$select count(*)::text from frequenze(30)$$), 'NEGATO: permission denied…');
reset role;

\echo ''
\echo '--- 5. il primo accesso ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('Maura entra e si lega (l''email non guarda le maiuscole)', (select collega_utente()::text), 'aaaaaaaa-0000-0000-0000-000000000002');
select atteso('la seconda volta è la stessa', (select collega_utente()::text), 'aaaaaaaa-0000-0000-0000-000000000002');
select atteso('e ora il suo ruolo si sa', (select ruolo_corrente()::text), 'istruttore');
reset role;
select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('un iscritto non si lega da solo', coalesce((select collega_utente()::text), 'niente'), 'niente');
reset role;
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('un''email che non c''è', coalesce((select collega_utente()::text), 'niente'), 'niente');
-- Un account senza persona ha ruolo nullo: non deve passare per segreteria.
select atteso('e senza persona non rigenera il calendario', tenta($$select materializza_sessioni(current_date, current_date + 1)::text$$), 'NEGATO: …');
select atteso('né cancella lo storico', tenta($$select pulisci_presenze()::text$$), 'NEGATO: …');
select atteso('né chiude una ricorrenza', tenta($$select chiudi_ricorrenza(gen_random_uuid())::text$$), 'NEGATO: solo la segreteria…');
reset role;

\echo ''
\echo '--- 6. le regole ---'
select atteso('di partenza, ventiquattro mesi', (select mesi_presenze::text from impostazioni), '24');
-- Una presenza di tre anni fa: con ventiquattro mesi è scaduta, con quarantotto no.
insert into sessioni (id, corso_id, inizio, fine) values
  ('eeeeeeee-0000-0000-0000-000000000009', 'cccccccc-0000-0000-0000-000000000001', now() - interval '3 years', now() - interval '3 years' + interval '1 hour');
insert into presenze (sessione_id, persona_id, stato) values ('eeeeeeee-0000-0000-0000-000000000009', 'aaaaaaaa-0000-0000-0000-000000000004', 'presente');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('scaduta', (select count(*)::text from presenze_scadute), '1');
update impostazioni set mesi_presenze = 48;
select atteso('con quattro anni non più', (select count(*)::text from presenze_scadute), '0');
select atteso('fuori misura no', tenta($$update impostazioni set giorni_calendario = 1000$$), 'NEGATO: …');
select atteso('chi ha il PIN lo vede la segreteria', (select count(*)::text from pin_impostati()), '0');
reset role;
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('un istruttore le legge', (select mesi_presenze::text from impostazioni), '48');
select atteso('ma non le cambia', tenta($$update impostazioni set mesi_presenze = 1$$), 'a vuoto (0 righe)');
select atteso('e non sa chi ha il PIN', tenta($$select count(*)::text from pin_impostati()$$), 'NEGATO: solo la segreteria');
reset role;

\echo ''
\echo 'TUTTO A POSTO'
