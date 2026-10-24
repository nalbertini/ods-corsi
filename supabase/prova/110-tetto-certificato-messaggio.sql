-- Il tetto ai file del certificato dice cosa fare (110-tetto-certificato-messaggio.sql).
--   · Il tetto scatta con un codice suo (54000), non più 42501: Storage trasforma ogni 42501 in «new row violates
--     row-level security policy» e il testo del tetto non arriva all'app.
--   · Il tetto lo vede solo chi la policy lascerebbe caricare: chi non è titolare di una cartella piena riceve
--     l'errore della policy, uguale a quello di una cartella vuota (niente «oracolo» sui file di un altro).
-- Si lancia dopo finto-supabase.sql e i file dello schema (il 110 compreso).
\set ON_ERROR_STOP on

create or replace function chi(u text) returns void language plpgsql as $$
begin perform set_config('prova.utente', u, false); end $$;
create or replace function tenta(sql text) returns text language plpgsql as $$
declare n int;
begin
  execute sql;
  get diagnostics n = row_count;
  return case when n = 0 then 'a vuoto (0 righe)' else 'FATTO (' || n || ' righe)' end;
exception when others then return 'NEGATO ' || sqlstate || ': ' || sqlerrm;
end $$;
create or replace function atteso(cosa text, avuto text, voluto text) returns text language plpgsql as $$
begin
  if avuto is distinct from voluto then raise exception '% · atteso «%», avuto «%»', cosa, voluto, avuto; end if;
  return 'ok  ' || cosa || ' → ' || avuto;
end $$;
grant execute on function tenta(text), atteso(text, text, text), chi(text) to anon, authenticated;
create or replace function pid(n int) returns uuid language sql immutable as $$
  select ('aaaaaaaa-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;
grant execute on function pid(int) to anon, authenticated;

insert into auth.users (id, email, email_confirmed_at) values
  ('33333333-3333-3333-3333-333333333333', 'luca@fam.it', now()),
  ('55555555-5555-5555-5555-555555555555', 'bruno@fam.it', now());
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  (pid(3), 'Luca', 'Fam', 'iscritto', 'luca@fam.it', '33333333-3333-3333-3333-333333333333'),
  (pid(6), 'Bruno', 'Solo', 'iscritto', 'bruno@fam.it', '55555555-5555-5555-5555-555555555555');

\echo ''
\echo '--- il quarto file: il codice del tetto ---'
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('Bruno carica tre file', (tenta($$insert into storage.objects (bucket_id, name) values ('certificati', pid(6) || '/attesa-1.pdf')$$)
  || tenta($$insert into storage.objects (bucket_id, name) values ('certificati', pid(6) || '/attesa-2.pdf')$$)
  || tenta($$insert into storage.objects (bucket_id, name) values ('certificati', pid(6) || '/attesa-3.pdf')$$)), 'FATTO (1 righe)FATTO (1 righe)FATTO (1 righe)');
select atteso('il quarto: codice 54000 e il testo del tetto', tenta($$insert into storage.objects (bucket_id, name) values ('certificati', pid(6) || '/attesa-4.pdf')$$),
  'NEGATO 54000: Hai già mandato troppi file: aspetta che la segreteria li guardi');

\echo ''
\echo '--- chi non è titolare non capisce che la cartella è piena ---'
select chi('33333333-3333-3333-3333-333333333333');
select atteso('Luca nella cartella piena di Bruno: l''errore della policy, non del tetto',
  tenta($$insert into storage.objects (bucket_id, name) values ('certificati', pid(6) || '/attesa-9.pdf')$$),
  'NEGATO 42501: new row violates row-level security policy for table "objects"');
select atteso('lo stesso errore in una cartella vuota di un altro',
  tenta($$insert into storage.objects (bucket_id, name) values ('certificati', gen_random_uuid() || '/attesa-9.pdf')$$),
  'NEGATO 42501: new row violates row-level security policy for table "objects"');
select atteso('un nome che non è nemmeno una persona: ancora la policy',
  tenta($$insert into storage.objects (bucket_id, name) values ('certificati', 'xx/attesa-1.pdf')$$),
  'NEGATO 42501: new row violates row-level security policy for table "objects"');
reset role;

select chi('55555555-5555-5555-5555-555555555555');
select atteso('Bruno, anche come scrive Storage (superutente), il quarto no',
  tenta($$insert into storage.objects (bucket_id, name) values ('certificati', pid(6) || '/attesa-5.pdf')$$),
  'NEGATO 54000: Hai già mandato troppi file: aspetta che la segreteria li guardi');

\echo ''
\echo 'TUTTO A POSTO'
