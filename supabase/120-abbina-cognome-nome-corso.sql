-- Il movimento non identificato propone la persona anche dal solo cognome e dal nome di battesimo col corso:
-- `abbina_pagatori_movimento` (119) con due regole in più, in fondo alla cascata, ognuna solo se le precedenti non
-- trovano nessuno. Le stesse di src/lib/abbinaMovimenti.ts.
--   5 «cognome»: il cognome intero della persona o del genitore nel testo. Se è di una persona attiva sola, lei (col
--     segno «già iscritto» se lo è il giorno del movimento). Se è di più persone, chi di loro è iscritto quel giorno;
--     se nessuno, chi ha un'iscrizione in qualunque momento; «già iscritto» falso, come nella 4.
--   6 «nome e corso»: il nome di battesimo intero e una parola del nome di un corso a cui la persona è iscritta
--     (almeno tre lettere, non solo cifre), prima quel giorno, se no in qualunque momento. L'app non lo preseleziona mai.
-- Rende sempre solo id, nome, cognome, `come` e `gia_iscritto`: mai corsi, genitori o date. Le due regole dicono
-- però un po' di più su chi è iscritto (un cognome dà gli iscritti con quel cognome): rischio accettato, la funzione
-- resta solo per e_amministrazione() e col tetto di `cerca_pagatori`.
-- Si lancia dopo 119, e si può rilanciare senza danni.

create or replace function abbina_pagatori_movimento(movimento uuid, corsi uuid[] default null)
  returns table (persona_id uuid, nome text, cognome text, come text, gia_iscritto boolean)
  language plpgsql security definer set search_path = public, extensions as $$
declare
  m movimenti;
  cf text[];
  t text[];
  t2 text[];
begin
  perform pagatori_porta();
  select * into m from movimenti x where x.id = abbina_pagatori_movimento.movimento;
  if not found then return; end if;
  select c.codici into cf from movimenti_codici_letti c where c.movimento_id = m.id;
  t := parole_pagatori(m.descrizione);
  -- per i corsi l'apostrofo ai bordi non conta: «psicomotricita'» è Psicomotricità
  t2 := array(select btrim(w, '''') from unnest(t) w);
  return query
    with b as (
      select p.id as pid, p.nome as pn, p.cognome as pc, a.codice_fiscale as pcf, a.genitore_codice_fiscale as gcf,
             parole_pagatori(p.nome || ' ' || p.cognome) as pp,
             parole_pagatori(p.nome) as pnw,
             parole_pagatori(p.cognome) as pcw,
             -- il genitore vale solo con nome e cognome: uno solo non dice chi è
             case when nullif(btrim(a.genitore_nome), '') is not null and nullif(btrim(a.genitore_cognome), '') is not null
                  then parole_pagatori(a.genitore_nome || ' ' || a.genitore_cognome) end as gp,
             parole_pagatori(a.genitore_cognome) as gcw,
             exists (select 1 from iscrizioni i where i.persona_id = p.id and i.dal <= m.data and (i.al is null or m.data <= i.al)) as iscr,
             exists (select 1 from iscrizioni i where i.persona_id = p.id) as iscr_mai,
             exists (select 1 from iscrizioni i where i.persona_id = p.id and i.corso_id = any(coalesce(corsi, '{}'))
                       and i.dal <= m.data and (i.al is null or m.data <= i.al)) as nel_corso
      from persone p left join anagrafiche a on a.persona_id = p.id
      where p.attiva
    ), r1 as (
      select b.*, 'nome intero'::text as c, b.iscr as gi from b where cardinality(b.pp) > 0 and b.pp <@ t
    ), r2 as (
      select b.*, 'genitore'::text, b.iscr from b
      where not exists (select 1 from r1) and b.gp is not null and cardinality(b.gp) > 0 and b.gp <@ t
    ), r3 as (
      select b.*, 'codice fiscale'::text, b.iscr from b
      where not exists (select 1 from r1) and not exists (select 1 from r2)
        and exists (select 1 from unnest(coalesce(cf, '{}')) with ordinality k(x, o)
                    where (k.x = b.gcf or k.x = b.pcf)
                      -- vale il primo codice, nell'ordine della causale, che trova qualcuno
                      and k.o = (select min(k2.o) from unnest(coalesce(cf, '{}')) with ordinality k2(x, o)
                                 where exists (select 1 from b b2 where k2.x = b2.gcf or k2.x = b2.pcf)))
    ), r4 as (
      select b.*, 'corso e cognome'::text, false from b
      where not exists (select 1 from r1) and not exists (select 1 from r2) and not exists (select 1 from r3)
        and b.nel_corso
        and ((cardinality(b.pcw) > 0 and b.pcw <@ t) or (b.gcw is not null and cardinality(b.gcw) > 0 and b.gcw <@ t))
    ), prima as (
      select * from r1 union all select * from r2 union all select * from r3 union all select * from r4
    ), c5 as (
      select b.* from b
      where not exists (select 1 from prima)
        and ((cardinality(b.pcw) > 0 and b.pcw <@ t) or (b.gcw is not null and cardinality(b.gcw) > 0 and b.gcw <@ t))
    ), r5 as (
      -- un cognome di uno solo dice chi è; di più persone, chi è iscritto quel giorno o, se nessuno, in qualunque
      -- momento (le iscrizioni vecchie non ci sono tutte). Lì l'iscrizione è a favore, come nella 4.
      select c5.*, 'cognome'::text, case when (select count(*) from c5) = 1 then c5.iscr else false end from c5
      where (select count(*) from c5) = 1 or c5.iscr or (not exists (select 1 from c5 x where x.iscr) and c5.iscr_mai)
    ), cw as (
      -- le iscrizioni a un corso con una parola nel testo: almeno tre lettere, non solo cifre («Judo 2» → judo)
      select i.persona_id, i.dal <= m.data and (i.al is null or m.data <= i.al) as alla_data
      from iscrizioni i join corsi k on k.id = i.corso_id
      where exists (select 1 from unnest(parole_pagatori(k.nome)) w
                    where char_length(btrim(w, '''')) >= 3 and btrim(w, '''') !~ '^[0-9]+$' and btrim(w, '''') = any(t2))
    ), c6 as (
      select b.pid, bool_or(cw.alla_data) as ora from b join cw on cw.persona_id = b.pid
      where not exists (select 1 from prima) and not exists (select 1 from r5) and cardinality(b.pnw) > 0 and b.pnw <@ t
      group by b.pid
    ), r6 as (
      -- sui movimenti già collegati ha indovinato 4 volte su 6 (misura del 2026-10-25): l'app non lo preseleziona mai
      select b.*, 'nome e corso'::text, false from b join c6 on c6.pid = b.pid
      where c6.ora or not exists (select 1 from c6 x where x.ora)
    ), tutti as (
      select * from prima union all select * from r5 union all select * from r6
    )
    select u.pid, u.pn, u.pc, u.c, u.gi from tutti u
    order by u.gi, testo_piano(u.pc), testo_piano(u.pn), u.pid
    limit 8;
end $$;

revoke all on function abbina_pagatori_movimento(uuid, uuid[]) from public, anon;
grant execute on function abbina_pagatori_movimento(uuid, uuid[]) to authenticated;

notify pgrst, 'reload schema';
