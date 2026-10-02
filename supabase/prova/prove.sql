-- Le prove (21-prove.sql): chi viene a provare entra nell'appello di una
-- lezione, presente, aggiunto dall'istruttore dall'app o dal tablet col PIN;
-- si ritrova per nome per un'altra lezione; e si toglie se è un errore.
-- Si lancia dopo tablet.sql, di cui usa persone, sale, tablet e lezioni, e
-- dopo i file dello schema fino a 21-prove.sql.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';
reset role;

-- tablet.sql lascia la Lotta bloccata da cinque PIN sbagliati: si riparte.
delete from tentativi_pin;
-- Le lezioni che usa qui: quella di Lotta 2 in corso (06), quella di ieri
-- (02), il Judo 2 nel Tatami (05). tablet.sql annulla quella di domani (04).

\echo ''
\echo '--- 1. l''istruttore aggiunge una prova dall''app ---'
select chi('22222222-2222-2222-2222-222222222222');  -- Maura
set role authenticated;
select atteso('una persona nuova', (select aggiungi_prova('eeeeeeee-0000-0000-0000-000000000006', 'ffffffff-0000-0000-0000-000000000001',
  '  Marco ', 'Nuovo', '333 1234567')::text), 'ffffffff-0000-0000-0000-000000000001');
select atteso('rimandata dalla coda: niente doppioni', (select aggiungi_prova('eeeeeeee-0000-0000-0000-000000000006', 'ffffffff-0000-0000-0000-000000000001',
  'Marco', 'Nuovo', '333 1234567')::text), 'ffffffff-0000-0000-0000-000000000001');
select atteso('la vede nell''elenco delle prove', (select count(*)::text from prove where sessione_id = 'eeeeeeee-0000-0000-0000-000000000006'), '1');
select atteso('e fra chi ha già provato, col telefono', (select nome || ' ' || cognome || ' ' || telefono || ' ' || corso from prove_recenti()), 'Marco Nuovo 333 1234567 Lotta 2');
select atteso('senza nome no', tenta($$select aggiungi_prova('eeeeeeee-0000-0000-0000-000000000006', gen_random_uuid(), ' ', 'Vuoto')$$), 'NEGATO: servono nome e cognome');
select atteso('un telefono che non è un numero no', tenta($$select aggiungi_prova('eeeeeeee-0000-0000-0000-000000000006', gen_random_uuid(), 'Ugo', 'Strano', 'chiamami')$$), 'NEGATO: il telefono non sembra un numero');
select atteso('chi è già iscritto è già nell''appello', tenta($$select aggiungi_prova('eeeeeeee-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000003')$$), 'NEGATO: è già iscritto a questo corso: è nell''appello');
select atteso('un istruttore non è una prova', tenta($$select aggiungi_prova('eeeeeeee-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000006')$$), 'NEGATO: una prova è per chi viene ad allenarsi');
select atteso('non a una lezione annullata', tenta($$select aggiungi_prova('eeeeeeee-0000-0000-0000-000000000004', gen_random_uuid(), 'Ugo', 'Tardi')$$), 'NEGATO: lezione annullata');
select atteso('la tabella non si scrive a mano', tenta($$insert into prove (sessione_id, persona_id) values ('eeeeeeee-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000007')$$), 'NEGATO: …');
-- Un tocco dopo: assente. La prova resta, col suo segno.
select atteso('si tocca come gli altri', tenta($$update presenze set stato = 'assente' where sessione_id = 'eeeeeeee-0000-0000-0000-000000000006' and persona_id = 'ffffffff-0000-0000-0000-000000000001'$$), 'FATTO (1 righe)');
reset role;
select atteso('persona nuova, iscritta di ruolo, attiva', (select ruolo || ' ' || attiva || ' ' || nome || '|' || telefono from persone where id = 'ffffffff-0000-0000-0000-000000000001'), 'iscritto true Marco|333 1234567');
select atteso('presente, segnata da Maura', (select p.stato || ' ' || pe.nome from presenze p join persone pe on pe.id = p.segnata_da
  where p.sessione_id = 'eeeeeeee-0000-0000-0000-000000000006' and p.persona_id = 'ffffffff-0000-0000-0000-000000000001'), 'assente Maura');
select atteso('aggiunta da Maura, persona nuova', (select pe.nome || ' ' || pr.nuova from prove pr join persone pe on pe.id = pr.aggiunta_da), 'Maura true');

\echo ''
\echo '--- 2. il giorno dopo, un altro corso: si ritrova per nome ---'
-- Federico non insegna il Judo 2: le prove, come le presenze, le aggiunge chiunque faccia l'appello.
select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('Federico la aggiunge al Judo', (select aggiungi_prova('eeeeeeee-0000-0000-0000-000000000005', 'ffffffff-0000-0000-0000-000000000001')::text), 'ffffffff-0000-0000-0000-000000000001');
select atteso('fra chi ha provato c''è una volta sola, con l''ultima lezione', (select count(*) || ' ' || max(corso) from prove_recenti()), '1 Judo 2');
reset role;
select atteso('una persona sola', (select count(*)::text from persone where nome = 'Marco' and cognome = 'Nuovo'), '1');
select atteso('qui non è nuova', (select nuova::text from prove where sessione_id = 'eeeeeeee-0000-0000-0000-000000000005'), 'false');

\echo ''
\echo '--- 3. chi non fa l''appello ---'
reset role;
insert into auth.users (id, email) values ('77777777-7777-7777-7777-777777777777', 'giulia@casa.it');
update persone set utente_id = '77777777-7777-7777-7777-777777777777' where id = 'aaaaaaaa-0000-0000-0000-000000000003';
select chi('77777777-7777-7777-7777-777777777777');
set role authenticated;
select atteso('un iscritto non aggiunge prove', tenta($$select aggiungi_prova('eeeeeeee-0000-0000-0000-000000000006', gen_random_uuid(), 'Ugo', 'Amico')$$), 'NEGATO: le prove le aggiunge chi fa l''appello');
select atteso('e non le legge', tenta($$select count(*)::text from prove$$), '0');
select atteso('né chi ha provato', tenta($$select count(*)::text from prove_recenti()$$), 'NEGATO: le prove le vede chi fa l''appello');
select atteso('né le toglie', tenta($$select togli_prova('eeeeeeee-0000-0000-0000-000000000006', 'ffffffff-0000-0000-0000-000000000001')$$), 'NEGATO: le prove le toglie chi fa l''appello');
reset role;
select chi('');
set role anon;
select atteso('senza accesso', tenta($$select aggiungi_prova('eeeeeeee-0000-0000-0000-000000000006', gen_random_uuid(), 'Ugo', 'Anonimo')$$), 'NEGATO: permission denied for function aggiungi_prova');
select atteso('le funzioni di dentro no', tenta($$select metti_prova('eeeeeeee-0000-0000-0000-000000000006', gen_random_uuid(), 'Ugo', 'Dentro', null, null, null)$$), 'NEGATO: permission denied for function metti_prova');
reset role;

\echo ''
\echo '--- 4. dal tablet, col PIN ---'
select chi('66666666-6666-6666-6666-666666666666');  -- il tablet della Lotta
set role authenticated;
select atteso('il tablet non legge la tabella', tenta($$select count(*)::text from prove$$), '0');
select atteso('PIN sbagliato: nessuno', (select count(*)::text from provati_con_pin('0000')), '0');
select atteso('chi ha provato, senza telefono', (select nome || ' ' || coalesce(telefono, '-') from provati_con_pin('4321')), 'Marco -');
select atteso('le prove della lezione', (select cognome || ' ' || stato || ' ' || origine from prove_con_pin('4321', 'eeeeeeee-0000-0000-0000-000000000006')), 'Nuovo assente appello');
select atteso('PIN sbagliato: niente prove', (select count(*)::text from prove_con_pin('0000', 'eeeeeeee-0000-0000-0000-000000000006')), '0');
select atteso('Maura la segna presente', (select segna_prova_con_pin('4321', 'eeeeeeee-0000-0000-0000-000000000006', 'ffffffff-0000-0000-0000-000000000001', 'presente')::text), 'true');
select atteso('un iscritto non passa da qui', tenta($$select segna_prova_con_pin('4321', 'eeeeeeee-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000004', 'presente')::text$$), 'NEGATO: non è fra le prove di questa lezione');
select atteso('una prova nuova dal tablet', (select aggiungi_prova_con_pin('4321', 'eeeeeeee-0000-0000-0000-000000000006', 'ffffffff-0000-0000-0000-000000000002', 'Sara', 'Dalla Sala', null)::text), 'true');
select atteso('PIN sbagliato: non aggiunge', (select aggiungi_prova_con_pin('0000', 'eeeeeeee-0000-0000-0000-000000000006', gen_random_uuid(), 'Ugo', 'Pin', null)::text), 'false');
select atteso('non nella lezione di un''altra sala', tenta($$select aggiungi_prova_con_pin('4321', 'eeeeeeee-0000-0000-0000-000000000005', gen_random_uuid(), 'Ugo', 'Judo', null)::text$$), 'NEGATO: lezione di un''altra sala');
select atteso('ora sono due', (select string_agg(cognome || ':' || stato, ' ') from prove_con_pin('4321', 'eeeeeeee-0000-0000-0000-000000000006')), 'Dalla Sala:presente Nuovo:presente');
select atteso('l''elenco da toccare resta degli iscritti', (select count(*)::text from elenco_sala('eeeeeeee-0000-0000-0000-000000000006')), '3');
reset role;
select atteso('aggiunta da Maura, dal tablet della Lotta', (select pe.nome || ' ' || pr.postazione_id from prove pr join persone pe on pe.id = pr.aggiunta_da
  where pr.persona_id = 'ffffffff-0000-0000-0000-000000000002'), 'Maura dddddddd-0000-0000-0000-000000000001');
select atteso('segnata da Maura, dal tablet', (select pe.nome || ' ' || p.origine || ' ' || p.postazione_id from presenze p join persone pe on pe.id = p.segnata_da
  where p.persona_id = 'ffffffff-0000-0000-0000-000000000002'), 'Maura appello dddddddd-0000-0000-0000-000000000001');

\echo ''
\echo '--- 5. togliere una prova messa per sbaglio ---'
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('dal tablet', (select togli_prova_con_pin('4321', 'eeeeeeee-0000-0000-0000-000000000006', 'ffffffff-0000-0000-0000-000000000002')::text), 'true');
reset role;
select atteso('la persona nata con la prova se ne va', (select count(*)::text from persone where id = 'ffffffff-0000-0000-0000-000000000002'), '0');
select atteso('e il suo segno', (select count(*)::text from presenze where persona_id = 'ffffffff-0000-0000-0000-000000000002'), '0');
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('Maura toglie Marco dalla Lotta', tenta($$select togli_prova('eeeeeeee-0000-0000-0000-000000000006', 'ffffffff-0000-0000-0000-000000000001')$$), '');
select atteso('due volte non fa niente', tenta($$select togli_prova('eeeeeeee-0000-0000-0000-000000000006', 'ffffffff-0000-0000-0000-000000000001')$$), '');
reset role;
select atteso('Marco resta: ha provato anche il Judo', (select count(*)::text from persone where id = 'ffffffff-0000-0000-0000-000000000001'), '1');
select atteso('il segno della Lotta no', (select count(*)::text from presenze where persona_id = 'ffffffff-0000-0000-0000-000000000001' and sessione_id = 'eeeeeeee-0000-0000-0000-000000000006'), '0');
select atteso('quello del Judo sì', (select stato::text from presenze where persona_id = 'ffffffff-0000-0000-0000-000000000001' and sessione_id = 'eeeeeeee-0000-0000-0000-000000000005'), 'presente');
-- Si iscrive alla Lotta: una prova fatta prima di iscriversi, tolta dopo, non gli porta via il segno da iscritto.
insert into iscrizioni (corso_id, persona_id, dal) values ('cccccccc-0000-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000001', current_date - 2);
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('ora è iscritto: non è più una prova', tenta($$select aggiungi_prova('eeeeeeee-0000-0000-0000-000000000002', 'ffffffff-0000-0000-0000-000000000001')$$), 'NEGATO: è già iscritto a questo corso: è nell''appello');
reset role;
-- La prova di ieri c'era già da prima: la si toglie, e il segno da iscritto resta.
insert into prove (sessione_id, persona_id) values ('eeeeeeee-0000-0000-0000-000000000002', 'ffffffff-0000-0000-0000-000000000001');
insert into presenze (sessione_id, persona_id, stato) values ('eeeeeeee-0000-0000-0000-000000000002', 'ffffffff-0000-0000-0000-000000000001', 'presente');
select togli_prova_da('eeeeeeee-0000-0000-0000-000000000002', 'ffffffff-0000-0000-0000-000000000001');
select atteso('il segno da iscritto resta', (select stato::text from presenze where persona_id = 'ffffffff-0000-0000-0000-000000000001' and sessione_id = 'eeeeeeee-0000-0000-0000-000000000002'), 'presente');

\echo ''
\echo 'Le prove: tutto come previsto.'
