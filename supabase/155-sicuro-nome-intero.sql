-- Una sola regola di «sicuro» (src/lib/sicuro.ts, `personaSicura`): chi è già iscritto, col nome e cognome interi
-- nella causale, è «sicuro» come chi non lo è. Prima un già iscritto non lo era mai: il secondo corso o il trimestre di
-- un iscritto restavano da scegliere a mano, e quindi da assegnare a mano (deciso da Nicola il 13/11/2026). Il resto
-- di `abbina_pagatori_movimento` è quello di 121: almeno 4 punti, almeno 2 più del secondo; il genitore, il codice,
-- lo storico e il cognome di un già iscritto restano da scegliere.
-- Chi può: come in 121 (`pagatori_porta`, l'amministrazione). Si lancia dopo 121, non chiede di rilanciare
-- `06-iscrizioni.sql`, e si può rilanciare senza danni. Finché non c'è, il database non dà «sicuro» al già iscritto:
-- all'import la persona non si preseleziona e il bonifico resta da collegare a mano, come prima.

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
             -- il genitore vale solo con nome e cognome: uno solo non dice chi è
             coalesce(nullif(btrim(a.genitore_nome), '') is not null and nullif(btrim(a.genitore_cognome), '') is not null
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


revoke all on function abbina_pagatori_movimento(uuid, uuid[]) from public, anon;
grant execute on function abbina_pagatori_movimento(uuid, uuid[]) to authenticated;

notify pgrst, 'reload schema';
