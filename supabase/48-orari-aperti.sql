-- ---------------------------------------------------------------------------
-- ODS Corsi · gli orari dei corsi aperti, per la pagina delle iscrizioni
--
-- Quando un genitore iscrive un figlio, il modulo a passi gli propone i corsi
-- per la sua età che si fanno mentre il figlio è in palestra («stessa ora»).
-- Lo decide sul calendario vero: giorno, ora e durata delle ricorrenze, non
-- gli orari scritti nel listino (un corso senza una voce sua non ne ha).
-- Sono gli stessi orari del sito e del volantino.
--
-- Chi può cosa:
--   · `anon` (e chiunque) chiama `orari_aperti()`: di ogni corso attivo,
--     le ricorrenze non finite, solo corso, giorno, ora e durata. Niente
--     sala, istruttore, capienza, singole lezioni o iscritti; le tabelle
--     `corsi`, `ricorrenze` e `sessioni` restano chiuse come prima.
--
-- Si lancia dopo `06-iscrizioni.sql`, e non chiede di rilanciarlo. Se lo si
-- rilancia dopo, è `06` a rimettere il permesso ad `anon` su `orari_aperti()`.
-- Finché non c'è, il modulo non propone corsi alla stessa ora e fa
-- scegliere al genitore fra tutti i corsi per la sua età.
-- ---------------------------------------------------------------------------

create or replace function orari_aperti()
  returns table (corso_id uuid, giorno int, ora time, durata_min int)
  language sql stable security definer set search_path = public, extensions as $$
  select r.corso_id, r.giorno, r.ora, r.durata_min
  from ricorrenze r
  join corsi c on c.id = r.corso_id
  where c.attivo and (r.al is null or r.al >= current_date)
  order by r.corso_id, r.giorno, r.ora
$$;

revoke all on function orari_aperti() from public;
grant execute on function orari_aperti() to anon, authenticated;

notify pgrst, 'reload schema';
