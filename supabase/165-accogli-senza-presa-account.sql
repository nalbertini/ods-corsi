-- ---------------------------------------------------------------------------
-- 165 · Accogliere non dà la scheda di un iscritto a chi ne scrive il nome
--
-- Accogliendo una richiesta senza scegliere la scheda, `accogli_iscrizione`
-- (148) prendeva per buona una scheda con lo stesso nome e cognome quando
-- era senza email, e ci scriveva l'email della richiesta. L'email è la chiave
-- dell'accesso (`collega_utente`, 101): chiunque mandasse dal modulo pubblico
-- una richiesta col nome di un iscritto senza email, una volta accolta,
-- entrava con la propria email e vedeva ricevute e dati di quell'iscritto.
--
-- Rifatta: `accogli_iscrizione` (148). Cambiano due cose, il resto è lo stesso.
--
--   - nome e cognome da soli non bastano più a trovare la scheda: serve anche
--     la stessa email o lo stesso telefono. Con lo stesso nome e nessun
--     contatto uguale nasce una scheda nuova, come per uno sconosciuto (la
--     segreteria sceglie la scheda da «IN ELENCO C'È GIÀ», o unisce dopo);
--   - email e telefono della richiesta si scrivono su una scheda che c'era
--     già solo se la segreteria l'ha scelta a mano (`persona`) o se la scheda
--     ha la stessa email o lo stesso telefono. Trovata col solo codice
--     fiscale, la scheda prende la richiesta ma tiene i suoi contatti.
--
-- Chi può cosa: come prima, solo la segreteria accoglie.
-- Si lancia dopo `148-nome-compatto.sql`; non chiede di rilanciare
-- `06-iscrizioni.sql`. Rilanciando `06`, `44`, `45`, `53`, `90`, `95`, `99`,
-- `100` o `148`, che rifanno `accogli_iscrizione`, va rilanciato anche questo.
-- Finché non c'è, accogliere funziona come prima, col buco aperto: chi ha lo
-- stesso nome di una scheda senza email va scelto a mano. Si può rilanciare.
-- ---------------------------------------------------------------------------

-- accogli_iscrizione: quella di 148-nome-compatto, senza l'abbinamento per solo nome.
create or replace function accogli_iscrizione(richiesta uuid, persona uuid default null, scade date default null)
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
  nuova_scheda boolean := false;
  -- Se email e telefono della richiesta possono finire sulla scheda trovata.
  contatti boolean;
begin
  if not e_staff() then raise exception 'solo la segreteria' using errcode = '42501'; end if;
  select * into r from richieste_iscrizione where id = richiesta for update;
  if r.id is null then raise exception 'richiesta inesistente' using errcode = 'P0002'; end if;
  if r.stato <> 'nuova' then raise exception 'Questa richiesta è già stata %', r.stato using errcode = '22023'; end if;
  -- Più di tre anni avanti è quasi sempre l'anno sbagliato, come in `salva_certificato`.
  if scade > oggi + interval '3 years' then
    raise exception 'La data è troppo lontana: controlla l''anno.' using errcode = '22023';
  end if;

  if persona is not null then
    select id into chi from persone where id = persona;
    if chi is null then raise exception 'Questa scheda non c''è più' using errcode = 'P0002'; end if;
  end if;

  -- Il codice fiscale è la cosa più sicura: una richiesta già accolta con lo
  -- stesso porta alla stessa persona, anche se stavolta l'ha mandata l'altro
  -- genitore con la sua email. Ma solo se anche nome e cognome tornano: il
  -- codice lo conoscono in tanti, e un nome diverso è un'altra persona (o un
  -- errore) che la segreteria deve scegliere a mano.
  if chi is null then
    select q.persona_id into chi from richieste_iscrizione q
      join persone p on p.id = q.persona_id and p.ruolo = 'iscritto'
      where q.codice_fiscale = r.codice_fiscale and q.id <> r.id
        and nome_compatto(p.nome) = nome_compatto(r.nome) and nome_compatto(p.cognome) = nome_compatto(r.cognome)
      order by q.gestita_il desc nulls last
      limit 1;
  end if;
  -- O quello dei dati anagrafici, per chi è arrivato dalle risposte del
  -- modulo Google (se `18-anagrafiche.sql` c'è già).
  if chi is null and to_regclass('public.anagrafiche') is not null then
    execute 'select a.persona_id from anagrafiche a join persone p on p.id = a.persona_id and p.ruolo = ''iscritto'' where a.codice_fiscale = $1 and nome_compatto(p.nome) = nome_compatto($2) and nome_compatto(p.cognome) = nome_compatto($3) limit 1' into chi using r.codice_fiscale, r.nome, r.cognome;
  end if;
  tel := right(regexp_replace(coalesce(r.telefono, ''), '\D', '', 'g'), 10);
  -- Il nome da solo non basta, neanche se la scheda è senza email: il nome di
  -- un iscritto lo sa chiunque. Serve la stessa email o lo stesso telefono.
  if chi is null then
    select p.id into chi from persone p
      where p.ruolo = 'iscritto' and nome_compatto(p.nome) = nome_compatto(r.nome) and nome_compatto(p.cognome) = nome_compatto(r.cognome)
        and (p.email = r.email
             or (length(tel) >= 9 and right(regexp_replace(coalesce(p.telefono, ''), '\D', '', 'g'), 10) = tel))
        -- Un codice fiscale già noto e diverso è un'altra persona con lo stesso
        -- nome. Uno uguale l'hanno già trovato le due ricerche qui sopra.
        and not exists (select 1 from richieste_iscrizione q
                         where q.persona_id = p.id and q.stato = 'accolta' and q.codice_fiscale <> r.codice_fiscale)
        and not exists (select 1 from anagrafiche a where a.persona_id = p.id and a.codice_fiscale <> r.codice_fiscale)
      order by (p.email = r.email) desc nulls last, p.creata_il
      limit 1;
  end if;
  if chi is null then
    nuova_scheda := true;
    -- Gli iscritti possono dividere l'email (un genitore e i figli): è sempre la sua.
    insert into persone (nome, cognome, email, telefono, ruolo)
    values (r.nome, r.cognome, r.email, r.telefono, 'iscritto')
    returning id into chi;
  else
    -- L'email è la chiave dell'accesso (`collega_utente`, 101): su una scheda
    -- che c'era già si scrive, col telefono, solo se la segreteria l'ha scelta
    -- a mano o se la scheda ha già la stessa email o lo stesso telefono.
    -- Trovata col solo codice fiscale, prende la richiesta e tiene i suoi contatti.
    contatti := persona is not null or exists (
      select 1 from persone p where p.id = chi
        and (p.email = r.email
             or (length(tel) >= 9 and right(regexp_replace(coalesce(p.telefono, ''), '\D', '', 'g'), 10) = tel)));
    update persone set attiva = true,
      telefono = case when contatti then coalesce(telefono, r.telefono) else telefono end,
      email = case when contatti then coalesce(email, r.email) else email end
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
  -- quello che la scheda aveva, con la data che la segreteria ha letto sul
  -- foglio (senza, la data della scheda non si tocca). Se ce n'è più d'uno
  -- vale l'ultimo; uno sbagliato la segreteria lo toglie prima di accogliere.
  select o.name into cert from storage.objects o
    where o.bucket_id = 'iscrizioni' and o.name ~ ('^' || richiesta::text || '/certificato\.(jpg|jpeg|png|webp|heic|heif|pdf)$')
    order by o.created_at desc, o.name limit 1;
  -- Se la scheda ha già un certificato ancora valido che non scade prima di quello nuovo, il file della
  -- richiesta non lo sostituisce: resta fra i file della richiesta, per la segreteria. Senza data non
  -- si sa quale scade dopo, e vince quello che c'è.
  if cert is not null and not exists (
       select 1 from schede_iscritti where persona_id = chi and certificato_file is not null and certificato_scade >= oggi
         and (scade is null or certificato_scade >= scade)) then
    nuovo := chi::text || '/certificato-' || (extract(epoch from clock_timestamp()) * 1000)::bigint || '.' || substring(cert from '\.([a-z]+)$');
    perform togli_file_certificato(chi);
    update storage.objects set bucket_id = 'certificati', name = nuovo where bucket_id = 'iscrizioni' and name = cert;
    insert into schede_iscritti (persona_id, certificato_file, certificato_caricato_il, certificato_scade) values (chi, nuovo, now(), scade)
      on conflict (persona_id) do update set certificato_file = excluded.certificato_file, certificato_caricato_il = excluded.certificato_caricato_il,
        certificato_scade = coalesce(excluded.certificato_scade, schede_iscritti.certificato_scade);
    -- Gli altri certificato.* della richiesta, se ce n'erano.
    perform set_config('storage.allow_delete_query', 'true', true);
    delete from storage.objects where bucket_id = 'iscrizioni' and name ~ ('^' || richiesta::text || '/certificato\.');
  end if;

  -- Una persona aggiunta «per il nucleo di» entra nel nucleo solo se le regole
  -- del nucleo lo permettono ora (il titolare può essere cambiato nel frattempo,
  -- o la scheda trovata avere già un nucleo suo): se no l'iscrizione si accoglie
  -- lo stesso, senza nucleo, e la segreteria lo sistema dalla scheda.
  -- Solo a una scheda appena creata: il modulo lo manda anche chi non ha fatto
  -- l'accesso, e una scheda che c'era già non si sposta con una richiesta.
  if r.nucleo_di is not null and nuova_scheda and nucleo_non_va(chi, r.nucleo_di) is null then
    update persone set nucleo = r.nucleo_di where id = chi;
  end if;

  update richieste_iscrizione
    set stato = 'accolta', persona_id = chi, gestita_da = persona_corrente(), gestita_il = now()
    where id = richiesta;
  return chi;
end $$;

revoke all on function accogli_iscrizione(uuid, uuid, date) from public, anon;
grant execute on function accogli_iscrizione(uuid, uuid, date) to authenticated;

notify pgrst, 'reload schema';
