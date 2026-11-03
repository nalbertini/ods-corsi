-- ---------------------------------------------------------------------------
-- ODS Corsi · dove stanno le persone nelle foto del sito
--
-- Il pannello SITO › Immagini fa scegliere alla segreteria un punto per foto
-- (x, y in percentuale, come `object-position`): il sito taglia la foto intorno
-- a quel punto, su computer e su telefono, in ogni riquadro. Prima i punti
-- stavano nel codice (sitoFoto.ts, sitoCorso.ts, sitoChiSiamo.ts): qui sotto
-- ci sono gli stessi, come punto di partenza.
--
-- Chi può cosa:
--   · la segreteria (`e_staff()`) legge, aggiunge, sposta e toglie i punti;
--   · istruttori, iscritti, tablet e `anon` la tabella non la vedono;
--   · il generatore del sito (chiave anon) chiama `sito_punti_pubblici()`, che
--     dà nome, x e y e nient'altro (né chi, né quando).
-- Il nome è quello del file nel contenitore «sito» (58-sito-immagini.sql):
-- un uuid minuscolo e l'estensione, così nel CSS del sito non entra altro.
--
-- Si può rilanciare: i punti di partenza non si duplicano e non tornano sopra
-- quelli che la segreteria ha spostato.
-- ---------------------------------------------------------------------------

create table if not exists public.sito_punti (
  nome text primary key check (nome ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'),
  x smallint not null check (x between 0 and 100),
  y smallint not null check (y between 0 and 100),
  cambiato_il timestamptz not null default now()
);

alter table public.sito_punti enable row level security;
revoke all on public.sito_punti from public, anon, authenticated;
grant select, insert, update, delete on public.sito_punti to authenticated;

drop policy if exists sito_punti_legge on public.sito_punti;
drop policy if exists sito_punti_aggiunge on public.sito_punti;
drop policy if exists sito_punti_sposta on public.sito_punti;
drop policy if exists sito_punti_toglie on public.sito_punti;
create policy sito_punti_legge on public.sito_punti for select to authenticated using (public.e_staff());
create policy sito_punti_aggiunge on public.sito_punti for insert to authenticated with check (public.e_staff());
create policy sito_punti_sposta on public.sito_punti for update to authenticated using (public.e_staff()) with check (public.e_staff());
create policy sito_punti_toglie on public.sito_punti for delete to authenticated using (public.e_staff());

create or replace function public.sito_punti_pubblici()
  returns table (nome text, x smallint, y smallint)
  language sql stable security definer set search_path = public, extensions as $$
  select p.nome, p.x, p.y from public.sito_punti p order by p.nome
$$;
revoke all on function public.sito_punti_pubblici() from public;
grant execute on function public.sito_punti_pubblici() to anon, authenticated;

-- I punti che stavano nel codice. Una foto usata in più riquadri aveva più
-- punti: vince quello della Home, poi quello della pagina del corso, poi Chi siamo.
insert into public.sito_punti (nome, x, y) values
  ('05e581be-a21d-40db-9499-f73036827a1b.jpg', 50, 40),
  ('2c07ede0-631c-46b8-92d2-5ba6f421527c.jpg', 50, 0),
  ('ef3851b9-719b-4e1f-8b02-df9f7965af5f.jpg', 50, 85),
  ('fbfe492b-1c27-400d-bd74-983f26de7ffe.jpg', 50, 5),
  ('53ae89ff-b083-40be-8287-265cd53cc871.jpg', 50, 50),
  ('57025167-008a-4d8d-8ed5-b6e6269e9c41.jpg', 75, 50),
  ('84f0e18a-c10c-45a3-9f86-0121bff6bc3d.jpg', 50, 25),
  ('35d6bc38-a3f5-434a-a9dc-b22325def4a9.jpg', 50, 12),
  ('b2f99558-77cc-4512-bf50-bb4377dcc63f.jpg', 50, 30),
  ('d2e7c785-44fa-422c-867a-da116e6ef2d2.jpg', 85, 50),
  ('23fd27ca-5eab-4eab-b6f5-8bba8ca17d54.jpg', 50, 20),
  ('0e459b12-2936-487f-b3da-dca0193b9850.jpg', 65, 50),
  ('622a5ef8-7841-4074-b1d8-c62adc4a2353.jpg', 10, 50),
  ('a56a64aa-faee-4003-b67e-3a97def74966.jpg', 24, 50),
  ('592403d6-a65c-4479-83e1-07c976e49f55.jpg', 50, 50),
  ('027f8536-8c0c-46f2-8956-2fbc5cddb927.jpg', 50, 12),
  ('858ec1d0-d2d4-4be2-832a-7284cbbfc625.jpg', 70, 50),
  ('a4f2d5a1-325d-4929-b072-5d32278b9142.jpg', 50, 35),
  ('7fa64cdb-2f2a-4fe2-bc30-2dcea3f7de18.jpg', 50, 55),
  ('10e995d6-a68d-47f6-93c4-2c0c1058ade4.jpg', 45, 50),
  ('31b05f55-11c0-46ed-b3cd-4ad33120be43.jpg', 50, 40),
  ('cc56fe13-bc0f-4fe8-a3ed-4491247fab8c.jpg', 50, 50),
  ('a009d9a6-0217-4f74-bb99-3a5ec903bf8b.jpg', 50, 40),
  ('1905d329-8b5d-4a8a-8d49-9d80a0993453.jpg', 92, 50),
  ('d3147207-5310-4059-b086-ab1d0529e6e0.jpg', 40, 50),
  ('e1e9758a-b5e1-4721-9d41-65bbe61884f1.jpg', 50, 62),
  ('5e09c01a-36ba-4433-b98e-e28fc1dabd2c.jpg', 50, 50),
  ('12e605fc-cd00-47b8-b15d-4eb2443c3f21.jpg', 50, 56),
  ('18c88f1d-5cea-4284-b45a-cc8fabd1a645.jpg', 50, 40),
  ('1a03b6b2-3311-441f-b35d-bd7a8e2471cb.jpg', 50, 50),
  ('40ae8db3-5d53-4075-a708-134f0cef6e81.jpg', 75, 50),
  ('46c39293-7092-49c1-bf6f-36927c36ecd1.jpg', 70, 38),
  ('6e742106-7c45-452a-b698-257bbf9309b0.jpg', 45, 68),
  ('701a887f-9ed5-4a9d-9637-bc8e54f45e6c.jpg', 50, 45),
  ('72d0e1bc-70a3-4407-9215-5c64ee721624.jpg', 50, 42),
  ('814a717b-91a2-441c-b34c-ef376d4781c6.jpg', 50, 25),
  ('9b15677c-7a5f-431b-ac7a-f5ae0994e8bf.jpg', 50, 25)
on conflict (nome) do nothing;

notify pgrst, 'reload schema';
