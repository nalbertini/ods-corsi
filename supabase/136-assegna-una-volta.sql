-- ODS Corsi · il bonifico assegnato una volta sola, la quota mai oltre il listino, il vecchio programma che lo sa
--
-- Tre cose lasciate aperte da `135-assegna-movimento.sql`:
--   · la chiave: ogni apertura di ASSEGNA ha una chiave, che l'app mette in ogni riga (`chiave`) e che resta nella riga
--     di `pagamenti_diretti`. Se la rete cade dopo la scrittura e l'app riprova, `assegna_movimento` trova la chiave e
--     non scrive niente (anche se le righe sono già diventate ricevuta, cioè annullate): i soldi non si contano due
--     volte. La stessa chiave su un altro bonifico è un errore. Senza chiave si scrive come nel 135. La chiave si guarda
--     prima di tutto il resto, dopo il ruolo: il tentativo ripetuto non deve cadere sul tetto che lui stesso ha riempito;
--   · il tetto della quota: per persona e stagione, la quota non prende più di quanto costa nel listino
--     (`impostazioni.listino->>'quota'`, in euro). Contano le righe attive di `pagamenti_diretti` sulla quota, il pagato
--     della quota nelle ricevute attive e le righe nuove della stessa chiamata; le righe diventate ricevuta contano
--     tramite la ricevuta, una volta sola. La stagione di una voce è quella del nome («Quota associativa 2026/27»), se
--     no quella della data (del movimento per le righe nuove, del pagamento o della ricevuta, o il `dal` della voce della
--     ricevuta), dal 1° agosto come `stagioneDi` di src/lib/costi.ts. Senza la quota nel listino, nessun tetto. Il tetto
--     dei corsi resta dell'app (`cosaNonVaAssegnazione`): i prezzi dei corsi il database non li interpreta;
--   · `incassi_vecchio_programma()` (`71`) rende anche `movimento_id` e `assegnato` (righe attive più pagato delle
--     ricevute attive del movimento, `movimento_assegnato`): un incasso del vecchio programma assegnato anche solo in
--     parte non fa più comparire nessuno in «Pagato nel vecchio programma» (lo decide `pagatoNelVecchio`).
-- Chi può cosa: come nel 135 (assegnare solo l'amministrazione) e nel 71 (la lettura solo la segreteria).
-- Le stesse regole stanno in `src/lib/assegna.ts` (`cosaNonVaQuota`), in `src/lib/pagatoPrima.ts` e nella modalità prova.
--
-- Si lancia dopo `135-assegna-movimento.sql`. Rifà `assegna_movimento` del 135 e `incassi_vecchio_programma` del 71:
-- chi rilancia uno di quei due rilancia poi questo (`controllo.sql` lo dice). Non chiede di rilanciare
-- `06-iscrizioni.sql`. Finché non c'è, l'app manda la chiave e il database la ignora (un tentativo ripetuto scrive due
-- volte, come prima), il tetto della quota lo guarda solo l'app, e «Pagato nel vecchio programma» conta anche gli
-- incassi assegnati.
-- ---------------------------------------------------------------------------

-- La chiave dell'apertura di ASSEGNA: una per tutte le righe scritte da quella chiamata.
alter table pagamenti_diretti add column if not exists chiave uuid;
create index if not exists pagamenti_diretti_chiave on pagamenti_diretti (chiave) where chiave is not null;

-- La stagione di una quota, come l'anno in cui comincia: dal nome («…2026/27» → 2026), se no dalla data, dal 1° agosto.
create or replace function stagione_quota(voce text, giorno date) returns int
  language sql immutable set search_path = public as $$
  select coalesce((substring(voce from '(\d{4})/\d{2}'))::int,
                  extract(year from giorno)::int - case when extract(month from giorno) >= 8 then 0 else 1 end)
$$;

-- È una voce di quota: comincia con «quota associativa», maiuscole o no (`eQuota`).
create or replace function e_quota(voce text) returns boolean language sql immutable set search_path = public as $$
  select lower(btrim(coalesce(voce, ''))) like 'quota associativa%'
$$;

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
  insert into pagamenti_diretti (persona_id, data, importo, metodo, voce, creato_da, movimento_id, chiave)
    select (x->>'persona_id')::uuid, m.data, (x->>'importo')::int, 'Bonifico', btrim(x->>'voce'), persona_corrente(), m.id, k
    from jsonb_array_elements(righe) x;
end $$;

-- Come nel 71, più da quale movimento viene ogni incasso e quanto ne è già assegnato: il tipo che rende cambia, per
-- questo prima si toglie.
drop function if exists incassi_vecchio_programma();
create function incassi_vecchio_programma()
  returns table (persona_id uuid, data date, importo integer, voce text, movimento_id uuid, assegnato integer)
  language plpgsql stable security definer set search_path = public, extensions as $$
declare
  inizio date := make_date(
    extract(year from (now() at time zone 'Europe/Rome'))::int
      - case when extract(month from (now() at time zone 'Europe/Rome')) >= 8 then 0 else 1 end, 8, 1);
begin
  if not e_staff() then
    raise exception 'gli incassi del vecchio programma li vede la segreteria' using errcode = '42501';
  end if;
  return query
    select m.persona_id, m.data, m.importo, v.nome, m.id, movimento_assegnato(m.id)
    from movimenti m join voci_contabili v on v.id = m.voce_id
    where m.tipo = 'entrata' and m.annullato_il is null and m.origine_import like 'prima-nota:%'
      and v.nome in ('Quota associativa', 'Corsi e altri pagamenti')
      and m.data between inizio and (inizio + interval '12 months' - interval '1 day')::date
    order by m.data, m.id;
end $$;

revoke all on function stagione_quota(text, date), e_quota(text) from public, anon, authenticated;
revoke all on function assegna_movimento(uuid, jsonb), incassi_vecchio_programma() from public, anon;
grant execute on function assegna_movimento(uuid, jsonb), incassi_vecchio_programma() to authenticated;

notify pgrst, 'reload schema';
