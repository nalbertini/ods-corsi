-- ---------------------------------------------------------------------------
-- ODS Corsi · l'email di contatto
--
-- `persone.email` è l'email di ACCESSO: una sola persona per indirizzo, e
-- `collega_utente()` (05-segreteria.sql) lega l'account solo per quella.
-- Due fratelli, o un genitore e un figlio, non possono averla uguale; ma la
-- palestra ha bisogno di scrivere alla famiglia. `email_contatto` è quel
-- recapito: facoltativo, uguale per più persone, con la stessa forma
-- dell'email e al massimo 160 lettere. L'app non ci manda mai mail.
--
-- Chi può cosa: come l'email. La legge il personale (`persone_legge`,
-- 02-policy.sql), la scrive solo la segreteria; il tablet e un iscritto no.
-- Qui cambiano due funzioni, con `create or replace`:
--   · `accogli_iscrizione` (06): l'email della richiesta già di un'altra
--     persona va nel contatto della scheda, nuova o già in elenco (se questa
--     non ne ha già uno), non si perde;
--   · `unisci_persone` (29): chi resta tiene la sua email e il suo contatto,
--     e da chi se ne va prende quel che a lui manca. L'indirizzo che non ha
--     posto si perde: lo dice l'app prima di unire.
--
-- Si lancia dopo `43-cerca-persone.sql` (e dopo `06` e `29`). Non chiede di
-- rilanciare `06-iscrizioni.sql`: chiude da sé i permessi delle sue funzioni.
-- Finché non c'è, l'app mostra comunque l'elenco, e dove il contatto non si
-- può salvare dice che manca l'aggiornamento.
-- ---------------------------------------------------------------------------

alter table persone add column if not exists email_contatto citext;
-- Il rilancio: il vincolo si rimette uguale (la colonna è nuova, nessuna riga
-- da sistemare prima).
alter table persone drop constraint if exists persone_email_contatto_forma;
alter table persone add constraint persone_email_contatto_forma
  check (email_contatto ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email_contatto) <= 160);

create or replace function accogli_iscrizione(richiesta uuid, persona uuid default null)
  returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  r richieste_iscrizione;
  chi uuid;
  oggi date := (now() at time zone 'Europe/Rome')::date;
  -- Le ultime dieci cifre: «+39 347 791 7462» e «3477917462» sono lo stesso numero.
  tel text;
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
      join persone p on p.id = q.persona_id
      where q.codice_fiscale = r.codice_fiscale and q.id <> r.id
      order by q.gestita_il desc nulls last
      limit 1;
  end if;
  -- O quello dei dati anagrafici, per chi è arrivato dalle risposte del
  -- modulo Google (se `18-anagrafiche.sql` c'è già).
  if chi is null and to_regclass('public.anagrafiche') is not null then
    execute 'select persona_id from anagrafiche where codice_fiscale = $1 limit 1' into chi using r.codice_fiscale;
  end if;
  if chi is null then
    tel := right(regexp_replace(coalesce(r.telefono, ''), '\D', '', 'g'), 10);
    select id into chi from persone
      where lower(nome) = lower(r.nome) and lower(cognome) = lower(r.cognome)
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

  update richieste_iscrizione
    set stato = 'accolta', persona_id = chi, gestita_da = persona_corrente(), gestita_il = now()
    where id = richiesta;
  return chi;
end $$;

create or replace function unisci_persone(resta uuid, via uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  b persone;
  fk record;
  vince_suo boolean;
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
  -- Chi resta tiene la sua email, e il suo contatto se ce l'ha. L'email di chi
  -- se ne va diventa quella di chi resta se questa non ne ha, se no il suo
  -- contatto, ma solo se è libero (l'app lo dice prima, `indirizziPersi`).
  -- Attiva se una delle due lo era: chi trova un doppione spesso l'ha già disattivato.
  update persone set email = coalesce(email, b.email),
      email_contatto = coalesce(email_contatto, b.email_contatto, case when email is not null and b.email <> email then b.email end),
      telefono = coalesce(telefono, b.telefono), attiva = attiva or b.attiva
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
  update schede_iscritti r
     set certificato_scade = greatest(r.certificato_scade, v.certificato_scade),
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

revoke all on function accogli_iscrizione(uuid, uuid) from public, anon;
grant execute on function accogli_iscrizione(uuid, uuid) to authenticated;
revoke all on function unisci_persone(uuid, uuid) from public, anon;
grant execute on function unisci_persone(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
