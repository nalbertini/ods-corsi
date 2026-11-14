-- ---------------------------------------------------------------------------
-- 160 · Come paga chi si iscrive online
--
-- Nel modulo online chi si iscrive sceglie se pagare col bonifico (la ricevuta
-- è facoltativa) o in contanti in segreteria, entro la prima lezione. La
-- scelta resta sulla richiesta: la segreteria la legge e basta.
--
--   richieste_iscrizione.come_paga   'bonifico', 'contanti' o null (Satispay,
--                                    carta, il nucleo di un iscritto, le
--                                    richieste di prima)
--   invia_iscrizione(dati)           anon: salva `dati->'come_paga'`; un
--                                    valore diverso ferma la richiesta
--   richieste_con_ricevuta()         solo la segreteria: gli id delle
--                                    richieste con la ricevuta del bonifico
--                                    caricata (il segno sulla riga)
--
-- Nessuno cambia `come_paga` dopo: è quello che ha detto chi si iscrive, come
-- `certificato_dopo`. Accogliere la richiesta non segna la quota pagata: i
-- soldi si registrano in segreteria, quando arrivano.
--
-- `invia_iscrizione` è avvolta come in 141: la sua ultima versione diventa
-- `invia_iscrizione_1`, che nessun ruolo chiama da sé. Si lancia solo sopra
-- la catena di 141: se no si ferma e chiede di rilanciare prima 141.
--
-- Si lancia dopo `141-certificato-dopo.sql`. Non chiede di rilanciare
-- `06-iscrizioni.sql`. Rilanciare 06 o un file che rifà `invia_iscrizione`
-- (125, 141) riporta la versione senza la scelta: dopo si rilancia questo.
-- Finché non c'è, l'app manda la scelta e il database la ignora: la richiesta
-- parte lo stesso, ma la segreteria non vede come paga né il segno della
-- ricevuta sulla riga.
-- ---------------------------------------------------------------------------

alter table richieste_iscrizione add column if not exists come_paga text;
alter table richieste_iscrizione drop constraint if exists richieste_come_paga;
alter table richieste_iscrizione add constraint richieste_come_paga check (come_paga in ('bonifico', 'contanti'));

-- --- invia_iscrizione: quella di 141, avvolta --------------------------------
-- Si avvolge solo la catena di 141: senza, `invia_iscrizione_1` sarebbe una versione senza `certificato_dopo`.
do $$ begin
  if not exists (select 1 from pg_proc where proname = 'invia_iscrizione' and pronamespace = 'public'::regnamespace
                 and prosrc ~ 'invia_iscrizione_[0-9]+\(dati\)') then
    raise exception 'Prima rilancia 141-certificato-dopo.sql, poi questo.';
  end if;
  if not exists (select 1 from pg_proc where proname = 'invia_iscrizione' and pronamespace = 'public'::regnamespace
                 and prosrc like '%invia_iscrizione_1(dati)%') then
    drop function if exists invia_iscrizione_1(jsonb);
    alter function invia_iscrizione(jsonb) rename to invia_iscrizione_1;
  end if;
end $$;
create or replace function invia_iscrizione(dati jsonb) returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  nuova uuid;
  scelta jsonb := dati->'come_paga';
begin
  -- I controlli prima di scrivere: un valore sbagliato non lascia una richiesta a metà.
  if scelta is not null and jsonb_typeof(scelta) <> 'null'
     and (jsonb_typeof(scelta) <> 'string' or scelta #>> '{}' not in ('bonifico', 'contanti')) then
    raise exception 'Scegli come paghi: col bonifico o in contanti in segreteria.' using errcode = '22023';
  end if;
  -- Un modo spento in IMPOSTAZIONI mentre il modulo era aperto (126). Senza 126 non si spegne niente.
  if jsonb_typeof(scelta) = 'string' and to_regprocedure('public.metodi_spenti()') is not null
     and scelta #>> '{}' = any (metodi_spenti()) then
    raise exception '%', case scelta #>> '{}'
      when 'contanti' then 'I contanti in segreteria ora non si possono scegliere: ricarica la pagina e scegli un altro modo.'
      else 'Il bonifico ora non si può scegliere: ricarica la pagina e scegli un altro modo.' end using errcode = '22023';
  end if;
  nuova := invia_iscrizione_1(dati);
  -- Solo la prima volta: lo stesso modulo rimandato torna sulla stessa richiesta e non cambia la scelta.
  -- Chi ha già pagato con Satispay o con la carta non ha anche un modo da fare in segreteria.
  if jsonb_typeof(scelta) = 'string' then
    update richieste_iscrizione r set come_paga = scelta #>> '{}'
    where r.id = nuova and r.stato = 'nuova' and r.come_paga is null
      and not exists (select 1 from pagamenti_satispay p where p.richiesta_id = nuova);
  end if;
  return nuova;
end $$;
revoke all on function invia_iscrizione_1(jsonb) from public, anon, authenticated;
revoke all on function invia_iscrizione(jsonb) from public;
grant execute on function invia_iscrizione(jsonb) to anon, authenticated;

-- --- il segno sulla riga: chi ha caricato la ricevuta del bonifico -----------
-- Come `richieste_con_documento` (45): solo i nomi dei file, mai il contenuto.
create or replace function richieste_con_ricevuta()
  returns uuid[] language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not e_staff() then raise exception 'solo la segreteria' using errcode = '42501'; end if;
  return coalesce((
    select array_agg(distinct split_part(o.name, '/', 1)::uuid) from storage.objects o
    where o.bucket_id = 'iscrizioni'
      and o.name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/ricevuta\.[a-z]+$'), '{}');
end $$;
revoke all on function richieste_con_ricevuta() from public, anon;
grant execute on function richieste_con_ricevuta() to authenticated;

notify pgrst, 'reload schema';
