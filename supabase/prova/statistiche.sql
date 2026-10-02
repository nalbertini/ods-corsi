-- Le statistiche (22-statistiche.sql): i numeri di ogni lezione contati come
-- in PRESENZE, le prove, chi l'ha fatta, gli incassi del mese; e che le veda
-- solo la segreteria.
-- Si lancia dopo finto-supabase.sql e i file dello schema fino a
-- 22-statistiche.sql, su un database suo (crea persone e corsi).
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';
reset role;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'maura@ods.it');
insert into persone (id, nome, cognome, ruolo, utente_id, attiva) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', '11111111-1111-1111-1111-111111111111', true),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Maura', 'Uno', 'istruttore', '22222222-2222-2222-2222-222222222222', true),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Federico', 'Due', 'istruttore', null, true),
  ('aaaaaaaa-0000-0000-0000-000000000011', 'Luca', 'Rossi', 'iscritto', null, true),
  ('aaaaaaaa-0000-0000-0000-000000000012', 'Sara', 'Bianchi', 'iscritto', null, true),
  ('aaaaaaaa-0000-0000-0000-000000000013', 'Ugo', 'Verdi', 'iscritto', null, true),
  -- Disattivata: non è nell'appello, come in PRESENZE.
  ('aaaaaaaa-0000-0000-0000-000000000014', 'Ida', 'Spenta', 'iscritto', null, false),
  -- Viene a provare.
  ('aaaaaaaa-0000-0000-0000-000000000015', 'Pia', 'Prova', 'iscritto', null, true);
insert into sale (id, nome) values ('bbbbbbbb-0000-0000-0000-000000000001', 'Tatami');
insert into corsi (id, nome, sala_id, istruttore_id, capienza) values
  ('cccccccc-0000-0000-0000-000000000001', 'Judo', 'bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', 20);
insert into corsi_istruttori (corso_id, persona_id) values
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002'),
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003');
insert into sessioni (id, corso_id, inizio, fine, sala_id, istruttore_id, stato) values
  -- Con l'appello: Luca presente, Sara assente, Ugo giustificato, Pia in prova.
  ('eeeeeeee-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', '2026-09-07 18:00', '2026-09-07 19:00', 'bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', 'svolta'),
  -- Senza appello, con un sostituto.
  ('eeeeeeee-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000001', '2026-09-14 18:00', '2026-09-14 19:00', 'bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'prevista'),
  -- Annullata.
  ('eeeeeeee-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-000000000001', '2026-09-21 18:00', '2026-09-21 19:00', 'bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', 'annullata'),
  -- Nel futuro: non c'è ancora.
  ('eeeeeeee-0000-0000-0000-000000000004', 'cccccccc-0000-0000-0000-000000000001', now() + interval '3 days', now() + interval '3 days 1 hour', 'bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', 'prevista');
insert into iscrizioni (corso_id, persona_id, dal, al) values
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000011', '2026-09-01', null),
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000012', '2026-09-01', null),
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000013', '2026-09-01', null),
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000014', '2026-09-01', null);
insert into presenze (sessione_id, persona_id, stato) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000011', 'presente'),
  ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000012', 'assente'),
  ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000013', 'giustificato'),
  ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000014', 'presente'),
  ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000015', 'presente');

create or replace function chi(u text) returns void language plpgsql as $$
begin perform set_config('prova.utente', u, false); end $$;
create or replace function tenta(sql text) returns text language plpgsql as $$
declare esito text;
begin
  execute sql into esito;
  return esito;
exception when others then return 'NEGATO: ' || sqlerrm;
end $$;
create or replace function atteso(cosa text, avuto text, voluto text) returns text language plpgsql as $$
begin
  if avuto is distinct from voluto and not (voluto like '%…' and avuto like replace(voluto, '…', '%')) then
    raise exception '% · atteso «%», avuto «%»', cosa, voluto, avuto;
  end if;
  return 'ok  ' || cosa || ' → ' || avuto;
end $$;
grant execute on function tenta(text), atteso(text, text, text), chi(text) to anon, authenticated;

\echo ''
\echo '--- 1. la segreteria ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
create temp table s as select statistiche('2026-09-01 00:00', now() + interval '30 days') as j;
select atteso('le lezioni già cominciate, non quella futura', (select jsonb_array_length(j->'lezioni')::text from s), '3');
select atteso('l''appello: gli iscritti attivi, coi loro segni', (select l->>'iscritti' || ' ' || (l->>'presenti') || ' ' || (l->>'assenti') || ' ' || (l->>'giustificati')
  from s, jsonb_array_elements(j->'lezioni') l where l->>'id' = 'eeeeeeee-0000-0000-0000-000000000001'), '3 1 1 1');
select atteso('la disattivata non è una prova, Pia sì', (select l->>'prove' from s, jsonb_array_elements(j->'lezioni') l where l->>'id' = 'eeeeeeee-0000-0000-0000-000000000001'), '1');
select atteso('chi la insegna: tutti e due gli istruttori del corso', (select l->>'istruttori' || ' ' || (l->>'sostituto') from s, jsonb_array_elements(j->'lezioni') l
  where l->>'id' = 'eeeeeeee-0000-0000-0000-000000000001'), '["Federico Due", "Maura Uno"] false');
select atteso('senza appello: zero segni', (select l->>'presenti' || ' ' || (l->>'assenti') from s, jsonb_array_elements(j->'lezioni') l where l->>'id' = 'eeeeeeee-0000-0000-0000-000000000002'), '0 0');
select atteso('il sostituto', (select l->>'istruttori' || ' ' || (l->>'sostituto') from s, jsonb_array_elements(j->'lezioni') l
  where l->>'id' = 'eeeeeeee-0000-0000-0000-000000000002'), '["Anna Segreteria"] true');
select atteso('l''annullata c''è, col suo stato', (select l->>'stato' from s, jsonb_array_elements(j->'lezioni') l where l->>'id' = 'eeeeeeee-0000-0000-0000-000000000003'), 'annullata');
select atteso('corso, sala e capienza', (select l->>'corso' || ' ' || (l->>'sala') || ' ' || (l->>'capienza') from s, jsonb_array_elements(j->'lezioni') l
  where l->>'id' = 'eeeeeeee-0000-0000-0000-000000000001'), 'Judo Tatami 20');
select atteso('incassi: nessuna ricevuta, nessun mese', (select (j->'incassi')::text from s), '[]');
drop table s;
select atteso('il periodo al contrario no', tenta($$select statistiche(now(), now() - interval '1 day')::text$$), 'NEGATO: il periodo è al contrario');
select atteso('più di due anni no', tenta($$select statistiche(now() - interval '3 years', now())::text$$), 'NEGATO: al massimo due anni per volta');
reset role;

\echo ''
\echo '--- 2. gli incassi del mese ---'
create or replace function pagamento(giorno text, prezzo int, pagato int) returns jsonb language sql as $$
  select jsonb_build_object(
    'data', giorno, 'persona_id', 'aaaaaaaa-0000-0000-0000-000000000011',
    'ente', jsonb_build_object('nome', 'Asd'), 'intestatario', jsonb_build_object('nome', 'Luca', 'cognome', 'Rossi'),
    'voci', jsonb_build_array(jsonb_build_object('descrizione', 'Trimestre', 'quantita', 1, 'prezzo', prezzo,
      'pagamenti', jsonb_build_array(jsonb_build_object('data', giorno, 'importo', pagato, 'metodo', 'Contanti')))),
    'anticipo', 0)
$$;
grant execute on function pagamento(text, int, int) to authenticated;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select emetti_ricevuta(pagamento('2026-09-02', 12000, 12000)) is not null as "fatta";
select emetti_ricevuta(pagamento('2026-09-20', 12000, 5000)) is not null as "fatta";
select annulla_ricevuta((emetti_ricevuta(pagamento('2026-09-25', 9900, 9900))->>'id')::uuid);
select emetti_ricevuta(pagamento('2026-10-01', 3000, 3000)) is not null as "fatta";
select atteso('settembre: due ricevute, l''annullata no', (select x->>'ricevute' || ' ' || (x->>'totale') || ' ' || (x->>'pagato')
  from jsonb_array_elements(statistiche('2026-09-01 00:00', '2026-10-31 23:59')->'incassi') x where x->>'mese' = '2026-09'), '2 24000 17000');
select atteso('e ottobre a parte', (select string_agg(x->>'mese', ',') from jsonb_array_elements(statistiche('2026-09-01 00:00', '2026-10-31 23:59')->'incassi') x), '2026-09,2026-10');
select atteso('un periodo stretto prende solo i suoi giorni', (select string_agg(x->>'mese', ',') from jsonb_array_elements(statistiche('2026-10-01 00:00', '2026-10-31 23:59')->'incassi') x), '2026-10');
reset role;

\echo ''
\echo '--- 3. chi non è di segreteria ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('un istruttore no', tenta($$select statistiche(now() - interval '30 days', now())::text$$), 'NEGATO: le statistiche sono della segreteria');
reset role;
select chi('');
set role anon;
select atteso('chi non ha fatto l''accesso no', tenta($$select statistiche(now() - interval '30 days', now())::text$$), 'NEGATO: permission denied…');
reset role;

\echo ''
\echo 'statistiche: tutto ok'
