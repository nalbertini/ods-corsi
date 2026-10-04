-- ---------------------------------------------------------------------------
-- ODS Corsi · la categoria delle segnalazioni: idea o correzione
--
-- Ogni segnalazione dice se è un'idea (cosa servirebbe) o una correzione
-- (cosa non va). La categoria è del filo, non delle risposte. Un filo nuovo
-- la deve avere; quelli scritti prima restano senza, e si chiudono, si
-- riaprono e ricevono risposte come sempre: per questo l'obbligo sta nella
-- policy di insert e non in un vincolo, che varrebbe anche per chiuderli.
-- Dopo la cambia chi è di segreteria, come la chiusura: una scelta sbagliata
-- non resta sbagliata, e ai fili vecchi la si può dare.
--
-- Si lancia dopo `25-segnalazioni.sql`, e chi rilancia il 25 rilancia poi
-- anche questo: il 25 rimette la policy di insert e i grant di prima. Non
-- crea funzioni: non chiede di rilanciare `06-iscrizioni.sql`. Finché non
-- c'è, SEGNALAZIONI si legge senza categorie e MANDA dice che va lanciato.
-- ---------------------------------------------------------------------------

alter table segnalazioni add column if not exists categoria text
  check (categoria in ('idea', 'correzione'));

-- Una risposta non ha categoria. Con un nome suo: il 25, rilanciato, rifà
-- `segnalazioni_check` e questo resta.
alter table segnalazioni drop constraint if exists segnalazioni_categoria_solo_filo;
alter table segnalazioni add constraint segnalazioni_categoria_solo_filo
  check (padre_id is null or categoria is null);

-- Come nel 25, più la categoria obbligatoria per un filo nuovo.
drop policy if exists segnalazioni_scrivi on segnalazioni;
create policy segnalazioni_scrivi on segnalazioni for insert
  with check (e_staff() and autore_id = persona_corrente()
    and (padre_id is null and categoria is not null
      -- Si risponde solo a un filo, non a una risposta.
      or exists (select 1 from segnalazioni p where p.id = segnalazioni.padre_id and p.padre_id is null)));

-- La categoria si cambia come la chiusura: solo un filo, solo la segreteria
-- (`segnalazioni_chiudi`, 25-segnalazioni.sql).
grant update (chiusa_il, categoria) on segnalazioni to authenticated;

notify pgrst, 'reload schema';
