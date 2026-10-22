-- La ricevuta di compenso EXTRA (`96-compensi-extra.sql`): un compenso fuori
-- dal conto delle lezioni (uno stage, per esempio), con la sua ricevuta
-- separata da quella del mese. Stessa tabella `ricevute_compensi`, colonna
-- `extra` (la descrizione; null per la ricevuta del mese). Più extra per lo
-- stesso tecnico e mese, anche identiche; nessuna riga corso, nessun
-- calcolato; il tecnico e la qualifica li prende il server dalla scheda e
-- dalla ricevuta del mese; la data è oggi. Si cambiano e si annullano finché
-- non sono pagate; `paga_compensi` le paga con quelle del mese in un
-- movimento solo. Le stesse regole della modalità prova, provate da
-- scripts/prova-compensi-extra.mjs.
-- Si lancia dopo finto-supabase.sql e tutto lo schema (96-compensi-extra.sql
-- compreso). I mesi sono del 2025, già passati: le descrizioni sono sempre le
-- stesse.
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
-- Anna: segreteria e amministrazione, chi fa e paga. Sandro: solo segreteria.
-- Ada: solo amministrazione. Maura (con l'accesso), Ivo e i tre senza un dato:
-- i tecnici. Luca: iscritto.
insert into persone (id, nome, cognome, ruolo, anche_istruttore, anche_amministrazione, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', false, true, 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'Sandro', 'Banco', 'staff', false, false, 'sandro@ods.it', '44444444-4444-4444-4444-444444444444'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Ada', 'Conti', 'amministrazione', false, false, 'ada@ods.it', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'Maura', 'Uno', 'istruttore', false, false, 'maura@ods.it', '55555555-5555-5555-5555-555555555555'),
  ('aaaaaaaa-0000-0000-0000-000000000006', 'Ivo', 'Tecnico', 'istruttore', false, false, null, null),
  ('aaaaaaaa-0000-0000-0000-000000000008', 'Gino', 'SenzaCodice', 'istruttore', false, false, null, null),
  ('aaaaaaaa-0000-0000-0000-000000000009', 'Lia', 'SenzaCasa', 'istruttore', false, false, null, null),
  ('aaaaaaaa-0000-0000-0000-000000000010', 'Ugo', 'SenzaIban', 'istruttore', false, false, null, null),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Luca', 'Rossi', 'iscritto', false, false, 'luca@ods.it', '33333333-3333-3333-3333-333333333333');
-- Le schede dei tecnici: Maura e Ivo complete; gli altri senza il codice fiscale, la residenza o l'IBAN.
insert into anagrafiche (persona_id, nato_il, nato_a, codice_fiscale, indirizzo, cap, comune, iban) values
  ('aaaaaaaa-0000-0000-0000-000000000005', '1986-06-21', 'Pinerolo', 'BLLDNI86H61H355W', 'Via Montelera 73', '10040', 'Val della Torre', 'IT60X0542811101000000123456'),
  ('aaaaaaaa-0000-0000-0000-000000000006', '1990-01-02', 'Torino', 'TCNVIO90A02L219K', 'Via Roma 1', '10100', 'Torino', 'IT60X0542811101000000654321'),
  ('aaaaaaaa-0000-0000-0000-000000000008', '1990-01-02', 'Torino', null, 'Via Roma 1', '10100', 'Torino', 'IT60X0542811101000000654321'),
  ('aaaaaaaa-0000-0000-0000-000000000009', '1990-01-02', 'Torino', 'LSACSA90A42L219P', null, null, null, 'IT60X0542811101000000654321'),
  ('aaaaaaaa-0000-0000-0000-000000000010', '1990-01-02', 'Torino', 'GUOSBN90A02L219Q', 'Via Roma 1', '10100', 'Torino', null);

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
-- Il primo del mese, `quanti` mesi da questo (0 questo, -1 il mese scorso, 1 il prossimo).
create or replace function primo(quanti int = 0) returns text language sql as $$
  select to_char(date_trunc('month', current_date) + make_interval(months => quanti), 'YYYY-MM-DD')
$$;
-- Le chiamate coi nomi giusti: le usa `tenta`, così i rifiuti si leggono uno per riga.
create or replace function extra(persona text, mese text, descrizione text = 'Stage di judo a Bardonecchia', importo int = 25000) returns text language sql as $$
  select format($f$select ((fai_ricevuta_compenso_extra(persona => %L, mese => %L, descrizione => %L, importo => %s)).id is not null)::text$f$,
    persona, mese, descrizione, coalesce(importo::text, 'null'))
$$;
create or replace function modifica(id text, descrizione text = 'Stage cambiato', importo int = 30000) returns text language sql as $$
  select format($f$select ((modifica_ricevuta_compenso_extra(id => %L, descrizione => %L, importo => %s)).id is not null)::text$f$, id, descrizione, coalesce(importo::text, 'null'))
$$;
create or replace function annulla(id text) returns text language sql as $$
  select format($f$select ((annulla_ricevuta_compenso(id => %L)).annullata_il is not null)::text$f$, id)
$$;
create or replace function paga(ricevute text, data text, cassa text) returns text language sql as $$
  select format($f$select ((paga_compensi(ricevute => %L::uuid[], data => %L::date, cassa => %L::uuid)).id is not null)::text$f$, ricevute, data, cassa)
$$;
-- La ricevuta del mese di sempre, per provare che con le extra convive.
create or replace function del_mese(persona text, mese text) returns text language sql as $$
  select format($f$select ((fai_ricevuta_compenso(persona => %L, mese => %L, righe => '[{"corso": "Judo kids", "lezioni": 4, "minuti": 480, "centesimi_ora": 1500, "importo": 12000}]'::jsonb,
    calcolato => 12000, importo => 12000, motivo => null, tecnico => '{"nome": "Ivo"}'::jsonb, qualifica => 'Allenatore', data => current_date)).id is not null)::text$f$, persona, mese)
$$;
grant execute on function tenta(text), atteso(text, text, text), chi(text), giorno(int), primo(int),
  extra(text, text, text, int), modifica(text, text, int), annulla(text), paga(text, text, text), del_mese(text, text) to anon, authenticated;

-- Le ricevute del mese di Maura, da dentro: quattro lezioni di due ore di Judo kids a 15 € l'ora, 120 €.
create or replace function semina(persona text, mese text) returns uuid language sql as $$
  insert into ricevute_compensi (persona_id, mese, righe, calcolato, importo, tecnico, qualifica, data)
  values (persona::uuid, mese::date, '[{"corso": "Judo kids", "lezioni": 4, "minuti": 480, "centesimi_ora": 1500, "importo": 12000}]', 12000, 12000,
    '{"nome": "Maura", "cognome": "Uno", "codiceFiscale": "BLLDNI86H61H355W", "iban": "IT60X0542811101000000123456"}', 'Allenatore', current_date)
  returning id
$$;
select semina('aaaaaaaa-0000-0000-0000-000000000005', '2025-09-01') as m_set \gset
select semina('aaaaaaaa-0000-0000-0000-000000000005', '2025-10-01') as m_ott \gset
select semina('aaaaaaaa-0000-0000-0000-000000000005', '2025-11-01') as m_nov \gset
select id as contanti from casse where nome = 'Cassa Contanti' \gset
select id as conto from casse where nome = 'Conto Corrente' \gset

\echo ''
\echo '--- 0. il file c''è ---'
select atteso('la ricevuta ha la colonna extra, testo',
  (select data_type from information_schema.columns where table_schema = 'public' and table_name = 'ricevute_compensi' and column_name = 'extra'), 'text');
select atteso('c''è fai_ricevuta_compenso_extra', (select count(*)::text from pg_proc where proname = 'fai_ricevuta_compenso_extra'), '1');
select atteso('c''è modifica_ricevuta_compenso_extra', (select count(*)::text from pg_proc where proname = 'modifica_ricevuta_compenso_extra'), '1');
select atteso('una sola valida per persona e mese vale per quelle del mese, non per le extra',
  (select (indexdef like '%annullata_il IS NULL%' and indexdef like '%extra IS NULL%')::text from pg_indexes where indexname = 'ricevute_compensi_valida'), 'true');

\echo ''
\echo '--- 1. Anna fa una extra a Maura, che ha già la ricevuta del mese ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('fa la extra di settembre', tenta(extra('aaaaaaaa-0000-0000-0000-000000000005', '2025-09-01')), 'true');
reset role;
select id as e_set from ricevute_compensi where extra = 'Stage di judo a Bardonecchia' \gset
select atteso('la ricevuta del mese e la extra: due valide',
  (select count(*)::text from ricevute_compensi where persona_id = 'aaaaaaaa-0000-0000-0000-000000000005' and mese = '2025-09-01' and annullata_il is null), '2');
select atteso('la extra ha il suo id, la descrizione e l''importo',
  (select (id <> :'m_set')::text || ' ' || extra || ' ' || importo from ricevute_compensi where id = :'e_set'), 'true Stage di judo a Bardonecchia 25000');
select atteso('la ricevuta del mese non ha la descrizione', (select coalesce(extra, 'nessuna') from ricevute_compensi where id = :'m_set'), 'nessuna');
select atteso('nessuna riga corso e nessun calcolato', (select jsonb_array_length(righe) || ' ' || calcolato || ' ' || coalesce(motivo, 'senza motivo') from ricevute_compensi where id = :'e_set'), '0 0 senza motivo');
select atteso('il mese, il primo del mese', (select mese::text from ricevute_compensi where id = :'e_set'), '2025-09-01');
select atteso('la data è oggi', (select data::text from ricevute_compensi where id = :'e_set'), current_date::text);
select atteso('i dati del tecnico li prende il server dalla scheda, IBAN compreso',
  (select tecnico->>'nome' || ' ' || (tecnico->>'cognome') || ' ' || (tecnico->>'codiceFiscale') || ' ' || (tecnico->>'iban') || ' ' || (tecnico->>'comune') from ricevute_compensi where id = :'e_set'),
  'Maura Uno BLLDNI86H61H355W IT60X0542811101000000123456 Val della Torre');
select atteso('la qualifica è quella della ricevuta del mese', (select qualifica from ricevute_compensi where id = :'e_set'), 'Allenatore');
select atteso('non firmata, non annullata, non pagata',
  (select firmata::text || ' ' || coalesce(annullata_il::text, 'valida') || ' ' || coalesce(movimento_id::text, 'da pagare') from ricevute_compensi where id = :'e_set'), 'false valida da pagare');
select atteso('il server scrive chi l''ha fatta', (select p.nome from ricevute_compensi r join persone p on p.id = r.creata_da where r.id = :'e_set'), 'Anna');

\echo ''
\echo '--- 2. due extra uguali sì, due ricevute del mese no ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la seconda extra, identica, riesce', tenta(extra('aaaaaaaa-0000-0000-0000-000000000005', '2025-09-01')), 'true');
select atteso('e la terza, diversa', tenta(extra('aaaaaaaa-0000-0000-0000-000000000005', '2025-09-01', 'Rimborso trasferta', 8000)), 'true');
select atteso('settembre di Maura: la ricevuta del mese e tre extra, tutte valide',
  (select count(*) filter (where extra is null) || ' ' || count(*) filter (where extra is not null) from ricevute_compensi
    where persona_id = 'aaaaaaaa-0000-0000-0000-000000000005' and mese = '2025-09-01' and annullata_il is null), '1 3');
select atteso('una seconda ricevuta del mese no, come prima',
  tenta(format($f$select ((fai_ricevuta_compenso(persona => %L, mese => '2025-09-01', righe => '[{"corso": "Judo kids", "lezioni": 4, "minuti": 480, "centesimi_ora": 1500, "importo": 12000}]'::jsonb,
    calcolato => 12000, importo => 12000, motivo => null, tecnico => '{"nome": "Maura"}'::jsonb, qualifica => 'Allenatore', data => current_date)).id is not null)::text$f$, 'aaaaaaaa-0000-0000-0000-000000000005')),
  'NEGATO: C''è già la ricevuta di questo mese: annullala prima di rifarla');
-- Ivo ha solo una extra: la sua ricevuta del mese si fa lo stesso, e viceversa.
select atteso('Ivo: una extra senza ricevuta del mese', tenta(extra('aaaaaaaa-0000-0000-0000-000000000006', '2025-09-01', 'Torneo di Natale', 10000)), 'true');
select atteso('la extra non conta come la ricevuta del mese: quella si fa', tenta(del_mese('aaaaaaaa-0000-0000-0000-000000000006', '2025-09-01')), 'true');
select atteso('e dopo, un''altra extra', tenta(extra('aaaaaaaa-0000-0000-0000-000000000006', '2025-09-01', 'Torneo di Natale', 10000)), 'true');
reset role;
select atteso('due ricevute del mese valide per la stessa persona no, nemmeno da dentro',
  tenta($$insert into ricevute_compensi (persona_id, mese, righe, calcolato, importo, tecnico, data)
    values ('aaaaaaaa-0000-0000-0000-000000000005', '2025-09-01', '[{"corso": "Judo kids", "lezioni": 4, "minuti": 480, "centesimi_ora": 1500, "importo": 12000}]', 12000, 12000, '{"nome": "Maura"}', current_date)$$), 'NEGATO: …');

\echo ''
\echo '--- 3. cosa non entra ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('importo zero no, col messaggio', tenta(extra('aaaaaaaa-0000-0000-0000-000000000005', '2025-10-01', importo => 0)), 'NEGATO: Il compenso è un importo più grande di zero');
select atteso('importo negativo no', tenta(extra('aaaaaaaa-0000-0000-0000-000000000005', '2025-10-01', importo => -100)), 'NEGATO: Il compenso è un importo più grande di zero');
select atteso('importo che manca no', tenta(extra('aaaaaaaa-0000-0000-0000-000000000005', '2025-10-01', importo => null)), 'NEGATO: Il compenso è un importo più grande di zero');
select atteso('oltre 100.000 € no, col messaggio', tenta(extra('aaaaaaaa-0000-0000-0000-000000000005', '2025-10-01', importo => 10000001)), 'NEGATO: Il compenso è al massimo 100.000 €');
select atteso('la descrizione di due lettere no, col messaggio', tenta(extra('aaaaaaaa-0000-0000-0000-000000000005', '2025-10-01', 'ok')), 'NEGATO: Scrivi per che cosa è il compenso: almeno tre lettere');
select atteso('di soli spazi no', tenta(extra('aaaaaaaa-0000-0000-0000-000000000005', '2025-10-01', '     ')), 'NEGATO: Scrivi per che cosa è il compenso: almeno tre lettere');
select atteso('di soli a capo e tab no, come nell''app', tenta(extra('aaaaaaaa-0000-0000-0000-000000000005', '2025-10-01', E'\n\t\n')), 'NEGATO: Scrivi per che cosa è il compenso: almeno tre lettere');
select atteso('che manca no', tenta(extra('aaaaaaaa-0000-0000-0000-000000000005', '2025-10-01', null)), 'NEGATO: Scrivi per che cosa è il compenso: almeno tre lettere');
select atteso('oltre 200 caratteri no, col messaggio', tenta(extra('aaaaaaaa-0000-0000-0000-000000000005', '2025-10-01', repeat('x', 201))), 'NEGATO: La descrizione è troppo lunga: al massimo 200 caratteri');
select atteso('di 200 caratteri sì', tenta(extra('aaaaaaaa-0000-0000-0000-000000000005', '2025-10-01', repeat('x', 200))), 'true');
select atteso('di tre lettere sì', tenta(extra('aaaaaaaa-0000-0000-0000-000000000005', '2025-10-01', 'abc')), 'true');
select atteso('fino a 100.000 € sì', tenta(extra('aaaaaaaa-0000-0000-0000-000000000005', '2025-10-01', 'Il premio della stagione', 10000000)), 'true');
select atteso('il mese prossimo no, come per la ricevuta del mese', tenta(extra('aaaaaaaa-0000-0000-0000-000000000005', primo(1))), 'NEGATO: Il mese della ricevuta non va: il primo del mese, non nel futuro');
select atteso('fra un anno no', tenta(extra('aaaaaaaa-0000-0000-0000-000000000005', primo(12))), 'NEGATO: Il mese della ricevuta non va: il primo del mese, non nel futuro');
select atteso('un mese che non è il primo no', tenta(extra('aaaaaaaa-0000-0000-0000-000000000005', to_char(primo(-5)::date + 14, 'YYYY-MM-DD'))), 'NEGATO: Il mese della ricevuta non va: il primo del mese, non nel futuro');
select atteso('questo mese sì: la extra si paga ora', tenta(extra('aaaaaaaa-0000-0000-0000-000000000005', primo(0))), 'true');
select atteso('la segreteria che non insegna non ha extra', tenta(extra('aaaaaaaa-0000-0000-0000-000000000004', '2025-10-01')), 'NEGATO: La ricevuta del compenso si fa a chi insegna');
select atteso('l''amministrazione che non insegna no', tenta(extra('aaaaaaaa-0000-0000-0000-000000000002', '2025-10-01')), 'NEGATO: La ricevuta del compenso si fa a chi insegna');
select atteso('un iscritto no', tenta(extra('aaaaaaaa-0000-0000-0000-000000000003', '2025-10-01')), 'NEGATO: La ricevuta del compenso si fa a chi insegna');
select atteso('una persona che non c''è no', tenta(extra('99999999-9999-9999-9999-999999999999', '2025-10-01')), 'NEGATO: La ricevuta del compenso si fa a chi insegna');
select atteso('senza codice fiscale no, come la ricevuta del mese', tenta(extra('aaaaaaaa-0000-0000-0000-000000000008', '2025-10-01')), 'NEGATO: Mancano i dati per la ricevuta: codice fiscale');
select atteso('senza residenza no', tenta(extra('aaaaaaaa-0000-0000-0000-000000000009', '2025-10-01')), 'NEGATO: Mancano i dati per la ricevuta: residenza');
select atteso('senza IBAN no', tenta(extra('aaaaaaaa-0000-0000-0000-000000000010', '2025-10-01')), 'NEGATO: Mancano i dati per la ricevuta: IBAN');
reset role;
select atteso('di quelle rifiutate non è rimasto niente',
  (select count(*)::text from ricevute_compensi where persona_id in ('aaaaaaaa-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000003',
    'aaaaaaaa-0000-0000-0000-000000000008', 'aaaaaaaa-0000-0000-0000-000000000009', 'aaaaaaaa-0000-0000-0000-000000000010')), '0');
select atteso('una extra scritta a mano, senza passare dalla funzione, no',
  tenta($$insert into ricevute_compensi (persona_id, mese, righe, calcolato, importo, tecnico, data, extra)
    values ('aaaaaaaa-0000-0000-0000-000000000006', '2025-08-01', '[]', 0, 5000, '{"nome": "Ivo"}', current_date, 'A mano')$$), 'NEGATO: …');

\echo ''
\echo '--- 4. si cambia finché non è pagata ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('Anna cambia descrizione e importo', tenta(modifica(:'e_set', 'Stage di judo a Sauze', 27000)), 'true');
select atteso('e li rilegge', (select extra || ' ' || importo from ricevute_compensi where id = :'e_set'), 'Stage di judo a Sauze 27000');
select atteso('Anna la segna firmata', tenta(format('update ricevute_compensi set firmata = true where id = %L', :'e_set')), 'FATTO (1 righe)');
select atteso('e la cambia ancora', tenta(modifica(:'e_set', 'Stage di judo a Sauze', 27000)), 'true');
select atteso('cambiata, torna da firmare: il foglio firmato è quello di prima', (select firmata::text from ricevute_compensi where id = :'e_set'), 'false');
select atteso('il resto non cambia: mese, tecnico, data, non annullata',
  (select mese::text || ' ' || (tecnico->>'cognome') || ' ' || data::text || ' ' || coalesce(annullata_il::text, 'valida') from ricevute_compensi where id = :'e_set'),
  '2025-09-01 Uno ' || current_date::text || ' valida');
select atteso('importo zero no', tenta(modifica(:'e_set', 'Stage', 0)), 'NEGATO: Il compenso è un importo più grande di zero');
select atteso('oltre 100.000 € no', tenta(modifica(:'e_set', 'Stage', 10000001)), 'NEGATO: Il compenso è al massimo 100.000 €');
select atteso('descrizione di due lettere no', tenta(modifica(:'e_set', 'ok', 1000)), 'NEGATO: Scrivi per che cosa è il compenso: almeno tre lettere');
select atteso('oltre 200 caratteri no', tenta(modifica(:'e_set', repeat('x', 201), 1000)), 'NEGATO: La descrizione è troppo lunga: al massimo 200 caratteri');
select atteso('la ricevuta del mese non si cambia da qui, col messaggio', tenta(modifica(:'m_set', 'Stage', 1000)), 'NEGATO: Si cambiano solo le ricevute extra');
select atteso('una che non c''è no', tenta(modifica('99999999-9999-9999-9999-999999999999', 'Stage', 1000)), 'NEGATO: …');
select atteso('niente è cambiato dopo i rifiuti', (select extra || ' ' || importo from ricevute_compensi where id = :'e_set'), 'Stage di judo a Sauze 27000');
select atteso('il compenso della extra non si cambia a mano dalla tabella', tenta(format('update ricevute_compensi set importo = 99900 where id = %L', :'e_set')), 'NEGATO: …');
select atteso('né la descrizione', tenta(format('update ricevute_compensi set extra = %L where id = %L', 'Altro', :'e_set')), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 5. annullarla: la ricevuta del mese resta com''è ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('Anna annulla la extra di Ivo',
  tenta(annulla((select id::text from ricevute_compensi where persona_id = 'aaaaaaaa-0000-0000-0000-000000000006' and extra is not null order by creata_il, id limit 1))), 'true');
reset role;
select atteso('annullata adesso, non cancellata',
  (select count(*) filter (where annullata_il > now() - interval '1 minute') || ' ' || count(*) from ricevute_compensi where persona_id = 'aaaaaaaa-0000-0000-0000-000000000006' and extra is not null), '1 2');
select atteso('la ricevuta del mese di Ivo è com''è: valida',
  (select coalesce(annullata_il::text, 'valida') from ricevute_compensi where persona_id = 'aaaaaaaa-0000-0000-0000-000000000006' and extra is null), 'valida');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('annullata una volta, non due',
  tenta(annulla((select id::text from ricevute_compensi where persona_id = 'aaaaaaaa-0000-0000-0000-000000000006' and extra is not null and annullata_il is not null limit 1))), 'NEGATO: …');
select atteso('una annullata non si cambia',
  tenta(modifica((select id::text from ricevute_compensi where persona_id = 'aaaaaaaa-0000-0000-0000-000000000006' and extra is not null and annullata_il is not null limit 1))), 'NEGATO: …');
select atteso('annullata la extra di Ivo, se ne fa un''altra uguale', tenta(extra('aaaaaaaa-0000-0000-0000-000000000006', '2025-09-01', 'Torneo di Natale', 10000)), 'true');
reset role;

\echo ''
\echo '--- 6. il pagamento: extra e ricevuta del mese insieme, un movimento ---'
-- Maura, novembre: la ricevuta del mese (120 €) e una extra (250 €).
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('una extra a novembre', tenta(extra('aaaaaaaa-0000-0000-0000-000000000005', '2025-11-01', 'Stage di judo a Bardonecchia', 25000)), 'true');
reset role;
select id as e_nov from ricevute_compensi where mese = '2025-11-01' and extra is not null \gset
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('Anna paga la ricevuta di novembre e la extra col bonifico', tenta(paga(format('{%s,%s}', :'m_nov', :'e_nov'), giorno(3), :'conto')), 'true');
reset role;
select id as pag_nov from movimenti where persona_id = 'aaaaaaaa-0000-0000-0000-000000000005' and annullato_il is null \gset
select atteso('un movimento solo', (select count(*)::text from movimenti), '1');
select atteso('è la somma delle due (120 + 250 €)', (select importo::text from movimenti where id = :'pag_nov'), '37000');
select atteso('la voce «Compensi istruttori», la persona è il tecnico',
  (select v.nome || ' · ' || p.nome from movimenti m join voci_contabili v on v.id = m.voce_id join persone p on p.id = m.persona_id where m.id = :'pag_nov'), 'Compensi istruttori · Maura');
select atteso('la descrizione nomina il testo della extra', (select descrizione from movimenti where id = :'pag_nov'), 'Compenso · Maura Uno · nov 2025 · Stage di judo a Bardonecchia');
select atteso('mai codice fiscale né IBAN',
  (select (concat(descrizione, nota) not like '%BLLDNI86H61H355W%' and concat(descrizione, nota) not like '%IT60X%')::text from movimenti where id = :'pag_nov'), 'true');
select atteso('tutte e due col movimento e il giorno del pagamento',
  (select string_agg((movimento_id = :'pag_nov')::text || ' ' || pagata_il::text, '|' order by (extra is null)) from ricevute_compensi where id in (:'m_nov', :'e_nov')), 'true ' || giorno(3) || '|true ' || giorno(3));

\echo ''
\echo '--- 7. una extra pagata non si annulla né si cambia ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('annullarla no, col messaggio', tenta(annulla(:'e_nov')), 'NEGATO: È pagata: prima annulla il pagamento in CONTABILITÀ → MOVIMENTI');
select atteso('cambiarla no, col messaggio', tenta(modifica(:'e_nov', 'Stage cambiato', 1000)), 'NEGATO: È pagata: prima annulla il pagamento in CONTABILITÀ → MOVIMENTI');
reset role;
select atteso('resta com''è', (select extra || ' ' || importo || ' ' || coalesce(annullata_il::text, 'valida') from ricevute_compensi where id = :'e_nov'), 'Stage di judo a Bardonecchia 25000 valida');

\echo ''
\echo '--- 8. annullato il pagamento, tornano da pagare tutte e due ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('Anna annulla il pagamento in CONTABILITÀ', tenta(format('select annulla_movimento(%L)::text', :'pag_nov')), '');
reset role;
select atteso('la ricevuta del mese e la extra sono da pagare',
  (select count(*) filter (where movimento_id is null and pagata_il is null)::text from ricevute_compensi where id in (:'m_nov', :'e_nov')), '2');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('ora la extra si cambia', tenta(modifica(:'e_nov', 'Stage cambiato dopo', 26000)), 'true');
select atteso('e si ripaga con la ricevuta del mese', tenta(paga(format('{%s,%s}', :'m_nov', :'e_nov'), giorno(2), :'conto')), 'true');
reset role;
select atteso('descrizione con il testo nuovo', (select descrizione from movimenti where annullato_il is null and persona_id = 'aaaaaaaa-0000-0000-0000-000000000005'),
  'Compenso · Maura Uno · nov 2025 · Stage cambiato dopo');
select id as pag_nov2 from movimenti where annullato_il is null and persona_id = 'aaaaaaaa-0000-0000-0000-000000000005' \gset

\echo ''
\echo '--- 9. una extra dove la ricevuta del mese è già pagata ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('Anna paga la ricevuta di ottobre di Maura', tenta(paga(format('{%s}', :'m_ott'), giorno(1), :'contanti')), 'true');
select atteso('e le fa una extra di ottobre', tenta(extra('aaaaaaaa-0000-0000-0000-000000000005', '2025-10-01', 'Stage di ottobre', 15000)), 'true');
reset role;
select atteso('la ricevuta di ottobre resta pagata', (select (movimento_id is not null and pagata_il = current_date - 1 and annullata_il is null)::text from ricevute_compensi where id = :'m_ott'), 'true');
select atteso('la extra di ottobre è da pagare', (select (movimento_id is null)::text from ricevute_compensi where mese = '2025-10-01' and extra = 'Stage di ottobre'), 'true');

\echo ''
\echo '--- 10. annullare un pagamento non tocca le extra degli altri pagamenti ---'
select id as e_ott from ricevute_compensi where mese = '2025-10-01' and extra = 'Stage di ottobre' \gset
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la extra di ottobre si paga da sola', tenta(paga(format('{%s}', :'e_ott'), giorno(0), :'conto')), 'true');
reset role;
select id as pag_ott_extra from movimenti where annullato_il is null and descrizione like '%Stage di ottobre' \gset
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('Anna annulla il pagamento di novembre', tenta(format('select annulla_movimento(%L)::text', :'pag_nov2')), '');
reset role;
select atteso('la extra di ottobre resta pagata', (select (movimento_id = :'pag_ott_extra')::text from ricevute_compensi where id = :'e_ott'), 'true');
select atteso('e la ricevuta di ottobre, pagata a parte, anche', (select (movimento_id is not null)::text from ricevute_compensi where id = :'m_ott'), 'true');
select atteso('solo novembre è tornato da pagare', (select count(*)::text from ricevute_compensi where mese = '2025-11-01' and movimento_id is null), '2');

\echo ''
\echo '--- 11. chi non è la segreteria: niente ---'
select id as e_ivo from ricevute_compensi where persona_id = 'aaaaaaaa-0000-0000-0000-000000000006' and extra is not null and annullata_il is null limit 1 \gset
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('l''istruttore non vede le extra, nemmeno le sue', (select count(*)::text from ricevute_compensi where extra is not null), '0');
select atteso('non se ne fa una', tenta(extra('aaaaaaaa-0000-0000-0000-000000000005', '2025-10-01')), 'NEGATO: …');
select atteso('non la cambia', tenta(modifica(:'e_nov')), 'NEGATO: …');
select atteso('non la annulla', tenta(annulla(:'e_nov')), 'NEGATO: …');
reset role;
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('l''amministrazione senza segreteria non vede le extra', (select count(*)::text from ricevute_compensi where extra is not null), '0');
select atteso('non ne fa', tenta(extra('aaaaaaaa-0000-0000-0000-000000000006', '2025-10-01')), 'NEGATO: …');
select atteso('non la cambia', tenta(modifica(:'e_ivo')), 'NEGATO: …');
select atteso('non la annulla', tenta(annulla(:'e_ivo')), 'NEGATO: …');
reset role;
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('l''iscritto non vede le extra', (select count(*)::text from ricevute_compensi where extra is not null), '0');
select atteso('non ne fa', tenta(extra('aaaaaaaa-0000-0000-0000-000000000006', '2025-10-01')), 'NEGATO: …');
select atteso('non la cambia', tenta(modifica(:'e_ivo')), 'NEGATO: …');
select atteso('non la annulla', tenta(annulla(:'e_ivo')), 'NEGATO: …');
reset role;
select chi('77777777-7777-7777-7777-777777777777');
set role authenticated;
select atteso('il tablet non vede le extra', (select count(*)::text from ricevute_compensi where extra is not null), '0');
select atteso('non ne fa', tenta(extra('aaaaaaaa-0000-0000-0000-000000000006', '2025-10-01')), 'NEGATO: …');
select atteso('non la cambia', tenta(modifica(:'e_ivo')), 'NEGATO: …');
select atteso('non la annulla', tenta(annulla(:'e_ivo')), 'NEGATO: …');
reset role;
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('l''account senza scheda non vede le extra', (select count(*)::text from ricevute_compensi where extra is not null), '0');
select atteso('non ne fa', tenta(extra('aaaaaaaa-0000-0000-0000-000000000006', '2025-10-01')), 'NEGATO: …');
select atteso('non la cambia', tenta(modifica(:'e_ivo')), 'NEGATO: …');
select atteso('non la annulla', tenta(annulla(:'e_ivo')), 'NEGATO: …');
reset role;
select chi('');
set role anon;
select atteso('anon non legge le extra', tenta($$select count(*)::text from ricevute_compensi where extra is not null$$), 'NEGATO: …');
select atteso('non ne fa', tenta(extra('aaaaaaaa-0000-0000-0000-000000000006', '2025-10-01')), 'NEGATO: …');
select atteso('non la cambia', tenta(modifica(:'e_ivo')), 'NEGATO: …');
select atteso('non la annulla', tenta(annulla(:'e_ivo')), 'NEGATO: …');
reset role;
select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('Sandro, solo segreteria, non paga una extra', tenta(paga(format('{%s}', :'e_ivo'), giorno(0), :'conto')), 'NEGATO: …');
select atteso('ma ne fa una', tenta(extra('aaaaaaaa-0000-0000-0000-000000000006', '2025-10-01', 'Torneo di Pasqua')), 'true');
reset role;
select atteso('e dopo tutto questo, la extra di Ivo è com''è',
  (select extra || ' ' || importo || ' ' || coalesce(annullata_il::text, 'valida') from ricevute_compensi where id = :'e_ivo'), 'Torneo di Natale 10000 valida');

\echo ''
\echo '--- 12. il testo del movimento: in ordine di creazione, accorciato oltre 200 ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('Anna fa due extra di agosto', tenta(extra('aaaaaaaa-0000-0000-0000-000000000005', '2025-08-01', 'Stage B')) || tenta(extra('aaaaaaaa-0000-0000-0000-000000000005', '2025-08-01', 'Stage A')), 'truetrue');
select atteso('e una di luglio lunga, con l''a capo in fondo', tenta(extra('aaaaaaaa-0000-0000-0000-000000000005', '2025-07-01', repeat('x', 199) || E'\n')), 'true');
reset role;
select atteso('l''a capo in fondo non si salva, come nell''app', (select length(extra)::text from ricevute_compensi where mese = '2025-07-01' and persona_id = 'aaaaaaaa-0000-0000-0000-000000000005'), '199');
-- Fatte nella stessa transazione avrebbero la stessa ora: le si dà a mano, B prima di A.
update ricevute_compensi set creata_il = case extra when 'Stage B' then '2025-08-02' else '2025-08-03' end::timestamptz where mese = '2025-08-01' and extra in ('Stage A', 'Stage B');
select string_agg(id::text, ',') as e_ago from ricevute_compensi where mese = '2025-08-01' and extra in ('Stage A', 'Stage B') \gset
select id as e_lug from ricevute_compensi where mese = '2025-07-01' and persona_id = 'aaaaaaaa-0000-0000-0000-000000000005' \gset
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('Anna le paga tutte e tre insieme', tenta(paga(format('{%s,%s}', :'e_ago', :'e_lug'), giorno(0), :'conto')), 'true');
reset role;
select id as pag_lug from movimenti where annullato_il is null and descrizione like 'Compenso · Maura Uno · lug, ago 2025%' \gset
select atteso('accorciata a 200 caratteri, con i puntini', (select length(descrizione)::text || ' ' || right(descrizione, 1) from movimenti where id = :'pag_lug'), '200 …');
select atteso('le extra in ordine di creazione: B, A, poi luglio (fatta adesso)', (select left(descrizione, 60) from movimenti where id = :'pag_lug'), 'Compenso · Maura Uno · lug, ago 2025 · Stage B · Stage A · x');
