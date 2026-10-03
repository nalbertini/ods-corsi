-- Il conto di una lezione sul tablet (36-tablet-conto-prove.sql): `presenti`
-- di `lezioni_sala` li conta tutti, prove comprese, come prima; `prove_sala`
-- dice quante di quelle presenti sono prove, così il tablet scrive «10 su 10 · +1 PROVA» e non
-- «11 su 10». Solo il tablet di sala la chiama.
-- Si lancia dopo finto-supabase.sql e tutti i file dello schema fino a
-- 36-tablet-conto-prove.sql.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('22222222-2222-2222-2222-222222222222', 'maura@ods.it'),
  ('66666666-6666-6666-6666-666666666666', 'lotta@ods.it');
insert into persone (id, nome, cognome, ruolo, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Maura', 'Uno', 'istruttore', '22222222-2222-2222-2222-222222222222');
insert into sale (id, nome) values ('bbbbbbbb-0000-0000-0000-000000000001', 'Lotta');
insert into postazioni (id, nome, sala_id, utente_id) values
  ('dddddddd-0000-0000-0000-000000000001', 'Tablet Lotta', 'bbbbbbbb-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666666');
insert into corsi (id, nome, sala_id, istruttore_id) values
  ('cccccccc-0000-0000-0000-000000000001', 'Lotta 2', 'bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002');
insert into sessioni (id, corso_id, inizio, fine) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', current_date + interval '12 hours', current_date + interval '13 hours');
-- Dieci iscritti, tutti presenti.
-- (La lezione sta a mezzogiorno di oggi, non a `now()` meno qualcosa: fra
-- mezzanotte e le 00:20 sarebbe finita ieri e `current_date` non la troverebbe.)
insert into persone (id, nome, cognome, ruolo)
  select ('aaaaaaaa-0000-0000-0000-0000000001' || lpad(i::text, 2, '0'))::uuid, 'Iscritto', 'N' || i, 'iscritto' from generate_series(1, 10) i;
insert into iscrizioni (corso_id, persona_id, dal)
  select 'cccccccc-0000-0000-0000-000000000001', id, current_date - 30 from persone where nome = 'Iscritto';
insert into presenze (sessione_id, persona_id, stato)
  select 'eeeeeeee-0000-0000-0000-000000000001', id, 'presente' from persone where nome = 'Iscritto';
-- Due prove: Marco è venuto, Sara è segnata assente.
insert into persone (id, nome, cognome, ruolo) values
  ('ffffffff-0000-0000-0000-000000000001', 'Marco', 'Prova', 'iscritto'),
  ('ffffffff-0000-0000-0000-000000000002', 'Sara', 'Prova', 'iscritto');
insert into prove (sessione_id, persona_id) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000001'),
  ('eeeeeeee-0000-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000002');
insert into presenze (sessione_id, persona_id, stato) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000001', 'presente'),
  ('eeeeeeee-0000-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000002', 'assente');

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
\echo '--- 1. il tablet della Lotta: dieci iscritti presenti e una prova ---'
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('iscritti', (select iscritti::text from lezioni_sala(current_date, current_date)), '10');
select atteso('presenti tutti, la prova compresa', (select presenti::text from lezioni_sala(current_date, current_date)), '11');
select atteso('le prove presenti: una, la prova assente non conta', (select prove::text from prove_sala(current_date, current_date)), '1');
reset role;

\echo ''
\echo '--- 1b. prove sono i presenti non iscritti quel giorno, come nell''app e nelle statistiche ---'
-- Marco ha provato e da oggi è iscritto: è un iscritto, non più una prova.
insert into iscrizioni (corso_id, persona_id, dal) values ('cccccccc-0000-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000001', current_date);
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('chi ha provato e si è iscritto: undici su undici', (select presenti || ' su ' || iscritti from lezioni_sala(current_date, current_date)), '11 su 11');
select atteso('e nessuna prova', coalesce((select prove::text from prove_sala(current_date, current_date)), 'nessuna'), 'nessuna');
reset role;
delete from iscrizioni where persona_id = 'ffffffff-0000-0000-0000-000000000001';
-- Un iscritto con l'iscrizione finita ieri, segnato presente oggi: non è fra gli iscritti, si conta fra le prove.
update iscrizioni set al = current_date - 1 where persona_id = 'aaaaaaaa-0000-0000-0000-000000000110';
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('l''iscrizione finita ieri: presenti meno prove non supera gli iscritti', (select l.presenti - p.prove || ' su ' || l.iscritti from lezioni_sala(current_date, current_date) l join prove_sala(current_date, current_date) p on p.sessione_id = l.id), '9 su 9');
reset role;
update iscrizioni set al = null where persona_id = 'aaaaaaaa-0000-0000-0000-000000000110';

\echo ''
\echo '--- 2. una lezione con sole prove ---'
delete from presenze where persona_id in (select id from persone where nome = 'Iscritto');
select chi('66666666-6666-6666-6666-666666666666');
set role authenticated;
select atteso('nessun iscritto: presenti uno, ed è la prova', (select l.presenti || ' ' || p.prove from lezioni_sala(current_date, current_date) l join prove_sala(current_date, current_date) p on p.sessione_id = l.id), '1 1');
reset role;

\echo ''
\echo '--- 3. chi non è un tablet ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('un istruttore', tenta($$select count(*)::text from lezioni_sala(current_date, current_date)$$), 'NEGATO: solo un tablet di sala');
select atteso('un istruttore, le prove', tenta($$select count(*)::text from prove_sala(current_date, current_date)$$), 'NEGATO: solo un tablet di sala');
reset role;
select chi('');
set role anon;
select atteso('senza accesso', tenta($$select count(*)::text from lezioni_sala(current_date, current_date)$$), 'NEGATO: permission denied…');
select atteso('senza accesso, le prove', tenta($$select count(*)::text from prove_sala(current_date, current_date)$$), 'NEGATO: permission denied…');
reset role;

\echo ''
\echo 'Il conto delle prove sul tablet: tutto come previsto.'
