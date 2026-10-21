-- ODS Corsi · i contanti di un giorno di cassa chiusa non entrano dalla ricevuta
--
-- Il pagamento a mano rifiutava già i contanti con la data di un giorno in cui la Cassa Contanti è chiusa
-- (`88-pagamento-una-volta.sql`): dopo la chiusura cambierebbero il previsto e la chiusura non sarebbe più in regola.
-- La ricevuta no: con REGISTRA IL PAGAMENTO e «Fai anche la ricevuta» l'incasso passava da lei, senza blocco.
--   · `emetti_ricevuta` rifiuta un pagamento in contanti (importo > 0) con la data di un giorno chiuso, dopo il ruolo e
--     dopo la chiave (la ricevuta già fatta da quel modulo torna com'è). Anche `emetti_ricevuta_satispay`, che passa
--     da lei. Il corpo sta in `fai_ricevuta`, interna;
--   · `emetti_ricevuta_da_pagamento` (89) lascia passare solo i contanti del pagamento a mano che diventa ricevuta:
--     sono già nel previsto di quel giorno, e la ricevuta li prende tali e quali;
--   · `cassa_contanti_chiusa_fino()`: la data dell'ultima chiusura della Cassa Contanti, per l'avviso «la chiusura non
--     sarà più in regola» quando si annulla. `chiusure_cassa` la legge solo l'amministrazione: così lo vede anche la
--     segreteria, che ne sa solo la data (né previsto, né contato, né differenza).
-- Chi può cosa: segreteria e amministrazione, come prima; `fai_ricevuta` non la chiama nessuno da fuori.
--
-- Si lancia dopo `86-ricevuta-una-volta.sql` e `89-pagamento-diventa-ricevuta.sql`, di cui rifà `emetti_ricevuta` ed
-- `emetti_ricevuta_da_pagamento`: se si rilancia uno dei due, va rilanciato anche questo (`controllo.sql` lo dice).
-- Non chiede di rilanciare `06-iscrizioni.sql`. Finché non c'è, la ricevuta accetta i contanti come prima e l'avviso
-- lo vede solo l'amministrazione.
-- ---------------------------------------------------------------------------

-- Il corpo di `emetti_ricevuta` (86), più il giorno chiuso. `tranne`: i contanti di quella data li lascia passare
-- (li passa solo `emetti_ricevuta_da_pagamento`, per i soldi del suo pagamento a mano).
create or replace function fai_ricevuta(dati jsonb, tranne date) returns jsonb
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
  contanti uuid := (select id from casse where nome = 'Cassa Contanti');
  quando date;
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
      quando := coalesce((pg->>'data')::date, giorno);
      -- I contanti entrano nella Cassa Contanti: in un giorno già chiuso romperebbero la chiusura (come in `88`).
      if lower(btrim(left(coalesce(pg->>'metodo', ''), 40))) = 'contanti' and quando is distinct from tranne
         and cassa_giorno_chiuso(contanti, quando) then
        raise exception 'Quel giorno la cassa è già chiusa: scegli una data dopo la chiusura' using errcode = '22023';
      end if;
      pag := pag + (pg->>'importo')::int;
      pagamenti := pagamenti || jsonb_build_object('data', quando, 'importo', (pg->>'importo')::int, 'metodo', left(coalesce(pg->>'metodo', ''), 40));
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


create or replace function emetti_ricevuta(dati jsonb) returns jsonb
  language plpgsql security definer set search_path = public, extensions as $$
begin
  return fai_ricevuta(dati, null);
end $$;

-- Come in `89`, con `fai_ricevuta`: i contanti del pagamento a mano passano anche in un giorno chiuso, gli altri no.
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
  -- Quella data passa solo se il pagamento a mano è in contanti; il controllo qui sotto vuole che siano i suoi soldi, tali e quali.
  nuova := fai_ricevuta(dati, case when lower(btrim(p.metodo)) = 'contanti' then p.data end);
  -- Quei soldi entrano tali e quali (stessa data, stesso modo): il previsto della cassa di quel giorno non si muove.
  -- Si guarda la ricevuta come l'ha scritta `fai_ricevuta` (il metodo tagliato a 40, la data già messa), cioè quel
  -- che legge `previsto_cassa`; il rifiuto disfa anche lei.
  select coalesce(sum((pg->>'importo')::int), 0) into somma
    from jsonb_array_elements(nuova->'voci') v, jsonb_array_elements(coalesce(v->'pagamenti', '[]')) pg
    where lower(btrim(pg->>'metodo')) = lower(btrim(p.metodo)) and (pg->>'data')::date = p.data;
  if somma <> p.importo then
    raise exception 'Il pagamento a mano di % € (%, %) va nella ricevuta così com’è: rimettilo, o annulla il pagamento e fai la ricevuta a mano', soldi_sql(p.importo), p.metodo, to_char(p.data, 'DD/MM/YYYY') using errcode = '22023';
  end if;
  update pagamenti_diretti set annullato_il = now(), annullato_da = persona_corrente(), ricevuta_id = (nuova->>'id')::uuid where id = p.id;
  return nuova;
end $$;

-- Fin quando è chiusa la Cassa Contanti (null: mai chiusa). Solo la data: il resto della chiusura è dell'amministrazione.
create or replace function cassa_contanti_chiusa_fino() returns date
  language plpgsql stable security definer set search_path = public as $$
begin
  if not (e_staff() or e_amministrazione()) then raise exception 'la cassa la vede la segreteria' using errcode = '42501'; end if;
  return (select max(h.data) from chiusure_cassa h join casse c on c.id = h.cassa_id
          where c.nome = 'Cassa Contanti' and h.annullata_il is null);
end $$;

revoke all on function fai_ricevuta(jsonb, date) from public, anon, authenticated;
revoke all on function emetti_ricevuta(jsonb), emetti_ricevuta_da_pagamento(jsonb, uuid), cassa_contanti_chiusa_fino() from public, anon;
grant execute on function emetti_ricevuta(jsonb), emetti_ricevuta_da_pagamento(jsonb, uuid), cassa_contanti_chiusa_fino() to authenticated;

notify pgrst, 'reload schema';
