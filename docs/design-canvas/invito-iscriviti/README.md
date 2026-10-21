# Invito «Iscriviti» del sito (e parte ISCRIVITI dell'editor)

COSTRUITA (`invito()` di `src/lib/sitoGenera.ts`, parte `iscriviti` di `src/lib/sitoPezzi.ts`, `EditorPezzi.tsx`, `EditorPuck.tsx`). Le tavole sono la proposta approvata; com'è adesso lo dice `SitoInvito` della libreria.

| Tavola | Cosa è |
|---|---|
| 1 · Oggi (1440) | `invito()` di `src/lib/sitoGenera.ts`: la parola ISCRIVITI a 170px, una frase, metà del giallo vuota |
| 2 · Proposta (1440) | `SitoInvito`: titolo 88px, frase sulle prove, «Iscriviti», «Chiama», «Scrivici», tre passi e dove siamo |
| 3 · Oggi (375) | Lo stesso invito sul telefono, parola a 120px |
| 4 · Proposta (375) | `SitoInvito` con `piccolo`: una colonna, pulsanti a tutta larghezza |
| 5 · Editor | La parte nuova + ISCRIVITI: si cambiano solo titolo e frase |

Componente nuovo in `../ods-design-system/`: `SitoInvito`.

## Regole proposte

- L'invito automatico resta dove esce oggi (non nelle pagine di legge, non dove la
  pagina ha già la sua chiamata finale).
- La parte ISCRIVITI dell'editor lo sostituisce su quella pagina: un invito al massimo.
- Nella parte si cambiano titolo e frase, con un tasto per tornare al testo di sempre;
  indirizzo, telefono, passi e link vengono da `CONTATTI` e `TESTI`.
- I passi dicono come si fa davvero la prova: si chiede a voce o su WhatsApp, non dal modulo.

## Differenze del costruito

- Nella parte ISCRIVITI i campi sono vuoti, con «(vuoto = …)» nell'etichetta come il testo
  alternativo delle foto: vuoto è il testo di sempre, quindi non serve il tasto RIMETTI.
- «+ ISCRIVITI» spento dice perché («C’è già: una parte Iscriviti per pagina»); la parte
  non si copia né si trascina, e SU/GIÙ non la spostano (`spostabile`).
- La parte vince anche sulla chiamata finale delle pagine nuove; nelle pagine di legge e
  senza la pagina Contatti non esce, come l'invito di sempre.
- «Guarda gli orari» va su una riga sua, alta 48px, e manca nella pagina Orari.
- «€» ha lo spazio indivisibile prima; il titolo va a capo anche dentro una parola lunga.
