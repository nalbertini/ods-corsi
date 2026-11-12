-- ---------------------------------------------------------------------------
-- 149 · Unire due schede non si ferma sulle righe che sono una per persona
--
-- `unisci_persone` (99, 102) sposta a chi resta tutto quel che punta alla
-- scheda che se ne va. Dove una riga può essere una sola per persona, ci
-- pensa un trigger `*_unione` che tiene una riga sola, come per le tessere
-- (61) e le gare (117). Ne mancavano due, e l'unione si fermava con l'errore
-- grezzo del database:
--
--   · `presenze_segnalate` (101), una per lezione e per persona: resta quella
--     di chi resta, ma se l'altra la segreteria l'ha già gestita (accolta o
--     rifiutata) e questa no, prende il suo stato;
--   · `pagamenti_satispay` in attesa (103, 105, 106), uno per quota, corso o
--     saldo: quello che Satispay o PayPal non hanno mai visto (nessun
--     `satispay_id` né `paypal_id` dopo un quarto d'ora: l'id arriva qualche
--     secondo dopo la riga) si chiude «non andato», come fanno già 105 e 106
--     quando cambia l'importo. Se no, uno può ancora arrivare pagato:
--     l'unione si ferma e dice di aspettare.
--
-- E `anteprima_unione` (29) conta anche tessere, gare, movimenti della
-- contabilità e pagamenti online (non quelli non andati).
--
-- Chi può cosa: come prima. Le funzioni dei trigger non le chiama nessuno.
-- Si lancia dopo `102-certificato-iscritto.sql`, `106-paga-corso-satispay.sql`,
-- `115-carta.sql` e `117-gare.sql`; non chiede di rilanciare
-- `06-iscrizioni.sql`. Rilanciando `29`, che rifà `anteprima_unione`, va
-- rilanciato anche questo. Finché non c'è, l'unione di due schede con una di
-- quelle righe su tutte e due si ferma con l'errore del database, e
-- l'anteprima non conta le cose nuove. Si può rilanciare.
-- ---------------------------------------------------------------------------

create or replace function presenze_segnalate_unione() returns trigger
  language plpgsql set search_path = public as $$
begin
  if exists (select 1 from presenze_segnalate s where s.sessione_id = new.sessione_id and s.persona_id = new.persona_id and s.id <> new.id) then
    update presenze_segnalate s set stato = old.stato, gestita_il = old.gestita_il, gestita_da = old.gestita_da
     where s.sessione_id = new.sessione_id and s.persona_id = new.persona_id and s.id <> new.id
       and s.stato = 'da_vedere' and old.stato <> 'da_vedere';
    delete from presenze_segnalate where id = old.id;
    return null;
  end if;
  return new;
end $$;
drop trigger if exists presenze_segnalate_unione on presenze_segnalate;
create trigger presenze_segnalate_unione before update of persona_id on presenze_segnalate
  for each row execute function presenze_segnalate_unione();

-- Le stesse chiavi degli indici unici in attesa: `pagamenti_satispay_quota`,
-- `_corso` (106) e `_saldo` (103).
create or replace function pagamenti_satispay_unione() returns trigger
  language plpgsql set search_path = public as $$
declare
  altro pagamenti_satispay;
  -- Prima, la riga c'è ma Satispay o PayPal stanno ancora dando l'id (`satispay_creato`, `carta_creato`).
  vecchio constant timestamptz := now() - interval '15 minutes';
begin
  if new.stato <> 'attesa' or new.persona_id is null then return new; end if;
  -- Bloccata: chi la sta per segnare pagata o creata aspetta la fine dell'unione.
  select * into altro from pagamenti_satispay p
   where p.persona_id = new.persona_id and p.stato = 'attesa' and p.id <> new.id
     and ((new.voce = 'quota' and p.voce = 'quota') or p.corso_id = new.corso_id or p.saldo_di = new.saldo_di)
   limit 1 for update;
  if altro.id is null then return new; end if;
  if new.satispay_id is null and new.paypal_id is null and new.creato_il < vecchio then
    new.stato := 'non-andato';
  elsif altro.satispay_id is null and altro.paypal_id is null and altro.creato_il < vecchio then
    update pagamenti_satispay set stato = 'non-andato' where id = altro.id;
  else
    raise exception 'Tutte e due le schede hanno un pagamento online in corso per la stessa cosa: aspetta che arrivi pagato o che scada, poi riprova'
      using errcode = '22023';
  end if;
  return new;
end $$;
drop trigger if exists pagamenti_satispay_unione on pagamenti_satispay;
create trigger pagamenti_satispay_unione before update of persona_id on pagamenti_satispay
  for each row execute function pagamenti_satispay_unione();

revoke all on function presenze_segnalate_unione(), pagamenti_satispay_unione() from public, anon, authenticated;

/** Quante righe della scheda che se ne va passano a quella che resta. */
create or replace function anteprima_unione(resta uuid, via uuid) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform unione_possibile(resta, via);
  return json_build_object(
    'presenze', (select count(*) from presenze where persona_id = via),
    'prove', (select count(*) from prove where persona_id = via),
    'iscrizioni', (select count(*) from iscrizioni where persona_id = via),
    'ricevute', (select count(*) from ricevute where persona_id = via),
    'tessere', (select count(*) from tessere where persona_id = via),
    'gare', (select count(*) from gare_atleti where persona_id = via),
    'movimenti', (select count(*) from movimenti where persona_id = via),
    'pagamentiOnline', (select count(*) from pagamenti_satispay where persona_id = via and stato <> 'non-andato'));
end $$;
revoke all on function anteprima_unione(uuid, uuid) from public, anon;
grant execute on function anteprima_unione(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
