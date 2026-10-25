-- Chi ha pagato un movimento non identificato: al posto delle regole in cascata di 119 (la prima che trova qualcuno
-- ferma le altre), un punteggio che somma i segnali. Le stesse regole di src/lib/abbinaMovimenti.ts.
--   * `abbina_pagatori_movimento(movimento, corsi)`: per ogni persona attiva si sommano nome e cognome interi nel testo
--     (4), codice fiscale letto dalla causale, del genitore o suo (4), nome e cognome interi del genitore (3), lo storico
--     (3: un altro movimento, non annullato, con le stesse parole senza le cifre, già collegato a lei), iscritta il giorno
--     del movimento a uno dei `corsi` dell'importo col cognome nel testo (2), il cognome proprio o del genitore nel testo
--     (1). Si propone chi ha almeno un segnale vero (il cognome da solo no: pesa solo contro il primo). In ordine di
--     punteggio, a pari prima chi non è iscritto, poi cognome e nome; al massimo 8.
--     Rende id, nome, cognome, `come` (il segnale più forte), `gia_iscritto` (iscrizione che copre il giorno del
--     movimento; l'iscrizione al corso dell'importo è a favore, non conta) e `sicuro`: vero solo per il primo, se ha
--     almeno 4, almeno 2 più del secondo (contando chi ha solo il cognome) e non è già iscritto. L'app preseleziona solo
--     lui. Il punteggio non esce: dice a chi amministra più di quel che serve per scegliere.
--   * `abbina_testo_banca(testo, movimenti)`: niente più cascata, per ogni movimento il segno più forte (nome intero,
--     se no genitore); a scegliere è l'app.
-- Cambia le colonne rese, perciò si toglie e si rifà (con i permessi). Si lancia dopo 119, e si può rilanciare senza danni.

drop function if exists abbina_pagatori_movimento(uuid, uuid[]);
create function abbina_pagatori_movimento(movimento uuid, corsi uuid[] default null)
  returns table (persona_id uuid, nome text, cognome text, come text, gia_iscritto boolean, sicuro boolean)
  language plpgsql security definer set search_path = public, extensions as $$
declare
  m movimenti;
  cf text[];
  t text[];
  firma text[];
begin
  perform pagatori_porta();
  select * into m from movimenti x where x.id = abbina_pagatori_movimento.movimento;
  if not found then return; end if;
  select c.codici into cf from movimenti_codici_letti c where c.movimento_id = m.id;
  t := parole_pagatori(m.descrizione);
  -- le cifre (TRN, date, numeri di ricevuta) cambiano da un bonifico all'altro dello stesso conto
  firma := array(select w from unnest(t) w where w !~ '[0-9]' order by w);
  return query
    with storici as (
      -- shortcut: legge le parole di ogni movimento collegato a ogni chiamata (oggi 2.000 righe); se diventa lento, una colonna con la firma
      select distinct x.persona_id as pid from movimenti x
      where cardinality(firma) > 0 and x.persona_id is not null and x.annullato_il is null and x.id <> m.id
        and array(select w from unnest(parole_pagatori(x.descrizione)) w where w !~ '[0-9]' order by w) = firma
    ), b as (
      select p.id as pid, p.nome as pn, p.cognome as pc,
             cardinality(parole_pagatori(p.nome || ' ' || p.cognome)) > 0 and parole_pagatori(p.nome || ' ' || p.cognome) <@ t as n,
             -- il genitore vale solo con nome e cognome: uno solo non dice chi è
             coalesce(nullif(btrim(a.genitore_nome), '') is not null and nullif(btrim(a.genitore_cognome), '') is not null
                      and parole_pagatori(a.genitore_nome || ' ' || a.genitore_cognome) <@ t, false) as g,
             coalesce(a.codice_fiscale = any(cf) or a.genitore_codice_fiscale = any(cf), false) as f,
             exists (select 1 from storici s where s.pid = p.id) as s,
             exists (select 1 from iscrizioni i where i.persona_id = p.id and i.corso_id = any(coalesce(corsi, '{}'))
                       and i.dal <= m.data and (i.al is null or m.data <= i.al)) as c,
             (cardinality(parole_pagatori(p.cognome)) > 0 and parole_pagatori(p.cognome) <@ t)
               or coalesce(cardinality(parole_pagatori(a.genitore_cognome)) > 0 and parole_pagatori(a.genitore_cognome) <@ t, false) as k,
             exists (select 1 from iscrizioni i where i.persona_id = p.id and i.dal <= m.data and (i.al is null or m.data <= i.al)) as iscr
      from persone p left join anagrafiche a on a.persona_id = p.id
      where p.attiva
    ), punti as (
      select b.*, 4 * b.n::int + 4 * b.f::int + 3 * b.g::int + 3 * b.s::int + 2 * (b.c and b.k)::int + b.k::int as v,
             b.iscr and not b.c as gi
      from b
    ), elencati as (
      select u.*, row_number() over (order by u.v desc, u.gi, testo_piano(u.pc), testo_piano(u.pn), u.pid) as ord
      from punti u where u.n or u.g or u.f or u.s or (u.c and u.k)
    )
    select e.pid, e.pn, e.pc,
           case when e.n then 'nome intero' when e.f then 'codice fiscale' when e.g then 'genitore'
                when e.s then 'storico' else 'corso e cognome' end,
           e.gi,
           e.ord = 1 and e.v >= 4 and not e.gi
             and e.v - coalesce((select max(u.v) from punti u where u.v > 0 and u.pid <> e.pid), 0) >= 2
    from elencati e
    order by e.ord
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
             case when nullif(btrim(a.genitore_nome), '') is not null and nullif(btrim(a.genitore_cognome), '') is not null
                  then parole_pagatori(a.genitore_nome || ' ' || a.genitore_cognome) <@ t else false end as genitore_ok
      from m join persone p on p.id = m.pid and p.attiva left join anagrafiche a on a.persona_id = p.id
    )
    select c.mid, case when c.nome_ok then 'nome intero' else 'genitore' end from c where c.nome_ok or c.genitore_ok;
end $$;

revoke all on function abbina_pagatori_movimento(uuid, uuid[]), abbina_testo_banca(text, uuid[]) from public, anon;
grant execute on function abbina_pagatori_movimento(uuid, uuid[]), abbina_testo_banca(text, uuid[]) to authenticated;

notify pgrst, 'reload schema';
