-- Lo scarico dei pagamenti Satispay del negozio (97-satispay-scarico.sql, cambiato da
-- 132-satispay-solo-chi-ha-pagato.sql): dice solo chi ha pagato. Non scrive né collega
-- movimenti: i soldi sono nel versamento in banca (IMPORTA BANCA, voce «Incassi Satispay»),
-- e la cassa Satispay è chiusa. Un pagamento è del modulo di iscrizione (pagamenti_satispay),
-- è già in PAGAMENTI, o è `fuori` con motivo `nel_versamento`. Niente più «da decidere».
-- Le stesse regole di src/lib/satispayScarico.ts (applicaScarico), provate da
-- scripts/prova-satispay-scarico.mjs: stessi casi, stessi messaggi.
-- Ordine delle regole: modulo, poi PAGAMENTI, poi il versamento.
-- Parte dallo schema da sé: ricrea utenti e dati.
-- Si lancia dopo finto-supabase.sql e i file dello schema, fino a 132-satispay-solo-chi-ha-pagato.sql.
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
-- Un movimento che la cassa Satispay aveva già prima del 132 (che non ne lascia scrivere di nuovi):
-- si spegne il trigger il tempo di scriverlo. Per le prove sui collegamenti a mano già fatti.
create or replace function vecchio(d text, i int, descr text default 'Vecchio', sid text default null) returns uuid
  language plpgsql security definer set search_path = public as $f$
declare nuovo uuid; cte boolean := exists (select 1 from pg_trigger where tgname = 'movimenti_cassa_satispay_chiusa');
begin
  if cte then alter table movimenti disable trigger movimenti_cassa_satispay_chiusa; end if;
  insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione, satispay_id)
  values ('entrata', d::date, i, (select id from voci_contabili where nome = 'Corsi e altri pagamenti' and tipo = 'entrata'), id_cassa('Satispay'), descr, sid)
  returning id into nuovo;
  if cte then alter table movimenti enable trigger movimenti_cassa_satispay_chiusa; end if;
  return nuovo;
end $f$;
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
create or replace function impronta_movimenti() returns text language sql security definer set search_path = public as $$
  select md5(coalesce((select string_agg(m::text, '|' order by m.id) from movimenti m), '')) $$;
-- Tutto il contenuto, per accorgersi di una riga che cambia (anteprima).
create or replace function impronta() returns text language sql security definer set search_path = public as $$
  select md5(coalesce((select string_agg(m::text, '|' order by m.id) from movimenti m), '')
          || coalesce((select string_agg(n::text, '|' order by n.satispay_id) from satispay_negozio n), '')
          || coalesce((select string_agg(s::text, '|') from satispay_scarico s), '')) $$;
create or replace function candidati_di(sid text) returns text language sql security definer set search_path = public as $$
  select coalesce((select string_agg(x::text, ',' order by x::text) from satispay_negozio n, unnest(n.candidati) x where n.satispay_id = sid), 'nessuno') $$;

grant execute on function atteso(text, text, text), chi(text), tenta(text), esito(text), servizio(text), come(text, text, text), come_vedo(text, text, text), come_leggo(text, text, text),
  id_cassa(text), pag(text, text, text, int, text, text, text), sal(jsonb[]), app(boolean), conti(jsonb), a_mano(text, int, text, text), vecchio(text, int, text, text), pulisci(),
  esito_di(text), mov_di(text), n_mov(), n_mov_di(text), oggi_roma(), impronta(), impronta_movimenti(), candidati_di(text) to anon, authenticated, service_role;

\echo ''

\echo ''
\echo '--- 1. la cassa Satispay è chiusa, la voce nuova c''è ---'
select atteso('la cassa Satispay c''è ancora, con i suoi movimenti vecchi', (select dal || ' ' || saldo_iniziale from casse where nome = 'Satispay'), '2025-01-01 0');
select atteso('«Da classificare» entrata e uscita',
  (select string_agg(tipo::text, ',' order by tipo) from voci_contabili where nome = 'Da classificare'), 'entrata,uscita');
select atteso('«Incassi Satispay» è una voce di entrata, di sistema',
  (select tipo::text || ' ' || di_sistema::text from voci_contabili where nome = 'Incassi Satispay'), 'entrata true');
select atteso('«Commissioni bancarie» è una voce di uscita', (select count(*)::text from voci_contabili where nome = 'Commissioni bancarie' and tipo = 'uscita'), '1');
select atteso('lo scarico è ancora da fare', coalesce((select primo_fatto::text from satispay_scarico), 'false'), 'false');
select atteso('un movimento nuovo nella cassa Satispay: rifiutato',
  esito(format('insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione) values (''entrata'', ''2026-10-14'', 100, (select id from voci_contabili where nome = ''Incassi Satispay''), %L, ''Prova'')', id_cassa('Satispay'))),
  '22023 La cassa Satispay è chiusa: i soldi di Satispay arrivano col versamento in Conto Corrente');
select atteso('…anche spostarne uno dentro la cassa Satispay (cassa_a_id di un giroconto)',
  esito(format('insert into movimenti (tipo, data, importo, cassa_id, cassa_a_id, descrizione) values (''giroconto'', ''2026-10-14'', 100, %L, %L, ''Prova'')', id_cassa('Conto Corrente'), id_cassa('Satispay'))),
  '22023 La cassa Satispay è chiusa: i soldi di Satispay arrivano col versamento in Conto Corrente');
select a_mano('2026-10-14', 100, 'Conto Corrente', 'Da spostare') as spost \gset
select atteso('…o cambiare cassa a uno che c''è già',
  esito(format('update movimenti set cassa_id = %L where id = %L', id_cassa('Satispay'), :'spost')),
  '22023 La cassa Satispay è chiusa: i soldi di Satispay arrivano col versamento in Conto Corrente');
select atteso('il Conto Corrente e i contanti restano aperti', (select count(*)::text from movimenti where descrizione = 'Da spostare' and cassa_id = id_cassa('Conto Corrente')), '1');
select vecchio('2026-10-14', 777, 'Vecchio') as vec \gset
select atteso('un movimento vecchio della cassa Satispay si può ancora annullare (la segreteria lo toglie così)',
  come('22222222-2222-2222-2222-222222222222', 'authenticated', format('select annulla_movimento(id => %L)', :'vec')), 'ok');

\echo ''
\echo '--- 2. un incasso non entra: dice solo chi ha pagato (R1, R2, R5) ---'
select pulisci();
select atteso('salva un pagamento nuovo: 1 nuovo', sal(pag('P1', 'TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-14T10:00:00Z', 'Mario Rossi')), '1');
select atteso('salvato di nuovo: nessun nuovo', sal(pag('P1', 'TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-14T10:00:00Z', 'Mario Rossi')), '0');
select atteso('applica: l''incasso conta, ma nessun movimento scritto', conti(app(true)) || ' ' || n_mov(), '1/0/0/0/0/0 0');
select atteso('esito fuori, nel versamento', esito_di('P1'), 'fuori/nel_versamento');
select atteso('…e nessun segno su nessun movimento', mov_di('P1'), 'nessuno');
select atteso('applica di fila: niente', conti(app(true)) || ' ' || n_mov(), '0/0/0/0/0/0 0');
select atteso('salva e applica ancora: sempre niente movimenti', sal(pag('P1', 'TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-14T10:00:00Z', 'Mario Rossi')) || ' ' || conti(app(true)) || ' ' || n_mov(), '0 0/0/0/0/0/0 0');
select atteso('salvato con un altro importo, dopo l''esito: non cambia', sal(pag('P1', 'TO_BUSINESS', 'ACCEPTED', 9999, '2026-10-14T10:00:00Z', 'Altro')) || ' ' || (select importo::text from satispay_negozio where satispay_id = 'P1'), '0 1250');
select atteso('di qualunque data (20 settembre, 15 novembre) e senza nome: nessun movimento',
  sal(pag('P3', 'TO_BUSINESS', 'ACCEPTED', 2000, '2026-09-20T10:00:00Z', 'Sara'), pag('P5', 'TO_BUSINESS', 'ACCEPTED', 700, '2026-10-20T10:00:00Z'))
  || ' ' || conti(app(true)) || ' ' || n_mov() || ' ' || esito_di('P3') || ' ' || esito_di('P5'),
  '2 2/0/0/0/0/0 0 fuori/nel_versamento fuori/nel_versamento');

\echo ''
\echo '--- 3. il giorno è quello di Roma ---'
-- Conta per PAGAMENTI, che guarda il giorno: le 23:30 a Roma del 14 sono già il 15.
select pulisci();
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
select diretto('2026-10-15', 1234) as _;
select atteso('le 23:30 a Roma del 14 sono il 15: è la riga di PAGAMENTI del 15',
  sal(pag('T1', 'TO_BUSINESS', 'ACCEPTED', 1234, '2026-10-14T22:30:00Z', 'Notte')) || ' ' || conti(app(true)) || ' ' || esito_di('T1') || ' ' || n_mov(), '1 0/0/0/0/0/0 pagamenti/- 0');
select atteso('30 settembre a mezzanotte e mezza a Roma è già il 1 ottobre: fuori, niente movimento',
  sal(pag('T2', 'TO_BUSINESS', 'ACCEPTED', 100, '2026-09-30T22:30:00Z', 'Cambio')) || ' ' || conti(app(true)) || ' ' || esito_di('T2') || ' ' || n_mov(), '1 1/0/0/0/0/0 fuori/nel_versamento 0');

\echo ''
\echo '--- 4. PENDING aspetta, CANCELED non entra mai (R2) ---'
select pulisci();
select atteso('un PENDING si salva', sal(pag('W1', 'TO_BUSINESS', 'PENDING', 1000, '2026-10-14T10:00:00Z', 'Attesa')), '1');
select atteso('applica: non conta', conti(app(true)) || ' ' || n_mov(), '0/0/0/0/0/0 0');
select atteso('resta senza esito', esito_di('W1'), 'senza esito/-');
select atteso('lo stesso pagamento, ora ACCEPTED (e per 11,00): il salva lo aggiorna', sal(pag('W1', 'TO_BUSINESS', 'ACCEPTED', 1100, '2026-10-14T10:00:00Z', 'Attesa')), '1');
select atteso('applica: ora è fuori, nel versamento, e non scrive niente', conti(app(true)) || ' ' || esito_di('W1') || ' ' || n_mov(), '1/0/0/0/0/0 fuori/nel_versamento 0');
select atteso('un CANCELED si salva', sal(pag('C1', 'TO_BUSINESS', 'CANCELED', 700, '2026-10-14T10:00:00Z', 'Annullato')), '1');
select atteso('applica: non conta', conti(app(true)) || ' ' || esito_di('C1'), '0/0/0/0/0/0 senza esito/-');
select atteso('e non conta al giro dopo', conti(app(true)) || ' ' || esito_di('C1') || ' ' || n_mov(), '0/0/0/0/0/0 senza esito/- 0');

\echo ''
\echo '--- 5. un rimborso non scrive nemmeno lui (R7) ---'
select pulisci();
select atteso('un rimborso del 16 ottobre: fuori, nel versamento, nessuna uscita',
  sal(pag('R1', 'REFUND_TO_BUSINESS', 'ACCEPTED', 500, '2026-10-16T10:00:00Z', 'Mario Rossi')) || ' ' || conti(app(true)) || ' ' || esito_di('R1') || ' ' || n_mov(),
  '1 0/1/0/0/0/0 fuori/nel_versamento 0');
select atteso('un rimborso non cerca doppioni: un''entrata a mano uguale non lo tocca',
  (select a_mano('2026-10-17', 800, 'Conto Corrente')::text is not null)::text || ' ' || sal(pag('R2', 'REFUND_TO_BUSINESS', 'ACCEPTED', 800, '2026-10-17T10:00:00Z', 'Pia')) || ' ' || conti(app(true)) || ' ' || n_mov(),
  'true 1 0/1/0/0/0/0 1');

\echo ''
\echo '--- 6. un pagamento del modulo di iscrizione non si ripete (R3, R4) ---'
select pulisci();
insert into pagamenti_satispay (chi, importo, stato, satispay_id, pagato_il) values ('Paolo Bianchi', 5000, 'pagato', 'M1', now());
select atteso('salva il pagamento che il modulo ha già', sal(pag('M1', 'TO_BUSINESS', 'ACCEPTED', 5000, '2026-10-14T10:00:00Z', 'Paolo')), '1');
select atteso('applica: esito modulo, niente movimenti', conti(app(true)) || ' ' || n_mov() || ' ' || esito_di('M1'), '0/0/1/0/0/0 0 modulo/-');
select atteso('al giro dopo non cambia', conti(app(true)) || ' ' || n_mov(), '0/0/0/0/0/0 0');
select atteso('la riga del modulo resta com''era', (select count(*)::text || stato from pagamenti_satispay group by stato), '1pagato');

\echo ''
\echo '--- 7. un movimento a mano uguale non si tocca e non prende il segno ---'
select pulisci();
select a_mano('2026-10-14', 1250, 'Conto Corrente', 'Bonifico di Mario') as m1 \gset
select vecchio('2026-10-14', 1250, 'Vecchio in Satispay') as m2 \gset
select impronta_movimenti() as prima \gset
select atteso('stesso giorno e importo di due movimenti: fuori, nel versamento',
  sal(pag('D1', 'TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-14T10:00:00Z', 'Mario')) || ' ' || conti(app(true)) || ' ' || esito_di('D1'),
  '1 1/0/0/0/0/0 fuori/nel_versamento');
select atteso('…i movimenti sono identici a prima', impronta_movimenti(), :'prima');
select atteso('…nessuno ha il segno', (select count(*)::text from movimenti where satispay_id is not null), '0');
select atteso('…né candidati',  candidati_di('D1'), 'nessuno');
select a_mano('2026-08-31', 5000, 'Conto Corrente', 'Bonifico ' || n) from generate_series(1, 4) n;
select atteso('4 entrate uguali: lo stesso, mai da decidere',
  sal(pag('K1', 'TO_BUSINESS', 'ACCEPTED', 5000, '2026-08-31T10:00:00Z', 'Reale')) || ' ' || conti(app(true)) || ' ' || esito_di('K1') || ' ' || n_mov(),
  '1 1/0/0/0/0/0 fuori/nel_versamento 6');
select atteso('annullare un movimento vecchio non fa tornare niente: un altro giro non cambia',
  conti(app(true)) || ' ' || sal(pag('D1', 'TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-14T10:00:00Z', 'Mario')) || ' ' || esito_di('D1'), '0/0/0/0/0/0 0 fuori/nel_versamento');

\echo ''
\echo '--- 8. giorno chiuso, prima della cassa, forse doppione: tutti fuori, nel versamento ---'
select pulisci();
insert into chiusure_cassa (cassa_id, dal, data, previsto, contato, differenza) values (id_cassa('Satispay'), '2026-10-01', '2026-10-15', 0, 0, 0);
select atteso('il 14 ottobre la cassa Satispay è chiusa: fuori, niente da decidere, niente movimento',
  sal(pag('G1', 'TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-14T10:00:00Z', 'Mario')) || ' ' || conti(app(true)) || ' ' || n_mov() || ' ' || esito_di('G1'),
  '1 1/0/0/0/0/0 0 fuori/nel_versamento');
select atteso('un giorno dopo la chiusura: lo stesso', sal(pag('G2', 'TO_BUSINESS', 'ACCEPTED', 100, '2026-10-16T10:00:00Z', 'Dopo')) || ' ' || conti(app(true)) || ' ' || esito_di('G2'), '1 1/0/0/0/0/0 fuori/nel_versamento');
select atteso('un rimborso in un giorno chiuso: fuori anche lui',
  sal(pag('G3', 'REFUND_TO_BUSINESS', 'ACCEPTED', 100, '2026-10-15T10:00:00Z', 'Via')) || ' ' || conti(app(true)) || ' ' || esito_di('G3') || ' ' || n_mov(), '1 0/1/0/0/0/0 fuori/nel_versamento 0');
-- Chiusa solo la cassa Conto Corrente: per Satispay non cambia niente.
insert into chiusure_cassa (cassa_id, dal, data, previsto, contato, differenza) values (id_cassa('Conto Corrente'), '2026-09-01', '2026-10-20', 0, 0, 0);
select atteso('chiusa solo la cassa Conto Corrente: il pagamento resta fuori, nel versamento',
  sal(pag('G5', 'TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-17T10:00:00Z', 'Mario')) || ' ' || conti(app(true)) || ' ' || esito_di('G5') || ' ' || n_mov(), '1 1/0/0/0/0/0 fuori/nel_versamento 0');
-- Prima dell'inizio della cassa Satispay (1 gennaio 2025): non più «prima_della_cassa».
select atteso('un pagamento del 20 dicembre 2024: fuori, nel versamento (non più prima della cassa)',
  sal(pag('B1', 'TO_BUSINESS', 'ACCEPTED', 900, '2024-12-20T10:00:00Z', 'Vecchio')) || ' ' || conti(app(true)) || ' ' || esito_di('B1') || ' ' || mov_di('B1'),
  '1 1/0/0/0/0/0 fuori/nel_versamento nessuno');

\echo ''
\echo '--- 9. satispay_decidi e satispay_decidi_gruppo rifiutano ---'
select pulisci();
-- Due pagamenti «da decidere» come li ha lasciati il 116: restano in tabella, ma non si decidono più.
insert into satispay_negozio (satispay_id, tipo, stato, importo, quando, chi, esito, motivo)
  values ('V1', 'TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-14T10:00:00Z', 'Mario', 'da_decidere', 'giorno_chiuso'),
         ('V2', 'TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-14T11:00:00Z', 'Mario', 'da_decidere', 'forse_doppione');
select impronta() as prima \gset
select atteso('«oggi»: rifiutato con un errore che dice cosa fare',
  come('22222222-2222-2222-2222-222222222222', 'authenticated', $$select satispay_decidi('V1', 'oggi')$$), '22023 Satispay non si decide più: i soldi arrivano col versamento in banca. Ricarica la pagina');
select atteso('«scrivi»', come('22222222-2222-2222-2222-222222222222', 'authenticated', $$select satispay_decidi('V2', 'scrivi')$$), '22023 Satispay non si decide più: i soldi arrivano col versamento in banca. Ricarica la pagina');
select atteso('«fuori»', come('22222222-2222-2222-2222-222222222222', 'authenticated', $$select satispay_decidi('V1', 'fuori')$$), '22023 Satispay non si decide più: i soldi arrivano col versamento in banca. Ricarica la pagina');
select atteso('«a_mano» con un movimento',
  come('22222222-2222-2222-2222-222222222222', 'authenticated', format('select satispay_decidi(%L, %L, %L)', 'V2', 'a_mano', a_mano('2026-10-14', 1250, 'Conto Corrente'))), '22023 Satispay non si decide più: i soldi arrivano col versamento in banca. Ricarica la pagina');
select atteso('il gruppo',
  come('22222222-2222-2222-2222-222222222222', 'authenticated', $$select satispay_decidi_gruppo('[{"satispay_id": "V1", "scelta": "fuori"}, {"satispay_id": "V2", "scelta": "oggi"}]'::jsonb)$$),
  '22023 Satispay non si decide più: i soldi arrivano col versamento in banca. Ricarica la pagina');
select atteso('…un gruppo vuoto rifiuta lo stesso', come('22222222-2222-2222-2222-222222222222', 'authenticated', $$select satispay_decidi_gruppo('[]'::jsonb)$$),
  '22023 Satispay non si decide più: i soldi arrivano col versamento in banca. Ricarica la pagina');
select atteso('i due restano in tabella com''erano, e nessun movimento nuovo',
  (select string_agg(satispay_id || ':' || esito || '/' || motivo, ',' order by satispay_id) from satispay_negozio) || ' ' || (select count(*)::text from movimenti where satispay_id is not null), 'V1:da_decidere/giorno_chiuso,V2:da_decidere/forse_doppione 0');
select atteso('lo scarico non li riprende', conti(app(true)) || ' ' || esito_di('V1'), '0/0/0/0/0/0 da_decidere/giorno_chiuso');
select atteso('lo stato non li mostra più: da_decidere è vuoto',
  come_vedo('22222222-2222-2222-2222-222222222222', 'authenticated', 'select satispay_scarico_stato()->>''da_decidere'''), '[]');
select atteso('…e ha ancora le chiavi che legge l''app',
  come_vedo('22222222-2222-2222-2222-222222222222', 'authenticated', 'select (select string_agg(k, '','' order by k) from jsonb_object_keys(satispay_scarico_stato()) k)'), 'da_decidere,errore,primo_fatto,ultimo');
-- Le funzioni che rifiutano sono ancora per l'amministrazione: gli altri si sentono dire di no prima.
select atteso('segreteria semplice: non decide nemmeno il gruppo', left(come('11111111-1111-1111-1111-111111111111', 'authenticated', $$select satispay_decidi_gruppo('[]'::jsonb)$$), 5), '42501');
select atteso('anon: nemmeno il gruppo', left(come('', 'anon', $$select satispay_decidi_gruppo('[]'::jsonb)$$), 5), '42501');

\echo ''
\echo '--- 10. «Non è questo»: un collegamento a mano già fatto si scioglie, il pagamento torna nel versamento ---'
select pulisci();
select vecchio('2026-10-14', 1250, 'Collegato a mano', 'L1') as ml \gset
insert into satispay_negozio (satispay_id, tipo, stato, importo, quando, chi, esito, motivo, movimento_id)
  values ('L1', 'TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-14T10:00:00Z', 'Mario', 'a_mano', 'forse_doppione', :'ml');
select atteso('scollega: ok', come('22222222-2222-2222-2222-222222222222', 'authenticated', $$select satispay_scollega('L1')$$), 'ok');
select atteso('…il pagamento torna fuori, nel versamento (non da decidere), senza movimento',
  esito_di('L1') || ' ' || (select coalesce(movimento_id::text, '-') || ' ' || coalesce(array_length(candidati, 1)::text, '-') from satispay_negozio where satispay_id = 'L1'), 'fuori/nel_versamento - -');
select atteso('…il movimento perde il segno ma resta', (select coalesce(satispay_id, '-') || ' ' || (annullato_il is null)::text from movimenti where id = :'ml'), '- true');
select atteso('…niente da decidere', come_vedo('22222222-2222-2222-2222-222222222222', 'authenticated', 'select satispay_scarico_stato()->>''da_decidere'''), '[]');
select atteso('…e un altro giro non lo riprende', conti(app(true)) || ' ' || esito_di('L1'), '0/0/0/0/0/0 fuori/nel_versamento');
select atteso('scollegato due volte: rifiuta, non è più collegato',
  come('22222222-2222-2222-2222-222222222222', 'authenticated', $$select satispay_scollega('L1')$$), '22023 Questo pagamento non è collegato a un movimento a mano');
select atteso('un pagamento che non c''è', left(come('22222222-2222-2222-2222-222222222222', 'authenticated', $$select satispay_scollega('NONC')$$), 5), 'P0002');
-- Con il giorno chiuso il collegamento resta.
select vecchio('2026-10-14', 1250, 'Collegato in un giorno chiuso', 'L2') as ml2 \gset
insert into satispay_negozio (satispay_id, tipo, stato, importo, quando, chi, esito, motivo, movimento_id)
  values ('L2', 'TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-14T11:00:00Z', 'Mario', 'a_mano', 'forse_doppione', :'ml2');
insert into chiusure_cassa (cassa_id, dal, data, previsto, contato, differenza) values (id_cassa('Satispay'), '2026-10-01', '2026-10-15', 0, 0, 0);
select atteso('con il giorno chiuso il collegamento resta',
  come('22222222-2222-2222-2222-222222222222', 'authenticated', $$select satispay_scollega('L2')$$), '22023 Quel giorno la cassa è chiusa: il collegamento resta');
select atteso('…e L2 è ancora a_mano', esito_di('L2') || ' ' || (select satispay_id from movimenti where id = :'ml2'), 'a_mano/forse_doppione L2');
select atteso('segreteria semplice: non scollega', left(come('11111111-1111-1111-1111-111111111111', 'authenticated', $$select satispay_scollega('L2')$$), 5), '42501');

\echo ''
\echo '--- 11. anteprima: stessi conti, niente cambia (R10) ---'
select pulisci();
insert into pagamenti_satispay (chi, importo, stato, satispay_id, pagato_il) values ('Paolo', 5000, 'pagato', 'AM', now());
select vecchio('2026-10-14', 1250, 'Già scritto') as m1 \gset
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
select atteso('l''anteprima dà i conti: 3 incassi, un rimborso, un modulo', conti(:'ante'::jsonb), '3/1/1/0/0/0');
select atteso('…e non cambia niente: movimenti, esiti, segni, primo_fatto', impronta(), :'prima');
select atteso('…primo_fatto è ancora falso', (select primo_fatto::text from satispay_scarico), 'false');
select app(true) as vero \gset
select atteso('applica(true): gli stessi conti dell''anteprima', conti(:'vero'::jsonb), conti(:'ante'::jsonb));
select atteso('…e adesso cambiano gli esiti (non i movimenti)', (impronta() is distinct from :'prima')::text || ' ' || n_mov(), 'true 1');
select atteso('…primo_fatto è vero', (select primo_fatto::text from satispay_scarico), 'true');
select atteso('…il PENDING resta senza esito', esito_di('N6'), 'senza esito/-');
select atteso('…gli altri sono fuori, nel versamento, o del modulo', esito_di('N1') || ' ' || esito_di('N2') || ' ' || esito_di('N4') || ' ' || esito_di('N5') || ' ' || esito_di('AM'),
  'fuori/nel_versamento fuori/nel_versamento fuori/nel_versamento fuori/nel_versamento modulo/-');

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
select atteso('N4 è ancora com''era dopo tutti questi no', esito_di('N4'), 'fuori/nel_versamento');
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
select atteso('lo stato non elenca niente da decidere',
  come_vedo('22222222-2222-2222-2222-222222222222', 'authenticated', 'select jsonb_array_length(satispay_scarico_stato()->''da_decidere'')::text'), '0');

\echo ''
\echo '--- 14. salva lascia fuori quel che non è un pagamento ---'
select pulisci();
select atteso('un tipo che non conosciamo, un importo zero, un id vuoto: nessuno entra',
  sal(pag('X1', 'PAYOUT', 'ACCEPTED', 1000, '2026-10-14T10:00:00Z'), pag('X2', 'TO_BUSINESS', 'ACCEPTED', 0, '2026-10-14T10:00:00Z'), pag('', 'TO_BUSINESS', 'ACCEPTED', 500, '2026-10-14T10:00:00Z'))
  || ' ' || (select count(*)::text from satispay_negozio), '0 0');

\echo ''
\echo '--- 15. già scritto in PAGAMENTI col metodo Satispay (fatto in palestra col QR) ---'
-- Le righe di PAGAMENTI (diretto, ricevuta) sono definite in 3.

select pulisci();
select diretto('2026-10-14', 1250, ' SATISPAY ') as _;
select sal(pag('Q1', 'TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-14T10:00:00Z', 'Luca')) as _;
select app(true) as giro \gset
select atteso('un pagamento a mano col metodo Satispay, stesso giorno e importo: già scritto, niente movimento',
  conti(:'giro'::jsonb) || ' +' || (:'giro'::jsonb->>'pagamenti') || ' ' || esito_di('Q1') || ' ' || n_mov(), '0/0/0/0/0/0 +1 pagamenti/- 0');
select atteso('…un secondo pagamento uguale non trova più la riga di PAGAMENTI: è nel versamento',
  sal(pag('Q2', 'TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-14T12:00:00Z', 'Altro')) || ' ' || conti(app(true)) || ' ' || esito_di('Q2'), '1 1/0/0/0/0/0 fuori/nel_versamento');

select pulisci();
select diretto('2026-10-14', 1250, 'Satispay', true) as _;
select diretto('2026-10-14', 1250, 'POS') as _;
select diretto('2026-10-13', 1250) as _;
select atteso('annullato, un altro metodo, un altro giorno: non contano',
  sal(pag('Q3', 'TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-14T10:00:00Z')) || ' ' || conti(app(true)) || ' ' || esito_di('Q3'), '1 1/0/0/0/0/0 fuori/nel_versamento');

select pulisci();
select ricevuta(901, '2026-10-14', 3000) as _;
select atteso('un pagamento Satispay dentro una ricevuta: già scritto',
  sal(pag('Q4', 'TO_BUSINESS', 'ACCEPTED', 3000, '2026-10-14T10:00:00Z')) || ' ' || conti(app(true)) || ' ' || esito_di('Q4') || ' ' || n_mov(), '1 0/0/0/0/0/0 pagamenti/- 0');
select ricevuta(902, '2026-10-15', 3000, true) as _;
select atteso('…in una ricevuta annullata: non conta',
  sal(pag('Q5', 'TO_BUSINESS', 'ACCEPTED', 3000, '2026-10-15T10:00:00Z')) || ' ' || conti(app(true)) || ' ' || esito_di('Q5'), '1 1/0/0/0/0/0 fuori/nel_versamento');
-- La ricevuta del modulo di iscrizione è del suo pagamento (esito modulo), non di un altro uguale.
select ricevuta(903, '2026-10-16', 4000) as rm \gset
insert into pagamenti_satispay (chi, importo, stato, satispay_id, pagato_il, ricevuta_id) values ('Luca', 4000, 'pagato', 'QM', now(), :'rm');
select atteso('…la ricevuta del modulo non conta per un altro pagamento uguale',
  sal(pag('QM', 'TO_BUSINESS', 'ACCEPTED', 4000, '2026-10-16T09:00:00Z'), pag('Q6', 'TO_BUSINESS', 'ACCEPTED', 4000, '2026-10-16T10:00:00Z')) || ' ' || conti(app(true)) || ' ' || esito_di('QM') || ' ' || esito_di('Q6'),
  '2 1/0/1/0/0/0 modulo/- fuori/nel_versamento');

select pulisci();
select diretto('2026-10-16', 800) as _;
select atteso('un rimborso non guarda PAGAMENTI: è un''uscita',
  sal(pag('Q7', 'REFUND_TO_BUSINESS', 'ACCEPTED', 800, '2026-10-16T10:00:00Z')) || ' ' || conti(app(true)) || ' ' || esito_di('Q7'), '1 0/1/0/0/0/0 fuori/nel_versamento');

select pulisci();
select diretto('2026-10-14', 1250) as _;
select vecchio('2026-10-14', 1250, 'Scritto anche qui') as m1 \gset
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
\echo '--- 17. senza la voce «Da classificare» lo scarico funziona lo stesso: non scrive più movimenti ---'
select pulisci();
update voci_contabili set nome = 'Da classificare (vecchia)' where nome = 'Da classificare' and tipo = 'entrata';
select sal(pag('V1', 'TO_BUSINESS', 'ACCEPTED', 100, '2026-10-14T10:00:00Z')) as _;
select atteso('applica non cerca la voce: nessun errore, nessun movimento',
  servizio('select satispay_negozio_applica(true)::text')::jsonb->>'incassi' || ' ' || n_mov() || ' ' || esito_di('V1'), '1 0 fuori/nel_versamento');
update voci_contabili set nome = 'Da classificare' where nome = 'Da classificare (vecchia)';

\echo ''
\echo '--- 18. l''avviso alla segreteria parte solo se lo scarico non è riuscito ---'
select pulisci();
delete from avvisi_segreteria;
update avvisi_indirizzi set a = 'segreteria@officinedellosport.it';
select sal(pag('A1', 'TO_BUSINESS', 'ACCEPTED', 1000, '2026-10-14T10:00:00Z'), pag('A2', 'REFUND_TO_BUSINESS', 'ACCEPTED', 400, '2026-10-14T11:00:00Z')) as _;
select servizio(format('select satispay_scarico_avvisa(%L::jsonb, null)', app(true))) as _;
select atteso('scarico riuscito (errore null): nessun avviso', (select count(*)::text from avvisi_segreteria), '0');
select servizio(format('select satispay_scarico_avvisa(%L::jsonb, %L)', '{"incassi": 1, "rimborsi": 1}', 'Satispay non risponde')) as _;
select atteso('scarico non riuscito: un avviso, con l''errore',
  (select count(*)::text || ' ' || max(dati->>'errore') from avvisi_segreteria), '1 Satispay non risponde');
delete from avvisi_segreteria;

\echo ''
\echo '--- 19. la descrizione di Satispay (il commento) si salva, e si completa anche su un pagamento già deciso ---'
select pulisci();
select sal(pag('D1', 'TO_BUSINESS', 'ACCEPTED', 500, '2026-10-14T10:00:00Z', 'Mario Rossi', 'Quota ottobre'), pag('D2', 'TO_BUSINESS', 'ACCEPTED', 700, '2026-10-14T11:00:00Z')) as _;
select atteso('la descrizione arriva', (select descrizione from satispay_negozio where satispay_id = 'D1'), 'Quota ottobre');
select atteso('senza descrizione resta vuota', ((select descrizione from satispay_negozio where satispay_id = 'D2') is null)::text, 'true');
-- D1 viene deciso: un secondo giro con la descrizione cambiata non tocca niente, ma D2 la prende ora.
select app(true) as _;
select atteso('D1 è deciso', (select esito from satispay_negozio where satispay_id = 'D1'), 'fuori');
select sal(pag('D1', 'TO_BUSINESS', 'ACCEPTED', 500, '2026-10-14T10:00:00Z', 'Mario Rossi', 'Altro testo'), pag('D2', 'TO_BUSINESS', 'ACCEPTED', 700, '2026-10-14T11:00:00Z', null, 'Arrivata dopo')) as _;
select atteso('una descrizione già salvata non cambia', (select descrizione from satispay_negozio where satispay_id = 'D1'), 'Quota ottobre');
select atteso('una che mancava si completa anche se deciso', (select descrizione from satispay_negozio where satispay_id = 'D2'), 'Arrivata dopo');
select sal(pag('D3', 'TO_BUSINESS', 'ACCEPTED', 900, '2026-10-14T12:00:00Z', null, repeat('x', 300))) as _;
select atteso('lunga più di 200 caratteri: si taglia', length((select descrizione from satispay_negozio where satispay_id = 'D3'))::text, '200');
