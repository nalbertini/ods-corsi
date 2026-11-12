-- ---------------------------------------------------------------------------
-- ODS Corsi · il giorno in cui un corso è stato archiviato
--
-- Archiviare un corso lascia aperte le iscrizioni (rimettendolo in calendario
-- torna tutto com'era), ma i corsi da pagare lo guardavano fino a oggi: un
-- trimestre che copriva il corso quando è stato archiviato diventava
-- «scaduto», e chi l'aveva pagato riceveva un sollecito per un corso che non
-- c'è più. Ora il corso ricorda quando è stato archiviato (`archiviato_il`), e
-- l'app conta quel che era dovuto fino a quel giorno: chi non aveva pagato
-- le lezioni già fatte resta da pagare, dopo non matura più niente.
--
-- Lo scrive un trigger, così vale da ogni strada: archiviato, il giorno di oggi
-- (a Roma); rimesso in calendario, niente. La colonna la legge chi legge i
-- corsi, come le altre; nessuno la scrive a mano.
--
-- Una volta sola, ai corsi già archiviati dà il giorno della loro ultima
-- lezione (archiviare toglie quelle future senza appello), o oggi se non ne
-- hanno.
--
-- Si lancia dopo `05-segreteria.sql`; non chiede di rilanciare
-- `06-iscrizioni.sql`. Finché non c'è, un corso archiviato conta fino a oggi,
-- come prima.
-- ---------------------------------------------------------------------------

alter table corsi add column if not exists archiviato_il date;

create or replace function corso_archiviato_il()
  returns trigger language plpgsql set search_path = public, extensions as $$
begin
  if new.attivo then
    new.archiviato_il := null;
  elsif old.attivo then
    new.archiviato_il := (now() at time zone 'Europe/Rome')::date;
  else
    -- Già archiviato: il giorno non cambia, né si scrive a mano.
    new.archiviato_il := coalesce(old.archiviato_il, (now() at time zone 'Europe/Rome')::date);
  end if;
  return new;
end $$;
revoke all on function corso_archiviato_il() from public, anon, authenticated;


-- I corsi già archiviati: il giorno dell'ultima lezione. Prima del trigger, che lo terrebbe fermo.
drop trigger if exists corsi_archiviato_il on corsi;
update corsi c set archiviato_il = coalesce(
    (select max((s.inizio at time zone 'Europe/Rome')::date) from sessioni s where s.corso_id = c.id),
    (now() at time zone 'Europe/Rome')::date)
  where not c.attivo and c.archiviato_il is null;

create trigger corsi_archiviato_il before update on corsi
  for each row execute function corso_archiviato_il();

notify pgrst, 'reload schema';
