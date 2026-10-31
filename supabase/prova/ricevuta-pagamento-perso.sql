-- La ricevuta dei soldi già registrati a mano (128-ricevuta-pagamento-perso.sql):
--   · `registra_pagamento_diretto` tiene la chiave del modulo ricevuta da cui viene (`pagamenti_diretti.chiave_ricevuta`);
--   · una ricevuta con quella chiave, per la stessa persona, non si fa finché il pagamento a mano è attivo: la rete
--     caduta dopo «Lascia stare» (o una ricevuta ripresa) contava due volte gli stessi soldi;
--   · annullato il pagamento a mano, la ricevuta va; FANNE LA RICEVUTA (chiave nuova) va come prima.
-- Si lancia dopo finto-supabase.sql e i file dello schema, fino a 128-ricevuta-pagamento-perso.sql.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'anna@ods.it');
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000010', 'Paolo', 'Bianchi', 'iscritto', null, null),
  ('aaaaaaaa-0000-0000-0000-000000000011', 'Sara', 'Verdi', 'iscritto', null, null);

create or replace function chi(u text) returns void language plpgsql as $$
begin perform set_config('prova.utente', u, false); end $$;
create or replace function rifiuto(sql text) returns text language plpgsql as $$
begin
  execute sql;
  return 'nessun errore';
exception when others then return sqlstate || ' ' || sqlerrm;
end $$;
create or replace function atteso(cosa text, avuto text, voluto text) returns text language plpgsql as $$
begin
  if avuto is distinct from voluto and not (voluto like '%…' and avuto like replace(voluto, '…', '%')) then
    raise exception '% · atteso «%», avuto «%»', cosa, voluto, avuto;
  end if;
  return 'ok  ' || cosa || ' → ' || avuto;
end $$;
-- La chiave del modulo dal suo numero.
create or replace function k(n int) returns text language sql immutable as $$
  select 'eeeeeeee-0000-0000-0000-' || lpad(n::text, 12, '0') $$;
-- Il pagamento a mano di 280 € in contanti del 10/10, con la chiave del modulo `n` (null: senza).
create or replace function registra(n int, persona text default 'aaaaaaaa-0000-0000-0000-000000000010') returns text language plpgsql as $$
begin
  return registra_pagamento_diretto(jsonb_strip_nulls(jsonb_build_object('persona_id', persona, 'data', '2026-10-10',
    'importo', 28000, 'metodo', 'Contanti', 'voce', 'ANNUALE JUDO KIDS', 'chiave', case when n is not null then k(n) end)))->>'id';
end $$;
-- La ricevuta di Paolo per gli stessi soldi, con la chiave del modulo `n`.
create or replace function dati(n int) returns jsonb language sql immutable as $$
  select jsonb_build_object('persona_id', 'aaaaaaaa-0000-0000-0000-000000000010', 'data', '2026-10-10', 'chiave', k(n),
    'intestatario', jsonb_build_object('nome', 'Paolo', 'cognome', 'Bianchi'),
    'voci', jsonb_build_array(jsonb_build_object('descrizione', 'ANNUALE JUDO KIDS', 'quantita', 1, 'prezzo', 28000,
      'pagamenti', jsonb_build_array(jsonb_build_object('data', '2026-10-10', 'importo', 28000, 'metodo', 'Contanti'))))) $$;
create or replace function ricevuta(n int) returns text language plpgsql as $$
begin return emetti_ricevuta(dati(n))->>'id'; end $$;
create or replace function quante() returns int language sql security definer set search_path = public as $$
  select count(*)::int from ricevute $$;
create or replace function attivo(id text) returns text language sql security definer set search_path = public as $$
  select case when annullato_il is null and ricevuta_id is null then 'attivo' else 'annullato' end
  from pagamenti_diretti where pagamenti_diretti.id = attivo.id::uuid $$;
create or replace function chiave_di(id text) returns text language sql security definer set search_path = public as $$
  select chiave_ricevuta::text from pagamenti_diretti where pagamenti_diretti.id = chiave_di.id::uuid $$;
grant execute on function chi(text), rifiuto(text), atteso(text, text, text), k(int), registra(int, text), dati(int),
  ricevuta(int), quante(), attivo(text), chiave_di(text) to anon, authenticated;

\set GIA '''22023 Questi soldi sono già nel pagamento a mano di 280 € del 10/10/2026: chiudi il modulo e fai la ricevuta da lì, con FANNE LA RICEVUTA'''

\echo ''
\echo '--- 1. il pagamento a mano tiene la chiave del modulo da cui viene ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select registra(1) as p1 \gset
select atteso('la chiave è quella del modulo', chiave_di(:'p1'), k(1));
select registra(null) as p0 \gset
select atteso('senza modulo, nessuna chiave', coalesce(chiave_di(:'p0'), 'nessuna'), 'nessuna');
reset role;

\echo ''
\echo '--- 2. la ricevuta con la stessa chiave, col pagamento a mano attivo: no ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select quante() as prima \gset
select atteso('emetti_ricevuta con la chiave del pagamento a mano', rifiuto($$select ricevuta(1)$$), :GIA);
select atteso('nessuna ricevuta nuova', (quante() - :prima)::text, '0');
select atteso('il pagamento a mano resta attivo', attivo(:'p1'), 'attivo');
reset role;

\echo ''
\echo '--- 3. quel che va come prima ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('una ricevuta con un''altra chiave va', (ricevuta(2) is not null)::text, 'true');
select registra(3, 'aaaaaaaa-0000-0000-0000-000000000011') as p3 \gset
select atteso('la chiave di un pagamento di Sara non ferma la ricevuta di Paolo', (ricevuta(3) is not null)::text, 'true');
select atteso('FANNE LA RICEVUTA (chiave nuova) sul pagamento con la chiave va',
  (emetti_ricevuta_da_pagamento(dati(4), :'p1'::uuid) ? 'id')::text, 'true');
select atteso('…e il pagamento a mano è diventato ricevuta', attivo(:'p1'), 'annullato');
select atteso('…e la ricevuta del modulo, dopo, no: i soldi sono già nella ricevuta fatta da lì',
  rifiuto($$select ricevuta(1)$$), '22023 Questi soldi sono già nella ricevuta n. …');
select registra(5) as p5 \gset
select annulla_pagamento_diretto(:'p5'::uuid);
select atteso('annullato il pagamento a mano, la ricevuta con la sua chiave va', (ricevuta(5) is not null)::text, 'true');
reset role;
