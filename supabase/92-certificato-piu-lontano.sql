-- ---------------------------------------------------------------------------
-- ODS Corsi · accogliendo, vince il certificato che scade dopo
--
-- Accogliendo una richiesta col certificato, se la scheda ne aveva già uno
-- valido il file nuovo restava nella richiesta, ma l'app scriveva lo stesso
-- sulla scheda la data letta sul foglio nuovo: restava il file vecchio con la
-- scadenza nuova, e a fine validità risultava ancora valido. Ora la data
-- viaggia con l'accoglimento (`scade`): se il certificato nuovo scade dopo
-- quello della scheda, o la scheda non ne ha uno valido, file e data nuovi
-- prendono il posto dei vecchi; se no la scheda resta com'era. Un passo solo.
--
-- Solo la segreteria accoglie, come prima. Rifà `accogli_iscrizione` (quella
-- di 90-omonimi-codice-fiscale.sql) con un argomento in più: la firma vecchia
-- si toglie, se no le chiamate senza data non saprebbero quale scegliere.
-- Si lancia dopo `90-omonimi-codice-fiscale.sql`; non chiede di rilanciare
-- `06-iscrizioni.sql`. Rilanciando `06`, `44`, `45`, `53` o `90`, che rifanno
-- la funzione con la firma vecchia, va rilanciato anche questo. Finché non
-- c'è, l'app che manda la data non accoglie: va lanciato prima di pubblicare.
-- Si può rilanciare.
-- ---------------------------------------------------------------------------

drop function if exists accogli_iscrizione(uuid, uuid);

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
        and lower(p.nome) = lower(r.nome) and lower(p.cognome) = lower(r.cognome)
      order by q.gestita_il desc nulls last
      limit 1;
  end if;
  -- O quello dei dati anagrafici, per chi è arrivato dalle risposte del
  -- modulo Google (se `18-anagrafiche.sql` c'è già).
  if chi is null and to_regclass('public.anagrafiche') is not null then
    execute 'select a.persona_id from anagrafiche a join persone p on p.id = a.persona_id and p.ruolo = ''iscritto'' where a.codice_fiscale = $1 and lower(p.nome) = lower($2) and lower(p.cognome) = lower($3) limit 1' into chi using r.codice_fiscale, r.nome, r.cognome;
  end if;
  if chi is null then
    tel := right(regexp_replace(coalesce(r.telefono, ''), '\D', '', 'g'), 10);
    select p.id into chi from persone p
      where p.ruolo = 'iscritto' and lower(p.nome) = lower(r.nome) and lower(p.cognome) = lower(r.cognome)
        and (p.email is null or p.email = r.email
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
    -- L'email già di un'altra persona (un fratello, la mamma, un istruttore)
    -- non è la sua email di accesso: va nel contatto, dove può ripetersi.
    insert into persone (nome, cognome, email, email_contatto, telefono, ruolo)
    values (r.nome, r.cognome,
            case when not exists (select 1 from persone where email = r.email) then r.email end,
            case when exists (select 1 from persone where email = r.email) then r.email end,
            r.telefono, 'iscritto')
    returning id into chi;
  else
    update persone set attiva = true,
      telefono = coalesce(telefono, r.telefono),
      email = coalesce(email, case when not exists (select 1 from persone where email = r.email) then r.email end),
      -- L'email è di un'altra persona: la scheda che c'era la tiene come contatto, se non ne ha già uno.
      email_contatto = coalesce(email_contatto, case when exists (select 1 from persone where email = r.email and id <> chi) then r.email end)
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

  update richieste_iscrizione
    set stato = 'accolta', persona_id = chi, gestita_da = persona_corrente(), gestita_il = now()
    where id = richiesta;
  return chi;
end $$;

revoke all on function accogli_iscrizione(uuid, uuid, date) from public, anon;
grant execute on function accogli_iscrizione(uuid, uuid, date) to authenticated;

notify pgrst, 'reload schema';
