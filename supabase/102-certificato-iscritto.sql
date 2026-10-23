-- ---------------------------------------------------------------------------
-- 102 · L'iscritto manda il suo certificato medico
--
-- Dall'area iscritti chi è in regola da sistemare (certificato mancante,
-- scaduto o in scadenza) manda una foto o un PDF del certificato, per sé o,
-- se è il titolare di un nucleo (vedi 100), per chi sta dentro senza account.
-- Il file resta «in attesa»: la scheda non cambia (data e stato restano come
-- erano) finché la segreteria non lo apre e scrive la scadenza
-- (`conferma_certificato_iscritto`, che lo fa diventare il certificato della
-- scheda) o lo rifiuta (`rifiuta_certificato_iscritto`, il file si cancella).
-- Un invio nuovo prende il posto di quello in attesa.
--
--   iscritto_manda_certificato(persona, file)   chi può vedere `persona` (101)
--   conferma_certificato_iscritto(persona, scade) / rifiuta_certificato_iscritto(persona)
--                                               solo la segreteria
--
-- Il file va in `certificati/<persona>/attesa-<n>.(pdf|jpg|jpeg|png)`: la
-- policy di insert lo permette solo a chi può vedere quella persona. L'iscritto
-- non legge né cancella niente nello Storage, e dalla scheda (`iscritto_scheda`
-- e `iscritto_nucleo`) esce solo la data di invio, mai il nome del file: un
-- dato di salute lo apre solo la segreteria.
--
-- Cambia, rifatte per intero: `iscritto_scheda_di`, `iscritto_scheda` e
-- `iscritto_nucleo` (da 101: la data di invio in più), `pulisci_certificati` e
-- `certificato_alla_disattivazione` (da 45: un file in attesa non si pulisce
-- dopo un giorno, e va via con la persona) e `unisci_persone` (da 99, avvolta:
-- il file in attesa passa a chi resta, uno solo).
--
-- Si lancia dopo `101-iscritto.sql`. Rilanciare 45, 99 o 101 riporta le loro
-- funzioni a com'erano: dopo, va rilanciato anche questo. Non chiede di
-- rilanciare `06-iscrizioni.sql`. Finché non c'è, l'area iscritti non mostra il
-- tasto e dice di portare il certificato in segreteria.
-- ---------------------------------------------------------------------------

alter table schede_iscritti add column if not exists certificato_in_attesa text, add column if not exists certificato_in_attesa_il timestamptz;
create or replace function iscritto_puo_mandare(persona uuid) returns boolean language sql stable security definer set search_path = public, extensions as $$ select iscritto_puo_vedere(persona) $$;
revoke all on function iscritto_puo_mandare(uuid) from public, anon;
grant execute on function iscritto_puo_mandare(uuid) to authenticated;
drop policy if exists certificati_iscritto_carica on storage.objects;
create policy certificati_iscritto_carica on storage.objects for insert to authenticated
  with check (bucket_id = 'certificati'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/attesa-[0-9]+\.(jpg|jpeg|png|pdf)$'
    and public.iscritto_puo_mandare(split_part(name, '/', 1)::uuid));
drop function if exists iscritto_scheda(uuid); drop function if exists iscritto_nucleo(uuid); drop function if exists iscritto_scheda_di(uuid);
create or replace function iscritto_scheda_di(persona uuid)
  returns table (id uuid, nome text, cognome text, corsi jsonb, certificato_scade date, pagamento stato_pagamento, pagato_fino date, quote jsonb, nato_il date, certificato_in_attesa_il timestamptz)
  language sql stable security definer set search_path = public, extensions as $$
  select p.id, p.nome, p.cognome,
    coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'nome', c.nome, 'colore', c.colore) order by c.nome)
                from iscrizioni i join corsi c on c.id = i.corso_id
               where i.persona_id = p.id and c.attivo and i.dal <= (now() at time zone 'Europe/Rome')::date and (i.al is null or i.al >= (now() at time zone 'Europe/Rome')::date)), '[]'::jsonb),
    s.certificato_scade, coalesce(s.pagamento, 'da_pagare'), s.pagato_fino,
    coalesce((select jsonb_agg(jsonb_build_object('anno', q.anno, 'numero', q.numero, 'dal', q.dal, 'al', q.al, 'mancano', q.mancano) order by q.anno, q.numero) from quote_ricevute q where q.persona_id = p.id), '[]'::jsonb),
    coalesce((select a.nato_il from anagrafiche a where a.persona_id = p.id), (select r.nato_il from richieste_iscrizione r where r.persona_id = p.id and r.stato = 'accolta' order by r.gestita_il desc nulls last limit 1)),
    s.certificato_in_attesa_il
  from persone p left join schede_iscritti s on s.persona_id = p.id
  where p.id = persona and p.ruolo::text = 'iscritto' and p.attiva $$;
create or replace function iscritto_scheda(persona uuid)
  returns table (id uuid, nome text, cognome text, corsi jsonb, certificato_scade date, pagamento stato_pagamento, pagato_fino date, quote jsonb, nato_il date, certificato_in_attesa_il timestamptz)
  language sql stable security definer set search_path = public, extensions as $$ select * from iscritto_scheda_di(persona) where iscritto_puo_vedere(persona) $$;
create or replace function iscritto_nucleo(persona uuid)
  returns table (id uuid, nome text, cognome text, corsi jsonb, certificato_scade date, pagamento stato_pagamento, pagato_fino date, quote jsonb, nato_il date, certificato_in_attesa_il timestamptz)
  language sql stable security definer set search_path = public, extensions as $$
  select s.* from persone p cross join lateral iscritto_scheda_di(p.id) s
   where iscritto_puo_vedere(persona) and p.ruolo::text = 'iscritto' and p.attiva and (p.id = persona or (p.nucleo = persona and p.utente_id is null))
   order by (p.id = persona) desc, p.nome, p.cognome, p.id $$;
revoke all on function iscritto_puo_vedere(uuid), iscritto_scheda_di(uuid) from public, anon, authenticated;
revoke all on function iscritto_scheda(uuid), iscritto_nucleo(uuid) from public, anon;
grant execute on function iscritto_scheda(uuid), iscritto_nucleo(uuid) to authenticated;

create or replace function iscritto_manda_certificato(persona uuid, file text) returns void language plpgsql security definer set search_path = public, extensions as $$
declare vecchio text;
begin
  if not iscritto_puo_vedere(persona) then raise exception 'Questa persona non è fra le tue' using errcode = '42501'; end if;
  -- Solo un `attesa-N`: il nome del certificato già confermato non si può mettere in attesa (e poi farlo cancellare).
  if file is null or file !~ ('^' || persona::text || '/attesa-[0-9]+\.(jpg|jpeg|png|pdf)$') then raise exception 'Il file non è di questa persona' using errcode = '22023'; end if;
  if not exists (select 1 from storage.objects where bucket_id = 'certificati' and name = file) then raise exception 'Il file non è stato caricato: riprova' using errcode = '22023'; end if;
  select certificato_in_attesa into vecchio from schede_iscritti where persona_id = persona;
  insert into schede_iscritti (persona_id, certificato_in_attesa, certificato_in_attesa_il) values (persona, file, now())
    on conflict (persona_id) do update set certificato_in_attesa = excluded.certificato_in_attesa, certificato_in_attesa_il = excluded.certificato_in_attesa_il;
  if vecchio is not null and vecchio <> file then
    perform set_config('storage.allow_delete_query', 'true', true);
    delete from storage.objects where bucket_id = 'certificati' and name = vecchio;
  end if;
end $$;
create or replace function conferma_certificato_iscritto(persona uuid, scade date) returns void language plpgsql security definer set search_path = public, extensions as $$
declare f text; n text;
begin
  if not e_staff() then raise exception 'solo la segreteria' using errcode = '42501'; end if;
  select certificato_in_attesa into f from schede_iscritti where persona_id = persona;
  if f is null then raise exception 'Non c''è un certificato da confermare' using errcode = 'P0002'; end if;
  if scade is null then raise exception 'Serve la data di scadenza del certificato' using errcode = '22023'; end if;
  if scade > ((now() at time zone 'Europe/Rome')::date + interval '3 years')::date then raise exception 'La data è troppo lontana: controlla l''anno.' using errcode = '22023'; end if;
  n := persona::text || '/certificato-' || (extract(epoch from clock_timestamp()) * 1000)::bigint || '.' || substring(f from '\.([a-z]+)$');
  update storage.objects set name = n where bucket_id = 'certificati' and name = f;
  if not found then raise exception 'Il file mandato non c''è più: chiedi di rimandarlo' using errcode = 'P0002'; end if;
  update schede_iscritti set certificato_scade = scade, certificato_file = n, certificato_caricato_il = now(), certificato_in_attesa = null, certificato_in_attesa_il = null where persona_id = persona;
  perform togli_file_certificato(persona, n);
end $$;
create or replace function rifiuta_certificato_iscritto(persona uuid) returns void language plpgsql security definer set search_path = public, extensions as $$
declare f text;
begin
  if not e_staff() then raise exception 'solo la segreteria' using errcode = '42501'; end if;
  select certificato_in_attesa into f from schede_iscritti where persona_id = persona;
  if f is null then raise exception 'Non c''è un certificato da rifiutare' using errcode = 'P0002'; end if;
  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.objects where bucket_id = 'certificati' and name = f;
  update schede_iscritti set certificato_in_attesa = null, certificato_in_attesa_il = null where persona_id = persona;
end $$;
revoke all on function iscritto_manda_certificato(uuid, text), conferma_certificato_iscritto(uuid, date), rifiuta_certificato_iscritto(uuid) from public, anon;
grant execute on function iscritto_manda_certificato(uuid, text), conferma_certificato_iscritto(uuid, date), rifiuta_certificato_iscritto(uuid) to authenticated;

-- `salva_certificato` (45) più il file in attesa tolto dalla scheda: il file se ne va con `togli_file_certificato`.
create or replace function salva_certificato(persona uuid, file text, scade date)
  returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not e_staff() then raise exception 'solo la segreteria' using errcode = '42501'; end if;
  -- La persona prima di tutto: per una che non c'è, o è disattivata, il testo è lo stesso
  -- qualunque sia il file. A una disattivata il file non si rimette (vedi più sotto).
  if not exists (select 1 from persone where id = persona and ruolo = 'iscritto' and attiva) then
    raise exception 'Persona inesistente' using errcode = 'P0002';
  end if;
  if scade is null then raise exception 'Serve la data di scadenza del certificato' using errcode = '22023'; end if;
  -- Più di tre anni avanti è quasi sempre l'anno sbagliato.
  if scade > ((now() at time zone 'Europe/Rome')::date + interval '3 years')::date then
    raise exception 'La data è troppo lontana: controlla l''anno.' using errcode = '22023';
  end if;
  if file is null or split_part(file, '/', 1) <> persona::text then
    raise exception 'Il file non è di questa persona' using errcode = '22023';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'certificati' and name = file) then
    raise exception 'Il file non è stato caricato: riprova' using errcode = '22023';
  end if;
  insert into schede_iscritti (persona_id, certificato_scade, certificato_file, certificato_caricato_il)
    values (persona, scade, file, now())
  on conflict (persona_id) do update
    set certificato_scade = excluded.certificato_scade, certificato_file = excluded.certificato_file, certificato_caricato_il = excluded.certificato_caricato_il;
  perform togli_file_certificato(persona, file);
  -- Il file mandato dall'iscritto se n'è andato con gli altri: la scadenza che scrive la segreteria lo sostituisce.
  update schede_iscritti set certificato_in_attesa = null, certificato_in_attesa_il = null where persona_id = persona;
end $$;

create or replace function certificato_alla_disattivazione() returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  perform togli_file_certificato(new.id);
  update schede_iscritti set certificato_file = null, certificato_in_attesa = null, certificato_in_attesa_il = null where persona_id = new.id and (certificato_file is not null or certificato_in_attesa is not null);
  return new;
end $$;

create or replace function pulisci_certificati() returns int language plpgsql security definer set search_path = public, extensions as $$
declare n int := 0; s record;
begin
  for s in select persona_id from schede_iscritti where certificato_file is not null and certificato_scade <= (now() at time zone 'Europe/Rome')::date - 30 loop
    begin
      perform togli_file_certificato(s.persona_id, (select certificato_in_attesa from schede_iscritti where persona_id = s.persona_id));
      update schede_iscritti set certificato_file = null where persona_id = s.persona_id; n := n + 1;
    exception when others then raise notice 'certificato di % non tolto: %', s.persona_id, sqlerrm; end;
  end loop;
  for s in select o.name from storage.objects o where o.bucket_id = 'certificati' and o.created_at < now() - interval '1 day'
      and not exists (select 1 from schede_iscritti c where c.certificato_file = o.name or c.certificato_in_attesa = o.name) loop
    begin
      perform set_config('storage.allow_delete_query', 'true', true);
      delete from storage.objects where bucket_id = 'certificati' and name = s.name; n := n + 1;
    exception when others then raise notice 'file % non tolto: %', s.name, sqlerrm; end;
  end loop;
  return n;
end $$;

-- Avvolge `unisci_persone` senza rifarla: se è ancora quella di 99 (o è tornata
-- dopo un rilancio) diventa `unisci_persone_0`, e quella qui sotto la chiama.
do $$ begin
  if not exists (select 1 from pg_proc where proname = 'unisci_persone' and pronamespace = 'public'::regnamespace and prosrc like '%unisci_persone_0%') then
    drop function if exists unisci_persone_0(uuid, uuid);
    alter function unisci_persone(uuid, uuid) rename to unisci_persone_0;
  end if;
end $$;
create or replace function unisci_persone(resta uuid, via uuid) returns void language plpgsql security definer set search_path = public, extensions as $$
declare rf text; ri timestamptz; vf text; vi timestamptz; vince text; vinci timestamptz; perde text; nuovo text;
begin
  if not e_staff() then raise exception 'Non hai il permesso: serve un accesso da segreteria' using errcode = '42501'; end if;
  select certificato_in_attesa, certificato_in_attesa_il into rf, ri from schede_iscritti where persona_id = resta;
  select certificato_in_attesa, certificato_in_attesa_il into vf, vi from schede_iscritti where persona_id = via;
  if vf is not null and (rf is null or vi > ri) then vince := vf; vinci := vi; perde := rf; else vince := rf; vinci := ri; perde := vf; end if;
  if vince is not null then
    nuovo := 'tmp/' || gen_random_uuid()::text; update storage.objects set name = nuovo where bucket_id = 'certificati' and name = vince;
  end if;
  update schede_iscritti set certificato_in_attesa = null, certificato_in_attesa_il = null where persona_id in (resta, via);
  perform unisci_persone_0(resta, via);
  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.objects where bucket_id = 'certificati' and name = perde;
  if vince is not null then
    vince := resta::text || '/attesa-' || (extract(epoch from clock_timestamp()) * 1000)::bigint || '.' || substring(vince from '\.([a-z]+)$');
    update storage.objects set name = vince where bucket_id = 'certificati' and name = nuovo;
    insert into schede_iscritti (persona_id, certificato_in_attesa, certificato_in_attesa_il) values (resta, vince, vinci)
      on conflict (persona_id) do update set certificato_in_attesa = excluded.certificato_in_attesa, certificato_in_attesa_il = excluded.certificato_in_attesa_il;
  end if;
end $$;
revoke all on function unisci_persone_0(uuid, uuid) from public, anon, authenticated;
revoke all on function unisci_persone(uuid, uuid) from public, anon;
grant execute on function unisci_persone(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
