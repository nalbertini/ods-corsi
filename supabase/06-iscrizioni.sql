-- ---------------------------------------------------------------------------
-- ODS Corsi · il modulo di iscrizione
--
-- Il modulo che prima stava su Google Form, dentro l'app: chi si iscrive
-- risponde alle domande, carica il modulo firmato, il documento, il
-- certificato medico e la ricevuta, e la segreteria trova la richiesta in
-- RICHIESTE ONLINE. Da lì la accoglie (diventa un iscritto, iscritto ai
-- corsi che ha scelto) o la rifiuta.
--
-- Documento d'identità e certificato medico si caricano per comodità, ma si
-- tengono su carta: restano nella cartella della richiesta finché la
-- segreteria non li stampa e li cancella (`richieste_con_documento`, più
-- sotto). Dal `44-certificati-online.sql` il certificato non si stampa più:
-- accogliendo la richiesta passa alla scheda, e `accogli_iscrizione` e
-- `richieste_con_documento` sono quelle di quel file (rilanciando questo,
-- va rilanciato anche il 44).
--
-- È la prima cosa dell'app che si fa **senza un accesso**, e per questo sta
-- tutta dietro a due funzioni: `anon` non vede e non scrive nessuna tabella,
-- nemmeno questa. Può solo chiamare `corsi_aperti()` (i nomi dei corsi, per
-- scegliere) e `invia_iscrizione()` (una richiesta, controllata qui), e
-- caricare fino a cinque file nella cartella della richiesta appena fatta.
--
-- Si lancia dopo i cinque file prima. Rilanciarne uno di quelli rimette i
-- permessi di default alle sue funzioni: dopo, va rilanciato anche questo.
-- ---------------------------------------------------------------------------

do $$ begin create type stato_richiesta as enum ('nuova', 'accolta', 'rifiutata'); exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Le richieste.
--
-- Stanno a parte da `persone` perché sono un'altra cosa: una domanda, non una
-- persona in elenco. Tengono anche quello che in `persone` non c'è e non serve
-- all'appello — la data di nascita, il codice fiscale, la residenza, il
-- genitore — e che serve alla segreteria per il tesseramento. Accolta, la
-- richiesta resta legata alla persona che ne è nata.
--
-- Per un minore email e telefono sono del genitore: è lui che la segreteria
-- chiama.
-- ---------------------------------------------------------------------------
create table if not exists richieste_iscrizione (
  id               uuid primary key default gen_random_uuid(),
  creata_il        timestamptz not null default now(),
  stato            stato_richiesta not null default 'nuova',
  nome             text not null check (length(trim(nome)) between 1 and 80),
  cognome          text not null check (length(trim(cognome)) between 1 and 80),
  nato_il          date not null,
  nato_a           text not null check (length(trim(nato_a)) between 1 and 80),
  codice_fiscale   text not null check (codice_fiscale ~ '^[A-Z0-9]{16}$'),
  indirizzo        text not null check (length(trim(indirizzo)) between 1 and 160),
  cap              text not null check (cap ~ '^[0-9]{5}$'),
  comune           text not null check (length(trim(comune)) between 1 and 80),
  email            citext not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 160),
  telefono         text not null check (length(regexp_replace(telefono, '\D', '', 'g')) between 6 and 15),
  genitore_nome    text check (length(trim(genitore_nome)) between 1 and 80),
  genitore_cognome text check (length(trim(genitore_cognome)) between 1 and 80),
  genitore_codice_fiscale text check (genitore_codice_fiscale ~ '^[A-Z0-9]{16}$'),
  corsi            uuid[] not null check (cardinality(corsi) between 1 and 6),
  formula          text not null check (formula in ('annuale', 'trimestre')),
  note             text check (length(note) <= 1000),
  persona_id       uuid references persone on delete set null,
  gestita_da       uuid references persone on delete set null,
  gestita_il       timestamptz
);
-- Dopo: un secondo telefono facoltativo, e la casella del Regolamento Sociale.
-- Le richieste arrivate prima restano senza, con `regolamento` a falso.
alter table richieste_iscrizione add column if not exists telefono_2 text
  check (length(regexp_replace(telefono_2, '\D', '', 'g')) between 6 and 15);
alter table richieste_iscrizione add column if not exists regolamento boolean not null default false;
create index if not exists richieste_quando on richieste_iscrizione (creata_il desc);
create index if not exists richieste_email on richieste_iscrizione (email, creata_il);
create index if not exists richieste_persona on richieste_iscrizione (persona_id);

-- Le vede e le gestisce la segreteria, nessun altro: dentro ci sono codici
-- fiscali e indirizzi, e agli istruttori per l'appello non servono. Nessuna
-- policy di inserimento: si entra solo da `invia_iscrizione()`.
alter table richieste_iscrizione enable row level security;
drop policy if exists richieste_legge on richieste_iscrizione;
drop policy if exists richieste_aggiorna on richieste_iscrizione;
drop policy if exists richieste_cancella on richieste_iscrizione;
create policy richieste_legge on richieste_iscrizione for select to authenticated using (e_staff());
create policy richieste_aggiorna on richieste_iscrizione for update to authenticated using (e_staff()) with check (e_staff());
create policy richieste_cancella on richieste_iscrizione for delete to authenticated using (e_staff());
revoke all on richieste_iscrizione from anon, authenticated;
grant select, update, delete on richieste_iscrizione to authenticated;

-- ---------------------------------------------------------------------------
-- Quanto è aperta la porta. Un modulo senza accesso lo può compilare anche un
-- programma: questi numeri tengono il danno piccolo senza dar fastidio a chi
-- si iscrive davvero.
-- ---------------------------------------------------------------------------
create or replace function iscrizioni_regole() returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_object(
    'per_email_al_giorno', 3,    -- una famiglia con tre figli le manda tutte
    'in_tutto_all_ora', 60,      -- il doppio di quante se ne sono mai viste a settembre
    'minuti_per_i_file', 60,     -- dopo aver mandato le risposte, per caricare i file
    'file_per_richiesta', 5      -- modulo, documento fronte e retro, certificato, ricevuta
  )
$$;

-- ---------------------------------------------------------------------------
-- I corsi fra cui scegliere: il nome e basta. Il calendario resta dietro
-- l'accesso.
-- ---------------------------------------------------------------------------
create or replace function corsi_aperti()
  returns table (id uuid, nome text) language sql stable security definer set search_path = public, extensions as $$
  select c.id, c.nome from corsi c where c.attivo order by c.nome
$$;

-- ---------------------------------------------------------------------------
-- Il codice fiscale, letto invece che solo contato: le stesse regole di
-- `src/lib/codiceFiscale.ts`. L'ultimo carattere si calcola dagli altri
-- quindici e scopre quasi ogni lettera copiata male; dentro c'è anche la data
-- di nascita. Le cifre possono essere lettere (LMNPQRSTUV per 0-9): è
-- l'omocodia, per chi altrimenti avrebbe lo stesso codice di un altro.
-- ---------------------------------------------------------------------------
create or replace function cf_controllo(cf text)
  returns text language sql immutable set search_path = public as $$
  select chr(65 + (sum(case when i % 2 = 1
                            then (array[1,0,5,7,9,13,15,17,19,21,2,4,18,20,11,3,6,8,12,14,16,10,22,25,24,23])[v + 1]
                            else v end) % 26)::int)
  from (select i, case when c ~ '[0-9]' then ascii(c) - 48 else ascii(c) - 65 end as v
        from generate_series(1, 15) i, substr(cf, i, 1) c) x
$$;

-- Scritto giusto: la forma e il carattere di controllo.
create or replace function cf_valido(cf text)
  returns boolean language sql immutable set search_path = public as $$
  select coalesce(cf ~ '^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$'
                  and cf_controllo(cf) = substr(cf, 16, 1), false)
$$;

-- La data di nascita nel codice. L'anno ha due cifre: si prende il secolo più
-- recente che non la metta nel futuro. Null se il codice non va o se la data
-- non esiste.
create or replace function cf_nato_il(cf text)
  returns date language plpgsql stable set search_path = public as $$
declare
  aa int;
  mese int;
  gg int;
  nato date;
begin
  if not cf_valido(cf) then return null; end if;
  aa := translate(substr(cf, 7, 2), 'LMNPQRSTUV', '0123456789')::int;
  mese := position(substr(cf, 9, 1) in 'ABCDEHLMPRST');
  gg := translate(substr(cf, 10, 2), 'LMNPQRSTUV', '0123456789')::int;
  if gg > 40 then gg := gg - 40; end if;
  nato := make_date(2000 + aa, mese, gg);
  if nato > current_date then nato := make_date(1900 + aa, mese, gg); end if;
  return nato;
exception when others then
  return null;
end $$;

-- Le sei lettere di cognome e nome: le consonanti, poi le vocali, poi X; per
-- un nome con quattro consonanti o più, la prima, la terza e la quarta. Senza
-- accenti né apostrofi: «D'Agostino» → «DAGOSTINO».
create or replace function cf_lettere(nome text, cognome text)
  returns text language sql immutable set search_path = public as $$
  with l as (
    select regexp_replace(upper(regexp_replace(normalize(coalesce(x, ''), NFD), '[\u0300-\u036f]', '', 'g')), '[^A-Z]', '', 'g') as t, k
    from (values (cognome, 1), (nome, 2)) v(x, k)
  ), d as (select k, regexp_replace(t, '[AEIOU]', '', 'g') as c, regexp_replace(t, '[^AEIOU]', '', 'g') as v from l)
  select string_agg(case when k = 2 and length(c) >= 4 then substr(c, 1, 1) || substr(c, 3, 2)
                         else substr(c || v || 'XXX', 1, 3) end, '' order by k)
  from d
$$;

-- Il luogo di nascita: nel codice fiscale c'è il codice catastale del comune,
-- o dello stato estero. I nomi li riempie `17-luoghi.sql`, generato dalle
-- tabelle dell'ANPR; un codice può averne più d'uno nel tempo, e `al` dice
-- fino a quando è valso. Si legge solo da qui dentro.
create table if not exists luoghi_nascita (
  codice text not null,
  nome   text not null,
  sigla  text not null,
  al     date
);
create index if not exists luoghi_nascita_codice on luoghi_nascita (codice);
alter table luoghi_nascita enable row level security;
revoke all on luoghi_nascita from anon, authenticated;

-- «TORINO (TO)», o «ROMANIA»: il nome che il luogo aveva il giorno della
-- nascita, quello scritto nel modulo (l'anno del codice ha due cifre). Null
-- se non è nell'elenco (uno stato che non c'è più, un comune nuovo, o
-- `17-luoghi.sql` non lanciato): allora vale quel che si è scritto.
-- Le stesse regole di `luogoDaCf` in `src/lib/codiceFiscale.ts`.
create or replace function luogo_da_cf(cf text, nato date)
  returns text language sql stable security definer set search_path = public as $$
  select case when l.sigla = 'EE' then l.nome else l.nome || ' (' || l.sigla || ')' end
  from luoghi_nascita l, (select nato as n) q
  where cf_valido(cf) and l.codice = substr(cf, 12, 1) || translate(substr(cf, 13, 3), 'LMNPQRSTUV', '0123456789')
  order by l.al is not null and l.al < n, case when l.al is null or l.al >= n then coalesce(l.al, 'infinity') end, l.al desc
  limit 1
$$;

-- ---------------------------------------------------------------------------
-- La richiesta.
--
-- Tutto il controllo sta qui e non nel browser: chi chiama l'API con la chiave
-- pubblica salta il modulo, non questa funzione. Il genitore serve quando chi
-- si iscrive è minorenne, e lo decide la data di nascita, non una casella.
-- ---------------------------------------------------------------------------
create or replace function invia_iscrizione(dati jsonb)
  returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  regole jsonb := iscrizioni_regole();
  t text := '';
  nato date;
  minore boolean;
  scelti uuid[];
  mail citext := lower(trim(dati->>'email'));
  nuova uuid;
  cf text := upper(regexp_replace(coalesce(dati->>'codice_fiscale', ''), '\s', '', 'g'));
  cf_gen text := nullif(upper(regexp_replace(coalesce(dati->>'genitore_codice_fiscale', ''), '\s', '', 'g')), '');
  tel_2 text := nullif(trim(coalesce(dati->>'telefono_2', '')), '');
  testo text;
begin
  -- I campi di testo obbligatori, detti per nome se mancano.
  foreach testo in array array['nome:nome', 'cognome:cognome', 'nato_il:data di nascita', 'nato_a:luogo di nascita',
                               'codice_fiscale:codice fiscale', 'indirizzo:indirizzo', 'cap:CAP',
                               'comune:comune', 'email:email', 'telefono:telefono', 'formula:formula di pagamento'] loop
    if coalesce(trim(dati->>split_part(testo, ':', 1)), '') = '' then t := t || split_part(testo, ':', 2) || ', '; end if;
  end loop;
  if t <> '' then raise exception 'Mancano: %', rtrim(t, ', ') using errcode = '22023'; end if;

  begin
    nato := (dati->>'nato_il')::date;
  exception when others then
    raise exception 'La data di nascita non si capisce' using errcode = '22023';
  end;
  if nato is null or nato > current_date or nato < current_date - interval '100 years' then
    raise exception 'La data di nascita non torna' using errcode = '22023';
  end if;
  minore := nato > current_date - interval '18 years';
  if minore and (coalesce(trim(dati->>'genitore_nome'), '') = '' or coalesce(trim(dati->>'genitore_cognome'), '') = '' or cf_gen is null) then
    raise exception 'Per un minore servono nome, cognome e codice fiscale del genitore' using errcode = '22023';
  end if;
  if concat(dati->>'nome', dati->>'cognome', case when minore then concat(dati->>'genitore_nome', dati->>'genitore_cognome') end) ~ '[0-9]' then
    raise exception 'Un campo non va: nome e cognome non hanno numeri' using errcode = '22023';
  end if;

  -- Il codice fiscale: scritto giusto, e di chi deve essere.
  if cf !~ '^[A-Z0-9]{16}$' then
    raise exception 'Un campo non va: il codice fiscale ha 16 caratteri, lettere e numeri' using errcode = '22023';
  end if;
  if not cf_valido(cf) then
    raise exception 'Il codice fiscale non torna: controlla di averlo copiato giusto' using errcode = '22023';
  end if;
  if to_char(cf_nato_il(cf), 'YYMMDD') is distinct from to_char(nato, 'YYMMDD') then
    raise exception 'Il codice fiscale e la data di nascita non dicono lo stesso giorno: controlla l’uno e l’altra' using errcode = '22023';
  end if;
  if substr(cf, 1, 6) <> cf_lettere(dati->>'nome', dati->>'cognome') then
    raise exception 'Il codice fiscale non torna con nome e cognome: scrivili tutti, come sul documento' using errcode = '22023';
  end if;
  if minore then
    if cf_gen !~ '^[A-Z0-9]{16}$' then
      raise exception 'Un campo non va: il codice fiscale ha 16 caratteri, lettere e numeri' using errcode = '22023';
    end if;
    if not cf_valido(cf_gen) then
      raise exception 'Il codice fiscale del genitore non torna: controlla di averlo copiato giusto' using errcode = '22023';
    end if;
    if cf_gen = cf then
      raise exception 'Il codice fiscale del genitore è lo stesso di chi si iscrive' using errcode = '22023';
    end if;
    if cf_nato_il(cf_gen) > current_date - interval '18 years' then
      raise exception 'Il codice fiscale del genitore è di un minorenne' using errcode = '22023';
    end if;
    if substr(cf_gen, 1, 6) <> cf_lettere(dati->>'genitore_nome', dati->>'genitore_cognome') then
      raise exception 'Il codice fiscale del genitore non torna con il suo nome e cognome: scrivili tutti, come sul documento' using errcode = '22023';
    end if;
  end if;

  begin
    select array_agg(distinct x::uuid) into scelti from jsonb_array_elements_text(coalesce(dati->'corsi', '[]')) x;
  exception when others then
    raise exception 'I corsi scelti non si capiscono' using errcode = '22023';
  end;
  if scelti is null then raise exception 'Scegli almeno un corso' using errcode = '22023'; end if;
  if cardinality(scelti) > 6 then
    raise exception 'Un campo non va: si possono scegliere al massimo sei corsi' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(scelti) s where not exists (select 1 from corsi c where c.id = s and c.attivo)) then
    raise exception 'Uno dei corsi scelti non c''è più: ricarica la pagina' using errcode = '22023';
  end if;

  -- Gli altri campi, nell'ordine del modulo. I vincoli della tabella dicono
  -- le stesse cose, ma qui l'ordine è quello del browser.
  if trim(dati->>'cap') !~ '^[0-9]{5}$' then
    raise exception 'Un campo non va: il CAP ha 5 cifre' using errcode = '22023';
  end if;
  if mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Un campo non va: l''email non sembra giusta' using errcode = '22023';
  end if;
  if trim(dati->>'telefono') !~ '^\+?[0-9 ./()-]+$' or length(regexp_replace(dati->>'telefono', '\D', '', 'g')) not between 6 and 15 then
    raise exception 'Un campo non va: il telefono non sembra giusto' using errcode = '22023';
  end if;
  if tel_2 is not null and (tel_2 !~ '^\+?[0-9 ./()-]+$' or length(regexp_replace(tel_2, '\D', '', 'g')) not between 6 and 15) then
    raise exception 'Un campo non va: il secondo telefono non sembra giusto' using errcode = '22023';
  end if;
  if dati->>'formula' not in ('annuale', 'trimestre') then
    raise exception 'Un campo non va: si paga l''annuale o il trimestre' using errcode = '22023';
  end if;
  if coalesce(dati->>'regolamento', '') <> 'true' then
    raise exception 'Serve accettare il Regolamento Sociale' using errcode = '22023';
  end if;

  -- La porta.
  if (select count(*) from richieste_iscrizione where email = mail and creata_il > now() - interval '1 day')
     >= (regole->>'per_email_al_giorno')::int then
    raise exception 'Da questa email sono già arrivate % richieste oggi: se serve, scrivi alla segreteria', regole->>'per_email_al_giorno' using errcode = '54000';
  end if;
  -- Le rifiutate non contano, e le eliminate non ci sono più: chi riempie il
  -- modulo di richieste finte per chiuderlo agli altri, la segreteria lo
  -- sblocca togliendole.
  if (select count(*) from richieste_iscrizione where creata_il > now() - interval '1 hour' and stato <> 'rifiutata')
     >= (regole->>'in_tutto_all_ora')::int then
    raise exception 'In questo momento arrivano troppe richieste: riprova fra un po''' using errcode = '54000';
  end if;

  insert into richieste_iscrizione (
    nome, cognome, nato_il, nato_a, codice_fiscale, indirizzo, cap, comune, email, telefono, telefono_2,
    genitore_nome, genitore_cognome, genitore_codice_fiscale, corsi, formula, note, regolamento
  ) values (
    trim(dati->>'nome'), trim(dati->>'cognome'), nato, coalesce(luogo_da_cf(cf, nato), trim(dati->>'nato_a')), cf,
    trim(dati->>'indirizzo'), trim(dati->>'cap'), trim(dati->>'comune'), mail, trim(dati->>'telefono'), tel_2,
    case when minore then trim(dati->>'genitore_nome') end,
    case when minore then trim(dati->>'genitore_cognome') end,
    case when minore then cf_gen end,
    scelti, dati->>'formula', nullif(trim(dati->>'note'), ''), true
  ) returning id into nuova;
  return nuova;
exception
  -- Un vincolo della tabella (un CAP di quattro cifre, un codice fiscale corto)
  -- detto in chiaro invece che col nome del vincolo.
  when check_violation then
    raise exception 'Un campo non va: %', case
      when sqlerrm like '%codice_fiscale%' then 'il codice fiscale ha 16 caratteri, lettere e numeri'
      when sqlerrm like '%cap%' then 'il CAP ha 5 cifre'
      when sqlerrm like '%email%' then 'l''email non sembra giusta'
      when sqlerrm like '%telefono_2%' then 'il secondo telefono non sembra giusto'
      when sqlerrm like '%telefono%' then 'il telefono non sembra giusto'
      when sqlerrm like '%corsi%' then 'si possono scegliere al massimo sei corsi'
      when sqlerrm like '%formula%' then 'si paga l''annuale o il trimestre'
      else 'un testo è troppo lungo' end
      using errcode = '22023';
end $$;

-- ---------------------------------------------------------------------------
-- I file: modulo firmato, documento, certificato, ricevuta.
--
-- Stanno nello Storage di Supabase, in un contenitore privato: nessun link
-- pubblico, li apre la segreteria con un link che scade. Ogni richiesta ha la
-- sua cartella, `<id della richiesta>/`, e chi l'ha appena mandata ci può
-- mettere al massimo cinque file, dei tipi giusti, entro un'ora. Non li può
-- rileggere né sostituire: caricato è caricato.
--
-- Il documento d'identità (`documento`, `documento-retro`) e il certificato
-- medico (`certificato`) la segreteria li stampa e li cancella.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('iscrizioni', 'iscrizioni', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function puo_caricare(nome_file text)
  returns boolean language plpgsql stable security definer set search_path = public, extensions as $$
declare
  regole jsonb := iscrizioni_regole();
  cartella uuid;
begin
  if nome_file !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(modulo|documento|documento-retro|certificato|ricevuta)\.(jpg|jpeg|png|webp|heic|heif|pdf)$' then
    return false;
  end if;
  cartella := split_part(nome_file, '/', 1)::uuid;
  return exists (
      select 1 from richieste_iscrizione r
      where r.id = cartella and r.stato = 'nuova'
        and r.creata_il > now() - make_interval(mins => (regole->>'minuti_per_i_file')::int))
    and (select count(*) from storage.objects o
         where o.bucket_id = 'iscrizioni' and o.name like cartella::text || '/%') < (regole->>'file_per_richiesta')::int;
end $$;

drop policy if exists iscrizioni_carica on storage.objects;
drop policy if exists iscrizioni_legge on storage.objects;
drop policy if exists iscrizioni_cancella on storage.objects;
create policy iscrizioni_carica on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'iscrizioni' and public.puo_caricare(name));
create policy iscrizioni_legge on storage.objects for select to authenticated
  using (bucket_id = 'iscrizioni' and public.e_staff());
create policy iscrizioni_cancella on storage.objects for delete to authenticated
  using (bucket_id = 'iscrizioni' and public.e_staff());

-- ---------------------------------------------------------------------------
-- Accogliere una richiesta: la persona in elenco, iscritta ai suoi corsi.
--
-- Se in elenco c'è già si usa quella, così chi torna dopo un anno non
-- diventa un doppione. La segreteria la può indicare lei (`persona`): la
-- pagina le mostra chi ha già lo stesso nome e cognome, e un iscritto che la
-- prima volta ha dato la sua email e stavolta quella della mamma solo lei lo
-- riconosce. Se non la indica, la si cerca: dal codice fiscale (di una
-- richiesta accolta prima, o dei dati anagrafici importati), o da nome e
-- cognome con la stessa email, nessuna, o lo stesso telefono. Due fratelli
-- iscritti dallo stesso genitore hanno la stessa email, che in `persone` può
-- essere di uno solo: il secondo entra senza email, col telefono, e la
-- richiesta ricorda comunque come raggiungerlo.
-- ---------------------------------------------------------------------------
-- Prima c'era con un argomento solo: le due si confonderebbero.
drop function if exists accogli_iscrizione(uuid);
create or replace function accogli_iscrizione(richiesta uuid, persona uuid default null)
  returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  r richieste_iscrizione;
  chi uuid;
  oggi date := (now() at time zone 'Europe/Rome')::date;
  -- Le ultime dieci cifre: «+39 347 791 7462» e «3477917462» sono lo stesso numero.
  tel text;
begin
  if not e_staff() then raise exception 'solo la segreteria' using errcode = '42501'; end if;
  select * into r from richieste_iscrizione where id = richiesta for update;
  if r.id is null then raise exception 'richiesta inesistente' using errcode = 'P0002'; end if;
  if r.stato <> 'nuova' then raise exception 'Questa richiesta è già stata %', r.stato using errcode = '22023'; end if;

  if persona is not null then
    select id into chi from persone where id = persona;
    if chi is null then raise exception 'Questa scheda non c''è più' using errcode = 'P0002'; end if;
  end if;

  -- Il codice fiscale è l'unica cosa sicura: una richiesta già accolta con lo
  -- stesso porta alla stessa persona, anche se stavolta l'ha mandata l'altro
  -- genitore con la sua email.
  if chi is null then
    select q.persona_id into chi from richieste_iscrizione q
      join persone p on p.id = q.persona_id
      where q.codice_fiscale = r.codice_fiscale and q.id <> r.id
      order by q.gestita_il desc nulls last
      limit 1;
  end if;
  -- O quello dei dati anagrafici, per chi è arrivato dalle risposte del
  -- modulo Google (se `18-anagrafiche.sql` c'è già).
  if chi is null and to_regclass('public.anagrafiche') is not null then
    execute 'select persona_id from anagrafiche where codice_fiscale = $1 limit 1' into chi using r.codice_fiscale;
  end if;
  if chi is null then
    tel := right(regexp_replace(coalesce(r.telefono, ''), '\D', '', 'g'), 10);
    select id into chi from persone
      where lower(nome) = lower(r.nome) and lower(cognome) = lower(r.cognome)
        and (email is null or email = r.email
             or (length(tel) >= 9 and right(regexp_replace(coalesce(telefono, ''), '\D', '', 'g'), 10) = tel))
      order by (email = r.email) desc nulls last, creata_il
      limit 1;
  end if;
  if chi is null then
    insert into persone (nome, cognome, email, telefono, ruolo)
    values (r.nome, r.cognome,
            case when not exists (select 1 from persone where email = r.email) then r.email end,
            r.telefono, 'iscritto')
    returning id into chi;
  else
    update persone set attiva = true,
      telefono = coalesce(telefono, r.telefono),
      email = coalesce(email, case when not exists (select 1 from persone where email = r.email) then r.email end)
    where id = chi;
  end if;

  -- Chi è già iscritto resta com'è; chi aveva una fine segnata la perde, e
  -- chi aveva già smesso riparte da oggi.
  insert into iscrizioni (corso_id, persona_id, dal)
    select c.id, chi, oggi from corsi c where c.id = any (r.corsi) and c.attivo
  on conflict (corso_id, persona_id) do update
    set dal = case when iscrizioni.al < oggi then oggi else iscrizioni.dal end, al = null
    where iscrizioni.al is not null;

  update richieste_iscrizione
    set stato = 'accolta', persona_id = chi, gestita_da = persona_corrente(), gestita_il = now()
    where id = richiesta;
  return chi;
end $$;

create or replace function rifiuta_iscrizione(richiesta uuid)
  returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not e_staff() then raise exception 'solo la segreteria' using errcode = '42501'; end if;
  update richieste_iscrizione
    set stato = 'rifiutata', gestita_da = persona_corrente(), gestita_il = now()
    where id = richiesta and stato = 'nuova';
  if not found then raise exception 'Questa richiesta non è più nuova' using errcode = '22023'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- Le richieste che hanno ancora il documento d'identità o il certificato
-- medico caricato: la segreteria le trova qui, li stampa e li cancella. Lo
-- Storage non si legge dall'API delle tabelle, e guardare le cartelle una
-- per una vorrebbe dire una chiamata per richiesta.
-- ---------------------------------------------------------------------------
create or replace function richieste_con_documento()
  returns uuid[] language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not e_staff() then raise exception 'solo la segreteria' using errcode = '42501'; end if;
  return coalesce((
    select array_agg(distinct split_part(o.name, '/', 1)::uuid) from storage.objects o
    where o.bucket_id = 'iscrizioni'
      and o.name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(documento|documento-retro|certificato)\.[a-z]+$'), '{}');
end $$;

-- ---------------------------------------------------------------------------
-- Chi può chiamare cosa.
--
-- Finora `anon` non aveva nemmeno lo schema, e questo copriva anche le
-- funzioni rimaste col permesso di default di Postgres (a tutti). Ora lo
-- schema gli si apre per le due funzioni del modulo, quindi prima gli si
-- tolgono tutte le altre: `materializza_sessioni` e `pulisci_presenze`, per
-- dirne due, lasciano passare chi non ha un utente perché è così che le
-- chiama un job. Chi aveva il permesso per default lo tiene se ha un accesso.
-- ---------------------------------------------------------------------------
do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p
    where p.pronamespace = 'public'::regnamespace and has_function_privilege('anon', p.oid, 'execute')
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
-- Le funzioni che verranno, invece, nascono ancora eseguibili da `anon`: per
-- il permesso di default di Postgres, a tutti, che un `alter default
-- privileges in schema public` non toglie (ci si aggiunge), e su Supabase
-- anche per il default di `postgres` in `public`, che le dà ad `anon` e ad
-- `authenticated` per nome. Così ogni file toglie i permessi alle funzioni
-- sue, `controllo.sql` e `prova/rls.sql` guardano che `anon` chiami solo
-- quelle qui sotto, e rilanciare questo file rimette a posto.

grant usage on schema public to anon;
grant execute on function corsi_aperti(), invia_iscrizione(jsonb), puo_caricare(text), iscrizioni_regole() to anon, authenticated;
grant execute on function accogli_iscrizione(uuid, uuid), rifiuta_iscrizione(uuid), richieste_con_documento() to authenticated;
-- Il listino della pagina di iscrizione, se 19-listino.sql è già stato lanciato.
do $$
begin
  if to_regprocedure('public.listino()') is not null then
    grant execute on function listino() to anon, authenticated;
  end if;
end $$;
-- Per quanto si tengono le presenze, per l'informativa privacy, se
-- 31-informativa-mesi.sql è già stato lanciato.
do $$
begin
  if to_regprocedure('public.mesi_presenze_pubblici()') is not null then
    grant execute on function mesi_presenze_pubblici() to anon, authenticated;
  end if;
end $$;
-- Le tabelle restano chiuse, anche quelle che verranno: Supabase per default
-- le dà ad `anon`, e l'RLS da sola è una porta sola invece di due.
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

-- Che l'API veda subito funzioni e tabelle nuove, senza aspettare.
notify pgrst, 'reload schema';
