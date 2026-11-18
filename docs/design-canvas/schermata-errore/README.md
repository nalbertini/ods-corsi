# Schermata d'errore

Costruita il 18/11/2026. Dalla revisione del 17/11/2026: senza un confine
d'errore (error boundary) in `src` e `timer/src`, un errore mentre si disegna
una pagina lascia lo schermo bianco, anche sul tablet durante l'appello.

| Tavola | Cosa |
|---|---|
| `Main.dc.html` | Oggi: la pagina bianca |
| `PropostaA.dc.html` | Telefono, niente in coda: riquadro rosso e RICARICA |
| `PropostaB.dc.html` | Telefono con 2 presenze in coda, tenute sul telefono |
| `PropostaC.dc.html` | Tablet di sala con 3 presenze in coda |
| `PropostaD.dc.html` | Tablet che non riesce a tenere la coda: PROVA A MANDARLE e RICARICA LO STESSO |
| `PropostaE.dc.html` | Il tasto mentre prova a mandare |
| `PropostaF.dc.html` | Un pezzo della pagina non arriva |
| `PropostaG.dc.html` | Lo stesso blocco torna entro 30 secondi |
| `PropostaH.dc.html` | Segreteria su schermo largo |
| `PropostaI.dc.html` | Si blocca il timer, non l'appello |

I componenti vengono da `../ods-design-system/` (`Testata`, `Riquadro`,
`Bottone`, `TabletTestata`, `TabletAvviso`, `TabletTasto`), senza cambiarli.
