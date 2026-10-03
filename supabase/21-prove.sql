-- ---------------------------------------------------------------------------
-- ODS Corsi · le prove: chi viene a provare una lezione
--
-- Chi non è iscritto viene a provare una lezione (3 €) o una settimana di
-- sport (10 €, vedi `PROVA` in src/lib/iscrizione.ts). Spesso arriva dopo le
-- cinque, quando la segreteria è in sala a fare lezione: per questo la prova
-- la aggiunge all'appello chi lo sta facendo, l'istruttore dall'app o dal
-- tablet col PIN, e la segreteria dalla lezione aperta nella settimana.
--
-- Una prova è una persona nell'appello di una lezione senza esserne
-- iscritta. La persona è una riga di `persone` come le altre (ruolo
-- `iscritto`, con nome, cognome e telefono): chi è già venuto a provare si
-- ritrova per nome e si aggiunge a un'altra lezione, che è come si fa una
-- settimana di prova; e quando si iscrive la segreteria ha già la sua scheda.
-- Chi aggiunge una prova la segna anche presente: è lì.
--
-- Si scrive solo da queste funzioni, mai dalla tabella: una prova crea una
-- persona, e `persone` la scrive solo la segreteria (02-policy.sql). Come per
-- le presenze (02-policy.sql), la può aggiungere qualunque istruttore, non
-- solo quello della lezione: chi l'ha fatto resta scritto in `aggiunta_da`.
--
-- Il tablet le chiama col PIN, come l'appello (04-tablet.sql): l'elenco da
-- toccare per segnarsi da sé resta degli iscritti.
--
-- Il telefono di chi è venuto a provare serve a chi lo richiama, la
-- segreteria: all'istruttore per ritrovarlo bastano corso e giorno, e il suo
-- telefono personale gira fra i bambini. È lo schermo, non ancora il confine:
-- `persone_legge` (02-policy.sql) lascia al personale tutta l'anagrafica,
-- telefono compreso. Chi l'aveva già lanciato lo rilancia:
-- la prima versione dava il telefono a tutto il personale.
--
-- Si lancia dopo `04-tablet.sql`. Crea funzioni, ma dice lei a chi: non
-- chiede di rilanciare `06-iscrizioni.sql`. Finché non c'è, l'appello si fa
-- come prima, e il tasto PROVE dice che va lanciato.
-- ---------------------------------------------------------------------------

create table if not exists prove (
  id            uuid primary key default gen_random_uuid(),
  sessione_id   uuid not null references sessioni on delete cascade,
  persona_id    uuid not null references persone on delete cascade,
  aggiunta_da   uuid references persone on delete set null,
  postazione_id uuid references postazioni on delete set null,
  aggiunta_il   timestamptz not null default now(),
  -- La persona è nata con questa prova: se la si toglie per sbaglio, e non
  -- ha nient'altro, se ne va anche lei (vedi `togli_prova_da`).
  nuova         boolean not null default false,
  unique (sessione_id, persona_id)
);
create index if not exists prove_persona on prove (persona_id);
create index if not exists prove_quando on prove (aggiunta_il);

alter table prove enable row level security;

-- La legge chi lavora in palestra, come le presenze. Scrivono solo le funzioni.
drop policy if exists prove_legge on prove;
create policy prove_legge on prove for select to authenticated using (e_personale());

revoke all on prove from anon, authenticated;
grant select on prove to authenticated;

/**
 * Il cuore di tutte e due le strade, l'app e il tablet: chi chiama ha già
 * controllato chi è (`chi`) e da dove (`postazione`).
 *
 * Con `persona` di qualcuno che c'è già, aggiunge lui; se no la crea con
 * quell'id, così l'app che la aggiunge senza rete sa già come chiamarla, e
 * rimandarla due volte non fa due persone. Restituisce l'id.
 */
create or replace function metti_prova(sessione uuid, persona uuid, nome text, cognome text, telefono text,
                                       chi uuid, postazione uuid)
  returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  l record;
  c record;
  nuova boolean := false;
begin
  select s.stato, s.corso_id, (s.inizio at time zone 'Europe/Rome')::date as giorno into l from sessioni s where s.id = sessione;
  -- 23503 e non P0002: dalla coda dell'app, un errore così non si riprova.
  if not found then raise exception 'lezione inesistente' using errcode = '23503'; end if;
  if l.stato = 'annullata' then raise exception 'lezione annullata' using errcode = '42501'; end if;

  select pe.ruolo, pe.attiva into c from persone pe where pe.id = persona;
  if found then
    -- Una prova è di chi non è del personale: il PIN e l'accesso non c'entrano.
    if c.ruolo <> 'iscritto' then raise exception 'una prova è per chi viene ad allenarsi' using errcode = '42501'; end if;
    if not c.attiva then raise exception 'questa persona è disattivata: la riattiva la segreteria' using errcode = '42501'; end if;
    if exists (
      select 1 from iscrizioni i where i.corso_id = l.corso_id and i.persona_id = persona
        and i.dal <= l.giorno and (i.al is null or i.al >= l.giorno)
    ) then
      raise exception 'è già iscritto a questo corso: è nell''appello' using errcode = '42501';
    end if;
  else
    nome := btrim(coalesce(nome, ''));
    cognome := btrim(coalesce(cognome, ''));
    telefono := nullif(btrim(coalesce(telefono, '')), '');
    if nome = '' or cognome = '' then raise exception 'servono nome e cognome' using errcode = '22023'; end if;
    if length(nome) > 80 or length(cognome) > 80 then raise exception 'nome o cognome troppo lungo' using errcode = '22023'; end if;
    if telefono is not null and telefono !~ '^\+?[0-9 ./-]{6,20}$' then
      raise exception 'il telefono non sembra un numero' using errcode = '22023';
    end if;
    insert into persone (id, nome, cognome, telefono, ruolo) values (persona, nome, cognome, telefono, 'iscritto');
    nuova := true;
  end if;

  insert into prove (sessione_id, persona_id, aggiunta_da, postazione_id, nuova)
    values (sessione, persona, chi, postazione, nuova)
    on conflict (sessione_id, persona_id) do nothing;
  -- È in sala: presente. Un segno che c'è già (un tocco dopo) resta com'è.
  insert into presenze (sessione_id, persona_id, stato, origine, segnata_da, postazione_id)
    values (sessione, persona, 'presente', 'appello', chi, postazione)
    on conflict (sessione_id, persona_id) do nothing;
  return persona;
end $$;

/**
 * Toglie una prova messa per sbaglio, col suo segno. Se è un iscritto del
 * corso il segno resta: è nell'appello comunque. La persona nata con questa
 * prova se ne va con lei, se non ha nient'altro: un nome scritto male non
 * resta fra gli iscritti della segreteria.
 */
create or replace function togli_prova_da(sessione uuid, persona uuid)
  returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  era_nuova boolean;
  l record;
  resta boolean;
begin
  delete from prove where sessione_id = sessione and persona_id = persona returning nuova into era_nuova;
  if not found then return; end if;
  select s.corso_id, (s.inizio at time zone 'Europe/Rome')::date as giorno into l from sessioni s where s.id = sessione;
  if not exists (
    select 1 from iscrizioni i where i.corso_id = l.corso_id and i.persona_id = persona
      and i.dal <= l.giorno and (i.al is null or i.al >= l.giorno)
  ) then
    delete from presenze where sessione_id = sessione and persona_id = persona;
  end if;
  if not era_nuova then return; end if;
  resta := exists (select 1 from prove where persona_id = persona)
    or exists (select 1 from iscrizioni where persona_id = persona)
    or exists (select 1 from presenze where persona_id = persona)
    or exists (select 1 from persone where id = persona and utente_id is not null);
  -- Le ricevute ci sono solo con 16-ricevute.sql, e una ricevuta fatta non si perde.
  if not resta and to_regclass('public.ricevute') is not null then
    execute 'select exists (select 1 from ricevute where persona_id = $1)' into resta using persona;
  end if;
  if not resta then delete from persone where id = persona and ruolo = 'iscritto'; end if;
end $$;

/**
 * Chi è già venuto a provare, dal più recente: per ritrovarlo per nome e
 * aggiungerlo a un'altra lezione. Gli ultimi novanta giorni bastano: dopo,
 * o si è iscritto o non torna, e un nome nuovo si scrive in un attimo.
 */
create or replace function gia_provati(con_telefono boolean)
  returns table (persona_id uuid, nome text, cognome text, telefono text, corso text, inizio timestamptz)
  language sql stable security definer set search_path = public, extensions as $$
  select distinct on (pe.id) pe.id, pe.nome, pe.cognome, case when con_telefono then pe.telefono end, c.nome, s.inizio
  from prove p
  join persone pe on pe.id = p.persona_id
  join sessioni s on s.id = p.sessione_id
  join corsi c on c.id = s.corso_id
  where pe.attiva and s.inizio >= now() - interval '90 days'
  order by pe.id, s.inizio desc
$$;

-- --- dall'app: l'istruttore e la segreteria, col loro accesso ---------------

create or replace function aggiungi_prova(sessione uuid, persona uuid, nome text default null,
                                          cognome text default null, telefono text default null)
  returns uuid language plpgsql security definer set search_path = public, extensions as $$
begin
  if not e_personale() then raise exception 'le prove le aggiunge chi fa l''appello' using errcode = '42501'; end if;
  return metti_prova(sessione, persona, nome, cognome, telefono, persona_corrente(), null);
end $$;

create or replace function togli_prova(sessione uuid, persona uuid)
  returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not e_personale() then raise exception 'le prove le toglie chi fa l''appello' using errcode = '42501'; end if;
  perform togli_prova_da(sessione, persona);
end $$;

create or replace function prove_recenti()
  returns table (persona_id uuid, nome text, cognome text, telefono text, corso text, inizio timestamptz)
  language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not e_personale() then raise exception 'le prove le vede chi fa l''appello' using errcode = '42501'; end if;
  -- Il telefono solo alla segreteria, anche quando insegna: è lei che richiama.
  return query select * from gia_provati(e_staff());
end $$;

-- --- dal tablet, col PIN: come l'appello di 04-tablet.sql -------------------
-- Un PIN sbagliato non solleva, per la ragione scritta in `appello_con_pin`.

/** Le prove di una lezione della sala, con il loro segno. */
create or replace function prove_con_pin(pin text, sessione uuid)
  returns table (persona_id uuid, nome text, cognome text, stato stato_presenza, origine origine_presenza)
  language plpgsql security definer set search_path = public, extensions as $$
declare
  chi uuid;
  l record;
begin
  select * into l from lezione_del_tablet(sessione);
  chi := persona_da_pin(pin);
  if chi is null then return; end if;
  return query
    select pe.id, pe.nome, pe.cognome, pr.stato, pr.origine
    from prove p join persone pe on pe.id = p.persona_id
    left join presenze pr on pr.sessione_id = sessione and pr.persona_id = pe.id
    where p.sessione_id = sessione
    order by pe.cognome, pe.nome;
end $$;

/** Chi è già venuto a provare, per l'istruttore sul tablet: il telefono no, lo schermo è in sala. */
create or replace function provati_con_pin(pin text)
  returns table (persona_id uuid, nome text, cognome text, telefono text, corso text, inizio timestamptz)
  language plpgsql security definer set search_path = public, extensions as $$
begin
  if postazione_corrente() is null then raise exception 'solo un tablet di sala' using errcode = '42501'; end if;
  if persona_da_pin(pin) is null then return; end if;
  return query select * from gia_provati(false);
end $$;

/** `true` se è aggiunta, `false` se il PIN non va più. */
create or replace function aggiungi_prova_con_pin(pin text, sessione uuid, persona uuid, nome text default null,
                                                  cognome text default null, telefono text default null)
  returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare
  chi uuid;
  l record;
begin
  select * into l from lezione_del_tablet(sessione);
  chi := persona_da_pin(pin);
  if chi is null then return false; end if;
  perform metti_prova(sessione, persona, nome, cognome, telefono, chi, l.postazione);
  return true;
end $$;

create or replace function togli_prova_con_pin(pin text, sessione uuid, persona uuid)
  returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare
  chi uuid;
  l record;
begin
  select * into l from lezione_del_tablet(sessione);
  chi := persona_da_pin(pin);
  if chi is null then return false; end if;
  perform togli_prova_da(sessione, persona);
  return true;
end $$;

/**
 * Il tocco su una prova, dal tablet: come `segna_con_pin`, che invece vuole
 * un iscritto del corso.
 */
create or replace function segna_prova_con_pin(pin text, sessione uuid, persona uuid, stato stato_presenza)
  returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare
  chi uuid;
  l record;
begin
  select * into l from lezione_del_tablet(sessione);
  chi := persona_da_pin(pin);
  if chi is null then return false; end if;
  if not exists (select 1 from prove p where p.sessione_id = sessione and p.persona_id = persona) then
    raise exception 'non è fra le prove di questa lezione' using errcode = '42501';
  end if;
  if stato is null then raise exception 'una prova si segna presente o assente' using errcode = '22023'; end if;
  insert into presenze (sessione_id, persona_id, stato, origine, segnata_da, postazione_id)
    values (sessione, persona, stato, 'appello', chi, l.postazione)
    on conflict (sessione_id, persona_id) do update
      set stato = excluded.stato, origine = 'appello', segnata_da = excluded.segnata_da, postazione_id = excluded.postazione_id;
  return true;
end $$;

-- ---------------------------------------------------------------------------
-- Chi può chiamare cosa. Quelle interne non le chiama nessuno da fuori.
-- ---------------------------------------------------------------------------
revoke all on function metti_prova(uuid, uuid, text, text, text, uuid, uuid), togli_prova_da(uuid, uuid),
  gia_provati(boolean) from public, anon, authenticated;
revoke all on function aggiungi_prova(uuid, uuid, text, text, text), togli_prova(uuid, uuid), prove_recenti(),
  prove_con_pin(text, uuid), provati_con_pin(text), aggiungi_prova_con_pin(text, uuid, uuid, text, text, text),
  togli_prova_con_pin(text, uuid, uuid), segna_prova_con_pin(text, uuid, uuid, stato_presenza) from public, anon;
grant execute on function aggiungi_prova(uuid, uuid, text, text, text), togli_prova(uuid, uuid), prove_recenti(),
  prove_con_pin(text, uuid), provati_con_pin(text), aggiungi_prova_con_pin(text, uuid, uuid, text, text, text),
  togli_prova_con_pin(text, uuid, uuid), segna_prova_con_pin(text, uuid, uuid, stato_presenza) to authenticated;

-- Che l'API veda subito tabella e funzioni nuove, senza aspettare.
notify pgrst, 'reload schema';
