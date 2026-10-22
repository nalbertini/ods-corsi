-- Il nucleo familiare sul database (99-nucleo.sql): `persone.nucleo` è il
-- titolare di una persona. Due livelli (il titolare non ha titolare), il
-- titolare è maggiorenne (senza data di nascita passa), e scrive solo la
-- segreteria: con le funzioni `metti_nel_nucleo`, `togli_dal_nucleo` e
-- `rendi_titolare`, o anche con un `update` diretto, che le stesse regole
-- (nessun ciclo, nessuna catena, nessuno titolare di sé) le tiene da solo.
-- Disattivare un titolare che ha ancora gente nel nucleo non si può; unire due
-- schede, cancellare un titolare, accogliere una richiesta fatta «per il
-- nucleo di» seguono le regole del nucleo.
-- La metà di prova: `cosaNonVaNucleo` e `nuovoTitolare` (src/lib/nucleo.ts) e
-- la segreteria di prova, in scripts/prova-nucleo.mjs: stessi casi, stessi
-- messaggi.
-- Si lancia dopo finto-supabase.sql e i file dello schema (il 99 compreso).
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

-- --- chi c'è ----------------------------------------------------------------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'maura@ods.it'),
  ('33333333-3333-3333-3333-333333333333', 'luca@ods.it'),
  ('44444444-4444-4444-4444-444444444444', 'ada@ods.it'),
  ('55555555-5555-5555-5555-555555555555', 'sala@sale.ods-corsi.it'),
  ('66666666-6666-6666-6666-666666666666', 'bea@ods.it');
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Maura', 'Istruttrice', 'istruttore', 'maura@ods.it', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Luca', 'Iscritto', 'iscritto', 'luca@ods.it', '33333333-3333-3333-3333-333333333333'),
  -- Cura i conti e insegna, ma non è della segreteria: il nucleo non è suo.
  ('aaaaaaaa-0000-0000-0000-000000000004', 'Ada', 'Conti', 'amministrazione', 'ada@ods.it', '44444444-4444-4444-4444-444444444444'),
  -- Segreteria che insegna anche: è segreteria, il nucleo lo scrive.
  ('aaaaaaaa-0000-0000-0000-000000000006', 'Bea', 'Banco', 'staff', 'bea@ods.it', '66666666-6666-6666-6666-666666666666'),
  -- Un istruttore senza accesso, mai in aula: si può eliminare.
  ('aaaaaaaa-0000-0000-0000-000000000033', 'Bruno', 'Istruttore', 'istruttore', null, null);
update persone set anche_istruttore = true where id in ('aaaaaaaa-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000006');
insert into sale (id, nome) values ('bbbbbbbb-0000-0000-0000-000000000001', 'Lotta');
insert into postazioni (id, nome, sala_id, utente_id) values
  ('dddddddd-0000-0000-0000-000000000001', 'Tablet Lotta', 'bbbbbbbb-0000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555555');
insert into corsi (id, nome) values ('cccccccc-0000-0000-0000-000000000001', 'Karate');

-- Gli iscritti. Adulti, minori, uno senza data di nascita, uno disattivato, e
-- i due che stanno a un giorno dai diciotto anni.
insert into persone (id, nome, cognome, ruolo, attiva) values
  ('aaaaaaaa-0000-0000-0000-000000000010', 'Marco', 'Rossi', 'iscritto', true),
  ('aaaaaaaa-0000-0000-0000-000000000011', 'Sara', 'Rossi', 'iscritto', true),
  ('aaaaaaaa-0000-0000-0000-000000000012', 'Gino', 'Rossi', 'iscritto', true),
  ('aaaaaaaa-0000-0000-0000-000000000013', 'Elena', 'Bianchi', 'iscritto', true),
  ('aaaaaaaa-0000-0000-0000-000000000014', 'Teo', 'Bianchi', 'iscritto', true),
  ('aaaaaaaa-0000-0000-0000-000000000015', 'Pia', 'Verdi', 'iscritto', true),
  ('aaaaaaaa-0000-0000-0000-000000000016', 'Ugo', 'Neri', 'iscritto', true),
  ('aaaaaaaa-0000-0000-0000-000000000017', 'Dora', 'Gialli', 'iscritto', false),
  ('aaaaaaaa-0000-0000-0000-000000000018', 'Gianni', 'Grigi', 'iscritto', true),
  ('aaaaaaaa-0000-0000-0000-000000000019', 'Rita', 'Blu', 'iscritto', true),
  ('aaaaaaaa-0000-0000-0000-000000000020', 'Lia', 'Rosa', 'iscritto', true),
  -- Per UNISCI.
  ('aaaaaaaa-0000-0000-0000-000000000021', 'Carlo', 'Uno', 'iscritto', true),
  ('aaaaaaaa-0000-0000-0000-000000000022', 'Dino', 'Due', 'iscritto', true),
  ('aaaaaaaa-0000-0000-0000-000000000023', 'Enzo', 'Tre', 'iscritto', true),
  ('aaaaaaaa-0000-0000-0000-000000000024', 'Fabio', 'Quattro', 'iscritto', true),
  ('aaaaaaaa-0000-0000-0000-000000000025', 'Gaia', 'Cinque', 'iscritto', true),
  ('aaaaaaaa-0000-0000-0000-000000000026', 'Hugo', 'Sei', 'iscritto', true),
  ('aaaaaaaa-0000-0000-0000-000000000027', 'Ivo', 'Sette', 'iscritto', true),
  -- Per cancellare un titolare.
  ('aaaaaaaa-0000-0000-0000-000000000030', 'Luigi', 'Trenta', 'iscritto', true),
  ('aaaaaaaa-0000-0000-0000-000000000031', 'Mara', 'Trentuno', 'iscritto', true),
  ('aaaaaaaa-0000-0000-0000-000000000032', 'Nino', 'Trentadue', 'iscritto', true),
  ('aaaaaaaa-0000-0000-0000-000000000034', 'Omar', 'Trentaquattro', 'iscritto', true),
  -- Per le richieste.
  ('aaaaaaaa-0000-0000-0000-000000000040', 'Pino', 'Quaranta', 'iscritto', true),
  ('aaaaaaaa-0000-0000-0000-000000000041', 'Rosa', 'Quarantuno', 'iscritto', true),
  ('aaaaaaaa-0000-0000-0000-000000000042', 'Sofia', 'Quarantadue', 'iscritto', true);
insert into anagrafiche (persona_id, nato_il) values
  ('aaaaaaaa-0000-0000-0000-000000000010', current_date - interval '45 years'),
  ('aaaaaaaa-0000-0000-0000-000000000011', current_date - interval '12 years'),
  ('aaaaaaaa-0000-0000-0000-000000000012', current_date - interval '9 years'),
  ('aaaaaaaa-0000-0000-0000-000000000013', current_date - interval '40 years'),
  ('aaaaaaaa-0000-0000-0000-000000000014', current_date - interval '10 years'),
  ('aaaaaaaa-0000-0000-0000-000000000016', current_date - interval '15 years'),
  ('aaaaaaaa-0000-0000-0000-000000000017', current_date - interval '30 years'),
  ('aaaaaaaa-0000-0000-0000-000000000018', current_date - interval '50 years'),
  -- Diciotto anni oggi: maggiorenne. Diciotto domani: ancora no.
  ('aaaaaaaa-0000-0000-0000-000000000019', current_date - interval '18 years'),
  ('aaaaaaaa-0000-0000-0000-000000000020', current_date - interval '18 years' + interval '1 day'),
  ('aaaaaaaa-0000-0000-0000-000000000030', current_date - interval '40 years'),
  ('aaaaaaaa-0000-0000-0000-000000000040', current_date - interval '35 years'),
  ('aaaaaaaa-0000-0000-0000-000000000041', current_date - interval '38 years');
-- Pia (15) non ha la data di nascita: titolare consentito.

-- Sara ha un corso e una ricevuta: togliendola dal nucleo non si toccano.
insert into iscrizioni (corso_id, persona_id, dal) values ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000011', current_date - 30);
insert into ricevute (anno, numero, data, persona_id, ente, intestatario, voci, totale, pagato)
  values (2026, 777, current_date, 'aaaaaaaa-0000-0000-0000-000000000011', '{}', '{}', '[{}]', 5000, 5000);

-- --- gli aiuti --------------------------------------------------------------
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
-- Il codice dell'errore, per dire «non hai il permesso» (42501) e non un'altra cosa.
create or replace function codice(sql text) returns text language plpgsql as $$
begin
  execute sql;
  return 'nessun errore';
exception when others then return sqlstate;
end $$;
-- Un rifiuto con un messaggio della funzione: se manca la funzione o la colonna, non vale.
create or replace function rifiuto(sql text) returns text language plpgsql as $$
begin
  execute sql;
  return 'nessun errore';
exception when others then
  if sqlstate in ('42883', '42501', '42P01', '42703', '42601') then return sqlstate || ': ' || sqlerrm; end if;
  return sqlerrm;
end $$;
-- Come `rifiuto`, per i rifiuti di cui non si guarda il testo.
create or replace function rifiuta(sql text) returns text language plpgsql as $$
begin
  execute sql;
  return 'nessun errore';
exception when others then
  if sqlstate in ('42883', '42501', '42P01', '42703', '42601') then return sqlstate || ': ' || sqlerrm; end if;
  return 'RIFIUTATO: …';
end $$;
create or replace function atteso(cosa text, avuto text, voluto text) returns text language plpgsql as $$
begin
  if avuto is distinct from voluto and not (voluto like '%…' and avuto like replace(voluto, '…', '%')) then
    raise exception '% · atteso «%», avuto «%»', cosa, voluto, avuto;
  end if;
  return 'ok  ' || cosa || ' → ' || avuto;
end $$;
-- Le persone per numero (le ultime due cifre dell'id).
create or replace function pid(n int) returns uuid language sql immutable as $$
  select ('aaaaaaaa-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;
-- Il nucleo di una persona, come numero del titolare; «-» se non ne ha.
create or replace function nucleo_di(n int) returns text language plpgsql security definer set search_path = public as $$
declare r text;
begin
  select coalesce(right(nucleo::text, 2), '-') into r from persone where id = pid(n);
  return coalesce(r, 'non c''è');
end $$;
-- Tutti i nuclei in una riga, e se uno è disattivato: per vedere che un rifiuto non ha toccato niente.
create or replace function impronta() returns text language plpgsql security definer set search_path = public as $$
declare r text;
begin
  select string_agg(right(id::text, 2) || '>' || coalesce(right(nucleo::text, 2), '-') || case when attiva then '' else '!' end, ' ' order by id)
    into r from persone where ruolo = 'iscritto';
  return r;
end $$;
create or replace function metti(p int, t int) returns text language sql as $$
  select rifiuto(format('select metti_nel_nucleo(%L, %L)', pid(p), pid(t)))
$$;
create or replace function togli(p int) returns text language sql as $$
  select rifiuto(format('select togli_dal_nucleo(%L)', pid(p)))
$$;
create or replace function rendi(p int) returns text language sql as $$
  select rifiuto(format('select rendi_titolare(%L)', pid(p)))
$$;
create or replace function azzera() returns void language plpgsql security definer set search_path = public as $$
begin update persone set nucleo = null; end $$;
grant execute on function chi(text), tenta(text), codice(text), rifiuto(text), rifiuta(text), atteso(text, text, text), pid(int), nucleo_di(int),
  impronta(), metti(int, int), togli(int), rendi(int) to anon, authenticated;

\echo ''
\echo '--- 0. com''è fatto ---'
select atteso('persone ha la colonna nucleo, un uuid',
  (select data_type from information_schema.columns where table_schema = 'public' and table_name = 'persone' and column_name = 'nucleo'), 'uuid');
select atteso('è una colonna vera, non calcolata (il backup la porta con la persona)',
  (select count(*)::text from pg_attribute where attrelid = 'public.persone'::regclass and attname = 'nucleo' and not attisdropped and attgenerated = ''), '1');
select atteso('punta a persone; se il titolare se ne va, il nucleo si svuota (on delete set null)',
  (select c.confdeltype::text from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and c.conrelid = 'public.persone'::regclass and c.confrelid = 'public.persone'::regclass and a.attname = 'nucleo'), 'n');
select atteso('nessuno nasce in un nucleo (e le famiglie vere partono vuote)',
  (select count(*)::text from persone where nucleo is not null), '0');
select atteso('le tre funzioni ci sono',
  (to_regprocedure('public.metti_nel_nucleo(uuid,uuid)') is not null and to_regprocedure('public.togli_dal_nucleo(uuid)') is not null
   and to_regprocedure('public.rendi_titolare(uuid)') is not null)::text, 'true');

\echo ''
\echo '--- 1. la segreteria mette nel nucleo ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('Sara entra nel nucleo di Marco', metti(11, 10), 'nessun errore');
select atteso('Gino anche', metti(12, 10), 'nessun errore');
select atteso('il nucleo di Marco: Sara e Gino; lui no', nucleo_di(11) || ' ' || nucleo_di(12) || ' ' || nucleo_di(10), '10 10 -');
select atteso('un titolare senza data di nascita passa (Pia)', metti(14, 15), 'nessun errore');
select atteso('diciotto anni oggi: maggiorenne, titolare', metti(18, 19), 'nessun errore');
select atteso('anche il suo nucleo si legge', nucleo_di(18), '19');
select atteso('la segreteria che insegna anche scrive lo stesso', (select tenta($$select 'x'$$)), 'x');
select chi('66666666-6666-6666-6666-666666666666');
select atteso('Bea (segreteria che insegna) mette Gianni nel nucleo di Marco? no, è già con Rita', metti(18, 10), 'È già nel nucleo di un altro: prima toglilo da lì');
select atteso('Bea mette Dino nel nucleo di Carlo', metti(22, 21), 'nessun errore');
select chi('11111111-1111-1111-1111-111111111111');

\echo ''
\echo '--- 2. cosa non entra (stesse regole e stessi messaggi di cosaNonVaNucleo) ---'
select impronta() as prima \gset
select atteso('una persona che non c''è', rifiuto(format('select metti_nel_nucleo(%L, %L)', gen_random_uuid(), pid(10))), 'Persona inesistente');
select atteso('un titolare che non c''è', rifiuto(format('select metti_nel_nucleo(%L, %L)', pid(20), gen_random_uuid())), 'Persona inesistente');
select atteso('non in sé stesso', metti(10, 10), 'Una persona non entra nel suo stesso nucleo');
select atteso('una scheda disattivata non entra', metti(17, 10), 'Le schede disattivate non entrano in un nucleo');
select atteso('né fa da titolare', metti(13, 17), 'Le schede disattivate non entrano in un nucleo');
select atteso('il titolare non è già nel nucleo di un altro', metti(13, 11), 'È già nel nucleo di un altro: scegli il titolare');
select atteso('non due volte nello stesso', metti(11, 10), 'È già in questo nucleo');
select atteso('non in un altro nucleo', metti(11, 13), 'È già nel nucleo di un altro: prima toglilo da lì');
select atteso('un titolare con altri dentro non entra in un altro', metti(10, 13), 'Ha un nucleo suo, con altri dentro: prima toglili, o fai titolare un altro');
select atteso('un minorenne non è titolare', metti(13, 16), 'Il titolare deve essere maggiorenne: scegli un adulto');
select atteso('nemmeno a un giorno dai diciotto anni', metti(13, 20), 'Il titolare deve essere maggiorenne: scegli un adulto');
select atteso('niente è cambiato', impronta(), :'prima');

\echo ''
\echo '--- 3. anche scrivendo la colonna a mano: nessun ciclo, nessuna catena ---'
select atteso('un adulto libero entra nel nucleo di Marco anche da solo (controllo)',
  tenta($$update persone set nucleo = 'aaaaaaaa-0000-0000-0000-000000000010' where id = 'aaaaaaaa-0000-0000-0000-000000000013'$$), 'FATTO (1 righe)');
select atteso('…e lo si toglie', tenta($$update persone set nucleo = null where id = 'aaaaaaaa-0000-0000-0000-000000000013'$$), 'FATTO (1 righe)');
select atteso('un minorenne non diventa titolare a mano', rifiuto($$update persone set nucleo = 'aaaaaaaa-0000-0000-0000-000000000016' where id = 'aaaaaaaa-0000-0000-0000-000000000013'$$), 'Il titolare deve essere maggiorenne: scegli un adulto');
select atteso('una scheda disattivata non fa da titolare a mano', rifiuto($$update persone set nucleo = 'aaaaaaaa-0000-0000-0000-000000000017' where id = 'aaaaaaaa-0000-0000-0000-000000000013'$$), 'Le schede disattivate non entrano in un nucleo');
select atteso('un istruttore non fa da titolare a mano', rifiuto($$update persone set nucleo = 'aaaaaaaa-0000-0000-0000-000000000002' where id = 'aaaaaaaa-0000-0000-0000-000000000013'$$), 'Persona inesistente');
select atteso('una scheda disattivata non entra a mano', rifiuto($$update persone set nucleo = 'aaaaaaaa-0000-0000-0000-000000000010' where id = 'aaaaaaaa-0000-0000-0000-000000000017'$$), 'Le schede disattivate non entrano in un nucleo');
select atteso('un istruttore non entra a mano', rifiuto($$update persone set nucleo = 'aaaaaaaa-0000-0000-0000-000000000010' where id = 'aaaaaaaa-0000-0000-0000-000000000033'$$), 'Persona inesistente');
select impronta() as prima \gset
select atteso('nessuno è titolare di sé stesso',
  rifiuta($$update persone set nucleo = id where id = 'aaaaaaaa-0000-0000-0000-000000000013'$$), 'RIFIUTATO: …');
select atteso('il titolare non ha un titolare (Sara è già con Marco)',
  rifiuta($$update persone set nucleo = 'aaaaaaaa-0000-0000-0000-000000000011' where id = 'aaaaaaaa-0000-0000-0000-000000000013'$$), 'RIFIUTATO: …');
select atteso('chi ha gente nel nucleo non entra in un altro',
  rifiuta($$update persone set nucleo = 'aaaaaaaa-0000-0000-0000-000000000013' where id = 'aaaaaaaa-0000-0000-0000-000000000010'$$), 'RIFIUTATO: …');
select atteso('niente cicli: Marco sotto Sara, che è sotto Marco',
  rifiuta($$update persone set nucleo = 'aaaaaaaa-0000-0000-0000-000000000011' where id = 'aaaaaaaa-0000-0000-0000-000000000010'$$), 'RIFIUTATO: …');
select atteso('niente catene lunghe: due righe in una volta',
  rifiuta($$update persone set nucleo = case id when 'aaaaaaaa-0000-0000-0000-000000000013' then 'aaaaaaaa-0000-0000-0000-000000000015' else 'aaaaaaaa-0000-0000-0000-000000000023' end
            where id in ('aaaaaaaa-0000-0000-0000-000000000013', 'aaaaaaaa-0000-0000-0000-000000000015')$$), 'RIFIUTATO: …');
select atteso('un titolare che non c''è non vale',
  rifiuta($$update persone set nucleo = gen_random_uuid() where id = 'aaaaaaaa-0000-0000-0000-000000000013'$$), 'RIFIUTATO: …');
select atteso('niente è cambiato', impronta(), :'prima');

\echo ''
\echo '--- 4. togliere dal nucleo ---'
select atteso('Sara esce', togli(11), 'nessun errore');
select atteso('è fuori dal nucleo e resta attiva', nucleo_di(11) || ' ' || (select attiva::text from persone where id = pid(11)), '- true');
select atteso('il suo corso c''è ancora', (select count(*)::text from iscrizioni where persona_id = pid(11) and al is null), '1');
select atteso('e la sua ricevuta, intera', (select count(*)::text || ' ' || sum(totale) || ' ' || sum(pagato) from ricevute where persona_id = pid(11)), '1 5000 5000');
select atteso('gli altri restano dove sono', nucleo_di(12), '10');
select atteso('chi non è nel nucleo di nessuno non si toglie', togli(11), 'Non è nel nucleo di nessuno');
select atteso('nemmeno un titolare', togli(10), 'Non è nel nucleo di nessuno');
select atteso('una persona che non c''è', rifiuto(format('select togli_dal_nucleo(%L)', gen_random_uuid())), 'Persona inesistente');

\echo ''
\echo '--- 5. cambiare titolare ---'
select atteso('Gianni esce dal nucleo di Rita, Sara e lui tornano da Marco', togli(18) || ' ' || metti(11, 10) || ' ' || metti(18, 10), 'nessun errore nessun errore nessun errore');
select atteso('Rita è titolare di Gianni: prima lo toglie', togli(18), 'nessun errore');
select atteso('chi non è nel nucleo di nessuno non diventa titolare', rendi(15), 'Non è nel nucleo di nessuno');
select atteso('un titolare nemmeno: è già titolare', rendi(10), 'Non è nel nucleo di nessuno');
select atteso('un minorenne non diventa titolare', rendi(12), 'Il titolare deve essere maggiorenne: scegli un adulto');
select impronta() as prima \gset
select atteso('Gianni, adulto, entra nel nucleo di Marco', metti(18, 10), 'nessun errore');
select atteso('Gianni diventa titolare', rendi(18), 'nessun errore');
select atteso('lui esce dal nucleo; Marco, Sara e Gino passano a lui',
  nucleo_di(18) || ' ' || nucleo_di(10) || ' ' || nucleo_di(11) || ' ' || nucleo_di(12), '- 18 18 18');
select atteso('nessuno ha più Marco come titolare', (select count(*)::text from persone where nucleo = pid(10)), '0');
select atteso('Rita, di prima, non c''entra', nucleo_di(19), '-');

\echo ''
\echo '--- 6. disattivare ---'
select atteso('il titolare con gente nel nucleo non si disattiva',
  tenta($$update persone set attiva = false where id = 'aaaaaaaa-0000-0000-0000-000000000018'$$), 'NEGATO: Prima cambia il titolare del nucleo');
select atteso('è ancora attivo', (select attiva::text from persone where id = pid(18)), 'true');
select atteso('un membro si disattiva come sempre',
  tenta($$update persone set attiva = false where id = 'aaaaaaaa-0000-0000-0000-000000000011'$$), 'FATTO (1 righe)');
select atteso('una scheda disattivata non diventa titolare', rendi(11), 'Le schede disattivate non entrano in un nucleo');
select atteso('e resta nel nucleo, come storia', nucleo_di(11), '18');
select atteso('ma da disattivata non si aggiunge a un altro', metti(11, 13), 'Le schede disattivate non entrano in un nucleo');
select atteso('chi non ha un nucleo si disattiva come sempre',
  tenta($$update persone set attiva = false where id = 'aaaaaaaa-0000-0000-0000-000000000016'$$), 'FATTO (1 righe)');
select atteso('Marco, ora membro, anche',
  tenta($$update persone set attiva = false where id = 'aaaaaaaa-0000-0000-0000-000000000010'$$), 'FATTO (1 righe)');
select atteso('Rita, titolare di nessuno, anche',
  tenta($$update persone set attiva = false where id = 'aaaaaaaa-0000-0000-0000-000000000019'$$), 'FATTO (1 righe)');
select atteso('riattivare è sempre libero',
  tenta($$update persone set attiva = true where id in ('aaaaaaaa-0000-0000-0000-000000000011', 'aaaaaaaa-0000-0000-0000-000000000010')$$), 'FATTO (2 righe)');
select atteso('svuotato il nucleo, anche il titolare si disattiva',
  togli(10) || ' ' || togli(11) || ' ' || togli(12) || ' ' || tenta($$update persone set attiva = false where id = 'aaaaaaaa-0000-0000-0000-000000000018'$$),
  'nessun errore nessun errore nessun errore FATTO (1 righe)');
reset role;
update persone set attiva = true where id = pid(18);
select azzera();

\echo ''
\echo '--- 7. UNISCI ---'
-- 21 Carlo è titolare di 22 Dino e 27 Ivo; 24 Fabio di 25 Gaia; 23 Enzo e 26 Hugo sono liberi.
update persone set nucleo = pid(21) where id in (pid(22), pid(27));
update persone set nucleo = pid(24) where id = pid(25);
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select impronta() as prima \gset
select atteso('chi va via è nel nucleo di un altro',
  rifiuto(format('select unisci_persone(%L, %L)', pid(23), pid(22))), 'Dino Due è nel nucleo familiare di un''altra persona: prima toglila dal nucleo');
select atteso('lo dice anche l''anteprima',
  rifiuto(format('select anteprima_unione(%L, %L)', pid(23), pid(22))), 'Dino Due è nel nucleo familiare di un''altra persona: prima toglila dal nucleo');
select atteso('chi va via è titolare con altri dentro',
  rifiuto(format('select unisci_persone(%L, %L)', pid(23), pid(24))), 'Fabio Quattro è titolare di un nucleo familiare: prima rendi titolare qualcun altro o togli gli altri dal nucleo');
select atteso('lo dice anche l''anteprima',
  rifiuto(format('select anteprima_unione(%L, %L)', pid(23), pid(24))), 'Fabio Quattro è titolare di un nucleo familiare: prima rendi titolare qualcun altro o togli gli altri dal nucleo');
select atteso('due dello stesso nucleo non si uniscono',
  rifiuto(format('select unisci_persone(%L, %L)', pid(22), pid(27))), 'Ivo Sette è nel nucleo familiare di un''altra persona: prima toglila dal nucleo');
select atteso('il titolare non assorbe un suo membro',
  rifiuto(format('select unisci_persone(%L, %L)', pid(21), pid(22))), 'Dino Due è nel nucleo familiare di un''altra persona: prima toglila dal nucleo');
select atteso('il membro non assorbe il suo titolare',
  rifiuto(format('select unisci_persone(%L, %L)', pid(22), pid(21))), 'Carlo Uno è titolare di un nucleo familiare: prima rendi titolare qualcun altro o togli gli altri dal nucleo');
select atteso('niente è cambiato, nessuna scheda è sparita', impronta(), :'prima');
select atteso('Enzo, libero, si unisce al titolare Carlo', rifiuto(format('select unisci_persone(%L, %L)', pid(21), pid(23))), 'nessun errore');
select atteso('Hugo, libero, si unisce al membro Dino', rifiuto(format('select unisci_persone(%L, %L)', pid(22), pid(26))), 'nessun errore');
select atteso('le due schede libere non ci sono più', nucleo_di(23) || ' ' || nucleo_di(26), 'non c''è non c''è');
select atteso('Dino è ancora nel nucleo di Carlo', nucleo_di(22), '21');
select atteso('nessuno ha come titolare una scheda sparita',
  (select count(*)::text from persone p where p.nucleo is not null and not exists (select 1 from persone t where t.id = p.nucleo)), '0');
reset role;
select azzera();

\echo ''
\echo '--- 8. chi si cancella: i suoi tornano senza nucleo ---'
update persone set nucleo = pid(30) where id in (pid(31), pid(32));
-- Bruno era iscritto e titolare, poi è passato a istruttore: il suo nucleo resta, e sparendo lui Omar torna libero.
update persone set ruolo = 'iscritto' where id = pid(33);
update persone set nucleo = pid(33) where id = pid(34);
update persone set ruolo = 'istruttore' where id = pid(33);
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria cancella un titolare iscritto', tenta($$delete from persone where id = 'aaaaaaaa-0000-0000-0000-000000000030'$$), 'FATTO (1 righe)');
select atteso('i suoi due tornano senza nucleo', nucleo_di(31) || ' ' || nucleo_di(32), '- -');
select atteso('e sono ancora iscritti', (select count(*)::text from persone where id in (pid(31), pid(32)) and ruolo = 'iscritto'), '2');
select atteso('elimina_istruttore: Bruno se ne va', rifiuto(format('select elimina_istruttore(%L)', pid(33))), 'nessun errore');
select atteso('Omar torna senza nucleo', nucleo_di(34), '-');
select atteso('nessun riferimento orfano',
  (select count(*)::text from persone p where p.nucleo is not null and not exists (select 1 from persone t where t.id = p.nucleo)), '0');
reset role;

\echo ''
\echo '--- 9. una richiesta fatta per il nucleo di qualcuno ---'
-- Sofia (42) è nel nucleo di Rosa (41): Rosa ha un nucleo suo, con altri dentro.
update persone set nucleo = pid(41) where id = pid(42);
insert into richieste_iscrizione (id, nome, cognome, nato_il, nato_a, codice_fiscale, indirizzo, cap, comune, email, telefono, corsi, formula, regolamento, nucleo_di) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'Tina', 'Nuova', current_date - interval '8 years', 'Torino', 'NVUTNI18A41L219A', 'Via Roma 1', '10093', 'Collegno',
   'tina@esempio.it', '347 111 2233', array['cccccccc-0000-0000-0000-000000000001']::uuid[], 'annuale', true, 'aaaaaaaa-0000-0000-0000-000000000040'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'Pino', 'Quaranta', current_date - interval '35 years', 'Torino', 'QRNPNI90A01L219B', 'Via Roma 1', '10093', 'Collegno',
   'pino@esempio.it', '347 111 2233', array['cccccccc-0000-0000-0000-000000000001']::uuid[], 'annuale', true, 'aaaaaaaa-0000-0000-0000-000000000040'),
  ('eeeeeeee-0000-0000-0000-000000000003', 'Rosa', 'Quarantuno', current_date - interval '38 years', 'Torino', 'QRNRSO87A41L219C', 'Via Roma 1', '10093', 'Collegno',
   'rosa@esempio.it', '347 111 2233', array['cccccccc-0000-0000-0000-000000000001']::uuid[], 'annuale', true, 'aaaaaaaa-0000-0000-0000-000000000040');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('accolta, la persona nuova entra nel nucleo di chi l''ha aggiunta',
  tenta($$select (accogli_iscrizione('eeeeeeee-0000-0000-0000-000000000001') is not null)::text$$), 'true');
select atteso('è nel nucleo di Pino', (select right(nucleo::text, 2) from persone where nome = 'Tina' and cognome = 'Nuova'), '40');
select atteso('Pino accolto sulla sua scheda: l''accoglimento riesce',
  tenta($$select (accogli_iscrizione('eeeeeeee-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000040') = 'aaaaaaaa-0000-0000-0000-000000000040')::text$$), 'true');
select atteso('ma non entra nel suo stesso nucleo', nucleo_di(40), '-');
select atteso('Rosa ha un nucleo suo con altri dentro: accolta, e resta titolare',
  tenta($$select (accogli_iscrizione('eeeeeeee-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000041') = 'aaaaaaaa-0000-0000-0000-000000000041')::text$$), 'true');
select atteso('Rosa non è entrata nel nucleo di Pino, e Sofia è ancora sua', nucleo_di(41) || ' ' || nucleo_di(42), '- 41');
reset role;

-- Una scheda che c'era già (Lia) non si sposta con una richiesta: la scrive chi
-- manda il modulo, anche senza accesso, e la segreteria non vede il nucleo_di.
insert into richieste_iscrizione (id, nome, cognome, nato_il, nato_a, codice_fiscale, indirizzo, cap, comune, email, telefono, corsi, formula, regolamento, nucleo_di) values
  ('eeeeeeee-0000-0000-0000-000000000004', 'Lia', 'Rosa', current_date - interval '30 years', 'Torino', 'RSOLIA94A41L219D', 'Via Roma 1', '10093', 'Collegno',
   'lia@esempio.it', '347 111 2233', array['cccccccc-0000-0000-0000-000000000001']::uuid[], 'annuale', true, 'aaaaaaaa-0000-0000-0000-000000000040');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('Lia accolta sulla sua scheda: l''accoglimento riesce',
  tenta($$select (accogli_iscrizione('eeeeeeee-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000020') = 'aaaaaaaa-0000-0000-0000-000000000020')::text$$), 'true');
select atteso('ma una scheda che c''era già non cambia nucleo da una richiesta', nucleo_di(20), '-');
reset role;

-- Il modulo manda nucleo_di di un altro: vale solo se è chi ha fatto l'accesso.
create or replace function modulo_nucleo(nome text, cognome text, nucleo uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare nato date := current_date - interval '30 years';
begin
  return jsonb_build_object('nome', nome, 'cognome', cognome, 'nato_il', nato, 'nato_a', 'Torino',
    'codice_fiscale', (select x || cf_controllo(x) from (select cf_lettere(nome, cognome) || to_char(nato, 'YY') || substr('ABCDEHLMPRST', extract(month from nato)::int, 1) || lpad(extract(day from nato)::int::text, 2, '0') || 'L219' as x) q),
    'indirizzo', 'Via Roma 1', 'cap', '10093', 'comune', 'Collegno', 'email', lower(nome) || '@esempio.it', 'telefono', '347 111 2233',
    'corsi', jsonb_build_array('cccccccc-0000-0000-0000-000000000001'), 'formula', 'annuale', 'regolamento', true, 'nucleo_di', nucleo);
end $$;
grant execute on function modulo_nucleo(text, text, uuid) to anon, authenticated;
select chi('');
set role anon;
select atteso('senza accesso, il nucleo_di di un altro non resta sulla richiesta',
  tenta($$select (invia_iscrizione(modulo_nucleo('Zeno', 'Anonimo', 'aaaaaaaa-0000-0000-0000-000000000040')) is not null)::text$$), 'true');
reset role;
select atteso('la richiesta di Zeno non ha nucleo_di', (select coalesce(nucleo_di::text, '-') from richieste_iscrizione where nome = 'Zeno'), '-');
select azzera();

\echo ''
\echo '--- 10. chi non è della segreteria non scrive il nucleo, e non lo legge ---'
update persone set nucleo = pid(10) where id = pid(11);
create or replace function porte() returns text language plpgsql as $f$
begin
  return codice($$select metti_nel_nucleo('aaaaaaaa-0000-0000-0000-000000000012', 'aaaaaaaa-0000-0000-0000-000000000010')$$) || ' '
      || codice($$select togli_dal_nucleo('aaaaaaaa-0000-0000-0000-000000000011')$$) || ' '
      || codice($$select rendi_titolare('aaaaaaaa-0000-0000-0000-000000000011')$$);
end $f$;
create or replace function conta_iscritti() returns text language sql security definer set search_path = public as $$ select count(*)::text from persone where ruolo = 'iscritto' $$;
grant execute on function porte(), conta_iscritti() to anon, authenticated;

select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('un istruttore non chiama le funzioni', porte(), '42501 42501 42501');
select atteso('né scrive la colonna',
  (tenta($$update persone set nucleo = null where id = 'aaaaaaaa-0000-0000-0000-000000000011'$$) in ('a vuoto (0 righe)') or
   tenta($$update persone set nucleo = null where id = 'aaaaaaaa-0000-0000-0000-000000000011'$$) like 'NEGATO: permission denied%')::text, 'true');
-- decisione dell'utente: la policy è per riga, il personale legge tutte le colonne di persone
select atteso('il nucleo lo legge come le altre colonne di persone', (tenta($$select count(nucleo)::text from persone$$) ~ '^[0-9]+$')::text, 'true');
select atteso('le persone le legge come prima', tenta($$select count(*)::text from persone where ruolo = 'iscritto'$$), conta_iscritti());
reset role;
select atteso('il nucleo di Sara non si è mosso', nucleo_di(11), '10');

select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('un tablet non chiama le funzioni', porte(), '42501 42501 42501');
-- decisione dell'utente: la policy è per riga, il personale legge tutte le colonne di persone
select atteso('il nucleo lo legge come le altre colonne di persone', (tenta($$select count(nucleo)::text from persone$$) ~ '^[0-9]+$')::text, 'true');
reset role;

select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('amministrazione che insegna anche, ma non è segreteria: no', porte(), '42501 42501 42501');
-- decisione dell'utente: la policy è per riga, il personale legge tutte le colonne di persone
select atteso('il nucleo lo legge come le altre colonne di persone', (tenta($$select count(nucleo)::text from persone$$) ~ '^[0-9]+$')::text, 'true');
reset role;

select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('un iscritto con l''accesso non scrive il nucleo', porte(), '42501 42501 42501');
reset role;

select chi('');
set role anon;
select atteso('chi non ha fatto l''accesso non chiama le funzioni', porte(), '42501 42501 42501');
select atteso('né legge il nucleo', tenta($$select count(nucleo)::text from persone$$), 'NEGATO: permission denied…');
reset role;
select atteso('il nucleo di Sara non si è mosso', nucleo_di(11), '10');

\echo ''
\echo 'TUTTO A POSTO'
