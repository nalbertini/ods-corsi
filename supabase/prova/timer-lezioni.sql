-- I timer di una singola lezione (11-timer-lezioni.sql), anche più d'uno: chi
-- li lega, chi li toglie, e chi vede un timer personale perché è legato a una lezione.
-- Si lancia dopo finto-supabase.sql, i file dello schema fino a
-- 11-timer-lezioni.sql e timer.sql, di cui usa persone, lezione e timer.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';
reset role;

-- Un timer personale di Federico, che nessun corso usa: senza la lezione,
-- la segreteria e il tablet non lo vedrebbero. Maura non c'è più: timer.sql
-- la cancella, per provare che lo storico resta.
-- E uno della palestra, per il secondo timer della stessa lezione.
insert into timer (id, persona_id, nome, schema) values
  ('f0000000-0000-0000-0000-000000000009', 'aaaaaaaa-0000-0000-0000-000000000006', 'Gara di giovedì', '{"mode":"emom"}'),
  ('f0000000-0000-0000-0000-00000000000a', null, 'Defaticamento', '{"mode":"interval"}')
  on conflict (id) do nothing;
delete from sessioni_timer;

\echo ''
\echo '--- 1. Federico, istruttore: lega il suo timer a una lezione sola ---'
select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('lega il suo timer alla lezione',
  tenta($$insert into sessioni_timer (sessione_id, timer_id) values ('eeeeeeee-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000009')$$), 'FATTO (1 righe)');
select atteso('il server scrive chi l''ha legato', (select p.nome from sessioni_timer s join persone p on p.id = s.collegato_da), 'Federico');
select atteso('non lega un timer che non vede',
  tenta($$insert into sessioni_timer (sessione_id, timer_id) values ('eeeeeeee-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-00000000dead')$$), 'NEGATO: …');

select atteso('ne lega un secondo alla stessa lezione',
  tenta($$insert into sessioni_timer (sessione_id, timer_id) values ('eeeeeeee-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-00000000000a')$$), 'FATTO (1 righe)');
select atteso('la lezione ha due timer', (select count(*)::text from sessioni_timer where sessione_id = 'eeeeeeee-0000-0000-0000-000000000001'), '2');
select atteso('ne toglie uno solo',
  tenta($$delete from sessioni_timer where sessione_id = 'eeeeeeee-0000-0000-0000-000000000001' and timer_id = 'f0000000-0000-0000-0000-00000000000a'$$), 'FATTO (1 righe)');
select atteso('e l''altro resta', (select timer_id::text from sessioni_timer), 'f0000000-0000-0000-0000-000000000009');

\echo ''
\echo '--- 2. Anna, segreteria: vede il timer di un istruttore, perché è legato alla lezione ---'
select chi('11111111-1111-1111-1111-111111111111');
select atteso('vede il timer di Federico legato alla lezione', (select nome from timer where id = 'f0000000-0000-0000-0000-000000000009'), 'Gara di giovedì');
select atteso('ma non lo cambia',
  tenta($$update timer set nome = 'Mio' where id = 'f0000000-0000-0000-0000-000000000009'$$), 'a vuoto (0 righe)');

\echo ''
\echo '--- 3. Il tablet della sala: legge, non scrive ---'
select chi('66666666-6666-6666-6666-666666666666');
select atteso('sa quale timer aprire con la lezione', (select timer_id::text from sessioni_timer), 'f0000000-0000-0000-0000-000000000009');
select atteso('e lo vede', (select nome from timer where id = 'f0000000-0000-0000-0000-000000000009'), 'Gara di giovedì');
select atteso('non lo toglie', tenta($$delete from sessioni_timer$$), 'a vuoto (0 righe)');
select atteso('non ne lega uno',
  tenta($$insert into sessioni_timer (sessione_id, timer_id) values ('eeeeeeee-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000002')$$), 'NEGATO: …');

\echo ''
\echo '--- 4. Luca, iscritto: niente ---'
select chi('33333333-3333-3333-3333-333333333333');
select atteso('non lega timer',
  tenta($$insert into sessioni_timer (sessione_id, timer_id) values ('eeeeeeee-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000002')$$), 'NEGATO: …');
select atteso('non toglie quelli degli altri', tenta($$delete from sessioni_timer$$), 'a vuoto (0 righe)');

\echo ''
\echo '--- 5. Anna riporta la lezione ai timer del corso ---'
select chi('11111111-1111-1111-1111-111111111111');
select atteso('toglie il timer della lezione', tenta($$delete from sessioni_timer where sessione_id = 'eeeeeeee-0000-0000-0000-000000000001'$$), 'FATTO (1 righe)');
reset role;
insert into sessioni_timer (sessione_id, timer_id) values ('eeeeeeee-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000009');
select atteso('un timer cancellato si porta via i suoi collegamenti',
  tenta($$delete from timer where id = 'f0000000-0000-0000-0000-000000000009'$$), 'FATTO (1 righe)');
select atteso('e la lezione torna ai timer del corso', (select count(*)::text from sessioni_timer), '0');

\echo ''
\echo 'Tutto a posto.'
