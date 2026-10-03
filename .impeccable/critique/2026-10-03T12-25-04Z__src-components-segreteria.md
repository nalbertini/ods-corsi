---
target: Segreteria
total_score: 29
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/Users/nicola/Automation/ods-corsi/.claude/worktrees/segreteria-critique-950cdd/src/components/segreteria"
timestamp: 2026-10-03T12-25-04Z
slug: src-components-segreteria
---
# Critique: Segreteria (src/components/segreteria) — 29/40 Buono

| # | Euristica | Voto | Problema chiave |
|---|---|---|---|
| 1 | Visibilità stato | 3 | Sezione non nell'URL; piede menu fuori vista a 900px |
| 2 | Mondo reale | 4 | Lessico del banco |
| 3 | Controllo | 2 | Nessuna storia: Indietro esce, ricarica → DA FARE (Segreteria.tsx:151) |
| 4 | Coerenza | 3 | Dettaglio: cassetto / pannello / pagina intera |
| 5 | Prevenzione | 3 | RIGENERA anonimo; select ricevuta 42 voci |
| 6 | Riconoscere | 3 | DA FARE 14 senza appello (30gg) vs Presenze 1 (mese) |
| 7 | Efficienza | 2 | Solo `/`; nessuna azione in blocco |
| 8 | Minimalismo | 3 | Filtri Iscritti 10 controlli; modulo ricevuta lungo |
| 9 | Errori | 3 | Messaggi utili, RIPROVA |
| 10 | Aiuto | 3 | «?» sotto la piega del menu |

Specificità: fatta per ODS; sameness da gestionale nelle sezioni di gestione (titolo+filtri+tabella). Rilevatore: CLI pulito; browser quasi tutto falsi positivi (wide-tracking, side-tab tinta corso, contrasto su disabilitato, skip link); nuovo: first-viewport-column-overflow in CORSI (.sg-due-colonne 167%).

## Problemi prioritari
- [P1] Nessun indirizzo: hash per voce/persona con pushState (harden)
- [P1] Nuovo pagamento sovradimensionato: voci del corso in cima, dati socio chiusi, niente rosso sui campi (distill)
- [P2] Azioni distruttive 18px, testo 10–15px in Presenze istruttori (typeset)
- [P2] Piede menu sotto la piega a 900px: sticky (layout)
- [P2] RIGENERA in Settimana doppione non spiegato: togliere (clarify)

## Persone
Rita: Indietro esce; «?» invisibile; campi rossi = errore; 14 vs 1; ricerca senza telefono; stato vuoto senza azione.
Alex: niente bulk, solo `/`, niente URL. Sam: bersagli 18px, Settimana scorre in orizzontale a 900px, nomi troncati, bollini 11px.

## Minori
PRESENZE ISTRUTTORI va a capo; Richieste col pannello si stringe; frazioni 10/16·0/10·10/16; DA FARE senza «tutto a posto»; Statistiche trattino solo e mesi vuoti; MENU 12 misto; Ricevute fuori menu.

## Domande
DA FARE mai a zero? Scheda iscritto come cassetto? LA PALESTRA dietro IMPOSTAZIONI?
