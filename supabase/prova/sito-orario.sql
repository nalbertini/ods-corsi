-- L'orario del sito viene da CORSI: una pagina si collega a uno o più corsi
-- (`sito_pagine.corsi_collegati`, 67-sito-orario.sql) e il sito generato ne
-- legge le ricorrenze con `orari_aperti()`. Il collegamento lo scrive solo la
-- segreteria, con `salva_corsi_sito`; il sito pubblico lo legge solo delle
-- pagine pubblicate, da `sito_pagine_pubbliche()` (colonna `corsi_collegati`);
-- le tabelle dei corsi restano chiuse e `orari_aperti()` dice solo corso,
-- giorno, ora e durata, mai sala, istruttore, posti o iscritti.
-- Le stesse regole, nella metà di prova, sono in `collegaCorsi` di
-- `src/lib/sitoProva.ts` (scripts/prova-sito-orario.mjs).
-- Si lancia dopo finto-supabase.sql, i file dello schema (48-orari-aperti.sql,
-- 56-sito.sql e 67-sito-orario.sql compresi). Parte da un database pulito.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'maura@ods.it'),
  ('33333333-3333-3333-3333-333333333333', 'luca@ods.it');
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Maura', 'Uno', 'istruttore', 'maura@ods.it', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Luca', 'Rossi', 'iscritto', 'luca@ods.it', '33333333-3333-3333-3333-333333333333');
insert into corsi (id, nome) values
  ('cccccccc-0000-0000-0000-000000000001', 'Avviamento piccoli'),
  ('cccccccc-0000-0000-0000-000000000002', 'Avviamento grandi');
insert into corsi (id, nome, attivo) values ('cccccccc-0000-0000-0000-000000000003', 'Corso chiuso', false);
insert into ricorrenze (corso_id, giorno, ora, durata_min, dal, al) values
  ('cccccccc-0000-0000-0000-000000000001', 1, '17:00', 60, current_date - 30, null),
  ('cccccccc-0000-0000-0000-000000000001', 3, '17:00', 60, current_date - 30, null),
  ('cccccccc-0000-0000-0000-000000000002', 6, '10:00', 60, current_date - 30, null),
  ('cccccccc-0000-0000-0000-000000000002', 6, '11:15', 60, current_date - 30, null),
  -- Finita ieri: l'orario vecchio non deve tornare sul sito.
  ('cccccccc-0000-0000-0000-000000000002', 2, '16:30', 60, current_date - 30, current_date - 1),
  ('cccccccc-0000-0000-0000-000000000003', 5, '20:00', 60, current_date - 30, null);

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
\echo '--- 1. la segreteria collega le pagine ai corsi ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('scrive tre pagine', tenta($$insert into sito_pagine (slug, titolo, bozza) values
  ('avviamento', 'Avviamento', '<p>Orari</p>'), ('autodifesa', 'Autodifesa', '<p>Orari</p>'), ('segreta', 'Segreta', '<p>Orari</p>'), ('inbozza', 'In bozza', '<p>Orari</p>')$$), 'FATTO (4 righe)');
reset role;
update sito_pagine set id = 'ffffffff-0000-0000-0000-0000000000a1' where slug = 'avviamento';
update sito_pagine set id = 'ffffffff-0000-0000-0000-0000000000a2' where slug = 'autodifesa';
update sito_pagine set id = 'ffffffff-0000-0000-0000-0000000000a3' where slug = 'segreta';
update sito_pagine set id = 'ffffffff-0000-0000-0000-0000000000a4' where slug = 'inbozza';
set role authenticated;
select atteso('una pagina nuova non è collegata a nessun corso',
  (select coalesce(array_length(corsi_collegati, 1), 0)::text from sito_pagine where slug = 'avviamento'), '0');
select atteso('collega due corsi',
  tenta($$select salva_corsi_sito('ffffffff-0000-0000-0000-0000000000a1', array['cccccccc-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000002']::uuid[])::text$$), '');
select atteso('i corsi si rileggono, nell''ordine in cui sono stati scelti',
  (select corsi_collegati::text from sito_pagine where slug = 'avviamento'), '{cccccccc-0000-0000-0000-000000000001,cccccccc-0000-0000-0000-000000000002}');
select atteso('lo stesso corso due volte vale una volta',
  tenta($$select salva_corsi_sito('ffffffff-0000-0000-0000-0000000000a2', array['cccccccc-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001']::uuid[])::text$$), '');
select atteso('…e resta uno', (select array_length(corsi_collegati, 1)::text from sito_pagine where slug = 'autodifesa'), '1');
select atteso('un corso che non c''è non si collega',
  tenta($$select salva_corsi_sito('ffffffff-0000-0000-0000-0000000000a2', array['cccccccc-0000-0000-0000-0000000000ff']::uuid[])::text$$), 'NEGATO: …');
select atteso('…e i corsi di prima restano', (select corsi_collegati::text from sito_pagine where slug = 'autodifesa'), '{cccccccc-0000-0000-0000-000000000001}');
select atteso('una pagina che non c''è',
  tenta($$select salva_corsi_sito('ffffffff-0000-0000-0000-0000000000ff', array[]::uuid[])::text$$), 'NEGATO: La pagina non c’è più');
select atteso('collegare non tocca la versione né la bozza',
  (select versione || ' ' || bozza from sito_pagine where slug = 'avviamento'), '1 <p>Orari</p>');
select atteso('si scollega con una lista vuota',
  tenta($$select salva_corsi_sito('ffffffff-0000-0000-0000-0000000000a2', array[]::uuid[])::text$$), '');
select atteso('…e la pagina torna senza corsi', (select coalesce(array_length(corsi_collegati, 1), 0)::text from sito_pagine where slug = 'autodifesa'), '0');
select atteso('i corsi della pagina si possono collegare più volte', tenta($$select salva_corsi_sito('ffffffff-0000-0000-0000-0000000000a2', array['cccccccc-0000-0000-0000-000000000002']::uuid[])::text$$), '');
-- Si pubblicano la prima e la seconda; la terza si pubblica e poi si nasconde; la quarta resta in bozza.
select atteso('pubblica avviamento', tenta($$select pubblica_pagina_sito('ffffffff-0000-0000-0000-0000000000a1', 1)::text$$), '2');
select atteso('pubblica autodifesa', tenta($$select pubblica_pagina_sito('ffffffff-0000-0000-0000-0000000000a2', 1)::text$$), '2');
select atteso('pubblica la segreta', tenta($$select pubblica_pagina_sito('ffffffff-0000-0000-0000-0000000000a3', 1)::text$$), '2');
select atteso('collega la segreta', tenta($$select salva_corsi_sito('ffffffff-0000-0000-0000-0000000000a3', array['cccccccc-0000-0000-0000-000000000001']::uuid[])::text$$), '');
select atteso('collega quella in bozza', tenta($$select salva_corsi_sito('ffffffff-0000-0000-0000-0000000000a4', array['cccccccc-0000-0000-0000-000000000001']::uuid[])::text$$), '');
select atteso('nasconde la segreta', tenta($$update sito_pagine set nascosta = true where slug = 'segreta'$$), 'FATTO (1 righe)');
reset role;

\echo ''
\echo '--- 2. chi non ha un accesso legge i corsi collegati solo delle pagine pubblicate ---'
select chi('');
set role anon;
select atteso('legge i corsi collegati di una pagina pubblicata',
  (select corsi_collegati::text from sito_pagine_pubbliche() where slug = 'avviamento'), '{cccccccc-0000-0000-0000-000000000001,cccccccc-0000-0000-0000-000000000002}');
select atteso('anche di un''altra',
  (select corsi_collegati::text from sito_pagine_pubbliche() where slug = 'autodifesa'), '{cccccccc-0000-0000-0000-000000000002}');
select atteso('una pagina nascosta non c''è, e con lei il suo collegamento',
  (select count(*)::text from sito_pagine_pubbliche() where slug = 'segreta'), '0');
select atteso('una pagina mai pubblicata non c''è',
  (select count(*)::text from sito_pagine_pubbliche() where slug = 'inbozza'), '0');
select atteso('non legge la colonna dalla tabella', tenta($$select corsi_collegati::text from sito_pagine$$), 'NEGATO: …');
select atteso('non legge la tabella', tenta($$select count(*)::text from sito_pagine$$), 'NEGATO: …');
select atteso('non collega corsi', tenta($$select salva_corsi_sito('ffffffff-0000-0000-0000-0000000000a1', array[]::uuid[])::text$$), 'NEGATO: …');
select atteso('non scrive la colonna', tenta($$update sito_pagine set corsi_collegati = '{}'$$), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 3. istruttori, iscritti e tablet non collegano ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('l''istruttore non collega', tenta($$select salva_corsi_sito('ffffffff-0000-0000-0000-0000000000a1', array[]::uuid[])::text$$), 'NEGATO: Serve un accesso da segreteria');
select atteso('l''istruttore non scrive la colonna', tenta($$update sito_pagine set corsi_collegati = '{}'$$), 'NEGATO: …');
reset role;
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('l''iscritto non collega', tenta($$select salva_corsi_sito('ffffffff-0000-0000-0000-0000000000a1', array[]::uuid[])::text$$), 'NEGATO: Serve un accesso da segreteria');
reset role;
select atteso('i corsi della pagina sono quelli di prima',
  (select array_length(corsi_collegati, 1)::text from sito_pagine where slug = 'avviamento'), '2');

\echo ''
\echo '--- 4. gli orari che il sito legge: giorno, ora e durata, nient''altro ---'
select chi('');
set role anon;
select atteso('gli orari dei corsi attivi, senza la ricorrenza finita ieri né il corso chiuso',
  tenta($$select string_agg(right(corso_id::text, 1) || ' ' || giorno || ' ' || to_char(ora, 'HH24:MI') || ' ' || durata_min, '; ' order by corso_id, giorno, ora) from orari_aperti()$$),
  '1 1 17:00 60; 1 3 17:00 60; 2 6 10:00 60; 2 6 11:15 60');
select atteso('solo corso, giorno, ora e durata: né sala, né istruttore, né posti, né iscritti',
  tenta($$select string_agg(k, ', ' order by k) from (select distinct jsonb_object_keys(to_jsonb(o)) k from orari_aperti() o) x$$),
  'corso_id, durata_min, giorno, ora');
select atteso('non legge le ricorrenze', tenta($$select count(*)::text from ricorrenze$$), 'NEGATO: …');
select atteso('non legge i corsi', tenta($$select count(*)::text from corsi$$), 'NEGATO: …');
select atteso('non legge le sessioni', tenta($$select count(*)::text from sessioni$$), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 5. dopo aver rilanciato 06-iscrizioni.sql ---'
\ir ../06-iscrizioni.sql
grant execute on function tenta(text), atteso(text, text, text), chi(text) to anon, authenticated;
select chi('');
set role anon;
select atteso('anon legge ancora i corsi collegati delle pagine pubblicate',
  (select corsi_collegati::text from sito_pagine_pubbliche() where slug = 'autodifesa'), '{cccccccc-0000-0000-0000-000000000002}');
select atteso('e ancora gli orari', tenta($$select count(*)::text from orari_aperti()$$), '4');
select atteso('ma ancora non collega', tenta($$select salva_corsi_sito('ffffffff-0000-0000-0000-0000000000a1', array[]::uuid[])::text$$), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 6. rilanciando 56-sito.sql la funzione perde la colonna; il 67 la rimette ---'
\ir ../56-sito.sql
grant execute on function tenta(text), atteso(text, text, text), chi(text) to anon, authenticated;
select chi('');
set role anon;
select atteso('dopo solo il 56 la funzione pubblica non ha corsi_collegati (e si può rilanciare)',
  (select count(*)::text from pg_proc p where p.proname = 'sito_pagine_pubbliche' and 'corsi_collegati' = any(p.proargnames)), '0');
select atteso('…e le pagine si leggono lo stesso', (select count(*)::text from sito_pagine_pubbliche() where slug = 'avviamento'), '1');
reset role;
\ir ../67-sito-orario.sql
grant execute on function tenta(text), atteso(text, text, text), chi(text) to anon, authenticated;
select chi('');
set role anon;
select atteso('dopo il 67 anon legge di nuovo i corsi collegati',
  (select corsi_collegati::text from sito_pagine_pubbliche() where slug = 'avviamento'), '{cccccccc-0000-0000-0000-000000000001,cccccccc-0000-0000-0000-000000000002}');
select atteso('anon non collega ancora', tenta($$select salva_corsi_sito('ffffffff-0000-0000-0000-0000000000a1', array[]::uuid[])::text$$), 'NEGATO: …');
reset role;
select atteso('i corsi collegati delle pagine non si sono persi', (select count(*)::text from sito_pagine where coalesce(array_length(corsi_collegati, 1), 0) > 0), '4');
