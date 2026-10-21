-- ODS Corsi · la ricevuta non si fa nel futuro, e il numero a mano solo in un anno senza ricevute
--
-- La data della ricevuta non aveva limiti: il 31/12 bastava scrivere 2027 al posto di 2026 per aprire la numerazione
-- del 2027 prima del tempo. E il numero a mano valeva sempre: 1160 al posto di 116 lasciava un buco che `max+1` non
-- chiude più. `fai_ricevuta` (92), il corpo di `emetti_ricevuta`, `emetti_ricevuta_satispay` ed
-- `emetti_ricevuta_da_pagamento`, ora rifiuta, dopo il ruolo e la chiave (la ricevuta già fatta torna com'è):
--   · la data dopo oggi (il giorno di Roma, `contabilita_oggi()`) o fuori dal 2000–2100;
--   · un pagamento dentro una voce con la data dopo oggi o prima del 2000;
--   · il numero a mano se l'anno ha già ricevute, o fuori da 1–999999;
--   · la nota oltre 500 caratteri, col messaggio suo invece del vincolo della tabella.
-- Chi può cosa: come prima; `fai_ricevuta` non la chiama nessuno da fuori.
--
-- Si lancia dopo `92-ricevuta-cassa-chiusa.sql`, di cui rifà `fai_ricevuta`: se si rilancia la 92, va rilanciato
-- anche questo (`controllo.sql` lo dice). Non chiede di rilanciare `06-iscrizioni.sql`. Finché non c'è, la data e il
-- numero li controlla solo l'app.
-- ---------------------------------------------------------------------------

-- Il corpo della 92, più la data, il numero e la nota. `tranne`: i contanti di quella data li lascia passare anche in
-- un giorno chiuso (li passa solo `emetti_ricevuta_da_pagamento`, per i soldi del suo pagamento a mano).
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
  -- Fuori dal 2000–2100 la tabella la rifiuterebbe col testo grezzo del vincolo.
  if giorno not between date '2000-01-01' and date '2100-12-31' then
    raise exception 'La data della ricevuta non torna' using errcode = '22023';
  end if;
  -- Una data avanti apre la numerazione di quell'anno prima del tempo (il 31/12 un 2027 al posto del 2026).
  if giorno > contabilita_oggi() then
    raise exception 'La data della ricevuta è nel futuro: si fa per quel che è già successo' using errcode = '22023';
  end if;
  if length(coalesce(dati->>'note', '')) > 500 then
    raise exception 'La nota è troppo lunga: al massimo 500 caratteri' using errcode = '22023';
  end if;
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
      if quando > contabilita_oggi() then
        raise exception 'Un pagamento di «%» ha la data nel futuro: si scrive quel che è già successo', v->>'descrizione' using errcode = '22023';
      end if;
      if quando < date '2000-01-01' then
        raise exception 'La data di un pagamento di «%» non torna', v->>'descrizione' using errcode = '22023';
      end if;
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
  begin
    n := nullif(dati->>'numero', '')::int;
  exception when others then
    raise exception 'Il numero della ricevuta non va' using errcode = '22023';
  end;
  if n is null then
    select coalesce(max(numero), 0) + 1 into n from ricevute where anno = a;
  elsif n not between 1 and 999999 then
    raise exception 'Il numero della ricevuta non va' using errcode = '22023';
  -- Il numero a mano serve solo a continuare un altro programma, in un anno ancora senza ricevute: dopo, max+1 ripartirebbe da un
  -- numero sbagliato (1160 per 116) e il buco non si chiude più.
  elsif exists (select 1 from ricevute r where r.anno = a) then
    raise exception 'Il % ha già le sue ricevute: lascia vuoto il numero, prende il primo libero', a using errcode = '22023';
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

revoke all on function fai_ricevuta(jsonb, date) from public, anon, authenticated;

notify pgrst, 'reload schema';
