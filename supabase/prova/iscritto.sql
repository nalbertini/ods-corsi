-- L'area degli iscritti sul database (101-iscritto.sql): chi ha un account da
-- iscritto legge di sé, e il titolare di un nucleo anche dei suoi, con le
-- funzioni `iscritto_*` e mai con una select diretta. Qui: ognuno vede solo le
-- sue righe (scheda, lezioni, presenze, ricevute), il titolare vede il nucleo
-- e il membro solo sé stesso, senza account o senza persona non si vede
-- niente, nelle risposte non ci sono né il file del certificato né le note
-- della segreteria, un iscritto con l'account non è personale (nessun accesso
-- diretto a quello che resta della segreteria), `collega_utente()` lo lega
-- solo con l'email confermata e senza dubbi, `anon` non esegue niente, e
-- «ero a lezione» (segnalare una presenza) segue le regole di `segnalate.ts`.
-- La metà di prova: `src/lib/iscritto.ts` e `iscrittoProva.ts`, stesse domande.
-- Si lancia dopo finto-supabase.sql e i file dello schema (il 101 compreso).
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

-- --- gli aiuti --------------------------------------------------------------
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
create or replace function atteso(cosa text, avuto text, voluto text) returns text language plpgsql as $$
begin
  if avuto is distinct from voluto and not (voluto like '%…' and avuto like replace(voluto, '…', '%')) then
    raise exception '% · atteso «%», avuto «%»', cosa, voluto, avuto;
  end if;
  return 'ok  ' || cosa || ' → ' || avuto;
end $$;
-- Le persone per numero (le ultime due cifre dell'id).
create or replace function pid(n int) returns uuid language sql immutable as $$
  select ('aaaaaaaa-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;

-- --- chi c'è ----------------------------------------------------------------
insert into auth.users (id, email, email_confirmed_at) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it', now()),
  ('22222222-2222-2222-2222-222222222222', 'ines@ods.it', now()),
  ('33333333-3333-3333-3333-333333333333', 'luca@fam.it', now()),
  ('44444444-4444-4444-4444-444444444444', 'maria@fam.it', now()),
  ('55555555-5555-5555-5555-555555555555', 'bruno@fam.it', now()),
  -- Un account che non è di nessuno.
  ('66666666-6666-6666-6666-666666666666', 'zoe@fam.it', now()),
  -- Per il primo accesso: chi ha l'email confermata, chi no, la famiglia, i dubbi.
  ('77777777-7777-7777-7777-777777777777', 'cleo@fam.it', now()),
  ('88888888-8888-8888-8888-888888888888', 'nina@fam.it', null),
  ('99999999-9999-9999-9999-999999999999', 'fam2@fam.it', now()),
  ('bbbbbbbb-1111-1111-1111-111111111111', 'doppi@fam.it', now()),
  ('cccccccc-1111-1111-1111-111111111111', 'spento@fam.it', now()),
  ('dddddddd-1111-1111-1111-111111111111', 'cleo@fam.it', now());
insert into persone (id, nome, cognome, ruolo, email, utente_id, attiva) values
  (pid(1), 'Anna', 'Segreteria', 'staff', 'anna@ods.it', '11111111-1111-1111-1111-111111111111', true),
  (pid(2), 'Ines', 'Istruttrice', 'istruttore', 'ines@ods.it', '22222222-2222-2222-2222-222222222222', true),
  (pid(7), 'Sandro', 'Sostituto', 'istruttore', null, null, true),
  (pid(3), 'Luca', 'Fam', 'iscritto', 'luca@fam.it', '33333333-3333-3333-3333-333333333333', true),
  (pid(6), 'Bruno', 'Solo', 'iscritto', 'bruno@fam.it', '55555555-5555-5555-5555-555555555555', true),
  (pid(10), 'Cleo', 'Nuova', 'iscritto', 'cleo@fam.it', null, true),
  (pid(11), 'Nina', 'Dubbia', 'iscritto', 'nina@fam.it', null, true),
  (pid(12), 'Pio', 'Famiglia', 'iscritto', 'fam2@fam.it', null, true),
  (pid(14), 'Dora', 'Doppia', 'iscritto', 'doppi@fam.it', null, true),
  (pid(15), 'Dino', 'Doppio', 'iscritto', 'doppi@fam.it', null, true),
  (pid(16), 'Silvia', 'Spenta', 'iscritto', 'spento@fam.it', null, false);
-- Il nucleo di Luca (Maria, con il suo account, e Teo senza) e quello di Pio.
insert into persone (id, nome, cognome, ruolo, email, utente_id, nucleo) values
  (pid(4), 'Maria', 'Fam', 'iscritto', 'maria@fam.it', '44444444-4444-4444-4444-444444444444', pid(3)),
  (pid(5), 'Teo', 'Fam', 'iscritto', 'luca@fam.it', null, pid(3)),
  (pid(13), 'Pia', 'Famiglia', 'iscritto', 'fam2@fam.it', null, pid(12));
update persone set anche_istruttore = false where id = pid(1);

insert into sale (id, nome) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Lotta'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Tatami');
-- Il tablet di sala: un account suo, nessuna persona.
insert into auth.users (id, email, email_confirmed_at) values ('77777777-7777-7777-7777-777777770001', 'tablet@ods.it', now());
insert into postazioni (nome, sala_id, utente_id) values ('Tablet', 'bbbbbbbb-0000-0000-0000-000000000001', '77777777-7777-7777-7777-777777770001');
insert into corsi (id, nome, colore, sala_id, istruttore_id) values
  ('cccccccc-0000-0000-0000-000000000001', 'Karate', '#c0392b', 'bbbbbbbb-0000-0000-0000-000000000001', pid(2)),
  ('cccccccc-0000-0000-0000-000000000002', 'Judo', '#2980b9', 'bbbbbbbb-0000-0000-0000-000000000002', pid(2));
-- Una ricorrenza lontana nel tempo: serve solo a dire che una lezione è «del
-- suo giorno» (il calendario non ne genera altre dentro la finestra).
insert into ricorrenze (id, corso_id, giorno, ora, durata_min, dal, al, sala_id) values
  ('f0f0f0f0-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 1, '18:00', 60, current_date - 300, current_date - 299, 'bbbbbbbb-0000-0000-0000-000000000001');

-- Karate: Luca, Maria e Teo. Judo: Bruno, e Maria fino a mesi fa.
insert into iscrizioni (corso_id, persona_id, dal, al) values
  ('cccccccc-0000-0000-0000-000000000001', pid(3), current_date - 90, null),
  ('cccccccc-0000-0000-0000-000000000001', pid(4), current_date - 90, null),
  ('cccccccc-0000-0000-0000-000000000001', pid(5), current_date - 90, null),
  ('cccccccc-0000-0000-0000-000000000002', pid(6), current_date - 90, null),
  ('cccccccc-0000-0000-0000-000000000002', pid(4), current_date - 200, current_date - 100);

-- Le lezioni: ieri, tre giorni fa (annullata), 40 giorni fa, domani in un'altra
-- sala, dopodomani fuori orario con un sostituto; e il Judo di ieri.
insert into sessioni (id, corso_id, ricorrenza_id, inizio, fine, sala_id, istruttore_id, stato) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 'f0f0f0f0-0000-0000-0000-000000000001', now() - interval '1 day', now() - interval '1 day' + interval '1 hour', 'bbbbbbbb-0000-0000-0000-000000000001', pid(2), 'svolta'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000001', 'f0f0f0f0-0000-0000-0000-000000000001', now() - interval '3 days', now() - interval '3 days' + interval '1 hour', 'bbbbbbbb-0000-0000-0000-000000000001', pid(2), 'annullata'),
  ('eeeeeeee-0000-0000-0000-000000000006', 'cccccccc-0000-0000-0000-000000000001', 'f0f0f0f0-0000-0000-0000-000000000001', now() - interval '40 days', now() - interval '40 days' + interval '1 hour', 'bbbbbbbb-0000-0000-0000-000000000001', pid(2), 'svolta'),
  ('eeeeeeee-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-000000000001', 'f0f0f0f0-0000-0000-0000-000000000001', now() + interval '1 day', now() + interval '1 day' + interval '1 hour', 'bbbbbbbb-0000-0000-0000-000000000002', pid(2), 'prevista'),
  ('eeeeeeee-0000-0000-0000-000000000004', 'cccccccc-0000-0000-0000-000000000001', null, now() + interval '2 days', now() + interval '2 days' + interval '1 hour', 'bbbbbbbb-0000-0000-0000-000000000001', pid(7), 'prevista'),
  ('eeeeeeee-0000-0000-0000-000000000005', 'cccccccc-0000-0000-0000-000000000002', null, now() - interval '1 day', now() - interval '1 day' + interval '1 hour', 'bbbbbbbb-0000-0000-0000-000000000002', pid(2), 'svolta');
insert into presenze (sessione_id, persona_id, stato) values
  ('eeeeeeee-0000-0000-0000-000000000001', pid(3), 'presente'),
  ('eeeeeeee-0000-0000-0000-000000000001', pid(4), 'assente'),
  ('eeeeeeee-0000-0000-0000-000000000005', pid(6), 'presente');

-- Le schede: il file del certificato e le note sono della segreteria, da non
-- far uscire (le parole «segret» e «certificato-» li tradiscono nelle risposte).
insert into anagrafiche (persona_id, nato_il, indirizzo, cap, comune, codice_fiscale) values
  (pid(3), current_date - interval '45 years', 'Via Roma 1', '10093', 'Collegno', 'FMALCU80A01L219X'),
  (pid(6), current_date - interval '30 years', null, null, null, null),
  (pid(5), current_date - interval '9 years', null, null, null, null);
insert into schede_iscritti (persona_id, certificato_scade, certificato_file, pagamento, pagato_fino, pagamento_nota) values
  (pid(3), current_date + 100, pid(3)::text || '/certificato-1.pdf', 'pagato', current_date + 100, 'nota segreta di Luca'),
  (pid(4), null, null, 'da_pagare', null, 'nota segreta di Maria'),
  (pid(5), current_date + 5, pid(5)::text || '/certificato-1.pdf', 'in_parte', null, 'nota segreta di Teo'),
  (pid(6), current_date + 10, pid(6)::text || '/certificato-1.pdf', 'in_parte', null, 'nota segreta di Bruno');
insert into ricevute (id, anno, numero, data, persona_id, ente, intestatario, voci, totale, pagato, anticipo, note, annullata_il) values
  ('f1f1f1f1-0000-0000-0000-000000000001', 2026, 901, current_date - 20, pid(3), '{"nome":"ODS"}', '{"nome":"Luca","cognome":"Fam"}',
    jsonb_build_array(jsonb_build_object('descrizione', 'QUOTA ASSOCIATIVA', 'quantita', 1, 'prezzo', 3000, 'dal', (current_date - 20)::text, 'al', (current_date + 300)::text,
      'pagamenti', jsonb_build_array(jsonb_build_object('data', (current_date - 20)::text, 'importo', 3000, 'metodo', 'Contanti')))),
    3000, 3000, 0, 'nota segreta della ricevuta', null),
  ('f1f1f1f1-0000-0000-0000-000000000002', 2026, 904, current_date - 10, pid(3), '{"nome":"ODS"}', '{"nome":"Luca","cognome":"Fam"}', '[{"descrizione":"Altro","quantita":1,"prezzo":100,"pagamenti":[]}]', 100, 100, 0, null, now()),
  ('f1f1f1f1-0000-0000-0000-000000000003', 2026, 903, current_date - 5, pid(4), '{"nome":"ODS"}', '{"nome":"Maria","cognome":"Fam"}', '[{"descrizione":"Altro","quantita":1,"prezzo":100,"pagamenti":[]}]', 100, 100, 0, null, null),
  ('f1f1f1f1-0000-0000-0000-000000000004', 2026, 902, current_date - 2, pid(6), '{"nome":"ODS"}', '{"nome":"Bruno","cognome":"Solo"}',
    jsonb_build_array(jsonb_build_object('descrizione', 'QUOTA ASSOCIATIVA', 'quantita', 1, 'prezzo', 3000, 'dal', (current_date - 2)::text, 'al', (current_date + 300)::text, 'pagamenti', '[]'::jsonb)),
    3000, 1000, 0, null, null);
-- Le persone aggiunte al nucleo: una nuova, una rifiutata da poco, una rifiutata
-- mesi fa, una accolta, e una per Bruno.
insert into richieste_iscrizione (id, nome, cognome, nato_il, nato_a, codice_fiscale, indirizzo, cap, comune, email, telefono, corsi, formula, regolamento, nucleo_di, stato, gestita_il, gestita_da) values
  ('eeeeeeee-0000-0000-0000-0000000000a1', 'Nuovo', 'Fam', current_date - interval '8 years', 'Torino', 'NVUFAM18A41L219A', 'Via Roma 1', '10093', 'Collegno', 'luca@fam.it', '347 111 2233',
    array['cccccccc-0000-0000-0000-000000000001']::uuid[], 'annuale', true, pid(3), 'nuova', null, null),
  ('eeeeeeee-0000-0000-0000-0000000000a2', 'Rifiutato', 'Fam', current_date - interval '9 years', 'Torino', 'RFIFAM18A41L219B', 'Via Roma 1', '10093', 'Collegno', 'luca@fam.it', '347 111 2233',
    array['cccccccc-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000002']::uuid[], 'annuale', true, pid(3), 'rifiutata', now() - interval '5 days', pid(1)),
  ('eeeeeeee-0000-0000-0000-0000000000a3', 'Vecchio', 'Fam', current_date - interval '9 years', 'Torino', 'VCCFAM18A41L219C', 'Via Roma 1', '10093', 'Collegno', 'luca@fam.it', '347 111 2233',
    array['cccccccc-0000-0000-0000-000000000001']::uuid[], 'annuale', true, pid(3), 'rifiutata', now() - interval '40 days', pid(1)),
  ('eeeeeeee-0000-0000-0000-0000000000a4', 'Accolto', 'Fam', current_date - interval '9 years', 'Torino', 'ACCFAM18A41L219D', 'Via Roma 1', '10093', 'Collegno', 'luca@fam.it', '347 111 2233',
    array['cccccccc-0000-0000-0000-000000000001']::uuid[], 'annuale', true, pid(3), 'accolta', now() - interval '2 days', pid(1)),
  ('eeeeeeee-0000-0000-0000-0000000000a5', 'Di Bruno', 'Solo', current_date - interval '9 years', 'Torino', 'BRUSOL18A41L219E', 'Via Roma 1', '10093', 'Collegno', 'bruno@fam.it', '347 111 2233',
    array['cccccccc-0000-0000-0000-000000000002']::uuid[], 'annuale', true, pid(6), 'nuova', null, null);

-- Quello che dicono le funzioni, in una riga sola per persona o per lezione.
create or replace function riga(sql text) returns text language plpgsql as $$
declare esito text;
begin execute sql into esito; return coalesce(esito, 'niente');
exception when others then return 'NEGATO: ' || sqlerrm;
end $$;

\echo ''
\echo '--- 1. la scheda: la sua, e per chi è titolare quella del nucleo ---'
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('Bruno vede la sua scheda', riga($$select s.nome || ' ' || s.cognome || ' · ' || s.certificato_scade || ' · ' || s.pagamento::text || ' · ' || s.corsi::text from iscritto_scheda(pid(6)) s$$),
  'Bruno Solo · ' || (current_date + 10) || ' · in_parte · [{"id": "cccccccc-0000-0000-0000-000000000002", "nome": "Judo", "colore": "#2980b9"}]');
select atteso('…con la quota dalle ricevute', riga($$select s.quote::text from iscritto_scheda(pid(6)) s$$),
  '[{"al": "' || (current_date + 300) || '", "dal": "' || (current_date - 2) || '", "anno": 2026, "numero": 902, "mancano": 2000}]');
select atteso('…e la data di nascita, che dice se il certificato serve', riga($$select s.nato_il::text from iscritto_scheda(pid(6)) s$$), (current_date - interval '30 years')::date::text);
select atteso('Bruno non vede la scheda di Luca', riga($$select count(*)::text from iscritto_scheda(pid(3))$$), '0');
select atteso('né quella di Maria', riga($$select count(*)::text from iscritto_scheda(pid(4))$$), '0');
select atteso('né di una persona che non c''è', riga($$select count(*)::text from iscritto_scheda(gen_random_uuid())$$), '0');
select atteso('né col nulla', riga($$select count(*)::text from iscritto_scheda(null)$$), '0');
reset role;
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('Luca vede la sua', riga($$select s.nome from iscritto_scheda(pid(3)) s$$), 'Luca');
select atteso('Luca vede quella di Teo: è nel suo nucleo', riga($$select s.nome || ' ' || s.pagamento::text from iscritto_scheda(pid(5)) s$$), 'Teo in_parte');
select atteso('…non quella di Maria: ha un account suo', riga($$select count(*)::text from iscritto_scheda(pid(4)) s$$), '0');
select atteso('Luca non vede Bruno: non è del suo nucleo', riga($$select count(*)::text from iscritto_scheda(pid(6)) s$$), '0');
select atteso('né la segreteria, né un''istruttrice', riga($$select count(*)::text from iscritto_scheda(pid(1)) s$$), '0');
select atteso('né Pio, che ha un nucleo suo', riga($$select count(*)::text from iscritto_scheda(pid(12)) s$$), '0');
select atteso('della scheda non esce il file del certificato né le note', riga($$select (to_jsonb(s)::text ~ 'segret|certificato-')::text from iscritto_scheda(pid(3)) s$$), 'false');
select atteso('…nemmeno colonne con quel nome', riga($$select count(*)::text from jsonb_object_keys((select to_jsonb(s) from iscritto_scheda(pid(3)) s)) k where k like '%file%' or k like '%nota%' or k like '%note%'$$), '0');
reset role;
select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('Maria, che sta nel nucleo di Luca, vede sé', riga($$select s.nome from iscritto_scheda(pid(4)) s$$), 'Maria');
select atteso('…non il titolare', riga($$select count(*)::text from iscritto_scheda(pid(3)) s$$), '0');
select atteso('…né Teo, che è del suo stesso nucleo', riga($$select count(*)::text from iscritto_scheda(pid(5)) s$$), '0');
select atteso('Maria ha un corso solo: quello che ha finito mesi fa non c''è', riga($$select jsonb_array_length(s.corsi)::text from iscritto_scheda(pid(4)) s$$), '1');
reset role;
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('un account senza persona non vede niente', riga($$select count(*)::text from iscritto_scheda(pid(3)) s$$), '0');
reset role;
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('un''istruttrice non legge un iscritto con queste funzioni', riga($$select count(*)::text from iscritto_scheda(pid(6)) s$$), '0');
select atteso('…e per sé? non è un iscritto: niente', riga($$select count(*)::text from iscritto_scheda(pid(2)) s$$), '0');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria ha le sue schermate: da qui non legge un iscritto', riga($$select count(*)::text from iscritto_scheda(pid(6)) s$$), '0');
reset role;

\echo ''
\echo '--- 2. le lezioni dei suoi corsi, anche annullate ---'
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('Luca: le quattro lezioni di Karate fra cinque giorni prima e dopo, non il Judo',
  riga($$select string_agg(l.corso || ':' || l.stato::text, ',' order by l.inizio) from iscritto_lezioni(pid(3), current_date - 5, current_date + 5) l$$),
  'Karate:annullata,Karate:svolta,Karate:prevista,Karate:prevista');
select atteso('domani è nell''altra sala, dopodomani è fuori orario con un sostituto',
  riga($$select string_agg(l.sala || ' ' || l.altra_sala::text || ' ' || l.straordinaria::text || ' ' || l.sostituto::text || ' ' || coalesce(l.istruttore, '-'), ' | ' order by l.inizio)
          from iscritto_lezioni(pid(3), current_date, current_date + 5) l$$),
  'Tatami true false false Ines Istruttrice | Lotta false true true Sandro Sostituto');
select atteso('gli estremi sono compresi: solo oggi, ieri e domani', riga($$select count(*)::text from iscritto_lezioni(pid(3), current_date - 1, current_date + 1) l$$), '2');
select atteso('Luca non vede le lezioni di Bruno', riga($$select count(*)::text from iscritto_lezioni(pid(6), current_date - 5, current_date + 5) l$$), '0');
select atteso('Luca vede quelle di Teo', riga($$select count(*)::text from iscritto_lezioni(pid(5), current_date - 5, current_date + 5) l$$), '4');
select atteso('della lezione non esce niente della segreteria', riga($$select (to_jsonb(l)::text ~ 'segret|certificato-')::text from iscritto_lezioni(pid(3), current_date - 5, current_date + 5) l limit 1$$), 'false');
reset role;
select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('Maria: il Judo di ieri non è più suo (era iscritta fino a mesi fa)', riga($$select count(*)::text from iscritto_lezioni(pid(4), current_date - 5, current_date + 5) l where l.corso = 'Judo'$$), '0');
select atteso('…il Karate sì', riga($$select count(*)::text from iscritto_lezioni(pid(4), current_date - 5, current_date + 5) l$$), '4');
select atteso('Maria non chiede per Luca', riga($$select count(*)::text from iscritto_lezioni(pid(3), current_date - 5, current_date + 5) l$$), '0');
reset role;
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('Bruno: solo il suo Judo', riga($$select string_agg(l.corso, ',') from iscritto_lezioni(pid(6), current_date - 5, current_date + 5) l$$), 'Judo');
select atteso('Bruno non vede le lezioni di Luca', riga($$select count(*)::text from iscritto_lezioni(pid(3), current_date - 5, current_date + 5) l$$), '0');
reset role;

\echo ''
\echo '--- 3. le presenze: le lezioni già fatte, dalla più recente ---'
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('Luca, ultima settimana: ieri c''era, la lezione annullata e quelle da fare no',
  riga($$select string_agg(p.corso || ':' || coalesce(p.stato::text, '-'), ',') from iscritto_presenze(pid(3), 7) p$$), 'Karate:presente');
select atteso('…in due mesi c''è anche quella di 40 giorni fa, senza segno', riga($$select string_agg(coalesce(p.stato::text, '-'), ',') from iscritto_presenze(pid(3), 60) p$$), 'presente,-');
select atteso('Luca non legge le presenze di Bruno', riga($$select count(*)::text from iscritto_presenze(pid(6), 60) p$$), '0');
select atteso('non legge quelle di Maria: ha un account suo', riga($$select count(*)::text from iscritto_presenze(pid(4), 7) p$$), '0');
reset role;
select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('Maria vede le sue', riga($$select string_agg(coalesce(p.stato::text, '-'), ',') from iscritto_presenze(pid(4), 7) p$$), 'assente');
select atteso('Maria non legge quelle di Teo, né di Luca', riga($$select count(*)::text from (select * from iscritto_presenze(pid(5), 60) union all select * from iscritto_presenze(pid(3), 60)) x$$), '0');
reset role;
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('Bruno: il suo Judo di ieri', riga($$select string_agg(p.corso || ':' || p.stato::text, ',') from iscritto_presenze(pid(6), 7) p$$), 'Judo:presente');
select atteso('Bruno non legge quelle di Luca', riga($$select count(*)::text from iscritto_presenze(pid(3), 7) p$$), '0');
reset role;

\echo ''
\echo '--- 4. le ricevute: le sue, anche annullate ---'
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('Luca: le sue due, dalla più recente, l''annullata compresa',
  riga($$select string_agg(r.numero::text || case when r.annullata_il is null then '' else ' annullata' end, ',') from iscritto_ricevute(pid(3)) r$$), '904 annullata,901');
select atteso('…con le voci e i pagamenti', riga($$select jsonb_array_length(r.voci -> 0 -> 'pagamenti')::text from iscritto_ricevute(pid(3)) r where r.numero = 901$$), '1');
select atteso('della ricevuta non escono le note', riga($$select (to_jsonb(r)::text ~ 'segret|certificato-')::text from iscritto_ricevute(pid(3)) r where r.numero = 901$$), 'false');
select atteso('Luca non vede la ricevuta di Maria: ha un account suo', riga($$select count(*)::text from iscritto_ricevute(pid(4)) r$$), '0');
select atteso('non quella di Bruno', riga($$select count(*)::text from iscritto_ricevute(pid(6)) r$$), '0');
reset role;
select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('Maria: la sua', riga($$select string_agg(r.numero::text, ',') from iscritto_ricevute(pid(4)) r$$), '903');
select atteso('Maria non vede quelle di Luca', riga($$select count(*)::text from iscritto_ricevute(pid(3)) r$$), '0');
reset role;
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('Bruno: la sua', riga($$select string_agg(r.numero::text, ',') from iscritto_ricevute(pid(6)) r$$), '902');
select atteso('Bruno non vede quelle di Luca', riga($$select count(*)::text from iscritto_ricevute(pid(3)) r$$), '0');
reset role;

\echo ''
\echo '--- 5. il nucleo, e chi può aggiungere ---'
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('Luca vede sé per primo, poi gli altri per nome', riga($$select string_agg(n.nome, ',') from iscritto_nucleo(pid(3)) n$$), 'Luca,Teo');
select atteso('…con le loro schede', riga($$select string_agg(n.pagamento::text, ',') from iscritto_nucleo(pid(3)) n$$), 'pagato,in_parte');
select atteso('Luca non apre il nucleo di Bruno', riga($$select count(*)::text from iscritto_nucleo(pid(6)) n$$), '0');
select atteso('Luca non apre il nucleo di Maria: ha un account suo', riga($$select count(*)::text from iscritto_nucleo(pid(4)) n$$), '0');
select atteso('Luca è titolare', riga($$select iscritto_titolare(pid(3))::text$$), 'true');
select atteso('Maria per lui non lo è', riga($$select iscritto_titolare(pid(4))::text$$), 'false');
select atteso('e per Bruno non si dice', riga($$select iscritto_titolare(pid(6))::text$$), 'false');
select atteso('l''aggiunta nuova e la rifiutata da poco, non la vecchia né l''accolta',
  riga($$select string_agg(a.nome || ':' || a.stato::text, ',' order by a.nome) from iscritto_aggiunte(pid(3)) a$$), 'Nuovo:nuova,Rifiutato:rifiutata');
select atteso('…coi nomi dei corsi', riga($$select a.corsi::text from iscritto_aggiunte(pid(3)) a where a.nome = 'Rifiutato'$$), '{Karate,Judo}');
select atteso('Luca non vede le aggiunte di Bruno', riga($$select count(*)::text from iscritto_aggiunte(pid(6)) a$$), '0');
select atteso('Luca per il modulo: cognome, indirizzo, contatti, e se stesso come genitore',
  riga($$select d.cognome || '|' || d.indirizzo || '|' || d.cap || '|' || d.comune || '|' || d.email || '|' || d.genitore_nome || ' ' || d.genitore_cognome || '|' || d.genitore_codice_fiscale || '|' || (d.nucleo_di = pid(3))::text from iscritto_dati_del_nucleo(pid(3)) d$$),
  'Fam|Via Roma 1|10093|Collegno|luca@fam.it|Luca Fam|FMALCU80A01L219X|true');
select atteso('i dati del nucleo di Bruno non li legge', riga($$select count(*)::text from iscritto_dati_del_nucleo(pid(6)) d$$), '0');
reset role;
select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('Maria vede solo sé stessa', riga($$select string_agg(n.nome, ',') from iscritto_nucleo(pid(4)) n$$), 'Maria');
select atteso('Maria non è titolare', riga($$select iscritto_titolare(pid(4))::text$$), 'false');
select atteso('Maria non vede le aggiunte di Luca', riga($$select count(*)::text from iscritto_aggiunte(pid(3)) a$$), '0');
select atteso('…né aggiunte sue: non può aggiungere', riga($$select count(*)::text from iscritto_aggiunte(pid(4)) a$$), '0');
select atteso('Maria non prende i dati del nucleo di Luca', riga($$select count(*)::text from iscritto_dati_del_nucleo(pid(3)) d$$), '0');
select atteso('…né i suoi: non è titolare', riga($$select count(*)::text from iscritto_dati_del_nucleo(pid(4)) d$$), '0');
reset role;
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('Bruno, senza nucleo, è il titolare di sé', riga($$select iscritto_titolare(pid(6))::text$$), 'true');
select atteso('…il suo nucleo è lui solo', riga($$select string_agg(n.nome, ',') from iscritto_nucleo(pid(6)) n$$), 'Bruno');
select atteso('…e vede la sua aggiunta', riga($$select string_agg(a.nome, ',') from iscritto_aggiunte(pid(6)) a$$), 'Di Bruno');
select atteso('…e dei suoi dati ha l''email e il telefono, non quello che non c''è',
  riga($$select d.cognome || '|' || d.email || '|' || coalesce(d.indirizzo, '') || '|' || d.genitore_nome from iscritto_dati_del_nucleo(pid(6)) d$$), 'Solo|bruno@fam.it||Bruno');
reset role;

\echo ''
\echo '--- 6. ero a lezione ---'
-- Maria era assente ieri: lo dice. Luca ha già la presenza: non serve.
select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('Maria segnala la lezione di ieri', tenta($$select iscritto_segnala(pid(4), 'eeeeeeee-0000-0000-0000-000000000001', 'ero arrivata in ritardo')::text$$), '');
select atteso('…una sola volta', tenta($$select iscritto_segnala(pid(4), 'eeeeeeee-0000-0000-0000-000000000001', null)::text$$), 'NEGATO: L’hai già segnalata: la guarda l’istruttore o la segreteria');
select atteso('…e la ritrova fra le sue', riga($$select s.stato || '|' || s.nota || '|' || (s.sessione_id = 'eeeeeeee-0000-0000-0000-000000000001')::text from iscritto_segnalate(pid(4)) s$$), 'da_vedere|ero arrivata in ritardo|true');
select atteso('non una lezione annullata', tenta($$select iscritto_segnala(pid(4), 'eeeeeeee-0000-0000-0000-000000000002', null)::text$$), 'NEGATO: La lezione è stata annullata');
select atteso('non una che deve ancora cominciare', tenta($$select iscritto_segnala(pid(4), 'eeeeeeee-0000-0000-0000-000000000003', null)::text$$), 'NEGATO: La lezione non è ancora cominciata');
select atteso('non una di quaranta giorni fa', tenta($$select iscritto_segnala(pid(4), 'eeeeeeee-0000-0000-0000-000000000006', null)::text$$), 'NEGATO: Si segnalano solo le lezioni degli ultimi 30 giorni: chiedi alla segreteria');
select atteso('non il Judo, da cui è uscita', tenta($$select iscritto_segnala(pid(4), 'eeeeeeee-0000-0000-0000-000000000005', null)::text$$), 'NEGATO: Questa lezione non è di un tuo corso');
select atteso('non una lezione che non c''è', tenta($$select iscritto_segnala(pid(4), gen_random_uuid(), null)::text$$), 'NEGATO: Questa lezione non è di un tuo corso');
select atteso('Maria non segnala per Luca', tenta($$select iscritto_segnala(pid(3), 'eeeeeeee-0000-0000-0000-000000000001', null)::text$$), 'NEGATO: Questa persona non è fra le tue');
select atteso('né legge le sue segnalate', riga($$select count(*)::text from iscritto_segnalate(pid(5)) s$$), '0');
reset role;
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('Luca era presente: non serve', tenta($$select iscritto_segnala(pid(3), 'eeeeeeee-0000-0000-0000-000000000001', null)::text$$), 'NEGATO: Risulti già presente');
select atteso('una nota troppo lunga non passa', tenta($$select iscritto_segnala(pid(5), 'eeeeeeee-0000-0000-0000-000000000001', repeat('x', 201))::text$$), 'NEGATO: La nota è troppo lunga: al massimo 200 caratteri');
select atteso('Luca segnala per Teo, che non risulta', tenta($$select iscritto_segnala(pid(5), 'eeeeeeee-0000-0000-0000-000000000001', null)::text$$), '');
select atteso('…e le segnalate di Teo le legge', riga($$select count(*)::text from iscritto_segnalate(pid(5)) s$$), '1');
select atteso('…non quelle di Maria: ha un account suo', riga($$select count(*)::text from iscritto_segnalate(pid(4)) s$$), '0');
select atteso('…ma non quelle di Bruno', riga($$select count(*)::text from iscritto_segnalate(pid(6)) s$$), '0');
select atteso('Luca non segnala per Bruno', tenta($$select iscritto_segnala(pid(6), 'eeeeeeee-0000-0000-0000-000000000005', null)::text$$), 'NEGATO: Questa persona non è fra le tue');
reset role;
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('Bruno non segnala una lezione di Karate', tenta($$select iscritto_segnala(pid(6), 'eeeeeeee-0000-0000-0000-000000000001', null)::text$$), 'NEGATO: Questa lezione non è di un tuo corso');
select atteso('Bruno non legge le segnalate degli altri', riga($$select count(*)::text from iscritto_segnalate(pid(4)) s$$), '0');
select atteso('né la tabella: la policy è della segreteria, le righe sono zero', tenta($$select count(*)::text from presenze_segnalate$$), '0');
reset role;
select atteso('due segnalazioni in tutto, e l''appello non è cambiato', (select count(*)::text from presenze_segnalate) || '|' || (select stato::text from presenze where sessione_id = 'eeeeeeee-0000-0000-0000-000000000001' and persona_id = pid(4)), '2|assente');
-- La segreteria le legge.
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria legge le segnalate', tenta($$select count(*)::text from presenze_segnalate$$), '2');
reset role;
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('un''istruttrice per ora non scrive nella tabella', tenta($$update presenze_segnalate set stato = 'accolta'$$), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 7. un iscritto con l''account non è personale ---'
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('Luca ha un ruolo, ed è iscritto', (select ruolo_corrente()::text), 'iscritto');
select atteso('non è segreteria', (select e_staff()::text), 'false');
select atteso('non è personale', (select e_personale()::text), 'false');
select atteso('non è amministrazione', (select e_amministrazione()::text), 'false');
select atteso('non è il sistema', (select e_di_sistema()::text), 'false');
select atteso('le persone che vede con una select sono lui solo', tenta($$select count(*)::text from persone where id <> pid(3)$$), '0');
select atteso('le iscrizioni altrui no', tenta($$select count(*)::text from iscrizioni where persona_id <> pid(3)$$), '0');
select atteso('le presenze altrui no', tenta($$select count(*)::text from presenze where persona_id <> pid(3)$$), '0');
select atteso('le schede (certificato, pagamento, note) no', tenta($$select count(*)::text from schede_iscritti$$), '0');
select atteso('le anagrafiche no', tenta($$select count(*)::text from anagrafiche$$), '0');
select atteso('le ricevute no', tenta($$select count(*)::text from ricevute$$), '0');
select atteso('le richieste d''iscrizione no', tenta($$select count(*)::text from richieste_iscrizione$$), '0');
select atteso('i pagamenti Satispay no', tenta($$select count(*)::text from pagamenti_satispay$$), '0');
select atteso('le lezioni nemmeno', tenta($$select count(*)::text from sessioni$$), '0');
select atteso('non si dà il ruolo di segreteria', tenta($$update persone set ruolo = 'staff' where id = pid(3)$$), '…');
select atteso('non prende il posto della segreteria', tenta($$update persone set utente_id = '33333333-3333-3333-3333-333333333333' where id = pid(1)$$), '…');
select atteso('non si mette nel nucleo di un altro', tenta($$update persone set nucleo = pid(6) where id = pid(3)$$), '…');
select atteso('non si iscrive a un corso', tenta($$insert into iscrizioni (corso_id, persona_id) values ('cccccccc-0000-0000-0000-000000000002', pid(3))$$), 'NEGATO: …');
select atteso('non segna una presenza', tenta($$insert into presenze (sessione_id, persona_id, stato) values ('eeeeeeee-0000-0000-0000-000000000005', pid(3), 'presente')$$), 'NEGATO: …');
select atteso('non rigenera il calendario', tenta($$select materializza_sessioni(current_date, current_date + 1)::text$$), 'NEGATO: …');
reset role;
select atteso('…e infatti niente è cambiato', (select ruolo::text || '|' || coalesce(nucleo::text, '-') from persone where id = pid(3)) || '|' || (select ruolo::text || '|' || (utente_id = '11111111-1111-1111-1111-111111111111')::text from persone where id = pid(1)),
  'iscritto|-|staff|true');
-- Anche quello che c'era già per il personale resta chiuso a Bruno, che nessuno ha messo in un nucleo.
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('Bruno non vede le persone del nucleo di Luca con una select', tenta($$select count(*)::text from persone where nucleo is not null$$), '0');
reset role;

\echo ''
\echo '--- 8. il primo accesso lega anche un iscritto, ma senza dubbi ---'
select chi('77777777-7777-7777-7777-777777777777');
set role authenticated;
select atteso('Cleo, con l''email confermata, si lega alla sua scheda', tenta($$select (collega_utente() = pid(10))::text$$), 'true');
select atteso('la seconda volta è la stessa', tenta($$select (collega_utente() = pid(10))::text$$), 'true');
select atteso('e ora è una iscritta, non personale', (select ruolo_corrente()::text || ' ' || e_personale()::text), 'iscritto false');
select atteso('legge la sua scheda', riga($$select s.nome from iscritto_scheda(pid(10)) s$$), 'Cleo');
reset role;
select atteso('la riga ha preso il suo account', (select utente_id::text from persone where id = pid(10)), '77777777-7777-7777-7777-777777777777');
select chi('dddddddd-1111-1111-1111-111111111111');
set role authenticated;
select atteso('un altro account con la stessa email non prende una scheda già legata', tenta($$select coalesce(collega_utente()::text, 'niente')$$), 'niente');
reset role;
select chi('88888888-8888-8888-8888-888888888888');
set role authenticated;
select atteso('Nina, con l''email non confermata, non si lega', tenta($$select coalesce(collega_utente()::text, 'niente')$$), 'niente');
reset role;
select atteso('…e la riga resta libera', (select utente_id::text from persone where id = pid(11)), null);
select chi('99999999-9999-9999-9999-999999999999');
set role authenticated;
select atteso('un indirizzo di famiglia lega il titolare, non i figli', tenta($$select (collega_utente() = pid(12))::text$$), 'true');
reset role;
select atteso('…e Pia non ha preso nessun account', (select count(*)::text from persone where id = pid(13) and utente_id is not null), '0');
select chi('bbbbbbbb-1111-1111-1111-111111111111');
set role authenticated;
select atteso('due iscritti non imparentati con la stessa email: nessuno dei due', tenta($$select coalesce(collega_utente()::text, 'niente')$$), 'niente');
reset role;
select atteso('…e le due righe restano libere', (select count(*)::text from persone where id in (pid(14), pid(15)) and utente_id is not null), '0');
select chi('cccccccc-1111-1111-1111-111111111111');
set role authenticated;
select atteso('un iscritto disattivato non si lega', tenta($$select coalesce(collega_utente()::text, 'niente')$$), 'niente');
reset role;
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('Zoe, che non è di nessuno, resta senza scheda', tenta($$select coalesce(collega_utente()::text, 'niente')$$), 'niente');
select atteso('…e non vede niente', riga($$select count(*)::text from iscritto_scheda(pid(10)) s$$), '0');
reset role;

reset role;
select chi('77777777-7777-7777-7777-777777770001');
set role authenticated;
select atteso('il tablet non vede un iscritto', riga($$select count(*)::text from iscritto_scheda(pid(3))$$), '0');
select atteso('…né il suo nucleo', riga($$select count(*)::text from iscritto_nucleo(pid(3))$$), '0');
select atteso('…né segnala per lui', codice($$select iscritto_segnala(pid(3), 'eeeeeeee-0000-0000-0000-000000000001', 'x')$$), '42501');
select atteso('…né le aggiunte', riga($$select count(*)::text from iscritto_aggiunte(pid(3))$$), '0');
reset role;

\echo ''
\echo '--- 9. chi non è entrato non esegue niente ---'
set role anon;
select atteso('anon non apre una scheda', codice($$select * from iscritto_scheda(pid(6))$$), '42501');
select atteso('…né le lezioni', codice($$select * from iscritto_lezioni(pid(6), current_date, current_date + 1)$$), '42501');
select atteso('…né le presenze', codice($$select * from iscritto_presenze(pid(6), 7)$$), '42501');
select atteso('…né le ricevute', codice($$select * from iscritto_ricevute(pid(6))$$), '42501');
select atteso('…né il nucleo', codice($$select * from iscritto_nucleo(pid(6))$$), '42501');
select atteso('…né se è titolare', codice($$select iscritto_titolare(pid(6))$$), '42501');
select atteso('…né le aggiunte', codice($$select * from iscritto_aggiunte(pid(6))$$), '42501');
select atteso('…né i dati del nucleo', codice($$select * from iscritto_dati_del_nucleo(pid(6))$$), '42501');
select atteso('…né segnala', codice($$select iscritto_segnala(pid(6), 'eeeeeeee-0000-0000-0000-000000000005', null)$$), '42501');
select atteso('…né le segnalate', codice($$select * from iscritto_segnalate(pid(6))$$), '42501');
select atteso('…né la tabella delle segnalazioni', codice($$select * from presenze_segnalate$$), '42501');
reset role;
-- Gli aiuti interni non sono per nessuno: chi è entrato chiama solo le funzioni di sopra.
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('un utente entrato non chiama l''aiuto che decide chi può vedere', codice($$select iscritto_puo_vedere(pid(6))$$), '42501');
select atteso('…né quello che compone la scheda, senza controlli', codice($$select * from iscritto_scheda_di(pid(6))$$), '42501');
reset role;

\echo ''
\echo '--- 10. rilanciare il file non cambia niente ---'
\ir ../101-iscritto.sql
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('dopo il rilancio Luca vede ancora il suo nucleo', riga($$select string_agg(n.nome, ',') from iscritto_nucleo(pid(3)) n$$), 'Luca,Teo');
reset role;
select atteso('…e le segnalazioni sono ancora due', (select count(*)::text from presenze_segnalate), '2');
