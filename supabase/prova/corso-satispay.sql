-- Un corso semplice con Satispay (106-paga-corso-satispay.sql): l'iscritto, o il titolare del
-- nucleo per chi non ha un accesso suo, paga il corso a cui è iscritto oggi, annuale o trimestre.
-- L'importo è quello del solo corso nel listino (la quota è un'altra cosa, 105) e lo calcola il
-- database, mai il telefono. Un corso con più righe di prezzo, o fuori dal listino, lo prepara la
-- segreteria. L'iscritto non legge `pagamenti_satispay`: quello che gli serve lo danno
-- `satispay_corso_stato` e `satispay_corsi_chi`.
-- La metà di prova: scripts/prova-corso-satispay.mjs, stessi casi e stessi messaggi.
-- Si lancia dopo finto-supabase.sql e i file dello schema (il 106 compreso).
--
-- Cosa si assume del 106:
--   · `pagamenti_satispay.voce` ammette anche 'corso'; al più un pagamento in attesa per (persona, corso);
--     il pagamento in attesa della quota (105) non lo blocca, né il contrario;
--   · `satispay_prepara_corso(persona, corso, formula)` risponde {stato:'attesa', id, importo, satispay_id, link};
--     l'importo è il prezzo del solo corso nel listino (senza quota); scrive la riga (voce 'corso', corso_id, formula);
--   · `satispay_corso_stato(persona, corso)` risponde {stato, importo, pagato_il, chi, satispay_id, formula}
--     dell'ultimo pagamento del corso non ancora in ricevuta, o NULL;
--   · `satispay_corsi_chi(persona)` risponde {adulto, accesso_proprio, come_titolare, corsi:[{corso_id, annuale, trimestre}]},
--     un elemento per ogni corso a cui la persona è iscritta oggi, con gli importi in centesimi (null se adesso non si paga);
--   · `quota_importo` (105) non conta più i pagamenti dei corsi come «già pagato con Satispay»;
--   · chi non può vedere la persona, o paga dove non deve, prende 42501; tutto il resto 22023, con questi testi:
--       non iscritto oggi: «Questa persona non è iscritta a questo corso»
--       formula: «Scegli se pagare l’annuale o il trimestre»
--       fuori listino o senza prezzo per la formula: «Il corso non è nel listino: chiedi alla segreteria»
--       più righe di prezzo: «Per questo corso il prezzo lo fa la segreteria: chiedi lì o paga in palestra»
--       ricevuta con quel corso valida oggi: «Il corso ha già una ricevuta: per quel che manca chiedi alla segreteria»
--       pagato fuori app: «Il corso risulta già pagato fuori dall’app: chiedi alla segreteria»
--       Satispay già pagato, non in ricevuta: «Hai già pagato con Satispay: la segreteria prepara la ricevuta»
--       importo cambiato con un pagamento già da Satispay: «L’importo è cambiato: chiedi alla segreteria prima di pagare»
--       altra formula con un pagamento già da Satispay: «C’è già un pagamento in attesa per questo corso: finiscilo o chiedi alla segreteria»
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

-- --- gli aiuti --------------------------------------------------------------
create or replace function chi(u text) returns void language plpgsql as $$
begin perform set_config('prova.utente', u, false); end $$;
create or replace function atteso(cosa text, avuto text, voluto text) returns text language plpgsql as $$
begin
  if avuto is distinct from voluto and not (voluto like '%…' and avuto like replace(voluto, '…', '%')) then
    raise exception '% · atteso «%», avuto «%»', cosa, voluto, avuto;
  end if;
  return 'ok  ' || cosa || ' → ' || avuto;
end $$;
create or replace function codice(sql text) returns text language plpgsql as $$
begin
  execute sql;
  return 'nessun errore';
exception when others then return sqlstate;
end $$;
create or replace function riga(sql text) returns text language plpgsql as $$
declare esito text;
begin execute sql into esito; return coalesce(esito, 'niente');
exception when others then return 'NEGATO: ' || sqlerrm;
end $$;
create or replace function tenta(sql text) returns text language plpgsql as $$
declare n int; esito text;
begin
  if sql ~* '^\s*select' then execute sql into esito; else execute sql; end if;
  get diagnostics n = row_count;
  return coalesce(esito, case when n = 0 then 'a vuoto (0 righe)' else 'FATTO (' || n || ' righe)' end);
exception when others then return 'NEGATO: ' || sqlerrm;
end $$;
create or replace function pid(n int) returns uuid language sql immutable as $$
  select ('aaaaaaaa-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;
create or replace function cid(n int) returns uuid language sql immutable as $$
  select ('cccccccc-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;
create or replace function rid(n int) returns uuid language sql immutable as $$
  select ('f1f1f1f1-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;
-- Una ricevuta con una voce sola, `descrizione`, di 300 € di cui `pagato` centesimi già dati.
create or replace function rv(n int, persona uuid, descrizione text, pagato int, dal date default current_date - 2,
                              al date default current_date + 300, annullata boolean default false)
  returns void language sql as $$
  insert into ricevute (id, anno, numero, data, persona_id, ente, intestatario, voci, totale, pagato, anticipo, annullata_il)
  values (rid(n), 2026, 900 + n, current_date - 2, persona, '{"nome":"ODS"}', '{"nome":"X","cognome":"Y"}',
    jsonb_build_array(jsonb_build_object('descrizione', descrizione, 'quantita', 1, 'prezzo', 30000, 'dal', dal::text, 'al', al::text,
      'pagamenti', case when pagato > 0 then jsonb_build_array(jsonb_build_object('data', current_date::text, 'importo', pagato, 'metodo', 'Contanti')) else '[]'::jsonb end)),
    30000, pagato, 0, case when annullata then now() end)
  on conflict (id) do update set voci = excluded.voci, pagato = excluded.pagato
$$;

-- --- chi c'è ----------------------------------------------------------------
insert into auth.users (id, email, email_confirmed_at) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it', now()),
  ('33333333-3333-3333-3333-333333333333', 'luca@fam.it', now()),
  ('44444444-4444-4444-4444-444444444444', 'maria@fam.it', now()),
  ('55555555-5555-5555-5555-555555555555', 'bruno@fam.it', now()),
  ('66666666-6666-6666-6666-666666666666', 'zoe@fam.it', now()),
  ('99999999-9999-9999-9999-999999999999', 'gaia@fam.it', now());
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  (pid(1), 'Anna', 'Segreteria', 'staff', 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  (pid(3), 'Luca', 'Fam', 'iscritto', 'luca@fam.it', '33333333-3333-3333-3333-333333333333'),
  (pid(6), 'Bruno', 'Solo', 'iscritto', 'bruno@fam.it', '55555555-5555-5555-5555-555555555555');
-- Il nucleo di Luca: Maria (account suo), Teo (9 anni), Gaia (14 anni, account suo) e gli adulti senza account.
-- Olga ha la ricevuta del corso, Pia l'iscrizione finita ieri, Remo è «pagato fuori app», Gino ha pagato l'iscrizione
-- con Satispay, Lia il corso, Mino la quota (che non conta per il corso), Nora ha una ricevuta finita.
insert into persone (id, nome, cognome, ruolo, email, utente_id, nucleo) values
  (pid(4), 'Maria', 'Fam', 'iscritto', 'maria@fam.it', '44444444-4444-4444-4444-444444444444', pid(3)),
  (pid(5), 'Teo', 'Fam', 'iscritto', null, null, pid(3)),
  (pid(9), 'Gaia', 'Fam', 'iscritto', 'gaia@fam.it', '99999999-9999-9999-9999-999999999999', pid(3)),
  (pid(10), 'Olga', 'Fam', 'iscritto', null, null, pid(3)),
  (pid(11), 'Pia', 'Fam', 'iscritto', null, null, pid(3)),
  (pid(12), 'Remo', 'Fam', 'iscritto', null, null, pid(3)),
  (pid(14), 'Ugo', 'Fam', 'iscritto', null, null, pid(3)),
  (pid(16), 'Gino', 'Fam', 'iscritto', null, null, pid(3)),
  (pid(17), 'Lia', 'Fam', 'iscritto', null, null, pid(3)),
  (pid(18), 'Mino', 'Fam', 'iscritto', null, null, pid(3)),
  (pid(19), 'Nora', 'Fam', 'iscritto', null, null, pid(3)),
  (pid(20), 'Vera', 'Fam', 'iscritto', null, null, pid(3));
insert into anagrafiche (persona_id, nato_il)
  select pid(n), current_date - interval '40 years' from unnest(array[3,4,6,10,11,12,14,16,17,18,19,20]) n;
insert into anagrafiche (persona_id, nato_il) values (pid(5), current_date - interval '9 years'), (pid(9), current_date - interval '14 years');

-- I corsi: Judo (una riga di prezzo), Pilates (annuale con il saldo ancora in tempo), Karate (due righe di prezzo),
-- Zumba (non è nel listino), Boxe (nel listino solo con il trimestre).
insert into corsi (id, nome) values (cid(1), 'Judo'), (cid(2), 'Pilates'), (cid(3), 'Karate'), (cid(4), 'Zumba'), (cid(5), 'Boxe');
update impostazioni set listino = jsonb_build_object('quota', 50, 'saldoEntro', (current_date + 30)::text, 'corsi', jsonb_build_array(
  jsonb_build_object('corsoId', cid(1), 'corso', 'Judo', 'prezzi', jsonb_build_array(jsonb_build_object('annuale', 300, 'trimestre', 120))),
  jsonb_build_object('corsoId', cid(2), 'corso', 'Pilates', 'prezzi', jsonb_build_array(jsonb_build_object('annuale', 250, 'saldo', 200))),
  jsonb_build_object('corsoId', cid(3), 'corso', 'Karate', 'prezzi', jsonb_build_array(
    jsonb_build_object('etichetta', '1 giorno', 'annuale', 200), jsonb_build_object('etichetta', '2 giorni', 'annuale', 350))),
  jsonb_build_object('corsoId', cid(5), 'corso', 'Boxe', 'prezzi', jsonb_build_array(jsonb_build_object('trimestre', 90))))) where id;
insert into iscrizioni (corso_id, persona_id, dal, al) select cid(1), pid(n), current_date - 100, null from unnest(array[3,4,5,10,11,12,14,16,17,18,19,20]) n;
insert into iscrizioni (corso_id, persona_id, dal, al) values
  (cid(2), pid(3), current_date - 100, null), (cid(3), pid(3), current_date - 100, null), (cid(4), pid(3), current_date - 100, null),
  (cid(5), pid(3), current_date - 100, null), (cid(1), pid(9), current_date - 100, null), (cid(2), pid(9), current_date - 100, null);
-- Pia: l'iscrizione al Judo è finita ieri; Bruno non è iscritto a niente.
update iscrizioni set al = current_date - 1 where corso_id = cid(1) and persona_id = pid(11);

select rv(1, pid(10), 'Annuale Judo', 10000);
-- Vera: una ricevuta del corso senza date, che il database non sa dire finita: vale ancora.
select rv(3, pid(20), 'Annuale Judo', 10000, dal => null, al => null);
select rv(2, pid(19), 'Annuale Judo', 30000, dal => current_date - 400, al => current_date - 10);
insert into schede_iscritti (persona_id, pagamento, pagato_fino) values (pid(12), 'pagato', current_date + 100)
  on conflict (persona_id) do update set pagamento = excluded.pagamento, pagato_fino = excluded.pagato_fino;
-- Gino: l'iscrizione pagata con Satispay (quota e corso insieme), mai messa in ricevuta.
insert into pagamenti_satispay (chi, importo, stato, persona_id, pagato_il) values ('Fam Gino', 35000, 'pagato', pid(16), now());
insert into pagamenti_satispay (chi, importo, stato, persona_id, voce, corso_id, formula, pagato_il) values ('Fam Lia', 30000, 'pagato', pid(17), 'corso', cid(1), 'annuale', now());
insert into pagamenti_satispay (chi, importo, stato, persona_id, voce, pagato_il) values ('Fam Mino', 5000, 'pagato', pid(18), 'quota', now());

\echo ''
\echo '--- 1. cosa c''è nel database ---'
select atteso('la colonna voce ammette «corso»', (select count(*)::text from pagamenti_satispay where voce = 'corso'), '1');
select atteso('…e ancora niente di strano', tenta($$insert into pagamenti_satispay (chi, importo, stato, persona_id, voce) values ('Fam X', 1, 'attesa', null, 'corsi')$$), 'NEGATO: …');
select atteso('satispay_prepara_corso c''è, e vuole persona, corso e formula (l''importo non viene dal telefono)',
  coalesce((select string_agg(oidvectortypes(proargtypes), ';') from pg_proc where proname = 'satispay_prepara_corso'), 'non c''è'), 'uuid, uuid, text');
select atteso('satispay_corso_stato c''è', coalesce(to_regprocedure('satispay_corso_stato(uuid,uuid)')::text, 'non c''è'), 'satispay_corso_stato(uuid,uuid)');
select atteso('satispay_corsi_chi c''è', coalesce(to_regprocedure('satispay_corsi_chi(uuid)')::text, 'non c''è'), 'satispay_corsi_chi(uuid)');
select atteso('l''indice della quota (105) vale solo per la quota: un corso in attesa non lo tocca',
  (select count(*)::text from pg_indexes where indexname = 'pagamenti_satispay_quota' and indexdef ilike '%''quota''%'), '1');

\echo ''
\echo '--- 2. chi può chiamare ---'
select atteso('chi è entrato prepara', has_function_privilege('authenticated', 'satispay_prepara_corso(uuid,uuid,text)', 'execute')::text, 'true');
select atteso('…legge lo stato', has_function_privilege('authenticated', 'satispay_corso_stato(uuid,uuid)', 'execute')::text, 'true');
select atteso('…e chi è la persona', has_function_privilege('authenticated', 'satispay_corsi_chi(uuid)', 'execute')::text, 'true');
select atteso('anon non prepara', has_function_privilege('anon', 'satispay_prepara_corso(uuid,uuid,text)', 'execute')::text, 'false');
select atteso('…non legge lo stato', has_function_privilege('anon', 'satispay_corso_stato(uuid,uuid)', 'execute')::text, 'false');
select atteso('…e non sa chi è', has_function_privilege('anon', 'satispay_corsi_chi(uuid)', 'execute')::text, 'false');
select atteso('l''importo non si calcola da fuori', has_function_privilege('authenticated', 'corso_importo(uuid,uuid,text)', 'execute')::text, 'false');
select chi('');
set role anon;
select atteso('anon chiamandola prende «non hai il permesso»', codice($$select satispay_prepara_corso(pid(3), cid(1), 'annuale')$$), '42501');
reset role;

\echo ''
\echo '--- 3. l''iscritto paga il corso, senza la quota ---'
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('Luca, Judo annuale: 300 €, non 350', riga($$select satispay_prepara_corso(pid(3), cid(1), 'annuale')->>'importo'$$), '30000');
select atteso('…in attesa', riga($$select satispay_prepara_corso(pid(3), cid(1), 'annuale')->>'stato'$$), 'attesa');
reset role;
select atteso('…un pagamento solo, del corso, in attesa e non in una ricevuta',
  (select count(*)::text || ' ' || min(stato) || ' ' || min(importo) || ' ' || bool_and(persona_id = pid(3) and voce = 'corso' and corso_id = cid(1)
      and formula = 'annuale' and saldo_di is null and ricevuta_id is null)::text from pagamenti_satispay where persona_id = pid(3)), '1 attesa 30000 true');
select id::text as spid from pagamenti_satispay where persona_id = pid(3) \gset
set role authenticated;
select atteso('un secondo tocco ridà lo stesso pagamento', riga($$select satispay_prepara_corso(pid(3), cid(1), 'annuale')->>'id'$$), :'spid');
reset role;
select atteso('…e non ne fa un secondo', (select count(*)::text from pagamenti_satispay where persona_id = pid(3)), '1');
select atteso('il database non lascia due pagamenti vivi dello stesso corso per la stessa persona',
  tenta($$insert into pagamenti_satispay (chi, importo, stato, persona_id, voce, corso_id, formula) values ('Fam Luca', 12000, 'attesa', pid(3), 'corso', cid(1), 'trimestre')$$), 'NEGATO: …');
set role authenticated;
select atteso('Judo trimestre, mai arrivato a Satispay: si chiude il vecchio e ne nasce uno da 120 €', riga($$select satispay_prepara_corso(pid(3), cid(1), 'trimestre')->>'importo'$$), '12000');
reset role;
select atteso('…il vecchio è chiuso', (select string_agg(stato || importo, ',' order by importo) from pagamenti_satispay where persona_id = pid(3)), 'attesa12000,non-andato30000');
-- Con Satispay che lo conosce, un'altra formula non si apre.
update pagamenti_satispay set satispay_id = 'sp-prova-luca' where persona_id = pid(3) and stato = 'attesa';
set role authenticated;
select atteso('già da Satispay, un''altra formula: no', riga($$select satispay_prepara_corso(pid(3), cid(1), 'annuale')$$), 'NEGATO: C’è già un pagamento in attesa per questo corso: finiscilo o chiedi alla segreteria');
select atteso('…col codice di un rifiuto', codice($$select satispay_prepara_corso(pid(3), cid(1), 'annuale')$$), '22023');
reset role;
-- Il listino cambia mentre il pagamento aspetta.
update impostazioni set listino = jsonb_set(listino, '{corsi,0,prezzi,0,trimestre}', '130') where id;
set role authenticated;
select atteso('con l''importo cambiato Satispay non offre PAGA: l''importo è null', riga($$select (c->'corsi'->0->'trimestre' = 'null'::jsonb)::text from satispay_corsi_chi(pid(3)) c$$), 'true');
select atteso('…e si rifiuta di riproporlo', riga($$select satispay_prepara_corso(pid(3), cid(1), 'trimestre')$$), 'NEGATO: L’importo è cambiato: chiedi alla segreteria prima di pagare');
reset role;
update impostazioni set listino = jsonb_set(listino, '{corsi,0,prezzi,0,trimestre}', '120') where id;
delete from pagamenti_satispay where persona_id = pid(3);

\echo ''
\echo '--- 4. la quota e i corsi non si pestano i piedi ---'
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('Luca prepara la quota con un corso in attesa: nessun intralcio', riga($$select satispay_prepara_quota(pid(3))->>'importo'$$), '5000');
select atteso('…e un corso con la quota in attesa', riga($$select satispay_prepara_corso(pid(3), cid(1), 'annuale')->>'importo'$$), '30000');
select atteso('…e un secondo corso, Pilates: l''annuale col saldo ancora in tempo, 200 €', riga($$select satispay_prepara_corso(pid(3), cid(2), 'annuale')->>'importo'$$), '20000');
reset role;
select atteso('…tre pagamenti vivi, uno per voce', (select string_agg(voce || coalesce(corso_id::text, ''), ',' order by voce, corso_id) from pagamenti_satispay where persona_id = pid(3) and stato = 'attesa'),
  'corso' || cid(1)::text || ',corso' || cid(2)::text || ',quota');
-- Mino ha pagato la quota con Satispay e Lia un corso: il corso di Mino si paga, la quota di Lia anche (il corso non è «la quota già pagata»).
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('Mino, con la quota pagata e non in ricevuta, paga il corso', riga($$select satispay_prepara_corso(pid(18), cid(1), 'annuale')->>'importo'$$), '30000');
select atteso('Lia, con il corso pagato e non in ricevuta, paga la quota (il corso non la copre)', riga($$select satispay_prepara_quota(pid(17))->>'importo'$$), '5000');
select atteso('…e Lia il corso di nuovo no', riga($$select satispay_prepara_corso(pid(17), cid(1), 'annuale')$$), 'NEGATO: Hai già pagato con Satispay: la segreteria prepara la ricevuta');
select atteso('Gino ha pagato l''iscrizione (quota e corso): il corso no', riga($$select satispay_prepara_corso(pid(16), cid(1), 'annuale')$$), 'NEGATO: Hai già pagato con Satispay: la segreteria prepara la ricevuta');
select atteso('…e la quota nemmeno', codice($$select satispay_prepara_quota(pid(16))$$), '22023');
reset role;
delete from pagamenti_satispay where stato = 'attesa';

\echo ''
\echo '--- 5. quando il corso non si paga online ---'
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('non è iscritto a quel corso: Luca per Teo a Pilates', riga($$select satispay_prepara_corso(pid(5), cid(2), 'annuale')$$), 'NEGATO: Questa persona non è iscritta a questo corso');
select atteso('l''iscrizione è finita ieri: Pia', riga($$select satispay_prepara_corso(pid(11), cid(1), 'annuale')$$), 'NEGATO: Questa persona non è iscritta a questo corso');
select atteso('un corso che non c''è', riga($$select satispay_prepara_corso(pid(3), gen_random_uuid(), 'annuale')$$), 'NEGATO: Questa persona non è iscritta a questo corso');
select atteso('una formula sbagliata', riga($$select satispay_prepara_corso(pid(3), cid(1), 'mensile')$$), 'NEGATO: Scegli se pagare l’annuale o il trimestre');
select atteso('…e nessuna formula', codice($$select satispay_prepara_corso(pid(3), cid(1), null)$$), '22023');
select atteso('Karate ha due righe di prezzo: lo fa la segreteria', riga($$select satispay_prepara_corso(pid(3), cid(3), 'annuale')$$), 'NEGATO: Per questo corso il prezzo lo fa la segreteria: chiedi lì o paga in palestra');
select atteso('Zumba non è nel listino', riga($$select satispay_prepara_corso(pid(3), cid(4), 'annuale')$$), 'NEGATO: Il corso non è nel listino: chiedi alla segreteria');
select atteso('Boxe ha solo il trimestre: l''annuale non c''è', riga($$select satispay_prepara_corso(pid(3), cid(5), 'annuale')$$), 'NEGATO: Il corso non è nel listino: chiedi alla segreteria');
select atteso('…il trimestre sì: 90 €', riga($$select satispay_prepara_corso(pid(3), cid(5), 'trimestre')->>'importo'$$), '9000');
select atteso('Olga ha la ricevuta del corso, pagata in parte: no', riga($$select satispay_prepara_corso(pid(10), cid(1), 'annuale')$$), 'NEGATO: Il corso ha già una ricevuta: per quel che manca chiedi alla segreteria');
select atteso('Remo, pagato fuori app, oggi valido: no', riga($$select satispay_prepara_corso(pid(12), cid(1), 'annuale')$$), 'NEGATO: Il corso risulta già pagato fuori dall’app: chiedi alla segreteria');
select atteso('Nora, con la ricevuta del corso finita: si paga, 300 €', riga($$select satispay_prepara_corso(pid(19), cid(1), 'annuale')->>'importo'$$), '30000');
select atteso('tutti questi rifiuti sono di quelli che si correggono (22023)',
  codice($$select satispay_prepara_corso(pid(10), cid(1), 'annuale')$$) || codice($$select satispay_prepara_corso(pid(12), cid(1), 'annuale')$$) || codice($$select satispay_prepara_corso(pid(3), cid(3), 'annuale')$$), '220232202322023');
select atteso('Vera ha una ricevuta del corso senza date: vale ancora, no', riga($$select satispay_prepara_corso(pid(20), cid(1), 'annuale')$$), 'NEGATO: Il corso ha già una ricevuta: per quel che manca chiedi alla segreteria');
reset role;
-- Un prezzo a zero non è un prezzo: non si fa pagare 0 € con Satispay.
update impostazioni set listino = jsonb_set(listino, '{corsi,3,prezzi,0,trimestre}', '0'::jsonb) where id;
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('Boxe a 0 €: non si paga online', riga($$select satispay_prepara_corso(pid(3), cid(5), 'trimestre')$$), 'NEGATO: Il corso non è nel listino: chiedi alla segreteria');
reset role;
update impostazioni set listino = null where id;
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('senza listino nemmeno', codice($$select satispay_prepara_corso(pid(14), cid(1), 'annuale')$$), '22023');
reset role;
-- Si rimette il listino com'era per i casi che seguono.
update impostazioni set listino = jsonb_build_object('quota', 50, 'saldoEntro', (current_date + 30)::text, 'corsi', jsonb_build_array(
  jsonb_build_object('corsoId', cid(1), 'corso', 'Judo', 'prezzi', jsonb_build_array(jsonb_build_object('annuale', 300, 'trimestre', 120))),
  jsonb_build_object('corsoId', cid(2), 'corso', 'Pilates', 'prezzi', jsonb_build_array(jsonb_build_object('annuale', 250, 'saldo', 200))),
  jsonb_build_object('corsoId', cid(3), 'corso', 'Karate', 'prezzi', jsonb_build_array(
    jsonb_build_object('etichetta', '1 giorno', 'annuale', 200), jsonb_build_object('etichetta', '2 giorni', 'annuale', 350))),
  jsonb_build_object('corsoId', cid(5), 'corso', 'Boxe', 'prezzi', jsonb_build_array(jsonb_build_object('trimestre', 90))))) where id;
delete from pagamenti_satispay where stato = 'attesa';

\echo ''
\echo '--- 6. dopo il saldo del listino ---'
update impostazioni set listino = jsonb_set(listino, '{saldoEntro}', to_jsonb((current_date - 1)::text)) where id;
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('passata la data del saldo, Pilates costa l''annuale: 250 €', riga($$select satispay_prepara_corso(pid(3), cid(2), 'annuale')->>'importo'$$), '25000');
reset role;
update impostazioni set listino = jsonb_set(listino, '{saldoEntro}', to_jsonb((current_date + 30)::text)) where id;
delete from pagamenti_satispay where stato = 'attesa';

\echo ''
\echo '--- 7. un minorenne lo paga il titolare, un accesso proprio da sé ---'
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('Luca per Teo (9 anni, senza account)', riga($$select satispay_prepara_corso(pid(5), cid(1), 'annuale')->>'importo'$$), '30000');
select atteso('Luca per Ugo (adulto senza account)', riga($$select satispay_prepara_corso(pid(14), cid(1), 'trimestre')->>'importo'$$), '12000');
select atteso('un familiare con l''accesso suo no: Luca per Maria', codice($$select satispay_prepara_corso(pid(4), cid(1), 'annuale')$$), '42501');
select atteso('…nemmeno una minorenne con l''accesso suo: Luca per Gaia', codice($$select satispay_prepara_corso(pid(9), cid(1), 'annuale')$$), '42501');
reset role;
select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('Maria paga da sé', riga($$select satispay_prepara_corso(pid(4), cid(1), 'annuale')->>'importo'$$), '30000');
select atteso('…non per Teo: non è il titolare', codice($$select satispay_prepara_corso(pid(5), cid(1), 'annuale')$$), '42501');
reset role;
select chi('99999999-9999-9999-9999-999999999999');
set role authenticated;
select atteso('Gaia, minorenne, da sé non paga: serve il titolare', codice($$select satispay_prepara_corso(pid(9), cid(1), 'annuale')$$), '42501');
reset role;
select count(*)::text as prima from pagamenti_satispay \gset
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('la persona di un altro: Bruno per Luca', codice($$select satispay_prepara_corso(pid(3), cid(1), 'annuale')$$), '42501');
select atteso('…Bruno per Teo', codice($$select satispay_prepara_corso(pid(5), cid(1), 'annuale')$$), '42501');
select atteso('una persona che non c''è', codice($$select satispay_prepara_corso(gen_random_uuid(), cid(1), 'annuale')$$), '42501');
select atteso('…né il nulla', codice($$select satispay_prepara_corso(null, cid(1), 'annuale')$$), '42501');
select atteso('Bruno, senza corsi, per sé: non è iscritto', codice($$select satispay_prepara_corso(pid(6), cid(1), 'annuale')$$), '22023');
reset role;
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('un account senza persona non paga per nessuno', codice($$select satispay_prepara_corso(pid(6), cid(1), 'annuale')$$), '42501');
reset role;
select atteso('i rifiuti dei permessi non hanno scritto niente (Bruno, Zoe)', (select count(*)::text from pagamenti_satispay), :'prima');
delete from pagamenti_satispay where stato = 'attesa';

\echo ''
\echo '--- 8. nessuno legge i pagamenti, e lo stato si legge con la funzione ---'
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('l''iscritto non legge pagamenti_satispay', riga($$select count(*)::text from pagamenti_satispay$$), '0');
select atteso('…né ci scrive', tenta($$update pagamenti_satispay set stato = 'pagato'$$), 'NEGATO: …');
select atteso('mai partito: niente', riga($$select satispay_corso_stato(pid(10), cid(1))::text$$), 'niente');
select atteso('Lia ha pagato il corso: pagato, per 30000, annuale', riga($$select (s->>'stato') || ' ' || (s->>'importo') || ' ' || (s->>'formula') from satispay_corso_stato(pid(17), cid(1)) s$$), 'pagato 30000 annuale');
select atteso('…con il nome intero, perché è il titolare', riga($$select (satispay_corso_stato(pid(17), cid(1))->>'chi' like '%Lia%' and satispay_corso_stato(pid(17), cid(1))->>'chi' like '%Fam%')::text$$), 'true');
select atteso('Lia a un altro corso: niente', riga($$select satispay_corso_stato(pid(17), cid(2))::text$$), 'niente');
select atteso('l''iscrizione di Gino non è lo stato di un corso: niente', riga($$select satispay_corso_stato(pid(16), cid(1))::text$$), 'niente');
select atteso('la quota di Mino non è lo stato di un corso: niente', riga($$select satispay_corso_stato(pid(18), cid(1))::text$$), 'niente');
select atteso('Luca non vede quello di Gaia, che ha l''accesso suo', riga($$select satispay_corso_stato(pid(9), cid(1))::text$$), 'niente');
reset role;
update pagamenti_satispay set ricevuta_id = rid(1) where persona_id = pid(17) and voce = 'corso';
set role authenticated;
select atteso('già in una ricevuta è storia, non lo stato di adesso: niente', riga($$select satispay_corso_stato(pid(17), cid(1))::text$$), 'niente');
reset role;
select chi('');
set role anon;
select atteso('anon non legge lo stato', codice($$select satispay_corso_stato(pid(17), cid(1))$$), '42501');
reset role;
-- Il nome di chi ha pagato: Gaia (14 anni, account suo) e Maria (adulta) hanno pagato dal loro telefono, Teo (9 anni)
-- lo ha pagato Luca. Un minorenne che guarda da sé vede solo il nome: il cognome è del nucleo, e il titolare lo vede intero.
insert into pagamenti_satispay (chi, importo, stato, persona_id, voce, corso_id, formula, pagato_il) values
  ('Fam Gaia', 30000, 'pagato', pid(9), 'corso', cid(1), 'annuale', now()),
  ('Fam Maria', 30000, 'pagato', pid(4), 'corso', cid(1), 'annuale', now()),
  ('Fam Teo', 30000, 'pagato', pid(5), 'corso', cid(1), 'annuale', now());
select chi('99999999-9999-9999-9999-999999999999');
set role authenticated;
select atteso('Gaia, minorenne, da sé vede solo il nome', riga($$select satispay_corso_stato(pid(9), cid(1))->>'chi'$$), 'Gaia');
reset role;
select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('Maria, adulta, da sé vede il nome intero', riga($$select satispay_corso_stato(pid(4), cid(1))->>'chi'$$), 'Fam Maria');
reset role;
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('Luca, titolare, vede Teo col nome intero', riga($$select satispay_corso_stato(pid(5), cid(1))->>'chi'$$), 'Fam Teo');
select atteso('…e un corso pagato da un minorenne con l''accesso suo non lo vede', riga($$select satispay_corso_stato(pid(9), cid(1))::text$$), 'niente');
reset role;
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('Bruno non vede quello di Teo', riga($$select satispay_corso_stato(pid(5), cid(1))::text$$), 'niente');
reset role;

\echo ''
\echo '--- 9. chi è la persona, per chi paga, e quanto ---'
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('Luca vede com''è Ugo: senza accesso, del nucleo, adulto', riga($$select (c->>'accesso_proprio') || ' ' || (c->>'come_titolare') || ' ' || (c->>'adulto') from satispay_corsi_chi(pid(14)) c$$), 'false true true');
select atteso('Ugo ha il Judo: annuale 300 e trimestre 120', riga($$select (e->>'annuale') || ' ' || (e->>'trimestre') from satispay_corsi_chi(pid(14)) c, jsonb_array_elements(c->'corsi') e where e->>'corso_id' = cid(1)::text$$), '30000 12000');
select atteso('Luca ha cinque corsi', riga($$select jsonb_array_length(satispay_corsi_chi(pid(3))->'corsi')::text$$), '5');
select atteso('…Karate lo fa la segreteria', riga($$select (e->>'segreteria') from satispay_corsi_chi(pid(3)) c, jsonb_array_elements(c->'corsi') e where e->>'corso_id' = cid(3)::text$$), 'true');
select atteso('…Judo no', riga($$select (e->>'segreteria') from satispay_corsi_chi(pid(3)) c, jsonb_array_elements(c->'corsi') e where e->>'corso_id' = cid(1)::text$$), 'false');
select atteso('…Pilates con il saldo: 200 €', riga($$select e->>'annuale' from satispay_corsi_chi(pid(3)) c, jsonb_array_elements(c->'corsi') e where e->>'corso_id' = cid(2)::text$$), '20000');
select atteso('…Karate non si paga online: gli importi sono null', riga($$select ((e->'annuale') = 'null'::jsonb and (e->'trimestre') = 'null'::jsonb)::text from satispay_corsi_chi(pid(3)) c, jsonb_array_elements(c->'corsi') e where e->>'corso_id' = cid(3)::text$$), 'true');
select atteso('…Zumba nemmeno', riga($$select ((e->'annuale') = 'null'::jsonb)::text from satispay_corsi_chi(pid(3)) c, jsonb_array_elements(c->'corsi') e where e->>'corso_id' = cid(4)::text$$), 'true');
select atteso('…Boxe ha solo il trimestre', riga($$select (e->'annuale' = 'null'::jsonb)::text || ' ' || (e->>'trimestre') from satispay_corsi_chi(pid(3)) c, jsonb_array_elements(c->'corsi') e where e->>'corso_id' = cid(5)::text$$), 'true 9000');
select atteso('Olga ha la ricevuta del Judo: null', riga($$select ((e->'annuale') = 'null'::jsonb)::text from satispay_corsi_chi(pid(10)) c, jsonb_array_elements(c->'corsi') e where e->>'corso_id' = cid(1)::text$$), 'true');
select atteso('Remo, pagato fuori app: null', riga($$select ((e->'annuale') = 'null'::jsonb)::text from satispay_corsi_chi(pid(12)) c, jsonb_array_elements(c->'corsi') e where e->>'corso_id' = cid(1)::text$$), 'true');
select atteso('Gino ha l''iscrizione di Satispay: null', riga($$select ((e->'annuale') = 'null'::jsonb)::text from satispay_corsi_chi(pid(16)) c, jsonb_array_elements(c->'corsi') e where e->>'corso_id' = cid(1)::text$$), 'true');
select atteso('Nora, con la ricevuta finita, si può: 300', riga($$select e->>'annuale' from satispay_corsi_chi(pid(19)) c, jsonb_array_elements(c->'corsi') e where e->>'corso_id' = cid(1)::text$$), '30000');
select atteso('Pia, con l''iscrizione finita, non ha corsi', riga($$select jsonb_array_length(satispay_corsi_chi(pid(11))->'corsi')::text$$), '0');
select atteso('Luca vede com''è Teo: senza accesso, del nucleo, minorenne', riga($$select (c->>'accesso_proprio') || ' ' || (c->>'come_titolare') || ' ' || (c->>'adulto') from satispay_corsi_chi(pid(5)) c$$), 'false true false');
select atteso('Maria ha l''accesso suo: Luca non la vede',riga($$select satispay_corsi_chi(pid(4))::text$$), 'niente');
select atteso('una persona che non c''è: niente', riga($$select satispay_corsi_chi(gen_random_uuid())::text$$), 'niente');
reset role;
select chi('');
set role anon;
select atteso('anon non sa chi è nessuno', codice($$select satispay_corsi_chi(pid(5))$$), '42501');
reset role;
select chi('99999999-9999-9999-9999-999999999999');
set role authenticated;
select atteso('Gaia, da sé: accesso suo, non titolare, minorenne', riga($$select (c->>'accesso_proprio') || ' ' || (c->>'come_titolare') || ' ' || (c->>'adulto') from satispay_corsi_chi(pid(9)) c$$), 'true false false');
reset role;

\echo ''
\echo '--- 10. rilanciare il file non cambia niente ---'
select count(*)::text as dopo_conta from pagamenti_satispay \gset
\ir ../106-paga-corso-satispay.sql
select atteso('dopo il rilancio i pagamenti sono gli stessi', (select count(*)::text from pagamenti_satispay), :'dopo_conta');
