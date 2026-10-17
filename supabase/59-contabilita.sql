-- ODS Corsi · la contabilità di base: voci, casse, movimenti
--
-- Per chi cura i conti. Le entrate e le uscite della palestra, ciascuna con la
-- sua voce, in due casse (Cassa Contanti e Conto Corrente). Un giroconto sposta
-- soldi fra le due casse, per il versamento in banca: non è un'entrata né
-- un'uscita.
--
-- Chi può cosa: solo chi ha il ruolo di amministrazione (`e_amministrazione()`,
-- 55-amministrazione.sql): la segreteria semplice, gli istruttori, i tablet, gli
-- iscritti e chi non ha fatto l'accesso non leggono niente e non chiamano
-- niente. Le tabelle si leggono con SELECT e si scrivono solo dalle funzioni:
-- nessun grant diretto, nemmeno all'amministrazione.
--
-- Gli incassi degli iscritti NON stanno qui: restano in `ricevute` e
-- `pagamenti_diretti`, e l'app li somma ai movimenti (`src/lib/contabilita.ts`),
-- così non si ricopiano e un annullo si vede da sé. `pagato fino al` non è un
-- incasso.
--
-- Un movimento non si modifica né si cancella: si annulla (`annullato_il`) e si
-- rifà. Solo la descrizione e la nota si correggono. Un solo importo, in
-- centesimi, senza IVA. La data non è nel futuro e non precede l'inizio della
-- cassa (`casse.dal`). Il saldo iniziale è un campo della cassa, non un
-- movimento.
--
-- Una voce è solo di entrata o solo di uscita, con un nome unico per tipo
-- (senza badare a maiuscole e spazi). Le due di sistema («Quota associativa»,
-- «Corsi e altri pagamenti») servono agli incassi degli iscritti e non si
-- cambiano. Una voce usata non si cancella: si disattiva. Non c'è nessuna
-- «Varie» di serie.
--
-- Si lancia dopo `55-amministrazione.sql`. Non chiede di rilanciare
-- `06-iscrizioni.sql` e non lo tocca nessun rilancio di 16, 54 o 55: le tabelle
-- sono sue. Finché non c'è, la voce CONTABILITÀ dice di lanciare questo file e
-- il resto dell'area amministrazione funziona. La chiusura delle casse, il
-- previsto e la natura delle voci arrivano dopo.
-- ---------------------------------------------------------------------------

create table if not exists voci_contabili (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  tipo       text not null check (tipo in ('entrata', 'uscita')),
  di_sistema boolean not null default false,
  attiva     boolean not null default true,
  creata_il  timestamptz not null default now()
);
create unique index if not exists voci_contabili_nome on voci_contabili (tipo, lower(trim(nome)));

create table if not exists casse (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null unique,
  -- Centesimi. Da `dal` si contano i movimenti; vuoto = tutti.
  saldo_iniziale integer not null default 0,
  dal           date
);

create table if not exists movimenti (
  id          uuid primary key default gen_random_uuid(),
  tipo        text not null check (tipo in ('entrata', 'uscita', 'giroconto')),
  data        date not null,
  importo     integer not null check (importo > 0),
  -- Il giroconto non ha voce e ha una seconda cassa; gli altri hanno la voce e basta.
  voce_id     uuid references voci_contabili,
  cassa_id    uuid not null references casse,
  cassa_a_id  uuid references casse,
  descrizione text not null check (char_length(descrizione) between 1 and 200),
  nota        text check (char_length(nota) <= 300),
  creato_da   uuid references persone on delete set null,
  creato_il   timestamptz not null default now(),
  annullato_il timestamptz,
  annullato_da uuid references persone on delete set null,
  check ((tipo = 'giroconto' and voce_id is null and cassa_a_id is not null and cassa_a_id <> cassa_id)
      or (tipo <> 'giroconto' and voce_id is not null and cassa_a_id is null))
);
create index if not exists movimenti_data on movimenti (data desc);

insert into casse (nome) values ('Cassa Contanti'), ('Conto Corrente') on conflict do nothing;
insert into voci_contabili (nome, tipo, di_sistema) values
  ('Quota associativa', 'entrata', true),
  ('Corsi e altri pagamenti', 'entrata', true)
on conflict do nothing;

alter table voci_contabili enable row level security;
alter table casse          enable row level security;
alter table movimenti      enable row level security;
revoke all on voci_contabili, casse, movimenti from anon, authenticated;
grant select on voci_contabili, casse, movimenti to authenticated;
drop policy if exists voci_contabili_legge on voci_contabili;
create policy voci_contabili_legge on voci_contabili for select to authenticated using (e_amministrazione());
drop policy if exists casse_legge on casse;
create policy casse_legge on casse for select to authenticated using (e_amministrazione());
drop policy if exists movimenti_legge on movimenti;
create policy movimenti_legge on movimenti for select to authenticated using (e_amministrazione());

-- La porta di ogni funzione: prima di qualunque altro controllo.
create or replace function contabilita_porta() returns void
  language plpgsql stable security definer set search_path = public as $$
begin
  if not e_amministrazione() then
    raise exception 'la contabilità la cura l’amministrazione' using errcode = '42501';
  end if;
end $$;

-- Oggi, a Roma: un movimento non è nel futuro, e a mezzanotte il server è già al giorno dopo.
create or replace function contabilita_oggi() returns date
  language sql stable set search_path = public as $$
  select (now() at time zone 'Europe/Rome')::date
$$;

-- Un id che arriva dall'app: se non è un id si dice come se mancasse, mai il testo grezzo di Postgres.
create or replace function contabilita_id(dati jsonb, chiave text, errore text) returns uuid
  language plpgsql immutable set search_path = public as $$
begin
  return nullif(dati->>chiave, '')::uuid;
exception when others then
  raise exception '%', errore using errcode = '22023';
end $$;

-- Un testo che arriva dall'app: solo se è davvero testo (un oggetto o una lista non lo sono).
create or replace function contabilita_testo(dati jsonb, chiave text) returns text
  language sql immutable set search_path = public as $$
  select case when jsonb_typeof(dati->chiave) = 'string' then trim(dati->>chiave) else '' end
$$;

-- Le voci -------------------------------------------------------------------
create or replace function salva_voce(dati jsonb) returns voci_contabili
  language plpgsql security definer set search_path = public as $$
declare
  n text := contabilita_testo(dati, 'nome');
  t text := dati->>'tipo';
  r voci_contabili;
begin
  perform contabilita_porta();
  if n = '' then raise exception 'Scrivi il nome della voce' using errcode = '22023'; end if;
  if char_length(n) > 60 then raise exception 'Il nome della voce è troppo lungo: al massimo 60 caratteri' using errcode = '22023'; end if;
  if t is null or t not in ('entrata', 'uscita') then raise exception 'Scegli se è un’entrata o un’uscita' using errcode = '22023'; end if;
  if exists (select 1 from voci_contabili where tipo = t and lower(trim(nome)) = lower(n)) then
    raise exception 'C’è già una voce «%» tra le %', n, case t when 'entrata' then 'entrate' else 'uscite' end using errcode = '22023';
  end if;
  insert into voci_contabili (nome, tipo) values (n, t) returning * into r;
  return r;
exception when unique_violation then
  -- due che salvano lo stesso nome insieme: la seconda trova la voce già fatta dalla prima
  raise exception 'C’è già una voce «%» tra le %', n, case t when 'entrata' then 'entrate' else 'uscite' end using errcode = '22023';
end $$;

create or replace function rinomina_voce(id uuid, nome text) returns void
  language plpgsql security definer set search_path = public as $$
declare
  v voci_contabili;
  n text := trim(coalesce(nome, ''));
begin
  perform contabilita_porta();
  select * into v from voci_contabili x where x.id = rinomina_voce.id;
  if not found then raise exception 'La voce non c’è' using errcode = 'P0002'; end if;
  if v.di_sistema then raise exception 'Le voci di sistema non si cambiano' using errcode = '22023'; end if;
  if n = '' then raise exception 'Scrivi il nome della voce' using errcode = '22023'; end if;
  if char_length(n) > 60 then raise exception 'Il nome della voce è troppo lungo: al massimo 60 caratteri' using errcode = '22023'; end if;
  if exists (select 1 from voci_contabili x where x.tipo = v.tipo and x.id <> v.id and lower(trim(x.nome)) = lower(n)) then
    raise exception 'C’è già una voce «%» tra le %', n, case v.tipo when 'entrata' then 'entrate' else 'uscite' end using errcode = '22023';
  end if;
  update voci_contabili x set nome = n where x.id = v.id;
exception when unique_violation then
  raise exception 'C’è già una voce «%» tra le %', n, case v.tipo when 'entrata' then 'entrate' else 'uscite' end using errcode = '22023';
end $$;

create or replace function imposta_voce_attiva(id uuid, attiva boolean) returns void
  language plpgsql security definer set search_path = public as $$
declare v voci_contabili;
begin
  perform contabilita_porta();
  select * into v from voci_contabili x where x.id = imposta_voce_attiva.id;
  if not found then raise exception 'La voce non c’è' using errcode = 'P0002'; end if;
  if v.di_sistema then raise exception 'Le voci di sistema non si cambiano' using errcode = '22023'; end if;
  update voci_contabili x set attiva = imposta_voce_attiva.attiva where x.id = v.id;
end $$;

-- Il saldo iniziale di una cassa --------------------------------------------
create or replace function imposta_saldo_cassa(id uuid, saldo integer, dal date) returns void
  language plpgsql security definer set search_path = public as $$
begin
  perform contabilita_porta();
  -- for update: chi registra un movimento sulla cassa nello stesso momento aspetta e vede la data nuova
  perform 1 from casse c where c.id = imposta_saldo_cassa.id for update;
  if not found then raise exception 'La cassa non c’è' using errcode = 'P0002'; end if;
  if saldo is null or saldo < 0 then raise exception 'Il saldo iniziale non può essere negativo' using errcode = '22023'; end if;
  if saldo > 100000000 then raise exception 'Il saldo iniziale è troppo alto: controlla le cifre' using errcode = '22023'; end if;
  if dal is not null and dal < date '2000-01-01' then raise exception 'La data non si capisce' using errcode = '22023'; end if;
  if dal is not null and dal > contabilita_oggi() then raise exception 'L’inizio della cassa non può essere nel futuro' using errcode = '22023'; end if;
  -- i movimenti prima di quella data il saldo li ignorerebbe in silenzio
  if dal is not null and exists (select 1 from movimenti m where (m.cassa_id = imposta_saldo_cassa.id or m.cassa_a_id = imposta_saldo_cassa.id)
      and m.annullato_il is null and m.data < dal) then
    raise exception 'Ci sono movimenti prima di quella data: annullali o scegli una data più vecchia' using errcode = '22023';
  end if;
  update casse c set saldo_iniziale = saldo, dal = imposta_saldo_cassa.dal where c.id = imposta_saldo_cassa.id;
end $$;

-- Quello che un movimento e un giroconto hanno in comune: importo, data, nota.
create or replace function movimento_comune(dati jsonb, out giorno date, out importo integer, out nota text)
  language plpgsql stable set search_path = public as $$
begin
  begin importo := (dati->>'importo')::integer; exception when others then
    raise exception 'L’importo non si capisce' using errcode = '22023';
  end;
  if importo is null then raise exception 'L’importo non si capisce' using errcode = '22023'; end if;
  if importo <= 0 then raise exception 'L’importo deve essere più di zero' using errcode = '22023'; end if;
  if importo > 10000000 then raise exception 'L’importo è troppo alto: controlla le cifre' using errcode = '22023'; end if;
  begin giorno := (dati->>'data')::date; exception when others then
    raise exception 'La data non si capisce' using errcode = '22023';
  end;
  if giorno is null then raise exception 'La data non si capisce' using errcode = '22023'; end if;
  if giorno < date '2000-01-01' then raise exception 'La data non si capisce' using errcode = '22023'; end if;
  if giorno > contabilita_oggi() then raise exception 'La data è nel futuro: si registra quel che è già successo' using errcode = '22023'; end if;
  if coalesce(jsonb_typeof(dati->'nota'), 'string') not in ('string', 'null') then raise exception 'La nota non si capisce' using errcode = '22023'; end if;
  nota := nullif(trim(coalesce(dati->>'nota', '')), '');
  if char_length(coalesce(nota, '')) > 300 then raise exception 'La nota è troppo lunga: al massimo 300 caratteri' using errcode = '22023'; end if;
end $$;

-- I movimenti ----------------------------------------------------------------
create or replace function registra_movimento(dati jsonb) returns movimenti
  language plpgsql security definer set search_path = public as $$
declare
  c record;
  v voci_contabili;
  ca casse;
  r movimenti;
  t text := dati->>'tipo';
  d text := contabilita_testo(dati, 'descrizione');
begin
  perform contabilita_porta();
  if t is null or t not in ('entrata', 'uscita') then raise exception 'Scegli se è un’entrata o un’uscita' using errcode = '22023'; end if;
  select * into c from movimento_comune(dati);
  select * into v from voci_contabili where id = contabilita_id(dati, 'voce_id', 'Scegli la voce');
  if not found then raise exception 'Scegli la voce' using errcode = '22023'; end if;
  if v.tipo <> t then raise exception 'La voce scelta non va con questo tipo di movimento' using errcode = '22023'; end if;
  if not v.attiva then raise exception 'La voce non è più in uso: scegline un’altra' using errcode = '22023'; end if;
  select * into ca from casse where id = contabilita_id(dati, 'cassa_id', 'Scegli la cassa') for share;
  if not found then raise exception 'Scegli la cassa' using errcode = '22023'; end if;
  if ca.dal is not null and c.giorno < ca.dal then raise exception 'La data è prima dell’inizio della cassa' using errcode = '22023'; end if;
  if d = '' then raise exception 'Scrivi una descrizione' using errcode = '22023'; end if;
  if char_length(d) > 200 then raise exception 'La descrizione è troppo lunga: al massimo 200 caratteri' using errcode = '22023'; end if;
  insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione, nota, creato_da)
  values (t, c.giorno, c.importo, v.id, ca.id, d, c.nota, persona_corrente())
  returning * into r;
  return r;
end $$;

create or replace function registra_giroconto(dati jsonb) returns movimenti
  language plpgsql security definer set search_path = public as $$
declare
  c record;
  da casse;
  a casse;
  r movimenti;
begin
  perform contabilita_porta();
  select * into da from casse where id = contabilita_id(dati, 'da', 'Scegli le due casse') for share;
  select * into a from casse where id = contabilita_id(dati, 'a', 'Scegli le due casse') for share;
  if da.id is null or a.id is null then raise exception 'Scegli le due casse' using errcode = '22023'; end if;
  if da.id = a.id then raise exception 'Scegli due casse diverse' using errcode = '22023'; end if;
  select * into c from movimento_comune(dati);
  if (da.dal is not null and c.giorno < da.dal) or (a.dal is not null and c.giorno < a.dal) then
    raise exception 'La data è prima dell’inizio della cassa' using errcode = '22023';
  end if;
  insert into movimenti (tipo, data, importo, cassa_id, cassa_a_id, descrizione, nota, creato_da)
  values ('giroconto', c.giorno, c.importo, da.id, a.id, 'Giroconto da ' || da.nome || ' a ' || a.nome, c.nota, persona_corrente())
  returning * into r;
  return r;
end $$;

create or replace function annulla_movimento(id uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare m movimenti;
begin
  perform contabilita_porta();
  select * into m from movimenti x where x.id = annulla_movimento.id for update;
  if not found then raise exception 'Il movimento non c’è' using errcode = 'P0002'; end if;
  if m.annullato_il is not null then raise exception 'Il movimento è già annullato' using errcode = 'P0002'; end if;
  update movimenti x set annullato_il = now(), annullato_da = persona_corrente() where x.id = m.id;
end $$;

create or replace function correggi_testo_movimento(id uuid, descrizione text, nota text) returns void
  language plpgsql security definer set search_path = public as $$
declare
  m movimenti;
  d text := trim(coalesce(descrizione, ''));
  n text := nullif(trim(coalesce(nota, '')), '');
begin
  perform contabilita_porta();
  select * into m from movimenti x where x.id = correggi_testo_movimento.id for update;
  if not found then raise exception 'Il movimento non c’è' using errcode = 'P0002'; end if;
  if m.annullato_il is not null then raise exception 'Un movimento annullato non si corregge' using errcode = '22023'; end if;
  if d = '' then raise exception 'Scrivi una descrizione' using errcode = '22023'; end if;
  if char_length(d) > 200 then raise exception 'La descrizione è troppo lunga: al massimo 200 caratteri' using errcode = '22023'; end if;
  if char_length(coalesce(n, '')) > 300 then raise exception 'La nota è troppo lunga: al massimo 300 caratteri' using errcode = '22023'; end if;
  update movimenti x set descrizione = d, nota = n where x.id = m.id;
end $$;

-- Chi può chiamare cosa: le funzioni interne nessuno da fuori, le altre solo chi ha fatto l'accesso
-- (poi la porta dice se è amministrazione).
revoke all on function contabilita_porta(), contabilita_oggi(), contabilita_id(jsonb, text, text), contabilita_testo(jsonb, text), movimento_comune(jsonb) from public, anon, authenticated;
revoke all on function salva_voce(jsonb), rinomina_voce(uuid, text), imposta_voce_attiva(uuid, boolean),
  imposta_saldo_cassa(uuid, integer, date), registra_movimento(jsonb), registra_giroconto(jsonb),
  annulla_movimento(uuid), correggi_testo_movimento(uuid, text, text) from public, anon;
grant execute on function salva_voce(jsonb), rinomina_voce(uuid, text), imposta_voce_attiva(uuid, boolean),
  imposta_saldo_cassa(uuid, integer, date), registra_movimento(jsonb), registra_giroconto(jsonb),
  annulla_movimento(uuid), correggi_testo_movimento(uuid, text, text) to authenticated;

-- Che l'API veda subito funzioni e tabelle nuove, senza aspettare.
notify pgrst, 'reload schema';
