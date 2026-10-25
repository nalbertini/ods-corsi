-- Chi ha pagato un movimento non identificato: il database propone la persona oltre che per nome anche per
-- genitore e per codice fiscale, senza mostrare a chi amministra nessun dato delle persone.
--   * `abbina_pagatori_movimento(movimento, corsi)`: le persone che il movimento «Da classificare» può essere (Contabilità,
--     riquadro «Suggerito»). Regole in ordine, ognuna solo se la precedente non trova nessuno: 1 nome e cognome interi
--     nel testo; 2 nome e cognome del genitore (anagrafiche) → i figli; 3 codice fiscale letto dalla causale
--     (`movimenti_codici_letti`, solo bancari nuovi) uguale a quello del genitore o della persona. 4 importo → `corsi` (i corsi del listino con quell'importo) → iscritti con cognome proprio o del genitore nel testo;
--     5 (file 120) il solo cognome, proprio o del genitore: di uno solo → lui; di più → gli iscritti quel giorno, se no in
--     qualunque momento; 6 (file 120) nome di battesimo + una parola del corso a cui è iscritto, prima quel giorno. Rende solo
--     id, nome, cognome, `come` e `gia_iscritto` (iscrizione che copre il giorno del movimento, non oggi): prima chi non
--     è iscritto, in fondo chi lo è. Al massimo 8, solo persone attive.
--   * `abbina_testo_banca(testo, movimenti)`: per «Importa banca → Da decidere», quali dei movimenti già scritti
--     (causale «Cliente NOME per …», o persona collegata) sono di un figlio di chi è nel testo. Rende solo
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
  riga('cognome-e-corso', 'Retta aikido Nora Riva TRN 40')));
reset role;

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
select atteso('gli altri lo tengono', tenta($$select count(*)::text from movimenti_codici_letti$$), '3');

\echo ''
\echo '--- 2. Contabilità: abbina_pagatori_movimento ---'
create or replace function abbinati(d text, corsi uuid[] default null) returns text language plpgsql as $$
declare r text;
begin
  select string_agg(nome || ' ' || cognome || ' (' || come || case when gia_iscritto then ', già iscritto' else '' end || ')', '; ' order by ord)
    into r from (select a.*, row_number() over () ord from abbina_pagatori_movimento(id_mov(d), corsi) a) x;
  return coalesce(r, 'nessuno');
end $$;
grant execute on function abbinati(text, uuid[]) to authenticated;
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('regola 1: nome e cognome interi nel testo; «Prudente Domenico» è il genitore, e un cognome solo non basta',
  tenta($$select abbinati('Da PRUDENTE DOMENICO,MANCA FEDERICA PAOLA, TRN 1 per Quota associativa 2026/2027 Prudente Manuel BONIFICO SEPA')$$), 'Manuel Prudente (nome intero)');
select atteso('regola 2: il genitore nel testo, i suoi figli attivi (non Ines, spenta)',
  tenta($$select abbinati('Da VACCARO ANDREA TRN 2 BONIFICO SEPA')$$), 'Elia Bruno (genitore); Sofia Bruno (genitore)');
select atteso('regola 3: il codice del genitore, i suoi figli',
  tenta($$select abbinati('Da ROSSI GINO TRN 3 BONIFICO SEPA')$$), 'Elia Bruno (codice fiscale); Sofia Bruno (codice fiscale)');
select atteso('regola 3: se paga l''adulto per sé, il suo codice',
  tenta($$select abbinati('Da ROSSI GINO TRN 4 BONIFICO SEPA')$$), 'Marta Gallo (codice fiscale)');
select atteso('il nome vince sul codice: la regola dopo si prova solo se la prima non trova nessuno',
  tenta($$select abbinati('Da GALLO MARTA TRN 5 BONIFICO SEPA')$$), 'Marta Gallo (nome intero)');
select atteso('un codice di nessuno non propone nessuno', tenta($$select abbinati('Da ROSSI GINO TRN 6 BONIFICO SEPA')$$), 'nessuno');
select atteso('un movimento senza codice letto: solo regole 1 e 2', tenta($$select abbinati('Da ROSSI GINO TRN 7 BONIFICO SEPA')$$), 'nessuno');
select atteso('solo il cognome (o solo il nome) non basta', tenta($$select abbinati('Da PRUDENTE LUCIANO BONIFICO SEPA')$$), 'nessuno');
select atteso('prima chi non è iscritto il giorno del movimento, in fondo chi lo è (anche se oggi non lo è più)',
  tenta($$select abbinati('Da Ferri Anna, Ferri Bruno, Ferri Carlo, Ferri Dora BONIFICO SEPA')$$),
  'Bruno Ferri (nome intero); Carlo Ferri (nome intero); Anna Ferri (nome intero, già iscritto); Dora Ferri (nome intero, già iscritto)');
select atteso('un iscritto solo si propone lo stesso, col segno «già iscritto»', tenta($$select abbinati('Da Ferri Ennio BONIFICO SEPA')$$), 'Ennio Ferri (nome intero, già iscritto)');
-- Regola 4: l'app dice quali corsi costano l'importo del movimento (dal listino); il database guarda chi è iscritto
-- a quei corsi il giorno del movimento e ha nel testo il cognome suo o del genitore. Qui l'iscrizione è a favore.
select atteso('regola 4: il solo cognome + iscritto al corso dell''importo (anche chi finisce il 15/10), non «già iscritto»; non Bruno (finita) né Carlo (da novembre)',
  tenta($$select abbinati('Da FERRI TRN 20 BONIFICO SEPA', array['cccccccc-0000-0000-0000-000000000001']::uuid[])$$),
  'Anna Ferri (corso e cognome); Dora Ferri (corso e cognome); Ennio Ferri (corso e cognome)');
select atteso('…senza il corso dell''importo vale il solo cognome (regola 5): i Ferri iscritti quel giorno',
  tenta($$select abbinati('Da FERRI TRN 20 BONIFICO SEPA')$$), 'Anna Ferri (cognome); Dora Ferri (cognome); Ennio Ferri (cognome)');
select atteso('…e così con un corso che nessuno frequenta', tenta($$select abbinati('Da FERRI TRN 20 BONIFICO SEPA', array[gen_random_uuid()])$$),
  'Anna Ferri (cognome); Dora Ferri (cognome); Ennio Ferri (cognome)');
select atteso('regola 5: il cognome del genitore, di uno solo', tenta($$select abbinati('Da TOSI TRN 33 BONIFICO SEPA')$$), 'Pia Sala (cognome)');
select atteso('…di uno solo, iscritto quel giorno: col segno', tenta($$select abbinati('Da MORO TRN 34 BONIFICO SEPA')$$), 'Ada Moro (cognome, già iscritto)');
select atteso('…di più persone: solo chi è iscritto il giorno del movimento', tenta($$select abbinati('Da GRECO TRN 30 BONIFICO SEPA')$$), 'Rita Greco (cognome)');
select atteso('…se nessuno lo è, chi lo è stato o lo sarà', tenta($$select abbinati('Da RIVA TRN 31 BONIFICO SEPA')$$), 'Eva Riva (cognome); Ivo Riva (cognome)');
select atteso('…se nessuno ha iscrizioni, nessuno', tenta($$select abbinati('Da POZZI TRN 32 BONIFICO SEPA')$$), 'nessuno');
select atteso('regola 6: nome di battesimo + un corso a cui è iscritta (l''apostrofo non conta)', tenta($$select abbinati('Retta psicomotricita'' Giulia TRN 35')$$), 'Giulia Esposito (nome e corso)');
select atteso('…chi è iscritto quel giorno vince su chi lo era prima', tenta($$select abbinati('Retta aikido Nora TRN 36')$$), 'Nora Galli (nome e corso)');
select atteso('…se nessuno lo è quel giorno, vale un''iscrizione in qualunque momento', tenta($$select abbinati('Retta aikido Olga TRN 37')$$), 'Olga Ricci (nome e corso)');
select atteso('…le cifre del nome del corso non bastano', tenta($$select abbinati('Retta 2 Olga TRN 38')$$), 'nessuno');
select atteso('…il solo nome non basta', tenta($$select abbinati('Retta Giulia TRN 39')$$), 'nessuno');
select atteso('il cognome vince su nome e corso', tenta($$select abbinati('Retta aikido Nora Riva TRN 40')$$), 'Eva Riva (cognome); Ivo Riva (cognome)');
select atteso('nome e cognome interi vincono sull''importo',
  tenta($$select abbinati('Da Ferri Ennio BONIFICO SEPA', array['cccccccc-0000-0000-0000-000000000001']::uuid[])$$), 'Ennio Ferri (nome intero, già iscritto)');
select atteso('al massimo otto', tenta($$select count(*)::text from abbina_pagatori_movimento(id_mov('Da Rosa Pini BONIFICO SEPA'))$$), '8');
select atteso('escono solo id, nome, cognome, come e già iscritto: mai codici, genitori, date o corsi',
  (select string_agg(p.parameter_name, ',' order by p.ordinal_position) from information_schema.routines r join information_schema.parameters p on p.specific_name = r.specific_name
    where r.routine_name = 'abbina_pagatori_movimento' and p.parameter_mode = 'OUT'), 'persona_id,nome,cognome,come,gia_iscritto');
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
