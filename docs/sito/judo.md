# Judo: la pagina del corso rivista

Testo da incollare nel pannello SITO (PAGINE › Judo) per avere la pagina rivista: titolo con i due pulsanti, foto di apertura, dati, orario a tessere, «Cosa si fa» e «A chi è rivolto», «Cosa aspettarsi» numerato e chiusura «Una settimana per scegliere.».
**Finché non si incolla il testo nuovo la pagina resta com'è oggi**: il sito riconosce quella nuova da un pulsante verso il modulo online prima del primo titolo grande. Il testo di prima è in [`judo-precedente.html`](judo-precedente.html). Regole in [`corso.md`](corso.md).

## Prima di incollare: le foto

Nella libreria IMMAGINI vanno caricate (le versioni sviluppate sono in `docs/proposte-home/corso/foto/approvate/`, non nel repository):

| File | Ruolo |
|---|---|
| `judo-A.jpg` | A |
| `judo-B.jpg` | B |
| `judo-C.jpg` | C |

In `judo.html` i nomi sono segnaposto (`DA-CARICARE-<file>.jpg`): dopo il caricamento si sostituiscono con i nomi veri prima di copiare. Il punto da tenere al centro lo sceglie il sito dal corso, non dal nome del file. Ruoli: A apertura (sotto il titolo), B accanto a «Cosa si fa», C nella chiusura.

## Come si fa

1. Apri **PAGINE › Judo**.
2. Nel campo **descrizione** scrivi quella qui sotto; il titolo resta com'è.
3. Apri `docs/sito/judo.html` nel browser, seleziona tutto (Cmd+A), copia. Nel pannello cancella **tutto** il testo vecchio e incolla (Cmd+V).
4. **ANTEPRIMA** per controllare, poi **PUBBLICA**.

## Descrizione

Tecnica, disciplina e rispetto per crescere sul tatami, dai primi passi fino alle gare.

## Da controllare prima di pubblicare

- Domande aperte che toccano questa pagina (`docs/proposte-home/corso/testi/REPORT.md`): Q10 (chi può entrare in Judo agonisti), Q12 (frasi nuove e storia del judo da far rileggere a chi insegna).
- Le frasi nuove o accorciate (descrizione, «Cosa si fa», titoli di «Cosa aspettarsi») le rilegga chi insegna: nei sorgenti prima/dopo, riga «Tolto», sta in `docs/proposte-home/corso/testi/REPORT.md`.
- Non c'è la quota dopo la prova né il certificato medico: nessun testo di oggi li dice (Q3, Q4).
- Le età sull'anno 2026 invecchiano ogni settembre (Q9).
