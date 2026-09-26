-- ---------------------------------------------------------------------------
-- ODS Corsi · la voce e gli esercizi dei tablet di sala
--
-- Dopo Maurizio, i segnali e lo schermo (10-timer-sale.sql), passano alla
-- segreteria anche le ultime cose che si sceglievano sul tablet:
--   · la voce di sistema, per nome: le voci le mette il dispositivo, quindi
--     il tablet usa quella con lo stesso nome se ce l'ha, altrimenti la prima
--     voce italiana che trova;
--   · le clip della voce incisa, nel contenitore `voce`: le incide la
--     segreteria e le sentono tutti i tablet;
--   · il catalogo degli esercizi della palestra, che i tablet usano al posto
--     del loro.
-- Lo storico dei timer c'era già (`allenamenti`, 08-timer.sql): la
-- segreteria lo legge da IMPOSTAZIONI.
--
-- Voce e catalogo stanno in due colonne della riga delle impostazioni, così
-- come le scrive l'app (`timer/src/lib/impostazioniSala.ts`). Chi le legge e
-- chi le cambia è già deciso da 05-segreteria.sql: le legge chiunque abbia un
-- accesso, tablet compresi; le cambia la segreteria. Un catalogo nullo vuol
-- dire che la segreteria non l'ha mai toccato: i tablet tengono il loro.
--
-- Si lancia dopo `12-calendario-da-se.sql`. Non crea funzioni, quindi non
-- chiede di rilanciare `06-iscrizioni.sql`.
-- ---------------------------------------------------------------------------

alter table impostazioni add column if not exists voce text;
alter table impostazioni add column if not exists esercizi jsonb;

alter table impostazioni drop constraint if exists impostazioni_voce_check;
alter table impostazioni add constraint impostazioni_voce_check
  check (voce is null or length(voce) between 1 and 200);

alter table impostazioni drop constraint if exists impostazioni_esercizi_check;
alter table impostazioni add constraint impostazioni_esercizi_check
  check (esercizi is null or (jsonb_typeof(esercizi) = 'array' and octet_length(esercizi::text) <= 60000));

-- ---------------------------------------------------------------------------
-- Le clip: una per frase, col nome della frase e senza estensione
-- (`stato/lavoro`, `maurizio/3`, `esercizi/burpee`). Il formato è quello del
-- browser che ha registrato, e sta scritto nel file. Mezzo mega a clip è
-- molto: una frase detta dura un paio di secondi.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('voce', 'voce', false, 524288,
        array['audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/wav'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists voce_legge on storage.objects;
drop policy if exists voce_carica on storage.objects;
drop policy if exists voce_aggiorna on storage.objects;
drop policy if exists voce_cancella on storage.objects;
-- Le legge chiunque abbia un accesso: sono frasi come «Lavoro», non dati di persone.
create policy voce_legge on storage.objects for select to authenticated
  using (bucket_id = 'voce');
create policy voce_carica on storage.objects for insert to authenticated
  with check (bucket_id = 'voce' and public.e_staff()
              and name ~ '^(stato|maurizio|esercizi)/[a-z0-9-]{1,80}$');
-- Rifare una clip la sovrascrive: serve anche l'aggiornamento.
create policy voce_aggiorna on storage.objects for update to authenticated
  using (bucket_id = 'voce' and public.e_staff())
  with check (bucket_id = 'voce' and public.e_staff()
              and name ~ '^(stato|maurizio|esercizi)/[a-z0-9-]{1,80}$');
create policy voce_cancella on storage.objects for delete to authenticated
  using (bucket_id = 'voce' and public.e_staff());

-- Che l'API veda subito le colonne nuove, senza aspettare.
notify pgrst, 'reload schema';
