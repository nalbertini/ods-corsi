-- 116-satispay-separato.sql: Satispay e Conto Corrente si gestiscono separati. Lo scarico scrive ogni pagamento
-- Satispay nella cassa Satispay (che parte dal 1 gennaio 2025), e i «forse già scritti a mano» sono solo le entrate a mano
-- di quella cassa. Qui si prova il file dei dati: i pagamenti a_mano legati a un movimento del Conto Corrente si
-- scollegano, i forse_doppione tornano senza esito, e il prossimo satispay_negozio_applica li rivaluta. Gli stessi casi
-- delle regole (applica, scollega) stanno in satispay-scarico.sql e importazioni.sql, e in scripts/prova-*.mjs.
-- Parte dallo schema da sé. Rilancia 116-satispay-separato.sql sui dati seminati: da solo, dopo lo schema, è già passato
-- su un database vuoto (come prova_base), qui lo si vede sui dati veri.
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
create or replace function pag(id text, tipo text, stato text, importo int, quando text, chi text default null) returns jsonb language sql immutable as $$
  select jsonb_strip_nulls(jsonb_build_object('id', id, 'type', tipo, 'status', stato, 'amount_unit', importo,
    'insert_date', quando, 'sender', jsonb_build_object('name', chi)))
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
  id_cassa(text), pag(text, text, text, int, text, text), sal(jsonb[]), app(boolean), conti(jsonb), a_mano(text, int, text, text), pulisci(),
  esito_di(text), mov_di(text), n_mov(), n_mov_di(text), oggi_roma(), impronta(), candidati_di(text) to anon, authenticated, service_role;


\echo ''
\echo '--- 116. i dati: a_mano nel Conto Corrente si scollega, il resto resta ---'
\set esiste `test -f supabase/116-satispay-separato.sql && echo true || echo false`
select atteso('c''è supabase/116-satispay-separato.sql', :'esiste', 'true');
select pulisci();
-- Come era prima del 116: la cassa Satispay partiva dal 1 ottobre e il Conto Corrente prendeva i pagamenti di prima.
update casse set dal = '2026-10-01' where nome = 'Satispay';
select a_mano('2026-08-31', 5000, 'Conto Corrente', 'Bonifico 1') as c1 \gset
select a_mano('2026-08-31', 5000, 'Conto Corrente', 'Bonifico 2') as c2 \gset
select a_mano('2026-08-31', 5000, 'Conto Corrente', 'Scritto da noi') as c3 \gset
select a_mano('2026-09-02', 700, 'Satispay', 'Bonifico in Satispay') as s1 \gset
select a_mano('2026-09-03', 800, 'Conto Corrente', 'Chiuso') as c4 \gset
insert into satispay_negozio (satispay_id, tipo, stato, importo, quando, chi, esito, motivo, candidati, movimento_id) values
  ('AM', 'TO_BUSINESS', 'ACCEPTED', 5000, '2026-08-31T10:00:00Z', 'Reale', 'a_mano', null, null, :'c1'),
  ('DD', 'TO_BUSINESS', 'ACCEPTED', 5000, '2026-08-31T11:00:00Z', 'Reale', 'da_decidere', 'forse_doppione', array[:'c2', :'c3']::uuid[], null),
  ('SC', 'TO_BUSINESS', 'ACCEPTED', 5000, '2026-08-31T12:00:00Z', 'Reale', 'scritto', null, null, :'c3'),
  ('AS', 'TO_BUSINESS', 'ACCEPTED', 700, '2026-09-02T10:00:00Z', 'Lia', 'a_mano', null, null, :'s1'),
  ('GC', 'TO_BUSINESS', 'ACCEPTED', 800, '2026-09-03T10:00:00Z', 'Chiuso', 'da_decidere', 'giorno_chiuso', null, null);
update movimenti set satispay_id = 'AM' where id = :'c1';
update movimenti set satispay_id = 'SC' where id = :'c3';
update movimenti set satispay_id = 'AS' where id = :'s1';
select atteso('prima del 116: AM è a_mano su un movimento del Conto Corrente', esito_di('AM') || ' ' || n_mov_di('AM'), 'a_mano/- 1');

\i supabase/116-satispay-separato.sql

select atteso('la cassa Satispay parte dal 1 gennaio 2025', (select dal::text from casse where nome = 'Satispay'), '2025-01-01');
select atteso('un a_mano su un movimento del Conto Corrente è senza esito, motivo, candidati e movimento',
  (select concat_ws('|', coalesce(esito, 'senza esito'), coalesce(motivo, '-'), coalesce(candidati::text, '-'), coalesce(movimento_id::text, '-')) from satispay_negozio where satispay_id = 'AM'),
  'senza esito|-|-|-');
select atteso('…e il movimento perde il segno ma resta, con la sua descrizione',
  (select concat_ws('|', descrizione, coalesce(satispay_id, 'senza segno'), (annullato_il is null)::text) from movimenti where id = :'c1'), 'Bonifico 1|senza segno|true');
select atteso('un da_decidere/forse_doppione è senza esito, motivo, candidati e movimento',
  (select concat_ws('|', coalesce(esito, 'senza esito'), coalesce(motivo, '-'), coalesce(candidati::text, '-'), coalesce(movimento_id::text, '-')) from satispay_negozio where satispay_id = 'DD'),
  'senza esito|-|-|-');
select atteso('uno scritto nel Conto Corrente resta com''è, col suo movimento e il segno',
  esito_di('SC') || ' ' || n_mov_di('SC') || ' ' || (select movimento_id::text from satispay_negozio where satispay_id = 'SC'), 'scritto/- 1 ' || :'c3');
select atteso('un a_mano su un movimento della cassa Satispay resta a_mano, col segno', esito_di('AS') || ' ' || n_mov_di('AS'), 'a_mano/- 1');
select atteso('un da_decidere/giorno_chiuso resta com''è', esito_di('GC'), 'da_decidere/giorno_chiuso');
-- Il prossimo giro li rivaluta con la regola nuova: sono di agosto, in Satispay, senza candidati nel Conto Corrente.
select atteso('il giro dopo il 116 li rivaluta: AM e DD entrano in Satispay',
  app(true)->>'incassi', '2');
select atteso('…AM è scritto in cassa Satispay', esito_di('AM') || ' ' || mov_di('AM'), 'scritto/- entrata|2026-08-31|5000|Satispay|Da classificare|Satispay · Reale|nessuno');
select atteso('…e i bonifici del Conto Corrente senza segno', (select count(*)::text from movimenti m join casse c on c.id = m.cassa_id where c.nome = 'Conto Corrente' and m.satispay_id is null), '3');

\echo ''
\echo '--- 116. i dati: un «Non è questo» deciso in cassa Satispay resta deciso ---'
select pulisci();
select a_mano('2026-10-20', 900, 'Satispay', 'Scritto da noi') as s2 \gset
-- Come lo lascia satispay_scollega: da decidere, col solo movimento in Satispay come candidato.
insert into satispay_negozio (satispay_id, tipo, stato, importo, quando, chi, esito, motivo, candidati, movimento_id) values
  ('NQ', 'TO_BUSINESS', 'ACCEPTED', 900, '2026-10-20T10:00:00Z', 'Ugo', 'da_decidere', 'forse_doppione', array[:'s2']::uuid[], null);
\i supabase/116-satispay-separato.sql
\i supabase/116-satispay-separato.sql
select atteso('il 116, anche due volte, non tocca un da_decidere coi candidati in Satispay',
  (select concat_ws('|', esito, motivo, candidati::text) from satispay_negozio where satispay_id = 'NQ'),
  'da_decidere|forse_doppione|{' || :'s2' || '}');
select app(true);
select atteso('…e il giro dopo non lo ricollega al movimento', esito_di('NQ') || ' ' || n_mov_di('NQ'), 'da_decidere/forse_doppione 0');
