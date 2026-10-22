import { useEffect, useRef, useState } from 'react'
import { annuncioCambio, caselleDaMostrare, type ContiCosaManca } from '../../lib/cosaManca'
import type { Destinazione, Voce } from './Segreteria'

/**
 * La striscia COSA MANCA, in cima alle pagine di segreteria: quattro caselle,
 * ognuna un tasto che porta alla pagina giusta già filtrata. Mostra e chiama
 * soltanto: cosa dice ogni casella, e quando il numero non si sa, lo decide
 * `lib/cosaManca.ts`.
 */
export function CosaManca({
  conti,
  onVai,
  onRiprova,
}: {
  conti: ContiCosaManca
  onVai: (v: Voce, d?: Destinazione) => void
  onRiprova: () => void
}) {
  const caselle = caselleDaMostrare(conti)
  // Un numero che cambia lo dice, piano, a chi non vede lo schermo: non alla prima lettura.
  const [detto, setDetto] = useState('')
  const prima = useRef(conti)
  useEffect(() => {
    const frase = annuncioCambio(prima.current, conti)
    prima.current = conti
    if (frase) setDetto(frase)
  }, [conti])
  const nonSo = conti.contato && caselle.some((c) => c.stato === 'nonso')

  return (
    <section className="sg-mancano" aria-label="Cosa manca">
      {caselle.map((c) => (
        <button
          key={c.id}
          type="button"
          className="sg-mancano-casella"
          data-stato={c.stato}
          aria-label={c.nome}
          onClick={() => onVai(c.voce, c.filtro ? { filtro: c.filtro } : undefined)}
        >
          <span className="sg-mancano-n" aria-hidden="true">
            {c.numero}
          </span>
          <span className="sg-mancano-testi" aria-hidden="true">
            <span className="sg-mancano-titolo">{c.titolo}</span>
            <span className="sg-mancano-nota" data-fissa={c.notaFissa}>{c.nota}</span>
          </span>
        </button>
      ))}
      {nonSo && (
        <button type="button" className="sg-btn sg-btn-linea sg-mancano-riconta" onClick={onRiprova}>
          Riconta
        </button>
      )}
      <span role="status" className="vh">
        {detto}
      </span>
    </section>
  )
}
