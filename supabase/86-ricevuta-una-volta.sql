-- ODS Corsi · una ricevuta fatta una volta sola
--
-- Se la rete perde la risposta di FAI LA RICEVUTA, la ricevuta sul database c'è già ma l'app dice errore: ripremendo,
-- prima nasceva la n. 121 uguale alla 120, e l'incasso contava due volte in PAGAMENTI, CONTABILITÀ e cassa.
-- Ora il modulo, quando si apre, prende una chiave (un uuid) e la manda con la ricevuta (`dati.chiave`):
--   · `ricevute.chiave`, unica anche fra le annullate: una chiave usata non si riusa;
--   · `emetti_ricevuta` con una chiave che c'è già non fa un'altra ricevuta e non prende un numero: dà quella fatta,
--     così com'è, anche se nel frattempo si è cambiato qualcosa nel modulo (fatta, non si cambia più);
--     se è di un'altra persona, o annullata, rifiuta: il modulo va chiuso e riaperto;
--   · `emetti_ricevuta_satispay` con la stessa chiave dà la ricevuta che ha già dentro quel pagamento, invece di
--     «già in una ricevuta»;
--   · senza chiave (l'app di prima, rimasta nel telefono) tutto come prima.
-- Chi può cosa: come prima, segreteria e amministrazione; il rifiuto del ruolo viene prima della chiave.
--
-- Si lancia dopo `55-amministrazione.sql` e `73-satispay.sql`, di cui rifà `emetti_ricevuta` e
-- `emetti_ricevuta_satispay`: se si rilancia uno dei due, va rilanciato anche questo (`controllo.sql` lo dice).
-- Non chiede di rilanciare `06-iscrizioni.sql`. Finché non c'è, l'app manda la chiave e le funzioni di prima la
-- ignorano: si fa la ricevuta come prima, senza la difesa.
-- ---------------------------------------------------------------------------

alter table ricevute add column if not exists chiave uuid;
create unique index if not exists ricevute_chiave on ricevute (chiave) where chiave is not null;

-- La chiave del modulo: vuota, nessuna; non un uuid, un modulo rotto, e si dice invece di perdere la difesa in silenzio.
create or replace function chiave_ricevuta(dati jsonb) returns uuid
  language plpgsql immutable set search_path = public as $$
begin
  return nullif(trim(coalesce(dati->>'chiave', '')), '')::uuid;
exception when others then
  raise exception 'La ricevuta non si capisce: ricarica la pagina' using errcode = '22023';
end $$;

-- La ricevuta già fatta con questa chiave, o niente: vale solo per la stessa persona e se non è stata annullata.
create or replace function ricevuta_gia_fatta(k uuid, persona uuid) returns ricevute
  language plpgsql stable set search_path = public as $$
declare
  r ricevute;
begin
  if k is null then return null; end if;
  select * into r from ricevute where chiave = k;
  if not found then return null; end if;
  if r.persona_id is distinct from persona then
    raise exception 'Questa ricevuta è già stata fatta per un’altra persona: chiudi il modulo e riaprilo' using errcode = '22023';
  end if;
  if r.annullata_il is not null then
    raise exception 'La ricevuta n. %/% fatta da questo modulo è stata annullata: chiudi il modulo e riaprilo per farne un’altra', r.numero, r.anno
      using errcode = '22023';
  end if;
  return r;
end $$;

create or replace function emetti_ricevuta(dati jsonb) returns jsonb
  language plpgsql security definer set search_path = public, extensions as $$
declare
  giorno date;
  a int;
  n int;
  v jsonb;
  pg jsonb;
  q int;
  prezzo int;
  tot int := 0;
  pag int := 0;
  voci jsonb := '[]'::jsonb;
  pagamenti jsonb;
  intest jsonb := coalesce(dati->'intestatario', '{}'::jsonb);
  nuova ricevute;
  k uuid;
  persona uuid;
begin
  if not (e_staff() or e_amministrazione()) then raise exception 'la ricevuta la fa la segreteria' using errcode = '42501'; end if;
  -- Già fatta da questo modulo: quella, prima di guardare i dati, che nel frattempo possono essere cambiati.
  k := chiave_ricevuta(dati);
  persona := nullif(dati->>'persona_id', '')::uuid;
  nuova := ricevuta_gia_fatta(k, persona);
  if nuova.id is not null then return to_jsonb(nuova); end if;
  begin
    giorno := (dati->>'data')::date;
  exception when others then
    raise exception 'La data della ricevuta non si capisce' using errcode = '22023';
  end;
  if giorno is null then raise exception 'Serve la data della ricevuta' using errcode = '22023'; end if;
  if jsonb_typeof(intest) <> 'object' or coalesce(trim(intest->>'nome'), '') = '' or coalesce(trim(intest->>'cognome'), '') = '' then
    raise exception 'Servono nome e cognome del socio' using errcode = '22023';
  end if;
  if jsonb_typeof(dati->'voci') is distinct from 'array' or jsonb_array_length(dati->'voci') = 0 then
    raise exception 'Serve almeno una voce' using errcode = '22023';
  end if;

  -- Le voci si riscrivono pulite: solo i campi che servono, e i conti fatti qui.
  for v in select * from jsonb_array_elements(dati->'voci') loop
    if coalesce(trim(v->>'descrizione'), '') = '' then raise exception 'Ogni voce vuole una descrizione' using errcode = '22023'; end if;
    begin
      q := coalesce((v->>'quantita')::int, 1);
      prezzo := (v->>'prezzo')::int;
    exception when others then
      raise exception 'Il prezzo di «%» non si capisce', v->>'descrizione' using errcode = '22023';
    end;
    if q < 1 or q > 99 then raise exception 'La quantità di «%» va da 1 a 99', v->>'descrizione' using errcode = '22023'; end if;
    if prezzo is null or prezzo < 0 then raise exception 'Il prezzo di «%» non va', v->>'descrizione' using errcode = '22023'; end if;
    if (v->>'dal') is not null and (v->>'al') is not null and (v->>'al')::date < (v->>'dal')::date then
      raise exception 'Le date di «%» sono al contrario', v->>'descrizione' using errcode = '22023';
    end if;
    pagamenti := '[]'::jsonb;
    for pg in select * from jsonb_array_elements(coalesce(v->'pagamenti', '[]'::jsonb)) loop
      if (pg->>'importo')::int is null or (pg->>'importo')::int < 0 then raise exception 'Un pagamento di «%» non va', v->>'descrizione' using errcode = '22023'; end if;
      if (pg->>'importo')::int = 0 then continue; end if;
      pag := pag + (pg->>'importo')::int;
      pagamenti := pagamenti || jsonb_build_object('data', coalesce((pg->>'data')::date, giorno), 'importo', (pg->>'importo')::int, 'metodo', left(coalesce(pg->>'metodo', ''), 40));
    end loop;
    tot := tot + q * prezzo;
    voci := voci || jsonb_build_object(
      'descrizione', left(trim(v->>'descrizione'), 120), 'quantita', q, 'prezzo', prezzo,
      'dal', (v->>'dal')::date, 'al', (v->>'al')::date, 'pagamenti', pagamenti);
  end loop;
  if pag + coalesce((dati->>'anticipo')::int, 0) > tot then
    raise exception 'Si è pagato più del totale: controlla gli importi' using errcode = '22023';
  end if;

  a := extract(year from giorno)::int;
  -- Una ricevuta per volta, per anno: due segreterie insieme non prendono lo stesso numero.
  perform pg_advisory_xact_lock(hashtext('ricevute'), a);
  n := nullif(dati->>'numero', '')::int;
  if n is null then
    select coalesce(max(numero), 0) + 1 into n from ricevute where anno = a;
  elsif exists (select 1 from ricevute r where r.anno = a and r.numero = n) then
    raise exception 'La ricevuta numero % del % c’è già: lascia il numero vuoto per il primo libero', n, a using errcode = '22023';
  end if;

  begin
    insert into ricevute (anno, numero, data, persona_id, ente, intestatario, voci, totale, pagato, anticipo, note, creata_da, chiave)
    values (a, n, giorno, persona, coalesce(dati->'ente', '{}'::jsonb), intest, voci, tot, pag,
            coalesce((dati->>'anticipo')::int, 0), nullif(trim(coalesce(dati->>'note', '')), ''), persona_corrente(), k)
    returning * into nuova;
  exception when unique_violation then
    -- La stessa chiave fatta nello stesso momento da un'altra chiamata (con un'altra data, un altro anno e un altro
    -- lucchetto): vale quella. Senza chiave l'unico doppione possibile è il numero, che il lucchetto non lascia passare.
    nuova := ricevuta_gia_fatta(k, persona);
    if nuova.id is null then raise; end if;
  end;
  return to_jsonb(nuova);
end $$;

-- Come in `73-satispay.sql`, più la chiave: la stessa ripetuta dà la ricevuta che ha già dentro questo pagamento.
create or replace function emetti_ricevuta_satispay(dati jsonb, pagamento uuid) returns jsonb
  language plpgsql security definer set search_path = public, extensions as $$
declare
  p pagamenti_satispay;
  somma int;
  nuova jsonb;
  gia ricevute;
begin
  if not (e_staff() or e_amministrazione()) then raise exception 'la ricevuta la fa la segreteria' using errcode = '42501'; end if;
  select * into p from pagamenti_satispay where id = pagamento for update;
  if p.id is null or p.stato <> 'pagato' then
    raise exception 'Questo pagamento Satispay non è arrivato' using errcode = '22023';
  end if;
  gia := ricevuta_gia_fatta(chiave_ricevuta(dati), nullif(dati->>'persona_id', '')::uuid);
  if gia.id is not null and gia.id = p.ricevuta_id then return to_jsonb(gia); end if;
  -- Il modulo ha già fatto una ricevuta senza questo pagamento: legarlo a quella la farebbe dire il falso.
  if gia.id is not null then
    raise exception 'La ricevuta n. %/% fatta da questo modulo non ha dentro questo pagamento Satispay: chiudi il modulo e riaprilo', gia.numero, gia.anno
      using errcode = '22023';
  end if;
  -- In una ricevuta annullata i soldi non contano più: possono entrare in quella giusta.
  if exists (select 1 from ricevute r where r.id = p.ricevuta_id and r.annullata_il is null) then
    raise exception 'Questo pagamento Satispay è già in una ricevuta' using errcode = '22023';
  end if;
  if p.persona_id is null or p.persona_id is distinct from nullif(dati->>'persona_id', '')::uuid then
    raise exception 'Il pagamento Satispay è di un’altra persona: accogli prima la sua richiesta' using errcode = '22023';
  end if;
  select coalesce(sum((pg->>'importo')::int), 0) into somma
    from jsonb_array_elements(coalesce(dati->'voci', '[]'::jsonb)) v,
         jsonb_array_elements(coalesce(v->'pagamenti', '[]'::jsonb)) pg
    where pg->>'metodo' = 'Satispay';
  if somma <> p.importo then
    -- Lo stesso testo di `cosaNonVaSatispay` (src/lib/satispay.ts): i centesimi solo se ci sono.
    raise exception 'Con Satispay sono arrivati % €: nel pagato di questa ricevuta ce ne sono % €', soldi_sql(p.importo), soldi_sql(somma)
      using errcode = '22023';
  end if;
  nuova := emetti_ricevuta(dati);
  update pagamenti_satispay set ricevuta_id = (nuova->>'id')::uuid where id = p.id;
  return nuova;
end $$;

revoke all on function chiave_ricevuta(jsonb), ricevuta_gia_fatta(uuid, uuid) from public, anon, authenticated;
revoke all on function emetti_ricevuta(jsonb), emetti_ricevuta_satispay(jsonb, uuid) from public, anon;
grant execute on function emetti_ricevuta(jsonb), emetti_ricevuta_satispay(jsonb, uuid) to authenticated;

notify pgrst, 'reload schema';
