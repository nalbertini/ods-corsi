-- Le immagini del sito (pannello SITO). Il contenitore «sito» è pubblico: le
-- pagine del sito le mostrano a chiunque dall'indirizzo pubblico, che non passa
-- dalle policy. Elencare, caricare e cancellare passa invece da
-- `storage.objects`, e lì solo la segreteria ha una policy: `anon`, istruttori,
-- iscritti e tablet no.
-- 1 MB basta a una foto ridotta dall'app. Solo JPEG, PNG e WebP: un SVG può
-- portare script, e in un contenitore pubblico non entra.
-- Il nome lo decide l'app: un uuid minuscolo e l'estensione. Niente cartelle,
-- niente .html, niente nomi di chi carica.
-- Si può rilanciare.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sito', 'sito', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists sito_immagini_carica on storage.objects;
drop policy if exists sito_immagini_legge on storage.objects;
drop policy if exists sito_immagini_cancella on storage.objects;
create policy sito_immagini_carica on storage.objects for insert to authenticated
  with check (bucket_id = 'sito' and public.e_staff() and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$');
create policy sito_immagini_legge on storage.objects for select to authenticated
  using (bucket_id = 'sito' and public.e_staff());
create policy sito_immagini_cancella on storage.objects for delete to authenticated
  using (bucket_id = 'sito' and public.e_staff());

notify pgrst, 'reload schema';
