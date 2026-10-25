-- Il genitore non iscritto sul database (113-genitore-non-iscritto.sql): un
-- minorenne il cui genitore non frequenta ha comunque un nucleo, col genitore
-- come titolare. `persone.genitore_non_iscritto` lo segna; la funzione
-- `aggiungi_genitore(figlio, nome, cognome, codice_fiscale)` lo crea (persona,
-- anagrafica col codice fiscale, nucleo) e solo la segreteria la chiama. Un
-- rifiuto non lascia una persona nuova. Il genitore che si iscrive a un corso
-- diventa un iscritto come gli altri. Due adulti in un nucleo vanno già.
-- La metà di prova: `propostaGenitore`, `fratelliDi`, `maggiorenneDal` e la
-- segreteria di prova, in scripts/prova-nucleo.mjs (sezioni 14-17): stessi
-- casi, stessi messaggi.
-- Si lancia dopo finto-supabase.sql e i file dello schema (il 113 compreso).
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'maura@ods.it'),
  ('33333333-3333-3333-3333-333333333333', 'luca@ods.it');
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Maura', 'Istruttrice', 'istruttore', 'maura@ods.it', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Luca', 'Iscritto', 'iscritto', 'luca@ods.it', '33333333-3333-3333-3333-333333333333');
insert into corsi (id, nome) values ('cccccccc-0000-0000-0000-000000000001', 'Karate');
insert into persone (id, nome, cognome, ruolo, attiva) values
  ('aaaaaaaa-0000-0000-0000-000000000010', 'Lia', 'Figli', 'iscritto', true),
  ('aaaaaaaa-0000-0000-0000-000000000011', 'Gigi', 'Figli', 'iscritto', true),
  ('aaaaaaaa-0000-0000-0000-000000000012', 'Spenta', 'Figli', 'iscritto', false),
  ('aaaaaaaa-0000-0000-0000-000000000013', 'Altra', 'Persona', 'iscritto', true),
  ('aaaaaaaa-0000-0000-0000-000000000014', 'Con', 'Nucleo', 'iscritto', true),
  ('aaaaaaaa-0000-0000-0000-000000000015', 'Tre', 'Figli', 'iscritto', true),
  ('aaaaaaaa-0000-0000-0000-000000000016', 'Anna', 'Sorelle', 'iscritto', true),
  ('aaaaaaaa-0000-0000-0000-000000000017', 'Bea', 'Sorelle', 'iscritto', true);
insert into anagrafiche (persona_id, nato_il, codice_fiscale) values
  ('aaaaaaaa-0000-0000-0000-000000000010', current_date - interval '12 years', null),
  ('aaaaaaaa-0000-0000-0000-000000000011', current_date - interval '9 years', null),
  ('aaaaaaaa-0000-0000-0000-000000000012', current_date - interval '10 years', null),
  ('aaaaaaaa-0000-0000-0000-000000000013', current_date - interval '40 years', 'BNCLRA80A41H501Z'),
  ('aaaaaaaa-0000-0000-0000-000000000014', current_date - interval '11 years', null),
  ('aaaaaaaa-0000-0000-0000-000000000015', current_date - interval '8 years', null),
  ('aaaaaaaa-0000-0000-0000-000000000016', current_date - interval '34 years', null),
  ('aaaaaaaa-0000-0000-0000-000000000017', current_date - interval '29 years', null);
-- Con Nucleo sta già nel nucleo di Altra.
update persone set nucleo = 'aaaaaaaa-0000-0000-0000-000000000013' where id = 'aaaaaaaa-0000-0000-0000-000000000014';

-- --- gli aiuti --------------------------------------------------------------
create or replace function chi(u text) returns void language plpgsql as $$
begin perform set_config('prova.utente', u, false); end $$;
-- Un rifiuto con un messaggio della funzione: se manca la funzione o la colonna, non vale.
create or replace function rifiuto(sql text) returns text language plpgsql as $$
begin
  execute sql;
  return 'nessun errore';
exception when others then
  if sqlstate in ('42883', '42501', '42P01', '42703', '42601') then return sqlstate || ': ' || sqlerrm; end if;
  return sqlerrm;
end $$;
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
create or replace function pid(n int) returns uuid language sql immutable as $$
  select ('aaaaaaaa-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;
-- Aggiunge un genitore come l'app: l'esito è «nessun errore» o il messaggio.
create or replace function aggiungi(figlio int, nome text, cognome text, cf text) returns text language sql as $$
  select rifiuto(format('select aggiungi_genitore(%L, %L, %L, %L)', pid(figlio), nome, cognome, cf))
$$;
create or replace function metti(p int, t int) returns text language sql as $$
  select rifiuto(format('select metti_nel_nucleo(%L, %L)', pid(p), pid(t)))
$$;
-- Le persone e i nuclei in una riga: un rifiuto non deve averli toccati.
create or replace function impronta() returns text language plpgsql security definer set search_path = public as $$
declare r text;
begin
  select count(*)::text || ' ' || coalesce(string_agg(right(id::text, 2) || '>' || coalesce(right(nucleo::text, 2), '-'), ' ' order by id), '')
    into r from persone;
  return r;
end $$;
-- Il genitore non iscritto per nome: i dati che interessano in una riga.
create or replace function genitore(nome text) returns text language plpgsql security definer set search_path = public as $$
declare r text;
begin
  select p.ruolo || ' ' || p.attiva || ' ' || p.genitore_non_iscritto || ' ' || coalesce(a.codice_fiscale, '-')
    into r from persone p left join anagrafiche a on a.persona_id = p.id where p.nome = genitore.nome and p.cognome = 'Genitore';
  return coalesce(r, 'non c''è');
end $$;
create or replace function segno_di(nome text) returns text language plpgsql security definer set search_path = public as $$
begin return coalesce((select genitore_non_iscritto::text from persone where persone.nome = segno_di.nome and cognome = 'Genitore'), 'non c''è'); end $$;
-- Il titolare di una persona, per numero; «-» se non ne ha.
create or replace function nucleo_di(n int) returns text language plpgsql security definer set search_path = public as $$
begin return coalesce((select right(nucleo::text, 2) from persone where id = pid(n)), '-'); end $$;
-- Il titolare di una persona è il genitore di nome `nome`?
create or replace function nucleo_e_genitore(n int, nome text) returns text language plpgsql security definer set search_path = public as $$
begin return (select (nucleo = (select id from persone where persone.nome = nucleo_e_genitore.nome and cognome = 'Genitore'))::text from persone where id = pid(n)); end $$;
grant execute on function chi(text), rifiuto(text), codice(text), atteso(text, text, text), pid(int), aggiungi(int, text, text, text), metti(int, int),
  impronta(), genitore(text), segno_di(text), nucleo_di(int), nucleo_e_genitore(int, text) to anon, authenticated;

\echo ''
\echo '--- 0. com''è fatto ---'
select atteso('persone ha la colonna genitore_non_iscritto, boolean, non nulla, falsa di partenza',
  (select data_type || ' ' || is_nullable || ' ' || column_default from information_schema.columns
    where table_schema = 'public' and table_name = 'persone' and column_name = 'genitore_non_iscritto'), 'boolean NO false');
select atteso('nessuno nasce genitore non iscritto', (select count(*)::text from persone where genitore_non_iscritto), '0');
select atteso('la funzione aggiungi_genitore c''è', (to_regprocedure('public.aggiungi_genitore(uuid,text,text,text)') is not null)::text, 'true');

\echo ''
\echo '--- 1. la segreteria aggiunge il genitore ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('Mario, genitore di Lia: aggiunto', aggiungi(10, 'Mario', 'Genitore', ' rssmra70a01 h501x '), 'nessun errore');
reset role;
select atteso('è un iscritto attivo, col segno e il codice fiscale pulito', genitore('Mario'), 'iscritto true true RSSMRA70A01H501X');
select atteso('Lia è nel suo nucleo', nucleo_e_genitore(10, 'Mario'), 'true');
select atteso('lui non ha un nucleo suo', (select coalesce(nucleo::text, '-') from persone where nome = 'Mario' and cognome = 'Genitore'), '-');
select atteso('le altre persone non hanno il segno', (select count(*)::text from persone where genitore_non_iscritto), '1');

\echo ''
\echo '--- 2. i rifiuti non lasciano una persona nuova ---'
-- Gigi ha un codice fiscale suo: non può essere quello del genitore.
update anagrafiche set codice_fiscale = 'GGIFGL17A01H501K' where persona_id = pid(11);
select impronta() as prima \gset
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('senza il nome: va scritto', aggiungi(11, '  ', 'Genitore', 'VRDPRI70A01H501Y'), 'Scrivi nome e cognome del genitore');
select atteso('senza il cognome: va scritto', aggiungi(11, 'Piero', null, 'VRDPRI70A01H501Y'), 'Scrivi nome e cognome del genitore');
select atteso('il codice del figlio stesso: già in elenco', aggiungi(11, 'Piero', 'Genitore', 'ggifgl17a01h501k'), 'C’è già una persona con questo codice fiscale: mettilo nel suo nucleo');
select atteso('un codice fiscale di quindici caratteri: serve il codice', aggiungi(11, 'Piero', 'Genitore', 'RSSMRA70A01H501'), 'Per aggiungere il genitore serve il suo codice fiscale');
select atteso('un codice con un segno: serve il codice', aggiungi(11, 'Piero', 'Genitore', 'RSSMRA70A01H50-X'), 'Per aggiungere il genitore serve il suo codice fiscale');
select atteso('un codice vuoto: serve il codice', aggiungi(11, 'Piero', 'Genitore', ''), 'Per aggiungere il genitore serve il suo codice fiscale');
select atteso('un codice mancante: serve il codice', aggiungi(11, 'Piero', 'Genitore', null), 'Per aggiungere il genitore serve il suo codice fiscale');
select atteso('il codice di un''altra persona, in minuscolo e con spazi: già in elenco', aggiungi(11, 'Piero', 'Genitore', 'bncl ra80a41h501z'), 'C’è già una persona con questo codice fiscale: mettilo nel suo nucleo');
select atteso('il codice del genitore di prima: già in elenco', aggiungi(11, 'Piero', 'Genitore', 'RSSMRA70A01H501X'), 'C’è già una persona con questo codice fiscale: mettilo nel suo nucleo');
select atteso('un figlio già in un nucleo: il messaggio di sempre', aggiungi(10, 'Piero', 'Genitore', 'VRDPRI70A01H501Y'), 'È già nel nucleo di un altro: prima toglilo da lì');
select atteso('un figlio di un altro nucleo: il messaggio di sempre', aggiungi(14, 'Piero', 'Genitore', 'VRDPRI70A01H501Y'), 'È già nel nucleo di un altro: prima toglilo da lì');
select atteso('un figlio disattivato: il messaggio di sempre', aggiungi(12, 'Piero', 'Genitore', 'VRDPRI70A01H501Y'), 'Le schede disattivate non entrano in un nucleo');
select atteso('una persona che non c''è', aggiungi(99, 'Piero', 'Genitore', 'VRDPRI70A01H501Y'), 'Persona inesistente');
reset role;
select atteso('niente persone nuove, nessun nucleo cambiato', impronta(), :'prima');
select atteso('Piero non c''è', segno_di('Piero'), 'non c''è');

\echo ''
\echo '--- 3. chi non è la segreteria non lo fa ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('un istruttore no', codice(format('select aggiungi_genitore(%L, ''Piero'', ''Genitore'', ''VRDPRI70A01H501Y'')', pid(11))), '42501');
reset role;
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('un iscritto con l''accesso no', codice(format('select aggiungi_genitore(%L, ''Piero'', ''Genitore'', ''VRDPRI70A01H501Y'')', pid(11))), '42501');
reset role;
select chi('');
set role anon;
select atteso('chi non ha fatto l''accesso no', codice(format('select aggiungi_genitore(%L, ''Piero'', ''Genitore'', ''VRDPRI70A01H501Y'')', pid(11))), '42501');
reset role;
select atteso('niente è cambiato', impronta(), :'prima');

\echo ''
\echo '--- 4. un secondo figlio, e il genitore che si iscrive ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('Gigi entra nel nucleo di Mario con la funzione di sempre', rifiuto(format('select metti_nel_nucleo(%L, (select id from persone where nome = ''Mario'' and cognome = ''Genitore''))', pid(11))), 'nessun errore');
reset role;
select atteso('Gigi è nel nucleo di Mario', nucleo_e_genitore(11, 'Mario'), 'true');
select atteso('Mario è ancora non iscritto', segno_di('Mario'), 'true');
insert into iscrizioni (corso_id, persona_id, dal)
  select 'cccccccc-0000-0000-0000-000000000001', id, current_date from persone where nome = 'Mario' and cognome = 'Genitore';
select atteso('iscritto a un corso: il segno si toglie', segno_di('Mario'), 'false');
select atteso('è ancora titolare: Lia e Gigi restano', nucleo_e_genitore(10, 'Mario') || ' ' || nucleo_e_genitore(11, 'Mario'), 'true true');
select atteso('chi non è un genitore non iscritto non cambia', (select count(*)::text from persone where genitore_non_iscritto), '0');

\echo ''
\echo '--- 4b. unito a una scheda iscritta: il segno si toglie anche lì ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('Ugo, genitore di Tre: aggiunto', aggiungi(15, 'Ugo', 'Genitore', 'GNRUGO70A01H501Q'), 'nessun errore');
reset role;
-- Un doppione di Ugo, già iscritto a Karate: l'unione gli porta l'iscrizione con un update.
insert into persone (id, nome, cognome, ruolo, attiva) values (pid(18), 'Ugo', 'Doppio', 'iscritto', true);
insert into iscrizioni (corso_id, persona_id, dal) values ('cccccccc-0000-0000-0000-000000000001', pid(18), current_date);
set role authenticated;
select atteso('la segreteria unisce il doppione a Ugo', rifiuto(format('select unisci_persone((select id from persone where nome = ''Ugo'' and cognome = ''Genitore''), %L)', pid(18))), 'nessun errore');
reset role;
select atteso('con l''iscrizione del doppione, il segno si toglie', segno_di('Ugo'), 'false');

\echo ''
\echo '--- 5. due adulte nello stesso nucleo ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('Bea (29) entra nel nucleo di Anna (34)', metti(17, 16), 'nessun errore');
reset role;
select atteso('il nucleo è di Anna', nucleo_di(17), '16');

\echo ''
\echo 'TUTTO A POSTO'
