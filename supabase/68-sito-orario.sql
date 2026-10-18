-- ---------------------------------------------------------------------------
-- ODS Corsi · l'orario del sito viene da CORSI
--
-- Una pagina del sito si collega a uno o più corsi (`sito_pagine.corsi_collegati`,
-- in ordine di scelta): l'orario a tessere della pagina pubblica lo scrive il
-- generatore dalle ricorrenze di quei corsi (`orari_aperti()`, 48), non dal
-- testo a mano. Nessun orario = «Orario in arrivo».
--
-- Chi può cosa:
--   - la segreteria (`e_staff()`) legge la colonna con la pagina e la cambia
--     solo con `salva_corsi_sito(pagina, corsi)`: toglie i doppioni tenendo
--     l'ordine, rifiuta un corso che non c'è e non tocca versione, bozza né
--     data di modifica (non è un cambio di testo: non c'è niente da pubblicare);
--   - `sito_pagine_pubbliche()` ora dice anche i corsi collegati, delle sole
--     pagine pubblicate e non nascoste, ad `anon` e `authenticated` come prima;
--     la tabella resta chiusa e nessuna colonna si dà ad `anon`;
--   - istruttori, iscritti, tablet e chi non ha un accesso non collegano niente.
--
-- Si lancia dopo `56-sito.sql` e `48-orari-aperti.sql`, e dopo ogni rilancio di `56` va rilanciato anche lui
-- (il `56` rifà `sito_pagine_pubbliche()` senza la colonna: per questo ha un `drop function` prima del `create`).
-- Non chiede di rilanciare
-- `06-iscrizioni.sql` (che anzi riapre da sé le funzioni pubbliche del sito).
-- Finché non c'è, il pannello SITO dice che i corsi collegati non sono ancora
-- attivi e il sito si genera come prima, con l'orario scritto a mano.
-- Si può rilanciare.
-- ---------------------------------------------------------------------------
alter table sito_pagine add column if not exists corsi_collegati uuid[] not null default '{}';

-- La colonna nuova cambia la forma della risposta: si rifà la funzione.
drop function if exists sito_pagine_pubbliche();
create function sito_pagine_pubbliche()
  returns table (slug text, titolo text, descrizione text, testo text, pubblicata_il timestamptz, corsi_collegati uuid[])
  language sql stable security definer set search_path = public as $$
  select p.slug, p.titolo_pubblicato, p.descrizione_pubblicata, p.pubblicato, p.pubblicata_il, p.corsi_collegati
    from sito_pagine p where p.pubblicato is not null and not p.nascosta order by p.slug
$$;

create or replace function salva_corsi_sito(p_id uuid, p_corsi uuid[])
  returns void language plpgsql security definer set search_path = public as $$
declare scelti uuid[];
begin
  if not e_staff() then
    raise exception 'Serve un accesso da segreteria' using errcode = '42501';
  end if;
  if not exists (select 1 from sito_pagine where id = p_id) then
    raise exception 'La pagina non c’è più' using errcode = 'P0001';
  end if;
  -- Senza doppioni, nell'ordine in cui la segreteria li ha scelti.
  select coalesce(array_agg(c order by n), '{}') into scelti
    from (select c, min(n) as n from unnest(coalesce(p_corsi, '{}')) with ordinality as t(c, n) group by c) x;
  if exists (select 1 from unnest(scelti) c where not exists (select 1 from corsi where id = c)) then
    raise exception 'Uno dei corsi scelti non c’è più: ricarica la pagina e scegli di nuovo' using errcode = 'P0001';
  end if;
  update sito_pagine set corsi_collegati = scelti where id = p_id;
end $$;

revoke all on function salva_corsi_sito(uuid, uuid[]), sito_pagine_pubbliche() from public, anon;
grant execute on function salva_corsi_sito(uuid, uuid[]) to authenticated;
grant execute on function sito_pagine_pubbliche() to anon, authenticated;

notify pgrst, 'reload schema';
