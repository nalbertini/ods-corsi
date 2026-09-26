/**
 * I comandi sulla schermata di blocco.
 *
 * Mentre l'allenamento gira, il telefono mostra il timer dove mostrerebbe il
 * brano in riproduzione: stato, nome, avanzamento, e i tasti per mettere in
 * pausa o saltare un intervallo senza sbloccare lo schermo. In palestra vuol
 * dire non dover tirare fuori il telefono e cercare il tasto giusto.
 *
 * Il prezzo, che vale la pena sapere: per farlo bisogna *essere* la
 * riproduzione. I browser accendono quei comandi solo per una pagina che sta
 * suonando da un elemento audio vero, quindi l'app ne tiene uno che riproduce
 * silenzio in ciclo. Da lì in poi il telefono considera lei il «in
 * riproduzione», al posto del lettore musicale. Per questo lo si prende solo
 * mentre il timer è acceso, e lo si rilascia appena finisce.
 */

export interface StatoSessione {
  titolo: string
  sottotitolo: string
  inCorso: boolean
  /** Durata e posizione in secondi, per la barra di avanzamento. */
  durata?: number
  posizione?: number
}

export interface ComandiSessione {
  avvia?: () => void
  pausa?: () => void
  avanti?: () => void
  indietro?: () => void
  ferma?: () => void
}

/** Un secondo di silenzio: basta, va in ciclo. */
function silenzio(): string {
  const hz = 8000
  const campioni = hz
  const buffer = new ArrayBuffer(44 + campioni)
  const v = new DataView(buffer)
  const scrivi = (off: number, testo: string) => {
    for (let i = 0; i < testo.length; i++) v.setUint8(off + i, testo.charCodeAt(i))
  }
  scrivi(0, 'RIFF')
  v.setUint32(4, 36 + campioni, true)
  scrivi(8, 'WAVEfmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, 1, true)
  v.setUint32(24, hz, true)
  v.setUint32(28, hz, true)
  v.setUint16(32, 1, true)
  v.setUint16(34, 8, true)
  scrivi(36, 'data')
  v.setUint32(40, campioni, true)
  // A 8 bit senza segno il silenzio è 128, non 0.
  for (let i = 0; i < campioni; i++) v.setUint8(44 + i, 128)
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }))
}

let elemento: HTMLAudioElement | null = null
let sorgente: string | null = null

function audio(): HTMLAudioElement | null {
  if (elemento) return elemento
  if (typeof Audio === 'undefined') return null
  try {
    sorgente ??= silenzio()
    const a = new Audio(sorgente)
    a.loop = true
    // Non è muto: un elemento muto per molti browser non sta «suonando», e i
    // comandi non compaiono. Suona silenzio, che è un'altra cosa.
    a.volume = 1
    a.setAttribute('playsinline', '')
    elemento = a
    return a
  } catch {
    return null
  }
}

const AZIONI: Array<[MediaSessionAction, keyof ComandiSessione]> = [
  ['play', 'avvia'],
  ['pause', 'pausa'],
  ['nexttrack', 'avanti'],
  ['previoustrack', 'indietro'],
  ['stop', 'ferma'],
]

/** Accende i comandi e aggiorna quello che si legge sullo schermo di blocco. */
export function apriSessione(stato: StatoSessione, comandi: ComandiSessione) {
  const a = audio()
  if (a && a.paused) void a.play().catch(() => {})

  const ms = navigator.mediaSession
  if (!ms) return
  try {
    ms.metadata = new MediaMetadata({
      title: stato.titolo,
      artist: stato.sottotitolo,
      album: 'Officine Dello Sport',
      artwork: [
        { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    })
    ms.playbackState = stato.inCorso ? 'playing' : 'paused'
    for (const [azione, chiave] of AZIONI) {
      const fn = comandi[chiave]
      try {
        ms.setActionHandler(azione, fn ? () => fn() : null)
      } catch {
        // Azione non supportata da questo browser: si salta.
      }
    }
    if (stato.durata !== undefined && stato.posizione !== undefined && stato.durata > 0) {
      try {
        ms.setPositionState({
          duration: stato.durata,
          position: Math.min(Math.max(0, stato.posizione), stato.durata),
          playbackRate: 1,
        })
      } catch {
        // Posizione fuori intervallo: meglio nessuna barra che un'eccezione.
      }
    }
  } catch {
    // Media Session non disponibile: restano i comandi dentro l'app.
  }
}

/** Rilascia il «in riproduzione»: il lettore musicale se lo riprende. */
export function chiudiSessione() {
  const a = elemento
  if (a && !a.paused) {
    try {
      a.pause()
      a.currentTime = 0
    } catch {
      // Niente da fare.
    }
  }
  const ms = navigator.mediaSession
  if (!ms) return
  try {
    ms.playbackState = 'none'
    ms.metadata = null
    for (const [azione] of AZIONI) {
      try {
        ms.setActionHandler(azione, null)
      } catch {
        // Azione non supportata: era già così.
      }
    }
  } catch {
    // Media Session non disponibile.
  }
}
