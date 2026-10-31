-- ODS Corsi · I verbali semplici
-- Si lancia dopo 127-verbali.sql, e si può rilanciare. Non chiede di rilanciare 06-iscrizioni.sql.
--
-- Il verbale si scrive fuori dall'app e si firma a mano: nell'app si carica il PDF firmato con i dati
-- della riunione (numero, data, tipo). `firma_verbale` non chiede più ora d'inizio, luogo, ordine del
-- giorno, presidente, segretario e presenti a un verbale che non è storico: vecchi e nuovi uguali.
-- Chi può: come nel 127, solo la segreteria. Finché non c'è, il database rifiuta di firmare un verbale
-- nuovo senza quei dati, e l'app mostra l'errore.
-- La stessa regola, per la modalità prova, è in src/lib/verbali.ts (cosaNonVaVerbale).
-- ---------------------------------------------------------------------------

-- Da bozza a firmato: serve il PDF firmato in vigore, e la data non è nel futuro né prima della riunione.
-- Il resto (ore, luogo, presidente, presenti…) sta nel PDF: non lo chiede più, storico o no.
-- A senso unico: un firmato non torna in bozza.
create or replace function firma_verbale(verbale uuid, data date) returns void
  language plpgsql security definer set search_path = public, extensions as $$
declare
  v verbali;
begin
  if not e_staff() then raise exception 'I verbali li firma la segreteria' using errcode = '42501'; end if;
  select * into v from verbali where id = firma_verbale.verbale for update;
  if not found then raise exception 'Questo verbale non c’è più: ricarica la pagina' using errcode = 'P0002'; end if;
  if v.stato <> 'bozza' then raise exception 'Questo verbale è già firmato'; end if;
  if not exists (select 1 from verbali_allegati a where a.verbale_id = v.id and a.tipo = 'firmato' and a.sostituito_il is null) then
    raise exception 'Per firmare serve il PDF firmato: caricalo prima';
  end if;
  if firma_verbale.data is null then raise exception 'Scrivi la data della firma'; end if;
  if firma_verbale.data > (now() at time zone 'Europe/Rome')::date then
    raise exception 'La firma non può essere nel futuro: al massimo oggi';
  end if;
  if firma_verbale.data < v.data then raise exception 'La firma non può essere prima della riunione'; end if;
  update verbali set stato = 'firmato', firmato_il = firma_verbale.data where id = v.id;
end $$;

revoke all on function firma_verbale(uuid, date) from public, anon;
grant execute on function firma_verbale(uuid, date) to authenticated;

notify pgrst, 'reload schema';
