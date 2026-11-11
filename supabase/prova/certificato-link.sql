-- Il certificato che si carica da un link, senza password (142-certificato-link.sql):
--   • `link_certificato`: né leggibile né scrivibile da nessun ruolo, solo dalle funzioni;
--   • `link_certificato_per`: solo segreteria, riusa il link che vale (persona attiva, non
--     chiuso, creato da meno di 120 giorni), se no ne fa uno nuovo;
--   • `link_certificato_apri` e `link_manda_certificato`: solo `service_role` (la Edge Function);
--   • un certificato con data valida (conferma, `salva_certificato`, data a mano) chiude i
--     link; il rifiuto no;
--   • `certificato_in_attesa_scade`: la data dichiarata da chi carica dal link; sparisce con
--     un altro invio, la conferma, il rifiuto; lo stato del certificato non cambia;
--   • `segna_sollecito_link(persona, link)` e `solleciti_di(persona)`.
-- Le date sono tutte relative a oggi.
-- Le metà in prova: scripts/prova-certificato-link.mjs e scripts/prova-edge.mjs.
-- Si lancia dopo tablet.sql (segreteria Anna, istruttrice Maura, la Lotta 2).
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

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
-- Un rifiuto vero: una funzione o una tabella che non c'è ancora non è un permesso negato.
create or replace function rifiutata(sql text) returns text language plpgsql as $$
declare r text;
begin
  r := tenta(sql);
  return case when r like 'NEGATO:%' and r not like '%does not exist%' then 'rifiutata' else r end;
end $$;
create or replace function codice(sql text) returns text language plpgsql as $$
begin execute sql; return 'ok';
exception when others then return sqlstate;
end $$;
create or replace function oggi() returns date language sql stable as $$ select (now() at time zone 'Europe/Rome')::date $$;
create or replace function rel(d date) returns text language sql stable as $$ select coalesce((d - oggi())::text, '-') $$;
create or replace function pz(n int) returns uuid language sql immutable as $$
  select ('f3000000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;
create or replace function fl(n int, nome text) returns text language sql immutable as $$ select pz(n)::text || '/' || nome $$;

-- Gli helper che leggono tabelle chiuse ai ruoli (aperto, chiuso, inattesa, nello_storage) girano da superutente: servono a guardare, non a provare.
-- I link, per numero di persona: li scrive il superutente (la tabella non la tocca nessun ruolo).
create table lk (n int primary key, id uuid not null);
grant select on lk to anon, authenticated, service_role;
create or replace function lnk(n int) returns uuid language sql stable as $$ select id from lk where lk.n = lnk.n $$;
create or replace function nuovo(n int, fa_giorni int default 0) returns void language plpgsql as $$
declare i uuid;
begin
  insert into link_certificato (persona_id, creato_il) values (pz(n), now() - make_interval(days => fa_giorni)) returning id into i;
  insert into lk values (n, i);
end $$;
-- Cosa rende `link_certificato_apri`, in una riga (campi vuoti = «-»).
-- plpgsql: le funzioni di 142 non ci sono ancora quando la prova le definisce, e la prova deve dirlo, non cadere qui.
create or replace function apri(l uuid) returns text language plpgsql volatile as $$
declare r text;
begin
  select concat_ws(' · ', stato, coalesce(nome, '-'), coalesce(iniziale, '-'), coalesce(tipo, '-'), rel(entro)) into r from link_certificato_apri(l);
  return r;
end $$;
create or replace function apri(n int) returns text language sql volatile as $$ select apri(lnk(n)) $$;
create or replace function aperto(n int) returns text language plpgsql stable security definer as $$
declare r text;
begin select (aperto_il is not null)::text into r from link_certificato where id = lnk(n); return r; end $$;
create or replace function chiuso(n int) returns text language plpgsql stable security definer as $$
declare r text;
begin select (chiuso_il is not null)::text into r from link_certificato where id = lnk(n); return r; end $$;
create or replace function inattesa(n int) returns text language plpgsql stable security definer as $$
declare r text;
begin
  select coalesce(certificato_in_attesa, '-') || ' · ' || rel(certificato_in_attesa_scade) into r from schede_iscritti where persona_id = pz(n);
  return coalesce(r, '- · -');
end $$;
create or replace function nello_storage(n int, nome text) returns text language sql stable security definer as $$
  select exists (select 1 from storage.objects where bucket_id = 'certificati' and name = fl(n, nome))::text
$$;
-- Una persona dei casi: `anni` e, volendo, il corso a cui è iscritta oggi.
create or replace function persona_prova(n int, nome text, cognome text, anni int, corso uuid default null, al date default null, ruolo text default 'iscritto')
  returns void language plpgsql as $$
begin
  insert into persone (id, nome, cognome, ruolo) values (pz(n), nome, cognome, ruolo::ruolo);
  if anni is not null then insert into anagrafiche (persona_id, nato_il) values (pz(n), (oggi() - make_interval(years => anni))::date); end if;
  if corso is not null then insert into iscrizioni (corso_id, persona_id, dal, al) values (corso, pz(n), current_date - 60, al); end if;
end $$;

-- --- chi c'è ----------------------------------------------------------------
-- Da tablet.sql: Anna (segreteria, 1111…), Maura (istruttrice, 2222…), il tablet della Lotta (6666…), la Lotta 2.
insert into auth.users (id, email) values ('77777777-7777-7777-7777-777777777777', 'ivo@ods.it');
insert into persone (id, nome, cognome, ruolo, utente_id) values (pz(33), 'Ivo', 'Iscritto', 'iscritto', '77777777-7777-7777-7777-777777777777');
insert into anagrafiche (persona_id, nato_il) values (pz(33), '1990-05-05');
insert into corsi (id, nome, attivo) values
  ('cccccccc-0000-0000-0000-0000000000f1', 'Judo bambini', true),
  ('cccccccc-0000-0000-0000-0000000000f2', 'Judo vecchio', false),
  ('cccccccc-0000-0000-0000-0000000000f3', 'Lottatori in erba', true);

select persona_prova(51, 'Marco', 'rossi', 30);
select persona_prova(52, 'Anita', 'Bruni', 14, 'cccccccc-0000-0000-0000-000000000001');
select persona_prova(53, 'Dodo', 'Quasi', 12, 'cccccccc-0000-0000-0000-000000000001');
update anagrafiche set nato_il = (oggi() - interval '12 years')::date + 1 where persona_id = pz(53);   -- 12 anni domani
select persona_prova(54, 'Dora', 'Dodici', 12, 'cccccccc-0000-0000-0000-000000000001');                  -- 12 anni oggi
select persona_prova(55, 'Gino', 'Judoka', 14, 'cccccccc-0000-0000-0000-0000000000f1');
select persona_prova(56, 'Vera', 'Vecchia', 14, 'cccccccc-0000-0000-0000-0000000000f2');
select persona_prova(57, 'Luca', 'Erba', 14, 'cccccccc-0000-0000-0000-0000000000f3');
select persona_prova(76, 'Ugo', 'Uscito', 14, 'cccccccc-0000-0000-0000-000000000001', current_date - 1);  -- ha lasciato il corso ieri
select persona_prova(58, 'Dino', 'Disattivo', 30);
select persona_prova(59, 'Olga', 'Vecchia', 30);
select persona_prova(60, 'Nina', 'Ancora', 30);
select persona_prova(61, 'Conf', 'Ferma', 30);
select persona_prova(62, 'Salvo', 'Salva', 30);
select persona_prova(63, 'Rita', 'Rifiuta', 30);
select persona_prova(64, 'Dante', 'Datavalida', 30);
select persona_prova(65, 'Paola', 'Datapassata', 30);
select persona_prova(66, 'Chiara', 'Chiusa', 30);
select persona_prova(67, 'Luigi', 'Chiusovecchio', 30);
select persona_prova(68, 'Manuel', 'Manda', 30);
select persona_prova(69, 'Altra', 'Persona', 30);
select persona_prova(70, 'Paolo', 'Per', 30);
select persona_prova(71, 'Sofia', 'Sollecita', 30);
select persona_prova(73, 'Teo', 'Terzo', 30);
select persona_prova(74, 'Disa', 'Inattiva', 30);
update persone set attiva = false where id in (pz(58), pz(74));

-- Il certificato scaduto di Manuel (resta com'è, qualunque cosa arrivi dal link) e il termine di Marco.
insert into schede_iscritti (persona_id, certificato_scade, certificato_entro) values (pz(68), oggi() - 10, null), (pz(51), null, oggi() + 10);
-- Le schede di chi avrà la data scritta a mano (un update su una scheda che non c'è non scrive niente).
insert into schede_iscritti (persona_id) values (pz(64)), (pz(65));
-- I link dei casi: 59 e 67 hanno più di 120 giorni, 60 ne ha 119, 66 e 67 sono chiusi.
select nuovo(51); select nuovo(52); select nuovo(53); select nuovo(54); select nuovo(55); select nuovo(56); select nuovo(57); select nuovo(76);
select nuovo(58); select nuovo(59, 121); select nuovo(60, 119); select nuovo(61); select nuovo(62); select nuovo(63); select nuovo(64); select nuovo(65);
select nuovo(66); select nuovo(67, 121); select nuovo(68); select nuovo(33); select nuovo(71); select nuovo(73); select nuovo(74);
update link_certificato set chiuso_il = now() where id in (lnk(66), lnk(67));
-- I file: ognuno nello storage, come li metterebbe la Edge Function.
insert into storage.objects (bucket_id, name) values
  ('certificati', fl(58, 'attesa-1.pdf')), ('certificati', fl(59, 'attesa-1.pdf')), ('certificati', fl(66, 'attesa-1.pdf')),
  ('certificati', fl(61, 'attesa-1.pdf')), ('certificati', fl(62, 'certificato-7.pdf')), ('certificati', fl(63, 'attesa-1.pdf')),
  ('certificati', fl(33, 'attesa-1.pdf')), ('certificati', fl(33, 'attesa-2.pdf')), ('certificati', fl(74, 'attesa-1.pdf')),
  ('certificati', fl(68, 'attesa-1.pdf')), ('certificati', fl(68, 'attesa-2.png')), ('certificati', fl(68, 'attesa-3.pdf')),
  ('certificati', fl(68, 'attesa-4.jpg')), ('certificati', fl(68, 'certificato-9.pdf')), ('certificati', fl(69, 'attesa-1.pdf'));

\echo ''
\echo '--- 1. la tabella non la tocca nessuno ---'
select chi('');
set role anon;
select atteso('anon non legge link_certificato', rifiutata($$select count(*)::text from link_certificato$$), 'rifiutata');
select atteso('anon non ci scrive', rifiutata($$insert into link_certificato (persona_id) values (pz(51))$$), 'rifiutata');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('nemmeno la segreteria legge link_certificato', rifiutata($$select count(*)::text from link_certificato$$), 'rifiutata');
select atteso('né ci scrive', rifiutata($$insert into link_certificato (persona_id) values (pz(51))$$), 'rifiutata');
select atteso('né lo cambia', rifiutata($$update link_certificato set chiuso_il = null$$), 'rifiutata');
select atteso('né lo cancella', rifiutata($$delete from link_certificato$$), 'rifiutata');
reset role;
select chi('77777777-7777-7777-7777-777777777777');
set role authenticated;
select atteso('l''iscritto non legge link_certificato', rifiutata($$select count(*)::text from link_certificato$$), 'rifiutata');
select atteso('l''iscritto non ci scrive', rifiutata($$insert into link_certificato (persona_id) values (pz(33))$$), 'rifiutata');
reset role;
set role service_role;
select atteso('nemmeno service_role tocca la tabella: solo le funzioni', rifiutata($$select count(*)::text from link_certificato$$), 'rifiutata');
reset role;

\echo ''
\echo '--- 2. chi può chiamare cosa ---'
select chi('');
set role anon;
select atteso('anon non apre un link', rifiutata($$select apri(lnk(51))$$), 'rifiutata');
select atteso('anon non manda un certificato', rifiutata(format($$select link_manda_certificato(lnk(68), %L, oggi() + 30)::text$$, fl(68, 'attesa-1.pdf'))), 'rifiutata');
select atteso('anon non chiede un link', rifiutata($$select link_certificato_per(pz(51))::text$$), 'rifiutata');
select atteso('anon non legge i solleciti', rifiutata($$select count(*)::text from solleciti_di(pz(71))$$), 'rifiutata');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('nemmeno la segreteria apre un link: è della Edge Function', rifiutata($$select apri(lnk(51))$$), 'rifiutata');
select atteso('né manda un certificato dal link', rifiutata(format($$select link_manda_certificato(lnk(68), %L, oggi() + 30)::text$$, fl(68, 'attesa-1.pdf'))), 'rifiutata');
reset role;
select chi('77777777-7777-7777-7777-777777777777');
set role authenticated;
select atteso('l''iscritto non apre un link', rifiutata($$select apri(lnk(33))$$), 'rifiutata');
select atteso('l''iscritto non manda dal link', rifiutata(format($$select link_manda_certificato(lnk(33), %L, oggi() + 30)::text$$, fl(33, 'attesa-1.pdf'))), 'rifiutata');
select atteso('l''iscritto non chiede un link', rifiutata($$select link_certificato_per(pz(33))::text$$), 'rifiutata');
select atteso('l''iscritto non legge i solleciti', rifiutata($$select count(*)::text from solleciti_di(pz(33))$$), 'rifiutata');
select atteso('l''iscritto non segna un sollecito', rifiutata($$select segna_sollecito(pz(71))::text$$), 'rifiutata');
reset role;
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('l''istruttrice non chiede un link', rifiutata($$select link_certificato_per(pz(51))::text$$), 'rifiutata');
select atteso('né legge i solleciti', rifiutata($$select count(*)::text from solleciti_di(pz(71))$$), 'rifiutata');
reset role;
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('il tablet non chiede un link', rifiutata($$select link_certificato_per(pz(51))::text$$), 'rifiutata');
reset role;

\echo ''
\echo '--- 3. link_certificato_per: solo la segreteria, riusa quello che vale ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria ne chiede uno: nuovo', (tenta($$select link_certificato_per(pz(70))::text$$) like 'NEGATO%')::text, 'false');
create temp table per as select link_certificato_per(pz(70)) as id;
grant select on per to public;
select atteso('lo stesso link a una seconda richiesta', (link_certificato_per(pz(70)) = (select id from per))::text, 'true');
reset role;
select atteso('il link è della persona, aperto da nessuno, non chiuso', (select (persona_id = pz(70))::text || ' · ' || (aperto_il is null)::text || ' · ' || (chiuso_il is null)::text
  from link_certificato where id = (select id from per)), 'true · true · true');
select atteso('un solo link per lei', (select count(*)::text from link_certificato where persona_id = pz(70)), '1');
update link_certificato set creato_il = now() - interval '121 days' where id = (select id from per);
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('dopo 120 giorni se ne crea uno nuovo', (link_certificato_per(pz(70)) <> (select id from per))::text, 'true');
reset role;
select atteso('adesso i link di lei sono due', (select count(*)::text from link_certificato where persona_id = pz(70)), '2');
update link_certificato set chiuso_il = now() where persona_id = pz(70);
create temp table chiusi as select id from link_certificato where persona_id = pz(70);
grant select on chiusi to public;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('dopo la chiusura ne nasce un altro', (link_certificato_per(pz(70)) not in (select id from chiusi))::text, 'true');
select atteso('una persona che non c''è: P0002', codice($$select link_certificato_per(gen_random_uuid())$$), 'P0002');
select atteso('un''istruttrice non è iscritta: P0002', codice($$select link_certificato_per('aaaaaaaa-0000-0000-0000-000000000002')$$), 'P0002');
select atteso('una persona disattivata: P0002', codice($$select link_certificato_per(pz(74))$$), 'P0002');
reset role;
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('l''istruttrice: 42501', codice($$select link_certificato_per(pz(70))$$), '42501');
reset role;

\echo ''
\echo '--- 4. link_certificato_apri: valido, con nome, iniziale, tipo e termine ---'
set role service_role;
select atteso('prima di aprirlo non l''ha aperto nessuno', aperto(51), 'false');
select atteso('Marco: valido, nome, iniziale maiuscola, normale, termine fra 10 giorni', apri(51), 'valido · Marco · R · normale · 10');
reset role;
select atteso('aperto_il è segnato', aperto(51), 'true');
set role service_role;
select atteso('14 anni nella Lotta 2: agonistico', apri(52), 'valido · Anita · B · agonistico · -');
select atteso('12 anni meno un giorno: normale', apri(53), 'valido · Dodo · Q · normale · -');
select atteso('12 anni oggi: agonistico', apri(54), 'valido · Dora · D · agonistico · -');
select atteso('Judo (corso attivo): agonistico', apri(55), 'valido · Gino · J · agonistico · -');
select atteso('Judo ma il corso non è attivo: normale', apri(56), 'valido · Vera · V · normale · -');
select atteso('un corso che dice «Lottatori»: non è la parola Lotta, normale', apri(57), 'valido · Luca · E · normale · -');
select atteso('ha lasciato il corso ieri: normale', apri(76), 'valido · Ugo · U · normale · -');
select atteso('119 giorni: vale ancora', apri(60), 'valido · Nina · A · normale · -');
reset role;
select atteso('anche il suo aperto_il è segnato', aperto(60), 'true');

\echo ''
\echo '--- 5. link_certificato_apri: non vale / arrivato ---'
set role service_role;
select atteso('un link che non c''è: non_vale, tutto il resto vuoto', apri(gen_random_uuid()), 'non_vale · - · - · - · -');
select atteso('persona disattivata: non_vale, niente nome', apri(58), 'non_vale · - · - · - · -');
select atteso('oltre 120 giorni: non_vale, niente nome', apri(59), 'non_vale · - · - · - · -');
select atteso('sempre una riga', (select count(*)::text from link_certificato_apri(gen_random_uuid())), '1');
select atteso('chiuso, nel tetto: arrivato (con il nome)', (apri(66) like 'arrivato · Chiara%')::text, 'true');
select atteso('chiuso e oltre 120 giorni: non_vale', apri(67), 'non_vale · - · - · - · -');
reset role;
select atteso('un link che non vale non segna l''apertura', aperto(59) || ' · ' || aperto(58), 'false · false');

\echo ''
\echo '--- 6. conferma, salvataggio, data valida chiudono il link; il rifiuto no ---'
set role service_role;
select atteso('Conferma manda: il file va in attesa con la data', tenta(format($$select link_manda_certificato(lnk(61), %L, oggi() + 50)::text$$, fl(61, 'attesa-1.pdf'))), '');
select atteso('Rifiuta manda', tenta(format($$select link_manda_certificato(lnk(63), %L, oggi() + 50)::text$$, fl(63, 'attesa-1.pdf'))), '');
reset role;
select atteso('Conferma: file e data in attesa', inattesa(61), fl(61, 'attesa-1.pdf') || ' · 50');
select atteso('il file in attesa non chiude il link', chiuso(61), 'false');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria conferma', tenta(format($$select conferma_certificato_iscritto(%L, oggi() + 365)::text$$, pz(61))), '');
select atteso('la segreteria rifiuta Rita', tenta(format($$select rifiuta_certificato_iscritto(%L)::text$$, pz(63))), '');
select atteso('la segreteria salva un certificato per Salvo', tenta(format($$select salva_certificato(%L, %L, oggi() + 365)::text$$, pz(62), fl(62, 'certificato-7.pdf'))), '');
reset role;
select atteso('conferma: la data in attesa è vuota', (select rel(certificato_in_attesa_scade) from schede_iscritti where persona_id = pz(61)), '-');
select atteso('rifiuto: la data in attesa è vuota', (select rel(certificato_in_attesa_scade) from schede_iscritti where persona_id = pz(63)), '-');
select atteso('rifiuto: il file in attesa se ne va', nello_storage(63, 'attesa-1.pdf') || ' · ' || inattesa(63), 'false · - · -');
select atteso('conferma: il link è chiuso', chiuso(61), 'true');
select atteso('salva_certificato: il link è chiuso', chiuso(62), 'true');
select atteso('rifiuto: il link resta aperto', chiuso(63), 'false');
update schede_iscritti set certificato_scade = oggi() + 200 where persona_id = pz(64);
update schede_iscritti set certificato_scade = oggi() - 3 where persona_id = pz(65);
select atteso('una data valida scritta a mano chiude il link', chiuso(64), 'true');
select atteso('una data già passata no', chiuso(65), 'false');
set role service_role;
select atteso('dopo la conferma: arrivato', (apri(61) like 'arrivato · Conf%')::text, 'true');
select atteso('dopo salva_certificato: arrivato', (apri(62) like 'arrivato · Salvo%')::text, 'true');
select atteso('dopo la data a mano: arrivato', (apri(64) like 'arrivato · Dante%')::text, 'true');
select atteso('dopo il rifiuto: il link torna valido', (apri(63) like 'valido · Rita%')::text, 'true');
select atteso('data passata: il link vale ancora', (apri(65) like 'valido · Paola%')::text, 'true');
reset role;

\echo ''
\echo '--- 7. link_manda_certificato: il file in attesa, con la data ---'
set role service_role;
select atteso('Manuel manda il file con la data fra 365 giorni', tenta(format($$select link_manda_certificato(lnk(68), %L, oggi() + 365)::text$$, fl(68, 'attesa-1.pdf'))), '');
reset role;
select atteso('in attesa il file e la data', inattesa(68), fl(68, 'attesa-1.pdf') || ' · 365');
select atteso('l''istante dell''invio è segnato', (select (certificato_in_attesa_il > now() - interval '1 minute')::text from schede_iscritti where persona_id = pz(68)), 'true');
select atteso('lo stato del certificato non cambia: scade ancora 10 giorni fa', (select rel(certificato_scade) || ' · ' || coalesce(certificato_file, '-') from schede_iscritti where persona_id = pz(68)), '-10 · -');
select atteso('il link non si chiude: il certificato non è confermato', chiuso(68), 'false');
set role service_role;
select atteso('un secondo invio sostituisce il primo', tenta(format($$select link_manda_certificato(lnk(68), %L, oggi() + 100)::text$$, fl(68, 'attesa-2.png'))), '');
reset role;
select atteso('in attesa il secondo, con la sua data', inattesa(68), fl(68, 'attesa-2.png') || ' · 100');
select atteso('il vecchio è cancellato da storage.objects, il nuovo c''è', nello_storage(68, 'attesa-1.pdf') || ' · ' || nello_storage(68, 'attesa-2.png'), 'false · true');
select atteso('ancora scaduto da 10 giorni', (select rel(certificato_scade) from schede_iscritti where persona_id = pz(68)), '-10');

\echo ''
\echo '--- 8. link_manda_certificato: i rifiuti ---'
set role service_role;
select atteso('una data passata: 22023 e il testo per chi carica', tenta(format($$select link_manda_certificato(lnk(68), %L, oggi() - 1)::text$$, fl(68, 'attesa-3.pdf'))), 'NEGATO: Questo certificato è già scaduto: serve quello nuovo.');
select atteso('una data passata: sqlstate 22023', codice(format($$select link_manda_certificato(lnk(68), %L, oggi() - 1)$$, fl(68, 'attesa-3.pdf'))), '22023');
select atteso('oltre 3 anni (+1 giorno): 22023 e il testo', tenta(format($$select link_manda_certificato(lnk(68), %L, (oggi() + interval '3 years')::date + 1)::text$$, fl(68, 'attesa-3.pdf'))), 'NEGATO: La data è troppo lontana: controlla l’anno.');
select atteso('oltre 3 anni: sqlstate 22023', codice(format($$select link_manda_certificato(lnk(68), %L, (oggi() + interval '3 years')::date + 1)$$, fl(68, 'attesa-3.pdf'))), '22023');
select atteso('senza data: 22023', codice(format($$select link_manda_certificato(lnk(68), %L, null)$$, fl(68, 'attesa-3.pdf'))), '22023');
select atteso('il file di un''altra persona: 22023', codice(format($$select link_manda_certificato(lnk(68), %L, oggi() + 30)$$, fl(69, 'attesa-1.pdf'))), '22023');
select atteso('un file che non è in storage: 22023', codice(format($$select link_manda_certificato(lnk(68), %L, oggi() + 30)$$, fl(68, 'attesa-99.pdf'))), '22023');
select atteso('un nome che non è un attesa-N (il certificato già dato): 22023', codice(format($$select link_manda_certificato(lnk(68), %L, oggi() + 30)$$, fl(68, 'certificato-9.pdf'))), '22023');
select atteso('un link che non c''è: 42501', codice(format($$select link_manda_certificato(gen_random_uuid(), %L, oggi() + 30)$$, fl(68, 'attesa-3.pdf'))), '42501');
select atteso('il testo di un link che non vale', tenta(format($$select link_manda_certificato(gen_random_uuid(), %L, oggi() + 30)::text$$, fl(68, 'attesa-3.pdf'))), 'NEGATO: Questo link non vale più');
select atteso('un link oltre 120 giorni: 42501', codice(format($$select link_manda_certificato(lnk(59), %L, oggi() + 30)$$, fl(59, 'attesa-1.pdf'))), '42501');
select atteso('un link chiuso: 42501', codice(format($$select link_manda_certificato(lnk(66), %L, oggi() + 30)$$, fl(66, 'attesa-1.pdf'))), '42501');
select atteso('una persona disattivata: 42501', codice(format($$select link_manda_certificato(lnk(58), %L, oggi() + 30)$$, fl(58, 'attesa-1.pdf'))), '42501');
reset role;
select atteso('dopo tutti i rifiuti non è cambiato niente', inattesa(68), fl(68, 'attesa-2.png') || ' · 100');
select atteso('e i file dei rifiuti sono ancora dove erano', nello_storage(68, 'attesa-2.png') || ' · ' || nello_storage(69, 'attesa-1.pdf') || ' · ' || nello_storage(66, 'attesa-1.pdf'), 'true · true · true');
select atteso('il link chiuso non ha preso nessun file in attesa', inattesa(66), '- · -');
set role service_role;
select atteso('la data di oggi va bene', tenta(format($$select link_manda_certificato(lnk(68), %L, oggi())::text$$, fl(68, 'attesa-3.pdf'))), '');
select atteso('fra 3 anni esatti va bene', tenta(format($$select link_manda_certificato(lnk(68), %L, (oggi() + interval '3 years')::date)::text$$, fl(68, 'attesa-4.jpg'))), '');
reset role;
select atteso('l''ultimo vale, con la sua data', inattesa(68), fl(68, 'attesa-4.jpg') || ' · ' || ((oggi() + interval '3 years')::date - oggi()));

\echo ''
\echo '--- 9. la data in attesa sparisce con un invio dall''area iscritti ---'
set role service_role;
select atteso('Ivo (da link) manda il file con la data', tenta(format($$select link_manda_certificato(lnk(33), %L, oggi() + 100)::text$$, fl(33, 'attesa-1.pdf'))), '');
reset role;
select atteso('in attesa il file e la data', inattesa(33), fl(33, 'attesa-1.pdf') || ' · 100');
select chi('77777777-7777-7777-7777-777777777777');
set role authenticated;
select atteso('Ivo manda un altro file dalla sua area', tenta(format($$select iscritto_manda_certificato(%L, %L)::text$$, pz(33), fl(33, 'attesa-2.pdf'))), '');
reset role;
select atteso('il nuovo file è in attesa e la data dichiarata è sparita', inattesa(33), fl(33, 'attesa-2.pdf') || ' · -');

\echo ''
\echo '--- 10. i solleciti: segna_sollecito (di prima) e segna_sollecito_link e solleciti_di ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('segna_sollecito(persona) di prima funziona ancora', tenta($$select (segna_sollecito(pz(71)) is not null)::text$$), 'true');
reset role;
select atteso('canale whatsapp, nessun link', (select canale || ' · ' || coalesce(link_id::text, '-') from solleciti where persona_id = pz(71)), 'whatsapp · -');
update solleciti set creato_il = now() - interval '10 days' where persona_id = pz(71);
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('con il link della persona', tenta(format($$select (segna_sollecito_link(pz(71), %L) is not null)::text$$, lnk(71))), 'true');
select atteso('il link di un altra persona: 22023 e il testo', tenta(format($$select segna_sollecito_link(pz(71), %L)::text$$, lnk(73))), 'NEGATO: Il link non è di questa persona');
select atteso('il link di un altra persona: sqlstate', codice(format($$select segna_sollecito_link(pz(71), %L)$$, lnk(73))), '22023');
select atteso('un link che non c''è: 22023', codice($$select segna_sollecito_link(pz(71), gen_random_uuid())$$), '22023');
select atteso('una persona disattivata: P0002', codice($$select segna_sollecito(pz(74))$$), 'P0002');
reset role;
select atteso('i solleciti di Sofia: due, e quello con il link ha il suo link_id', (select count(*)::text || ' · ' || count(*) filter (where link_id = lnk(71))::text from solleciti where persona_id = pz(71)), '2 · 1');
select atteso('i rifiuti non hanno scritto solleciti di altre persone', (select count(*)::text from solleciti where persona_id in (pz(73), pz(74))), '0');
update solleciti set creato_il = now() - interval '5 days' where link_id = lnk(71);
-- Il link è stato aperto 7 giorni fa, cioè prima del sollecito con il link: quella apertura non conta.
update link_certificato set aperto_il = now() - interval '7 days' where id = lnk(71);
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('solleciti_di: dal più recente; il link c''è, aperto prima del sollecito: aperto_il vuoto',
  (select string_agg(canale || '/' || con_link || '/' || (aperto_il is not null) || '/' || split_part(da, ' ', 1), ' ; ') from solleciti_di(pz(71))), 'whatsapp/true/false/Anna ; whatsapp/false/false/Anna');
reset role;
update link_certificato set aperto_il = now() - interval '2 days' where id = lnk(71);
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('aperto dopo il sollecito: aperto_il c''è',
  (select string_agg(con_link || '/' || (aperto_il is not null), ' ; ') from solleciti_di(pz(71))), 'true/true ; false/false');
select atteso('e dice quando', (select rel(aperto_il::date) from solleciti_di(pz(71)) limit 1), '-2');
select atteso('di una persona senza solleciti: niente', (select count(*)::text from solleciti_di(pz(73))), '0');
reset role;
