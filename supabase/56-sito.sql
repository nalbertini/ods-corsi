-- ---------------------------------------------------------------------------
-- ODS Corsi · il sito della palestra
--
-- Le pagine del sito pubblico (officinedellosport.it), il suo menu e il suo
-- footer, scritti dalla segreteria nel pannello SITO. Ogni pagina ha due
-- testi: la BOZZA, che la segreteria cambia quando vuole, e il PUBBLICATO,
-- che cambia solo PUBBLICA. Il sito vero si genera dal pubblicato.
--
-- Chi può cosa:
--   - la segreteria (`e_staff()`) legge tutto, scrive le bozze, pubblica, cambia
--     menu e footer, nasconde e cancella le pagine (non quelle di legge);
--   - chiunque, anche senza accesso, legge solo le pagine pubblicate e non
--     nascoste, per le due funzioni `sito_pagine_pubbliche()` e
--     `sito_menu_pubblico()`: mai una bozza, mai una pagina nascosta. Il
--     generatore del sito usa solo quelle.
--   - istruttori, tablet e iscritti non scrivono niente.
--
-- Il testo è HTML di un editor, e finisce su un sito pubblico: `sito_testo_sicuro()`
-- rifiuta quello che porta script, iframe, moduli, attributi `on…=`, `style=` o
-- link `javascript:`. L'app ripulisce prima di salvare, quindi il rifiuto scatta
-- solo a chi scrive all'API saltando il pannello. La pulizia vera, quella di
-- cui ci si fida, è comunque anche quando il sito si genera.
--
-- Una pagina cambiata da due persone insieme non perde il lavoro: chi salva per
-- secondo si sente dire che la pagina è cambiata (`versione`).
--
-- Si lancia dopo `02-policy.sql`. Non chiede di rilanciare `06-iscrizioni.sql`:
-- le funzioni qui hanno i loro permessi. Finché non c'è, SITO dice che il
-- pannello non è ancora attivo, e l'app si comporta come prima.
-- ---------------------------------------------------------------------------

-- Il testo non porta niente che su una pagina pubblica sarebbe codice.
create or replace function sito_testo_sicuro(t text) returns boolean
  language sql immutable set search_path = public as $$
  select t is null or (
    -- Un tag è «<» e poi virgolettati interi o caratteri che non chiudono: un «>» dentro un attributo
    -- fra virgolette non lo finisce, e non nasconde quello che viene dopo.
    t !~* '<\s*/?\s*(script|iframe|object|embed|form|style|svg|link|meta|base)\y'
    and t !~* '<(?:"[^"]*"|''[^'']*''|[^>"''])*(?<=[\s"''/])on[a-z]+\s*='
    and t !~* '<(?:"[^"]*"|''[^'']*''|[^>"''])*(?<=[\s"''/])style\s*='
    -- Un'entità dentro un attributo (&#106;avascript:, &colon;) non la scrive l'editor, tranne «&amp;»
    -- dei link con più parametri: chi la scrive vuole aggirare il filtro.
    and t !~* '<(?:"[^"]*"|''[^'']*''|[^>"''])*=\s*["'']?[^"''>]*&(#|(?!amp;)[a-z]+;)'
    -- Il browser ignora spazi, tab e a capo dentro «javascript:»: si guarda il testo senza.
    and regexp_replace(t, '[\s\x00-\x1f]', '', 'g') !~* '(href|src|formaction|action)=["'']?(javascript|vbscript|data):'
  )
$$;

create table if not exists sito_pagine (
  id            uuid primary key default gen_random_uuid(),
  -- L'indirizzo della pagina: officinedellosport.it/<slug>. «home» è la prima pagina.
  slug          text not null unique
                check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80
                       and slug not in ('contact', 'contattaci', 'privacy', 'cookie', 'admin', 'api', 'app', 'sitemap', 'robots')
                       or slug in ('privacy', 'cookie')),
  titolo        text not null check (char_length(btrim(titolo)) between 1 and 120),
  descrizione   text not null default '' check (char_length(descrizione) <= 300),
  -- Quelli che il sito mostra: cambiano solo con PUBBLICA, come il testo.
  titolo_pubblicato      text,
  descrizione_pubblicata text,
  bozza         text not null default '' check (char_length(bozza) <= 200000 and sito_testo_sicuro(bozza)),
  -- Vuoto finché non si pubblica la prima volta.
  pubblicato    text check (char_length(pubblicato) <= 200000 and sito_testo_sicuro(pubblicato)),
  nascosta      boolean not null default false,
  -- Privacy, cookie, contributi pubblici: non si nascondono né si cancellano.
  di_legge      boolean not null default false,
  -- Sale a ogni salvataggio: chi salva con una versione vecchia viene fermato.
  versione      integer not null default 1,
  pubblicata_il timestamptz,
  pubblicata_da uuid references persone on delete set null,
  modificata_il timestamptz not null default now(),
  constraint sito_pagine_legge_visibile check (not (di_legge and nascosta))
);

-- La voce di menu o di footer: porta a una pagina del sito o a un indirizzo.
create table if not exists sito_menu (
  id        uuid primary key default gen_random_uuid(),
  dove      text not null check (dove in ('menu', 'footer')),
  etichetta text not null check (char_length(btrim(etichetta)) between 1 and 60),
  -- Una pagina non si cancella finché è nel menu.
  pagina_id uuid references sito_pagine on delete restrict,
  -- Come in `sitoPagine.ts`: un indirizzo che il browser leggerebbe come un altro sito («/\», «//»), o con virgolette o spazi, no.
  indirizzo text check (indirizzo ~* '^(https?://|mailto:|tel:|/)' and indirizzo !~ '^/[/\\]' and indirizzo !~ '[\s"''<>]' and char_length(indirizzo) <= 300),
  ordine    integer not null,
  check ((pagina_id is null) <> (indirizzo is null))
);
create index if not exists sito_menu_ordine on sito_menu (dove, ordine);

-- Il vecchio indirizzo di una pagina che ha cambiato indirizzo: il sito lo manda al nuovo.
create table if not exists sito_redirect (
  da text primary key check (da ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  a  text not null check (a ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  check (da <> a)
);

-- Le pagine che il sito ha sempre: la prima e quelle di legge (il testo lo scrive la segreteria).
insert into sito_pagine (slug, titolo, di_legge) values
  ('privacy', 'Privacy policy', true),
  ('cookie', 'Cookie policy', true),
  ('contributi-pubblici', 'Contributi pubblici', true)
on conflict (slug) do nothing;
insert into sito_pagine (slug, titolo) values ('home', 'Home') on conflict (slug) do nothing;

alter table sito_pagine   enable row level security;
alter table sito_menu     enable row level security;
alter table sito_redirect enable row level security;

drop policy if exists sito_pagine_leggi on sito_pagine;
create policy sito_pagine_leggi on sito_pagine for select to authenticated using (e_staff());
drop policy if exists sito_pagine_nuova on sito_pagine;
create policy sito_pagine_nuova on sito_pagine for insert to authenticated with check (e_staff() and not di_legge and pubblicato is null
    -- Un indirizzo che è un rinvio ha già un sito dietro: non lo si riprende con una pagina nuova.
    and not exists (select 1 from sito_redirect r where r.da = slug));
drop policy if exists sito_pagine_nascondi on sito_pagine;
create policy sito_pagine_nascondi on sito_pagine for update to authenticated using (e_staff()) with check (e_staff());
drop policy if exists sito_pagine_cancella on sito_pagine;
create policy sito_pagine_cancella on sito_pagine for delete to authenticated using (e_staff() and not di_legge);

drop policy if exists sito_menu_leggi on sito_menu;
create policy sito_menu_leggi on sito_menu for select to authenticated using (e_staff());
drop policy if exists sito_redirect_leggi on sito_redirect;
create policy sito_redirect_leggi on sito_redirect for select to authenticated using (e_staff());

-- Il testo, l'indirizzo, la versione e il pubblicato passano solo dalle funzioni qui sotto.
revoke all on sito_pagine, sito_menu, sito_redirect from anon, authenticated;
grant select on sito_pagine, sito_menu, sito_redirect to authenticated;
grant insert (slug, titolo, descrizione, bozza) on sito_pagine to authenticated;
grant update (nascosta) on sito_pagine to authenticated;
grant delete on sito_pagine to authenticated;

-- Salva la bozza di una pagina. Dice quale versione si aveva in mano: se nel frattempo
-- qualcuno l'ha cambiata, non scrive e lo dice.
create or replace function salva_bozza_sito(p_id uuid, p_versione integer, p_titolo text, p_descrizione text, p_bozza text)
  returns integer language plpgsql security definer set search_path = public as $$
declare nuova integer;
begin
  if not e_staff() then
    raise exception 'Serve un accesso da segreteria' using errcode = '42501';
  end if;
  update sito_pagine
     set titolo = p_titolo, descrizione = coalesce(p_descrizione, ''), bozza = coalesce(p_bozza, ''),
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

-- Pubblica: la bozza diventa il testo del sito.
create or replace function pubblica_pagina_sito(p_id uuid, p_versione integer)
  returns integer language plpgsql security definer set search_path = public as $$
declare nuova integer;
begin
  if not e_staff() then
    raise exception 'Serve un accesso da segreteria' using errcode = '42501';
  end if;
  update sito_pagine
     set pubblicato = bozza, titolo_pubblicato = titolo, descrizione_pubblicata = descrizione, pubblicata_il = now(), pubblicata_da = persona_corrente(),
         versione = versione + 1
   where id = p_id and versione = p_versione
   returning versione into nuova;
  if nuova is null then
    if exists (select 1 from sito_pagine where id = p_id) then
      raise exception 'La pagina è cambiata mentre la modificavi: ricaricala prima di pubblicare' using errcode = 'P0001';
    end if;
    raise exception 'La pagina non c’è più' using errcode = 'P0001';
  end if;
  return nuova;
end $$;

-- Cambia l'indirizzo di una pagina e tiene il vecchio come rinvio al nuovo.
create or replace function cambia_indirizzo_sito(p_id uuid, p_slug text)
  returns void language plpgsql security definer set search_path = public as $$
declare vecchio text; legge boolean;
begin
  if not e_staff() then
    raise exception 'Serve un accesso da segreteria' using errcode = '42501';
  end if;
  select slug, di_legge into vecchio, legge from sito_pagine where id = p_id;
  if vecchio is null then
    raise exception 'La pagina non c’è più' using errcode = 'P0001';
  end if;
  if vecchio = p_slug then
    return;
  end if;
  if legge then
    raise exception 'Le pagine di legge tengono il loro indirizzo' using errcode = 'P0001';
  end if;
  -- La home è «/»: spostarla lascia il sito senza prima pagina. E il sito cambierebbe senza PUBBLICA.
  if vecchio = 'home' then
    raise exception 'La home tiene il suo indirizzo' using errcode = 'P0001';
  end if;
  if exists (select 1 from sito_pagine where slug = p_slug) then
    raise exception 'Questo indirizzo è già di un’altra pagina' using errcode = 'P0001';
  end if;
  update sito_pagine set slug = p_slug, versione = versione + 1, modificata_il = now() where id = p_id;
  -- Il nuovo indirizzo non può più essere un rinvio; il vecchio porta al nuovo. Chi puntava al vecchio ora punta al nuovo.
  delete from sito_redirect where da = p_slug;
  update sito_redirect set a = p_slug where a = vecchio;
  insert into sito_redirect (da, a) values (vecchio, p_slug) on conflict (da) do update set a = excluded.a;
end $$;

-- Riscrive il menu o il footer: voci nuove al posto delle vecchie, nell'ordine dato.
-- p_voci: [{"etichetta": "...", "pagina_id": "uuid" | null, "indirizzo": "..." | null}, ...]
-- Non lascia pubblicare una voce verso una pagina nascosta o mai pubblicata, e il footer
-- deve avere tutte le pagine di legge.
create or replace function salva_menu_sito(p_dove text, p_voci jsonb)
  returns void language plpgsql security definer set search_path = public as $$
declare
  v jsonb;
  pos integer := 0;
  pag sito_pagine;
begin
  if not e_staff() then
    raise exception 'Serve un accesso da segreteria' using errcode = '42501';
  end if;
  if p_dove not in ('menu', 'footer') then
    raise exception 'Il menu può essere solo quello in alto o il footer' using errcode = 'P0001';
  end if;
  -- Due salvataggi insieme non devono lasciare le voci doppie.
  perform pg_advisory_xact_lock(hashtext('sito_menu_' || p_dove));
  for v in select * from jsonb_array_elements(coalesce(p_voci, '[]'::jsonb)) loop
    if nullif(btrim(v->>'etichetta'), '') is null then
      raise exception 'Ogni voce ha bisogno di un nome' using errcode = 'P0001';
    end if;
    if (nullif(v->>'pagina_id', '') is null) = (nullif(v->>'indirizzo', '') is null) then
      raise exception 'La voce «%» deve portare a una pagina oppure a un indirizzo, non a tutti e due né a nessuno', v->>'etichetta' using errcode = 'P0001';
    end if;
    if nullif(v->>'pagina_id', '') is not null then
      select * into pag from sito_pagine where id = (v->>'pagina_id')::uuid;
      if pag.id is null or pag.nascosta or pag.pubblicato is null then
        raise exception 'La voce «%» porta a una pagina nascosta o non ancora pubblicata: pubblicala o togli la voce', v->>'etichetta' using errcode = 'P0001';
      end if;
    end if;
  end loop;
  if p_dove = 'footer' then
    select * into pag from sito_pagine l
     where l.di_legge and not exists (
       select 1 from jsonb_array_elements(coalesce(p_voci, '[]'::jsonb)) e where nullif(e->>'pagina_id', '')::uuid = l.id)
     limit 1;
    if pag.id is not null then
      raise exception 'Nel footer deve esserci «%»: è una pagina di legge', pag.titolo using errcode = 'P0001';
    end if;
  end if;
  delete from sito_menu where dove = p_dove;
  for v in select * from jsonb_array_elements(coalesce(p_voci, '[]'::jsonb)) loop
    pos := pos + 1;
    insert into sito_menu (dove, etichetta, pagina_id, indirizzo, ordine)
    values (p_dove, btrim(v->>'etichetta'), nullif(v->>'pagina_id', '')::uuid, nullif(v->>'indirizzo', ''), pos);
  end loop;
end $$;

-- Quello che vede il sito: solo il pubblicato, solo le pagine non nascoste.
-- Il `drop` serve a rilanciare questo file dopo 67-sito-orario.sql, che le dà una colonna in più
-- (`create or replace` non cambia la forma della risposta). Dopo un rilancio di questo file va
-- rilanciato anche il 67: la funzione torna com'era senza la colonna `corsi_collegati`.
drop function if exists sito_pagine_pubbliche();
create function sito_pagine_pubbliche()
  returns table (slug text, titolo text, descrizione text, testo text, pubblicata_il timestamptz)
  language sql stable security definer set search_path = public as $$
  select p.slug, p.titolo_pubblicato, p.descrizione_pubblicata, p.pubblicato, p.pubblicata_il
    from sito_pagine p where p.pubblicato is not null and not p.nascosta order by p.slug
$$;

create or replace function sito_menu_pubblico()
  returns table (dove text, ordine integer, etichetta text, slug text, indirizzo text)
  language sql stable security definer set search_path = public as $$
  select m.dove, m.ordine, m.etichetta, p.slug, m.indirizzo
    from sito_menu m left join sito_pagine p on p.id = m.pagina_id
   where m.pagina_id is null or (p.pubblicato is not null and not p.nascosta)
   order by m.dove, m.ordine
$$;

create or replace function sito_redirect_pubblici()
  returns table (da text, a text)
  language sql stable security definer set search_path = public as $$
  select r.da, r.a from sito_redirect r
   where exists (select 1 from sito_pagine p where p.slug = r.a and p.pubblicato is not null and not p.nascosta)
$$;

revoke all on function sito_testo_sicuro(text) from public, anon;
grant execute on function sito_testo_sicuro(text) to authenticated;
revoke all on function salva_bozza_sito(uuid, integer, text, text, text), pubblica_pagina_sito(uuid, integer),
  cambia_indirizzo_sito(uuid, text), salva_menu_sito(text, jsonb), sito_pagine_pubbliche(), sito_menu_pubblico(),
  sito_redirect_pubblici() from public, anon;
grant execute on function salva_bozza_sito(uuid, integer, text, text, text), pubblica_pagina_sito(uuid, integer),
  cambia_indirizzo_sito(uuid, text), salva_menu_sito(text, jsonb) to authenticated;
grant execute on function sito_pagine_pubbliche(), sito_menu_pubblico(), sito_redirect_pubblici() to anon, authenticated;

notify pgrst, 'reload schema';
