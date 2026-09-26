-- Il minimo che Supabase mette a disposizione e che lo schema presuppone.
-- NON è Supabase: è un'impalcatura per provare schema, policy e funzioni.
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text, email_confirmed_at timestamptz default now());
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

-- Lo Storage: le due tabelle che le policy dei file guardano. Supabase le ha
-- già, con l'RLS accesa e i permessi ad `anon` e `authenticated`.
create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets, name text not null,
  owner uuid, created_at timestamptz default now(), unique (bucket_id, name)
);
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated;
grant select, insert, update, delete on storage.objects to anon, authenticated;
