-- ODS Corsi · la ricevuta per email
--
-- Fatta la ricevuta, la famiglia la riceve in PDF all'EMAIL DI CONTATTO della persona della ricevuta
-- (`ricevute.persona_id`, `44-email-contatto.sql`), mai all'email di accesso: per un minore è quella del genitore.
-- La mail la manda la Edge Function `ricevuta-email` (supabase/functions/ricevuta-email): l'indirizzo lo sceglie
-- il database, il browser non lo manda mai, e nessuna funzione di qui ha un argomento per l'indirizzo.
--
--   · `invii_ricevute`: una riga per tentativo («mandata» o «non partita», col motivo corto), mai cambiata né
--     cancellata. La legge solo la segreteria (`e_staff()`); la scrive solo `registra_invio_ricevuta`, cioè la Edge
--     Function. L'indirizzo resta anche se poi la persona si cancella: è quello a cui la ricevuta è partita.
--   · `impostazioni.ricevute_email_dal`: da quando le ricevute si mandano. Una fatta prima e mai mandata è «Fatta
--     prima dell'invio per email», e si manda solo a mano. La mette questo file, una volta sola.
--   · `indirizzo_ricevuta(ricevuta)`: l'email di contatto, o NULL. Solo `service_role` (la Edge Function).
--   · `controlla_invio_ricevuta(ricevuta)`: la chiama la Edge Function col token di chi preme, così vale il suo ruolo.
--     Dà i dati per la mail (numero, anno, data, totale, nome, cognome), se l'indirizzo c'è, le «mandata» di oggi
--     (giorno di Europe/Rome, di tutte le ricevute), se sono già 400, se chi preme è la segreteria e chi è
--     (`persona`). Mai l'indirizzo. Annullata: errcode 55000; la stessa ricevuta già «mandata» 3 volte nelle ultime
--     24 ore: errcode 54000 (un tasto premuto per sbaglio, o un PDF qualsiasi mandato in giro dal browser).
--   · `registra_invio_ricevuta(ricevuta, esito, motivo, da, indirizzo, pdf_sha256)`: solo `service_role`, cioè la
--     Edge Function dopo aver provato a mandare: dal browser una «mandata» finta riempirebbe la soglia. `da` è chi ha
--     premuto (da `controlla_invio_ricevuta`), `indirizzo` quello a cui è partita (se manca, quello della scheda),
--     `pdf_sha256` l'impronta del PDF allegato. Una «mandata» si scrive anche se nel frattempo la ricevuta è stata
--     annullata o il contatto tolto: la mail è partita, e la riga deve dirlo.
--   · `esiti_invio_ricevuta(ricevuta)`: data ed esito, senza indirizzo né motivo: quello che vede l'amministrazione,
--     che non apre le schede e quindi non vede i recapiti.
-- Segreteria e amministrazione mandano; istruttori, tablet, iscritti e `anon` no.
--
-- Si lancia dopo `44-email-contatto.sql` e `55-amministrazione.sql`. Non chiede di rilanciare `06-iscrizioni.sql` e
-- non tocca nessuna funzione di prima. Finché non c'è, la ricevuta si fa e si scarica come sempre, l'avviso dice di
-- lanciare questo file e lo storico non dice niente della mail.
-- ---------------------------------------------------------------------------

create table if not exists invii_ricevute (
  id          uuid primary key default gen_random_uuid(),
  -- Una ricevuta non si cancella (si annulla): gli invii restano con lei.
  ricevuta_id uuid not null references ricevute on delete cascade,
  -- Quello a cui è partita allora: se la scheda cambia dopo, lo storico dice il vero.
  indirizzo   citext not null,
  esito       text not null check (esito in ('mandata', 'non partita')),
  motivo      text check (length(motivo) <= 200),
  creato_il   timestamptz not null default now(),
  creato_da   uuid references persone on delete set null,
  -- Quale PDF è partito, senza tenerne la copia: il PDF lo fa il browser.
  pdf_sha256  text check (pdf_sha256 ~ '^[0-9a-f]{64}$')
);
alter table invii_ricevute add column if not exists pdf_sha256 text check (pdf_sha256 ~ '^[0-9a-f]{64}$');
create index if not exists invii_ricevute_ricevuta on invii_ricevute (ricevuta_id, creato_il);
-- La soglia conta le «mandata» di oggi: senza indice sarebbe tutta la tabella a ogni invio.
create index if not exists invii_ricevute_mandate on invii_ricevute (creato_il) where esito = 'mandata';

alter table invii_ricevute enable row level security;
-- Su Supabase anche `service_role` ha la tabella di suo: si toglie, la Edge Function passa dalle funzioni.
revoke all on invii_ricevute from public, anon, authenticated, service_role;
grant select on invii_ricevute to authenticated;
drop policy if exists invii_ricevute_legge on invii_ricevute;
create policy invii_ricevute_legge on invii_ricevute for select to authenticated using (e_staff());

alter table impostazioni add column if not exists ricevute_email_dal timestamptz;
-- Una volta sola: rilanciare il file non sposta la data, se no le ricevute di mezzo diventerebbero «fatte prima».
update impostazioni set ricevute_email_dal = now() where ricevute_email_dal is null;

create or replace function indirizzo_ricevuta(ricevuta uuid) returns text
  language sql stable security definer set search_path = public, extensions as $$
  select nullif(trim(p.email_contatto::text), '')
    from ricevute r join persone p on p.id = r.persona_id
   where r.id = indirizzo_ricevuta.ricevuta
$$;

create or replace function controlla_invio_ricevuta(ricevuta uuid) returns jsonb
  language plpgsql stable security definer set search_path = public, extensions as $$
declare
  r ricevute;
  oggi int;
begin
  if not (e_staff() or e_amministrazione()) then raise exception 'la ricevuta la manda la segreteria' using errcode = '42501'; end if;
  select * into r from ricevute where id = controlla_invio_ricevuta.ricevuta;
  if not found then raise exception 'ricevuta inesistente' using errcode = 'P0002'; end if;
  -- Codici suoi: la Edge Function li riconosce senza leggere il testo.
  if r.annullata_il is not null then raise exception 'La ricevuta è annullata: non si manda' using errcode = '55000'; end if;
  if (select count(*) from invii_ricevute i where i.ricevuta_id = r.id and i.esito = 'mandata' and i.creato_il > now() - interval '24 hours') >= 3 then
    raise exception 'Questa ricevuta è già partita 3 volte nelle ultime 24 ore' using errcode = '54000';
  end if;
  -- Il server gira in UTC: la mezzanotte è quella di Roma, come il limite di Register.
  select count(*) into oggi from invii_ricevute
   where esito = 'mandata' and creato_il >= date_trunc('day', now() at time zone 'Europe/Rome') at time zone 'Europe/Rome';
  return jsonb_build_object(
    'numero', r.numero, 'anno', r.anno, 'data', r.data, 'totale', r.totale,
    'nome', r.intestatario->>'nome', 'cognome', r.intestatario->>'cognome',
    'ha_indirizzo', indirizzo_ricevuta(r.id) is not null,
    'mandate_oggi', oggi, 'oltre_soglia', oggi >= 400,
    -- La Edge Function dice a chi è partita solo alla segreteria: l'amministrazione i recapiti non li vede.
    'segreteria', e_staff(),
    -- Chi preme: la Edge Function lo passa a registra_invio_ricevuta, che gira come service_role e non lo sa.
    'persona', persona_corrente());
end $$;

-- La firma di prima (ricevuta, esito, motivo) era per il browser: via, se no resterebbe chiamabile accanto a questa.
drop function if exists registra_invio_ricevuta(uuid, text, text);
create or replace function registra_invio_ricevuta(ricevuta uuid, esito text, motivo text, da uuid, indirizzo citext, pdf_sha256 text) returns void
  language plpgsql security definer set search_path = public, extensions as $$
declare
  annullata timestamptz;
  a_chi text;
begin
  if esito is null or esito not in ('mandata', 'non partita') then raise exception 'Esito sconosciuto: «mandata» o «non partita»' using errcode = '22023'; end if;
  if length(motivo) > 200 then raise exception 'Il motivo è troppo lungo: al massimo 200 lettere' using errcode = '22023'; end if;
  select r.annullata_il into annullata from ricevute r where r.id = registra_invio_ricevuta.ricevuta;
  if not found then raise exception 'ricevuta inesistente' using errcode = 'P0002'; end if;
  -- Una mail partita resta scritta comunque: annullata o contatto tolto dopo il controllo non la disfano.
  if annullata is not null and esito <> 'mandata' then raise exception 'La ricevuta è annullata: non si manda' using errcode = '55000'; end if;
  a_chi := coalesce(nullif(trim(registra_invio_ricevuta.indirizzo::text), ''), indirizzo_ricevuta(registra_invio_ricevuta.ricevuta));
  if a_chi is null then raise exception 'Nessuna email di contatto in scheda: aggiungila in PERSONA.' using errcode = '22023'; end if;
  insert into invii_ricevute (ricevuta_id, indirizzo, esito, motivo, creato_da, pdf_sha256)
  values (registra_invio_ricevuta.ricevuta, a_chi, registra_invio_ricevuta.esito, nullif(trim(registra_invio_ricevuta.motivo), ''),
          registra_invio_ricevuta.da, registra_invio_ricevuta.pdf_sha256);
end $$;

create or replace function esiti_invio_ricevuta(ricevuta uuid) returns table (creato_il timestamptz, esito text)
  language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not (e_staff() or e_amministrazione()) then raise exception 'la ricevuta la manda la segreteria' using errcode = '42501'; end if;
  return query select i.creato_il, i.esito from invii_ricevute i where i.ricevuta_id = esiti_invio_ricevuta.ricevuta order by i.creato_il;
end $$;

revoke all on function indirizzo_ricevuta(uuid), controlla_invio_ricevuta(uuid), registra_invio_ricevuta(uuid, text, text, uuid, citext, text),
  esiti_invio_ricevuta(uuid) from public, anon, authenticated;
grant execute on function controlla_invio_ricevuta(uuid), esiti_invio_ricevuta(uuid) to authenticated;
-- L'indirizzo lo legge e i tentativi li scrive solo la Edge Function: la segreteria l'indirizzo lo vede già nella
-- scheda, l'amministrazione mai.
grant execute on function indirizzo_ricevuta(uuid), registra_invio_ricevuta(uuid, text, text, uuid, citext, text) to service_role;

notify pgrst, 'reload schema';
