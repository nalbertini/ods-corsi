# Accessibilità: stato

Fotografia del 2026-10-24 (versione 0.200.2), fatta lanciando le prove sulla
build. Non sostituisce una verifica con uno screen reader o con persone vere.

Criterio di riferimento: WCAG 2.2 AA (a, aa, 2.1 a/aa, 2.2 aa per axe), come
da «Accessibility & Inclusion» in `PRODUCT.md`: bersagli ≥ 44px, contrasto alto
nei due temi, stati non affidati al solo colore, fuoco da tastiera visibile.

## Esito delle prove

| Prova | Cosa copre | Esito |
|---|---|---|
| `prova:a11y-axe` | axe-core su 11 schermate (segreteria, tablet, area iscritti, iscrizione, timer) | ok, con 5 violazioni gravi note (sotto) |
| `prova:a11y-iscritti` | contrasto `--dim` nelle schede, due temi | ok (10) |
| `prova:a11y-dietro-login` | testi su una riga nelle schermate dietro il login | ok (6) |
| `prova:a11y-segreteria-bersagli` | altezza minima dei bersagli in segreteria | ok (1) |
| `prova:a11y-segreteria-menu` | numeri e parole letti dallo screen reader nella barra del banco | ok (4) |
| `prova:a11y-segreteria` | gestione del fuoco nei dialoghi | ok (4) |
| `prova:timer-accessibilita` | colori e contrasto della scheda accesa nel timer | ok (4) |
| `prova:tablet-accessibilita` | regioni annunciate, `.vh`, timer della sala | ok (14) |
| `prova:accessibilita-iscrizione` | `aria-required`, etichette e errori del modulo | ok (31) |

## Scansione axe, schermata per schermata

| Schermata | Violazioni |
|---|---|
| segreteria · da fare | nessuna |
| segreteria · iscritti, contabilità, settimana, corsi | `label-content-name-mismatch` (serious, 5 elementi), nota |
| tablet · scelta sala, sala | nessuna |
| area iscritti | nessuna |
| iscrizione · inizio, modulo | nessuna |
| timer · home | `color-contrast` (serious, 1 elemento: `.sidebar-versione`), nota |

## Da fare

1. **Caselle «mancano» in cima alla segreteria** (WCAG 2.5.3, Etichetta nel
   nome): l'`aria-label` non contiene il testo visibile, quindi chi detta i
   comandi a voce («clicca Mancano…») non le trova. Compare in 4 schermate, 5
   elementi ciascuna; si corregge in un punto solo e si tolgono le 4 voci da
   `scripts/a11y-note.json`.
2. **Versione nella barra del timer** (WCAG 1.4.3, contrasto): `.sidebar-versione`
   usa `--faint` `#5a5a56`, sotto 4,5:1. Tolta la correzione, si toglie anche
   la voce nota.

## Cosa non è coperto

- Il sito pubblico (`officinedellosport.it`): gli audit in
  `docs/proposte-home/*/REPORT.md` sono di design (contrasti e bersagli a
  mano), non una scansione.
- Schermate che axe non apre: le altre sezioni della segreteria (banco,
  presenze, richieste, listino…), i passi dopo il primo dell'iscrizione, area
  iscritti oltre la prima vista, tablet oltre la scelta della sala.
- Cosa axe non vede: ordine di lettura, testi alternativi sensati, uso reale
  con VoiceOver o TalkBack, zoom al 200 %, navigazione solo da tastiera.
- Tema scuro: coperto solo dove una prova lo dice (`a11y-iscritti`).

## Come si rifà

```
npm run build:tutto
npm run prova:a11y-axe
```

`build` da solo non ricostruisce il timer: axe leggerebbe una copia vecchia.
Le altre prove si lanciano con `npm run prova:<nome>` dalla tabella.
Una violazione grave nuova fa fallire la prova; una già nota va in
`scripts/a11y-note.json` con regola, schermata e motivo.
