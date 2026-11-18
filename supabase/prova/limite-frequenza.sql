-- Il limite di frequenza delle Edge Function pubbliche dei pagamenti (satispay,
-- paypal): `limite_frequenza(ambito, chiave, massimo, secondi)` conta le
-- richieste in una finestra fissa, nel database, e dice se la prossima passa.
-- Lo chiama solo il server (service_role): chi ha la chiave anon non lo vede.
-- Si lancia dopo finto-supabase.sql e i file dello schema, 168-limite-frequenza.sql
-- compreso. Le prove edge che lo usano: scripts/prova-edge-limite.mjs.
\set ON_ERROR_STOP on

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
create or replace function atteso(cosa text, avuto text, voluto text) returns text language plpgsql as $$
begin
  if avuto is distinct from voluto and not (voluto like '%…' and avuto like replace(voluto, '…', '%')) then
    raise exception '% · atteso «%», avuto «%»', cosa, voluto, avuto;
  end if;
  return 'ok  ' || cosa || ' → ' || avuto;
end $$;
grant execute on function tenta(text), atteso(text, text, text), chi(text) to anon, authenticated, service_role;

-- Un ruolo qualunque, senza grant suoi: ha solo quello che spetta a «public».
do $$ begin create role nessuno nologin; exception when duplicate_object then null; end $$;
grant usage on schema public to nessuno;
grant execute on function tenta(text), atteso(text, text, text), chi(text) to nessuno;

-- Quante richieste ha contato il database per quella chiave (si legge da postgres, mai dal ruolo provato).
-- plpgsql: la tabella si guarda a ogni chiamata, non alla creazione.
create or replace function conti(a text, k text) returns text language plpgsql as $$
declare n text;
begin
  execute 'select count(*)::text from public.limite_frequenza_conti c where c.ambito = $1 and c.chiave = $2' into n using a, k;
  return n;
end $$;
grant execute on function conti(text, text) to service_role;

\echo ''
\echo '--- 0. la funzione e la tabella ci sono, chiuse come devono ---'
-- Senza questa, un «negato» sotto potrebbe voler dire «non esiste».
select atteso('la funzione c''è', coalesce(to_regprocedure('public.limite_frequenza(text, text, integer, integer)')::text, 'manca'), 'limite_frequenza(text,text,integer,integer)');
select atteso('la tabella c''è', coalesce(to_regclass('public.limite_frequenza_conti')::text, 'manca'), 'limite_frequenza_conti');
select atteso('ha la colonna di scadenza',
  (select count(*)::text from information_schema.columns where table_schema = 'public' and table_name = 'limite_frequenza_conti' and column_name = 'scade' and data_type = 'timestamp with time zone'), '1');
select atteso('la funzione gira coi permessi di chi l''ha scritta e col search_path fisso',
  (select p.prosecdef::text || ' ' || coalesce((select bool_or(c like 'search_path=%')::text from unnest(p.proconfig) c), 'false')
     from pg_proc p where p.oid = to_regprocedure('public.limite_frequenza(text, text, integer, integer)')), 'true true');
select atteso('restituisce un booleano',
  (select p.prorettype::regtype::text from pg_proc p where p.oid = to_regprocedure('public.limite_frequenza(text, text, integer, integer)')), 'boolean');

\echo ''
\echo '--- 1. con massimo 3 passano tre chiamate, la quarta no ---'
set role service_role;
select atteso('la prima passa', public.limite_frequenza('prova:a', 'k1', 3, 600)::text, 'true');
select atteso('la seconda passa', public.limite_frequenza('prova:a', 'k1', 3, 600)::text, 'true');
select atteso('la terza passa', public.limite_frequenza('prova:a', 'k1', 3, 600)::text, 'true');
select atteso('la quarta no', public.limite_frequenza('prova:a', 'k1', 3, 600)::text, 'false');
select atteso('la quinta no', public.limite_frequenza('prova:a', 'k1', 3, 600)::text, 'false');
reset role;
select atteso('una sola riga per ambito, chiave e finestra (le negate contano lo stesso)', conti('prova:a', 'k1'), '1');

\echo ''
\echo '--- 2. passata la finestra si riconta da capo ---'
-- Non si dorme: la scadenza della riga si sposta nel passato.
update public.limite_frequenza_conti set scade = now() - interval '1 second' where ambito = 'prova:a' and chiave = 'k1';
set role service_role;
select atteso('finita la finestra passa di nuovo', public.limite_frequenza('prova:a', 'k1', 3, 600)::text, 'true');
select atteso('…e ricomincia da uno', public.limite_frequenza('prova:a', 'k1', 3, 600)::text, 'true');
select atteso('…ancora una', public.limite_frequenza('prova:a', 'k1', 3, 600)::text, 'true');
select atteso('…poi di nuovo il tetto', public.limite_frequenza('prova:a', 'k1', 3, 600)::text, 'false');
reset role;
select atteso('della finestra vecchia non resta niente: una riga sola', conti('prova:a', 'k1'), '1');
select atteso('la riga nuova scade nel futuro', (select (min(c.scade) > now())::text from public.limite_frequenza_conti c where c.ambito = 'prova:a' and c.chiave = 'k1'), 'true');
select atteso('e non oltre la finestra', (select (max(c.scade) <= now() + interval '601 seconds')::text from public.limite_frequenza_conti c where c.ambito = 'prova:a' and c.chiave = 'k1'), 'true');

\echo ''
\echo '--- 3. chiavi e ambiti non si pestano i piedi ---'
set role service_role;
select atteso('un''altra chiave nello stesso ambito parte da zero', public.limite_frequenza('prova:a', 'k2', 3, 600)::text, 'true');
select atteso('lo stesso ambito con un''altra chiave: il tetto di k1 resta suo', public.limite_frequenza('prova:a', 'k1', 3, 600)::text, 'false');
select atteso('la stessa chiave in un altro ambito parte da zero', public.limite_frequenza('prova:b', 'k1', 3, 600)::text, 'true');
select atteso('…e ha il suo conto', public.limite_frequenza('prova:b', 'k1', 1, 600)::text, 'false');
select atteso('la chiave con maiuscole è un''altra chiave', public.limite_frequenza('prova:a', 'K1', 3, 600)::text, 'true');
reset role;
select atteso('ognuna ha la sua riga', (conti('prova:a', 'k1') || conti('prova:a', 'k2') || conti('prova:b', 'k1') || conti('prova:a', 'K1')), '1111');

\echo ''
\echo '--- 4. chi non è il server non la usa e non tocca la tabella ---'
select atteso('anon non esegue la funzione', has_function_privilege('anon', 'public.limite_frequenza(text, text, integer, integer)', 'execute')::text, 'false');
select atteso('authenticated non esegue la funzione', has_function_privilege('authenticated', 'public.limite_frequenza(text, text, integer, integer)', 'execute')::text, 'false');
select atteso('«public» non esegue la funzione', has_function_privilege('nessuno', 'public.limite_frequenza(text, text, integer, integer)', 'execute')::text, 'false');
select atteso('service_role esegue la funzione', has_function_privilege('service_role', 'public.limite_frequenza(text, text, integer, integer)', 'execute')::text, 'true');

set role anon;
select atteso('anon chiamandola: negato', tenta($$select public.limite_frequenza('prova:x', 'k', 3, 600)::text$$), 'NEGATO: permission denied for function limite_frequenza');
select atteso('anon non legge la tabella', tenta($$select count(*)::text from public.limite_frequenza_conti$$), 'NEGATO: permission denied for table limite_frequenza_conti');
select atteso('anon non scrive nella tabella', tenta($$insert into public.limite_frequenza_conti (ambito, chiave) values ('x', 'y')$$), 'NEGATO: permission denied for table limite_frequenza_conti');
select atteso('anon non cambia la tabella', tenta($$update public.limite_frequenza_conti set scade = now()$$), 'NEGATO: permission denied for table limite_frequenza_conti');
select atteso('anon non cancella dalla tabella', tenta($$delete from public.limite_frequenza_conti$$), 'NEGATO: permission denied for table limite_frequenza_conti');
reset role;

select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('authenticated chiamandola: negato', tenta($$select public.limite_frequenza('prova:x', 'k', 3, 600)::text$$), 'NEGATO: permission denied for function limite_frequenza');
select atteso('authenticated non legge la tabella', tenta($$select count(*)::text from public.limite_frequenza_conti$$), 'NEGATO: permission denied for table limite_frequenza_conti');
select atteso('authenticated non scrive nella tabella', tenta($$insert into public.limite_frequenza_conti (ambito, chiave) values ('x', 'y')$$), 'NEGATO: permission denied for table limite_frequenza_conti');
select atteso('authenticated non cambia la tabella', tenta($$update public.limite_frequenza_conti set scade = now()$$), 'NEGATO: permission denied for table limite_frequenza_conti');
select atteso('authenticated non cancella dalla tabella', tenta($$delete from public.limite_frequenza_conti$$), 'NEGATO: permission denied for table limite_frequenza_conti');
reset role;

set role nessuno;
select atteso('un ruolo senza grant non la chiama', tenta($$select public.limite_frequenza('prova:x', 'k', 3, 600)::text$$), 'NEGATO: permission denied for function limite_frequenza');
select atteso('…né legge la tabella', tenta($$select count(*)::text from public.limite_frequenza_conti$$), 'NEGATO: permission denied for table limite_frequenza_conti');
select atteso('…né ci scrive', tenta($$insert into public.limite_frequenza_conti (ambito, chiave) values ('x', 'y')$$), 'NEGATO: permission denied for table limite_frequenza_conti');
reset role;

select atteso('nessun privilegio sulla tabella a anon, authenticated e «public»',
  (select count(*)::text from unnest(array['anon', 'authenticated', 'nessuno']) r, unnest(array['select', 'insert', 'update', 'delete']) p
    where has_table_privilege(r, 'public.limite_frequenza_conti', p)), '0');

set role service_role;
select atteso('service_role la chiama', tenta($$select public.limite_frequenza('prova:s', 'k', 3, 600)::text$$), 'true');
reset role;

\echo ''
\echo '--- 5. RLS accesa, nessuna policy ---'
select atteso('RLS accesa sulla tabella', (select relrowsecurity::text from pg_class where oid = 'public.limite_frequenza_conti'::regclass), 'true');
select atteso('zero policy', (select count(*)::text from pg_policies where schemaname = 'public' and tablename = 'limite_frequenza_conti'), '0');

\echo ''
\echo '--- 6. le righe scadute spariscono a una chiamata, le correnti restano ---'
set role service_role;
select atteso('semina vecchia', public.limite_frequenza('prova:v', 'vecchia', 5, 600)::text, 'true');
select atteso('semina corrente', public.limite_frequenza('prova:v', 'corrente', 5, 600)::text, 'true');
select atteso('semina un''altra vecchia, di un altro ambito', public.limite_frequenza('prova:w', 'vecchia', 5, 60)::text, 'true');
reset role;
update public.limite_frequenza_conti set scade = now() - interval '1 hour' where chiave = 'vecchia';
select atteso('prima della chiamata le vecchie ci sono ancora', conti('prova:v', 'vecchia') || conti('prova:w', 'vecchia'), '11');
set role service_role;
select atteso('una chiamata qualunque (anche per un''altra chiave)', public.limite_frequenza('prova:v', 'altra', 5, 600)::text, 'true');
reset role;
select atteso('le scadute sono sparite, in ogni ambito', conti('prova:v', 'vecchia') || conti('prova:w', 'vecchia'), '00');
select atteso('la corrente c''è ancora', conti('prova:v', 'corrente'), '1');
select atteso('nessuna riga scaduta in tutta la tabella', (select count(*)::text from public.limite_frequenza_conti where scade <= now()), '0');

\echo ''
\echo '--- 7. parametri che non hanno senso: nessun errore, la richiesta passa ---'
set role service_role;
select atteso('massimo 0', tenta($$select public.limite_frequenza('prova:n', 'k', 0, 600)::text$$), 'true');
select atteso('massimo negativo', tenta($$select public.limite_frequenza('prova:n', 'k', -5, 600)::text$$), 'true');
select atteso('massimo null', tenta($$select public.limite_frequenza('prova:n', 'k', null, 600)::text$$), 'true');
select atteso('secondi 0', tenta($$select public.limite_frequenza('prova:n', 'k', 3, 0)::text$$), 'true');
select atteso('secondi negativi', tenta($$select public.limite_frequenza('prova:n', 'k', 3, -10)::text$$), 'true');
select atteso('secondi null', tenta($$select public.limite_frequenza('prova:n', 'k', 3, null)::text$$), 'true');
select atteso('chiave vuota', tenta($$select public.limite_frequenza('prova:n', '', 3, 600)::text$$), 'true');
select atteso('chiave null', tenta($$select public.limite_frequenza('prova:n', null, 3, 600)::text$$), 'true');
select atteso('ambito vuoto', tenta($$select public.limite_frequenza('', 'k', 3, 600)::text$$), 'true');
select atteso('ambito null', tenta($$select public.limite_frequenza(null, 'k', 3, 600)::text$$), 'true');
-- Anche ripetute: un parametro storto non è mai un tetto.
select atteso('massimo 0 ripetuto, passa ancora', public.limite_frequenza('prova:n', 'k', 0, 600)::text, 'true');
select atteso('chiave vuota ripetuta, passa ancora', public.limite_frequenza('prova:n', '', 1, 600)::text || public.limite_frequenza('prova:n', '', 1, 600)::text, 'truetrue');
reset role;

\echo ''
\echo '--- 8. il file si rilancia ---'
-- Tutto lo schema in produzione si rilancia a ogni PR: la seconda volta non deve fallire né aprire cose.
\ir ../168-limite-frequenza.sql
\ir ../168-limite-frequenza.sql
select atteso('dopo il rilancio la funzione c''è', coalesce(to_regprocedure('public.limite_frequenza(text, text, integer, integer)')::text, 'manca'), 'limite_frequenza(text,text,integer,integer)');
select atteso('…RLS è accesa e le policy sono zero', (select relrowsecurity::text from pg_class where oid = 'public.limite_frequenza_conti'::regclass) || (select count(*)::text from pg_policies where tablename = 'limite_frequenza_conti'), 'true0');
select atteso('…anon non la esegue', has_function_privilege('anon', 'public.limite_frequenza(text, text, integer, integer)', 'execute')::text, 'false');
select atteso('…authenticated non la esegue', has_function_privilege('authenticated', 'public.limite_frequenza(text, text, integer, integer)', 'execute')::text, 'false');
select atteso('…«public» non la esegue', has_function_privilege('nessuno', 'public.limite_frequenza(text, text, integer, integer)', 'execute')::text, 'false');
select atteso('…service_role sì', has_function_privilege('service_role', 'public.limite_frequenza(text, text, integer, integer)', 'execute')::text, 'true');
select atteso('…nessun privilegio sulla tabella a anon, authenticated e «public»',
  (select count(*)::text from unnest(array['anon', 'authenticated', 'nessuno']) r, unnest(array['select', 'insert', 'update', 'delete']) p
    where has_table_privilege(r, 'public.limite_frequenza_conti', p)), '0');
set role service_role;
select atteso('…e conta ancora', (public.limite_frequenza('prova:r', 'k', 1, 600)::text || public.limite_frequenza('prova:r', 'k', 1, 600)::text), 'truefalse');
reset role;

\echo ''
\echo 'TUTTO A POSTO'
