-- ---------------------------------------------------------------------------
-- ODS Corsi · le lettere d'incarico dei tecnici
--
-- Una volta l'anno ogni tecnico firma la lettera d'incarico (collaborazione
-- coordinata e continuativa sportiva). L'app la fa col testo fisso della
-- palestra e i dati del tecnico; si stampa e si firma a mano.
--
--   · `lettere_incarico`: come le ricevute, i dati si copiano dentro quando
--     la lettera si fa (`tecnico` e `tariffe`), così ristampata dice sempre
--     la stessa cosa. Fatta non si cambia: correggerla ne fa una nuova, e la
--     vecchia resta segnata `sostituita_il`. Una sola valida per persona e
--     stagione. Dopo, si cambia solo `firmata` (il foglio firmato è tornato).
--   · `fai_lettera_incarico(...)`: l'unico modo di farla. Sostituisce la
--     valida della stessa stagione e fa la nuova, insieme. Solo per chi
--     insegna (`ruolo = 'istruttore'` o `anche_istruttore`), con almeno una
--     tariffa e il periodo dentro la stagione (1° settembre – 31 agosto).
-- La legge, la fa e la spunta solo la segreteria (`e_staff()`): né il
-- tecnico, né gli istruttori, né l'amministrazione senza segreteria, né
-- `anon`. Un tecnico con lettere non si elimina: gli si toglie l'accesso.
--
-- Si lancia dopo `78-tariffe-tecnici.sql`. Non chiede di rilanciare
-- `06-iscrizioni.sql` e non tocca nessuna funzione di prima. Finché non c'è,
-- la scheda del tecnico dice di lanciare questo file e il resto funziona.
-- ---------------------------------------------------------------------------

create table if not exists lettere_incarico (
  id            uuid primary key default gen_random_uuid(),
  persona_id    uuid not null references persone on delete restrict,
  stagione      text not null check (stagione ~ '^\d{4}/\d{2}$'),
  dal           date not null,
  al            date not null,
  qualifica     text not null check (qualifica in ('Allenatore', 'Istruttore', 'Direttore tecnico', 'Direttore sportivo', 'Preparatore atletico', 'Direttore di gara', 'Atleta', 'Altro')),
  giorni        text not null default '' check (length(giorni) <= 80),
  data          date not null,
  tariffe       jsonb not null check (jsonb_typeof(tariffe) = 'array' and jsonb_array_length(tariffe) >= 1),
  tecnico       jsonb not null check (jsonb_typeof(tecnico) = 'object'),
  firmata       boolean not null default false,
  sostituita_il timestamptz,
  creata_il     timestamptz not null default now(),
  creata_da     uuid references persone on delete set null,
  check (al > dal)
);
create unique index if not exists lettere_incarico_valida on lettere_incarico (persona_id, stagione) where sostituita_il is null;

alter table lettere_incarico enable row level security;
drop policy if exists lettere_incarico_legge on lettere_incarico;
drop policy if exists lettere_incarico_spunta on lettere_incarico;
create policy lettere_incarico_legge on lettere_incarico for select to authenticated using (e_staff());
create policy lettere_incarico_spunta on lettere_incarico for update to authenticated using (e_staff()) with check (e_staff());
revoke all on lettere_incarico from anon, authenticated;
grant select on lettere_incarico to authenticated;
grant update (firmata) on lettere_incarico to authenticated;

create or replace function fai_lettera_incarico(persona uuid, stagione text, dal date, al date, qualifica text, giorni text, data date, tariffe jsonb, tecnico jsonb)
returns lettere_incarico language plpgsql security definer set search_path = public as $$
declare
  nuova lettere_incarico;
begin
  if not e_staff() then
    raise exception 'Le lettere d’incarico le fa la segreteria' using errcode = '42501';
  end if;
  if not exists (select 1 from persone p where p.id = persona and (p.ruolo = 'istruttore' or coalesce(p.anche_istruttore, false))) then
    raise exception 'La lettera d’incarico si fa a chi insegna' using errcode = '22023';
  end if;
  -- Un elenco da 1 a 50 tariffe, ognuna col suo corso e un intero fra 1 e 100.000 centesimi: niente cast che si rompe a metà.
  if jsonb_typeof(tariffe) is distinct from 'array' or jsonb_array_length(tariffe) not between 1 and 50
     or exists (select 1 from jsonb_array_elements(tariffe) t
                where jsonb_typeof(t) <> 'object' or jsonb_typeof(t->'corso') is distinct from 'string' or length(trim(t->>'corso')) = 0
                   or jsonb_typeof(t->'centesimi') is distinct from 'number' or (t->>'centesimi') !~ '^[0-9]{1,6}$'
                   or (t->>'centesimi')::int not between 1 and 100000) then
    raise exception 'Le tariffe della lettera non sono giuste' using errcode = '22023';
  end if;
  if jsonb_typeof(tecnico) is distinct from 'object' or pg_column_size(tecnico) > 8192 then
    raise exception 'I dati del tecnico della lettera non sono giusti' using errcode = '22023';
  end if;
  -- Il periodo sta nella stagione, dal 1° settembre al 31 agosto: un anno scritto male non passa.
  if fai_lettera_incarico.stagione !~ '^\d{4}/\d{2}$'
     or right(fai_lettera_incarico.stagione, 2) <> lpad(((left(fai_lettera_incarico.stagione, 4)::int + 1) % 100)::text, 2, '0') then
    raise exception 'La stagione si scrive come 2026/27' using errcode = '22023';
  end if;
  if fai_lettera_incarico.dal < make_date(left(fai_lettera_incarico.stagione, 4)::int, 9, 1)
     or fai_lettera_incarico.al > make_date(left(fai_lettera_incarico.stagione, 4)::int + 1, 8, 31) then
    raise exception 'Il periodo va dentro la stagione %', fai_lettera_incarico.stagione using errcode = '22023';
  end if;
  -- Una sola valida per stagione: quella di prima resta, segnata.
  update lettere_incarico l set sostituita_il = now()
    where l.persona_id = persona and l.stagione = fai_lettera_incarico.stagione and l.sostituita_il is null;
  insert into lettere_incarico (persona_id, stagione, dal, al, qualifica, giorni, data, tariffe, tecnico, creata_da)
  values (persona, fai_lettera_incarico.stagione, fai_lettera_incarico.dal, fai_lettera_incarico.al, fai_lettera_incarico.qualifica,
          coalesce(fai_lettera_incarico.giorni, ''), fai_lettera_incarico.data, fai_lettera_incarico.tariffe, fai_lettera_incarico.tecnico, persona_corrente())
  returning * into nuova;
  return nuova;
end $$;
revoke all on function fai_lettera_incarico(uuid, text, date, date, text, text, date, jsonb, jsonb) from public, anon;
grant execute on function fai_lettera_incarico(uuid, text, date, date, text, text, date, jsonb, jsonb) to authenticated;

notify pgrst, 'reload schema';
