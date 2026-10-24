-- Privilegi più stretti e tetto ai file del certificato (109-privilegi-e-certificati.sql).
--   · Supabase dà ad `anon` e `authenticated` ogni privilegio sulle tabelle nuove, TRUNCATE, TRIGGER e REFERENCES
--     compresi: il 109 li toglie da quelle che ci sono e da quelle che verranno. Qui si rifà prima quello che dà
--     Supabase (il finto non lo fa) e si rilancia il 109 sopra, come sul database vero.
--   · Un iscritto può avere in attesa al massimo 3 file in `certificati/<sé>/attesa-N.*` (il trigger scatta sulla
--     riga vera, che Storage scrive da superutente); la segreteria e gli altri file (`certificato-N`) non sono
--     toccati. Non provato qui: due invii insieme (il lucchetto `pg_advisory_xact_lock`), che in una sola sessione
--     non si vedono; provato a mano con due sessioni.
-- Si lancia dopo finto-supabase.sql e i file dello schema (il 109 compreso).
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
grant execute on function tenta(text), atteso(text, text, text), chi(text) to anon, authenticated;
create or replace function pid(n int) returns uuid language sql immutable as $$
  select ('aaaaaaaa-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;
grant execute on function pid(int) to anon, authenticated;

-- Quanti privilegi pericolosi restano, fra tutte le tabelle di `public` e i due ruoli.
create or replace function privilegi_di_troppo() returns bigint language sql stable as $$
  select count(*) from pg_class c, unnest(array['anon', 'authenticated']) r, unnest(array['TRUNCATE', 'TRIGGER', 'REFERENCES']) p
   where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') and has_table_privilege(r, c.oid, p)
$$;

\echo ''
\echo '--- 1. i privilegi: Supabase li dà, il 109 li toglie ---'
alter default privileges in schema public grant all on tables to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
select atteso('prima del 109 (come Supabase) i privilegi di troppo ci sono', (privilegi_di_troppo() > 0)::text, 'true');
\i supabase/109-privilegi-e-certificati.sql
select atteso('dopo il 109 non ne resta nessuno, su nessuna tabella', privilegi_di_troppo()::text, '0');
create table tabella_nuova (id int);
select atteso('e una tabella creata dopo nasce già senza', privilegi_di_troppo()::text, '0');
drop table tabella_nuova;
select atteso('a authenticated resta quello che serve: select, insert, update, delete su persone',
  (select bool_and(has_table_privilege('authenticated', 'persone', p))::text from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) p), 'true');
insert into persone (id, nome, cognome, ruolo) values (pid(9), 'Zeno', 'Zero', 'iscritto');
set role authenticated;
select atteso('un iscritto non svuota più una tabella', tenta($$truncate presenze$$), 'NEGATO: permission denied for table presenze');
reset role;
select atteso('la riga di prima c''è ancora', (select count(*)::text from persone where id = pid(9)), '1');

\echo ''
\echo '--- 2. il tetto ai file in attesa ---'
insert into auth.users (id, email, email_confirmed_at) values
  ('33333333-3333-3333-3333-333333333333', 'luca@fam.it', now()),
  ('55555555-5555-5555-5555-555555555555', 'bruno@fam.it', now());
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  (pid(3), 'Luca', 'Fam', 'iscritto', 'luca@fam.it', '33333333-3333-3333-3333-333333333333'),
  (pid(6), 'Bruno', 'Solo', 'iscritto', 'bruno@fam.it', '55555555-5555-5555-5555-555555555555');

select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('Bruno carica il primo file', tenta($$insert into storage.objects (bucket_id, name) values ('certificati', pid(6) || '/attesa-1.pdf')$$), 'FATTO (1 righe)');
select atteso('il secondo', tenta($$insert into storage.objects (bucket_id, name) values ('certificati', pid(6) || '/attesa-2.jpg')$$), 'FATTO (1 righe)');
select atteso('il terzo', tenta($$insert into storage.objects (bucket_id, name) values ('certificati', pid(6) || '/attesa-3.png')$$), 'FATTO (1 righe)');
select atteso('il quarto no', tenta($$insert into storage.objects (bucket_id, name) values ('certificati', pid(6) || '/attesa-4.pdf')$$),
  'NEGATO: Hai già mandato troppi file: aspetta che la segreteria li guardi');
select atteso('la cartella di un altro resta chiusa', tenta($$insert into storage.objects (bucket_id, name) values ('certificati', pid(3) || '/attesa-1.pdf')$$),
  'NEGATO: new row violates row-level security policy for table "objects"');
reset role;
select atteso('in Storage ce ne sono tre', (select count(*)::text from storage.objects where bucket_id = 'certificati' and name like pid(6) || '/%'), '3');
-- Storage scrive la riga vera da superutente, senza RLS: il tetto deve tenere anche lì.
select atteso('anche da superutente il quarto no', tenta($$insert into storage.objects (bucket_id, name) values ('certificati', pid(6) || '/attesa-5.pdf')$$),
  'NEGATO: Hai già mandato troppi file: aspetta che la segreteria li guardi');
select atteso('il file del certificato vero non è contato', tenta($$insert into storage.objects (bucket_id, name) values ('certificati', pid(6) || '/certificato-1.pdf')$$), 'FATTO (1 righe)');
select atteso('Luca ha la sua cartella libera', tenta($$insert into storage.objects (bucket_id, name) values ('certificati', pid(3) || '/attesa-1.pdf')$$), 'FATTO (1 righe)');

\echo ''
\echo 'TUTTO A POSTO'
