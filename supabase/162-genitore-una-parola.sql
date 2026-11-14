-- ---------------------------------------------------------------------------
-- ODS Corsi · il genitore vale solo se nome e cognome hanno ognuno almeno una lettera
--
-- Il 161 contava le parole del genitore tutte insieme: con «Gino» «-» (o «-» «Rossi») restava una parola sola, e il
-- figlio usciva col segno «genitore» per ogni testo con «gino», contro la regola «il genitore vale solo con nome e
-- cognome: uno solo non dice chi è». Lo stesso in `abbina_pagatori_testo` (160). E il controllo di
-- `abbina_ricevuta_movimento` (153) guardava solo che non fossero vuoti: con un genitore «-» «.» la causale nominava
-- sempre la famiglia, e un bonifico Da classificare si abbinava alla ricevuta di chi la causale non nomina.
-- Ora, in tutte e quattro, il nome e il cognome del genitore devono avere almeno una lettera ciascuno: una parola di
-- `parole_pagatori` (121) può essere anche solo «'» o cifre («1» «Verdi» usciva per ogni causale con «rata 1»). La stessa regola nell'app: `nomeOGenitore` e `abbinaMovimento` (src/lib/abbinaMovimenti.ts).
-- Il resto delle funzioni è quello di 161, 160 e 153.
--
-- Chi può: come prima. `abbina_pagatori_movimento`, `abbina_testo_banca` e `abbina_pagatori_testo` l'amministrazione
-- (`pagatori_porta`); `abbina_ricevuta_movimento` l'amministrazione (`contabilita_porta`).
--
-- Si lancia dopo 153, 160 e 161, non chiede di rilanciare `06-iscrizioni.sql` e si può rilanciare senza danni. Rifà le
-- quattro funzioni: se si rilancia 153, 160 o 161 dopo, va rilanciato anche questo. Finché non c'è, chi ha il genitore
-- con una parola sola esce fra i proposti dei bonifici con quella parola, e il database accetta l'abbinamento di un
-- Da classificare alla ricevuta di chi ha il genitore di sola punteggiatura (l'app di questa versione non lo propone).
-- ---------------------------------------------------------------------------

create or replace function abbina_pagatori_movimento(movimento uuid, corsi uuid[] default null)
  returns table (persona_id uuid, nome text, cognome text, come text, gia_iscritto boolean, sicuro boolean)
  language plpgsql security definer set search_path = public, extensions as $$
declare
  m movimenti;
  cf text[];
  t text[];
  t2 text[];
  firma text[];
  ci uuid[];
begin
  perform pagatori_porta();
  select * into m from movimenti x where x.id = abbina_pagatori_movimento.movimento;
  if not found then return; end if;
  -- i corsi che costano l'importo, come corsiConImporto: il movimento è in centesimi, il listino in euro
  ci := array(select distinct (v->>'corsoId')::uuid
              from impostazioni i, jsonb_array_elements(coalesce(i.listino->'corsi', '[]')) v,
                   jsonb_array_elements(coalesce(v->'prezzi', '[]')) q, unnest(array['saldo', 'annuale', 'trimestre']) k
              where m.importo > 0 and coalesce(v->>'corsoId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                and jsonb_typeof(q->k) = 'number' and round((q->>k)::numeric * 100) = m.importo);
  select c.codici into cf from movimenti_codici_letti c where c.movimento_id = m.id;
  t := parole_pagatori(m.descrizione);
  -- per i corsi l'apostrofo ai bordi non conta: «psicomotricita'» è Psicomotricità
  t2 := array(select btrim(w, '''') from unnest(t) w);
  -- le cifre (TRN, date, numeri di ricevuta) cambiano da un bonifico all'altro dello stesso conto
  firma := array(select distinct w from unnest(t) w where w !~ '[0-9]' order by w);
  return query
    with storici as (
      -- shortcut: legge le parole di ogni movimento collegato a ogni chiamata (oggi 2.000 righe); se diventa lento, una colonna con la firma
      select distinct x.persona_id as pid from movimenti x
      where cardinality(firma) > 0 and x.persona_id is not null and x.annullato_il is null and x.id <> m.id
        and array(select distinct w from unnest(parole_pagatori(x.descrizione)) w where w !~ '[0-9]' order by w) = firma
    ), cw as (
      -- le iscrizioni a un corso con una parola nel testo: almeno tre lettere, non solo cifre («Judo 2» → judo)
      select i.persona_id as pid, bool_or(i.dal <= m.data and (i.al is null or m.data <= i.al)) as ora
      from iscrizioni i join corsi k on k.id = i.corso_id
      where exists (select 1 from unnest(parole_pagatori(k.nome)) w
                    where char_length(btrim(w, '''')) >= 3 and btrim(w, '''') !~ '^[0-9]+$' and btrim(w, '''') = any(t2))
      group by i.persona_id
    ), b as (
      select p.id as pid, p.nome as pn, p.cognome as pc,
             cardinality(parole_pagatori(p.nome || ' ' || p.cognome)) > 0 and parole_pagatori(p.nome || ' ' || p.cognome) <@ t as n,
             -- il genitore vale solo con nome e cognome, ognuno con almeno una lettera: uno solo non dice chi è
             coalesce(a.genitore_nome ~ '[[:alpha:]]' and a.genitore_cognome ~ '[[:alpha:]]'
                      and parole_pagatori(a.genitore_nome || ' ' || a.genitore_cognome) <@ t, false) as g,
             coalesce(a.codice_fiscale = any(cf) or a.genitore_codice_fiscale = any(cf), false) as f,
             exists (select 1 from storici s where s.pid = p.id) as s,
             exists (select 1 from iscrizioni i where i.persona_id = p.id and i.corso_id = any(ci)
                       and i.dal <= m.data and (i.al is null or m.data <= i.al)) as c,
             (cardinality(parole_pagatori(p.cognome)) > 0 and parole_pagatori(p.cognome) <@ t)
               or coalesce(cardinality(parole_pagatori(a.genitore_cognome)) > 0 and parole_pagatori(a.genitore_cognome) <@ t, false) as k,
             -- il nome di battesimo, con un corso nel testo a cui è (o è stata) iscritta: chi vale lo decide b2
             cardinality(parole_pagatori(p.nome)) > 0 and parole_pagatori(p.nome) <@ t and cw.pid is not null as nw,
             coalesce(cw.ora, false) as nw_ora,
             exists (select 1 from iscrizioni i where i.persona_id = p.id and i.dal <= m.data and (i.al is null or m.data <= i.al)) as iscr,
             exists (select 1 from iscrizioni i where i.persona_id = p.id) as iscr_mai
      from persone p left join anagrafiche a on a.persona_id = p.id left join cw on cw.pid = p.id
      where p.attiva
    ), b2 as (
      -- prima chi lo soddisfa il giorno del movimento; se nessuno, in qualunque momento (le iscrizioni vecchie non ci sono tutte)
      select b.*,
             b.nw and (b.nw_ora or not exists (select 1 from b x where x.nw and x.nw_ora)) as nc,
             b.k and (select count(*) from b x where x.k) = 1 as k_solo,
             b.k and (select count(*) from b x where x.k) > 1
               and (b.iscr or (b.iscr_mai and not exists (select 1 from b x where x.k and x.iscr))) as k_iscr
      from b
    ), punti as (
      select u.*,
             4 * u.n::int + 4 * u.f::int + 3 * u.g::int + 3 * u.s::int + 2 * (u.c and u.k)::int + 2 * u.nc::int + u.k::int as v,
             u.n or u.g or u.f or u.s or (u.c and u.k) or u.nc as forte,
             case when u.n then 'nome intero' when u.f then 'codice fiscale' when u.g then 'genitore' when u.s then 'storico'
                  when u.c and u.k then 'corso e cognome' when u.nc then 'nome e corso' else 'cognome' end as cm
      from b2 u
    ), elencati as (
      -- il solo cognome si propone solo se nessuno ha di più: accanto a un nome intero sarebbero solo omonimi
      select u.*, u.iscr and not (u.c or u.cm = 'nome e corso' or (u.cm = 'cognome' and u.k_iscr)) as gi
      from punti u
      where u.v > 0 and (u.forte or ((u.k_solo or u.k_iscr) and not exists (select 1 from punti x where x.forte)))
    ), ordinati as (
      select e.*, row_number() over (order by e.v desc, e.gi, testo_piano(e.pc), testo_piano(e.pn), e.pid) as ord from elencati e
    )
    select o.pid, o.pn, o.pc, o.cm, o.gi,
           o.ord = 1 and o.v >= 4 and (not o.gi or o.cm = 'nome intero')
             and o.v - coalesce((select max(u.v) from punti u where u.v > 0 and u.pid <> o.pid), 0) >= 2
    from ordinati o
    order by o.ord
    limit 8;
end $$;

create or replace function abbina_testo_banca(testo text, movimenti uuid[])
  returns table (movimento_id uuid, come text)
  language plpgsql security definer set search_path = public, extensions as $$
declare
  t text[];
begin
  perform pagatori_porta();
  if length(coalesce(testo, '')) > 400 or cardinality(coalesce(movimenti, '{}')) > 500 then return; end if;
  t := parole_pagatori(testo);
  return query
    with m as (
      select x.id as mid, coalesce(x.persona_id, (select c from collegamento_candidati(x.descrizione) c limit 1)) as pid
      from movimenti x where x.id = any(movimenti) and x.annullato_il is null
    ), c as (
      select distinct m.mid, p.id as pid,
             cardinality(parole_pagatori(p.nome || ' ' || p.cognome)) > 0 and parole_pagatori(p.nome || ' ' || p.cognome) <@ t as nome_ok,
             coalesce(a.genitore_nome ~ '[[:alpha:]]' and a.genitore_cognome ~ '[[:alpha:]]'
                      and parole_pagatori(a.genitore_nome || ' ' || a.genitore_cognome) <@ t, false) as genitore_ok
      from m join persone p on p.id = m.pid and p.attiva left join anagrafiche a on a.persona_id = p.id
    )
    select c.mid, case when c.nome_ok then 'nome intero' else 'genitore' end from c where c.nome_ok or c.genitore_ok;
end $$;

create or replace function abbina_pagatori_testo(testo text)
  returns table (persona_id uuid, nome text, cognome text, come text, sicuro boolean)
  language plpgsql security definer set search_path = public, extensions as $$
declare
  t text[];
begin
  perform pagatori_porta();
  if length(coalesce(testo, '')) > 400 then return; end if;
  t := parole_pagatori(testo);
  return query
    with c as (
      select p.id as pid, p.nome as pn, p.cognome as pc,
             case when cardinality(parole_pagatori(p.nome || ' ' || p.cognome)) > 0 and parole_pagatori(p.nome || ' ' || p.cognome) <@ t then 'nome intero'
                  -- il genitore vale solo con nome e cognome, ognuno con almeno una lettera: uno solo non dice chi è,
                  -- e «-», «.», «'» o «1» non dicono nessuno
                  when a.genitore_nome ~ '[[:alpha:]]' and a.genitore_cognome ~ '[[:alpha:]]'
                       and parole_pagatori(a.genitore_nome || ' ' || a.genitore_cognome) <@ t then 'genitore' end as cm
      from persone p left join anagrafiche a on a.persona_id = p.id
      where p.attiva
    ), o as (
      select c.*, count(*) over () as q from c where c.cm is not null
    )
    select o.pid, o.pn, o.pc, o.cm, o.q = 1 and o.cm = 'nome intero'
    from o
    order by o.cm <> 'nome intero', testo_piano(o.pc), testo_piano(o.pn), o.pid
    limit 8;
end $$;

create or replace function abbina_ricevuta_movimento(movimento uuid, ricevuta uuid) returns void
  language plpgsql security definer set search_path = public, extensions as $$
declare
  m movimenti;
  r ricevute;
  titolare persone;
  da_classificare boolean;
  voce text;
  t text[];
begin
  perform contabilita_porta();
  select * into m from movimenti where id = movimento for update;
  -- Da classificare: entrata attiva del Conto Corrente, non Satispay, non storico di una stagione passata (come 71 e 135).
  da_classificare := m.id is not null and m.annullato_il is null and m.tipo::text = 'entrata' and m.satispay_id is null
    and (select nome from voci_contabili where id = m.voce_id) = 'Da classificare'
    and (select nome from casse where id = m.cassa_id) = 'Conto Corrente'
    and not (coalesce(m.origine_import, '') like 'prima-nota:%' and m.data < make_date(extract(year from (now() at time zone 'Europe/Rome'))::int
      - case when extract(month from (now() at time zone 'Europe/Rome')) >= 8 then 0 else 1 end, 8, 1));
  if not da_classificare then m := movimento_da_assegnare(movimento); end if;
  select * into r from ricevute where id = ricevuta for update;
  if r.id is null then raise exception 'La ricevuta non c’è più: ricarica la pagina.' using errcode = '22023'; end if;
  -- Gli stessi controlli, nello stesso ordine, di `cosaNonVaAbbinamento`.
  if r.annullata_il is not null then raise exception 'La ricevuta è annullata.' using errcode = '22023'; end if;
  if r.movimento_id is not null and r.movimento_id <> m.id then
    raise exception 'La ricevuta n. %/% è già abbinata a un altro bonifico.', r.numero, r.anno using errcode = '22023';
  end if;
  if m.persona_id is not null and r.persona_id is distinct from m.persona_id then
    -- Il nucleo come `personeDelNucleo` e `assegna_movimento`: il titolare, o chi è attivo nel suo nucleo.
    select * into titolare from persone where id = (select coalesce(nucleo, id) from persone where id = m.persona_id);
    if not exists (select 1 from persone p where p.id = r.persona_id
                     and (p.id = titolare.id or (p.attiva and p.nucleo is not distinct from titolare.id))) then
      raise exception 'La ricevuta è di un’altra persona.' using errcode = '22023';
    end if;
  end if;
  -- Un bonifico senza persona la prende dalla ricevuta: una ricevuta senza persona non gliela può dare.
  if m.persona_id is null and r.persona_id is null then raise exception 'La ricevuta non ha una persona.' using errcode = '22023'; end if;
  -- Senza persona, la causale deve nominare (nome e cognome interi, in qualunque ordine) qualcuno del nucleo della ricevuta
  -- o il suo genitore: le parole di `abbina_testo_banca` (121), il nucleo di `personeDelNucleo`. Il genitore anche dalla
  -- richiesta accolta, come `genitori()` dell'app, così quel che l'app propone qui passa. Il genitore vale con almeno una
  -- lettera nel nome e una nel cognome (162): «-» «.» non ha parole, e `'{}' <@ t` è vero per ogni causale.
  if m.persona_id is null then
    t := parole_pagatori(m.descrizione);
    if not exists (
      select 1 from persone p
      where (p.id = (select coalesce(nucleo, id) from persone where id = r.persona_id)
             or (p.attiva and p.nucleo = (select coalesce(nucleo, id) from persone where id = r.persona_id)))
        and ((cardinality(parole_pagatori(p.nome || ' ' || p.cognome)) > 0 and parole_pagatori(p.nome || ' ' || p.cognome) <@ t)
        or exists (select 1 from (select a.genitore_nome g, a.genitore_cognome c from anagrafiche a where a.persona_id = p.id
                                  union all
                                  select q.genitore_nome, q.genitore_cognome from richieste_iscrizione q where q.persona_id = p.id and q.stato = 'accolta') x
                   where x.g ~ '[[:alpha:]]' and x.c ~ '[[:alpha:]]' and parole_pagatori(x.g || ' ' || x.c) <@ t))
    ) then
      raise exception 'La causale del bonifico non nomina la persona della ricevuta, il suo genitore o qualcuno della sua famiglia.' using errcode = '22023';
    end if;
  end if;
  if r.pagato <> m.importo then raise exception 'La ricevuta e il bonifico non hanno lo stesso importo.' using errcode = '22023'; end if;
  if not exists (select 1 from jsonb_array_elements(r.voci) v, jsonb_array_elements(coalesce(v->'pagamenti', '[]')) pg)
     or exists (select 1 from jsonb_array_elements(r.voci) v, jsonb_array_elements(coalesce(v->'pagamenti', '[]')) pg
                where lower(btrim(pg->>'metodo')) <> 'bonifico') then
    raise exception 'La ricevuta non è tutta pagata con bonifico.' using errcode = '22023';
  end if;
  if abs(r.data - m.data) > 30 then raise exception 'La ricevuta e il bonifico distano più di 30 giorni.' using errcode = '22023'; end if;
  if r.movimento_id = m.id then return; end if;
  if movimento_assegnato(m.id) > 0 then
    raise exception 'Il bonifico ha già dei soldi assegnati: annulla prima le ricevute e le assegnazioni.' using errcode = '22023';
  end if;
  if da_classificare then
    -- Come `voceDaRicevuta`: solo quota → «Quota associativa», se no «Corsi e altri pagamenti».
    voce := case when jsonb_array_length(r.voci) > 0
                  and not exists (select 1 from jsonb_array_elements(r.voci) v where lower(btrim(v->>'descrizione')) <> 'quota associativa')
                 then 'Quota associativa' else 'Corsi e altri pagamenti' end;
    -- Prima persona e voce, poi la ricevuta: `movimento_assegnato_resta` (135) guarda i soldi già assegnati, che qui sono zero.
    if not exists (select 1 from voci_contabili where nome = voce and tipo::text = 'entrata') then
      raise exception 'Manca la voce «%»: ricarica la pagina.', voce using errcode = '22023';
    end if;
    update movimenti set persona_id = coalesce(persona_id, r.persona_id), voce_id = (select id from voci_contabili where nome = voce and tipo::text = 'entrata')
      where id = m.id;
  end if;
  update ricevute set movimento_id = m.id where id = r.id;
end $$;

revoke all on function abbina_pagatori_movimento(uuid, uuid[]), abbina_testo_banca(text, uuid[]), abbina_pagatori_testo(text),
  abbina_ricevuta_movimento(uuid, uuid) from public, anon;
grant execute on function abbina_pagatori_movimento(uuid, uuid[]), abbina_testo_banca(text, uuid[]), abbina_pagatori_testo(text),
  abbina_ricevuta_movimento(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
