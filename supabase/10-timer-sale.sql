-- ---------------------------------------------------------------------------
-- ODS Corsi · il timer dei tablet di sala
--
-- Il tablet di sala ha il timer in una scheda, ma nessuno ci entra a
-- scegliere Maurizio, i bip o il volume: un tablet appeso al muro non ha un
-- padrone. Le sceglie la segreteria, da REGOLE E PRIVACY, accanto alla musica
-- delle sale, e valgono per tutti i tablet. Sul tablet non si cambiano.
--
-- Stanno in una colonna della riga delle impostazioni, così come le scrive
-- l'app (`timer/src/lib/impostazioniSala.ts`): il database non le
-- interpreta, le custodisce, come fa con i timer. Chi le legge e chi le
-- cambia è già deciso da `05-segreteria.sql`: le legge chiunque abbia un
-- accesso, tablet compresi; le cambia la segreteria.
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
