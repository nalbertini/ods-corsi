-- Le fatture dalla chat (72-movimenti-dalla-chat.sql): chi ha l'amministrazione fotografa a Claude
-- la fattura o lo scontrino di un fornitore, e il server MCP (supabase/functions/mcp) registra il
-- movimento col token di quella persona. Qui il lato database:
--   · `movimenti.chiave_chat` (unica dove c'è) e `movimenti.dalla_chat` (falso per tutto il resto);
--   · `registra_movimento_dalla_chat(dati)`: le stesse regole di `registra_movimento` (59 e 60),
--     niente incassi degli iscritti, e la stessa chiave due volte scrive una volta sola;
--     e la stessa chiave con altri dati (un'altra persona, un movimento annullato, tipo, importo o
--     descrizione diversi) è rifiutata; una chiave oltre 100 caratteri pure;
--   · `movimenti_simili(testo)`: al più cinque uscite a mano non annullate, mai una persona (né
--     collegata né scritta nella descrizione), una voce di sistema o chi le ha scritte.
-- Solo `e_amministrazione()`. Le stesse regole lato app: scripts/prova-mcp.mjs.
-- Si lancia dopo finto-supabase.sql e i file dello schema, su un database suo.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

create or replace function atteso(cosa text, avuto text, voluto text) returns text language plpgsql as $$
begin
  if avuto is distinct from voluto and not (voluto like '%…' and avuto like replace(voluto, '…', '%')) then
    raise exception '% · atteso «%», avuto «%»', cosa, voluto, avuto;
  end if;
  return 'ok  ' || cosa || ' → ' || avuto;
end $$;
select (to_regclass('public.chiusure_cassa') is not null)::text as c60 \gset
select atteso('60-chiusura-cassa.sql è stato lanciato: serve ai giorni chiusi', :'c60', 'true');
select (to_regprocedure('public.registra_movimento_dalla_chat(jsonb)') is not null
    and to_regprocedure('public.movimenti_simili(text)') is not null
    and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'movimenti' and column_name = 'chiave_chat')
    and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'movimenti' and column_name = 'dalla_chat'))::text as c72 \gset
select atteso('72-movimenti-dalla-chat.sql è stato lanciato: le due colonne e le due funzioni', :'c72', 'true');

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'ada@ods.it'),
  ('33333333-3333-3333-3333-333333333333', 'sandro@ods.it'),
  ('55555555-5555-5555-5555-555555555555', 'maura@ods.it'),
  ('66666666-6666-6666-6666-666666666666', 'senza@ods.it'),
  ('77777777-7777-7777-7777-777777777777', 'luca@ods.it'),
  ('99999999-9999-9999-9999-999999999999', 'tablet@ods.it');
-- Anna: solo segreteria. Ada: amministrazione (il suo cognome non deve uscire dai simili).
-- Sandro: segreteria e amministrazione. Maura: istruttore. Luca: iscritto.
-- «senza» ha un accesso ma nessuna scheda.
insert into persone (id, nome, cognome, ruolo, anche_istruttore, anche_amministrazione, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', false, false, 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Ada', 'Ragionieri', 'amministrazione', false, false, 'ada@ods.it', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Sandro', 'Doppio', 'staff', false, true, 'sandro@ods.it', '33333333-3333-3333-3333-333333333333'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'Maura', 'Uno', 'istruttore', false, false, 'maura@ods.it', '55555555-5555-5555-5555-555555555555'),
  ('aaaaaaaa-0000-0000-0000-000000000007', 'Luca', 'Rossi', 'iscritto', false, false, 'luca@ods.it', '77777777-7777-7777-7777-777777777777');
insert into sale (id, nome) values ('bbbbbbbb-0000-0000-0000-000000000001', 'Tatami');
insert into postazioni (id, nome, sala_id, utente_id) values
  ('dddddddd-0000-0000-0000-000000000001', 'Tablet', 'bbbbbbbb-0000-0000-0000-000000000001', '99999999-9999-9999-9999-999999999999');

create or replace function chi(u text) returns void language plpgsql as $$
begin perform set_config('prova.utente', u, false); end $$;
-- Come finisce un'istruzione: «ok», oppure «codice messaggio». 42501 è «non tocca a te», 22023 «i dati non vanno».
create or replace function esito(sql text) returns text language plpgsql as $$
begin execute sql; return 'ok';
exception when others then return sqlstate || ' ' || sqlerrm;
end $$;
-- Le date si contano da oggi a Roma: la prova gira in qualunque giorno.
create or replace function giorno(indietro int) returns text language sql stable security definer set search_path = public as $$
  select ((now() at time zone 'Europe/Rome')::date - indietro)::text $$;
create or replace function id_cassa(n text) returns uuid language sql stable security definer set search_path = public as $$
  select id from casse where nome = n $$;
create or replace function id_voce(n text, t text) returns uuid language sql stable security definer set search_path = public as $$
  select id from voci_contabili where nome = n and tipo::text = t $$;
-- Un movimento dalla chat in jsonb, con voce e cassa cercate per nome.
create or replace function chat(k text, t text, g text, i int, v text, c text, d text) returns jsonb
  language sql stable security definer set search_path = public as $$
  select jsonb_strip_nulls(jsonb_build_object('chiave', k, 'tipo', t, 'data', g, 'importo', i,
    'voce_id', (select vc.id from voci_contabili vc where vc.nome = v and vc.tipo::text = t),
    'cassa_id', (select ca.id from casse ca where ca.nome = c),
    'descrizione', d))
$$;
create or replace function quanti(k text) returns text language sql stable security definer set search_path = public as $$
  select count(*)::text from movimenti where chiave_chat = k $$;
-- Tutto il contenuto dei movimenti, per accorgersi di una riga che cambia.
create or replace function impronta() returns text language sql stable security definer set search_path = public as $$
  select md5(coalesce((select string_agg(m::text, '|' order by m.id) from movimenti m), '')) $$;
-- I simili come li vede chi chiama, in una riga di testo.
create or replace function simili(t text) returns text language sql stable as $$
  select coalesce(string_agg(s.descrizione, ' | ' order by s.data desc, s.descrizione), '—') from movimenti_simili(t) s $$;
grant execute on function atteso(text, text, text), chi(text), esito(text), giorno(int), id_cassa(text), id_voce(text, text),
  chat(text, text, text, int, text, text, text), quanti(text), impronta(), simili(text) to anon, authenticated;

-- Le voci e le casse: Utenze e Telefono (poi disattivata) fra le uscite, «Da classificare» come
-- la lascia l'import dello storico. La Cassa Contanti parte 100 giorni fa ed è chiusa fino a 50
-- giorni fa.
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('si crea «Utenze»', esito($$select salva_voce('{"nome": "Utenze", "tipo": "uscita"}')$$), 'ok');
select atteso('si crea «Telefono»', esito($$select salva_voce('{"nome": "Telefono", "tipo": "uscita"}')$$), 'ok');
select atteso('si crea «Donazioni»', esito($$select salva_voce('{"nome": "Donazioni", "tipo": "entrata"}')$$), 'ok');
select atteso('la Cassa Contanti parte 100 giorni fa', esito(format('select imposta_saldo_cassa(id => %L, saldo => 10000, dal => %L)', id_cassa('Cassa Contanti'), giorno(100))), 'ok');
reset role;
insert into voci_contabili (nome, tipo) values ('Da classificare', 'entrata'), ('Da classificare', 'uscita') on conflict do nothing;
insert into chiusure_cassa (cassa_id, dal, data, previsto, contato, differenza, chiusa_da)
  values (id_cassa('Cassa Contanti'), giorno(100)::date, giorno(50)::date, 10000, 10000, 0, 'aaaaaaaa-0000-0000-0000-000000000002');

\echo ''
\echo '--- 1. solo l''amministrazione: gli altri si sentono dire di no e non scrivono niente ---'
select impronta() as prima \gset
create or replace function da(utente text, ruolo text, sql text) returns text language plpgsql as $$
declare r text;
begin
  perform set_config('prova.utente', utente, false);
  execute format('set role %I', ruolo);
  r := esito(sql);
  reset role;
  return r;
end $$;
select atteso('la segreteria semplice non registra', da('11111111-1111-1111-1111-111111111111', 'authenticated', format('select registra_movimento_dalla_chat(%L)', chat('N1', 'uscita', giorno(5), 4590, 'Utenze', 'Conto Corrente', 'Enel bolletta'))), '42501 la contabilità la cura l’amministrazione');
select atteso('…né cerca i simili', da('11111111-1111-1111-1111-111111111111', 'authenticated', $$select movimenti_simili('enel')$$), '42501 la contabilità la cura l’amministrazione');
select atteso('l''istruttore non registra', da('55555555-5555-5555-5555-555555555555', 'authenticated', format('select registra_movimento_dalla_chat(%L)', chat('N2', 'uscita', giorno(5), 4590, 'Utenze', 'Conto Corrente', 'Enel bolletta'))), '42501 la contabilità la cura l’amministrazione');
select atteso('…né cerca i simili', da('55555555-5555-5555-5555-555555555555', 'authenticated', $$select movimenti_simili('enel')$$), '42501 la contabilità la cura l’amministrazione');
select atteso('il tablet non registra', da('99999999-9999-9999-9999-999999999999', 'authenticated', format('select registra_movimento_dalla_chat(%L)', chat('N3', 'uscita', giorno(5), 4590, 'Utenze', 'Conto Corrente', 'Enel bolletta'))), '42501 la contabilità la cura l’amministrazione');
select atteso('…né cerca i simili', da('99999999-9999-9999-9999-999999999999', 'authenticated', $$select movimenti_simili('enel')$$), '42501 la contabilità la cura l’amministrazione');
select atteso('l''iscritto non registra', da('77777777-7777-7777-7777-777777777777', 'authenticated', format('select registra_movimento_dalla_chat(%L)', chat('N4', 'uscita', giorno(5), 4590, 'Utenze', 'Conto Corrente', 'Enel bolletta'))), '42501 la contabilità la cura l’amministrazione');
select atteso('…né cerca i simili', da('77777777-7777-7777-7777-777777777777', 'authenticated', $$select movimenti_simili('enel')$$), '42501 la contabilità la cura l’amministrazione');
select atteso('un accesso senza scheda non registra', da('66666666-6666-6666-6666-666666666666', 'authenticated', format('select registra_movimento_dalla_chat(%L)', chat('N5', 'uscita', giorno(5), 4590, 'Utenze', 'Conto Corrente', 'Enel bolletta'))), '42501 la contabilità la cura l’amministrazione');
select atteso('chi non ha fatto l''accesso non chiama registra_movimento_dalla_chat', da('', 'anon', format('select registra_movimento_dalla_chat(%L)', chat('N6', 'uscita', giorno(5), 4590, 'Utenze', 'Conto Corrente', 'Enel bolletta'))), '42501 permission denied for function registra_movimento_dalla_chat');
select atteso('…né movimenti_simili', da('', 'anon', $$select movimenti_simili('enel')$$), '42501 permission denied for function movimenti_simili');
select atteso('nessuno ha scritto niente', impronta(), :'prima');
select atteso('chi non è amministrazione non scrive dritto la chiave', da('11111111-1111-1111-1111-111111111111', 'authenticated', $$update movimenti set chiave_chat = 'X', dalla_chat = true$$), '42501 permission denied for table movimenti');

\echo ''
\echo '--- 2. la stessa chiave due volte: un movimento solo, la seconda volta quello di prima ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select (registra_movimento_dalla_chat(chat('K1', 'uscita', giorno(6), 31240, 'Utenze', 'Conto Corrente', 'Enel · bolletta n. 123'))).id as primo \gset
select (registra_movimento_dalla_chat(chat('K1', 'uscita', giorno(6), 31240, 'Utenze', 'Conto Corrente', 'Enel · bolletta n. 123'))).id as secondo \gset
reset role;
select atteso('un solo movimento con la chiave K1', quanti('K1'), '1');
select atteso('la seconda risposta è il movimento di prima', :'secondo', :'primo');
select atteso('il movimento è segnato dalla chat, scritto da Ada, con la chiave',
  (select dalla_chat || ' ' || creato_da || ' ' || chiave_chat || ' ' || importo || ' ' || tipo from movimenti where id = :'primo'),
  'true aaaaaaaa-0000-0000-0000-000000000002 K1 31240 uscita');
select atteso('…con la voce e la cassa scelte', (select v.nome || ' ' || c.nome from movimenti m join voci_contabili v on v.id = m.voce_id join casse c on c.id = m.cassa_id where m.id = :'primo'), 'Utenze Conto Corrente');
select atteso('la chiave è unica anche fuori dalla funzione', esito($$insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione, chiave_chat)
  select tipo, data, importo, voce_id, cassa_id, 'copia', chiave_chat from movimenti where chiave_chat = 'K1'$$), '23505 duplicate key value violates unique constraint …');
select atteso('…ma i movimenti senza chiave sono tanti quanti si vuole', esito($$insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione, chiave_chat)
  select tipo, data, importo, voce_id, cassa_id, 'senza chiave ' || g, null from movimenti, generate_series(1, 2) g where chiave_chat = 'K1'$$), 'ok');
delete from movimenti where descrizione like 'senza chiave %';
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('un movimento scritto dall''app non è dalla chat e non ha chiave',
  esito(format('select registra_movimento(%L)', chat(null, 'uscita', giorno(7), 5000, 'Utenze', 'Conto Corrente', 'Acqua dall''app'))), 'ok');
reset role;
select atteso('…dalla_chat falso, chiave vuota', (select dalla_chat || ' ' || coalesce(chiave_chat, '—') from movimenti where descrizione = 'Acqua dall''app'), 'false —');
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('la segreteria che ha anche l''amministrazione registra', esito(format('select registra_movimento_dalla_chat(%L)', chat('K-sandro', 'uscita', giorno(6), 2380, 'Utenze', 'Conto Corrente', 'Ferramenta Bianchi'))), 'ok');
reset role;
select atteso('…e il movimento è suo', (select creato_da::text from movimenti where chiave_chat = 'K-sandro'), 'aaaaaaaa-0000-0000-0000-000000000003');

\echo ''
\echo '--- 3. le regole di registra_movimento (59 e 60), e niente incassi degli iscritti ---'
select impronta() as prima \gset
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('importo zero no', esito(format('select registra_movimento_dalla_chat(%L)', chat('R1', 'uscita', giorno(5), 0, 'Utenze', 'Conto Corrente', 'Enel'))), '22023 L’importo deve essere più di zero');
select atteso('importo negativo no', esito(format('select registra_movimento_dalla_chat(%L)', chat('R2', 'uscita', giorno(5), -500, 'Utenze', 'Conto Corrente', 'Enel'))), '22023 L’importo deve essere più di zero');
select atteso('oltre i centomila euro no', esito(format('select registra_movimento_dalla_chat(%L)', chat('R3', 'uscita', giorno(5), 10000001, 'Utenze', 'Conto Corrente', 'Enel'))), '22023 L’importo è troppo alto: controlla le cifre');
select atteso('domani (a Roma) no', esito(format('select registra_movimento_dalla_chat(%L)', chat('R4', 'uscita', giorno(-1), 4590, 'Utenze', 'Conto Corrente', 'Enel'))), '22023 La data è nel futuro: si registra quel che è già successo');
select atteso('prima dell''inizio della cassa no', esito(format('select registra_movimento_dalla_chat(%L)', chat('R5', 'uscita', giorno(101), 4590, 'Utenze', 'Cassa Contanti', 'Enel'))), '22023 La data è prima dell’inizio della cassa');
select atteso('un giorno chiuso no, e suggerisce la rettifica', esito(format('select registra_movimento_dalla_chat(%L)', chat('R6', 'uscita', giorno(50), 4590, 'Utenze', 'Cassa Contanti', 'Enel'))),
  '22023 Quel giorno è già chiuso: per correggere scrivi il movimento con una data dopo la chiusura e una voce di rettifica (si crea in VOCI), oppure annulla la chiusura');
select atteso('senza voce no', esito(format('select registra_movimento_dalla_chat(%L)', chat('R7', 'uscita', giorno(5), 4590, null, 'Conto Corrente', 'Enel'))), '22023 Scegli la voce');
select atteso('senza cassa no', esito(format('select registra_movimento_dalla_chat(%L)', chat('R8', 'uscita', giorno(5), 4590, 'Utenze', null, 'Enel'))), '22023 Scegli la cassa');
select atteso('senza descrizione no', esito(format('select registra_movimento_dalla_chat(%L)', chat('R9', 'uscita', giorno(5), 4590, 'Utenze', 'Conto Corrente', null))), '22023 Scrivi una descrizione');
select atteso('un giroconto no', esito(format('select registra_movimento_dalla_chat(%L)', chat('R10', 'giroconto', giorno(5), 4590, null, 'Conto Corrente', 'Enel'))), '22023 Scegli se è un’entrata o un’uscita');
select atteso('«Quota associativa» no', esito(format('select registra_movimento_dalla_chat(%L)', chat('R11', 'entrata', giorno(5), 4590, 'Quota associativa', 'Conto Corrente', 'Quota'))), '22023 Gli incassi degli iscritti si registrano in PAGAMENTI');
select atteso('«Corsi e altri pagamenti» no', esito(format('select registra_movimento_dalla_chat(%L)', chat('R12', 'entrata', giorno(5), 4590, 'Corsi e altri pagamenti', 'Conto Corrente', 'Corso'))), '22023 Gli incassi degli iscritti si registrano in PAGAMENTI');
select atteso('«Differenza di cassa» no', esito(format('select registra_movimento_dalla_chat(%L)', chat('R13', 'uscita', giorno(5), 4590, 'Differenza di cassa', 'Conto Corrente', 'Differenza'))), '22023 La «Differenza di cassa» si scrive da sola chiudendo la cassa');
reset role;
select atteso('nessuno dei rifiutati ha scritto', impronta(), :'prima');
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('il giorno dopo la chiusura, in contanti, sì', esito(format('select registra_movimento_dalla_chat(%L)', chat('R14', 'uscita', giorno(49), 1590, 'Utenze', 'Cassa Contanti', 'Ferramenta Rossi'))), 'ok');
select atteso('«Da classificare» sì, se la si sceglie', esito(format('select registra_movimento_dalla_chat(%L)', chat('R15', 'uscita', giorno(4), 1200, 'Da classificare', 'Conto Corrente', 'Cartoleria'))), 'ok');
reset role;

\echo ''
\echo '--- 4. movimenti_simili: al più cinque, solo a mano e non annullati, mai persone né autori ---'
-- Sette movimenti Enel scritti a mano, dal più vecchio (70 giorni fa) al più nuovo (oggi), e quelli che non devono uscire.
insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione, creato_da)
select 'uscita', giorno(g)::date, 20000 + g, id_voce(case when g = 0 then 'Da classificare' when g = 10 then 'Telefono' else 'Utenze' end, 'uscita'),
       id_cassa('Conto Corrente'), 'Enel bolletta ' || g, 'aaaaaaaa-0000-0000-0000-000000000002'
  from unnest(array[70, 60, 40, 30, 20, 10, 0]) g;
insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione, creato_da, annullato_il, annullato_da)
  values ('uscita', giorno(1)::date, 999, id_voce('Utenze', 'uscita'), id_cassa('Conto Corrente'), 'Enel annullata', 'aaaaaaaa-0000-0000-0000-000000000002', now(), 'aaaaaaaa-0000-0000-0000-000000000002');
insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione, origine_import, persona_id)
  values ('entrata', giorno(1)::date, 5000, id_voce('Corsi e altri pagamenti', 'entrata'), id_cassa('Conto Corrente'), 'Cliente Rossi Luca per Enel', 'prima-nota:1', 'aaaaaaaa-0000-0000-0000-000000000007');
insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione, origine_import, persona_id)
  values ('entrata', giorno(1)::date, 5000, id_voce('Da classificare', 'entrata'), id_cassa('Conto Corrente'), 'Rimborso Enel a Rossi', 'prima-nota:2', 'aaaaaaaa-0000-0000-0000-000000000007');
insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione)
  values ('entrata', giorno(1)::date, 3000, id_voce('Quota associativa', 'entrata'), id_cassa('Conto Corrente'), 'Quota Enel');
insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione)
  values ('uscita', giorno(1)::date, 300, id_voce('Differenza di cassa', 'uscita'), id_cassa('Conto Corrente'), 'Differenza Enel');
insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione)
  values ('uscita', giorno(1)::date, 4000, id_voce('Utenze', 'uscita'), id_cassa('Conto Corrente'), 'Acqua SMAT');
-- Un'uscita collegata a una persona, senza nome nella descrizione: non esce lo stesso (se uscisse, sarebbe la prima di «enel»).
insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione, persona_id)
  values ('uscita', giorno(0)::date, 7000, id_voce('Utenze', 'uscita'), id_cassa('Conto Corrente'), 'Enel rimborso anticipato', 'aaaaaaaa-0000-0000-0000-000000000007');
-- Telefono smette di essere in uso: il simile su quella voce resta, la voce si legge spenta.
update voci_contabili set attiva = false where nome = 'Telefono';

select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('«enel»: i cinque più recenti, senza annullati, persone, voci di sistema', simili('enel'),
  'Enel bolletta 0 | Enel · bolletta n. 123 | Enel bolletta 10 | Enel bolletta 20 | Enel bolletta 30');
select atteso('senza badare alle maiuscole', simili('ENEL'), simili('enel'));
select atteso('un fornitore che non c''è: niente', simili('Iren'), '—');
select atteso('l''acqua: solo quello', simili('smat'), 'Acqua SMAT');
select atteso('la riga dice voce, importo, data e se la voce è in uso',
  (select string_agg(s.voce || ' ' || s.importo || ' ' || s.voce_attiva, ', ' order by s.data desc) from movimenti_simili('enel bolletta 1') s),
  'Telefono 20010 false');
select atteso('mai chi l''ha scritto, né la persona collegata: nemmeno fra le colonne',
  (select count(*)::text from (select jsonb_object_keys(to_jsonb(s)) k from movimenti_simili('enel') s) x
    where k in ('creato_da', 'annullato_da', 'persona_id', 'creato_da_nome', 'autore')), '0');
select atteso('…né il suo nome o il suo id da qualche parte',
  (select count(*)::text from movimenti_simili('enel') s
    where to_jsonb(s)::text ~* 'Ragionieri|aaaaaaaa-0000-0000-0000-000000000002|Rossi'), '0');
reset role;

\echo ''
\echo '--- 5. movimenti_simili: solo uscite, e mai una descrizione col nome di una persona ---'
-- Un incasso del vecchio programma non ancora collegato: il nome della persona c'è, persona_id no.
insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione, origine_import)
  values ('entrata', giorno(2)::date, 6000, id_voce('Da classificare', 'entrata'), id_cassa('Conto Corrente'), 'Cliente Bianchi Giulia per corso bimbi', 'prima-nota:99');
-- Un'uscita scritta «Cliente … per …»: il nome c'è anche qui.
insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione)
  values ('uscita', giorno(2)::date, 2500, id_voce('Utenze', 'uscita'), id_cassa('Conto Corrente'), 'Cliente Verdi Marta per rimborso iscrizione');
-- Un'entrata a mano, senza nomi, su una voce che non è di sistema; e un'uscita con lo stesso testo.
insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione)
  values ('entrata', giorno(2)::date, 15000, id_voce('Donazioni', 'entrata'), id_cassa('Conto Corrente'), 'Contributo Pro Loco');
insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione)
  values ('uscita', giorno(3)::date, 8000, id_voce('Utenze', 'uscita'), id_cassa('Conto Corrente'), 'Pro Loco affitto sala');
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('un incasso non collegato «Cliente Bianchi Giulia per …» non esce cercando «cliente»', simili('cliente'), '—');
select atteso('…né cercando un pezzo del nome («ul»)', simili('ul'), '—');
select atteso('un''uscita con un nome di persona («Cliente Verdi Marta per …») non esce', simili('verdi'), '—');
select atteso('un''entrata a mano non esce: solo le uscite', simili('pro loco'), 'Pro Loco affitto sala');
reset role;

\echo ''
\echo '--- 6. la chiave riusata con altri dati: rifiutata, niente scritto ---'
select atteso('K1 c''è, scritta da Ada', (select creato_da::text from movimenti where chiave_chat = 'K1'), 'aaaaaaaa-0000-0000-0000-000000000002');
select impronta() as prima \gset
select atteso('un''altra persona con la stessa chiave e gli stessi dati no',
  da('33333333-3333-3333-3333-333333333333', 'authenticated', format('select registra_movimento_dalla_chat(%L)', chat('K1', 'uscita', giorno(6), 31240, 'Utenze', 'Conto Corrente', 'Enel · bolletta n. 123'))),
  '22023 Questa registrazione c’è già con altri dati: riprova dalla chat');
select atteso('la stessa persona con un altro importo no',
  da('22222222-2222-2222-2222-222222222222', 'authenticated', format('select registra_movimento_dalla_chat(%L)', chat('K1', 'uscita', giorno(6), 31241, 'Utenze', 'Conto Corrente', 'Enel · bolletta n. 123'))),
  '22023 Questa registrazione c’è già con altri dati: riprova dalla chat');
select atteso('…con un altro tipo no',
  da('22222222-2222-2222-2222-222222222222', 'authenticated', format('select registra_movimento_dalla_chat(%L)', chat('K1', 'entrata', giorno(6), 31240, 'Donazioni', 'Conto Corrente', 'Enel · bolletta n. 123'))),
  '22023 Questa registrazione c’è già con altri dati: riprova dalla chat');
select atteso('…con un''altra descrizione no',
  da('22222222-2222-2222-2222-222222222222', 'authenticated', format('select registra_movimento_dalla_chat(%L)', chat('K1', 'uscita', giorno(6), 31240, 'Utenze', 'Conto Corrente', 'Enel · bolletta n. 124'))),
  '22023 Questa registrazione c’è già con altri dati: riprova dalla chat');
select atteso('nessuno dei rifiutati ha scritto', impronta(), :'prima');
select atteso('con gli stessi dati e la stessa persona: il movimento di prima',
  da('22222222-2222-2222-2222-222222222222', 'authenticated', format('select registra_movimento_dalla_chat(%L)', chat('K1', 'uscita', giorno(6), 31240, 'Utenze', 'Conto Corrente', 'Enel · bolletta n. 123'))), 'ok');
select atteso('…e K1 resta una', quanti('K1'), '1');
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select (registra_movimento_dalla_chat(chat('K-ann', 'uscita', giorno(6), 4400, 'Utenze', 'Conto Corrente', 'Iren · bolletta n. 9'))).id as annullando \gset
select atteso('si annulla il movimento K-ann', esito(format('select annulla_movimento(id => %L)', :'annullando')), 'ok');
reset role;
select impronta() as prima \gset
select atteso('un movimento annullato non torna con la stessa chiave, nemmeno con gli stessi dati',
  da('22222222-2222-2222-2222-222222222222', 'authenticated', format('select registra_movimento_dalla_chat(%L)', chat('K-ann', 'uscita', giorno(6), 4400, 'Utenze', 'Conto Corrente', 'Iren · bolletta n. 9'))),
  '22023 Questa registrazione c’è già con altri dati: riprova dalla chat');
select atteso('…e niente scritto', impronta(), :'prima');

\echo ''
\echo '--- 7. la chiave troppo lunga, o che manca ---'
select impronta() as prima \gset
select atteso('una chiave vuota no',
  da('22222222-2222-2222-2222-222222222222', 'authenticated', format('select registra_movimento_dalla_chat(%L)', chat('', 'uscita', giorno(5), 1700, 'Utenze', 'Conto Corrente', 'Cartoleria Neri'))),
  '22023 Manca la chiave della registrazione: riprova dalla chat');
select atteso('…né senza la chiave',
  da('22222222-2222-2222-2222-222222222222', 'authenticated', format('select registra_movimento_dalla_chat(%L)', chat(null, 'uscita', giorno(5), 1700, 'Utenze', 'Conto Corrente', 'Cartoleria Neri'))),
  '22023 Manca la chiave della registrazione: riprova dalla chat');
select atteso('una chiave di 101 caratteri no',
  da('22222222-2222-2222-2222-222222222222', 'authenticated', format('select registra_movimento_dalla_chat(%L)', chat(repeat('x', 101), 'uscita', giorno(5), 1700, 'Utenze', 'Conto Corrente', 'Cartoleria Neri'))),
  '22023 La chiave della registrazione è troppo lunga: riprova dalla chat');
select atteso('…e niente scritto', impronta(), :'prima');
select atteso('una di 100 sì',
  da('22222222-2222-2222-2222-222222222222', 'authenticated', format('select registra_movimento_dalla_chat(%L)', chat(repeat('y', 100), 'uscita', giorno(5), 1700, 'Utenze', 'Conto Corrente', 'Cartoleria Neri'))), 'ok');
