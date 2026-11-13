-- ---------------------------------------------------------------------------
-- 152 · «Questo corso è già pagato» come lo dice la segreteria
--
-- Il database decide se un corso o la quota si pagano online (`corso_importo`,
-- `quota_importo`): è l'ultima difesa contro il doppio pagamento. Riconosceva
-- meno ricevute della segreteria (`statoCorsi`, src/lib/corsiDaPagare.ts), e
-- chi aveva già pagato poteva pagare di nuovo. Da qui, come la segreteria:
--   · una voce di ricevuta è del corso se, tolti accenti, maiuscole e segni
--     (`nome_corso`, come `nomeCorso` di src/lib/listino.ts), dice «Annuale»,
--     «Trimestre» o «Saldo» e il nome del corso, quello della sua voce di
--     listino o quello con l'etichetta di una riga («Fitness 2 giorni»);
--   · una voce che finisce oggi o dopo, o senza fine, ferma il corso, anche se
--     parte domani: chi ha pagato in anticipo non paga due volte;
--   · un bonifico assegnato o un pagamento a mano (`corso_in_segreteria`) si
--     riconosce con gli stessi nomi; lo spazio indivisibile è uno spazio;
--   · un corso «va bene senza prezzo» non si paga online;
--   · l'eccezione «fuori dall'app» (`schede_iscritti.pagamento`) senza data
--     vale fino al 31 luglio della stagione in cui è stata scritta
--     (`cambiata_il`), non per sempre. Per il corso conta
--     solo «pagato»: «in parte» riguarda la quota, e il corso resta da pagare;
--   · un corso «va bene senza prezzo» (`senzaPrezzoVaBene` del listino) non è
--     a pagamento in `satispay_corsi_chi`;
--   · `satispay_corsi_chi` dice anche il nome del corso nel listino (`voce`) e
--     le etichette delle righe, perché l'area iscritti (che il listino non lo
--     legge) riconosca le stesse voci della segreteria;
--   · i giorni sono quelli di Roma, come nel resto del database.
--
--   nome_corso(testo)           il nome senza accenti, maiuscole e segni
--   nomi_del_corso(corso, voce) i nomi con cui una ricevuta può chiamare il corso
--
-- Rifatte: `corso_in_segreteria`, `quota_importo`, `corso_importo` e `satispay_corsi_chi`, da
-- quelle del 146. Chi può cosa: come prima; le due funzioni nuove non le
-- chiama nessuno da fuori.
--
-- Si lancia dopo `146-pagato-in-segreteria.sql`; non chiede di rilanciare
-- `06-iscrizioni.sql`. Se si rilancia `105`, `106` o `146` dopo, va
-- rilanciato anche questo (`controllo.sql` lo dice). Finché non c'è, il
-- database riconosce le voci come prima, e l'area iscritti mostra «da pagare»
-- un corso pagato con una voce che ha l'etichetta del listino.
-- ---------------------------------------------------------------------------

create or replace function nome_corso(t text) returns text
  language sql immutable set search_path = public, pg_temp as $$
  select btrim(regexp_replace(testo_piano(t), '[^a-z0-9]+', ' ', 'g'))
$$;

-- Come `nomiDel` (corsiDaPagare.ts): il nome del corso, quello della voce di listino e quelli con l'etichetta.
create or replace function nomi_del_corso(corso uuid, voce jsonb) returns text[]
  language sql stable security definer set search_path = public, pg_temp as $$
  select array_agg(distinct nome_corso(n)) filter (where nome_corso(n) <> '') from (
    select c.nome as n from corsi c where c.id = corso
    union all select voce->>'corso'
    union all select (voce->>'corso') || ' ' || (r->>'etichetta') from jsonb_array_elements(coalesce(voce->'prezzi', '[]'::jsonb)) r where r->>'etichetta' is not null
  ) x
$$;

-- La fine di un'eccezione «fuori dall'app» scritta senza data: il 31 luglio della stagione della quota in cui è
-- stata scritta (`cambiata_il` della scheda), come `STAGIONE.quota.al` (src/lib/costi.ts). Dalla stagione di oggi
-- non scadrebbe mai.
create or replace function fine_fuori_app(fino date, scritta date) returns date
  language sql stable set search_path = public, pg_temp as $$
  select coalesce(fino, make_date(stagione_quota('', scritta) + 1, 7, 31))
$$;

-- --- 146, coi nomi del listino: un bonifico assegnato «Annuale Fitness 2 giorni» è il Fitness --------------
create or replace function corso_in_segreteria(persona uuid, nomi text[]) returns boolean
  language sql stable security definer set search_path = public, pg_temp as $$
  with o as (select (now() at time zone 'Europe/Rome')::date as oggi)
  select exists (select 1 from pagamenti_diretti d, o, regexp_match(btrim(testo_piano(d.voce)), '^(annuale|trimestre|saldo)\s+(.+)$') m
   where d.persona_id = persona and d.annullato_il is null
     and nome_corso(m[2]) in (select nome_corso(n) from unnest(nomi) n where nome_corso(n) <> '')
     and extract(year from d.data)::int - case when extract(month from d.data) >= 7 then 0 else 1 end
       = extract(year from o.oggi)::int - case when extract(month from o.oggi) >= 7 then 0 else 1 end
     and (m[1] <> 'trimestre' or o.oggi <= ((d.data - 1) + interval '3 months')::date))
$$;

-- --- 146, coi giorni di Roma e l'eccezione fino a fine stagione ---------------------------
create or replace function quota_importo(persona uuid) returns int
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  q numeric;
  s schede_iscritti;
  oggi date := (now() at time zone 'Europe/Rome')::date;
begin
  select (listino->>'quota')::numeric into q from impostazioni limit 1;
  if q is null then raise exception 'La quota non è nel listino: chiedi alla segreteria' using errcode = '22023'; end if;
  if exists (
    select 1 from ricevute r, jsonb_array_elements(r.voci) x
      where r.persona_id = persona and r.annullata_il is null
        and upper(btrim(x->>'descrizione')) = 'QUOTA ASSOCIATIVA'
        and coalesce((x->>'dal')::date, oggi) <= oggi and coalesce((x->>'al')::date, oggi) >= oggi
  ) then
    raise exception 'La quota associativa ha già una ricevuta: per quel che manca c’è il saldo' using errcode = '22023';
  end if;
  if quota_in_segreteria(persona) > 0 then
    raise exception 'La quota risulta già pagata in segreteria: per quel che manca chiedi alla segreteria' using errcode = '22023';
  end if;
  -- «Pagato» o «in parte»: come `pagamentoDi`, la quota non è da pagare.
  select * into s from schede_iscritti where persona_id = persona;
  if s.persona_id is not null and s.pagamento <> 'da_pagare' and fine_fuori_app(s.pagato_fino, (s.cambiata_il at time zone 'Europe/Rome')::date) >= oggi then
    raise exception 'La quota risulta già pagata fuori dall’app: chiedi alla segreteria' using errcode = '22023';
  end if;
  if exists (select 1 from pagamenti_satispay where persona_id = persona and stato = 'pagato' and ricevuta_id is null
               and voce is distinct from 'corso') then
    raise exception 'Hai già pagato con Satispay: la segreteria prepara la ricevuta' using errcode = '22023';
  end if;
  return round(q * 100)::int;
end $$;

-- --- 146, con le voci riconosciute come in segreteria ------------------------------------
create or replace function corso_importo(persona uuid, corso uuid, formula text) returns int
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  l jsonb;
  v jsonb;
  p int;
  nomi text[];
  s schede_iscritti;
  oggi date := (now() at time zone 'Europe/Rome')::date;
begin
  if not exists (select 1 from iscrizioni i where i.persona_id = persona and i.corso_id = corso
                   and i.dal <= oggi and (i.al is null or i.al >= oggi)) then
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
  p := case when v is null then null else prezzo_dal_listino(v, formula, oggi, (l->>'saldoEntro')::date) end;
  -- Senza prezzo, o «va bene senza prezzo» (`aPagamento`, corsiDaPagare.ts): non si paga online.
  if p is null or p <= 0 or coalesce(l->'senzaPrezzoVaBene', '[]'::jsonb) ? corso::text then raise exception 'Il corso non è nel listino: chiedi alla segreteria' using errcode = '22023'; end if;
  -- Una voce del corso pagata, o in parte, che non è finita: anche se parte domani o non ha date, come in segreteria.
  nomi := nomi_del_corso(corso, v);
  if exists (
    select 1 from ricevute r, jsonb_array_elements(r.voci) x,
         regexp_match(btrim(testo_piano(x->>'descrizione')), '^(annuale|trimestre|saldo)\s+(.+)$') m
      where r.persona_id = persona and r.annullata_il is null
        and nome_corso(m[2]) = any(nomi)
        and coalesce((x->>'al')::date, oggi) >= oggi
  ) then
    raise exception 'Il corso ha già una ricevuta: per quel che manca chiedi alla segreteria' using errcode = '22023';
  end if;
  if corso_in_segreteria(persona, nomi) then
    raise exception 'Il corso risulta già pagato in segreteria: per quel che manca chiedi alla segreteria' using errcode = '22023';
  end if;
  -- L'eccezione «pagato fuori dall'app»; «in parte» è della quota, il corso resta da pagare.
  select * into s from schede_iscritti where persona_id = persona;
  if s.persona_id is not null and s.pagamento = 'pagato' and fine_fuori_app(s.pagato_fino, (s.cambiata_il at time zone 'Europe/Rome')::date) >= oggi then
    raise exception 'Il corso risulta già pagato fuori dall’app: chiedi alla segreteria' using errcode = '22023';
  end if;
  if exists (select 1 from pagamenti_satispay x where x.persona_id = persona and x.stato = 'pagato' and x.ricevuta_id is null
               and ((x.voce = 'corso' and x.corso_id = corso) or (x.voce is null and x.saldo_di is null))) then
    raise exception 'Hai già pagato con Satispay: la segreteria prepara la ricevuta' using errcode = '22023';
  end if;
  return p;
end $$;

-- --- 146, con «va bene senza prezzo» e i nomi del listino --------------------------------
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
  oggi date := (now() at time zone 'Europe/Rome')::date;
begin
  if persona is null or not iscritto_puo_vedere(persona) then return null; end if;
  select listino into l from impostazioni limit 1;
  for c in
    select distinct i.corso_id from iscrizioni i
      where i.persona_id = persona and i.dal <= oggi and (i.al is null or i.al >= oggi)
  loop
    select x into v from jsonb_array_elements(coalesce(l->'corsi', '[]'::jsonb)) x where x->>'corsoId' = c.corso_id::text limit 1;
    seg := jsonb_array_length(coalesce(v->'prezzi', '[]'::jsonb)) > 1;
    -- Come `aPagamento` (corsiDaPagare.ts): un corso «va bene senza prezzo» o senza un prezzo non si mostra.
    apag := not coalesce(l->'senzaPrezzoVaBene', '[]'::jsonb) ? c.corso_id::text
      and exists (select 1 from jsonb_array_elements(coalesce(v->'prezzi', '[]'::jsonb)) r, unnest(array['annuale', 'trimestre', 'saldo']) k
                    where coalesce((r->>k)::numeric, 0) > 0);
    a := corso_importo_o_null(persona, c.corso_id, 'annuale');
    t := corso_importo_o_null(persona, c.corso_id, 'trimestre');
    select * into vivo from pagamenti_satispay x
      where x.persona_id = persona and x.voce = 'corso' and x.corso_id = c.corso_id and x.stato = 'attesa' and x.satispay_id is not null;
    if vivo.id is not null then
      if vivo.formula is distinct from 'annuale' or vivo.importo is distinct from a then a := null; end if;
      if vivo.formula is distinct from 'trimestre' or vivo.importo is distinct from t then t := null; end if;
    end if;
    corsi := corsi || jsonb_build_array(jsonb_build_object(
      'corso_id', c.corso_id, 'annuale', a, 'trimestre', t, 'segreteria', seg, 'a_pagamento', apag,
      'pagato', exists (select 1 from pagamenti_satispay x where x.persona_id = persona and x.voce = 'corso' and x.corso_id = c.corso_id
                          and x.stato = 'pagato' and x.ricevuta_id is null),
      'assegnato', corso_in_segreteria(persona, nomi_del_corso(c.corso_id, v)),
      -- I nomi del listino, senza i prezzi: l'area iscritti riconosce le voci come la segreteria.
      'voce', v->>'corso',
      'etichette', coalesce((select jsonb_agg(r->>'etichetta') from jsonb_array_elements(coalesce(v->'prezzi', '[]'::jsonb)) r where r->>'etichetta' is not null), '[]'::jsonb)));
  end loop;
  return jsonb_build_object(
    'adulto', nucleo_maggiorenne(persona),
    'accesso_proprio', exists (select 1 from persone x where x.id = persona and x.utente_id is not null),
    'come_titolare', persona <> persona_corrente(),
    'corsi', corsi);
end $$;

revoke all on function nome_corso(text), nomi_del_corso(uuid, jsonb), fine_fuori_app(date, date), corso_in_segreteria(uuid, text[]) from public, anon, authenticated;
revoke all on function quota_importo(uuid), corso_importo(uuid, uuid, text) from public, anon, authenticated;
revoke all on function satispay_corsi_chi(uuid) from public, anon;
grant execute on function satispay_corsi_chi(uuid) to authenticated;

notify pgrst, 'reload schema';
