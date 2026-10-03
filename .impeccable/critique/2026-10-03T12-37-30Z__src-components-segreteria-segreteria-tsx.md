---
target: Menu laterale e Impostazioni
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/Users/nicola/Automation/ods-corsi/.claude/worktrees/menu-laterale-impostazioni-4fc666/src/components/segreteria/Segreteria.tsx"
target_fingerprint: "sha256:1cfda447af140151540c8ede111773e04a4adecf0b26fd527226cafd6d9a378b"
target_path: /Users/nicola/Automation/ods-corsi/.claude/worktrees/menu-laterale-impostazioni-4fc666/src/components/segreteria/Segreteria.tsx
timestamp: 2026-10-03T12-37-30Z
slug: src-components-segreteria-segreteria-tsx
---
# Critica: menu laterale segreteria e IMPOSTAZIONI

Method: dual-agent (A: revisione di design · B: detector + browser)

## Punteggio euristiche: 25/40 (Accettabile)
1 Stato 3 · 2 Mondo reale 3 · 3 Controllo 2 · 4 Coerenza 2 · 5 Prevenzione 3 · 6 Riconoscere 2 · 7 Efficienza 3 · 8 Minimalismo 2 · 9 Errori 2 · 10 Aiuto 3

## Problemi prioritari
- [P1] IMPOSTAZIONI su desktop: icona a cursori senza nome, sotto la piega (menu 1270px su 900), nessuna voce accesa quando è aperta. Segreteria.tsx:276, 304-313; styles.css:1201.
- [P1] Conservazione presenze salvata al cambio della tendina, senza conferma né conteggio. Regole.tsx:56.
- [P2] Testo grezzo API negli errori (Regole.tsx:44, 344, 569) e percorsi di codice in UI (72, 213, 220, 479, 607).
- [P2] IMPOSTAZIONI muro di 9 riquadri, 4500px sul telefono; tablet di sala sparsi in 4 riquadri.
- [P2] Bersagli <44px: CAMBIA/TOGLI/SCARICA 36px (Regole.tsx:167, 358, 364, 584), LA PALESTRA 40px sul telefono (styles.css:1722), «Riparti dall'orario vero» 18px.

## Detector
CLI su Segreteria.tsx e Regole.tsx: pulito. Browser: wide-tracking (falsi positivi, maiuscolo condensato voluto), clipped-overflow su .sg (voluto), text-occluded sotto menu telefono (voluto). Contrasto 4.48:1 in tema chiaro per titoli gruppo 11px, ruolo, versione, sg-link.

## Persone
Alex: 19 Tab per IMPOSTAZIONI, ESPORTA tendina 200+ nomi. Sam: fuoco su body dopo Esc/scelta voce, menu telefono non modale. Segretaria 60 anni: non trova IMPOSTAZIONI, legge «job mensile», «Riparti» accanto a «Esci».
