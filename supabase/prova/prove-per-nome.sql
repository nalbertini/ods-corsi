-- Chi è venuto a provare, dal tablet: il database dà solo chi somiglia a
-- quel che si scrive, con almeno una parola di tre lettere, al massimo venti
-- e al massimo cento ricerche in dieci minuti per tablet, così chi passa
-- davanti al tablet non scarica l'elenco intero (34-prove-per-nome.sql). Le
-- regole di somiglianza sono quelle di `somiglianti` in src/lib/prove.ts.
-- Si lancia dopo tablet.sql e prove.sql, di cui usa persone, tablet e PIN,
-- Marco (provato al Judo, telefono 333), Vito (91 giorni fa) e Dora (disattivata).
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';
reset role;

-- prove.sql prova i PIN sbagliati: si riparte senza blocchi.
delete from tentativi_pin;

\echo ''
\echo '--- 1. il tablet della Lotta cerca per nome ---'
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('«mar» trova solo Marco, senza telefono',
  (select string_agg(nome || ' ' || coalesce(telefono, '-'), ', ') from provati_con_pin('4321', 'mar')), 'Marco -');
select atteso('«nuo», dal cognome, lo trova', (select string_agg(nome, ' ') from provati_con_pin('4321', 'nuo')), 'Marco');
-- Lo spazio indivisibile e quello invisibile, da un copia e incolla, sono spazi come in JavaScript.
select atteso('«mar» e «nuo» staccati da uno spazio indivisibile (U+00A0)',
  (select string_agg(nome, ' ') from provati_con_pin('4321', 'mar' || chr(160) || 'nuo')), 'Marco');
select atteso('e da uno spazio invisibile (U+FEFF)',
  (select string_agg(nome, ' ') from provati_con_pin('4321', 'mar' || chr(65279) || 'nuo')), 'Marco');
reset role;
select atteso('provati_con_pin col solo PIN non c''è più', (select coalesce(to_regprocedure('provati_con_pin(text)')::text, 'nessuna')), 'nessuna');

\echo ''
\echo '--- 2. senza una parola di almeno tre lettere, nessuno e nessun errore ---'
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('«ma»', tenta($$select count(*)::text from provati_con_pin('4321', 'ma')$$), '0');
select atteso('«m n»: due lettere fra nome e cognome', tenta($$select count(*)::text from provati_con_pin('4321', 'm n')$$), '0');
select atteso('niente scritto', tenta($$select count(*)::text from provati_con_pin('4321', '')$$), '0');
select atteso('solo spazi', tenta($$select count(*)::text from provati_con_pin('4321', '   ')$$), '0');
select atteso('null', tenta($$select count(*)::text from provati_con_pin('4321', null)$$), '0');
select atteso('apostrofi e trattini non sono lettere', tenta($$select count(*)::text from provati_con_pin('4321', $q$'’-ʼ‘´$q$)$$), '0');
select atteso('«d''a»: due lettere e un apostrofo', tenta($$select count(*)::text from provati_con_pin('4321', 'd''a')$$), '0');
select atteso('«m n o»: tre lettere, ma nessuna parola di tre', tenta($$select count(*)::text from provati_con_pin('4321', 'm n o')$$), '0');
select atteso('«mar n» sì: «mar» è una parola di tre', (select string_agg(nome, ' ') from provati_con_pin('4321', 'mar n')), 'Marco');
-- Più di cento caratteri non è un nome: niente, e nessun errore.
select atteso('cento caratteri si cercano', (select string_agg(nome, ' ') from provati_con_pin('4321', 'mar' || repeat(' ', 94) || 'nuo')), 'Marco');
select atteso('centouno no', tenta($$select count(*)::text from provati_con_pin('4321', 'mar' || repeat(' ', 95) || 'nuo')$$), '0');
select atteso('né mille', tenta($$select count(*)::text from provati_con_pin('4321', 'mar' || repeat(' ', 994) || 'nuo')$$), '0');
reset role;

\echo ''
\echo '--- 3. apostrofi, trattini e accenti, come somiglianti ---'
-- Una lezione di Lotta 2 di tre giorni fa, con sei che hanno provato.
insert into sessioni (id, corso_id, inizio, fine) values
  ('eeeeeeee-0000-0000-0000-000000000030', 'cccccccc-0000-0000-0000-000000000001', now() - interval '3 days', now() - interval '3 days' + interval '1 hour');
insert into persone (id, nome, cognome, ruolo) values
  ('ffffffff-0000-0000-0000-000000000031', 'Paolo', 'D''Amico', 'iscritto'),
  ('ffffffff-0000-0000-0000-000000000032', 'Sara', 'D’Amico', 'iscritto'),
  ('ffffffff-0000-0000-0000-000000000033', 'Gina', 'Damico', 'iscritto'),
  ('ffffffff-0000-0000-0000-000000000034', 'Anna', 'De-Luca', 'iscritto'),
  ('ffffffff-0000-0000-0000-000000000035', 'Rita', 'Deluca', 'iscritto'),
  ('ffffffff-0000-0000-0000-000000000036', 'Ugo', 'Damiani', 'iscritto');
-- Chi trova, per nome di battesimo (sono tutti diversi), in ordine alfabetico.
create or replace function trova(scritto text) returns text language sql as $$
  select coalesce(string_agg(nome, ' ' order by nome), '') from provati_con_pin('4321', scritto)
$$;
grant execute on function trova(text) to authenticated;
insert into prove (sessione_id, persona_id)
  select 'eeeeeeee-0000-0000-0000-000000000030', id from persone where id::text like 'ffffffff-0000-0000-0000-00000000003_';
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('«d''am» trova i D''Amico, Damico e Damiani', trova('d''am'), 'Gina Paolo Sara Ugo');
select atteso('«d’am» (apostrofo tipografico) trova lo stesso', trova('d’am'), 'Gina Paolo Sara Ugo');
select atteso('«dʼam», «d‘am» e «d´am» trovano lo stesso', trova('dʼam') || '|' || trova('d‘am') || '|' || trova('d´am'),
  'Gina Paolo Sara Ugo|Gina Paolo Sara Ugo|Gina Paolo Sara Ugo');
select atteso('i trattini lunghi ‐ – — staccano come quello corto (nomi.ts)', trova('d‐am') || '|' || trova('d–am') || '|' || trova('d—am'),
  'Gina Paolo Sara Ugo|Gina Paolo Sara Ugo|Gina Paolo Sara Ugo');
select atteso('un segno diacritico fuori dai soliti (U+1DC4) non conta, come \p{M} in nomi.ts', trova('dam' || chr(7620) || 'ico'), 'Gina Paolo Sara');
select atteso('«damico» trova i D''Amico e Damico, non Damiani', trova('damico'), 'Gina Paolo Sara');
select atteso('«amico» trova i due D''Amico', trova('amico'), 'Paolo Sara');
select atteso('«de luca» trova De-Luca e Deluca', trova('de luca'), 'Anna Rita');
select atteso('«deluca» anche', trova('deluca'), 'Anna Rita');
select atteso('«DÉLUCA», maiuscolo e accentato, anche', trova('DÉLUCA'), 'Anna Rita');
select atteso('«d''amico gin» trova solo Gina Damico', trova('d''amico gin'), 'Gina');
select atteso('«luca» trova De-Luca, non Deluca (come somiglianti)', trova('luca'), 'Anna');
-- Serve almeno una parola di tre lettere: tante parole corte non bastano.
select atteso('«d d d» nessuno', trova('d d d'), '');
select atteso('«a a a» nessuno', trova('a a a'), '');
select atteso('«de l» nessuno', trova('de l'), '');
select atteso('«de lu» nessuno', trova('de lu'), '');
select atteso('«de luc» trova De-Luca e Deluca', trova('de luc'), 'Anna Rita');

\echo ''
\echo '--- 4. % _ e \ sono lettere, non jolly ---'
select atteso('«%%%»', tenta($$select count(*)::text from provati_con_pin('4321', '%%%')$$), '0');
select atteso('«___»', tenta($$select count(*)::text from provati_con_pin('4321', '___')$$), '0');
select atteso('«\\\»', tenta($$select count(*)::text from provati_con_pin('4321', '\\\')$$), '0');
select atteso('«d%o»', tenta($$select count(*)::text from provati_con_pin('4321', 'd%o')$$), '0');
select atteso('«da_i»', tenta($$select count(*)::text from provati_con_pin('4321', 'da_i')$$), '0');

\echo ''
\echo '--- 5. chi non deve, e chi non si cerca più ---'
select atteso('PIN sbagliato: nessuno', (select count(*)::text from provati_con_pin('0000', 'mar')), '0');
select atteso('Vito, provato 91 giorni fa, no', (select count(*)::text from provati_con_pin('4321', 'vito lontano')), '0');
select atteso('Dora, disattivata, no', (select count(*)::text from provati_con_pin('4321', 'dora spenta')), '0');
reset role;
delete from tentativi_pin;
select chi('22222222-2222-2222-2222-222222222222');  -- Maura, dall'app
set role authenticated;
select atteso('chi non è un tablet no', tenta($$select count(*)::text from provati_con_pin('4321', 'mar')$$), 'NEGATO: solo un tablet di sala');
reset role;
select chi('');
set role anon;
select atteso('senza accesso no', tenta($$select count(*)::text from provati_con_pin('4321', 'mar')$$), 'NEGATO: permission denied for function provati_con_pin');
reset role;

\echo ''
\echo '--- 6. al massimo venti, i più recenti ---'
-- Venticinque Zeno, ognuno a una lezione di Lotta 2 di 1, 2, … 25 giorni fa.
insert into sessioni (id, corso_id, inizio, fine)
  select ('eeeeeeee-0000-0000-0001-' || lpad(n::text, 12, '0'))::uuid, 'cccccccc-0000-0000-0000-000000000001',
         now() - n * interval '1 day', now() - n * interval '1 day' + interval '1 hour'
  from generate_series(1, 25) n;
insert into persone (id, nome, cognome, ruolo)
  select ('ffffffff-0000-0000-0001-' || lpad(n::text, 12, '0'))::uuid, 'Zeno', 'Numero ' || n, 'iscritto'
  from generate_series(1, 25) n;
insert into prove (sessione_id, persona_id)
  select ('eeeeeeee-0000-0000-0001-' || lpad(n::text, 12, '0'))::uuid, ('ffffffff-0000-0000-0001-' || lpad(n::text, 12, '0'))::uuid
  from generate_series(1, 25) n;
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('«zen» ne dà venti', (select count(*)::text from provati_con_pin('4321', 'zen')), '20');
select atteso('i più recenti, dal più recente: giorni fa',
  (select string_agg(extract(day from now() - inizio)::int::text, ' ') from provati_con_pin('4321', 'zen')),
  '1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20');
reset role;

\echo ''
\echo '--- 7. al massimo cento ricerche in dieci minuti per tablet ---'
-- Chi prova tutte le combinazioni di tre lettere col PIN giusto si ferma.
-- Lo prova il tablet del Tatami, che finora non ha cercato niente.
create or replace function cerca_volte(volte int) returns text language plpgsql as $$
declare trovati int := 0; n int;
begin
  for i in 1..volte loop
    select count(*) into n from provati_con_pin('4321', 'mar');
    trovati := trovati + n;
  end loop;
  return trovati::text;
end $$;
create or replace function codice(sql text) returns text language plpgsql as $$
begin execute sql; return 'nessun errore';
exception when others then return sqlstate;
end $$;
grant execute on function cerca_volte(int), codice(text) to authenticated;
delete from tentativi_pin;
select chi('55555555-5555-5555-5555-555555555555');  -- il tablet del Tatami
set role authenticated;
select atteso('cento ricerche rispondono, e trovano Marco', tenta($$select cerca_volte(100)$$), '100');
select atteso('la centounesima no', tenta($$select count(*)::text from provati_con_pin('4321', 'mar')$$), 'NEGATO: troppe ricerche: riprova fra qualche minuto');
select atteso('con un errore di permesso', codice($$select count(*) from provati_con_pin('4321', 'mar')$$), '42501');
select atteso('il tablet non legge le ricerche', tenta($$select count(*)::text from ricerche_prove$$), 'NEGATO: permission denied for table ricerche_prove');
select atteso('non le cancella', tenta($$delete from ricerche_prove$$), 'NEGATO: permission denied for table ricerche_prove');
select atteso('non ne aggiunge', tenta($$insert into ricerche_prove (postazione_id, quando) values ('dddddddd-0000-0000-0000-000000000002', now() - interval '1 hour')$$),
  'NEGATO: permission denied for table ricerche_prove');
reset role;
select chi('66666666-6666-6666-6666-666666666666');  -- il tablet della Lotta
set role authenticated;
select atteso('un altro tablet cerca ancora', (select string_agg(nome, ' ') from provati_con_pin('4321', 'mar')), 'Marco');
reset role;

\echo '--- 8. e al massimo trecento in un giorno ---'
-- Le ricerche dell'ultima ora contano, quelle di ieri no: si scrivono a mano,
-- da proprietario, perché il tablet non scrive in ricerche_prove.
select chi('66666666-6666-6666-6666-666666666666');
delete from ricerche_prove where postazione_id = postazione_corrente();
insert into ricerche_prove (postazione_id, quando)
  select postazione_corrente(), now() - interval '1 hour' from generate_series(1, 299);
insert into ricerche_prove (postazione_id, quando)
  select postazione_corrente(), now() - interval '25 hours' from generate_series(1, 50);
set role authenticated;
select atteso('la trecentesima del giorno risponde', (select string_agg(nome, ' ') from provati_con_pin('4321', 'mar')), 'Marco');
select atteso('la trecentounesima no', tenta($$select count(*)::text from provati_con_pin('4321', 'mar')$$), 'NEGATO: troppe ricerche: riprova fra qualche minuto');
reset role;
select chi('22222222-2222-2222-2222-222222222222');  -- Maura, dall'app
set role authenticated;
select atteso('l''istruttore non legge le ricerche', tenta($$select count(*)::text from ricerche_prove$$), 'NEGATO: permission denied for table ricerche_prove');
reset role;
select chi('');
set role anon;
select atteso('anon nemmeno', tenta($$select count(*)::text from ricerche_prove$$), 'NEGATO: permission denied for table ricerche_prove');
reset role;

\echo ''
\echo 'Le prove per nome: tutto come previsto.'
