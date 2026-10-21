-- I dati per pagare i tecnici: le province e l'IBAN nell'anagrafica, e la
-- tariffa oraria di ogni tecnico per ogni corso (`tariffe_istruttori`). Li
-- vede e li cambia solo la segreteria; se ne vanno col corso o con la persona.
-- Si lancia dopo finto-supabase.sql e tutto lo schema (77-tariffe-tecnici.sql
-- compreso).
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'ada@ods.it'),
  ('55555555-5555-5555-5555-555555555555', 'maura@ods.it'),
  ('33333333-3333-3333-3333-333333333333', 'luca@ods.it');
-- Anna: segreteria. Ada: solo amministrazione. Maura e Ivo: istruttori.
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Ada', 'Conti', 'amministrazione', 'ada@ods.it', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'Maura', 'Uno', 'istruttore', 'maura@ods.it', '55555555-5555-5555-5555-555555555555'),
  ('aaaaaaaa-0000-0000-0000-000000000006', 'Ivo', 'Tecnico', 'istruttore', null, null),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Luca', 'Rossi', 'iscritto', 'luca@ods.it', '33333333-3333-3333-3333-333333333333');
insert into sale (id, nome) values ('bbbbbbbb-0000-0000-0000-000000000001', 'Tatami');
insert into corsi (id, nome, sala_id, istruttore_id) values
  ('cccccccc-0000-0000-0000-000000000001', 'Judo', 'bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000006'),
  ('cccccccc-0000-0000-0000-000000000002', 'Karate', 'bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000006');

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
\echo '--- 1. la segreteria scrive province e IBAN nell''anagrafica ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('scrive province e IBAN di Ivo',
  tenta($$insert into anagrafiche (persona_id, nato_a, provincia_nascita, comune, provincia, iban)
    values ('aaaaaaaa-0000-0000-0000-000000000006', 'Torino', 'TO', 'Asti', 'AT', 'IT60X0542811101000000123456')$$), 'FATTO (1 righe)');
select atteso('e li rilegge', (select provincia_nascita || ' ' || provincia || ' ' || iban from anagrafiche), 'TO AT IT60X0542811101000000123456');
select atteso('una provincia di tre lettere no', tenta($$update anagrafiche set provincia = 'TOR'$$), 'NEGATO: …');
select atteso('una provincia in minuscolo no', tenta($$update anagrafiche set provincia = 'to'$$), 'NEGATO: …');
select atteso('una provincia di nascita di una lettera no', tenta($$update anagrafiche set provincia_nascita = 'T'$$), 'NEGATO: …');
select atteso('un IBAN con gli spazi no', tenta($$update anagrafiche set iban = 'IT60 X054 2811 1010 0000 0123 456'$$), 'NEGATO: …');
select atteso('un IBAN in minuscolo no', tenta($$update anagrafiche set iban = 'it60x0542811101000000123456'$$), 'NEGATO: …');
select atteso('un IBAN troppo corto no', tenta($$update anagrafiche set iban = 'IT60X0542'$$), 'NEGATO: …');
select atteso('un IBAN senza le cifre di controllo no', tenta($$update anagrafiche set iban = 'ITXXX0542811101000000123456'$$), 'NEGATO: …');
select atteso('e i dati giusti sono ancora quelli', (select provincia || ' ' || iban from anagrafiche), 'AT IT60X0542811101000000123456');
reset role;

\echo ''
\echo '--- 2. la segreteria scrive le tariffe ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('scrive la tariffa di Ivo per il Judo',
  tenta($$insert into tariffe_istruttori (persona_id, corso_id, centesimi_ora)
    values ('aaaaaaaa-0000-0000-0000-000000000006', 'cccccccc-0000-0000-0000-000000000001', 1500)$$), 'FATTO (1 righe)');
select atteso('e per il Karate',
  tenta($$insert into tariffe_istruttori (persona_id, corso_id, centesimi_ora)
    values ('aaaaaaaa-0000-0000-0000-000000000006', 'cccccccc-0000-0000-0000-000000000002', 1800)$$), 'FATTO (1 righe)');
select atteso('il server scrive chi è stato',
  (select p.nome from tariffe_istruttori t join persone p on p.id = t.cambiata_da where t.corso_id = 'cccccccc-0000-0000-0000-000000000001'), 'Anna');
select atteso('e quando', (select (cambiata_il is not null)::text from tariffe_istruttori where corso_id = 'cccccccc-0000-0000-0000-000000000001'), 'true');
select atteso('una seconda tariffa per lo stesso corso no',
  tenta($$insert into tariffe_istruttori (persona_id, corso_id, centesimi_ora)
    values ('aaaaaaaa-0000-0000-0000-000000000006', 'cccccccc-0000-0000-0000-000000000001', 2000)$$), 'NEGATO: …');
select atteso('la cambia', tenta($$update tariffe_istruttori set centesimi_ora = 1550 where corso_id = 'cccccccc-0000-0000-0000-000000000001'$$), 'FATTO (1 righe)');
select atteso('zero centesimi no', tenta($$update tariffe_istruttori set centesimi_ora = 0 where corso_id = 'cccccccc-0000-0000-0000-000000000001'$$), 'NEGATO: …');
select atteso('meno di zero no', tenta($$update tariffe_istruttori set centesimi_ora = -100 where corso_id = 'cccccccc-0000-0000-0000-000000000001'$$), 'NEGATO: …');
select atteso('mille euro l''ora sì', tenta($$update tariffe_istruttori set centesimi_ora = 100000 where corso_id = 'cccccccc-0000-0000-0000-000000000002'$$), 'FATTO (1 righe)');
select atteso('oltre mille euro l''ora no', tenta($$update tariffe_istruttori set centesimi_ora = 100001 where corso_id = 'cccccccc-0000-0000-0000-000000000002'$$), 'NEGATO: …');
select atteso('senza tariffa no',
  tenta($$insert into tariffe_istruttori (persona_id, corso_id) values ('aaaaaaaa-0000-0000-0000-000000000005', 'cccccccc-0000-0000-0000-000000000001')$$), 'NEGATO: …');
select atteso('le tariffe di Ivo', (select string_agg(centesimi_ora::text, ' ' order by centesimi_ora) from tariffe_istruttori), '1550 100000');
reset role;

\echo ''
\echo '--- 3. un istruttore: né le tariffe né l''IBAN ---'
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('l''istruttore non vede le tariffe', (select count(*)::text from tariffe_istruttori), '0');
select atteso('non se ne scrive una',
  tenta($$insert into tariffe_istruttori (persona_id, corso_id, centesimi_ora)
    values ('aaaaaaaa-0000-0000-0000-000000000005', 'cccccccc-0000-0000-0000-000000000001', 9900)$$), 'NEGATO: …');
select atteso('non le cambia', tenta($$update tariffe_istruttori set centesimi_ora = 9900$$), 'a vuoto (0 righe)');
select atteso('non le cancella', tenta($$delete from tariffe_istruttori$$), 'a vuoto (0 righe)');
select atteso('l''istruttore non legge l''IBAN', (select count(*)::text from anagrafiche where iban is not null), '0');
reset role;

\echo ''
\echo '--- 4. l''amministrazione senza segreteria: nemmeno ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('l''amministrazione non vede le tariffe', (select count(*)::text from tariffe_istruttori), '0');
select atteso('non se ne scrive una',
  tenta($$insert into tariffe_istruttori (persona_id, corso_id, centesimi_ora)
    values ('aaaaaaaa-0000-0000-0000-000000000005', 'cccccccc-0000-0000-0000-000000000001', 9900)$$), 'NEGATO: …');
select atteso('non le cambia', tenta($$update tariffe_istruttori set centesimi_ora = 9900$$), 'a vuoto (0 righe)');
select atteso('l''amministrazione non legge l''IBAN', (select count(*)::text from anagrafiche where iban is not null), '0');
reset role;

\echo ''
\echo '--- 4 bis. un iscritto con l''accesso: nemmeno ---'
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('l''iscritto non vede le tariffe', (select count(*)::text from tariffe_istruttori), '0');
select atteso('non se ne scrive una',
  tenta($$insert into tariffe_istruttori (persona_id, corso_id, centesimi_ora)
    values ('aaaaaaaa-0000-0000-0000-000000000006', 'cccccccc-0000-0000-0000-000000000001', 9900)$$), 'NEGATO: …');
select atteso('non le cambia', tenta($$update tariffe_istruttori set centesimi_ora = 9900$$), 'a vuoto (0 righe)');
select atteso('non legge l''IBAN', (select count(*)::text from anagrafiche where iban is not null), '0');
reset role;

\echo ''
\echo '--- 5. chi non ha fatto l''accesso ---'
select chi('');
set role anon;
select atteso('anon non legge le tariffe', tenta($$select count(*)::text from tariffe_istruttori$$), 'NEGATO: …');
select atteso('anon non legge l''anagrafica', tenta($$select count(*)::text from anagrafiche$$), 'NEGATO: …');
select atteso('anon non ne scrive',
  tenta($$insert into tariffe_istruttori (persona_id, corso_id, centesimi_ora)
    values ('aaaaaaaa-0000-0000-0000-000000000005', 'cccccccc-0000-0000-0000-000000000001', 9900)$$), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 6. il corso o la persona se ne vanno, e le tariffe con loro ---'
delete from corsi where id = 'cccccccc-0000-0000-0000-000000000002';
select atteso('via il Karate, resta solo la tariffa del Judo', (select string_agg(centesimi_ora::text, ' ') from tariffe_istruttori), '1550');
-- Ivo è titolare del Judo: prima il corso passa a un altro, poi Ivo se ne va.
update corsi set istruttore_id = 'aaaaaaaa-0000-0000-0000-000000000005' where id = 'cccccccc-0000-0000-0000-000000000001';
delete from persone where id = 'aaaaaaaa-0000-0000-0000-000000000006';
select atteso('via Ivo, non resta niente', (select count(*)::text from tariffe_istruttori), '0');
