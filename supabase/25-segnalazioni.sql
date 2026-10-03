-- ---------------------------------------------------------------------------
-- ODS Corsi · le segnalazioni della segreteria
--
-- Un posto dove chi è di segreteria scrive cosa non va o cosa servirebbe
-- nell'app, e chi la cura risponde, invece di un documento a parte. Ogni
-- segnalazione è un filo: il primo messaggio ha il titolo, le risposte
-- puntano a lui con `padre_id`. Chi l'ha aperta, o chi risponde, la chiude
-- quando è fatta, e la riapre se serve.
--
-- Solo la segreteria (`e_staff()`, 02-policy.sql) le legge e le scrive.
-- L'autore è sempre chi scrive: non si scrive a nome di un altro. Un
-- messaggio scritto non si cambia; di una segnalazione si cambia solo se è
-- chiusa.
--
-- Si lancia dopo `02-policy.sql`. Non crea funzioni: non chiede di
-- rilanciare `06-iscrizioni.sql`. Finché non c'è, SEGNALAZIONI dice che non
-- si leggono.
-- ---------------------------------------------------------------------------

create table if not exists segnalazioni (
  id         uuid primary key default gen_random_uuid(),
  -- Vuoto: apre il filo. Pieno: è una risposta a quel filo.
  padre_id   uuid references segnalazioni on delete cascade,
  autore_id  uuid references persone on delete set null default persona_corrente(),
  titolo     text,
  testo      text not null check (char_length(btrim(testo)) between 1 and 4000),
  scritta_il timestamptz not null default now(),
  -- Solo per il filo: quando è stata chiusa.
  chiusa_il  timestamptz,
  -- Il titolo ce l'ha il filo, e solo lui; una risposta non si chiude.
  check (padre_id is null and char_length(btrim(titolo)) between 1 and 120
      or padre_id is not null and titolo is null and chiusa_il is null)
);

create index if not exists segnalazioni_padre on segnalazioni (padre_id, scritta_il);

alter table segnalazioni enable row level security;

drop policy if exists segnalazioni_leggi on segnalazioni;
create policy segnalazioni_leggi on segnalazioni for select using (e_staff());

drop policy if exists segnalazioni_scrivi on segnalazioni;
create policy segnalazioni_scrivi on segnalazioni for insert
  with check (e_staff() and autore_id = persona_corrente()
    -- Si risponde solo a un filo, non a una risposta.
    and (padre_id is null or exists (select 1 from segnalazioni p where p.id = segnalazioni.padre_id and p.padre_id is null)));

drop policy if exists segnalazioni_chiudi on segnalazioni;
create policy segnalazioni_chiudi on segnalazioni for update using (e_staff() and padre_id is null) with check (e_staff() and padre_id is null);

-- Di una segnalazione si cambia solo se è chiusa; niente si cancella.
revoke all on segnalazioni from anon, authenticated;
grant select, insert on segnalazioni to authenticated;
grant update (chiusa_il) on segnalazioni to authenticated;

notify pgrst, 'reload schema';
