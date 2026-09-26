-- Il certificato medico e il pagamento: li vede e li cambia solo la
-- segreteria, e i file stanno nella cartella della persona.
-- Si lancia dopo finto-supabase.sql e i sette file dello schema.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'maura@ods.it'),
  ('33333333-3333-3333-3333-333333333333', 'luca@ods.it');
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Maura', 'Uno', 'istruttore', 'maura@ods.it', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Luca', 'Rossi', 'iscritto', 'luca@ods.it', '33333333-3333-3333-3333-333333333333'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'Sara', 'Bianchi', 'iscritto', null, null);

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
\echo '--- 1. la segreteria ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('carica il certificato di Luca',
  tenta($$insert into storage.objects (bucket_id, name) values ('certificati', 'aaaaaaaa-0000-0000-0000-000000000003/certificato-1.pdf')$$), 'FATTO (1 righe)');
select atteso('un nome inventato no',
  tenta($$insert into storage.objects (bucket_id, name) values ('certificati', 'aaaaaaaa-0000-0000-0000-000000000003/virus.exe')$$), 'NEGATO: …');
select atteso('scrive la scadenza e il file',
  tenta($$insert into schede_iscritti (persona_id, certificato_scade, certificato_file) values
    ('aaaaaaaa-0000-0000-0000-000000000003', current_date + 200, 'aaaaaaaa-0000-0000-0000-000000000003/certificato-1.pdf')$$), 'FATTO (1 righe)');
select atteso('il server scrive chi è stato', (select p.nome from schede_iscritti s join persone p on p.id = s.cambiata_da), 'Anna');
select atteso('chi non ha scritto niente del pagamento deve pagare', (select pagamento::text from schede_iscritti), 'da_pagare');
select atteso('segna il pagamento del trimestre',
  tenta($$update schede_iscritti set pagamento = 'pagato', pagato_fino = current_date + 90 where persona_id = 'aaaaaaaa-0000-0000-0000-000000000003'$$), 'FATTO (1 righe)');
select atteso('uno stato inventato no',
  tenta($$update schede_iscritti set pagamento = 'gratis' where persona_id = 'aaaaaaaa-0000-0000-0000-000000000003'$$), 'NEGATO: …');
select atteso('il file di Luca non va sulla scheda di Sara',
  tenta($$insert into schede_iscritti (persona_id, certificato_file) values
    ('aaaaaaaa-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000003/certificato-1.pdf')$$), 'NEGATO: …');
select atteso('Sara, pagato in parte, senza certificato',
  tenta($$insert into schede_iscritti (persona_id, pagamento, pagamento_nota) values
    ('aaaaaaaa-0000-0000-0000-000000000004', 'in_parte', 'mancano 50 €')$$), 'FATTO (1 righe)');
select atteso('vede i file', (select count(*)::text from storage.objects where bucket_id = 'certificati'), '1');
reset role;

\echo ''
\echo '--- 2. un istruttore: fa l''appello, ma i certificati non li vede ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('vede le persone', (select count(*)::text from persone where ruolo = 'iscritto'), '2');
select atteso('non vede le schede', (select count(*)::text from schede_iscritti), '0');
select atteso('non vede i file', (select count(*)::text from storage.objects where bucket_id = 'certificati'), '0');
select atteso('non scrive una scheda',
  tenta($$insert into schede_iscritti (persona_id, pagamento) values ('aaaaaaaa-0000-0000-0000-000000000002', 'pagato')$$), 'NEGATO: …');
select atteso('non segna un pagamento', tenta($$update schede_iscritti set pagamento = 'pagato'$$), 'a vuoto (0 righe)');
select atteso('non carica un certificato',
  tenta($$insert into storage.objects (bucket_id, name) values ('certificati', 'aaaaaaaa-0000-0000-0000-000000000003/certificato-2.pdf')$$), 'NEGATO: …');
select atteso('non cancella un file', tenta($$delete from storage.objects where bucket_id = 'certificati'$$), 'a vuoto (0 righe)');
reset role;

\echo ''
\echo '--- 3. un iscritto con l''accesso: nemmeno il suo ---'
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('non vede la sua scheda', (select count(*)::text from schede_iscritti), '0');
select atteso('non vede il suo file', (select count(*)::text from storage.objects where bucket_id = 'certificati'), '0');
reset role;

\echo ''
\echo '--- 4. chi non ha un accesso ---'
select chi('');
set role anon;
select atteso('non legge le schede', tenta($$select count(*)::text from schede_iscritti$$), 'NEGATO: …');
select atteso('non carica un certificato',
  tenta($$insert into storage.objects (bucket_id, name) values ('certificati', 'aaaaaaaa-0000-0000-0000-000000000003/certificato-3.pdf')$$), 'NEGATO: …');
reset role;

\echo ''
\echo '--- 5. la persona che se ne va si porta via la scheda ---'
delete from persone where id = 'aaaaaaaa-0000-0000-0000-000000000004';
select atteso('resta solo quella di Luca', (select count(*)::text from schede_iscritti), '1');

\echo ''
\echo 'Tutto a posto.'
