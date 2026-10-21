-- Le ricevute mensili dei compensi dei tecnici (`80-ricevute-compensi.sql`):
-- l'app fa il conto del mese (lezioni confermate per tariffa) e la ricevuta
-- lo copia dentro, coi dati del tecnico e la qualifica della lettera. Una
-- sola non annullata per persona e mese; dopo si spunta solo «firmata». Il
-- compenso si cambia a mano solo scrivendo il perché. Le legge e le fa solo
-- la segreteria; un tecnico con ricevute non si elimina.
-- Si lancia dopo finto-supabase.sql e tutto lo schema (80-ricevute-compensi.sql
-- compreso).
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'ada@ods.it'),
  ('55555555-5555-5555-5555-555555555555', 'maura@ods.it'),
  ('33333333-3333-3333-3333-333333333333', 'luca@ods.it'),
  ('77777777-7777-7777-7777-777777777777', 'tablet@ods.it'),
  ('66666666-6666-6666-6666-666666666666', 'senza@ods.it');
-- Un tablet di sala (in `postazioni`, senza scheda) e un account senza scheda.
insert into sale (id, nome) values ('bbbbbbbb-0000-0000-0000-000000000001', 'Tatami');
insert into postazioni (id, nome, sala_id, utente_id) values ('dddddddd-0000-0000-0000-000000000001', 'Tablet', 'bbbbbbbb-0000-0000-0000-000000000001', '77777777-7777-7777-7777-777777777777');
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
-- Il primo del mese, `quanti` mesi da questo (0 questo, -1 il mese scorso, 1 il prossimo).
create or replace function primo(quanti int = 0) returns text language sql as $$
  select to_char(date_trunc('month', current_date) + make_interval(months => quanti), 'YYYY-MM-DD')
$$;
-- Una ricevuta per `persona`, coi dati giusti e quello che si cambia: la usa
-- `tenta`, così i rifiuti si leggono uno per riga. Quattro lezioni di due ore
-- di Judo kids a 15 € l'ora: 120 €.
create or replace function ricevuta(persona text, mese text = primo(-1),
  righe text = '[{"corso": "Judo kids", "lezioni": 4, "minuti": 480, "centesimi_ora": 1500, "importo": 12000}]',
  calcolato int = 12000, importo int = 12000, motivo text = null, qualifica text = 'Allenatore',
  tecnico text = '{"nome": "Maura", "cognome": "Uno", "natoIl": "1986-06-21", "natoA": "Pinerolo", "provinciaNascita": "TO", "codiceFiscale": "BLLDNI86H61H355W", "indirizzo": "Via Montelera 73", "cap": "10040", "comune": "Val della Torre", "provincia": "TO", "iban": "IT60X0542811101000000123456"}') returns text
  language sql as $$
  select format($f$select ((fai_ricevuta_compenso(persona => %L, mese => %L, righe => %L::jsonb, calcolato => %s, importo => %s,
    motivo => %L, tecnico => %L::jsonb, qualifica => %L, data => current_date)).id is not null)::text$f$,
    persona, mese, righe, calcolato, importo, motivo, tecnico, qualifica)
$$;
create or replace function annulla(id text) returns text language sql as $$
  select format($f$select ((annulla_ricevuta_compenso(id => %L)).annullata_il is not null)::text$f$, id)
$$;
grant execute on function tenta(text), atteso(text, text, text), chi(text), primo(int),
  ricevuta(text, text, text, int, int, text, text, text), annulla(text) to anon, authenticated;

\echo ''
\echo '--- 0. il file c''è ---'
select atteso('c''è la tabella ricevute_compensi', to_regclass('public.ricevute_compensi')::text, 'ricevute_compensi');
select atteso('c''è la funzione fai_ricevuta_compenso', (select count(*)::text from pg_proc where proname = 'fai_ricevuta_compenso'), '1');
select atteso('c''è la funzione annulla_ricevuta_compenso', (select count(*)::text from pg_proc where proname = 'annulla_ricevuta_compenso'), '1');

\echo ''
\echo '--- 1. la segreteria fa la ricevuta del mese scorso di Maura ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('fa la ricevuta', tenta(ricevuta('aaaaaaaa-0000-0000-0000-000000000005')), 'true');
select atteso('e la rilegge', (select count(*)::text from ricevute_compensi), '1');
select atteso('il mese, il primo del mese', (select mese::text from ricevute_compensi), primo(-1));
select atteso('le righe copiate dentro', (select (righe = '[{"corso": "Judo kids", "lezioni": 4, "minuti": 480, "centesimi_ora": 1500, "importo": 12000}]'::jsonb)::text from ricevute_compensi), 'true');
select atteso('calcolato e importo, in centesimi', (select calcolato || ' ' || importo from ricevute_compensi), '12000 12000');
select atteso('uguali: nessun motivo', (select coalesce(motivo, 'nessuno') from ricevute_compensi), 'nessuno');
select atteso('i dati del tecnico copiati dentro, IBAN e province compresi',
  (select tecnico->>'cognome' || ' ' || (tecnico->>'codiceFiscale') || ' ' || (tecnico->>'iban') || ' ' || (tecnico->>'provinciaNascita') || ' ' || (tecnico->>'provincia') from ricevute_compensi),
  'Uno BLLDNI86H61H355W IT60X0542811101000000123456 TO TO');
select atteso('la qualifica della lettera', (select qualifica from ricevute_compensi), 'Allenatore');
select atteso('la data della stampa', (select data::text from ricevute_compensi), current_date::text);
select atteso('non firmata, non annullata', (select firmata::text || ' ' || coalesce(annullata_il::text, 'valida') from ricevute_compensi), 'false valida');
select atteso('il server scrive chi l''ha fatta', (select p.nome from ricevute_compensi r join persone p on p.id = r.creata_da), 'Anna');
select atteso('e quando', (select (creata_il is not null)::text from ricevute_compensi), 'true');
select atteso('la segreteria che insegna anche ha la sua', tenta(ricevuta('aaaaaaaa-0000-0000-0000-000000000007')), 'true');
select atteso('questo mese sì, anche se non è finito', tenta(ricevuta('aaaaaaaa-0000-0000-0000-000000000005', mese => primo(0))), 'true');
select atteso('senza la lettera: nessuna qualifica, da barrare a mano',
  tenta(ricevuta('aaaaaaaa-0000-0000-0000-000000000005', mese => primo(-2), qualifica => null)), 'true');
select atteso('e resta vuota', (select coalesce(qualifica, 'nessuna') from ricevute_compensi where mese = primo(-2)::date), 'nessuna');
select atteso('il compenso cambiato a mano, col perché',
  tenta(ricevuta('aaaaaaaa-0000-0000-0000-000000000005', mese => primo(-3), importo => 15000, motivo => 'Una lezione in più non segnata')), 'true');
select atteso('esce con quello, e il calcolato resta',
  (select importo || ' ' || calcolato || ' ' || motivo from ricevute_compensi where mese = primo(-3)::date), '15000 12000 Una lezione in più non segnata');
select atteso('più corsi in una ricevuta',
  tenta(ricevuta('aaaaaaaa-0000-0000-0000-000000000005', mese => primo(-4),
    righe => '[{"corso": "Judo kids", "lezioni": 1, "minuti": 90, "centesimi_ora": 1500, "importo": 2250}, {"corso": "Judo adulti", "lezioni": 2, "minuti": 120, "centesimi_ora": 2100, "importo": 4200}]',
    calcolato => 6450, importo => 6450)), 'true');
reset role;

\echo ''
\echo '--- 2. una sola non annullata per persona e mese ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la seconda dello stesso mese no, col messaggio', tenta(ricevuta('aaaaaaaa-0000-0000-0000-000000000005')),
  'NEGATO: C''è già la ricevuta di questo mese: annullala prima di rifarla');
select atteso('lo stesso mese per un altro tecnico sì', tenta(ricevuta('aaaaaaaa-0000-0000-0000-000000000006')), 'true');
reset role;
select atteso('due non annullate per la stessa persona e mese no, nemmeno da dentro',
  tenta($$insert into ricevute_compensi (persona_id, mese, righe, calcolato, importo, tecnico, data)
    values ('aaaaaaaa-0000-0000-0000-000000000005', date_trunc('month', current_date) - interval '1 month',
      '[{"corso": "Judo kids", "lezioni": 4, "minuti": 480, "centesimi_ora": 1500, "importo": 12000}]', 12000, 12000, '{"nome": "Maura"}', current_date)$$), 'NEGATO: …');
select id as maura_scorso from ricevute_compensi where persona_id = 'aaaaaaaa-0000-0000-0000-000000000005' and mese = primo(-1)::date \gset

\echo ''
\echo '--- 3. annullarla, e rifarla ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria la annulla', tenta(annulla(:'maura_scorso')), 'true');
select atteso('annullata adesso', (select (annullata_il > now() - interval '1 minute')::text from ricevute_compensi where id = :'maura_scorso'), 'true');
select atteso('una annullata non si annulla due volte', tenta(annulla(:'maura_scorso')), 'NEGATO: …');
select atteso('e la si rifà, col compenso giusto', tenta(ricevuta('aaaaaaaa-0000-0000-0000-000000000005', importo => 13500, motivo => 'Corretto il conto di ottobre')), 'true');
select atteso('restano tutte e due: una annullata, una no',
  (select count(*) filter (where annullata_il is not null) || ' ' || count(*) filter (where annullata_il is null)
     from ricevute_compensi where persona_id = 'aaaaaaaa-0000-0000-0000-000000000005' and mese = primo(-1)::date), '1 1');
select atteso('annullare una che non c''è no', tenta(annulla('99999999-9999-9999-9999-999999999999')), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 4. cosa non entra ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
-- Ivo ha già la sua del mese scorso: qui i mesi sono quelli prima.
select atteso('il mese prossimo no', tenta(ricevuta('aaaaaaaa-0000-0000-0000-000000000006', mese => primo(1))), 'NEGATO: …');
select atteso('fra un anno no', tenta(ricevuta('aaaaaaaa-0000-0000-0000-000000000006', mese => primo(12))), 'NEGATO: …');
select atteso('un mese che non è il primo del mese no', tenta(ricevuta('aaaaaaaa-0000-0000-0000-000000000006', mese => to_char(primo(-5)::date + 14, 'YYYY-MM-DD'))), 'NEGATO: …');
select atteso('senza righe no', tenta(ricevuta('aaaaaaaa-0000-0000-0000-000000000006', mese => primo(-5), righe => '[]', calcolato => 0, importo => 100, motivo => 'Solo un rimborso')), 'NEGATO: …');
select atteso('righe che non sono un elenco no',
  tenta(ricevuta('aaaaaaaa-0000-0000-0000-000000000006', mese => primo(-5), righe => '{"corso": "Judo kids", "lezioni": 4, "minuti": 480, "centesimi_ora": 1500, "importo": 12000}')), 'NEGATO: …');
select atteso('una riga senza corso no',
  tenta(ricevuta('aaaaaaaa-0000-0000-0000-000000000006', mese => primo(-5), righe => '[{"lezioni": 4, "minuti": 480, "centesimi_ora": 1500, "importo": 12000}]')), 'NEGATO: …');
select atteso('una riga col corso di soli spazi no',
  tenta(ricevuta('aaaaaaaa-0000-0000-0000-000000000006', mese => primo(-5), righe => '[{"corso": "  ", "lezioni": 4, "minuti": 480, "centesimi_ora": 1500, "importo": 12000}]')), 'NEGATO: …');
select atteso('una riga con zero lezioni no',
  tenta(ricevuta('aaaaaaaa-0000-0000-0000-000000000006', mese => primo(-5), righe => '[{"corso": "Judo kids", "lezioni": 0, "minuti": 480, "centesimi_ora": 1500, "importo": 12000}]')), 'NEGATO: …');
select atteso('una riga coi minuti negativi no',
  tenta(ricevuta('aaaaaaaa-0000-0000-0000-000000000006', mese => primo(-5), righe => '[{"corso": "Judo kids", "lezioni": 4, "minuti": -480, "centesimi_ora": 1500, "importo": 12000}]')), 'NEGATO: …');
select atteso('una riga con la tariffa scritta come testo no',
  tenta(ricevuta('aaaaaaaa-0000-0000-0000-000000000006', mese => primo(-5), righe => '[{"corso": "Judo kids", "lezioni": 4, "minuti": 480, "centesimi_ora": "x", "importo": 12000}]')), 'NEGATO: …');
select atteso('una riga senza tariffa no',
  tenta(ricevuta('aaaaaaaa-0000-0000-0000-000000000006', mese => primo(-5), righe => '[{"corso": "Judo kids", "lezioni": 4, "minuti": 480, "importo": 12000}]')), 'NEGATO: …');
select atteso('una riga con l''importo coi decimali no',
  tenta(ricevuta('aaaaaaaa-0000-0000-0000-000000000006', mese => primo(-5), righe => '[{"corso": "Judo kids", "lezioni": 4, "minuti": 480, "centesimi_ora": 1500, "importo": 12000.5}]')), 'NEGATO: …');
select atteso('più di 50 righe no',
  tenta(ricevuta('aaaaaaaa-0000-0000-0000-000000000006', mese => primo(-5),
    righe => (select jsonb_agg(jsonb_build_object('corso', 'c' || i, 'lezioni', 1, 'minuti', 60, 'centesimi_ora', 100, 'importo', 100))::text from generate_series(1, 51) i),
    calcolato => 5100, importo => 5100)), 'NEGATO: …');
select atteso('il calcolato che non è la somma delle righe no', tenta(ricevuta('aaaaaaaa-0000-0000-0000-000000000006', mese => primo(-5), calcolato => 9900, importo => 9900)), 'NEGATO: …');
select atteso('il calcolato negativo no', tenta(ricevuta('aaaaaaaa-0000-0000-0000-000000000006', mese => primo(-5), calcolato => -1, importo => 12000, motivo => 'Sbagliato')), 'NEGATO: …');
select atteso('un compenso di zero no', tenta(ricevuta('aaaaaaaa-0000-0000-0000-000000000006', mese => primo(-5), importo => 0, motivo => 'Non ha lavorato')), 'NEGATO: …');
select atteso('un compenso oltre 100.000 € no', tenta(ricevuta('aaaaaaaa-0000-0000-0000-000000000006', mese => primo(-5), importo => 10000001, motivo => 'Battuto male')), 'NEGATO: …');
select atteso('fino a 100.000 € sì', tenta(ricevuta('aaaaaaaa-0000-0000-0000-000000000006', mese => primo(-5), importo => 10000000, motivo => 'Il premio della stagione')), 'true');
select atteso('il compenso diverso senza perché no', tenta(ricevuta('aaaaaaaa-0000-0000-0000-000000000006', mese => primo(-6), importo => 15000)), 'NEGATO: …');
select atteso('col perché vuoto no', tenta(ricevuta('aaaaaaaa-0000-0000-0000-000000000006', mese => primo(-6), importo => 15000, motivo => '   ')), 'NEGATO: …');
select atteso('col perché di due lettere no', tenta(ricevuta('aaaaaaaa-0000-0000-0000-000000000006', mese => primo(-6), importo => 15000, motivo => 'ok')), 'NEGATO: …');
select atteso('col perché oltre 200 caratteri no', tenta(ricevuta('aaaaaaaa-0000-0000-0000-000000000006', mese => primo(-6), importo => 15000, motivo => repeat('x', 201))), 'NEGATO: …');
select atteso('col perché di 200 caratteri sì', tenta(ricevuta('aaaaaaaa-0000-0000-0000-000000000006', mese => primo(-6), importo => 15000, motivo => repeat('x', 200))), 'true');
select atteso('una qualifica fuori elenco no', tenta(ricevuta('aaaaaaaa-0000-0000-0000-000000000006', mese => primo(-7), qualifica => 'Bidello')), 'NEGATO: …');
select atteso('i dati del tecnico che non sono un oggetto no', tenta(ricevuta('aaaaaaaa-0000-0000-0000-000000000006', mese => primo(-7), tecnico => '[]')), 'NEGATO: …');
select atteso('i dati del tecnico oltre 8 KB no',
  tenta(ricevuta('aaaaaaaa-0000-0000-0000-000000000006', mese => primo(-7), tecnico => jsonb_build_object('nome', (select string_agg(md5(i::text), '') from generate_series(1, 400) i))::text)), 'NEGATO: …');
select atteso('per la segreteria che non insegna no', tenta(ricevuta('aaaaaaaa-0000-0000-0000-000000000001', mese => primo(-7))), 'NEGATO: …');
select atteso('per l''amministrazione che non insegna no', tenta(ricevuta('aaaaaaaa-0000-0000-0000-000000000002', mese => primo(-7))), 'NEGATO: …');
select atteso('per un iscritto no', tenta(ricevuta('aaaaaaaa-0000-0000-0000-000000000003', mese => primo(-7))), 'NEGATO: …');
select atteso('le ricevute sono ancora quelle di prima, più le due di Ivo', (select count(*)::text from ricevute_compensi), '10');
reset role;
select atteso('il compenso diverso senza perché no, nemmeno da dentro',
  tenta($$insert into ricevute_compensi (persona_id, mese, righe, calcolato, importo, tecnico, data)
    values ('aaaaaaaa-0000-0000-0000-000000000006', date_trunc('month', current_date) - interval '8 months',
      '[{"corso": "Judo kids", "lezioni": 4, "minuti": 480, "centesimi_ora": 1500, "importo": 12000}]', 12000, 15000, '{"nome": "Ivo"}', current_date)$$), 'NEGATO: …');
select atteso('un perché col compenso uguale no, nemmeno da dentro',
  tenta($$insert into ricevute_compensi (persona_id, mese, righe, calcolato, importo, motivo, tecnico, data)
    values ('aaaaaaaa-0000-0000-0000-000000000006', date_trunc('month', current_date) - interval '8 months',
      '[{"corso": "Judo kids", "lezioni": 4, "minuti": 480, "centesimi_ora": 1500, "importo": 12000}]', 12000, 12000, 'Uguale', '{"nome": "Ivo"}', current_date)$$), 'NEGATO: …');
select atteso('un mese non al primo no, nemmeno da dentro',
  tenta($$insert into ricevute_compensi (persona_id, mese, righe, calcolato, importo, tecnico, data)
    values ('aaaaaaaa-0000-0000-0000-000000000006', date_trunc('month', current_date) - interval '8 months' + interval '3 days',
      '[{"corso": "Judo kids", "lezioni": 4, "minuti": 480, "centesimi_ora": 1500, "importo": 12000}]', 12000, 12000, '{"nome": "Ivo"}', current_date)$$), 'NEGATO: …');

\echo ''
\echo '--- 5. dopo, si cambia solo «firmata» ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria la spunta firmata',
  tenta($$update ricevute_compensi set firmata = true where annullata_il is null and mese = date_trunc('month', current_date) - interval '1 month' and persona_id = 'aaaaaaaa-0000-0000-0000-000000000005'$$), 'FATTO (1 righe)');
select atteso('e la toglie',
  tenta($$update ricevute_compensi set firmata = false where annullata_il is null and mese = date_trunc('month', current_date) - interval '1 month' and persona_id = 'aaaaaaaa-0000-0000-0000-000000000005'$$), 'FATTO (1 righe)');
select atteso('non le cambia il compenso', tenta($$update ricevute_compensi set importo = 99900$$), 'NEGATO: …');
select atteso('né il calcolato', tenta($$update ricevute_compensi set calcolato = 99900$$), 'NEGATO: …');
select atteso('né il perché', tenta($$update ricevute_compensi set motivo = 'Cambiato dopo'$$), 'NEGATO: …');
select atteso('né le righe', tenta($$update ricevute_compensi set righe = '[]'$$), 'NEGATO: …');
select atteso('né il mese', tenta($$update ricevute_compensi set mese = '2020-01-01'$$), 'NEGATO: …');
select atteso('né i dati del tecnico', tenta($$update ricevute_compensi set tecnico = '{}'$$), 'NEGATO: …');
select atteso('né la qualifica', tenta($$update ricevute_compensi set qualifica = 'Altro'$$), 'NEGATO: …');
select atteso('una annullata non torna valida', tenta($$update ricevute_compensi set annullata_il = null$$), 'NEGATO: …');
select atteso('non se ne cancella una', tenta($$delete from ricevute_compensi$$), 'NEGATO: …');
select atteso('non se ne scrive una a mano: solo con fai_ricevuta_compenso',
  tenta($$insert into ricevute_compensi (persona_id, mese, righe, calcolato, importo, tecnico, data)
    values ('aaaaaaaa-0000-0000-0000-000000000006', date_trunc('month', current_date) - interval '9 months',
      '[{"corso": "Judo kids", "lezioni": 4, "minuti": 480, "centesimi_ora": 1500, "importo": 12000}]', 12000, 12000, '{"nome": "Ivo"}', current_date)$$), 'NEGATO: …');
select atteso('i compensi sono ancora quelli', (select sum(importo)::text from ricevute_compensi), '10109950');
reset role;

\echo ''
\echo '--- 6. chi non è la segreteria: niente ---'
-- Maura è il tecnico delle ricevute: nemmeno le sue.
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('l''istruttore non vede le ricevute, nemmeno le sue', (select count(*)::text from ricevute_compensi), '0');
select atteso('non se ne fa una', tenta(ricevuta('aaaaaaaa-0000-0000-0000-000000000005', mese => primo(-9))), 'NEGATO: …');
select atteso('non le annulla', tenta(annulla(:'maura_scorso')), 'NEGATO: …');
select atteso('non le spunta firmate', (tenta($$update ricevute_compensi set firmata = true$$) not like 'FATTO%')::text, 'true');
reset role;
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('l''amministrazione non vede le ricevute', (select count(*)::text from ricevute_compensi), '0');
select atteso('non se ne fa una', tenta(ricevuta('aaaaaaaa-0000-0000-0000-000000000006', mese => primo(-9))), 'NEGATO: …');
select atteso('non le annulla', tenta(annulla(:'maura_scorso')), 'NEGATO: …');
select atteso('non le spunta firmate', (tenta($$update ricevute_compensi set firmata = true$$) not like 'FATTO%')::text, 'true');
reset role;
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('l''iscritto non vede le ricevute', (select count(*)::text from ricevute_compensi), '0');
select atteso('non se ne fa una', tenta(ricevuta('aaaaaaaa-0000-0000-0000-000000000006', mese => primo(-9))), 'NEGATO: …');
select atteso('non le annulla', tenta(annulla(:'maura_scorso')), 'NEGATO: …');
select atteso('non le spunta firmate', (tenta($$update ricevute_compensi set firmata = true$$) not like 'FATTO%')::text, 'true');
reset role;
select chi('77777777-7777-7777-7777-777777777777');
set role authenticated;
select atteso('il tablet non vede le ricevute', (select count(*)::text from ricevute_compensi), '0');
select atteso('non ne fa', tenta(ricevuta('aaaaaaaa-0000-0000-0000-000000000006', mese => primo(-9))), 'NEGATO: …');
select atteso('non le annulla', tenta(annulla(:'maura_scorso')), 'NEGATO: …');
select atteso('non spunta firmata', (tenta($$update ricevute_compensi set firmata = true$$) not like 'FATTO%')::text, 'true');
reset role;
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('l''account senza scheda non vede le ricevute', (select count(*)::text from ricevute_compensi), '0');
select atteso('non ne fa', tenta(ricevuta('aaaaaaaa-0000-0000-0000-000000000006', mese => primo(-9))), 'NEGATO: …');
select atteso('non le annulla', tenta(annulla(:'maura_scorso')), 'NEGATO: …');
reset role;
select chi('');
set role anon;
select atteso('anon non legge le ricevute', tenta($$select count(*)::text from ricevute_compensi$$), 'NEGATO: …');
select atteso('non se ne fa una', tenta(ricevuta('aaaaaaaa-0000-0000-0000-000000000006', mese => primo(-9))), 'NEGATO: …');
select atteso('non le annulla', tenta(annulla(:'maura_scorso')), 'NEGATO: …');
select atteso('non le spunta firmate', tenta($$update ricevute_compensi set firmata = true$$), 'NEGATO: …');
reset role;
select atteso('e nessuno di loro ha cambiato niente: firmate nessuna, ricevute 10, annullate 1',
  (select count(*) filter (where firmata) || ' ' || count(*) || ' ' || count(*) filter (where annullata_il is not null) from ricevute_compensi), '0 10 1');

\echo ''
\echo '--- 7. un tecnico con ricevute non si elimina ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('eliminare Ivo, che ha solo ricevute: no, col messaggio', tenta($$select elimina_istruttore('aaaaaaaa-0000-0000-0000-000000000006')::text$$),
  'NEGATO: Ivo Tecnico ha già lavorato nei registri: non si elimina, gli si toglie l''accesso');
reset role;
select atteso('nemmeno cancellando la riga', tenta($$delete from persone where id = 'aaaaaaaa-0000-0000-0000-000000000006'$$), 'NEGATO: …');
select atteso('e le sue ricevute restano', (select count(*)::text from ricevute_compensi where persona_id = 'aaaaaaaa-0000-0000-0000-000000000006'), '3');
