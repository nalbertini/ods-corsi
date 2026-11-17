-- ---------------------------------------------------------------------------
-- 165 · La quadratura con la banca conta il Conto Corrente come CONTABILITÀ
--
-- Il trigger `saldo_banca_regole` del 131 segna verificato un mese solo se il Conto Corrente
-- dell'app arriva al saldo finale dell'estratto, ma contava solo `movimenti`. L'app
-- (`saldoAppDelMese`, con `incassiDerivati`) conta anche i bonifici, i POS e gli assegni
-- registrati in una ricevuta o in un pagamento a mano: sono sull'estratto, ma non in `movimenti`.
-- Con un POS in ricevuta l'app diceva «torna» e il database rifiutava la verifica.
-- Qui il trigger li conta come l'app: metodo che non è contanti, carta o Satispay, non annullati,
-- e senza `movimento_id` (un bonifico assegnato è già il suo movimento, conta una volta).
--
-- Chi può: come nel 131, il trigger gira con i permessi di chi scrive il saldo (amministrazione,
-- che legge ricevute e pagamenti a mano dal 55). Si lancia dopo `131-quadratura-nel-database.sql`
-- e `135-assegna-movimento.sql` (`movimento_id`). Si può rilanciare. Non chiede di rilanciare
-- `06-iscrizioni.sql`. Rilanciare il 131 riporta il conto dei soli movimenti: dopo si rilancia
-- questo. Finché non c'è, un mese con incassi in ricevuta sul Conto Corrente non si verifica.
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
  -- Il saldo del Conto Corrente a fine mese, contato come in CONTABILITÀ (`saldoAppDelMese` in src/lib/quadraturaBanca.ts).
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
  -- Più gli incassi di ricevute e pagamenti a mano che vanno sul Conto Corrente, come `incassiDerivati` in
  -- src/lib/contabilita.ts: non contanti, carta o Satispay, non annullati, e non già in un movimento
  -- (un bonifico assegnato è il movimento: conta una volta). L'anticipo di una ricevuta non è un incasso.
  saldo_app := saldo_app + coalesce((
    select sum(i.importo) from (
      select (p->>'data')::date as data, (p->>'importo')::bigint as importo, p->>'metodo' as metodo
        from ricevute r, jsonb_array_elements(r.voci) v, jsonb_array_elements(coalesce(v->'pagamenti', '[]')) p
       where r.annullata_il is null and r.movimento_id is null
      union all
      select d.data, d.importo, d.metodo from pagamenti_diretti d
       where d.annullato_il is null and d.movimento_id is null
    ) i
    where lower(btrim(i.metodo)) not in ('contanti', 'carta', 'satispay')
      and (conto.dal is null or i.data >= conto.dal)
      and i.data < fine), 0);
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

notify pgrst, 'reload schema';
