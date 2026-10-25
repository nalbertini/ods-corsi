-- Chi ha pagato un movimento non identificato: il database propone la persona oltre che per nome anche per
-- genitore e per codice fiscale, senza mostrare a chi amministra nessun dato delle persone.
--   * `abbina_pagatori_movimento(movimento, corsi)`: le persone che il movimento «Da classificare» può essere (Contabilità,
--     riquadro «Suggerito»). Un punteggio somma i segnali: nome e cognome interi nel testo; nome e cognome del genitore
--     (anagrafiche) → i figli; codice fiscale letto dalla causale (`movimenti_codici_letti`, solo bancari nuovi) del
--     genitore o della persona; l'importo, se è il prezzo di un corso del listino a cui è iscritta, col cognome (i corsi
--     li ricava il database: `corsi` non conta); lo storico (un altro movimento con le stesse parole, senza le cifre, già
--     collegato a lei); il nome di battesimo con una parola del corso a cui è iscritta; il cognome proprio o del
--     genitore, che da solo propone solo se nessuno ha di più (di uno solo; di più, gli iscritti quel giorno, se no in
--     qualunque momento). Rende solo id, nome, cognome, `come` (il segnale più forte), `gia_iscritto` (iscrizione che
--     copre il giorno del movimento, non oggi) e `sicuro` (il primo, alto e staccato dal secondo; mai per nome e corso):
--     mai il punteggio. In ordine di punteggio, a pari prima chi non è iscritto. Al massimo 8, solo persone attive.
--   * `abbina_testo_banca(testo, movimenti)`: per «Importa banca → Da decidere», quali dei movimenti già scritti
--     (causale «Cliente NOME per …», o persona collegata) sono di chi è nel testo, per nome o per genitore. Rende solo
--     `movimento_id` e `come`.
--   * il codice fiscale letto entra con `importa_prima_nota` (chiave `codice_fiscale_letto`, al massimo due codici validi),
--     non si legge da nessuna parte e si cancella quando il movimento è classificato e collegato a una persona.
--   * Solo e_amministrazione() (la segreteria no: i movimenti non li legge), con il tetto di `cerca_pagatori` (60 in 10 minuti, 500 al giorno).
-- Le stesse regole di src/lib/abbinaMovimenti.ts, provate da scripts/prova-abbina-movimenti.mjs.
-- Si lancia dopo finto-supabase.sql e i file dello schema, su un database suo. Nomi e codici tutti inventati.
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
create or replace function id_mov(d text) returns uuid language sql stable security definer set search_path = public as $$ select id from movimenti where descrizione = d $$;
grant execute on function tenta(text), atteso(text, text, text), chi(text), id_mov(text) to anon, authenticated;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'ada@ods.it'),
  ('55555555-5555-5555-5555-555555555555', 'maura@ods.it');
-- Anna: solo segreteria. Ada: amministrazione. Maura: istruttore.
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Ada', 'Conti', 'amministrazione', 'ada@ods.it', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'Maura', 'Uno', 'istruttore', 'maura@ods.it', '55555555-5555-5555-5555-555555555555');

-- Le persone. Manuel Prudente è figlio di Domenico (che nelle persone non c'è); Luca Prudente è un altro.
-- Sofia ed Elia Bruno sono figli di Andrea Vaccaro (Ines, spenta, anche); Marta Gallo è adulta, col suo codice.
insert into persone (id, nome, cognome, ruolo, attiva) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'Manuel', 'Prudente', 'iscritto', true),
  ('eeeeeeee-0000-0000-0000-000000000002', 'Luca', 'Prudente', 'iscritto', true),
  ('eeeeeeee-0000-0000-0000-000000000003', 'Sofia', 'Bruno', 'iscritto', true),
  ('eeeeeeee-0000-0000-0000-000000000004', 'Elia', 'Bruno', 'iscritto', true),
  ('eeeeeeee-0000-0000-0000-000000000005', 'Ines', 'Bruno', 'iscritto', false),
  ('eeeeeeee-0000-0000-0000-000000000006', 'Marta', 'Gallo', 'iscritto', true),
  ('eeeeeeee-0000-0000-0000-000000000011', 'Anna', 'Ferri', 'iscritto', true),
  ('eeeeeeee-0000-0000-0000-000000000012', 'Bruno', 'Ferri', 'iscritto', true),
  ('eeeeeeee-0000-0000-0000-000000000013', 'Carlo', 'Ferri', 'iscritto', true),
  ('eeeeeeee-0000-0000-0000-000000000014', 'Dora', 'Ferri', 'iscritto', true),
  ('eeeeeeee-0000-0000-0000-000000000015', 'Ennio', 'Ferri', 'iscritto', true);
insert into persone (nome, cognome, ruolo) select 'Pino' || i, 'Pini', 'iscritto' from generate_series(1, 10) i;
insert into anagrafiche (persona_id, codice_fiscale, genitore_nome, genitore_cognome, genitore_codice_fiscale) values
  ('eeeeeeee-0000-0000-0000-000000000001', null, 'Domenico', 'Prudente', 'PRDDNC70A01L219K'),
  ('eeeeeeee-0000-0000-0000-000000000003', null, 'Andrea', 'Vaccaro', 'VCCNDR75B02L219Z'),
  ('eeeeeeee-0000-0000-0000-000000000004', null, 'Andrea', 'Vaccaro', 'VCCNDR75B02L219Z'),
  ('eeeeeeee-0000-0000-0000-000000000005', null, 'Andrea', 'Vaccaro', 'VCCNDR75B02L219Z'),
  ('eeeeeeee-0000-0000-0000-000000000006', 'GLLMRT85C45L219P', null, null, null);
insert into anagrafiche (persona_id, genitore_nome, genitore_cognome)
  select id, 'Rosa', 'Pini' from persone where cognome = 'Pini';

-- Le iscrizioni, viste dal 9/10/2026 (il giorno del movimento): Anna sì; Bruno finita a settembre; Carlo comincia a
-- novembre; Dora finita il 15/10 (oggi, il 25, non c'è più ma il 9 c'era); Ennio sì.
insert into corsi (id, nome) values ('cccccccc-0000-0000-0000-000000000001', 'Judo');
insert into iscrizioni (corso_id, persona_id, dal, al) values
  ('cccccccc-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000011', '2026-09-01', null),
  ('cccccccc-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000012', '2025-09-01', '2026-09-30'),
  ('cccccccc-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000013', '2026-11-01', null),
  ('cccccccc-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000014', '2026-09-01', '2026-10-15'),
  ('cccccccc-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000015', '2026-09-01', null);

-- Regole 5 e 6, viste dal 9/10/2026. Greco: Rita iscritta, Sara lo era, Tea mai. Riva: Eva lo era, Ivo lo sarà, Leo
-- mai. Pozzi: nessuno iscritto. Pia Sala è figlia di Ugo Tosi. Ada Moro iscritta. Giulia Esposito a Psicomotricità,
-- Giulia Marino a Judo; Nora Galli ad Aikido 2 adesso, Nora Fabbri e Olga Ricci la stagione scorsa.
insert into persone (id, nome, cognome, ruolo) values
  ('eeeeeeee-0000-0000-0000-000000000021', 'Rita', 'Greco', 'iscritto'),
  ('eeeeeeee-0000-0000-0000-000000000022', 'Sara', 'Greco', 'iscritto'),
  ('eeeeeeee-0000-0000-0000-000000000023', 'Tea', 'Greco', 'iscritto'),
  ('eeeeeeee-0000-0000-0000-000000000024', 'Eva', 'Riva', 'iscritto'),
  ('eeeeeeee-0000-0000-0000-000000000025', 'Ivo', 'Riva', 'iscritto'),
  ('eeeeeeee-0000-0000-0000-000000000026', 'Leo', 'Riva', 'iscritto'),
  ('eeeeeeee-0000-0000-0000-000000000027', 'Lia', 'Pozzi', 'iscritto'),
  ('eeeeeeee-0000-0000-0000-000000000028', 'Ugo', 'Pozzi', 'iscritto'),
  ('eeeeeeee-0000-0000-0000-000000000029', 'Pia', 'Sala', 'iscritto'),
  ('eeeeeeee-0000-0000-0000-000000000030', 'Ada', 'Moro', 'iscritto'),
  ('eeeeeeee-0000-0000-0000-000000000031', 'Giulia', 'Esposito', 'iscritto'),
  ('eeeeeeee-0000-0000-0000-000000000032', 'Giulia', 'Marino', 'iscritto'),
  ('eeeeeeee-0000-0000-0000-000000000033', 'Nora', 'Fabbri', 'iscritto'),
  ('eeeeeeee-0000-0000-0000-000000000034', 'Nora', 'Galli', 'iscritto'),
  ('eeeeeeee-0000-0000-0000-000000000035', 'Olga', 'Ricci', 'iscritto');
insert into anagrafiche (persona_id, genitore_nome, genitore_cognome) values ('eeeeeeee-0000-0000-0000-000000000029', 'Ugo', 'Tosi');
insert into corsi (id, nome) values ('cccccccc-0000-0000-0000-000000000002', 'Psicomotricità'), ('cccccccc-0000-0000-0000-000000000003', 'Aikido 2');
insert into iscrizioni (corso_id, persona_id, dal, al) values
  ('cccccccc-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000021', '2026-09-01', null),
  ('cccccccc-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000022', '2025-09-01', '2026-06-30'),
  ('cccccccc-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000024', '2025-09-01', '2026-06-30'),
  ('cccccccc-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000025', '2026-11-01', null),
  ('cccccccc-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000030', '2026-09-01', null),
  ('cccccccc-0000-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-000000000031', '2026-09-01', null),
  ('cccccccc-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000032', '2026-09-01', null),
  ('cccccccc-0000-0000-0000-000000000003', 'eeeeeeee-0000-0000-0000-000000000033', '2025-09-01', '2026-06-30'),
  ('cccccccc-0000-0000-0000-000000000003', 'eeeeeeee-0000-0000-0000-000000000034', '2026-09-01', null),
  ('cccccccc-0000-0000-0000-000000000003', 'eeeeeeee-0000-0000-0000-000000000035', '2025-09-01', '2026-06-30');

-- I movimenti da classificare, scritti come li scrive l'import della banca (sono tutti del 9/10/2026, nel Conto
-- Corrente): alcuni col codice fiscale letto dalla causale.
create or replace function riga(k text, d text, cf text[] default null) returns jsonb language sql immutable as $$
  select jsonb_strip_nulls(jsonb_build_object('chiave', 'banca:' || k, 'data', '2026-10-09', 'cassa', 'conto', 'tipo', 'entrata',
    'importo', 5000, 'descrizione', d, 'voce', 'Da classificare', 'codice_fiscale_letto', to_jsonb(cf))) $$;
grant execute on function riga(text, text, text[]) to authenticated;
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select importa_prima_nota(jsonb_build_array(
  riga('nome', 'Da PRUDENTE DOMENICO,MANCA FEDERICA PAOLA, TRN 1 per Quota associativa 2026/2027 Prudente Manuel BONIFICO SEPA'),
  riga('genitore', 'Da VACCARO ANDREA TRN 2 BONIFICO SEPA'),
  riga('cf', 'Da ROSSI GINO TRN 3 BONIFICO SEPA', array['VCCNDR75B02L219Z']),
  riga('cf-adulta', 'Da ROSSI GINO TRN 4 BONIFICO SEPA', array['GLLMRT85C45L219P']),
  riga('cf-dopo-nome', 'Da GALLO MARTA TRN 5 BONIFICO SEPA', array['VCCNDR75B02L219Z']),
  riga('cf-di-nessuno', 'Da ROSSI GINO TRN 6 BONIFICO SEPA', array['ZZZZZZ99Z99Z999Z']),
  riga('senza-cf', 'Da ROSSI GINO TRN 7 BONIFICO SEPA'),
  riga('tre-cf', 'Da ROSSI GINO TRN 8 BONIFICO SEPA', array['VCCNDR75B02L219Z', 'GLLMRT85C45L219P', 'PRDDNC70A01L219K']),
  riga('ferri', 'Da Ferri Anna, Ferri Bruno, Ferri Carlo, Ferri Dora BONIFICO SEPA'),
  riga('ennio', 'Da Ferri Ennio BONIFICO SEPA'),
  riga('pini', 'Da Rosa Pini BONIFICO SEPA'),
  riga('solo-cognome', 'Da PRUDENTE LUCIANO BONIFICO SEPA'),
  riga('corso', 'Da FERRI TRN 20 BONIFICO SEPA'),
  riga('cf-con-nome', 'Da GALLO MARTA TRN 9 BONIFICO', array['VCCNDR75B02L219Z']),
  riga('genitore-e-cf', 'Da VACCARO ANDREA TRN 10 BONIFICO', array['GLLMRT85C45L219P']),
  riga('storico', 'Da CONTI MARIO TRN 30 BONIFICO SEPA'),
  riga('storico-prima', 'Da CONTI MARIO TRN 31 BONIFICO SEPA'),
  riga('storico-cognome', 'Da GALLO TRN 40 BONIFICO SEPA'),
  riga('storico-cognome-prima', 'Da GALLO TRN 41 BONIFICO SEPA'),
  riga('storico-annullato', 'Da NERI PIA TRN 50 BONIFICO SEPA'),
  riga('storico-annullato-prima', 'Da NERI PIA TRN 51 BONIFICO SEPA'),

  riga('greco', 'Da GRECO TRN 30 BONIFICO SEPA'),
  riga('riva', 'Da RIVA TRN 31 BONIFICO SEPA'),
  riga('pozzi', 'Da POZZI TRN 32 BONIFICO SEPA'),
  riga('tosi', 'Da TOSI TRN 33 BONIFICO SEPA'),
  riga('moro', 'Da MORO TRN 34 BONIFICO SEPA'),
  riga('psico', 'Retta psicomotricita'' Giulia TRN 35'),
  riga('aikido-nora', 'Retta aikido Nora TRN 36'),
  riga('aikido-olga', 'Retta aikido Olga TRN 37'),
  riga('cifre', 'Retta 2 Olga TRN 38'),
  riga('solo-nome', 'Retta Giulia TRN 39'),
  riga('cognome-e-corso', 'Retta aikido Nora Riva TRN 40'),
  riga('greco-tea', 'Da GRECO TEA TRN 42 BONIFICO SEPA'),
  riga('ferri-senza-corso', 'Da FERRI TRN 22 BONIFICO SEPA'),
  riga('ennio-corso', 'Da Ferri Ennio TRN 21 BONIFICO SEPA'),
  riga('gallo-due-volte', 'Da GALLO GALLO TRN 43 BONIFICO SEPA')));
reset role;
-- Il listino: Judo costa 40 € a trimestre. Due movimenti li paga quell'importo (gli altri sono di 50 €, che non è di
-- nessun corso).
update impostazioni set listino = jsonb_build_object('corsi', jsonb_build_array(
  jsonb_build_object('corsoId', 'cccccccc-0000-0000-0000-000000000001', 'prezzi', jsonb_build_array(jsonb_build_object('saldo', 150, 'trimestre', 40))),
  jsonb_build_object('corsoId', '', 'prezzi', jsonb_build_array(jsonb_build_object('trimestre', 40))),
  jsonb_build_object('corsoId', 'cccccccc-0000-0000-0000-000000000002', 'prezzi', jsonb_build_array(jsonb_build_object('trimestre', '40')))));
update movimenti set importo = 4000 where descrizione in ('Da FERRI TRN 20 BONIFICO SEPA', 'Da Ferri Ennio TRN 21 BONIFICO SEPA');

\echo ''
\echo '--- 1. il codice fiscale letto: si tiene, non si vede, si cancella ---'
-- (tenta, anche per le letture: finché la tabella non c'è, ogni caso lo dice e la prova va avanti)
select atteso('i codici validi si tengono, al massimo due, nell''ordine in cui sono nella causale',
  tenta($$select array_to_string(c.codici, ',') from movimenti m join movimenti_codici_letti c on c.movimento_id = m.id where m.descrizione like '%TRN 8%'$$), 'VCCNDR75B02L219Z,GLLMRT85C45L219P');
select atteso('un movimento senza codice non ne ha', tenta($$select coalesce((select c.codici::text from movimenti_codici_letti c where c.movimento_id = id_mov('Da ROSSI GINO TRN 7 BONIFICO SEPA')), 'niente')$$), 'niente');
select atteso('un codice malformato non si tiene', tenta($$select coalesce((select c.codici::text from movimenti_codici_letti c where c.movimento_id = id_mov('Da ROSSI GINO TRN 6 BONIFICO SEPA')), 'niente')$$), 'niente');
select atteso('chi amministra non lo legge', tenta($$select has_table_privilege('authenticated', 'movimenti_codici_letti', 'select')::text$$), 'false');
select atteso('né chi non ha fatto l''accesso', tenta($$select has_table_privilege('anon', 'movimenti_codici_letti', 'select')::text$$), 'false');
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('classificato e collegato a una persona, il codice si cancella',
  tenta($$select (cambia_voce_movimenti(array[id_mov('Da GALLO MARTA TRN 5 BONIFICO SEPA')], (select id from voci_contabili where nome = 'Quota associativa' and tipo = 'entrata'), 'eeeeeeee-0000-0000-0000-000000000006'))->>'cambiati'$$), '1');
reset role;
select atteso('…e non resta in nessuna riga di quel movimento',
  tenta($$select coalesce((select c.codici::text from movimenti_codici_letti c where c.movimento_id = id_mov('Da GALLO MARTA TRN 5 BONIFICO SEPA')), 'niente')$$), 'niente');
select atteso('gli altri lo tengono', tenta($$select count(*)::text from movimenti_codici_letti$$), '5');
-- Lo storico: tre movimenti di prima collegati a Marta (uno poi annullato).
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select cambia_voce_movimenti(array[id_mov(d)], (select id from voci_contabili where nome = 'Quota associativa' and tipo = 'entrata'), 'eeeeeeee-0000-0000-0000-000000000006')
  from unnest(array['Da CONTI MARIO TRN 31 BONIFICO SEPA', 'Da GALLO TRN 41 BONIFICO SEPA', 'Da NERI PIA TRN 51 BONIFICO SEPA']) d;
reset role;
update movimenti set annullato_il = now() where descrizione = 'Da NERI PIA TRN 51 BONIFICO SEPA';

\echo ''
\echo '--- 2. Contabilità: abbina_pagatori_movimento ---'
create or replace function abbinati(d text, corsi uuid[] default null) returns text language plpgsql as $$
declare r text;
begin
  select string_agg(nome || ' ' || cognome || ' (' || come || case when gia_iscritto then ', già iscritto' else '' end || ')', '; ' order by ord)
    into r from (select a.*, row_number() over () ord from abbina_pagatori_movimento(id_mov(d), corsi) a) x;
  return coalesce(r, 'nessuno');
end $$;
-- Chi l'app preseleziona: le righe «sicuro» (al più una, la prima).
create or replace function preselezionato(d text, corsi uuid[] default null) returns text language plpgsql as $$
declare r text;
begin
  select string_agg(nome || case when ord > 1 then ' (non primo!)' else '' end, '; ' order by ord) into r
    from (select a.*, row_number() over () ord from abbina_pagatori_movimento(id_mov(d), corsi) a) x where sicuro;
  return coalesce(r, 'nessuno');
end $$;
grant execute on function abbinati(text, uuid[]), preselezionato(text, uuid[]) to authenticated;
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('regola 1: nome e cognome interi nel testo; «Prudente Domenico» è il genitore, e un cognome solo non basta',
  tenta($$select abbinati('Da PRUDENTE DOMENICO,MANCA FEDERICA PAOLA, TRN 1 per Quota associativa 2026/2027 Prudente Manuel BONIFICO SEPA')$$), 'Manuel Prudente (nome intero)');
select atteso('…ed è «sicuro»: nome, genitore e cognome sommati, Luca (solo il cognome) molto sotto',
  tenta($$select preselezionato('Da PRUDENTE DOMENICO,MANCA FEDERICA PAOLA, TRN 1 per Quota associativa 2026/2027 Prudente Manuel BONIFICO SEPA')$$), 'Manuel');
select atteso('il genitore nel testo, i suoi figli attivi (non Ines, spenta)',
  tenta($$select abbinati('Da VACCARO ANDREA TRN 2 BONIFICO SEPA')$$), 'Elia Bruno (genitore); Sofia Bruno (genitore)');
select atteso('…nessuno «sicuro», perché sono due', tenta($$select preselezionato('Da VACCARO ANDREA TRN 2 BONIFICO SEPA')$$), 'nessuno');
select atteso('il codice del genitore, i suoi figli',
  tenta($$select abbinati('Da ROSSI GINO TRN 3 BONIFICO SEPA')$$), 'Elia Bruno (codice fiscale); Sofia Bruno (codice fiscale)');
select atteso('se paga l''adulto per sé, il suo codice',
  tenta($$select abbinati('Da ROSSI GINO TRN 4 BONIFICO SEPA')$$), 'Marta Gallo (codice fiscale)');
select atteso('il codice da solo, di una persona sola: «sicuro»', tenta($$select preselezionato('Da ROSSI GINO TRN 4 BONIFICO SEPA')$$), 'Marta');
select atteso('nome e codice di due persone diverse: tutte e due, il nome (col cognome) prima',
  tenta($$select abbinati('Da GALLO MARTA TRN 9 BONIFICO')$$), 'Marta Gallo (nome intero); Elia Bruno (codice fiscale); Sofia Bruno (codice fiscale)');
select atteso('…nessuno «sicuro»: il primo non è staccato abbastanza dal secondo', tenta($$select preselezionato('Da GALLO MARTA TRN 9 BONIFICO')$$), 'nessuno');
select atteso('genitore per nome e codice di un''altra: a pari, cognome e nome',
  tenta($$select abbinati('Da VACCARO ANDREA TRN 10 BONIFICO')$$), 'Elia Bruno (genitore); Sofia Bruno (genitore); Marta Gallo (codice fiscale)');
select atteso('due codici nella causale: contano tutti e due',
  tenta($$select abbinati('Da ROSSI GINO TRN 8 BONIFICO SEPA')$$), 'Elia Bruno (codice fiscale); Sofia Bruno (codice fiscale); Marta Gallo (codice fiscale)');
select atteso('collegato a una persona, il codice non c''è più: resta il nome',
  tenta($$select abbinati('Da GALLO MARTA TRN 5 BONIFICO SEPA')$$), 'Marta Gallo (nome intero)');
select atteso('un codice di nessuno non propone nessuno', tenta($$select abbinati('Da ROSSI GINO TRN 6 BONIFICO SEPA')$$), 'nessuno');
select atteso('un movimento senza codice letto né altro: nessuno', tenta($$select abbinati('Da ROSSI GINO TRN 7 BONIFICO SEPA')$$), 'nessuno');
select atteso('il cognome di due persone mai iscritte non basta (né il solo nome)', tenta($$select abbinati('Da PRUDENTE LUCIANO BONIFICO SEPA')$$), 'nessuno');
select atteso('prima chi non è iscritto il giorno del movimento, in fondo chi lo è (anche se oggi non lo è più)',
  tenta($$select abbinati('Da Ferri Anna, Ferri Bruno, Ferri Carlo, Ferri Dora BONIFICO SEPA')$$),
  'Bruno Ferri (nome intero); Carlo Ferri (nome intero); Anna Ferri (nome intero, già iscritto); Dora Ferri (nome intero, già iscritto)');
select atteso('un iscritto solo si propone lo stesso, col segno «già iscritto»', tenta($$select abbinati('Da Ferri Ennio BONIFICO SEPA')$$), 'Ennio Ferri (nome intero, già iscritto)');
select atteso('…ma non è mai «sicuro»', tenta($$select preselezionato('Da Ferri Ennio BONIFICO SEPA')$$), 'nessuno');
-- L'importo: il database cerca nel listino i corsi che costano l'importo del movimento, e guarda chi è iscritto a
-- quei corsi il giorno del movimento e ha nel testo il cognome suo o del genitore. Qui l'iscrizione è a favore.
select atteso('il solo cognome + iscritto al corso dell''importo (anche chi finisce il 15/10), non «già iscritto»; non Bruno (finita) né Carlo (da novembre)',
  tenta($$select abbinati('Da FERRI TRN 20 BONIFICO SEPA')$$),
  'Anna Ferri (corso e cognome); Dora Ferri (corso e cognome); Ennio Ferri (corso e cognome)');
select atteso('…da soli non bastano a essere «sicuro»',
  tenta($$select preselezionato('Da FERRI TRN 20 BONIFICO SEPA')$$), 'nessuno');
select atteso('i corsi li ricava il database: quelli passati da chi chiama non contano',
  tenta($$select abbinati('Da FERRI TRN 20 BONIFICO SEPA', array[gen_random_uuid()])$$),
  'Anna Ferri (corso e cognome); Dora Ferri (corso e cognome); Ennio Ferri (corso e cognome)');
select atteso('…né per «già iscritto» e «sicuro»: Ennio paga 50 €, che non è il prezzo di Judo',
  tenta($$select abbinati('Da Ferri Ennio BONIFICO SEPA', array['cccccccc-0000-0000-0000-000000000001']::uuid[]) || ' · '
    || preselezionato('Da Ferri Ennio BONIFICO SEPA', array['cccccccc-0000-0000-0000-000000000001']::uuid[])$$), 'Ennio Ferri (nome intero, già iscritto) · nessuno');
select atteso('senza il corso dell''importo vale il solo cognome: i Ferri iscritti quel giorno',
  tenta($$select abbinati('Da FERRI TRN 22 BONIFICO SEPA')$$), 'Anna Ferri (cognome); Dora Ferri (cognome); Ennio Ferri (cognome)');
select atteso('nome intero e corso dell''importo si sommano: Ennio primo, l''iscrizione a quel corso è a favore; l''importo non sparisce',
  tenta($$select abbinati('Da Ferri Ennio TRN 21 BONIFICO SEPA')$$), 'Ennio Ferri (nome intero); Anna Ferri (corso e cognome); Dora Ferri (corso e cognome)');
select atteso('…e «sicuro»', tenta($$select preselezionato('Da Ferri Ennio TRN 21 BONIFICO SEPA')$$), 'Ennio');
select atteso('il cognome del genitore, di uno solo', tenta($$select abbinati('Da TOSI TRN 33 BONIFICO SEPA')$$), 'Pia Sala (cognome)');
select atteso('…ma il solo cognome non è mai «sicuro», neanche di uno solo', tenta($$select preselezionato('Da TOSI TRN 33 BONIFICO SEPA')$$), 'nessuno');
select atteso('…di uno solo, iscritto quel giorno: col segno', tenta($$select abbinati('Da MORO TRN 34 BONIFICO SEPA')$$), 'Ada Moro (cognome, già iscritto)');
select atteso('…di più persone: solo chi è iscritto il giorno del movimento', tenta($$select abbinati('Da GRECO TRN 30 BONIFICO SEPA')$$), 'Rita Greco (cognome)');
select atteso('…se nessuno lo è, chi lo è stato o lo sarà', tenta($$select abbinati('Da RIVA TRN 31 BONIFICO SEPA')$$), 'Eva Riva (cognome); Ivo Riva (cognome)');
select atteso('…se nessuno ha iscrizioni, nessuno', tenta($$select abbinati('Da POZZI TRN 32 BONIFICO SEPA')$$), 'nessuno');
select atteso('il nome intero passa davanti agli omonimi iscritti, ed è «sicuro»',
  tenta($$select abbinati('Da GRECO TEA TRN 42 BONIFICO SEPA') || ' · ' || preselezionato('Da GRECO TEA TRN 42 BONIFICO SEPA')$$), 'Tea Greco (nome intero) · Tea');
select atteso('nome di battesimo + un corso a cui è iscritta (l''apostrofo non conta)', tenta($$select abbinati('Retta psicomotricita'' Giulia TRN 35')$$), 'Giulia Esposito (nome e corso)');
select atteso('…mai «sicuro»', tenta($$select preselezionato('Retta psicomotricita'' Giulia TRN 35')$$), 'nessuno');
select atteso('…chi è iscritto quel giorno vince su chi lo era prima', tenta($$select abbinati('Retta aikido Nora TRN 36')$$), 'Nora Galli (nome e corso)');
select atteso('…se nessuno lo è quel giorno, vale un''iscrizione in qualunque momento', tenta($$select abbinati('Retta aikido Olga TRN 37')$$), 'Olga Ricci (nome e corso)');
select atteso('…le cifre del nome del corso non bastano', tenta($$select abbinati('Retta 2 Olga TRN 38')$$), 'nessuno');
select atteso('…il solo nome non basta', tenta($$select abbinati('Retta Giulia TRN 39')$$), 'nessuno');
select atteso('nome e corso vince sul solo cognome', tenta($$select abbinati('Retta aikido Nora Riva TRN 40')$$), 'Nora Galli (nome e corso)');
reset role;
delete from ricerche_pagatori;  -- le prove sono tante: il tetto si prova nella sezione 4
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('lo storico: le stesse parole (le cifre non contano) già collegate a Marta',
  tenta($$select abbinati('Da CONTI MARIO TRN 30 BONIFICO SEPA')$$), 'Marta Gallo (storico)');
select atteso('…da solo non è «sicuro»', tenta($$select preselezionato('Da CONTI MARIO TRN 30 BONIFICO SEPA')$$), 'nessuno');
select atteso('storico e cognome insieme: «sicuro»', tenta($$select abbinati('Da GALLO TRN 40 BONIFICO SEPA') || ' · ' || preselezionato('Da GALLO TRN 40 BONIFICO SEPA')$$), 'Marta Gallo (storico) · Marta');
select atteso('un movimento collegato e poi annullato non fa storico', tenta($$select abbinati('Da NERI PIA TRN 50 BONIFICO SEPA')$$), 'nessuno');
select atteso('lo storico vuole le stesse parole, anche ripetute: «Gallo Gallo» è «Gallo»',
  tenta($$select abbinati('Da GALLO GALLO TRN 43 BONIFICO SEPA')$$), 'Marta Gallo (storico)');
select atteso('il movimento collegato non è storico di sé stesso: resta il nome',
  tenta($$select abbinati('Da GALLO MARTA TRN 5 BONIFICO SEPA')$$), 'Marta Gallo (nome intero)');
select atteso('al massimo otto', tenta($$select count(*)::text from abbina_pagatori_movimento(id_mov('Da Rosa Pini BONIFICO SEPA'))$$), '8');
select atteso('escono solo id, nome, cognome, come, già iscritto e sicuro: mai codici, genitori, date, corsi o punteggi',
  (select string_agg(p.parameter_name, ',' order by p.ordinal_position) from information_schema.routines r join information_schema.parameters p on p.specific_name = r.specific_name
    where r.routine_name = 'abbina_pagatori_movimento' and p.parameter_mode = 'OUT'), 'persona_id,nome,cognome,come,gia_iscritto,sicuro');
select atteso('un movimento che non c''è non propone nessuno', tenta($$select count(*)::text from abbina_pagatori_movimento(gen_random_uuid())$$), '0');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria no: i movimenti non li legge', tenta($$select count(*)::text from abbina_pagatori_movimento(id_mov('Da Ferri Ennio BONIFICO SEPA'))$$), 'NEGATO: i nomi dei movimenti li vede chi cura la contabilità');
reset role;
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('l''amministrazione la usa', tenta($$select abbinati('Da Ferri Ennio BONIFICO SEPA')$$), 'Ennio Ferri (nome intero, già iscritto)');
reset role;
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('l''istruttore no', tenta($$select count(*)::text from abbina_pagatori_movimento(id_mov('Da Ferri Ennio BONIFICO SEPA'))$$), 'NEGATO: i nomi dei movimenti li vede chi cura la contabilità');
reset role;
select chi('');
set role anon;
select atteso('chi non ha fatto l''accesso no', tenta($$select count(*)::text from abbina_pagatori_movimento(id_mov('Da Ferri Ennio BONIFICO SEPA'))$$), 'NEGATO: permission denied for function abbina_pagatori_movimento');
reset role;

\echo ''
\echo '--- 3. Importa banca: abbina_testo_banca ---'
-- I candidati sono movimenti già scritti a mano, con la causale «Cliente NOME per …».
insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione)
  select 'entrata', '2026-10-09', 5000, (select id from voci_contabili where nome = 'Quota associativa' and tipo = 'entrata'),
    (select id from casse where nome = 'Conto Corrente'), d
  from unnest(array['Cliente PRUDENTE MANUEL per QUOTA ASSOCIATIVA', 'Cliente BRUNO SOFIA per QUOTA ASSOCIATIVA', 'Cliente BRUNO INES per QUOTA ASSOCIATIVA', 'Cliente GALLO MARTA per CORSO']) d;
-- security definer: la segreteria non legge i movimenti, e qui si prova abbina_testo_banca, non la lettura del libro.
create or replace function candidati_di(testo text, variadic nomi text[]) returns text language plpgsql security definer set search_path = public as $$
declare r text;
begin
  select string_agg(m.descrizione || ' (' || a.come || ')', '; ' order by m.descrizione) into r
    from abbina_testo_banca(testo, array(select id_mov(n) from unnest(nomi) n)) a join movimenti m on m.id = a.movimento_id;
  return coalesce(r, 'nessuno');
end $$;
grant execute on function candidati_di(text, text[]) to authenticated;
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('il genitore nel testo (Andrea Vaccaro) indica il movimento del figlio',
  tenta($$select candidati_di('Da VACCARO ANDREA TRN 99', 'Cliente PRUDENTE MANUEL per QUOTA ASSOCIATIVA', 'Cliente BRUNO SOFIA per QUOTA ASSOCIATIVA', 'Cliente GALLO MARTA per CORSO')$$),
  'Cliente BRUNO SOFIA per QUOTA ASSOCIATIVA (genitore)');
select atteso('anche in altro ordine e senza maiuscole', tenta($$select candidati_di('da andrea vaccaro', 'Cliente BRUNO SOFIA per QUOTA ASSOCIATIVA')$$), 'Cliente BRUNO SOFIA per QUOTA ASSOCIATIVA (genitore)');
select atteso('Domenico Prudente è il genitore di Manuel: lo dice (a scegliere fra nome e genitore è l''app)',
  tenta($$select candidati_di('Da PRUDENTE DOMENICO,MANCA FEDERICA PAOLA, TRN 1', 'Cliente PRUDENTE MANUEL per QUOTA ASSOCIATIVA')$$), 'Cliente PRUDENTE MANUEL per QUOTA ASSOCIATIVA (genitore)');
select atteso('nome di uno e genitore di un altro: tutti e due, col loro segno (a scegliere è l''app)',
  tenta($$select candidati_di('Da VACCARO ANDREA per GALLO MARTA TRN 99', 'Cliente BRUNO SOFIA per QUOTA ASSOCIATIVA', 'Cliente GALLO MARTA per CORSO')$$),
  'Cliente BRUNO SOFIA per QUOTA ASSOCIATIVA (genitore); Cliente GALLO MARTA per CORSO (nome intero)');
select atteso('nome e genitore della stessa persona: un segno solo, «nome intero»',
  tenta($$select candidati_di('Da PRUDENTE DOMENICO per PRUDENTE MANUEL', 'Cliente PRUDENTE MANUEL per QUOTA ASSOCIATIVA')$$), 'Cliente PRUDENTE MANUEL per QUOTA ASSOCIATIVA (nome intero)');
select atteso('un nome solo del genitore non basta', tenta($$select candidati_di('Da VACCARO TRN 99', 'Cliente BRUNO SOFIA per QUOTA ASSOCIATIVA')$$), 'nessuno');
select atteso('una persona non attiva non esce', tenta($$select candidati_di('Da VACCARO ANDREA TRN 99', 'Cliente BRUNO INES per QUOTA ASSOCIATIVA')$$), 'nessuno');
select atteso('solo i candidati dati, non altri movimenti', tenta($$select candidati_di('Da VACCARO ANDREA TRN 99', 'Cliente GALLO MARTA per CORSO')$$), 'nessuno');
select atteso('escono solo il movimento e il come: mai nome o codice del genitore',
  (select string_agg(p.parameter_name, ',' order by p.ordinal_position) from information_schema.routines r join information_schema.parameters p on p.specific_name = r.specific_name
    where r.routine_name = 'abbina_testo_banca' and p.parameter_mode = 'OUT'), 'movimento_id,come');
reset role;
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('la segreteria no: i movimenti non li legge', tenta($$select count(*)::text from abbina_testo_banca('Da VACCARO ANDREA', array[id_mov('Cliente BRUNO SOFIA per QUOTA ASSOCIATIVA')])$$), 'NEGATO: i nomi dei movimenti li vede chi cura la contabilità');
reset role;
select chi('55555555-5555-5555-5555-555555555555');
set role authenticated;
select atteso('l''istruttore no', tenta($$select count(*)::text from abbina_testo_banca('Da VACCARO ANDREA', array[id_mov('Cliente BRUNO SOFIA per QUOTA ASSOCIATIVA')])$$), 'NEGATO: i nomi dei movimenti li vede chi cura la contabilità');
reset role;
select chi('');
set role anon;
select atteso('chi non ha fatto l''accesso no', tenta($$select count(*)::text from abbina_testo_banca('Da VACCARO ANDREA', array[id_mov('Cliente BRUNO SOFIA per QUOTA ASSOCIATIVA')])$$), 'NEGATO: permission denied for function abbina_testo_banca');
reset role;

\echo ''
\echo '--- 4. lo stesso tetto di cerca_pagatori (60 in 10 minuti), con lo stesso conto ---'
delete from ricerche_pagatori;
insert into ricerche_pagatori (persona_id) select 'aaaaaaaa-0000-0000-0000-000000000002' from generate_series(1, 60);
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('dopo sessanta ricerche, una pausa (anche quelle di cerca_pagatori contano)',
  tenta($$select count(*)::text from abbina_pagatori_movimento(id_mov('Da Ferri Ennio BONIFICO SEPA'))$$), 'NEGATO: troppe ricerche: riprova fra qualche minuto');
select atteso('…anche per l''importazione della banca',
  tenta($$select count(*)::text from abbina_testo_banca('Da VACCARO ANDREA', array[id_mov('Cliente BRUNO SOFIA per QUOTA ASSOCIATIVA')])$$), 'NEGATO: troppe ricerche: riprova fra qualche minuto');
reset role;
delete from ricerche_pagatori;
insert into ricerche_pagatori (persona_id, quando) select 'aaaaaaaa-0000-0000-0000-000000000002', now() - interval '2 hours' from generate_series(1, 500);
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('cinquecento in un giorno: basta fino a domani',
  tenta($$select count(*)::text from abbina_pagatori_movimento(id_mov('Da Ferri Ennio BONIFICO SEPA'))$$), 'NEGATO: troppe ricerche: riprova fra qualche minuto');
reset role;
select chi('');
