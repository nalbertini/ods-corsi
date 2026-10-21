-- Gli avvisi alla segreteria (84-avvisi-segreteria.sql): un'email quando
-- arriva una richiesta di iscrizione o un pagamento Satispay. Il database
-- decide cosa avvisare e quando, la Edge Function `avvisi-segreteria` scrive
-- e manda. Gli stessi casi, lato app, in scripts/prova-avvisi-segreteria.mjs.
--
-- I nomi che il file SQL deve avere:
--   • tabella `avvisi_segreteria`, il registro: un avviso per riga, mai due
--     con la stessa `chiave` (unica). Colonne almeno: id uuid · tipo text
--     ('richiesta' | 'pagamento' | 'pagamento_senza_richiesta') · chiave text
--     · creato_il timestamptz · mandato_il timestamptz · tentativi int
--     · non_mandato text ('tetto' | null). Dentro solo il minimo: mai note,
--     codice fiscale, data di nascita, nomi di file. Nessuno la scrive a mano;
--     anon, istruttori e amministrazione non la leggono.
--   • tabella `avvisi_indirizzi`, una riga: a text (null = avvisi spenti),
--     cc text (all'inizio 'asdilcentrojudo@gmail.com'), dal timestamptz (da
--     quando gli avvisi partono: quel che è arrivato prima non avvisa mai; la
--     mette il file una volta sola). Un indirizzo che non è un'email non
--     entra. La legge e la cambia solo la segreteria (`e_staff()`).
--   • `invia_iscrizione(dati)` tiene `dati->>'invio'`: le richieste mandate
--     insieme dallo stesso modulo (una famiglia) hanno la stessa chiave.
--   • `avvisi_da_mandare() returns table (id uuid, a text, cc text, avviso jsonb)`:
--     solo `service_role` (la Edge Function). Gli avvisi pronti e non ancora
--     mandati; `avviso` ha la forma di `Avviso` in src/lib/avvisoSegreteria.ts:
--       {tipo:'richiesta', arrivataIl, pagamento:{come:'satispay',importo,pagatoIl}|{come:'bonifico',ricevuta}|{come:'palestra'},
--        persone:[{richiestaId, nome, cognome, corsi:[nome del corso], fuoriEta:[nome del corso]}]}
--       {tipo:'pagamento', richiestaId, nome, cognome, corso, importo, pagatoIl, arrivataIl}
--       {tipo:'pagamento_senza_richiesta', nome, cognome, email, corso, importo, pagatoIl}
--     Una richiesta aspetta qualche minuto (al più cinque) prima di essere
--     pronta: le altre della famiglia e la ricevuta del bonifico arrivano
--     subito dopo. Un pagamento senza richiesta è pronto dopo un'ora.
--     Chiamata di nuovo ridà gli stessi finché non sono segnati: se la
--     funzione cade a metà, niente si perde. Senza `a`: nessuna riga, nessun
--     errore. Oltre i 50 mandati nel giorno di Roma: non li dà, li segna
--     `non_mandato = 'tetto'`.
--   • `avviso_preso(avviso uuid) returns boolean`: solo `service_role`; la
--     Edge Function prende l'avviso prima di mandarlo. Vero a chi lo prende,
--     falso a un'altra chiamata nei dieci minuti dopo: due chiamate insieme
--     non mandano la stessa mail. Preso dodici volte senza partire (la posta
--     che lo rifiuta): falso per sempre, segnato `non_mandato = 'guasto'`.
--   • `avviso_mandato(avviso uuid) returns void`: solo `service_role`; segna
--     `mandato_il`.
--   • Un avviso che non ha più niente da dire (le richieste eliminate prima
--     che parta) si chiude `non_mandato = 'vuoto'`. Il tetto conta solo i
--     mandati e quelli in coda di oggi.
--   • Mettere l'indirizzo quando non c'era riparte da lì (`dal = now()`): le
--     richieste arrivate ad avvisi spenti non avvisano.
--   • `avvisi_non_mandati_oggi() returns int`: solo la segreteria; quanti
--     avvisi di oggi non sono partiti.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'ada@ods.it'),
  ('55555555-5555-5555-5555-555555555555', 'maura@ods.it');
-- Anna: segreteria. Ada: solo amministrazione. Maura: istruttrice.
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Ada', 'Conti', 'amministrazione', 'ada@ods.it', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'Maura', 'Uno', 'istruttore', 'maura@ods.it', '55555555-5555-5555-5555-555555555555');
insert into corsi (id, nome) values
  ('cccccccc-0000-0000-0000-000000000001', 'Judo kids'),
  ('cccccccc-0000-0000-0000-000000000002', 'Karate'),
  ('cccccccc-0000-0000-0000-000000000003', 'Pilates');
-- Il listino: Karate è per chi ha fra 13 e 15 anni, gli altri per tutti.
update impostazioni set listino = jsonb_build_object(
  'quota', 30, 'saldoEntro', '2026-08-31', 'offerte', '[]'::jsonb,
  'corsi', jsonb_build_array(
    jsonb_build_object('corso', 'Judo kids', 'corsoId', 'cccccccc-0000-0000-0000-000000000001', 'eta', '', 'orari', '[]'::jsonb, 'prezzi', '[{"annuale": 90}]'::jsonb),
    jsonb_build_object('corso', 'Karate', 'corsoId', 'cccccccc-0000-0000-0000-000000000002', 'eta', '', 'orari', '[]'::jsonb, 'prezzi', '[{"annuale": 90}]'::jsonb,
      'natiDal', extract(year from current_date)::int - 15, 'natiAl', extract(year from current_date)::int - 13),
    jsonb_build_object('corso', 'Pilates', 'corsoId', 'cccccccc-0000-0000-0000-000000000003', 'eta', '', 'orari', '[]'::jsonb, 'prezzi', '[{"annuale": 90}]'::jsonb)))
  where id;

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
-- Una lettura che non passa: rifiutata, o vuota perché nessuna policy la lascia.
create or replace function non_legge(sql text) returns text language sql as $$
  select case when tenta(sql) ~ '^(NEGATO|0$)' then 'non legge' else tenta(sql) end
$$;
-- Una scrittura che non passa: rifiutata, o a vuoto perché nessuna policy la lascia.
create or replace function non_scrive(sql text) returns text language sql as $$
  select case when tenta(sql) ~ '^(NEGATO|a vuoto)' then 'non scrive' else tenta(sql) end
$$;
-- Un codice fiscale giusto, come in iscrizioni.sql: le lettere da nome e cognome, la data, Torino, il controllo.
create or replace function cf_prova(nome text, cognome text, nato date, donna boolean default false)
  returns text language sql stable security definer set search_path = public as $$
  select x || cf_controllo(x) from (
    select cf_lettere(nome, cognome) || to_char(nato, 'YY') || substr('ABCDEHLMPRST', extract(month from nato)::int, 1)
           || lpad((extract(day from nato)::int + case when donna then 40 else 0 end)::text, 2, '0') || 'L219' as x) q
$$;
-- Una richiesta dal modulo, come la manda il browser: chi ha meno di 18 anni col genitore, Laura Rossi.
create or replace function dal_modulo(nome text, cognome text, anni int, corso uuid, email text, invio uuid, cambi jsonb default '{}')
  returns jsonb language sql stable as $$
  select jsonb_build_object(
    'nome', nome, 'cognome', cognome, 'nato_il', (current_date - make_interval(years => anni))::date, 'nato_a', 'Torino',
    'codice_fiscale', cf_prova(nome, cognome, (current_date - make_interval(years => anni))::date),
    'indirizzo', 'Via Roma 1', 'cap', '10093', 'comune', 'Collegno', 'email', email, 'telefono', '347 111 2233',
    'corsi', jsonb_build_array(corso), 'formula', 'annuale', 'regolamento', true,
    'note', 'Ha l''asma, prende il Ventolin prima della lezione', 'invio', invio
  ) || case when anni < 18 then jsonb_build_object('genitore_nome', 'Laura', 'genitore_cognome', 'Rossi',
         'genitore_codice_fiscale', cf_prova('Laura', 'Rossi', '1985-03-01', true)) else '{}'::jsonb end
    || cambi
$$;
-- Una richiesta scritta direttamente, per i casi in cui il modulo non conta.
create or replace function richiesta(id uuid, nome text, cognome text, corso uuid, quando timestamptz default now()) returns void language sql as $$
  insert into richieste_iscrizione (id, nome, cognome, nato_il, nato_a, codice_fiscale, indirizzo, cap, comune, email, telefono, corsi, formula, note, creata_il)
  values (id, nome, cognome, '1990-01-01', 'Torino', 'XXXYYY90A01L219Z', 'via Roma 1', '10093', 'Collegno', 'prova@ods.it', '3331234567',
    array[corso], 'annuale', 'Ha l''asma, prende il Ventolin prima della lezione', quando)
$$;
-- Il tempo che passa: le richieste e gli avvisi non ancora partiti invecchiano di `minuti`.
-- In plpgsql: le tabelle e le funzioni nuove si cercano quando servono, non quando si scrive l'aiuto.
create or replace function invecchia(minuti int) returns void language plpgsql as $$
begin
  update richieste_iscrizione set creata_il = creata_il - make_interval(mins => minuti);
  update avvisi_segreteria set creato_il = creato_il - make_interval(mins => minuti) where mandato_il is null;
end $$;
-- Gli avvisi pronti che nominano qualcuno, e il primo di loro (li chiama la Edge Function: service_role).
create or replace function avvisi_per(nome text) returns text language plpgsql as $$
begin
  return (select count(*)::text from avvisi_da_mandare() x where x.avviso::text like '%' || nome || '%');
end $$;
create or replace function avviso_di(nome text) returns jsonb language plpgsql as $$
begin
  return (select x.avviso from avvisi_da_mandare() x where x.avviso::text like '%' || nome || '%' limit 1);
end $$;
-- La Edge Function li ha mandati tutti.
create or replace function manda_tutti() returns text language plpgsql as $$
declare r record; n int := 0;
begin
  for r in select * from avvisi_da_mandare() loop perform avviso_mandato(r.id); n := n + 1; end loop;
  return n::text;
end $$;
grant execute on function tenta(text), atteso(text, text, text), chi(text), non_legge(text), non_scrive(text), dal_modulo(text, text, int, uuid, text, uuid, jsonb),
  cf_prova(text, text, date, boolean), avvisi_per(text), avviso_di(text), manda_tutti() to anon, authenticated, service_role;

-- Gli avvisi partono da ieri: quel che arriva in questa prova è dopo, salvo le richieste vecchie della sezione 9.
update avvisi_indirizzi set dal = now() - interval '1 day';

\echo ''
\echo '--- 1. all''inizio: nessun indirizzo, la copia di sempre, e nessun avviso ---'
select atteso('una riga sola di indirizzi', (select count(*)::text from avvisi_indirizzi), '1');
select atteso('senza indirizzo, con la copia', (select coalesce(a, '-') || ' / ' || cc from avvisi_indirizzi), '- / asdilcentrojudo@gmail.com');
select richiesta('eeeeeeee-0000-0000-0000-000000000001', 'Spento', 'Primo', 'cccccccc-0000-0000-0000-000000000001', now() - interval '10 minutes');
set role service_role;
select atteso('senza indirizzo: nessun avviso da mandare, e nessun errore', tenta($$select count(*)::text from avvisi_da_mandare()$$), '0');
reset role;

\echo ''
\echo '--- 2. chi può cosa ---'
select chi('');
set role anon;
select atteso('anon non legge il registro', non_legge($$select count(*)::text from avvisi_segreteria$$), 'non legge');
select atteso('anon non legge gli indirizzi', non_legge($$select count(*)::text from avvisi_indirizzi$$), 'non legge');
select atteso('anon non scrive nel registro', non_scrive($$insert into avvisi_segreteria (tipo, chiave) values ('richiesta', 'finta')$$), 'non scrive');
select atteso('anon non cambia gli indirizzi', non_scrive($$update avvisi_indirizzi set a = 'ladro@esempio.it'$$), 'non scrive');
select atteso('anon non prende gli avvisi', tenta($$select count(*)::text from avvisi_da_mandare()$$), 'NEGATO: …');
select atteso('anon non segna un avviso mandato', tenta($$select avviso_mandato(gen_random_uuid())::text$$), 'NEGATO: …');
select atteso('anon non prende un avviso', tenta($$select avviso_preso(gen_random_uuid())::text$$), 'NEGATO: …');
select atteso('anon non conta gli avvisi persi', tenta($$select avvisi_non_mandati_oggi()::text$$), 'NEGATO: …');
reset role;

select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('l''istruttrice non legge il registro', non_legge($$select count(*)::text from avvisi_segreteria$$), 'non legge');
select atteso('né gli indirizzi', non_legge($$select count(*)::text from avvisi_indirizzi$$), 'non legge');
select atteso('non scrive nel registro', non_scrive($$insert into avvisi_segreteria (tipo, chiave) values ('richiesta', 'finta')$$), 'non scrive');
select atteso('non cambia gli indirizzi', non_scrive($$update avvisi_indirizzi set a = 'maura@esempio.it'$$), 'non scrive');
select atteso('non prende gli avvisi', tenta($$select count(*)::text from avvisi_da_mandare()$$), 'NEGATO: …');
select atteso('non conta gli avvisi persi', tenta($$select avvisi_non_mandati_oggi()::text$$), 'NEGATO: …');
reset role;

select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('l''amministrazione non legge gli indirizzi', non_legge($$select count(*)::text from avvisi_indirizzi$$), 'non legge');
select atteso('e non li cambia', non_scrive($$update avvisi_indirizzi set a = 'ada@esempio.it'$$), 'non scrive');
select atteso('non legge il registro', non_legge($$select count(*)::text from avvisi_segreteria$$), 'non legge');
select atteso('non prende gli avvisi', tenta($$select count(*)::text from avvisi_da_mandare()$$), 'NEGATO: …');
reset role;

select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria legge gli indirizzi', (select coalesce(a, '-') || ' / ' || cc from avvisi_indirizzi), '- / asdilcentrojudo@gmail.com');
select atteso('un indirizzo senza niente dopo la chiocciola non entra',
  tenta($$update avvisi_indirizzi set a = 'segreteria@officinedellosport'$$), 'NEGATO: …');
select atteso('nemmeno nella copia', tenta($$update avvisi_indirizzi set cc = 'copia@'$$), 'NEGATO: …');
select atteso('la segreteria mette l''indirizzo', tenta($$update avvisi_indirizzi set a = 'segreteria@officinedellosport.it'$$), 'FATTO (1 righe)');
select atteso('la segreteria non scrive nel registro', non_scrive($$insert into avvisi_segreteria (tipo, chiave) values ('richiesta', 'finta')$$), 'non scrive');
select atteso('non segna un avviso mandato', tenta($$select avviso_mandato(gen_random_uuid())::text$$), 'NEGATO: …');
select atteso('non prende un avviso', tenta($$select avviso_preso(gen_random_uuid())::text$$), 'NEGATO: …');
select atteso('non prende gli avvisi', tenta($$select count(*)::text from avvisi_da_mandare()$$), 'NEGATO: …');
select atteso('conta gli avvisi persi di oggi: nessuno', avvisi_non_mandati_oggi()::text, '0');
reset role;
select atteso('messo l''indirizzo, gli avvisi partono da adesso', (select (dal > now() - interval '1 minute')::text from avvisi_indirizzi), 'true');
-- La prova li fa partire da ieri: le richieste invecchiate a mano restano dopo.
update avvisi_indirizzi set dal = now() - interval '1 day';

\echo ''
\echo '--- 3. una richiesta arriva: un avviso ---'
select chi('');
set role anon;
select atteso('Marco Bianchi manda la richiesta',
  tenta($$select (invia_iscrizione(dal_modulo('Marco', 'Bianchi', 30, 'cccccccc-0000-0000-0000-000000000001', 'marco@esempio.it', null)) is not null)::text$$), 'true');
reset role;
set role service_role;
select atteso('appena arrivata aspetta: le altre della famiglia e la ricevuta arrivano subito dopo', avvisi_per('Bianchi'), '0');
reset role;
select invecchia(5);
-- Quel che la richiesta di Marco ha e l'avviso non deve dire (service_role le richieste non le legge).
select id as bianchi_id, codice_fiscale as bianchi_cf, nato_il as bianchi_nato from richieste_iscrizione where cognome = 'Bianchi' \gset
set role service_role;
select atteso('dopo cinque minuti: un avviso', avvisi_per('Bianchi'), '1');
select atteso('è di tipo richiesta, a chi va e in copia', (select x.avviso->>'tipo' || ' · ' || x.a || ' · ' || x.cc from avvisi_da_mandare() x where x.avviso::text like '%Bianchi%'),
  'richiesta · segreteria@officinedellosport.it · asdilcentrojudo@gmail.com');
select atteso('con nome, cognome e corso', (select p->>'nome' || ' ' || (p->>'cognome') || ' · ' || (p->'corsi'->>0) from jsonb_array_elements(avviso_di('Bianchi')->'persone') p), 'Marco Bianchi · Judo kids');
select atteso('il link porta alla sua richiesta', (avviso_di('Bianchi')->'persone'->0->>'richiestaId')::uuid::text,
  :'bianchi_id');
select atteso('senza ricevuta caricata: bonifico, nessuna ricevuta', avviso_di('Bianchi')->>'pagamento', '{"come": "bonifico", "ricevuta": false}');
select atteso('mai note, codice fiscale, data di nascita',
  (select string_agg(x, ', ') from unnest(array['Ventolin', 'asma', :'bianchi_cf', :'bianchi_nato', 'via Roma', 'Via Roma', '10093', 'marco@esempio.it']) x
   where avviso_di('Bianchi')::text like '%' || x || '%'), null);
select atteso('chiesti di nuovo prima di partire: lo stesso, una volta', avvisi_per('Bianchi'), '1');
reset role;
select atteso('nel registro una riga', (select count(*)::text from avvisi_segreteria where tipo = 'richiesta' and not ('eeeeeeee-0000-0000-0000-000000000001' = any(richieste))), '1');
select atteso('e nel registro niente note, codice fiscale, nascita',
  (select count(*)::text from avvisi_segreteria a where row_to_json(a)::text ~ ('Ventolin|' || :'bianchi_cf' || '|' || :'bianchi_nato')), '0');

-- La ricevuta del bonifico caricata dopo la richiesta: l'avviso lo dice.
select richiesta('eeeeeeee-0000-0000-0000-000000000002', 'Carla', 'Ferri', 'cccccccc-0000-0000-0000-000000000003', now() - interval '10 minutes');
insert into storage.objects (bucket_id, name) values ('iscrizioni', 'eeeeeeee-0000-0000-0000-000000000002/ricevuta.jpg');
set role service_role;
select atteso('ricevuta caricata: bonifico, con la ricevuta', avviso_di('Ferri')->>'pagamento', '{"come": "bonifico", "ricevuta": true}');
select atteso('e il nome del file non c''è', (avviso_di('Ferri')::text like '%ricevuta.jpg%')::text, 'false');
reset role;

\echo ''
\echo '--- 4. mandati: non tornano più ---'
set role service_role;
select atteso('la Edge Function li manda', (manda_tutti()::int >= 2)::text, 'true');
select atteso('chiamata di nuovo: Marco non c''è più', avvisi_per('Bianchi'), '0');
select atteso('né Carla', avvisi_per('Ferri'), '0');
reset role;
select atteso('restano nel registro, mandati', (select count(*)::text from avvisi_segreteria where mandato_il is not null and tipo = 'richiesta' and not ('eeeeeeee-0000-0000-0000-000000000001' = any(richieste))), '2');

\echo ''
\echo '--- 5. rifiutata o eliminata dopo l''avviso: nessun secondo avviso ---'
update richieste_iscrizione set stato = 'rifiutata' where cognome = 'Bianchi';
delete from richieste_iscrizione where cognome = 'Ferri';
set role service_role;
select atteso('rifiutata: niente', avvisi_per('Bianchi'), '0');
select atteso('eliminata: niente', avvisi_per('Ferri'), '0');
reset role;

\echo ''
\echo '--- 6. una famiglia di tre, mandata insieme: un avviso solo ---'
select chi('');
set role anon;
select atteso('Paolo Rossi', tenta($$select (invia_iscrizione(dal_modulo('Paolo', 'Rossi', 40, 'cccccccc-0000-0000-0000-000000000003', 'rossi@esempio.it', 'f0000000-0000-0000-0000-000000000001')) is not null)::text$$), 'true');
select atteso('Marco Rossi, 8 anni', tenta($$select (invia_iscrizione(dal_modulo('Marco', 'Rossi', 8, 'cccccccc-0000-0000-0000-000000000001', 'rossi@esempio.it', 'f0000000-0000-0000-0000-000000000001')) is not null)::text$$), 'true');
select atteso('Anna Rossi, 8 anni, a Karate', tenta($$select (invia_iscrizione(dal_modulo('Anna', 'Rossi', 8, 'cccccccc-0000-0000-0000-000000000002', 'rossi@esempio.it', 'f0000000-0000-0000-0000-000000000001')) is not null)::text$$), 'true');
-- Un'altra famiglia, mandata a parte: il suo avviso è suo.
select atteso('Teo Verdi, un altro invio', tenta($$select (invia_iscrizione(dal_modulo('Teo', 'Verdi', 40, 'cccccccc-0000-0000-0000-000000000003', 'verdi@esempio.it', 'f0000000-0000-0000-0000-000000000002')) is not null)::text$$), 'true');
reset role;
select invecchia(5);
set role service_role;
select atteso('un avviso solo per i Rossi', avvisi_per('Rossi'), '1');
select atteso('con tutti e tre', (select string_agg(p->>'nome', ', ' order by p->>'nome') from jsonb_array_elements(avviso_di('Rossi')->'persone') p), 'Anna, Marco, Paolo');
select atteso('ognuno col suo corso', (select string_agg((p->>'nome') || ' ' || (p->'corsi'->>0), ', ' order by p->>'nome') from jsonb_array_elements(avviso_di('Rossi')->'persone') p),
  'Anna Karate, Marco Judo kids, Paolo Pilates');
select atteso('Anna è fuori età per Karate, gli altri no',
  (select string_agg((p->>'nome') || ':' || coalesce((select string_agg(f, '+') from jsonb_array_elements_text(p->'fuoriEta') f), '-'), ', ' order by p->>'nome')
     from jsonb_array_elements(avviso_di('Rossi')->'persone') p), 'Anna:Karate, Marco:-, Paolo:-');
select atteso('il genitore, la nascita e il codice fiscale non ci sono',
  (select string_agg(x, ', ') from unnest(array['Laura', 'Ventolin', cf_prova('Marco', 'Rossi', (current_date - interval '8 years')::date),
     (current_date - interval '8 years')::date::text]) x where avviso_di('Rossi')::text like '%' || x || '%'), null);
select atteso('Teo ha il suo', avvisi_per('Verdi'), '1');
select atteso('e nel suo i Rossi non ci sono', (avviso_di('Verdi')::text like '%Rossi%')::text, 'false');
select atteso('mandati', (manda_tutti()::int >= 2)::text, 'true');
reset role;
select atteso('nel registro: una riga per i Rossi', (select count(*)::text from avvisi_segreteria where tipo = 'richiesta' and richieste && (select array_agg(id) from richieste_iscrizione where cognome = 'Rossi')), '1');

\echo ''
\echo '--- 7. Satispay pagato dopo la richiesta: un avviso «pagamento», anche con più callback ---'
select richiesta('eeeeeeee-0000-0000-0000-000000000003', 'Bruno', 'Neri', 'cccccccc-0000-0000-0000-000000000001', now() - interval '10 minutes');
set role service_role;
select atteso('la richiesta di Bruno avvisa e parte', manda_tutti(), '1');
reset role;
insert into pagamenti_satispay (richiesta_id, chi, importo, stato, satispay_id)
  values ('eeeeeeee-0000-0000-0000-000000000003', 'Neri Bruno', 12000, 'attesa', 'SP-BRUNO');
set role service_role;
select atteso('in attesa: niente', avvisi_per('Neri'), '0');
select atteso('Satispay dice pagato', satispay_esito('SP-BRUNO', 'ACCEPTED')->>'stato', 'pagato');
select atteso('e lo ridice', satispay_esito('SP-BRUNO', 'ACCEPTED')->>'stato', 'pagato');
select atteso('un avviso solo', avvisi_per('Neri'), '1');
select atteso('di tipo pagamento, con importo e corso', (select (avviso_di('Neri')->>'tipo') || ' · ' || (avviso_di('Neri')->>'importo') || ' · ' || (avviso_di('Neri')->>'corso')), 'pagamento · 12000 · Judo kids');
select atteso('lega la richiesta', avviso_di('Neri')->>'richiestaId', 'eeeeeeee-0000-0000-0000-000000000003');
select atteso('mandato', manda_tutti(), '1');
select atteso('una terza callback: niente di nuovo', satispay_esito('SP-BRUNO', 'ACCEPTED')->>'stato', 'pagato');
select atteso('nessun secondo avviso', avvisi_per('Neri'), '0');
reset role;
select atteso('nel registro: un pagamento', (select count(*)::text from avvisi_segreteria where tipo = 'pagamento'), '1');

\echo ''
\echo '--- 8. Satispay pagato prima della richiesta ---'
-- Giulia paga in fondo al modulo e manda la richiesta subito dopo.
insert into pagamenti_satispay (id, chi, importo, stato, satispay_id, corso_id, formula, nome, cognome, email, pagato_il, creato_il)
  values ('99999999-0000-0000-0000-000000000001', 'Verdi Giulia', 12000, 'pagato', 'SP-GIULIA', 'cccccccc-0000-0000-0000-000000000001', 'annuale',
          'Giulia', 'Gialli', 'giulia@esempio.it', now() - interval '2 minutes', now() - interval '3 minutes');
select chi('');
set role anon;
select atteso('la richiesta prende il pagamento',
  tenta($$select (invia_iscrizione(dal_modulo('Giulia', 'Gialli', 30, 'cccccccc-0000-0000-0000-000000000001', 'giulia@esempio.it', null,
    '{"pagamento_satispay": "99999999-0000-0000-0000-000000000001"}')) is not null)::text$$), 'true');
reset role;
select invecchia(5);
set role service_role;
select atteso('un avviso solo, quello della richiesta', avvisi_per('Gialli'), '1');
select atteso('che dice pagata, con importo', (select (avviso_di('Gialli')->>'tipo') || ' · ' || (avviso_di('Gialli')->'pagamento'->>'come') || ' · ' || (avviso_di('Gialli')->'pagamento'->>'importo')),
  'richiesta · satispay · 12000');
select atteso('mandato', manda_tutti(), '1');
reset role;
-- Un'ora dopo: il pagamento è della richiesta, nessun «senza richiesta».
update pagamenti_satispay set pagato_il = pagato_il - interval '2 hours', creato_il = creato_il - interval '2 hours' where satispay_id = 'SP-GIULIA';
set role service_role;
select atteso('dopo un''ora: nessun avviso di pagamento per Giulia', avvisi_per('Gialli'), '0');
reset role;

-- Laura paga e la richiesta non arriva.
insert into pagamenti_satispay (chi, importo, stato, satispay_id, corso_id, formula, nome, cognome, email, pagato_il, creato_il)
  values ('Bianchi Laura', 12000, 'pagato', 'SP-LAURA', 'cccccccc-0000-0000-0000-000000000003', 'annuale',
          'Laura', 'Bianchini', 'laura.bianchi@esempio.it', now() - interval '30 minutes', now() - interval '31 minutes');
set role service_role;
select atteso('dopo mezz''ora: ancora niente, la richiesta può arrivare', avvisi_per('Bianchini'), '0');
reset role;
update pagamenti_satispay set pagato_il = now() - interval '61 minutes', creato_il = now() - interval '62 minutes' where satispay_id = 'SP-LAURA';
set role service_role;
select atteso('dopo un''ora: un avviso', avvisi_per('Bianchini'), '1');
select atteso('pagamento senza richiesta, con l''email lasciata e il corso',
  (select (avviso_di('Bianchini')->>'tipo') || ' · ' || (avviso_di('Bianchini')->>'email') || ' · ' || (avviso_di('Bianchini')->>'corso') || ' · ' || (avviso_di('Bianchini')->>'importo')),
  'pagamento_senza_richiesta · laura.bianchi@esempio.it · Pilates · 12000');
select atteso('chiesto di nuovo: sempre uno', avvisi_per('Bianchini'), '1');
select atteso('mandato', manda_tutti(), '1');
select atteso('poi più niente', avvisi_per('Bianchini'), '0');
reset role;
select atteso('nel registro: uno senza richiesta', (select count(*)::text from avvisi_segreteria where tipo = 'pagamento_senza_richiesta'), '1');

\echo ''
\echo '--- 9. quel che è arrivato prima degli avvisi: niente arretrati ---'
select richiesta('eeeeeeee-0000-0000-0000-000000000004', 'Vecchia', 'Richiesta', 'cccccccc-0000-0000-0000-000000000001', now() - interval '2 days');
insert into pagamenti_satispay (chi, importo, stato, satispay_id, corso_id, formula, nome, cognome, email, pagato_il, creato_il)
  values ('Pagato Vecchio', 12000, 'pagato', 'SP-VECCHIO', 'cccccccc-0000-0000-0000-000000000003', 'annuale',
          'Vecchio', 'Pagato', 'vecchio@esempio.it', now() - interval '3 days', now() - interval '3 days');
set role service_role;
select atteso('una richiesta di prima: nessun avviso', avvisi_per('Vecchia'), '0');
select atteso('un pagamento di prima: nessun avviso', avvisi_per('Vecchio'), '0');
reset role;

\echo ''
\echo '--- 10. al più 50 al giorno ---'
-- Da capo: nessuna richiesta, nessun pagamento, registro vuoto.
delete from pagamenti_satispay;
delete from richieste_iscrizione;
delete from avvisi_segreteria;
insert into richieste_iscrizione (nome, cognome, nato_il, nato_a, codice_fiscale, indirizzo, cap, comune, email, telefono, corsi, formula, creata_il)
  select 'Tanti', 'Numero' || n, '1990-01-01', 'Torino', 'XXXYYY90A01L219Z', 'via Roma 1', '10093', 'Collegno', 'tanti' || n || '@esempio.it', '3331234567',
         array['cccccccc-0000-0000-0000-000000000003'::uuid], 'annuale', now() - interval '10 minutes'
    from generate_series(1, 50) n;
set role service_role;
select atteso('50 pronti', (select count(*)::text from avvisi_da_mandare()), '50');
select atteso('50 mandati oggi', manda_tutti(), '50');
reset role;
select richiesta('eeeeeeee-0000-0000-0000-000000000051', 'Una', 'Ditroppo', 'cccccccc-0000-0000-0000-000000000003', now() - interval '10 minutes');
set role service_role;
select atteso('il cinquantunesimo non si manda', avvisi_per('Ditroppo'), '0');
reset role;
select atteso('ed è segnato: tetto', (select string_agg(non_mandato, ', ') from avvisi_segreteria a where row_to_json(a)::text like '%Ditroppo%'
  or tipo = 'richiesta' and mandato_il is null), 'tetto');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria lo conta', avvisi_non_mandati_oggi()::text, '1');
reset role;
set role service_role;
select atteso('chiesto di nuovo: non torna', avvisi_per('Ditroppo'), '0');
reset role;

\echo ''
\echo '--- 11. una chiave d''invio che non si capisce non ferma la richiesta ---'
delete from avvisi_segreteria;
delete from richieste_iscrizione;
select chi('');
set role anon;
select atteso('invio non uuid: la richiesta entra',
  tenta($$select (invia_iscrizione(dal_modulo('Ugo', 'Strano', 30, 'cccccccc-0000-0000-0000-000000000003', 'ugo@esempio.it', null, '{"invio": "non-un-uuid"}')) is not null)::text$$), 'true');
select atteso('invio vuoto: la richiesta entra',
  tenta($$select (invia_iscrizione(dal_modulo('Eva', 'Vuota', 30, 'cccccccc-0000-0000-0000-000000000003', 'eva@esempio.it', null, '{"invio": ""}')) is not null)::text$$), 'true');
reset role;
select atteso('tutte e due senza chiave', (select count(*)::text from richieste_iscrizione where cognome in ('Strano', 'Vuota') and invio is null), '2');
select invecchia(5);
set role service_role;
select atteso('e ognuna ha il suo avviso', avvisi_per('Strano') || avvisi_per('Vuota'), '11');
select atteso('mandati', manda_tutti(), '2');
reset role;

\echo ''
\echo '--- 12. chi della famiglia arriva dopo l''avviso ne ha uno suo ---'
select chi('');
set role anon;
select atteso('Mario Tardi', tenta($$select (invia_iscrizione(dal_modulo('Mario', 'Tardi', 40, 'cccccccc-0000-0000-0000-000000000003', 'tardi@esempio.it', 'f0000000-0000-0000-0000-000000000003')) is not null)::text$$), 'true');
reset role;
select invecchia(5);
set role service_role;
select atteso('Mario avvisa e parte', manda_tutti(), '1');
reset role;
-- La sorella, rimandata col «riprova» dopo più di cinque minuti, con la stessa chiave.
select chi('');
set role anon;
select atteso('Anna Tardi, stessa famiglia', tenta($$select (invia_iscrizione(dal_modulo('Anna', 'Tardi', 40, 'cccccccc-0000-0000-0000-000000000003', 'tardi@esempio.it', 'f0000000-0000-0000-0000-000000000003')) is not null)::text$$), 'true');
reset role;
select invecchia(5);
set role service_role;
select atteso('Anna ha il suo avviso', (select count(*)::text from avvisi_da_mandare() x where x.avviso::text like '%"Anna"%' and x.avviso::text like '%Tardi%'), '1');
select atteso('e Mario non ci torna', (select count(*)::text from avvisi_da_mandare() x where x.avviso::text like '%"Mario"%' and x.avviso::text like '%Tardi%'), '0');
select atteso('mandato', manda_tutti(), '1');
reset role;

\echo ''
\echo '--- 13. fuori età coi sei mesi di tolleranza, come l''app ---'
-- Karate è per i nati fra (anno - 15) e (anno - 13): nato a dicembre dell'anno prima ci sta, a giugno no.
select chi('');
set role anon;
select atteso('Lia, nata a dicembre dell''anno prima',
  tenta($$select (invia_iscrizione(dal_modulo('Lia', 'Neve', 15, 'cccccccc-0000-0000-0000-000000000002', 'neve@esempio.it', null,
    jsonb_build_object('nato_il', make_date(extract(year from current_date)::int - 16, 12, 15),
                       'codice_fiscale', cf_prova('Lia', 'Neve', make_date(extract(year from current_date)::int - 16, 12, 15), true))))
    is not null)::text$$), 'true');
select atteso('Ivo, nato a giugno dell''anno prima',
  tenta($$select (invia_iscrizione(dal_modulo('Ivo', 'Neve', 15, 'cccccccc-0000-0000-0000-000000000002', 'neve2@esempio.it', null,
    jsonb_build_object('nato_il', make_date(extract(year from current_date)::int - 16, 6, 15),
                       'codice_fiscale', cf_prova('Ivo', 'Neve', make_date(extract(year from current_date)::int - 16, 6, 15)))))
    is not null)::text$$), 'true');
reset role;
select invecchia(5);
set role service_role;
select atteso('Lia non è fuori età', (select (x.avviso->'persone'->0->'fuoriEta')::text from avvisi_da_mandare() x where x.avviso::text like '%"Lia"%'), '[]');
select atteso('Ivo sì', (select (x.avviso->'persone'->0->'fuoriEta')::text from avvisi_da_mandare() x where x.avviso::text like '%"Ivo"%'), '["Karate"]');
select atteso('mandati', manda_tutti(), '2');
reset role;

\echo ''
\echo '--- 14. due chiamate insieme non mandano la stessa mail; la posta che rifiuta sempre si ferma ---'
select richiesta('eeeeeeee-0000-0000-0000-000000000061', 'Doppia', 'Mail', 'cccccccc-0000-0000-0000-000000000003', now() - interval '10 minutes');
set role service_role;
select (select x.id from avvisi_da_mandare() x where x.avviso::text like '%Doppia%') as doppia \gset
select atteso('la prima chiamata lo prende', avviso_preso(:'doppia')::text, 'true');
select atteso('la seconda, insieme, no', avviso_preso(:'doppia')::text, 'false');
reset role;
update avvisi_segreteria set preso_il = preso_il - interval '11 minutes' where id = :'doppia';
set role service_role;
select atteso('dieci minuti dopo, non partito: si riprende', avviso_preso(:'doppia')::text, 'true');
reset role;
update avvisi_segreteria set preso_il = preso_il - interval '11 minutes', tentativi = 12 where id = :'doppia';
set role service_role;
select atteso('preso dodici volte senza partire: basta', avviso_preso(:'doppia')::text, 'false');
select atteso('e non torna fra quelli da mandare', avvisi_per('Doppia'), '0');
reset role;
select atteso('segnato guasto', (select non_mandato from avvisi_segreteria where id = :'doppia'), 'guasto');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria lo conta fra quelli non partiti', avvisi_non_mandati_oggi()::text, '1');
reset role;

\echo ''
\echo '--- 15. eliminata prima di partire: l''avviso si chiude e non pesa sul tetto ---'
delete from avvisi_segreteria;
delete from richieste_iscrizione;
select richiesta('eeeeeeee-0000-0000-0000-000000000071', 'Sparita', 'Presto', 'cccccccc-0000-0000-0000-000000000003', now() - interval '10 minutes');
set role service_role;
select atteso('in coda', avvisi_per('Sparita'), '1');
reset role;
delete from richieste_iscrizione where id = 'eeeeeeee-0000-0000-0000-000000000071';
set role service_role;
select atteso('eliminata: niente da mandare', (select count(*)::text from avvisi_da_mandare()), '0');
reset role;
select atteso('chiuso vuoto', (select string_agg(non_mandato, ',') from avvisi_segreteria), 'vuoto');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('e non è un avviso perso', avvisi_non_mandati_oggi()::text, '0');
reset role;
-- Ieri: 50 in coda mai partiti non contano oggi.
insert into avvisi_segreteria (tipo, chiave, creato_il) select 'richiesta', 'ieri:' || n, now() - interval '1 day' from generate_series(1, 50) n;
select richiesta('eeeeeeee-0000-0000-0000-000000000072', 'Oggi', 'Nuova', 'cccccccc-0000-0000-0000-000000000003', now() - interval '10 minutes');
set role service_role;
select atteso('quelli di ieri non tengono fuori quella di oggi', avvisi_per('Nuova'), '1');
reset role;

\echo ''
\echo '--- 16. avvisi spenti e riaccesi: niente arretrati ---'
delete from avvisi_segreteria;
delete from richieste_iscrizione;
update avvisi_indirizzi set a = null;
select richiesta('eeeeeeee-0000-0000-0000-000000000081', 'Arrivata', 'Aspenti', 'cccccccc-0000-0000-0000-000000000003', now() - interval '10 minutes');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria riaccende', tenta($$update avvisi_indirizzi set a = 'segreteria@officinedellosport.it'$$), 'FATTO (1 righe)');
reset role;
set role service_role;
select atteso('quella arrivata ad avvisi spenti non avvisa', avvisi_per('Aspenti'), '0');
reset role;
