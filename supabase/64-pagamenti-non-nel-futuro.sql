-- Il pagamento a mano: non nel futuro, e i contanti non in un giorno di cassa già chiuso.
--
--   1. Una data dopo oggi (a Roma, come `contabilita_oggi()`) è un pagamento che non è successo:
--      `registra_pagamento_diretto` la rifiuta con la stessa frase di movimenti e giroconti, e un
--      trigger chiude anche la porta a chi scrive nella tabella senza passare dalla funzione.
--      Il passato non ha soglie nuove (resta il 2000 del vincolo di 54).
--   2. Un incasso in contanti con data in un giorno già chiuso non si registra: cambierebbe il
--      previsto di una chiusura fatta («non più in regola»). Carta e bonifico non entrano nella
--      Cassa Contanti e restano permessi. I pagamenti già scritti non si toccano.
--
-- Si lancia dopo 55-amministrazione.sql, 59-contabilita.sql e 60-chiusura-cassa.sql, e si può
-- rilanciare senza danni. L'app rifiuta già il futuro anche senza questo file; il giorno chiuso
-- lo ferma solo il database (la segreteria non legge le chiusure).

create or replace function pagamento_diretto_non_nel_futuro() returns trigger
  language plpgsql set search_path = public as $$
begin
  if new.data > contabilita_oggi() then
    raise exception 'La data è nel futuro: si registra quel che è già successo' using errcode = '22023';
  end if;
  return new;
end $$;

drop trigger if exists pagamenti_diretti_non_nel_futuro on pagamenti_diretti;
create trigger pagamenti_diretti_non_nel_futuro before insert or update of data on pagamenti_diretti
  for each row execute function pagamento_diretto_non_nel_futuro();

create or replace function registra_pagamento_diretto(dati jsonb) returns jsonb
  language plpgsql security definer set search_path = public, extensions as $$
declare
  giorno date;
  quanto int;
  persona uuid;
  nuovo pagamenti_diretti;
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

  insert into pagamenti_diretti (persona_id, data, importo, metodo, voce, nota, creato_da)
  values (persona, giorno, quanto, btrim(dati->>'metodo'), btrim(dati->>'voce'), nullif(btrim(coalesce(dati->>'nota', '')), ''), persona_corrente())
  returning * into nuovo;
  return to_jsonb(nuovo);
end $$;

revoke all on function registra_pagamento_diretto(jsonb) from public, anon;
grant execute on function registra_pagamento_diretto(jsonb) to authenticated;
revoke all on function pagamento_diretto_non_nel_futuro() from public, anon, authenticated;
