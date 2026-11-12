-- ---------------------------------------------------------------------------
-- ODS Corsi · Il doppio turno
--
-- Un corso può avere due (o più) lezioni lo stesso giorno di Roma. Chi è presente a un turno non si segna
-- negli altri, né presente né assente: non è nel loro appello e non pesa nei loro conti. Un ASSENTE o un
-- GIUSTIFICATO messo prima resta salvato e si ignora: se la presenza viene tolta, o quel turno è annullato,
-- la persona torna com'era. Una lezione annullata non è un turno.
--
-- `presente_altrove(sessione, persona)` dice la regola, una volta sola; la usano, rifatte qui: l'elenco del
-- tablet di sala (`elenco_sala`, `lezioni_sala`), il tocco sul nome (`segna_dal_tablet` risponde
-- 'altro_turno' e non scrive), l'area istruttore col PIN (`appello_con_pin`, `segna_con_pin` non scrive),
-- le statistiche (`statistiche`) e le lezioni dell'iscritto (`iscritto_presenze`). In `frequenze` il giorno
-- vale una lezione sola: presente a un turno vale presente.
--
-- Chi può: nessuno chiama `presente_altrove` da fuori; le altre restano come erano. Si lancia dopo
-- `04-tablet.sql`, `05-segreteria.sql`, `22-statistiche.sql` e `101-iscritto.sql` e si può rilanciare; se si
-- rilancia uno di quelli dopo, va rilanciato anche questo (`controllo.sql` lo dice). Non chiede di rilanciare
-- `06-iscrizioni.sql`. Finché non c'è, il tablet e i conti del database fanno come prima: chi è presente a un
-- turno resta fra i da segnare dell'altro; l'app (appello, settimana, registro) applica già la regola da sé.
-- La stessa regola, per l'app e la modalità prova, è in src/lib/turni.ts.
-- ---------------------------------------------------------------------------

create or replace function presente_altrove(sessione uuid, persona uuid) returns boolean
  language sql stable security invoker set search_path = public, extensions as $$
  select exists (
      select 1
        from sessioni s
        join sessioni a on a.corso_id = s.corso_id and a.id <> s.id and a.stato <> 'annullata'
         and (a.inizio at time zone 'Europe/Rome')::date = (s.inizio at time zone 'Europe/Rome')::date
        join presenze pr on pr.sessione_id = a.id and pr.persona_id = persona and pr.stato = 'presente'
       where s.id = sessione)
    and not exists (select 1 from presenze q where q.sessione_id = sessione and q.persona_id = persona and q.stato = 'presente')
$$;
-- Si chiama solo da dentro le funzioni qui sotto (security definer).
revoke all on function presente_altrove(uuid, uuid) from public, anon, authenticated;

create or replace function lezioni_sala(da_giorno date, a_giorno date)
  returns table (id uuid, corso_id uuid, corso text, colore text, descrizione text, istruttori text,
                 inizio timestamptz, fine timestamptz, stato stato_sessione, iscritti int, presenti int)
  language plpgsql stable security definer set search_path = public, extensions as $$
declare
  p uuid := postazione_corrente();
  sala uuid;
begin
  if p is null then raise exception 'solo un tablet di sala' using errcode = '42501'; end if;
  if a_giorno < da_giorno or a_giorno - da_giorno > 31 then raise exception 'intervallo non valido: % → %', da_giorno, a_giorno; end if;
  select sala_id into sala from postazioni where postazioni.id = p;
  return query
    select s.id, s.corso_id, c.nome, c.colore, c.descrizione,
      -- chi la fa: il sostituto se c'è, altrimenti chi insegna il corso
      coalesce(
        case when s.istruttore_id is distinct from c.istruttore_id then (select nome from persone where persone.id = s.istruttore_id) end,
        (select string_agg(pe.nome, ', ' order by pe.nome) from corsi_istruttori ci join persone pe on pe.id = ci.persona_id where ci.corso_id = c.id),
        (select nome from persone where persone.id = c.istruttore_id)
      ),
      s.inizio, s.fine, s.stato,
      (select count(*)::int from iscrizioni i where i.corso_id = s.corso_id
         and i.dal <= (s.inizio at time zone 'Europe/Rome')::date and (i.al is null or i.al >= (s.inizio at time zone 'Europe/Rome')::date)
         and not presente_altrove(s.id, i.persona_id)),
      (select count(*)::int from presenze pr where pr.sessione_id = s.id and pr.stato = 'presente')
    from sessioni s join corsi c on c.id = s.corso_id
    left join ricorrenze r on r.id = s.ricorrenza_id
    where coalesce(s.sala_id, r.sala_id, c.sala_id) = sala
      and s.inizio >= (da_giorno::timestamp at time zone 'Europe/Rome')
      and s.inizio < ((a_giorno + 1)::timestamp at time zone 'Europe/Rome')
    order by s.inizio, c.nome;
end $$;

create or replace function elenco_sala(sessione uuid)
  returns table (persona_id uuid, nome text, sigla text, segnato boolean)
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
  return query
    with elenco as (
      select pe.id, pe.nome, pe.cognome,
        upper(left(regexp_replace(pe.cognome, '^(De|Di|Da|Del|Della|Lo|La)\s+', '\1', 'i'), 1)) as iniziale
      from iscrizioni i join persone pe on pe.id = i.persona_id
      where i.corso_id = l.corso and pe.attiva
        and i.dal <= (l.inizio at time zone 'Europe/Rome')::date
        and (i.al is null or i.al >= (l.inizio at time zone 'Europe/Rome')::date)
        and not presente_altrove(sessione, pe.id)
    )
    select e.id, e.nome,
      case when count(*) over (partition by e.nome, e.iniziale) > 1 then left(regexp_replace(e.cognome, '\s+', '', 'g'), 3) else e.iniziale end || '.',
      exists (select 1 from presenze pr where pr.sessione_id = sessione and pr.persona_id = e.id and pr.stato = 'presente')
    from elenco e
    order by e.nome, e.cognome;
end $$;

create or replace function segna_dal_tablet(sessione uuid, persona uuid)
  returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  l record;
  r record;
  da origine_presenza;
  c record;
begin
  select * into r from tablet_regole();
  select * into l from lezione_del_tablet(sessione);
  if l.stato = 'annullata' then raise exception 'lezione annullata' using errcode = '42501'; end if;
  if now() between l.inizio - r.prima and l.fine + r.dopo then da := 'tablet';
  elsif l.inizio <= now() and l.inizio >= now() - r.recupero then da := 'recupero';
  else raise exception 'fuori orario: la lezione non si può segnare adesso' using errcode = '42501';
  end if;
  if not exists (
    select 1 from iscrizioni i where i.corso_id = l.corso and i.persona_id = persona
      and i.dal <= (l.inizio at time zone 'Europe/Rome')::date
      and (i.al is null or i.al >= (l.inizio at time zone 'Europe/Rome')::date)
  ) then
    raise exception 'non è iscritto a questo corso' using errcode = '42501';
  end if;
  -- Già presente a un altro turno di oggi: qui non si segna (un tocco rimasto in coda, o un nome visto prima).
  if presente_altrove(sessione, persona) then return 'altro_turno'; end if;

  select stato, origine into c from presenze where sessione_id = sessione and persona_id = persona;
  if found and c.stato = 'presente' then return 'gia'; end if;
  if found and c.origine = 'appello' then return 'istruttore'; end if;

  insert into presenze (sessione_id, persona_id, stato, origine, postazione_id)
    values (sessione, persona, 'presente', da, l.postazione)
    on conflict (sessione_id, persona_id) do update
      set stato = 'presente', origine = excluded.origine, postazione_id = excluded.postazione_id
      where presenze.origine <> 'appello';
  return 'segnata';
end $$;

create or replace function appello_con_pin(pin text, sessione uuid)
  returns table (persona_id uuid, nome text, cognome text, stato stato_presenza, origine origine_presenza)
  language plpgsql security definer set search_path = public, extensions as $$
declare
  chi uuid;
  l record;
begin
  select * into l from lezione_del_tablet(sessione);
  -- Un PIN sbagliato non solleva: l'errore annullerebbe anche il tentativo
  -- appena contato, e il blocco dopo cinque errori non scatterebbe mai.
  chi := persona_da_pin(pin);
  if chi is null then return; end if;
  return query
    select pe.id, pe.nome, pe.cognome, pr.stato, pr.origine
    from iscrizioni i join persone pe on pe.id = i.persona_id
    left join presenze pr on pr.sessione_id = sessione and pr.persona_id = pe.id
    where i.corso_id = l.corso and pe.attiva
      and i.dal <= (l.inizio at time zone 'Europe/Rome')::date
      and (i.al is null or i.al >= (l.inizio at time zone 'Europe/Rome')::date)
      and not presente_altrove(sessione, pe.id)
    order by pe.cognome, pe.nome;
end $$;

create or replace function segna_con_pin(pin text, sessione uuid, persona uuid, stato stato_presenza)
  returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare
  chi uuid;
  l record;
begin
  select * into l from lezione_del_tablet(sessione);
  chi := persona_da_pin(pin);
  if chi is null then return false; end if;  -- vedi appello_con_pin
  if not exists (select 1 from iscrizioni i where i.corso_id = l.corso and i.persona_id = persona) then
    raise exception 'non è iscritto a questo corso' using errcode = '42501';
  end if;
  -- Già presente a un altro turno di oggi: non è nel suo appello, e un segno qui non si scrive.
  if stato is not null and presente_altrove(sessione, persona) then return true; end if;
  if stato is null then
    delete from presenze where sessione_id = sessione and persona_id = persona and origine <> 'appello';
    return true;
  end if;
  insert into presenze (sessione_id, persona_id, stato, origine, segnata_da, postazione_id)
    values (sessione, persona, stato, 'appello', chi, l.postazione)
    on conflict (sessione_id, persona_id) do update
      set stato = excluded.stato, origine = 'appello', segnata_da = excluded.segnata_da, postazione_id = excluded.postazione_id;
  return true;
end $$;

create or replace function frequenze(giorni int default 30)
  returns table (persona_id uuid, presenti int, dovute int)
  language sql stable security invoker set search_path = public, extensions as $$
  -- Una riga per persona, corso e giorno: il doppio turno vale una lezione. Presente a un turno
  -- vale presente; se no un giustificato non è dovuto; se no è un'assenza.
  with giorni as (
    select i.persona_id,
      coalesce(bool_or(p.stato = 'presente'), false) as presente,
      coalesce(bool_or(p.stato = 'giustificato'), false) as giustificato
    from iscrizioni i
    join sessioni s on s.corso_id = i.corso_id
      and s.stato <> 'annullata'
      and s.inizio < now() and s.inizio >= now() - make_interval(days => giorni)
      and (s.inizio at time zone 'Europe/Rome')::date >= i.dal
      and (i.al is null or (s.inizio at time zone 'Europe/Rome')::date <= i.al)
    left join presenze p on p.sessione_id = s.id and p.persona_id = i.persona_id
    group by i.persona_id, s.corso_id, (s.inizio at time zone 'Europe/Rome')::date
  )
  select persona_id,
    count(*) filter (where presente)::int,
    count(*) filter (where presente or not giustificato)::int
  from giorni
  group by persona_id
$$;

create or replace function statistiche(da timestamptz, a timestamptz) returns jsonb
  language plpgsql stable security definer set search_path = public, extensions as $$
declare
  fino timestamptz := least(a, now());
  lezioni jsonb;
  incassi jsonb;
begin
  if not e_staff() then raise exception 'le statistiche sono della segreteria' using errcode = '42501'; end if;
  if da is null or a is null or a < da then raise exception 'il periodo è al contrario' using errcode = '22023'; end if;
  if a - da > interval '800 days' then raise exception 'al massimo due anni per volta' using errcode = '22023'; end if;

  with s as (
    select s.id, s.corso_id, s.inizio, s.stato, s.istruttore_id, c.istruttore_id as titolare,
           c.nome as corso, c.colore, c.capienza, sa.nome as sala,
           (s.inizio at time zone 'Europe/Rome')::date as giorno
      from sessioni s
      join corsi c on c.id = s.corso_id
      left join sale sa on sa.id = s.sala_id
     where s.inizio >= da and s.inizio <= fino
  ),
  appello as (
    select s.id,
           count(i.persona_id) as iscritti,
           count(p.id) filter (where p.stato = 'presente') as presenti,
           count(p.id) filter (where p.stato = 'assente') as assenti,
           count(p.id) filter (where p.stato = 'giustificato') as giustificati
      from s
      join iscrizioni i on i.corso_id = s.corso_id and i.dal <= s.giorno and (i.al is null or i.al >= s.giorno)
      join persone pe on pe.id = i.persona_id and pe.attiva
      left join presenze p on p.sessione_id = s.id and p.persona_id = i.persona_id
     where not presente_altrove(s.id, i.persona_id)
     group by s.id
  ),
  fuori as (
    -- Presenti senza essere iscritti quel giorno: le prove.
    select s.id, count(*) as prove
      from s
      join presenze p on p.sessione_id = s.id and p.stato = 'presente'
     where not exists (
       select 1 from iscrizioni i
        where i.corso_id = s.corso_id and i.persona_id = p.persona_id
          and i.dal <= s.giorno and (i.al is null or i.al >= s.giorno)
     )
     group by s.id
  ),
  chi as (
    -- Chi l'ha fatta: il sostituto, o chi insegna il corso, come in PRESENZE.
    select s.id,
           case
             when s.istruttore_id is not null and s.istruttore_id is distinct from s.titolare
               then (select jsonb_build_array(pe.nome || ' ' || pe.cognome) from persone pe where pe.id = s.istruttore_id)
             else coalesce(
               (select jsonb_agg(pe.nome || ' ' || pe.cognome order by pe.cognome, pe.nome)
                  from corsi_istruttori ci join persone pe on pe.id = ci.persona_id
                 where ci.corso_id = s.corso_id),
               (select jsonb_build_array(pe.nome || ' ' || pe.cognome) from persone pe where pe.id = coalesce(s.istruttore_id, s.titolare)))
           end as istruttori,
           (s.istruttore_id is not null and s.istruttore_id is distinct from s.titolare) as sostituto
      from s
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s.id, 'corso_id', s.corso_id, 'corso', s.corso, 'colore', s.colore, 'capienza', s.capienza,
           'sala', s.sala, 'inizio', s.inizio, 'stato', s.stato,
           'istruttori', coalesce(chi.istruttori, '[]'::jsonb), 'sostituto', chi.sostituto,
           'iscritti', coalesce(ap.iscritti, 0), 'presenti', coalesce(ap.presenti, 0),
           'assenti', coalesce(ap.assenti, 0), 'giustificati', coalesce(ap.giustificati, 0),
           'prove', coalesce(f.prove, 0)
         ) order by s.inizio), '[]'::jsonb)
    into lezioni
    from s
    left join appello ap on ap.id = s.id
    left join fuori f on f.id = s.id
    left join chi on chi.id = s.id;

  -- Le ricevute ci sono solo con 16-ricevute.sql.
  if to_regclass('public.ricevute') is not null then
    execute $q$
      select coalesce(jsonb_agg(jsonb_build_object('mese', m.mese, 'ricevute', m.ricevute, 'totale', m.totale, 'pagato', m.pagato) order by m.mese), '[]'::jsonb)
        from (
          select to_char(r.data, 'YYYY-MM') as mese, count(*) as ricevute, sum(r.totale) as totale, sum(r.pagato) as pagato
            from ricevute r
           where r.annullata_il is null
             and r.data >= ($1 at time zone 'Europe/Rome')::date
             and r.data <= ($2 at time zone 'Europe/Rome')::date
           group by 1
        ) m
    $q$ into incassi using da, a;
  end if;

  return jsonb_build_object('lezioni', lezioni, 'incassi', incassi);
end $$;

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
     and not presente_altrove(s.id, persona)
   order by s.inizio desc
$$;

notify pgrst, 'reload schema';
