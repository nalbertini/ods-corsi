-- ---------------------------------------------------------------------------
-- ODS Corsi · le gare
--
-- Una gara (uno o più giorni, luogo, organizzatore), la sua quota a voci
-- (iscrizione, pullman, hotel…), chi accompagna e gli atleti che ci vanno. Del
-- pagamento di un atleta si tiene quel che ha pagato e le voci di quel momento:
-- se la segreteria cambia le voci dopo, chi ha pagato non cambia.
--
-- Chi può cosa:
--   segreteria   tutto, e incassa (`incassa_gara`, che scrive anche il pagamento
--                diretto con la voce «Gare»: così entra in CONTABILITÀ)
--   istruttore   legge le gare che accompagna, e quelle in cui va un atleta di un
--                corso che insegna, con voci, accompagnatori e atleti (non quanto
--                hanno pagato: `gare_pagamenti()` a lui non dà niente); non scrive
--   iscritto     legge le sue gare e quelle dei figli del nucleo
--                (`iscritto_puo_vedere`), con le voci, e solo le righe sue: mai
--                gli altri atleti
--   anon         niente
-- Una gara passata (l'ultimo giorno, `coalesce(al, dal)`, è prima di oggi) non si
-- cancella: si annulla. `unisci_persone` (29/99) sposta le righe che puntano a
-- `persone`: i trigger `*_unione` tengono una riga sola per gara, quella pagata.
--
-- Si lancia dopo `88-pagamento-una-volta.sql` (di cui usa
-- `registra_pagamento_diretto`), `99-email-unica.sql` e `101-iscritto.sql`. Si
-- può rilanciare. Non chiede di rilanciare `06-iscrizioni.sql`. Finché non c'è,
-- GARE dice «non ancora disponibile» e il resto dell'app non cambia.
-- ---------------------------------------------------------------------------

create table if not exists gare (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null check (char_length(btrim(nome)) between 1 and 120),
  dal           date not null check (dal between date '2000-01-01' and date '2100-12-31'),
  al            date,
  luogo         text check (char_length(luogo) <= 200),
  indirizzo     text check (char_length(indirizzo) <= 300),
  organizzatore text check (char_length(organizzatore) <= 200),
  note          text check (char_length(note) <= 2000),
  annullata     boolean not null default false,
  creata_il     timestamptz not null default now(),
  constraint gara_periodo check (al is null or al >= dal)
);
create index if not exists gare_dal on gare (dal);

create table if not exists gare_voci (
  id      uuid primary key default gen_random_uuid(),
  gara_id uuid not null references gare on delete cascade,
  voce    text not null check (char_length(btrim(voce)) between 1 and 120),
  -- In centesimi, come gli altri importi.
  importo int not null check (importo > 0 and importo <= 10000000)
);
create index if not exists gare_voci_gara on gare_voci (gara_id);

create table if not exists gare_accompagnatori (
  gara_id    uuid not null references gare on delete cascade,
  persona_id uuid not null references persone on delete cascade,
  primary key (gara_id, persona_id)
);
create index if not exists gare_accompagnatori_persona on gare_accompagnatori (persona_id);

create table if not exists gare_atleti (
  id             uuid primary key default gen_random_uuid(),
  gara_id        uuid not null references gare on delete cascade,
  persona_id     uuid not null references persone on delete cascade,
  nota           text check (char_length(nota) <= 300),
  pagato_il      date,
  pagato_importo int check (pagato_importo > 0),
  pagato_metodo  text check (char_length(pagato_metodo) <= 40),
  -- Le voci di quel momento: [{voce, importo}].
  pagato_voci    jsonb check (pagato_voci is null or jsonb_typeof(pagato_voci) = 'array'),
  unique (gara_id, persona_id),
  constraint gara_pagamento_intero check (
    (pagato_il is null and pagato_importo is null and pagato_metodo is null and pagato_voci is null)
    or (pagato_il is not null and pagato_importo is not null and pagato_metodo is not null and pagato_voci is not null))
);
create index if not exists gare_atleti_persona on gare_atleti (persona_id);

-- --- chi legge cosa ---------------------------------------------------------
-- Definer: le policy di una tabella guardano nelle altre, e con l'RLS di quelle
-- la ricorsione si aprirebbe. `iscritto_puo_vedere` non è eseguibile da
-- `authenticated`: da qui sì.

-- L'istruttore la accompagna, o ci va un atleta di un corso che insegna.
create or replace function gara_dell_istruttore(gara uuid) returns boolean
  language sql stable security definer set search_path = public, extensions as $$
  select e_personale() and (
    exists (select 1 from gare_accompagnatori a where a.gara_id = gara and a.persona_id = persona_corrente())
    or exists (select 1 from gare_atleti g
                 join iscrizioni i on i.persona_id = g.persona_id and (i.al is null or i.al >= current_date)
                 join corsi_istruttori ci on ci.corso_id = i.corso_id
                where g.gara_id = gara and ci.persona_id = persona_corrente()))
$$;

-- Ci va l'iscritto, o un figlio del suo nucleo.
create or replace function gara_dell_iscritto(gara uuid) returns boolean
  language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from gare_atleti g where g.gara_id = gara and iscritto_puo_vedere(g.persona_id))
$$;

create or replace function riga_gara_dell_iscritto(persona uuid) returns boolean
  language sql stable security definer set search_path = public, extensions as $$
  select iscritto_puo_vedere(persona)
$$;

-- Degli atleti l'istruttore vede solo i suoi; chi accompagna li vede tutti.
create or replace function riga_gara_dell_istruttore(gara uuid, persona uuid) returns boolean
  language sql stable security definer set search_path = public, extensions as $$
  select e_personale() and (
    exists (select 1 from gare_accompagnatori a where a.gara_id = gara and a.persona_id = persona_corrente())
    or exists (select 1 from iscrizioni i join corsi_istruttori ci on ci.corso_id = i.corso_id
                where i.persona_id = persona and (i.al is null or i.al >= current_date)
                  and ci.persona_id = persona_corrente()))
$$;

revoke all on function gara_dell_istruttore(uuid), gara_dell_iscritto(uuid), riga_gara_dell_iscritto(uuid), riga_gara_dell_istruttore(uuid, uuid) from public, anon;
grant execute on function gara_dell_istruttore(uuid), gara_dell_iscritto(uuid), riga_gara_dell_iscritto(uuid), riga_gara_dell_istruttore(uuid, uuid) to authenticated;

alter table gare enable row level security;
alter table gare_voci enable row level security;
alter table gare_accompagnatori enable row level security;
alter table gare_atleti enable row level security;

do $$
declare t text;
begin
  foreach t in array array['gare', 'gare_voci', 'gare_accompagnatori', 'gare_atleti'] loop
    execute format('drop policy if exists %1$s_legge on %1$s', t);
    execute format('drop policy if exists %1$s_scrive on %1$s', t);
    execute format('drop policy if exists %1$s_aggiorna on %1$s', t);
    execute format('drop policy if exists %1$s_cancella on %1$s', t);
    execute format('create policy %1$s_scrive on %1$s for insert to authenticated with check (e_staff())', t);
    execute format('create policy %1$s_aggiorna on %1$s for update to authenticated using (e_staff()) with check (e_staff())', t);
    execute format('create policy %1$s_cancella on %1$s for delete to authenticated using (e_staff())', t);
    execute format('revoke all on %1$s from anon, authenticated', t);
    execute format('grant select, insert, update, delete on %1$s to authenticated', t);
  end loop;
end $$;

create policy gare_legge on gare for select to authenticated
  using (e_staff() or gara_dell_istruttore(id) or gara_dell_iscritto(id));
create policy gare_voci_legge on gare_voci for select to authenticated
  using (e_staff() or gara_dell_istruttore(gara_id) or gara_dell_iscritto(gara_id));
create policy gare_accompagnatori_legge on gare_accompagnatori for select to authenticated
  using (e_staff() or gara_dell_istruttore(gara_id));
-- L'iscritto vede la riga sua (e dei figli), non quelle degli altri atleti.
create policy gare_atleti_legge on gare_atleti for select to authenticated
  using (e_staff() or riga_gara_dell_istruttore(gara_id, persona_id) or riga_gara_dell_iscritto(persona_id));
-- Chi ha pagato resta: togliendolo, il pagamento in CONTABILITÀ resterebbe senza
-- la sua gara, e rimettendolo si incasserebbe due volte. Una policy e non un
-- trigger, così `unisci_persone` sposta ancora le righe pagate.
drop policy if exists gare_atleti_cancella on gare_atleti;
create policy gare_atleti_cancella on gare_atleti for delete to authenticated
  using (e_staff() and pagato_il is null);

-- Il pagamento di un atleta non lo legge l'istruttore, e non lo scrive nessuno a
-- mano: lo scrive `incassa_gara`, che lo porta anche in CONTABILITÀ. Le colonne
-- `pagato_*` si leggono da `gare_pagamenti()`: la segreteria tutte, l'iscritto le
-- sue e dei figli del nucleo.
revoke select, insert, update on gare_atleti from authenticated;
grant select (id, gara_id, persona_id, nota), insert (gara_id, persona_id, nota), update (nota)
  on gare_atleti to authenticated;

create or replace function gare_pagamenti() returns setof gare_atleti
  language sql stable security definer set search_path = public, extensions as $$
  select * from gare_atleti g where e_staff() or iscritto_puo_vedere(g.persona_id)
$$;
revoke all on function gare_pagamenti() from public, anon;
grant execute on function gare_pagamenti() to authenticated;

-- --- una gara passata resta -------------------------------------------------
-- security definer: chi cancella non legge le colonne `pagato_*`.
create or replace function gare_non_cancellare_passate() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if coalesce(old.al, old.dal) < current_date then
    raise exception 'Una gara passata non si cancella: si può annullare' using errcode = '22023';
  end if;
  -- Il cascade sugli atleti non passa dalle policy: il controllo dei pagati va qui.
  if exists (select 1 from gare_atleti where gara_id = old.id and pagato_il is not null) then
    raise exception 'Qualcuno ha già pagato questa gara: non si cancella, si può annullare' using errcode = '22023';
  end if;
  return old;
end $$;
drop trigger if exists gare_non_cancellare_passate on gare;
create trigger gare_non_cancellare_passate before delete on gare
  for each row execute function gare_non_cancellare_passate();

-- --- unire due schede -------------------------------------------------------
-- La riga che arriva in una gara dove chi resta c'è già non entra: se era
-- pagata e l'altra no, il pagamento passa a quella che resta.
create or replace function gare_atleti_unione() returns trigger
  language plpgsql set search_path = public as $$
begin
  if exists (select 1 from gare_atleti g where g.gara_id = new.gara_id and g.persona_id = new.persona_id and g.id <> new.id) then
    update gare_atleti g
       set pagato_il = old.pagato_il, pagato_importo = old.pagato_importo,
           pagato_metodo = old.pagato_metodo, pagato_voci = old.pagato_voci
     where g.gara_id = new.gara_id and g.persona_id = new.persona_id and g.id <> new.id
       and g.pagato_il is null and old.pagato_il is not null;
    update gare_atleti g set nota = old.nota
     where g.gara_id = new.gara_id and g.persona_id = new.persona_id and g.id <> new.id
       and g.nota is null and old.nota is not null;
    delete from gare_atleti where id = old.id;
    return null;
  end if;
  return new;
end $$;
drop trigger if exists gare_atleti_unione on gare_atleti;
create trigger gare_atleti_unione before update of persona_id on gare_atleti
  for each row execute function gare_atleti_unione();

create or replace function gare_accompagnatori_unione() returns trigger
  language plpgsql set search_path = public as $$
begin
  if exists (select 1 from gare_accompagnatori a where a.gara_id = new.gara_id and a.persona_id = new.persona_id) then
    delete from gare_accompagnatori where gara_id = old.gara_id and persona_id = old.persona_id;
    return null;
  end if;
  return new;
end $$;
drop trigger if exists gare_accompagnatori_unione on gare_accompagnatori;
create trigger gare_accompagnatori_unione before update of persona_id on gare_accompagnatori
  for each row execute function gare_accompagnatori_unione();

-- Funzioni dei trigger: nessuno le chiama a mano.
revoke all on function gare_non_cancellare_passate(), gare_atleti_unione(), gare_accompagnatori_unione() from public, anon, authenticated;

-- --- incassare --------------------------------------------------------------
-- La voce contabile degli incassi delle gare, come «Compensi istruttori» nell'81:
-- una voce omonima scritta a mano diventa quella di sistema.
insert into voci_contabili (nome, tipo, di_sistema) values ('Gare', 'entrata', true) on conflict do nothing;
update voci_contabili set di_sistema = true, attiva = true
 where tipo = 'entrata' and lower(trim(nome)) = 'gare' and not (di_sistema and attiva);

-- Il pagamento di un atleta: il totale delle voci di adesso, una volta sola, e il
-- pagamento diretto per la persona (voce «Gare»), che porta con sé i controlli
-- dell'88 (data non nel futuro, importo, metodo).
create or replace function incassa_gara(atleta uuid, metodo text, data date default current_date)
  returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  riga gare_atleti;
  g gare;
  voci jsonb;
  totale int;
  pagato jsonb;
begin
  if not e_staff() then raise exception 'la quota della gara la incassa la segreteria' using errcode = '42501'; end if;
  select * into riga from gare_atleti where id = atleta for update;
  if not found then raise exception 'Questo atleta non è più nella gara' using errcode = '22023'; end if;
  if riga.pagato_il is not null then raise exception 'Questo atleta ha già pagato la gara' using errcode = '22023'; end if;
  select * into g from gare where id = riga.gara_id;
  if g.annullata then raise exception 'La gara è annullata: non si incassa' using errcode = '22023'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('voce', v.voce, 'importo', v.importo) order by v.voce), '[]'::jsonb),
         coalesce(sum(v.importo), 0)
    into voci, totale
    from gare_voci v where v.gara_id = riga.gara_id;
  if totale = 0 then raise exception 'La gara non ha una quota: aggiungi le voci prima di incassare' using errcode = '22023'; end if;
  pagato := registra_pagamento_diretto(jsonb_build_object(
    'persona_id', riga.persona_id, 'data', data, 'importo', totale, 'metodo', metodo,
    'voce', 'Gare', 'nota', left(g.nome, 300)));
  update gare_atleti
     set pagato_il = incassa_gara.data, pagato_importo = totale, pagato_metodo = btrim(metodo), pagato_voci = voci
   where id = atleta
  returning * into riga;
  -- L'id del pagamento: FAI LA RICEVUTA parte da lì, come FANNE LA RICEVUTA.
  return to_jsonb(riga) || jsonb_build_object('pagamento_id', pagato->>'id');
end $$;
revoke all on function incassa_gara(uuid, text, date) from public, anon;
grant execute on function incassa_gara(uuid, text, date) to authenticated;

notify pgrst, 'reload schema';
