-- ---------------------------------------------------------------------------
-- ODS Corsi · i dati anagrafici degli iscritti importati
--
-- Chi si iscrive dal modulo dell'app lascia nascita, residenza e genitore
-- nella sua richiesta (`richieste_iscrizione`, in `06-iscrizioni.sql`). Chi
-- arriva dalle risposte del vecchio modulo Google una richiesta non ce l'ha:
-- i suoi dati stanno qui, una riga per persona, e servono alla segreteria per
-- il tesseramento e per le ricevute.
--
-- Come la richiesta e il certificato, qui ci sono codici fiscali e
-- indirizzi, che agli istruttori per l'appello non servono: la tabella è a
-- parte da `persone` e la vede solo la segreteria. Si cancella con la persona.
--
-- Il luogo e la data di nascita del genitore restano scritti com'erano nel
-- modulo («Torino, 3/4/1980»): nel modulo Google stavano in una domanda sola.
--
-- Si lancia dopo `07-certificati-pagamenti.sql`, da cui prende chi l'ha
-- cambiata e quando. Non dà niente ad `anon`, e non chiede di rilanciare
-- `06-iscrizioni.sql`.
-- ---------------------------------------------------------------------------

create table if not exists anagrafiche (
  persona_id       uuid primary key references persone on delete cascade,
  nato_il          date,
  nato_a           text check (length(trim(nato_a)) between 1 and 80),
  codice_fiscale   text check (codice_fiscale ~ '^[A-Z0-9]{16}$'),
  indirizzo        text check (length(trim(indirizzo)) between 1 and 160),
  cap              text check (cap ~ '^[0-9]{5}$'),
  comune           text check (length(trim(comune)) between 1 and 80),
  genitore_nome    text check (length(trim(genitore_nome)) between 1 and 80),
  genitore_cognome text check (length(trim(genitore_cognome)) between 1 and 80),
  genitore_codice_fiscale text check (genitore_codice_fiscale ~ '^[A-Z0-9]{16}$'),
  genitore_nato    text check (length(trim(genitore_nato)) between 1 and 120),
  cambiata_il      timestamptz not null default now(),
  cambiata_da      uuid references persone on delete set null
);

-- Chi l'ha cambiata e quando, scritto dal server: la stessa di `schede_iscritti`.
drop trigger if exists anagrafiche_cambiata on anagrafiche;
create trigger anagrafiche_cambiata before insert or update on anagrafiche
  for each row execute function scheda_cambiata();

-- Solo la segreteria: né gli istruttori né gli iscritti.
alter table anagrafiche enable row level security;
drop policy if exists anagrafiche_legge on anagrafiche;
drop policy if exists anagrafiche_scrive on anagrafiche;
drop policy if exists anagrafiche_aggiorna on anagrafiche;
drop policy if exists anagrafiche_cancella on anagrafiche;
create policy anagrafiche_legge on anagrafiche for select to authenticated using (e_staff());
create policy anagrafiche_scrive on anagrafiche for insert to authenticated with check (e_staff());
create policy anagrafiche_aggiorna on anagrafiche for update to authenticated using (e_staff()) with check (e_staff());
create policy anagrafiche_cancella on anagrafiche for delete to authenticated using (e_staff());
revoke all on anagrafiche from anon, authenticated;
grant select, insert, update, delete on anagrafiche to authenticated;

notify pgrst, 'reload schema';
