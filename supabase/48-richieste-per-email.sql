-- ---------------------------------------------------------------------------
-- ODS Corsi · sei richieste al giorno dalla stessa email, non più tre
--
-- Il modulo di iscrizione a passi manda una famiglia intera (fino a sei
-- persone) con una sola email: col limite di tre, la quarta persona si
-- fermava. Cambia solo il numero in `iscrizioni_regole()`, che
-- `invia_iscrizione()` legge: il resto della porta resta com'è (sessanta
-- richieste all'ora in tutto, i file, il turno una richiesta alla volta).
--
-- Chi può cosa: come prima. `anon` può chiamare `iscrizioni_regole()` e
-- `invia_iscrizione()`; il numero non è un segreto.
--
-- Si lancia dopo `06-iscrizioni.sql`, e non chiede di rilanciarlo. Se lo si
-- rilancia dopo, `06` rimette il limite a tre: va rilanciato anche questo.
-- Finché non c'è, la quarta richiesta dalla stessa email è rifiutata: l'app
-- manda le famiglie di più di tre persone a metà, e dice quali mancano.
-- ---------------------------------------------------------------------------

create or replace function iscrizioni_regole() returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_object(
    'per_email_al_giorno', 6,    -- una famiglia di sei persone le manda tutte
    'in_tutto_all_ora', 60,      -- il doppio di quante se ne sono mai viste a settembre
    'minuti_per_i_file', 60,     -- dopo aver mandato le risposte, per caricare i file
    'file_per_richiesta', 5      -- modulo, documento fronte e retro, certificato, ricevuta
  )
$$;

notify pgrst, 'reload schema';
