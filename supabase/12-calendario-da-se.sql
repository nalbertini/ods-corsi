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
-- La stagione: in IMPOSTAZIONI si possono scrivere il giorno in cui
-- cominciano i corsi e quello in cui finiscono. Con la fine, il calendario si
-- prepara tutto e subito fino a lì, invece che per i giorni scelti; con
-- l'inizio, le lezioni partono da quel giorno. Fuori da queste date non nasce
-- nessuna lezione dalle ricorrenze, da qualunque parte venga la richiesta
-- (RIGENERA, l'import, il job): lo controlla un trigger su `sessioni`, così
-- `materializza_sessioni` resta quella di `03-funzioni.sql`. Le lezioni già
-- generate non si toccano.
--
-- Su un database già in uso si rilanciano prima `03-funzioni.sql`, che lascia
-- passare questa funzione, e `06-iscrizioni.sql` come dopo ognuno dei primi
-- cinque; poi questo. I permessi di questa funzione li decide lui, quindi
-- dopo non chiede di rilanciare `06-iscrizioni.sql`.
-- ---------------------------------------------------------------------------

-- Le date della stagione. Vuote, vale solo il numero di giorni come prima.
-- Più di 400 giorni no: è il limite di `materializza_sessioni`.
alter table impostazioni add column if not exists inizio_corsi date;
alter table impostazioni add column if not exists fine_corsi date;
alter table impostazioni drop constraint if exists impostazioni_stagione_check;
alter table impostazioni add constraint impostazioni_stagione_check
  check (inizio_corsi is null or fine_corsi is null or fine_corsi between inizio_corsi and inizio_corsi + 400);

-- Una lezione che nasce da una ricorrenza fuori dalla stagione non si crea:
-- la riga si salta, e `materializza_sessioni` non la conta fra le nuove.
-- Quelle senza ricorrenza (non ce ne sono, oggi) passano.
create or replace function sessione_in_stagione() returns trigger
  language plpgsql set search_path = public, extensions as $$
declare
  inizio date;
  fine date;
  giorno date := (new.inizio at time zone 'Europe/Rome')::date;
begin
  if new.ricorrenza_id is null then return new; end if;
  select max(inizio_corsi), max(fine_corsi) into inizio, fine from impostazioni;
  if giorno < inizio or giorno > fine then return null; end if;
  return new;
end $$;

drop trigger if exists sessioni_in_stagione on sessioni;
create trigger sessioni_in_stagione before insert on sessioni
  for each row execute function sessione_in_stagione();

create or replace function allunga_calendario() returns date
  language plpgsql security definer set search_path = public, extensions as $$
declare
  giorni int;
  inizio date;
  fine date;
  da date;
  meta date;
  basta date;
  pronto date;
  fino date;
begin
  -- Chiunque abbia un accesso, tablet compresi: allunga soltanto, e soltanto
  -- secondo le regole della segreteria, quindi non c'è niente da scegliere.
  if auth.uid() is null then raise exception 'serve un accesso'; end if;

  select coalesce(max(giorni_calendario), 60), max(inizio_corsi), max(fine_corsi) into giorni, inizio, fine from impostazioni;
  -- Da oggi, o dal primo giorno dei corsi se non sono ancora cominciati.
  da := greatest(current_date, coalesce(inizio, current_date));
  if fine is not null then
    -- Con la fine dei corsi, tutto fino a lì. L'ultima lezione può cadere
    -- fino a sei giorni prima della fine: basta arrivare a quella settimana.
    meta := least(fine, da + 400);
    basta := meta - 6;
  else
    meta := da + giorni;
    basta := da + giorni / 2;
  end if;

  -- Due telefoni che aprono insieme non creano due volte (e il vincolo su
  -- corso e inizio non lo lascerebbe fare): il secondo aspetta e trova fatto.
  perform pg_advisory_xact_lock(hashtext('allunga_calendario'));
  pronto := calendario_pronto_fino();
  -- I corsi sono finiti: fino alla stagione nuova non c'è niente da fare.
  if meta < da then return pronto; end if;
  if pronto is not null and pronto >= basta then return pronto; end if;

  fino := least(greatest(coalesce(pronto, da), meta), da + 400);
  perform set_config('ods.allunga', 'si', true);
  perform materializza_sessioni(da, fino);
  perform set_config('ods.allunga', '', true);
  return calendario_pronto_fino();
end $$;

revoke all on function allunga_calendario() from public, anon;
grant execute on function allunga_calendario() to authenticated;

-- Che l'API veda subito la funzione nuova, senza aspettare.
notify pgrst, 'reload schema';
