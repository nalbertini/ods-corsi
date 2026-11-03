-- L'importo di una riga del compenso è minuti × tariffa / 60, diviso alla fine come nell'app
-- (`compensoDelMese` in src/lib/compensi.ts). Prima qui si divideva per 60 all'inizio: 5/60 in numeric
-- non è esatto, e 5 minuti a 22,50 €/h davano 187 centesimi contro i 188 dell'app, e la ricevuta
-- veniva rifiutata con «Le righe del compenso non sono giuste».
-- Rifà `fai_ricevuta_compenso` di `96-compensi-extra.sql`, uguale tranne il conto. Chi può fare cosa non cambia.
-- Si lancia dopo `96-compensi-extra.sql`; rilanciando `80` o `96` va rilanciato anche questo. Non chiede di
-- rilanciare `06-iscrizioni.sql`. Finché non c'è, le ricevute con un importo che finisce in mezzo centesimo
-- vengono rifiutate come prima. Le ricevute già fatte non cambiano: il controllo è solo nella funzione. Una fatta col conto vecchio su un mezzo centesimo in COMPENSI risulterebbe «non torna»: al 2026-11-03 non ce n'era nessuna.

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
       or (t->>'importo')::int <> round((t->>'minuti')::numeric * (t->>'centesimi_ora')::int / 60))
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

notify pgrst, 'reload schema';
