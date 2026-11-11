-- ---------------------------------------------------------------------------
-- 142 · Il certificato dal link, senza password
--
-- Chi deve portare il certificato (termine in corso o passato, scaduto, in
-- scadenza) riceve un link `…/certificato/?l=<id>.<firma>` e lo carica da una
-- pagina sua, senza entrare. La firma è un HMAC dell'id col segreto della Edge
-- Function `certificato` (`LINK_SEGRETO`): qui c'è solo l'id, e un backup o una
-- lettura della tabella non danno link che si aprono.
--
-- Un link vale finché la persona è attiva, il certificato non è arrivato e non
-- sono passati 120 giorni da quando è nato. «Arrivato» è una data valida
-- scritta nella scheda (conferma, `salva_certificato`, a mano): il trigger
-- chiude i link. Il rifiuto non la scrive: lo stesso link torna buono. Il file
-- mandato dal link resta «in attesa» e non vale finché la segreteria non lo
-- conferma; la data dichiarata va in `certificato_in_attesa_scade`.
--
--   link_certificato                 nessuno: solo le funzioni qui sotto
--   link_certificato_per(persona)    la segreteria (la Edge Function, col suo
--                                    accesso), per il WhatsApp col link
--   link_certificato_apri(link)      service_role: la pagina, e segna l'apertura
--   link_manda_certificato(…)        service_role: il file in attesa, dal link
--   segna_sollecito_link(persona, link)  la segreteria: il WhatsApp col link
--   solleciti_di(persona)            la segreteria: la storia, con canale e apertura
--
-- Si lancia dopo `141-certificato-dopo.sql` e `87-solleciti-elenco.sql`. Non
-- chiede di rilanciare `06-iscrizioni.sql`.
-- Finché non c'è, il WhatsApp della scheda parte senza link e senza storia, e
-- la pagina del link dice che il link non vale.
-- ---------------------------------------------------------------------------

create table if not exists link_certificato (
  id         uuid primary key default gen_random_uuid(),
  persona_id uuid not null references persone on delete cascade,
  creato_il  timestamptz not null default now(),
  aperto_il  timestamptz,
  chiuso_il  timestamptz
);
create index if not exists link_certificato_persona on link_certificato (persona_id, creato_il desc);
alter table link_certificato enable row level security;
revoke all on link_certificato from public, anon, authenticated, service_role;

alter table schede_iscritti add column if not exists certificato_in_attesa_scade date;

alter table solleciti
  add column if not exists canale text not null default 'whatsapp',
  add column if not exists link_id uuid references link_certificato on delete set null;
alter table solleciti drop constraint if exists solleciti_canale_va;
alter table solleciti add constraint solleciti_canale_va check (canale in ('whatsapp', 'email'));

-- Vale: persona attiva, non chiuso, nato da meno di 120 giorni.
create or replace function link_vale(l link_certificato) returns boolean language sql stable set search_path = public as $$
  select l.chiuso_il is null and l.creato_il > now() - interval '120 days'
     and exists (select 1 from persone p where p.id = l.persona_id and p.attiva)
$$;

-- --- i trigger della scheda -----------------------------------------------------
-- Una data valida nella scheda: il certificato è arrivato, i link si chiudono.
create or replace function scheda_chiude_link() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.certificato_scade >= (now() at time zone 'Europe/Rome')::date
     and (tg_op = 'INSERT' or new.certificato_scade is distinct from old.certificato_scade) then
    update link_certificato set chiuso_il = now() where persona_id = new.persona_id and chiuso_il is null;
  end if;
  return null;
end $$;
drop trigger if exists schede_chiude_link on schede_iscritti;
create trigger schede_chiude_link after insert or update on schede_iscritti
  for each row execute function scheda_chiude_link();

-- La data dichiarata segue il file in attesa: un file nuovo (dall'area iscritti), la conferma o il rifiuto la tolgono.
create or replace function scheda_attesa_scade() returns trigger language plpgsql set search_path = public as $$
begin
  if new.certificato_in_attesa is null
     or (tg_op = 'UPDATE' and new.certificato_in_attesa is distinct from old.certificato_in_attesa) then
    new.certificato_in_attesa_scade := null;
  end if;
  return new;
end $$;
drop trigger if exists schede_attesa_scade on schede_iscritti;
create trigger schede_attesa_scade before insert or update on schede_iscritti
  for each row execute function scheda_attesa_scade();

-- --- la segreteria ----------------------------------------------------------------
create or replace function link_certificato_per(persona uuid) returns uuid
  language plpgsql volatile security definer set search_path = public, extensions as $$
declare l uuid;
begin
  if not e_staff() then raise exception 'il link lo chiede la segreteria' using errcode = '42501'; end if;
  if not exists (select 1 from persone where id = persona and ruolo::text = 'iscritto' and attiva) then
    raise exception 'la scheda non c''è o è disattivata' using errcode = 'P0002';
  end if;
  -- Lo stesso link in tutti i solleciti, finché vale.
  select k.id into l from link_certificato k where k.persona_id = persona and link_vale(k) order by k.creato_il desc limit 1;
  if l is null then insert into link_certificato (persona_id) values (persona) returning id into l; end if;
  return l;
end $$;

-- Il sollecito su WhatsApp col link: come `segna_sollecito` (85), che resta com'era, più il link della persona.
create or replace function segna_sollecito_link(persona uuid, link uuid) returns timestamptz
  language plpgsql volatile security definer set search_path = public, extensions as $$
declare quando timestamptz;
begin
  if not e_staff() then raise exception 'i solleciti li segna la segreteria' using errcode = '42501'; end if;
  if not exists (select 1 from persone where id = segna_sollecito_link.persona and attiva) then
    raise exception 'la scheda non c''è o è disattivata' using errcode = 'P0002';
  end if;
  if link is null or not exists (select 1 from link_certificato where id = link and persona_id = segna_sollecito_link.persona) then
    raise exception 'Il link non è di questa persona' using errcode = '22023';
  end if;
  insert into solleciti (persona_id, creato_da, canale, link_id) values (segna_sollecito_link.persona, persona_corrente(), 'whatsapp', link)
    returning creato_il into quando;
  return quando;
end $$;

create or replace function solleciti_di(persona uuid)
  returns table (creato_il timestamptz, da text, canale text, con_link boolean, aperto_il timestamptz)
  language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not e_staff() then raise exception 'i solleciti li vede la segreteria' using errcode = '42501'; end if;
  return query
    select s.creato_il, coalesce(trim(p.nome || ' ' || p.cognome), ''), s.canale, s.link_id is not null,
           -- L'apertura è l'ultima: prima del sollecito non è merito suo.
           case when k.aperto_il >= s.creato_il then k.aperto_il end
      from solleciti s
      left join persone p on p.id = s.creato_da
      left join link_certificato k on k.id = s.link_id
     where s.persona_id = solleciti_di.persona
     order by s.creato_il desc;
end $$;

-- --- la pagina del link (la Edge Function, con la chiave di servizio) --------------
create or replace function link_certificato_apri(link uuid)
  returns table (persona_id uuid, stato text, nome text, iniziale text, tipo text, entro date)
  language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  k link_certificato;
  p persone;
  oggi date := (now() at time zone 'Europe/Rome')::date;
  nato date;
begin
  select * into k from link_certificato where id = link;
  select * into p from persone where id = k.persona_id;
  -- Niente nome per un link che non vale: non si conferma che la persona c'è.
  if k.id is null or not p.attiva or k.creato_il <= now() - interval '120 days' then
    return query select null::uuid, 'non_vale'::text, null::text, null::text, null::text, null::date;
    return;
  end if;
  if k.chiuso_il is not null then
    return query select p.id, 'arrivato'::text, p.nome, upper(left(p.cognome, 1)), null::text, null::date;
    return;
  end if;
  update link_certificato set aperto_il = now() where id = k.id;
  nato := chat_nato_il(p.id);
  return query select p.id, 'valido'::text, p.nome, upper(left(p.cognome, 1)),
    case when nato is not null and nato <= (oggi - interval '12 years')::date and exists (
           select 1 from iscrizioni i join corsi c on c.id = i.corso_id
            where i.persona_id = p.id and c.attivo and i.dal <= oggi and (i.al is null or i.al >= oggi)
              and c.nome ~* '\m(judo|aikido|lotta)\M')
         then 'agonistico' else 'normale' end,
    certificato_termine(p.id);
end $$;

create or replace function link_manda_certificato(link uuid, file text, scade date) returns void
  language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  k link_certificato;
  vecchio text;
  oggi date := (now() at time zone 'Europe/Rome')::date;
begin
  select * into k from link_certificato where id = link;
  if k.id is null or not link_vale(k) then raise exception 'Questo link non vale più' using errcode = '42501'; end if;
  -- Solo un `attesa-N` della persona del link, come `iscritto_manda_certificato`.
  if file is null or file !~ ('^' || k.persona_id::text || '/attesa-[0-9]+\.(jpg|jpeg|png|pdf)$') then
    raise exception 'Il file non è di questa persona' using errcode = '22023';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'certificati' and name = file) then
    raise exception 'Il file non è arrivato: riprova' using errcode = '22023';
  end if;
  if scade is null then raise exception 'Scrivi quando scade il certificato.' using errcode = '22023'; end if;
  if scade < oggi then raise exception 'Questo certificato è già scaduto: serve quello nuovo.' using errcode = '22023'; end if;
  if scade > (oggi + interval '3 years')::date then raise exception 'La data è troppo lontana: controlla l’anno.' using errcode = '22023'; end if;
  select certificato_in_attesa into vecchio from schede_iscritti where persona_id = k.persona_id;
  insert into schede_iscritti (persona_id, certificato_in_attesa, certificato_in_attesa_il) values (k.persona_id, file, now())
    on conflict (persona_id) do update set certificato_in_attesa = excluded.certificato_in_attesa, certificato_in_attesa_il = excluded.certificato_in_attesa_il;
  -- Dopo il file: il trigger toglie la data quando il file cambia.
  update schede_iscritti set certificato_in_attesa_scade = scade where persona_id = k.persona_id;
  if vecchio is not null and vecchio <> file then
    perform set_config('storage.allow_delete_query', 'true', true);
    delete from storage.objects where bucket_id = 'certificati' and name = vecchio;
  end if;
end $$;

revoke all on function link_vale(link_certificato), scheda_chiude_link(), scheda_attesa_scade() from public, anon, authenticated;
revoke all on function link_certificato_per(uuid), segna_sollecito_link(uuid, uuid), solleciti_di(uuid) from public, anon;
grant execute on function link_certificato_per(uuid), segna_sollecito_link(uuid, uuid), solleciti_di(uuid) to authenticated;
revoke all on function link_certificato_apri(uuid), link_manda_certificato(uuid, text, date) from public, anon, authenticated;
grant execute on function link_certificato_apri(uuid), link_manda_certificato(uuid, text, date) to service_role;

notify pgrst, 'reload schema';
