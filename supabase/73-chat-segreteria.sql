-- La segreteria dalla chat: chi ha la segreteria chiede a Claude certificati, quote, iscritti e presenze, e il server
-- MCP (supabase/functions/mcp) li legge col token di quella persona. Qui le sole letture che il server usa, e il taglio
-- dei minori: un filtro solo nel server sarebbe l'unica barriera fra i nomi dei minori e Claude.
--
--   · `chat_iscritti(sale)`: gli iscritti attivi, con certificato, quota, quote delle ricevute (senza anno né numero) e
--     corsi in corso oggi. Nome e cognome solo degli adulti; mai la data di nascita: dei minori che non hanno ancora
--     6 anni solo il giorno in cui li compiono (la regola del certificato); mai telefono, email, nota del pagamento,
--     file o documento.
--   · `chat_registro(dal, al, sale)`: una riga per lezione e iscritto attivo con l'iscrizione valida quel giorno, con la sua
--     presenza; una lezione senza iscritti dà una riga senza chiave, per contarla. Giorni di Roma, mai dopo adesso, al
--     più un anno alla volta. Come il registro di PRESENZE: chi è iscritto al corso, qualunque ruolo abbia.
--   · `chat_prove(dal, al)`: quante prove per lezione, mai chi.
--
-- Chi non è adulto ha una chiave che vale per una sola domanda: `md5` dell'id col «sale» che il server sceglie a caso
-- ogni volta. Si raggruppa senza sapere chi è, e la chiave resta la stessa fra le pagine di una risposta (il server
-- legge a pagine, una transazione ciascuna). L'età è quella di oggi a Roma: chi compie 18 anni oggi ha il nome anche nelle presenze di prima. Chi non
-- ha la data di nascita conta come un minore (principio 4 di PRODUCT.md: prima la privacy dei minori).
--
-- La data di nascita è quella di `nascitaDelleFonti` (src/lib/segreteria.ts): fra la scheda (`anagrafiche`) e la
-- richiesta accolta vince la più recente, a parità la scheda; se la più recente non ce l'ha, non c'è. L'età è quella
-- di `etaDi` (src/lib/chatSegreteria.ts). Le prove: supabase/prova/73-chat-segreteria.sql e scripts/prova-mcp.mjs.
--
-- Chi può: solo `e_staff()`; gli altri ricevono «Questa parte è per la segreteria» (42501). Nessuna scrittura.
--
-- Si lancia dopo `27-pagamento-dalle-ricevute.sql` (`quote_ricevute`). Non tocca niente di prima: rilanciarlo non perde
-- niente (`chat_iscritti` si butta giù e si rifà, perché le sue colonne sono cambiate da com'era scritta prima). Finché non c'è, la chat della segreteria dice che il database non è ancora aggiornato; il resto non cambia.
-- ---------------------------------------------------------------------------

create or replace function chat_nato_il(p uuid) returns date
  language sql stable security definer set search_path = public, extensions as $$
  select f.nato from (
    select a.nato_il as nato, a.cambiata_il as quando, 1 as scheda from anagrafiche a where a.persona_id = p
    union all
    select r.nato_il, coalesce(r.gestita_il, r.creata_il), 0 from richieste_iscrizione r where r.persona_id = p and r.stato = 'accolta'
  ) f
  order by f.quando desc, f.scheda desc
  limit 1
$$;

-- Gli anni compiuti col giorno e il mese: chi è nato il 29 febbraio li compie il 1° marzo negli anni non bisestili.
create or replace function chat_eta(nato date, oggi date) returns text
  language sql stable set search_path = public, extensions as $$
  select case
    when nato is null then 'non_si_sa'
    when extract(year from oggi) - extract(year from nato) - (case when to_char(oggi, 'MMDD') < to_char(nato, 'MMDD') then 1 else 0 end) >= 18 then 'adulto'
    else 'minore'
  end
$$;

-- Il giorno dei 6 anni, da quando il certificato serve: come `dalCertificato` (src/lib/segreteria.ts), chi è nato il
-- 29 febbraio li compie il 1° marzo.
create or replace function chat_sei_anni(nato date) returns date
  language sql stable set search_path = public, extensions as $$
  select case when to_char(nato, 'MMDD') = '0229' then make_date(extract(year from nato)::int + 6, 3, 1)
              else (nato + interval '6 years')::date end
$$;

-- Il «sale» della domanda: senza, la chiave di un minore sarebbe l'md5 del suo id, uguale in ogni domanda.
create or replace function chat_sale(sale text) returns text
  language plpgsql immutable set search_path = public, extensions as $$
begin
  if coalesce(sale, '') = '' then raise exception 'Manca il sale della domanda' using errcode = '22023'; end if;
  return sale;
end $$;

drop function if exists chat_iscritti(text);
create or replace function chat_iscritti(sale text)
  returns table (chiave text, nome text, cognome text, eta text, sei_anni date, certificato_scade date, pagamento text, pagato_fino date, quote jsonb, corsi uuid[])
  language plpgsql stable security definer set search_path = public, extensions as $$
declare
  oggi date := (now() at time zone 'Europe/Rome')::date;
begin
  if not e_staff() then raise exception 'Questa parte è per la segreteria' using errcode = '42501'; end if;
  perform chat_sale(sale);
  return query
    select case when e.eta = 'adulto' then p.id::text else 'x' || md5(p.id::text || sale) end,
           case when e.eta = 'adulto' then p.nome end,
           case when e.eta = 'adulto' then p.cognome end,
           e.eta,
           case when e.eta = 'minore' and chat_sei_anni(e.nato) > oggi then chat_sei_anni(e.nato) end,
           s.certificato_scade,
           coalesce(s.pagamento::text, 'da_pagare'),
           s.pagato_fino,
           coalesce((select jsonb_agg(jsonb_build_object('dal', q.dal, 'al', q.al, 'mancano', q.mancano) order by q.anno, q.numero, q.dal, q.al, q.mancano) from quote_ricevute q where q.persona_id = p.id), '[]'::jsonb),
           coalesce((select array_agg(i.corso_id) from iscrizioni i where i.persona_id = p.id and i.dal <= oggi and (i.al is null or i.al >= oggi)), '{}'::uuid[])
      from persone p
      cross join lateral (select chat_nato_il(p.id) as nato) n
      cross join lateral (select n.nato, chat_eta(n.nato, oggi) as eta) e
      left join schede_iscritti s on s.persona_id = p.id
     where p.ruolo = 'iscritto' and p.attiva;
end $$;

create or replace function chat_registro(dal date, al date, sale text)
  returns table (sessione_id uuid, corso_id uuid, corso text, inizio timestamptz, stato text, chiave text, nome text, cognome text, eta text, presenza text)
  language plpgsql stable security definer set search_path = public, extensions as $$
declare
  oggi date := (now() at time zone 'Europe/Rome')::date;
begin
  if not e_staff() then raise exception 'Questa parte è per la segreteria' using errcode = '42501'; end if;
  perform chat_sale(sale);
  if al - dal > 366 then raise exception 'Al massimo un anno alla volta' using errcode = '22023'; end if;
  return query
    select s.id, s.corso_id, c.nome, s.inizio, s.stato::text,
           case when x.pid is null then null when e.eta = 'adulto' then x.pid::text else 'x' || md5(x.pid::text || sale) end,
           case when e.eta = 'adulto' then x.nome end,
           case when e.eta = 'adulto' then x.cognome end,
           e.eta,
           pr.stato::text
      from sessioni s
      join corsi c on c.id = s.corso_id
      left join lateral (
        select p.id as pid, p.nome, p.cognome
          from iscrizioni i join persone p on p.id = i.persona_id
         where i.corso_id = s.corso_id and p.attiva
           and i.dal <= (s.inizio at time zone 'Europe/Rome')::date
           and (i.al is null or i.al >= (s.inizio at time zone 'Europe/Rome')::date)
      ) x on true
      left join lateral (select case when x.pid is null then null else chat_eta(chat_nato_il(x.pid), oggi) end as eta) e on true
      left join presenze pr on pr.sessione_id = s.id and pr.persona_id = x.pid
     where (s.inizio at time zone 'Europe/Rome')::date between dal and al
       and s.inizio <= now();
end $$;

create or replace function chat_prove(dal date, al date)
  returns table (sessione_id uuid, corso_id uuid, inizio timestamptz, prove int)
  language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not e_staff() then raise exception 'Questa parte è per la segreteria' using errcode = '42501'; end if;
  return query
    select s.id, s.corso_id, s.inizio, count(*)::int
      from prove v join sessioni s on s.id = v.sessione_id
     where (s.inizio at time zone 'Europe/Rome')::date between dal and al
       and s.inizio <= now()
     group by s.id;
end $$;

revoke all on function chat_nato_il(uuid), chat_eta(date, date), chat_sei_anni(date), chat_sale(text) from public, anon, authenticated;
revoke all on function chat_iscritti(text), chat_registro(date, date, text), chat_prove(date, date) from public, anon;
grant execute on function chat_iscritti(text), chat_registro(date, date, text), chat_prove(date, date) to authenticated;

notify pgrst, 'reload schema';
