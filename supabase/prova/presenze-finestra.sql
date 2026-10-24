-- La finestra delle presenze (52-presenze-finestra.sql): un istruttore segna,
-- cambia e toglie le presenze solo di una lezione che comincia fra i 14 giorni
-- indietro (`recupero`) e la mezz'ora avanti (`prima`) di `tablet_regole()`;
-- fuori, il database risponde con un errore che manda alla segreteria, mai con
-- «0 righe». La segreteria (anche col ruolo doppio) non ha limiti; il tablet e
-- l'iscritto non cambiano. E chi fa l'appello su una lezione che non è ancora
-- cominciata non risulta presente come istruttore.
-- Si lancia dopo tablet.sql, di cui usa persone, corsi e tablet, e dopo i file
-- dello schema fino a 52-presenze-finestra.sql.
-- Le lezioni sono messe attorno ad adesso, e il file si rilancia: parte
-- togliendo quelle di un giro prima.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';
reset role;
select chi('');

-- Lezioni: del Judo 2 (Maura non c'è fra gli istruttori: «corso altrui»), della
-- Lotta 2 (Maura è prevista) e del Kick (Anna, la segreteria, è prevista).
delete from sessioni where id::text like 'eeeeeeee-0000-0000-0000-00000000f0%';
delete from persone where id::text like 'ffffffff-0000-0000-0000-00000000f0%';
update persone set anche_istruttore = false where id = 'aaaaaaaa-0000-0000-0000-000000000001';
insert into corsi (id, nome, sala_id, istruttore_id) values
  ('cccccccc-0000-0000-0000-000000000003', 'Kick', 'bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001')
  on conflict (id) do nothing;
insert into corsi_istruttori (corso_id, persona_id) values
  ('cccccccc-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001')
  on conflict do nothing;
insert into sessioni (id, corso_id, inizio, fine) values
  ('eeeeeeee-0000-0000-0000-00000000f001', 'cccccccc-0000-0000-0000-000000000002', now() - interval '1 day',     now() - interval '1 day' + interval '1 hour'),
  ('eeeeeeee-0000-0000-0000-00000000f002', 'cccccccc-0000-0000-0000-000000000002', now() + interval '20 minutes', now() + interval '80 minutes'),
  ('eeeeeeee-0000-0000-0000-00000000f003', 'cccccccc-0000-0000-0000-000000000002', now() + interval '40 minutes', now() + interval '100 minutes'),
  ('eeeeeeee-0000-0000-0000-00000000f004', 'cccccccc-0000-0000-0000-000000000002', now() - interval '13 days',    now() - interval '13 days' + interval '1 hour'),
  ('eeeeeeee-0000-0000-0000-00000000f005', 'cccccccc-0000-0000-0000-000000000002', now() - interval '15 days',    now() - interval '15 days' + interval '1 hour'),
  ('eeeeeeee-0000-0000-0000-00000000f006', 'cccccccc-0000-0000-0000-000000000002', now() - interval '20 days',    now() - interval '20 days' + interval '1 hour'),
  ('eeeeeeee-0000-0000-0000-00000000f007', 'cccccccc-0000-0000-0000-000000000002', now() - interval '25 months',  now() - interval '25 months' + interval '1 hour'),
  ('eeeeeeee-0000-0000-0000-00000000f008', 'cccccccc-0000-0000-0000-000000000002', now() + interval '3 hours',    now() + interval '4 hours'),
  ('eeeeeeee-0000-0000-0000-00000000f009', 'cccccccc-0000-0000-0000-000000000001', now() + interval '20 minutes', now() + interval '80 minutes'),
  ('eeeeeeee-0000-0000-0000-00000000f010', 'cccccccc-0000-0000-0000-000000000001', now() + interval '3 hours',    now() + interval '4 hours'),
  ('eeeeeeee-0000-0000-0000-00000000f011', 'cccccccc-0000-0000-0000-000000000003', now() - interval '20 days',    now() - interval '20 days' + interval '1 hour'),
  ('eeeeeeee-0000-0000-0000-00000000f012', 'cccccccc-0000-0000-0000-000000000003', now() + interval '40 minutes', now() + interval '100 minutes');
-- Righe già lì, scritte da uno script (nessun utente): su una lezione fuori
-- finestra l'istruttore non le deve poter né cambiare né togliere.
insert into presenze (sessione_id, persona_id, stato) values
  ('eeeeeeee-0000-0000-0000-00000000f003', 'aaaaaaaa-0000-0000-0000-000000000004', 'presente'),
  ('eeeeeeee-0000-0000-0000-00000000f005', 'aaaaaaaa-0000-0000-0000-000000000003', 'presente'),
  ('eeeeeeee-0000-0000-0000-00000000f005', 'aaaaaaaa-0000-0000-0000-000000000004', 'presente'),
  ('eeeeeeee-0000-0000-0000-00000000f006', 'aaaaaaaa-0000-0000-0000-000000000004', 'presente'),
  ('eeeeeeee-0000-0000-0000-00000000f007', 'aaaaaaaa-0000-0000-0000-000000000004', 'presente');
-- Giulia Ferrari ha un accesso, da iscritta.
insert into auth.users (id, email) values ('77777777-7777-7777-7777-777777777777', 'giulia@ods.it') on conflict (id) do nothing;
update persone set utente_id = '77777777-7777-7777-7777-777777777777' where id = 'aaaaaaaa-0000-0000-0000-000000000003';

create or replace function esito(sql text) returns text language plpgsql as $$
declare n int; r text;
begin
  if sql ~* '^\s*select' then execute sql into r; else execute sql; end if;
  get diagnostics n = row_count;
  return coalesce(r, case when n = 0 then 'a vuoto (0 righe)' else 'FATTO (' || n || ' righe)' end);
exception when others then return 'NEGATO ' || sqlstate || ': ' || sqlerrm;
end $$;
-- Il rifiuto della finestra, riconosciuto dalla frase e dal codice: una riga
-- sola nell'esito, e se è un'altra cosa si vede qual è.
create or replace function leggi(r text) returns text language sql immutable as $$
  select case when r like 'NEGATO 42501: La lezione è troppo vecchia o troppo lontana per cambiare le presenze%segreteria%'
    then 'RIFIUTATO' else r end
$$;
-- Inserire, cambiare, togliere: tre tentativi su una lezione. Per un rifiuto,
-- `per_cambiare` è una riga che c'è già (su una che non c'è l'update andrebbe a vuoto).
create or replace function giro(sessione text, per_inserire text, per_cambiare text) returns text language sql as $$
  select leggi(esito(format($q$insert into presenze (sessione_id, persona_id, stato) values (%L, %L, 'presente')$q$, sessione, per_inserire)))
    || ' | ' || leggi(esito(format($q$update presenze set stato = 'assente' where sessione_id = %L and persona_id = %L$q$, sessione, per_cambiare)))
    || ' | ' || leggi(esito(format($q$delete from presenze where sessione_id = %L and persona_id = %L$q$, sessione, per_cambiare)))
$$;
create or replace function righe(sessione text) returns text language sql as $$
  select count(*)::text from presenze where sessione_id = sessione::uuid
$$;
create or replace function di(sessione text, persona text) returns text language sql as $$
  select coalesce((select stato || ' ' || come || ' ' || prevista::text from presenze_istruttori where sessione_id = sessione::uuid and persona_id = persona::uuid), 'nessuna')
$$;
grant execute on function esito(text), leggi(text), giro(text, text, text), righe(text), di(text, text) to anon, authenticated;

\echo ''
\echo '--- 1. l''istruttore, dentro la finestra ---'
select chi('22222222-2222-2222-2222-222222222222');  -- Maura, che il Judo 2 non lo insegna
set role authenticated;
select atteso('Maura segna su un corso non suo, cominciato ieri', esito($$insert into presenze (sessione_id, persona_id, stato) values ('eeeeeeee-0000-0000-0000-00000000f001', 'aaaaaaaa-0000-0000-0000-000000000003', 'presente')$$), 'FATTO (1 righe)');
select atteso('fra 20 minuti sì', esito($$insert into presenze (sessione_id, persona_id, stato) values ('eeeeeeee-0000-0000-0000-00000000f002', 'aaaaaaaa-0000-0000-0000-000000000003', 'presente')$$), 'FATTO (1 righe)');
select atteso('13 giorni fa: segna, cambia, toglie', giro('eeeeeeee-0000-0000-0000-00000000f004', 'aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000003'),
  'FATTO (1 righe) | FATTO (1 righe) | FATTO (1 righe)');

\echo ''
\echo '--- 2. fuori dalla finestra: un errore che manda alla segreteria ---'
select atteso('fra 40 minuti no, e dice a chi scrivere',
  esito($$insert into presenze (sessione_id, persona_id, stato) values ('eeeeeeee-0000-0000-0000-00000000f003', 'aaaaaaaa-0000-0000-0000-000000000003', 'presente')$$),
  'NEGATO 42501: La lezione è troppo vecchia o troppo lontana per cambiare le presenze…segreteria…');
select atteso('fra 40 minuti: segna, cambia, toglie sono tre rifiuti',
  giro('eeeeeeee-0000-0000-0000-00000000f003', 'aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000004'),
  'RIFIUTATO | RIFIUTATO | RIFIUTATO');
select atteso('15 giorni fa: tre rifiuti, nessuno a vuoto',
  giro('eeeeeeee-0000-0000-0000-00000000f005', 'aaaaaaaa-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000003'),
  'RIFIUTATO | RIFIUTATO | RIFIUTATO');
select atteso('20 giorni fa uguale',
  giro('eeeeeeee-0000-0000-0000-00000000f006', 'aaaaaaaa-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000004'),
  'RIFIUTATO | RIFIUTATO | RIFIUTATO');
select atteso('2 anni fa uguale',
  giro('eeeeeeee-0000-0000-0000-00000000f007', 'aaaaaaaa-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000004'),
  'RIFIUTATO | RIFIUTATO | RIFIUTATO');
reset role;
select atteso('le righe di fra 40 minuti sono com''erano', (select string_agg(persona_id::text || ' ' || stato, ', ') from presenze where sessione_id = 'eeeeeeee-0000-0000-0000-00000000f003'), 'aaaaaaaa-0000-0000-0000-000000000004 presente');
select atteso('quelle di 15 giorni fa pure', (select string_agg(stato::text, ' ') from presenze where sessione_id = 'eeeeeeee-0000-0000-0000-00000000f005'), 'presente presente');
select atteso('quelle di 20 giorni fa pure', (select string_agg(stato::text, ' ') from presenze where sessione_id = 'eeeeeeee-0000-0000-0000-00000000f006'), 'presente');

\echo ''
\echo '--- 3. spostare un segno: contano la lezione di prima e quella di dopo ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('da 15 giorni fa a ieri no', esito($$update presenze set sessione_id = 'eeeeeeee-0000-0000-0000-00000000f001' where sessione_id = 'eeeeeeee-0000-0000-0000-00000000f005' and persona_id = 'aaaaaaaa-0000-0000-0000-000000000004'$$) , 'NEGATO 42501: La lezione è troppo vecchia o troppo lontana per cambiare le presenze…segreteria…');
select atteso('un segno di ieri', esito($$insert into presenze (sessione_id, persona_id, stato) values ('eeeeeeee-0000-0000-0000-00000000f001', 'aaaaaaaa-0000-0000-0000-000000000005', 'presente')$$), 'FATTO (1 righe)');
select atteso('da ieri a 15 giorni fa no', esito($$update presenze set sessione_id = 'eeeeeeee-0000-0000-0000-00000000f005' where sessione_id = 'eeeeeeee-0000-0000-0000-00000000f001' and persona_id = 'aaaaaaaa-0000-0000-0000-000000000005'$$) , 'NEGATO 42501: La lezione è troppo vecchia o troppo lontana per cambiare le presenze…segreteria…');
select atteso('da ieri a fra 40 minuti no', esito($$update presenze set sessione_id = 'eeeeeeee-0000-0000-0000-00000000f003' where sessione_id = 'eeeeeeee-0000-0000-0000-00000000f001' and persona_id = 'aaaaaaaa-0000-0000-0000-000000000005'$$) , 'NEGATO 42501: La lezione è troppo vecchia o troppo lontana per cambiare le presenze…segreteria…');
select atteso('da ieri a fra 20 minuti sì: sono tutte e due dentro', esito($$update presenze set sessione_id = 'eeeeeeee-0000-0000-0000-00000000f002' where sessione_id = 'eeeeeeee-0000-0000-0000-00000000f001' and persona_id = 'aaaaaaaa-0000-0000-0000-000000000005'$$) , 'FATTO (1 righe)');
reset role;
select atteso('i segni non si sono mossi dove non dovevano', (select string_agg(sessione_id::text || ' ' || persona_id::text, ', ' order by sessione_id, persona_id) from presenze
  where persona_id = 'aaaaaaaa-0000-0000-0000-000000000004' and sessione_id in ('eeeeeeee-0000-0000-0000-00000000f001', 'eeeeeeee-0000-0000-0000-00000000f005')),
  'eeeeeeee-0000-0000-0000-00000000f005 aaaaaaaa-0000-0000-0000-000000000004');

\echo ''
\echo '--- 4. la segreteria non ha limiti ---'
select chi('11111111-1111-1111-1111-111111111111');  -- Anna
set role authenticated;
select atteso('Anna: fra 40 minuti', giro('eeeeeeee-0000-0000-0000-00000000f003', 'aaaaaaaa-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000005'),
  'FATTO (1 righe) | FATTO (1 righe) | FATTO (1 righe)');
select atteso('Anna: 20 giorni fa', giro('eeeeeeee-0000-0000-0000-00000000f006', 'aaaaaaaa-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000005'),
  'FATTO (1 righe) | FATTO (1 righe) | FATTO (1 righe)');
select atteso('Anna: 2 anni fa', giro('eeeeeeee-0000-0000-0000-00000000f007', 'aaaaaaaa-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000005'),
  'FATTO (1 righe) | FATTO (1 righe) | FATTO (1 righe)');
reset role;

\echo ''
\echo '--- 5. la segreteria che insegna anche ---'
update persone set anche_istruttore = true where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('col ruolo doppio, 20 giorni fa: nessun limite', giro('eeeeeeee-0000-0000-0000-00000000f006', 'aaaaaaaa-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000005'),
  'FATTO (1 righe) | FATTO (1 righe) | FATTO (1 righe)');
select atteso('Anna è prevista nel Kick di 20 giorni fa: segna Giulia assente',
  esito($$insert into presenze (sessione_id, persona_id, stato) values ('eeeeeeee-0000-0000-0000-00000000f011', 'aaaaaaaa-0000-0000-0000-000000000003', 'assente')$$), 'FATTO (1 righe)');
select atteso('fra 40 minuti nel Kick, che è suo: segna Giulia',
  esito($$insert into presenze (sessione_id, persona_id, stato) values ('eeeeeeee-0000-0000-0000-00000000f012', 'aaaaaaaa-0000-0000-0000-000000000003', 'presente')$$), 'FATTO (1 righe)');
reset role;
select atteso('la lezione passata la tiene: confermata dall''appello', di('eeeeeeee-0000-0000-0000-00000000f011', 'aaaaaaaa-0000-0000-0000-000000000001'), 'confermata appello true');
select atteso('quella che non è cominciata, no', di('eeeeeeee-0000-0000-0000-00000000f012', 'aaaaaaaa-0000-0000-0000-000000000001'), 'nessuna');
update persone set anche_istruttore = false where id = 'aaaaaaaa-0000-0000-0000-000000000001';

\echo ''
\echo '--- 6. chi fa l''appello di una lezione non ancora cominciata non c''era ---'
-- Uno script (nessun utente) scrive il segno attribuendolo a Maura.
select chi('');
insert into presenze (sessione_id, persona_id, stato, origine, segnata_da) values
  ('eeeeeeee-0000-0000-0000-00000000f010', 'aaaaaaaa-0000-0000-0000-000000000003', 'presente', 'appello', 'aaaaaaaa-0000-0000-0000-000000000002'),
  ('eeeeeeee-0000-0000-0000-00000000f009', 'aaaaaaaa-0000-0000-0000-000000000003', 'presente', 'appello', 'aaaaaaaa-0000-0000-0000-000000000002'),
  ('eeeeeeee-0000-0000-0000-00000000f008', 'aaaaaaaa-0000-0000-0000-000000000003', 'presente', 'appello', 'aaaaaaaa-0000-0000-0000-000000000002');
update presenze set stato = 'assente' where sessione_id = 'eeeeeeee-0000-0000-0000-00000000f010';
select atteso('Maura prevista, fra 3 ore: niente', di('eeeeeeee-0000-0000-0000-00000000f010', 'aaaaaaaa-0000-0000-0000-000000000002'), 'nessuna');
select atteso('Maura prevista, fra 20 minuti: confermata', di('eeeeeeee-0000-0000-0000-00000000f009', 'aaaaaaaa-0000-0000-0000-000000000002'), 'confermata appello true');
select atteso('Maura non prevista, fra 3 ore: nemmeno da confermare', di('eeeeeeee-0000-0000-0000-00000000f008', 'aaaaaaaa-0000-0000-0000-000000000002'), 'nessuna');
select atteso('e il segno di Giulia c''è', righe('eeeeeeee-0000-0000-0000-00000000f008'), '1');
-- Dentro la finestra, da non prevista, resta da confermare com'è sempre stato.
select atteso('Maura non prevista, fra 20 minuti: da confermare', di('eeeeeeee-0000-0000-0000-00000000f002', 'aaaaaaaa-0000-0000-0000-000000000002'), 'da_confermare appello false');

\echo ''
\echo '--- 7. una prova aggiunta dall''app ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('dentro la finestra', esito($$select aggiungi_prova('eeeeeeee-0000-0000-0000-00000000f002', 'ffffffff-0000-0000-0000-00000000f001', 'Ugo', 'Dentro')::text$$), 'ffffffff-0000-0000-0000-00000000f001');
-- Il tentativo sta in un'istruzione a parte (`\gset`): se la verifica fallisse a
-- metà, annullerebbe con sé anche la persona appena nata, e sotto non si vedrebbe.
select esito($$select aggiungi_prova('eeeeeeee-0000-0000-0000-00000000f003', 'ffffffff-0000-0000-0000-00000000f002', 'Ugo', 'Presto')::text$$) as presto \gset
select esito($$select aggiungi_prova('eeeeeeee-0000-0000-0000-00000000f005', 'ffffffff-0000-0000-0000-00000000f003', 'Ugo', 'Tardi')::text$$) as tardi \gset
select atteso('fra 40 minuti no', leggi(:'presto'), 'RIFIUTATO');
select atteso('15 giorni fa no', leggi(:'tardi'), 'RIFIUTATO');
select atteso('l''errore dice a chi scrivere', :'tardi', 'NEGATO 42501: La lezione è troppo vecchia o troppo lontana per cambiare le presenze…segreteria…');
reset role;
select atteso('fuori finestra non nasce nessuna persona', (select count(*)::text from persone where id in ('ffffffff-0000-0000-0000-00000000f002', 'ffffffff-0000-0000-0000-00000000f003')), '0');
select atteso('né una prova', (select count(*)::text from prove where sessione_id in ('eeeeeeee-0000-0000-0000-00000000f003', 'eeeeeeee-0000-0000-0000-00000000f005')), '0');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria anche a 20 giorni fa', esito($$select aggiungi_prova('eeeeeeee-0000-0000-0000-00000000f006', 'ffffffff-0000-0000-0000-00000000f004', 'Ugo', 'Segreteria')::text$$), 'ffffffff-0000-0000-0000-00000000f004');
reset role;

\echo ''
\echo '--- 8. l''iscritta e il tablet non scrivono le presenze, come prima ---'
select chi('77777777-7777-7777-7777-777777777777');  -- Giulia Ferrari
set role authenticated;
select atteso('l''iscritta non segna, nemmeno dentro la finestra', esito($$insert into presenze (sessione_id, persona_id, stato) values ('eeeeeeee-0000-0000-0000-00000000f001', 'aaaaaaaa-0000-0000-0000-000000000004', 'presente')$$), 'NEGATO 42501: …');
select atteso('né cambia il suo', esito($$update presenze set stato = 'assente' where sessione_id = 'eeeeeeee-0000-0000-0000-00000000f002' and persona_id = 'aaaaaaaa-0000-0000-0000-000000000003'$$), 'a vuoto (0 righe)');
select atteso('né lo toglie', esito($$delete from presenze where sessione_id = 'eeeeeeee-0000-0000-0000-00000000f002' and persona_id = 'aaaaaaaa-0000-0000-0000-000000000003'$$), 'a vuoto (0 righe)');
reset role;
select chi('66666666-6666-6666-6666-666666666666');  -- il tablet della Lotta
set role authenticated;
select atteso('il tablet non segna a mano', esito($$insert into presenze (sessione_id, persona_id, stato) values ('eeeeeeee-0000-0000-0000-00000000f009', 'aaaaaaaa-0000-0000-0000-000000000004', 'presente')$$), 'NEGATO 42501: …');
select atteso('né cambia', esito($$update presenze set stato = 'assente' where sessione_id = 'eeeeeeee-0000-0000-0000-00000000f009'$$), 'a vuoto (0 righe)');
select atteso('né toglie', esito($$delete from presenze where sessione_id = 'eeeeeeee-0000-0000-0000-00000000f009'$$), 'a vuoto (0 righe)');
reset role;
select atteso('i segni sono quelli di prima', righe('eeeeeeee-0000-0000-0000-00000000f009') || ' ' || righe('eeeeeeee-0000-0000-0000-00000000f002'), '1 3');

\echo ''
\echo '--- 9. chi ha segnato lo scrive il server ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('Maura dà la colpa ad Anna', esito($$insert into presenze (sessione_id, persona_id, stato, segnata_da) values ('eeeeeeee-0000-0000-0000-00000000f001', 'aaaaaaaa-0000-0000-0000-000000000007', 'presente', 'aaaaaaaa-0000-0000-0000-000000000001')$$), 'FATTO (1 righe)');
select atteso('e ci riprova cambiandolo', esito($$update presenze set segnata_da = 'aaaaaaaa-0000-0000-0000-000000000001', stato = 'assente' where sessione_id = 'eeeeeeee-0000-0000-0000-00000000f001' and persona_id = 'aaaaaaaa-0000-0000-0000-000000000007'$$), 'FATTO (1 righe)');
reset role;
select atteso('risulta segnata da Maura', (select pe.nome from presenze pr join persone pe on pe.id = pr.segnata_da
  where pr.sessione_id = 'eeeeeeee-0000-0000-0000-00000000f001' and pr.persona_id = 'aaaaaaaa-0000-0000-0000-000000000007'), 'Maura');

\echo ''
\echo '--- 10. la conservazione cancella come prima ---'
-- Il job che toglie le presenze di oltre due anni fa non ha un utente: la finestra non lo ferma.
select chi('');
insert into presenze (sessione_id, persona_id, stato) values ('eeeeeeee-0000-0000-0000-00000000f007', 'aaaaaaaa-0000-0000-0000-000000000007', 'presente');
select atteso('le presenze di 2 anni fa ci sono', righe('eeeeeeee-0000-0000-0000-00000000f007'), '2');
select atteso('il job ne toglie', pulisci_presenze()::text, '2');
select atteso('di quelle vecchie non resta niente', righe('eeeeeeee-0000-0000-0000-00000000f007'), '0');
select atteso('e le altre restano', righe('eeeeeeee-0000-0000-0000-00000000f001') || ' ' || righe('eeeeeeee-0000-0000-0000-00000000f002'), '2 3');

\echo ''
\echo 'TUTTO A POSTO'
