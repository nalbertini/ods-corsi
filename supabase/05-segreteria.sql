-- ---------------------------------------------------------------------------
-- ODS Corsi · la segreteria
--
-- Quello che la segreteria fa dall'app lo fa quasi tutto con le policy di
-- `02-policy.sql`: legge tutto e scrive tutto. Qui ci sono le cose che una
-- scrittura sola non basta a fare bene, e che non si possono lasciare al
-- browser perché devono valere anche per chi scrive dal SQL Editor:
--
--   · un corso cambia sala o istruttore → le lezioni future lo seguono, tranne
--     quelle cambiate una per una (una sostituzione resta una sostituzione);
--   · un corso si archivia → le lezioni future senza appello spariscono;
--   · un giorno si toglie da un corso → la ricorrenza si chiude, e le lezioni
--     con un appello restano dove sono;
--   · al primo accesso la persona si lega al suo account, per email.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Il corso cambia: le lezioni future lo seguono.
--
-- Una lezione «segue il corso» quando ha ancora la sala e l'istruttore che il
-- corso aveva prima: quella con un sostituto, o spostata in un'altra sala per
-- un giorno, è stata decisa a mano e resta com'è. Le lezioni passate non si
-- toccano mai: sono quello che è successo.
-- ---------------------------------------------------------------------------
create or replace function corso_cambiato() returns trigger
  language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.sala_id is distinct from old.sala_id then
    update sessioni set sala_id = new.sala_id
      where corso_id = new.id and inizio > now() and sala_id is not distinct from old.sala_id;
  end if;
  if new.istruttore_id is distinct from old.istruttore_id then
    update sessioni set istruttore_id = new.istruttore_id
      where corso_id = new.id and inizio > now() and istruttore_id is not distinct from old.istruttore_id;
  end if;
  -- Archiviato: via le lezioni future che nessuno ha ancora toccato.
  if old.attivo and not new.attivo then
    delete from sessioni s
      where s.corso_id = new.id and s.inizio > now()
        and not exists (select 1 from presenze p where p.sessione_id = s.id);
  end if;
  return new;
end $$;

drop trigger if exists corsi_cambiati on corsi;
create trigger corsi_cambiati after update on corsi
  for each row execute function corso_cambiato();

-- ---------------------------------------------------------------------------
-- Togliere un giorno a un corso.
--
-- La ricorrenza non si cancella: si chiude a ieri, così le lezioni già fatte
-- restano legate a lei e il registro non perde il suo «martedì alle 19».
-- Se non è ancora cominciata non ha niente da ricordare, e allora sparisce.
-- Le lezioni future senza appello se ne vanno con lei.
-- ---------------------------------------------------------------------------
create or replace function chiudi_ricorrenza(ricorrenza uuid)
  returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  r record;
  oggi date := (now() at time zone 'Europe/Rome')::date;
begin
  if auth.uid() is not null and not e_staff() then
    raise exception 'solo la segreteria cambia gli orari dei corsi' using errcode = '42501';
  end if;
  select * into r from ricorrenze where id = ricorrenza;
  if r.id is null then raise exception 'ricorrenza inesistente' using errcode = 'P0002'; end if;

  delete from sessioni s
    where s.ricorrenza_id = ricorrenza and s.inizio > now()
      and not exists (select 1 from presenze p where p.sessione_id = s.id);

  if r.dal >= oggi and not exists (select 1 from sessioni where ricorrenza_id = ricorrenza) then
    delete from ricorrenze where id = ricorrenza;
  else
    update ricorrenze set al = greatest(dal, oggi - 1) where id = ricorrenza;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Fin dove arriva il calendario: la lezione più lontana già generata.
-- ---------------------------------------------------------------------------
create or replace function calendario_pronto_fino() returns date
  language sql stable set search_path = public, extensions as $$
  select (max(inizio) at time zone 'Europe/Rome')::date from sessioni
$$;

-- ---------------------------------------------------------------------------
-- Quanto viene ciascuno, negli ultimi giorni.
--
-- Per ogni iscritto: a quante lezioni dei suoi corsi avrebbe potuto esserci
-- (già fatte, non annullate, mentre era iscritto) e a quante c'era. I
-- giustificati non contano né fra i presenti né fra le lezioni dovute.
-- Gira con i permessi di chi chiama: la segreteria vede tutti, gli altri
-- quello che le policy lasciano.
-- ---------------------------------------------------------------------------
create or replace function frequenze(giorni int default 30)
  returns table (persona_id uuid, presenti int, dovute int)
  language sql stable security invoker set search_path = public, extensions as $$
  select i.persona_id,
    count(*) filter (where p.stato = 'presente')::int,
    count(*) filter (where p.stato is distinct from 'giustificato')::int
  from iscrizioni i
  join sessioni s on s.corso_id = i.corso_id
    and s.stato <> 'annullata'
    and s.inizio < now() and s.inizio >= now() - make_interval(days => giorni)
    and (s.inizio at time zone 'Europe/Rome')::date >= i.dal
    and (i.al is null or (s.inizio at time zone 'Europe/Rome')::date <= i.al)
  left join presenze p on p.sessione_id = s.id and p.persona_id = i.persona_id
  group by i.persona_id
$$;

-- ---------------------------------------------------------------------------
-- Il primo accesso.
--
-- La segreteria mette in `persone` nome, cognome ed email di chi lavora in
-- palestra; la persona riceve il link, entra, e qui si lega al suo account.
-- Solo per istruttori e segreteria, e solo se quella persona non ha già un
-- account: un'email scritta per sbaglio non ruba l'anagrafica di un altro.
-- ---------------------------------------------------------------------------
create or replace function collega_utente()
  returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  chi uuid;
  mail citext;
begin
  if auth.uid() is null then return null; end if;
  select id into chi from persone where utente_id = auth.uid();
  if chi is not null then return chi; end if;
  select email into mail from auth.users where id = auth.uid();
  update persone set utente_id = auth.uid()
    where email = mail and utente_id is null and attiva and ruolo in ('istruttore', 'staff')
    returning id into chi;
  return chi;
end $$;

revoke all on function chiudi_ricorrenza(uuid), calendario_pronto_fino(), frequenze(int), collega_utente() from public, anon;
grant execute on function chiudi_ricorrenza(uuid), calendario_pronto_fino(), frequenze(int), collega_utente() to authenticated;

-- ---------------------------------------------------------------------------
-- Le regole della palestra: per quanto si tengono le presenze e fin dove si
-- prepara il calendario. Sono scelte della palestra, non del codice, e la
-- segreteria le cambia da REGOLE E PRIVACY. Una riga sola.
-- ---------------------------------------------------------------------------
create table if not exists impostazioni (
  id                boolean primary key default true check (id),
  mesi_presenze     int not null default 24 check (mesi_presenze between 1 and 120),
  giorni_calendario int not null default 60 check (giorni_calendario between 7 and 400)
);
insert into impostazioni default values on conflict do nothing;

alter table impostazioni enable row level security;
drop policy if exists impostazioni_legge on impostazioni;
drop policy if exists impostazioni_aggiorna on impostazioni;
create policy impostazioni_legge on impostazioni for select to authenticated using (true);
create policy impostazioni_aggiorna on impostazioni for update to authenticated using (e_staff()) with check (e_staff());
grant select, update on impostazioni to authenticated;
revoke all on impostazioni from anon;

-- La vista di `01-schema.sql`, che ora legge il periodo dalle impostazioni
-- invece di tenerlo scritto dentro. Rilanciare `01-schema.sql` da solo la
-- rimetterebbe a ventiquattro mesi fissi: i file vanno lanciati in ordine.
create or replace view presenze_scadute with (security_invoker = true) as
  select p.* from presenze p
  join sessioni s on s.id = p.sessione_id
  where s.inizio < now() - make_interval(months => coalesce((select mesi_presenze from impostazioni), 24));

-- ---------------------------------------------------------------------------
-- Chi ha il PIN del tablet. Il PIN no, quello non esce mai: solo il sì o il no.
-- ---------------------------------------------------------------------------
create or replace function pin_impostati()
  returns table (persona_id uuid) language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not e_staff() then raise exception 'solo la segreteria' using errcode = '42501'; end if;
  return query select pi.persona_id from pin_istruttori pi;
end $$;

revoke all on function pin_impostati() from public, anon;
grant execute on function pin_impostati() to authenticated;

-- Che l'API veda subito funzioni e tabelle nuove, senza aspettare.
notify pgrst, 'reload schema';
