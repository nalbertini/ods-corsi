-- L'email di contatto (44-email-contatto.sql): `persone.email` resta l'email di
-- ACCESSO, una per persona; `persone.email_contatto` è dove scrivere a chi è
-- iscritto, facoltativa e uguale per i parenti. Qui: l'email resta unica e il
-- contatto no, il contatto ha la stessa forma dell'email (e al massimo 160
-- lettere), e `collega_utente()` lega solo per `email`, mai per contatto.
-- Chi lo legge (il personale, istruttori compresi, come le email; il tablet e un iscritto no) sta in rls.sql.
-- Si lancia dopo finto-supabase.sql e i file dello schema.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'maura@ods.it'),
  ('55555555-5555-5555-5555-555555555555', 'giulia.casa@esempio.it'),
  ('77777777-7777-7777-7777-777777777777', 'solo.contatto@esempio.it');
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', 'anna@ods.it', '11111111-1111-1111-1111-111111111111');
-- Maura è istruttrice con l'email maura@ods.it; Giulia pure, ma non ha ancora
-- fatto l'accesso, e il suo contatto è un altro indirizzo.
insert into persone (id, nome, cognome, ruolo, email, email_contatto) values
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Maura', 'Uno', 'istruttore', 'maura@ods.it', null),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Giulia', 'Ferrero', 'istruttore', 'giulia@ods.it', 'giulia.casa@esempio.it');
-- La famiglia Bianchi: la mamma ha l'email, i figli la usano come contatto.
insert into persone (id, nome, cognome, ruolo, email, email_contatto) values
  ('aaaaaaaa-0000-0000-0000-000000000010', 'Paola', 'Bianchi', 'iscritto', 'mamma@esempio.it', null),
  ('aaaaaaaa-0000-0000-0000-000000000011', 'Luca', 'Bianchi', 'iscritto', null, 'mamma@esempio.it'),
  ('aaaaaaaa-0000-0000-0000-000000000012', 'Sara', 'Bianchi', 'iscritto', null, 'MAMMA@esempio.it');
-- Un iscritto col contatto uguale all'email di Maura, e uno col contatto di un
-- account che non è l'email di nessuno.
insert into persone (id, nome, cognome, ruolo, email_contatto) values
  ('aaaaaaaa-0000-0000-0000-000000000013', 'Luca', 'Rossi', 'iscritto', 'maura@ods.it'),
  ('aaaaaaaa-0000-0000-0000-000000000014', 'Teo', 'Verdi', 'iscritto', 'solo.contatto@esempio.it');

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
-- Il codice dell'errore: 23505 è «già c'è», 23514 «non ha la forma giusta».
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
grant execute on function tenta(text), codice(text), atteso(text, text, text), chi(text) to anon, authenticated;

\echo ''
\echo '--- 1. l''email di accesso resta di una persona sola ---'
select atteso('un''altra persona con la stessa email no',
  codice($$insert into persone (nome, cognome, ruolo, email) values ('Marco', 'Bianchi', 'iscritto', 'Mamma@esempio.it')$$), '23505');
select atteso('né cambiando l''email a chi c''è',
  codice($$update persone set email = 'mamma@esempio.it' where id = 'aaaaaaaa-0000-0000-0000-000000000011'$$), '23505');
select atteso('Paola è ancora l''unica con quell''email', (select string_agg(nome, ',') from persone where email = 'mamma@esempio.it'), 'Paola');

\echo ''
\echo '--- 2. il contatto no: più persone, anche quello di un''email ---'
select atteso('Paola con l''email e i due figli col contatto uguale',
  (select string_agg(nome, ',' order by nome) from persone where email = 'mamma@esempio.it' or email_contatto = 'mamma@esempio.it'), 'Luca,Paola,Sara');
select atteso('un terzo figlio col contatto uguale entra',
  codice($$insert into persone (nome, cognome, ruolo, email_contatto) values ('Teo', 'Bianchi', 'iscritto', 'mamma@esempio.it')$$), 'nessun errore');
select atteso('il contatto si cambia in uno uguale a un altro',
  codice($$update persone set email_contatto = 'mamma@esempio.it' where id = 'aaaaaaaa-0000-0000-0000-000000000014'$$), 'nessun errore');
update persone set email_contatto = 'solo.contatto@esempio.it' where id = 'aaaaaaaa-0000-0000-0000-000000000014';
select atteso('e il contatto può mancare', (select count(*)::text from persone where email_contatto is null and ruolo = 'iscritto'), '1');
select atteso('l''email del contatto non guarda le maiuscole (citext)',
  (select count(*)::text from persone where email_contatto = 'mamma@ESEMPIO.it'), '3');

\echo ''
\echo '--- 3. la forma è quella dell''email, al massimo 160 lettere ---'
select atteso('senza chiocciola no', codice($$update persone set email_contatto = 'mamma.esempio.it' where id = 'aaaaaaaa-0000-0000-0000-000000000011'$$), '23514');
select atteso('senza punto dopo la chiocciola no', codice($$update persone set email_contatto = 'mamma@esempio' where id = 'aaaaaaaa-0000-0000-0000-000000000011'$$), '23514');
select atteso('con uno spazio no', codice($$update persone set email_contatto = 'la mamma@esempio.it' where id = 'aaaaaaaa-0000-0000-0000-000000000011'$$), '23514');
select atteso('vuota no (si toglie con null)', codice($$update persone set email_contatto = '' where id = 'aaaaaaaa-0000-0000-0000-000000000011'$$), '23514');
select atteso('centosessanta lettere sì', codice(format($$update persone set email_contatto = %L where id = 'aaaaaaaa-0000-0000-0000-000000000011'$$, repeat('a', 149) || '@esempio.it')), 'nessun errore');
select atteso('centosessantuno no', codice(format($$update persone set email_contatto = %L where id = 'aaaaaaaa-0000-0000-0000-000000000011'$$, repeat('a', 150) || '@esempio.it')), '23514');
update persone set email_contatto = 'mamma@esempio.it' where id = 'aaaaaaaa-0000-0000-0000-000000000011';

\echo ''
\echo '--- 4. il primo accesso lega per email, mai per contatto ---'
-- Maura ha l'email maura@ods.it, e un iscritto ha lo stesso indirizzo come
-- contatto: l'account di Maura si lega a lei.
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('Maura si lega alla sua scheda, non a quella di chi ha il suo indirizzo come contatto',
  (select collega_utente()::text), 'aaaaaaaa-0000-0000-0000-000000000002');
reset role;
-- L'account con l'indirizzo di contatto di Giulia (istruttrice, ma la sua
-- email di accesso è un'altra) non diventa Giulia.
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('un account col contatto di un''istruttrice non si lega a lei', coalesce((select collega_utente()::text), 'niente'), 'niente');
reset role;
-- E uno che è il contatto di un iscritto, e l'email di nessuno, non trova niente.
select chi('77777777-7777-7777-7777-777777777777');
set role authenticated;
select atteso('un account col contatto di un iscritto non trova nessuna scheda', coalesce((select collega_utente()::text), 'niente'), 'niente');
reset role;
select atteso('e nessuna scheda ha preso il suo account', (select count(*)::text from persone where utente_id = '77777777-7777-7777-7777-777777777777'), '0');
select atteso('né quella di Giulia', (select count(*)::text from persone where id = 'aaaaaaaa-0000-0000-0000-000000000003' and utente_id is not null), '0');

\echo ''
\echo 'TUTTO A POSTO'
