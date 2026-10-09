-- ---------------------------------------------------------------------------
-- ODS Corsi · gli ordini di vestiario, judogi e costumini
--
-- Al posto del modulo Google: la segreteria tiene il catalogo (capo, taglie,
-- prezzo, nota) e la data di chiusura da VESTIARIO; il genitore ordina dal
-- link pubblico fino a quella data compresa; la segreteria vede gli ordini,
-- li segna saldati, li annulla, li sposta, ne corregge le righe e ne scrive
-- dal banco, anche a raccolta chiusa.
--
-- Chi può cosa:
--   · `anon` non vede nessuna tabella. Chiama solo `vestiario()` (catalogo,
--     data, aperti o no) e `invia_ordine_vestiario()` (un ordine, controllato
--     qui: chi chiama l'API con la chiave pubblica salta la pagina, non
--     questa funzione). Un ordine mandato non si rilegge da lì.
--   · la segreteria (e il ruolo doppio) legge le tre tabelle, cambia a mano
--     annullato e raccolta di un ordine, e passa dalle funzioni per il
--     resto: `salva_vestiario`, `segna_vestiario`, `scrivi_ordine_vestiario`,
--     `correggi_ordine_vestiario`. Prezzi e totale li mette sempre il
--     database, dal catalogo.
--   · un istruttore, un iscritto, un tablet: niente (le policy danno 0 righe).
--
-- Il catalogo sta in `impostazioni.vestiario`, come il listino (19): è uno
-- solo, quello di adesso. La data di chiusura sta invece nella raccolta,
-- perché gli ordini appartengono alla raccolta in cui arrivano e una data
-- nuova, a raccolta chiusa, ne apre un'altra. Le righe tengono il prezzo con
-- cui sono entrate: il catalogo che cambia non tocca gli ordini già fatti.
--
-- Si lancia dopo `06-iscrizioni.sql`, e non chiede di rilanciarlo. Se lo si
-- rilancia dopo, toglie ad `anon` `vestiario()` e `invia_ordine_vestiario()`:
-- va rilanciato anche questo. Finché non c'è, la pagina pubblica dice «ordini
-- non ancora aperti» e VESTIARIO dice cosa manca.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Il catalogo: un elenco di capi, scritto da `salva_vestiario()`, che lo
-- controlla. Qui solo la forma e la misura, come il listino: la riga delle
-- impostazioni la può cambiare la segreteria anche a mano.
-- ---------------------------------------------------------------------------
alter table impostazioni add column if not exists vestiario jsonb;
alter table impostazioni drop constraint if exists impostazioni_vestiario_check;
alter table impostazioni add constraint impostazioni_vestiario_check
  check (vestiario is null or (jsonb_typeof(vestiario) = 'array' and octet_length(vestiario::text) <= 60000));

-- ---------------------------------------------------------------------------
-- Le raccolte: una per data di chiusura, con un suo id perché una proroga
-- sposta la data e gli ordini restano dentro. La più recente è quella di
-- adesso. Nasce sempre con una data: `salva_vestiario()` senza data non
-- ne apre.
-- ---------------------------------------------------------------------------
create table if not exists raccolte_vestiario (
  id        uuid primary key default gen_random_uuid(),
  -- clock_timestamp e non now(): due raccolte nella stessa transazione
  -- devono comunque avere un ordine.
  creata_il timestamptz not null default clock_timestamp(),
  chiude    date not null
);
create index if not exists raccolte_vestiario_quando on raccolte_vestiario (creata_il desc);

create table if not exists ordini_vestiario (
  id          uuid primary key default gen_random_uuid(),
  creato_il   timestamptz not null default now(),
  raccolta_id uuid not null references raccolte_vestiario on delete restrict,
  nome        text not null check (length(trim(nome)) between 1 and 80),
  cognome     text not null check (length(trim(cognome)) between 1 and 80),
  telefono    text not null check (length(regexp_replace(telefono, '\D', '', 'g')) between 6 and 15 and length(telefono) <= 30),
  email       citext check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 160),
  totale      numeric(10, 2) not null check (totale >= 0),
  saldato     boolean not null default false,
  annullato   boolean not null default false,
  -- Quanto è già arrivato, e come e quando: segnato saldato è il totale.
  -- Togliendo il segno dopo una correzione resta quello di prima, così la
  -- segreteria vede quanto manca (totale − pagato).
  pagato      numeric(10, 2) not null default 0 check (pagato >= 0),
  pagato_con  text check (pagato_con in ('bonifico', 'satispay', 'contanti')),
  pagato_il   date,
  -- Scritto dalla segreteria al banco: non conta per il limite del link.
  dal_banco   boolean not null default false
);
create index if not exists ordini_vestiario_raccolta on ordini_vestiario (raccolta_id, creato_il);

create table if not exists righe_vestiario (
  id        uuid primary key default gen_random_uuid(),
  ordine_id uuid not null references ordini_vestiario on delete cascade,
  per_chi   text not null check (length(trim(per_chi)) between 1 and 160),
  capo      text not null check (length(trim(capo)) between 1 and 80),
  taglia    text not null check (length(trim(taglia)) between 1 and 20),
  quanti    int not null check (quanti between 1 and 10),
  prezzo    numeric(8, 2) not null check (prezzo > 0),
  -- L'ordine in cui le righe sono state scritte: il riepilogo e la
  -- segreteria le rileggono così, non in un ordine a caso.
  posizione int not null
);
create index if not exists righe_vestiario_ordine on righe_vestiario (ordine_id);

-- Le vede solo la segreteria: dentro ci sono nomi e telefoni di famiglie, e
-- agli istruttori per l'appello non servono. Nessuna policy di inserimento:
-- gli ordini entrano solo dalle funzioni, che mettono prezzi e totale.
-- Sugli ordini la segreteria cambia a mano solo annullato e raccolta (le
-- colonne del grant): saldato e pagato insieme, da `segna_vestiario()`, che
-- li tiene d'accordo. Nessuno cancella un ordine o cambia una
-- riga da fuori, segreteria compresa: le righe si correggono da
-- `correggi_ordine_vestiario()`, che ricalcola il totale, e un ordine si
-- annulla invece di sparire.
alter table raccolte_vestiario enable row level security;
alter table ordini_vestiario enable row level security;
alter table righe_vestiario enable row level security;
drop policy if exists raccolte_vestiario_legge on raccolte_vestiario;
drop policy if exists ordini_vestiario_legge on ordini_vestiario;
drop policy if exists ordini_vestiario_aggiorna on ordini_vestiario;
drop policy if exists righe_vestiario_legge on righe_vestiario;
create policy raccolte_vestiario_legge on raccolte_vestiario for select to authenticated using (e_staff());
create policy ordini_vestiario_legge on ordini_vestiario for select to authenticated using (e_staff());
create policy ordini_vestiario_aggiorna on ordini_vestiario for update to authenticated using (e_staff()) with check (e_staff());
create policy righe_vestiario_legge on righe_vestiario for select to authenticated using (e_staff());
revoke all on raccolte_vestiario, ordini_vestiario, righe_vestiario from anon, authenticated;
grant select on raccolte_vestiario to authenticated;
grant select on ordini_vestiario to authenticated;
grant update (annullato, raccolta_id) on ordini_vestiario to authenticated;
grant select on righe_vestiario to authenticated;

-- ---------------------------------------------------------------------------
-- Quanto è aperta la porta, come per le iscrizioni: un ordine senza accesso
-- lo può mandare anche un programma. Le annullate non contano: chi riempie la
-- raccolta di ordini finti, la segreteria la sblocca annullandoli.
-- ---------------------------------------------------------------------------
create or replace function vestiario_regole() returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_object(
    'righe_per_ordine', 20,   -- una famiglia numerosa, con un capo di ogni tipo
    'quanti_per_riga', 10,    -- lo stesso di MAX_QUANTI in src/lib/vestiario.ts
    'per_telefono_all_ora', 3, -- una famiglia che si è dimenticata un capo, non un programma
    'in_tutto_all_ora', 60,   -- più di quanti ne arrivano in una sera di settembre
    'byte', 65536,            -- un ordine vero di 20 righe sta sotto i 10 kB
    'capi', 50,
    'taglie_per_capo', 30
  )
$$;

-- La data in palestra: il database di Supabase conta in UTC, e «chiude oggi»
-- vuol dire fino a mezzanotte a Firenze, non all'una.
create or replace function vestiario_oggi() returns date language sql stable set search_path = public as $$
  select (now() at time zone 'Europe/Rome')::date
$$;

create or replace function vestiario_raccolta() returns raccolte_vestiario
  language sql stable set search_path = public as $$
  select * from public.raccolte_vestiario order by creata_il desc limit 1
$$;

-- Le cifre di un telefono, senza il prefisso dell'Italia: «+39 347 000 1111»,
-- «0039 3470001111» e «347-0001111» sono lo stesso numero. Il prefisso si
-- toglie solo se resta un numero italiano (9 o 10 cifre): un 39 che fa parte
-- del numero resta.
create or replace function vestiario_cifre(tel text) returns text
  language sql immutable set search_path = public as $$
  select case when c ~ '^(0039|39)' and length(regexp_replace(c, '^(0039|39)', '')) between 9 and 10
              then regexp_replace(c, '^(0039|39)', '') else c end
  from (select regexp_replace(coalesce(tel, ''), '\D', '', 'g') c) x
$$;

-- Un ordine com'è salvato, per la risposta a chi l'ha mandato: righe
-- nell'ordine scritto.
create or replace function vestiario_ordine(ordine uuid) returns jsonb
  language sql stable set search_path = public as $$
  select jsonb_build_object('id', o.id, 'totale', o.totale, 'righe', coalesce((
    select jsonb_agg(jsonb_build_object('per_chi', r.per_chi, 'capo', r.capo, 'taglia', r.taglia, 'quanti', r.quanti, 'prezzo', r.prezzo)
                     order by r.posizione)
    from public.righe_vestiario r where r.ordine_id = o.id), '[]'))
  from public.ordini_vestiario o where o.id = ordine
$$;

-- ---------------------------------------------------------------------------
-- Una riga d'ordine, controllata sul catalogo: dà il prezzo del capo, o dice
-- cosa non va. Le stesse regole e gli stessi messaggi di `src/lib/vestiario.ts`.
-- ---------------------------------------------------------------------------
create or replace function vestiario_riga(r jsonb, capi jsonb,
  out per_chi text, out capo text, out taglia text, out quanti int, out prezzo numeric)
  language plpgsql stable set search_path = public as $$
declare
  voce jsonb;
  massimo int := (vestiario_regole()->>'quanti_per_riga')::int;
begin
  if jsonb_typeof(r) is distinct from 'object' then
    raise exception 'Una riga dell''ordine non si capisce: ricarica la pagina' using errcode = '22023';
  end if;
  per_chi := trim(coalesce(r->>'per_chi', ''));
  capo := trim(coalesce(r->>'capo', ''));
  taglia := trim(coalesce(r->>'taglia', ''));
  if per_chi = '' then
    raise exception 'Scrivi per chi è ogni capo: nome e cognome del bambino' using errcode = '22023';
  end if;
  if length(per_chi) > 160 then
    raise exception 'Un campo non va: «per chi» è troppo lungo' using errcode = '22023';
  end if;
  select c into voce from jsonb_array_elements(coalesce(capi, '[]')) c where c->>'capo' = capo limit 1;
  if voce is null then
    raise exception '«%» non è nel catalogo: ricarica la pagina', left(capo, 80) using errcode = '22023';
  end if;
  if not coalesce(voce->'taglie' ? taglia, false) then
    raise exception '%: la taglia % non c''è, scegline una del catalogo', capo, left(taglia, 20) using errcode = '22023';
  end if;
  begin
    quanti := (r->>'quanti')::int;
  exception when others then
    quanti := null;
  end;
  if quanti is null or quanti not between 1 and massimo then
    raise exception 'La quantità va da 1 a %', massimo using errcode = '22023';
  end if;
  -- Il catalogo lo può cambiare la segreteria anche a mano, saltando
  -- `salva_vestiario()`: un prezzo storto si dice, non diventa un totale.
  begin
    prezzo := (voce->>'prezzo')::numeric;
  exception when others then
    prezzo := null;
  end;
  if prezzo is null or prezzo = 'NaN' or prezzo <= 0 or prezzo > 9999 or prezzo <> round(prezzo, 2) then
    raise exception '«%» non ha un prezzo giusto: avvisa la segreteria', capo using errcode = '22023';
  end if;
end $$;

-- Chi ordina: nome, cognome, telefono obbligatori, email facoltativa.
-- Il telefono come nelle iscrizioni: è quello che la segreteria chiama.
create or replace function vestiario_contatto(dati jsonb) returns void
  language plpgsql immutable set search_path = public as $$
declare
  tel text := trim(coalesce(dati->>'telefono', ''));
  mail text := nullif(lower(trim(coalesce(dati->>'email', ''))), '');
begin
  if coalesce(trim(dati->>'nome'), '') = '' or coalesce(trim(dati->>'cognome'), '') = '' then
    raise exception 'Scrivi nome e cognome di chi ordina' using errcode = '22023';
  end if;
  if length(trim(dati->>'nome')) > 80 or length(trim(dati->>'cognome')) > 80 then
    raise exception 'Un campo non va: nome e cognome sono troppo lunghi' using errcode = '22023';
  end if;
  if tel = '' then
    raise exception 'Serve un telefono: la segreteria chiama chi non ha saldato' using errcode = '22023';
  end if;
  if tel !~ '^\+?[0-9 ./()-]+$' or length(tel) > 30 or length(regexp_replace(tel, '\D', '', 'g')) not between 6 and 15 then
    raise exception 'Il telefono non sembra giusto: servono da 6 a 15 cifre (spazi e + davanti vanno bene)' using errcode = '22023';
  end if;
  if mail is not null and (mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(mail) > 160) then
    raise exception 'L''email non sembra giusta: scrivila come nome@esempio.it' using errcode = '22023';
  end if;
end $$;

-- Un ordine nuovo nella raccolta data: contatto e righe controllati, prezzi
-- e totale dal catalogo. Quello che il client manda come prezzo o totale non
-- si legge nemmeno.
create or replace function vestiario_nuovo_ordine(dati jsonb, raccolta uuid, banco boolean, scelto uuid default null) returns jsonb
  language plpgsql volatile set search_path = public as $$
declare
  capi jsonb := coalesce((select vestiario from public.impostazioni where id), '[]');
  r jsonb;
  n int;
  v record;
  nuovo uuid;
  tot numeric := 0;
begin
  perform vestiario_contatto(dati);
  if jsonb_typeof(dati->'righe') is distinct from 'array' or jsonb_array_length(dati->'righe') = 0 then
    raise exception 'Serve almeno un capo' using errcode = '22023';
  end if;
  if jsonb_array_length(dati->'righe') > (vestiario_regole()->>'righe_per_ordine')::int then
    raise exception 'Un ordine ha al massimo % righe: dividilo in due', vestiario_regole()->>'righe_per_ordine' using errcode = '22023';
  end if;
  -- Prima tutte le righe controllate, poi si scrive: un ordine entra intero o niente.
  for r in select * from jsonb_array_elements(dati->'righe') loop
    v := vestiario_riga(r, capi);
  end loop;
  insert into ordini_vestiario (id, raccolta_id, nome, cognome, telefono, email, totale, dal_banco)
  values (coalesce(scelto, gen_random_uuid()), raccolta, trim(dati->>'nome'), trim(dati->>'cognome'), trim(dati->>'telefono'),
          nullif(lower(trim(coalesce(dati->>'email', ''))), ''), 0, banco)
  returning id into nuovo;
  for r, n in select * from jsonb_array_elements(dati->'righe') with ordinality loop
    v := vestiario_riga(r, capi);
    insert into righe_vestiario (ordine_id, per_chi, capo, taglia, quanti, prezzo, posizione)
    values (nuovo, v.per_chi, v.capo, v.taglia, v.quanti, v.prezzo, n);
    tot := tot + v.quanti * v.prezzo;
  end loop;
  update ordini_vestiario set totale = tot where id = nuovo;
  return vestiario_ordine(nuovo);
end $$;

-- L'id di un ordine lo sceglie il dispositivo: se la risposta si perde per
-- strada e l'ordine parte di nuovo, entra una volta sola. Dà l'id scelto
-- (null se non c'è) e, se quell'ordine c'è già e il telefono è lo stesso,
-- quello salvato così com'è. Con un altro telefono rifiuta, senza farne
-- vedere niente.
create or replace function vestiario_gia_mandato(dati jsonb, out scelto uuid, out gia jsonb)
  language plpgsql stable set search_path = public as $$
declare
  salvato ordini_vestiario;
begin
  begin
    scelto := nullif(trim(coalesce(dati->>'id', '')), '')::uuid;
  exception when others then
    raise exception 'L''ordine non si capisce: ricarica la pagina' using errcode = '22023';
  end;
  if scelto is null then return; end if;
  select * into salvato from public.ordini_vestiario where id = scelto;
  if salvato.id is null then return; end if;
  if vestiario_cifre(salvato.telefono) is distinct from vestiario_cifre(dati->>'telefono') then
    raise exception 'Quest''ordine non si può rimandare: ricarica la pagina e rifallo' using errcode = '22023';
  end if;
  gia := vestiario_ordine(salvato.id);
end $$;

-- ---------------------------------------------------------------------------
-- Per la pagina pubblica: il catalogo, la data, e se si può ordinare.
-- Aperti fino alla data compresa, e solo con una data e almeno un capo.
-- ---------------------------------------------------------------------------
create or replace function vestiario() returns jsonb
  language sql stable security definer set search_path = public, extensions as $$
  with r as (select (vestiario_raccolta()).chiude),
       c as (select coalesce((select vestiario from public.impostazioni where id), '[]') as capi)
  select jsonb_build_object(
    'chiude', r.chiude,
    'capi', c.capi,
    'aperti', coalesce(r.chiude >= vestiario_oggi() and jsonb_array_length(c.capi) > 0, false))
  from r, c
$$;

-- ---------------------------------------------------------------------------
-- La segreteria salva catalogo e data. Senza data, o con la data di adesso,
-- si salva solo il catalogo. Con una data diversa e la raccolta di adesso
-- ancora aperta (data non passata) è una proroga: stessa raccolta, anche se
-- la data va indietro. Con la raccolta chiusa, o senza raccolte, se ne apre
-- una nuova. Restituisce la raccolta di adesso (null se non ce n'è).
-- ---------------------------------------------------------------------------
create or replace function salva_vestiario(catalogo jsonb) returns uuid
  language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  regole jsonb := vestiario_regole();
  capi jsonb := '[]';
  c jsonb;
  nome text;
  taglie jsonb;
  prezzo numeric;
  data date;
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
    capi := capi || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'capo', nome, 'taglie', taglie, 'prezzo', prezzo,
      'nota', nullif(left(trim(coalesce(c->>'nota', '')), 300), ''))));
  end loop;

  update impostazioni set vestiario = capi where id;
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

-- ---------------------------------------------------------------------------
-- Il genitore manda un ordine dalla pagina pubblica: entra nella raccolta di
-- adesso, se è aperta. Risponde con quello che serve al riepilogo.
-- ---------------------------------------------------------------------------
create or replace function invia_ordine_vestiario(dati jsonb) returns jsonb
  language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  adesso raccolte_vestiario;
  scelto uuid;
  gia jsonb;
begin
  -- Prima della fila, quello che costa poco: una richiesta enorme (fatta
  -- apposta, non dalla pagina) si rifiuta qui, senza tenere il turno mentre
  -- la si legge e fermare gli ordini veri. pg_column_size non la legge tutta.
  if pg_column_size(dati) > (vestiario_regole()->>'byte')::int then
    raise exception 'L''ordine è troppo grande: ricarica la pagina e rifallo' using errcode = '22023';
  end if;
  if jsonb_typeof(dati->'righe') = 'array' and jsonb_array_length(dati->'righe') > (vestiario_regole()->>'righe_per_ordine')::int then
    raise exception 'Un ordine ha al massimo % righe: dividilo in due', vestiario_regole()->>'righe_per_ordine' using errcode = '22023';
  end if;
  -- In fila: due invii insieme passerebbero tutti e due i limiti qui sotto
  -- (e lo stesso id due volte), contando gli stessi ordini di prima.
  perform pg_advisory_xact_lock(hashtext('invia_ordine_vestiario'));
  adesso := vestiario_raccolta();
  if jsonb_typeof(dati) is distinct from 'object' then
    raise exception 'L''ordine non si capisce: ricarica la pagina' using errcode = '22023';
  end if;
  select * into scelto, gia from vestiario_gia_mandato(dati);
  if gia is not null then return gia; end if;
  if not coalesce((vestiario()->>'aperti')::boolean, false) then
    raise exception 'Gli ordini sono chiusi: per un ordine fuori tempo chiama la segreteria' using errcode = '22023';
  end if;
  -- Lo stesso telefono, contato sulle cifre senza prefisso: «333 123 4567»,
  -- «3331234567» e «+39 333 1234567» sono uno.
  if (select count(*) from ordini_vestiario
      where creato_il > now() - interval '1 hour' and not annullato
        and vestiario_cifre(telefono) = vestiario_cifre(dati->>'telefono'))
     >= (vestiario_regole()->>'per_telefono_all_ora')::int then
    raise exception 'Da questo telefono sono già arrivati % ordini nell''ultima ora: per altro chiama la segreteria',
      vestiario_regole()->>'per_telefono_all_ora' using errcode = '54000';
  end if;
  -- Quelli scritti dal banco non contano: il limite è per il link pubblico.
  if (select count(*) from ordini_vestiario where creato_il > now() - interval '1 hour' and not annullato and not dal_banco)
     >= (vestiario_regole()->>'in_tutto_all_ora')::int then
    raise exception 'In questo momento arrivano troppi ordini: riprova fra un po''' using errcode = '54000';
  end if;
  return vestiario_nuovo_ordine(dati, adesso.id, false, scelto);
end $$;

-- ---------------------------------------------------------------------------
-- SALDATO e il suo contrario. Con `come`: saldato, pagato il totale, con quel
-- mezzo, oggi. Senza: da saldare, e pagato, come e quando tornano vuoti;
-- tranne con `tieni_pagato` (TOGLI IL SEGNO dopo una correzione), che lascia
-- quel che era già arrivato. Un annullato non si segna.
-- ---------------------------------------------------------------------------
create or replace function segna_vestiario(ordine uuid, come text, tieni_pagato boolean default false) returns void
  language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  o ordini_vestiario;
begin
  if not e_staff() then raise exception 'Solo la segreteria segna un ordine' using errcode = '42501'; end if;
  select * into o from ordini_vestiario where id = ordine for update;
  if o.id is null then raise exception 'L''ordine non c''è più: ricarica la pagina' using errcode = '22023'; end if;
  if o.annullato then raise exception 'Rimetti l''ordine prima di segnarlo' using errcode = '22023'; end if;
  if come is not null then
    if come not in ('bonifico', 'satispay', 'contanti') then
      raise exception 'Scegli come ha pagato: bonifico, Satispay o contanti' using errcode = '22023';
    end if;
    update ordini_vestiario set saldato = true, pagato = totale, pagato_con = come, pagato_il = vestiario_oggi() where id = ordine;
  elsif coalesce(tieni_pagato, false) then
    update ordini_vestiario set saldato = false where id = ordine;
  else
    update ordini_vestiario set saldato = false, pagato = 0, pagato_con = null, pagato_il = null where id = ordine;
  end if;
end $$;

-- La segreteria scrive un ordine dal banco: nella raccolta più recente,
-- anche chiusa, con le stesse regole sulle righe. `come` nullo: da saldare;
-- se no già saldato, pagato così.
drop function if exists scrivi_ordine_vestiario(jsonb, boolean);
create or replace function scrivi_ordine_vestiario(dati jsonb, come text) returns uuid
  language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  adesso raccolte_vestiario := vestiario_raccolta();
  scelto uuid;
  gia jsonb;
begin
  if not e_staff() then raise exception 'Solo la segreteria scrive un ordine dal banco' using errcode = '42501'; end if;
  if adesso.id is null then
    raise exception 'Non c''è ancora una raccolta: salva prima il catalogo con la data di chiusura' using errcode = '22023';
  end if;
  if jsonb_typeof(dati) is distinct from 'object' then
    raise exception 'L''ordine non si capisce: ricarica la pagina' using errcode = '22023';
  end if;
  -- Lo stesso ordine salvato due volte dal banco (la rete che cade) entra una volta.
  select * into scelto, gia from vestiario_gia_mandato(dati);
  if gia is not null then return (gia->>'id')::uuid; end if;
  if come is not null and come not in ('bonifico', 'satispay', 'contanti') then
    raise exception 'Scegli come ha pagato: bonifico, Satispay o contanti' using errcode = '22023';
  end if;
  scelto := (vestiario_nuovo_ordine(dati, adesso.id, true, scelto)->>'id')::uuid;
  if come is not null then perform segna_vestiario(scelto, come); end if;
  return scelto;
end $$;

-- ---------------------------------------------------------------------------
-- La segreteria corregge le righe di un ordine: quelle che manda sono tutte
-- le righe. Una riga con l'id di una che c'era tiene il suo prezzo (se il
-- capo resta lo stesso: un capo cambiato prende il prezzo di adesso), e con
-- capo e taglia invariati non si ricontrolla sul catalogo, che intanto può
-- averli tolti. Una riga senza id è nuova, col prezzo di adesso. Quelle che
-- non ci sono più si tolgono. Zero righe no: l'ordine si annulla. Restituisce
-- il totale nuovo.
-- ---------------------------------------------------------------------------
drop function if exists correggi_ordine_vestiario(uuid, jsonb);
create or replace function correggi_ordine_vestiario(ordine uuid, righe jsonb, togli_segno boolean default false) returns numeric
  language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  capi jsonb := coalesce((select vestiario from public.impostazioni where id), '[]');
  r jsonb;
  v record;
  vecchia righe_vestiario;
  tenute uuid[] := '{}';
  quale uuid;
  n int;
  tot numeric;
  prima numeric;
begin
  if not e_staff() then raise exception 'Solo la segreteria corregge un ordine' using errcode = '42501'; end if;
  select totale into prima from ordini_vestiario where id = ordine for update;
  if not found then raise exception 'L''ordine non c''è più: ricarica la pagina' using errcode = '22023'; end if;
  if jsonb_typeof(righe) is distinct from 'array' or jsonb_array_length(righe) = 0 then
    -- Per togliere tutto, la segreteria annulla l'ordine: resta visibile.
    raise exception 'Serve almeno un capo' using errcode = '22023';
  end if;
  if jsonb_array_length(righe) > (vestiario_regole()->>'righe_per_ordine')::int then
    raise exception 'Un ordine ha al massimo % righe: dividilo in due', vestiario_regole()->>'righe_per_ordine' using errcode = '22023';
  end if;

  -- La posizione è quella in cui le righe arrivano: la segreteria le manda
  -- tutte, nell'ordine che vede.
  for r, n in select * from jsonb_array_elements(righe) with ordinality loop
    vecchia := null;
    begin
      quale := nullif(r->>'id', '')::uuid;
    exception when others then
      quale := null;
    end;
    if quale is not null then
      select * into vecchia from righe_vestiario where id = quale and ordine_id = ordine;
      if vecchia.id is null then
        raise exception 'Una riga non è di quest''ordine: ricarica la pagina' using errcode = '22023';
      end if;
    end if;
    if vecchia.id is not null and trim(coalesce(r->>'capo', '')) = vecchia.capo and trim(coalesce(r->>'taglia', '')) = vecchia.taglia then
      -- Capo e taglia come prima: si controllano per chi e quantità e basta.
      v := vestiario_riga(r, jsonb_build_array(jsonb_build_object('capo', vecchia.capo, 'taglie', jsonb_build_array(vecchia.taglia), 'prezzo', vecchia.prezzo)));
    else
      v := vestiario_riga(r, capi);
    end if;
    if vecchia.id is not null then
      update righe_vestiario
      set per_chi = v.per_chi, capo = v.capo, taglia = v.taglia, quanti = v.quanti, posizione = n,
          prezzo = case when v.capo = vecchia.capo then vecchia.prezzo else v.prezzo end
      where id = vecchia.id;
      tenute := tenute || vecchia.id;
    else
      insert into righe_vestiario (ordine_id, per_chi, capo, taglia, quanti, prezzo, posizione)
      values (ordine, v.per_chi, v.capo, v.taglia, v.quanti, v.prezzo, n) returning id into quale;
      tenute := tenute || quale;
    end if;
  end loop;

  delete from righe_vestiario where ordine_id = ordine and id <> all (tenute);
  select sum(quanti * prezzo) into tot from righe_vestiario where ordine_id = ordine;
  -- Un saldato il cui totale cresce, con TOGLI IL SEGNO: torna da saldare e
  -- tiene quel che aveva pagato (il totale di prima, come e quando), così si
  -- vede quanto manca. Se no un saldato resta saldato: il pagato segue il
  -- totale nuovo. Nella stessa transazione della correzione.
  update ordini_vestiario
  set totale = tot,
      saldato = saldato and not (coalesce(togli_segno, false) and tot > prima),
      pagato = case when saldato and coalesce(togli_segno, false) and tot > prima then prima
                    when saldato then tot else pagato end
  where id = ordine;
  return tot;
end $$;

-- ---------------------------------------------------------------------------
-- I permessi. Gli aiuti qui dentro non li chiama nessuno da fuori: li usano
-- le funzioni sopra, che girano col proprietario.
-- ---------------------------------------------------------------------------
revoke all on function vestiario_regole(), vestiario_oggi(), vestiario_raccolta(), vestiario_riga(jsonb, jsonb),
  vestiario_contatto(jsonb), vestiario_nuovo_ordine(jsonb, uuid, boolean, uuid), vestiario_cifre(text), vestiario_ordine(uuid),
  vestiario_gia_mandato(jsonb)
  from public, anon, authenticated;
revoke all on function vestiario(), salva_vestiario(jsonb), invia_ordine_vestiario(jsonb),
  scrivi_ordine_vestiario(jsonb, text), correggi_ordine_vestiario(uuid, jsonb, boolean), segna_vestiario(uuid, text, boolean) from public, anon;
grant execute on function vestiario(), invia_ordine_vestiario(jsonb) to anon, authenticated;
grant execute on function salva_vestiario(jsonb), scrivi_ordine_vestiario(jsonb, text), correggi_ordine_vestiario(uuid, jsonb, boolean),
  segna_vestiario(uuid, text, boolean) to authenticated;

notify pgrst, 'reload schema';
