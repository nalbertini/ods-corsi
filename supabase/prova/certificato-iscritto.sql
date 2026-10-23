-- Il certificato medico mandato dall'iscritto (102-certificato-iscritto.sql).
-- Chi ha l'accesso manda il file dalla sua area (il titolare per i minori del
-- nucleo senza accesso): il file resta «in attesa» (colonne
-- `certificato_in_attesa` e `certificato_in_attesa_il` della scheda, nello
-- stesso contenitore `certificati`, nome `<persona>/attesa-<n>.<pdf|jpg|png>`)
-- finché la segreteria non lo conferma scrivendo la scadenza
-- (`conferma_certificato_iscritto`) o lo rifiuta (`rifiuta_certificato_iscritto`).
-- Un file in attesa non è il certificato: la scadenza non si muove. L'iscritto
-- non riapre il file né ne vede il nome, solo il giorno dell'invio.
-- Le funzioni: `iscritto_manda_certificato(persona, file)` per l'iscritto,
-- `iscritto_scheda` e `iscritto_nucleo` con la colonna in più
-- `certificato_in_attesa_il`. Le metà in prova: scripts/prova-certificato-iscritto.mjs.
-- Si lancia dopo finto-supabase.sql e i file dello schema (il 102 compreso).
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
grant execute on function tenta(text), atteso(text, text, text), chi(text) to anon, authenticated;
create or replace function pid(n int) returns uuid language sql immutable as $$
  select ('aaaaaaaa-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;
grant execute on function pid(int) to anon, authenticated;
-- Il file nello Storage di una persona: `<persona>/<nome>`.
create or replace function fl(n int, nome text) returns text language sql immutable as $$
  select pid(n)::text || '/' || nome
$$;
grant execute on function fl(int, text) to anon, authenticated;
-- Cosa c'è nella cartella di una persona (come lo vede chi non ha Storage da proteggere).
create or replace function nel(n int) returns text language sql stable as $$
  select coalesce(string_agg(split_part(name, '/', 2), ',' order by name), '') from storage.objects where bucket_id = 'certificati' and name like pid(n)::text || '/%'
$$;
-- Cosa dice la scheda: «certificato · in attesa · scadenza» (solo i nomi dei file, senza cartella).
create or replace function sch(n int) returns text language plpgsql stable as $$
declare r text;
begin
  select coalesce(split_part(certificato_file, '/', 2), '-') || ' · ' || coalesce(split_part(certificato_in_attesa, '/', 2), '-') || ' · ' || coalesce(certificato_scade::text, '-')
    into r from schede_iscritti where persona_id = pid(n);
  return coalesce(r, 'senza scheda');
end $$;

-- --- chi c'è ----------------------------------------------------------------
insert into auth.users (id, email, email_confirmed_at) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it', now()),
  ('22222222-2222-2222-2222-222222222222', 'ines@ods.it', now()),
  ('33333333-3333-3333-3333-333333333333', 'luca@fam.it', now()),
  ('44444444-4444-4444-4444-444444444444', 'maria@fam.it', now()),
  ('55555555-5555-5555-5555-555555555555', 'bruno@fam.it', now()),
  ('66666666-6666-6666-6666-666666666666', 'vera@fam.it', now());
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  (pid(1), 'Anna', 'Segreteria', 'staff', 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  (pid(2), 'Ines', 'Istruttrice', 'istruttore', 'ines@ods.it', '22222222-2222-2222-2222-222222222222'),
  (pid(3), 'Luca', 'Fam', 'iscritto', 'luca@fam.it', '33333333-3333-3333-3333-333333333333'),
  (pid(6), 'Bruno', 'Solo', 'iscritto', 'bruno@fam.it', '55555555-5555-5555-5555-555555555555'),
  (pid(9), 'Vera', 'Vecchia', 'iscritto', 'vera@fam.it', '66666666-6666-6666-6666-666666666666'),
  (pid(8), 'Olga', 'Orfana', 'iscritto', null, null);
-- Il nucleo di Luca: Maria, maggiorenne con l'accesso suo, e Teo, senza accesso.
insert into persone (id, nome, cognome, ruolo, email, utente_id, nucleo) values
  (pid(4), 'Maria', 'Fam', 'iscritto', 'maria@fam.it', '44444444-4444-4444-4444-444444444444', pid(3)),
  (pid(5), 'Teo', 'Fam', 'iscritto', null, null, pid(3));
-- Vera ha già un certificato, scaduto da poco: il file nuovo lo sostituirà.
insert into storage.objects (bucket_id, name) values ('certificati', fl(9, 'certificato-1.pdf'));
insert into schede_iscritti (persona_id, certificato_scade, certificato_file, certificato_caricato_il)
  values (pid(9), current_date - 10, fl(9, 'certificato-1.pdf'), now() - interval '300 days');

\echo ''
\echo '--- 1. l''iscritto manda il file: resta in attesa, la scadenza non si muove ---'
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('Bruno carica il suo file nella cartella in attesa',
  tenta($$insert into storage.objects (bucket_id, name) values ('certificati', fl(6, 'attesa-1.pdf'))$$), 'FATTO (1 righe)');
select atteso('e lo manda alla segreteria',
  tenta($$select iscritto_manda_certificato(pid(6), fl(6, 'attesa-1.pdf'))::text$$), '');
select atteso('la sua scheda dice che ha mandato, oggi',
  (select (s.certificato_in_attesa_il::date = current_date)::text from iscritto_scheda(pid(6)) s), 'true');
select atteso('e la scadenza è ancora vuota: un file non è un certificato',
  (select coalesce(s.certificato_scade::text, 'vuota') from iscritto_scheda(pid(6)) s), 'vuota');
reset role;
select atteso('sulla scheda il file è in attesa, non è il certificato', sch(6), '- · attesa-1.pdf · -');
select atteso('nello Storage c''è', nel(6), 'attesa-1.pdf');

\echo ''
\echo '--- 2. un altro file: ne resta uno solo, in Storage e in scheda ---'
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('Bruno carica un secondo file (una foto)',
  tenta($$insert into storage.objects (bucket_id, name) values ('certificati', fl(6, 'attesa-2.png'))$$), 'FATTO (1 righe)');
select atteso('e lo manda',
  tenta($$select iscritto_manda_certificato(pid(6), fl(6, 'attesa-2.png'))::text$$), '');
reset role;
select atteso('in scheda c''è il nuovo', sch(6), '- · attesa-2.png · -');
select atteso('nello Storage resta solo il nuovo', nel(6), 'attesa-2.png');

\echo ''
\echo '--- 3. l''iscritto non riapre il file e non scrive la scheda ---'
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('non vede nessun file nel contenitore', (select count(*)::text from storage.objects where bucket_id = 'certificati'), '0');
select atteso('non cancella il suo file', tenta($$delete from storage.objects where bucket_id = 'certificati'$$), 'a vuoto (0 righe)');
select atteso('non legge la scheda', (select count(*)::text from schede_iscritti), '0');
select atteso('dalla sua area esce solo il giorno dell''invio: né il nome del file né una cartella',
  (select (to_jsonb(s)::text ~ 'attesa-|certificato-|/')::text from iscritto_scheda(pid(6)) s), 'false');
select atteso('e nessuna colonna con «file» nel nome',
  (select count(*)::text from jsonb_object_keys((select to_jsonb(s) from iscritto_scheda(pid(6)) s)) k where k like '%file%'), '0');
select atteso('non scrive la scadenza e il file sulla scheda',
  (tenta($$update schede_iscritti set certificato_scade = current_date + 300, certificato_file = fl(6, 'attesa-2.png') where persona_id = pid(6)$$) like 'FATTO%')::text, 'false');
select atteso('non scrive il file in attesa sulla scheda',
  (tenta($$update schede_iscritti set certificato_in_attesa = fl(6, 'attesa-2.png'), certificato_in_attesa_il = now() where persona_id = pid(6)$$) like 'FATTO%')::text, 'false');
select atteso('non crea una scheda con una scadenza',
  tenta($$insert into schede_iscritti (persona_id, certificato_scade) values (pid(6), current_date + 300)$$), 'NEGATO: …');
select atteso('non carica un certificato col nome della segreteria',
  tenta($$insert into storage.objects (bucket_id, name) values ('certificati', fl(6, 'certificato-9.pdf'))$$), 'NEGATO: …');
select atteso('non carica nella cartella di un''altra persona',
  tenta($$insert into storage.objects (bucket_id, name) values ('certificati', fl(8, 'attesa-1.pdf'))$$), 'NEGATO: …');
select atteso('un tipo che non è PDF, JPG o PNG no (exe)',
  tenta($$insert into storage.objects (bucket_id, name) values ('certificati', fl(6, 'attesa-3.exe'))$$), 'NEGATO: …');
select atteso('nemmeno una foto HEIC: si manda JPG o PNG',
  tenta($$insert into storage.objects (bucket_id, name) values ('certificati', fl(6, 'attesa-3.heic'))$$), 'NEGATO: …');
reset role;
-- Un file di Luca, già nel contenitore: non è di Bruno.
insert into storage.objects (bucket_id, name) values ('certificati', fl(3, 'attesa-9.pdf'));
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('il file di un''altra persona non lo manda',
  tenta($$select iscritto_manda_certificato(pid(6), fl(3, 'attesa-9.pdf'))::text$$), 'NEGATO: Il file non è di questa persona');
select atteso('un file mai caricato no',
  tenta($$select iscritto_manda_certificato(pid(6), fl(6, 'attesa-7.pdf'))::text$$), 'NEGATO: Il file non è stato caricato: riprova');
select atteso('per un''altra persona no',
  tenta($$select iscritto_manda_certificato(pid(3), fl(3, 'attesa-9.pdf'))::text$$), 'NEGATO: Questa persona non è fra le tue');
select atteso('non conferma', tenta($$select conferma_certificato_iscritto(pid(6), current_date + 300)::text$$), 'NEGATO: solo la segreteria');
select atteso('non rifiuta', tenta($$select rifiuta_certificato_iscritto(pid(6))::text$$), 'NEGATO: solo la segreteria');
reset role;
select atteso('di tutto questo la scheda non si è mossa', sch(6), '- · attesa-2.png · -');
select atteso('e la cartella nemmeno', nel(6), 'attesa-2.png');
delete from storage.objects where bucket_id = 'certificati' and name = fl(3, 'attesa-9.pdf');

select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('un''istruttrice non vede chi ha mandato un file', (select count(*)::text from schede_iscritti where certificato_in_attesa is not null), '0');
select atteso('non conferma', tenta($$select conferma_certificato_iscritto(pid(6), current_date + 300)::text$$), 'NEGATO: solo la segreteria');
select atteso('non rifiuta', tenta($$select rifiuta_certificato_iscritto(pid(6))::text$$), 'NEGATO: solo la segreteria');
select atteso('non manda per un iscritto', tenta($$select iscritto_manda_certificato(pid(6), fl(6, 'attesa-2.png'))::text$$), 'NEGATO: …');
reset role;
select chi('');
set role anon;
select atteso('chi non ha un accesso non manda', tenta($$select iscritto_manda_certificato(pid(6), fl(6, 'attesa-2.png'))::text$$), 'NEGATO: permission denied for function iscritto_manda_certificato');
select atteso('non conferma', tenta($$select conferma_certificato_iscritto(pid(6), current_date + 300)::text$$), 'NEGATO: permission denied for function conferma_certificato_iscritto');
select atteso('non rifiuta', tenta($$select rifiuta_certificato_iscritto(pid(6))::text$$), 'NEGATO: permission denied for function rifiuta_certificato_iscritto');
select atteso('non carica un file in attesa',
  tenta($$insert into storage.objects (bucket_id, name) values ('certificati', fl(6, 'attesa-5.pdf'))$$), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 4. il titolare manda per chi non ha l''accesso, nessun altro per nessun altro ---'
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('Luca carica per Teo, che è nel suo nucleo e non ha un accesso',
  tenta($$insert into storage.objects (bucket_id, name) values ('certificati', fl(5, 'attesa-1.pdf'))$$), 'FATTO (1 righe)');
select atteso('e lo manda', tenta($$select iscritto_manda_certificato(pid(5), fl(5, 'attesa-1.pdf'))::text$$), '');
select atteso('Luca manda anche il suo',
  tenta($$insert into storage.objects (bucket_id, name) values ('certificati', fl(3, 'attesa-1.pdf'))$$), 'FATTO (1 righe)');
select atteso('e lo manda', tenta($$select iscritto_manda_certificato(pid(3), fl(3, 'attesa-1.pdf'))::text$$), '');
select atteso('per Maria, maggiorenne con l''accesso suo, no: il file',
  tenta($$insert into storage.objects (bucket_id, name) values ('certificati', fl(4, 'attesa-1.pdf'))$$), 'NEGATO: …');
select atteso('…e nemmeno la funzione',
  tenta($$select iscritto_manda_certificato(pid(4), fl(5, 'attesa-1.pdf'))::text$$), 'NEGATO: Questa persona non è fra le tue');
select atteso('per un estraneo (Bruno) no: il file',
  tenta($$insert into storage.objects (bucket_id, name) values ('certificati', fl(6, 'attesa-8.pdf'))$$), 'NEGATO: …');
select atteso('…e nemmeno la funzione',
  tenta($$select iscritto_manda_certificato(pid(6), fl(6, 'attesa-2.png'))::text$$), 'NEGATO: Questa persona non è fra le tue');
select atteso('il nucleo dice che Teo e Luca hanno mandato, Maria no',
  (select string_agg(n.nome || ':' || (n.certificato_in_attesa_il is not null)::text, ',' order by n.nome) from iscritto_nucleo(pid(3)) n), 'Luca:true,Teo:true');
select atteso('Luca non vede i file di Teo', (select count(*)::text from storage.objects where bucket_id = 'certificati'), '0');
reset role;
select atteso('la scheda di Teo ha il file in attesa', sch(5), '- · attesa-1.pdf · -');
select atteso('Bruno non è stato toccato', sch(6), '- · attesa-2.png · -');

select chi('44444444-4444-4444-4444-444444444444');
set role authenticated;
select atteso('Maria manda il suo',
  tenta($$insert into storage.objects (bucket_id, name) values ('certificati', fl(4, 'attesa-1.pdf'))$$), 'FATTO (1 righe)');
select atteso('…e lo manda', tenta($$select iscritto_manda_certificato(pid(4), fl(4, 'attesa-1.pdf'))::text$$), '');
select atteso('per Teo no: il titolare è Luca',
  tenta($$select iscritto_manda_certificato(pid(5), fl(5, 'attesa-1.pdf'))::text$$), 'NEGATO: Questa persona non è fra le tue');
select atteso('né il file nella cartella di Teo',
  tenta($$insert into storage.objects (bucket_id, name) values ('certificati', fl(5, 'attesa-2.pdf'))$$), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 5. la segreteria vede chi ha mandato; rifiuta: il file si cancella e si può ricaricare ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria vede chi ha un file in attesa e da quando',
  (select string_agg(p.nome || ':' || (s.certificato_in_attesa_il::date = current_date)::text, ',' order by p.nome)
     from schede_iscritti s join persone p on p.id = s.persona_id where s.certificato_in_attesa is not null), 'Bruno:true,Luca:true,Maria:true,Teo:true');
select atteso('la segreteria apre il file in attesa (ha il permesso sul contenitore)',
  (select count(*)::text from storage.objects where bucket_id = 'certificati' and name = fl(6, 'attesa-2.png')), '1');
select atteso('chi non ha niente in attesa non si conferma',
  tenta($$select conferma_certificato_iscritto(pid(8), current_date + 300)::text$$), 'NEGATO: …');
select atteso('né si rifiuta', tenta($$select rifiuta_certificato_iscritto(pid(8))::text$$), 'NEGATO: …');
select atteso('rifiuta il file di Bruno', tenta($$select rifiuta_certificato_iscritto(pid(6))::text$$), '');
reset role;
select atteso('la scheda di Bruno è com''era prima, senza file né attesa', sch(6), '- · - · -');
select atteso('e il file non c''è più nello Storage', nel(6), '');
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('Bruno non risulta più in attesa',
  (select (s.certificato_in_attesa_il is null)::text from iscritto_scheda(pid(6)) s), 'true');
select atteso('e può mandarne un altro: lo carica',
  tenta($$insert into storage.objects (bucket_id, name) values ('certificati', fl(6, 'attesa-4.pdf'))$$), 'FATTO (1 righe)');
select atteso('…e lo manda', tenta($$select iscritto_manda_certificato(pid(6), fl(6, 'attesa-4.pdf'))::text$$), '');
reset role;
select atteso('di nuovo in attesa', sch(6), '- · attesa-4.pdf · -');

\echo ''
\echo '--- 6. la segreteria conferma con la scadenza: il file diventa il certificato ---'
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('Vera carica il certificato nuovo',
  tenta($$insert into storage.objects (bucket_id, name) values ('certificati', fl(9, 'attesa-1.pdf'))$$), 'FATTO (1 righe)');
select atteso('e lo manda', tenta($$select iscritto_manda_certificato(pid(9), fl(9, 'attesa-1.pdf'))::text$$), '');
select atteso('il nome del certificato già confermato non si mette in attesa (poi lo si farebbe cancellare)',
  tenta($$select iscritto_manda_certificato(pid(9), fl(9, 'certificato-1.pdf'))::text$$), 'NEGATO: Il file non è di questa persona');
reset role;
select atteso('finché non è confermato, il vecchio resta il certificato',
  sch(9), 'certificato-1.pdf · attesa-1.pdf · ' || (current_date - 10));
select atteso('…e nello Storage ci sono tutti e due', nel(9), 'attesa-1.pdf,certificato-1.pdf');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('senza la data la conferma no',
  tenta($$select conferma_certificato_iscritto(pid(9), null)::text$$), 'NEGATO: Serve la data di scadenza del certificato');
select atteso('con una data più di tre anni avanti no: probabilmente l''anno è sbagliato',
  tenta($$select conferma_certificato_iscritto(pid(9), current_date + 1100)::text$$), 'NEGATO: La data è troppo lontana: controlla l''anno.');
reset role;
select atteso('un rifiuto per la data lascia tutto com''era',
  sch(9), 'certificato-1.pdf · attesa-1.pdf · ' || (current_date - 10));
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('con la data la conferma passa',
  tenta($$select conferma_certificato_iscritto(pid(9), current_date + 300)::text$$), '');
reset role;
select atteso('la scadenza è quella scritta', (select certificato_scade::text from schede_iscritti where persona_id = pid(9)), (current_date + 300)::text);
select atteso('il file mandato è il certificato della scheda: uno solo nel contenitore',
  (select (count(*) = 1 and bool_and(o.name = s.certificato_file))::text
     from storage.objects o join schede_iscritti s on s.persona_id = pid(9)
    where o.bucket_id = 'certificati' and o.name like pid(9)::text || '/%'), 'true');
select atteso('il file vecchio è sparito', (select count(*)::text from storage.objects where bucket_id = 'certificati' and name = fl(9, 'certificato-1.pdf')), '0');
select atteso('non c''è più niente in attesa',
  (select (certificato_in_attesa is null and certificato_in_attesa_il is null)::text from schede_iscritti where persona_id = pid(9)), 'true');
select atteso('il certificato ha il giorno di caricamento di oggi',
  (select (certificato_caricato_il::date = current_date)::text from schede_iscritti where persona_id = pid(9)), 'true');
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('Vera, dalla sua area, vede la scadenza nuova e niente in attesa',
  (select s.certificato_scade::text || ' ' || (s.certificato_in_attesa_il is null)::text from iscritto_scheda(pid(9)) s), (current_date + 300)::text || ' true');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('una seconda conferma no: non c''è più niente da confermare',
  tenta($$select conferma_certificato_iscritto(pid(9), current_date + 300)::text$$), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 7. un file in attesa da più di un giorno resta: la pulizia toglie solo gli orfani ---'
update storage.objects set created_at = now() - interval '3 days'
 where bucket_id = 'certificati' and name in (fl(3, 'attesa-1.pdf'), fl(5, 'attesa-1.pdf'), fl(4, 'attesa-1.pdf'));
insert into storage.objects (bucket_id, name, created_at) values ('certificati', fl(8, 'certificato-7.pdf'), now() - interval '2 days');
select atteso('la pulizia toglie un file solo: quello che nessuna scheda tiene', pulisci_certificati()::text, '1');
select atteso('Luca tiene il suo file in attesa', sch(3) || ' · ' || nel(3), '- · attesa-1.pdf · - · attesa-1.pdf');
select atteso('Teo e Maria anche', sch(5) || ' · ' || sch(4), '- · attesa-1.pdf · - · - · attesa-1.pdf · -');
select atteso('l''orfano non c''è più', nel(8), '');
select atteso('una seconda volta non c''è niente da togliere', pulisci_certificati()::text, '0');

\echo ''
\echo '--- 8. persona disattivata o cancellata: il file in attesa se ne va; due schede unite: passa a chi resta ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria disattiva Teo', tenta($$update persone set attiva = false where id = pid(5)$$), 'FATTO (1 righe)');
reset role;
select atteso('il suo file in attesa non c''è più', nel(5), '');
select atteso('e la scheda non lo nomina', (select coalesce(certificato_in_attesa, 'niente') from schede_iscritti where persona_id = pid(5)), 'niente');
select atteso('riattivarlo non lo riporta', tenta('update persone set attiva = true where id = pid(5)') || ' ' || nel(5), 'FATTO (1 righe) ');

insert into persone (id, nome, cognome, ruolo) values (pid(10), 'Cino', 'Cancellato', 'iscritto');
insert into storage.objects (bucket_id, name) values ('certificati', fl(10, 'attesa-1.pdf'));
insert into schede_iscritti (persona_id, certificato_in_attesa, certificato_in_attesa_il) values (pid(10), fl(10, 'attesa-1.pdf'), now());
delete from persone where id = pid(10);
select atteso('cancellata la persona, il suo file in attesa non resta nello Storage', nel(10), '');

-- Due schede senza accesso: quella che se ne va ha mandato il file, quella che resta no.
insert into persone (id, nome, cognome, ruolo) values (pid(11), 'Rita', 'Resta', 'iscritto'), (pid(12), 'Vito', 'Via', 'iscritto');
insert into storage.objects (bucket_id, name) values ('certificati', fl(12, 'attesa-1.pdf'));
insert into schede_iscritti (persona_id, certificato_in_attesa, certificato_in_attesa_il) values (pid(12), fl(12, 'attesa-1.pdf'), now());
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('si uniscono', tenta($$select unisci_persone(pid(11), pid(12))::text$$), '');
reset role;
select atteso('il file in attesa passa a chi resta: uno solo, e la scheda lo nomina',
  (select (count(*) = 1 and bool_and(o.name = s.certificato_in_attesa) and bool_and(s.certificato_in_attesa_il is not null))::text
     from storage.objects o join schede_iscritti s on s.persona_id = pid(11)
    where o.bucket_id = 'certificati' and o.name like pid(11)::text || '/%'), 'true');
select atteso('nella cartella di chi se n''è andato non resta niente', nel(12), '');

-- Due schede che hanno mandato tutte e due: ne resta uno solo.
insert into persone (id, nome, cognome, ruolo) values (pid(13), 'Remo', 'Resta', 'iscritto'), (pid(14), 'Vera', 'Via', 'iscritto');
insert into storage.objects (bucket_id, name) values ('certificati', fl(13, 'attesa-1.pdf')), ('certificati', fl(14, 'attesa-2.pdf'));
insert into schede_iscritti (persona_id, certificato_in_attesa, certificato_in_attesa_il) values
  (pid(13), fl(13, 'attesa-1.pdf'), now() - interval '2 hours'), (pid(14), fl(14, 'attesa-2.pdf'), now());
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('si uniscono anche questi', tenta($$select unisci_persone(pid(13), pid(14))::text$$), '');
reset role;
select atteso('ne resta uno solo, in Storage e in scheda',
  (select (count(*) = 1 and bool_and(o.name = s.certificato_in_attesa))::text
     from storage.objects o join schede_iscritti s on s.persona_id = pid(13)
    where o.bucket_id = 'certificati' and o.name like pid(13)::text || '/%'), 'true');
select atteso('e la cartella dell''altro è vuota', nel(14), '');
select atteso('vince il file mandato per ultimo (il più recente)', (select (certificato_in_attesa_il > now() - interval '1 hour')::text from schede_iscritti where persona_id = pid(13)), 'true');

\echo ''
\echo '--- 9. la segreteria carica lei un certificato: il file mandato non resta in attesa a metà ---'
insert into persone (id, nome, cognome, ruolo) values (pid(15), 'Ugo', 'Uno', 'iscritto');
insert into storage.objects (bucket_id, name) values ('certificati', fl(15, 'attesa-1.pdf')), ('certificati', fl(15, 'certificato-5.pdf'));
insert into schede_iscritti (persona_id, certificato_in_attesa, certificato_in_attesa_il) values (pid(15), fl(15, 'attesa-1.pdf'), now());
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria scrive il certificato di Ugo', tenta($$select salva_certificato(pid(15), fl(15, 'certificato-5.pdf'), current_date + 200)::text$$), '');
reset role;
select atteso('il file in attesa se n''è andato e la scheda non lo nomina più', sch(15) || ' · ' || nel(15), 'certificato-5.pdf · - · ' || (current_date + 200) || ' · certificato-5.pdf');
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('di conseguenza non c''è niente da confermare', tenta($$select conferma_certificato_iscritto(pid(15), current_date + 300)::text$$), 'NEGATO: …');
reset role;
-- Un file in attesa tolto a mano dallo Storage: la conferma non cancella il certificato che c'è.
insert into persone (id, nome, cognome, ruolo) values (pid(16), 'Ida', 'Due', 'iscritto');
insert into storage.objects (bucket_id, name) values ('certificati', fl(16, 'certificato-5.pdf'));
insert into schede_iscritti (persona_id, certificato_file, certificato_scade, certificato_in_attesa, certificato_in_attesa_il)
  values (pid(16), fl(16, 'certificato-5.pdf'), current_date + 100, fl(16, 'attesa-1.pdf'), now());
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('confermare un file mandato che non c''è più no',
  tenta($$select conferma_certificato_iscritto(pid(16), current_date + 300)::text$$), 'NEGATO: Il file mandato non c''è più: chiedi di rimandarlo');
reset role;
select atteso('il certificato di Ida resta com''era', sch(16) || ' · ' || nel(16), 'certificato-5.pdf · attesa-1.pdf · ' || (current_date + 100) || ' · certificato-5.pdf');

\echo ''
\echo 'Tutto a posto.'
