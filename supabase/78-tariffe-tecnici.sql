-- ---------------------------------------------------------------------------
-- ODS Corsi · i dati e le tariffe dei tecnici
--
-- Per la lettera d'incarico e la ricevuta del compenso di ogni mese servono,
-- del tecnico, le sigle delle province (di nascita e di residenza) e l'IBAN:
-- stanno in `anagrafiche`, accanto a nascita e residenza, e come quelle li
-- vede solo la segreteria. Il modulo di iscrizione non li chiede.
--
--   · `tariffe_istruttori`: quanto prende un tecnico per un'ora di lezione in
--     un corso, in centesimi. Una per persona e corso: lo stesso tecnico può
--     prendere tariffe diverse in corsi diversi, e la tariffa di un corso vale
--     anche quando lo fa da sostituto. Se ne va col corso o con la persona.
--     La legge e la scrive solo la segreteria (`e_staff()`): né gli istruttori,
--     né l'amministrazione senza segreteria, né `anon`.
--
-- Si lancia dopo `18-anagrafiche.sql`. Non chiede di rilanciare
-- `06-iscrizioni.sql` e non tocca nessuna funzione di prima. Finché non c'è,
-- la scheda di un tecnico dice di lanciare questo file, e i dati anagrafici
-- scritti dalla segreteria non si leggono (vale la richiesta di iscrizione).
-- ---------------------------------------------------------------------------

alter table anagrafiche add column if not exists provincia_nascita text check (provincia_nascita ~ '^[A-Z]{2}$');
alter table anagrafiche add column if not exists provincia text check (provincia ~ '^[A-Z]{2}$');
alter table anagrafiche add column if not exists iban text check (iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$');

create table if not exists tariffe_istruttori (
  persona_id   uuid not null references persone on delete cascade,
  corso_id     uuid not null references corsi on delete cascade,
  -- Più di mille euro l'ora è di sicuro uno sbaglio di battitura.
  centesimi_ora int not null check (centesimi_ora > 0 and centesimi_ora <= 100000),
  cambiata_il  timestamptz not null default now(),
  cambiata_da  uuid references persone on delete set null,
  primary key (persona_id, corso_id)
);
create index if not exists tariffe_istruttori_corso on tariffe_istruttori (corso_id);

-- Chi l'ha cambiata e quando, scritto dal server: come `anagrafiche`.
drop trigger if exists tariffe_istruttori_cambiata on tariffe_istruttori;
create trigger tariffe_istruttori_cambiata before insert or update on tariffe_istruttori
  for each row execute function scheda_cambiata();

alter table tariffe_istruttori enable row level security;
drop policy if exists tariffe_istruttori_legge on tariffe_istruttori;
drop policy if exists tariffe_istruttori_scrive on tariffe_istruttori;
drop policy if exists tariffe_istruttori_aggiorna on tariffe_istruttori;
drop policy if exists tariffe_istruttori_cancella on tariffe_istruttori;
create policy tariffe_istruttori_legge on tariffe_istruttori for select to authenticated using (e_staff());
create policy tariffe_istruttori_scrive on tariffe_istruttori for insert to authenticated with check (e_staff());
create policy tariffe_istruttori_aggiorna on tariffe_istruttori for update to authenticated using (e_staff()) with check (e_staff());
create policy tariffe_istruttori_cancella on tariffe_istruttori for delete to authenticated using (e_staff());
revoke all on tariffe_istruttori from anon, authenticated;
-- Tutta la riga: l'app scrive con un upsert, che aggiorna anche le colonne della chiave.
grant select, insert, update, delete on tariffe_istruttori to authenticated;

notify pgrst, 'reload schema';
