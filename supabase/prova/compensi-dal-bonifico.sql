-- Il compenso pagato con un bonifico già in banca (`153-compensi-dal-bonifico.sql`): in COMPENSI › Segna pagato
-- la segreteria con l'amministrazione sceglie l'uscita già nel Conto Corrente (arrivata dall'importazione della banca)
-- invece di scriverne una nuova. Le ricevute prendono quel movimento e il suo giorno, il movimento prende il tecnico e
-- la voce «Compensi istruttori», e non nasce un'altra uscita. Annullato il movimento, le ricevute tornano da pagare
-- (`compensi_tornano` dell'81). Le stesse regole della modalità prova, provate da scripts/prova-compensi-pagati.mjs.
-- Si lancia dopo finto-supabase.sql e tutto lo schema (153-compensi-dal-bonifico.sql compreso). Mesi del 2025:
-- passati, così le date sono sempre le stesse.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('44444444-4444-4444-4444-444444444444', 'sandro@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'ada@ods.it'),
  ('55555555-5555-5555-5555-555555555555', 'maura@ods.it'),
  ('33333333-3333-3333-3333-333333333333', 'luca@ods.it'),
  ('77777777-7777-7777-7777-777777777777', 'tablet@ods.it');
insert into sale (id, nome) values ('bbbbbbbb-0000-0000-0000-000000000001', 'Tatami');
insert into postazioni (id, nome, sala_id, utente_id) values ('dddddddd-0000-0000-0000-000000000001', 'Tablet', 'bbbbbbbb-0000-0000-0000-000000000001', '77777777-7777-7777-7777-777777777777');
-- Anna: segreteria e amministrazione, chi paga. Sandro: solo segreteria. Ada: solo amministrazione. Maura e Ivo: i tecnici.
insert into persone (id, nome, cognome, ruolo, anche_istruttore, anche_amministrazione, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', false, true, 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'Sandro', 'Banco', 'staff', false, false, 'sandro@ods.it', '44444444-4444-4444-4444-444444444444'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Ada', 'Conti', 'amministrazione', false, false, 'ada@ods.it', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'Maura', 'Uno', 'istruttore', false, false, 'maura@ods.it', '55555555-5555-5555-5555-555555555555'),
  ('aaaaaaaa-0000-0000-0000-000000000006', 'Ivo', 'Tecnico', 'istruttore', false, false, null, null),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Luca', 'Rossi', 'iscritto', false, false, 'luca@ods.it', '33333333-3333-3333-3333-333333333333');
-- La voce d'arrivo dell'importazione della banca (119), e una qualunque d'uscita.
insert into voci_contabili (nome, tipo) values ('Da classificare', 'uscita'), ('Affitto sala', 'uscita') on conflict do nothing;

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
-- L'abbinamento di `ricevute` (`{id,id}`) al movimento, coi nomi giusti: rende l'id del movimento se va.
create or replace function abbina(ricevute text, movimento text) returns text language sql as $$
  select format($f$select (abbina_compensi_movimento(ricevute => %L::uuid[], movimento => %L::uuid)).id::text$f$, ricevute, movimento)
$$;
grant execute on function tenta(text), atteso(text, text, text), chi(text), abbina(text, text) to anon, authenticated;

-- Le ricevute, da dentro: settembre 134,80 € e ottobre 160,00 € di Maura, 294,80 € insieme.
create or replace function semina(persona text, mese text, importo int) returns uuid language sql as $$
  insert into ricevute_compensi (persona_id, mese, righe, calcolato, importo, tecnico, qualifica, data)
  values (persona::uuid, mese::date, jsonb_build_array(jsonb_build_object('corso', 'Judo kids', 'lezioni', 4, 'minuti', 480, 'centesimi_ora', 1500, 'importo', importo)),
    importo, importo, '{"nome": "Maura", "cognome": "Uno"}', 'Allenatore', mese::date + 32)
  returning id
$$;
select semina('aaaaaaaa-0000-0000-0000-000000000005', '2025-09-01', 13480) as m_set \gset
select semina('aaaaaaaa-0000-0000-0000-000000000005', '2025-10-01', 16000) as m_ott \gset
select semina('aaaaaaaa-0000-0000-0000-000000000005', '2025-11-01', 16000) as m_nov \gset
select semina('aaaaaaaa-0000-0000-0000-000000000006', '2025-10-01', 16000) as i_ott \gset
select id as contanti from casse where nome = 'Cassa Contanti' \gset
select id as conto from casse where nome = 'Conto Corrente' \gset

-- Le uscite già in banca, come le scrive l'importazione: Da classificare, senza persona.
create or replace function uscita(data text, importo int, descrizione text, voce text = 'Da classificare', cassa text = 'Conto Corrente',
  persona uuid = null, tipo text = 'uscita') returns uuid language sql as $$
  insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione, persona_id, origine_import)
  values (tipo, data::date, importo, (select id from voci_contabili where nome = voce and voci_contabili.tipo = uscita.tipo), (select id from casse where nome = cassa),
    descrizione, persona, 'banca:' || replace(data, '-', '') || ':prova:' || gen_random_uuid())
  returning id
$$;
select uscita('2025-11-04', 29480, 'TIB studio Training e salute di Maura Uno') as bonifico \gset
select uscita('2025-11-05', 29480, 'BONIFICO SEPA TIB SRL') as senza_nome \gset
select uscita('2025-11-06', 29480, 'Maura Uno', 'Affitto sala') as altra_voce \gset
select uscita('2025-11-06', 29480, 'Maura Uno', 'Da classificare', 'Cassa Contanti') as in_contanti \gset
select uscita('2025-11-06', 29480, 'Maura Uno', 'Da classificare', 'Conto Corrente', 'aaaaaaaa-0000-0000-0000-000000000006') as di_ivo \gset
select uscita('2025-11-06', 29480, 'Maura Uno', 'Da classificare', 'Conto Corrente', null, 'entrata') as entrata \gset
select uscita('2026-01-15', 16000, 'Maura Uno') as oltre \gset
select uscita('2026-01-14', 16000, 'Maura Uno') as al_limite \gset
select uscita('2025-11-07', 29480, 'Maura Uno') as annullata \gset
update movimenti set annullato_il = now() where id = :'annullata';
select uscita('2026-01-10', 29480, 'Maura Uno', 'Compensi istruttori', 'Conto Corrente', 'aaaaaaaa-0000-0000-0000-000000000005') as gia_suo \gset
select count(*) as prima from movimenti \gset

\echo ''
\echo '--- 0. il file c''è ---'
select atteso('c''è la funzione abbina_compensi_movimento', (select count(*)::text from pg_proc where proname = 'abbina_compensi_movimento'), '1');

\echo ''
\echo '--- 1. Anna sceglie il bonifico già in banca: niente uscita nuova ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('settembre e ottobre di Maura vanno al bonifico del 04/11', tenta(abbina(format('{%s,%s}', :'m_set', :'m_ott'), :'bonifico')), :'bonifico');
reset role;
select atteso('nessun movimento in più', (select count(*)::text from movimenti), :'prima');
select atteso('le due ricevute col bonifico e il suo giorno',
  (select string_agg(to_char(mese, 'MM') || ' ' || (movimento_id = :'bonifico')::text || ' ' || pagata_il::text, '|' order by mese) from ricevute_compensi where id in (:'m_set', :'m_ott')),
  '09 true 2025-11-04|10 true 2025-11-04');
select atteso('il bonifico prende Maura e «Compensi istruttori», la descrizione della banca resta',
  (select p.nome || ' · ' || v.nome || ' · ' || m.descrizione || ' · ' || m.importo from movimenti m join persone p on p.id = m.persona_id join voci_contabili v on v.id = m.voce_id where m.id = :'bonifico'),
  'Maura · Compensi istruttori · TIB studio Training e salute di Maura Uno · 29480');
select atteso('novembre e Ivo restano da pagare', (select count(*)::text from ricevute_compensi where id in (:'m_nov', :'i_ott') and movimento_id is null), '2');

\echo ''
\echo '--- 2. cosa non si abbina: e allora niente ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('lo stesso bonifico due volte no', tenta(abbina(format('{%s}', :'m_nov'), :'bonifico')), 'NEGATO: …');
select atteso('una ricevuta già pagata no', tenta(abbina(format('{%s,%s}', :'m_set', :'m_ott'), :'senza_nome')), 'NEGATO: …');
select atteso('un importo diverso no (novembre da solo, 160 €)', tenta(abbina(format('{%s}', :'m_nov'), :'senza_nome')), 'NEGATO: Le ricevute e il bonifico non hanno lo stesso importo…');
select atteso('due tecnici insieme no', tenta(abbina(format('{%s,%s}', :'m_nov', :'i_ott'), :'senza_nome')), 'NEGATO: …');
select atteso('nessuna ricevuta no', tenta(abbina('{}', :'senza_nome')), 'NEGATO: …');
select atteso('una voce che non è dei compensi né Da classificare no', tenta(abbina(format('{%s}', :'m_nov'), :'altra_voce')), 'NEGATO: …');
select atteso('dalla Cassa Contanti no', tenta(abbina(format('{%s}', :'m_nov'), :'in_contanti')), 'NEGATO: …');
select atteso('collegato a un altro tecnico no', tenta(abbina(format('{%s}', :'m_nov'), :'di_ivo')), 'NEGATO: …');
select atteso('un''entrata no', tenta(abbina(format('{%s}', :'m_nov'), :'entrata')), 'NEGATO: …');
select atteso('annullato no', tenta(abbina(format('{%s}', :'m_nov'), :'annullata')), 'NEGATO: …');
select atteso('un movimento che non c''è no', tenta(abbina(format('{%s}', :'m_nov'), gen_random_uuid()::text)), 'NEGATO: …');
reset role;
select atteso('niente è cambiato', (select count(*)::text from ricevute_compensi where movimento_id is not null), '2');
select atteso('il bonifico senza nome resta Da classificare e senza persona',
  (select v.nome || ' ' || coalesce(m.persona_id::text, 'nessuno') from movimenti m join voci_contabili v on v.id = m.voce_id where m.id = :'senza_nome'), 'Da classificare nessuno');

\echo ''
\echo '--- 3. i giorni: fino a 45 dalla fine del mese più recente ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('novembre col bonifico del 15/01 (46 giorni dopo il 30/11) no', tenta(abbina(format('{%s}', :'m_nov'), :'oltre')), 'NEGATO: …');
-- Il 14/01 è il 45° giorno dopo il 30/11: dentro.
select atteso('novembre col bonifico del 14/01 sì, a 45 giorni', tenta(abbina(format('{%s}', :'m_nov'), :'al_limite')), :'al_limite');
reset role;
select atteso('novembre pagato il 14/01', (select pagata_il::text from ricevute_compensi where id = :'m_nov'), '2026-01-14');

\echo ''
\echo '--- 4. il movimento già del tecnico, coi compensi: va, se non ha già ricevute ---'
select semina('aaaaaaaa-0000-0000-0000-000000000005', '2025-12-01', 29480) as m_dic \gset
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('un''uscita «Compensi istruttori» già di Maura, senza ricevute, sì', tenta(abbina(format('{%s}', :'m_dic'), :'gia_suo')), :'gia_suo');
reset role;

\echo ''
\echo '--- 5. un giorno chiuso del Conto Corrente no ---'
select semina('aaaaaaaa-0000-0000-0000-000000000006', '2025-11-01', 29480) as i_nov \gset
update movimenti set persona_id = null where id = :'senza_nome';
update movimenti set descrizione = 'Ivo Tecnico' where id = :'senza_nome';
insert into chiusure_cassa (cassa_id, dal, data, previsto, contato, differenza) values (:'conto', '2025-11-01', '2025-11-05', 0, 0, 0);
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('il bonifico del 05/11, giorno chiuso, no', tenta(abbina(format('{%s}', :'i_nov'), :'senza_nome')), 'NEGATO: Quel giorno la cassa è già chiusa…');
reset role;
delete from chiusure_cassa;

\echo ''
\echo '--- 6. chi non è segreteria e amministrazione insieme non abbina ---'
select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('la segreteria senza amministrazione no', tenta(abbina(format('{%s}', :'i_nov'), :'senza_nome')), 'NEGATO: …');
reset role;
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('l''amministrazione senza segreteria no', tenta(abbina(format('{%s}', :'i_nov'), :'senza_nome')), 'NEGATO: …');
reset role;
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('il tecnico no', tenta(abbina(format('{%s}', :'i_nov'), :'senza_nome')), 'NEGATO: …');
reset role;
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('l''iscritto no', tenta(abbina(format('{%s}', :'i_nov'), :'senza_nome')), 'NEGATO: …');
reset role;
select chi('77777777-7777-7777-7777-777777777777');
set role authenticated;
select atteso('il tablet no', tenta(abbina(format('{%s}', :'i_nov'), :'senza_nome')), 'NEGATO: …');
reset role;
select chi('');
set role anon;
select atteso('anon no', tenta(abbina(format('{%s}', :'i_nov'), :'senza_nome')), 'NEGATO: …');
reset role;
select atteso('Ivo è ancora da pagare', (select (movimento_id is null)::text from ricevute_compensi where id = :'i_nov'), 'true');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('e Anna sì', tenta(abbina(format('{%s}', :'i_nov'), :'senza_nome')), :'senza_nome');
reset role;

\echo ''
\echo '--- 7. annullato il bonifico, tornano da pagare ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('Anna annulla il bonifico in CONTABILITÀ', tenta(format('select annulla_movimento(%L)::text', :'bonifico')), '');
reset role;
select atteso('settembre e ottobre tornano da pagare',
  (select count(*)::text from ricevute_compensi where id in (:'m_set', :'m_ott') and movimento_id is null and pagata_il is null), '2');
select atteso('le altre restano pagate', (select count(*)::text from ricevute_compensi where id in (:'m_nov', :'m_dic', :'i_nov') and movimento_id is not null), '3');
select atteso('e nessun movimento nuovo, in tutto', (select count(*)::text from movimenti), :'prima');
