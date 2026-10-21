-- La contabilità: lo storico del vecchio programma collegato alla persona che ha pagato.
--
-- I movimenti importati dalla Prima Nota («Cliente NOME per …», 63-importa-prima-nota.sql) hanno il nome solo nel
-- testo. Qui ogni movimento può avere UNA persona (`movimenti.persona_id`): è un'etichetta, «di chi è questo
-- pagamento». Non cambia importo, data, cassa, voce, descrizione, saldi, bilancio, residui, previsto e chiusure
-- (si può anche nei giorni chiusi: come «Cambiare la voce», 67-cambia-voce.sql). Non è un incasso nuovo: gli incassi
-- degli iscritti restano quelli di ricevute e pagamenti, e lo storico collegato sta a parte, mai sommato.
--
-- Cosa si collega: solo le entrate dello storico (`origine_import like 'prima-nota:%'`) sulle voci di sistema
-- «Quota associativa» e «Corsi e altri pagamenti». Non i giroconti, i movimenti scritti a mano, la «Differenza di
-- cassa», gli annullati. Il blocco automatico prende solo i movimenti col nome e cognome della causale uguali a
-- quelli di UNA sola persona (senza badare a maiuscole, accenti, spazi, ordine): chi ha più schede con quel nome
-- («da decidere») o nessuna («senza scheda») si lascia, e si decide a mano.
--
-- Chi può cosa: collega, scollega, propone e legge la traccia solo l'amministrazione (`contabilita_porta()`,
-- 59-contabilita.sql). `storico_persona` lo legge chi vede la scheda: segreteria e amministrazione. La traccia
-- `collegamenti_persona` (chi, quando, la persona di prima e quella di dopo, il lotto) non si scrive da fuori: solo
-- da queste funzioni. Una persona eliminata lascia il movimento senza persona (`on delete set null`); l'unione di
-- due schede (`unisci_persone`, 45-certificati-online.sql, che sposta ogni tabella che punta a `persone`) porta il
-- collegamento a chi resta.
--
-- Le regole sono quelle di src/lib/movimentiPersona.ts e della modalità prova, provate da
-- supabase/prova/movimenti-persona.sql.
--
-- Si lancia dopo `59-contabilita.sql`, `63-importa-prima-nota.sql` e `67-cambia-voce.sql`. Non chiede di rilanciare
-- `06-iscrizioni.sql` e non tocca nessuna funzione dei file 59, 63 o 67: rilanciarli non perde niente. Finché non c'è,
-- la schermata dice di lanciare questo file e il resto della contabilità funziona.
-- ---------------------------------------------------------------------------

alter table movimenti add column if not exists persona_id uuid references persone on delete set null;
create index if not exists movimenti_persona on movimenti (persona_id) where persona_id is not null;

create table if not exists collegamenti_persona (
  id               uuid primary key default gen_random_uuid(),
  movimento_id     uuid not null references movimenti,
  persona_prima_id uuid references persone on delete set null,
  persona_dopo_id  uuid references persone on delete set null,
  -- Il blocco automatico scrive un lotto per volta: TOGLI QUESTO LOTTO scollega solo quello.
  lotto            uuid,
  fatto_il         timestamptz not null default clock_timestamp(),
  fatto_da         uuid references persone on delete set null,
  -- I nomi com'erano quando si è fatto: cancellando una scheda gli id diventano vuoti (`on delete set null`), i nomi no.
  fatto_da_nome      text,
  persona_prima_nome text,
  persona_dopo_nome  text
);
alter table collegamenti_persona add column if not exists fatto_da_nome text, add column if not exists persona_prima_nome text,
  add column if not exists persona_dopo_nome text;
create index if not exists collegamenti_persona_movimento on collegamenti_persona (movimento_id, fatto_il);
create index if not exists collegamenti_persona_lotto on collegamenti_persona (lotto) where lotto is not null;

alter table collegamenti_persona enable row level security;
revoke all on collegamenti_persona from anon, authenticated;
grant select on collegamenti_persona to authenticated;
drop policy if exists collegamenti_persona_legge on collegamenti_persona;
create policy collegamenti_persona_legge on collegamenti_persona for select to authenticated using (e_amministrazione());

-- Il nome come lo si confronta: minuscolo, senza accenti (anche quelli scomposti), apostrofo dritto, spazi di ogni tipo
-- uno solo, le parole in ordine alfabetico (così «Rossi Giulia» e «Giulia Rossi» sono lo stesso nome). Lo stesso di
-- `normalizzaNome` (src/lib/movimentiPersona.ts). Il vecchio programma scrive l'accento come apostrofo («NICOLO'»): in
-- fondo alla parola dopo una vocale si toglie; dopo una consonante («D'Amico», «Sant' Anna») è un'elisione e resta.
-- Pura e con l'indice qui sotto: serve a `persone`, quindi anche chi scrive una persona ha il permesso di chiamarla.
create or replace function collegamento_token(t text) returns text language sql immutable set search_path = public as $$
  select string_agg(regexp_replace(x, '([aeiou])''$', '\1'), ' ' order by regexp_replace(x, '([aeiou])''$', '\1'))
  from unnest(regexp_split_to_array(
    btrim(regexp_replace(
      regexp_replace(normalize(translate(lower(coalesce(t, '')), '‘’`', repeat(chr(39), 3)), NFD), '[\u0300-\u036f]', '', 'g'),
      '[\s\u00a0\u2007\u202f\u200b\ufeff]+', ' ', 'g')),
    ' ')) x
  where x <> '' $$;

-- Il nome della causale «Cliente NOME per …»: la prima «per» lo chiude (tutti i quantificatori pigri: in Postgres
-- la voracità la decide il primo). Gli spazi larghi o che non vanno a capo valgono spazio, come in JavaScript.
create or replace function collegamento_nome(descrizione text) returns text language sql immutable set search_path = public as $$
  select substring(regexp_replace(descrizione, '[\u00a0\u2007\u202f\ufeff]', ' ', 'g') from '(?i)^\s*?cliente\s+?(.+?)\s+?per\s') $$;

-- Cercare per nome sulle schede costa una scansione: con l'indice è una ricerca. Se la funzione sopra cambia, si rifà: il
-- `reindex` sotto lo fa a ogni lancio (le schede sono poche), così un indice fatto con la regola di prima non resta.
create index if not exists persone_nome_token on persone (collegamento_token(nome || ' ' || cognome));
reindex index persone_nome_token;

-- Le persone con quel nome (nome e cognome, in qualunque ordine).
create or replace function collegamento_candidati(descrizione text) returns setof uuid
  language sql stable security definer set search_path = public as $$
  select p.id from persone p
  where collegamento_nome(descrizione) is not null
    and collegamento_token(p.nome || ' ' || p.cognome) = collegamento_token(collegamento_nome(descrizione)) $$;

-- Un movimento si può collegare? (la stessa regola di `collegamento_perche`, come domanda sì/no)
create or replace function collegamento_possibile(m movimenti) returns boolean
  language sql stable security definer set search_path = public as $$
  select m.tipo = 'entrata' and m.annullato_il is null and m.origine_import like 'prima-nota:%'
    and exists (select 1 from voci_contabili v where v.id = m.voce_id and v.nome in ('Quota associativa', 'Corsi e altri pagamenti')) $$;

-- Perché no: la frase per chi usa l'app, o null se si può. Le stesse di `cosaNonVaCollegato` (src/lib/movimentiPersona.ts).
create or replace function collegamento_perche(m movimenti) returns text
  language plpgsql stable security definer set search_path = public as $$
declare
  q text := 'Il movimento del ' || to_char(m.data, 'DD/MM/YYYY') || ' (' || m.descrizione || ')';
  v voci_contabili;
begin
  if m.annullato_il is not null then return q || ' è annullato: non si collega'; end if;
  if m.tipo = 'giroconto' then return 'Un giroconto non ha una persona'; end if;
  select * into v from voci_contabili where id = m.voce_id;
  if v.di_sistema and v.nome = 'Differenza di cassa' then return q || ' è scritto dalla chiusura di cassa: non si collega'; end if;
  if m.tipo = 'uscita' then return q || ' è un’uscita: si collegano solo le entrate'; end if;
  if m.origine_import is null or m.origine_import not like 'prima-nota:%' then return q || ' non viene dal vecchio programma: non si collega'; end if;
  if v.nome not in ('Quota associativa', 'Corsi e altri pagamenti') then
    return q || ' è su «' || v.nome || '»: si collegano solo quelli su «Quota associativa» e «Corsi e altri pagamenti»';
  end if;
  return null;
end $$;

-- Scrive il collegamento e la traccia, insieme.
create or replace function collegamento_scrivi(m movimenti, dopo uuid, lot uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  update movimenti set persona_id = dopo where id = m.id;
  insert into collegamenti_persona (movimento_id, persona_prima_id, persona_dopo_id, lotto, fatto_da, fatto_da_nome, persona_prima_nome, persona_dopo_nome)
  values (m.id, m.persona_id, dopo, lot, persona_corrente(),
          (select p.nome || ' ' || p.cognome from persone p where p.id = persona_corrente()),
          (select p.nome || ' ' || p.cognome from persone p where p.id = m.persona_id),
          (select p.nome || ' ' || p.cognome from persone p where p.id = dopo));
end $$;

-- Quanti si collegherebbero e quanti no: il riepilogo da confermare prima di scrivere.
create or replace function riepilogo_collegamenti_persona() returns jsonb
  language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  perform contabilita_porta();
  with m as (
    select x.*, (select count(*) from collegamento_candidati(x.descrizione)) as n
    from movimenti x where collegamento_possibile(x)
  ), libero as (select * from m where persona_id is null)
  select jsonb_build_object(
    'sicuri', (select jsonb_build_object('movimenti', count(*), 'persone', count(distinct (select c from collegamento_candidati(descrizione) c)),
                                         'centesimi', coalesce(sum(importo), 0), 'dal', min(data), 'al', max(data)) from libero where n = 1),
    'da_decidere', (select jsonb_build_object('movimenti', count(*), 'centesimi', coalesce(sum(importo), 0)) from libero where n > 1),
    'senza_scheda', (select jsonb_build_object('movimenti', count(*), 'centesimi', coalesce(sum(importo), 0)) from libero where n = 0),
    'gia_collegati', (select count(*) from m where persona_id is not null),
    'campione', coalesce((
      select jsonb_agg(jsonb_build_object('causale', l.descrizione,
        'persona', (select p.nome || ' ' || p.cognome from persone p where p.id = (select c from collegamento_candidati(l.descrizione) c))))
      from (select * from libero where n = 1 order by data, id limit 5) l), '[]'::jsonb))
  into r;
  return r;
end $$;

-- Per riga: cosa si può dire dei movimenti ancora senza persona (il tag dell'elenco e i filtri DA DECIDERE e SENZA
-- SCHEDA): «sicuro» (una scheda sola col nome), «omonimi» (due o più), «nessuna» (nessuna scheda, o una causale senza
-- nome). Solo quelli che si possono collegare; i numeri sono quelli del riepilogo.
create or replace function esiti_collegamenti_persona() returns jsonb
  language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  perform contabilita_porta();
  -- Un solo jsonb: una risposta in righe verrebbe tagliata a mille dall'API.
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'esito', case n.c when 1 then 'sicuro' when 0 then 'nessuna' else 'omonimi' end) order by x.id), '[]'::jsonb)
  into r
  from movimenti x, lateral (select count(*) as c from collegamento_candidati(x.descrizione)) n
  where x.persona_id is null and collegamento_possibile(x);
  return r;
end $$;

-- Il blocco automatico, a pacchetti: collega fino a `quanti` (al massimo 500) dei sicuri non ancora collegati,
-- tutti con lo stesso lotto; chi lo chiama ripete finché `restano` è 0.
create or replace function collega_sicuri_persona(lotto uuid, quanti integer default 500) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  m movimenti;
  fatti integer := 0;
  resto integer;
begin
  perform contabilita_porta();
  if quanti is null or quanti < 1 then raise exception 'Scegli almeno un movimento' using errcode = '22023'; end if;
  if quanti > 500 then raise exception 'Troppi movimenti in una volta: al massimo 500' using errcode = '22023'; end if;
  if lotto is null then raise exception 'Manca il lotto' using errcode = '22023'; end if;
  for m in
    select x.* from movimenti x
    where x.persona_id is null and collegamento_possibile(x) and (select count(*) from collegamento_candidati(x.descrizione)) = 1
    order by x.id limit quanti for update
  loop
    perform collegamento_scrivi(m, (select c from collegamento_candidati(m.descrizione) c), lotto);
    fatti := fatti + 1;
  end loop;
  select count(*) into resto from movimenti x
   where x.persona_id is null and collegamento_possibile(x) and (select count(*) from collegamento_candidati(x.descrizione)) = 1;
  return jsonb_build_object('collegati', fatti, 'restano', resto);
end $$;

-- A mano: uno o tanti movimenti a una persona. O collegano tutti o nessuno (un solo errore ferma il lotto e dice
-- quale movimento). Un movimento già di un'altra persona passa a questa: la traccia ricorda prima e dopo.
create or replace function collega_movimenti_persona(ids uuid[], persona uuid) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  m movimenti;
  elenco uuid[];
  fatti integer := 0;
  gia integer := 0;
  no text;
begin
  perform contabilita_porta();
  select coalesce(array_agg(distinct x order by x), '{}') into elenco from unnest(ids) x where x is not null;
  if cardinality(elenco) = 0 then raise exception 'Scegli almeno un movimento' using errcode = '22023'; end if;
  if cardinality(elenco) > 500 then raise exception 'Troppi movimenti in una volta: al massimo 500' using errcode = '22023'; end if;
  if persona is null or not exists (select 1 from persone p where p.id = persona) then raise exception 'Scegli la persona' using errcode = '22023'; end if;
  if (select count(*) from movimenti x where x.id = any(elenco)) <> cardinality(elenco) then
    raise exception 'Il movimento non c’è' using errcode = 'P0002';
  end if;
  -- le righe in ordine di id: due lotti insieme non si incrociano; e si rilegge lo stato dopo il blocco
  for m in select x.* from movimenti x where x.id = any(elenco) order by x.id for update loop
    no := collegamento_perche(m);
    if no is not null then raise exception '%', no using errcode = '22023'; end if;
  end loop;
  for m in select x.* from movimenti x where x.id = any(elenco) order by x.id loop
    if m.persona_id is not distinct from persona then
      gia := gia + 1;
    else
      perform collegamento_scrivi(m, persona, null);
      fatti := fatti + 1;
    end if;
  end loop;
  return jsonb_build_object('collegati', fatti, 'gia_cosi', gia);
end $$;

-- Toglie la persona a uno o tanti movimenti. Come il collegamento: al massimo 500, tutto o niente.
create or replace function scollega_movimenti_persona(ids uuid[]) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  m movimenti;
  elenco uuid[];
  fatti integer := 0;
  gia integer := 0;
begin
  perform contabilita_porta();
  select coalesce(array_agg(distinct x order by x), '{}') into elenco from unnest(ids) x where x is not null;
  if cardinality(elenco) = 0 then raise exception 'Scegli almeno un movimento' using errcode = '22023'; end if;
  if cardinality(elenco) > 500 then raise exception 'Troppi movimenti in una volta: al massimo 500' using errcode = '22023'; end if;
  if (select count(*) from movimenti x where x.id = any(elenco)) <> cardinality(elenco) then
    raise exception 'Il movimento non c’è' using errcode = 'P0002';
  end if;
  for m in select x.* from movimenti x where x.id = any(elenco) order by x.id for update loop
    if m.persona_id is null then
      gia := gia + 1;
    else
      perform collegamento_scrivi(m, null, null);
      fatti := fatti + 1;
    end if;
  end loop;
  return jsonb_build_object('scollegati', fatti, 'gia_senza', gia);
end $$;

-- TOGLI QUESTO LOTTO: scollega i movimenti che quel lotto ha collegato e che hanno ancora quella persona. Quelli
-- ricollegati a mano dopo (un'altra persona) non si toccano.
create or replace function togli_lotto_collegamenti(lotto uuid) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  m movimenti;
  fresco movimenti;
  fatti integer := 0;
begin
  perform contabilita_porta();
  for m in
    select x.* from movimenti x
    where x.persona_id is not null
      and exists (select 1 from collegamenti_persona c where c.movimento_id = x.id and c.lotto = togli_lotto_collegamenti.lotto)
    order by x.id for update
  loop
    -- Dopo il blocco si rilegge lo stato: se un altro amministratore l'ha ricollegato a mano mentre si aspettava, non si tocca.
    select * into fresco from movimenti y where y.id = m.id;
    if fresco.persona_id is not null and exists (
      select 1 from collegamenti_persona c
      where c.id = (select u.id from collegamenti_persona u where u.movimento_id = fresco.id order by u.fatto_il desc, u.id desc limit 1)
        and c.lotto = togli_lotto_collegamenti.lotto and c.persona_dopo_id = fresco.persona_id)
    then
      perform collegamento_scrivi(fresco, null, null);
      fatti := fatti + 1;
    end if;
  end loop;
  return jsonb_build_object('tolti', fatti);
end $$;

-- Per scegliere a mano: le persone col nome della causale. Solo per i movimenti che si possono collegare (se no sarebbe
-- una ricerca per nome sulle schede di chiunque). L'anno di nascita, i corsi e l'iscrizione servono a distinguere due
-- omonimi: con una persona sola escono solo id, nome e cognome. Solo l'amministrazione.
create or replace function candidati_persona_movimento(movimento uuid)
  returns table (id uuid, nome text, cognome text, anno_nascita integer, corsi text[], iscritto_dal date)
  language plpgsql security definer set search_path = public as $$
declare
  mv movimenti;
  no text;
begin
  perform contabilita_porta();
  select * into mv from movimenti x where x.id = movimento;
  if not found then raise exception 'Il movimento non c’è' using errcode = 'P0002'; end if;
  no := collegamento_perche(mv);
  if no is not null then raise exception '%', no using errcode = '22023'; end if;
  return query
    with c as (select p.id, p.nome, p.cognome from persone p where p.id in (select collegamento_candidati(mv.descrizione))),
         n as (select count(*) as q from c)
    select c.id, c.nome, c.cognome,
           case when n.q > 1 then extract(year from a.nato_il)::integer end,
           case when n.q > 1
             then coalesce((select array_agg(k.nome order by k.nome) from iscrizioni i join corsi k on k.id = i.corso_id where i.persona_id = c.id), '{}')
             else '{}'::text[] end,
           case when n.q > 1 then (select min(i.dal) from iscrizioni i where i.persona_id = c.id) end
    from c cross join n left join anagrafiche a on a.persona_id = c.id
    order by c.cognome, c.nome, c.id;
end $$;

-- Lo storico di una persona, per la sua scheda: i movimenti collegati non annullati, dal più recente.
create or replace function storico_persona(persona uuid)
  returns table (id uuid, data date, descrizione text, importo integer, voce text, cassa text)
  language plpgsql security definer set search_path = public as $$
begin
  if not (e_staff() or e_amministrazione()) then
    raise exception 'lo storico lo vedono segreteria e amministrazione' using errcode = '42501';
  end if;
  return query
    select m.id, m.data, m.descrizione, m.importo, v.nome, c.nome
    from movimenti m join voci_contabili v on v.id = m.voce_id join casse c on c.id = m.cassa_id
    where m.persona_id = storico_persona.persona and m.annullato_il is null
    order by m.data desc, m.id;
end $$;

-- Le funzioni di appoggio non le chiama nessuno da fuori (salvo `collegamento_token`, qui sotto): solo le otto che seguono, che le usano come proprietario.
revoke all on function collegamento_nome(text), collegamento_candidati(text),
  collegamento_possibile(movimenti), collegamento_perche(movimenti), collegamento_scrivi(movimenti, uuid, uuid) from public, anon, authenticated;
-- `collegamento_token` fa da indice di `persone`: chi scrive una persona (segreteria) deve poterla chiamare. È pura, non espone niente.
revoke all on function collegamento_token(text) from public, anon;
grant execute on function collegamento_token(text) to authenticated;

revoke all on function riepilogo_collegamenti_persona(), esiti_collegamenti_persona(), collega_sicuri_persona(uuid, integer),
  collega_movimenti_persona(uuid[], uuid), scollega_movimenti_persona(uuid[]), togli_lotto_collegamenti(uuid),
  candidati_persona_movimento(uuid), storico_persona(uuid)
  from public, anon;
grant execute on function riepilogo_collegamenti_persona(), esiti_collegamenti_persona(), collega_sicuri_persona(uuid, integer),
  collega_movimenti_persona(uuid[], uuid), scollega_movimenti_persona(uuid[]), togli_lotto_collegamenti(uuid),
  candidati_persona_movimento(uuid), storico_persona(uuid)
  to authenticated;

-- Che l'API veda subito funzioni, colonna e tabella nuove, senza aspettare.
notify pgrst, 'reload schema';
