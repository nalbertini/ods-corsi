-- Il minimo che Supabase mette a disposizione e che lo schema presuppone.
-- NON è Supabase: è un'impalcatura per provare schema, policy e funzioni.
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text);
create extension if not exists pgcrypto;

-- auth.uid() legge l'utente «collegato» da una variabile di sessione, come fa
-- Supabase leggendo il JWT.
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('prova.utente', true), '')::uuid
$$;

do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
grant usage on schema public, auth to anon, authenticated, service_role;
