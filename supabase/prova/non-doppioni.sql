-- «Non sono doppioni»: la segreteria segna due schede che si somigliano ma
-- sono due persone, e la coppia non le viene più proposta. Lo fa e lo vede
-- solo la segreteria; la coppia è una sola in qualunque ordine la si segni,
-- chi l'ha segnata lo scrive il database, e se una delle due schede se ne va
-- la coppia se ne va con lei.
-- Si lancia dopo finto-supabase.sql, i file dello schema e
-- 33-non-doppioni.sql.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'maura@ods.it'),
  ('33333333-3333-3333-3333-333333333333', 'luca@ods.it'),
  ('66666666-6666-6666-6666-666666666666', 'lotta@sale.ods-corsi.it');
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Maura', 'Uno', 'istruttore', 'maura@ods.it', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Luca', 'Rossi', 'iscritto', 'luca@ods.it', '33333333-3333-3333-3333-333333333333'),
  -- Due Sara Bianchi: omonime, non doppioni. E due Teo Neri, per la scheda che se ne va.
  ('aaaaaaaa-0000-0000-0000-000000000012', 'Sara', 'Bianchi', 'iscritto', null, null),
  ('aaaaaaaa-0000-0000-0000-000000000013', 'Sara', 'Bianchi', 'iscritto', null, null),
  ('aaaaaaaa-0000-0000-0000-000000000017', 'Teo', 'Neri', 'iscritto', null, null),
  ('aaaaaaaa-0000-0000-0000-000000000018', 'Teo', 'Neri', 'iscritto', null, null);
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
-- Chi non deve vedere: o non ha il permesso, o non vede righe.
create or replace function niente(sql text) returns text language plpgsql as $$
declare r text := tenta(sql);
begin return case when r in ('0', 'a vuoto (0 righe)') or r like 'NEGATO: permission denied%' or r like 'NEGATO: new row violates row-level security%' then 'niente' else r end; end $$;
create or replace function atteso(cosa text, avuto text, voluto text) returns text language plpgsql as $$
begin
  if avuto is distinct from voluto and not (voluto like '%…' and avuto like replace(voluto, '…', '%')) then
    raise exception '% · atteso «%», avuto «%»', cosa, voluto, avuto;
  end if;
  return 'ok  ' || cosa || ' → ' || avuto;
end $$;
grant execute on function tenta(text), niente(text), atteso(text, text, text), chi(text) to anon, authenticated;

\echo ''
\echo '--- 1. la segreteria segna due schede «non sono doppioni» ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
-- La seconda prima della prima: il database la salva in ordine. Il client
-- manda un altro come «segnata da»: conta chi scrive.
select atteso('la segreteria le segna', tenta($$insert into non_doppioni (a, b, segnata_da) values
  ('aaaaaaaa-0000-0000-0000-000000000013', 'aaaaaaaa-0000-0000-0000-000000000012', 'aaaaaaaa-0000-0000-0000-000000000002')$$), 'FATTO (1 righe)');
select atteso('e le legge', (select count(*)::text from non_doppioni), '1');
select atteso('salvata con la prima scheda prima', (select a || ' ' || b from non_doppioni),
  'aaaaaaaa-0000-0000-0000-000000000012 aaaaaaaa-0000-0000-0000-000000000013');
select atteso('segnata da chi scrive, non da chi dice il client', (select segnata_da::text from non_doppioni), 'aaaaaaaa-0000-0000-0000-000000000001');
select atteso('segnata adesso', (select (segnata_il > now() - interval '1 minute')::text from non_doppioni), 'true');
-- Segnata di nuovo, nell'altro ordine: com'è andata conta poco, conta che resti una.
select tenta($$insert into non_doppioni (a, b) values ('aaaaaaaa-0000-0000-0000-000000000012', 'aaaaaaaa-0000-0000-0000-000000000013')$$);
select tenta($$insert into non_doppioni (a, b) values ('aaaaaaaa-0000-0000-0000-000000000013', 'aaaaaaaa-0000-0000-0000-000000000012')$$);
select atteso('come la segna l''app, nell''altro ordine: niente', tenta($$insert into non_doppioni (a, b) values
  ('aaaaaaaa-0000-0000-0000-000000000013', 'aaaaaaaa-0000-0000-0000-000000000012') on conflict (a, b) do nothing$$), 'a vuoto (0 righe)');
select atteso('segnata di nuovo, in tutti e due gli ordini: sempre una riga', (select count(*)::text from non_doppioni), '1');
select atteso('una scheda con sé stessa no', tenta($$insert into non_doppioni (a, b) values
  ('aaaaaaaa-0000-0000-0000-000000000012', 'aaaaaaaa-0000-0000-0000-000000000012')$$), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 2. chi non è della segreteria né vede né segna né toglie ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('un istruttore non vede', niente($$select count(*)::text from non_doppioni$$), 'niente');
select atteso('né segna', tenta($$insert into non_doppioni (a, b) values ('aaaaaaaa-0000-0000-0000-000000000017', 'aaaaaaaa-0000-0000-0000-000000000018')$$), 'NEGATO: …');
select atteso('né toglie', niente($$delete from non_doppioni$$), 'niente');
reset role;
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('un iscritto non vede', niente($$select count(*)::text from non_doppioni$$), 'niente');
select atteso('né segna', tenta($$insert into non_doppioni (a, b) values ('aaaaaaaa-0000-0000-0000-000000000017', 'aaaaaaaa-0000-0000-0000-000000000018')$$), 'NEGATO: …');
select atteso('né toglie', niente($$delete from non_doppioni$$), 'niente');
reset role;
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('il tablet non vede', niente($$select count(*)::text from non_doppioni$$), 'niente');
select atteso('né segna', tenta($$insert into non_doppioni (a, b) values ('aaaaaaaa-0000-0000-0000-000000000017', 'aaaaaaaa-0000-0000-0000-000000000018')$$), 'NEGATO: …');
select atteso('né toglie', niente($$delete from non_doppioni$$), 'niente');
reset role;
select chi('');
set role anon;
select atteso('chi non ha accesso non vede', niente($$select count(*)::text from non_doppioni$$), 'niente');
select atteso('né segna', tenta($$insert into non_doppioni (a, b) values ('aaaaaaaa-0000-0000-0000-000000000017', 'aaaaaaaa-0000-0000-0000-000000000018')$$), 'NEGATO: …');
select atteso('né toglie', niente($$delete from non_doppioni$$), 'niente');
reset role;
select atteso('la coppia c''è ancora, e nessun''altra', (select count(*)::text from non_doppioni), '1');

\echo ''
\echo '--- 3. la segreteria toglie, e la scheda che se ne va si porta via la coppia ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria toglie', tenta($$delete from non_doppioni where a = 'aaaaaaaa-0000-0000-0000-000000000012'$$), 'FATTO (1 righe)');
select atteso('segna i due Teo', tenta($$insert into non_doppioni (a, b) values
  ('aaaaaaaa-0000-0000-0000-000000000017', 'aaaaaaaa-0000-0000-0000-000000000018')$$), 'FATTO (1 righe)');
reset role;
delete from persone where id = 'aaaaaaaa-0000-0000-0000-000000000018';
select atteso('cancellata una scheda, la coppia se ne va', (select count(*)::text from non_doppioni), '0');

\echo ''
\echo '--- 4. unire due schede che hanno coppie «non sono doppioni» ---'
-- Tre Ugo Verdi: 21 e 22 sono la stessa persona, 23 un omonimo. La
-- segreteria ha segnato 21-23 e 22-23 «non doppioni», e per sbaglio anche 21-22.
insert into persone (id, nome, cognome, ruolo) values
  ('aaaaaaaa-0000-0000-0000-000000000021', 'Ugo', 'Verdi', 'iscritto'),
  ('aaaaaaaa-0000-0000-0000-000000000022', 'Ugo', 'Verdi', 'iscritto'),
  ('aaaaaaaa-0000-0000-0000-000000000023', 'Ugo', 'Verdi', 'iscritto');
insert into non_doppioni (a, b) values
  ('aaaaaaaa-0000-0000-0000-000000000021', 'aaaaaaaa-0000-0000-0000-000000000023'),
  ('aaaaaaaa-0000-0000-0000-000000000022', 'aaaaaaaa-0000-0000-0000-000000000023'),
  ('aaaaaaaa-0000-0000-0000-000000000021', 'aaaaaaaa-0000-0000-0000-000000000022');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('si uniscono lo stesso', tenta($$select 'fatto' from unisci_persone('aaaaaaaa-0000-0000-0000-000000000021', 'aaaaaaaa-0000-0000-0000-000000000022')$$), 'fatto');
reset role;
select atteso('resta una coppia: chi resta e l''omonimo',
  (select string_agg(right(a::text, 2) || '-' || right(b::text, 2), ',' order by a, b) from non_doppioni where '21' in (right(a::text, 2), right(b::text, 2))), '21-23');

\echo ''
\echo '--- 5. un aggiornamento che non sposta la coppia passa ---'
-- Lo fa il giro di `unisci_persone` su `segnata_da`: chi l'ha segnata cambia, la coppia resta.
update non_doppioni set segnata_da = 'aaaaaaaa-0000-0000-0000-000000000002' where a = 'aaaaaaaa-0000-0000-0000-000000000021';
select atteso('chi l''ha segnata cambia', (select segnata_da::text from non_doppioni where a = 'aaaaaaaa-0000-0000-0000-000000000021'), 'aaaaaaaa-0000-0000-0000-000000000002');
