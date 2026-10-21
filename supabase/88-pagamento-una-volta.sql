-- ODS Corsi · un pagamento a mano registrato una volta sola
--
-- Gli stessi soldi non entrano due volte, come pagamento a mano e come ricevuta: contavano doppio in PAGAMENTI,
-- CONTABILITÀ e nel previsto della chiusura di cassa. `registra_pagamento_diretto`, rifatta, rifiuta:
--   · il pagamento con la `chiave` (`dati.chiave`) di una ricevuta non annullata della stessa persona: è il modulo
--     ripreso dopo «Fai anche la ricevuta», la rete caduta e «Lascia stare», con la ricevuta in realtà già fatta.
--     Una chiave di una ricevuta annullata, sconosciuta o di un'altra persona non ferma niente;
--   · il pagamento con metodo Satispay quando la persona ha un Satispay arrivato dal modulo (`stato = 'pagato'`) che
--     non è in una ricevuta valida: quei soldi vanno nella ricevuta (`emetti_ricevuta_satispay`). Satispay al banco
--     resta permesso quando non ce n'è uno libero.
-- Chi può cosa: come prima, segreteria e amministrazione; il rifiuto del ruolo viene prima di tutto.
--
-- Si lancia dopo `64-pagamenti-non-nel-futuro.sql`, `73-satispay.sql` e `86-ricevuta-una-volta.sql`, di cui usa
-- `chiave_ricevuta`; rifà `registra_pagamento_diretto` di `64`: se si rilancia `64`, va rilanciato anche questo
-- (`controllo.sql` lo dice). Non chiede di rilanciare `06-iscrizioni.sql`. Finché non c'è, l'app manda la chiave e la
-- funzione di prima la ignora: il Satispay libero lo ferma solo il modulo della scheda.
-- ---------------------------------------------------------------------------

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
  if lower(btrim(dati->>'metodo')) = 'satispay' then
    select sum(s.importo) into libero from pagamenti_satispay s
      where s.persona_id = persona and s.stato = 'pagato'
        and not exists (select 1 from ricevute x where x.id = s.ricevuta_id and x.annullata_il is null);
    if libero > 0 then
      raise exception 'Con Satispay sono già arrivati % € dal modulo: fai la ricevuta con quelli', soldi_sql(libero) using errcode = '22023';
    end if;
  end if;

  insert into pagamenti_diretti (persona_id, data, importo, metodo, voce, nota, creato_da)
  values (persona, giorno, quanto, btrim(dati->>'metodo'), btrim(dati->>'voce'), nullif(btrim(coalesce(dati->>'nota', '')), ''), persona_corrente())
  returning * into nuovo;
  return to_jsonb(nuovo);
end $$;

revoke all on function registra_pagamento_diretto(jsonb) from public, anon;
grant execute on function registra_pagamento_diretto(jsonb) to authenticated;

notify pgrst, 'reload schema';
