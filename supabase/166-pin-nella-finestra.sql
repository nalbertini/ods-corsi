-- ---------------------------------------------------------------------------
-- ODS Corsi · col PIN, dal tablet, l'appello si segna solo nelle lezioni di
-- questi giorni
--
-- Prima: l'elenco dell'appello (`elenco_sala`) si apriva solo da 30 minuti
-- prima dell'inizio a 14 giorni dopo, ma le funzioni che scrivono col PIN
-- (`segna_con_pin`, `aggiungi_prova_con_pin`, `segna_prova_con_pin`) non
-- guardavano la data. Chi aveva un PIN poteva segnare l'appello di una lezione
-- di mesi prima o di settimane dopo, e da quel segno `istruttore_dall_appello`
-- ricavava una presenza dell'istruttore, che conta per i compensi.
--
-- Ora le tre funzioni chiedono la stessa finestra dell'elenco, scritta una
-- volta sola: `lezione_nella_finestra` (`52-presenze-finestra.sql`), che usa
-- anche `elenco_sala`. Fuori finestra rispondono con un errore (42501) che dice
-- di scrivere alla segreteria, e non scrivono niente: nessuna presenza, nessuna
-- prova, nessuna persona nuova, nessuna presenza dell'istruttore.
--   · Il PIN si guarda prima: uno sbagliato dà `false` e conta fra i tentativi,
--     dentro e fuori finestra (un errore annullerebbe il tentativo contato).
--   · Vale anche per togliere un segno (`stato` nullo) e per chi è segreteria
--     col PIN: una lezione vecchia si corregge dall'app, non dal tablet.
--   · Dentro la finestra non cambia niente. Le presenze già scritte restano.
--
-- Si lancia dopo `21-prove.sql`, `52-presenze-finestra.sql` e
-- `145-doppio-turno.sql`. Non chiede di rilanciare `06-iscrizioni.sql`: ripete
-- da sé i permessi delle funzioni che rifà. Se si rilancia il `21` o il `145`,
-- che ridefiniscono queste funzioni, va rilanciato anche questo. Finché non
-- c'è, il tablet si comporta come prima. Rilanciarlo non perde niente.
-- ---------------------------------------------------------------------------

/** Come in `145-doppio-turno.sql`: cambia solo che la finestra la dice `lezione_nella_finestra`. */
create or replace function elenco_sala(sessione uuid)
  returns table (persona_id uuid, nome text, sigla text, segnato boolean)
  language plpgsql stable security definer set search_path = public, extensions as $$
declare
  l record;
begin
  select * into l from lezione_del_tablet(sessione);
  if not lezione_nella_finestra(sessione) then
    raise exception 'lezione fuori dalla finestra del tablet' using errcode = '42501';
  end if;
  return query
    with elenco as (
      select pe.id, pe.nome, pe.cognome,
        upper(left(regexp_replace(pe.cognome, '^(De|Di|Da|Del|Della|Lo|La)\s+', '\1', 'i'), 1)) as iniziale
      from iscrizioni i join persone pe on pe.id = i.persona_id
      where i.corso_id = l.corso and pe.attiva
        and i.dal <= (l.inizio at time zone 'Europe/Rome')::date
        and (i.al is null or i.al >= (l.inizio at time zone 'Europe/Rome')::date)
        and not presente_altrove(sessione, pe.id)
    )
    select e.id, e.nome,
      case when count(*) over (partition by e.nome, e.iniziale) > 1 then left(regexp_replace(e.cognome, '\s+', '', 'g'), 3) else e.iniziale end || '.',
      exists (select 1 from presenze pr where pr.sessione_id = sessione and pr.persona_id = e.id and pr.stato = 'presente')
    from elenco e
    order by e.nome, e.cognome;
end $$;

/** Come in `145-doppio-turno.sql`, con la finestra dopo il PIN. */
create or replace function segna_con_pin(pin text, sessione uuid, persona uuid, stato stato_presenza)
  returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare
  chi uuid;
  l record;
begin
  select * into l from lezione_del_tablet(sessione);
  chi := persona_da_pin(pin);
  if chi is null then return false; end if;  -- vedi appello_con_pin
  if not lezione_nella_finestra(sessione) then
    raise exception 'Questa lezione è troppo vecchia o troppo lontana per segnare l''appello da qui: scrivete alla segreteria' using errcode = '42501';
  end if;
  if not exists (select 1 from iscrizioni i where i.corso_id = l.corso and i.persona_id = persona) then
    raise exception 'non è iscritto a questo corso' using errcode = '42501';
  end if;
  -- Già presente a un altro turno di oggi: non è nel suo appello, e un segno qui non si scrive.
  if stato is not null and presente_altrove(sessione, persona) then return true; end if;
  if stato is null then
    delete from presenze where sessione_id = sessione and persona_id = persona and origine <> 'appello';
    return true;
  end if;
  insert into presenze (sessione_id, persona_id, stato, origine, segnata_da, postazione_id)
    values (sessione, persona, stato, 'appello', chi, l.postazione)
    on conflict (sessione_id, persona_id) do update
      set stato = excluded.stato, origine = 'appello', segnata_da = excluded.segnata_da, postazione_id = excluded.postazione_id;
  return true;
end $$;

/** Come in `21-prove.sql`, con la finestra dopo il PIN: `true` se è aggiunta, `false` se il PIN non va più. */
create or replace function aggiungi_prova_con_pin(pin text, sessione uuid, persona uuid, nome text default null,
                                                  cognome text default null, telefono text default null)
  returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare
  chi uuid;
  l record;
begin
  select * into l from lezione_del_tablet(sessione);
  chi := persona_da_pin(pin);
  if chi is null then return false; end if;
  if not lezione_nella_finestra(sessione) then
    raise exception 'Questa lezione è troppo vecchia o troppo lontana per segnare l''appello da qui: scrivete alla segreteria' using errcode = '42501';
  end if;
  perform metti_prova(sessione, persona, nome, cognome, telefono, chi, l.postazione);
  return true;
end $$;

/** Come in `21-prove.sql`, con la finestra dopo il PIN. */
create or replace function segna_prova_con_pin(pin text, sessione uuid, persona uuid, stato stato_presenza)
  returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare
  chi uuid;
  l record;
begin
  select * into l from lezione_del_tablet(sessione);
  chi := persona_da_pin(pin);
  if chi is null then return false; end if;
  if not lezione_nella_finestra(sessione) then
    raise exception 'Questa lezione è troppo vecchia o troppo lontana per segnare l''appello da qui: scrivete alla segreteria' using errcode = '42501';
  end if;
  if not exists (select 1 from prove p where p.sessione_id = sessione and p.persona_id = persona) then
    raise exception 'non è fra le prove di questa lezione' using errcode = '42501';
  end if;
  if stato is null then raise exception 'una prova si segna presente o assente' using errcode = '22023'; end if;
  insert into presenze (sessione_id, persona_id, stato, origine, segnata_da, postazione_id)
    values (sessione, persona, stato, 'appello', chi, l.postazione)
    on conflict (sessione_id, persona_id) do update
      set stato = excluded.stato, origine = 'appello', segnata_da = excluded.segnata_da, postazione_id = excluded.postazione_id;
  return true;
end $$;

revoke all on function elenco_sala(uuid), segna_con_pin(text, uuid, uuid, stato_presenza),
  aggiungi_prova_con_pin(text, uuid, uuid, text, text, text), segna_prova_con_pin(text, uuid, uuid, stato_presenza)
  from public, anon;
grant execute on function elenco_sala(uuid), segna_con_pin(text, uuid, uuid, stato_presenza),
  aggiungi_prova_con_pin(text, uuid, uuid, text, text, text), segna_prova_con_pin(text, uuid, uuid, stato_presenza)
  to authenticated;

notify pgrst, 'reload schema';
