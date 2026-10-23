-- ---------------------------------------------------------------------------
-- 106 · Un corso semplice con Satispay, dall'area degli iscritti
--
-- Chi è iscritto a un corso con una sola riga di prezzo nel listino lo paga con
-- Satispay dal telefono, annuale o trimestre: da sé, o il titolare del nucleo
-- per un familiare senza account suo. L'importo è il prezzo del solo corso (la
-- quota è un'altra cosa, 105) e lo calcola il database, mai il telefono. Un
-- corso con più righe di prezzo, o fuori dal listino, lo prepara la segreteria.
--
--   satispay_prepara_corso(persona, corso, formula)  il pagamento da far fare:
--                                    quello in attesa (mai un secondo) o uno
--                                    nuovo; la chiama l'Edge Function
--                                    `satispay` con la sessione di chi paga
--   satispay_corso_stato(persona, corso)  com'è andato l'ultimo, per chi paga
--   satispay_corsi_chi(persona)      chi è quella persona per chi paga, e
--                                    quanto costa ogni suo corso se si può pagare
--
-- Un corso è un pagamento di `pagamenti_satispay` con `voce = 'corso'`, `corso_id`
-- e `formula`. Come l'iscrizione, finché la segreteria non fa la ricevuta
-- (`emetti_ricevuta_satispay`, 73) la persona risulta pagata con Satispay per
-- quel corso. L'indice unico dà al più un corso in attesa per persona e corso;
-- quello della quota (105) resta suo: i due non si bloccano a vicenda.
--
-- Chi può cosa: come 105. Le funzioni le esegue chi ha un account
-- (`authenticated`) e ciascuna controlla da sé che la persona sia quella di chi
-- chiama o del suo nucleo (`iscritto_puo_vedere`, 101). L'iscritto non legge
-- `pagamenti_satispay`.
--
-- Si lancia dopo `105-paga-quota-satispay.sql`; si può rilanciare. Finché non
-- c'è, la Edge Function risponde «non attivo» e l'app non mostra PAGA.
-- ---------------------------------------------------------------------------

alter table pagamenti_satispay drop constraint if exists pagamenti_satispay_voce_check;
alter table pagamenti_satispay add constraint pagamenti_satispay_voce_check check (voce in ('quota', 'corso'));
-- La quota (105) ha il suo indice sulla sola voce 'quota'; il corso ne ha uno per corso.
drop index if exists pagamenti_satispay_quota;
create unique index pagamenti_satispay_quota on pagamenti_satispay (persona_id, voce)
  where voce = 'quota' and stato = 'attesa';
drop index if exists pagamenti_satispay_corso;
-- `corso_id` c'è solo nei pagamenti di un corso: così l'indice non nomina `voce`, e la prova della quota (che conta gli unici su `voce`) resta quella di prima.
create unique index pagamenti_satispay_corso on pagamenti_satispay (persona_id, corso_id)
  where corso_id is not null and stato = 'attesa';

-- Il pagamento di un corso non è «la quota già pagata»: chi ha pagato un corso con Satispay paga ancora la quota.
create or replace function quota_importo(persona uuid) returns int
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  q numeric;
  s schede_iscritti;
begin
  select (listino->>'quota')::numeric into q from impostazioni limit 1;
  if q is null then raise exception 'La quota non è nel listino: chiedi alla segreteria' using errcode = '22023'; end if;
  if exists (
    select 1 from ricevute r, jsonb_array_elements(r.voci) x
      where r.persona_id = persona and r.annullata_il is null
        and upper(btrim(x->>'descrizione')) = 'QUOTA ASSOCIATIVA'
        and coalesce((x->>'dal')::date, current_date) <= current_date and coalesce((x->>'al')::date, current_date) >= current_date
  ) then
    raise exception 'La quota associativa ha già una ricevuta: per quel che manca c’è il saldo' using errcode = '22023';
  end if;
  select * into s from schede_iscritti where persona_id = persona;
  if s.persona_id is not null and s.pagamento <> 'da_pagare' and coalesce(s.pagato_fino, '9999-01-01') >= current_date then
    raise exception 'La quota risulta già pagata fuori dall’app: chiedi alla segreteria' using errcode = '22023';
  end if;
  if exists (select 1 from pagamenti_satispay where persona_id = persona and stato = 'pagato' and ricevuta_id is null
               and voce is distinct from 'corso') then
    raise exception 'Hai già pagato con Satispay: la segreteria prepara la ricevuta' using errcode = '22023';
  end if;
  return round(q * 100)::int;
end $$;

-- Quanto costa il corso adesso, in centesimi, o il perché non si paga online (22023, scritto per chi paga).
create or replace function corso_importo(persona uuid, corso uuid, formula text) returns int
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  l jsonb;
  v jsonb;
  p int;
  nome text;
  s schede_iscritti;
begin
  if not exists (select 1 from iscrizioni i where i.persona_id = persona and i.corso_id = corso
                   and i.dal <= current_date and (i.al is null or i.al >= current_date)) then
    raise exception 'Questa persona non è iscritta a questo corso' using errcode = '22023';
  end if;
  if formula is null or formula not in ('annuale', 'trimestre') then
    raise exception 'Scegli se pagare l’annuale o il trimestre' using errcode = '22023';
  end if;
  select listino into l from impostazioni limit 1;
  select x into v from jsonb_array_elements(coalesce(l->'corsi', '[]'::jsonb)) x where x->>'corsoId' = corso::text limit 1;
  if jsonb_array_length(coalesce(v->'prezzi', '[]'::jsonb)) > 1 then
    raise exception 'Per questo corso il prezzo lo fa la segreteria: chiedi lì o paga in palestra' using errcode = '22023';
  end if;
  p := case when v is null then null else prezzo_dal_listino(v, formula, current_date, (l->>'saldoEntro')::date) end;
  if p is null or p <= 0 then raise exception 'Il corso non è nel listino: chiedi alla segreteria' using errcode = '22023'; end if;
  -- Una ricevuta del corso che vale oggi, pagata o in parte: per il resto lo fa la segreteria.
  select c.nome into nome from corsi c where c.id = corso;
  if exists (
    select 1 from ricevute r, jsonb_array_elements(r.voci) x
      where r.persona_id = persona and r.annullata_il is null
        and lower(btrim(x->>'descrizione')) in (
          'annuale ' || lower(btrim(nome)), 'trimestre ' || lower(btrim(nome)), 'saldo ' || lower(btrim(nome)),
          'annuale ' || lower(btrim(v->>'corso')), 'trimestre ' || lower(btrim(v->>'corso')), 'saldo ' || lower(btrim(v->>'corso')))
        and coalesce((x->>'dal')::date, current_date) <= current_date and coalesce((x->>'al')::date, current_date) >= current_date
  ) then
    raise exception 'Il corso ha già una ricevuta: per quel che manca chiedi alla segreteria' using errcode = '22023';
  end if;
  -- L'eccezione «pagato fuori dall'app» (senza data vale fino a fine stagione).
  select * into s from schede_iscritti where persona_id = persona;
  if s.persona_id is not null and s.pagamento <> 'da_pagare' and coalesce(s.pagato_fino, '9999-01-01') >= current_date then
    raise exception 'Il corso risulta già pagato fuori dall’app: chiedi alla segreteria' using errcode = '22023';
  end if;
  -- Già arrivato con Satispay (questo corso, o l'iscrizione intera) e non ancora in una ricevuta: non si paga due volte.
  -- Una quota o un saldo pagati non coprono il corso.
  if exists (select 1 from pagamenti_satispay x where x.persona_id = persona and x.stato = 'pagato' and x.ricevuta_id is null
               and ((x.voce = 'corso' and x.corso_id = corso) or (x.voce is null and x.saldo_di is null))) then
    raise exception 'Hai già pagato con Satispay: la segreteria prepara la ricevuta' using errcode = '22023';
  end if;
  return p;
end $$;

-- Come `corso_importo`, ma `null` invece dell'errore: per sapere se offrire PAGA.
create or replace function corso_importo_o_null(persona uuid, corso uuid, formula text) returns int
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  return corso_importo(persona, corso, formula);
exception when sqlstate '22023' then
  return null;
end $$;

create or replace function satispay_prepara_corso(persona uuid, corso uuid, formula text) returns jsonb
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
  select * into p from pagamenti_satispay x where x.persona_id = persona and x.voce = 'corso' and x.corso_id = corso and x.stato = 'attesa' for update;
  if p.id is not null then
    m := corso_importo_o_null(persona, corso, formula);
    if p.formula is not distinct from formula and m is not distinct from p.importo then
      return jsonb_build_object('stato', 'attesa', 'id', p.id, 'importo', p.importo, 'satispay_id', p.satispay_id, 'link', p.link);
    end if;
    -- Se Satispay ha già il pagamento non si cambia: un'altra formula, o un prezzo cambiato, li vede la segreteria.
    if p.satispay_id is not null then
      if p.formula is distinct from formula then
        raise exception 'C’è già un pagamento in attesa per questo corso: finiscilo o chiedi alla segreteria' using errcode = '22023';
      end if;
      raise exception 'L’importo è cambiato: chiedi alla segreteria prima di pagare' using errcode = '22023';
    end if;
    -- Se non l'ha mai visto lo si chiude e se ne fa uno nuovo (la segreteria non può toccare questa tabella:
    -- senza questo la persona resterebbe bloccata).
    update pagamenti_satispay set stato = 'non-andato' where id = p.id;
  end if;
  m := corso_importo(persona, corso, formula);
  select btrim(cognome) || ' ' || btrim(nome) into n from persone where id = persona;
  begin
    insert into pagamenti_satispay (chi, importo, stato, persona_id, voce, corso_id, formula) values (n, m, 'attesa', persona, 'corso', corso, formula) returning * into p;
  exception when unique_violation then
    -- Due tocchi insieme: vale quello arrivato per primo.
    select * into p from pagamenti_satispay x where x.persona_id = persona and x.voce = 'corso' and x.corso_id = corso and x.stato = 'attesa';
    return jsonb_build_object('stato', 'attesa', 'id', p.id, 'importo', p.importo, 'satispay_id', p.satispay_id, 'link', p.link);
  end;
  return jsonb_build_object('stato', 'attesa', 'id', p.id, 'importo', p.importo, 'satispay_id', null, 'link', null);
end $$;

create or replace function satispay_corso_stato(persona uuid, corso uuid) returns jsonb
  language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  p pagamenti_satispay;
  n text;
begin
  if persona is null or not iscritto_puo_vedere(persona) then return null; end if;
  -- Un corso già in ricevuta è storia: non è lo stato di adesso, e al rinnovo si deve poter pagare.
  select * into p from pagamenti_satispay x where x.persona_id = persona and x.voce = 'corso' and x.corso_id = corso and x.ricevuta_id is null
    order by x.creato_il desc limit 1;
  if p.id is null then return null; end if;
  -- Un minorenne con account suo, da sé, vede solo il nome.
  select case when persona = persona_corrente() and not nucleo_maggiorenne(persona) then btrim(nome) else btrim(cognome) || ' ' || btrim(nome) end
    into n from persone where id = persona;
  return jsonb_build_object('stato', p.stato, 'importo', p.importo, 'pagato_il', p.pagato_il, 'chi', n, 'satispay_id', p.satispay_id, 'formula', p.formula);
end $$;

create or replace function satispay_corsi_chi(persona uuid) returns jsonb
  language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  l jsonb;
  c record;
  a int;
  t int;
  v jsonb;
  seg boolean;
  apag boolean;
  vivo pagamenti_satispay;
  corsi jsonb := '[]'::jsonb;
begin
  if persona is null or not iscritto_puo_vedere(persona) then return null; end if;
  select listino into l from impostazioni limit 1;
  for c in
    select distinct i.corso_id from iscrizioni i
      where i.persona_id = persona and i.dal <= current_date and (i.al is null or i.al >= current_date)
  loop
    select x into v from jsonb_array_elements(coalesce(l->'corsi', '[]'::jsonb)) x where x->>'corsoId' = c.corso_id::text limit 1;
    seg := jsonb_array_length(coalesce(v->'prezzi', '[]'::jsonb)) > 1;
    -- Un corso gratuito non si mostra: lo dice il listino, che l'iscritto non legge.
    apag := exists (select 1 from jsonb_array_elements(coalesce(v->'prezzi', '[]'::jsonb)) r, unnest(array['annuale', 'trimestre', 'saldo']) k
                      where coalesce((r->>k)::numeric, 0) > 0);
    a := corso_importo_o_null(persona, c.corso_id, 'annuale');
    t := corso_importo_o_null(persona, c.corso_id, 'trimestre');
    -- Un pagamento già da Satispay ad altro importo o formula si rifiuta: non si offre PAGA.
    select * into vivo from pagamenti_satispay x
      where x.persona_id = persona and x.voce = 'corso' and x.corso_id = c.corso_id and x.stato = 'attesa' and x.satispay_id is not null;
    if vivo.id is not null then
      if vivo.formula is distinct from 'annuale' or vivo.importo is distinct from a then a := null; end if;
      if vivo.formula is distinct from 'trimestre' or vivo.importo is distinct from t then t := null; end if;
    end if;
    corsi := corsi || jsonb_build_array(jsonb_build_object(
      'corso_id', c.corso_id, 'annuale', a, 'trimestre', t, 'segreteria', seg, 'a_pagamento', apag,
      -- Arrivato con Satispay e non ancora in una ricevuta: la scheda non direbbe «da pagare» a chi ha già pagato.
      'pagato', exists (select 1 from pagamenti_satispay x where x.persona_id = persona and x.voce = 'corso' and x.corso_id = c.corso_id
                          and x.stato = 'pagato' and x.ricevuta_id is null)));
  end loop;
  return jsonb_build_object(
    'adulto', nucleo_maggiorenne(persona),
    'accesso_proprio', exists (select 1 from persone x where x.id = persona and x.utente_id is not null),
    'come_titolare', persona <> persona_corrente(),
    'corsi', corsi);
end $$;

revoke all on function quota_importo(uuid), corso_importo(uuid, uuid, text), corso_importo_o_null(uuid, uuid, text),
  satispay_prepara_corso(uuid, uuid, text), satispay_corso_stato(uuid, uuid), satispay_corsi_chi(uuid) from public, anon, authenticated;
grant execute on function satispay_prepara_corso(uuid, uuid, text), satispay_corso_stato(uuid, uuid), satispay_corsi_chi(uuid) to authenticated;

notify pgrst, 'reload schema';
