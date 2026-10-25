-- ---------------------------------------------------------------------------
-- ODS Corsi · le chiusure della palestra
--
-- Natale, Pasqua, un ponte: la segreteria chiude un periodo (al massimo un
-- anno), per tutte le sale o per una, e le lezioni di quei giorni si annullano
-- in un colpo. La chiusura si ricorda: le lezioni dell'orario create dopo (il
-- calendario che si allunga, RIGENERA) in un giorno chiuso nascono annullate.
-- Una straordinaria aggiunta a mano resta prevista: l'ha voluta qualcuno.
-- `chiusure_lezioni` tiene com'era ogni lezione annullata dalla chiusura, così
-- `togli_chiusura` rimette solo quelle, e non quelle annullate a mano.
--
-- Chi può cosa:
--   segreteria   legge le chiusure, chiude (`chiudi_palestra`) e toglie
--                (`togli_chiusura`)
--   gli altri    niente (anon compreso): le lezioni annullate le vedono già
--
-- Si lancia dopo `117-gare.sql`. Si può rilanciare. Non chiede di rilanciare
-- `06-iscrizioni.sql`. Finché non c'è, il tasto della chiusura in SETTIMANA
-- dice «non ancora disponibile» e il resto dell'app non cambia.
-- ---------------------------------------------------------------------------

create table if not exists chiusure (
  id         uuid primary key default gen_random_uuid(),
  dal        date not null,
  al         date not null,
  sala_id    uuid references sale on delete cascade,
  creata_il  timestamptz not null default now(),
  creata_da  uuid references persone on delete set null,
  constraint chiusura_periodo check (al >= dal and al <= (dal + interval '1 year')::date)
);

create table if not exists chiusure_lezioni (
  sessione_id uuid primary key references sessioni on delete cascade,
  chiusura_id uuid not null references chiusure on delete cascade,
  stato_prima stato_sessione not null
);
create index if not exists chiusure_lezioni_chiusura on chiusure_lezioni (chiusura_id);

alter table chiusure enable row level security;
alter table chiusure_lezioni enable row level security;

-- Si legge e basta: scrivono solo le funzioni, che controllano il periodo e
-- tengono insieme chiusura e lezioni.
drop policy if exists chiusure_legge on chiusure;
create policy chiusure_legge on chiusure for select to authenticated using (e_staff());
drop policy if exists chiusure_lezioni_legge on chiusure_lezioni;
create policy chiusure_lezioni_legge on chiusure_lezioni for select to authenticated using (e_staff());
revoke all on chiusure, chiusure_lezioni from anon, authenticated;
grant select on chiusure, chiusure_lezioni to authenticated;

-- Le lezioni non annullate del periodo, nel giorno italiano, della sala chiusa
-- (o di tutte). Serve a contare e a chiudere con la stessa regola. La sala è
-- quella della lezione, se no dell'orario, se no del corso, come in 04-tablet.sql.
create or replace function lezioni_da_chiudere(p_dal date, p_al date, p_sala uuid)
  returns setof sessioni language sql stable security definer set search_path = public, extensions as $$
  select s.* from sessioni s
    left join ricorrenze r on r.id = s.ricorrenza_id
    join corsi c on c.id = s.corso_id
   where s.stato <> 'annullata'
     and (s.inizio at time zone 'Europe/Rome')::date between p_dal and p_al
     and (p_sala is null or coalesce(s.sala_id, r.sala_id, c.sala_id) = p_sala)
$$;
revoke all on function lezioni_da_chiudere(date, date, uuid) from public, anon, authenticated;

create or replace function chiudi_palestra(dal date, al date, sala uuid default null, solo_contare boolean default false)
  returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id uuid;
  v_conto jsonb;
begin
  if not e_staff() then
    raise exception 'la palestra la chiude la segreteria' using errcode = '42501';
  end if;
  if dal is null or al is null or al < dal then
    raise exception 'scegli il primo e l''ultimo giorno della chiusura' using errcode = '22023';
  end if;
  if al > (dal + interval '1 year')::date then
    raise exception 'una chiusura dura al massimo un anno' using errcode = '22023';
  end if;

  select jsonb_build_object(
           'lezioni', count(*),
           'straordinarie', count(*) filter (where l.ricorrenza_id is null),
           'con_appello', coalesce(jsonb_agg(jsonb_build_object(
               'corso', c.nome, 'inizio', l.inizio,
               'prova', exists (select 1 from prove p where p.sessione_id = l.id))
             order by l.inizio)
             filter (where exists (select 1 from presenze p where p.sessione_id = l.id)
                        or exists (select 1 from prove p where p.sessione_id = l.id)), '[]'::jsonb))
    into v_conto
    from lezioni_da_chiudere(dal, al, sala) l
    join corsi c on c.id = l.corso_id;

  if solo_contare then
    return v_conto || jsonb_build_object('id', null);
  end if;

  insert into chiusure (dal, al, sala_id, creata_da)
  values (dal, al, sala, persona_corrente())
  returning id into v_id;

  with chiuse as (
    insert into chiusure_lezioni (sessione_id, chiusura_id, stato_prima)
    select l.id, v_id, l.stato from lezioni_da_chiudere(dal, al, sala) l
    on conflict (sessione_id) do update set chiusura_id = excluded.chiusura_id, stato_prima = excluded.stato_prima
    returning sessione_id
  )
  update sessioni s set stato = 'annullata' from chiuse where s.id = chiuse.sessione_id;

  return v_conto || jsonb_build_object('id', v_id);
end $$;
revoke all on function chiudi_palestra(date, date, uuid, boolean) from public, anon;
grant execute on function chiudi_palestra(date, date, uuid, boolean) to authenticated;

-- Rimette com'erano le lezioni ancora annullate: una rimessa a mano nel
-- frattempo non si tocca. Restituisce quante ne ha rimesse.
create or replace function togli_chiusura(id uuid)
  returns int language plpgsql security definer set search_path = public, extensions as $$
declare
  v_quante int;
begin
  if not e_staff() then
    raise exception 'la chiusura la toglie la segreteria' using errcode = '42501';
  end if;
  -- Tolta da un altro nel frattempo: lo si dice, se no l'app direbbe «0 lezioni rimesse».
  if not exists (select 1 from chiusure c where c.id = togli_chiusura.id) then
    raise exception 'questa chiusura non c''è più' using errcode = 'P0002';
  end if;
  -- Un giorno chiuso anche da un'altra chiusura resta chiuso: le sue lezioni
  -- passano a quella (la più vecchia), non tornano previste.
  update chiusure_lezioni cl set chiusura_id = (
      select c2.id from chiusure c2
        join sessioni s on s.id = cl.sessione_id
        left join ricorrenze r on r.id = s.ricorrenza_id
        join corsi k on k.id = s.corso_id
       where c2.id <> togli_chiusura.id
         and (s.inizio at time zone 'Europe/Rome')::date between c2.dal and c2.al
         and (c2.sala_id is null or c2.sala_id = coalesce(s.sala_id, r.sala_id, k.sala_id))
       order by c2.creata_il limit 1)
   where cl.chiusura_id = togli_chiusura.id
     and exists (
      select 1 from chiusure c2
        join sessioni s on s.id = cl.sessione_id
        left join ricorrenze r on r.id = s.ricorrenza_id
        join corsi k on k.id = s.corso_id
       where c2.id <> togli_chiusura.id
         and (s.inizio at time zone 'Europe/Rome')::date between c2.dal and c2.al
         and (c2.sala_id is null or c2.sala_id = coalesce(s.sala_id, r.sala_id, k.sala_id)));
  update sessioni s set stato = cl.stato_prima
    from chiusure_lezioni cl
   where cl.chiusura_id = togli_chiusura.id and s.id = cl.sessione_id and s.stato = 'annullata';
  get diagnostics v_quante = row_count;
  delete from chiusure c where c.id = togli_chiusura.id;
  return v_quante;
end $$;
revoke all on function togli_chiusura(uuid) from public, anon;
grant execute on function togli_chiusura(uuid) to authenticated;

-- Le lezioni dell'orario create in un giorno chiuso nascono annullate. Dopo
-- l'insert, perché il legame punta alla lezione; le straordinarie no.
create or replace function sessione_in_chiusura() returns trigger
  language plpgsql security definer set search_path = public, extensions as $$
declare
  v_chiusura uuid;
begin
  if new.ricorrenza_id is null or new.stato = 'annullata' then
    return null;
  end if;
  select c.id into v_chiusura from chiusure c
   where (new.inizio at time zone 'Europe/Rome')::date between c.dal and c.al
     and (c.sala_id is null or c.sala_id = coalesce(new.sala_id,
            (select r.sala_id from ricorrenze r where r.id = new.ricorrenza_id),
            (select k.sala_id from corsi k where k.id = new.corso_id)))
   order by c.creata_il limit 1;
  if v_chiusura is not null then
    insert into chiusure_lezioni (sessione_id, chiusura_id, stato_prima)
    values (new.id, v_chiusura, new.stato) on conflict (sessione_id) do nothing;
    update sessioni set stato = 'annullata' where id = new.id;
  end if;
  return null;
end $$;
revoke all on function sessione_in_chiusura() from public, anon, authenticated;

drop trigger if exists sessioni_in_chiusura on sessioni;
create trigger sessioni_in_chiusura after insert on sessioni
  for each row execute function sessione_in_chiusura();

-- Una lezione rimessa a mano non è più della chiusura: se poi la si annulla di
-- nuovo è una decisione della segreteria, e togliere la chiusura non la rimette.
create or replace function sessione_fuori_chiusura() returns trigger
  language plpgsql security definer set search_path = public, extensions as $$
begin
  delete from chiusure_lezioni where sessione_id = new.id;
  return null;
end $$;
revoke all on function sessione_fuori_chiusura() from public, anon, authenticated;

drop trigger if exists sessioni_fuori_chiusura on sessioni;
create trigger sessioni_fuori_chiusura after update of stato on sessioni
  for each row when (old.stato = 'annullata' and new.stato <> 'annullata')
  execute function sessione_fuori_chiusura();

notify pgrst, 'reload schema';
