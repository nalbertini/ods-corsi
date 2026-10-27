-- La quadratura del Conto Corrente col saldo dell'estratto BancoPosta: la tabella `saldo_banca` (il saldo
-- scritto a mano, un mese per riga) la leggono e la scrivono solo chi ha il ruolo di amministrazione (anche
-- doppio), come i movimenti di 59-contabilita.sql, e il
-- database tiene da sé i conti dell'estratto. Si lancia dopo finto-supabase.sql, i file dello schema e
-- supabase/123-quadratura-banca.sql. Le regole dell'app (differenza, righe spaiate, stati, impronta) sono
-- provate da scripts/prova-quadratura.mjs, che ha gli stessi rifiuti con gli stessi messaggi.
--
-- Lo schema che questa prova si aspetta (lo fissa lei: il file SQL lo segue):
--
--   saldo_banca   mese text primary key check (mese ~ '^\d{4}-(0[1-9]|1[0-2])$')          -- AAAA-MM
--                 · saldo_iniziale, entrate, uscite, saldo_finale  integer not null (centesimi, integer come gli importi; il saldo
--                   può essere negativo, entrate e uscite no: check >= 0)
--                 · check saldo_iniziale + entrate - uscite = saldo_finale
--                 · verificato_il timestamptz null · verificato_da uuid null → persone on delete set null
--                 · impronta_verifica text null · check (verificato_il is null) = (impronta_verifica is null)
--                 RLS: legge e scrive (insert, update, delete) solo e_amministrazione(), come movimenti e casse;
--                 nessun grant ad anon.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

create or replace function atteso(cosa text, avuto text, voluto text) returns text language plpgsql as $$
begin
  if avuto is distinct from voluto and not (voluto like '%…' and avuto like replace(voluto, '…', '%')) then
    raise exception '% · atteso «%», avuto «%»', cosa, voluto, avuto;
  end if;
  return 'ok  ' || cosa || ' → ' || avuto;
end $$;
select atteso('123-quadratura-banca.sql è stato lanciato: c''è la tabella saldo_banca', (to_regclass('public.saldo_banca') is not null)::text, 'true');

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'ada@ods.it'),
  ('33333333-3333-3333-3333-333333333333', 'sandro@ods.it'),
  ('44444444-4444-4444-4444-444444444444', 'ivo@ods.it'),
  ('55555555-5555-5555-5555-555555555555', 'maura@ods.it'),
  ('77777777-7777-7777-7777-777777777777', 'luca@ods.it');
-- Anna: solo segreteria. Ada: solo amministrazione. Sandro: segreteria e amministrazione.
-- Ivo: amministrazione e istruttore. Maura: istruttore. Luca: iscritto.
insert into persone (id, nome, cognome, ruolo, anche_istruttore, anche_amministrazione, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', false, false, 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Ada', 'Conti', 'amministrazione', false, false, 'ada@ods.it', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Sandro', 'Doppio', 'staff', false, true, 'sandro@ods.it', '33333333-3333-3333-3333-333333333333'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'Ivo', 'Conti', 'amministrazione', true, false, 'ivo@ods.it', '44444444-4444-4444-4444-444444444444'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'Maura', 'Uno', 'istruttore', false, false, 'maura@ods.it', '55555555-5555-5555-5555-555555555555'),
  ('aaaaaaaa-0000-0000-0000-000000000007', 'Luca', 'Rossi', 'iscritto', false, false, 'luca@ods.it', '77777777-7777-7777-7777-777777777777');
-- Un mese già scritto, per chi deve solo leggerlo o non poterlo cambiare.
insert into saldo_banca (mese, saldo_iniziale, entrate, uscite, saldo_finale) values ('2026-09', 10000, 5000, 2000, 13000);

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
grant execute on function tenta(text), atteso(text, text, text), chi(text) to anon, authenticated;

\echo ''
\echo '--- 1. l''amministrazione e i ruoli doppi: leggono e scrivono ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('l''amministrazione legge i saldi', (select count(*)::text from saldo_banca), '1');
select atteso('scrive il saldo di ottobre', tenta($$insert into saldo_banca (mese, saldo_iniziale, entrate, uscite, saldo_finale) values ('2026-10', 13000, 5000, 2000, 16000)$$), 'FATTO (1 righe)');
select atteso('lo corregge', tenta($$update saldo_banca set entrate = 6000, saldo_finale = 17000 where mese = '2026-10'$$), 'FATTO (1 righe)');
select atteso('lo segna verificato, con la sua impronta', tenta($$update saldo_banca set verificato_il = now(), verificato_da = 'aaaaaaaa-0000-0000-0000-000000000002', impronta_verifica = 'abc123' where mese = '2026-10'$$), 'FATTO (1 righe)');
select atteso('chi ha verificato lo scrive il database: dire «Anna» non basta', tenta($$update saldo_banca set verificato_il = now(), verificato_da = 'aaaaaaaa-0000-0000-0000-000000000001', impronta_verifica = 'def456' where mese = '2026-10'$$), 'FATTO (1 righe)');
select atteso('…resta Ada', (select verificato_da::text from saldo_banca where mese = '2026-10'), 'aaaaaaaa-0000-0000-0000-000000000002');
select atteso('lo toglie', tenta($$delete from saldo_banca where mese = '2026-10'$$), 'FATTO (1 righe)');
select atteso('e scrive agosto', tenta($$insert into saldo_banca (mese, saldo_iniziale, entrate, uscite, saldo_finale) values ('2026-08', 0, 10000, 0, 10000)$$), 'FATTO (1 righe)');
reset role;
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('segreteria e amministrazione insieme: legge', (select count(*)::text from saldo_banca), '2');
select atteso('e scrive', tenta($$update saldo_banca set uscite = 2000, saldo_finale = 8000 where mese = '2026-08'$$), 'FATTO (1 righe)');
reset role;
select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('amministrazione e istruttore: legge', (select count(*)::text from saldo_banca), '2');
select atteso('e scrive', tenta($$insert into saldo_banca (mese, saldo_iniziale, entrate, uscite, saldo_finale) values ('2026-07', 0, 0, 0, 0)$$), 'FATTO (1 righe)');
reset role;

\echo ''
\echo '--- 2. la segreteria senza amministrazione, un istruttore, un iscritto e chi non ha fatto l''accesso: niente ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria non vede i saldi: la contabilità è dell''amministrazione', (select count(*)::text from saldo_banca), '0');
select atteso('non ne scrive', tenta($$insert into saldo_banca (mese, saldo_iniziale, entrate, uscite, saldo_finale) values ('2026-06', 0, 0, 0, 0)$$), 'NEGATO: …');
select atteso('non ne cambia', tenta($$update saldo_banca set entrate = 1, saldo_finale = 1$$), 'a vuoto (0 righe)');
reset role;
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('l''istruttore non vede i saldi', (select count(*)::text from saldo_banca), '0');
select atteso('non ne scrive', tenta($$insert into saldo_banca (mese, saldo_iniziale, entrate, uscite, saldo_finale) values ('2026-06', 0, 0, 0, 0)$$), 'NEGATO: …');
select atteso('non ne cambia', tenta($$update saldo_banca set entrate = 1, saldo_finale = 1$$), 'a vuoto (0 righe)');
select atteso('non ne toglie', tenta($$delete from saldo_banca$$), 'a vuoto (0 righe)');
reset role;
select chi('77777777-7777-7777-7777-777777777777');
set role authenticated;
select atteso('l''iscritto non vede i saldi', (select count(*)::text from saldo_banca), '0');
select atteso('non ne scrive', tenta($$insert into saldo_banca (mese, saldo_iniziale, entrate, uscite, saldo_finale) values ('2026-06', 0, 0, 0, 0)$$), 'NEGATO: …');
reset role;
select chi('');
set role authenticated;
select atteso('senza accesso non si vede niente', (select count(*)::text from saldo_banca), '0');
reset role;
set role anon;
select atteso('la chiave anon non legge', tenta($$select count(*)::text from saldo_banca$$), 'NEGATO: …');
select atteso('non scrive', tenta($$insert into saldo_banca (mese, saldo_iniziale, entrate, uscite, saldo_finale) values ('2026-06', 0, 0, 0, 0)$$), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 3. i conti dell''estratto tornano anche nel database (stessi numeri di prova-quadratura.mjs) ---'
select atteso('iniziale + entrate − uscite = finale: 100,00 + 50,00 − 20,00 = 130,00 passa',
  tenta($$insert into saldo_banca (mese, saldo_iniziale, entrate, uscite, saldo_finale) values ('2026-05', 10000, 5000, 2000, 13000)$$), 'FATTO (1 righe)');
select atteso('un finale che non torna (125,00) no', tenta($$insert into saldo_banca (mese, saldo_iniziale, entrate, uscite, saldo_finale) values ('2026-04', 10000, 5000, 2000, 12500)$$), 'NEGATO: …');
select atteso('nemmeno di un centesimo', tenta($$insert into saldo_banca (mese, saldo_iniziale, entrate, uscite, saldo_finale) values ('2026-04', 10000, 5000, 2000, 13001)$$), 'NEGATO: …');
select atteso('correggendo un numero e non gli altri no', tenta($$update saldo_banca set entrate = 9999 where mese = '2026-05'$$), 'NEGATO: …');
select atteso('il saldo può essere sotto zero: −30,00 + 10,00 = −20,00', tenta($$insert into saldo_banca (mese, saldo_iniziale, entrate, uscite, saldo_finale) values ('2026-03', -3000, 1000, 0, -2000)$$), 'FATTO (1 righe)');
select atteso('entrate negative no', tenta($$insert into saldo_banca (mese, saldo_iniziale, entrate, uscite, saldo_finale) values ('2026-02', 0, -500, -1000, 500)$$), 'NEGATO: …');
select atteso('un numero mancante no', tenta($$insert into saldo_banca (mese, saldo_iniziale, entrate, uscite) values ('2026-02', 0, 0, 0)$$), 'NEGATO: …');

\echo ''
\echo '--- 4. un mese è unico e si scrive come AAAA-MM ---'
select atteso('lo stesso mese due volte no', tenta($$insert into saldo_banca (mese, saldo_iniziale, entrate, uscite, saldo_finale) values ('2026-09', 0, 0, 0, 0)$$), 'NEGATO: …');
select atteso('un mese con il giorno no', tenta($$insert into saldo_banca (mese, saldo_iniziale, entrate, uscite, saldo_finale) values ('2026-02-01', 0, 0, 0, 0)$$), 'NEGATO: …');
select atteso('il mese 13 no', tenta($$insert into saldo_banca (mese, saldo_iniziale, entrate, uscite, saldo_finale) values ('2026-13', 0, 0, 0, 0)$$), 'NEGATO: …');
select atteso('un mese scritto male no', tenta($$insert into saldo_banca (mese, saldo_iniziale, entrate, uscite, saldo_finale) values ('ottobre', 0, 0, 0, 0)$$), 'NEGATO: …');

\echo ''
\echo '--- 5. «verificato»: chi e quando vanno sempre insieme all''impronta ---'
select atteso('verificato senza impronta no', tenta($$update saldo_banca set verificato_il = now(), verificato_da = 'aaaaaaaa-0000-0000-0000-000000000001' where mese = '2026-09'$$), 'NEGATO: …');
select atteso('un''impronta senza il momento no', tenta($$update saldo_banca set impronta_verifica = 'abc123' where mese = '2026-09'$$), 'NEGATO: …');
select atteso('verificato con l''impronta sì', tenta($$update saldo_banca set verificato_il = now(), verificato_da = 'aaaaaaaa-0000-0000-0000-000000000001', impronta_verifica = 'abc123' where mese = '2026-09'$$), 'FATTO (1 righe)');
select atteso('se la persona se ne va, la verifica resta', tenta($$delete from persone where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$), 'FATTO (1 righe)');
select atteso('…e non dice più chi', (select coalesce(verificato_da::text, 'nessuno') || ' ' || impronta_verifica from saldo_banca where mese = '2026-09'), 'nessuno abc123');

\echo ''
\echo '--- 6. chi ha verificato resta quello: né chi cambia altro, né chi toglie una persona prende il suo posto ---'
insert into saldo_banca (mese, saldo_iniziale, entrate, uscite, saldo_finale) values ('2026-11', 0, 100, 0, 100);
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('Ada verifica novembre', tenta($$update saldo_banca set verificato_il = '2000-01-01', impronta_verifica = 'nov1' where mese = '2026-11'$$), 'FATTO (1 righe)');
select atteso('…chi è lei, quando è adesso: la data non la sceglie chi scrive', (select verificato_da::text || ' ' || (verificato_il > now() - interval '1 minute')::text from saldo_banca where mese = '2026-11'), 'aaaaaaaa-0000-0000-0000-000000000002 true');
select atteso('verificare un mese senza saldo non fa niente', tenta($$update saldo_banca set verificato_il = now(), impronta_verifica = 'x' where mese = '2025-01'$$), 'a vuoto (0 righe)');
reset role;
select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('Ivo tocca la riga senza cambiare niente', tenta($$update saldo_banca set entrate = entrate where mese = '2026-11'$$), 'FATTO (1 righe)');
select atteso('…la verifica resta di Ada', (select verificato_da::text || ' ' || impronta_verifica from saldo_banca where mese = '2026-11'), 'aaaaaaaa-0000-0000-0000-000000000002 nov1');
select atteso('Ivo prova a mettersi come chi ha verificato', tenta($$update saldo_banca set verificato_da = 'aaaaaaaa-0000-0000-0000-000000000004' where mese = '2026-11'$$), 'FATTO (1 righe)');
select atteso('…resta Ada', (select verificato_da::text from saldo_banca where mese = '2026-11'), 'aaaaaaaa-0000-0000-0000-000000000002');
select atteso('Ivo cambia i numeri', tenta($$update saldo_banca set entrate = 200, saldo_finale = 200 where mese = '2026-11'$$), 'FATTO (1 righe)');
select atteso('…e il mese torna da verificare: i numeri verificati non ci sono più', (select coalesce(verificato_da::text, '-') || coalesce(verificato_il::text, '-') || coalesce(impronta_verifica, '-') from saldo_banca where mese = '2026-11'), '---');
select atteso('Ivo lo verifica di nuovo: adesso è lui', tenta($$update saldo_banca set verificato_il = now(), impronta_verifica = 'nov2' where mese = '2026-11'$$), 'FATTO (1 righe)');
select atteso('…Ivo', (select verificato_da::text from saldo_banca where mese = '2026-11'), 'aaaaaaaa-0000-0000-0000-000000000004');
reset role;
-- La persona la toglie qualcuno con una sessione: il «set null» sulla riga non deve mettere il suo nome.
select chi('33333333-3333-3333-3333-333333333333');
select atteso('si toglie Ivo, con Sandro collegato', tenta($$delete from persone where id = 'aaaaaaaa-0000-0000-0000-000000000004'$$), 'FATTO (1 righe)');
select atteso('…la verifica resta, senza nome: non diventa di Sandro', (select coalesce(verificato_da::text, 'nessuno') || ' ' || impronta_verifica from saldo_banca where mese = '2026-11'), 'nessuno nov2');
select chi('');

\echo ''
\echo '--- 7. la funzione del trigger non si chiama da fuori, e il tablet non vede i saldi ---'
select atteso('authenticated non la esegue', has_function_privilege('authenticated', 'saldo_banca_chi_verifica()', 'EXECUTE')::text, 'false');
select atteso('anon nemmeno', has_function_privilege('anon', 'saldo_banca_chi_verifica()', 'EXECUTE')::text, 'false');
select atteso('né public', has_function_privilege('public', 'saldo_banca_chi_verifica()', 'EXECUTE')::text, 'false');
insert into auth.users (id, email) values ('99999999-9999-9999-9999-999999999999', 'tablet@ods.it');
insert into sale (id, nome) values ('bbbbbbbb-0000-0000-0000-000000000001', 'Tatami');
insert into postazioni (id, nome, sala_id, utente_id) values ('dddddddd-0000-0000-0000-000000000001', 'Tablet', 'bbbbbbbb-0000-0000-0000-000000000001', '99999999-9999-9999-9999-999999999999');
select chi('99999999-9999-9999-9999-999999999999');
set role authenticated;
select atteso('il tablet non vede i saldi', (select count(*)::text from saldo_banca), '0');
select atteso('non ne scrive', tenta($$insert into saldo_banca (mese, saldo_iniziale, entrate, uscite, saldo_finale) values ('2026-06', 0, 0, 0, 0)$$), 'NEGATO: …');
select atteso('non ne toglie', tenta($$delete from saldo_banca$$), 'a vuoto (0 righe)');
reset role;
select chi('');
