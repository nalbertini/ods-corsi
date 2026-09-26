-- Il tablet di sala, provato dal suo punto di vista e da quello di chi gli sta
-- intorno. Si lancia dopo finto-supabase.sql e i quattro file dello schema.
-- Le lezioni sono messe attorno ad adesso, perché le finestre di tempo le
-- misura `now()`: niente date fisse che fra un mese non vorrebbero più dire niente.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'staff@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'maura@ods.it'),
  ('44444444-4444-4444-4444-444444444444', 'federico@ods.it'),
  ('55555555-5555-5555-5555-555555555555', 'tatami@ods.it'),
  ('66666666-6666-6666-6666-666666666666', 'lotta@ods.it');
insert into persone (id, nome, cognome, ruolo, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff',     '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Maura', 'Uno', 'istruttore',      '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000006', 'Federico', 'Due', 'istruttore',   '44444444-4444-4444-4444-444444444444'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Giulia', 'Ferrari', 'iscritto', null),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'Giulia', 'Fontana', 'iscritto', null),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'Tommaso', 'De Luca', 'iscritto', null),
  ('aaaaaaaa-0000-0000-0000-000000000007', 'Pietro', 'Estraneo', 'iscritto', null);
insert into sale (id, nome) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Lotta'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Tatami');
insert into postazioni (id, nome, sala_id, utente_id) values
  ('dddddddd-0000-0000-0000-000000000001', 'Tablet Lotta',  'bbbbbbbb-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666666'),
  ('dddddddd-0000-0000-0000-000000000002', 'Tablet Tatami', 'bbbbbbbb-0000-0000-0000-000000000002', '55555555-5555-5555-5555-555555555555');
insert into corsi (id, nome, sala_id, istruttore_id) values
  ('cccccccc-0000-0000-0000-000000000001', 'Lotta 2', 'bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002'),
  ('cccccccc-0000-0000-0000-000000000002', 'Judo 2',  'bbbbbbbb-0000-0000-0000-000000000002', null);
insert into corsi_istruttori (corso_id, persona_id) values
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002'),
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000006');
insert into iscrizioni (corso_id, persona_id, dal) values
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003', current_date - 60),
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000004', current_date - 60),
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000005', current_date - 60);
-- Una lezione che comincia fra 5 minuti, una di ieri, una di tre settimane fa,
-- una di domani, una del Judo, che è in un'altra sala, e una cominciata da
-- quaranta minuti, ancora in corso.
insert into sessioni (id, corso_id, inizio, fine) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', now() + interval '5 minutes', now() + interval '65 minutes'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000001', now() - interval '1 day',    now() - interval '23 hours'),
  ('eeeeeeee-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-000000000001', now() - interval '21 days',  now() - interval '21 days' + interval '1 hour'),
  ('eeeeeeee-0000-0000-0000-000000000004', 'cccccccc-0000-0000-0000-000000000001', now() + interval '1 day',    now() + interval '25 hours'),
  ('eeeeeeee-0000-0000-0000-000000000005', 'cccccccc-0000-0000-0000-000000000002', now() + interval '5 minutes', now() + interval '65 minutes'),
  ('eeeeeeee-0000-0000-0000-000000000006', 'cccccccc-0000-0000-0000-000000000001', now() - interval '40 minutes', now() + interval '20 minutes');
select imposta_pin('aaaaaaaa-0000-0000-0000-000000000002', '4321');

create or replace function chi(u text) returns void language plpgsql as $$
begin perform set_config('prova.utente', u, false); end $$;
create or replace function tenta(sql text) returns text language plpgsql as $$
declare n int; esito text;
begin
  -- `into` solo per le select: un update non restituisce niente da metterci.
  if sql ~* '^\s*select' then execute sql into esito; else execute sql; end if;
  get diagnostics n = row_count;
  return coalesce(esito, case when n = 0 then 'a vuoto (0 righe)' else 'FATTO (' || n || ' righe)' end);
exception when others then return 'NEGATO: ' || sqlerrm;
end $$;
-- Ogni riga controlla un'attesa: se non torna, la prova si ferma lì.
create or replace function atteso(cosa text, avuto text, voluto text) returns text language plpgsql as $$
begin
  if avuto is distinct from voluto and not (voluto like '%…' and avuto like replace(voluto, '…', '%')) then
    raise exception '% · atteso «%», avuto «%»', cosa, voluto, avuto;
  end if;
  return 'ok  ' || cosa || ' → ' || avuto;
end $$;

\echo ''
\echo '--- 1. il tablet della Lotta legge il calendario della sua sala ---'
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('lezioni della settimana', (select count(*)::text from lezioni_sala(current_date - 30, current_date + 1)), '5');
select atteso('istruttori di Lotta 2', (select istruttori from lezioni_sala(current_date, current_date + 1) limit 1), 'Federico, Maura');
select atteso('iscritti',              (select iscritti::text from lezioni_sala(current_date, current_date + 1) limit 1), '3');
select atteso('le persone',   tenta($$select count(*)::text from persone$$),   '0');
select atteso('le presenze',  tenta($$select count(*)::text from presenze$$),  '0');
select atteso('le iscrizioni',tenta($$select count(*)::text from iscrizioni$$),'0');
select atteso('i PIN',        tenta($$select count(*)::text from pin_istruttori$$), 'NEGATO: …');
select atteso('la sua postazione', tenta($$select nome from postazioni$$), 'Tablet Lotta');

\echo ''
\echo '--- 2. l''elenco da toccare: nome e sigla, mai il cognome ---'
select atteso('elenco', (select string_agg(nome || ' ' || sigla, ', ' order by nome, sigla) from elenco_sala('eeeeeeee-0000-0000-0000-000000000001')),
  'Giulia Fer., Giulia Fon., Tommaso D.');
select atteso('elenco di un''altra sala', tenta($$select count(*)::text from elenco_sala('eeeeeeee-0000-0000-0000-000000000005')$$), 'NEGATO: lezione di un''altra sala');
select atteso('elenco di tre settimane fa', tenta($$select count(*)::text from elenco_sala('eeeeeeee-0000-0000-0000-000000000003')$$), 'NEGATO: lezione fuori dalla finestra del tablet');

\echo ''
\echo '--- 3. il tocco ---'
select atteso('Giulia F. si segna', segna_dal_tablet('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003'), 'segnata');
select atteso('e ritocca',          segna_dal_tablet('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003'), 'gia');
select atteso('chi non è iscritto', tenta($$select segna_dal_tablet('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000007')$$), 'NEGATO: non è iscritto a questo corso');
select atteso('la lezione di domani', tenta($$select segna_dal_tablet('eeeeeeee-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000004')$$), 'NEGATO: fuori orario…');
select atteso('ieri, da chi se n''era dimenticato', segna_dal_tablet('eeeeeeee-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000004'), 'segnata');
select atteso('a lezione in corso', segna_dal_tablet('eeeeeeee-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000004'), 'segnata');
select atteso('tre settimane fa', tenta($$select segna_dal_tablet('eeeeeeee-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000004')$$), 'NEGATO: fuori orario…');
select atteso('ANNULLA subito dopo', annulla_dal_tablet('eeeeeeee-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000004')::text, 'true');
select atteso('e rifatto', segna_dal_tablet('eeeeeeee-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000004'), 'segnata');
reset role;
select atteso('origine di oggi', (select origine::text from presenze where sessione_id = 'eeeeeeee-0000-0000-0000-000000000001'), 'tablet');
select atteso('origine a lezione in corso', (select origine::text from presenze where sessione_id = 'eeeeeeee-0000-0000-0000-000000000006'), 'tablet');
select atteso('origine di ieri', (select origine::text from presenze where sessione_id = 'eeeeeeee-0000-0000-0000-000000000002'), 'recupero');
select atteso('segnata dal tablet', (select postazione_id::text from presenze where sessione_id = 'eeeeeeee-0000-0000-0000-000000000001'), 'dddddddd-0000-0000-0000-000000000001');

\echo ''
\echo '--- 4. il tablet non scavalca l''istruttore ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
-- Maura segna Tommaso assente, e prova anche a far passare la riga per «tablet»
insert into presenze (sessione_id, persona_id, stato, origine)
  values ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000005', 'assente', 'tablet');
reset role;
select atteso('dall''app è sempre appello', (select origine::text from presenze where persona_id = 'aaaaaaaa-0000-0000-0000-000000000005'), 'appello');
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('Tommaso tocca il suo nome', segna_dal_tablet('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000005'), 'istruttore');
reset role;
select atteso('resta assente', (select stato::text from presenze where persona_id = 'aaaaaaaa-0000-0000-0000-000000000005'), 'assente');

\echo ''
\echo '--- 5. l''area istruttore col PIN ---'
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('PIN giusto', (select nome from entra_con_pin('4321')), 'Maura');
select atteso('l''appello ha i cognomi', (select string_agg(cognome || ':' || coalesce(origine::text, '-'), ' ' order by cognome) from appello_con_pin('4321', 'eeeeeeee-0000-0000-0000-000000000001')),
  'De Luca:appello Ferrari:tablet Fontana:-');
select atteso('corregge Giulia Fon.', segna_con_pin('4321', 'eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000004', 'presente')::text, 'true');
select atteso('PIN sbagliato: niente appello', (select count(*)::text from appello_con_pin('0000', 'eeeeeeee-0000-0000-0000-000000000001')), '0');
reset role;
select atteso('segnata da Maura', (select p.nome from presenze pr join persone p on p.id = pr.segnata_da where pr.persona_id = 'aaaaaaaa-0000-0000-0000-000000000004' and pr.sessione_id = 'eeeeeeee-0000-0000-0000-000000000001'), 'Maura');
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select entra_con_pin('1111'); select entra_con_pin('2222'); select entra_con_pin('3333'); select entra_con_pin('5555');
select atteso('dopo cinque sbagliati', tenta($$select nome from entra_con_pin('4321')$$), 'NEGATO: troppi PIN sbagliati…');
reset role;
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('l''altro tablet non è bloccato', (select nome from entra_con_pin('4321')), 'Maura');
reset role;

\echo ''
\echo '--- 6. chi non è un tablet ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('un istruttore sul calendario del tablet', tenta($$select count(*)::text from lezioni_sala(current_date, current_date)$$), 'NEGATO: solo un tablet di sala');
select atteso('un istruttore che si segna «dal tablet»', tenta($$select segna_dal_tablet('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003')$$), 'NEGATO: solo un tablet di sala');
select atteso('una funzione interna', tenta($$select persona_da_pin('4321')::text$$), 'NEGATO: permission denied…');
select atteso('Maura cambia il PIN di Federico', tenta($$select imposta_pin('aaaaaaaa-0000-0000-0000-000000000006', '9999')::text$$), 'NEGATO: il PIN lo cambia la segreteria…');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria dà a Federico il PIN di Maura', tenta($$select imposta_pin('aaaaaaaa-0000-0000-0000-000000000006', '4321')::text$$), 'NEGATO: questo PIN è già di un altro…');
reset role;
select chi('');
set role anon;
select atteso('senza accesso', tenta($$select count(*)::text from lezioni_sala(current_date, current_date)$$), 'NEGATO: permission denied…');
reset role;

\echo ''
\echo '--- 7. più istruttori per corso ---'
select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('Federico annulla una lezione di Lotta 2', tenta($$update sessioni set stato = 'annullata' where id = 'eeeeeeee-0000-0000-0000-000000000004'$$), 'FATTO (1 righe)');
select atteso('e il Judo no', tenta($$update sessioni set stato = 'annullata' where id = 'eeeeeeee-0000-0000-0000-000000000005'$$), 'a vuoto (0 righe)');
reset role;
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('lezione annullata', tenta($$select segna_dal_tablet('eeeeeeee-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000003')$$), 'NEGATO: lezione annullata');
reset role;

\echo ''
\echo 'TUTTO A POSTO'
