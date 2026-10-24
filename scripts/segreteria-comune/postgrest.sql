-- Quel che serve per mettere PostgREST davanti allo schema delle prove SQL e
-- farci girare segreteriaSupabase.ts (vedi scripts/prova-segreteria-comune.mjs).
-- Si lancia dopo finto-supabase.sql e i file numerati.

-- Come Supabase: chi è collegato sta nel claim `sub` del token. `prova.utente`
-- resta per primo, così le prove SQL che lo usano non cambiano.
create or replace function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('prova.utente', true), ''), auth.jwt() ->> 'sub')::uuid
$$;

alter role authenticator login password 'prova';
grant anon, authenticated, service_role to authenticator;

-- Chi sta in segreteria: l'utente del token che firma la prova.
insert into auth.users (id, email) values ('5e5e5e5e-0000-0000-0000-000000000001', 'segreteria@ods.prova');
insert into persone (nome, cognome, ruolo, email, utente_id)
values ('Sara', 'Segreteria', 'staff', 'segreteria@ods.prova', '5e5e5e5e-0000-0000-0000-000000000001');

notify pgrst, 'reload schema';
