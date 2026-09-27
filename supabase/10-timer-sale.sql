-- ---------------------------------------------------------------------------
-- ODS Corsi · il timer dei tablet di sala
--
-- Il tablet di sala ha il timer in una scheda: Maurizio, i bip, il volume
-- e lo schermo sono uguali su tutti i tablet. Si scelgono nel timer, su un
-- tablet qualunque, e li prendono tutti (14-timer-dal-tablet.sql).
--
-- Stanno in una colonna della riga delle impostazioni, così come le scrive
-- l'app (`timer/src/lib/impostazioniSala.ts`): il database non le
-- interpreta, le custodisce, come fa con i timer. Chi le legge e chi le
-- cambia è già deciso da `05-segreteria.sql`: le legge chiunque abbia un
-- accesso, tablet compresi; le cambia la segreteria, e il tablet dalla sua
-- funzione in `14-timer-dal-tablet.sql`.
--
-- Si lancia dopo `09-musica.sql`. Non crea funzioni, quindi non chiede di
-- rilanciare `06-iscrizioni.sql`.
-- ---------------------------------------------------------------------------

alter table impostazioni add column if not exists timer jsonb not null default '{}'::jsonb;

alter table impostazioni drop constraint if exists impostazioni_timer_check;
alter table impostazioni add constraint impostazioni_timer_check
  check (jsonb_typeof(timer) = 'object' and octet_length(timer::text) <= 4000);

-- Che l'API veda subito la colonna nuova, senza aspettare.
notify pgrst, 'reload schema';
