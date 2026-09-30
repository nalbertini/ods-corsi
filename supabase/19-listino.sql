-- ---------------------------------------------------------------------------
-- ODS Corsi · il listino, cambiato dalla segreteria
--
-- I costi della stagione — la quota associativa, fino a quando vale il
-- prezzo a saldo, i corsi coi loro prezzi e le offerte — li cambia la
-- segreteria da LISTINO, senza aspettare un aggiornamento dell'app. Li
-- leggono la pagina di iscrizione, anche chi non ha un accesso, e le voci
-- pronte delle ricevute. Le ricevute già fatte hanno le loro voci scritte
-- dentro e non cambiano.
--
-- Il listino sta in una colonna della riga delle impostazioni, così come lo
-- scrive l'app (`src/lib/listino.ts`), e il database non lo interpreta:
-- chiede solo un oggetto non troppo grande. Vuoto vuol dire quello del foglio
-- scritto nell'app (`src/lib/costi.ts`). La riga la cambia solo la segreteria
-- (le policy di 05-segreteria.sql); chi non ha un accesso la tabella non la
-- vede, e il listino lo legge dalla funzione `listino()`, che dà quello e
-- basta.
--
-- Si lancia dopo `05-segreteria.sql`, e non chiede di rilanciare
-- `06-iscrizioni.sql`: se lo si rilancia dopo, rimette lui il permesso ad
-- `anon` su `listino()`.
-- ---------------------------------------------------------------------------

alter table impostazioni add column if not exists listino jsonb;
alter table impostazioni drop constraint if exists impostazioni_listino_check;
alter table impostazioni add constraint impostazioni_listino_check
  check (listino is null or (jsonb_typeof(listino) = 'object' and octet_length(listino::text) <= 60000));

/** Il listino della segreteria, o `null` per quello del foglio: per la pagina di iscrizione. */
create or replace function listino() returns jsonb
  language sql stable security definer set search_path = public, extensions as $$
  select listino from impostazioni where id
$$;

revoke all on function listino() from public;
grant execute on function listino() to anon, authenticated;

notify pgrst, 'reload schema';
