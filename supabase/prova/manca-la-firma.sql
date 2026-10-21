-- Manca la firma: in COMPENSI chi era previsto a una lezione tenuta in due e
-- non ha firmato. La segreteria lo segna «Non c'era» con
-- `segna_istruttore_assente`: una presenza rifiutata, prevista, come
-- 'segreteria', decisa da chi la segna; e nei corsi dove gli istruttori si
-- alternano spunta «a lezione basta uno» (`corsi.basta_uno`). Gli stessi
-- casi di `scripts/prova-colleghi.mjs` (5 bis), con gli stessi messaggi.
--
-- Si lancia dopo 82-manca-la-firma.sql, e dopo tablet.sql, di cui usa persone,
-- sale, corsi e tablet: Lotta 2 la insegnano Maura e Federico.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';
reset role;

-- Due giorni fa Maura ha messo il PIN, Federico no. Poi una col sostituto
-- (Federico al posto di tutti e due), una annullata.
insert into sessioni (id, corso_id, inizio, fine) values
  ('eeeeeeee-0000-0000-0000-000000000082', 'cccccccc-0000-0000-0000-000000000001', now() - interval '2 days', now() - interval '2 days' + interval '1 hour'),
  ('eeeeeeee-0000-0000-0000-000000000083', 'cccccccc-0000-0000-0000-000000000001', now() - interval '3 days', now() - interval '3 days' + interval '1 hour');
update sessioni set stato = 'annullata' where id = 'eeeeeeee-0000-0000-0000-000000000083';
insert into sessioni (id, corso_id, inizio, fine, istruttore_id) values
  ('eeeeeeee-0000-0000-0000-000000000084', 'cccccccc-0000-0000-0000-000000000001', now() - interval '4 days', now() - interval '4 days' + interval '1 hour', 'aaaaaaaa-0000-0000-0000-000000000006');
insert into presenze_istruttori (sessione_id, persona_id, stato, prevista, come) values
  ('eeeeeeee-0000-0000-0000-000000000082', 'aaaaaaaa-0000-0000-0000-000000000002', 'confermata', true, 'pin');
-- Tommaso De Luca con un accesso, da iscritto.
insert into auth.users (id, email) values ('88888888-8888-8888-8888-888888888888', 'tommaso@ods.it');
update persone set utente_id = '88888888-8888-8888-8888-888888888888' where id = 'aaaaaaaa-0000-0000-0000-000000000005';

create or replace function di(sessione text, persona text) returns text language sql as $$
  select coalesce((select stato || ' ' || come || ' ' || prevista::text from presenze_istruttori where sessione_id = sessione::uuid and persona_id = persona::uuid), 'nessuna')
$$;
-- Il codice dell'errore, per i rifiuti: il messaggio lo dice `tenta`.
create or replace function codice(sql text) returns text language plpgsql as $$
begin
  execute sql;
  return 'nessun errore';
exception when others then return sqlstate;
end $$;
-- `basta_uno` di Lotta 2; con `tenta`, perché prima del file la colonna non c'è.
create or replace function basta_uno() returns text language plpgsql as $$
begin
  return tenta($q$select basta_uno::text from corsi where id = 'cccccccc-0000-0000-0000-000000000001'$q$);
end $$;
grant execute on function codice(text), basta_uno() to anon, authenticated;

\echo ''
\echo '--- 1. la segreteria segna «Non c''era» ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('Anna segna Federico: non c''era', tenta($$select segna_istruttore_assente('eeeeeeee-0000-0000-0000-000000000082', 'aaaaaaaa-0000-0000-0000-000000000006')$$), 'segnata');
select atteso('una seconda volta: già', tenta($$select segna_istruttore_assente('eeeeeeee-0000-0000-0000-000000000082', 'aaaaaaaa-0000-0000-0000-000000000006')$$), 'gia');
select atteso('Maura c''era già: niente', tenta($$select segna_istruttore_assente('eeeeeeee-0000-0000-0000-000000000082', 'aaaaaaaa-0000-0000-0000-000000000002')$$), 'gia');
select atteso('non uno fuori dai previsti', tenta($$select segna_istruttore_assente('eeeeeeee-0000-0000-0000-000000000082', 'aaaaaaaa-0000-0000-0000-000000000007')$$), 'NEGATO: si sceglie fra gli istruttori previsti');
select atteso('fuori dai previsti: 22023', codice($$select segna_istruttore_assente('eeeeeeee-0000-0000-0000-000000000082', 'aaaaaaaa-0000-0000-0000-000000000007')$$), '22023');
-- Col sostituto la lezione la fa lui solo (`previsti_su`): Maura lì non è prevista.
select atteso('non chi il sostituto ha sostituito', tenta($$select segna_istruttore_assente('eeeeeeee-0000-0000-0000-000000000084', 'aaaaaaaa-0000-0000-0000-000000000002')$$), 'NEGATO: si sceglie fra gli istruttori previsti');
select atteso('né su una annullata', tenta($$select segna_istruttore_assente('eeeeeeee-0000-0000-0000-000000000083', 'aaaaaaaa-0000-0000-0000-000000000006')$$), 'NEGATO: la lezione è annullata');
select atteso('annullata: 22023', codice($$select segna_istruttore_assente('eeeeeeee-0000-0000-0000-000000000083', 'aaaaaaaa-0000-0000-0000-000000000006')$$), '22023');
select atteso('né su una lezione che non c''è', tenta($$select segna_istruttore_assente('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000006')$$), 'NEGATO: lezione inesistente');
select atteso('che non c''è: P0002', codice($$select segna_istruttore_assente('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000006')$$), 'P0002');
reset role;
select atteso('Federico rifiutato, scelto dalla segreteria, era previsto', di('eeeeeeee-0000-0000-0000-000000000082', 'aaaaaaaa-0000-0000-0000-000000000006'), 'rifiutata segreteria true');
select atteso('una presenza sola', (select count(*)::text from presenze_istruttori where sessione_id = 'eeeeeeee-0000-0000-0000-000000000082' and persona_id = 'aaaaaaaa-0000-0000-0000-000000000006'), '1');
select atteso('deciso da Anna, adesso', (select p.nome || ' ' || (pi.gestita_il > now() - interval '1 minute')::text from presenze_istruttori pi join persone p on p.id = pi.gestita_da where pi.sessione_id = 'eeeeeeee-0000-0000-0000-000000000082' and pi.persona_id = 'aaaaaaaa-0000-0000-0000-000000000006'), 'Anna true');
select atteso('Maura resta dal PIN', di('eeeeeeee-0000-0000-0000-000000000082', 'aaaaaaaa-0000-0000-0000-000000000002'), 'confermata pin true');
select atteso('nessuna riga dai rifiuti', (select count(*)::text from presenze_istruttori where sessione_id in ('eeeeeeee-0000-0000-0000-000000000083', 'eeeeeeee-0000-0000-0000-000000000084') or persona_id = 'aaaaaaaa-0000-0000-0000-000000000007'), '0');
delete from presenze_istruttori where sessione_id = 'eeeeeeee-0000-0000-0000-000000000082' and persona_id = 'aaaaaaaa-0000-0000-0000-000000000006';

\echo ''
\echo '--- 2. nessun altro ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('Maura, istruttore e prevista, no', codice($$select segna_istruttore_assente('eeeeeeee-0000-0000-0000-000000000082', 'aaaaaaaa-0000-0000-0000-000000000006')$$), '42501');
reset role;
select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('Federico non si segna da sé', codice($$select segna_istruttore_assente('eeeeeeee-0000-0000-0000-000000000082', 'aaaaaaaa-0000-0000-0000-000000000006')$$), '42501');
reset role;
select chi('88888888-8888-8888-8888-888888888888');
set role authenticated;
select atteso('un iscritto no', codice($$select segna_istruttore_assente('eeeeeeee-0000-0000-0000-000000000082', 'aaaaaaaa-0000-0000-0000-000000000006')$$), '42501');
reset role;
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('il tablet no', codice($$select segna_istruttore_assente('eeeeeeee-0000-0000-0000-000000000082', 'aaaaaaaa-0000-0000-0000-000000000006')$$), '42501');
reset role;
select chi('');
set role anon;
select atteso('senza accesso', tenta($$select segna_istruttore_assente('eeeeeeee-0000-0000-0000-000000000082', 'aaaaaaaa-0000-0000-0000-000000000006')$$), 'NEGATO: permission denied…');
reset role;
select atteso('Federico non ha nessuna presenza', di('eeeeeeee-0000-0000-0000-000000000082', 'aaaaaaaa-0000-0000-0000-000000000006'), 'nessuna');

\echo ''
\echo '--- 3. «a lezione basta uno» ---'
select atteso('un corso parte senza', basta_uno(), 'false');
select atteso('nemmeno Judo 2', tenta($$select basta_uno::text from corsi where id = 'cccccccc-0000-0000-0000-000000000002'$$), 'false');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria lo spunta', tenta($$update corsi set basta_uno = true where id = 'cccccccc-0000-0000-0000-000000000001'$$), 'FATTO (1 righe)');
select atteso('vuoto no', tenta($$update corsi set basta_uno = null where id = 'cccccccc-0000-0000-0000-000000000001'$$), 'NEGATO: …');
reset role;
select atteso('spuntato', basta_uno(), 'true');
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('un istruttore lo legge', basta_uno(), 'true');
select atteso('ma non lo toglie, nemmeno nel corso che insegna', tenta($$update corsi set basta_uno = false where id = 'cccccccc-0000-0000-0000-000000000001'$$), 'a vuoto (0 righe)');
reset role;
select chi('88888888-8888-8888-8888-888888888888');
set role authenticated;
select atteso('un iscritto no', tenta($$update corsi set basta_uno = false where id = 'cccccccc-0000-0000-0000-000000000001'$$), 'a vuoto (0 righe)');
reset role;
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('il tablet no', tenta($$update corsi set basta_uno = false where id = 'cccccccc-0000-0000-0000-000000000001'$$), 'a vuoto (0 righe)');
reset role;
select chi('');
set role anon;
select atteso('senza accesso no', tenta($$update corsi set basta_uno = false where id = 'cccccccc-0000-0000-0000-000000000001'$$), 'NEGATO: permission denied…');
reset role;
select atteso('resta spuntato', basta_uno(), 'true');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria lo toglie', tenta($$update corsi set basta_uno = false where id = 'cccccccc-0000-0000-0000-000000000001'$$), 'FATTO (1 righe)');
reset role;
select atteso('tolto', basta_uno(), 'false');

\echo ''
\echo 'TUTTO A POSTO'
