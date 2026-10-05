-- «Aggiungi chi prova» cerca fra tutte le persone (43-cerca-persone.sql):
-- anche chi è iscritto a un altro corso e chi non ha mai provato; solo
-- iscritti attivi, mai personale; dalla terza lettera di una parola, al
-- massimo ventuno righe; senza telefono per nessuno; solo al personale.
-- Si lancia dopo tablet.sql, di cui usa Anna (segreteria), Maura (istruttore),
-- le due Giulie e Tommaso iscritti a Lotta 2, Pietro Estraneo senza corsi, il
-- Judo 2 e il tablet della Lotta.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';
reset role;

-- Una seconda iscrizione per Giulia Ferrari (il Judo) e una già finita per
-- Tommaso: i corsi che si dicono sono quelli di oggi. Pietro ha un telefono,
-- che non deve uscire. Dora è disattivata; Ilaria è un'iscritta con un account.
delete from tentativi_pin;
insert into iscrizioni (corso_id, persona_id, dal) values
  ('cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000003', current_date - 30);
insert into iscrizioni (corso_id, persona_id, dal, al) values
  ('cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000005', current_date - 90, current_date - 1);
update persone set telefono = '333 7654321' where id = 'aaaaaaaa-0000-0000-0000-000000000007';
insert into persone (id, nome, cognome, ruolo, attiva) values
  ('ffffffff-0000-0000-0000-000000000092', 'Dora', 'Spenta', 'iscritto', false);
insert into auth.users (id, email) values ('77777777-7777-7777-7777-777777777777', 'ilaria@ods.it');
insert into persone (id, nome, cognome, ruolo, utente_id) values
  ('ffffffff-0000-0000-0000-000000000093', 'Ilaria', 'Utente', 'iscritto', '77777777-7777-7777-7777-777777777777');

\echo ''
\echo '--- 1. l''istruttore cerca ---'
select chi('22222222-2222-2222-2222-222222222222');  -- Maura
set role authenticated;
select atteso('«ferr» trova Giulia Ferrari, con i corsi di oggi',
  (select string_agg(nome || ' ' || cognome || ' [' || array_to_string(corsi, ', ') || ']', '; ') from cerca_persone('ferr')), 'Giulia Ferrari [Judo 2, Lotta 2]');
select atteso('chi non ha mai provato né ha un corso si trova lo stesso',
  (select string_agg(nome || ' ' || cognome || ' [' || array_to_string(corsi, ', ') || ']', '; ') from cerca_persone('estra')), 'Pietro Estraneo []');
select atteso('l''iscrizione finita ieri non si dice',
  (select string_agg(array_to_string(corsi, ', '), '; ') from cerca_persone('tommaso')), 'Lotta 2');
select atteso('due omonimi, in ordine di cognome',
  (select string_agg(cognome, ', ') from cerca_persone('giulia')), 'Ferrari, Fontana');
select atteso('cognome e nome, al contrario', (select string_agg(nome, ' ') from cerca_persone('ferrari giulia')), 'Giulia');
select atteso('maiuscole e accenti non contano', (select string_agg(cognome, ' ') from cerca_persone('FERRÀRI')), 'Ferrari');
select atteso('«de luca» e «deluca»', (select count(*)::text from cerca_persone('de luca')) || ' ' || (select count(*)::text from cerca_persone('deluca')), '1 1');
select atteso('il telefono non è nella risposta',
  (select (position('7654321' in string_agg(row_to_json(c)::text, '')) > 0)::text from cerca_persone('estra') c), 'false');
select atteso('né nelle colonne', pg_get_function_result('cerca_persone(text)'::regprocedure),
  'TABLE(persona_id uuid, nome text, cognome text, corsi text[])');

\echo ''
\echo '--- 2. chi non compare, e la soglia ---'
select atteso('«gi» è troppo poco', (select count(*)::text from cerca_persone('gi')), '0');
select atteso('«gi fo» anche: nessuna parola di tre lettere', (select count(*)::text from cerca_persone('gi fo')), '0');
select atteso('apostrofi e trattini non fanno lettere', (select count(*)::text from cerca_persone('g-i-''')), '0');
select atteso('niente scritto: nessuno', (select count(*)::text from cerca_persone('')), '0');
select atteso('null: nessuno e nessun errore', (select count(*)::text from cerca_persone(null)), '0');
select atteso('la segreteria (Anna) non è una persona da aggiungere', (select count(*)::text from cerca_persone('segreteria')), '0');
select atteso('un istruttore nemmeno', (select count(*)::text from cerca_persone('maura')), '0');
select atteso('chi è disattivato non compare', (select count(*)::text from cerca_persone('spenta')), '0');
select atteso('un testo di oltre cento lettere non cerca', (select count(*)::text from cerca_persone(repeat('a', 101))), '0');
select atteso('una parola corta accanto a una di tre lettere restringe', (select count(*)::text from cerca_persone('ferr g')), '1');
select atteso('lettere a larghezza piena e uno spazio invisibile non fanno una parola', (select count(*)::text from cerca_persone('ＦＥＲＲ')) || (select count(*)::text from cerca_persone('f' || chr(8203) || 'e' || chr(8203) || 'r')), '00');
select atteso('% e _ non sono jolly', (select count(*)::text from cerca_persone('%%%')) || (select count(*)::text from cerca_persone('___')), '00');
reset role;

\echo ''
\echo '--- 3. al massimo ventuno, perché l''app dica «ce ne sono altri» ---'
insert into persone (nome, cognome, ruolo) select 'Provante', 'Numero' || lpad(g::text, 3, '0'), 'iscritto' from generate_series(1, 30) g;
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('trenta persone che somigliano: ne arrivano 21', (select count(*)::text from cerca_persone('provante')), '21');
select atteso('le prime in ordine di cognome', (select min(cognome) || ' ' || max(cognome) from cerca_persone('provante')), 'Numero001 Numero021');
reset role;

\echo ''
\echo '--- 4. la segreteria ---'
select chi('11111111-1111-1111-1111-111111111111');  -- Anna
set role authenticated;
select atteso('la segreteria cerca, e nemmeno lei ha il telefono',
  (select (count(*) = 1 and position('7654321' in string_agg(row_to_json(c)::text, '')) = 0)::text from cerca_persone('estra') c), 'true');
reset role;

\echo ''
\echo '--- 5. chi non fa l''appello no ---'
select chi('66666666-6666-6666-6666-666666666666');  -- il tablet della Lotta
set role authenticated;
select atteso('il tablet no', tenta($$select count(*)::text from cerca_persone('ferr')$$), 'NEGATO: la ricerca è di chi fa l''appello');
reset role;
select chi('77777777-7777-7777-7777-777777777777');  -- Ilaria, iscritta
set role authenticated;
select atteso('un''iscritta no', tenta($$select count(*)::text from cerca_persone('ferr')$$), 'NEGATO: la ricerca è di chi fa l''appello');
reset role;
select chi('');
set role anon;
select atteso('senza accesso no', tenta($$select count(*)::text from cerca_persone('ferr')$$), 'NEGATO: permission denied for function cerca_persone');
reset role;

\echo ''
\echo 'TUTTO A POSTO'
