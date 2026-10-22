-- Quote e corsi scritti a mano con la persona (98-quote-persona.sql): un'entrata scritta in CONTABILITÀ
-- (Nuovo movimento, Satispay, la chat) su «Quota associativa» o «Corsi e altri pagamenti» ha la persona che ha
-- pagato, ed è obbligatoria. `registra_movimento` la chiede, `cambia_voce_movimenti` la chiede una riga alla
-- volta, `collegamento_perche` lascia collegare anche quelle a mano, `storico_persona` dice quali sono scritte a
-- mano (`a_mano`). Lo storico `prima-nota:` resta com'era: collegamento facoltativo, blocco automatico solo su di
-- lui, cambio voce anche in blocco. Il collegamento è un'etichetta: importi, saldi e chiusure non si toccano.
-- Le stesse regole di src/lib/contabilita.ts, src/lib/movimentiPersona.ts e della modalità prova, provate da
-- scripts/prova-contabilita.mjs, scripts/prova-movimenti-persona.mjs e scripts/prova-segreteria.mjs.
-- Si lancia dopo finto-supabase.sql e i file dello schema, su un database suo. Nomi tutti inventati.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

select (to_regprocedure('public.cambia_voce_movimenti(uuid[], uuid, uuid)') is not null
    and to_regprocedure('public.registra_movimento(jsonb)') is not null
    and to_regprocedure('public.collega_movimenti_persona(uuid[], uuid)') is not null
    and exists (select 1 from pg_proc p, unnest(p.proargnames) n where p.oid = to_regprocedure('public.storico_persona(uuid)') and n = 'a_mano'))::text as c98 \gset
create or replace function atteso(cosa text, avuto text, voluto text) returns text language plpgsql as $$
begin
  if avuto is distinct from voluto and not (voluto like '%…' and avuto like replace(voluto, '…', '%')) then
    raise exception '% · atteso «%», avuto «%»', cosa, voluto, avuto;
  end if;
  return 'ok  ' || cosa || ' → ' || avuto;
end $$;
select atteso('98-quote-persona.sql è stato lanciato: cambia_voce a tre argomenti e storico con a_mano', :'c98', 'true');
select (to_regclass('public.chiusure_cassa') is not null and to_regprocedure('public.importa_prima_nota(jsonb)') is not null and to_regclass('public.collegamenti_persona') is not null)::text as c70 \gset
select atteso('60, 63, 67 e 70 sono stati lanciati', :'c70', 'true');

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'ada@ods.it'),
  ('33333333-3333-3333-3333-333333333333', 'sandro@ods.it'),
  ('55555555-5555-5555-5555-555555555555', 'maura@ods.it'),
  ('99999999-9999-9999-9999-999999999999', 'tablet@ods.it');
-- Anna: solo segreteria. Ada: solo amministrazione. Sandro: segreteria e amministrazione. Maura: istruttore.
insert into persone (id, nome, cognome, ruolo, anche_istruttore, anche_amministrazione, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', false, false, 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Ada', 'Conti', 'amministrazione', false, false, 'ada@ods.it', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Sandro', 'Doppio', 'staff', false, true, 'sandro@ods.it', '33333333-3333-3333-3333-333333333333'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'Maura', 'Uno', 'istruttore', false, false, 'maura@ods.it', '55555555-5555-5555-5555-555555555555');
insert into persone (id, nome, cognome, ruolo) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'Giulia', 'Verdi', 'iscritto'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'Marco', 'Neri', 'iscritto');
insert into sale (id, nome) values ('bbbbbbbb-0000-0000-0000-000000000001', 'Tatami');
insert into postazioni (id, nome, sala_id, utente_id) values
  ('dddddddd-0000-0000-0000-000000000001', 'Tablet', 'bbbbbbbb-0000-0000-0000-000000000001', '99999999-9999-9999-9999-999999999999');

create or replace function chi(u text) returns void language plpgsql as $$
begin perform set_config('prova.utente', u, false); end $$;
create or replace function esito(sql text) returns text language plpgsql as $$
begin execute sql; return 'ok';
exception when others then return sqlstate || ' ' || sqlerrm;
end $$;
create or replace function id_cassa(n text) returns uuid language sql stable security definer set search_path = public as $$ select id from casse where nome = n $$;
create or replace function id_voce(n text, t text) returns uuid language sql stable security definer set search_path = public as $$
  select id from voci_contabili where nome = n and tipo::text = t $$;
create or replace function id_mov(d text) returns uuid language sql stable security definer set search_path = public as $$ select id from movimenti where descrizione = d $$;
create or replace function voce_di(d text) returns text language sql stable security definer set search_path = public as $$
  select v.nome from movimenti m join voci_contabili v on v.id = m.voce_id where m.descrizione = d $$;
create or replace function persona_di(d text) returns text language sql stable security definer set search_path = public as $$
  select coalesce(p.cognome, '—') from movimenti m left join persone p on p.id = m.persona_id where m.descrizione = d $$;
create or replace function quanti(d text) returns text language sql stable security definer set search_path = public as $$
  select count(*)::text from movimenti where descrizione = d $$;
create or replace function tracce_cambi() returns text language sql stable security definer set search_path = public as $$ select count(*)::text from cambi_voce $$;
create or replace function tracce_coll() returns text language sql stable security definer set search_path = public as $$ select count(*)::text from collegamenti_persona $$;
-- Tutto di un movimento tranne la persona e la voce: per accorgersi di una riga che cambia altro.
create or replace function senza_persona(d text) returns text language sql stable security definer set search_path = public as $$
  select md5(row(tipo, data, importo, cassa_id, descrizione, nota, creato_da, creato_il, annullato_il)::text) from movimenti where descrizione = d $$;
create or replace function impronta() returns text language sql stable security definer set search_path = public as $$
  select md5(coalesce((select string_agg(m::text, '|' order by m.id) from movimenti m), '')
          || coalesce((select string_agg(c::text, '|' order by c.id) from cambi_voce c), '')
          || coalesce((select string_agg(c::text, '|' order by c.id) from collegamenti_persona c), '')) $$;
-- Una chiamata come utente e ruolo: l'esito («ok» o «codice testo»).
create or replace function come(utente text, ruolo text, sql text) returns text language plpgsql as $$
declare r text;
begin
  perform set_config('prova.utente', utente, false);
  execute format('set role %I', ruolo);
  r := esito(sql);
  reset role;
  return r;
end $$;
-- Il risultato di una select come utente e ruolo.
create or replace function come_json(utente text, ruolo text, sql text) returns text language plpgsql as $$
declare r text;
begin
  perform set_config('prova.utente', utente, false);
  execute format('set role %I', ruolo);
  execute sql into r;
  reset role;
  return r;
end $$;
-- Un movimento di Quota o Corsi scritto a mano come l'amministrazione: la descrizione è la chiave.
create or replace function reg(t text, imp int, v text, persona uuid, d text) returns text language plpgsql as $$
begin
  return come('22222222-2222-2222-2222-222222222222', 'authenticated', format(
    $q$select registra_movimento(jsonb_strip_nulls(jsonb_build_object('tipo', %L, 'data', '2026-09-10', 'importo', %s, 'voce_id', id_voce(%L, %L),
       'cassa_id', id_cassa('Conto Corrente'), 'descrizione', %L, 'persona_id', %L)))$q$, t, imp, v, t, d, persona));
end $$;
grant execute on function atteso(text, text, text), chi(text), esito(text), id_cassa(text), id_voce(text, text), id_mov(text), voce_di(text), persona_di(text),
  quanti(text), tracce_cambi(), tracce_coll(), senza_persona(text), impronta(), come(text, text, text), come_json(text, text, text), reg(text, int, text, uuid, text) to anon, authenticated;

-- Dati di partenza: due movimenti a mano che non hanno la persona (scritti prima della regola), uno dello storico.
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select importa_prima_nota(jsonb_build_array(
  jsonb_build_object('chiave', 'prima-nota:1', 'data', '2019-03-14', 'cassa', 'conto', 'tipo', 'entrata', 'importo', 8400, 'descrizione', 'Cliente Giulia Verdi per quota', 'voce', 'Quota associativa'),
  jsonb_build_object('chiave', 'prima-nota:2', 'data', '2019-03-02', 'cassa', 'conto', 'tipo', 'entrata', 'importo', 3000, 'descrizione', 'BONIFICO GENERICO', 'voce', 'Da classificare'),
  jsonb_build_object('chiave', 'prima-nota:3', 'data', '2019-03-03', 'cassa', 'conto', 'tipo', 'entrata', 'importo', 3500, 'descrizione', 'BONIFICO GENERICO DUE', 'voce', 'Da classificare'),
  jsonb_build_object('chiave', 'prima-nota:4', 'data', '2019-03-05', 'cassa', 'conto', 'tipo', 'entrata', 'importo', 4000, 'descrizione', 'Cliente Giulia Verdi per corso storico', 'voce', 'Corsi e altri pagamenti'))) as importate \gset
select salva_voce('{"nome": "Donazioni", "tipo": "entrata"}') is not null as a1 \gset
select salva_voce('{"nome": "Affitto sala", "tipo": "uscita"}') is not null as a2 \gset
reset role;
-- A mano, senza passare da registra_movimento (che ora chiede la persona): come erano scritti prima.
insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione, creato_da) values
  ('entrata', '2026-09-01', 5000, id_voce('Quota associativa', 'entrata'), id_cassa('Conto Corrente'), 'A mano quota vecchia', null),
  ('entrata', '2026-09-02', 6000, id_voce('Corsi e altri pagamenti', 'entrata'), id_cassa('Conto Corrente'), 'Cliente Giulia Verdi per Satispay', null),
  ('entrata', '2026-09-03', 7000, id_voce('Donazioni', 'entrata'), id_cassa('Conto Corrente'), 'A mano donazione', null),
  ('entrata', '2026-09-04', 7100, id_voce('Donazioni', 'entrata'), id_cassa('Conto Corrente'), 'A mano donazione due', null),
  ('uscita', '2026-09-05', 2000, id_voce('Affitto sala', 'uscita'), id_cassa('Conto Corrente'), 'A mano affitto', null),
  ('entrata', '2026-09-06', 1000, id_voce('Quota associativa', 'entrata'), id_cassa('Conto Corrente'), 'A mano quota da annullare', null);
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select annulla_movimento(id_mov('A mano quota da annullare')) is not null as an \gset
reset role;

\echo ''
\echo '--- 1. registra_movimento: una quota o un corso vuole la persona ---'
select impronta() as prima \gset
select atteso('quota senza persona no', reg('entrata', 4500, 'Quota associativa', null, 'R quota senza'), '22023 Scegli la persona');
select atteso('corsi senza persona no', reg('entrata', 4500, 'Corsi e altri pagamenti', null, 'R corsi senza'), '22023 Scegli la persona');
select atteso('una persona che non c''è no', reg('entrata', 4500, 'Quota associativa', 'eeeeeeee-9999-0000-0000-000000000000', 'R quota fantasma'), '22023 Scegli la persona');
select atteso('niente è entrato, né traccia', impronta(), :'prima');
select atteso('quota con la persona: va', reg('entrata', 4500, 'Quota associativa', 'eeeeeeee-0000-0000-0000-000000000001', 'R quota Giulia'), 'ok');
select atteso('corsi con la persona: va', reg('entrata', 9000, 'Corsi e altri pagamenti', 'eeeeeeee-0000-0000-0000-000000000002', 'R corsi Marco'), 'ok');
select atteso('il movimento ha la persona', persona_di('R quota Giulia') || ' ' || persona_di('R corsi Marco'), 'Verdi Neri');
select atteso('…e la voce e l''importo che si è scelto', voce_di('R quota Giulia') || ' ' || (select importo from movimenti where descrizione = 'R quota Giulia'), 'Quota associativa 4500');
select atteso('…con la sua traccia: prima nessuno, dopo la persona, nessun lotto, scritta da Ada',
  (select coalesce(c.persona_prima_id::text, '—') || ' ' || p.cognome || ' ' || coalesce(c.lotto::text, '—') || ' ' || a.nome
     from collegamenti_persona c join persone p on p.id = c.persona_dopo_id join persone a on a.id = c.fatto_da
     where c.movimento_id = id_mov('R quota Giulia')), '— Verdi — Ada');
select atteso('una traccia per movimento, non di più', tracce_coll(), '2');
select atteso('un''altra voce di entrata: la persona non serve', reg('entrata', 2500, 'Donazioni', null, 'R donazione senza'), 'ok');
select atteso('…e se c''è, non si scrive', persona_di('R donazione senza'), '—');
select atteso('…neanche quando la si dà', reg('entrata', 2600, 'Donazioni', 'eeeeeeee-0000-0000-0000-000000000001', 'R donazione con'), 'ok');
select atteso('…resta senza persona', persona_di('R donazione con'), '—');
select atteso('un''uscita non vuole la persona', reg('uscita', 1500, 'Affitto sala', null, 'R affitto'), 'ok');
select atteso('la chat continua a rifiutare quota e corsi (gli incassi si fanno in PAGAMENTI)',
  come('22222222-2222-2222-2222-222222222222', 'authenticated', $q$select registra_movimento_dalla_chat(jsonb_build_object('chiave', 'Q1', 'tipo', 'entrata', 'data', '2026-09-10', 'importo', 4590,
    'voce_id', id_voce('Quota associativa', 'entrata'), 'cassa_id', id_cassa('Conto Corrente'), 'descrizione', 'Quota'))$q$), '22023 Gli incassi degli iscritti si registrano in PAGAMENTI');
select atteso('chi non è amministrazione non registra: la segreteria no', come('11111111-1111-1111-1111-111111111111', 'authenticated',
  format($q$select registra_movimento(jsonb_build_object('tipo', 'entrata', 'data', '2026-09-10', 'importo', 100, 'voce_id', id_voce('Quota associativa', 'entrata'), 'cassa_id', id_cassa('Conto Corrente'),
    'descrizione', 'R segreteria', 'persona_id', %L))$q$, 'eeeeeeee-0000-0000-0000-000000000001')), '42501 la contabilità la cura l’amministrazione');
select atteso('…nemmeno l''istruttore', come('55555555-5555-5555-5555-555555555555', 'authenticated',
  format($q$select registra_movimento(jsonb_build_object('tipo', 'entrata', 'data', '2026-09-10', 'importo', 100, 'voce_id', id_voce('Quota associativa', 'entrata'), 'cassa_id', id_cassa('Conto Corrente'),
    'descrizione', 'R istruttore', 'persona_id', %L))$q$, 'eeeeeeee-0000-0000-0000-000000000001')), '42501 la contabilità la cura l’amministrazione');
select atteso('…e il tablet no', come('99999999-9999-9999-9999-999999999999', 'authenticated',
  format($q$select registra_movimento(jsonb_build_object('tipo', 'entrata', 'data', '2026-09-10', 'importo', 100, 'voce_id', id_voce('Quota associativa', 'entrata'), 'cassa_id', id_cassa('Conto Corrente'),
    'descrizione', 'R tablet', 'persona_id', %L))$q$, 'eeeeeeee-0000-0000-0000-000000000001')), '42501 la contabilità la cura l’amministrazione');

\echo ''
\echo '--- 2. collegare: anche le entrate a mano su quota e corsi ---'
create or replace function perche(d text) returns text language sql stable security definer set search_path = public as $$
  select coalesce(collegamento_perche(m), '—') from movimenti m where m.descrizione = d $$;
grant execute on function perche(text) to anon, authenticated;
select atteso('una quota a mano si collega', perche('A mano quota vecchia'), '—');
select atteso('…e un corso a mano, anche con «Cliente NOME per…» (Satispay)', perche('Cliente Giulia Verdi per Satispay'), '—');
select atteso('…e quello appena registrato', perche('R quota Giulia'), '—');
select atteso('…e quello dello storico', perche('Cliente Giulia Verdi per quota'), '—');
select atteso('una donazione a mano no: non è quota né corso', perche('A mano donazione'),
  'Il movimento del 03/09/2026 (A mano donazione) è su «Donazioni»: si collegano solo quelli su «Quota associativa» e «Corsi e altri pagamenti»');
select atteso('un''uscita no', perche('A mano affitto'), 'Il movimento del 05/09/2026 (A mano affitto) è un’uscita: si collegano solo le entrate');
select atteso('un annullato no', perche('A mano quota da annullare'), 'Il movimento del 06/09/2026 (A mano quota da annullare) è annullato: non si collega');

select impronta() as prima \gset
select atteso('l''amministrazione collega una quota e un corso a mano a Giulia', come('22222222-2222-2222-2222-222222222222', 'authenticated',
  format($q$select collega_movimenti_persona(array[%L::uuid, %L::uuid], %L::uuid)$q$, id_mov('A mano quota vecchia'), id_mov('Cliente Giulia Verdi per Satispay'), 'eeeeeeee-0000-0000-0000-000000000001')), 'ok');
select atteso('…hanno la persona', persona_di('A mano quota vecchia') || ' ' || persona_di('Cliente Giulia Verdi per Satispay'), 'Verdi Verdi');
select atteso('una donazione a mano non si collega (lotto rifiutato)', come('22222222-2222-2222-2222-222222222222', 'authenticated',
  format($q$select collega_movimenti_persona(array[%L::uuid], %L::uuid)$q$, id_mov('A mano donazione'), 'eeeeeeee-0000-0000-0000-000000000001')),
  '22023 Il movimento del 03/09/2026 (A mano donazione) è su «Donazioni»: …');
select atteso('la segreteria non collega', come('11111111-1111-1111-1111-111111111111', 'authenticated',
  format($q$select collega_movimenti_persona(array[%L::uuid], %L::uuid)$q$, id_mov('A mano quota vecchia'), 'eeeeeeee-0000-0000-0000-000000000002')), '42501 la contabilità la cura l’amministrazione');
select atteso('l''amministrazione li scollega', come('22222222-2222-2222-2222-222222222222', 'authenticated',
  format($q$select scollega_movimenti_persona(array[%L::uuid, %L::uuid])$q$, id_mov('A mano quota vecchia'), id_mov('Cliente Giulia Verdi per Satispay'))), 'ok');
select atteso('…senza persona di nuovo', persona_di('A mano quota vecchia') || ' ' || persona_di('Cliente Giulia Verdi per Satispay'), '— —');
select atteso('importi, voce e testi non sono cambiati dal collegamento', voce_di('A mano quota vecchia') || ' ' || (select importo from movimenti where descrizione = 'A mano quota vecchia'), 'Quota associativa 5000');

\echo ''
\echo '--- 3. il blocco automatico guarda solo lo storico, mai quel che è scritto a mano ---'
select atteso('il riepilogo: due sicuri, tutti dello storico (la causale «Cliente Giulia Verdi per Satispay» a mano non conta)',
  come_json('22222222-2222-2222-2222-222222222222', 'authenticated', $q$select (riepilogo_collegamenti_persona()->'sicuri'->>'movimenti') || ' ' || (riepilogo_collegamenti_persona()->'senza_scheda'->>'movimenti')
    || ' ' || (riepilogo_collegamenti_persona()->'da_decidere'->>'movimenti') || ' ' || (riepilogo_collegamenti_persona()->>'gia_collegati')$q$), '2 0 0 0');
select atteso('gli esiti: solo i due dello storico', come_json('22222222-2222-2222-2222-222222222222', 'authenticated', $q$select jsonb_array_length(esiti_collegamenti_persona())::text$q$), '2');
select atteso('…e il movimento a mano non c''è', come_json('22222222-2222-2222-2222-222222222222', 'authenticated',
  format($q$select (esiti_collegamenti_persona() @> jsonb_build_array(jsonb_build_object('id', %L, 'esito', 'sicuro')))::text$q$, id_mov('Cliente Giulia Verdi per Satispay'))), 'false');
select atteso('il blocco collega i due dello storico e basta', come_json('22222222-2222-2222-2222-222222222222', 'authenticated',
  $q$select collega_sicuri_persona(gen_random_uuid(), 500)::text$q$), '{"restano": 0, "collegati": 2}');
select atteso('…il Satispay a mano è rimasto senza persona', persona_di('Cliente Giulia Verdi per Satispay'), '—');
select atteso('…e quelli dello storico hanno Giulia', persona_di('Cliente Giulia Verdi per quota') || ' ' || persona_di('Cliente Giulia Verdi per corso storico'), 'Verdi Verdi');
select atteso('un secondo giro non trova niente', come_json('22222222-2222-2222-2222-222222222222', 'authenticated', $q$select collega_sicuri_persona(gen_random_uuid(), 500)::text$q$), '{"restano": 0, "collegati": 0}');

\echo ''
\echo '--- 4. cambiare la voce: a mano una riga alla volta con la persona, lo storico anche in blocco ---'
select atteso('la funzione a due argomenti non c''è più', coalesce(to_regprocedure('public.cambia_voce_movimenti(uuid[], uuid)')::text, 'no'), 'no');
select impronta() as prima \gset
select 'Una quota o un corso si sposta una riga alla volta, con la persona: apri il movimento dall’elenco e cambia la voce lì.' as una_riga \gset
select atteso('due a mano verso Quota: no, una riga alla volta', come('22222222-2222-2222-2222-222222222222', 'authenticated',
  format($q$select cambia_voce_movimenti(array[%L::uuid, %L::uuid], %L::uuid, %L::uuid)$q$, id_mov('A mano donazione'), id_mov('A mano donazione due'), id_voce('Quota associativa', 'entrata'), 'eeeeeeee-0000-0000-0000-000000000001')),
  '22023 ' || :'una_riga');
select atteso('…anche verso Corsi', come('22222222-2222-2222-2222-222222222222', 'authenticated',
  format($q$select cambia_voce_movimenti(array[%L::uuid, %L::uuid], %L::uuid, %L::uuid)$q$, id_mov('A mano donazione'), id_mov('A mano donazione due'), id_voce('Corsi e altri pagamenti', 'entrata'), 'eeeeeeee-0000-0000-0000-000000000001')),
  '22023 ' || :'una_riga');
select atteso('uno a mano e uno dello storico insieme: no, la regola vale per il primo', come('22222222-2222-2222-2222-222222222222', 'authenticated',
  format($q$select cambia_voce_movimenti(array[%L::uuid, %L::uuid], %L::uuid, %L::uuid)$q$, id_mov('A mano donazione'), id_mov('BONIFICO GENERICO'), id_voce('Quota associativa', 'entrata'), 'eeeeeeee-0000-0000-0000-000000000001')),
  '22023 ' || :'una_riga');
select atteso('uno a mano senza persona (due argomenti): scegli la persona', come('22222222-2222-2222-2222-222222222222', 'authenticated',
  format($q$select cambia_voce_movimenti(array[%L::uuid], %L::uuid)$q$, id_mov('A mano donazione'), id_voce('Quota associativa', 'entrata'))), '22023 Scegli la persona');
select atteso('uno a mano con la persona vuota (tre argomenti): scegli la persona', come('22222222-2222-2222-2222-222222222222', 'authenticated',
  format($q$select cambia_voce_movimenti(array[%L::uuid], %L::uuid, null::uuid)$q$, id_mov('A mano donazione'), id_voce('Corsi e altri pagamenti', 'entrata'))), '22023 Scegli la persona');
select atteso('uno a mano con una persona che non c''è: scegli la persona', come('22222222-2222-2222-2222-222222222222', 'authenticated',
  format($q$select cambia_voce_movimenti(array[%L::uuid], %L::uuid, %L::uuid)$q$, id_mov('A mano donazione'), id_voce('Quota associativa', 'entrata'), 'eeeeeeee-9999-0000-0000-000000000000')), '22023 Scegli la persona');
select atteso('un annullato resta annullato anche con la persona', come('22222222-2222-2222-2222-222222222222', 'authenticated',
  format($q$select cambia_voce_movimenti(array[%L::uuid], %L::uuid, %L::uuid)$q$, id_mov('A mano quota da annullare'), id_voce('Corsi e altri pagamenti', 'entrata'), 'eeeeeeee-0000-0000-0000-000000000001')),
  '22023 Il movimento del 06/09/2026 (A mano quota da annullare) è annullato: non si cambia');
select atteso('niente è cambiato, né traccia', impronta(), :'prima');

select senza_persona('A mano donazione') as s_don \gset
select tracce_cambi()::int as tc \gset
select tracce_coll()::int as tl \gset
select atteso('uno a mano con la persona: la voce cambia', come('22222222-2222-2222-2222-222222222222', 'authenticated',
  format($q$select cambia_voce_movimenti(array[%L::uuid], %L::uuid, %L::uuid)$q$, id_mov('A mano donazione'), id_voce('Quota associativa', 'entrata'), 'eeeeeeee-0000-0000-0000-000000000001')), 'ok');
select atteso('…è su Quota, di Giulia', voce_di('A mano donazione') || ' ' || persona_di('A mano donazione'), 'Quota associativa Verdi');
select atteso('…importo, data, cassa e testo come prima', senza_persona('A mano donazione'), :'s_don');
select atteso('…una riga di cambio voce (Donazioni → Quota associativa)', (select count(*)::text || ' ' || v1.nome || ' → ' || v2.nome from cambi_voce c join voci_contabili v1 on v1.id = c.voce_prima_id
  join voci_contabili v2 on v2.id = c.voce_dopo_id where c.movimento_id = id_mov('A mano donazione') group by v1.nome, v2.nome), '1 Donazioni → Quota associativa');
select atteso('…e una riga di collegamento, nessun lotto, da nessuno a Giulia', (select count(*)::text || ' ' || coalesce(c.persona_prima_id::text, '—') || ' ' || p.cognome || ' ' || coalesce(c.lotto::text, '—')
  from collegamenti_persona c join persone p on p.id = c.persona_dopo_id where c.movimento_id = id_mov('A mano donazione') group by c.persona_prima_id, p.cognome, c.lotto), '1 — Verdi —');
select atteso('…in tutto una traccia di voce e una di collegamento in più', (tracce_cambi()::int - :tc) || ' ' || (tracce_coll()::int - :tl), '1 1');

select atteso('lo storico in blocco verso Quota, senza persona: come oggi', come('22222222-2222-2222-2222-222222222222', 'authenticated',
  format($q$select cambia_voce_movimenti(array[%L::uuid, %L::uuid], %L::uuid)::text$q$, id_mov('BONIFICO GENERICO'), id_mov('BONIFICO GENERICO DUE'), id_voce('Quota associativa', 'entrata'))), 'ok');
select atteso('…voce cambiata, nessuna persona', voce_di('BONIFICO GENERICO') || ' ' || persona_di('BONIFICO GENERICO') || ' / ' || voce_di('BONIFICO GENERICO DUE') || ' ' || persona_di('BONIFICO GENERICO DUE'),
  'Quota associativa — / Quota associativa —');
select atteso('…e nessun collegamento scritto', (tracce_coll()::int - :tl)::text, '1');
select atteso('movimenti già sulla voce di arrivo: gia_cosi, la regola non scatta, la persona non serve', come_json('22222222-2222-2222-2222-222222222222', 'authenticated',
  format($q$select cambia_voce_movimenti(array[%L::uuid, %L::uuid], %L::uuid)::text$q$, id_mov('A mano quota vecchia'), id_mov('R quota Giulia'), id_voce('Quota associativa', 'entrata'))), '{"cambiati": 0, "gia_cosi": 2}');
select atteso('altre voci in blocco, a mano compresi: come oggi', come_json('22222222-2222-2222-2222-222222222222', 'authenticated',
  format($q$select cambia_voce_movimenti(array[%L::uuid, %L::uuid], %L::uuid)::text$q$, id_mov('A mano quota vecchia'), id_mov('BONIFICO GENERICO'), id_voce('Donazioni', 'entrata'))), '{"cambiati": 2, "gia_cosi": 0}');
select atteso('…la persona di chi era già collegato non si perde', persona_di('R quota Giulia') || ' ' || persona_di('A mano quota vecchia'), 'Verdi —');
select atteso('la segreteria non cambia la voce', come('11111111-1111-1111-1111-111111111111', 'authenticated',
  format($q$select cambia_voce_movimenti(array[%L::uuid], %L::uuid, %L::uuid)$q$, id_mov('A mano donazione due'), id_voce('Quota associativa', 'entrata'), 'eeeeeeee-0000-0000-0000-000000000001')), '42501 la contabilità la cura l’amministrazione');
select atteso('…l''istruttore nemmeno', come('55555555-5555-5555-5555-555555555555', 'authenticated',
  format($q$select cambia_voce_movimenti(array[%L::uuid], %L::uuid, %L::uuid)$q$, id_mov('A mano donazione due'), id_voce('Quota associativa', 'entrata'), 'eeeeeeee-0000-0000-0000-000000000001')), '42501 la contabilità la cura l’amministrazione');
select atteso('…il tablet nemmeno', come('99999999-9999-9999-9999-999999999999', 'authenticated',
  format($q$select cambia_voce_movimenti(array[%L::uuid], %L::uuid, %L::uuid)$q$, id_mov('A mano donazione due'), id_voce('Quota associativa', 'entrata'), 'eeeeeeee-0000-0000-0000-000000000001')), '42501 la contabilità la cura l’amministrazione');
select atteso('…chi non ha fatto l''accesso non ha il permesso di chiamarla', come('00000000-0000-0000-0000-000000000000', 'anon',
  format($q$select cambia_voce_movimenti(array[%L::uuid], %L::uuid, %L::uuid)$q$, id_mov('A mano donazione due'), id_voce('Quota associativa', 'entrata'), 'eeeeeeee-0000-0000-0000-000000000001')), '42501 permission denied for function cambia_voce_movimenti');
select atteso('la segreteria con anche_amministrazione sì', come('33333333-3333-3333-3333-333333333333', 'authenticated',
  format($q$select cambia_voce_movimenti(array[%L::uuid], %L::uuid, %L::uuid)$q$, id_mov('A mano donazione due'), id_voce('Corsi e altri pagamenti', 'entrata'), 'eeeeeeee-0000-0000-0000-000000000002')), 'ok');
select atteso('…e la persona è quella scelta', voce_di('A mano donazione due') || ' ' || persona_di('A mano donazione due'), 'Corsi e altri pagamenti Neri');

\echo ''
\echo '--- 5. la scheda: lo storico dice quali movimenti sono scritti a mano ---'
select atteso('Giulia: dello storico a_mano falso, scritti in contabilità vero (annullati e altre persone fuori)', come_json('11111111-1111-1111-1111-111111111111', 'authenticated',
  format($q$select string_agg(descrizione || ':' || a_mano::text, ', ' order by descrizione collate "C") from storico_persona(%L::uuid)$q$, 'eeeeeeee-0000-0000-0000-000000000001')),
  'A mano donazione:true, Cliente Giulia Verdi per corso storico:false, Cliente Giulia Verdi per quota:false, R quota Giulia:true');
select atteso('l''amministrazione lo legge', come_json('22222222-2222-2222-2222-222222222222', 'authenticated',
  format($q$select count(*)::text from storico_persona(%L::uuid)$q$, 'eeeeeeee-0000-0000-0000-000000000002')), '2');
select atteso('l''istruttore no', come('55555555-5555-5555-5555-555555555555', 'authenticated',
  format($q$select * from storico_persona(%L::uuid)$q$, 'eeeeeeee-0000-0000-0000-000000000001')), '42501 lo storico lo vedono segreteria e amministrazione');
select atteso('il tablet no', come('99999999-9999-9999-9999-999999999999', 'authenticated',
  format($q$select * from storico_persona(%L::uuid)$q$, 'eeeeeeee-0000-0000-0000-000000000001')), '42501 lo storico lo vedono segreteria e amministrazione');
select atteso('chi non ha fatto l''accesso non lo chiama', come('00000000-0000-0000-0000-000000000000', 'anon',
  format($q$select * from storico_persona(%L::uuid)$q$, 'eeeeeeee-0000-0000-0000-000000000001')), '42501 permission denied for function storico_persona');
select atteso('permessi di registra_movimento e storico_persona: authenticated sì, anon no', (select string_agg(p.proname || ':' || r || ':' || has_function_privilege(r, p.oid, 'execute')::text, ', ' order by p.proname, r)
  from pg_proc p, unnest(array['anon', 'authenticated']) r where p.pronamespace = 'public'::regnamespace and p.proname in ('registra_movimento', 'storico_persona')),
  'registra_movimento:anon:false, registra_movimento:authenticated:true, storico_persona:anon:false, storico_persona:authenticated:true');
select atteso('la quota scritta a mano non cambia i saldi: le entrate sono la somma degli importi, una volta sola', (select sum(importo)::text from movimenti where descrizione in ('R quota Giulia', 'R corsi Marco')), '13500');

\echo ''
\echo 'Tutto a posto: quote e corsi scritti a mano hanno la persona.'
