# Piede del sito: loghi delle federazioni

Proposta da approvare prima di toccare il sito. Niente è stato cambiato in `src/`, `supabase/`, sul sito vero o sul database.

## Cosa cambia

In fondo al piede scuro di ogni pagina, sotto le colonne recapiti / pagine / legge, una riga a tutta larghezza: «Siamo affiliati a» e due loghi a colori, FIJLKAM e FIPE in quest'ordine. Ogni logo sta in un riquadro bianco (raggio 6px, 8px di spazio intorno), è un link al sito della federazione e si apre in scheda nuova. Il resto del piede resta identico.

| Tavola | Cosa è |
|---|---|
| `Oggi` (1344) | Il piede com'è |
| `Proposta` (1344) | Il piede con la riga delle federazioni |
| `PropostaTelefono` (375) | Lo stesso sul telefono: etichetta e loghi vanno a capo, niente scroll orizzontale |

Componente: `SitoPiede` della libreria, con la nuova prop `federazioni` (default `false`).
Token usati: `#0d2a3d` (piede), `#ffffff` (riquadri e testo), raggio 6px; Inter 16px per l'etichetta.

## Misure

- Loghi alti 72px, larghezza dalla proporzione: FIJLKAM 42×72 (da 303×515), FIPE 55×72 (da 229×300). Riquadri 58×88 e 71×88: il tocco supera i 44px.
- `fijlkam.png` e `fipe.png` sono copie di `sito/risorse/`, qui accanto ai file; `<img>` con `alt` «FIJLKAM» e «FIPE», nessun `svg`, nessun `<li>` nuovo.
- Link: `https://www.fijlkam.it`, `https://www.fipe.it` [DA CONFERMARE: gli indirizzi giusti].

## Come si guarda

`rendi.mjs` genera `anteprima-1440.html` e `anteprima-375.html` (pagine autonome). Le `.dc.html` si aprono col canvas.
