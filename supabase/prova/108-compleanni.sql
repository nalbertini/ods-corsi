-- Chi compie gli anni oggi (108-compleanni.sql): due letture che restituiscono SOLO l'id della persona.
--   · `compleanni_sala(sessione)`: per il tablet, nella stessa finestra di `elenco_sala`, e solo se la postazione ha
--     `compleanni` acceso (di default spento: lo accende la segreteria);
--   · `compleanni_lezione(sessione)`: per chi lavora in palestra; l'istruttore solo per le lezioni che fa o insegna
--     (come `insegna()` e `istruttore_id` di sessioni_aggiorna), la segreteria per tutte.
-- Fonte: `chat_nato_il` (la più recente fra scheda e richiesta accolta), giorno e mese di Roma, il 29 febbraio si
-- festeggia il 1° marzo negli anni non bisestili. Solo persone attive con l'iscrizione valida il giorno della lezione.
-- Si lancia dopo tablet.sql (sale, postazioni, corsi e lezioni) (e lo schema di 75-chat-segreteria.sql), su un database suo.
\set ON_ERROR_STOP on
-- In UTC, come Supabase: giorno e mese devono venire da `at time zone 'Europe/Rome'`, non dal fuso della sessione.
set timezone = 'UTC';

create or replace function atteso(cosa text, avuto text, voluto text) returns text language plpgsql as $$
begin
  if avuto is distinct from voluto and not (voluto like '%…' and avuto like replace(voluto, '…', '%')) then
    raise exception '% · atteso «%», avuto «%»', cosa, voluto, avuto;
  end if;
  return 'ok  ' || cosa || ' → ' || avuto;
end $$;
select (to_regprocedure('public.compleanni_sala(uuid)') is not null
    and to_regprocedure('public.compleanni_lezione(uuid)') is not null
    and exists (select 1 from information_schema.columns where table_name = 'postazioni' and column_name = 'compleanni'))::text as c107 \gset
select atteso('108-compleanni.sql è stato lanciato: compleanni_sala, compleanni_lezione, postazioni.compleanni', :'c107', 'true');

-- I nomi di chi la funzione restituisce, oppure il codice dell'errore. Si chiama da superutente: cambia ruolo da sé,
-- perché un tablet o un istruttore le persone non le leggono e i nomi servono a chi legge la prova.
create or replace function elenca(utente text, ruolo text, sql text) returns text language plpgsql as $$
declare ids uuid[];
begin
  perform set_config('prova.utente', utente, false);
  execute format('set role %I', ruolo);
  begin execute sql into ids;
  exception when others then reset role; return sqlstate; end;
  reset role;
  return coalesce((select string_agg(nome, ', ' order by nome) from persone where id = any(ids)), '(nessuno)');
end $$;

create or replace function oggi() returns date language sql as $$ select (now() at time zone 'Europe/Rome')::date $$;
-- Il compleanno di chi ha 20 anni, `n` giorni da oggi (20 anni: lo stesso anno bisestile o no di quello in corso).
create or replace function nato(n int) returns date language sql as $$ select (oggi() + n - interval '20 years')::date $$;

-- Gli account in più: un istruttore che insegna solo il Judo, e un iscritto con un accesso.
insert into auth.users (id, email) values
  ('cccccccc-1111-1111-1111-111111111111', 'giorgio@ods.it'),
  ('dddddddd-1111-1111-1111-111111111111', 'iscritto@ods.it');
insert into persone (id, nome, cognome, ruolo, attiva, utente_id) values
  ('ffffffff-0000-0000-0000-000000000001', 'Giorgio', 'Judo', 'istruttore', true, 'cccccccc-1111-1111-1111-111111111111'),
  ('ffffffff-0000-0000-0000-000000000002', 'Iscritto', 'Qualunque', 'iscritto', true, 'dddddddd-1111-1111-1111-111111111111'),
  ('ffffffff-0000-0000-0000-000000000011', 'Oggi', 'Compie', 'iscritto', true, null),
  ('ffffffff-0000-0000-0000-000000000012', 'Ieri', 'Compiuto', 'iscritto', true, null),
  ('ffffffff-0000-0000-0000-000000000013', 'Domani', 'Compie', 'iscritto', true, null),
  ('ffffffff-0000-0000-0000-000000000014', 'Bisesto', 'Febbraio', 'iscritto', true, null),
  ('ffffffff-0000-0000-0000-000000000015', 'Richiesta', 'Vince', 'iscritto', true, null),
  ('ffffffff-0000-0000-0000-000000000016', 'Scheda', 'Vince', 'iscritto', true, null),
  ('ffffffff-0000-0000-0000-000000000017', 'Dismesso', 'Oggi', 'iscritto', false, null),
  ('ffffffff-0000-0000-0000-000000000018', 'Altrocorso', 'Oggi', 'iscritto', true, null),
  ('ffffffff-0000-0000-0000-000000000019', 'Scaduta', 'Oggi', 'iscritto', true, null);
insert into iscrizioni (corso_id, persona_id, dal, al) values
  ('cccccccc-0000-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000011', current_date - 60, null),
  ('cccccccc-0000-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000012', current_date - 60, null),
  ('cccccccc-0000-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000013', current_date - 60, null),
  ('cccccccc-0000-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000014', current_date - 60, null),
  ('cccccccc-0000-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000015', current_date - 60, null),
  ('cccccccc-0000-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000016', current_date - 60, null),
  ('cccccccc-0000-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000017', current_date - 60, null),
  ('cccccccc-0000-0000-0000-000000000002', 'ffffffff-0000-0000-0000-000000000018', current_date - 60, null),
  ('cccccccc-0000-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000019', current_date - 60, current_date - 1);
insert into corsi_istruttori (corso_id, persona_id) values
  ('cccccccc-0000-0000-0000-000000000002', 'ffffffff-0000-0000-0000-000000000001');

-- Le date di nascita, con l'ora in cui sono state scritte (il trigger la metterebbe a adesso).
alter table anagrafiche disable trigger anagrafiche_cambiata;
insert into anagrafiche (persona_id, nato_il, codice_fiscale, cambiata_il) values
  ('ffffffff-0000-0000-0000-000000000011', nato(0), null, now()),
  ('ffffffff-0000-0000-0000-000000000012', nato(-1), null, now()),
  ('ffffffff-0000-0000-0000-000000000013', nato(1), null, now()),
  ('ffffffff-0000-0000-0000-000000000014', '2000-02-29', null, now()),
  -- Richiesta: la scheda dice domani (10 giorni fa), la richiesta accolta ieri dice oggi: vince la richiesta.
  ('ffffffff-0000-0000-0000-000000000015', nato(1), null, now() - interval '10 days'),
  -- Scheda: la scheda dice domani (adesso), la richiesta accolta 10 giorni fa dice oggi: vince la scheda.
  ('ffffffff-0000-0000-0000-000000000016', nato(1), null, now()),
  ('ffffffff-0000-0000-0000-000000000017', nato(0), null, now()),
  ('ffffffff-0000-0000-0000-000000000018', nato(0), null, now()),
  ('ffffffff-0000-0000-0000-000000000019', nato(0), null, now());
alter table anagrafiche enable trigger anagrafiche_cambiata;
create or replace function richiesta(persona uuid, nato date, gestita timestamptz) returns void
  language sql as $$
  insert into richieste_iscrizione (nome, cognome, nato_il, nato_a, codice_fiscale, indirizzo, cap, comune, email, telefono,
                                    corsi, formula, persona_id, stato, gestita_il, creata_il)
  values ('X', 'Y', nato, 'Torino', 'XXXYYY15C03L219Z', 'via Roma 1', '10100', 'Torino', 'richiesta@esempio.it', '3335550000',
          array['cccccccc-0000-0000-0000-000000000001'::uuid], 'annuale', persona, 'accolta', gestita, gestita - interval '1 day')
$$;
select richiesta('ffffffff-0000-0000-0000-000000000015', nato(0), now() - interval '1 day');
select richiesta('ffffffff-0000-0000-0000-000000000016', nato(0), now() - interval '10 days');

-- Il 29 febbraio: oggi se è il 29 febbraio, il 1° marzo se l'anno non è bisestile. Il giorno lo decide l'orologio
-- del database: gli altri giorni Bisesto non è nell'elenco.
select (to_char(oggi(), 'MMDD') = '0229'
        or (to_char(oggi(), 'MMDD') = '0301' and extract(day from make_date(extract(year from oggi())::int, 3, 1) - 1) = 28)) as bisesto_oggi \gset
select case when :'bisesto_oggi' = 't' then 'Bisesto, Oggi, Richiesta' else 'Oggi, Richiesta' end as lotta \gset
-- Alla lezione di ieri Scaduta (iscritta fino a ieri) c'era ancora: conta il giorno della lezione, non oggi.
select case when :'bisesto_oggi' = 't' then 'Bisesto, Oggi, Richiesta, Scaduta' else 'Oggi, Richiesta, Scaduta' end as lotta_ieri \gset

\echo ''
\echo '--- 1. il tipo restituito: solo persona_id, mai data né età ---'
select atteso('compleanni_sala restituisce solo persona_id', pg_get_function_result('compleanni_sala(uuid)'::regprocedure), 'TABLE(persona_id uuid)');
select atteso('compleanni_lezione restituisce solo persona_id', pg_get_function_result('compleanni_lezione(uuid)'::regprocedure), 'TABLE(persona_id uuid)');
select atteso('compleanni_sala è security definer e stable', (select (prosecdef and provolatile = 's')::text from pg_proc where oid = 'compleanni_sala(uuid)'::regprocedure), 'true');
select atteso('compleanni_lezione è security definer e stable', (select (prosecdef and provolatile = 's')::text from pg_proc where oid = 'compleanni_lezione(uuid)'::regprocedure), 'true');
select atteso('anon non può eseguirle', (has_function_privilege('anon', 'compleanni_sala(uuid)', 'execute') or has_function_privilege('anon', 'compleanni_lezione(uuid)', 'execute'))::text, 'false');
select atteso('chi ha un accesso sì', (has_function_privilege('authenticated', 'compleanni_sala(uuid)', 'execute') and has_function_privilege('authenticated', 'compleanni_lezione(uuid)', 'execute'))::text, 'true');

\echo ''
\echo '--- 2. in sala è spento di default, lo accende la segreteria ---'
select atteso('nessuna postazione ha i compleanni accesi', (select count(*) filter (where compleanni)::text from postazioni), '0');
select atteso('postazione spenta: nessuno, anche se qualcuno compie gli anni',
  elenca('66666666-6666-6666-6666-666666666666', 'authenticated', $$select array_agg(persona_id) from compleanni_sala('eeeeeeee-0000-0000-0000-000000000001')$$), '(nessuno)');
update postazioni set compleanni = true where id = 'dddddddd-0000-0000-0000-000000000001';

\echo ''
\echo '--- 3. il tablet: chi compie gli anni oggi, e nessun altro ---'
-- Oggi (nato oggi), Richiesta (la richiesta accolta più recente dice oggi), Bisesto solo il giorno giusto.
-- Fuori: Ieri, Domani, Scheda (la scheda più recente dice domani), Dismesso (non attivo), Altrocorso, Scaduta (al < oggi).
select atteso('compie oggi, la richiesta più recente, il 29 febbraio il giorno giusto',
  elenca('66666666-6666-6666-6666-666666666666', 'authenticated', $$select array_agg(persona_id) from compleanni_sala('eeeeeeee-0000-0000-0000-000000000001')$$), :'lotta');
select atteso('a lezione in corso',
  elenca('66666666-6666-6666-6666-666666666666', 'authenticated', $$select array_agg(persona_id) from compleanni_sala('eeeeeeee-0000-0000-0000-000000000006')$$), :'lotta');
select atteso('la lezione di ieri: l''iscrizione vale il giorno della lezione, Scaduta c''era ancora',
  elenca('66666666-6666-6666-6666-666666666666', 'authenticated', $$select array_agg(persona_id) from compleanni_sala('eeeeeeee-0000-0000-0000-000000000002')$$), :'lotta_ieri');
select atteso('lezione di tre settimane fa: fuori dalla finestra',
  elenca('66666666-6666-6666-6666-666666666666', 'authenticated', $$select array_agg(persona_id) from compleanni_sala('eeeeeeee-0000-0000-0000-000000000003')$$), '42501');
select atteso('lezione di domani: fuori dalla finestra',
  elenca('66666666-6666-6666-6666-666666666666', 'authenticated', $$select array_agg(persona_id) from compleanni_sala('eeeeeeee-0000-0000-0000-000000000004')$$), '42501');
select atteso('la lezione di un''altra sala',
  elenca('66666666-6666-6666-6666-666666666666', 'authenticated', $$select array_agg(persona_id) from compleanni_sala('eeeeeeee-0000-0000-0000-000000000005')$$), '42501');
select atteso('l''altro tablet, con i compleanni spenti: nessuno anche se Altrocorso compie gli anni',
  elenca('55555555-5555-5555-5555-555555555555', 'authenticated', $$select array_agg(persona_id) from compleanni_sala('eeeeeeee-0000-0000-0000-000000000005')$$), '(nessuno)');
update postazioni set compleanni = true where id = 'dddddddd-0000-0000-0000-000000000002';
select atteso('l''altro tablet, acceso: solo gli iscritti al Judo',
  elenca('55555555-5555-5555-5555-555555555555', 'authenticated', $$select array_agg(persona_id) from compleanni_sala('eeeeeeee-0000-0000-0000-000000000005')$$), 'Altrocorso');
update postazioni set compleanni = false where id = 'dddddddd-0000-0000-0000-000000000002';

\echo ''
\echo '--- 4. chi non è un tablet non le usa ---'
select atteso('la segreteria non è un tablet', elenca('11111111-1111-1111-1111-111111111111', 'authenticated', $$select array_agg(persona_id) from compleanni_sala('eeeeeeee-0000-0000-0000-000000000001')$$), '42501');
select atteso('l''istruttore non è un tablet', elenca('22222222-2222-2222-2222-222222222222', 'authenticated', $$select array_agg(persona_id) from compleanni_sala('eeeeeeee-0000-0000-0000-000000000001')$$), '42501');
select atteso('un iscritto non è un tablet', elenca('dddddddd-1111-1111-1111-111111111111', 'authenticated', $$select array_agg(persona_id) from compleanni_sala('eeeeeeee-0000-0000-0000-000000000001')$$), '42501');
select atteso('anon non è un tablet', elenca('', 'anon', $$select array_agg(persona_id) from compleanni_sala('eeeeeeee-0000-0000-0000-000000000001')$$), '42501');

\echo ''
\echo '--- 5. gli istruttori: le lezioni che fanno, la segreteria tutte ---'
select atteso('Maura, che insegna Lotta 2',
  elenca('22222222-2222-2222-2222-222222222222', 'authenticated', $$select array_agg(persona_id) from compleanni_lezione('eeeeeeee-0000-0000-0000-000000000001')$$), :'lotta');
select atteso('Federico, che insegna Lotta 2',
  elenca('44444444-4444-4444-4444-444444444444', 'authenticated', $$select array_agg(persona_id) from compleanni_lezione('eeeeeeee-0000-0000-0000-000000000001')$$), :'lotta');
select atteso('Giorgio non insegna Lotta 2',
  elenca('cccccccc-1111-1111-1111-111111111111', 'authenticated', $$select array_agg(persona_id) from compleanni_lezione('eeeeeeee-0000-0000-0000-000000000001')$$), '42501');
select atteso('Maura non insegna il Judo',
  elenca('22222222-2222-2222-2222-222222222222', 'authenticated', $$select array_agg(persona_id) from compleanni_lezione('eeeeeeee-0000-0000-0000-000000000005')$$), '42501');
select atteso('Giorgio insegna il Judo: solo i suoi iscritti',
  elenca('cccccccc-1111-1111-1111-111111111111', 'authenticated', $$select array_agg(persona_id) from compleanni_lezione('eeeeeeee-0000-0000-0000-000000000005')$$), 'Altrocorso');
-- La segreteria mette il sostituto (un trigger lascia agli altri solo stato e nota).
select set_config('prova.utente', '11111111-1111-1111-1111-111111111111', false);
update sessioni set istruttore_id = 'ffffffff-0000-0000-0000-000000000001' where id = 'eeeeeeee-0000-0000-0000-000000000001';
select atteso('Giorgio, sostituto in quella lezione',
  elenca('cccccccc-1111-1111-1111-111111111111', 'authenticated', $$select array_agg(persona_id) from compleanni_lezione('eeeeeeee-0000-0000-0000-000000000001')$$), :'lotta');
select set_config('prova.utente', '11111111-1111-1111-1111-111111111111', false);
update sessioni set istruttore_id = null where id = 'eeeeeeee-0000-0000-0000-000000000001';
select atteso('la segreteria, Lotta 2',
  elenca('11111111-1111-1111-1111-111111111111', 'authenticated', $$select array_agg(persona_id) from compleanni_lezione('eeeeeeee-0000-0000-0000-000000000001')$$), :'lotta');
select atteso('la segreteria, il Judo',
  elenca('11111111-1111-1111-1111-111111111111', 'authenticated', $$select array_agg(persona_id) from compleanni_lezione('eeeeeeee-0000-0000-0000-000000000005')$$), 'Altrocorso');
select atteso('il tablet non è personale',
  elenca('66666666-6666-6666-6666-666666666666', 'authenticated', $$select array_agg(persona_id) from compleanni_lezione('eeeeeeee-0000-0000-0000-000000000001')$$), '42501');
select atteso('un iscritto qualunque',
  elenca('dddddddd-1111-1111-1111-111111111111', 'authenticated', $$select array_agg(persona_id) from compleanni_lezione('eeeeeeee-0000-0000-0000-000000000001')$$), '42501');
select atteso('anon',
  elenca('', 'anon', $$select array_agg(persona_id) from compleanni_lezione('eeeeeeee-0000-0000-0000-000000000001')$$), '42501');
