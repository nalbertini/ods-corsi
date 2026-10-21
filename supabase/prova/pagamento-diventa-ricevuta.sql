-- Il pagamento a mano diventa ricevuta (89-pagamento-diventa-ricevuta.sql):
--   · `emetti_ricevuta_da_pagamento(dati, pagamento)` fa la ricevuta e annulla il pagamento a mano nella stessa
--     transazione, legandolo alla ricevuta (`pagamenti_diretti.ricevuta_id`): o tutte e due, o nessuna;
--   · nella ricevuta i pagamenti con il metodo e la data del pagamento a mano fanno esattamente il suo importo;
--   · la chiave del modulo (86) ripetuta dà la stessa ricevuta;
--   · `annulla_ricevuta` di quella ricevuta rimette il pagamento a mano SENZA RICEVUTA;
--   · il previsto della Cassa Contanti non cambia in nessuno dei passaggi.
-- Si lancia dopo finto-supabase.sql e i file dello schema, fino a 89-pagamento-diventa-ricevuta.sql.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'maura@ods.it'),
  ('33333333-3333-3333-3333-333333333333', 'lia@ods.it'),
  ('66666666-6666-6666-6666-666666666666', 'ada@ods.it');
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Maura', 'Uno', 'istruttore', 'maura@ods.it', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Lia', 'Blu', 'iscritto', 'lia@ods.it', '33333333-3333-3333-3333-333333333333'),
  ('aaaaaaaa-0000-0000-0000-000000000030', 'Ada', 'Conti', 'amministrazione', 'ada@ods.it', '66666666-6666-6666-6666-666666666666'),
  ('aaaaaaaa-0000-0000-0000-000000000010', 'Paolo', 'Bianchi', 'iscritto', null, null),
  ('aaaaaaaa-0000-0000-0000-000000000011', 'Sara', 'Verdi', 'iscritto', null, null);

-- I pagamenti a mano di Paolo, come li lascia `registra_pagamento_diretto`: id `cccccccc-…-0000000000NN`.
--   01-09 attivi, 28000 Contanti del 10/10 · 10 di Sara · 11 annullato a mano · 20-29 per i casi che vanno
create or replace function diretto(n int, quanto int default 28000, metodo text default 'Contanti', giorno date default '2026-10-10',
  persona uuid default 'aaaaaaaa-0000-0000-0000-000000000010') returns uuid language sql as $$
  insert into pagamenti_diretti (id, persona_id, data, importo, metodo, voce, creato_da)
  values (('cccccccc-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, persona, giorno, quanto, metodo, 'ANNUALE JUDO KIDS',
          'aaaaaaaa-0000-0000-0000-000000000001')
  returning id
$$;
select diretto(n) from generate_series(1, 9) n;
select diretto(10, persona => 'aaaaaaaa-0000-0000-0000-000000000011');
select diretto(11);
update pagamenti_diretti set annullato_il = now(), annullato_da = 'aaaaaaaa-0000-0000-0000-000000000001'
  where id = 'cccccccc-0000-0000-0000-000000000011';
select diretto(n) from generate_series(20, 29) n;

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
-- L'id di un pagamento a mano dal suo numero.
create or replace function pd(n int) returns uuid language sql immutable as $$
  select ('cccccccc-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid $$;
-- Un pagamento di una voce: data null = senza data.
create or replace function pg(quanto int, metodo text default 'Contanti', giorno text default '2026-10-10') returns jsonb language sql immutable as $$
  select jsonb_strip_nulls(jsonb_build_object('data', giorno, 'importo', quanto, 'metodo', metodo)) $$;
-- La ricevuta di Paolo del 10/10, con una voce da `prezzo` e i suoi pagamenti, più quel che cambia il caso.
create or replace function dati(prezzo int, pagamenti jsonb, extra jsonb default '{}') returns jsonb language sql immutable as $$
  select jsonb_build_object('persona_id', 'aaaaaaaa-0000-0000-0000-000000000010', 'data', '2026-10-10',
    'intestatario', jsonb_build_object('nome', 'Paolo', 'cognome', 'Bianchi'),
    'voci', jsonb_build_array(jsonb_build_object('descrizione', 'ANNUALE JUDO KIDS', 'quantita', 1, 'prezzo', prezzo, 'pagamenti', pagamenti))) || extra $$;
-- La chiamata, per un pagamento a mano dal suo numero (plpgsql: la funzione si cerca quando si chiama, non prima).
create or replace function da(n int, d jsonb) returns jsonb language plpgsql as $$
begin return emetti_ricevuta_da_pagamento(d, pd(n)); end $$;
-- Com'è un pagamento a mano: «attivo», o «annullato da <chi> · ricevuta n. N/AAAA», «annullato da <chi> · senza ricevuta».
-- Quel che legge la segreteria non serve: si legge da superutente.
create or replace function stato(n int) returns text language plpgsql security definer set search_path = public as $$
declare x pagamenti_diretti; r ricevute;
begin
  select * into x from pagamenti_diretti where id = pd(n);
  if not found then return 'non c’è'; end if;
  if x.annullato_il is null and x.annullato_da is null and x.ricevuta_id is null then return 'attivo'; end if;
  select * into r from ricevute where id = x.ricevuta_id;
  return concat('annullato', case when x.annullato_il is null then ' (senza data!)' end, ' da ', coalesce(x.annullato_da::text, 'nessuno'),
    ' · ', case when x.ricevuta_id is null then 'senza ricevuta' else 'ricevuta n. ' || coalesce(r.numero || '/' || r.anno, '?') end);
end $$;
create or replace function quante() returns int language sql security definer set search_path = public as $$
  select count(*)::int from ricevute $$;
create or replace function numero(id text) returns text language sql security definer set search_path = public as $$
  select numero || '/' || anno from ricevute where ricevute.id = numero.id::uuid $$;
create or replace function numero_chiave(k text) returns text language sql security definer set search_path = public as $$
  select numero || '/' || anno from ricevute where chiave = k::uuid $$;
create or replace function previsto() returns bigint language sql security definer set search_path = public as $$
  select previsto_cassa((select id from casse where nome = 'Cassa Contanti'), date '2026-10-10') $$;
grant execute on function rifiuto(text), atteso(text, text, text), chi(text), pd(int), pg(int, text, text), dati(int, jsonb, jsonb),
  da(int, jsonb), stato(int), quante(), numero(text), numero_chiave(text), previsto() to anon, authenticated;

-- Il testo del rifiuto quando il pagamento a mano non è nella ricevuta così com'è.
\set NON_COSI '''22023 Il pagamento a mano di 280 € (Contanti, 10/10/2026) va nella ricevuta così com’è: rimettilo, o annulla il pagamento e fai la ricevuta a mano'''

\echo ''
\echo '--- 1. la ricevuta dal pagamento a mano: fatta, e il pagamento annullato e legato a lei ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select quante() as prima \gset
select da(1, dati(28000, jsonb_build_array(pg(28000))))->>'id' as r1 \gset
select atteso('la ricevuta è nuova', (quante() - :prima)::text, '1');
select atteso('…con il suo numero', numero(:'r1'), '1/2026');
select atteso('il pagamento a mano è annullato da Anna e legato alla ricevuta', stato(1),
  'annullato da aaaaaaaa-0000-0000-0000-000000000001 · ricevuta n. 1/2026');
reset role;

\echo ''
\echo '--- 2. nella ricevuta il pagamento a mano così com''è: stesso metodo, stessa data, stesso importo ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select quante() as prima \gset
select atteso('con 250 € no', rifiuto($$select da(2, dati(28000, jsonb_build_array(pg(25000))))$$), :NON_COSI);
select atteso('con 280 € POS no', rifiuto($$select da(2, dati(28000, jsonb_build_array(pg(28000, 'POS'))))$$), :NON_COSI);
select atteso('con 280 € in contanti dell''11/10 no', rifiuto($$select da(2, dati(28000, jsonb_build_array(pg(28000, 'Contanti', '2026-10-11'))))$$), :NON_COSI);
select atteso('con 280 + 50 € in contanti del 10/10 no: più del pagamento a mano',
  rifiuto($$select da(2, dati(33000, jsonb_build_array(pg(28000), pg(5000))))$$), :NON_COSI);
select atteso('senza pagamenti no', rifiuto($$select da(2, dati(28000, '[]'))$$), :NON_COSI);
select atteso('nessuna ricevuta nuova', (quante() - :prima)::text, '0');
select atteso('…e il pagamento a mano resta attivo', stato(2), 'attivo');
select atteso('« contanti » minuscolo e con gli spazi è lo stesso metodo',
  (da(20, dati(28000, jsonb_build_array(pg(28000, ' contanti ')))) ? 'id')::text, 'true');
select atteso('senza data il pagamento è del giorno della ricevuta',
  (da(21, dati(28000, jsonb_build_array(pg(28000, 'Contanti', null)))) ? 'id')::text, 'true');
select atteso('140 + 140 € in contanti del 10/10 fanno 280: va',
  (da(22, dati(28000, jsonb_build_array(pg(14000), pg(14000)))) ? 'id')::text, 'true');
select atteso('si aggiungono pagamenti d''altro metodo: 280 € contanti + 100 € POS su 380 € va',
  (da(23, dati(38000, jsonb_build_array(pg(28000), pg(10000, 'POS')))) ? 'id')::text, 'true');
select atteso('…e d''altra data: 280 € contanti del 10/10 + 100 € contanti dell''11/10 va',
  (da(24, dati(38000, jsonb_build_array(pg(28000), pg(10000, 'Contanti', '2026-10-11')))) ? 'id')::text, 'true');
select atteso('e tutti quei pagamenti a mano sono diventati ricevuta', (select string_agg(left(stato(n), 9), ',') from generate_series(20, 24) n),
  'annullato,annullato,annullato,annullato,annullato');
reset role;

\echo ''
\echo '--- 3. già annullato, di un''altra persona, che non c''è ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select quante() as prima \gset
select atteso('annullato a mano no', rifiuto($$select da(11, dati(28000, jsonb_build_array(pg(28000))))$$),
  '22023 Questo pagamento a mano è già annullato: la ricevuta si fa da + FAI LA RICEVUTA');
select atteso('già diventato ricevuta no (senza la chiave del modulo)', rifiuto($$select da(1, dati(28000, jsonb_build_array(pg(28000))))$$),
  '22023 Questo pagamento a mano è già annullato: la ricevuta si fa da + FAI LA RICEVUTA');
select atteso('di Sara, nella ricevuta di Paolo, no', rifiuto($$select da(10, dati(28000, jsonb_build_array(pg(28000))))$$),
  '22023 Il pagamento a mano è di un’altra persona');
select atteso('un id che non c''è no', rifiuto($$select da(99, dati(28000, jsonb_build_array(pg(28000))))$$),
  '22023 Questo pagamento a mano non c’è più');
select atteso('nessuna ricevuta nuova', (quante() - :prima)::text, '0');
select atteso('…Sara resta attivo, l''annullato resta senza ricevuta', stato(10) || ' / ' || stato(11),
  'attivo / annullato da aaaaaaaa-0000-0000-0000-000000000001 · senza ricevuta');
reset role;

\echo ''
\echo '--- 4. o tutto o niente: se la ricevuta non si fa, il pagamento a mano resta ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select quante() as prima \gset
select atteso('pagato più del totale no', rifiuto($$select da(3, dati(20000, jsonb_build_array(pg(28000))))$$),
  '22023 Si è pagato più del totale: controlla gli importi');
select atteso('senza intestatario no', rifiuto($$select da(3, dati(28000, jsonb_build_array(pg(28000)), '{"intestatario": {}}'))$$),
  '22023 Servono nome e cognome del socio');
select atteso('nessuna ricevuta nuova', (quante() - :prima)::text, '0');
select atteso('…e il pagamento a mano resta attivo', stato(3), 'attivo');
reset role;

\echo ''
\echo '--- 5. la chiave del modulo: ripremuto dopo la rete caduta, la stessa ricevuta ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select da(4, dati(28000, jsonb_build_array(pg(28000)), '{"chiave": "bbbbbbbb-0000-0000-0000-000000000001"}'))->>'id' as r4 \gset
select quante() as prima \gset
select atteso('la stessa chiamata con la stessa chiave dà la stessa ricevuta',
  da(4, dati(28000, jsonb_build_array(pg(28000)), '{"chiave": "bbbbbbbb-0000-0000-0000-000000000001"}'))->>'id', :'r4');
select atteso('…anche se nel frattempo il modulo è cambiato',
  da(4, dati(29000, jsonb_build_array(pg(29000)), '{"chiave": "bbbbbbbb-0000-0000-0000-000000000001"}'))->>'id', :'r4');
select atteso('nessun numero nuovo', (quante() - :prima)::text, '0');
select atteso('il pagamento a mano è legato a quella', stato(4), 'annullato da aaaaaaaa-0000-0000-0000-000000000001 · ricevuta n. ' || numero(:'r4'));
-- Una ricevuta normale fatta da un modulo, poi lo stesso modulo prova a farla da un pagamento a mano.
select emetti_ricevuta(dati(5000, jsonb_build_array(pg(5000, 'POS')), '{"chiave": "bbbbbbbb-0000-0000-0000-000000000002"}')) is not null as fatta \gset
select quante() as prima \gset
select atteso('la chiave di una ricevuta senza questo pagamento no',
  rifiuto($$select da(5, dati(28000, jsonb_build_array(pg(28000)), '{"chiave": "bbbbbbbb-0000-0000-0000-000000000002"}'))$$),
  '22023 La ricevuta n. ' || numero_chiave('bbbbbbbb-0000-0000-0000-000000000002') || ' fatta da questo modulo non ha dentro questo pagamento a mano: chiudi il modulo e riaprilo');
select atteso('…la chiave del pagamento 4 col pagamento 5, no',
  rifiuto($$select da(5, dati(28000, jsonb_build_array(pg(28000)), '{"chiave": "bbbbbbbb-0000-0000-0000-000000000001"}'))$$),
  '22023 La ricevuta n. ' || numero(:'r4') || ' fatta da questo modulo non ha dentro questo pagamento a mano: chiudi il modulo e riaprilo');
select atteso('nessuna ricevuta nuova, e il pagamento 5 resta attivo', (quante() - :prima) || ' ' || stato(5), '0 attivo');
reset role;

\echo ''
\echo '--- 6. i ruoli ---'
select quante() as prima \gset
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('istruttore no', left(rifiuto($$select da(6, dati(28000, jsonb_build_array(pg(28000))))$$), 5), '42501');
select atteso('istruttore, con un id che non c''è: prima il ruolo', left(rifiuto($$select da(99, dati(28000, jsonb_build_array(pg(28000))))$$), 5), '42501');
reset role;
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('iscritto no', left(rifiuto($$select da(6, dati(28000, jsonb_build_array(pg(28000))))$$), 5), '42501');
select atteso('iscritto, con un id che non c''è: prima il ruolo', left(rifiuto($$select da(99, dati(28000, jsonb_build_array(pg(28000))))$$), 5), '42501');
reset role;
select chi('');
set role anon;
select atteso('chi non ha accesso no', left(rifiuto($$select da(6, dati(28000, jsonb_build_array(pg(28000))))$$), 5), '42501');
select atteso('chi non ha accesso, con un id che non c''è: no', left(rifiuto($$select da(99, dati(28000, jsonb_build_array(pg(28000))))$$), 5), '42501');
reset role;
select atteso('i rifiuti dei ruoli non hanno fatto ricevute', (quante() - :prima)::text, '0');
select atteso('…né toccato il pagamento a mano', stato(6), 'attivo');
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('amministrazione sì', (da(6, dati(28000, jsonb_build_array(pg(28000)))) ? 'id')::text, 'true');
select atteso('…e il pagamento a mano è annullato da Ada', stato(6), 'annullato da aaaaaaaa-0000-0000-0000-000000000030 · ricevuta n. …');
select atteso('amministrazione, già annullato: come la segreteria', rifiuto($$select da(11, dati(28000, jsonb_build_array(pg(28000))))$$),
  '22023 Questo pagamento a mano è già annullato: la ricevuta si fa da + FAI LA RICEVUTA');
reset role;

\echo ''
\echo '--- 7. annullare la ricevuta rimette il pagamento a mano SENZA RICEVUTA ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select annulla_ricevuta(:'r1'::uuid);
select atteso('la ricevuta è annullata', (select (annullata_il is not null)::text from ricevute where id = :'r1'::uuid), 'true');
select atteso('il pagamento a mano torna attivo: annullato_il, annullato_da e ricevuta_id vuoti', stato(1), 'attivo');
-- Una ricevuta normale annullata: i pagamenti a mano restano come sono.
select emetti_ricevuta(dati(28000, jsonb_build_array(pg(28000)))) ->> 'id' as normale \gset
select annulla_ricevuta(:'normale'::uuid);
select atteso('annullare una ricevuta normale non tocca i pagamenti a mano',
  stato(7) || ' / ' || stato(11),
  'attivo / annullato da aaaaaaaa-0000-0000-0000-000000000001 · senza ricevuta');
select atteso('…e quello della chiave resta legato alla sua', stato(4), 'annullato da aaaaaaaa-0000-0000-0000-000000000001 · ricevuta n. ' || numero(:'r4'));
select atteso('tornato attivo, se ne rifà la ricevuta con un''altra chiave',
  (da(1, dati(28000, jsonb_build_array(pg(28000)), '{"chiave": "bbbbbbbb-0000-0000-0000-000000000003"}')) ? 'id')::text, 'true');
select atteso('…e il pagamento a mano è legato alla nuova', stato(1),
  'annullato da aaaaaaaa-0000-0000-0000-000000000001 · ricevuta n. ' || numero_chiave('bbbbbbbb-0000-0000-0000-000000000003'));
reset role;

\echo ''
\echo '--- 8. la Cassa Contanti del 10/10 non cambia ---'
select previsto() as cassa \gset
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select da(8, dati(28000, jsonb_build_array(pg(28000))))->>'id' as r8 \gset
select atteso('dopo la ricevuta dal pagamento a mano, il previsto è lo stesso', previsto()::text, :'cassa');
select annulla_ricevuta(:'r8'::uuid);
select atteso('dopo l''annullo della ricevuta, il previsto è lo stesso', previsto()::text, :'cassa');
select atteso('…e il pagamento a mano è tornato', stato(8), 'attivo');
reset role;

\echo ''
\echo 'TUTTO A POSTO'
