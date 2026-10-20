-- La segreteria dalla chat (73-chat-segreteria.sql): il server MCP (supabase/functions/mcp) legge, col token
-- di chi ha la segreteria, iscritti, certificati, quote e presenze. Qui il lato database:
--   · `chat_iscritti(sale)`: gli iscritti attivi; nome e cognome solo degli adulti; mai la data di nascita, solo
--     il giorno dei 6 anni (`sei_anni`) dei minori che non li hanno ancora compiuti; la chiave di chi non è adulto
--     che non si riconduce alla persona; le quote senza anno né numero della ricevuta, in ordine; i corsi in corso
--     oggi; mai telefono, email, nota del pagamento;
--   · `chat_registro(dal, al, sale)`: una riga per lezione e persona attiva con l'iscrizione valida quel giorno
--     (anche dello staff, come il registro dell'app), giorni di Roma, mai dopo adesso, al massimo un anno; l'età è
--     quella di oggi (chi compie 18 anni oggi ha il nome anche prima);
--   · `chat_prove(dal, al)`: quante prove per lezione, mai chi;
--   · `chat_nato_il(persona)` e `chat_eta(nato, oggi)`: la data della fonte più recente, l'età col 29 febbraio.
-- Solo e_staff(): gli altri, il tablet di sala compreso, «Questa parte è per la segreteria» (42501); anon niente;
-- nessuna scrittura. I minori si riconoscono dalla chiave ricalcolata qui (`chiave_di`), mai da una data.
-- Le stesse regole lato app: scripts/prova-mcp.mjs (sezioni 24-34) e scripts/prova-frequenza.mjs.
-- Si lancia dopo finto-supabase.sql e i file dello schema, su un database suo.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

create or replace function atteso(cosa text, avuto text, voluto text) returns text language plpgsql as $$
begin
  if avuto is distinct from voluto and not (voluto like '%…' and avuto like replace(voluto, '…', '%')) then
    raise exception '% · atteso «%», avuto «%»', cosa, voluto, avuto;
  end if;
  return 'ok  ' || cosa || ' → ' || avuto;
end $$;
select (to_regprocedure('public.chat_iscritti(text)') is not null
    and to_regprocedure('public.chat_registro(date, date, text)') is not null
    and to_regprocedure('public.chat_prove(date, date)') is not null
    and to_regprocedure('public.chat_nato_il(uuid)') is not null
    and to_regprocedure('public.chat_eta(date, date)') is not null)::text as c73 \gset
select atteso('73-chat-segreteria.sql è stato lanciato: chat_iscritti, chat_registro, chat_prove, chat_nato_il, chat_eta', :'c73', 'true');

create or replace function chi(u text) returns void language plpgsql as $$
begin perform set_config('prova.utente', u, false); end $$;
-- Come finisce un'istruzione: «ok», oppure «codice messaggio». 42501 è «non tocca a te».
create or replace function esito(sql text) returns text language plpgsql as $$
begin execute sql; return 'ok';
exception when others then return sqlstate || ' ' || sqlerrm;
end $$;
create or replace function da(utente text, ruolo text, sql text) returns text language plpgsql as $$
declare r text;
begin
  perform set_config('prova.utente', utente, false);
  execute format('set role %I', ruolo);
  r := esito(sql);
  reset role;
  return r;
end $$;
-- Le date si contano da oggi a Roma: la prova gira in qualunque giorno.
create or replace function giorno(indietro int) returns date language sql stable as $$
  select (now() at time zone 'Europe/Rome')::date - indietro $$;
-- Una lezione di un'ora, il giorno `indietro` giorni fa all'ora `ora` di Roma.
create or replace function alle(indietro int, ora text) returns timestamptz language sql stable as $$
  select ((giorno(indietro)::text || ' ' || ora)::timestamp at time zone 'Europe/Rome') $$;
-- La chiave di chi non è adulto, ricalcolata come la fa chat_iscritti: così la prova sa chi è chi senza la data.
create or replace function chiave_di(persona text, sale text default 'sale-di-prova-1234') returns text language sql immutable as $$
  select 'x' || md5(persona || sale) $$;
grant execute on function atteso(text, text, text), chi(text), esito(text), giorno(int), alle(int, text), chiave_di(text, text) to anon, authenticated;
-- L'ultimo 29 febbraio prima di oggi: chi è nato quel giorno ha meno di 6 anni.
select max(d)::date as bisesto from generate_series(giorno(0) - interval '4 years', giorno(0), interval '1 day') d where to_char(d, 'MMDD') = '0229' \gset

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'maura@ods.it'),
  ('33333333-3333-3333-3333-333333333333', 'ada@ods.it'),
  ('44444444-4444-4444-4444-444444444444', 'sandro@ods.it'),
  ('55555555-5555-5555-5555-555555555555', 'luca@ods.it'),
  ('66666666-6666-6666-6666-666666666666', 'senza@ods.it'),
  ('77777777-7777-7777-7777-777777777777', 'tablet@ods.it');
-- Il tablet della sala grande: un suo utente, nessuna persona.
insert into sale (id, nome) values ('bbbbbbbb-0000-0000-0000-000000000001', 'Sala del tablet');
insert into postazioni (id, nome, sala_id, utente_id) values
  ('dddddddd-0000-0000-0000-000000000001', 'Tablet sala grande', 'bbbbbbbb-0000-0000-0000-000000000001', '77777777-7777-7777-7777-777777777777');
-- Anna: segreteria. Maura: istruttore. Ada: solo amministrazione. Sandro: segreteria e amministrazione.
-- Luca: iscritto con l'accesso. «senza» ha un accesso ma nessuna scheda.
insert into persone (id, nome, cognome, ruolo, anche_amministrazione, email, telefono, utente_id, attiva) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', false, 'anna@ods.it', null, '11111111-1111-1111-1111-111111111111', true),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Maura', 'Uno', 'istruttore', false, 'maura@ods.it', null, '22222222-2222-2222-2222-222222222222', true),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Ada', 'Ragionieri', 'amministrazione', false, 'ada@ods.it', null, '33333333-3333-3333-3333-333333333333', true),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'Sandro', 'Doppio', 'staff', true, 'sandro@ods.it', null, '44444444-4444-4444-4444-444444444444', true),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'Luca', 'Conaccesso', 'iscritto', false, 'luca@ods.it', null, '55555555-5555-5555-5555-555555555555', true),
-- Gli iscritti.
  ('eeeeeeee-0000-0000-0000-000000000001', 'Mario', 'Bianchi', 'iscritto', false, 'mario@esempio.it', '3331234567', null, true),
  ('eeeeeeee-0000-0000-0000-000000000002', 'Gino', 'Diciottoggi', 'iscritto', false, null, null, null, true),
  ('eeeeeeee-0000-0000-0000-000000000003', 'Pia', 'Diciottodomani', 'iscritto', false, null, null, null, true),
  ('eeeeeeee-0000-0000-0000-000000000004', 'Lia', 'Verdi', 'iscritto', false, 'genitore.lia@esempio.it', '3339876543', null, true),
  ('eeeeeeee-0000-0000-0000-000000000005', 'Sergio', 'Senzadata', 'iscritto', false, null, null, null, true),
  ('eeeeeeee-0000-0000-0000-000000000006', 'Carlo', 'Russo', 'iscritto', false, null, null, null, true),
  ('eeeeeeee-0000-0000-0000-000000000007', 'Teo', 'Russo', 'iscritto', false, null, null, null, true),
  ('eeeeeeee-0000-0000-0000-000000000008', 'Emma', 'Russo', 'iscritto', false, null, null, null, true),
  ('eeeeeeee-0000-0000-0000-000000000009', 'Dario', 'Spento', 'iscritto', false, null, null, null, false),
  ('eeeeeeee-0000-0000-0000-000000000010', 'Franca', 'Fonti', 'iscritto', false, null, null, null, true),
  ('eeeeeeee-0000-0000-0000-000000000011', 'Nadia', 'Nulla', 'iscritto', false, null, null, null, true),
  ('eeeeeeee-0000-0000-0000-000000000012', 'Rita', 'Nonaccolta', 'iscritto', false, null, null, null, true),
  ('eeeeeeee-0000-0000-0000-000000000013', 'Pari', 'Tempo', 'iscritto', false, null, null, null, true),
  ('eeeeeeee-0000-0000-0000-000000000014', 'Cara', 'Creata', 'iscritto', false, null, null, null, true),
  ('eeeeeeee-0000-0000-0000-000000000015', 'Tizio', 'Provante', 'iscritto', false, null, '3330000000', null, true),
-- I piccoli: Bimbo compie 6 anni fra 20 giorni, Bisesto è nato il 29 febbraio, Seienne li compie oggi.
  ('eeeeeeee-0000-0000-0000-000000000016', 'Bimbo', 'Piccolo', 'iscritto', false, null, null, null, true),
  ('eeeeeeee-0000-0000-0000-000000000017', 'Bisesto', 'Febbraio', 'iscritto', false, null, null, null, true),
  ('eeeeeeee-0000-0000-0000-000000000018', 'Seienne', 'Oggi', 'iscritto', false, null, null, null, true);

-- Le date di nascita, con l'ora in cui sono state scritte (il trigger la metterebbe a adesso).
alter table anagrafiche disable trigger anagrafiche_cambiata;
insert into anagrafiche (persona_id, nato_il, codice_fiscale, cambiata_il) values
  ('aaaaaaaa-0000-0000-0000-000000000005', '1995-01-01', null, now()),
  ('eeeeeeee-0000-0000-0000-000000000001', '1980-05-10', 'BNCMRA80E10L219X', now()),
  ('eeeeeeee-0000-0000-0000-000000000002', (giorno(0) - interval '18 years')::date, null, now()),
  ('eeeeeeee-0000-0000-0000-000000000003', (giorno(-1) - interval '18 years')::date, null, now()),
  ('eeeeeeee-0000-0000-0000-000000000004', (giorno(0) - interval '10 years')::date, 'VRDLIA16D44L219X', now()),
  ('eeeeeeee-0000-0000-0000-000000000006', '1982-02-02', null, now()),
  ('eeeeeeee-0000-0000-0000-000000000007', (giorno(0) - interval '11 years')::date, null, now()),
  ('eeeeeeee-0000-0000-0000-000000000008', (giorno(0) - interval '9 years')::date, null, now()),
  ('eeeeeeee-0000-0000-0000-000000000009', '1970-01-01', null, now()),
  -- Franca: la scheda dice 1990, ma 10 giorni fa; la richiesta accolta ieri dice 2015.
  ('eeeeeeee-0000-0000-0000-000000000010', '1990-03-03', null, now() - interval '10 days'),
  -- Nadia: la scheda più recente non ha la data; la richiesta più vecchia sì.
  ('eeeeeeee-0000-0000-0000-000000000011', null, null, now() - interval '1 day'),
  -- Pari: scheda e richiesta nello stesso istante: vince la segreteria.
  ('eeeeeeee-0000-0000-0000-000000000013', '1980-08-08', null, '2026-01-10 10:00:00+01'),
  -- Cara: la scheda 5 giorni fa; la richiesta accolta senza gestita_il, creata 2 giorni fa.
  ('eeeeeeee-0000-0000-0000-000000000014', '1980-09-09', null, now() - interval '5 days'),
  ('eeeeeeee-0000-0000-0000-000000000016', (giorno(-20) - interval '6 years')::date, null, now()),
  ('eeeeeeee-0000-0000-0000-000000000017', :'bisesto', null, now()),
  ('eeeeeeee-0000-0000-0000-000000000018', (giorno(0) - interval '6 years')::date, null, now());
alter table anagrafiche enable trigger anagrafiche_cambiata;

create or replace function richiesta(persona uuid, nato date, st text, gestita timestamptz, creata timestamptz) returns void
  language sql as $$
  insert into richieste_iscrizione (nome, cognome, nato_il, nato_a, codice_fiscale, indirizzo, cap, comune, email, telefono,
                                    corsi, formula, persona_id, stato, gestita_il, creata_il)
  values ('X', 'Y', nato, 'Torino', 'XXXYYY15C03L219Z', 'via Roma 1', '10100', 'Torino', 'richiesta@esempio.it', '3335550000',
          array['cccccccc-0000-0000-0000-000000000001'::uuid], 'annuale', persona, st::stato_richiesta, gestita, creata)
$$;
select richiesta('eeeeeeee-0000-0000-0000-000000000010', '2015-03-03', 'accolta', now() - interval '1 day', now() - interval '20 days');
select richiesta('eeeeeeee-0000-0000-0000-000000000011', '1985-04-04', 'accolta', now() - interval '30 days', now() - interval '40 days');
select richiesta('eeeeeeee-0000-0000-0000-000000000012', '1985-05-05', 'nuova', null, now() - interval '1 day');
select richiesta('eeeeeeee-0000-0000-0000-000000000013', '2015-06-06', 'accolta', '2026-01-10 10:00:00+01', '2026-01-01 10:00:00+01');
select richiesta('eeeeeeee-0000-0000-0000-000000000014', '2014-07-07', 'accolta', null, now() - interval '2 days');

-- Certificati e pagamenti scritti a mano, con la nota.
insert into schede_iscritti (persona_id, certificato_scade, pagamento, pagato_fino, pagamento_nota) values
  ('eeeeeeee-0000-0000-0000-000000000001', '2026-10-01', 'da_pagare', null, 'paga la zia'),
  ('eeeeeeee-0000-0000-0000-000000000002', '2027-06-30', 'pagato', '2027-08-31', null),
  ('eeeeeeee-0000-0000-0000-000000000009', '2026-09-01', 'da_pagare', null, null);
-- La quota di Mario: 150 € con 30 pagati, ricevuta n. 4242 con una nota.
insert into ricevute (anno, numero, data, persona_id, ente, intestatario, voci, totale, pagato, anticipo, note) values
  (2026, 4242, giorno(30), 'eeeeeeee-0000-0000-0000-000000000001', '{}', '{"nome": "Mario", "cognome": "Bianchi"}',
   '[{"descrizione": "QUOTA ASSOCIATIVA", "quantita": 1, "prezzo": 15000, "dal": "2026-09-01", "al": "2027-08-31",
      "pagamenti": [{"data": "2026-09-20", "importo": 3000, "metodo": "Contanti"}]}]', 15000, 3000, 0, 'ricevuta segreta');
-- La quota dell'anno prima, pagata tutta, scritta dopo: nelle quote viene prima (anno, numero, dal, al).
insert into ricevute (anno, numero, data, persona_id, ente, intestatario, voci, totale, pagato, anticipo) values
  (2025, 17, giorno(300), 'eeeeeeee-0000-0000-0000-000000000001', '{}', '{"nome": "Mario", "cognome": "Bianchi"}',
   '[{"descrizione": "QUOTA ASSOCIATIVA", "quantita": 1, "prezzo": 15000, "dal": "2025-09-01", "al": "2026-08-31",
      "pagamenti": [{"data": "2025-09-10", "importo": 15000, "metodo": "Contanti"}]}]', 15000, 15000, 0);

-- I corsi: Judo, Yoga, Pilates (senza iscritti), Karate (Mario ci entra fra 5 giorni), Danza (c'è Anna, della
-- segreteria: il registro dell'app la mostra, e così quello della chat).
insert into corsi (id, nome) values
  ('cccccccc-0000-0000-0000-000000000001', 'Judo'),
  ('cccccccc-0000-0000-0000-000000000002', 'Yoga'),
  ('cccccccc-0000-0000-0000-000000000003', 'Pilates'),
  ('cccccccc-0000-0000-0000-000000000004', 'Karate'),
  ('cccccccc-0000-0000-0000-000000000005', 'Danza');
insert into iscrizioni (corso_id, persona_id, dal, al) values
  ('cccccccc-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001', giorno(60), null),
  ('cccccccc-0000-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-000000000001', giorno(60), giorno(10)),
  ('cccccccc-0000-0000-0000-000000000004', 'eeeeeeee-0000-0000-0000-000000000001', giorno(-5), null),
  ('cccccccc-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000002', giorno(60), null),
  ('cccccccc-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000003', giorno(60), null),
  ('cccccccc-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000004', giorno(60), giorno(4)),
  ('cccccccc-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000005', giorno(60), null),
  ('cccccccc-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000009', giorno(60), null),
  ('cccccccc-0000-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-000000000006', giorno(60), null),
  ('cccccccc-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001', giorno(60), null);

-- Le lezioni. Judo: 9, 6 e 3 giorni fa, una 70 giorni fa, una fra 2 giorni, una fra un minuto.
-- Pilates: 5 giorni fa alle 18, e 8 giorni fa a mezzanotte e mezza (a Roma è già quel giorno, in UTC no).
-- Danza: 4 giorni fa.
insert into sessioni (id, corso_id, inizio, fine, stato) values
  ('abababab-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', alle(9, '18:00'), alle(9, '19:00'), 'svolta'),
  ('abababab-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000001', alle(6, '18:00'), alle(6, '19:00'), 'svolta'),
  ('abababab-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-000000000001', alle(3, '18:00'), alle(3, '19:00'), 'svolta'),
  ('abababab-0000-0000-0000-000000000004', 'cccccccc-0000-0000-0000-000000000001', alle(70, '18:00'), alle(70, '19:00'), 'svolta'),
  ('abababab-0000-0000-0000-000000000005', 'cccccccc-0000-0000-0000-000000000001', alle(-2, '18:00'), alle(-2, '19:00'), 'prevista'),
  ('abababab-0000-0000-0000-000000000006', 'cccccccc-0000-0000-0000-000000000001', now() + interval '1 minute', now() + interval '61 minutes', 'prevista'),
  ('abababab-0000-0000-0000-000000000007', 'cccccccc-0000-0000-0000-000000000003', alle(5, '18:00'), alle(5, '19:00'), 'svolta'),
  ('abababab-0000-0000-0000-000000000008', 'cccccccc-0000-0000-0000-000000000003', alle(8, '00:30'), alle(8, '01:30'), 'svolta'),
  ('abababab-0000-0000-0000-000000000009', 'cccccccc-0000-0000-0000-000000000005', alle(4, '18:00'), alle(4, '19:00'), 'svolta');
insert into presenze (sessione_id, persona_id, stato) values
  ('abababab-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001', 'presente'),
  ('abababab-0000-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-000000000001', 'assente'),
  ('abababab-0000-0000-0000-000000000003', 'eeeeeeee-0000-0000-0000-000000000001', 'assente'),
  ('abababab-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000002', 'giustificato'),
  ('abababab-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000004', 'assente'),
  ('abababab-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000009', 'assente');
-- Tizio è venuto a provare il Judo 6 giorni fa; un'altra prova sulla lezione fra 2 giorni.
insert into prove (sessione_id, persona_id) values
  ('abababab-0000-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-000000000015'),
  ('abababab-0000-0000-0000-000000000005', 'eeeeeeee-0000-0000-0000-000000000015');

\echo ''
\echo '--- 1. solo la segreteria ---'
select atteso('la segreteria legge chat_iscritti', da('11111111-1111-1111-1111-111111111111', 'authenticated', 'select count(*) from chat_iscritti(''sale-di-prova-1234'')'), 'ok');
select atteso('…e chat_registro e chat_prove', da('11111111-1111-1111-1111-111111111111', 'authenticated', format('select count(*) from chat_registro(%L, %L, ''sale-di-prova-1234'') join chat_prove(%L, %L) using (sessione_id)', giorno(60), giorno(0), giorno(60), giorno(0))), 'ok');
select atteso('segreteria e amministrazione pure', da('44444444-4444-4444-4444-444444444444', 'authenticated', 'select count(*) from chat_iscritti(''sale-di-prova-1234'')'), 'ok');
select atteso('un istruttore: «Questa parte è per la segreteria»', da('22222222-2222-2222-2222-222222222222', 'authenticated', 'select count(*) from chat_iscritti(''sale-di-prova-1234'')'), '42501 Questa parte è per la segreteria');
select atteso('…anche per il registro', da('22222222-2222-2222-2222-222222222222', 'authenticated', format('select count(*) from chat_registro(%L, %L, ''sale-di-prova-1234'')', giorno(60), giorno(0))), '42501 Questa parte è per la segreteria');
select atteso('…e per le prove', da('22222222-2222-2222-2222-222222222222', 'authenticated', format('select count(*) from chat_prove(%L, %L)', giorno(60), giorno(0))), '42501 Questa parte è per la segreteria');
select atteso('la sola amministrazione: no', da('33333333-3333-3333-3333-333333333333', 'authenticated', 'select count(*) from chat_iscritti(''sale-di-prova-1234'')'), '42501 Questa parte è per la segreteria');
select atteso('un iscritto: no', da('55555555-5555-5555-5555-555555555555', 'authenticated', 'select count(*) from chat_iscritti(''sale-di-prova-1234'')'), '42501 Questa parte è per la segreteria');
select atteso('un accesso senza scheda: no', da('66666666-6666-6666-6666-666666666666', 'authenticated', 'select count(*) from chat_iscritti(''sale-di-prova-1234'')'), '42501 Questa parte è per la segreteria');
select atteso('il tablet di sala, col suo utente: «Questa parte è per la segreteria»', da('77777777-7777-7777-7777-777777777777', 'authenticated', 'select count(*) from chat_iscritti(''sale-di-prova-1234'')'), '42501 Questa parte è per la segreteria');
select atteso('…anche per il registro', da('77777777-7777-7777-7777-777777777777', 'authenticated', format('select count(*) from chat_registro(%L, %L, ''sale-di-prova-1234'')', giorno(60), giorno(0))), '42501 Questa parte è per la segreteria');
select atteso('…e per le prove', da('77777777-7777-7777-7777-777777777777', 'authenticated', format('select count(*) from chat_prove(%L, %L)', giorno(60), giorno(0))), '42501 Questa parte è per la segreteria');
select atteso('chi non ha fatto l''accesso non la chiama nemmeno', da('', 'anon', 'select count(*) from chat_iscritti(''sale-di-prova-1234'')'), '42501 permission denied for function chat_iscritti');
select atteso('…né chat_registro', da('', 'anon', format('select count(*) from chat_registro(%L, %L, ''sale-di-prova-1234'')', giorno(60), giorno(0))), '42501 permission denied for function chat_registro');
select atteso('…né chat_prove', da('', 'anon', format('select count(*) from chat_prove(%L, %L)', giorno(60), giorno(0))), '42501 permission denied for function chat_prove');
select atteso('la segreteria non chiama chat_nato_il, che è interna', da('11111111-1111-1111-1111-111111111111', 'authenticated', $$select chat_nato_il('eeeeeeee-0000-0000-0000-000000000001')$$), '42501 permission denied for function chat_nato_il');
select atteso('…né chat_eta', da('11111111-1111-1111-1111-111111111111', 'authenticated', $$select chat_eta('2000-01-01', '2026-01-01')$$), '42501 permission denied for function chat_eta');

\echo ''
\echo '--- 2. grant, security definer, stable: niente ad anon, nessuna scrittura ---'
select atteso('anon non ha execute su nessuna delle sei',
  ((select string_agg(f, ',' order by f) from unnest(array['chat_iscritti(text)', 'chat_registro(date,date,text)', 'chat_prove(date,date)', 'chat_nato_il(uuid)', 'chat_eta(date,date)', 'chat_sale(text)']) f
    where has_function_privilege('anon', f, 'execute')) is null)::text, 'true');
select atteso('authenticated ha execute solo sulle tre della chat',
  (select string_agg(f, ',' order by f) from unnest(array['chat_iscritti(text)', 'chat_registro(date,date,text)', 'chat_prove(date,date)', 'chat_nato_il(uuid)', 'chat_eta(date,date)', 'chat_sale(text)']) f
    where has_function_privilege('authenticated', f, 'execute')), 'chat_iscritti(text),chat_prove(date,date),chat_registro(date,date,text)');
select atteso('le tre sono security definer, stable, con search_path = public, extensions',
  (select string_agg(p.proname || ':' || p.prosecdef::text || ':' || p.provolatile::text || ':' || coalesce(array_to_string(p.proconfig, ';'), ''), ',' order by p.proname)
     from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('chat_iscritti', 'chat_registro', 'chat_prove')),
  'chat_iscritti:true:s:search_path=public, extensions,chat_prove:true:s:search_path=public, extensions,chat_registro:true:s:search_path=public, extensions');
select atteso('anche le interne non scrivono (stable o immutable)',
  (select string_agg(p.proname || ':' || (p.provolatile in ('s', 'i'))::text, ',' order by p.proname)
     from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('chat_nato_il', 'chat_eta', 'chat_sale')),
  'chat_eta:true,chat_nato_il:true,chat_sale:true');
select atteso('chat_eta è stable (legge il fuso di oggi), non immutable',
  (select p.provolatile::text from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'chat_eta'), 's');
select atteso('chat_iscritti: le colonne della specifica, niente di più',
  pg_get_function_result('chat_iscritti(text)'::regprocedure),
  'TABLE(chiave text, nome text, cognome text, eta text, sei_anni date, certificato_scade date, pagamento text, pagato_fino date, quote jsonb, corsi uuid[])');
select atteso('chat_registro: le colonne della specifica',
  pg_get_function_result('chat_registro(date,date,text)'::regprocedure),
  'TABLE(sessione_id uuid, corso_id uuid, corso text, inizio timestamp with time zone, stato text, chiave text, nome text, cognome text, eta text, presenza text)');
select atteso('chat_prove: solo quante, mai chi',
  pg_get_function_result('chat_prove(date,date)'::regprocedure),
  'TABLE(sessione_id uuid, corso_id uuid, inizio timestamp with time zone, prove integer)');

\echo ''
\echo '--- 3. l''età: 18 anni, il 29 febbraio, senza data ---'
select atteso('compie 18 anni oggi: adulto', chat_eta('2008-10-20', '2026-10-20'), 'adulto');
select atteso('…ieri era minore', chat_eta('2008-10-20', '2026-10-19'), 'minore');
select atteso('nato il 29 febbraio: il 28 febbraio di un anno non bisestile ancora minore', chat_eta('2008-02-29', '2026-02-28'), 'minore');
select atteso('…adulto dal 1° marzo', chat_eta('2008-02-29', '2026-03-01'), 'adulto');
select atteso('senza data: non si sa', chat_eta(null, '2026-10-20'), 'non_si_sa');
select atteso('Gino, che compie 18 anni oggi, ieri era minore', chat_eta((giorno(0) - interval '18 years')::date, giorno(1)), 'minore');

\echo ''
\echo '--- 4. la data di nascita: vince la fonte più recente ---'
select atteso('la richiesta accolta più recente vince sulla scheda', chat_nato_il('eeeeeeee-0000-0000-0000-000000000010')::text, '2015-03-03');
select atteso('la scheda più recente senza data: la data non c''è (non si torna alla richiesta)', coalesce(chat_nato_il('eeeeeeee-0000-0000-0000-000000000011')::text, 'nessuna'), 'nessuna');
select atteso('una richiesta non accolta non conta', coalesce(chat_nato_il('eeeeeeee-0000-0000-0000-000000000012')::text, 'nessuna'), 'nessuna');
select atteso('a parità vince la segreteria', chat_nato_il('eeeeeeee-0000-0000-0000-000000000013')::text, '1980-08-08');
select atteso('senza gestita_il conta creata_il', chat_nato_il('eeeeeeee-0000-0000-0000-000000000014')::text, '2014-07-07');
select atteso('solo la scheda', chat_nato_il('eeeeeeee-0000-0000-0000-000000000001')::text, '1980-05-10');
select atteso('nessuna fonte', coalesce(chat_nato_il('eeeeeeee-0000-0000-0000-000000000005')::text, 'nessuna'), 'nessuna');

\echo ''
\echo '--- 5. chat_iscritti, come la vede la segreteria ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('gli iscritti attivi, e solo loro (non Dario, disattivato; non lo staff)', (select count(*)::text from chat_iscritti('sale-di-prova-1234')), '18');
select atteso('Dario, disattivato col certificato scaduto, non c''è', (select count(*)::text from chat_iscritti('sale-di-prova-1234') where cognome = 'Spento' or certificato_scade = '2026-09-01'), '0');
select atteso('nessuno dello staff', (select count(*)::text from chat_iscritti('sale-di-prova-1234') where nome in ('Anna', 'Maura', 'Ada', 'Sandro')), '0');
select atteso('…nemmeno Anna, che pure è iscritta alla Danza (lei non ha la data: avrebbe una chiave «x»)',
  (select count(*)::text from chat_iscritti('sale-di-prova-1234') where chiave = chiave_di('aaaaaaaa-0000-0000-0000-000000000001')), '0');
select atteso('Mario, adulto: nome, cognome, la sua chiave è il suo id, nessun giorno dei 6 anni',
  (select concat_ws('|', nome, cognome, eta, chiave, coalesce(sei_anni::text, '-')) from chat_iscritti('sale-di-prova-1234') where nome = 'Mario'),
  'Mario|Bianchi|adulto|eeeeeeee-0000-0000-0000-000000000001|-');
select atteso('…il certificato scaduto il 1° ottobre e il pagamento scritto a mano, senza la nota',
  (select concat_ws('|', certificato_scade, pagamento, coalesce(pagato_fino::text, '-')) from chat_iscritti('sale-di-prova-1234') where nome = 'Mario'), '2026-10-01|da_pagare|-');
select atteso('…la quota: dal, al, quanto manca; mai anno né numero della ricevuta',
  (select string_agg(distinct k, ',' order by k) from chat_iscritti('sale-di-prova-1234') c, jsonb_array_elements(c.quote) q, jsonb_object_keys(q) k where c.nome = 'Mario'), 'al,dal,mancano');
select atteso('…mancano 120,00 €', (select (q->>'mancano') from chat_iscritti('sale-di-prova-1234') c, jsonb_array_elements(c.quote) q where c.nome = 'Mario' and q->>'dal' = '2026-09-01'), '12000');
select atteso('…le quote in ordine come nell''app (anno, numero, dal, al): prima quella del 2025, scritta dopo',
  (select string_agg(concat_ws('~', q->>'dal', q->>'al', q->>'mancano'), ',' order by n) from chat_iscritti('sale-di-prova-1234') c, jsonb_array_elements(c.quote) with ordinality as e(q, n) where c.nome = 'Mario'),
  '2025-09-01~2026-08-31~0,2026-09-01~2027-08-31~12000');
select atteso('…i corsi in corso oggi: il Judo, non lo Yoga finito né il Karate che comincia fra 5 giorni',
  (select corsi::text from chat_iscritti('sale-di-prova-1234') where nome = 'Mario'), '{cccccccc-0000-0000-0000-000000000001}');
select atteso('mai telefono, email, codice fiscale, nota del pagamento, ricevuta',
  (select count(*)::text from chat_iscritti('sale-di-prova-1234') c
    where concat_ws('|', c.nome, c.cognome, c.eta, c.sei_anni, c.certificato_scade, c.pagamento, c.pagato_fino, c.quote, c.corsi)
          ~* '(esempio\.it|3331234567|3339876543|3330000000|BNCMRA|VRDLIA|zia|segreta|4242)'), '0');
select atteso('Gino compie 18 anni oggi: c''è col nome', (select concat_ws('|', nome, eta) from chat_iscritti('sale-di-prova-1234') where cognome = 'Diciottoggi'), 'Gino|adulto');
select atteso('Pia li compie domani: minore, senza nome, nessuna data (i 6 anni li ha da un pezzo)',
  (select concat_ws('|', coalesce(nome, '-'), coalesce(cognome, '-'), eta, coalesce(sei_anni::text, '-')) from chat_iscritti('sale-di-prova-1234') where chiave = chiave_di('eeeeeeee-0000-0000-0000-000000000003')), '-|-|minore|-');
select atteso('Lia, 10 anni: nome e cognome nulli, nessuna data',
  (select concat_ws('|', coalesce(nome, '-'), coalesce(cognome, '-'), eta, coalesce(sei_anni::text, '-')) from chat_iscritti('sale-di-prova-1234') where chiave = chiave_di('eeeeeeee-0000-0000-0000-000000000004')), '-|-|minore|-');
select atteso('…la chiave di chi non è adulto non è il suo id: «x» e 32 caratteri',
  (select bool_and(chiave like 'x%' and length(chiave) = 33 and chiave not like '%eeeeeeee%')::text from chat_iscritti('sale-di-prova-1234') where eta <> 'adulto'), 'true');
select atteso('nessun nome di chi non è adulto', (select count(*)::text from chat_iscritti('sale-di-prova-1234') where eta <> 'adulto' and (nome is not null or cognome is not null)), '0');
select atteso('Bimbo compie 6 anni fra 20 giorni: il giorno dei 6 anni, senza nome',
  (select concat_ws('|', coalesce(nome, '-'), eta, sei_anni) from chat_iscritti('sale-di-prova-1234') where chiave = chiave_di('eeeeeeee-0000-0000-0000-000000000016')),
  '-|minore|' || giorno(-20)::text);
select atteso('Bisesto, nato il 29 febbraio: i 6 anni li compie il 1° marzo (l''anno dei 6 anni non è bisestile)',
  (select sei_anni::text from chat_iscritti('sale-di-prova-1234') where chiave = chiave_di('eeeeeeee-0000-0000-0000-000000000017')),
  make_date(extract(year from :'bisesto'::date)::int + 6, 3, 1)::text);
select atteso('Seienne li compie oggi: li ha compiuti, nessuna data',
  (select concat_ws('|', eta, coalesce(sei_anni::text, '-')) from chat_iscritti('sale-di-prova-1234') where chiave = chiave_di('eeeeeeee-0000-0000-0000-000000000018')), 'minore|-');
select atteso('il giorno dei 6 anni solo per i due che non li hanno compiuti, e sempre dopo oggi',
  (select count(*)::text || '|' || bool_and(eta = 'minore' and sei_anni > giorno(0))::text from chat_iscritti('sale-di-prova-1234') where sei_anni is not null), '2|true');
select atteso('…mai per un adulto o per chi non si sa', (select count(*)::text from chat_iscritti('sale-di-prova-1234') where eta <> 'minore' and sei_anni is not null), '0');
select atteso('senza data di nascita (Sergio, Nadia, Rita, Tizio che è venuto a provare): non si sa, senza nome',
  (select count(*)::text from chat_iscritti('sale-di-prova-1234') where eta = 'non_si_sa' and nome is null and cognome is null and sei_anni is null), '4');
select atteso('Franca: vince la richiesta accolta, è minore', (select count(*)::text from chat_iscritti('sale-di-prova-1234') where chiave = chiave_di('eeeeeeee-0000-0000-0000-000000000010') and eta = 'minore' and nome is null), '1');
select atteso('Pari: a parità vince la scheda, è adulto col nome', (select concat_ws('|', nome, eta) from chat_iscritti('sale-di-prova-1234') where cognome = 'Tempo'), 'Pari|adulto');
select atteso('Cara: la richiesta senza gestita_il, creata dopo la scheda, vince', (select count(*)::text from chat_iscritti('sale-di-prova-1234') where chiave = chiave_di('eeeeeeee-0000-0000-0000-000000000014') and eta = 'minore'), '1');
select atteso('il nucleo: di «Russo» solo Carlo, il genitore', (select string_agg(nome, ',') from chat_iscritti('sale-di-prova-1234') where cognome = 'Russo'), 'Carlo');
select atteso('…i due figli ci sono, come minori', (select count(*)::text from chat_iscritti('sale-di-prova-1234') where eta = 'minore' and chiave in (chiave_di('eeeeeeee-0000-0000-0000-000000000007'), chiave_di('eeeeeeee-0000-0000-0000-000000000008'))), '2');
select atteso('chi è venuto a provare non c''è per nome', (select count(*)::text from chat_iscritti('sale-di-prova-1234') where nome = 'Tizio' or cognome = 'Provante'), '0');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
select string_agg(chiave, ',' order by chiave) as chiavi_1 from chat_iscritti('sale-di-prova-1234') where eta <> 'adulto' \gset
select string_agg(chiave, ',' order by chiave) as chiavi_2 from chat_iscritti('un-altro-sale-5678') where eta <> 'adulto' \gset
-- La chiave di chi non è adulto è md5 dell'id col «sale» che il server sceglie a caso per ogni domanda: la stessa in
-- tutte le pagine di una risposta (il server legge a pagine), diversa da una domanda all'altra.
select atteso('le chiavi dei minori cambiano col sale (da una domanda all''altra): nessuna in comune',
  (select count(*)::text from unnest(string_to_array(:'chiavi_1', ',')) a join unnest(string_to_array(:'chiavi_2', ',')) b on a = b), '0');
select atteso('…e sono md5 dell''id col sale', (select chiave from chat_iscritti('un-altro-sale-5678') where chiave = chiave_di('eeeeeeee-0000-0000-0000-000000000004', 'un-altro-sale-5678')), chiave_di('eeeeeeee-0000-0000-0000-000000000004', 'un-altro-sale-5678'));
select string_agg(chiave, ',' order by chiave) as chiavi_3 from chat_iscritti('sale-di-prova-1234') where eta <> 'adulto' \gset
select atteso('…e con lo stesso sale sono le stesse, anche in un''altra transazione (un''altra pagina)', (:'chiavi_1' = :'chiavi_3')::text, 'true');
select atteso('senza sale: no', esito('select count(*) from chat_iscritti('''')'), '22023 Manca il sale della domanda');
select atteso('…né col sale nullo', esito('select count(*) from chat_registro(current_date, current_date, null)'), '22023 Manca il sale della domanda');
select atteso('…dentro una chiamata è la stessa (registro e iscritti insieme): Pia e Lia del Judo',
  (select count(distinct r.chiave)::text from chat_registro(giorno(60), giorno(0), 'sale-di-prova-1234') r
     where r.eta = 'minore' and r.chiave in (select i.chiave from chat_iscritti('sale-di-prova-1234') i where i.eta = 'minore')), '2');

\echo ''
\echo '--- 6. chat_registro: lezioni e iscritti (anche dello staff), giorni di Roma, mai dopo adesso, al massimo un anno ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('ultimi 60 giorni: le 3 lezioni di Judo, le 2 di Pilates e quella di Danza (non quella di 70 giorni fa, né quelle che vengono)',
  (select count(distinct sessione_id)::text from chat_registro(giorno(60), giorno(0), 'sale-di-prova-1234')), '6');
select atteso('la lezione di 9 giorni fa: Mario, Gino, Pia, Lia, Sergio (non Dario, disattivato)',
  (select count(*)::text from chat_registro(giorno(60), giorno(0), 'sale-di-prova-1234') where sessione_id = 'abababab-0000-0000-0000-000000000001'), '5');
select atteso('3 giorni fa Lia non era più iscritta', (select count(*)::text from chat_registro(giorno(60), giorno(0), 'sale-di-prova-1234') where sessione_id = 'abababab-0000-0000-0000-000000000003'), '4');
select atteso('Dario non c''è mai', (select count(*)::text from chat_registro(giorno(60), giorno(0), 'sale-di-prova-1234') where cognome = 'Spento'), '0');
select atteso('Mario: presente, assente, assente',
  (select string_agg(presenza, ',' order by inizio) from chat_registro(giorno(60), giorno(0), 'sale-di-prova-1234') where nome = 'Mario'), 'presente,assente,assente');
select atteso('…col nome del corso e lo stato della lezione',
  (select concat_ws('|', corso, stato) from chat_registro(giorno(60), giorno(0), 'sale-di-prova-1234') where nome = 'Mario' and sessione_id = 'abababab-0000-0000-0000-000000000001'), 'Judo|svolta');
select atteso('Gino ha 18 anni da oggi: ha il nome anche nella lezione di 9 giorni fa (giustificato)',
  (select concat_ws('|', nome, eta, presenza) from chat_registro(giorno(60), giorno(0), 'sale-di-prova-1234') where sessione_id = 'abababab-0000-0000-0000-000000000001' and cognome = 'Diciottoggi'), 'Gino|adulto|giustificato');
select atteso('chi non è segnato: presenza nulla', (select count(*)::text from chat_registro(giorno(60), giorno(0), 'sale-di-prova-1234') where sessione_id = 'abababab-0000-0000-0000-000000000002' and presenza is null), '4');
select atteso('Lia, minore: assente, senza nome',
  (select concat_ws('|', coalesce(nome, '-'), coalesce(cognome, '-'), eta, presenza) from chat_registro(giorno(60), giorno(0), 'sale-di-prova-1234') where sessione_id = 'abababab-0000-0000-0000-000000000001' and presenza = 'assente'), '-|-|minore|assente');
select atteso('nessun nome di chi non è adulto', (select count(*)::text from chat_registro(giorno(60), giorno(0), 'sale-di-prova-1234') where eta <> 'adulto' and (nome is not null or cognome is not null)), '0');
select atteso('la chiave di un adulto è il suo id', (select chiave from chat_registro(giorno(60), giorno(0), 'sale-di-prova-1234') where nome = 'Mario' limit 1), 'eeeeeeee-0000-0000-0000-000000000001');
select atteso('una lezione senza iscritti c''è lo stesso, con una riga senza chiave',
  (select string_agg(coalesce(chiave, '-') || '|' || coalesce(presenza, '-'), ',') from chat_registro(giorno(60), giorno(0), 'sale-di-prova-1234') where sessione_id = 'abababab-0000-0000-0000-000000000007'), '-|-');
select atteso('la lezione a mezzanotte e mezza è del suo giorno di Roma',
  (select string_agg(distinct sessione_id::text, ',') from chat_registro(giorno(8), giorno(8), 'sale-di-prova-1234')), 'abababab-0000-0000-0000-000000000008');
select atteso('…e non del giorno prima (in UTC lo sarebbe)',
  (select string_agg(distinct sessione_id::text, ',') from chat_registro(giorno(9), giorno(9), 'sale-di-prova-1234')), 'abababab-0000-0000-0000-000000000001');
select atteso('oggi e i giorni che vengono: niente dopo adesso',
  (select count(*)::text from chat_registro(giorno(0), giorno(-5), 'sale-di-prova-1234')), '0');
select atteso('chi è venuto a provare non c''è', (select count(*)::text from chat_registro(giorno(60), giorno(0), 'sale-di-prova-1234') where nome = 'Tizio' or cognome = 'Provante'), '0');
select atteso('Anna, della segreteria, iscritta alla Danza: c''è, come nel registro dell''app; senza data, quindi senza nome',
  (select string_agg(concat_ws('|', (chiave = chiave_di('aaaaaaaa-0000-0000-0000-000000000001'))::text, coalesce(nome, '-'), coalesce(cognome, '-'), eta, coalesce(presenza, '-')), ',')
     from chat_registro(giorno(60), giorno(0), 'sale-di-prova-1234') where sessione_id = 'abababab-0000-0000-0000-000000000009'),
  'true|-|-|non_si_sa|-');
select atteso('un anno e un giorno (366 giorni) si legge', esito(format('select count(*) from chat_registro(%L, %L, ''sale-di-prova-1234'')', giorno(366), giorno(0))), 'ok');
select atteso('…più di così no: «Al massimo un anno alla volta»', esito(format('select count(*) from chat_registro(%L, %L, ''sale-di-prova-1234'')', giorno(367), giorno(0))), '22023 Al massimo un anno alla volta');
select atteso('…né per tre anni', esito(format('select count(*) from chat_registro(%L, %L, ''sale-di-prova-1234'')', giorno(1100), giorno(0))), '22023 Al massimo un anno alla volta');

\echo ''
\echo '--- 7. chat_prove: quante, mai chi ---'
select atteso('una prova 6 giorni fa nel Judo', (select prove::text from chat_prove(giorno(60), giorno(0)) where sessione_id = 'abababab-0000-0000-0000-000000000002'), '1');
select atteso('…col corso e l''inizio della lezione',
  (select (corso_id = 'cccccccc-0000-0000-0000-000000000001' and inizio = alle(6, '18:00'))::text from chat_prove(giorno(60), giorno(0)) where sessione_id = 'abababab-0000-0000-0000-000000000002'), 'true');
select atteso('la prova sulla lezione fra 2 giorni non conta', (select coalesce(sum(prove), 0)::text from chat_prove(giorno(60), giorno(0))), '1');
select atteso('fuori dai giorni chiesti, niente', (select coalesce(sum(prove), 0)::text from chat_prove(giorno(5), giorno(0))), '0');
reset role;

\echo ''
\echo '--- 8. le funzioni non hanno scritto niente ---'
select atteso('persone, presenze, prove, schede come prima',
  (select concat_ws('|', (select count(*) from persone), (select count(*) from presenze), (select count(*) from prove), (select count(*) from schede_iscritti), (select count(*) from anagrafiche))),
  '23|6|2|3|16');
