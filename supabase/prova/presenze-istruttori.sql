-- La presenza degli istruttori dal PIN del tablet (15-presenze-istruttori.sql):
-- chi era previsto si segna da sé, chi non lo era va da confermare, e la
-- conferma la dà solo la segreteria.
-- Si lancia dopo tablet.sql, di cui usa persone, sale, tablet e lezioni, e
-- dopo i file dello schema fino a 15-presenze-istruttori.sql.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';
reset role;

-- tablet.sql lascia la Lotta bloccata da cinque PIN sbagliati: si riparte.
delete from tentativi_pin;
select imposta_pin('aaaaaaaa-0000-0000-0000-000000000006', '8765');  -- Federico
select imposta_pin('aaaaaaaa-0000-0000-0000-000000000001', '1357');  -- Anna, la segreteria
-- In tablet.sql Federico annulla la lezione di domani: qui non serve, e la
-- lezione del Judo resta com'era.
update sessioni set stato = 'prevista' where id = 'eeeeeeee-0000-0000-0000-000000000005';

\echo ''
\echo '--- 1. l''istruttore previsto: la presenza si segna da sola ---'
-- In Lotta sono aperte due lezioni di Lotta 2: quella in corso e quella che
-- comincia fra cinque minuti. Maura le insegna tutte e due.
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('Maura sul tablet della Lotta', (select string_agg(stato::text, ' ') from presenza_con_pin('4321')), 'confermata confermata');
select atteso('rimette il PIN a metà lezione', (select count(*)::text from presenza_con_pin('4321')), '2');
select atteso('PIN sbagliato: niente', (select count(*)::text from presenza_con_pin('0000')), '0');
select atteso('il tablet non legge le presenze degli istruttori', tenta($$select count(*)::text from presenze_istruttori$$), '0');
reset role;
select atteso('due righe, non quattro', (select count(*)::text from presenze_istruttori), '2');
select atteso('segnate dal tablet della Lotta', (select string_agg(distinct postazione_id::text, ' ') from presenze_istruttori), 'dddddddd-0000-0000-0000-000000000001');

\echo ''
\echo '--- 2. l''istruttore non previsto: da confermare ---'
-- Nel Tatami c'è il Judo 2, che non è di Maura.
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('Maura sul tablet del Tatami', (select corso || ' ' || stato from presenza_con_pin('4321')), 'Judo 2 da_confermare');
select atteso('la segreteria col suo PIN non si segna', (select count(*)::text from presenza_con_pin('1357')), '0');
reset role;
select atteso('e resta così', (select prevista::text || ' ' || stato from presenze_istruttori where sessione_id = 'eeeeeeee-0000-0000-0000-000000000005'), 'false da_confermare');
select atteso('di Anna nessuna riga', (select count(*)::text from presenze_istruttori where persona_id = 'aaaaaaaa-0000-0000-0000-000000000001'), '0');

\echo ''
\echo '--- 3. il sostituto ---'
reset role;
-- Federico sostituisce Maura nella lezione in corso.
update sessioni set istruttore_id = 'aaaaaaaa-0000-0000-0000-000000000006' where id = 'eeeeeeee-0000-0000-0000-000000000006';
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('Federico, sostituto in una e dei suoi nell''altra', (select string_agg(stato::text, ' ') from presenza_con_pin('8765')), 'confermata confermata');
select atteso('Maura ora è prevista solo nella prossima', (select count(*)::text from presenza_con_pin('4321')), '1');
reset role;
-- Federico entra nel Tatami, dove non è previsto; poi la segreteria lo mette sostituto del Judo.
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('Federico nel Tatami', (select stato::text from presenza_con_pin('8765')), 'da_confermare');
reset role;
update sessioni set istruttore_id = 'aaaaaaaa-0000-0000-0000-000000000006' where id = 'eeeeeeee-0000-0000-0000-000000000005';
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('messo sostituto, al PIN dopo è confermata', (select stato::text from presenza_con_pin('8765')), 'confermata');
reset role;

\echo ''
\echo '--- 4. chi vede e chi conferma ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('Maura vede le sue', tenta($$select count(*)::text from presenze_istruttori$$), '3');
select atteso('e non se le conferma', tenta($$select gestisci_presenza_istruttore(id, true)::text from presenze_istruttori where stato = 'da_confermare' limit 1$$), 'NEGATO: la presenza la conferma la segreteria');
select atteso('e non le scrive a mano', tenta($$update presenze_istruttori set stato = 'confermata'$$), 'NEGATO: permission denied…');
select atteso('un istruttore non è un tablet', tenta($$select count(*)::text from presenza_con_pin('4321')$$), 'NEGATO: solo un tablet di sala');
select atteso('la funzione interna', tenta($$select prevista_su('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002')::text$$), 'NEGATO: permission denied…');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria le vede tutte', tenta($$select count(*)::text from presenze_istruttori$$), '6');
select atteso('una da confermare', tenta($$select count(*)::text from presenze_istruttori where stato = 'da_confermare'$$), '1');
select atteso('la rifiuta', tenta($$select gestisci_presenza_istruttore(id, false)::text from presenze_istruttori where stato = 'da_confermare'$$), '');
select atteso('una che non c''è', tenta($$select gestisci_presenza_istruttore('00000000-0000-0000-0000-000000000000', true)::text$$), 'NEGATO: presenza inesistente');
reset role;
select atteso('rifiutata da Anna', (select stato || ' ' || p.nome from presenze_istruttori pi join persone p on p.id = pi.gestita_da where pi.sessione_id = 'eeeeeeee-0000-0000-0000-000000000005' and pi.persona_id = 'aaaaaaaa-0000-0000-0000-000000000002'), 'rifiutata Anna');
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('rimettendo il PIN resta rifiutata', (select stato::text from presenza_con_pin('4321')), 'rifiutata');
reset role;
select chi('');
set role anon;
select atteso('senza accesso', tenta($$select count(*)::text from presenza_con_pin('4321')$$), 'NEGATO: permission denied…');
reset role;

\echo ''
\echo 'TUTTO A POSTO'
