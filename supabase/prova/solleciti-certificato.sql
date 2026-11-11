-- I solleciti del certificato per email (143-solleciti-certificato.sql):
--   • `impostazioni`: solleciti_certificato (spenti), solleciti_momenti (da 1 a 6, ±60, senza doppioni),
--     sollecito_oggetto (una riga, solo {nome} {entro}), sollecito_testo ({link} obbligatorio,
--     solo {nome} {entro} {link}), sollecito_copia; con i valori di default;
--   • `solleciti_certificato_dovuti()`: solo `service_role`, scrive in `avvisi_segreteria` una riga per
--     mail di nucleo (chiave `cert:<persona>:<entro>:<momento>`); rilanciata non fa doppioni; non scrive
--     per sospesi, certificato valido, file in attesa, persona disattivata, senza termine, WhatsApp di oggi;
--     senza email del titolare la riga è `non_mandato = 'a_mano'`, e `solleciti_a_mano()` la mostra alla segreteria;
--   • `avvisi_da_mandare()` rende i solleciti anche senza `avvisi_indirizzi.a`, con `cc` solo sull'ultimo
--     momento, al più 100 al giorno; un sollecito di chi ha poi caricato il file si chiude `vuoto`;
--   • `avviso_mandato` scrive il sollecito (canale email, momento, link) in `solleciti`;
--   • `sospendi_solleciti(persona, sospesi)`; permessi: solo la segreteria (e service_role per le sue).
-- Le date sono tutte relative a oggi (Roma). Le metà in prova: scripts/prova-solleciti-certificato.mjs.
-- Si lancia dopo tablet.sql (segreteria Anna, istruttrice Maura).
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

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
-- Un rifiuto vero: una funzione o una tabella che non c'è ancora non è un permesso negato.
create or replace function rifiutata(sql text) returns text language plpgsql as $$
declare r text;
begin
  r := tenta(sql);
  return case when r like 'NEGATO:%' and r not like '%does not exist%' then 'rifiutata' else r end;
end $$;
create or replace function codice(sql text) returns text language plpgsql as $$
begin execute sql; return 'ok';
exception when others then return sqlstate;
end $$;
create or replace function oggi() returns date language sql stable as $$ select (now() at time zone 'Europe/Rome')::date $$;
create or replace function rel(d date) returns text language sql stable as $$ select coalesce((d - oggi())::text, '-') $$;
create or replace function pz(n int) returns uuid language sql immutable as $$
  select ('f3000000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;
create or replace function fl(n int, nome text) returns text language sql immutable as $$ select pz(n)::text || '/' || nome $$;
create or replace function persona_prova(n int, nome text, cognome text, anni int default 30, mail text default null)
  returns void language plpgsql as $$
begin
  insert into persone (id, nome, cognome, ruolo, email_contatto) values (pz(n), nome, cognome, 'iscritto', mail);
  if anni is not null then insert into anagrafiche (persona_id, nato_il) values (pz(n), (oggi() - make_interval(years => anni))::date); end if;
end $$;
-- Il termine di una persona, in giorni da oggi (la scheda si crea se manca).
create or replace function termine_a(n int, giorni int) returns void language sql as $$
  insert into schede_iscritti (persona_id, certificato_entro) values (pz(n), oggi() + giorni)
  on conflict (persona_id) do update set certificato_entro = excluded.certificato_entro
$$;
-- Quanti solleciti ha scritto la funzione di notte (la chiama service_role).
create or replace function dovuti() returns text language plpgsql as $$
declare r text;
begin
  set local role service_role;
  select solleciti_certificato_dovuti()::text into r;
  reset role;
  return r;
exception when others then reset role; return 'NEGATO: ' || sqlerrm;
end $$;
-- Le righe di sollecito nel registro: per indirizzo del titolare.
create or replace function riga_a(a text) returns text language sql stable as $$
  select coalesce(string_agg(coalesce(non_mandato, '-') || ' · ' || jsonb_array_length(dati->'persone') || ' · ' || coalesce((dati->>'copia'), '-'), ' ; '), 'niente')
    from avvisi_segreteria where tipo = 'sollecito_certificato' and dati->>'a' = a
$$;
create or replace function chiavi_a(a text) returns text language sql stable as $$
  select coalesce(string_agg(p->>'chiave', ' ; ' order by p->>'chiave'), 'niente')
    from avvisi_segreteria v, jsonb_array_elements(v.dati->'persone') p where v.tipo = 'sollecito_certificato' and v.dati->>'a' = a
$$;
-- Quelli che la Edge Function si vede rendere (service_role), per indirizzo `a`.
create or replace function da_mandare(a text) returns text language plpgsql as $$
declare r text;
begin
  set local role service_role;
  select coalesce(string_agg(x.a || ' · ' || coalesce(x.cc, '-') || ' · ' || (x.avviso->>'tipo') || ' · ' || jsonb_array_length(x.avviso->'persone'), ' ; '), 'niente') into r
    from avvisi_da_mandare() x where x.avviso->>'tipo' = 'sollecito_certificato' and x.a = da_mandare.a;
  reset role;
  return r;
exception when others then reset role; return 'NEGATO: ' || sqlerrm;
end $$;
create or replace function quanti_da_mandare() returns text language plpgsql as $$
declare r text;
begin
  set local role service_role;
  select count(*)::text into r from avvisi_da_mandare() x where x.avviso->>'tipo' = 'sollecito_certificato';
  reset role;
  return r;
exception when others then reset role; return 'NEGATO: ' || sqlerrm;
end $$;

-- Il link che il sollecito di una persona porta (la tabella dei link non la legge nessun ruolo).
create or replace function link_di(n int) returns uuid language sql stable security definer as $$
  select (p->>'link')::uuid from avvisi_segreteria v, jsonb_array_elements(v.dati->'persone') p where p->>'persona' = pz(n)::text limit 1
$$;
-- La Edge Function segna mandato un avviso (service_role).
create or replace function manda(i uuid) returns void language plpgsql as $$
begin
  set local role service_role;
  perform avviso_mandato(i);
  reset role;
end $$;

-- --- chi c'è ----------------------------------------------------------------
-- Da tablet.sql: Anna (segreteria, 1111…), Maura (istruttrice, 2222…). Ivo è un iscritto con l'accesso.
insert into auth.users (id, email) values ('77777777-7777-7777-7777-777777777777', 'ivo@ods.it');
insert into persone (id, nome, cognome, ruolo, utente_id) values (pz(33), 'Ivo', 'Iscritto', 'iscritto', '77777777-7777-7777-7777-777777777777');

select persona_prova(81, 'Marco', 'Rossi', 30, 'laura@ods.it');            -- il caso semplice
select persona_prova(84, 'Paola', 'Madre', 40, 'paola@ods.it');             -- titolare di un nucleo di due
select persona_prova(85, 'Elia', 'Madre', 12);
select persona_prova(86, 'Sara', 'Madre', 10);
select persona_prova(87, 'Tina', 'Zia', 40, 'tina@ods.it');                 -- titolare di un nucleo, un fratello con un altro termine
select persona_prova(88, 'Gigi', 'Zia', 12);
select persona_prova(89, 'Lia', 'Zia', 12);
select persona_prova(91, 'Sospeso', 'Uno', 30, 'x91@ods.it');
select persona_prova(92, 'Valido', 'Due', 30, 'x92@ods.it');
select persona_prova(93, 'Attesa', 'Tre', 30, 'x93@ods.it');
select persona_prova(94, 'Disattiva', 'Quattro', 30, 'x94@ods.it');
select persona_prova(95, 'Senzatermine', 'Cinque', 30, 'x95@ods.it');
select persona_prova(96, 'Whatsapp', 'Sei', 30, 'x96@ods.it');
select persona_prova(97, 'Rosa', 'Senzamail', 30);
select persona_prova(98, 'Ugo', 'Ultimo', 30, 'ugo@ods.it');
update persone set nucleo = pz(84) where id in (pz(85), pz(86));
update persone set nucleo = pz(87) where id in (pz(88), pz(89));
update persone set attiva = false where id = pz(94);
-- Tutti con il termine lontano (nessun momento cade oggi): lo si avvicina caso per caso.
select termine_a(n, 30) from unnest(array[81, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 96, 97, 98]) n;
update schede_iscritti set solleciti_sospesi = true where persona_id = pz(91);
update schede_iscritti set certificato_scade = oggi() + 100 where persona_id = pz(92);
update schede_iscritti set certificato_in_attesa = pz(93)::text || '/attesa-1.pdf', certificato_in_attesa_il = now() where persona_id = pz(93);
insert into solleciti (persona_id, creato_da) values (pz(96), 'aaaaaaaa-0000-0000-0000-000000000001');   -- WhatsApp segnato oggi

\echo ''
\echo '--- 1. le impostazioni: i valori di default, e cosa non entra ---'
select atteso('i solleciti sono spenti, tre momenti, oggetto e testo di default, con la copia',
  (select solleciti_certificato::text || ' · ' || solleciti_momenti::text || ' · ' || sollecito_oggetto || ' · ' || (sollecito_testo like '%{link}%')::text || ' · ' || sollecito_copia::text from impostazioni where id),
  'false · {-7,0,7} · Il certificato medico di {nome} · true · true');
select atteso('nessun momento: 23514', codice($$update impostazioni set solleciti_momenti = '{}' where id$$), '23514');
select atteso('sette momenti: 23514', codice($$update impostazioni set solleciti_momenti = '{-30,-20,-10,0,10,20,30}' where id$$), '23514');
select atteso('61 giorni dopo: 23514', codice($$update impostazioni set solleciti_momenti = '{61}' where id$$), '23514');
select atteso('61 giorni prima: 23514', codice($$update impostazioni set solleciti_momenti = '{-61}' where id$$), '23514');
select atteso('due momenti uguali: 23514', codice($$update impostazioni set solleciti_momenti = '{7,7}' where id$$), '23514');
select atteso('l''oggetto con un a capo: 23514', codice(format($$update impostazioni set sollecito_oggetto = %L where id$$, 'Il certificato' || chr(10) || 'Bcc: x@y.it')), '23514');
select atteso('l''oggetto con {cognome}: 23514', codice($$update impostazioni set sollecito_oggetto = 'Il certificato di {cognome}' where id$$), '23514');
select atteso('l''oggetto vuoto: 23514', codice($$update impostazioni set sollecito_oggetto = '' where id$$), '23514');
select atteso('l''oggetto di 201 caratteri: 23514', codice(format($$update impostazioni set sollecito_oggetto = %L where id$$, repeat('a', 201))), '23514');
select atteso('il testo senza {link}: 23514', codice($$update impostazioni set sollecito_testo = 'Portaci il certificato di {nome}.' where id$$), '23514');
select atteso('il testo con {cognome}: 23514', codice($$update impostazioni set sollecito_testo = 'Il certificato di {nome} {cognome}: {link}' where id$$), '23514');
select atteso('il testo vuoto: 23514', codice($$update impostazioni set sollecito_testo = '' where id$$), '23514');
select atteso('il testo di 4001 caratteri: 23514', codice(format($$update impostazioni set sollecito_testo = %L where id$$, '{link}' || repeat('a', 3995))), '23514');
select atteso('il testo di 4000 caratteri entra', codice(format($$update impostazioni set sollecito_testo = %L where id$$, '{link}' || repeat('a', 3994))), 'ok');
select atteso('sei momenti agli estremi entrano', codice($$update impostazioni set solleciti_momenti = '{-60,-30,-1,1,30,60}' where id$$), 'ok');
update impostazioni set sollecito_testo = default, solleciti_momenti = default where id;
select atteso('rimessi di default', (select solleciti_momenti::text from impostazioni where id), '{-7,0,7}');

\echo ''
\echo '--- 2. spenti non scrive; accesi scrive una riga, una volta sola; il giorno esatto ---'
select termine_a(81, 7);
select atteso('spenti: niente', dovuti(), '0');
update impostazioni set solleciti_certificato = true where id;
select atteso('accesi, entro fra 7 giorni e momento -7: una riga', dovuti(), '1');
select atteso('la riga: da mandare (non_mandato vuoto), una persona, senza copia', riga_a('laura@ods.it'), '- · 1 · false');
select atteso('la chiave è cert:<persona>:<entro>:-7', chiavi_a('laura@ods.it'), 'cert:' || pz(81) || ':' || (oggi() + 7) || ':-7');
select atteso('rilanciata: niente', dovuti(), '0');
select termine_a(81, 6);
select atteso('entro fra 6 giorni: il momento -7 è passato e il giorno esatto non è oggi', dovuti(), '0');
select atteso('e la riga di prima non si è moltiplicata', (select count(*)::text from avvisi_segreteria where tipo = 'sollecito_certificato'), '1');
select termine_a(81, 30);
delete from avvisi_segreteria where tipo = 'sollecito_certificato';

\echo ''
\echo '--- 3. il nucleo: una mail per titolare ---'
select termine_a(n, 7) from unnest(array[85, 86, 88]) n;
select termine_a(89, 3);
select atteso('due nuclei: due righe', dovuti(), '2');
select atteso('due figli dello stesso titolare con lo stesso termine: una riga con due persone', riga_a('paola@ods.it'), '- · 2 · false');
select atteso('e le due chiavi sono delle due persone',
  chiavi_a('paola@ods.it'), (select string_agg('cert:' || x || ':' || (oggi() + 7) || ':-7', ' ; ' order by 'cert:' || x || ':' || (oggi() + 7) || ':-7') from unnest(array[pz(85)::text, pz(86)::text]) x));
select atteso('un fratello con un altro termine non c''è oggi: solo Gigi', riga_a('tina@ods.it') || ' · ' || chiavi_a('tina@ods.it'),
  '- · 1 · false · cert:' || pz(88) || ':' || (oggi() + 7) || ':-7');
select atteso('ogni persona della riga ha il suo link', (select count(*)::text from avvisi_segreteria v, jsonb_array_elements(v.dati->'persone') p where v.tipo = 'sollecito_certificato' and p->>'link' is not null), '3');
select atteso('rilanciata: niente', dovuti(), '0');

\echo ''
\echo '--- 4. chi non riceve il sollecito ---'
select termine_a(n, 7) from unnest(array[91, 92, 93, 94, 96]) n;
select atteso('sospesi, certificato valido, file in attesa, persona disattivata, WhatsApp di oggi, senza termine: niente', dovuti(), '0');
select atteso('e Senzatermine non ha nemmeno una scheda', (select count(*)::text from schede_iscritti where persona_id = pz(95)), '0');

\echo ''
\echo '--- 5. senza email del titolare: a mano, e la segreteria lo vede ---'
select termine_a(97, 7);
select atteso('Rosa non ha email: una riga', dovuti(), '1');
select atteso('la riga è chiusa a_mano, senza indirizzo', (select non_mandato || ' · ' || coalesce(dati->>'a', '-') from avvisi_segreteria where dati->'persone'->0->>'persona' = pz(97)::text), 'a_mano · -');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria la vede in solleciti_a_mano: nome, cognome, termine, momento, da quando',
  (select nome || ' · ' || cognome || ' · ' || rel(entro) || ' · ' || momento || ' · ' || rel(dovuto_il) from solleciti_a_mano() where persona_id = pz(97)), 'Rosa · Senzamail · 7 · -7 · 0');
select atteso('segna il WhatsApp con il suo link',
  tenta(format($$select (segna_sollecito_link(pz(97), %L) is not null)::text$$, link_di(97))), 'true');
select atteso('segnato il sollecito, sparisce', (select count(*)::text from solleciti_a_mano() where persona_id = pz(97)), '0');
reset role;

\echo ''
\echo '--- 6. avvisi_da_mandare: senza indirizzo della segreteria, con la copia sull''ultimo momento ---'
select termine_a(98, -7);
select atteso('Ugo: il momento +7, l''ultimo: una riga', dovuti(), '1');
select atteso('con la copia', riga_a('ugo@ods.it'), '- · 1 · true');
update avvisi_indirizzi set a = null;
select atteso('senza indirizzo della segreteria il sollecito si rende lo stesso, senza copia', da_mandare('ugo@ods.it'), 'ugo@ods.it · - · sollecito_certificato · 1');
select atteso('anche il nucleo di Paola, senza copia', da_mandare('paola@ods.it'), 'paola@ods.it · - · sollecito_certificato · 2');
select atteso('la riga a_mano non si manda', quanti_da_mandare(), '3');
update avvisi_indirizzi set a = 'segreteria@ods.it';
select atteso('con l''indirizzo e la copia sull''ultimo momento: cc = a', da_mandare('ugo@ods.it'), 'ugo@ods.it · segreteria@ods.it · sollecito_certificato · 1');
select atteso('sugli altri momenti: cc vuoto', da_mandare('paola@ods.it'), 'paola@ods.it · - · sollecito_certificato · 2');

\echo ''
\echo '--- 7. avviso_mandato scrive il sollecito ---'
select atteso('Ugo: la riga in solleciti non c''è ancora', (select count(*)::text from solleciti where persona_id = pz(98)), '0');
select manda(id) from avvisi_segreteria where dati->>'a' = 'ugo@ods.it';
select atteso('canale email, momento 7, il link, nessun autore',
  (select canale || ' · ' || momento || ' · ' || (link_id is not null)::text || ' · ' || coalesce(creato_da::text, '-') from solleciti where persona_id = pz(98)), 'email · 7 · true · -');
select atteso('segnato mandato', (select (mandato_il is not null)::text from avvisi_segreteria where dati->>'a' = 'ugo@ods.it'), 'true');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('solleciti_di lo mostra: email, con link', (select string_agg(canale || '/' || con_link::text, ' ; ') from solleciti_di(pz(98))), 'email/true');
reset role;
select atteso('e non si rende più', da_mandare('ugo@ods.it'), 'niente');
select atteso('rilanciata, dopo il sollecito di oggi: niente', dovuti(), '0');

\echo ''
\echo '--- 8. un sollecito in coda, poi la persona carica: si chiude vuoto ---'
select atteso('Gigi è ancora in coda', da_mandare('tina@ods.it'), 'tina@ods.it · - · sollecito_certificato · 1');
update schede_iscritti set certificato_in_attesa = pz(88)::text || '/attesa-1.pdf', certificato_in_attesa_il = now() where persona_id = pz(88);
select atteso('Gigi ha caricato il file (in attesa): il sollecito non si rende più', da_mandare('tina@ods.it'), 'niente');
select atteso('e la riga si è chiusa vuoto', riga_a('tina@ods.it'), 'vuoto · 1 · false');

\echo ''
\echo '--- 9. i permessi ---'
select chi('');
set role anon;
select atteso('anon non chiama solleciti_certificato_dovuti', rifiutata($$select solleciti_certificato_dovuti()::text$$), 'rifiutata');
select atteso('anon non chiama solleciti_a_mano', rifiutata($$select count(*)::text from solleciti_a_mano()$$), 'rifiutata');
select atteso('anon non chiama sospendi_solleciti', rifiutata($$select sospendi_solleciti(pz(81), true)::text$$), 'rifiutata');
reset role;
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('Maura non chiama solleciti_certificato_dovuti', rifiutata($$select solleciti_certificato_dovuti()::text$$), 'rifiutata');
select atteso('Maura non chiama solleciti_a_mano', rifiutata($$select count(*)::text from solleciti_a_mano()$$), 'rifiutata');
select atteso('Maura non chiama sospendi_solleciti', rifiutata($$select sospendi_solleciti(pz(81), true)::text$$), 'rifiutata');
reset role;
select chi('77777777-7777-7777-7777-777777777777');
set role authenticated;
select atteso('Ivo (iscritto) non chiama solleciti_certificato_dovuti', rifiutata($$select solleciti_certificato_dovuti()::text$$), 'rifiutata');
select atteso('Ivo non chiama solleciti_a_mano', rifiutata($$select count(*)::text from solleciti_a_mano()$$), 'rifiutata');
select atteso('Ivo non chiama sospendi_solleciti', rifiutata($$select sospendi_solleciti(pz(81), true)::text$$), 'rifiutata');
reset role;
select atteso('dopo i rifiuti Marco non è sospeso', (select solleciti_sospesi::text from schede_iscritti where persona_id = pz(81)), 'false');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('Anna non chiama solleciti_certificato_dovuti (è di service_role)', rifiutata($$select solleciti_certificato_dovuti()::text$$), 'rifiutata');
select atteso('Anna chiama solleciti_a_mano', tenta($$select count(*)::text from solleciti_a_mano()$$), '0');
select atteso('Anna sospende Marco', tenta($$select sospendi_solleciti(pz(81), true)::text$$), '');
reset role;
select atteso('Marco è sospeso', (select solleciti_sospesi::text from schede_iscritti where persona_id = pz(81)), 'true');
select termine_a(81, 7);
select atteso('sospeso: non dovuto nemmeno nel giorno', dovuti(), '0');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('Anna lo riattiva', tenta($$select sospendi_solleciti(pz(81), false)::text$$), '');
select atteso('una persona disattivata: P0002', codice($$select sospendi_solleciti(pz(94), true)$$), 'P0002');
select atteso('una persona che non c''è: P0002', codice($$select sospendi_solleciti(gen_random_uuid(), true)$$), 'P0002');
reset role;
select atteso('riattivato: il sollecito parte', dovuti(), '1');

\echo ''
\echo '--- 10. il tetto: al più 100 al giorno, i più vecchi prima ---'
delete from avvisi_segreteria where tipo = 'sollecito_certificato';
-- 104 persone vere, ognuna con il suo link e un sollecito in coda (T001 la più vecchia).
do $$
declare i int; p uuid; l uuid; e date := oggi() + 30;
begin
  for i in 1..104 loop
    p := gen_random_uuid();
    insert into persone (id, nome, cognome, ruolo) values (p, 'T' || lpad(i::text, 3, '0'), 'Tetto', 'iscritto');
    insert into schede_iscritti (persona_id, certificato_entro) values (p, e);
    insert into link_certificato (persona_id) values (p) returning id into l;
    insert into avvisi_segreteria (tipo, chiave, creato_il, dati) values ('sollecito_certificato', 'cert:' || p || ':' || e || ':-7', now() - make_interval(mins => 300 - i),
      jsonb_build_object('a', 'tetto@ods.it', 'copia', false, 'persone', jsonb_build_array(
        jsonb_build_object('persona', p, 'chiave', 'cert:' || p || ':' || e || ':-7', 'link', l, 'momento', -7, 'entro', e))));
  end loop;
end $$;
select atteso('104 in coda, nessuno mandato', (select count(*)::text from avvisi_segreteria where tipo = 'sollecito_certificato' and mandato_il is null and non_mandato is null), '104');
select atteso('al più 100 per volta', quanti_da_mandare(), '100');
-- I tre più vecchi partono (come avviso_mandato): restano 101 in coda e il tetto del giorno ne lascia 97.
select manda(id) from (select id from avvisi_segreteria where tipo = 'sollecito_certificato' order by creato_il limit 3) x;
select atteso('i tre mandati hanno scritto il loro sollecito', (select count(*)::text from solleciti s join persone p on p.id = s.persona_id where p.cognome = 'Tetto' and s.canale = 'email'), '3');
select atteso('100 meno i 3 già mandati oggi: 97', quanti_da_mandare(), '97');
-- Il primo e l'ultimo nome fra quelli resi: i più vecchi prima.
create or replace function estremi_da_mandare() returns text language plpgsql as $$
declare r text;
begin
  set local role service_role;
  select min(x.avviso->'persone'->0->>'nome') || ' … ' || max(x.avviso->'persone'->0->>'nome') into r from avvisi_da_mandare() x where x.avviso->>'tipo' = 'sollecito_certificato';
  reset role;
  return r;
exception when others then reset role; return 'NEGATO: ' || sqlerrm;
end $$;
select atteso('i più vecchi prima: da T004 a T100', estremi_da_mandare(), 'T004 … T100');
select atteso('gli ultimi quattro restano in coda per domani', (select count(*)::text from avvisi_segreteria v where v.tipo = 'sollecito_certificato' and v.mandato_il is null and v.non_mandato is null), '101');
