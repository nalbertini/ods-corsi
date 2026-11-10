-- ---------------------------------------------------------------------------
-- 141 · Il certificato portato dopo
--
-- Chi si iscrive dice «non ce l'ho ancora» e si iscrive lo stesso: ha un
-- termine per portarlo. Il termine di una persona è il più lontano fra:
--   · quello scritto in `schede_iscritti.certificato_entro`: all'accoglimento
--     di una richiesta con `certificato_dopo` (oggi + `certificato_giorni`), o
--     spostato dalla segreteria («Cambia la data»);
--   · `certificato_scade` + giorni (il rinnovo, calcolato: segue i giorni di oggi);
--   · il 6° compleanno + giorni, se lo compie da iscritto (dopo `creata_il`).
-- Nel termine il certificato non vale (né in sala né per le gare): l'app lo
-- dice giallo. Dopo, rosso. La presenza si segna sempre.
-- Il termine scritto si azzera quando la scheda prende un certificato valido
-- (conferma, `salva_certificato`, la data scritta a mano), non al rifiuto.
--
--   impostazioni.certificato_giorni          la segreteria (1–120, di default 30)
--   iscrizioni_regole()                       anche anon: i giorni per il modulo
--   cambia_termine_certificato(persona, entro)  solo la segreteria
--   certificati_con_pin(pin, sessione)        il tablet, col PIN dell'istruttore:
--                                             solo gli id di chi ha passato il
--                                             termine, mai date né file
--   iscritto_scheda / iscritto_nucleo         in più `certificato_entro`
--
-- Cambia, rifatte per intero: `iscrizioni_regole` (da 49: da `immutable` a
-- `stable security definer`, coi giorni) e `iscritto_scheda_di`,
-- `iscritto_scheda`, `iscritto_nucleo` (da 102). `invia_iscrizione` è avvolta:
-- la sua ultima versione diventa `invia_iscrizione_0`.
--
-- Si lancia dopo `102-certificato-iscritto.sql` e `125-satispay-chiave.sql`.
-- Rilanciare 06, 49, 102 o un file che rifà `invia_iscrizione` (125) riporta
-- quelle funzioni a com'erano: dopo, va rilanciato anche questo
-- (`controllo.sql` lo dice). Non chiede di rilanciare `06-iscrizioni.sql`.
-- Finché non c'è, il modulo non chiede «ce l'hai già?» e il certificato resta
-- facoltativo, senza termine, come prima.
-- ---------------------------------------------------------------------------

alter table impostazioni add column if not exists certificato_giorni int not null default 30;
alter table impostazioni drop constraint if exists certificato_giorni_va;
alter table impostazioni add constraint certificato_giorni_va check (certificato_giorni between 1 and 120);

alter table richieste_iscrizione add column if not exists certificato_dopo boolean not null default false;

alter table schede_iscritti
  add column if not exists certificato_entro date,
  add column if not exists certificato_entro_da uuid references persone on delete set null,
  add column if not exists certificato_entro_il timestamptz;

-- --- il termine ---------------------------------------------------------------
create or replace function certificato_termine(persona uuid)
  returns date language sql stable security definer set search_path = public, extensions as $$
  select greatest(
    s.certificato_entro,
    s.certificato_scade + g.giorni,
    -- Il compleanno conta solo se arriva da iscritto: un adulto non ha un termine di trent'anni fa.
    case when chat_sei_anni(n.nato) > (p.creata_il at time zone 'Europe/Rome')::date then chat_sei_anni(n.nato) + g.giorni end)
  from persone p
  left join schede_iscritti s on s.persona_id = p.id
  cross join lateral (select coalesce((select i.certificato_giorni from impostazioni i limit 1), 30) as giorni) g
  cross join lateral (select chat_nato_il(p.id) as nato) n
  where p.id = persona
$$;

-- Serve (età sconosciuta, o 6 anni compiuti), non è valido, e il termine è passato o non c'è: «certificato non arrivato».
create or replace function certificato_non_arrivato(persona uuid)
  returns boolean language sql stable security definer set search_path = public, extensions as $$
  select coalesce(n.nato is null or chat_sei_anni(n.nato) <= o.oggi, true)
     and (s.certificato_scade is null or s.certificato_scade < o.oggi)
     and (t.entro is null or o.oggi > t.entro)
  from (select (now() at time zone 'Europe/Rome')::date as oggi) o
  cross join lateral (select chat_nato_il(persona) as nato) n
  cross join lateral (select certificato_termine(persona) as entro) t
  left join schede_iscritti s on s.persona_id = persona
$$;

-- --- chi scrive il termine --------------------------------------------------------
-- Il termine scritto porta con sé chi l'ha spostato e quando, scritti dal server; all'accoglimento nessuno
-- (lo dice `ods.entro_accoglimento`). Un certificato valido lo azzera.
create or replace function scheda_termine() returns trigger language plpgsql set search_path = public as $$
declare oggi date := (now() at time zone 'Europe/Rome')::date;
begin
  if new.certificato_scade >= oggi and (tg_op = 'INSERT' or new.certificato_scade is distinct from old.certificato_scade) then
    new.certificato_entro := null;
  end if;
  if new.certificato_entro is null then
    new.certificato_entro_da := null; new.certificato_entro_il := null;
  elsif tg_op = 'INSERT' or new.certificato_entro is distinct from old.certificato_entro then
    if coalesce(current_setting('ods.entro_accoglimento', true), '') = 'si' then
      new.certificato_entro_da := null; new.certificato_entro_il := null;
    else
      new.certificato_entro_da := persona_corrente(); new.certificato_entro_il := now();
    end if;
  else
    -- Il resto della scheda cambia: la traccia resta quella che era.
    new.certificato_entro_da := old.certificato_entro_da; new.certificato_entro_il := old.certificato_entro_il;
  end if;
  return new;
end $$;
drop trigger if exists schede_termine on schede_iscritti;
create trigger schede_termine before insert or update on schede_iscritti
  for each row execute function scheda_termine();

-- All'accoglimento di una richiesta «non ce l'ho ancora»: il termine, se il certificato serve e non c'è.
create or replace function richiesta_accolta_termine() returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  oggi date := (now() at time zone 'Europe/Rome')::date;
  entro date := oggi + coalesce((select i.certificato_giorni from impostazioni i limit 1), 30);
begin
  if new.persona_id is null or new.nato_il is null or chat_sei_anni(new.nato_il) > oggi then return new; end if;
  if exists (select 1 from schede_iscritti where persona_id = new.persona_id and certificato_scade >= oggi) then return new; end if;
  perform set_config('ods.entro_accoglimento', 'si', true);
  insert into schede_iscritti (persona_id, certificato_entro) values (new.persona_id, entro)
    on conflict (persona_id) do update set certificato_entro = greatest(schede_iscritti.certificato_entro, excluded.certificato_entro);
  perform set_config('ods.entro_accoglimento', '', true);
  return new;
end $$;
drop trigger if exists richieste_accolta_termine on richieste_iscrizione;
create trigger richieste_accolta_termine after update of stato on richieste_iscrizione
  for each row when (new.stato = 'accolta' and old.stato is distinct from 'accolta' and new.certificato_dopo)
  execute function richiesta_accolta_termine();

-- «Cambia la data» / «Dai una data»: il termine di una persona sola.
create or replace function cambia_termine_certificato(persona uuid, entro date)
  returns void language plpgsql security definer set search_path = public, extensions as $$
declare oggi date := (now() at time zone 'Europe/Rome')::date;
begin
  if not e_staff() then raise exception 'solo la segreteria' using errcode = '42501'; end if;
  if not exists (select 1 from persone where id = persona and ruolo = 'iscritto' and attiva) then
    raise exception 'Persona inesistente' using errcode = 'P0002';
  end if;
  if entro is null or entro < oggi or entro > oggi + 120 then
    raise exception 'La data va da oggi a 120 giorni da oggi.' using errcode = '22023';
  end if;
  insert into schede_iscritti (persona_id, certificato_entro) values (persona, entro)
    on conflict (persona_id) do update set certificato_entro = excluded.certificato_entro;
end $$;

-- --- il modulo ----------------------------------------------------------------------
-- I giorni arrivano al modulo pubblico da qui: anon non legge `impostazioni`, e da qui esce solo il numero.
create or replace function iscrizioni_regole() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'per_email_al_giorno', 6,    -- una famiglia di sei persone le manda tutte
    'in_tutto_all_ora', 60,      -- il doppio di quante se ne sono mai viste a settembre
    'minuti_per_i_file', 60,     -- dopo aver mandato le risposte, per caricare i file
    'file_per_richiesta', 5,     -- modulo, documento fronte e retro, certificato, ricevuta
    'certificato_giorni', coalesce((select i.certificato_giorni from impostazioni i limit 1), 30)
  )
$$;
revoke all on function iscrizioni_regole() from public;
grant execute on function iscrizioni_regole() to anon, authenticated;

-- Avvolge `invia_iscrizione` senza rifarla: se è ancora una di prima (o è tornata
-- dopo un rilancio) diventa `invia_iscrizione_0`, e quella qui sotto la chiama.
do $$ begin
  if not exists (select 1 from pg_proc where proname = 'invia_iscrizione' and pronamespace = 'public'::regnamespace and prosrc like '%invia_iscrizione_0%') then
    drop function if exists invia_iscrizione_0(jsonb);
    alter function invia_iscrizione(jsonb) rename to invia_iscrizione_0;
  end if;
end $$;
create or replace function invia_iscrizione(dati jsonb) returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare nuova uuid;
begin
  nuova := invia_iscrizione_0(dati);
  if dati->>'certificato_dopo' = 'true' then
    update richieste_iscrizione set certificato_dopo = true where id = nuova;
  end if;
  return nuova;
end $$;
revoke all on function invia_iscrizione_0(jsonb) from public, anon, authenticated;
revoke all on function invia_iscrizione(jsonb) from public;
grant execute on function invia_iscrizione(jsonb) to anon, authenticated;

-- --- l'area iscritti: quelle di 102, col termine in fondo ---------------------------------
drop function if exists iscritto_scheda(uuid); drop function if exists iscritto_nucleo(uuid); drop function if exists iscritto_scheda_di(uuid);
create or replace function iscritto_scheda_di(persona uuid)
  returns table (id uuid, nome text, cognome text, corsi jsonb, certificato_scade date, pagamento stato_pagamento, pagato_fino date, quote jsonb, nato_il date, certificato_in_attesa_il timestamptz, certificato_entro date)
  language sql stable security definer set search_path = public, extensions as $$
  select p.id, p.nome, p.cognome,
    coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'nome', c.nome, 'colore', c.colore) order by c.nome)
                from iscrizioni i join corsi c on c.id = i.corso_id
               where i.persona_id = p.id and c.attivo and i.dal <= (now() at time zone 'Europe/Rome')::date and (i.al is null or i.al >= (now() at time zone 'Europe/Rome')::date)), '[]'::jsonb),
    s.certificato_scade, coalesce(s.pagamento, 'da_pagare'), s.pagato_fino,
    coalesce((select jsonb_agg(jsonb_build_object('anno', q.anno, 'numero', q.numero, 'dal', q.dal, 'al', q.al, 'mancano', q.mancano) order by q.anno, q.numero) from quote_ricevute q where q.persona_id = p.id), '[]'::jsonb),
    coalesce((select a.nato_il from anagrafiche a where a.persona_id = p.id), (select r.nato_il from richieste_iscrizione r where r.persona_id = p.id and r.stato = 'accolta' order by r.gestita_il desc nulls last limit 1)),
    s.certificato_in_attesa_il,
    certificato_termine(p.id)
  from persone p left join schede_iscritti s on s.persona_id = p.id
  where p.id = persona and p.ruolo::text = 'iscritto' and p.attiva $$;
create or replace function iscritto_scheda(persona uuid)
  returns table (id uuid, nome text, cognome text, corsi jsonb, certificato_scade date, pagamento stato_pagamento, pagato_fino date, quote jsonb, nato_il date, certificato_in_attesa_il timestamptz, certificato_entro date)
  language sql stable security definer set search_path = public, extensions as $$ select * from iscritto_scheda_di(persona) where iscritto_puo_vedere(persona) $$;
create or replace function iscritto_nucleo(persona uuid)
  returns table (id uuid, nome text, cognome text, corsi jsonb, certificato_scade date, pagamento stato_pagamento, pagato_fino date, quote jsonb, nato_il date, certificato_in_attesa_il timestamptz, certificato_entro date)
  language sql stable security definer set search_path = public, extensions as $$
  select s.* from persone p cross join lateral iscritto_scheda_di(p.id) s
   where iscritto_puo_vedere(persona) and p.ruolo::text = 'iscritto' and p.attiva and (p.id = persona or (p.nucleo = persona and p.utente_id is null))
   order by (p.id = persona) desc, p.nome, p.cognome, p.id $$;

-- --- il tablet dell'istruttore ----------------------------------------------------------
-- Come `appello_con_pin` (04): un PIN sbagliato non solleva, dà niente.
create or replace function certificati_con_pin(pin text, sessione uuid)
  returns table (persona_id uuid) language plpgsql security definer set search_path = public, extensions as $$
declare
  l record;
begin
  select * into l from lezione_del_tablet(sessione);
  if persona_da_pin(pin) is null then return; end if;
  return query
    select pe.id from iscrizioni i join persone pe on pe.id = i.persona_id
    where i.corso_id = l.corso and pe.attiva
      and i.dal <= (l.inizio at time zone 'Europe/Rome')::date
      and (i.al is null or i.al >= (l.inizio at time zone 'Europe/Rome')::date)
      and certificato_non_arrivato(pe.id);
end $$;

revoke all on function certificato_termine(uuid), certificato_non_arrivato(uuid), scheda_termine(), richiesta_accolta_termine() from public, anon, authenticated;
revoke all on function iscritto_puo_vedere(uuid), iscritto_scheda_di(uuid) from public, anon, authenticated;
revoke all on function iscritto_scheda(uuid), iscritto_nucleo(uuid), cambia_termine_certificato(uuid, date), certificati_con_pin(text, uuid) from public, anon;
grant execute on function iscritto_scheda(uuid), iscritto_nucleo(uuid), cambia_termine_certificato(uuid, date), certificati_con_pin(text, uuid) to authenticated;

notify pgrst, 'reload schema';
