-- ---------------------------------------------------------------------------
-- ODS Corsi · i solleciti su WhatsApp
--
-- Dalla scheda di una persona la segreteria apre WhatsApp col sollecito già
-- scritto (quota, certificato: src/lib/sollecito.ts). L'app non manda niente:
-- qui si tiene solo che il tasto è stato premuto, quando e da chi, perché la
-- collega non mandi lo stesso messaggio due volte. Se poi il messaggio sia
-- partito davvero, il database non lo sa.
--
--   · `solleciti`: una riga per tasto premuto, mai cambiata. Solo i
--     riferimenti (persona, quando, chi): mai il testo, che passa da WhatsApp.
--     Nessuno la legge o la scrive da fuori: si passa dalle due funzioni.
--   · `segna_sollecito(persona)`: solo la segreteria (`e_staff()`), su una
--     persona attiva. Chi preme è la persona di chi è collegato
--     (`persona_corrente()`), non un argomento. Rende il momento.
--   · `ultimo_sollecito(persona)`: solo la segreteria. L'ultimo, con il nome
--     e cognome di chi l'ha segnato (vuoto se quella scheda non c'è più).
-- Amministrazione senza segreteria, istruttori, tablet, iscritti e `anon` no:
-- non vedono i contatti, quindi nemmeno i solleciti.
--
-- Le stesse regole della modalità prova (src/lib/segreteriaProva.ts), provate
-- da supabase/prova/solleciti.sql e da scripts/prova-sollecito.mjs.
--
-- Si lancia dopo `02-policy.sql`. Non chiede di rilanciare `06-iscrizioni.sql`
-- e non tocca nessuna funzione di prima. Finché non c'è, il sollecito nella
-- scheda c'è lo stesso, senza la riga «Sollecitato il … da …».
-- ---------------------------------------------------------------------------

create table if not exists solleciti (
  id         uuid primary key default gen_random_uuid(),
  -- La scheda si disattiva, non si cancella; se si unisce a un doppione, i suoi solleciti se ne vanno con lei.
  persona_id uuid not null references persone on delete cascade,
  creato_il  timestamptz not null default now(),
  creato_da  uuid references persone on delete set null
);
create index if not exists solleciti_persona on solleciti (persona_id, creato_il desc);

alter table solleciti enable row level security;
revoke all on solleciti from public, anon, authenticated, service_role;

create or replace function segna_sollecito(persona uuid) returns timestamptz
  language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  quando timestamptz;
begin
  if not e_staff() then raise exception 'i solleciti li segna la segreteria' using errcode = '42501'; end if;
  if not exists (select 1 from persone where id = segna_sollecito.persona and attiva) then
    raise exception 'la scheda non c''è o è disattivata' using errcode = 'P0002';
  end if;
  insert into solleciti (persona_id, creato_da) values (segna_sollecito.persona, persona_corrente())
    returning creato_il into quando;
  return quando;
end $$;

create or replace function ultimo_sollecito(persona uuid) returns table (creato_il timestamptz, da text)
  language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not e_staff() then raise exception 'i solleciti li vede la segreteria' using errcode = '42501'; end if;
  return query
    select s.creato_il, coalesce(trim(p.nome || ' ' || p.cognome), '')
      from solleciti s left join persone p on p.id = s.creato_da
     where s.persona_id = ultimo_sollecito.persona
     order by s.creato_il desc
     limit 1;
end $$;

revoke all on function segna_sollecito(uuid) from public, anon;
revoke all on function ultimo_sollecito(uuid) from public, anon;
grant execute on function segna_sollecito(uuid) to authenticated;
grant execute on function ultimo_sollecito(uuid) to authenticated;

notify pgrst, 'reload schema';
