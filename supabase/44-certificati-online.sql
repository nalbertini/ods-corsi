-- ---------------------------------------------------------------------------
-- ODS Corsi · il certificato medico resta nell'app
--
-- Il certificato medico non si stampa più: il file (una foto o un PDF, al
-- massimo 10 MB) sta nello Storage, in un contenitore privato, `certificati`,
-- in una cartella per persona (`<persona>/certificato-<n>.<est>`). Lo vede e lo
-- apre solo la segreteria, con un link che dura dieci minuti: istruttori,
-- iscritti, tablet e chi non ha un accesso non lo leggono, e non sanno nemmeno
-- se c'è. La carta sparisce; resta quella del documento d'identità.
--
-- Una persona ha un file solo. `salva_certificato(persona, file, scade)` lo
-- mette sulla scheda insieme alla data, in un passaggio solo: il file nuovo
-- prende il posto del vecchio (anche nel contenitore) e `certificato_caricato_il`
-- dice quando. Un file senza `certificato_caricato_il` è di prima della
-- carta: si apre come gli altri, e la scheda lo dice. La data la scrive la
-- segreteria: un certificato arrivato col modulo ha il file e non la data,
-- finché non la scrive.
--
-- Quanto resta:
--   · fino a 30 giorni dopo la scadenza: poi il file si cancella (la data
--     resta) con `pulisci_certificati()`, ogni notte con pg_cron se c'è;
--   · se la persona è disattivata: il file si cancella subito, la data
--     resta, e riattivarla non lo riporta.
--
-- Cosa cambia degli altri file, qui rifatto per intero:
--   · `accogli_iscrizione` (06): il certificato della richiesta passa alla
--     scheda, nel contenitore `certificati`, senza data, a meno che la scheda
--     non ne abbia già uno ancora valido (allora il file resta nella richiesta,
--     per la segreteria); trova «chi è già in elenco» solo fra gli iscritti;
--   · `richieste_con_documento` (06): da stampare restano documento e retro;
--   · `unione_possibile` e `unisci_persone` (29): un file di certificato non
--     ferma più l'unione, passa a chi resta (se ce n'è uno per parte, quello
--     con la scadenza più lontana, e l'altro si cancella).
--
-- I file nello Storage si cancellano da SQL come fa `pulisci_allegati`
-- (32-segnalazioni-allegati.sql): la riga se ne va e il file non si apre più,
-- ma lo Storage può tenerne la copia fisica (vedi supabase/LEGGIMI.md).
--
-- Si lancia dopo `43-cerca-persone.sql` (e quindi 06, 07 e 29). Chiude da sé
-- le sue funzioni. Rilanciare `06-iscrizioni.sql` o `29-unisci-doppioni.sql`
-- riporta le loro funzioni a com'erano: dopo, va rilanciato anche questo.
-- Finché non c'è, la scheda dice che va lanciato questo file, e il
-- certificato resta su carta come prima.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('certificati', 'certificati', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Quando è stato caricato: senza, è un file di prima della carta. Resta anche
-- quando il file si cancella (a scadenza + 30 giorni, o alla disattivazione):
-- la scheda sa così che un file c'è stato, e dice «file cancellato». Lo azzera
-- solo TOGLI IL CERTIFICATO.
alter table schede_iscritti add column if not exists certificato_caricato_il timestamptz;

-- Solo la segreteria: legge, carica nella cartella di un iscritto che c'è
-- (`<persona>/certificato-<n>.<est>`) e cancella.
drop policy if exists certificati_carica on storage.objects;
drop policy if exists certificati_legge on storage.objects;
drop policy if exists certificati_cancella on storage.objects;
create policy certificati_carica on storage.objects for insert to authenticated
  with check (bucket_id = 'certificati' and public.e_staff()
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/certificato-[0-9]+\.(jpg|jpeg|png|webp|heic|heif|pdf)$'
    and exists (select 1 from public.persone p where p.id::text = split_part(name, '/', 1) and p.ruolo = 'iscritto'));
create policy certificati_legge on storage.objects for select to authenticated
  using (bucket_id = 'certificati' and public.e_staff());
create policy certificati_cancella on storage.objects for delete to authenticated
  using (bucket_id = 'certificati' and public.e_staff());

-- Toglie i file di una persona dal contenitore, tranne `tranne`. Lo Storage
-- di Supabase vieta di cancellare da SQL se non glielo si dice (per questa
-- sola transazione): senza, la riga resterebbe e il file si aprirebbe ancora.
create or replace function togli_file_certificato(cartella uuid, tranne text default null)
  returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.objects where bucket_id = 'certificati' and name like cartella::text || '/%' and name is distinct from tranne;
end $$;

-- Il file e la data insieme. Il file è già nel contenitore (lo ha caricato
-- l'app, nella cartella di questa persona): qui si controlla, si mette sulla
-- scheda e si toglie quello di prima. Se qualcosa non va non cambia niente.
create or replace function salva_certificato(persona uuid, file text, scade date)
  returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not e_staff() then raise exception 'solo la segreteria' using errcode = '42501'; end if;
  -- La persona prima di tutto: per una che non c'è, o è disattivata, il testo è lo stesso
  -- qualunque sia il file. A una disattivata il file non si rimette (vedi più sotto).
  if not exists (select 1 from persone where id = persona and ruolo = 'iscritto' and attiva) then
    raise exception 'Persona inesistente' using errcode = 'P0002';
  end if;
  if scade is null then raise exception 'Serve la data di scadenza del certificato' using errcode = '22023'; end if;
  -- Più di tre anni avanti è quasi sempre l'anno sbagliato.
  if scade > ((now() at time zone 'Europe/Rome')::date + interval '3 years')::date then
    raise exception 'La data è troppo lontana: controlla l''anno.' using errcode = '22023';
  end if;
  if file is null or split_part(file, '/', 1) <> persona::text then
    raise exception 'Il file non è di questa persona' using errcode = '22023';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'certificati' and name = file) then
    raise exception 'Il file non è stato caricato: riprova' using errcode = '22023';
  end if;
  insert into schede_iscritti (persona_id, certificato_scade, certificato_file, certificato_caricato_il)
    values (persona, scade, file, now())
  on conflict (persona_id) do update
    set certificato_scade = excluded.certificato_scade, certificato_file = excluded.certificato_file, certificato_caricato_il = excluded.certificato_caricato_il;
  perform togli_file_certificato(persona, file);
end $$;

-- Trenta giorni dopo la scadenza il file se ne va, la data resta; se ne vanno
-- anche i file senza scheda. Dice quanti ne ha tolti. La lancia il database (pg_cron), non la segreteria. Un file che
-- non si riesce a cancellare resta com'è e si riprova la notte dopo.
create or replace function pulisci_certificati()
  returns int language plpgsql security definer set search_path = public, extensions as $$
declare
  n int := 0;
  s record;
begin
  for s in
    select persona_id from schede_iscritti
    where certificato_file is not null and certificato_scade <= (now() at time zone 'Europe/Rome')::date - 30
  loop
    begin
      perform togli_file_certificato(s.persona_id);
      update schede_iscritti set certificato_file = null where persona_id = s.persona_id;
      n := n + 1;
    exception when others then
      raise notice 'certificato di % non tolto: %', s.persona_id, sqlerrm;
    end;
  end loop;
  -- I file che nessuna scheda tiene (un caricamento a metà, una persona
  -- cancellata): dopo un giorno, perché uno appena caricato aspetta ancora
  -- `salva_certificato`.
  for s in
    select o.name from storage.objects o
    where o.bucket_id = 'certificati' and o.created_at < now() - interval '1 day'
      and not exists (select 1 from schede_iscritti c where c.certificato_file = o.name)
  loop
    begin
      perform set_config('storage.allow_delete_query', 'true', true);
      delete from storage.objects where bucket_id = 'certificati' and name = s.name;
      n := n + 1;
    exception when others then
      raise notice 'file % non tolto: %', s.name, sqlerrm;
    end;
  end loop;
  return n;
end $$;

-- Disattivare una persona toglie il file; la data resta. Riattivarla no.
create or replace function certificato_alla_disattivazione()
  returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  perform togli_file_certificato(new.id);
  update schede_iscritti set certificato_file = null where persona_id = new.id and certificato_file is not null;
  return new;
end $$;
-- Cancellata la persona, il suo file non resta nel contenitore (`schede_iscritti` se ne va da sé).
create or replace function certificato_alla_cancellazione()
  returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  perform togli_file_certificato(old.id);
  return old;
end $$;
drop trigger if exists persone_certificato_cancellata on persone;
create trigger persone_certificato_cancellata before delete on persone
  for each row execute function certificato_alla_cancellazione();
drop trigger if exists persone_certificato_disattivata on persone;
create trigger persone_certificato_disattivata after update of attiva on persone
  for each row when (old.attiva and not new.attiva) execute function certificato_alla_disattivazione();

-- Accogliere una richiesta, da qui in poi col certificato che passa alla scheda.
create or replace function accogli_iscrizione(richiesta uuid, persona uuid default null)
  returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  r richieste_iscrizione;
  chi uuid;
  oggi date := (now() at time zone 'Europe/Rome')::date;
  -- Le ultime dieci cifre: «+39 347 791 7462» e «3477917462» sono lo stesso numero.
  tel text;
  -- Il certificato arrivato con la richiesta.
  cert text;
  nuovo text;
begin
  if not e_staff() then raise exception 'solo la segreteria' using errcode = '42501'; end if;
  select * into r from richieste_iscrizione where id = richiesta for update;
  if r.id is null then raise exception 'richiesta inesistente' using errcode = 'P0002'; end if;
  if r.stato <> 'nuova' then raise exception 'Questa richiesta è già stata %', r.stato using errcode = '22023'; end if;

  if persona is not null then
    select id into chi from persone where id = persona;
    if chi is null then raise exception 'Questa scheda non c''è più' using errcode = 'P0002'; end if;
  end if;

  -- Il codice fiscale è l'unica cosa sicura: una richiesta già accolta con lo
  -- stesso porta alla stessa persona, anche se stavolta l'ha mandata l'altro
  -- genitore con la sua email.
  if chi is null then
    select q.persona_id into chi from richieste_iscrizione q
      join persone p on p.id = q.persona_id and p.ruolo = 'iscritto'
      where q.codice_fiscale = r.codice_fiscale and q.id <> r.id
      order by q.gestita_il desc nulls last
      limit 1;
  end if;
  -- O quello dei dati anagrafici, per chi è arrivato dalle risposte del
  -- modulo Google (se `18-anagrafiche.sql` c'è già).
  if chi is null and to_regclass('public.anagrafiche') is not null then
    execute 'select a.persona_id from anagrafiche a join persone p on p.id = a.persona_id and p.ruolo = ''iscritto'' where a.codice_fiscale = $1 limit 1' into chi using r.codice_fiscale;
  end if;
  if chi is null then
    tel := right(regexp_replace(coalesce(r.telefono, ''), '\D', '', 'g'), 10);
    select id into chi from persone
      where ruolo = 'iscritto' and lower(nome) = lower(r.nome) and lower(cognome) = lower(r.cognome)
        and (email is null or email = r.email
             or (length(tel) >= 9 and right(regexp_replace(coalesce(telefono, ''), '\D', '', 'g'), 10) = tel))
      order by (email = r.email) desc nulls last, creata_il
      limit 1;
  end if;
  if chi is null then
    insert into persone (nome, cognome, email, telefono, ruolo)
    values (r.nome, r.cognome,
            case when not exists (select 1 from persone where email = r.email) then r.email end,
            r.telefono, 'iscritto')
    returning id into chi;
  else
    update persone set attiva = true,
      telefono = coalesce(telefono, r.telefono),
      email = coalesce(email, case when not exists (select 1 from persone where email = r.email) then r.email end)
    where id = chi;
  end if;

  -- Chi è già iscritto resta com'è; chi aveva una fine segnata la perde, e
  -- chi aveva già smesso riparte da oggi.
  insert into iscrizioni (corso_id, persona_id, dal)
    select c.id, chi, oggi from corsi c where c.id = any (r.corsi) and c.attivo
  on conflict (corso_id, persona_id) do update
    set dal = case when iscrizioni.al < oggi then oggi else iscrizioni.dal end, al = null
    where iscrizioni.al is not null;

  -- Il certificato allegato passa alla scheda, nel contenitore dei
  -- certificati e non più nella cartella della richiesta. Prende il posto di
  -- quello che la scheda aveva, e la data di scadenza non si tocca: la scrive
  -- la segreteria, che sulla foto non l'ha ancora letta. Se ce n'è più d'uno
  -- vale l'ultimo; uno sbagliato la segreteria lo toglie prima di accogliere.
  select o.name into cert from storage.objects o
    where o.bucket_id = 'iscrizioni' and o.name ~ ('^' || richiesta::text || '/certificato\.(jpg|jpeg|png|webp|heic|heif|pdf)$')
    order by o.created_at desc, o.name limit 1;
  -- Se la scheda ha già un certificato ancora valido il file della richiesta non lo sostituisce
  -- (potrebbe essere sbagliato, o di un'altra persona): resta fra i file della richiesta, per la segreteria.
  if cert is not null and not exists (
       select 1 from schede_iscritti where persona_id = chi and certificato_file is not null and certificato_scade >= oggi) then
    nuovo := chi::text || '/certificato-' || (extract(epoch from clock_timestamp()) * 1000)::bigint || '.' || substring(cert from '\.([a-z]+)$');
    perform togli_file_certificato(chi);
    update storage.objects set bucket_id = 'certificati', name = nuovo where bucket_id = 'iscrizioni' and name = cert;
    insert into schede_iscritti (persona_id, certificato_file, certificato_caricato_il) values (chi, nuovo, now())
      on conflict (persona_id) do update set certificato_file = excluded.certificato_file, certificato_caricato_il = excluded.certificato_caricato_il;
    -- Gli altri certificato.* della richiesta, se ce n'erano.
    perform set_config('storage.allow_delete_query', 'true', true);
    delete from storage.objects where bucket_id = 'iscrizioni' and name ~ ('^' || richiesta::text || '/certificato\.');
  end if;

  update richieste_iscrizione
    set stato = 'accolta', persona_id = chi, gestita_da = persona_corrente(), gestita_il = now()
    where id = richiesta;
  return chi;
end $$;

-- Da stampare restano il documento e il retro: il certificato non si stampa più.
create or replace function richieste_con_documento()
  returns uuid[] language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not e_staff() then raise exception 'solo la segreteria' using errcode = '42501'; end if;
  return coalesce((
    select array_agg(distinct split_part(o.name, '/', 1)::uuid) from storage.objects o
    where o.bucket_id = 'iscrizioni'
      and o.name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(documento|documento-retro)\.[a-z]+$'), '{}');
end $$;

-- Unire due schede: un file di certificato non ferma più l'unione.
-- I controlli, uguali per l'anteprima e per l'unione.
create or replace function unione_possibile(resta uuid, via uuid) returns void
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  a persone;
  b persone;
  cf_a text;
  cf_b text;
begin
  if not e_staff() then
    raise exception 'Non hai il permesso: serve un accesso da segreteria' using errcode = '42501';
  end if;
  if resta = via then raise exception 'Scegli due schede diverse'; end if;
  select * into a from persone where id = resta;
  select * into b from persone where id = via;
  if a.id is null or b.id is null then raise exception 'Una delle due schede non c''è più: ricarica la pagina'; end if;
  if a.ruolo <> 'iscritto' or b.ruolo <> 'iscritto' then
    raise exception 'Si uniscono solo le schede degli iscritti, non quelle del personale';
  end if;
  if a.utente_id is not null or b.utente_id is not null then
    raise exception 'Una delle due schede ha un accesso all''app: non si unisce. Se è un doppione, disattiva quella senza accesso';
  end if;
  -- Il codice fiscale scritto in segreteria, se no quello del modulo accolto.
  select coalesce((select codice_fiscale from anagrafiche where persona_id = resta),
                  (select codice_fiscale from richieste_iscrizione where persona_id = resta and stato = 'accolta' order by gestita_il desc nulls last limit 1))
    into cf_a;
  select coalesce((select codice_fiscale from anagrafiche where persona_id = via),
                  (select codice_fiscale from richieste_iscrizione where persona_id = via and stato = 'accolta' order by gestita_il desc nulls last limit 1))
    into cf_b;
  if cf_a is not null and cf_b is not null and cf_a <> cf_b then
    raise exception 'Hanno due codici fiscali diversi: non sono la stessa persona. Se uno è sbagliato, correggilo nella scheda e riprova';
  end if;
end $$;

create or replace function unisci_persone(resta uuid, via uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  b persone;
  fk record;
  vince_suo boolean;
  -- Il file del certificato: di chi resta, o di chi se ne va se ha la scadenza più lontana.
  file_suo boolean;
  v_file text;
  v_caricato timestamptz;
  nuovo text;
begin
  if not e_staff() then
    raise exception 'Non hai il permesso: serve un accesso da segreteria' using errcode = '42501';
  end if;
  -- Le due schede si bloccano prima dei controlli: chi scrive in quel momento
  -- su quella che se ne va (una prova, un'iscrizione, una ricevuta) aspetta,
  -- e la sua riga passa con le altre; se no il `delete` in fondo la
  -- porterebbe via in silenzio. Vale anche per chi le cambia ruolo o accesso.
  perform 1 from persone where id in (resta, via) order by id for update;
  perform unione_possibile(resta, via);
  select * into b from persone where id = via;

  -- Prima si toglie l'email a chi se ne va: è unica (persone_email_unica).
  update persone set email = null where id = via;
  -- Attiva se una delle due lo era: chi trova un doppione spesso l'ha già disattivato.
  update persone set email = coalesce(email, b.email), telefono = coalesce(telefono, b.telefono), attiva = attiva or b.attiva
   where id = resta;

  -- Presenze. Spostarle non è segnarle: `presenze_chi_segna` (03-funzioni.sql)
  -- scriverebbe la segreteria come chi le ha segnate, adesso, dall'appello.
  -- Spento solo qui: l'`alter table` tiene la tabella bloccata fino alla fine
  -- della transazione, e se qualcosa va storto si riaccende con il resto.
  -- Lo stato non si aggiorna mai, si tiene la riga che vince: un `update of
  -- stato` farebbe partire `presenze_istruttore_dall_appello` (23).
  alter table presenze disable trigger presenze_chi_segna;
  delete from presenze r using presenze v
   where r.persona_id = resta and v.persona_id = via and r.sessione_id = v.sessione_id
     and array_position(array['presente', 'giustificato', 'assente'], v.stato::text)
       < array_position(array['presente', 'giustificato', 'assente'], r.stato::text);
  delete from presenze v using presenze r
   where v.persona_id = via and r.persona_id = resta and r.sessione_id = v.sessione_id;
  update presenze set persona_id = resta where persona_id = via;
  alter table presenze enable trigger presenze_chi_segna;

  delete from prove v using prove r
   where v.persona_id = via and r.persona_id = resta and r.sessione_id = v.sessione_id;
  update prove set persona_id = resta where persona_id = via;

  update iscrizioni r
     set dal = least(r.dal, v.dal),
         al = case when r.al is null or v.al is null then null else greatest(r.al, v.al) end
    from iscrizioni v
   where v.persona_id = via and r.persona_id = resta and r.corso_id = v.corso_id;
  delete from iscrizioni v using iscrizioni r
   where v.persona_id = via and r.persona_id = resta and r.corso_id = v.corso_id;
  update iscrizioni set persona_id = resta where persona_id = via;

  -- Scheda e anagrafica: una riga per persona.
  insert into schede_iscritti (persona_id)
    select resta where exists (select 1 from schede_iscritti where persona_id = via)
    on conflict (persona_id) do nothing;
  select r.pagamento = 'da_pagare'
         or (case when v.pagamento = 'pagato' and v.pagato_fino is null then 'infinity' else coalesce(v.pagato_fino, '-infinity') end)
          > (case when r.pagamento = 'pagato' and r.pagato_fino is null then 'infinity' else coalesce(r.pagato_fino, '-infinity') end)
    into vince_suo
    from schede_iscritti r, schede_iscritti v
   where r.persona_id = resta and v.persona_id = via;
  select v.certificato_file, v.certificato_caricato_il,
         v.certificato_file is not null
           and (r.certificato_file is null or coalesce(v.certificato_scade, '-infinity') > coalesce(r.certificato_scade, '-infinity'))
    into v_file, v_caricato, file_suo
    from schede_iscritti r, schede_iscritti v
   where r.persona_id = resta and v.persona_id = via;
  if v_file is not null then
    if file_suo then
      perform togli_file_certificato(resta);
      nuovo := resta::text || '/certificato-' || (extract(epoch from clock_timestamp()) * 1000)::bigint || '.' || substring(v_file from '\.([a-z]+)$');
      update storage.objects set name = nuovo where bucket_id = 'certificati' and name = v_file;
    end if;
  end if;
  -- Quel che resta nella cartella di chi se ne va (il file scartato, o uno rimasto senza scheda) si cancella.
  perform togli_file_certificato(via);
  update schede_iscritti r
     set -- La data è quella del certificato il cui file resta; se nessuno ha un file, la più lontana.
         certificato_scade = case when coalesce(file_suo, false) then v.certificato_scade
                                  when r.certificato_file is not null then r.certificato_scade
                                  else greatest(r.certificato_scade, v.certificato_scade) end,
         certificato_file = case when coalesce(file_suo, false) then nuovo else r.certificato_file end,
         certificato_caricato_il = case when coalesce(file_suo, false) then v_caricato else r.certificato_caricato_il end,
         documento_in_segreteria = r.documento_in_segreteria or v.documento_in_segreteria,
         -- Il pagamento che arriva più lontano si tiene intero, stato e data:
         -- «pagato» senza data vuol dire senza scadenza (07-certificati-pagamenti.sql).
         pagamento = case when vince_suo then v.pagamento else r.pagamento end,
         pagato_fino = case when vince_suo then v.pagato_fino else r.pagato_fino end,
         pagamento_nota = coalesce(r.pagamento_nota, v.pagamento_nota)
    from schede_iscritti v
   where v.persona_id = via and r.persona_id = resta;
  delete from schede_iscritti where persona_id = via;

  insert into anagrafiche (persona_id)
    select resta where exists (select 1 from anagrafiche where persona_id = via)
    on conflict (persona_id) do nothing;
  update anagrafiche r
     set nato_il = coalesce(r.nato_il, v.nato_il),
         nato_a = coalesce(r.nato_a, v.nato_a),
         codice_fiscale = coalesce(r.codice_fiscale, v.codice_fiscale),
         indirizzo = coalesce(r.indirizzo, v.indirizzo),
         cap = coalesce(r.cap, v.cap),
         comune = coalesce(r.comune, v.comune),
         genitore_nome = coalesce(r.genitore_nome, v.genitore_nome),
         genitore_cognome = coalesce(r.genitore_cognome, v.genitore_cognome),
         genitore_codice_fiscale = coalesce(r.genitore_codice_fiscale, v.genitore_codice_fiscale),
         genitore_nato = coalesce(r.genitore_nato, v.genitore_nato)
    from anagrafiche v
   where v.persona_id = via and r.persona_id = resta;
  delete from anagrafiche where persona_id = via;

  -- Tutto il resto (ricevute, richieste, e quel che verrà): passa com'è.
  for fk in
    select c.conrelid::regclass as tabella, a.attname as colonna
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
     where c.contype = 'f' and c.confrelid = 'public.persone'::regclass
       and cardinality(c.conkey) = 1 and c.conrelid <> 'public.persone'::regclass
  loop
    execute format('update %s set %I = $1 where %I = $2', fk.tabella, fk.colonna, fk.colonna) using resta, via;
  end loop;

  delete from persone where id = via;
end $$;


-- ---------------------------------------------------------------------------
-- Chi può chiamare cosa.
-- ---------------------------------------------------------------------------
revoke all on function togli_file_certificato(uuid, text), pulisci_certificati(), certificato_alla_disattivazione(), certificato_alla_cancellazione(), unione_possibile(uuid, uuid) from public, anon, authenticated;
revoke all on function salva_certificato(uuid, text, date), accogli_iscrizione(uuid, uuid), richieste_con_documento(), unisci_persone(uuid, uuid) from public, anon;
grant execute on function salva_certificato(uuid, text, date), accogli_iscrizione(uuid, uuid), richieste_con_documento(), unisci_persone(uuid, uuid) to authenticated;

-- Ogni notte, se Supabase ha pg_cron acceso (Database → Extensions). Se no
-- il file si lancia lo stesso e `pulisci_certificati()` si lancia a mano.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'pulisci-certificati';
  perform cron.schedule('pulisci-certificati', '45 3 * * *', 'select public.pulisci_certificati()');
exception when others then
  raise notice 'pg_cron non c''è: pulisci_certificati() si lancia a mano';
end $$;

notify pgrst, 'reload schema';
