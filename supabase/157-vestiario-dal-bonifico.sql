-- ODS Corsi · l'ordine del vestiario saldato dal bonifico
--
-- Nella finestra «Chi ha pagato e per cosa?» un bonifico può pagare un ordine del vestiario («È questo ordine»):
--   · `ordini_vestiario_da_saldare()` rende gli ordini non saldati né annullati con quel che serve per riconoscerli (chi
--     li ha fatti, il telefono, per chi sono i capi, totale e pagato), dal più recente. Niente email. La leggono la
--     segreteria e l'amministrazione, che assegna i bonifici; gli altri no;
--   · `assegna_movimento` (136) accetta in una riga anche `ordine`, l'id dell'ordine. L'ordine dev'essere ancora da
--     saldare e la riga non va oltre quel che gli manca (totale − pagato); se lo copre tutto, l'ordine diventa saldato
--     con bonifico, oggi, come `segna_vestiario`, nella stessa transazione delle righe e con la stessa chiave del 136
--     (ripetuta, la chiamata non fa niente). Se lo copre in parte l'ordine resta com'è: si segna a mano in VESTIARIO;
--     la riga ricorda l'ordine (`pagamenti_diretti.ordine_vestiario`) e quel che è già assegnato conta in quel che manca,
--     così due bonifici in parte non superano l'ordine e il secondo, se completa, lo salda;
--   · un ordine che manca, non è un uuid, è saldato, annullato o già coperto dai bonifici: rifiutato, niente si scrive.
-- Chi può: le funzioni sono di segreteria e amministrazione (47 dà gli ordini alla sola segreteria): l'amministrazione
-- legge chi ha ordinato e il telefono per riconoscere il bonifico, e salda l'ordine solo da `assegna_movimento`.
--   · i soldi che lasciano l'ordine riaprono l'ordine saldato dal bonifico: una riga annullata senza ricevuta (il
--     movimento o l'importazione annullati, la riga tolta) o una ricevuta del bonifico annullata. L'ordine torna da
--     saldare, e dal pagato escono quella riga e le altre righe dei bonifici, che restano contate come assegnate.
-- Le stesse regole stanno in `src/lib/assegna.ts` (`ordiniDelNucleo`, `voceOrdine`) e nella modalità prova.
--
-- Si lancia dopo `136-assegna-una-volta.sql` e `47-vestiario.sql`. Rifà `assegna_movimento` del 136: chi rilancia il
-- 135 o il 136 rilancia poi questo (`controllo.sql` lo dice). Non chiede di rilanciare `06-iscrizioni.sql`. Finché non
-- c'è, la finestra non propone gli ordini (senza `ordini_vestiario_da_saldare`), e l'abbigliamento si assegna a mano.
-- ---------------------------------------------------------------------------

-- Quale ordine paga una riga: la parte di un ordine già assegnata da un bonifico conta in quel che gli manca, anche se
-- l'ordine resta da saldare (in parte non lo si tocca). Una riga diventata ricevuta conta finché la ricevuta è attiva.
alter table pagamenti_diretti add column if not exists ordine_vestiario uuid references ordini_vestiario on delete set null;

-- Quanto dei bonifici è già assegnato a un ordine, in centesimi.
create or replace function ordine_vestiario_assegnato(ordine uuid) returns int
  language sql stable security definer set search_path = public as $$
  select coalesce(sum(d.importo), 0)::int from pagamenti_diretti d
  where d.ordine_vestiario = ordine
    and (d.annullato_il is null or exists (select 1 from ricevute r where r.id = d.ricevuta_id and r.annullata_il is null))
$$;

-- I soldi di una riga lasciano l'ordine: se era saldato dal bonifico torna da saldare, e dal pagato escono quella
-- riga (`importo`, già uscita da `ordine_vestiario_assegnato`) e le righe dei bonifici rimaste, contate a parte.
create or replace function vestiario_riapri(ordine uuid, importo int) returns void
  language plpgsql security definer set search_path = public as $$
declare resta numeric;
begin
  select greatest(o.pagato - (importo + ordine_vestiario_assegnato(o.id)) / 100.0, 0) into resta
    from ordini_vestiario o where o.id = ordine and o.saldato and o.pagato_con = 'bonifico' for update;
  if resta is null then return; end if;
  update ordini_vestiario set saldato = false, pagato = resta,
    pagato_con = case when resta > 0 then pagato_con end, pagato_il = case when resta > 0 then pagato_il end
    where id = ordine;
end $$;

create or replace function vestiario_riga_annullata() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  -- Diventata ricevuta, la riga resta coi soldi sull'ordine: lo riapre l'annullo della ricevuta.
  if new.ordine_vestiario is not null and old.annullato_il is null and new.annullato_il is not null and new.ricevuta_id is null then
    perform vestiario_riapri(new.ordine_vestiario, new.importo);
  end if;
  return new;
end $$;
create or replace trigger vestiario_riga_annullata after update of annullato_il on pagamenti_diretti
  for each row execute function vestiario_riga_annullata();

create or replace function vestiario_ricevuta_annullata() returns trigger
  language plpgsql security definer set search_path = public as $$
declare d record;
begin
  if old.annullata_il is null and new.annullata_il is not null then
    for d in select ordine_vestiario, sum(importo)::int as importo from pagamenti_diretti
             where ricevuta_id = new.id and ordine_vestiario is not null group by 1 loop
      perform vestiario_riapri(d.ordine_vestiario, d.importo);
    end loop;
  end if;
  return new;
end $$;
create or replace trigger vestiario_ricevuta_annullata after update of annullata_il on ricevute
  for each row execute function vestiario_ricevuta_annullata();

create or replace function ordini_vestiario_da_saldare() returns jsonb
  language plpgsql stable security definer set search_path = public as $$
begin
  if not (e_staff() or e_amministrazione()) then
    raise exception 'Gli ordini del vestiario li vedono la segreteria e l’amministrazione' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', o.id, 'raccolta_id', o.raccolta_id, 'nome', o.nome, 'cognome', o.cognome, 'telefono', o.telefono,
      'totale', o.totale, 'pagato', o.pagato, 'assegnato', ordine_vestiario_assegnato(o.id), 'creato_il', o.creato_il,
      'righe', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'per_chi', r.per_chi, 'capo', r.capo, 'taglia', r.taglia,
                                                             'quanti', r.quanti, 'prezzo', r.prezzo) order by r.posizione)
                         from righe_vestiario r where r.ordine_id = o.id), '[]'))
      order by o.creato_il desc)
    from ordini_vestiario o
    where not o.saldato and not o.annullato and round((o.totale - o.pagato) * 100) > ordine_vestiario_assegnato(o.id)), '[]');
end $$;

create or replace function assegna_movimento(movimento uuid, righe jsonb) returns void
  language plpgsql security definer set search_path = public, extensions as $$
declare
  m movimenti;
  titolare persone;
  r jsonb;
  chi persone;
  totale int := 0;
  quanto int;
  chiavi int;
  k uuid;
  gia uuid;
  tetto int;
  g record;
  o ordini_vestiario;
  manca int;
  saldati uuid[] := '{}';
begin
  perform contabilita_porta();
  if jsonb_typeof(righe) is distinct from 'array' or jsonb_array_length(righe) = 0 then
    raise exception 'Metti almeno un importo su una voce.' using errcode = '22023';
  end if;
  -- La chiave prima di tutto: ripetuta, la chiamata ha già scritto, e non deve cadere sul tetto o sul resto che lei
  -- stessa ha riempito. Una sola per chiamata.
  select count(distinct coalesce(x->>'chiave', '')) into chiavi from jsonb_array_elements(righe) x;
  begin
    k := nullif(righe->0->>'chiave', '')::uuid;
  exception when others then chiavi := 2;
  end;
  if chiavi > 1 then raise exception 'L’assegnazione non è andata: chiudi la finestra e riaprila.' using errcode = '22023'; end if;
  if k is not null then
    -- In fila con chi arriva con la stessa chiave nello stesso momento (la stessa chiamata partita due volte).
    perform pg_advisory_xact_lock(hashtextextended(k::text, 136));
    select x.movimento_id into gia from pagamenti_diretti x where x.chiave = k limit 1;
    if gia is not null and gia = movimento then return; end if;
    if gia is not null then
      raise exception 'Questa assegnazione è già stata fatta su un altro bonifico: chiudi la finestra e riaprila.' using errcode = '22023';
    end if;
  end if;
  m := movimento_da_assegnare(movimento);
  -- Il nucleo come `personeDelNucleo`: il titolare (o la persona stessa) e chi è attivo nel suo nucleo.
  select * into titolare from persone where id = (select coalesce(nucleo, id) from persone where id = m.persona_id);
  for r in select * from jsonb_array_elements(righe) loop
    begin
      chi := null;
      select * into chi from persone where id = (r->>'persona_id')::uuid;
    exception when others then chi := null;
    end;
    if chi.id is null or not (chi.id = titolare.id or (chi.attiva and chi.nucleo is not distinct from titolare.id)) then
      raise exception '% non è nella famiglia di % %: il bonifico si assegna solo a chi è nel suo nucleo.',
        coalesce(chi.cognome || ' ' || chi.nome, 'Questa persona'), titolare.cognome, titolare.nome using errcode = '22023';
    end if;
  end loop;
  for r in select * from jsonb_array_elements(righe) loop
    begin
      quanto := (r->>'importo')::int;
    exception when others then quanto := null;
    end;
    if quanto is null or quanto <= 0 then raise exception 'Metti su ogni voce un importo maggiore di zero.' using errcode = '22023'; end if;
    if jsonb_typeof(r->'voce') is distinct from 'string' or btrim(r->>'voce') = '' then
      raise exception 'Scrivi a cosa serve ogni importo.' using errcode = '22023';
    end if;
    totale := totale + quanto;
  end loop;
  if totale > m.importo - movimento_assegnato(m.id) then
    raise exception 'Hai assegnato % più del bonifico: togli da una voce.', euro_assegna(totale - (m.importo - movimento_assegnato(m.id))) using errcode = '22023';
  end if;
  -- Il tetto della quota, per persona e stagione. Le persone in fila (in ordine, per non incrociarsi) con chi assegna
  -- la loro quota da un altro bonifico nello stesso momento. «for no key update» e non «for update»: le scritture di
  -- `pagamenti_diretti` su quelle persone prendono «for key share», e con «for update» si fermerebbero (stallo).
  select round((listino->>'quota')::numeric * 100)::int into tetto from impostazioni limit 1;
  if coalesce(tetto, 0) > 0 then
    perform 1 from persone p where p.id in (select (x->>'persona_id')::uuid from jsonb_array_elements(righe) x where e_quota(x->>'voce'))
      order by p.id for no key update;
    for g in
      select (x->>'persona_id')::uuid as persona, stagione_quota(x->>'voce', m.data) as stagione, sum((x->>'importo')::int)::int as nuovo
      from jsonb_array_elements(righe) x where e_quota(x->>'voce')
      group by 1, 2 order by 1, 2
    loop
      quanto := coalesce((select sum(d.importo) from pagamenti_diretti d
                          where d.persona_id = g.persona and d.annullato_il is null and e_quota(d.voce)
                            and stagione_quota(d.voce, d.data) = g.stagione), 0)
              + coalesce((select sum((pg->>'importo')::int) from ricevute rc, jsonb_array_elements(rc.voci) v,
                                 jsonb_array_elements(coalesce(v->'pagamenti', '[]')) pg
                          where rc.persona_id = g.persona and rc.annullata_il is null and e_quota(v->>'descrizione')
                            and stagione_quota(v->>'descrizione', coalesce(nullif(v->>'dal', '')::date, rc.data)) = g.stagione), 0);
      if quanto + g.nuovo > tetto then
        raise exception 'Alla quota mancano %: metti % o meno, il resto rimane da assegnare.',
          euro_assegna(greatest(tetto - quanto, 0)), euro_assegna(greatest(tetto - quanto, 0)) using errcode = '22023';
      end if;
    end loop;
  end if;
  -- L'ordine del vestiario di una riga (157): ancora da saldare, in fila con chi lo salda nello stesso momento, e la riga
  -- non oltre quel che gli manca. Coperto tutto, si salda insieme alle righe; in parte resta com'è.
  -- Un id che non è un uuid non è un ordine; raggruppati per uuid, lo stesso ordine scritto in due modi è uno solo.
  for r in select * from jsonb_array_elements(righe) x where nullif(x->>'ordine', '') is not null loop
    begin
      perform (r->>'ordine')::uuid;
    exception when invalid_text_representation then
      raise exception 'L’ordine del vestiario è già saldato o annullato: togli la riga e riapri la finestra.' using errcode = '22023';
    end;
  end loop;
  for g in
    select (x->>'ordine')::uuid as ordine, sum((x->>'importo')::int)::int as nuovo
    from jsonb_array_elements(righe) x where nullif(x->>'ordine', '') is not null group by 1 order by 1
  loop
    o := null;
    select * into o from ordini_vestiario where id = g.ordine for update;
    if o.id is null or o.saldato or o.annullato or round((o.totale - o.pagato) * 100) <= ordine_vestiario_assegnato(o.id) then
      raise exception 'L’ordine del vestiario è già saldato o annullato: togli la riga e riapri la finestra.' using errcode = '22023';
    end if;
    manca := round((o.totale - o.pagato) * 100)::int - ordine_vestiario_assegnato(o.id);
    if g.nuovo > manca then
      raise exception 'All’ordine del vestiario mancano %: metti % o meno, il resto rimane da assegnare.', euro_assegna(manca), euro_assegna(manca) using errcode = '22023';
    end if;
    if g.nuovo = manca then saldati := saldati || o.id; end if;
  end loop;
  insert into pagamenti_diretti (persona_id, data, importo, metodo, voce, creato_da, movimento_id, chiave, ordine_vestiario)
    select (x->>'persona_id')::uuid, m.data, (x->>'importo')::int, 'Bonifico', btrim(x->>'voce'), persona_corrente(), m.id, k,
      nullif(x->>'ordine', '')::uuid
    from jsonb_array_elements(righe) x;
  -- Come `segna_vestiario(ordine, 'bonifico')`: saldato, pagato il totale, oggi.
  update ordini_vestiario ov set saldato = true, pagato = ov.totale, pagato_con = 'bonifico', pagato_il = vestiario_oggi()
    where ov.id = any(saldati);
end $$;

revoke all on function ordine_vestiario_assegnato(uuid), vestiario_riapri(uuid, int), vestiario_riga_annullata(), vestiario_ricevuta_annullata() from public, anon, authenticated;
revoke all on function ordini_vestiario_da_saldare() from public, anon;
grant execute on function ordini_vestiario_da_saldare() to authenticated;
revoke all on function assegna_movimento(uuid, jsonb) from public, anon;
grant execute on function assegna_movimento(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
