-- Lo scarico dei pagamenti Satispay del negozio (97-satispay-scarico.sql): entrano
-- da soli in CONTABILITÀ una volta sola, senza doppioni con quelli del modulo di
-- iscrizione (pagamenti_satispay) né con le entrate scritte a mano.
-- Le stesse regole di src/lib/satispayScarico.ts (applicaScarico), provate da
-- scripts/prova-satispay-scarico.mjs: stessi casi, stessi messaggi.
-- Ordine delle regole: modulo, poi i doppioni, poi il giorno chiuso, poi il movimento nuovo.
-- Parte dallo schema da sé: ricrea utenti e dati.
-- Si lancia dopo finto-supabase.sql e i file dello schema, fino a 97-satispay-scarico.sql.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

create or replace function atteso(cosa text, avuto text, voluto text) returns text language plpgsql as $$
begin
  if avuto is distinct from voluto and not (voluto like '%…' and avuto like replace(voluto, '…', '%')) then
    raise exception '% · atteso «%», avuto «%»', cosa, voluto, avuto;
  end if;
  return 'ok  ' || cosa || ' → ' || avuto;
end $$;
-- Se manca questo, 97-satispay-scarico.sql non è stato lanciato: la prova lo dice subito.
select (to_regclass('public.satispay_negozio') is not null and to_regclass('public.satispay_scarico') is not null)::text as c96 \gset
select atteso('97-satispay-scarico.sql è stato lanciato: ci sono le due tabelle', :'c96', 'true');

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'ada@ods.it'),
  ('55555555-5555-5555-5555-555555555555', 'maura@ods.it'),
  ('77777777-7777-7777-7777-777777777777', 'luca@ods.it'),
  ('99999999-9999-9999-9999-999999999999', 'tablet@ods.it');
-- Anna: solo segreteria. Ada: amministrazione. Maura: istruttore. Luca: iscritto.
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Ada', 'Conti', 'amministrazione', 'ada@ods.it', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'Maura', 'Uno', 'istruttore', 'maura@ods.it', '55555555-5555-5555-5555-555555555555'),
  ('aaaaaaaa-0000-0000-0000-000000000007', 'Luca', 'Rossi', 'iscritto', 'luca@ods.it', '77777777-7777-7777-7777-777777777777');
insert into sale (id, nome) values ('bbbbbbbb-0000-0000-0000-000000000001', 'Tatami');
insert into postazioni (id, nome, sala_id, utente_id) values
  ('dddddddd-0000-0000-0000-000000000001', 'Tablet', 'bbbbbbbb-0000-0000-0000-000000000001', '99999999-9999-9999-9999-999999999999');
-- Il Conto Corrente parte dal 1 settembre: prima, un pagamento non ha dove entrare.
update casse set dal = '2026-09-01' where nome = 'Conto Corrente';

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
-- Come finisce un'istruzione: «ok», oppure «codice messaggio» (42501 non tocca a te, 22023 i dati non vanno).
create or replace function esito(sql text) returns text language plpgsql as $$
begin execute sql; return 'ok';
exception when others then return sqlstate || ' ' || sqlerrm;
end $$;
-- Lancia come service_role (la Edge Function): torna il risultato, o «codice messaggio».
create or replace function servizio(sql text) returns text language plpgsql as $$
declare r text;
begin
  set role service_role;
  begin execute sql into r;
  exception when others then reset role; return sqlstate || ' ' || sqlerrm; end;
  reset role;
  return r;
end $$;
-- Come servizio(), ma per chi vuole un utente del sito e un ruolo: torna solo come finisce.
create or replace function come(utente text, ruolo text, sql text) returns text language plpgsql as $$
declare r text;
begin
  perform set_config('prova.utente', utente, false);
  execute format('set role %I', ruolo);
  r := esito(sql);
  reset role;
  return r;
end $$;
-- Come come(), ma torna quel che la select dà (o «codice messaggio»).
create or replace function come_vedo(utente text, ruolo text, sql text) returns text language plpgsql as $$
declare r text;
begin
  perform set_config('prova.utente', utente, false);
  execute format('set role %I', ruolo);
  begin execute sql into r; exception when others then r := sqlstate || ' ' || sqlerrm; end;
  reset role;
  return r;
end $$;
create or replace function come_leggo(utente text, ruolo text, tabella text) returns text language plpgsql as $$
declare r text;
begin
  perform set_config('prova.utente', utente, false);
  execute format('set role %I', ruolo);
  r := tenta('select count(*)::text from ' || tabella);
  reset role;
  return case when r like 'NEGATO%' or r = '0' then 'non legge' else r end;
end $$;

create or replace function id_cassa(n text) returns uuid language sql security definer set search_path = public as $$
  select id from casse where nome = n $$;
-- Un pagamento come lo dà Satispay.
create or replace function pag(id text, tipo text, stato text, importo int, quando text, chi text default null, descr text default null) returns jsonb language sql immutable as $$
  select jsonb_strip_nulls(jsonb_build_object('id', id, 'type', tipo, 'status', stato, 'amount_unit', importo,
    'insert_date', quando, 'sender', jsonb_build_object('name', chi), 'description', descr))
$$;
create or replace function sal(variadic p jsonb[]) returns text language sql as $$
  select servizio(format('select satispay_negozio_salva(%L::jsonb)', to_jsonb(p))) $$;
create or replace function app(scrivi boolean) returns jsonb language sql as $$
  select servizio(format('select satispay_negozio_applica(%L)', scrivi))::jsonb $$;
-- I conti di applica, chiave per chiave: incassi/rimborsi/modulo/a_mano/da_decidere/scritti.
create or replace function conti(j jsonb) returns text language sql immutable as $$
  select concat_ws('/', coalesce(j->>'incassi', '?'), coalesce(j->>'rimborsi', '?'), coalesce(j->>'modulo', '?'),
    coalesce(j->>'a_mano', '?'), coalesce(j->>'da_decidere', '?'), coalesce(j->>'scritti', '?')) $$;
-- Una entrata scritta a mano (voce «Corsi e altri pagamenti»), come la segreteria.
create or replace function a_mano(d text, i int, cassa text, descr text default 'Bonifico a mano') returns uuid
  language sql security definer set search_path = public as $$
  insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione)
  values ('entrata', d::date, i, (select id from voci_contabili where nome = 'Corsi e altri pagamenti' and tipo = 'entrata'), id_cassa(cassa), descr)
  returning id $$;
-- Si riparte da zero (come postgres, che l'RLS non ferma): niente pagamenti, movimenti, chiusure.
create or replace function pulisci() returns void language plpgsql security definer set search_path = public as $$
begin
  delete from satispay_negozio;
  delete from pagamenti_satispay;
  delete from pagamenti_diretti;
  delete from ricevute;
  delete from chiusure_cassa;
  delete from movimenti;
  insert into satispay_scarico (id) values (true) on conflict (id) do update
    set primo_fatto = false, ultimo = null, errore = null, ripresa = null, storia_completa = false;
end $$;
create or replace function esito_di(sid text) returns text language sql security definer set search_path = public as $$
  select coalesce(esito, 'senza esito') || '/' || coalesce(motivo, '-') from satispay_negozio where satispay_id = sid $$;
-- Il movimento con quel segno: «tipo|data|importo|cassa|voce|descrizione|creato_da», o «nessuno».
create or replace function mov_di(sid text) returns text language sql security definer set search_path = public as $$
  select coalesce((select concat_ws('|', m.tipo, m.data, m.importo, c.nome, v.nome, m.descrizione, coalesce(m.creato_da::text, 'nessuno'))
    from movimenti m join casse c on c.id = m.cassa_id left join voci_contabili v on v.id = m.voce_id where m.satispay_id = sid), 'nessuno') $$;
create or replace function n_mov() returns text language sql security definer set search_path = public as $$
  select count(*)::text from movimenti $$;
create or replace function n_mov_di(sid text) returns text language sql security definer set search_path = public as $$
  select count(*)::text from movimenti where satispay_id = sid $$;
create or replace function oggi_roma() returns text language sql stable as $$
  select ((now() at time zone 'Europe/Rome')::date)::text $$;
-- Tutto il contenuto, per accorgersi di una riga che cambia (anteprima).
create or replace function impronta() returns text language sql security definer set search_path = public as $$
  select md5(coalesce((select string_agg(m::text, '|' order by m.id) from movimenti m), '')
          || coalesce((select string_agg(n::text, '|' order by n.satispay_id) from satispay_negozio n), '')
          || coalesce((select string_agg(s::text, '|') from satispay_scarico s), '')) $$;
create or replace function candidati_di(sid text) returns text language sql security definer set search_path = public as $$
  select coalesce((select string_agg(x::text, ',' order by x::text) from satispay_negozio n, unnest(n.candidati) x where n.satispay_id = sid), 'nessuno') $$;

grant execute on function atteso(text, text, text), chi(text), tenta(text), esito(text), servizio(text), come(text, text, text), come_vedo(text, text, text), come_leggo(text, text, text),
  id_cassa(text), pag(text, text, text, int, text, text, text), sal(jsonb[]), app(boolean), conti(jsonb), a_mano(text, int, text, text), pulisci(),
  esito_di(text), mov_di(text), n_mov(), n_mov_di(text), oggi_roma(), impronta(), candidati_di(text) to anon, authenticated, service_role;

\echo ''
\echo '--- 1. la cassa Satispay e le voci ---'
select atteso('la cassa Satispay parte dal 1 gennaio 2025 con saldo 0 (116-satispay-separato.sql)', (select dal || ' ' || saldo_iniziale from casse where nome = 'Satispay'), '2025-01-01 0');
select atteso('«Da classificare» entrata e uscita',
  (select string_agg(tipo::text, ',' order by tipo) from voci_contabili where nome = 'Da classificare'), 'entrata,uscita');
select atteso('«Commissioni bancarie» è una voce di uscita', (select count(*)::text from voci_contabili where nome = 'Commissioni bancarie' and tipo = 'uscita'), '1');
select atteso('lo scarico è ancora da fare', coalesce((select primo_fatto::text from satispay_scarico), 'false'), 'false');

\echo ''
\echo '--- 2. un incasso entra una volta sola (R1, R2, R5) ---'
select pulisci();
select atteso('salva un pagamento nuovo: 1 nuovo', sal(pag('P1', 'TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-14T10:00:00Z', 'Mario Rossi')), '1');
select atteso('salvato di nuovo: nessun nuovo', sal(pag('P1', 'TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-14T10:00:00Z', 'Mario Rossi')), '0');
select atteso('applica: un incasso scritto', conti(app(true)), '1/0/0/0/0/1');
select atteso('l''incasso del 14 ottobre sta nella cassa Satispay, «Da classificare», con la descrizione e senza autore',
  mov_di('P1'), 'entrata|2026-10-14|1250|Satispay|Da classificare|Satispay · Mario Rossi|nessuno');
select atteso('esito scritto', esito_di('P1'), 'scritto/-');
select atteso('applica di fila: niente', conti(app(true)), '0/0/0/0/0/0');
select atteso('salva e applica ancora: un movimento solo', sal(pag('P1', 'TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-14T10:00:00Z', 'Mario Rossi')) || ' ' || conti(app(true)) || ' ' || n_mov_di('P1'), '0 0/0/0/0/0/0 1');
select atteso('salvato con un altro importo, dopo l''esito: non cambia', sal(pag('P1', 'TO_BUSINESS', 'ACCEPTED', 9999, '2026-10-14T10:00:00Z', 'Altro')) || ' ' || (select importo::text from satispay_negozio where satispay_id = 'P1'), '0 1250');
select atteso('senza nome: solo «Satispay»',
  (select sal(pag('P2', 'TO_BUSINESS', 'ACCEPTED', 300, '2026-10-15T09:00:00Z')) || ' ' || conti(app(true)) || ' ' || mov_di('P2')),
  '1 1/0/0/0/0/1 entrata|2026-10-15|300|Satispay|Da classificare|Satispay|nessuno');
select atteso('un incasso del 20 settembre entra in Satispay, non nel Conto Corrente',
  (select sal(pag('P3', 'TO_BUSINESS', 'ACCEPTED', 2000, '2026-09-20T10:00:00Z', 'Sara')) || ' ' || conti(app(true)) || ' ' || mov_di('P3')),
  '1 1/0/0/0/0/1 entrata|2026-09-20|2000|Satispay|Da classificare|Satispay · Sara|nessuno');
select atteso('un incasso del 15 settembre, senza altri movimenti: Satispay',
  (select sal(pag('P4', 'TO_BUSINESS', 'ACCEPTED', 700, '2026-09-15T10:00:00Z', 'Lia')) || ' ' || conti(app(true)) || ' ' || mov_di('P4')),
  '1 1/0/0/0/0/1 entrata|2026-09-15|700|Satispay|Da classificare|Satispay · Lia|nessuno');
select atteso('uno del 20 ottobre, dopo il vecchio cambio: Satispay',
  (select sal(pag('P5', 'TO_BUSINESS', 'ACCEPTED', 700, '2026-10-20T10:00:00Z', 'Lia')) || ' ' || conti(app(true)) || ' ' || mov_di('P5')),
  '1 1/0/0/0/0/1 entrata|2026-10-20|700|Satispay|Da classificare|Satispay · Lia|nessuno');

\echo ''
\echo '--- 3. il giorno è quello di Roma, l''importo in centesimi ---'
select atteso('le 23:30 a Roma del 14 sono già il 15',
  (select sal(pag('T1', 'TO_BUSINESS', 'ACCEPTED', 1234, '2026-10-14T22:30:00Z', 'Notte')) || ' ' || conti(app(true)) || ' ' || mov_di('T1')),
  '1 1/0/0/0/0/1 entrata|2026-10-15|1234|Satispay|Da classificare|Satispay · Notte|nessuno');
select atteso('30 settembre a mezzanotte e mezza a Roma è già il 1 ottobre: cassa Satispay',
  (select sal(pag('T2', 'TO_BUSINESS', 'ACCEPTED', 100, '2026-09-30T22:30:00Z', 'Cambio')) || ' ' || conti(app(true)) || ' ' || mov_di('T2')),
  '1 1/0/0/0/0/1 entrata|2026-10-01|100|Satispay|Da classificare|Satispay · Cambio|nessuno');
select atteso('le 21:30 del 30 settembre a Roma sono ancora settembre: Satispay lo stesso',
  (select sal(pag('T3', 'TO_BUSINESS', 'ACCEPTED', 100, '2026-09-30T19:30:00Z', 'Sera')) || ' ' || conti(app(true)) || ' ' || mov_di('T3')),
  '1 1/0/0/0/0/1 entrata|2026-09-30|100|Satispay|Da classificare|Satispay · Sera|nessuno');

\echo ''
\echo '--- 4. PENDING aspetta, CANCELED non entra mai (R2) ---'
select pulisci();
select atteso('un PENDING si salva', sal(pag('W1', 'TO_BUSINESS', 'PENDING', 1000, '2026-10-14T10:00:00Z', 'Attesa')), '1');
select atteso('applica: non entra', conti(app(true)) || ' ' || n_mov(), '0/0/0/0/0/0 0');
select atteso('resta senza esito', esito_di('W1'), 'senza esito/-');
select atteso('lo stesso pagamento, ora ACCEPTED (e per 11,00): il salva lo aggiorna', sal(pag('W1', 'TO_BUSINESS', 'ACCEPTED', 1100, '2026-10-14T10:00:00Z', 'Attesa')), '1');
select atteso('applica: ora entra, con l''importo nuovo', conti(app(true)) || ' ' || mov_di('W1'), '1/0/0/0/0/1 entrata|2026-10-14|1100|Satispay|Da classificare|Satispay · Attesa|nessuno');
select atteso('un CANCELED si salva', sal(pag('C1', 'TO_BUSINESS', 'CANCELED', 700, '2026-10-14T10:00:00Z', 'Annullato')), '1');
select atteso('applica: non entra', conti(app(true)) || ' ' || mov_di('C1') || ' ' || esito_di('C1'), '0/0/0/0/0/0 nessuno senza esito/-');
select atteso('e non entra al giro dopo', conti(app(true)) || ' ' || mov_di('C1'), '0/0/0/0/0/0 nessuno');

\echo ''
\echo '--- 5. un rimborso è un''uscita (R7) ---'
select pulisci();
select atteso('un rimborso del 16 ottobre',
  sal(pag('R1', 'REFUND_TO_BUSINESS', 'ACCEPTED', 500, '2026-10-16T10:00:00Z', 'Mario Rossi')) || ' ' || conti(app(true)) || ' ' || mov_di('R1'),
  '1 0/1/0/0/0/1 uscita|2026-10-16|500|Satispay|Da classificare|Rimborso Satispay · Mario Rossi|nessuno');
select atteso('la voce è «Da classificare» di uscita',
  (select v.tipo::text from movimenti m join voci_contabili v on v.id = m.voce_id where m.satispay_id = 'R1'), 'uscita');
select atteso('un rimborso non cerca doppioni: un''entrata a mano uguale non lo ferma',
  (select a_mano('2026-10-17', 800, 'Conto Corrente')::text is not null)::text || ' ' || sal(pag('R2', 'REFUND_TO_BUSINESS', 'ACCEPTED', 800, '2026-10-17T10:00:00Z', 'Pia')) || ' ' || conti(app(true)),
  'true 1 0/1/0/0/0/1');

\echo ''
\echo '--- 6. un pagamento del modulo di iscrizione non si ripete (R3, R4) ---'
select pulisci();
insert into pagamenti_satispay (chi, importo, stato, satispay_id, pagato_il) values ('Paolo Bianchi', 5000, 'pagato', 'M1', now());
select atteso('salva il pagamento che il modulo ha già', sal(pag('M1', 'TO_BUSINESS', 'ACCEPTED', 5000, '2026-10-14T10:00:00Z', 'Paolo')), '1');
select atteso('applica: esito modulo, niente movimenti', conti(app(true)) || ' ' || n_mov() || ' ' || esito_di('M1'), '0/0/1/0/0/0 0 modulo/-');
select atteso('al giro dopo non cambia', conti(app(true)) || ' ' || n_mov(), '0/0/0/0/0/0 0');
select atteso('la riga del modulo resta com''era', (select count(*)::text || stato from pagamenti_satispay group by stato), '1pagato');

\echo ''
\echo '--- 7. annullato resta annullato (R6) ---'
select pulisci();
select sal(pag('A1', 'TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-14T10:00:00Z', 'Mario')) as _;
select conti(app(true)) as _;
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('l''amministrazione annulla il movimento scaricato', esito(format('select annulla_movimento(id => %L)', (select id from movimenti where satispay_id = 'A1'))), 'ok');
reset role;
select atteso('un altro salva e applica: non torna', sal(pag('A1', 'TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-14T10:00:00Z', 'Mario')) || ' ' || conti(app(true)), '0 0/0/0/0/0/0');
select atteso('il movimento è uno, annullato', (select count(*)::text || ' ' || count(annullato_il)::text from movimenti where satispay_id = 'A1'), '1 1');

\echo ''
\echo '--- 8. un''entrata a mano uguale: doppione certo e dubbio ---'
select pulisci();
select a_mano('2026-10-14', 1250, 'Satispay', 'Bonifico di Mario') as m1 \gset
select atteso('doppione certo: il movimento a mano prende il segno, niente di nuovo',
  sal(pag('D1', 'TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-14T10:00:00Z', 'Mario')) || ' ' || conti(app(true)) || ' ' || n_mov() || ' ' || esito_di('D1'),
  '1 0/0/0/1/0/0 1 a_mano/-');
select atteso('…e il segno è sul movimento a mano', (select satispay_id from movimenti where id = :'m1'), 'D1');
select atteso('…e gli resta il suo nome', (select descrizione from movimenti where id = :'m1'), 'Bonifico di Mario');
select atteso('un altro giro non lo riprende', conti(app(true)) || ' ' || n_mov(), '0/0/0/0/0/0 1');

select pulisci();
select a_mano('2026-10-14', 1250, 'Satispay', 'Primo') as m1 \gset
select a_mano('2026-10-14', 1250, 'Satispay', 'Secondo') as m2 \gset
select atteso('doppione dubbio: due uguali',
  sal(pag('D2', 'TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-14T10:00:00Z', 'Mario')) || ' ' || conti(app(true)) || ' ' || n_mov() || ' ' || esito_di('D2'),
  '1 0/0/0/0/1/0 2 da_decidere/forse_doppione');
select atteso('…i candidati sono i due', candidati_di('D2'), (select string_agg(x, ',' order by x) from unnest(array[:'m1', :'m2']::text[]) x));
select atteso('…nessuno dei due ha il segno', (select count(*)::text from movimenti where satispay_id is not null), '0');
-- Le chiavi le legge statoScaricoSatispay in src/lib/segreteriaSupabase.ts (DaDecidere): una cambiata qui là diventa vuota.
select atteso('…lo stato lo dà con le chiavi che legge l''app',
  come_vedo('22222222-2222-2222-2222-222222222222', 'authenticated',
    'select (select string_agg(k, '','' order by k) from jsonb_object_keys(satispay_scarico_stato()->''da_decidere''->0) k) || ''|'' || (select string_agg(k, '','' order by k) from jsonb_object_keys(satispay_scarico_stato()->''da_decidere''->0->''candidati''->0) k)'),
  'candidati,chi,data,importo,motivo,satispay_id,tipo|cassa,descrizione,id,importo,voce');

select pulisci();
select a_mano('2026-10-14', 1250, 'Cassa Contanti', 'Contanti') as m1 \gset
select atteso('un''entrata in Cassa Contanti non è candidata: entra un movimento nuovo',
  sal(pag('D3', 'TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-14T10:00:00Z', 'Mario')) || ' ' || conti(app(true)) || ' ' || n_mov(),
  '1 1/0/0/0/0/1 2');
select atteso('un''entrata di un altro giorno o importo nemmeno',
  (select a_mano('2026-10-13', 777, 'Satispay')::text is not null)::text || ' ' || (select a_mano('2026-10-15', 888, 'Satispay')::text is not null)::text || ' '
  || sal(pag('D4', 'TO_BUSINESS', 'ACCEPTED', 777, '2026-10-15T10:00:00Z', 'Altro')) || ' ' || conti(app(true)),
  'true true 1 1/0/0/0/0/1');
select atteso('una già annullata non conta', (
  select a_mano('2026-10-16', 555, 'Satispay')::text is not null)::text, 'true');
update movimenti set annullato_il = now() where importo = 555;
select atteso('…quindi entra un movimento nuovo', sal(pag('D5', 'TO_BUSINESS', 'ACCEPTED', 555, '2026-10-16T10:00:00Z', 'Z')) || ' ' || conti(app(true)), '1 1/0/0/0/0/1');

-- Il caso reale: le entrate uguali nel Conto Corrente non sono candidate, il pagamento va in Satispay.
select pulisci();
select a_mano('2026-08-31', 5000, 'Conto Corrente', 'Bonifico ' || n) from generate_series(1, 4) n;
select atteso('31/08, 4 entrate a mano uguali in Conto Corrente: scritto in Satispay, non da decidere',
  sal(pag('K1', 'TO_BUSINESS', 'ACCEPTED', 5000, '2026-08-31T10:00:00Z', 'Reale')) || ' ' || conti(app(true)) || ' ' || esito_di('K1') || ' ' || mov_di('K1'),
  '1 1/0/0/0/0/1 scritto/- entrata|2026-08-31|5000|Satispay|Da classificare|Satispay · Reale|nessuno');
select atteso('…le 4 entrate restano senza segno', (select count(*)::text from movimenti where satispay_id is null), '4');
select pulisci();
select a_mano('2026-08-31', 5000, 'Conto Corrente', 'Bonifico') as m1 \gset
select atteso('una sola entrata uguale in Conto Corrente: scritto in Satispay, non a_mano',
  sal(pag('K2', 'TO_BUSINESS', 'ACCEPTED', 5000, '2026-08-31T10:00:00Z', 'Reale')) || ' ' || conti(app(true)) || ' ' || esito_di('K2') || ' ' || n_mov(),
  '1 1/0/0/0/0/1 scritto/- 2');
select atteso('…e l''entrata del Conto Corrente non ha il segno', (select coalesce(satispay_id, '-') from movimenti where id = :'m1'), '-');
select pulisci();
select a_mano('2026-08-31', 5000, 'Satispay', 'Uno') as m1 \gset
select a_mano('2026-08-31', 5000, 'Satispay', 'Due') as m2 \gset
select a_mano('2026-08-31', 5000, 'Conto Corrente', 'In banca') as m3 \gset
select atteso('2 entrate a mano in Satispay e una in Conto Corrente: da decidere, forse doppione',
  sal(pag('K3', 'TO_BUSINESS', 'ACCEPTED', 5000, '2026-08-31T10:00:00Z', 'Reale')) || ' ' || conti(app(true)) || ' ' || esito_di('K3'),
  '1 0/0/0/0/1/0 da_decidere/forse_doppione');
select atteso('…i candidati sono solo i due di Satispay', candidati_di('K3'), (select string_agg(x, ',' order by x) from unnest(array[:'m1', :'m2']::text[]) x));
select pulisci();
select a_mano('2026-08-31', 5000, 'Satispay', 'Uno') as m1 \gset
select a_mano('2026-08-31', 5000, 'Conto Corrente', 'In banca') as m2 \gset
select atteso('una in Satispay e una in Conto Corrente: a_mano con quella di Satispay',
  sal(pag('K4', 'TO_BUSINESS', 'ACCEPTED', 5000, '2026-08-31T10:00:00Z', 'Reale')) || ' ' || conti(app(true)) || ' ' || esito_di('K4'),
  '1 0/0/0/1/0/0 a_mano/-');
-- In un'altra select: nella stessa, il movimento si legge com'era prima dello scarico.
select atteso('…collegata a quella di Satispay', (select satispay_id from movimenti where id = :'m1'), 'K4');
select atteso('…quella del Conto Corrente no', (select coalesce(satispay_id, '-') from movimenti where id = :'m2'), '-');

select pulisci();
select a_mano('2026-10-14', 1250, 'Satispay', 'Uno solo') as m1 \gset
select atteso('due pagamenti uguali, un movimento a mano: il primo lo prende, il secondo entra nuovo',
  sal(pag('E1', 'TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-14T09:00:00Z', 'Primo'), pag('E2', 'TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-14T11:00:00Z', 'Secondo'))
  || ' ' || conti(app(true)) || ' ' || esito_di('E1') || ' ' || esito_di('E2') || ' ' || n_mov(),
  '2 1/0/0/1/0/1 a_mano/- scritto/- 2');
select atteso('…il segno del movimento a mano è del primo', (select satispay_id from movimenti where id = :'m1'), 'E1');

\echo ''
\echo '--- 9. giorno chiuso, prima della cassa ---'
select pulisci();
insert into chiusure_cassa (cassa_id, dal, data, previsto, contato, differenza) values (id_cassa('Satispay'), '2026-10-01', '2026-10-15', 0, 0, 0);
select atteso('il 14 ottobre la cassa Satispay è chiusa: da decidere, niente movimento',
  sal(pag('G1', 'TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-14T10:00:00Z', 'Mario')) || ' ' || conti(app(true)) || ' ' || n_mov() || ' ' || esito_di('G1'),
  '1 0/0/0/0/1/0 0 da_decidere/giorno_chiuso');
select atteso('un giorno dopo la chiusura entra', sal(pag('G2', 'TO_BUSINESS', 'ACCEPTED', 100, '2026-10-16T10:00:00Z', 'Dopo')) || ' ' || conti(app(true)), '1 1/0/0/0/0/1');
select atteso('un rimborso in un giorno chiuso aspetta anche lui',
  sal(pag('G3', 'REFUND_TO_BUSINESS', 'ACCEPTED', 100, '2026-10-15T10:00:00Z', 'Via')) || ' ' || conti(app(true)) || ' ' || esito_di('G3'), '1 0/0/0/0/1/0 da_decidere/giorno_chiuso');
-- Chiusa solo la cassa Conto Corrente (fino al 20): un pagamento del 17, che per Satispay è aperto, entra.
insert into chiusure_cassa (cassa_id, dal, data, previsto, contato, differenza) values (id_cassa('Conto Corrente'), '2026-09-01', '2026-10-20', 0, 0, 0);
select atteso('chiusa solo la cassa Conto Corrente: il pagamento entra in Satispay',
  sal(pag('G5', 'TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-17T10:00:00Z', 'Mario')) || ' ' || conti(app(true)) || ' ' || esito_di('G5'), '1 1/0/0/0/0/1 scritto/-');
-- Il doppione certo viene prima del giorno chiuso: non cambia i conti, il soldo è già scritto.
select a_mano('2026-10-12', 4200, 'Satispay', 'Già scritto') as m1 \gset
select atteso('un doppione certo in un giorno chiuso è a_mano, non da decidere',
  sal(pag('G4', 'TO_BUSINESS', 'ACCEPTED', 4200, '2026-10-12T10:00:00Z', 'Mario')) || ' ' || conti(app(true)) || ' ' || esito_di('G4'), '1 0/0/0/1/0/0 a_mano/-');
-- Prima dell'inizio della cassa Satispay (1 gennaio 2025).
select atteso('un pagamento del 20 dicembre 2024 è prima della cassa Satispay: fuori, niente movimento',
  sal(pag('B1', 'TO_BUSINESS', 'ACCEPTED', 900, '2024-12-20T10:00:00Z', 'Vecchio')) || ' ' || esito_di('B1'), '1 senza esito/-');
select app(true) as giro \gset
select atteso('…applica lo manda fuori, e nei conti conta «prima» senza toccare gli scritti',
  (:'giro'::jsonb->>'prima') || ' ' || conti(:'giro'::jsonb) || ' ' || esito_di('B1') || ' ' || mov_di('B1'),
  '1 0/0/0/0/0/0 fuori/prima_della_cassa nessuno');

\echo ''
\echo '--- 10. satispay_decidi ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('«oggi» su G1: scrive con la data di oggi, nella cassa Satispay', esito($$select satispay_decidi('G1', 'oggi')$$), 'ok');
reset role;
select atteso('…il movimento è di oggi', mov_di('G1'), 'entrata|' || oggi_roma() || '|1250|Satispay|Da classificare|Satispay · Mario|aaaaaaaa-0000-0000-0000-000000000002');
select atteso('…esito scritto', esito_di('G1'), 'scritto/giorno_chiuso');
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('già deciso', esito($$select satispay_decidi('G1', 'oggi')$$), '22023 Questo pagamento è già deciso');
select atteso('anche «fuori» su un pagamento già deciso', esito($$select satispay_decidi('G1', 'fuori')$$), '22023 Questo pagamento è già deciso');
select atteso('«fuori» su G3 (giorno chiuso)', esito($$select satispay_decidi('G3', 'fuori')$$), 'ok');
reset role;
select atteso('…esito fuori, niente movimento', esito_di('G3') || ' ' || mov_di('G3'), 'fuori/giorno_chiuso nessuno');

select pulisci();
select a_mano('2026-10-14', 1250, 'Satispay', 'Primo') as m1 \gset
select a_mano('2026-10-14', 1250, 'Satispay', 'Secondo') as m2 \gset
select a_mano('2026-10-14', 1300, 'Satispay', 'Un altro importo') as m3 \gset
select sal(pag('H1', 'TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-14T10:00:00Z', 'Mario'), pag('H2', 'TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-14T12:00:00Z', 'Mario')) as _;
select conti(app(true)) as _;
select atteso('i due sono da decidere (forse doppione)', esito_di('H1') || ' ' || esito_di('H2'), 'da_decidere/forse_doppione da_decidere/forse_doppione');
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('«a_mano» con un movimento che non è fra i candidati: no', esito(format('select satispay_decidi(%L, %L, %L)', 'H1', 'a_mano', :'m3')), '22023…');
select atteso('«a_mano» con un candidato', esito(format('select satispay_decidi(%L, %L, %L)', 'H1', 'a_mano', :'m1')), 'ok');
reset role;
select atteso('…il candidato prende il segno', (select satispay_id from movimenti where id = :'m1'), 'H1');
select atteso('…esito a_mano', esito_di('H1'), 'a_mano/forse_doppione');
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('H2 non può prendere un movimento che ha già il segno', esito(format('select satispay_decidi(%L, %L, %L)', 'H2', 'a_mano', :'m1')), '22023…');
select atteso('«scrivi» su H2: movimento nuovo', esito($$select satispay_decidi('H2', 'scrivi')$$), 'ok');
reset role;
select atteso('…con la sua data (14 ottobre), firmato da chi ha deciso', mov_di('H2'), 'entrata|2026-10-14|1250|Satispay|Da classificare|Satispay · Mario|aaaaaaaa-0000-0000-0000-000000000002');
select atteso('…esito scritto', esito_di('H2'), 'scritto/forse_doppione');

-- Un forse doppione che nel frattempo diventa giorno chiuso: «scrivi» non basta.
select pulisci();
select a_mano('2026-10-14', 1250, 'Satispay', 'Primo') as m1 \gset
select a_mano('2026-10-14', 1250, 'Satispay', 'Secondo') as m2 \gset
select sal(pag('K1', 'TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-14T10:00:00Z', 'Mario')) as _;
select conti(app(true)) as _;
insert into chiusure_cassa (cassa_id, dal, data, previsto, contato, differenza) values (id_cassa('Satispay'), '2026-10-01', '2026-10-15', 0, 0, 0);
select atteso('«scrivi» in un giorno nel frattempo chiuso: scrivilo oggi',
  come('22222222-2222-2222-2222-222222222222', 'authenticated', $$select satispay_decidi('K1', 'scrivi')$$), '22023 Quel giorno la cassa è chiusa: scrivilo oggi');
-- Un forse doppione di un giorno che nel frattempo è prima dell'inizio della cassa: «scrivi» non lo mette dove la cassa non c'è.
delete from chiusure_cassa;
update casse set dal = '2026-10-15' where nome = 'Satispay';
select atteso('«scrivi» prima dell''inizio della cassa: scrivilo oggi',
  come('22222222-2222-2222-2222-222222222222', 'authenticated', $$select satispay_decidi('K1', 'scrivi')$$), '22023 Quel giorno la cassa non c’era ancora: scrivilo oggi');
update casse set dal = '2025-01-01' where nome = 'Satispay';

\echo ''
\echo '--- 11. anteprima: stessi conti, niente cambia (R10) ---'
select pulisci();
update casse set dal = '2026-09-01' where nome = 'Conto Corrente';
insert into pagamenti_satispay (chi, importo, stato, satispay_id, pagato_il) values ('Paolo', 5000, 'pagato', 'AM', now());
select a_mano('2026-10-14', 1250, 'Satispay', 'Già scritto') as m1 \gset
insert into chiusure_cassa (cassa_id, dal, data, previsto, contato, differenza) values (id_cassa('Satispay'), '2026-10-01', '2026-10-12', 0, 0, 0);
select sal(
  pag('N1', 'TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-14T10:00:00Z', 'A mano'),
  pag('N2', 'TO_BUSINESS', 'ACCEPTED', 800, '2026-10-16T10:00:00Z', 'Nuovo'),
  pag('AM', 'TO_BUSINESS', 'ACCEPTED', 5000, '2026-10-13T10:00:00Z', 'Modulo'),
  pag('N4', 'TO_BUSINESS', 'ACCEPTED', 3000, '2026-10-10T10:00:00Z', 'Chiuso'),
  pag('N5', 'REFUND_TO_BUSINESS', 'ACCEPTED', 200, '2026-10-17T10:00:00Z', 'Rimborso'),
  pag('N6', 'TO_BUSINESS', 'PENDING', 400, '2026-10-17T10:00:00Z', 'Attesa')) as _;
select impronta() as prima \gset
select app(false) as ante \gset
select atteso('l''anteprima dà i conti', conti(:'ante'::jsonb), '1/1/1/1/1/2');
select atteso('…e non cambia niente: movimenti, esiti, segni, primo_fatto', impronta(), :'prima');
select atteso('…primo_fatto è ancora falso', (select primo_fatto::text from satispay_scarico), 'false');
select app(true) as vero \gset
select atteso('applica(true): gli stessi conti dell''anteprima', conti(:'vero'::jsonb), conti(:'ante'::jsonb));
select atteso('…e adesso cambia qualcosa', (impronta() is distinct from :'prima')::text, 'true');
select atteso('…primo_fatto è vero', (select primo_fatto::text from satispay_scarico), 'true');
select atteso('…il PENDING resta senza esito', esito_di('N6'), 'senza esito/-');

\echo ''
\echo '--- 12. chi legge e chi decide: solo l''amministrazione ---'
-- Qui c''è almeno una riga per tabella (sezione 11).
select atteso('l''amministrazione legge i pagamenti', come_leggo('22222222-2222-2222-2222-222222222222', 'authenticated', 'satispay_negozio'), '6');
select atteso('…e lo stato dello scarico', come_leggo('22222222-2222-2222-2222-222222222222', 'authenticated', 'satispay_scarico'), '1');
select atteso('…e vede cosa c''è da decidere',
  (come_vedo('22222222-2222-2222-2222-222222222222', 'authenticated', 'select satispay_scarico_stato()->>''primo_fatto''')), 'true');
select atteso('…ruoli: la segreteria semplice non legge i pagamenti', come_leggo('11111111-1111-1111-1111-111111111111', 'authenticated', 'satispay_negozio'), 'non legge');
select atteso('…né lo stato', come_leggo('11111111-1111-1111-1111-111111111111', 'authenticated', 'satispay_scarico'), 'non legge');
select atteso('l''istruttore non legge i pagamenti', come_leggo('55555555-5555-5555-5555-555555555555', 'authenticated', 'satispay_negozio'), 'non legge');
select atteso('…né lo stato', come_leggo('55555555-5555-5555-5555-555555555555', 'authenticated', 'satispay_scarico'), 'non legge');
select atteso('l''iscritto non legge i pagamenti', come_leggo('77777777-7777-7777-7777-777777777777', 'authenticated', 'satispay_negozio'), 'non legge');
select atteso('…né lo stato', come_leggo('77777777-7777-7777-7777-777777777777', 'authenticated', 'satispay_scarico'), 'non legge');
select atteso('il tablet non legge i pagamenti', come_leggo('99999999-9999-9999-9999-999999999999', 'authenticated', 'satispay_negozio'), 'non legge');
select atteso('…né lo stato', come_leggo('99999999-9999-9999-9999-999999999999', 'authenticated', 'satispay_scarico'), 'non legge');
select atteso('anon non legge i pagamenti', come_leggo('', 'anon', 'satispay_negozio'), 'non legge');
select atteso('…né lo stato', come_leggo('', 'anon', 'satispay_scarico'), 'non legge');
-- Le due funzioni dell'app: chi non è amministrazione si sente dire di no (42501, porta o permesso tolto).
select atteso('segreteria semplice: non decide', left(come('11111111-1111-1111-1111-111111111111', 'authenticated', $$select satispay_decidi('N4', 'fuori')$$), 5), '42501');
select atteso('segreteria semplice: non vede lo stato', left(come('11111111-1111-1111-1111-111111111111', 'authenticated', 'select satispay_scarico_stato()'), 5), '42501');
select atteso('istruttore: non decide', left(come('55555555-5555-5555-5555-555555555555', 'authenticated', $$select satispay_decidi('N4', 'fuori')$$), 5), '42501');
select atteso('istruttore: non vede lo stato', left(come('55555555-5555-5555-5555-555555555555', 'authenticated', 'select satispay_scarico_stato()'), 5), '42501');
select atteso('iscritto: non decide', left(come('77777777-7777-7777-7777-777777777777', 'authenticated', $$select satispay_decidi('N4', 'fuori')$$), 5), '42501');
select atteso('iscritto: non vede lo stato', left(come('77777777-7777-7777-7777-777777777777', 'authenticated', 'select satispay_scarico_stato()'), 5), '42501');
select atteso('tablet: non decide', left(come('99999999-9999-9999-9999-999999999999', 'authenticated', $$select satispay_decidi('N4', 'fuori')$$), 5), '42501');
select atteso('tablet: non vede lo stato', left(come('99999999-9999-9999-9999-999999999999', 'authenticated', 'select satispay_scarico_stato()'), 5), '42501');
select atteso('anon: non decide', left(come('', 'anon', $$select satispay_decidi('N4', 'fuori')$$), 5), '42501');
select atteso('anon: non vede lo stato', left(come('', 'anon', 'select satispay_scarico_stato()'), 5), '42501');
select atteso('N4 è ancora da decidere dopo tutti questi no', esito_di('N4'), 'da_decidere/giorno_chiuso');
-- Le quattro funzioni del servizio non le chiama nessun utente, nemmeno l'amministrazione.
select atteso('amministrazione: non salva', left(come('22222222-2222-2222-2222-222222222222', 'authenticated', $$select satispay_negozio_salva('[]'::jsonb)$$), 5), '42501');
select atteso('amministrazione: non applica', left(come('22222222-2222-2222-2222-222222222222', 'authenticated', 'select satispay_negozio_applica(false)'), 5), '42501');
select atteso('amministrazione: non segna', left(come('22222222-2222-2222-2222-222222222222', 'authenticated', 'select satispay_scarico_segna(null::text)'), 5), '42501');
select atteso('amministrazione: non scrive la ripresa', left(come('22222222-2222-2222-2222-222222222222', 'authenticated', $$select satispay_scarico_ripresa('x', false)$$), 5), '42501');
select atteso('anon: non salva', left(come('', 'anon', $$select satispay_negozio_salva('[]'::jsonb)$$), 5), '42501');
select atteso('anon: non applica', left(come('', 'anon', 'select satispay_negozio_applica(true)'), 5), '42501');
select atteso('segreteria: non applica', left(come('11111111-1111-1111-1111-111111111111', 'authenticated', 'select satispay_negozio_applica(true)'), 5), '42501');
select atteso('nessuno scrive dritto sulla tabella',
  (select count(*)::text from unnest(array[
    come('22222222-2222-2222-2222-222222222222', 'authenticated', $$update satispay_negozio set esito = 'fuori'$$),
    come('22222222-2222-2222-2222-222222222222', 'authenticated', $$delete from satispay_negozio$$),
    come('22222222-2222-2222-2222-222222222222', 'authenticated', $$update satispay_scarico set primo_fatto = true$$)]) r
    where r like '42501 permission denied%'), '3');

\echo ''
\echo '--- 13. il servizio segna come è andata e dove è arrivato ---'
select atteso('segna un errore', coalesce(servizio($$select satispay_scarico_segna('Satispay non risponde')$$), 'fatto'), 'fatto');
select atteso('…ultimo ed errore', (select (ultimo is not null)::text || ' ' || errore from satispay_scarico), 'true Satispay non risponde');
select servizio($$select satispay_scarico_segna(null::text)$$) as _;
select atteso('andato bene: l''errore sparisce', (select (ultimo is not null)::text || ' ' || coalesce(errore, 'nessuno') from satispay_scarico), 'true nessuno');
select servizio($$select satispay_scarico_ripresa('pagamento-9', true)$$) as _;
select atteso('la ripresa e la storia completa', (select ripresa || ' ' || storia_completa from satispay_scarico), 'pagamento-9 true');
select atteso('lo stato elenca i pagamenti da decidere con il motivo',
  come_vedo('22222222-2222-2222-2222-222222222222', 'authenticated', 'select string_agg(r->>''motivo'', '','') from jsonb_array_elements(satispay_scarico_stato()->''da_decidere'') r'), 'giorno_chiuso');

\echo ''
\echo '--- 14. salva lascia fuori quel che non è un pagamento ---'
select pulisci();
select atteso('un tipo che non conosciamo, un importo zero, un id vuoto: nessuno entra',
  sal(pag('X1', 'PAYOUT', 'ACCEPTED', 1000, '2026-10-14T10:00:00Z'), pag('X2', 'TO_BUSINESS', 'ACCEPTED', 0, '2026-10-14T10:00:00Z'), pag('', 'TO_BUSINESS', 'ACCEPTED', 500, '2026-10-14T10:00:00Z'))
  || ' ' || (select count(*)::text from satispay_negozio), '0 0');

\echo ''
\echo '--- 15. già scritto in PAGAMENTI col metodo Satispay (fatto in palestra col QR) ---'
-- Le righe di PAGAMENTI: i pagamenti a mano e quelli dentro le ricevute, non annullati, non del modulo.
create or replace function diretto(d text, i int, metodo text default 'Satispay', annullato boolean default false) returns void
  language sql security definer set search_path = public as $$
  insert into pagamenti_diretti (persona_id, data, importo, metodo, voce, annullato_il)
  values ('aaaaaaaa-0000-0000-0000-000000000007', d::date, i, metodo, 'Karate', case when annullato then now() end) $$;
create or replace function ricevuta(n int, d text, i int, annullata boolean default false) returns uuid
  language sql security definer set search_path = public as $$
  insert into ricevute (anno, numero, data, persona_id, ente, intestatario, voci, totale, pagato, annullata_il)
  values (2026, n, d::date, 'aaaaaaaa-0000-0000-0000-000000000007', '{}', '{"nome": "Luca", "cognome": "Rossi"}',
    jsonb_build_array(jsonb_build_object('descrizione', 'Karate', 'quantita', 1, 'prezzo', i,
      'pagamenti', jsonb_build_array(jsonb_build_object('data', d, 'importo', i, 'metodo', 'Satispay')))), i, i,
    case when annullata then now() end)
  returning id $$;
grant execute on function diretto(text, int, text, boolean), ricevuta(int, text, int, boolean) to anon, authenticated, service_role;

select pulisci();
select diretto('2026-10-14', 1250, ' SATISPAY ') as _;
select sal(pag('Q1', 'TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-14T10:00:00Z', 'Luca')) as _;
select app(true) as giro \gset
select atteso('un pagamento a mano col metodo Satispay, stesso giorno e importo: già scritto, niente movimento',
  conti(:'giro'::jsonb) || ' +' || (:'giro'::jsonb->>'pagamenti') || ' ' || esito_di('Q1') || ' ' || n_mov(), '0/0/0/0/0/0 +1 pagamenti/- 0');
select atteso('…un secondo pagamento uguale entra: la riga di PAGAMENTI è già presa',
  sal(pag('Q2', 'TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-14T12:00:00Z', 'Altro')) || ' ' || conti(app(true)) || ' ' || esito_di('Q2'), '1 1/0/0/0/0/1 scritto/-');

select pulisci();
select diretto('2026-10-14', 1250, 'Satispay', true) as _;
select diretto('2026-10-14', 1250, 'POS') as _;
select diretto('2026-10-13', 1250) as _;
select atteso('annullato, un altro metodo, un altro giorno: non contano',
  sal(pag('Q3', 'TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-14T10:00:00Z')) || ' ' || conti(app(true)) || ' ' || esito_di('Q3'), '1 1/0/0/0/0/1 scritto/-');

select pulisci();
select ricevuta(901, '2026-10-14', 3000) as _;
select atteso('un pagamento Satispay dentro una ricevuta: già scritto',
  sal(pag('Q4', 'TO_BUSINESS', 'ACCEPTED', 3000, '2026-10-14T10:00:00Z')) || ' ' || conti(app(true)) || ' ' || esito_di('Q4') || ' ' || n_mov(), '1 0/0/0/0/0/0 pagamenti/- 0');
select ricevuta(902, '2026-10-15', 3000, true) as _;
select atteso('…in una ricevuta annullata: non conta',
  sal(pag('Q5', 'TO_BUSINESS', 'ACCEPTED', 3000, '2026-10-15T10:00:00Z')) || ' ' || conti(app(true)) || ' ' || esito_di('Q5'), '1 1/0/0/0/0/1 scritto/-');
-- La ricevuta del modulo di iscrizione è del suo pagamento (esito modulo), non di un altro uguale.
select ricevuta(903, '2026-10-16', 4000) as rm \gset
insert into pagamenti_satispay (chi, importo, stato, satispay_id, pagato_il, ricevuta_id) values ('Luca', 4000, 'pagato', 'QM', now(), :'rm');
select atteso('…la ricevuta del modulo non conta per un altro pagamento uguale',
  sal(pag('QM', 'TO_BUSINESS', 'ACCEPTED', 4000, '2026-10-16T09:00:00Z'), pag('Q6', 'TO_BUSINESS', 'ACCEPTED', 4000, '2026-10-16T10:00:00Z')) || ' ' || conti(app(true)) || ' ' || esito_di('QM') || ' ' || esito_di('Q6'),
  '2 1/0/1/0/0/1 modulo/- scritto/-');

select pulisci();
select diretto('2026-10-16', 800) as _;
select atteso('un rimborso non guarda PAGAMENTI: è un''uscita',
  sal(pag('Q7', 'REFUND_TO_BUSINESS', 'ACCEPTED', 800, '2026-10-16T10:00:00Z')) || ' ' || conti(app(true)) || ' ' || esito_di('Q7'), '1 0/1/0/0/0/1 scritto/-');

select pulisci();
select diretto('2026-10-14', 1250) as _;
select a_mano('2026-10-14', 1250, 'Satispay', 'Scritto anche qui') as m1 \gset
select atteso('PAGAMENTI viene prima di un movimento a mano uguale: quello resta senza segno',
  sal(pag('Q8', 'TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-14T10:00:00Z')) || ' ' || conti(app(true)) || ' ' || esito_di('Q8') || ' ' || coalesce((select satispay_id from movimenti where id = :'m1'), '-'),
  '1 0/0/0/0/0/0 pagamenti/- -');

\echo ''
\echo '--- 16. i pagamenti di oggi aspettano domani ---'
select pulisci();
select atteso('un pagamento di oggi resta senza esito: la palestra può ancora scriverlo in PAGAMENTI',
  sal(pag('O1', 'TO_BUSINESS', 'ACCEPTED', 1250, to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))) || ' ' || conti(app(true)) || ' ' || esito_di('O1') || ' ' || n_mov(),
  '1 0/0/0/0/0/0 senza esito/- 0');

\echo ''
\echo '--- 17. senza la voce «Da classificare»: un errore che dice cosa fare ---'
select pulisci();
update voci_contabili set nome = 'Da classificare (vecchia)' where nome = 'Da classificare' and tipo = 'entrata';
select sal(pag('V1', 'TO_BUSINESS', 'ACCEPTED', 100, '2026-10-14T10:00:00Z')) as _;
select atteso('applica non scrive un movimento senza voce: lo dice',
  servizio('select satispay_negozio_applica(true)::text'), 'P0001 Manca la voce «Da classificare» di entrata: rimettila in CONTABILITÀ → VOCI');
update voci_contabili set nome = 'Da classificare' where nome = 'Da classificare (vecchia)';


\echo ''
\echo '--- 18. i conti di applica arrivano tali e quali nell''avviso alla segreteria ---'
-- Se applica cambia nome a una chiave, l'avviso uscirebbe con gli zeri: qui i conti sono quelli veri.
select pulisci();
delete from avvisi_segreteria;
update avvisi_indirizzi set a = 'segreteria@officinedellosport.it';
select sal(pag('A1', 'TO_BUSINESS', 'ACCEPTED', 1000, '2026-10-14T10:00:00Z'), pag('A2', 'REFUND_TO_BUSINESS', 'ACCEPTED', 400, '2026-10-14T11:00:00Z')) as _;
select servizio(format('select satispay_scarico_avvisa(%L::jsonb, null)', app(true))) as _;
select atteso('un incasso e un rimborso, niente da decidere',
  (select concat_ws(',', a->>'incassi', a->>'rimborsi', a->>'daDecidere') from (select avviso_da_registro(v) a from avvisi_segreteria v) x), '1,1,0');
delete from avvisi_segreteria;


\echo ''
\echo '--- 19. la descrizione di Satispay (il commento) si salva, e si completa anche su un pagamento già deciso ---'
select pulisci();
select sal(pag('D1', 'TO_BUSINESS', 'ACCEPTED', 500, '2026-10-14T10:00:00Z', 'Mario Rossi', 'Quota ottobre'), pag('D2', 'TO_BUSINESS', 'ACCEPTED', 700, '2026-10-14T11:00:00Z')) as _;
select atteso('la descrizione arriva', (select descrizione from satispay_negozio where satispay_id = 'D1'), 'Quota ottobre');
select atteso('senza descrizione resta vuota', ((select descrizione from satispay_negozio where satispay_id = 'D2') is null)::text, 'true');
-- D1 viene deciso: un secondo giro con la descrizione cambiata non tocca niente, ma D2 la prende ora.
select app(true) as _;
select atteso('D1 è deciso', (select esito from satispay_negozio where satispay_id = 'D1'), 'scritto');
select sal(pag('D1', 'TO_BUSINESS', 'ACCEPTED', 500, '2026-10-14T10:00:00Z', 'Mario Rossi', 'Altro testo'), pag('D2', 'TO_BUSINESS', 'ACCEPTED', 700, '2026-10-14T11:00:00Z', null, 'Arrivata dopo')) as _;
select atteso('una descrizione già salvata non cambia', (select descrizione from satispay_negozio where satispay_id = 'D1'), 'Quota ottobre');
select atteso('una che mancava si completa anche se deciso', (select descrizione from satispay_negozio where satispay_id = 'D2'), 'Arrivata dopo');
select sal(pag('D3', 'TO_BUSINESS', 'ACCEPTED', 900, '2026-10-14T12:00:00Z', null, repeat('x', 300))) as _;
select atteso('lunga più di 200 caratteri: si taglia', length((select descrizione from satispay_negozio where satispay_id = 'D3'))::text, '200');
