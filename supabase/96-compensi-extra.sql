-- ---------------------------------------------------------------------------
-- ODS Corsi · la ricevuta di compenso EXTRA
--
-- Un compenso fuori dal conto delle lezioni (uno stage, un torneo) ha la sua
-- ricevuta, separata da quella del mese. Sta nella stessa tabella
-- `ricevute_compensi` (`80-ricevute-compensi.sql`):
--
--   · `extra`: per che cosa è il compenso, scritto dalla segreteria (da 3 a
--     200 caratteri); null per la ricevuta del mese. Una extra non ha righe
--     corso né calcolato: l'importo è quello scritto. Più extra per lo stesso
--     tecnico e mese, anche uguali; una sola ricevuta del mese, come prima.
--   · `fai_ricevuta_compenso_extra(persona, mese, descrizione, importo)`:
--     l'unico modo di farla. I dati del tecnico li prende dalla scheda (come
--     la ricevuta del mese, senza codice fiscale, residenza o IBAN non si fa),
--     la qualifica dalla ricevuta del mese di quel mese, la data è oggi.
--   · `modifica_ricevuta_compenso_extra(id, descrizione, importo)`: cambia
--     descrizione e importo finché non è pagata né annullata.
--   · `paga_compensi` le paga insieme a quelle del mese; la descrizione del
--     movimento aggiunge il testo delle extra.
-- Le fa e le cambia solo la segreteria (`e_staff()`); pagarle, come sempre,
-- chi ha anche l'amministrazione. Si annullano con `annulla_ricevuta_compenso`.
--
-- Si lancia dopo `81-compensi-pagati.sql`. Non chiede di rilanciare
-- `06-iscrizioni.sql`; rifà `fai_ricevuta_compenso` dell'80 e `paga_compensi`
-- dell'81, quindi se si rilancia uno di quelli va rilanciato anche questo
-- (`controllo.sql` lo dice). Finché non c'è, COMPENSI dice di lanciarlo
-- quando si prova a fare una extra.
-- ---------------------------------------------------------------------------

alter table ricevute_compensi add column if not exists extra text;

-- I vincoli dell'80 non lasciano passare una ricevuta senza righe né calcolato:
-- si tolgono (hanno il nome che gli ha dato Postgres) e si rimettono che sanno delle extra.
do $$
declare v text;
begin
  for v in select conname from pg_constraint
    where conrelid = 'ricevute_compensi'::regclass and contype = 'c'
      and (pg_get_constraintdef(oid) like '%jsonb_array_length(righe)%' or pg_get_constraintdef(oid) like '%motivo%')
      and conname not in ('ricevute_compensi_righe', 'ricevute_compensi_conto')
  loop
    execute format('alter table ricevute_compensi drop constraint %I', v);
  end loop;
end $$;
alter table ricevute_compensi drop constraint if exists ricevute_compensi_righe;
alter table ricevute_compensi drop constraint if exists ricevute_compensi_conto;
alter table ricevute_compensi add constraint ricevute_compensi_righe check (
  jsonb_typeof(righe) = 'array' and case when extra is null then jsonb_array_length(righe) >= 1 else jsonb_array_length(righe) = 0 end);
-- Una extra la fa solo la funzione: lei scrive chi l'ha fatta e i dati del tecnico per la ricevuta.
alter table ricevute_compensi add constraint ricevute_compensi_conto check (
  case when extra is null
    then (importo = calcolato and motivo is null) or (importo <> calcolato and coalesce(length(trim(motivo)), 0) between 3 and 200)
    else calcolato = 0 and motivo is null and length(trim(extra)) between 3 and 200 and char_length(extra) <= 200
      and creata_da is not null and tecnico ? 'codiceFiscale' and tecnico ? 'iban'
  end);

drop index if exists ricevute_compensi_valida;
create unique index ricevute_compensi_valida on ricevute_compensi (persona_id, mese) where annullata_il is null and extra is null;

-- Come nell'80; «c'è già la ricevuta di questo mese» guarda solo quelle del mese.
create or replace function fai_ricevuta_compenso(persona uuid, mese date, righe jsonb, calcolato int, importo int, motivo text, tecnico jsonb, qualifica text, data date)
returns ricevute_compensi language plpgsql security definer set search_path = public as $$
declare nuova ricevute_compensi;
begin
  if not e_staff() then raise exception 'Le ricevute dei compensi le fa la segreteria' using errcode = '42501'; end if;
  if not exists (select 1 from persone p where p.id = persona and (p.ruolo = 'istruttore' or coalesce(p.anche_istruttore, false))) then
    raise exception 'La ricevuta del compenso si fa a chi insegna' using errcode = '22023'; end if;
  -- Prima i nulli e i tipi: il messaggio è questo, non quello grezzo dei vincoli della tabella.
  if jsonb_typeof(tecnico) is distinct from 'object' or pg_column_size(tecnico) > 8192 then raise exception 'I dati del tecnico della ricevuta non sono giusti' using errcode = '22023'; end if;
  if mese is null or data is null or importo is null or calcolato is null or extract(day from mese) <> 1 or mese > date_trunc('month', current_date) then raise exception 'Il mese della ricevuta non va: il primo del mese, non nel futuro' using errcode = '22023'; end if;
  -- Ogni riga coi suoi numeri (veri numeri, non testo) e l'importo che è proprio ore × tariffa:
  -- se no il compenso cambiato a mano senza perché passerebbe scritto dentro una riga.
  if jsonb_typeof(righe) is distinct from 'array' or jsonb_array_length(righe) not between 1 and 50 or pg_column_size(righe) > 16384
     or exists (select 1 from jsonb_array_elements(righe) t where jsonb_typeof(t) <> 'object'
       or jsonb_typeof(t->'corso') is distinct from 'string' or length(trim(t->>'corso')) = 0
       or jsonb_typeof(t->'lezioni') is distinct from 'number' or jsonb_typeof(t->'minuti') is distinct from 'number'
       or jsonb_typeof(t->'centesimi_ora') is distinct from 'number' or jsonb_typeof(t->'importo') is distinct from 'number'
       or (t->>'lezioni') !~ '^[0-9]{1,4}$' or (t->>'lezioni')::int < 1
       or (t->>'minuti') !~ '^[0-9]{1,6}$' or (t->>'minuti')::int < 1
       or (t->>'centesimi_ora') !~ '^[0-9]{1,6}$' or (t->>'centesimi_ora')::int not between 1 and 100000
       or (t->>'importo') !~ '^[0-9]{1,8}$'
       or (t->>'importo')::int <> round((t->>'minuti')::numeric / 60 * (t->>'centesimi_ora')::int))
     or calcolato is distinct from (select sum((t->>'importo')::int) from jsonb_array_elements(righe) t) then
    raise exception 'Le righe del compenso non sono giuste: rifai la ricevuta dalla pagina COMPENSI' using errcode = '22023'; end if;
  if exists (select 1 from ricevute_compensi r where r.persona_id = persona and r.mese = fai_ricevuta_compenso.mese and r.annullata_il is null and r.extra is null) then
    raise exception 'C''è già la ricevuta di questo mese: annullala prima di rifarla' using errcode = '23505'; end if;
  -- Il compenso cambiato a mano senza perché non passa: lo dice anche il check della tabella.
  if importo <> calcolato and coalesce(length(trim(motivo)), 0) not between 3 and 200 then
    raise exception 'Scrivi perché il compenso è diverso da quello calcolato' using errcode = '22023'; end if;
  if importo = calcolato then motivo := null; end if;
  insert into ricevute_compensi (persona_id, mese, righe, calcolato, importo, motivo, tecnico, qualifica, data, creata_da)
  values (persona, mese, righe, calcolato, importo, nullif(trim(motivo), ''), tecnico, qualifica, data, persona_corrente()) returning * into nuova;
  return nuova;
end $$;
revoke all on function fai_ricevuta_compenso(uuid, date, jsonb, int, int, text, jsonb, text, date) from public, anon;
grant execute on function fai_ricevuta_compenso(uuid, date, jsonb, int, int, text, jsonb, text, date) to authenticated;

-- Importo e descrizione: gli stessi messaggi di `cosaNonVaExtra` in src/lib/compensi.ts.
create or replace function controlla_compenso_extra(descrizione text, importo int) returns void
language plpgsql immutable set search_path = public as $$
begin
  if importo is null or importo <= 0 then raise exception 'Il compenso è un importo più grande di zero' using errcode = '22023'; end if;
  if importo > 10000000 then raise exception 'Il compenso è al massimo 100.000 €' using errcode = '22023'; end if;
  if coalesce(length(btrim(descrizione, E' \t\r\n')), 0) < 3 then raise exception 'Scrivi per che cosa è il compenso: almeno tre lettere' using errcode = '22023'; end if;
  if length(btrim(descrizione, E' \t\r\n')) > 200 then raise exception 'La descrizione è troppo lunga: al massimo 200 caratteri' using errcode = '22023'; end if;
end $$;
revoke all on function controlla_compenso_extra(text, int) from public, anon, authenticated;

create or replace function fai_ricevuta_compenso_extra(persona uuid, mese date, descrizione text, importo int)
returns ricevute_compensi language plpgsql security definer set search_path = public as $$
declare
  nuova ricevute_compensi;
  p persone;
  a anagrafiche;
  manca text[];
  tecnico jsonb;
begin
  if not e_staff() then raise exception 'Le ricevute dei compensi le fa la segreteria' using errcode = '42501'; end if;
  select * into p from persone x where x.id = persona and (x.ruolo = 'istruttore' or coalesce(x.anche_istruttore, false));
  if not found then raise exception 'La ricevuta del compenso si fa a chi insegna' using errcode = '22023'; end if;
  if mese is null or extract(day from mese) <> 1 or mese > date_trunc('month', current_date) then
    raise exception 'Il mese della ricevuta non va: il primo del mese, non nel futuro' using errcode = '22023'; end if;
  perform controlla_compenso_extra(descrizione, importo);
  -- Gli stessi dati di `mancaPerRicevuta`, con lo stesso messaggio.
  select * into a from anagrafiche x where x.persona_id = persona;
  manca := array_remove(array[
    case when nullif(a.codice_fiscale, '') is null then 'codice fiscale' end,
    case when nullif(trim(a.indirizzo), '') is null or nullif(trim(a.comune), '') is null then 'residenza' end,
    case when nullif(a.iban, '') is null then 'IBAN' end], null);
  if cardinality(manca) > 0 then
    raise exception 'Mancano i dati per la ricevuta: %', case when cardinality(manca) = 1 then manca[1]
      else array_to_string(manca[1:cardinality(manca) - 1], ', ') || ' e ' || manca[cardinality(manca)] end using errcode = '22023'; end if;
  -- Le chiavi di `datiPerRicevuta`: la ricevuta si stampa uguale a quella del mese.
  tecnico := jsonb_strip_nulls(jsonb_build_object('nome', p.nome, 'cognome', p.cognome, 'indirizzo', nullif(a.indirizzo, ''), 'cap', nullif(a.cap, ''),
    'comune', nullif(a.comune, ''), 'provincia', a.provincia, 'codiceFiscale', a.codice_fiscale, 'natoIl', a.nato_il, 'natoA', nullif(a.nato_a, ''),
    'provinciaNascita', a.provincia_nascita, 'iban', a.iban));
  insert into ricevute_compensi (persona_id, mese, righe, calcolato, importo, tecnico, qualifica, data, creata_da, extra)
  values (persona, mese, '[]', 0, importo, tecnico,
    (select r.qualifica from ricevute_compensi r where r.persona_id = persona and r.mese = fai_ricevuta_compenso_extra.mese and r.annullata_il is null and r.extra is null),
    contabilita_oggi(), persona_corrente(), btrim(descrizione, E' \t\r\n'))
  returning * into nuova;
  return nuova;
end $$;
revoke all on function fai_ricevuta_compenso_extra(uuid, date, text, int) from public, anon;
grant execute on function fai_ricevuta_compenso_extra(uuid, date, text, int) to authenticated;

create or replace function modifica_ricevuta_compenso_extra(id uuid, descrizione text, importo int)
returns ricevute_compensi language plpgsql security definer set search_path = public as $$
declare r ricevute_compensi;
begin
  if not e_staff() then raise exception 'Le ricevute dei compensi le cambia la segreteria' using errcode = '42501'; end if;
  select * into r from ricevute_compensi x where x.id = modifica_ricevuta_compenso_extra.id for update;
  if not found or r.annullata_il is not null then raise exception 'Questa ricevuta non c''è o è annullata' using errcode = '22023'; end if;
  if r.extra is null then raise exception 'Si cambiano solo le ricevute extra' using errcode = '22023'; end if;
  if r.movimento_id is not null then raise exception 'È pagata: prima annulla il pagamento in CONTABILITÀ → MOVIMENTI' using errcode = '22023'; end if;
  perform controlla_compenso_extra(descrizione, importo);
  -- Cambiata, il foglio firmato non è più questa ricevuta: torna da firmare.
  update ricevute_compensi x set extra = btrim(descrizione, E' \t\r\n'), importo = modifica_ricevuta_compenso_extra.importo, firmata = false
    where x.id = r.id returning * into r;
  return r;
end $$;
revoke all on function modifica_ricevuta_compenso_extra(uuid, text, int) from public, anon;
grant execute on function modifica_ricevuta_compenso_extra(uuid, text, int) to authenticated;

-- Come nell'81; la descrizione aggiunge il testo delle extra, nell'ordine in cui sono state fatte.
create or replace function paga_compensi(ricevute uuid[], data date, cassa uuid) returns movimenti
language plpgsql security definer set search_path = public as $$
declare
  r movimenti;
  ca casse;
  chi persone;
  quante int;
  persone_diverse int;
  totale bigint;
  descrizione text;
  mesi date[];
  extra text;
begin
  if not e_staff() then raise exception 'I compensi li paga chi cura segreteria e contabilità' using errcode = '42501'; end if;
  perform contabilita_porta();
  -- La stessa ricevuta due volte conta una volta.
  ricevute := array(select distinct x from unnest(ricevute) x where x is not null);
  if coalesce(cardinality(ricevute), 0) = 0 then raise exception 'Scegli almeno una ricevuta da pagare' using errcode = '22023'; end if;
  perform 1 from ricevute_compensi x where x.id = any(ricevute) for update;
  select count(*), count(distinct x.persona_id), sum(x.importo), array_agg(x.mese),
         string_agg(' · ' || x.extra, '' order by x.creata_il, x.id) filter (where x.extra is not null)
    into quante, persone_diverse, totale, mesi, extra
    from ricevute_compensi x where x.id = any(ricevute) and x.annullata_il is null and x.movimento_id is null;
  if quante <> cardinality(ricevute) then raise exception 'Una delle ricevute non c''è più, è annullata o è già pagata: ricarica la pagina' using errcode = '22023'; end if;
  if persone_diverse <> 1 then raise exception 'Si pagano insieme solo le ricevute dello stesso tecnico' using errcode = '22023'; end if;
  if paga_compensi.data is null or paga_compensi.data > contabilita_oggi() then raise exception 'La data del pagamento non può essere nel futuro' using errcode = '22023'; end if;
  -- Gli stessi limiti di un movimento scritto a mano (`movimento_comune`).
  if paga_compensi.data < date '2000-01-01' then raise exception 'La data non si capisce' using errcode = '22023'; end if;
  if totale > 10000000 then raise exception 'Il totale è troppo alto per un pagamento solo: paga i mesi in più volte' using errcode = '22023'; end if;
  select * into ca from casse where id = cassa for share;
  if not found then raise exception 'Scegli la cassa' using errcode = '22023'; end if;
  if ca.dal is not null and paga_compensi.data < ca.dal then raise exception 'La data è prima dell’inizio della cassa' using errcode = '22023'; end if;
  if cassa_giorno_chiuso(ca.id, paga_compensi.data) then raise exception 'Quel giorno la cassa è già chiusa: scegli un altro giorno o annulla la chiusura' using errcode = '22023'; end if;
  select p.* into chi from persone p join ricevute_compensi x on x.persona_id = p.id where x.id = ricevute[1];
  descrizione := descrizione_pagamento(chi.nome, chi.cognome, mesi);
  if char_length(descrizione) > 200 then raise exception 'Troppi mesi in un pagamento solo: pagali in più volte' using errcode = '22023'; end if;
  -- Il testo delle extra si accorcia invece di bloccare: una extra lunga 200 caratteri si deve poter pagare.
  descrizione := descrizione || coalesce(extra, '');
  if char_length(descrizione) > 200 then descrizione := left(descrizione, 199) || '…'; end if;
  insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione, creato_da, persona_id)
  values ('uscita', paga_compensi.data, totale, (select id from voci_contabili where tipo = 'uscita' and lower(trim(nome)) = 'compensi istruttori' and di_sistema), ca.id,
          descrizione, persona_corrente(), chi.id)
  returning * into r;
  update ricevute_compensi x set movimento_id = r.id, pagata_il = paga_compensi.data where x.id = any(ricevute);
  return r;
end $$;
revoke all on function paga_compensi(uuid[], date, uuid) from public, anon;
grant execute on function paga_compensi(uuid[], date, uuid) to authenticated;

notify pgrst, 'reload schema';
