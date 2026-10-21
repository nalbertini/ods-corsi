-- ---------------------------------------------------------------------------
-- ODS Corsi · una richiesta accolta non si elimina
--
-- Per chi si iscrive dal modulo, nascita, codice fiscale, residenza e genitore
-- stanno solo nella richiesta accolta (vedi la testata di `18-anagrafiche.sql`):
-- eliminarla li toglieva alla scheda, e con la data di nascita il certificato
-- tornava da chiedere a tutti. La segreteria elimina le richieste nuove (lo
-- spam) e le rifiutate; un'accolta solo quando la sua scheda non c'è più
-- (`persona_id` torna vuoto con `on delete set null`).
--
-- E la segreteria non cambia più la riga a mano: rimettendo lo stato o
-- staccando la scheda si aggirava la policy, e cambiando i campi si perdevano
-- i dati lo stesso. Stato, scheda e dati li cambiano solo le funzioni
-- (`accogli_iscrizione`, `rifiuta_iscrizione`, `unisci_persone`).
--
-- Lo stesso è in `06-iscrizioni.sql`, così rilanciarlo non la allarga.
-- Si lancia dopo `06-iscrizioni.sql`; non chiede di rilanciarlo. Finché non
-- c'è, l'app non mostra già il tasto sulle accolte, ma il database le lascia
-- cancellare.
-- ---------------------------------------------------------------------------

drop policy if exists richieste_aggiorna on richieste_iscrizione;
revoke update on richieste_iscrizione from authenticated;

drop policy if exists richieste_cancella on richieste_iscrizione;
create policy richieste_cancella on richieste_iscrizione for delete to authenticated
  using (e_staff() and (stato <> 'accolta' or persona_id is null));

notify pgrst, 'reload schema';
