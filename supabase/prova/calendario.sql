\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

-- ---- semina ---------------------------------------------------------------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'staff@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'istruttore@ods.it'),
  ('33333333-3333-3333-3333-333333333333', 'iscritto@ods.it');

insert into persone (id, nome, cognome, ruolo, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff',      '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Maurizio', 'Innella', 'istruttore','22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Luca', 'Rossi', 'iscritto',        '33333333-3333-3333-3333-333333333333'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'Sara', 'Bianchi', 'iscritto', null);

insert into sale (id, nome, capienza) values ('bbbbbbbb-0000-0000-0000-000000000001', 'Sala grande', 30);
insert into corsi (id, nome, sala_id, istruttore_id, capienza) values
  ('cccccccc-0000-0000-0000-000000000001', 'Spinning', 'bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', 22);
insert into ricorrenze (corso_id, giorno, ora, durata_min, dal) values
  ('cccccccc-0000-0000-0000-000000000001', 2, '19:00', 50, '2026-10-01');   -- 2 = martedì
insert into iscrizioni (corso_id, persona_id) values
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003'),
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000004');

-- ---- 1. il calendario si materializza -------------------------------------
do $$
declare n int; giorni text; ore text;
begin
  select materializza_sessioni('2026-10-01', '2026-11-03') into n;
  raise notice '1  lezioni create: %', n;
  if n <> 5 then raise exception 'attese 5 lezioni (i martedì fra il 1/10 e il 3/11), create %', n; end if;

  select string_agg(to_char(inizio, 'DY'), ' ' order by inizio) into giorni from sessioni;
  select string_agg(to_char(inizio, 'DD/MM HH24:MI'), '  ' order by inizio) into ore from sessioni;
  raise notice '   cadono di: %', giorni;
  raise notice '   orari:     %', ore;
  if giorni <> 'TUE TUE TUE TUE TUE' then raise exception 'non cadono tutte di martedì: %', giorni; end if;
end $$;

-- ---- 2. l'ora legale non sposta la lezione --------------------------------
do $$
declare prima text; dopo text; utc text;
begin
  -- in Italia l'ora legale finisce domenica 25 ottobre 2026
  select to_char(inizio, 'HH24:MI') into prima from sessioni where inizio::date = '2026-10-20';
  select to_char(inizio, 'HH24:MI') into dopo  from sessioni where inizio::date = '2026-10-27';
  select string_agg(to_char(inizio at time zone 'UTC', 'DD/MM HH24:MI'), '  ' order by inizio) into utc
    from sessioni where inizio::date in ('2026-10-20', '2026-10-27');
  raise notice '2  20/10 alle % · 27/10 alle %  (in UTC: %)', prima, dopo, utc;
  if prima <> '19:00' or dopo <> '19:00' then
    raise exception 'il cambio di ora ha spostato la lezione: % → %', prima, dopo;
  end if;
end $$;

-- ---- 3. rigenerare non duplica --------------------------------------------
do $$
declare n int; tot int;
begin
  select materializza_sessioni('2026-10-01', '2026-11-03') into n;
  select count(*) into tot from sessioni;
  raise notice '3  seconda passata: % nuove, % in tutto', n, tot;
  if n <> 0 or tot <> 5 then raise exception 'la rigenerazione ha duplicato: % nuove, % totali', n, tot; end if;
end $$;

-- ---- 4. due tablet sulla stessa lezione convergono ------------------------
do $$
declare s uuid; n int; st stato_presenza;
begin
  select id into s from sessioni order by inizio limit 1;
  insert into presenze (sessione_id, persona_id, stato) values (s, 'aaaaaaaa-0000-0000-0000-000000000003', 'assente');
  insert into presenze (sessione_id, persona_id, stato) values (s, 'aaaaaaaa-0000-0000-0000-000000000003', 'presente')
    on conflict (sessione_id, persona_id) do update set stato = excluded.stato;
  select count(*), max(stato) into n, st from presenze where sessione_id = s;
  raise notice '4  due scritture sulla stessa persona: % riga, stato «%»', n, st;
  if n <> 1 then raise exception 'la presenza è stata duplicata: % righe', n; end if;
  delete from presenze;
end $$;
