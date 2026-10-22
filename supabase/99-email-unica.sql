-- ---------------------------------------------------------------------------
-- ODS Corsi · una sola email per persona
--
-- Prima c'erano due indirizzi: `email` (per entrare nell'app, una per persona)
-- e `email_contatto` (per ricevute e avvisi, facoltativa e ripetibile). Ora
-- `email` è l'unico: serve per entrare, per le ricevute e per gli avvisi.
--
--   · L'unicità vale solo per chi ha un accesso (istruttore, segreteria,
--     amministrazione): è lì che `collega_utente()` lega l'account per email.
--     Gli iscritti possono avere la stessa email (un genitore e i figli).
--   · I dati si portano avanti:
--       - chi ha solo il contatto, lo ha ora come `email` (per chi ha un accesso
--         solo se nessun altro accesso ha già quell'indirizzo);
--       - un iscritto con le due email diverse tiene quella di contatto, che era
--         dove arrivava la posta della famiglia; chi ha un accesso tiene quella
--         di accesso. L'altra NON si conserva (per l'iscritto è quella di
--         accesso, che non gli serve): la query qui sotto le elenca, da
--         guardare e copiare PRIMA di lanciare il file.
--   · `email_contatto` non si toglie: si toglie in un file successivo. Dopo la
--     migrazione i suoi valori già portati in `email` si azzerano: così
--     rilanciare il file non rimette un'email vecchia al posto di una nuova.
--   · `indirizzo_ricevuta` (76) legge `email`; `accogli_iscrizione` (95) e
--     `unisci_persone` (45) non toccano più il contatto.
--
-- Chi può cosa: come prima (la scrive la segreteria, la legge il personale).
-- Si lancia dopo `95-certificato-piu-lontano.sql` (e dopo `45` e `76`); non
-- chiede di rilanciare `06-iscrizioni.sql`. Rilanciando `06`, `44`, `45`, `53`,
-- `90` o `95`, che rifanno quelle funzioni, va rilanciato anche questo.
-- Finché non c'è, l'app che manda una sola email non riesce a salvare due
-- iscritti con lo stesso indirizzo (dice che manca l'aggiornamento): va
-- lanciato prima di pubblicare. Si può rilanciare.
--
-- Prima di lanciarlo, gli indirizzi che il file lascia da parte:
--   select nome, cognome, email as accesso, email_contatto as contatto
--     from persone
--    where ruolo = 'iscritto' and email is not null and email_contatto is not null
--      and email <> email_contatto;
-- ---------------------------------------------------------------------------

-- Prima delle update: il vecchio indice valeva su tutte le righe, e due
-- fratelli con lo stesso contatto lo farebbero fallire.
drop index if exists persone_email_unica;

-- Un iscritto con le due email diverse tiene il contatto: dove scriviamo alla
-- famiglia. Senza `email_contatto` il rilancio non rifà niente.
update persone set email = email_contatto
 where ruolo = 'iscritto' and email_contatto is not null and email is distinct from email_contatto;

-- Chi ha un accesso e solo il contatto, lo tiene come email se è libero fra
-- gli accessi (e il primo, se due lo chiedono).
update persone p set email = p.email_contatto
 where p.email is null and p.email_contatto is not null and p.ruolo <> 'iscritto'
   and not exists (select 1 from persone q where q.id <> p.id and q.ruolo <> 'iscritto' and q.email = p.email_contatto)
   and p.id = (select q.id from persone q
                where q.ruolo <> 'iscritto' and q.email is null and q.email_contatto = p.email_contatto
                order by q.id limit 1);

-- Chi non ha nemmeno quella, ma ha il contatto: l'iscritto senza email.
update persone set email = email_contatto
 where email is null and email_contatto is not null and ruolo = 'iscritto';

-- Quel che è passato in `email` non serve più nella vecchia colonna: un
-- rilancio dopo la pubblicazione non deve rimettere un'email vecchia.
update persone set email_contatto = null
 where email_contatto is not null and (ruolo = 'iscritto' or email = email_contatto);

create unique index persone_email_unica on persone (email) where email is not null and ruolo <> 'iscritto';

-- La forma l'aveva solo `email_contatto` (44): ora vale per l'unica email.
alter table persone drop constraint if exists persone_email_forma;
alter table persone add constraint persone_email_forma
  check (email is null or (email::text ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email::text) <= 160)) not valid;

create or replace function indirizzo_ricevuta(ricevuta uuid) returns text
  language sql stable security definer set search_path = public, extensions as $$
  select nullif(trim(p.email::text), '')
    from ricevute r join persone p on p.id = r.persona_id
   where r.id = indirizzo_ricevuta.ricevuta
$$;

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
    -- Gli iscritti possono dividere l'email (un genitore e i figli): è sempre la sua.
    insert into persone (nome, cognome, email, telefono, ruolo)
    values (r.nome, r.cognome, r.email, r.telefono, 'iscritto')
    returning id into chi;
  else
    update persone set attiva = true,
      telefono = coalesce(telefono, r.telefono),
      email = coalesce(email, r.email)
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

  -- Chi resta tiene la sua email; se non ne ha, prende quella di chi se ne va.
  -- Si uniscono solo iscritti (`unione_possibile`): l'email può ripetersi,
  -- non serve toglierla prima.
  -- Attiva se una delle due lo era: chi trova un doppione spesso l'ha già disattivato.
  update persone set email = coalesce(email, b.email),
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

revoke all on function unisci_persone(uuid, uuid) from public, anon;
grant execute on function unisci_persone(uuid, uuid) to authenticated;

revoke all on function accogli_iscrizione(uuid, uuid, date) from public, anon;
grant execute on function accogli_iscrizione(uuid, uuid, date) to authenticated;

notify pgrst, 'reload schema';
