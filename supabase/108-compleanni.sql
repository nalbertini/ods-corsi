-- ---------------------------------------------------------------------------
-- Chi compie gli anni il giorno di una lezione.
--
-- Due letture che restituiscono SOLO l'id della persona: la data di nascita e
-- l'età non escono mai, perché il tablet è pubblico e l'avviso è solo un
-- avviso (vedi la prova supabase/prova/108-compleanni.sql).
--   · compleanni_sala(sessione)     il tablet, nella finestra di `elenco_sala`,
--                                   e solo se la sua postazione ha `compleanni`
--                                   acceso (di default spento: lo accende la
--                                   segreteria, per i minorenni in sala);
--   · compleanni_lezione(sessione)  chi lavora in palestra: l'istruttore per le
--                                   lezioni che fa o insegna, la segreteria per
--                                   tutte.
-- La data viene da `chat_nato_il` (75-chat-segreteria.sql). Giorno e mese sono
-- quelli di Roma di oggi (anche per una lezione di ieri, rimasta nel tablet per il
-- recupero); chi è nato il 29 febbraio festeggia il 1° marzo negli anni
-- non bisestili, come `chat_eta`. Contano le persone attive con l'iscrizione
-- valida il giorno della lezione, come in `elenco_sala`; la quota non c'entra.
--
-- Si lancia dopo 04-tablet.sql e 75-chat-segreteria.sql. Rilanciarlo non perde
-- niente.
-- ---------------------------------------------------------------------------
alter table postazioni add column if not exists compleanni boolean not null default false;

create or replace function compleanni_del_corso(corso uuid, inizio timestamptz)
  returns table (persona_id uuid)
  language sql stable security definer set search_path = public, extensions as $$
  select pe.id
  from iscrizioni i join persone pe on pe.id = i.persona_id
  cross join lateral (select (inizio at time zone 'Europe/Rome')::date as giorno,
    (now() at time zone 'Europe/Rome')::date as oggi) g
  cross join lateral (select chat_nato_il(pe.id) as nato) n
  where i.corso_id = corso and pe.attiva and n.nato is not null
    and i.dal <= g.giorno and (i.al is null or i.al >= g.giorno)
    and to_char(g.oggi, 'MMDD') = case
      when to_char(n.nato, 'MMDD') = '0229' and not (extract(year from g.oggi)::int % 4 = 0
        and (extract(year from g.oggi)::int % 100 <> 0 or extract(year from g.oggi)::int % 400 = 0))
      then '0301' else to_char(n.nato, 'MMDD') end
$$;

create or replace function compleanni_sala(sessione uuid)
  returns table (persona_id uuid)
  language plpgsql stable security definer set search_path = public, extensions as $$
declare
  l record;
  r record;
begin
  select * into r from tablet_regole();
  select * into l from lezione_del_tablet(sessione);
  if l.inizio < now() - r.recupero or l.inizio > now() + r.prima then
    raise exception 'lezione fuori dalla finestra del tablet' using errcode = '42501';
  end if;
  if not (select p.compleanni from postazioni p where p.id = l.postazione) then return; end if;
  return query select c.persona_id from compleanni_del_corso(l.corso, l.inizio) c;
end $$;

create or replace function compleanni_lezione(sessione uuid)
  returns table (persona_id uuid)
  language plpgsql stable security definer set search_path = public, extensions as $$
declare
  s record;
begin
  select * into s from sessioni where id = sessione;
  if s.id is null then raise exception 'lezione inesistente' using errcode = 'P0002'; end if;
  -- coalesce: `istruttore_id` può essere nullo, e `not null` non fa scattare l'if.
  if not coalesce(e_staff() or (e_personale() and (s.istruttore_id = persona_corrente() or insegna(s.corso_id))), false) then
    raise exception 'solo per chi fa questa lezione' using errcode = '42501';
  end if;
  return query select c.persona_id from compleanni_del_corso(s.corso_id, s.inizio) c;
end $$;

revoke all on function compleanni_del_corso(uuid, timestamptz) from public, anon, authenticated;
revoke all on function compleanni_sala(uuid), compleanni_lezione(uuid) from public, anon;
grant execute on function compleanni_sala(uuid), compleanni_lezione(uuid) to authenticated;

notify pgrst, 'reload schema';
