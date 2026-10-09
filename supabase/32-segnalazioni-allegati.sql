-- ---------------------------------------------------------------------------
-- ODS Corsi · i file nelle segnalazioni della segreteria
--
-- Chi scrive una segnalazione, o risponde, può allegare fino a 3 file (foto,
-- screenshot, PDF, al massimo 10 MB l'uno): uno screenshot dice dove succede
-- meglio delle parole. Stanno nello Storage in un contenitore privato,
-- `segnalazioni`, in una cartella per messaggio (`<id del messaggio>/<nome>`):
-- nessun link pubblico, li apre la segreteria con un link che scade.
--
-- Solo la segreteria (`e_staff()`) li vede e li carica, e solo su un messaggio
-- suo. Un allegato mandato non si cambia. Lo toglie solo chi l'ha mandato
-- (`togli_allegato`), e nel filo resta la traccia di chi e quando, non di cosa
-- (`segnalazioni_allegati_tolti`). Trenta giorni dopo la chiusura del filo si
-- tolgono tutti (`pulisci_allegati`, ogni notte con pg_cron se c'è); il testo
-- dei messaggi resta.
--
-- Uno screenshot può avere nomi di iscritti, anche minori: per questo il
-- contenitore è privato e la guida dice di coprirli. Certificati medici e
-- documenti d'identità non si allegano.
--
-- Si lancia dopo `25-segnalazioni.sql`. Chiede `persona_corrente()` e
-- `e_staff()` (02-policy.sql). Non chiede di rilanciare `06-iscrizioni.sql`.
-- Finché non c'è, le segnalazioni funzionano come prima e il tasto per
-- allegare dice che va lanciato questo file.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('segnalazioni', 'segnalazioni', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create table if not exists segnalazioni_allegati (
  id           uuid primary key default gen_random_uuid(),
  messaggio_id uuid not null references segnalazioni on delete cascade,
  nome         text not null check (char_length(nome) between 1 and 200),
  tipo         text not null check (tipo in ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf')),
  peso         bigint not null check (peso between 0 and 10485760),
  autore_id    uuid references persone on delete set null default persona_corrente(),
  caricato_il  timestamptz not null default now()
);
create index if not exists segnalazioni_allegati_messaggio on segnalazioni_allegati (messaggio_id);

-- Chi ha tolto cosa, senza dire cosa: nel filo si vede che c'era un allegato.
create table if not exists segnalazioni_allegati_tolti (
  id           uuid primary key default gen_random_uuid(),
  messaggio_id uuid not null references segnalazioni on delete cascade,
  tolto_da     uuid references persone on delete set null,
  tolto_il     timestamptz not null default now()
);
create index if not exists segnalazioni_allegati_tolti_messaggio on segnalazioni_allegati_tolti (messaggio_id);

-- Il messaggio è di chi sta scrivendo, il filo è aperto, e non ha già 3
-- allegati: i 3 si contano fra righe e file, se no basta caricare i file e
-- non scrivere le righe per aggirare il tetto.
create or replace function puo_allegare(messaggio uuid)
  returns boolean language sql stable security definer set search_path = public, extensions as $$
  select e_staff()
    and exists (select 1 from segnalazioni m join segnalazioni f on f.id = coalesce(m.padre_id, m.id)
                where m.id = messaggio and m.autore_id = persona_corrente() and f.chiusa_il is null)
    and (select count(*) from segnalazioni_allegati a where a.messaggio_id = messaggio) < 3
$$;

-- Come per `iscrizioni`: il nome del file dice a quale messaggio va.
create or replace function puo_caricare_allegato(nome_file text)
  returns boolean language sql stable security definer set search_path = public, extensions as $$
  select nome_file ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]{1,200}$'
    and puo_allegare(split_part(nome_file, '/', 1)::uuid)
    and (select count(*) from storage.objects o
         where o.bucket_id = 'segnalazioni' and o.name like split_part(nome_file, '/', 1) || '/%') < 3
$$;

-- I due conteggi qui sopra, da soli, non tengono: due allegati caricati
-- insieme vedono lo stesso numero e passano tutti e due, e dall'API di Storage
-- la policy si prova con una insert annullata mentre la riga vera la scrive
-- Storage da superutente, senza RLS. I trigger scattano sulle righe vere e
-- tengono in fila gli allegati di uno stesso messaggio fino al commit. Quello
-- su `storage.objects` sta su una tabella di Supabase: se un suo
-- aggiornamento lo togliesse, lo dice `controllo.sql`, e si rilancia questo file.
create or replace function limita_file_allegati() returns trigger
  language plpgsql security definer set search_path = public, extensions as $$
declare
  cartella text := split_part(new.name, '/', 1);
begin
  -- Un file che cambia nome nella sua cartella non ne aggiunge uno.
  if tg_op = 'UPDATE' and old.bucket_id = 'segnalazioni' and split_part(old.name, '/', 1) = cartella then return new; end if;
  perform pg_advisory_xact_lock(hashtext('allegati:' || cartella));
  if (select count(*) from storage.objects o where o.bucket_id = 'segnalazioni' and o.name like cartella || '/%') >= 3 then
    raise exception 'Questo messaggio ha già 3 allegati: per un altro file, scrivi un altro messaggio' using errcode = '42501';
  end if;
  return new;
end $$;
create or replace function limita_allegati() returns trigger
  language plpgsql security definer set search_path = public, extensions as $$
begin
  perform pg_advisory_xact_lock(hashtext('allegati:' || new.messaggio_id));
  if (select count(*) from segnalazioni_allegati a where a.messaggio_id = new.messaggio_id) >= 3 then
    raise exception 'Questo messaggio ha già 3 allegati: per un altro file, scrivi un altro messaggio' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function limita_file_allegati(), limita_allegati() from public, anon, authenticated;
create or replace trigger limita_file_allegati before insert or update of bucket_id, name on storage.objects
  for each row when (new.bucket_id = 'segnalazioni') execute function limita_file_allegati();
create or replace trigger limita_allegati before insert on segnalazioni_allegati
  for each row execute function limita_allegati();

alter table segnalazioni_allegati enable row level security;
alter table segnalazioni_allegati_tolti enable row level security;

drop policy if exists segnalazioni_allegati_leggi on segnalazioni_allegati;
create policy segnalazioni_allegati_leggi on segnalazioni_allegati for select using (e_staff());
drop policy if exists segnalazioni_allegati_scrivi on segnalazioni_allegati;
create policy segnalazioni_allegati_scrivi on segnalazioni_allegati for insert
  with check (autore_id = persona_corrente() and puo_allegare(messaggio_id));
drop policy if exists segnalazioni_allegati_tolti_leggi on segnalazioni_allegati_tolti;
create policy segnalazioni_allegati_tolti_leggi on segnalazioni_allegati_tolti for select using (e_staff());

-- Righe: si leggono e si aggiungono; si tolgono solo con `togli_allegato`.
revoke all on segnalazioni_allegati, segnalazioni_allegati_tolti from anon, authenticated;
grant select, insert on segnalazioni_allegati to authenticated;
grant select on segnalazioni_allegati_tolti to authenticated;

-- Il file nello Storage: lo carica chi ha scritto il messaggio, lo legge la
-- segreteria, lo toglie chi l'ha caricato.
drop policy if exists segnalazioni_carica on storage.objects;
drop policy if exists segnalazioni_legge on storage.objects;
drop policy if exists segnalazioni_cancella on storage.objects;
create policy segnalazioni_carica on storage.objects for insert to authenticated
  with check (bucket_id = 'segnalazioni' and public.puo_caricare_allegato(name));
create policy segnalazioni_legge on storage.objects for select to authenticated
  using (bucket_id = 'segnalazioni' and public.e_staff());
create policy segnalazioni_cancella on storage.objects for delete to authenticated
  using (bucket_id = 'segnalazioni' and public.e_staff() and exists (
    select 1 from public.segnalazioni m
    where m.id::text = split_part(name, '/', 1) and m.autore_id = public.persona_corrente()));

-- Toglie un allegato e lascia la traccia nel filo. Solo chi l'ha mandato. Il
-- file lo toglie l'app con l'API dello Storage, prima; qui si toglie da SQL
-- solo se è rimasto. Se lo Storage non lascia cancellare da SQL (Supabase lo
-- può vietare) la funzione si ferma e la riga resta: meglio un allegato che si
-- vede e si riprova che un file senza riga che nessuno ritrova.
create or replace function togli_allegato(allegato uuid)
  returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  a segnalazioni_allegati%rowtype;
begin
  -- Chi non è segreteria riceve lo stesso no per un allegato vero e per uno che non c'è.
  if not e_staff() then
    raise exception 'Un allegato lo toglie solo chi l''ha mandato' using errcode = '42501';
  end if;
  select * into a from segnalazioni_allegati where id = allegato;
  if not found then
    raise exception 'Questo allegato non c''è più' using errcode = 'P0002';
  end if;
  if a.autore_id is distinct from persona_corrente() then
    raise exception 'Un allegato lo toglie solo chi l''ha mandato' using errcode = '42501';
  end if;
  delete from storage.objects where bucket_id = 'segnalazioni' and name = a.messaggio_id || '/' || a.nome;
  delete from segnalazioni_allegati where id = allegato;
  insert into segnalazioni_allegati_tolti (messaggio_id, tolto_da) values (a.messaggio_id, a.autore_id);
end $$;

-- Trenta giorni dopo la chiusura del filo: via tutti i file e le righe degli
-- allegati, il testo resta. Dice quante righe ha tolto. Lo si guarda per
-- cartella, non per riga: un file rimasto senza riga se ne va lo stesso. La
-- lancia il database (pg_cron), non la segreteria. Un file che lo Storage non
-- lascia cancellare da SQL lascia la sua riga: si riprova la notte dopo.
create or replace function pulisci_allegati()
  returns int language plpgsql security definer set search_path = public, extensions as $$
declare
  n int := 0;
  m record;
begin
  for m in
    select s.id
    from segnalazioni s join segnalazioni f on f.id = coalesce(s.padre_id, s.id)
    where f.chiusa_il < now() - interval '30 days'
      and (exists (select 1 from segnalazioni_allegati a where a.messaggio_id = s.id)
        or exists (select 1 from storage.objects o where o.bucket_id = 'segnalazioni' and o.name like s.id::text || '/%'))
  loop
    begin
      delete from storage.objects where bucket_id = 'segnalazioni' and name like m.id::text || '/%';
      with tolte as (delete from segnalazioni_allegati where messaggio_id = m.id returning 1)
        select n + count(*) into n from tolte;
    exception when others then
      raise notice 'allegati di % non tolti: %', m.id, sqlerrm;
    end;
  end loop;
  return n;
end $$;

revoke all on function togli_allegato(uuid), pulisci_allegati(), puo_allegare(uuid), puo_caricare_allegato(text) from public, anon, authenticated;
grant execute on function togli_allegato(uuid) to authenticated;
-- Le policy chiamano le due di controllo con i permessi di chi scrive.
grant execute on function puo_allegare(uuid), puo_caricare_allegato(text) to authenticated;

-- Ogni notte, se Supabase ha pg_cron acceso (Database → Extensions). Se no
-- il file si lancia lo stesso e `pulisci_allegati()` si lancia a mano.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'pulisci-allegati';
  perform cron.schedule('pulisci-allegati', '30 3 * * *', 'select public.pulisci_allegati()');
exception when others then
  raise notice 'pg_cron non c''è: pulisci_allegati() si lancia a mano';
end $$;

notify pgrst, 'reload schema';
