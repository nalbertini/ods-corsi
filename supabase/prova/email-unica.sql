-- Una sola email per persona (99-email-unica.sql): `persone.email` serve per
-- entrare nell'app, per le ricevute e per gli avvisi. Qui: l'unicità vale solo
-- per chi ha un accesso (istruttore, segreteria, amministrazione), gli iscritti
-- possono dividerla; `collega_utente()` lega per email solo il personale; e i
-- dati dell'email di contatto passano nel campo unico (l'email di accesso di un
-- iscritto con due indirizzi diversi non si conserva, salvo che con quella abbia un
-- account: la segreteria vede gli altri nell'elenco in testa al file) e rilanciando il file non cambia più niente.
-- Si lancia dopo finto-supabase.sql e i file dello schema.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'maura@ods.it'),
  ('77777777-7777-7777-7777-777777777777', 'mamma@esempio.it');
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', 'anna@ods.it', '11111111-1111-1111-1111-111111111111');
insert into persone (id, nome, cognome, ruolo, email) values
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Maura', 'Uno', 'istruttore', 'maura@ods.it'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Giulia', 'Ferrero', 'istruttore', 'giulia@ods.it');
-- La famiglia Bianchi: la mamma e i due figli hanno la stessa email.
insert into persone (id, nome, cognome, ruolo, email) values
  ('aaaaaaaa-0000-0000-0000-000000000010', 'Paola', 'Bianchi', 'iscritto', 'mamma@esempio.it'),
  ('aaaaaaaa-0000-0000-0000-000000000011', 'Luca', 'Bianchi', 'iscritto', 'MAMMA@esempio.it'),
  ('aaaaaaaa-0000-0000-0000-000000000012', 'Sara', 'Bianchi', 'iscritto', 'mamma@esempio.it');

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
\echo '--- 1. chi ha un accesso ha un''email sua ---'
select atteso('un''altra persona con accesso con la stessa email no',
  codice($$insert into persone (nome, cognome, ruolo, email) values ('Marco', 'Rossi', 'istruttore', 'Maura@ods.it')$$), '23505');
select atteso('né cambiando l''email a chi c''è',
  codice($$update persone set email = 'maura@ods.it' where id = 'aaaaaaaa-0000-0000-0000-000000000003'$$), '23505');
select atteso('né se è la segreteria', codice($$insert into persone (nome, cognome, ruolo, email) values ('Marco', 'Rossi', 'staff', 'GIULIA@ods.it')$$), '23505');
select atteso('Maura è ancora l''unica con quell''email e un accesso', (select string_agg(nome, ',') from persone where email = 'maura@ods.it' and ruolo <> 'iscritto'), 'Maura');

\echo ''
\echo '--- 2. gli iscritti possono dividere l''email ---'
select atteso('Paola, Luca e Sara, anche con altre maiuscole', (select string_agg(nome, ',' order by nome) from persone where email = 'mamma@esempio.it'), 'Luca,Paola,Sara');
select atteso('un altro figlio con la stessa email entra',
  codice($$insert into persone (nome, cognome, ruolo, email) values ('Teo', 'Bianchi', 'iscritto', 'mamma@esempio.it')$$), 'nessun errore');
select atteso('un iscritto con l''email di un''istruttrice entra: non gli dà nessun accesso',
  codice($$insert into persone (nome, cognome, ruolo, email) values ('Zeno', 'Gialli', 'iscritto', 'maura@ods.it')$$), 'nessun errore');
select atteso('e l''email può mancare', codice($$insert into persone (nome, cognome, ruolo) values ('Pia', 'Neri', 'iscritto')$$), 'nessun errore');
select atteso('ma chi ha già l''email di un''istruttrice non diventa una seconda istruttrice con la stessa',
  codice($$update persone set ruolo = 'istruttore' where nome = 'Zeno'$$), '23505');
select atteso('un iscritto con un''altra email diventa istruttore',
  codice($$update persone set ruolo = 'istruttore' where id = 'aaaaaaaa-0000-0000-0000-000000000012'$$), 'nessun errore');
update persone set ruolo = 'iscritto' where id = 'aaaaaaaa-0000-0000-0000-000000000012';
delete from persone where nome in ('Teo', 'Zeno', 'Pia');

\echo ''
\echo '--- 3. il primo accesso lega per email, e solo il personale ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('Maura si lega alla sua scheda, non a quella di chi ha il suo indirizzo e basta',
  (select collega_utente()::text), 'aaaaaaaa-0000-0000-0000-000000000002');
reset role;
-- La mamma e i due figli hanno l'indirizzo in comune: un account con quell'email
-- non diventa nessuno di loro, sono iscritti.
select chi('77777777-7777-7777-7777-777777777777');
set role authenticated;
select atteso('un account con l''email di una famiglia non trova nessuna scheda', coalesce((select collega_utente()::text), 'niente'), 'niente');
reset role;
select atteso('e nessuno di loro ha preso il suo account', (select count(*)::text from persone where utente_id = '77777777-7777-7777-7777-777777777777'), '0');

\echo ''
\echo '--- 4. i dati dell''email di contatto passano nel campo unico (e rilanciando il file non cambia più niente) ---'
-- Com'erano prima del file: un indirizzo per entrare e uno per scrivere.
insert into persone (id, nome, cognome, ruolo, email, email_contatto) values
  ('aaaaaaaa-0000-0000-0000-000000000020', 'Ada', 'Uno', 'iscritto', 'accesso@esempio.it', 'famiglia@esempio.it'),
  ('aaaaaaaa-0000-0000-0000-000000000021', 'Bea', 'Due', 'iscritto', null, 'solo.contatto@esempio.it'),
  ('aaaaaaaa-0000-0000-0000-000000000022', 'Cleo', 'Tre', 'istruttore', 'cleo@ods.it', 'cleo.casa@esempio.it'),
  ('aaaaaaaa-0000-0000-0000-000000000023', 'Dino', 'Quattro', 'istruttore', null, 'dino.casa@esempio.it'),
  ('aaaaaaaa-0000-0000-0000-000000000024', 'Eva', 'Cinque', 'istruttore', null, 'maura@ods.it'),
  ('aaaaaaaa-0000-0000-0000-000000000025', 'Fio', 'Sei', 'iscritto', 'fio@esempio.it', 'fio@esempio.it'),
  -- Due fratelli con lo stesso contatto: il vecchio indice unico farebbe fallire il file.
  ('aaaaaaaa-0000-0000-0000-000000000026', 'Gil', 'Sette', 'iscritto', 'gil@esempio.it', 'fratelli@esempio.it'),
  ('aaaaaaaa-0000-0000-0000-000000000027', 'Ida', 'Sette', 'iscritto', 'ida@esempio.it', 'fratelli@esempio.it'),
  -- Un iscritto con l'account: quell'email è la sua porta nell'app.
  ('aaaaaaaa-0000-0000-0000-000000000028', 'Hugo', 'Otto', 'iscritto', 'hugo@esempio.it', 'casa.hugo@esempio.it');
insert into auth.users (id, email) values ('88888888-8888-8888-8888-888888888888', 'hugo@esempio.it');
\i supabase/99-email-unica.sql
select atteso('un iscritto con due email diverse tiene quella dove si scrive alla famiglia',
  (select email::text from persone where nome = 'Ada'), 'famiglia@esempio.it');
select atteso('l''email di accesso di chi non ha un account non si conserva (è nell''elenco di controllo)', (select count(*)::text from persone where 'accesso@esempio.it' in (email::text, email_contatto::text)), '0');
select atteso('un iscritto con un account tiene l''email con cui entra', (select email::text from persone where nome = 'Hugo'), 'hugo@esempio.it');
select atteso('e il contatto resta dov''era, per la segreteria', (select email_contatto::text from persone where nome = 'Hugo'), 'casa.hugo@esempio.it');
select atteso('due fratelli con lo stesso contatto lo hanno entrambi', (select count(*)::text from persone where nome in ('Gil', 'Ida') and email = 'fratelli@esempio.it'), '2');
select atteso('il contatto passato non resta nella colonna di prima (solo quello di chi tiene l''accesso)', (select string_agg(nome, ',') from persone where ruolo = 'iscritto' and email_contatto is not null), 'Hugo');
select atteso('un iscritto con solo il contatto lo ha ora come email', (select email::text from persone where nome = 'Bea'), 'solo.contatto@esempio.it');
select atteso('chi ha un accesso lo tiene, anche se aveva un contatto', (select email::text from persone where nome = 'Cleo'), 'cleo@ods.it');
select atteso('chi ha un accesso e solo il contatto, se è libero, lo prende', (select email::text from persone where nome = 'Dino'), 'dino.casa@esempio.it');
select atteso('ma non se è già l''email di un''altra persona con accesso', coalesce((select email::text from persone where nome = 'Eva'), 'senza email'), 'senza email');
select atteso('due email uguali restano una', (select email::text from persone where nome = 'Fio'), 'fio@esempio.it');
-- Dopo la pubblicazione la segreteria cambia l'email di Ada: il rilancio non rimette quella vecchia.
update persone set email = 'nuova@esempio.it' where nome = 'Ada';
create temp table prima as select id, email from persone;
\i supabase/99-email-unica.sql
select atteso('rilanciato il file, nessuna email cambia',
  (select count(*)::text from persone p join prima q using (id) where p.email is distinct from q.email), '0');
select atteso('l''email deve avere la forma di un indirizzo', codice($$insert into persone (nome, cognome, ruolo, email) values ('Zed', 'Rossi', 'iscritto', 'non-una-email')$$), '23514');
select atteso('e l''unicità c''è ancora', codice($$insert into persone (nome, cognome, ruolo, email) values ('Max', 'Rossi', 'staff', 'cleo@ods.it')$$), '23505');

\echo ''
\echo 'TUTTO A POSTO'
