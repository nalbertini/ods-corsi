-- ---------------------------------------------------------------------------
-- ODS Corsi · gli stessi soldi in un pagamento a mano e in una ricevuta, mai
--
-- «Lascia stare» sulla ricevuta, poi REGISTRA IL PAGAMENTO senza ricevuta: se
-- la ricevuta di quel modulo era partita (la rete lenta, un secondo tentativo,
-- il modulo ripreso), arrivava dopo il pagamento a mano e gli stessi soldi
-- contavano due volte. `registra_pagamento_diretto` guardava solo la ricevuta
-- già fatta, prima; della chiave del modulo non teneva niente.
--
-- Adesso:
--   · il pagamento a mano tiene la chiave del modulo da cui viene
--     (`pagamenti_diretti.chiave_ricevuta`, vuota se non viene da un modulo);
--   · una ricevuta con quella chiave, della stessa persona, non entra finché
--     il pagamento a mano è attivo (`ricevute_non_due_volte`, su ogni strada:
--     `emetti_ricevuta`, Satispay, dal pagamento a mano), né dopo che il
--     pagamento è diventato ricevuta con FANNE LA RICEVUTA (che usa una
--     chiave nuova e va come prima). Annullato il pagamento a mano, va.
--
-- Chi può cosa: come prima (staff e amministrazione registrano).
-- Si lancia dopo `115-carta.sql` (e `127-verbali.sql`); rilanciando `115` va
-- rilanciato anche questo. Non chiede di rilanciare `06-iscrizioni.sql`.
-- Finché non c'è, l'app va come prima e il doppione resta possibile.
-- ---------------------------------------------------------------------------

alter table pagamenti_diretti add column if not exists chiave_ricevuta uuid;
create index if not exists pagamenti_diretti_chiave_ricevuta on pagamenti_diretti (chiave_ricevuta) where chiave_ricevuta is not null;

-- La stessa di 115-carta.sql, più la chiave del modulo nella riga.
create or replace function registra_pagamento_diretto(dati jsonb) returns jsonb
  language plpgsql security definer set search_path = public, extensions as $$
declare
  giorno date;
  quanto int;
  persona uuid;
  nuovo pagamenti_diretti;
  k uuid;
  r ricevute;
  libero int;
begin
  if not (e_staff() or e_amministrazione()) then raise exception 'il pagamento lo registra la segreteria' using errcode = '42501'; end if;
  begin
    persona := (dati->>'persona_id')::uuid;
  exception when others then
    raise exception 'Manca la persona' using errcode = '22023';
  end;
  if persona is null or not exists (select 1 from persone where id = persona) then
    raise exception 'Questa scheda non c’è più' using errcode = '22023';
  end if;
  begin
    giorno := (dati->>'data')::date;
  exception when others then
    raise exception 'La data del pagamento non si capisce' using errcode = '22023';
  end;
  if giorno is null then raise exception 'Serve la data del pagamento' using errcode = '22023'; end if;
  if giorno not between date '2000-01-01' and date '2100-12-31' then raise exception 'La data del pagamento non torna' using errcode = '22023'; end if;
  if giorno > contabilita_oggi() then raise exception 'La data è nel futuro: si registra quel che è già successo' using errcode = '22023'; end if;
  begin
    quanto := (dati->>'importo')::int;
  exception when others then
    raise exception 'L’importo non si capisce' using errcode = '22023';
  end;
  if quanto is null or quanto <= 0 then raise exception 'L’importo deve essere più di zero' using errcode = '22023'; end if;
  if quanto > 10000000 then raise exception 'L’importo è troppo alto: controlla le cifre' using errcode = '22023'; end if;
  -- `->>` farebbe testo anche di un oggetto o di una lista: metodo e voce devono essere testo.
  if jsonb_typeof(dati->'metodo') is distinct from 'string' then raise exception 'Scegli come ha pagato' using errcode = '22023'; end if;
  if jsonb_typeof(dati->'voce') is distinct from 'string' then raise exception 'Scrivi a cosa serve il pagamento' using errcode = '22023'; end if;
  if coalesce(btrim(dati->>'metodo'), '') = '' then raise exception 'Scegli come ha pagato' using errcode = '22023'; end if;
  if char_length(btrim(dati->>'metodo')) > 40 then raise exception 'Il modo di pagamento è troppo lungo' using errcode = '22023'; end if;
  if coalesce(btrim(dati->>'voce'), '') = '' then raise exception 'Scrivi a cosa serve il pagamento' using errcode = '22023'; end if;
  if char_length(btrim(dati->>'voce')) > 120 then raise exception 'La voce è troppo lunga' using errcode = '22023'; end if;
  if char_length(coalesce(dati->>'nota', '')) > 300 then raise exception 'La nota è troppo lunga: al massimo 300 caratteri' using errcode = '22023'; end if;
  -- I contanti entrano nella Cassa Contanti: in un giorno già chiuso romperebbero la chiusura. Carta e bonifico non la toccano.
  if lower(btrim(dati->>'metodo')) = 'contanti' and cassa_giorno_chiuso((select id from casse where nome = 'Cassa Contanti'), giorno) then
    raise exception 'Quel giorno la cassa è già chiusa: scegli una data dopo la chiusura' using errcode = '22023';
  end if;

  -- Ripreso dopo «Lascia stare»: se la ricevuta di quel modulo è stata fatta (la risposta persa con la rete), i soldi sono già lì.
  k := chiave_ricevuta(dati);
  select * into r from ricevute where chiave = k and persona_id = persona and annullata_il is null;
  if r.id is not null then
    raise exception 'Questo pagamento è già nella ricevuta n. %/%: non va registrato di nuovo', r.numero, r.anno using errcode = '22023';
  end if;
  -- Un Satispay arrivato dal modulo e non ancora in una ricevuta: va fatta la ricevuta con quelli, non un pagamento a mano sopra.
  -- Lo stesso con la carta: ogni circuito guarda solo i suoi soldi.
  if lower(btrim(dati->>'metodo')) in ('satispay', 'carta') then
    select sum(s.importo) into libero from pagamenti_satispay s
      where s.persona_id = persona and s.stato = 'pagato' and s.circuito = lower(btrim(dati->>'metodo'))
        and not exists (select 1 from ricevute x where x.id = s.ricevuta_id and x.annullata_il is null);
    if libero > 0 then
      raise exception '% sono già arrivati % € dal modulo: fai la ricevuta con quelli',
        case when lower(btrim(dati->>'metodo')) = 'carta' then 'Con la carta' else 'Con Satispay' end, soldi_sql(libero)
        using errcode = '22023';
    end if;
  end if;

  insert into pagamenti_diretti (persona_id, data, importo, metodo, voce, nota, creato_da, chiave_ricevuta)
  values (persona, giorno, quanto, btrim(dati->>'metodo'), btrim(dati->>'voce'), nullif(btrim(coalesce(dati->>'nota', '')), ''), persona_corrente(), k)
  returning * into nuovo;
  return to_jsonb(nuovo);
end $$;
revoke all on function registra_pagamento_diretto(jsonb) from public, anon;
grant execute on function registra_pagamento_diretto(jsonb) to authenticated;

-- Nel trigger e non in `fai_ricevuta`: ogni strada che scrive una ricevuta passa di qui.
create or replace function ricevute_non_due_volte() returns trigger
  language plpgsql security definer set search_path = public, extensions as $$
declare p pagamenti_diretti; r ricevute;
begin
  if new.chiave is null then return new; end if;
  -- Attivo, o diventato ricevuta: `annulla_ricevuta` (89) lo rimette attivo, quindi libero resta solo l'annullato a mano.
  select * into p from pagamenti_diretti
    where chiave_ricevuta = new.chiave and persona_id = new.persona_id and (annullato_il is null or ricevuta_id is not null)
    order by creato_il limit 1;
  if p.id is null then return new; end if;
  if p.ricevuta_id is not null then
    select * into r from ricevute where id = p.ricevuta_id;
    raise exception 'Questi soldi sono già nella ricevuta n. %/%: chiudi il modulo', r.numero, r.anno using errcode = '22023';
  end if;
  raise exception 'Questi soldi sono già nel pagamento a mano di % € del %: chiudi il modulo e fai la ricevuta da lì, con FANNE LA RICEVUTA',
    soldi_sql(p.importo), to_char(p.data, 'DD/MM/YYYY') using errcode = '22023';
  return new;
end $$;
revoke all on function ricevute_non_due_volte() from public, anon, authenticated;
create or replace trigger ricevute_non_due_volte before insert on ricevute
  for each row execute function ricevute_non_due_volte();

notify pgrst, 'reload schema';
