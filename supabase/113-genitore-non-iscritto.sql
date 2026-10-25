-- ---------------------------------------------------------------------------
-- ODS Corsi · il genitore non iscritto, titolare del nucleo dei figli
--
-- Due fratelli minorenni senza un genitore iscritto non avevano un nucleo: il
-- titolare deve essere maggiorenne (`100-nucleo.sql`), e l'unico adulto della
-- famiglia non era una scheda. Ora la segreteria lo aggiunge dal blocco
-- GENITORE di un figlio: `aggiungi_genitore` crea una persona col segno
-- `genitore_non_iscritto` (niente corsi, quota né certificato, e non conta fra
-- gli iscritti), le scrive il codice fiscale in `anagrafiche` e ci mette il
-- figlio nel nucleo. I fratelli si riconoscono dal codice fiscale del genitore.
--   · solo la segreteria (`e_staff()`), con i messaggi di `src/lib/nucleo.ts`;
--   · senza nome e cognome non crea niente;
--   · senza un codice fiscale valido, o se è già di un'altra persona, non crea
--     niente: la persona c'è già, e il figlio si mette nel suo nucleo;
--   · per il figlio valgono le regole di `nucleo_non_va`;
--   · iscritto a un corso (anche unendogli una scheda iscritta), il genitore perde il segno: è un iscritto come gli
--     altri, resta titolare e i figli restano nel suo nucleo.
-- Le due adulte (sorelle, coppie) andavano già: il nucleo fra adulti non cambia.
--
-- Si lancia dopo `100-nucleo.sql`. Non chiede di rilanciare `06-iscrizioni.sql`.
-- Si può rilanciare. Finché non c'è, l'elenco si legge senza il segno e
-- «Aggiungi il genitore» risponde che va lanciato questo file.
-- ---------------------------------------------------------------------------

alter table persone add column if not exists genitore_non_iscritto boolean not null default false;

create or replace function aggiungi_genitore(figlio uuid, nome text, cognome text, codice_fiscale text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  cf text := upper(regexp_replace(coalesce(codice_fiscale, ''), '\s', '', 'g'));
  no text;
  nuovo uuid;
begin
  if not e_staff() then
    raise exception 'Non hai il permesso: serve un accesso da segreteria' using errcode = '42501';
  end if;
  if coalesce(trim(nome), '') = '' or coalesce(trim(cognome), '') = '' then
    raise exception 'Scrivi nome e cognome del genitore';
  end if;
  if cf !~ '^[A-Z0-9]{16}$' then
    raise exception 'Per aggiungere il genitore serve il suo codice fiscale';
  end if;
  -- Due clic insieme con lo stesso codice: il secondo aspetta il primo e trova il genitore già fatto.
  perform pg_advisory_xact_lock(hashtext('aggiungi_genitore'), hashtext(cf));
  perform 1 from persone where id = figlio for update;
  -- Lo stesso codice in una scheda o in un modulo accolto: è già lui, niente doppioni.
  -- Anche quello del figlio: non è mai il suo genitore.
  if exists (select 1 from anagrafiche a where a.codice_fiscale = cf)
     or exists (select 1 from richieste_iscrizione q where q.stato = 'accolta' and q.persona_id is not null
                  and upper(regexp_replace(coalesce(q.codice_fiscale, ''), '\s', '', 'g')) = cf) then
    raise exception 'C’è già una persona con questo codice fiscale: mettilo nel suo nucleo';
  end if;
  -- Le regole del figlio prima di creare: un rifiuto non lascia una scheda in più.
  if not exists (select 1 from persone where id = figlio and ruolo = 'iscritto') then raise exception 'Persona inesistente'; end if;
  if exists (select 1 from persone where id = figlio and not attiva) then raise exception 'Le schede disattivate non entrano in un nucleo'; end if;
  if exists (select 1 from persone where id = figlio and nucleo is not null) then raise exception 'È già nel nucleo di un altro: prima toglilo da lì'; end if;
  if exists (select 1 from persone where nucleo = figlio) then
    raise exception 'Ha un nucleo suo, con altri dentro: prima toglili, o fai titolare un altro';
  end if;
  insert into persone (nome, cognome, ruolo, genitore_non_iscritto)
    values (trim(nome), trim(cognome), 'iscritto', true) returning id into nuovo;
  insert into anagrafiche (persona_id, codice_fiscale) values (nuovo, cf);
  no := nucleo_non_va(figlio, nuovo);
  if no is not null then raise exception '%', no; end if;
  update persone set nucleo = nuovo where id = figlio;
  return nuovo;
end $$;

revoke all on function aggiungi_genitore(uuid, text, text, text) from public, anon;
grant execute on function aggiungi_genitore(uuid, text, text, text) to authenticated;

-- Iscritto a un corso, il genitore non è più «non iscritto»: anche quando
-- l'iscrizione gli arriva da una scheda unita (`unisci_persone` fa un update).
create or replace function iscrizioni_togli_genitore_non_iscritto() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update persone set genitore_non_iscritto = false where id = new.persona_id and genitore_non_iscritto;
  return null;
end $$;

drop trigger if exists iscrizioni_togli_genitore_non_iscritto on iscrizioni;
create trigger iscrizioni_togli_genitore_non_iscritto after insert or update of persona_id on iscrizioni
  for each row execute function iscrizioni_togli_genitore_non_iscritto();
-- La chiama solo il trigger: nessuno la lancia a mano.
revoke all on function iscrizioni_togli_genitore_non_iscritto() from public, anon, authenticated;

notify pgrst, 'reload schema';
