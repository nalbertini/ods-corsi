-- Il giorno in cui un corso è stato archiviato (150-corso-archiviato-il.sql).
--
-- I corsi da pagare guardano un corso archiviato fino a quel giorno: lo
-- scrive il trigger, da ogni strada, e nessuno lo cambia a mano dopo.
-- La metà di prova è `archiviaCorso` in `src/lib/segreteriaProva.ts`
-- (scripts/prova-corsi-da-pagare.mjs).
-- Si lancia dopo finto-supabase.sql e i file dello schema (il 150 compreso).
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it');
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', 'anna@ods.it', '11111111-1111-1111-1111-111111111111');
insert into corsi (id, nome) values
  ('cccccccc-0000-0000-0000-000000000001', 'Judo 1'),
  ('cccccccc-0000-0000-0000-000000000002', 'Judo 2');

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
create or replace function giorno_di(c uuid) returns text language sql as $$
  select coalesce(archiviato_il::text, 'nessuno') from corsi where id = c
$$;
grant execute on function giorno_di(uuid) to authenticated;

\echo ''
\echo '--- 1. archiviare segna oggi ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('un corso in calendario non ha giorno', giorno_di('cccccccc-0000-0000-0000-000000000001'), 'nessuno');
select atteso('la segreteria archivia Judo 1', tenta($$update corsi set attivo = false where id = 'cccccccc-0000-0000-0000-000000000001'$$), 'FATTO (1 righe)');
select atteso('il giorno è oggi, a Roma', giorno_di('cccccccc-0000-0000-0000-000000000001'), (now() at time zone 'Europe/Rome')::date::text);

\echo ''
\echo '--- 2. dopo, il giorno non si sposta ---'
reset role;
-- Archiviato un mese fa: il giorno si mette col trigger spento, che se no lo terrebbe fermo.
alter table corsi disable trigger corsi_archiviato_il;
update corsi set archiviato_il = current_date - 30 where id = 'cccccccc-0000-0000-0000-000000000001';
alter table corsi enable trigger corsi_archiviato_il;
set role authenticated;
select atteso('un altro cambio al corso archiviato non lo sposta', tenta($$update corsi set nome = 'Judo 1 vecchio', archiviato_il = current_date where id = 'cccccccc-0000-0000-0000-000000000001'$$), 'FATTO (1 righe)');
select atteso('resta il giorno dell''archiviazione', giorno_di('cccccccc-0000-0000-0000-000000000001'), (current_date - 30)::text);
select atteso('un corso in calendario non si dà un giorno a mano', tenta($$update corsi set archiviato_il = current_date where id = 'cccccccc-0000-0000-0000-000000000002'$$) || ' ' || giorno_di('cccccccc-0000-0000-0000-000000000002'), 'FATTO (1 righe) nessuno');

reset role;
set role anon;
select atteso('anon non archivia', tenta($$update corsi set attivo = false where id = 'cccccccc-0000-0000-0000-000000000002'$$), 'NEGATO: permission denied for table corsi');
reset role;
set role authenticated;

\echo ''
\echo '--- 3. di nuovo in calendario, niente giorno ---'
select atteso('la segreteria lo rimette in calendario', tenta($$update corsi set attivo = true where id = 'cccccccc-0000-0000-0000-000000000001'$$), 'FATTO (1 righe)');
select atteso('il giorno se ne va', giorno_di('cccccccc-0000-0000-0000-000000000001'), 'nessuno');
reset role;

\echo ''
\echo '--- 4. i corsi già archiviati: il giorno dell''ultima lezione ---'
-- Come prima del 150: archiviato senza giorno, con due lezioni fatte.
alter table corsi disable trigger corsi_archiviato_il;
update corsi set attivo = false, archiviato_il = null where id = 'cccccccc-0000-0000-0000-000000000002';
alter table corsi enable trigger corsi_archiviato_il;
insert into sessioni (corso_id, inizio, fine) values
  ('cccccccc-0000-0000-0000-000000000002', '2026-10-06 17:00+02', '2026-10-06 18:00+02'),
  ('cccccccc-0000-0000-0000-000000000002', '2026-09-29 17:00+02', '2026-09-29 18:00+02');
\i supabase/150-corso-archiviato-il.sql
select atteso('rilanciato il 150, Judo 2 ha il giorno della sua ultima lezione', giorno_di('cccccccc-0000-0000-0000-000000000002'), '2026-10-06');
