-- ---------------------------------------------------------------------------
-- ODS Corsi · una sola categorizzazione degli esercizi
--
-- Gli esercizi avevano due divisioni: la categoria (A corpo libero, Attrezzi,
-- Core, Cardio, Mobilità) e la disciplina (Judo, Lotta, Pilates, Yoga…). Ora ne
-- hanno una sola, quella che la segreteria cura in `impostazioni.discipline`
-- (`40-discipline.sql`), che per chi usa l'app si chiama «categoria». Le cinque
-- vecchie categorie diventano voci della stessa lista, accanto alle altre, e
-- valgono anche per i timer e le liste di musica.
--
-- Cosa fa:
--   1. aggiunge in coda all'elenco le voci che mancano (per id): corpo-libero,
--      attrezzi, core, cardio, mobilita. Non tocca i nomi già cambiati e non
--      rimette una voce che la segreteria ha tolto;
--   2. toglie `categoria` dagli esercizi di `impostazioni.esercizi`: se
--      l'esercizio ha già una disciplina, resta quella (Randori, A corpo libero
--      + judo, diventa judo: «A corpo libero» si perde); se no, la categoria
--      diventa la voce con lo stesso nome, se c'è nell'elenco («Judo»
--      compreso); «tutte» resta com'è.
--   3. dà alla colonna `discipline` il nuovo valore di partenza, con le nove voci.
--
-- Limiti: l'app tiene al massimo 20 voci (`MAX_DISCIPLINE`), il database 50. Una
-- segreteria che ne ha già più di 15 vedrebbe le ultime ex categorie tagliate
-- dall'app: prima si tolgono le voci che non servono. Una `disciplina` scritta
-- che non è più nell'elenco resta nel JSON; l'app la scarta alla lettura.
-- Gli esercizi senza categoria, riscritti da un'app non aggiornata con
-- `categoria`, la riprendono: i tablet si aggiornano prima di lanciare il file.
--
-- Si lancia dopo `40-discipline.sql`; si può rilanciare. Non chiede di
-- rilanciare `06-iscrizioni.sql`. Va lanciato PRIMA di pubblicare l'app che
-- non usa più la categoria: finché non c'è, un esercizio che aveva solo la
-- categoria si legge senza voce, e se la segreteria salva la perde.
-- ---------------------------------------------------------------------------

alter table impostazioni alter column discipline set default
  '[{"id":"judo","nome":"Judo"},{"id":"lotta","nome":"Lotta"},{"id":"pilates","nome":"Pilates"},{"id":"yoga","nome":"Yoga"},{"id":"corpo-libero","nome":"A corpo libero"},{"id":"attrezzi","nome":"Attrezzi"},{"id":"core","nome":"Core"},{"id":"cardio","nome":"Cardio"},{"id":"mobilita","nome":"Mobilità"}]'::jsonb;

-- 1. Le cinque voci, solo quelle che mancano. Un elenco mai toccato (nullo) resta tale: l'app usa quello di partenza.
update impostazioni set discipline = discipline || (
  select coalesce(jsonb_agg(v order by ord), '[]'::jsonb)
  from jsonb_array_elements(
    '[{"id":"corpo-libero","nome":"A corpo libero"},{"id":"attrezzi","nome":"Attrezzi"},{"id":"core","nome":"Core"},{"id":"cardio","nome":"Cardio"},{"id":"mobilita","nome":"Mobilità"}]'::jsonb
  ) with ordinality as t(v, ord)
  where not exists (select 1 from jsonb_array_elements(impostazioni.discipline) d where d->>'id' = v->>'id')
)
where jsonb_typeof(discipline) = 'array';

-- 2. Gli esercizi senza `categoria`. Un catalogo mai toccato (nullo) resta tale.
update impostazioni set esercizi = (
  select coalesce(jsonb_agg(
    case when jsonb_typeof(e) <> 'object' then e
         else (e - 'categoria' - 'disciplina') || case when voce.id is null then '{}'::jsonb else jsonb_build_object('disciplina', voce.id) end
    end order by ord), '[]'::jsonb)
  from jsonb_array_elements(esercizi) with ordinality as t(e, ord)
  left join lateral (
    select case
      -- una disciplina scritta vince
      when jsonb_typeof(e->'disciplina') = 'string' and e->>'disciplina' <> '' then e->>'disciplina'
      -- se no, la categoria diventa la voce con lo stesso nome, se nell'elenco c'è
      else (
        select m.id from (values ('Judo', 'judo'), ('A corpo libero', 'corpo-libero'), ('Attrezzi', 'attrezzi'),
                                 ('Core', 'core'), ('Cardio', 'cardio'), ('Mobilità', 'mobilita')) as m(nome, id)
        where m.nome = e->>'categoria'
          and exists (
            select 1 from jsonb_array_elements(
              case when jsonb_typeof(impostazioni.discipline) = 'array' then impostazioni.discipline
                   else '[{"id":"judo"},{"id":"corpo-libero"},{"id":"attrezzi"},{"id":"core"},{"id":"cardio"},{"id":"mobilita"}]'::jsonb end
            ) d where d->>'id' = m.id)
      )
    end as id
  ) voce on jsonb_typeof(e) = 'object'
)
where jsonb_typeof(esercizi) = 'array';

-- Che l'API veda subito il nuovo valore di partenza, senza aspettare.
notify pgrst, 'reload schema';
