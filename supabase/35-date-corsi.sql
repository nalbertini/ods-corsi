-- ---------------------------------------------------------------------------
-- ODS Corsi · SALVA LE DATE toglie le lezioni fuori dai corsi
--
-- Il trigger `sessione_in_stagione` (12-calendario-da-se.sql) non fa nascere
-- lezioni fuori da inizio e fine dei corsi, ma quelle già create restano:
-- accorciando la fine, la segreteria si ritrovava decine di lezioni dopo la
-- fine senza capire da dove venivano. `salva_date_corsi` scrive le date e
-- toglie le lezioni da ricorrenza da domani in poi rimaste fuori, con quello
-- che hanno sopra (annullate, sostituti, sale), tranne quelle con l'appello o
-- una prova: quelle sono di qualcuno, e restano. Oggi e il passato non si
-- toccano, le straordinarie nemmeno. Restituisce quante ne ha tolte e quante
-- restano fuori, col primo e l'ultimo giorno, per l'avviso dell'app.
--
-- La chiama solo la segreteria (o il SQL Editor). Si lancia dopo
-- `21-prove.sql`. Non chiede di rilanciare `06-iscrizioni.sql`. Finché non
-- c'è, SALVA LE DATE salva le date come prima, le lezioni fuori restano, e
-- l'app dice che va lanciato.
-- ---------------------------------------------------------------------------

-- Con `solo_contare` non cambia niente: dice quello che farebbe, per la
-- domanda che l'app fa prima di togliere.
drop function if exists salva_date_corsi(date, date);
create or replace function salva_date_corsi(inizio date, fine date, solo_contare boolean default false) returns json
  -- `pg_temp` in fondo: una tabella temporanea di chi chiama non copre quelle vere.
  language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  tolte int;
  esito json;
  oggi date := (now() at time zone 'Europe/Rome')::date;
begin
  if auth.uid() is not null and not e_staff() then
    raise exception 'solo la segreteria cambia le date dei corsi' using errcode = '42501';
  end if;
  -- Il check di 12 le lascerebbe passare, e una data infinita toglierebbe
  -- tutte le lezioni o fermerebbe `allunga_calendario`.
  if not isfinite(coalesce(salva_date_corsi.inizio, current_date)) or not isfinite(coalesce(salva_date_corsi.fine, current_date)) then
    raise exception 'le date dei corsi sono giorni veri' using errcode = '23514';
  end if;

  -- Le lezioni da ricorrenza da domani in poi fuori dalle date, e se qualcuno
  -- le tiene. I parametri hanno il nome delle colonne di `sessioni`: si
  -- scrivono per esteso.
  create temp table pg_temp.fuori on commit drop as
    select s.id, s.inizio, c.nome as corso,
           exists (select 1 from presenze p where p.sessione_id = s.id)
           or exists (select 1 from prove p where p.sessione_id = s.id) as tenuta
      from sessioni s join corsi c on c.id = s.corso_id
     where s.ricorrenza_id is not null
       and (s.inizio at time zone 'Europe/Rome')::date > oggi
       and ((s.inizio at time zone 'Europe/Rome')::date < salva_date_corsi.inizio
            or (s.inizio at time zone 'Europe/Rome')::date > salva_date_corsi.fine);

  select count(*) into tolte from pg_temp.fuori f where not f.tenuta;
  select json_build_object(
           'tolte', tolte,
           'restano', count(*),
           'prima', min((f.inizio at time zone 'Europe/Rome')::date),
           'ultima', max((f.inizio at time zone 'Europe/Rome')::date),
           'rimaste', coalesce((select json_agg(json_build_object('corso', r.corso, 'inizio', r.inizio) order by r.inizio, r.corso)
                                  from (select f2.corso, f2.inizio from pg_temp.fuori f2 where f2.tenuta order by f2.inizio, f2.corso limit 3) r), '[]'::json))
    into esito
    from pg_temp.fuori f where f.tenuta;

  if not solo_contare then
    update impostazioni set inizio_corsi = salva_date_corsi.inizio, fine_corsi = salva_date_corsi.fine where id;
    delete from sessioni s using pg_temp.fuori f where s.id = f.id and not f.tenuta;
  end if;
  drop table pg_temp.fuori;
  return esito;
end $$;

revoke all on function salva_date_corsi(date, date, boolean) from public, anon;
grant execute on function salva_date_corsi(date, date, boolean) to authenticated;

-- Che l'API veda subito la funzione nuova, senza aspettare.
notify pgrst, 'reload schema';
