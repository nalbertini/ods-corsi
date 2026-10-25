-- Nessuna funzione di `public` fa un UPDATE o un DELETE senza WHERE.
-- Su Supabase il ruolo `authenticator` carica `safeupdate`: ogni UPDATE o
-- DELETE senza WHERE, fatto in una chiamata dall'app, dà «UPDATE requires a
-- WHERE clause» (21000), anche dentro una funzione security definer. Il
-- Postgres delle prove non lo ha, e nessuna prova se ne accorgeva.
-- È una prova sul testo delle funzioni, non sul comportamento di safeupdate.
-- Si lancia dopo finto-supabase.sql e i file dello schema.
-- Un `insert … on conflict … do update set …` passa da safeupdate: non conta.
\set ON_ERROR_STOP on

-- Le funzioni che hanno una frase con UPDATE o DELETE e nessun WHERE dopo:
-- un where prima (`if exists (… where …) then update …`) non vale.
create function pg_temp.senza_where() returns text language sql as $$
  select string_agg(distinct p.proname, ', ' order by p.proname)
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
  cross join lateral regexp_split_to_table(
    lower(regexp_replace(p.prosrc, '--[^\n]*', '', 'g')), ';') as frase
  cross join lateral (select substring(frase from '\y((update\y[^;]*\yset|delete\s+from)\y.*)$') as coda) c
  where p.prokind in ('f', 'p')
    and c.coda is not null
    and c.coda !~ '\ywhere\y'
    and frase !~ 'on\s+conflict[^;]*do\s+update'
$$;

-- La prova vede anche l'update nascosto dietro un where di un if.
create function public.prova_where_nascosto() returns void language plpgsql as $$
begin
  if exists (select 1 from pg_class where relname = 'x') then
    update pg_temp.niente set a = 1;
  end if;
end $$;
do $$
begin
  if coalesce(pg_temp.senza_where(), '') !~ 'prova_where_nascosto' then
    raise exception 'La prova non vede un UPDATE senza WHERE dopo un if con where';
  end if;
end $$;
drop function public.prova_where_nascosto();

do $$
declare funzioni text := pg_temp.senza_where();
begin
  if funzioni is not null then
    raise exception 'Queste funzioni fanno UPDATE o DELETE senza WHERE: %. Su Supabase (safeupdate) la chiamata fallisce con «UPDATE requires a WHERE clause»: aggiungi un where (per una tabella a riga unica, sulla sua chiave: `where id`).', funzioni;
  end if;
end $$;
