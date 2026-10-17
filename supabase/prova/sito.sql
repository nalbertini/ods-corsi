-- Il sito della palestra (pannello SITO): le pagine, il menu, il footer e i
-- rinvii li legge e li scrive solo la segreteria; chi non ha un accesso, o ce
-- l'ha da istruttore, iscritto o tablet, vede dal database solo il PUBBLICATO
-- delle pagine non nascoste (`sito_pagine_pubbliche`, `sito_menu_pubblico`,
-- `sito_redirect_pubblici`), mai una bozza. Il testo che porta codice si
-- rifiuta; chi salva con una versione vecchia si sente dire che la pagina è
-- cambiata; le pagine di legge non si nascondono né si cancellano; una pagina
-- nel menu non si cancella; cambiare indirizzo lascia un rinvio.
-- Si lancia dopo finto-supabase.sql, i file dello schema e 56-sito.sql.
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

-- Quello che chi non è segreteria non deve poter fare, uguale per istruttore,
-- iscritto, tablet e (con i suoi no) per chi non ha l'accesso.
create or replace function prova_estranei(chi_e text, senza_accesso boolean) returns setof text language sql as $$
  select atteso(chi_e || ' ' || c.cosa, tenta(c.sql), case when senza_accesso then c.voluto_anon else c.voluto end)
  from (values
    ('non legge le pagine', $q$select count(*)::text from sito_pagine$q$, '0', 'NEGATO: permission denied for table sito_pagine'),
    ('non legge il menu', $q$select count(*)::text from sito_menu$q$, '0', 'NEGATO: permission denied for table sito_menu'),
    ('non legge i rinvii', $q$select count(*)::text from sito_redirect$q$, '0', 'NEGATO: permission denied for table sito_redirect'),
    ('non scrive una pagina', $q$insert into sito_pagine (slug, titolo) values ('intruso', 'Intruso')$q$, 'NEGATO: …', 'NEGATO: permission denied for table sito_pagine'),
    ('non nasconde le pagine', $q$update sito_pagine set nascosta = true$q$, 'a vuoto (0 righe)', 'NEGATO: permission denied for table sito_pagine'),
    ('non cancella le pagine', $q$delete from sito_pagine$q$, 'a vuoto (0 righe)', 'NEGATO: permission denied for table sito_pagine'),
    ('non scrive nel menu', $q$insert into sito_menu (dove, etichetta, indirizzo, ordine) values ('menu', 'Intruso', '/x', 1)$q$, 'NEGATO: …', 'NEGATO: permission denied for table sito_menu'),
    ('non cancella il menu', $q$delete from sito_menu$q$, 'NEGATO: …', 'NEGATO: permission denied for table sito_menu'),
    ('non scrive un rinvio', $q$insert into sito_redirect (da, a) values ('intruso', 'home')$q$, 'NEGATO: …', 'NEGATO: permission denied for table sito_redirect'),
    ('non cancella i rinvii', $q$delete from sito_redirect$q$, 'NEGATO: …', 'NEGATO: permission denied for table sito_redirect'),
    ('non salva una bozza',
      $q$select salva_bozza_sito('ffffffff-0000-0000-0000-000000000001', 1, 'Intruso', '', '<p>Intruso</p>')::text$q$,
      'NEGATO: Serve un accesso da segreteria', 'NEGATO: permission denied for function salva_bozza_sito'),
    ('non pubblica', $q$select pubblica_pagina_sito('ffffffff-0000-0000-0000-000000000001', 1)::text$q$,
      'NEGATO: Serve un accesso da segreteria', 'NEGATO: permission denied for function pubblica_pagina_sito'),
    ('non cambia un indirizzo', $q$select cambia_indirizzo_sito('ffffffff-0000-0000-0000-000000000001', 'intruso')::text$q$,
      'NEGATO: Serve un accesso da segreteria', 'NEGATO: permission denied for function cambia_indirizzo_sito'),
    ('non salva il menu', $q$select salva_menu_sito('menu', '[]'::jsonb)::text$q$,
      'NEGATO: Serve un accesso da segreteria', 'NEGATO: permission denied for function salva_menu_sito')
  ) c(cosa, sql, voluto, voluto_anon)
$$;
grant execute on function prova_estranei(text, boolean) to anon, authenticated;

\echo ''
\echo '--- 1. la segreteria scrive le pagine, salva la bozza e pubblica ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('vede le quattro pagine che il sito ha sempre', (select count(*)::text from sito_pagine), '4');
select atteso('scrive una pagina e la rilegge',
  tenta($$insert into sito_pagine (slug, titolo, descrizione, bozza)
    values ('chi-siamo', 'Chi siamo', 'La palestra', '<p>Prima</p>') returning id$$), 'FATTO (1 righe)');
reset role; update sito_pagine set id = 'ffffffff-0000-0000-0000-000000000001' where slug = 'chi-siamo'; set role authenticated;
select atteso('la pagina nuova è alla versione 1, non pubblicata',
  (select versione || ' ' || (pubblicato is null)::text from sito_pagine where slug = 'chi-siamo'), '1 true');
select atteso('salva la bozza e la versione sale',
  tenta($$select salva_bozza_sito('ffffffff-0000-0000-0000-000000000001', 1, 'Chi siamo', 'La palestra', '<p>Testo uno</p>')::text$$), '2');
select atteso('la bozza è quella', (select bozza from sito_pagine where slug = 'chi-siamo'), '<p>Testo uno</p>');
select atteso('pubblica e la versione sale',
  tenta($$select pubblica_pagina_sito('ffffffff-0000-0000-0000-000000000001', 2)::text$$), '3');
select atteso('il pubblicato è la bozza', (select pubblicato from sito_pagine where slug = 'chi-siamo'), '<p>Testo uno</p>');
select atteso('e dice chi l''ha pubblicato',
  (select p.nome from sito_pagine s join persone p on p.id = s.pubblicata_da where s.slug = 'chi-siamo'), 'Anna');
-- Le tre pagine di legge si pubblicano (il footer le chiede), e due pagine di prova.
select atteso('pubblica la privacy', tenta($$select pubblica_pagina_sito(id, versione)::text from sito_pagine where slug = 'privacy'$$), '2');
select atteso('pubblica i cookie', tenta($$select pubblica_pagina_sito(id, versione)::text from sito_pagine where slug = 'cookie'$$), '2');
select atteso('pubblica i contributi pubblici', tenta($$select pubblica_pagina_sito(id, versione)::text from sito_pagine where slug = 'contributi-pubblici'$$), '2');
select atteso('scrive la pagina segreta',
  tenta($$insert into sito_pagine (slug, titolo, bozza) values ('segreto', 'Segreto', '<p>Non per tutti</p>')$$), 'FATTO (1 righe)');
reset role; update sito_pagine set id = 'ffffffff-0000-0000-0000-000000000002' where slug = 'segreto'; set role authenticated;
select atteso('e la pubblica', tenta($$select pubblica_pagina_sito('ffffffff-0000-0000-0000-000000000002', 1)::text$$), '2');
select atteso('scrive una pagina che resta in bozza',
  tenta($$insert into sito_pagine (slug, titolo, bozza) values ('bozza-sola', 'Solo bozza', '<p>Solo bozza</p>')$$), 'FATTO (1 righe)');
reset role; update sito_pagine set id = 'ffffffff-0000-0000-0000-000000000003' where slug = 'bozza-sola'; set role authenticated;
reset role;

\echo ''
\echo '--- 2. chi non ha fatto l''accesso vede solo il pubblicato, mai la bozza ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('nasconde la pagina segreta', tenta($$update sito_pagine set nascosta = true where slug = 'segreto'$$), 'FATTO (1 righe)');
reset role;
select chi('');
set role anon;
select atteso('le pagine pubbliche: né la nascosta, né quelle mai pubblicate',
  (select string_agg(slug, ',' order by slug) from sito_pagine_pubbliche()), 'chi-siamo,contributi-pubblici,cookie,privacy');
select atteso('il testo è il pubblicato', (select testo from sito_pagine_pubbliche() where slug = 'chi-siamo'), '<p>Testo uno</p>');
select atteso('il testo della pagina nascosta non esce',
  (select count(*)::text from sito_pagine_pubbliche() where testo like '%Non per tutti%'), '0');
select atteso('né quello della pagina mai pubblicata',
  (select count(*)::text from sito_pagine_pubbliche() where testo like '%Solo bozza%' or slug = 'bozza-sola'), '0');
reset role;

\echo ''
\echo '--- 3. si cambia la bozza dopo aver pubblicato: il sito resta com''era ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('salva una bozza nuova',
  tenta($$select salva_bozza_sito('ffffffff-0000-0000-0000-000000000001', 3, 'Chi siamo', 'La palestra', '<p>Bozza nuova</p>')::text$$), '4');
select atteso('la segreteria vede la bozza nuova e il vecchio pubblicato',
  (select bozza || ' | ' || pubblicato from sito_pagine where slug = 'chi-siamo'), '<p>Bozza nuova</p> | <p>Testo uno</p>');
reset role;
select chi('');
set role anon;
select atteso('chi non ha l''accesso vede ancora il testo di prima',
  (select testo from sito_pagine_pubbliche() where slug = 'chi-siamo'), '<p>Testo uno</p>');
select atteso('e la bozza nuova non esce',
  (select count(*)::text from sito_pagine_pubbliche() where testo like '%Bozza nuova%'), '0');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('pubblica la bozza nuova', tenta($$select pubblica_pagina_sito('ffffffff-0000-0000-0000-000000000001', 4)::text$$), '5');
reset role;
select chi('');
set role anon;
select atteso('adesso il sito ha il testo nuovo', (select testo from sito_pagine_pubbliche() where slug = 'chi-siamo'), '<p>Bozza nuova</p>');
reset role;

\echo ''
\echo '--- 4. il testo non porta codice ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
-- Il rifiuto è del vincolo sulla bozza, non d'altro.
select atteso('uno script in una pagina nuova no',
  tenta($$insert into sito_pagine (slug, titolo, bozza) values ('e1', 'E', '<p>Ciao</p><script>alert(1)</script>')$$),
  'NEGATO: new row for relation "sito_pagine" violates check constraint "sito_pagine_bozza_check"');
select atteso('nemmeno in maiuscolo',
  tenta($$insert into sito_pagine (slug, titolo, bozza) values ('e2', 'E', '<SCRIPT>alert(1)</SCRIPT>')$$),
  'NEGATO: new row for relation "sito_pagine" violates check constraint "sito_pagine_bozza_check"');
select atteso('un iframe no',
  tenta($$insert into sito_pagine (slug, titolo, bozza) values ('e3', 'E', '<iframe src="https://esempio.it"></iframe>')$$),
  'NEGATO: new row for relation "sito_pagine" violates check constraint "sito_pagine_bozza_check"');
select atteso('un onerror= no',
  tenta($$insert into sito_pagine (slug, titolo, bozza) values ('e4', 'E', '<img src="x.png" onerror="alert(1)">')$$),
  'NEGATO: new row for relation "sito_pagine" violates check constraint "sito_pagine_bozza_check"');
select atteso('uno style= no',
  tenta($$insert into sito_pagine (slug, titolo, bozza) values ('e5', 'E', '<p style="color:red">Rosso</p>')$$),
  'NEGATO: new row for relation "sito_pagine" violates check constraint "sito_pagine_bozza_check"');
select atteso('un link javascript: no',
  tenta($$insert into sito_pagine (slug, titolo, bozza) values ('e6', 'E', '<a href="javascript:alert(1)">Clicca</a>')$$),
  'NEGATO: new row for relation "sito_pagine" violates check constraint "sito_pagine_bozza_check"');
select atteso('un link data:text/html no',
  tenta($$insert into sito_pagine (slug, titolo, bozza) values ('e7', 'E', '<a href="data:text/html;base64,PHNjcmlwdD4=">Clicca</a>')$$),
  'NEGATO: new row for relation "sito_pagine" violates check constraint "sito_pagine_bozza_check"');
select atteso('il testo normale con «Data: 12 ottobre» e gli accenti passa',
  tenta($$insert into sito_pagine (slug, titolo, bozza)
    values ('testo-ok', 'Testo', '<p>Data: 12 ottobre. È già qui, perché la città è così: onestà = valore.</p><a href="https://ods.it/data">Data</a>')$$), 'FATTO (1 righe)');
reset role; update sito_pagine set id = 'ffffffff-0000-0000-0000-000000000004' where slug = 'testo-ok'; set role authenticated;
-- Lo stesso passando da salva_bozza_sito.
select atteso('uno script salvando la bozza no',
  tenta($$select salva_bozza_sito('ffffffff-0000-0000-0000-000000000004', 1, 'Testo', '', '<script>alert(1)</script>')::text$$),
  'NEGATO: new row for relation "sito_pagine" violates check constraint "sito_pagine_bozza_check"');
select atteso('un onerror= salvando la bozza no',
  tenta($$select salva_bozza_sito('ffffffff-0000-0000-0000-000000000004', 1, 'Testo', '', '<img src="x" onerror="alert(1)">')::text$$),
  'NEGATO: new row for relation "sito_pagine" violates check constraint "sito_pagine_bozza_check"');
select atteso('uno style= salvando la bozza no',
  tenta($$select salva_bozza_sito('ffffffff-0000-0000-0000-000000000004', 1, 'Testo', '', '<p style="x:y">x</p>')::text$$),
  'NEGATO: new row for relation "sito_pagine" violates check constraint "sito_pagine_bozza_check"');
select atteso('un link javascript: salvando la bozza no',
  tenta($$select salva_bozza_sito('ffffffff-0000-0000-0000-000000000004', 1, 'Testo', '', '<a href="javascript:alert(1)">x</a>')::text$$),
  'NEGATO: new row for relation "sito_pagine" violates check constraint "sito_pagine_bozza_check"');
select atteso('un link data: salvando la bozza no',
  tenta($$select salva_bozza_sito('ffffffff-0000-0000-0000-000000000004', 1, 'Testo', '', '<a href="data:text/html,x">x</a>')::text$$),
  'NEGATO: new row for relation "sito_pagine" violates check constraint "sito_pagine_bozza_check"');
select atteso('un iframe salvando la bozza no',
  tenta($$select salva_bozza_sito('ffffffff-0000-0000-0000-000000000004', 1, 'Testo', '', '<iframe src="x"></iframe>')::text$$),
  'NEGATO: new row for relation "sito_pagine" violates check constraint "sito_pagine_bozza_check"');
select atteso('i rifiuti non hanno cambiato né testo né versione',
  (select versione || ' ' || bozza from sito_pagine where slug = 'testo-ok'),
  '1 <p>Data: 12 ottobre. È già qui, perché la città è così: onestà = valore.</p><a href="https://ods.it/data">Data</a>');
select atteso('il testo normale si salva',
  tenta($$select salva_bozza_sito('ffffffff-0000-0000-0000-000000000004', 1, 'Testo', '', '<p>Data: 12 ottobre</p>')::text$$), '2');
reset role;

\echo ''
\echo '--- 5. la versione: chi salva per secondo sente che la pagina è cambiata ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('scrive la pagina',
  tenta($$insert into sito_pagine (slug, titolo, bozza) values ('versioni', 'Versioni', '<p>Uno</p>')$$), 'FATTO (1 righe)');
reset role; update sito_pagine set id = 'ffffffff-0000-0000-0000-000000000005' where slug = 'versioni'; set role authenticated;
select atteso('il primo salvataggio, con la versione giusta',
  tenta($$select salva_bozza_sito('ffffffff-0000-0000-0000-000000000005', 1, 'Versioni', '', '<p>Due</p>')::text$$), '2');
select atteso('lo stesso con la versione vecchia no',
  tenta($$select salva_bozza_sito('ffffffff-0000-0000-0000-000000000005', 1, 'Versioni', '', '<p>Tre</p>')::text$$),
  'NEGATO: La pagina è cambiata…');
select atteso('e il testo di prima è intatto', (select bozza from sito_pagine where slug = 'versioni'), '<p>Due</p>');
reset role;
select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('un''altra della segreteria salva sopra',
  tenta($$select salva_bozza_sito('ffffffff-0000-0000-0000-000000000005', 2, 'Versioni', '', '<p>Di Bea</p>')::text$$), '3');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('Anna, che aveva la versione 2, si sente dire che la pagina è cambiata',
  tenta($$select salva_bozza_sito('ffffffff-0000-0000-0000-000000000005', 2, 'Versioni', '', '<p>Di Anna</p>')::text$$),
  'NEGATO: La pagina è cambiata mentre la modificavi…');
select atteso('il lavoro di Bea è salvo', (select bozza from sito_pagine where slug = 'versioni'), '<p>Di Bea</p>');
select atteso('due salvataggi in fila con le versioni giuste passano (il secondo)',
  tenta($$select salva_bozza_sito('ffffffff-0000-0000-0000-000000000005', 3, 'Versioni', '', '<p>Quattro</p>')::text$$), '4');
select atteso('e il terzo', tenta($$select salva_bozza_sito('ffffffff-0000-0000-0000-000000000005', 4, 'Versioni', '', '<p>Cinque</p>')::text$$), '5');
select atteso('pubblicare con una versione vecchia no',
  tenta($$select pubblica_pagina_sito('ffffffff-0000-0000-0000-000000000005', 3)::text$$),
  'NEGATO: La pagina è cambiata…');
select atteso('con quella giusta sì', tenta($$select pubblica_pagina_sito('ffffffff-0000-0000-0000-000000000005', 5)::text$$), '6');
select atteso('salvare una pagina che non c''è dice che non c''è più',
  tenta($$select salva_bozza_sito('ffffffff-0000-0000-0000-0000000000ff', 1, 'X', '', '')::text$$), 'NEGATO: La pagina non c’è più');
select atteso('un titolo vuoto no',
  tenta($$select salva_bozza_sito('ffffffff-0000-0000-0000-000000000005', 6, '   ', '', '')::text$$), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 6. le pagine di legge non si nascondono né si cancellano ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la privacy non si cancella', tenta($$delete from sito_pagine where slug = 'privacy'$$), 'a vuoto (0 righe)');
select atteso('i cookie nemmeno', tenta($$delete from sito_pagine where slug = 'cookie'$$), 'a vuoto (0 righe)');
select atteso('i contributi pubblici nemmeno', tenta($$delete from sito_pagine where slug = 'contributi-pubblici'$$), 'a vuoto (0 righe)');
select atteso('la privacy non si nasconde, anche con un update diretto',
  tenta($$update sito_pagine set nascosta = true where slug = 'privacy'$$), 'NEGATO: …');
select atteso('i contributi pubblici nemmeno',
  tenta($$update sito_pagine set nascosta = true where slug = 'contributi-pubblici'$$), 'NEGATO: …');
select atteso('non diventa «non di legge» per poi nascondersi',
  tenta($$update sito_pagine set di_legge = false, nascosta = true where slug = 'cookie'$$), 'NEGATO: …');
select atteso('una pagina nuova non nasce di legge',
  tenta($$insert into sito_pagine (slug, titolo, di_legge) values ('finta-legge', 'Finta', true)$$), 'NEGATO: …');
select atteso('il testo pubblicato non si scrive a mano',
  tenta($$update sito_pagine set pubblicato = '<p>x</p>' where slug = 'chi-siamo'$$), 'NEGATO: …');
select atteso('né la bozza, saltando la versione',
  tenta($$update sito_pagine set bozza = '<p>x</p>' where slug = 'chi-siamo'$$), 'NEGATO: …');
select atteso('né una pagina nuova già pubblicata',
  tenta($$insert into sito_pagine (slug, titolo, pubblicato) values ('gia-fuori', 'Già fuori', '<p>x</p>')$$), 'NEGATO: …');
select atteso('le tre di legge sono ancora lì e visibili',
  (select count(*)::text from sito_pagine where di_legge and not nascosta), '3');
-- Un''altra pagina sì.
select atteso('scrive una pagina da togliere',
  tenta($$insert into sito_pagine (slug, titolo) values ('da-togliere', 'Da togliere')$$), 'FATTO (1 righe)');
reset role; update sito_pagine set id = 'ffffffff-0000-0000-0000-000000000006' where slug = 'da-togliere'; set role authenticated;
select atteso('la nasconde', tenta($$update sito_pagine set nascosta = true where slug = 'da-togliere'$$), 'FATTO (1 righe)');
select atteso('la rimostra', tenta($$update sito_pagine set nascosta = false where slug = 'da-togliere'$$), 'FATTO (1 righe)');
select atteso('la cancella', tenta($$delete from sito_pagine where slug = 'da-togliere'$$), 'FATTO (1 righe)');
reset role;

\echo ''
\echo '--- 7. l''indirizzo della pagina ---'
-- Il vincolo di `slug`, provato su una copia della tabella senza gli indici:
-- «privacy» e «cookie» ci sono già, e lì dentro sarebbero doppioni.
create temp table slug_prova (like sito_pagine including defaults including constraints);
select atteso('«' || s || '» va', tenta(format('insert into slug_prova (slug, titolo) values (%L, ''T'')', s)), 'FATTO (1 righe)')
  from unnest(array['chi-siamo', 'corsi-2026', 'a', 'home', 'privacy', 'cookie', repeat('a', 80)]) s;
select atteso('«' || left(s, 24) || '» no', tenta(format('insert into slug_prova (slug, titolo) values (%L, ''T'')', s)),
  'NEGATO: new row for relation "slug_prova" violates check constraint "sito_pagine_slug_check"')
  from unnest(array['Chi-Siamo', 'chi siamo', 'perché', 'chi--siamo', '-chi', 'chi-', '', 'chi_siamo', 'chi/siamo',
    'admin', 'api', 'app', 'contact', 'contattaci', 'sitemap', 'robots', repeat('a', 81)]) s;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('sulla tabella vera: «Admin» no', tenta($$insert into sito_pagine (slug, titolo) values ('Admin', 'Admin')$$), 'NEGATO: …');
select atteso('«admin» no', tenta($$insert into sito_pagine (slug, titolo) values ('admin', 'Admin')$$), 'NEGATO: …');
select atteso('un indirizzo già preso no', tenta($$insert into sito_pagine (slug, titolo) values ('chi-siamo', 'Doppione')$$), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 8. il menu e il footer ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('un menu valido si salva',
  tenta($$select salva_menu_sito('menu', '[
    {"etichetta": "Chi siamo", "pagina_id": "ffffffff-0000-0000-0000-000000000001"},
    {"etichetta": "Blog", "indirizzo": "https://blog.ods.it"}]'::jsonb)::text$$), '');
select atteso('le voci sono nell''ordine dato',
  (select string_agg(etichetta || '=' || ordine, ', ' order by ordine) from sito_menu where dove = 'menu'), 'Chi siamo=1, Blog=2');
select atteso('riscrivere il menu sostituisce le voci vecchie',
  tenta($$select salva_menu_sito('menu', '[
    {"etichetta": "Blog", "indirizzo": "https://blog.ods.it"},
    {"etichetta": "Scrivici", "indirizzo": "mailto:info@ods.it"},
    {"etichetta": "Chi siamo", "pagina_id": "ffffffff-0000-0000-0000-000000000001"}]'::jsonb)::text$$), '');
select atteso('restano solo le tre nuove, nell''ordine nuovo',
  (select count(*) || ': ' || string_agg(etichetta || '=' || ordine, ', ' order by ordine) from sito_menu where dove = 'menu'),
  '3: Blog=1, Scrivici=2, Chi siamo=3');
select atteso('una voce verso una pagina nascosta no, e dice quale',
  tenta($$select salva_menu_sito('menu', '[{"etichetta": "Segreta", "pagina_id": "ffffffff-0000-0000-0000-000000000002"}]'::jsonb)::text$$),
  'NEGATO: La voce «Segreta» porta a una pagina nascosta o non ancora pubblicata…');
select atteso('verso una pagina mai pubblicata no, e dice quale',
  tenta($$select salva_menu_sito('menu', '[{"etichetta": "Bozza", "pagina_id": "ffffffff-0000-0000-0000-000000000003"}]'::jsonb)::text$$),
  'NEGATO: La voce «Bozza» porta a una pagina nascosta o non ancora pubblicata…');
select atteso('verso una pagina che non c''è no',
  tenta($$select salva_menu_sito('menu', '[{"etichetta": "Fantasma", "pagina_id": "ffffffff-0000-0000-0000-0000000000ee"}]'::jsonb)::text$$),
  'NEGATO: La voce «Fantasma» porta a una pagina nascosta o non ancora pubblicata…');
select atteso('una voce senza destinazione no, e dice quale',
  tenta($$select salva_menu_sito('menu', '[{"etichetta": "Vuota"}]'::jsonb)::text$$),
  'NEGATO: La voce «Vuota» deve portare a una pagina oppure a un indirizzo…');
select atteso('una voce con tutte e due no',
  tenta($$select salva_menu_sito('menu', '[{"etichetta": "Doppia", "indirizzo": "/x", "pagina_id": "ffffffff-0000-0000-0000-000000000001"}]'::jsonb)::text$$),
  'NEGATO: La voce «Doppia» deve portare a una pagina oppure a un indirizzo…');
select atteso('una voce senza nome no',
  tenta($$select salva_menu_sito('menu', '[{"etichetta": "  ", "indirizzo": "/x"}]'::jsonb)::text$$), 'NEGATO: Ogni voce ha bisogno di un nome');
select atteso('un indirizzo javascript: no',
  tenta($$select salva_menu_sito('menu', '[{"etichetta": "Brutta", "indirizzo": "javascript:alert(1)"}]'::jsonb)::text$$), 'NEGATO: …');
select atteso('un indirizzo senza protocollo (//altro.it) no',
  tenta($$select salva_menu_sito('menu', '[{"etichetta": "Brutta", "indirizzo": "//altro.it"}]'::jsonb)::text$$), 'NEGATO: …');
select atteso('un posto che non è menu né footer no',
  tenta($$select salva_menu_sito('lato', '[]'::jsonb)::text$$), 'NEGATO: Il menu può essere solo quello in alto o il footer');
select atteso('i rifiuti non hanno toccato il menu',
  (select string_agg(etichetta, ', ' order by ordine) from sito_menu where dove = 'menu'), 'Blog, Scrivici, Chi siamo');
-- Il footer deve avere le tre pagine di legge.
select atteso('un footer senza i contributi pubblici no, e dice quale pagina',
  tenta($$select salva_menu_sito('footer', format('[
    {"etichetta": "Privacy", "pagina_id": "%s"},
    {"etichetta": "Cookie", "pagina_id": "%s"}]',
    (select id from sito_pagine where slug = 'privacy'), (select id from sito_pagine where slug = 'cookie'))::jsonb)::text$$),
  'NEGATO: Nel footer deve esserci «Contributi pubblici»…');
select atteso('un footer vuoto no', tenta($$select salva_menu_sito('footer', '[]'::jsonb)::text$$), 'NEGATO: Nel footer deve esserci «…');
select atteso('un footer con le tre pagine di legge e un indirizzo si salva',
  tenta($$select salva_menu_sito('footer', format('[
    {"etichetta": "Cookie", "pagina_id": "%s"},
    {"etichetta": "Privacy", "pagina_id": "%s"},
    {"etichetta": "Contributi pubblici", "pagina_id": "%s"},
    {"etichetta": "Instagram", "indirizzo": "https://instagram.com/ods"}]',
    (select id from sito_pagine where slug = 'cookie'), (select id from sito_pagine where slug = 'privacy'),
    (select id from sito_pagine where slug = 'contributi-pubblici'))::jsonb)::text$$), '');
select atteso('il footer è nell''ordine dato',
  (select string_agg(etichetta, ', ' order by ordine) from sito_menu where dove = 'footer'), 'Cookie, Privacy, Contributi pubblici, Instagram');
reset role;

\echo ''
\echo '--- 9. il menu che vede il sito ---'
select chi('');
set role anon;
select atteso('il footer e il menu, con le pagine pubblicate',
  (select string_agg(etichetta, ', ' order by dove, ordine) from sito_menu_pubblico()),
  'Cookie, Privacy, Contributi pubblici, Instagram, Blog, Scrivici, Chi siamo');
select atteso('una voce verso una pagina porta il suo indirizzo, una verso un indirizzo il suo',
  (select string_agg(coalesce(slug, indirizzo), ' ' order by ordine) from sito_menu_pubblico() where dove = 'menu'),
  'https://blog.ods.it mailto:info@ods.it chi-siamo');
reset role;
-- Una voce verso una pagina mai pubblicata, scritta a mano (la funzione non la lascia entrare).
insert into sito_menu (dove, etichetta, pagina_id, ordine) values ('menu', 'Mai pubblicata', 'ffffffff-0000-0000-0000-000000000003', 9);
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria nasconde «Chi siamo»', tenta($$update sito_pagine set nascosta = true where slug = 'chi-siamo'$$), 'FATTO (1 righe)');
reset role;
select chi('');
set role anon;
select atteso('il sito non mostra né la voce verso la pagina nascosta né quella verso la pagina mai pubblicata',
  (select string_agg(etichetta, ', ' order by dove, ordine) from sito_menu_pubblico()),
  'Cookie, Privacy, Contributi pubblici, Instagram, Blog, Scrivici');
reset role;
delete from sito_menu where etichetta = 'Mai pubblicata';
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria la rimostra', tenta($$update sito_pagine set nascosta = false where slug = 'chi-siamo'$$), 'FATTO (1 righe)');
reset role;
select chi('');
set role anon;
select atteso('e la voce torna', (select count(*)::text from sito_menu_pubblico() where etichetta = 'Chi siamo'), '1');
reset role;

\echo ''
\echo '--- 10. una pagina nel menu non si cancella ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('scrive e pubblica una pagina',
  tenta($$insert into sito_pagine (slug, titolo, bozza) values ('nel-menu', 'Nel menu', '<p>Ciao</p>')$$), 'FATTO (1 righe)');
reset role; update sito_pagine set id = 'ffffffff-0000-0000-0000-000000000007' where slug = 'nel-menu'; set role authenticated;
select atteso('pubblicata', tenta($$select pubblica_pagina_sito('ffffffff-0000-0000-0000-000000000007', 1)::text$$), '2');
select atteso('la mette nel menu',
  tenta($$select salva_menu_sito('menu', '[{"etichetta": "Nel menu", "pagina_id": "ffffffff-0000-0000-0000-000000000007"}]'::jsonb)::text$$), '');
select atteso('finché c''è, non si cancella', tenta($$delete from sito_pagine where slug = 'nel-menu'$$), 'NEGATO: …');
select atteso('è ancora lì', (select count(*)::text from sito_pagine where slug = 'nel-menu'), '1');
select atteso('la toglie dal menu',
  tenta($$select salva_menu_sito('menu', '[{"etichetta": "Blog", "indirizzo": "https://blog.ods.it"}]'::jsonb)::text$$), '');
select atteso('adesso si cancella', tenta($$delete from sito_pagine where slug = 'nel-menu'$$), 'FATTO (1 righe)');
reset role;

\echo ''
\echo '--- 11. cambiare indirizzo lascia un rinvio ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('«chi-siamo» diventa «la-palestra»',
  tenta($$select cambia_indirizzo_sito('ffffffff-0000-0000-0000-000000000001', 'la-palestra')::text$$), '');
select atteso('il vecchio indirizzo rimanda al nuovo',
  (select string_agg(da || '>' || a, ', ' order by da) from sito_redirect), 'chi-siamo>la-palestra');
select atteso('la pagina ha il nuovo indirizzo', (select slug from sito_pagine where id = 'ffffffff-0000-0000-0000-000000000001'), 'la-palestra');
select atteso('un indirizzo già di un’altra pagina no',
  tenta($$select cambia_indirizzo_sito('ffffffff-0000-0000-0000-000000000003', 'la-palestra')::text$$),
  'NEGATO: Questo indirizzo è già di un’altra pagina');
select atteso('nemmeno quello di una pagina di legge',
  tenta($$select cambia_indirizzo_sito('ffffffff-0000-0000-0000-000000000003', 'privacy')::text$$),
  'NEGATO: Questo indirizzo è già di un’altra pagina');
select atteso('un indirizzo scritto male no',
  tenta($$select cambia_indirizzo_sito('ffffffff-0000-0000-0000-000000000003', 'Nuovo Indirizzo')::text$$), 'NEGATO: …');
select atteso('uno riservato no',
  tenta($$select cambia_indirizzo_sito('ffffffff-0000-0000-0000-000000000003', 'admin')::text$$), 'NEGATO: …');
select atteso('una pagina che non c''è no',
  tenta($$select cambia_indirizzo_sito('ffffffff-0000-0000-0000-0000000000ff', 'altrove')::text$$), 'NEGATO: La pagina non c’è più');
select atteso('lo stesso indirizzo non fa niente, nemmeno un rinvio',
  tenta($$select cambia_indirizzo_sito('ffffffff-0000-0000-0000-000000000001', 'la-palestra')::text$$), '');
select atteso('(un solo rinvio)', (select count(*)::text from sito_redirect), '1');
select atteso('un secondo cambio: il primo rinvio punta all''ultimo indirizzo',
  tenta($$select cambia_indirizzo_sito('ffffffff-0000-0000-0000-000000000001', 'storia')::text$$), '');
select atteso('tutti e due i vecchi indirizzi portano a «storia»',
  (select string_agg(da || '>' || a, ', ' order by da) from sito_redirect), 'chi-siamo>storia, la-palestra>storia');
select atteso('tornando a un indirizzo vecchio, non resta un rinvio che gira su se stesso',
  tenta($$select cambia_indirizzo_sito('ffffffff-0000-0000-0000-000000000001', 'chi-siamo')::text$$), '');
select atteso('(la-palestra e storia portano a «chi-siamo»)',
  (select string_agg(da || '>' || a, ', ' order by da) from sito_redirect), 'la-palestra>chi-siamo, storia>chi-siamo');
select atteso('e di nuovo a «storia»', tenta($$select cambia_indirizzo_sito('ffffffff-0000-0000-0000-000000000001', 'storia')::text$$), '');
select atteso('(tutto come prima)',
  (select string_agg(da || '>' || a, ', ' order by da) from sito_redirect), 'chi-siamo>storia, la-palestra>storia');
select atteso('cambiare indirizzo fa salire la versione, e chi aveva la vecchia si sente dire che è cambiata',
  tenta($$select salva_bozza_sito('ffffffff-0000-0000-0000-000000000001', 5, 'Chi siamo', '', '<p>x</p>')::text$$),
  'NEGATO: La pagina è cambiata…');
-- Una pagina mai pubblicata cambia indirizzo: il rinvio c'è, ma al sito non arriva.
select atteso('la pagina mai pubblicata cambia indirizzo',
  tenta($$select cambia_indirizzo_sito('ffffffff-0000-0000-0000-000000000003', 'bozza-ferma')::text$$), '');
select atteso('(il rinvio c''è per la segreteria)', (select count(*)::text from sito_redirect), '3');
reset role;
select chi('');
set role anon;
select atteso('il sito vede solo i rinvii verso una pagina pubblicata',
  (select string_agg(da || '>' || a, ', ' order by da) from sito_redirect_pubblici()), 'chi-siamo>storia, la-palestra>storia');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria nasconde «storia»', tenta($$update sito_pagine set nascosta = true where slug = 'storia'$$), 'FATTO (1 righe)');
reset role;
select chi('');
set role anon;
select atteso('verso una pagina nascosta il sito non rimanda',
  coalesce((select string_agg(da || '>' || a, ', ' order by da) from sito_redirect_pubblici()), 'nessuno'), 'nessuno');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria la rimostra', tenta($$update sito_pagine set nascosta = false where slug = 'storia'$$), 'FATTO (1 righe)');
reset role;
select chi('');
set role anon;
select atteso('e i rinvii tornano',
  (select string_agg(da || '>' || a, ', ' order by da) from sito_redirect_pubblici()), 'chi-siamo>storia, la-palestra>storia');
reset role;

\echo ''
\echo '--- 12. chi non è segreteria ---'
-- Prima si fotografa tutto, per vedere alla fine che non è cambiato niente.
select md5(coalesce((select string_agg(t::text, '' order by id) from sito_pagine t), '')) as h_pagine,
       md5(coalesce((select string_agg(t::text, '' order by id) from sito_menu t), '')) as h_menu,
       md5(coalesce((select string_agg(t::text, '' order by da) from sito_redirect t), '')) as h_redirect \gset
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select * from prova_estranei('l''istruttore', false);
select atteso('l''istruttore vede però il pubblicato', (select (count(*) > 0)::text from sito_pagine_pubbliche()), 'true');
reset role;
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select * from prova_estranei('l''iscritto', false);
select atteso('l''iscritto vede però il pubblicato', (select (count(*) > 0)::text from sito_pagine_pubbliche()), 'true');
reset role;
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select * from prova_estranei('il tablet', false);
select atteso('il tablet vede però il pubblicato', (select (count(*) > 0)::text from sito_pagine_pubbliche()), 'true');
select atteso('e non le bozze', (select count(*)::text from sito_pagine_pubbliche() where testo like '%Solo bozza%'), '0');
reset role;
select chi('');
set role anon;
select * from prova_estranei('chi non ha l''accesso', true);
select atteso('chi non ha l''accesso vede però il pubblicato', (select (count(*) > 0)::text from sito_pagine_pubbliche()), 'true');
reset role;
select atteso('niente è cambiato nelle pagine',
  md5(coalesce((select string_agg(t::text, '' order by id) from sito_pagine t), '')), :'h_pagine');
select atteso('né nel menu',
  md5(coalesce((select string_agg(t::text, '' order by id) from sito_menu t), '')), :'h_menu');
select atteso('né nei rinvii',
  md5(coalesce((select string_agg(t::text, '' order by da) from sito_redirect t), '')), :'h_redirect');

\echo ''
\echo '--- 13. rilanciato: le pagine di prima restano come sono ---'
\ir ../56-sito.sql
select atteso('le pagine sono le stesse', md5(coalesce((select string_agg(t::text, '' order by id) from sito_pagine t), '')), :'h_pagine');
select atteso('il menu è lo stesso', md5(coalesce((select string_agg(t::text, '' order by id) from sito_menu t), '')), :'h_menu');
select chi('');
set role anon;
select atteso('chi non ha l''accesso non scrive nemmeno dopo il rilancio',
  tenta($$select salva_menu_sito('menu', '[]'::jsonb)::text$$), 'NEGATO: permission denied for function salva_menu_sito');
select atteso('né legge la tabella', tenta($$select count(*)::text from sito_pagine$$), 'NEGATO: permission denied for table sito_pagine');
reset role;

\echo ''
\echo '--- 14. il titolo e la descrizione di una bozza non escono prima di pubblicare ---'
-- Il titolo e la descrizione si cambiano con la bozza e sono parte di lei:
-- finché non si pubblica, il sito deve avere quelli di prima.
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('scrive e pubblica una pagina',
  tenta($$insert into sito_pagine (slug, titolo, descrizione, bozza)
    values ('titoli', 'Titolo pubblicato', 'Descrizione pubblicata', '<p>x</p>')$$), 'FATTO (1 righe)');
reset role; update sito_pagine set id = 'ffffffff-0000-0000-0000-000000000008' where slug = 'titoli'; set role authenticated;
select atteso('pubblicata', tenta($$select pubblica_pagina_sito('ffffffff-0000-0000-0000-000000000008', 1)::text$$), '2');
select atteso('cambia titolo e descrizione nella bozza',
  tenta($$select salva_bozza_sito('ffffffff-0000-0000-0000-000000000008', 2, 'Titolo di bozza', 'Descrizione di bozza', '<p>y</p>')::text$$), '3');
reset role;
select chi('');
set role anon;
select atteso('il sito ha ancora il titolo e la descrizione pubblicati',
  (select titolo || ' | ' || descrizione from sito_pagine_pubbliche() where slug = 'titoli'), 'Titolo pubblicato | Descrizione pubblicata');
reset role;

\echo ''
\echo '--- 15. i modi noti di aggirare il filtro del testo, e i testi veri che non vanno fermati ---'
-- Il filtro è una difesa in più (la pulizia vera è nell'app e nel generatore), ma i
-- giri già noti si fermano qui.
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('un «>» dentro un attributo non nasconde un onerror=',
  tenta($$insert into sito_pagine (slug, titolo, bozza) values ('b1', 'B', '<img src=x title=">" onerror=alert(1)>')$$),
  'NEGATO: new row for relation "sito_pagine" violates check constraint "sito_pagine_bozza_check"');
select atteso('né uno style=',
  tenta($$insert into sito_pagine (slug, titolo, bozza) values ('b2', 'B', '<p title=">" style="position:fixed;inset:0">x</p>')$$),
  'NEGATO: new row for relation "sito_pagine" violates check constraint "sito_pagine_bozza_check"');
select atteso('javascript&colon; con l''entità col nome no',
  tenta($$insert into sito_pagine (slug, titolo, bozza) values ('b3', 'B', '<a href="javascript&colon;alert(1)">x</a>')$$),
  'NEGATO: new row for relation "sito_pagine" violates check constraint "sito_pagine_bozza_check"');
select atteso('jav&Tab;ascript: no',
  tenta($$insert into sito_pagine (slug, titolo, bozza) values ('b4', 'B', '<a href="jav&Tab;ascript:alert(1)">x</a>')$$),
  'NEGATO: new row for relation "sito_pagine" violates check constraint "sito_pagine_bozza_check"');
select atteso('data&colon;text/html no',
  tenta($$insert into sito_pagine (slug, titolo, bozza) values ('b5', 'B', '<a href="data&colon;text/html,x">x</a>')$$),
  'NEGATO: new row for relation "sito_pagine" violates check constraint "sito_pagine_bozza_check"');
select atteso('javascript: con un tab in mezzo no',
  tenta($$insert into sito_pagine (slug, titolo, bozza) values ('b6', 'B', E'<a href="java\tscript:alert(1)">x</a>')$$),
  'NEGATO: new row for relation "sito_pagine" violates check constraint "sito_pagine_bozza_check"');
select atteso('un formaction= no',
  tenta($$insert into sito_pagine (slug, titolo, bozza) values ('b7', 'B', '<button formaction="javascript:alert(1)">x</button>')$$),
  'NEGATO: new row for relation "sito_pagine" violates check constraint "sito_pagine_bozza_check"');
-- I testi veri: un link con un parametro che comincia per «on» o «style» non è un attributo.
select atteso('un link con «?onsale=1» passa',
  tenta($$insert into sito_pagine (slug, titolo, bozza) values ('v1', 'V', '<p><a href="https://esempio.it/offerte?onsale=1&amp;one=2">Offerte</a></p>')$$), 'FATTO (1 righe)');
select atteso('un link con «?style=rosso» passa',
  tenta($$insert into sito_pagine (slug, titolo, bozza) values ('v2', 'V', '<p><a href="/catalogo?style=rosso">Catalogo</a></p>')$$), 'FATTO (1 righe)');
select atteso('«&amp;» nel testo e in un link passa',
  tenta($$insert into sito_pagine (slug, titolo, bozza) values ('v3', 'V', '<p>Danza &amp; teatro: <a href="https://esempio.it/a?x=1&amp;y=2">qui</a></p>')$$), 'FATTO (1 righe)');
reset role;

\echo ''
\echo '--- 16. gli indirizzi del menu, la home, le pagine di legge, due menu insieme ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('un indirizzo «/\evil.com» no (il browser lo legge come «//»)',
  tenta($$select salva_menu_sito('menu', '[{"etichetta":"a","indirizzo":"/\\evil.com"}]'::jsonb)::text$$), 'NEGATO: …');
select atteso('un indirizzo con le virgolette no',
  tenta($$select salva_menu_sito('menu', '[{"etichetta":"a","indirizzo":"/x\"onmouseover=\"alert(1)"}]'::jsonb)::text$$), 'NEGATO: …');
select atteso('un indirizzo «https://…» passa',
  tenta($$select salva_menu_sito('menu', '[{"etichetta":"Esterno","indirizzo":"https://esempio.it/x"}]'::jsonb)::text$$), '');
select atteso('la home non cambia indirizzo',
  tenta($$select cambia_indirizzo_sito((select id from sito_pagine where slug = 'home'), 'casa')::text$$), 'NEGATO: La home tiene il suo indirizzo');
select atteso('una pagina di legge non cambia indirizzo',
  tenta($$select cambia_indirizzo_sito((select id from sito_pagine where slug = 'contributi-pubblici'), 'contributi')::text$$), 'NEGATO: Le pagine di legge tengono il loro indirizzo');
select atteso('i vincoli sul nascondere una pagina di legge hanno un nome che l''app sa dire',
  tenta($$update sito_pagine set nascosta = true where slug = 'privacy'$$),
  'NEGATO: new row for relation "sito_pagine" violates check constraint "sito_pagine_legge_visibile"');
reset role;
