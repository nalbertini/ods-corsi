-- Chi ha pagato un movimento non identificato (banca o Satispay): il database propone la persona oltre che per nome
-- anche per genitore, per codice fiscale letto dalla causale e per importo (il corso che costa quella cifra), senza
-- mostrare a chi amministra nessun dato delle persone. Le stesse regole di src/lib/abbinaMovimenti.ts.
--   * `abbina_pagatori_movimento(movimento, corsi)`: le persone che il movimento «Da classificare» può essere
--     (Contabilità, riquadro «Suggerito»). Regole in ordine, ognuna solo se la precedente non trova nessuno:
--     1 nome e cognome interi nel testo; 2 nome e cognome interi del genitore (anagrafiche) → i figli; 3 codice fiscale
--     letto dalla causale uguale a quello del genitore o della persona; 4 `corsi` (che l'app ricava dall'importo e dal
--     listino: il database non interpreta i prezzi): chi è iscritto a uno di quei corsi il giorno del movimento e ha nel
--     testo il suo cognome o quello del genitore. Rende solo id, nome, cognome, `come` e `gia_iscritto` (iscrizione che
--     copre il giorno del movimento, non oggi; per la regola 4 sempre falso: lì l'iscrizione è a favore): prima chi non
--     è iscritto, in fondo chi lo è. Al massimo 8, solo persone attive.
--   * `abbina_testo_banca(testo, movimenti)`: per «Importa banca → Da decidere», quali dei movimenti già scritti
--     (causale «Cliente NOME per …», o persona collegata) sono di chi è nel testo o di un suo figlio. Rende solo
--     `movimento_id` e `come`.
--   * Il codice fiscale letto sta in `movimenti_codici_letti`, tabella che nessun ruolo dell'app legge (né le funzioni
--     che rendono un movimento intero lo portano fuori); si scrive con `importa_prima_nota` (chiave
--     `codice_fiscale_letto`, al massimo due codici validi) e si cancella quando il movimento è collegato a una persona.
--   * Solo e_amministrazione() (i movimenti li legge solo lei), con lo stesso tetto di `cerca_pagatori` (60 in 10 minuti, 500 al giorno).
-- Si lancia dopo 55, 63 e 70, e si può rilanciare senza danni.

create table if not exists movimenti_codici_letti (
  movimento_id uuid primary key references movimenti(id) on delete cascade,
  codici text[] not null check (cardinality(codici) between 1 and 2)
);
alter table movimenti_codici_letti enable row level security;
revoke all on movimenti_codici_letti from public, anon, authenticated;

-- importa_prima_nota (63) con in più la lettura di `codice_fiscale_letto`.
create or replace function importa_prima_nota(dati jsonb) returns integer
  language plpgsql security definer set search_path = public, extensions as $$
declare
  riga jsonb;
  n integer := 0;
  fatte integer := 0;
  viste text[] := '{}';
  dentro integer;
  giorno date;
  importo numeric;
  cassa casse;
  voce voci_contabili;
  tipo_riga text;
  nome_voce text;
  descr text;
  chiave text;
  codici text[];
begin
  perform contabilita_porta();
  if jsonb_typeof(dati) is distinct from 'array' then raise exception 'I dati dell’import non sono una lista' using errcode = '22023'; end if;
  if jsonb_array_length(dati) > 1000 then raise exception 'Troppe righe in una volta: al massimo 1000' using errcode = '22023'; end if;
  -- La voce da sistemare c'è sempre, di entrata e di uscita, non di sistema.
  insert into voci_contabili (nome, tipo) values ('Da classificare', 'entrata'), ('Da classificare', 'uscita') on conflict do nothing;
  -- Se qualcuno l'ha spenta, per l'import si riaccende: è la voce di arrivo di tutto lo storico.
  update voci_contabili v set attiva = true where lower(trim(v.nome)) = 'da classificare' and not v.attiva;

  for riga in select * from jsonb_array_elements(dati) loop
    n := n + 1;
    if jsonb_typeof(riga) is distinct from 'object' then raise exception 'La riga % non si capisce', n using errcode = '22023'; end if;
    chiave := case when jsonb_typeof(riga->'chiave') = 'string' then riga->>'chiave' else '' end;
    if chiave !~ '^[A-Za-z0-9:_.-]{1,100}$' then raise exception 'La riga % non ha la chiave', n using errcode = '22023'; end if;
    if chiave = any(viste) then raise exception 'La riga %: la chiave è già nel pacchetto', n using errcode = '22023'; end if;
    viste := viste || chiave;
    if jsonb_typeof(riga->'data') is distinct from 'string' or riga->>'data' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'La riga %: la data non si capisce', n using errcode = '22023'; end if;
    begin giorno := (riga->>'data')::date; exception when others then
      raise exception 'La riga %: la data non si capisce', n using errcode = '22023';
    end;
    if giorno is null or giorno < date '2000-01-01' then raise exception 'La riga %: la data non si capisce', n using errcode = '22023'; end if;
    if giorno > contabilita_oggi() then raise exception 'La riga %: la data è nel futuro', n using errcode = '22023'; end if;
    select * into cassa from casse c where c.nome = case riga->>'cassa' when 'contanti' then 'Cassa Contanti' when 'conto' then 'Conto Corrente' end
      for share;  -- come `registra_movimento`: una chiusura che si sta facendo in questo momento aspetta, o ci fa aspettare
    if not found then raise exception 'La riga %: la cassa non è quella dei contanti né quella del conto', n using errcode = '22023'; end if;
    tipo_riga := riga->>'tipo';
    if tipo_riga is null or tipo_riga not in ('entrata', 'uscita') then raise exception 'La riga %: scegli se è un’entrata o un’uscita', n using errcode = '22023'; end if;
    if jsonb_typeof(riga->'importo') is distinct from 'number' then raise exception 'La riga %: l’importo non si capisce', n using errcode = '22023'; end if;
    importo := (riga->>'importo')::numeric;
    if importo <> trunc(importo) then raise exception 'La riga %: l’importo non si capisce', n using errcode = '22023'; end if;
    if importo <= 0 then raise exception 'La riga %: l’importo deve essere più di zero', n using errcode = '22023'; end if;
    if importo > 10000000 then raise exception 'La riga %: l’importo è troppo alto', n using errcode = '22023'; end if;
    -- Anche gli spazi che non si vedono (a-capo, spazio unificatore, spazio largo zero) contano come spazi.
    descr := case when jsonb_typeof(riga->'descrizione') = 'string' then btrim(regexp_replace(riga->>'descrizione', '[\s\u00a0\u200b]+', ' ', 'g')) else '' end;
    if descr = '' then raise exception 'La riga %: scrivi una descrizione', n using errcode = '22023'; end if;
    if char_length(descr) > 200 then raise exception 'La riga %: la descrizione è troppo lunga', n using errcode = '22023'; end if;
    nome_voce := riga->>'voce';
    -- Le voci di sistema sono solo di entrata: un'uscita può andare solo su «Da classificare».
    -- Il nome si confronta come l'indice unico delle voci (senza maiuscole né spazi ai bordi): «Da classificare» scritta a mano va bene.
    select * into voce from voci_contabili v
      where lower(trim(v.nome)) = lower(trim(nome_voce)) and v.tipo = tipo_riga
        and lower(trim(v.nome)) in ('quota associativa', 'corsi e altri pagamenti', 'da classificare');
    if not found then raise exception 'La riga %: la voce non va bene', n using errcode = '22023'; end if;
    if cassa.dal is not null and giorno < cassa.dal then raise exception 'La riga %: la data è prima dell’inizio della cassa', n using errcode = '22023'; end if;
    -- Una riga già importata prima della chiusura non è un errore se si rilancia il pacchetto: non si riscrive.
    if cassa_giorno_chiuso(cassa.id, giorno) and not exists (select 1 from movimenti m where m.origine_import = chiave) then raise exception 'La riga %: quel giorno la cassa è già chiusa', n using errcode = '22023'; end if;

    insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione, origine_import)
    values (tipo_riga, giorno, importo::integer, voce.id, cassa.id, descr, chiave)
    on conflict (origine_import) where origine_import is not null do nothing;
    get diagnostics dentro = row_count;
    fatte := fatte + dentro;
    -- Il codice fiscale letto dalla causale (solo banca): al massimo due, validi, in un posto che nessuno legge.
    if dentro = 1 and jsonb_typeof(riga->'codice_fiscale_letto') = 'array' then
      select array_agg(x.c order by x.o) into codici from (
        select upper(btrim(t.e)) as c, t.o from jsonb_array_elements_text(riga->'codice_fiscale_letto') with ordinality t(e, o)
        where upper(btrim(t.e)) ~ '^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$'
        order by t.o limit 2) x;
      if codici is not null then
        insert into movimenti_codici_letti (movimento_id, codici) select m.id, codici from movimenti m where m.origine_import = chiave;
      end if;
    end if;
  end loop;
  return fatte;
end $$;

revoke all on function importa_prima_nota(jsonb) from public, anon;
grant execute on function importa_prima_nota(jsonb) to authenticated;

-- Il collegamento a una persona (70) cancella il codice letto: serviva solo a trovarla.
create or replace function collegamento_scrivi(m movimenti, dopo uuid, lot uuid) returns void
  language plpgsql security definer set search_path = public, extensions as $$
begin
  update movimenti set persona_id = dopo where id = m.id;
  if dopo is not null then delete from movimenti_codici_letti where movimento_id = m.id; end if;
  insert into collegamenti_persona (movimento_id, persona_prima_id, persona_dopo_id, lotto, fatto_da, fatto_da_nome, persona_prima_nome, persona_dopo_nome)
  values (m.id, m.persona_id, dopo, lot, persona_corrente(),
          (select p.nome || ' ' || p.cognome from persone p where p.id = persona_corrente()),
          (select p.nome || ' ' || p.cognome from persone p where p.id = m.persona_id),
          (select p.nome || ' ' || p.cognome from persone p where p.id = dopo));
end $$;

-- Le parole di un nome o di un testo: senza maiuscole né accenti, divise da tutto ciò che non è lettera, cifra o apostrofo.
create or replace function parole_pagatori(t text) returns text[]
  language sql immutable set search_path = public, extensions as $$
  select coalesce(array_agg(distinct w), '{}') from unnest(regexp_split_to_array(
    translate(testo_piano(t), '‘’`', repeat(chr(39), 3)), '[^a-z0-9'']+')) w where w <> '' $$;

-- Chi può chiedere e quante volte: lo stesso conto di `cerca_pagatori` (ricerche_pagatori), così le tre funzioni si
-- dividono un tetto solo.
create or replace function pagatori_porta() returns void
  language plpgsql security definer set search_path = public, extensions as $$
begin
  if not e_amministrazione() then
    raise exception 'i nomi dei movimenti li vede chi cura la contabilità' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('pagatori:' || persona_corrente()::text));
  if (select count(*) filter (where r.quando > now() - interval '10 minutes') >= 60
             or count(*) filter (where r.quando > now() - interval '1 day') >= 500
        from ricerche_pagatori r where r.persona_id = persona_corrente()) then
    raise exception 'troppe ricerche: riprova fra qualche minuto' using errcode = '42501';
  end if;
  insert into ricerche_pagatori (persona_id) values (persona_corrente());
  delete from ricerche_pagatori r where r.quando < now() - interval '1 day';
end $$;

create or replace function abbina_pagatori_movimento(movimento uuid, corsi uuid[] default null)
  returns table (persona_id uuid, nome text, cognome text, come text, gia_iscritto boolean)
  language plpgsql security definer set search_path = public, extensions as $$
declare
  m movimenti;
  cf text[];
  t text[];
begin
  perform pagatori_porta();
  select * into m from movimenti x where x.id = abbina_pagatori_movimento.movimento;
  if not found then return; end if;
  select c.codici into cf from movimenti_codici_letti c where c.movimento_id = m.id;
  t := parole_pagatori(m.descrizione);
  return query
    with b as (
      select p.id as pid, p.nome as pn, p.cognome as pc, a.codice_fiscale as pcf, a.genitore_codice_fiscale as gcf,
             parole_pagatori(p.nome || ' ' || p.cognome) as pp,
             parole_pagatori(p.cognome) as pcw,
             -- il genitore vale solo con nome e cognome: uno solo non dice chi è
             case when nullif(btrim(a.genitore_nome), '') is not null and nullif(btrim(a.genitore_cognome), '') is not null
                  then parole_pagatori(a.genitore_nome || ' ' || a.genitore_cognome) end as gp,
             parole_pagatori(a.genitore_cognome) as gcw,
             exists (select 1 from iscrizioni i where i.persona_id = p.id and i.dal <= m.data and (i.al is null or m.data <= i.al)) as iscr,
             exists (select 1 from iscrizioni i where i.persona_id = p.id and i.corso_id = any(coalesce(corsi, '{}'))
                       and i.dal <= m.data and (i.al is null or m.data <= i.al)) as nel_corso
      from persone p left join anagrafiche a on a.persona_id = p.id
      where p.attiva
    ), r1 as (
      select b.*, 'nome intero'::text as c, b.iscr as gi from b where cardinality(b.pp) > 0 and b.pp <@ t
    ), r2 as (
      select b.*, 'genitore'::text, b.iscr from b
      where not exists (select 1 from r1) and b.gp is not null and cardinality(b.gp) > 0 and b.gp <@ t
    ), r3 as (
      select b.*, 'codice fiscale'::text, b.iscr from b
      where not exists (select 1 from r1) and not exists (select 1 from r2)
        and exists (select 1 from unnest(coalesce(cf, '{}')) with ordinality k(x, o)
                    where (k.x = b.gcf or k.x = b.pcf)
                      -- vale il primo codice, nell'ordine della causale, che trova qualcuno
                      and k.o = (select min(k2.o) from unnest(coalesce(cf, '{}')) with ordinality k2(x, o)
                                 where exists (select 1 from b b2 where k2.x = b2.gcf or k2.x = b2.pcf)))
    ), r4 as (
      select b.*, 'corso e cognome'::text, false from b
      where not exists (select 1 from r1) and not exists (select 1 from r2) and not exists (select 1 from r3)
        and b.nel_corso
        and ((cardinality(b.pcw) > 0 and b.pcw <@ t) or (b.gcw is not null and cardinality(b.gcw) > 0 and b.gcw <@ t))
    ), tutti as (
      select * from r1 union all select * from r2 union all select * from r3 union all select * from r4
    )
    select u.pid, u.pn, u.pc, u.c, u.gi from tutti u
    order by u.gi, testo_piano(u.pc), testo_piano(u.pn), u.pid
    limit 8;
end $$;

create or replace function abbina_testo_banca(testo text, movimenti uuid[])
  returns table (movimento_id uuid, come text)
  language plpgsql security definer set search_path = public, extensions as $$
declare
  t text[];
begin
  perform pagatori_porta();
  if length(coalesce(testo, '')) > 400 or cardinality(coalesce(movimenti, '{}')) > 500 then return; end if;
  t := parole_pagatori(testo);
  return query
    with m as (
      select x.id as mid, coalesce(x.persona_id, (select c from collegamento_candidati(x.descrizione) c limit 1)) as pid
      from movimenti x where x.id = any(movimenti) and x.annullato_il is null
    ), c as (
      select distinct m.mid, p.id as pid,
             cardinality(parole_pagatori(p.nome || ' ' || p.cognome)) > 0 and parole_pagatori(p.nome || ' ' || p.cognome) <@ t as nome_ok,
             case when nullif(btrim(a.genitore_nome), '') is not null and nullif(btrim(a.genitore_cognome), '') is not null
                  then parole_pagatori(a.genitore_nome || ' ' || a.genitore_cognome) <@ t else false end as genitore_ok
      from m join persone p on p.id = m.pid and p.attiva left join anagrafiche a on a.persona_id = p.id
    )
    -- come per Contabilità: il nome vince sul genitore, e il genitore si guarda solo se nessuno ha il nome nel testo
    select c.mid, 'nome intero'::text from c where c.nome_ok
    union all
    select c.mid, 'genitore'::text from c where c.genitore_ok and not exists (select 1 from c c2 where c2.nome_ok);
end $$;

revoke all on function parole_pagatori(text), pagatori_porta() from public, anon, authenticated;
revoke all on function abbina_pagatori_movimento(uuid, uuid[]), abbina_testo_banca(text, uuid[]) from public, anon;
grant execute on function abbina_pagatori_movimento(uuid, uuid[]), abbina_testo_banca(text, uuid[]) to authenticated;

-- Che l'API veda subito funzioni e tabella nuove, senza aspettare.
notify pgrst, 'reload schema';
