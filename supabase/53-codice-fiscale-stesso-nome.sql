-- Accogliere una richiesta non aggancia più, dal codice fiscale, una scheda
-- con un altro nome: il codice fiscale lo sanno anche altri genitori, e chi lo
-- scrive con un nome diverso finiva sulla scheda di un altro, lo iscriveva ai
-- suoi corsi e gli cambiava il certificato scaduto. Ora le due ricerche per
-- codice fiscale chiedono anche lo stesso nome e cognome; se non tornano si
-- passa alla ricerca per nome (e, se non c'è, nasce una scheda nuova). La
-- segreteria che sa che è la stessa persona la sceglie a mano, dalla lista
-- «In elenco c'è già» o con `persona`.
-- Si può rilanciare.

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
    select id into chi from persone
      where ruolo = 'iscritto' and lower(nome) = lower(r.nome) and lower(cognome) = lower(r.cognome)
        and (email is null or email = r.email
             or (length(tel) >= 9 and right(regexp_replace(coalesce(telefono, ''), '\D', '', 'g'), 10) = tel))
      order by (email = r.email) desc nulls last, creata_il
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
