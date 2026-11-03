-- L'avviso alla segreteria per il certificato medico mandato dall'iscritto
-- (139-avviso-certificato.sql, sul meccanismo di 84-avvisi-segreteria.sql).
-- Quando chi ha l'accesso manda il certificato (`iscritto_manda_certificato`) e
-- passano cinque minuti, `avvisi_da_mandare()` dà un avviso
--   {tipo:'certificato', personaId, nome, cognome, inviatoIl}
-- Chiave del registro: l'istante dell'invio (`certificato:<microsecondi>`), mai
-- il nome del file né l'id della persona; in `dati` solo `inviato_il`.
-- L'avviso vive finché quel file è ancora in attesa: confermato, rifiutato,
-- sostituito da un file nuovo o persona disattivata, si chiude `vuoto`. Il file
-- 139, quando si lancia, chiude `vuoto` i certificati già in attesa da più di
-- cinque minuti: quelli non mandano mai la mail (rilanciarlo non cambia niente).
-- Il tetto di 50 al giorno è quello degli altri avvisi. I ruoli che non leggono
-- il registro sono già in avvisi-segreteria.sql. Il testo, lato app, in
-- scripts/prova-avvisi-segreteria.mjs (sezione 3ter).
-- Si lancia dalla radice del repo (`\i` del file 139), dopo lo schema.
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
create or replace function pid(n int) returns uuid language sql immutable as $$
  select ('aaaaaaaa-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;
-- Il file in attesa nello Storage di una persona.
create or replace function fl(n int, nome text) returns text language sql immutable as $$
  select pid(n)::text || '/' || nome
$$;
-- Un invio dall'area iscritti: `utente` è chi è collegato, `n` la persona, `nome` il file.
create or replace function manda(utente text, n int, nome text) returns void language plpgsql as $$
begin
  perform set_config('prova.utente', utente, false);
  insert into storage.objects (bucket_id, name) values ('certificati', fl(n, nome)) on conflict do nothing;
  perform iscritto_manda_certificato(pid(n), fl(n, nome));
end $$;
-- Il tempo che passa: l'invio di `n` risale a `minuti` fa.
create or replace function inviato_fa(n int, minuti int) returns void language plpgsql as $$
begin
  update schede_iscritti set certificato_in_attesa_il = now() - make_interval(mins => minuti) where persona_id = pid(n);
end $$;
-- Gli avvisi di certificato pronti (li chiama la Edge Function: service_role).
create or replace function pronti() returns text language plpgsql as $$
begin
  return (select count(*)::text from avvisi_da_mandare() x where x.avviso->>'tipo' = 'certificato');
end $$;
create or replace function pronto_di(n int) returns jsonb language plpgsql as $$
begin
  return (select x.avviso from avvisi_da_mandare() x where x.avviso->>'tipo' = 'certificato' and x.avviso->>'personaId' = pid(n)::text limit 1);
end $$;
create or replace function registro(filtro text default 'true') returns text language plpgsql as $$
declare r text;
begin
  execute 'select coalesce(string_agg(coalesce(non_mandato, case when mandato_il is not null then ''mandato'' else ''in coda'' end), '','' order by creato_il, id), ''-'') from avvisi_segreteria where tipo = ''certificato'' and ' || filtro into r;
  return r;
end $$;
-- La Edge Function li ha mandati tutti.
create or replace function manda_cert() returns text language plpgsql as $$
declare r record; n int := 0;
begin
  for r in select * from avvisi_da_mandare() x where x.avviso->>'tipo' = 'certificato' loop perform avviso_mandato(r.id); n := n + 1; end loop;
  return n::text;
end $$;
-- Da capo: registro vuoto, nessun certificato in attesa.
create or replace function pulisci() returns void language plpgsql as $$
begin
  delete from avvisi_segreteria;
  update schede_iscritti set certificato_in_attesa = null, certificato_in_attesa_il = null;
  -- Anche i file, se no il tetto dei file in attesa per persona blocca gli invii dopo qualche prova.
  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.objects where bucket_id = 'certificati' and name like '%/attesa-%';
end $$;
grant execute on function tenta(text), atteso(text, text, text), chi(text), pid(int), fl(int, text), manda(text, int, text), inviato_fa(int, int),
  pronti(), pronto_di(int), registro(text), manda_cert(), pulisci() to anon, authenticated, service_role;

insert into auth.users (id, email, email_confirmed_at) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it', now()),
  ('33333333-3333-3333-3333-333333333333', 'luca@fam.it', now()),
  ('44444444-4444-4444-4444-444444444444', 'maria@fam.it', now());
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  (pid(1), 'Anna', 'Segreteria', 'staff', 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  (pid(3), 'Luca', 'Rossi', 'iscritto', 'luca@fam.it', '33333333-3333-3333-3333-333333333333'),
  (pid(4), 'Maria', 'Bianchi', 'iscritto', 'maria@fam.it', '44444444-4444-4444-4444-444444444444');
-- Il nucleo di Luca: Maria, con l'accesso suo, e Teo, senza.
insert into persone (id, nome, cognome, ruolo, email, utente_id, nucleo) values
  (pid(5), 'Teo', 'Rossi', 'iscritto', null, null, pid(3));
update avvisi_indirizzi set a = 'segreteria@ods.it';
-- Mettere l'indirizzo fa ripartire `dal` da adesso: lo si porta a ieri, e anche l'invio di 60 minuti fa conta.
update avvisi_indirizzi set dal = now() - interval '1 day';

\echo ''
\echo '--- 1. mandato da più di cinque minuti: l''avviso c''è ---'
select manda('33333333-3333-3333-3333-333333333333', 3, 'attesa-1.pdf');
select inviato_fa(3, 6);
set role service_role;
select atteso('pronto uno solo', pronti(), '1');
select atteso('con persona, nome e cognome',
  (select concat_ws(' · ', x->>'tipo', x->>'personaId', x->>'nome', x->>'cognome') from (select pronto_di(3) x) q),
  'certificato · ' || pid(3) || ' · Luca · Rossi');
select atteso('a chi scrive e in copia a chi',
  (select a || ' / ' || cc from avvisi_da_mandare() x where x.avviso->>'tipo' = 'certificato' limit 1), 'segreteria@ods.it / asdilcentrojudo@gmail.com');
reset role;
select atteso('e l''istante dell''invio, lo stesso della scheda',
  (select (pronto_di(3)->>'inviatoIl')::timestamptz = certificato_in_attesa_il from schede_iscritti where persona_id = pid(3))::text, 'true');

\echo ''
\echo '--- 2. mandato due minuti fa: aspetta ---'
select manda('44444444-4444-4444-4444-444444444444', 4, 'attesa-1.png');
select inviato_fa(4, 2);
set role service_role;
select atteso('di Maria ancora niente', pronto_di(4)::text, null);
select atteso('quello di Luca resta', pronti(), '1');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
select rifiuta_certificato_iscritto(pid(4));

\echo ''
\echo '--- 3. chiamata di nuovo: una riga sola, e nel registro il minimo ---'
set role service_role;
select atteso('ridà lo stesso', pronti(), '1');
reset role;
select atteso('una riga sola nel registro', registro(), 'in coda');
select atteso('la chiave è l''istante: certificato:<numero>',
  (select (chiave ~ '^certificato:[0-9]+$')::text from avvisi_segreteria where tipo = 'certificato'), 'true');
select atteso('e vale i microsecondi dell''invio',
  (select (a.chiave = 'certificato:' || (extract(epoch from s.certificato_in_attesa_il) * 1000000)::bigint)::text
     from avvisi_segreteria a, schede_iscritti s where a.tipo = 'certificato' and s.persona_id = pid(3)), 'true');
select atteso('né il file, né «attesa-», né la persona, né la scadenza nella chiave o in dati',
  (select count(*)::text from avvisi_segreteria a where tipo = 'certificato'
     and ((chiave || coalesce(dati::text, '')) ~* '(attesa-|\.pdf|\.png|\.jpg|scad)' or (chiave || coalesce(dati::text, '')) like '%' || pid(3)::text || '%')), '0');
select atteso('in dati solo l''istante', (select string_agg(k, ',') from avvisi_segreteria a, jsonb_object_keys(a.dati) k where a.tipo = 'certificato'), 'inviato_il');

\echo ''
\echo '--- 4. confermato o rifiutato prima che parta: si chiude vuoto ---'
select chi('11111111-1111-1111-1111-111111111111');
select conferma_certificato_iscritto(pid(3), current_date + 365);
set role service_role;
select atteso('confermato: non esce', pronti(), '0');
reset role;
select atteso('e l''avviso è chiuso vuoto', registro(), 'vuoto');
select manda('33333333-3333-3333-3333-333333333333', 3, 'attesa-2.pdf');
select inviato_fa(3, 6);
set role service_role;
select atteso('un invio nuovo: esce', pronti(), '1');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
select rifiuta_certificato_iscritto(pid(3));
set role service_role;
select atteso('rifiutato: non esce', pronti(), '0');
reset role;
select atteso('anche questo chiuso vuoto', registro(), 'vuoto,vuoto');


\echo ''
\echo '--- 5. un secondo invio della stessa persona ---'
select pulisci();
select manda('33333333-3333-3333-3333-333333333333', 3, 'attesa-3.pdf');
select inviato_fa(3, 10);
set role service_role;
select atteso('il primo esce e parte', manda_cert(), '1');
reset role;
select manda('33333333-3333-3333-3333-333333333333', 3, 'attesa-4.pdf');
select inviato_fa(3, 6);
set role service_role;
select atteso('dopo un avviso già mandato, il secondo invio ne fa uno nuovo', pronti(), '1');
reset role;
select atteso('nel registro: il mandato e il nuovo', registro(), 'mandato,in coda');
-- Il primo non era partito: il secondo invio lo sostituisce.
select pulisci();
select manda('33333333-3333-3333-3333-333333333333', 3, 'attesa-5.pdf');
select inviato_fa(3, 10);
set role service_role;
select atteso('il primo è pronto', pronti(), '1');
reset role;
select manda('33333333-3333-3333-3333-333333333333', 3, 'attesa-6.pdf');
select inviato_fa(3, 7);
set role service_role;
select atteso('ma non è partito e arriva un file nuovo: ne esce uno solo', pronti(), '1');
reset role;
select atteso('il vecchio è chiuso vuoto, uno solo per il nuovo', registro(), 'vuoto,in coda');

\echo ''
\echo '--- 6. il nucleo: un avviso per persona ---'
select pulisci();
select manda('33333333-3333-3333-3333-333333333333', 5, 'attesa-1.pdf');  -- il titolare, per Teo
select manda('44444444-4444-4444-4444-444444444444', 4, 'attesa-1.png');   -- Maria, per sé
select manda('33333333-3333-3333-3333-333333333333', 3, 'attesa-7.pdf');   -- il titolare, per sé
select inviato_fa(n, n + 3) from generate_series(3, 5) n;  -- istanti diversi: la chiave è l'istante
set role service_role;
select atteso('tre persone, tre avvisi', pronti(), '3');
select atteso('ognuno col suo nome',
  (select string_agg(x.avviso->>'nome', ',' order by x.avviso->>'nome') from avvisi_da_mandare() x where x.avviso->>'tipo' = 'certificato'), 'Luca,Maria,Teo');
reset role;
select atteso('e tre righe nel registro', registro(), 'in coda,in coda,in coda');
-- Chi esce dall'elenco delle persone attive non avvisa più.
update persone set attiva = false where id = pid(5);
set role service_role;
select atteso('Teo disattivato: non esce', pronti(), '2');
reset role;
-- Le tre righe hanno lo stesso `creato_il` (una chiamata sola): l'ordine fra loro non dice niente.
select atteso('e il suo avviso è chiuso vuoto', registro('non_mandato is not null'), 'vuoto');
select atteso('gli altri due restano in coda', registro('non_mandato is null'), 'in coda,in coda');
set role service_role;
select atteso('e sono quelli di Luca e Maria',
  (select string_agg(x.avviso->>'nome', ',' order by x.avviso->>'nome') from avvisi_da_mandare() x where x.avviso->>'tipo' = 'certificato'), 'Luca,Maria');
reset role;
update persone set attiva = true where id = pid(5);

\echo ''
\echo '--- 7. già in attesa quando si lancia il file 139: non avvisa mai ---'
select pulisci();
select manda('33333333-3333-3333-3333-333333333333', 3, 'attesa-8.pdf');
select inviato_fa(3, 60);
select manda('44444444-4444-4444-4444-444444444444', 4, 'attesa-2.png');
select inviato_fa(4, 2);
\i supabase/139-avviso-certificato.sql
set role service_role;
select atteso('quello vecchio non manda la mail', pronto_di(3)::text, null);
reset role;
select atteso('ed è chiuso vuoto', registro(), 'vuoto');
\i supabase/139-avviso-certificato.sql
select atteso('rilanciarlo non cambia niente', registro(), 'vuoto');
select atteso('il certificato di due minuti fa non è toccato', (select certificato_in_attesa is not null from schede_iscritti where persona_id = pid(4))::text, 'true');
select inviato_fa(4, 6);
set role service_role;
select atteso('e dopo cinque minuti avvisa', pronti(), '1');
reset role;

\echo ''
\echo '--- 8. avvisi spenti ---'
select pulisci();
select manda('33333333-3333-3333-3333-333333333333', 3, 'attesa-9.pdf');
select inviato_fa(3, 6);
update avvisi_indirizzi set a = null;
set role service_role;
select atteso('senza indirizzo: nessuna riga, nessun errore', tenta($$select count(*)::text from avvisi_da_mandare()$$), '0');
reset role;
update avvisi_indirizzi set a = 'segreteria@ods.it';
update avvisi_indirizzi set dal = now() - interval '1 day';

\echo ''
\echo '--- 9. al più 50 al giorno ---'
select pulisci();
insert into avvisi_segreteria (tipo, chiave, mandato_il) select 'richiesta', 'gia-mandata-' || n, now() from generate_series(1, 50) n;
select manda('33333333-3333-3333-3333-333333333333', 3, 'attesa-10.pdf');
select inviato_fa(3, 6);
set role service_role;
select atteso('il cinquantunesimo non si manda', pronti(), '0');
reset role;
select atteso('ed è segnato: tetto', registro(), 'tetto');

\echo ''
\echo '--- 10. unire due persone non rimanda la mail ---'
select pulisci();
-- Si uniscono solo schede senza accesso: Teo (mandato da Luca) e un suo doppione.
insert into persone (id, nome, cognome, ruolo) values (pid(6), 'Teo', 'Rossi', 'iscritto');
select manda('33333333-3333-3333-3333-333333333333', 5, 'attesa-11.pdf');
select inviato_fa(5, 6);
set role service_role;
select atteso('prima dell''unione l''avviso è pronto', pronti(), '1');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
select unisci_persone(pid(5), pid(6));
select atteso('il file ha un nome nuovo, l''istante no', (select (certificato_in_attesa like pid(5)::text || '/attesa-%' and certificato_in_attesa <> fl(5, 'attesa-11.pdf'))::text from schede_iscritti where persona_id = pid(5)), 'true');
set role service_role;
select atteso('dopo l''unione è sempre uno, di chi resta', (select string_agg(x.avviso->>'personaId', ',') from avvisi_da_mandare() x where x.avviso->>'tipo' = 'certificato'), pid(5)::text);
select manda_cert();
select atteso('mandato, non torna', pronti(), '0');
reset role;
select atteso('una riga sola nel registro', registro(), 'mandato');

\echo ''
\echo 'TUTTO A POSTO'
