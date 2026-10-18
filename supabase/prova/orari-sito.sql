-- La pagina «Orari» del sito pubblico: il generatore del sito legge gli orari
-- tipo dei corsi con `orari_sito()` (chiave anon, senza accesso). Dice solo
-- nome del corso, giorno, ora, durata e quando l'orario è cambiato l'ultima
-- volta, dei corsi attivi con ricorrenze non finite; le tabelle restano chiuse.
-- `ricorrenze.modificata_il` la scrive un trigger a ogni inserimento e a ogni
-- modifica, e nessuno la sposta a mano: da lì viene «Aggiornato al…».
-- `orari_aperti()` (48-orari-aperti.sql) resta com'è.
-- Gli stessi orari, nella metà di prova, li dà `orariSitoProva()` di
-- `src/lib/sitoProva.ts` (scripts/prova-sito-orari.mjs).
-- Si lancia dopo finto-supabase.sql, i file dello schema e 68-orari-sito.sql;
-- alla fine rilancia 06-iscrizioni.sql.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it');
insert into persone (id, nome, cognome, ruolo, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', '11111111-1111-1111-1111-111111111111');
insert into sale (id, nome) values ('bbbbbbbb-0000-0000-0000-000000000001', 'SalaSegreta');
insert into corsi (id, nome, sala_id, capienza) values
  ('cccccccc-0000-0000-0000-000000000001', 'Judo 3', 'bbbbbbbb-0000-0000-0000-000000000001', 12),
  ('cccccccc-0000-0000-0000-000000000002', 'Preparazione "atletica" & <b>forza</b>', null, null);
insert into corsi (id, nome, attivo) values ('cccccccc-0000-0000-0000-000000000003', 'Corso chiuso', false);
insert into ricorrenze (corso_id, giorno, ora, durata_min, dal, al, sala_id) values
  -- Judo 3: il lunedì senza fine, il giovedì che finisce oggi (oggi c'è ancora), il mercoledì finito ieri.
  ('cccccccc-0000-0000-0000-000000000001', 1, '18:00', 60, current_date - 30, null, 'bbbbbbbb-0000-0000-0000-000000000001'),
  ('cccccccc-0000-0000-0000-000000000001', 4, '18:00', 90, current_date - 30, current_date, null),
  ('cccccccc-0000-0000-0000-000000000001', 3, '17:00', 60, current_date - 30, current_date - 1, null),
  ('cccccccc-0000-0000-0000-000000000002', 5, '19:30', 45, current_date - 30, current_date + 200, null),
  -- Il corso archiviato ha ancora la sua ricorrenza: non si vede lo stesso.
  ('cccccccc-0000-0000-0000-000000000003', 2, '18:00', 60, current_date - 30, null, null);

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
\echo '--- 1. chi non ha un accesso legge gli orari del sito ---'
select chi('');
set role anon;
-- Ogni orario come «corso giorno ora durata»: corsi attivi, ricorrenze non finite (oggi compreso).
select atteso('gli orari: corsi attivi, ricorrenze non finite (oggi compreso)',
  tenta($$select string_agg(corso || ' ' || giorno || ' ' || to_char(ora, 'HH24:MI') || ' ' || durata_min, '; ' order by corso, giorno) from orari_sito()$$),
  'Judo 3 1 18:00 60; Judo 3 4 18:00 90; Preparazione "atletica" & <b>forza</b> 5 19:30 45');
select atteso('solo corso, giorno, ora, durata e data di modifica: niente sala, capienza, id, date, istruttori',
  tenta($$select string_agg(k, ', ' order by k) from (select distinct jsonb_object_keys(to_jsonb(o)) k from orari_sito() o) x$$),
  'corso, durata_min, giorno, modificata_il, ora');
select atteso('il nome del corso esce com’è (si escapa nel sito, non qui)',
  tenta($$select count(*)::text from orari_sito() where corso = 'Preparazione "atletica" & <b>forza</b>'$$), '1');
select atteso('un corso archiviato non c’è',
  tenta($$select count(*)::text from orari_sito() where corso = 'Corso chiuso'$$), '0');
select atteso('una ricorrenza finita ieri non c’è',
  tenta($$select count(*)::text from orari_sito() where giorno = 3$$), '0');
select atteso('la sala e la capienza non compaiono',
  tenta($$select count(*)::text from orari_sito() o where to_jsonb(o)::text ~* 'SalaSegreta|sala|capienza'$$), '0');

\echo ''
\echo '--- 2. le tabelle restano chiuse ---'
select atteso('non legge le ricorrenze', tenta($$select count(*)::text from ricorrenze$$), 'NEGATO: …');
select atteso('non legge le sessioni', tenta($$select count(*)::text from sessioni$$), 'NEGATO: …');
select atteso('non legge i corsi', tenta($$select count(*)::text from corsi$$), 'NEGATO: …');
select atteso('non legge nemmeno la colonna nuova', tenta($$select modificata_il from ricorrenze$$), 'NEGATO: …');
select atteso('non scrive le ricorrenze', tenta($$update ricorrenze set ora = '03:00'$$), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 3. con un accesso la funzione risponde uguale; orari_aperti() è rimasta com’è ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria vede gli stessi orari', tenta($$select count(*)::text from orari_sito()$$), '3');
reset role;
select chi('');
set role anon;
select atteso('orari_aperti() dà ancora corso_id, giorno, ora, durata_min',
  tenta($$select string_agg(k, ', ' order by k) from (select distinct jsonb_object_keys(to_jsonb(o)) k from orari_aperti() o) x$$),
  'corso_id, durata_min, giorno, ora');
select atteso('e gli stessi tre orari', tenta($$select count(*)::text from orari_aperti()$$), '3');
reset role;

\echo ''
\echo '--- 4. «Aggiornato al»: modificata_il la scrive il database ---'
select atteso('una ricorrenza nuova ha la data di adesso',
  tenta($$select (modificata_il > now() - interval '1 minute' and modificata_il <= now())::text from ricorrenze where giorno = 1 and corso_id = 'cccccccc-0000-0000-0000-000000000001'$$), 'true');
select atteso('anche se chi inserisce ne scrive un’altra, vale quella di adesso',
  tenta($$insert into ricorrenze (corso_id, giorno, ora, durata_min, dal, modificata_il) values ('cccccccc-0000-0000-0000-000000000003', 6, '10:00', 60, current_date, '2001-01-01')$$), 'FATTO (1 righe)');
select atteso('la data scritta a mano non è rimasta',
  tenta($$select (modificata_il > now() - interval '1 minute')::text from ricorrenze where giorno = 6$$), 'true');
-- Si porta una ricorrenza indietro nel tempo scavalcando il trigger, per vedere che una modifica la sposta avanti.
alter table ricorrenze disable trigger user;
update ricorrenze set modificata_il = '2020-01-01 10:00+01' where corso_id = 'cccccccc-0000-0000-0000-000000000002';
alter table ricorrenze enable trigger user;
select atteso('(la ricorrenza di Preparazione è ferma al 2020)',
  tenta($$select modificata_il::date::text from ricorrenze where corso_id = 'cccccccc-0000-0000-0000-000000000002'$$), '2020-01-01');
select atteso('cambiare l’ora di una ricorrenza la porta ad adesso',
  tenta($$update ricorrenze set ora = '20:00' where corso_id = 'cccccccc-0000-0000-0000-000000000002'$$), 'FATTO (1 righe)');
select atteso('è adesso',
  tenta($$select (modificata_il > now() - interval '1 minute')::text from ricorrenze where corso_id = 'cccccccc-0000-0000-0000-000000000002'$$), 'true');
select atteso('una modifica che prova a scrivere una data vecchia',
  tenta($$update ricorrenze set modificata_il = '2020-01-01' where corso_id = 'cccccccc-0000-0000-0000-000000000002'$$), 'FATTO (1 righe)');
select atteso('e provare a rimettere una data vecchia a mano non funziona',
  tenta($$select (modificata_il > now() - interval '1 minute')::text from ricorrenze where corso_id = 'cccccccc-0000-0000-0000-000000000002'$$), 'true');
-- Una modifica che non tocca l'orario (la sala, per esempio) non fa dire «Aggiornato al» oggi.
alter table ricorrenze disable trigger user;
update ricorrenze set modificata_il = '2020-01-01 10:00+01' where corso_id = 'cccccccc-0000-0000-0000-000000000002';
alter table ricorrenze enable trigger user;
select atteso('cambiare solo la sala non sposta la data',
  tenta($$update ricorrenze set sala_id = 'bbbbbbbb-0000-0000-0000-000000000001' where corso_id = 'cccccccc-0000-0000-0000-000000000002'$$), 'FATTO (1 righe)');
select atteso('è ancora quella di prima',
  tenta($$select modificata_il::date::text from ricorrenze where corso_id = 'cccccccc-0000-0000-0000-000000000002'$$), '2020-01-01');
select atteso('una modifica che non cambia nulla non sposta la data',
  tenta($$update ricorrenze set sala_id = sala_id where corso_id = 'cccccccc-0000-0000-0000-000000000002'$$), 'FATTO (1 righe)');
select atteso('(nemmeno se scrive la data a mano)',
  tenta($$update ricorrenze set sala_id = null, modificata_il = now() where corso_id = 'cccccccc-0000-0000-0000-000000000002'$$), 'FATTO (1 righe)');
select atteso('la data è ancora quella di prima',
  tenta($$select modificata_il::date::text from ricorrenze where corso_id = 'cccccccc-0000-0000-0000-000000000002'$$), '2020-01-01');
select atteso('cambiare la durata la porta ad adesso',
  tenta($$update ricorrenze set durata_min = 50 where corso_id = 'cccccccc-0000-0000-0000-000000000002'$$), 'FATTO (1 righe)');
select atteso('è adesso (durata)',
  tenta($$select (modificata_il > now() - interval '1 minute')::text from ricorrenze where corso_id = 'cccccccc-0000-0000-0000-000000000002'$$), 'true');
alter table ricorrenze disable trigger user;
update ricorrenze set modificata_il = '2020-01-01 10:00+01' where corso_id = 'cccccccc-0000-0000-0000-000000000002';
alter table ricorrenze enable trigger user;
select atteso('cambiare il giorno la porta ad adesso',
  tenta($$update ricorrenze set giorno = 6 where corso_id = 'cccccccc-0000-0000-0000-000000000002'$$), 'FATTO (1 righe)');
select atteso('è adesso (giorno)',
  tenta($$select (modificata_il > now() - interval '1 minute')::text from ricorrenze where corso_id = 'cccccccc-0000-0000-0000-000000000002'$$), 'true');
alter table ricorrenze disable trigger user;
update ricorrenze set modificata_il = '2020-01-01 10:00+01' where corso_id = 'cccccccc-0000-0000-0000-000000000002';
alter table ricorrenze enable trigger user;
select atteso('cambiare la fine la porta ad adesso',
  tenta($$update ricorrenze set al = current_date + 100 where corso_id = 'cccccccc-0000-0000-0000-000000000002'$$), 'FATTO (1 righe)');
select atteso('è adesso (fine)',
  tenta($$select (modificata_il > now() - interval '1 minute')::text from ricorrenze where corso_id = 'cccccccc-0000-0000-0000-000000000002'$$), 'true');
select chi('');
set role anon;
select atteso('orari_sito() dà la data di modifica più recente: oggi',
  tenta($$select ((max(modificata_il) at time zone 'Europe/Rome')::date = current_date)::text from orari_sito()$$), 'true');
reset role;

\echo ''
\echo '--- 5. la voce di menu «Orari» solo se la pagina esiste ed è pubblicata ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la pagina «orari» nasce in bozza',
  tenta($$insert into sito_pagine (slug, titolo, bozza) values ('orari', 'Orari', '<p>[orari]</p>')$$), 'FATTO (1 righe)');
select atteso('in bozza: il menu la rifiuta, col nome della voce',
  tenta($$select salva_menu_sito('menu', jsonb_build_array(jsonb_build_object('etichetta', 'Orari', 'pagina_id', (select id from sito_pagine where slug = 'orari'))))::text$$),
  'NEGATO: La voce «Orari» porta a una pagina nascosta o non ancora pubblicata: pubblicala o togli la voce');
select atteso('la pubblica', tenta($$select pubblica_pagina_sito(id, versione)::text from sito_pagine where slug = 'orari'$$), '2');
select atteso('pubblicata: il menu la accetta',
  tenta($$select salva_menu_sito('menu', jsonb_build_array(jsonb_build_object('etichetta', 'Orari', 'pagina_id', (select id from sito_pagine where slug = 'orari'))))::text$$), '');
reset role;

\echo ''
\echo '--- 6. dopo aver rilanciato 06-iscrizioni.sql ---'
-- 06 toglie ad `anon` le funzioni che non conosce: se il 68 c'è già, deve
-- ridargli orari_sito(), come fa per orari_aperti().
\ir ../06-iscrizioni.sql
-- 06 toglie ad `anon` anche gli aiuti della prova, che stanno in `public`:
-- glieli si ridà, e solo quelli.
grant execute on function tenta(text), atteso(text, text, text), chi(text) to anon, authenticated;
select chi('');
set role anon;
select atteso('anon chiama ancora orari_sito()', tenta($$select count(*)::text from orari_sito()$$), '3');
select atteso('e orari_aperti()', tenta($$select count(*)::text from orari_aperti()$$), '3');
select atteso('e le ricorrenze restano chiuse', tenta($$select count(*)::text from ricorrenze$$), 'NEGATO: …');
reset role;
