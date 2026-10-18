-- L'import dello storico dei movimenti (63-importa-prima-nota.sql): `importa_prima_nota` carica a
-- pacchetti i movimenti letti da src/lib/importaPrimaNota.ts (una volta sola, dallo script
-- scripts/importa-prima-nota.mjs). Li carica solo l'amministrazione; la chiave di ogni riga fa
-- sì che rilanciare lo stesso file non duplichi niente; una riga sbagliata ferma tutto il
-- pacchetto, e un giorno già chiuso non si tocca.
-- Si lancia dopo finto-supabase.sql e i file dello schema, su un database suo.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

select (to_regprocedure('public.importa_prima_nota(jsonb)') is not null)::text as c63 \gset
create or replace function atteso(cosa text, avuto text, voluto text) returns text language plpgsql as $$
begin
  if avuto is distinct from voluto and not (voluto like '%…' and avuto like replace(voluto, '…', '%')) then
    raise exception '% · atteso «%», avuto «%»', cosa, voluto, avuto;
  end if;
  return 'ok  ' || cosa || ' → ' || avuto;
end $$;
select atteso('63-importa-prima-nota.sql è stato lanciato: c''è la funzione', :'c63', 'true');
select (to_regclass('public.chiusure_cassa') is not null)::text as c60 \gset
select atteso('60-chiusura-cassa.sql è stato lanciato: serve ai giorni chiusi', :'c60', 'true');
select (to_regclass('public.movimenti') is not null and to_regclass('public.casse') is not null and to_regclass('public.voci_contabili') is not null)::text as c59 \gset
select atteso('59-contabilita.sql è stato lanciato: ci sono le tre tabelle', :'c59', 'true');

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
-- Come finisce un'istruzione: «ok», oppure «codice messaggio». Il codice conta:
-- 42501 è «non tocca a te», 22023 «i dati non vanno», P0002 «non c'è».
create or replace function esito(sql text) returns text language plpgsql as $$
begin execute sql; return 'ok';
exception when others then return sqlstate || ' ' || sqlerrm;
end $$;

-- Una riga da importare, con i valori che si vogliono cambiare.
create or replace function riga(k text, g text, c text, t text, i int, d text, v text) returns jsonb language sql immutable as $$
  select jsonb_build_object('chiave', k, 'data', g, 'cassa', c, 'tipo', t, 'importo', i, 'descrizione', d, 'voce', v) $$;
create or replace function id_cassa(n text) returns uuid language sql stable security definer set search_path = public as $$ select id from casse where nome = n $$;
create or replace function quanti() returns text language sql stable security definer set search_path = public as $$
  select count(*)::text from movimenti where origine_import is not null $$;
create or replace function impronta() returns text language sql stable security definer set search_path = public as $$
  select md5(coalesce((select string_agg(v::text, '|' order by v.id) from voci_contabili v), '')
          || coalesce((select string_agg(m::text, '|' order by m.id) from movimenti m), '')) $$;
create or replace function da_chiamata(utente text, ruolo text) returns text language plpgsql as $$
declare r text;
begin
  perform set_config('prova.utente', utente, false);
  execute format('set role %I', ruolo);
  r := esito($q$select importa_prima_nota('[]'::jsonb)$q$);
  reset role;
  return r;
end $$;
grant execute on function atteso(text, text, text), chi(text), tenta(text), esito(text), riga(text, text, text, text, int, text, text),
  id_cassa(text), quanti(), impronta(), da_chiamata(text, text) to anon, authenticated;

\echo ''
\echo '--- 1. chi può importare: solo l''amministrazione ---'
select atteso('la segreteria semplice no', da_chiamata('11111111-1111-1111-1111-111111111111', 'authenticated'), '42501 la contabilità la cura l’amministrazione');
select atteso('l''istruttore no', da_chiamata('55555555-5555-5555-5555-555555555555', 'authenticated'), '42501 la contabilità la cura l’amministrazione');
select atteso('l''iscritto no', da_chiamata('77777777-7777-7777-7777-777777777777', 'authenticated'), '42501 la contabilità la cura l’amministrazione');
select atteso('il tablet no', da_chiamata('99999999-9999-9999-9999-999999999999', 'authenticated'), '42501 la contabilità la cura l’amministrazione');
select atteso('chi non ha una scheda no', da_chiamata('66666666-6666-6666-6666-666666666666', 'authenticated'), '42501 la contabilità la cura l’amministrazione');
select atteso('anon non ha nemmeno il permesso di chiamarla', da_chiamata('00000000-0000-0000-0000-000000000000', 'anon'), '42501 permission denied for function importa_prima_nota');
select atteso('l''amministrazione sì (anche con la lista vuota: niente da fare)', da_chiamata('22222222-2222-2222-2222-222222222222', 'authenticated'), 'ok');
select atteso('anche la segreteria con anche_amministrazione', da_chiamata('33333333-3333-3333-3333-333333333333', 'authenticated'), 'ok');
select atteso('anche l''amministrazione che è anche istruttore', da_chiamata('44444444-4444-4444-4444-444444444444', 'authenticated'), 'ok');
select atteso('authenticated la chiama, anon no (permessi)', (select string_agg(r || ':' || has_function_privilege(r, p.oid, 'execute')::text, ', ' order by r) from pg_proc p, unnest(array['anon', 'authenticated']) r
  where p.pronamespace = 'public'::regnamespace and p.proname = 'importa_prima_nota'), 'anon:false, authenticated:true');

\echo ''
\echo '--- 2. si importa: i movimenti, le voci, la chiave ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('tre righe: ne entrano tre', (select importa_prima_nota(jsonb_build_array(
  riga('prima-nota:1', '2019-09-03', 'contanti', 'entrata', 6000, 'Cliente ROSSI MARIO per QUOTA ASSOCIATIVA ANNUALE', 'Quota associativa'),
  riga('prima-nota:2', '2019-09-03', 'conto', 'entrata', 4700, 'Cliente ROSSI MARIO per Mensile Judo', 'Corsi e altri pagamenti'),
  riga('prima-nota:3', '2019-09-04', 'conto', 'uscita', 8000, 'affitto palestra', 'Da classificare')))::text), '3');
reset role;
select atteso('i movimenti sono ordinari: data, importo, cassa, voce, descrizione',
  (select string_agg(m.data || ' ' || m.tipo || ' ' || m.importo || ' ' || c.nome || ' ' || v.nome || ' ' || m.descrizione, ' | ' order by m.origine_import)
     from movimenti m join casse c on c.id = m.cassa_id join voci_contabili v on v.id = m.voce_id),
  '2019-09-03 entrata 6000 Cassa Contanti Quota associativa Cliente ROSSI MARIO per QUOTA ASSOCIATIVA ANNUALE | 2019-09-03 entrata 4700 Conto Corrente Corsi e altri pagamenti Cliente ROSSI MARIO per Mensile Judo | 2019-09-04 uscita 8000 Conto Corrente Da classificare affitto palestra');
select atteso('nessuno dice chi l''ha scritto: è storia', (select count(*)::text from movimenti where creato_da is not null), '0');
select atteso('la chiave resta sulla riga', (select string_agg(origine_import, ',' order by origine_import) from movimenti), 'prima-nota:1,prima-nota:2,prima-nota:3');
select atteso('«Da classificare» c''è, di entrata e di uscita, in uso e non di sistema', (select string_agg(tipo || ' ' || di_sistema || ' ' || attiva, ', ' order by tipo) from voci_contabili where nome = 'Da classificare'), 'entrata false true, uscita false true');
select atteso('le voci di sistema sono rimaste una per nome e tipo', (select count(*)::text from voci_contabili where nome in ('Quota associativa', 'Corsi e altri pagamenti')), '2');
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('…li vede', (select count(*)::text from movimenti), '3');
select atteso('…e uno si annulla come un movimento qualunque', esito($$select annulla_movimento((select id from movimenti where origine_import = 'prima-nota:3'))$$), 'ok');
reset role;

\echo ''
\echo '--- 3. rilanciare non duplica: la chiave ---'
select impronta() as prima \gset
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('lo stesso pacchetto un''altra volta: ne entrano zero', (select importa_prima_nota(jsonb_build_array(
  riga('prima-nota:1', '2019-09-03', 'contanti', 'entrata', 6000, 'Cliente ROSSI MARIO per QUOTA ASSOCIATIVA ANNUALE', 'Quota associativa'),
  riga('prima-nota:2', '2019-09-03', 'conto', 'entrata', 4700, 'Cliente ROSSI MARIO per Mensile Judo', 'Corsi e altri pagamenti'),
  riga('prima-nota:3', '2019-09-04', 'conto', 'uscita', 8000, 'affitto palestra', 'Da classificare')))::text), '0');
reset role;
select atteso('…e non cambia niente (nemmeno l''annullo di prima)', impronta(), :'prima');
set role authenticated;
select atteso('un pacchetto per metà nuovo: entra solo quel che manca', (select importa_prima_nota(jsonb_build_array(
  riga('prima-nota:3', '2019-09-04', 'conto', 'uscita', 8000, 'affitto palestra', 'Da classificare'),
  riga('prima-nota:4', '2019-09-05', 'contanti', 'uscita', 1200, 'detersivo', 'Da classificare')))::text), '1');
reset role;
select atteso('quattro in tutto', quanti(), '4');

\echo ''
\echo '--- 4. quel che non ha senso si rifiuta, e un pacchetto o entra tutto o niente ---'
select impronta() as prima \gset
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('non è una lista', esito($$select importa_prima_nota('{"chiave": "x"}'::jsonb)$$), '22023 I dati dell’import non sono una lista');
select atteso('una lista di mille e una righe', esito($$select importa_prima_nota((select jsonb_agg(jsonb_build_object('chiave', 'k' || g)) from generate_series(1, 1001) g))$$), '22023 Troppe righe in una volta: al massimo 1000');
select atteso('una riga che non è un oggetto', esito($$select importa_prima_nota('["testo"]'::jsonb)$$), '22023 La riga 1 non si capisce');
select atteso('senza chiave', esito($$select importa_prima_nota(jsonb_build_array(jsonb_build_object('data', '2019-09-03')))$$), '22023 La riga 1 non ha la chiave');
select atteso('una chiave lunga più di cento lettere', esito(format('select importa_prima_nota(jsonb_build_array(riga(%L, %L, %L, %L, 100, %L, %L)))', repeat('k', 101), '2019-09-03', 'conto', 'uscita', 'x', 'Da classificare')), '22023 La riga 1 non ha la chiave');
select atteso('una data che non si capisce', esito(format('select importa_prima_nota(jsonb_build_array(riga(%L, %L, %L, %L, 100, %L, %L)))', 'k', '2019-02-30', 'conto', 'uscita', 'x', 'Da classificare')), '22023 La riga 1: la data non si capisce');
select atteso('una data di secoli fa', esito(format('select importa_prima_nota(jsonb_build_array(riga(%L, %L, %L, %L, 100, %L, %L)))', 'k', '1999-12-31', 'conto', 'uscita', 'x', 'Da classificare')), '22023 La riga 1: la data non si capisce');
select atteso('una data nel futuro', esito(format('select importa_prima_nota(jsonb_build_array(riga(%L, %L, %L, %L, 100, %L, %L)))', 'k', (current_date + 2)::text, 'conto', 'uscita', 'x', 'Da classificare')), '22023 La riga 1: la data è nel futuro');
select atteso('una cassa che non c''è', esito(format('select importa_prima_nota(jsonb_build_array(riga(%L, %L, %L, %L, 100, %L, %L)))', 'k', '2019-09-03', 'banca', 'uscita', 'x', 'Da classificare')), '22023 La riga 1: la cassa non è quella dei contanti né quella del conto');
select atteso('un tipo che non c''è', esito(format('select importa_prima_nota(jsonb_build_array(riga(%L, %L, %L, %L, 100, %L, %L)))', 'k', '2019-09-03', 'conto', 'prestito', 'x', 'Da classificare')), '22023 La riga 1: scegli se è un’entrata o un’uscita');
select atteso('importo zero', esito(format('select importa_prima_nota(jsonb_build_array(riga(%L, %L, %L, %L, 0, %L, %L)))', 'k', '2019-09-03', 'conto', 'uscita', 'x', 'Da classificare')), '22023 La riga 1: l’importo deve essere più di zero');
select atteso('importo negativo', esito(format('select importa_prima_nota(jsonb_build_array(riga(%L, %L, %L, %L, -5, %L, %L)))', 'k', '2019-09-03', 'conto', 'uscita', 'x', 'Da classificare')), '22023 La riga 1: l’importo deve essere più di zero');
select atteso('importo oltre centomila euro', esito(format('select importa_prima_nota(jsonb_build_array(riga(%L, %L, %L, %L, 10000001, %L, %L)))', 'k', '2019-09-03', 'conto', 'uscita', 'x', 'Da classificare')), '22023 La riga 1: l’importo è troppo alto');
select atteso('importo con la virgola', esito($$select importa_prima_nota(jsonb_build_array(jsonb_build_object('chiave', 'k', 'data', '2019-09-03', 'cassa', 'conto', 'tipo', 'uscita', 'importo', 10.5, 'descrizione', 'x', 'voce', 'Da classificare')))$$), '22023 La riga 1: l’importo non si capisce');
select atteso('descrizione vuota', esito(format('select importa_prima_nota(jsonb_build_array(riga(%L, %L, %L, %L, 100, %L, %L)))', 'k', '2019-09-03', 'conto', 'uscita', '   ', 'Da classificare')), '22023 La riga 1: scrivi una descrizione');
select atteso('descrizione di 201 lettere', esito(format('select importa_prima_nota(jsonb_build_array(riga(%L, %L, %L, %L, 100, %L, %L)))', 'k', '2019-09-03', 'conto', 'uscita', repeat('d', 201), 'Da classificare')), '22023 La riga 1: la descrizione è troppo lunga');
select atteso('una voce che non è fra le tre', esito(format('select importa_prima_nota(jsonb_build_array(riga(%L, %L, %L, %L, 100, %L, %L)))', 'k', '2019-09-03', 'conto', 'uscita', 'x', 'Affitto sala')), '22023 La riga 1: la voce non va bene');
select atteso('una voce di sistema è solo di entrata', esito(format('select importa_prima_nota(jsonb_build_array(riga(%L, %L, %L, %L, 100, %L, %L)))', 'k', '2019-09-03', 'conto', 'uscita', 'x', 'Quota associativa')), '22023 La riga 1: la voce non va bene');
select atteso('l''errore dice quale riga è (la terza)', esito(format('select importa_prima_nota(jsonb_build_array(riga(%L, %L, %L, %L, 100, %L, %L), riga(%L, %L, %L, %L, 100, %L, %L), riga(%L, %L, %L, %L, 0, %L, %L)))',
  'a', '2019-09-03', 'conto', 'uscita', 'x', 'Da classificare', 'b', '2019-09-03', 'conto', 'uscita', 'y', 'Da classificare', 'c', '2019-09-03', 'conto', 'uscita', 'z', 'Da classificare')), '22023 La riga 3: l’importo deve essere più di zero');
reset role;
select atteso('di tutti questi rifiuti non è entrato niente: le prime due righe buone non restano', impronta(), :'prima');

\echo ''
\echo '--- 5. un giorno chiuso non si tocca ---'
-- La Cassa Contanti parte dal 1 settembre 2026 e si chiude fino al 10: da lì indietro niente.
update casse set dal = '2026-09-01', saldo_iniziale = 0 where nome = 'Cassa Contanti';
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('si chiude la cassa fino al 10 settembre', esito(format('select chiudi_cassa(%L::jsonb)', jsonb_build_object('cassa_id', id_cassa('Cassa Contanti'), 'data', '2026-09-10', 'contato', 0))), 'ok');
select atteso('un movimento dei contanti del 5 settembre non entra, e dice quale riga', esito(format('select importa_prima_nota(jsonb_build_array(riga(%L, %L, %L, %L, 100, %L, %L), riga(%L, %L, %L, %L, 100, %L, %L)))',
  'g1', '2026-09-11', 'contanti', 'entrata', 'dopo', 'Da classificare', 'g2', '2026-09-05', 'contanti', 'entrata', 'dentro', 'Da classificare')), '22023 La riga 2: quel giorno la cassa è già chiusa');
select atteso('…e nemmeno la prima riga, che era buona, è rimasta', (select count(*)::text from movimenti where origine_import in ('g1', 'g2')), '0');
select atteso('il conto non è chiuso: lì si importa', (select importa_prima_nota(jsonb_build_array(riga('g3', '2026-09-05', 'conto', 'entrata', 100, 'sul conto', 'Da classificare')))::text), '1');
select atteso('i contanti dopo la chiusura si importano', (select importa_prima_nota(jsonb_build_array(riga('g4', '2026-09-11', 'contanti', 'entrata', 100, 'dopo', 'Da classificare')))::text), '1');
reset role;

\echo ''
\echo '--- 6. il file si rilancia senza danni ---'
select impronta() as prima \gset
\i supabase/63-importa-prima-nota.sql
select atteso('rilanciato, i dati sono gli stessi', impronta(), :'prima');
select atteso('…e la funzione è ancora di sola amministrazione', da_chiamata('11111111-1111-1111-1111-111111111111', 'authenticated'), '42501 la contabilità la cura l’amministrazione');
select atteso('…con gli stessi permessi', (select string_agg(r || ':' || has_function_privilege(r, p.oid, 'execute')::text, ', ' order by r) from pg_proc p, unnest(array['anon', 'authenticated']) r
  where p.pronamespace = 'public'::regnamespace and p.proname = 'importa_prima_nota'), 'anon:false, authenticated:true');
select atteso('la chiave è unica, ma solo dove c''è', (select count(*)::text from pg_indexes where tablename = 'movimenti' and indexname = 'movimenti_origine_import' and indexdef like '%UNIQUE%' and indexdef like '%WHERE%'), '1');
select atteso('importa_prima_nota è security definer con il suo search_path', (select (prosecdef and proconfig::text like '%search_path=public%')::text from pg_proc where proname = 'importa_prima_nota' and pronamespace = 'public'::regnamespace), 'true');
