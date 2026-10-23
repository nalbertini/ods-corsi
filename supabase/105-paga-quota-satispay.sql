-- ---------------------------------------------------------------------------
-- 105 · La quota associativa intera con Satispay, dall'area degli iscritti
--
-- Chi non ha la quota (mai pagata, o scaduta: un rinnovo) la paga con Satispay
-- dal telefono: da sé, o il titolare del nucleo per un familiare senza account
-- suo. Il resto di una quota pagata in parte resta il saldo (103). L'importo è
-- la quota del listino e lo calcola il database, mai il telefono.
--
--   satispay_prepara_quota(persona)  il pagamento da far fare: quello in
--                                    attesa (mai un secondo) o uno nuovo; la
--                                    chiama l'Edge Function `satispay` con la
--                                    sessione di chi paga, mai `service_role`
--   satispay_quota_stato(persona)    com'è andato l'ultimo, per chi paga
--   satispay_quota_chi(persona)      chi è quella persona per chi paga, e
--                                    quanto costa la quota se si può pagare
--
-- Una quota è un pagamento di `pagamenti_satispay` con `voce = 'quota'`. Come
-- l'iscrizione, finché la segreteria non fa la ricevuta (`emetti_ricevuta_satispay`,
-- 73) la persona risulta pagata con Satispay (`satispayPerPersona`). L'indice
-- unico dà al più una quota in attesa per persona.
--
-- Chi può cosa: come 103. Le funzioni le esegue chi ha un account
-- (`authenticated`) e ciascuna controlla da sé che la persona sia quella di chi
-- chiama o del suo nucleo (`iscritto_puo_vedere`, 101). Un minorenne con account
-- suo non paga: paga il titolare. L'iscritto non legge `pagamenti_satispay`.
--
-- Si lancia dopo `103-saldo-satispay.sql`; si può rilanciare. Finché non c'è,
-- la Edge Function risponde «non attivo» e l'app non mostra PAGA LA QUOTA.
-- ---------------------------------------------------------------------------

alter table pagamenti_satispay add column if not exists voce text check (voce in ('quota'));
drop index if exists pagamenti_satispay_quota;
create unique index pagamenti_satispay_quota on pagamenti_satispay (persona_id, voce)
  where voce is not null and stato = 'attesa';

-- Quanto costa la quota adesso, in centesimi, o il perché non si paga online (22023, scritto per chi paga).
create or replace function quota_importo(persona uuid) returns int
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  q numeric;
  s schede_iscritti;
begin
  select (listino->>'quota')::numeric into q from impostazioni limit 1;
  if q is null then raise exception 'La quota non è nel listino: chiedi alla segreteria' using errcode = '22023'; end if;
  -- Una ricevuta con la quota che vale oggi, pagata o in parte: per il resto c'è il saldo.
  if exists (
    select 1 from ricevute r, jsonb_array_elements(r.voci) x
      where r.persona_id = persona and r.annullata_il is null
        and upper(btrim(x->>'descrizione')) = 'QUOTA ASSOCIATIVA'
        and (x->>'dal')::date <= current_date and (x->>'al')::date >= current_date
  ) then
    raise exception 'La quota associativa ha già una ricevuta: per quel che manca c’è il saldo' using errcode = '22023';
  end if;
  -- L'eccezione «pagato fuori dall'app» (senza data vale fino a fine stagione).
  select * into s from schede_iscritti where persona_id = persona;
  if s.persona_id is not null and s.pagamento <> 'da_pagare' and coalesce(s.pagato_fino, '9999-01-01') >= current_date then
    raise exception 'La quota risulta già pagata fuori dall’app: chiedi alla segreteria' using errcode = '22023';
  end if;
  -- Già arrivato con Satispay (iscrizione, saldo o quota) e non ancora in una ricevuta: non si paga due volte.
  if exists (select 1 from pagamenti_satispay where persona_id = persona and stato = 'pagato' and ricevuta_id is null) then
    raise exception 'Hai già pagato con Satispay: la segreteria prepara la ricevuta' using errcode = '22023';
  end if;
  return round(q * 100)::int;
end $$;

-- Come `quota_importo`, ma `null` invece dell'errore: per sapere se offrire PAGA.
create or replace function quota_importo_o_null(persona uuid) returns int
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  return quota_importo(persona);
exception when sqlstate '22023' then
  return null;
end $$;

create or replace function satispay_prepara_quota(persona uuid) returns jsonb
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
  select * into p from pagamenti_satispay where persona_id = persona and voce = 'quota' and stato = 'attesa' for update;
  if p.id is not null then
    m := quota_importo_o_null(persona);
    if m is not distinct from p.importo then
      return jsonb_build_object('stato', 'attesa', 'id', p.id, 'importo', p.importo, 'satispay_id', p.satispay_id, 'link', p.link);
    end if;
    -- La quota è cambiata. Se Satispay ha già il pagamento non si ripropone; se non l'ha mai visto lo si chiude e se ne fa uno al nuovo importo
    -- (la segreteria non può toccare questa tabella: senza questo la persona resterebbe bloccata).
    if p.satispay_id is not null then
      raise exception 'L’importo è cambiato: chiedi alla segreteria prima di pagare' using errcode = '22023';
    end if;
    update pagamenti_satispay set stato = 'non-andato' where id = p.id;
  end if;
  m := quota_importo(persona);
  select btrim(cognome) || ' ' || btrim(nome) into n from persone where id = persona;
  begin
    insert into pagamenti_satispay (chi, importo, stato, persona_id, voce) values (n, m, 'attesa', persona, 'quota') returning * into p;
  exception when unique_violation then
    -- Due tocchi insieme: vale quello arrivato per primo.
    select * into p from pagamenti_satispay where persona_id = persona and voce = 'quota' and stato = 'attesa';
    return jsonb_build_object('stato', 'attesa', 'id', p.id, 'importo', p.importo, 'satispay_id', p.satispay_id, 'link', p.link);
  end;
  return jsonb_build_object('stato', 'attesa', 'id', p.id, 'importo', p.importo, 'satispay_id', null, 'link', null);
end $$;

create or replace function satispay_quota_stato(persona uuid) returns jsonb
  language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  p pagamenti_satispay;
  n text;
begin
  if persona is null or not iscritto_puo_vedere(persona) then return null; end if;
  -- Una quota già in ricevuta è storia: non è lo stato di adesso, e alla scadenza il rinnovo si deve poter pagare.
  select * into p from pagamenti_satispay where persona_id = persona and voce = 'quota' and ricevuta_id is null order by creato_il desc limit 1;
  if p.id is null then return null; end if;
  -- Un minorenne con account suo, da sé, vede solo il nome.
  select case when persona = persona_corrente() and not nucleo_maggiorenne(persona) then btrim(nome) else btrim(cognome) || ' ' || btrim(nome) end
    into n from persone where id = persona;
  return jsonb_build_object('stato', p.stato, 'importo', p.importo, 'pagato_il', p.pagato_il, 'chi', n, 'satispay_id', p.satispay_id);
end $$;

create or replace function satispay_quota_chi(persona uuid) returns jsonb
  language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  m int;
begin
  if persona is null or not iscritto_puo_vedere(persona) then return null; end if;
  m := quota_importo_o_null(persona);
  -- Un pagamento già da Satispay a un altro importo si rifiuta: non si offre PAGA.
  if exists (select 1 from pagamenti_satispay x where x.persona_id = persona and x.voce = 'quota' and x.stato = 'attesa'
               and x.satispay_id is not null and x.importo is distinct from m) then
    m := null;
  end if;
  return jsonb_build_object(
    'adulto', nucleo_maggiorenne(persona),
    'accesso_proprio', exists (select 1 from persone x where x.id = persona and x.utente_id is not null),
    'come_titolare', persona <> persona_corrente(),
    'importo', m);
end $$;

revoke all on function quota_importo(uuid), quota_importo_o_null(uuid), satispay_prepara_quota(uuid), satispay_quota_stato(uuid),
  satispay_quota_chi(uuid) from public, anon, authenticated;
grant execute on function satispay_prepara_quota(uuid), satispay_quota_stato(uuid), satispay_quota_chi(uuid) to authenticated;

notify pgrst, 'reload schema';
