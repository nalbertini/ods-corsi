# Sito senza i pulsanti «Scrivici»

COSTRUITO (approvato dall'utente, ora lo descrive la libreria: `SitoTestata`). Le tavole «oggi» mostrano com'era.

| Tavola | Cosa è |
|---|---|
| 1 · Testata oggi (1440) | «Iscriviti» giallo e «Scrivici» a linea; Contatti non è nel menu |
| 2 · Testata proposta (1440) | Solo «Iscriviti»; Contatti è una voce del menu |
| 3 · Menu telefono oggi (375) | Voci, «Iscriviti» e «Scrivici» come pulsanti pieni |
| 4 · Menu telefono proposta (375) | Contatti fra le voci; resta il solo «Iscriviti» |

## Regole proposte

- Sul sito pubblico non c'è più nessun pulsante «Scrivici»: né in testata, né nel menu del telefono, né nelle schede degli istruttori, né nei testi delle pagine (il generatore toglie i pulsanti che portano a `/contatti/`; nel pannello SITO il testo resta com'è).
- Contatti è una voce del menu, nel posto scelto in MENU, e si chiama sempre «Contatti» (anche nel piede), qualunque etichetta abbia scritto la segreteria.
- Restano i pulsanti «Scrivici su WhatsApp» di Orari e di Contatti: aprono WhatsApp, non portano a Contatti.
- Il pulsante giallo è già «Iscriviti» in testata e nel menu del telefono: non cambia; l'invito giallo e la barra del telefono non cambiano.
- Senza la pagina Contatti pubblicata non c'è la voce e nessun link a `/contatti/`.

`SitoTestata` ha tre prop nuove: `conScrivici`, `voceContatti`, `conVoceContatti`. Costruito: i valori di partenza sono quelli del sito di adesso (senza «Scrivici», con la voce Contatti); `conScrivici` e `conVoceContatti` servono solo a mostrare com'era.

Le tavole riproducono lo stile vero della testata generata da `src/lib/sitoGenera.ts` (voce corrente: pillola gialla, pulsanti da 52px con bordo di 2px, MENU in maiuscolo, pannello del telefono con CHIUDI). `SitoTestata` è stato riallineato.
