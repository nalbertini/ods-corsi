-- ---------------------------------------------------------------------------
-- ODS Corsi · il vestiario come il modulo: tipi, foto e tabelle delle taglie
--
-- Il modulo Google divideva i capi in tre: JUDOGI, COSTUMINI LOTTA e
-- VESTIARIO LOGATO, ognuno con la sua tabella delle taglie, e ogni capo con la
-- sua foto. Qui lo stesso:
--   · ogni capo del catalogo può avere un «tipo» (judogi, costumini,
--     vestiario) e una «foto»; un capo senza tipo resta com'era;
--   · le tabelle delle taglie, una per tipo, in `impostazioni.vestiario_tabelle`;
--   · le immagini nel contenitore pubblico «vestiario»: il genitore le vede
--     dalla pagina pubblica senza accesso, dall'URL pubblico del contenitore.
--
-- Chi può cosa:
--   · `anon` legge tipi, foto e tabelle da `vestiario()`, come il catalogo, e
--     le immagini dall'URL pubblico; non elenca i file del contenitore (nessuna
--     policy di select per lui) e non ne carica.
--   · la segreteria (e il ruolo doppio) salva tipi, foto e tabelle da
--     `salva_vestiario()`, e carica, cambia e cancella le immagini.
--   · un istruttore, un iscritto, un tablet: niente.
--
-- Nel catalogo e nelle tabelle va solo il nome del file nel contenitore, mai
-- un indirizzo: l'URL lo fa l'app dal contenitore, così una foto non può
-- puntare fuori dalla palestra né risalire ad altri contenitori.
--
-- Si lancia dopo `47-vestiario.sql`, e non chiede di rilanciare
-- `06-iscrizioni.sql` (le firme di `vestiario()` e `salva_vestiario()` non
-- cambiano: il blocco del `06` che rimette `vestiario()` ad `anon` resta
-- buono). Se si rilancia il `47`, riporta le due funzioni a com'erano e
-- perde tipi, foto e tabelle al primo salvataggio: va rilanciato anche
-- questo. Finché non c'è, VESTIARIO dice che manca l'aggiornamento e la
-- pagina pubblica mostra il catalogo senza tipi né foto.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Il nome di un file del contenitore, con la stessa regola dell'app: lettere
-- e cifre senza accenti, «-» e «_», pezzi separati da un punto, e solo le
-- immagini che il contenitore accetta. Così niente cartelle, indirizzi, «..»,
-- spazi o caratteri che un URL deve cambiare. La usano `salva_vestiario()`,
-- i vincoli qui sotto (la segreteria può cambiare le impostazioni anche a
-- mano) e le policy del contenitore.
-- ---------------------------------------------------------------------------
create or replace function vestiario_nome_file(f text) returns boolean
  language sql immutable set search_path = public as $$
  select coalesce(length(f) <= 120 and f ~* '^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*\.(jpe?g|png|webp)$', false)
$$;

create or replace function vestiario_tabelle_ok(t jsonb) returns boolean
  language sql immutable set search_path = public as $$
  select jsonb_typeof(t) = 'object' and not exists (
    select 1 from jsonb_each(t) e
    where e.key not in ('judogi', 'costumini', 'vestiario')
       or jsonb_typeof(e.value) <> 'string'
       or not vestiario_nome_file(e.value #>> '{}'))
$$;

-- I capi del catalogo, anche scritti a mano: ognuno un oggetto, la foto (se
-- c'è) un nome di file valido, il tipo (se c'è) uno dei tre. Il resto lo
-- controlla `salva_vestiario()`, come nel 47.
create or replace function vestiario_capi_ok(capi jsonb) returns boolean
  language sql immutable set search_path = public as $$
  select not exists (
    select 1 from jsonb_array_elements(capi) c
    where jsonb_typeof(c) <> 'object'
       or (c ? 'foto' and (jsonb_typeof(c->'foto') <> 'string' or not vestiario_nome_file(c->>'foto')))
       or (c ? 'tipo' and coalesce(c->>'tipo', '') not in ('judogi', 'costumini', 'vestiario')))
$$;

-- I vincoli chiamano le funzioni con i permessi di chi scrive: la
-- segreteria che aggiorna le impostazioni (anche solo il listino) deve
-- poterle eseguire. Non leggono niente: sono solo regole sul testo.
revoke all on function vestiario_nome_file(text), vestiario_tabelle_ok(jsonb), vestiario_capi_ok(jsonb) from public, anon;
grant execute on function vestiario_nome_file(text), vestiario_tabelle_ok(jsonb), vestiario_capi_ok(jsonb) to authenticated;

-- Il 47 garantisce già che `vestiario` sia un array: qui solo i capi.
alter table impostazioni drop constraint if exists impostazioni_vestiario_capi_check;
alter table impostazioni add constraint impostazioni_vestiario_capi_check
  check (vestiario is null or jsonb_typeof(vestiario) <> 'array' or vestiario_capi_ok(vestiario));

alter table impostazioni add column if not exists vestiario_tabelle jsonb;
alter table impostazioni drop constraint if exists impostazioni_vestiario_tabelle_check;
alter table impostazioni add constraint impostazioni_vestiario_tabelle_check
  check (vestiario_tabelle is null or (octet_length(vestiario_tabelle::text) <= 1000 and vestiario_tabelle_ok(vestiario_tabelle)));

-- ---------------------------------------------------------------------------
-- Il contenitore delle immagini. Pubblico perché la pagina del genitore non
-- ha un accesso: chi conosce il nome del file lo scarica dall'URL pubblico,
-- che non passa dalle policy. Elencare i file invece passa da
-- `storage.objects`, e lì `anon` non ha nessuna policy di select.
-- 1 MB basta a una foto di un capo ridotta dall'app.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vestiario', 'vestiario', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Solo la segreteria carica, cambia e cancella, e solo con un nome che il
-- catalogo accetta: un file che non è una foto del catalogo (una pagina
-- .html, una cartella) non entra in un contenitore pubblico. La select serve
-- allo staff perché update e delete trovino le righe (senza, vanno a vuoto).
drop policy if exists vestiario_carica on storage.objects;
drop policy if exists vestiario_legge on storage.objects;
drop policy if exists vestiario_cambia on storage.objects;
drop policy if exists vestiario_cancella on storage.objects;
create policy vestiario_carica on storage.objects for insert to authenticated
  with check (bucket_id = 'vestiario' and public.e_staff() and public.vestiario_nome_file(name));
create policy vestiario_legge on storage.objects for select to authenticated
  using (bucket_id = 'vestiario' and public.e_staff());
create policy vestiario_cambia on storage.objects for update to authenticated
  using (bucket_id = 'vestiario' and public.e_staff())
  with check (bucket_id = 'vestiario' and public.e_staff() and public.vestiario_nome_file(name));
create policy vestiario_cancella on storage.objects for delete to authenticated
  using (bucket_id = 'vestiario' and public.e_staff());

-- ---------------------------------------------------------------------------
-- Per la pagina pubblica: come nel 47, più le tabelle delle taglie. Tipo e
-- foto sono già dentro i capi.
-- ---------------------------------------------------------------------------
create or replace function vestiario() returns jsonb
  language sql stable security definer set search_path = public, extensions as $$
  with r as (select (vestiario_raccolta()).chiude),
       c as (select coalesce((select vestiario from public.impostazioni where id), '[]') as capi,
                    coalesce((select vestiario_tabelle from public.impostazioni where id), '{}') as tabelle)
  select jsonb_build_object(
    'chiude', r.chiude,
    'capi', c.capi,
    'tabelle', c.tabelle,
    'aperti', coalesce(r.chiude >= vestiario_oggi() and jsonb_array_length(c.capi) > 0, false))
  from r, c
$$;

-- ---------------------------------------------------------------------------
-- La segreteria salva catalogo, data e tabelle. Le regole e i messaggi del
-- 47, più tipo e foto di ogni capo e le tabelle delle taglie. Senza la
-- chiave `tabelle` le tabelle restano com'erano (un'app vecchia non le
-- cancella); con un oggetto vuoto si tolgono.
-- ---------------------------------------------------------------------------
create or replace function salva_vestiario(catalogo jsonb) returns uuid
  language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  regole jsonb := vestiario_regole();
  -- I nomi che la segreteria legge in VESTIARIO, per dire quale tabella non va.
  nomi_tipi constant jsonb := '{"judogi": "JUDOGI", "costumini": "COSTUMINI LOTTA", "vestiario": "VESTIARIO LOGATO"}';
  capi jsonb := '[]';
  c jsonb;
  nome text;
  tipo text;
  foto text;
  taglie jsonb;
  prezzo numeric;
  data date;
  tabelle jsonb;
  tab record;
  adesso raccolte_vestiario;
  esito uuid;
begin
  if not e_staff() then raise exception 'Solo la segreteria cambia il catalogo del vestiario' using errcode = '42501'; end if;
  if jsonb_typeof(catalogo) is distinct from 'object' or jsonb_typeof(coalesce(catalogo->'capi', '[]')) <> 'array' then
    raise exception 'Il catalogo non si capisce: ricarica la pagina' using errcode = '22023';
  end if;
  begin
    data := (catalogo->>'chiude')::date;
  exception when others then
    raise exception 'La data di chiusura non sembra una data' using errcode = '22023';
  end;
  if jsonb_array_length(coalesce(catalogo->'capi', '[]')) > (regole->>'capi')::int then
    raise exception 'Il catalogo ha al massimo % capi', regole->>'capi' using errcode = '22023';
  end if;

  -- Le tabelle prima dei capi: una chiave che non è un tipo dice poco su
  -- quale capo guardare, quindi il messaggio è generico.
  tabelle := nullif(catalogo->'tabelle', 'null');
  if tabelle is not null then
    if jsonb_typeof(tabelle) <> 'object' then
      raise exception 'La tabella delle taglie non si capisce: ricaricala' using errcode = '22023';
    end if;
    for tab in select * from jsonb_each(tabelle) loop
      if not nomi_tipi ? tab.key then
        raise exception 'La tabella delle taglie non si capisce: ricaricala' using errcode = '22023';
      end if;
      if jsonb_typeof(tab.value) <> 'string' or not vestiario_nome_file(tab.value #>> '{}') then
        raise exception 'La tabella delle taglie di "%" non si capisce: ricaricala', nomi_tipi->>tab.key using errcode = '22023';
      end if;
    end loop;
  end if;

  for c in select * from jsonb_array_elements(coalesce(catalogo->'capi', '[]')) loop
    nome := trim(coalesce(c->>'capo', ''));
    if nome = '' then raise exception 'Ogni capo ha un nome' using errcode = '22023'; end if;
    if length(nome) > 80 then raise exception 'Il nome del capo «%» è troppo lungo', left(nome, 80) using errcode = '22023'; end if;
    -- Senza badare alle maiuscole: «Judogi» e «judogi» al genitore sembrano uno.
    if exists (select 1 from jsonb_array_elements(capi) x where lower(x->>'capo') = lower(nome)) then
      raise exception '«%» c''è due volte: due prezzi sono due capi, con due nomi diversi', nome using errcode = '22023';
    end if;
    begin
      prezzo := (c->>'prezzo')::numeric;
    exception when others then
      prezzo := null;
    end;
    -- Al centesimo: la colonna delle righe ne tiene due, e 35 resta 35, non 35.00.
    if prezzo is null or prezzo = 'NaN' or prezzo <= 0 or prezzo > 9999 or prezzo <> round(prezzo, 2) then
      raise exception '«%» non ha un prezzo', nome using errcode = '22023';
    end if;
    -- Le taglie: testi non vuoti, ognuna una volta, nell'ordine scritto
    -- dalla segreteria (120, 130, 140; S, M, L), non alfabetico.
    select coalesce(jsonb_agg(t order by n), '[]') into taglie from (
      select trim(t) t, min(n) n
      from jsonb_array_elements_text(case when jsonb_typeof(c->'taglie') = 'array' then c->'taglie' else '[]' end)
           with ordinality x(t, n)
      where trim(t) <> '' group by trim(t)
    ) y;
    if jsonb_array_length(taglie) = 0 then
      raise exception '«%» non ha taglie: scrivile separate da virgola', nome using errcode = '22023';
    end if;
    if jsonb_array_length(taglie) > (regole->>'taglie_per_capo')::int
       or exists (select 1 from jsonb_array_elements_text(taglie) t where length(t) > 20) then
      raise exception 'Le taglie del capo «%» sono troppe o troppo lunghe', nome using errcode = '22023';
    end if;
    -- Tipo e foto facoltativi: vuoti o assenti, il capo resta senza.
    tipo := nullif(trim(coalesce(c->>'tipo', '')), '');
    if tipo is not null and not nomi_tipi ? tipo then
      raise exception '"%": il tipo non si capisce', nome using errcode = '22023';
    end if;
    foto := nullif(trim(coalesce(c->>'foto', '')), '');
    if foto is not null and not vestiario_nome_file(foto) then
      raise exception 'La foto di "%" non si capisce: ricaricala', nome using errcode = '22023';
    end if;
    capi := capi || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'capo', nome, 'taglie', taglie, 'prezzo', prezzo,
      'nota', nullif(left(trim(coalesce(c->>'nota', '')), 300), ''),
      'tipo', tipo, 'foto', foto)));
  end loop;

  update impostazioni set vestiario = capi,
    vestiario_tabelle = case when catalogo ? 'tabelle' then tabelle else vestiario_tabelle end
  where id;
  adesso := vestiario_raccolta();
  -- Senza data, o con la stessa, cambia solo il catalogo: la raccolta tiene
  -- la sua data e i suoi ordini (togliere la data non chiude né apre niente).
  if data is null or data is not distinct from adesso.chiude then
    return adesso.id;
  end if;
  if adesso.chiude >= vestiario_oggi() then
    update raccolte_vestiario set chiude = data where id = adesso.id returning id into esito;
  else
    insert into raccolte_vestiario (chiude) values (data) returning id into esito;
  end if;
  return esito;
end $$;

-- I permessi come nel 47: `create or replace` li tiene, ma rilanciato su un
-- database dove qualcuno li ha toccati li rimette a posto.
revoke all on function vestiario(), salva_vestiario(jsonb) from public, anon;
grant execute on function vestiario() to anon, authenticated;
grant execute on function salva_vestiario(jsonb) to authenticated;

notify pgrst, 'reload schema';
