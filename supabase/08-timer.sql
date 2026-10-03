-- ---------------------------------------------------------------------------
-- ODS Corsi · il timer delle lezioni
--
-- Il timer (la cartella `timer/`) teneva tutto sul dispositivo: i timer
-- salvati, lo storico, le impostazioni. Va bene per un telefono solo, ma
-- l'istruttore che prepara la lezione a casa la vuole ritrovare sul tablet
-- della sala, e un timer fatto bene è della palestra, non di un telefono.
--
-- Quattro cose:
--   · `timer`: la libreria della palestra (senza proprietario) e i timer
--     personali di ogni istruttore;
--   · `corsi_timer`: i timer di un corso, che il tablet di sala e l'appello
--     aprono con la lezione;
--   · `allenamenti`: lo storico, con la lezione in cui il timer è partito;
--   · `preferenze_timer`: le impostazioni che seguono l'istruttore da un
--     dispositivo all'altro.
--
-- Il timer continua a funzionare anche senza tutto questo, e senza un
-- accesso: i timer restano sul dispositivo come prima.
--
-- Si lancia dopo `07-certificati-pagamenti.sql`. Non crea funzioni da
-- chiamare (solo quelle dei trigger) e non dà niente ad `anon`, quindi non
-- chiede di rilanciare `06-iscrizioni.sql`.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- I timer.
--
-- `persona_id` nullo vuol dire «della palestra»: lo vedono tutti quelli che
-- hanno un accesso, tablet compresi, e lo cura chiunque del personale.
-- Altrimenti è di quell'istruttore, e lo vede solo lui, finché non lo collega
-- a un corso: da lì lo vede chi apre quel corso, ma lo cambia sempre e solo lui.
--
-- `schema` è il timer così come lo scrive l'app (schema di allenamento,
-- durate, round, esercizi): il database non lo interpreta, lo custodisce. È
-- l'app a sapere cosa vuol dire, e un campo nuovo del timer non deve chiedere
-- di cambiare il database.
--
-- L'`id` lo sceglie l'app: un timer creato senza rete ha già il suo nome
-- definitivo, e quando la coda lo manda più volte (la risposta persa per
-- strada) il server riconosce che è lo stesso.
-- ---------------------------------------------------------------------------
create table if not exists timer (
  id          uuid primary key default gen_random_uuid(),
  persona_id  uuid references persone on delete cascade,
  nome        text not null check (length(trim(nome)) between 1 and 80),
  schema      jsonb not null check (jsonb_typeof(schema) = 'object' and octet_length(schema::text) <= 20000),
  creato_il   timestamptz not null default now(),
  creato_da   uuid references persone on delete set null,
  cambiato_il timestamptz not null default now(),
  cambiato_da uuid references persone on delete set null
);
create index if not exists timer_persona on timer (persona_id);

-- Chi l'ha creato e chi l'ha cambiato, scritto dal server e non dal browser.
-- Di chi è un timer non cambia: portarne uno personale in palestra vuol dire
-- farne una copia, e prendersi quello della palestra non si può.
create or replace function timer_cambiato() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.creato_il := now();
    new.creato_da := persona_corrente();
  else
    if new.persona_id is distinct from old.persona_id then
      raise exception 'di chi è un timer non cambia: fanne una copia' using errcode = '42501';
    end if;
    new.creato_il := old.creato_il;
    new.creato_da := old.creato_da;
  end if;
  new.cambiato_il := now();
  new.cambiato_da := persona_corrente();
  return new;
end $$;
drop trigger if exists timer_cambiato on timer;
create trigger timer_cambiato before insert or update on timer
  for each row execute function timer_cambiato();

-- ---------------------------------------------------------------------------
-- I timer di un corso.
--
-- Li collega qualunque istruttore, non solo chi tiene il corso: è la stessa
-- scelta delle presenze (02-policy.sql), perché le sostituzioni si decidono
-- dieci minuti prima. Chi l'ha collegato resta scritto.
-- ---------------------------------------------------------------------------
create table if not exists corsi_timer (
  corso_id      uuid not null references corsi on delete cascade,
  timer_id      uuid not null references timer on delete cascade,
  collegato_il  timestamptz not null default now(),
  collegato_da  uuid references persone on delete set null default persona_corrente(),
  primary key (corso_id, timer_id)
);
create index if not exists corsi_timer_timer on corsi_timer (timer_id);

-- ---------------------------------------------------------------------------
-- Lo storico: un timer arrivato in fondo, o fermato prima.
--
-- Chi l'ha fatto partire lo decide il server: l'istruttore collegato o il
-- tablet della sala. Il nome si tiene anche se il timer poi si cancella,
-- perché lo storico racconta cosa è successo, non cosa c'è adesso. Anche qui
-- l'`id` lo sceglie l'app, per la stessa ragione dei timer.
-- ---------------------------------------------------------------------------
create table if not exists allenamenti (
  id            uuid primary key default gen_random_uuid(),
  timer_id      uuid references timer on delete set null,
  nome          text not null check (length(trim(nome)) between 1 and 80),
  sessione_id   uuid references sessioni on delete set null,
  persona_id    uuid references persone on delete set null,
  postazione_id uuid references postazioni on delete set null,
  finito_il     timestamptz not null default now(),
  secondi       int not null check (secondi between 0 and 86400),
  completato    boolean not null
);
create index if not exists allenamenti_finito on allenamenti (finito_il);
create index if not exists allenamenti_sessione on allenamenti (sessione_id);

create or replace function allenamento_arrivato() returns trigger language plpgsql as $$
begin
  new.persona_id := persona_corrente();
  new.postazione_id := postazione_corrente();
  -- Arriva anche giorni dopo, dalla coda di un tablet rimasto senza rete:
  -- l'ora è quella del dispositivo, ma una dal futuro non ha senso.
  if new.finito_il > now() then new.finito_il := now(); end if;
  return new;
end $$;
drop trigger if exists allenamento_arrivato on allenamenti;
create trigger allenamento_arrivato before insert on allenamenti
  for each row execute function allenamento_arrivato();

-- ---------------------------------------------------------------------------
-- Le impostazioni che seguono l'istruttore: Maurizio, bip e voce, volume.
-- Quelle che dipendono dal dispositivo (quale voce di sistema, lo schermo
-- sempre acceso) restano sul dispositivo: l'app non le manda nemmeno.
-- ---------------------------------------------------------------------------
create table if not exists preferenze_timer (
  persona_id    uuid primary key references persone on delete cascade default persona_corrente(),
  impostazioni  jsonb not null check (jsonb_typeof(impostazioni) = 'object' and octet_length(impostazioni::text) <= 4000),
  cambiate_il   timestamptz not null default now()
);

create or replace function preferenze_cambiate() returns trigger language plpgsql as $$
begin
  new.persona_id := persona_corrente();
  new.cambiate_il := now();
  return new;
end $$;
drop trigger if exists preferenze_cambiate on preferenze_timer;
create trigger preferenze_cambiate before insert or update on preferenze_timer
  for each row execute function preferenze_cambiate();

-- ---------------------------------------------------------------------------
-- Chi vede e fa cosa.
-- ---------------------------------------------------------------------------
alter table timer            enable row level security;
alter table corsi_timer      enable row level security;
alter table allenamenti      enable row level security;
alter table preferenze_timer enable row level security;

do $$
declare t text;
begin
  foreach t in array array['timer','corsi_timer','allenamenti','preferenze_timer'] loop
    execute format('drop policy if exists %I_legge on %I', t, t);
    execute format('drop policy if exists %I_scrive on %I', t, t);
    execute format('drop policy if exists %I_aggiorna on %I', t, t);
    execute format('drop policy if exists %I_cancella on %I', t, t);
  end loop;
end $$;

-- --- timer -----------------------------------------------------------------
-- Si vedono quelli della palestra, i propri e quelli collegati a un corso.
-- Si scrivono quelli della palestra e i propri, solo dal personale: il tablet
-- li apre e basta. Un timer della palestra lo toglie chi l'ha creato o la
-- segreteria: curarlo è di tutti, buttarlo no.
create policy timer_legge on timer for select to authenticated
  using (persona_id is null or persona_id = persona_corrente()
         or exists (select 1 from corsi_timer ct where ct.timer_id = timer.id));
create policy timer_scrive on timer for insert to authenticated
  with check (e_personale() and (persona_id is null or persona_id = persona_corrente()));
create policy timer_aggiorna on timer for update to authenticated
  using (e_personale() and (persona_id is null or persona_id = persona_corrente()))
  with check (e_personale() and (persona_id is null or persona_id = persona_corrente()));
create policy timer_cancella on timer for delete to authenticated
  using (persona_id = persona_corrente()
         or (persona_id is null and (e_staff() or creato_da = persona_corrente())));

-- --- corsi_timer -----------------------------------------------------------
-- Il collegamento lo legge chiunque abbia un accesso: il tablet deve sapere
-- quali timer aprire con la lezione. Si collega solo un timer che si vede.
create policy corsi_timer_legge on corsi_timer for select to authenticated using (true);
create policy corsi_timer_scrive on corsi_timer for insert to authenticated
  with check (e_personale() and exists (select 1 from timer t where t.id = timer_id));
create policy corsi_timer_cancella on corsi_timer for delete to authenticated using (e_personale());

-- --- allenamenti -----------------------------------------------------------
-- Lo scrive chi ha fatto partire il timer: il personale o un tablet di sala
-- (chi lo sia l'ha già scritto il trigger). Il personale li legge tutti, un
-- tablet i suoi. Non si correggono; li toglie la segreteria.
create policy allenamenti_legge on allenamenti for select to authenticated
  using (e_personale() or (postazione_id is not null and postazione_id = postazione_corrente()));
create policy allenamenti_scrive on allenamenti for insert to authenticated
  with check ((persona_id is not null and e_personale()) or postazione_id is not null);
create policy allenamenti_cancella on allenamenti for delete to authenticated using (e_staff());

-- --- preferenze_timer ------------------------------------------------------
create policy preferenze_timer_legge on preferenze_timer for select to authenticated
  using (persona_id = persona_corrente());
create policy preferenze_timer_scrive on preferenze_timer for insert to authenticated
  with check (e_personale() and persona_id = persona_corrente());
create policy preferenze_timer_aggiorna on preferenze_timer for update to authenticated
  using (persona_id = persona_corrente()) with check (persona_id = persona_corrente());

-- Permesso largo sulla tabella, policy stretta sulle righe (vedi 02-policy.sql).
-- Il `grant` di 02-policy.sql vale per le tabelle che c'erano allora: queste
-- sono nuove, e il permesso va dato qui.
revoke all on timer, corsi_timer, allenamenti, preferenze_timer from anon, authenticated;
grant select, insert, update, delete on timer, preferenze_timer to authenticated;
grant select, insert, delete on corsi_timer, allenamenti to authenticated;

-- Le funzioni nascono eseguibili da tutti, `anon` compreso: si chiudono qui.
revoke all on function timer_cambiato(), allenamento_arrivato(), preferenze_cambiate() from public, anon;
grant execute on function timer_cambiato(), allenamento_arrivato(), preferenze_cambiate() to authenticated;

-- Che l'API veda subito funzioni e tabelle nuove, senza aspettare.
notify pgrst, 'reload schema';
