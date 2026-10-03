-- Le segnalazioni della segreteria: le legge e le scrive solo lei, sempre a
-- nome di chi scrive; si risponde a un filo, non a una risposta; un
-- messaggio non si cambia, di un filo si cambia solo se è chiuso, e niente
-- si cancella.
-- Si lancia dopo finto-supabase.sql, i file dello schema e
-- 25-segnalazioni.sql.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'maura@ods.it'),
  ('33333333-3333-3333-3333-333333333333', 'luca@ods.it'),
  ('44444444-4444-4444-4444-444444444444', 'bea@ods.it'),
  ('66666666-6666-6666-6666-666666666666', 'lotta@sale.ods-corsi.it');
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Maura', 'Uno', 'istruttore', 'maura@ods.it', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Luca', 'Rossi', 'iscritto', 'luca@ods.it', '33333333-3333-3333-3333-333333333333'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'Bea', 'Banco', 'staff', 'bea@ods.it', '44444444-4444-4444-4444-444444444444');
insert into sale (id, nome) values ('bbbbbbbb-0000-0000-0000-000000000001', 'Lotta');
insert into postazioni (id, nome, sala_id, utente_id) values
  ('dddddddd-0000-0000-0000-000000000001', 'Tablet Lotta', 'bbbbbbbb-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666666');

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
\echo '--- 1. la segreteria apre un filo e risponde ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('apre un filo',
  tenta($$insert into segnalazioni (id, titolo, testo)
    values ('eeeeeeee-0000-0000-0000-000000000001', 'La stampa delle ricevute', 'Esce tagliata a destra')$$), 'FATTO (1 righe)');
select atteso('l''autore è lei',
  (select p.nome from segnalazioni s join persone p on p.id = s.autore_id where s.id = 'eeeeeeee-0000-0000-0000-000000000001'), 'Anna');
select atteso('a nome di un altro no',
  tenta($$insert into segnalazioni (titolo, testo, autore_id)
    values ('Altro', 'Scritto da Bea', 'aaaaaaaa-0000-0000-0000-000000000004')$$), 'NEGATO: …');
select atteso('un filo senza titolo no', tenta($$insert into segnalazioni (testo) values ('Senza titolo')$$), 'NEGATO: …');
select atteso('un testo vuoto no', tenta($$insert into segnalazioni (titolo, testo) values ('Vuoto', '   ')$$), 'NEGATO: …');
select atteso('risponde al filo',
  tenta($$insert into segnalazioni (id, padre_id, testo)
    values ('eeeeeeee-0000-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-000000000001', 'Anche col margine stretto')$$), 'FATTO (1 righe)');
select atteso('una risposta col titolo no',
  tenta($$insert into segnalazioni (padre_id, titolo, testo)
    values ('eeeeeeee-0000-0000-0000-000000000001', 'Titolo', 'Risposta')$$), 'NEGATO: …');
select atteso('una risposta già chiusa no',
  tenta($$insert into segnalazioni (padre_id, testo, chiusa_il)
    values ('eeeeeeee-0000-0000-0000-000000000001', 'Risposta', now())$$), 'NEGATO: …');
select atteso('a una risposta non si risponde',
  tenta($$insert into segnalazioni (padre_id, testo)
    values ('eeeeeeee-0000-0000-0000-000000000002', 'Risposta alla risposta')$$), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 2. un altro della segreteria la legge, risponde e la chiude ---'
select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('vede il filo e la risposta', (select count(*)::text from segnalazioni), '2');
select atteso('risponde',
  tenta($$insert into segnalazioni (padre_id, testo) values ('eeeeeeee-0000-0000-0000-000000000001', 'Sistemato')$$), 'FATTO (1 righe)');
select atteso('chiude il filo',
  tenta($$update segnalazioni set chiusa_il = now() where id = 'eeeeeeee-0000-0000-0000-000000000001'$$), 'FATTO (1 righe)');
select atteso('e lo riapre',
  tenta($$update segnalazioni set chiusa_il = null where id = 'eeeeeeee-0000-0000-0000-000000000001'$$), 'FATTO (1 righe)');
select atteso('una risposta non si chiude',
  tenta($$update segnalazioni set chiusa_il = now() where id = 'eeeeeeee-0000-0000-0000-000000000002'$$), 'a vuoto (0 righe)');
select atteso('il testo non si cambia', tenta($$update segnalazioni set testo = 'Riscritto'$$), 'NEGATO: …');
select atteso('il titolo non si cambia', tenta($$update segnalazioni set titolo = 'Altro titolo'$$), 'NEGATO: …');
select atteso('l''autore non si cambia',
  tenta($$update segnalazioni set autore_id = 'aaaaaaaa-0000-0000-0000-000000000004'$$), 'NEGATO: …');
select atteso('niente si cancella', tenta($$delete from segnalazioni$$), 'NEGATO: …');
select atteso('ed è tutto ancora lì', (select count(*)::text from segnalazioni where chiusa_il is null), '3');
reset role;

\echo ''
\echo '--- 3. istruttore, iscritto e tablet non vedono niente ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('l''istruttore non vede niente', (select count(*)::text from segnalazioni), '0');
select atteso('non apre un filo', tenta($$insert into segnalazioni (titolo, testo) values ('Io', 'Dall''istruttore')$$), 'NEGATO: …');
select atteso('non risponde',
  tenta($$insert into segnalazioni (padre_id, testo) values ('eeeeeeee-0000-0000-0000-000000000001', 'Dall''istruttore')$$), 'NEGATO: …');
select atteso('non chiude', tenta($$update segnalazioni set chiusa_il = now()$$), 'a vuoto (0 righe)');
reset role;
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('l''iscritto non vede niente', (select count(*)::text from segnalazioni), '0');
select atteso('e non scrive', tenta($$insert into segnalazioni (titolo, testo) values ('Io', 'Dall''iscritto')$$), 'NEGATO: …');
reset role;
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('il tablet non vede niente', (select count(*)::text from segnalazioni), '0');
select atteso('e non scrive', tenta($$insert into segnalazioni (titolo, testo) values ('Io', 'Dal tablet')$$), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 4. chi non ha fatto l''accesso ---'
select chi('');
set role anon;
select atteso('non legge', tenta($$select count(*)::text from segnalazioni$$), 'NEGATO: …');
select atteso('non scrive', tenta($$insert into segnalazioni (titolo, testo) values ('Io', 'Da fuori')$$), 'NEGATO: …');
reset role;
