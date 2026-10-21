-- ODS Corsi · il pagamento a mano diventa ricevuta
--
-- Un pagamento registrato a mano, senza ricevuta, diventa ricevuta da FANNE LA RICEVUTA nello storico della scheda:
--   · `emetti_ricevuta_da_pagamento(dati, pagamento)` fa la ricevuta e annulla il pagamento a mano nella stessa
--     transazione (o tutte e due, o nessuna), e lo lega alla ricevuta (`pagamenti_diretti.ricevuta_id`). Dentro la
--     ricevuta i pagamenti con lo stesso modo e la stessa data devono fare esattamente il suo importo: così il previsto
--     della chiusura di cassa non si muove. Con la chiave del modulo (`86`), ripetuta dà la ricevuta già fatta;
--   · `annulla_ricevuta`, rifatta: annullata la ricevuta, il pagamento a mano che era diventato lei torna SENZA
--     RICEVUTA, come prima. Una ricevuta normale non tocca i pagamenti a mano.
-- Chi può cosa: come `emetti_ricevuta`, segreteria e amministrazione; il rifiuto del ruolo viene prima di tutto.
--
-- Si lancia dopo `55-amministrazione.sql` e `86-ricevuta-una-volta.sql`; rifà `annulla_ricevuta` di `55`: se si
-- rilancia `55`, va rilanciato anche questo (`controllo.sql` lo dice). Non chiede di rilanciare `06-iscrizioni.sql`.
-- Finché non c'è, FANNE LA RICEVUTA dice di lanciare questo file, e il resto dell'app va come prima.
-- ---------------------------------------------------------------------------

-- La ricevuta in cui è finito il pagamento a mano: annullato, ma non perso.
alter table pagamenti_diretti add column if not exists ricevuta_id uuid references ricevute on delete set null;

create or replace function emetti_ricevuta_da_pagamento(dati jsonb, pagamento uuid) returns jsonb
  language plpgsql security definer set search_path = public, extensions as $$
declare
  p pagamenti_diretti;
  gia ricevute;
  somma int;
  nuova jsonb;
begin
  if not (e_staff() or e_amministrazione()) then raise exception 'la ricevuta la fa la segreteria' using errcode = '42501'; end if;
  select * into p from pagamenti_diretti where id = pagamento for update;
  if p.id is null then raise exception 'Questo pagamento a mano non c’è più' using errcode = '22023'; end if;
  -- Prima la chiave, poi «già annullato»: ripetuta dopo una rete caduta, la stessa chiamata dà la ricevuta già fatta.
  gia := ricevuta_gia_fatta(chiave_ricevuta(dati), nullif(dati->>'persona_id', '')::uuid);
  if gia.id is not null and gia.id = p.ricevuta_id then return to_jsonb(gia); end if;
  if gia.id is not null then raise exception 'La ricevuta n. %/% fatta da questo modulo non ha dentro questo pagamento a mano: chiudi il modulo e riaprilo', gia.numero, gia.anno using errcode = '22023'; end if;
  if p.annullato_il is not null then raise exception 'Questo pagamento a mano è già annullato: la ricevuta si fa da + FAI LA RICEVUTA' using errcode = '22023'; end if;
  if p.persona_id is distinct from nullif(dati->>'persona_id', '')::uuid then raise exception 'Il pagamento a mano è di un’altra persona' using errcode = '22023'; end if;
  -- Quei soldi entrano tali e quali (stessa data, stesso modo): il previsto della cassa di quel giorno non si muove.
  select coalesce(sum((pg->>'importo')::int), 0) into somma
    from jsonb_array_elements(coalesce(dati->'voci', '[]')) v, jsonb_array_elements(coalesce(v->'pagamenti', '[]')) pg
    where lower(btrim(pg->>'metodo')) = lower(btrim(p.metodo)) and coalesce((pg->>'data')::date, (dati->>'data')::date) = p.data;
  if somma <> p.importo then
    raise exception 'Il pagamento a mano di % € (%, %) va nella ricevuta così com’è: rimettilo, o annulla il pagamento e fai la ricevuta a mano', soldi_sql(p.importo), p.metodo, to_char(p.data, 'DD/MM/YYYY') using errcode = '22023';
  end if;
  nuova := emetti_ricevuta(dati);
  update pagamenti_diretti set annullato_il = now(), annullato_da = persona_corrente(), ricevuta_id = (nuova->>'id')::uuid where id = p.id;
  return nuova;
end $$;

create or replace function annulla_ricevuta(ricevuta uuid) returns void
  language plpgsql security definer set search_path = public, extensions as $$
begin
  if not (e_staff() or e_amministrazione()) then raise exception 'la ricevuta la annulla la segreteria' using errcode = '42501'; end if;
  update ricevute set annullata_il = now(), annullata_da = persona_corrente() where id = ricevuta and annullata_il is null;
  if not found then raise exception 'ricevuta inesistente o già annullata' using errcode = 'P0002'; end if;
  -- Il pagamento a mano che era diventato questa ricevuta torna com'era: i soldi non spariscono, la cassa non cambia.
  update pagamenti_diretti set annullato_il = null, annullato_da = null, ricevuta_id = null where ricevuta_id = ricevuta;
end $$;

revoke all on function emetti_ricevuta_da_pagamento(jsonb, uuid), annulla_ricevuta(uuid) from public, anon;
grant execute on function emetti_ricevuta_da_pagamento(jsonb, uuid), annulla_ricevuta(uuid) to authenticated;

notify pgrst, 'reload schema';
