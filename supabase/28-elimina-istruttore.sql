-- ---------------------------------------------------------------------------
-- ODS Corsi · eliminare un istruttore
--
-- Un istruttore aggiunto per sbaglio, o che non ha mai insegnato, si elimina
-- del tutto: la scheda qui, l'account con la funzione `elimina`
-- (functions/elimina), che chiama `elimina_istruttore()` col token di chi la
-- chiama e poi toglie l'account con la chiave `service_role`.
--
-- Chi ha insegnato invece non si elimina: le sue presenze (i compensi) e le
-- sue lezioni se ne andrebbero con lui, perché i riferimenti a `persone` sono
-- `on delete cascade` o `set null`. Per lui c'è TOGLI L'ACCESSO. Il blocco sta
-- in un trigger, non nella funzione: la policy `persone_cancella`
-- (02-policy.sql) lascia già cancellare alla segreteria con la chiave
-- pubblica, e il trigger vale anche da lì. Blocca chi:
--   · tiene un corso non archiviato (`corsi.istruttore_id` o `corsi_istruttori`);
--   · ha una lezione in calendario a suo nome, passata o futura;
--   · ha una presenza da istruttore, di qualunque stato.
--
-- `elimina_istruttore()` la chiama solo la segreteria, e solo per chi ha il
-- ruolo `istruttore`: chi è anche di segreteria non si elimina da qui. Non
-- elimina chi è anche allievo (iscrizioni, presenze, ricevute: se ne
-- andrebbero con lui), né una scheda legata all'account di un tablet. Ruolo e
-- account di una scheda li cambia la segreteria (`persone_aggiorna`), quindi
-- questi controlli non fermano chi li cambia apposta: per il database la
-- segreteria amministra gli account. La funzione `elimina` controlla in più
-- che l'account abbia l'email della scheda.
--
-- Si lancia dopo `15-presenze-istruttori.sql`. Chiude da sé le sue funzioni:
-- non chiede di rilanciare `06-iscrizioni.sql`. Finché non c'è, ELIMINA nella
-- scheda dell'istruttore dice che va lanciato.
-- ---------------------------------------------------------------------------

create or replace function persone_non_si_elimina() returns trigger
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  nome text := btrim(old.nome || ' ' || old.cognome);
  tiene text;
begin
  -- Security definer: i controlli guardano tutte le righe, qualunque sia la
  -- policy di chi cancella.
  select string_agg(distinct c.nome, ', ' order by c.nome) into tiene
    from corsi c
   where c.attivo
     and (c.istruttore_id = old.id
          or exists (select 1 from corsi_istruttori ci where ci.corso_id = c.id and ci.persona_id = old.id));
  if tiene is not null then
    raise exception '% insegna ancora in %: prima va tolto dai corsi', nome, tiene;
  end if;
  if exists (select 1 from sessioni where istruttore_id = old.id) then
    raise exception '% ha delle lezioni in calendario: non si elimina, gli si toglie l''accesso', nome;
  end if;
  if exists (select 1 from presenze_istruttori where persona_id = old.id) then
    raise exception '% ha delle presenze da istruttore: non si elimina, gli si toglie l''accesso', nome;
  end if;
  return old;
end $$;

create or replace trigger persone_non_si_elimina
  before delete on persone
  for each row execute function persone_non_si_elimina();

-- Restituisce l'account da togliere, se la persona ne aveva uno.
create or replace function elimina_istruttore(persona uuid) returns uuid
language plpgsql set search_path = public as $$
declare
  p persone;
  allievo boolean := false;
begin
  if not e_staff() then
    raise exception 'Non hai il permesso: serve un accesso da segreteria' using errcode = '42501';
  end if;
  select * into p from persone where id = persona;
  if not found then
    raise exception 'Questa persona non c''è più';
  end if;
  if p.ruolo <> 'istruttore' then
    raise exception 'Si eliminano solo gli istruttori: a % si toglie l''accesso', p.nome;
  end if;
  -- Qui e non nel trigger: un iscritto la segreteria lo cancella come prima.
  if exists (select 1 from iscrizioni where persona_id = persona)
     or exists (select 1 from presenze where persona_id = persona) then
    allievo := true;
  elsif to_regclass('public.ricevute') is not null then
    -- Le ricevute ci sono solo con 16-ricevute.sql.
    execute 'select exists (select 1 from ricevute where persona_id = $1)' into allievo using persona;
  end if;
  if allievo then
    raise exception '% è anche allievo: non si elimina, gli si toglie l''accesso', btrim(p.nome || ' ' || p.cognome);
  end if;
  if p.utente_id is not null and exists (select 1 from postazioni where utente_id = p.utente_id) then
    raise exception 'L''account di % è quello di un tablet: non si toglie da qui', p.nome;
  end if;
  -- Il trigger qui sopra dice di no a chi ha insegnato.
  delete from persone where id = persona;
  return p.utente_id;
end $$;

revoke all on function persone_non_si_elimina() from public, anon, authenticated;
revoke all on function elimina_istruttore(uuid) from public, anon;
grant execute on function elimina_istruttore(uuid) to authenticated;

notify pgrst, 'reload schema';
