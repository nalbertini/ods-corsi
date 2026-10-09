-- Il collega segnato dall'appello: chi insegna una lezione ed è nell'appello
-- dal telefono segna presente anche l'altro istruttore previsto, che non ha
-- messo il PIN. La presenza è confermata da sola, `come` = 'collega', con chi
-- l'ha segnata in `segnata_da`; finché la segreteria non l'ha guardata, chi
-- l'ha segnata la può togliere. E la segreteria segna «c'era» un previsto
-- anche su una lezione già coperta da un altro istruttore.
--
-- Qui Maura fa da «Nicola» (chi fa l'appello) e Federico da «Giulia» (il
-- collega): insegnano tutti e due Lotta 2.
-- Si lancia dopo tablet.sql, di cui usa persone, sale, corsi e tablet.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';
reset role;

-- Le lezioni di Lotta 2 di questa prova: una in corso, una annullata, una col
-- sostituto (Federico al posto di Maura), una di due giorni fa.
insert into sessioni (id, corso_id, inizio, fine) values
  ('eeeeeeee-0000-0000-0000-000000000010', 'cccccccc-0000-0000-0000-000000000001', now() - interval '30 minutes', now() + interval '30 minutes'),
  ('eeeeeeee-0000-0000-0000-000000000011', 'cccccccc-0000-0000-0000-000000000001', now() - interval '2 hours', now() - interval '1 hour'),
  ('eeeeeeee-0000-0000-0000-000000000013', 'cccccccc-0000-0000-0000-000000000001', now() - interval '2 days', now() - interval '2 days' + interval '1 hour');
update sessioni set stato = 'annullata' where id = 'eeeeeeee-0000-0000-0000-000000000011';
insert into sessioni (id, corso_id, inizio, fine, istruttore_id) values
  ('eeeeeeee-0000-0000-0000-000000000012', 'cccccccc-0000-0000-0000-000000000001', now() - interval '3 hours', now() - interval '2 hours', 'aaaaaaaa-0000-0000-0000-000000000006');
-- Un corso che insegnano Anna, la segreteria, e Maura: Anna lì è prevista.
insert into corsi (id, nome, sala_id, istruttore_id) values
  ('cccccccc-0000-0000-0000-000000000003', 'Kick', 'bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001');
insert into corsi_istruttori (corso_id, persona_id) values
  ('cccccccc-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('cccccccc-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002');
insert into sessioni (id, corso_id, inizio, fine) values
  ('eeeeeeee-0000-0000-0000-000000000014', 'cccccccc-0000-0000-0000-000000000003', now() - interval '30 minutes', now() + interval '30 minutes');
-- Tommaso De Luca con un accesso, da iscritto.
insert into auth.users (id, email) values ('88888888-8888-8888-8888-888888888888', 'tommaso@ods.it');
update persone set utente_id = '88888888-8888-8888-8888-888888888888' where id = 'aaaaaaaa-0000-0000-0000-000000000005';

create or replace function di(sessione text, persona text) returns text language sql as $$
  select coalesce((select stato || ' ' || come || ' ' || prevista::text from presenze_istruttori where sessione_id = sessione::uuid and persona_id = persona::uuid), 'nessuna')
$$;
-- Chi l'ha segnata, per nome; con `tenta`, perché prima del file la colonna non c'è.
create or replace function segnata_da(sessione text, persona text) returns text language plpgsql as $$
begin
  return tenta(format($q$select coalesce((select pe.nome from presenze_istruttori pi join persone pe on pe.id = pi.segnata_da where pi.sessione_id = %L and pi.persona_id = %L), 'nessuno')$q$, sessione, persona));
end $$;
-- Gli istruttori della lezione come li vede chi fa l'appello: nome e stato, «-» se non segnato.
create or replace function istruttori_di(sessione text) returns text language plpgsql as $$
begin
  return tenta(format($q$select string_agg(nome || ' ' || coalesce(stato::text, '-'), ', ' order by nome) from istruttori_lezione(%L)$q$, sessione));
end $$;

\echo ''
\echo '--- 1. chi fa l''appello vede gli istruttori della lezione ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('prima dell''appello nessuno è segnato', istruttori_di('eeeeeeee-0000-0000-0000-000000000010'), 'Federico -, Maura -');
-- Maura fa l'appello: segna Giulia Ferrari, e il trigger segna lei.
select atteso('Maura segna Giulia Ferrari', tenta($$insert into presenze (sessione_id, persona_id, stato) values ('eeeeeeee-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000003', 'presente')$$), 'FATTO (1 righe)');
select atteso('Maura sì, Federico no', istruttori_di('eeeeeeee-0000-0000-0000-000000000010'), 'Federico -, Maura confermata');
select atteso('Maura da sola legge solo le sue righe', tenta($$select count(*)::text from presenze_istruttori where sessione_id = 'eeeeeeee-0000-0000-0000-000000000010' and persona_id <> 'aaaaaaaa-0000-0000-0000-000000000002'$$), '0');
reset role;

\echo ''
\echo '--- 2. Maura segna Federico ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('Maura segna Federico', tenta($$select segna_collega('eeeeeeee-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000006')$$), 'segnata');
select atteso('e lo vede segnato', istruttori_di('eeeeeeee-0000-0000-0000-000000000010'), 'Federico confermata, Maura confermata');
select atteso('non ancora guardato dalla segreteria', tenta($$select string_agg(nome || ' ' || gestita::text, ', ' order by nome) from istruttori_lezione('eeeeeeee-0000-0000-0000-000000000010')$$), 'Federico false, Maura false');
select atteso('una seconda volta: già segnato', tenta($$select segna_collega('eeeeeeee-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000006')$$), 'gia');
reset role;
select atteso('Federico confermato, da collega, era previsto', di('eeeeeeee-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000006'), 'confermata collega true');
select atteso('segnato da Maura', segnata_da('eeeeeeee-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000006'), 'Maura');
select atteso('non è una decisione della segreteria', (select coalesce(gestita_da::text, 'nessuno') from presenze_istruttori where sessione_id = 'eeeeeeee-0000-0000-0000-000000000010' and persona_id = 'aaaaaaaa-0000-0000-0000-000000000006'), 'nessuno');
select atteso('la riga di Maura resta dall''appello', di('eeeeeeee-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000002'), 'confermata appello true');
-- LE MIE ORE di Federico leggono le sue righe: la lezione c'è, confermata.
select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('in LE MIE ORE di Federico, confermata', tenta($$select stato::text from presenze_istruttori where sessione_id = 'eeeeeeee-0000-0000-0000-000000000010'$$), 'confermata');
reset role;

\echo ''
\echo '--- 3. chi non può, e chi non si segna ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('non se stessa', tenta($$select segna_collega('eeeeeeee-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000002')$$), 'NEGATO: te stesso ti segna l''appello');
select atteso('non la segreteria, che lì non insegna', tenta($$select segna_collega('eeeeeeee-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000001')$$), 'NEGATO: si segnano solo gli istruttori previsti');
select atteso('non un iscritto', tenta($$select segna_collega('eeeeeeee-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000007')$$), 'NEGATO: si segnano solo gli istruttori previsti');
select atteso('non su una lezione dove Maura non insegna', tenta($$select segna_collega('eeeeeeee-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000006')$$), 'NEGATO: segna un collega solo chi insegna questa lezione');
-- Col sostituto la lezione la fa lui solo (`previsti_su`): Maura lì non è prevista.
select atteso('non dove c''è un sostituto al suo posto', tenta($$select segna_collega('eeeeeeee-0000-0000-0000-000000000012', 'aaaaaaaa-0000-0000-0000-000000000006')$$), 'NEGATO: segna un collega solo chi insegna questa lezione');
-- Dall'appello: prima la sua presenza, poi il collega. Non su una lezione di due giorni fa senza appello.
select atteso('non prima del suo appello', tenta($$select segna_collega('eeeeeeee-0000-0000-0000-000000000013', 'aaaaaaaa-0000-0000-0000-000000000006')$$), 'NEGATO: prima fai l''appello: il collega si segna dopo');
select atteso('su una lezione annullata nessun istruttore', tenta($$select count(*)::text from istruttori_lezione('eeeeeeee-0000-0000-0000-000000000011')$$), '0');
select atteso('non su una lezione annullata', tenta($$select segna_collega('eeeeeeee-0000-0000-0000-000000000011', 'aaaaaaaa-0000-0000-0000-000000000006')$$), 'NEGATO: la lezione è annullata');
select atteso('né su una che non c''è', tenta($$select segna_collega('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000006')$$), 'NEGATO: lezione inesistente');
-- La chiama la coda del telefono: 23503, che la coda non riprova (P0002 la fermerebbe per sempre), come aggiungi_prova.
do $$ begin perform segna_collega('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000006'); raise exception 'nessun errore'; exception when foreign_key_violation then null; end $$;
select atteso('e a mano nella tabella no', tenta($$insert into presenze_istruttori (sessione_id, persona_id, stato, prevista, come) values ('eeeeeeee-0000-0000-0000-000000000013', 'aaaaaaaa-0000-0000-0000-000000000006', 'confermata', true, 'collega')$$), 'NEGATO: permission denied…');
reset role;
select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('il sostituto non segna chi ha sostituito', tenta($$select segna_collega('eeeeeeee-0000-0000-0000-000000000012', 'aaaaaaaa-0000-0000-0000-000000000002')$$), 'NEGATO: si segnano solo gli istruttori previsti');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria, anche prevista, non è un collega', tenta($$select segna_collega('eeeeeeee-0000-0000-0000-000000000014', 'aaaaaaaa-0000-0000-0000-000000000002')$$), 'NEGATO: segna un collega solo chi insegna questa lezione');
reset role;
select chi('88888888-8888-8888-8888-888888888888');
set role authenticated;
select atteso('un iscritto no', tenta($$select segna_collega('eeeeeeee-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000006')$$), 'NEGATO: segna un collega solo chi insegna questa lezione');
select atteso('e non legge gli istruttori della lezione', istruttori_di('eeeeeeee-0000-0000-0000-000000000010'), 'NEGATO: gli istruttori della lezione li vede chi fa l''appello');
reset role;
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('il tablet no: solo dal telefono', tenta($$select segna_collega('eeeeeeee-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000006')$$), 'NEGATO: segna un collega solo chi insegna questa lezione');
select atteso('e non li legge', istruttori_di('eeeeeeee-0000-0000-0000-000000000010'), 'NEGATO: gli istruttori della lezione li vede chi fa l''appello');
reset role;
select chi('');
set role anon;
select atteso('senza accesso', tenta($$select segna_collega('eeeeeeee-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000006')$$), 'NEGATO: permission denied…');
select atteso('senza accesso, nemmeno la lettura', istruttori_di('eeeeeeee-0000-0000-0000-000000000010'), 'NEGATO: permission denied…');
select atteso('né il togliere', tenta($$select togli_collega('eeeeeeee-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000006')::text$$), 'NEGATO: permission denied…');
reset role;
-- Gli istruttori di una lezione li legge chi la insegna, o la segreteria: non un altro istruttore.
select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('Federico non legge gli istruttori di Kick, dove non insegna', istruttori_di('eeeeeeee-0000-0000-0000-000000000014'), 'NEGATO: gli istruttori della lezione li vede chi fa l''appello');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria sì', istruttori_di('eeeeeeee-0000-0000-0000-000000000010'), 'Federico confermata, Maura confermata');
reset role;
-- Chi l'aveva segnato non c'è più (`segnata_da` nullo): il tablet o un iscritto non la tolgono.
insert into presenze_istruttori (sessione_id, persona_id, stato, prevista, come) values ('eeeeeeee-0000-0000-0000-000000000013', 'aaaaaaaa-0000-0000-0000-000000000006', 'confermata', true, 'collega');
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('il tablet non toglie un segno senza chi l''ha messo', tenta($$select togli_collega('eeeeeeee-0000-0000-0000-000000000013', 'aaaaaaaa-0000-0000-0000-000000000006')::text$$), 'NEGATO: si toglie solo un collega segnato da te');
reset role;
select chi('88888888-8888-8888-8888-888888888888');
set role authenticated;
select atteso('un iscritto nemmeno', tenta($$select togli_collega('eeeeeeee-0000-0000-0000-000000000013', 'aaaaaaaa-0000-0000-0000-000000000006')::text$$), 'NEGATO: si toglie solo un collega segnato da te');
select atteso('e non scopre se c''è una presenza', tenta($$select togli_collega('eeeeeeee-0000-0000-0000-000000000014', 'aaaaaaaa-0000-0000-0000-000000000006')::text$$), 'NEGATO: si toglie solo un collega segnato da te');
reset role;
select atteso('la riga resta', di('eeeeeeee-0000-0000-0000-000000000013', 'aaaaaaaa-0000-0000-0000-000000000006'), 'confermata collega true');
delete from presenze_istruttori where sessione_id = 'eeeeeeee-0000-0000-0000-000000000013';
select atteso('nessuna riga dai rifiuti', (select count(*)::text from presenze_istruttori where sessione_id in ('eeeeeeee-0000-0000-0000-000000000005', 'eeeeeeee-0000-0000-0000-000000000011', 'eeeeeeee-0000-0000-0000-000000000012', 'eeeeeeee-0000-0000-0000-000000000014')), '0');

\echo ''
\echo '--- 4. togliere il segno ---'
select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('Federico non toglie il segno di Maura', tenta($$select togli_collega('eeeeeeee-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000006')::text$$), 'NEGATO: si toglie solo un collega segnato da te');
reset role;
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('Maura toglie Federico, segnato da lei', tenta($$select togli_collega('eeeeeeee-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000006')::text$$), '');
select atteso('e non è più segnato', istruttori_di('eeeeeeee-0000-0000-0000-000000000010'), 'Federico -, Maura confermata');
-- Senza rete un segno e il suo togliere arrivano insieme: togliere chi non c'è non è un errore.
select atteso('toglierlo di nuovo: niente', tenta($$select togli_collega('eeeeeeee-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000006')::text$$), '');
select atteso('non toglie la propria presenza', tenta($$select togli_collega('eeeeeeee-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000002')::text$$), 'NEGATO: si toglie solo un collega segnato da te');
reset role;
select atteso('la riga se ne va', di('eeeeeeee-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000006'), 'nessuna');

-- Federico ora entra col PIN: è sua, Maura non la toglie.
insert into presenze_istruttori (sessione_id, persona_id, stato, prevista, come) values
  ('eeeeeeee-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000006', 'confermata', true, 'pin');
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('col PIN: segnarlo non cambia niente', tenta($$select segna_collega('eeeeeeee-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000006')$$), 'gia');
select atteso('col PIN: non si toglie', tenta($$select togli_collega('eeeeeeee-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000006')::text$$), 'NEGATO: si toglie solo un collega segnato da te');
reset role;
select atteso('resta dal PIN', di('eeeeeeee-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000006'), 'confermata pin true');
select atteso('e nessuno l''ha segnato', segnata_da('eeeeeeee-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000006'), 'nessuno');

-- Rifiutata dalla segreteria: segnarlo non la cambia.
update presenze_istruttori set stato = 'rifiutata', gestita_da = 'aaaaaaaa-0000-0000-0000-000000000001', gestita_il = now()
  where sessione_id = 'eeeeeeee-0000-0000-0000-000000000010' and persona_id = 'aaaaaaaa-0000-0000-0000-000000000006';
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('rifiutata: segnarlo non cambia niente', tenta($$select segna_collega('eeeeeeee-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000006')$$), 'gia');
reset role;
select atteso('resta rifiutata', di('eeeeeeee-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000006'), 'rifiutata pin true');

-- Scelto dalla segreteria: non è di Maura.
update presenze_istruttori set stato = 'confermata', come = 'segreteria'
  where sessione_id = 'eeeeeeee-0000-0000-0000-000000000010' and persona_id = 'aaaaaaaa-0000-0000-0000-000000000006';
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('scelto dalla segreteria: non si toglie', tenta($$select togli_collega('eeeeeeee-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000006')::text$$), 'NEGATO: si toglie solo un collega segnato da te');
reset role;
select atteso('resta della segreteria', di('eeeeeeee-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000006'), 'confermata segreteria true');

-- Segnato da Maura e poi guardato dalla segreteria: da lì decide lei.
delete from presenze_istruttori where sessione_id = 'eeeeeeee-0000-0000-0000-000000000010' and persona_id = 'aaaaaaaa-0000-0000-0000-000000000006';
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('Maura lo risegna', tenta($$select segna_collega('eeeeeeee-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000006')$$), 'segnata');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria la rifiuta', tenta($$select gestisci_presenza_istruttore(id, false)::text from presenze_istruttori where sessione_id = 'eeeeeeee-0000-0000-0000-000000000010' and persona_id = 'aaaaaaaa-0000-0000-0000-000000000006'$$), '');
reset role;
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('guardata dalla segreteria: Maura non la toglie più', tenta($$select togli_collega('eeeeeeee-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000006')::text$$), 'NEGATO: si toglie solo un collega segnato da te');
reset role;
select atteso('resta rifiutata, da collega', di('eeeeeeee-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000006'), 'rifiutata collega true');

\echo ''
\echo '--- 5. la segreteria segna un previsto su una lezione già coperta ---'
-- Due giorni fa Maura ha fatto l'appello; Federico non c'è.
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('Maura fa l''appello di due giorni fa', tenta($$insert into presenze (sessione_id, persona_id, stato) values ('eeeeeeee-0000-0000-0000-000000000013', 'aaaaaaaa-0000-0000-0000-000000000003', 'presente')$$), 'FATTO (1 righe)');
select atteso('Maura non usa la strada della segreteria', tenta($$select segna_istruttore_previsto('eeeeeeee-0000-0000-0000-000000000013', 'aaaaaaaa-0000-0000-0000-000000000006')$$), 'NEGATO: la presenza la conferma la segreteria');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la lezione è coperta: fra le senza istruttore non c''è', tenta($$select count(*)::text from lezioni_senza_istruttore() where sessione_id = 'eeeeeeee-0000-0000-0000-000000000013'$$), '0');
select atteso('Anna segna Federico: c''era', tenta($$select segna_istruttore_previsto('eeeeeeee-0000-0000-0000-000000000013', 'aaaaaaaa-0000-0000-0000-000000000006')$$), 'segnata');
select atteso('Maura c''è già: niente', tenta($$select segna_istruttore_previsto('eeeeeeee-0000-0000-0000-000000000013', 'aaaaaaaa-0000-0000-0000-000000000002')$$), 'gia');
select atteso('non uno fuori dai previsti', tenta($$select segna_istruttore_previsto('eeeeeeee-0000-0000-0000-000000000013', 'aaaaaaaa-0000-0000-0000-000000000007')$$), 'NEGATO: si sceglie fra gli istruttori previsti');
select atteso('né su una lezione che non c''è', tenta($$select segna_istruttore_previsto('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000006')$$), 'NEGATO: lezione inesistente');
select atteso('né su una annullata', tenta($$select segna_istruttore_previsto('eeeeeeee-0000-0000-0000-000000000011', 'aaaaaaaa-0000-0000-0000-000000000006')$$), 'NEGATO: la lezione è annullata');
reset role;
select atteso('Federico confermato dalla segreteria', di('eeeeeeee-0000-0000-0000-000000000013', 'aaaaaaaa-0000-0000-0000-000000000006'), 'confermata segreteria true');
select atteso('deciso da Anna', (select p.nome from presenze_istruttori pi join persone p on p.id = pi.gestita_da where pi.sessione_id = 'eeeeeeee-0000-0000-0000-000000000013' and pi.persona_id = 'aaaaaaaa-0000-0000-0000-000000000006'), 'Anna');
select atteso('Maura resta dall''appello', di('eeeeeeee-0000-0000-0000-000000000013', 'aaaaaaaa-0000-0000-0000-000000000002'), 'confermata appello true');
select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('in LE MIE ORE di Federico, confermata', tenta($$select stato::text from presenze_istruttori where sessione_id = 'eeeeeeee-0000-0000-0000-000000000013'$$), 'confermata');
select atteso('e Federico non la usa', tenta($$select segna_istruttore_previsto('eeeeeeee-0000-0000-0000-000000000013', 'aaaaaaaa-0000-0000-0000-000000000006')$$), 'NEGATO: la presenza la conferma la segreteria');
reset role;
select chi('');
set role anon;
select atteso('senza accesso', tenta($$select segna_istruttore_previsto('eeeeeeee-0000-0000-0000-000000000013', 'aaaaaaaa-0000-0000-0000-000000000006')$$), 'NEGATO: permission denied…');
reset role;

\echo ''
\echo 'TUTTO A POSTO'
