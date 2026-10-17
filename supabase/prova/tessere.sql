-- Le tessere: chi è tesserato, con quale ente e fino a quando. Le legge e le
-- scrive solo la segreteria; l'import dal RASD aggancia per codice fiscale E
-- stesso nome, non crea persone e non fa doppioni; l'incrocio dice chi, fra gli
-- iscritti a un corso che chiede la tessera, non ce l'ha valida, e chi è
-- tesserato senza un corso; l'unione di due schede porta le tessere con sé
-- anche quando la stessa è su tutte e due.
-- Si lancia dopo finto-supabase.sql, i file dello schema,
-- 18-anagrafiche.sql, 29-unisci-doppioni.sql e 55-tessere.sql.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'maura@ods.it'),
  ('33333333-3333-3333-3333-333333333333', 'luca@ods.it'),
  ('66666666-6666-6666-6666-666666666666', 'lotta@sale.ods-corsi.it');
insert into persone (id, nome, cognome, ruolo, email, utente_id, attiva) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', 'anna@ods.it', '11111111-1111-1111-1111-111111111111', true),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Maura', 'Uno', 'istruttore', 'maura@ods.it', '22222222-2222-2222-2222-222222222222', true),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Luca', 'Rossi', 'iscritto', 'luca@ods.it', '33333333-3333-3333-3333-333333333333', true),
  -- Chi è tesserato e iscritto, in regola.
  ('aaaaaaaa-0000-0000-0000-000000000010', 'Mario', 'Rossi', 'iscritto', null, null, true),
  -- Il nome con l'accento: il RASD scrive «GULLI' ANNA».
  ('aaaaaaaa-0000-0000-0000-000000000011', 'Anna', 'Gullì', 'iscritto', null, null, true),
  -- Iscritto che non ha mai avuto una tessera.
  ('aaaaaaaa-0000-0000-0000-000000000012', 'Luigi', 'Verdi', 'iscritto', null, null, true),
  -- Iscritta a un corso che non chiede la tessera.
  ('aaaaaaaa-0000-0000-0000-000000000013', 'Sara', 'Neri', 'iscritto', null, null, true),
  -- Una scheda vecchia, archiviata: non si segnala.
  ('aaaaaaaa-0000-0000-0000-000000000014', 'Piero', 'Archiviato', 'iscritto', null, null, false),
  -- È venuta a provare una lezione di Judo: una prova non è un'iscrizione.
  ('aaaaaaaa-0000-0000-0000-000000000015', 'Elena', 'Prova', 'iscritto', null, null, true),
  -- Tesserato senza un corso.
  ('aaaaaaaa-0000-0000-0000-000000000016', 'Marco', 'Tesserato', 'iscritto', null, null, true),
  -- Iscritto alla lotta dal 20 ottobre: il 17 non lo è ancora.
  ('aaaaaaaa-0000-0000-0000-000000000017', 'Dario', 'Prossimo', 'iscritto', null, null, true),
  -- Due schede della stessa persona, con la stessa tessera sulle due.
  ('aaaaaaaa-0000-0000-0000-000000000020', 'Teo', 'Doppio', 'iscritto', null, null, true),
  ('aaaaaaaa-0000-0000-0000-000000000021', 'Teo', 'Doppio', 'iscritto', null, null, true);
insert into anagrafiche (persona_id, codice_fiscale) values
  ('aaaaaaaa-0000-0000-0000-000000000010', 'RSSMRA10A01L219X'),
  ('aaaaaaaa-0000-0000-0000-000000000011', 'GLLNNA80A41L219X'),
  ('aaaaaaaa-0000-0000-0000-000000000012', 'VRDLGU85B01L219Y'),
  ('aaaaaaaa-0000-0000-0000-000000000016', 'TSSMRC70C01L219Z'),
  ('aaaaaaaa-0000-0000-0000-000000000020', 'DPPTEO90D01L219W');

insert into sale (id, nome) values ('bbbbbbbb-0000-0000-0000-000000000001', 'Tatami');
insert into corsi (id, nome, sala_id, ente_tessera) values
  ('cccccccc-0000-0000-0000-000000000001', 'Judo 3', 'bbbbbbbb-0000-0000-0000-000000000001', 'FIJLKAM'),
  ('cccccccc-0000-0000-0000-000000000002', 'Lotta 2', 'bbbbbbbb-0000-0000-0000-000000000001', 'FIJLKAM'),
  ('cccccccc-0000-0000-0000-000000000003', 'Pesi agonisti', 'bbbbbbbb-0000-0000-0000-000000000001', 'FIPE'),
  ('cccccccc-0000-0000-0000-000000000004', 'Psicomotricità', 'bbbbbbbb-0000-0000-0000-000000000001', null);
insert into iscrizioni (corso_id, persona_id, dal, al) values
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000010', '2026-09-14', null),
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000011', '2026-09-14', null),
  ('cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000011', '2026-09-14', null),
  ('cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000012', '2026-09-14', null),
  ('cccccccc-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000013', '2026-09-14', null),
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000014', '2025-09-14', null),
  ('cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000017', '2026-10-20', null),
  ('cccccccc-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000020', '2026-09-14', null);
-- Una prova di Judo: la lezione, e la persona che ci viene.
insert into sessioni (id, corso_id, inizio, fine, stato) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', '2026-10-12 18:00+02', '2026-10-12 19:00+02', 'svolta');
insert into prove (sessione_id, persona_id) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000015');
-- Anna Gullì aveva una tessera dell'anno scorso, già scaduta.
insert into tessere (persona_id, ente, tipo, codice, dal, al, origine) values
  ('aaaaaaaa-0000-0000-0000-000000000011', 'FIJLKAM', 'praticante', '2025-0456', '2025-09-01', '2025-12-31', 'manuale');

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
create or replace function atteso(cosa text, avuto text, voluto text) returns text language plpgsql as $$
begin
  if avuto is distinct from voluto and not (voluto like '%…' and avuto like replace(voluto, '…', '%')) then
    raise exception '% · atteso «%», avuto «%»', cosa, voluto, avuto;
  end if;
  return 'ok  ' || cosa || ' → ' || avuto;
end $$;
grant execute on function tenta(text), codice(text), atteso(text, text, text), chi(text) to anon, authenticated;

-- L'incrocio in una riga leggibile: «persona/ente/esito», in ordine.
create or replace function incrocio(oggi date) returns text language sql as $$
  select coalesce(string_agg(p.cognome || '/' || i.ente || '/' || i.esito, ', ' order by p.cognome, i.ente, i.esito), '')
    from incrocio_tessere(oggi) i join persone p on p.id = i.persona_id
$$;
grant execute on function incrocio(date) to authenticated;

-- Il foglio del RASD, già tradotto come lo manda l'app (una riga per tessera).
create or replace function foglio() returns jsonb language sql as $$
select '[
  {"ente":"FIJLKAM","nome":"ROSSI MARIO","codice_fiscale":"RSSMRA10A01L219X","tipo":"agonista","codice":"2026-0123","dal":"2026-09-01","al":"2026-12-31"},
  {"ente":"fijlkam ","nome":"GULLI'' ANNA","codice_fiscale":"gllnna80a41l219x","tipo":"praticante","codice":"2026-0777","dal":"2026-09-01","al":"2026-12-31"},
  {"ente":"FIJLKAM","nome":"Tesserato Marco","codice_fiscale":"TSSMRC70C01L219Z","tipo":"agonista","codice":"2026-0900","dal":"2026-09-01","al":"2026-12-31"},
  {"ente":"FIJLKAM","nome":"ROSSI GIANNI","codice_fiscale":"RSSMRA10A01L219X","tipo":"praticante","codice":"2026-0500","dal":"2026-09-01","al":"2026-12-31"},
  {"ente":"FIPE","nome":"BIANCHI SILVIA","codice_fiscale":"BNCSLV90E41L219V","tipo":"praticante","codice":"2026-0600","dal":"2026-09-01","al":"2026-12-31"},
  {"ente":"FIJLKAM","nome":"ROSSI MARIO","codice_fiscale":"RSSMRA10A01L219X","tipo":"agonista","codice":"2026-0123","dal":"2026-09-01","al":"2026-12-31"},
  {"ente":"FIJLKAM","nome":"ROSSI MARIO","codice_fiscale":"RSSMRA10A01L219X","tipo":"arbitro","codice":"2026-0124","dal":"2026-09-01","al":"2026-12-31"},
  {"ente":"FIJLKAM","nome":"ROSSI MARIO","codice_fiscale":"RSSMRA10A01L219X","tipo":"praticante","codice":"2026-0125","dal":"2026-09-01","al":"2026-08-31"}
]'::jsonb
$$;
grant execute on function foglio() to authenticated;

\echo ''
\echo '--- 1. l''import: anteprima e scrittura ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('l''anteprima conta: 3 nuove (la riga doppia una volta sola), 2 non abbinate, 2 non valide',
  tenta($$select (importa_tessere(foglio(), true) - 'non_abbinate')::text$$),
  '{"nuove": 3, "scritto": false, "gia_presenti": 1}');
select atteso('e non scrive niente', (select count(*)::text from tessere where origine = 'rasd'), '0');
select atteso('i motivi: nome diverso, nessuna scheda, riga non valida',
  (select string_agg(e ->> 'esito', ',' order by e ->> 'esito', e ->> 'nome')
     from jsonb_array_elements(importa_tessere(foglio(), true) -> 'non_abbinate') e),
  'nessuna_scheda,nome_diverso,riga_non_valida,riga_non_valida');
select atteso('scrive le tre nuove', tenta($$select (importa_tessere(foglio(), false) ->> 'nuove')$$), '3');
select atteso('sono dell''RASD, con l''ente in maiuscolo e il codice fiscale in maiuscolo',
  (select string_agg(p.cognome || ' ' || t.ente || ' ' || t.tipo || ' ' || t.codice, ', ' order by p.cognome)
     from tessere t join persone p on p.id = t.persona_id where t.origine = 'rasd'),
  'Gullì FIJLKAM praticante 2026-0777, Rossi FIJLKAM agonista 2026-0123, Tesserato FIJLKAM agonista 2026-0900');
select atteso('scritte da chi ha importato', (select count(*)::text from tessere where creata_da = 'aaaaaaaa-0000-0000-0000-000000000001'), '3');
select atteso('lo stesso foglio di nuovo non crea doppioni',
  tenta($$select (importa_tessere(foglio(), false) - 'non_abbinate')::text$$),
  '{"nuove": 0, "scritto": true, "gia_presenti": 4}');
select atteso('sempre tre tessere dell''RASD', (select count(*)::text from tessere where origine = 'rasd'), '3');
select atteso('un foglio che non è un elenco no', tenta($$select importa_tessere('{"a": 1}'::jsonb)::text$$), 'NEGATO: …');
select atteso('più di 2000 righe no',
  tenta($$select importa_tessere((select jsonb_agg('{}'::jsonb) from generate_series(1, 2001)))::text$$), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 2. chi non è della segreteria non vede e non importa ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('un istruttore non legge le tessere', (select count(*)::text from tessere), '0');
select atteso('non ne scrive', tenta($$insert into tessere (persona_id, ente, tipo, codice, dal, al) values ('aaaaaaaa-0000-0000-0000-000000000012', 'FIJLKAM', 'praticante', 'x', '2026-09-01', '2026-12-31')$$), 'NEGATO: …');
select atteso('non importa', codice($$select importa_tessere('[]'::jsonb, true)$$), '42501');
select atteso('non fa l''incrocio', codice($$select * from incrocio_tessere('2026-10-17')$$), '42501');
reset role;
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('un iscritto non le legge', (select count(*)::text from tessere), '0');
select atteso('non importa', codice($$select importa_tessere('[]'::jsonb, true)$$), '42501');
select atteso('non fa l''incrocio', codice($$select * from incrocio_tessere('2026-10-17')$$), '42501');
reset role;
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('il tablet non le legge', (select count(*)::text from tessere), '0');
select atteso('né importa', codice($$select importa_tessere('[]'::jsonb, true)$$), '42501');
reset role;
select chi('');
set role anon;
select atteso('anon non legge la tabella', codice($$select count(*) from tessere$$), '42501');
select atteso('anon non importa', codice($$select importa_tessere('[]'::jsonb, true)$$), '42501');
select atteso('anon non fa l''incrocio', codice($$select * from incrocio_tessere('2026-10-17')$$), '42501');
reset role;
select atteso('anon non esegue importa', has_function_privilege('anon', 'importa_tessere(jsonb, boolean)', 'execute')::text, 'false');
select atteso('anon non esegue incrocio', has_function_privilege('anon', 'incrocio_tessere(date)', 'execute')::text, 'false');
select atteso('anon non legge la tabella (permessi)', has_table_privilege('anon', 'tessere', 'select')::text, 'false');

\echo ''
\echo '--- 3. la segreteria scrive a mano, con le regole ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('una tessera a mano', tenta($$insert into tessere (persona_id, ente, tipo, codice, dal, al) values ('aaaaaaaa-0000-0000-0000-000000000014', 'FIPE', 'praticante', 'M-1', '2026-09-01', '2026-12-31')$$), 'FATTO (1 righe)');
select atteso('è scritta "manuale"', (select origine from tessere where codice = 'M-1'), 'manuale');
select atteso('la stessa due volte no', tenta($$insert into tessere (persona_id, ente, tipo, codice, dal, al) values ('aaaaaaaa-0000-0000-0000-000000000014', 'FIPE', 'praticante', 'M-2', '2026-09-01', '2026-12-31')$$), 'NEGATO: …');
select atteso('l''ente in minuscolo no', tenta($$insert into tessere (persona_id, ente, tipo, codice, dal, al) values ('aaaaaaaa-0000-0000-0000-000000000014', 'fipe', 'agonista', 'M-3', '2026-09-01', '2026-12-31')$$), 'NEGATO: …');
select atteso('un tipo che non c''è no', tenta($$insert into tessere (persona_id, ente, tipo, codice, dal, al) values ('aaaaaaaa-0000-0000-0000-000000000014', 'FIPE', 'arbitro', 'M-4', '2026-09-01', '2026-12-31')$$), 'NEGATO: …');
select atteso('una fine prima dell''inizio no', tenta($$insert into tessere (persona_id, ente, tipo, codice, dal, al) values ('aaaaaaaa-0000-0000-0000-000000000014', 'FIPE', 'agonista', 'M-5', '2026-09-01', '2026-08-31')$$), 'NEGATO: …');
select atteso('un codice vuoto no', tenta($$insert into tessere (persona_id, ente, tipo, codice, dal, al) values ('aaaaaaaa-0000-0000-0000-000000000014', 'FIPE', 'agonista', '  ', '2026-09-01', '2026-12-31')$$), 'NEGATO: …');
select atteso('la toglie', tenta($$delete from tessere where codice = 'M-1'$$), 'FATTO (1 righe)');
select atteso('un corso chiede una tessera', tenta($$update corsi set ente_tessera = 'FIJLKAM' where nome = 'Psicomotricità'$$), 'FATTO (1 righe)');
select atteso('in minuscolo no', tenta($$update corsi set ente_tessera = 'fipe' where nome = 'Psicomotricità'$$), 'NEGATO: …');
select atteso('e la toglie', tenta($$update corsi set ente_tessera = null where nome = 'Psicomotricità'$$), 'FATTO (1 righe)');
reset role;

\echo ''
\echo '--- 4. l''incrocio ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
-- 17 ottobre: Mario e Anna (FIJLKAM, scadenza 31/12 oltre i 60 giorni) sono a posto.
-- Anna ha la tessera nuova; Luigi non ha mai avuto niente; Marco Tesserato è
-- tesserato senza un corso; Teo (Pesi, FIPE) non ha una tessera FIPE.
select atteso('il 17 ottobre', incrocio('2026-10-17'),
  'Doppio/FIPE/manca, Tesserato/FIJLKAM/non_iscritto, Verdi/FIJLKAM/manca');
select atteso('Luigi manca per Lotta 2', (select corsi from incrocio_tessere('2026-10-17') i join persone p on p.id = i.persona_id where p.cognome = 'Verdi'), 'Lotta 2');
select atteso('una prova non è un''iscrizione: Elena non si segnala', (select count(*)::text from incrocio_tessere('2026-10-17') i where i.persona_id = 'aaaaaaaa-0000-0000-0000-000000000015'), '0');
select atteso('un corso senza tessera non segnala: Sara no', (select count(*)::text from incrocio_tessere('2026-10-17') i where i.persona_id = 'aaaaaaaa-0000-0000-0000-000000000013'), '0');
select atteso('una scheda archiviata no: Piero', (select count(*)::text from incrocio_tessere('2026-10-17') i where i.persona_id = 'aaaaaaaa-0000-0000-0000-000000000014'), '0');
select atteso('chi si iscrive fra qualche giorno no: Dario', (select count(*)::text from incrocio_tessere('2026-10-17') i where i.persona_id = 'aaaaaaaa-0000-0000-0000-000000000017'), '0');
select atteso('dal 20 ottobre Dario manca anche lui', incrocio('2026-10-20'),
  'Doppio/FIPE/manca, Prossimo/FIJLKAM/manca, Tesserato/FIJLKAM/non_iscritto, Verdi/FIJLKAM/manca');
select atteso('esattamente 60 giorni prima della fine: già in scadenza', incrocio('2026-11-01'),
  'Doppio/FIPE/manca, Gullì/FIJLKAM/in_scadenza, Prossimo/FIJLKAM/manca, Rossi/FIJLKAM/in_scadenza, Tesserato/FIJLKAM/non_iscritto, Verdi/FIJLKAM/manca');
-- 10 novembre: mancano meno di 60 giorni al 31/12 (oggi + 60 = 9 gennaio).
select atteso('il 10 novembre le due che finiscono a dicembre sono in scadenza', incrocio('2026-11-10'),
  'Doppio/FIPE/manca, Gullì/FIJLKAM/in_scadenza, Prossimo/FIJLKAM/manca, Rossi/FIJLKAM/in_scadenza, Tesserato/FIJLKAM/non_iscritto, Verdi/FIJLKAM/manca');
select atteso('il 31 ottobre ancora no (60 giorni dopo è il 30 dicembre)', incrocio('2026-10-31'), 'Doppio/FIPE/manca, Prossimo/FIJLKAM/manca, Tesserato/FIJLKAM/non_iscritto, Verdi/FIJLKAM/manca');
-- 15 gennaio 2027: la tessera dell'anno scorso è scaduta.
select atteso('a gennaio: scadute', incrocio('2027-01-15'),
  'Doppio/FIPE/manca, Gullì/FIJLKAM/scaduta, Prossimo/FIJLKAM/manca, Rossi/FIJLKAM/scaduta, Verdi/FIJLKAM/manca');
-- Un rinnovo già fatto (tessera dell'anno dopo) basta, anche se non è ancora cominciata.
reset role;
insert into tessere (persona_id, ente, tipo, codice, dal, al, origine) values
  ('aaaaaaaa-0000-0000-0000-000000000010', 'FIJLKAM', 'agonista', '2027-0001', '2027-01-01', '2027-12-31', 'manuale');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('il rinnovo già fatto: a novembre Mario non è più in scadenza', incrocio('2026-11-10'),
  'Doppio/FIPE/manca, Gullì/FIJLKAM/in_scadenza, Prossimo/FIJLKAM/manca, Tesserato/FIJLKAM/non_iscritto, Verdi/FIJLKAM/manca');
reset role;
delete from tessere where codice = '2027-0001';
-- Una tessera da dirigente non copre chi pratica, e un dirigente senza corso non è un errore.
insert into persone (id, nome, cognome, ruolo) values
  ('aaaaaaaa-0000-0000-0000-000000000030', 'Dina', 'Dirigente', 'iscritto'),
  ('aaaaaaaa-0000-0000-0000-000000000031', 'Tullio', 'Tecnico', 'iscritto');
insert into iscrizioni (corso_id, persona_id, dal) values ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000030', '2026-09-14');
insert into tessere (persona_id, ente, tipo, codice, dal, al) values
  ('aaaaaaaa-0000-0000-0000-000000000030', 'FIJLKAM', 'dirigente', 'D-1', '2026-09-01', '2026-12-31'),
  ('aaaaaaaa-0000-0000-0000-000000000031', 'FIJLKAM', 'tecnico', 'D-2', '2026-09-01', '2026-12-31');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('una tessera da dirigente non copre chi si iscrive a Judo: manca', (select string_agg(esito, ',') from incrocio_tessere('2026-10-17') where persona_id = 'aaaaaaaa-0000-0000-0000-000000000030'), 'manca');
select atteso('un tecnico senza corso non è un «non iscritto»', (select count(*)::text from incrocio_tessere('2026-10-17') where persona_id = 'aaaaaaaa-0000-0000-0000-000000000031'), '0');
reset role;
delete from tessere where codice in ('D-1', 'D-2');
delete from persone where id in ('aaaaaaaa-0000-0000-0000-000000000030', 'aaaaaaaa-0000-0000-0000-000000000031');

\echo ''
\echo '--- 4b. gli stessi casi della prova dell''app ---'
insert into persone (id, nome, cognome, ruolo) values
  ('aaaaaaaa-0000-0000-0000-000000000040', 'Hans', 'Müller', 'iscritto'),
  ('aaaaaaaa-0000-0000-0000-000000000041', 'José', 'Núñez', 'iscritto'),
  ('aaaaaaaa-0000-0000-0000-000000000042', 'Ali', 'Çelik', 'iscritto');
insert into anagrafiche (persona_id, codice_fiscale) values
  ('aaaaaaaa-0000-0000-0000-000000000040', 'MLLHNS85A01L219X'),
  ('aaaaaaaa-0000-0000-0000-000000000041', 'NNZJSO85A01L219X'),
  ('aaaaaaaa-0000-0000-0000-000000000042', 'CLKLIA85A01L219X'),
  -- Un istruttore con il codice fiscale: non è una scheda da iscritto.
  ('aaaaaaaa-0000-0000-0000-000000000002', 'MRAUNO80A01L219X');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('con le dieresi, le tilde e la cediglia il nome si ritrova (come nell''app)',
  (importa_tessere('[
    {"ente":"FIJLKAM","nome":"MULLER HANS","codice_fiscale":"MLLHNS85A01L219X","tipo":"praticante","codice":"U-1","dal":"2026-09-01","al":"2026-12-31"},
    {"ente":"FIJLKAM","nome":"NUNEZ JOSE","codice_fiscale":"NNZJSO85A01L219X","tipo":"praticante","codice":"U-2","dal":"2026-09-01","al":"2026-12-31"},
    {"ente":"FIJLKAM","nome":"CELIK ALI","codice_fiscale":"CLKLIA85A01L219X","tipo":"praticante","codice":"U-3","dal":"2026-09-01","al":"2026-12-31"}]'::jsonb, true) ->> 'nuove'), '3');
select atteso('un istruttore con il codice fiscale non è una scheda da iscritto',
  (importa_tessere('[{"ente":"FIJLKAM","nome":"UNO MAURA","codice_fiscale":"MRAUNO80A01L219X","tipo":"praticante","codice":"U-4","dal":"2026-09-01","al":"2026-12-31"}]'::jsonb, true) -> 'non_abbinate' -> 0 ->> 'esito'), 'nessuna_scheda');
select atteso('una data che non c''è, o scritta all''italiana, non entra',
  (select string_agg(e ->> 'esito', ',') from jsonb_array_elements(importa_tessere('[
    {"ente":"FIJLKAM","nome":"MULLER HANS","codice_fiscale":"MLLHNS85A01L219X","tipo":"praticante","codice":"U-5","dal":"2026-02-30","al":"2026-12-31"},
    {"ente":"FIJLKAM","nome":"MULLER HANS","codice_fiscale":"MLLHNS85A01L219X","tipo":"praticante","codice":"U-6","dal":"01/09/2026","al":"2026-12-31"}]'::jsonb, true) -> 'non_abbinate') e), 'riga_non_valida,riga_non_valida');
reset role;
-- Una scheda archiviata con una tessera che vale: non è un «tesserato senza corso».
update persone set attiva = false where id = 'aaaaaaaa-0000-0000-0000-000000000040';
insert into tessere (persona_id, ente, tipo, codice, dal, al) values ('aaaaaaaa-0000-0000-0000-000000000040', 'FIJLKAM', 'praticante', 'U-7', '2026-09-01', '2026-12-31');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('una scheda archiviata con la tessera valida non è «non iscritto»', (select count(*)::text from incrocio_tessere('2026-10-17') where persona_id = 'aaaaaaaa-0000-0000-0000-000000000040'), '0');
reset role;
delete from tessere where codice = 'U-7';

\echo ''
\echo '--- 5. unire due schede porta le tessere, anche la stessa su tutte e due ---'
-- Teo ha la stessa tessera FIJLKAM sulle due schede; la seconda ha anche una FIPE.
insert into tessere (id, persona_id, ente, tipo, codice, dal, al, origine) values
  ('99999999-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000020', 'FIJLKAM', 'praticante', 'T-1', '2026-09-01', '2026-12-31', 'rasd'),
  ('99999999-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000021', 'FIJLKAM', 'praticante', 'T-1', '2026-09-01', '2026-12-31', 'rasd'),
  ('99999999-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000021', 'FIPE', 'praticante', 'T-2', '2026-09-01', '2026-12-31', 'manuale');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('l''unione va in porto', codice($$select unisci_persone('aaaaaaaa-0000-0000-0000-000000000020', 'aaaaaaaa-0000-0000-0000-000000000021')$$), 'nessun errore');
reset role;
select atteso('la scheda che se ne va non c''è più', (select count(*)::text from persone where id = 'aaaaaaaa-0000-0000-0000-000000000021'), '0');
select atteso('restano due tessere, tutte di chi resta',
  (select string_agg(ente || ' ' || tipo, ', ' order by ente) from tessere where persona_id = 'aaaaaaaa-0000-0000-0000-000000000020'), 'FIJLKAM praticante, FIPE praticante');
select atteso('e quella doppia è la prima, non la seconda',
  (select id::text from tessere where persona_id = 'aaaaaaaa-0000-0000-0000-000000000020' and ente = 'FIJLKAM'), '99999999-0000-0000-0000-000000000001');
select atteso('nessuna tessera è rimasta orfana', (select count(*)::text from tessere where persona_id not in (select id from persone)), '0');
delete from persone where id = 'aaaaaaaa-0000-0000-0000-000000000020';
select atteso('cancellata la scheda, via le tessere', (select count(*)::text from tessere where id::text like '99999999%'), '0');

\echo ''
\echo '--- 6. i corsi che c''erano prima: la mappa si scrive una volta sola ---'
-- Si rifà la colonna come sul database vero, con corsi coi nomi veri, e si rilancia il file.
alter table corsi drop column ente_tessera;
delete from corsi;
insert into corsi (id, nome) values
  ('cccccccc-0000-0000-0000-000000000011', 'Judo adulti'),
  ('cccccccc-0000-0000-0000-000000000012', 'Lotta 3'),
  ('cccccccc-0000-0000-0000-000000000013', 'Aikido 2'),
  ('cccccccc-0000-0000-0000-000000000014', 'MGA ragazzi'),
  ('cccccccc-0000-0000-0000-000000000015', 'Avviamento arti marziali 1'),
  ('cccccccc-0000-0000-0000-000000000016', 'Pesi agonisti'),
  ('cccccccc-0000-0000-0000-000000000017', 'Pesistica e Mobility'),
  ('cccccccc-0000-0000-0000-000000000018', 'Preparazione atletica, pesi e Mobility'),
  ('cccccccc-0000-0000-0000-000000000019', 'Giocomotricità'),
  ('cccccccc-0000-0000-0000-00000000001a', 'Psicomotricità'),
  ('cccccccc-0000-0000-0000-00000000001b', 'Prepugilistica');
\i supabase/55-tessere.sql
select atteso('FIJLKAM: Judo, Lotta, Aikido, MGA, Avviamento',
  (select string_agg(nome, ', ' order by nome) from corsi where ente_tessera = 'FIJLKAM'),
  'Aikido 2, Avviamento arti marziali 1, Judo adulti, Lotta 3, MGA ragazzi');
select atteso('FIPE: la sala Pesi',
  (select string_agg(nome, ', ' order by nome) from corsi where ente_tessera = 'FIPE'),
  'Pesi agonisti, Pesistica e Mobility, Preparazione atletica, pesi e Mobility');
select atteso('nessuna: Giocomotricità, Psicomotricità, Prepugilistica',
  (select string_agg(nome, ', ' order by nome) from corsi where ente_tessera is null),
  'Giocomotricità, Prepugilistica, Psicomotricità');
-- La segreteria toglie la tessera a Judo adulti; un secondo lancio del file non la rimette.
update corsi set ente_tessera = null where nome = 'Judo adulti';
\i supabase/55-tessere.sql
select atteso('rilanciato il file, la scelta della segreteria resta',
  (select ente_tessera is null from corsi where nome = 'Judo adulti')::text, 'true');
