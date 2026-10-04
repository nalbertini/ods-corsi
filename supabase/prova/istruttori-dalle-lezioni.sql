-- La presenza degli istruttori dall'appello e dalle lezioni tenute
-- (23-istruttori-dalle-lezioni.sql): chi fa l'appello c'era, e le lezioni
-- tenute senza l'istruttore segnato le propone la segreteria, che sceglie chi
-- c'era.
-- Si lancia dopo tablet.sql e presenze-istruttori.sql, di cui usa persone,
-- sale, lezioni e presenze, e dopo i file dello schema fino a
-- 23-istruttori-dalle-lezioni.sql.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';
reset role;

-- Le proposte partono da quando c'è il file: qui da un mese fa, per le lezioni di prova.
update impostazioni set proposte_istruttori_dal = now() - interval '30 days';
-- Un Judo 2 di due giorni fa, e un Lotta 2 di quattro giorni fa senza nessuno segnato.
insert into sessioni (id, corso_id, inizio, fine) values
  ('eeeeeeee-0000-0000-0000-000000000007', 'cccccccc-0000-0000-0000-000000000002', now() - interval '2 days', now() - interval '2 days' + interval '1 hour'),
  ('eeeeeeee-0000-0000-0000-000000000008', 'cccccccc-0000-0000-0000-000000000001', now() - interval '4 days', now() - interval '4 days' + interval '1 hour');
-- Si parte puliti sulle lezioni passate: tablet.sql ci ha già segnato qualcuno.
delete from presenze where sessione_id in ('eeeeeeee-0000-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-000000000003');
delete from presenze_istruttori where sessione_id in ('eeeeeeee-0000-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-000000000003');

create or replace function di(sessione text, persona text) returns text language sql as $$
  select coalesce((select stato || ' ' || come || ' ' || prevista::text from presenze_istruttori where sessione_id = sessione::uuid and persona_id = persona::uuid), 'nessuna')
$$;

\echo ''
\echo '--- 1. chi fa l''appello c''era ---'
-- Maura fa l'appello di ieri dall'app: la lezione è sua.
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('Maura segna Giulia', tenta($$insert into presenze (sessione_id, persona_id, stato) values ('eeeeeeee-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000003', 'presente')$$), 'FATTO (1 righe)');
select atteso('e Tommaso assente', tenta($$insert into presenze (sessione_id, persona_id, stato) values ('eeeeeeee-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000005', 'assente')$$), 'FATTO (1 righe)');
reset role;
select atteso('Maura confermata dall''appello', di('eeeeeeee-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002'), 'confermata appello true');
select atteso('una riga sola', (select count(*)::text from presenze_istruttori where sessione_id = 'eeeeeeee-0000-0000-0000-000000000002'), '1');
-- Un appello del Judo, che non è suo, fatto da Maura (scritto da uno script, che lo attribuisce).
insert into presenze (sessione_id, persona_id, stato, segnata_da) values
  ('eeeeeeee-0000-0000-0000-000000000007', 'aaaaaaaa-0000-0000-0000-000000000007', 'presente', 'aaaaaaaa-0000-0000-0000-000000000002');
select atteso('fuori dalle sue: da confermare', di('eeeeeeee-0000-0000-0000-000000000007', 'aaaaaaaa-0000-0000-0000-000000000002'), 'da_confermare appello false');
-- La segreteria fa l'appello di tre settimane fa dal banco.
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('Anna segna Giulia', tenta($$insert into presenze (sessione_id, persona_id, stato) values ('eeeeeeee-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000004', 'presente')$$), 'FATTO (1 righe)');
reset role;
select atteso('la segreteria non si segna', (select count(*)::text from presenze_istruttori where sessione_id = 'eeeeeeee-0000-0000-0000-000000000003'), '0');
-- Il Lotta 2 di quattro giorni fa: Giulia si è segnata dal tablet, nessun istruttore.
insert into presenze (sessione_id, persona_id, stato, origine) values
  ('eeeeeeee-0000-0000-0000-000000000008', 'aaaaaaaa-0000-0000-0000-000000000003', 'presente', 'tablet');
select atteso('il tablet non segna nessun istruttore', (select count(*)::text from presenze_istruttori where sessione_id = 'eeeeeeee-0000-0000-0000-000000000008'), '0');

\echo ''
\echo '--- 2. le lezioni tenute senza l''istruttore ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
-- Tre settimane fa e quattro giorni fa non si è segnato nessuno. Ieri c'era
-- Maura: basta un istruttore segnato, e Federico non si chiede. Il Judo non ha
-- istruttori previsti: non c'è nessuno da proporre.
select atteso('due lezioni', tenta($$select string_agg(corso || ' ' || presenti, ', ' order by inizio) from lezioni_senza_istruttore()$$), 'Lotta 2 1, Lotta 2 1');
select atteso('ieri, con Maura segnata, no', tenta($$select count(*)::text from lezioni_senza_istruttore() where sessione_id = 'eeeeeeee-0000-0000-0000-000000000002'$$), '0');
select atteso('i previsti, senza stato',
  tenta($$select string_agg((x->>'nome') || ' ' || coalesce(x->>'stato', '-'), ', ') from lezioni_senza_istruttore() l, jsonb_array_elements(l.previsti) x where l.sessione_id = 'eeeeeeee-0000-0000-0000-000000000003'$$),
  'Federico -, Maura -');
select atteso('con la sala', tenta($$select string_agg(distinct sala, ' ') from lezioni_senza_istruttore()$$), 'Lotta');

\echo ''
\echo '--- 3. la segreteria sceglie chi c''era ---'
select atteso('tre settimane fa c''era Federico', tenta($$select segna_istruttori_lezione('eeeeeeee-0000-0000-0000-000000000003', array['aaaaaaaa-0000-0000-0000-000000000006']::uuid[])::text$$), '');
select atteso('non uno fuori dai previsti', tenta($$select segna_istruttori_lezione('eeeeeeee-0000-0000-0000-000000000008', array['aaaaaaaa-0000-0000-0000-000000000001']::uuid[])::text$$), 'NEGATO: si sceglie fra gli istruttori previsti');
select atteso('né una lezione che non c''è', tenta($$select segna_istruttori_lezione('00000000-0000-0000-0000-000000000000', '{}')::text$$), 'NEGATO: lezione inesistente');
select atteso('resta quella di quattro giorni fa', tenta($$select count(*)::text from lezioni_senza_istruttore()$$), '1');
reset role;
select atteso('Federico confermato dalla segreteria', di('eeeeeeee-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000006'), 'confermata segreteria true');
select atteso('Maura rifiutata', di('eeeeeeee-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002'), 'rifiutata segreteria true');
select atteso('deciso da Anna', (select string_agg(distinct p.nome, ' ') from presenze_istruttori pi join persone p on p.id = pi.gestita_da where pi.sessione_id = 'eeeeeeee-0000-0000-0000-000000000003'), 'Anna');
select atteso('ieri Maura resta com''era', di('eeeeeeee-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002'), 'confermata appello true');
select atteso('e per Federico niente', di('eeeeeeee-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000006'), 'nessuna');

\echo ''
\echo '--- 4. chi può ---'
-- Un Lotta 2 di cinque giorni fa con Federico sostituto: Maura lì non è prevista.
insert into sessioni (id, corso_id, inizio, fine, istruttore_id) values
  ('eeeeeeee-0000-0000-0000-000000000009', 'cccccccc-0000-0000-0000-000000000001', now() - interval '5 days', now() - interval '5 days' + interval '1 hour', 'aaaaaaaa-0000-0000-0000-000000000006');
insert into presenze (sessione_id, persona_id, stato, origine) values
  ('eeeeeeee-0000-0000-0000-000000000009', 'aaaaaaaa-0000-0000-0000-000000000003', 'presente', 'tablet');
-- Giulia Ferrari con un accesso, da iscritta.
insert into auth.users (id, email) values ('77777777-7777-7777-7777-777777777777', 'giulia@ods.it');
update persone set utente_id = '77777777-7777-7777-7777-777777777777' where id = 'aaaaaaaa-0000-0000-0000-000000000003';
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria le vede tutte, come prima', tenta($$select string_agg(sessione_id::text, ' ' order by inizio) from lezioni_senza_istruttore()$$),
  'eeeeeeee-0000-0000-0000-000000000009 eeeeeeee-0000-0000-0000-000000000008');
reset role;
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('un istruttore vede solo quelle dove è previsto', tenta($$select count(*)::text from lezioni_senza_istruttore()$$), '1');
select atteso('quella di quattro giorni fa, non quella col sostituto', tenta($$select string_agg(sessione_id::text, ' ') from lezioni_senza_istruttore()$$), 'eeeeeeee-0000-0000-0000-000000000008');
reset role;
select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('Federico, previsto in tutte e due, le vede tutte e due', tenta($$select count(*)::text from lezioni_senza_istruttore()$$), '2');
reset role;
select chi('77777777-7777-7777-7777-777777777777');
set role authenticated;
select atteso('un iscritto non le vede', tenta($$select count(*)::text from lezioni_senza_istruttore()$$), 'NEGATO: le lezioni da confermare le vede la segreteria');
reset role;
select chi('99999999-9999-9999-9999-999999999999');
set role authenticated;
select atteso('chi ha un accesso ma nessuna scheda nemmeno', tenta($$select count(*)::text from lezioni_senza_istruttore()$$), 'NEGATO: le lezioni da confermare le vede la segreteria');
reset role;
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('e non sceglie', tenta($$select segna_istruttori_lezione('eeeeeeee-0000-0000-0000-000000000008', array['aaaaaaaa-0000-0000-0000-000000000002']::uuid[])::text$$), 'NEGATO: la presenza la conferma la segreteria');
select atteso('la funzione interna', tenta($$select previsti_su('eeeeeeee-0000-0000-0000-000000000008')::text$$), 'NEGATO: permission denied…');
reset role;
select chi('');
set role anon;
select atteso('senza accesso', tenta($$select count(*)::text from lezioni_senza_istruttore()$$), 'NEGATO: permission denied…');
reset role;
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('il tablet non le vede', tenta($$select count(*)::text from lezioni_senza_istruttore()$$), 'NEGATO: le lezioni da confermare le vede la segreteria');
reset role;

\echo ''
\echo '--- 5. da quando ---'
update impostazioni set proposte_istruttori_dal = now() - interval '3 days';
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('quelle di prima non si propongono', tenta($$select count(*)::text from lezioni_senza_istruttore()$$), '0');
reset role;

\echo ''
\echo 'TUTTO A POSTO'
