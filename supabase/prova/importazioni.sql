-- La sezione IMPORTAZIONI (114-importazioni.sql): i pagamenti Satispay «forse già scritti a mano» si decidono
-- a gruppi (`satispay_decidi_gruppo`), «Non è questo» scollega un pagamento da un movimento a mano
-- (`satispay_scollega`), i candidati non includono i movimenti già presi o annullati (`satispay_scarico_stato`), e i
-- movimenti della banca coperti da uno a mano si salvano (`banca_coperti`, `banca_segna_coperti`) per rivederli, con
-- «Non è questo» anche lì (`banca_non_e_questo`). Solo l'amministrazione.
-- Le stesse regole di src/lib/satispayScarico.ts e importaBanca.ts, provate da scripts/prova-importazioni.mjs:
-- stessi casi, stessi messaggi. Le scelte e le righe sono jsonb con le chiavi dell'app (camelCase):
--   satispay_decidi_gruppo('[{"satispayId": "P1", "scelta": "a_mano", "movimentoId": "<uuid>"}, …]')
--   banca_segna_coperti('[{"chiave", "data", "tipo", "importo", "descrizione", "conId", "conDescrizione"}, …]')
-- Parte dallo schema da sé: ricrea utenti e dati. Si lancia dopo finto-supabase.sql e i file dello schema, fino a 114.
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

-- Le chiavi con cui si presentano chi decide (Ada: amministrazione) e chi no.
create or replace function ada() returns text language sql immutable as $$ select '22222222-2222-2222-2222-222222222222' $$;
create or replace function chiusura(cassa text, giorno text) returns void language sql security definer set search_path = public as $$
  insert into chiusure_cassa (cassa_id, dal, data, previsto, contato, differenza) values (id_cassa(cassa), '2026-09-01', giorno::date, 0, 0, 0) $$;
create or replace function pulisci_banca() returns void language plpgsql security definer set search_path = public as $$
begin
  delete from banca_coperti;
  delete from satispay_negozio;
  delete from chiusure_cassa;
  delete from movimenti;
end $$;

\echo ''
\echo '--- 1. i candidati non includono i movimenti già presi o annullati (satispay_scarico_stato) ---'
select pulisci();
select a_mano('2026-10-14', 1250, 'Satispay', 'Primo') as m1 \gset
select a_mano('2026-10-14', 1250, 'Satispay', 'Secondo') as m2 \gset
select a_mano('2026-10-14', 1250, 'Satispay', 'Terzo') as m3 \gset
select sal(pag('D1', 'TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-14T10:00:00Z', 'Mario')) as _;
select conti(app(true)) as _;
select atteso('D1 è da decidere con tre candidati',
  come_vedo(ada(), 'authenticated', 'select jsonb_array_length(satispay_scarico_stato()->''da_decidere''->0->''candidati'')::text'), '3');
-- Un altro pagamento prende il primo; il terzo viene annullato.
update movimenti set satispay_id = 'ALTRO' where id = :'m1';
update movimenti set annullato_il = now() where id = :'m3';
select atteso('un movimento col segno di un altro pagamento o annullato non è più candidato',
  come_vedo(ada(), 'authenticated',
    'select string_agg(c->>''id'', '','') from jsonb_array_elements(satispay_scarico_stato()->''da_decidere''->0->''candidati'') c'), :'m2');

\echo ''
\echo '--- 2. 114-importazioni.sql è stato lanciato ---'
select (to_regprocedure('public.satispay_decidi_gruppo(jsonb)') is not null
  and to_regprocedure('public.satispay_scollega(text)') is not null
  and to_regprocedure('public.banca_segna_coperti(jsonb)') is not null
  and to_regprocedure('public.banca_non_e_questo(text)') is not null
  and to_regclass('public.banca_coperti') is not null)::text as c114 \gset
select atteso('ci sono satispay_decidi_gruppo, satispay_scollega, banca_segna_coperti, banca_non_e_questo e banca_coperti', :'c114', 'true');

\echo ''
\echo '--- 3. satispay_decidi_gruppo: tutte le scelte o nessuna ---'
select pulisci();
select a_mano('2026-10-14', 1250, 'Satispay', 'Primo') as m1 \gset
select a_mano('2026-10-14', 1250, 'Satispay', 'Secondo') as m2 \gset
select sal(pag('P1', 'TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-14T09:00:00Z', 'Mario'), pag('P2', 'TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-14T11:00:00Z', 'Mario')) as _;
select conti(app(true)) as _;
select atteso('P1 e P2 sono da decidere', esito_di('P1') || ' ' || esito_di('P2'), 'da_decidere/forse_doppione da_decidere/forse_doppione');
-- Lo stesso movimento per due pagamenti: niente.
select atteso('lo stesso movimento scelto per due pagamenti: errore',
  come(ada(), 'authenticated', format('select satispay_decidi_gruppo(%L::jsonb)',
    jsonb_build_array(jsonb_build_object('satispayId', 'P1', 'scelta', 'a_mano', 'movimentoId', :'m1'), jsonb_build_object('satispayId', 'P2', 'scelta', 'a_mano', 'movimentoId', :'m1')))),
  '22023 Lo stesso movimento è scelto per due pagamenti');
select atteso('…e non è cambiato niente', esito_di('P1') || ' ' || esito_di('P2') || ' ' || (select count(*)::text from movimenti where satispay_id is not null), 'da_decidere/forse_doppione da_decidere/forse_doppione 0');
-- Una scelta fallisce (giorno chiuso, «scrivi»): anche la prima, già buona, non si applica.
select chiusura('Satispay', '2026-10-15') as _;
select atteso('«scrivi» in un giorno chiuso ferma tutto il gruppo',
  come(ada(), 'authenticated', format('select satispay_decidi_gruppo(%L::jsonb)',
    jsonb_build_array(jsonb_build_object('satispayId', 'P1', 'scelta', 'a_mano', 'movimentoId', :'m1'), jsonb_build_object('satispayId', 'P2', 'scelta', 'scrivi')))),
  '22023 Quel giorno la cassa è chiusa: scrivilo oggi');
select atteso('…il primo pagamento è ancora da decidere e il movimento senza segno',
  esito_di('P1') || ' ' || esito_di('P2') || ' ' || (select count(*)::text from movimenti where satispay_id is not null) || ' ' || n_mov(), 'da_decidere/forse_doppione da_decidere/forse_doppione 0 2');
select atteso('«oggi» per tutti e due, nello stesso giorno chiuso: due movimenti con la data di oggi, firmati da chi ha deciso',
  come(ada(), 'authenticated', format('select satispay_decidi_gruppo(%L::jsonb)',
    jsonb_build_array(jsonb_build_object('satispayId', 'P1', 'scelta', 'oggi'), jsonb_build_object('satispayId', 'P2', 'scelta', 'oggi')))), 'ok');
select atteso('…P1 e P2 scritti', mov_di('P1') || ' ' || mov_di('P2'),
  'entrata|' || oggi_roma() || '|1250|Satispay|Da classificare|Satispay · Mario|aaaaaaaa-0000-0000-0000-000000000002 entrata|' || oggi_roma() || '|1250|Satispay|Da classificare|Satispay · Mario|aaaaaaaa-0000-0000-0000-000000000002');
select atteso('…esito scritto', esito_di('P1') || ' ' || esito_di('P2'), 'scritto/forse_doppione scritto/forse_doppione');

select pulisci();
select a_mano('2026-10-14', 1250, 'Satispay', 'Primo') as m1 \gset
select a_mano('2026-10-14', 1250, 'Satispay', 'Secondo') as m2 \gset
select sal(pag('P1', 'TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-14T09:00:00Z', 'Mario'), pag('P2', 'TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-14T11:00:00Z', 'Mario')) as _;
select conti(app(true)) as _;
select atteso('un movimento a mano a testa: tutti e due a_mano',
  come(ada(), 'authenticated', format('select satispay_decidi_gruppo(%L::jsonb)',
    jsonb_build_array(jsonb_build_object('satispayId', 'P1', 'scelta', 'a_mano', 'movimentoId', :'m1'), jsonb_build_object('satispayId', 'P2', 'scelta', 'a_mano', 'movimentoId', :'m2')))), 'ok');
select atteso('…esiti e segni', esito_di('P1') || ' ' || esito_di('P2') || ' ' || (select satispay_id from movimenti where id = :'m1') || (select satispay_id from movimenti where id = :'m2'),
  'a_mano/forse_doppione a_mano/forse_doppione P1P2');
select atteso('un gruppo già deciso: errore', come(ada(), 'authenticated', $$select satispay_decidi_gruppo('[{"satispayId": "P1", "scelta": "fuori"}]'::jsonb)$$), '22023 Questo pagamento è già deciso');
select atteso('un pagamento che non c''è', come(ada(), 'authenticated', $$select satispay_decidi_gruppo('[{"satispayId": "XX", "scelta": "fuori"}]'::jsonb)$$), 'P0002 Il pagamento non c’è');
select atteso('una scelta che non si capisce', come(ada(), 'authenticated', $$select satispay_decidi_gruppo('[{"satispayId": "P1", "scelta": "boh"}]'::jsonb)$$), '22023…');
select atteso('una lista che non è una lista', left(come(ada(), 'authenticated', $$select satispay_decidi_gruppo('{}'::jsonb)$$), 5), '22023');

\echo ''
\echo '--- 4. satispay_scollega: «Non è questo» ---'
select pulisci();
select a_mano('2026-10-14', 1250, 'Satispay', 'Bonifico di Mario') as m1 \gset
select sal(pag('P1', 'TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-14T10:00:00Z', 'Mario')) as _;
select conti(app(true)) as _;
select a_mano('2026-10-14', 1250, 'Satispay', 'Un altro bonifico') as m2 \gset
select atteso('P1 si era preso da solo il movimento a mano', esito_di('P1') || ' ' || n_mov_di('P1'), 'a_mano/- 1');
select atteso('«Non è questo»: ok', come(ada(), 'authenticated', $$select satispay_scollega('P1')$$), 'ok');
select atteso('…il pagamento torna da decidere, forse doppione, senza movimento',
  esito_di('P1') || ' ' || (select (movimento_id is null)::text from satispay_negozio where satispay_id = 'P1'), 'da_decidere/forse_doppione true');
select atteso('…il movimento a mano resta com''era, senza segno',
  (select concat_ws('|', descrizione, coalesce(satispay_id, 'senza segno'), (annullato_il is null)::text) from movimenti where id = :'m1'), 'Bonifico di Mario|senza segno|true');
select atteso('…i candidati si ricalcolano: lo stesso movimento torna candidato, insieme all''altro',
  candidati_di('P1'), (select string_agg(x, ',' order by x) from unnest(array[:'m1', :'m2']::text[]) x));
select atteso('…e lo stato li mostra', come_vedo(ada(), 'authenticated', 'select jsonb_array_length(satispay_scarico_stato()->''da_decidere''->0->''candidati'')::text'), '2');
-- Conto Corrente non è mai candidato: né un'entrata uguale lì, né il movimento scollegato se sta lì.
select pulisci();
select a_mano('2026-10-14', 1250, 'Satispay', 'Bonifico di Mario') as m1 \gset
select sal(pag('P1', 'TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-14T10:00:00Z', 'Mario')) as _;
select conti(app(true)) as _;
select a_mano('2026-10-14', 1250, 'Satispay', 'Un altro bonifico') as m2 \gset
select a_mano('2026-10-14', 1250, 'Conto Corrente', 'In banca') as _;
select atteso('«Non è questo»: i candidati ricalcolati sono solo della cassa Satispay',
  come(ada(), 'authenticated', $$select satispay_scollega('P1')$$) || ' ' || candidati_di('P1'),
  'ok ' || (select string_agg(x, ',' order by x) from unnest(array[:'m1', :'m2']::text[]) x));
select pulisci();
select a_mano('2026-10-14', 1250, 'Satispay', 'Bonifico di Mario') as m1 \gset
select sal(pag('P1', 'TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-14T10:00:00Z', 'Mario')) as _;
select conti(app(true)) as _;
update movimenti set cassa_id = id_cassa('Conto Corrente') where id = :'m1';
select a_mano('2026-10-14', 1250, 'Satispay', 'Uno di Satispay') as m2 \gset
select atteso('…anche se il movimento scollegato stava nel Conto Corrente: non torna candidato',
  come(ada(), 'authenticated', $$select satispay_scollega('P1')$$) || ' ' || candidati_di('P1'), 'ok ' || :'m2');
select atteso('un pagamento già da decidere non si scollega', come(ada(), 'authenticated', $$select satispay_scollega('P1')$$), '22023 Questo pagamento non è collegato a un movimento a mano');
select atteso('un pagamento che non c''è', come(ada(), 'authenticated', $$select satispay_scollega('XX')$$), 'P0002 Il pagamento non c’è');

select pulisci();
select sal(pag('P3', 'TO_BUSINESS', 'ACCEPTED', 300, '2026-10-14T10:00:00Z', 'Sara')) as _;
select conti(app(true)) as _;
select atteso('uno scritto da noi non si scollega', come(ada(), 'authenticated', $$select satispay_scollega('P3')$$), '22023 Questo pagamento non è collegato a un movimento a mano');
select atteso('…e il suo movimento resta', esito_di('P3') || ' ' || n_mov_di('P3'), 'scritto/- 1');

select pulisci();
select a_mano('2026-10-14', 1250, 'Satispay', 'Bonifico di Mario') as m1 \gset
select sal(pag('P1', 'TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-14T10:00:00Z', 'Mario')) as _;
select conti(app(true)) as _;
select chiusura('Conto Corrente', '2026-10-31') as _;
select atteso('la chiusura di un''altra cassa non conta: si scollega',
  come(ada(), 'authenticated', $$select satispay_scollega('P1')$$), 'ok');
select pulisci();
select a_mano('2026-10-14', 1250, 'Satispay', 'Bonifico di Mario') as m1 \gset
select sal(pag('P1', 'TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-14T10:00:00Z', 'Mario')) as _;
select conti(app(true)) as _;
select chiusura('Satispay', '2026-10-15') as _;
select atteso('la cassa del movimento è chiusa quel giorno: il collegamento resta',
  come(ada(), 'authenticated', $$select satispay_scollega('P1')$$), '22023 Quel giorno la cassa è chiusa: il collegamento resta');
select atteso('…il pagamento è ancora a_mano e il movimento ha ancora il segno', esito_di('P1') || ' ' || n_mov_di('P1'), 'a_mano/- 1');

\echo ''
\echo '--- 5. chi può: solo l''amministrazione ---'
select atteso('segreteria semplice: non decide a gruppi', left(come('11111111-1111-1111-1111-111111111111', 'authenticated', $$select satispay_decidi_gruppo('[]'::jsonb)$$), 5), '42501');
select atteso('segreteria semplice: non scollega', left(come('11111111-1111-1111-1111-111111111111', 'authenticated', $$select satispay_scollega('P1')$$), 5), '42501');
select atteso('istruttore: non decide a gruppi', left(come('55555555-5555-5555-5555-555555555555', 'authenticated', $$select satispay_decidi_gruppo('[]'::jsonb)$$), 5), '42501');
select atteso('istruttore: non scollega', left(come('55555555-5555-5555-5555-555555555555', 'authenticated', $$select satispay_scollega('P1')$$), 5), '42501');
select atteso('iscritto: non decide a gruppi', left(come('77777777-7777-7777-7777-777777777777', 'authenticated', $$select satispay_decidi_gruppo('[]'::jsonb)$$), 5), '42501');
select atteso('iscritto: non scollega', left(come('77777777-7777-7777-7777-777777777777', 'authenticated', $$select satispay_scollega('P1')$$), 5), '42501');
select atteso('tablet: non decide a gruppi', left(come('99999999-9999-9999-9999-999999999999', 'authenticated', $$select satispay_decidi_gruppo('[]'::jsonb)$$), 5), '42501');
select atteso('tablet: non scollega', left(come('99999999-9999-9999-9999-999999999999', 'authenticated', $$select satispay_scollega('P1')$$), 5), '42501');
select atteso('anon: non decide a gruppi', left(come('', 'anon', $$select satispay_decidi_gruppo('[]'::jsonb)$$), 5), '42501');
select atteso('anon: non scollega', left(come('', 'anon', $$select satispay_scollega('P1')$$), 5), '42501');
select atteso('…dopo tutti questi no P1 è ancora collegato', esito_di('P1') || ' ' || n_mov_di('P1'), 'a_mano/- 1');

\echo ''
\echo '--- 6. banca: i coperti si salvano per rivederli ---'
select pulisci_banca();
update casse set dal = '2026-09-01' where nome = 'Conto Corrente';
select a_mano('2026-10-03', 12000, 'Conto Corrente', 'Saldo corso Luca') as c1 \gset
select a_mano('2026-10-04', 5000, 'Conto Corrente', 'Quota Anna') as c2 \gset
select jsonb_build_array(
  jsonb_build_object('chiave', 'banca:20261003:abc:0', 'data', '2026-10-03', 'tipo', 'entrata', 'importo', 12000, 'descrizione', 'Da Luca Verdi saldo corso BONIFICO', 'conId', :'c1', 'conDescrizione', 'Saldo corso Luca'),
  jsonb_build_object('chiave', 'banca:20261004:def:0', 'data', '2026-10-04', 'tipo', 'entrata', 'importo', 5000, 'descrizione', 'Da Anna quota', 'conId', :'c2', 'conDescrizione', 'Quota Anna'))::text as righe \gset
select atteso('l''amministrazione salva due coperti', come(ada(), 'authenticated', format('select banca_segna_coperti(%L::jsonb)', :'righe')), 'ok');
select atteso('…sono due', (select count(*)::text from banca_coperti), '2');
select atteso('…con i dati della banca e del movimento a mano',
  (select concat_ws('|', data, tipo, importo, descrizione, (con_id = :'c1'::uuid)::text, con_descrizione) from banca_coperti where chiave = 'banca:20261003:abc:0'),
  '2026-10-03|entrata|12000|Da Luca Verdi saldo corso BONIFICO|true|Saldo corso Luca');
select atteso('rilanciata con le stesse righe: non duplica', come(ada(), 'authenticated', format('select banca_segna_coperti(%L::jsonb)', :'righe')) || ' ' || (select count(*)::text from banca_coperti), 'ok 2');
select atteso('una riga senza chiave: no', left(come(ada(), 'authenticated', $$select banca_segna_coperti('[{"data": "2026-10-03", "tipo": "entrata", "importo": 100, "descrizione": "x"}]'::jsonb)$$), 5), '22023');
select atteso('…e non ne entra nessuna', (select count(*)::text from banca_coperti), '2');
select atteso('l''amministrazione li legge', come_leggo(ada(), 'authenticated', 'banca_coperti'), '2');
select atteso('la segreteria semplice non li legge', come_leggo('11111111-1111-1111-1111-111111111111', 'authenticated', 'banca_coperti'), 'non legge');
select atteso('l''istruttore non li legge', come_leggo('55555555-5555-5555-5555-555555555555', 'authenticated', 'banca_coperti'), 'non legge');
select atteso('l''iscritto non li legge', come_leggo('77777777-7777-7777-7777-777777777777', 'authenticated', 'banca_coperti'), 'non legge');
select atteso('il tablet non li legge', come_leggo('99999999-9999-9999-9999-999999999999', 'authenticated', 'banca_coperti'), 'non legge');
select atteso('anon non li legge', come_leggo('', 'anon', 'banca_coperti'), 'non legge');
select atteso('la segreteria semplice non li salva', left(come('11111111-1111-1111-1111-111111111111', 'authenticated', $$select banca_segna_coperti('[]'::jsonb)$$), 5), '42501');
select atteso('anon non li salva', left(come('', 'anon', $$select banca_segna_coperti('[]'::jsonb)$$), 5), '42501');
select atteso('nessuno scrive dritto sulla tabella',
  (select count(*)::text from unnest(array[
    come(ada(), 'authenticated', $$insert into banca_coperti (chiave, data, tipo, importo, descrizione) values ('banca:x', '2026-10-03', 'entrata', 1, 'x')$$),
    come(ada(), 'authenticated', $$update banca_coperti set importo = 1 where true$$),
    come(ada(), 'authenticated', $$delete from banca_coperti where true$$)]) r
    where r like '42501 permission denied%'), '3');

\echo ''
\echo '--- 7. banca_non_e_questo ---'
select atteso('la segreteria semplice non può', left(come('11111111-1111-1111-1111-111111111111', 'authenticated', $$select banca_non_e_questo('banca:20261003:abc:0')$$), 5), '42501');
select atteso('anon non può', left(come('', 'anon', $$select banca_non_e_questo('banca:20261003:abc:0')$$), 5), '42501');
select atteso('…e il coperto è ancora lì', (select count(*)::text from banca_coperti), '2');
select atteso('l''amministrazione: ok', come(ada(), 'authenticated', $$select banca_non_e_questo('banca:20261003:abc:0')$$), 'ok');
select atteso('…il movimento della banca è scritto come un import: Conto Corrente, Da classificare, chiave in origine_import',
  (select concat_ws('|', m.tipo, m.data, m.importo, c.nome, v.nome, m.descrizione, m.origine_import)
     from movimenti m join casse c on c.id = m.cassa_id join voci_contabili v on v.id = m.voce_id where m.origine_import = 'banca:20261003:abc:0'),
  'entrata|2026-10-03|12000|Conto Corrente|Da classificare|Da Luca Verdi saldo corso BONIFICO|banca:20261003:abc:0');
select atteso('…e lascia stare il movimento a mano', (select concat_ws('|', descrizione, (annullato_il is null)::text) from movimenti where id = :'c1'), 'Saldo corso Luca|true');
select atteso('…la riga esce dai coperti', (select string_agg(chiave, ',') from banca_coperti), 'banca:20261004:def:0');
select atteso('di nuovo: non è più fra i coperti', come(ada(), 'authenticated', $$select banca_non_e_questo('banca:20261003:abc:0')$$), '22023 Questo movimento non è fra quelli già scritti');
select atteso('…e il movimento è uno solo', (select count(*)::text from movimenti where origine_import = 'banca:20261003:abc:0'), '1');
-- Il Conto Corrente è chiuso fino al 4 ottobre: il collegamento resta.
select chiusura('Conto Corrente', '2026-10-04') as _;
select atteso('giorno chiuso del Conto Corrente: il collegamento resta',
  come(ada(), 'authenticated', $$select banca_non_e_questo('banca:20261004:def:0')$$), '22023 Quel giorno la cassa è chiusa: il collegamento resta');
select atteso('…il coperto c''è ancora e non è stato scritto niente',
  (select count(*)::text from banca_coperti) || ' ' || (select count(*)::text from movimenti where origine_import = 'banca:20261004:def:0'), '1 0');

select pulisci_banca();
insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione)
  values ('uscita', '2026-10-08', 700, (select id from voci_contabili where nome = 'Da classificare' and tipo = 'uscita'), id_cassa('Conto Corrente'), 'Spesa a mano')
  returning id as c3 \gset
select jsonb_build_array(jsonb_build_object('chiave', 'banca:20261008:ghi:0', 'data', '2026-10-08', 'tipo', 'uscita', 'importo', 700, 'descrizione', 'Pagamento POS Bar', 'conId', :'c3', 'conDescrizione', 'Spesa a mano'))::text as righe \gset
select banca_segna_coperti(:'righe'::jsonb) as _;
select atteso('un''uscita coperta: ok', come(ada(), 'authenticated', $$select banca_non_e_questo('banca:20261008:ghi:0')$$), 'ok');
select atteso('…esce sulla voce «Da classificare» di uscita',
  (select concat_ws('|', m.tipo, v.tipo::text, m.importo) from movimenti m join voci_contabili v on v.id = m.voce_id where m.origine_import = 'banca:20261008:ghi:0'), 'uscita|uscita|700');

\echo ''
\echo '--- 8. un movimento a mano è di Satispay o della banca, mai di tutti e due ---'
create or replace function copre(chiave text, con text, importo int default 1250) returns text language sql as $$
  select come(ada(), 'authenticated', format('select banca_segna_coperti(%L::jsonb)', jsonb_build_array(jsonb_build_object(
    'chiave', chiave, 'data', '2026-10-14', 'tipo', 'entrata', 'importo', importo, 'descrizione', 'Da Mario BONIFICO', 'conId', con, 'conDescrizione', 'a mano')))) $$;
create or replace function chiave_di(m text) returns text language sql security definer set search_path = public as $$
  select coalesce((select banca_chiave from movimenti where id = m::uuid), 'nessuna') $$;
create or replace function stato_banca(k text) returns text language sql security definer set search_path = public as $$
  select (select count(*) from banca_coperti where chiave = k)::text || ' coperto, ' || (select count(*) from movimenti where origine_import = k)::text || ' scritto' $$;
grant execute on function copre(text, text, int), chiave_di(text), stato_banca(text) to authenticated;

-- Lo scarico di notte non collega da solo un movimento già coperto dalla banca.
select pulisci(); select pulisci_banca();
select a_mano('2026-10-14', 1250, 'Conto Corrente', 'Bonifico di Mario') as m1 \gset
select atteso('la banca copre m1', copre('banca:k1', :'m1') || ' ' || chiave_di(:'m1'), 'ok banca:k1');
select sal(pag('P1', 'TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-14T10:00:00Z', 'Mario')) as _;
select conti(app(true)) as _;
select atteso('lo scarico lo scrive nuovo, non lo collega a m1', esito_di('P1') || ' ' || coalesce((select satispay_id from movimenti where id = :'m1'), 'senza segno'), 'scritto/- senza segno');

-- La banca copre un candidato dopo che il pagamento è finito «da decidere».
select pulisci(); select pulisci_banca();
select a_mano('2026-10-14', 1250, 'Conto Corrente', 'Primo') as m1 \gset
select a_mano('2026-10-14', 1250, 'Conto Corrente', 'Secondo') as m2 \gset
select a_mano('2026-10-14', 1250, 'Conto Corrente', 'Terzo') as m3 \gset
select sal(pag('P1', 'TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-14T10:00:00Z', 'Mario')) as _;
-- Dal 115 lo scarico non propone più movimenti del Conto Corrente: qui il «da decidere» è uno rimasto da prima,
-- e le guardie contro la banca restano.
update satispay_negozio set esito = 'da_decidere', motivo = 'forse_doppione', candidati = array[:'m1', :'m2', :'m3']::uuid[] where satispay_id = 'P1';
select copre('banca:k1', :'m1') as _;
select atteso('fra i candidati da decidere m1 non c''è più',
  come_vedo(ada(), 'authenticated', 'select string_agg(c->>''descrizione'', '','') from jsonb_array_elements(satispay_scarico_stato()->''da_decidere''->0->''candidati'') c'), 'Secondo,Terzo');
select atteso('sceglierlo lo stesso (pagina vecchia): errore',
  come(ada(), 'authenticated', format('select satispay_decidi_gruppo(%L::jsonb)', jsonb_build_array(jsonb_build_object('satispayId', 'P1', 'scelta', 'a_mano', 'movimentoId', :'m1')))),
  '22023 Quel movimento è già coperto da un movimento della banca: ricarica la pagina');
select atteso('…e P1 è ancora da decidere', esito_di('P1'), 'da_decidere/forse_doppione');
select atteso('anche dritto sulla tabella, un movimento non ha tutti e due i segni',
  left(esito(format('update movimenti set satispay_id = %L where id = %L', 'P1', :'m1')), 5), '23514');

-- Il movimento è già di Satispay: la riga della banca non lo copre, entra nuova.
select come(ada(), 'authenticated', format('select satispay_decidi_gruppo(%L::jsonb)', jsonb_build_array(jsonb_build_object('satispayId', 'P1', 'scelta', 'a_mano', 'movimentoId', :'m2')))) as _;
select atteso('un movimento già di Satispay non si copre: la riga entra nuova', copre('banca:k2', :'m2') || ' ' || stato_banca('banca:k2') || ' ' || chiave_di(:'m2'), 'ok 0 coperto, 1 scritto nessuna');
select atteso('…nel Conto Corrente, da classificare',
  (select concat_ws('|', m.tipo, m.data, m.importo, c.nome, v.nome, m.descrizione) from movimenti m join casse c on c.id = m.cassa_id join voci_contabili v on v.id = m.voce_id where m.origine_import = 'banca:k2'),
  'entrata|2026-10-14|1250|Conto Corrente|Da classificare|Da Mario BONIFICO');
select atteso('una seconda riga della banca sullo stesso movimento: entra nuova', copre('banca:k3', :'m1') || ' ' || stato_banca('banca:k3') || ' ' || chiave_di(:'m1'), 'ok 0 coperto, 1 scritto banca:k1');
select atteso('un altro importo: entra nuova', copre('banca:k4', :'m3', 999) || ' ' || stato_banca('banca:k4') || ' ' || chiave_di(:'m3'), 'ok 0 coperto, 1 scritto nessuna');
select atteso('un movimento che non c''è: entra nuova', copre('banca:k5', 'aaaaaaaa-9999-0000-0000-000000000000') || ' ' || stato_banca('banca:k5'), 'ok 0 coperto, 1 scritto');
select atteso('rilanciata con la stessa riga: non cambia niente', copre('banca:k1', :'m1') || ' ' || stato_banca('banca:k1') || ' ' || chiave_di(:'m1'), 'ok 1 coperto, 0 scritto banca:k1');
select atteso('rilanciata una riga già scritta nuova: non la riscrive', copre('banca:k2', :'m3') || ' ' || stato_banca('banca:k2') || ' ' || chiave_di(:'m3'), 'ok 0 coperto, 1 scritto nessuna');

-- «Non è questo» toglie il segno della banca: il movimento a mano torna libero.
select atteso('«Non è questo» sulla banca', come(ada(), 'authenticated', $$select banca_non_e_questo('banca:k1')$$) || ' ' || chiave_di(:'m1') || ' ' || stato_banca('banca:k1'), 'ok nessuna 0 coperto, 1 scritto');
