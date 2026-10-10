-- ---------------------------------------------------------------------------
-- ODS Corsi · un file rimandato non è un file di troppo
--
-- Se il quinto file di una richiesta arriva ma la risposta si perde (una
-- rete da telefono), chi preme RIPROVA lo rimanda con lo stesso nome. La
-- policy `puo_caricare()` e il trigger `limita_file_iscrizione()` contavano
-- cinque file e dicevano di no prima che Storage si accorgesse del doppione:
-- l'app leggeva «ha già tutti i suoi file» invece di «è arrivato». Con la
-- ricevuta copiata in ogni richiesta di una famiglia, cinque file sono il
-- caso normale. Ora un nome che c'è già non si conta: l'inserimento va
-- avanti e sbatte sul vincolo unico di `storage.objects`, che non sostituisce
-- niente (caricato è caricato) e che l'app legge come «arrivato».
--
-- Chi può cosa: come prima. `anon` carica al massimo cinque file nella
-- cartella di una richiesta nuova, entro un'ora; non li rilegge né li cambia.
--
-- Si lancia dopo `06-iscrizioni.sql`, e non chiede di rilanciarlo. Se lo si
-- rilancia dopo, `06` rimette le versioni vecchie: va rilanciato anche
-- questo. Finché non c'è, il quinto file rimandato dice «scrivi alla
-- segreteria», anche se è arrivato.
-- ---------------------------------------------------------------------------

create or replace function puo_caricare(nome_file text)
  returns boolean language plpgsql stable security definer set search_path = public, extensions as $$
declare
  regole jsonb := iscrizioni_regole();
  cartella uuid;
begin
  if nome_file !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(modulo|documento|documento-retro|certificato|ricevuta)\.(jpg|jpeg|png|webp|heic|heif|pdf)$' then
    return false;
  end if;
  cartella := split_part(nome_file, '/', 1)::uuid;
  return exists (
      select 1 from richieste_iscrizione r
      where r.id = cartella and r.stato = 'nuova'
        and r.creata_il > now() - make_interval(mins => (regole->>'minuti_per_i_file')::int))
    and (exists (select 1 from storage.objects o where o.bucket_id = 'iscrizioni' and o.name = nome_file)
         or (select count(*) from storage.objects o
             where o.bucket_id = 'iscrizioni' and o.name like cartella::text || '/%') < (regole->>'file_per_richiesta')::int);
end $$;

create or replace function limita_file_iscrizione() returns trigger
  language plpgsql security definer set search_path = public, extensions as $$
declare
  cartella text := split_part(new.name, '/', 1);
begin
  -- Un file che cambia nome nella sua cartella non ne aggiunge uno.
  if tg_op = 'UPDATE' and old.bucket_id = 'iscrizioni' and split_part(old.name, '/', 1) = cartella then return new; end if;
  perform pg_advisory_xact_lock(hashtext('file_iscrizione:' || cartella));
  -- Un nome che c'è già non aggiunge un file: lo ferma il vincolo unico.
  if exists (select 1 from storage.objects o where o.bucket_id = 'iscrizioni' and o.name = new.name) then return new; end if;
  if (select count(*) from storage.objects o where o.bucket_id = 'iscrizioni' and o.name like cartella || '/%')
     >= (iscrizioni_regole()->>'file_per_richiesta')::int then
    raise exception 'Questa richiesta ha già tutti i suoi file: se ne manca uno, scrivi alla segreteria' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function limita_file_iscrizione() from public, anon, authenticated;

notify pgrst, 'reload schema';
