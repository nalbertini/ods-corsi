import { useEffect, useState } from 'react'
import type { Workout } from '../types'
import { describe, totalDuration } from '../lib/engine'
import { clock } from '../lib/format'
import { linkPer } from '../lib/condivisione'
import { QrCode } from './QrCode'
import { Back } from './Icons'

/**
 * Mandare un allenamento al tablet della sala, o a un collega.
 *
 * Il QR è la strada corta: i tablet leggono i codici con la fotocamera di
 * sistema, senza installare niente. Il link resta lì sotto per chi preferisce
 * mandarlo su WhatsApp — o per tenerselo come copia di sicurezza.
 */
export function CondividiScreen({ workout, onBack }: { workout: Workout; onBack: () => void }) {
  const [link, setLink] = useState<string | null>(null)
  const [copiato, setCopiato] = useState(false)

  useEffect(() => {
    let vivo = true
    void linkPer(workout).then((l) => {
      if (vivo) setLink(l)
    })
    return () => {
      vivo = false
    }
  }, [workout])

  const copia = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopiato(true)
      window.setTimeout(() => setCopiato(false), 2200)
    } catch {
      // Senza permesso per gli appunti resta il QR, che è la strada principale.
      setCopiato(false)
    }
  }

  const invia = async () => {
    if (!link) return
    try {
      await navigator.share({ title: workout.name, text: `Allenamento: ${workout.name}`, url: link })
    } catch {
      // Condivisione annullata: non è un errore.
    }
  }

  return (
    <div className="app">
      <div className="topbar">
        <button className="icon-btn" onClick={onBack} aria-label="Indietro">
          <Back />
        </button>
        <span className="ob grow" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.1em' }}>
          CONDIVIDI
        </span>
      </div>

      <div className="scroll">
        <div className="pad stack" style={{ gap: 16, paddingBottom: 24 }}>
          <div className="stack" style={{ gap: 2 }}>
            <span className="ob" style={{ fontSize: 26, fontWeight: 700 }}>
              {workout.name.toUpperCase()}
            </span>
            <span style={{ fontSize: 13, color: 'var(--dim)' }}>
              {describe(workout)} · {clock(totalDuration(workout))}
            </span>
          </div>

          <div className="qr-carta">
            {link ? (
              <QrCode testo={link} />
            ) : (
              <span style={{ fontSize: 14, color: 'var(--dim)' }}>Preparo il codice…</span>
            )}
          </div>

          <p style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--dim)', margin: 0 }}>
            Inquadralo con la fotocamera del tablet: si apre l’app con questo allenamento pronto. Non serve
            installare nulla, e il timer viaggia dentro il link — non passa da nessun server.
          </p>

          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-ghost grow" style={{ minHeight: 50, fontSize: 15 }} onClick={copia} disabled={!link}>
              {copiato ? 'LINK COPIATO' : 'COPIA LINK'}
            </button>
            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button className="btn btn-go grow" style={{ minHeight: 50, fontSize: 15 }} onClick={invia} disabled={!link}>
                INVIA
              </button>
            )}
          </div>

          <p style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--faint)', margin: 0, wordBreak: 'break-all' }}>
            {link ?? ''}
          </p>

          <p style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--faint)', margin: 0 }}>
            È una copia, non un collegamento: se cambi questo timer, chi l’ha ricevuto tiene la versione di adesso.
          </p>
        </div>
      </div>
    </div>
  )
}
