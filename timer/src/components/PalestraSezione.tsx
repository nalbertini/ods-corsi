import { useState } from 'react'
import type { Accesso } from '../lib/palestra'

/**
 * Il collegamento con ODS Corsi, nelle impostazioni: chi è collegato, cosa
 * aspetta ancora di arrivare al database, e il trasloco dei timer di questo
 * dispositivo fra i propri.
 *
 * L'accesso non si fa qui: si fa in ODS Corsi, e il timer lo trova da sé.
 */
export function PalestraSezione({
  accesso,
  inCoda,
  sincronizzato,
  daPortare,
  onPorta,
  onAggiorna,
}: {
  accesso: Accesso
  inCoda: number
  sincronizzato: 'no' | 'sì' | 'errore'
  /** Quanti timer fatti su questo dispositivo potrebbero andare fra i miei. */
  daPortare: number
  onPorta: () => number
  onAggiorna: () => void
}) {
  const [esito, setEsito] = useState<string | null>(null)

  const stato =
    accesso.chi === 'personale'
      ? `Collegato come ${accesso.nome}. I tuoi timer, quelli della palestra e le impostazioni stanno sul database di ODS Corsi.`
      : accesso.chi === 'sala'
        ? `Tablet di sala · ${accesso.sala}. Si aprono i timer della palestra e quelli dei corsi; si creano e si cambiano dal proprio accesso da istruttore.`
        : 'Nessun accesso: i timer stanno solo su questo dispositivo. Entrando in ODS Corsi come istruttore si ritrovano su ogni dispositivo, con la libreria della palestra.'

  return (
    <>
      <div className="rule">
        <span className="rule-label">ODS CORSI</span>
        <div className="rule-line" />
      </div>
      <div className="pad stack" style={{ gap: 10 }}>
        <p style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--dim)', margin: 0 }}>{stato}</p>

        {accesso.chi !== 'nessuno' && (
          <p style={{ fontSize: 13, lineHeight: 1.45, margin: 0, color: inCoda || sincronizzato === 'errore' ? 'var(--giallo-testo)' : 'var(--dim)' }}>
            {inCoda
              ? `${inCoda === 1 ? 'Una modifica aspetta' : `${inCoda} modifiche aspettano`} la rete: restano qui e partono da sole appena il database risponde.`
              : sincronizzato === 'errore'
                ? 'Il database non risponde: si vede l’ultima copia letta.'
                : sincronizzato === 'sì'
                  ? 'Tutto allineato con il database.'
                  : 'Sto leggendo il database…'}
          </p>
        )}

        {/* Niente tasto per entrare: dal timer non si va negli istruttori, che
            sono un'area a sé. Senza accesso resta solo la spiegazione. */}
        {accesso.chi !== 'nessuno' && (
          <button className="btn btn-ghost" style={{ minHeight: 50, fontSize: 15 }} onClick={onAggiorna}>
            RILEGGI DAL DATABASE
          </button>
        )}

        {accesso.chi === 'personale' && daPortare > 0 && (
          <button
            className="btn btn-ghost"
            style={{ minHeight: 50, fontSize: 15 }}
            onClick={() => {
              const n = onPorta()
              setEsito(`${n === 1 ? 'Un timer è passato' : `${n} timer sono passati`} fra i tuoi: li ritrovi su ogni dispositivo in cui entri.`)
            }}
          >
            {daPortare === 1 ? 'PORTA FRA I MIEI IL TIMER DI QUI' : `PORTA FRA I MIEI I ${daPortare} TIMER DI QUI`}
          </button>
        )}
        {esito && <p style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--dim)', margin: 0 }}>{esito}</p>}
      </div>
    </>
  )
}
