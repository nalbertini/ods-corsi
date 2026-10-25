-- Chi ha pagato un movimento non identificato: al posto delle regole in cascata di 119 e 120 (la prima che trova
-- qualcuno ferma le altre), un punteggio che somma i segnali. Le stesse regole di src/lib/abbinaMovimenti.ts.
--   * `abbina_pagatori_movimento(movimento, corsi)`: per ogni persona attiva si sommano nome e cognome interi nel testo
--     (4), codice fiscale letto dalla causale, del genitore o suo (4), nome e cognome interi del genitore (3), lo storico
--     (3: un altro movimento, non annullato, con le stesse parole senza le cifre, già collegato a lei), iscritta il giorno
--     del movimento a un corso che costa l'importo, col cognome nel testo (2), il nome di battesimo e una parola del nome
--     di un corso a cui è iscritta, prima quel giorno e se nessuno in qualunque momento (2), il cognome proprio o del
--     genitore nel testo (1). Si propone chi ha almeno un segnale da 2 in su; se nessuno, il solo cognome come nel 120
--     (di una persona sola; se no chi di loro è iscritto quel giorno, o in qualunque momento). In ordine di punteggio,
--     a pari prima chi non è iscritto, poi cognome e nome; al massimo 8.
--     Rende id, nome, cognome, `come` (il segnale più forte), `gia_iscritto` (iscrizione che copre il giorno del
--     movimento; quella che l'ha fatta trovare è a favore, non conta) e `sicuro`: vero solo per il primo, se ha almeno 4,
--     almeno 2 più del secondo (contando chi ha solo il cognome) e non è già iscritto. L'app preseleziona solo lui; «nome
--     e corso» arriva a 3 al massimo, e non lo è mai. Il punteggio non esce: direbbe a chi amministra più di quel che
--     serve per scegliere.
--     I corsi dell'importo li ricava il database dal listino, e `corsi` non si usa più (resta per non cambiare la
--     firma): scelti da chi chiama, cambiando l'elenco si vedeva a quali corsi è iscritto chi viene proposto.
--   * `abbina_testo_banca(testo, movimenti)`: niente più cascata, per ogni movimento il segno più forte (nome intero,
--     se no genitore); a scegliere è l'app.
--   * `parole_pagatori`: l'apostrofo dopo una vocale a fine parola («NICOLO'») si toglie, come fa normalizzaNome.
-- Cambia le colonne rese, perciò si toglie e si rifà (con i permessi). Si lancia dopo 120, e si può rilanciare senza danni.

create or replace function parole_pagatori(t text) returns text[]
  language sql immutable set search_path = public, extensions as $$
  select coalesce(array_agg(distinct w), '{}') from unnest(regexp_split_to_array(
    regexp_replace(translate(testo_piano(t), '‘’`', repeat(chr(39), 3)), '([aeiou])''(?=[^a-z0-9'']|$)', '\1', 'g'),
    '[^a-z0-9'']+')) w where w <> '' $$;

drop function if exists abbina_pagatori_movimento(uuid, uuid[]);
create function abbina_pagatori_movimento(movimento uuid, corsi uuid[] default null)
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
           o.ord = 1 and o.v >= 4 and not o.gi
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
             case when nullif(btrim(a.genitore_nome), '') is not null and nullif(btrim(a.genitore_cognome), '') is not null
                  then parole_pagatori(a.genitore_nome || ' ' || a.genitore_cognome) <@ t else false end as genitore_ok
      from m join persone p on p.id = m.pid and p.attiva left join anagrafiche a on a.persona_id = p.id
    )
    select c.mid, case when c.nome_ok then 'nome intero' else 'genitore' end from c where c.nome_ok or c.genitore_ok;
end $$;

revoke all on function abbina_pagatori_movimento(uuid, uuid[]), abbina_testo_banca(text, uuid[]) from public, anon;
grant execute on function abbina_pagatori_movimento(uuid, uuid[]), abbina_testo_banca(text, uuid[]) to authenticated;

notify pgrst, 'reload schema';
