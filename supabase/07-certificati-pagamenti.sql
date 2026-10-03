-- ---------------------------------------------------------------------------
-- ODS Corsi · il certificato medico e il pagamento degli iscritti
--
-- Per ogni iscritto la segreteria tiene due cose che all'appello non servono
-- ma senza le quali in sala non si entra: il certificato medico (fino a
-- quando vale) e se ha pagato (del tutto, in parte, niente, e fino a
-- quando). E se la copia del documento d'identità è in segreteria.
--
-- Il certificato è un dato sulla salute (art. 9 del GDPR): anche quello per
-- lo sport non agonistico dice che la persona è stata visitata e con che
-- esito. Per questo sta in una tabella a parte da `persone`, che gli
-- istruttori leggono per fare l'appello: questa la vede solo la segreteria.
--
-- Il certificato e il documento si tengono su carta, in segreteria: qui c'è
-- solo fino a quando vale il primo e se c'è il secondo. Prima il file del
-- certificato si caricava nell'app, in un contenitore privato: quelli
-- rimasti la segreteria li apre, li stampa e li cancella, e di nuovi non ne
-- entrano.
--
-- Si lancia dopo `06-iscrizioni.sql`. Non dà niente ad `anon`.
-- ---------------------------------------------------------------------------

do $$ begin create type stato_pagamento as enum ('da_pagare', 'in_parte', 'pagato'); exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Una riga per iscritto, quando c'è qualcosa da dire: chi non ce l'ha non ha
-- certificato e deve ancora pagare.
--
-- `certificato_file` è il nome di un file caricato prima della carta, nello
-- Storage, `<persona>/certificato-<n>.<est>`: finché c'è, è da stampare e
-- cancellare. `documento_in_segreteria` dice che la copia del documento
-- d'identità (per un minore, quello del genitore) è nella cartellina.
-- `pagato_fino` serve a chi paga il trimestre: passata la data, «pagato»
-- torna da pagare.
-- ---------------------------------------------------------------------------
create table if not exists schede_iscritti (
  persona_id        uuid primary key references persone on delete cascade,
  certificato_scade date,
  documento_in_segreteria boolean not null default false,
  certificato_file  text check (certificato_file ~ '^[0-9a-f-]{36}/certificato-[0-9]+\.(jpg|jpeg|png|webp|heic|heif|pdf)$'),
  pagamento         stato_pagamento not null default 'da_pagare',
  pagato_fino       date,
  pagamento_nota    text check (length(pagamento_nota) <= 300),
  cambiata_il       timestamptz not null default now(),
  cambiata_da       uuid references persone on delete set null,
  -- Il file di una persona sta nella sua cartella, non in quella di un'altra.
  constraint certificato_suo check (certificato_file is null or split_part(certificato_file, '/', 1) = persona_id::text)
);
create index if not exists schede_certificato on schede_iscritti (certificato_scade);
-- Sui database fatti prima del documento su carta.
alter table schede_iscritti add column if not exists documento_in_segreteria boolean not null default false;

-- Chi l'ha cambiata e quando, scritto dal server e non dal browser.
create or replace function scheda_cambiata() returns trigger language plpgsql as $$
begin
  new.cambiata_il := now();
  new.cambiata_da := persona_corrente();
  return new;
end $$;
drop trigger if exists schede_cambiata on schede_iscritti;
create trigger schede_cambiata before insert or update on schede_iscritti
  for each row execute function scheda_cambiata();

-- Solo la segreteria: né gli istruttori né gli iscritti.
alter table schede_iscritti enable row level security;
drop policy if exists schede_legge on schede_iscritti;
drop policy if exists schede_scrive on schede_iscritti;
drop policy if exists schede_aggiorna on schede_iscritti;
drop policy if exists schede_cancella on schede_iscritti;
create policy schede_legge on schede_iscritti for select to authenticated using (e_staff());
create policy schede_scrive on schede_iscritti for insert to authenticated with check (e_staff());
create policy schede_aggiorna on schede_iscritti for update to authenticated using (e_staff()) with check (e_staff());
create policy schede_cancella on schede_iscritti for delete to authenticated using (e_staff());
revoke all on schede_iscritti from anon, authenticated;
grant select, insert, update, delete on schede_iscritti to authenticated;

-- ---------------------------------------------------------------------------
-- I file dei certificati di prima della carta: il contenitore privato
-- `certificati`, dove c'è, resta finché la segreteria non li ha stampati e
-- cancellati tutti, e poi si elimina dal pannello di Supabase (vedi
-- supabase/LEGGIMI.md). Non lo si crea più, e non ci si carica più niente:
-- la segreteria li legge e li cancella, e basta.
-- ---------------------------------------------------------------------------
drop policy if exists certificati_carica on storage.objects;
drop policy if exists certificati_legge on storage.objects;
drop policy if exists certificati_cancella on storage.objects;
create policy certificati_legge on storage.objects for select to authenticated
  using (bucket_id = 'certificati' and public.e_staff());
create policy certificati_cancella on storage.objects for delete to authenticated
  using (bucket_id = 'certificati' and public.e_staff());

-- Le funzioni nascono eseguibili da tutti, `anon` compreso: si chiudono qui.
revoke all on function scheda_cambiata() from public, anon;
grant execute on function scheda_cambiata() to authenticated;

notify pgrst, 'reload schema';
