-- ---------------------------------------------------------------------------
-- ODS Corsi · le ricevute mensili dei compensi dei tecnici
--
-- Ogni mese ogni tecnico firma la sua ricevuta: autocertificazione per i
-- compensi sportivi e liquidazione. Il compenso è, corso per corso, le ore
-- confermate per la sua tariffa (`78-tariffe-tecnici.sql`); netto uguale al
-- lordo. Si stampa e si firma a mano.
--
--   · `ricevute_compensi`: come le lettere (`79-lettere-incarico.sql`), le
--     righe del conto, il tecnico (con IBAN e province) e la qualifica della
--     lettera si copiano dentro quando la ricevuta si fa. Il compenso si può
--     cambiare a mano, ma allora va scritto il perché (`motivo`). Una sola non
--     annullata per persona e mese; fatta non si cambia: si annulla e si rifà.
--     Dopo, si cambia solo `firmata` (il foglio firmato è tornato).
--   · `fai_ricevuta_compenso(...)`: l'unico modo di farla. Solo per chi
--     insegna, mese non nel futuro, righe giuste e `calcolato` uguale alla loro
--     somma (un corso senza tariffa non entra).
--   · `annulla_ricevuta_compenso(id)`: la segna annullata. Il pagamento in
--     CONTABILITÀ arriva dopo.
-- La legge, la fa, l'annulla e la spunta solo la segreteria (`e_staff()`): né
-- il tecnico, né gli istruttori, né l'amministrazione senza segreteria, né il
-- tablet, né `anon`. Un tecnico con ricevute non si elimina.
--
-- Si lancia dopo `79-lettere-incarico.sql`. Non chiede di rilanciare
-- `06-iscrizioni.sql` e non tocca nessuna funzione di prima. Finché non c'è,
-- la pagina COMPENSI e la scheda del tecnico dicono di lanciarlo.
-- ---------------------------------------------------------------------------

create table if not exists ricevute_compensi (
  id          uuid primary key default gen_random_uuid(),
  persona_id  uuid not null references persone on delete restrict,
  mese        date not null check (extract(day from mese) = 1),
  righe       jsonb not null check (jsonb_typeof(righe) = 'array' and jsonb_array_length(righe) >= 1),
  calcolato   int not null check (calcolato >= 0),
  importo     int not null check (importo > 0 and importo <= 10000000),
  motivo      text,
  tecnico     jsonb not null check (jsonb_typeof(tecnico) = 'object'),
  qualifica   text check (qualifica in ('Allenatore', 'Istruttore', 'Direttore tecnico', 'Direttore sportivo', 'Preparatore atletico', 'Direttore di gara', 'Atleta', 'Altro')),
  data        date not null,
  firmata     boolean not null default false,
  annullata_il timestamptz,
  creata_il   timestamptz not null default now(),
  creata_da   uuid references persone on delete set null,
  check ((importo = calcolato and motivo is null) or (importo <> calcolato and coalesce(length(trim(motivo)), 0) between 3 and 200))
);
create unique index if not exists ricevute_compensi_valida on ricevute_compensi (persona_id, mese) where annullata_il is null;
alter table ricevute_compensi enable row level security;
drop policy if exists ricevute_compensi_legge on ricevute_compensi;
drop policy if exists ricevute_compensi_spunta on ricevute_compensi;
create policy ricevute_compensi_legge on ricevute_compensi for select to authenticated using (e_staff());
create policy ricevute_compensi_spunta on ricevute_compensi for update to authenticated using (e_staff()) with check (e_staff());
revoke all on ricevute_compensi from anon, authenticated;
grant select on ricevute_compensi to authenticated;
grant update (firmata) on ricevute_compensi to authenticated;

create or replace function fai_ricevuta_compenso(persona uuid, mese date, righe jsonb, calcolato int, importo int, motivo text, tecnico jsonb, qualifica text, data date)
returns ricevute_compensi language plpgsql security definer set search_path = public as $$
declare nuova ricevute_compensi;
begin
  if not e_staff() then raise exception 'Le ricevute dei compensi le fa la segreteria' using errcode = '42501'; end if;
  if not exists (select 1 from persone p where p.id = persona and (p.ruolo = 'istruttore' or coalesce(p.anche_istruttore, false))) then
    raise exception 'La ricevuta del compenso si fa a chi insegna' using errcode = '22023'; end if;
  -- Prima i nulli e i tipi: il messaggio è questo, non quello grezzo dei vincoli della tabella.
  if jsonb_typeof(tecnico) is distinct from 'object' or pg_column_size(tecnico) > 8192 then raise exception 'I dati del tecnico della ricevuta non sono giusti' using errcode = '22023'; end if;
  if mese is null or data is null or importo is null or calcolato is null or extract(day from mese) <> 1 or mese > date_trunc('month', current_date) then raise exception 'Il mese della ricevuta non va: il primo del mese, non nel futuro' using errcode = '22023'; end if;
  -- Ogni riga coi suoi numeri (veri numeri, non testo) e l'importo che è proprio ore × tariffa:
  -- se no il compenso cambiato a mano senza perché passerebbe scritto dentro una riga.
  if jsonb_typeof(righe) is distinct from 'array' or jsonb_array_length(righe) not between 1 and 50 or pg_column_size(righe) > 16384
     or exists (select 1 from jsonb_array_elements(righe) t where jsonb_typeof(t) <> 'object'
       or jsonb_typeof(t->'corso') is distinct from 'string' or length(trim(t->>'corso')) = 0
       or jsonb_typeof(t->'lezioni') is distinct from 'number' or jsonb_typeof(t->'minuti') is distinct from 'number'
       or jsonb_typeof(t->'centesimi_ora') is distinct from 'number' or jsonb_typeof(t->'importo') is distinct from 'number'
       or (t->>'lezioni') !~ '^[0-9]{1,4}$' or (t->>'lezioni')::int < 1
       or (t->>'minuti') !~ '^[0-9]{1,6}$' or (t->>'minuti')::int < 1
       or (t->>'centesimi_ora') !~ '^[0-9]{1,6}$' or (t->>'centesimi_ora')::int not between 1 and 100000
       or (t->>'importo') !~ '^[0-9]{1,8}$'
       or (t->>'importo')::int <> round((t->>'minuti')::numeric / 60 * (t->>'centesimi_ora')::int))
     or calcolato is distinct from (select sum((t->>'importo')::int) from jsonb_array_elements(righe) t) then
    raise exception 'Le righe del compenso non sono giuste: rifai la ricevuta dalla pagina COMPENSI' using errcode = '22023'; end if;
  if exists (select 1 from ricevute_compensi r where r.persona_id = persona and r.mese = fai_ricevuta_compenso.mese and r.annullata_il is null) then
    raise exception 'C''è già la ricevuta di questo mese: annullala prima di rifarla' using errcode = '23505'; end if;
  -- Il compenso cambiato a mano senza perché non passa: lo dice anche il check della tabella.
  if importo <> calcolato and coalesce(length(trim(motivo)), 0) not between 3 and 200 then
    raise exception 'Scrivi perché il compenso è diverso da quello calcolato' using errcode = '22023'; end if;
  if importo = calcolato then motivo := null; end if;
  insert into ricevute_compensi (persona_id, mese, righe, calcolato, importo, motivo, tecnico, qualifica, data, creata_da)
  values (persona, mese, righe, calcolato, importo, nullif(trim(motivo), ''), tecnico, qualifica, data, persona_corrente()) returning * into nuova;
  return nuova;
end $$;
revoke all on function fai_ricevuta_compenso(uuid, date, jsonb, int, int, text, jsonb, text, date) from public, anon;
grant execute on function fai_ricevuta_compenso(uuid, date, jsonb, int, int, text, jsonb, text, date) to authenticated;

create or replace function annulla_ricevuta_compenso(id uuid) returns ricevute_compensi language plpgsql security definer set search_path = public as $$
declare r ricevute_compensi;
begin
  if not e_staff() then raise exception 'Le ricevute dei compensi le annulla la segreteria' using errcode = '42501'; end if;
  update ricevute_compensi x set annullata_il = now() where x.id = annulla_ricevuta_compenso.id and x.annullata_il is null returning * into r;
  if not found then raise exception 'Questa ricevuta non c''è o è già annullata' using errcode = '22023'; end if;
  return r;
end $$;
revoke all on function annulla_ricevuta_compenso(uuid) from public, anon;
grant execute on function annulla_ricevuta_compenso(uuid) to authenticated;

notify pgrst, 'reload schema';
