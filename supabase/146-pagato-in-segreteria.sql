-- ---------------------------------------------------------------------------
-- 146 · Quel che la segreteria ha già incassato conta anche per l'iscritto
--
-- Un bonifico assegnato alla quota o a un corso (135), o un pagamento
-- registrato a mano (54), finché non diventa ricevuta sta in
-- `pagamenti_diretti`. La segreteria lo conta già come pagato
-- (`conAssegnazioni`, src/lib/assegna.ts); l'area iscritti e i pagamenti
-- online guardavano solo le ricevute, e chi aveva pagato risultava «da
-- pagare» e poteva pagare di nuovo con Satispay o con la carta. Da qui
-- contano le righe attive (non annullate) di `pagamenti_diretti` della
-- stagione di oggi, con la regola del tetto della quota (136): la stagione
-- dal nome della voce («…2026/27»), se no dalla data, dal 1° agosto.
--
--   quota_in_segreteria(persona)       i centesimi già in segreteria sulla quota
--   corso_in_segreteria(persona, nomi) c'è già qualcosa sull'annuale, il
--                                      trimestre o il saldo di quel corso
--   quota_della_segreteria(persona)    la quota in più per la scheda (numero 0,
--                                      come `quoteConAssegnazioni`), o []
--
-- Rifatte, con quelle righe dentro:
--   · `quota_importo` (106): la quota già in segreteria, anche in parte, non si
--     paga online: «per quel che manca chiedi alla segreteria»;
--   · `saldo_mancano` (103): il saldo toglie quel che è già in segreteria;
--   · `corso_importo` (106): come la quota, per il corso;
--   · `satispay_corsi_chi` (106): dice anche `assegnato` per ogni corso;
--   · `iscritto_scheda_di` (141): in `quote` c'è anche la quota della segreteria.
--
-- Chi può cosa: come prima. L'iscritto non legge `pagamenti_diretti`: le
-- funzioni nuove non le esegue nessuno da fuori, le usano solo quelle sopra,
-- che controllano già chi chiama.
--
-- Si lancia dopo `136-assegna-una-volta.sql` e `141-certificato-dopo.sql`;
-- non chiede di rilanciare `06-iscrizioni.sql`. Se si rilancia `103`, `105`,
-- `106` o `141` dopo, va rilanciato anche questo (`controllo.sql` lo dice).
-- Finché non c'è, l'area iscritti guarda solo le ricevute, come prima.
-- ---------------------------------------------------------------------------

create or replace function quota_in_segreteria(persona uuid) returns int
  language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(sum(d.importo), 0)::int from pagamenti_diretti d
   where d.persona_id = persona and d.annullato_il is null and e_quota(d.voce)
     and stagione_quota(d.voce, d.data) = stagione_quota('', (now() at time zone 'Europe/Rome')::date)
$$;

-- Le voci di un corso come le scrivono ricevute e assegnazioni: «Annuale Judo», «Trimestre Judo», «Saldo Judo». La
-- stagione è quella dei corsi, dal 1° luglio (`stagioneDi`, src/lib/costi.ts); un trimestre vale tre mesi dalla sua
-- data, come `fineTrimestre` (src/lib/ricevute.ts), così non ferma i trimestri dopo.
create or replace function corso_in_segreteria(persona uuid, nomi text[]) returns boolean
  language sql stable security definer set search_path = public, pg_temp as $$
  with o as (select (now() at time zone 'Europe/Rome')::date as oggi)
  select exists (select 1 from pagamenti_diretti d, o
   where d.persona_id = persona and d.annullato_il is null
     and lower(btrim(d.voce)) in (select f || ' ' || lower(btrim(n)) from unnest(nomi) n, unnest(array['annuale', 'trimestre', 'saldo']) f where n is not null)
     and extract(year from d.data)::int - case when extract(month from d.data) >= 7 then 0 else 1 end
       = extract(year from o.oggi)::int - case when extract(month from o.oggi) >= 7 then 0 else 1 end
     and (lower(btrim(d.voce)) not like 'trimestre %' or o.oggi <= ((d.data - 1) + interval '3 months')::date))
$$;

-- Come `quoteConAssegnazioni`: si parte da quel che manca dopo le ricevute della stessa stagione, se no dal listino.
create or replace function quota_della_segreteria(persona uuid) returns jsonb
  language sql stable security definer set search_path = public, pg_temp as $$
  with o as (select (now() at time zone 'Europe/Rome')::date as oggi),
  q as (select stagione_quota('', oggi) as st,
               case when extract(month from oggi) = 8 then oggi else make_date(stagione_quota('', oggi), 9, 1) end as dal,
               make_date(stagione_quota('', oggi) + 1, 7, 31) as al from o),
  m as (select quota_in_segreteria(persona) as messo)
  select case when m.messo > 0 then jsonb_build_array(jsonb_build_object('anno', q.st, 'numero', 0, 'dal', q.dal, 'al', q.al,
    'mancano', greatest(0, coalesce(
      (select min(r.mancano) from quote_ricevute r where r.persona_id = persona and r.dal <= q.al and coalesce(r.al, '9999-12-31') >= q.dal),
      (select round((listino->>'quota')::numeric * 100)::int from impostazioni limit 1), 0) - m.messo)))
  else '[]'::jsonb end
  from q, m
$$;

-- --- 106, con la quota già in segreteria -------------------------------------------------
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
  -- Un bonifico assegnato o un pagamento a mano, anche in parte: il resto lo fa la segreteria, che ha già i soldi.
  if quota_in_segreteria(persona) > 0 then
    raise exception 'La quota risulta già pagata in segreteria: per quel che manca chiedi alla segreteria' using errcode = '22023';
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

-- --- 103, col saldo che toglie quel che è già in segreteria -------------------------------
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
       - coalesce((select sum(importo) from pagamenti_satispay where persona_id = persona and saldo_di = ric and stato = 'pagato' and ricevuta_id is null), 0)
       - quota_in_segreteria(persona);
  if m <= 0 then raise exception 'Non resta niente da pagare su questa quota' using errcode = '22023'; end if;
  return m;
end $$;

-- --- 106, col corso già in segreteria -----------------------------------------------------
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
  -- Come la ricevuta: un bonifico assegnato o un pagamento a mano di questa stagione, anche in parte.
  if corso_in_segreteria(persona, array[nome, v->>'corso']) then
    raise exception 'Il corso risulta già pagato in segreteria: per quel che manca chiedi alla segreteria' using errcode = '22023';
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
                          and x.stato = 'pagato' and x.ricevuta_id is null),
      -- Già in segreteria (bonifico assegnato o pagamento a mano): lo stesso, senza dire quanto.
      'assegnato', corso_in_segreteria(persona, array[(select x.nome from corsi x where x.id = c.corso_id), v->>'corso'])));
  end loop;
  return jsonb_build_object(
    'adulto', nucleo_maggiorenne(persona),
    'accesso_proprio', exists (select 1 from persone x where x.id = persona and x.utente_id is not null),
    'come_titolare', persona <> persona_corrente(),
    'corsi', corsi);
end $$;

-- --- 141, con la quota della segreteria in `quote` ----------------------------------------
create or replace function iscritto_scheda_di(persona uuid)
  returns table (id uuid, nome text, cognome text, corsi jsonb, certificato_scade date, pagamento stato_pagamento, pagato_fino date, quote jsonb, nato_il date, certificato_in_attesa_il timestamptz, certificato_entro date)
  language sql stable security definer set search_path = public, extensions as $$
  select p.id, p.nome, p.cognome,
    coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'nome', c.nome, 'colore', c.colore) order by c.nome)
                from iscrizioni i join corsi c on c.id = i.corso_id
               where i.persona_id = p.id and c.attivo and i.dal <= (now() at time zone 'Europe/Rome')::date and (i.al is null or i.al >= (now() at time zone 'Europe/Rome')::date)), '[]'::jsonb),
    s.certificato_scade, coalesce(s.pagamento, 'da_pagare'), s.pagato_fino,
    coalesce((select jsonb_agg(jsonb_build_object('anno', q.anno, 'numero', q.numero, 'dal', q.dal, 'al', q.al, 'mancano', q.mancano) order by q.anno, q.numero) from quote_ricevute q where q.persona_id = p.id), '[]'::jsonb)
      || public.quota_della_segreteria(p.id),
    coalesce((select a.nato_il from anagrafiche a where a.persona_id = p.id), (select r.nato_il from richieste_iscrizione r where r.persona_id = p.id and r.stato = 'accolta' order by r.gestita_il desc nulls last limit 1)),
    s.certificato_in_attesa_il,
    certificato_termine(p.id)
  from persone p left join schede_iscritti s on s.persona_id = p.id
  where p.id = persona and p.ruolo::text = 'iscritto' and p.attiva $$;

revoke all on function quota_in_segreteria(uuid), corso_in_segreteria(uuid, text[]), quota_della_segreteria(uuid) from public, anon, authenticated;
revoke all on function quota_importo(uuid), saldo_mancano(uuid, uuid), corso_importo(uuid, uuid, text), iscritto_scheda_di(uuid) from public, anon, authenticated;
revoke all on function satispay_corsi_chi(uuid) from public, anon;
grant execute on function satispay_corsi_chi(uuid) to authenticated;

notify pgrst, 'reload schema';
