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
  -- Una funzione senza search_path cerca le tabelle dove dice chi la chiama.
  -- Erano in più file: se dice DA LANCIARE, li rilancia tutti, poi il 06.
  ('02-policy.sql', 'ogni funzione dice dove cerca le tabelle (con 04, 06, 07, 08)',
    not exists (
      select 1 from pg_proc p
      where p.pronamespace = 'public'::regnamespace
        and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
        and not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'))),
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
  ('06-iscrizioni.sql', 'le richieste contate una alla volta',
    exists (select 1 from dentro where nome = 'invia_iscrizione' and corpo like '%pg_advisory_xact_lock%')),
  ('06-iscrizioni.sql', 'il codice fiscale controllato',
    exists (select 1 from dentro where nome = 'cf_controllo')),
  -- Chi non ha un accesso chiama solo le funzioni del modulo. Se ce n'è
  -- un'altra, è stato rilanciato uno dei primi cinque file senza il 06 dopo,
  -- o un file dopo il 06 ha lasciato aperta una funzione sua: rilanciare il
  -- 06 la chiude. Contano anche quelle dei trigger, come in `prova/rls.sql`.
  -- Non contano quelle delle estensioni: su Supabase `citext` sta in `public`,
  -- è di `supabase_admin` e il SQL Editor non può toglierle i permessi, ma
  -- sono le funzioni del tipo delle email e non toccano nessuna tabella.
  -- `orari_sito` è della pagina Orari (69); `da_claude`, `porta_di_claude` e
  -- `controlla_richiesta` le chiama PostgREST prima di ogni richiesta (77),
  -- anche per chi non ha un accesso.
  ('06-iscrizioni.sql', 'i permessi, dopo gli altri file',
    not exists (
      select 1 from pg_proc p
      where p.pronamespace = 'public'::regnamespace
        and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
        and has_function_privilege('anon', p.oid, 'execute')
        and p.proname not in ('corsi_aperti', 'invia_iscrizione', 'puo_caricare', 'iscrizioni_regole', 'listino', 'mesi_presenze_pubblici',
                                'vestiario', 'invia_ordine_vestiario', 'orari_aperti', 'orari_sito',
                                'sito_pagine_pubbliche', 'sito_menu_pubblico', 'sito_redirect_pubblici',
                                'da_claude', 'porta_di_claude', 'controlla_richiesta'))),
  ('06-iscrizioni.sql', 'documento e certificato col modulo, da stampare',
    exists (select 1 from dentro where nome = 'puo_caricare' and corpo like '%certificato%')
    and exists (select 1 from dentro where nome = 'richieste_con_documento')),
  ('06-iscrizioni.sql', 'i file di una richiesta contati uno alla volta',
    exists (select 1 from pg_trigger where tgname = 'limita_file_iscrizione' and not tgisinternal)),
  ('07-certificati-pagamenti.sql', 'certificati e pagamenti',
    to_regclass('public.schede_iscritti') is not null),
  ('07-certificati-pagamenti.sql', 'certificato e documento su carta',
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'schede_iscritti' and column_name = 'documento_in_segreteria')),
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
  ('21-prove.sql', 'il telefono di chi ha provato solo alla segreteria',
    exists (select 1 from dentro where nome = 'prove_recenti' and corpo like '%gia_provati(e_staff())%')),
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
  ('28-elimina-istruttore.sql', 'eliminare un istruttore che non ha mai insegnato',
    exists (select 1 from dentro where nome = 'elimina_istruttore')
    and exists (select 1 from pg_trigger where tgname = 'persone_non_si_elimina')),
  ('28-elimina-istruttore.sql', 'eliminare anche la segreteria che insegna, ma non se stessi',
    exists (select 1 from dentro where nome = 'elimina_istruttore' and corpo like '%anche_istruttore%')),
  ('29-unisci-doppioni.sql', 'unire due schede della stessa persona',
    exists (select 1 from dentro where nome = 'unisci_persone')),
  ('30-pronto-fino-dalle-ricorrenze.sql', 'le straordinarie non fermano il calendario',
    exists (select 1 from dentro where nome = 'calendario_pronto_fino' and corpo like '%ricorrenza_id is not null%')),
  ('31-informativa-mesi.sql', 'i mesi delle presenze letti dall''informativa',
    exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'mesi_presenze_pubblici'
            and has_function_privilege('anon', p.oid, 'execute'))),
  ('33-non-doppioni.sql', 'due schede che non sono doppioni',
    to_regclass('public.non_doppioni') is not null),
  ('34-prove-per-nome.sql', 'sul tablet chi è venuto a provare si cerca per nome, mai tutto l''elenco',
    to_regprocedure('public.provati_con_pin(text, text)') is not null
    and to_regprocedure('public.provati_con_pin(text)') is null
    and to_regclass('public.ricerche_prove') is not null),
  ('35-date-corsi.sql', 'SALVA LE DATE toglie le lezioni fuori dai corsi',
    exists (select 1 from dentro where nome = 'salva_date_corsi')),
  ('36-tablet-conto-prove.sql', 'sul tablet chi prova si conta a parte',
    exists (select 1 from dentro where nome = 'prove_sala')),
  ('37-mie-ore.sql', 'l''istruttore vede le sue lezioni tenute senza segno',
    exists (select 1 from dentro where nome = 'lezioni_senza_istruttore' and corpo like '%e_personale()%')),
  ('38-segnalazioni-categoria.sql', 'le segnalazioni dicono se sono un''idea o una correzione',
    exists (select 1 from pg_constraint where conname = 'segnalazioni_categoria_solo_filo')
    and exists (select 1 from pg_policy where polname = 'segnalazioni_scrivi'
                and pg_get_expr(polwithcheck, polrelid) like '%categoria IS NOT NULL%')),
  ('39-musica-radio.sql', 'le liste della musica possono essere radio (https)',
    exists (select 1 from pg_constraint where conname = 'musica_sale_link_check'
            and pg_get_constraintdef(oid) like '%https://%a-z0-9%')),
  ('40-discipline.sql', 'esercizi, timer e liste di musica si dividono per disciplina',
    exists (select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'impostazioni' and column_name = 'discipline')
    and exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'musica_sale' and column_name = 'disciplina')
    and exists (select 1 from dentro where nome = 'musica_sala' and corpo like '%disciplina%')),
  ('41-attivita.sql', 'l''attività dei giorni e delle lezioni, scelta da un elenco',
    to_regclass('public.attivita') is not null
    and exists (select 1 from dentro where nome = 'attivita_sala')
    and exists (select 1 from dentro where nome = 'ricorrenza_cambiata' and corpo like '%attivita_id%')),
  ('42-categorie-esercizi.sql', 'gli esercizi hanno una sola categoria: le ex categorie sono voci dell''elenco',
    -- Solo l'assenza di `categoria`: la segreteria può togliere le voci, o non aver mai toccato l'elenco.
    not exists (select 1 from impostazioni, jsonb_array_elements(esercizi) e where jsonb_typeof(e) = 'object' and e ? 'categoria')),
  ('43-cerca-persone.sql', 'Aggiungi chi prova cerca fra tutte le persone, senza telefono',
    exists (select 1 from pg_proc where proname = 'cerca_persone'
            and pg_get_function_result(oid) = 'TABLE(persona_id uuid, nome text, cognome text, corsi text[])')),
  ('44-email-contatto.sql', 'l''email di contatto delle persone, che può ripetersi',
    exists (select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'persone' and column_name = 'email_contatto')
    and exists (select 1 from pg_constraint where conname = 'persone_email_contatto_forma')),
  ('44-email-contatto.sql', 'accogliere una richiesta e unire due schede tengono conto del contatto',
    exists (select 1 from dentro where nome = 'accogli_iscrizione' and corpo like '%email_contatto%')
    and exists (select 1 from dentro where nome = 'unisci_persone' and corpo like '%email_contatto%')),
  ('45-certificati-online.sql', 'il certificato resta nell''app: contenitore privato, file e data insieme, via 30 giorni dopo la scadenza',
    exists (select 1 from storage.buckets where id = 'certificati' and not public and file_size_limit = 10485760)
    and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'schede_iscritti' and column_name = 'certificato_caricato_il')
    and exists (select 1 from dentro where nome = 'salva_certificato')
    and exists (select 1 from dentro where nome = 'pulisci_certificati')),
  ('45-certificati-online.sql', 'accogliere porta il certificato alla scheda, e unire non si ferma sul file',
    exists (select 1 from dentro where nome = 'accogli_iscrizione' and corpo like '%certificati%')
    and exists (select 1 from dentro where nome = 'unisci_persone' and corpo like '%togli_file_certificato%')
    and not exists (select 1 from dentro where nome = 'richieste_con_documento' and corpo like '%certificato%')),
  ('46-istruttore-collega.sql', 'il collega segnato dall''appello, e il previsto aggiunto dalla segreteria',
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'presenze_istruttori' and column_name = 'segnata_da')
    and exists (select 1 from dentro where nome = 'segna_collega')
    and exists (select 1 from dentro where nome = 'segna_istruttore_previsto')),
  ('47-vestiario.sql', 'gli ordini di vestiario, letti e mandati dalla pagina pubblica',
    to_regclass('public.ordini_vestiario') is not null
    and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'impostazioni' and column_name = 'vestiario')
    and exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'invia_ordine_vestiario'
                and has_function_privilege('anon', p.oid, 'execute'))
    and exists (select 1 from dentro where nome = 'correggi_ordine_vestiario')),
  ('47-vestiario.sql', 'gli ordini dal link contati uno alla volta',
    exists (select 1 from dentro where nome = 'invia_ordine_vestiario' and corpo like '%pg_advisory_xact_lock%')),
  ('47-vestiario.sql', 'un ordine troppo grande rifiutato prima della fila',
    exists (select 1 from dentro where nome = 'invia_ordine_vestiario' and corpo like '%pg_column_size(dati)%')),
  ('47-vestiario.sql', 'il pagato e il banco: saldato solo da segna_vestiario',
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ordini_vestiario' and column_name = 'dal_banco')
    and exists (select 1 from dentro where nome = 'segna_vestiario')
    and exists (select 1 from dentro where nome = 'vestiario_gia_mandato' and corpo like '%vestiario_cifre%')
    and not has_column_privilege('authenticated', 'public.ordini_vestiario', 'saldato', 'update')),
  ('48-orari-aperti.sql', 'gli orari dei corsi aperti, per «stessa ora» nelle iscrizioni',
    exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'orari_aperti'
            and has_function_privilege('anon', p.oid, 'execute'))),
  ('49-richieste-per-email.sql', 'sei richieste al giorno dalla stessa email',
    iscrizioni_regole()->>'per_email_al_giorno' = '6'),
  ('50-file-rimandato.sql', 'un file rimandato non è un file di troppo',
    exists (select 1 from dentro where nome = 'puo_caricare' and corpo like '%o.name = nome_file%')
    and exists (select 1 from dentro where nome = 'limita_file_iscrizione' and corpo like '%o.name = new.name%')),
  ('51-vestiario-foto.sql', 'il vestiario come il modulo: tipi, foto e tabelle delle taglie',
    exists (select 1 from storage.buckets where id = 'vestiario' and public)
    and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'impostazioni' and column_name = 'vestiario_tabelle')
    and exists (select 1 from dentro where nome = 'vestiario' and corpo like '%tabelle%')
    and exists (select 1 from pg_constraint where conname = 'impostazioni_vestiario_capi_check')),
  ('52-presenze-finestra.sql', 'le presenze si toccano solo nelle lezioni di questi giorni',
    exists (select 1 from pg_trigger where tgname = 'presenze_a_finestra' and not tgisinternal)
    and exists (select 1 from dentro where nome = 'istruttore_dall_appello' and corpo like '%tablet_regole%')),
  ('57-accessi-piu-stretti.sql', 'sessioni e impostazioni solo a chi lavora, e le funzioni del calendario non passano senza accesso',
    exists (select 1 from dentro where nome = 'materializza_sessioni' and corpo like '%e_di_sistema%')
    and exists (select 1 from dentro where nome = 'imposta_pin' and corpo like '%e_di_sistema%')
    and exists (select 1 from dentro where nome = 'pulisci_presenze' and corpo like '%e_di_sistema%')
    and exists (select 1 from dentro where nome = 'chiudi_ricorrenza' and corpo like '%e_di_sistema%')
    and exists (select 1 from dentro where nome = 'salva_date_corsi' and corpo like '%e_di_sistema%')
    and exists (select 1 from dentro where nome = 'allunga_calendario' and corpo like '%e_personale%')
    and exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'impostazioni_legge' and qual like '%e_personale%')
    and exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'sessioni_legge' and qual like '%e_personale%')),
  ('56-sito.sql', 'le pagine del sito, col menu e i rinvii, scritte dalla segreteria',
    to_regclass('public.sito_pagine') is not null
    and exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'salva_bozza_sito')
    and exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'sito_pagine_pubbliche')),
  ('53-codice-fiscale-stesso-nome.sql', 'accogliere aggancia dal codice fiscale solo chi ha lo stesso nome',
    exists (select 1 from dentro where nome = 'accogli_iscrizione' and corpo like '%lower(p.cognome) = lower(r.cognome)%')),
  ('54-pagamenti-diretti.sql', 'i pagamenti fatti a mano, senza ricevuta',
    to_regclass('public.pagamenti_diretti') is not null
    and exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'registra_pagamento_diretto')
    and exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'annulla_pagamento_diretto')),
  ('59-contabilita.sql', 'la contabilità: voci, casse e movimenti, solo per chi cura i conti',
    to_regclass('public.movimenti') is not null
    and to_regclass('public.casse') is not null
    and to_regclass('public.voci_contabili') is not null
    and exists (select 1 from dentro where nome = 'registra_movimento' and corpo like '%contabilita_porta()%')
    and exists (select 1 from dentro where nome = 'registra_giroconto')),
  ('60-chiusura-cassa.sql', 'la chiusura di cassa: il contato dei contanti, la differenza e i giorni chiusi',
    to_regclass('public.chiusure_cassa') is not null
    and exists (select 1 from dentro where nome = 'chiudi_cassa' and corpo like '%contabilita_porta()%')
    and exists (select 1 from dentro where nome = 'annulla_chiusura_cassa')
    and exists (select 1 from dentro where nome = 'registra_movimento' and corpo like '%cassa_giorno_chiuso%')),
  ('55-amministrazione.sql', 'il ruolo amministrazione, per chi cura i conti',
    exists (select 1 from pg_enum e where e.enumtypid = 'ruolo'::regtype and e.enumlabel = 'amministrazione')
    and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'persone' and column_name = 'anche_amministrazione')
    and exists (select 1 from dentro where nome = 'e_amministrazione')
    and exists (select 1 from dentro where nome in ('emetti_ricevuta', 'fai_ricevuta') and corpo like '%e_amministrazione()%')
    and exists (select 1 from dentro where nome = 'nomi_persone')
    and exists (select 1 from dentro where nome = 'cerca_pagatori')
    and to_regclass('public.ricerche_pagatori') is not null),
  ('61-tessere.sql', 'le tessere, e quale tessera chiede un corso',
    to_regclass('public.tessere') is not null
    and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'corsi' and column_name = 'ente_tessera')),
  ('61-tessere.sql', 'l''import dal RASD e l''unione delle schede',
    exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'importa_tessere')
    and exists (select 1 from pg_trigger where tgname = 'tessere_unione' and not tgisinternal)),
  ('25-segnalazioni.sql', 'le segnalazioni della segreteria, con le risposte',
    to_regclass('public.segnalazioni') is not null),
  ('25-segnalazioni.sql', 'un filo senza titolo non entra',
    exists (select 1 from pg_constraint where conname = 'segnalazioni_check'
            and pg_get_constraintdef(oid) like '%titolo IS NOT NULL%')),
  ('32-segnalazioni-allegati.sql', 'i file nelle segnalazioni, in un contenitore privato',
    exists (select 1 from storage.buckets where id = 'segnalazioni' and not public)
    and to_regclass('public.segnalazioni_allegati') is not null),
  ('32-segnalazioni-allegati.sql', 'un allegato lo toglie solo chi l''ha mandato',
    exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'togli_allegato')
    and exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'pulisci_allegati')),
  ('32-segnalazioni-allegati.sql', 'gli allegati di un messaggio contati uno alla volta',
    exists (select 1 from pg_trigger where tgname = 'limita_file_allegati' and not tgisinternal)
    and exists (select 1 from pg_trigger where tgname = 'limita_allegati' and not tgisinternal)),
  ('13-voce-esercizi.sql', 'la voce e gli esercizi dei tablet, decisi dalla segreteria',
    exists (select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'impostazioni' and column_name = 'esercizi')
    and exists (select 1 from storage.buckets where id = 'voce')),
  ('58-sito-immagini.sql', 'le immagini del sito, in un contenitore pubblico, caricate solo dalla segreteria',
    exists (select 1 from storage.buckets where id = 'sito' and public)
    and (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'
           and (qual like '%''sito''%' or with_check like '%''sito''%')
           and cmd in ('INSERT', 'SELECT', 'DELETE') and roles = '{authenticated}') = 3),
  ('62-sito-pezzi.sql', 'le pagine del sito a pezzi: la struttura salvata accanto alla bozza, scritta solo dalla segreteria',
    exists (select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'sito_pagine' and column_name = 'bozza_pezzi')
    and to_regprocedure('public.salva_bozza_pezzi_sito(uuid,integer,text,text,text,jsonb)') is not null),
  ('63-importa-prima-nota.sql', 'l''import dello storico dei movimenti dal vecchio programma, solo per chi cura i conti',
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'movimenti' and column_name = 'origine_import')
    and to_regprocedure('public.importa_prima_nota(jsonb)') is not null),
  ('64-pagamenti-non-nel-futuro.sql', 'il pagamento a mano non nel futuro e i contanti non in un giorno di cassa chiuso',
    exists (select 1 from pg_trigger where tgname = 'pagamenti_diretti_non_nel_futuro' and not tgisinternal)
    and exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'registra_pagamento_diretto'
                and pg_get_functiondef(p.oid) like '%cassa_giorno_chiuso%' and pg_get_functiondef(p.oid) like '%contabilita_oggi()%')),
  ('65-elimina-presenza-rifiutata.sql', 'la presenza di un istruttore rifiutata si può eliminare',
    exists (select 1 from dentro where nome = 'elimina_presenza_istruttore')),
  ('66-elimina-segreteria.sql', 'eliminare anche la segreteria, se non ha storia nei registri',
    exists (select 1 from dentro where nome = 'elimina_istruttore' and corpo like '%ha già lavorato nei registri%')),
  ('67-cambia-voce.sql', 'cambiare la voce dei movimenti, con la traccia di chi l''ha fatto',
    exists (select 1 from dentro where nome = 'cambia_voce_movimenti') and to_regclass('public.cambi_voce') is not null),
  ('68-sito-orario.sql', 'l''orario del sito dalle ricorrenze di CORSI: le pagine si collegano ai corsi, solo dalla segreteria',
    exists (select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'sito_pagine' and column_name = 'corsi_collegati')
    and to_regprocedure('public.salva_corsi_sito(uuid,uuid[])') is not null
    -- Rilanciare 56 dopo 68 rimette la funzione pubblica senza la colonna: la riga torna «da lanciare».
    and exists (select 1 from pg_proc p where p.oid = to_regprocedure('public.sito_pagine_pubbliche()') and 'corsi_collegati' = any(p.proargnames))),
  ('69-orari-sito.sql', 'gli orari dei corsi per la pagina Orari del sito, con la data di modifica scritta dal database',
    exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'orari_sito'
            and has_function_privilege('anon', p.oid, 'execute'))
    and exists (select 1 from pg_trigger where tgname = 'ricorrenza_modificata' and not tgisinternal)),
  ('70-movimenti-persona.sql', 'lo storico dei movimenti collegato alla persona, con la traccia di chi l''ha fatto',
    exists (select 1 from dentro where nome = 'collega_movimenti_persona') and to_regclass('public.collegamenti_persona') is not null
    and exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'movimenti' and column_name = 'persona_id')),
  ('70-movimenti-persona.sql', 'l''accento scritto come apostrofo dal vecchio programma («NICOLO''» = «Nicolò»)',
    exists (select 1 from dentro where nome = 'collegamento_token' and corpo like '%([aeiou])%')),
  ('71-pagato-vecchio-programma.sql', 'la lettura degli incassi del vecchio programma nella stagione, per il filtro «Pagato nel vecchio programma»',
    to_regprocedure('public.incassi_vecchio_programma()') is not null
    and exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'movimenti' and column_name = 'persona_id')),
  ('71-pagato-vecchio-programma.sql', 'agosto nella stagione che inizia, come nell''app (src/lib/costi.ts)',
    exists (select 1 from dentro where nome = 'incassi_vecchio_programma' and corpo like '%12 months%')),
  ('72-movimenti-dalla-chat.sql', 'i movimenti registrati dalla chat con Claude: la chiave, il segno e i simili',
    to_regprocedure('public.registra_movimento_dalla_chat(jsonb)') is not null
    and to_regprocedure('public.movimenti_simili(text)') is not null
    and exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'movimenti' and column_name = 'chiave_chat')),
  ('73-satispay.sql', 'il pagamento con Satispay dal modulo di iscrizione: importo dal listino, esito e ricevuta',
    to_regclass('public.pagamenti_satispay') is not null
    and to_regprocedure('public.emetti_ricevuta_satispay(jsonb,uuid)') is not null
    and exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'pagamenti_satispay' and column_name = 'persona_id')),
  ('74-provenienza-richieste.sql', 'da dove arrivano le richieste: l''etichetta del link, «come ci hai conosciuto» e i conteggi',
    to_regclass('public.richieste_contate') is not null
    and to_regprocedure('public.richieste_da_dove(date,date)') is not null
    and exists (select 1 from pg_trigger where tgname = 'richieste_contate_nuova' and not tgisinternal)
    and exists (select 1 from pg_trigger where tgname = 'richieste_contate_scorda' and not tgisinternal)
    -- Rilanciare 06 dopo 74 rimette la invia_iscrizione che ignora le due chiavi: la riga torna «da lanciare».
    and exists (select 1 from dentro where nome = 'invia_iscrizione' and corpo like '%pulisci_provenienza%')),
  ('76-ricevute-email.sql', 'la ricevuta per email: gli invii, l''indirizzo dalla scheda e la soglia del giorno',
    to_regclass('public.invii_ricevute') is not null
    and to_regprocedure('public.indirizzo_ricevuta(uuid)') is not null
    and to_regprocedure('public.controlla_invio_ricevuta(uuid)') is not null
    and to_regprocedure('public.registra_invio_ricevuta(uuid,text,text,uuid,citext,text)') is not null
    -- La firma di prima la chiamava il browser: se c'è ancora, il file è quello vecchio.
    and to_regprocedure('public.registra_invio_ricevuta(uuid,text,text)') is null
    and exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'invii_ricevute' and column_name = 'pdf_sha256')
    and to_regprocedure('public.esiti_invio_ricevuta(uuid)') is not null
    and exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'impostazioni' and column_name = 'ricevute_email_dal')),
  ('78-tariffe-tecnici.sql', 'i dati e le tariffe dei tecnici: province, IBAN e tariffa oraria per corso',
    to_regclass('public.tariffe_istruttori') is not null
    and exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'anagrafiche' and column_name = 'iban')),
  ('79-lettere-incarico.sql', 'le lettere d''incarico dei tecnici: una valida per stagione, fatte dalla funzione',
    to_regclass('public.lettere_incarico') is not null
    and to_regprocedure('public.fai_lettera_incarico(uuid,text,date,date,text,text,date,jsonb,jsonb)') is not null),
  ('80-ricevute-compensi.sql', 'le ricevute mensili dei compensi dei tecnici: una per mese, fatte e annullate dalle funzioni',
    to_regclass('public.ricevute_compensi') is not null
    and to_regprocedure('public.fai_ricevuta_compenso(uuid,date,jsonb,integer,integer,text,jsonb,text,date)') is not null
    and to_regprocedure('public.annulla_ricevuta_compenso(uuid)') is not null),
  ('81-compensi-pagati.sql', 'il compenso pagato in contabilità: la voce, il pagamento e le ricevute che tornano da pagare',
    to_regprocedure('public.paga_compensi(uuid[],date,uuid)') is not null
    and exists (select 1 from voci_contabili where nome = 'Compensi istruttori' and tipo = 'uscita' and di_sistema)
    and exists (select 1 from pg_trigger where tgname = 'compensi_tornano' and not tgisinternal)
    -- Rilanciare 80 dopo 81 rimette l'annullamento che non guarda il pagamento: la riga torna «da lanciare».
    and exists (select 1 from dentro where nome = 'annulla_ricevuta_compenso' and corpo like '%È pagata%')),
  ('82-manca-la-firma.sql', 'manca la firma: «a lezione basta uno» e chi non c''era',
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'corsi' and column_name = 'basta_uno')
    and to_regprocedure('public.segna_istruttore_assente(uuid,uuid)') is not null),
  ('83-satispay-prima.sql', 'Satispay prima di mandare: il pagamento senza richiesta e la richiesta che lo prende',
    to_regprocedure('public.satispay_prepara_prima(uuid,text,text,text,text)') is not null
    and to_regprocedure('public.satispay_stato_pagamento(uuid)') is not null
    and to_regprocedure('public.importo_corso(uuid,text,date)') is not null
    and exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'pagamenti_satispay' and column_name = 'email')
    and exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'pagamenti_satispay' and column_name = 'preso_il')
    -- Rilanciare 06 o 74 dopo 83 rimette la invia_iscrizione che ignora il pagamento: la riga torna «da lanciare».
    and exists (select 1 from dentro where nome = 'invia_iscrizione' and corpo like '%pagamento_satispay%' and corpo like '%preso_il%')),
  ('84-avvisi-segreteria.sql', 'gli avvisi alla segreteria: indirizzi, registro e la famiglia che avvisa una volta',
    to_regclass('public.avvisi_indirizzi') is not null
    and to_regclass('public.avvisi_segreteria') is not null
    and to_regprocedure('public.avvisi_da_mandare()') is not null
    and to_regprocedure('public.avviso_mandato(uuid)') is not null
    and to_regprocedure('public.avviso_preso(uuid)') is not null
    and to_regprocedure('public.avvisi_non_mandati_oggi()') is not null
    -- Rilanciare 06, 74 o 83 dopo 84 rimette la invia_iscrizione che ignora l'invio: la riga torna «da lanciare».
    and exists (select 1 from dentro where nome = 'invia_iscrizione' and corpo like '%inv := %')),
  ('85-solleciti.sql', 'i solleciti su WhatsApp: chi ha sollecitato e quando',
    to_regclass('public.solleciti') is not null
    and to_regprocedure('public.segna_sollecito(uuid)') is not null
    and to_regprocedure('public.ultimo_sollecito(uuid)') is not null),
  ('86-ricevuta-una-volta.sql', 'una ricevuta fatta una volta sola: la chiave del modulo',
    exists (select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'ricevute' and column_name = 'chiave')
    and to_regprocedure('public.ricevuta_gia_fatta(uuid,uuid)') is not null
    -- Rilanciare 55 o 73 dopo 86 rimette le funzioni che ignorano la chiave: la riga torna «da lanciare».
    and exists (select 1 from dentro where nome in ('emetti_ricevuta', 'fai_ricevuta') and corpo like '%ricevuta_gia_fatta%')
    and exists (select 1 from dentro where nome = 'emetti_ricevuta_satispay' and corpo like '%ricevuta_gia_fatta%')),
  ('87-solleciti-elenco.sql', 'i solleciti nell''elenco ISCRITTI: gli ultimi di tutti e Annulla',
    to_regprocedure('public.ultimi_solleciti()') is not null
    and to_regprocedure('public.togli_sollecito(uuid)') is not null),
  ('88-pagamento-una-volta.sql', 'un pagamento a mano registrato una volta sola: la chiave della ricevuta e il Satispay arrivato',
    -- Rilanciare 64 dopo 88 rimette la funzione che ignora chiave e Satispay: la riga torna «da lanciare».
    exists (select 1 from dentro where nome = 'registra_pagamento_diretto' and corpo like '%chiave_ricevuta%' and corpo like '%pagamenti_satispay%')),
  ('89-pagamento-diventa-ricevuta.sql', 'il pagamento a mano diventa ricevuta, e torna se la ricevuta si annulla',
    exists (select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'pagamenti_diretti' and column_name = 'ricevuta_id')
    and to_regprocedure('public.emetti_ricevuta_da_pagamento(jsonb,uuid)') is not null
    -- Rilanciare 55 dopo 89 rimette l'annullo che lascia il pagamento a mano annullato: la riga torna «da lanciare».
    and exists (select 1 from dentro where nome = 'annulla_ricevuta' and corpo like '%pagamenti_diretti%')),
  ('90-ricevuta-cassa-chiusa.sql', 'i contanti di un giorno di cassa chiusa non entrano dalla ricevuta, e la segreteria sa fin quando è chiusa',
    to_regprocedure('public.cassa_contanti_chiusa_fino()') is not null
    and exists (select 1 from dentro where nome = 'fai_ricevuta' and corpo like '%cassa_giorno_chiuso%')
    -- Rilanciare 86 o 89 dopo 90 rimette le funzioni che non guardano il giorno chiuso: la riga torna «da lanciare».
    and exists (select 1 from dentro where nome = 'emetti_ricevuta' and corpo like '%fai_ricevuta%')
    and exists (select 1 from dentro where nome = 'emetti_ricevuta_da_pagamento' and corpo like '%fai_ricevuta%'))
) as x(file, cosa, c)
order by file, cosa;
