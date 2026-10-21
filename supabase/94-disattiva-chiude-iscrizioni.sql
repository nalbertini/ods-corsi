-- ---------------------------------------------------------------------------
-- ODS Corsi · disattivare una scheda chiude le sue iscrizioni
--
-- Disattivata, una persona spariva dagli appelli, ma le sue iscrizioni
-- restavano aperte: riattivandola, a mano o accogliendo una sua richiesta per
-- un altro corso, tornava negli appelli di tutti i corsi che aveva lasciato.
-- Ora disattivarla le chiude oggi, come **Termina** (una che comincia più
-- avanti finisce il giorno in cui comincia). Riattivarla non le riapre: i
-- corsi si rimettono con Iscrivi, o accogliendo la richiesta, che riapre solo
-- quelli chiesti. Il registro delle presenze resta.
--
-- Lo fa un trigger, così vale da ogni strada (scheda, Personale, importazione).
-- E una volta sola chiude oggi le iscrizioni ancora aperte di chi è già
-- disattivato.
--
-- Si lancia dopo `06-iscrizioni.sql`; non chiede di rilanciarlo. Finché non
-- c'è, l'app chiede «le sue iscrizioni si chiudono oggi» ma il database le
-- lascia aperte.
-- ---------------------------------------------------------------------------

create or replace function iscrizioni_alla_disattivazione()
  returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  oggi date := (now() at time zone 'Europe/Rome')::date;
begin
  update iscrizioni set al = greatest(dal, oggi)
    where persona_id = new.id and (al is null or al > greatest(dal, oggi));
  return new;
end $$;
revoke all on function iscrizioni_alla_disattivazione() from public, anon, authenticated;

drop trigger if exists persone_iscrizioni_disattivata on persone;
create trigger persone_iscrizioni_disattivata after update of attiva on persone
  for each row when (old.attiva and not new.attiva) execute function iscrizioni_alla_disattivazione();

-- Chi è già disattivato: le iscrizioni aperte si chiudono oggi.
update iscrizioni i set al = greatest(i.dal, (now() at time zone 'Europe/Rome')::date)
  from persone p
  where p.id = i.persona_id and not p.attiva
    and (i.al is null or i.al > greatest(i.dal, (now() at time zone 'Europe/Rome')::date));

notify pgrst, 'reload schema';
