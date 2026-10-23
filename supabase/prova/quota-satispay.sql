-- La quota associativa intera con Satispay (105-paga-quota-satispay.sql): l'iscritto,
-- o il titolare del nucleo per chi non ha un accesso suo, paga la quota di un rinnovo
-- o di una prima iscrizione (da pagare o scaduta). L'importo lo calcola il database dal
-- listino (mai il telefono), un pagamento solo in attesa per persona, e l'iscritto non
-- legge `pagamenti_satispay`: quello che gli serve lo danno `satispay_quota_stato` e
-- `satispay_quota_chi`. Il riferimento che si legge in Satispay lo codifica la Edge
-- Function, non si prova qui.
-- La metà di prova: scripts/prova-quota-satispay.mjs, stessi casi e stessi messaggi.
-- Si lancia dopo finto-supabase.sql e i file dello schema (il 105 compreso).
--
-- Cosa si assume del 105, da confermare quando c'è:
--   · `pagamenti_satispay.voce text check (voce in ('quota'))`, null per iscrizione e saldo; indice unico
--     (persona_id, voce) where voce is not null and stato = 'attesa';
--   · `satispay_prepara_quota(persona)` risponde {stato:'attesa', id, importo, satispay_id, link}, l'importo è
--     round((impostazioni.listino->>'quota')::numeric * 100), e scrive la riga in attesa (voce 'quota');
--   · `satispay_quota_stato(persona)` risponde {stato, importo, pagato_il, chi, satispay_id} dell'ultimo pagamento
--     con voce 'quota', o NULL (anche per una persona che chi chiama non può vedere);
--   · `satispay_quota_chi(persona)` come `satispay_saldo_chi` più `importo` (centesimi, o null se adesso non si paga);
--   · chi non può vedere la persona, o paga dove non deve, prende 42501; tutto il resto 22023, con questi testi:
--       ricevuta con la quota che vale oggi: «La quota associativa ha già una ricevuta: per quel che manca c’è il saldo»
--       pagato fuori app (`schede_iscritti.pagamento` <> da_pagare, `pagato_fino` >= oggi): «La quota risulta già pagata fuori dall’app: chiedi alla segreteria»
--       Satispay già pagato, non in ricevuta: «Hai già pagato con Satispay: la segreteria prepara la ricevuta»
--       listino senza quota: «La quota non è nel listino: chiedi alla segreteria»
--       importo cambiato con un pagamento in attesa: «L’importo è cambiato: chiedi alla segreteria prima di pagare»
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
-- Il codice dell'errore, per distinguere «non è tuo» (42501) da «così non si paga» (22023).
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
-- Le ricevute per numero. Una quota di 50 € di cui `pagato` centesimi sono già dati.
create or replace function rv(n int, persona uuid, pagato int, descrizione text default 'QUOTA ASSOCIATIVA',
                              dal date default current_date - 2, al date default current_date + 300, annullata boolean default false)
  returns void language sql as $$
  insert into ricevute (id, anno, numero, data, persona_id, ente, intestatario, voci, totale, pagato, anticipo, annullata_il)
  values (('f1f1f1f1-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, 2026, 900 + n, current_date - 2, persona, '{"nome":"ODS"}', '{"nome":"X","cognome":"Y"}',
    jsonb_build_array(jsonb_build_object('descrizione', descrizione, 'quantita', 1, 'prezzo', 5000, 'dal', dal::text, 'al', al::text,
      'pagamenti', case when pagato > 0 then jsonb_build_array(jsonb_build_object('data', current_date::text, 'importo', pagato, 'metodo', 'Contanti')) else '[]'::jsonb end)),
    5000, pagato, 0, case when annullata then now() end)
  on conflict (id) do update set voci = excluded.voci, pagato = excluded.pagato
$$;
create or replace function rid(n int) returns uuid language sql immutable as $$
  select ('f1f1f1f1-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid
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
insert into anagrafiche (persona_id, nato_il) values
  (pid(3), current_date - interval '45 years'), (pid(6), current_date - interval '30 years');
-- Il nucleo di Luca: Maria (adulta, con l'account suo), Teo (9 anni) e gli adulti senza account, Gaia (14 anni) con l'account suo.
-- Olga ha la quota pagata, Pia in parte, Remo e Dino «pagato fuori app», Ugo è scaduto fuori app, Sara ha una ricevuta finita,
-- Vera una annullata, Gino un Satispay dell'iscrizione, Lia uno del saldo, Mino uno della quota.
insert into persone (id, nome, cognome, ruolo, email, utente_id, nucleo) values
  (pid(4), 'Maria', 'Fam', 'iscritto', 'maria@fam.it', '44444444-4444-4444-4444-444444444444', pid(3)),
  (pid(5), 'Teo', 'Fam', 'iscritto', null, null, pid(3)),
  (pid(8), 'Nilde', 'Fam', 'iscritto', null, null, pid(3)),
  (pid(9), 'Gaia', 'Fam', 'iscritto', 'gaia@fam.it', '99999999-9999-9999-9999-999999999999', pid(3)),
  (pid(10), 'Olga', 'Fam', 'iscritto', null, null, pid(3)),
  (pid(11), 'Pia', 'Fam', 'iscritto', null, null, pid(3)),
  (pid(12), 'Remo', 'Fam', 'iscritto', null, null, pid(3)),
  (pid(13), 'Dino', 'Fam', 'iscritto', null, null, pid(3)),
  (pid(14), 'Ugo', 'Fam', 'iscritto', null, null, pid(3)),
  (pid(15), 'Sara', 'Fam', 'iscritto', null, null, pid(3)),
  (pid(16), 'Gino', 'Fam', 'iscritto', null, null, pid(3)),
  (pid(17), 'Lia', 'Fam', 'iscritto', null, null, pid(3)),
  (pid(18), 'Mino', 'Fam', 'iscritto', null, null, pid(3)),
  (pid(19), 'Vera', 'Fam', 'iscritto', null, null, pid(3));
insert into anagrafiche (persona_id, nato_il)
  select pid(n), current_date - interval '40 years' from generate_series(4, 19) n where n not in (5, 9, 6, 7);
insert into anagrafiche (persona_id, nato_il) values (pid(5), current_date - interval '9 years'), (pid(9), current_date - interval '14 years')
  on conflict (persona_id) do nothing;

select rv(5, pid(4), 1000), rv(10, pid(10), 5000), rv(11, pid(11), 2000),
       rv(12, pid(15), 4000, dal => current_date - 400, al => current_date - 10), rv(13, pid(19), 0, annullata => true);
-- L'eccezione «pagato fuori app» sta in `schede_iscritti`; queste persone non hanno ricevute, quindi nessun trigger la toglie.
insert into schede_iscritti (persona_id, pagamento, pagato_fino) values (pid(12), 'pagato', current_date + 100)
  on conflict (persona_id) do update set pagamento = excluded.pagamento, pagato_fino = excluded.pagato_fino;
insert into schede_iscritti (persona_id, pagamento, pagato_fino) values (pid(13), 'in_parte', current_date + 100)
  on conflict (persona_id) do update set pagamento = excluded.pagamento, pagato_fino = excluded.pagato_fino;
insert into schede_iscritti (persona_id, pagamento, pagato_fino) values (pid(14), 'pagato', current_date - 10)
  on conflict (persona_id) do update set pagamento = excluded.pagamento, pagato_fino = excluded.pagato_fino;
insert into pagamenti_satispay (chi, importo, stato, persona_id, pagato_il) values ('Fam Gino', 45000, 'pagato', pid(16), now());
insert into pagamenti_satispay (chi, importo, stato, persona_id, saldo_di, pagato_il) values ('Fam Lia', 2000, 'pagato', pid(17), rid(5), now());
-- Il saldo di Nilde e la sua iscrizione: non sono la quota.
insert into pagamenti_satispay (chi, importo, stato, persona_id, saldo_di, pagato_il) values ('Fam Nilde', 2000, 'pagato', pid(8), rid(5), now());
insert into pagamenti_satispay (chi, importo, stato, persona_id, pagato_il) values ('Fam Nilde', 45000, 'pagato', pid(8), now());

update impostazioni set listino = '{"quota": 50}' where id;

\echo ''
\echo '--- 1. cosa c''è nel database ---'
select atteso('la colonna voce c''è', (select count(*)::text from information_schema.columns where table_name = 'pagamenti_satispay' and column_name = 'voce'), '1');
select atteso('…e per l''iscrizione e il saldo è vuota', (select count(*)::text from pagamenti_satispay where voce is not null), '0');
select atteso('…ammette solo «quota»', tenta($$insert into pagamenti_satispay (chi, importo, stato, persona_id, voce) values ('Fam Lia', 1, 'attesa', null, 'corsi')$$), 'NEGATO: …');
select atteso('un solo pagamento della quota vivo per persona: l''indice unico',
  (select count(*)::text from pg_indexes where tablename = 'pagamenti_satispay' and indexdef ilike '%unique%' and indexdef ilike '%persona_id%' and indexdef ilike '%voce%'), '1');
select atteso('satispay_prepara_quota c''è, e vuole solo la persona (l''importo non viene dal telefono)',
  coalesce((select string_agg(oidvectortypes(proargtypes), ';') from pg_proc where proname = 'satispay_prepara_quota'), 'non c''è'), 'uuid');
select atteso('satispay_quota_stato c''è', coalesce(to_regprocedure('satispay_quota_stato(uuid)')::text, 'non c''è'), 'satispay_quota_stato(uuid)');
select atteso('satispay_quota_chi c''è', coalesce(to_regprocedure('satispay_quota_chi(uuid)')::text, 'non c''è'), 'satispay_quota_chi(uuid)');

\echo ''
\echo '--- 2. chi può chiamare ---'
select atteso('chi è entrato prepara la quota', has_function_privilege('authenticated', 'satispay_prepara_quota(uuid)', 'execute')::text, 'true');
select atteso('…e legge lo stato', has_function_privilege('authenticated', 'satispay_quota_stato(uuid)', 'execute')::text, 'true');
select atteso('…e chi è la persona', has_function_privilege('authenticated', 'satispay_quota_chi(uuid)', 'execute')::text, 'true');
select atteso('chi non è entrato (anon) non prepara', has_function_privilege('anon', 'satispay_prepara_quota(uuid)', 'execute')::text, 'false');
select atteso('…non legge lo stato', has_function_privilege('anon', 'satispay_quota_stato(uuid)', 'execute')::text, 'false');
select atteso('…e non sa chi è', has_function_privilege('anon', 'satispay_quota_chi(uuid)', 'execute')::text, 'false');
select chi('');
set role anon;
select atteso('anon chiamandola prende «non hai il permesso»', codice($$select satispay_prepara_quota(pid(6))$$), '42501');
reset role;

\echo ''
\echo '--- 3. l''iscritto paga la quota intera, e solo quella ---'
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('Bruno, da pagare, prepara la quota: l''importo è quello del listino (50 €)', riga($$select satispay_prepara_quota(pid(6))->>'importo'$$), '5000');
select atteso('…in attesa', riga($$select satispay_prepara_quota(pid(6))->>'stato'$$), 'attesa');
reset role;
select atteso('…e c''è un pagamento solo, della quota, in attesa e non ancora in una ricevuta',
  (select count(*)::text || ' ' || min(stato) || ' ' || min(importo) || ' ' || bool_and(persona_id = pid(6) and voce = 'quota' and saldo_di is null and ricevuta_id is null)::text
     from pagamenti_satispay where persona_id = pid(6)), '1 attesa 5000 true');
select id::text as spid, set_config('prova.spid', id::text, false) from pagamenti_satispay where persona_id = pid(6) \gset
set role authenticated;
select atteso('un secondo tocco ridà lo stesso pagamento', riga($$select satispay_prepara_quota(pid(6))->>'id'$$), :'spid');
reset role;
select atteso('…e non ne fa un secondo', (select count(*)::text from pagamenti_satispay where persona_id = pid(6)), '1');
select atteso('il database non lascia due pagamenti vivi della quota per la stessa persona',
  tenta($$insert into pagamenti_satispay (chi, importo, stato, persona_id, voce) values ('Solo Bruno', 5000, 'attesa', pid(6), 'quota')$$), 'NEGATO: …');

-- Il listino cambia mentre il pagamento aspetta: l'importo in attesa non è più quello della quota.
update impostazioni set listino = '{"quota": 60}' where id;
update pagamenti_satispay set satispay_id = 'sp-prova-bruno' where persona_id = pid(6) and stato = 'attesa';
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('con l''importo cambiato Satispay non offre PAGA: l''importo è null', riga($$select (satispay_quota_chi(pid(6))->'importo' = 'null'::jsonb)::text$$), 'true');
select atteso('in attesa (già da Satispay) ma l''importo non è più quello del listino: si rifiuta', riga($$select satispay_prepara_quota(pid(6))$$), 'NEGATO: L’importo è cambiato: chiedi alla segreteria prima di pagare');
select atteso('…col codice di un rifiuto, non di un permesso', codice($$select satispay_prepara_quota(pid(6))$$), '22023');
reset role;
-- Senza `satispay_id` Satispay non l'ha mai visto: non si blocca la persona, lo si chiude e se ne fa uno al nuovo importo.
update pagamenti_satispay set satispay_id = null where persona_id = pid(6) and stato = 'attesa';
set role authenticated;
select atteso('in attesa ma mai arrivato a Satispay e con l''importo cambiato: ne nasce uno nuovo', riga($$select satispay_prepara_quota(pid(6))->>'importo'$$), '6000');
reset role;
select atteso('…e il vecchio è chiuso, non resta in attesa', (select string_agg(stato || importo, ',' order by importo) from pagamenti_satispay where persona_id = pid(6)), 'non-andato5000,attesa6000');
-- Si rimette com'era per i casi che seguono.
delete from pagamenti_satispay where persona_id = pid(6) and importo = 6000;
update pagamenti_satispay set stato = 'attesa' where persona_id = pid(6);
update impostazioni set listino = '{"quota": 50}' where id;

\echo ''
\echo '--- 4. non andato, pagato ---'
-- La Edge Function scrive lo stato dopo aver riletto Satispay: qui lo fa chi prova.
update pagamenti_satispay set stato = 'non-andato' where persona_id = pid(6);
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('un pagamento non andato si riprova: ne nasce un altro', riga($$select (satispay_prepara_quota(pid(6))->>'id' <> current_setting('prova.spid'))::text$$), 'true');
reset role;
select atteso('…e quello vecchio resta com''è', (select count(*)::text from pagamenti_satispay where persona_id = pid(6) and stato = 'non-andato'), '1');
update pagamenti_satispay set stato = 'pagato', pagato_il = now() where persona_id = pid(6) and stato = 'attesa';
set role authenticated;
select atteso('pagato e non ancora in ricevuta: non si paga due volte', riga($$select satispay_prepara_quota(pid(6))$$), 'NEGATO: Hai già pagato con Satispay: la segreteria prepara la ricevuta');
select atteso('…col codice di un rifiuto', codice($$select satispay_prepara_quota(pid(6))$$), '22023');
reset role;

\echo ''
\echo '--- 5. quando la quota non si paga online ---'
-- Mino ha già pagato la quota con Satispay (scritto qui perché serve la colonna `voce`).
insert into pagamenti_satispay (chi, importo, stato, persona_id, voce, pagato_il) values ('Fam Mino', 5000, 'pagato', pid(18), 'quota', now());
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('una quota pagata tutta, con la ricevuta: no', riga($$select satispay_prepara_quota(pid(10))$$), 'NEGATO: La quota associativa ha già una ricevuta: per quel che manca c’è il saldo');
select atteso('una quota pagata in parte: no, per il resto c''è il saldo', riga($$select satispay_prepara_quota(pid(11))$$), 'NEGATO: La quota associativa ha già una ricevuta: per quel che manca c’è il saldo');
select atteso('pagato fuori app, oggi valido: no', riga($$select satispay_prepara_quota(pid(12))$$), 'NEGATO: La quota risulta già pagata fuori dall’app: chiedi alla segreteria');
select atteso('…anche «in parte» fuori app, oggi valido: no', riga($$select satispay_prepara_quota(pid(13))$$), 'NEGATO: La quota risulta già pagata fuori dall’app: chiedi alla segreteria');
select atteso('un Satispay dell''iscrizione già arrivato e non in ricevuta: no', riga($$select satispay_prepara_quota(pid(16))$$), 'NEGATO: Hai già pagato con Satispay: la segreteria prepara la ricevuta');
select atteso('…uno del saldo: no', riga($$select satispay_prepara_quota(pid(17))$$), 'NEGATO: Hai già pagato con Satispay: la segreteria prepara la ricevuta');
select atteso('…uno della quota: no', riga($$select satispay_prepara_quota(pid(18))$$), 'NEGATO: Hai già pagato con Satispay: la segreteria prepara la ricevuta');
select atteso('tutti questi sono rifiuti di quelli che si correggono (22023)',
  codice($$select satispay_prepara_quota(pid(10))$$) || codice($$select satispay_prepara_quota(pid(12))$$) || codice($$select satispay_prepara_quota(pid(16))$$), '220232202322023');
reset role;

update impostazioni set listino = '{"corsi": []}' where id;
set role authenticated;
select atteso('il listino non ha la quota: no', riga($$select satispay_prepara_quota(pid(14))$$), 'NEGATO: La quota non è nel listino: chiedi alla segreteria');
select atteso('…col codice di un rifiuto', codice($$select satispay_prepara_quota(pid(14))$$), '22023');
reset role;
update impostazioni set listino = null where id;
set role authenticated;
select atteso('…senza listino nemmeno', codice($$select satispay_prepara_quota(pid(14))$$), '22023');
reset role;
update impostazioni set listino = '{"quota": 50}' where id;

\echo ''
\echo '--- 6. quando invece si paga ---'
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('un adulto senza accesso suo, scaduto fuori app: Luca per Ugo', riga($$select satispay_prepara_quota(pid(14))->>'importo'$$), '5000');
select atteso('una ricevuta annullata non conta: Luca per Vera', riga($$select satispay_prepara_quota(pid(19))->>'importo'$$), '5000');
select atteso('un minorenne lo paga il titolare: Luca per Teo', riga($$select satispay_prepara_quota(pid(5))->>'importo'$$), '5000');
reset role;
-- La quota di una ricevuta finita da dieci giorni è un rinnovo: si paga, e l'importo è sempre quello del listino.
update impostazioni set listino = '{"quota": 42.5}' where id;
set role authenticated;
select atteso('Sara, con la ricevuta finita: l''importo è quello del listino adesso (42,50 €), non quello della ricevuta', riga($$select satispay_prepara_quota(pid(15))->>'importo'$$), '4250');
reset role;
update impostazioni set listino = '{"quota": 50}' where id;
delete from pagamenti_satispay where persona_id = pid(15);
select atteso('i pagamenti di prima sono tutti della quota, in attesa, e non in una ricevuta',
  (select string_agg(p.nome, ',' order by p.nome) from pagamenti_satispay s join persone p on p.id = s.persona_id
    where s.voce = 'quota' and s.stato = 'attesa' and s.ricevuta_id is null), 'Teo,Ugo,Vera');

\echo ''
\echo '--- 7. cosa non si può pagare ---'
select count(*)::text as prima from pagamenti_satispay \gset
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('la persona di un altro: Bruno per Luca', codice($$select satispay_prepara_quota(pid(3))$$), '42501');
select atteso('…Bruno per Teo, che è di un nucleo non suo', codice($$select satispay_prepara_quota(pid(5))$$), '42501');
select atteso('una persona che non c''è', codice($$select satispay_prepara_quota(gen_random_uuid())$$), '42501');
select atteso('…né il nulla', codice($$select satispay_prepara_quota(null)$$), '42501');
reset role;
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('un account senza persona non paga per nessuno', codice($$select satispay_prepara_quota(pid(6))$$), '42501');
reset role;
select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('Maria, con l''account suo, paga per sé (ha una ricevuta in parte: no, 22023, ma non è un permesso)', codice($$select satispay_prepara_quota(pid(4))$$), '22023');
select atteso('…non per Teo: non è il titolare', codice($$select satispay_prepara_quota(pid(5))$$), '42501');
reset role;
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('un familiare con l''accesso suo no: Luca per Maria', codice($$select satispay_prepara_quota(pid(4))$$), '42501');
select atteso('…nemmeno una minorenne con l''accesso suo: Luca per Gaia', codice($$select satispay_prepara_quota(pid(9))$$), '42501');
reset role;
select chi('99999999-9999-9999-9999-999999999999');
set role authenticated;
select atteso('Gaia, minorenne, da sé non paga: serve il titolare', codice($$select satispay_prepara_quota(pid(9))$$), '42501');
reset role;
select atteso('i rifiuti non hanno scritto niente', (select count(*)::text from pagamenti_satispay), :'prima');

\echo ''
\echo '--- 8. nessuno legge i pagamenti, e lo stato si legge con la funzione ---'
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('l''iscritto non legge pagamenti_satispay (anche se c''è il suo)', riga($$select count(*)::text from pagamenti_satispay$$), '0');
select atteso('…né ci scrive', tenta($$update pagamenti_satispay set stato = 'pagato'$$), 'NEGATO: …');
select atteso('…né ci inserisce', tenta($$insert into pagamenti_satispay (chi, importo, stato, persona_id, voce) values ('Luca Fam', 1, 'pagato', null, 'quota')$$), 'NEGATO: …');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria li legge, come sempre', riga($$select (count(*) > 0)::text from pagamenti_satispay$$), 'true');
reset role;

-- Prima: Luca non ha pagato per Olga (mai partito), per Nilde c'è solo un saldo e un'iscrizione. Teo è in attesa.
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('mai partito: niente', riga($$select satispay_quota_stato(pid(10))::text$$), 'niente');
select atteso('un saldo e un''iscrizione non sono lo stato della quota: niente', riga($$select satispay_quota_stato(pid(8))::text$$), 'niente');
select atteso('Teo in attesa: stato e importo', riga($$select (s->>'stato') || ' ' || (s->>'importo') from satispay_quota_stato(pid(5)) s$$), 'attesa 5000');
reset role;
update pagamenti_satispay set stato = 'pagato', pagato_il = now() where persona_id = pid(5);
insert into pagamenti_satispay (chi, importo, stato, persona_id, voce, pagato_il) values ('Fam Gaia', 5000, 'pagato', pid(9), 'quota', now());
set role authenticated;
select atteso('Teo dopo l''arrivo: pagato, per 5000', riga($$select (s->>'stato') || ' ' || (s->>'importo') from satispay_quota_stato(pid(5)) s$$), 'pagato 5000');
select atteso('…con il quando', riga($$select (satispay_quota_stato(pid(5))->>'pagato_il' is not null)::text$$), 'true');
select atteso('…e il nome intero, perché è il titolare', riga($$select (satispay_quota_stato(pid(5))->>'chi' like '%Teo%' and satispay_quota_stato(pid(5))->>'chi' like '%Fam%')::text$$), 'true');
select atteso('Luca non vede quello di Gaia, che ha l''accesso suo', riga($$select satispay_quota_stato(pid(9))::text$$), 'niente');
select atteso('Luca non vede quello di Bruno', riga($$select satispay_quota_stato(pid(6))::text$$), 'niente');
reset role;
select chi('99999999-9999-9999-9999-999999999999');
set role authenticated;
select atteso('Gaia vede lo stato del suo, ma senza il cognome: non è il titolare', riga($$select (satispay_quota_stato(pid(9))->>'chi' like '%Gaia%' and satispay_quota_stato(pid(9))->>'chi' not like '%Fam%')::text$$), 'true');
reset role;
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('Bruno vede il suo: pagato', riga($$select satispay_quota_stato(pid(6))->>'stato'$$), 'pagato');
select atteso('…e non quello di Teo', riga($$select satispay_quota_stato(pid(5))::text$$), 'niente');
reset role;
select chi('');
set role anon;
select atteso('anon non legge lo stato', codice($$select satispay_quota_stato(pid(5))$$), '42501');
reset role;

\echo ''
\echo '--- 9. chi è la persona, per chi paga, e quanto ---'
-- Serve a mostrare PAGA, non a decidere: decide `satispay_prepara_quota`. L'importo c'è solo se la quota si paga adesso.
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('Luca vede com''è Ugo: senza accesso, del nucleo', riga($$select (c->>'accesso_proprio') || ' ' || (c->>'come_titolare') || ' ' || (c->>'adulto') from satispay_quota_chi(pid(14)) c$$), 'false true true');
select atteso('…e la quota si paga: 50 €', riga($$select satispay_quota_chi(pid(14))->>'importo'$$), '5000');
select atteso('Teo ha già pagato: niente da pagare, l''importo non c''è', riga($$select (satispay_quota_chi(pid(5))->'importo' = 'null'::jsonb)::text$$), 'true');
select atteso('…ha 9 anni: non è adulto', riga($$select satispay_quota_chi(pid(5))->>'adulto'$$), 'false');
select atteso('Olga ha la quota con la ricevuta: importo null', riga($$select (satispay_quota_chi(pid(10))->'importo' = 'null'::jsonb)::text$$), 'true');
select atteso('Remo è pagato fuori app: importo null', riga($$select (satispay_quota_chi(pid(12))->'importo' = 'null'::jsonb)::text$$), 'true');
select atteso('Gino ha già un Satispay arrivato: importo null', riga($$select (satispay_quota_chi(pid(16))->'importo' = 'null'::jsonb)::text$$), 'true');
select atteso('Vera, con la ricevuta annullata, si può: 50 €', riga($$select satispay_quota_chi(pid(19))->>'importo'$$), '5000');
select atteso('Maria ha l''accesso suo: Luca non la vede, niente tasto', riga($$select satispay_quota_chi(pid(4))::text$$), 'niente');
select atteso('Luca non vede com''è Gaia', riga($$select satispay_quota_chi(pid(9))::text$$), 'niente');
select atteso('una persona che non c''è: niente', riga($$select satispay_quota_chi(gen_random_uuid())::text$$), 'niente');
reset role;
update impostazioni set listino = '{}' where id;
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('senza la quota nel listino: importo null', riga($$select (satispay_quota_chi(pid(14))->'importo' = 'null'::jsonb)::text$$), 'true');
reset role;
update impostazioni set listino = '{"quota": 50}' where id;
select chi('99999999-9999-9999-9999-999999999999');
set role authenticated;
select atteso('Gaia, di sé: minorenne', riga($$select satispay_quota_chi(pid(9))->>'adulto'$$), 'false');
reset role;
select chi('');
set role anon;
select atteso('anon non sa chi è nessuno', codice($$select satispay_quota_chi(pid(5))$$), '42501');
reset role;

\echo ''
\echo '--- 9b. una quota pagata con Satispay e già in ricevuta non è più «pagata»: alla scadenza si rinnova ---'
-- Mino ha pagato con Satispay e la segreteria ne ha fatto la ricevuta (qui una qualunque del nucleo): è storia, non uno stato.
update pagamenti_satispay set ricevuta_id = (select id from ricevute where persona_id = pid(10) limit 1) where persona_id = pid(18) and voce = 'quota';
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('una quota già in ricevuta non è lo stato della quota: niente', riga($$select satispay_quota_stato(pid(18))::text$$), 'niente');
reset role;

\echo ''
\echo '--- 10. rilanciare il file non cambia niente ---'
select count(*)::text as dopo_conta from pagamenti_satispay \gset
\ir ../105-paga-quota-satispay.sql
select atteso('dopo il rilancio i pagamenti sono gli stessi', (select count(*)::text from pagamenti_satispay), :'dopo_conta');
