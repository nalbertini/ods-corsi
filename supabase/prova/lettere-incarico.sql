-- Le lettere d'incarico dei tecnici (`79-lettere-incarico.sql`): i dati si
-- copiano dentro quando la lettera si fa, e una lettera fatta non si cambia,
-- si sostituisce (una sola valida per persona e stagione). Dopo si spunta
-- solo «firmata». Le legge e le fa solo la segreteria; un tecnico con
-- lettere non si elimina.
-- Si lancia dopo finto-supabase.sql e tutto lo schema (79-lettere-incarico.sql
-- compreso).
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'ada@ods.it'),
  ('55555555-5555-5555-5555-555555555555', 'maura@ods.it'),
  ('33333333-3333-3333-3333-333333333333', 'luca@ods.it');
-- Anna: segreteria che non insegna. Sara: segreteria che insegna anche. Ada:
-- solo amministrazione. Maura (con l'accesso) e Ivo: istruttori. Luca: iscritto.
insert into persone (id, nome, cognome, ruolo, anche_istruttore, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', false, 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000007', 'Sara', 'Doppia', 'staff', true, null, null),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Ada', 'Conti', 'amministrazione', false, 'ada@ods.it', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'Maura', 'Uno', 'istruttore', false, 'maura@ods.it', '55555555-5555-5555-5555-555555555555'),
  ('aaaaaaaa-0000-0000-0000-000000000006', 'Ivo', 'Tecnico', 'istruttore', false, null, null),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Luca', 'Rossi', 'iscritto', false, 'luca@ods.it', '33333333-3333-3333-3333-333333333333');

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
-- Una lettera per `persona`, coi dati giusti e quello che si cambia: la usa
-- `tenta`, così i rifiuti si leggono uno per riga.
create or replace function lettera(persona text, stagione text = '2026/27', dal text = '2026-09-01', al text = '2027-07-30',
  qualifica text = 'Allenatore', giorni text = 'venerdì', tariffe text = '[{"corso": "Judo kids", "centesimi": 1500}]') returns text
  language sql as $$
  select format($f$select ((fai_lettera_incarico(persona => %L, stagione => %L, dal => %L, al => %L, qualifica => %L, giorni => %L,
    data => '2026-09-01', tariffe => %L::jsonb,
    tecnico => '{"nome": "Maura", "cognome": "Uno", "indirizzo": "Via Montelera 73", "cap": "10040", "comune": "Val della Torre", "provincia": "TO", "codiceFiscale": "BLLDNI86H61H355W"}'::jsonb)).id is not null)::text$f$,
    persona, stagione, dal, al, qualifica, giorni, tariffe)
$$;
grant execute on function tenta(text), atteso(text, text, text), chi(text), lettera(text, text, text, text, text, text, text) to anon, authenticated;

\echo ''
\echo '--- 0. il file c''è ---'
select atteso('c''è la tabella lettere_incarico', to_regclass('public.lettere_incarico')::text, 'lettere_incarico');
select atteso('c''è la funzione fai_lettera_incarico', (select count(*)::text from pg_proc where proname = 'fai_lettera_incarico'), '1');

\echo ''
\echo '--- 1. la segreteria fa la lettera di Maura ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('fa la lettera', tenta(lettera('aaaaaaaa-0000-0000-0000-000000000005')), 'true');
select atteso('e la rilegge', (select count(*)::text from lettere_incarico), '1');
select atteso('coi dati dati: stagione, periodo, qualifica, giorni, data',
  (select stagione || ' ' || dal || ' ' || al || ' ' || qualifica || ' ' || giorni || ' ' || data from lettere_incarico), '2026/27 2026-09-01 2027-07-30 Allenatore venerdì 2026-09-01');
select atteso('le tariffe copiate dentro', (select tariffe::text from lettere_incarico), '[{"corso": "Judo kids", "centesimi": 1500}]');
select atteso('i dati del tecnico copiati dentro', (select tecnico->>'cognome' || ' ' || (tecnico->>'codiceFiscale') from lettere_incarico), 'Uno BLLDNI86H61H355W');
select atteso('non firmata, valida', (select firmata::text || ' ' || coalesce(sostituita_il::text, 'valida') from lettere_incarico), 'false valida');
select atteso('il server scrive chi l''ha fatta', (select p.nome from lettere_incarico l join persone p on p.id = l.creata_da), 'Anna');
select atteso('e quando', (select (creata_il is not null)::text from lettere_incarico), 'true');
reset role;

\echo ''
\echo '--- 2. una seconda lettera per la stessa stagione sostituisce la prima ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la rifà, coi giorni cambiati', tenta(lettera('aaaaaaaa-0000-0000-0000-000000000005', giorni => 'martedì e venerdì')), 'true');
select atteso('restano tutte e due', (select count(*)::text from lettere_incarico), '2');
select atteso('una sola valida, la nuova', (select string_agg(giorni, ' | ') from lettere_incarico where sostituita_il is null), 'martedì e venerdì');
select atteso('la prima è sostituita, adesso', (select (sostituita_il > now() - interval '1 minute')::text from lettere_incarico where giorni = 'venerdì' and stagione = '2026/27' and persona_id = 'aaaaaaaa-0000-0000-0000-000000000005'), 'true');
select atteso('una per la stagione dopo non tocca questa',
  tenta(lettera('aaaaaaaa-0000-0000-0000-000000000005', stagione => '2027/28', dal => '2027-09-01', al => '2028-07-30')), 'true');
select atteso('valide: una per stagione', (select string_agg(stagione, ' ' order by stagione) from lettere_incarico where sostituita_il is null), '2026/27 2027/28');
select atteso('la segreteria che insegna anche ha la sua', tenta(lettera('aaaaaaaa-0000-0000-0000-000000000007')), 'true');
reset role;
select atteso('due valide per la stessa persona e stagione no, nemmeno da dentro',
  tenta($$insert into lettere_incarico (persona_id, stagione, dal, al, qualifica, giorni, data, tariffe, tecnico)
    values ('aaaaaaaa-0000-0000-0000-000000000005', '2026/27', '2026-09-01', '2027-07-30', 'Allenatore', '', '2026-09-01',
      '[{"corso": "Judo kids", "centesimi": 1500}]', '{"nome": "Maura", "cognome": "Uno"}')$$), 'NEGATO: …');

\echo ''
\echo '--- 3. cosa non entra ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('senza tariffe no', tenta(lettera('aaaaaaaa-0000-0000-0000-000000000006', tariffe => '[]')), 'NEGATO: …');
select atteso('tariffe che non sono un elenco no', tenta(lettera('aaaaaaaa-0000-0000-0000-000000000006', tariffe => '{"corso": "Judo kids", "centesimi": 1500}')), 'NEGATO: …');
select atteso('una tariffa di zero euro no', tenta(lettera('aaaaaaaa-0000-0000-0000-000000000006', tariffe => '[{"corso": "Judo kids", "centesimi": 0}]')), 'NEGATO: …');
select atteso('una qualifica fuori elenco no', tenta(lettera('aaaaaaaa-0000-0000-0000-000000000006', qualifica => 'Bidello')), 'NEGATO: …');
select atteso('la fine uguale all''inizio no', tenta(lettera('aaaaaaaa-0000-0000-0000-000000000006', al => '2026-09-01')), 'NEGATO: …');
select atteso('la fine prima dell''inizio no', tenta(lettera('aaaaaaaa-0000-0000-0000-000000000006', al => '2026-08-01')), 'NEGATO: …');
select atteso('una stagione scritta male no («2026-27»)', tenta(lettera('aaaaaaaa-0000-0000-0000-000000000006', stagione => '2026-27')), 'NEGATO: …');
select atteso('i giorni oltre 80 caratteri no', tenta(lettera('aaaaaaaa-0000-0000-0000-000000000006', giorni => repeat('x', 81))), 'NEGATO: …');
select atteso('i giorni vuoti sì', tenta(lettera('aaaaaaaa-0000-0000-0000-000000000006', giorni => '')), 'true');
select atteso('per la segreteria che non insegna no', tenta(lettera('aaaaaaaa-0000-0000-0000-000000000001')), 'NEGATO: …');
select atteso('per l''amministrazione che non insegna no', tenta(lettera('aaaaaaaa-0000-0000-0000-000000000002')), 'NEGATO: …');
select atteso('per un iscritto no', tenta(lettera('aaaaaaaa-0000-0000-0000-000000000003')), 'NEGATO: …');
select atteso('le lettere sono ancora quelle di prima, più quella di Ivo', (select count(*)::text from lettere_incarico), '5');
reset role;

\echo ''
\echo '--- 4. dopo, si cambia solo «firmata» ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria la spunta firmata',
  tenta($$update lettere_incarico set firmata = true where sostituita_il is null and stagione = '2026/27' and persona_id = 'aaaaaaaa-0000-0000-0000-000000000005'$$), 'FATTO (1 righe)');
select atteso('e la toglie', tenta($$update lettere_incarico set firmata = false where giorni = 'martedì e venerdì'$$), 'FATTO (1 righe)');
select atteso('non le cambia le tariffe', tenta($$update lettere_incarico set tariffe = '[{"corso": "Judo kids", "centesimi": 9900}]'$$), 'NEGATO: …');
select atteso('né la qualifica', tenta($$update lettere_incarico set qualifica = 'Altro'$$), 'NEGATO: …');
select atteso('né il periodo', tenta($$update lettere_incarico set al = '2027-06-30'$$), 'NEGATO: …');
select atteso('né i dati del tecnico', tenta($$update lettere_incarico set tecnico = '{}'$$), 'NEGATO: …');
select atteso('una sostituita non torna valida', tenta($$update lettere_incarico set sostituita_il = null$$), 'NEGATO: …');
select atteso('non se ne cancella una', tenta($$delete from lettere_incarico$$), 'NEGATO: …');
select atteso('non se ne scrive una a mano: solo con fai_lettera_incarico',
  tenta($$insert into lettere_incarico (persona_id, stagione, dal, al, qualifica, giorni, data, tariffe, tecnico)
    values ('aaaaaaaa-0000-0000-0000-000000000006', '2027/28', '2027-09-01', '2028-07-30', 'Allenatore', '', '2027-09-01',
      '[{"corso": "Judo kids", "centesimi": 1500}]', '{"nome": "Ivo", "cognome": "Tecnico"}')$$), 'NEGATO: …');
select atteso('le tariffe sono ancora quelle', (select string_agg(distinct tariffe->0->>'centesimi', ' ') from lettere_incarico), '1500');
reset role;

\echo ''
\echo '--- 5. chi non è la segreteria: niente ---'
-- Maura è il tecnico delle lettere: nemmeno le sue.
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('l''istruttore non vede le lettere, nemmeno le sue', (select count(*)::text from lettere_incarico), '0');
select atteso('non se ne fa una', tenta(lettera('aaaaaaaa-0000-0000-0000-000000000005')), 'NEGATO: …');
select atteso('non le spunta firmate', (tenta($$update lettere_incarico set firmata = true$$) not like 'FATTO%')::text, 'true');
reset role;
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('l''amministrazione non vede le lettere', (select count(*)::text from lettere_incarico), '0');
select atteso('non se ne fa una', tenta(lettera('aaaaaaaa-0000-0000-0000-000000000006')), 'NEGATO: …');
select atteso('non le spunta firmate', (tenta($$update lettere_incarico set firmata = true$$) not like 'FATTO%')::text, 'true');
reset role;
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('l''iscritto non vede le lettere', (select count(*)::text from lettere_incarico), '0');
select atteso('non se ne fa una', tenta(lettera('aaaaaaaa-0000-0000-0000-000000000006')), 'NEGATO: …');
select atteso('non le spunta firmate', (tenta($$update lettere_incarico set firmata = true$$) not like 'FATTO%')::text, 'true');
reset role;
select chi('');
set role anon;
select atteso('anon non legge le lettere', tenta($$select count(*)::text from lettere_incarico$$), 'NEGATO: …');
select atteso('non se ne fa una', tenta(lettera('aaaaaaaa-0000-0000-0000-000000000006')), 'NEGATO: …');
select atteso('non le spunta firmate', tenta($$update lettere_incarico set firmata = true$$), 'NEGATO: …');
reset role;
select atteso('e nessuno di loro ha cambiato niente: firmate nessuna, lettere 5',
  (select count(*) filter (where firmata)::text || ' ' || count(*)::text from lettere_incarico), '0 5');

\echo ''
\echo '--- 6. un tecnico con lettere non si elimina ---'
select atteso('eliminare Maura, che ha lettere: no', tenta($$delete from persone where id = 'aaaaaaaa-0000-0000-0000-000000000005'$$), 'NEGATO: …');
select atteso('e le sue lettere restano', (select count(*)::text from lettere_incarico where persona_id = 'aaaaaaaa-0000-0000-0000-000000000005'), '3');
