# Percorsi critici

Cosa deve funzionare sempre, e cosa lo protegge. Lo tiene `garante-qualita`
(`.claude/agents/garante-qualita.md`). Un percorso è critico se, cadendo, si
perde o si sbaglia un dato, o la segreteria non riesce a lavorare.

**Prove** = script `prova:*` (app) e file di `supabase/prova/` (database, qui
solo col nome). Cosa controlla ogni prova lo dice la prova stessa.
**Collaudo** = va passato anche a mano con `collaudatore` quando cambia.

Ultimo audit completo: 2026-10-07, tutte le prove verdi. Le regole che nessuna
prova tiene stanno in «Scoperti», in fondo.

| Percorso | Chi | Se cade | Prove | Collaudo |
| --- | --- | --- | --- | --- |
| Quota associativa con Satispay dall'area iscritti | iscritto, titolare del nucleo, segreteria | importo diverso dal listino, quota pagata due volte o per un altro | `prova:quota-satispay`, `prova:edge`, `scripts/prova-iscritto-supabase.mjs`, `quota-satispay.sql` | sì |
| Corso con Satispay dall'area iscritti | iscritto, titolare del nucleo, segreteria | importo sbagliato, corso pagato due volte o per un altro | `prova:corso-satispay`, `prova:edge`, `scripts/prova-iscritto-supabase.mjs`, `corso-satispay.sql` | sì |
| Saldo della quota con Satispay dall'area iscritti | iscritto, titolare del nucleo, segreteria | resto calcolato male o pagato due volte, nucleo sbagliato | `prova:saldo-satispay`, `prova:satispay`, `prova:edge`, `saldo-satispay.sql` | sì |
| Iscrizione a passi (famiglia, minori, sconto, corsi senza prezzo) | genitore, segreteria | iscrizione persa o quota sbagliata | `prova:iscrizione-passi`, `prova:campi`, `prova:listino`, `prova:moduli`, `prova:fogli-moduli`, `prova:richieste`, `prova:ricevuta`, `prova:avvisi-segreteria`, `iscrizioni.sql`, `listino.sql`, `orari-aperti.sql`, `rls.sql` | sì |
| Aspetto del modulo di iscrizione | genitore | modulo illeggibile o col colore del sito sbagliato | `prova:iscrizione-sito`, `prova:campi`, `prova:iscrizione-pagina`, `prova:tema`, `prova:iscrizione-passi` | sì |
| Modulo di iscrizione da tastiera e a 320px | genitore, segreteria | chi usa la tastiera non riesce a iscriversi | `prova:accessibilita-iscrizione` | sì |
| Pagina pubblica `/iscrizioni/` | genitore, segreteria | richiesta mai inviata, prezzo diverso dal listino | `prova:iscrizione-pagina`, `prova:iscrizione-sito`, `prova:iscrizione-passi` | sì |
| Richieste e coda di approvazione | segreteria | richiesta persa | `prova:richieste`, `prova:segreteria`, `prova:coda`, `prova:certificati`, `prova:iscritti`, `prova:scheda-finestra`, `prova:iscrizione-pagina`, `iscrizioni.sql` | sì |
| Da dove arrivano le richieste (`?da=`) | genitore, segreteria | richiesta fermata da un'etichetta, conteggi sbagliati | `prova:richieste`, `prova:provenienza`, `prova:sito-genera`, `prova:sito-statistiche`, `provenienza-richieste.sql` | sì |
| Appello e presenze (anche senza rete) | istruttore | presenze perse | `prova:coda`, `prova:appello-cerca`, `prova:appello-ordine`, `prova:tablet`, `prova:colleghi`, `prova:segreteria`, `prova:testi`, `prova:etichette-lezione`, `prova:appello-liste`, `prova:frequenza`, `prova:cosa-manca`, `presenze-istruttori.sql`, `istruttori-dalle-lezioni.sql`, `tablet-conto-prove.sql`, `tablet.sql`, `presenze-finestra.sql`, `istruttore-collega.sql`, `accessi-piu-stretti.sql`, `rls.sql` | sì |
| Chiusura della palestra (lezioni annullate per un periodo, e tolte) | segreteria | presenze o appelli persi, lezione rimessa com'era sbagliata | `prova:chiusure`, `prova:cosa-manca`, `prova:segreteria`, `chiusure.sql` | sì, da fare |
| Segno COMPLEANNO su tablet e appello | tablet di sala, istruttore | data di nascita di un minore esposta | `prova:compleanni`, `prova:tablet`, `108-compleanni.sql` | sì |
| Ore degli istruttori | segreteria | compenso sbagliato | `prova:ore`, `prova:schede-personale`, `prova:timer-istruttori`, `prova:colleghi`, `prova:segreteria`, `presenze-istruttori.sql`, `presenze-finestra.sql`, `istruttore-collega.sql` | no |
| Compensi dei tecnici (tariffe, lettere, ricevute, pagamento) | segreteria, tecnici | compenso sbagliato, pagato due volte, IBAN visto da chi non deve | `prova:compensi`, `prova:tariffe`, `prova:schede-personale`, `prova:segreteria`, `prova:iscritti`, `prova:lettere`, `prova:pericolo`, `prova:fogli-moduli`, `prova:compensi-pagati`, `prova:contabilita`, `prova:bilancio`, `prova:movimenti-persona`, `prova:mcp`, `prova:colleghi`, `ricevute-compensi.sql`, `tariffe-tecnici.sql`, `anagrafiche.sql`, `lettere-incarico.sql`, `compensi-pagati.sql`, `contabilita.sql`, `chiusura-cassa.sql`, `movimenti-persona.sql`, `manca-la-firma.sql`, `istruttore-collega.sql`, `presenze-istruttori.sql` | sì |
| Ricevuta di compenso extra | segreteria, amministrazione, tecnici | ricevuta extra persa, cambiata dopo il pagamento | `prova:compensi-extra`, `scripts/prova-compensi-extra.mjs`, `compensi-extra.sql` | sì, da fare |
| Certificati medici | segreteria, iscritto | certificato perso o visibile a chi non deve | `prova:certificati`, `prova:dafare`, `prova:schede-iscritto`, `prova:segreteria`, `prova:segreteria-comune`, `prova:mcp`, `prova:gare`, `certificati.sql` | sì |
| Certificato mandato dall'iscritto | iscritto, segreteria | certificato di un altro, file sanitario visibile | `prova:certificato-iscritto`, `prova:dafare`, `prova:iscritto-supabase`, `prova:segreteria`, `certificato-iscritto.sql`, `109-privilegi-e-certificati.sql`, `movimenti-persona.sql`, `110-tetto-certificato-messaggio.sql` | sì |
| Striscia COSA MANCA | segreteria | un «a posto» falso | `prova:dafare`, `prova:cosa-manca`, `prova:certificati`, `prova:segreteria` | sì |
| Storico dei pagamenti | segreteria | pagamento che non compare o conta due volte | `prova:schede-iscritto`, `prova:pagamenti`, `prova:segreteria`, `pagamenti-diretti.sql` | sì |
| Ricevuta da un pagamento a mano | segreteria, amministrazione | incasso contato due volte o perso | `prova:pagamenti`, `prova:satispay`, `pagamento-una-volta.sql`, `pagamento-diventa-ricevuta.sql` | sì |
| Contanti di un giorno di cassa chiusa | segreteria, amministrazione | chiusura rotta senza che nessuno lo sappia | `prova:contabilita`, `prova:pagamenti`, `ricevuta-cassa-chiusa.sql` | sì |
| Ricevute e pagamenti | segreteria, amministrazione | quota o ricevuta sbagliata, ricevuta doppia | `prova:ricevuta`, `prova:segreteria`, `prova:pagamenti`, `prova:satispay`, `ricevute.sql`, `satispay.sql` | sì |
| Corsi da pagare | segreteria | corso scaduto che non si vede, sollecito a chi ha pagato | `prova:dafare`, `prova:corsi-da-pagare`, `prova:cosa-manca`, `prova:filtri-iscritti`, `prova:scheda`, `prova:sollecito`, `prova:tessere` | sì |
| Annuale a rate (la quota non è una rata) | segreteria, amministrazione | quota contata come rata, annuale scaduto non visto, versamento doppio | `prova:ricevuta`, `prova:corsi-da-pagare` | sì |
| Ricevuta per email alla famiglia | segreteria, amministrazione, famiglie | ricevuta all'indirizzo sbagliato o annullata che parte | `prova:ricevute-email`, `prova:edge`, `prova:cornice-mail`, `prova:avvisi-segreteria`, `ricevute-email.sql` | sì |
| Documenti sulla carta intestata | segreteria, amministrazione, genitore | cifra coperta, voci perse fra le pagine | `prova:carta`, `prova:ricevuta`, `prova:compensi`, `prova:bilancio`, `prova:chiusura-pdf`, `prova:ore` | sì |
| Satispay dal modulo di iscrizione | genitore, segreteria, amministrazione | importo diverso dal listino, pagato perso o doppio | `prova:satispay`, `prova:edge`, `satispay.sql` | sì |
| Satispay: prima paghi, poi mandi | genitore, segreteria, amministrazione | soldi presi e richiesta che non arriva | `prova:satispay`, `satispay.sql` | sì |
| Carta dal modulo di iscrizione (PayPal) | genitore, segreteria, amministrazione | soldi senza richiesta, pagato due volte, importo sbagliato, dati della carta | `prova:pagamento-carta`, `prova:paypal-cattura`, `prova:satispay`, `prova:csp`, `prova:contabilita`, `carta.sql`, `satispay.sql`, `contabilita.sql` | sì |
| Scarico automatico Satispay in CONTABILITÀ | amministrazione, segreteria | incasso nella cassa sbagliata, doppio o perso | `prova:satispay-scarico`, `prova:importazioni`, `prova:avvisi-segreteria`, `prova:contabilita`, `prova:segreteria`, `satispay-scarico.sql`, `importazioni.sql`, `116-satispay-separato.sql`, `avvisi-scarico-satispay.sql`, `update-con-where.sql` | sì |
| Tessere | segreteria | non tesserato che frequenta, tessera alla persona sbagliata | `prova:tessere`, `prova:cosa-manca`, `prova:indirizzi`, `prova:filtri-iscritti`, `prova:menu`, `tessere.sql` | sì |
| Ordini di vestiario | genitore, segreteria | ordine perso, totale sbagliato | `prova:vestiario`, `vestiario.sql`, `rls.sql` | sì |
| Gare: chi ci va, certificato | segreteria, istruttore, iscritto | certificato scaduto alla gara visto come valido; atleta sbagliato | `prova:gare`, `gare.sql` | sì, da fare |
| Gare: quota a voci e incasso | segreteria, amministrazione | quota sbagliata, incasso due volte, pagato che cambia con le voci | `prova:gare`, `gare.sql` | sì, da fare |
| Gare: chi le vede | segreteria, istruttore, iscritto, titolare del nucleo | gara o atleti visti da chi non deve, figlio di un altro nucleo | `prova:gare`, `gare.sql` | sì, da fare |
| Firma e informativa | iscritto | consenso non valido | `prova:firma`, `prova:firma-tratti`, `prova:informativa`, `prova:moduli`, `prova:fogli-moduli`, `informativa-mesi.sql` | sì |
| Importazione persone da CSV | segreteria | persona persa, duplicata o scritta male | `prova:importa` | no |
| Anagrafiche, nuclei, doppioni | segreteria | persone duplicate o unite male | `prova:iscritti`, `prova:filtri-iscritti`, `prova:cerca-persone`, `prova:email-unica`, `prova:segreteria`, `prova:ricevute-email`, `prova:importa`, `anagrafiche.sql`, `non-doppioni.sql`, `unisci-doppioni.sql`, `cerca-persone.sql`, `email-unica.sql` | no |
| Nucleo familiare | segreteria | figlio nel nucleo di un altro, titolare minorenne | `prova:nucleo`, `nucleo.sql` | sì |
| Genitore non iscritto, titolare del nucleo dei figli | segreteria, genitore | genitore contato come iscritto o come quota da pagare; figlio senza titolare | `prova:nucleo`, `prova:filtri-iscritti`, `prova:cosa-manca`, `prova:sollecito`, `genitore-non-iscritto.sql`, `nucleo.sql` | sì |
| Area degli iscritti sul database | iscritto, titolare di un nucleo, segreteria | un iscritto che vede un altro | `prova:iscritto-supabase`, `iscritto.sql`, `certificato-iscritto.sql`, `segreteria.sql` | no |
| Entra con Google (iscritti) | iscritto, personale | entrare con l'account di un altro | `prova:iscritto-supabase` | sì |
| Entra con Google (istruttori e segreteria) | istruttore, segreteria | Google estraneo collegato in silenzio | `prova:accesso-google` | no, da fare con un account vero |
| Pagina dell'iscritto a tab | iscritto, titolare di un nucleo | segno di regola falso, nucleo visto da chi non deve | `prova:area-tab`, `prova:iscrizione-sito` | sì |
| Presenza segnalata dall'iscritto | iscritto, istruttore, segreteria | segnalazione persa o fuori regola che passa | `prova:iscritti`, `prova:area-tab`, `iscritto.sql` | sì |
| Ricerca universale di segreteria | segreteria | persona non trovata, scheda sbagliata, «in regola» falso | `prova:ricerca`, `prova:indirizzi`, `prova:a11y-segreteria`, `prova:menu` | sì |
| Accesso e ruoli (PIN, RLS) | tutti | dati visti da chi non deve | `prova:segreteria`, `prova:ruoli`, `prova:banco`, `rls.sql`, `109-privilegi-e-certificati.sql`, `segreteria.sql`, `elimina-istruttore.sql`, `email-unica.sql` | sì |
| Scheda del personale (schede e «Altro») | segreteria | accesso tolto o persona eliminata per sbaglio, dati visti da chi non deve | `prova:schede-personale`, `prova:ruoli`, `prova:segreteria`, `prova:pericolo`, `disattiva-chiude-iscrizioni.sql`, `elimina-istruttore.sql` | sì |
| Ruolo «amministrazione» | amministrazione, segreteria | persone viste da chi tiene solo i conti | `prova:menu`, `prova:ruoli`, `prova:pagamenti`, `prova:segreteria`, `amministrazione.sql`, `rls.sql`, `elimina-istruttore.sql` | sì |
| Contabilità (movimenti, chiusure, voci, prima nota) | amministrazione | residuo che non torna, giorno chiuso riscritto | `prova:contabilita`, `prova:indirizzi`, `prova:banco`, `prova:avvisi-segreteria`, `prova:segreteria`, `prova:chiusura-pdf`, `prova:importa-prima-nota`, `prova:pericolo`, `chiusura-cassa.sql`, `contabilita.sql`, `rls.sql`, `importa-prima-nota.sql`, `cambia-voce.sql`, `prova:gare` | sì |
| Importa dalla banca | amministrazione | movimento perso o scritto due volte, voce o persona sbagliata | `prova:importa-banca`, `prova:importazioni`, `prova:abbina-movimenti`, `importa-banca.sql`, `importa-prima-nota.sql`, `importazioni.sql`, `abbina-movimenti.sql`, `cambia-voce.sql` | sì |
| Quadratura del Conto Corrente con l'estratto BancoPosta | amministrazione (scrive e verifica), segreteria (non la vede) | saldo sbagliato, mese «verificato» che non torna, saldo visto da chi non deve | `prova:quadratura`, `prova:importa-banca`, `quadratura-banca.sql` | sì, da fare |
| Importazioni: Satispay e banca sullo stesso movimento a mano | amministrazione | stesso incasso contato due volte, o perso | `prova:importazioni`, `prova:satispay-scarico`, `prova:importa-banca`, `importazioni.sql`, `satispay-scarico.sql`, `importa-banca.sql` | sì |
| Voci da classificare in IMPORTAZIONI | amministrazione | voce persa dalla lista, totale sbagliato | `prova:importazioni`, `prova:suggerimento-movimento` | sì, da fare |
| Movimenti dello storico collegati alla persona | amministrazione (scrive), segreteria (vede lo storico della scheda) | movimento sulla persona sbagliata | `prova:movimenti-persona`, `prova:segreteria`, `prova:contabilita`, `quote-persona.sql`, `movimenti-persona.sql` | sì |
| Quote e corsi scritti a mano hanno la persona | amministrazione (scrive), segreteria (vede la scheda) | quota che non si ritrova nella scheda | `prova:contabilita`, `prova:movimenti-persona`, `prova:segreteria`, `prova:suggerimento-movimento`, `quote-persona.sql`, `cambia-voce.sql`, `movimenti-persona.sql` | sì |
| Movimento da classificare: voce (anche dall'importo) e persona proposte | amministrazione (conferma), segreteria | persona o voce sbagliata scritta con un clic | `prova:suggerimento-movimento`, `prova:abbina-movimenti`, `prova:importa-banca`, `abbina-movimenti.sql` | sì, da fare |
| Filtro «Pagato nel vecchio programma» | segreteria | segnato pagato per un incasso non suo | `prova:pagato-prima`, `prova:filtri-iscritti`, `pagato-vecchio-programma.sql` | sì |
| Bilancio di un anno | amministrazione | movimento contato in due anni o in nessuno | `prova:bilancio` | sì |
| Fatture dalla chat con Claude | amministrazione | movimento doppio o mai scritto, dati personali verso Claude | `prova:mcp`, `movimenti-dalla-chat.sql`, `contabilita.sql` | sì |
| Conti letti dalla chat con Claude | amministrazione | totale diverso da BILANCIO, nomi verso Claude | `prova:mcp`, `prova:bilancio`, `prova:contabilita`, `prova:segreteria` | sì |
| Segreteria dalla chat con Claude (spenta) | segreteria | dati di un minore verso Claude | `prova:mcp`, `prova:frequenza`, `prova:segreteria`, `prova:certificati`, `75-chat-segreteria.sql`, `finto-supabase.sql` | sì, quando si accende |
| Il token di Claude solo dalla sua porta | tutti | token che legge persone o certificati | `prova:mcp`, `claude-dalla-porta.sql`, `rls.sql`, `contabilita.sql` | sì |
| Elenco ISCRITTI | segreteria | un guaio in elenco, un minore contato da adulto, famiglia fuori filtro | `prova:iscritti`, `prova:filtri-iscritti`, `prova:pagato-prima` | sì |
| Tab ISCRITTI nella scheda del corso | segreteria | iscritto mancante, «a posto» falso | `prova:iscritti-corso`, `prova:indirizzi` | sì |
| Calendario e date dei corsi | segreteria, tablet | lezione che non compare | `prova:indirizzi`, `prova:calendario`, `prova:segreteria`, `calendario*.sql`, `date-corsi.sql` | no |
| Prove (modalità prova) e statistiche | segreteria | numeri sbagliati | `prova:prove`, `prova:segreteria`, `prova:filtri-iscritti`, `prove.sql`, `prove-per-nome.sql`, `statistiche.sql` | no |
| Segnalazioni | tutti | problema segnalato che sparisce | `prova:segreteria`, `segnalazioni.sql`, `attivita.sql` | no |
| Backup del database | utente | niente da ripristinare | `scripts/prova-backup.mjs`, `prova:impostazioni` | no |
| Esporta i dati di una persona | segreteria | file incompleto o con i dati di un altro | `prova:scheda-iscritto`, `prova:segreteria`, `prova:richieste`, `prova:compensi`, `prova:lettere` | sì |
| Modifiche non salvate | segreteria, amministrazione | modifica persa senza avviso | `prova:scheda-finestra` | sì |
| Musica, timer, tablet di sala | istruttore, sala | lezione senza timer o musica | `prova:musica`, `prova:timer-istruttori`, `prova:segreteria`, `prova:musica-file`, `prova:tablet`, `prova:scaletta`, `prova:strumenti`, `prova:anteprima`, `prova:discipline`, `musica.sql`, `categorie-esercizi.sql`, `discipline.sql`, `timer.sql`, `timer-lezioni.sql`, `tablet.sql` | sì |
| Il Banco | segreteria | un guaio che non si vede | `prova:banco`, `prova:ruoli` | sì |
| Scheda dell'iscritto a quattro schede | segreteria | un guaio nascosto su una scheda chiusa | `prova:scheda-iscritto`, `prova:schede-iscritto`, `prova:scheda` | sì |
| COSA MANCA nella scheda dell'iscritto | segreteria | ricevuta bloccata senza CF, minore trattato da adulto | `prova:scheda-persona`, `prova:segreteria`, `prova:ricevuta` | sì |
| Aspetto della segreteria e dell'amministrazione | segreteria, amministrazione | colori illeggibili, aspetto diverso dal sito | `prova:look`, `prova:menu`, `prova:banco`, `prova:sito-aspetto`, `prova:testi`, `prova:etichette-lezione`, `prova:segreteria`, `prova:richieste`, `prova:ricevuta`, `prova:pagamenti`, `prova:tessere`, `prova:certificati`, `prova:sito`, `prova:tema`, `prova:icone`, `scripts/prova-look.mjs` | sì |
| Aspetto dell'area istruttori | istruttore | stato dell'appello letto male | `prova:istruttori-look`, `prova:look`, `prova:coda`, `prova:appello-cerca`, `prova:timer-istruttori`, `prova:icone` | sì |
| Aspetto dei tasti del tablet di sala | sala, istruttore | un tasto che si legge come un altro | `prova:look`, `prova:tablet`, `prova:coda`, `prova:musica`, `prova:icone` | sì |
| Aspetto dell'area iscritti | genitore, iscritto | tasto illeggibile o spento che sembra acceso | `prova:look`, `prova:icone` | sì |
| Tasti che tolgono in segreteria | segreteria, amministrazione | dati tolti senza conferma | `prova:pericolo`, `prova:scheda-iscritto`, `prova:ricevuta`, `prova:pagamenti`, `prova:certificati`, `prova:vestiario`, `prova:tessere`, `prova:contabilita`, `prova:segreteria`, `disattiva-chiude-iscrizioni.sql` | sì |
| Sito pubblico: solo quello che è pubblicato | visitatore del sito, segreteria | bozza in pubblico, link `javascript:` | `prova:sito`, `prova:sito-titoli`, `prova:sito-accedi`, `prova:sito-genera`, `prova:sito-immagini`, `prova:sito-pubblica`, `prova:sito-social`, `prova:sito-aspetto`, `prova:sito-tessere`, `prova:sito-collage`, `prova:sito-scala`, `prova:sito-home-nuova`, `prova:sito-home-aspetto`, `prova:sito-corsi-nuova`, `prova:sito-home`, `prova:sito-corso-nuovo`, `prova:sito-corso`, `prova:sito-pezzi`, `prova:sito-orario`, `prova:sito-contatti`, `prova:sito-istruttori`, `prova:sito-fasce`, `sito.sql`, `rls.sql`, `sito-immagini.sql`, `sito-pezzi.sql` | sì |
| Chi siamo del sito | visitatore del sito, segreteria | paragrafo perso, regole su un'altra pagina | `prova:sito-chi-siamo-nuova`, `prova:sito-chi-siamo`, `prova:sito-genera`, `prova:sito-home-nuova` | sì |
| Orario delle pagine corso del sito | visitatore del sito, genitore che sta per iscriversi, segreteria | orario sbagliato o vecchio sul sito | `prova:sito-orario`, `sito-orario.sql` | sì |
| Invito «Iscriviti» in fondo alle pagine | visitatore del sito, segreteria che scrive le pagine | pulsante che non porta al modulo | `prova:sito-genera`, `prova:sito-pezzi`, `prova:sito-aspetto`, `prova:sito-contatti` | sì |
| Parti PULSANTI e DOMANDE dell'editor | visitatore del sito, genitore, segreteria che scrive le pagine | pulsante che porta altrove, HTML nel sito | `prova:sito-pezzi`, `prova:sito-orario` | sì |
| Pagina Istruttori del sito | visitatore del sito, segreteria che scrive la pagina Istruttori | ordine delle tessere diverso dall'editor | `prova:sito-istruttori`, `prova:sito-pezzi` | sì |
| Un editor solo per le pagine del sito | segreteria che scrive e pubblica le pagine, visitatore del sito | pagina che non si pubblica, parte persa | `prova:sito-pezzi`, `prova:iscrizione-sito`, `prova:testi` | sì |
| Barra «Prova a 5 € / Chiama» sul telefono | visitatore del sito dal telefono | tasto che non si trova o copre il menu | `prova:sito-home-nuova` | sì |
| Recensioni della Home nuova | visitatore del sito, segreteria | recensione persa o senza firma | `prova:sito-home-nuova`, `prova:sito-home-aspetto` | sì |
| Pagina «Orari» del sito | visitatore del sito, segreteria | orari sbagliati, dati riservati ad `anon` | `prova:sito-orari`, `orari-sito.sql`, `rls.sql` | sì |
| Contatore delle visite del sito | visitatore del sito, segreteria | codice iniettato, pubblicazione ferma | `prova:sito-statistiche`, `prova:sito-pubblica` | no |
| IL SITO in STATISTICHE | segreteria | chiave esposta, numeri sbagliati | `prova:statistiche-sito` | no |
| DAL SITO ALLE RICHIESTE in STATISTICHE | segreteria | numero sbagliato in silenzio | `prova:fila-sito` | no |
| Avvisi per email alla segreteria | segreteria | richiesta o pagamento che non si vede arrivare | `prova:avvisi-segreteria`, `prova:cornice-mail`, `prova:ricevute-email`, `avvisi-segreteria.sql` | sì |
| COME SI PAGA in REGOLE | segreteria, chi si iscrive, iscritto | metodo spento ancora offerto o aggirato, pagamento fatto che sparisce | `prova:metodi-pagamento`, `prova:impostazioni`, `prova:edge`, `metodi-pagamento.sql`, `metodo-spento-nel-database.sql` | sì, da fare |
| Verbali delle riunioni (firma, rettifica, PDF) | segreteria, direttivo | verbale firmato cambiato, PDF perso, numero doppio, dati visti da chi non deve | `prova:verbali`, `verbali.sql` | sì, da fare |
| Sollecito su WhatsApp | segreteria, famiglia | importo sbagliato chiesto, messaggio al minore | `prova:scheda-iscritto`, `prova:sollecito`, `prova:filtri-iscritti`, `solleciti.sql` | sì |

## Scoperti

Regole che si possono rompere senza che una prova cada. Si toglie la riga
quando arriva la prova.

- Annuale a rate: il tetto di 3 rate (`troppe`) si dice ma non blocca l'emissione, e `emetti_ricevuta` non ha la regola; nessuna prova SQL.
- **GRAVE** — Stesso movimento a mano per un pagamento Satispay e per una riga
  della banca: nessuna prova lo impedisce, né in app né nel database.
- **GRAVE** — Ricevuta da un pagamento a mano: un `pagamentoId` perso per
  strada non fa cadere niente, e lo stesso incasso conta due volte.
- **GRAVE** — Quadratura: un mese «verificato» resta tale se cambia il saldo
  iniziale che gli arriva dal mese prima (una riga di settembre, il saldo del
  conto): l'impronta copre solo le righe del mese. Nessuna prova.
- **GRAVE** — Quadratura: riscrivere il saldo nel percorso Supabase
  (`scriviSaldoBanca`) toglie la verifica con `verificato_il: null`, ma nessuna
  prova lo tiene: tolto, la prova resta verde. Il database non lo fa da sé.
- **GRAVE** — Quadratura: `verificaMeseBanca` (prova e Supabase) non chiede
  differenza 0 né «Da classificare»: la regola sta nel pulsante disabilitato di
  `Contabilita.tsx`. Nessuna prova.
- **GRAVE** — Quadratura: `scriviSaldoBanca` (Supabase) non chiama
  `cosaNonVaSaldoBanca`: mese futuro e numeri che non tornano li ferma solo il
  `.tsx` (il database ferma i numeri, non il mese). Nessuna prova sul percorso
  Supabase.
- Quadratura: `revoke` su `saldo_banca_chi_verifica()` (123) senza prova: nessun
  controllo che anon e authenticated non abbiano EXECUTE (DA FARE).
- COMPENSI (`Compensi.tsx`): il doppio clic su «C'era», «Non c'era» e «Segna
  firmata» è bloccato per tutto l'elenco. Senza prova (serve il browser): a mano.
- Edge Function `paypal`: la cattura è provata (`prova:paypal-cattura`); restano
  senza prova prepara, la creazione dell'ordine e la rilettura dello stato.
- Carta: la richiesta del browser non contiene campi della carta
  (`CampiCarta.tsx`, `ModuloIscrizione.tsx`): nessuna prova. Il database non ha
  colonne per la carta, ma è l'unica metà coperta.
- `prova-csp.mjs`: il filtro «paypal|google|apple» è largo, un host che lo
  contiene passa. Va stretto agli host esatti.
- `update-con-where.sql`: il controllo cerca un WHERE dopo l'UPDATE, nello
  stesso `;`. Un UPDATE senza WHERE con una sottoquery che ha il suo WHERE
  (`set x = (select … where …)`) passa (DA FARE).
- Edge Function `satispay` (quota, corso, saldo) e quella delle ricevute per
  email: nessuna prova.
- Saldo Satispay: `least`/`greatest`, `ricevuta_id is null`, `utente_id`, le
  date `dal`/`al` si possono togliere senza che una prova cada.
- Compensi: `tenuti` in `anagraficaDi` (IBAN e province), `cosaNonVaLettera`,
  `lettereDellaScheda` con `sostituitaIl`, il tetto di 100.000 € in
  `paga_compensi`, `bastaUno` in `segreteriaSupabase.ts`.
- «Vince il più recente» in `unisci_persone` e `segreteriaProva.ts`.
- Certificati: il lucchetto del tetto con due invii insieme;
  `chiCertificatiRicevuti`.
- Corsi da pagare: la lettura di `vociCorsi` da Supabase.
- Nucleo: titolare minorenne scritto con un `update` diretto (trigger
  `persone_nucleo_regole`).
- `riprendiDaGoogle`.
- Area a tab: `conEsci` e `puo` stanno nel `.tsx`; il segno non guarda i corsi
  scaduti.
- `cosaNonVaSegnalata`: «annullata» e «oltre 30 giorni», lato app.
- Ricerca: Esc di `useDialogo`; un corso disattivato (`c.attivo`) nei
  risultati.
- Vestiario: la metà Supabase (`vestiarioDati.ts`).
- Scarico Satispay: i casi DA DECIDERE e `statoScarico`.
- `banca_segna_coperti`: la stessa chiave con un altro `conId` non si
  aggiorna (`on conflict do nothing`), e nessuna prova lo tiene.
- Listino: `saldoEntro`, e `some` al posto di `every` sull'annuale.
- Avvisi: 50 richieste finte spengono gli avvisi (scelta dell'utente).
- Striscia: `useDaFare` e la regola degli appelli («cominciata» o «finita»).
- Elenco ISCRITTI: la frase col conto dei minorenni e dei senza data, e il
  segno MINORENNE sulla riga, stanno nel `.tsx`; nessuna prova.
- Da classificare: BILANCIO conta anche le voci senza voce (`voce` null) e
  IMPORTAZIONI no; nessuna prova dice quale conteggio è giusto (DA FARE).
- Suggerimento da classificare: uno storico (`origineImport` «prima-nota:»)
  senza voce proposta riceve i candidati; nessuna prova lo ferma (DA FARE).
- Suggerimento da classificare: il nome già presente nel cognome («Maria M.»
  con «Maria Maria») non è provato (DA FARE).
- Suggerimento da classificare: persona proposta ma nessuna voce (voce
  della regola spenta): `confermaDi` deve dare `null`; dopo la voce dall'importo
  nessuna prova lo asserisce (DA FARE).
- Suggerimento da classificare: `Contabilita.tsx` non propone finché il
  listino non è caricato (`listino === null`); nessuna prova (DA FARE).
- Suggerimento da classificare: «scrive solo alla conferma» sta in
  `Contabilita.tsx`; nessuna prova, solo collaudo a mano.
- Suggerimento da classificare: oltre otto candidati il nono manca, e «più
  candidati» non lo dice; il tetto è provato (`abbina-movimenti.sql`,
  `prova:abbina-movimenti`), il messaggio no.
- Suggerimento da classificare: il caricamento in `Contabilita.tsx` (listino
  assente → solo importo escluso; nessun abbinato → ricerca per nome) sta nel
  `.tsx`; nessuna prova, solo collaudo a mano.
- Importa dalla banca: le righe di `ImportaBanca.tsx` (chip, «È nuova», ✓
  della persona) e il giro di `cambiaVoceMovimenti` dopo l'importazione:
  solo collaudo a mano. Il piano e le scelte hanno le loro prove.
- Suggerimento da classificare: `ImportaBanca.tsx` (al massimo trenta
  richieste; «Conferma quelli che sembrano giusti» scrive) sta nel `.tsx`:
  solo collaudo a mano.
- Suggerimento da classificare: la traduzione verso il database
  (`codiceFiscaleLetto` → `codice_fiscale_letto`, `gia_iscritto` →
  `giaIscritto`) sta in `segreteriaSupabase.ts`; le due metà sono provate, il
  passaggio no.
- Genitore non iscritto: «N persone attive» in testata all'elenco lo salta
  (`attiveOra`, nel `.tsx`); nessuna prova.
- Scheda del personale: la conferma di «Togli l’accesso» e il tasto Elimina
  (`accesso` ed `elimina` in `Scheda`, `Personale.tsx`) stanno nel `.tsx`; le
  voci del menù vengono da `vociAltro` e la prova le tiene, la conferma no.
- Gare: la lista della segreteria con un id gara due volte (warning React di
  chiave doppia): causa non trovata; nessuna prova.
- Gare: il nome può arrivare a 200 caratteri, il database ne accetta 120: il
  salvataggio cade con il testo grezzo del database.
- Gare: voci, importi sopra 100.000 € e date fuori dal 2000–2100 non li ferma
  l'app prima del database: nessuna prova.
- Gare: «LE MIE GARE» passa a `leMieGare` solo la scheda dell'iscritto, non
  quella dei figli del nucleo (CRITERI 19 e `iscritto_puo_vedere` dicono altro):
  da verificare, nessuna prova.
- Gare: l'elenco PDF (`elencoGaraPdf.ts`) non ha prova: né le colonne, né che
  non esca nessun dato del genitore.
- Gare: l'incasso dà una riga sola «Gare» col totale in ricevuta: nessuna prova
  (`prova:gare` guarda solo la voce del pagamento).
- Gare: la striscia della scheda (DA INCASSARE nascosto se annullata o senza
  quota) sta nel `.tsx`; `contiGara` per una annullata conta lo stesso i
  «da pagare». Nessuna prova.
- Gare: «non ancora disponibile» finché `117-gare.sql` non è lanciato: nessuna
  prova.
- Gare: `gareDellaSettimana` è provata, il collegamento in `Settimana.tsx` no.

- Tasti grandi del tablet: `Tablet.tsx` e `TabletPin.tsx` usano `TRATTO_TABLET`,
  ma `prova:icone` controlla solo la costante. Il tratto a 1,75 passa tutte le
  prove (DA FARE).
- Icona dei tasti di segreteria: `prova:icone` controlla che il nome sia in
  `iconaAzione` e che il tasto passi da `Tasto`, non che l'icona compaia
  (DA FARE).

## Come si aggiorna

- Funzione nuova o percorso nuovo: una riga, nello stesso PR.
- Problema corretto: la prova che lo teneva fuori entra nella colonna Prove, e
  il buco esce da «Scoperti».
- Prova rimossa o rinominata: la riga si corregge.
- Una riga resta una riga: percorso, chi, cosa si rompe, i nomi delle prove.
  Niente date, rami, PR o storia: quelli stanno in `git log`. `npm run -s
  prova:registro` controlla righe corte e prove che esistono.
