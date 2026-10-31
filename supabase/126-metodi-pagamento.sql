-- ---------------------------------------------------------------------------
-- 126 · Come si paga: i metodi di pagamento che la segreteria spegne
--
-- REGOLE → COME SI PAGA accende e spegne Satispay, carta, bonifico, contanti,
-- POS e assegno per tutta l'app. Si salvano gli spenti, non gli accesi: un
-- metodo nuovo nasce acceso e una riga senza la colonna li ha tutti accesi,
-- come prima.
--
-- Cosa cambia:
--   · `impostazioni.metodi_spenti text[]` (vuota di default), con solo id
--     veri (un doppione è innocuo: l'app li toglie);
--   · `metodi_spenti()`: gli spenti, per il modulo di iscrizione che non ha un
--     accesso e non legge `impostazioni` (come `mesi_presenze_pubblici`).
--
-- Chi può fare cosa: la segreteria cambia la colonna (il trigger 55 limita
-- l'amministrazione al solo listino); `metodi_spenti()` la chiamano tutti.
-- I pagamenti già scritti col metodo spento restano come sono.
-- Il rifiuto di un pagamento online spento lo fanno le Edge Function
-- `satispay` e `paypal` (leggono la colonna con la chiave del servizio):
-- vanno ripubblicate dopo questo file.
--
-- Si lancia dopo `125-satispay-chiave.sql`. Non chiede di rilanciare
-- `06-iscrizioni.sql`. Rilanciabile.
-- ---------------------------------------------------------------------------

alter table impostazioni add column if not exists metodi_spenti text[] not null default '{}';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'impostazioni_metodi_spenti_validi') then
    alter table impostazioni add constraint impostazioni_metodi_spenti_validi check (
      metodi_spenti <@ array['satispay', 'carta', 'bonifico', 'contanti', 'pos', 'assegno']);
  end if;
end $$;

/** I metodi di pagamento spenti dalla segreteria: per chi non legge `impostazioni`. */
create or replace function metodi_spenti() returns text[]
  language sql stable security definer set search_path = public, extensions as $$
  select coalesce((select metodi_spenti from public.impostazioni where id), '{}')
$$;

revoke all on function metodi_spenti() from public;
grant execute on function metodi_spenti() to anon, authenticated, service_role;

notify pgrst, 'reload schema';
