\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

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
       tenta($$delete from presenze$$)                              as "cancella le presenze",
       tenta($$update sessioni set stato = 'svolta' where corso_id = 'cccccccc-0000-0000-0000-000000000001'$$) as "chiude le sue lezioni",
       tenta($$update sessioni set stato = 'annullata' where corso_id = 'cccccccc-0000-0000-0000-000000000002'$$) as "annulla quelle di Giulia";
reset role;
select count(*) as "presenze sopravvissute al delete dell'istruttore" from presenze;
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
