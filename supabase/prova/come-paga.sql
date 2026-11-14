-- «Come paga» nell'iscrizione online (160-come-paga.sql): chi si iscrive dice se
-- paga col bonifico o in contanti, e la segreteria lo legge.
--   • `richieste_iscrizione.come_paga`: solo 'bonifico', 'contanti' o null (null per
--     Satispay, carta, il nucleo di un iscritto e le richieste vecchie);
--   • `invia_iscrizione` (la vecchia diventa `invia_iscrizione_N`, avvolta come in 141)
--     salva il valore mandato da `anon`; un valore diverso è rifiutato;
--   • `anon` non legge né cambia le richieste; la segreteria legge `come_paga`;
--   • accogliere una richiesta coi contanti NON segna la quota pagata: i soldi
--     si registrano in segreteria, quando arrivano.
-- Le metà in prova: scripts/prova-come-paga.mjs (stessi casi, stessi messaggi).
-- Si lancia dopo tablet.sql (che dà la segreteria e il corso `cccccccc-…01`).
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

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
-- Un rifiuto vero: una funzione che non c'è ancora non è un permesso negato.
create or replace function rifiutata(sql text) returns text language plpgsql as $$
declare r text;
begin
  r := tenta(sql);
  return case when r like 'NEGATO:%' and r not like '%does not exist%' then 'rifiutata' else r end;
end $$;
-- Il codice dell'errore, per i 22023 della proroga.
create or replace function codice(sql text) returns text language plpgsql as $$
begin execute sql; return 'ok';
exception when others then return sqlstate;
end $$;
create or replace function oggi() returns date language sql stable as $$ select (now() at time zone 'Europe/Rome')::date $$;
-- Una data come scarto da oggi (30 = fra 30 giorni, -1 = ieri): così la prova non ha date fisse.
create or replace function rel(d date) returns text language sql stable as $$ select coalesce((d - oggi())::text, '-') $$;
create or replace function pz(n int) returns uuid language sql immutable as $$
  select ('f2000000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;
create or replace function fl(n int, nome text) returns text language sql immutable as $$ select pz(n)::text || '/' || nome $$;
create or replace function cf_prova(nome text, cognome text, nato date, donna boolean default false)
  returns text language sql stable security definer set search_path = public as $$
  select x || cf_controllo(x) from (
    select cf_lettere(nome, cognome) || to_char(nato, 'YY') || substr('ABCDEHLMPRST', extract(month from nato)::int, 1)
           || lpad((extract(day from nato)::int + case when donna then 40 else 0 end)::text, 2, '0') || 'L219' as x) q
$$;
create or replace function dal_modulo(nome text, cognome text, anni int, email text, cambi jsonb default '{}')
  returns jsonb language sql stable as $$
  select jsonb_build_object(
    'nome', nome, 'cognome', cognome, 'nato_il', (current_date - make_interval(years => anni))::date, 'nato_a', 'Torino',
    'codice_fiscale', cf_prova(nome, cognome, (current_date - make_interval(years => anni))::date),
    'indirizzo', 'Via Roma 1', 'cap', '10093', 'comune', 'Collegno', 'email', email, 'telefono', '347 111 2233',
    'corsi', jsonb_build_array('cccccccc-0000-0000-0000-000000000001'::uuid), 'formula', 'annuale', 'regolamento', true
  ) || cambi
$$;
-- Una richiesta scritta direttamente, già con la scelta (null = Satispay, carta, nucleo, vecchia).
create or replace function richiesta_con(n int, come text) returns void language plpgsql as $$
begin
  insert into richieste_iscrizione (id, nome, cognome, nato_il, nato_a, codice_fiscale, indirizzo, cap, comune, email, telefono, corsi, formula, come_paga)
  values (pz(n), 'Richiesta', 'Numero' || n, current_date - make_interval(years => 30), 'Torino', 'TSTTST90A01L219' || chr(n + 64), 'via Roma 1', '10093', 'Collegno',
      'r' || n || '@esempio.it', '3331234567', array['cccccccc-0000-0000-0000-000000000001'::uuid], 'annuale', come);
end $$;
-- I soldi registrati per una persona: pagamenti a mano non annullati e pagamenti Satispay/carta pagati.
create or replace function incassi_di(p uuid) returns text language sql stable as $$
  select (select count(*) from pagamenti_diretti where persona_id = p and annullato_il is null)::text || ' · ' ||
         (select count(*) from pagamenti_satispay where persona_id = p and stato = 'pagato')::text
$$;
grant execute on function chi(text), tenta(text), atteso(text, text, text), rifiutata(text), codice(text), oggi(), rel(date), pz(int), fl(int, text),
  cf_prova(text, text, date, boolean), dal_modulo(text, text, int, text, jsonb), richiesta_con(int, text), incassi_di(uuid) to anon, authenticated;

\echo ''
\echo '--- 1. la colonna accetta solo bonifico, contanti o null ---'
select atteso('la colonna c''è', (select count(*)::text from information_schema.columns where table_name = 'richieste_iscrizione' and column_name = 'come_paga'), '1');
select atteso('bonifico va', tenta($$select richiesta_con(1, 'bonifico')::text$$), '');
select atteso('contanti va', tenta($$select richiesta_con(2, 'contanti')::text$$), '');
select atteso('null va', tenta($$select richiesta_con(3, null)::text$$), '');
select atteso('«satispay» no: non è un modo della colonna', tenta($$select richiesta_con(4, 'satispay')::text$$), 'NEGATO: new row for relation "richieste_iscrizione" violates check constraint…');
select atteso('«assegno» no', tenta($$select richiesta_con(5, 'assegno')::text$$), 'NEGATO: new row for relation "richieste_iscrizione" violates check constraint…');
select atteso('il vuoto no', tenta($$select richiesta_con(6, '')::text$$), 'NEGATO: new row for relation "richieste_iscrizione" violates check constraint…');
select atteso('maiuscole no: «Contanti»', tenta($$select richiesta_con(7, 'Contanti')::text$$), 'NEGATO: new row for relation "richieste_iscrizione" violates check constraint…');

\echo ''
\echo '--- 2. invia_iscrizione salva la scelta, e rifiuta le altre ---'
select chi('');
set role anon;
select atteso('con i contanti la richiesta parte', tenta($$select (invia_iscrizione(dal_modulo('Cora', 'Contanti', 30, 'cora@esempio.it', '{"come_paga": "contanti"}')) is not null)::text$$), 'true');
select atteso('col bonifico la richiesta parte, senza nessuna ricevuta', tenta($$select (invia_iscrizione(dal_modulo('Bruno', 'Bonifico', 30, 'bruno@esempio.it', '{"come_paga": "bonifico"}')) is not null)::text$$), 'true');
select atteso('senza la scelta (Satispay, carta, nucleo) parte lo stesso', tenta($$select (invia_iscrizione(dal_modulo('Sara', 'Satispay', 30, 'sara@esempio.it')) is not null)::text$$), 'true');
select atteso('come_paga null esplicito parte lo stesso', tenta($$select (invia_iscrizione(dal_modulo('Nina', 'Nulla', 30, 'nina@esempio.it', '{"come_paga": null}')) is not null)::text$$), 'true');
select atteso('un valore diverso è rifiutato: «assegno»', rifiutata($$select invia_iscrizione(dal_modulo('Ugo', 'Assegno', 30, 'ugo@esempio.it', '{"come_paga": "assegno"}'))::text$$), 'rifiutata');
select atteso('«satispay» come scelta salvata no: Satispay non è una scelta del campo', rifiutata($$select invia_iscrizione(dal_modulo('Sofia', 'Altro', 30, 'sofia@esempio.it', '{"come_paga": "satispay"}'))::text$$), 'rifiutata');
select atteso('un numero no', rifiutata($$select invia_iscrizione(dal_modulo('Nico', 'Numero', 30, 'nico@esempio.it', '{"come_paga": 1}'))::text$$), 'rifiutata');
reset role;
select atteso('Cora: contanti', (select come_paga from richieste_iscrizione where nome = 'Cora'), 'contanti');
select atteso('Bruno: bonifico', (select come_paga from richieste_iscrizione where nome = 'Bruno'), 'bonifico');
select atteso('Sara: null', coalesce((select come_paga from richieste_iscrizione where nome = 'Sara'), 'null'), 'null');
select atteso('Nina: null', coalesce((select come_paga from richieste_iscrizione where nome = 'Nina'), 'null'), 'null');
select atteso('i rifiutati non hanno lasciato righe', (select count(*)::text from richieste_iscrizione where nome in ('Ugo', 'Sofia', 'Nico')), '0');
select atteso('le richieste vecchie (senza il campo) leggono null', coalesce((select come_paga from richieste_iscrizione where id = pz(3)), 'null'), 'null');

\echo ''
\echo '--- 3. chi può leggere e cambiare ---'
select chi('');
set role anon;
select atteso('anon non legge le richieste', tenta($$select count(*)::text from richieste_iscrizione$$), 'NEGATO: …');
select atteso('anon non legge come_paga', tenta($$select come_paga from richieste_iscrizione$$), 'NEGATO: …');
select atteso('anon non cambia la scelta', tenta($$update richieste_iscrizione set come_paga = 'contanti'$$), 'NEGATO: …');
select atteso('anon non scrive una richiesta a mano', tenta($$insert into richieste_iscrizione (nome, come_paga) values ('x', 'contanti')$$), 'NEGATO: …');
reset role;
-- Le versioni vecchie, avvolte (`invia_iscrizione_0`, `_1`…): nessun ruolo le chiama, solo la nuova.
select atteso('anon e la segreteria chiamano solo invia_iscrizione, non le vecchie avvolte', (select count(*)::text from pg_proc
  where proname ~ '^invia_iscrizione_[0-9]+$' and (has_function_privilege('anon', oid, 'execute') or has_function_privilege('authenticated', oid, 'execute'))), '0');
select atteso('l''ultima versione avvolta c''è (la nuova la chiama)', (select (count(*) > 0)::text from pg_proc where proname ~ '^invia_iscrizione_[0-9]+$'), 'true');
select atteso('e la nuova la chiama anon', has_function_privilege('anon', 'invia_iscrizione(jsonb)', 'execute')::text, 'true');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria legge come_paga: contanti', (select come_paga from richieste_iscrizione where nome = 'Cora'), 'contanti');
select atteso('la segreteria legge come_paga: bonifico', (select come_paga from richieste_iscrizione where nome = 'Bruno'), 'bonifico');
select atteso('la segreteria legge come_paga: null', coalesce((select come_paga from richieste_iscrizione where nome = 'Sara'), 'null'), 'null');
-- Non la può cambiare: è quello che ha detto chi si iscrive (come per `certificato_dopo`, scritta solo da invia_iscrizione).
select atteso('la segreteria non cambia la scelta', tenta($$update richieste_iscrizione set come_paga = 'bonifico' where nome = 'Cora'$$), 'NEGATO: …');
select atteso('la segreteria non la mette a mano', tenta($$insert into richieste_iscrizione (nome, come_paga) values ('y', 'contanti')$$), 'NEGATO: …');
select atteso('e la scelta di Cora è ancora quella', (select come_paga from richieste_iscrizione where nome = 'Cora'), 'contanti');
reset role;
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('l''istruttrice non legge le richieste', tenta($$select count(*)::text from richieste_iscrizione$$), '0');
reset role;

\echo ''
\echo '--- 4. accogliere coi contanti non segna la quota pagata ---'
select richiesta_con(11, 'contanti');
select richiesta_con(12, 'bonifico');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('accolta coi contanti', tenta($$select (accogli_iscrizione(pz(11)) is not null)::text$$), 'true');
select atteso('accolta col bonifico (senza ricevuta)', tenta($$select (accogli_iscrizione(pz(12)) is not null)::text$$), 'true');
reset role;
select atteso('contanti: nessun incasso scritto, nessun pagamento pagato', incassi_di((select persona_id from richieste_iscrizione where id = pz(11))), '0 · 0');
select atteso('bonifico senza ricevuta: lo stesso, lo registra la segreteria quando lo vede', incassi_di((select persona_id from richieste_iscrizione where id = pz(12))), '0 · 0');
select atteso('la persona nata dai contanti c''è', (select (persona_id is not null)::text from richieste_iscrizione where id = pz(11)), 'true');
select atteso('la scelta resta sulla richiesta accolta', (select come_paga from richieste_iscrizione where id = pz(11)), 'contanti');
select atteso('nessuna ricevuta emessa per lei', (select count(*)::text from ricevute where persona_id = (select persona_id from richieste_iscrizione where id = pz(11))), '0');
