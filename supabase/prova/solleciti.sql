-- I solleciti su WhatsApp (85-solleciti.sql): la segreteria apre WhatsApp col messaggio già scritto e il database
-- tiene solo che il tasto è stato premuto, quando e da chi. `segna_sollecito(persona)` e `ultimo_sollecito(persona)`
-- solo per la segreteria (ruolo staff); la tabella `solleciti` nessuno la legge o la scrive da fuori.
-- Le stesse regole della modalità prova, provate da scripts/prova-sollecito.mjs.
-- Si lancia dopo finto-supabase.sql e i file dello schema, su un database suo. Nomi tutti inventati.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

create or replace function atteso(cosa text, avuto text, voluto text) returns text language plpgsql as $$
begin
  if avuto is distinct from voluto then
    raise exception '% · atteso «%», avuto «%»', cosa, voluto, avuto;
  end if;
  return 'ok  ' || cosa || ' → ' || avuto;
end $$;
select atteso('85-solleciti.sql è stato lanciato: ci sono segna_sollecito e ultimo_sollecito',
  (to_regprocedure('public.segna_sollecito(uuid)') is not null and to_regprocedure('public.ultimo_sollecito(uuid)') is not null)::text, 'true');

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'ada@ods.it'),
  ('33333333-3333-3333-3333-333333333333', 'sandro@ods.it'),
  ('44444444-4444-4444-4444-444444444444', 'ivo@ods.it'),
  ('55555555-5555-5555-5555-555555555555', 'maura@ods.it'),
  ('66666666-6666-6666-6666-666666666666', 'senza@ods.it'),
  ('77777777-7777-7777-7777-777777777777', 'luca@ods.it'),
  ('99999999-9999-9999-9999-999999999999', 'tablet@ods.it');
-- Anna: segreteria. Ada: solo amministrazione. Sandro: segreteria e amministrazione. Ivo: amministrazione e
-- istruttore. Maura: istruttore. Luca: iscritto. «senza» ha un accesso ma nessuna scheda.
insert into persone (id, nome, cognome, ruolo, anche_istruttore, anche_amministrazione, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', false, false, 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Ada', 'Conti', 'amministrazione', false, false, 'ada@ods.it', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Sandro', 'Doppio', 'staff', false, true, 'sandro@ods.it', '33333333-3333-3333-3333-333333333333'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'Ivo', 'Conti', 'amministrazione', true, false, 'ivo@ods.it', '44444444-4444-4444-4444-444444444444'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'Maura', 'Uno', 'istruttore', false, false, 'maura@ods.it', '55555555-5555-5555-5555-555555555555'),
  ('aaaaaaaa-0000-0000-0000-000000000007', 'Luca', 'Rossi', 'iscritto', false, false, 'luca@ods.it', '77777777-7777-7777-7777-777777777777');
insert into sale (id, nome) values ('bbbbbbbb-0000-0000-0000-000000000001', 'Tatami');
insert into postazioni (id, nome, sala_id, utente_id) values
  ('dddddddd-0000-0000-0000-000000000001', 'Tablet', 'bbbbbbbb-0000-0000-0000-000000000001', '99999999-9999-9999-9999-999999999999');

create or replace function come(u text, q text) returns text language plpgsql as $$
declare r text;
begin
  perform set_config('prova.utente', u, false);
  set role authenticated;
  begin execute q into r; exception when others then reset role; raise; end;
  reset role;
  return r;
end $$;
create or replace function esito(sql text) returns text language plpgsql as $$
begin execute sql; return 'ok';
exception when others then return sqlstate || ' ' || sqlerrm;
end $$;
-- Una chiamata fatta da ognuno degli accessi: solo il codice dell'esito, «ok» se è andata.
create or replace function matrice(q text) returns text language plpgsql as $$
declare u record; r text; fuori text := '';
begin
  for u in select * from (values
    ('anna', '11111111-1111-1111-1111-111111111111', 'authenticated'),
    ('ada', '22222222-2222-2222-2222-222222222222', 'authenticated'),
    ('sandro', '33333333-3333-3333-3333-333333333333', 'authenticated'),
    ('ivo', '44444444-4444-4444-4444-444444444444', 'authenticated'),
    ('maura', '55555555-5555-5555-5555-555555555555', 'authenticated'),
    ('luca', '77777777-7777-7777-7777-777777777777', 'authenticated'),
    ('senza', '66666666-6666-6666-6666-666666666666', 'authenticated'),
    ('tablet', '99999999-9999-9999-9999-999999999999', 'authenticated'),
    ('anon', '00000000-0000-0000-0000-000000000000', 'anon')) as t(nome, id, ruolo) loop
    perform set_config('prova.utente', u.id, false);
    execute format('set role %I', u.ruolo);
    r := esito(q);
    reset role;
    fuori := fuori || case when fuori = '' then '' else ' ' end || u.nome || ':' || left(r, 5);
  end loop;
  return fuori;
end $$;
insert into persone (id, nome, cognome, ruolo, attiva) values
  ('cccccccc-0000-0000-0000-000000000001', 'Marco', 'Rossi', 'iscritto', true),
  ('cccccccc-0000-0000-0000-000000000002', 'Elia', 'Spento', 'iscritto', false);
grant execute on function atteso(text, text, text), come(text, text), esito(text), matrice(text) to anon, authenticated;

\echo ''
\echo '--- 1. chi può segnare un sollecito: la segreteria, e nessun altro ---'
select atteso('solo chi ha il ruolo staff (Anna, Sandro): amministrazione senza segreteria, istruttori, tablet, iscritti, senza scheda e anon no',
  matrice($q$select segna_sollecito('cccccccc-0000-0000-0000-000000000001')$q$),
  'anna:ok ada:42501 sandro:ok ivo:42501 maura:42501 luca:42501 senza:42501 tablet:42501 anon:42501');
select atteso('e chi lo legge, lo stesso',
  matrice($q$select count(*) from ultimo_sollecito('cccccccc-0000-0000-0000-000000000001')$q$),
  'anna:ok ada:42501 sandro:ok ivo:42501 maura:42501 luca:42501 senza:42501 tablet:42501 anon:42501');
select atteso('authenticated le chiama, anon no (permessi)',
  (select string_agg(has_function_privilege('authenticated', p.oid, 'execute')::text || '/' || has_function_privilege('anon', p.oid, 'execute')::text, ' ' order by p.proname)
   from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('segna_sollecito', 'ultimo_sollecito')), 'true/false true/false');

update persone set attiva = false where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select atteso('una segreteria con la scheda disattivata non segna più',
  left(esito($q$select come('11111111-1111-1111-1111-111111111111', $$select segna_sollecito('cccccccc-0000-0000-0000-000000000001')::text$$)$q$), 5), '42501');
update persone set attiva = true where id = 'aaaaaaaa-0000-0000-0000-000000000001';

\echo ''
\echo '--- 2. la tabella non si tocca da fuori ---'
select atteso('la segreteria non la legge direttamente',
  left(esito($q$select come('11111111-1111-1111-1111-111111111111', 'select count(*)::text from solleciti')$q$), 5), '42501');
select atteso('né la scrive (un sollecito finto a nome di altri)',
  left(esito($q$select come('11111111-1111-1111-1111-111111111111', $$insert into solleciti (persona_id, creato_da) values ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003') returning 'x'$$)$q$), 5), '42501');
select atteso('anon nemmeno',
  matrice('select count(*) from solleciti'),
  'anna:42501 ada:42501 sandro:42501 ivo:42501 maura:42501 luca:42501 senza:42501 tablet:42501 anon:42501');

\echo ''
\echo '--- 3. cosa si segna ---'
select atteso('i due solleciti di sopra (Anna e Sandro) ci sono', (select count(*)::text from solleciti where persona_id = 'cccccccc-0000-0000-0000-000000000001'), '2');
select atteso('chi ha premuto è la persona collegata, non un argomento',
  (select string_agg(p.nome, ',' order by p.nome) from solleciti s join persone p on p.id = s.creato_da), 'Anna,Sandro');
-- Il più recente vince: uno di Anna, più tardi.
update solleciti set creato_il = now() - interval '2 days' where creato_da = 'aaaaaaaa-0000-0000-0000-000000000003';
select atteso('l''ultimo è di Anna, con nome e cognome (due Anna si distinguono)',
  come('11111111-1111-1111-1111-111111111111', $$select da from ultimo_sollecito('cccccccc-0000-0000-0000-000000000001')$$), 'Anna Segreteria');
select atteso('una persona mai sollecitata: nessuna riga',
  come('11111111-1111-1111-1111-111111111111', $$select count(*)::text from ultimo_sollecito('aaaaaaaa-0000-0000-0000-000000000007')$$), '0');
select atteso('una scheda disattivata non si sollecita',
  left(esito($q$select come('11111111-1111-1111-1111-111111111111', $$select segna_sollecito('cccccccc-0000-0000-0000-000000000002')::text$$)$q$), 5), 'P0002');
select atteso('una persona che non c''è, nemmeno',
  left(esito($q$select come('11111111-1111-1111-1111-111111111111', $$select segna_sollecito('cccccccc-0000-0000-0000-000000000099')::text$$)$q$), 5), 'P0002');
-- Chi ha segnato se ne va: il sollecito resta, senza nome.
delete from solleciti where creato_da = 'aaaaaaaa-0000-0000-0000-000000000001';
update persone set utente_id = null where id = 'aaaaaaaa-0000-0000-0000-000000000003';
delete from persone where id = 'aaaaaaaa-0000-0000-0000-000000000003';
select atteso('cancellata la scheda di chi ha segnato, il sollecito resta col nome vuoto',
  come('11111111-1111-1111-1111-111111111111', $$select da || '|' || (creato_il is not null)::text from ultimo_sollecito('cccccccc-0000-0000-0000-000000000001')$$), '|true');

\echo ''
\echo '--- 4. l''elenco: gli ultimi solleciti di tutti, e Annulla (86-solleciti-elenco.sql) ---'
select atteso('86-solleciti-elenco.sql è stato lanciato: ci sono ultimi_solleciti e togli_sollecito',
  (to_regprocedure('public.ultimi_solleciti()') is not null and to_regprocedure('public.togli_sollecito(uuid)') is not null)::text, 'true');
-- Sara, mai sollecitata; Marco ha il sollecito vecchio di Sandro (che non c'è più) e ora uno di Anna.
insert into persone (id, nome, cognome, ruolo, attiva) values ('cccccccc-0000-0000-0000-000000000003', 'Sara', 'Neri', 'iscritto', true);
select come('11111111-1111-1111-1111-111111111111', $$select segna_sollecito('cccccccc-0000-0000-0000-000000000001')::text$$);
select atteso('solo la segreteria legge l''elenco',
  matrice('select count(*) from ultimi_solleciti()'),
  'anna:ok ada:42501 sandro:42501 ivo:42501 maura:42501 luca:42501 senza:42501 tablet:42501 anon:42501');
select atteso('e solo lei toglie',
  matrice($q$select togli_sollecito('cccccccc-0000-0000-0000-000000000003')$q$),
  'anna:ok ada:42501 sandro:42501 ivo:42501 maura:42501 luca:42501 senza:42501 tablet:42501 anon:42501');
select atteso('authenticated le chiama, anon no (permessi)',
  (select string_agg(has_function_privilege('authenticated', p.oid, 'execute')::text || '/' || has_function_privilege('anon', p.oid, 'execute')::text, ' ' order by p.proname)
   from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('togli_sollecito', 'ultimi_solleciti')), 'true/false true/false');
select atteso('una riga per persona sollecitata, l''ultima, col nome di chi',
  come('11111111-1111-1111-1111-111111111111', $$select string_agg(persona_id::text || '=' || da, ',' order by persona_id) from ultimi_solleciti()$$),
  'cccccccc-0000-0000-0000-000000000001=Anna Segreteria');
select atteso('Annulla toglie l''ultimo di chi l''ha appena segnato',
  come('11111111-1111-1111-1111-111111111111', $$select togli_sollecito('cccccccc-0000-0000-0000-000000000001')::text$$), 'true');
select atteso('e torna quello di prima (senza nome: la scheda di chi l''ha segnato non c''è più)',
  come('11111111-1111-1111-1111-111111111111', $$select coalesce(string_agg(da, ','), 'nessuno') from ultimi_solleciti() where persona_id = 'cccccccc-0000-0000-0000-000000000001'$$), '');
select atteso('il sollecito di un altro non si toglie',
  come('11111111-1111-1111-1111-111111111111', $$select togli_sollecito('cccccccc-0000-0000-0000-000000000001')::text$$), 'false');
select atteso('una persona mai sollecitata: niente da togliere',
  come('11111111-1111-1111-1111-111111111111', $$select togli_sollecito('cccccccc-0000-0000-0000-000000000003')::text$$), 'false');
-- Dopo un quarto d'ora non è più un tasto sbagliato: resta.
select come('11111111-1111-1111-1111-111111111111', $$select segna_sollecito('cccccccc-0000-0000-0000-000000000003')::text$$);
update solleciti set creato_il = now() - interval '16 minutes' where persona_id = 'cccccccc-0000-0000-0000-000000000003';
select atteso('dopo un quarto d''ora il sollecito non si toglie più',
  come('11111111-1111-1111-1111-111111111111', $$select togli_sollecito('cccccccc-0000-0000-0000-000000000003')::text$$), 'false');

\echo ''
\echo 'solleciti: TUTTO A POSTO'
