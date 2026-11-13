-- L'ordine del vestiario saldato dal bonifico (157-vestiario-dal-bonifico.sql):
--   · `ordini_vestiario_da_saldare()`: gli ordini non saldati né annullati, con le righe e senza email; la leggono
--     segreteria e amministrazione, non l'istruttore, l'iscritto o `anon`;
--   · `assegna_movimento` con `ordine` nella riga: coperto tutto, l'ordine è saldato con bonifico, oggi; in parte resta
--     com'è; oltre quel che manca, un ordine saldato, annullato o che non c'è: rifiutato, e niente si scrive;
--   · la stessa chiave ripetuta non fa niente (136), anche sull'ordine.
-- Gli stessi casi e messaggi di scripts/prova-assegna-movimento.mjs (sezioni 3h, 12 e 13).
-- Si lancia dopo finto-supabase.sql e i file dello schema, fino a 157-vestiario-dal-bonifico.sql. Nomi tutti inventati.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'maura@ods.it'),
  ('33333333-3333-3333-3333-333333333333', 'nicole@ods.it'),
  ('66666666-6666-6666-6666-666666666666', 'ada@ods.it');
-- Anna: segreteria. Ada: amministrazione. Maura: istruttore. Nicole: iscritta.
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Maura', 'Uno', 'istruttore', 'maura@ods.it', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000030', 'Ada', 'Conti', 'amministrazione', 'ada@ods.it', '66666666-6666-6666-6666-666666666666'),
  ('bbbbbbbb-0000-0000-0000-000000000010', 'Nicole', 'Scelsi', 'iscritto', 'nicole@ods.it', '33333333-3333-3333-3333-333333333333');

create or replace function chi(u text) returns void language plpgsql as $$
begin perform set_config('prova.utente', u, false); end $$;
create or replace function rifiuto(sql text) returns text language plpgsql as $$
begin
  execute sql;
  return 'nessun errore';
exception when others then return sqlstate || ' ' || sqlerrm;
end $$;
create or replace function atteso(cosa text, avuto text, voluto text) returns text language plpgsql as $$
begin
  if avuto is distinct from voluto and not (voluto like '%…' and avuto like replace(voluto, '…', '%')) then
    raise exception '% · atteso «%», avuto «%»', cosa, voluto, avuto;
  end if;
  return 'ok  ' || cosa || ' → ' || avuto;
end $$;

-- Tre bonifici a Nicole e quattro ordini della mamma: da 40 €, da 40 €, uno saldato e uno annullato.
insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione, persona_id)
select 'entrata', '2026-10-14', imp, (select id from voci_contabili where nome = 'Corsi e altri pagamenti' and tipo = 'entrata'),
  (select id from casse where nome = 'Conto Corrente'), descr, 'bbbbbbbb-0000-0000-0000-000000000010'
from (values (4000, 'Bonifico tuta'), (5000, 'Bonifico secondo'), (4000, 'Bonifico terzo'), (2000, 'Bonifico quarto'), (4000, 'Bonifico quinto')) v(imp, descr);
insert into raccolte_vestiario (id, chiude) values ('cccccccc-0000-0000-0000-000000000001', '2026-10-01');
insert into ordini_vestiario (id, raccolta_id, nome, cognome, telefono, email, totale, saldato, annullato, pagato, creato_il) values
  ('dddddddd-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 'Daniela', 'Ferretti', '333 1234123', 'daniela@esempio.it', 40, false, false, 0, '2026-09-28 10:00+02'),
  ('dddddddd-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000001', 'Daniela', 'Ferretti', '333 1234123', null, 40, false, false, 0, '2026-09-29 10:00+02'),
  ('dddddddd-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-000000000001', 'Daniela', 'Ferretti', '333 1234123', null, 40, true, false, 40, '2026-09-20 10:00+02'),
  ('dddddddd-0000-0000-0000-000000000004', 'cccccccc-0000-0000-0000-000000000001', 'Daniela', 'Ferretti', '333 1234123', null, 40, false, true, 0, '2026-09-21 10:00+02'),
  ('dddddddd-0000-0000-0000-000000000005', 'cccccccc-0000-0000-0000-000000000001', 'Daniela', 'Ferretti', '333 1234123', null, 40, false, false, 0, '2026-09-22 10:00+02');
insert into righe_vestiario (ordine_id, per_chi, capo, taglia, quanti, prezzo, posizione)
select id, 'Nicole Scelsi', 'Tuta lotta', '152', 1, 40, 1 from ordini_vestiario;

create or replace function id_mov(d text) returns uuid language sql stable security definer set search_path = public as $$
  select id from movimenti where descrizione = d $$;
create or replace function riga(importo int, ordine text) returns jsonb language sql immutable as $$
  select jsonb_build_object('persona_id', 'bbbbbbbb-0000-0000-0000-000000000010', 'voce', 'Abbigliamento, ordine del 28/09/2026',
    'importo', importo, 'ordine', ordine, 'chiave', null) $$;
create or replace function ass(m text, righe jsonb) returns text language plpgsql as $$
begin return rifiuto(format('select assegna_movimento(%L, %L)', id_mov(m), righe)); end $$;
create or replace function ordine(n int) returns text language sql stable security definer set search_path = public as $$
  select saldato || '|' || pagato || '|' || coalesce(pagato_con, '-') || '|' || coalesce((pagato_il = vestiario_oggi())::text, '-')
  from ordini_vestiario where id = ('dddddddd-0000-0000-0000-00000000000' || n)::uuid $$;
create or replace function righe_di(m text) returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from pagamenti_diretti where movimento_id = id_mov(m) and annullato_il is null $$;

\set ADA '''66666666-6666-6666-6666-666666666666'''
\set ANNA '''11111111-1111-1111-1111-111111111111'''
\set MAURA '''22222222-2222-2222-2222-222222222222'''
\set NICOLE '''33333333-3333-3333-3333-333333333333'''
\set O1 '''dddddddd-0000-0000-0000-000000000001'''
\set O2 '''dddddddd-0000-0000-0000-000000000002'''
\set O3 '''dddddddd-0000-0000-0000-000000000003'''
\set GIA '''22023 L’ordine del vestiario è già saldato o annullato: togli la riga e riapri la finestra.'''

\echo ''
\echo '--- 1. Chi legge gli ordini da saldare ---'
select chi(:ANNA);
set role authenticated;
select atteso('la segreteria li legge: i tre da saldare, dal più recente', (select string_agg(x->>'id', ',') from jsonb_array_elements(ordini_vestiario_da_saldare()) x),
  'dddddddd-0000-0000-0000-000000000002,dddddddd-0000-0000-0000-000000000001,dddddddd-0000-0000-0000-000000000005');
select atteso('…con le righe e senza email', (select (x->'righe'->0->>'per_chi') || '|' || (x ? 'email')::text from jsonb_array_elements(ordini_vestiario_da_saldare()) x limit 1), 'Nicole Scelsi|false');
reset role;
select chi(:ADA);
set role authenticated;
select atteso('l’amministrazione li legge', jsonb_array_length(ordini_vestiario_da_saldare())::text, '3');
reset role;
select chi(:MAURA);
set role authenticated;
select atteso('l’istruttore no', rifiuto('select ordini_vestiario_da_saldare()'), '42501 Gli ordini del vestiario li vedono la segreteria e l’amministrazione');
reset role;
select chi(:NICOLE);
set role authenticated;
select atteso('l’iscritta no', rifiuto('select ordini_vestiario_da_saldare()'), '42501 Gli ordini del vestiario li vedono la segreteria e l’amministrazione');
reset role;
select chi('');
set role anon;
select atteso('anon no', rifiuto('select ordini_vestiario_da_saldare()'), '42501 …');
reset role;

\echo ''
\echo '--- 2. Il bonifico salda l''ordine ---'
select chi(:ADA);
set role authenticated;
select atteso('oltre quel che manca all’ordine: rifiutato', ass('Bonifico secondo', jsonb_build_array(riga(4500, :O1))),
  '22023 All’ordine del vestiario mancano 40,00 €: metti 40,00 € o meno, il resto rimane da assegnare.');
select atteso('…e niente scritto', righe_di('Bonifico secondo')::text, '0');
select atteso('40,00 € sull’ordine da 40,00 €: si assegna', ass('Bonifico tuta', jsonb_build_array(riga(4000, :O1) || '{"chiave":"eeeeeeee-0000-4000-8000-000000000001"}')), 'nessun errore');
select atteso('…l’ordine è saldato, con bonifico, oggi', ordine(1), 'true|40.00|bonifico|true');
select atteso('…e non è più da saldare', jsonb_array_length(ordini_vestiario_da_saldare())::text, '2');
select atteso('la stessa chiamata ripetuta: niente di nuovo', ass('Bonifico tuta', jsonb_build_array(riga(4000, :O1) || '{"chiave":"eeeeeeee-0000-4000-8000-000000000001"}')), 'nessun errore');
select atteso('…una riga sola', righe_di('Bonifico tuta')::text, '1');
select atteso('lo stesso ordine da un altro bonifico: rifiutato', ass('Bonifico secondo', jsonb_build_array(riga(4000, :O1))), :GIA);
select atteso('un ordine saldato a mano: rifiutato', ass('Bonifico secondo', jsonb_build_array(riga(4000, :O3))), :GIA);
select atteso('un ordine annullato: rifiutato', ass('Bonifico secondo', jsonb_build_array(riga(4000, 'dddddddd-0000-0000-0000-000000000004'))), :GIA);
select atteso('un ordine che non c’è: rifiutato', ass('Bonifico secondo', jsonb_build_array(riga(4000, 'non-un-id'))), :GIA);
select atteso('…e niente scritto', righe_di('Bonifico secondo')::text, '0');
select atteso('25,00 € su 40,00 €: si assegna', ass('Bonifico secondo', jsonb_build_array(riga(2500, :O2))), 'nessun errore');
select atteso('…ma l’ordine resta com’era', ordine(2), 'false|0.00|-|-');
select atteso('…e la lista dice quel che è già assegnato', (select x->>'assegnato' from jsonb_array_elements(ordini_vestiario_da_saldare()) x where x->>'id' = :O2), '2500');
select atteso('altri 20,00 € sullo stesso ordine: oltre quel che manca (15,00 €)', ass('Bonifico quarto', jsonb_build_array(riga(2000, :O2))),
  '22023 All’ordine del vestiario mancano 15,00 €: metti 15,00 € o meno, il resto rimane da assegnare.');
select atteso('15,00 € lo completano: saldato', ass('Bonifico quarto', jsonb_build_array(riga(1500, :O2))), 'nessun errore');
select atteso('…con pagato il totale', ordine(2), 'true|40.00|bonifico|true');
select atteso('lo stesso ordine scritto in due modi nella stessa chiamata conta una volta: 20+20 su 40 lo salda',
  ass('Bonifico quinto', jsonb_build_array(riga(2000, 'dddddddd-0000-0000-0000-000000000005'), riga(2000, 'DDDDDDDD-0000-0000-0000-000000000005'))), 'nessun errore');
select atteso('…saldato', ordine(5), 'true|40.00|bonifico|true');
select atteso('una riga senza ordine: come prima', ass('Bonifico terzo', jsonb_build_array(jsonb_build_object('persona_id', 'bbbbbbbb-0000-0000-0000-000000000010', 'voce', 'Abbigliamento', 'importo', 4000))), 'nessun errore');
reset role;

select chi(:ANNA);
set role authenticated;
select atteso('la segreteria non assegna i bonifici (come nel 135)', ass('Bonifico terzo', jsonb_build_array(riga(100, :O2))), '42501 …');
reset role;

\echo ''
\echo '--- 3. I soldi lasciano l''ordine: torna da saldare ---'
select chi(:ADA);
set role authenticated;
select atteso('annullato il bonifico che l’ha saldato', rifiuto(format('select annulla_movimento(%L)', id_mov('Bonifico tuta'))), 'nessun errore');
select atteso('…l’ordine torna da saldare, senza niente di pagato', ordine(1), 'false|0.00|-|-');
select atteso('annullato il secondo dei due bonifici', rifiuto(format('select annulla_movimento(%L)', id_mov('Bonifico quarto'))), 'nessun errore');
select atteso('…l’ordine torna da saldare, e il primo resta assegnato', ordine(2) || '|' || (select x->>'assegnato' from jsonb_array_elements(ordini_vestiario_da_saldare()) x where x->>'id' = :O2),
  'false|0.00|-|-|2500');
select atteso('…mancano di nuovo 15,00 €', ass('Bonifico secondo', jsonb_build_array(riga(1600, :O2))),
  '22023 All’ordine del vestiario mancano 15,00 €: metti 15,00 € o meno, il resto rimane da assegnare.');
reset role;
