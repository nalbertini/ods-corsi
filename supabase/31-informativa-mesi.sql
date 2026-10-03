-- ---------------------------------------------------------------------------
-- ODS Corsi · per quanto si tengono le presenze, nell'informativa privacy
--
-- L'informativa (`informativa.html`) dice per quanto si tengono le presenze,
-- e quel periodo lo sceglie la segreteria in IMPOSTAZIONI
-- (`impostazioni.mesi_presenze`, 05-segreteria.sql). Scritto a mano nella
-- pagina restava indietro appena la palestra cambiava idea: ora la pagina lo
-- chiede qui (`src/lib/informativa.ts`).
--
-- L'informativa la legge chiunque, anche chi non ha un accesso, e a lui la
-- tabella delle impostazioni resta chiusa: `mesi_presenze_pubblici()` dà il
-- numero dei mesi e basta. Chi ha un accesso la può chiamare uguale. Nessuno
-- cambia niente da qui.
--
-- Si lancia dopo `05-segreteria.sql`, e non chiede di rilanciare
-- `06-iscrizioni.sql`: se lo si rilancia dopo, rimette lui il permesso ad
-- `anon`. Finché non c'è, l'informativa dice «per il periodo stabilito dalla
-- palestra (oggi indicato in segreteria)», senza un numero.
-- ---------------------------------------------------------------------------

/** I mesi per cui si tengono le presenze: per l'informativa privacy. */
create or replace function mesi_presenze_pubblici() returns int
  language sql stable security definer set search_path = public, extensions as $$
  -- `public.` scritto: una tabella temporanea con lo stesso nome non la sostituisce.
  select coalesce((select mesi_presenze from public.impostazioni where id), 24)
$$;

revoke all on function mesi_presenze_pubblici() from public;
grant execute on function mesi_presenze_pubblici() to anon, authenticated;

notify pgrst, 'reload schema';
