---
name: preparare-verbale
description: Use when someone of the palestra gives the transcript (or notes) of a riunione dei soci o del direttivo and asks for the verbale, or says «fammi il verbale», «prepara il verbale», «ecco la registrazione della riunione».
---

# Preparare un verbale

Il verbale si scrive fuori dall'app: nell'app va solo «la riunione» (tipo,
numero, data, luogo, ore) e il PDF firmato. Questa skill porta la
trascrizione di una riunione registrata con la scaletta (guida, «Segreteria ·
Verbali») al PDF da firmare.

## 1. Il riepilogo

Leggi la trascrizione e scrivi, in un blocco solo:

- riunione (soci, direttivo, soci e direttivo, straordinaria, elettiva), numero se detto, data, luogo, ora d'inizio;
- chi presiede e chi verbalizza;
- presenti, assenti, deleghe; per i soci gli aventi diritto e se c'è il numero legale (lo dice lo statuto: se non lo sai, chiedi, non dedurlo);
- l'ordine del giorno, e per ogni punto: cosa si è deciso, il voto (favorevoli, contrari, astenuti) o «presa d'atto»;
- le nomine: chi, quale carica, dal–al;
- l'ora di chiusura.

Quello che non si sente o è ambiguo lo segni con «?» e lo chiedi tutto
insieme, in una domanda sola. Non inventare nomi, numeri o esiti: un verbale
è un atto, meglio una riga vuota che una sbagliata.

## 2. Il PDF

Solo dopo le risposte. Con la skill `pdf` (o `docx` se lo chiedono), A4, sopra
la carta intestata della palestra (`public/moduli/carta-intestata.pdf`, il
testo fra i margini di `SU_CARTA` in `src/lib/cartaPdf.ts`):

- in testa: «Verbale n.N-AAAA della riunione del … di ASD Il Centro Judo»;
- il paragrafo d'apertura (data, ora, luogo, convocazione, presidente,
  segretario, presenti e numero legale);
- un paragrafo per punto dell'ordine del giorno, col voto;
- la chiusura con l'ora;
- in fondo due righe di firma: «Il presidente» e «Il segretario».

Linguaggio da verbale, terza persona, frasi corte. Nessun dato che non serve
(niente codici fiscali, indirizzi, telefoni).

## 3. Per l'app

Chiudi con una riga che la segreteria copia nella schermata **Carica un
verbale**: riunione · n.N-AAAA · GG/MM/AAAA · inizio–fine · luogo · l'ordine
del giorno in una riga. E ricorda: stampare, far firmare, scansionare in PDF,
caricare in VERBALI.
