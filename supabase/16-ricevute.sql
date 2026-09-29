-- ---------------------------------------------------------------------------
-- ODS Corsi · le ricevute dei pagamenti
--
-- Quando un iscritto paga, la segreteria fa la ricevuta: la «ricevuta
-- semplice» dell'associazione, con il numero, i dati del socio, le voci
-- pagate (la quota associativa, l'annuale di un corso…) con da quando a
-- quando valgono, come sono state pagate e la dicitura dell'esenzione.
-- Il PDF lo fa il browser (`src/lib/ricevutaPdf.ts`); qui si tiene la
-- ricevuta, così si ristampa uguale quando si vuole.
--
-- Una ricevuta fatta non si cambia e non si cancella: si annulla, e il suo
-- numero resta preso, perché la numerazione non deve avere buchi che non si
-- spiegano. I dati dell'associazione e del socio si copiano dentro la
-- ricevuta quando la si fa: se dopo il socio cambia indirizzo, o la persona
-- si cancella, la ricevuta resta com'era.
--
-- I numeri ripartono da 1 ogni anno (l'anno della data della ricevuta). Chi
-- arriva da un altro programma a metà anno può dire il numero della prima:
-- la funzione prende quello che le si dà, se è libero, e poi va avanti da lì.
--
-- Si lancia dopo `07-certificati-pagamenti.sql`. Non dà niente ad `anon`, e
-- non chiede di rilanciare `06-iscrizioni.sql`.
-- ---------------------------------------------------------------------------

-- I dati dell'associazione che vanno in testa alle ricevute, e la dicitura
-- dell'esenzione. Vuoto vuol dire quelli scritti nell'app (`ENTE_PREDEFINITO`
-- in `src/lib/ricevute.ts`).
alter table impostazioni add column if not exists ricevute jsonb not null default '{}'::jsonb;
alter table impostazioni drop constraint if exists impostazioni_ricevute_check;
alter table impostazioni add constraint impostazioni_ricevute_check
  check (jsonb_typeof(ricevute) = 'object' and octet_length(ricevute::text) <= 4000);

create table if not exists ricevute (
  id            uuid primary key default gen_random_uuid(),
  anno          int not null check (anno between 2000 and 2100),
  numero        int not null check (numero between 1 and 999999),
  data          date not null,
  -- La persona in elenco: se si cancella, la ricevuta resta col socio scritto dentro.
  persona_id    uuid references persone on delete set null,
  ente          jsonb not null check (jsonb_typeof(ente) = 'object' and octet_length(ente::text) <= 4000),
  intestatario  jsonb not null check (jsonb_typeof(intestatario) = 'object' and octet_length(intestatario::text) <= 4000),
  -- [{descrizione, quantita, prezzo, dal, al, pagamenti: [{data, importo, metodo}]}], importi in centesimi.
  voci          jsonb not null check (jsonb_typeof(voci) = 'array' and jsonb_array_length(voci) between 1 and 20 and octet_length(voci::text) <= 20000),
  -- In centesimi, calcolati dal server dalle voci.
  totale        int not null check (totale >= 0),
  pagato        int not null check (pagato >= 0),
  anticipo      int not null default 0 check (anticipo >= 0),
  note          text check (length(note) <= 500),
  creata_il     timestamptz not null default now(),
  creata_da     uuid references persone on delete set null,
  annullata_il  timestamptz,
  annullata_da  uuid references persone on delete set null,
  unique (anno, numero)
);
create index if not exists ricevute_persona on ricevute (persona_id, data desc);
create index if not exists ricevute_data on ricevute (data desc);

-- Solo la segreteria le legge; si scrivono solo dalle due funzioni qui sotto.
alter table ricevute enable row level security;
drop policy if exists ricevute_legge on ricevute;
create policy ricevute_legge on ricevute for select to authenticated using (e_staff());
revoke all on ricevute from anon, authenticated;
grant select on ricevute to authenticated;

/**
 * Fa una ricevuta e le dà il numero. `dati`:
 *   { data, persona_id, ente, intestatario, voci, anticipo, note, numero? }
 * Il totale e il pagato li conta il server dalle voci. Senza `numero`, il
 * primo libero dopo l'ultimo dell'anno; con `numero`, quello, se è libero.
 */
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
begin
  if not e_staff() then raise exception 'la ricevuta la fa la segreteria' using errcode = '42501'; end if;
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

  insert into ricevute (anno, numero, data, persona_id, ente, intestatario, voci, totale, pagato, anticipo, note, creata_da)
  values (a, n, giorno, nullif(dati->>'persona_id', '')::uuid, coalesce(dati->'ente', '{}'::jsonb), intest, voci, tot, pag,
          coalesce((dati->>'anticipo')::int, 0), nullif(trim(coalesce(dati->>'note', '')), ''), persona_corrente())
  returning * into nuova;
  return to_jsonb(nuova);
end $$;

/** Annulla una ricevuta: resta, col suo numero, segnata come annullata. */
create or replace function annulla_ricevuta(ricevuta uuid) returns void
  language plpgsql security definer set search_path = public, extensions as $$
begin
  if not e_staff() then raise exception 'la ricevuta la annulla la segreteria' using errcode = '42501'; end if;
  update ricevute set annullata_il = now(), annullata_da = persona_corrente()
    where id = ricevuta and annullata_il is null;
  if not found then raise exception 'ricevuta inesistente o già annullata' using errcode = 'P0002'; end if;
end $$;

revoke all on function emetti_ricevuta(jsonb), annulla_ricevuta(uuid) from public, anon;
grant execute on function emetti_ricevuta(jsonb), annulla_ricevuta(uuid) to authenticated;

notify pgrst, 'reload schema';
