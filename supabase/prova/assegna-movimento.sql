-- Un movimento di entrata collegato a una persona si assegna a quota e corsi (135-assegna-movimento.sql):
--   · `assegna_movimento(movimento, righe)` (amministrazione) scrive una riga di `pagamenti_diretti` per voce, con
--     `movimento_id`, metodo Bonifico e la data del movimento: o tutte o nessuna; ammessa anche in un giorno chiuso;
--   · rifiuta: movimento annullato, uscita, senza persona, su un'altra voce, in Cassa Contanti; persona fuori dal nucleo
--     o disattivata; importo a zero; somma oltre quel che resta da assegnare (importo - assegnato);
--   · l'assegnato è la somma dei pagamenti a mano attivi del movimento più il `pagato` delle ricevute attive del movimento;
--   · `emetti_ricevuta_da_movimento(dati, movimento)`: una ricevuta per persona, con dentro tutti e soli i suoi pagamenti
--     del movimento, così come sono; la stessa chiave dà la stessa ricevuta; le righe diventano della ricevuta (annullate,
--     col `ricevuta_id`) e la ricevuta punta al movimento (`ricevute.movimento_id`);
--   · `annulla_ricevuta` di una ricevuta del movimento NON rimette attive le righe: i soldi tornano da assegnare;
--   · `annulla_movimento` con una ricevuta attiva dice «Annulla prima la ricevuta n. N/AAAA»; senza ricevute annulla anche
--     le assegnazioni;
--   · `abbina_ricevuta_movimento(movimento, ricevuta)` (amministrazione) lega una ricevuta già fatta al bonifico: stessa
--     persona, stesso importo, tutta in Bonifico, entro 30 giorni, una ricevuta a un solo bonifico;
--   · annullata, una ricevuta abbinata non rimette attivo il suo pagamento a mano: i soldi stanno nel bonifico;
--   · un movimento con soldi assegnati non cambia persona né va su una voce che non si assegna, e non si annulla con
--     l'importazione della banca se ha una ricevuta attiva (senza, le assegnazioni vanno via con lui);
--   · il previsto delle casse non cambia in nessun passaggio, nemmeno in un giorno chiuso.
-- Le stesse regole di src/lib/assegna.ts e della modalità prova, provate da scripts/prova-assegna-movimento.mjs
-- (stessi casi, stessi messaggi).
--   · 136-assegna-una-volta.sql: la chiave dell'assegnazione (ripetuta non conta due volte, su un altro bonifico è un
--     errore) e il tetto della quota per persona e stagione (sezioni 13, 14 e 15).
-- Si lancia dopo finto-supabase.sql e i file dello schema, fino a 136-assegna-una-volta.sql. Nomi tutti inventati.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'maura@ods.it'),
  ('66666666-6666-6666-6666-666666666666', 'ada@ods.it');
-- Anna: segreteria. Ada: amministrazione. Maura: istruttore.
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Maura', 'Uno', 'istruttore', 'maura@ods.it', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000030', 'Ada', 'Conti', 'amministrazione', 'ada@ods.it', '66666666-6666-6666-6666-666666666666');
-- La famiglia Rossi: Mario è il titolare, Luca e Sofia i figli, Giada spenta. Ludovica non c'entra.
insert into persone (id, nome, cognome, ruolo, attiva, nucleo) values
  ('bbbbbbbb-0000-0000-0000-000000000010', 'Mario', 'Rossi', 'iscritto', true, null),
  ('bbbbbbbb-0000-0000-0000-000000000011', 'Luca', 'Rossi', 'iscritto', true, 'bbbbbbbb-0000-0000-0000-000000000010'),
  ('bbbbbbbb-0000-0000-0000-000000000012', 'Sofia', 'Rossi', 'iscritto', true, 'bbbbbbbb-0000-0000-0000-000000000010'),
  ('bbbbbbbb-0000-0000-0000-000000000013', 'Giada', 'Rossi', 'iscritto', true, 'bbbbbbbb-0000-0000-0000-000000000010'),
  ('bbbbbbbb-0000-0000-0000-000000000014', 'Ludovica', 'Martini', 'iscritto', true, null),
  ('bbbbbbbb-0000-0000-0000-000000000015', 'Marco', 'Verdi', 'iscritto', true, null),
  ('bbbbbbbb-0000-0000-0000-000000000016', 'Pietro', 'Neri', 'iscritto', true, null),
  ('bbbbbbbb-0000-0000-0000-000000000017', 'Elena', 'Gialli', 'iscritto', true, null),
  ('bbbbbbbb-0000-0000-0000-000000000018', 'Rita', 'Blu', 'iscritto', true, null),
  ('bbbbbbbb-0000-0000-0000-000000000019', 'Dario', 'Bianchi', 'iscritto', true, null);

-- Giada si spegne dopo, una scheda disattivata non entra in un nucleo.
update persone set attiva = false where id = 'bbbbbbbb-0000-0000-0000-000000000013';
insert into voci_contabili (nome, tipo, di_sistema) values ('Gare e trasferte', 'entrata', false), ('Commissioni di prova', 'uscita', false)
  on conflict do nothing;

create or replace function chi(u text) returns void language plpgsql as $$
begin perform set_config('prova.utente', u, false); end $$;
-- Un rifiuto della funzione, col suo codice e la sua frase: una funzione che manca (42883) non vale.
create or replace function rifiuto(sql text) returns text language plpgsql as $$
begin
  execute sql;
  return 'nessun errore';
exception when others then return sqlstate || ' ' || sqlerrm;
end $$;
create or replace function atteso(cosa text, avuto text, voluto text) returns text language plpgsql as $$
begin
  if avuto is distinct from voluto and not (voluto like '%…' and avuto like replace(voluto, '…', '%')) then
    raise exception '% · atteso «%», avuto «%»', cosa, voluto, avuto;
  end if;
  return 'ok  ' || cosa || ' → ' || avuto;
end $$;

-- I movimenti, scritti da superutente: l'id si ritrova dalla descrizione.
create or replace function id_voce(n text, t text) returns uuid language sql stable security definer set search_path = public as $$
  select id from voci_contabili where nome = n and tipo::text = t $$;
create or replace function id_cassa(n text) returns uuid language sql stable security definer set search_path = public as $$
  select id from casse where nome = n $$;
create or replace function id_mov(d text) returns uuid language sql stable security definer set search_path = public as $$
  select id from movimenti where descrizione = d $$;
create or replace function pid(n int) returns uuid language sql immutable as $$
  select ('bbbbbbbb-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid $$;
insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione, persona_id) values
  ('entrata', '2026-10-15', 42000, id_voce('Corsi e altri pagamenti', 'entrata'), id_cassa('Conto Corrente'), 'Bonifico Mario annuale', pid(10)),
  ('entrata', '2026-10-15', 7000, id_voce('Corsi e altri pagamenti', 'entrata'), id_cassa('Conto Corrente'), 'Bonifico Marco 70', pid(15)),
  ('entrata', '2026-10-15', 60000, id_voce('Corsi e altri pagamenti', 'entrata'), id_cassa('Conto Corrente'), 'Bonifico famiglia Rossi', pid(10)),
  ('entrata', '2026-10-15', 5000, id_voce('Quota associativa', 'entrata'), id_cassa('Conto Corrente'), 'Bonifico quota Neri', pid(16)),
  ('entrata', '2026-10-15', 5000, id_voce('Quota associativa', 'entrata'), id_cassa('Conto Corrente'), 'Bonifico da annullare', pid(17)),
  ('entrata', '2026-10-15', 5000, id_voce('Quota associativa', 'entrata'), id_cassa('Conto Corrente'), 'Bonifico già annullato', pid(17)),
  ('entrata', '2026-10-10', 5000, id_voce('Quota associativa', 'entrata'), id_cassa('Cassa Contanti'), 'Contanti Pietro', pid(16)),
  ('entrata', '2026-10-15', 5000, id_voce('Quota associativa', 'entrata'), id_cassa('Conto Corrente'), 'Bonifico sconosciuto', null),
  ('entrata', '2026-10-15', 5000, id_voce('Gare e trasferte', 'entrata'), id_cassa('Conto Corrente'), 'Bonifico gara', pid(16)),
  ('uscita', '2026-10-15', 1000, id_voce('Commissioni di prova', 'uscita'), id_cassa('Conto Corrente'), 'Commissioni di prova', null),
  ('entrata', '2026-10-01', 20000, id_voce('Corsi e altri pagamenti', 'entrata'), id_cassa('Conto Corrente'), 'Primo bonifico 200', pid(17)),
  ('entrata', '2026-10-05', 22000, id_voce('Corsi e altri pagamenti', 'entrata'), id_cassa('Conto Corrente'), 'Secondo bonifico 220', pid(17)),
  ('entrata', '2026-09-01', 12000, id_voce('Corsi e altri pagamenti', 'entrata'), id_cassa('Conto Corrente'), 'Collegato prima A', pid(18)),
  ('entrata', '2026-09-01', 12000, id_voce('Corsi e altri pagamenti', 'entrata'), id_cassa('Conto Corrente'), 'Collegato prima B', pid(18)),
  ('entrata', '2026-09-01', 12000, id_voce('Corsi e altri pagamenti', 'entrata'), id_cassa('Conto Corrente'), 'Collegato prima C', pid(18)),
  ('entrata', '2026-10-12', 10000, id_voce('Corsi e altri pagamenti', 'entrata'), id_cassa('Conto Corrente'), 'Bonifico giorno chiuso', pid(16));
-- Lo storico del vecchio programma, ai due lati del 1° agosto della stagione di oggi (a Roma, come 71): le date
-- seguono l'orologio, così la prova vale in ogni stagione.
insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione, persona_id, origine_import)
select 'entrata', d, 5000, id_voce('Quota associativa', 'entrata'), id_cassa('Conto Corrente'), descr, pid(17), 'prima-nota:' || n
from (select make_date(extract(year from (now() at time zone 'Europe/Rome'))::int
        - case when extract(month from (now() at time zone 'Europe/Rome')) >= 8 then 0 else 1 end, 8, 1) inizio) s,
  lateral (values (s.inizio, 'Storico di questa stagione', 9001), (s.inizio - 1, 'Storico della stagione passata', 9002)) v(d, descr, n);
update movimenti set annullato_il = now(), annullato_da = 'aaaaaaaa-0000-0000-0000-000000000030' where descrizione = 'Bonifico già annullato';

-- Una riga da assegnare; l'elenco; la chiamata col suo esito (un rifiuto o «nessun errore»).
create or replace function riga(p int, voce text, importo int) returns jsonb language sql immutable as $$
  select jsonb_build_object('persona_id', pid(p), 'voce', voce, 'importo', importo) $$;
create or replace function ass(m text, righe jsonb) returns text language plpgsql as $$
begin return rifiuto(format('select assegna_movimento(%L, %L)', id_mov(m), righe)); end $$;
-- Quanto resta da assegnare di un movimento: importo - pagamenti a mano attivi - pagato delle ricevute attive.
create or replace function resta(m text) returns text language plpgsql security definer set search_path = public as $$
declare mv uuid := id_mov(m); imp int; dir int; ric int;
begin
  select importo into imp from movimenti where id = mv;
  execute 'select coalesce(sum(importo), 0) from pagamenti_diretti where movimento_id = $1 and annullato_il is null' into dir using mv;
  execute 'select coalesce(sum(pagato), 0) from ricevute where movimento_id = $1 and annullata_il is null' into ric using mv;
  return greatest(imp - dir - ric, 0)::text;
end $$;
-- Le righe attive del movimento, di una persona (0 = tutte): «persona|voce|importo|data|metodo», in ordine.
create or replace function attive(m text, p int default 0) returns text language plpgsql security definer set search_path = public as $$
declare r text;
begin
  execute 'select coalesce(string_agg(persona_id::text || ''|'' || voce || ''|'' || importo || ''|'' || data || ''|'' || metodo, '','' order by voce, importo), '''')
    from pagamenti_diretti where movimento_id = $1 and annullato_il is null and ($2 = 0 or persona_id = $3)'
    into r using id_mov(m), p, pid(p);
  return r;
end $$;
create or replace function quante_attive(m text, p int default 0) returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  execute 'select count(*) from pagamenti_diretti where movimento_id = $1 and annullato_il is null and ($2 = 0 or persona_id = $3)'
    into n using id_mov(m), p, pid(p);
  return n;
end $$;
-- Le righe del movimento annullate (anche se sono diventate una ricevuta): «annullata», «legata alla ricevuta».
create or replace function annullate(m text, p int) returns text language plpgsql security definer set search_path = public as $$
declare r text;
begin
  execute 'select count(*) || '' annullate, '' || count(ricevuta_id) || '' legate'' from pagamenti_diretti where movimento_id = $1 and persona_id = $2 and annullato_il is not null'
    into r using id_mov(m), pid(p);
  return r;
end $$;
-- La ricevuta: «persona|movimento (descrizione)|pagato|annullata?».
create or replace function com_ricevuta(id text) returns text language plpgsql security definer set search_path = public as $$
declare r text;
begin
  execute 'select r.persona_id::text || ''|'' || coalesce((select descrizione from movimenti m where m.id = r.movimento_id), ''senza movimento'') || ''|'' || r.pagato || ''|'' || (r.annullata_il is not null)
    from ricevute r where r.id = $1' into r using com_ricevuta.id::uuid;
  return r;
end $$;
create or replace function numero(id text) returns text language sql security definer set search_path = public as $$
  select numero || '/' || anno from ricevute where ricevute.id = numero.id::uuid $$;
create or replace function quante_ricevute() returns int language sql security definer set search_path = public as $$
  select count(*)::int from ricevute $$;
create or replace function previsto(cassa text) returns bigint language sql security definer set search_path = public as $$
  select previsto_cassa(id_cassa(cassa), date '2026-10-31') $$;
create or replace function chiusure() returns text language sql security definer set search_path = public as $$
  select coalesce(string_agg(cassa_id || '|' || data || '|' || previsto || '|' || contato || '|' || (annullata_il is not null), ',' order by id), '') from chiusure_cassa $$;
-- La ricevuta di un bonifico: i pagamenti sono Bonifico, del 15/10 salvo diverso avviso.
create or replace function bon(importo int, giorno text default '2026-10-15', metodo text default 'Bonifico') returns jsonb language sql immutable as $$
  select jsonb_build_object('data', giorno, 'importo', importo, 'metodo', metodo) $$;
create or replace function vr(descrizione text, prezzo int, pagamenti jsonb) returns jsonb language sql immutable as $$
  select jsonb_build_object('descrizione', descrizione, 'quantita', 1, 'prezzo', prezzo, 'pagamenti', jsonb_build_array(pagamenti)) $$;
create or replace function dati(p int, voci jsonb, extra jsonb default '{}', giorno text default '2026-10-15') returns jsonb
  language sql stable security definer set search_path = public as $$
  select jsonb_build_object('persona_id', pid(p), 'data', giorno,
    'intestatario', jsonb_build_object('nome', (select nome from persone where id = pid(p)), 'cognome', (select cognome from persone where id = pid(p))),
    'voci', voci) || extra $$;
create or replace function da_mov(d jsonb, m text) returns text language plpgsql as $$
declare r text;
begin
  execute format('select emetti_ricevuta_da_movimento(%L, %L)->>''id''', d, id_mov(m)) into r;
  return r;
end $$;
create or replace function ric_mov(d jsonb, m text) returns text language plpgsql as $$
begin return rifiuto(format('select emetti_ricevuta_da_movimento(%L, %L)', d, id_mov(m))); end $$;
-- Una ricevuta già fatta, a parte (come quelle di prima di questa funzione): ne dà l'id.
create or replace function vecchia(d jsonb) returns text language plpgsql as $$
declare r text;
begin
  execute format('select emetti_ricevuta(%L)->>''id''', d) into r;
  return r;
end $$;
create or replace function abbina(m text, ricevuta text) returns text language plpgsql as $$
begin return rifiuto(format('select abbina_ricevuta_movimento(%L, %L)', id_mov(m), ricevuta)); end $$;
grant execute on function chi(text), rifiuto(text), atteso(text, text, text), id_voce(text, text), id_cassa(text), id_mov(text), pid(int),
  riga(int, text, int), ass(text, jsonb), resta(text), attive(text, int), quante_attive(text, int), annullate(text, int), com_ricevuta(text),
  numero(text), quante_ricevute(), previsto(text), chiusure(), bon(int, text, text), vr(text, int, jsonb), dati(int, jsonb, jsonb, text),
  da_mov(jsonb, text), ric_mov(jsonb, text), vecchia(jsonb), abbina(text, text) to anon, authenticated;

\set ADA '''66666666-6666-6666-6666-666666666666'''
\set ANNA '''11111111-1111-1111-1111-111111111111'''
\set MAURA '''22222222-2222-2222-2222-222222222222'''
\set NON_COSI '''22023 Il bonifico va nella ricevuta così com’è: rimettilo, o torna ad «Assegna» per cambiare gli importi.'''
\set NIENTE '''22023 Non c’è niente di assegnato a questa persona su questo bonifico.'''
\set ANNULLATO '''22023 Il movimento è annullato: non si assegna.'''

\echo ''
\echo '--- 1. 420 € di bonifico a Mario, saldo dell''annuale ---'
select previsto('Conto Corrente') as conto0, previsto('Cassa Contanti') as contanti0 \gset
select chi(:ADA);
set role authenticated;
select atteso('si assegna', ass('Bonifico Mario annuale', jsonb_build_array(riga(10, 'Annuale Judo Kids', 42000))), 'nessun errore');
select atteso('la riga è di Mario, Bonifico, con la data del movimento', attive('Bonifico Mario annuale'),
  'bbbbbbbb-0000-0000-0000-000000000010|Annuale Judo Kids|42000|2026-10-15|Bonifico');
select atteso('non resta niente da assegnare', resta('Bonifico Mario annuale'), '0');
select atteso('il previsto del Conto Corrente è lo stesso', previsto('Conto Corrente')::text, :'conto0');
select atteso('…e quello della Cassa Contanti', previsto('Cassa Contanti')::text, :'contanti0');
select atteso('un altro bonifico alla stessa voce: tutto da assegnare, nulla è cambiato', resta('Bonifico Marco 70'), '7000');
reset role;

\echo ''
\echo '--- 2. 70 € a Marco, quota da 50 €: oltre il bonifico no, 50 € sì e 20 € restano ---'
select chi(:ADA);
set role authenticated;
select atteso('50 € sulla quota e 30 € su un corso: 10 € più del bonifico',
  ass('Bonifico Marco 70', jsonb_build_array(riga(15, 'Quota associativa 2026/27', 5000), riga(15, 'Annuale Kickboxing', 3000))),
  '22023 Hai assegnato 10,00 € più del bonifico: togli da una voce.');
select atteso('…e non ha scritto niente', quante_attive('Bonifico Marco 70')::text, '0');
select atteso('un importo a zero no', ass('Bonifico Marco 70', jsonb_build_array(riga(15, 'Quota associativa 2026/27', 0))),
  '22023 Metti su ogni voce un importo maggiore di zero.');
select atteso('nessuna riga no', ass('Bonifico Marco 70', '[]'), '22023 Metti almeno un importo su una voce.');
select atteso('50 € sulla quota: passa', ass('Bonifico Marco 70', jsonb_build_array(riga(15, 'Quota associativa 2026/27', 5000))), 'nessun errore');
select atteso('…20 € restano da assegnare', resta('Bonifico Marco 70'), '2000');
select atteso('altri 25 € no: 5 € più di quel che resta', ass('Bonifico Marco 70', jsonb_build_array(riga(15, 'Annuale Kickboxing', 2500))),
  '22023 Hai assegnato 5,00 € più del bonifico: togli da una voce.');
select atteso('altri 20 € sì', ass('Bonifico Marco 70', jsonb_build_array(riga(15, 'Annuale Kickboxing', 2000))), 'nessun errore');
select atteso('…0 da assegnare', resta('Bonifico Marco 70'), '0');
reset role;

\echo ''
\echo '--- 3. 600 € per il nucleo: due fratelli, una ricevuta per persona ---'
select chi(:ADA);
set role authenticated;
select atteso('una persona fuori dal nucleo è rifiutata',
  ass('Bonifico famiglia Rossi', jsonb_build_array(riga(14, 'Quota associativa 2026/27', 5000))),
  '22023 Martini Ludovica non è nella famiglia di Rossi Mario: il bonifico si assegna solo a chi è nel suo nucleo.');
select atteso('…anche insieme a righe giuste: tutto o niente',
  ass('Bonifico famiglia Rossi', jsonb_build_array(riga(11, 'Quota associativa 2026/27', 5000), riga(14, 'Quota associativa 2026/27', 5000))),
  '22023 Martini Ludovica non è nella famiglia di Rossi Mario: il bonifico si assegna solo a chi è nel suo nucleo.');
select atteso('…e non resta niente di scritto', quante_attive('Bonifico famiglia Rossi')::text, '0');
select atteso('una persona disattivata del nucleo è rifiutata', left(ass('Bonifico famiglia Rossi', jsonb_build_array(riga(13, 'Quota associativa 2026/27', 5000))), 6), '22023 ');
select atteso('la somma oltre l''importo è rifiutata',
  ass('Bonifico famiglia Rossi', jsonb_build_array(riga(11, 'Annuale Judo Kids', 42000), riga(12, 'Trimestre Danza', 20000))),
  '22023 Hai assegnato 20,00 € più del bonifico: togli da una voce.');
select atteso('le quattro righe passano',
  ass('Bonifico famiglia Rossi', jsonb_build_array(riga(11, 'Quota associativa 2026/27', 5000), riga(12, 'Quota associativa 2026/27', 5000),
    riga(11, 'Annuale Judo Kids', 42000), riga(12, 'Trimestre Danza moderna ottobre-dicembre', 8000))), 'nessun errore');
select atteso('…a due persone, due righe a testa', quante_attive('Bonifico famiglia Rossi', 11) || '/' || quante_attive('Bonifico famiglia Rossi', 12) || '/' || quante_attive('Bonifico famiglia Rossi'), '2/2/4');
select atteso('Luca ha due righe, 470 €', attive('Bonifico famiglia Rossi', 11),
  'bbbbbbbb-0000-0000-0000-000000000011|Annuale Judo Kids|42000|2026-10-15|Bonifico,bbbbbbbb-0000-0000-0000-000000000011|Quota associativa 2026/27|5000|2026-10-15|Bonifico');
select atteso('non resta niente da assegnare', resta('Bonifico famiglia Rossi'), '0');
reset role;

\echo ''
\echo '--- 4. la ricevuta dal movimento: così com''è, una per persona, stessa chiave stessa ricevuta ---'
select chi(:ANNA);
set role authenticated;
select quante_ricevute() as r_prima \gset
select atteso('Luca con altri importi: rifiutata',
  ric_mov(dati(11, jsonb_build_array(vr('QUOTA ASSOCIATIVA', 5000, bon(5000)), vr('ANNUALE JUDO KIDS', 42000, bon(40000)))), 'Bonifico famiglia Rossi'), :NON_COSI);
select atteso('…con un altro metodo: rifiutata',
  ric_mov(dati(11, jsonb_build_array(vr('QUOTA ASSOCIATIVA', 5000, bon(5000)), vr('ANNUALE JUDO KIDS', 42000, bon(42000, '2026-10-15', 'Contanti')))), 'Bonifico famiglia Rossi'), :NON_COSI);
select atteso('…con un''altra data: rifiutata',
  ric_mov(dati(11, jsonb_build_array(vr('QUOTA ASSOCIATIVA', 5000, bon(5000)), vr('ANNUALE JUDO KIDS', 42000, bon(42000, '2026-10-16')))), 'Bonifico famiglia Rossi'), :NON_COSI);
select atteso('per chi non ha niente di assegnato: rifiutata',
  ric_mov(dati(10, jsonb_build_array(vr('QUOTA ASSOCIATIVA', 5000, bon(5000)))), 'Bonifico famiglia Rossi'), :NIENTE);
select atteso('nessuna ricevuta nuova', (quante_ricevute() - :r_prima)::text, '0');
select atteso('…e le righe di Luca sono ancora attive', quante_attive('Bonifico famiglia Rossi', 11)::text, '2');
select '77777777-0000-0000-0000-000000000001' as chiave \gset
select da_mov(dati(11, jsonb_build_array(vr('QUOTA ASSOCIATIVA', 5000, bon(5000)), vr('ANNUALE JUDO KIDS', 42000, bon(42000))),
  jsonb_build_object('chiave', :'chiave')), 'Bonifico famiglia Rossi') as rl \gset
select atteso('la ricevuta di Luca è sua, del movimento, 470 €', com_ricevuta(:'rl'),
  'bbbbbbbb-0000-0000-0000-000000000011|Bonifico famiglia Rossi|47000|false');
select atteso('…le righe di Luca sono annullate e legate a lei', annullate('Bonifico famiglia Rossi', 11), '2 annullate, 2 legate');
select atteso('…quelle di Sofia restano attive', quante_attive('Bonifico famiglia Rossi', 12)::text, '2');
select atteso('ripetuta con la stessa chiave dà la stessa ricevuta',
  da_mov(dati(11, jsonb_build_array(vr('QUOTA ASSOCIATIVA', 5000, bon(5000)), vr('ANNUALE JUDO KIDS', 42000, bon(42000))),
    jsonb_build_object('chiave', :'chiave')), 'Bonifico famiglia Rossi'), :'rl');
select atteso('senza chiave non ne fa una seconda: non c''è più niente di assegnato a Luca',
  ric_mov(dati(11, jsonb_build_array(vr('QUOTA ASSOCIATIVA', 5000, bon(5000)), vr('ANNUALE JUDO KIDS', 42000, bon(42000)))), 'Bonifico famiglia Rossi'), :NIENTE);
select da_mov(dati(12, jsonb_build_array(vr('QUOTA ASSOCIATIVA', 5000, bon(5000)), vr('TRIMESTRE DANZA', 15000, bon(8000)))), 'Bonifico famiglia Rossi') as rs \gset
select atteso('quella di Sofia è un''altra, da 130 €', com_ricevuta(:'rs'), 'bbbbbbbb-0000-0000-0000-000000000012|Bonifico famiglia Rossi|13000|false');
select atteso('…due ricevute in tutto', (quante_ricevute() - :r_prima)::text, '2');
select atteso('il movimento è tutto assegnato, nelle ricevute', resta('Bonifico famiglia Rossi'), '0');
select atteso('il Conto Corrente conta lo stesso, la Cassa Contanti anche', previsto('Conto Corrente')::text || '/' || previsto('Cassa Contanti')::text,
  :'conto0' || '/' || :'contanti0');
reset role;

\echo ''
\echo '--- 5. annullare: la ricevuta libera i soldi, il movimento aspetta le ricevute ---'
select chi(:ADA);
set role authenticated;
select atteso('il movimento con le ricevute attive non si annulla',
  rifiuto(format('select annulla_movimento(%L)', id_mov('Bonifico famiglia Rossi'))), '22023 Annulla prima la ricevuta n. ' || numero(:'rl') );
select annulla_ricevuta(:'rs'::uuid);
select atteso('annullata la ricevuta di Sofia: i suoi 130 € tornano da assegnare', resta('Bonifico famiglia Rossi'), '13000');
select atteso('…e le righe di Sofia non tornano attive', quante_attive('Bonifico famiglia Rossi', 12)::text, '0');
select atteso('…restano annullate, col collegamento alla ricevuta', annullate('Bonifico famiglia Rossi', 12), '2 annullate, 2 legate');
select atteso('l''altra ricevuta è ancora attiva: il movimento non si annulla',
  rifiuto(format('select annulla_movimento(%L)', id_mov('Bonifico famiglia Rossi'))), '22023 Annulla prima la ricevuta n. ' || numero(:'rl'));
select annulla_ricevuta(:'rl'::uuid);
select atteso('annullate tutte: tutti i 600 € tornano da assegnare', resta('Bonifico famiglia Rossi'), '60000');
select atteso('le righe di Luca non sono tornate attive', quante_attive('Bonifico famiglia Rossi')::text, '0');
select atteso('il movimento si annulla', rifiuto(format('select annulla_movimento(%L)', id_mov('Bonifico famiglia Rossi'))), 'nessun errore');
select atteso('un movimento annullato non si assegna',
  ass('Bonifico famiglia Rossi', jsonb_build_array(riga(11, 'Quota associativa 2026/27', 5000))), :ANNULLATO);
-- (Con due ricevute attive il messaggio nomina la più vecchia: quella di Luca.)
-- Assegnazioni senza ricevuta: il movimento si annulla e si annullano insieme.
select atteso('assegnato senza ricevuta', ass('Bonifico da annullare', jsonb_build_array(riga(17, 'Quota associativa 2026/27', 5000))), 'nessun errore');
select atteso('…il movimento si annulla', rifiuto(format('select annulla_movimento(%L)', id_mov('Bonifico da annullare'))), 'nessun errore');
select atteso('…e le assegnazioni non restano attive', quante_attive('Bonifico da annullare')::text, '0');
reset role;

\echo ''
\echo '--- 6. due bonifici sulla stessa voce: 200 + 220 su un annuale da 420 ---'
select chi(:ADA);
set role authenticated;
select atteso('il primo, 200 €', ass('Primo bonifico 200', jsonb_build_array(riga(17, 'Annuale Judo Kids', 20000))), 'nessun errore');
select atteso('…il secondo, 220 €', ass('Secondo bonifico 220', jsonb_build_array(riga(17, 'Annuale Judo Kids', 22000))), 'nessun errore');
select atteso('l''annuale ha 420 € di assegnazioni attive, da due bonifici',
  (select sum(x)::text from (select (string_to_array(r, '|'))[3]::int x from unnest(string_to_array(attive('Primo bonifico 200') || ',' || attive('Secondo bonifico 220'), ',')) r) t), '42000');
select atteso('…e nessuno dei due ha più niente da assegnare', resta('Primo bonifico 200') || '/' || resta('Secondo bonifico 220'), '0/0');
reset role;

\echo ''
\echo '--- 7. quello che non si assegna ---'
select chi(:ADA);
set role authenticated;
select atteso('Cassa Contanti', ass('Contanti Pietro', jsonb_build_array(riga(16, 'Quota associativa 2026/27', 5000))),
  '22023 I contanti non si assegnano da qui: registra il pagamento in PAGAMENTI.');
select atteso('un''uscita', ass('Commissioni di prova', jsonb_build_array(riga(16, 'Quota associativa 2026/27', 1000))),
  '22023 Un’uscita non si assegna: si assegnano solo le entrate.');
select atteso('senza persona', ass('Bonifico sconosciuto', jsonb_build_array(riga(16, 'Quota associativa 2026/27', 5000))),
  '22023 Collega prima il movimento a una persona.');
select atteso('lo storico del vecchio programma di una stagione passata', ass('Storico della stagione passata', jsonb_build_array(riga(17, 'Quota associativa 2026/27', 5000))),
  '22023 Questo bonifico è del vecchio programma, di una stagione passata: resta nello storico, non si assegna.');
select atteso('…quello di questa stagione sì (dal 1° agosto)', ass('Storico di questa stagione', jsonb_build_array(riga(17, 'Quota associativa 2026/27', 5000))), 'nessun errore');
select atteso('annullato', ass('Bonifico già annullato', jsonb_build_array(riga(17, 'Quota associativa 2026/27', 5000))), :ANNULLATO);
select atteso('su un''altra voce (gare)', ass('Bonifico gara', jsonb_build_array(riga(16, 'Quota associativa 2026/27', 5000))),
  '22023 Si assegnano solo le entrate su «Quota associativa» e «Corsi e altri pagamenti».');
select atteso('nessuno dei sei ha scritto niente', (quante_attive('Contanti Pietro') + quante_attive('Commissioni di prova') + quante_attive('Bonifico sconosciuto')
  + quante_attive('Bonifico già annullato') + quante_attive('Bonifico gara'))::text, '0');
reset role;

\echo ''
\echo '--- 8. chi può: solo l''amministrazione assegna e abbina, la segreteria fa la ricevuta ---'
select chi(:ANNA);
set role authenticated;
select atteso('la segreteria non assegna', left(ass('Bonifico quota Neri', jsonb_build_array(riga(16, 'Quota associativa 2026/27', 5000))), 5), '42501');
select atteso('la segreteria non abbina', left(abbina('Collegato prima A', gen_random_uuid()::text), 5), '42501');
reset role;
select chi(:MAURA);
set role authenticated;
select atteso('l''istruttore non assegna', left(ass('Bonifico quota Neri', jsonb_build_array(riga(16, 'Quota associativa 2026/27', 5000))), 5), '42501');
select atteso('…non abbina', left(abbina('Collegato prima A', gen_random_uuid()::text), 5), '42501');
select atteso('…non fa la ricevuta dal movimento',
  left(ric_mov(dati(16, jsonb_build_array(vr('QUOTA ASSOCIATIVA', 5000, bon(5000)))), 'Bonifico quota Neri'), 5), '42501');
reset role;
select chi('00000000-0000-0000-0000-000000000000');
set role anon;
select atteso('chi non ha fatto l''accesso non assegna', left(ass('Bonifico quota Neri', jsonb_build_array(riga(16, 'Quota associativa 2026/27', 5000))), 5), '42501');
select atteso('…non abbina', left(abbina('Collegato prima A', gen_random_uuid()::text), 5), '42501');
select atteso('…non fa la ricevuta dal movimento',
  left(ric_mov(dati(16, jsonb_build_array(vr('QUOTA ASSOCIATIVA', 5000, bon(5000)))), 'Bonifico quota Neri'), 5), '42501');
reset role;
select atteso('i rifiuti non hanno scritto niente', quante_attive('Bonifico quota Neri')::text, '0');

\echo ''
\echo '--- 9. «Collegati prima»: abbinare una ricevuta già fatta ---'
select chi(:ANNA);
set role authenticated;
select vecchia(dati(18, jsonb_build_array(vr('QUOTA ASSOCIATIVA', 12000, bon(12000, '2026-10-01'))), '{}', '2026-10-01')) as ra \gset
select vecchia(dati(18, jsonb_build_array(vr('QUOTA ASSOCIATIVA', 12000, bon(12000, '2026-10-02'))), '{}', '2026-10-02')) as rlontana \gset
select vecchia(dati(19, jsonb_build_array(vr('QUOTA ASSOCIATIVA', 12000, bon(12000, '2026-09-03'))), '{}', '2026-09-03')) as raltra \gset
select vecchia(dati(18, jsonb_build_array(vr('QUOTA ASSOCIATIVA', 11000, bon(11000, '2026-09-03'))), '{}', '2026-09-03')) as rimporto \gset
select vecchia(dati(18, jsonb_build_array(vr('QUOTA ASSOCIATIVA', 12000, bon(12000, '2026-09-03', 'POS'))), '{}', '2026-09-03')) as rpos \gset
select vecchia(dati(18, jsonb_build_array(vr('QUOTA ASSOCIATIVA', 12000, bon(12000, '2026-09-03'))), '{}', '2026-09-03')) as rbuona \gset
select vecchia(dati(18, jsonb_build_array(vr('QUOTA ASSOCIATIVA', 12000, bon(12000, '2026-09-03'))), '{}', '2026-09-03')) as rok \gset
select annulla_ricevuta(:'rbuona'::uuid);
reset role;
-- I previsti prima di abbinare: i movimenti annullati al 5 li hanno già cambiati.
select previsto('Conto Corrente') as conto9, previsto('Cassa Contanti') as contanti9 \gset
select chi(:ADA);
set role authenticated;
select atteso('stessa persona, stesso importo, Bonifico, 30 giorni dopo: si abbina', abbina('Collegato prima A', :'ra'), 'nessun errore');
select atteso('…la ricevuta punta al movimento', com_ricevuta(:'ra'), 'bbbbbbbb-0000-0000-0000-000000000018|Collegato prima A|12000|false');
select atteso('la stessa ricevuta a un altro bonifico: no, ha già il suo', abbina('Collegato prima B', :'ra'),
  '22023 La ricevuta n. ' || numero(:'ra') || ' è già abbinata a un altro bonifico.');
select atteso('31 giorni dopo: no', abbina('Collegato prima B', :'rlontana'), '22023 La ricevuta e il bonifico distano più di 30 giorni.');
select atteso('la ricevuta di un''altra persona: no', abbina('Collegato prima B', :'raltra'), '22023 La ricevuta è di un’altra persona.');
select atteso('un altro importo: no', abbina('Collegato prima B', :'rimporto'), '22023 La ricevuta e il bonifico non hanno lo stesso importo.');
select atteso('pagata col POS: no', abbina('Collegato prima B', :'rpos'), '22023 La ricevuta non è tutta pagata con bonifico.');
select atteso('annullata: no', abbina('Collegato prima B', :'rbuona'), '22023 La ricevuta è annullata.');
select atteso('un bonifico che non esiste: no', left(rifiuto(format('select abbina_ricevuta_movimento(%L, %L)', gen_random_uuid(), :'rok')), 6), '22023 ');
select atteso('20 € assegnati al bonifico C', (select ass('Collegato prima C', jsonb_build_array(riga(18, 'Quota associativa 2026/27', 2000)))), 'nessun errore');
select atteso('…un bonifico che ha già soldi assegnati non si abbina', abbina('Collegato prima C', :'rok'),
  '22023 Il bonifico ha già dei soldi assegnati: annulla prima le ricevute e le assegnazioni.');
select atteso('un movimento che non si assegna (contanti): no', abbina('Contanti Pietro', :'rok'),
  '22023 I contanti non si assegnano da qui: registra il pagamento in PAGAMENTI.');
select atteso('l''abbinamento non ha cambiato i previsti', previsto('Conto Corrente')::text || '/' || previsto('Cassa Contanti')::text,
  :'conto9' || '/' || :'contanti9');
select annulla_ricevuta(:'ra'::uuid);
select atteso('annullata la ricevuta abbinata, il bonifico torna da assegnare', resta('Collegato prima A'), '12000');
reset role;

\echo ''
\echo '--- 10. il giorno è chiuso: si assegna e si fa la ricevuta lo stesso, la chiusura non cambia ---'
-- La Cassa Contanti chiusa fino al 19/10; il bonifico del 12/10 è in un'altra cassa, ma il giorno è nel periodo chiuso.
update casse set dal = '2026-09-01' where nome = 'Cassa Contanti';
insert into chiusure_cassa (id, cassa_id, dal, data, previsto, contato, differenza, chiusa_da) values
  ('ffffffff-0000-0000-0000-000000000010', (select id from casse where nome = 'Cassa Contanti'), '2026-09-01', '2026-10-19', 5000, 5000, 0,
   'aaaaaaaa-0000-0000-0000-000000000030');
select chiusure() as chiusure0, previsto('Cassa Contanti') as contanti1, previsto('Conto Corrente') as conto1 \gset
select chi(:ADA);
set role authenticated;
select atteso('assegnare nel giorno chiuso', ass('Bonifico giorno chiuso', jsonb_build_array(riga(16, 'Annuale Judo Kids', 10000))), 'nessun errore');
reset role;
select chi(:ANNA);
set role authenticated;
select da_mov(dati(16, jsonb_build_array(vr('ANNUALE JUDO KIDS', 10000, bon(10000, '2026-10-12'))), '{}', '2026-10-12'), 'Bonifico giorno chiuso') as rp \gset
select atteso('…e la ricevuta dal movimento', com_ricevuta(:'rp'), 'bbbbbbbb-0000-0000-0000-000000000016|Bonifico giorno chiuso|10000|false');
select atteso('la chiusura non è cambiata', chiusure(), :'chiusure0');
select atteso('…né il previsto della Cassa Contanti', previsto('Cassa Contanti')::text, :'contanti1');
select atteso('…né quello del Conto Corrente', previsto('Conto Corrente')::text, :'conto1');
reset role;

\echo ''
\echo '--- 11. un''assegnazione non diventa ricevuta da FANNE LA RICEVUTA: i soldi conterebbero due volte ---'
select chi(:ADA);
set role authenticated;
select atteso('50 € assegnati alla quota di Pietro', ass('Bonifico quota Neri', jsonb_build_array(riga(16, 'Quota associativa 2026/27', 5000))), 'nessun errore');
reset role;
select id as pd_neri from pagamenti_diretti where movimento_id = id_mov('Bonifico quota Neri') and annullato_il is null \gset
select quante_ricevute() as r_neri \gset
select chi(:ANNA);
set role authenticated;
select atteso('la ricevuta dal pagamento a mano di un''assegnazione: no, si fa dal movimento',
  rifiuto(format('select emetti_ricevuta_da_pagamento(%L, %L)', dati(16, jsonb_build_array(vr('QUOTA ASSOCIATIVA', 5000, bon(5000)))), :'pd_neri')),
  '22023 Questi soldi vengono da un bonifico: la ricevuta si fa dal movimento, in CONTABILITÀ.');
select atteso('…nessuna ricevuta nuova', (quante_ricevute() - :r_neri)::text, '0');
select atteso('…e l''assegnazione è ancora attiva', quante_attive('Bonifico quota Neri')::text, '1');
select atteso('dal movimento sì', left(ric_mov(dati(16, jsonb_build_array(vr('QUOTA ASSOCIATIVA', 5000, bon(5000)))), 'Bonifico quota Neri'), 13), 'nessun errore');
reset role;

\echo ''
\echo '--- 12. un bonifico con soldi assegnati non cambia persona né voce, e non si annulla con l''importazione ---'
insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione, persona_id, origine_import, creato_il) values
  ('entrata', '2026-10-15', 5000, id_voce('Corsi e altri pagamenti', 'entrata'), id_cassa('Conto Corrente'), 'Bonifico 12 persona', pid(19), null, now()),
  ('entrata', '2026-10-15', 5000, id_voce('Corsi e altri pagamenti', 'entrata'), id_cassa('Conto Corrente'), 'Banca 12', pid(19), 'banca:prova-12', '2026-10-20 10:00:00+02'),
  ('entrata', '2026-10-01', 12000, id_voce('Quota associativa', 'entrata'), id_cassa('Conto Corrente'), 'Bonifico 12 a mano', pid(15), null, now());
\set ASSEGNATO '''22023 Il movimento ha dei soldi assegnati: annulla prima ricevute e assegnazioni.'''
select chi(:ADA);
set role authenticated;
select atteso('20 € assegnati al bonifico di Dario', ass('Bonifico 12 persona', jsonb_build_array(riga(19, 'Quota associativa 2026/27', 2000))), 'nessun errore');
select atteso('collegarlo a un''altra persona: no',
  rifiuto(format('select collega_movimenti_persona(array[%L]::uuid[], %L)', id_mov('Bonifico 12 persona'), pid(14))), :ASSEGNATO);
select atteso('scollegarlo: no', rifiuto(format('select scollega_movimenti_persona(array[%L]::uuid[])', id_mov('Bonifico 12 persona'))), :ASSEGNATO);
select atteso('spostarlo su una voce che non si assegna: no',
  rifiuto(format('select cambia_voce_movimenti(array[%L]::uuid[], %L, %L)', id_mov('Bonifico 12 persona'), id_voce('Gare e trasferte', 'entrata'), pid(19))), :ASSEGNATO);
select atteso('…su «Quota associativa» sì: resta un bonifico che si assegna',
  rifiuto(format('select cambia_voce_movimenti(array[%L]::uuid[], %L, %L)', id_mov('Bonifico 12 persona'), id_voce('Quota associativa', 'entrata'), pid(19))), 'nessun errore');
select atteso('…e le assegnazioni restano', quante_attive('Bonifico 12 persona')::text, '1');
select atteso('50 € assegnati al bonifico della banca', ass('Banca 12', jsonb_build_array(riga(19, 'Quota associativa 2026/27', 5000))), 'nessun errore');
reset role;
select chi(:ANNA);
set role authenticated;
select da_mov(dati(19, jsonb_build_array(vr('QUOTA ASSOCIATIVA', 5000, bon(5000)))), 'Banca 12') as rb12 \gset
-- Il pagamento a mano di Marco, con la sua ricevuta, fatto prima di questo file: poi si abbina al bonifico.
select registra_pagamento_diretto(jsonb_build_object('persona_id', pid(15), 'data', '2026-10-01', 'importo', 12000, 'metodo', 'Bonifico', 'voce', 'QUOTA ASSOCIATIVA'))->>'id' as pd12 \gset
select emetti_ricevuta_da_pagamento(dati(15, jsonb_build_array(vr('QUOTA ASSOCIATIVA', 12000, bon(12000, '2026-10-01'))), '{}', '2026-10-01'), :'pd12')->>'id' as rm12 \gset
reset role;
select chi(:ADA);
set role authenticated;
select atteso('annullare l''importazione con la ricevuta del bonifico attiva: no',
  rifiuto(format('select annulla_importazione_banca(%L)', '2026-10-20 10:00:00+02')), '22023 Annulla prima la ricevuta n. ' || numero(:'rb12'));
select annulla_ricevuta(:'rb12'::uuid);
select atteso('di nuovo 30 € assegnati', ass('Banca 12', jsonb_build_array(riga(19, 'Quota associativa 2026/27', 3000))), 'nessun errore');
select atteso('senza ricevuta l''importazione si annulla', rifiuto(format('select annulla_importazione_banca(%L)', '2026-10-20 10:00:00+02')), 'nessun errore');
select atteso('…e le assegnazioni vanno via col movimento', quante_attive('Banca 12')::text, '0');
select atteso('la ricevuta del pagamento a mano si abbina al bonifico', abbina('Bonifico 12 a mano', :'rm12'), 'nessun errore');
select annulla_ricevuta(:'rm12'::uuid);
select atteso('annullata, il bonifico torna da assegnare', resta('Bonifico 12 a mano'), '12000');
reset role;
select atteso('…e il pagamento a mano resta annullato: se no i 120 € conterebbero due volte',
  (select (annullato_il is not null)::text from pagamenti_diretti where id = :'pd12'::uuid), 'true');
select atteso('il movimento della banca è annullato', (select (annullato_il is not null)::text from movimenti where descrizione = 'Banca 12'), 'true');
select atteso('…il bonifico di Dario è ancora suo', (select persona_id::text from movimenti where descrizione = 'Bonifico 12 persona'), pid(19)::text);

\echo ''
\echo '--- 13. la chiave: ripetere l''assegnazione dopo una rete caduta non la conta due volte (136-assegna-una-volta.sql) ---'
-- Ogni apertura del dialogo ha una chiave, dentro ogni riga come campo `chiave`. Stessa chiave sullo stesso bonifico: si
-- scrive la prima volta e basta, anche se le righe sono diventate ricevuta; su un altro bonifico è un errore.
insert into persone (id, nome, cognome, ruolo, attiva) select pid(n), 'Prova', 'Tetto ' || n, 'iscritto', true from generate_series(20, 30) n;
insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione, persona_id)
select 'entrata', d::date, imp, id_voce(v, 'entrata'), id_cassa('Conto Corrente'), descr, pid(p)
from (values
  ('2026-10-15', 10000, 'Corsi e altri pagamenti', 'Chiave A', 20),
  ('2026-10-15', 10000, 'Corsi e altri pagamenti', 'Chiave B', 20),
  ('2026-10-15', 6000, 'Corsi e altri pagamenti', 'Chiave C', 21),
  ('2026-10-15', 3000, 'Quota associativa', 'Quota 30', 22),
  ('2026-10-15', 3000, 'Quota associativa', 'Quota 25', 22),
  ('2026-10-15', 5000, 'Quota associativa', 'Quota 2025', 22),
  ('2026-07-31', 5000, 'Quota associativa', 'Quota luglio', 23),
  ('2026-08-01', 3000, 'Quota associativa', 'Quota agosto A', 23),
  ('2026-08-01', 3000, 'Quota associativa', 'Quota agosto B', 23),
  ('2026-10-15', 9000, 'Quota associativa', 'Quota doppia', 24),
  ('2026-10-15', 3000, 'Quota associativa', 'Quota ricevuta', 25),
  ('2026-10-15', 3000, 'Quota associativa', 'Quota dopo ricevuta', 25),
  ('2026-10-15', 3000, 'Quota associativa', 'Quota ricevuta a parte', 26),
  ('2026-10-15', 20000, 'Quota associativa', 'Quota senza listino', 27),
  ('2026-10-15', 80000, 'Corsi e altri pagamenti', 'Corso grande', 28),
  ('2026-10-15', 5000, 'Quota associativa', 'Quota ritentata', 29),
  ('2026-10-15', 3000, 'Quota associativa', 'Quota guardia', 30),
  ('2026-10-15', 3000, 'Quota associativa', 'Quota guardia due', 30),
  ('2026-10-15', 10000, 'Quota associativa', 'Quota nucleo', 10)
) t(d, imp, v, descr, p);
create or replace function rigak(p int, voce text, importo int, chiave text) returns jsonb language sql immutable as $$
  select jsonb_build_object('persona_id', pid(p), 'voce', voce, 'importo', importo, 'chiave', chiave) $$;
-- La voce di quota di una ricevuta, come la scrive `vociDaMovimento`: col prezzo del listino e la stagione.
create or replace function vq(importo int) returns jsonb language sql immutable as $$
  select vr('QUOTA ASSOCIATIVA', 5000, bon(importo)) || jsonb_build_object('dal', '2026-09-01', 'al', '2027-07-31') $$;
grant execute on function rigak(int, text, int, text), vq(int) to anon, authenticated;
\set K1 '99999999-0000-4000-8000-000000000001'
\set K2 '99999999-0000-4000-8000-000000000002'
\set K3 '99999999-0000-4000-8000-000000000003'
\set K4 '99999999-0000-4000-8000-000000000004'
\set K5 '99999999-0000-4000-8000-000000000005'
\set ALTRO_BONIFICO '''22023 Questa assegnazione è già stata fatta su un altro bonifico: chiudi la finestra e riaprila.'''
\set TETTO50 '''22023 Alla quota mancano 50,00 €: metti 50,00 € o meno, il resto rimane da assegnare.'''
\set TETTO20 '''22023 Alla quota mancano 20,00 €: metti 20,00 € o meno, il resto rimane da assegnare.'''
\set TETTO10 '''22023 Alla quota mancano 10,00 €: metti 10,00 € o meno, il resto rimane da assegnare.'''
\set TETTO0 '''22023 Alla quota mancano 0,00 €: metti 0,00 € o meno, il resto rimane da assegnare.'''

select chi(:ADA);
set role authenticated;
select atteso('40 € con la sua chiave: si assegna', ass('Chiave A', jsonb_build_array(rigak(20, 'Annuale Judo Kids', 4000, :'K1'))), 'nessun errore');
select atteso('…la stessa chiave ripetuta (la rete è caduta): nessun errore', ass('Chiave A', jsonb_build_array(rigak(20, 'Annuale Judo Kids', 4000, :'K1'))), 'nessun errore');
select atteso('…una riga sola, non due', quante_attive('Chiave A')::text, '1');
select atteso('…restano 60 € da assegnare', resta('Chiave A'), '6000');
select atteso('con la stessa chiave vale la prima scrittura, le righe non si confrontano: nessun errore',
  ass('Chiave A', jsonb_build_array(rigak(20, 'Trimestre Danza', 5000, :'K1'))), 'nessun errore');
select atteso('…e la riga è ancora quella di prima', attive('Chiave A'), 'bbbbbbbb-0000-0000-0000-000000000020|Annuale Judo Kids|4000|2026-10-15|Bonifico');
select atteso('la stessa chiave su un altro bonifico: rifiutata', ass('Chiave B', jsonb_build_array(rigak(20, 'Annuale Judo Kids', 4000, :'K1'))), :ALTRO_BONIFICO);
select atteso('…e nell''altro bonifico non è stato scritto niente', quante_attive('Chiave B')::text, '0');
select atteso('una chiave diversa è un''assegnazione nuova', ass('Chiave A', jsonb_build_array(rigak(20, 'Annuale Judo Kids', 3000, :'K2'))), 'nessun errore');
select atteso('…senza chiave anche, come nel 135', ass('Chiave A', jsonb_build_array(riga(20, 'Annuale Judo Kids', 2000))), 'nessun errore');
select atteso('…e senza chiave ripetuta si scrive due volte, come nel 135', ass('Chiave B', jsonb_build_array(riga(20, 'Annuale Judo Kids', 1000))) || '/' || ass('Chiave B', jsonb_build_array(riga(20, 'Annuale Judo Kids', 1000))),
  'nessun errore/nessun errore');
select atteso('…le righe del bonifico A sono 3, quelle di B 2', quante_attive('Chiave A') || '/' || quante_attive('Chiave B'), '3/2');
select atteso('…restano 10 € da assegnare su A', resta('Chiave A'), '1000');
-- Un''assegnazione con più righe: la chiave è su tutte, ripetuta non ne scrive altre.
select atteso('due righe con la stessa chiave su un bonifico nuovo', ass('Chiave B', jsonb_build_array(rigak(20, 'Annuale Judo Kids', 1000, :'K3'), rigak(20, 'Trimestre Danza', 1500, :'K3'))), 'nessun errore');
select atteso('…ripetute: nessun errore e nessuna riga in più', ass('Chiave B', jsonb_build_array(rigak(20, 'Annuale Judo Kids', 1000, :'K3'), rigak(20, 'Trimestre Danza', 1500, :'K3')))
  || '/' || quante_attive('Chiave B'), 'nessun errore/4');
reset role;

-- Dopo la ricevuta le righe sono annullate (col ricevuta_id): ripetere con la stessa chiave non deve riscrivere niente.
select chi(:ADA);
set role authenticated;
select atteso('60 € a Lia con la chiave', ass('Chiave C', jsonb_build_array(rigak(21, 'Annuale Judo Kids', 6000, :'K4'))), 'nessun errore');
reset role;
select chi(:ANNA);
set role authenticated;
select quante_ricevute() as r_chiave \gset
select da_mov(dati(21, jsonb_build_array(vr('ANNUALE JUDO KIDS', 6000, bon(6000)))), 'Chiave C') as rchiave \gset
select atteso('la ricevuta dal movimento: le righe sono annullate e legate a lei', annullate('Chiave C', 21), '1 annullate, 1 legate');
reset role;
select chi(:ADA);
set role authenticated;
select atteso('la stessa chiave dopo la ricevuta: nessun errore', ass('Chiave C', jsonb_build_array(rigak(21, 'Annuale Judo Kids', 6000, :'K4'))), 'nessun errore');
select atteso('…nessuna riga attiva in più', quante_attive('Chiave C')::text, '0');
select atteso('…le righe annullate sono ancora una', annullate('Chiave C', 21), '1 annullate, 1 legate');
select atteso('…i soldi sono una volta, nella ricevuta', resta('Chiave C'), '0');
select atteso('…nessuna ricevuta nuova', (quante_ricevute() - :r_chiave - 1)::text, '0');
select atteso('la stessa chiave, dopo la ricevuta, su un altro bonifico: rifiutata', ass('Chiave B', jsonb_build_array(rigak(20, 'Annuale Judo Kids', 1000, :'K4'))), :ALTRO_BONIFICO);
reset role;

\echo ''
\echo '--- 14. il tetto della quota: per persona e stagione, quanto costa la quota nel listino ---'
-- Prima senza listino: nessun tetto (come oggi). Un listino senza la quota è come vuoto.
select chi(:ADA);
set role authenticated;
select atteso('senza listino salvato: 80 € di quota passano', ass('Quota senza listino', jsonb_build_array(riga(27, 'Quota associativa 2026/27', 8000))), 'nessun errore');
reset role;
update impostazioni set listino = '{}'::jsonb;
set role authenticated;
select atteso('con un listino senza la quota: nessun tetto nemmeno qui', ass('Quota senza listino', jsonb_build_array(riga(27, 'Quota associativa 2026/27', 8000))), 'nessun errore');
reset role;
-- La quota del listino è in euro: 50 vuol dire 5.000 centesimi.
update impostazioni set listino = jsonb_build_object('quota', 50);
select chi(:ADA);
set role authenticated;
select atteso('30 € di quota assegnati', ass('Quota 30', jsonb_build_array(riga(22, 'Quota associativa 2026/27', 3000))), 'nessun errore');
select atteso('altri 25 € sulla quota: 55 € su 50, mancano 20 €', ass('Quota 25', jsonb_build_array(riga(22, 'Quota associativa 2026/27', 2500))), :TETTO20);
select atteso('…nessuna riga scritta', quante_attive('Quota 25')::text, '0');
select atteso('altri 20 € passano: la quota è piena', ass('Quota 25', jsonb_build_array(riga(22, 'Quota associativa 2026/27', 2000))), 'nessun errore');
select atteso('…poi anche 5 € in più no, e scrivere «QUOTA» in maiuscolo non cambia niente',
  ass('Quota 25', jsonb_build_array(riga(22, 'QUOTA ASSOCIATIVA 2026/27', 500))), :TETTO0);
select atteso('la quota di un''altra stagione (detta nel nome) è un altro conto: 50 € passano', ass('Quota 2025', jsonb_build_array(riga(22, 'Quota associativa 2025/26', 5000))), 'nessun errore');
select atteso('i corsi restano col tetto dell''app: 800 € su un annuale passano', ass('Corso grande', jsonb_build_array(riga(28, 'Annuale Judo Kids', 80000))), 'nessun errore');
-- Le righe nuove della stessa chiamata contano.
select atteso('due righe di quota nella stessa chiamata: 30 + 30 € su 50, mancano 50 €',
  ass('Quota doppia', jsonb_build_array(riga(24, 'Quota associativa 2026/27', 3000), riga(24, 'Quota associativa 2026/27', 3000))), :TETTO50);
select atteso('…nessuna riga scritta', quante_attive('Quota doppia')::text, '0');
select atteso('50 € in una riga sola passano', ass('Quota doppia', jsonb_build_array(riga(24, 'Quota associativa 2026/27', 5000))), 'nessun errore');
-- Il tetto è per persona: due fratelli, 50 € a testa.
select atteso('Luca e Sofia, 50 € di quota a testa nello stesso bonifico: passano',
  ass('Quota nucleo', jsonb_build_array(riga(11, 'Quota associativa 2026/27', 5000), riga(12, 'Quota associativa 2026/27', 5000))), 'nessun errore');
-- La stagione, se il nome non la dice, è quella della data del movimento: il 1° agosto comincia la nuova.
select atteso('«Quota associativa» senza stagione il 31 luglio: 50 € della stagione 2025/26', ass('Quota luglio', jsonb_build_array(riga(23, 'Quota associativa', 5000))), 'nessun errore');
select atteso('…il 1° agosto è la stagione 2026/27: 30 € passano anche se la 2025/26 è piena', ass('Quota agosto A', jsonb_build_array(riga(23, 'Quota associativa', 3000))), 'nessun errore');
select atteso('…altri 30 € il 1° agosto: mancano 20 €', ass('Quota agosto B', jsonb_build_array(riga(23, 'Quota associativa', 3000))), :TETTO20);
select atteso('…20 € passano', ass('Quota agosto B', jsonb_build_array(riga(23, 'Quota associativa', 2000))), 'nessun errore');
reset role;

\echo ''
\echo '--- 15. il tetto conta anche le ricevute: una volta sola, e quelle annullate no ---'
select chi(:ADA);
set role authenticated;
select atteso('30 € di quota assegnati a Ilaria', ass('Quota ricevuta', jsonb_build_array(riga(25, 'Quota associativa 2026/27', 3000))), 'nessun errore');
reset role;
select chi(:ANNA);
set role authenticated;
select da_mov(dati(25, jsonb_build_array(vq(3000))), 'Quota ricevuta') as rq25 \gset
select atteso('…diventano la ricevuta (quota 2026/27, pagati 30 €)', com_ricevuta(:'rq25'), 'bbbbbbbb-0000-0000-0000-000000000025|Quota ricevuta|3000|false');
reset role;
select chi(:ADA);
set role authenticated;
select atteso('30 € di quota nella ricevuta attiva, altri 25 €: mancano 20 €', ass('Quota dopo ricevuta', jsonb_build_array(riga(25, 'Quota associativa 2026/27', 2500))), :TETTO20);
select atteso('…nessuna riga scritta', quante_attive('Quota dopo ricevuta')::text, '0');
select annulla_ricevuta(:'rq25'::uuid);
select atteso('con la ricevuta annullata i 30 € non contano più: 25 € passano', ass('Quota dopo ricevuta', jsonb_build_array(riga(25, 'Quota associativa 2026/27', 2500))), 'nessun errore');
-- Le righe annullate perché diventate ricevuta contano tramite la ricevuta, non due volte: 30 + 20 = 50, non 60 + 20.
select atteso('30 € di quota assegnati a Mia', ass('Quota guardia', jsonb_build_array(riga(30, 'Quota associativa 2026/27', 3000))), 'nessun errore');
reset role;
select chi(:ANNA);
set role authenticated;
select da_mov(dati(30, jsonb_build_array(vq(3000))), 'Quota guardia') as rq30 \gset
reset role;
select chi(:ADA);
set role authenticated;
select atteso('…la riga è annullata e i 30 € sono nella ricevuta: altri 20 € passano (non si contano due volte)',
  ass('Quota guardia due', jsonb_build_array(riga(30, 'Quota associativa 2026/27', 2000))), 'nessun errore');
select atteso('…e 25 € no: mancano 0 € (30 + 20 già messi)', ass('Quota guardia due', jsonb_build_array(riga(30, 'Quota associativa 2026/27', 500))), :TETTO0);
reset role;
-- Una ricevuta fatta a parte (non da un bonifico) conta lo stesso.
select chi(:ANNA);
set role authenticated;
select vecchia(dati(26, jsonb_build_array(vq(4000)))) as rq26 \gset
reset role;
select chi(:ADA);
set role authenticated;
select atteso('40 € di quota in una ricevuta a parte, altri 20 €: mancano 10 €', ass('Quota ricevuta a parte', jsonb_build_array(riga(26, 'Quota associativa 2026/27', 2000))), :TETTO10);
select atteso('…10 € passano', ass('Quota ricevuta a parte', jsonb_build_array(riga(26, 'Quota associativa 2026/27', 1000))), 'nessun errore');
-- Il tentativo ripetuto che riempie la quota non deve cadere sul tetto: la chiave viene prima.
select atteso('50 € di quota con la chiave: passano', ass('Quota ritentata', jsonb_build_array(rigak(29, 'Quota associativa 2026/27', 5000, :'K5'))), 'nessun errore');
select atteso('…la stessa chiamata ripetuta (la quota è già piena) non è un errore', ass('Quota ritentata', jsonb_build_array(rigak(29, 'Quota associativa 2026/27', 5000, :'K5'))), 'nessun errore');
select atteso('…e la riga è una sola', quante_attive('Quota ritentata')::text, '1');
reset role;
-- Le persone si bloccano in ordine e con «for no key update»: «for update» si incrocia con la chiave esterna di
-- `pagamenti_diretti` (una scrittura su un'altra persona del nucleo che aspetta e una che blocca: stallo).
select atteso('blocca le persone in ordine, for no key update',
  (select (prosrc ~* 'order by p\.id for no key update' and prosrc !~* 'order by p\.id for update')::text
   from pg_proc where proname = 'assegna_movimento' and pronamespace = 'public'::regnamespace), 'true');

\echo ''
\echo 'TUTTO A POSTO'
