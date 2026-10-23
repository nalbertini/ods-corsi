-- ---------------------------------------------------------------------------
-- 103 · Il saldo della quota con Satispay, dall'area degli iscritti
--
-- Chi ha pagato in parte la quota associativa (una ricevuta con la QUOTA
-- ASSOCIATIVA e «Manca») paga il resto con Satispay dal telefono: da sé, o il
-- titolare del nucleo per un familiare senza account suo (minorenne o adulto).
-- Niente rinnovi, quote intere o corsi. L'importo lo calcola il database dalla
-- ricevuta, adesso: il telefono manda solo la persona e la ricevuta.
--
--   satispay_prepara_saldo(persona, ricevuta)  il pagamento da far fare: quello
--                                              in attesa (mai un secondo) o uno
--                                              nuovo; la chiama l'Edge Function
--                                              `satispay` con la sessione di chi
--                                              paga, mai con `service_role`
--   satispay_saldo_stato(persona, ricevuta)    com'è andato, per chi paga
--   satispay_saldo_chi(persona)                chi è quella persona per chi paga:
--                                              adulta, con un accesso suo, del nucleo
--
-- Un saldo è un pagamento di `pagamenti_satispay` con `saldo_di` (la ricevuta
-- da cui viene): non è l'iscrizione, e `src/lib/satispay.ts` non lo conta come
-- tale. Arrivato, la segreteria fa la ricevuta del saldo con
-- `emetti_ricevuta_satispay` (73) e da lì conta solo la ricevuta. L'indice
-- unico dà al più un saldo vivo per persona e ricevuta: un secondo tocco, o un
-- secondo telefono, ritrova lo stesso.
--
-- Chi può cosa: le due funzioni le esegue chi ha un account (`authenticated`),
-- e ciascuna controlla da sé che la persona sia quella di chi chiama o del suo
-- nucleo (`iscritto_puo_vedere`, 101). Un minorenne con account suo non paga:
-- paga il titolare. L'iscritto non legge `pagamenti_satispay`.
--
-- Si lancia dopo `101-iscritto.sql` e `73-satispay.sql`; non chiede di
-- rilanciare `06-iscrizioni.sql`. Finché non c'è, la Edge Function risponde
-- «non attivo» e l'app non mostra PAGA.
-- ---------------------------------------------------------------------------

alter table pagamenti_satispay add column if not exists saldo_di uuid references ricevute on delete set null;
-- Uno solo in attesa: uno già pagato non blocca il resto (`saldo_mancano` lo toglie dal conto).
drop index if exists pagamenti_satispay_saldo;
create unique index pagamenti_satispay_saldo on pagamenti_satispay (persona_id, saldo_di)
  where saldo_di is not null and stato = 'attesa';

-- Quanto manca alla quota di quella ricevuta, oggi, tolto quel che è già arrivato con Satispay e non è ancora in una
-- ricevuta. Stessa regola di `quoteDi` (src/lib/ricevute.ts).
create or replace function saldo_mancano(persona uuid, ric uuid) returns int
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r ricevute;
  v jsonb;
  m int;
begin
  select * into r from ricevute where id = ric and persona_id = persona and annullata_il is null;
  if r.id is null then raise exception 'Questa ricevuta non si può pagare: chiedi alla segreteria' using errcode = '22023'; end if;
  select x into v from jsonb_array_elements(r.voci) x
    where upper(btrim(x->>'descrizione')) = 'QUOTA ASSOCIATIVA'
      and (x->>'dal')::date <= current_date and (x->>'al')::date >= current_date
    limit 1;
  if v is null then raise exception 'Qui non c’è una quota da pagare: chiedi alla segreteria' using errcode = '22023'; end if;
  m := least(
         greatest(0, (v->>'quantita')::int * (v->>'prezzo')::int - coalesce((select sum((p->>'importo')::int) from jsonb_array_elements(v->'pagamenti') p), 0)),
         greatest(0, r.totale - r.pagato - r.anticipo))
       - coalesce((select sum(importo) from pagamenti_satispay where persona_id = persona and saldo_di = ric and stato = 'pagato' and ricevuta_id is null), 0);
  if m <= 0 then raise exception 'Non resta niente da pagare su questa quota' using errcode = '22023'; end if;
  return m;
end $$;

create or replace function satispay_prepara_saldo(persona uuid, ricevuta uuid) returns jsonb
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  m int;
  p pagamenti_satispay;
  n text;
begin
  if persona is null or not iscritto_puo_vedere(persona) then
    raise exception 'Questa persona non è fra le tue' using errcode = '42501';
  end if;
  if persona = persona_corrente() and not nucleo_maggiorenne(persona) then
    raise exception 'Per un minorenne paga il titolare del nucleo' using errcode = '42501';
  end if;
  -- Il titolare paga per chi non ha un accesso suo; chi ce l'ha paga da sé.
  if persona <> persona_corrente() and exists (select 1 from persone x where x.id = persona and x.utente_id is not null) then
    raise exception 'Questa persona paga dal suo telefono' using errcode = '42501';
  end if;
  m := saldo_mancano(persona, ricevuta);
  select * into p from pagamenti_satispay where persona_id = persona and saldo_di = ricevuta and stato = 'attesa' for update;
  if p.id is not null then
    -- L'importo è cambiato (un'altra ricevuta del saldo, una correzione): quel pagamento non vale più.
    if p.importo <> m then
      raise exception 'L’importo è cambiato: chiedi alla segreteria prima di pagare' using errcode = '22023';
    end if;
    return jsonb_build_object('stato', 'attesa', 'id', p.id, 'importo', p.importo, 'satispay_id', p.satispay_id, 'link', p.link);
  end if;
  select btrim(cognome) || ' ' || btrim(nome) into n from persone where id = persona;
  begin
    insert into pagamenti_satispay (chi, importo, stato, persona_id, saldo_di) values (n, m, 'attesa', persona, ricevuta) returning * into p;
  exception when unique_violation then
    -- Due tocchi insieme: vince il primo, il secondo ritrova lo stesso.
    select * into p from pagamenti_satispay where persona_id = persona and saldo_di = ricevuta and stato = 'attesa';
    return jsonb_build_object('stato', 'attesa', 'id', p.id, 'importo', p.importo, 'satispay_id', p.satispay_id, 'link', p.link);
  end;
  return jsonb_build_object('stato', 'attesa', 'id', p.id, 'importo', p.importo, 'satispay_id', null, 'link', null);
end $$;

create or replace function satispay_saldo_stato(persona uuid, ricevuta uuid) returns jsonb
  language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  p pagamenti_satispay;
  n text;
begin
  if persona is null or not iscritto_puo_vedere(persona) then return null; end if;
  select * into p from pagamenti_satispay where persona_id = persona and saldo_di = ricevuta order by creato_il desc limit 1;
  if p.id is null then return null; end if;
  -- Un minorenne con account suo, da sé, vede solo il nome.
  select case when persona = persona_corrente() and not nucleo_maggiorenne(persona) then btrim(nome) else btrim(cognome) || ' ' || btrim(nome) end
    into n from persone where id = persona;
  -- `satispay_id`: la Edge Function rilegge da Satispay quello in attesa, senza passare dalla funzione che scrive.
  return jsonb_build_object('stato', p.stato, 'importo', p.importo, 'pagato_il', p.pagato_il, 'chi', n, 'satispay_id', p.satispay_id);
end $$;

-- Per sapere se mostrare PAGA: la stessa regola di `satispay_prepara_saldo`, senza dire altro di una persona che non è sua.
create or replace function satispay_saldo_chi(persona uuid) returns jsonb
  language sql stable security definer set search_path = public, pg_temp as $$
  select case when persona is null or not iscritto_puo_vedere(persona) then null
    else jsonb_build_object(
      'adulto', nucleo_maggiorenne(persona),
      'accesso_proprio', exists (select 1 from persone x where x.id = persona and x.utente_id is not null),
      'come_titolare', persona <> persona_corrente()) end
$$;

revoke all on function saldo_mancano(uuid, uuid), satispay_prepara_saldo(uuid, uuid), satispay_saldo_stato(uuid, uuid), satispay_saldo_chi(uuid) from public, anon, authenticated;
grant execute on function satispay_prepara_saldo(uuid, uuid), satispay_saldo_stato(uuid, uuid), satispay_saldo_chi(uuid) to authenticated;

notify pgrst, 'reload schema';
