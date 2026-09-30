-- ---------------------------------------------------------------------------
-- ODS Timer · sala corsi — schema
--
-- Si applica su un progetto Supabase vuoto, in ordine: questo file, poi
-- 02-policy.sql, poi 03-funzioni.sql. Ogni file è ripetibile: rilanciarlo su un
-- database già popolato non distrugge niente.
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "citext";     -- email senza distinzione di maiuscole

do $$ begin create type ruolo as enum ('istruttore', 'staff', 'iscritto'); exception when duplicate_object then null; end $$;
do $$ begin create type stato_sessione as enum ('prevista', 'svolta', 'annullata'); exception when duplicate_object then null; end $$;
do $$ begin create type stato_presenza as enum ('presente', 'assente', 'giustificato'); exception when duplicate_object then null; end $$;
do $$ begin create type origine_presenza as enum ('appello', 'tablet', 'recupero'); exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Persone
--
-- Una persona esiste PRIMA e INDIPENDENTEMENTE da un account: in fase 1 gli
-- iscritti arrivano da un foglio e non accedono a niente. `utente_id` resta
-- nullo finché quella persona non si crea un accesso, e collegarlo dopo è un
-- UPDATE. Avere invece appeso tutto a `auth.users` avrebbe costretto a creare
-- un account finto per ogni nome importato.
-- ---------------------------------------------------------------------------
create table if not exists persone (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null check (length(trim(nome)) > 0),
  cognome    text not null check (length(trim(cognome)) > 0),
  email      citext,
  telefono   text,
  ruolo      ruolo not null default 'iscritto',
  utente_id  uuid unique references auth.users on delete set null,
  attiva     boolean not null default true,
  creata_il  timestamptz not null default now()
);
-- L'email non è obbligatoria, ma se c'è è una sola persona.
create unique index if not exists persone_email_unica on persone (email) where email is not null;
create index if not exists persone_cognome on persone (cognome, nome);

create table if not exists sale (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null unique,
  capienza  int check (capienza > 0)
);

create table if not exists corsi (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  descrizione    text,
  sala_id        uuid references sale on delete set null,
  istruttore_id  uuid references persone on delete set null,
  capienza       int check (capienza > 0),
  colore         text,
  attivo         boolean not null default true
);

-- «Il martedì alle 19, da settembre a giugno».
create table if not exists ricorrenze (
  id         uuid primary key default gen_random_uuid(),
  corso_id   uuid not null references corsi on delete cascade,
  giorno     int not null check (giorno between 0 and 6),   -- 0 = domenica, come getDay()
  ora        time not null,
  durata_min int not null check (durata_min between 5 and 480),
  dal        date not null,
  al         date,
  constraint ricorrenza_non_al_contrario check (al is null or al >= dal)
);
create index if not exists ricorrenze_corso on ricorrenze (corso_id);

-- ---------------------------------------------------------------------------
-- Sessioni: la singola lezione, con un'identità propria.
--
-- È la scelta che regge tutto il resto. Presenze e prenotazioni si attaccano
-- qui e non a «ricorrenza + data», perché il mondo vero è fatto di lezioni
-- annullate, istruttori che si sostituiscono, sale cambiate e corsi
-- straordinari che una regola non prevede.
-- ---------------------------------------------------------------------------
create table if not exists sessioni (
  id            uuid primary key default gen_random_uuid(),
  corso_id      uuid not null references corsi on delete cascade,
  ricorrenza_id uuid references ricorrenze on delete set null,
  inizio        timestamptz not null,
  fine          timestamptz not null,
  sala_id       uuid references sale on delete set null,
  istruttore_id uuid references persone on delete set null,
  stato         stato_sessione not null default 'prevista',
  note          text,
  constraint sessione_non_al_contrario check (fine > inizio)
);
-- Rigenerare il calendario non deve duplicare le lezioni già create.
create unique index if not exists sessioni_uniche on sessioni (corso_id, inizio);
create index if not exists sessioni_giorno on sessioni (inizio);

-- Chi è iscritto al corso: l'elenco da cui parte l'appello.
create table if not exists iscrizioni (
  id         uuid primary key default gen_random_uuid(),
  corso_id   uuid not null references corsi on delete cascade,
  persona_id uuid not null references persone on delete cascade,
  dal        date not null default current_date,
  al         date,
  unique (corso_id, persona_id)
);
create index if not exists iscrizioni_corso on iscrizioni (corso_id);

-- ---------------------------------------------------------------------------
-- Presenze
--
-- Il vincolo unico su (sessione, persona) è quello che fa convergere due
-- tablet sulla stessa lezione: la seconda scrittura aggiorna invece di
-- aggiungere, e nessuno si ritrova segnato due volte.
-- ---------------------------------------------------------------------------
create table if not exists presenze (
  id          uuid primary key default gen_random_uuid(),
  sessione_id uuid not null references sessioni on delete cascade,
  persona_id  uuid not null references persone on delete cascade,
  stato       stato_presenza not null,
  segnata_da  uuid references persone on delete set null,
  segnata_il  timestamptz not null default now(),
  unique (sessione_id, persona_id)
);
create index if not exists presenze_sessione on presenze (sessione_id);

-- ---------------------------------------------------------------------------
-- Più istruttori per corso
--
-- La Lotta la tengono in due, la Preparazione atletica in tre. `corsi.istruttore_id`
-- resta dov'è — è quello che riempie l'import e che `materializza_sessioni`
-- copia sulla lezione — e questa tabella dice chi altro ne risponde. La policy
-- delle lezioni accetta tutti e due.
-- ---------------------------------------------------------------------------
create table if not exists corsi_istruttori (
  corso_id   uuid not null references corsi on delete cascade,
  persona_id uuid not null references persone on delete cascade,
  primary key (corso_id, persona_id)
);
create index if not exists corsi_istruttori_persona on corsi_istruttori (persona_id);

-- ---------------------------------------------------------------------------
-- Postazioni: il tablet appeso al muro di una sala.
--
-- Un tablet non è una persona, e per questo non sta in `persone`: così non
-- entra mai nelle policy del personale e non vede l'anagrafica. Ha un suo
-- utente (tatami@…), creato dalla segreteria, e può fare solo quello che le
-- funzioni di 04-tablet.sql gli lasciano fare.
-- ---------------------------------------------------------------------------
create table if not exists postazioni (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null check (length(trim(nome)) > 0),
  sala_id    uuid not null references sale on delete cascade,
  utente_id  uuid not null unique references auth.users on delete cascade,
  attiva     boolean not null default true,
  creata_il  timestamptz not null default now()
);

-- Da dove arriva una presenza: dall'appello di un istruttore, dal tablet nella
-- finestra della lezione, o dal tablet dopo, da chi si era dimenticato. Lo
-- decide il server (03-funzioni.sql, 04-tablet.sql), non chi scrive.
alter table presenze add column if not exists origine origine_presenza not null default 'appello';
alter table presenze add column if not exists postazione_id uuid references postazioni on delete set null;

-- ---------------------------------------------------------------------------
-- La sala di un giorno.
--
-- Un corso può fare il lunedì in Tatami e il giovedì in Lotta. La sala del
-- corso resta quella di partenza; la ricorrenza ne ha una sua solo quando è
-- diversa, e `null` vuol dire «come il corso». `materializza_sessioni` copia
-- sulla lezione la prima delle due che c'è.
-- ---------------------------------------------------------------------------
alter table ricorrenze add column if not exists sala_id uuid references sale on delete set null;

-- ---------------------------------------------------------------------------
-- Il ruolo doppio.
--
-- C'è chi sta in segreteria e insegna anche. Il ruolo resta `staff`, che può
-- già tutto quello che può un istruttore; `anche_istruttore` dice che insegna:
-- si può dargli un corso, il PIN sul tablet gli segna la presenza come a un
-- istruttore, e all'accesso l'app chiede in che area andare. Per gli altri
-- ruoli non conta.
-- ---------------------------------------------------------------------------
alter table persone add column if not exists anche_istruttore boolean not null default false;

-- ---------------------------------------------------------------------------
-- Conservazione
--
-- Le presenze sono dati personali e non si tengono per sempre. Questa vista
-- dice cosa è scaduto; la cancellazione vera la fa `pulisci_presenze()` in
-- 03-funzioni.sql, chiamata da un job. Il periodo è una scelta della palestra:
-- ventiquattro mesi è il valore di partenza, non una regola di legge.
-- ---------------------------------------------------------------------------
-- `security_invoker` non è un dettaglio: una vista, per default, gira con i
-- privilegi di chi l'ha creata, cioè salta l'RLS e mostrerebbe a chiunque tutte
-- le presenze di tutti. Con questo la vista applica le policy di chi la legge.
create or replace view presenze_scadute with (security_invoker = true) as
  select p.* from presenze p
  join sessioni s on s.id = p.sessione_id
  where s.inizio < now() - interval '24 months';

-- Che l'API veda subito funzioni e tabelle nuove, senza aspettare.
notify pgrst, 'reload schema';
