-- ---------------------------------------------------------------------------
-- ODS Corsi · il tablet di sala
--
-- Si applica dopo 03-funzioni.sql, ed è rilanciabile come gli altri.
--
-- Il tablet appeso al muro ha un suo utente (una riga in `postazioni`) e non
-- legge nessuna tabella con dentro delle persone: le policy di 02-policy.sql
-- non gliele lasciano vedere. Tutto quello che fa passa da queste funzioni,
-- che girano con i privilegi del proprietario e per questo controllano a mano,
-- una per una, sala, orario e iscrizione. È la ragione per cui qui ogni
-- controllo è scritto per esteso: non c'è una policy dietro a coprire una
-- dimenticanza.
--
-- Due regole di fondo:
--   · il tablet vede nome e iniziale, mai il cognome intero, perché lo schermo
--     è pubblico e tanti iscritti sono minori;
--   · il tablet non scavalca mai l'istruttore: una presenza decisa all'appello
--     resta com'è.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- I PIN degli istruttori, per l'area istruttore del tablet.
--
-- Mai in chiaro: bcrypt, con `crypt()` di pgcrypto. Nessuno legge queste
-- tabelle direttamente, nemmeno la segreteria: RLS attivo e nessuna policy.
-- ---------------------------------------------------------------------------
create table if not exists pin_istruttori (
  persona_id  uuid primary key references persone on delete cascade,
  hash        text not null,
  cambiato_il timestamptz not null default now()
);
create table if not exists tentativi_pin (
  postazione_id uuid not null references postazioni on delete cascade,
  quando        timestamptz not null default now(),
  riuscito      boolean not null
);
create index if not exists tentativi_pin_quando on tentativi_pin (postazione_id, quando);
alter table pin_istruttori enable row level security;
alter table tentativi_pin  enable row level security;
revoke all on pin_istruttori, tentativi_pin from authenticated, anon;

-- ---------------------------------------------------------------------------
-- Le finestre di tempo. Stanno qui, in un posto solo, perché sono scelte della
-- palestra e non del codice.
--   · ci si segna da 30 minuti prima dell'inizio a 10 minuti dopo;
--   · chi se n'è dimenticato recupera fino a 14 giorni indietro;
--   · un tocco sbagliato si annulla entro 2 minuti;
--   · dopo 5 PIN sbagliati in 5 minuti il tablet aspetta.
-- ---------------------------------------------------------------------------
create or replace function tablet_regole(out prima interval, out dopo interval, out recupero interval,
                                         out annulla interval, out pin_tentativi int, out pin_blocco interval)
  language sql immutable as $$
  select interval '30 minutes', interval '10 minutes', interval '14 days', interval '2 minutes', 5, interval '5 minutes'
$$;

/** La postazione di chi chiama, se chi chiama è un tablet attivo. */
create or replace function postazione_corrente() returns uuid
  language sql stable security definer set search_path = public as $$
  select id from postazioni where utente_id = auth.uid() and attiva
$$;

/** Una lezione, con la sala in cui si fa davvero: la sua, o quella del corso. */
create or replace function sessione_in_sala(sessione uuid)
  returns table (id uuid, corso_id uuid, inizio timestamptz, fine timestamptz, stato stato_sessione, sala_id uuid)
  language sql stable security definer set search_path = public as $$
  select s.id, s.corso_id, s.inizio, s.fine, s.stato, coalesce(s.sala_id, c.sala_id)
  from sessioni s join corsi c on c.id = s.corso_id
  where s.id = sessione
$$;

/**
 * Controlla che chi chiama sia un tablet e che la lezione sia della sua sala.
 * Restituisce la lezione; solleva un errore altrimenti.
 */
create or replace function lezione_del_tablet(sessione uuid, out postazione uuid, out corso uuid,
                                              out inizio timestamptz, out stato stato_sessione)
  language plpgsql stable security definer set search_path = public as $$
declare
  sala_tablet uuid;
  l record;
begin
  postazione := postazione_corrente();
  if postazione is null then raise exception 'solo un tablet di sala' using errcode = '42501'; end if;
  select sala_id into sala_tablet from postazioni where id = postazione;
  select * into l from sessione_in_sala(sessione);
  if l.id is null then raise exception 'lezione inesistente' using errcode = 'P0002'; end if;
  if l.sala_id is distinct from sala_tablet then raise exception 'lezione di un''altra sala' using errcode = '42501'; end if;
  corso := l.corso_id; inizio := l.inizio; stato := l.stato;
end $$;

-- ---------------------------------------------------------------------------
-- Il calendario della sala.
--
-- Le lezioni del tablet fra due giorni, con quanti iscritti e quanti già
-- presenti: il tablet non può contarli da sé, perché iscrizioni e presenze
-- non le legge.
-- ---------------------------------------------------------------------------
create or replace function lezioni_sala(da_giorno date, a_giorno date)
  returns table (id uuid, corso_id uuid, corso text, colore text, descrizione text, istruttori text,
                 inizio timestamptz, fine timestamptz, stato stato_sessione, iscritti int, presenti int)
  language plpgsql stable security definer set search_path = public as $$
declare
  p uuid := postazione_corrente();
  sala uuid;
begin
  if p is null then raise exception 'solo un tablet di sala' using errcode = '42501'; end if;
  if a_giorno < da_giorno or a_giorno - da_giorno > 31 then raise exception 'intervallo non valido: % → %', da_giorno, a_giorno; end if;
  select sala_id into sala from postazioni where postazioni.id = p;
  return query
    select s.id, s.corso_id, c.nome, c.colore, c.descrizione,
      -- chi la fa: il sostituto se c'è, altrimenti chi insegna il corso
      coalesce(
        case when s.istruttore_id is distinct from c.istruttore_id then (select nome from persone where persone.id = s.istruttore_id) end,
        (select string_agg(pe.nome, ', ' order by pe.nome) from corsi_istruttori ci join persone pe on pe.id = ci.persona_id where ci.corso_id = c.id),
        (select nome from persone where persone.id = c.istruttore_id)
      ),
      s.inizio, s.fine, s.stato,
      (select count(*)::int from iscrizioni i where i.corso_id = s.corso_id
         and i.dal <= (s.inizio at time zone 'Europe/Rome')::date and (i.al is null or i.al >= (s.inizio at time zone 'Europe/Rome')::date)),
      (select count(*)::int from presenze pr where pr.sessione_id = s.id and pr.stato = 'presente')
    from sessioni s join corsi c on c.id = s.corso_id
    where coalesce(s.sala_id, c.sala_id) = sala
      and s.inizio >= (da_giorno::timestamp at time zone 'Europe/Rome')
      and s.inizio < ((a_giorno + 1)::timestamp at time zone 'Europe/Rome')
    order by s.inizio, c.nome;
end $$;

-- ---------------------------------------------------------------------------
-- L'elenco da toccare: nome, sigla del cognome, già segnato o no.
--
-- La sigla è l'iniziale; quando due iscritti avrebbero lo stesso «Giulia F.»
-- diventa di tre lettere. Il cognome intero non esce: nemmeno chiamando l'API
-- a mano, perché non è fra le colonne restituite.
-- ---------------------------------------------------------------------------
create or replace function elenco_sala(sessione uuid)
  returns table (persona_id uuid, nome text, sigla text, segnato boolean)
  language plpgsql stable security definer set search_path = public as $$
declare
  l record;
  r record;
begin
  select * into r from tablet_regole();
  select * into l from lezione_del_tablet(sessione);
  if l.inizio < now() - r.recupero or l.inizio > now() + r.prima then
    raise exception 'lezione fuori dalla finestra del tablet' using errcode = '42501';
  end if;
  return query
    with elenco as (
      select pe.id, pe.nome, pe.cognome,
        upper(left(regexp_replace(pe.cognome, '^(De|Di|Da|Del|Della|Lo|La)\s+', '\1', 'i'), 1)) as iniziale
      from iscrizioni i join persone pe on pe.id = i.persona_id
      where i.corso_id = l.corso and pe.attiva
        and i.dal <= (l.inizio at time zone 'Europe/Rome')::date
        and (i.al is null or i.al >= (l.inizio at time zone 'Europe/Rome')::date)
    )
    select e.id, e.nome,
      case when count(*) over (partition by e.nome, e.iniziale) > 1 then left(e.cognome, 3) else e.iniziale end || '.',
      exists (select 1 from presenze pr where pr.sessione_id = sessione and pr.persona_id = e.id and pr.stato = 'presente')
    from elenco e
    order by e.nome, e.cognome;
end $$;

-- ---------------------------------------------------------------------------
-- Il tocco sul nome.
--
-- Nella finestra della lezione la presenza è «tablet»; dopo, e fino a 14 giorni
-- indietro, è «recupero». Restituisce cosa è successo, perché il tablet lo
-- dica a chi ha toccato:
--   · 'segnata'   presenza scritta
--   · 'gia'       era già presente
--   · 'istruttore' l'istruttore ha già deciso per questa persona: resta così
-- ---------------------------------------------------------------------------
create or replace function segna_dal_tablet(sessione uuid, persona uuid)
  returns text language plpgsql security definer set search_path = public as $$
declare
  l record;
  r record;
  da origine_presenza;
  c record;
begin
  select * into r from tablet_regole();
  select * into l from lezione_del_tablet(sessione);
  if l.stato = 'annullata' then raise exception 'lezione annullata' using errcode = '42501'; end if;
  if now() between l.inizio - r.prima and l.inizio + r.dopo then da := 'tablet';
  elsif l.inizio <= now() and l.inizio >= now() - r.recupero then da := 'recupero';
  else raise exception 'fuori orario: la lezione non si può segnare adesso' using errcode = '42501';
  end if;
  if not exists (
    select 1 from iscrizioni i where i.corso_id = l.corso and i.persona_id = persona
      and i.dal <= (l.inizio at time zone 'Europe/Rome')::date
      and (i.al is null or i.al >= (l.inizio at time zone 'Europe/Rome')::date)
  ) then
    raise exception 'non è iscritto a questo corso' using errcode = '42501';
  end if;

  select stato, origine into c from presenze where sessione_id = sessione and persona_id = persona;
  if found and c.stato = 'presente' then return 'gia'; end if;
  if found and c.origine = 'appello' then return 'istruttore'; end if;

  insert into presenze (sessione_id, persona_id, stato, origine, postazione_id)
    values (sessione, persona, 'presente', da, l.postazione)
    on conflict (sessione_id, persona_id) do update
      set stato = 'presente', origine = excluded.origine, postazione_id = excluded.postazione_id
      where presenze.origine <> 'appello';
  return 'segnata';
end $$;

/** Il tasto ANNULLA: toglie un tocco dello stesso tablet, se è di pochi istanti fa. */
create or replace function annulla_dal_tablet(sessione uuid, persona uuid)
  returns boolean language plpgsql security definer set search_path = public as $$
declare
  l record;
  r record;
  tolte int;
begin
  select * into r from tablet_regole();
  select * into l from lezione_del_tablet(sessione);
  delete from presenze
    where sessione_id = sessione and persona_id = persona
      and origine in ('tablet', 'recupero') and postazione_id = l.postazione
      and segnata_il > now() - r.annulla;
  get diagnostics tolte = row_count;
  return tolte > 0;
end $$;

-- ---------------------------------------------------------------------------
-- L'area istruttore del tablet.
--
-- Il PIN viaggia con ogni richiesta: non c'è una «sessione dell'istruttore»
-- da rubare sul tablet, e quando l'area si chiude il PIN sparisce dalla
-- memoria del browser. I tentativi si contano per tablet.
-- ---------------------------------------------------------------------------
create or replace function persona_da_pin(pin text)
  returns uuid language plpgsql security definer set search_path = public as $$
declare
  p uuid := postazione_corrente();
  r record;
  sbagliati int;
  chi uuid;
begin
  select * into r from tablet_regole();
  if p is null then raise exception 'solo un tablet di sala' using errcode = '42501'; end if;
  select count(*) into sbagliati from tentativi_pin
    where postazione_id = p and not riuscito and quando > now() - r.pin_blocco;
  if sbagliati >= r.pin_tentativi then
    raise exception 'troppi PIN sbagliati: riprova fra qualche minuto' using errcode = '42501';
  end if;
  select pe.id into chi from pin_istruttori pi join persone pe on pe.id = pi.persona_id
    where pi.hash = crypt(pin, pi.hash) and pe.attiva and pe.ruolo in ('istruttore', 'staff');
  insert into tentativi_pin (postazione_id, riuscito) values (p, chi is not null);
  delete from tentativi_pin where quando < now() - interval '1 day';
  return chi;
end $$;

/** Il PIN è giusto? Restituisce chi è, o niente. */
create or replace function entra_con_pin(pin text)
  returns table (persona_id uuid, nome text)
  language plpgsql security definer set search_path = public as $$
declare chi uuid := persona_da_pin(pin);
begin
  return query select pe.id, pe.nome from persone pe where pe.id = chi;
end $$;

/**
 * L'appello completo di una lezione della sala, per l'istruttore: qui i
 * cognomi ci sono, e c'è da dove arriva ogni presenza.
 */
create or replace function appello_con_pin(pin text, sessione uuid)
  returns table (persona_id uuid, nome text, cognome text, stato stato_presenza, origine origine_presenza)
  language plpgsql security definer set search_path = public as $$
declare
  chi uuid;
  l record;
begin
  select * into l from lezione_del_tablet(sessione);
  -- Un PIN sbagliato non solleva: l'errore annullerebbe anche il tentativo
  -- appena contato, e il blocco dopo cinque errori non scatterebbe mai.
  chi := persona_da_pin(pin);
  if chi is null then return; end if;
  return query
    select pe.id, pe.nome, pe.cognome, pr.stato, pr.origine
    from iscrizioni i join persone pe on pe.id = i.persona_id
    left join presenze pr on pr.sessione_id = sessione and pr.persona_id = pe.id
    where i.corso_id = l.corso and pe.attiva
      and i.dal <= (l.inizio at time zone 'Europe/Rome')::date
      and (i.al is null or i.al >= (l.inizio at time zone 'Europe/Rome')::date)
    order by pe.cognome, pe.nome;
end $$;

/**
 * L'istruttore corregge dal tablet. `stato` nullo toglie il segno, ma solo a
 * una presenza arrivata dal tablet: quelle dell'appello si correggono
 * cambiando stato, come nell'app.
 */
drop function if exists segna_con_pin(text, uuid, uuid, stato_presenza);
create or replace function segna_con_pin(pin text, sessione uuid, persona uuid, stato stato_presenza)
  returns boolean language plpgsql security definer set search_path = public as $$
declare
  chi uuid;
  l record;
begin
  select * into l from lezione_del_tablet(sessione);
  chi := persona_da_pin(pin);
  if chi is null then return false; end if;  -- vedi appello_con_pin
  if not exists (select 1 from iscrizioni i where i.corso_id = l.corso and i.persona_id = persona) then
    raise exception 'non è iscritto a questo corso' using errcode = '42501';
  end if;
  if stato is null then
    delete from presenze where sessione_id = sessione and persona_id = persona and origine <> 'appello';
    return true;
  end if;
  insert into presenze (sessione_id, persona_id, stato, origine, segnata_da, postazione_id)
    values (sessione, persona, stato, 'appello', chi, l.postazione)
    on conflict (sessione_id, persona_id) do update
      set stato = excluded.stato, origine = 'appello', segnata_da = excluded.segnata_da, postazione_id = excluded.postazione_id;
  return true;
end $$;

/**
 * Il PIN si imposta dall'app o dal SQL Editor: la segreteria per chiunque,
 * un istruttore solo per sé. Quattro cifre, e diverso da quello di tutti gli
 * altri, perché è il PIN a dire chi sei.
 */
create or replace function imposta_pin(persona uuid, pin text)
  returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not e_staff() and persona is distinct from persona_corrente() then
    raise exception 'il PIN lo cambia la segreteria, o l''istruttore per sé' using errcode = '42501';
  end if;
  if pin !~ '^\d{4}$' then raise exception 'il PIN è di quattro cifre'; end if;
  if not exists (select 1 from persone where id = persona and ruolo in ('istruttore', 'staff')) then
    raise exception 'il PIN è solo per istruttori e segreteria';
  end if;
  if exists (select 1 from pin_istruttori where persona_id <> persona and hash = crypt(pin, hash)) then
    raise exception 'questo PIN è già di un altro: scegline un altro';
  end if;
  insert into pin_istruttori (persona_id, hash) values (persona, crypt(pin, gen_salt('bf')))
    on conflict (persona_id) do update set hash = excluded.hash, cambiato_il = now();
end $$;

-- ---------------------------------------------------------------------------
-- Chi può chiamare cosa. Le funzioni interne non le chiama nessuno da fuori.
-- ---------------------------------------------------------------------------
revoke all on function persona_da_pin(text) from public, anon, authenticated;
revoke all on function lezione_del_tablet(uuid) from public, anon, authenticated;
revoke all on function sessione_in_sala(uuid) from public, anon, authenticated;
-- Postgres dà `execute` a tutti per default, e Supabase anche ad `anon`: le
-- funzioni del tablet si tolgono a chi non ha fatto l'accesso, e si ridanno a
-- chi l'ha fatto.
revoke all on function lezioni_sala(date, date), elenco_sala(uuid), segna_dal_tablet(uuid, uuid),
  annulla_dal_tablet(uuid, uuid), entra_con_pin(text), appello_con_pin(text, uuid),
  segna_con_pin(text, uuid, uuid, stato_presenza), imposta_pin(uuid, text), tablet_regole() from public, anon;
grant execute on function lezioni_sala(date, date), elenco_sala(uuid), segna_dal_tablet(uuid, uuid),
  annulla_dal_tablet(uuid, uuid), entra_con_pin(text), appello_con_pin(text, uuid),
  segna_con_pin(text, uuid, uuid, stato_presenza), imposta_pin(uuid, text), tablet_regole() to authenticated;
