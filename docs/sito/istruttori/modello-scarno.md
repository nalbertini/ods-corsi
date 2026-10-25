# La scheda scarna di un istruttore

Per chi ha solo nome, corsi e (forse) una foto. Il sito mostra: nome grande, foto o fascia azzurra con l'iniziale, i corsi, due pulsanti («Prova una settimana a 10 €» e «Scrivici»), l'invito in fondo. **Niente tessere vuote.** Quando arrivano ruolo, storia e frase, si passa alla scheda completa (`modello.md`, esempio `maurizio-innella.md`).

Esempio: Fabio Berta. Per un altro istruttore, cambia titolo, indirizzo e corsi (i corsi sono nell'elenco di `../istruttori.html`).

## Come si pubblica

1. SITO › **NUOVA PAGINA**, indirizzo `fabio-berta` (nome-cognome, minuscolo, trattini).
2. **Titolo**: *Fabio Berta*. **Descrizione**: *Aikido alle Officine dello Sport.*
3. **Testo**: incolla il blocco sotto. Se hai la foto (libreria IMMAGINI), inseriscila **prima** dell'elenco; il testo alternativo si può lasciare vuoto («Ritratto di Fabio Berta»).
4. ANTEPRIMA, PUBBLICA. Poi il suo nome nell'elenco `/istruttori/` diventa un link da solo (se nel testo dell'elenco è già collegato a `/fabio-berta/`).

## Titolo, descrizione e testo

```html
<ul>
<li><strong>Corsi</strong> Aikido</li>
</ul>
```

Più corsi: una sola voce, separati da virgola (`Judo, Preparazione atletica`), come nell'elenco. Si possono aggiungere fino a quattro voci col grassetto davanti; ma il sito riconosce la scheda scarna solo se c'è la voce **Corsi** e nient'altro oltre alla foto e a questo elenco (niente titoli, niente citazione).

## Non una scheda scarna

Con un titolo grande (`h2`) o una citazione dopo la foto, la pagina è la scheda completa.
