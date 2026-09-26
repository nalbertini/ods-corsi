-- ---------------------------------------------------------------------------
-- ODS Corsi · il calendario che si allunga da sé
--
-- Le lezioni sono righe vere (`sessioni`), create dalle ricorrenze per un
-- certo numero di giorni avanti: quanti, lo dice IMPOSTAZIONI. Finora le
-- allungavano l'import, RIGENERA e un job settimanale da attivare a mano su
-- Supabase; senza il job, dopo due mesi il calendario restava vuoto, e con
-- lui I MIEI TIMER e il tablet di sala.
--
-- Qui una funzione che l'app chiama da sé quando legge il calendario, dal
-- telefono di un istruttore, dalla segreteria o dal tablet: se alla fine del
-- calendario manca meno di metà del periodo scelto, lo allunga fino ai giorni
-- di IMPOSTAZIONI. Altrimenti non fa niente, e costa una lettura.
-- Il job settimanale, chi l'ha attivato, può restare: fanno la stessa cosa.
--
-- Su un database già in uso si rilanciano prima `03-funzioni.sql`, che lascia
-- passare questa funzione, e `06-iscrizioni.sql` come dopo ognuno dei primi
-- cinque; poi questo. I permessi di questa funzione li decide lui, quindi
-- dopo non chiede di rilanciare `06-iscrizioni.sql`.
-- ---------------------------------------------------------------------------

create or replace function allunga_calendario() returns date
  language plpgsql security definer set search_path = public, extensions as $$
declare
  giorni int;
  pronto date;
  fino date;
begin
  -- Chiunque abbia un accesso, tablet compresi: allunga soltanto, e soltanto
  -- secondo le regole della segreteria, quindi non c'è niente da scegliere.
  if auth.uid() is null then raise exception 'serve un accesso'; end if;

  select coalesce(max(giorni_calendario), 60) into giorni from impostazioni;
  -- Due telefoni che aprono insieme non creano due volte (e il vincolo su
  -- corso e inizio non lo lascerebbe fare): il secondo aspetta e trova fatto.
  perform pg_advisory_xact_lock(hashtext('allunga_calendario'));
  pronto := calendario_pronto_fino();
  if pronto is not null and pronto >= current_date + giorni / 2 then return pronto; end if;

  fino := greatest(coalesce(pronto, current_date), current_date + giorni);
  perform set_config('ods.allunga', 'si', true);
  perform materializza_sessioni(current_date, fino);
  perform set_config('ods.allunga', '', true);
  return calendario_pronto_fino();
end $$;

revoke all on function allunga_calendario() from public, anon;
grant execute on function allunga_calendario() to authenticated;

-- Che l'API veda subito la funzione nuova, senza aspettare.
notify pgrst, 'reload schema';
