# Gare · criteri di accettazione (approvati il 2026-10-25)

Dall'analista (1–13) e dal design approvato (14–22). Opzioni prese: la segreteria
scrive, l'istruttore legge, l'iscritto vede le sue gare; il certificato si controlla
solo per scadenza, all'ultimo giorno della gara, e avvisa senza bloccare; la tessera
non si controlla; un solo elenco di atleti; niente risultati né categorie.

1. La segreteria crea una gara con nome e data (obbligatori), luogo, indirizzo, organizzatore, note facoltativi. Senza nome o data il salvataggio non parte e dice cosa manca. Compare tra le future con 0 atleti.
2. Una gara passata non si cancella. Una gara annullata resta in elenco come «annullata».
3. Elenco: prima le future per data crescente, poi le passate dalla più recente.
4. Si aggiungono solo iscritti attivi, una volta sola (riaggiungere non duplica). Un archiviato non compare nella ricerca.
5. Chi è archiviato dopo la gara resta nell'elenco di quella gara.
6. Il certificato si guarda alla data della gara: scade il 1 marzo, gara il 14 marzo → «scaduto» per la gara, anche se oggi vale.
7. Un certificato mandato dall'iscritto e non confermato vale come non valido per la gara.
8. L'aggiunta di un atleta senza certificato valido riesce; la riga in testa conta «N atleti senza certificato valido».
9. Per un minore nessun dato del genitore nell'elenco della gara.
10. L'istruttore legge e non scrive; senza ruolo (anon) il database rifiuta lettura e scrittura.
11. Modalità prova: gare di esempio in archivioProva.ts (una passata, una vicina, una annullata), stesse regole.
12. Finché 113-gare.sql non è lanciato: «non ancora disponibile», le altre schermate funzionano.
13. Unendo due schede iscritte alla stessa gara resta una sola iscrizione.
14. Più giorni: DAL obbligatorio, AL facoltativo e non prima di DAL; il certificato si controlla all'ultimo giorno (AL se c'è). Date dette «sabato 14 e domenica 15 novembre 2026».
15. Quota a voci (voce, importo > 0): il totale a atleta è la somma. Senza voci la gara non ha quota.
16. Ogni atleta paga tutte le voci. Incassato e «da pagare» per gara: chi ha pagato non cambia se poi le voci cambiano (il pagamento registra importo e voci di quel momento).
17. Incassa: il pagamento entra in CONTABILITÀ (Cassa Contanti se contanti, se no Conto Corrente; voce «Gare») e, se spuntato, con la ricevuta, una riga per voce.
18. Istruttori che accompagnano (anche più di uno): leggono la gara anche se non insegnano il corso degli atleti. L'istruttore legge le gare dei suoi corsi e quelle che accompagna, non le altre.
19. L'iscritto vede nella sua area solo le gare in cui è, con le voci e quanto deve; non vede gli altri atleti.
20. La gara compare nella settimana del calendario della segreteria, sui giorni che copre.
21. LUOGO e ORGANIZZATORE propongono i valori delle gare già inserite, dal più usato, che cominciano o contengono quel che si scrive.
22. INDIRIZZO: suggerimenti da Google Places se c'è la chiave, se no si scrive e basta; con l'indirizzo la gara mostra il link alla mappa.
