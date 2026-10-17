-- I pagamenti a mano: soldi presi fuori dall'app, scritti e annullati solo
-- dalla segreteria. Si scrivono solo dalle due funzioni, non si cambiano e non
-- si cancellano; unendo due schede passano a chi resta.
-- Si lancia dopo finto-supabase.sql e i file dello schema, fino a
-- 54-pagamenti-diretti.sql.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'maura@ods.it'),
  ('33333333-3333-3333-3333-333333333333', 'luca@ods.it');
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Maura', 'Uno', 'istruttore', 'maura@ods.it', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Luca', 'Rossi', 'iscritto', 'luca@ods.it', '33333333-3333-3333-3333-333333333333'),
  -- Il doppione: resta la 10, la 11 se ne va.
  ('aaaaaaaa-0000-0000-0000-000000000010', 'Mario', 'D''Amico', 'iscritto', null, null),
  ('aaaaaaaa-0000-0000-0000-000000000011', 'Mario', 'Damico', 'iscritto', null, null);

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
-- Il codice dell'errore, per dire «non hai il permesso» (42501) e non un'altra cosa.
create or replace function codice(sql text) returns text language plpgsql as $$
begin
  execute sql;
  return 'nessun errore';
exception when others then return sqlstate;
end $$;
-- Un rifiuto della funzione, col suo codice e la sua frase: una funzione che manca (42883) non vale.
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
-- I dati di un pagamento buono, più quel che cambia il caso.
create or replace function pag(extra jsonb default '{}', senza text default null) returns jsonb language sql as $$
  select ('{"persona_id": "aaaaaaaa-0000-0000-0000-000000000010", "data": "2026-09-10", "importo": 5000, "metodo": "Contanti", "voce": "Quota associativa"}'::jsonb || extra)
         - coalesce(senza, '')
$$;
grant execute on function tenta(text), codice(text), rifiuto(text), atteso(text, text, text), chi(text), pag(jsonb, text) to anon, authenticated;

\echo ''
\echo '--- 1. la segreteria registra ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('registra un pagamento', (registra_pagamento_diretto(pag('{"nota": "ricevuta a mano n. 3"}')))->>'importo', '5000');
select atteso('lo trova scritto, con la nota e senza annullo',
  (select importo || ' ' || metodo || ' ' || voce || ' ' || data || ' ' || nota || ' ' || (annullato_il is null) from pagamenti_diretti), '5000 Contanti Quota associativa 2026-09-10 ricevuta a mano n. 3 true');
select atteso('chi l''ha scritto lo mette il server', (select p.nome from pagamenti_diretti d join persone p on p.id = d.creato_da), 'Anna');
-- `atteso` con voluto null non fallisce mai (il confronto dà null): il null si dice con una parola.
select atteso('la nota vuota è null', coalesce((registra_pagamento_diretto(pag('{"nota": ""}', null)))->>'nota', 'NULL'), 'NULL');
select atteso('senza nota va bene', (registra_pagamento_diretto(pag('{"importo": 1250}', 'nota')))->>'importo', '1250');
select atteso('un secondo pagamento sulla stessa persona', (select count(*)::text from pagamenti_diretti where persona_id = 'aaaaaaaa-0000-0000-0000-000000000010'), '3');
select atteso('la segreteria li legge', (select count(*)::text from pagamenti_diretti), '3');

\echo ''
\echo '--- 2. i rifiuti ---'
select atteso('una persona che non c''è no', rifiuto($$select registra_pagamento_diretto(pag('{"persona_id": "aaaaaaaa-0000-0000-0000-000000000099"}'))$$), '22023 …');
select atteso('senza persona no', rifiuto($$select registra_pagamento_diretto(pag('{}', 'persona_id'))$$), '22023 …');
select atteso('una data che non è una data no', rifiuto($$select registra_pagamento_diretto(pag('{"data": "domani"}'))$$), '22023 …');
select atteso('senza data no', rifiuto($$select registra_pagamento_diretto(pag('{}', 'data'))$$), '22023 …');
select atteso('un importo a zero no', rifiuto($$select registra_pagamento_diretto(pag('{"importo": 0}'))$$), '22023 …');
select atteso('un importo sotto zero no', rifiuto($$select registra_pagamento_diretto(pag('{"importo": -100}'))$$), '22023 …');
select atteso('un importo con la virgola no', rifiuto($$select registra_pagamento_diretto(pag('{"importo": 12.5}'))$$), '22023 …');
select atteso('un importo scritto a parole no', rifiuto($$select registra_pagamento_diretto(pag('{"importo": "cinquanta"}'))$$), '22023 …');
select atteso('senza importo no', rifiuto($$select registra_pagamento_diretto(pag('{}', 'importo'))$$), '22023 …');
select atteso('un metodo vuoto no', rifiuto($$select registra_pagamento_diretto(pag('{"metodo": "  "}'))$$), '22023 …');
select atteso('senza metodo no', rifiuto($$select registra_pagamento_diretto(pag('{}', 'metodo'))$$), '22023 …');
select atteso('un metodo di oltre 40 caratteri no', rifiuto($$select registra_pagamento_diretto(pag(jsonb_build_object('metodo', repeat('m', 41))))$$), '22023 …');
select atteso('una voce vuota no', rifiuto($$select registra_pagamento_diretto(pag('{"voce": ""}'))$$), '22023 …');
select atteso('senza voce no', rifiuto($$select registra_pagamento_diretto(pag('{}', 'voce'))$$), '22023 …');
select atteso('una voce di oltre 120 caratteri no', rifiuto($$select registra_pagamento_diretto(pag(jsonb_build_object('voce', repeat('v', 121))))$$), '22023 …');
select atteso('una nota di oltre 300 caratteri no', rifiuto($$select registra_pagamento_diretto(pag(jsonb_build_object('nota', repeat('n', 301))))$$), '22023 …');
select atteso('una nota di 300 caratteri sì', tenta($$select 'fatto' from registra_pagamento_diretto(pag(jsonb_build_object('nota', repeat('n', 300))))$$), 'fatto');
select atteso('i rifiuti non hanno scritto niente', (select count(*)::text from pagamenti_diretti), '4');

\echo ''
\echo '--- 3. non si cambia e non si cancella, nemmeno dalla segreteria ---'
select atteso('non lo cambia a mano', tenta($$update pagamenti_diretti set importo = 1$$), 'NEGATO: …');
select atteso('non lo cancella', tenta($$delete from pagamenti_diretti$$), 'NEGATO: …');
select atteso('non lo scrive a mano',
  tenta($$insert into pagamenti_diretti (persona_id, data, importo, metodo, voce) values ('aaaaaaaa-0000-0000-0000-000000000010', '2026-09-10', 100, 'Contanti', 'Quota')$$), 'NEGATO: …');

\echo ''
\echo '--- 4. annullare ---'
select atteso('lo annulla', tenta($$select annulla_pagamento_diretto((select id from pagamenti_diretti where importo = 1250))::text$$), '');
select atteso('annullato resta, con chi e quando', (select count(*)::text from pagamenti_diretti d join persone p on p.id = d.annullato_da
  where d.importo = 1250 and d.annullato_il is not null and p.nome = 'Anna'), '1');
select atteso('due volte no', rifiuto($$select annulla_pagamento_diretto((select id from pagamenti_diretti where importo = 1250))$$), 'P0002 Pagamento inesistente o già annullato');
select atteso('uno che non c''è no', rifiuto($$select annulla_pagamento_diretto(gen_random_uuid())$$), 'P0002 Pagamento inesistente o già annullato');
select atteso('gli altri non si sono mossi', (select count(*)::text from pagamenti_diretti where annullato_il is null), '3');
reset role;

\echo ''
\echo '--- 5. disattivare la persona non tocca i pagamenti ---'
update persone set attiva = false where id = 'aaaaaaaa-0000-0000-0000-000000000010';
select atteso('i pagamenti ci sono tutti', (select count(*)::text from pagamenti_diretti where persona_id = 'aaaaaaaa-0000-0000-0000-000000000010'), '4');
select atteso('e quelli annullati restano annullati', (select count(*)::text from pagamenti_diretti where annullato_il is not null), '1');
update persone set attiva = true where id = 'aaaaaaaa-0000-0000-0000-000000000010';

\echo ''
\echo '--- 6. un istruttore: non vede e non fa ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('non li vede', (select count(*)::text from pagamenti_diretti), '0');
select atteso('non ne registra', codice($$select registra_pagamento_diretto(pag())$$), '42501');
select atteso('non ne annulla', codice($$select annulla_pagamento_diretto((select id from pagamenti_diretti limit 1))$$), '42501');
select atteso('non ne annulla nemmeno uno vero', codice($$select annulla_pagamento_diretto(gen_random_uuid())$$), '42501');
select atteso('non scrive a mano',
  tenta($$insert into pagamenti_diretti (persona_id, data, importo, metodo, voce) values ('aaaaaaaa-0000-0000-0000-000000000010', '2026-09-10', 100, 'Contanti', 'Quota')$$), 'NEGATO: …');
select atteso('non cambia', tenta($$update pagamenti_diretti set importo = 1$$), 'NEGATO: …');
select atteso('non cancella', tenta($$delete from pagamenti_diretti$$), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 7. un iscritto: come l''istruttore ---'
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('non li vede', (select count(*)::text from pagamenti_diretti), '0');
select atteso('non ne registra', codice($$select registra_pagamento_diretto(pag())$$), '42501');
select atteso('non ne annulla', codice($$select annulla_pagamento_diretto(gen_random_uuid())$$), '42501');
select atteso('non scrive a mano',
  tenta($$insert into pagamenti_diretti (persona_id, data, importo, metodo, voce) values ('aaaaaaaa-0000-0000-0000-000000000003', '2026-09-10', 100, 'Contanti', 'Quota')$$), 'NEGATO: …');
select atteso('non cambia', tenta($$update pagamenti_diretti set importo = 1$$), 'NEGATO: …');
select atteso('non cancella', tenta($$delete from pagamenti_diretti$$), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 8. chi non ha fatto l''accesso ---'
select chi('');
set role anon;
select atteso('non li vede', tenta($$select count(*)::text from pagamenti_diretti$$), 'NEGATO: …');
select atteso('non ne registra', codice($$select registra_pagamento_diretto(pag())$$), '42501');
select atteso('non ne annulla', codice($$select annulla_pagamento_diretto(gen_random_uuid())$$), '42501');
select atteso('non scrive a mano',
  tenta($$insert into pagamenti_diretti (persona_id, data, importo, metodo, voce) values ('aaaaaaaa-0000-0000-0000-000000000010', '2026-09-10', 100, 'Contanti', 'Quota')$$), 'NEGATO: …');
select atteso('non cambia', tenta($$update pagamenti_diretti set importo = 1$$), 'NEGATO: …');
select atteso('non cancella', tenta($$delete from pagamenti_diretti$$), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 9. unire due schede: i pagamenti di chi se ne va passano a chi resta ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select registra_pagamento_diretto(pag('{"persona_id": "aaaaaaaa-0000-0000-0000-000000000011", "importo": 7000, "voce": "Annuale Lotta"}'));
select registra_pagamento_diretto(pag('{"persona_id": "aaaaaaaa-0000-0000-0000-000000000011", "importo": 300, "voce": "Sbagliato"}'));
select annulla_pagamento_diretto((select id from pagamenti_diretti where importo = 300));
select atteso('prima: due sono del doppione', (select count(*)::text from pagamenti_diretti where persona_id = 'aaaaaaaa-0000-0000-0000-000000000011'), '2');
select atteso('unite', tenta($$select 'fatto' from unisci_persone('aaaaaaaa-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000011')$$), 'fatto');
select atteso('il doppione non ha più pagamenti', (select count(*)::text from pagamenti_diretti where persona_id = 'aaaaaaaa-0000-0000-0000-000000000011'), '0');
select atteso('sono tutti di chi resta, nessuno perso', (select count(*)::text from pagamenti_diretti where persona_id = 'aaaaaaaa-0000-0000-0000-000000000010'), '6');
select atteso('quello del doppione è suo, con l''importo', (select importo::text from pagamenti_diretti where voce = 'Annuale Lotta' and persona_id = 'aaaaaaaa-0000-0000-0000-000000000010'), '7000');
select atteso('e l''annullato resta annullato', (select count(*)::text from pagamenti_diretti where importo = 300 and annullato_il is not null and persona_id = 'aaaaaaaa-0000-0000-0000-000000000010'), '1');
reset role;

\echo ''
\echo '--- 10. metodo e voce sono testo, la data sta in un periodo vero ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('un metodo che è un oggetto no', codice($$select registra_pagamento_diretto(pag('{"metodo": {"a": 1}}'))$$), '22023');
select atteso('una voce che è una lista no', codice($$select registra_pagamento_diretto(pag('{"voce": ["x"]}'))$$), '22023');
select atteso('una data dell''anno 9999 no', codice($$select registra_pagamento_diretto(pag('{"data": "9999-12-31"}'))$$), '22023');
select atteso('una data dell''anno 1 no', codice($$select registra_pagamento_diretto(pag('{"data": "0001-01-01"}'))$$), '22023');
select atteso('il primo giorno del 2000 va', (registra_pagamento_diretto(pag('{"data": "2000-01-01", "importo": 100}')))->>'data', '2000-01-01');
reset role;

\echo ''
\echo '--- 11. la persona che ha pagamenti non si cancella: si disattiva o si unisce ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('cancellarla è negato', codice($$delete from persone where id = 'aaaaaaaa-0000-0000-0000-000000000010'$$), '23503');
select atteso('i suoi pagamenti sono ancora lì', (select count(*)::text from pagamenti_diretti where persona_id = 'aaaaaaaa-0000-0000-0000-000000000010'), '7');
reset role;

\echo ''
\echo '--- 12. il tablet (un utente senza scheda) non vede e non fa ---'
select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('non vede niente', (select count(*)::text from pagamenti_diretti), '0');
select atteso('non ne registra', codice($$select registra_pagamento_diretto(pag())$$), '42501');
select atteso('non ne annulla', codice($$select annulla_pagamento_diretto(gen_random_uuid())$$), '42501');
reset role;

\echo ''
\echo '--- 13. il database da solo: i limiti della tabella, i permessi, il testo pulito, chi scrive non porta via i pagamenti ---'
-- Come superutente: la tabella dice no anche a chi salta le funzioni (23514 = un limite violato).
insert into persone (id, nome, cognome, ruolo) values ('aaaaaaaa-0000-0000-0000-000000000021', 'Paola', 'Prova', 'iscritto');
select atteso('importo zero: lo dice anche la tabella', codice($$insert into pagamenti_diretti (persona_id, data, importo, metodo, voce) values ('aaaaaaaa-0000-0000-0000-000000000021', '2026-09-10', 0, 'Contanti', 'Quota')$$), '23514');
select atteso('importo oltre 10.000.000: anche la tabella', codice($$insert into pagamenti_diretti (persona_id, data, importo, metodo, voce) values ('aaaaaaaa-0000-0000-0000-000000000021', '2026-09-10', 10000001, 'Contanti', 'Quota')$$), '23514');
select atteso('data del 1999: anche la tabella', codice($$insert into pagamenti_diretti (persona_id, data, importo, metodo, voce) values ('aaaaaaaa-0000-0000-0000-000000000021', '1999-12-31', 100, 'Contanti', 'Quota')$$), '23514');
select atteso('metodo di soli spazi: anche la tabella', codice($$insert into pagamenti_diretti (persona_id, data, importo, metodo, voce) values ('aaaaaaaa-0000-0000-0000-000000000021', '2026-09-10', 100, '  ', 'Quota')$$), '23514');
select atteso('metodo di 41: anche la tabella', codice($$insert into pagamenti_diretti (persona_id, data, importo, metodo, voce) values ('aaaaaaaa-0000-0000-0000-000000000021', '2026-09-10', 100, repeat('m', 41), 'Quota')$$), '23514');
select atteso('voce di soli spazi: anche la tabella', codice($$insert into pagamenti_diretti (persona_id, data, importo, metodo, voce) values ('aaaaaaaa-0000-0000-0000-000000000021', '2026-09-10', 100, 'Contanti', ' ')$$), '23514');
select atteso('nota di 301: anche la tabella', codice($$insert into pagamenti_diretti (persona_id, data, importo, metodo, voce, nota) values ('aaaaaaaa-0000-0000-0000-000000000021', '2026-09-10', 100, 'Contanti', 'Quota', repeat('n', 301))$$), '23514');
-- I permessi come sono scritti, non solo come rispondono: la funzione dice no a chi non è segreteria, ma l'anon non deve nemmeno poterla chiamare.
select atteso('anon non esegue registra', has_function_privilege('anon', 'registra_pagamento_diretto(jsonb)', 'execute')::text, 'false');
select atteso('anon non esegue annulla', has_function_privilege('anon', 'annulla_pagamento_diretto(uuid)', 'execute')::text, 'false');
select atteso('authenticated esegue registra e annulla', (has_function_privilege('authenticated', 'registra_pagamento_diretto(jsonb)', 'execute') and has_function_privilege('authenticated', 'annulla_pagamento_diretto(uuid)', 'execute'))::text, 'true');
select atteso('anon non legge la tabella', has_table_privilege('anon', 'pagamenti_diretti', 'select')::text, 'false');
select atteso('authenticated la legge e basta', (has_table_privilege('authenticated', 'pagamenti_diretti', 'select') and not has_table_privilege('authenticated', 'pagamenti_diretti', 'insert')
  and not has_table_privilege('authenticated', 'pagamenti_diretti', 'update') and not has_table_privilege('authenticated', 'pagamenti_diretti', 'delete'))::text, 'true');
-- Un pagamento a mano è storia contabile anche quando se ne va chi l'ha scritto.
insert into auth.users (id, email) values ('55555555-5555-5555-5555-555555555555', 'temp@ods.it');
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000020', 'Temp', 'Segreteria', 'staff', 'temp@ods.it', '55555555-5555-5555-5555-555555555555');
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('limite dell''importo: 10.000.001 no', rifiuto($$select registra_pagamento_diretto(pag('{"persona_id": "aaaaaaaa-0000-0000-0000-000000000021", "importo": 10000001}'))$$), '22023 L’importo è troppo alto: controlla le cifre');
select atteso('limite dell''importo: 10.000.000 va', (registra_pagamento_diretto(pag('{"persona_id": "aaaaaaaa-0000-0000-0000-000000000021", "importo": 10000000, "metodo": "  POS  ", "voce": "  Quota  ", "nota": "   "}')))->>'importo', '10000000');
select registra_pagamento_diretto(pag('{"persona_id": "aaaaaaaa-0000-0000-0000-000000000021", "importo": 222}'));
select annulla_pagamento_diretto((select id from pagamenti_diretti where importo = 222));
reset role;
select atteso('metodo e voce salvati senza spazi, la nota di soli spazi è vuota',
  (select metodo || '|' || voce || '|' || coalesce(nota, 'NULL') from pagamenti_diretti where importo = 10000000), 'POS|Quota|NULL');
delete from persone where id = 'aaaaaaaa-0000-0000-0000-000000000020';
select atteso('chi ha scritto se ne va: i pagamenti restano, senza il suo nome',
  (select count(*)::text || ' ' || count(*) filter (where creato_da is null) || ' ' || count(*) filter (where annullato_da is null and annullato_il is not null)
   from pagamenti_diretti where persona_id = 'aaaaaaaa-0000-0000-0000-000000000021'), '2 2 1');

\echo ''
\echo 'TUTTO A POSTO'
