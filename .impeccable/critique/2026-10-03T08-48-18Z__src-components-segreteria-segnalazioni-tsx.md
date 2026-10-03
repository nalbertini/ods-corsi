---
target: Segnalazioni
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/Users/nicola/Automation/ods-corsi/.claude/worktrees/segnalazioni-impeccable-critique-d4abb3/src/components/segreteria/Segnalazioni.tsx"
target_fingerprint: "sha256:69b7f34ab8af0c3c513b59b488acf5b6bbdcc3a174676fd8db735a3fef90779f"
target_path: /Users/nicola/Automation/ods-corsi/.claude/worktrees/segnalazioni-impeccable-critique-d4abb3/src/components/segreteria/Segnalazioni.tsx
timestamp: 2026-10-03T08-48-18Z
slug: src-components-segreteria-segnalazioni-tsx
---
# Critique: Segnalazioni (segreteria)

Method: dual-agent. Detector: 0 finding CLI; browser 2 finding nella cornice segreteria, entrambi falsi positivi.

| # | Euristica | Voto |
|---|---|---|
| 1 | Stato del sistema | 3 |
| 2 | Mondo reale | 3 |
| 3 | Controllo e libertà | 2 |
| 4 | Coerenza | 2 |
| 5 | Prevenzione errori | 2 |
| 6 | Riconoscere | 3 |
| 7 | Flessibilità | 1 |
| 8 | Estetica minimale | 3 |
| 9 | Recupero errori | 2 |
| 10 | Aiuto | 3 |
| Totale | | 24/40 Acceptable |

Specificity: a metà. Cornice ODS, contenuto accordion da forum (niente segno grande / bordo di stato).

## Priority issues
1. [P1] CHIUDI butta la bozza di risposta, nessuna conferma né RIAPRI nel toast; due CHIUDI a schermo (Segnalazioni.tsx:129,179; comune.tsx:195,211).
2. [P1] Textarea schiacciate a 44px da .sg-campo (styles.css:1150) annullano rows=5/3 (Segnalazioni.tsx:79,174).
3. [P1] Testata del filo con all:unset inline: nessun fuoco visibile (Segnalazioni.tsx:133).
4. [P2] NUOVA SEGNALAZIONE sg-btn senza variante = testo nudo (:57); stato "da rispondere" solo tag rosso 11px, DESIGN dice giallo; niente bordo di stato.
5. [P2] Titolo troncato in silenzio a 120 caratteri (:76); riga tasti del filo sborda a 375px (:175, manca flexWrap).

## Persona
- Alex: niente ricerca, Ctrl+Invio, link diretto al filo.
- Sam: fuoco assente sulla testata; chip 40px; card chiuse a opacity 0.7 abbassano contrasto testo.
- Segretaria al banco: preme CHIUDI per chiudere il riquadro, perde bozza e filo.

## Minori
Paragrafo intro ridondante; nuovo filo non si apre dopo APRI; niente Esc; Tu/altri distinti solo dal grassetto; filo chiuso non dice chi; "Segnalazione aperta" -> "mandata"; caricamento solo testo.
