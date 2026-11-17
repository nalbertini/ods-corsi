-- Accogliere una richiesta non regala una scheda a chi manda il modulo.
-- Chiunque, senza accesso, può mandare dal modulo il nome e il cognome di un
-- iscritto e la sua email: se `accogli_iscrizione` agganciava la scheda per il
-- solo nome (senza email) e ci scriveva sopra l'email della richiesta,
-- `collega_utente()` legava il suo account a quella scheda e ne vedeva i dati.
-- Ora una scheda si abbina solo con un contatto che torna (la stessa email, o lo
-- stesso telefono) o con una scelta a mano della segreteria; e un'email o un
-- telefono si scrivono su una scheda solo in quei due casi, mai quando è il
-- codice fiscale (che lo sanno in tanti) a farla trovare.
-- Si lancia dopo finto-supabase.sql e i file dello schema
-- (la correzione è `165-accogli-senza-presa-account.sql`).
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email, email_confirmed_at) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it', now()),
  ('22222222-2222-2222-2222-222222222222', 'maura@ods.it', now()),
  ('55555555-5555-5555-5555-555555555555', 'bruno@fam.it', now()),
  ('77777777-7777-7777-7777-777777770001', 'tablet@ods.it', now()),
  -- Chi manda la richiesta con il nome di un altro: ha un account con la sua email confermata.
  ('aaaaaaaa-1111-1111-1111-111111111111', 'attaccante@esempio.it', now());
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Maura', 'Uno', 'istruttore', 'maura@ods.it', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Bruno', 'Solo', 'iscritto', 'bruno@fam.it', '55555555-5555-5555-5555-555555555555');
insert into sale (id, nome) values ('bbbbbbbb-0000-0000-0000-000000000001', 'Lotta');
insert into postazioni (nome, sala_id, utente_id) values ('Tablet', 'bbbbbbbb-0000-0000-0000-000000000001', '77777777-7777-7777-7777-777777770001');
insert into corsi (id, nome) values ('cccccccc-0000-0000-0000-000000000001', 'Judo 2');

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
-- Il codice fiscale giusto per nome e cognome, di chi ha trent'anni oggi (il
-- giorno si sposta con la prova; con altri `anni` è un omonimo con un altro codice). Definer: le funzioni del codice sono della
-- segreteria e del modulo, non di `anon`.
create or replace function cf_di(nome text, cognome text, anni int default 30) returns text
  language sql stable security definer set search_path = public as $$
  select x || cf_controllo(x) from (
    select cf_lettere(nome, cognome) || to_char((current_date - make_interval(years => anni))::date, 'YY')
           || substr('ABCDEHLMPRST', extract(month from (current_date - make_interval(years => anni))::date)::int, 1)
           || lpad(extract(day from (current_date - make_interval(years => anni))::date)::int::text, 2, '0') || 'L219' as x) q
$$;
-- Una richiesta valida di un adulto, come la manda il modulo pubblico.
create or replace function manda(nome text, cognome text, email text, telefono text, anni int default 30) returns uuid language sql as $$
  select invia_iscrizione(jsonb_build_object(
    'nome', nome, 'cognome', cognome, 'nato_il', (current_date - make_interval(years => anni))::date, 'nato_a', 'Torino',
    'codice_fiscale', cf_di(initcap(nome), initcap(cognome), anni), 'indirizzo', 'Via Roma 1', 'cap', '10093', 'comune', 'Collegno',
    'email', email, 'telefono', telefono,
    'corsi', jsonb_build_array('cccccccc-0000-0000-0000-000000000001'), 'formula', 'annuale', 'regolamento', true))
$$;
-- La richiesta di una email, e la scheda a cui è finita. Definer: chi non è la
-- segreteria le richieste non le legge, e la prova deve poterle citare lo stesso.
create or replace function rid(mail text) returns uuid language sql stable security definer set search_path = public as $$
  select id from richieste_iscrizione where email = lower(mail) order by creata_il desc limit 1
$$;
create or replace function scheda_di(mail text) returns uuid language sql stable security definer set search_path = public as $$
  select persona_id from richieste_iscrizione where email = lower(mail) order by creata_il desc limit 1
$$;
grant execute on function tenta(text), atteso(text, text, text), chi(text), cf_di(text, text, int), manda(text, text, text, text, int), rid(text), scheda_di(text) to anon, authenticated;

\echo ''
\echo '--- 1. l''attacco: il nome di un iscritto senza email, l''email di chi scrive ---'
-- Tina è in elenco dall'anno scorso, senza email e con un telefono suo; Gino senza né l'uno né l'altro.
insert into persone (id, nome, cognome, ruolo, telefono) values
  ('aaaaaaaa-0000-0000-0000-000000000010', 'Tina', 'Neri', 'iscritto', '347 100 0001'),
  ('aaaaaaaa-0000-0000-0000-000000000011', 'Gino', 'Neri', 'iscritto', null);
-- Tina ha una ricevuta: è quello che l'attaccante leggerebbe dall'area iscritti.
insert into ricevute (id, anno, numero, data, persona_id, ente, intestatario, voci, totale, pagato, anticipo) values
  ('f1f1f1f1-0000-0000-0000-000000000001', 2026, 901, current_date - 20, 'aaaaaaaa-0000-0000-0000-000000000010', '{"nome":"ODS"}', '{"nome":"Tina","cognome":"Neri"}',
   '[{"descrizione":"QUOTA ASSOCIATIVA","quantita":1,"prezzo":3000,"pagamenti":[]}]', 3000, 3000, 0);
select chi('');
set role anon;
-- Il nome scritto in un altro modo, il telefono diverso.
select atteso('l''attaccante manda la richiesta come Tina', tenta($$select (manda('TINA', 'neri', 'Attaccante@Esempio.it', '320 000 0000') is not null)::text$$), 'true');
select atteso('e un''altra come Gino, che non ha nemmeno il telefono', tenta($$select (manda('gino', 'NERI', 'attaccante2@esempio.it', '320 000 0001') is not null)::text$$), 'true');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria accoglie Tina senza scegliere la scheda', tenta($$select (accogli_iscrizione(rid('attaccante@esempio.it')) is not null)::text$$), 'true');
select atteso('la segreteria accoglie Gino senza scegliere la scheda', tenta($$select (accogli_iscrizione(rid('attaccante2@esempio.it')) is not null)::text$$), 'true');
reset role;
select atteso('Tina: nasce una scheda nuova, la richiesta non punta alla vecchia',
  (scheda_di('attaccante@esempio.it') is not null and scheda_di('attaccante@esempio.it') <> 'aaaaaaaa-0000-0000-0000-000000000010')::text, 'true');
select atteso('la scheda vecchia di Tina resta senza email', (select coalesce(email::text, 'senza email') from persone where id = 'aaaaaaaa-0000-0000-0000-000000000010'), 'senza email');
select atteso('e col suo telefono', (select telefono from persone where id = 'aaaaaaaa-0000-0000-0000-000000000010'), '347 100 0001');
select atteso('due Tina Neri', (select count(*)::text from persone where nome = 'Tina' and cognome = 'Neri'), '2');
select atteso('Gino: nasce una scheda nuova anche se la vecchia non ha il telefono',
  (scheda_di('attaccante2@esempio.it') is not null and scheda_di('attaccante2@esempio.it') <> 'aaaaaaaa-0000-0000-0000-000000000011')::text, 'true');
select atteso('la scheda vecchia di Gino resta senza email e senza telefono',
  (select coalesce(email::text, 'senza email') || ' ' || coalesce(telefono, 'senza telefono') from persone where id = 'aaaaaaaa-0000-0000-0000-000000000011'), 'senza email senza telefono');

-- L'account dell'attaccante, al primo accesso: si lega a una scheda e non vede quella di Tina.
select chi('aaaaaaaa-1111-1111-1111-111111111111');
set role authenticated;
select atteso('al primo accesso si lega alla scheda nuova', tenta($$select (collega_utente() = scheda_di('attaccante@esempio.it'))::text$$), 'true');
select atteso('non vede la scheda di Tina', (select count(*)::text from iscritto_scheda('aaaaaaaa-0000-0000-0000-000000000010')), '0');
select atteso('né le sue ricevute', (select count(*)::text from iscritto_ricevute('aaaaaaaa-0000-0000-0000-000000000010')), '0');
select atteso('né la riga in persone', (select count(*)::text from persone where id = 'aaaaaaaa-0000-0000-0000-000000000010'), '0');
select atteso('vede la sua, la nuova', (select count(*)::text from iscritto_scheda(scheda_di('attaccante@esempio.it'))), '1');
reset role;
select atteso('iscritto_puo_vedere: la scheda di Tina no', iscritto_puo_vedere('aaaaaaaa-0000-0000-0000-000000000010')::text, 'false');
select atteso('la nuova sì', iscritto_puo_vedere(scheda_di('attaccante@esempio.it'))::text, 'true');

\echo ''
\echo '--- 2. la stessa persona: un contatto che torna ---'
insert into persone (id, nome, cognome, ruolo, email, telefono) values
  ('aaaaaaaa-0000-0000-0000-000000000020', 'Elia', 'Verdi', 'iscritto', 'elia@esempio.it', null),
  ('aaaaaaaa-0000-0000-0000-000000000021', 'Fabio', 'Bruni', 'iscritto', null, '+39 347 100 0003'),
  -- Un telefono di otto cifre non basta a dire che è lo stesso.
  ('aaaaaaaa-0000-0000-0000-000000000022', 'Gina', 'Bruni', 'iscritto', null, '1234 5678');
set role anon;
select atteso('Elia manda la sua, con l''email scritta in maiuscolo', tenta($$select (manda('Elia', 'Verdi', 'ELIA@esempio.it', '347 100 0002') is not null)::text$$), 'true');
select atteso('Fabio manda il suo telefono scritto in un altro modo', tenta($$select (manda('Fabio', 'Bruni', 'fabio@esempio.it', '3471000003') is not null)::text$$), 'true');
select atteso('Gina manda un telefono corto uguale al suo', tenta($$select (manda('Gina', 'Bruni', 'gina@esempio.it', '12345678') is not null)::text$$), 'true');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('Elia accolta', tenta($$select (accogli_iscrizione(rid('elia@esempio.it')) is not null)::text$$), 'true');
select atteso('Fabio accolto', tenta($$select (accogli_iscrizione(rid('fabio@esempio.it')) is not null)::text$$), 'true');
select atteso('Gina accolta', tenta($$select (accogli_iscrizione(rid('gina@esempio.it')) is not null)::text$$), 'true');
reset role;
select atteso('stessa email: la stessa scheda', (scheda_di('elia@esempio.it') = 'aaaaaaaa-0000-0000-0000-000000000020')::text, 'true');
select atteso('e il telefono vuoto si riempie', (select telefono from persone where id = 'aaaaaaaa-0000-0000-0000-000000000020'), '347 100 0002');
select atteso('la sua email resta quella', (select email::text from persone where id = 'aaaaaaaa-0000-0000-0000-000000000020'), 'elia@esempio.it');
select atteso('stesso telefono (ultime dieci cifre): la stessa scheda', (scheda_di('fabio@esempio.it') = 'aaaaaaaa-0000-0000-0000-000000000021')::text, 'true');
select atteso('e l''email vuota si riempie', (select email::text from persone where id = 'aaaaaaaa-0000-0000-0000-000000000021'), 'fabio@esempio.it');
select atteso('il suo telefono resta com''era', (select telefono from persone where id = 'aaaaaaaa-0000-0000-0000-000000000021'), '+39 347 100 0003');
select atteso('con otto cifre non basta: una scheda nuova', (scheda_di('gina@esempio.it') <> 'aaaaaaaa-0000-0000-0000-000000000022')::text, 'true');
select atteso('e quella di Gina resta senza email', (select coalesce(email::text, 'senza email') from persone where id = 'aaaaaaaa-0000-0000-0000-000000000022'), 'senza email');

\echo ''
\echo '--- 3. la scheda scelta dalla segreteria ---'
insert into persone (id, nome, cognome, ruolo) values ('aaaaaaaa-0000-0000-0000-000000000030', 'Ugo', 'Blu', 'iscritto');
set role anon;
-- Niente li lega (né email né telefono): la segreteria sa chi è e lo sceglie.
select atteso('la mamma di Ugo manda la richiesta', tenta($$select (manda('Ugo', 'Blu', 'mamma.blu@esempio.it', '347 100 0004') is not null)::text$$), 'true');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('accolta sulla scheda scelta', tenta($$select (accogli_iscrizione(rid('mamma.blu@esempio.it'), 'aaaaaaaa-0000-0000-0000-000000000030') = 'aaaaaaaa-0000-0000-0000-000000000030')::text$$), 'true');
reset role;
select atteso('email e telefono vuoti si riempiono', (select email::text || ' ' || telefono from persone where id = 'aaaaaaaa-0000-0000-0000-000000000030'), 'mamma.blu@esempio.it 347 100 0004');
select atteso('una Ugo Blu sola', (select count(*)::text from persone where cognome = 'Blu'), '1');

\echo ''
\echo '--- 4. il codice fiscale ritrova la scheda, ma non le dà un contatto ---'
-- Rosa arriva dal modulo Google: il codice sta nelle anagrafiche.
insert into persone (id, nome, cognome, ruolo) values
  ('aaaaaaaa-0000-0000-0000-000000000040', 'Rosa', 'Gialli', 'iscritto'),
  ('aaaaaaaa-0000-0000-0000-000000000041', 'Pia', 'Nera', 'iscritto');
insert into anagrafiche (persona_id, codice_fiscale) values ('aaaaaaaa-0000-0000-0000-000000000040', cf_di('Rosa', 'Gialli'));
set role anon;
select atteso('un altro genitore manda la richiesta di Rosa', tenta($$select (manda('Rosa', 'Gialli', 'papa.gialli@esempio.it', '320 111 0001') is not null)::text$$), 'true');
select atteso('Pia manda la prima richiesta', tenta($$select (manda('Pia', 'Nera', 'mamma.nera@esempio.it', '347 100 0005') is not null)::text$$), 'true');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la prima di Pia', tenta($$select (accogli_iscrizione(rid('mamma.nera@esempio.it'), 'aaaaaaaa-0000-0000-0000-000000000041') = 'aaaaaaaa-0000-0000-0000-000000000041')::text$$), 'true');
reset role;
-- La segreteria toglie i contatti dalla scheda (li aveva scritti la prima richiesta): resta il codice della richiesta accolta.
update persone set email = null, telefono = null where id = 'aaaaaaaa-0000-0000-0000-000000000041';
set role anon;
select atteso('l''altro genitore manda la seconda richiesta di Pia', tenta($$select (manda('Pia', 'Nera', 'papa.nera@esempio.it', '320 111 0002') is not null)::text$$), 'true');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('Rosa accolta', tenta($$select (accogli_iscrizione(rid('papa.gialli@esempio.it')) is not null)::text$$), 'true');
select atteso('Pia accolta la seconda volta', tenta($$select (accogli_iscrizione(rid('papa.nera@esempio.it')) is not null)::text$$), 'true');
reset role;
select atteso('Rosa: la ritrova dal codice delle anagrafiche', (scheda_di('papa.gialli@esempio.it') = 'aaaaaaaa-0000-0000-0000-000000000040')::text, 'true');
select atteso('ma sulla scheda non si scrive né email né telefono',
  (select coalesce(email::text, 'senza email') || ' ' || coalesce(telefono, 'senza telefono') from persone where id = 'aaaaaaaa-0000-0000-0000-000000000040'), 'senza email senza telefono');
select atteso('Pia: la ritrova dal codice della richiesta già accolta', (scheda_di('papa.nera@esempio.it') = 'aaaaaaaa-0000-0000-0000-000000000041')::text, 'true');
select atteso('ma sulla scheda non si scrive né email né telefono',
  (select coalesce(email::text, 'senza email') || ' ' || coalesce(telefono, 'senza telefono') from persone where id = 'aaaaaaaa-0000-0000-0000-000000000041'), 'senza email senza telefono');

\echo ''
\echo '--- 5. chi non è la segreteria non accoglie ---'
set role anon;
select atteso('una richiesta nuova per le prove dei ruoli', tenta($$select (manda('Ruolo', 'Prova', 'ruolo@esempio.it', '347 100 0006') is not null)::text$$), 'true');
select atteso('anon non accoglie', tenta($$select accogli_iscrizione(gen_random_uuid())::text$$), 'NEGATO: …');
reset role;
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('un''istruttrice no', tenta($$select accogli_iscrizione(rid('ruolo@esempio.it'))::text$$), 'NEGATO: solo la segreteria');
reset role;
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('un iscritto no', tenta($$select accogli_iscrizione(rid('ruolo@esempio.it'))::text$$), 'NEGATO: solo la segreteria');
reset role;
select chi('77777777-7777-7777-7777-777777770001');
set role authenticated;
select atteso('il tablet no', tenta($$select accogli_iscrizione(rid('ruolo@esempio.it'))::text$$), 'NEGATO: solo la segreteria');
reset role;
select chi('aaaaaaaa-1111-1111-1111-111111111111');
set role authenticated;
select atteso('chi ha mandato la richiesta nemmeno', tenta($$select accogli_iscrizione(rid('ruolo@esempio.it'))::text$$), 'NEGATO: solo la segreteria');
reset role;
select atteso('e la richiesta è ancora da accogliere', (select stato::text from richieste_iscrizione where email = 'ruolo@esempio.it'), 'nuova');

\echo ''
\echo '--- 6. lo stesso nome e la stessa email, ma un altro codice fiscale: un'altra persona ---'
-- Due cugini con lo stesso nome, iscritti dalla stessa nonna con la sua email.
set role anon;
select atteso('la nonna manda la richiesta del primo Ugo Rana', tenta($$select (manda('Ugo', 'Rana', 'nonna.rana@esempio.it', '347 100 0007') is not null)::text$$), 'true');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('il primo accolto', tenta($$select (accogli_iscrizione(rid('nonna.rana@esempio.it')) is not null)::text$$), 'true');
reset role;
create temp table primo_rana as select scheda_di('nonna.rana@esempio.it') as id;
grant select on primo_rana to anon, authenticated;
set role anon;
select atteso('e quella del secondo, nato un anno prima', tenta($$select (manda('Ugo', 'Rana', 'nonna.rana@esempio.it', '347 100 0007', 31) is not null)::text$$), 'true');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('il secondo accolto', tenta($$select (accogli_iscrizione(rid('nonna.rana@esempio.it')) is not null)::text$$), 'true');
reset role;
select atteso('il secondo ha una scheda sua', (scheda_di('nonna.rana@esempio.it') <> (select id from primo_rana))::text, 'true');
select atteso('due Ugo Rana', (select count(*)::text from persone where cognome = 'Rana'), '2');
select atteso('e il primo resta iscritto con la sua richiesta sola', (select count(*)::text from richieste_iscrizione where persona_id = (select id from primo_rana)), '1');

\echo ''
\echo 'TUTTO A POSTO'
