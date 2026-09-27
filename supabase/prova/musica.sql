-- La musica delle sale: la segreteria prepara le liste, il tablet vede solo
-- quelle della sua sala e di tutte, e non le cambia.
-- Si lancia dopo finto-supabase.sql e i dieci file dello schema.
-- In fondo, anche le impostazioni del timer dei tablet (10-timer-sale.sql e
-- 14-timer-dal-tablet.sql: uguali per tutti, le cambia anche un tablet).
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'maura@ods.it'),
  ('33333333-3333-3333-3333-333333333333', 'luca@ods.it'),
  ('66666666-6666-6666-6666-666666666666', 'lotta@sale.ods-corsi.it');
insert into persone (id, nome, cognome, ruolo, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Maura', 'Uno', 'istruttore', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Luca', 'Rossi', 'iscritto', '33333333-3333-3333-3333-333333333333');
insert into sale (id, nome) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Lotta'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Tatami');
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
\echo '--- 1. Anna, segreteria: prepara le liste ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('una lista per la Lotta',
  tenta($$insert into musica_sale (id, sala_id, nome, link) values
    ('c0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Randori',
     'https://www.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG')$$), 'FATTO (1 righe)');
select atteso('una per tutte le sale, da Spotify',
  tenta($$insert into musica_sale (id, nome, link) values
    ('c0000000-0000-0000-0000-000000000002', 'Riscaldamento', 'https://open.spotify.com/playlist/37i9dQZF1DX76Wlfdnj7AP')$$), 'FATTO (1 righe)');
select atteso('una per il Tatami',
  tenta($$insert into musica_sale (id, sala_id, nome, link) values
    ('c0000000-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000002', 'Bambini', 'spotify:playlist:37i9dQZF1DXdPec7aLTmlC')$$), 'FATTO (1 righe)');
select atteso('un link che non è musica no',
  tenta($$insert into musica_sale (nome, link) values ('Altro', 'https://esempio.it/lista')$$), 'NEGATO: …');
select atteso('un nome vuoto no',
  tenta($$insert into musica_sale (nome, link) values ('   ', 'https://youtu.be/dQw4w9WgXcQ')$$), 'NEGATO: …');
select atteso('la rinomina', tenta($$update musica_sale set nome = 'Randori forte' where id = 'c0000000-0000-0000-0000-000000000001'$$), 'FATTO (1 righe)');
select atteso('il tablet si chiama solo da un tablet', tenta($$select count(*)::text from musica_sala()$$), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 2. Maura, istruttrice: le vede e non le cambia ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('le vede tutte', tenta($$select count(*)::text from musica_sale$$), '3');
select atteso('non ne aggiunge', tenta($$insert into musica_sale (nome, link) values ('Mia', 'https://youtu.be/dQw4w9WgXcQ')$$), 'NEGATO: …');
select atteso('non le cambia', tenta($$update musica_sale set nome = 'Mia'$$), 'a vuoto (0 righe)');
select atteso('non le toglie', tenta($$delete from musica_sale$$), 'a vuoto (0 righe)');
reset role;

\echo ''
\echo '--- 3. Luca, iscritto: niente ---'
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('non le vede', tenta($$select count(*)::text from musica_sale$$), '0');
reset role;

\echo ''
\echo '--- 4. Il tablet della Lotta ---'
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('la tabella non la legge', tenta($$select count(*)::text from musica_sale$$), '0');
select atteso('dalla funzione: la sua e quella di tutte', tenta($$select string_agg(nome, ', ') from musica_sala()$$), 'Randori forte, Riscaldamento');
select atteso('non ne aggiunge', tenta($$insert into musica_sale (nome, link) values ('Sua', 'https://youtu.be/dQw4w9WgXcQ')$$), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 5. Chi non ha fatto l''accesso ---'
select chi('');
set role anon;
select atteso('la funzione no', tenta($$select count(*)::text from musica_sala()$$), 'NEGATO: …');
select atteso('la tabella no', tenta($$select count(*)::text from musica_sale$$), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 6. Una sala tolta si porta via le sue liste ---'
delete from sale where id = 'bbbbbbbb-0000-0000-0000-000000000002';
select atteso('resta quella di tutte e quella della Lotta', (select count(*)::text from musica_sale), '2');

\echo ''
\echo '--- 7. Il timer dei tablet: uguale per tutti, lo cambia un tablet o la segreteria ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria lo sceglie',
  tenta($$update impostazioni set timer = '{"coach":"spietato","volume":0.6}' where id$$), 'FATTO (1 righe)');
select atteso('un valore che non è un oggetto no',
  tenta($$update impostazioni set timer = '[1,2]' where id$$), 'NEGATO: …');
reset role;
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('l''istruttrice lo vede', tenta($$select timer->>'coach' from impostazioni$$), 'spietato');
select atteso('e non lo cambia', tenta($$update impostazioni set timer = '{}' where id$$), 'a vuoto (0 righe)');
reset role;
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('il tablet lo legge', tenta($$select timer->>'volume' from impostazioni$$), '0.6');
select atteso('la riga non la cambia', tenta($$update impostazioni set timer = '{}' where id$$), 'a vuoto (0 righe)');
select atteso('il timer sì, dalla funzione',
  tenta($$select salva_timer_sala('{"coach":"distratto","volume":0.4}')::text$$), '');
select atteso('e lo trova cambiato', tenta($$select timer->>'coach' from impostazioni$$), 'distratto');
select atteso('solo con un oggetto', tenta($$select salva_timer_sala('[1,2]')::text$$), 'NEGATO: …');
select atteso('e non troppo grande',
  tenta($$select salva_timer_sala(jsonb_build_object('x', repeat('a', 5000)))::text$$), 'NEGATO: …');
reset role;
select atteso('il resto della riga non si tocca', (select mesi_presenze::text from impostazioni), '24');
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('l''istruttrice dalla funzione no', tenta($$select salva_timer_sala('{}')::text$$), 'NEGATO: …');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria anche dalla funzione', tenta($$select salva_timer_sala('{"coach":"classico"}')::text$$), '');
reset role;
select chi('');
set role anon;
select atteso('chi non ha fatto l''accesso no', tenta($$select timer::text from impostazioni$$), 'NEGATO: …');
select atteso('e dalla funzione nemmeno', tenta($$select salva_timer_sala('{}')::text$$), 'NEGATO: …');
reset role;
