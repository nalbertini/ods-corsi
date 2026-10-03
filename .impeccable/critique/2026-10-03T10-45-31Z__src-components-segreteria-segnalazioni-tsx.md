---
target: Segnalazioni
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/Users/nicola/Automation/ods-corsi/.claude/worktrees/segnalazioni-impeccable-critique-d4abb3/src/components/segreteria/Segnalazioni.tsx"
target_fingerprint: "sha256:08534863b6c1a002c37d0efdee405639f23a8fb5ef6d00c7acd1f49280f69f35"
target_path: /Users/nicola/Automation/ods-corsi/.claude/worktrees/segnalazioni-impeccable-critique-d4abb3/src/components/segreteria/Segnalazioni.tsx
timestamp: 2026-10-03T10-45-31Z
slug: src-components-segreteria-segnalazioni-tsx
---
# Critique 2: Segnalazioni (segreteria), dopo #172

Method: dual-agent. Detector: 0 finding nel codice; 2 nel browser, falsi positivi della cornice (.sg overflow, tracking voce menu).

Voti: 1:3 2:3 3:3 4:2 5:3 6:3 7:2 8:3 9:2 10:3 = 27/40 (Acceptable, era 24).

Specificity: buona, presa in prestito: linguaggio ODS, composizione da elenco-forum.

## Priority issues
1. [P1] Filo chiuso sparisce subito; RIAPRI sotto «Risposta mandata e segnalazione chiusa» fa credere di ritirare la risposta (Segnalazioni.tsx:32, :170).
2. [P1] Chi ha scritto non si legge nel filo: messaggi tutti uguali, metadati 12px dim; testata mostra il nome anche quando è «Tu» (:182, :198-204).
3. [P2] Limiti incoerenti: COSA senza etichetta rossa, nota testo non rossa mentre la guida dice «diventa rosso»; APRI/RISPONDI spenti senza dire perché (:89, :93, :107, :231, guida).
4. [P2] Chip ANCHE LE CHIUSE 40px; RISPONDI spento sembra attivo nel scuro (opacity su verde); DA RISPONDERE 11px (styles.css:1154-1156, 1220).
5. [P3] Bozze perse cambiando voce di menu (:27-28, :152).

## Minori
Avviso copre l'ultima riga (360 e 1280); NUOVA non cambia aspetto da aperto; nuova segnalazione compare chiusa; testata a 360 mette ANCHE LE CHIUSE prima di NUOVA; riga meta lunga; niente Ctrl+Invio.
