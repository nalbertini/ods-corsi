-- ---------------------------------------------------------------------------
-- ODS Corsi · unire due schede della stessa persona
--
-- Un doppione nasce quando chi fa l'appello non ritrova chi è già venuto a
-- provare e lo aggiunge di nuovo (21-prove.sql), o da un import. La
-- segreteria lo unisce: una scheda resta, l'altra se ne va e tutto il suo
-- passa a quella che resta. Non si torna indietro, e o passa tutto o niente.
--
-- Solo la segreteria (ruolo doppio compreso), solo fra due iscritti senza
-- accesso: le schede del personale hanno corsi, PIN e compensi, e un accesso
-- è un account da non perdere. Non si uniscono due schede con due codici
-- fiscali diversi, anche solo dal modulo accolto (sono due persone). Il file
-- del certificato non ferma più l'unione dal `44-certificati-online.sql`, che
-- rifà `unione_possibile` e `unisci_persone` (rilanciando questo, va
-- rilanciato anche il 44).
--
-- Cosa passa:
--   · nome, email, telefono, anagrafica e scheda: vince chi resta, e da
--     quella che se ne va si prendono solo i campi vuoti; del certificato la
--     scadenza più lontana, e del pagamento quello che arriva più lontano;
--   · presenze e prove: una per lezione; fra due presenze vince presente,
--     poi giustificato, poi assente;
--   · iscrizioni: una per corso, dalla data più vecchia alla fine più
--     lontana (nessuna fine se una delle due non ce l'ha);
--   · ricevute e richieste di iscrizione: passano così come sono.
-- Ogni altro riferimento a `persone` (anche di file che verranno) passa da
-- sé: lo legge da `pg_constraint`. Se uno non può passare, si ferma tutto.
--
-- Un appello fatto senza rete che arriva dopo sulla scheda che non c'è più
-- non entra: la guida dice di unire quando gli appelli del giorno sono
-- arrivati.
--
-- Si lancia dopo `28-elimina-istruttore.sql`. Chiude da sé le sue funzioni:
-- non chiede di rilanciare `06-iscrizioni.sql`. Finché non c'è, UNISCI nella
-- scheda dell'iscritto dice che va lanciato.
-- ---------------------------------------------------------------------------

/** I controlli, uguali per l'anteprima e per l'unione. */
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
  if exists (select 1 from schede_iscritti where persona_id = via and certificato_file is not null) then
    raise exception 'La scheda di % % ha ancora il file del certificato: stampalo, cancellalo dalla scheda e riprova', b.nome, b.cognome;
  end if;
end $$;

/** Quante righe della scheda che se ne va passano a quella che resta. */
create or replace function anteprima_unione(resta uuid, via uuid) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform unione_possibile(resta, via);
  return json_build_object(
    'presenze', (select count(*) from presenze where persona_id = via),
    'prove', (select count(*) from prove where persona_id = via),
    'iscrizioni', (select count(*) from iscrizioni where persona_id = via),
    'ricevute', (select count(*) from ricevute where persona_id = via));
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

revoke all on function unione_possibile(uuid, uuid) from public, anon, authenticated;
revoke all on function anteprima_unione(uuid, uuid) from public, anon;
revoke all on function unisci_persone(uuid, uuid) from public, anon;
grant execute on function anteprima_unione(uuid, uuid) to authenticated;
grant execute on function unisci_persone(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
