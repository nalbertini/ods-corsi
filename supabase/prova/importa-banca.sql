-- «Importa dalla banca» (99-importa-banca.sql): i movimenti del conto si scrivono con
-- `importa_prima_nota` (chiave `banca:aaaammgg:hash:n`, voce «Da classificare»), e
-- `annulla_importazione_banca(creato)` annulla in un colpo solo un lotto: tutti i movimenti
-- della banca scritti in quel momento e non ancora annullati, e nient'altro. Solo
-- l'amministrazione. Il testo e le regole di src/lib/importaBanca.ts sono provati da
-- scripts/prova-importa-banca.mjs.
-- Si lancia dopo finto-supabase.sql e i file dello schema, su un database suo.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

select (to_regprocedure('public.annulla_importazione_banca(timestamptz)') is not null)::text as c99 \gset
create or replace function atteso(cosa text, avuto text, voluto text) returns text language plpgsql as $$
begin
  if avuto is distinct from voluto and not (voluto like '%…' and avuto like replace(voluto, '…', '%')) then
    raise exception '% · atteso «%», avuto «%»', cosa, voluto, avuto;
  end if;
  return 'ok  ' || cosa || ' → ' || avuto;
end $$;
select atteso('99-importa-banca.sql è stato lanciato: c''è annulla_importazione_banca(timestamptz)', :'c99', 'true');
select (to_regprocedure('public.importa_prima_nota(jsonb)') is not null)::text as c63 \gset
select atteso('63-importa-prima-nota.sql è stato lanciato: c''è l''import', :'c63', 'true');

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'ada@ods.it'),
  ('55555555-5555-5555-5555-555555555555', 'maura@ods.it'),
  ('77777777-7777-7777-7777-777777777777', 'luca@ods.it'),
  ('99999999-9999-9999-9999-999999999999', 'tablet@ods.it');
-- Anna: solo segreteria. Ada: amministrazione. Maura: istruttore. Luca: iscritto.
insert into persone (id, nome, cognome, ruolo, anche_istruttore, anche_amministrazione, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', false, false, 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Ada', 'Conti', 'amministrazione', false, false, 'ada@ods.it', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'Maura', 'Uno', 'istruttore', false, false, 'maura@ods.it', '55555555-5555-5555-5555-555555555555'),
  ('aaaaaaaa-0000-0000-0000-000000000007', 'Luca', 'Rossi', 'iscritto', false, false, 'luca@ods.it', '77777777-7777-7777-7777-777777777777');
insert into sale (id, nome) values ('bbbbbbbb-0000-0000-0000-000000000001', 'Tatami');
insert into postazioni (id, nome, sala_id, utente_id) values
  ('dddddddd-0000-0000-0000-000000000001', 'Tablet', 'bbbbbbbb-0000-0000-0000-000000000001', '99999999-9999-9999-9999-999999999999');

create or replace function chi(u text) returns void language plpgsql as $$
begin perform set_config('prova.utente', u, false); end $$;
create or replace function esito(sql text) returns text language plpgsql as $$
begin execute sql; return 'ok'; exception when others then return sqlstate || ' ' || sqlerrm; end $$;
create or replace function riga(k text, g text, t text, i int, d text) returns jsonb language sql immutable as $$
  select jsonb_build_object('chiave', k, 'data', g, 'cassa', 'conto', 'tipo', t, 'importo', i, 'descrizione', d, 'voce', 'Da classificare') $$;
-- Quanti movimenti hanno la chiave che comincia così, e non sono annullati.
create or replace function vivi(prefisso text) returns text language sql stable security definer set search_path = public as $$
  select count(*)::text from movimenti where origine_import like prefisso and annullato_il is null $$;
create or replace function annullati() returns text language sql stable security definer set search_path = public as $$
  select coalesce(string_agg(coalesce(origine_import, 'a mano'), ',' order by origine_import), '') from movimenti where annullato_il is not null $$;
create or replace function da_chiamata(utente text, ruolo text, creato timestamptz) returns text language plpgsql as $$
declare r text;
begin
  perform set_config('prova.utente', utente, false);
  execute format('set role %I', ruolo);
  r := esito(format('select annulla_importazione_banca(%L::timestamptz)', creato));
  reset role;
  return r;
end $$;
grant execute on function atteso(text, text, text), chi(text), esito(text), riga(text, text, text, int, text),
  vivi(text), annullati(), da_chiamata(text, text, timestamptz) to anon, authenticated;

\echo ''
\echo '--- 1. si importa dalla banca: la chiave, la voce, il rilancio ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('due movimenti del lotto A: entrano', (select importa_prima_nota(jsonb_build_array(
  riga('banca:20261005:aaaa1111:0', '2026-10-05', 'entrata', 1000, 'Pagamento POS Bar Centro POS'),
  riga('banca:20261005:aaaa1111:1', '2026-10-05', 'entrata', 1000, 'Pagamento POS Bar Centro POS')))::text), '2');
select atteso('…un terzo, che poi sarà annullato per conto suo', (select importa_prima_nota(jsonb_build_array(
  riga('banca:20261006:bbbb2222:0', '2026-10-06', 'uscita', 5000, 'Bonifico a favore di Anna Bianchi lezioni')))::text), '1');
select atteso('…e uno del lotto B', (select importa_prima_nota(jsonb_build_array(
  riga('banca:20261007:cccc3333:0', '2026-10-07', 'entrata', 12000, 'Bonifico da Luca Verdi saldo corso')))::text), '1');
reset role;
select atteso('sono nel Conto Corrente, da classificare, senza chi li ha scritti', (select string_agg(c.nome || ' ' || v.nome || ' ' || coalesce(m.creato_da::text, '-'), ' | ' order by m.origine_import)
  from movimenti m join casse c on c.id = m.cassa_id join voci_contabili v on v.id = m.voce_id),
  'Conto Corrente Da classificare - | Conto Corrente Da classificare - | Conto Corrente Da classificare - | Conto Corrente Da classificare -');
-- Un movimento a mano e uno dello storico nel conto, scritti nello stesso momento del lotto A.
insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione)
  select 'entrata', '2026-10-05', 1000, (select id from voci_contabili where nome = 'Da classificare' and tipo = 'entrata'), (select id from casse where nome = 'Conto Corrente'), 'a mano';
insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione, origine_import)
  select 'entrata', '2026-10-05', 1000, (select id from voci_contabili where nome = 'Da classificare' and tipo = 'entrata'), (select id from casse where nome = 'Conto Corrente'), 'dello storico', 'prima-nota:1';
-- Il lotto A: stessi millisecondi (123), microsecondi diversi. Il lotto B: un millisecondo dopo.
update movimenti set creato_il = '2026-10-20 10:00:00.123456+02' where origine_import = 'banca:20261005:aaaa1111:0';
update movimenti set creato_il = '2026-10-20 10:00:00.123900+02' where origine_import in ('banca:20261005:aaaa1111:1', 'banca:20261006:bbbb2222:0');
update movimenti set creato_il = '2026-10-20 10:00:00.123500+02' where descrizione in ('a mano', 'dello storico');
update movimenti set creato_il = '2026-10-20 10:00:00.124000+02' where origine_import = 'banca:20261007:cccc3333:0';
-- Uno del lotto A è già annullato per conto suo: non conta e non si annulla due volte.
update movimenti set annullato_il = '2026-10-21 09:00+02' where origine_import = 'banca:20261006:bbbb2222:0';

select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('rilanciare lo stesso file: ne entrano zero', (select importa_prima_nota(jsonb_build_array(
  riga('banca:20261005:aaaa1111:0', '2026-10-05', 'entrata', 1000, 'Pagamento POS Bar Centro POS'),
  riga('banca:20261005:aaaa1111:1', '2026-10-05', 'entrata', 1000, 'Pagamento POS Bar Centro POS'),
  riga('banca:20261006:bbbb2222:0', '2026-10-06', 'uscita', 5000, 'Bonifico a favore di Anna Bianchi lezioni'),
  riga('banca:20261007:cccc3333:0', '2026-10-07', 'entrata', 12000, 'Bonifico da Luca Verdi saldo corso')))::text), '0');
reset role;
select atteso('…e il movimento annullato non rientra', (select count(*)::text from movimenti where origine_import = 'banca:20261006:bbbb2222:0'), '1');
select atteso('…e resta annullato', (select (annullato_il is not null)::text from movimenti where origine_import = 'banca:20261006:bbbb2222:0'), 'true');
select atteso('quattro di banca in tutto, tre non annullati', (select count(*) || '/' || count(*) filter (where annullato_il is null) from movimenti where origine_import like 'banca:%'), '4/3');

\echo ''
\echo '--- 2. chi può annullare un lotto: solo l''amministrazione ---'
select atteso('la segreteria semplice no', da_chiamata('11111111-1111-1111-1111-111111111111', 'authenticated', '2026-10-20 10:00:00.123+02'), '42501 la contabilità la cura l’amministrazione');
select atteso('l''istruttore no', da_chiamata('55555555-5555-5555-5555-555555555555', 'authenticated', '2026-10-20 10:00:00.123+02'), '42501 la contabilità la cura l’amministrazione');
select atteso('l''iscritto no', da_chiamata('77777777-7777-7777-7777-777777777777', 'authenticated', '2026-10-20 10:00:00.123+02'), '42501 la contabilità la cura l’amministrazione');
select atteso('il tablet no', da_chiamata('99999999-9999-9999-9999-999999999999', 'authenticated', '2026-10-20 10:00:00.123+02'), '42501 la contabilità la cura l’amministrazione');
select atteso('anon non ha nemmeno il permesso di chiamarla', da_chiamata('00000000-0000-0000-0000-000000000000', 'anon', '2026-10-20 10:00:00.123+02'), '42501 permission denied for function annulla_importazione_banca');
select atteso('authenticated la chiama, anon no (permessi)', (select string_agg(r || ':' || has_function_privilege(r, p.oid, 'execute')::text, ', ' order by r) from pg_proc p, unnest(array['anon', 'authenticated']) r
  where p.pronamespace = 'public'::regnamespace and p.proname = 'annulla_importazione_banca'), 'anon:false, authenticated:true');
select atteso('di tutti questi rifiuti non è stato annullato altro che il movimento di prima', annullati(), 'banca:20261006:bbbb2222:0');

\echo ''
\echo '--- 3. annullare il lotto A: solo i suoi movimenti della banca ancora vivi ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('torna quanti ne ha annullati: i due vivi del lotto (non quello già annullato)', (select annulla_importazione_banca('2026-10-20 10:00:00.123+02')::text), '2');
reset role;
select atteso('annullati: i due del lotto e quello di prima, niente altro', annullati(), 'banca:20261005:aaaa1111:0,banca:20261005:aaaa1111:1,banca:20261006:bbbb2222:0');
select atteso('il movimento a mano dello stesso momento resta', (select (annullato_il is null)::text from movimenti where descrizione = 'a mano'), 'true');
select atteso('quello dello storico (prima-nota) dello stesso momento resta', (select (annullato_il is null)::text from movimenti where origine_import = 'prima-nota:1'), 'true');
select atteso('il lotto B resta', (select (annullato_il is null)::text from movimenti where origine_import = 'banca:20261007:cccc3333:0'), 'true');
select atteso('chi ha annullato è annotato, e quando', (select string_agg(origine_import || ' ' || (annullato_da = 'aaaaaaaa-0000-0000-0000-000000000002')::text || ' ' || (annullato_il >= now() - interval '1 minute')::text, ',' order by origine_import)
  from movimenti where origine_import like 'banca:20261005:%'), 'banca:20261005:aaaa1111:0 true true,banca:20261005:aaaa1111:1 true true');
select atteso('il movimento già annullato conserva la sua data di annullo', (select annullato_il::text from movimenti where origine_import = 'banca:20261006:bbbb2222:0'), '2026-10-21 09:00:00+02');
set role authenticated;
select atteso('lo stesso lotto un''altra volta: niente da annullare, torna 0', (select annulla_importazione_banca('2026-10-20 10:00:00.123+02')::text), '0');
select atteso('un momento senza lotto: torna 0', (select annulla_importazione_banca('2020-01-01 00:00:00+01')::text), '0');
reset role;
select atteso('…e non è cambiato niente', annullati(), 'banca:20261005:aaaa1111:0,banca:20261005:aaaa1111:1,banca:20261006:bbbb2222:0');

\echo ''
\echo '--- 4. un movimento annullato non rientra rilanciando il file ---'
set role authenticated;
select atteso('il lotto A annullato, rilanciato: ne entrano zero', (select importa_prima_nota(jsonb_build_array(
  riga('banca:20261005:aaaa1111:0', '2026-10-05', 'entrata', 1000, 'Pagamento POS Bar Centro POS'),
  riga('banca:20261005:aaaa1111:1', '2026-10-05', 'entrata', 1000, 'Pagamento POS Bar Centro POS')))::text), '0');
reset role;
select atteso('…e di banca ne restano vivi uno solo (il lotto B)', vivi('banca:%'), '1');

\echo ''
\echo '--- 5. il lotto B, e il file si rilancia senza danni ---'
set role authenticated;
select atteso('il lotto B, con i millisecondi: un millisecondo dopo è un altro lotto', (select annulla_importazione_banca('2026-10-20 10:00:00.124+02')::text), '1');
reset role;
select atteso('di banca non ne resta nessuno vivo', vivi('banca:%'), '0');
select atteso('quelli a mano e dello storico ci sono ancora', (select count(*)::text from movimenti where annullato_il is null), '2');

\echo ''
\echo '--- 6. una chiave «banca:» su un''altra cassa non si annulla in blocco (il giorno chiuso non si prova: si chiude solo la Cassa Contanti) ---'
select imposta_saldo_cassa(id, 0, '2026-10-01') is not null as r6 from casse where nome = 'Cassa Contanti' \gset
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select importa_prima_nota(jsonb_build_array(jsonb_set(riga('banca:20261010:ffff0000:0', '2026-10-10', 'entrata', 5000, 'incasso'), '{cassa}', '"contanti"'))) as r7 \gset
reset role;
select creato_il as lotto_contanti from movimenti where origine_import = 'banca:20261010:ffff0000:0' \gset
select chiudi_cassa(jsonb_build_object('cassa_id', id, 'data', '2026-10-15', 'contato', 5000)) is not null as r8 from casse where nome = 'Cassa Contanti' \gset
set role authenticated;
select atteso('il lotto con un movimento in una cassa chiusa non si annulla', (select annulla_importazione_banca(:'lotto_contanti')::text), '0');
reset role;
select atteso('…e il movimento resta', vivi('banca:20261010:%'), '1');
\i supabase/99-importa-banca.sql
select atteso('rilanciato il file, la funzione è ancora di sola amministrazione', da_chiamata('11111111-1111-1111-1111-111111111111', 'authenticated', '2026-10-20 10:00:00.123+02'), '42501 la contabilità la cura l’amministrazione');
select atteso('…con gli stessi permessi', (select string_agg(r || ':' || has_function_privilege(r, p.oid, 'execute')::text, ', ' order by r) from pg_proc p, unnest(array['anon', 'authenticated']) r
  where p.pronamespace = 'public'::regnamespace and p.proname = 'annulla_importazione_banca'), 'anon:false, authenticated:true');
select atteso('è security definer con il suo search_path', (select (prosecdef and proconfig::text like '%search_path=public%')::text from pg_proc where proname = 'annulla_importazione_banca' and pronamespace = 'public'::regnamespace), 'true');
