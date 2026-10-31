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
  ('44-email-contatto.sql', 'l''email di contatto delle persone (poi passata nel campo unico, vedi 99)',
    exists (select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'persone' and column_name = 'email_contatto')),
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
  ('90-omonimi-codice-fiscale.sql', 'accogliere non aggancia l''omonimo che ha già un altro codice fiscale',
    exists (select 1 from dentro where nome = 'accogli_iscrizione' and corpo like '%a.codice_fiscale <> r.codice_fiscale%')),
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
    -- Dal 124 la funzione ha la chiave del browser come sesto argomento.
    (to_regprocedure('public.satispay_prepara_prima(uuid,text,text,text,text)') is not null
      or to_regprocedure('public.satispay_prepara_prima(uuid,text,text,text,text,uuid)') is not null)
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
    and exists (select 1 from dentro where nome = 'invia_iscrizione' and corpo like '%inv := %')
    and exists (select 1 from pg_constraint where conname = 'avvisi_segreteria_tipo_check' and pg_get_constraintdef(oid) like '%satispay_scarico%')),
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
  ('91-richieste-accolte-restano.sql', 'una richiesta accolta non si elimina finché c''è la scheda',
    exists (select 1 from pg_policies where tablename = 'richieste_iscrizione' and policyname = 'richieste_cancella' and qual like '%accolta%')
    and not has_table_privilege('authenticated', 'public.richieste_iscrizione', 'update')),
  ('92-ricevuta-cassa-chiusa.sql', 'i contanti di un giorno di cassa chiusa non entrano dalla ricevuta, e la segreteria sa fin quando è chiusa',
    to_regprocedure('public.cassa_contanti_chiusa_fino()') is not null
    and exists (select 1 from dentro where nome = 'fai_ricevuta' and corpo like '%cassa_giorno_chiuso%')
    -- Rilanciare 86 o 89 dopo 92 rimette le funzioni che non guardano il giorno chiuso: la riga torna «da lanciare».
    and exists (select 1 from dentro where nome = 'emetti_ricevuta' and corpo like '%fai_ricevuta%')
    and exists (select 1 from dentro where nome = 'emetti_ricevuta_da_pagamento' and corpo like '%fai_ricevuta%')),
  ('93-ricevuta-data-numero.sql', 'la ricevuta non si fa nel futuro, e il numero a mano solo in un anno senza ricevute',
    -- Rilanciare 92 dopo 93 rimette la fai_ricevuta senza data né numero: la riga torna «da lanciare».
    exists (select 1 from dentro where nome = 'fai_ricevuta' and corpo like '%contabilita_oggi%' and corpo like '%cassa_giorno_chiuso%')
    and exists (select 1 from dentro where nome = 'emetti_ricevuta' and corpo like '%fai_ricevuta%')),
  ('94-disattiva-chiude-iscrizioni.sql', 'disattivare una scheda chiude le sue iscrizioni',
    exists (select 1 from pg_trigger where tgname = 'persone_iscrizioni_disattivata' and tgrelid = 'public.persone'::regclass)),
  ('95-certificato-piu-lontano.sql', 'accogliendo vince il certificato che scade dopo',
    to_regprocedure('public.accogli_iscrizione(uuid, uuid, date)') is not null and to_regprocedure('public.accogli_iscrizione(uuid, uuid)') is null),
  ('96-compensi-extra.sql', 'la ricevuta di compenso extra: più d''una per tecnico e mese, accanto a quella del mese',
    exists (select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'ricevute_compensi' and column_name = 'extra')
    and to_regprocedure('public.fai_ricevuta_compenso_extra(uuid,date,text,integer)') is not null
    and to_regprocedure('public.modifica_ricevuta_compenso_extra(uuid,text,integer)') is not null
    and exists (select 1 from pg_indexes where indexname = 'ricevute_compensi_valida' and indexdef like '%extra IS NULL%')
    -- Rilanciare 80 o 81 dopo 96 rimette le funzioni che non sanno delle extra: la riga torna «da lanciare».
    and exists (select 1 from dentro where nome = 'fai_ricevuta_compenso' and corpo like '%r.extra is null%')
    and exists (select 1 from dentro where nome = 'paga_compensi' and corpo like '%x.extra%')),
  ('97-satispay-scarico.sql', 'i pagamenti Satispay del negozio entrano da soli in contabilità',
    to_regclass('public.satispay_negozio') is not null and to_regprocedure('public.satispay_negozio_applica(boolean)') is not null
    and exists (select 1 from casse where nome = 'Satispay')
    and to_regprocedure('public.satispay_scarico_avvisa(jsonb,text)') is not null),
  ('97-satispay-scarico.sql', 'lo scarico Satispay tiene la descrizione del pagamento',
    exists (select 1 from information_schema.columns where table_name = 'satispay_negozio' and column_name = 'descrizione')
    and exists (select 1 from dentro where nome = 'satispay_negozio_salva' and corpo like '%descrizione = coalesce(s.descrizione%')),
  ('97-satispay-scarico.sql', 'lo scarico Satispay scrive anche con safeupdate',
    exists (select 1 from dentro where nome = 'satispay_negozio_applica' and corpo like '%primo_fatto = true where id%')
    and exists (select 1 from dentro where nome = 'satispay_scarico_segna' and corpo like '%where id%')
    and exists (select 1 from dentro where nome = 'satispay_scarico_ripresa' and corpo like '%where id%')),
  ('98-quote-persona.sql', 'le quote e i corsi scritti a mano hanno la persona',
    to_regprocedure('public.cambia_voce_movimenti(uuid[],uuid,uuid)') is not null
    and to_regprocedure('public.voce_vuole_persona(text,uuid)') is not null
    -- Rilanciare 60 o 70 dopo 98 rimette le funzioni senza la persona (in 70 anche `collegamento_perche`): la riga torna «da lanciare».
    and exists (select 1 from dentro where nome = 'registra_movimento' and corpo like '%voce_vuole_persona%')
    and exists (select 1 from dentro where nome = 'storico_persona' and corpo like '%prima-nota:%')
    and not exists (select 1 from dentro where nome = 'collegamento_perche' and corpo like '%non viene dal vecchio programma%')
    -- Rilanciare 67 dopo 98 rimette la versione a due argomenti accanto a questa: l'app non sa più quale chiamare.
    and to_regprocedure('public.cambia_voce_movimenti(uuid[],uuid)') is null),
  ('99-email-unica.sql', 'una sola email per persona: unica solo per chi ha un accesso, la stessa per ricevute e avvisi',
    exists (select 1 from pg_indexes where indexname = 'persone_email_unica' and indexdef like '%ruolo%')
    -- Rilanciare 45, 53, 90 o 95 dopo 99 rimette le funzioni che scrivono il contatto: la riga torna «da lanciare».
    and not exists (select 1 from dentro where nome in ('accogli_iscrizione', 'unisci_persone') and corpo like '%email_contatto%')
    and exists (select 1 from dentro where nome = 'indirizzo_ricevuta' and corpo not like '%email_contatto%')),
  ('100-nucleo.sql', 'il nucleo familiare sul database',
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'persone' and column_name = 'nucleo')
    and to_regprocedure('public.metti_nel_nucleo(uuid,uuid)') is not null
    and to_regprocedure('public.togli_dal_nucleo(uuid)') is not null
    and to_regprocedure('public.rendi_titolare(uuid)') is not null
    -- Rilanciare 45, 84, 95 o 99 dopo 100 rimette le funzioni senza il nucleo: la riga torna «da lanciare».
    and exists (select 1 from dentro where nome = 'unione_possibile' and corpo like '%nucleo%')
    and exists (select 1 from dentro where nome = 'accogli_iscrizione' and corpo like '%nucleo_di%')
    and exists (select 1 from dentro where nome = 'invia_iscrizione' and corpo like '%nucleo_di%')),
  ('101-iscritto.sql', 'l''area degli iscritti sul database',
    to_regclass('public.presenze_segnalate') is not null
    and to_regprocedure('public.iscritto_scheda(uuid)') is not null
    and to_regprocedure('public.iscritto_lezioni(uuid,date,date)') is not null
    and to_regprocedure('public.iscritto_presenze(uuid,integer)') is not null
    and to_regprocedure('public.iscritto_ricevute(uuid)') is not null
    and to_regprocedure('public.iscritto_nucleo(uuid)') is not null
    and to_regprocedure('public.iscritto_titolare(uuid)') is not null
    and to_regprocedure('public.iscritto_aggiunte(uuid)') is not null
    and to_regprocedure('public.iscritto_dati_del_nucleo(uuid)') is not null
    and to_regprocedure('public.iscritto_segnala(uuid,uuid,text)') is not null
    and to_regprocedure('public.iscritto_segnalate(uuid)') is not null
    -- Rilanciare 55 dopo 101 rimette il primo accesso senza gli iscritti: la riga torna «da lanciare».
    and exists (select 1 from dentro where nome = 'collega_utente' and corpo like '%iscritto%')),
  ('102-certificato-iscritto.sql', 'l''iscritto manda il suo certificato',
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'schede_iscritti' and column_name = 'certificato_in_attesa')
    and to_regprocedure('public.iscritto_manda_certificato(uuid,text)') is not null
    and to_regprocedure('public.conferma_certificato_iscritto(uuid,date)') is not null
    and to_regprocedure('public.rifiuta_certificato_iscritto(uuid)') is not null
    -- Rilanciare 45, 99 o 101 dopo 102 rimette le funzioni senza il file in attesa: la riga torna «da lanciare».
    and exists (select 1 from dentro where nome = 'pulisci_certificati' and corpo like '%certificato_in_attesa%')
    and exists (select 1 from dentro where nome = 'unisci_persone' and corpo like '%unisci_persone_0%')
    and exists (select 1 from dentro where nome = 'iscritto_scheda_di' and corpo like '%certificato_in_attesa_il%')),
  ('103-saldo-satispay.sql', 'il saldo della quota con Satispay',
    exists (select 1 from information_schema.columns where table_name = 'pagamenti_satispay' and column_name = 'saldo_di')
    and to_regprocedure('public.satispay_prepara_saldo(uuid,uuid)') is not null
    and to_regprocedure('public.satispay_saldo_stato(uuid,uuid)') is not null),
  ('104-importa-banca.sql', 'si può annullare in un colpo un''intera importazione dal file della banca',
    to_regprocedure('public.annulla_importazione_banca(timestamptz)') is not null),
  ('107-sito-accessibilita.sql', 'la Dichiarazione di accessibilità del sito, con la voce nel footer',
    exists (select 1 from sito_pagine where slug = 'dichiarazione-accessibilita' and di_legge)
    and exists (select 1 from sito_menu m join sito_pagine p on p.id = m.pagina_id where p.slug = 'dichiarazione-accessibilita' and m.dove = 'footer')
    and exists (select 1 from dentro where nome = 'salva_menu_sito' and corpo like '%pag.di_legge%')),
  ('116-satispay-separato.sql', 'Satispay separato dal Conto Corrente: cassa dal 2025, candidati solo in Satispay',
    exists (select 1 from casse where nome = 'Satispay' and dal <= date '2025-01-01')
    -- Il 132 riscrive queste funzioni senza candidati: vale anche il suo corpo.
    and exists (select 1 from dentro where nome = 'satispay_negozio_applica' and (corpo like '%from casse where nome = ''Satispay''%' or corpo like '%nel_versamento%'))
    and exists (select 1 from dentro where nome = 'satispay_scollega' and (corpo like '%c.nome = ''Satispay''%' or corpo like '%nel_versamento%'))),
  ('114-importazioni.sql', 'IMPORTAZIONI: gruppi Satispay, «Non è questo», movimenti della banca già scritti',
    to_regclass('public.banca_coperti') is not null
    and exists (select 1 from dentro where nome = 'banca_non_e_questo')
    -- Dal 132 Satispay non collega più movimenti: niente da tenere lontano dalla banca.
    and exists (select 1 from dentro where nome = 'satispay_scarico_stato' and (corpo like '%m.banca_chiave is null%' or corpo like '%''da_decidere'', ''[]''::jsonb%'))
    and exists (select 1 from dentro where nome = 'satispay_negozio_applica' and (corpo like '%m.banca_chiave is null%' or corpo like '%nel_versamento%'))),
  ('112-sito-accessibilita-agid.sql', 'la traccia della Dichiarazione di accessibilità ha le parti AgID (norma, data di redazione, tempo di risposta, segnalazione)',
    not exists (select 1 from sito_pagine
                 where slug = 'dichiarazione-accessibilita' and pubblicato is null
                   and bozza like '%Data dell’ultima verifica: [DA COMPILARE%' and bozza not like '%EN 301 549%')),
  ('109-privilegi-e-certificati.sql', 'anon e authenticated non possono svuotare le tabelle, e i file del certificato in attesa hanno un tetto',
    not exists (select 1 from pg_class c, unnest(array['anon', 'authenticated']) r, unnest(array['TRUNCATE', 'TRIGGER', 'REFERENCES']) p
                 where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') and has_table_privilege(r, c.oid, p))
    and exists (select 1 from pg_trigger where tgname = 'limita_file_certificato' and not tgisinternal)),
  ('110-tetto-certificato-messaggio.sql', 'il tetto ai file del certificato scatta con un codice suo (Storage lascia passare il testo) e solo per chi può caricare',
    exists (select 1 from dentro where nome = 'limita_file_certificato' and corpo like '%54000%' and corpo like '%iscritto_puo_mandare%')),
  ('111-iscrizione-troppo-grande.sql', 'una richiesta d''iscrizione enorme si rifiuta all''ingresso',
    exists (select 1 from dentro where nome = 'invia_iscrizione' and corpo like '%pg_column_size(dati)%')),
  ('113-genitore-non-iscritto.sql', 'la segreteria aggiunge il genitore non iscritto come titolare del nucleo dei figli',
    exists (select 1 from dentro where nome = 'aggiungi_genitore' and corpo like '%genitore_non_iscritto%')
    and exists (select 1 from pg_trigger where tgname = 'iscrizioni_togli_genitore_non_iscritto' and not tgisinternal)),
  ('115-carta.sql', 'si paga anche con la carta nel modulo di iscrizione (PayPal)',
    to_regprocedure('public.carta_esito(text, text)') is not null
    and exists (select 1 from dentro where nome = 'invia_iscrizione' and corpo like '%con la carta%')
    and to_regprocedure('public.pagamento_prima(text, uuid, text, text, text, text, uuid)') is not null),
  ('117-gare.sql', 'le gare, con la quota a voci, chi accompagna, gli atleti e l''incasso in CONTABILITÀ',
    exists (select 1 from dentro where nome = 'incassa_gara' and corpo like '%registra_pagamento_diretto%')
    and exists (select 1 from pg_trigger where tgname = 'gare_atleti_unione' and not tgisinternal)),
  ('118-chiusure.sql', 'le chiusure della palestra, che annullano le lezioni di un periodo e si tolgono',
    to_regclass('public.chiusure_lezioni') is not null
    and to_regprocedure('public.togli_chiusura(uuid)') is not null
    and exists (select 1 from pg_trigger where tgname = 'sessioni_in_chiusura' and not tgisinternal)),
  ('119-abbina-movimenti.sql', 'i movimenti non identificati propongono le persone anche dal genitore, dal codice fiscale e dall''importo',
    to_regclass('public.movimenti_codici_letti') is not null
    and exists (select 1 from dentro where nome = 'abbina_pagatori_movimento')
    and exists (select 1 from dentro where nome = 'abbina_testo_banca')),
  ('120-abbina-cognome-nome-corso.sql', 'i movimenti non identificati propongono le persone anche dal solo cognome e dal nome col corso',
    exists (select 1 from dentro where nome = 'abbina_pagatori_movimento' and corpo like '%nome e corso%')),
  ('121-punteggio-movimenti.sql', 'i movimenti non identificati scelgono la persona con un punteggio, e preselezionano solo il primo «sicuro»',
    exists (select 1 from dentro where nome = 'abbina_pagatori_movimento' and corpo like '%ci := array%')),
  ('122-avvisi-senza-quote.sql', 'una quota o un corso pagati dal telefono non sono un «pagamento senza richiesta»',
    exists (select 1 from dentro where nome = 'avvisi_da_mandare' and corpo like '%s.persona_id is null%')),
  ('123-quadratura-banca.sql', 'il saldo dell''estratto della banca mese per mese, per la quadratura del Conto Corrente',
    to_regclass('public.saldo_banca') is not null
    and exists (select 1 from pg_constraint where conname = 'saldo_banca_torna')
    and exists (select 1 from dentro where nome = 'saldo_banca_chi_verifica' and corpo like '%impronta_verifica := null%')),
  ('124-dominio-sale.sql', 'nessun tablet con l''email sul dominio vecchio (non registrato)',
    not exists (select 1 from auth.users u join postazioni p on p.utente_id = u.id where u.email ilike '%@sale.ods-corsi.it')),
  ('125-satispay-chiave.sql', 'il pagamento Satispay (e della carta) lo prende solo il browser che ha pagato',
    to_regprocedure('public.satispay_prepara_prima(uuid,text,text,text,text,uuid)') is not null
    and to_regprocedure('public.satispay_prepara_prima(uuid,text,text,text,text)') is null
    -- Rilanciare 83 o 115 dopo 125 rimette l'invia_iscrizione che non guarda la chiave: la riga torna «da lanciare».
    and exists (select 1 from dentro where nome = 'invia_iscrizione' and corpo like '%chiave_pag%')),
  ('126-metodi-pagamento.sql', 'i metodi di pagamento che la segreteria spegne (REGOLE → COME SI PAGA)',
    exists (select 1 from information_schema.columns where table_name = 'impostazioni' and column_name = 'metodi_spenti')
    and to_regprocedure('public.metodi_spenti()') is not null),
  ('127-verbali.sql', 'i verbali delle riunioni (VERBALI)',
    to_regclass('public.verbali') is not null
    and to_regprocedure('public.firma_verbale(uuid,date)') is not null),
  ('128-ricevuta-pagamento-perso.sql', 'la ricevuta non rifà i soldi di un pagamento a mano',
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'pagamenti_diretti' and column_name = 'chiave_ricevuta')
    and exists (select 1 from pg_trigger where tgname = 'ricevute_non_due_volte')
    and coalesce((select pg_get_functiondef(to_regprocedure('public.registra_pagamento_diretto(jsonb)'))), '') like '%creato_da, chiave_ricevuta%'),
  ('129-metodo-spento-nel-database.sql', 'un metodo di pagamento online spento lo ferma anche il database',
    exists (select 1 from pg_trigger where tgname = 'pagamenti_satispay_metodo_acceso' and tgrelid = 'public.pagamenti_satispay'::regclass)),
  ('131-quadratura-nel-database.sql', 'un mese della banca si verifica solo se torna, e torna da verificare se cambia il mese prima',
    exists (select 1 from dentro where nome = 'saldo_banca_regole' and corpo like '%Da classificare%')
    and exists (select 1 from pg_trigger where tgname = 'saldo_banca_mese_dopo')),
  ('132-satispay-solo-chi-ha-pagato.sql', 'lo scarico Satispay dice solo chi ha pagato: niente movimenti, la cassa Satispay chiusa',
    exists (select 1 from pg_trigger where tgname = 'movimenti_cassa_satispay_chiusa' and not tgisinternal)
    and exists (select 1 from dentro where nome = 'satispay_negozio_applica' and corpo like '%nel_versamento%')
    and exists (select 1 from dentro where nome = 'satispay_scarico_avvisa' and corpo like '%errore is null%')
    and exists (select 1 from voci_contabili where nome = 'Incassi Satispay'))
) as x(file, cosa, c)
order by file, cosa;
