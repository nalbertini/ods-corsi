-- La contabilità, prima parte (59-contabilita.sql): le voci, le due casse
-- (Cassa Contanti e Conto Corrente) e i movimenti fatti a mano. Li vede e li
-- scrive solo `e_amministrazione()`: l'amministrazione, e la segreteria che ha
-- anche quel ruolo. Le altre persone non vedono niente, e nessuno scrive sulle
-- tabelle: si passa dalle funzioni. Gli incassi degli iscritti non sono qui:
-- l'app li ricava da ricevute e pagamenti (src/lib/contabilita.ts).
-- Le stesse regole di src/lib/contabilita.ts e della modalità prova, provate da
-- scripts/prova-contabilita.mjs e scripts/prova-segreteria.mjs.
-- Si lancia dopo finto-supabase.sql e i file dello schema, su un database suo.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

select (to_regclass('public.movimenti') is not null and to_regclass('public.casse') is not null and to_regclass('public.voci_contabili') is not null)::text as c \gset
create or replace function atteso(cosa text, avuto text, voluto text) returns text language plpgsql as $$
begin
  if avuto is distinct from voluto and not (voluto like '%…' and avuto like replace(voluto, '…', '%')) then
    raise exception '% · atteso «%», avuto «%»', cosa, voluto, avuto;
  end if;
  return 'ok  ' || cosa || ' → ' || avuto;
end $$;
select atteso('59-contabilita.sql è stato lanciato: ci sono le tre tabelle', :'c', 'true');

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'ada@ods.it'),
  ('33333333-3333-3333-3333-333333333333', 'sandro@ods.it'),
  ('44444444-4444-4444-4444-444444444444', 'ivo@ods.it'),
  ('55555555-5555-5555-5555-555555555555', 'maura@ods.it'),
  ('66666666-6666-6666-6666-666666666666', 'senza@ods.it'),
  ('77777777-7777-7777-7777-777777777777', 'luca@ods.it'),
  ('99999999-9999-9999-9999-999999999999', 'tablet@ods.it');
-- Anna: solo segreteria. Ada: solo amministrazione. Sandro: segreteria e
-- amministrazione. Ivo: amministrazione e istruttore. Maura: istruttore.
-- Luca: iscritto. «senza» ha un accesso ma nessuna scheda.
insert into persone (id, nome, cognome, ruolo, anche_istruttore, anche_amministrazione, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', false, false, 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Ada', 'Conti', 'amministrazione', false, false, 'ada@ods.it', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Sandro', 'Doppio', 'staff', false, true, 'sandro@ods.it', '33333333-3333-3333-3333-333333333333'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'Ivo', 'Conti', 'amministrazione', true, false, 'ivo@ods.it', '44444444-4444-4444-4444-444444444444'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'Maura', 'Uno', 'istruttore', false, false, 'maura@ods.it', '55555555-5555-5555-5555-555555555555'),
  ('aaaaaaaa-0000-0000-0000-000000000007', 'Luca', 'Rossi', 'iscritto', false, false, 'luca@ods.it', '77777777-7777-7777-7777-777777777777');
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
-- Un movimento in jsonb, con voce e cassa cercate per nome (la voce del tipo giusto).
create or replace function mov(t text, g text, i int, v text, c text, d text) returns jsonb
  language sql stable security definer set search_path = public as $$
  select jsonb_build_object('tipo', t, 'data', g, 'importo', i,
    'voce_id', (select vc.id from voci_contabili vc where vc.nome = v and vc.tipo::text = t),
    'cassa_id', (select ca.id from casse ca where ca.nome = c),
    'descrizione', d)
$$;
create or replace function id_cassa(n text) returns uuid language sql stable security definer set search_path = public as $$
  select id from casse where nome = n $$;
create or replace function id_voce(n text, t text) returns uuid language sql stable security definer set search_path = public as $$
  select id from voci_contabili where nome = n and tipo::text = t $$;
create or replace function id_mov(d text) returns uuid language sql stable security definer set search_path = public as $$
  select id from movimenti where descrizione = d $$;
-- Quante righe vede chi chiama: voci / casse / movimenti.
create or replace function visto() returns text language sql stable as $$
  select (select count(*) from voci_contabili) || '/' || (select count(*) from casse) || '/' || (select count(*) from movimenti) $$;
-- Tutto il contenuto, per accorgersi di una riga che cambia.
create or replace function impronta() returns text language sql stable security definer set search_path = public as $$
  select md5(coalesce((select string_agg(v::text, '|' order by v.id) from voci_contabili v), '')
          || coalesce((select string_agg(c::text, '|' order by c.id) from casse c), '')
          || coalesce((select string_agg(m::text, '|' order by m.id) from movimenti m), '')) $$;

-- Le prove "da un ruolo" cambiano ruolo e utente dentro la funzione e li rimettono.
create or replace function da_visto(utente text, ruolo text) returns text language plpgsql as $$
declare r text;
begin
  perform set_config('prova.utente', utente, false);
  execute format('set role %I', ruolo);
  r := tenta('select visto()');
  reset role;
  return r;
end $$;
-- Nove tentativi di scrivere dritto sulle tabelle (insert, update, delete su tre):
-- quanti finiscono con «permission denied», che è il permesso tolto e non una riga che manca.
create or replace function da_scritture(utente text, ruolo text) returns text language plpgsql as $$
declare t text; c text; r text; negati int := 0;
begin
  perform set_config('prova.utente', utente, false);
  execute format('set role %I', ruolo);
  foreach t in array array['voci_contabili', 'casse', 'movimenti'] loop
    c := case when t = 'movimenti' then 'descrizione' else 'nome' end;
    foreach r in array array[
      format('insert into %I (%I) values (%L)', t, c, 'X'),
      format('update %I set %I = %L', t, c, 'Y'),
      format('delete from %I', t)] loop
      if tenta(r) = 'NEGATO: permission denied for table ' || t then negati := negati + 1; end if;
    end loop;
  end loop;
  reset role;
  return negati || '/9';
end $$;
-- Le otto funzioni chiamate con dati che non servono a niente: chi non può deve
-- sentirsi dire di no prima di ogni altro controllo. Esce «guardia / permesso
-- tolto / altro»: la guardia della funzione, il grant tolto (anon), tutto il resto.
create or replace function da_chiamate(utente text, ruolo text) returns text language plpgsql as $$
declare s text; e text; guardia int := 0; permesso int := 0; altro int := 0;
begin
  perform set_config('prova.utente', utente, false);
  execute format('set role %I', ruolo);
  foreach s in array array[
    $q$select salva_voce('{}'::jsonb)$q$,
    $q$select rinomina_voce('00000000-0000-0000-0000-000000000000'::uuid, 'X')$q$,
    $q$select imposta_voce_attiva('00000000-0000-0000-0000-000000000000'::uuid, false)$q$,
    $q$select imposta_saldo_cassa('00000000-0000-0000-0000-000000000000'::uuid, 0, null::date)$q$,
    $q$select registra_movimento('{}'::jsonb)$q$,
    $q$select registra_giroconto('{}'::jsonb)$q$,
    $q$select annulla_movimento('00000000-0000-0000-0000-000000000000'::uuid)$q$,
    $q$select correggi_testo_movimento('00000000-0000-0000-0000-000000000000'::uuid, 'X', null)$q$
  ] loop
    e := esito(s);
    if e = '42501 la contabilità la cura l’amministrazione' then guardia := guardia + 1;
    elsif e like '42501 permission denied for function %' then permesso := permesso + 1;
    else altro := altro + 1; end if;
  end loop;
  reset role;
  return guardia || '/' || permesso || '/' || altro;
end $$;
grant execute on function atteso(text, text, text), chi(text), tenta(text), esito(text), mov(text, text, int, text, text, text),
  id_cassa(text), id_voce(text, text), id_mov(text), visto(), impronta() to anon, authenticated;

\echo ''
\echo '--- 1. le due casse e le due voci di sistema ci sono già ---'
select atteso('le casse', (select string_agg(nome || ' ' || saldo_iniziale || ' ' || coalesce(dal::text, '—'), ', ' order by nome) from casse), 'Cassa Contanti 0 —, Conto Corrente 0 —, Satispay 0 2025-01-01');
-- Le voci «Differenza di cassa» arrivano con 60-chiusura-cassa.sql e le prova chiusura-cassa.sql: qui si contano quelle del 59.
select atteso('le voci di sistema', (select string_agg(nome || ' ' || tipo || ' ' || di_sistema || ' ' || attiva, ', ' order by nome) from voci_contabili where nome not in ('Differenza di cassa', 'Compensi istruttori', 'Da classificare', 'Commissioni bancarie')), 'Corsi e altri pagamenti entrata true true, Quota associativa entrata true true');
select atteso('nessun movimento', (select count(*)::text from movimenti), '0');
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('la quota associativa non si rinomina', esito(format('select rinomina_voce(id => %L, nome => %L)', id_voce('Quota associativa', 'entrata'), 'Tessera')), '22023 Le voci di sistema non si cambiano');
select atteso('«Corsi e altri pagamenti» non si rinomina', esito(format('select rinomina_voce(id => %L, nome => %L)', id_voce('Corsi e altri pagamenti', 'entrata'), 'Corsi')), '22023 Le voci di sistema non si cambiano');
select atteso('la quota associativa non si disattiva', esito(format('select imposta_voce_attiva(id => %L, attiva => false)', id_voce('Quota associativa', 'entrata'))), '22023 Le voci di sistema non si cambiano');
select atteso('«Corsi e altri pagamenti» non si disattiva', esito(format('select imposta_voce_attiva(id => %L, attiva => false)', id_voce('Corsi e altri pagamenti', 'entrata'))), '22023 Le voci di sistema non si cambiano');
select atteso('un doppione della quota associativa no', esito($$select salva_voce('{"nome": "QUOTA ASSOCIATIVA", "tipo": "entrata"}')$$), '22023 C’è già una voce «QUOTA ASSOCIATIVA» tra le entrate');
select atteso('né di «Corsi e altri pagamenti», con spazi', esito($$select salva_voce('{"nome": "  corsi e altri pagamenti ", "tipo": "entrata"}')$$), '22023 C’è già una voce «corsi e altri pagamenti» tra le entrate');
reset role;
select atteso('le voci di sistema sono rimaste com''erano', (select string_agg(nome || ' ' || attiva, ', ' order by nome) from voci_contabili where nome not in ('Differenza di cassa', 'Compensi istruttori', 'Da classificare', 'Commissioni bancarie')), 'Corsi e altri pagamenti true, Quota associativa true');

\echo ''
\echo '--- 2. le voci: il nome è unico per tipo, una voce si disattiva e non si butta ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('si crea una voce di uscita', esito($$select salva_voce(jsonb_build_object('nome', 'Affitto sala', 'tipo', 'uscita'))$$), 'ok');
select atteso('…di uscita, attiva e non di sistema', (select tipo || ' ' || attiva || ' ' || di_sistema from voci_contabili where nome = 'Affitto sala'), 'uscita true false');
select atteso('si crea una voce di entrata', esito($$select salva_voce('{"nome": "Donazioni", "tipo": "entrata"}')$$), 'ok');
select atteso('il nome si ripulisce dagli spazi', esito($$select salva_voce('{"nome": "  Biglietti  ", "tipo": "entrata"}')$$), 'ok');
select atteso('…e resta «Biglietti»', (select count(*)::text from voci_contabili where nome = 'Biglietti'), '1');
select atteso('«affitto sala» c''è già, senza badare alle maiuscole', esito($$select salva_voce('{"nome": "affitto sala", "tipo": "uscita"}')$$), '22023 C’è già una voce «affitto sala» tra le uscite');
select atteso('«Affitto sala » c''è già, senza badare agli spazi', esito($$select salva_voce('{"nome": "Affitto sala ", "tipo": "uscita"}')$$), '22023 C’è già una voce «Affitto sala» tra le uscite');
select atteso('lo stesso nome fra le entrate va bene', esito($$select salva_voce('{"nome": "Rimborsi", "tipo": "entrata"}')$$), 'ok');
select atteso('…e fra le uscite pure', esito($$select salva_voce('{"nome": "Rimborsi", "tipo": "uscita"}')$$), 'ok');
select atteso('…ma non due volte fra le entrate', esito($$select salva_voce('{"nome": "RIMBORSI", "tipo": "entrata"}')$$), '22023 C’è già una voce «RIMBORSI» tra le entrate');
select atteso('il nome vuoto no', esito($$select salva_voce('{"nome": "", "tipo": "entrata"}')$$), '22023 Scrivi il nome della voce');
select atteso('il nome di soli spazi no', esito($$select salva_voce('{"nome": "   ", "tipo": "entrata"}')$$), '22023 Scrivi il nome della voce');
select atteso('senza nome no', esito($$select salva_voce('{"tipo": "entrata"}')$$), '22023 Scrivi il nome della voce');
select atteso('sessanta lettere vanno', esito($$select salva_voce(jsonb_build_object('nome', repeat('x', 60), 'tipo', 'entrata'))$$), 'ok');
select atteso('sessantuna no', esito($$select salva_voce(jsonb_build_object('nome', repeat('y', 61), 'tipo', 'entrata'))$$), '22023 Il nome della voce è troppo lungo: al massimo 60 caratteri');
select atteso('il tipo giroconto non è di una voce', esito($$select salva_voce('{"nome": "Giro", "tipo": "giroconto"}')$$), '22023 Scegli se è un’entrata o un’uscita');
select atteso('senza tipo no', esito($$select salva_voce('{"nome": "Giro"}')$$), '22023 Scegli se è un’entrata o un’uscita');
select atteso('si rinomina', esito(format('select rinomina_voce(id => %L, nome => %L)', id_voce('Biglietti', 'entrata'), 'Biglietti ingresso')), 'ok');
select atteso('…e cambia il nome, non il tipo', (select tipo from voci_contabili where nome = 'Biglietti ingresso'), 'entrata');
select atteso('si può cambiare solo le maiuscole del proprio nome', esito(format('select rinomina_voce(id => %L, nome => %L)', id_voce('Biglietti ingresso', 'entrata'), 'BIGLIETTI INGRESSO')), 'ok');
select atteso('rinominare in un nome già preso no', esito(format('select rinomina_voce(id => %L, nome => %L)', id_voce('Donazioni', 'entrata'), ' rimborsi')), '22023 C’è già una voce «rimborsi» tra le entrate');
select atteso('rinominare in un nome di un altro tipo sì', esito(format('select rinomina_voce(id => %L, nome => %L)', id_voce('Donazioni', 'entrata'), 'Affitto sala')), 'ok');
select atteso('rinominare in vuoto no', esito(format('select rinomina_voce(id => %L, nome => %L)', id_voce('Affitto sala', 'entrata'), ' ')), '22023 Scrivi il nome della voce');
select atteso('rinominare in un nome lungo no', esito(format('select rinomina_voce(id => %L, nome => %L)', id_voce('Affitto sala', 'entrata'), repeat('z', 61))), '22023 Il nome della voce è troppo lungo: al massimo 60 caratteri');
select atteso('una voce che non c''è', esito($$select rinomina_voce(id => '00000000-0000-0000-0000-000000000000', nome => 'X')$$), 'P0002 La voce non c’è');
select atteso('né si disattiva', esito($$select imposta_voce_attiva(id => '00000000-0000-0000-0000-000000000000', attiva => false)$$), 'P0002 La voce non c’è');
-- Torna com'era: «Donazioni» è la voce di entrata che serve ai movimenti.
select atteso('«Donazioni» torna com''era', esito(format('select rinomina_voce(id => %L, nome => %L)', id_voce('Affitto sala', 'entrata'), 'Donazioni')), 'ok');
reset role;
select atteso('le voci create', (select string_agg(nome || ' ' || tipo, ', ' order by tipo, nome collate "C") from voci_contabili where not di_sistema and length(nome) < 30 and nome not in ('Da classificare', 'Commissioni bancarie')),
  'BIGLIETTI INGRESSO entrata, Donazioni entrata, Rimborsi entrata, Affitto sala uscita, Rimborsi uscita');

\echo ''
\echo '--- 3. il saldo iniziale è un campo della cassa, con la data da cui si conta ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('si imposta il saldo di Cassa Contanti', esito(format('select imposta_saldo_cassa(id => %L, saldo => 10000, dal => %L)', id_cassa('Cassa Contanti'), '2026-09-01')), 'ok');
select atteso('…importo e data', (select saldo_iniziale || ' ' || dal from casse where nome = 'Cassa Contanti'), '10000 2026-09-01');
select atteso('la data può mancare: allora si conta tutto', esito(format('select imposta_saldo_cassa(id => %L, saldo => 0, dal => null)', id_cassa('Conto Corrente'))), 'ok');
select atteso('…e resta vuota', (select saldo_iniziale || ' ' || coalesce(dal::text, '—') from casse where nome = 'Conto Corrente'), '0 —');
select atteso('un saldo negativo no', esito(format('select imposta_saldo_cassa(id => %L, saldo => -100, dal => %L)', id_cassa('Cassa Contanti'), '2026-09-01')), '22023 Il saldo iniziale non può essere negativo');
select atteso('una cassa che non c''è', esito($$select imposta_saldo_cassa(id => '00000000-0000-0000-0000-000000000000', saldo => 0, dal => null)$$), 'P0002 La cassa non c’è');
select atteso('il saldo rifiutato non ha cambiato niente', (select saldo_iniziale || ' ' || dal from casse where nome = 'Cassa Contanti'), '10000 2026-09-01');
reset role;

\echo ''
\echo '--- 4. i movimenti: entrano solo se hanno senso ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('un''entrata entra', esito(format('select registra_movimento(dati => %L::jsonb)', mov('entrata', '2026-09-10', 4000, 'Donazioni', 'Cassa Contanti', 'Offerta di Rossi'))), 'ok');
select atteso('…come è stata scritta', (select tipo || ' ' || data || ' ' || importo || ' ' || descrizione || ' ' || (voce_id = id_voce('Donazioni', 'entrata'))::text || ' ' || (cassa_id = id_cassa('Cassa Contanti'))::text || ' ' || (cassa_a_id is null)::text || ' ' || (annullato_il is null)::text from movimenti where descrizione = 'Offerta di Rossi'),
  'entrata 2026-09-10 4000 Offerta di Rossi true true true true');
select atteso('…e chi l''ha fatto lo mette il server', (select p.nome from movimenti m join persone p on p.id = m.creato_da where m.descrizione = 'Offerta di Rossi'), 'Ada');
select atteso('una uscita con la nota entra', esito(format('select registra_movimento(dati => %L::jsonb)', mov('uscita', '2026-09-12', 2500, 'Affitto sala', 'Cassa Contanti', 'Affitto sala di settembre') || '{"nota": "Pagato a mano"}')), 'ok');
select atteso('…con la nota', (select nota from movimenti where descrizione = 'Affitto sala di settembre'), 'Pagato a mano');
select atteso('il primo giorno della cassa va', esito(format('select registra_movimento(dati => %L::jsonb)', mov('entrata', '2026-09-01', 1000, 'Donazioni', 'Cassa Contanti', 'Primo giorno'))), 'ok');
select atteso('sul conto, che non ha una data d''inizio, anche prima di settembre', esito(format('select registra_movimento(dati => %L::jsonb)', mov('uscita', '2026-08-31', 700, 'Affitto sala', 'Conto Corrente', 'Commissioni di agosto'))), 'ok');
select atteso('chi il movimento ha detto di aver fatto non conta', esito(format('select registra_movimento(dati => %L::jsonb)', mov('entrata', '2026-09-11', 300, 'Donazioni', 'Conto Corrente', 'Offerta anonima') || '{"creato_da": "aaaaaaaa-0000-0000-0000-000000000001"}')), 'ok');
select atteso('…resta Ada', (select p.nome from movimenti m join persone p on p.id = m.creato_da where m.descrizione = 'Offerta anonima'), 'Ada');
-- I rifiuti.
select atteso('importo zero', esito(format('select registra_movimento(dati => %L::jsonb)', mov('entrata', '2026-09-10', 0, 'Donazioni', 'Cassa Contanti', 'Zero'))), '22023 L’importo deve essere più di zero');
select atteso('importo negativo', esito(format('select registra_movimento(dati => %L::jsonb)', mov('entrata', '2026-09-10', -500, 'Donazioni', 'Cassa Contanti', 'Meno'))), '22023 L’importo deve essere più di zero');
select atteso('importo con la virgola', esito(format('select registra_movimento(dati => %L::jsonb)', mov('entrata', '2026-09-10', 1, 'Donazioni', 'Cassa Contanti', 'Virgola') || '{"importo": 12.5}')), '22023 L’importo non si capisce');
select atteso('importo scritto a parole', esito(format('select registra_movimento(dati => %L::jsonb)', mov('entrata', '2026-09-10', 1, 'Donazioni', 'Cassa Contanti', 'Parole') || '{"importo": "tanto"}')), '22023 L’importo non si capisce');
select atteso('importo oltre i centomila euro', esito(format('select registra_movimento(dati => %L::jsonb)', mov('entrata', '2026-09-10', 10000001, 'Donazioni', 'Cassa Contanti', 'Troppo'))), '22023 L’importo è troppo alto: controlla le cifre');
select atteso('il 30 febbraio', esito(format('select registra_movimento(dati => %L::jsonb)', mov('entrata', '2026-02-30', 100, 'Donazioni', 'Conto Corrente', 'Febbraio'))), '22023 La data non si capisce');
select atteso('senza data', esito(format('select registra_movimento(dati => %L::jsonb)', mov('entrata', null, 100, 'Donazioni', 'Conto Corrente', 'Senza data'))), '22023 La data non si capisce');
select atteso('domani', esito(format('select registra_movimento(dati => %L::jsonb)', mov('entrata', (current_date + 1)::text, 100, 'Donazioni', 'Conto Corrente', 'Domani'))), '22023 La data è nel futuro: si registra quel che è già successo');
select atteso('oggi sì', esito(format('select registra_movimento(dati => %L::jsonb)', mov('entrata', current_date::text, 100, 'Donazioni', 'Conto Corrente', 'Oggi'))), 'ok');
select atteso('un''entrata con la voce di un''uscita', esito(format('select registra_movimento(dati => %L::jsonb)', mov('entrata', '2026-09-10', 100, 'Donazioni', 'Conto Corrente', 'Voce sbagliata') || jsonb_build_object('voce_id', id_voce('Affitto sala', 'uscita')))), '22023 La voce scelta non va con questo tipo di movimento');
select atteso('una uscita con la voce di un''entrata', esito(format('select registra_movimento(dati => %L::jsonb)', mov('uscita', '2026-09-10', 100, 'Affitto sala', 'Conto Corrente', 'Voce sbagliata') || jsonb_build_object('voce_id', id_voce('Donazioni', 'entrata')))), '22023 La voce scelta non va con questo tipo di movimento');
select atteso('senza voce', esito(format('select registra_movimento(dati => %L::jsonb)', mov('entrata', '2026-09-10', 100, 'Non c''è', 'Conto Corrente', 'Senza voce'))), '22023 Scegli la voce');
select atteso('con una voce che non c''è', esito(format('select registra_movimento(dati => %L::jsonb)', mov('entrata', '2026-09-10', 100, 'Donazioni', 'Conto Corrente', 'Voce fantasma') || '{"voce_id": "00000000-0000-0000-0000-000000000000"}')), '22023 Scegli la voce');
select atteso('descrizione vuota', esito(format('select registra_movimento(dati => %L::jsonb)', mov('entrata', '2026-09-10', 100, 'Donazioni', 'Conto Corrente', '   '))), '22023 Scrivi una descrizione');
select atteso('senza descrizione', esito(format('select registra_movimento(dati => %L::jsonb)', mov('entrata', '2026-09-10', 100, 'Donazioni', 'Conto Corrente', null))), '22023 Scrivi una descrizione');
select atteso('descrizione di 201 lettere', esito(format('select registra_movimento(dati => %L::jsonb)', mov('entrata', '2026-09-10', 100, 'Donazioni', 'Conto Corrente', repeat('d', 201)))), '22023 La descrizione è troppo lunga: al massimo 200 caratteri');
select atteso('nota di 301 lettere', esito(format('select registra_movimento(dati => %L::jsonb)', mov('entrata', '2026-09-10', 100, 'Donazioni', 'Conto Corrente', 'Nota lunga') || jsonb_build_object('nota', repeat('n', 301)))), '22023 La nota è troppo lunga: al massimo 300 caratteri');
select atteso('cassa che non c''è', esito(format('select registra_movimento(dati => %L::jsonb)', mov('entrata', '2026-09-10', 100, 'Donazioni', 'Conto Corrente', 'Cassa fantasma') || '{"cassa_id": "00000000-0000-0000-0000-000000000000"}')), '22023 Scegli la cassa');
select atteso('senza cassa', esito(format('select registra_movimento(dati => %L::jsonb)', mov('entrata', '2026-09-10', 100, 'Donazioni', 'Non c''è', 'Senza cassa'))), '22023 Scegli la cassa');
select atteso('il 31 agosto sulla cassa che comincia il 1 settembre', esito(format('select registra_movimento(dati => %L::jsonb)', mov('entrata', '2026-08-31', 100, 'Donazioni', 'Cassa Contanti', 'Troppo presto'))), '22023 La data è prima dell’inizio della cassa');
select atteso('il giroconto non passa da qui', esito(format('select registra_movimento(dati => %L::jsonb)', mov('giroconto', '2026-09-10', 100, 'Donazioni', 'Conto Corrente', 'Giro'))), '22023 Scegli se è un’entrata o un’uscita');
select atteso('un tipo che non c''è', esito(format('select registra_movimento(dati => %L::jsonb)', mov('prestito', '2026-09-10', 100, 'Donazioni', 'Conto Corrente', 'Prestito'))), '22023 Scegli se è un’entrata o un’uscita');
reset role;
select atteso('dei rifiuti non è entrato niente', (select string_agg(descrizione, ', ' order by descrizione collate "C") from movimenti),
  'Affitto sala di settembre, Commissioni di agosto, Offerta anonima, Offerta di Rossi, Oggi, Primo giorno');

-- Una voce disattivata non si offre ai movimenti nuovi, e resta sui vecchi.
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('si disattiva una voce usata', esito(format('select imposta_voce_attiva(id => %L, attiva => false)', id_voce('Affitto sala', 'uscita'))), 'ok');
select atteso('…e risulta spenta', (select attiva::text from voci_contabili where id = id_voce('Affitto sala', 'uscita')), 'false');
select atteso('con quella voce non si registra più', esito(format('select registra_movimento(dati => %L::jsonb)', mov('uscita', '2026-09-20', 100, 'Affitto sala', 'Conto Corrente', 'Affitto di ottobre'))), '22023 La voce non è più in uso: scegline un’altra');
select atteso('i movimenti vecchi ce l''hanno ancora', (select count(*)::text from movimenti where voce_id = id_voce('Affitto sala', 'uscita')), '2');
select atteso('la voce si può riattivare', esito(format('select imposta_voce_attiva(id => %L, attiva => true)', id_voce('Affitto sala', 'uscita'))), 'ok');
select atteso('…e allora si usa di nuovo', esito(format('select registra_movimento(dati => %L::jsonb)', mov('uscita', '2026-09-20', 600, 'Affitto sala', 'Conto Corrente', 'Affitto di ottobre'))), 'ok');
reset role;
-- Una voce usata non si cancella nemmeno a mano: si disattiva.
select atteso('una voce usata non si cancella', esito($$delete from voci_contabili where nome = 'Affitto sala' and tipo = 'uscita'$$), '23503 …');
select atteso('una cassa con movimenti nemmeno', esito($$delete from casse where nome = 'Cassa Contanti'$$), '23503 …');

\echo ''
\echo '--- 5. il giroconto sposta denaro fra le due casse ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('un giroconto entra, senza voce', esito(format('select registra_giroconto(dati => %L::jsonb)',
  jsonb_build_object('da', id_cassa('Cassa Contanti'), 'a', id_cassa('Conto Corrente'), 'data', '2026-09-15', 'importo', 1000, 'nota', 'Versamento in banca'))), 'ok');
select atteso('…come è stato scritto', (select tipo || ' ' || data || ' ' || importo || ' ' || coalesce(voce_id::text, 'senza voce') || ' ' || (cassa_id = id_cassa('Cassa Contanti'))::text || ' ' || (cassa_a_id = id_cassa('Conto Corrente'))::text || ' ' || nota from movimenti where tipo = 'giroconto'),
  'giroconto 2026-09-15 1000 senza voce true true Versamento in banca');
select atteso('…con una descrizione che dice fra quali casse', (select descrizione from movimenti where tipo = 'giroconto'), 'Giroconto da Cassa Contanti a Conto Corrente');
select atteso('…e chi l''ha fatto lo mette il server', (select p.nome from movimenti m join persone p on p.id = m.creato_da where m.tipo = 'giroconto'), 'Ada');
select atteso('dalla stessa cassa alla stessa no', esito(format('select registra_giroconto(dati => %L::jsonb)',
  jsonb_build_object('da', id_cassa('Conto Corrente'), 'a', id_cassa('Conto Corrente'), 'data', '2026-09-15', 'importo', 1000))), '22023 Scegli due casse diverse');
select atteso('importo zero no', esito(format('select registra_giroconto(dati => %L::jsonb)',
  jsonb_build_object('da', id_cassa('Conto Corrente'), 'a', id_cassa('Cassa Contanti'), 'data', '2026-09-15', 'importo', 0))), '22023 L’importo deve essere più di zero');
select atteso('importo troppo alto no', esito(format('select registra_giroconto(dati => %L::jsonb)',
  jsonb_build_object('da', id_cassa('Conto Corrente'), 'a', id_cassa('Cassa Contanti'), 'data', '2026-09-15', 'importo', 10000001))), '22023 L’importo è troppo alto: controlla le cifre');
select atteso('una cassa che non c''è no', esito(format('select registra_giroconto(dati => %L::jsonb)',
  jsonb_build_object('da', id_cassa('Conto Corrente'), 'a', '00000000-0000-0000-0000-000000000000', 'data', '2026-09-15', 'importo', 100))), '22023 Scegli le due casse');
select atteso('senza casse no', esito($$select registra_giroconto('{"data": "2026-09-15", "importo": 100}')$$), '22023 Scegli le due casse');
select atteso('data impossibile no', esito(format('select registra_giroconto(dati => %L::jsonb)',
  jsonb_build_object('da', id_cassa('Conto Corrente'), 'a', id_cassa('Cassa Contanti'), 'data', '2026-02-30', 'importo', 100))), '22023 La data non si capisce');
select atteso('data nel futuro no', esito(format('select registra_giroconto(dati => %L::jsonb)',
  jsonb_build_object('da', id_cassa('Conto Corrente'), 'a', id_cassa('Cassa Contanti'), 'data', (current_date + 1)::text, 'importo', 100))), '22023 La data è nel futuro: si registra quel che è già successo');
select atteso('prima dell''inizio di una delle due casse no', esito(format('select registra_giroconto(dati => %L::jsonb)',
  jsonb_build_object('da', id_cassa('Conto Corrente'), 'a', id_cassa('Cassa Contanti'), 'data', '2026-08-31', 'importo', 100))), '22023 La data è prima dell’inizio della cassa');
select atteso('nota di 301 lettere no', esito(format('select registra_giroconto(dati => %L::jsonb)',
  jsonb_build_object('da', id_cassa('Conto Corrente'), 'a', id_cassa('Cassa Contanti'), 'data', '2026-09-15', 'importo', 100, 'nota', repeat('n', 301)))), '22023 La nota è troppo lunga: al massimo 300 caratteri');
reset role;
select atteso('un solo giroconto, nient''altro', (select count(*)::text from movimenti where tipo = 'giroconto'), '1');

\echo ''
\echo '--- 6. un movimento non si cancella e non si cambia: si annulla ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('si annulla un movimento', esito(format('select annulla_movimento(id => %L)', id_mov('Offerta anonima'))), 'ok');
select atteso('…resta in tabella, annullato da Ada', (select (m.annullato_il is not null)::text || ' ' || p.nome from movimenti m join persone p on p.id = m.annullato_da where m.descrizione = 'Offerta anonima'), 'true Ada');
select atteso('…con tutto il resto com''era', (select importo || ' ' || data || ' ' || tipo from movimenti where descrizione = 'Offerta anonima'), '300 2026-09-11 entrata');
select atteso('due volte no', esito(format('select annulla_movimento(id => %L)', id_mov('Offerta anonima'))), 'P0002 Il movimento è già annullato');
select atteso('uno che non c''è no', esito($$select annulla_movimento(id => '00000000-0000-0000-0000-000000000000')$$), 'P0002 Il movimento non c’è');
select atteso('si annulla anche un giroconto', esito(format('select annulla_movimento(id => %L)', (select id from movimenti where tipo = 'giroconto'))), 'ok');
select atteso('…e resta in tabella', (select (annullato_il is not null)::text from movimenti where tipo = 'giroconto'), 'true');
select atteso('i movimenti sono ancora tutti', (select count(*)::text from movimenti), '8');

-- Descrizione e nota si correggono, il resto no.
reset role;
select (select (tipo, data, importo, voce_id, cassa_id, cassa_a_id, creato_da, creato_il, annullato_il)::text from movimenti where descrizione = 'Offerta di Rossi') as resto_prima \gset
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('si corregge il testo', esito(format('select correggi_testo_movimento(id => %L, descrizione => %L, nota => %L)', id_mov('Offerta di Rossi'), '  Offerta della famiglia Rossi ', 'Per la gara')), 'ok');
select atteso('…descrizione ripulita e nota', (select descrizione || ' · ' || nota from movimenti where id = (select id from movimenti where nota = 'Per la gara')), 'Offerta della famiglia Rossi · Per la gara');
select atteso('…e tutto il resto come prima', (select (tipo, data, importo, voce_id, cassa_id, cassa_a_id, creato_da, creato_il, annullato_il)::text from movimenti where nota = 'Per la gara'), :'resto_prima');
select atteso('la nota si toglie', esito(format('select correggi_testo_movimento(id => %L, descrizione => %L, nota => null)', (select id from movimenti where nota = 'Per la gara'), 'Offerta della famiglia Rossi')), 'ok');
select atteso('…e non c''è più', (select coalesce(nota, 'niente') from movimenti where descrizione = 'Offerta della famiglia Rossi'), 'niente');
select atteso('descrizione vuota no', esito(format('select correggi_testo_movimento(id => %L, descrizione => %L, nota => null)', id_mov('Offerta della famiglia Rossi'), ' ')), '22023 Scrivi una descrizione');
select atteso('descrizione di 201 lettere no', esito(format('select correggi_testo_movimento(id => %L, descrizione => %L, nota => null)', id_mov('Offerta della famiglia Rossi'), repeat('d', 201))), '22023 La descrizione è troppo lunga: al massimo 200 caratteri');
select atteso('descrizione di 200 lettere sì', esito(format('select correggi_testo_movimento(id => %L, descrizione => %L, nota => null)', id_mov('Offerta della famiglia Rossi'), repeat('d', 200))), 'ok');
select atteso('nota di 301 lettere no', esito(format('select correggi_testo_movimento(id => %L, descrizione => %L, nota => %L)', id_mov(repeat('d', 200)), 'Offerta', repeat('n', 301))), '22023 La nota è troppo lunga: al massimo 300 caratteri');
select atteso('un movimento annullato non si corregge', esito(format('select correggi_testo_movimento(id => %L, descrizione => %L, nota => null)', id_mov('Offerta anonima'), 'Cambiata')), '22023 Un movimento annullato non si corregge');
select atteso('uno che non c''è no', esito($$select correggi_testo_movimento(id => '00000000-0000-0000-0000-000000000000', descrizione => 'X', nota => null)$$), 'P0002 Il movimento non c’è');
select atteso('…e l''annullato è rimasto com''era', (select descrizione from movimenti where annullato_il is not null and tipo = 'entrata'), 'Offerta anonima');
reset role;
-- Com'era, per le prove dopo.
update movimenti set descrizione = 'Offerta di Rossi' where descrizione = repeat('d', 200);

\echo ''
\echo '--- 7. chi vede e chi scrive ---'
select impronta() as prima \gset
select (select count(*) from voci_contabili) || '/' || (select count(*) from casse) || '/' || (select count(*) from movimenti) as tutto \gset
select atteso('c''è qualcosa da vedere', (select count(*) from voci_contabili where nome not in ('Differenza di cassa', 'Compensi istruttori')) || '/' || (select count(*) from casse) || '/' || (select count(*) from movimenti), '11/3/8');
-- Vedere: l'amministrazione, anche se insegna, e la segreteria che ha anche quel ruolo.
select atteso(label || ': legge tutto', da_visto(utente, ruolo), voluto)
  from (values
    ('l''amministrazione', '22222222-2222-2222-2222-222222222222', 'authenticated', :'tutto'),
    ('segreteria e amministrazione', '33333333-3333-3333-3333-333333333333', 'authenticated', :'tutto'),
    ('amministrazione e istruttore', '44444444-4444-4444-4444-444444444444', 'authenticated', :'tutto'),
    ('la segreteria senza il ruolo', '11111111-1111-1111-1111-111111111111', 'authenticated', '0/0/0'),
    ('l''istruttore', '55555555-5555-5555-5555-555555555555', 'authenticated', '0/0/0'),
    ('l''iscritto', '77777777-7777-7777-7777-777777777777', 'authenticated', '0/0/0'),
    ('il tablet di sala', '99999999-9999-9999-9999-999999999999', 'authenticated', '0/0/0'),
    ('un accesso senza scheda', '66666666-6666-6666-6666-666666666666', 'authenticated', '0/0/0'),
    ('chi non ha l''accesso', '', 'anon', 'NEGATO: permission denied for table voci_contabili')
  ) v(label, utente, ruolo, voluto);
-- Scrivere dritto sulle tabelle: nessuno, nemmeno l'amministrazione.
select atteso(label || ': non scrive sulle tabelle', da_scritture(utente, ruolo), '9/9')
  from (values
    ('l''amministrazione', '22222222-2222-2222-2222-222222222222', 'authenticated'),
    ('segreteria e amministrazione', '33333333-3333-3333-3333-333333333333', 'authenticated'),
    ('amministrazione e istruttore', '44444444-4444-4444-4444-444444444444', 'authenticated'),
    ('la segreteria senza il ruolo', '11111111-1111-1111-1111-111111111111', 'authenticated'),
    ('l''istruttore', '55555555-5555-5555-5555-555555555555', 'authenticated'),
    ('l''iscritto', '77777777-7777-7777-7777-777777777777', 'authenticated'),
    ('il tablet di sala', '99999999-9999-9999-9999-999999999999', 'authenticated'),
    ('chi non ha l''accesso', '', 'anon')
  ) v(label, utente, ruolo);
-- Le funzioni: «guardia / permesso tolto / altro».
select atteso(label || ': le otto funzioni', da_chiamate(utente, ruolo), voluto)
  from (values
    ('l''amministrazione', '22222222-2222-2222-2222-222222222222', 'authenticated', '0/0/8'),
    ('segreteria e amministrazione', '33333333-3333-3333-3333-333333333333', 'authenticated', '0/0/8'),
    ('amministrazione e istruttore', '44444444-4444-4444-4444-444444444444', 'authenticated', '0/0/8'),
    ('la segreteria senza il ruolo', '11111111-1111-1111-1111-111111111111', 'authenticated', '8/0/0'),
    ('l''istruttore', '55555555-5555-5555-5555-555555555555', 'authenticated', '8/0/0'),
    ('l''iscritto', '77777777-7777-7777-7777-777777777777', 'authenticated', '8/0/0'),
    ('il tablet di sala', '99999999-9999-9999-9999-999999999999', 'authenticated', '8/0/0'),
    ('un accesso senza scheda', '66666666-6666-6666-6666-666666666666', 'authenticated', '8/0/0'),
    ('chi non ha l''accesso', '', 'anon', '0/8/0')
  ) v(label, utente, ruolo, voluto);
-- Con dati buoni, la segreteria senza il ruolo non cambia niente.
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria semplice non registra un movimento', esito(format('select registra_movimento(dati => %L::jsonb)', mov('entrata', '2026-09-10', 100, 'Donazioni', 'Conto Corrente', 'Abusivo'))), '42501 la contabilità la cura l’amministrazione');
select atteso('non fa un giroconto', esito(format('select registra_giroconto(dati => %L::jsonb)', jsonb_build_object('da', id_cassa('Conto Corrente'), 'a', id_cassa('Cassa Contanti'), 'data', '2026-09-15', 'importo', 100))), '42501 la contabilità la cura l’amministrazione');
select atteso('non annulla', esito(format('select annulla_movimento(id => %L)', id_mov('Offerta di Rossi'))), '42501 la contabilità la cura l’amministrazione');
select atteso('non corregge', esito(format('select correggi_testo_movimento(id => %L, descrizione => %L, nota => null)', id_mov('Offerta di Rossi'), 'Abusivo')), '42501 la contabilità la cura l’amministrazione');
select atteso('non imposta il saldo di una cassa', esito(format('select imposta_saldo_cassa(id => %L, saldo => 99999, dal => null)', id_cassa('Cassa Contanti'))), '42501 la contabilità la cura l’amministrazione');
select atteso('non crea una voce', esito($$select salva_voce('{"nome": "Abusiva", "tipo": "entrata"}')$$), '42501 la contabilità la cura l’amministrazione');
select atteso('non rinomina una voce', esito(format('select rinomina_voce(id => %L, nome => %L)', (select id from voci_contabili limit 1), 'Abusiva')), '42501 la contabilità la cura l’amministrazione');
select atteso('non disattiva una voce', esito(format('select imposta_voce_attiva(id => %L, attiva => false)', (select id from voci_contabili limit 1))), '42501 la contabilità la cura l’amministrazione');
reset role;
select atteso('dopo tutti questi tentativi non è cambiato niente', impronta(), :'prima');
-- La segreteria che ha anche il ruolo, invece, lavora.
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('segreteria e amministrazione registra', esito(format('select registra_movimento(dati => %L::jsonb)', mov('entrata', '2026-09-18', 700, 'Rimborsi', 'Conto Corrente', 'Rimborso di Sandro'))), 'ok');
select atteso('…e a firmarlo è Sandro', (select p.nome from movimenti m join persone p on p.id = m.creato_da where m.descrizione = 'Rimborso di Sandro'), 'Sandro');
reset role;
select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('amministrazione e istruttore annulla', esito(format('select annulla_movimento(id => %L)', id_mov('Rimborso di Sandro'))), 'ok');
reset role;
-- Com'era.
delete from movimenti where descrizione = 'Rimborso di Sandro';
select atteso('com''era prima della prova dei ruoli', impronta(), :'prima');

-- La porta: RLS accesa, tutto tolto, ad authenticated solo la lettura (la policy
-- fa il resto), ad anon niente. Le otto funzioni: solo authenticated.
select atteso('RLS accesa sulle tre tabelle', (select string_agg(relname, ', ' order by relname) from pg_class where relname in ('voci_contabili', 'casse', 'movimenti') and relnamespace = 'public'::regnamespace and relrowsecurity),
  'casse, movimenti, voci_contabili');
select atteso('authenticated ha solo SELECT', (select string_agg(t || ': ' || coalesce((select string_agg(p, ',' order by p) from unnest(array['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger']) p where has_table_privilege('authenticated', 'public.' || t, p)), 'niente'), '; ' order by t)
  from unnest(array['casse', 'movimenti', 'voci_contabili']) t), 'casse: select; movimenti: select; voci_contabili: select');
select atteso('anon non ha niente', (select string_agg(t || ': ' || coalesce((select string_agg(p, ',' order by p) from unnest(array['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger']) p where has_table_privilege('anon', 'public.' || t, p)), 'niente'), '; ' order by t)
  from unnest(array['casse', 'movimenti', 'voci_contabili']) t), 'casse: niente; movimenti: niente; voci_contabili: niente');
select atteso('l''unica policy di ognuna è di lettura', (select string_agg(tablename || ':' || cmd, ', ' order by tablename) from pg_policies where schemaname = 'public' and tablename in ('voci_contabili', 'casse', 'movimenti')),
  'casse:SELECT, movimenti:SELECT, voci_contabili:SELECT');
select atteso('le otto funzioni le chiama authenticated', (select string_agg(p.proname, ', ' order by p.proname) from pg_proc p where p.pronamespace = 'public'::regnamespace and has_function_privilege('authenticated', p.oid, 'execute')
  and p.proname in ('salva_voce', 'rinomina_voce', 'imposta_voce_attiva', 'imposta_saldo_cassa', 'registra_movimento', 'registra_giroconto', 'annulla_movimento', 'correggi_testo_movimento')),
  'annulla_movimento, correggi_testo_movimento, imposta_saldo_cassa, imposta_voce_attiva, registra_giroconto, registra_movimento, rinomina_voce, salva_voce');
select atteso('anon non ne chiama nessuna', (select coalesce(string_agg(p.proname, ', ' order by p.proname), 'nessuna') from pg_proc p where p.pronamespace = 'public'::regnamespace and has_function_privilege('anon', p.oid, 'execute')
  and p.proname in ('salva_voce', 'rinomina_voce', 'imposta_voce_attiva', 'imposta_saldo_cassa', 'registra_movimento', 'registra_giroconto', 'annulla_movimento', 'correggi_testo_movimento')), 'nessuna');
select atteso('non ci sono funzioni di lettura: si legge dalle tabelle', (select coalesce(string_agg(p.proname, ', ' order by p.proname), 'nessuna') from pg_proc p where p.pronamespace = 'public'::regnamespace
  -- cambia_voce_movimenti (67-cambia-voce.sql) scrive, non legge: la prova è cambia-voce.sql
  -- collega_movimenti_persona e scollega_movimenti_persona (70-movimenti-persona.sql) scrivono un'etichetta: la prova è movimenti-persona.sql
  -- movimenti_simili (72-movimenti-dalla-chat.sql) legge per Claude senza persone né autori, che dalle tabelle uscirebbero: la prova è movimenti-dalla-chat.sql
  -- chat_movimenti, chat_movimenti_uguali, chat_voci e chat_casse (77-claude-dalla-porta.sql) leggono per Claude, che dalle tabelle non passa più: la prova è claude-dalla-porta.sql
  and p.proname ~ '(movimenti|voci|casse)' and p.proname not in ('cambia_voce_movimenti', 'collega_movimenti_persona', 'scollega_movimenti_persona', 'movimenti_simili', 'chat_movimenti', 'chat_movimenti_uguali', 'chat_voci', 'chat_casse')), 'nessuna');

\echo ''
\echo '--- 8. i vincoli delle tabelle tengono anche a mano ---'
select atteso('una cassa con lo stesso nome no', esito($$insert into casse (nome) values ('Cassa Contanti')$$), '23505 …');
select atteso('una voce con lo stesso nome, maiuscole e spazi a parte, no', esito($$insert into voci_contabili (nome, tipo) values ('AFFITTO SALA ', 'uscita')$$), '23505 …');
select atteso('una voce di tipo giroconto no', esito($$insert into voci_contabili (nome, tipo) values ('Giro', 'giroconto')$$), '23514 …');
select atteso('un movimento di tipo che non c''è no', esito($$insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione) values ('prestito', '2026-09-10', 100, (select id from voci_contabili where nome = 'Donazioni'), (select id from casse where nome = 'Conto Corrente'), 'X')$$), '23514 …');
select atteso('importo zero no', esito($$insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione) values ('entrata', '2026-09-10', 0, (select id from voci_contabili where nome = 'Donazioni'), (select id from casse where nome = 'Conto Corrente'), 'X')$$), '23514 …');
select atteso('un''entrata senza voce no', esito($$insert into movimenti (tipo, data, importo, cassa_id, descrizione) values ('entrata', '2026-09-10', 100, (select id from casse where nome = 'Conto Corrente'), 'X')$$), '23514 …');
select atteso('un''entrata con una seconda cassa no', esito($$insert into movimenti (tipo, data, importo, voce_id, cassa_id, cassa_a_id, descrizione) values ('entrata', '2026-09-10', 100, (select id from voci_contabili where nome = 'Donazioni'), (select id from casse where nome = 'Conto Corrente'), (select id from casse where nome = 'Cassa Contanti'), 'X')$$), '23514 …');
select atteso('un giroconto con una voce no', esito($$insert into movimenti (tipo, data, importo, voce_id, cassa_id, cassa_a_id, descrizione) values ('giroconto', '2026-09-10', 100, (select id from voci_contabili where nome = 'Donazioni'), (select id from casse where nome = 'Conto Corrente'), (select id from casse where nome = 'Cassa Contanti'), 'X')$$), '23514 …');
select atteso('un giroconto senza la seconda cassa no', esito($$insert into movimenti (tipo, data, importo, cassa_id, descrizione) values ('giroconto', '2026-09-10', 100, (select id from casse where nome = 'Conto Corrente'), 'X')$$), '23514 …');
select atteso('un giroconto nella stessa cassa no', esito($$insert into movimenti (tipo, data, importo, cassa_id, cassa_a_id, descrizione) values ('giroconto', '2026-09-10', 100, (select id from casse where nome = 'Conto Corrente'), (select id from casse where nome = 'Conto Corrente'), 'X')$$), '23514 …');
select atteso('una descrizione vuota no', esito($$insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione) values ('entrata', '2026-09-10', 100, (select id from voci_contabili where nome = 'Donazioni'), (select id from casse where nome = 'Conto Corrente'), '')$$), '23514 …');
select atteso('una descrizione di 201 lettere no', esito($$insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione) values ('entrata', '2026-09-10', 100, (select id from voci_contabili where nome = 'Donazioni'), (select id from casse where nome = 'Conto Corrente'), repeat('d', 201))$$), '23514 …');
select atteso('una nota di 301 lettere no', esito($$insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione, nota) values ('entrata', '2026-09-10', 100, (select id from voci_contabili where nome = 'Donazioni'), (select id from casse where nome = 'Conto Corrente'), 'X', repeat('n', 301))$$), '23514 …');
select atteso('una cassa che non c''è no', esito($$insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione) values ('entrata', '2026-09-10', 100, (select id from voci_contabili where nome = 'Donazioni'), '00000000-0000-0000-0000-000000000000', 'X')$$), '23503 …');
select atteso('una voce che non c''è no', esito($$insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione) values ('entrata', '2026-09-10', 100, '00000000-0000-0000-0000-000000000000', (select id from casse where nome = 'Conto Corrente'), 'X')$$), '23503 …');
select atteso('niente di tutto questo è entrato', impronta(), :'prima');

\echo ''
\echo '--- 9. il file si rilancia senza danni ---'
select atteso('prima del rilancio il saldo è quello impostato', (select saldo_iniziale || ' ' || dal from casse where nome = 'Cassa Contanti'), '10000 2026-09-01');
\i supabase/59-contabilita.sql
select atteso('rilanciato, i dati sono gli stessi', impronta(), :'prima');
select atteso('…le casse sono ancora tre (la terza è Satispay, 96)', (select count(*)::text from casse), '3');
select atteso('…le voci di sistema ancora due', (select count(*)::text from voci_contabili where di_sistema and nome not in ('Differenza di cassa', 'Compensi istruttori')), '2');
select atteso('…il saldo impostato non è tornato a zero', (select saldo_iniziale || ' ' || dal from casse where nome = 'Cassa Contanti'), '10000 2026-09-01');
select atteso('…e i permessi sono gli stessi', (select string_agg(t || ': ' || coalesce((select string_agg(p, ',' order by p) from unnest(array['select', 'insert', 'update', 'delete']) p where has_table_privilege('authenticated', 'public.' || t, p)), 'niente'), '; ' order by t)
  from unnest(array['casse', 'movimenti', 'voci_contabili']) t), 'casse: select; movimenti: select; voci_contabili: select');
select atteso('…anon ancora fuori', (select coalesce(string_agg(p.proname, ', '), 'nessuna') from pg_proc p where p.pronamespace = 'public'::regnamespace and has_function_privilege('anon', p.oid, 'execute') and p.proname in ('salva_voce', 'registra_movimento', 'annulla_movimento')), 'nessuna');

\echo ''
\echo '--- 10. i casi al bordo: date assurde, id e testi che non sono quel che dovrebbero, inizio della cassa ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('una data di secoli fa no', esito(format('select registra_movimento(dati => %L::jsonb)', mov('entrata', '1999-12-31', 100, 'Donazioni', 'Conto Corrente', 'Troppo vecchio'))), '22023 La data non si capisce');
select atteso('«-infinity» no', esito(format('select registra_movimento(dati => %L::jsonb)', mov('entrata', '-infinity', 100, 'Donazioni', 'Conto Corrente', 'Infinito'))), '22023 La data non si capisce');
select atteso('una voce che non è un id si dice come una voce mancante', esito($$select registra_movimento('{"tipo":"entrata","data":"2026-09-10","importo":100,"voce_id":"zz","descrizione":"X"}')$$), '22023 Scegli la voce');
select atteso('una cassa che non è un id si dice come una cassa mancante', esito(format('select registra_movimento(%L::jsonb)', (mov('entrata', '2026-09-10', 100, 'Donazioni', 'Conto Corrente', 'X') || '{"cassa_id":"zz"}'))), '22023 Scegli la cassa');
select atteso('un giroconto con casse che non sono id', esito($$select registra_giroconto('{"da":"zz","a":"yy","data":"2026-09-10","importo":100}')$$), '22023 Scegli le due casse');
select atteso('una descrizione che non è testo no', esito(format('select registra_movimento(%L::jsonb)', (mov('entrata', '2026-09-10', 100, 'Donazioni', 'Conto Corrente', 'X') || '{"descrizione":{"a":1}}'))), '22023 Scrivi una descrizione');
select atteso('una nota che non è testo no', esito(format('select registra_movimento(%L::jsonb)', (mov('entrata', '2026-09-10', 100, 'Donazioni', 'Conto Corrente', 'X') || '{"nota":["a"]}'))), '22023 La nota non si capisce');
select atteso('un nome di voce che non è testo no', esito($$select salva_voce('{"nome":{"a":1},"tipo":"entrata"}')$$), '22023 Scrivi il nome della voce');
select atteso('niente di tutto questo è entrato', (select count(*)::text from movimenti where descrizione in ('Troppo vecchio', 'Infinito', 'X')), '0');

select atteso('un saldo enorme no', esito(format('select imposta_saldo_cassa(id => %L, saldo => 2000000000, dal => null)', id_cassa('Conto Corrente'))), '22023 Il saldo iniziale è troppo alto: controlla le cifre');
select atteso('l''inizio della cassa non è nel futuro', esito(format('select imposta_saldo_cassa(id => %L, saldo => 0, dal => %L)', id_cassa('Conto Corrente'), current_date + 30)), '22023 L’inizio della cassa non può essere nel futuro');
select atteso('l''inizio della cassa nel 1999 no', esito(format('select imposta_saldo_cassa(id => %L, saldo => 0, dal => %L)', id_cassa('Conto Corrente'), '1999-12-31')), '22023 La data non si capisce');
select atteso('registro un movimento sul conto', esito(format('select registra_movimento(dati => %L::jsonb)', mov('entrata', '2026-09-12', 700, 'Donazioni', 'Conto Corrente', 'Bonifico di settembre'))), 'ok');
select atteso('l''inizio della cassa non salta i movimenti già registrati', esito(format('select imposta_saldo_cassa(id => %L, saldo => 0, dal => %L)', id_cassa('Conto Corrente'), current_date)), '22023 Ci sono movimenti prima di quella data: annullali o scegli una data più vecchia');
select atteso('…e la cassa non è cambiata', (select saldo_iniziale || ' ' || coalesce(dal::text, '—') from casse where nome = 'Conto Corrente'), '0 —');
select atteso('un movimento annullato non pesa', esito(format('select annulla_movimento(id => %L)', id_mov('Bonifico di settembre'))), 'ok');
-- Il giorno del primo movimento del conto: prima di lì non c'è niente.
select min(data)::text as dopo from movimenti where id_cassa('Conto Corrente') in (cassa_id, cassa_a_id) and annullato_il is null \gset
select atteso('…allora la data si sposta', esito(format('select imposta_saldo_cassa(id => %L, saldo => 0, dal => %L)', id_cassa('Conto Corrente'), :'dopo')), 'ok');
select atteso('…e ora il conto non prende date più vecchie', esito(format('select registra_movimento(dati => %L::jsonb)', mov('entrata', (:'dopo'::date - 1)::text, 700, 'Donazioni', 'Conto Corrente', 'Troppo presto'))), '22023 La data è prima dell’inizio della cassa');
select atteso('si toglie la data: il conto conta tutto', esito(format('select imposta_saldo_cassa(id => %L, saldo => 0, dal => null)', id_cassa('Conto Corrente'))), 'ok');
reset role;

\echo ''
\echo '--- 11. il giorno è quello di Roma, e annulla/correggi/saldo si mettono in fila ---'
-- Il fuso della sessione non deve contare: i due fusi più lontani hanno sempre date diverse,
-- quindi con current_date al posto del giorno di Roma questa prova cade.
set time zone 'Pacific/Kiritimati';
select contabilita_oggi()::text as oggi_a_est \gset
set time zone 'Pacific/Pago_Pago';
select contabilita_oggi()::text as oggi_a_ovest \gset
reset time zone;
select atteso('«oggi» è lo stesso in ogni fuso', (:'oggi_a_est' = :'oggi_a_ovest')::text, 'true');
select atteso('…ed è il giorno di Roma', :'oggi_a_est', ((now() at time zone 'Europe/Rome')::date)::text);
-- Due sessioni insieme non si provano da qui: almeno il blocco della riga non deve sparire in silenzio.
select atteso('annulla, correggi e saldo bloccano la riga (for update)', (select string_agg(proname, ', ' order by proname) from pg_proc
  where pronamespace = 'public'::regnamespace and proname in ('annulla_movimento', 'correggi_testo_movimento', 'imposta_saldo_cassa') and prosrc ~* 'for update'),
  'annulla_movimento, correggi_testo_movimento, imposta_saldo_cassa');
