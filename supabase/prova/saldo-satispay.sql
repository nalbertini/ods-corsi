-- Il saldo della quota associativa con Satispay (103-saldo-satispay.sql): l'iscritto,
-- o il titolare del nucleo per chi non ha un accesso suo, paga solo quello che manca
-- di una ricevuta con la QUOTA ASSOCIATIVA che vale oggi. L'importo lo calcola il
-- database (mai il telefono), un pagamento solo in attesa per persona e ricevuta,
-- e l'iscritto non legge `pagamenti_satispay`: quello che gli serve lo dà
-- `satispay_saldo_stato`. Il riferimento che si legge in Satispay non ha nomi: lo
-- codifica la Edge Function, non si prova qui.
-- La metà di prova: scripts/prova-saldo-satispay.mjs, stessi casi e stessi messaggi.
-- Si lancia dopo finto-supabase.sql e i file dello schema (il 103 compreso).
--
-- Cosa si assume del 103, da confermare quando c'è:
--   · `satispay_prepara_saldo(persona, ricevuta)` risponde {stato:'attesa', id, importo} e scrive la riga in
--     attesa (senza `satispay_id`: lo mette la Edge Function);
--   · `satispay_saldo_stato(persona, ricevuta)` risponde {stato, importo, pagato_il, chi} dell'ultimo
--     pagamento, o NULL se non c'è (e per una persona che chi chiama non può vedere, come `iscritto_*`);
--   · chi non può vedere la persona prende 42501, tutto il resto (ricevuta, importo) 22023.
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
-- Le ricevute per numero. Una quota di 50 € di cui `pagato` centesimi sono già dati; rilanciarla la riscrive.
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
-- Il nucleo di Luca: Maria (adulta, con l'account suo), Teo (9 anni) e Nilde (adulta) senza account, Gaia (14 anni) con l'account suo.
insert into persone (id, nome, cognome, ruolo, email, utente_id, nucleo) values
  (pid(4), 'Maria', 'Fam', 'iscritto', 'maria@fam.it', '44444444-4444-4444-4444-444444444444', pid(3)),
  (pid(5), 'Teo', 'Fam', 'iscritto', null, null, pid(3)),
  (pid(8), 'Nilde', 'Fam', 'iscritto', null, null, pid(3)),
  (pid(9), 'Gaia', 'Fam', 'iscritto', 'gaia@fam.it', '99999999-9999-9999-9999-999999999999', pid(3));
insert into anagrafiche (persona_id, nato_il) values
  (pid(4), current_date - interval '40 years'), (pid(5), current_date - interval '9 years'),
  (pid(8), current_date - interval '70 years'), (pid(9), current_date - interval '14 years');

-- Le quote: A Bruno ne mancano 30 €, B a Teo 50 €, C a Nilde 20 €, E a Maria 40 € (la D è annullata),
-- F a Luca è finita da dieci giorni, G non è una quota, H è pagata tutta, I a Gaia ne mancano 50 €.
select rv(1, pid(6), 2000), rv(2, pid(5), 0), rv(3, pid(8), 3000), rv(4, pid(4), 0, annullata => true), rv(5, pid(4), 1000),
       rv(6, pid(3), 4000, dal => current_date - 400, al => current_date - 10), rv(7, pid(3), 0, 'Altro'), rv(8, pid(3), 5000), rv(9, pid(9), 0);

\echo ''
\echo '--- 1. cosa c''è nel database ---'
select atteso('la colonna saldo_di c''è', (select count(*)::text from information_schema.columns where table_name = 'pagamenti_satispay' and column_name = 'saldo_di'), '1');
select atteso('…e se la ricevuta sparisce il pagamento resta (on delete set null)',
  (select c.confdeltype::text from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.conrelid = 'pagamenti_satispay'::regclass and c.contype = 'f' and a.attname = 'saldo_di'), 'n');
select atteso('un solo saldo vivo per persona e ricevuta: l''indice unico',
  (select count(*)::text from pg_indexes where tablename = 'pagamenti_satispay' and indexdef ilike '%unique%' and indexdef ilike '%persona_id%' and indexdef ilike '%saldo_di%'), '1');
select atteso('satispay_prepara_saldo c''è', coalesce(to_regprocedure('satispay_prepara_saldo(uuid, uuid)')::text, 'non c''è'), 'satispay_prepara_saldo(uuid,uuid)');
select atteso('satispay_saldo_stato c''è', coalesce(to_regprocedure('satispay_saldo_stato(uuid, uuid)')::text, 'non c''è'), 'satispay_saldo_stato(uuid,uuid)');

\echo ''
\echo '--- 2. chi può chiamare ---'
select atteso('chi è entrato prepara il saldo', has_function_privilege('authenticated', 'satispay_prepara_saldo(uuid, uuid)', 'execute')::text, 'true');
select atteso('…e legge lo stato', has_function_privilege('authenticated', 'satispay_saldo_stato(uuid, uuid)', 'execute')::text, 'true');
select atteso('chi non è entrato (anon) non prepara', has_function_privilege('anon', 'satispay_prepara_saldo(uuid, uuid)', 'execute')::text, 'false');
select atteso('…e non legge lo stato', has_function_privilege('anon', 'satispay_saldo_stato(uuid, uuid)', 'execute')::text, 'false');
select chi('');
set role anon;
select atteso('anon chiamandola prende «non hai il permesso»', codice($$select satispay_prepara_saldo(pid(6), rid(1))$$), '42501');
reset role;

\echo ''
\echo '--- 3. l''iscritto paga quello che manca, e solo quello ---'
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('Bruno prepara il saldo: l''importo è quello che manca (50 − 20 €)', riga($$select satispay_prepara_saldo(pid(6), rid(1))->>'importo'$$), '3000');
select atteso('…in attesa', riga($$select satispay_prepara_saldo(pid(6), rid(1))->>'stato'$$), 'attesa');
reset role;
select atteso('…e c''è un pagamento solo, della sua ricevuta, in attesa e non ancora in una ricevuta',
  (select count(*)::text || ' ' || min(stato) || ' ' || min(importo) || ' ' || bool_and(persona_id = pid(6) and saldo_di = rid(1) and ricevuta_id is null)::text
     from pagamenti_satispay), '1 attesa 3000 true');
select id::text as spid, set_config('prova.spid', id::text, false) from pagamenti_satispay where saldo_di = rid(1) \gset
set role authenticated;
select atteso('un secondo tocco ridà lo stesso pagamento', riga($$select satispay_prepara_saldo(pid(6), rid(1))->>'id'$$), :'spid');
reset role;
select atteso('…e non ne fa un secondo', (select count(*)::text from pagamenti_satispay where saldo_di = rid(1)), '1');
select atteso('il database non lascia due saldi vivi per la stessa persona e ricevuta',
  tenta($$insert into pagamenti_satispay (chi, importo, stato, persona_id, saldo_di) values ('Solo Bruno', 3000, 'attesa', pid(6), rid(1))$$), 'NEGATO: …');

-- La ricevuta cambia mentre il pagamento aspetta: l'importo in attesa non è più quello che manca.
select rv(1, pid(6), 2500);
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('in attesa ma l''importo non è più quello che manca: si rifiuta', codice($$select satispay_prepara_saldo(pid(6), rid(1))$$), '22023');
reset role;
select rv(1, pid(6), 2000);

\echo ''
\echo '--- 4. pagato, non andato ---'
-- La Edge Function scrive lo stato dopo aver riletto Satispay: qui lo fa chi prova.
update pagamenti_satispay set stato = 'non-andato' where saldo_di = rid(1);
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('un pagamento non andato si riprova: ne nasce un altro', riga($$select (satispay_prepara_saldo(pid(6), rid(1))->>'id' <> current_setting('prova.spid'))::text$$), 'true');
reset role;
select atteso('…e quello vecchio resta com''è', (select count(*)::text from pagamenti_satispay where saldo_di = rid(1) and stato = 'non-andato'), '1');
update pagamenti_satispay set stato = 'pagato', pagato_il = now() where saldo_di = rid(1) and stato = 'attesa';
set role authenticated;
select atteso('pagato e non ancora in ricevuta: non resta niente da pagare', codice($$select satispay_prepara_saldo(pid(6), rid(1))$$), '22023');
reset role;

\echo ''
\echo '--- 5. cosa non si può pagare ---'
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('la persona di un altro: Bruno per Luca', codice($$select satispay_prepara_saldo(pid(3), rid(8))$$), '42501');
select atteso('…Bruno per Teo, che è di un nucleo non suo', codice($$select satispay_prepara_saldo(pid(5), rid(2))$$), '42501');
select atteso('una ricevuta di un altro: Bruno per sé con la quota di Maria', codice($$select satispay_prepara_saldo(pid(6), rid(5))$$), '22023');
select atteso('una persona che non c''è', codice($$select satispay_prepara_saldo(gen_random_uuid(), rid(1))$$), '42501');
select atteso('…né il nulla', codice($$select satispay_prepara_saldo(null, rid(1))$$), '42501');
select atteso('una ricevuta che non c''è', codice($$select satispay_prepara_saldo(pid(6), gen_random_uuid())$$), '22023');
reset role;
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('un account senza persona non paga per nessuno', codice($$select satispay_prepara_saldo(pid(6), rid(1))$$), '42501');
reset role;
select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('Maria, con l''account suo, paga la sua', riga($$select satispay_prepara_saldo(pid(4), rid(5))->>'importo'$$), '4000');
select atteso('…ma non la quota annullata', codice($$select satispay_prepara_saldo(pid(4), rid(4))$$), '22023');
select atteso('…né per Teo: non è il titolare', codice($$select satispay_prepara_saldo(pid(5), rid(2))$$), '42501');
reset role;

select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('un minorenne lo paga il titolare: Luca per Teo, tutto quello che manca', riga($$select satispay_prepara_saldo(pid(5), rid(2))->>'importo'$$), '5000');
select atteso('un adulto senza accesso suo, lo stesso: Luca per Nilde', riga($$select satispay_prepara_saldo(pid(8), rid(3))->>'importo'$$), '2000');
select atteso('un familiare con l''accesso suo no: Luca per Maria', codice($$select satispay_prepara_saldo(pid(4), rid(5))$$), '42501');
select atteso('…nemmeno una minorenne con l''accesso suo: Luca per Gaia', codice($$select satispay_prepara_saldo(pid(9), rid(9))$$), '42501');
select atteso('una quota finita da dieci giorni è un rinnovo: no', codice($$select satispay_prepara_saldo(pid(3), rid(6))$$), '22023');
select atteso('una ricevuta senza la quota associativa: no', codice($$select satispay_prepara_saldo(pid(3), rid(7))$$), '22023');
select atteso('una quota già pagata tutta (mancano 0): no', codice($$select satispay_prepara_saldo(pid(3), rid(8))$$), '22023');
reset role;
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('Bruno non paga per Teo del nucleo di Luca', codice($$select satispay_prepara_saldo(pid(5), rid(2))$$), '42501');
reset role;
select chi('99999999-9999-9999-9999-999999999999');
set role authenticated;
select atteso('Gaia, minorenne, da sé non paga: serve il titolare', codice($$select satispay_prepara_saldo(pid(9), rid(9))$$), '42501');
reset role;
select atteso('i rifiuti non hanno scritto niente: solo Bruno, Maria, Teo e Nilde',
  (select string_agg(distinct p.nome, ',' order by p.nome) from pagamenti_satispay s join persone p on p.id = s.persona_id), 'Bruno,Maria,Nilde,Teo');

\echo ''
\echo '--- 6. nessuno legge i pagamenti, e lo stato si legge con la funzione ---'
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('l''iscritto non legge pagamenti_satispay (anche se c''è il suo)', riga($$select count(*)::text from pagamenti_satispay$$), '0');
select atteso('…né ci scrive', tenta($$update pagamenti_satispay set stato = 'pagato'$$), 'NEGATO: …');
select atteso('…né ci inserisce', tenta($$insert into pagamenti_satispay (chi, importo, stato, persona_id, saldo_di) values ('Luca Fam', 1, 'pagato', null, null)$$), 'NEGATO: …');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria li legge, come sempre', riga($$select (count(*) > 0)::text from pagamenti_satispay$$), 'true');
reset role;

-- Il saldo di Teo (in attesa, fatto da Luca) e quello di Gaia (pagato; per lei lo ha fatto il titolare).
update pagamenti_satispay set stato = 'pagato', pagato_il = now() where persona_id = pid(5);
insert into pagamenti_satispay (chi, importo, stato, persona_id, saldo_di, pagato_il) values ('Fam Gaia', 5000, 'pagato', pid(9), rid(9), now());
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('lo stato di Bruno non lo vede Luca: niente', riga($$select satispay_saldo_stato(pid(6), rid(1))::text$$), 'niente');
select atteso('Luca vede quello di Teo: stato e importo', riga($$select (s->>'stato') || ' ' || (s->>'importo') from satispay_saldo_stato(pid(5), rid(2)) s$$), 'pagato 5000');
select atteso('…con il quando', riga($$select (satispay_saldo_stato(pid(5), rid(2))->>'pagato_il' is not null)::text$$), 'true');
select atteso('…e il nome intero, perché è il titolare', riga($$select (satispay_saldo_stato(pid(5), rid(2))->>'chi' like '%Teo%' and satispay_saldo_stato(pid(5), rid(2))->>'chi' like '%Fam%')::text$$), 'true');
select atteso('Luca non vede quello di Gaia, che ha l''accesso suo', riga($$select satispay_saldo_stato(pid(9), rid(9))::text$$), 'niente');
select atteso('senza pagamenti: niente', riga($$select satispay_saldo_stato(pid(8), rid(9))::text$$), 'niente');
reset role;
select chi('99999999-9999-9999-9999-999999999999');
set role authenticated;
select atteso('Gaia vede lo stato del suo, ma senza il cognome: non è il titolare', riga($$select (satispay_saldo_stato(pid(9), rid(9))->>'chi' like '%Gaia%' and satispay_saldo_stato(pid(9), rid(9))->>'chi' not like '%Fam%')::text$$), 'true');
reset role;
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('Bruno non vede quello di Teo', riga($$select satispay_saldo_stato(pid(5), rid(2))::text$$), 'niente');
reset role;
select chi('');
set role anon;
select atteso('anon non legge lo stato', codice($$select satispay_saldo_stato(pid(5), rid(2))$$), '42501');
reset role;

-- Chi è la persona, per chi paga (serve a mostrare PAGA, non a decidere: decide `satispay_prepara_saldo`).
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('Luca vede com''è Teo: senza accesso, del nucleo', riga($$select (c->>'accesso_proprio') || ' ' || (c->>'come_titolare') from satispay_saldo_chi(pid(5)) c$$), 'false true');
select atteso('…ha 9 anni: non è adulto', riga($$select (satispay_saldo_chi(pid(5))->>'adulto')$$), 'false');
select atteso('Nilde è adulta, senza accesso suo', riga($$select (c->>'adulto') || ' ' || (c->>'accesso_proprio') from satispay_saldo_chi(pid(8)) c$$), 'true false');
select atteso('Maria è adulta e ha l''accesso suo: Luca non la vede, niente tasto', riga($$select satispay_saldo_chi(pid(4))::text$$), 'niente');
select atteso('Luca non vede com''è Gaia, che ha l''accesso suo: è di un altro nucleo', riga($$select satispay_saldo_chi(pid(9))::text$$), 'niente');
select atteso('Luca, di sé: con l''accesso, non come titolare', riga($$select (c->>'accesso_proprio') || ' ' || (c->>'come_titolare') from satispay_saldo_chi(pid(3)) c$$), 'true false');
select atteso('una persona che non c''è: niente', riga($$select satispay_saldo_chi(gen_random_uuid())::text$$), 'niente');
reset role;
select chi('99999999-9999-9999-9999-999999999999');
set role authenticated;
select atteso('Gaia, di sé: minorenne', riga($$select (satispay_saldo_chi(pid(9))->>'adulto')$$), 'false');
reset role;
select chi('');
set role anon;
select atteso('anon non sa chi è nessuno', codice($$select satispay_saldo_chi(pid(5))$$), '42501');
reset role;

\echo ''
\echo '--- 7. rilanciare il file non cambia niente ---'
\ir ../103-saldo-satispay.sql
select atteso('dopo il rilancio i pagamenti sono gli stessi', (select count(*)::text from pagamenti_satispay), '6');
