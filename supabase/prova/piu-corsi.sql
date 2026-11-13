-- «Annuale più corsi»: la voce fissa con cui la segreteria assegna un bonifico che paga tutti gli annuali di una
-- persona fino al tetto di 660 € (`VOCE_PIU_CORSI`, src/lib/nucleo.ts), riconosciuta anche dal database che decide se
-- si paga online (156-piu-corsi.sql). Se no l'area iscritti mostra «da pagare» corsi già pagati, e Satispay li incassa.
-- La metà di prova: scripts/prova-corso-satispay.mjs, in fondo.
-- Si lancia dopo finto-supabase.sql e i file dello schema (il 156 compreso).
--
-- Cosa si assume del 156:
--   · «più corsi» è uno dei nomi di ogni corso che nel listino ha un annuale (`nomi_del_corso`): una ricevuta o un
--     bonifico assegnato «Annuale più corsi» ferma `corso_importo` per tutti quelli, non per un corso col solo trimestre;
--   · lo sconto famiglia in coda alla voce («· sconto famiglia 20% su 660,00 €», `descrizioneScontata`) non è del
--     nome (`nome_corso`): la voce si riconosce lo stesso, anche quella di un corso solo;
--   · `satispay_corsi_chi` dice «assegnato» per quei corsi;
--   · nessun altro (altro iscritto, segreteria, istruttore, tablet, anon) legge niente, e le due funzioni non si
--     chiamano da fuori.
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
insert into persone (id, nome, cognome, ruolo, nucleo) select pid(n), 'Nome' || n, 'Fam', 'iscritto', pid(3) from generate_series(21, 25) n;
insert into anagrafiche (persona_id, nato_il) select pid(n), current_date - interval '40 years' from unnest(array[3,21,22,23,24,25]) n;
insert into corsi (id, nome) values (cid(1), 'Judo'), (cid(2), 'Fitness'), (cid(3), 'Ginnastica');
-- Ginnastica ha solo il trimestre: «più corsi» non la paga (il trimestre non entra nel tetto).
update impostazioni set listino = jsonb_build_object('quota', 50, 'saldoEntro', (current_date - 30)::text,
  'corsi', jsonb_build_array(
    jsonb_build_object('corsoId', cid(1), 'corso', 'Judo', 'prezzi', jsonb_build_array(jsonb_build_object('annuale', 300, 'trimestre', 120))),
    jsonb_build_object('corsoId', cid(2), 'corso', 'Fitness', 'prezzi', jsonb_build_array(jsonb_build_object('etichetta', '2 giorni', 'annuale', 300))),
    jsonb_build_object('corsoId', cid(3), 'corso', 'Ginnastica', 'prezzi', jsonb_build_array(jsonb_build_object('trimestre', 120))))) where id;
insert into iscrizioni (corso_id, persona_id, dal) select c, pid(n), current_date - 100 from generate_series(21, 25) n, unnest(array[cid(1), cid(2), cid(3)]) c;

-- 21: una ricevuta «Annuale più corsi». 22: la stessa con lo sconto famiglia in coda. 23: un bonifico assegnato
-- «Annuale più corsi». 24: niente. 25: «Annuale Judo» con lo sconto famiglia in coda.
select ric(21, pid(21), 'Annuale più corsi', current_date - 60, current_date + 200);
select ric(22, pid(22), 'Annuale più corsi · sconto famiglia 20% su 660,00 €', current_date - 60, current_date + 200);
insert into pagamenti_diretti (persona_id, data, importo, metodo, voce) values (pid(23), current_date, 61000, 'Bonifico', 'Annuale più corsi');
select ric(25, pid(25), 'Annuale Judo · sconto famiglia 20% su 300,00 €', current_date - 60, current_date + 200);

\echo ''
\echo '--- 1. «più corsi» paga ogni annuale ---'
select atteso('ricevuta «più corsi»: il Judo non si paga di nuovo', costa(pid(21), cid(1)),
  'NEGATO: Il corso ha già una ricevuta: per quel che manca chiedi alla segreteria');
select atteso('…né il Fitness con l''etichetta', costa(pid(21), cid(2)),
  'NEGATO: Il corso ha già una ricevuta: per quel che manca chiedi alla segreteria');
select atteso('…ma la Ginnastica, col solo trimestre, si paga', costa(pid(21), cid(3), 'trimestre'), '12000');
select atteso('con lo sconto famiglia in coda: il Judo non si paga di nuovo', costa(pid(22), cid(1)),
  'NEGATO: Il corso ha già una ricevuta: per quel che manca chiedi alla segreteria');
select atteso('un bonifico assegnato «più corsi»: il Fitness non si paga di nuovo', costa(pid(23), cid(2)),
  'NEGATO: Il corso risulta già pagato in segreteria: per quel che manca chiedi alla segreteria');
select atteso('niente: si paga', costa(pid(24), cid(1)), '30000');
select atteso('un corso solo con lo sconto in coda: il Judo non si paga di nuovo', costa(pid(25), cid(1)),
  'NEGATO: Il corso ha già una ricevuta: per quel che manca chiedi alla segreteria');
select atteso('…il Fitness sì', costa(pid(25), cid(2)), '30000');

\echo ''
\echo '--- 2. quel che l''area iscritti legge ---'
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('il bonifico «più corsi»: Judo e Fitness assegnati, la Ginnastica no',
  riga($$select string_agg(c->>'assegnato', ' ' order by c->>'corso_id') from satispay_corsi_chi(pid(23)) x, jsonb_array_elements(x->'corsi') c$$),
  'true true false');
select atteso('…e non li prepara se ci prova', riga($$select satispay_prepara_corso(pid(23), cid(1), 'annuale')->>'importo'$$),
  'NEGATO: Il corso risulta già pagato in segreteria: per quel che manca chiedi alla segreteria');
reset role;
insert into auth.users (id, email, email_confirmed_at) values ('11111111-1111-1111-1111-111111111111', 'anna@ods.it', now()),
  ('22222222-2222-2222-2222-222222222222', 'ivo@ods.it', now()), ('44444444-4444-4444-4444-444444444444', 'eva@altra.it', now());
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  (pid(1), 'Anna', 'Segreteria', 'staff', 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  (pid(2), 'Ivo', 'Istruttore', 'istruttore', 'ivo@ods.it', '22222222-2222-2222-2222-222222222222'),
  (pid(4), 'Eva', 'Altra', 'iscritto', 'eva@altra.it', '44444444-4444-4444-4444-444444444444');
select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('un iscritto di un altro nucleo: niente', riga($$select coalesce(satispay_corsi_chi(pid(23))::text, 'null')$$), 'null');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria: niente', riga($$select coalesce(satispay_corsi_chi(pid(23))::text, 'null')$$), 'null');
reset role;
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('l''istruttore: niente', riga($$select coalesce(satispay_corsi_chi(pid(23))::text, 'null')$$), 'null');
reset role;
select chi('');
set role authenticated;
select atteso('il tablet: niente', riga($$select coalesce(satispay_corsi_chi(pid(23))::text, 'null')$$), 'null');
reset role;

\echo ''
\echo '--- 3. chi può cosa: come prima ---'
select atteso('anon non chiama satispay_corsi_chi', has_function_privilege('anon', 'satispay_corsi_chi(uuid)', 'execute')::text, 'false');
select atteso('nome_corso e nomi_del_corso non si chiamano da fuori',
  (select string_agg(has_function_privilege(r, f, 'execute')::text, ' ') from unnest(array['anon', 'authenticated']) r,
     unnest(array['nomi_del_corso(uuid,jsonb)', 'nome_corso(text)']) f),
  'false false false false');

\echo ''
\echo 'TUTTO A POSTO'
