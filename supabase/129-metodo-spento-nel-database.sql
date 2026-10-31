-- ---------------------------------------------------------------------------
-- 129 · Un metodo di pagamento online spento lo ferma anche il database
--
-- Con `126-metodi-pagamento.sql` Satispay e la carta spenti li rifiutava solo
-- la Edge Function: un iscritto con la sessione poteva chiamare da solo
-- `satispay_prepara_saldo`, `satispay_prepara_quota` e `satispay_prepara_corso`
-- e aprire un pagamento in attesa.
--
-- Cosa cambia: un trigger su `pagamenti_satispay` rifiuta ogni pagamento
-- nuovo in attesa il cui circuito (`satispay` o `carta`) è in
-- `metodi_spenti()`. Tutte le funzioni `*_prepara*` (73, 83, 103, 105, 106,
-- 115, 125) scrivono il pagamento con quell'insert, quindi le copre tutte, e
-- anche una funzione nuova che se ne dimenticasse.
--
-- Chi può fare cosa: niente di nuovo; la funzione del trigger non si chiama
-- da fuori. Un pagamento già in attesa prima di spegnere resta com'è, e
-- quando arriva si scrive lo stesso: il trigger guarda solo gli insert.
--
-- Si lancia dopo `126-metodi-pagamento.sql`. Non chiede di rilanciare
-- `06-iscrizioni.sql`. Finché non c'è, il rifiuto lo fa solo la Edge
-- Function, come prima. Rilanciabile.
-- ---------------------------------------------------------------------------

create or replace function pagamento_metodo_acceso() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.circuito = any (metodi_spenti()) then
    -- Più generico di SATISPAY_SPENTO e CARTA_SPENTA (src/lib/satispay.ts), di proposito: vale anche per la quota dall'area iscritti.
    if new.circuito = 'carta' then
      raise exception 'La carta per ora non è attiva: paga in palestra o col bonifico' using errcode = '22023';
    end if;
    raise exception 'Satispay per ora non è attivo: paga in palestra o col bonifico' using errcode = '22023';
  end if;
  return new;
end $$;

revoke all on function pagamento_metodo_acceso() from public, anon, authenticated;

-- Solo i pagamenti che nascono in attesa: quelli che si aprono per pagare.
create or replace trigger pagamenti_satispay_metodo_acceso
  before insert on pagamenti_satispay
  for each row when (new.stato = 'attesa')
  execute function pagamento_metodo_acceso();

notify pgrst, 'reload schema';
