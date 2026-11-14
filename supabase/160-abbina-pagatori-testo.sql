-- ---------------------------------------------------------------------------
-- ODS Corsi · chi ha pagato un bonifico della banca, dal testo, prima di scriverlo
--
-- In «Importa banca» la persona si cercava solo col nome di «Cliente NOME per …»
-- (`cerca_pagatori`): un bonifico SEPA («DA MATERA ELISA PER SALDO … DIEGO ORRU»)
-- non ha quel nome, e non si proponeva nessuno. `abbina_pagatori_movimento` (121,
-- 155) sa riconoscerlo, ma vuole un movimento già scritto. `abbina_pagatori_testo`
-- usa le stesse regole sul testo: chi ha nome e cognome interi (`parole_pagatori`),
-- poi i figli del genitore con nome e cognome interi; solo persone attive, al
-- massimo otto. `sicuro` (si preseleziona) solo se è uno, per nome intero. Rende id,
-- nome, cognome, il segno e `sicuro`: mai il genitore o altri dati.
--
-- Chi può: l'amministrazione (`pagatori_porta`), con lo stesso tetto di ricerche di
-- `cerca_pagatori` (60 in 10 minuti, 500 al giorno). Un testo oltre 400 caratteri
-- non cerca niente.
--
-- Si lancia dopo `121-punteggio-movimenti.sql`. Non chiede di rilanciare
-- `06-iscrizioni.sql` e non rifà funzioni di altri file. Finché non c'è, l'import
-- propone le persone solo dal nome di «Cliente … per …», come prima.
-- ---------------------------------------------------------------------------

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
                  -- il genitore vale solo con nome e cognome: uno solo non dice chi è
                  -- e con parole vere: «-» e «.» non ne hanno, e `'{}' <@ t` è sempre vero
                  when nullif(btrim(a.genitore_nome), '') is not null and nullif(btrim(a.genitore_cognome), '') is not null
                       and cardinality(parole_pagatori(a.genitore_nome || ' ' || a.genitore_cognome)) > 0
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

revoke all on function abbina_pagatori_testo(text) from public, anon;
grant execute on function abbina_pagatori_testo(text) to authenticated;

notify pgrst, 'reload schema';
