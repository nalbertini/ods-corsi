import { useMemo } from 'react'
import qrcode from 'qrcode-generator'

/**
 * Il QR disegnato come un solo tracciato SVG.
 *
 * Niente immagine e niente canvas: così resta nitido su qualunque schermo,
 * si stampa bene e non costa un file da caricare — che per un'app che deve
 * funzionare senza rete in una sala attrezzi non è un dettaglio.
 *
 * Il fondo è bianco anche se l'app è nera: un lettore di QR cerca moduli
 * scuri su chiaro, e invertirli è il modo più sicuro di non farsi leggere.
 */
export function QrCode({ testo, lato = 260 }: { testo: string; lato?: number }) {
  const { tracciato, misura } = useMemo(() => {
    // Versione automatica e correzione d'errore bassa: il contenuto è corto,
    // quindi il codice resta a maglie larghe e si legge anche da lontano.
    const qr = qrcode(0, 'L')
    qr.addData(testo)
    qr.make()
    const n = qr.getModuleCount()
    const bordo = 4 // zona di silenzio richiesta dallo standard
    let d = ''
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (qr.isDark(r, c)) d += `M${c + bordo} ${r + bordo}h1v1h-1z`
      }
    }
    return { tracciato: d, misura: n + bordo * 2 }
  }, [testo])

  return (
    <svg
      width={lato}
      height={lato}
      viewBox={`0 0 ${misura} ${misura}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label="Codice QR dell’allenamento"
      style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
    >
      <rect width={misura} height={misura} fill="#ffffff" />
      <path d={tracciato} fill="#121212" />
    </svg>
  )
}
