# Chiusura della palestra · criteri di accettazione (approvati il 2026-10-25)

Dalle risposte dell'utente (1–12) e dal design approvato (13–20). Opzioni prese: la
chiusura si ricorda anche per le lezioni non ancora in calendario; si annulla tutto,
anche con appello o prova; il passato si può chiudere con un avviso; le straordinarie
si annullano e si contano a parte; si riapre dall'elenco delle chiusure; i compensi
non cambiano (le annullate ne escono già); al massimo un anno; chiude tutta la
segreteria; una straordinaria aggiunta in un giorno chiuso nasce PREVISTA.

1. In SETTIMANA, «Chiusura dal… al…» chiede DAL, AL (compreso) e la sala (tutte o una). Senza DAL o AL, o con AL prima di DAL, non si conta niente e dice cosa manca. Oltre un anno (AL > DAL + 1 anno) lo rifiuta, nell'app e nel database.
2. Prima di chiudere si contano le lezioni: quelle del periodo non già annullate, del giorno in ora italiana (Europe/Rome), della sala scelta (o di tutte). Contare non cambia niente.
3. La conferma dice il periodo in lettere («dal 24 dicembre al 6 gennaio»), quante lezioni si annullano e, a parte, quante sono straordinarie.
4. Le lezioni con appello (almeno una presenza) o con una prova si annullano lo stesso: la conferma le elenca con corso e giorno. Le presenze e le prove restano salvate.
5. Le lezioni già annullate non si contano e non si toccano. Le gare non si toccano.
6. Se il periodo comincia prima di oggi, la conferma lo dice (cambia lo storico); chiudere si può lo stesso.
7. Chiudere annulla tutte le lezioni contate e ricorda la chiusura, con quali lezioni ha annullato e com'erano prima.
8. Le lezioni dell'orario create dopo (il calendario che si allunga, «Rigenera adesso») in un giorno chiuso, della sala chiusa o con la chiusura di tutte le sale, nascono già annullate e si legano alla chiusura.
9. Una straordinaria aggiunta a mano in un giorno chiuso nasce PREVISTA; l'app avvisa «La palestra è chiusa quel giorno».
10. Se il periodo va oltre la data fino a cui il calendario è pronto, il dialogo dice quali giorni le lezioni nasceranno già annullate.
11. «Togli la chiusura» rimette com'erano le lezioni annullate da quella chiusura (con le presenze che avevano) e cancella la chiusura. Quelle annullate a mano, prima o dopo, restano annullate; una lezione legata alla chiusura e poi rimessa a mano non cambia.
12. Chiude e toglie chi è staff (e_staff). Un istruttore non staff, un iscritto o anon: il database rifiuta lettura delle chiusure, chiusura e togli.
13. Le chiusure si leggono: dal, al, sala, quante lezioni.
14. In ogni settimana che tocca una chiusura, sopra la griglia: «CHIUSA · Dal 24 dicembre al 6 gennaio · Tutte le sale» (o il nome della sala) con TOGLI LA CHIUSURA.
15. Dopo la chiusura l'avviso dice «Chiusa dal 24 dicembre al 6 gennaio: 39 lezioni annullate.».
16. Il dialogo elenca le CHIUSURE GIÀ DECISE, ognuna con TOGLI.
17. Togliere chiede conferma: «Togliere la chiusura dal … al …?», dice quante lezioni tornano e che gli iscritti non vengono avvisati.
18. Modalità prova: stesse regole (conto, annullo, lezioni create dopo, togli), senza rete.
19. Finché 118-chiusure.sql non è lanciato: il tasto dice «non ancora disponibile», le altre schermate funzionano.
20. Gli iscritti non vengono avvisati: la conferma lo dice.
