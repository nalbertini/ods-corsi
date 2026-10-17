-- ODS Corsi · il ruolo «amministrazione»
--
-- Chi cura i conti della palestra: vede e fa quello che la segreteria fa sui
-- soldi (ricevute, pagamenti, listino) e non vede le persone: né schede, né
-- certificati, né presenze, né iscritti. Non vede nemmeno le STATISTICHE, che
-- hanno anche presenze e iscritti. Chi ha il ruolo si può combinare:
--   • `anche_amministrazione`: la segreteria che cura anche i conti (ruolo `staff`);
--   • `anche_istruttore`: vale ora anche per `amministrazione`, e dà il PIN sul
--     tablet e le presenze come a un istruttore.
-- Solo la segreteria crea gli account, cambia i ruoli, imposta i PIN e scarica
-- il backup (le funzioni `invita` e `backup` guardano `ruolo = 'staff'`).
--
-- REGOLA PER CHI VERRÀ: la contabilità (movimenti, casse, rendiconto) avrà
-- tabelle e funzioni solo con `e_amministrazione()`: la segreteria che non ha
-- anche il ruolo non la vede.
--
-- Chi cura i conti e insegna anche (`anche_istruttore`) è anche personale: come un
-- istruttore legge l'anagrafica (`persone_legge`), quindi «non vede le persone»
-- vale per l'amministrazione che non insegna.
--
-- Si lancia dopo `54-pagamenti-diretti.sql` (ricevute e pagamenti devono esserci) e
-- dopo `34-prove-per-nome.sql`, da cui prende `somiglia`.
-- Se si rilanciano dopo di lui `02`, `04`, `05`, `16` o `54`, tornano le versioni
-- vecchie delle loro funzioni e policy: va rilanciato anche questo. Non chiede di rilanciare
-- `06-iscrizioni.sql`. Finché non c'è, l'app non offre AMMINISTRAZIONE nel
-- RUOLO e dice di aggiornare il database. Il valore nuovo dell'enum non si
-- può usare nella stessa transazione che lo crea: qui si confronta `ruolo::text`.
-- ---------------------------------------------------------------------------

alter type ruolo add value if not exists 'amministrazione';

alter table persone add column if not exists anche_amministrazione boolean not null default false;

-- I vincoli nuovi o più stretti: prima si sistemano le righe che non li rispettano.
update persone set anche_amministrazione = false where anche_amministrazione and ruolo::text <> 'staff';
update persone set anche_istruttore = false where anche_istruttore and ruolo::text not in ('staff', 'amministrazione');
alter table persone drop constraint if exists persone_anche_amministrazione_check;
alter table persone add constraint persone_anche_amministrazione_check
  check (not anche_amministrazione or ruolo::text = 'staff');
alter table persone drop constraint if exists persone_anche_istruttore_check;
alter table persone add constraint persone_anche_istruttore_check
  check (not anche_istruttore or ruolo::text in ('staff', 'amministrazione'));

-- Chi cura i conti. `security definer` e `coalesce`: senza riga in `persone`,
-- o senza accesso, è falso e mai nullo, e la policy di `persone` non rientra in se stessa.
create or replace function e_amministrazione() returns boolean
  language sql stable security definer set search_path = public, extensions as $$
  select coalesce(
    (select p.ruolo::text = 'amministrazione' or (p.ruolo::text = 'staff' and p.anche_amministrazione)
       from persone p where p.utente_id = auth.uid() and p.attiva),
    false)
$$;

-- Chi lavora in palestra con le persone: istruttori, segreteria, e chi cura i conti ma insegna anche.
create or replace function e_personale() returns boolean
  language sql stable security definer set search_path = public, extensions as $$
  select coalesce(
    (select p.ruolo::text in ('istruttore', 'staff') or (p.ruolo::text = 'amministrazione' and p.anche_istruttore)
       from persone p where p.utente_id = auth.uid() and p.attiva),
    false)
$$;

-- Ricevute e pagamenti: li legge anche l'amministrazione.
drop policy if exists ricevute_legge on ricevute;
create policy ricevute_legge on ricevute for select to authenticated using (e_staff() or e_amministrazione());
drop policy if exists pagamenti_diretti_legge on pagamenti_diretti;
create policy pagamenti_diretti_legge on pagamenti_diretti for select to authenticated using (e_staff() or e_amministrazione());

-- Le stesse funzioni di prima, con la porta aperta anche all'amministrazione.
create or replace function emetti_ricevuta(dati jsonb) returns jsonb
  language plpgsql security definer set search_path = public, extensions as $$
declare
  giorno date;
  a int;
  n int;
  v jsonb;
  pg jsonb;
  q int;
  prezzo int;
  tot int := 0;
  pag int := 0;
  voci jsonb := '[]'::jsonb;
  pagamenti jsonb;
  intest jsonb := coalesce(dati->'intestatario', '{}'::jsonb);
  nuova ricevute;
begin
  if not (e_staff() or e_amministrazione()) then raise exception 'la ricevuta la fa la segreteria' using errcode = '42501'; end if;
  begin
    giorno := (dati->>'data')::date;
  exception when others then
    raise exception 'La data della ricevuta non si capisce' using errcode = '22023';
  end;
  if giorno is null then raise exception 'Serve la data della ricevuta' using errcode = '22023'; end if;
  if jsonb_typeof(intest) <> 'object' or coalesce(trim(intest->>'nome'), '') = '' or coalesce(trim(intest->>'cognome'), '') = '' then
    raise exception 'Servono nome e cognome del socio' using errcode = '22023';
  end if;
  if jsonb_typeof(dati->'voci') is distinct from 'array' or jsonb_array_length(dati->'voci') = 0 then
    raise exception 'Serve almeno una voce' using errcode = '22023';
  end if;

  -- Le voci si riscrivono pulite: solo i campi che servono, e i conti fatti qui.
  for v in select * from jsonb_array_elements(dati->'voci') loop
    if coalesce(trim(v->>'descrizione'), '') = '' then raise exception 'Ogni voce vuole una descrizione' using errcode = '22023'; end if;
    begin
      q := coalesce((v->>'quantita')::int, 1);
      prezzo := (v->>'prezzo')::int;
    exception when others then
      raise exception 'Il prezzo di «%» non si capisce', v->>'descrizione' using errcode = '22023';
    end;
    if q < 1 or q > 99 then raise exception 'La quantità di «%» va da 1 a 99', v->>'descrizione' using errcode = '22023'; end if;
    if prezzo is null or prezzo < 0 then raise exception 'Il prezzo di «%» non va', v->>'descrizione' using errcode = '22023'; end if;
    if (v->>'dal') is not null and (v->>'al') is not null and (v->>'al')::date < (v->>'dal')::date then
      raise exception 'Le date di «%» sono al contrario', v->>'descrizione' using errcode = '22023';
    end if;
    pagamenti := '[]'::jsonb;
    for pg in select * from jsonb_array_elements(coalesce(v->'pagamenti', '[]'::jsonb)) loop
      if (pg->>'importo')::int is null or (pg->>'importo')::int < 0 then raise exception 'Un pagamento di «%» non va', v->>'descrizione' using errcode = '22023'; end if;
      if (pg->>'importo')::int = 0 then continue; end if;
      pag := pag + (pg->>'importo')::int;
      pagamenti := pagamenti || jsonb_build_object('data', coalesce((pg->>'data')::date, giorno), 'importo', (pg->>'importo')::int, 'metodo', left(coalesce(pg->>'metodo', ''), 40));
    end loop;
    tot := tot + q * prezzo;
    voci := voci || jsonb_build_object(
      'descrizione', left(trim(v->>'descrizione'), 120), 'quantita', q, 'prezzo', prezzo,
      'dal', (v->>'dal')::date, 'al', (v->>'al')::date, 'pagamenti', pagamenti);
  end loop;
  if pag + coalesce((dati->>'anticipo')::int, 0) > tot then
    raise exception 'Si è pagato più del totale: controlla gli importi' using errcode = '22023';
  end if;

  a := extract(year from giorno)::int;
  -- Una ricevuta per volta, per anno: due segreterie insieme non prendono lo stesso numero.
  perform pg_advisory_xact_lock(hashtext('ricevute'), a);
  n := nullif(dati->>'numero', '')::int;
  if n is null then
    select coalesce(max(numero), 0) + 1 into n from ricevute where anno = a;
  elsif exists (select 1 from ricevute r where r.anno = a and r.numero = n) then
    raise exception 'La ricevuta numero % del % c’è già: lascia il numero vuoto per il primo libero', n, a using errcode = '22023';
  end if;

  insert into ricevute (anno, numero, data, persona_id, ente, intestatario, voci, totale, pagato, anticipo, note, creata_da)
  values (a, n, giorno, nullif(dati->>'persona_id', '')::uuid, coalesce(dati->'ente', '{}'::jsonb), intest, voci, tot, pag,
          coalesce((dati->>'anticipo')::int, 0), nullif(trim(coalesce(dati->>'note', '')), ''), persona_corrente())
  returning * into nuova;
  return to_jsonb(nuova);
end $$;

create or replace function annulla_ricevuta(ricevuta uuid) returns void
  language plpgsql security definer set search_path = public, extensions as $$
begin
  if not (e_staff() or e_amministrazione()) then raise exception 'la ricevuta la annulla la segreteria' using errcode = '42501'; end if;
  update ricevute set annullata_il = now(), annullata_da = persona_corrente()
    where id = ricevuta and annullata_il is null;
  if not found then raise exception 'ricevuta inesistente o già annullata' using errcode = 'P0002'; end if;
end $$;

create or replace function registra_pagamento_diretto(dati jsonb) returns jsonb
  language plpgsql security definer set search_path = public, extensions as $$
declare
  giorno date;
  quanto int;
  persona uuid;
  nuovo pagamenti_diretti;
begin
  if not (e_staff() or e_amministrazione()) then raise exception 'il pagamento lo registra la segreteria' using errcode = '42501'; end if;
  begin
    persona := (dati->>'persona_id')::uuid;
  exception when others then
    raise exception 'Manca la persona' using errcode = '22023';
  end;
  if persona is null or not exists (select 1 from persone where id = persona) then
    raise exception 'Questa scheda non c’è più' using errcode = '22023';
  end if;
  begin
    giorno := (dati->>'data')::date;
  exception when others then
    raise exception 'La data del pagamento non si capisce' using errcode = '22023';
  end;
  if giorno is null then raise exception 'Serve la data del pagamento' using errcode = '22023'; end if;
  if giorno not between date '2000-01-01' and date '2100-12-31' then raise exception 'La data del pagamento non torna' using errcode = '22023'; end if;
  begin
    quanto := (dati->>'importo')::int;
  exception when others then
    raise exception 'L’importo non si capisce' using errcode = '22023';
  end;
  if quanto is null or quanto <= 0 then raise exception 'L’importo deve essere più di zero' using errcode = '22023'; end if;
  if quanto > 10000000 then raise exception 'L’importo è troppo alto: controlla le cifre' using errcode = '22023'; end if;
  -- `->>` farebbe testo anche di un oggetto o di una lista: metodo e voce devono essere testo.
  if jsonb_typeof(dati->'metodo') is distinct from 'string' then raise exception 'Scegli come ha pagato' using errcode = '22023'; end if;
  if jsonb_typeof(dati->'voce') is distinct from 'string' then raise exception 'Scrivi a cosa serve il pagamento' using errcode = '22023'; end if;
  if coalesce(btrim(dati->>'metodo'), '') = '' then raise exception 'Scegli come ha pagato' using errcode = '22023'; end if;
  if char_length(btrim(dati->>'metodo')) > 40 then raise exception 'Il modo di pagamento è troppo lungo' using errcode = '22023'; end if;
  if coalesce(btrim(dati->>'voce'), '') = '' then raise exception 'Scrivi a cosa serve il pagamento' using errcode = '22023'; end if;
  if char_length(btrim(dati->>'voce')) > 120 then raise exception 'La voce è troppo lunga' using errcode = '22023'; end if;
  if char_length(coalesce(dati->>'nota', '')) > 300 then raise exception 'La nota è troppo lunga: al massimo 300 caratteri' using errcode = '22023'; end if;

  insert into pagamenti_diretti (persona_id, data, importo, metodo, voce, nota, creato_da)
  values (persona, giorno, quanto, btrim(dati->>'metodo'), btrim(dati->>'voce'), nullif(btrim(coalesce(dati->>'nota', '')), ''), persona_corrente())
  returning * into nuovo;
  return to_jsonb(nuovo);
end $$;

create or replace function annulla_pagamento_diretto(pagamento uuid) returns void
  language plpgsql security definer set search_path = public, extensions as $$
begin
  if not (e_staff() or e_amministrazione()) then raise exception 'il pagamento lo annulla la segreteria' using errcode = '42501'; end if;
  update pagamenti_diretti set annullato_il = now(), annullato_da = persona_corrente()
    where id = pagamento and annullato_il is null;
  if not found then raise exception 'Pagamento inesistente o già annullato' using errcode = 'P0002'; end if;
end $$;

-- Il listino: lo cambia anche l'amministrazione, e nient'altro delle impostazioni.
drop policy if exists impostazioni_aggiorna on impostazioni;
create policy impostazioni_aggiorna on impostazioni for update to authenticated
  using (e_staff() or e_amministrazione()) with check (e_staff() or e_amministrazione());

create or replace function impostazioni_solo_listino() returns trigger
  language plpgsql security definer set search_path = public, extensions as $$
begin
  -- Solo chi è amministrazione e non segreteria: le funzioni del server e la segreteria cambiano tutto.
  if e_staff() or not e_amministrazione() then return new; end if;
  if (to_jsonb(new) - 'listino') is distinct from (to_jsonb(old) - 'listino') then
    raise exception 'l''amministrazione cambia solo il listino' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists impostazioni_solo_listino on impostazioni;
create trigger impostazioni_solo_listino before update on impostazioni
  for each row execute function impostazioni_solo_listino();
revoke all on function impostazioni_solo_listino() from public, anon, authenticated;

-- Il PIN del tablet: anche a chi cura i conti e insegna.
create or replace function imposta_pin(persona uuid, pin text)
  returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if auth.uid() is not null and not e_staff() then
    raise exception 'il PIN lo cambia la segreteria' using errcode = '42501';
  end if;
  if pin !~ '^\d{4}$' then raise exception 'il PIN è di quattro cifre'; end if;
  if not exists (select 1 from persone where id = persona and (ruolo::text in ('istruttore', 'staff') or (ruolo::text = 'amministrazione' and anche_istruttore))) then
    raise exception 'il PIN è solo per chi insegna o fa segreteria';
  end if;
  -- Uno per volta, se no due salvataggi insieme dello stesso PIN passano tutti e due.
  perform pg_advisory_xact_lock(hashtext('imposta_pin'));
  if exists (select 1 from pin_istruttori where persona_id <> persona and hash = crypt(pin, hash)) then
    raise exception 'questo PIN è già di un altro: scegline un altro';
  end if;
  insert into pin_istruttori (persona_id, hash) values (persona, crypt(pin, gen_salt('bf')))
    on conflict (persona_id) do update set hash = excluded.hash, cambiato_il = now();
end $$;


-- L'account si lega alla persona con la sua email anche per l'amministrazione.
create or replace function collega_utente()
  returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  chi uuid;
  mail citext;
begin
  if auth.uid() is null then return null; end if;
  select id into chi from persone where utente_id = auth.uid();
  if chi is not null then return chi; end if;
  -- Solo un'email confermata: se la conferma fosse spenta, chiunque potrebbe
  -- registrarsi con l'indirizzo della segreteria e prenderne il ruolo.
  select email into mail from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if mail is null then return null; end if;
  update persone set utente_id = auth.uid()
    where email = mail and utente_id is null and attiva and ruolo::text in ('istruttore', 'staff', 'amministrazione')
    returning id into chi;
  return chi;
end $$;

-- Il PIN del tablet apre l'area anche a chi cura i conti e insegna.
create or replace function persona_da_pin(pin text)
  returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  p uuid := postazione_corrente();
  r record;
  sbagliati int;
  chi uuid;
begin
  select * into r from tablet_regole();
  if p is null then raise exception 'solo un tablet di sala' using errcode = '42501'; end if;
  -- Un tentativo per volta per tablet: senza, cento richieste insieme
  -- vedrebbero tutte meno di cinque errori e passerebbero il blocco.
  perform pg_advisory_xact_lock(hashtext('pin:' || p::text));
  select count(*) into sbagliati from tentativi_pin
    where postazione_id = p and not riuscito and quando > now() - r.pin_blocco;
  if sbagliati >= r.pin_tentativi then
    raise exception 'troppi PIN sbagliati: riprova fra qualche minuto' using errcode = '42501';
  end if;
  select pe.id into chi from pin_istruttori pi join persone pe on pe.id = pi.persona_id
    where pi.hash = crypt(pin, pi.hash) and pe.attiva and (pe.ruolo::text in ('istruttore', 'staff') or (pe.ruolo::text = 'amministrazione' and pe.anche_istruttore));
  insert into tentativi_pin (postazione_id, riuscito) values (p, chi is not null);
  delete from tentativi_pin where quando < now() - interval '1 day';
  return chi;
end $$;

-- Chi insegna anche si elimina come un istruttore, se non ha storia.
create or replace function elimina_istruttore(persona uuid) returns uuid
language plpgsql set search_path = public as $$
declare
  p persone;
  allievo boolean := false;
begin
  if not e_staff() then
    raise exception 'Non hai il permesso: serve un accesso da segreteria' using errcode = '42501';
  end if;
  select * into p from persone where id = persona;
  if not found then
    raise exception 'Questa persona non c''è più';
  end if;
  if p.id = persona_corrente() then
    raise exception 'Non ci si elimina da soli: lo fa un''altra persona di segreteria';
  end if;
  if p.ruolo <> 'istruttore' and not (p.ruolo::text in ('staff', 'amministrazione') and p.anche_istruttore) then
    raise exception 'Si eliminano solo gli istruttori: a % si toglie l''accesso', p.nome;
  end if;
  -- Qui e non nel trigger: un iscritto la segreteria lo cancella come prima.
  if exists (select 1 from iscrizioni where persona_id = persona)
     or exists (select 1 from presenze where persona_id = persona) then
    allievo := true;
  elsif to_regclass('public.ricevute') is not null then
    -- Le ricevute ci sono solo con 16-ricevute.sql.
    execute 'select exists (select 1 from ricevute where persona_id = $1)' into allievo using persona;
  end if;
  if allievo then
    raise exception '% è anche allievo: non si elimina, gli si toglie l''accesso', btrim(p.nome || ' ' || p.cognome);
  end if;
  if p.utente_id is not null and exists (select 1 from postazioni where utente_id = p.utente_id) then
    raise exception 'L''account di % è quello di un tablet: non si toglie da qui', p.nome;
  end if;
  -- Il trigger qui sopra dice di no a chi ha insegnato.
  delete from persone where id = persona;
  return p.utente_id;
end $$;

-- I nomi di chi ha pagato, e nient'altro: l'amministrazione non legge `persone`.
create or replace function nomi_persone(ids uuid[]) returns table (id uuid, nome text, cognome text)
  language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not (e_staff() or e_amministrazione()) then
    raise exception 'i nomi li vede chi segue i pagamenti' using errcode = '42501';
  end if;
  return query select p.id, p.nome, p.cognome from persone p where p.id = any (ids);
end $$;

-- Chi ha pagato, cercato per nome: serve a chi registra un pagamento senza vedere
-- le persone. Solo id, nome e cognome (mai un contatto), almeno tre lettere
-- (`somiglia`, 34-prove-per-nome.sql), al massimo otto righe: dice chi è, non
-- scarica l'elenco. Le persone disattivate non escono.
-- Un tetto di ricerche per persona, come `ricerche_prove` (34): chi le ripete per
-- scaricare l'elenco si ferma. Una segreteria che registra pagamenti a mano ne fa
-- poche decine al giorno.
create table if not exists ricerche_pagatori (
  persona_id uuid not null references persone (id) on delete cascade,
  quando     timestamptz not null default now()
);
create index if not exists ricerche_pagatori_chi on ricerche_pagatori (persona_id, quando);
alter table ricerche_pagatori enable row level security;
revoke all on ricerche_pagatori from anon, authenticated;

create or replace function cerca_pagatori(scritto text)
  returns table (persona_id uuid, nome text, cognome text)
  language plpgsql security definer set search_path = public, extensions as $$
begin
  if not (e_staff() or e_amministrazione()) then
    raise exception 'i nomi li vede chi segue i pagamenti' using errcode = '42501';
  end if;
  -- Uno per volta per persona, se no cento richieste insieme vedono tutte meno del tetto.
  perform pg_advisory_xact_lock(hashtext('pagatori:' || persona_corrente()::text));
  if (select count(*) filter (where r.quando > now() - interval '10 minutes') >= 60
             or count(*) filter (where r.quando > now() - interval '1 day') >= 500
        from ricerche_pagatori r where r.persona_id = persona_corrente()) then
    raise exception 'troppe ricerche: riprova fra qualche minuto' using errcode = '42501';
  end if;
  insert into ricerche_pagatori (persona_id) values (persona_corrente());
  delete from ricerche_pagatori r where r.quando < now() - interval '1 day';
  if length(coalesce(scritto, '')) > 100 then return; end if;
  return query
    select p.id, p.nome, p.cognome from persone p
    where p.attiva and somiglia(p.nome, p.cognome, scritto)
    order by p.cognome, p.nome, p.id
    limit 8;
end $$;

-- Chi può chiamare cosa: come le funzioni da cui vengono, solo a chi ha fatto l'accesso.
revoke all on function persona_da_pin(text) from public, anon, authenticated;
revoke all on function e_amministrazione() from public, anon;
grant execute on function e_amministrazione() to authenticated;
revoke all on function collega_utente(), elimina_istruttore(uuid) from public, anon;
grant execute on function collega_utente(), elimina_istruttore(uuid) to authenticated;
revoke all on function emetti_ricevuta(jsonb), annulla_ricevuta(uuid), registra_pagamento_diretto(jsonb),
  annulla_pagamento_diretto(uuid), imposta_pin(uuid, text), nomi_persone(uuid[]), cerca_pagatori(text) from public, anon;
grant execute on function emetti_ricevuta(jsonb), annulla_ricevuta(uuid), registra_pagamento_diretto(jsonb),
  annulla_pagamento_diretto(uuid), imposta_pin(uuid, text), nomi_persone(uuid[]), cerca_pagatori(text) to authenticated;

-- Che l'API veda subito funzioni e tabelle nuove, senza aspettare.
notify pgrst, 'reload schema';
