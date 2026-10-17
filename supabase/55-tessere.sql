-- ---------------------------------------------------------------------------
-- ODS Corsi · le tessere
--
-- Chi è tesserato, con quale ente, di che tipo e fino a quando. Il dato viene
-- dal RASD (tab Tesseramenti): organismo, persona, codice fiscale, tipo,
-- codice tessera, valida dal. Le tessere durano un anno e scadono il 31
-- dicembre: restano in archivio, così si vede anche chi era tesserato prima.
-- Una persona può averne più d'una nello stesso anno (praticante e agonista
-- nello stesso ente; due enti): la chiave è (persona, ente, tipo, dal).
--
-- Solo la segreteria (`e_staff()`) le legge e le scrive, come le anagrafiche
-- che hanno il codice fiscale. Nessun accesso ad `anon`, né a istruttori e
-- iscritti. Una tessera se ne va con la persona (`on delete cascade`): è un
-- dato dell'ente, si rifà dall'import.
--
-- `corsi.ente_tessera` dice quale tessera chiede un corso (null = nessuna).
-- Gli enti si scrivono in maiuscolo (FIJLKAM, FIPE): il database li tiene così.
--
-- `importa_tessere(righe, solo_prova)`: l'import dal foglio del RASD. Aggancia
-- la persona dal codice fiscale E dallo stesso nome (come
-- `53-codice-fiscale-stesso-nome.sql`: il codice lo sanno anche altri), non
-- crea mai persone, si può rilanciare senza doppioni, e con `solo_prova` dice
-- cosa farebbe senza scrivere (l'anteprima).
--
-- `incrocio_tessere(oggi)`: una riga per persona ed ente, solo quelle da
-- guardare: iscritti a un corso che chiede la tessera ma senza una valida
-- (manca, scaduta, in scadenza entro 60 giorni) e tesserati senza corso. Le
-- prove gratuite non sono iscrizioni (stanno in `prove`): non contano.
--
-- L'unione di due schede (`unisci_persone`, 29/45) sposta già ogni tabella
-- che punta a `persone`. Se la stessa tessera è su tutte e due la chiave unica
-- si fermerebbe: il trigger `tessere_unione` tiene quella di chi resta e butta
-- l'altra.
--
-- Si lancia dopo `18-anagrafiche.sql` e `29-unisci-doppioni.sql`. Si può
-- rilanciare. Non chiede di rilanciare `06-iscrizioni.sql`. Finché non c'è,
-- l'app non mostra tessere, né la colonna nel corso, e IMPORTA dice che va
-- lanciato.
-- ---------------------------------------------------------------------------

create table if not exists tessere (
  id         uuid primary key default gen_random_uuid(),
  persona_id uuid not null references persone on delete cascade,
  ente       text not null check (char_length(btrim(ente)) between 1 and 40 and ente = upper(btrim(ente))),
  tipo       text not null check (tipo in ('praticante', 'agonista', 'dirigente', 'tecnico', 'altro')),
  codice     text not null check (char_length(btrim(codice)) between 1 and 20),
  dal        date not null check (dal between date '2000-01-01' and date '2100-12-31'),
  al         date not null check (al between date '2000-01-01' and date '2100-12-31'),
  -- Da dove viene: il foglio del RASD o scritta a mano dalla segreteria.
  origine    text not null default 'manuale' check (origine in ('rasd', 'manuale')),
  creata_il  timestamptz not null default now(),
  creata_da  uuid references persone on delete set null,
  constraint tessera_periodo check (al >= dal),
  unique (persona_id, ente, tipo, dal)
);
create index if not exists tessere_persona on tessere (persona_id, al desc);

alter table tessere enable row level security;
drop policy if exists tessere_legge on tessere;
drop policy if exists tessere_scrive on tessere;
drop policy if exists tessere_aggiorna on tessere;
drop policy if exists tessere_cancella on tessere;
create policy tessere_legge on tessere for select to authenticated using (e_staff());
create policy tessere_scrive on tessere for insert to authenticated with check (e_staff());
create policy tessere_aggiorna on tessere for update to authenticated using (e_staff()) with check (e_staff());
create policy tessere_cancella on tessere for delete to authenticated using (e_staff());
revoke all on tessere from anon, authenticated;
grant select, insert, update, delete on tessere to authenticated;

-- Quale tessera chiede un corso. Null: nessuna (psicomotricità, ludico…).
-- La mappa dei corsi esistenti si scrive una volta sola, quando la colonna
-- nasce: rilanciando il file non si rimette sopra una scelta della segreteria.
-- Judo, Lotta, Aikido, MGA e Avviamento chiedono FIJLKAM; la sala Pesi FIPE;
-- Giocomotricità, Psicomotricità (e Prepugilistica, deciso con la segreteria) nessuna.
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'corsi' and column_name = 'ente_tessera') then
    alter table corsi add column ente_tessera text
      check (ente_tessera is null or (char_length(btrim(ente_tessera)) between 1 and 40 and ente_tessera = upper(btrim(ente_tessera))));
    update corsi set ente_tessera = 'FIJLKAM'
     where nome ilike 'Judo%' or nome ilike 'Lotta%' or nome ilike 'Aikido%'
        or nome ilike 'MGA%' or nome ilike 'Avviamento%';
    update corsi set ente_tessera = 'FIPE'
     where nome ilike 'Pesi%' or nome ilike 'Pesistica%' or nome ilike 'Preparazione atletica%';
  end if;
end $$;

-- Le parole di un nome, in maiuscolo, senza accenti né apostrofi, in ordine:
-- «GULLI'» e «Gullì», «ROCCO MAURIZIO INNELLA» e «Innella Rocco Maurizio» sono
-- lo stesso nome. Il RASD scrive nome e cognome in un solo campo, non si
-- separano: si confrontano le parole.
create or replace function parole_nome(t text) returns text
  language sql immutable set search_path = public as $$
  select coalesce(string_agg(w, ' ' order by w), '')
    from unnest(string_to_array(
           regexp_replace(translate(upper(coalesce(t, '')), 'ÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÑÇÝŠŽ', 'AAAAAAEEEEIIIIOOOOOUUUUNCYSZ'), '[^A-Z ]', '', 'g'),
           ' ')) as w
   where w <> '';
$$;

-- Una tessera che arriva da una persona che ne ha già una uguale (stessa
-- chiave) non entra: resta quella che c'era, l'altra si butta. Serve a
-- `unisci_persone`, che sposta le righe una tabella alla volta.
create or replace function tessere_unione() returns trigger
  language plpgsql set search_path = public as $$
begin
  if exists (select 1 from tessere t
              where t.persona_id = new.persona_id and t.ente = new.ente and t.tipo = new.tipo and t.dal = new.dal
                and t.id <> new.id) then
    delete from tessere where id = old.id;
    return null;
  end if;
  return new;
end $$;
drop trigger if exists tessere_unione on tessere;
create trigger tessere_unione before update of persona_id on tessere
  for each row execute function tessere_unione();

-- L'import dal RASD. `righe` è un array di
-- {ente, nome, codice_fiscale, tipo, codice, dal, al}, una riga per tessera
-- (tipo già tradotto: «Atleta Praticante» → praticante, «Atleta Agonista» →
-- agonista, «Dirigente» → dirigente; `al` è il 31 dicembre dell'anno).
-- Non crea mai persone: chi non c'è va nell'elenco `non_abbinate`, col motivo:
--   nessuna_scheda   nessuna scheda ha quel codice fiscale
--   nome_diverso     c'è, ma con un altro nome (la segreteria guarda a mano)
--   riga_non_valida  ente, tipo, codice o date che non vanno
-- Rilanciare lo stesso foglio non crea doppioni: una tessera già presente
-- (stessa persona, ente, tipo e `dal`) non cambia.
create or replace function importa_tessere(righe jsonb, solo_prova boolean default true)
  returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  r jsonb;
  chi uuid;
  n_nuove int := 0;
  n_gia int := 0;
  esiti jsonb := '[]'::jsonb;
  viste text[] := '{}';
  v_ente text;
  v_cf text;
  v_nome text;
  v_chiave text;
  v_dal date;
  v_al date;
  v_motivo text;
begin
  if not e_staff() then raise exception 'solo la segreteria' using errcode = '42501'; end if;
  if righe is null or jsonb_typeof(righe) <> 'array' or jsonb_array_length(righe) > 2000 then
    raise exception 'Il foglio non è nel formato giusto, o ha più di 2000 righe' using errcode = '22023';
  end if;

  for r in select * from jsonb_array_elements(righe) loop
    v_ente := upper(btrim(coalesce(r ->> 'ente', '')));
    v_cf := upper(btrim(coalesce(r ->> 'codice_fiscale', '')));
    v_nome := btrim(coalesce(r ->> 'nome', ''));
    v_motivo := null;
    v_dal := null;
    v_al := null;
    begin
      -- Solo la forma AAAA-MM-GG: «01/09/2026» il database lo leggerebbe a modo suo, e sbagliando.
      if (r ->> 'dal') !~ '^\d{4}-\d{2}-\d{2}$' or (r ->> 'al') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'data'; end if;
      v_dal := (r ->> 'dal')::date;
      v_al := (r ->> 'al')::date;
    exception when others then v_motivo := 'riga_non_valida';
    end;
    if v_motivo is null and (
         char_length(v_ente) not between 1 and 40
         or (r ->> 'tipo') is null or (r ->> 'tipo') not in ('praticante', 'agonista', 'dirigente', 'tecnico', 'altro')
         or char_length(btrim(coalesce(r ->> 'codice', ''))) not between 1 and 20
         or v_dal is null or v_al is null or v_al < v_dal
         or v_dal not between date '2000-01-01' and date '2100-12-31'
         or v_al not between date '2000-01-01' and date '2100-12-31') then
      v_motivo := 'riga_non_valida';
    end if;

    chi := null;
    if v_motivo is null then
      select a.persona_id into chi
        from anagrafiche a join persone p on p.id = a.persona_id and p.ruolo = 'iscritto'
       where a.codice_fiscale = v_cf and parole_nome(p.nome || ' ' || p.cognome) = parole_nome(v_nome)
       limit 1;
      if chi is null then
        v_motivo := case when exists (select 1 from anagrafiche a join persone p on p.id = a.persona_id and p.ruolo = 'iscritto' where a.codice_fiscale = v_cf)
                         then 'nome_diverso' else 'nessuna_scheda' end;
      end if;
    end if;

    if v_motivo is not null then
      esiti := esiti || jsonb_build_object('nome', v_nome, 'codice_fiscale', v_cf, 'ente', v_ente, 'esito', v_motivo);
      continue;
    end if;

    v_chiave := chi::text || '|' || v_ente || '|' || (r ->> 'tipo') || '|' || v_dal::text;
    if v_chiave = any (viste) or exists (select 1 from tessere t
                                          where t.persona_id = chi and t.ente = v_ente
                                            and t.tipo = r ->> 'tipo' and t.dal = v_dal) then
      n_gia := n_gia + 1;
      continue;
    end if;
    viste := viste || v_chiave;
    n_nuove := n_nuove + 1;
    if not solo_prova then
      insert into tessere (persona_id, ente, tipo, codice, dal, al, origine, creata_da)
      values (chi, v_ente, r ->> 'tipo', btrim(r ->> 'codice'), v_dal, v_al, 'rasd', persona_corrente());
    end if;
  end loop;

  return jsonb_build_object('nuove', n_nuove, 'gia_presenti', n_gia,
                            'non_abbinate', esiti, 'scritto', not solo_prova);
end $$;

-- L'incrocio tra iscrizioni e tessere: una riga per persona ed ente.
--   manca         iscritto a un corso che chiede la tessera di un ente, e non ne ha mai avuta
--   scaduta       l'ha avuta, ma è finita
--   in_scadenza   vale ancora, ma finisce entro 60 giorni
--   non_iscritto  ha una tessera che vale oggi, ma nessun corso attivo
-- «Iscritto» = iscrizione in corso oggi, persona attiva. Una tessera che
-- comincia più avanti conta come valida (è un rinnovo già fatto). Contano solo
-- le tessere da praticante e da agonista: chi pratica ha quelle, un dirigente o
-- un tecnico può non avere nessun corso, e non è un errore.
create or replace function incrocio_tessere(oggi date default (now() at time zone 'Europe/Rome')::date)
  returns table (persona_id uuid, ente text, esito text, corsi text, tessera_al date)
  language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not e_staff() then raise exception 'solo la segreteria' using errcode = '42501'; end if;
  return query
    with richieste as (
      select i.persona_id, c.ente_tessera as ente, string_agg(distinct c.nome, ', ' order by c.nome) as corsi
        from iscrizioni i
        join corsi c on c.id = i.corso_id
        join persone p on p.id = i.persona_id and p.attiva
       where c.ente_tessera is not null and i.dal <= oggi and (i.al is null or i.al >= oggi)
       group by i.persona_id, c.ente_tessera
    ), ultima as (
      select t.persona_id, t.ente, max(t.al) as al,
             bool_or(t.dal <= oggi and t.al >= oggi) as vale_oggi
        from tessere t where t.tipo in ('praticante', 'agonista') group by t.persona_id, t.ente
    )
    select r.persona_id, r.ente,
           case when u.al is null then 'manca'
                when u.al < oggi then 'scaduta'
                else 'in_scadenza' end,
           r.corsi, u.al
      from richieste r left join ultima u on u.persona_id = r.persona_id and u.ente = r.ente
     where u.al is null or u.al <= oggi + 60
    union all
    select u.persona_id, u.ente, 'non_iscritto', null::text, u.al
      from ultima u
     where u.vale_oggi
       and exists (select 1 from persone q where q.id = u.persona_id and q.attiva)
       and not exists (select 1 from iscrizioni i join persone p on p.id = i.persona_id and p.attiva
                        where i.persona_id = u.persona_id and i.dal <= oggi and (i.al is null or i.al >= oggi));
end $$;

revoke all on function parole_nome(text) from public, anon;
revoke all on function tessere_unione() from public, anon, authenticated;
revoke all on function importa_tessere(jsonb, boolean) from public, anon;
revoke all on function incrocio_tessere(date) from public, anon;
grant execute on function parole_nome(text) to authenticated;
grant execute on function importa_tessere(jsonb, boolean) to authenticated;
grant execute on function incrocio_tessere(date) to authenticated;

notify pgrst, 'reload schema';
