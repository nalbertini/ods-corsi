-- Gli accessi più stretti (57-accessi-piu-stretti.sql): il calendario e le
-- impostazioni le legge solo chi lavora in palestra o è un tablet; chi non è
-- personale non allunga il calendario; le cinque funzioni «da segreteria o da
-- job» non si aprono a chi non ha un accesso (uid nullo) se non è il sistema.
-- Si lancia dopo tablet.sql (persone, sale, postazioni e lezioni).
--
-- PostgREST entra come `authenticator` e poi fa `set role`: lo rifacciamo, così
-- `session_user` non è quello di sistema nemmeno per `anon`. Con un semplice
-- `set role` da superuser sarebbe `postgres`, e la prova non direbbe niente.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('77777777-7777-7777-7777-777777777777', 'ada@ods.it'),
  ('88888888-8888-8888-8888-888888888888', 'luca@ods.it'),
  ('99999999-9999-9999-9999-999999999999', 'senza@ods.it');
insert into persone (id, nome, cognome, ruolo, anche_istruttore, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000008', 'Ada', 'Conti', 'amministrazione', false, '77777777-7777-7777-7777-777777777777'),
  ('aaaaaaaa-0000-0000-0000-000000000009', 'Luca', 'Rossi', 'iscritto', false, '88888888-8888-8888-8888-888888888888');
-- 999… ha un account e nessuna riga in persone.

do $$ begin create role authenticator noinherit nologin; exception when duplicate_object then null; end $$;
grant anon, authenticated, service_role to authenticator;
grant usage on schema public to authenticator;

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
-- Per le funzioni conta solo se la porta è chiusa o no. Chiusa: 42501, o il «solo la
-- segreteria…» di materializza_sessioni e pulisci_presenze, che da 03 rispondono senza codice.
create or replace function porta(sql text) returns text language plpgsql as $$
begin execute sql; return 'aperta';
exception when others then return case when sqlstate = '42501' or sqlerrm like 'solo la segreteria%' then '42501' else 'aperta (' || sqlerrm || ')' end;
end $$;
create or replace function atteso(cosa text, avuto text, voluto text) returns text language plpgsql as $$
begin
  if avuto is distinct from voluto and not (voluto like '%…' and avuto like replace(voluto, '…', '%')) then
    raise exception '% · atteso «%», avuto «%»', cosa, voluto, avuto;
  end if;
  return 'ok  ' || cosa || ' → ' || avuto;
end $$;
-- Le cinque funzioni del criterio C, una chiamata ciascuna.
create table chiamate (nome text primary key, sql text not null);
insert into chiamate values
  ('materializza_sessioni', $$select materializza_sessioni(current_date, current_date + 1)$$),
  ('pulisci_presenze', $$select pulisci_presenze()$$),
  ('imposta_pin', $$select imposta_pin('aaaaaaaa-0000-0000-0000-000000000006', '1357')$$),
  ('chiudi_ricorrenza', $$select chiudi_ricorrenza('00000000-0000-0000-0000-0000000000ff')$$),
  ('salva_date_corsi', $$select salva_date_corsi(current_date, current_date + 30, true)$$);
-- Come su Supabase, service_role può eseguire tutto: a fermarlo dev'essere la funzione.
grant execute on all functions in schema public to service_role;
grant select on chiamate to anon, authenticated, service_role;
grant execute on function tenta(text), porta(text), atteso(text, text, text), chi(text) to anon, authenticated, service_role;

\echo ''
\echo '--- 1. sessioni e impostazioni: le legge il personale e il tablet ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria vede le sessioni', (select (count(*) > 0)::text from sessioni), 'true');
select atteso('la segreteria vede le impostazioni', (select count(*)::text from impostazioni), '1');
reset role;
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('l''istruttore vede le sessioni', (select (count(*) > 0)::text from sessioni), 'true');
select atteso('l''istruttore vede le impostazioni', (select count(*)::text from impostazioni), '1');
reset role;
select chi('77777777-7777-7777-7777-777777777777');
set role authenticated;
select atteso('l''amministrazione vede le sessioni', (select (count(*) > 0)::text from sessioni), 'true');
select atteso('l''amministrazione vede le impostazioni', (select count(*)::text from impostazioni), '1');
reset role;
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('il tablet vede le sessioni', (select (count(*) > 0)::text from sessioni), 'true');
select atteso('il tablet vede le impostazioni', (select count(*)::text from impostazioni), '1');
reset role;

\echo ''
\echo '--- 2. sessioni e impostazioni: l''iscritto e chi non è in persone no ---'
select chi('88888888-8888-8888-8888-888888888888');
set role authenticated;
select atteso('l''iscritto non vede le sessioni', (select count(*)::text from sessioni), '0');
select atteso('l''iscritto non vede le impostazioni', (select count(*)::text from impostazioni), '0');
reset role;
select chi('99999999-9999-9999-9999-999999999999');
set role authenticated;
select atteso('senza riga in persone, niente sessioni', (select count(*)::text from sessioni), '0');
select atteso('senza riga in persone, niente impostazioni', (select count(*)::text from impostazioni), '0');
reset role;
select chi('');
set role anon;
select atteso('anon non legge le sessioni', tenta($$select count(*)::text from sessioni$$), 'NEGATO: …');
select atteso('anon non legge le impostazioni', tenta($$select count(*)::text from impostazioni$$), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 3. la scrittura non cambia ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria cambia le impostazioni', tenta($$update impostazioni set giorni_calendario = 61$$), 'FATTO (1 righe)');
reset role;
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('l''istruttore non cambia le impostazioni', tenta($$update impostazioni set giorni_calendario = 62$$), 'a vuoto (0 righe)');
reset role;
select chi('77777777-7777-7777-7777-777777777777');
set role authenticated;
select atteso('l''amministrazione non cambia i giorni del calendario', tenta($$update impostazioni set giorni_calendario = 63$$), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 4. allunga_calendario: solo personale e tablet ---'
select chi('88888888-8888-8888-8888-888888888888');
set role authenticated;
select atteso('l''iscritto non allunga il calendario', porta($$select allunga_calendario()$$), '42501');
reset role;
select chi('99999999-9999-9999-9999-999999999999');
set role authenticated;
select atteso('senza riga in persone non allunga', porta($$select allunga_calendario()$$), '42501');
reset role;
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('l''istruttore allunga', porta($$select allunga_calendario()$$), 'aperta');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria allunga', porta($$select allunga_calendario()$$), 'aperta');
reset role;
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('il tablet allunga', porta($$select allunga_calendario()$$), 'aperta');
reset role;
select chi('');
-- Il sistema non la chiama (un job chiama materializza_sessioni): senza accesso resta negata.
select atteso('senza accesso (postgres) non allunga', porta($$select allunga_calendario()$$), '42501');
set session authorization authenticator;
set role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', false);
select atteso('senza accesso (claim service_role) non allunga', porta($$select allunga_calendario()$$), '42501');
reset role;
reset session authorization;
select set_config('request.jwt.claims', '', false);

\echo ''
\echo '--- 5. le cinque funzioni: chi ha un accesso ma non è segreteria resta fuori ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('l''istruttore: ' || nome, porta(sql), '42501') from chiamate order by nome;
reset role;
select chi('88888888-8888-8888-8888-888888888888');
set role authenticated;
select atteso('l''iscritto: ' || nome, porta(sql), '42501') from chiamate order by nome;
reset role;
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('il tablet: ' || nome, porta(sql), '42501') from chiamate order by nome;
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria: ' || nome, porta(sql), 'aperta…') from chiamate order by nome;
reset role;

\echo ''
\echo '--- 6. il sistema passa, anon con l''uid nullo no (anche se gli si dà il grant) ---'
select chi('');
select atteso('il sistema (postgres): ' || nome, porta(sql), 'aperta…') from chiamate order by nome;
set session authorization authenticator;
set role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', false);
select atteso('il sistema (claim service_role): ' || nome, porta(sql), 'aperta…') from chiamate order by nome;
select set_config('request.jwt.claims', '', false);
reset role;
reset session authorization;

-- Il grant ad anon lo dà solo la prova, per vedere se la funzione regge da
-- sola; alla fine si rimette il revoke.
grant execute on function materializza_sessioni(date, date), pulisci_presenze(), imposta_pin(uuid, text),
  chiudi_ricorrenza(uuid), salva_date_corsi(date, date, boolean) to anon;
select chi('');
set session authorization authenticator;
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select atteso('anon (uid nullo): ' || nome, porta(sql), '42501') from chiamate order by nome;
select set_config('request.jwt.claims', '', false);
reset role;
reset session authorization;
-- Senza claim, come un job qualunque con un ruolo non di sistema.
set session authorization authenticator;
set role anon;
select atteso('anon senza claim: ' || nome, porta(sql), '42501') from chiamate order by nome;
reset role;
reset session authorization;
revoke execute on function materializza_sessioni(date, date), pulisci_presenze(), imposta_pin(uuid, text),
  chiudi_ricorrenza(uuid), salva_date_corsi(date, date, boolean) from anon;
select atteso('rimesso il revoke ad anon', porta('set role anon; select pulisci_presenze()'), '42501');
reset role;
