-- ---------------------------------------------------------------------------
-- ODS Timer · sala corsi — accessi (RLS)
--
-- L'app è un sito statico: la chiave che finisce nel browser è pubblica di
-- proposito, e chiunque può chiamare l'API con quella. Quindi la sicurezza sta
-- QUI e non nel codice dell'app. Una schermata che «non mostra» un dato non lo
-- protegge: a proteggerlo è la policy che non lo lascia uscire.
-- ---------------------------------------------------------------------------

-- Chi sta guardando, e con che ruolo.
--
-- `security definer` non è una scorciatoia: serve perché queste funzioni sono
-- usate dentro le policy di `persone`, e una policy che legge la tabella su cui
-- sta decidendo andrebbe in ricorsione. Girando come proprietarie saltano l'RLS
-- e la ricorsione non si apre. `search_path` fissato perché una funzione
-- definer con il path libero è un buco. Fissato a `public, extensions`: su
-- Supabase pgcrypto e citext stanno nello schema `extensions`, e senza quello
-- `crypt()` del PIN e il tipo `citext` delle email non si troverebbero. Su un
-- Postgres che quello schema non ce l'ha, il nome in più si ignora.
create or replace function persona_corrente() returns uuid
  language sql stable security definer set search_path = public, extensions as $$
  select id from persone where utente_id = auth.uid() and attiva
$$;

create or replace function ruolo_corrente() returns ruolo
  language sql stable security definer set search_path = public, extensions as $$
  select ruolo from persone where utente_id = auth.uid() and attiva
$$;

/**
 * Istruttori e segreteria: chi lavora in palestra, non chi la frequenta.
 *
 * `coalesce` perché chi ha un account ma non una riga in `persone` ha ruolo
 * nullo, e «nullo = 'staff'» è nullo, non falso: in una policy vale come no,
 * ma in un `if not e_staff() then raise` farebbe passare chiunque.
 */
create or replace function e_personale() returns boolean
  language sql stable as $$
  select coalesce(ruolo_corrente() in ('istruttore', 'staff'), false)
$$;

create or replace function e_staff() returns boolean
  language sql stable as $$
  select coalesce(ruolo_corrente() = 'staff', false)
$$;

alter table persone     enable row level security;
alter table sale        enable row level security;
alter table corsi       enable row level security;
alter table ricorrenze  enable row level security;
alter table sessioni    enable row level security;
alter table iscrizioni  enable row level security;
alter table presenze    enable row level security;
alter table corsi_istruttori enable row level security;
alter table postazioni  enable row level security;

-- Rilanciabile: si buttano giù e si rifanno.
do $$
declare t text;
begin
  foreach t in array array['persone','sale','corsi','ricorrenze','sessioni','iscrizioni','presenze','corsi_istruttori','postazioni'] loop
    execute format('drop policy if exists %I_legge on %I', t, t);
    execute format('drop policy if exists %I_scrive on %I', t, t);
    execute format('drop policy if exists %I_aggiorna on %I', t, t);
    execute format('drop policy if exists %I_cancella on %I', t, t);
  end loop;
end $$;

-- --- persone ---------------------------------------------------------------
-- Il personale vede tutta l'anagrafica: un istruttore che sostituisce un
-- collega all'ultimo momento deve poter fare l'appello, e sapere in anticipo
-- quali corsi coprirà non è una cosa che l'orario garantisce. Un iscritto vede
-- soltanto se stesso.
create policy persone_legge on persone for select to authenticated
  using (e_personale() or id = persona_corrente());
create policy persone_scrive on persone for insert to authenticated with check (e_staff());
create policy persone_aggiorna on persone for update to authenticated using (e_staff()) with check (e_staff());
create policy persone_cancella on persone for delete to authenticated using (e_staff());

-- --- anagrafica dei corsi --------------------------------------------------
-- Sale, corsi, ricorrenze e chi insegna cosa li legge chiunque abbia un
-- accesso, tablet compresi: sono il calendario della palestra, non un segreto.
-- Li scrive la segreteria.
do $$
declare t text;
begin
  foreach t in array array['sale','corsi','ricorrenze','corsi_istruttori'] loop
    execute format('create policy %I_legge on %I for select to authenticated using (true)', t, t);
    execute format('create policy %I_scrive on %I for insert to authenticated with check (e_staff())', t, t);
    execute format('create policy %I_aggiorna on %I for update to authenticated using (e_staff()) with check (e_staff())', t, t);
    execute format('create policy %I_cancella on %I for delete to authenticated using (e_staff())', t, t);
  end loop;
end $$;

-- --- sessioni --------------------------------------------------------------
-- L'istruttore della lezione può aggiornarla: segnarla svolta, scrivere una
-- nota, annullarla. Vale per chi la fa quel giorno (`istruttore_id`, che può
-- essere un sostituto) e per chi insegna il corso (`corsi_istruttori`).
-- Crearle e cancellarle resta alla segreteria, perché il calendario è una cosa
-- sola per tutti.
create or replace function insegna(corso uuid) returns boolean
  language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from corsi_istruttori where corso_id = corso and persona_id = persona_corrente())
$$;
create policy sessioni_legge on sessioni for select to authenticated using (true);
create policy sessioni_scrive on sessioni for insert to authenticated with check (e_staff());
create policy sessioni_aggiorna on sessioni for update to authenticated
  using (e_staff() or istruttore_id = persona_corrente() or insegna(corso_id))
  with check (e_staff() or istruttore_id = persona_corrente() or insegna(corso_id));
create policy sessioni_cancella on sessioni for delete to authenticated using (e_staff());

-- --- iscrizioni ------------------------------------------------------------
create policy iscrizioni_legge on iscrizioni for select to authenticated
  using (e_personale() or persona_id = persona_corrente());
create policy iscrizioni_scrive on iscrizioni for insert to authenticated with check (e_staff());
create policy iscrizioni_aggiorna on iscrizioni for update to authenticated using (e_staff()) with check (e_staff());
create policy iscrizioni_cancella on iscrizioni for delete to authenticated using (e_staff());

-- --- presenze --------------------------------------------------------------
-- Segna le presenze qualunque istruttore, non solo quello a cui la lezione è
-- assegnata. È una scelta, e questa è la ragione: le sostituzioni si decidono
-- dieci minuti prima, e un istruttore chiuso fuori dall'appello con venti
-- persone in sala è un danno peggiore del rischio che copre. Chi ha segnato
-- resta scritto in `segnata_da`, quindi la cosa è tracciata e non anonima.
-- Cancellare, quello no: si corregge cambiando stato.
create policy presenze_legge on presenze for select to authenticated
  using (e_personale() or persona_id = persona_corrente());
create policy presenze_scrive on presenze for insert to authenticated with check (e_personale());
create policy presenze_aggiorna on presenze for update to authenticated using (e_personale()) with check (e_personale());
create policy presenze_cancella on presenze for delete to authenticated using (e_staff());

-- --- postazioni ------------------------------------------------------------
-- Le gestisce la segreteria. Un tablet vede la propria riga e basta: gli
-- serve a sapere in che sala è appeso.
create policy postazioni_legge on postazioni for select to authenticated
  using (e_staff() or utente_id = auth.uid());
create policy postazioni_scrive on postazioni for insert to authenticated with check (e_staff());
create policy postazioni_aggiorna on postazioni for update to authenticated using (e_staff()) with check (e_staff());
create policy postazioni_cancella on postazioni for delete to authenticated using (e_staff());

-- ---------------------------------------------------------------------------
-- Permessi di tabella
--
-- Il modello è: permesso largo sulla tabella, policy stretta sulle righe. Senza
-- il `grant` l'utente non riceverebbe «riga filtrata» ma «permesso negato», e
-- senza le policy riceverebbe tutto: servono tutti e due, e sono due cose
-- diverse. `anon` — chi non ha fatto l'accesso — non tocca niente: in questa
-- app non esiste un dato pubblico.
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;
revoke all on schema public from anon;
