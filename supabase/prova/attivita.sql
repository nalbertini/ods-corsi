-- L'«Attività» di ogni giorno dei corsi, scelta da un elenco: chi tiene
-- l'elenco, cosa blocca, e come le lezioni seguono il giorno.
-- Si lancia dopo finto-supabase.sql e tutti i file dello schema fino a
-- 41-attivita.sql.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'maura@ods.it'),
  ('55555555-5555-5555-5555-555555555555', 'tatami@ods.it'),
  ('66666666-6666-6666-6666-666666666666', 'lotta@ods.it'),
  ('77777777-7777-7777-7777-777777777777', 'doppio@ods.it');
insert into persone (id, nome, cognome, ruolo, anche_istruttore, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', false, '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Maura', 'Uno', 'istruttore', false, '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Giulia', 'Due', 'istruttore', false, null),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'Luca', 'Rossi', 'iscritto', false, null),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'Sara', 'Bianchi', 'iscritto', false, null),
  ('aaaaaaaa-0000-0000-0000-000000000006', 'Dora', 'Doppio', 'staff', true, '77777777-7777-7777-7777-777777777777');
insert into sale (id, nome) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Lotta'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Tatami');
insert into postazioni (id, nome, sala_id, utente_id) values
  ('dddddddd-0000-0000-0000-000000000001', 'Tablet Lotta',  'bbbbbbbb-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666666'),
  ('dddddddd-0000-0000-0000-000000000002', 'Tablet Tatami', 'bbbbbbbb-0000-0000-0000-000000000002', '55555555-5555-5555-5555-555555555555');
-- Lotta 2 è di Maura; Judo 2, in un'altra sala, di Giulia.
insert into corsi (id, nome, sala_id, istruttore_id) values
  ('cccccccc-0000-0000-0000-000000000001', 'Lotta 2', 'bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002'),
  ('cccccccc-0000-0000-0000-000000000002', 'Judo 2',  'bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000003');
insert into corsi_istruttori (corso_id, persona_id) values
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002'),
  ('cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000003');
insert into ricorrenze (id, corso_id, giorno, ora, durata_min, dal) values
  ('dddddddd-1111-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', extract(dow from current_date + 3)::int, '17:00', 60, current_date - 30);

-- L'elenco parte vuoto: lo riempie la segreteria. Qui lo si riempie da
-- amministratore, per avere gli id.
select count(*)::text as vuoto from attivita \gset

create or replace function chi(u text) returns void language plpgsql as $$
begin perform set_config('prova.utente', u, false); end $$;
create or replace function tenta(sql text) returns text language plpgsql as $$
declare n int; esito text;
begin
  if sql ~* '^\s*select' then execute sql into esito; else execute sql; end if;
  get diagnostics n = row_count;
  return coalesce(esito, case when n = 0 then 'a vuoto (0 righe)' else 'FATTO (' || n || ' righe)' end);
exception when others then return 'NEGATO: ' || sqlerrm;
end $$;
create or replace function atteso(cosa text, avuto text, voluto text) returns text language plpgsql as $$
begin
  if avuto is distinct from voluto and not (voluto like '%…' and avuto like replace(voluto, '…', '%')) then
    raise exception '% · atteso «%», avuto «%»', cosa, voluto, avuto;
  end if;
  return 'ok  ' || cosa || ' → ' || avuto;
end $$;
-- Le attività delle lezioni di un giorno, dalla più vecchia: «-» è nessuna.
create or replace function lezioni_di(rid uuid) returns text language sql as $$
  select string_agg(coalesce(a.nome, '-'), ',' order by s.inizio)
  from sessioni s left join attivita a on a.id = s.attivita_id where s.ricorrenza_id = rid
$$;
create or replace function attivita_del_giorno(rid uuid) returns text language sql as $$
  select coalesce(a.nome, '-') from ricorrenze r left join attivita a on a.id = r.attivita_id where r.id = rid
$$;

\echo ''
\echo '--- 1. l''elenco parte vuoto, e il nome vale una volta sola ---'
select atteso('nessuna attività all''inizio', :'vuoto', '0');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria scrive «Sacco»',
  tenta($$insert into attivita (id, nome) values ('a1000000-0000-0000-0000-000000000001', 'Sacco')$$), 'FATTO (1 righe)');
select atteso('«sacco » è lo stesso nome',
  tenta($$insert into attivita (nome) values ('sacco ')$$), 'NEGATO: duplicate key value violates unique constraint "attivita_nome_unico"');
select atteso('«SACCO» pure',
  tenta($$insert into attivita (nome) values ('SACCO')$$), 'NEGATO: duplicate key value violates unique constraint "attivita_nome_unico"');
select atteso('uno spazio dentro il nome lo fa diverso',
  tenta($$insert into attivita (id, nome) values ('a1000000-0000-0000-0000-000000000002', 'Angoli')$$), 'FATTO (1 righe)');
select atteso('e un altro nome pure',
  tenta($$insert into attivita (id, nome) values ('a1000000-0000-0000-0000-000000000003', 'Sparring')$$), 'FATTO (1 righe)');
select atteso('nuove, sono in uso',
  (select string_agg(nome || ':' || attiva::text, ',' order by nome) from attivita), 'Angoli:true,Sacco:true,Sparring:true');
select atteso('rinominare una col nome di un''altra no',
  tenta($$update attivita set nome = ' angoli' where nome = 'Sacco'$$), 'NEGATO: duplicate key value violates unique constraint "attivita_nome_unico"');
reset role;

\echo ''
\echo '--- 2. il nome non è vuoto e non è lungo: nemmeno scrivendo direttamente sul database ---'
select atteso('vuoto no', tenta($$insert into attivita (nome) values ('')$$), 'NEGATO: new row for relation "attivita" violates check constraint…');
select atteso('solo spazi no', tenta($$insert into attivita (nome) values ('   ')$$), 'NEGATO: new row for relation "attivita" violates check constraint…');
select atteso('41 caratteri no', tenta($$insert into attivita (nome) values (repeat('x', 41))$$), 'NEGATO: new row for relation "attivita" violates check constraint…');
select atteso('cambiare un nome in vuoto no', tenta($$update attivita set nome = '' where nome = 'Sacco'$$), 'NEGATO: new row for relation "attivita" violates check constraint…');
select atteso('40 caratteri sì', tenta($$insert into attivita (nome) values (repeat('x', 40))$$), 'FATTO (1 righe)');
delete from attivita where nome = repeat('x', 40);
-- E la segreteria, dall'app, ha lo stesso rifiuto.
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('anche dall''app: 41 caratteri no', tenta($$insert into attivita (nome) values (repeat('y', 41))$$), 'NEGATO: new row for relation "attivita" violates check constraint…');
reset role;

-- Le lezioni di Lotta 2 sul giorno r1, che non ha ancora un'attività: due
-- passate; una futura con l'appello; una futura cambiata a mano su Sparring;
-- tre che seguono il giorno; una con una prova ma senza presenze.
insert into sessioni (id, corso_id, ricorrenza_id, inizio, fine) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 'dddddddd-1111-0000-0000-000000000001', now() - interval '14 days', now() - interval '14 days' + interval '1 hour'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000001', 'dddddddd-1111-0000-0000-000000000001', now() - interval '7 days',  now() - interval '7 days'  + interval '1 hour'),
  ('eeeeeeee-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-000000000001', 'dddddddd-1111-0000-0000-000000000001', now() + interval '3 days',  now() + interval '3 days'  + interval '1 hour'),
  ('eeeeeeee-0000-0000-0000-000000000004', 'cccccccc-0000-0000-0000-000000000001', 'dddddddd-1111-0000-0000-000000000001', now() + interval '10 days', now() + interval '10 days' + interval '1 hour'),
  ('eeeeeeee-0000-0000-0000-000000000005', 'cccccccc-0000-0000-0000-000000000001', 'dddddddd-1111-0000-0000-000000000001', now() + interval '17 days', now() + interval '17 days' + interval '1 hour'),
  ('eeeeeeee-0000-0000-0000-000000000006', 'cccccccc-0000-0000-0000-000000000001', 'dddddddd-1111-0000-0000-000000000001', now() + interval '24 days', now() + interval '24 days' + interval '1 hour'),
  ('eeeeeeee-0000-0000-0000-000000000007', 'cccccccc-0000-0000-0000-000000000001', 'dddddddd-1111-0000-0000-000000000001', now() + interval '28 days', now() + interval '28 days' + interval '1 hour'),
  ('eeeeeeee-0000-0000-0000-000000000008', 'cccccccc-0000-0000-0000-000000000001', 'dddddddd-1111-0000-0000-000000000001', now() + interval '45 days', now() + interval '45 days' + interval '1 hour');
insert into presenze (sessione_id, persona_id, stato) values
  ('eeeeeeee-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000004', 'presente');
insert into prove (sessione_id, persona_id) values
  ('eeeeeeee-0000-0000-0000-000000000008', 'aaaaaaaa-0000-0000-0000-000000000005');
update sessioni set attivita_id = 'a1000000-0000-0000-0000-000000000003' where id = 'eeeeeeee-0000-0000-0000-000000000004';

\echo ''
\echo '--- 7. mettere un''attività sul giorno aggiorna le lezioni future che lo seguivano ---'
select atteso('di partenza', lezioni_di('dddddddd-1111-0000-0000-000000000001'), '-,-,-,Sparring,-,-,-,-');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria scrive «Sacco» sul giorno',
  tenta($$update ricorrenze set attivita_id = 'a1000000-0000-0000-0000-000000000001' where id = 'dddddddd-1111-0000-0000-000000000001'$$), 'FATTO (1 righe)');
reset role;
select atteso('le tre future senza appello e non cambiate a mano seguono; le altre restano',
  lezioni_di('dddddddd-1111-0000-0000-000000000001'), '-,-,-,Sparring,Sacco,Sacco,Sacco,-');
select atteso('quella con una prova ma senza presenze non cambia',
  (select coalesce(a.nome, '-') from sessioni s left join attivita a on a.id = s.attivita_id where s.id = 'eeeeeeee-0000-0000-0000-000000000008'), '-');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
update ricorrenze set attivita_id = 'a1000000-0000-0000-0000-000000000002' where id = 'dddddddd-1111-0000-0000-000000000001';
reset role;
select atteso('da «Sacco» ad «Angoli», le stesse tre',
  lezioni_di('dddddddd-1111-0000-0000-000000000001'), '-,-,-,Sparring,Angoli,Angoli,Angoli,-');
update ricorrenze set attivita_id = null where id = 'dddddddd-1111-0000-0000-000000000001';
select atteso('togliere l''attività al giorno la toglie a chi lo seguiva',
  lezioni_di('dddddddd-1111-0000-0000-000000000001'), '-,-,-,Sparring,-,-,-,-');
update ricorrenze set attivita_id = 'a1000000-0000-0000-0000-000000000002' where id = 'dddddddd-1111-0000-0000-000000000001';
select atteso('da nessuna ad «Angoli»: la lezione senza attività seguiva il giorno vuoto',
  lezioni_di('dddddddd-1111-0000-0000-000000000001'), '-,-,-,Sparring,Angoli,Angoli,Angoli,-');
select atteso('le passate non si toccano mai',
  (select string_agg(coalesce(a.nome, '-'), ',') from sessioni s left join attivita a on a.id = s.attivita_id where s.inizio < now() and s.ricorrenza_id is not null), '-,-');

\echo ''
\echo '--- 9. le lezioni nuove nascono con l''attività del giorno ---'
select atteso('una lezione nuova del giorno',
  tenta($$insert into sessioni (corso_id, ricorrenza_id, inizio, fine) values ('cccccccc-0000-0000-0000-000000000001', 'dddddddd-1111-0000-0000-000000000001', now() + interval '50 days', now() + interval '50 days' + interval '1 hour')$$), 'FATTO (1 righe)');
select atteso('nasce con «Angoli»', (select a.nome from sessioni s join attivita a on a.id = s.attivita_id where s.inizio > now() + interval '49 days'), 'Angoli');
select atteso('se ne scrive una, resta quella',
  tenta($$insert into sessioni (corso_id, ricorrenza_id, inizio, fine, attivita_id) values ('cccccccc-0000-0000-0000-000000000001', 'dddddddd-1111-0000-0000-000000000001', now() + interval '51 days', now() + interval '51 days' + interval '1 hour', 'a1000000-0000-0000-0000-000000000003')$$), 'FATTO (1 righe)');
select atteso('«Sparring» resta', (select a.nome from sessioni s join attivita a on a.id = s.attivita_id where s.inizio > now() + interval '50 days 12 hours'), 'Sparring');
delete from sessioni where inizio > now() + interval '49 days';
select materializza_sessioni(current_date + 60, current_date + 75);
select atteso('il calendario che si allunga (RIGENERA, import, allunga): le lezioni nuove del giorno hanno «Angoli»',
  (select string_agg(distinct coalesce(a.nome, '-'), ',') || '/' || (count(*) > 0)::text
   from sessioni s left join attivita a on a.id = s.attivita_id
   where s.ricorrenza_id = 'dddddddd-1111-0000-0000-000000000001' and s.inizio > now() + interval '55 days'), 'Angoli/true');
delete from sessioni where inizio > now() + interval '49 days';

\echo ''
\echo '--- 10. un giorno creato con un''attività: le sue lezioni nascono con quella ---'
insert into ricorrenze (id, corso_id, giorno, ora, durata_min, dal, attivita_id) values
  ('dddddddd-2222-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000002', extract(dow from current_date + 4)::int, '18:00', 60, current_date - 30, 'a1000000-0000-0000-0000-000000000001');
select materializza_sessioni(current_date + 80, current_date + 95);
select atteso('le lezioni del giorno nuovo hanno «Sacco»',
  (select string_agg(distinct coalesce(a.nome, '-'), ',') || '/' || (count(*) > 0)::text
   from sessioni s left join attivita a on a.id = s.attivita_id where s.ricorrenza_id = 'dddddddd-2222-0000-0000-000000000002'), 'Sacco/true');
delete from sessioni where inizio > now() + interval '49 days';

\echo ''
\echo '--- 11. una lezione sola: un''altra attività, nessuna, o come il giorno ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria mette «Sacco» a una lezione',
  tenta($$update sessioni set attivita_id = 'a1000000-0000-0000-0000-000000000001' where id = 'eeeeeeee-0000-0000-0000-000000000005'$$), 'FATTO (1 righe)');
reset role;
select atteso('cambia solo quella', lezioni_di('dddddddd-1111-0000-0000-000000000001'), '-,-,-,Sparring,Sacco,Angoli,Angoli,-');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('«Nessuna attività»',
  tenta($$update sessioni set attivita_id = null where id = 'eeeeeeee-0000-0000-0000-000000000005'$$), 'FATTO (1 righe)');
update ricorrenze set attivita_id = 'a1000000-0000-0000-0000-000000000001' where id = 'dddddddd-1111-0000-0000-000000000001';
reset role;
select atteso('«cambiata a mano» non segue il giorno, nemmeno senza attività',
  lezioni_di('dddddddd-1111-0000-0000-000000000001'), '-,-,-,Sparring,-,Sacco,Sacco,-');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('«Come il giorno»: la lezione prende quella del giorno',
  tenta($$update sessioni s set attivita_id = (select r.attivita_id from ricorrenze r where r.id = s.ricorrenza_id) where s.id = 'eeeeeeee-0000-0000-0000-000000000005'$$), 'FATTO (1 righe)');
update ricorrenze set attivita_id = 'a1000000-0000-0000-0000-000000000002' where id = 'dddddddd-1111-0000-0000-000000000001';
reset role;
select atteso('e torna a seguirlo', lezioni_di('dddddddd-1111-0000-0000-000000000001'), '-,-,-,Sparring,Angoli,Angoli,Angoli,-');
update ricorrenze set attivita_id = 'a1000000-0000-0000-0000-000000000001' where id = 'dddddddd-1111-0000-0000-000000000001';

\echo ''
\echo '--- 12. una lezione straordinaria può avere un''attività, e nessun giorno la cambia ---'
insert into sessioni (id, corso_id, inizio, fine, sala_id, attivita_id) values
  ('eeeeeeee-0000-0000-0000-000000000009', 'cccccccc-0000-0000-0000-000000000002', now() + interval '5 days', now() + interval '5 days' + interval '1 hour', null, 'a1000000-0000-0000-0000-000000000003');
select atteso('nasce con la sua attività', (select a.nome from sessioni s join attivita a on a.id = s.attivita_id where s.id = 'eeeeeeee-0000-0000-0000-000000000009'), 'Sparring');
update ricorrenze set attivita_id = 'a1000000-0000-0000-0000-000000000002' where id = 'dddddddd-2222-0000-0000-000000000002';
update ricorrenze set attivita_id = null where id = 'dddddddd-2222-0000-0000-000000000002';
select atteso('i giorni cambiano e lei no', (select a.nome from sessioni s join attivita a on a.id = s.attivita_id where s.id = 'eeeeeeee-0000-0000-0000-000000000009'), 'Sparring');

\echo ''
\echo '--- 13. una lezione annullata tiene la sua attività ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
update sessioni set stato = 'annullata' where id = 'eeeeeeee-0000-0000-0000-000000000006';
reset role;
select atteso('annullata, ha ancora «Sacco»', (select a.nome from sessioni s join attivita a on a.id = s.attivita_id where s.id = 'eeeeeeee-0000-0000-0000-000000000006'), 'Sacco');
update sessioni set stato = 'prevista' where id = 'eeeeeeee-0000-0000-0000-000000000006';

\echo ''
\echo '--- 4. rinominare: una riga cambia, e il nome nuovo si vede ovunque ---'
-- Una passata, che non è del giorno, con «Sacco»: la rinomina arriva anche lì.
insert into sessioni (id, corso_id, inizio, fine, attivita_id) values
  ('eeeeeeee-0000-0000-0000-00000000000a', 'cccccccc-0000-0000-0000-000000000001', now() - interval '3 days', now() - interval '3 days' + interval '1 hour', 'a1000000-0000-0000-0000-000000000001');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria rinomina «Sacco»', tenta($$update attivita set nome = 'Sacco pesante' where id = 'a1000000-0000-0000-0000-000000000001'$$), 'FATTO (1 righe)');
reset role;
select atteso('sul giorno', attivita_del_giorno('dddddddd-1111-0000-0000-000000000001'), 'Sacco pesante');
select atteso('sulle lezioni future', lezioni_di('dddddddd-1111-0000-0000-000000000001'), '-,-,-,Sparring,Sacco pesante,Sacco pesante,Sacco pesante,-');
select atteso('e su quella passata', (select a.nome from sessioni s join attivita a on a.id = s.attivita_id where s.id = 'eeeeeeee-0000-0000-0000-00000000000a'), 'Sacco pesante');
select atteso('le lezioni non hanno copie del nome', (select count(*)::text from information_schema.columns where table_name in ('sessioni', 'ricorrenze') and column_name ilike '%attivita%' and column_name <> 'attivita_id'), '0');
update attivita set nome = 'Sacco' where id = 'a1000000-0000-0000-0000-000000000001';

\echo ''
\echo '--- 5. eliminare: una usata no, una mai usata sì ---'
-- «Angoli»: solo una lezione passata. «Solo giorno»: solo un giorno. «Mai usata»: niente.
insert into attivita (id, nome) values
  ('a1000000-0000-0000-0000-000000000004', 'Solo giorno'),
  ('a1000000-0000-0000-0000-000000000005', 'Mai usata');
update ricorrenze set attivita_id = 'a1000000-0000-0000-0000-000000000004' where id = 'dddddddd-2222-0000-0000-000000000002';
update sessioni set attivita_id = 'a1000000-0000-0000-0000-000000000002' where id = 'eeeeeeee-0000-0000-0000-000000000001';
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('«Sacco», sul giorno e sulle lezioni: bloccata',
  tenta($$delete from attivita where id = 'a1000000-0000-0000-0000-000000000001'$$),
  'NEGATO: update or delete on table "attivita" violates foreign key constraint…');
select atteso('«Angoli», solo su una lezione passata: bloccata',
  tenta($$delete from attivita where id = 'a1000000-0000-0000-0000-000000000002'$$),
  'NEGATO: update or delete on table "attivita" violates foreign key constraint…');
select atteso('«Solo giorno»: bloccata',
  tenta($$delete from attivita where id = 'a1000000-0000-0000-0000-000000000004'$$),
  'NEGATO: update or delete on table "attivita" violates foreign key constraint…');
select atteso('«Mai usata» si elimina',
  tenta($$delete from attivita where id = 'a1000000-0000-0000-0000-000000000005'$$), 'FATTO (1 righe)');
reset role;
select atteso('il rifiuto non toglie niente dal giorno', attivita_del_giorno('dddddddd-1111-0000-0000-000000000001'), 'Sacco');
select atteso('né dalle lezioni', lezioni_di('dddddddd-1111-0000-0000-000000000001'), 'Angoli,-,-,Sparring,Sacco,Sacco,Sacco,-');

\echo ''
\echo '--- 6. NON PIÙ IN USO: resta dove è, e si rimette con un tocco ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria la mette fuori uso',
  tenta($$update attivita set attiva = false where id = 'a1000000-0000-0000-0000-000000000001'$$), 'FATTO (1 righe)');
reset role;
select atteso('l''elenco per i menu non la ha', (select string_agg(nome, ',' order by nome) from attivita where attiva), 'Angoli,Solo giorno,Sparring');
select atteso('sul giorno resta', attivita_del_giorno('dddddddd-1111-0000-0000-000000000001'), 'Sacco');
select atteso('sulle lezioni resta, passata compresa',
  (select count(*)::text from sessioni where attivita_id = 'a1000000-0000-0000-0000-000000000001'), '4');
update attivita set attiva = true where id = 'a1000000-0000-0000-0000-000000000001';
select atteso('rimessa in uso', (select attiva::text from attivita where id = 'a1000000-0000-0000-0000-000000000001'), 'true');

\echo ''
\echo '--- 14. chi legge l''elenco e chi lo scrive ---'
-- Una mai usata, per provare che chi non scrive nell'elenco non la toglie.
insert into attivita (id, nome) values ('a1000000-0000-0000-0000-000000000007', 'Libera');
select count(*)::text as n from attivita \gset
select chi('');
set role anon;
select atteso('anon non legge', tenta($$select count(*)::text from attivita$$), 'NEGATO: …');
select atteso('anon non scrive', tenta($$insert into attivita (nome) values ('Abusiva')$$), 'NEGATO: …');
select atteso('anon non cambia', tenta($$update attivita set nome = 'Abusiva'$$), 'NEGATO: …');
reset role;

select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('il tablet legge l''elenco', tenta($$select count(*)::text from attivita$$), :'n');
select atteso('il tablet non ci scrive',
  (case when tenta($$insert into attivita (nome) values ('Abusiva')$$) like 'FATTO%' then 'sì' else 'no' end), 'no');
select atteso('né cambia un nome',
  (case when tenta($$update attivita set nome = 'Abusiva'$$) like 'FATTO%' then 'sì' else 'no' end), 'no');
select atteso('né ne toglie una',
  (case when tenta($$delete from attivita where id = 'a1000000-0000-0000-0000-000000000007'$$) like 'FATTO%' then 'sì' else 'no' end), 'no');
reset role;

select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('l''istruttore legge l''elenco', tenta($$select count(*)::text from attivita$$), :'n');
select atteso('l''istruttore non ci scrive',
  (case when tenta($$insert into attivita (nome) values ('Abusiva')$$) like 'FATTO%' then 'sì' else 'no' end), 'no');
select atteso('né cambia un nome',
  (case when tenta($$update attivita set nome = 'Abusiva'$$) like 'FATTO%' then 'sì' else 'no' end), 'no');
select atteso('né la mette fuori uso',
  (case when tenta($$update attivita set attiva = false$$) like 'FATTO%' then 'sì' else 'no' end), 'no');
select atteso('né ne toglie una',
  (case when tenta($$delete from attivita where id = 'a1000000-0000-0000-0000-000000000007'$$) like 'FATTO%' then 'sì' else 'no' end), 'no');
select atteso('né cambia quella di un giorno',
  (case when tenta($$update ricorrenze set attivita_id = 'a1000000-0000-0000-0000-000000000003' where id = 'dddddddd-1111-0000-0000-000000000001'$$) like 'FATTO%' then 'sì' else 'no' end), 'no');
select atteso('cambia l''attività di una sua lezione',
  tenta($$update sessioni set attivita_id = 'a1000000-0000-0000-0000-000000000003' where id = 'eeeeeeee-0000-0000-0000-000000000007'$$), 'FATTO (1 righe)');
select atteso('anche a «Nessuna attività»',
  tenta($$update sessioni set attivita_id = null where id = 'eeeeeeee-0000-0000-0000-000000000007'$$), 'FATTO (1 righe)');
select atteso('ma la sala della sua lezione ancora no',
  tenta($$update sessioni set sala_id = 'bbbbbbbb-0000-0000-0000-000000000002' where id = 'eeeeeeee-0000-0000-0000-000000000007'$$), 'NEGATO: di una lezione un istruttore cambia solo…');
select atteso('e l''attività insieme alla sala nemmeno',
  tenta($$update sessioni set attivita_id = 'a1000000-0000-0000-0000-000000000003', sala_id = 'bbbbbbbb-0000-0000-0000-000000000002' where id = 'eeeeeeee-0000-0000-0000-000000000007'$$), 'NEGATO: di una lezione un istruttore cambia solo…');
select atteso('non quella di una lezione di Giulia',
  tenta($$update sessioni set attivita_id = 'a1000000-0000-0000-0000-000000000002' where id = 'eeeeeeee-0000-0000-0000-000000000009'$$), 'a vuoto (0 righe)');
reset role;
select atteso('«Libera» c''è ancora', (select nome from attivita where id = 'a1000000-0000-0000-0000-000000000007'), 'Libera');
select atteso('quella di Giulia è com''era', (select a.nome from sessioni s join attivita a on a.id = s.attivita_id where s.id = 'eeeeeeee-0000-0000-0000-000000000009'), 'Sparring');
-- La lezione di Maura torna a seguire il giorno, per i conti che seguono.
update sessioni s set attivita_id = (select r.attivita_id from ricorrenze r where r.id = s.ricorrenza_id) where s.id = 'eeeeeeee-0000-0000-0000-000000000007';

select chi('77777777-7777-7777-7777-777777777777');
set role authenticated;
select atteso('il ruolo doppio scrive nell''elenco',
  tenta($$insert into attivita (id, nome) values ('a1000000-0000-0000-0000-000000000006', 'Del doppio')$$), 'FATTO (1 righe)');
select atteso('e le cambia', tenta($$update attivita set nome = 'Del doppio 2' where id = 'a1000000-0000-0000-0000-000000000006'$$), 'FATTO (1 righe)');
select atteso('e le toglie', tenta($$delete from attivita where id = 'a1000000-0000-0000-0000-000000000006'$$), 'FATTO (1 righe)');
reset role;

\echo ''
\echo '--- 15. il tablet legge l''attività delle lezioni della sua sala, e di nessun''altra ---'
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('Lotta: le lezioni con un''attività, dalla più vecchia',
  (select string_agg(a.attivita, ',' order by s.inizio) from attivita_sala(current_date, current_date + 31) a join sessioni s on s.id = a.sessione_id),
  'Sparring,Sacco,Sacco,Sacco');
select atteso('Lotta: nessuna è di Judo 2',
  (select count(*)::text from attivita_sala(current_date, current_date + 31) a join sessioni s on s.id = a.sessione_id where s.corso_id = 'cccccccc-0000-0000-0000-000000000002'), '0');
select atteso('Lotta: una lezione senza attività non c''è', (select count(*)::text from attivita_sala(current_date, current_date + 31) where sessione_id = 'eeeeeeee-0000-0000-0000-000000000003'), '0');
reset role;
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('Tatami: solo la sua',
  (select string_agg(attivita, ',') from attivita_sala(current_date, current_date + 31)), 'Sparring');
reset role;
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('un istruttore non è un tablet', tenta($$select count(*)::text from attivita_sala(current_date, current_date + 31)$$), 'NEGATO: solo un tablet di sala');
reset role;
select chi('');
set role anon;
select atteso('anon non la chiama', tenta($$select count(*)::text from attivita_sala(current_date, current_date + 31)$$), 'NEGATO: …');
reset role;
