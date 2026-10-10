\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

-- Chi non ha un accesso chiama solo le funzioni del modulo di iscrizione.
-- Si guarda prima di creare gli aiuti della prova, che stanno in `public`;
-- `atteso` per questo sta in `pg_temp`. Contano anche le funzioni dei
-- trigger: ogni file toglie i permessi alle sue, e una dimenticata è qui.
create function pg_temp.atteso(cosa text, avuto text, voluto text) returns text language plpgsql as $$
begin
  if avuto is distinct from voluto then
    raise exception '% · atteso «%», avuto «%»', cosa, voluto, avuto;
  end if;
  return 'ok  ' || cosa || ' → ' || avuto;
end $$;
select pg_temp.atteso('le funzioni che chiama anon',
  (select string_agg(p.proname, ', ' order by p.proname) from pg_proc p
    where p.pronamespace = 'public'::regnamespace and has_function_privilege('anon', p.oid, 'execute')),
  'corsi_aperti, invia_iscrizione, invia_ordine_vestiario, iscrizioni_regole, listino, mesi_presenze_pubblici, orari_aperti, puo_caricare, vestiario');
-- Ogni funzione dice dove cerca le tabelle: se no le cerca nel search_path di
-- chi la chiama, che se lo può cambiare (l'avviso di Supabase).
select pg_temp.atteso('le funzioni senza search_path',
  (select coalesce(string_agg(p.proname, ', ' order by p.proname), 'nessuna') from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
      and not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%')),
  'nessuna');

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'staff@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'istruttore@ods.it'),
  ('33333333-3333-3333-3333-333333333333', 'iscritto@ods.it');
insert into persone (id, nome, cognome, ruolo, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff',       '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Maurizio', 'Innella', 'istruttore', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Luca', 'Rossi', 'iscritto',         '33333333-3333-3333-3333-333333333333'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'Sara', 'Bianchi', 'iscritto', null);
insert into sale (id, nome) values ('bbbbbbbb-0000-0000-0000-000000000001', 'Sala grande');
insert into corsi (id, nome, sala_id, istruttore_id) values
  ('cccccccc-0000-0000-0000-000000000001', 'Spinning', 'bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002');
insert into ricorrenze (corso_id, giorno, ora, durata_min, dal)
  values ('cccccccc-0000-0000-0000-000000000001', 2, '19:00', 50, '2026-10-01');
-- Un secondo corso, tenuto da un'altra persona: serve a provare il rovescio
-- della policy, cioè che l'istruttore non metta le mani sulle lezioni altrui.
insert into persone (id, nome, cognome, ruolo) values
  ('aaaaaaaa-0000-0000-0000-000000000005', 'Giulia', 'Ferrero', 'istruttore');
insert into corsi (id, nome, istruttore_id) values
  ('cccccccc-0000-0000-0000-000000000002', 'Pilates', 'aaaaaaaa-0000-0000-0000-000000000005');
insert into ricorrenze (corso_id, giorno, ora, durata_min, dal)
  values ('cccccccc-0000-0000-0000-000000000002', 4, '10:00', 55, '2026-10-01');
insert into iscrizioni (corso_id, persona_id) values
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003'),
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000004');
select materializza_sessioni('2026-10-01', '2026-10-31');
insert into presenze (sessione_id, persona_id, stato)
  select id, 'aaaaaaaa-0000-0000-0000-000000000003', 'presente' from sessioni order by inizio limit 1;
insert into presenze (sessione_id, persona_id, stato)
  select id, 'aaaaaaaa-0000-0000-0000-000000000004', 'assente' from sessioni order by inizio limit 1;

create or replace function chi(u text) returns void language plpgsql as $$
begin perform set_config('prova.utente', u, false); end $$;

-- «quanto vede» e «cosa gli è permesso», da ciascun punto di vista
-- Conta le righe toccate, non si limita a vedere se l'istruzione passa: una
-- policy che non fa combaciare nessuna riga lascia passare l'UPDATE a vuoto, e
-- un test che guarda solo l'eccezione lo scambia per un permesso concesso.
create or replace function tenta(sql text) returns text language plpgsql as $$
declare n int;
begin
  execute sql; get diagnostics n = row_count;
  return case when n = 0 then 'a vuoto (0 righe)' else 'FATTO (' || n || ' righe)' end;
exception when others then return 'NEGATO';
end $$;

\echo ''
\echo '--- ISCRITTO (Luca) ---'
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select 'persone che vede' t, count(*) n, coalesce(string_agg(cognome, ', '), '—') chi from persone
union all select 'sessioni', count(*), '' from sessioni
union all select 'iscrizioni', count(*), '' from iscrizioni
union all select 'presenze', count(*), coalesce(string_agg(stato::text, ', '), '—') from presenze;
select tenta($$insert into corsi (nome) values ('Corso abusivo')$$) as "crea un corso",
       tenta($$update presenze set stato = 'presente'$$)            as "cambia una presenza",
       tenta($$select * from presenze_scadute$$)                    as "righe nella vista",
       tenta($$select materializza_sessioni('2026-11-01','2026-11-30')$$) as "rigenera il calendario";
reset role;
select stato as "la presenza di Sara dopo il tentativo dell'iscritto" from presenze pr
  where pr.persona_id = 'aaaaaaaa-0000-0000-0000-000000000004';

\echo ''
\echo '--- ISTRUTTORE (Maurizio) ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select 'persone che vede' t, count(*) n from persone
union all select 'presenze', count(*) from presenze;
select tenta($$insert into presenze (sessione_id, persona_id, stato)
               select id, 'aaaaaaaa-0000-0000-0000-000000000004', 'presente' from sessioni order by inizio offset 1 limit 1$$) as "segna una presenza",
       tenta($$insert into corsi (nome) values ('Corso abusivo')$$)  as "crea un corso",
       tenta($$delete from presenze where persona_id = 'aaaaaaaa-0000-0000-0000-000000000004'$$) as "toglie il segno di Sara",
       tenta($$update sessioni set stato = 'svolta' where corso_id = 'cccccccc-0000-0000-0000-000000000001'$$) as "chiude le sue lezioni",
       tenta($$update sessioni set stato = 'annullata' where corso_id = 'cccccccc-0000-0000-0000-000000000002'$$) as "annulla quelle di Giulia",
       tenta($$update sessioni set inizio = inizio + interval '1 hour', fine = fine + interval '1 hour' where corso_id = 'cccccccc-0000-0000-0000-000000000001'$$) as "sposta le sue lezioni";
reset role;
select count(*) as "segni di Sara dopo che l'istruttore li ha tolti" from presenze where persona_id = 'aaaaaaaa-0000-0000-0000-000000000004';
select coalesce(string_agg(distinct stato::text, ', '), '—') as "stato delle lezioni di Giulia"
  from sessioni where corso_id = 'cccccccc-0000-0000-0000-000000000002';

\echo ''
\echo '--- SEGRETERIA (Anna) ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select 'persone che vede' t, count(*) n from persone;
select tenta($$insert into corsi (nome) values ('Corso nuovo')$$)   as "crea un corso",
       tenta($$delete from presenze where false$$)                  as "cancella le presenze",
       tenta($$select materializza_sessioni('2026-11-01','2026-11-30')$$) as "rigenera il calendario";
reset role;

\echo ''
\echo '--- SENZA ACCESSO (anon) ---'
select chi('');
set role anon;
select tenta($$select count(*) from persone$$)  as "legge le persone",
       tenta($$select count(*) from sessioni$$) as "legge il calendario",
       tenta($$select count(*) from presenze$$) as "legge le presenze";
reset role;

\echo ''
\echo '--- il server decide chi ha segnato ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
-- Maurizio prova a dare la colpa ad Anna
insert into presenze (sessione_id, persona_id, stato, segnata_da)
  select id, 'aaaaaaaa-0000-0000-0000-000000000003', 'assente', 'aaaaaaaa-0000-0000-0000-000000000001'
  from sessioni order by inizio offset 2 limit 1
  on conflict (sessione_id, persona_id) do update set stato = excluded.stato, segnata_da = excluded.segnata_da;
reset role;
select p.cognome as "risulta segnata da" from presenze pr join persone p on p.id = pr.segnata_da
  where pr.stato = 'assente' and pr.persona_id = 'aaaaaaaa-0000-0000-0000-000000000003';

\echo ''
\echo '--- ATTIVITÀ dei giorni e delle lezioni (41-attivita.sql) ---'
-- L'elenco lo scrive la segreteria; l'istruttore lo legge e sceglie per le sue
-- lezioni, mai per quelle di un altro; chi non ha l'accesso non lo vede.
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select pg_temp.atteso('la segreteria scrive l''elenco', tenta($$insert into attivita (id, nome) values ('a1000000-0000-0000-0000-000000000001', 'Sacco')$$), 'FATTO (1 righe)');
reset role;
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select pg_temp.atteso('l''istruttore legge l''elenco', (select count(*)::text from attivita), '1');
select pg_temp.atteso('ma non ci scrive', tenta($$insert into attivita (nome) values ('Abusiva')$$), 'NEGATO');
select pg_temp.atteso('né lo cambia', tenta($$update attivita set nome = 'Abusiva'$$), 'a vuoto (0 righe)');
select pg_temp.atteso('né toglie una voce', tenta($$delete from attivita$$), 'a vuoto (0 righe)');
select pg_temp.atteso('né sceglie quella di un giorno', tenta($$update ricorrenze set attivita_id = 'a1000000-0000-0000-0000-000000000001'$$), 'a vuoto (0 righe)');
select pg_temp.atteso('cambia l''attività delle sue lezioni',
  tenta($$update sessioni set attivita_id = 'a1000000-0000-0000-0000-000000000001' where corso_id = 'cccccccc-0000-0000-0000-000000000001'$$), 'FATTO (' || (select count(*) from sessioni where corso_id = 'cccccccc-0000-0000-0000-000000000001') || ' righe)');
select pg_temp.atteso('non quella delle lezioni di Giulia',
  tenta($$update sessioni set attivita_id = 'a1000000-0000-0000-0000-000000000001' where corso_id = 'cccccccc-0000-0000-0000-000000000002'$$), 'a vuoto (0 righe)');
reset role;
select chi('');
set role anon;
select pg_temp.atteso('anon non legge l''elenco', tenta($$select count(*) from attivita$$), 'NEGATO');
select pg_temp.atteso('anon non lo scrive', tenta($$insert into attivita (nome) values ('Abusiva')$$), 'NEGATO');
reset role;

\echo ''
\echo '--- EMAIL DI CONTATTO (44-email-contatto.sql) ---'
-- Il contatto ha la stessa visibilità dell'email, né più né meno: lo scrive solo
-- la segreteria; il personale vede le schede di tutti (persone_legge, 02-policy.sql)
-- e quindi anche il contatto, come oggi l'email; il tablet, un iscritto (che vede
-- solo sé) e chi non ha l'accesso no. Le due funzioni dicono «non lo legge» sia
-- quando la colonna è negata sia quando di contatti non ne arriva nessuno.
update persone set email_contatto = 'mamma@esempio.it' where id = 'aaaaaaaa-0000-0000-0000-000000000004';
update persone set email_contatto = 'luca.casa@esempio.it' where id = 'aaaaaaaa-0000-0000-0000-000000000003';
insert into auth.users (id, email) values ('66666666-6666-6666-6666-666666666666', 'tablet@sale.ods-corsi.it');
insert into postazioni (id, nome, sala_id, utente_id) values
  ('dddddddd-0000-0000-0000-000000000001', 'Tablet sala grande', 'bbbbbbbb-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666666');
create or replace function contatti_letti() returns text language plpgsql as $$
declare n int;
begin
  select count(*) into n from persone where email_contatto is not null;
  return case when n = 0 then 'non lo legge' else 'ne legge ' || n end;
exception when insufficient_privilege then return 'non lo legge';
end $$;
create or replace function contatto_visto() returns text language plpgsql as $$
declare n text;
begin
  select string_agg(coalesce(email_contatto::text, '—'), ',') into n from persone where id = 'aaaaaaaa-0000-0000-0000-000000000004';
  return coalesce(n, 'non lo legge');
exception when insufficient_privilege then return 'non lo legge';
end $$;
grant execute on function contatti_letti(), contatto_visto() to anon, authenticated;

select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select pg_temp.atteso('la segreteria legge i contatti', contatti_letti(), 'ne legge 2');
select pg_temp.atteso('la segreteria li scrive', tenta($$update persone set email_contatto = 'mamma.bianchi@esempio.it' where id = 'aaaaaaaa-0000-0000-0000-000000000004'$$), 'FATTO (1 righe)');
reset role;
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select pg_temp.atteso('un istruttore li vede come vede le email', contatti_letti(), 'ne legge 2');
select pg_temp.atteso('anche quello di Sara', contatto_visto(), 'mamma.bianchi@esempio.it');
-- Negato o a vuoto, l'importante è che non cambi.
select pg_temp.atteso('né lo scrive', (tenta($$update persone set email_contatto = 'abusivo@esempio.it' where id = 'aaaaaaaa-0000-0000-0000-000000000004'$$) in ('NEGATO', 'a vuoto (0 righe)'))::text, 'true');
reset role;
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select pg_temp.atteso('un iscritto non legge il contatto di Sara', contatto_visto(), 'non lo legge');
reset role;
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select pg_temp.atteso('il tablet di sala non legge i contatti', contatti_letti(), 'non lo legge');
select pg_temp.atteso('né quello di Sara', contatto_visto(), 'non lo legge');
reset role;
select chi('');
set role anon;
select pg_temp.atteso('chi non ha l''accesso non legge i contatti', contatti_letti(), 'non lo legge');
reset role;
select pg_temp.atteso('il contatto di Sara è quello scritto dalla segreteria', (select email_contatto::text from persone where id = 'aaaaaaaa-0000-0000-0000-000000000004'), 'mamma.bianchi@esempio.it');
