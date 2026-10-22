-- La ricevuta per email (76-ricevute-email.sql): fatta la ricevuta, la
-- famiglia la riceve in PDF all'EMAIL DI CONTATTO della persona della
-- ricevuta, mai all'email di accesso. L'indirizzo lo sceglie il database, il
-- browser non lo manda mai. Gli stessi casi, lato app, in
-- scripts/prova-ricevute-email.mjs.
--
-- I nomi che il file SQL deve avere:
--   • tabella `invii_ricevute`: una riga per tentativo, mai cambiata né cancellata.
--       id uuid · ricevuta_id uuid (ricevute) · indirizzo citext not null
--       · esito text ('mandata' | 'non partita') · motivo text (al più 200 lettere)
--       · creato_il timestamptz default now() · creato_da uuid (persone)
--       · pdf_sha256 text (l'impronta del PDF allegato, 64 cifre esadecimali)
--     La legge solo la segreteria (`e_staff()`); nessuno la scrive a mano.
--   • `impostazioni.ricevute_email_dal timestamptz`: da quando le ricevute si
--     mandano. Una ricevuta fatta prima e mai mandata è «Fatta prima dell'invio
--     per email». La mette il file una volta sola.
--   • `indirizzo_ricevuta(ricevuta uuid) returns text`: l'email di contatto
--     della persona della ricevuta, o NULL. Solo per `service_role` (la Edge
--     Function): né la segreteria né l'amministrazione la chiamano dal browser.
--   • `controlla_invio_ricevuta(ricevuta uuid) returns jsonb`: la chiama la Edge
--     Function col token di chi preme. Segreteria o amministrazione, se no
--     «la ricevuta la manda la segreteria»; annullata: «La ricevuta è
--     annullata: non si manda» (errcode 55000); la stessa ricevuta già
--     «mandata» 3 volte nelle ultime 24 ore: «Questa ricevuta è già partita 3
--     volte nelle ultime 24 ore» (errcode 54000). Dà numero, anno, data,
--     totale, nome, cognome, ha_indirizzo, mandate_oggi (le «mandata» di oggi,
--     giorno di Europe/Rome, di tutte le ricevute), oltre_soglia
--     (mandate_oggi >= 400), segreteria e persona (`persona_corrente()`, chi
--     preme). Mai l'indirizzo.
--   • `registra_invio_ricevuta(ricevuta uuid, esito text, motivo text, da uuid, indirizzo citext, pdf_sha256 text) returns void`:
--     solo `service_role` (la Edge Function, dopo aver mandato): né la
--     segreteria né l'amministrazione la chiamano dal browser, se no
--     scriverebbero «mandata» finte. L'indirizzo è quello a cui è partita (se
--     manca, quello della scheda); chi l'ha fatto è `da`. Una «mandata» resta
--     anche se nel frattempo la ricevuta è stata annullata o il contatto tolto:
--     la mail è partita.
--   • `esiti_invio_ricevuta(ricevuta uuid) returns table (creato_il timestamptz, esito text)`:
--     quello che vede l'amministrazione in PAGAMENTI › IL PAGAMENTO, senza
--     indirizzo né motivo. Segreteria o amministrazione.
-- Nessuna di quelle che il browser può chiamare ha un argomento per l'indirizzo.
-- Si lancia dopo finto-supabase.sql e i file dello schema.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'ada@ods.it'),
  ('55555555-5555-5555-5555-555555555555', 'maura@ods.it'),
  ('66666666-6666-6666-6666-666666666666', 'tablet@sale.ods-corsi.it'),
  ('77777777-7777-7777-7777-777777777777', 'luca@ods.it');
-- Anna: segreteria. Ada: solo amministrazione. Maura: istruttrice. Luca: iscritto con l'accesso.
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Ada', 'Conti', 'amministrazione', 'ada@ods.it', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'Maura', 'Uno', 'istruttore', 'maura@ods.it', '55555555-5555-5555-5555-555555555555'),
  ('aaaaaaaa-0000-0000-0000-000000000007', 'Luca', 'Rossi', 'iscritto', 'luca@ods.it', '77777777-7777-7777-7777-777777777777');
insert into sale (id, nome) values ('bbbbbbbb-0000-0000-0000-000000000001', 'Tatami');
insert into postazioni (id, nome, sala_id, utente_id) values
  ('dddddddd-0000-0000-0000-000000000001', 'Tablet sala grande', 'bbbbbbbb-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666666');
-- Chi riceve: Sara, adulta, con la sua email; Marco, minore, con quella della
-- mamma (la stessa del genitore: gli iscritti possono dividerla); Teo con la
-- sua; Pia senza niente.
insert into persone (id, nome, cognome, ruolo, email) values
  ('aaaaaaaa-0000-0000-0000-000000000010', 'Sara', 'Bianchi', 'iscritto', 'sara.bianchi@esempio.it'),
  ('aaaaaaaa-0000-0000-0000-000000000011', 'Marco', 'Rossi', 'iscritto', 'mamma@esempio.it'),
  ('aaaaaaaa-0000-0000-0000-000000000012', 'Teo', 'Verdi', 'iscritto', 'teo@esempio.it'),
  ('aaaaaaaa-0000-0000-0000-000000000013', 'Pia', 'Neri', 'iscritto', null);

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
-- Il codice dell'errore, quello che la Edge Function guarda.
create or replace function codice_di(sql text) returns text language plpgsql as $$
begin execute sql; return 'nessuno';
exception when others then return sqlstate;
end $$;
-- Una ricevuta per una persona, dalla funzione vera. Il numero lo prende da sé, in ordine: a mano solo in un anno senza ricevute (93).
create or replace function ricevuta(persona text, nome text, cognome text, numero int) returns jsonb language sql as $$
  select jsonb_build_object(
    'data', '2026-10-21', 'persona_id', persona,
    'ente', jsonb_build_object('nome', 'Asd Il Centro Judo'),
    'intestatario', jsonb_build_object('nome', nome, 'cognome', cognome, 'codiceFiscale', 'LBRMNL14H53L219X'),
    'voci', jsonb_build_array(jsonb_build_object('descrizione', 'QUOTA ASSOCIATIVA', 'quantita', 1, 'prezzo', 3000,
      'pagamenti', jsonb_build_array(jsonb_build_object('data', '2026-10-21', 'importo', 3000, 'metodo', 'Bonifico')))),
    'anticipo', 0)
$$;
-- L'id della ricevuta col suo numero.
create or replace function r(n int) returns uuid language sql security definer as $$ select id from ricevute where anno = 2026 and numero = n $$;
-- Quanti indirizzi legge chi è collegato: «non li legge» sia negato sia a vuoto.
create or replace function indirizzi_letti() returns text language plpgsql as $$
declare n int;
begin
  select count(*) into n from invii_ricevute where indirizzo is not null;
  return case when n = 0 then 'non li legge' else 'ne legge ' || n end;
exception when insufficient_privilege then return 'non li legge';
end $$;
grant execute on function tenta(text), codice_di(text), atteso(text, text, text), chi(text), ricevuta(text, text, text, int), r(int), indirizzi_letti() to anon, authenticated, service_role;

-- Le ricevute le fa Anna: 1 Sara, 2 Marco, 3 Teo, 4 Pia, 5 Sara (poi annullata), 6 Sara, 7 Sara.
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select emetti_ricevuta(ricevuta('aaaaaaaa-0000-0000-0000-000000000010', 'Sara', 'Bianchi', 1));
select emetti_ricevuta(ricevuta('aaaaaaaa-0000-0000-0000-000000000011', 'Marco', 'Rossi', 2));
select emetti_ricevuta(ricevuta('aaaaaaaa-0000-0000-0000-000000000012', 'Teo', 'Verdi', 3));
select emetti_ricevuta(ricevuta('aaaaaaaa-0000-0000-0000-000000000013', 'Pia', 'Neri', 4));
select emetti_ricevuta(ricevuta('aaaaaaaa-0000-0000-0000-000000000010', 'Sara', 'Bianchi', 5));
select emetti_ricevuta(ricevuta('aaaaaaaa-0000-0000-0000-000000000010', 'Sara', 'Bianchi', 6));
select emetti_ricevuta(ricevuta('aaaaaaaa-0000-0000-0000-000000000010', 'Sara', 'Bianchi', 7));
select annulla_ricevuta(r(5));
reset role;

\echo ''
\echo '--- 1. l''indirizzo lo sceglie il database: l''email della scheda ---'
set role service_role;
select atteso('adulta: la sua email', indirizzo_ricevuta(r(1)), 'sara.bianchi@esempio.it');
select atteso('minore: l''email della scheda, quella del genitore', indirizzo_ricevuta(r(2)), 'mamma@esempio.it');
select atteso('con la sua email', indirizzo_ricevuta(r(3)), 'teo@esempio.it');
select atteso('senza niente: niente', coalesce(indirizzo_ricevuta(r(4)), 'NULL'), 'NULL');
select atteso('una ricevuta che non c''è: niente', coalesce(indirizzo_ricevuta(gen_random_uuid()), 'NULL'), 'NULL');
reset role;
update persone set email = 'sara.nuova@esempio.it' where id = 'aaaaaaaa-0000-0000-0000-000000000010';
set role service_role;
select atteso('l''email cambiata in scheda vale da subito', indirizzo_ricevuta(r(1)), 'sara.nuova@esempio.it');
reset role;
update persone set email = 'sara.bianchi@esempio.it' where id = 'aaaaaaaa-0000-0000-0000-000000000010';
select atteso('nessuna funzione che il browser chiama prende un indirizzo',
  (select count(*)::text from pg_proc
    where proname in ('indirizzo_ricevuta', 'controlla_invio_ricevuta', 'registra_invio_ricevuta', 'esiti_invio_ricevuta')
      and (has_function_privilege('authenticated', oid, 'execute') or has_function_privilege('anon', oid, 'execute'))
      and exists (select 1 from unnest(coalesce(proargnames, '{}')) a where a ~* 'indirizzo|email|a_chi')), '0');
select atteso('registra_invio_ricevuta: una sola, e solo per il server',
  (select string_agg(pg_get_function_identity_arguments(oid) || ' ' || has_function_privilege('authenticated', oid, 'execute')::text
     || ' ' || has_function_privilege('service_role', oid, 'execute')::text, ' / ') from pg_proc where proname = 'registra_invio_ricevuta'),
  'ricevuta uuid, esito text, motivo text, da uuid, indirizzo citext, pdf_sha256 text false true');
select atteso('indirizzo_ricevuta prende solo la ricevuta',
  (select string_agg(pg_get_function_identity_arguments(oid), ' / ') from pg_proc where proname = 'indirizzo_ricevuta'), 'ricevuta uuid');

\echo ''
\echo '--- 2. fare una ricevuta non manda niente da sé ---'
select atteso('dopo sei ricevute, nessun invio', (select count(*)::text from invii_ricevute), '0');
select atteso('da quando si mandano: lo dice il database', (select (ricevute_email_dal is not null and ricevute_email_dal <= now())::text from impostazioni), 'true');

\echo ''
\echo '--- 3. la segreteria controlla, registra e legge ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('i dati per la mail', (select c->>'numero' || '/' || (c->>'anno') || ' ' || (c->>'nome') || ' ' || (c->>'cognome') || ' ' || (c->>'totale') || ' ' || (c->>'data')
  from controlla_invio_ricevuta(r(2)) c), '2/2026 Marco Rossi 3000 2026-10-21');
select atteso('dice che l''indirizzo c''è', (controlla_invio_ricevuta(r(1))->>'ha_indirizzo'), 'true');
select atteso('ma non lo dà', (controlla_invio_ricevuta(r(1)) ? 'indirizzo')::text || '/' || (controlla_invio_ricevuta(r(1))::text like '%@%')::text, 'false/false');
select atteso('senza email: non c''è', (controlla_invio_ricevuta(r(4))->>'ha_indirizzo'), 'false');
select atteso('annullata: non si manda', tenta($$select controlla_invio_ricevuta(r(5))::text$$), 'NEGATO: La ricevuta è annullata: non si manda');
select atteso('una che non c''è', tenta($$select controlla_invio_ricevuta(gen_random_uuid())::text$$), 'NEGATO: ricevuta inesistente');
select atteso('oggi nessuna mail', (controlla_invio_ricevuta(r(1))->>'mandate_oggi') || '/' || (controlla_invio_ricevuta(r(1))->>'oltre_soglia'), '0/false');
select atteso('dice chi preme: Anna', (select nome from persone where id = (controlla_invio_ricevuta(r(1))->>'persona')::uuid), 'Anna');
-- Dal browser una «mandata» finta riempirebbe la soglia e direbbe partita una mail mai partita.
select atteso('dal browser non registra', tenta($$select registra_invio_ricevuta(r(1), 'mandata', null, null, null, null)::text$$), 'NEGATO: permission denied…');
select atteso('nemmeno una non partita', tenta($$select registra_invio_ricevuta(r(1), 'non partita', 'posta', null, null, null)::text$$), 'NEGATO: permission denied…');
reset role;
-- Registra la Edge Function, col client del server: chi ha premuto e l'indirizzo a cui è partita.
set role service_role;
select atteso('registra una mandata', tenta($$select registra_invio_ricevuta(r(1), 'mandata', null, 'aaaaaaaa-0000-0000-0000-000000000001', 'sara.bianchi@esempio.it', repeat('ab', 32))::text$$), '');
reset role;
select atteso('con l''indirizzo usato, chi è Anna e l''impronta del PDF',
  (select i.indirizzo || ' ' || i.esito || ' ' || coalesce(i.motivo, '-') || ' ' || p.nome || ' ' || length(i.pdf_sha256) from invii_ricevute i join persone p on p.id = i.creato_da where i.ricevuta_id = r(1)),
  'sara.bianchi@esempio.it mandata - Anna 64');
set role service_role;
select atteso('un''impronta che non è uno SHA-256 no', tenta($$select registra_invio_ricevuta(r(1), 'mandata', null, null, 'sara.bianchi@esempio.it', 'boh')::text$$), 'NEGATO: …');
select atteso('registra una non partita, col motivo: senza indirizzo, quello della scheda',
  tenta($$select registra_invio_ricevuta(r(2), 'non partita', 'posta', 'aaaaaaaa-0000-0000-0000-000000000001', null, null)::text$$), '');
select atteso('MANDA DI NUOVO: una riga per tentativo', tenta($$select registra_invio_ricevuta(r(2), 'mandata', null, 'aaaaaaaa-0000-0000-0000-000000000001', 'mamma@esempio.it', null)::text$$), '');
reset role;
select atteso('due righe per Marco, in ordine', (select string_agg(esito || ':' || coalesce(motivo, '-'), ',' order by creato_il, esito desc) from invii_ricevute where ricevuta_id = r(2)), 'non partita:posta,mandata:-');
select atteso('il minore: va alla mamma', (select string_agg(distinct indirizzo::text, ',') from invii_ricevute where ricevuta_id = r(2)), 'mamma@esempio.it');
set role service_role;
select atteso('un esito inventato no', tenta($$select registra_invio_ricevuta(r(1), 'letta', null, null, null, null)::text$$), 'NEGATO: …');
select atteso('un motivo lunghissimo no', tenta($$select registra_invio_ricevuta(r(1), 'non partita', repeat('x', 201), null, null, null)::text$$), 'NEGATO: …');
select atteso('senza indirizzo né email in scheda non si registra niente', tenta($$select registra_invio_ricevuta(r(4), 'non partita', 'posta', null, null, null)::text$$), 'NEGATO: Nessuna email di contatto in scheda…');
select atteso('annullata: una non partita no', tenta($$select registra_invio_ricevuta(r(5), 'non partita', 'posta', null, null, null)::text$$), 'NEGATO: La ricevuta è annullata: non si manda');
reset role;
-- La mail partita mentre qualcuno annullava la ricevuta o toglieva il contatto: la riga deve restare.
update persone set email = null where id = 'aaaaaaaa-0000-0000-0000-000000000012';
set role service_role;
select atteso('partita e poi annullata: la «mandata» resta', tenta($$select registra_invio_ricevuta(r(5), 'mandata', null, null, 'sara.bianchi@esempio.it', null)::text$$), '');
select atteso('partita e poi il contatto tolto: resta, con l''indirizzo usato', tenta($$select registra_invio_ricevuta(r(3), 'mandata', null, null, 'teo.vecchio@esempio.it', null)::text$$), '');
reset role;
select atteso('le due righe', (select string_agg(indirizzo::text, ',' order by indirizzo) from invii_ricevute where ricevuta_id in (r(3), r(5))), 'sara.bianchi@esempio.it,teo.vecchio@esempio.it');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria legge gli indirizzi', indirizzi_letti(), 'ne legge 5');
select atteso('e gli esiti, senza indirizzo', (select string_agg(esito, ',' order by creato_il, esito desc) from esiti_invio_ricevuta(r(2))), 'non partita,mandata');
select atteso('non le scrive a mano',
  tenta($$insert into invii_ricevute (ricevuta_id, indirizzo, esito) values (r(6), 'finto@esempio.it', 'mandata')$$), 'NEGATO: …');
select atteso('non le cambia', tenta($$update invii_ricevute set esito = 'mandata'$$), 'NEGATO: …');
select atteso('non le cancella', tenta($$delete from invii_ricevute$$), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 4. l''amministrazione manda, ma l''indirizzo non lo vede mai ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('controlla', (controlla_invio_ricevuta(r(6))->>'ha_indirizzo'), 'true');
select atteso('e dice che preme Ada', (select nome from persone where id = (controlla_invio_ricevuta(r(6))->>'persona')::uuid), 'Ada');
select atteso('ma non registra da sé', tenta($$select registra_invio_ricevuta(r(6), 'mandata', null, null, null, null)::text$$), 'NEGATO: permission denied…');
reset role;
set role service_role;
select registra_invio_ricevuta(r(6), 'mandata', null, 'aaaaaaaa-0000-0000-0000-000000000002', 'sara.bianchi@esempio.it', null);
reset role;
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('non legge la tabella degli invii', indirizzi_letti(), 'non li legge');
select atteso('non chiama indirizzo_ricevuta', tenta($$select indirizzo_ricevuta(r(1))$$), 'NEGATO: …');
select atteso('vede «mandata» con la data', (select string_agg(esito || ' ' || (creato_il::date = current_date)::text, ',') from esiti_invio_ricevuta(r(1))), 'mandata true');
select atteso('e «non partita»', (select string_agg(esito, ',' order by creato_il, esito desc) from esiti_invio_ricevuta(r(2))), 'non partita,mandata');
select atteso('gli esiti non hanno colonne con l''indirizzo né il motivo',
  pg_get_function_result('esiti_invio_ricevuta(uuid)'::regprocedure), 'TABLE(creato_il timestamp with time zone, esito text)');
reset role;
select atteso('la riga di Ada c''è, col suo nome', (select p.nome || ' ' || i.indirizzo from invii_ricevute i join persone p on p.id = i.creato_da where i.ricevuta_id = r(6)), 'Ada sara.bianchi@esempio.it');

\echo ''
\echo '--- 5. la segreteria nemmeno chiama indirizzo_ricevuta: lo fa solo la funzione del server ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('dal browser no', tenta($$select indirizzo_ricevuta(r(1))$$), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 6. istruttore, tablet, iscritto, chi non ha l''accesso: niente ---'
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('l''istruttore non controlla', tenta($$select controlla_invio_ricevuta(r(1))::text$$), 'NEGATO: la ricevuta la manda la segreteria');
select atteso('non registra', tenta($$select registra_invio_ricevuta(r(1), 'mandata', null, null, null, null)::text$$), 'NEGATO: permission denied…');
select atteso('non vede gli esiti', tenta($$select count(*)::text from esiti_invio_ricevuta(r(1))$$), 'NEGATO: la ricevuta la manda la segreteria');
select atteso('non legge gli indirizzi', indirizzi_letti(), 'non li legge');
select atteso('non chiama indirizzo_ricevuta', tenta($$select indirizzo_ricevuta(r(1))$$), 'NEGATO: …');
reset role;
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('il tablet non controlla', tenta($$select controlla_invio_ricevuta(r(1))::text$$), 'NEGATO: la ricevuta la manda la segreteria');
select atteso('non registra', tenta($$select registra_invio_ricevuta(r(1), 'mandata', null, null, null, null)::text$$), 'NEGATO: permission denied…');
select atteso('non legge gli indirizzi', indirizzi_letti(), 'non li legge');
reset role;
select chi('77777777-7777-7777-7777-777777777777');
set role authenticated;
select atteso('l''iscritto non controlla', tenta($$select controlla_invio_ricevuta(r(1))::text$$), 'NEGATO: la ricevuta la manda la segreteria');
select atteso('non registra', tenta($$select registra_invio_ricevuta(r(1), 'mandata', null, null, null, null)::text$$), 'NEGATO: permission denied…');
select atteso('non vede gli esiti', tenta($$select count(*)::text from esiti_invio_ricevuta(r(1))$$), 'NEGATO: la ricevuta la manda la segreteria');
select atteso('non legge gli indirizzi', indirizzi_letti(), 'non li legge');
reset role;
select chi('');
set role anon;
select atteso('anon non controlla', tenta($$select controlla_invio_ricevuta(r(1))::text$$), 'NEGATO: …');
select atteso('non registra', tenta($$select registra_invio_ricevuta(r(1), 'mandata', null, null, null, null)::text$$), 'NEGATO: …');
select atteso('non vede gli esiti', tenta($$select count(*)::text from esiti_invio_ricevuta(r(1))$$), 'NEGATO: …');
select atteso('non legge la tabella', tenta($$select count(*)::text from invii_ricevute$$), 'NEGATO: …');
select atteso('non chiama indirizzo_ricevuta', tenta($$select indirizzo_ricevuta(r(1))$$), 'NEGATO: …');
reset role;
select atteso('nessuno di loro ha lasciato righe', (select count(*)::text from invii_ricevute), '6');

\echo ''
\echo '--- 7. la stessa ricevuta al più 3 volte in 24 ore: un tasto premuto per sbaglio, o un PDF qualsiasi mandato in giro ---'
-- Una di 25 ore fa non conta.
insert into invii_ricevute (ricevuta_id, indirizzo, esito, creato_il) values (r(7), 'sara.bianchi@esempio.it', 'mandata', now() - interval '25 hours');
set role service_role;
select registra_invio_ricevuta(r(7), 'mandata', null, null, 'sara.bianchi@esempio.it', null) from generate_series(1, 2);
select registra_invio_ricevuta(r(7), 'non partita', 'posta', null, 'sara.bianchi@esempio.it', null);
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('due mandate e una non partita: si manda ancora', (controlla_invio_ricevuta(r(7))->>'ha_indirizzo'), 'true');
reset role;
set role service_role;
select registra_invio_ricevuta(r(7), 'mandata', null, null, 'sara.bianchi@esempio.it', null);
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la terza: basta per 24 ore', tenta($$select controlla_invio_ricevuta(r(7))::text$$), 'NEGATO: Questa ricevuta è già partita 3 volte nelle ultime 24 ore');
select atteso('col suo codice, che la Edge Function riconosce senza leggere il testo', codice_di($$select controlla_invio_ricevuta(r(7))$$), '54000');
select atteso('anche l''annullata ha il suo', codice_di($$select controlla_invio_ricevuta(r(5))$$), '55000');
reset role;

\echo ''
\echo '--- 8. la soglia: 400 mail «mandate» oggi, giorno di Europe/Rome ---'
-- Il server di Supabase gira in UTC: il giorno lo deve contare la funzione.
set timezone = 'UTC';
-- Ieri alle 23:30 di Roma (21:30 o 22:30 UTC di ieri): non contano.
insert into invii_ricevute (ricevuta_id, indirizzo, esito, creato_il)
  select r(1), 'sara.bianchi@esempio.it', 'mandata', (date_trunc('day', now() at time zone 'Europe/Rome') - interval '30 minutes') at time zone 'Europe/Rome'
  from generate_series(1, 50);
-- Oggi alle 00:30 di Roma (22:30 o 23:30 UTC di ieri): contano, anche se per il server sono ancora ieri.
insert into invii_ricevute (ricevuta_id, indirizzo, esito, creato_il)
  select r(2), 'mamma@esempio.it', 'mandata', (date_trunc('day', now() at time zone 'Europe/Rome') + interval '30 minutes') at time zone 'Europe/Rome'
  from generate_series(1, 20);
-- Oggi: fino a 399 mandate (quelle delle 00:30 e le altre di oggi ci sono già), e 30 non partite che non contano.
insert into invii_ricevute (ricevuta_id, indirizzo, esito, creato_il)
  select r(1 + g % 2), 'x@esempio.it', 'mandata', greatest(now() - interval '1 minute', date_trunc('day', now() at time zone 'Europe/Rome') at time zone 'Europe/Rome')
  from generate_series(1, 399 - (select count(*)::int from invii_ricevute where esito = 'mandata'
    and creato_il >= date_trunc('day', now() at time zone 'Europe/Rome') at time zone 'Europe/Rome')) g;
insert into invii_ricevute (ricevuta_id, indirizzo, esito, motivo, creato_il)
  select r(1), 'x@esempio.it', 'non partita', 'posta', now() from generate_series(1, 30);
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('399 mandate oggi: si manda ancora', (controlla_invio_ricevuta(r(6))->>'mandate_oggi') || '/' || (controlla_invio_ricevuta(r(6))->>'oltre_soglia'), '399/false');
reset role;
set role service_role;
select registra_invio_ricevuta(r(6), 'mandata', null, null, 'sara.bianchi@esempio.it', null);
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('alla quattrocentesima: basta, per tutte le ricevute', (controlla_invio_ricevuta(r(6))->>'mandate_oggi') || '/' || (controlla_invio_ricevuta(r(6))->>'oltre_soglia'), '400/true');
reset role;
set timezone = 'Europe/Rome';

\echo ''
\echo '--- 9. annullare una ricevuta già mandata non manda niente ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select annulla_ricevuta(r(6));
select atteso('nessuna riga in più', (select count(*)::text from invii_ricevute where ricevuta_id = r(6)), '2');
select atteso('e poi non si manda più', tenta($$select controlla_invio_ricevuta(r(6))::text$$), 'NEGATO: La ricevuta è annullata: non si manda');
reset role;

\echo ''
\echo '--- 10. la persona si cancella: la ricevuta resta, l''indirizzo no ---'
delete from persone where id = 'aaaaaaaa-0000-0000-0000-000000000011';
set role service_role;
select atteso('senza persona nessun indirizzo', coalesce(indirizzo_ricevuta(r(2)), 'NULL'), 'NULL');
reset role;
select atteso('gli invii di prima restano', (select (count(*) > 0)::text from invii_ricevute where ricevuta_id = r(2)), 'true');

\echo ''
\echo '--- 11. rilanciare il file non sposta la data da cui le ricevute si mandano ---'
update impostazioni set ricevute_email_dal = '2026-10-01 09:00+02';
\ir ../76-ricevute-email.sql
select atteso('la data resta quella di prima', (select ricevute_email_dal = '2026-10-01 09:00+02' from impostazioni)::text, 'true');
select atteso('e gli invii restano', (select (count(*) > 400)::text from invii_ricevute), 'true');

\echo ''
\echo 'TUTTO A POSTO'
