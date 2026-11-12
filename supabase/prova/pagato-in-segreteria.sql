-- I soldi che la segreteria ha già (146-pagato-in-segreteria.sql): un bonifico assegnato alla quota o a un corso, o
-- un pagamento registrato a mano, finché non diventa ricevuta sta in `pagamenti_diretti`. La segreteria lo conta già
-- come pagato (`conAssegnazioni`, src/lib/assegna.ts); qui si prova che anche l'area iscritti e i pagamenti online lo
-- contano, con la stessa stagione (`stagione_quota`, 136): niente più «da pagare» e niente PAGA a chi ha già pagato.
-- La metà di prova: scripts/prova-pagato-in-segreteria.mjs.
-- Si lancia dopo finto-supabase.sql e i file dello schema (il 146 compreso).
--
-- Cosa si assume del 146:
--   · una riga attiva di `pagamenti_diretti` (non annullata) sulla quota di questa stagione (dal nome «…2026/27», se
--     no dalla data, dal 1° agosto) ferma `quota_importo` con «La quota risulta già pagata in segreteria: per quel che
--     manca chiedi alla segreteria» (22023), e `satispay_quota_chi` dà importo null;
--   · la stessa, su una quota pagata in parte con ricevuta, toglie da quel che manca in `saldo_mancano`;
--   · `iscritto_scheda` ha in `quote` una quota in più, numero 0, con quel che manca dopo ricevute e righe;
--   · una riga attiva sull'annuale, il trimestre o il saldo di un corso, di questa stagione, ferma `corso_importo` con
--     «Il corso risulta già pagato in segreteria: per quel che manca chiedi alla segreteria» (22023), e
--     `satispay_corsi_chi` dà per quel corso `assegnato: true` e nessun importo;
--   · le righe annullate (diventate ricevuta, o tolte) e quelle di una stagione passata non contano.
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
-- Una riga di `pagamenti_diretti`: un bonifico assegnato o un pagamento a mano, per il database sono la stessa cosa.
create or replace function pd(persona uuid, voce text, importo int, giorno date default current_date - 3, annullata boolean default false)
  returns void language sql as $$
  insert into pagamenti_diretti (persona_id, data, importo, metodo, voce, annullato_il)
  values (persona, giorno, importo, 'Bonifico', voce, case when annullata then now() end)
$$;
-- La stagione di oggi, come l'anno in cui comincia.
create or replace function st() returns int language sql stable as $$ select stagione_quota('', current_date) $$;

-- --- chi c'è ----------------------------------------------------------------
insert into auth.users (id, email, email_confirmed_at) values ('33333333-3333-3333-3333-333333333333', 'luca@fam.it', now());
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  (pid(3), 'Luca', 'Fam', 'iscritto', 'luca@fam.it', '33333333-3333-3333-3333-333333333333');
-- Il nucleo di Luca, tutti adulti senza account suo: paga Luca.
insert into persone (id, nome, cognome, ruolo, nucleo) values
  (pid(21), 'Ada', 'Fam', 'iscritto', pid(3)), (pid(22), 'Bea', 'Fam', 'iscritto', pid(3)),
  (pid(23), 'Cico', 'Fam', 'iscritto', pid(3)), (pid(24), 'Dina', 'Fam', 'iscritto', pid(3)),
  (pid(25), 'Ezio', 'Fam', 'iscritto', pid(3)), (pid(26), 'Fede', 'Fam', 'iscritto', pid(3)),
  (pid(27), 'Gil', 'Fam', 'iscritto', pid(3)), (pid(28), 'Ines', 'Fam', 'iscritto', pid(3));
insert into anagrafiche (persona_id, nato_il) select pid(n), current_date - interval '40 years' from unnest(array[3,21,22,23,24,25,26,27,28]) n;
insert into corsi (id, nome) values (cid(1), 'Judo');
update impostazioni set listino = jsonb_build_object('quota', 50, 'saldoEntro', (current_date + 30)::text, 'corsi', jsonb_build_array(
  jsonb_build_object('corsoId', cid(1), 'corso', 'Judo', 'prezzi', jsonb_build_array(jsonb_build_object('annuale', 300, 'trimestre', 120))))) where id;
insert into iscrizioni (corso_id, persona_id, dal) select cid(1), pid(n), current_date - 100 from unnest(array[21,22,23,24,25,26,27,28]) n;

-- Ada: la quota tutta da un bonifico assegnato. Bea: metà. Cico: la quota della stagione passata, scritta nel nome.
-- Ezio: un bonifico tolto (annullato). Ines: niente, per vedere che il resto va come prima.
select pd(pid(21), 'Quota associativa ' || st() || '/' || lpad(((st() + 1) % 100)::text, 2, '0'), 5000);
select pd(pid(22), 'QUOTA ASSOCIATIVA', 2000);
select pd(pid(23), 'Quota associativa ' || (st() - 1) || '/' || lpad((st() % 100)::text, 2, '0'), 5000);
select pd(pid(25), 'QUOTA ASSOCIATIVA', 5000, annullata => true);
-- Dina: una ricevuta con la quota pagata 20 € su 50, poi un bonifico di 10 € assegnato al saldo.
insert into ricevute (id, anno, numero, data, persona_id, ente, intestatario, voci, totale, pagato, anticipo)
values ('f1f1f1f1-0000-0000-0000-000000000024', 2026, 924, current_date - 10, pid(24), '{"nome":"ODS"}', '{"nome":"X","cognome":"Y"}',
  jsonb_build_array(jsonb_build_object('descrizione', 'QUOTA ASSOCIATIVA', 'quantita', 1, 'prezzo', 5000, 'dal', (current_date - 10)::text, 'al', (current_date + 200)::text,
    'pagamenti', jsonb_build_array(jsonb_build_object('data', (current_date - 10)::text, 'importo', 2000, 'metodo', 'Contanti')))), 5000, 2000, 0);
select pd(pid(24), 'QUOTA ASSOCIATIVA', 1000);
-- Fede: l'annuale di Judo da un bonifico, in parte. Gil: l'annuale di Judo di più di un anno fa.
select pd(pid(26), 'Annuale Judo', 10000);
select pd(pid(27), 'ANNUALE JUDO', 30000, current_date - 400);

\echo ''
\echo '--- 1. la quota pagata in segreteria non si paga di nuovo online ---'
select atteso('Ada, quota tutta da un bonifico: non si paga online', riga($$select quota_importo(pid(21))::text$$),
  'NEGATO: La quota risulta già pagata in segreteria: per quel che manca chiedi alla segreteria');
select atteso('Bea, metà da un bonifico: il resto lo fa la segreteria', riga($$select quota_importo(pid(22))::text$$),
  'NEGATO: La quota risulta già pagata in segreteria: per quel che manca chiedi alla segreteria');
select atteso('Cico, il bonifico è della stagione passata: la quota di adesso si paga', riga($$select quota_importo(pid(23))::text$$), '5000');
select atteso('Ezio, il bonifico è stato tolto: la quota si paga', riga($$select quota_importo(pid(25))::text$$), '5000');
select atteso('Ines, niente: la quota si paga', riga($$select quota_importo(pid(28))::text$$), '5000');
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('Luca non vede PAGA LA QUOTA per Ada', riga($$select coalesce(satispay_quota_chi(pid(21))->>'importo', 'null')$$), 'null');
select atteso('…e se ci prova, no', riga($$select satispay_prepara_quota(pid(21))->>'importo'$$),
  'NEGATO: La quota risulta già pagata in segreteria: per quel che manca chiedi alla segreteria');
select atteso('…per Ines sì', riga($$select satispay_quota_chi(pid(28))->>'importo'$$), '5000');
reset role;

\echo ''
\echo '--- 2. il saldo toglie quel che è già arrivato in segreteria ---'
select atteso('Dina: 50 € di quota, 20 € in ricevuta, 10 € da un bonifico: mancano 20 €',
  riga($$select saldo_mancano(pid(24), 'f1f1f1f1-0000-0000-0000-000000000024')::text$$), '2000');

\echo ''
\echo '--- 3. la scheda dell''iscritto dice com''è la quota ---'
select (st() + 1) || '-07-31' as fine_stagione \gset
set role authenticated;
select atteso('Ada: una quota senza ricevuta (numero 0), pagata',
  riga($$select string_agg(q->>'numero' || ':' || (q->>'mancano'), ',') from iscritto_scheda(pid(21)) s, jsonb_array_elements(s.quote) q$$), '0:0');
select atteso('…di questa stagione, fino al 31 luglio',
  riga($$select q->>'al' from iscritto_scheda(pid(21)) s, jsonb_array_elements(s.quote) q$$), :'fine_stagione');
select atteso('Bea: mancano 30 €',
  riga($$select string_agg(q->>'numero' || ':' || (q->>'mancano'), ',') from iscritto_scheda(pid(22)) s, jsonb_array_elements(s.quote) q$$), '0:3000');
select atteso('Dina: la ricevuta dice 30 €, col bonifico ne mancano 20',
  riga($$select string_agg(q->>'numero' || ':' || (q->>'mancano'), ',' order by (q->>'numero')::int desc) from iscritto_scheda(pid(24)) s, jsonb_array_elements(s.quote) q$$), '924:3000,0:2000');
select atteso('Cico: la stagione passata non fa una quota di adesso',
  riga($$select jsonb_array_length(s.quote)::text from iscritto_scheda(pid(23)) s$$), '0');
select atteso('Ezio: il bonifico tolto non conta',
  riga($$select jsonb_array_length(s.quote)::text from iscritto_scheda(pid(25)) s$$), '0');
reset role;

\echo ''
\echo '--- 4. il corso pagato in segreteria non si paga di nuovo online ---'
select atteso('Fede, Judo in parte da un bonifico: l''annuale non si paga online', riga($$select corso_importo(pid(26), cid(1), 'annuale')::text$$),
  'NEGATO: Il corso risulta già pagato in segreteria: per quel che manca chiedi alla segreteria');
select atteso('…né il trimestre', riga($$select corso_importo(pid(26), cid(1), 'trimestre')::text$$),
  'NEGATO: Il corso risulta già pagato in segreteria: per quel che manca chiedi alla segreteria');
select atteso('Gil, il bonifico è di più di un anno fa: si paga', riga($$select corso_importo(pid(27), cid(1), 'annuale')::text$$), '30000');
select atteso('Ines, niente: si paga', riga($$select corso_importo(pid(28), cid(1), 'annuale')::text$$), '30000');
set role authenticated;
select atteso('Luca vede Judo di Fede assegnato, senza importi',
  riga($$select (c->>'assegnato') || ' ' || coalesce(c->>'annuale', 'null') || ' ' || coalesce(c->>'trimestre', 'null') from satispay_corsi_chi(pid(26)) x, jsonb_array_elements(x->'corsi') c$$),
  'true null null');
select atteso('…e se ci prova, no', riga($$select satispay_prepara_corso(pid(26), cid(1), 'annuale')->>'importo'$$),
  'NEGATO: Il corso risulta già pagato in segreteria: per quel che manca chiedi alla segreteria');
select atteso('Gil: non assegnato, e si paga',
  riga($$select (c->>'assegnato') || ' ' || (c->>'annuale') from satispay_corsi_chi(pid(27)) x, jsonb_array_elements(x->'corsi') c$$), 'false 30000');
reset role;

\echo ''
\echo '--- 5. chi può cosa: come prima ---'
select atteso('l''iscritto non legge pagamenti_diretti', has_table_privilege('authenticated', 'pagamenti_diretti', 'select')::text || ' ' ||
  (select count(*)::text from pg_policies where tablename = 'pagamenti_diretti' and qual ilike '%e_staff%'), 'true 1');
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('…e con la select non ne vede nessuna', riga($$select count(*)::text from pagamenti_diretti$$), '0');
reset role;
select atteso('anon non legge la scheda', has_function_privilege('anon', 'iscritto_scheda(uuid)', 'execute')::text, 'false');
select atteso('i conti interni non si chiamano da fuori',
  has_function_privilege('authenticated', 'quota_importo(uuid)', 'execute')::text || ' ' ||
  has_function_privilege('authenticated', 'corso_importo(uuid,uuid,text)', 'execute')::text || ' ' ||
  has_function_privilege('authenticated', 'saldo_mancano(uuid,uuid)', 'execute')::text, 'false false false');

\echo ''
\echo 'TUTTO A POSTO'
