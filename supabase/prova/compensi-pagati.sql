-- Il compenso pagato finisce in CONTABILITÀ (`81-compensi-pagati.sql`): chi è
-- segreteria e amministrazione insieme paga una o più ricevute dello stesso
-- tecnico con UN movimento d'uscita, voce di sistema «Compensi istruttori»,
-- dalla Cassa Contanti o dal Conto Corrente. Le ricevute si segnano pagate
-- (`movimento_id`, `pagata_il`); una pagata non si annulla; annullato il
-- movimento in CONTABILITÀ tornano da pagare. Le stesse regole della modalità
-- prova, provate da scripts/prova-compensi-pagati.mjs.
-- Si lancia dopo finto-supabase.sql e tutto lo schema (81-compensi-pagati.sql
-- compreso). Le ricevute si seminano da dentro, coi mesi del 2025-26: già
-- passati, così le descrizioni sono sempre le stesse.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('44444444-4444-4444-4444-444444444444', 'sandro@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'ada@ods.it'),
  ('55555555-5555-5555-5555-555555555555', 'maura@ods.it'),
  ('33333333-3333-3333-3333-333333333333', 'luca@ods.it'),
  ('77777777-7777-7777-7777-777777777777', 'tablet@ods.it'),
  ('66666666-6666-6666-6666-666666666666', 'senza@ods.it');
insert into sale (id, nome) values ('bbbbbbbb-0000-0000-0000-000000000001', 'Tatami');
insert into postazioni (id, nome, sala_id, utente_id) values ('dddddddd-0000-0000-0000-000000000001', 'Tablet', 'bbbbbbbb-0000-0000-0000-000000000001', '77777777-7777-7777-7777-777777777777');
-- Anna: segreteria e amministrazione, chi paga. Sandro: solo segreteria. Ada:
-- solo amministrazione. Maura (con l'accesso) e Ivo: i tecnici. Luca: iscritto.
insert into persone (id, nome, cognome, ruolo, anche_istruttore, anche_amministrazione, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', false, true, 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'Sandro', 'Banco', 'staff', false, false, 'sandro@ods.it', '44444444-4444-4444-4444-444444444444'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Ada', 'Conti', 'amministrazione', false, false, 'ada@ods.it', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'Maura', 'Uno', 'istruttore', false, false, 'maura@ods.it', '55555555-5555-5555-5555-555555555555'),
  ('aaaaaaaa-0000-0000-0000-000000000006', 'Ivo', 'Tecnico', 'istruttore', false, false, null, null),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Luca', 'Rossi', 'iscritto', false, false, 'luca@ods.it', '33333333-3333-3333-3333-333333333333');

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
create or replace function atteso(cosa text, avuto text, voluto text) returns text language plpgsql as $$
begin
  if avuto is distinct from voluto and not (voluto like '%…' and avuto like replace(voluto, '…', '%')) then
    raise exception '% · atteso «%», avuto «%»', cosa, voluto, avuto;
  end if;
  return 'ok  ' || cosa || ' → ' || avuto;
end $$;
-- `quanti` giorni fa (0 oggi, -1 domani), `AAAA-MM-GG`.
create or replace function giorno(quanti int = 0) returns text language sql as $$
  select to_char(current_date - quanti, 'YYYY-MM-DD')
$$;
-- Il pagamento di `ricevute` (`{id,id}`), coi nomi giusti: la usa `tenta`, così i rifiuti si leggono uno per riga.
create or replace function paga(ricevute text, data text, cassa text) returns text language sql as $$
  select format($f$select ((paga_compensi(ricevute => %L::uuid[], data => %L::date, cassa => %L::uuid)).id is not null)::text$f$, ricevute, data, cassa)
$$;
create or replace function annulla(id text) returns text language sql as $$
  select format($f$select ((annulla_ricevuta_compenso(id => %L)).annullata_il is not null)::text$f$, id)
$$;
grant execute on function tenta(text), atteso(text, text, text), chi(text), giorno(int), paga(text, text, text), annulla(text) to anon, authenticated;

-- Le ricevute, da dentro: quattro lezioni di due ore di Judo kids a 15 € l'ora, 120 €.
create or replace function semina(persona text, mese text, importo int = 12000, annullata boolean = false) returns uuid language sql as $$
  insert into ricevute_compensi (persona_id, mese, righe, calcolato, importo, motivo, tecnico, qualifica, data, annullata_il)
  values (persona::uuid, mese::date, '[{"corso": "Judo kids", "lezioni": 4, "minuti": 480, "centesimi_ora": 1500, "importo": 12000}]', 12000, importo,
    case when importo <> 12000 then 'Corretto a mano' end,
    '{"nome": "Maura", "cognome": "Uno", "codiceFiscale": "BLLDNI86H61H355W", "iban": "IT60X0542811101000000123456"}', 'Allenatore', current_date,
    case when annullata then now() end)
  returning id
$$;
select semina('aaaaaaaa-0000-0000-0000-000000000005', '2025-09-01') as m_set \gset
select semina('aaaaaaaa-0000-0000-0000-000000000005', '2025-10-01', 15000) as m_ott \gset
select semina('aaaaaaaa-0000-0000-0000-000000000005', '2025-11-01', 12000, true) as m_nov_annullata \gset
select semina('aaaaaaaa-0000-0000-0000-000000000005', '2025-12-01') as m_dic \gset
select semina('aaaaaaaa-0000-0000-0000-000000000005', '2026-01-01', 13000) as m_gen \gset
select semina('aaaaaaaa-0000-0000-0000-000000000005', '2026-02-01') as m_feb \gset
select semina('aaaaaaaa-0000-0000-0000-000000000006', '2025-10-01', 9000) as i_ott \gset
select semina('aaaaaaaa-0000-0000-0000-000000000006', '2025-11-01') as i_nov \gset
select id as contanti from casse where nome = 'Cassa Contanti' \gset
select id as conto from casse where nome = 'Conto Corrente' \gset

\echo ''
\echo '--- 0. il file c''è ---'
select atteso('c''è la funzione paga_compensi', (select count(*)::text from pg_proc where proname = 'paga_compensi'), '1');
select atteso('le ricevute hanno movimento_id e pagata_il',
  (select string_agg(column_name || ' ' || data_type, ', ' order by column_name) from information_schema.columns
    where table_schema = 'public' and table_name = 'ricevute_compensi' and column_name in ('movimento_id', 'pagata_il')), 'movimento_id uuid, pagata_il date');

\echo ''
\echo '--- 1. la voce di sistema «Compensi istruttori» ---'
select atteso('c''è, una sola, d''uscita, di sistema e attiva',
  (select string_agg(tipo || ' ' || di_sistema || ' ' || attiva, '|') from voci_contabili where nome = 'Compensi istruttori'), 'uscita true true');

\echo ''
\echo '--- 2. le colonne nuove ---'
select atteso('le ricevute di prima sono tutte da pagare',
  (select count(*) filter (where movimento_id is null and pagata_il is null) || '/' || count(*) from ricevute_compensi), '8/8');
select atteso('movimento_id punta ai movimenti, e un movimento con ricevute non si cancella',
  (select confrelid::regclass::text || ' ' || confdeltype::text from pg_constraint
    where conrelid = 'ricevute_compensi'::regclass and contype = 'f' and conkey = array[(select attnum from pg_attribute where attrelid = 'ricevute_compensi'::regclass and attname = 'movimento_id')]), 'movimenti r');

\echo ''
\echo '--- 3. Anna paga: un movimento, le ricevute segnate ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
-- Ottobre prima di settembre: la descrizione li mette in ordine.
select atteso('paga ottobre e settembre di Maura col bonifico', tenta(paga(format('{%s,%s}', :'m_ott', :'m_set'), giorno(3), :'conto')), 'true');
reset role;
select id as pag_set_ott from movimenti where descrizione like 'Compenso · Maura%' \gset
select atteso('un movimento solo', (select count(*)::text from movimenti), '1');
select atteso('un''uscita della voce «Compensi istruttori», dal Conto Corrente',
  (select m.tipo || ' · ' || v.nome || ' · ' || c.nome from movimenti m join voci_contabili v on v.id = m.voce_id join casse c on c.id = m.cassa_id where m.id = :'pag_set_ott'),
  'uscita · Compensi istruttori · Conto Corrente');
select atteso('l''importo è la somma delle due ricevute (150 + 120 €)', (select importo::text from movimenti where id = :'pag_set_ott'), '27000');
select atteso('il giorno scelto', (select data::text from movimenti where id = :'pag_set_ott'), giorno(3));
select atteso('la persona è il tecnico', (select p.nome from movimenti m join persone p on p.id = m.persona_id where m.id = :'pag_set_ott'), 'Maura');
select atteso('la descrizione, coi mesi in ordine', (select descrizione from movimenti where id = :'pag_set_ott'), 'Compenso · Maura Uno · set, ott 2025');
select atteso('mai codice fiscale né IBAN, nemmeno nella nota',
  (select (concat(descrizione, nota) not like '%BLLDNI86H61H355W%' and concat(descrizione, nota) not like '%IT60X%')::text from movimenti where id = :'pag_set_ott'), 'true');
select atteso('scritto da Anna, non annullato',
  (select p.nome || ' ' || coalesce(m.annullato_il::text, 'valido') from movimenti m join persone p on p.id = m.creato_da where m.id = :'pag_set_ott'), 'Anna valido');
select atteso('le due ricevute col movimento e il giorno del pagamento',
  (select string_agg(to_char(mese, 'MM') || ' ' || (movimento_id = :'pag_set_ott')::text || ' ' || pagata_il::text, '|' order by mese) from ricevute_compensi where id in (:'m_set', :'m_ott')),
  '09 true ' || giorno(3) || '|10 true ' || giorno(3));
select atteso('le altre restano da pagare', (select count(*)::text from ricevute_compensi where movimento_id is null and pagata_il is null), '6');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('un mese solo, in contanti', tenta(paga(format('{%s}', :'i_ott'), giorno(1), :'contanti')), 'true');
select atteso('anche oggi', tenta(paga(format('{%s,%s}', :'m_gen', :'m_dic'), giorno(0), :'conto')), 'true');
reset role;
select atteso('in contanti: la Cassa Contanti, 90 €, la descrizione col mese solo',
  (select c.nome || ' · ' || m.importo || ' · ' || m.descrizione from movimenti m join casse c on c.id = m.cassa_id where m.persona_id = 'aaaaaaaa-0000-0000-0000-000000000006'),
  'Cassa Contanti · 9000 · Compenso · Ivo Tecnico · ott 2025');
select atteso('dicembre e gennaio: ogni anno coi suoi mesi',
  (select importo || ' · ' || descrizione from movimenti where data = current_date), '25000 · Compenso · Maura Uno · dic 2025, gen 2026');

\echo ''
\echo '--- 4. cosa non si paga: e allora niente ---'
-- Il Conto Corrente parte da 30 giorni fa; la Cassa Contanti è chiusa fino a 5 giorni fa.
update casse set dal = current_date - 30 where id = :'conto';
insert into chiusure_cassa (cassa_id, dal, data, previsto, contato, differenza) values (:'contanti', current_date - 60, current_date - 5, 0, 0, 0);
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('nessuna ricevuta no', tenta(paga('{}', giorno(0), :'conto')), 'NEGATO: …');
select atteso('l''elenco che manca no', tenta($$select (paga_compensi(ricevute => null, data => current_date, cassa => (select id from casse where nome = 'Conto Corrente'))).id::text$$), 'NEGATO: …');
select atteso('due tecnici insieme no', tenta(paga(format('{%s,%s}', :'m_feb', :'i_nov'), giorno(0), :'conto')), 'NEGATO: …');
select atteso('con una annullata no', tenta(paga(format('{%s,%s}', :'m_feb', :'m_nov_annullata'), giorno(0), :'conto')), 'NEGATO: …');
select atteso('una già pagata no', tenta(paga(format('{%s}', :'m_set'), giorno(0), :'conto')), 'NEGATO: …');
select atteso('una già pagata con una da pagare no', tenta(paga(format('{%s,%s}', :'m_feb', :'m_set'), giorno(0), :'conto')), 'NEGATO: …');
select atteso('una ricevuta che non c''è no', tenta(paga('{99999999-9999-9999-9999-999999999999}', giorno(0), :'conto')), 'NEGATO: …');
select atteso('domani no', tenta(paga(format('{%s}', :'m_feb'), giorno(-1), :'conto')), 'NEGATO: …');
select atteso('una data prima del 2000 no', tenta(paga(format('{%s}', :'m_feb'), '1990-01-01', :'conto')), 'NEGATO: La data non si capisce');
select atteso('il giorno che manca no', tenta(paga(format('{%s}', :'m_feb'), null, :'conto')), 'NEGATO: …');
select atteso('prima dell''inizio della cassa no', tenta(paga(format('{%s}', :'m_feb'), giorno(31), :'conto')), 'NEGATO: …');
select atteso('in un giorno chiuso no', tenta(paga(format('{%s}', :'m_feb'), giorno(6), :'contanti')), 'NEGATO: …');
select atteso('una cassa che non c''è no', tenta(paga(format('{%s}', :'m_feb'), giorno(0), '99999999-9999-9999-9999-999999999999')), 'NEGATO: …');
select atteso('senza cassa no', tenta(paga(format('{%s}', :'m_feb'), giorno(0), null)), 'NEGATO: …');
reset role;
select atteso('nessun movimento in più', (select count(*)::text from movimenti), '3');
select atteso('e febbraio e il novembre di Ivo ancora da pagare',
  (select count(*)::text from ricevute_compensi where id in (:'m_feb', :'i_nov') and movimento_id is null and pagata_il is null), '2');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
-- Accettato o no, la stessa ricevuta due volte non si paga due volte.
select tenta(paga(format('{%s,%s}', :'i_nov', :'i_nov'), giorno(0), :'conto'));
reset role;
select atteso('la stessa ricevuta due volte non conta doppio', (select count(*)::text from movimenti where importo = 24000), '0');

\echo ''
\echo '--- 5. una pagata non si annulla ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('annullare settembre, pagato: no, col messaggio', tenta(annulla(:'m_set')), 'NEGATO: È pagata: prima annulla il pagamento in CONTABILITÀ → MOVIMENTI');
reset role;
select atteso('e resta valida e pagata', (select coalesce(annullata_il::text, 'valida') || ' ' || (movimento_id is not null) from ricevute_compensi where id = :'m_set'), 'valida true');
select atteso('il movimento di un pagamento non si cancella, nemmeno da dentro', tenta(format('delete from movimenti where id = %L', :'pag_set_ott')), 'NEGATO: …');

-- Prima di 5 bis: lì si rilancia l'81, che rimette la `paga_compensi` senza le extra del 96.
\echo ''
\echo '--- 5 ter. il tetto: 100.000 € in un pagamento solo ---'
-- Una ricevuta vale al massimo 100.000 € (`importo <= 10000000`): per superare il tetto del pagamento ne servono due.
select semina('aaaaaaaa-0000-0000-0000-000000000006', '2026-03-01', 10000000) as i_tetto1 \gset
select semina('aaaaaaaa-0000-0000-0000-000000000006', '2026-04-01', 10000000) as i_tetto2 \gset
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('200.000 € in un pagamento solo no, col messaggio', tenta(paga(format('{%s,%s}', :'i_tetto1', :'i_tetto2'), giorno(0), :'conto')), 'NEGATO: Il totale è troppo alto per un pagamento solo: paga i mesi in più volte');
reset role;
select atteso('niente movimento e le due ricevute ancora da pagare',
  (select count(*)::text from movimenti where importo >= 10000000) || ' ' || (select count(*)::text from ricevute_compensi where id in (:'i_tetto1', :'i_tetto2') and movimento_id is null), '0 2');
-- Il tetto è compreso: 100.000 € esatti si pagano (e si disfa, per non cambiare i conti dopo).
begin;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('100.000 € esatti sì', tenta(paga(format('{%s}', :'i_tetto1'), giorno(0), :'conto')), 'true');
reset role;
rollback;

\echo ''
\echo '--- 5 bis. una voce «Compensi istruttori» già scritta a mano diventa quella di sistema ---'
-- Rilanciare l'81 con una voce omonima non di sistema (come arriverebbe dalla prima nota) non lascia il pagamento senza voce.
update voci_contabili set di_sistema = false where nome = 'Compensi istruttori';
\ir ../81-compensi-pagati.sql
select atteso('la voce torna di sistema, una sola', (select count(*)::text || ' ' || bool_and(di_sistema)::text from voci_contabili where tipo = 'uscita' and lower(trim(nome)) = 'compensi istruttori'), '1 true');

\echo '--- 6. annullato il movimento, tornano da pagare ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('Anna annulla il pagamento in CONTABILITÀ', tenta(format('select annulla_movimento(%L)::text', :'pag_set_ott')), '');
reset role;
select atteso('il movimento è annullato', (select (annullato_il is not null)::text from movimenti where id = :'pag_set_ott'), 'true');
select atteso('settembre e ottobre tornano da pagare',
  (select count(*)::text from ricevute_compensi where id in (:'m_set', :'m_ott') and movimento_id is null and pagata_il is null), '2');
select atteso('le altre pagate restano pagate', (select count(*)::text from ricevute_compensi where id in (:'i_ott', :'m_dic', :'m_gen') and movimento_id is not null and pagata_il is not null), '3');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('e settembre si ripaga, da solo', tenta(paga(format('{%s}', :'m_set'), giorno(2), :'conto')), 'true');
select atteso('ottobre, da pagare, si annulla', tenta(annulla(:'m_ott')), 'true');
reset role;
select atteso('il pagamento nuovo, col mese solo',
  (select importo || ' · ' || descrizione from movimenti where annullato_il is null and data = current_date - 2), '12000 · Compenso · Maura Uno · set 2025');
select atteso('settembre punta al movimento nuovo',
  (select (r.movimento_id = m.id and r.pagata_il = m.data)::text from ricevute_compensi r, movimenti m where r.id = :'m_set' and m.annullato_il is null and m.data = current_date - 2), 'true');

\echo ''
\echo '--- 7. chi non è segreteria E amministrazione: niente ---'
select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('la segreteria senza amministrazione non paga', tenta(paga(format('{%s}', :'m_feb'), giorno(0), :'conto')), 'NEGATO: …');
reset role;
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('l''amministrazione senza segreteria non paga', tenta(paga(format('{%s}', :'m_feb'), giorno(0), :'conto')), 'NEGATO: …');
reset role;
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('il tecnico non si paga da sé', tenta(paga(format('{%s}', :'m_feb'), giorno(0), :'conto')), 'NEGATO: …');
reset role;
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('l''iscritto non paga', tenta(paga(format('{%s}', :'m_feb'), giorno(0), :'conto')), 'NEGATO: …');
reset role;
select chi('77777777-7777-7777-7777-777777777777');
set role authenticated;
select atteso('il tablet non paga', tenta(paga(format('{%s}', :'m_feb'), giorno(0), :'conto')), 'NEGATO: …');
reset role;
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('l''account senza scheda non paga', tenta(paga(format('{%s}', :'m_feb'), giorno(0), :'conto')), 'NEGATO: …');
reset role;
select chi('');
set role anon;
select atteso('anon non paga', tenta(paga(format('{%s}', :'m_feb'), giorno(0), :'conto')), 'NEGATO: …');
reset role;
select atteso('febbraio è ancora da pagare', (select (movimento_id is null and pagata_il is null)::text from ricevute_compensi where id = :'m_feb'), 'true');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('nemmeno Anna segna pagata una ricevuta a mano',
  tenta(format('update ricevute_compensi set movimento_id = %L, pagata_il = current_date where id = %L', :'pag_set_ott', :'m_feb')), 'NEGATO: …');
select atteso('né le toglie il giorno del pagamento', tenta(format('update ricevute_compensi set pagata_il = null where id = %L', :'m_set')), 'NEGATO: …');
select atteso('né il movimento', tenta(format('update ricevute_compensi set movimento_id = null where id = %L', :'m_set')), 'NEGATO: …');
select atteso('«firmata» sì, anche su una pagata', tenta(format('update ricevute_compensi set firmata = true where id = %L', :'m_set')), 'FATTO (1 righe)');
reset role;

\echo ''
\echo '--- 8. il file si rilancia, anche con le ricevute pagate ---'
\ir ../81-compensi-pagati.sql
\ir ../81-compensi-pagati.sql
select atteso('la voce resta una', (select count(*)::text from voci_contabili where nome = 'Compensi istruttori'), '1');
select atteso('le pagate restano pagate', (select count(*)::text from ricevute_compensi where id <> :'i_nov' and movimento_id is not null and pagata_il is not null), '4');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('e si paga ancora', tenta(paga(format('{%s}', :'m_feb'), giorno(0), :'conto')), 'true');
reset role;
