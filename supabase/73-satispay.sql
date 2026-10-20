-- Il pagamento con Satispay dal modulo di iscrizione: chi si iscrive sceglie Satispay, manda la richiesta e paga
-- dall'app Satispay l'importo che calcola il database dal listino, non quello che dice il telefono. Satispay avvisa
-- la Edge Function `satispay` (supabase/functions/satispay), che rilegge lo stato da Satispay e lo scrive qui: il
-- pagamento risulta pagato senza che la segreteria lo segni.
--
-- La tabella `pagamenti_satispay`: un pagamento per tentativo, al più uno in attesa o pagato per richiesta. Il nome
-- di chi paga (`chi`) resta anche se la richiesta si cancella: i soldi sono arrivati e vanno restituiti o ricevuti.
-- Il pagamento entra nella ricevuta della palestra con `emetti_ricevuta_satispay`: da lì conta solo la ricevuta, e
-- in PAGAMENTI e CONTABILITÀ c'è un incasso solo (src/lib/satispay.ts, `righeSatispay`).
--
-- Chi può cosa:
--   · leggere: segreteria e amministrazione, come le ricevute;
--   · scrivere: nessuno direttamente. Le funzioni del servizio le chiama solo la Edge Function, con la
--     chiave `service_role` che non esce dal server: dal modulo (anon) si passa sempre da lì;
--   · `emetti_ricevuta_satispay`: chi fa le ricevute.
--
-- Si lancia dopo `55-amministrazione.sql` (`emetti_ricevuta`). Non tocca nessuna funzione di prima. Finché non c'è,
-- la Edge Function risponde «non attivo» e il modulo propone bonifico e segreteria, come prima.
-- ---------------------------------------------------------------------------

create table if not exists pagamenti_satispay (
  id           uuid primary key default gen_random_uuid(),
  richiesta_id uuid references richieste_iscrizione on delete set null,
  chi          text not null check (char_length(btrim(chi)) between 1 and 170),
  importo      int not null check (importo > 0),
  stato        text not null check (stato in ('attesa', 'pagato', 'non-andato')),
  satispay_id  text unique,
  link         text,
  creato_il    timestamptz not null default now(),
  pagato_il    timestamptz,
  ricevuta_id  uuid references ricevute on delete set null,
  -- La scheda della richiesta accolta: resta anche se poi la richiesta si cancella, e la legge anche l'amministrazione.
  persona_id   uuid references persone on delete set null
);
alter table pagamenti_satispay add column if not exists persona_id uuid references persone on delete set null;
-- Mai due pagamenti vivi per la stessa richiesta: due tocchi, o due callback insieme, non fanno pagare due volte.
create unique index if not exists pagamenti_satispay_uno on pagamenti_satispay (richiesta_id) where stato in ('attesa', 'pagato');

alter table pagamenti_satispay enable row level security;
drop policy if exists pagamenti_satispay_legge on pagamenti_satispay;
create policy pagamenti_satispay_legge on pagamenti_satispay for select to authenticated using (e_staff() or e_amministrazione());
-- Su Supabase anche `service_role` ha la tabella di suo: si toglie, e scrive solo dalle funzioni.
revoke all on pagamenti_satispay from public, anon, authenticated, service_role;
grant select on pagamenti_satispay to authenticated;

-- Accolta la richiesta, i suoi pagamenti sanno di quale scheda sono: `accogli_iscrizione` non si tocca.
create or replace function satispay_alla_persona() returns trigger language plpgsql security definer set search_path = public as $$
begin
  update pagamenti_satispay set persona_id = new.persona_id where richiesta_id = new.id;
  return new;
end $$;
revoke all on function satispay_alla_persona() from public, anon, authenticated;
drop trigger if exists richieste_satispay_persona on richieste_iscrizione;
create trigger richieste_satispay_persona after update of persona_id on richieste_iscrizione
  for each row when (new.persona_id is distinct from old.persona_id) execute function satispay_alla_persona();

-- Il prezzo di un corso dal listino, in centesimi, come `stimaIscrizione` (src/lib/nucleo.ts): della voce del corso
-- vale la prima riga di `prezzi` che ha quel prezzo; il saldo solo se è ancora in tempo e diverso dall'annuale.
create or replace function prezzo_dal_listino(voce jsonb, formula text, giorno date, saldo_entro date) returns int
  language sql immutable set search_path = public as $$
  select case
    when formula = 'trimestre' then
      (select round((q->>'trimestre')::numeric * 100)::int from jsonb_array_elements(voce->'prezzi') with ordinality x(q, n)
        where q ? 'trimestre' order by n limit 1)
    else coalesce(
      case when giorno <= saldo_entro then
        (select round((q->>'saldo')::numeric * 100)::int from jsonb_array_elements(voce->'prezzi') with ordinality x(q, n)
          where q ? 'saldo' and (q->'saldo') is distinct from (q->'annuale') order by n limit 1)
      end,
      (select round((q->>'annuale')::numeric * 100)::int from jsonb_array_elements(voce->'prezzi') with ordinality x(q, n)
        where q ? 'annuale' order by n limit 1))
  end
$$;

-- Quanto paga una richiesta il giorno `giorno`: la quota e i corsi, con lo sconto famiglia del 20% sull'annuale che
-- costa meno se ce ne sono due. `null` se il listino non c'è o un corso non ha il prezzo: allora niente Satispay.
create or replace function importo_iscrizione(richiesta uuid, giorno date) returns int
  language plpgsql stable security definer set search_path = public as $$
declare
  l jsonb;
  r richieste_iscrizione;
  c uuid;
  v jsonb;
  p int;
  tot int;
  annuali int[] := '{}';
begin
  select listino into l from impostazioni limit 1;
  select * into r from richieste_iscrizione where id = richiesta;
  if l is null or r.id is null then return null; end if;
  tot := round((l->>'quota')::numeric * 100)::int;
  foreach c in array r.corsi loop
    select x into v from jsonb_array_elements(l->'corsi') x where x->>'corsoId' = c::text limit 1;
    p := prezzo_dal_listino(v, r.formula, giorno, (l->>'saldoEntro')::date);
    if p is null then return null; end if;
    tot := tot + p;
    if r.formula = 'annuale' then annuali := annuali || p; end if;
  end loop;
  if cardinality(annuali) >= 2 then
    tot := tot - round((select min(a) from unnest(annuali) a) * 0.2)::int;
  end if;
  return tot;
end $$;

-- Il pagamento da far fare: quello pagato, quello in attesa (mai un secondo), o uno nuovo con l'importo di oggi.
create or replace function satispay_prepara(richiesta uuid) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  r richieste_iscrizione;
  p pagamenti_satispay;
  quanto int;
begin
  select * into r from richieste_iscrizione where id = richiesta for update;
  if r.id is null or r.stato <> 'nuova' then
    raise exception 'Questa richiesta non si può più pagare online: paga in segreteria' using errcode = '22023';
  end if;
  select * into p from pagamenti_satispay where richiesta_id = richiesta and stato in ('attesa', 'pagato');
  if p.stato = 'pagato' then
    return jsonb_build_object('stato', 'pagato', 'importo', p.importo, 'pagato_il', p.pagato_il);
  elsif p.stato = 'attesa' then
    return jsonb_build_object('stato', 'attesa', 'id', p.id, 'importo', p.importo, 'satispay_id', p.satispay_id, 'link', p.link);
  end if;
  quanto := importo_iscrizione(richiesta, (now() at time zone 'Europe/Rome')::date);
  if quanto is null then
    raise exception 'Un corso non ha ancora il prezzo: paga col bonifico o in segreteria' using errcode = '22023';
  end if;
  insert into pagamenti_satispay (richiesta_id, chi, importo, stato)
    values (richiesta, btrim(r.cognome) || ' ' || btrim(r.nome), quanto, 'attesa')
    returning * into p;
  return jsonb_build_object('stato', 'attesa', 'id', p.id, 'importo', p.importo, 'satispay_id', null, 'link', null);
end $$;

-- Lo stato del pagamento di una richiesta, senza crearne uno: quello vivo, o l'ultimo non andato. `null` se non c'è.
create or replace function satispay_stato(richiesta uuid) returns jsonb
  language sql stable security definer set search_path = public as $$
  select jsonb_build_object('stato', p.stato, 'importo', p.importo, 'pagato_il', p.pagato_il, 'satispay_id', p.satispay_id)
    from pagamenti_satispay p where p.richiesta_id = richiesta
    order by (p.stato <> 'non-andato') desc, p.creato_il desc limit 1
$$;

-- Satispay ha creato il pagamento: il suo id, per riconoscere la callback, e il link, per riaprirlo.
create or replace function satispay_creato(id uuid, satispay_id text, link text) returns void
  language sql security definer set search_path = public as $$
  update pagamenti_satispay p set satispay_id = $2, link = $3 where p.id = $1 and p.stato = 'attesa' and p.satispay_id is null
$$;

-- Lo stato come lo dice Satispay, riletto dal server con una richiesta firmata: mai dal corpo della callback, che
-- chiunque può chiamare. Pagato resta pagato, e la data è quella della prima conferma.
create or replace function satispay_esito(satispay_id text, stato_satispay text) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  p pagamenti_satispay;
begin
  select * into p from pagamenti_satispay x where x.satispay_id = $1 for update;
  if p.id is null then raise exception 'Pagamento Satispay sconosciuto' using errcode = 'P0002'; end if;
  -- Pagato dopo che Satispay l'aveva dato per annullato: non dovrebbe succedere (CANCELED è definitivo). Se succede,
  -- l'errore resta nel log della Edge Function invece di sparire: quei soldi vanno restituiti a mano.
  if stato_satispay = 'ACCEPTED' and p.stato = 'non-andato' then
    raise exception 'Satispay dà pagato un pagamento annullato (%): va restituito dalla dashboard', p.satispay_id using errcode = '22023';
  end if;
  if stato_satispay = 'ACCEPTED' and p.stato = 'attesa' then
    update pagamenti_satispay set stato = 'pagato', pagato_il = now() where id = p.id returning * into p;
  elsif stato_satispay = 'CANCELED' and p.stato = 'attesa' then
    update pagamenti_satispay set stato = 'non-andato' where id = p.id returning * into p;
  end if;
  return jsonb_build_object('stato', p.stato, 'importo', p.importo, 'pagato_il', p.pagato_il);
end $$;

-- «230», «12,50»: come `soldi` di src/lib/satispay.ts, per i messaggi.
create or replace function soldi_sql(cent int) returns text language sql immutable set search_path = public as $$
  select case when cent % 100 = 0 then (cent / 100)::text else replace(to_char(cent / 100.0, 'FM999999990.00'), '.', ',') end
$$;

-- La ricevuta col pagamento Satispay già dentro, nella stessa transazione: o tutte e due, o nessuna. I pagamenti con
-- metodo «Satispay» devono fare esattamente l'importo arrivato, e la ricevuta è della persona della richiesta accolta.
create or replace function emetti_ricevuta_satispay(dati jsonb, pagamento uuid) returns jsonb
  language plpgsql security definer set search_path = public, extensions as $$
declare
  p pagamenti_satispay;
  somma int;
  nuova jsonb;
begin
  if not (e_staff() or e_amministrazione()) then raise exception 'la ricevuta la fa la segreteria' using errcode = '42501'; end if;
  select * into p from pagamenti_satispay where id = pagamento for update;
  if p.id is null or p.stato <> 'pagato' then
    raise exception 'Questo pagamento Satispay non è arrivato' using errcode = '22023';
  end if;
  -- In una ricevuta annullata i soldi non contano più: possono entrare in quella giusta.
  if exists (select 1 from ricevute r where r.id = p.ricevuta_id and r.annullata_il is null) then
    raise exception 'Questo pagamento Satispay è già in una ricevuta' using errcode = '22023';
  end if;
  if p.persona_id is null or p.persona_id is distinct from nullif(dati->>'persona_id', '')::uuid then
    raise exception 'Il pagamento Satispay è di un’altra persona: accogli prima la sua richiesta' using errcode = '22023';
  end if;
  select coalesce(sum((pg->>'importo')::int), 0) into somma
    from jsonb_array_elements(coalesce(dati->'voci', '[]'::jsonb)) v,
         jsonb_array_elements(coalesce(v->'pagamenti', '[]'::jsonb)) pg
    where pg->>'metodo' = 'Satispay';
  if somma <> p.importo then
    -- Lo stesso testo di `cosaNonVaSatispay` (src/lib/satispay.ts): i centesimi solo se ci sono.
    raise exception 'Con Satispay sono arrivati % €: nel pagato di questa ricevuta ce ne sono % €', soldi_sql(p.importo), soldi_sql(somma)
      using errcode = '22023';
  end if;
  nuova := emetti_ricevuta(dati);
  update pagamenti_satispay set ricevuta_id = (nuova->>'id')::uuid where id = p.id;
  return nuova;
end $$;

revoke all on function soldi_sql(int), prezzo_dal_listino(jsonb, text, date, date), importo_iscrizione(uuid, date), satispay_prepara(uuid),
  satispay_stato(uuid), satispay_creato(uuid, text, text), satispay_esito(text, text), emetti_ricevuta_satispay(jsonb, uuid)
  from public, anon, authenticated;
grant execute on function importo_iscrizione(uuid, date), satispay_prepara(uuid), satispay_stato(uuid), satispay_creato(uuid, text, text),
  satispay_esito(text, text) to service_role;
grant execute on function emetti_ricevuta_satispay(jsonb, uuid) to authenticated;
