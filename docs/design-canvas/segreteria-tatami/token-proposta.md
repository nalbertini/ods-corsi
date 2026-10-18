# Tatami · token proposti

Valori nuovi della proposta «Segreteria · Tatami». Non sono ancora in `src/styles.css` né in `DESIGN.md`:
entrano lì solo se l'utente approva la direzione (skill `nuova-funzione`, passi 5 e 12).
`ods-design-system/verifica.mjs` legge anche questo file, così il canvas della proposta passa il controllo
dei colori senza che `DESIGN.md` cambi prima del sì.

| Token | Valore | Uso |
|---|---|---|
| paglia | #ebe6d0 | fondo della pagina: la paglia del tatami (igusa) |
| paglia-chiara | #f6f3e4 | superficie: il tatami, le tessere, i campi |
| paglia-scura | #d9d2b0 | superficie alta: riga scelta, tasto premuto |
| riga-paglia | #bdb68f | le cuciture fra un tatami e l'altro |
| orlo | #1d1d1b | testo e bordo: il bordo di stoffa nera (heri) |
| muschio | #2f3d2b | la barra del menu: verde scuro del bordo dei tatami |
| testo-spento-paglia | #5d5c4f | testo secondario su paglia (5,4:1 su `paglia`) |
| su-muschio | #cfd6c0 | testo secondario sul menu |

## Tre temi, un solo layout

Il layout è uno; cambiano solo i colori. `Main` è il tema **Tatami** (paglia e muschio, sopra), `MainScuro` e `MainChiaro` sono
gli stessi componenti con `tema="scuro"` e `tema="chiaro"`, coi valori già in `DESIGN.md`:

| Ruolo | Tatami | Scuro | Chiaro |
|---|---|---|---|
| fondo | #ebe6d0 | #121212 | #f4f4f1 |
| superficie | #f6f3e4 | #1c1c1c | #ffffff |
| superficie alta | #d9d2b0 | #242424 | #e9e9e5 |
| cuciture | #bdb68f | #333333 | #d4d4ce |
| bordo dei tatami | #1d1d1b | #4a4a46 | #8a8a85 |
| testo | #1d1d1b | #f2f2f0 | #161616 |
| menu | #2f3d2b | #161616 | #ebebe7 |
