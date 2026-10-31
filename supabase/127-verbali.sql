-- ---------------------------------------------------------------------------
-- ODS Corsi · i verbali delle riunioni dei soci e del direttivo
--
-- Un verbale ha un numero per anno, il tipo di riunione, l'ordine del giorno,
-- chi presiede e chi verbalizza, le delibere (con l'argomento, l'esito e, per i
-- bilanci, se preventivo o consuntivo), le cariche elette, gli allegati (la
-- convocazione, i fogli firme, il PDF firmato…) e le rettifiche. Nasce in bozza;
-- si firma a mano sulla carta, si scansiona, si carica il PDF e si segna come
-- firmato (`firma_verbale`, che registra la data).
--
-- Chi può cosa:
--   segreteria   tutto, nei limiti qui sotto
--   istruttore, iscritto, tablet, anon
--                niente: nemmeno i PDF nello Storage
-- Una bozza si cambia e si cancella. Un firmato no: non cambiano il verbale, le
-- delibere e le cariche, e non si cancellano né lui né i suoi allegati. Si
-- aggiungono ancora allegati e rettifiche (una rettifica nasce solo su un
-- firmato e non si cambia mai), e si può sostituire il PDF firmato dicendo
-- perché (`sostituisci_pdf_firmato`): il vecchio resta, con la data e il motivo.
-- Stato e data di firma li scrive solo `firma_verbale`, a senso unico.
--
-- Il PDF sta nello Storage, nel contenitore privato `verbali`, in una cartella
-- per verbale (`<id del verbale>/<nome>`): solo PDF, al massimo 20 MB.
--
-- Chi verbalizza si sceglie fra `verbali_segretari` (REGOLE).
--
-- Si lancia dopo `02-policy.sql` (usa `e_staff()` e `persona_corrente()`). Non
-- chiede di rilanciare `06-iscrizioni.sql`. Si può rilanciare. Finché non c'è,
-- VERBALI dice «non ancora disponibile» e il resto dell'app non cambia.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('verbali', 'verbali', false, 20971520, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create table if not exists verbali (
  id             uuid primary key default gen_random_uuid(),
  anno           int not null check (anno between 1990 and 2100),
  numero         int not null check (numero > 0),
  tipo           text not null check (tipo in ('soci', 'direttivo', 'soci_direttivo', 'straordinaria', 'elettiva')),
  data           date not null,
  ora_inizio     time,
  ora_fine       time,
  luogo          text check (char_length(luogo) <= 200),
  odg            text[] not null default '{}',
  presidente_id  uuid references persone on delete set null,
  segretario_id  uuid references persone on delete set null,
  aventi_diritto int check (aventi_diritto >= 0),
  presenti       int check (presenti >= 0),
  deleghe        int check (deleghe >= 0),
  testo          text,
  stato          text not null default 'bozza' check (stato in ('bozza', 'firmato')),
  firmato_il     date,
  -- Un verbale di prima dell'app, caricato per tenerlo in archivio.
  storico        boolean not null default false,
  creato_il      timestamptz not null default now(),
  unique (anno, numero),
  constraint verbale_firma_intera check ((stato = 'firmato') = (firmato_il is not null))
);
create index if not exists verbali_data on verbali (data);

create table if not exists verbali_delibere (
  id          uuid primary key default gen_random_uuid(),
  verbale_id  uuid not null references verbali on delete cascade,
  posizione   int not null default 0,
  titolo      text not null check (char_length(btrim(titolo)) between 1 and 300),
  argomento   text not null check (argomento in ('bilancio', 'elezioni', 'quote', 'statuto', 'sede_affitto', 'assicurazioni', 'corsi', 'istruttori', 'varie', 'altro')),
  esito       text check (esito in ('approvata', 'respinta', 'rinviata')),
  come_votato text check (char_length(come_votato) <= 200),
  -- L'anno del bilancio (o di quel che si approva), e se preventivo o consuntivo.
  anno_rif    int,
  bilancio_tipo text,
  note        text,
  constraint delibera_bilancio check (bilancio_tipo is null or (argomento = 'bilancio' and bilancio_tipo in ('preventivo', 'consuntivo')))
);
create index if not exists verbali_delibere_verbale on verbali_delibere (verbale_id);
create index if not exists verbali_delibere_argomento on verbali_delibere (argomento);

create table if not exists verbali_cariche (
  id         uuid primary key default gen_random_uuid(),
  verbale_id uuid not null references verbali on delete cascade,
  carica     text not null check (char_length(btrim(carica)) between 1 and 120),
  persona_id uuid references persone on delete set null,
  dal        date,
  al         date,
  constraint carica_periodo check (dal is null or al is null or al >= dal)
);
create index if not exists verbali_cariche_verbale on verbali_cariche (verbale_id);

create table if not exists verbali_allegati (
  id                      uuid primary key default gen_random_uuid(),
  verbale_id              uuid not null references verbali on delete cascade,
  tipo                    text not null check (tipo in ('firmato', 'convocazione', 'fogli_firme', 'bilancio', 'copia_coperta', 'altro')),
  nome                    text not null check (char_length(nome) between 1 and 200),
  percorso                text not null,
  peso                    int check (peso between 0 and 20971520),
  caricato_il             timestamptz not null default now(),
  caricato_da             uuid references persone on delete set null default persona_corrente(),
  convocazione_inviata_il date,
  -- Il PDF firmato sostituito resta, con la data e il perché: null = in vigore.
  sostituito_il           timestamptz,
  motivo_sostituzione     text,
  constraint allegato_sostituzione check (sostituito_il is null or char_length(btrim(coalesce(motivo_sostituzione, ''))) > 0)
);
create index if not exists verbali_allegati_verbale on verbali_allegati (verbale_id);
-- Un solo PDF firmato in vigore per verbale.
create unique index if not exists verbali_allegati_firmato_in_vigore on verbali_allegati (verbale_id)
  where tipo = 'firmato' and sostituito_il is null;

create table if not exists verbali_rettifiche (
  id         uuid primary key default gen_random_uuid(),
  verbale_id uuid not null references verbali on delete cascade,
  data       date not null,
  motivo     text not null check (char_length(btrim(motivo)) > 0),
  testo      text not null check (char_length(btrim(testo)) > 0),
  autore_id  uuid references persone on delete set null default persona_corrente(),
  creato_il  timestamptz not null default now()
);
create index if not exists verbali_rettifiche_verbale on verbali_rettifiche (verbale_id);

-- Chi può verbalizzare: la lista che la segreteria tiene in REGOLE.
create table if not exists verbali_segretari (
  persona_id uuid primary key references persone on delete cascade
);

-- --- chi legge e scrive cosa -------------------------------------------------
-- Le tabelle figlie guardano il verbale con l'RLS di chi scrive: la segreteria lo
-- vede, e `verbali` non guarda a sua volta i figli, quindi non c'è ricorsione.
-- Le azioni a cascata (cancellare una bozza, una persona) girano da proprietario
-- e passano sopra queste policy.

alter table verbali enable row level security;
alter table verbali_delibere enable row level security;
alter table verbali_cariche enable row level security;
alter table verbali_allegati enable row level security;
alter table verbali_rettifiche enable row level security;
alter table verbali_segretari enable row level security;

revoke all on verbali, verbali_delibere, verbali_cariche, verbali_allegati, verbali_rettifiche, verbali_segretari from anon, authenticated;

drop policy if exists verbali_legge on verbali;
drop policy if exists verbali_crea on verbali;
drop policy if exists verbali_aggiorna on verbali;
drop policy if exists verbali_cancella on verbali;
create policy verbali_legge on verbali for select to authenticated using (e_staff());
create policy verbali_crea on verbali for insert to authenticated
  with check (e_staff() and stato = 'bozza' and firmato_il is null);
create policy verbali_aggiorna on verbali for update to authenticated
  using (e_staff() and stato = 'bozza') with check (e_staff() and stato = 'bozza');
create policy verbali_cancella on verbali for delete to authenticated using (e_staff() and stato = 'bozza');
-- Stato e data di firma non si scrivono a mano: li scrive `firma_verbale`.
grant select, insert, delete on verbali to authenticated;
grant update (anno, numero, tipo, data, ora_inizio, ora_fine, luogo, odg, presidente_id, segretario_id,
              aventi_diritto, presenti, deleghe, testo, storico)
  on verbali to authenticated;

do $$
declare t text;
begin
  foreach t in array array['verbali_delibere', 'verbali_cariche'] loop
    execute format('drop policy if exists %1$s_legge on %1$s', t);
    execute format('drop policy if exists %1$s_crea on %1$s', t);
    execute format('drop policy if exists %1$s_aggiorna on %1$s', t);
    execute format('drop policy if exists %1$s_cancella on %1$s', t);
    execute format('create policy %1$s_legge on %1$s for select to authenticated using (e_staff())', t);
    execute format($p$create policy %1$s_crea on %1$s for insert to authenticated
      with check (e_staff() and exists (select 1 from verbali v where v.id = verbale_id and v.stato = 'bozza'))$p$, t);
    execute format($p$create policy %1$s_aggiorna on %1$s for update to authenticated
      using (e_staff() and exists (select 1 from verbali v where v.id = verbale_id and v.stato = 'bozza'))
      with check (e_staff() and exists (select 1 from verbali v where v.id = verbale_id and v.stato = 'bozza'))$p$, t);
    execute format($p$create policy %1$s_cancella on %1$s for delete to authenticated
      using (e_staff() and exists (select 1 from verbali v where v.id = verbale_id and v.stato = 'bozza'))$p$, t);
    execute format('grant select, insert, update, delete on %1$s to authenticated', t);
  end loop;
end $$;

-- Gli allegati si aggiungono sempre e si tolgono solo da una bozza; non si
-- cambiano: il PDF firmato si sostituisce con `sostituisci_pdf_firmato`.
drop policy if exists verbali_allegati_legge on verbali_allegati;
drop policy if exists verbali_allegati_crea on verbali_allegati;
drop policy if exists verbali_allegati_cancella on verbali_allegati;
create policy verbali_allegati_legge on verbali_allegati for select to authenticated using (e_staff());
create policy verbali_allegati_crea on verbali_allegati for insert to authenticated
  with check (e_staff() and sostituito_il is null and motivo_sostituzione is null);
create policy verbali_allegati_cancella on verbali_allegati for delete to authenticated
  using (e_staff() and exists (select 1 from verbali v where v.id = verbale_id and v.stato = 'bozza'));
-- Chi ha caricato e quando li scrive il database: la segreteria non li sceglie.
revoke insert on verbali_allegati from authenticated;
grant select, delete on verbali_allegati to authenticated;
grant insert (id, verbale_id, tipo, nome, percorso, peso, convocazione_inviata_il) on verbali_allegati to authenticated;

-- Una rettifica nasce solo su un verbale firmato e poi non si tocca più.
drop policy if exists verbali_rettifiche_legge on verbali_rettifiche;
drop policy if exists verbali_rettifiche_crea on verbali_rettifiche;
create policy verbali_rettifiche_legge on verbali_rettifiche for select to authenticated using (e_staff());
create policy verbali_rettifiche_crea on verbali_rettifiche for insert to authenticated
  with check (e_staff() and exists (select 1 from verbali v where v.id = verbale_id and v.stato = 'firmato'));
revoke insert on verbali_rettifiche from authenticated;
grant select on verbali_rettifiche to authenticated;
grant insert (id, verbale_id, data, motivo, testo) on verbali_rettifiche to authenticated;

drop policy if exists verbali_segretari_legge on verbali_segretari;
drop policy if exists verbali_segretari_crea on verbali_segretari;
drop policy if exists verbali_segretari_cancella on verbali_segretari;
create policy verbali_segretari_legge on verbali_segretari for select to authenticated using (e_staff());
create policy verbali_segretari_crea on verbali_segretari for insert to authenticated with check (e_staff());
create policy verbali_segretari_cancella on verbali_segretari for delete to authenticated using (e_staff());
grant select, insert, delete on verbali_segretari to authenticated;

-- --- i PDF nello Storage -------------------------------------------------------
-- La segreteria li legge e li carica (anche su un firmato: una convocazione, il
-- PDF che ne prende il posto). Si tolgono solo da una bozza.
drop policy if exists verbali_carica on storage.objects;
drop policy if exists verbali_legge on storage.objects;
drop policy if exists verbali_cancella on storage.objects;
create policy verbali_carica on storage.objects for insert to authenticated
  with check (bucket_id = 'verbali' and public.e_staff()
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]{1,200}$'
    and exists (select 1 from public.verbali v where v.id::text = split_part(name, '/', 1)));
create policy verbali_legge on storage.objects for select to authenticated
  using (bucket_id = 'verbali' and public.e_staff());
create policy verbali_cancella on storage.objects for delete to authenticated
  using (bucket_id = 'verbali' and public.e_staff()
    and not exists (select 1 from public.verbali v where v.id::text = split_part(name, '/', 1) and v.stato <> 'bozza'));

-- --- le tre funzioni della segreteria ------------------------------------------

-- Il prossimo numero libero dell'anno: il più alto più uno.
create or replace function prossimo_numero_verbale(anno int) returns int
  language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not e_staff() then raise exception 'I verbali li gestisce la segreteria' using errcode = '42501'; end if;
  return coalesce((select max(v.numero) from verbali v where v.anno = prossimo_numero_verbale.anno), 0) + 1;
end $$;

-- Da bozza a firmato: serve il PDF firmato in vigore, e la data non è nel futuro.
-- A senso unico: un firmato non torna in bozza.
create or replace function firma_verbale(verbale uuid, data date) returns void
  language plpgsql security definer set search_path = public, extensions as $$
declare
  v verbali;
begin
  if not e_staff() then raise exception 'I verbali li firma la segreteria' using errcode = '42501'; end if;
  select * into v from verbali where id = firma_verbale.verbale for update;
  if not found then raise exception 'Questo verbale non c’è più: ricarica la pagina' using errcode = 'P0002'; end if;
  if v.stato <> 'bozza' then raise exception 'Questo verbale è già firmato'; end if;
  if not exists (select 1 from verbali_allegati a where a.verbale_id = v.id and a.tipo = 'firmato' and a.sostituito_il is null) then
    raise exception 'Per firmare serve il PDF firmato: caricalo prima';
  end if;
  if firma_verbale.data is null then raise exception 'Scrivi la data della firma'; end if;
  if firma_verbale.data > (now() at time zone 'Europe/Rome')::date then
    raise exception 'La firma non può essere nel futuro: al massimo oggi';
  end if;
  if firma_verbale.data < v.data then raise exception 'La firma non può essere prima della riunione'; end if;
  -- Un verbale storico (archivio) si firma con numero, data, tipo e PDF; gli altri vogliono i dati veri.
  if not v.storico then
    if v.ora_inizio is null then raise exception 'Per firmare serve l’ora d’inizio'; end if;
    if v.luogo is null or btrim(v.luogo) = '' then raise exception 'Per firmare serve il luogo'; end if;
    if not exists (select 1 from unnest(v.odg) r where btrim(r) <> '') then raise exception 'Per firmare serve almeno un punto dell’ordine del giorno'; end if;
    if v.presidente_id is null then raise exception 'Per firmare serve il presidente'; end if;
    if v.segretario_id is null then raise exception 'Per firmare serve il segretario'; end if;
    if coalesce(v.presenti, 0) < 1 then raise exception 'Per firmare servono i presenti'; end if;
  end if;
  update verbali set stato = 'firmato', firmato_il = firma_verbale.data where id = v.id;
end $$;

-- Un nuovo PDF per un verbale già firmato: il vecchio resta, con la data e il
-- motivo. Il nuovo è già in tabella (caricato con un altro tipo, per non toccare
-- l'indice del PDF in vigore) e qui diventa il firmato. Rifatta con lo stesso
-- allegato, non cambia niente.
create or replace function sostituisci_pdf_firmato(verbale uuid, nuovo_allegato uuid, motivo text) returns void
  language plpgsql security definer set search_path = public, extensions as $$
declare
  v verbali;
  nuovo verbali_allegati;
begin
  if not e_staff() then raise exception 'Il PDF lo sostituisce la segreteria' using errcode = '42501'; end if;
  select * into v from verbali where id = sostituisci_pdf_firmato.verbale for update;
  if not found then raise exception 'Questo verbale non c’è più: ricarica la pagina' using errcode = 'P0002'; end if;
  if v.stato <> 'firmato' then raise exception 'Il PDF si sostituisce solo su un verbale già firmato'; end if;
  if char_length(btrim(coalesce(sostituisci_pdf_firmato.motivo, ''))) = 0 then
    raise exception 'Scrivi perché il PDF viene sostituito';
  end if;
  select * into nuovo from verbali_allegati a where a.id = sostituisci_pdf_firmato.nuovo_allegato and a.verbale_id = v.id;
  if not found then raise exception 'Il nuovo PDF non è fra gli allegati di questo verbale'; end if;
  if nuovo.sostituito_il is not null then raise exception 'Questo PDF è già stato sostituito: caricane uno nuovo'; end if;
  if nuovo.tipo = 'firmato' then return; end if;
  update verbali_allegati
     set sostituito_il = now(), motivo_sostituzione = btrim(sostituisci_pdf_firmato.motivo)
   where verbale_id = v.id and tipo = 'firmato' and sostituito_il is null;
  update verbali_allegati set tipo = 'firmato' where id = nuovo.id;
end $$;

revoke all on function prossimo_numero_verbale(int), firma_verbale(uuid, date), sostituisci_pdf_firmato(uuid, uuid, text) from public, anon;
grant execute on function prossimo_numero_verbale(int), firma_verbale(uuid, date), sostituisci_pdf_firmato(uuid, uuid, text) to authenticated;

notify pgrst, 'reload schema';
