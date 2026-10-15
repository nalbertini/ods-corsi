-- ---------------------------------------------------------------------------
-- ODS Corsi · le presenze degli allievi, solo per le lezioni di questi giorni
--
-- Prima: qualunque istruttore poteva segnare, cambiare o togliere le presenze
-- di ogni lezione, di ogni corso e di ogni data (passate di mesi, o di domani),
-- e dall'appello si faceva accreditare un'ora «confermata» anche su una
-- lezione mai tenuta (vedi `23-istruttori-dalle-lezioni.sql`).
--
-- Ora, per chi non è segreteria:
--   · le presenze si toccano da 30 minuti prima dell'inizio a 14 giorni dopo
--     (`tablet_regole()`: `prima` e `recupero`, gli stessi numeri del tablet).
--     Dentro la finestra vale la scelta di sempre: qualunque istruttore, anche
--     di un corso non suo, perché le sostituzioni si decidono all'ultimo minuto;
--   · fuori finestra il database risponde con un errore (42501) che dice di
--     scrivere alla segreteria. Una policy toglierebbe le righe in silenzio, e
--     l'app crederebbe di aver tolto un segno che sul server resta: per questo
--     la regola sta in un trigger e non nelle policy di `02-policy.sql`, che
--     restano come sono;
--   · l'appello non accredita più l'ora dell'istruttore per una lezione che
--     inizia fra più di mezz'ora.
-- La segreteria (ruolo doppio compreso) non ha limiti. Senza un utente (un
-- job, un import, la conservazione delle presenze) passa tutto, come sempre.
-- Il tablet scrive dalle sue funzioni, che hanno già le loro finestre.
--
-- Si lancia dopo `23-istruttori-dalle-lezioni.sql` (e `04-tablet.sql`, per
-- `tablet_regole()`). Non chiede di rilanciare `06-iscrizioni.sql`: crea
-- funzioni che chiude da sé. Se si rilancia `23`, che ridefinisce
-- `istruttore_dall_appello`, va rilanciato anche questo. Finché non c'è,
-- restano i vecchi permessi larghi.
-- ---------------------------------------------------------------------------

/** Una lezione è nella finestra in cui un istruttore può toccare le presenze. */
create or replace function lezione_nella_finestra(sessione uuid) returns boolean
  language sql stable security definer set search_path = public, extensions as $$
  select exists (
    select 1 from sessioni s, tablet_regole() r
    where s.id = sessione and s.inizio >= now() - r.recupero and s.inizio <= now() + r.prima
  )
$$;

create or replace function presenze_solo_nella_finestra() returns trigger
  language plpgsql security definer set search_path = public, extensions as $$
declare
  fuori boolean := false;
begin
  -- La segreteria non ha limiti. Chi non è personale passa: il tablet scrive
  -- dalle sue funzioni, e un job o un import (nessun utente) come sempre; gli
  -- altri li ferma già la policy.
  if e_staff() or not e_personale() then return coalesce(new, old); end if;
  -- `if` separati: in una sola espressione `old` o `new` non assegnati darebbero errore.
  if tg_op <> 'INSERT' then fuori := not lezione_nella_finestra(old.sessione_id); end if;
  if tg_op <> 'DELETE' and not fuori then fuori := not lezione_nella_finestra(new.sessione_id); end if;
  if fuori then
    raise exception 'La lezione è troppo vecchia o troppo lontana per cambiare le presenze: scrivete alla segreteria'
      using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;

-- Prima di `presenze_chi_segna` (ordine alfabetico): rifiuta prima di scrivere.
create or replace trigger presenze_a_finestra before insert or update or delete on presenze
  for each row execute function presenze_solo_nella_finestra();

/**
 * Come in `23-istruttori-dalle-lezioni.sql`, con una riga in più: per una
 * lezione che inizia fra più di mezz'ora non si registra la presenza
 * dell'istruttore, né confermata né da confermare.
 */
create or replace function istruttore_dall_appello() returns trigger
  language plpgsql security definer set search_path = public, extensions as $$
declare
  chi persone%rowtype;
  previsto boolean;
begin
  if new.segnata_da is null or new.origine <> 'appello' then return null; end if;
  select * into chi from persone where id = new.segnata_da;
  if not found or chi.ruolo = 'iscritto' then return null; end if;
  if exists (select 1 from sessioni where id = new.sessione_id and stato = 'annullata') then return null; end if;
  if not exists (select 1 from sessioni s, tablet_regole() r where s.id = new.sessione_id and s.inizio <= now() + r.prima) then
    return null;
  end if;
  previsto := prevista_su(new.sessione_id, chi.id);
  -- La segreteria al banco fa l'appello di tutti: si segna solo se la lezione è sua.
  if chi.ruolo = 'staff' and not (chi.anche_istruttore and previsto) then return null; end if;
  insert into presenze_istruttori (sessione_id, persona_id, stato, prevista, come)
    values (new.sessione_id, chi.id, case when previsto then 'confermata' else 'da_confermare' end::stato_presenza_istruttore, previsto, 'appello')
    on conflict on constraint presenze_istruttori_sessione_id_persona_id_key do update
      set stato = 'confermata', prevista = true
      where presenze_istruttori.stato = 'da_confermare' and excluded.prevista;
  return null;
end $$;

revoke all on function lezione_nella_finestra(uuid), presenze_solo_nella_finestra(), istruttore_dall_appello()
  from public, anon, authenticated;

notify pgrst, 'reload schema';
