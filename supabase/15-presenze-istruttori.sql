-- ---------------------------------------------------------------------------
-- ODS Corsi · la presenza degli istruttori, dal PIN del tablet
--
-- Un istruttore che mette il suo PIN sul tablet di una sala durante una
-- lezione è in sala: gli si segna la presenza. Se era lui a dover fare quella
-- lezione (chi insegna il corso, o il sostituto di quel giorno) la presenza è
-- confermata da sola; se no, resta da confermare in segreteria, che la
-- conferma o la rifiuta dalla voce PRESENZE ISTRUTTORI.
--
-- «Durante una lezione» è la stessa finestra in cui ci si segna dal tablet:
-- da mezz'ora prima dell'inizio a dieci minuti dopo la fine (`tablet_regole()`
-- di 04-tablet.sql). Con due lezioni aperte insieme, quella che finisce e
-- quella che comincia, si segnano tutte quelle in cui l'istruttore è previsto;
-- se non è previsto in nessuna, una sola va da confermare: quella in corso, o
-- la più vicina. La segreteria che entra col PIN senza essere prevista non si
-- segna: apre l'appello, non fa lezione. Chi è di segreteria e insegna anche
-- (`anche_istruttore`, in 01-schema.sql) si segna come un istruttore.
--
-- Il tablet la chiama subito dopo `entra_con_pin`, con lo stesso PIN. Finché
-- questo file non c'è, il tablet apre l'area istruttore come prima e non
-- segna niente.
--
-- Si lancia dopo `04-tablet.sql`. Crea funzioni, ma dice lei a chi: non
-- chiede di rilanciare `06-iscrizioni.sql`.
-- ---------------------------------------------------------------------------

do $$ begin
  create type stato_presenza_istruttore as enum ('confermata', 'da_confermare', 'rifiutata');
exception when duplicate_object then null; end $$;

create table if not exists presenze_istruttori (
  id            uuid primary key default gen_random_uuid(),
  sessione_id   uuid not null references sessioni on delete cascade,
  persona_id    uuid not null references persone on delete cascade,
  stato         stato_presenza_istruttore not null,
  -- Era previsto su quella lezione quando ha messo il PIN.
  prevista      boolean not null,
  entrato_il    timestamptz not null default now(),
  postazione_id uuid references postazioni on delete set null,
  gestita_da    uuid references persone on delete set null,
  gestita_il    timestamptz,
  -- Un PIN rimesso a metà lezione non la segna due volte.
  unique (sessione_id, persona_id)
);
create index if not exists presenze_istruttori_da_confermare on presenze_istruttori (entrato_il) where stato = 'da_confermare';
create index if not exists presenze_istruttori_quando on presenze_istruttori (entrato_il);
create index if not exists presenze_istruttori_persona on presenze_istruttori (persona_id);

alter table presenze_istruttori enable row level security;

-- La legge la segreteria, e ognuno le sue. Scrivono solo le funzioni qui sotto.
drop policy if exists presenze_istruttori_legge on presenze_istruttori;
create policy presenze_istruttori_legge on presenze_istruttori for select to authenticated
  using (e_staff() or persona_id = persona_corrente());

revoke all on presenze_istruttori from anon, authenticated;
grant select on presenze_istruttori to authenticated;

/**
 * L'istruttore era previsto su questa lezione? Con un sostituto la fa lui e
 * basta; se no chi insegna il corso. È la stessa regola di `lezioni_sala`.
 */
create or replace function prevista_su(sessione uuid, persona uuid) returns boolean
  language sql stable security definer set search_path = public, extensions as $$
  select coalesce((
    select case
      when s.istruttore_id is not null and s.istruttore_id is distinct from c.istruttore_id then s.istruttore_id = persona
      else persona = c.istruttore_id
        or exists (select 1 from corsi_istruttori ci where ci.corso_id = c.id and ci.persona_id = persona)
    end
    from sessioni s join corsi c on c.id = s.corso_id
    where s.id = sessione
  ), false)
$$;

/**
 * Il PIN sul tablet, durante una lezione: segna la presenza di chi l'ha
 * messo. Restituisce le lezioni segnate e come, perché il tablet lo dica;
 * niente se il PIN è sbagliato o nessuna lezione è aperta.
 */
create or replace function presenza_con_pin(pin text)
  returns table (sessione_id uuid, corso text, stato stato_presenza_istruttore)
  language plpgsql security definer set search_path = public, extensions as $$
declare
  p uuid := postazione_corrente();
  r record;
  chi uuid;
  sala uuid;
  aperte uuid[];
  previste uuid[];
  segnate uuid[];
begin
  select * into r from tablet_regole();
  if p is null then raise exception 'solo un tablet di sala' using errcode = '42501'; end if;
  chi := persona_da_pin(pin);
  if chi is null then return; end if;
  select postazioni.sala_id into sala from postazioni where postazioni.id = p;

  -- Le lezioni della sala aperte adesso: prima quella in corso, poi la più vicina.
  select array_agg(s.id order by (now() between s.inizio and s.fine) desc, abs(extract(epoch from s.inizio - now())))
    into aperte
    from sessioni s join corsi c on c.id = s.corso_id
    left join ricorrenze ri on ri.id = s.ricorrenza_id
    where coalesce(s.sala_id, ri.sala_id, c.sala_id) = sala
      and s.stato <> 'annullata'
      and now() between s.inizio - r.prima and s.fine + r.dopo;
  if aperte is null then return; end if;

  select array_agg(x) into previste from unnest(aperte) x where prevista_su(x, chi);

  if previste is not null then
    -- Previsto: confermata. Una da confermare di prima (il sostituto messo
    -- dopo che era entrato) si conferma adesso; una rifiutata resta com'è.
    insert into presenze_istruttori (sessione_id, persona_id, stato, prevista, postazione_id)
      select x, chi, 'confermata', true, p from unnest(previste) x
      on conflict on constraint presenze_istruttori_sessione_id_persona_id_key do update
        set stato = 'confermata', prevista = true
        where presenze_istruttori.stato = 'da_confermare';
    segnate := previste;
  elsif exists (select 1 from persone pe where pe.id = chi and pe.ruolo = 'staff' and not pe.anche_istruttore) then
    return;
  else
    insert into presenze_istruttori (sessione_id, persona_id, stato, prevista, postazione_id)
      values (aperte[1], chi, 'da_confermare', false, p)
      on conflict on constraint presenze_istruttori_sessione_id_persona_id_key do nothing;
    segnate := aperte[1:1];
  end if;

  return query
    select pi.sessione_id, c.nome, pi.stato
    from presenze_istruttori pi join sessioni s on s.id = pi.sessione_id join corsi c on c.id = s.corso_id
    where pi.persona_id = chi and pi.sessione_id = any (segnate)
    order by s.inizio;
end $$;

/** La segreteria conferma, o rifiuta, una presenza da confermare. Si può anche ripensarci. */
create or replace function gestisci_presenza_istruttore(presenza uuid, conferma boolean) returns void
  language plpgsql security definer set search_path = public, extensions as $$
begin
  if not e_staff() then raise exception 'la presenza la conferma la segreteria' using errcode = '42501'; end if;
  update presenze_istruttori
    set stato = case when conferma then 'confermata' else 'rifiutata' end::stato_presenza_istruttore,
        gestita_da = persona_corrente(), gestita_il = now()
    where id = presenza;
  if not found then raise exception 'presenza inesistente' using errcode = 'P0002'; end if;
end $$;

revoke all on function prevista_su(uuid, uuid) from public, anon, authenticated;
revoke all on function presenza_con_pin(text), gestisci_presenza_istruttore(uuid, boolean) from public, anon;
grant execute on function presenza_con_pin(text), gestisci_presenza_istruttore(uuid, boolean) to authenticated;

-- Che l'API veda subito tabella e funzioni nuove, senza aspettare.
notify pgrst, 'reload schema';
