-- Il modulo di iscrizione: cosa può fare chi non ha un accesso, e cosa
-- succede quando la segreteria accoglie una richiesta.
-- Si lancia dopo finto-supabase.sql e i sei file dello schema.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@ods.it'),
  ('22222222-2222-2222-2222-222222222222', 'maura@ods.it');
insert into persone (id, nome, cognome, ruolo, email, utente_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', 'Segreteria', 'staff', 'anna@ods.it', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Maura', 'Uno', 'istruttore', 'maura@ods.it', '22222222-2222-2222-2222-222222222222'),
  -- Già in elenco dall'anno scorso, senza email, e iscritta a un corso che ha lasciato.
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Sara', 'Bianchi', 'iscritto', null, null);
-- Due luoghi, come li mette `17-luoghi.sql`: Torino, e Abano che ha cambiato nome.
insert into luoghi_nascita (codice, nome, sigla, al) values
  ('L219', 'TORINO', 'TO', null), ('A001', 'ABANO', 'PD', '1924-11-13'), ('A001', 'ABANO TERME', 'PD', null);
insert into corsi (id, nome) values
  ('cccccccc-0000-0000-0000-000000000001', 'Judo 2'),
  ('cccccccc-0000-0000-0000-000000000002', 'Lotta 2');
insert into corsi (id, nome, attivo) values ('cccccccc-0000-0000-0000-000000000003', 'Corso chiuso', false);
insert into iscrizioni (corso_id, persona_id, dal, al) values
  ('cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000003', current_date - 400, current_date - 100);

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
-- Un codice fiscale giusto per chi nasce in un giorno che si sposta con la
-- prova (trent'anni fa, nove anni fa): le sei lettere, la data, Torino e il
-- carattere di controllo. Per una donna il giorno ha quaranta in più.
create or replace function cf_prova(lettere text, nato date, donna boolean default false)
  returns text language sql stable security definer set search_path = public as $$
  select x || cf_controllo(x) from (
    select lettere || to_char(nato, 'YY') || substr('ABCDEHLMPRST', extract(month from nato)::int, 1)
           || lpad((extract(day from nato)::int + case when donna then 40 else 0 end)::text, 2, '0') || 'L219' as x) q
$$;
-- Una richiesta valida di un adulto, da cambiare un campo alla volta.
create or replace function adulto(cambi jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object(
    'nome', 'Luca', 'cognome', 'Rossi', 'nato_il', (current_date - interval '30 years')::date,
    'nato_a', 'Torino', 'codice_fiscale', (select lower(substr(c, 1, 11)) || ' ' || substr(c, 12) from cf_prova('RSSLCU', (current_date - interval '30 years')::date) c), 'indirizzo', 'Via Roma 1',
    'cap', '10093', 'comune', 'Collegno', 'email', 'Luca@Esempio.it', 'telefono', '347 111 2233',
    'corsi', jsonb_build_array('cccccccc-0000-0000-0000-000000000001'), 'formula', 'annuale', 'regolamento', true
  ) || cambi
$$;
grant execute on function tenta(text), atteso(text, text, text), adulto(jsonb), chi(text), cf_prova(text, date, boolean) to anon, authenticated;

\echo ''
\echo '--- 1. chi non ha un accesso: il minimo, e niente di più ---'
select chi('');
set role anon;
select atteso('vede i corsi aperti, non quelli chiusi', (select string_agg(nome, ', ' order by nome) from corsi_aperti()), 'Judo 2, Lotta 2');
select atteso('non legge le persone', tenta($$select count(*)::text from persone$$), 'NEGATO: …');
select atteso('non legge i corsi', tenta($$select count(*)::text from corsi$$), 'NEGATO: …');
select atteso('non legge le richieste', tenta($$select count(*)::text from richieste_iscrizione$$), 'NEGATO: …');
select atteso('non scrive una richiesta a mano', tenta($$insert into richieste_iscrizione (nome) values ('x')$$), 'NEGATO: …');
select atteso('non rigenera il calendario', tenta($$select materializza_sessioni(current_date, current_date + 7)::text$$), 'NEGATO: …');
select atteso('non pulisce le presenze', tenta($$select pulisci_presenze()::text$$), 'NEGATO: …');
select atteso('non accoglie richieste', tenta($$select accogli_iscrizione(gen_random_uuid())::text$$), 'NEGATO: …');

\echo ''
\echo '--- 2. la richiesta: cosa passa e cosa no ---'
select atteso('una richiesta giusta passa', tenta($$select (invia_iscrizione(adulto()) is not null)::text$$), 'true');
select atteso('manca il cognome', tenta($$select invia_iscrizione(adulto('{"cognome": " "}'))::text$$), 'NEGATO: Mancano: cognome');
select atteso('CAP corto', tenta($$select invia_iscrizione(adulto('{"cap": "1009"}'))::text$$), 'NEGATO: Un campo non va: il CAP ha 5 cifre');
select atteso('codice fiscale corto', tenta($$select invia_iscrizione(adulto('{"codice_fiscale": "RSSLCU"}'))::text$$), 'NEGATO: Un campo non va: il codice fiscale…');
select atteso('data a caso', tenta($$select invia_iscrizione(adulto('{"nato_il": "ieri"}'))::text$$), 'NEGATO: La data di nascita non si capisce');
select atteso('nato domani', tenta($$select invia_iscrizione(adulto(jsonb_build_object('nato_il', current_date + 1)))::text$$), 'NEGATO: La data di nascita non torna');
select atteso('nessun corso', tenta($$select invia_iscrizione(adulto('{"corsi": []}'))::text$$), 'NEGATO: Scegli almeno un corso');
select atteso('un corso chiuso', tenta($$select invia_iscrizione(adulto('{"corsi": ["cccccccc-0000-0000-0000-000000000003"]}'))::text$$), 'NEGATO: Uno dei corsi scelti non c''è più…');
select atteso('una formula inventata', tenta($$select invia_iscrizione(adulto('{"formula": "gratis"}'))::text$$), 'NEGATO: Un campo non va: si paga…');
select atteso('un minore senza genitore', tenta($$select invia_iscrizione(adulto(jsonb_build_object('nato_il', current_date - interval '9 years', 'email', 'mamma@esempio.it')))::text$$), 'NEGATO: Per un minore servono…');
select atteso('un minore col genitore passa', tenta($$select (invia_iscrizione(adulto(jsonb_build_object(
  'nome', 'Giulia', 'codice_fiscale', cf_prova('RSSGLI', (current_date - interval '9 years')::date, true), 'nato_il', current_date - interval '9 years', 'email', 'mamma@esempio.it',
  'genitore_nome', 'Paola', 'genitore_cognome', 'Rossi', 'genitore_codice_fiscale', 'RSSPLA80A41L219P',
  'corsi', jsonb_build_array('cccccccc-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000002')))) is not null)::text$$), 'true');
select atteso('il fratello, stessa email', tenta($$select (invia_iscrizione(adulto(jsonb_build_object(
  'nome', 'Marco', 'codice_fiscale', cf_prova('RSSMRC', (current_date - interval '11 years')::date), 'nato_il', current_date - interval '11 years', 'email', 'MAMMA@esempio.it',
  'genitore_nome', 'Paola', 'genitore_cognome', 'Rossi', 'genitore_codice_fiscale', 'RSSPLA80A41L219P'))) is not null)::text$$), 'true');
select atteso('la terza dalla stessa email passa', tenta($$select (invia_iscrizione(adulto(jsonb_build_object('email', 'mamma@esempio.it', 'nome', 'Terzo', 'codice_fiscale', cf_prova('RSSTRZ', (current_date - interval '30 years')::date)))) is not null)::text$$), 'true');
select atteso('manca il codice fiscale', tenta($$select invia_iscrizione(adulto('{"codice_fiscale": ""}'))::text$$), 'NEGATO: Mancano: codice fiscale');
select atteso('manca la data di nascita', tenta($$select invia_iscrizione(adulto('{"nato_il": ""}'))::text$$), 'NEGATO: Mancano: data di nascita');
select atteso('l''ultima lettera sbagliata', tenta($$select invia_iscrizione(adulto(jsonb_build_object('codice_fiscale',
  (select substr(c, 1, 15) || case when right(c, 1) = 'A' then 'B' else 'A' end from cf_prova('RSSLCU', (current_date - interval '30 years')::date) c))))::text$$),
  'NEGATO: Il codice fiscale non torna: controlla di averlo copiato giusto');
select atteso('un altro giorno di nascita', tenta($$select invia_iscrizione(adulto(jsonb_build_object('nato_il', (current_date - interval '30 years' - interval '1 day')::date)))::text$$),
  'NEGATO: Il codice fiscale e la data di nascita non dicono lo stesso giorno…');
select atteso('un numero nel nome', tenta($$select invia_iscrizione(adulto('{"nome": "Luca2"}'))::text$$), 'NEGATO: Un campo non va: nome e cognome non hanno numeri');
select atteso('il codice di un altro nome', tenta($$select invia_iscrizione(adulto('{"nome": "Marco"}'))::text$$), 'NEGATO: Il codice fiscale non torna con nome e cognome…');
select atteso('lettere nel telefono', tenta($$select invia_iscrizione(adulto('{"telefono": "347 abc 2233"}'))::text$$), 'NEGATO: Un campo non va: il telefono non sembra giusto');
select atteso('lettere nel secondo telefono', tenta($$select invia_iscrizione(adulto('{"telefono_2": "011 abc"}'))::text$$), 'NEGATO: Un campo non va: il secondo telefono non sembra giusto');
select atteso('senza il regolamento no', tenta($$select invia_iscrizione(adulto('{"regolamento": false}'))::text$$), 'NEGATO: Serve accettare il Regolamento Sociale');
select atteso('sette corsi no', tenta($$select invia_iscrizione(adulto(jsonb_build_object('corsi', (select jsonb_agg(gen_random_uuid()) from generate_series(1, 7)))))::text$$),
  'NEGATO: Un campo non va: si possono scegliere al massimo sei corsi');
select atteso('il genitore sbagliato di una lettera', tenta($$select invia_iscrizione(adulto(jsonb_build_object(
  'nome', 'Anna', 'codice_fiscale', cf_prova('RSSNNA', (current_date - interval '9 years')::date, true), 'nato_il', current_date - interval '9 years',
  'genitore_nome', 'Paola', 'genitore_cognome', 'Rossi', 'genitore_codice_fiscale', 'RSSPLA80A41L219X')))::text$$),
  'NEGATO: Il codice fiscale del genitore non torna: controlla di averlo copiato giusto');
select atteso('il genitore col codice del figlio', tenta($$select invia_iscrizione(adulto(jsonb_build_object(
  'nome', 'Anna', 'codice_fiscale', cf_prova('RSSNNA', (current_date - interval '9 years')::date, true), 'nato_il', current_date - interval '9 years',
  'genitore_nome', 'Paola', 'genitore_cognome', 'Rossi', 'genitore_codice_fiscale', cf_prova('RSSNNA', (current_date - interval '9 years')::date, true))))::text$$),
  'NEGATO: Il codice fiscale del genitore è lo stesso di chi si iscrive');
select atteso('il genitore minorenne', tenta($$select invia_iscrizione(adulto(jsonb_build_object(
  'nome', 'Anna', 'codice_fiscale', cf_prova('RSSNNA', (current_date - interval '9 years')::date, true), 'nato_il', current_date - interval '9 years',
  'genitore_nome', 'Marco', 'genitore_cognome', 'Rossi', 'genitore_codice_fiscale', cf_prova('RSSMRC', (current_date - interval '11 years')::date))))::text$$),
  'NEGATO: Il codice fiscale del genitore è di un minorenne');
select atteso('il genitore di un altro nome', tenta($$select invia_iscrizione(adulto(jsonb_build_object(
  'nome', 'Anna', 'codice_fiscale', cf_prova('RSSNNA', (current_date - interval '9 years')::date, true), 'nato_il', current_date - interval '9 years',
  'genitore_nome', 'Marta', 'genitore_cognome', 'Rossi', 'genitore_codice_fiscale', 'RSSPLA80A41L219P')))::text$$),
  'NEGATO: Il codice fiscale del genitore non torna con il suo nome e cognome…');
-- Una famiglia di sei manda tutte le richieste (`48-richieste-per-email.sql`: da tre a sei al giorno).
select atteso('la quarta dalla stessa email passa', tenta($$select (invia_iscrizione(adulto(jsonb_build_object('email', 'mamma@esempio.it', 'nome', 'Quarto', 'codice_fiscale', cf_prova('RSSQRT', (current_date - interval '30 years')::date)))) is not null)::text$$), 'true');
select atteso('la quinta dalla stessa email passa', tenta($$select (invia_iscrizione(adulto(jsonb_build_object('email', 'mamma@esempio.it', 'nome', 'Quinto', 'codice_fiscale', cf_prova('RSSQNT', (current_date - interval '30 years')::date)))) is not null)::text$$), 'true');
select atteso('la sesta dalla stessa email passa', tenta($$select (invia_iscrizione(adulto(jsonb_build_object('email', 'mamma@esempio.it', 'nome', 'Sesto', 'codice_fiscale', cf_prova('RSSSST', (current_date - interval '30 years')::date)))) is not null)::text$$), 'true');
select atteso('la settima nello stesso giorno no', tenta($$select invia_iscrizione(adulto(jsonb_build_object('email', 'mamma@esempio.it', 'nome', 'Ultimo', 'codice_fiscale', cf_prova('RSSLTM', (current_date - interval '30 years')::date))))::text$$), 'NEGATO: Da questa email sono già arrivate 6 richieste oggi…');
select atteso('un''altra email non è toccata dal limite di mamma@', tenta($$select (invia_iscrizione(adulto(jsonb_build_object('email', 'zii@esempio.it', 'nome', 'Ultimo', 'codice_fiscale', cf_prova('RSSLTM', (current_date - interval '30 years')::date)))) is not null)::text$$), 'true');
-- Le note: 1000 caratteri al massimo (`check (length(note) <= 1000)`), e lo dice in chiaro come gli altri campi.
select atteso('note di 1001 caratteri no', tenta($$select invia_iscrizione(adulto(jsonb_build_object('email', 'note@esempio.it', 'nome', 'Nota', 'codice_fiscale', cf_prova('RSSNTO', (current_date - interval '30 years')::date), 'note', repeat('x', 1001))))::text$$), 'NEGATO: Un campo non va: un testo è troppo lungo');
select atteso('note di 1000 caratteri passano', tenta($$select (invia_iscrizione(adulto(jsonb_build_object('email', 'note@esempio.it', 'nome', 'Notb', 'codice_fiscale', cf_prova('RSSNTB', (current_date - interval '30 years')::date), 'note', repeat('x', 1000)))) is not null)::text$$), 'true');
reset role;
select atteso('il limite per email è sei al giorno', (select iscrizioni_regole()->>'per_email_al_giorno'), '6');
select atteso('il limite all''ora per tutti resta sessanta', (select iscrizioni_regole()->>'in_tutto_all_ora'), '60');
-- Le richieste del limite e delle note si tolgono: le prove di sotto contano quelle di Luca, Giulia, Marco e Terzo.
delete from richieste_iscrizione where nome in ('Quarto', 'Quinto', 'Sesto', 'Ultimo', 'Notb');
-- Venti richieste mandate insieme vedevano tutte lo stesso conteggio e ne
-- passavano tredici invece di tre: in psql il parallelo non si fa, quindi si
-- guarda che la funzione prenda il suo turno prima di contare. E solo dopo i
-- controlli sui dati: se no una richiesta enorme e sbagliata tiene il turno
-- mentre la si legge, e il modulo si ferma per tutti.
select atteso('le richieste si contano una alla volta, quelle già valide',
  (select (strpos(prosrc, 'pg_advisory_xact_lock(hashtext(''invia_iscrizione''))')
           between strpos(prosrc, 'Serve accettare il Regolamento') + 1 and strpos(prosrc, 'per_email_al_giorno'))::text
     from pg_proc where proname = 'invia_iscrizione'), 'true');
select atteso('email e codice fiscale messi in ordine',
  (select email || ' ' || (codice_fiscale = cf_prova('RSSLCU', (current_date - interval '30 years')::date)) from richieste_iscrizione where nome = 'Luca'), 'luca@esempio.it true');
select atteso('il luogo di nascita è quello del codice, non quello scritto',
  (select nato_a from richieste_iscrizione where nome = 'Luca'), 'TORINO (TO)');
select atteso('col nome che aveva quando si è nati', luogo_da_cf('RSSLCU20A01A001' || cf_controllo('RSSLCU20A01A001'), '1920-01-01'), 'ABANO (PD)');
select atteso('e dopo, col nome nuovo', luogo_da_cf('RSSLCU30A01A001' || cf_controllo('RSSLCU30A01A001'), '1930-01-01'), 'ABANO TERME (PD)');
select atteso('l''omocodia anche nel luogo', luogo_da_cf('RSSLCU96A01L2MV' || cf_controllo('RSSLCU96A01L2MV'), '1996-01-01'), 'TORINO (TO)');
select atteso('un luogo che non c''è: vale quel che si è scritto', coalesce(luogo_da_cf('RSSLCU96A01Z999' || cf_controllo('RSSLCU96A01Z999'), '1996-01-01'), 'nessuno'), 'nessuno');
select atteso('il genitore di un adulto non si tiene',
  (select coalesce(genitore_nome, '—') from richieste_iscrizione where nome = 'Luca'), '—');
select atteso('l''omocodia: cifre scritte come lettere', (cf_nato_il('RSSMRA85T10A56NH') = '1985-12-10')::text, 'true');
select atteso('una donna: il giorno più quaranta', cf_nato_il('RSSPLA80A41L219P')::text, '1980-01-01');
select atteso('cognome e nome in sei lettere, senza accenti né apostrofi', cf_lettere('Luca', 'D''Àgostino'), 'DGSLCU');
select atteso('un nome con quattro consonanti: la prima, la terza e la quarta', cf_lettere('Demetrio', 'Rossi'), 'RSSDTR');
select atteso('corti: si finisce con la X', cf_lettere('Al', 'Fo'), 'FOXLAX');
select atteso('il 30 febbraio non esiste', coalesce(cf_nato_il('RSSLCU01B30L219' || cf_controllo('RSSLCU01B30L219'))::text, 'nessuna'), 'nessuna');

\echo ''
\echo '--- 3. i file ---'
insert into storage.buckets (id, name) values ('altro', 'altro') on conflict do nothing;
create temp table la_richiesta as select id from richieste_iscrizione where nome = 'Luca';
grant select on la_richiesta to anon, authenticated;
set role anon;
select atteso('il modulo firmato entra',
  tenta(format($$insert into storage.objects (bucket_id, name) values ('iscrizioni', '%s/modulo.jpg')$$, (select id from la_richiesta))), 'FATTO (1 righe)');
select atteso('un nome inventato no',
  tenta(format($$insert into storage.objects (bucket_id, name) values ('iscrizioni', '%s/virus.exe')$$, (select id from la_richiesta))), 'NEGATO: …');
select atteso('una cartella che non è una richiesta no',
  tenta(format($$insert into storage.objects (bucket_id, name) values ('iscrizioni', '%s/modulo.jpg')$$, gen_random_uuid())), 'NEGATO: …');
select atteso('un altro contenitore no',
  tenta(format($$insert into storage.objects (bucket_id, name) values ('altro', '%s/modulo.jpg')$$, (select id from la_richiesta))), 'NEGATO: …');
select atteso('documento, retro, certificato e ricevuta entrano',
  tenta(format($$insert into storage.objects (bucket_id, name) values ('iscrizioni', '%1$s/documento.pdf'), ('iscrizioni', '%1$s/documento-retro.png'), ('iscrizioni', '%1$s/certificato.pdf'), ('iscrizioni', '%1$s/ricevuta.jpg')$$, (select id from la_richiesta))), 'FATTO (4 righe)');
select atteso('il sesto file no',
  tenta(format($$insert into storage.objects (bucket_id, name) values ('iscrizioni', '%s/ricevuta.pdf')$$, (select id from la_richiesta))), 'NEGATO: …');
select atteso('i file non si rileggono', (select count(*)::text from storage.objects), '0');
select atteso('né si cancellano', tenta($$delete from storage.objects$$), 'a vuoto (0 righe)');
reset role;
-- I file caricati insieme vedevano tutti lo stesso conteggio: 35 nello stesso
-- istante ne lasciavano passare più di trenta. Una insert sola di sei file fa
-- lo stesso, e in psql si prova.
create temp table sei_file as select invia_iscrizione(adulto(jsonb_build_object(
  'nome', 'Sei', 'codice_fiscale', cf_prova('RSSSEI', (current_date - interval '30 years')::date), 'email', 'sei@esempio.it'))) as id;
grant select on sei_file to anon;
set role anon;
select atteso('sei file insieme non passano il limite di cinque',
  tenta(format($$insert into storage.objects (bucket_id, name) select 'iscrizioni', '%s/' || n from unnest(array['modulo.jpg', 'documento.pdf', 'documento-retro.png', 'certificato.pdf', 'ricevuta.jpg', 'ricevuta.pdf']) n$$, (select id from sei_file))),
  'NEGATO: …');
reset role;
-- L'app carica dall'API di Storage: la policy la prova con una insert
-- annullata, e la riga vera la scrive lei da superutente, senza RLS. Il
-- limite deve tenere anche lì, e tenere in fila i caricamenti paralleli (che
-- in psql non si fanno: si guarda che il turno venga prima del conteggio).
select atteso('il sesto file non entra nemmeno dalla porta di Storage',
  tenta(format($$insert into storage.objects (bucket_id, name) values ('iscrizioni', '%s/ricevuta.pdf')$$, (select id from la_richiesta))),
  'NEGATO: Questa richiesta ha già tutti i suoi file…');
insert into storage.buckets (id, name) values ('spostato', 'spostato') on conflict do nothing;
insert into storage.objects (bucket_id, name) values ('spostato', 'x/ricevuta.pdf');
select atteso('né spostandocene uno da un altro contenitore',
  tenta(format($$update storage.objects set bucket_id = 'iscrizioni', name = '%s/ricevuta.pdf' where bucket_id = 'spostato'$$, (select id from la_richiesta))),
  'NEGATO: Questa richiesta ha già tutti i suoi file…');
delete from storage.objects where bucket_id = 'spostato';
select atteso('i file di una cartella si contano uno alla volta',
  (select (strpos(prosrc, 'pg_advisory_xact_lock') between 1 and strpos(prosrc, 'file_per_richiesta'))::text
     from pg_proc where proname = 'limita_file_iscrizione'), 'true');
-- Le prove qui sotto contano le richieste: questa non c'era.
delete from richieste_iscrizione where id = (select id from sei_file);
update richieste_iscrizione set creata_il = now() - interval '2 hours' where nome = 'Giulia';
create temp table vecchia as select id from richieste_iscrizione where nome = 'Giulia';
grant select on vecchia to anon;
set role anon;
select atteso('dopo un''ora la cartella si chiude',
  tenta(format($$insert into storage.objects (bucket_id, name) values ('iscrizioni', '%s/modulo.jpg')$$, (select id from vecchia))), 'NEGATO: …');
reset role;
-- Giulia aveva caricato il certificato.
insert into storage.objects (bucket_id, name) select 'iscrizioni', id || '/certificato.jpg' from vecchia;

\echo ''
\echo '--- 4. un istruttore: le richieste non sono affar suo ---'
select chi('22222222-2222-2222-2222-222222222222');
set role authenticated;
select atteso('non le vede', (select count(*)::text from richieste_iscrizione), '0');
select atteso('non vede i file', (select count(*)::text from storage.objects), '0');
select atteso('non le accoglie', tenta(format($$select accogli_iscrizione('%s')::text$$, (select id from la_richiesta))), 'NEGATO: solo la segreteria');
select atteso('non cerca i documenti', tenta($$select cardinality(richieste_con_documento())::text$$), 'NEGATO: solo la segreteria');
select atteso('le sue funzioni le chiama ancora', tenta($$select count(*)::text from frequenze(30)$$), '0');
reset role;

\echo ''
\echo '--- 5. la segreteria ---'
select chi('11111111-1111-1111-1111-111111111111');
set role authenticated;
select atteso('le vede tutte', (select count(*)::text from richieste_iscrizione), '4');
select atteso('vede i file', (select count(*)::text from storage.objects where bucket_id = 'iscrizioni'), '6');
select atteso('da stampare c''è solo il documento: Luca sì, Giulia che ha mandato solo il certificato no', (select string_agg(r.nome, ', ' order by r.nome) from unnest(richieste_con_documento()) d join richieste_iscrizione r on r.id = d), 'Luca');
select atteso('stampati, cancella i documenti e basta', tenta($$delete from storage.objects where bucket_id = 'iscrizioni' and name ~ '/(documento|documento-retro)\.'$$), 'FATTO (2 righe)');
select atteso('e non c''è più niente da stampare, coi certificati ancora lì', (select cardinality(richieste_con_documento())::text), '0');
select atteso('modulo, ricevuta e i due certificati restano', (select count(*)::text from storage.objects where bucket_id = 'iscrizioni'), '4');
select atteso('Luca non ha ancora una scheda', (select count(*)::text from schede_iscritti), '0');
select atteso('rigenera ancora il calendario', tenta($$select materializza_sessioni(current_date, current_date + 7)::text$$), '0');
select atteso('Luca accolto: una persona nuova', tenta(format($$select (accogli_iscrizione('%s') is not null)::text$$, (select id from la_richiesta))), 'true');
select atteso('con la sua email e il telefono', (select email || ' · ' || telefono from persone where nome = 'Luca'), 'luca@esempio.it · 347 111 2233');
select atteso('il certificato passa alla sua scheda, senza data: la scrive la segreteria',
  (select (certificato_file ~ ('^' || persona_id || '/certificato-[0-9]+\.pdf$'))::text || ' ' || coalesce(certificato_scade::text, 'senza data') || ' ' || (certificato_caricato_il::date = current_date)
     from schede_iscritti s where persona_id = (select id from persone where nome = 'Luca')), 'true senza data true');
select atteso('il file è nel contenitore dei certificati, nella cartella della scheda',
  (select count(*)::text from storage.objects o join schede_iscritti s on o.name = s.certificato_file where o.bucket_id = 'certificati' and s.persona_id = (select id from persone where nome = 'Luca')), '1');
select atteso('e non è più fra i file della richiesta',
  (select count(*)::text from storage.objects where bucket_id = 'iscrizioni' and name = (select id from la_richiesta) || '/certificato.pdf'), '0');
select atteso('e la scheda non ne tiene una copia', (select count(*)::text from storage.objects where bucket_id = 'certificati'), '1');
select atteso('iscritto al Judo da oggi',
  (select string_agg(c.nome || ' dal ' || (i.dal = current_date), ', ') from iscrizioni i join corsi c on c.id = i.corso_id join persone p on p.id = i.persona_id where p.nome = 'Luca'), 'Judo 2 dal true');
select atteso('la richiesta dice chi e quando',
  (select stato || ' da ' || (select nome from persone where id = gestita_da) || ' · legata: ' || (persona_id is not null) from richieste_iscrizione where nome = 'Luca'), 'accolta da Anna · legata: true');
select atteso('una seconda volta no', tenta(format($$select accogli_iscrizione('%s')::text$$, (select id from la_richiesta))), 'NEGATO: Questa richiesta è già stata accolta');
select atteso('Giulia accolta, due corsi', tenta($$select (accogli_iscrizione((select id from richieste_iscrizione where nome = 'Giulia')) is not null)::text$$), 'true');
select atteso('anche il suo certificato passa alla scheda, come jpg',
  (select (certificato_file ~ ('^' || persona_id || '/certificato-[0-9]+\.jpg$'))::text from schede_iscritti where persona_id = (select id from persone where nome = 'Giulia')), 'true');
select atteso('dalle richieste i certificati sono usciti', (select count(*)::text from storage.objects where bucket_id = 'iscrizioni' and name ~ '/certificato\.'), '0');
select atteso('e non c''è niente da stampare', (select cardinality(richieste_con_documento())::text), '0');
select atteso('Marco, stessa email: entra senza', tenta($$select (accogli_iscrizione((select id from richieste_iscrizione where nome = 'Marco')) is not null)::text$$), 'true');
select atteso('i due fratelli', (select string_agg(nome || ':' || coalesce(email::text, 'senza email'), ', ' order by nome) from persone where nome in ('Giulia', 'Marco')), 'Giulia:mamma@esempio.it, Marco:senza email');
select atteso('Marco senza email di accesso ha quella della mamma come contatto',
  (select string_agg(nome || ':' || coalesce(email_contatto::text, '—'), ', ' order by nome) from persone where nome in ('Giulia', 'Marco')), 'Giulia:—, Marco:mamma@esempio.it');
select atteso('Giulia ha i suoi due corsi', (select count(*)::text from iscrizioni i join persone p on p.id = i.persona_id where p.nome = 'Giulia'), '2');
select atteso('il terzo si rifiuta', tenta($$select rifiuta_iscrizione((select id from richieste_iscrizione where nome = 'Terzo'))::text$$), '');
select atteso('rifiutata', (select stato::text from richieste_iscrizione where nome = 'Terzo'), 'rifiutata');
select atteso('e non si accoglie più', tenta($$select accogli_iscrizione((select id from richieste_iscrizione where nome = 'Terzo'))::text$$), 'NEGATO: Questa richiesta è già stata rifiutata');
reset role;

-- Sara torna dopo un anno: la richiesta la ritrova, non la raddoppia, e la
-- rimette in Lotta da oggi.
set role anon;
select atteso('Sara manda la sua', tenta($$select (invia_iscrizione(adulto('{"nome": "sara", "cognome": "BIANCHI", "email": "sara@esempio.it", "corsi": ["cccccccc-0000-0000-0000-000000000002"]}'
  || jsonb_build_object('codice_fiscale', cf_prova('BNCSRA', (current_date - interval '30 years')::date, true)))) is not null)::text$$), 'true');
reset role;
-- Ha allegato un certificato che non è il suo: la segreteria lo toglie prima di accogliere.
insert into storage.objects (bucket_id, name) select 'iscrizioni', id || '/certificato.pdf' from richieste_iscrizione where email = 'sara@esempio.it';
set role authenticated;
select atteso('il file sbagliato lo toglie prima', tenta($$delete from storage.objects where bucket_id = 'iscrizioni' and name ~ '/certificato\.' and name like (select id::text from richieste_iscrizione where email = 'sara@esempio.it') || '/%'$$), 'FATTO (1 righe)');
select atteso('accolta sulla scheda che c''era', tenta($$select (accogli_iscrizione((select id from richieste_iscrizione where email = 'sara@esempio.it')) = 'aaaaaaaa-0000-0000-0000-000000000003')::text$$), 'true');
select atteso('una Sara sola', (select count(*)::text from persone where cognome = 'Bianchi'), '1');
select atteso('e senza il file sbagliato la sua scheda non ha certificato',
  (select count(*)::text from schede_iscritti where persona_id = 'aaaaaaaa-0000-0000-0000-000000000003' and certificato_file is not null), '0');
select atteso('che ora ha l''email', (select email::text from persone where cognome = 'Bianchi'), 'sara@esempio.it');
select atteso('ed è di nuovo in Lotta, da oggi', (select (dal = current_date and al is null)::text from iscrizioni where persona_id = 'aaaaaaaa-0000-0000-0000-000000000003'), 'true');
-- Giulia smette di Lotta a fine mese e poi ci ripensa, e stavolta la manda il
-- papà con la sua email: il codice fiscale la ritrova, e la fine sparisce.
update iscrizioni set al = current_date + 5
  where persona_id = (select id from persone where nome = 'Giulia') and corso_id = 'cccccccc-0000-0000-0000-000000000002';
reset role;
set role anon;
select atteso('Giulia la rimanda', tenta($$select (invia_iscrizione(adulto(jsonb_build_object(
  'nome', 'Giulia', 'codice_fiscale', lower(cf_prova('RSSGLI', (current_date - interval '9 years')::date, true)), 'nato_il', current_date - interval '9 years', 'email', 'papa@esempio.it',
  'genitore_nome', 'Piero', 'genitore_cognome', 'Rossi', 'genitore_codice_fiscale', 'RSSPRI80A01L219X',
  'corsi', jsonb_build_array('cccccccc-0000-0000-0000-000000000002')))) is not null)::text$$), 'true');
reset role;
set role authenticated;
select atteso('accolta', tenta($$select (accogli_iscrizione((select id from richieste_iscrizione where email = 'papa@esempio.it')) is not null)::text$$), 'true');
select atteso('una Giulia sola', (select count(*)::text from persone where nome = 'Giulia'), '1');
select atteso('in Lotta dal giorno di prima, senza più una fine',
  (select (dal = current_date)::text || ' ' || coalesce(al::text, 'senza fine') from iscrizioni
   where persona_id = (select id from persone where nome = 'Giulia') and corso_id = 'cccccccc-0000-0000-0000-000000000002'), 'true senza fine');
select atteso('la cancella la segreteria', tenta($$delete from richieste_iscrizione where nome = 'Terzo'$$), 'FATTO (1 righe)');
reset role;

-- Mario era già in elenco con la sua email; stavolta la richiesta la manda la
-- mamma con la sua, e niente li lega: la scheda la sceglie la segreteria.
-- Paolo invece ha lo stesso telefono, e lo si ritrova da sé. Un altro Paolo
-- Neri, con email e telefono suoi, è un'altra persona.
insert into persone (id, nome, cognome, ruolo, email, telefono) values
  ('aaaaaaaa-0000-0000-0000-000000000004', 'Mario', 'Verdi', 'iscritto', 'mario@esempio.it', null),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'Paolo', 'Neri', 'iscritto', 'paolo@esempio.it', '+39 333 123 4567');
-- Mario aveva già un certificato nell'app, valido fino a un anno da oggi.
insert into storage.objects (bucket_id, name) values ('certificati', 'aaaaaaaa-0000-0000-0000-000000000004/certificato-1.png');
insert into schede_iscritti (persona_id, certificato_scade, certificato_file) values
  ('aaaaaaaa-0000-0000-0000-000000000004', current_date + 365, 'aaaaaaaa-0000-0000-0000-000000000004/certificato-1.png');
set role anon;
select atteso('la mamma di Mario la manda', tenta($$select (invia_iscrizione(adulto(jsonb_build_object(
  'nome', 'Mario', 'cognome', 'Verdi', 'codice_fiscale', cf_prova('VRDMRA', (current_date - interval '30 years')::date), 'email', 'elisa@esempio.it', 'telefono', '347 999 0000'))) is not null)::text$$), 'true');
select atteso('Paolo la manda con un''altra email', tenta($$select (invia_iscrizione(adulto(jsonb_build_object(
  'nome', 'Paolo', 'cognome', 'Neri', 'codice_fiscale', cf_prova('NREPLA', (current_date - interval '30 years')::date), 'email', 'casa.neri@esempio.it', 'telefono', '3331234567'))) is not null)::text$$), 'true');
select atteso('e l''altro Paolo Neri la sua', tenta($$select (invia_iscrizione(adulto(jsonb_build_object(
  'nome', 'Paolo', 'cognome', 'Neri', 'codice_fiscale', cf_prova('NREPLA', (current_date - interval '40 years')::date), 'nato_il', current_date - interval '40 years', 'email', 'altro.paolo@esempio.it', 'telefono', '320 000 0000'))) is not null)::text$$), 'true');
reset role;
-- Con la richiesta della mamma è arrivato un certificato nuovo, un PDF.
insert into storage.objects (bucket_id, name) select 'iscrizioni', id || '/certificato.pdf' from richieste_iscrizione where email = 'elisa@esempio.it';
set role authenticated;
select atteso('Mario sulla scheda scelta', tenta($$select (accogli_iscrizione((select id from richieste_iscrizione where email = 'elisa@esempio.it'), 'aaaaaaaa-0000-0000-0000-000000000004') = 'aaaaaaaa-0000-0000-0000-000000000004')::text$$), 'true');
select atteso('un Mario solo, con la sua email e ora il telefono', (select count(*) || ' ' || max(email::text) || ' ' || max(telefono) from persone where cognome = 'Verdi'), '1 mario@esempio.it 347 999 0000');
select atteso('iscritto al Judo', (select count(*)::text from iscrizioni where persona_id = 'aaaaaaaa-0000-0000-0000-000000000004'), '1');
-- Il suo certificato è ancora valido: il file arrivato col modulo non lo sostituisce (potrebbe essere di
-- chiunque, anche sbagliato) e resta fra i file della richiesta, per la segreteria.
select atteso('il certificato valido resta quello che era: il suo png',
  (select certificato_file from schede_iscritti where persona_id = 'aaaaaaaa-0000-0000-0000-000000000004'), 'aaaaaaaa-0000-0000-0000-000000000004/certificato-1.png');
select atteso('nella sua cartella c''è ancora solo il vecchio',
  (select string_agg(name, ', ') from storage.objects where bucket_id = 'certificati' and name like 'aaaaaaaa-0000-0000-0000-000000000004/%'), 'aaaaaaaa-0000-0000-0000-000000000004/certificato-1.png');
select atteso('il file della richiesta resta dov''era, per la segreteria',
  (select count(*)::text from storage.objects where bucket_id = 'iscrizioni' and name = (select id from richieste_iscrizione where email = 'elisa@esempio.it') || '/certificato.pdf'), '1');
select atteso('la scheda è una sola e la data è quella scritta dalla segreteria',
  (select count(*) || ' ' || (min(certificato_scade) = current_date + 365) from schede_iscritti where persona_id = 'aaaaaaaa-0000-0000-0000-000000000004'), '1 true');
-- Paolo aveva un certificato scaduto: quello arrivato col modulo lo sostituisce, e la data resta.
reset role;
insert into storage.objects (bucket_id, name) values ('certificati', 'aaaaaaaa-0000-0000-0000-000000000005/certificato-1.pdf');
insert into schede_iscritti (persona_id, certificato_scade, certificato_file) values
  ('aaaaaaaa-0000-0000-0000-000000000005', current_date - 10, 'aaaaaaaa-0000-0000-0000-000000000005/certificato-1.pdf');
insert into storage.objects (bucket_id, name) select 'iscrizioni', id || '/certificato.png' from richieste_iscrizione where email = 'casa.neri@esempio.it';
set role authenticated;
select atteso('Paolo ritrovato dal telefono', tenta($$select (accogli_iscrizione((select id from richieste_iscrizione where email = 'casa.neri@esempio.it')) = 'aaaaaaaa-0000-0000-0000-000000000005')::text$$), 'true');
select atteso('una scheda che non c''è non si sceglie', tenta($$select accogli_iscrizione((select id from richieste_iscrizione where email = 'altro.paolo@esempio.it'), gen_random_uuid())::text$$), 'NEGATO: Questa scheda non c''è più');
select atteso('l''altro Paolo è un''altra persona', tenta($$select (accogli_iscrizione((select id from richieste_iscrizione where email = 'altro.paolo@esempio.it')) <> 'aaaaaaaa-0000-0000-0000-000000000005')::text$$), 'true');
select atteso('due Paolo Neri', (select count(*)::text from persone where cognome = 'Neri'), '2');
select atteso('il certificato di Paolo era scaduto: quello nuovo ha preso il posto, un png',
  (select (certificato_file ~ '^aaaaaaaa-0000-0000-0000-000000000005/certificato-[0-9]+\.png$')::text from schede_iscritti where persona_id = 'aaaaaaaa-0000-0000-0000-000000000005'), 'true');
select atteso('e la data scaduta resta, la riscrive la segreteria',
  (select (certificato_scade = current_date - 10)::text from schede_iscritti where persona_id = 'aaaaaaaa-0000-0000-0000-000000000005'), 'true');
select atteso('nella sua cartella ce n''è uno solo',
  (select count(*)::text from storage.objects where bucket_id = 'certificati' and name like 'aaaaaaaa-0000-0000-0000-000000000005/%'), '1');
reset role;

-- Una richiesta con nome e cognome di un istruttore: la ricerca di «chi è già in elenco» guarda solo gli iscritti.
set role anon;
select atteso('una richiesta come l''istruttrice Maura Uno', tenta($$select (invia_iscrizione(adulto(jsonb_build_object(
  'nome', 'Maura', 'cognome', 'Uno', 'codice_fiscale', cf_prova('NUOMRA', (current_date - interval '30 years')::date, true), 'email', 'maura@ods.it', 'telefono', '347 000 1111'))) is not null)::text$$), 'true');
reset role;
set role authenticated;
select atteso('accolta, non diventa l''istruttrice: è una persona nuova',
  tenta($$select (accogli_iscrizione((select id from richieste_iscrizione where email = 'maura@ods.it')) <> 'aaaaaaaa-0000-0000-0000-000000000002')::text$$), 'true');
select atteso('e l''istruttrice è ancora un''istruttrice, senza telefono nuovo',
  (select ruolo || ' ' || coalesce(telefono, 'senza telefono') from persone where id = 'aaaaaaaa-0000-0000-0000-000000000002'), 'istruttore senza telefono');
reset role;

-- Un'email già di un'altra persona, anche del personale (Maura, istruttrice):
-- l'iscritto entra con l'email vuota e quell'indirizzo come contatto.
set role anon;
select atteso('Zeno la manda con l''email di Maura', tenta($$select (invia_iscrizione(adulto(jsonb_build_object(
  'nome', 'Zeno', 'cognome', 'Gialli', 'codice_fiscale', cf_prova('GLLZNE', (current_date - interval '30 years')::date), 'email', 'Maura@ods.it', 'telefono', '347 555 0000'))) is not null)::text$$), 'true');
reset role;
set role authenticated;
select atteso('accolta', tenta($$select (accogli_iscrizione((select id from richieste_iscrizione where nome = 'Zeno')) is not null)::text$$), 'true');
select atteso('Zeno è una persona nuova, senza email di accesso e con quell''indirizzo come contatto',
  (select ruolo || ' ' || coalesce(email::text, 'senza email') || ' · ' || coalesce(email_contatto::text, '—') from persone where nome = 'Zeno'), 'iscritto senza email · maura@ods.it');
select atteso('Maura resta com''è', (select email::text || ' ' || coalesce(email_contatto::text, '—') from persone where id = 'aaaaaaaa-0000-0000-0000-000000000002'), 'maura@ods.it —');
reset role;

-- La scheda c'era già (stesso nome, senza email): l'email di un altro va nel suo
-- contatto, se non ne ha già uno.
insert into persone (nome, cognome, ruolo, email_contatto) values ('Ivo', 'Gialli', 'iscritto', null), ('Lia', 'Gialli', 'iscritto', 'casa@esempio.it');
set role anon;
select atteso('Ivo la manda con l''email di Anna', tenta($$select (invia_iscrizione(adulto(jsonb_build_object(
  'nome', 'Ivo', 'cognome', 'Gialli', 'codice_fiscale', cf_prova('GLLVIO', (current_date - interval '30 years')::date), 'email', 'Anna@ods.it', 'telefono', '347 555 0001'))) is not null)::text$$), 'true');
select atteso('Lia la manda con l''email di Maura', tenta($$select (invia_iscrizione(adulto(jsonb_build_object(
  'nome', 'Lia', 'cognome', 'Gialli', 'codice_fiscale', cf_prova('GLLLIA', (current_date - interval '30 years')::date), 'email', 'Maura@ods.it', 'telefono', '347 555 0002'))) is not null)::text$$), 'true');
reset role;
set role authenticated;
select atteso('Ivo accolta', tenta($$select (accogli_iscrizione((select id from richieste_iscrizione where nome = 'Ivo')) is not null)::text$$), 'true');
select atteso('Lia accolta', tenta($$select (accogli_iscrizione((select id from richieste_iscrizione where nome = 'Lia')) is not null)::text$$), 'true');
select atteso('Ivo: la stessa scheda, email vuota e l''indirizzo come contatto',
  (select count(*)::text || ' ' || coalesce(max(email::text), 'senza email') || ' · ' || coalesce(max(email_contatto::text), '—') from persone where nome = 'Ivo'), '1 senza email · anna@ods.it');
select atteso('Lia aveva già un contatto: resta quello', (select coalesce(email::text, 'senza email') || ' · ' || email_contatto::text from persone where nome = 'Lia'), 'senza email · casa@esempio.it');
reset role;

\echo ''
\echo 'TUTTO A POSTO'
