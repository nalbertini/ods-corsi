-- ---------------------------------------------------------------------------
-- 156 · «Annuale più corsi» paga ogni corso con l'annuale, anche nel database
--
-- Chi ha più corsi annuali paga al massimo `PIU_CORSI` (src/lib/costi.ts), e la
-- segreteria lo scrive in una voce sola, «Annuale più corsi», che non nomina i
-- corsi (`VOCE_PIU_CORSI`, src/lib/nucleo.ts): con 6 o 7 corsi l'elenco non
-- starebbe nei 120 caratteri di una voce, e copre anche un corso aggiunto dopo.
-- Il database che decide se un corso si paga online (`corso_importo`, e
-- `satispay_corsi_chi.assegnato`) cercava nella voce il nome del corso, e quella
-- voce non la riconosceva: chi aveva pagato PIÙ CORSI vedeva i corsi da pagare
-- nell'area iscritti e poteva pagarli di nuovo con Satispay. Da qui, come
-- `statoCorsi` (src/lib/corsiDaPagare.ts):
--   · «più corsi» è uno dei nomi di ogni corso che nel listino ha un annuale
--     (`nomi_del_corso`), quindi una ricevuta o un bonifico assegnato
--     «Annuale più corsi» ferma il pagamento online di quei corsi;
--   · lo sconto famiglia in coda alla voce («… · sconto famiglia 20% su
--     660,00 €», `descrizioneScontata`) non fa parte del nome (`nome_corso`).
--
-- Rifatte: `nome_corso` e `nomi_del_corso`, da quelle del 152. Chi può cosa:
-- come prima; nessuna delle due si chiama da fuori.
--
-- Si lancia dopo `152-corso-gia-pagato.sql` (e dopo `155`); non chiede di
-- rilanciare `06-iscrizioni.sql`. Se si rilancia `152` dopo, va rilanciato
-- anche questo (`controllo.sql` lo dice). Finché non c'è, l'area iscritti
-- mostra «da pagare» i corsi di chi ha pagato «Annuale più corsi» e il
-- database ne accetta il pagamento online.
-- ---------------------------------------------------------------------------

create or replace function nome_corso(t text) returns text
  language sql immutable set search_path = public, pg_temp as $$
  -- Lo sconto famiglia in coda, come `scontoDellaVoce` (nucleo.ts): «Annuale più corsi · sconto famiglia …» è più corsi.
  select btrim(regexp_replace(regexp_replace(testo_piano(t), '\s*·\s*sconto famiglia .*$', ''), '[^a-z0-9]+', ' ', 'g'))
$$;

-- Come `nomiDel` (corsiDaPagare.ts): il nome del corso, quello della voce di listino, quelli con l'etichetta e,
-- se il corso ha un annuale, «più corsi».
create or replace function nomi_del_corso(corso uuid, voce jsonb) returns text[]
  language sql stable security definer set search_path = public, pg_temp as $$
  select array_agg(distinct nome_corso(n)) filter (where nome_corso(n) <> '') from (
    select c.nome as n from corsi c where c.id = corso
    union all select voce->>'corso'
    union all select (voce->>'corso') || ' ' || (r->>'etichetta') from jsonb_array_elements(coalesce(voce->'prezzi', '[]'::jsonb)) r where r->>'etichetta' is not null
    union all select 'più corsi' where exists (select 1 from jsonb_array_elements(coalesce(voce->'prezzi', '[]'::jsonb)) r
                                                where coalesce((r->>'annuale')::numeric, 0) > 0)
  ) x
$$;

revoke all on function nome_corso(text), nomi_del_corso(uuid, jsonb) from public, anon, authenticated;

notify pgrst, 'reload schema';
