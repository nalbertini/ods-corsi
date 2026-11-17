-- ---------------------------------------------------------------------------
-- 164 · Unire due schede non perde provincia, provincia di nascita e IBAN
--
-- `unisci_persone` (99, avvolta da 102) riempie i vuoti dell'anagrafica di chi
-- resta con quella del doppione colonna per colonna, poi la cancella: le tre
-- colonne arrivate col 78 (`provincia`, `provincia_nascita`, `iban`) non erano
-- nell'elenco, e unendo due schede si perdevano. Qui la funzione di 102 le
-- riempie prima di chiamare l'unione: come le altre, vince chi resta.
--
--   unisci_persone(resta, via)   come prima (solo la segreteria), più le tre
--                                colonne. Una colonna nuova dell'anagrafica va
--                                aggiunta anche qui: la prova
--                                `unisci-doppioni.sql` lo ricorda
--
-- Si lancia dopo `102-certificato-iscritto.sql`: se no si ferma. Non chiede di
-- rilanciare `06-iscrizioni.sql`. Rilanciare 102 riporta la versione che le
-- perde: dopo si rilancia questo. Finché non c'è, unire due schede funziona
-- come prima e perde le tre colonne del doppione.
-- ---------------------------------------------------------------------------

do $$ begin
  if to_regprocedure('public.unisci_persone_0(uuid, uuid)') is null then
    raise exception 'Prima va lanciato 102-certificato-iscritto.sql';
  end if;
end $$;

create or replace function unisci_persone(resta uuid, via uuid) returns void language plpgsql security definer set search_path = public, extensions as $$
declare rf text; ri timestamptz; vf text; vi timestamptz; vince text; vinci timestamptz; perde text; nuovo text;
begin
  if not e_staff() then raise exception 'Non hai il permesso: serve un accesso da segreteria' using errcode = '42501'; end if;
  -- Le colonne del 78, che `unisci_persone_0` non conosce: se l'unione si ferma, si annulla anche questo.
  insert into anagrafiche (persona_id)
    select resta where exists (select 1 from anagrafiche where persona_id = via)
    on conflict (persona_id) do nothing;
  update anagrafiche r
     set provincia = coalesce(r.provincia, v.provincia),
         provincia_nascita = coalesce(r.provincia_nascita, v.provincia_nascita),
         iban = coalesce(r.iban, v.iban)
    from anagrafiche v
   where v.persona_id = via and r.persona_id = resta;
  -- Da qui com'era in 102: il certificato in attesa più recente passa a chi resta.
  select certificato_in_attesa, certificato_in_attesa_il into rf, ri from schede_iscritti where persona_id = resta;
  select certificato_in_attesa, certificato_in_attesa_il into vf, vi from schede_iscritti where persona_id = via;
  if vf is not null and (rf is null or vi > ri) then vince := vf; vinci := vi; perde := rf; else vince := rf; vinci := ri; perde := vf; end if;
  if vince is not null then
    nuovo := 'tmp/' || gen_random_uuid()::text; update storage.objects set name = nuovo where bucket_id = 'certificati' and name = vince;
  end if;
  update schede_iscritti set certificato_in_attesa = null, certificato_in_attesa_il = null where persona_id in (resta, via);
  perform unisci_persone_0(resta, via);
  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.objects where bucket_id = 'certificati' and name = perde;
  if vince is not null then
    vince := resta::text || '/attesa-' || (extract(epoch from clock_timestamp()) * 1000)::bigint || '.' || substring(vince from '\.([a-z]+)$');
    update storage.objects set name = vince where bucket_id = 'certificati' and name = nuovo;
    insert into schede_iscritti (persona_id, certificato_in_attesa, certificato_in_attesa_il) values (resta, vince, vinci)
      on conflict (persona_id) do update set certificato_in_attesa = excluded.certificato_in_attesa, certificato_in_attesa_il = excluded.certificato_in_attesa_il;
  end if;
end $$;
revoke all on function unisci_persone(uuid, uuid) from public, anon;
grant execute on function unisci_persone(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
