-- ---------------------------------------------------------------------------
-- 101 · L'area degli iscritti sul database
--
-- Chi frequenta i corsi può avere un account e vedere, dal telefono, le sue
-- cose: i corsi, le prossime lezioni, le presenze, il certificato, la quota, le
-- ricevute; il titolare di un nucleo (vedi 100) anche quelle della sua
-- famiglia. Le policy della segreteria non si allargano: un iscritto con
-- l'account non è personale (`e_staff()`, `e_personale()` e
-- `e_amministrazione()` guardano il ruolo, mai se una persona ha un account) e
-- le tabelle restano chiuse. Legge con le funzioni `iscritto_*` qui sotto, che
-- girano coi privilegi del proprietario, restituiscono solo le righe di chi le
-- chiama (o del suo nucleo, se ne è il titolare) e non portano mai il file del
-- certificato né le note della segreteria.
--
--   iscritto_scheda(persona)               corsi di oggi, certificato, quota
--   iscritto_lezioni(persona, da, a)       le lezioni dei suoi corsi, anche annullate
--   iscritto_presenze(persona, giorni)     le lezioni già fatte, dalla più recente
--   iscritto_ricevute(persona)             le ricevute, anche annullate
--   iscritto_nucleo(persona)               sé stesso e, se titolare, gli altri
--   iscritto_titolare(persona)             può aggiungere persone al nucleo
--   iscritto_aggiunte(persona)             le richieste fatte per il nucleo
--   iscritto_dati_del_nucleo(persona)      quello che il modulo sa già
--   iscritto_segnala(persona, lezione, nota) / iscritto_segnalate(persona)
--
-- `persona` è chi chiama, o (se ne è il titolare) uno del suo nucleo: per
-- chiunque altro la risposta è vuota, come per una persona che non c'è.
--
-- Il primo accesso (`collega_utente()`) lega l'account anche a un iscritto
-- con la stessa email confermata, ma solo senza dubbi: una famiglia che divide
-- l'indirizzo lega il titolare, due iscritti qualunque con la stessa email
-- nessuno dei due (lo lega la segreteria dalla scheda, se serve).
--
-- Le presenze segnalate («ero a lezione e non risulto») sono una tabella
-- nuova che l'iscritto scrive solo con `iscritto_segnala`; accoglierle o
-- rifiutarle è dell'istruttore e della segreteria, ma quelle schermate non ci
-- sono ancora: per ora le legge la segreteria.
--
-- Il codice stessa metà in prova: src/lib/iscritto.ts e iscrittoProva.ts; i
-- messaggi sono quelli di src/lib/segnalate.ts. Prova: supabase/prova/iscritto.sql.
-- Rilanciabile. Si lancia dopo il 100 (e rifà `collega_utente` del 55: rilanciando
-- il 55 dopo questo, va rilanciato anche questo).
-- ---------------------------------------------------------------------------

-- --- il primo accesso -------------------------------------------------------
create or replace function collega_utente()
  returns uuid
  language plpgsql
  security definer
  set search_path = public, extensions
as $$
declare
  chi uuid;
  mail citext;
begin
  if auth.uid() is null then return null; end if;
  select id into chi from persone where utente_id = auth.uid();
  if chi is not null then return chi; end if;

  -- Solo con l'email confermata: chiunque può registrarsi con l'indirizzo di un altro.
  select email into mail from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if mail is null then return null; end if;

  -- Il personale ha l'email unica (99): una persona sola, nessun dubbio.
  update persone set utente_id = auth.uid()
    where email = mail and utente_id is null and attiva and ruolo::text in ('istruttore', 'staff', 'amministrazione')
    returning id into chi;
  if chi is not null then return chi; end if;

  -- Gli iscritti possono dividere l'email: una famiglia, o due che non c'entrano
  -- niente. Si lega chi è l'unico con quell'indirizzo, o il titolare di un
  -- nucleo che è l'unico a non stare nel nucleo di un altro con lo stesso: dove
  -- c'è un dubbio non si lega nessuno (e non si lega a chi è già legato a un altro account).
  update persone p set utente_id = auth.uid()
    where p.email = mail and p.utente_id is null and p.attiva and p.ruolo::text = 'iscritto'
      and not exists (
        select 1 from persone q
          where q.email = mail and q.attiva and q.ruolo::text = 'iscritto'
            and q.id <> p.id and q.nucleo is distinct from p.id)
    returning p.id into chi;
  return chi;
end $$;

-- --- le presenze segnalate --------------------------------------------------
create table if not exists presenze_segnalate (
  id           uuid primary key default gen_random_uuid(),
  sessione_id  uuid not null references sessioni(id) on delete cascade,
  persona_id   uuid not null references persone(id) on delete cascade,
  creata_il    timestamptz not null default now(),
  nota         text check (char_length(nota) <= 200),
  stato        text not null default 'da_vedere' check (stato in ('da_vedere', 'accolta', 'rifiutata')),
  gestita_il   timestamptz,
  gestita_da   uuid references persone(id) on delete set null,
  -- Una sola per lezione e per persona.
  unique (sessione_id, persona_id)
);
alter table presenze_segnalate enable row level security;
revoke all on presenze_segnalate from public, anon, authenticated;
grant select on presenze_segnalate to authenticated;
-- La segreteria le legge; l'iscritto le scrive e le rilegge solo con le funzioni.
drop policy if exists presenze_segnalate_legge on presenze_segnalate;
create policy presenze_segnalate_legge on presenze_segnalate for select to authenticated using (e_staff());

-- --- chi può vedere chi -----------------------------------------------------
-- La persona è un iscritto attivo, ed è chi chiama o è nel suo nucleo e non ha un
-- account suo (un maggiorenne con l'account vede le sue cose da sé: il titolare
-- non le legge). Un nucleo ha un titolare solo: chi sta dentro non vede gli
-- altri. Senza account, o con un account di nessuno, `persona_corrente()` è
-- nullo e non passa nessuno.
create or replace function iscritto_puo_vedere(persona uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public, extensions
as $$
  select exists (
    select 1 from persone p
     where p.id = persona and p.ruolo::text = 'iscritto' and p.attiva
       and (p.id = persona_corrente() or (p.nucleo = persona_corrente() and p.utente_id is null)))
$$;

-- --- la scheda --------------------------------------------------------------
-- Il 102 aggiunge una colonna a queste tre: rilanciando il 101 dopo il 102 il
-- tipo cambia, e `create or replace` da sola non può. Dopo, si rilancia il 102.
drop function if exists iscritto_nucleo(uuid);
drop function if exists iscritto_scheda(uuid);
drop function if exists iscritto_scheda_di(uuid);

-- Senza controlli: la chiamano solo le funzioni di sotto, dopo `iscritto_puo_vedere`.
create or replace function iscritto_scheda_di(persona uuid)
  returns table (
    id uuid, nome text, cognome text,
    corsi jsonb,
    certificato_scade date,
    pagamento stato_pagamento, pagato_fino date,
    quote jsonb,
    nato_il date)
  language sql
  stable
  security definer
  set search_path = public, extensions
as $$
  select p.id, p.nome, p.cognome,
    -- I corsi di oggi (a Roma), non quelli finiti.
    coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'nome', c.nome, 'colore', c.colore) order by c.nome)
                from iscrizioni i join corsi c on c.id = i.corso_id
               where i.persona_id = p.id and c.attivo
                 and i.dal <= (now() at time zone 'Europe/Rome')::date
                 and (i.al is null or i.al >= (now() at time zone 'Europe/Rome')::date)), '[]'::jsonb),
    s.certificato_scade,
    coalesce(s.pagamento, 'da_pagare'), s.pagato_fino,
    -- Le quote dalle ricevute: la stessa vista della segreteria, solo le righe sue.
    coalesce((select jsonb_agg(jsonb_build_object('anno', q.anno, 'numero', q.numero, 'dal', q.dal, 'al', q.al, 'mancano', q.mancano) order by q.anno, q.numero)
                from quote_ricevute q where q.persona_id = p.id), '[]'::jsonb),
    -- Come `nucleo_maggiorenne`: l'anagrafica, o la richiesta accolta.
    coalesce(
      (select a.nato_il from anagrafiche a where a.persona_id = p.id),
      (select r.nato_il from richieste_iscrizione r where r.persona_id = p.id and r.stato = 'accolta' order by r.gestita_il desc nulls last limit 1))
  from persone p
  left join schede_iscritti s on s.persona_id = p.id
  where p.id = persona and p.ruolo::text = 'iscritto' and p.attiva
$$;

create or replace function iscritto_scheda(persona uuid)
  returns table (
    id uuid, nome text, cognome text,
    corsi jsonb,
    certificato_scade date,
    pagamento stato_pagamento, pagato_fino date,
    quote jsonb,
    nato_il date)
  language sql
  stable
  security definer
  set search_path = public, extensions
as $$
  select * from iscritto_scheda_di(persona) where iscritto_puo_vedere(persona)
$$;

-- --- le lezioni -------------------------------------------------------------
-- Dei corsi a cui era iscritto quel giorno, anche annullate; `da` e `a` sono
-- giorni di Roma, estremi compresi. «Sostituto» è chi non è fra gli istruttori
-- del corso; «altra sala» e «fuori orario» si capiscono dalla ricorrenza.
create or replace function iscritto_lezioni(persona uuid, da date, a date)
  returns table (
    id uuid, corso text, colore text,
    inizio timestamptz, fine timestamptz, stato stato_sessione,
    sala text, istruttore text,
    sostituto boolean, altra_sala boolean, straordinaria boolean)
  language sql
  stable
  security definer
  set search_path = public, extensions
as $$
  select s.id, c.nome, c.colore, s.inizio, s.fine, s.stato,
         sa.nome, nullif(btrim(i.nome || ' ' || i.cognome), ''),
         s.istruttore_id is not null and s.istruttore_id is distinct from c.istruttore_id
           and not exists (select 1 from corsi_istruttori ci where ci.corso_id = c.id and ci.persona_id = s.istruttore_id),
         s.ricorrenza_id is not null and s.sala_id is distinct from coalesce(r.sala_id, c.sala_id),
         s.ricorrenza_id is null
    from sessioni s
    join corsi c on c.id = s.corso_id
    left join ricorrenze r on r.id = s.ricorrenza_id
    left join sale sa on sa.id = s.sala_id
    left join persone i on i.id = s.istruttore_id
   where iscritto_puo_vedere(persona)
     and (s.inizio at time zone 'Europe/Rome')::date between da and a
     and exists (select 1 from iscrizioni x
                  where x.persona_id = persona and x.corso_id = s.corso_id
                    and x.dal <= (s.inizio at time zone 'Europe/Rome')::date
                    and (x.al is null or x.al >= (s.inizio at time zone 'Europe/Rome')::date))
   order by s.inizio
$$;

-- --- le presenze ------------------------------------------------------------
-- Le lezioni già cominciate degli ultimi `giorni` (al massimo un anno e un po'),
-- non annullate, dalla più recente; senza segno nell'appello `stato` è nullo.
create or replace function iscritto_presenze(persona uuid, giorni integer)
  returns table (sessione_id uuid, inizio timestamptz, corso text, stato stato_presenza)
  language sql
  stable
  security definer
  set search_path = public, extensions
as $$
  select s.id, s.inizio, c.nome, pr.stato
    from sessioni s
    join corsi c on c.id = s.corso_id
    left join presenze pr on pr.sessione_id = s.id and pr.persona_id = persona
   where iscritto_puo_vedere(persona)
     and s.inizio < now() and s.inizio >= now() - make_interval(days => least(greatest(giorni, 0), 400))
     and s.stato <> 'annullata'
     and exists (select 1 from iscrizioni x
                  where x.persona_id = persona and x.corso_id = s.corso_id
                    and x.dal <= (s.inizio at time zone 'Europe/Rome')::date
                    and (x.al is null or x.al >= (s.inizio at time zone 'Europe/Rome')::date))
   order by s.inizio desc
$$;

-- --- le ricevute ------------------------------------------------------------
-- Le sue, dalla più recente, anche annullate. Non escono le note della
-- segreteria, né chi le ha fatte o annullate.
create or replace function iscritto_ricevute(persona uuid)
  returns table (
    id uuid, anno integer, numero integer, data date,
    ente jsonb, intestatario jsonb, voci jsonb,
    totale integer, pagato integer, anticipo integer,
    creata_il timestamptz, annullata_il timestamptz)
  language sql
  stable
  security definer
  set search_path = public, extensions
as $$
  select r.id, r.anno, r.numero, r.data, r.ente, r.intestatario, r.voci,
         r.totale, r.pagato, r.anticipo, r.creata_il, r.annullata_il
    from ricevute r
   where iscritto_puo_vedere(persona) and r.persona_id = persona
   order by r.data desc, r.anno desc, r.numero desc
$$;

-- --- il nucleo --------------------------------------------------------------
-- Sé stesso per primo, poi gli altri per nome (non chi ha un account suo); chi
-- è nel nucleo di un altro vede solo sé stesso.
create or replace function iscritto_nucleo(persona uuid)
  returns table (
    id uuid, nome text, cognome text,
    corsi jsonb,
    certificato_scade date,
    pagamento stato_pagamento, pagato_fino date,
    quote jsonb,
    nato_il date)
  language sql
  stable
  security definer
  set search_path = public, extensions
as $$
  select s.*
    from persone p
    cross join lateral iscritto_scheda_di(p.id) s
   where iscritto_puo_vedere(persona) and p.ruolo::text = 'iscritto' and p.attiva
     and (p.id = persona or (p.nucleo = persona and p.utente_id is null))
   order by (p.id = persona) desc, p.nome, p.cognome, p.id
$$;

-- Può aggiungere persone al nucleo: ne è il titolare, o non è nel nucleo di nessuno.
create or replace function iscritto_titolare(persona uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public, extensions
as $$
  select coalesce(iscritto_puo_vedere(persona) and (select p.nucleo is null from persone p where p.id = persona), false)
$$;

-- Le persone che ha aggiunto e la segreteria non ha ancora accolto, e quelle
-- rifiutate nell'ultimo mese.
create or replace function iscritto_aggiunte(persona uuid)
  returns table (id uuid, nome text, cognome text, corsi text[], creata_il timestamptz, stato stato_richiesta)
  language sql
  stable
  security definer
  set search_path = public, extensions
as $$
  select r.id, r.nome, r.cognome,
         -- Nell'ordine in cui li ha scelti.
         coalesce((select array_agg(c.nome order by u.n) from unnest(r.corsi) with ordinality u(corso, n) join corsi c on c.id = u.corso), '{}'::text[]),
         r.creata_il, r.stato
    from richieste_iscrizione r
   where iscritto_titolare(persona) and r.nucleo_di = persona
     and (r.stato = 'nuova' or (r.stato = 'rifiutata' and coalesce(r.gestita_il, r.creata_il) > now() - interval '30 days'))
   order by r.creata_il desc, r.id
$$;

-- Quello che il modulo di una persona in più può già sapere dal titolare: i
-- suoi recapiti e, se è maggiorenne (o non si sa), i dati da genitore. Si
-- cambia tutto prima di mandare.
create or replace function iscritto_dati_del_nucleo(persona uuid)
  returns table (
    cognome text, indirizzo text, cap text, comune text, email text, telefono text,
    genitore_nome text, genitore_cognome text, genitore_codice_fiscale text,
    nucleo_di uuid)
  language sql
  stable
  security definer
  set search_path = public, extensions
as $$
  select p.cognome, coalesce(a.indirizzo, ''), coalesce(a.cap, ''), coalesce(a.comune, ''),
         coalesce(p.email::text, ''), coalesce(p.telefono, ''),
         case when nucleo_maggiorenne(p.id) then p.nome end,
         case when nucleo_maggiorenne(p.id) then p.cognome end,
         case when nucleo_maggiorenne(p.id) then coalesce(a.codice_fiscale, '') end,
         p.id
    from persone p
    left join anagrafiche a on a.persona_id = p.id
   where iscritto_titolare(persona) and p.id = persona
$$;

-- --- ero a lezione ----------------------------------------------------------
-- Le regole sono quelle di `cosaNonVaSegnalata` (src/lib/segnalate.ts), con le
-- stesse parole: una lezione sua, non annullata, già cominciata, degli ultimi
-- 30 giorni, dove non risulta già presente e non l'ha già segnalata.
create or replace function iscritto_segnala(persona uuid, sessione uuid, nota text default null)
  returns void
  language plpgsql
  security definer
  set search_path = public, extensions
as $$
declare
  l record;
  segno stato_presenza;
  gia text;
  testo text := nullif(btrim(nota), '');
begin
  if not iscritto_puo_vedere(persona) then
    raise exception 'Questa persona non è fra le tue' using errcode = '42501';
  end if;

  select s.inizio, s.stato into l
    from sessioni s
   where s.id = sessione
     and exists (select 1 from iscrizioni x
                  where x.persona_id = persona and x.corso_id = s.corso_id
                    and x.dal <= (s.inizio at time zone 'Europe/Rome')::date
                    and (x.al is null or x.al >= (s.inizio at time zone 'Europe/Rome')::date));
  if not found then raise exception 'Questa lezione non è di un tuo corso' using errcode = '22023'; end if;
  if l.stato = 'annullata' then raise exception 'La lezione è stata annullata' using errcode = '22023'; end if;
  if l.inizio > now() then raise exception 'La lezione non è ancora cominciata' using errcode = '22023'; end if;
  if l.inizio < now() - interval '30 days' then
    raise exception 'Si segnalano solo le lezioni degli ultimi 30 giorni: chiedi alla segreteria' using errcode = '22023';
  end if;

  select pr.stato into segno from presenze pr where pr.sessione_id = sessione and pr.persona_id = persona;
  if segno = 'presente' then raise exception 'Risulti già presente' using errcode = '22023'; end if;
  select g.stato into gia from presenze_segnalate g where g.sessione_id = sessione and g.persona_id = persona;
  if gia = 'da_vedere' then raise exception 'L’hai già segnalata: la guarda l’istruttore o la segreteria' using errcode = '22023'; end if;
  if gia is not null then
    raise exception '%', case when gia = 'accolta' then 'Risulti già presente' else 'È già stata rifiutata: chiedi alla segreteria' end using errcode = '22023';
  end if;
  if char_length(testo) > 200 then raise exception 'La nota è troppo lunga: al massimo 200 caratteri' using errcode = '22023'; end if;

  insert into presenze_segnalate (sessione_id, persona_id, nota) values (sessione, persona, testo);
exception
  -- Due tocchi insieme: la seconda trova la prima.
  when unique_violation then
    raise exception 'L’hai già segnalata: la guarda l’istruttore o la segreteria' using errcode = '22023';
end $$;

create or replace function iscritto_segnalate(persona uuid)
  returns table (id uuid, sessione_id uuid, persona_id uuid, il timestamptz, nota text, stato text, gestita_il timestamptz)
  language sql
  stable
  security definer
  set search_path = public, extensions
as $$
  select g.id, g.sessione_id, g.persona_id, g.creata_il, g.nota, g.stato, g.gestita_il
    from presenze_segnalate g
   where iscritto_puo_vedere(persona) and g.persona_id = persona
   order by g.creata_il desc, g.id
$$;

-- --- chi può chiamare cosa --------------------------------------------------
-- Le funzioni di sotto girano coi privilegi del proprietario: chi non è entrato
-- (`anon`) non le chiama, e gli aiuti non li chiama nessuno dal browser.
revoke all on function iscritto_puo_vedere(uuid), iscritto_scheda_di(uuid) from public, anon, authenticated;
revoke all on function
  iscritto_scheda(uuid), iscritto_lezioni(uuid, date, date), iscritto_presenze(uuid, integer),
  iscritto_ricevute(uuid), iscritto_nucleo(uuid), iscritto_titolare(uuid), iscritto_aggiunte(uuid),
  iscritto_dati_del_nucleo(uuid), iscritto_segnala(uuid, uuid, text), iscritto_segnalate(uuid)
  from public, anon;
grant execute on function
  iscritto_scheda(uuid), iscritto_lezioni(uuid, date, date), iscritto_presenze(uuid, integer),
  iscritto_ricevute(uuid), iscritto_nucleo(uuid), iscritto_titolare(uuid), iscritto_aggiunte(uuid),
  iscritto_dati_del_nucleo(uuid), iscritto_segnala(uuid, uuid, text), iscritto_segnalate(uuid)
  to authenticated;

notify pgrst, 'reload schema';
