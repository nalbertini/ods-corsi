-- «Pagato nel vecchio programma» (71-pagato-vecchio-programma.sql): la lettura che dice, per la stagione corrente
-- (dal 1 settembre al 31 luglio, a Roma), quali incassi dello storico importato (`origine_import like 'prima-nota:%'`,
-- entrate non annullate sulle voci «Quota associativa» e «Corsi e altri pagamenti») ci sono, e di chi: `persona_id`
-- è la persona a cui il movimento è collegato (70-movimenti-persona.sql), vuoto se non lo è ancora. La funzione
-- `incassi_vecchio_programma()` rende (persona_id, data, importo, voce), SOLO LETTURA: non scrive niente.
-- Se importo e soglia della quota (50 €) siano «quota» o «da guardare» lo decide l'app (src/lib/pagatoPrima.ts).
-- La vede la segreteria (ruolo staff): amministrazione senza segreteria, istruttori, tablet, iscritti e anon no,
-- come `storico_persona` ma senza l'amministrazione (qui si mostra l'elenco di tutte le persone).
-- Le stesse regole di src/lib/pagatoPrima.ts e della modalità prova, provate da scripts/prova-pagato-prima.mjs.
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
select atteso('70-movimenti-persona.sql è stato lanciato: serve la colonna persona_id',
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'movimenti' and column_name = 'persona_id')::text, 'true');
select atteso('71-pagato-vecchio-programma.sql è stato lanciato: c''è incassi_vecchio_programma()',
  (to_regprocedure('public.incassi_vecchio_programma()') is not null)::text, 'true');

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
create or replace function pid(n int) returns uuid language sql immutable as $$ select ('cccccccc-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid $$;
create or replace function id_cassa(n text) returns uuid language sql stable security definer set search_path = public as $$ select id from casse where nome = n $$;
create or replace function id_voce(n text, t text) returns uuid language sql stable security definer set search_path = public as $$
  select id from voci_contabili where nome = n and tipo::text = t $$;
grant execute on function atteso(text, text, text), come(text, text), esito(text), matrice(text), pid(int), id_cassa(text), id_voce(text, text) to anon, authenticated;

\echo ''
\echo '--- 1. chi può: la segreteria, e nessun altro ---'
select atteso('solo chi ha il ruolo staff (Anna, Sandro): amministrazione senza segreteria, istruttori, tablet, iscritti, senza scheda e anon no',
  matrice('select count(*) from incassi_vecchio_programma()'),
  'anna:ok ada:42501 sandro:ok ivo:42501 maura:42501 luca:42501 senza:42501 tablet:42501 anon:42501');
select atteso('authenticated la chiama, anon no (permessi)',
  (select has_function_privilege('authenticated', p.oid, 'execute')::text || '/' || has_function_privilege('anon', p.oid, 'execute')::text
   from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'incassi_vecchio_programma'), 'true/false');

\echo ''
\echo '--- 2. i dati: la stagione di oggi (dal 1 settembre al 31 luglio) e quella di prima ---'
-- S = `inizio()` è il 1 settembre di questa stagione; le date si scrivono come giorni da S, così la prova vale in ogni mese.
create or replace function inizio() returns date language sql stable as $$
  select make_date(extract(year from (now() at time zone 'Europe/Rome'))::int - case when extract(month from (now() at time zone 'Europe/Rome')) >= 9 then 0 else 1 end, 9, 1) $$;
-- L'ultimo giorno: il 31 luglio, undici mesi meno un giorno dopo S, in giorni da S.
create or replace function ultimo() returns int language sql stable as $$ select (inizio() + interval '11 months' - interval '1 day')::date - inizio() $$;
insert into persone (id, nome, cognome, ruolo, attiva) values
  (pid(1), 'Clio', 'Tatone', 'iscritto', true),
  (pid(2), 'Elia', 'Moretti', 'iscritto', true),
  (pid(3), 'Marta', 'Esposito', 'iscritto', true),
  (pid(4), 'Paolo', 'Ferri', 'iscritto', true),
  (pid(5), 'Sara', 'Villa', 'iscritto', true);
insert into voci_contabili (nome, tipo) values ('Merchandising', 'entrata');
select id as voce_uscita from voci_contabili where tipo = 'uscita' limit 1 \gset
create or replace function mov(n int, giorni int, importo int, voce uuid, persona uuid, tipo text default 'entrata', origine text default null, annullato boolean default false) returns void
  language sql security definer set search_path = public as $$
  insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione, origine_import, persona_id, annullato_il)
  values (tipo, inizio() + giorni, importo, voce, id_cassa('Conto Corrente'), 'Cliente prova ' || n,
          coalesce(origine, 'prima-nota:' || n), persona, case when annullato then now() end) $$;
-- Dentro la stagione, collegati: Clio quota 50 € il giorno 27 (il 28/09); Elia corsi 310 € il 10; Marta 30 € di quota il 13.
select mov(1, 27, 5000, id_voce('Quota associativa', 'entrata'), pid(1));
select mov(2, 10, 31000, id_voce('Corsi e altri pagamenti', 'entrata'), pid(2));
select mov(3, 13, 3000, id_voce('Quota associativa', 'entrata'), pid(3));
-- Il confine: il 1 settembre e il 31 luglio entrano, il 31 agosto prima e il 1 agosto dopo no.
select mov(4, 0, 5000, id_voce('Quota associativa', 'entrata'), pid(4));
select mov(5, ultimo(), 5100, id_voce('Quota associativa', 'entrata'), pid(5));
select mov(6, -1, 5000, id_voce('Quota associativa', 'entrata'), pid(4));
select mov(7, ultimo() + 1, 5000, id_voce('Quota associativa', 'entrata'), pid(5));
-- Fuori: la stagione scorsa, annullato, un'uscita, un movimento scritto a mano, un'altra voce.
select mov(8, -300, 5000, id_voce('Quota associativa', 'entrata'), pid(1));
select mov(9, 20, 5000, id_voce('Quota associativa', 'entrata'), pid(2), annullato => true);
select mov(10, 20, 5000, :'voce_uscita'::uuid, pid(2), tipo => 'uscita');
select mov(11, 20, 5000, id_voce('Quota associativa', 'entrata'), pid(2), origine => 'a-mano');
select mov(12, 20, 5000, (select id from voci_contabili where nome = 'Merchandising'), pid(2));
-- Non collegato: non ha una persona, ma c'è in lettura (serve a contare gli incassi ancora da collegare).
select mov(13, 15, 5000, id_voce('Quota associativa', 'entrata'), null);
select mov(14, 16, 12500, id_voce('Corsi e altri pagamenti', 'entrata'), null);
-- Il movimento a mano non ha origine: non è lo storico.
update movimenti set origine_import = null where origine_import = 'a-mano';

-- Una riga: «persona/giorni da S/importo/voce», la persona è l'ultimo numero dell'id, «-» se vuota.
create or replace function lettura(u text) returns text language sql as $$
  select come(u, $q$select coalesce(string_agg(coalesce(right(persona_id::text, 2)::int::text, '-') || '/' || (data - inizio())
    || '/' || importo || '/' || voce, ' ' order by data, importo, persona_id), 'niente') from incassi_vecchio_programma()$q$) $$;
grant execute on function lettura(text), inizio(), ultimo() to anon, authenticated;

\echo ''
\echo '--- 3. cosa rende: gli incassi dello storico della stagione, collegati o no ---'
select atteso('entrano: i tre in stagione, il 1 settembre, il 31 luglio, e i due non collegati; restano fuori il 31 agosto prima, il 1 agosto dopo, la stagione scorsa, l''annullato, l''uscita, il movimento a mano e l''altra voce',
  lettura('11111111-1111-1111-1111-111111111111'),
  '4/0/5000/Quota associativa 2/10/31000/Corsi e altri pagamenti 3/13/3000/Quota associativa -/15/5000/Quota associativa -/16/12500/Corsi e altri pagamenti 1/27/5000/Quota associativa 5/'
  || ultimo()::text || '/5100/Quota associativa');
select atteso('Sandro (segreteria e amministrazione) vede lo stesso', lettura('33333333-3333-3333-3333-333333333333'), lettura('11111111-1111-1111-1111-111111111111'));

\echo ''
\echo '--- 4. sola lettura: non cambia niente ---'
select md5(coalesce(string_agg(m::text, '|' order by m.id), '')) as prima from movimenti m \gset
select lettura('11111111-1111-1111-1111-111111111111') is not null as l \gset
select atteso('i movimenti sono gli stessi dopo la lettura', (select md5(coalesce(string_agg(m::text, '|' order by m.id), '')) from movimenti m), :'prima');
select atteso('la funzione non scrive: è stabile (stable), non volatile', (select provolatile::text from pg_proc where proname = 'incassi_vecchio_programma'), 's');
