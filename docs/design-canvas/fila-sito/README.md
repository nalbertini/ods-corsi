# Dal sito alle richieste · proposta

Passo 4 di `nuova-funzione`: il riquadro DAL SITO ALLE RICHIESTE in fondo a
STATISTICHE della segreteria, subito sopra IL SITO, nel look del sito. Numeri
di esempio al 17 marzo 2027, gli stessi di `../sito-in-statistiche/`.

| Tavola | Cosa mostra |
|---|---|
| `Proposta`, `PropostaTelefono` | La fila sopra IL SITO, ultimi 3 mesi, tutti i corsi: 3.380 visite → 65 tocchi (2%) → 21 richieste (32%) → 12 accolte (57%) |
| `Stati` | Si conta dal 20 ottobre e corso scelto; richieste più dei tocchi; il contatore che chiede di aspettare; senza il file 74; «meno dell'1%» e «—»; modalità prova |
| `RiquadroFila` | Il componente della proposta |

Le scelte:

- Un riquadro a sé, come gli altri (tessera bianca, testa di `Riga`), subito
  sopra IL SITO: visite e tocchi sono i totali di IL SITO, le richieste quelle
  di DA DOVE ARRIVANO LE RICHIESTE contate «dal sito». Nessuna lettura in più.
- Quattro gradini in fila (sul telefono uno sotto l'altro), tessere azzurre con
  la cifra grande; fra l'uno e l'altro la freccia e quanti passano al gradino
  dopo. Niente barre in proporzione: 3.380 visite e 21 richieste farebbero
  barre invisibili.
- Fra tocchi e richieste la percentuale come le altre; quando passa il 100% non
  si tronca e una fascia dice perché (le famiglie, i link mandati da un amico).
- «Dal sito» comprende i link del sito mandati su WhatsApp (non si
  distinguono): la riga in fondo lo dice.
- Ogni guaio tocca solo la sua metà: il contatore i gradini 1–2 (cosa fare lo
  dice IL SITO), il database i gradini 3–4. Le frasi sono le fasce azzurre di
  IL SITO; il guaio è il titolo NON LETTO dentro i gradini.
