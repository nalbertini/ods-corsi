-- Gli avvisi alla segreteria non scambiano una quota o un corso pagati dal telefono per un «pagamento senza richiesta».
-- Chi paga dall'area iscritti (`satispay_prepara_quota/corso`, 105/106) non ha una richiesta di iscrizione e non
-- la deve avere: il pagamento ha la sua `persona_id` e la sua ricevuta. L'avviso `pagamento_senza_richiesta`
-- di `84` partiva lo stesso, un'ora dopo, per ogni quota pagata: «soldi da restituire o persona da chiamare» a
-- una segreteria che non ha niente da fare. Ora il ramo guarda solo i pagamenti senza persona, cioè quelli
-- fatti in fondo al modulo. Il resto di `avvisi_da_mandare()` è com'era in `84`.
-- Si lancia dopo `121-punteggio-movimenti.sql`; rilanciando `84` va rilanciato anche questo.

create or replace function avvisi_da_mandare() returns table (id uuid, a text, cc text, avviso jsonb)
  language plpgsql security definer set search_path = public, extensions as $$
declare
  ind avvisi_indirizzi;
  c record;
  contati int;
  oggi date := (now() at time zone 'Europe/Rome')::date;
begin
  select * into ind from avvisi_indirizzi limit 1;
  if ind.a is null then return; end if;
  -- Due chiamate insieme non contano il tetto ognuna per sé.
  perform pg_advisory_xact_lock(hashtext('avvisi_da_mandare'));
  for c in
    -- Solo quelle che nessun avviso ha ancora: chi della famiglia arriva dopo (un «riprova») ne ha uno suo.
    select 'richiesta' as tipo, 'richiesta:' || (array_agg(x.id order by x.creata_il, x.id))[1] as chiave,
           array_agg(x.id order by x.creata_il, x.id) as richieste, null::uuid as pagamento
      from richieste_iscrizione x
     where x.creata_il >= ind.dal and x.stato <> 'rifiutata'
       and not exists (select 1 from avvisi_segreteria v where v.tipo = 'richiesta' and x.id = any(v.richieste))
     group by coalesce(x.invio, x.id)
    having max(x.creata_il) <= now() - interval '5 minutes'
    union all
    -- Pagato dopo l'avviso della sua richiesta: quello prima di pagare diceva «da pagare».
    select 'pagamento', 'pagamento:' || s.id, array[s.richiesta_id], s.id
      from pagamenti_satispay s
     where s.stato = 'pagato' and s.richiesta_id is not null and s.pagato_il >= ind.dal
       and exists (select 1 from avvisi_segreteria v where v.tipo = 'richiesta' and s.richiesta_id = any(v.richieste) and v.creato_il < s.pagato_il)
    union all
    -- Pagato in fondo al modulo e la richiesta non è arrivata: soldi da restituire o persona da chiamare.
    select 'pagamento_senza_richiesta', 'senza-richiesta:' || s.id, '{}'::uuid[], s.id
      from pagamenti_satispay s
     where s.stato = 'pagato' and s.richiesta_id is null and s.preso_il is null
       and s.persona_id is null
       and s.pagato_il >= ind.dal and s.pagato_il <= now() - interval '1 hour'
  loop
    continue when exists (select 1 from avvisi_segreteria v where v.chiave = c.chiave);
    -- Il tetto: mandati oggi più quelli di oggi in coda.
    select count(*) into contati from avvisi_segreteria v
     where v.non_mandato is null and (coalesce(v.mandato_il, v.creato_il) at time zone 'Europe/Rome')::date = oggi;
    insert into avvisi_segreteria (tipo, chiave, richieste, pagamento_id, non_mandato)
      values (c.tipo, c.chiave, c.richieste, c.pagamento, case when contati >= 50 then 'tetto' end);
  end loop;
  -- Niente più da dire (le richieste eliminate prima di partire): si chiude, e non pesa sul tetto.
  update avvisi_segreteria v set non_mandato = 'vuoto' where v.mandato_il is null and v.non_mandato is null and avviso_da_registro(v) is null;
  return query
    select v.id, ind.a, ind.cc, x.avviso
      from avvisi_segreteria v, lateral (select avviso_da_registro(v) as avviso) x
     where v.mandato_il is null and v.non_mandato is null and x.avviso is not null
     order by v.creato_il, v.id;
end $$;

revoke all on function avvisi_da_mandare() from public, anon, authenticated;
grant execute on function avvisi_da_mandare() to service_role;

notify pgrst, 'reload schema';
