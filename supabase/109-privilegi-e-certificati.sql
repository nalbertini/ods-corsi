-- ---------------------------------------------------------------------------
-- 109 · Privilegi più stretti e tetto ai file del certificato
--
-- Due cose che l'audit RLS del 2026-10-24 ha trovato aperte:
--
--   1. Supabase dà ad `anon` e `authenticated` ogni privilegio sulle tabelle,
--      anche TRUNCATE, TRIGGER e REFERENCES. TRUNCATE non passa dalla RLS:
--      chi apre una connessione SQL col ruolo `authenticated` (non
--      dall'API, che non lo espone) svuota una tabella. L'app non usa nessuno
--      dei tre: si tolgono da tutte le tabelle di `public` e da quelle che
--      verranno (select, insert, update e delete restano come li danno i file
--      precedenti).
--   2. Un iscritto può mandare il certificato in `certificati/<sé>/attesa-N.*`
--      (102) senza limiti: ne bastano 200 per riempire lo Storage, e solo la
--      segreteria cancella. Ora ne tiene in attesa al massimo 3 (con un invio
--      nuovo, quello vecchio se ne va: ne servono 2). Il conteggio sta in un
--      trigger, non nella policy: Storage controlla la policy con una insert
--      annullata e scrive la riga vera da superutente, e due file mandati
--      insieme vedrebbero lo stesso numero. Come `limita_file_allegati` (32).
--
-- Si lancia dopo `108-compleanni.sql`. Non chiede di rilanciare
-- `06-iscrizioni.sql`. Finché non c'è, l'app funziona come prima.
--
-- shortcut: i privilegi di default sono quelli di chi lancia il file (postgres);
-- una tabella creata da `supabase_admin` nascerebbe ancora con tutto, oggi non
-- succede: se succede, rifare l'`alter default privileges … for role`.
-- ---------------------------------------------------------------------------

revoke truncate, trigger, references on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke truncate, trigger, references on tables from anon, authenticated;

create or replace function limita_file_certificato() returns trigger
  language plpgsql security definer set search_path = public, extensions as $$
declare
  cartella text := split_part(new.name, '/', 1);
begin
  perform pg_advisory_xact_lock(hashtext('certificati:' || cartella));
  if (select count(*) from storage.objects o where o.bucket_id = 'certificati' and o.name like cartella || '/attesa-%') >= 3 then
    raise exception 'Hai già mandato troppi file: aspetta che la segreteria li guardi' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function limita_file_certificato() from public, anon, authenticated;
-- Solo `insert`, non `update of name` come il 32: `unisci_persone` (102) sposta un file in attesa
-- con una update, e la segreteria non deve restare bloccata da un tetto che non è suo.
create or replace trigger limita_file_certificato before insert on storage.objects
  for each row when (new.bucket_id = 'certificati' and new.name ~ '^[^/]+/attesa-') execute function limita_file_certificato();

notify pgrst, 'reload schema';
