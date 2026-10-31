-- ---------------------------------------------------------------------------
-- ODS Corsi · le regole della quadratura con la banca, nel database
--
-- `123-quadratura-banca.sql` tiene i conti dell'estratto e toglie la verifica
-- quando cambiano i numeri di quel mese. Il resto lo controllava solo l'app,
-- e la chiave anon è pubblica. Qui il database:
--   * rifiuta il saldo di un mese che non è ancora cominciato;
--   * segna verificato un mese solo se è finito, parte dal saldo finale del
--     mese prima (se c'è), il Conto Corrente dell'app ci arriva allo stesso
--     saldo finale e non ha movimenti su «Da classificare»;
--   * quando cambia il saldo finale di un mese, toglie la verifica al mese
--     dopo se non parte più da lì.
-- Le stesse regole stanno in src/lib/quadraturaBanca.ts e nella modalità prova.
-- Gli errori sono P0001, scritti per chi amministra: l'app li mostra così come sono.
--
-- Si lancia dopo `123-quadratura-banca.sql` e `119-*.sql`. Si può rilanciare.
-- Non chiede di rilanciare `06-iscrizioni.sql`.
-- ---------------------------------------------------------------------------

create or replace function saldo_banca_regole() returns trigger
  language plpgsql set search_path = public, extensions as $$
declare
  questo_mese text := to_char(now() at time zone 'Europe/Rome', 'YYYY-MM');
  fine date := ((new.mese || '-01')::date + interval '1 month')::date;
  prima saldo_banca;
  conto casse;
  saldo_app bigint;
begin
  if new.mese > questo_mese then
    raise exception 'Il mese % non è ancora cominciato: il saldo si scrive dall''estratto, a mese finito.', new.mese;
  end if;
  -- Spostato, un mese verificato resterebbe tale senza i controlli e il mese dopo non lo saprebbe.
  if tg_op = 'UPDATE' and new.mese <> old.mese then
    raise exception 'Il mese di un saldo non si cambia: toglilo e scrivi quello giusto.';
  end if;
  -- Solo una verifica nuova: un mese verificato che resta com'è non si ricontrolla.
  if new.verificato_il is null
     or (tg_op = 'UPDATE' and (new.verificato_il, new.impronta_verifica)
                              is not distinct from (old.verificato_il, old.impronta_verifica)) then
    return new;
  end if;
  if new.mese >= questo_mese then
    raise exception 'Il mese % non è ancora finito: si verifica dal mese dopo.', new.mese;
  end if;
  select * into prima from saldo_banca
   where mese = to_char((new.mese || '-01')::date - interval '1 month', 'YYYY-MM');
  if found and prima.saldo_finale <> new.saldo_iniziale then
    raise exception 'Il saldo iniziale di % non è il saldo finale del mese prima: correggi uno dei due.', new.mese;
  end if;
  select * into conto from casse where nome = 'Conto Corrente';
  if not found then
    raise exception 'Manca la cassa «Conto Corrente»: senza, il mese non si può verificare.';
  end if;
  -- Il saldo del Conto Corrente a fine mese, contato come in Casse.
  select conto.saldo_iniziale + coalesce(sum(case
           when m.tipo = 'entrata' then m.importo
           when m.tipo = 'uscita' then -m.importo
           when m.cassa_a_id = conto.id then m.importo
           else -m.importo end), 0)
    into saldo_app
    from movimenti m
   where m.annullato_il is null
     and (m.cassa_id = conto.id or m.cassa_a_id = conto.id)
     and (conto.dal is null or m.data >= conto.dal)
     and m.data < fine;
  if saldo_app <> new.saldo_finale then
    raise exception 'Il Conto Corrente dell''app a fine % non torna con l''estratto: guarda le righe che mancano.', new.mese;
  end if;
  if exists (
    select 1 from movimenti m join voci_contabili v on v.id = m.voce_id
     where m.annullato_il is null
       and m.cassa_id = conto.id
       and m.data >= (new.mese || '-01')::date and m.data < fine
       and lower(trim(v.nome)) = 'da classificare') then
    raise exception 'A % ci sono movimenti su «Da classificare»: dagli una voce, poi verifica.', new.mese;
  end if;
  return new;
end $$;
-- Dopo `saldo_banca_chi_verifica` (i trigger BEFORE girano per nome): numeri cambiati senza verifica nuova li ha già tolti.
drop trigger if exists saldo_banca_regole on saldo_banca;
create trigger saldo_banca_regole before insert or update on saldo_banca
  for each row execute function saldo_banca_regole();
revoke all on function saldo_banca_regole() from public, anon, authenticated;

-- Il mese dopo parte dal saldo finale di questo: se non più, torna da verificare.
create or replace function saldo_banca_mese_dopo() returns trigger
  language plpgsql set search_path = public, extensions as $$
begin
  if tg_op = 'INSERT' or new.saldo_finale is distinct from old.saldo_finale then
    update saldo_banca
       set verificato_il = null, impronta_verifica = null
     where mese = to_char((new.mese || '-01')::date + interval '1 month', 'YYYY-MM')
       and verificato_il is not null
       and saldo_iniziale <> new.saldo_finale;
  end if;
  return null;
end $$;
drop trigger if exists saldo_banca_mese_dopo on saldo_banca;
create trigger saldo_banca_mese_dopo after insert or update on saldo_banca
  for each row execute function saldo_banca_mese_dopo();
revoke all on function saldo_banca_mese_dopo() from public, anon, authenticated;

notify pgrst, 'reload schema';
