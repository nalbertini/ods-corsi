-- ---------------------------------------------------------------------------
-- ODS Corsi · il ruolo di chi si cerca per nome
--
-- Un'istruttrice che frequenta anche i corsi ha due schede con lo stesso nome:
-- una da istruttore, con l'accesso all'app, e una da iscritta (le due non si
-- uniscono: `unione_possibile` del 29). In «Chi ha pagato e per cosa?» e nel
-- pagamento fatto a mano uscivano due righe uguali. `cerca_pagatori` (55) rende
-- ora anche `ruolo`, e l'app lo scrive sotto il nome di chi non è un iscritto
-- (`ruoloDaMostrare` in `src/lib/ruoli.ts`). Il ruolo non è un contatto: chi
-- segue i pagamenti continua a non vedere telefono, email o altro.
--
-- Chi può: come prima, la segreteria e l'amministrazione, con lo stesso tetto
-- di ricerche.
--
-- Si lancia dopo `55-amministrazione.sql`. Rifà `cerca_pagatori`: se si
-- rilancia il 55 dopo, va rilanciato anche questo (`controllo.sql` lo dice). Non chiede di rilanciare
-- `06-iscrizioni.sql`. Finché non c'è, la ricerca rende solo nome e cognome e
-- due omonimi restano uguali, come prima.
-- ---------------------------------------------------------------------------

-- Cambia quel che rende: `create or replace` non basta.
drop function if exists cerca_pagatori(text);

create function cerca_pagatori(scritto text)
  returns table (persona_id uuid, nome text, cognome text, ruolo text)
  language plpgsql security definer set search_path = public, extensions as $$
begin
  if not (e_staff() or e_amministrazione()) then
    raise exception 'i nomi li vede chi segue i pagamenti' using errcode = '42501';
  end if;
  -- Uno per volta per persona, se no cento richieste insieme vedono tutte meno del tetto.
  perform pg_advisory_xact_lock(hashtext('pagatori:' || persona_corrente()::text));
  if (select count(*) filter (where r.quando > now() - interval '10 minutes') >= 60
             or count(*) filter (where r.quando > now() - interval '1 day') >= 500
        from ricerche_pagatori r where r.persona_id = persona_corrente()) then
    raise exception 'troppe ricerche: riprova fra qualche minuto' using errcode = '42501';
  end if;
  insert into ricerche_pagatori (persona_id) values (persona_corrente());
  delete from ricerche_pagatori r where r.quando < now() - interval '1 day';
  if length(coalesce(scritto, '')) > 100 then return; end if;
  return query
    select p.id, p.nome, p.cognome, p.ruolo::text from persone p
    where p.attiva and somiglia(p.nome, p.cognome, scritto)
    order by p.cognome, p.nome, p.id
    limit 8;
end $$;

revoke all on function cerca_pagatori(text) from public, anon;
grant execute on function cerca_pagatori(text) to authenticated;

notify pgrst, 'reload schema';
