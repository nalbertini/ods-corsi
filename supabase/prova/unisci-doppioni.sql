-- Unire due schede della stessa persona: i doppioni nati quando chi faceva
-- l'appello non ritrovava chi era già venuto a provare e lo aggiungeva di
-- nuovo. Lo fa solo la segreteria, solo fra due iscritti senza accesso; resta
-- la prima scheda, con tutto quello che aveva la seconda, e la seconda se ne
-- va. Tutto o niente.
-- Si lancia dopo finto-supabase.sql, i file dello schema e
-- 29-unisci-doppioni.sql.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'maura@ods.it'),
  ('33333333-3333-3333-3333-333333333333', 'luca@ods.it'),
  ('44444444-4444-4444-4444-444444444444', 'dario@ods.it'),
  ('66666666-6666-6666-6666-666666666666', 'lotta@sale.ods-corsi.it');
insert into persone (id, nome, cognome, ruolo, email, telefono, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', 'anna@ods.it', null, '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Maura', 'Uno', 'istruttore', 'maura@ods.it', null, '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Luca', 'Rossi', 'iscritto', 'luca@ods.it', null, '33333333-3333-3333-3333-333333333333'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'Dario', 'Doppio', 'staff', 'dario@ods.it', null, '44444444-4444-4444-4444-444444444444'),
  -- La scheda che resta, e il doppione fatto all'appello.
  ('aaaaaaaa-0000-0000-0000-000000000010', 'Mario', 'D''Amico', 'iscritto', null, null, null),
  ('aaaaaaaa-0000-0000-0000-000000000011', 'Mario', 'Damico', 'iscritto', 'mario@ods.it', '333 1234567', null),
  -- Due Sara Bianchi con due codici fiscali: omonime, non doppioni.
  ('aaaaaaaa-0000-0000-0000-000000000012', 'Sara', 'Bianchi', 'iscritto', null, null, null),
  ('aaaaaaaa-0000-0000-0000-000000000013', 'Sara', 'Bianchi', 'iscritto', null, null, null),
  -- Ha un file del certificato: passa a chi resta (sezione 11).
  ('aaaaaaaa-0000-0000-0000-000000000014', 'Mario', 'Damico', 'iscritto', null, null, null),
  -- Due email diverse: vince chi resta.
  ('aaaaaaaa-0000-0000-0000-000000000015', 'Elena', 'Verdi', 'iscritto', 'elena@ods.it', null, null),
  ('aaaaaaaa-0000-0000-0000-000000000016', 'Elena', 'Verdi', 'iscritto', 'elena.verdi@ods.it', null, null),
  -- Per il «tutto o niente».
  ('aaaaaaaa-0000-0000-0000-000000000017', 'Teo', 'Neri', 'iscritto', null, null, null),
  ('aaaaaaaa-0000-0000-0000-000000000018', 'Teo', 'Neri', 'iscritto', null, '333 7654321', null);
update persone set anche_istruttore = true where id = 'aaaaaaaa-0000-0000-0000-000000000004';
insert into sale (id, nome) values ('bbbbbbbb-0000-0000-0000-000000000001', 'Lotta');
insert into postazioni (id, nome, sala_id, utente_id) values
  ('dddddddd-0000-0000-0000-000000000001', 'Tablet Lotta', 'bbbbbbbb-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666666');
insert into corsi (id, nome, sala_id, istruttore_id) values
  ('cccccccc-0000-0000-0000-000000000001', 'Lotta', 'bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002'),
  ('cccccccc-0000-0000-0000-000000000002', 'Judo', 'bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002'),
  ('cccccccc-0000-0000-0000-000000000003', 'Pesi', 'bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002');
insert into sessioni (id, corso_id, inizio, fine, stato) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', now() - interval '14 days', now() - interval '14 days' + interval '1 hour', 'svolta'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000001', now() - interval '7 days', now() - interval '7 days' + interval '1 hour', 'svolta'),
  ('eeeeeeee-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-000000000002', now() - interval '3 days', now() - interval '3 days' + interval '1 hour', 'svolta');

-- Le presenze: nella lezione 1 tutti e due (vince presente), nella 2 tutti e
-- due (vince giustificato), nella 3, chiusa, solo il doppione.
insert into presenze (sessione_id, persona_id, stato) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000010', 'assente'),
  ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000011', 'presente'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000010', 'giustificato'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000011', 'assente'),
  ('eeeeeeee-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000018', 'presente');
-- Quella della lezione chiusa l'ha segnata il tablet.
insert into presenze (sessione_id, persona_id, stato, origine, postazione_id) values
  ('eeeeeeee-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000011', 'presente', 'tablet', 'dddddddd-0000-0000-0000-000000000001');
-- Le prove: la lezione 1 tutti e due, la 3 solo il doppione.
insert into prove (sessione_id, persona_id, nuova) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000010', true),
  ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000011', true),
  ('eeeeeeee-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000011', false);
-- Le iscrizioni: Lotta tutti e due (una senza fine), Judo solo il doppione,
-- Pesi tutti e due con due fini diverse.
insert into iscrizioni (corso_id, persona_id, dal, al) values
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000010', '2026-01-10', '2026-06-30'),
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000011', '2025-09-01', null),
  ('cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000011', '2026-09-14', '2027-06-30'),
  ('cccccccc-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000010', '2026-02-01', '2026-03-31'),
  ('cccccccc-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000011', '2026-03-01', '2026-12-31');
-- La quota pagata, con la ricevuta intestata al doppione.
insert into ricevute (id, anno, numero, data, persona_id, ente, intestatario, voci, totale, pagato) values
  ('ffffffff-0000-0000-0000-000000000001', 2026, 5, '2026-09-10', 'aaaaaaaa-0000-0000-0000-000000000011',
   '{"nome": "Asd Il Centro Judo"}', '{"nome": "Mario", "cognome": "Damico"}',
   jsonb_build_array(jsonb_build_object('descrizione', 'QUOTA ASSOCIATIVA', 'quantita', 1, 'prezzo', 5000,
     'dal', (current_date - 30)::text, 'al', (current_date + 300)::text,
     'pagamenti', jsonb_build_array(jsonb_build_object('data', '2026-09-10', 'importo', 5000, 'metodo', 'Contanti')))),
   5000, 5000);
insert into richieste_iscrizione (nome, cognome, nato_il, nato_a, codice_fiscale, indirizzo, cap, comune, email, telefono, corsi, formula, stato, persona_id) values
  ('Mario', 'Damico', '2010-01-01', 'Torino', 'DMCMRA10A01L219X', 'via Roma 1', '10093', 'Collegno', 'mario@ods.it', '3331234567',
   array['cccccccc-0000-0000-0000-000000000002']::uuid[], 'annuale', 'accolta', 'aaaaaaaa-0000-0000-0000-000000000011');
-- Scheda e anagrafica: vince chi resta, il doppione riempie i vuoti; le due
-- scadenze, la più lontana.
insert into schede_iscritti (persona_id, certificato_scade, pagamento, pagato_fino, pagamento_nota, certificato_file) values
  ('aaaaaaaa-0000-0000-0000-000000000010', '2026-12-31', 'pagato', '2026-10-31', null, null),
  ('aaaaaaaa-0000-0000-0000-000000000011', '2027-05-31', 'pagato', '2027-01-31', 'carta n. 12', null),
  ('aaaaaaaa-0000-0000-0000-000000000014', '2027-01-31', 'da_pagare', null, null, 'aaaaaaaa-0000-0000-0000-000000000014/certificato-1.pdf');
-- Il contenitore dei certificati, se `45-certificati-online.sql` non l'ha già fatto.
insert into storage.buckets (id, name, public) values ('certificati', 'certificati', false) on conflict (id) do nothing;
insert into storage.objects (bucket_id, name) values ('certificati', 'aaaaaaaa-0000-0000-0000-000000000014/certificato-1.pdf');
insert into anagrafiche (persona_id, comune, codice_fiscale, cap, genitore_nome) values
  ('aaaaaaaa-0000-0000-0000-000000000010', 'Collegno', null, null, null),
  ('aaaaaaaa-0000-0000-0000-000000000011', 'Rivoli', 'DMCMRA10A01L219X', '10098', 'Anna'),
  ('aaaaaaaa-0000-0000-0000-000000000012', null, 'BNCSRA10A41L219X', null, null),
  ('aaaaaaaa-0000-0000-0000-000000000013', null, 'BNCSRA12B41L219Y', null, null);

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
-- Il codice dell'errore, per dire «non hai il permesso» (42501) e non un'altra cosa.
create or replace function codice(sql text) returns text language plpgsql as $$
begin
  execute sql;
  return 'nessun errore';
exception when others then return sqlstate;
end $$;
-- Un rifiuto con un messaggio della funzione, non una funzione che manca o un permesso.
create or replace function rifiuta(sql text) returns text language plpgsql as $$
begin
  execute sql;
  return 'nessun errore';
exception when others then
  if sqlstate in ('42883', '42501', '42P01', '42703', '42601') then return sqlstate || ': ' || sqlerrm; end if;
  return 'RIFIUTATO: ' || sqlerrm;
end $$;
create or replace function atteso(cosa text, avuto text, voluto text) returns text language plpgsql as $$
begin
  if avuto is distinct from voluto and not (voluto like '%…' and avuto like replace(voluto, '…', '%')) then
    raise exception '% · atteso «%», avuto «%»', cosa, voluto, avuto;
  end if;
  return 'ok  ' || cosa || ' → ' || avuto;
end $$;
grant execute on function tenta(text), codice(text), rifiuta(text), atteso(text, text, text), chi(text) to anon, authenticated;

\echo ''
\echo '--- 1. chi non è della segreteria non unisce ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('un istruttore no', codice($$select unisci_persone('aaaaaaaa-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000011')$$), '42501');
select atteso('e nemmeno l''anteprima', codice($$select anteprima_unione('aaaaaaaa-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000011')$$), '42501');
reset role;
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('un iscritto no', codice($$select unisci_persone('aaaaaaaa-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000011')$$), '42501');
reset role;
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('il tablet no', codice($$select unisci_persone('aaaaaaaa-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000011')$$), '42501');
reset role;
select chi('');
set role anon;
select atteso('chi non ha accesso nemmeno la chiama', codice($$select unisci_persone('aaaaaaaa-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000011')$$), '42501');
select atteso('né l''anteprima', codice($$select anteprima_unione('aaaaaaaa-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000011')$$), '42501');
reset role;
select atteso('il doppione c''è ancora, con le sue presenze',
  (select count(*)::text from presenze where persona_id = 'aaaaaaaa-0000-0000-0000-000000000011'), '3');

\echo ''
\echo '--- 2. la segreteria: si uniscono solo due iscritti diversi, senza accesso ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('una scheda con se stessa no', rifiuta($$select unisci_persone('aaaaaaaa-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000010')$$), 'RIFIUTATO: …');
select atteso('un istruttore no', rifiuta($$select unisci_persone('aaaaaaaa-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000002')$$), 'RIFIUTATO: …');
select atteso('nemmeno come quella che resta', rifiuta($$select unisci_persone('aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000010')$$), 'RIFIUTATO: …');
select atteso('chi ha l''accesso no', rifiuta($$select unisci_persone('aaaaaaaa-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000003')$$), 'RIFIUTATO: …');
select atteso('una persona che non c''è no', rifiuta($$select unisci_persone('aaaaaaaa-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000099')$$), 'RIFIUTATO: …');

\echo ''
\echo '--- 3. la segreteria: due codici fiscali diversi ---'
select atteso('due codici fiscali diversi no', rifiuta($$select unisci_persone('aaaaaaaa-0000-0000-0000-000000000012', 'aaaaaaaa-0000-0000-0000-000000000013')$$),
  'RIFIUTATO: Hanno due codici fiscali diversi: non sono la stessa persona…');
select atteso('le due Sara restano', (select count(*)::text from persone where nome = 'Sara'), '2');

\echo ''
\echo '--- 4. l''anteprima dice cosa passa ---'
select atteso('presenze, prove, iscrizioni e ricevute del doppione',
  (select (j->>'presenze') || ' ' || (j->>'prove') || ' ' || (j->>'iscrizioni') || ' ' || (j->>'ricevute')
     from (select anteprima_unione('aaaaaaaa-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000011')::jsonb j) x),
  '3 2 3 1');
select atteso('e non cambia niente', (select count(*)::text from presenze where persona_id = 'aaaaaaaa-0000-0000-0000-000000000011'), '3');

\echo ''
\echo '--- 5. tutto o niente ---'
reset role;
-- Un intoppo all'ultimo passo, quando il doppione se ne va.
create function intoppo() returns trigger language plpgsql as $$
begin
  if old.id = 'aaaaaaaa-0000-0000-0000-000000000018' then raise exception 'intoppo'; end if;
  return old;
end $$;
create trigger intoppo before delete on persone for each row execute function intoppo();
set role authenticated;
select atteso('l''unione si ferma', rifiuta($$select unisci_persone('aaaaaaaa-0000-0000-0000-000000000017', 'aaaaaaaa-0000-0000-0000-000000000018')$$), 'RIFIUTATO: …');
select atteso('la presenza è ancora del doppione',
  (select count(*)::text from presenze where persona_id = 'aaaaaaaa-0000-0000-0000-000000000018'), '1');
select atteso('e il telefono non è passato', (select coalesce(telefono, 'nessuno') from persone where id = 'aaaaaaaa-0000-0000-0000-000000000017'), 'nessuno');
reset role;
drop trigger intoppo on persone;
set role authenticated;

\echo ''
\echo '--- 6. la segreteria unisce Mario Damico in Mario D''Amico ---'
select atteso('unite', tenta($$select 'fatto' from unisci_persone('aaaaaaaa-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000011')$$), 'fatto');
select atteso('il doppione non c''è più', (select count(*)::text from persone where id = 'aaaaaaaa-0000-0000-0000-000000000011'), '0');
select atteso('il nome resta quello di chi resta', (select nome || ' ' || cognome from persone where id = 'aaaaaaaa-0000-0000-0000-000000000010'), 'Mario D''Amico');
select atteso('email e telefono vuoti si riempiono dal doppione',
  (select email || ' ' || telefono from persone where id = 'aaaaaaaa-0000-0000-0000-000000000010'), 'mario@ods.it 333 1234567');

select atteso('le presenze: una per lezione, nelle tre lezioni',
  (select count(*)::text from presenze where persona_id = 'aaaaaaaa-0000-0000-0000-000000000010'), '3');
select atteso('presente vince su assente', (select stato::text from presenze
  where sessione_id = 'eeeeeeee-0000-0000-0000-000000000001' and persona_id = 'aaaaaaaa-0000-0000-0000-000000000010'), 'presente');
select atteso('giustificato vince su assente', (select stato::text from presenze
  where sessione_id = 'eeeeeeee-0000-0000-0000-000000000002' and persona_id = 'aaaaaaaa-0000-0000-0000-000000000010'), 'giustificato');
select atteso('quella della lezione chiusa passa', (select stato::text from presenze
  where sessione_id = 'eeeeeeee-0000-0000-0000-000000000003' and persona_id = 'aaaaaaaa-0000-0000-0000-000000000010'), 'presente');
select atteso('spostarla non è segnarla: chi l''ha segnata e da dove restano', (select coalesce(segnata_da::text, 'nessuno') || ' ' || origine from presenze
  where sessione_id = 'eeeeeeee-0000-0000-0000-000000000003' and persona_id = 'aaaaaaaa-0000-0000-0000-000000000010'), 'nessuno tablet');

select atteso('le prove: una per lezione',
  (select string_agg(sessione_id::text, ',' order by sessione_id) from prove where persona_id = 'aaaaaaaa-0000-0000-0000-000000000010'),
  'eeeeeeee-0000-0000-0000-000000000001,eeeeeeee-0000-0000-0000-000000000003');

select atteso('Lotta: una sola iscrizione, dalla più vecchia e senza fine',
  (select dal || ' ' || coalesce(al::text, 'senza fine') from iscrizioni
    where persona_id = 'aaaaaaaa-0000-0000-0000-000000000010' and corso_id = 'cccccccc-0000-0000-0000-000000000001'), '2025-09-01 senza fine');
select atteso('Judo passa', (select dal || ' ' || al from iscrizioni
    where persona_id = 'aaaaaaaa-0000-0000-0000-000000000010' and corso_id = 'cccccccc-0000-0000-0000-000000000002'), '2026-09-14 2027-06-30');
select atteso('Pesi: dalla più vecchia alla fine più lontana', (select dal || ' ' || al from iscrizioni
    where persona_id = 'aaaaaaaa-0000-0000-0000-000000000010' and corso_id = 'cccccccc-0000-0000-0000-000000000003'), '2026-02-01 2026-12-31');
select atteso('tre iscrizioni in tutto', (select count(*)::text from iscrizioni where persona_id = 'aaaaaaaa-0000-0000-0000-000000000010'), '3');

select atteso('la ricevuta passa, con lo stesso numero e lo stesso intestatario',
  (select anno || '/' || numero || ' ' || (intestatario->>'cognome') from ricevute where persona_id = 'aaaaaaaa-0000-0000-0000-000000000010'), '2026/5 Damico');
select atteso('e la quota pagata ora è sua',
  (select count(*)::text from quote_ricevute where persona_id = 'aaaaaaaa-0000-0000-0000-000000000010' and mancano = 0), '1');
select atteso('la richiesta di iscrizione passa',
  (select count(*)::text from richieste_iscrizione where persona_id = 'aaaaaaaa-0000-0000-0000-000000000010'), '1');

select atteso('la scheda: le due scadenze, la più lontana; la nota vuota si riempie',
  (select certificato_scade || ' ' || pagato_fino || ' ' || pagamento_nota from schede_iscritti where persona_id = 'aaaaaaaa-0000-0000-0000-000000000010'),
  '2027-05-31 2027-01-31 carta n. 12');
select atteso('l''anagrafica: vince chi resta, i vuoti dal doppione',
  (select comune || ' ' || codice_fiscale || ' ' || cap || ' ' || genitore_nome from anagrafiche where persona_id = 'aaaaaaaa-0000-0000-0000-000000000010'),
  'Collegno DMCMRA10A01L219X 10098 Anna');
select atteso('del doppione non resta niente',
  (select count(*)::text from (
     select persona_id from presenze union all select persona_id from prove union all select persona_id from iscrizioni
     union all select persona_id from schede_iscritti union all select persona_id from anagrafiche) x
   where persona_id = 'aaaaaaaa-0000-0000-0000-000000000011'), '0');
reset role;

\echo ''
\echo '--- 7. il ruolo doppio, e due email diverse ---'
select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('la segreteria che insegna anche unisce', tenta($$select 'fatto' from unisci_persone('aaaaaaaa-0000-0000-0000-000000000015', 'aaaaaaaa-0000-0000-0000-000000000016')$$), 'fatto');
select atteso('l''email di chi resta resta', (select string_agg(email::text, ',') from persone where nome = 'Elena'), 'elena@ods.it');
reset role;

\echo ''
\echo '--- 8. pagata fuori dall''app senza «fino»: pagata senza scadenza ---'
insert into persone (id, nome, cognome, ruolo) values
  ('aaaaaaaa-0000-0000-0000-000000000019', 'Ugo', 'Gialli', 'iscritto'),
  ('aaaaaaaa-0000-0000-0000-000000000020', 'Ugo', 'Gialli', 'iscritto'),
  ('aaaaaaaa-0000-0000-0000-000000000021', 'Ivo', 'Blu', 'iscritto'),
  ('aaaaaaaa-0000-0000-0000-000000000022', 'Ivo', 'Blu', 'iscritto');
insert into schede_iscritti (persona_id, pagamento, pagato_fino) values
  ('aaaaaaaa-0000-0000-0000-000000000019', 'pagato', null),
  ('aaaaaaaa-0000-0000-0000-000000000020', 'pagato', current_date - 30),
  ('aaaaaaaa-0000-0000-0000-000000000021', 'da_pagare', null),
  ('aaaaaaaa-0000-0000-0000-000000000022', 'pagato', null);
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('pagato senza scadenza e un doppione pagato fino a ieri: unite',
  tenta($$select 'fatto' from unisci_persone('aaaaaaaa-0000-0000-0000-000000000019', 'aaaaaaaa-0000-0000-0000-000000000020')$$), 'fatto');
select atteso('resta pagato senza scadenza',
  (select pagamento || ' ' || coalesce(pagato_fino::text, 'senza fine') from schede_iscritti where persona_id = 'aaaaaaaa-0000-0000-0000-000000000019'), 'pagato senza fine');
select atteso('da pagare e un doppione pagato senza scadenza: unite',
  tenta($$select 'fatto' from unisci_persone('aaaaaaaa-0000-0000-0000-000000000021', 'aaaaaaaa-0000-0000-0000-000000000022')$$), 'fatto');
select atteso('diventa pagato senza scadenza',
  (select pagamento || ' ' || coalesce(pagato_fino::text, 'senza fine') from schede_iscritti where persona_id = 'aaaaaaaa-0000-0000-0000-000000000021'), 'pagato senza fine');
reset role;

\echo ''
\echo '--- 9. il codice fiscale della richiesta accolta conta ---'
insert into persone (id, nome, cognome, ruolo) values
  ('aaaaaaaa-0000-0000-0000-000000000023', 'Luca', 'Verdi', 'iscritto'),
  ('aaaaaaaa-0000-0000-0000-000000000024', 'Luca', 'Verdi', 'iscritto');
insert into anagrafiche (persona_id, codice_fiscale) values ('aaaaaaaa-0000-0000-0000-000000000023', 'VRDLCU10A01L219X');
insert into richieste_iscrizione (nome, cognome, nato_il, nato_a, codice_fiscale, indirizzo, cap, comune, email, telefono, corsi, formula, stato, persona_id) values
  ('Luca', 'Verdi', '2012-02-01', 'Torino', 'VRDLCU12B01L219Y', 'via Po 2', '10093', 'Collegno', 'luca.verdi@ods.it', '3337654321',
   array['cccccccc-0000-0000-0000-000000000002']::uuid[], 'annuale', 'accolta', 'aaaaaaaa-0000-0000-0000-000000000024');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('un codice fiscale nella scheda e un altro solo nella richiesta accolta: no',
  rifiuta($$select unisci_persone('aaaaaaaa-0000-0000-0000-000000000023', 'aaaaaaaa-0000-0000-0000-000000000024')$$),
  'RIFIUTATO: Hanno due codici fiscali diversi: non sono la stessa persona…');
select atteso('e restano tutti e due', (select count(*)::text from persone where nome = 'Luca' and cognome = 'Verdi'), '2');
reset role;

\echo ''
\echo '--- 10. resta disattivata, se ne va attiva: la scheda unita è attiva ---'
insert into persone (id, nome, cognome, ruolo, attiva) values
  ('aaaaaaaa-0000-0000-0000-000000000025', 'Marco', 'D''Amico', 'iscritto', false),
  ('aaaaaaaa-0000-0000-0000-000000000026', 'Marco', 'Damico', 'iscritto', true);
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('unite', tenta($$select 'fatto' from unisci_persone('aaaaaaaa-0000-0000-0000-000000000025', 'aaaaaaaa-0000-0000-0000-000000000026')$$), 'fatto');
select atteso('la scheda unita è attiva', (select attiva::text from persone where id = 'aaaaaaaa-0000-0000-0000-000000000025'), 'true');
reset role;

\echo ''
\echo '--- 11. email di accesso e di contatto (44-email-contatto.sql) ---'
-- Chi resta tiene la sua email. Il contatto di chi resta vince, se manca
-- prende quello di chi se ne va. L'email di chi se ne va, se chi resta non ne
-- ha, la prende; se è diversa va nel contatto, quando c'è posto. Quando non c'è,
-- l'unione non si ferma: l'app lo dice prima, e qui si vede cosa resta.
insert into persone (id, nome, cognome, ruolo, email, email_contatto) values
  -- a. due email diverse, nessun contatto: l'altra diventa il contatto
  ('aaaaaaaa-0000-0000-0000-000000000027', 'Ada', 'Uno', 'iscritto', 'r1@ods.it', null),
  ('aaaaaaaa-0000-0000-0000-000000000028', 'Ada', 'Uno', 'iscritto', 'v1@ods.it', null),
  -- b. tutto pieno e diverso: resta quello di chi resta
  ('aaaaaaaa-0000-0000-0000-000000000029', 'Bea', 'Due', 'iscritto', 'r2@ods.it', 'cr2@esempio.it'),
  ('aaaaaaaa-0000-0000-0000-000000000030', 'Bea', 'Due', 'iscritto', 'v2@ods.it', 'cv2@esempio.it'),
  -- c. chi resta non ha niente: prende email e contatto di chi se ne va
  ('aaaaaaaa-0000-0000-0000-000000000031', 'Cleo', 'Tre', 'iscritto', null, null),
  ('aaaaaaaa-0000-0000-0000-000000000032', 'Cleo', 'Tre', 'iscritto', 'v3@ods.it', 'cv3@esempio.it'),
  -- d. email diverse e un solo posto per il contatto: vince il contatto di chi se ne va
  ('aaaaaaaa-0000-0000-0000-000000000033', 'Dino', 'Quattro', 'iscritto', 'r4@ods.it', null),
  ('aaaaaaaa-0000-0000-0000-000000000034', 'Dino', 'Quattro', 'iscritto', 'v4@ods.it', 'cv4@esempio.it'),
  -- e. chi se ne va ha solo il contatto
  ('aaaaaaaa-0000-0000-0000-000000000035', 'Eva', 'Cinque', 'iscritto', 'r5@ods.it', null),
  ('aaaaaaaa-0000-0000-0000-000000000036', 'Eva', 'Cinque', 'iscritto', null, 'cv5@esempio.it'),
  -- f. chi resta ha solo il contatto, chi se ne va solo l'email
  ('aaaaaaaa-0000-0000-0000-000000000037', 'Fio', 'Sei', 'iscritto', null, 'cr6@esempio.it'),
  ('aaaaaaaa-0000-0000-0000-000000000038', 'Fio', 'Sei', 'iscritto', 'v6@ods.it', null),
  -- g. l'email di chi se ne va è già il contatto di chi resta: non si perde
  ('aaaaaaaa-0000-0000-0000-000000000039', 'Gigi', 'Sette', 'iscritto', 'r7@ods.it', 'V7@ods.it'),
  ('aaaaaaaa-0000-0000-0000-000000000040', 'Gigi', 'Sette', 'iscritto', 'v7@ods.it', null);
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('a. unite', tenta($$select 'fatto' from unisci_persone('aaaaaaaa-0000-0000-0000-000000000027', 'aaaaaaaa-0000-0000-0000-000000000028')$$), 'fatto');
select atteso('a. chi resta tiene la sua email e l''altra diventa il contatto',
  (select email || ' · ' || coalesce(email_contatto::text, '—') from persone where id = 'aaaaaaaa-0000-0000-0000-000000000027'), 'r1@ods.it · v1@ods.it');
select atteso('b. unite', tenta($$select 'fatto' from unisci_persone('aaaaaaaa-0000-0000-0000-000000000029', 'aaaaaaaa-0000-0000-0000-000000000030')$$), 'fatto');
select atteso('b. senza posto non si ferma: restano email e contatto di chi resta',
  (select email || ' · ' || email_contatto from persone where id = 'aaaaaaaa-0000-0000-0000-000000000029'), 'r2@ods.it · cr2@esempio.it');
select atteso('c. unite', tenta($$select 'fatto' from unisci_persone('aaaaaaaa-0000-0000-0000-000000000031', 'aaaaaaaa-0000-0000-0000-000000000032')$$), 'fatto');
select atteso('c. chi resta senza niente prende email e contatto',
  (select email || ' · ' || email_contatto from persone where id = 'aaaaaaaa-0000-0000-0000-000000000031'), 'v3@ods.it · cv3@esempio.it');
select atteso('d. unite', tenta($$select 'fatto' from unisci_persone('aaaaaaaa-0000-0000-0000-000000000033', 'aaaaaaaa-0000-0000-0000-000000000034')$$), 'fatto');
select atteso('d. il contatto di chi se ne va prende il posto libero',
  (select email || ' · ' || email_contatto from persone where id = 'aaaaaaaa-0000-0000-0000-000000000033'), 'r4@ods.it · cv4@esempio.it');
select atteso('e. unite', tenta($$select 'fatto' from unisci_persone('aaaaaaaa-0000-0000-0000-000000000035', 'aaaaaaaa-0000-0000-0000-000000000036')$$), 'fatto');
select atteso('e. il contatto di chi se ne va, se chi resta non ne ha',
  (select email || ' · ' || email_contatto from persone where id = 'aaaaaaaa-0000-0000-0000-000000000035'), 'r5@ods.it · cv5@esempio.it');
select atteso('f. unite', tenta($$select 'fatto' from unisci_persone('aaaaaaaa-0000-0000-0000-000000000037', 'aaaaaaaa-0000-0000-0000-000000000038')$$), 'fatto');
select atteso('f. l''email di chi se ne va diventa l''email, e il contatto di chi resta resta',
  (select email || ' · ' || email_contatto from persone where id = 'aaaaaaaa-0000-0000-0000-000000000037'), 'v6@ods.it · cr6@esempio.it');
select atteso('g. unite', tenta($$select 'fatto' from unisci_persone('aaaaaaaa-0000-0000-0000-000000000039', 'aaaaaaaa-0000-0000-0000-000000000040')$$), 'fatto');
select atteso('g. l''email di chi se ne va è già il contatto di chi resta: resta com''è',
  (select email || ' · ' || email_contatto from persone where id = 'aaaaaaaa-0000-0000-0000-000000000039'), 'r7@ods.it · V7@ods.it');
select atteso('e le schede che se ne vanno sono sparite', (select count(*)::text from persone where id::text in
  ('aaaaaaaa-0000-0000-0000-000000000028', 'aaaaaaaa-0000-0000-0000-000000000030', 'aaaaaaaa-0000-0000-0000-000000000032',
   'aaaaaaaa-0000-0000-0000-000000000034', 'aaaaaaaa-0000-0000-0000-000000000036', 'aaaaaaaa-0000-0000-0000-000000000038',
   'aaaaaaaa-0000-0000-0000-000000000040')), '0');
reset role;

\echo '--- 12. il file del certificato passa a chi resta, e l''unione non si ferma ---'
-- Mario (10) non ha un file: quello del doppione (14, caricato prima della carta) è suo.
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('chi ha un file del certificato si unisce lo stesso',
  tenta($$select 'fatto' from unisci_persone('aaaaaaaa-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000014')$$), 'fatto');
select atteso('il file ora è nella cartella di chi resta',
  (select (certificato_file ~ '^aaaaaaaa-0000-0000-0000-000000000010/certificato-[0-9]+\.pdf$')::text from schede_iscritti where persona_id = 'aaaaaaaa-0000-0000-0000-000000000010'), 'true');
select atteso('e c''è davvero, uno solo, e nessuno nella cartella di chi se ne va',
  (select count(*) filter (where name = (select certificato_file from schede_iscritti where persona_id = 'aaaaaaaa-0000-0000-0000-000000000010'))
          || ' ' || count(*) filter (where name like 'aaaaaaaa-0000-0000-0000-000000000014/%') from storage.objects where bucket_id = 'certificati'), '1 0');
select atteso('è ancora un file di prima della carta: senza data di caricamento',
  (select (certificato_caricato_il is null)::text from schede_iscritti where persona_id = 'aaaaaaaa-0000-0000-0000-000000000010'), 'true');
reset role;

-- Due file: resta quello della scadenza più lontana, l'altro si cancella anche dal contenitore.
insert into persone (id, nome, cognome, ruolo) values
  ('aaaaaaaa-0000-0000-0000-000000000050', 'Rita', 'Bruni', 'iscritto'),
  ('aaaaaaaa-0000-0000-0000-000000000051', 'Rita', 'Bruni', 'iscritto'),
  ('aaaaaaaa-0000-0000-0000-000000000052', 'Dino', 'Neri', 'iscritto'),
  ('aaaaaaaa-0000-0000-0000-000000000053', 'Dino', 'Neri', 'iscritto');
insert into storage.objects (bucket_id, name) values
  ('certificati', 'aaaaaaaa-0000-0000-0000-000000000050/certificato-1.png'),
  ('certificati', 'aaaaaaaa-0000-0000-0000-000000000051/certificato-1.pdf'),
  ('certificati', 'aaaaaaaa-0000-0000-0000-000000000052/certificato-1.png'),
  ('certificati', 'aaaaaaaa-0000-0000-0000-000000000053/certificato-1.pdf');
insert into schede_iscritti (persona_id, certificato_scade, certificato_file, certificato_caricato_il) values
  ('aaaaaaaa-0000-0000-0000-000000000050', '2026-12-31', 'aaaaaaaa-0000-0000-0000-000000000050/certificato-1.png', now()),
  ('aaaaaaaa-0000-0000-0000-000000000051', '2027-03-31', 'aaaaaaaa-0000-0000-0000-000000000051/certificato-1.pdf', now()),
  ('aaaaaaaa-0000-0000-0000-000000000052', '2027-06-30', 'aaaaaaaa-0000-0000-0000-000000000052/certificato-1.png', now()),
  ('aaaaaaaa-0000-0000-0000-000000000053', '2027-01-31', 'aaaaaaaa-0000-0000-0000-000000000053/certificato-1.pdf', now());
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('due schede con un file ciascuna si uniscono',
  tenta($$select 'fatto' from unisci_persone('aaaaaaaa-0000-0000-0000-000000000050', 'aaaaaaaa-0000-0000-0000-000000000051')$$), 'fatto');
select atteso('il doppione ha la scadenza più lontana: il suo file, in cartella di chi resta, e la sua data',
  (select (certificato_file ~ '^aaaaaaaa-0000-0000-0000-000000000050/certificato-[0-9]+\.pdf$')::text || ' ' || certificato_scade from schede_iscritti where persona_id = 'aaaaaaaa-0000-0000-0000-000000000050'), 'true 2027-03-31');
select atteso('nel contenitore resta un file solo, e il png di chi restava non c''è più',
  (select count(*)::text from storage.objects where bucket_id = 'certificati' and (name like 'aaaaaaaa-0000-0000-0000-000000000050/%' or name like 'aaaaaaaa-0000-0000-0000-000000000051/%')), '1');
select atteso('due schede, e chi resta ha la scadenza più lontana: tiene il suo file',
  tenta($$select 'fatto' from unisci_persone('aaaaaaaa-0000-0000-0000-000000000052', 'aaaaaaaa-0000-0000-0000-000000000053')$$), 'fatto');
select atteso('è il suo png, con la sua data',
  (select (certificato_file ~ '^aaaaaaaa-0000-0000-0000-000000000052/certificato-[0-9]+\.png$')::text || ' ' || certificato_scade from schede_iscritti where persona_id = 'aaaaaaaa-0000-0000-0000-000000000052'), 'true 2027-06-30');
select atteso('e il pdf del doppione è stato cancellato dal contenitore',
  (select count(*)::text from storage.objects where bucket_id = 'certificati' and name like 'aaaaaaaa-0000-0000-0000-000000000053/%'), '0');
reset role;

-- La data è quella del certificato il cui file resta, non la più lontana delle due.
insert into persone (id, nome, cognome, ruolo) values
  ('aaaaaaaa-0000-0000-0000-000000000054', 'Eva', 'Gialli', 'iscritto'),
  ('aaaaaaaa-0000-0000-0000-000000000055', 'Eva', 'Gialli', 'iscritto');
insert into storage.objects (bucket_id, name) values
  ('certificati', 'aaaaaaaa-0000-0000-0000-000000000054/certificato-1.pdf'),
  ('certificati', 'aaaaaaaa-0000-0000-0000-000000000055/certificato-5.png');
insert into schede_iscritti (persona_id, certificato_scade, certificato_file, certificato_caricato_il) values
  ('aaaaaaaa-0000-0000-0000-000000000054', '2027-01-31', 'aaaaaaaa-0000-0000-0000-000000000054/certificato-1.pdf', now()),
  ('aaaaaaaa-0000-0000-0000-000000000055', '2028-01-31', null, null);
-- Nella cartella di chi se ne va c'è anche un file rimasto lì senza scheda.
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('un file e una data più lontana senza file: si uniscono',
  tenta($$select 'fatto' from unisci_persone('aaaaaaaa-0000-0000-0000-000000000054', 'aaaaaaaa-0000-0000-0000-000000000055')$$), 'fatto');
select atteso('la data è quella del certificato col file, che resta',
  (select certificato_scade || ' ' || (certificato_file ~ '^aaaaaaaa-0000-0000-0000-000000000054/certificato-1\.pdf$') from schede_iscritti where persona_id = 'aaaaaaaa-0000-0000-0000-000000000054'), '2027-01-31 true');
select atteso('e nella cartella di chi se ne va non resta niente, nemmeno il file senza scheda',
  (select count(*)::text from storage.objects where bucket_id = 'certificati' and name like 'aaaaaaaa-0000-0000-0000-000000000055/%'), '0');
reset role;


\echo ''
\echo 'TUTTO A POSTO'
