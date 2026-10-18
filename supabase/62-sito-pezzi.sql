-- Le pagine del sito composte a pezzi (pannello SITO). La segreteria trascina
-- foto in cima, testi, foto e colonne; la struttura si conserva in
-- `sito_pagine.bozza_pezzi` per riaprirla uguale, e accanto, in `bozza`, c'è il
-- testo piatto che ne esce: è quello che PUBBLICA copia in `pubblicato` e da cui
-- il sito statico fa le tessere, come per ogni pagina. Il sito pubblico non vede
-- mai la struttura: `sito_pagine_pubbliche()` resta com'è.
-- Chi può cosa: solo la segreteria (`e_staff()`), creando la pagina o con
-- `salva_bozza_pezzi_sito` (stessa versione e stessi errori di `salva_bozza_sito`,
-- che non tocca i pezzi). Istruttori, iscritti, tablet e chi non ha un accesso: niente.
-- `bozza_pezzi` vuota = pagina col vecchio editor di testo. Il database controlla solo che sia un oggetto
-- JSON non troppo grande: la forma dei pezzi (tipi, id, colonne) la garantisce l'app, che in lettura
-- scarta quella che non torna (la bozza HTML resta). Il JSON non è mai pubblico.
-- Si lancia dopo `56-sito.sql`. Non chiede di rilanciare `06-iscrizioni.sql`. Se si rilancia `56`
-- (che toglie i permessi sulla tabella e li rimette per colonna) va rilanciato anche questo.
-- Finché non c'è, SITO apre tutte le pagine col vecchio editor e dice che
-- le pagine a pezzi non sono ancora attive.
-- Si può rilanciare.
-- ---------------------------------------------------------------------------
alter table sito_pagine add column if not exists bozza_pezzi jsonb
  check (bozza_pezzi is null or (jsonb_typeof(bozza_pezzi) = 'object' and char_length(bozza_pezzi::text) <= 400000));

-- Una pagina nuova può nascere a pezzi; il resto della riga passa solo dalle funzioni.
grant insert (bozza_pezzi) on sito_pagine to authenticated;

create or replace function salva_bozza_pezzi_sito(p_id uuid, p_versione integer, p_titolo text, p_descrizione text, p_bozza text, p_pezzi jsonb)
  returns integer language plpgsql security definer set search_path = public as $$
declare nuova integer;
begin
  if not e_staff() then
    raise exception 'Serve un accesso da segreteria' using errcode = '42501';
  end if;
  update sito_pagine
     set titolo = p_titolo, descrizione = coalesce(p_descrizione, ''), bozza = coalesce(p_bozza, ''), bozza_pezzi = p_pezzi,
         versione = versione + 1, modificata_il = now()
   where id = p_id and versione = p_versione
   returning versione into nuova;
  if nuova is null then
    if exists (select 1 from sito_pagine where id = p_id) then
      raise exception 'La pagina è cambiata mentre la modificavi: ricaricala per vedere le modifiche di chi l’ha toccata' using errcode = 'P0001';
    end if;
    raise exception 'La pagina non c’è più' using errcode = 'P0001';
  end if;
  return nuova;
end $$;

revoke all on function salva_bozza_pezzi_sito(uuid, integer, text, text, text, jsonb) from public, anon;
grant execute on function salva_bozza_pezzi_sito(uuid, integer, text, text, text, jsonb) to authenticated;

notify pgrst, 'reload schema';
