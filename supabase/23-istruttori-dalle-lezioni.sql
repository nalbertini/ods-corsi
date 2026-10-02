-- ---------------------------------------------------------------------------
-- ODS Corsi · la presenza degli istruttori, dall'appello e dalle lezioni
--
-- 15-presenze-istruttori.sql segna la presenza a chi mette il PIN sul tablet.
-- Qui si aggiungono due strade.
--
-- L'appello. Un istruttore che segna le presenze di una lezione (dall'app, o
-- dal tablet col suo PIN) quella lezione l'ha fatta: se era previsto la sua
-- presenza è confermata da sola, come col PIN; se non lo era va da
-- confermare. La segreteria che fa l'appello dal banco non si segna, a meno
-- che insegni anche e sia prevista su quella lezione.
--
-- Le lezioni tenute. Una lezione passata, non annullata, con almeno un
-- presente, in cui nessun istruttore ha una presenza (né col PIN né
-- dall'appello: ne basta uno, anche non previsto, e la lezione è coperta)
-- va proposta alla segreteria: con un istruttore
-- solo per confermarlo, con più d'uno per scegliere chi c'era. Chi non è
-- scelto si segna rifiutato, e la lezione esce dall'elenco. Si propongono
-- solo le lezioni da quando c'è questo file (`impostazioni.proposte_istruttori_dal`):
-- quelle di prima resterebbero a centinaia da decidere.
--
-- Si lancia dopo `15-presenze-istruttori.sql`. Crea funzioni, ma dice lei a
-- chi: non chiede di rilanciare `06-iscrizioni.sql`. Finché non c'è, PRESENZE
-- ISTRUTTORI non propone le lezioni e l'appello non segna l'istruttore.
-- ---------------------------------------------------------------------------

-- Come è arrivata una presenza: dal PIN, dall'appello, o scelta dalla segreteria.
alter table presenze_istruttori add column if not exists come text not null default 'pin';
do $$ begin
  alter table presenze_istruttori add constraint presenze_istruttori_come check (come in ('pin', 'appello', 'segreteria'));
exception when duplicate_object then null; end $$;

alter table impostazioni add column if not exists proposte_istruttori_dal timestamptz not null default now();

/** Chi doveva fare la lezione: il sostituto, se c'è; se no chi insegna il corso. */
create or replace function previsti_su(sessione uuid) returns uuid[]
  language sql stable security definer set search_path = public, extensions as $$
  select coalesce((
    select case
      when s.istruttore_id is not null and s.istruttore_id is distinct from c.istruttore_id then array[s.istruttore_id]
      else (select array_agg(distinct x) from unnest(array[c.istruttore_id] || array(select ci.persona_id from corsi_istruttori ci where ci.corso_id = c.id)) x where x is not null)
    end
    from sessioni s join corsi c on c.id = s.corso_id
    where s.id = sessione
  ), '{}')
$$;

/**
 * Dopo ogni segno dell'appello: chi l'ha segnato, se è un istruttore, quella
 * lezione l'ha fatta. Una da confermare di prima si conferma, se era previsto;
 * una rifiutata resta com'è, come col PIN.
 */
create or replace function istruttore_dall_appello() returns trigger
  language plpgsql security definer set search_path = public, extensions as $$
declare
  chi persone%rowtype;
  previsto boolean;
begin
  if new.segnata_da is null or new.origine <> 'appello' then return null; end if;
  select * into chi from persone where id = new.segnata_da;
  if not found or chi.ruolo = 'iscritto' then return null; end if;
  if exists (select 1 from sessioni where id = new.sessione_id and stato = 'annullata') then return null; end if;
  previsto := prevista_su(new.sessione_id, chi.id);
  -- La segreteria al banco fa l'appello di tutti: si segna solo se la lezione è sua.
  if chi.ruolo = 'staff' and not (chi.anche_istruttore and previsto) then return null; end if;
  insert into presenze_istruttori (sessione_id, persona_id, stato, prevista, come)
    values (new.sessione_id, chi.id, case when previsto then 'confermata' else 'da_confermare' end::stato_presenza_istruttore, previsto, 'appello')
    on conflict on constraint presenze_istruttori_sessione_id_persona_id_key do update
      set stato = 'confermata', prevista = true
      where presenze_istruttori.stato = 'da_confermare' and excluded.prevista;
  return null;
end $$;

-- `create or replace`, non `drop` e poi `create`: si rilancia uguale, e non c'è
-- un'istruzione distruttiva che lo strumento di Supabase si fermi a far confermare.
create or replace trigger presenze_istruttore_dall_appello after insert or update of stato on presenze
  for each row execute function istruttore_dall_appello();

/**
 * Le lezioni tenute in cui nessun istruttore ha una presenza, dalla più
 * recente: per ognuna i previsti (`stato` resta nel risultato, ed è sempre
 * vuoto). Solo la segreteria.
 */
create or replace function lezioni_senza_istruttore()
  returns table (sessione_id uuid, corso text, colore text, inizio timestamptz, fine timestamptz, sala text, presenti int, previsti jsonb)
  language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not e_staff() then raise exception 'le lezioni da confermare le vede la segreteria' using errcode = '42501'; end if;
  return query
    with tenute as (
      select s.id, c.nome, c.colore, s.inizio, s.fine, sa.nome as sala, previsti_su(s.id) as chi,
        (select count(*)::int from presenze p where p.sessione_id = s.id and p.stato = 'presente') as presenti
      from sessioni s join corsi c on c.id = s.corso_id
      left join ricorrenze ri on ri.id = s.ricorrenza_id
      left join sale sa on sa.id = coalesce(s.sala_id, ri.sala_id, c.sala_id)
      where s.stato <> 'annullata' and s.fine < now()
        and s.inizio >= (select proposte_istruttori_dal from impostazioni)
        and exists (select 1 from presenze p where p.sessione_id = s.id and p.stato = 'presente')
    )
    select t.id, t.nome, t.colore, t.inizio, t.fine, t.sala, t.presenti,
      (select jsonb_agg(jsonb_build_object('id', pe.id, 'nome', pe.nome, 'cognome', pe.cognome, 'stato', pi.stato) order by pe.nome, pe.cognome)
         from unnest(t.chi) x join persone pe on pe.id = x
         left join presenze_istruttori pi on pi.sessione_id = t.id and pi.persona_id = x)
    from tenute t
    where cardinality(t.chi) > 0
      and not exists (select 1 from presenze_istruttori pi where pi.sessione_id = t.id)
    order by t.inizio desc;
end $$;

/**
 * La segreteria dice chi, fra i previsti senza una presenza, ha fatto la
 * lezione: confermati loro, rifiutati gli altri. Chi una presenza ce l'ha già
 * resta com'è: si cambia da PRESENZE ISTRUTTORI.
 */
create or replace function segna_istruttori_lezione(sessione uuid, presenti uuid[]) returns void
  language plpgsql security definer set search_path = public, extensions as $$
begin
  if not e_staff() then raise exception 'la presenza la conferma la segreteria' using errcode = '42501'; end if;
  if not exists (select 1 from sessioni where id = sessione) then raise exception 'lezione inesistente' using errcode = 'P0002'; end if;
  if exists (select 1 from unnest(coalesce(presenti, '{}')) x where not x = any (previsti_su(sessione))) then
    raise exception 'si sceglie fra gli istruttori previsti' using errcode = '22023';
  end if;
  insert into presenze_istruttori (sessione_id, persona_id, stato, prevista, come, gestita_da, gestita_il)
    select sessione, x,
      case when x = any (coalesce(presenti, '{}')) then 'confermata' else 'rifiutata' end::stato_presenza_istruttore,
      true, 'segreteria', persona_corrente(), now()
    from unnest(previsti_su(sessione)) x
    on conflict on constraint presenze_istruttori_sessione_id_persona_id_key do nothing;
end $$;

revoke all on function previsti_su(uuid), istruttore_dall_appello() from public, anon, authenticated;
revoke all on function lezioni_senza_istruttore(), segna_istruttori_lezione(uuid, uuid[]) from public, anon;
grant execute on function lezioni_senza_istruttore(), segna_istruttori_lezione(uuid, uuid[]) to authenticated;

-- Che l'API veda subito colonne e funzioni nuove, senza aspettare.
notify pgrst, 'reload schema';
