-- Cambiare la voce di un movimento (67-cambia-voce.sql): `cambia_voce_movimenti` cambia solo la voce
-- di uno o più movimenti scritti qui o importati, tutto o niente, e lascia la traccia in `cambi_voce`.
-- Solo l'amministrazione; importi, date, casse e testi non si toccano; anche nei giorni chiusi.
-- Le stesse regole di src/lib/contabilita.ts (`cosaNonVaCambioVoce`) e della modalità prova, provate
-- da scripts/prova-contabilita.mjs e scripts/prova-segreteria.mjs.
-- Si lancia dopo finto-supabase.sql e i file dello schema, su un database suo.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

select (to_regprocedure('public.cambia_voce_movimenti(uuid[], uuid)') is not null and to_regclass('public.cambi_voce') is not null)::text as c67 \gset
create or replace function atteso(cosa text, avuto text, voluto text) returns text language plpgsql as $$
begin
  if avuto is distinct from voluto and not (voluto like '%…' and avuto like replace(voluto, '…', '%')) then
    raise exception '% · atteso «%», avuto «%»', cosa, voluto, avuto;
  end if;
  return 'ok  ' || cosa || ' → ' || avuto;
end $$;
select atteso('67-cambia-voce.sql è stato lanciato: c''è la funzione e la traccia', :'c67', 'true');
select (to_regclass('public.chiusure_cassa') is not null and to_regprocedure('public.importa_prima_nota(jsonb)') is not null)::text as c60 \gset
select atteso('60 e 63 sono stati lanciati: servono ai giorni chiusi e allo storico', :'c60', 'true');

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

create or replace function id_cassa(n text) returns uuid language sql stable security definer set search_path = public as $$ select id from casse where nome = n $$;
create or replace function id_voce(n text, t text) returns uuid language sql stable security definer set search_path = public as $$
  select id from voci_contabili where nome = n and tipo::text = t $$;
create or replace function id_mov(d text) returns uuid language sql stable security definer set search_path = public as $$ select id from movimenti where descrizione = d $$;
-- La voce di un movimento, per nome.
create or replace function voce_di(d text) returns text language sql stable security definer set search_path = public as $$
  select v.nome from movimenti m join voci_contabili v on v.id = m.voce_id where m.descrizione = d $$;
-- Tutto di un movimento tranne la voce: per accorgersi di una riga che cambia altro.
create or replace function senza_voce(d text) returns text language sql stable security definer set search_path = public as $$
  select md5(row(tipo, data, importo, cassa_id, cassa_a_id, descrizione, nota, creato_da, creato_il, annullato_il)::text) from movimenti where descrizione = d $$;
-- Tutte le voci di tutti i movimenti, e la traccia: per accorgersi che un lotto rifiutato non ha lasciato niente.
create or replace function impronta() returns text language sql stable security definer set search_path = public as $$
  select md5(coalesce((select string_agg(m::text, '|' order by m.id) from movimenti m), '')
          || coalesce((select string_agg(c::text, '|' order by c.id) from cambi_voce c), '')) $$;
create or replace function quante_tracce() returns text language sql stable security definer set search_path = public as $$ select count(*)::text from cambi_voce $$;
create or replace function chiamata(utente text, ruolo text) returns text language plpgsql as $$
declare r text;
begin
  perform set_config('prova.utente', utente, false);
  execute format('set role %I', ruolo);
  r := esito($q$select cambia_voce_movimenti(array[]::uuid[], null)$q$);
  reset role;
  return r;
end $$;
-- Quante righe di `cambi_voce` vede chi chiama, o «NEGATO».
create or replace function tracce_viste(utente text, ruolo text) returns text language plpgsql as $$
declare r text;
begin
  perform set_config('prova.utente', utente, false);
  execute format('set role %I', ruolo);
  r := tenta('select count(*)::text from cambi_voce');
  reset role;
  return r;
end $$;
-- Le scritture dritte sulla traccia (insert, update, delete): quante finiscono con «permission denied».
create or replace function scritture_negate(utente text, ruolo text) returns text language plpgsql as $$
declare s text; negati int := 0;
begin
  perform set_config('prova.utente', utente, false);
  execute format('set role %I', ruolo);
  foreach s in array array[
    $q$insert into cambi_voce (movimento_id) values (gen_random_uuid())$q$,
    $q$update cambi_voce set cambiato_il = now()$q$,
    $q$delete from cambi_voce$q$] loop
    if tenta(s) = 'NEGATO: permission denied for table cambi_voce' then negati := negati + 1; end if;
  end loop;
  reset role;
  return negati || '/3';
end $$;
grant execute on function atteso(text, text, text), chi(text), tenta(text), esito(text), id_cassa(text), id_voce(text, text), id_mov(text),
  voce_di(text), senza_voce(text), impronta(), quante_tracce(), chiamata(text, text), tracce_viste(text, text), scritture_negate(text, text) to anon, authenticated;

\echo ''
\echo '--- 1. chi può: solo l''amministrazione ---'
select atteso('la segreteria semplice no', chiamata('11111111-1111-1111-1111-111111111111', 'authenticated'), '42501 la contabilità la cura l’amministrazione');
select atteso('l''istruttore no', chiamata('55555555-5555-5555-5555-555555555555', 'authenticated'), '42501 la contabilità la cura l’amministrazione');
select atteso('l''iscritto no', chiamata('77777777-7777-7777-7777-777777777777', 'authenticated'), '42501 la contabilità la cura l’amministrazione');
select atteso('il tablet no', chiamata('99999999-9999-9999-9999-999999999999', 'authenticated'), '42501 la contabilità la cura l’amministrazione');
select atteso('chi non ha una scheda no', chiamata('66666666-6666-6666-6666-666666666666', 'authenticated'), '42501 la contabilità la cura l’amministrazione');
select atteso('anon non ha nemmeno il permesso di chiamarla', chiamata('00000000-0000-0000-0000-000000000000', 'anon'), '42501 permission denied for function cambia_voce_movimenti');
select atteso('l''amministrazione arriva ai controlli (lista vuota: scegli almeno un movimento)', chiamata('22222222-2222-2222-2222-222222222222', 'authenticated'), '22023 Scegli almeno un movimento');
select atteso('anche la segreteria con anche_amministrazione', chiamata('33333333-3333-3333-3333-333333333333', 'authenticated'), '22023 Scegli almeno un movimento');
select atteso('anche l''amministrazione che è anche istruttore', chiamata('44444444-4444-4444-4444-444444444444', 'authenticated'), '22023 Scegli almeno un movimento');
select atteso('authenticated la chiama, anon no (permessi)', (select string_agg(r || ':' || has_function_privilege(r, p.oid, 'execute')::text, ', ' order by r) from pg_proc p, unnest(array['anon', 'authenticated']) r
  where p.pronamespace = 'public'::regnamespace and p.proname = 'cambia_voce_movimenti'), 'anon:false, authenticated:true');

\echo ''
\echo '--- 2. i dati di partenza ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select salva_voce('{"nome": "Affitto sala", "tipo": "uscita"}') is not null as a1 \gset
select salva_voce('{"nome": "Energia", "tipo": "uscita"}') is not null as a2 \gset
select salva_voce('{"nome": "Vecchia", "tipo": "uscita"}') is not null as a3 \gset
select salva_voce('{"nome": "Donazioni", "tipo": "entrata"}') is not null as a4 \gset
select salva_voce('{"nome": "Eventi", "tipo": "entrata"}') is not null as a5 \gset
reset role;
-- «Da classificare» arriva dall'import: lo storico vero è così.
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select importa_prima_nota(jsonb_build_array(
  jsonb_build_object('chiave', 'pn:1', 'data', '2019-03-14', 'cassa', 'conto', 'tipo', 'uscita', 'importo', 8400, 'descrizione', 'BONIFICO SIAE', 'voce', 'Da classificare'),
  jsonb_build_object('chiave', 'pn:2', 'data', '2019-03-02', 'cassa', 'conto', 'tipo', 'uscita', 'importo', 31240, 'descrizione', 'BONIFICO ENEL', 'voce', 'Da classificare'),
  jsonb_build_object('chiave', 'pn:3', 'data', '2019-02-28', 'cassa', 'conto', 'tipo', 'uscita', 'importo', 180000, 'descrizione', 'BONIFICO AFFITTO', 'voce', 'Da classificare'),
  jsonb_build_object('chiave', 'pn:4', 'data', '2019-02-20', 'cassa', 'conto', 'tipo', 'entrata', 'importo', 5000, 'descrizione', 'BONIFICO DONAZIONE', 'voce', 'Da classificare'),
  jsonb_build_object('chiave', 'pn:5', 'data', '2019-02-10', 'cassa', 'conto', 'tipo', 'uscita', 'importo', 5000, 'descrizione', 'BONIFICO DA DISFARE', 'voce', 'Da classificare'))) as importate \gset
select imposta_saldo_cassa(id_cassa('Cassa Contanti'), 0, '2026-09-01') is not null as r0 \gset
select registra_movimento(jsonb_build_object('tipo', 'entrata', 'data', '2026-09-05', 'importo', 5000, 'voce_id', id_voce('Donazioni', 'entrata'), 'cassa_id', id_cassa('Cassa Contanti'), 'descrizione', 'Offerta in contanti', 'nota', 'per la gara')) is not null as r1 \gset
select registra_movimento(jsonb_build_object('tipo', 'uscita', 'data', '2026-09-06', 'importo', 1200, 'voce_id', id_voce('Affitto sala', 'uscita'), 'cassa_id', id_cassa('Cassa Contanti'), 'descrizione', 'Pulizie di settembre')) is not null as r2 \gset
select registra_giroconto(jsonb_build_object('da', id_cassa('Cassa Contanti'), 'a', id_cassa('Conto Corrente'), 'data', '2026-09-06', 'importo', 1000)) is not null as r3 \gset
select annulla_movimento(id_mov('BONIFICO DA DISFARE')) is not null as r4 \gset
-- La cassa contanti si chiude il 7 settembre con 500 centesimi in meno: nasce la «Differenza di cassa».
select chiudi_cassa(jsonb_build_object('cassa_id', id_cassa('Cassa Contanti'), 'data', '2026-09-07', 'contato', 2300)) is not null as r5 \gset
select imposta_voce_attiva(id_voce('Vecchia', 'uscita'), false) is not null as r6 \gset
reset role;
select atteso('lo storico c''è, tutto in «Da classificare»', (select count(*)::text from movimenti where origine_import is not null and voce_id in (select id from voci_contabili where nome = 'Da classificare')), '5');
select atteso('la chiusura ha scritto la differenza', (select count(*)::text from movimenti where descrizione = 'Differenza di cassa'), '1');
select previsto::text || '/' || differenza::text as chiusura_prima from chiusure_cassa where annullata_il is null \gset
select previsto_cassa(id_cassa('Cassa Contanti'), '2026-09-07')::text as calcolato_prima \gset
select atteso('la chiusura ha previsto 2800 e differenza −500', :'chiusura_prima', '2800/-500');
select atteso('nessuna traccia, per ora', quante_tracce(), '0');

\echo ''
\echo '--- 3. un movimento solo: cambia la voce e basta ---'
select senza_voce('BONIFICO SIAE') as s_siae \gset
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('un lotto di uno: cambiato 1, già così 0', (select cambia_voce_movimenti(array[id_mov('BONIFICO SIAE')], id_voce('Affitto sala', 'uscita'))::text), '{"cambiati": 1, "gia_cosi": 0}');
reset role;
select atteso('la voce è quella nuova', voce_di('BONIFICO SIAE'), 'Affitto sala');
select atteso('importo, data, cassa, tipo, testo, chi l''ha scritto: tutto com''era', senza_voce('BONIFICO SIAE'), :'s_siae');
select atteso('una riga di traccia', quante_tracce(), '1');
select atteso('…con chi, quando, la voce di prima e quella di dopo', (select p.nome || ' ' || v1.nome || ' → ' || v2.nome || ' ' || (c.cambiato_il > now() - interval '1 minute')::text
  from cambi_voce c join persone p on p.id = c.cambiato_da join voci_contabili v1 on v1.id = c.voce_prima_id join voci_contabili v2 on v2.id = c.voce_dopo_id
  where c.movimento_id = id_mov('BONIFICO SIAE')), 'Ada Da classificare → Affitto sala true');

\echo ''
\echo '--- 4. un lotto, le voci già giuste, il doppione ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('due movimenti in «Da classificare» e quello già a posto: 2 cambiati, 1 già così',
  (select cambia_voce_movimenti(array[id_mov('BONIFICO ENEL'), id_mov('BONIFICO AFFITTO'), id_mov('BONIFICO SIAE')], id_voce('Affitto sala', 'uscita'))::text), '{"cambiati": 2, "gia_cosi": 1}');
reset role;
select atteso('tre in traccia, non quattro: chi era già a posto non lascia niente', quante_tracce(), '3');
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('lo stesso id due volte conta una', (select cambia_voce_movimenti(array[id_mov('BONIFICO ENEL'), id_mov('BONIFICO ENEL')], id_voce('Energia', 'uscita'))::text), '{"cambiati": 1, "gia_cosi": 0}');
select atteso('rifatto uguale: niente da cambiare', (select cambia_voce_movimenti(array[id_mov('BONIFICO ENEL')], id_voce('Energia', 'uscita'))::text), '{"cambiati": 0, "gia_cosi": 1}');
reset role;
select atteso('la traccia non cresce se non cambia niente ', quante_tracce(), '4');
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('una voce di entrata a un''entrata', esito(format('select cambia_voce_movimenti(array[%L::uuid], %L::uuid)', id_mov('BONIFICO DONAZIONE'), id_voce('Donazioni', 'entrata'))), 'ok');
reset role;
select atteso('…che ha messo Donazioni', voce_di('BONIFICO DONAZIONE'), 'Donazioni');

\echo ''
\echo '--- 5. quel che non va si rifiuta, e un lotto o entra tutto o niente ---'
select impronta() as prima \gset
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('senza voce', esito(format('select cambia_voce_movimenti(array[%L::uuid], null)', id_mov('BONIFICO SIAE'))), '22023 Scegli la voce');
select atteso('una voce che non c''è', esito(format('select cambia_voce_movimenti(array[%L::uuid], gen_random_uuid())', id_mov('BONIFICO SIAE'))), '22023 Scegli la voce');
select atteso('una voce spenta', esito(format('select cambia_voce_movimenti(array[%L::uuid], %L::uuid)', id_mov('BONIFICO SIAE'), id_voce('Vecchia', 'uscita'))), '22023 La voce non è più in uso: scegline un’altra');
select atteso('«Differenza di cassa» come arrivo', esito(format('select cambia_voce_movimenti(array[%L::uuid], %L::uuid)', id_mov('BONIFICO SIAE'), id_voce('Differenza di cassa', 'uscita'))), '22023 La «Differenza di cassa» si scrive da sola chiudendo la cassa');
select atteso('la differenza di una chiusura non cambia voce', esito(format('select cambia_voce_movimenti(array[%L::uuid], %L::uuid)', id_mov('Differenza di cassa'), id_voce('Affitto sala', 'uscita'))), '22023 Il movimento del 07/09/2026 (Differenza di cassa) è scritto dalla chiusura di cassa: non si cambia');
select atteso('un movimento che non c''è', esito($$select cambia_voce_movimenti(array[gen_random_uuid()], (select id from voci_contabili where nome = 'Affitto sala'))$$), 'P0002 Il movimento non c’è');
select atteso('un incasso di un iscritto non è un movimento', esito($$select cambia_voce_movimenti(array['00000000-0000-0000-0000-00000000aaaa'::uuid], (select id from voci_contabili where nome = 'Affitto sala'))$$), 'P0002 Il movimento non c’è');
select atteso('un annullato', esito(format('select cambia_voce_movimenti(array[%L::uuid], %L::uuid)', id_mov('BONIFICO DA DISFARE'), id_voce('Affitto sala', 'uscita'))), '22023 Il movimento del 10/02/2019 (BONIFICO DA DISFARE) è annullato: non si cambia');
select atteso('un giroconto', esito(format('select cambia_voce_movimenti(array[%L::uuid], %L::uuid)', (select id from movimenti where tipo = 'giroconto'), id_voce('Affitto sala', 'uscita'))), '22023 Un giroconto non ha voce');
select atteso('una voce di uscita a un''entrata', esito(format('select cambia_voce_movimenti(array[%L::uuid], %L::uuid)', id_mov('BONIFICO DONAZIONE'), id_voce('Affitto sala', 'uscita'))), '22023 La voce scelta non va con questo tipo di movimento');
select atteso('entrate e uscite insieme', esito(format('select cambia_voce_movimenti(array[%L::uuid, %L::uuid], %L::uuid)', id_mov('BONIFICO DONAZIONE'), id_mov('BONIFICO SIAE'), id_voce('Energia', 'uscita'))), '22023 La voce scelta non va con questo tipo di movimento');
select atteso('il quarto è annullato: nessuno dei primi cambia', esito(format('select cambia_voce_movimenti(array[%L::uuid, %L::uuid, %L::uuid, %L::uuid], %L::uuid)', id_mov('BONIFICO SIAE'), id_mov('BONIFICO ENEL'), id_mov('BONIFICO AFFITTO'), id_mov('BONIFICO DA DISFARE'), id_voce('Energia', 'uscita'))), '22023 Il movimento del 10/02/2019 (BONIFICO DA DISFARE) è annullato: non si cambia');
select atteso('una lista vuota', esito($$select cambia_voce_movimenti(array[]::uuid[], (select id from voci_contabili where nome = 'Energia'))$$), '22023 Scegli almeno un movimento');
select atteso('nessuna lista', esito($$select cambia_voce_movimenti(null, (select id from voci_contabili where nome = 'Energia'))$$), '22023 Scegli almeno un movimento');
select atteso('cinquecentouno movimenti', esito($$select cambia_voce_movimenti(array(select gen_random_uuid() from generate_series(1, 501)), (select id from voci_contabili where nome = 'Energia'))$$), '22023 Troppi movimenti in una volta: al massimo 500');
reset role;
select atteso('dei rifiuti non è rimasto niente: né voci, né traccia', impronta(), :'prima');

\echo ''
\echo '--- 6. il giorno chiuso: la voce si cambia, la chiusura non se ne accorge ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('il movimento in contanti del 5 settembre è di un giorno chiuso, e la voce cambia',
  esito(format('select cambia_voce_movimenti(array[%L::uuid], %L::uuid)', id_mov('Offerta in contanti'), id_voce('Eventi', 'entrata'))), 'ok');
select atteso('…anche un''uscita di quei giorni', esito(format('select cambia_voce_movimenti(array[%L::uuid], %L::uuid)', id_mov('Pulizie di settembre'), id_voce('Energia', 'uscita'))), 'ok');
reset role;
select atteso('…ora ha la voce nuova', voce_di('Pulizie di settembre'), 'Energia');
select atteso('la chiusura è quella di prima: previsto e differenza', (select previsto::text || '/' || differenza::text from chiusure_cassa where annullata_il is null), :'chiusura_prima');
select atteso('…e il previsto di quel giorno calcolato adesso è lo stesso', previsto_cassa(id_cassa('Cassa Contanti'), '2026-09-07')::text, :'calcolato_prima');
select atteso('…la voce nuova c''è', voce_di('Offerta in contanti'), 'Eventi');
select atteso('il giorno è ancora chiuso: un movimento nuovo lì no', (select esito(format('select registra_movimento(%L::jsonb)', jsonb_build_object('tipo', 'uscita', 'data', '2026-09-06', 'importo', 100, 'voce_id', id_voce('Energia', 'uscita'), 'cassa_id', id_cassa('Cassa Contanti'), 'descrizione', 'No')))), '22023 Quel giorno è già chiuso: per correggere scrivi il movimento con una data dopo la chiusura e una voce di rettifica (si crea in VOCI), oppure annulla la chiusura');

\echo ''
\echo '--- 7. la traccia: la legge solo l''amministrazione, non la scrive nessuno da fuori ---'
select atteso('l''amministrazione la legge', tracce_viste('22222222-2222-2222-2222-222222222222', 'authenticated'), quante_tracce());
select atteso('anche la segreteria con anche_amministrazione', tracce_viste('33333333-3333-3333-3333-333333333333', 'authenticated'), quante_tracce());
select atteso('la segreteria semplice non ne vede una', tracce_viste('11111111-1111-1111-1111-111111111111', 'authenticated'), '0');
select atteso('l''istruttore no', tracce_viste('55555555-5555-5555-5555-555555555555', 'authenticated'), '0');
select atteso('l''iscritto no', tracce_viste('77777777-7777-7777-7777-777777777777', 'authenticated'), '0');
select atteso('il tablet no', tracce_viste('99999999-9999-9999-9999-999999999999', 'authenticated'), '0');
select atteso('anon non ha il permesso di leggerla', tracce_viste('00000000-0000-0000-0000-000000000000', 'anon'), 'NEGATO: permission denied for table cambi_voce');
select atteso('nessuno scrive dritto sulla traccia: l''amministrazione', scritture_negate('22222222-2222-2222-2222-222222222222', 'authenticated'), '3/3');
select atteso('…la segreteria', scritture_negate('11111111-1111-1111-1111-111111111111', 'authenticated'), '3/3');
select atteso('…anon', scritture_negate('00000000-0000-0000-0000-000000000000', 'anon'), '3/3');

\echo ''
\echo '--- 8. rilanciare l''import non rimette «Da classificare» sulle righe sistemate ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('lo stesso pacchetto un''altra volta: ne entrano zero', (select importa_prima_nota(jsonb_build_array(
  jsonb_build_object('chiave', 'pn:1', 'data', '2019-03-14', 'cassa', 'conto', 'tipo', 'uscita', 'importo', 8400, 'descrizione', 'BONIFICO SIAE', 'voce', 'Da classificare'),
  jsonb_build_object('chiave', 'pn:2', 'data', '2019-03-02', 'cassa', 'conto', 'tipo', 'uscita', 'importo', 31240, 'descrizione', 'BONIFICO ENEL', 'voce', 'Da classificare')))::text), '0');
reset role;
select atteso('…e le voci nuove restano', voce_di('BONIFICO SIAE') || '/' || voce_di('BONIFICO ENEL'), 'Affitto sala/Energia');

\echo ''
\echo '--- 9. come è fatta ---'
select atteso('prende i blocchi in ordine: for update sulle righe', (select (prosrc ~* 'for update')::text from pg_proc where proname = 'cambia_voce_movimenti' and pronamespace = 'public'::regnamespace), 'true');
select atteso('blocca la voce di arrivo (for share): chi la spegne nello stesso momento aspetta', (select (prosrc ~* 'for share')::text from pg_proc where proname = 'cambia_voce_movimenti' and pronamespace = 'public'::regnamespace), 'true');
select atteso('è security definer con il suo search_path', (select (prosecdef and proconfig::text like '%search_path=public%')::text from pg_proc where proname = 'cambia_voce_movimenti' and pronamespace = 'public'::regnamespace), 'true');
select atteso('la traccia ha la riga di sicurezza accesa', (select relrowsecurity::text from pg_class where oid = 'public.cambi_voce'::regclass), 'true');
