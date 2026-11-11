-- Il certificato portato dopo (141-certificato-dopo.sql): chi si iscrive senza
-- certificato ha un termine, e ogni regola che lo tocca.
--   • `impostazioni.certificato_giorni` (1–120, 30), letto da `anon` solo
--     attraverso `iscrizioni_regole()`;
--   • `richieste_iscrizione.certificato_dopo`, scritta da `invia_iscrizione`;
--   • all'accoglimento: `schede_iscritti.certificato_entro` = oggi + giorni (solo
--     da 6 anni, solo con la scelta «non ce l'ho ancora», solo senza un certificato valido);
--   • conferma, `salva_certificato` o una data valida a mano azzerano il termine;
--     il rifiuto no; un file mandato nemmeno;
--   • `certificato_termine` e `certificato_non_arrivato`: interne, nessuno le chiama;
--   • `cambia_termine_certificato`: la proroga, solo segreteria, da oggi a 120 giorni;
--   • `iscritto_scheda` dà `certificato_entro`; `certificati_con_pin` dice al tablet
--     solo chi ha passato il termine.
-- Le date sono tutte relative a oggi: niente date che fra un mese non direbbero più niente.
-- Le metà in prova: scripts/prova-certificato-dopo.mjs.
-- Si lancia dopo tablet.sql (che dà la segreteria, il tablet della Lotta, il PIN 4321 e la lezione fra 5 minuti).
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
-- Un rifiuto vero: una funzione che non c'è ancora non è un permesso negato.
create or replace function rifiutata(sql text) returns text language plpgsql as $$
declare r text;
begin
  r := tenta(sql);
  return case when r like 'NEGATO:%' and r not like '%does not exist%' then 'rifiutata' else r end;
end $$;
-- Il codice dell'errore, per i 22023 della proroga.
create or replace function codice(sql text) returns text language plpgsql as $$
begin execute sql; return 'ok';
exception when others then return sqlstate;
end $$;
create or replace function oggi() returns date language sql stable as $$ select (now() at time zone 'Europe/Rome')::date $$;
-- Una data come scarto da oggi (30 = fra 30 giorni, -1 = ieri): così la prova non ha date fisse.
create or replace function rel(d date) returns text language sql stable as $$ select coalesce((d - oggi())::text, '-') $$;
create or replace function pz(n int) returns uuid language sql immutable as $$
  select ('f2000000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;
create or replace function fl(n int, nome text) returns text language sql immutable as $$ select pz(n)::text || '/' || nome $$;
-- Il termine scritto di una persona, come scarto da oggi.
create or replace function entro(n int) returns text language sql stable as $$
  select coalesce((select rel(certificato_entro) from schede_iscritti where persona_id = pz(n)), '-')
$$;
-- Il termine effettivo e «non arrivato», le funzioni interne (le chiama il database, non un ruolo).
create or replace function termine(n int) returns text language sql stable as $$ select rel(certificato_termine(pz(n))) $$;
create or replace function nonarr(n int) returns text language sql stable as $$ select certificato_non_arrivato(pz(n))::text $$;
create or replace function cf_prova(nome text, cognome text, nato date, donna boolean default false)
  returns text language sql stable security definer set search_path = public as $$
  select x || cf_controllo(x) from (
    select cf_lettere(nome, cognome) || to_char(nato, 'YY') || substr('ABCDEHLMPRST', extract(month from nato)::int, 1)
           || lpad((extract(day from nato)::int + case when donna then 40 else 0 end)::text, 2, '0') || 'L219' as x) q
$$;
create or replace function dal_modulo(nome text, cognome text, anni int, email text, cambi jsonb default '{}')
  returns jsonb language sql stable as $$
  select jsonb_build_object(
    'nome', nome, 'cognome', cognome, 'nato_il', (current_date - make_interval(years => anni))::date, 'nato_a', 'Torino',
    'codice_fiscale', cf_prova(nome, cognome, (current_date - make_interval(years => anni))::date),
    'indirizzo', 'Via Roma 1', 'cap', '10093', 'comune', 'Collegno', 'email', email, 'telefono', '347 111 2233',
    'corsi', jsonb_build_array('cccccccc-0000-0000-0000-000000000001'::uuid), 'formula', 'annuale', 'regolamento', true
  ) || cambi
$$;
-- Una richiesta scritta direttamente, già con la scelta del certificato: poi la accoglie la segreteria.
create or replace function richiesta(n int, anni int, dopo boolean) returns void language plpgsql as $$
begin
  insert into richieste_iscrizione (id, nome, cognome, nato_il, nato_a, codice_fiscale, indirizzo, cap, comune, email, telefono,
      genitore_nome, genitore_cognome, genitore_codice_fiscale, corsi, formula, certificato_dopo)
  values (pz(n), 'Richiesta', 'Numero' || n, current_date - make_interval(years => anni), 'Torino', 'TSTTST90A01L219' || chr(n + 24), 'via Roma 1', '10093', 'Collegno',
      'r' || n || '@esempio.it', '3331234567',
      case when anni < 18 then 'Laura' end, case when anni < 18 then 'Rossi' end, case when anni < 18 then 'RSSLRA85C41L219X' end,
      array['cccccccc-0000-0000-0000-000000000001'::uuid], 'annuale', dopo);
end $$;
-- Il termine scritto della persona nata dalla richiesta `n`, come scarto da oggi.
create or replace function entro_di_richiesta(n int) returns text language sql stable as $$
  select coalesce((select rel(s.certificato_entro) from richieste_iscrizione r join schede_iscritti s on s.persona_id = r.persona_id where r.id = pz(n)), '-')
$$;
grant execute on function chi(text), tenta(text), atteso(text, text, text), rifiutata(text), codice(text), oggi(), rel(date), pz(int), fl(int, text),
  entro(int), cf_prova(text, text, date, boolean), dal_modulo(text, text, int, text, jsonb) to anon, authenticated;

-- --- chi c'è ----------------------------------------------------------------
-- Da tablet.sql: Anna (segreteria), Maura (istruttrice, PIN 4321), il tablet della Lotta e tre iscritti
-- della Lotta 2 (Ferrari, Fontana, De Luca). Qui: Ivo, con l'accesso, e le persone dei casi.
insert into auth.users (id, email) values ('77777777-7777-7777-7777-777777777777', 'ivo@ods.it');
insert into persone (id, nome, cognome, ruolo, utente_id) values (pz(33), 'Ivo', 'Iscritto', 'iscritto', '77777777-7777-7777-7777-777777777777');
-- `creata_fa`: da quanti giorni è iscritta. Un 6° compleanno «da iscritta» cade dopo, uno di prima no.
create or replace function chiunque(n int, cognome text, nato date, creata_fa int default 0) returns void language plpgsql as $$
begin
  insert into persone (id, nome, cognome, ruolo, creata_il) values (pz(n), 'Prova', cognome, 'iscritto', (oggi() - creata_fa)::timestamp at time zone 'Europe/Rome');
  if nato is not null then insert into anagrafiche (persona_id, nato_il) values (pz(n), nato); end if;
end $$;
select chiunque(21, 'Nuova',        '1990-05-05');
select chiunque(22, 'Rinnovo',      '1990-05-05');
select chiunque(23, 'Rinnovo2',     '1990-05-05');
select chiunque(24, 'Sei24',        (oggi() - interval '6 years 10 days')::date, 20);
select chiunque(25, 'Passato',      (oggi() - interval '6 years 40 days')::date, 60);
select chiunque(26, 'Prima',        (oggi() - interval '6 years 40 days')::date, 10);
select chiunque(27, 'Adulto',       '1990-05-05');
select chiunque(28, 'Piccolo',      (oggi() - interval '4 years')::date);
select chiunque(29, 'Valido',       '1990-05-05');
select chiunque(30, 'Ritardo',      '1990-05-05');
select chiunque(31, 'Lontano',      '1990-05-05');
select chiunque(32, 'Vicino',       '1990-05-05');
select chiunque(34, 'Conferma',     '1990-05-05');
select chiunque(35, 'Salva',        '1990-05-05');
select chiunque(36, 'Rifiuto',      '1990-05-05');
select chiunque(37, 'ADataValida',  '1990-05-05');
select chiunque(38, 'ADataPassata', '1990-05-05');
select chiunque(39, 'Disattiva',    '1990-05-05');
select chiunque(40, 'Febbraio',     '2020-02-29', 0);
select chiunque(46, 'Accorcia',     '1990-05-05');
update persone set attiva = false where id = pz(39);
-- Febbraio è iscritta da prima del 6° compleanno (1 marzo 2026 per chi è nata il 29 febbraio 2020): una data fissa, perché qui conta il calendario.
update persone set creata_il = '2026-01-01' where id = pz(40);
insert into anagrafiche (persona_id, nato_il) values (pz(33), '1990-05-05');
-- Le schede: il termine scritto (`certificato_entro`) e la scadenza del certificato.
insert into schede_iscritti (persona_id, certificato_entro) values
  (pz(21), oggi()), (pz(30), oggi() - 1), (pz(34), oggi() + 10), (pz(35), oggi() + 10), (pz(36), oggi() + 10),
  (pz(37), oggi() + 10), (pz(38), oggi() + 10), (pz(39), oggi() + 10);
insert into schede_iscritti (persona_id, certificato_scade) values (pz(46), oggi() - 10), (pz(22), oggi() - 29), (pz(23), oggi() - 31), (pz(29), oggi() + 100), (pz(33), oggi() - 5);
insert into schede_iscritti (persona_id, certificato_scade, certificato_entro) values (pz(31), oggi() - 29, oggi() + 50), (pz(32), oggi() - 10, oggi() - 5);
-- Dei tre della Lotta: Ferrari ha il certificato, Fontana è nel termine, De Luca niente (e nessuna nascita).
insert into schede_iscritti (persona_id, certificato_scade) values ('aaaaaaaa-0000-0000-0000-000000000003', oggi() + 100);
insert into schede_iscritti (persona_id, certificato_entro) values ('aaaaaaaa-0000-0000-0000-000000000004', oggi() + 5);
insert into iscrizioni (corso_id, persona_id, dal) select 'cccccccc-0000-0000-0000-000000000001', pz(n), current_date - 60 from unnest(array[24, 25, 29, 30]) n;
-- Un file mandato da Conferma e da Rifiuto, in attesa; e quello che Salva carica al posto del certificato.
insert into storage.objects (bucket_id, name) values ('certificati', fl(34, 'attesa-1.pdf')), ('certificati', fl(36, 'attesa-1.pdf')), ('certificati', fl(35, 'certificato-7.pdf'));
update schede_iscritti set certificato_in_attesa = persona_id || '/attesa-1.pdf', certificato_in_attesa_il = now() where persona_id in (pz(34), pz(36));

\echo ''
\echo '--- 1. il termine di ognuno, e chi non ha portato il certificato ---'
select atteso('scritto all''accoglimento: oggi è l''ultimo giorno, ancora nel termine', termine(21) || ' · ' || nonarr(21), '0 · false');
select atteso('il giorno dopo il termine: non arrivato', termine(30) || ' · ' || nonarr(30), '-1 · true');
select atteso('rinnovo scaduto da 29 giorni: il termine è domani, nel termine', termine(22) || ' · ' || nonarr(22), '1 · false');
select atteso('rinnovo scaduto da 31 giorni: il termine è ieri, non arrivato', termine(23) || ' · ' || nonarr(23), '-1 · true');
select atteso('compie 6 anni da iscritta, 10 giorni fa: compleanno + 30 giorni, nel termine', termine(24) || ' · ' || nonarr(24), '20 · false');
select atteso('compie 6 anni da iscritta, 40 giorni fa: il termine è passato', termine(25) || ' · ' || nonarr(25), '-10 · true');
select atteso('6 anni compiuti prima di iscriversi: nessun termine dal compleanno, e non è arrivato', termine(26) || ' · ' || nonarr(26), '- · true');
select atteso('un adulto senza termine scritto e senza certificato: nessun termine, non arrivato', termine(27) || ' · ' || nonarr(27), '- · true');
select atteso('sotto i 6 anni il certificato non serve: mai non arrivato', nonarr(28), 'false');
select atteso('un certificato valido: non è arrivato mai', nonarr(29), 'false');
select atteso('il più lontano: il termine scritto batte la scadenza + giorni', termine(31) || ' · ' || nonarr(31), '50 · false');
select atteso('il più lontano: la scadenza + giorni batte il termine scritto già passato', termine(32) || ' · ' || nonarr(32), '20 · false');
select atteso('il 29 febbraio compie gli anni il 1 marzo: 31 marzo 2026', certificato_termine(pz(40))::text, '2026-03-31');
select atteso('una persona che non c''è: nessun termine', rel(certificato_termine(gen_random_uuid())), '-');

\echo ''
\echo '--- 2. chi può chiamare cosa ---'
select chi('');
set role anon;
select atteso('anon legge i giorni da iscrizioni_regole()', (iscrizioni_regole() ->> 'certificato_giorni'), '30');
select atteso('anon non legge impostazioni', rifiutata($$select count(*)::text from impostazioni$$), 'rifiutata');
select atteso('anon non chiama certificato_termine', rifiutata($$select certificato_termine(pz(21))::text$$), 'rifiutata');
select atteso('anon non chiama certificato_non_arrivato', rifiutata($$select certificato_non_arrivato(pz(21))::text$$), 'rifiutata');
select atteso('anon non chiama invia_iscrizione_0 (la vecchia, avvolta)', rifiutata($$select invia_iscrizione_0('{}'::jsonb)::text$$), 'rifiutata');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('nemmeno la segreteria chiama certificato_termine', rifiutata($$select certificato_termine(pz(21))::text$$), 'rifiutata');
select atteso('né certificato_non_arrivato', rifiutata($$select certificato_non_arrivato(pz(21))::text$$), 'rifiutata');
select atteso('né invia_iscrizione_0', rifiutata($$select invia_iscrizione_0('{}'::jsonb)::text$$), 'rifiutata');
-- La segreteria può aggiornare la scheda via API: il termine scritto a mano ha lo stesso limite della proroga.
select atteso('scritto a mano fra 200 giorni: no', codice($$update schede_iscritti set certificato_entro = (now() at time zone 'Europe/Rome')::date + 200 where persona_id = pz(21)$$), '22023');
select atteso('iscrizioni_regole() dà il numero anche a chi ha l''accesso', (iscrizioni_regole() ->> 'certificato_giorni'), '30');
reset role;

\echo ''
\echo '--- 3. i giorni: da 1 a 120 ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria li legge: 30', (select certificato_giorni::text from impostazioni), '30');
select atteso('0 non si salva', tenta($$update impostazioni set certificato_giorni = 0$$), 'NEGATO: new row for relation "impostazioni" violates check constraint…');
select atteso('121 non si salva', tenta($$update impostazioni set certificato_giorni = 121$$), 'NEGATO: new row for relation "impostazioni" violates check constraint…');
select atteso('120 sì', tenta($$update impostazioni set certificato_giorni = 120$$), 'FATTO (1 righe)');
select atteso('1 sì', tenta($$update impostazioni set certificato_giorni = 1$$), 'FATTO (1 righe)');
select atteso('e torna a 30', tenta($$update impostazioni set certificato_giorni = 30$$), 'FATTO (1 righe)');
reset role;

\echo ''
\echo '--- 4. l''iscrizione dal modulo: la scelta «non ce l''ho ancora» ---'
select chi('');
set role anon;
select atteso('con certificato_dopo la richiesta parte', tenta($$select (invia_iscrizione(dal_modulo('Dina', 'Dopo', 30, 'dina@esempio.it', '{"certificato_dopo": true}')) is not null)::text$$), 'true');
select atteso('senza la scelta parte lo stesso', tenta($$select (invia_iscrizione(dal_modulo('Dino', 'Subito', 30, 'dino@esempio.it')) is not null)::text$$), 'true');
reset role;
select atteso('Dina: la colonna è vera', (select certificato_dopo::text from richieste_iscrizione where nome = 'Dina'), 'true');
select atteso('Dino: resta falsa', (select certificato_dopo::text from richieste_iscrizione where nome = 'Dino'), 'false');

\echo ''
\echo '--- 5. l''accoglimento scrive il termine (30 giorni) ---'
select richiesta(41, 30, true);   -- adulto, «non ce l'ho ancora»
select richiesta(42, 4, true);    -- sotto i 6 anni
select richiesta(43, 30, false);  -- adulto, ha il certificato (lo carica col modulo)
select richiesta(44, 30, true);   -- adulto, «non ce l'ho ancora», ma ha già un certificato valido sulla scheda
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('accolta con «non ce l''ho ancora»', tenta($$select (accogli_iscrizione(pz(41)) is not null)::text$$), 'true');
select atteso('sotto i 6 anni: accolta', tenta($$select (accogli_iscrizione(pz(42)) is not null)::text$$), 'true');
select atteso('senza la scelta: accolta', tenta($$select (accogli_iscrizione(pz(43)) is not null)::text$$), 'true');
select atteso('con un certificato valido già sulla scheda: accolta', tenta($$select (accogli_iscrizione(pz(44), pz(29)) is not null)::text$$), 'true');
reset role;
select atteso('l''adulto ha 30 giorni da oggi, e nessuna traccia di chi l''ha spostato', entro_di_richiesta(41) || ' · ' ||
  (select coalesce(s.certificato_entro_da::text, '-') || ' · ' || coalesce(s.certificato_entro_il::text, '-') from richieste_iscrizione r join schede_iscritti s on s.persona_id = r.persona_id where r.id = pz(41)), '30 · - · -');
select atteso('sotto i 6 anni: nessun termine scritto', entro_di_richiesta(42), '-');
select atteso('senza «certificato_dopo»: nessun termine scritto', entro_di_richiesta(43), '-');
select atteso('con un certificato valido: nessun termine', entro(29), '-');

\echo ''
\echo '--- 6. i giorni cambiano: chi era accolto resta, il rinnovo e le nuove accolte seguono ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria li porta a 45', tenta($$update impostazioni set certificato_giorni = 45$$), 'FATTO (1 righe)');
reset role;
select atteso('l''accolto a 30 resta a 30', entro_di_richiesta(41) || ' · ' || termine(21), '30 · 0');
select atteso('il rinnovo (calcolato) usa 45: scaduto 29 giorni fa, il termine è fra 16', termine(22), '16');
select richiesta(45, 30, true);
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('una nuova accolta', tenta($$select (accogli_iscrizione(pz(45)) is not null)::text$$), 'true');
set role anon;
select atteso('anon vede 45', (iscrizioni_regole() ->> 'certificato_giorni'), '45');
reset role;
select atteso('la nuova accolta usa 45', entro_di_richiesta(45), '45');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('si torna a 30', tenta($$update impostazioni set certificato_giorni = 30$$), 'FATTO (1 righe)');
reset role;

\echo ''
\echo '--- 7. conferma, salvataggio o data valida azzerano il termine; il rifiuto no ---'
select atteso('prima: Conferma ha il termine e un file in attesa', entro(34) || ' · ' || (select (certificato_in_attesa_il is not null)::text from schede_iscritti where persona_id = pz(34)), '10 · true');
select atteso('un file mandato non cambia il termine: Rifiuto ha ancora 10', entro(36), '10');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria conferma con la scadenza', tenta(format($$select conferma_certificato_iscritto(%L, oggi() + 365)::text$$, pz(34))), '');
select atteso('la segreteria rifiuta l''altro', tenta(format($$select rifiuta_certificato_iscritto(%L)::text$$, pz(36))), '');
select atteso('la segreteria salva un certificato per Salva', tenta(format($$select salva_certificato(%L, %L, oggi() + 365)::text$$, pz(35), fl(35, 'certificato-7.pdf'))), '');
reset role;
select atteso('conferma: il termine è vuoto, con la sua traccia', entro(34) || ' · ' ||
  (select coalesce(certificato_entro_da::text, '-') || ' · ' || coalesce(certificato_entro_il::text, '-') from schede_iscritti where persona_id = pz(34)), '- · - · -');
select atteso('conferma: il certificato è valido, non è arrivato mai', nonarr(34), 'false');
select atteso('salva_certificato: il termine è vuoto', entro(35), '-');
select atteso('rifiuto: il termine resta', entro(36), '10');
select atteso('rifiuto: e il file in attesa se ne va', (select (certificato_in_attesa is null)::text from schede_iscritti where persona_id = pz(36)), 'true');
update schede_iscritti set certificato_scade = oggi() + 200 where persona_id = pz(37);
select atteso('una data valida scritta a mano azzera il termine', entro(37), '-');
update schede_iscritti set certificato_scade = oggi() - 3 where persona_id = pz(38);
select atteso('una data già passata no: il termine resta', entro(38), '10');

\echo ''
\echo '--- 8. la proroga: cambia_termine_certificato ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria sposta il termine di Nuova a fra 10 giorni', tenta($$select cambia_termine_certificato(pz(21), oggi() + 10)::text$$), '');
reset role;
select atteso('il termine è fra 10 giorni', entro(21), '10');
select atteso('con la traccia: chi (Anna) e quando (adesso)', (select (certificato_entro_da = 'aaaaaaaa-0000-0000-0000-000000000001')::text || ' · ' || (certificato_entro_il > now() - interval '1 minute')::text
  from schede_iscritti where persona_id = pz(21)), 'true · true');
select atteso('e dopo la proroga è nel termine', nonarr(21), 'false');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('oggi si può', codice($$select cambia_termine_certificato(pz(21), oggi())$$), 'ok');
select atteso('fra 120 giorni si può', codice($$select cambia_termine_certificato(pz(21), oggi() + 120)$$), 'ok');
select atteso('fra 121 giorni no: 22023', codice($$select cambia_termine_certificato(pz(21), oggi() + 121)$$), '22023');
select atteso('ieri no: 22023', codice($$select cambia_termine_certificato(pz(21), oggi() - 1)$$), '22023');
select atteso('il messaggio dice cosa fare', tenta($$select cambia_termine_certificato(pz(21), oggi() + 121)::text$$), 'NEGATO: La data va da oggi a 120 giorni da oggi.');
select atteso('una persona disattivata no', rifiutata($$select cambia_termine_certificato(pz(39), oggi() + 5)::text$$), 'rifiutata');
reset role;
select atteso('un rifiuto non sposta niente: il termine è ancora quello di fra 120 giorni', entro(21), '120');
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('l''istruttrice no', rifiutata($$select cambia_termine_certificato(pz(21), oggi() + 5)::text$$), 'rifiutata');
reset role;
select chi('77777777-7777-7777-7777-777777777777');
set role authenticated;
select atteso('l''iscritto no, nemmeno il suo', rifiutata($$select cambia_termine_certificato(pz(33), oggi() + 5)::text$$), 'rifiutata');
reset role;
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('il tablet no', rifiutata($$select cambia_termine_certificato(pz(21), oggi() + 5)::text$$), 'rifiutata');
reset role;
select chi('');
set role anon;
select atteso('anon no', rifiutata($$select cambia_termine_certificato(pz(21), oggi() + 5)::text$$), 'rifiutata');
reset role;
select atteso('dopo tutti i rifiuti il termine è ancora fra 120 giorni', entro(21), '120');
-- La data messa a mano vale così com'è (deciso il 2026-11-11), anche se accorcia: qui il rinnovo calcolato è fra 20 giorni.
select atteso('Accorcia: il rinnovo calcolato è fra 20 giorni', termine(46), '20');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria lo porta a fra 5 giorni', codice($$select cambia_termine_certificato(pz(46), oggi() + 5)$$), 'ok');
reset role;
select atteso('vale la data a mano, anche più vicina del rinnovo', termine(46), '5');
select atteso('e l''iscritto vede quella', (select rel(certificato_entro) from iscritto_scheda_di(pz(46))), '5');

\echo ''
\echo '--- 9. l''iscritto vede il suo termine (anche quello calcolato dal rinnovo) ---'
select chi('77777777-7777-7777-7777-777777777777');
set role authenticated;
select atteso('Ivo: scaduto da 5 giorni, senza termine scritto: il termine è fra 25 giorni', (select rel(s.certificato_entro) from iscritto_scheda(pz(33)) s), '25');
select atteso('e la scadenza resta quella', (select rel(s.certificato_scade) from iscritto_scheda(pz(33)) s), '-5');
select atteso('iscritto_nucleo dà lo stesso termine', (select rel(s.certificato_entro) from iscritto_nucleo(pz(33)) s where s.id = pz(33)), '25');
select atteso('la scheda di un altro: niente', (select count(*)::text from iscritto_scheda(pz(21))), '0');
select atteso('il nucleo di un altro: niente', (select count(*)::text from iscritto_nucleo(pz(21))), '0');
reset role;

\echo ''
\echo '--- 10. il tablet sa solo chi ha passato il termine ---'
-- La lezione di tablet.sql, fra 5 minuti: Ferrari valida, Fontana nel termine, De Luca senza niente;
-- Sei24 nel termine, Passato oltre, Valido valida, Ritardo oltre.
-- tablet.sql finisce con il tablet bloccato da cinque PIN sbagliati: qui si riparte da zero.
delete from tentativi_pin;
-- Le persone accolte nella sezione 5 sono finite anche loro nella Lotta 2: fuori, qui contano solo quelle dei casi.
delete from iscrizioni where persona_id in (select persona_id from richieste_iscrizione where id in (pz(41), pz(42), pz(43), pz(45)));
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
-- Il tablet non legge `persone`: si contano gli id. Sono De Luca (…05), Passato (25), Ritardo (30).
select atteso('chi ha passato il termine, o non ha né termine né certificato: De Luca, Passato, Ritardo, e nessun altro',
  (select count(*)::text || ' · ' || count(*) filter (where c.persona_id in ('aaaaaaaa-0000-0000-0000-000000000005', pz(25), pz(30)))::text
     from certificati_con_pin('4321', 'eeeeeeee-0000-0000-0000-000000000001') c), '3 · 3');
select atteso('mai chi è nel termine (Fontana, Sei24) o valido (Ferrari, Valido)',
  (select count(*)::text from certificati_con_pin('4321', 'eeeeeeee-0000-0000-0000-000000000001') c
     where c.persona_id in ('aaaaaaaa-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000003', pz(24), pz(29))), '0');
select atteso('una sola colonna: nessuna data', (select string_agg(a.attname, ',') from pg_proc f, unnest(f.proargnames) a(attname)
  where f.proname = 'certificati_con_pin' and a.attname not in ('pin', 'sessione')), 'persona_id');
select atteso('PIN sbagliato: niente', (select count(*)::text from certificati_con_pin('0000', 'eeeeeeee-0000-0000-0000-000000000001')), '0');
reset role;
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('l''istruttrice dal suo telefono non lo chiama (solo il tablet)',
  (rifiutata($$select count(*)::text from certificati_con_pin('4321', 'eeeeeeee-0000-0000-0000-000000000001')$$) in ('rifiutata', '0'))::text, 'true');
reset role;
select chi('');
set role anon;
select atteso('anon non lo chiama', rifiutata($$select count(*)::text from certificati_con_pin('4321', 'eeeeeeee-0000-0000-0000-000000000001')$$), 'rifiutata');
reset role;
