-- La sezione IMPORTAZIONI (114-importazioni.sql, cambiata da 132-satispay-solo-chi-ha-pagato.sql): i pagamenti Satispay
-- «forse già scritti a mano» non si decidono più (`satispay_decidi_gruppo` rifiuta), «Non è questo» scollega un pagamento da un movimento a mano
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

-- Un movimento della cassa Satispay come c'era prima del 132, che non ne lascia scrivere di nuovi: il trigger (se c'è) si spegne il tempo di scriverlo.
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
-- Un pagamento già collegato a mano a un movimento (come l'ha lasciato il 114): esito a_mano, il movimento col segno.
create or replace function collegato(sid text, d text, i int, quando text) returns uuid language plpgsql security definer set search_path = public as $f$
declare m uuid;
begin
  insert into satispay_negozio (satispay_id, tipo, stato, importo, quando, chi, esito, motivo)
    values (sid, 'TO_BUSINESS', 'ACCEPTED', i, quando::timestamptz, 'Mario', 'a_mano', 'forse_doppione');
  m := vecchio(d, i, 'Bonifico di Mario');
  update movimenti set satispay_id = sid where id = m;
  update satispay_negozio set movimento_id = m where satispay_id = sid;
  return m;
end $f$;
grant execute on function vecchio(text, int, text, text), collegato(text, text, int, text) to authenticated, service_role;
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
\echo '--- 1. lo stato non propone più candidati: niente da decidere, anche con righe vecchie in tabella ---'
select pulisci();
select vecchio('2026-10-14', 1250, 'Primo') as m1 \gset
select vecchio('2026-10-14', 1250, 'Secondo') as m2 \gset
insert into satispay_negozio (satispay_id, tipo, stato, importo, quando, chi, esito, motivo, candidati)
  values ('D1', 'TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-14T10:00:00Z', 'Mario', 'da_decidere', 'forse_doppione', array[:'m1', :'m2']::uuid[]);
select atteso('D1 è da decidere in tabella, con due candidati…', esito_di('D1') || ' ' || candidati_di('D1'),
  'da_decidere/forse_doppione ' || (select string_agg(x, ',' order by x) from unnest(array[:'m1', :'m2']::text[]) x));
select atteso('…ma lo stato non lo mostra: da_decidere è vuoto',
  come_vedo(ada(), 'authenticated', 'select satispay_scarico_stato()->>''da_decidere'''), '[]');

\echo ''
\echo '--- 2. 114-importazioni.sql è stato lanciato ---'
select (to_regprocedure('public.satispay_decidi_gruppo(jsonb)') is not null
  and to_regprocedure('public.satispay_scollega(text)') is not null
  and to_regprocedure('public.banca_segna_coperti(jsonb)') is not null
  and to_regprocedure('public.banca_non_e_questo(text)') is not null
  and to_regclass('public.banca_coperti') is not null)::text as c114 \gset
select atteso('ci sono satispay_decidi_gruppo, satispay_scollega, banca_segna_coperti, banca_non_e_questo e banca_coperti', :'c114', 'true');

\echo ''
\echo '--- 3. satispay_decidi_gruppo rifiuta, in qualunque forma, e non cambia niente ---'
select pulisci();
select vecchio('2026-10-14', 1250, 'Primo') as m1 \gset
select vecchio('2026-10-14', 1250, 'Secondo') as m2 \gset
insert into satispay_negozio (satispay_id, tipo, stato, importo, quando, chi, esito, motivo)
  values ('P1', 'TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-14T09:00:00Z', 'Mario', 'da_decidere', 'forse_doppione'),
         ('P2', 'TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-14T11:00:00Z', 'Mario', 'da_decidere', 'forse_doppione');
select impronta() as prima \gset
select atteso('un movimento a mano a testa: rifiutato',
  come(ada(), 'authenticated', format('select satispay_decidi_gruppo(%L::jsonb)',
    jsonb_build_array(jsonb_build_object('satispayId', 'P1', 'scelta', 'a_mano', 'movimentoId', :'m1'), jsonb_build_object('satispayId', 'P2', 'scelta', 'a_mano', 'movimentoId', :'m2')))),
  '22023 Satispay non si decide più: i soldi arrivano col versamento in banca. Ricarica la pagina');
select atteso('«oggi» per tutti e due: rifiutato', come(ada(), 'authenticated', format('select satispay_decidi_gruppo(%L::jsonb)',
    jsonb_build_array(jsonb_build_object('satispayId', 'P1', 'scelta', 'oggi'), jsonb_build_object('satispayId', 'P2', 'scelta', 'oggi')))), '22023 Satispay non si decide più: i soldi arrivano col versamento in banca. Ricarica la pagina');
select chiusura('Satispay', '2026-10-15') as _;
select atteso('«scrivi» in un giorno chiuso: rifiutato lo stesso, col solito messaggio',
  come(ada(), 'authenticated', $$select satispay_decidi_gruppo('[{"satispayId": "P1", "scelta": "scrivi"}]'::jsonb)$$), '22023 Satispay non si decide più: i soldi arrivano col versamento in banca. Ricarica la pagina');
select atteso('«fuori»', come(ada(), 'authenticated', $$select satispay_decidi_gruppo('[{"satispayId": "P1", "scelta": "fuori"}]'::jsonb)$$), '22023 Satispay non si decide più: i soldi arrivano col versamento in banca. Ricarica la pagina');
select atteso('un pagamento che non c''è: rifiutato con lo stesso messaggio, non «non c''è»', come(ada(), 'authenticated', $$select satispay_decidi_gruppo('[{"satispayId": "XX", "scelta": "fuori"}]'::jsonb)$$), '22023 Satispay non si decide più: i soldi arrivano col versamento in banca. Ricarica la pagina');
select atteso('una lista che non è una lista', come(ada(), 'authenticated', $$select satispay_decidi_gruppo('{}'::jsonb)$$), '22023 Satispay non si decide più: i soldi arrivano col versamento in banca. Ricarica la pagina');
select atteso('…e non è cambiato niente: movimenti, esiti, segni', impronta(), :'prima');

\echo ''
\echo '--- 4. satispay_scollega: «Non è questo» scioglie un collegamento già fatto, il pagamento va nel versamento ---'
select pulisci();
select collegato('P1', '2026-10-14', 1250, '2026-10-14T10:00:00Z') as m1 \gset
select vecchio('2026-10-14', 1250, 'Un altro bonifico') as m2 \gset
select atteso('P1 era collegato a mano', esito_di('P1') || ' ' || n_mov_di('P1'), 'a_mano/forse_doppione 1');
select atteso('«Non è questo»: ok', come(ada(), 'authenticated', $$select satispay_scollega('P1')$$), 'ok');
select atteso('…il pagamento va fuori, nel versamento (non torna da decidere), senza movimento',
  esito_di('P1') || ' ' || (select (movimento_id is null)::text from satispay_negozio where satispay_id = 'P1'), 'fuori/nel_versamento true');
select atteso('…il movimento a mano resta com''era, senza segno',
  (select concat_ws('|', descrizione, coalesce(satispay_id, 'senza segno'), (annullato_il is null)::text) from movimenti where id = :'m1'), 'Bonifico di Mario|senza segno|true');
select atteso('…niente candidati, niente da decidere', candidati_di('P1') || ' ' || come_vedo(ada(), 'authenticated', 'select satispay_scarico_stato()->>''da_decidere'''), 'nessuno []');
select atteso('…e lo scarico di notte non lo riprende', conti(app(true)) || ' ' || esito_di('P1') || ' ' || n_mov_di('P1'), '0/0/0/0/0/0 fuori/nel_versamento 0');
select atteso('un pagamento già scollegato non si scollega', come(ada(), 'authenticated', $$select satispay_scollega('P1')$$), '22023 Questo pagamento non è collegato a un movimento a mano');
select atteso('un pagamento che non c''è', come(ada(), 'authenticated', $$select satispay_scollega('XX')$$), 'P0002 Il pagamento non c’è');

-- Il movimento stava nel Conto Corrente (spostato a mano): si scioglie lo stesso.
select pulisci();
select collegato('P1', '2026-10-14', 1250, '2026-10-14T10:00:00Z') as m1 \gset
update movimenti set cassa_id = id_cassa('Conto Corrente') where id = :'m1';
select atteso('anche se il movimento sta nel Conto Corrente: si scioglie, il pagamento va nel versamento',
  come(ada(), 'authenticated', $$select satispay_scollega('P1')$$) || ' ' || esito_di('P1'), 'ok fuori/nel_versamento');

select pulisci();
select sal(pag('P3', 'TO_BUSINESS', 'ACCEPTED', 300, '2026-10-14T10:00:00Z', 'Sara')) as _;
select conti(app(true)) as _;
select atteso('uno fuori nel versamento non si scollega', come(ada(), 'authenticated', $$select satispay_scollega('P3')$$), '22023 Questo pagamento non è collegato a un movimento a mano');
select atteso('…e resta com''è', esito_di('P3') || ' ' || n_mov_di('P3'), 'fuori/nel_versamento 0');

select pulisci();
select collegato('P1', '2026-10-14', 1250, '2026-10-14T10:00:00Z') as m1 \gset
select chiusura('Conto Corrente', '2026-10-31') as _;
select atteso('la chiusura di un''altra cassa non conta: si scollega',
  come(ada(), 'authenticated', $$select satispay_scollega('P1')$$), 'ok');
select atteso('…e va nel versamento, senza passare da «da decidere»', esito_di('P1'), 'fuori/nel_versamento');
select pulisci();
select collegato('P1', '2026-10-14', 1250, '2026-10-14T10:00:00Z') as m1 \gset
select chiusura('Satispay', '2026-10-15') as _;
select atteso('la cassa del movimento è chiusa quel giorno: il collegamento resta',
  come(ada(), 'authenticated', $$select satispay_scollega('P1')$$), '22023 Quel giorno la cassa è chiusa: il collegamento resta');
select atteso('…il pagamento è ancora a_mano e il movimento ha ancora il segno', esito_di('P1') || ' ' || n_mov_di('P1'), 'a_mano/forse_doppione 1');

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
select atteso('…dopo tutti questi no P1 è ancora collegato', esito_di('P1') || ' ' || n_mov_di('P1'), 'a_mano/forse_doppione 1');

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
  (select concat_ws('|', data, tipo, importo, descrizione, (con_id = :'c1')::text, con_descrizione) from banca_coperti where chiave = 'banca:20261003:abc:0'),
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
select atteso('lo scarico non lo collega a m1 e non scrive niente', esito_di('P1') || ' ' || coalesce((select satispay_id from movimenti where id = :'m1'), 'senza segno') || ' ' || n_mov(), 'fuori/nel_versamento senza segno 1');

-- La banca copre un candidato dopo che il pagamento è finito «da decidere».
select pulisci(); select pulisci_banca();
select a_mano('2026-10-14', 1250, 'Conto Corrente', 'Primo') as m1 \gset
select a_mano('2026-10-14', 1250, 'Conto Corrente', 'Secondo') as m2 \gset
select a_mano('2026-10-14', 1250, 'Conto Corrente', 'Terzo') as m3 \gset
select sal(pag('P1', 'TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-14T10:00:00Z', 'Mario')) as _;
-- Dal 116 lo scarico non propone più movimenti del Conto Corrente: qui il «da decidere» è uno rimasto da prima,
-- e le guardie contro la banca restano.
update satispay_negozio set esito = 'da_decidere', motivo = 'forse_doppione', candidati = array[:'m1', :'m2', :'m3']::uuid[] where satispay_id = 'P1';
select copre('banca:k1', :'m1') as _;
select atteso('sceglierlo lo stesso (pagina vecchia): errore, Satispay non si decide più',
  come(ada(), 'authenticated', format('select satispay_decidi_gruppo(%L::jsonb)', jsonb_build_array(jsonb_build_object('satispayId', 'P1', 'scelta', 'a_mano', 'movimentoId', :'m1')))),
  '22023 Satispay non si decide più: i soldi arrivano col versamento in banca. Ricarica la pagina');
select atteso('…e P1 è ancora com''era', esito_di('P1'), 'da_decidere/forse_doppione');
select atteso('anche dritto sulla tabella, un movimento non ha tutti e due i segni',
  left(esito(format('update movimenti set satispay_id = %L where id = %L', 'P1', :'m1')), 5), '23514');

-- Il movimento è già di Satispay (collegato prima del 132): la riga della banca non lo copre, entra nuova.
update movimenti set satispay_id = 'P1' where id = :'m2';
update satispay_negozio set esito = 'a_mano', movimento_id = :'m2', candidati = null where satispay_id = 'P1';
select atteso('un movimento già di Satispay non si copre: la riga entra nuova', copre('banca:k2', :'m2') || ' ' || stato_banca('banca:k2') || ' ' || chiave_di(:'m2'), 'ok 0 coperto, 1 scritto nessuna');
select atteso('…nel Conto Corrente, da classificare',
  (select concat_ws('|', m.tipo, m.data, m.importo, c.nome, v.nome, m.descrizione) from movimenti m join casse c on c.id = m.cassa_id join voci_contabili v on v.id = m.voce_id where m.origine_import = 'banca:k2'),
  'entrata|2026-10-14|1250|Conto Corrente|Da classificare|Da Mario BONIFICO');
select atteso('anche dritto sulla tabella, un movimento di Satispay non prende il segno della banca',
  left(esito(format('update movimenti set banca_chiave = %L where id = %L', 'banca:dritta', :'m2')), 5), '23514');
select atteso('una seconda riga della banca sullo stesso movimento: entra nuova', copre('banca:k3', :'m1') || ' ' || stato_banca('banca:k3') || ' ' || chiave_di(:'m1'), 'ok 0 coperto, 1 scritto banca:k1');
select atteso('un altro importo: entra nuova', copre('banca:k4', :'m3', 999) || ' ' || stato_banca('banca:k4') || ' ' || chiave_di(:'m3'), 'ok 0 coperto, 1 scritto nessuna');
select atteso('un movimento che non c''è: entra nuova', copre('banca:k5', 'aaaaaaaa-9999-0000-0000-000000000000') || ' ' || stato_banca('banca:k5'), 'ok 0 coperto, 1 scritto');
select atteso('rilanciata con la stessa riga: non cambia niente', copre('banca:k1', :'m1') || ' ' || stato_banca('banca:k1') || ' ' || chiave_di(:'m1'), 'ok 1 coperto, 0 scritto banca:k1');
select atteso('rilanciata una riga già scritta nuova: non la riscrive', copre('banca:k2', :'m3') || ' ' || stato_banca('banca:k2') || ' ' || chiave_di(:'m3'), 'ok 0 coperto, 1 scritto nessuna');

-- «Non è questo» toglie il segno della banca: il movimento a mano torna libero.
select atteso('«Non è questo» sulla banca', come(ada(), 'authenticated', $$select banca_non_e_questo('banca:k1')$$) || ' ' || chiave_di(:'m1') || ' ' || stato_banca('banca:k1'), 'ok nessuna 0 coperto, 1 scritto');

\echo ''
\echo '--- 9. banca: una riga coperta da una ricevuta o da un pagamento a mano (incasso:…) ---'
-- Gli id come li fa incassiDerivati (src/lib/contabilita.ts): incasso:<ricevuta>:<voce>:<pagamento> e incasso:diretto:<pagamento>.
select pulisci(); select pulisci_banca();
update casse set dal = '2026-09-01' where nome = 'Conto Corrente';
create or replace function ricevuta_con(metodo text, importo int, annullata boolean default false) returns uuid
  language sql security definer set search_path = public as $$
  insert into ricevute (anno, numero, data, persona_id, ente, intestatario, voci, totale, pagato, anticipo, annullata_il)
  values (2026, (select coalesce(max(numero), 0) + 1 from ricevute where anno = 2026), '2026-10-14', 'aaaaaaaa-0000-0000-0000-000000000007', '{}', '{"nome": "Luca", "cognome": "Rossi"}',
    jsonb_build_array(jsonb_build_object('descrizione', 'ALTRO', 'quantita', 1, 'prezzo', importo,
      'pagamenti', jsonb_build_array(jsonb_build_object('data', '2026-10-14', 'importo', importo, 'metodo', metodo)))),
    importo, importo, 0, case when annullata then now() end)
  returning id $$;
create or replace function diretto_con(metodo text, importo int, annullato boolean default false) returns uuid
  language sql security definer set search_path = public as $$
  insert into pagamenti_diretti (persona_id, data, importo, metodo, voce, annullato_il)
  values ('aaaaaaaa-0000-0000-0000-000000000007', '2026-10-14', importo, metodo, 'ALTRO', case when annullato then now() end)
  returning id $$;
grant execute on function ricevuta_con(text, int, boolean), diretto_con(text, int, boolean) to authenticated;
-- Una riga della banca coperta da quell'incasso (entrata del 14 ottobre).
create or replace function copre_incasso(chiave text, con text, importo int default 12000, tipo text default 'entrata') returns text language sql as $$
  select come(ada(), 'authenticated', format('select banca_segna_coperti(%L::jsonb)', jsonb_build_array(jsonb_build_object(
    'chiave', chiave, 'data', '2026-10-14', 'tipo', tipo, 'importo', importo, 'descrizione', 'Da Mario BONIFICO', 'conId', con, 'conDescrizione', 'incasso')))) $$;
create or replace function n_mov_tutti() returns text language sql security definer set search_path = public as $$
  select count(*)::text from movimenti $$;
grant execute on function copre_incasso(text, text, int, text), n_mov_tutti() to authenticated;

select ricevuta_con('Bonifico', 12000) as r1 \gset
select diretto_con('pos', 12000) as d1 \gset
select 'incasso:' || :'r1' || ':0:0' as i_r1 \gset
select 'incasso:diretto:' || :'d1' as i_d1 \gset

select atteso('ricevuta in bonifico: la riga della banca la copre', copre_incasso('banca:i1', :'i_r1') || ' ' || stato_banca('banca:i1'), 'ok 1 coperto, 0 scritto');
select atteso('…il coperto ha l''id dell''incasso come con_id e nessun movimento è nato',
  (select con_id from banca_coperti where chiave = 'banca:i1') || ' ' || n_mov_tutti(), :'i_r1' || ' 0');
select atteso('pagamento a mano in POS: la riga della banca lo copre', copre_incasso('banca:i2', :'i_d1') || ' ' || stato_banca('banca:i2'), 'ok 1 coperto, 0 scritto');
select atteso('…con_id = l''id dell''incasso, ancora nessun movimento', (select con_id from banca_coperti where chiave = 'banca:i2') || ' ' || n_mov_tutti(), :'i_d1' || ' 0');
select atteso('lo stesso movimento a mano di prima non è toccato: i coperti restano due', (select count(*)::text from banca_coperti), '2');

select atteso('rilanciata con le stesse righe: non cambia niente',
  copre_incasso('banca:i1', :'i_r1') || ' ' || copre_incasso('banca:i2', :'i_d1') || ' ' || (select count(*)::text from banca_coperti) || ' ' || n_mov_tutti(), 'ok ok 2 0');

-- Un incasso copre una riga sola.
select atteso('una seconda riga della banca sullo stesso incasso: entra «Da classificare»',
  copre_incasso('banca:i3', :'i_r1') || ' ' || stato_banca('banca:i3'), 'ok 0 coperto, 1 scritto');
select atteso('…nel Conto Corrente',
  (select concat_ws('|', m.tipo, m.importo, c.nome, v.nome) from movimenti m join casse c on c.id = m.cassa_id join voci_contabili v on v.id = m.voce_id where m.origine_import = 'banca:i3'),
  'entrata|12000|Conto Corrente|Da classificare');

-- Se l'incasso non regge la riga entra «Da classificare», come per un movimento a mano.
select ricevuta_con('Bonifico', 12000, true) as r_ann \gset
select diretto_con('POS', 12000, true) as d_ann \gset
select ricevuta_con('Contanti', 12000) as r_cont \gset
select ricevuta_con('Carta', 12000) as r_carta \gset
select ricevuta_con('Satispay', 12000) as r_sat \gset
select diretto_con('Contanti', 12000) as d_cont \gset
select ricevuta_con('Assegno', 5000) as r_ass \gset
select atteso('ricevuta annullata: entra «Da classificare»', copre_incasso('banca:n1', 'incasso:' || :'r_ann' || ':0:0') || ' ' || stato_banca('banca:n1'), 'ok 0 coperto, 1 scritto');
select atteso('pagamento a mano annullato: entra «Da classificare»', copre_incasso('banca:n2', 'incasso:diretto:' || :'d_ann') || ' ' || stato_banca('banca:n2'), 'ok 0 coperto, 1 scritto');
select atteso('importo diverso: entra «Da classificare»', copre_incasso('banca:n3', 'incasso:' || :'r_ass' || ':0:0', 12000) || ' ' || stato_banca('banca:n3'), 'ok 0 coperto, 1 scritto');
select atteso('…anche per il pagamento a mano', copre_incasso('banca:n4', :'i_d1', 12001) || ' ' || stato_banca('banca:n4'), 'ok 0 coperto, 1 scritto');
select atteso('ricevuta in contanti: entra «Da classificare»', copre_incasso('banca:n5', 'incasso:' || :'r_cont' || ':0:0') || ' ' || stato_banca('banca:n5'), 'ok 0 coperto, 1 scritto');
select atteso('pagamento a mano in contanti: entra «Da classificare»', copre_incasso('banca:n6', 'incasso:diretto:' || :'d_cont') || ' ' || stato_banca('banca:n6'), 'ok 0 coperto, 1 scritto');
select atteso('ricevuta con la carta: entra «Da classificare»', copre_incasso('banca:n7', 'incasso:' || :'r_carta' || ':0:0') || ' ' || stato_banca('banca:n7'), 'ok 0 coperto, 1 scritto');
select diretto_con('Carta', 12000) as d_carta \gset
select diretto_con('Satispay', 12000) as d_sat \gset
select atteso('pagamento a mano con la carta: entra «Da classificare»', copre_incasso('banca:n13', 'incasso:diretto:' || :'d_carta') || ' ' || stato_banca('banca:n13'), 'ok 0 coperto, 1 scritto');
select atteso('pagamento a mano con Satispay: entra «Da classificare»', copre_incasso('banca:n14', 'incasso:diretto:' || :'d_sat') || ' ' || stato_banca('banca:n14'), 'ok 0 coperto, 1 scritto');
select atteso('ricevuta con Satispay: entra «Da classificare»', copre_incasso('banca:n8', 'incasso:' || :'r_sat' || ':0:0') || ' ' || stato_banca('banca:n8'), 'ok 0 coperto, 1 scritto');
select ricevuta_con('Bonifico', 12000) as r_usc \gset
select diretto_con('Bonifico', 12000) as d_usc \gset
select atteso('un''uscita della banca sull''id di una ricevuta: entra «Da classificare»', copre_incasso('banca:u1', 'incasso:' || :'r_usc' || ':0:0', 12000, 'uscita') || ' ' || stato_banca('banca:u1'), 'ok 0 coperto, 1 scritto');
select atteso('un''uscita della banca sull''id di un pagamento a mano: entra «Da classificare»', copre_incasso('banca:u2', 'incasso:diretto:' || :'d_usc', 12000, 'uscita') || ' ' || stato_banca('banca:u2'), 'ok 0 coperto, 1 scritto');
select atteso('ricevuta che non c''è: entra «Da classificare»', copre_incasso('banca:n9', 'incasso:aaaaaaaa-9999-0000-0000-000000000000:0:0') || ' ' || stato_banca('banca:n9'), 'ok 0 coperto, 1 scritto');
select atteso('pagamento a mano che non c''è: entra «Da classificare»', copre_incasso('banca:n10', 'incasso:diretto:aaaaaaaa-9999-0000-0000-000000000000') || ' ' || stato_banca('banca:n10'), 'ok 0 coperto, 1 scritto');
select atteso('voce o pagamento della ricevuta che non ci sono: entra «Da classificare»',
  copre_incasso('banca:n11', 'incasso:' || :'r1' || ':0:5') || ' ' || copre_incasso('banca:n12', 'incasso:' || :'r1' || ':3:0') || ' ' || stato_banca('banca:n11') || ' ' || stato_banca('banca:n12'),
  'ok ok 0 coperto, 1 scritto 0 coperto, 1 scritto');

-- Un conId che non è un uuid né un incasso: errore chiaro, e non entra niente.
select (select count(*) from banca_coperti) as c0, (select count(*) from movimenti) as m0 \gset
select atteso('conId «pippo»: errore 22023', left(copre_incasso('banca:p1', 'pippo'), 5), '22023');
select atteso('conId «incasso:pippo»: errore 22023', left(copre_incasso('banca:p2', 'incasso:pippo'), 5), '22023');
select atteso('…e non entra niente', (select count(*) from banca_coperti)::text || ' ' || (select count(*) from movimenti)::text, :'c0' || ' ' || :'m0');

-- Gli stessi permessi dei coperti da un movimento a mano.
select atteso('la segreteria semplice non copre con un incasso', left(come('11111111-1111-1111-1111-111111111111', 'authenticated', format('select banca_segna_coperti(%L::jsonb)', jsonb_build_array(jsonb_build_object('chiave', 'banca:x1', 'data', '2026-10-14', 'tipo', 'entrata', 'importo', 12000, 'descrizione', 'x', 'conId', :'i_r1', 'conDescrizione', 'x')))), 5), '42501');

\echo ''
\echo '--- 10. banca_non_e_questo su un coperto da incasso ---'
select atteso('«Non è questo»: ok', come(ada(), 'authenticated', $$select banca_non_e_questo('banca:i1')$$), 'ok');
select atteso('…la riga entra «Da classificare» nel Conto Corrente',
  (select concat_ws('|', m.tipo, m.data, m.importo, c.nome, v.nome) from movimenti m join casse c on c.id = m.cassa_id join voci_contabili v on v.id = m.voce_id where m.origine_import = 'banca:i1'),
  'entrata|2026-10-14|12000|Conto Corrente|Da classificare');
select atteso('…esce dai coperti', stato_banca('banca:i1'), '0 coperto, 1 scritto');
select atteso('…la ricevuta è intatta',
  (select (annullata_il is null)::text || ' ' || pagato::text from ricevute where id = :'r1'), 'true 12000');
select atteso('«Non è questo» sul pagamento a mano: ok', come(ada(), 'authenticated', $$select banca_non_e_questo('banca:i2')$$) || ' ' || stato_banca('banca:i2'), 'ok 0 coperto, 1 scritto');
select atteso('…il pagamento è intatto', (select (annullato_il is null)::text || ' ' || importo::text from pagamenti_diretti where id = :'d1'), 'true 12000');
