-- La chiusura di cassa (60-chiusura-cassa.sql): a fine settimana l'amministrazione
-- conta i contanti e li confronta col previsto della Cassa Contanti. Il previsto è
-- il saldo iniziale più i movimenti non annullati e gli incassi in contanti degli
-- iscritti (ricevute e pagamenti a mano), fino al giorno scelto. Se i conti non
-- tornano, la chiusura scrive da sola il movimento «Differenza di cassa», e da lì in
-- poi quei giorni sono chiusi: non si scrive né si annulla più niente con una data
-- fino a quel giorno, si fa una rettifica di oggi o si annulla la chiusura.
-- Le stesse regole di src/lib/contabilita.ts e della modalità prova, provate da
-- scripts/prova-contabilita.mjs e scripts/prova-segreteria.mjs (stesso dataset
-- del previsto: i numeri qui sotto sono gli stessi là).
-- Parte dallo schema da sé (come contabilita.sql): ricrea utenti e dati.
-- Si lancia dopo finto-supabase.sql e i file dello schema, su un database suo.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

select (to_regclass('public.chiusure_cassa') is not null)::text as c60 \gset
create or replace function atteso(cosa text, avuto text, voluto text) returns text language plpgsql as $$
begin
  if avuto is distinct from voluto and not (voluto like '%…' and avuto like replace(voluto, '…', '%')) then
    raise exception '% · atteso «%», avuto «%»', cosa, voluto, avuto;
  end if;
  return 'ok  ' || cosa || ' → ' || avuto;
end $$;
select atteso('60-chiusura-cassa.sql è stato lanciato: c''è la tabella delle chiusure', :'c60', 'true');
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
create or replace function mov(t text, g text, i int, v text, c text, d text) returns jsonb
  language sql stable security definer set search_path = public as $$
  select jsonb_build_object('tipo', t, 'data', g, 'importo', i,
    'voce_id', (select vc.id from voci_contabili vc where vc.nome = v and vc.tipo::text = t),
    'cassa_id', (select ca.id from casse ca where ca.nome = c),
    'descrizione', d)
$$;
-- I dati di una chiusura, con la cassa cercata per nome.
create or replace function chiusura(d text, contato int, nota text default null, cassa text default 'Cassa Contanti') returns jsonb
  language sql stable security definer set search_path = public as $$
  select jsonb_build_object('cassa_id', (select ca.id from casse ca where ca.nome = cassa), 'data', d, 'contato', contato, 'nota', nota)
$$;
create or replace function id_cassa(n text) returns uuid language sql stable security definer set search_path = public as $$
  select id from casse where nome = n $$;
create or replace function id_voce(n text, t text) returns uuid language sql stable security definer set search_path = public as $$
  select id from voci_contabili where nome = n and tipo::text = t $$;
create or replace function id_mov(d text) returns uuid language sql stable security definer set search_path = public as $$
  select id from movimenti where descrizione = d $$;
-- La chiusura attiva di una data (di una data ce n'è una sola attiva).
create or replace function id_chiusura(g text) returns uuid language sql stable security definer set search_path = public as $$
  select id from chiusure_cassa where data = g::date and annullata_il is null $$;
-- Quante chiusure vede chi chiama.
create or replace function visto() returns text language sql stable as $$
  select count(*)::text from chiusure_cassa $$;
-- Tutto il contenuto, per accorgersi di una riga che cambia.
create or replace function impronta() returns text language sql stable security definer set search_path = public as $$
  select md5(coalesce((select string_agg(v::text, '|' order by v.id) from voci_contabili v), '')
          || coalesce((select string_agg(c::text, '|' order by c.id) from casse c), '')
          || coalesce((select string_agg(m::text, '|' order by m.id) from movimenti m), '')
          || coalesce((select string_agg(h::text, '|' order by h.id) from chiusure_cassa h), '')) $$;
-- Il previsto della Cassa Contanti a una data (funzione interna, senza permessi: la chiama chi prova da amministratore del database).
create or replace function previsto(g text) returns int language sql stable as $$
  select previsto_cassa(id_cassa('Cassa Contanti'), g::date) $$;

create or replace function da_visto(utente text, ruolo text) returns text language plpgsql as $$
declare r text;
begin
  perform set_config('prova.utente', utente, false);
  execute format('set role %I', ruolo);
  r := tenta('select visto()');
  reset role;
  return r;
end $$;
-- Tre tentativi di scrivere dritto sulla tabella (insert, update, delete): quanti finiscono con
-- «permission denied», che è il permesso tolto e non una riga che manca.
create or replace function da_scritture(utente text, ruolo text) returns text language plpgsql as $$
declare r text; negati int := 0;
begin
  perform set_config('prova.utente', utente, false);
  execute format('set role %I', ruolo);
  foreach r in array array[
    'insert into chiusure_cassa (nota) values (''X'')',
    'update chiusure_cassa set nota = ''Y''',
    'delete from chiusure_cassa'] loop
    if tenta(r) = 'NEGATO: permission denied for table chiusure_cassa' then negati := negati + 1; end if;
  end loop;
  reset role;
  return negati || '/3';
end $$;
-- Le due funzioni chiamate con dati che non servono a niente: chi non può deve sentirsi dire
-- di no prima di ogni altro controllo. Esce «guardia / permesso tolto / altro».
create or replace function da_chiamate(utente text, ruolo text) returns text language plpgsql as $$
declare s text; e text; guardia int := 0; permesso int := 0; altro int := 0;
begin
  perform set_config('prova.utente', utente, false);
  execute format('set role %I', ruolo);
  foreach s in array array[
    $q$select chiudi_cassa('{}'::jsonb)$q$,
    $q$select annulla_chiusura_cassa('00000000-0000-0000-0000-000000000000'::uuid)$q$
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
  chiusura(text, int, text, text), id_cassa(text), id_voce(text, text), id_mov(text), id_chiusura(text), visto(), impronta() to anon, authenticated;

\echo ''
\echo '--- 1. «Differenza di cassa» è una voce di sistema, di entrata e di uscita ---'
select atteso('le due voci', (select string_agg(tipo || ' ' || di_sistema || ' ' || attiva, ', ' order by tipo) from voci_contabili where nome = 'Differenza di cassa'), 'entrata true true, uscita true true');
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('non si rinomina', esito(format('select rinomina_voce(id => %L, nome => %L)', id_voce('Differenza di cassa', 'uscita'), 'Ammanco')), '22023 Le voci di sistema non si cambiano');
select atteso('non si disattiva', esito(format('select imposta_voce_attiva(id => %L, attiva => false)', id_voce('Differenza di cassa', 'entrata'))), '22023 Le voci di sistema non si cambiano');
select atteso('un doppione nelle entrate no', esito($$select salva_voce('{"nome": " differenza di cassa", "tipo": "entrata"}')$$), '22023 C’è già una voce «differenza di cassa» tra le entrate');
select atteso('né nelle uscite', esito($$select salva_voce('{"nome": "DIFFERENZA DI CASSA", "tipo": "uscita"}')$$), '22023 C’è già una voce «DIFFERENZA DI CASSA» tra le uscite');
reset role;

\echo ''
\echo '--- 2. il dataset: dal 1 settembre, 100,00 di saldo e gli incassi che contano e quelli che no ---'
-- Lo stesso di scripts/prova-contabilita.mjs («previstoCassa»):
--   Cassa Contanti dal 2026-09-01, saldo iniziale 100,00
--   + ricevuta contanti 30,00 (3/9)                                         conta
--   − uscita a mano 10,00 (4/9)                                              conta
--   − giroconto 20,00 da Contanti a Conto (5/9)                              conta
--   ricevuta POS 50,00 (3/9), ricevuta contanti 40,00 ANNULLATA (3/9)        non contano
--   uscita 44,44 annullata (4/9), entrata 7,00 sul Conto (5/9)               non contano
--   → previsto al 7/9: 100,00
--   + pagamento a mano «  contanti» 20,00 (8/9)                              conta
--   + ricevuta (8/9): voce a «CONTANTI » 15,00 conta; voce con bonifico 10,00,
--     anticipo 50,00 e una voce «pagato fino al» senza pagamenti             non contano
--   pagamento a mano con assegno 7,00, pagamento a mano contanti 9,00 ANNULLATO (8/9)   non contano
--   → previsto all'8/9: 135,00
--   + ricevuta contanti 8,88 (20/9)                                          conta
--   ricevuta contanti 7,77 (31/8, prima del «dal») e 9,99 (25/9, dopo)       non contano
--   → previsto al 20/9: 143,88
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('una voce di uscita', esito($$select salva_voce('{"nome": "Affitto sala", "tipo": "uscita"}')$$), 'ok');
select atteso('una voce di entrata', esito($$select salva_voce('{"nome": "Donazioni", "tipo": "entrata"}')$$), 'ok');
select atteso('il saldo di Cassa Contanti', esito(format('select imposta_saldo_cassa(id => %L, saldo => 10000, dal => %L)', id_cassa('Cassa Contanti'), '2026-09-01')), 'ok');
select atteso('l''uscita a mano', esito(format('select registra_movimento(dati => %L::jsonb)', mov('uscita', '2026-09-04', 1000, 'Affitto sala', 'Cassa Contanti', 'Affitto sala di settembre'))), 'ok');
select atteso('un''uscita che poi si annulla', esito(format('select registra_movimento(dati => %L::jsonb)', mov('uscita', '2026-09-04', 4444, 'Affitto sala', 'Cassa Contanti', 'Uscita annullata'))), 'ok');
select atteso('…annullata', esito(format('select annulla_movimento(id => %L)', id_mov('Uscita annullata'))), 'ok');
select atteso('un''entrata sul conto', esito(format('select registra_movimento(dati => %L::jsonb)', mov('entrata', '2026-09-05', 700, 'Donazioni', 'Conto Corrente', 'Bonifico di Rossi'))), 'ok');
select atteso('il giroconto', esito(format('select registra_giroconto(dati => %L::jsonb)',
  jsonb_build_object('da', id_cassa('Cassa Contanti'), 'a', id_cassa('Conto Corrente'), 'data', '2026-09-05', 'importo', 2000, 'nota', 'Versamento in banca'))), 'ok');
reset role;
select id_mov('Affitto sala di settembre') as m_affitto, id_mov('Bonifico di Rossi') as m_bonifico, (select id from movimenti where tipo = 'giroconto') as m_giro \gset

-- Gli incassi degli iscritti, come li scrivono emetti_ricevuta e registra_pagamento_diretto.
insert into ricevute (anno, numero, data, persona_id, ente, intestatario, voci, totale, pagato, anticipo, annullata_il) values
  (2026, 1, '2026-09-03', 'aaaaaaaa-0000-0000-0000-000000000007', '{}', '{"nome": "Luca", "cognome": "Rossi"}',
    '[{"descrizione": "QUOTA ASSOCIATIVA", "quantita": 1, "prezzo": 3000, "pagamenti": [{"data": "2026-09-03", "importo": 3000, "metodo": "Contanti"}]}]', 3000, 3000, 0, null),
  (2026, 2, '2026-09-03', 'aaaaaaaa-0000-0000-0000-000000000007', '{}', '{"nome": "Luca", "cognome": "Rossi"}',
    '[{"descrizione": "ANNUALE JUDO", "quantita": 1, "prezzo": 5000, "pagamenti": [{"data": "2026-09-03", "importo": 5000, "metodo": "POS"}]}]', 5000, 5000, 0, null),
  (2026, 3, '2026-09-03', 'aaaaaaaa-0000-0000-0000-000000000007', '{}', '{"nome": "Luca", "cognome": "Rossi"}',
    '[{"descrizione": "ANNUALE JUDO", "quantita": 1, "prezzo": 4000, "pagamenti": [{"data": "2026-09-03", "importo": 4000, "metodo": "Contanti"}]}]', 4000, 4000, 0, now()),
  (2026, 4, '2026-09-08', 'aaaaaaaa-0000-0000-0000-000000000007', '{}', '{"nome": "Luca", "cognome": "Rossi"}',
    '[{"descrizione": "TRIMESTRE KARATE", "quantita": 1, "prezzo": 3000, "pagamenti": [{"data": "2026-09-08", "importo": 1500, "metodo": "CONTANTI "}]},
      {"descrizione": "QUOTA ASSOCIATIVA", "quantita": 1, "prezzo": 1000, "pagamenti": [{"data": "2026-09-08", "importo": 1000, "metodo": "Bonifico"}]},
      {"descrizione": "ANNUALE JUDO", "quantita": 1, "prezzo": 8000, "dal": "2026-09-01", "al": "2027-07-31", "pagamenti": []}]', 12000, 2500, 5000, null),
  (2026, 5, '2026-08-31', 'aaaaaaaa-0000-0000-0000-000000000007', '{}', '{"nome": "Luca", "cognome": "Rossi"}',
    '[{"descrizione": "ALTRO", "quantita": 1, "prezzo": 777, "pagamenti": [{"data": "2026-08-31", "importo": 777, "metodo": "Contanti"}]}]', 777, 777, 0, null),
  (2026, 6, '2026-09-20', 'aaaaaaaa-0000-0000-0000-000000000007', '{}', '{"nome": "Luca", "cognome": "Rossi"}',
    '[{"descrizione": "ALTRO", "quantita": 1, "prezzo": 888, "pagamenti": [{"data": "2026-09-20", "importo": 888, "metodo": "contanti"}]}]', 888, 888, 0, null),
  (2026, 7, '2026-09-25', 'aaaaaaaa-0000-0000-0000-000000000007', '{}', '{"nome": "Luca", "cognome": "Rossi"}',
    '[{"descrizione": "ALTRO", "quantita": 1, "prezzo": 999, "pagamenti": [{"data": "2026-09-25", "importo": 999, "metodo": "Contanti"}]}]', 999, 999, 0, null);
insert into pagamenti_diretti (persona_id, data, importo, metodo, voce, annullato_il) values
  ('aaaaaaaa-0000-0000-0000-000000000007', '2026-09-08', 2000, '  contanti', 'ALTRO', null),
  ('aaaaaaaa-0000-0000-0000-000000000007', '2026-09-08', 700, 'Assegno', 'ALTRO', null),
  ('aaaaaaaa-0000-0000-0000-000000000007', '2026-09-08', 900, 'Contanti', 'ALTRO', now());

\echo ''
\echo '--- 3. parità: il previsto del database è quello dell''app (previstoCassa) ---'
select atteso('al 7 settembre: 100,00 + 30,00 − 10,00 − 20,00', previsto('2026-09-07')::text, '10000');
select atteso('all''8 settembre: + 20,00 a mano + 15,00 in contanti della ricevuta', previsto('2026-09-08')::text, '13500');
select atteso('al 20 settembre: + 8,88', previsto('2026-09-20')::text, '14388');
select atteso('un giorno dopo, prima dei 9,99 del 25: lo stesso', previsto('2026-09-24')::text, '14388');
select atteso('il 25: entrano i 9,99', previsto('2026-09-25')::text, '15387');
select atteso('il 3 settembre: solo i 30,00 della ricevuta', previsto('2026-09-03')::text, '13000');
select atteso('il conto non c''entra: 7,00 e il POS non sono nei contanti', (select (previsto('2026-09-07') = 10000)::text), 'true');
select atteso('previsto_cassa non la chiama nessuno da fuori',
  (select coalesce(string_agg(p.proname, ', '), 'nessuna') from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'previsto_cassa'
    and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))), 'nessuna');

\echo ''
\echo '--- 4. una chiusura rifiuta quel che non ha senso, nell''ordine ---'
select impronta() as prima \gset
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('senza cassa', esito($$select chiudi_cassa('{"data": "2026-09-07", "contato": 9500}')$$), '22023 Scegli la cassa');
select atteso('una cassa che non è un id', esito($$select chiudi_cassa('{"cassa_id": "zz", "data": "2026-09-07", "contato": 9500}')$$), '22023 Scegli la cassa');
select atteso('una cassa che non c''è', esito($$select chiudi_cassa('{"cassa_id": "00000000-0000-0000-0000-000000000000", "data": "2026-09-07", "contato": 9500}')$$), '22023 Scegli la cassa');
select atteso('il Conto Corrente non si chiude', esito(format('select chiudi_cassa(dati => %L::jsonb)', chiusura('2026-09-07', 9500, null, 'Conto Corrente'))), '22023 Si chiude solo la Cassa Contanti');
select atteso('…prima di guardare la data', esito(format('select chiudi_cassa(dati => %L::jsonb)', chiusura('2026-02-30', 9500, null, 'Conto Corrente'))), '22023 Si chiude solo la Cassa Contanti');
select atteso('il 30 febbraio', esito(format('select chiudi_cassa(dati => %L::jsonb)', chiusura('2026-02-30', 9500))), '22023 La data non si capisce');
select atteso('senza data', esito(format('select chiudi_cassa(dati => %L::jsonb)', chiusura(null, 9500))), '22023 La data non si capisce');
select atteso('una data di secoli fa', esito(format('select chiudi_cassa(dati => %L::jsonb)', chiusura('1999-12-31', 9500))), '22023 La data non si capisce');
select atteso('domani', esito(format('select chiudi_cassa(dati => %L::jsonb)', chiusura((current_date + 1)::text, 9500))), '22023 La data è nel futuro: si chiude quel che è già successo');
select atteso('il 31 agosto, prima dell''inizio della cassa', esito(format('select chiudi_cassa(dati => %L::jsonb)', chiusura('2026-08-31', 9500))), '22023 La data è prima dell’inizio della cassa');
select atteso('…la data prima dei contanti', esito(format('select chiudi_cassa(dati => %L::jsonb)', chiusura('2026-02-30', -5))), '22023 La data non si capisce');
select atteso('contanti scritti a parole', esito($$select chiudi_cassa(jsonb_build_object('cassa_id', (select id from casse where nome = 'Cassa Contanti'), 'data', '2026-09-07', 'contato', 'tanti'))$$), '22023 I contanti contati non si capiscono');
select atteso('contanti con la virgola', esito($$select chiudi_cassa(jsonb_build_object('cassa_id', (select id from casse where nome = 'Cassa Contanti'), 'data', '2026-09-07', 'contato', 95.5))$$), '22023 I contanti contati non si capiscono');
select atteso('senza contanti', esito($$select chiudi_cassa(jsonb_build_object('cassa_id', (select id from casse where nome = 'Cassa Contanti'), 'data', '2026-09-07'))$$), '22023 I contanti contati non si capiscono');
select atteso('contanti negativi', esito(format('select chiudi_cassa(dati => %L::jsonb)', chiusura('2026-09-07', -1))), '22023 I contanti contati non possono essere negativi');
select atteso('contanti oltre un milione di euro', esito(format('select chiudi_cassa(dati => %L::jsonb)', chiusura('2026-09-07', 100000001))), '22023 I contanti contati sono troppi: controlla le cifre');
select atteso('nota di 301 lettere', esito(format('select chiudi_cassa(dati => %L::jsonb)', chiusura('2026-09-07', 9500, repeat('n', 301)))), '22023 La nota è troppo lunga: al massimo 300 caratteri');
select atteso('…dopo i contanti', esito(format('select chiudi_cassa(dati => %L::jsonb)', chiusura('2026-09-07', -1, repeat('n', 301)))), '22023 I contanti contati non possono essere negativi');
reset role;
select atteso('di tutti questi rifiuti non è entrato niente', impronta(), :'prima');
select atteso('…nessuna chiusura', (select count(*)::text from chiusure_cassa), '0');

\echo ''
\echo '--- 5. si chiude fino al 7 settembre: i contanti sono 5,00 in meno ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('si chiude', esito(format('select chiudi_cassa(dati => %L::jsonb)', chiusura('2026-09-07', 9500, 'Contati in cassa'))), 'ok');
reset role;
select id_chiusura('2026-09-07') as c1 \gset
select atteso('…dal, fino al, previsto, contato, differenza, nota',
  (select dal || ' ' || data || ' ' || previsto || ' ' || contato || ' ' || differenza || ' ' || nota from chiusure_cassa where id = :'c1'),
  '2026-09-01 2026-09-07 10000 9500 -500 Contati in cassa');
select atteso('…della Cassa Contanti', (select (cassa_id = id_cassa('Cassa Contanti'))::text from chiusure_cassa where id = :'c1'), 'true');
select atteso('…chiusa da Ada, adesso, non annullata', (select p.nome || ' ' || (h.chiusa_il > now() - interval '1 minute')::text || ' ' || (h.annullata_il is null)::text || ' ' || (h.annullata_da is null)::text
  from chiusure_cassa h join persone p on p.id = h.chiusa_da where h.id = :'c1'), 'Ada true true true');
select atteso('…con un movimento di uscita di 5,00 scritto da sola',
  (select m.tipo || ' ' || m.data || ' ' || m.importo || ' ' || v.nome || ' ' || ca.nome || ' ' || m.descrizione || ' ' || m.nota || ' ' || p.nome
     from chiusure_cassa h join movimenti m on m.id = h.movimento_id join voci_contabili v on v.id = m.voce_id join casse ca on ca.id = m.cassa_id join persone p on p.id = m.creato_da where h.id = :'c1'),
  'uscita 2026-09-07 500 Differenza di cassa Cassa Contanti Differenza di cassa Contati in cassa Ada');
select atteso('…la voce è quella di uscita', (select (v.tipo = 'uscita' and v.di_sistema)::text from chiusure_cassa h join movimenti m on m.id = h.movimento_id join voci_contabili v on v.id = m.voce_id where h.id = :'c1'), 'true');
select atteso('…e a fine giorno in cassa c''è quel che si è contato', previsto('2026-09-07')::text, '9500');
select atteso('è l''unico movimento di differenza', (select count(*)::text from movimenti m join voci_contabili v on v.id = m.voce_id where v.nome = 'Differenza di cassa'), '1');

\echo ''
\echo '--- 6. i giorni chiusi: fino al 7 settembre non si scrive e non si annulla ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('un movimento il 7 settembre no', esito(format('select registra_movimento(dati => %L::jsonb)', mov('entrata', '2026-09-07', 100, 'Donazioni', 'Cassa Contanti', 'Tardivo'))),
  '22023 Quel giorno è già chiuso: per correggere scrivi il movimento con una data dopo la chiusura e una voce di rettifica (si crea in VOCI), oppure annulla la chiusura');
select atteso('né il 3', esito(format('select registra_movimento(dati => %L::jsonb)', mov('uscita', '2026-09-03', 100, 'Affitto sala', 'Cassa Contanti', 'Tardivo'))),
  '22023 Quel giorno è già chiuso: per correggere scrivi il movimento con una data dopo la chiusura e una voce di rettifica (si crea in VOCI), oppure annulla la chiusura');
select atteso('prima dell''inizio della cassa vince il giorno chiuso? no: vince l''inizio', esito(format('select registra_movimento(dati => %L::jsonb)', mov('entrata', '2026-08-31', 100, 'Donazioni', 'Cassa Contanti', 'Tardivo'))),
  '22023 La data è prima dell’inizio della cassa');
select atteso('una cassa che non c''è vince il giorno chiuso', esito(format('select registra_movimento(dati => %L::jsonb)', mov('entrata', '2026-09-07', 100, 'Donazioni', 'Non c''è', 'Tardivo'))), '22023 Scegli la cassa');
select atteso('l''importo e la data vincono il giorno chiuso', esito(format('select registra_movimento(dati => %L::jsonb)', mov('entrata', '2026-09-07', 0, 'Donazioni', 'Cassa Contanti', 'Tardivo'))), '22023 L’importo deve essere più di zero');
select atteso('il giorno chiuso viene prima della descrizione', esito(format('select registra_movimento(dati => %L::jsonb)', mov('entrata', '2026-09-07', 100, 'Donazioni', 'Cassa Contanti', '   '))),
  '22023 Quel giorno è già chiuso: per correggere scrivi il movimento con una data dopo la chiusura e una voce di rettifica (si crea in VOCI), oppure annulla la chiusura');
select atteso('il Conto Corrente non è chiuso: il 5 settembre si scrive', esito(format('select registra_movimento(dati => %L::jsonb)', mov('entrata', '2026-09-05', 100, 'Donazioni', 'Conto Corrente', 'Sul conto'))), 'ok');
select atteso('l''8 settembre, sui contanti, si scrive', esito(format('select registra_movimento(dati => %L::jsonb)', mov('entrata', '2026-09-08', 100, 'Donazioni', 'Cassa Contanti', 'Dopo la chiusura'))), 'ok');
select atteso('…e si annulla', esito(format('select annulla_movimento(id => %L)', id_mov('Dopo la chiusura'))), 'ok');
-- I giroconti: basta che una delle due casse sia chiusa.
select atteso('un giroconto dal conto ai contanti il 5 settembre no', esito(format('select registra_giroconto(dati => %L::jsonb)',
  jsonb_build_object('da', id_cassa('Conto Corrente'), 'a', id_cassa('Cassa Contanti'), 'data', '2026-09-05', 'importo', 100))),
  '22023 Quel giorno è già chiuso: per correggere scrivi il movimento con una data dopo la chiusura e una voce di rettifica (si crea in VOCI), oppure annulla la chiusura');
select atteso('né dai contanti al conto il 7', esito(format('select registra_giroconto(dati => %L::jsonb)',
  jsonb_build_object('da', id_cassa('Cassa Contanti'), 'a', id_cassa('Conto Corrente'), 'data', '2026-09-07', 'importo', 100))),
  '22023 Quel giorno è già chiuso: per correggere scrivi il movimento con una data dopo la chiusura e una voce di rettifica (si crea in VOCI), oppure annulla la chiusura');
select atteso('l''inizio della cassa vince il giorno chiuso', esito(format('select registra_giroconto(dati => %L::jsonb)',
  jsonb_build_object('da', id_cassa('Cassa Contanti'), 'a', id_cassa('Conto Corrente'), 'data', '2026-08-31', 'importo', 100))), '22023 La data è prima dell’inizio della cassa');
select atteso('l''importo vince il giorno chiuso', esito(format('select registra_giroconto(dati => %L::jsonb)',
  jsonb_build_object('da', id_cassa('Cassa Contanti'), 'a', id_cassa('Conto Corrente'), 'data', '2026-09-07', 'importo', 0))), '22023 L’importo deve essere più di zero');
select atteso('l''8 settembre il giroconto va', esito(format('select registra_giroconto(dati => %L::jsonb)',
  jsonb_build_object('da', id_cassa('Cassa Contanti'), 'a', id_cassa('Conto Corrente'), 'data', '2026-09-08', 'importo', 100, 'nota', 'Dopo la chiusura'))), 'ok');
select atteso('…e si annulla', esito(format('select annulla_movimento(id => %L)', (select id from movimenti where nota = 'Dopo la chiusura' and tipo = 'giroconto'))), 'ok');
-- L'«annulla» di un movimento di un giorno chiuso.
select atteso('l''affitto del 4 settembre non si annulla', esito(format('select annulla_movimento(id => %L)', :'m_affitto')),
  '22023 Quel giorno è già chiuso: annulla prima la chiusura, o scrivi una rettifica con una data dopo la chiusura');
select atteso('né il giroconto del 5', esito(format('select annulla_movimento(id => %L)', :'m_giro')),
  '22023 Quel giorno è già chiuso: annulla prima la chiusura, o scrivi una rettifica con una data dopo la chiusura');
select atteso('né la differenza di cassa', esito(format('select annulla_movimento(id => %L)', (select movimento_id from chiusure_cassa where id = :'c1'))),
  '22023 Quel giorno è già chiuso: annulla prima la chiusura, o scrivi una rettifica con una data dopo la chiusura');
select atteso('il bonifico sul conto del 5 settembre sì', esito(format('select annulla_movimento(id => %L)', :'m_bonifico')), 'ok');
-- Il testo si corregge anche in un giorno chiuso.
select atteso('la descrizione di un movimento chiuso si corregge', esito(format('select correggi_testo_movimento(id => %L, descrizione => %L, nota => %L)', :'m_affitto', 'Affitto della sala di settembre', 'Pagato a mano')), 'ok');
select atteso('…anche quella della differenza', esito(format('select correggi_testo_movimento(id => %L, descrizione => %L, nota => null)', (select movimento_id from chiusure_cassa where id = :'c1'), 'Differenza di cassa')), 'ok');
select atteso('…e il movimento è sempre quello', (select descrizione from movimenti where id = :'m_affitto'), 'Affitto della sala di settembre');
select atteso('correggere non ha mosso i conti', esito(format('select correggi_testo_movimento(id => %L, descrizione => %L, nota => null)', :'m_affitto', 'Affitto sala di settembre')), 'ok');
-- La voce «Differenza di cassa» non si sceglie a mano.
select atteso('«Differenza di cassa» in entrata a mano no', esito(format('select registra_movimento(dati => %L::jsonb)', mov('entrata', '2026-09-10', 100, 'Differenza di cassa', 'Conto Corrente', 'A mano'))),
  '22023 La «Differenza di cassa» si scrive da sola chiudendo la cassa');
select atteso('…e in uscita nemmeno', esito(format('select registra_movimento(dati => %L::jsonb)', mov('uscita', '2026-09-10', 100, 'Differenza di cassa', 'Conto Corrente', 'A mano'))),
  '22023 La «Differenza di cassa» si scrive da sola chiudendo la cassa');
select atteso('…prima si guarda se la voce va col tipo', esito(format('select registra_movimento(dati => %L::jsonb)', mov('entrata', '2026-09-10', 100, 'Differenza di cassa', 'Conto Corrente', 'A mano') || jsonb_build_object('voce_id', id_voce('Differenza di cassa', 'uscita')))),
  '22023 La voce scelta non va con questo tipo di movimento');
-- Il saldo iniziale di una cassa chiusa non si cambia.
select atteso('il saldo di una cassa chiusa no', esito(format('select imposta_saldo_cassa(id => %L, saldo => 20000, dal => %L)', id_cassa('Cassa Contanti'), '2026-09-01')),
  '22023 La cassa ha una chiusura: annullala prima di cambiare il saldo iniziale');
select atteso('…prima degli altri controlli', esito(format('select imposta_saldo_cassa(id => %L, saldo => -5, dal => null)', id_cassa('Cassa Contanti'))),
  '22023 La cassa ha una chiusura: annullala prima di cambiare il saldo iniziale');
select atteso('…ma una cassa che non c''è resta una cassa che non c''è', esito($$select imposta_saldo_cassa(id => '00000000-0000-0000-0000-000000000000', saldo => 0, dal => null)$$), 'P0002 La cassa non c’è');
select atteso('il Conto Corrente non ha chiusure: il suo saldo si cambia', esito(format('select imposta_saldo_cassa(id => %L, saldo => 0, dal => null)', id_cassa('Conto Corrente'))), 'ok');
select atteso('si chiude solo dopo l''ultima chiusura (7 settembre)', esito(format('select chiudi_cassa(dati => %L::jsonb)', chiusura('2026-09-07', 9500))), '22023 Quel giorno è già chiuso: scegli un giorno dopo il 07/09/2026');
select atteso('…neanche un giorno prima', esito(format('select chiudi_cassa(dati => %L::jsonb)', chiusura('2026-09-03', 9500))), '22023 Quel giorno è già chiuso: scegli un giorno dopo il 07/09/2026');
reset role;
select atteso('il saldo della Cassa Contanti è rimasto', (select saldo_iniziale || ' ' || dal from casse where nome = 'Cassa Contanti'), '10000 2026-09-01');

\echo ''
\echo '--- 7. una chiusura che copre più giorni: +3,00, poi una che torna ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('si chiude fino al 20 settembre: 3,00 in più', esito(format('select chiudi_cassa(dati => %L::jsonb)', chiusura('2026-09-20', 14188))), 'ok');
reset role;
select id_chiusura('2026-09-20') as c2 \gset
select atteso('…parte dal giorno dopo l''ultima, il previsto è dall''inizio della cassa (la differenza di prima c''è)',
  (select dal || ' ' || data || ' ' || previsto || ' ' || contato || ' ' || differenza || ' ' || coalesce(nota, '—') from chiusure_cassa where id = :'c2'), '2026-09-08 2026-09-20 13888 14188 300 —');
select atteso('…con un''entrata di 3,00 il 20 settembre',
  (select m.tipo || ' ' || m.data || ' ' || m.importo || ' ' || v.nome || ' ' || coalesce(m.nota, '—') from chiusure_cassa h join movimenti m on m.id = h.movimento_id join voci_contabili v on v.id = m.voce_id where h.id = :'c2'),
  'entrata 2026-09-20 300 Differenza di cassa —');
select atteso('…e a fine giorno in cassa c''è quel che si è contato', previsto('2026-09-20')::text, '14188');
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('si chiude il 20: ora è chiuso', esito(format('select chiudi_cassa(dati => %L::jsonb)', chiusura('2026-09-20', 14188))), '22023 Quel giorno è già chiuso: scegli un giorno dopo il 20/09/2026');
select atteso('…e il 10', esito(format('select chiudi_cassa(dati => %L::jsonb)', chiusura('2026-09-10', 14188))), '22023 Quel giorno è già chiuso: scegli un giorno dopo il 20/09/2026');
select atteso('il 22 settembre i conti tornano: nessuna differenza', esito(format('select chiudi_cassa(dati => %L::jsonb)', chiusura('2026-09-22', 14188))), 'ok');
reset role;
select id_chiusura('2026-09-22') as c3 \gset
select atteso('…dal 21, previsto e contato uguali, differenza zero, nessun movimento',
  (select dal || ' ' || data || ' ' || previsto || ' ' || contato || ' ' || differenza || ' ' || (movimento_id is null)::text from chiusure_cassa where id = :'c3'), '2026-09-21 2026-09-22 14188 14188 0 true');
select atteso('…e i movimenti di differenza sono ancora due', (select count(*)::text from movimenti m join voci_contabili v on v.id = m.voce_id where v.nome = 'Differenza di cassa'), '2');
select atteso('le chiusure sono tre, tutte attive', (select count(*)::text from chiusure_cassa where annullata_il is null), '3');

\echo ''
\echo '--- 8. si annulla solo l''ultima, e i giorni si riaprono ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('una chiusura che non c''è', esito($$select annulla_chiusura_cassa('00000000-0000-0000-0000-000000000000')$$), 'P0002 La chiusura non c’è');
select atteso('quella del 20 settembre non è l''ultima', esito(format('select annulla_chiusura_cassa(id => %L)', :'c2')), '22023 Si annulla solo l’ultima chiusura della cassa');
select atteso('quella del 7 nemmeno', esito(format('select annulla_chiusura_cassa(id => %L)', :'c1')), '22023 Si annulla solo l’ultima chiusura della cassa');
select atteso('l''ultima, del 22, sì', esito(format('select annulla_chiusura_cassa(id => %L)', :'c3')), 'ok');
reset role;
select atteso('…resta in tabella, annullata da Ada', (select (h.annullata_il is not null)::text || ' ' || p.nome from chiusure_cassa h join persone p on p.id = h.annullata_da where h.id = :'c3'), 'true Ada');
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('ora l''ultima è quella del 20, e si annulla', esito(format('select annulla_chiusura_cassa(id => %L)', :'c2')), 'ok');
reset role;
select atteso('…annulla anche il suo movimento di differenza, e resta in tabella', (select (m.annullato_il is not null)::text || ' ' || p.nome || ' ' || m.importo
  from chiusure_cassa h join movimenti m on m.id = h.movimento_id join persone p on p.id = m.annullato_da where h.id = :'c2'), 'true Ada 300');
select atteso('…la chiusura è annullata', (select (annullata_il is not null)::text from chiusure_cassa where id = :'c2'), 'true');
select atteso('…e il previsto non conta più i 3,00', previsto('2026-09-20')::text, '13888');
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('annullarla due volte no', esito(format('select annulla_chiusura_cassa(id => %L)', :'c2')), 'P0002 La chiusura è già annullata');
select atteso('…neanche quella del 22', esito(format('select annulla_chiusura_cassa(id => %L)', :'c3')), 'P0002 La chiusura è già annullata');
select atteso('il 10 settembre è di nuovo aperto', esito(format('select registra_movimento(dati => %L::jsonb)', mov('entrata', '2026-09-10', 100, 'Donazioni', 'Cassa Contanti', 'Dopo l''annullo'))), 'ok');
select atteso('…e si annulla', esito(format('select annulla_movimento(id => %L)', id_mov('Dopo l''annullo'))), 'ok');
select atteso('il 7 è ancora chiuso', esito(format('select registra_movimento(dati => %L::jsonb)', mov('entrata', '2026-09-07', 100, 'Donazioni', 'Cassa Contanti', 'Ancora no'))),
  '22023 Quel giorno è già chiuso: per correggere scrivi il movimento con una data dopo la chiusura e una voce di rettifica (si crea in VOCI), oppure annulla la chiusura');
select atteso('si richiude il 20 (ora i conti tornano)', esito(format('select chiudi_cassa(dati => %L::jsonb)', chiusura('2026-09-20', 13888))), 'ok');
reset role;
select id_chiusura('2026-09-20') as c4 \gset
select atteso('…è un''altra chiusura, senza differenza', (select (:'c4' <> :'c2')::text || ' ' || dal || ' ' || previsto || ' ' || differenza || ' ' || (movimento_id is null)::text from chiusure_cassa where id = :'c4'), 'true 2026-09-08 13888 0 true');
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('con le chiusure il saldo è bloccato', esito(format('select imposta_saldo_cassa(id => %L, saldo => 10000, dal => %L)', id_cassa('Cassa Contanti'), '2026-09-01')),
  '22023 La cassa ha una chiusura: annullala prima di cambiare il saldo iniziale');
select atteso('si annulla l''ultima', esito(format('select annulla_chiusura_cassa(id => %L)', :'c4')), 'ok');
select atteso('…il saldo è ancora bloccato: resta quella del 7', esito(format('select imposta_saldo_cassa(id => %L, saldo => 10000, dal => %L)', id_cassa('Cassa Contanti'), '2026-09-01')),
  '22023 La cassa ha una chiusura: annullala prima di cambiare il saldo iniziale');
select atteso('si annulla anche quella del 7', esito(format('select annulla_chiusura_cassa(id => %L)', :'c1')), 'ok');
select atteso('…allora il saldo si cambia', esito(format('select imposta_saldo_cassa(id => %L, saldo => 10000, dal => %L)', id_cassa('Cassa Contanti'), '2026-09-01')), 'ok');
select atteso('…e i giorni di prima sono aperti: il 5 settembre si scrive', esito(format('select registra_movimento(dati => %L::jsonb)', mov('entrata', '2026-09-05', 100, 'Donazioni', 'Cassa Contanti', 'Tutto aperto'))), 'ok');
select atteso('…e si annulla', esito(format('select annulla_movimento(id => %L)', id_mov('Tutto aperto'))), 'ok');
select atteso('…anche l''affitto del 4 settembre si annulla (poi lo si rifà)', esito(format('select annulla_movimento(id => %L)', :'m_affitto')), 'ok');
reset role;
-- Com'era: l'affitto del 4 settembre torna quello di prima.
update movimenti set annullato_il = null, annullato_da = null where id = :'m_affitto';
select atteso('la differenza della prima chiusura è stata annullata con lei', (select (m.annullato_il is not null)::text from chiusure_cassa h join movimenti m on m.id = h.movimento_id where h.id = :'c1'), 'true');
select atteso('…quindi il previsto del 7 è tornato 100,00', previsto('2026-09-07')::text, '10000');
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('si richiude il 7 settembre', esito(format('select chiudi_cassa(dati => %L::jsonb)', chiusura('2026-09-07', 9500, 'Contati in cassa'))), 'ok');
reset role;
select id_chiusura('2026-09-07') as c5 \gset
select atteso('…di nuovo meno 5,00, con un movimento suo', (select (:'c5' <> :'c1')::text || ' ' || previsto || ' ' || differenza || ' ' || (movimento_id <> (select movimento_id from chiusure_cassa where id = :'c1'))::text from chiusure_cassa where id = :'c5'), 'true 10000 -500 true');

\echo ''
\echo '--- 9. chi può cosa: solo l''amministrazione, anche quella che è segreteria o che insegna ---'
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('segreteria e amministrazione chiude', esito(format('select chiudi_cassa(dati => %L::jsonb)', chiusura('2026-09-23', 13888))), 'ok');
reset role;
select id_chiusura('2026-09-23') as c6 \gset
select atteso('…chiusa da Sandro', (select p.nome from chiusure_cassa h join persone p on p.id = h.chiusa_da where h.id = :'c6'), 'Sandro');
select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('amministrazione e istruttore annulla', esito(format('select annulla_chiusura_cassa(id => %L)', :'c6')), 'ok');
reset role;
select atteso('…annullata da Ivo', (select p.nome from chiusure_cassa h join persone p on p.id = h.annullata_da where h.id = :'c6'), 'Ivo');
select impronta() as prima \gset
select atteso('c''è qualcosa da vedere: sei chiusure', (select count(*)::text from chiusure_cassa), '6');
select atteso(label || ': legge le chiusure', da_visto(utente, ruolo), voluto)
  from (values
    ('l''amministrazione', '22222222-2222-2222-2222-222222222222', 'authenticated', '6'),
    ('segreteria e amministrazione', '33333333-3333-3333-3333-333333333333', 'authenticated', '6'),
    ('amministrazione e istruttore', '44444444-4444-4444-4444-444444444444', 'authenticated', '6'),
    ('la segreteria senza il ruolo', '11111111-1111-1111-1111-111111111111', 'authenticated', '0'),
    ('l''istruttore', '55555555-5555-5555-5555-555555555555', 'authenticated', '0'),
    ('l''iscritto', '77777777-7777-7777-7777-777777777777', 'authenticated', '0'),
    ('il tablet di sala', '99999999-9999-9999-9999-999999999999', 'authenticated', '0'),
    ('un accesso senza scheda', '66666666-6666-6666-6666-666666666666', 'authenticated', '0'),
    ('chi non ha l''accesso', '', 'anon', 'NEGATO: permission denied for table chiusure_cassa')
  ) v(label, utente, ruolo, voluto);
select atteso(label || ': non scrive sulla tabella', da_scritture(utente, ruolo), '3/3')
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
-- Le due funzioni: «guardia / permesso tolto / altro».
select atteso(label || ': le due funzioni', da_chiamate(utente, ruolo), voluto)
  from (values
    ('l''amministrazione', '22222222-2222-2222-2222-222222222222', 'authenticated', '0/0/2'),
    ('segreteria e amministrazione', '33333333-3333-3333-3333-333333333333', 'authenticated', '0/0/2'),
    ('amministrazione e istruttore', '44444444-4444-4444-4444-444444444444', 'authenticated', '0/0/2'),
    ('la segreteria senza il ruolo', '11111111-1111-1111-1111-111111111111', 'authenticated', '2/0/0'),
    ('l''istruttore', '55555555-5555-5555-5555-555555555555', 'authenticated', '2/0/0'),
    ('l''iscritto', '77777777-7777-7777-7777-777777777777', 'authenticated', '2/0/0'),
    ('il tablet di sala', '99999999-9999-9999-9999-999999999999', 'authenticated', '2/0/0'),
    ('un accesso senza scheda', '66666666-6666-6666-6666-666666666666', 'authenticated', '2/0/0'),
    ('chi non ha l''accesso', '', 'anon', '0/2/0')
  ) v(label, utente, ruolo, voluto);
-- Con dati buoni, la segreteria senza il ruolo non cambia niente.
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria semplice non chiude la cassa', esito(format('select chiudi_cassa(dati => %L::jsonb)', chiusura('2026-09-24', 13888))), '42501 la contabilità la cura l’amministrazione');
select atteso('non annulla una chiusura', esito(format('select annulla_chiusura_cassa(id => %L)', :'c5')), '42501 la contabilità la cura l’amministrazione');
reset role;
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('l''istruttore nemmeno', esito(format('select chiudi_cassa(dati => %L::jsonb)', chiusura('2026-09-24', 13888))), '42501 la contabilità la cura l’amministrazione');
select atteso('né annulla', esito(format('select annulla_chiusura_cassa(id => %L)', :'c5')), '42501 la contabilità la cura l’amministrazione');
reset role;
select chi('99999999-9999-9999-9999-999999999999');
set role authenticated;
select atteso('il tablet di sala nemmeno', esito(format('select chiudi_cassa(dati => %L::jsonb)', chiusura('2026-09-24', 13888))), '42501 la contabilità la cura l’amministrazione');
reset role;
select chi('77777777-7777-7777-7777-777777777777');
set role authenticated;
select atteso('l''iscritto nemmeno', esito(format('select chiudi_cassa(dati => %L::jsonb)', chiusura('2026-09-24', 13888))), '42501 la contabilità la cura l’amministrazione');
reset role;
select chi('');
set role anon;
select atteso('chi non ha l''accesso non può nemmeno provarci', esito(format('select chiudi_cassa(dati => %L::jsonb)', chiusura('2026-09-24', 13888))), '42501 permission denied for function chiudi_cassa');
reset role;
select atteso('dopo tutti questi tentativi non è cambiato niente', impronta(), :'prima');

\echo ''
\echo '--- 10. la porta: RLS accesa, tutto tolto, ad authenticated solo la lettura ---'
select atteso('RLS accesa su chiusure_cassa', (select relrowsecurity::text from pg_class where relname = 'chiusure_cassa' and relnamespace = 'public'::regnamespace), 'true');
select atteso('authenticated ha solo SELECT', (select coalesce(string_agg(p, ',' order by p), 'niente') from unnest(array['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger']) p where has_table_privilege('authenticated', 'public.chiusure_cassa', p)), 'select');
select atteso('anon non ha niente', (select coalesce(string_agg(p, ',' order by p), 'niente') from unnest(array['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger']) p where has_table_privilege('anon', 'public.chiusure_cassa', p)), 'niente');
select atteso('l''unica policy è di lettura', (select string_agg(tablename || ':' || cmd, ', ' order by tablename) from pg_policies where schemaname = 'public' and tablename = 'chiusure_cassa'), 'chiusure_cassa:SELECT');
select atteso('le funzioni le chiama authenticated: le otto di prima e le due nuove', (select string_agg(p.proname, ', ' order by p.proname) from pg_proc p where p.pronamespace = 'public'::regnamespace and has_function_privilege('authenticated', p.oid, 'execute')
  and p.proname in ('salva_voce', 'rinomina_voce', 'imposta_voce_attiva', 'imposta_saldo_cassa', 'registra_movimento', 'registra_giroconto', 'annulla_movimento', 'correggi_testo_movimento', 'chiudi_cassa', 'annulla_chiusura_cassa', 'previsto_cassa')),
  'annulla_chiusura_cassa, annulla_movimento, chiudi_cassa, correggi_testo_movimento, imposta_saldo_cassa, imposta_voce_attiva, registra_giroconto, registra_movimento, rinomina_voce, salva_voce');
select atteso('anon non ne chiama nessuna', (select coalesce(string_agg(p.proname, ', ' order by p.proname), 'nessuna') from pg_proc p where p.pronamespace = 'public'::regnamespace and has_function_privilege('anon', p.oid, 'execute')
  and p.proname in ('registra_movimento', 'registra_giroconto', 'annulla_movimento', 'imposta_saldo_cassa', 'chiudi_cassa', 'annulla_chiusura_cassa', 'previsto_cassa')), 'nessuna');
select atteso('le due nuove sono security definer con il loro search_path', (select string_agg(p.proname, ', ' order by p.proname) from pg_proc p where p.pronamespace = 'public'::regnamespace
  and p.proname in ('chiudi_cassa', 'annulla_chiusura_cassa', 'previsto_cassa') and p.prosecdef and exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%')), 'annulla_chiusura_cassa, chiudi_cassa, previsto_cassa');
select atteso('…e la porta è la prima cosa', (select string_agg(p.proname, ', ' order by p.proname) from pg_proc p where p.pronamespace = 'public'::regnamespace
  and p.proname in ('chiudi_cassa', 'annulla_chiusura_cassa') and p.prosrc ~* 'contabilita_porta'), 'annulla_chiusura_cassa, chiudi_cassa');
select atteso('chiudi_cassa conta gli oggi di Roma e blocca la riga della cassa', (select (prosrc ~* 'contabilita_oggi' and prosrc ~* 'for update')::text from pg_proc where proname = 'chiudi_cassa' and pronamespace = 'public'::regnamespace), 'true');

\echo ''
\echo '--- 11. i vincoli della tabella tengono anche a mano ---'
select impronta() as prima \gset
select atteso('due chiusure attive per lo stesso giorno no', esito($$insert into chiusure_cassa (cassa_id, dal, data, previsto, contato, differenza) values ((select id from casse where nome = 'Cassa Contanti'), '2026-09-01', '2026-09-07', 0, 0, 0)$$), '23505 …');
select atteso('…una annullata invece sì', esito($$insert into chiusure_cassa (cassa_id, dal, data, previsto, contato, differenza, annullata_il) values ((select id from casse where nome = 'Cassa Contanti'), '2026-09-01', '2026-09-07', 123, 0, -123, now())$$), 'ok');
delete from chiusure_cassa where previsto = 123;
select atteso('contanti negativi no', esito($$insert into chiusure_cassa (cassa_id, dal, data, previsto, contato, differenza) values ((select id from casse where nome = 'Cassa Contanti'), '2026-09-01', '2027-01-01', 0, -1, -1)$$), '23514 …');
select atteso('una nota di 301 lettere no', esito($$insert into chiusure_cassa (cassa_id, dal, data, previsto, contato, differenza, nota) values ((select id from casse where nome = 'Cassa Contanti'), '2026-09-01', '2027-01-01', 0, 0, 0, repeat('n', 301))$$), '23514 …');
select atteso('senza cassa no', esito($$insert into chiusure_cassa (dal, data, previsto, contato, differenza) values ('2026-09-01', '2027-01-01', 0, 0, 0)$$), '23502 …');
select atteso('una cassa che non c''è no', esito($$insert into chiusure_cassa (cassa_id, dal, data, previsto, contato, differenza) values ('00000000-0000-0000-0000-000000000000', '2026-09-01', '2027-01-01', 0, 0, 0)$$), '23503 …');
select atteso('un movimento che non c''è no', esito($$insert into chiusure_cassa (cassa_id, dal, data, previsto, contato, differenza, movimento_id) values ((select id from casse where nome = 'Cassa Contanti'), '2026-09-01', '2027-01-01', 0, 0, 0, '00000000-0000-0000-0000-000000000000')$$), '23503 …');
select atteso('una cassa con chiusure non si cancella', esito($$delete from casse where nome = 'Cassa Contanti'$$), '23503 …');
select atteso('niente di tutto questo è entrato', impronta(), :'prima');

\echo ''
\echo '--- 12. chiusura e movimento nascono insieme o per niente ---'
-- Un blocco sul movimento (come un guasto a metà): la chiusura non deve restare.
create or replace function blocca_per_prova() returns trigger language plpgsql as $$
begin raise exception 'bloccato dalla prova'; end $$;
create trigger blocca_per_prova before insert on movimenti for each row execute function blocca_per_prova();
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('con la differenza che non si scrive, la chiusura salta', esito(format('select chiudi_cassa(dati => %L::jsonb)', chiusura('2026-09-24', 13000))), 'P0001 bloccato dalla prova');
select atteso('…senza differenza non serve il movimento: la chiusura va', esito(format('select chiudi_cassa(dati => %L::jsonb)', chiusura('2026-09-24', 13888))), 'ok');
reset role;
drop trigger blocca_per_prova on movimenti;
drop function blocca_per_prova();
select atteso('…è rimasta solo quella senza differenza', (select count(*)::text || ' ' || coalesce(sum(differenza), 0) from chiusure_cassa where data = '2026-09-24'), '1 0');
-- Per le prove che seguono: quella del 24 si annulla.
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('si annulla', esito(format('select annulla_chiusura_cassa(id => %L)', (select id from chiusure_cassa where data = '2026-09-24' and annullata_il is null))), 'ok');
reset role;

\echo ''
\echo '--- 13. il file si rilancia senza danni ---'
select impronta() as prima \gset
select (select count(*) from chiusure_cassa) as quante \gset
\i supabase/60-chiusura-cassa.sql
select atteso('rilanciato, i dati sono gli stessi', impronta(), :'prima');
select atteso('…le chiusure sono le stesse', (select count(*)::text from chiusure_cassa), :'quante');
select atteso('…le voci della differenza ancora due', (select count(*)::text from voci_contabili where nome = 'Differenza di cassa' and di_sistema), '2');
select atteso('…le voci di sistema in tutto quattro', (select count(*)::text from voci_contabili where di_sistema), '4');
select atteso('…i permessi sono gli stessi', (select coalesce(string_agg(p, ',' order by p), 'niente') from unnest(array['select', 'insert', 'update', 'delete']) p where has_table_privilege('authenticated', 'public.chiusure_cassa', p)), 'select');
select atteso('…anon ancora fuori', (select coalesce(string_agg(p.proname, ', '), 'nessuna') from pg_proc p where p.pronamespace = 'public'::regnamespace and has_function_privilege('anon', p.oid, 'execute')
  and p.proname in ('chiudi_cassa', 'annulla_chiusura_cassa', 'previsto_cassa', 'registra_movimento', 'annulla_movimento')), 'nessuna');
select atteso('…previsto_cassa ancora per nessuno', (select coalesce(string_agg(p.proname, ', '), 'nessuna') from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'previsto_cassa' and has_function_privilege('authenticated', p.oid, 'execute')), 'nessuna');
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('…e le regole dei giorni chiusi valgono ancora', esito(format('select registra_movimento(dati => %L::jsonb)', mov('entrata', '2026-09-07', 100, 'Donazioni', 'Cassa Contanti', 'Tardivo'))),
  '22023 Quel giorno è già chiuso: per correggere scrivi il movimento con una data dopo la chiusura e una voce di rettifica (si crea in VOCI), oppure annulla la chiusura');
select atteso('…anche quella della differenza', esito(format('select registra_movimento(dati => %L::jsonb)', mov('entrata', '2026-09-10', 100, 'Differenza di cassa', 'Conto Corrente', 'A mano'))),
  '22023 La «Differenza di cassa» si scrive da sola chiudendo la cassa');
select atteso('…e quella del saldo', esito(format('select imposta_saldo_cassa(id => %L, saldo => 10000, dal => %L)', id_cassa('Cassa Contanti'), '2026-09-01')),
  '22023 La cassa ha una chiusura: annullala prima di cambiare il saldo iniziale');
reset role;

\echo ''
\echo '--- 14. chi ha chiuso e poi se ne va: la chiusura resta, il suo nome no ---'
select chi('88888888-8888-8888-8888-888888888888');
set role authenticated;
select atteso('Teo chiude il 24 settembre: 3,00 in meno', esito(format('select chiudi_cassa(dati => %L::jsonb)', chiusura('2026-09-24', 13588, 'Controllato da Teo'))), 'ok');
reset role;
select id_chiusura('2026-09-24') as c7 \gset
select atteso('…chiusa da Teo, e il movimento è suo', (select p.nome || ' ' || q.nome from chiusure_cassa h join persone p on p.id = h.chiusa_da join movimenti m on m.id = h.movimento_id join persone q on q.id = m.creato_da where h.id = :'c7'), 'Teo Teo');
delete from persone where id = 'aaaaaaaa-0000-0000-0000-000000000008';
select atteso('la scheda di Teo sparisce: la chiusura c''è ancora, senza nome', (select (chiusa_da is null)::text || ' ' || differenza || ' ' || (movimento_id is not null)::text from chiusure_cassa where id = :'c7'), 'true -300 true');
select atteso('…e il suo movimento pure', (select (m.creato_da is null)::text || ' ' || m.importo from chiusure_cassa h join movimenti m on m.id = h.movimento_id where h.id = :'c7'), 'true 300');

\echo ''
\echo '--- 15. i casi al bordo: la cassa senza partenza, un previsto fuori scala, la voce già scritta a mano ---'
select chi('22222222-2222-2222-2222-222222222222');
-- Chi imposta la cassa senza giorno di partenza (qui a mano: con una chiusura attiva il saldo è bloccato).
reset role;
update casse set dal = null where nome = 'Cassa Contanti';
set role authenticated;
select atteso('senza giorno di partenza la cassa non si chiude: prima si imposta', esito(format('select chiudi_cassa(dati => %L::jsonb)', chiusura('2026-10-16', 0))), '22023 Imposta prima il saldo iniziale e il giorno di partenza della Cassa Contanti');
select atteso('…il Conto Corrente dice la sua prima', esito(format('select chiudi_cassa(dati => %L::jsonb)', chiusura('2026-10-16', 0, null, 'Conto Corrente'))), '22023 Si chiude solo la Cassa Contanti');
reset role;
update casse set dal = '2026-09-01' where nome = 'Cassa Contanti';
-- Due ricevute in contanti da 21 milioni di euro: il previsto non sta in un intero, e il rifiuto è per chi usa l'app.
insert into ricevute (anno, numero, data, persona_id, ente, intestatario, voci, totale, pagato, anticipo, annullata_il) values
  (2026, 90, '2026-10-16', 'aaaaaaaa-0000-0000-0000-000000000007', '{}', '{"nome": "Luca", "cognome": "Rossi"}',
    '[{"descrizione": "ALTRO", "quantita": 1, "prezzo": 2100000000, "pagamenti": [{"data": "2026-10-16", "importo": 2100000000, "metodo": "Contanti"}]}]', 2100000000, 2100000000, 0, null),
  (2026, 91, '2026-10-16', 'aaaaaaaa-0000-0000-0000-000000000007', '{}', '{"nome": "Luca", "cognome": "Rossi"}',
    '[{"descrizione": "ALTRO", "quantita": 1, "prezzo": 2100000000, "pagamenti": [{"data": "2026-10-16", "importo": 2100000000, "metodo": "Contanti"}]}]', 2100000000, 2100000000, 0, null);
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('un previsto fuori scala non è un errore grezzo', esito(format('select chiudi_cassa(dati => %L::jsonb)', chiusura('2026-10-16', 100))), '22023 Il previsto della Cassa Contanti non torna: controlla le ricevute in contanti');
reset role;
delete from ricevute where anno = 2026 and numero in (90, 91);
select atteso('previsto_cassa non va in overflow', (select (previsto_cassa(id_cassa('Cassa Contanti'), '2026-10-16') < 1000000000)::text), 'true');
-- Una voce «Differenza di cassa» scritta a mano prima del 60: il rilancio la fa di sistema, e la chiusura non cade.
update voci_contabili set di_sistema = false, attiva = false where nome = 'Differenza di cassa' and tipo = 'entrata';
\i supabase/60-chiusura-cassa.sql
select atteso('rilanciato il 60, la voce scritta a mano è di sistema e in uso', (select di_sistema::text || ' ' || attiva::text from voci_contabili where nome = 'Differenza di cassa' and tipo = 'entrata'), 'true true');
select atteso('annulla_movimento prende il blocco sulle casse come chiudi_cassa', (select (prosrc ~* 'for share')::text from pg_proc where proname = 'annulla_movimento' and pronamespace = 'public'::regnamespace), 'true');
