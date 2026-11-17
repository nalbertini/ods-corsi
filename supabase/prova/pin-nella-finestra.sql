-- Il PIN del tablet e la finestra delle lezioni: `segna_con_pin`,
-- `aggiungi_prova_con_pin` e `segna_prova_con_pin` scrivono l'appello solo di una
-- lezione che comincia fra i 14 giorni indietro e la mezz'ora avanti
-- (`lezione_nella_finestra`, 52-presenze-finestra.sql: la stessa di `elenco_sala`).
-- Fuori, rispondono con un errore (42501) che manda alla segreteria e non scrivono
-- niente: né presenze, né prove, né persone, né la presenza dell'istruttore che il
-- trigger `istruttore_dall_appello` ne ricaverebbe e che conta per i compensi.
-- Un PIN sbagliato resta `false`, contato fra i tentativi, come sempre.
-- Si lancia dopo tablet.sql, di cui usa persone, sala, tablet e il PIN di Maura
-- (4321), e dopo i file dello schema fino a 145-doppio-turno.sql.
-- Le lezioni sono messe attorno ad adesso, ognuna con i suoi iscritti e la sua
-- prova, così nessun segno ne nasconde un altro (`presente_altrove`, 145). I bordi
-- stanno a un minuto dalla soglia, mai al secondo, perché la prova non sia instabile.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';
reset role;
select chi('');
delete from tentativi_pin;

-- Gli indirizzi di ogni caso `n`: la lezione, l'iscritto, la prova già lì, la persona nuova.
create or replace function sess(n int) returns uuid language sql immutable as $$
  select format('eeeeeeee-0000-0000-0000-0000000002%s', lpad(n::text, 2, '0'))::uuid $$;
create or replace function iscritto(n int) returns uuid language sql immutable as $$
  select format('aaaaaaaa-0000-0000-0000-0000000002%s', lpad(n::text, 2, '0'))::uuid $$;
create or replace function prova_di(n int) returns uuid language sql immutable as $$
  select format('ffffffff-0000-0000-0000-0000000002%s', lpad(n::text, 2, '0'))::uuid $$;
create or replace function nuova(n int) returns uuid language sql immutable as $$
  select format('ffffffff-0000-0000-0000-0000000003%s', lpad(n::text, 2, '0'))::uuid $$;

delete from sessioni where id::text like 'eeeeeeee-0000-0000-0000-0000000002%';
delete from persone where id::text like 'aaaaaaaa-0000-0000-0000-0000000002%' or id::text like 'ffffffff-0000-0000-0000-0000000002%'
  or id::text like 'ffffffff-0000-0000-0000-0000000003%';
-- Un corso solo per questa prova, nella sala del tablet della Lotta; Maura lo insegna,
-- quindi la sua presenza, se nasce, è «confermata».
insert into corsi (id, nome, sala_id, istruttore_id) values
  ('cccccccc-0000-0000-0000-000000000021', 'Lotta PIN', 'bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002')
  on conflict (id) do nothing;
insert into corsi_istruttori (corso_id, persona_id) values
  ('cccccccc-0000-0000-0000-000000000021', 'aaaaaaaa-0000-0000-0000-000000000002')
  on conflict do nothing;
-- 1 quindici giorni fa · 2 fra due giorni · 3 fra 29 minuti (dentro) · 4 fra 31 (fuori)
-- 5 14 giorni fa più un minuto (dentro) · 6 14 giorni fa meno un minuto (fuori)
-- 7 ieri (dentro) · 8 venti giorni fa, con un segno da togliere
insert into sessioni (id, corso_id, inizio, fine)
  select sess(n), 'cccccccc-0000-0000-0000-000000000021', quando, quando + interval '1 hour'
  from (values
    (1, now() - interval '15 days'),
    (2, now() + interval '2 days'),
    (3, now() + interval '29 minutes'),
    (4, now() + interval '31 minutes'),
    (5, now() - interval '14 days' + interval '1 minute'),
    (6, now() - interval '14 days' - interval '1 minute'),
    (7, now() - interval '1 day'),
    (8, now() - interval '20 days')) v(n, quando);
insert into persone (id, nome, cognome, ruolo)
  select iscritto(n), 'Iscritto', 'Pin ' || n, 'iscritto' from generate_series(1, 8) n;
insert into persone (id, nome, cognome, ruolo)
  select prova_di(n), 'Prova', 'Pin ' || n, 'iscritto' from generate_series(1, 7) n;
insert into iscrizioni (corso_id, persona_id, dal)
  select 'cccccccc-0000-0000-0000-000000000021', iscritto(n), current_date - 60 from generate_series(1, 8) n;
-- Una prova già lì in ogni lezione, perché `segna_prova_con_pin` ne ha una da toccare.
insert into prove (sessione_id, persona_id) select sess(n), prova_di(n) from generate_series(1, 7) n;
-- Un segno scritto da uno script (nessun utente) nella lezione 8: dal tablet non si toglie.
insert into presenze (sessione_id, persona_id, stato, origine) values (sess(8), iscritto(8), 'presente', 'recupero');

create or replace function esito(sql text) returns text language plpgsql as $$
declare r text;
begin
  execute sql into r;
  return r;
exception when others then return 'NEGATO ' || sqlstate || ': ' || sqlerrm;
end $$;
-- Il rifiuto della finestra, riconosciuto dalla frase intera e dal codice: se è un'altra cosa si vede qual è.
create or replace function leggi(r text) returns text language sql immutable as $$
  select case when r = 'NEGATO 42501: Questa lezione è troppo vecchia o troppo lontana per segnare l''appello da qui: scrivete alla segreteria'
    then 'RIFIUTATO' else r end
$$;
-- Le tre funzioni del PIN su una lezione, una dopo l'altra.
create or replace function giro_pin(pin text, n int) returns text language sql as $$
  select leggi(esito(format($q$select segna_con_pin(%L, %L, %L, 'presente')::text$q$, pin, sess(n), iscritto(n))))
    || ' | ' || leggi(esito(format($q$select aggiungi_prova_con_pin(%L, %L, %L, 'Ugo', 'Nuovo', null)::text$q$, pin, sess(n), nuova(n))))
    || ' | ' || leggi(esito(format($q$select segna_prova_con_pin(%L, %L, %L, 'presente')::text$q$, pin, sess(n), prova_di(n))))
$$;
-- Cosa c'è davvero nella lezione, letto senza i limiti del tablet.
create or replace function segni(n int) returns text language sql security definer set search_path = public as $$
  select format('presenze %s, prove %s, istruttore %s, persone nuove %s',
    (select count(*) from presenze where sessione_id = sess(n)),
    (select count(*) from prove where sessione_id = sess(n)),
    (select count(*) from presenze_istruttori where sessione_id = sess(n)),
    (select count(*) from persone where id = nuova(n)))
$$;
grant execute on function sess(int), iscritto(int), prova_di(int), nuova(int), esito(text), leggi(text), giro_pin(text, int), segni(int)
  to anon, authenticated;

\echo ''
\echo '--- 1. elenco_sala: la sua finestra non si muove ---'
-- Prima di ogni altro segno: chi è già presente in un altro turno dello stesso giorno non sta nell'elenco.
select chi('66666666-6666-6666-6666-666666666666');  -- il tablet della Lotta
set role authenticated;
select atteso('fra 31 minuti no, con la sua frase', esito($$select count(*)::text from elenco_sala('eeeeeeee-0000-0000-0000-000000000204')$$),
  'NEGATO 42501: lezione fuori dalla finestra del tablet');
select atteso('14 giorni e un minuto fa no', esito($$select count(*)::text from elenco_sala('eeeeeeee-0000-0000-0000-000000000206')$$),
  'NEGATO 42501: lezione fuori dalla finestra del tablet');
select atteso('15 giorni fa no', esito($$select count(*)::text from elenco_sala('eeeeeeee-0000-0000-0000-000000000201')$$),
  'NEGATO 42501: lezione fuori dalla finestra del tablet');
select atteso('fra due giorni no', esito($$select count(*)::text from elenco_sala('eeeeeeee-0000-0000-0000-000000000202')$$),
  'NEGATO 42501: lezione fuori dalla finestra del tablet');
select atteso('fra 29 minuti sì: gli otto iscritti', esito($$select count(*)::text from elenco_sala('eeeeeeee-0000-0000-0000-000000000203')$$), '8');
select atteso('14 giorni fa più un minuto sì', esito($$select count(*)::text from elenco_sala('eeeeeeee-0000-0000-0000-000000000205')$$), '8');
select atteso('ieri sì', esito($$select count(*)::text from elenco_sala('eeeeeeee-0000-0000-0000-000000000207')$$), '8');
reset role;

\echo ''
\echo '--- 2. PIN sbagliato, lezione fuori dalla finestra: false, contato, niente 42501 ---'
delete from tentativi_pin;
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('15 giorni fa: tre false', giro_pin('0000', 1), 'false | false | false');
reset role;
select atteso('tre tentativi sbagliati contati', (select count(*)::text from tentativi_pin where not riuscito), '3');
select atteso('niente è entrato (15 giorni fa)', segni(1), 'presenze 0, prove 1, istruttore 0, persone nuove 0');
delete from tentativi_pin;
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('fra due giorni: tre false', giro_pin('0000', 2), 'false | false | false');
reset role;
select atteso('altri tre contati', (select count(*)::text from tentativi_pin where not riuscito), '3');
select atteso('niente è entrato (fra due giorni)', segni(2), 'presenze 0, prove 1, istruttore 0, persone nuove 0');
delete from tentativi_pin;

\echo ''
-- Ogni tentativo sta in un'istruzione a parte (`\gset`): se la verifica fallisse, annullerebbe con sé anche
-- le scritture, e sotto non si vedrebbe cosa è entrato.
\echo '--- 3. PIN giusto, lezione di 15 giorni fa o di fra due giorni: un errore che manda alla segreteria ---'
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select giro_pin('4321', 1) as g1 \gset
select atteso('15 giorni fa: segna, aggiunge una prova, tocca una prova: tre rifiuti', :'g1', 'RIFIUTATO | RIFIUTATO | RIFIUTATO');
select giro_pin('4321', 2) as g2 \gset
select atteso('fra due giorni: tre rifiuti', :'g2', 'RIFIUTATO | RIFIUTATO | RIFIUTATO');
reset role;
select atteso('15 giorni fa: nessuna presenza, prova, persona né presenza dell''istruttore', segni(1), 'presenze 0, prove 1, istruttore 0, persone nuove 0');
select atteso('fra due giorni: uguale', segni(2), 'presenze 0, prove 1, istruttore 0, persone nuove 0');

\echo ''
\echo '--- 4. i bordi: un minuto dentro funziona, un minuto fuori no ---'
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select giro_pin('4321', 3) as g3 \gset
select atteso('fra 29 minuti: funziona', :'g3', 'true | true | true');
select giro_pin('4321', 4) as g4 \gset
select atteso('fra 31 minuti: tre rifiuti', :'g4', 'RIFIUTATO | RIFIUTATO | RIFIUTATO');
select giro_pin('4321', 5) as g5 \gset
select atteso('14 giorni fa più un minuto: funziona', :'g5', 'true | true | true');
select giro_pin('4321', 6) as g6 \gset
select atteso('14 giorni fa meno un minuto: tre rifiuti', :'g6', 'RIFIUTATO | RIFIUTATO | RIFIUTATO');
reset role;
select atteso('fra 29 minuti: presenze, prove, persona e istruttore', segni(3), 'presenze 3, prove 2, istruttore 1, persone nuove 1');
select atteso('fra 31 minuti: non è entrato niente', segni(4), 'presenze 0, prove 1, istruttore 0, persone nuove 0');
select atteso('14 giorni fa più un minuto: presenze, prove, persona e istruttore', segni(5), 'presenze 3, prove 2, istruttore 1, persone nuove 1');
select atteso('14 giorni fa meno un minuto: non è entrato niente', segni(6), 'presenze 0, prove 1, istruttore 0, persone nuove 0');

\echo ''
\echo '--- 5. dentro la finestra, come prima ---'
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select giro_pin('4321', 7) as g7 \gset
select atteso('ieri: le tre funzioni funzionano', :'g7', 'true | true | true');
reset role;
select atteso('presenze, prove, persona nuova e istruttore', segni(7), 'presenze 3, prove 2, istruttore 1, persone nuove 1');
select atteso('il segno dell''iscritto è un appello di Maura', (select p.origine || ' ' || pe.nome from presenze p join persone pe on pe.id = p.segnata_da
  where p.sessione_id = sess(7) and p.persona_id = iscritto(7)), 'appello Maura');
select atteso('la prova aggiunta è presente, con origine appello', (select stato || ' ' || origine from presenze where sessione_id = sess(7) and persona_id = nuova(7)), 'presente appello');
select atteso('la presenza dell''istruttore nasce come oggi', (select pi.stato || ' ' || pi.come || ' ' || pi.prevista from presenze_istruttori pi
  where pi.sessione_id = sess(7) and pi.persona_id = 'aaaaaaaa-0000-0000-0000-000000000002'), 'confermata appello true');
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('un segno tolto dentro la finestra: funziona', esito($$select segna_con_pin('4321', 'eeeeeeee-0000-0000-0000-000000000207', 'aaaaaaaa-0000-0000-0000-000000000207', null)::text$$), 'true');
reset role;

\echo ''
\echo '--- 6. togliere un segno (stato null) fuori dalla finestra ---'
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select esito($$select segna_con_pin('4321', 'eeeeeeee-0000-0000-0000-000000000208', 'aaaaaaaa-0000-0000-0000-000000000208', null)::text$$) as togli \gset
select atteso('20 giorni fa: un rifiuto, non un «true»', leggi(:'togli'), 'RIFIUTATO');
reset role;
select atteso('il segno c''è ancora', segni(8), 'presenze 1, prove 0, istruttore 0, persone nuove 0');

\echo ''
\echo '--- 7. la segreteria col PIN non ha eccezioni ---'
-- Anna è della segreteria: nell'app corregge qualsiasi lezione, ma col PIN al tablet vale la finestra di tutti.
select chi('');
select imposta_pin('aaaaaaaa-0000-0000-0000-000000000001', '7391');
delete from tentativi_pin;
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select giro_pin('7391', 1) as g1s \gset
select atteso('15 giorni fa col PIN della segreteria: tre rifiuti', :'g1s', 'RIFIUTATO | RIFIUTATO | RIFIUTATO');
select giro_pin('7391', 2) as g2s \gset
select atteso('fra due giorni col PIN della segreteria: tre rifiuti', :'g2s', 'RIFIUTATO | RIFIUTATO | RIFIUTATO');
reset role;
select atteso('15 giorni fa: non è entrato niente', segni(1), 'presenze 0, prove 1, istruttore 0, persone nuove 0');
select atteso('fra due giorni: non è entrato niente', segni(2), 'presenze 0, prove 1, istruttore 0, persone nuove 0');
-- Il PIN di Anna serviva solo qui: le prove che vengono dopo trovano i PIN di prima.
delete from pin_istruttori where persona_id = 'aaaaaaaa-0000-0000-0000-000000000001';
delete from tentativi_pin;

\echo ''
\echo 'TUTTO A POSTO'
