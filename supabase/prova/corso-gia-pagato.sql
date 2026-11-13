-- «Questo corso è già pagato» come lo dice la segreteria (`statoCorsi`, src/lib/corsiDaPagare.ts), anche nel database
-- che decide se si paga online (152-corso-gia-pagato.sql). È l'ultima difesa contro il doppio pagamento: se il
-- database riconosce meno ricevute della segreteria, chi ha già pagato può pagare di nuovo con Satispay.
-- La metà di prova: scripts/prova-corso-satispay.mjs, § 5.
-- Si lancia dopo finto-supabase.sql e i file dello schema (il 152 compreso).
--
-- Cosa si assume del 152:
--   · le voci di ricevuta si riconoscono come `nomeCorso` (senza accenti, maiuscole e segni) e coi nomi del listino,
--     etichetta compresa («Annuale Fitness 2 giorni»);
--   · una voce pagata che parte domani, o senza date, ferma `corso_importo` come una che vale oggi;
--   · un bonifico assegnato (`pagamenti_diretti`) si riconosce con gli stessi nomi; lo spazio indivisibile è uno spazio;
--   · un corso «va bene senza prezzo» non si paga online;
--   · l'eccezione «fuori dall'app» ferma il corso solo se è «pagato» (fino alla sua data, se no al 31 luglio della
--     stagione in cui è stata scritta, `cambiata_il`);
--     «in parte» riguarda la quota: ferma `quota_importo`, non il corso;
--   · `satispay_corsi_chi` dà `a_pagamento: false` per un corso «va bene senza prezzo», e per ogni corso il nome del
--     listino (`voce`) e le etichette, perché l'area iscritti riconosca le stesse voci della segreteria.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

-- --- gli aiuti --------------------------------------------------------------
create or replace function chi(u text) returns void language plpgsql as $$
begin perform set_config('prova.utente', u, false); end $$;
create or replace function atteso(cosa text, avuto text, voluto text) returns text language plpgsql as $$
begin
  if avuto is distinct from voluto then raise exception '% · atteso «%», avuto «%»', cosa, voluto, avuto; end if;
  return 'ok  ' || cosa || ' → ' || avuto;
end $$;
create or replace function riga(sql text) returns text language plpgsql as $$
declare esito text;
begin execute sql into esito; return coalesce(esito, 'niente');
exception when others then return 'NEGATO: ' || sqlerrm;
end $$;
create or replace function pid(n int) returns uuid language sql immutable as $$
  select ('aaaaaaaa-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;
create or replace function cid(n int) returns uuid language sql immutable as $$
  select ('cccccccc-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;
-- Una ricevuta con una voce sola, pagata tutta.
create or replace function ric(n int, persona uuid, descrizione text, dal date, al date) returns void language sql as $$
  insert into ricevute (id, anno, numero, data, persona_id, ente, intestatario, voci, totale, pagato, anticipo)
  values (('f1f1f1f1-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, 2026, 800 + n, current_date - 5, persona,
    '{"nome":"ODS"}', '{"nome":"X","cognome":"Y"}',
    jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('descrizione', descrizione, 'quantita', 1, 'prezzo', 30000,
      'dal', dal::text, 'al', al::text, 'pagamenti', jsonb_build_array(jsonb_build_object('data', current_date::text, 'importo', 30000, 'metodo', 'Contanti'))))),
    30000, 30000, 0)
$$;
create or replace function costa(persona uuid, corso uuid, formula text default 'annuale') returns text language sql as $$
  select riga(format('select corso_importo(%L, %L, %L)::text', persona, corso, formula))
$$;

-- --- chi c'è ----------------------------------------------------------------
insert into auth.users (id, email, email_confirmed_at) values ('33333333-3333-3333-3333-333333333333', 'luca@fam.it', now());
insert into persone (id, nome, cognome, ruolo, email, utente_id) values (pid(3), 'Luca', 'Fam', 'iscritto', 'luca@fam.it', '33333333-3333-3333-3333-333333333333');
insert into persone (id, nome, cognome, ruolo, nucleo) select pid(n), 'Nome' || n, 'Fam', 'iscritto', pid(3) from generate_series(21, 29) n;
insert into anagrafiche (persona_id, nato_il) select pid(n), current_date - interval '40 years' from unnest(array[3,21,22,23,24,25,26,27,28,29]) n;
insert into corsi (id, nome) values (cid(1), 'Judo'), (cid(2), 'Fitness'), (cid(3), 'Attività Motoria'), (cid(4), 'Yoga');
update impostazioni set listino = jsonb_build_object('quota', 50, 'saldoEntro', (current_date - 30)::text,
  'senzaPrezzoVaBene', jsonb_build_array(cid(4)),
  'corsi', jsonb_build_array(
    jsonb_build_object('corsoId', cid(1), 'corso', 'Judo', 'prezzi', jsonb_build_array(jsonb_build_object('annuale', 300, 'trimestre', 120))),
    jsonb_build_object('corsoId', cid(2), 'corso', 'Fitness', 'prezzi', jsonb_build_array(jsonb_build_object('etichetta', '2 giorni', 'annuale', 300))),
    jsonb_build_object('corsoId', cid(3), 'corso', 'Attività Motoria', 'prezzi', jsonb_build_array(jsonb_build_object('annuale', 300))),
    jsonb_build_object('corsoId', cid(4), 'corso', 'Yoga', 'prezzi', jsonb_build_array(jsonb_build_object('annuale', 100))))) where id;
insert into iscrizioni (corso_id, persona_id, dal) select c, pid(n), current_date - 100 from generate_series(21, 29) n, unnest(array[cid(1), cid(2), cid(3), cid(4)]) c;

-- 21: «Annuale Fitness 2 giorni». 22: «annuale attivita  motoria» (senza accento, due spazi). 23: un trimestre di Judo
-- pagato che parte domani. 24: un annuale di Judo senza date. 25: pagato fuori dall'app senza data. 26: «in parte»
-- fuori dall'app, senza data. 27: un trimestre di Judo finito ieri. 28: niente.
select ric(21, pid(21), 'Annuale Fitness 2 giorni', current_date - 60, current_date + 200);
select ric(22, pid(22), 'annuale attivita  motoria', current_date - 60, current_date + 200);
select ric(23, pid(23), 'Trimestre Judo', current_date + 1, current_date + 90);
select ric(24, pid(24), 'Annuale Judo', null, null);
select ric(27, pid(27), 'Trimestre Judo', current_date - 91, current_date - 1);
insert into schede_iscritti (persona_id, pagamento, pagato_fino) values (pid(25), 'pagato', null), (pid(26), 'in_parte', null);
-- 29: «Annuale Fitness 2 giorni» da un bonifico assegnato (`pagamenti_diretti`), come lo scrive la segreteria; e una
-- ricevuta «Annuale Judo» con uno spazio indivisibile, che per l'app (JS) è uno spazio.
insert into pagamenti_diretti (persona_id, data, importo, metodo, voce) values (pid(29), current_date, 30000, 'Bonifico', 'Annuale Fitness 2 giorni');
select ric(29, pid(29), 'Annuale' || chr(160) || 'Judo', current_date - 60, current_date + 200);

\echo ''
\echo '--- 1. le voci si riconoscono come in segreteria ---'
select atteso('Fitness con l''etichetta del listino: non si paga di nuovo', costa(pid(21), cid(2)),
  'NEGATO: Il corso ha già una ricevuta: per quel che manca chiedi alla segreteria');
select atteso('Attività Motoria scritto senza accento: non si paga di nuovo', costa(pid(22), cid(3)),
  'NEGATO: Il corso ha già una ricevuta: per quel che manca chiedi alla segreteria');
select atteso('il trimestre pagato che parte domani: non si paga di nuovo', costa(pid(23), cid(1), 'trimestre'),
  'NEGATO: Il corso ha già una ricevuta: per quel che manca chiedi alla segreteria');
select atteso('un annuale senza date: per la segreteria è pagato', costa(pid(24), cid(1)),
  'NEGATO: Il corso ha già una ricevuta: per quel che manca chiedi alla segreteria');
select atteso('un trimestre finito ieri: si paga', costa(pid(27), cid(1), 'trimestre'), '12000');
select atteso('niente: si paga', costa(pid(28), cid(1)), '30000');
select atteso('…anche il Fitness con l''etichetta', costa(pid(28), cid(2)), '30000');
select atteso('una voce con lo spazio indivisibile: non si paga di nuovo', costa(pid(29), cid(1)),
  'NEGATO: Il corso ha già una ricevuta: per quel che manca chiedi alla segreteria');
select atteso('un bonifico assegnato con l''etichetta del listino: non si paga di nuovo', costa(pid(29), cid(2)),
  'NEGATO: Il corso risulta già pagato in segreteria: per quel che manca chiedi alla segreteria');
select atteso('Yoga «va bene senza prezzo»: non si paga online nemmeno chiamando il database', costa(pid(28), cid(4)),
  'NEGATO: Il corso non è nel listino: chiedi alla segreteria');

\echo ''
\echo '--- 2. l''eccezione «fuori dall''app» ---'
select atteso('pagato senza data: il corso non si paga online (vale fino a fine stagione)', costa(pid(25), cid(1)),
  'NEGATO: Il corso risulta già pagato fuori dall’app: chiedi alla segreteria');
select atteso('…né la quota', riga($$select quota_importo(pid(25))::text$$),
  'NEGATO: La quota risulta già pagata fuori dall’app: chiedi alla segreteria');
select atteso('«in parte» riguarda la quota: il corso si paga', costa(pid(26), cid(1)), '30000');
select atteso('…la quota no', riga($$select quota_importo(pid(26))::text$$),
  'NEGATO: La quota risulta già pagata fuori dall’app: chiedi alla segreteria');
select atteso('senza data vale fino al 31 luglio della stagione in cui è scritta',
  fine_fuori_app(null, date '2027-07-31')::text || ' ' || fine_fuori_app(null, date '2027-08-01')::text || ' ' || fine_fuori_app(date '2026-12-31', date '2027-08-01')::text,
  '2027-07-31 2028-07-31 2026-12-31');
-- Scritto più di un anno fa (il trigger metterebbe adesso: lo si ferma solo qui).
alter table schede_iscritti disable trigger user;
update schede_iscritti set cambiata_il = now() - interval '13 months' where persona_id = pid(25);
alter table schede_iscritti enable trigger user;
select atteso('pagato senza data, scritto la stagione scorsa: ora si paga', costa(pid(25), cid(1)), '30000');
select atteso('…anche la quota', riga($$select quota_importo(pid(25))::text$$), '5000');
update schede_iscritti set pagato_fino = current_date - 1 where persona_id = pid(25);
select atteso('pagato fino a ieri: si paga', costa(pid(25), cid(1)), '30000');

\echo ''
\echo '--- 3. quel che l''area iscritti legge ---'
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('Yoga «va bene senza prezzo»: non è a pagamento, il Judo sì',
  riga($$select string_agg((c->>'corso_id' = cid(4)::text)::text || ':' || (c->>'a_pagamento'), ',' order by c->>'corso_id' = cid(4)::text)
         from satispay_corsi_chi(pid(28)) x, jsonb_array_elements(x->'corsi') c where c->>'corso_id' in (cid(1)::text, cid(4)::text)$$), 'false:true,true:false');
select atteso('Fitness: il nome del listino e le etichette, per riconoscere le voci',
  riga($$select (c->>'voce') || ' ' || (c->'etichette')::text from satispay_corsi_chi(pid(21)) x, jsonb_array_elements(x->'corsi') c where c->>'corso_id' = cid(2)::text$$),
  'Fitness ["2 giorni"]');
select atteso('…e non offre l''annuale a chi l''ha già pagato',
  riga($$select coalesce(c->>'annuale', 'null') from satispay_corsi_chi(pid(21)) x, jsonb_array_elements(x->'corsi') c where c->>'corso_id' = cid(2)::text$$), 'null');
select atteso('…né lo prepara se ci prova', riga($$select satispay_prepara_corso(pid(21), cid(2), 'annuale')->>'importo'$$),
  'NEGATO: Il corso ha già una ricevuta: per quel che manca chiedi alla segreteria');
select atteso('il bonifico con l''etichetta: Fitness assegnato, senza importo',
  riga($$select (c->>'assegnato') || ' ' || coalesce(c->>'annuale', 'null') from satispay_corsi_chi(pid(29)) x, jsonb_array_elements(x->'corsi') c where c->>'corso_id' = cid(2)::text$$), 'true null');
reset role;
-- Gli altri: un iscritto di un altro nucleo, la segreteria, l'istruttore, il tablet (nessuna persona). Nessuno vede niente.
insert into auth.users (id, email, email_confirmed_at) values ('11111111-1111-1111-1111-111111111111', 'anna@ods.it', now()),
  ('22222222-2222-2222-2222-222222222222', 'ivo@ods.it', now()), ('44444444-4444-4444-4444-444444444444', 'eva@altra.it', now());
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  (pid(1), 'Anna', 'Segreteria', 'staff', 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  (pid(2), 'Ivo', 'Istruttore', 'istruttore', 'ivo@ods.it', '22222222-2222-2222-2222-222222222222'),
  (pid(4), 'Eva', 'Altra', 'iscritto', 'eva@altra.it', '44444444-4444-4444-4444-444444444444');
select chi(u) from unnest(array['44444444-4444-4444-4444-444444444444']) u;
set role authenticated;
select atteso('un iscritto di un altro nucleo: niente', riga($$select coalesce(satispay_corsi_chi(pid(21))::text, 'null')$$), 'null');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria: niente', riga($$select coalesce(satispay_corsi_chi(pid(21))::text, 'null')$$), 'null');
reset role;
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('l''istruttore: niente', riga($$select coalesce(satispay_corsi_chi(pid(21))::text, 'null')$$), 'null');
reset role;
select chi('');
set role authenticated;
select atteso('il tablet: niente', riga($$select coalesce(satispay_corsi_chi(pid(21))::text, 'null')$$), 'null');
reset role;

\echo ''
\echo '--- 4. chi può cosa: come prima ---'
select atteso('anon non chiama satispay_corsi_chi', has_function_privilege('anon', 'satispay_corsi_chi(uuid)', 'execute')::text, 'false');
select atteso('i conti interni non si chiamano da fuori',
  (select string_agg(has_function_privilege(r, f, 'execute')::text, ' ') from unnest(array['anon', 'authenticated']) r,
     unnest(array['corso_importo(uuid,uuid,text)', 'quota_importo(uuid)', 'nomi_del_corso(uuid,jsonb)', 'nome_corso(text)', 'fine_fuori_app(date,date)', 'corso_in_segreteria(uuid,text[])']) f),
  'false false false false false false false false false false false false');

\echo ''
\echo 'TUTTO A POSTO'
