-- ---------------------------------------------------------------------------
-- Quali file sono stati lanciati su questo database.
--
-- Supabase non tiene il conto di quali file sono stati lanciati: ci sono solo
-- le tabelle e le funzioni che hanno creato. Qui, per ogni file, si cerca
-- qualcosa che fa solo quel file, e anche le cose aggiunte dopo, perché un
-- file lanciato mesi fa può essere una versione vecchia. Si incolla nel SQL
-- Editor: legge soltanto, non cambia niente.
--
-- Una riga DA LANCIARE vuol dire: si rilancia quel file, e poi quelli che
-- vengono dopo di lui fino a `06-iscrizioni.sql` compreso, che rimette i
-- permessi giusti alle funzioni. Rilanciare non distrugge niente.
--
-- Va tenuto al passo: chi cambia uno dei file numerati aggiunge qui una riga
-- per quello che ha aggiunto.
-- ---------------------------------------------------------------------------

-- `dentro` sono le funzioni con il loro corpo: una versione vecchia di un
-- file lascia la funzione, ma con dentro quello che faceva prima.
with dentro(nome, corpo) as (
  select p.proname::text, p.prosrc from pg_proc p where p.pronamespace = 'public'::regnamespace
)
select file, cosa, case when c then 'ok' else 'DA LANCIARE' end as stato from (values
  ('01-schema.sql', 'le tabelle',
    to_regclass('public.ricorrenze') is not null),
  ('01-schema.sql', 'la sala dei singoli giorni',
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ricorrenze' and column_name = 'sala_id')),
  ('01-schema.sql', 'il ruolo doppio, segreteria e istruttore',
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'persone' and column_name = 'anche_istruttore')),
  ('02-policy.sql', 'le policy',
    exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'sessioni_legge')),
  ('02-policy.sql', 'gli istruttori tolgono un segno dall''appello',
    exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'presenze_cancella' and qual like '%e_personale%')),
  ('03-funzioni.sql', 'il calendario',
    exists (select 1 from dentro where nome = 'materializza_sessioni')),
  ('03-funzioni.sql', 'di una lezione l''istruttore cambia solo stato e nota',
    exists (select 1 from pg_trigger where tgname = 'sessioni_solo_stato' and not tgisinternal)),
  ('03-funzioni.sql', 'il calendario con la sala del giorno',
    exists (select 1 from dentro where nome = 'materializza_sessioni' and corpo like '%coalesce(r.sala_id, c.sala_id)%')),
  ('03-funzioni.sql', 'il calendario che si allunga da sé',
    exists (select 1 from dentro where nome = 'materializza_sessioni' and corpo like '%ods.allunga%')),
  ('04-tablet.sql', 'il tablet di sala',
    exists (select 1 from dentro where nome = 'lezioni_sala')),
  ('04-tablet.sql', 'il tablet con la sala del giorno',
    exists (select 1 from dentro where nome = 'lezioni_sala' and corpo like '%r.sala_id%')),
  ('04-tablet.sql', 'il PIN lo imposta solo la segreteria',
    exists (select 1 from dentro where nome = 'imposta_pin' and corpo not like '%per sé%')),
  ('04-tablet.sql', 'il blocco del PIN a prova di richieste insieme',
    exists (select 1 from dentro where nome = 'persona_da_pin' and corpo like '%pg_advisory_xact_lock%')),
  ('05-segreteria.sql', 'la segreteria',
    exists (select 1 from dentro where nome = 'corso_cambiato')),
  ('05-segreteria.sql', 'la sala dei giorni che si sposta',
    exists (select 1 from pg_trigger where tgname = 'ricorrenze_cambiate' and not tgisinternal)),
  ('05-segreteria.sql', 'il primo accesso solo con l''email confermata',
    exists (select 1 from dentro where nome = 'collega_utente' and corpo like '%email_confirmed_at%')),
  ('06-iscrizioni.sql', 'il modulo di iscrizione',
    exists (select 1 from dentro where nome = 'corsi_aperti')),
  ('06-iscrizioni.sql', 'le richieste rifiutate fuori dal limite',
    exists (select 1 from dentro where nome = 'invia_iscrizione' and corpo like '%<> ''rifiutata''%')),
  ('06-iscrizioni.sql', 'il codice fiscale controllato',
    exists (select 1 from dentro where nome = 'cf_controllo')),
  -- Chi non ha un accesso chiama solo le funzioni del modulo. Se ce n'è
  -- un'altra, è stato rilanciato uno dei primi cinque file senza il 06 dopo.
  -- Non contano le funzioni dei trigger, che non si possono chiamare da
  -- fuori, e quelle delle estensioni: su Supabase `citext` sta in `public`,
  -- è di `supabase_admin` e il SQL Editor non può toglierle i permessi, ma
  -- sono le funzioni del tipo delle email e non toccano nessuna tabella.
  ('06-iscrizioni.sql', 'i permessi, dopo gli altri file',
    not exists (
      select 1 from pg_proc p
      where p.pronamespace = 'public'::regnamespace
        and p.prorettype <> 'trigger'::regtype
        and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
        and has_function_privilege('anon', p.oid, 'execute')
        and p.proname not in ('corsi_aperti', 'invia_iscrizione', 'puo_caricare', 'iscrizioni_regole', 'listino'))),
  ('06-iscrizioni.sql', 'documento e certificato col modulo, da stampare',
    exists (select 1 from dentro where nome = 'puo_caricare' and corpo like '%certificato%')
    and exists (select 1 from dentro where nome = 'richieste_con_documento' and corpo like '%certificato%')),
  ('07-certificati-pagamenti.sql', 'certificati e pagamenti',
    to_regclass('public.schede_iscritti') is not null),
  ('07-certificati-pagamenti.sql', 'certificato e documento su carta',
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'schede_iscritti' and column_name = 'documento_in_segreteria')
    and not exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'certificati_carica')),
  ('08-timer.sql', 'il timer: libreria, corsi, storico, preferenze',
    to_regclass('public.preferenze_timer') is not null),
  ('09-musica.sql', 'la musica delle sale',
    exists (select 1 from dentro where nome = 'musica_sala')),
  ('10-timer-sale.sql', 'il timer dei tablet, uguale per tutti',
    exists (select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'impostazioni' and column_name = 'timer')),
  ('11-timer-lezioni.sql', 'il timer di una singola lezione',
    to_regclass('public.sessioni_timer') is not null),
  ('12-calendario-da-se.sql', 'il calendario che si allunga da sé',
    exists (select 1 from dentro where nome = 'allunga_calendario')),
  ('12-calendario-da-se.sql', 'le date di inizio e fine dei corsi',
    exists (select 1 from dentro where nome = 'allunga_calendario' and corpo like '%fine_corsi%')
    and exists (select 1 from pg_trigger where tgname = 'sessioni_in_stagione')),
  ('14-timer-dal-tablet.sql', 'il timer delle sale cambiato da un tablet',
    exists (select 1 from dentro where nome = 'salva_timer_sala')),
  ('17-luoghi.sql', 'i luoghi di nascita del codice fiscale',
    exists (select 1 from luoghi_nascita)),
  ('15-presenze-istruttori.sql', 'la presenza degli istruttori dal PIN del tablet',
    to_regclass('public.presenze_istruttori') is not null
    and exists (select 1 from dentro where nome = 'presenza_con_pin')
    and exists (select 1 from dentro where nome = 'gestisci_presenza_istruttore')),
  ('15-presenze-istruttori.sql', 'la presenza di chi è di segreteria e insegna',
    exists (select 1 from dentro where nome = 'presenza_con_pin' and corpo like '%anche_istruttore%')),
  ('16-ricevute.sql', 'le ricevute dei pagamenti',
    to_regclass('public.ricevute') is not null
    and exists (select 1 from dentro where nome = 'emetti_ricevuta')
    and exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'impostazioni' and column_name = 'ricevute')),
  ('18-anagrafiche.sql', 'nascita, residenza e genitore degli iscritti importati',
    to_regclass('public.anagrafiche') is not null
    and exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'anagrafiche_legge')),
  ('19-listino.sql', 'il listino cambiato dalla segreteria',
    exists (select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'impostazioni' and column_name = 'listino')
    and exists (select 1 from dentro where nome = 'listino')),
  ('19-listino.sql', 'il listino letto dalla pagina di iscrizione',
    exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'listino'
            and has_function_privilege('anon', p.oid, 'execute'))),
  ('20-nomi.sql', 'nomi e cognomi scritti tutti allo stesso modo',
    exists (select 1 from dentro where nome = 'nome_proprio')
    and exists (select 1 from pg_trigger where tgname = 'persone_nomi')
    and exists (select 1 from pg_trigger where tgname = 'ricevute_nomi')),
  ('21-prove.sql', 'le prove: chi viene a provare entra nell''appello',
    to_regclass('public.prove') is not null
    and exists (select 1 from dentro where nome = 'aggiungi_prova')
    and exists (select 1 from dentro where nome = 'aggiungi_prova_con_pin')),
  ('22-statistiche.sql', 'le statistiche della segreteria',
    exists (select 1 from dentro where nome = 'statistiche')),
  ('23-istruttori-dalle-lezioni.sql', 'la presenza degli istruttori dall''appello e le lezioni tenute da confermare',
    exists (select 1 from dentro where nome = 'lezioni_senza_istruttore')
    and exists (select 1 from dentro where nome = 'segna_istruttori_lezione')
    and exists (select 1 from pg_trigger where tgname = 'presenze_istruttore_dall_appello')),
  ('24-kanji.sql', 'il kanji degli istruttori',
    exists (select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'persone' and column_name = 'kanji')
    and to_regclass('public.persone_kanji_unico') is not null),
  ('24-kanji.sql', 'il kanji degli istruttori sul tablet di sala',
    exists (select 1 from dentro where nome = 'kanji_sala')),
  ('27-pagamento-dalle-ricevute.sql', 'se ha pagato lo dicono le ricevute',
    to_regclass('public.quote_ricevute') is not null),
  ('26-colori-corsi.sql', 'nessun corso rosso',
    not exists (select 1 from corsi where lower(colore) = '#e4292a')),
  ('25-segnalazioni.sql', 'le segnalazioni della segreteria, con le risposte',
    to_regclass('public.segnalazioni') is not null),
  ('25-segnalazioni.sql', 'un filo senza titolo non entra',
    exists (select 1 from pg_constraint where conname = 'segnalazioni_check'
            and pg_get_constraintdef(oid) like '%titolo IS NOT NULL%')),
  ('13-voce-esercizi.sql', 'la voce e gli esercizi dei tablet, decisi dalla segreteria',
    exists (select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'impostazioni' and column_name = 'esercizi')
    and exists (select 1 from storage.buckets where id = 'voce'))
) as x(file, cosa, c)
order by file, cosa;
