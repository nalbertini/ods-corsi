-- Disattivare una scheda chiude le sue iscrizioni (94-disattiva-chiude-iscrizioni.sql).
--
-- Prima si disattivava solo `persone.attiva`: riattivandola (a mano, o
-- accogliendo una richiesta) la persona tornava negli appelli di tutti i corsi
-- vecchi. Ora le iscrizioni si chiudono alla disattivazione, come `termina`
-- (oggi, o il `dal` se l'iscrizione parte più avanti), e riattivare non le
-- riapre: i corsi si rimettono con Iscrivi o con una richiesta accolta.
-- La metà di prova è `attivaPersona` in `src/lib/segreteriaProva.ts`
-- (scripts/prova-segreteria.mjs).
-- Si lancia dopo finto-supabase.sql e i file dello schema (il 94 compreso).
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it');
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', 'anna@ods.it', '11111111-1111-1111-1111-111111111111');
-- Marco si ritira da Judo 1; Sara resta.
insert into persone (id, nome, cognome, ruolo, email) values
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Marco', 'Ritirato', 'iscritto', 'marco@esempio.it'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Sara', 'Rimasta', 'iscritto', 'sara@esempio.it');
insert into corsi (id, nome) values
  ('cccccccc-0000-0000-0000-000000000001', 'Karate'),
  ('cccccccc-0000-0000-0000-000000000002', 'Judo 1'),
  ('cccccccc-0000-0000-0000-000000000003', 'Judo 2'),
  ('cccccccc-0000-0000-0000-000000000004', 'Judo 3');
-- Marco: Judo 1 aperta, Judo 2 che parte fra dieci giorni, Judo 3 chiusa da tempo.
insert into iscrizioni (corso_id, persona_id, dal, al) values
  ('cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', current_date - 60, null),
  ('cccccccc-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002', current_date + 10, null),
  ('cccccccc-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000002', current_date - 200, current_date - 100),
  ('cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000003', current_date - 60, null);

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
-- Come sono le iscrizioni di una persona: «corso:al», «aperta» se non finisce.
create or replace function iscrizioni_di(p uuid) returns text language sql as $$
  select string_agg(c.nome || ':' || coalesce(i.al::text, 'aperta'), ', ' order by c.nome)
  from iscrizioni i join corsi c on c.id = i.corso_id where i.persona_id = p
$$;
grant execute on function iscrizioni_di(uuid) to authenticated;
create or replace function oggi_roma(giorni int default 0) returns text language sql as $$
  select ((now() at time zone 'Europe/Rome')::date + giorni)::text
$$;

\echo ''
\echo '--- 1. disattivare chiude ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria disattiva Marco', tenta($$update persone set attiva = false where id = 'aaaaaaaa-0000-0000-0000-000000000002'$$), 'FATTO (1 righe)');
reset role;
select atteso('l''aperta si chiude oggi, la futura al suo dal, la passata resta com''era',
  iscrizioni_di('aaaaaaaa-0000-0000-0000-000000000002'),
  'Judo 1:' || oggi_roma() || ', Judo 2:' || oggi_roma(10) || ', Judo 3:' || oggi_roma(-100));
select atteso('Sara non si tocca', iscrizioni_di('aaaaaaaa-0000-0000-0000-000000000003'), 'Judo 1:aperta');

\echo ''
\echo '--- 2. riattivare non riapre ---'
set role authenticated;
select atteso('la segreteria riattiva Marco', tenta($$update persone set attiva = true where id = 'aaaaaaaa-0000-0000-0000-000000000002'$$), 'FATTO (1 righe)');
reset role;
select atteso('niente si riapre',
  iscrizioni_di('aaaaaaaa-0000-0000-0000-000000000002'),
  'Judo 1:' || oggi_roma() || ', Judo 2:' || oggi_roma(10) || ', Judo 3:' || oggi_roma(-100));

\echo ''
\echo '--- 3. Marco chiede Karate: torna solo in Karate ---'
select atteso('Marco si disattiva di nuovo (scheda ritirata)', tenta($$update persone set attiva = false where id = 'aaaaaaaa-0000-0000-0000-000000000002'$$), 'FATTO (1 righe)');
insert into richieste_iscrizione (id, nome, cognome, nato_il, nato_a, codice_fiscale, indirizzo, cap, comune, email, telefono, corsi, formula, regolamento)
values ('eeeeeeee-0000-0000-0000-000000000001', 'Marco', 'Ritirato', current_date - interval '30 years', 'Torino', 'RTRMRC96A01L219X', 'Via Roma 1', '10093', 'Collegno',
        'marco@esempio.it', '347 111 2233', array['cccccccc-0000-0000-0000-000000000001']::uuid[], 'annuale', true);
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria accoglie la richiesta, sulla scheda di Marco',
  tenta($$select (accogli_iscrizione('eeeeeeee-0000-0000-0000-000000000001') = 'aaaaaaaa-0000-0000-0000-000000000002')::text$$), 'true');
reset role;
select atteso('è di nuovo attivo', (select attiva::text from persone where id = 'aaaaaaaa-0000-0000-0000-000000000002'), 'true');
select atteso('aperta solo Karate, i corsi vecchi restano chiusi',
  iscrizioni_di('aaaaaaaa-0000-0000-0000-000000000002'),
  'Judo 1:' || oggi_roma() || ', Judo 2:' || oggi_roma(10) || ', Judo 3:' || oggi_roma(-100) || ', Karate:aperta');
select atteso('Sara ancora non si tocca', iscrizioni_di('aaaaaaaa-0000-0000-0000-000000000003'), 'Judo 1:aperta');

\echo ''
\echo '--- 4. solo la segreteria disattiva ---'
insert into auth.users (id, email) values
  ('22222222-2222-2222-2222-222222222222', 'maura@ods.it'),
  ('33333333-3333-3333-3333-333333333333', 'sara@esempio.it');
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000004', 'Maura', 'Istruttrice', 'istruttore', 'maura@ods.it', '22222222-2222-2222-2222-222222222222');
update persone set utente_id = '33333333-3333-3333-3333-333333333333' where id = 'aaaaaaaa-0000-0000-0000-000000000003';
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('un istruttore non disattiva', tenta($$update persone set attiva = false where id = 'aaaaaaaa-0000-0000-0000-000000000002'$$), 'a vuoto (0 righe)');
select atteso('né chiama la funzione', tenta($$select iscrizioni_alla_disattivazione()::text$$), 'NEGATO: permission denied…');
reset role;
select chi('33333333-3333-3333-3333-333333333333');
set role authenticated;
select atteso('un iscritto non disattiva se stesso', tenta($$update persone set attiva = false where id = 'aaaaaaaa-0000-0000-0000-000000000003'$$), 'a vuoto (0 righe)');
reset role;
select chi('');
set role anon;
select atteso('anon nemmeno', tenta($$update persone set attiva = false where id = 'aaaaaaaa-0000-0000-0000-000000000002'$$), 'NEGATO: …');
reset role;
select atteso('Marco ha ancora Karate', iscrizioni_di('aaaaaaaa-0000-0000-0000-000000000002'),
  'Judo 1:' || oggi_roma() || ', Judo 2:' || oggi_roma(10) || ', Judo 3:' || oggi_roma(-100) || ', Karate:aperta');
select atteso('Sara ha ancora Judo 1', iscrizioni_di('aaaaaaaa-0000-0000-0000-000000000003'), 'Judo 1:aperta');

\echo ''
\echo '--- 5. chi era già disattivato prima del 94 ---'
-- Disattivata senza passare dal trigger (com'era sul database vero prima del 94), con un corso aperto e uno futuro.
insert into persone (id, nome, cognome, ruolo, email, attiva) values
  ('aaaaaaaa-0000-0000-0000-000000000005', 'Luca', 'Vecchio', 'iscritto', 'luca@esempio.it', false);
insert into iscrizioni (corso_id, persona_id, dal, al) values
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000005', current_date - 300, null),
  ('cccccccc-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000005', current_date + 5, null);
\ir ../94-disattiva-chiude-iscrizioni.sql
select atteso('rilanciare il 94 le chiude', iscrizioni_di('aaaaaaaa-0000-0000-0000-000000000005'),
  'Judo 2:' || oggi_roma(5) || ', Karate:' || oggi_roma());
select atteso('e non tocca chi è attivo', iscrizioni_di('aaaaaaaa-0000-0000-0000-000000000003'), 'Judo 1:aperta');
