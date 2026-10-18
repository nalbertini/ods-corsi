-- Collegare i movimenti dello storico alla persona che li ha fatti (70-movimenti-persona.sql):
-- `movimenti.persona_id` è un'etichetta «di chi è questo movimento». Non cambia importo, data, cassa, voce,
-- testo, saldi, bilancio, previsto né chiusure. Un movimento ha al massimo una persona. Solo l'amministrazione
-- collega, scollega e legge la traccia (`collegamenti_persona`); lo storico di una scheda (`storico_persona`)
-- lo vede chi vede già i pagamenti di quella scheda: segreteria e amministrazione.
-- Si collegano solo le ENTRATE importate dal vecchio programma (`origine_import like 'prima-nota:%'`) sulle voci
-- «Quota associativa» e «Corsi e altri pagamenti». Il blocco automatico collega solo chi ha nome e cognome della
-- causale («Cliente … per …») uguali a quelli di UNA sola scheda; gli omonimi si scelgono a mano.
-- Le stesse regole di src/lib/movimentiPersona.ts e della modalità prova, provate da
-- scripts/prova-movimenti-persona.mjs e scripts/prova-segreteria.mjs.
-- Si lancia dopo finto-supabase.sql e i file dello schema, su un database suo. Nomi tutti inventati.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

select (to_regprocedure('public.riepilogo_collegamenti_persona()') is not null
    and to_regprocedure('public.collega_sicuri_persona(uuid, integer)') is not null
    and to_regprocedure('public.collega_movimenti_persona(uuid[], uuid)') is not null
    and to_regprocedure('public.scollega_movimenti_persona(uuid[])') is not null
    and to_regprocedure('public.togli_lotto_collegamenti(uuid)') is not null
    and to_regprocedure('public.candidati_persona_movimento(uuid)') is not null
    and to_regprocedure('public.storico_persona(uuid)') is not null
    and to_regprocedure('public.esiti_collegamenti_persona()') is not null
    and to_regclass('public.collegamenti_persona') is not null
    and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'movimenti' and column_name = 'persona_id'))::text as c70 \gset
create or replace function atteso(cosa text, avuto text, voluto text) returns text language plpgsql as $$
begin
  if avuto is distinct from voluto and not (voluto like '%…' and avuto like replace(voluto, '…', '%')) then
    raise exception '% · atteso «%», avuto «%»', cosa, voluto, avuto;
  end if;
  return 'ok  ' || cosa || ' → ' || avuto;
end $$;
select atteso('70-movimenti-persona.sql è stato lanciato: ci sono la colonna, la traccia e le otto funzioni', :'c70', 'true');
select (to_regclass('public.chiusure_cassa') is not null and to_regprocedure('public.importa_prima_nota(jsonb)') is not null and to_regprocedure('public.unisci_persone(uuid, uuid)') is not null)::text as c60 \gset
select atteso('60, 63 e 29 sono stati lanciati: servono ai giorni chiusi, allo storico e all''unione di schede', :'c60', 'true');

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'ada@ods.it'),
  ('33333333-3333-3333-3333-333333333333', 'sandro@ods.it'),
  ('44444444-4444-4444-4444-444444444444', 'ivo@ods.it'),
  ('55555555-5555-5555-5555-555555555555', 'maura@ods.it'),
  ('66666666-6666-6666-6666-666666666666', 'senza@ods.it'),
  ('77777777-7777-7777-7777-777777777777', 'luca@ods.it'),
  ('88888888-8888-8888-8888-888888888888', 'teo@ods.it'),
  ('99999999-9999-9999-9999-999999999999', 'tablet@ods.it');
-- Anna: solo segreteria. Ada: solo amministrazione. Sandro: segreteria e
-- amministrazione. Ivo: amministrazione e istruttore. Maura: istruttore.
-- Luca: iscritto. Teo: amministrazione, poi la scheda sparisce.
-- «senza» ha un accesso ma nessuna scheda.
insert into persone (id, nome, cognome, ruolo, anche_istruttore, anche_amministrazione, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', false, false, 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Ada', 'Conti', 'amministrazione', false, false, 'ada@ods.it', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Sandro', 'Doppio', 'staff', false, true, 'sandro@ods.it', '33333333-3333-3333-3333-333333333333'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'Ivo', 'Conti', 'amministrazione', true, false, 'ivo@ods.it', '44444444-4444-4444-4444-444444444444'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'Maura', 'Uno', 'istruttore', false, false, 'maura@ods.it', '55555555-5555-5555-5555-555555555555'),
  ('aaaaaaaa-0000-0000-0000-000000000007', 'Luca', 'Rossi', 'iscritto', false, false, 'luca@ods.it', '77777777-7777-7777-7777-777777777777'),
  ('aaaaaaaa-0000-0000-0000-000000000008', 'Teo', 'Passeggero', 'amministrazione', false, false, 'teo@ods.it', '88888888-8888-8888-8888-888888888888');
insert into sale (id, nome) values ('bbbbbbbb-0000-0000-0000-000000000001', 'Tatami');
insert into postazioni (id, nome, sala_id, utente_id) values
  ('dddddddd-0000-0000-0000-000000000001', 'Tablet', 'bbbbbbbb-0000-0000-0000-000000000001', '99999999-9999-9999-9999-999999999999');

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
create or replace function esito(sql text) returns text language plpgsql as $$
begin execute sql; return 'ok';
exception when others then return sqlstate || ' ' || sqlerrm;
end $$;

-- Esegue una `select` che rende un testo come quell'utente (con il ruolo `authenticated`); un errore passa com'è.
create or replace function come(u text, q text) returns text language plpgsql as $$
declare r text;
begin
  perform set_config('prova.utente', u, false);
  set role authenticated;
  begin execute q into r; exception when others then reset role; raise; end;
  reset role;
  return r;
end $$;
-- Come `come`, ma un errore diventa «codice messaggio» invece di fermare la prova.
create or replace function come_esito(u text, q text) returns text language plpgsql as $$
begin return coalesce(come(u, q), 'ok');
exception when others then return sqlstate || ' ' || sqlerrm;
end $$;
-- Come `come`, ma un jsonb rientra in forma canonica: l'ordine delle chiavi non conta.
create or replace function come_json(u text, q text) returns text language sql as $$ select come(u, q)::jsonb::text $$;

create or replace function id_cassa(n text) returns uuid language sql stable security definer set search_path = public as $$ select id from casse where nome = n $$;
create or replace function id_voce(n text, t text) returns uuid language sql stable security definer set search_path = public as $$
  select id from voci_contabili where nome = n and tipo::text = t $$;
create or replace function id_mov(d text) returns uuid language sql stable security definer set search_path = public as $$ select id from movimenti where descrizione = d $$;
-- Il movimento dello storico numero n (la chiave `prima-nota:n`).
create or replace function id_n(n int) returns uuid language sql stable security definer set search_path = public as $$
  select id from movimenti where origine_import = 'prima-nota:' || n $$;
-- Una lista di movimenti dello storico, scritta come la vuole una `select`.
create or replace function lista(variadic n int[]) returns text language sql stable security definer set search_path = public as $$
  select 'array[' || string_agg(quote_literal(id_n(x)) || '::uuid', ', ') || ']::uuid[]' from unnest(n) x $$;
create or replace function pid(n int) returns uuid language sql immutable as $$ select ('cccccccc-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid $$;
create or replace function lotto(n int) returns uuid language sql immutable as $$ select ('11111111-aaaa-0000-0000-' || lpad(n::text, 12, '0'))::uuid $$;
create or replace function riga(chiave text, giorno text, cassa text, tipo text, importo int, descr text, voce text) returns jsonb language sql immutable as $$
  select jsonb_build_object('chiave', chiave, 'data', giorno, 'cassa', cassa, 'tipo', tipo, 'importo', importo, 'descrizione', descr, 'voce', voce) $$;

-- Chi è la persona, con l'anno di nascita se c'è: due «Sara Neri» si distinguono.
create or replace function eti(p uuid) returns text language sql stable security definer set search_path = public as $$
  select case when p is null then '—' else coalesce((select pe.nome || ' ' || pe.cognome || coalesce(' ' || extract(year from a.nato_il)::int, '')
    from persone pe left join anagrafiche a on a.persona_id = pe.id where pe.id = p), '(scheda eliminata)') end $$;
create or replace function persona_di(n int) returns text language sql stable security definer set search_path = public as $$
  select eti(persona_id) from movimenti where origine_import = 'prima-nota:' || n $$;
-- Di chi sono i movimenti dello storico da 1 a n, in una riga.
create or replace function stato(fino int) returns text language sql stable security definer set search_path = public as $$
  select string_agg(n || ':' || persona_di(n), ' ' order by n) from generate_series(1, fino) n $$;
-- La traccia di un movimento, dalla più vecchia: «prima → dopo | prima → dopo».
create or replace function traccia_di(n int) returns text language sql stable security definer set search_path = public as $$
  select coalesce(string_agg(eti(c.persona_prima_id) || ' → ' || eti(c.persona_dopo_id), ' | ' order by c.fatto_il, c.id), 'nessuna')
  from collegamenti_persona c where c.movimento_id = id_n(n) $$;
create or replace function quante_tracce() returns text language sql stable security definer set search_path = public as $$ select count(*)::text from collegamenti_persona $$;
-- I conti che l'etichetta non deve toccare: saldo di ogni cassa, totali per voce e per mese, il previsto, le chiusure.
create or replace function somme() returns text language sql stable security definer set search_path = public as $$
  select
    coalesce((select string_agg(c.nome || '=' || coalesce((select sum(case when m.tipo = 'giroconto' then case when m.cassa_id = c.id then -m.importo else m.importo end
        when m.tipo = 'entrata' then m.importo else -m.importo end) from movimenti m where m.annullato_il is null and c.id in (m.cassa_id, m.cassa_a_id)), 0), ' ' order by c.nome) from casse c), '')
    || ' / ' || coalesce((select string_agg(v.nome || ':' || v.tipo || '=' || s.t, ' ' order by v.nome, v.tipo) from voci_contabili v,
        lateral (select coalesce(sum(m.importo), 0) as t from movimenti m where m.voce_id = v.id and m.annullato_il is null) s), '')
    || ' / ' || coalesce((select string_agg(to_char(m.data, 'YYYY-MM') || ':' || m.tipo || '=' || m.importo, ' ' order by to_char(m.data, 'YYYY-MM'), m.tipo, m.importo, m.id)
        from movimenti m where m.annullato_il is null), '')
    || ' / previsto ' || previsto_cassa(id_cassa('Cassa Contanti'), '2026-09-07')::text
    || ' / ' || coalesce((select string_agg(k.data || ' ' || k.previsto || '/' || k.contato || '/' || k.differenza || coalesce(' ' || (k.annullata_il is not null)::text, ''), ' ' order by k.data) from chiusure_cassa k), '') $$;
-- Tutto di ogni movimento tranne la persona.
create or replace function senza_persona() returns text language sql stable security definer set search_path = public as $$
  select md5(coalesce(string_agg(row(id, tipo, data, importo, voce_id, cassa_id, cassa_a_id, descrizione, nota, creato_da, creato_il, annullato_il, annullato_da, origine_import)::text, '|' order by id), '')) from movimenti $$;
-- Tutto, persona e traccia compresi: per accorgersi che un lotto rifiutato non ha lasciato niente.
create or replace function impronta() returns text language sql stable security definer set search_path = public as $$
  select md5(coalesce((select string_agg(m::text, '|' order by m.id) from movimenti m), '')
          || coalesce((select string_agg(c::text, '|' order by c.id) from collegamenti_persona c), '')) $$;
-- Gli esiti per riga (i tag dell'elenco), come li vede l'amministrazione: «sicuro/omonimi/nessuna» di un movimento dello storico, o «assente».
create or replace function esito_di(n int) returns text language sql as $$
  select come('22222222-2222-2222-2222-222222222222', format($q$select coalesce((select e->>'esito' from jsonb_array_elements(esiti_collegamenti_persona()) e where e->>'id' = %L), 'assente')$q$, id_n(n))) $$;
-- Sicuri / omonimi / nessuna, contati sugli esiti.
create or replace function esiti_conta() returns text language sql as $$
  select come('22222222-2222-2222-2222-222222222222', $q$select count(*) filter (where e->>'esito' = 'sicuro') || '/' || count(*) filter (where e->>'esito' = 'omonimi') || '/' || count(*) filter (where e->>'esito' = 'nessuna')
    || ' di ' || count(*) from jsonb_array_elements(esiti_collegamenti_persona()) e$q$) $$;
-- Gli stessi numeri come li dà il riepilogo: sicuri / da decidere / senza scheda.
create or replace function riepilogo_conta() returns text language sql as $$
  select come('22222222-2222-2222-2222-222222222222', $q$select (r->'sicuri'->>'movimenti') || '/' || (r->'da_decidere'->>'movimenti') || '/' || (r->'senza_scheda'->>'movimenti')
    || ' di ' || ((r->'sicuri'->>'movimenti')::int + (r->'da_decidere'->>'movimenti')::int + (r->'senza_scheda'->>'movimenti')::int) from (select riepilogo_collegamenti_persona() r) x$q$) $$;
-- Cosa vede chi chiama con quel ruolo: il risultato della `select`, o «NEGATO».
create or replace function viste(utente text, ruolo text, q text) returns text language plpgsql as $$
declare r text;
begin
  perform set_config('prova.utente', utente, false);
  execute format('set role %I', ruolo);
  r := tenta(q);
  reset role;
  return r;
end $$;
-- Le scritture dritte (insert, update, delete) su una tabella: quante finiscono con «permission denied».
create or replace function scritture_negate(utente text, ruolo text, tabella text, istruzioni text[]) returns text language plpgsql as $$
declare s text; negati int := 0;
begin
  perform set_config('prova.utente', utente, false);
  execute format('set role %I', ruolo);
  foreach s in array istruzioni loop
    if tenta(s) = 'NEGATO: permission denied for table ' || tabella then negati := negati + 1; end if;
  end loop;
  reset role;
  return negati || '/' || array_length(istruzioni, 1);
end $$;
-- Una chiamata fatta da ognuno dei dieci accessi: solo il codice dell'esito, «ok» se è andata.
create or replace function matrice(q text) returns text language plpgsql as $$
declare u record; r text; fuori text := '';
begin
  for u in select * from (values
    ('anna', '11111111-1111-1111-1111-111111111111', 'authenticated'),
    ('ada', '22222222-2222-2222-2222-222222222222', 'authenticated'),
    ('sandro', '33333333-3333-3333-3333-333333333333', 'authenticated'),
    ('ivo', '44444444-4444-4444-4444-444444444444', 'authenticated'),
    ('maura', '55555555-5555-5555-5555-555555555555', 'authenticated'),
    ('luca', '77777777-7777-7777-7777-777777777777', 'authenticated'),
    ('senza', '66666666-6666-6666-6666-666666666666', 'authenticated'),
    ('tablet', '99999999-9999-9999-9999-999999999999', 'authenticated'),
    ('teo', '88888888-8888-8888-8888-888888888888', 'authenticated'),
    ('anon', '00000000-0000-0000-0000-000000000000', 'anon')) as t(nome, id, ruolo) loop
    perform set_config('prova.utente', u.id, false);
    execute format('set role %I', u.ruolo);
    r := esito(q);
    reset role;
    fuori := fuori || case when fuori = '' then '' else ' ' end || u.nome || ':' || left(r, 5);
  end loop;
  return fuori;
end $$;
grant execute on function atteso(text, text, text), chi(text), tenta(text), esito(text), come(text, text), come_esito(text, text), come_json(text, text),
  id_cassa(text), id_voce(text, text), id_mov(text), id_n(int), lista(int[]), pid(int), lotto(int), riga(text, text, text, text, int, text, text),
  eti(uuid), persona_di(int), stato(int), traccia_di(int), quante_tracce(), somme(), senza_persona(), impronta(),
  viste(text, text, text), scritture_negate(text, text, text, text[]), matrice(text) to anon, authenticated;

-- Chi arriva dove, a seconda di cosa chiama: l'amministrazione (Ada, Sandro con anche_amministrazione, Ivo, Teo) e nessun altro.
\set amm_vuoto 'anna:42501 ada:22023 sandro:22023 ivo:22023 maura:42501 luca:42501 senza:42501 tablet:42501 teo:22023 anon:42501'
\set amm_ok 'anna:42501 ada:ok sandro:ok ivo:ok maura:42501 luca:42501 senza:42501 tablet:42501 teo:ok anon:42501'
\set amm_manca 'anna:42501 ada:P0002 sandro:P0002 ivo:P0002 maura:42501 luca:42501 senza:42501 tablet:42501 teo:P0002 anon:42501'
-- Lo storico di una scheda: la segreteria e l'amministrazione; istruttori, tablet, iscritti no.
\set scheda_ok 'anna:ok ada:ok sandro:ok ivo:ok maura:42501 luca:42501 senza:42501 tablet:42501 teo:ok anon:42501'

\echo ''
\echo '--- 1. chi può: solo l''amministrazione collega, scollega e legge; lo storico lo vede la segreteria ---'
select atteso('il riepilogo: solo l''amministrazione', matrice('select riepilogo_collegamenti_persona()'), :'amm_ok');
select atteso('il blocco automatico: solo l''amministrazione (con quanti = 0 arriva ai controlli)', matrice('select collega_sicuri_persona(gen_random_uuid(), 0)'), :'amm_vuoto');
select atteso('collegare a mano: solo l''amministrazione (lista vuota: scegli almeno un movimento)', matrice('select collega_movimenti_persona(array[]::uuid[], null)'), :'amm_vuoto');
select atteso('scollegare: solo l''amministrazione', matrice('select scollega_movimenti_persona(array[]::uuid[])'), :'amm_vuoto');
select atteso('togliere un lotto: solo l''amministrazione', matrice('select togli_lotto_collegamenti(gen_random_uuid())'), :'amm_ok');
select atteso('i candidati di un movimento: solo l''amministrazione (un movimento che non c''è)', matrice('select candidati_persona_movimento(gen_random_uuid())'), :'amm_manca');
select atteso('lo storico di una scheda: segreteria e amministrazione, non istruttori, tablet, iscritti né chi non ha scheda', matrice('select storico_persona(gen_random_uuid())'), :'scheda_ok');
select atteso('gli esiti per riga (i tag dell''elenco): solo l''amministrazione', matrice('select esiti_collegamenti_persona()'), :'amm_ok');
select atteso('authenticated le chiama tutte e otto, anon nessuna (permessi)', (select count(*) filter (where has_function_privilege('authenticated', p.oid, 'execute'))::text || '/' || count(*) filter (where has_function_privilege('anon', p.oid, 'execute'))::text
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('riepilogo_collegamenti_persona', 'collega_sicuri_persona', 'collega_movimenti_persona',
    'scollega_movimenti_persona', 'togli_lotto_collegamenti', 'candidati_persona_movimento', 'storico_persona', 'esiti_collegamenti_persona')), '8/0');

\echo ''
\echo '--- 2. i dati di partenza: lo storico di un vecchio programma, le schede, un giorno chiuso ---'
-- Schede: due Sara Neri (omonime), una scheda inattiva, un cognome con l'apostrofo, un nome doppio, un accento.
insert into persone (id, nome, cognome, ruolo, attiva) values
  (pid(1), 'Giulia', 'Verdi', 'iscritto', true),
  (pid(2), 'Marco', 'Bianchi', 'iscritto', false),
  (pid(3), 'Sara', 'Neri', 'iscritto', true),
  (pid(4), 'Sara', 'Neri', 'iscritto', true),
  (pid(5), 'Elena', 'D''Angelo', 'iscritto', true),
  (pid(6), 'Maria Grazia', 'Fontana', 'iscritto', true),
  (pid(7), 'José', 'Ferrari', 'iscritto', true);
insert into anagrafiche (persona_id, nato_il) values (pid(1), '2016-05-04'), (pid(3), '2010-02-03'), (pid(4), '2012-07-09'), (pid(7), '1990-01-01');
insert into corsi (id, nome) values ('eeeeeeee-0000-0000-0000-000000000001', 'Judo kids'), ('eeeeeeee-0000-0000-0000-000000000002', 'Danza');
insert into iscrizioni (corso_id, persona_id, dal) values
  ('eeeeeeee-0000-0000-0000-000000000001', pid(1), '2022-09-05'),
  ('eeeeeeee-0000-0000-0000-000000000001', pid(3), '2024-09-10'),
  ('eeeeeeee-0000-0000-0000-000000000002', pid(4), '2025-01-15'),
  ('eeeeeeee-0000-0000-0000-000000000002', pid(7), '2023-10-01');

select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select imposta_saldo_cassa(id_cassa('Cassa Contanti'), 0, '2026-09-01') is not null as r0 \gset
select importa_prima_nota(jsonb_build_array(
  riga('prima-nota:1', '2025-09-02', 'conto', 'entrata', 31000, 'Cliente Giulia Verdi per annuale judo kids', 'Corsi e altri pagamenti'),
  riga('prima-nota:2', '2025-09-03', 'conto', 'entrata', 3000, 'Cliente VERDI GIULIA per quota associativa', 'Quota associativa'),
  riga('prima-nota:3', '2026-09-03', 'contanti', 'entrata', 4700, 'Cliente Marco Bianchi per mensile judo', 'Corsi e altri pagamenti'),
  riga('prima-nota:4', '2025-10-05', 'conto', 'entrata', 4500, 'Cliente Sara Neri per mensile judo', 'Corsi e altri pagamenti'),
  riga('prima-nota:5', '2025-11-05', 'conto', 'entrata', 4500, 'Cliente Neri Sara per mensile judo', 'Corsi e altri pagamenti'),
  riga('prima-nota:6', '2024-10-10', 'conto', 'entrata', 6000, 'Cliente Paolo Gialli per quota associativa', 'Quota associativa'),
  riga('prima-nota:7', '2024-10-15', 'conto', 'entrata', 5200, 'Cliente Elena D''Angelo per corso danza', 'Corsi e altri pagamenti'),
  riga('prima-nota:8', '2025-01-20', 'conto', 'entrata', 5500, 'Cliente Maria Grazia Fontana per corso', 'Corsi e altri pagamenti'),
  riga('prima-nota:9', '2023-11-05', 'conto', 'entrata', 2000, 'Cliente Jose Ferrari per quota associativa', 'Quota associativa'),
  riga('prima-nota:10', '2025-03-01', 'conto', 'entrata', 1500, 'Bonifico anonimo per quota', 'Quota associativa'),
  riga('prima-nota:11', '2025-03-02', 'conto', 'entrata', 7000, 'Cliente Giulia Verdi per regalo', 'Da classificare'),
  riga('prima-nota:12', '2025-03-03', 'conto', 'uscita', 8000, 'Cliente Giulia Verdi per rimborso', 'Da classificare'),
  riga('prima-nota:13', '2025-03-04', 'conto', 'entrata', 1000, 'Cliente Giulia Verdi per extra', 'Corsi e altri pagamenti'))) as importate \gset
select annulla_movimento(id_n(13)) is not null as r1 \gset
select registra_giroconto(jsonb_build_object('da', id_cassa('Cassa Contanti'), 'a', id_cassa('Conto Corrente'), 'data', '2026-09-06', 'importo', 1000)) is not null as r2 \gset
select registra_movimento(jsonb_build_object('tipo', 'entrata', 'data', '2026-09-10', 'importo', 3000, 'voce_id', id_voce('Quota associativa', 'entrata'), 'cassa_id', id_cassa('Conto Corrente'), 'descrizione', 'Cliente Giulia Verdi per mano')) is not null as r3 \gset
reset role;
-- Le causali vere hanno spazi doppi, a capo e accenti che l'import ripulisce: questa è scritta com'era, senza passare di là.
insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione, origine_import)
values ('entrata', '2026-05-10', 2500, id_voce('Corsi e altri pagamenti', 'entrata'), id_cassa('Conto Corrente'), E'Cliente\nJOSÈ  FERRARI\nper mensile', 'prima-nota:14');
-- Si chiude la Cassa Contanti il 7 settembre con 500 centesimi in più: nasce la «Differenza di cassa».
select previsto_cassa(id_cassa('Cassa Contanti'), '2026-09-07') as prev \gset
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select chiudi_cassa(jsonb_build_object('cassa_id', id_cassa('Cassa Contanti'), 'data', '2026-09-07', 'contato', :prev + 500)) is not null as r4 \gset
reset role;
select atteso('lo storico c''è: quattordici movimenti, uno annullato', (select count(*)::text || '/' || count(*) filter (where annullato_il is not null)::text from movimenti where origine_import like 'prima-nota:%'), '14/1');
select atteso('la chiusura ha scritto la differenza di 500', (select count(*)::text from movimenti where descrizione = 'Differenza di cassa' and importo = 500), '1');
select atteso('nessun movimento ha ancora una persona', (select count(*)::text from movimenti where persona_id is not null), '0');
select atteso('nessuna traccia, per ora', quante_tracce(), '0');
select previsto::text || '/' || differenza::text as chiusura_prima from chiusure_cassa where annullata_il is null \gset
select previsto_cassa(id_cassa('Cassa Contanti'), '2026-09-07')::text as calcolato_prima \gset
select somme() as somme_prima, senza_persona() as sp_prima \gset

\echo ''
\echo '--- 3. il riepilogo prima di scrivere: sicuri, da decidere, senza scheda ---'
select come('22222222-2222-2222-2222-222222222222', $q$select riepilogo_collegamenti_persona()::text$q$) as rie \gset
select atteso('sicuri 7 di 5 persone, da decidere i due omonimi, senza scheda Paolo e il bonifico anonimo, nessuno già collegato',
  (:'rie'::jsonb - 'campione')::text,
  '{"sicuri": {"movimenti": 7, "persone": 5, "centesimi": 53900, "dal": "2023-11-05", "al": "2026-09-03"}, "da_decidere": {"movimenti": 2, "centesimi": 9000}, "senza_scheda": {"movimenti": 2, "centesimi": 7500}, "gia_collegati": 0}'::jsonb::text);
select atteso('il campione: cinque esempi, ognuno con la sua causale e la persona giusta',
  (select count(*)::text || '/' || count(*) filter (where v.persona = e->>'persona')::text from jsonb_array_elements((:'rie'::jsonb)->'campione') e left join (values
    ('Cliente Giulia Verdi per annuale judo kids', 'Giulia Verdi'), ('Cliente VERDI GIULIA per quota associativa', 'Giulia Verdi'),
    ('Cliente Marco Bianchi per mensile judo', 'Marco Bianchi'), ($$Cliente Elena D'Angelo per corso danza$$, $$Elena D'Angelo$$),
    ('Cliente Maria Grazia Fontana per corso', 'Maria Grazia Fontana'), ('Cliente Jose Ferrari per quota associativa', 'José Ferrari'),
    (E'Cliente\nJOSÈ  FERRARI\nper mensile', 'José Ferrari')) v(causale, persona) on v.causale = e->>'causale'), '5/5');
select atteso('il riepilogo non scrive niente', quante_tracce() || '/' || (select count(*)::text from movimenti where persona_id is not null), '0/0');
select atteso('gli esiti per riga: 7 sicuri, 2 omonimi, 2 senza scheda, e non c''è altro (né uscite, né giroconti, né annullati, né il movimento a mano, né la differenza)', esiti_conta(), '7/2/2 di 11');
select atteso('…gli stessi numeri del riepilogo', esiti_conta(), riepilogo_conta());
select atteso('…riga per riga: Giulia, Marco, Elena, la Fontana e José sicuri; le due Sara omonime; Paolo e l''anonimo senza scheda; le altre assenti',
  (select string_agg(n || ':' || esito_di(n), ' ' order by n) from generate_series(1, 14) n),
  '1:sicuro 2:sicuro 3:sicuro 4:omonimi 5:omonimi 6:nessuna 7:sicuro 8:sicuro 9:sicuro 10:nessuna 11:assente 12:assente 13:assente 14:sicuro');
select atteso('i candidati di una causale: Giulia è una sola (anche scritta cognome e nome), e di una sola si dice solo il nome: anno di nascita, corsi e data restano vuoti', come('22222222-2222-2222-2222-222222222222',
  format($q$select coalesce(string_agg(c.nome || ' ' || c.cognome || ' ' || coalesce(c.anno_nascita::text, '?') || ' ' || coalesce(array_to_string(c.corsi, ','), '') || ' ' || coalesce(c.iscritto_dal::text, '-'), ' | '), 'nessuno') from candidati_persona_movimento(%L) c$q$, id_n(2))),
  'Giulia Verdi ?  -');
select atteso('…le due Sara Neri si distinguono per anno di nascita, corso e data di iscrizione', come('22222222-2222-2222-2222-222222222222',
  format($q$select coalesce(string_agg(c.nome || ' ' || c.cognome || ' ' || coalesce(c.anno_nascita::text, '?') || ' ' || coalesce(array_to_string(c.corsi, ','), '') || ' ' || coalesce(c.iscritto_dal::text, '-'), ' | ' order by c.anno_nascita), 'nessuno') from candidati_persona_movimento(%L) c$q$, id_n(4))),
  'Sara Neri 2010 Judo kids 2024-09-10 | Sara Neri 2012 Danza 2025-01-15');
select atteso('…anche per la causale scritta alla rovescia', come('22222222-2222-2222-2222-222222222222',
  format($q$select count(*)::text from candidati_persona_movimento(%L)$q$, id_n(5))), '2');
select atteso('…la causale con a capo, spazi doppi e accento trova José', come('22222222-2222-2222-2222-222222222222',
  format($q$select coalesce(string_agg(c.nome || ' ' || c.cognome, ' | '), 'nessuno') from candidati_persona_movimento(%L) c$q$, id_n(14))), 'José Ferrari');
select atteso('…chi non ha scheda: nessuno', come('22222222-2222-2222-2222-222222222222',
  format($q$select coalesce(string_agg(c.nome, ' | '), 'nessuno') from candidati_persona_movimento(%L) c$q$, id_n(6))), 'nessuno');
select atteso('…una causale che non è «Cliente … per …»: nessuno', come('22222222-2222-2222-2222-222222222222',
  format($q$select coalesce(string_agg(c.nome, ' | '), 'nessuno') from candidati_persona_movimento(%L) c$q$, id_n(10))), 'nessuno');

\echo ''
\echo '--- 4. a mano: uno solo, una persona sola; cambiare un collegamento lascia prima e dopo ---'
select atteso('collego il «VERDI GIULIA» a Marco (per sbaglio, apposta): 1 collegato, 0 già così',
  come_json('22222222-2222-2222-2222-222222222222', format($q$select collega_movimenti_persona(%s, %L)::text$q$, lista(2), pid(2))), '{"collegati": 1, "gia_cosi": 0}'::jsonb::text);
select atteso('una scheda inattiva si può collegare', persona_di(2), 'Marco Bianchi');
select atteso('la traccia: una riga, senza persona prima, Marco dopo', traccia_di(2) || ' / ' || quante_tracce(), '— → Marco Bianchi / 1');
select atteso('…con chi l''ha fatto, quando e senza lotto', (select p.nome || ' ' || (c.fatto_il > now() - interval '1 minute')::text || ' ' || coalesce(c.lotto::text, 'senza lotto')
  from collegamenti_persona c join persone p on p.id = c.fatto_da where c.movimento_id = id_n(2)), 'Ada true senza lotto');
select atteso('…e con i nomi scritti nella traccia, senza legami alla scheda: chi l''ha fatto, la persona di prima e quella di dopo', (select coalesce(c.fatto_da_nome, '?') || ': ' || coalesce(c.persona_prima_nome, '—') || ' → ' || coalesce(c.persona_dopo_nome, '—')
  from collegamenti_persona c where c.movimento_id = id_n(2)), 'Ada Conti: — → Marco Bianchi');
select atteso('importo, data, cassa, voce, testo: tutto com''era; saldi, bilancio, previsto e chiusure uguali', senza_persona() || ' ' || somme(), :'sp_prima' || ' ' || :'somme_prima');
select come('22222222-2222-2222-2222-222222222222', $q$select riepilogo_collegamenti_persona()::text$q$) as rie \gset
select atteso('il riepilogo ora: uno già collegato, sei sicuri da 50900',
  (:'rie'::jsonb - 'campione')::text,
  '{"sicuri": {"movimenti": 6, "persone": 5, "centesimi": 50900, "dal": "2023-11-05", "al": "2026-09-03"}, "da_decidere": {"movimenti": 2, "centesimi": 9000}, "senza_scheda": {"movimenti": 2, "centesimi": 7500}, "gia_collegati": 1}'::jsonb::text);

\echo ''
\echo '--- 5. il blocco dei sicuri: solo chi ha una scheda sola, mai chi è già di un altro ---'
select atteso('dopo un collegamento a mano il movimento esce dall''elenco degli esiti', esito_di(2) || ' ' || esiti_conta(), 'assente 6/2/2 di 10');
select atteso('il blocco prende i sei sicuri e dice che non ne restano', come_json('22222222-2222-2222-2222-222222222222',
  format($q$select collega_sicuri_persona(%L, 500)::text$q$, lotto(1))), '{"collegati": 6, "restano": 0}'::jsonb::text);
select atteso('ognuno è andato alla sua scheda: ordine nome-cognome o cognome-nome, spazi, a capo, apostrofo, nome doppio, accento',
  stato(14), $$1:Giulia Verdi 2016 2:Marco Bianchi 3:Marco Bianchi 4:— 5:— 6:— 7:Elena D'Angelo 8:Maria Grazia Fontana 9:José Ferrari 1990 10:— 11:— 12:— 13:— 14:José Ferrari 1990$$);
select atteso('…il «VERDI GIULIA» già di Marco non si è mosso, i due omonimi, Paolo e l''anonimo senza persona', (stato(14) ~ '2:Marco Bianchi')::text, 'true');
select atteso('la traccia: sei righe col lotto, una a mano', (select count(*) filter (where lotto = lotto(1))::text || '/' || count(*) filter (where lotto is null)::text || '/' || quante_tracce() from collegamenti_persona), '6/1/7');
select atteso('…del lotto: prima nessuno, dopo uno, fatto da Ada', (select count(*)::text || ' ' || string_agg(distinct p.nome, ',') || ' ' || count(*) filter (where c.persona_prima_id is null and c.persona_dopo_id is not null)::text
  from collegamenti_persona c join persone p on p.id = c.fatto_da where c.lotto = lotto(1)), '6 Ada 6');
select atteso('il blocco non tocca importi, date, casse, voci, testi, saldi, bilancio, previsto, chiusure', senza_persona() || ' ' || somme(), :'sp_prima' || ' ' || :'somme_prima');
select atteso('il movimento di un giorno chiuso si è collegato (è un''etichetta)', persona_di(3), 'Marco Bianchi');
select atteso('…e la chiusura è quella di prima', (select previsto::text || '/' || differenza::text from chiusure_cassa where annullata_il is null), :'chiusura_prima');
select atteso('rilanciato (con un lotto nuovo, e senza dire quanti): niente da collegare', come_json('22222222-2222-2222-2222-222222222222',
  format($q$select collega_sicuri_persona(%L)::text$q$, lotto(2))), '{"collegati": 0, "restano": 0}'::jsonb::text);
select atteso('…e la traccia non è cresciuta', quante_tracce(), '7');
select atteso('dopo il blocco gli esiti restano solo omonimi e senza scheda, come il riepilogo', esiti_conta() || ' = ' || riepilogo_conta(), '0/2/2 di 4 = 0/2/2 di 4');
select come('22222222-2222-2222-2222-222222222222', $q$select riepilogo_collegamenti_persona()::text$q$) as rie \gset
select atteso('il riepilogo dopo: nessun sicuro da collegare, sette già collegati, il resto com''era',
  (:'rie'::jsonb - 'campione')::text,
  '{"sicuri": {"movimenti": 0, "persone": 0, "centesimi": 0, "dal": null, "al": null}, "da_decidere": {"movimenti": 2, "centesimi": 9000}, "senza_scheda": {"movimenti": 2, "centesimi": 7500}, "gia_collegati": 7}'::jsonb::text);
select atteso('…e il campione è vuoto', jsonb_array_length((:'rie'::jsonb)->'campione')::text, '0');
select impronta() as prima_lotti \gset
select atteso('quanti = 0', come_esito('22222222-2222-2222-2222-222222222222', format($q$select collega_sicuri_persona(%L, 0)::text$q$, lotto(3))), '22023 Scegli almeno un movimento');
select atteso('cinquecentouno in un colpo', come_esito('22222222-2222-2222-2222-222222222222', format($q$select collega_sicuri_persona(%L, 501)::text$q$, lotto(3))), '22023 Troppi movimenti in una volta: al massimo 500');
select atteso('dei rifiuti non è rimasto niente', impronta(), :'prima_lotti');

\echo ''
\echo '--- 6. a mano ancora: correggere, gli omonimi, scollegare, il giorno chiuso ---'
select atteso('metto a posto il «VERDI GIULIA»: da Marco a Giulia', come_json('22222222-2222-2222-2222-222222222222',
  format($q$select collega_movimenti_persona(%s, %L)::text$q$, lista(2), pid(1))), '{"collegati": 1, "gia_cosi": 0}'::jsonb::text);
select atteso('la traccia ha prima e dopo', traccia_di(2), '— → Marco Bianchi | Marco Bianchi → Giulia Verdi 2016');
select atteso('rifatto uguale: già così, e la traccia non cresce', come_json('22222222-2222-2222-2222-222222222222',
  format($q$select collega_movimenti_persona(%s, %L)::text$q$, lista(2), pid(1))), '{"collegati": 0, "gia_cosi": 1}'::jsonb::text);
select atteso('…la traccia è quella di prima', traccia_di(2) || ' / ' || quante_tracce(), '— → Marco Bianchi | Marco Bianchi → Giulia Verdi 2016 / 8');
select atteso('gli omonimi: il primo Sara Neri (2010), lo stesso id due volte conta una', come_json('22222222-2222-2222-2222-222222222222',
  format($q$select collega_movimenti_persona(array[%L, %L]::uuid[], %L)::text$q$, id_n(4), id_n(4), pid(3))), '{"collegati": 1, "gia_cosi": 0}'::jsonb::text);
select atteso('…il secondo alla Sara Neri (2012)', come_json('22222222-2222-2222-2222-222222222222',
  format($q$select collega_movimenti_persona(%s, %L)::text$q$, lista(5), pid(4))), '{"collegati": 1, "gia_cosi": 0}'::jsonb::text);
select atteso('…un movimento ha una persona sola: lo sposto sull''altra', come_json('22222222-2222-2222-2222-222222222222',
  format($q$select collega_movimenti_persona(%s, %L)::text$q$, lista(4), pid(4))), '{"collegati": 1, "gia_cosi": 0}'::jsonb::text);
select atteso('…e la traccia sa da chi a chi', traccia_di(4), '— → Sara Neri 2010 | Sara Neri 2010 → Sara Neri 2012');
select atteso('…poi torna alla prima', come_json('22222222-2222-2222-2222-222222222222',
  format($q$select collega_movimenti_persona(%s, %L)::text$q$, lista(4), pid(3))), '{"collegati": 1, "gia_cosi": 0}'::jsonb::text);
select atteso('…di chi sono ora', persona_di(4) || ' / ' || persona_di(5), 'Sara Neri 2010 / Sara Neri 2012');
select atteso('prima di scollegare il quinto (alla Sara Neri 2012) non è negli esiti', esito_di(5), 'assente');
select atteso('scollegare: il quinto sì, il sesto non aveva nessuno', come_json('22222222-2222-2222-2222-222222222222',
  format($q$select scollega_movimenti_persona(%s)::text$q$, lista(5, 6))), '{"scollegati": 1, "gia_senza": 1}'::jsonb::text);
select atteso('…dopo lo scollegamento il quinto rientra negli esiti, come omonimo', esito_di(5) || ' ' || esiti_conta(), 'omonimi 0/1/2 di 3');
select atteso('…la traccia: prima la Sara Neri (2012), dopo nessuno', traccia_di(5), '— → Sara Neri 2012 | Sara Neri 2012 → —');
select atteso('…rifatto: nessuno da scollegare, e la traccia di Paolo resta vuota', come_json('22222222-2222-2222-2222-222222222222',
  format($q$select scollega_movimenti_persona(%s)::text$q$, lista(5, 6))) || ' / ' || traccia_di(6), '{"gia_senza": 2, "scollegati": 0}'::jsonb::text || ' / nessuna');
-- Il giorno chiuso: l'etichetta si cambia, la chiusura non se ne accorge.
select atteso('un movimento di un giorno chiuso (3 settembre, la cassa è chiusa al 7) cambia scheda', come_json('22222222-2222-2222-2222-222222222222',
  format($q$select collega_movimenti_persona(%s, %L)::text$q$, lista(3), pid(1))), '{"collegati": 1, "gia_cosi": 0}'::jsonb::text);
select atteso('…la chiusura è quella di prima: previsto e differenza', (select previsto::text || '/' || differenza::text from chiusure_cassa where annullata_il is null), :'chiusura_prima');
select atteso('…e il previsto calcolato adesso è lo stesso', previsto_cassa(id_cassa('Cassa Contanti'), '2026-09-07')::text, :'calcolato_prima');
select atteso('…il giorno è ancora chiuso: un movimento nuovo lì no', come_esito('22222222-2222-2222-2222-222222222222', format($q$select registra_movimento(%L::jsonb)::text$q$,
  jsonb_build_object('tipo', 'entrata', 'data', '2026-09-06', 'importo', 100, 'voce_id', id_voce('Quota associativa', 'entrata'), 'cassa_id', id_cassa('Cassa Contanti'), 'descrizione', 'No'))),
  '22023 Quel giorno è già chiuso: per correggere scrivi il movimento con una data dopo la chiusura e una voce di rettifica (si crea in VOCI), oppure annulla la chiusura');
select atteso('niente di questo ha toccato i conti', senza_persona() || ' ' || somme(), :'sp_prima' || ' ' || :'somme_prima');

\echo ''
\echo '--- 7. quel che non va si rifiuta, e un lotto o entra tutto o niente ---'
select impronta() as prima \gset
select atteso('nessun movimento', come_esito('22222222-2222-2222-2222-222222222222', format($q$select collega_movimenti_persona(array[]::uuid[], %L)::text$q$, pid(1))), '22023 Scegli almeno un movimento');
select atteso('nessuna lista', come_esito('22222222-2222-2222-2222-222222222222', format($q$select collega_movimenti_persona(null, %L)::text$q$, pid(1))), '22023 Scegli almeno un movimento');
select atteso('cinquecentouno movimenti', come_esito('22222222-2222-2222-2222-222222222222', format($q$select collega_movimenti_persona(array(select gen_random_uuid() from generate_series(1, 501)), %L)::text$q$, pid(1))), '22023 Troppi movimenti in una volta: al massimo 500');
select atteso('senza persona', come_esito('22222222-2222-2222-2222-222222222222', format($q$select collega_movimenti_persona(%s, null)::text$q$, lista(6))), '22023 Scegli la persona');
select atteso('una persona che non c''è', come_esito('22222222-2222-2222-2222-222222222222', format($q$select collega_movimenti_persona(%s, gen_random_uuid())::text$q$, lista(6))), '22023 Scegli la persona');
select atteso('un movimento che non c''è', come_esito('22222222-2222-2222-2222-222222222222', format($q$select collega_movimenti_persona(array[gen_random_uuid()], %L)::text$q$, pid(1))), 'P0002 Il movimento non c’è');
select atteso('un annullato', come_esito('22222222-2222-2222-2222-222222222222', format($q$select collega_movimenti_persona(%s, %L)::text$q$, lista(13), pid(1))), '22023 Il movimento del 04/03/2025 (Cliente Giulia Verdi per extra) è annullato: non si collega');
select atteso('un giroconto', come_esito('22222222-2222-2222-2222-222222222222', format($q$select collega_movimenti_persona(array[%L]::uuid[], %L)::text$q$, (select id from movimenti where tipo = 'giroconto'), pid(1))), '22023 Un giroconto non ha una persona');
select atteso('un''uscita', come_esito('22222222-2222-2222-2222-222222222222', format($q$select collega_movimenti_persona(%s, %L)::text$q$, lista(12), pid(1))), '22023 Il movimento del 03/03/2025 (Cliente Giulia Verdi per rimborso) è un’uscita: si collegano solo le entrate');
select atteso('la differenza di una chiusura', come_esito('22222222-2222-2222-2222-222222222222', format($q$select collega_movimenti_persona(array[%L]::uuid[], %L)::text$q$, id_mov('Differenza di cassa'), pid(1))), '22023 Il movimento del 07/09/2026 (Differenza di cassa) è scritto dalla chiusura di cassa: non si collega');
select atteso('un movimento scritto a mano, anche su «Quota associativa» e con un nome nel testo', come_esito('22222222-2222-2222-2222-222222222222', format($q$select collega_movimenti_persona(array[%L]::uuid[], %L)::text$q$, id_mov('Cliente Giulia Verdi per mano'), pid(1))), '22023 Il movimento del 10/09/2026 (Cliente Giulia Verdi per mano) non viene dal vecchio programma: non si collega');
select atteso('un''entrata su «Da classificare»', come_esito('22222222-2222-2222-2222-222222222222', format($q$select collega_movimenti_persona(%s, %L)::text$q$, lista(11), pid(1))), '22023 Il movimento del 02/03/2025 (Cliente Giulia Verdi per regalo) è su «Da classificare»: si collegano solo quelli su «Quota associativa» e «Corsi e altri pagamenti»');
select atteso('uno cattivo in fondo ferma il lotto e dice quale', come_esito('22222222-2222-2222-2222-222222222222', format($q$select collega_movimenti_persona(%s, %L)::text$q$, lista(5, 6, 11), pid(4))), '22023 Il movimento del 02/03/2025 (Cliente Giulia Verdi per regalo) è su «Da classificare»: si collegano solo quelli su «Quota associativa» e «Corsi e altri pagamenti»');
select atteso('scollegare: nessun movimento', come_esito('22222222-2222-2222-2222-222222222222', $q$select scollega_movimenti_persona(array[]::uuid[])::text$q$), '22023 Scegli almeno un movimento');
select atteso('scollegare: cinquecentouno', come_esito('22222222-2222-2222-2222-222222222222', $q$select scollega_movimenti_persona(array(select gen_random_uuid() from generate_series(1, 501)))::text$q$), '22023 Troppi movimenti in una volta: al massimo 500');
select atteso('scollegare: un movimento che non c''è', come_esito('22222222-2222-2222-2222-222222222222', $q$select scollega_movimenti_persona(array[gen_random_uuid()])::text$q$), 'P0002 Il movimento non c’è');
select atteso('i candidati di un movimento che non c''è', come_esito('22222222-2222-2222-2222-222222222222', $q$select candidati_persona_movimento(gen_random_uuid())::text$q$), 'P0002 Il movimento non c’è');
select atteso('dei rifiuti non è rimasto niente: né persone, né traccia', impronta(), :'prima');
select atteso('la segreteria semplice non collega, nemmeno chiamando la funzione a mano', come_esito('11111111-1111-1111-1111-111111111111', format($q$select collega_movimenti_persona(%s, %L)::text$q$, lista(6), pid(1))), '42501 la contabilità la cura l’amministrazione');
select atteso('…né scollega', come_esito('11111111-1111-1111-1111-111111111111', format($q$select scollega_movimenti_persona(%s)::text$q$, lista(1))), '42501 la contabilità la cura l’amministrazione');
select atteso('…né fa il blocco', come_esito('11111111-1111-1111-1111-111111111111', format($q$select collega_sicuri_persona(%L)::text$q$, lotto(9))), '42501 la contabilità la cura l’amministrazione');
select atteso('…l''istruttore nemmeno', come_esito('55555555-5555-5555-5555-555555555555', format($q$select collega_movimenti_persona(%s, %L)::text$q$, lista(6), pid(1))), '42501 la contabilità la cura l’amministrazione');
select atteso('…l''iscritto nemmeno', come_esito('77777777-7777-7777-7777-777777777777', format($q$select collega_movimenti_persona(%s, %L)::text$q$, lista(6), pid(1))), '42501 la contabilità la cura l’amministrazione');
select atteso('…il tablet nemmeno', come_esito('99999999-9999-9999-9999-999999999999', format($q$select collega_movimenti_persona(%s, %L)::text$q$, lista(6), pid(1))), '42501 la contabilità la cura l’amministrazione');
select atteso('…e non è cambiato niente', impronta(), :'prima');

\echo ''
\echo '--- 8. TOGLI QUESTO LOTTO: solo quel che è ancora come l''ha lasciato il lotto ---'
select quante_tracce() as n0 \gset
select atteso('una mano ricollega la Fontana alla segreteria (apposta, dopo il lotto)', come_json('22222222-2222-2222-2222-222222222222',
  format($q$select collega_movimenti_persona(%s, 'aaaaaaaa-0000-0000-0000-000000000001')::text$q$, lista(8))), '{"collegati": 1, "gia_cosi": 0}'::jsonb::text);
select atteso('…e il movimento del giorno chiuso è passato a Giulia a mano (sopra)', persona_di(3) || ' / ' || persona_di(8), 'Giulia Verdi 2016 / Anna Segreteria');
select atteso('si toglie il lotto: tornano senza persona solo i quattro che nessuno ha toccato', come_json('22222222-2222-2222-2222-222222222222',
  format($q$select togli_lotto_collegamenti(%L)::text$q$, lotto(1))), '{"tolti": 4}'::jsonb::text);
select atteso('…quelli ricollegati a mano restano dove li ha messi la mano; il «VERDI GIULIA» non era del lotto',
  stato(14), $$1:— 2:Giulia Verdi 2016 3:Giulia Verdi 2016 4:Sara Neri 2010 5:— 6:— 7:— 8:Anna Segreteria 9:— 10:— 11:— 12:— 13:— 14:—$$);
select atteso('…la traccia sa cosa è tornato indietro', traccia_di(1) || ' / ' || (:'n0'::int + 1 + 4 = quante_tracce()::int)::text, '— → Giulia Verdi 2016 | Giulia Verdi 2016 → — / true');
select atteso('togliere due volte lo stesso lotto: niente da togliere', come_json('22222222-2222-2222-2222-222222222222',
  format($q$select togli_lotto_collegamenti(%L)::text$q$, lotto(1))), '{"tolti": 0}'::jsonb::text);
select atteso('un lotto che non c''è: niente da togliere, nessun errore', come_json('22222222-2222-2222-2222-222222222222',
  format($q$select togli_lotto_collegamenti(%L)::text$q$, lotto(99))), '{"tolti": 0}'::jsonb::text);
select atteso('tolto il lotto, conti uguali', senza_persona() || ' ' || somme(), :'sp_prima' || ' ' || :'somme_prima');
select atteso('il riepilogo ritrova i quattro sicuri (Giulia, Elena, José): quelli di Giulia/Anna già collegati no',
  come_json('22222222-2222-2222-2222-222222222222', $q$select (riepilogo_collegamenti_persona() - 'campione')::text$q$),
  '{"sicuri": {"movimenti": 4, "persone": 3, "centesimi": 40700, "dal": "2023-11-05", "al": "2026-05-10"}, "da_decidere": {"movimenti": 1, "centesimi": 4500}, "senza_scheda": {"movimenti": 2, "centesimi": 7500}, "gia_collegati": 4}'::jsonb::text);
select atteso('gli esiti ritrovano i quattro sicuri e coincidono con il riepilogo', esiti_conta() || ' = ' || riepilogo_conta(), '4/1/2 di 7 = 4/1/2 di 7');
select atteso('un altro blocco: i quattro tornano, i due già di un''altra persona non si spostano', come_json('22222222-2222-2222-2222-222222222222',
  format($q$select collega_sicuri_persona(%L)::text$q$, lotto(3))), '{"collegati": 4, "restano": 0}'::jsonb::text);
select atteso('…di chi sono ora', stato(14), $$1:Giulia Verdi 2016 2:Giulia Verdi 2016 3:Giulia Verdi 2016 4:Sara Neri 2010 5:— 6:— 7:Elena D'Angelo 8:Anna Segreteria 9:José Ferrari 1990 10:— 11:— 12:— 13:— 14:José Ferrari 1990$$);
select atteso('rimetto a mano il giorno chiuso con Marco e la Fontana con la sua scheda', come_json('22222222-2222-2222-2222-222222222222',
  format($q$select collega_movimenti_persona(%s, %L)::text$q$, lista(3), pid(2))) || ' ' || come_json('22222222-2222-2222-2222-222222222222',
  format($q$select collega_movimenti_persona(%s, %L)::text$q$, lista(8), pid(6))), '{"collegati": 1, "gia_cosi": 0}'::jsonb::text || ' ' || '{"collegati": 1, "gia_cosi": 0}'::jsonb::text);
select atteso('…le righe del lotto di prima nella traccia sono quattro', (select count(*)::text from collegamenti_persona where lotto = lotto(3)), '4');
select atteso('stato di tutto lo storico', stato(14), $$1:Giulia Verdi 2016 2:Giulia Verdi 2016 3:Marco Bianchi 4:Sara Neri 2010 5:— 6:— 7:Elena D'Angelo 8:Maria Grazia Fontana 9:José Ferrari 1990 10:— 11:— 12:— 13:— 14:José Ferrari 1990$$);
select atteso('tutto questo non ha cambiato un solo importo, saldo, voce o chiusura', senza_persona() || ' ' || somme(), :'sp_prima' || ' ' || :'somme_prima');

\echo ''
\echo '--- 9. lo storico di una scheda: solo i collegati non annullati, dal più recente ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select importa_prima_nota(jsonb_build_array(
  riga('prima-nota:15', '2025-02-02', 'conto', 'entrata', 3000, 'Cliente Elena D''Angelo per iscrizione', 'Corsi e altri pagamenti'))) as nuove \gset
reset role;
select atteso('un movimento nuovo dall''import: il blocco lo collega da sé', come_json('22222222-2222-2222-2222-222222222222',
  format($q$select collega_sicuri_persona(%L)::text$q$, lotto(4))), '{"collegati": 1, "restano": 0}'::jsonb::text);
select atteso('…a Elena', persona_di(15), $$Elena D'Angelo$$);
select atteso('lo storico di Elena: due movimenti, dal più recente (2 febbraio 2025, poi 15 ottobre 2024)', come('11111111-1111-1111-1111-111111111111',
  format($q$select coalesce(string_agg(s.data || '|' || s.descrizione || '|' || s.importo || '|' || s.voce || '|' || s.cassa, ' ; '), 'nessuno') from storico_persona(%L) s$q$, pid(5))),
  $$2025-02-02|Cliente Elena D'Angelo per iscrizione|3000|Corsi e altri pagamenti|Conto Corrente ; 2024-10-15|Cliente Elena D'Angelo per corso danza|5200|Corsi e altri pagamenti|Conto Corrente$$);
select atteso('annullato dopo il collegamento: l''annullo si fa', come_esito('22222222-2222-2222-2222-222222222222', format($q$select (annulla_movimento(%L) is not null)::text$q$, id_n(15))), 'true');
select atteso('…l''etichetta resta', persona_di(15), $$Elena D'Angelo$$);
select atteso('…ma esce dallo storico: ne resta uno', come('11111111-1111-1111-1111-111111111111',
  format($q$select coalesce(string_agg(s.data || '|' || s.descrizione || '|' || s.importo, ' ; '), 'nessuno') from storico_persona(%L) s$q$, pid(5))),
  $$2024-10-15|Cliente Elena D'Angelo per corso danza|5200$$);
select atteso('lo storico di Giulia (minorenne): due, dal più recente, con voce e cassa', come('11111111-1111-1111-1111-111111111111',
  format($q$select coalesce(string_agg(s.data || '|' || s.descrizione || '|' || s.importo || '|' || s.voce || '|' || s.cassa, ' ; '), 'nessuno') from storico_persona(%L) s$q$, pid(1))),
  '2025-09-03|Cliente VERDI GIULIA per quota associativa|3000|Quota associativa|Conto Corrente ; 2025-09-02|Cliente Giulia Verdi per annuale judo kids|31000|Corsi e altri pagamenti|Conto Corrente');
select atteso('…l''amministrazione che non è segreteria vede lo stesso', come('22222222-2222-2222-2222-222222222222',
  format($q$select count(*)::text from storico_persona(%L)$q$, pid(1))), '2');
select atteso('…anche la segreteria con anche_amministrazione', come('33333333-3333-3333-3333-333333333333',
  format($q$select count(*)::text from storico_persona(%L)$q$, pid(1))), '2');
select atteso('lo storico di Marco: il giorno chiuso, in contanti', come('11111111-1111-1111-1111-111111111111',
  format($q$select coalesce(string_agg(s.data || '|' || s.importo || '|' || s.cassa, ' ; '), 'nessuno') from storico_persona(%L) s$q$, pid(2))), '2026-09-03|4700|Cassa Contanti');
select atteso('una scheda senza storico: nessuno', come('11111111-1111-1111-1111-111111111111',
  format($q$select coalesce(string_agg(s.descrizione, ' ; '), 'nessuno') from storico_persona(%L) s$q$, pid(4))), 'nessuno');
select atteso('una scheda che non c''è: nessuno, senza errori', come('11111111-1111-1111-1111-111111111111',
  $q$select coalesce(string_agg(s.descrizione, ' ; '), 'nessuno') from storico_persona(gen_random_uuid()) s$q$), 'nessuno');
select atteso('lo storico di una minorenne: solo segreteria e amministrazione, come i pagamenti', matrice(format('select storico_persona(%L)', pid(1))), :'scheda_ok');
select atteso('l''iscritto Luca non vede il suo', (come_esito('77777777-7777-7777-7777-777777777777', $q$select storico_persona('aaaaaaaa-0000-0000-0000-000000000007')::text$q$) like '42501%')::text, 'true');
select atteso('l''istruttore no', (come_esito('55555555-5555-5555-5555-555555555555', format($q$select storico_persona(%L)::text$q$, pid(1))) like '42501%')::text, 'true');
select atteso('il tablet no', (come_esito('99999999-9999-9999-9999-999999999999', format($q$select storico_persona(%L)::text$q$, pid(1))) like '42501%')::text, 'true');
select atteso('la segreteria semplice non legge i movimenti: la persona la sa solo dallo storico della scheda', viste('11111111-1111-1111-1111-111111111111', 'authenticated', 'select count(*)::text from movimenti where persona_id is not null'), '0');
select atteso('l''iscritto nemmeno', viste('77777777-7777-7777-7777-777777777777', 'authenticated', 'select count(*)::text from movimenti where persona_id is not null'), '0');
select atteso('il tablet nemmeno', viste('99999999-9999-9999-9999-999999999999', 'authenticated', 'select count(*)::text from movimenti where persona_id is not null'), '0');
select atteso('l''amministrazione sì', viste('22222222-2222-2222-2222-222222222222', 'authenticated', 'select count(*)::text from movimenti where persona_id is not null'),
  (select count(*)::text from movimenti where persona_id is not null));
select atteso('anon non ha nemmeno il permesso di leggere i movimenti', viste('00000000-0000-0000-0000-000000000000', 'anon', 'select count(*)::text from movimenti where persona_id is not null'), 'NEGATO: permission denied for table movimenti');

\echo ''
\echo '--- 10. la traccia: la legge solo l''amministrazione, non la scrive nessuno da fuori ---'
select atteso('l''amministrazione la legge', viste('22222222-2222-2222-2222-222222222222', 'authenticated', 'select count(*)::text from collegamenti_persona'), quante_tracce());
select atteso('anche la segreteria con anche_amministrazione', viste('33333333-3333-3333-3333-333333333333', 'authenticated', 'select count(*)::text from collegamenti_persona'), quante_tracce());
select atteso('la segreteria semplice non ne vede una', viste('11111111-1111-1111-1111-111111111111', 'authenticated', 'select count(*)::text from collegamenti_persona'), '0');
select atteso('l''istruttore no', viste('55555555-5555-5555-5555-555555555555', 'authenticated', 'select count(*)::text from collegamenti_persona'), '0');
select atteso('l''iscritto no', viste('77777777-7777-7777-7777-777777777777', 'authenticated', 'select count(*)::text from collegamenti_persona'), '0');
select atteso('il tablet no', viste('99999999-9999-9999-9999-999999999999', 'authenticated', 'select count(*)::text from collegamenti_persona'), '0');
select atteso('anon non ha il permesso di leggerla', viste('00000000-0000-0000-0000-000000000000', 'anon', 'select count(*)::text from collegamenti_persona'), 'NEGATO: permission denied for table collegamenti_persona');
select atteso('nessuno scrive dritto sulla traccia: l''amministrazione', scritture_negate('22222222-2222-2222-2222-222222222222', 'authenticated', 'collegamenti_persona', array[
  $q$insert into collegamenti_persona (movimento_id) values (gen_random_uuid())$q$, $q$update collegamenti_persona set fatto_il = now()$q$, $q$delete from collegamenti_persona$q$]), '3/3');
select atteso('…la segreteria', scritture_negate('11111111-1111-1111-1111-111111111111', 'authenticated', 'collegamenti_persona', array[
  $q$insert into collegamenti_persona (movimento_id) values (gen_random_uuid())$q$, $q$update collegamenti_persona set fatto_il = now()$q$, $q$delete from collegamenti_persona$q$]), '3/3');
select atteso('…anon', scritture_negate('00000000-0000-0000-0000-000000000000', 'anon', 'collegamenti_persona', array[
  $q$insert into collegamenti_persona (movimento_id) values (gen_random_uuid())$q$, $q$update collegamenti_persona set fatto_il = now()$q$, $q$delete from collegamenti_persona$q$]), '3/3');
select atteso('la persona di un movimento non si scrive dritta: nemmeno l''amministrazione', scritture_negate('22222222-2222-2222-2222-222222222222', 'authenticated', 'movimenti', array[
  $q$update movimenti set persona_id = null$q$, $q$update movimenti set persona_id = 'aaaaaaaa-0000-0000-0000-000000000001'$q$]), '2/2');
select atteso('…né la segreteria', scritture_negate('11111111-1111-1111-1111-111111111111', 'authenticated', 'movimenti', array[
  $q$update movimenti set persona_id = null$q$, $q$update movimenti set persona_id = 'aaaaaaaa-0000-0000-0000-000000000001'$q$]), '2/2');

\echo ''
\echo '--- 11. due schede che sono la stessa persona: unisci_persone porta con sé i movimenti ---'
insert into persone (id, nome, cognome, ruolo) values (pid(8), 'Carlo', 'Sala', 'iscritto'), (pid(9), 'Carlo', 'Sala', 'iscritto');
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select importa_prima_nota(jsonb_build_array(
  riga('prima-nota:16', '2025-04-01', 'conto', 'entrata', 3500, 'Cliente Carlo Sala per mensile', 'Corsi e altri pagamenti'),
  riga('prima-nota:17', '2025-04-02', 'conto', 'entrata', 3000, 'Cliente Sala Carlo per quota', 'Quota associativa'))) as nuove \gset
reset role;
select somme() as somme_prima, senza_persona() as sp_prima \gset
select atteso('con due Carlo Sala il blocco non decide: da decidere, mai in blocco',
  come_json('22222222-2222-2222-2222-222222222222', $q$select (riepilogo_collegamenti_persona() - 'campione')::text$q$),
  '{"sicuri": {"movimenti": 0, "persone": 0, "centesimi": 0, "dal": null, "al": null}, "da_decidere": {"movimenti": 3, "centesimi": 11000}, "senza_scheda": {"movimenti": 2, "centesimi": 7500}, "gia_collegati": 8}'::jsonb::text);
select atteso('…gli esiti: i due Carlo Sala sono omonimi come l''altro, e coincidono con il riepilogo', esito_di(16) || ' ' || esito_di(17) || ' ' || esiti_conta() || ' = ' || riepilogo_conta(), 'omonimi omonimi 0/3/2 di 5 = 0/3/2 di 5');
select atteso('…il blocco lascia stare',come_json('22222222-2222-2222-2222-222222222222', format($q$select collega_sicuri_persona(%L)::text$q$, lotto(5))), '{"collegati": 0, "restano": 0}'::jsonb::text);
select atteso('…collego a mano uno a una scheda e uno all''altra', come_json('22222222-2222-2222-2222-222222222222',
  format($q$select collega_movimenti_persona(%s, %L)::text$q$, lista(16), pid(8))) || ' ' || come_json('22222222-2222-2222-2222-222222222222',
  format($q$select collega_movimenti_persona(%s, %L)::text$q$, lista(17), pid(9))), '{"collegati": 1, "gia_cosi": 0}'::jsonb::text || ' ' || '{"collegati": 1, "gia_cosi": 0}'::jsonb::text);
-- Chi se ne va cambia cognome prima dell'unione: i nomi scritti nella traccia sono quelli di quando il collegamento è stato fatto.
update persone set cognome = 'Salvati' where id = pid(9);
select quante_tracce() as n1 \gset
select atteso('la segreteria unisce le due schede', come_esito('11111111-1111-1111-1111-111111111111', format($q$select (unisci_persone(%L, %L) is not null)::text$q$, pid(8), pid(9))), 'true');
select atteso('…i movimenti di chi se ne va sono di chi resta', persona_di(16) || ' / ' || persona_di(17), 'Carlo Sala / Carlo Sala');
select atteso('…la scheda che se ne va non c''è più, i movimenti sono ancora due', (select count(*)::text from persone where id = pid(9)) || '/' || (select count(*)::text from movimenti where persona_id = pid(8)), '0/2');
select atteso('…lo storico di chi resta li ha tutti e due', come('11111111-1111-1111-1111-111111111111', format($q$select count(*)::text from storico_persona(%L)$q$, pid(8))), '2');
select atteso('…la traccia non ha perso righe', (quante_tracce()::int >= :'n1'::int)::text, 'true');
select atteso('…gli id della traccia passano a chi resta, i nomi restano quelli di quando è stato fatto (anche se la scheda ha cambiato cognome)', (select string_agg((c.persona_dopo_id = pid(8))::text || ' ' || c.persona_dopo_nome, ' | ' order by c.movimento_id)
  from collegamenti_persona c where c.movimento_id in (id_n(16), id_n(17))), 'true Carlo Sala | true Carlo Sala');
select atteso('…importi, date, casse, voci, saldi e chiusure uguali', senza_persona() || ' ' || somme(), :'sp_prima' || ' ' || :'somme_prima');

\echo ''
\echo '--- 12. una scheda eliminata: il movimento resta, senza persona, con gli stessi conti ---'
select quante_tracce() as n2 \gset
select somme() as somme_prima, senza_persona() as sp_prima \gset
delete from persone where id = pid(5);
select atteso('Elena non c''è più', (select count(*)::text from persone where id = pid(5)), '0');
select atteso('i suoi movimenti ci sono ancora, senza persona (anche quello annullato)', (select count(*)::text || '/' || count(*) filter (where persona_id is null)::text from movimenti where origine_import in ('prima-nota:7', 'prima-nota:15')), '2/2');
select atteso('importi, date, casse, voci, saldi, bilancio, previsto: uguali', senza_persona() || ' ' || somme(), :'sp_prima' || ' ' || :'somme_prima');
select atteso('la traccia c''è ancora tutta', quante_tracce(), :'n2');
select atteso('…gli id di Elena nella traccia sono diventati null', (select count(*)::text from collegamenti_persona where persona_dopo_id = pid(5) or persona_prima_id = pid(5)), '0');
select atteso('…ma i nomi restano scritti: tre collegamenti a lei, uno tolto', (select count(*) filter (where persona_dopo_nome = $$Elena D'Angelo$$ and persona_dopo_id is null)::text || '/' || count(*) filter (where persona_prima_nome = $$Elena D'Angelo$$ and persona_prima_id is null)::text
  from collegamenti_persona), '3/1');
select atteso('il riepilogo: «Elena» è senza scheda (nessuna scheda fantasma), uno in meno già collegato',
  come_json('22222222-2222-2222-2222-222222222222', $q$select (riepilogo_collegamenti_persona() - 'campione')::text$q$),
  '{"sicuri": {"movimenti": 0, "persone": 0, "centesimi": 0, "dal": null, "al": null}, "da_decidere": {"movimenti": 1, "centesimi": 4500}, "senza_scheda": {"movimenti": 3, "centesimi": 12700}, "gia_collegati": 9}'::jsonb::text);
select atteso('gli esiti dopo l''eliminazione: «Elena» è senza scheda, l''annullato non c''è, e coincidono con il riepilogo', esito_di(7) || ' ' || esito_di(15) || ' ' || esiti_conta() || ' = ' || riepilogo_conta(), 'nessuna assente 0/1/3 di 4 = 0/1/3 di 4');
select atteso('eliminata una scheda, il blocco non ne inventa una', come_json('22222222-2222-2222-2222-222222222222', format($q$select collega_sicuri_persona(%L)::text$q$, lotto(6))), '{"collegati": 0, "restano": 0}'::jsonb::text);
delete from persone where id = 'aaaaaaaa-0000-0000-0000-000000000008';
select atteso('un amministratore la cui scheda sparisce non collega più', come_esito('88888888-8888-8888-8888-888888888888', $q$select collega_movimenti_persona(array[]::uuid[], null)::text$q$), '42501 la contabilità la cura l’amministrazione');

\echo ''
\echo '--- 13. come è fatta ---'
select atteso('le funzioni che scrivono prendono i blocchi in ordine: for update sulle righe', (select count(*)::text from pg_proc where pronamespace = 'public'::regnamespace
  and proname in ('collega_movimenti_persona', 'scollega_movimenti_persona', 'collega_sicuri_persona', 'togli_lotto_collegamenti') and prosrc ~* 'for update'), '4');
select atteso('sono tutte security definer con il loro search_path', (select count(*)::text from pg_proc where pronamespace = 'public'::regnamespace
  and proname in ('riepilogo_collegamenti_persona', 'collega_sicuri_persona', 'collega_movimenti_persona', 'scollega_movimenti_persona', 'togli_lotto_collegamenti', 'candidati_persona_movimento', 'storico_persona', 'esiti_collegamenti_persona')
  and prosecdef and proconfig::text like '%search_path=public%'), '8');
select atteso('la traccia ha la riga di sicurezza accesa', (select relrowsecurity::text from pg_class where oid = 'public.collegamenti_persona'::regclass), 'true');
select atteso('la persona dei movimenti sparisce con la scheda, il movimento no (on delete set null)', (select confdeltype::text from pg_constraint
  where conrelid = 'public.movimenti'::regclass and contype = 'f' and confrelid = 'public.persone'::regclass
    and conkey = array[(select attnum from pg_attribute where attrelid = 'public.movimenti'::regclass and attname = 'persona_id')]), 'n');
select atteso('i nomi della traccia sono testo, senza legami alla scheda', (select count(*)::text from pg_constraint where conrelid = 'public.collegamenti_persona'::regclass and contype = 'f'
  and conkey && array(select attnum from pg_attribute where attrelid = 'public.collegamenti_persona'::regclass and attname in ('fatto_da_nome', 'persona_prima_nome', 'persona_dopo_nome'))), '0');

\set ada '\'22222222-2222-2222-2222-222222222222\''

\echo ''
\echo '--- 14. TOGLI QUESTO LOTTO non scollega chi è stato ricollegato a mano alla stessa persona ---'
insert into persone (id, nome, cognome, ruolo) values (pid(14), 'Tullia', 'Bruni', 'iscritto');
insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione, origine_import)
values ('entrata', '2025-05-05', 2800, id_voce('Quota associativa', 'entrata'), id_cassa('Conto Corrente'), 'Cliente Tullia Bruni per quota', 'prima-nota:29');
select atteso('il lotto 7 collega Tullia (è l''unico sicuro rimasto)', come_json(:ada, format($q$select collega_sicuri_persona(%L)::text$q$, lotto(7))), '{"collegati": 1, "restano": 0}'::jsonb::text);
select atteso('si scollega', come_json(:ada, format($q$select scollega_movimenti_persona(%s)::text$q$, lista(29))), '{"scollegati": 1, "gia_senza": 0}'::jsonb::text);
select atteso('si ricollega a mano alla stessa Tullia', come_json(:ada, format($q$select collega_movimenti_persona(%s, %L)::text$q$, lista(29), pid(14))), '{"collegati": 1, "gia_cosi": 0}'::jsonb::text);
select atteso('togliere il lotto 7: niente, l''ultima parola è della mano', come_json(:ada, format($q$select togli_lotto_collegamenti(%L)::text$q$, lotto(7))), '{"tolti": 0}'::jsonb::text);
select atteso('…e Tullia resta collegata', persona_di(29), 'Tullia Bruni');
-- A due sessioni: chi toglie il lotto aspetta chi sta ricollegando lo stesso movimento, e poi guarda com'è finita.
select exists (select 1 from pg_available_extensions where name = 'dblink')::text as c_dblink \gset
\if :c_dblink
create extension if not exists dblink;
select come_json(:ada, format($q$select scollega_movimenti_persona(%s)::text$q$, lista(29))) as scollegato \gset
select atteso('il lotto 8 collega di nuovo Tullia', come_json(:ada, format($q$select collega_sicuri_persona(%L)::text$q$, lotto(8))), '{"collegati": 1, "restano": 0}'::jsonb::text);
select dblink_connect('sessione_a', 'dbname=' || current_database()) as c1 \gset
select dblink_connect('sessione_b', 'dbname=' || current_database()) as c2 \gset
select dblink_exec('sessione_a', 'set role authenticated') as a2 \gset
select dblink_exec('sessione_b', 'set role authenticated') as b2 \gset
select * from dblink('sessione_a', $q$select set_config('prova.utente', '22222222-2222-2222-2222-222222222222', false)$q$) as t(u text) \gset
select * from dblink('sessione_b', $q$select set_config('prova.utente', '22222222-2222-2222-2222-222222222222', false)$q$) as t(u text) \gset
-- La sessione A, senza chiudere, scollega e ricollega a mano Tullia; la B toglie il lotto 8 nel frattempo.
select dblink_exec('sessione_a', 'begin') as a3 \gset
select * from dblink('sessione_a', format('select scollega_movimenti_persona(%s)::text', lista(29))) as t(x text) \gset
select * from dblink('sessione_a', format('select collega_movimenti_persona(%s, %L)::text', lista(29), pid(14))) as t(y text) \gset
select dblink_send_query('sessione_b', format('select togli_lotto_collegamenti(%L)::text', lotto(8))) as inviata \gset
select pg_sleep(1);
select atteso('la sessione B aspetta: sta ancora lavorando mentre A non ha finito', dblink_is_busy('sessione_b')::text, '1');
select dblink_exec('sessione_a', 'commit') as a4 \gset
select atteso('finita A, la B non scollega niente: il movimento è stato ricollegato a mano', (select r::jsonb::text from dblink_get_result('sessione_b') as t(r text)), '{"tolti": 0}'::jsonb::text);
select atteso('…e Tullia è ancora di Tullia', persona_di(29), 'Tullia Bruni');
select dblink_disconnect('sessione_a') as d1 \gset
select dblink_disconnect('sessione_b') as d2 \gset
\else
\echo '(dblink non c''è su questo Postgres: la prova a due sessioni salta)'
\endif

\echo ''
\echo '--- 15. lo stesso nome in SQL e in JS: accenti, apostrofi, spazi di ogni tipo, la prima «per» ---'
select atteso('«João Silva»: la ã non è in nessun elenco di lettere', collegamento_token('João Silva'), 'joao silva');
select atteso('«JOÃO SILVA» in maiuscolo', collegamento_token('JOÃO SILVA'), 'joao silva');
select atteso('«Jose» con l''accento combinante U+0301', collegamento_token(E'José Lima'), 'jose lima');
select atteso('…in maiuscolo', collegamento_token(E'JOSÉ LIMA'), 'jose lima');
select atteso('l''apostrofo tipografico ’ (U+2019)', collegamento_token(E'Elena D’Angelo'), $$d'angelo elena$$);
select atteso('l''apostrofo ‘ (U+2018)', collegamento_token(E'Elena D‘Angelo'), $$d'angelo elena$$);
select atteso('l''apostrofo grave `', collegamento_token('Elena D`Angelo'), $$d'angelo elena$$);
select atteso('lo spazio stretto U+202F fra le parole', collegamento_token(E'Elena Rossi'), 'elena rossi');
select atteso('lo spazio di cifra U+2007', collegamento_token(E'Elena Rossi'), 'elena rossi');
select atteso('lo spazio senza larghezza U+FEFF', collegamento_token(E'Elena﻿Rossi'), 'elena rossi');
select atteso('lo spazio unificatore U+00A0', collegamento_token(E'Elena Rossi'), 'elena rossi');
select atteso('spazi doppi, a capo, ai bordi, e le parole in ordine alfabetico', collegamento_token(E'  Maria   Grazia\n Fontana '), 'fontana grazia maria');
select atteso('il nome si chiude alla PRIMA «per»', collegamento_nome('Cliente Marco Bianchi per mensile per tutti'), 'Marco Bianchi');
select atteso('…anche quando il nome è «De» e un''altra «per» viene dopo', collegamento_nome('Cliente De per Luca per quota'), 'De');
select atteso('«Cliente», nome e «per» separati da spazi di ogni tipo', collegamento_token(collegamento_nome(E'Cliente Elena Neri per﻿mensile')), 'elena neri');
select atteso('…anche con U+FEFF dopo «Cliente»', collegamento_token(collegamento_nome(E'Cliente﻿Elena Neri per mensile')), 'elena neri');
select atteso('una causale che non è «Cliente … per …»: nessun nome', coalesce(collegamento_nome('Bonifico anonimo per quota'), 'nessuno'), 'nessuno');
insert into persone (id, nome, cognome, ruolo) values
  (pid(15), 'João', 'Silva', 'iscritto'), (pid(16), 'José', 'Lima', 'iscritto'), (pid(17), 'Olga', 'Neri', 'iscritto'), (pid(18), 'Sandra', 'D''Amico', 'iscritto');
insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione, origine_import)
select 'entrata', ('2025-06-0' || (n - 20))::date, 1000 + n, id_voce('Corsi e altri pagamenti', 'entrata'), id_cassa('Conto Corrente'), d, 'prima-nota:' || n
from (values
  (21, 'Cliente Marco Bianchi per mensile per tutti'),
  (22, 'Cliente De per Luca per quota'),
  (23, 'Cliente Joao Silva per quota'),
  (24, E'Cliente José Lima per quota'),
  (25, E'Cliente Olga Neri per﻿mensile'),
  (26, E'Cliente Sandra D‘Amico per quota'),
  (27, 'Cliente Sandra D`Amico per quota'),
  (28, E'Cliente﻿Olga Neri per mensile')) v(n, d);
select atteso('esiti: la prima «per» chiude il nome, accenti, apostrofi e spazi non fanno perdere la scheda; «De» non ne ha',
  (select string_agg(n || ':' || esito_di(n), ' ' order by n) from generate_series(21, 28) n),
  '21:sicuro 22:nessuna 23:sicuro 24:sicuro 25:sicuro 26:sicuro 27:sicuro 28:sicuro');
select atteso('il blocco li collega tutti e sette, ognuno alla sua scheda', come_json(:ada, format($q$select collega_sicuri_persona(%L)::text$q$, lotto(9))), '{"collegati": 7, "restano": 0}'::jsonb::text);
select atteso('…di chi sono', (select string_agg(n || ':' || persona_di(n), ' ' order by n) from generate_series(21, 28) n),
  $$21:Marco Bianchi 22:— 23:João Silva 24:José Lima 25:Olga Neri 26:Sandra D'Amico 27:Sandra D'Amico 28:Olga Neri$$);

\echo ''
\echo '--- 16. gli esiti per riga sono un solo jsonb: un array ordinato per id, [] se vuoto ---'
select atteso('è un array di {id, esito}, ordinato per id', come(:ada, $q$select (jsonb_typeof(r) = 'array'
    and (select coalesce(jsonb_agg(e->>'id'), '[]') from jsonb_array_elements(r) e) = (select coalesce(jsonb_agg(e->>'id' order by e->>'id'), '[]') from jsonb_array_elements(r) e)
    and (select bool_and(e ? 'id' and e ? 'esito' and (select count(*) from jsonb_object_keys(e)) = 2) from jsonb_array_elements(r) e))::text
  from (select esiti_collegamenti_persona() as r) x$q$), 'true');
begin;
update movimenti set annullato_il = now() where annullato_il is null;
select atteso('senza movimenti da collegare rende [] (non una tabella vuota, non null)', come(:ada, $q$select esiti_collegamenti_persona()::text$q$), '[]');
rollback;

\echo ''
\echo '--- 17. candidati: solo per un movimento che si può collegare; di una scheda sola si dice solo il nome ---'
select atteso('un movimento scritto a mano col nome di una minorenne: rifiutato', come_esito(:ada, format($q$select candidati_persona_movimento(%L)::text$q$, id_mov('Cliente Giulia Verdi per mano'))),
  '22023 Il movimento del 10/09/2026 (Cliente Giulia Verdi per mano) non viene dal vecchio programma: non si collega');
select atteso('…e nella risposta non c''è l''anno di nascita', (come_esito(:ada, format($q$select candidati_persona_movimento(%L)::text$q$, id_mov('Cliente Giulia Verdi per mano'))) like '%2016%')::text, 'false');
select atteso('un''uscita', come_esito(:ada, format($q$select candidati_persona_movimento(%L)::text$q$, id_n(12))), '22023 Il movimento del 03/03/2025 (Cliente Giulia Verdi per rimborso) è un’uscita: si collegano solo le entrate');
select atteso('un annullato', come_esito(:ada, format($q$select candidati_persona_movimento(%L)::text$q$, id_n(13))), '22023 Il movimento del 04/03/2025 (Cliente Giulia Verdi per extra) è annullato: non si collega');
select atteso('un''entrata su un''altra voce', come_esito(:ada, format($q$select candidati_persona_movimento(%L)::text$q$, id_n(11))), '22023 Il movimento del 02/03/2025 (Cliente Giulia Verdi per regalo) è su «Da classificare»: si collegano solo quelli su «Quota associativa» e «Corsi e altri pagamenti»');
select atteso('un giroconto', come_esito(:ada, format($q$select candidati_persona_movimento(%L)::text$q$, (select id from movimenti where tipo = 'giroconto' limit 1))), '22023 Un giroconto non ha una persona');
select atteso('la differenza di una chiusura', come_esito(:ada, format($q$select candidati_persona_movimento(%L)::text$q$, id_mov('Differenza di cassa'))), '22023 Il movimento del 07/09/2026 (Differenza di cassa) è scritto dalla chiusura di cassa: non si collega');
select atteso('con una scheda sola: id, nome e cognome; anno di nascita, corsi e iscritta dal restano vuoti (Giulia ha l''anagrafica e un corso)', come(:ada,
  format($q$select (c.id = %L and c.nome = 'Giulia' and c.cognome = 'Verdi' and c.anno_nascita is null and c.corsi = '{}' and c.iscritto_dal is null)::text from candidati_persona_movimento(%L) c$q$, pid(1), id_n(1))), 'true');
select atteso('con due schede (gli omonimi) servono, e ci sono: anno, corsi, iscritta dal', come(:ada,
  format($q$select count(*) filter (where c.anno_nascita is not null)::text || '/' || count(*) from candidati_persona_movimento(%L) c$q$, id_n(4))), '2/2');

\echo ''
\echo '--- 18. prestazioni, indice e permessi delle funzioni di appoggio ---'
select atteso('c''è l''indice sul nome normalizzato delle schede', (select count(*)::text from pg_indexes where schemaname = 'public' and tablename = 'persone' and indexname = 'persone_nome_token' and indexdef like '%collegamento_token%'), '1');
select atteso('le due funzioni immutabili hanno il loro search_path', (select string_agg(proname || ':' || (provolatile = 'i')::text || ':' || (proconfig::text like '%search_path=%')::text, ' ' order by proname)
  from pg_proc where pronamespace = 'public'::regnamespace and proname in ('collegamento_token', 'collegamento_nome')), 'collegamento_nome:true:true collegamento_token:true:true');
select atteso('la segreteria scrive una scheda (l''indice chiama collegamento_token con i suoi permessi)', viste('11111111-1111-1111-1111-111111111111', 'authenticated', $q$insert into persone (nome, cognome, ruolo) values ('Prova', 'Indice', 'iscritto')$q$), 'FATTO (1 righe)');
select atteso('…e la corregge', viste('11111111-1111-1111-1111-111111111111', 'authenticated', $q$update persone set cognome = 'Indici' where nome = 'Prova' and cognome = 'Indice'$q$), 'FATTO (1 righe)');
delete from persone where nome = 'Prova' and cognome = 'Indici';
-- Eccezione: collegamento_token lo chiama l'indice sulle schede (persone_nome_token), con i permessi di chi scrive la scheda.
select atteso('le funzioni di appoggio non le chiama nessuno da fuori: authenticated può solo collegamento_token (serve all''indice), anon nessuna',
  (select string_agg(proname || ':' || has_function_privilege('authenticated', oid, 'execute')::text || '/' || has_function_privilege('anon', oid, 'execute')::text, ' ' order by proname)
   from pg_proc where pronamespace = 'public'::regnamespace and proname in ('collegamento_token', 'collegamento_nome', 'collegamento_candidati', 'collegamento_possibile', 'collegamento_perche', 'collegamento_scrivi')),
  'collegamento_candidati:false/false collegamento_nome:false/false collegamento_perche:false/false collegamento_possibile:false/false collegamento_scrivi:false/false collegamento_token:true/false');
select atteso('…e a «public» nessuna dà l''execute', (select count(*)::text from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
  where p.pronamespace = 'public'::regnamespace and p.proname like 'collegamento\_%' and a.grantee = 0 and a.privilege_type = 'EXECUTE'), '0');

\echo ''
\echo '--- 19. con 3000 schede e 3000 movimenti si risponde in tempo ---'
begin;
set local statement_timeout = '90s';
update movimenti set annullato_il = now() where annullato_il is null;
-- 2700 schede con nomi inventati tutti diversi, più 300 omonime delle prime 300.
insert into persone (nome, cognome, ruolo)
select 'Nome' || chr(97 + k % 26) || chr(97 + (k / 26) % 26), 'Cogn' || chr(97 + (k / 676) % 26) || chr(97 + k % 7), 'iscritto' from generate_series(1, 2700) k;
insert into persone (nome, cognome, ruolo)
select 'Nome' || chr(97 + k % 26) || chr(97 + (k / 26) % 26), 'Cogn' || chr(97 + (k / 676) % 26) || chr(97 + k % 7), 'iscritto' from generate_series(1, 300) k;
-- 3000 movimenti: 300 di nomi doppi, 2400 di nomi con una scheda sola, 300 di nomi senza scheda.
insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione, origine_import)
select 'entrata', '2025-06-01', 1000, id_voce('Corsi e altri pagamenti', 'entrata'), id_cassa('Conto Corrente'),
  'Cliente Nome' || chr(97 + k % 26) || chr(97 + (k / 26) % 26) || ' Cogn' || chr(97 + (k / 676) % 26) || chr(97 + k % 7) || ' per quota', 'prima-nota:L' || k
from generate_series(1, 2700) k;
insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione, origine_import)
select 'entrata', '2025-06-01', 1000, id_voce('Corsi e altri pagamenti', 'entrata'), id_cassa('Conto Corrente'), 'Cliente Ignoto' || k || ' Inventato per quota', 'prima-nota:N' || k
from generate_series(1, 300) k;
analyze persone;
analyze movimenti;
select extract(epoch from clock_timestamp()) as t0 \gset
select come(:ada, $q$select riepilogo_collegamenti_persona()::text$q$) as rie_grande \gset
select extract(epoch from clock_timestamp()) - :t0 as sec_rie \gset
select extract(epoch from clock_timestamp()) as t0 \gset
select come(:ada, $q$select esiti_collegamenti_persona()::text$q$) as esiti_grandi \gset
select extract(epoch from clock_timestamp()) - :t0 as sec_esiti \gset
select atteso('il riepilogo di 3000 movimenti e 3000 schede finisce in meno di 5 secondi', (:sec_rie::numeric < 5)::text, 'true');
select atteso('gli esiti per riga, anche', (:sec_esiti::numeric < 5)::text, 'true');
select atteso('i numeri del riepilogo: 2400 sicuri di 2400 persone, 300 da decidere, 300 senza scheda', (:'rie_grande'::jsonb - 'campione')::text,
  '{"sicuri": {"movimenti": 2400, "persone": 2400, "centesimi": 2400000, "dal": "2025-06-01", "al": "2025-06-01"}, "da_decidere": {"movimenti": 300, "centesimi": 300000}, "senza_scheda": {"movimenti": 300, "centesimi": 300000}, "gia_collegati": 0}'::jsonb::text);
select atteso('gli esiti hanno gli stessi numeri e 3000 righe', (select count(*) filter (where e->>'esito' = 'sicuro') || '/' || count(*) filter (where e->>'esito' = 'omonimi') || '/' || count(*) filter (where e->>'esito' = 'nessuna') || ' di ' || count(*)
  from jsonb_array_elements(:'esiti_grandi'::jsonb) e), '2400/300/300 di 3000');
rollback;
