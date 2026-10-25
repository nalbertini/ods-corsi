-- La chiusura della palestra: la segreteria annulla in un colpo le lezioni di un
-- periodo (Natale, ponti), la chiusura si ricorda anche per le lezioni create
-- dopo, e si può togliere. Si lancia dopo finto-supabase.sql, i file dello
-- schema e supabase/118-chiusure.sql. I casi sono gli stessi di
-- `scripts/prova-chiusure.mjs` (la modalità prova), i criteri in
-- `docs/design-canvas/chiusura-palestra/CRITERI.md` (i numeri fra parentesi).
--
-- Lo schema che questa prova si aspetta (lo fissa lei: il file SQL lo segue):
--
--   chiusure           id uuid pk · dal date not null · al date not null
--                      · sala_id uuid null → sale on delete cascade (null = tutte)
--                      · creata_il timestamptz default now()
--                      · creata_da uuid → persone on delete set null
--                      · check al >= dal e al <= dal + 1 anno
--                      RLS: legge solo e_staff(); nessuna scrittura diretta.
--   chiusure_lezioni   chiusura_id → chiusure on delete cascade
--                      · sessione_id → sessioni on delete cascade · primary key (sessione_id)
--                      · stato_prima stato_sessione not null
--                      RLS: legge solo e_staff(); nessuna scrittura diretta.
--   chiudi_palestra(dal date, al date, sala uuid default null, solo_contare boolean default false)
--                      returns jsonb { lezioni, straordinarie, con_appello: [{corso, inizio, prova}], id }
--                      · security definer, solo e_staff() (se no, eccezione)
--                      · il giorno di una lezione è `(inizio at time zone 'Europe/Rome')::date`
--                      · tocca solo le lezioni non annullate; straordinarie = ricorrenza_id null
--                      · con solo_contare non scrive niente (id null)
--   togli_chiusura(id uuid) returns int
--                      · rimette `stato_prima` alle lezioni legate che sono ancora annullate,
--                        cancella la chiusura, restituisce quante ne ha rimesse · solo e_staff()
--   Trigger AFTER INSERT su sessioni: una lezione dell'orario (ricorrenza_id non null) in un
--   giorno chiuso (chiusura di tutte le sale, o di quella sala) nasce annullata e legata
--   alla chiusura (stato_prima 'prevista'); una straordinaria (ricorrenza_id null) resta prevista.
--
-- Tutto in UTC, di proposito: il giorno di una lezione dev'essere quello italiano,
-- non quello di `timestamptz::date`.
\set ON_ERROR_STOP on
set timezone = 'UTC';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'maura@ods.it'),
  ('33333333-3333-3333-3333-333333333333', 'luca@ods.it');
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Maura', 'Uno', 'istruttore', 'maura@ods.it', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Luca', 'Rossi', 'iscritto', 'luca@ods.it', '33333333-3333-3333-3333-333333333333'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'Sara', 'Rossi', 'iscritto', null, null);

insert into sale (id, nome) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Tatami'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Lotta');
insert into corsi (id, nome, sala_id, istruttore_id) values
  ('cccccccc-0000-0000-0000-000000000001', 'Judo', 'bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002'),
  ('cccccccc-0000-0000-0000-000000000002', 'Pesi', 'bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002');
-- Judo il lunedì alle 18, Pesi il mercoledì alle 19.
insert into ricorrenze (id, corso_id, giorno, ora, durata_min, dal) values
  ('dddddddd-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 1, '18:00', 60, '2030-01-01'),
  ('dddddddd-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000002', 3, '19:00', 60, '2030-01-01');

-- Il periodo P è da lunedì 4 a giovedì 7 marzo 2030, ora italiana (+01 a marzo).
--   s1 Judo, lunedì 18:00, Tatami: con una presenza
--   s2 Pesi, martedì 19:00, Lotta: con una prova
--   s3 Judo, mercoledì 18:00: già annullata a mano
--   s4 Pesi, mercoledì 20:00: straordinaria
--   s5 Judo, giovedì 23:30: l'ultimo minuto utile di P (22:30 UTC, ancora il 7)
--   s6 Judo, venerdì 00:30: l'8 in Italia, ma il 7 in UTC: fuori da P
--   s8 Pesi, lunedì 19:00: già svolta
insert into sessioni (id, corso_id, ricorrenza_id, inizio, fine, sala_id, stato) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001', '2030-03-04 18:00+01', '2030-03-04 19:00+01', 'bbbbbbbb-0000-0000-0000-000000000001', 'prevista'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-000000000002', '2030-03-05 19:00+01', '2030-03-05 20:00+01', 'bbbbbbbb-0000-0000-0000-000000000002', 'prevista'),
  ('eeeeeeee-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001', '2030-03-06 18:00+01', '2030-03-06 19:00+01', 'bbbbbbbb-0000-0000-0000-000000000001', 'annullata'),
  ('eeeeeeee-0000-0000-0000-000000000004', 'cccccccc-0000-0000-0000-000000000002', null,                                   '2030-03-06 20:00+01', '2030-03-06 21:00+01', 'bbbbbbbb-0000-0000-0000-000000000002', 'prevista'),
  ('eeeeeeee-0000-0000-0000-000000000005', 'cccccccc-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001', '2030-03-07 23:30+01', '2030-03-08 00:20+01', 'bbbbbbbb-0000-0000-0000-000000000001', 'prevista'),
  ('eeeeeeee-0000-0000-0000-000000000006', 'cccccccc-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001', '2030-03-08 00:30+01', '2030-03-08 01:20+01', 'bbbbbbbb-0000-0000-0000-000000000001', 'prevista'),
  ('eeeeeeee-0000-0000-0000-000000000008', 'cccccccc-0000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-000000000002', '2030-03-04 19:00+01', '2030-03-04 20:00+01', 'bbbbbbbb-0000-0000-0000-000000000002', 'svolta');
insert into presenze (sessione_id, persona_id, stato) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003', 'presente');
insert into prove (sessione_id, persona_id) values
  ('eeeeeeee-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000004');

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
create or replace function atteso(cosa text, avuto text, voluto text) returns text language plpgsql as $$
begin
  if avuto is distinct from voluto and not (voluto like '%…' and avuto like replace(voluto, '…', '%')) then
    raise exception '% · atteso «%», avuto «%»', cosa, voluto, avuto;
  end if;
  return 'ok  ' || cosa || ' → ' || avuto;
end $$;
-- Lo stato di una lezione, col suo numero (s1…s8): più corto da leggere.
create or replace function st(n int) returns text language sql stable as $$
  select stato::text from sessioni where id = ('eeeeeeee-0000-0000-0000-00000000000' || n)::uuid
$$;
grant execute on function tenta(text), atteso(text, text, text), chi(text), st(int) to anon, authenticated;

\echo ''
\echo '--- 1 e 2. la segreteria conta: non cambia niente ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('conta le lezioni del periodo, ora italiana, senza la annullata e senza quella dell''8',
  (chiudi_palestra('2030-03-04', '2030-03-07', null, true))->>'lezioni', '5');
select atteso('e a parte le straordinarie', (chiudi_palestra('2030-03-04', '2030-03-07', null, true))->>'straordinarie', '1');
select atteso('elenca quelle con appello o prova, per corso, nell''ordine dei giorni',
  (select string_agg(x->>'corso' || ':' || (x->>'prova'), ',' order by x->>'inizio') from jsonb_array_elements(chiudi_palestra('2030-03-04', '2030-03-07', null, true)->'con_appello') x),
  'Judo:false,Pesi:true');
select atteso('contare non ricorda niente: nessun id', (chiudi_palestra('2030-03-04', '2030-03-07', null, true))->>'id', null);
select atteso('nessuna chiusura scritta', (select count(*)::text from chiusure), '0');
select atteso('nessuna lezione legata', (select count(*)::text from chiusure_lezioni), '0');
select atteso('le lezioni sono come prima', st(1) || ' ' || st(2) || ' ' || st(3) || ' ' || st(4) || ' ' || st(5) || ' ' || st(6) || ' ' || st(8),
  'prevista prevista annullata prevista prevista prevista svolta');
select atteso('una sala sola: solo le sue (Tatami: s1 e s5)', (chiudi_palestra('2030-03-04', '2030-03-07', 'bbbbbbbb-0000-0000-0000-000000000001', true))->>'lezioni', '2');
select atteso('un periodo senza lezioni conta zero', (chiudi_palestra('2030-07-01', '2030-07-05', null, true))->>'lezioni', '0');

\echo ''
\echo '--- 1. i rifiuti: AL prima di DAL, oltre un anno ---'
select atteso('AL prima di DAL no', tenta($$select chiudi_palestra('2030-03-07', '2030-03-04', null, true)::text$$), 'NEGATO: …');
select atteso('nemmeno per chiudere davvero', tenta($$select chiudi_palestra('2030-03-07', '2030-03-04')::text$$), 'NEGATO: …');
select atteso('24/12/2030 → 24/12/2031 (un anno preciso) si conta', (chiudi_palestra('2030-12-24', '2031-12-24', null, true))->>'lezioni', '0');
select atteso('fino al 25/12/2031 no', tenta($$select chiudi_palestra('2030-12-24', '2031-12-25', null, true)::text$$), 'NEGATO: …');
select atteso('nemmeno per chiudere', tenta($$select chiudi_palestra('2030-12-24', '2031-12-25')::text$$), 'NEGATO: …');
select atteso('la tabella non si scrive a mano, nemmeno dalla segreteria',
  tenta($$insert into chiusure (dal, al) values ('2030-03-04', '2030-03-07')$$), 'NEGATO: …');
select atteso('né quella delle lezioni legate',
  tenta($$insert into chiusure_lezioni (chiusura_id, sessione_id, stato_prima) values (gen_random_uuid(), 'eeeeeeee-0000-0000-0000-000000000001', 'prevista')$$), 'NEGATO: …');
reset role;
-- Il vincolo della tabella tiene anche per chi la scrive da dentro.
select atteso('il vincolo: AL prima di DAL no', tenta($$insert into chiusure (dal, al) values ('2030-03-07', '2030-03-04')$$), 'NEGATO: …');
select atteso('il vincolo: un anno e un giorno no', tenta($$insert into chiusure (dal, al) values ('2030-12-24', '2031-12-25')$$), 'NEGATO: …');
select atteso('il vincolo: un anno preciso sì', tenta($$insert into chiusure (dal, al) values ('2030-12-24', '2031-12-24')$$), 'FATTO (1 righe)');
delete from chiusure;

\echo ''
\echo '--- 4, 5 e 7. chiude una sala sola, poi tutte: le presenze e le prove restano ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select (chiudi_palestra('2030-03-04', '2030-03-07', 'bbbbbbbb-0000-0000-0000-000000000001')->>'id') as id_t \gset
select atteso('chiudere il Tatami annulla s1 e s5', st(1) || ' ' || st(5), 'annullata annullata');
select atteso('la Lotta no', st(2) || ' ' || st(4) || ' ' || st(8), 'prevista prevista svolta');
select atteso('ricorda sala e chi l''ha decisa', (select (sala_id = 'bbbbbbbb-0000-0000-0000-000000000001' and creata_da = 'aaaaaaaa-0000-0000-0000-000000000001')::text from chiusure where id = :'id_t'), 'true');
select atteso('e le due lezioni com''erano', (select string_agg(stato_prima::text, ',') from chiusure_lezioni where chiusura_id = :'id_t'), 'prevista,prevista');
select atteso('contando di nuovo tutte: le già annullate dalla chiusura non contano (3)', (chiudi_palestra('2030-03-04', '2030-03-07', null, true))->>'lezioni', '3');
select (chiudi_palestra('2030-03-04', '2030-03-07'))->>'lezioni' as quante \gset
select atteso('chiudere tutte annulla le 3 contate, con appello e prova', :'quante', '3');
select (select id::text from chiusure where sala_id is null) as id_p \gset
select atteso('non resta niente di previsto nel periodo', st(1) || ' ' || st(2) || ' ' || st(4) || ' ' || st(5) || ' ' || st(8),
  'annullata annullata annullata annullata annullata');
select atteso('quella fuori dal periodo (l''8 in Italia) non si tocca', st(6), 'prevista');
select atteso('quella annullata a mano non è legata a nessuna chiusura', (select count(*)::text from chiusure_lezioni where sessione_id = 'eeeeeeee-0000-0000-0000-000000000003'), '0');
select atteso('la svolta è ricordata come svolta', (select stato_prima::text from chiusure_lezioni where sessione_id = 'eeeeeeee-0000-0000-0000-000000000008'), 'svolta');
select atteso('la straordinaria si annulla e si ricorda prevista', (select stato_prima::text from chiusure_lezioni where sessione_id = 'eeeeeeee-0000-0000-0000-000000000004'), 'prevista');
select atteso('la presenza di s1 c''è ancora', (select count(*)::text from presenze where sessione_id = 'eeeeeeee-0000-0000-0000-000000000001'), '1');
select atteso('e la prova di s2', (select count(*)::text from prove where sessione_id = 'eeeeeeee-0000-0000-0000-000000000002'), '1');
select atteso('le chiusure ricordate: due, con 2 e 3 lezioni', (select string_agg(n::text, ',' order by n) from (select count(*) n from chiusure_lezioni group by chiusura_id) x), '2,3');
reset role;

\echo ''
\echo '--- 8. le lezioni create dopo in un giorno chiuso nascono annullate ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
-- Q: tutte le sale, mer 13 e lun 11 marzo (nessuna lezione ancora). R: il Tatami, lun 18 marzo.
select (chiudi_palestra('2030-03-11', '2030-03-13')->>'id') as id_q \gset
select (chiudi_palestra('2030-03-18', '2030-03-18', 'bbbbbbbb-0000-0000-0000-000000000001')->>'id') as id_r \gset
select atteso('una chiusura senza lezioni si ricorda lo stesso', (select count(*)::text from chiusure), '4');
-- Il calendario che si allunga: crea Pesi mer 6 (in P), Judo lun 11 e Pesi mer 13 (in Q), Judo lun 18 (Tatami, in R), Pesi mer 20 (aperto).
select atteso('la segreteria rigenera', materializza_sessioni('2030-03-04', '2030-03-20')::text, '5');
reset role;
create or replace function nuova(g text, c text) returns text language sql stable as $$
  select s.stato::text || ':' || coalesce((select l.chiusura_id::text from chiusure_lezioni l where l.sessione_id = s.id), '-')
  from sessioni s where (s.inizio at time zone 'Europe/Rome')::date = g::date and s.corso_id = ('cccccccc-0000-0000-0000-00000000000' || c)::uuid and s.ricorrenza_id is not null
$$;
select atteso('Pesi mer 6 marzo, dentro P: annullata e legata a P', nuova('2030-03-06', '2'), 'annullata:' || :'id_p');
select atteso('Judo lun 11, dentro Q: annullata e legata a Q', nuova('2030-03-11', '1'), 'annullata:' || :'id_q');
select atteso('Pesi mer 13, dentro Q', nuova('2030-03-13', '2'), 'annullata:' || :'id_q');
select atteso('Judo lun 18, in Tatami, dentro R', nuova('2030-03-18', '1'), 'annullata:' || :'id_r');
select atteso('Pesi mer 20, nessuna chiusura: prevista', nuova('2030-03-20', '2'), 'prevista:-');
select atteso('il conto di P è salito a 4 lezioni legate', (select count(*)::text from chiusure_lezioni where chiusura_id = :'id_p'), '4');

\echo ''
\echo '--- 8. la chiusura di una sala non tocca le altre sale ---'
select (chiudi_palestra('2030-03-25', '2030-03-25', 'bbbbbbbb-0000-0000-0000-000000000001')->>'id') as id_s \gset
select materializza_sessioni('2030-03-25', '2030-03-27');
select atteso('lunedì 25 il Judo (Tatami) nasce annullato', nuova('2030-03-25', '1'), 'annullata:' || :'id_s');
select atteso('mercoledì 27 niente chiusura: Pesi previsto', nuova('2030-03-27', '2'), 'prevista:-');
select atteso('se fosse stata la Lotta, il Judo di lunedì 25 sarebbe previsto: la chiusura è legata alla sala',
  (select (sala_id = 'bbbbbbbb-0000-0000-0000-000000000001')::text from chiusure where id = :'id_s'), 'true');

\echo ''
\echo '--- 9. una straordinaria in un giorno chiuso nasce prevista ---'
insert into sessioni (id, corso_id, ricorrenza_id, inizio, fine, sala_id) values
  ('eeeeeeee-0000-0000-0000-000000000009', 'cccccccc-0000-0000-0000-000000000002', null, '2030-03-12 20:00+01', '2030-03-12 21:00+01', 'bbbbbbbb-0000-0000-0000-000000000002');
select atteso('martedì 12, dentro Q: resta prevista', st(9), 'prevista');
select atteso('e non è legata', (select count(*)::text from chiusure_lezioni where sessione_id = 'eeeeeeee-0000-0000-0000-000000000009'), '0');

\echo ''
\echo '--- 12. chi non è staff: niente chiusure, non chiude, non toglie ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('l''istruttore non legge le chiusure', (select count(*)::text from chiusure), '0');
select atteso('né le lezioni legate', (select count(*)::text from chiusure_lezioni), '0');
select atteso('non conta', tenta($$select chiudi_palestra('2030-04-01', '2030-04-05', null, true)::text$$), 'NEGATO: …');
select atteso('non chiude', tenta($$select chiudi_palestra('2030-04-01', '2030-04-05')::text$$), 'NEGATO: …');
select atteso('non toglie', tenta($$select togli_chiusura('$$ || :'id_q' || $$')::text$$), 'NEGATO: …');
select atteso('non scrive la tabella', tenta($$delete from chiusure$$), 'NEGATO: …');
reset role;
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('l''iscritto non legge le chiusure', (select count(*)::text from chiusure), '0');
select atteso('né le lezioni legate', (select count(*)::text from chiusure_lezioni), '0');
select atteso('non conta', tenta($$select chiudi_palestra('2030-04-01', '2030-04-05', null, true)::text$$), 'NEGATO: …');
select atteso('non chiude', tenta($$select chiudi_palestra('2030-04-01', '2030-04-05')::text$$), 'NEGATO: …');
select atteso('non toglie', tenta($$select togli_chiusura('$$ || :'id_q' || $$')::text$$), 'NEGATO: …');
reset role;
-- Il tablet di una sala: è autenticato, ma non è la segreteria.
insert into auth.users (id, email) values ('66666666-6666-6666-6666-666666666666', 'tablet@ods.it');
insert into postazioni (id, nome, sala_id, utente_id) values
  ('ffffffff-0000-0000-0000-000000000001', 'Tablet Tatami', 'bbbbbbbb-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666666');
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('il tablet non legge le chiusure', (select count(*)::text from chiusure), '0');
select atteso('né le lezioni legate', (select count(*)::text from chiusure_lezioni), '0');
select atteso('non conta', tenta($$select chiudi_palestra('2030-04-01', '2030-04-05', null, true)::text$$), 'NEGATO: …');
select atteso('non chiude', tenta($$select chiudi_palestra('2030-04-01', '2030-04-05')::text$$), 'NEGATO: …');
select atteso('non toglie', tenta($$select togli_chiusura('$$ || :'id_q' || $$')::text$$), 'NEGATO: …');
reset role;
select chi('');
set role anon;
select atteso('anon non legge le chiusure', tenta($$select count(*)::text from chiusure$$), 'NEGATO: …');
select atteso('né le lezioni legate', tenta($$select count(*)::text from chiusure_lezioni$$), 'NEGATO: …');
select atteso('anon non conta', tenta($$select chiudi_palestra('2030-04-01', '2030-04-05', null, true)::text$$), 'NEGATO: …');
select atteso('anon non chiude', tenta($$select chiudi_palestra('2030-04-01', '2030-04-05')::text$$), 'NEGATO: …');
select atteso('anon non toglie', tenta($$select togli_chiusura('$$ || :'id_q' || $$')::text$$), 'NEGATO: …');
reset role;
select atteso('di tutto questo non è cambiato niente: ancora 5 chiusure', (select count(*)::text from chiusure), '5');
select atteso('e le lezioni di P sono ancora annullate', st(1) || ' ' || st(2), 'annullata annullata');

\echo ''
\echo '--- 11. togliere: le lezioni tornano com''erano, quelle annullate a mano restano ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria legge le chiusure', (select count(*)::text from chiusure), '5');
-- Una lezione legata a P rimessa a mano (s2): togliere non la tocca e non la conta.
update sessioni set stato = 'prevista' where id = 'eeeeeeee-0000-0000-0000-000000000002';
-- Poi la segreteria la annulla di nuovo, a mano: è una decisione sua, togliere P non la rimette.
update sessioni set stato = 'annullata' where id = 'eeeeeeee-0000-0000-0000-000000000002';
select atteso('togliere P rimette 3 lezioni: s4, s8 e la nuova di mercoledì 6 (s2 l''aveva già rimessa la segreteria)',
  (togli_chiusura(:'id_p'))::text, '3');
select atteso('la svolta torna svolta, non prevista', st(8), 'svolta');
select atteso('la straordinaria torna prevista', st(4), 'prevista');
select atteso('quella rimessa a mano e poi annullata di nuovo a mano resta annullata', st(2), 'annullata');
select atteso('quella annullata a mano prima di P resta annullata', st(3), 'annullata');
select atteso('il Tatami, di un''altra chiusura, resta annullato', st(1) || ' ' || st(5), 'annullata annullata');
select atteso('la chiusura non c''è più', (select count(*)::text from chiusure where id = :'id_p'), '0');
select atteso('e nemmeno le sue lezioni legate', (select count(*)::text from chiusure_lezioni where chiusura_id = :'id_p'), '0');
select atteso('la presenza di s1 c''è ancora', (select count(*)::text from presenze where sessione_id = 'eeeeeeee-0000-0000-0000-000000000001'), '1');
select atteso('e la prova di s2', (select count(*)::text from prove where sessione_id = 'eeeeeeee-0000-0000-0000-000000000002'), '1');
select atteso('togliere il Tatami rimette s1 e s5', (togli_chiusura(:'id_t'))::text, '2');
select atteso('sono previste', st(1) || ' ' || st(5), 'prevista prevista');
select atteso('s3, annullata a mano, no', st(3), 'annullata');
-- Rimessa a mano dopo la chiusura: togliere non la conta (la chiusura Q ha il Judo dell'11 e i Pesi del 13).
update sessioni set stato = 'prevista' where id = (select sessione_id from chiusure_lezioni where chiusura_id = :'id_q' limit 1);
select atteso('togliere Q rimette una sola lezione, l''altra era già tornata', (togli_chiusura(:'id_q'))::text, '1');
select atteso('la straordinaria di Q non c''entra: prevista', st(9), 'prevista');
select atteso('togliere R: una lezione', (togli_chiusura(:'id_r'))::text, '1');
select atteso('togliere una chiusura che non c''è dà un errore', tenta($$select togli_chiusura(gen_random_uuid())::text$$), 'NEGATO: …');
select atteso('restano solo quelle che non ho tolto: la chiusura di lunedì 25', (select count(*)::text from chiusure), '1');

\echo ''
\echo '--- 13. due chiusure sullo stesso giorno: togliere la prima lascia la lezione alla seconda ---'
-- s7, Judo straordinario lunedì 15 aprile sul Tatami: chiusa prima la sala (B1), poi tutta la palestra (B2).
insert into sessioni (id, corso_id, ricorrenza_id, inizio, fine, sala_id) values
  ('eeeeeeee-0000-0000-0000-000000000007', 'cccccccc-0000-0000-0000-000000000001', null, '2030-04-15 18:00+02', '2030-04-15 19:00+02', 'bbbbbbbb-0000-0000-0000-000000000001');
select (chiudi_palestra('2030-04-15', '2030-04-15', 'bbbbbbbb-0000-0000-0000-000000000001')->>'id') as id_b1 \gset
select (chiudi_palestra('2030-04-14', '2030-04-16')->>'id') as id_b2 \gset
select atteso('togliere la chiusura della sala non rimette niente: il 15 è ancora chiuso', (togli_chiusura(:'id_b1'))::text, '0');
select atteso('s7 resta annullata', st(7), 'annullata');
select atteso('ed è della chiusura di tutta la palestra', (select chiusura_id::text from chiusure_lezioni where sessione_id = 'eeeeeeee-0000-0000-0000-000000000007'), :'id_b2');
select atteso('togliere anche quella la rimette', (togli_chiusura(:'id_b2'))::text, '1');
select atteso('s7 prevista', st(7), 'prevista');
reset role;

\echo ''
\echo '--- la sala se ne va, la sua chiusura con lei; la lezione resta com''è ---'
delete from sale where id = 'bbbbbbbb-0000-0000-0000-000000000001';
select atteso('nessuna chiusura di una sala che non c''è più', (select count(*)::text from chiusure), '0');
select atteso('e le lezioni legate se ne vanno con lei', (select count(*)::text from chiusure_lezioni), '0');
