-- Claude passa solo dalla sua porta (77-claude-dalla-porta.sql): il token che Claude riceve quando una persona lo
-- collega a ODS Corsi (OAuth Server di Supabase) porta tutti i diritti di quella persona, più il claim `client_id`.
-- Qui si prova che con quel claim:
--   · `controlla_richiesta()`, che PostgREST chiama prima di ogni richiesta, lascia passare solo le funzioni del
--     server MCP (supabase/functions/mcp), nessuna tabella (con l'embedding una tabella porta alle altre); il resto
--     (persone, anagrafiche, ricevute, movimenti, ogni altra funzione, GraphQL) è «42501»;
--   · i file dello Storage (certificati, documenti) sono chiusi, in lettura e in scrittura;
--   · i token dell'app, senza `client_id`, e chi non ha fatto l'accesso passano come prima.
-- E le letture che il server faceva sulle tabelle, ora funzioni: quelle dei conti della sola amministrazione
-- (`chat_movimenti()`, `chat_movimenti_uguali(…)`, `chat_movimento_per_chiave(chiave)`, `chat_ricevute()`,
-- `chat_pagamenti_diretti()`), con le sole colonne che servono; `chat_voci()`, `chat_casse()`, `chat_chiusure()`,
-- `chat_corsi()` con l'RLS delle loro tabelle; `chat_registra(dati)`.
-- Si lancia dopo finto-supabase.sql e i file dello schema, su un database suo.
\set ON_ERROR_STOP on
set timezone = 'UTC';

create or replace function atteso(cosa text, avuto text, voluto text) returns text language plpgsql as $$
begin
  if avuto is distinct from voluto and not (voluto like '%…' and avuto like replace(voluto, '…', '%')) then
    raise exception '% · atteso «%», avuto «%»', cosa, voluto, avuto;
  end if;
  return 'ok  ' || cosa || ' → ' || avuto;
end $$;
select (to_regprocedure('public.controlla_richiesta()') is not null
    and to_regprocedure('public.da_claude()') is not null
    and to_regprocedure('public.chat_movimenti()') is not null
    and to_regprocedure('public.chat_movimenti_uguali(text, integer, date, date)') is not null
    and to_regprocedure('public.chat_movimento_per_chiave(text)') is not null
    and to_regprocedure('public.chat_ricevute()') is not null
    and to_regprocedure('public.chat_pagamenti_diretti()') is not null)::text as c76 \gset
select atteso('77-claude-dalla-porta.sql è stato lanciato', :'c76', 'true');

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'ada@ods.it'),
  ('33333333-3333-3333-3333-333333333333', 'sandro@ods.it'),
  ('77777777-7777-7777-7777-777777777777', 'luca@ods.it');
-- Anna: segreteria. Ada: amministrazione. Sandro: segreteria e amministrazione. Luca: iscritto.
insert into persone (id, nome, cognome, ruolo, anche_istruttore, anche_amministrazione, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', false, false, 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Ada', 'Ragionieri', 'amministrazione', false, false, 'ada@ods.it', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Sandro', 'Doppio', 'staff', false, true, 'sandro@ods.it', '33333333-3333-3333-3333-333333333333'),
  ('aaaaaaaa-0000-0000-0000-000000000007', 'Luca', 'Rossi', 'iscritto', false, false, 'luca@ods.it', '77777777-7777-7777-7777-777777777777');

-- Una richiesta come la vede il database: chi (prova.utente), il token (claim), il metodo e il percorso. Poi la
-- funzione di prima della richiesta, e com'è finita: «ok» oppure «codice messaggio».
create or replace function richiesta(utente text, claim jsonb, metodo text, percorso text) returns text language plpgsql as $$
begin
  perform set_config('prova.utente', utente, false);
  perform set_config('request.jwt.claims', claim::text, false);
  perform set_config('request.method', metodo, false);
  perform set_config('request.path', percorso, false);
  begin
    execute 'set local role authenticated';
    perform controlla_richiesta();
    execute 'reset role';
    return 'ok';
  exception when others then
    return sqlstate || ' ' || sqlerrm;
  end;
end $$;
-- Come finisce un'istruzione come `authenticated`, con questi claim.
create or replace function da(utente text, claim jsonb, sql text) returns text language plpgsql as $$
declare r text;
begin
  perform set_config('prova.utente', utente, false);
  perform set_config('request.jwt.claims', claim::text, false);
  begin
    execute 'set local role authenticated';
    execute sql into r;
    execute 'reset role';
    return coalesce(r, '-');
  exception when others then
    return sqlstate || ' ' || sqlerrm;
  end;
end $$;

\set app '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}'
\set claude '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated", "client_id": "9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d"}'
\set sandro '33333333-3333-3333-3333-333333333333'
\set NO '42501 Claude non può leggere questa parte di ODS Corsi'

\echo '--- 1. prima di ogni richiesta: l''app passa come prima ---'
select atteso('l''app legge persone', richiesta(:'sandro', :'app', 'GET', 'persone'), 'ok');
select atteso('…scrive le ricevute', richiesta(:'sandro', :'app', 'POST', 'ricevute'), 'ok');
select atteso('…chiama una funzione qualunque', richiesta(:'sandro', :'app', 'POST', 'rpc/storico_persona'), 'ok');
select atteso('chi non ha fatto l''accesso (anon)', richiesta('', '{"role": "anon"}', 'GET', 'orari_sito'), 'ok');
select atteso('una richiesta senza token né percorso (non da PostgREST)', richiesta('', '{}', '', ''), 'ok');

\echo '--- 2. il token di Claude: solo la sua porta ---'
select atteso('Claude: persone no', richiesta(:'sandro', :'claude', 'GET', 'persone'), :'NO');
select atteso('…anagrafiche no', richiesta(:'sandro', :'claude', 'GET', 'anagrafiche'), :'NO');
select atteso('…ricevute no', richiesta(:'sandro', :'claude', 'GET', 'ricevute'), :'NO');
select atteso('…pagamenti_diretti no', richiesta(:'sandro', :'claude', 'GET', 'pagamenti_diretti'), :'NO');
select atteso('…movimenti no (nemmeno in lettura)', richiesta(:'sandro', :'claude', 'GET', 'movimenti'), :'NO');
select atteso('…schede_iscritti no', richiesta(:'sandro', :'claude', 'GET', 'schede_iscritti'), :'NO');
select atteso('…una funzione dell''app no', richiesta(:'sandro', :'claude', 'POST', 'rpc/storico_persona'), :'NO');
select atteso('…GraphQL no', richiesta(:'sandro', :'claude', 'POST', 'rpc/graphql'), :'NO');
select atteso('…un percorso che non c''è (non da PostgREST) no', richiesta(:'sandro', :'claude', 'GET', ''), :'NO');
select atteso('…un nome che somiglia no', richiesta(:'sandro', :'claude', 'GET', 'voci_contabili_vecchie'), :'NO');
select atteso('…un percorso con due pezzi no', richiesta(:'sandro', :'claude', 'GET', 'voci_contabili/persone'), :'NO');
select atteso('…un client_id vuoto è sempre Claude', richiesta(:'sandro', '{"sub": "33333333-3333-3333-3333-333333333333", "client_id": ""}', 'GET', 'persone'), :'NO');
select atteso('…anche senza utente', richiesta('', '{"client_id": "x"}', 'GET', 'persone'), :'NO');
select atteso('nessuna tabella, nemmeno senza persone: voci_contabili', richiesta(:'sandro', :'claude', 'GET', 'voci_contabili'), :'NO');
select atteso('…casse', richiesta(:'sandro', :'claude', 'GET', '/casse'), :'NO');
select atteso('…chiusure_cassa', richiesta(:'sandro', :'claude', 'GET', 'chiusure_cassa'), :'NO');
select atteso('…corsi (da corsi si arriva a iscrizioni e persone con ?select=)', richiesta(:'sandro', :'claude', 'GET', 'corsi'), :'NO');
select atteso('…né registra_movimento_dalla_chat (risponde con una riga di movimenti)', richiesta(:'sandro', :'claude', 'POST', 'rpc/registra_movimento_dalla_chat'), :'NO');
select atteso('le funzioni del server: ' || f, richiesta(:'sandro', :'claude', 'POST', 'rpc/' || f), 'ok')
  from unnest(array['e_amministrazione', 'e_staff', 'chat_voci', 'chat_casse', 'chat_chiusure', 'movimenti_simili', 'chat_registra',
    'chat_movimenti', 'chat_movimenti_uguali', 'chat_movimento_per_chiave', 'chat_ricevute', 'chat_pagamenti_diretti',
    'chat_corsi', 'chat_iscritti', 'chat_registro', 'chat_prove']) f;
select atteso('…e nient''altro: la porta è quell''elenco', (select array_length(porta_di_claude(), 1))::text, '16');
-- Su una tabella, o su una funzione che risponde col tipo di una sua riga, PostgREST fa l'embedding
-- (`?select=*,persone(*)`): la porta vede solo il percorso principale. Le funzioni della porta rispondono con
-- `returns table` (o un valore semplice), mai con una riga di tabella.
select atteso('nessuna funzione della porta risponde con righe di una tabella',
  (select string_agg(p.proname, ',') from pg_proc p join pg_type t on t.oid = p.prorettype
    where p.pronamespace = 'public'::regnamespace and p.proname = any (porta_di_claude()) and t.typrelid <> 0), null);
select atteso('…e ognuna c''è', (select count(distinct p.proname)::text from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = any (porta_di_claude())), '16');
select atteso('…anche chiamate in GET', richiesta(:'sandro', :'claude', 'GET', 'rpc/chat_movimenti'), 'ok');

\echo '--- 3. i file dello Storage: chiusi al token di Claude ---'
insert into storage.buckets (id, name) values ('certificati', 'certificati') on conflict do nothing;
insert into storage.objects (bucket_id, name) values ('certificati', 'aaaaaaaa-0000-0000-0000-000000000007/certificato-1.pdf');
select atteso('l''app (segreteria) vede il certificato', da(:'sandro', :'app', 'select count(*)::text from storage.objects'), '1');
select atteso('Claude no', da(:'sandro', :'claude', 'select count(*)::text from storage.objects'), '0');
select atteso('…né ne carica uno', da(:'sandro', :'claude', $$insert into storage.objects (bucket_id, name) values ('certificati', 'aaaaaaaa-0000-0000-0000-000000000007/certificato-2.pdf') returning 'scritto'$$),
  '42501 new row violates row-level security policy "claude_fuori" for table "objects"');
select atteso('…né lo cancella', da(:'sandro', :'claude', 'with x as (delete from storage.objects returning 1) select count(*)::text from x'), '0');
select atteso('il certificato c''è ancora', (select count(*)::text from storage.objects), '1');

\echo '--- 4. le letture dei conti: funzioni della sola amministrazione ---'
insert into voci_contabili (nome, tipo) values ('Utenze', 'uscita');
insert into movimenti (id, tipo, data, importo, voce_id, cassa_id, descrizione, nota, creato_da, chiave_chat, persona_id)
  select 'eeeeeeee-0000-0000-0000-000000000001', 'uscita', current_date - 3, 31240, v.id, c.id, 'Enel · bolletta', 'una nota a mano',
         'aaaaaaaa-0000-0000-0000-000000000003', 'chiave-sandro', null
    from voci_contabili v, casse c where v.tipo = 'uscita' and not v.di_sistema and c.nome = 'Conto Corrente' limit 1;
insert into movimenti (id, tipo, data, importo, voce_id, cassa_id, descrizione, creato_da, chiave_chat)
  select 'eeeeeeee-0000-0000-0000-000000000002', 'uscita', current_date - 2, 31240, v.id, c.id, 'Enel · altra', 'aaaaaaaa-0000-0000-0000-000000000002', 'chiave-ada'
    from voci_contabili v, casse c where v.tipo = 'uscita' and not v.di_sistema and c.nome = 'Conto Corrente' limit 1;
insert into movimenti (id, tipo, data, importo, voce_id, cassa_id, descrizione, creato_da, chiave_chat, annullato_il)
  select 'eeeeeeee-0000-0000-0000-000000000003', 'uscita', current_date - 1, 5000, v.id, c.id, 'Annullato', 'aaaaaaaa-0000-0000-0000-000000000003', 'chiave-annullata', now()
    from voci_contabili v, casse c where v.tipo = 'uscita' and not v.di_sistema and c.nome = 'Conto Corrente' limit 1;
insert into pagamenti_diretti (persona_id, data, importo, metodo, voce, nota)
  values ('aaaaaaaa-0000-0000-0000-000000000007', current_date - 1, 2000, 'Contanti', 'QUOTA ASSOCIATIVA', 'pagato dalla nonna');

select atteso('chat_movimenti: Sandro (amministrazione) li legge tutti', da(:'sandro', :'claude', 'select count(*)::text from chat_movimenti()'), '3');
select atteso('…Ada pure', da('22222222-2222-2222-2222-222222222222', :'claude', 'select count(*)::text from chat_movimenti()'), '3');
select atteso('…Anna (solo segreteria) no', da('11111111-1111-1111-1111-111111111111', :'claude', 'select count(*)::text from chat_movimenti()'), '42501 la contabilità la cura l’amministrazione');
select atteso('…Luca no', da('77777777-7777-7777-7777-777777777777', :'claude', 'select count(*)::text from chat_movimenti()'), '42501 la contabilità la cura l’amministrazione');
select atteso('chat_movimenti: le colonne che servono ai conti, senza nota né chi li ha scritti',
  pg_get_function_result('chat_movimenti()'::regprocedure),
  'TABLE(id uuid, tipo text, data date, importo integer, voce_id uuid, cassa_id uuid, cassa_a_id uuid, descrizione text, creato_il timestamp with time zone, annullato_il timestamp with time zone, origine_import text, persona_id uuid)');
select atteso('chat_movimenti_uguali: stesso tipo e importo nel periodo, anche gli annullati (li scarta il server)',
  da(:'sandro', :'claude', format('select string_agg(descrizione, %L order by data) from chat_movimenti_uguali(%L, 31240, current_date - 10, current_date)', ',', 'uscita')), 'Enel · bolletta,Enel · altra');
select atteso('…fuori dal periodo niente', da(:'sandro', :'claude', 'select count(*)::text from chat_movimenti_uguali(''uscita'', 31240, current_date - 1, current_date)'), '0');
select atteso('…altro importo niente', da(:'sandro', :'claude', 'select count(*)::text from chat_movimenti_uguali(''uscita'', 100, current_date - 10, current_date)'), '0');
select atteso('…Anna no', da('11111111-1111-1111-1111-111111111111', :'claude', 'select count(*)::text from chat_movimenti_uguali(''uscita'', 31240, current_date - 10, current_date)'), '42501 la contabilità la cura l’amministrazione');
select atteso('chat_movimenti_uguali: le colonne del doppione',
  pg_get_function_result('chat_movimenti_uguali(text, integer, date, date)'::regprocedure),
  'TABLE(id uuid, tipo text, data date, importo integer, descrizione text, voce_id uuid, persona_id uuid, annullato_il timestamp with time zone)');
select atteso('chat_movimento_per_chiave: la chiave di Sandro, scritta da lui', da(:'sandro', :'claude', 'select descrizione from chat_movimento_per_chiave(''chiave-sandro'')'), 'Enel · bolletta');
select atteso('…quella di Ada no', da(:'sandro', :'claude', 'select count(*)::text from chat_movimento_per_chiave(''chiave-ada'')'), '0');
select atteso('…un movimento annullato no', da(:'sandro', :'claude', 'select count(*)::text from chat_movimento_per_chiave(''chiave-annullata'')'), '0');
select atteso('…Anna no', da('11111111-1111-1111-1111-111111111111', :'claude', 'select count(*)::text from chat_movimento_per_chiave(''chiave-sandro'')'), '42501 la contabilità la cura l’amministrazione');
select atteso('chat_movimento_per_chiave: le colonne del movimento scritto',
  pg_get_function_result('chat_movimento_per_chiave(text)'::regprocedure),
  'TABLE(id uuid, tipo text, data date, importo integer, descrizione text, voce_id uuid, cassa_id uuid)');
select atteso('chat_pagamenti_diretti: i pagamenti a mano, senza persona né nota', da(:'sandro', :'claude', 'select string_agg(metodo || ''|'' || voce || ''|'' || importo, '','') from chat_pagamenti_diretti()'), 'Contanti|QUOTA ASSOCIATIVA|2000');
select atteso('…le colonne', pg_get_function_result('chat_pagamenti_diretti()'::regprocedure),
  'TABLE(id uuid, data date, importo integer, metodo text, voce text, annullato_il timestamp with time zone)');
select atteso('…Anna no', da('11111111-1111-1111-1111-111111111111', :'claude', 'select count(*)::text from chat_pagamenti_diretti()'), '42501 la contabilità la cura l’amministrazione');
select atteso('chat_ricevute: le voci coi pagamenti, mai intestatario, ente o note', pg_get_function_result('chat_ricevute()'::regprocedure),
  'TABLE(id uuid, voci jsonb, annullata_il timestamp with time zone)');
select atteso('…Sandro le legge', da(:'sandro', :'claude', 'select count(*)::text from chat_ricevute()'), '0');
select atteso('…Anna no', da('11111111-1111-1111-1111-111111111111', :'claude', 'select count(*)::text from chat_ricevute()'), '42501 la contabilità la cura l’amministrazione');

\echo '--- 5. permessi e impostazioni ---'
reset role;
select atteso('le letture dei conti: security definer, stable, search_path fissato',
  (select string_agg(p.proname || ':' || p.prosecdef::text || ':' || p.provolatile::text || ':' || coalesce(array_to_string(p.proconfig, ';'), ''), ',' order by p.proname)
     from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('chat_movimenti', 'chat_movimenti_uguali', 'chat_movimento_per_chiave', 'chat_ricevute', 'chat_pagamenti_diretti')),
  'chat_movimenti:true:s:search_path=public, extensions,chat_movimenti_uguali:true:s:search_path=public, extensions,chat_movimento_per_chiave:true:s:search_path=public, extensions,chat_pagamenti_diretti:true:s:search_path=public, extensions,chat_ricevute:true:s:search_path=public, extensions');
select atteso('anon non le chiama',
  (select string_agg(f, ',') from unnest(array['chat_movimenti()', 'chat_movimenti_uguali(text,integer,date,date)', 'chat_movimento_per_chiave(text)', 'chat_ricevute()', 'chat_pagamenti_diretti()']) f
    where has_function_privilege('anon', f, 'execute')), null);
select atteso('controlla_richiesta, da_claude e porta_di_claude: le chiamano tutti (PostgREST col ruolo di chi chiede)',
  (has_function_privilege('anon', 'controlla_richiesta()', 'execute') and has_function_privilege('authenticated', 'controlla_richiesta()', 'execute')
   and has_function_privilege('anon', 'da_claude()', 'execute') and has_function_privilege('authenticated', 'da_claude()', 'execute')
   and has_function_privilege('anon', 'porta_di_claude()', 'execute'))::text, 'true');
select atteso('le letture senza persone: Sandro le legge',
  da(:'sandro', :'claude', 'select ((select count(*) from chat_voci()) > 0 and (select count(*) from chat_casse()) = 2)::text'), 'true');
select atteso('…anon no',
  (select string_agg(f, ',') from unnest(array['chat_voci()', 'chat_casse()', 'chat_chiusure()', 'chat_corsi()', 'chat_registra(jsonb)']) f
    where has_function_privilege('anon', f, 'execute')), null);
select atteso('PostgREST chiama controlla_richiesta prima di ogni richiesta',
  (select array_to_string(rolconfig, ';') from pg_roles where rolname = 'authenticator'), '…pgrst.db_pre_request=public.controlla_richiesta…');
select atteso('niente scritto dalle prove: tre movimenti, un pagamento, un file',
  (select count(*) from movimenti) || '|' || (select count(*) from pagamenti_diretti) || '|' || (select count(*) from storage.objects), '3|1|1');
