-- Le pagine del sito a pezzi: `bozza_pezzi` (la struttura che la segreteria
-- compone) sta accanto alla bozza HTML. La scrive solo la segreteria, con
-- `salva_bozza_pezzi_sito` (stessa versione e stessi errori di
-- `salva_bozza_sito`, che non la tocca) o creando la pagina; il sito pubblico
-- non la vede mai; il testo HTML con codice si rifiuta come sempre.
-- Si lancia dopo finto-supabase.sql, i file dello schema (56-sito.sql e
-- 62-sito-pezzi.sql compresi). Parte da un database pulito: ha i suoi dati.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'maura@ods.it'),
  ('33333333-3333-3333-3333-333333333333', 'luca@ods.it'),
  ('44444444-4444-4444-4444-444444444444', 'bea@ods.it'),
  ('66666666-6666-6666-6666-666666666666', 'lotta@sale.ods-corsi.it');
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Maura', 'Uno', 'istruttore', 'maura@ods.it', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Luca', 'Rossi', 'iscritto', 'luca@ods.it', '33333333-3333-3333-3333-333333333333'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'Bea', 'Banco', 'staff', 'bea@ods.it', '44444444-4444-4444-4444-444444444444');
insert into sale (id, nome) values ('bbbbbbbb-0000-0000-0000-000000000001', 'Lotta');
insert into postazioni (id, nome, sala_id, utente_id) values
  ('dddddddd-0000-0000-0000-000000000001', 'Tablet Lotta', 'bbbbbbbb-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666666');

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
grant execute on function tenta(text), atteso(text, text, text), chi(text) to anon, authenticated;


\echo ''
\echo '--- 1. la segreteria crea la pagina e salva i pezzi ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('una pagina nuova può portare i pezzi',
  tenta($$insert into sito_pagine (slug, titolo, bozza, bozza_pezzi) values ('a-pezzi', 'A pezzi', '<p>Uno</p>', '{"content":[{"type":"testo","props":{"id":"a","html":"<p>Uno</p>"}}]}'::jsonb)$$), 'FATTO (1 righe)');
reset role; update sito_pagine set id = 'ffffffff-0000-0000-0000-0000000000a1' where slug = 'a-pezzi'; set role authenticated;
select atteso('i pezzi si rileggono', (select bozza_pezzi::text from sito_pagine where slug = 'a-pezzi'), ('{"content":[{"type":"testo","props":{"id":"a","html":"<p>Uno</p>"}}]}'::jsonb)::text);
select atteso('una pagina nuova senza pezzi li ha vuoti (vecchio editor)',
  tenta($$insert into sito_pagine (slug, titolo) values ('vecchio-editor', 'Vecchio editor')$$), 'FATTO (1 righe)');
select atteso('bozza_pezzi è null', (select (bozza_pezzi is null)::text from sito_pagine where slug = 'vecchio-editor'), 'true');
select atteso('salva i pezzi e la versione sale',
  tenta($$select salva_bozza_pezzi_sito('ffffffff-0000-0000-0000-0000000000a1', 1, 'A pezzi', 'Descrizione', '<div class="colonne c-2"><div class="colonna"><p>1</p></div><div class="colonna"><p>2</p></div></div>', '{"content":[{"type":"colonne","props":{"id":"b","colonne":[{"html":"<p>1</p>"},{"html":"<p>2</p>"}]}}]}'::jsonb)::text$$), '2');
select atteso('pezzi, bozza e titolo sono quelli',
  (select bozza_pezzi::text || ' | ' || bozza || ' | ' || titolo || ' | ' || descrizione from sito_pagine where id = 'ffffffff-0000-0000-0000-0000000000a1'),
  ('{"content":[{"type":"colonne","props":{"id":"b","colonne":[{"html":"<p>1</p>"},{"html":"<p>2</p>"}]}}]}'::jsonb)::text || ' | ' || '<div class="colonne c-2"><div class="colonna"><p>1</p></div><div class="colonna"><p>2</p></div></div>' || ' | A pezzi | Descrizione');
select atteso('il testo con le colonne passa il controllo del testo', (select sito_testo_sicuro('<div class="colonne c-2"><div class="colonna"><p>1</p></div><div class="colonna"><p>2</p></div></div>'))::text, 'true');
select atteso('una versione vecchia no',
  tenta($$select salva_bozza_pezzi_sito('ffffffff-0000-0000-0000-0000000000a1', 1, 'A pezzi', '', '<p>x</p>', '{"content":[{"type":"testo","props":{"id":"a","html":"<p>Uno</p>"}}]}'::jsonb)::text$$),
  'NEGATO: La pagina è cambiata mentre la modificavi: ricaricala per vedere le modifiche di chi l’ha toccata');
select atteso('e i pezzi di prima sono intatti', (select bozza_pezzi::text from sito_pagine where id = 'ffffffff-0000-0000-0000-0000000000a1'), ('{"content":[{"type":"colonne","props":{"id":"b","colonne":[{"html":"<p>1</p>"},{"html":"<p>2</p>"}]}}]}'::jsonb)::text);
select atteso('una pagina che non c''è',
  tenta($$select salva_bozza_pezzi_sito('ffffffff-0000-0000-0000-0000000000ff', 1, 'X', '', '<p>x</p>', '{"content":[{"type":"testo","props":{"id":"a","html":"<p>Uno</p>"}}]}'::jsonb)::text$$),
  'NEGATO: La pagina non c’è più');
select atteso('si può tornare a pezzi null (pagina senza pezzi)',
  tenta($$select salva_bozza_pezzi_sito('ffffffff-0000-0000-0000-0000000000a1', 2, 'A pezzi', '', '<p>x</p>', null)::text$$), '3');
select atteso('bozza_pezzi torna null', (select (bozza_pezzi is null)::text from sito_pagine where id = 'ffffffff-0000-0000-0000-0000000000a1'), 'true');
select atteso('rimette dei pezzi',
  tenta($$select salva_bozza_pezzi_sito('ffffffff-0000-0000-0000-0000000000a1', 3, 'A pezzi', '', '<p>x</p>', '{"content":[{"type":"testo","props":{"id":"a","html":"<p>Uno</p>"}}]}'::jsonb)::text$$), '4');
select atteso('salva con il vecchio editor: la versione sale',
  tenta($$select salva_bozza_sito('ffffffff-0000-0000-0000-0000000000a1', 4, 'A pezzi', '', '<p>Solo HTML</p>')::text$$), '5');
select atteso('e i pezzi restano com''erano', (select bozza_pezzi::text from sito_pagine where id = 'ffffffff-0000-0000-0000-0000000000a1'), ('{"content":[{"type":"testo","props":{"id":"a","html":"<p>Uno</p>"}}]}'::jsonb)::text);
select atteso('e la bozza è quella nuova', (select bozza from sito_pagine where id = 'ffffffff-0000-0000-0000-0000000000a1'), '<p>Solo HTML</p>');
reset role;

\echo ''
\echo '--- 2. cosa non entra ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('uno script nella bozza HTML no, anche con i pezzi',
  tenta($$select salva_bozza_pezzi_sito('ffffffff-0000-0000-0000-0000000000a1', 5, 'A pezzi', '', '<p>Ciao</p><script>alert(1)</script>', '{"content":[{"type":"testo","props":{"id":"a","html":"<p>Uno</p>"}}]}'::jsonb)::text$$), 'NEGATO: …');
select atteso('un onclick no',
  tenta($$select salva_bozza_pezzi_sito('ffffffff-0000-0000-0000-0000000000a1', 5, 'A pezzi', '', '<p onclick="x()">Ciao</p>', '{"content":[{"type":"testo","props":{"id":"a","html":"<p>Uno</p>"}}]}'::jsonb)::text$$), 'NEGATO: …');
select atteso('i pezzi non sono un oggetto: no',
  tenta($$select salva_bozza_pezzi_sito('ffffffff-0000-0000-0000-0000000000a1', 5, 'A pezzi', '', '<p>x</p>', '[1,2]'::jsonb)::text$$), 'NEGATO: …');
select atteso('i pezzi sono un testo JSON: no',
  tenta($$select salva_bozza_pezzi_sito('ffffffff-0000-0000-0000-0000000000a1', 5, 'A pezzi', '', '<p>x</p>', '"ciao"'::jsonb)::text$$), 'NEGATO: …');
select atteso('pezzi oltre 400000 caratteri: no',
  tenta($$select salva_bozza_pezzi_sito('ffffffff-0000-0000-0000-0000000000a1', 5, 'A pezzi', '', '<p>x</p>', jsonb_build_object('content', repeat('a', 400001)))::text$$), 'NEGATO: …');
select atteso('pezzi grandi ma sotto il limite: sì',
  tenta($$select salva_bozza_pezzi_sito('ffffffff-0000-0000-0000-0000000000a1', 5, 'A pezzi', '', '<p>x</p>', jsonb_build_object('content', repeat('a', 390000)))::text$$), '6');
select atteso('i rifiuti non hanno cambiato la versione', (select versione::text from sito_pagine where id = 'ffffffff-0000-0000-0000-0000000000a1'), '6');
select atteso('una pagina nuova con pezzi non oggetto: no',
  tenta($$insert into sito_pagine (slug, titolo, bozza_pezzi) values ('pezzi-storti', 'Storti', '[]'::jsonb)$$), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 3. chi non è segreteria non scrive i pezzi ---'
create or replace function prova_pezzi_estranei(chi_e text, senza_accesso boolean) returns setof text language sql as $$
  select atteso(chi_e || ' ' || c.cosa, tenta(c.sql), case when senza_accesso then c.voluto_anon else c.voluto end)
  from (values
    ('non salva i pezzi',
      $q$select salva_bozza_pezzi_sito('ffffffff-0000-0000-0000-0000000000a1', 6, 'Intruso', '', '<p>x</p>', '{"content":[]}'::jsonb)::text$q$,
      'NEGATO: Serve un accesso da segreteria', 'NEGATO: permission denied for function salva_bozza_pezzi_sito'),
    ('non crea una pagina con i pezzi',
      $q$insert into sito_pagine (slug, titolo, bozza_pezzi) values ('intruso', 'Intruso', '{"content":[]}'::jsonb)$q$,
      'NEGATO: …', 'NEGATO: permission denied for table sito_pagine'),
    ('non cambia i pezzi con un update',
      $q$update sito_pagine set bozza_pezzi = '{"content":[]}'::jsonb$q$,
      'NEGATO: …', 'NEGATO: permission denied for table sito_pagine'),
    ('non legge i pezzi',
      $q$select count(bozza_pezzi)::text from sito_pagine$q$,
      '0', 'NEGATO: permission denied for table sito_pagine')
  ) c(cosa, sql, voluto, voluto_anon)
$$;
grant execute on function prova_pezzi_estranei(text, boolean) to anon, authenticated;

select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select * from prova_pezzi_estranei('l''istruttore', false);
reset role;
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select * from prova_pezzi_estranei('l''iscritto', false);
reset role;
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select * from prova_pezzi_estranei('il tablet', false);
reset role;
select chi('');
set role anon;
select * from prova_pezzi_estranei('chi non ha l''accesso', true);
reset role;
select atteso('i pezzi non sono stati toccati dagli estranei', (select versione::text from sito_pagine where id = 'ffffffff-0000-0000-0000-0000000000a1'), '6');

\echo ''
\echo '--- 4. il sito pubblico non vede mai i pezzi ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('pubblica la pagina', tenta($$select pubblica_pagina_sito('ffffffff-0000-0000-0000-0000000000a1', 6)::text$$), '7');
select atteso('salva pezzi nuovi dopo la pubblicazione',
  tenta($$select salva_bozza_pezzi_sito('ffffffff-0000-0000-0000-0000000000a1', 7, 'A pezzi', '', '<p>Segreto di bozza</p>', '{"content":[{"type":"colonne","props":{"id":"b","colonne":[{"html":"<p>1</p>"},{"html":"<p>2</p>"}]}}]}'::jsonb)::text$$), '8');
reset role;
select chi('');
set role anon;
select atteso('sito_pagine_pubbliche ha le colonne di prima più i corsi collegati (67), nessuna dei pezzi',
  (select string_agg(a.attname, ',' order by a.attnum) from pg_proc p, unnest(p.proargnames, p.proargmodes) with ordinality as a(attname, m, attnum)
    where p.proname = 'sito_pagine_pubbliche' and a.m = 't'), 'slug,titolo,descrizione,testo,pubblicata_il,corsi_collegati');
select atteso('il pubblico legge il pubblicato, non la bozza',
  (select testo from sito_pagine_pubbliche() where slug = 'a-pezzi'), '<p>x</p>');
select atteso('nessun risultato porta la struttura dei pezzi',
  (select count(*)::text from sito_pagine_pubbliche() p where to_jsonb(p)::text like '%colonne%' or to_jsonb(p)::text like '%content%'), '0');
select atteso('né la bozza',
  (select count(*)::text from sito_pagine_pubbliche() p where to_jsonb(p)::text like '%Segreto di bozza%'), '0');
reset role;
