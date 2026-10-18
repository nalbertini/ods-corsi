import type { DatiSegreteria } from '../../../lib/segreteria'
import { chiaveGiorno } from '../../../lib/sala'
import { cosaBlocca } from '../../../lib/cosaBlocca'
import { APRI_SCHEDA, schedaPerApertura } from '../../../lib/schedaSezioni'
import { Guaio, useCarica } from '../comune'

// La scheda di sempre è l'elemento che segue questo riquadro.
// La scheda sotto si apre su quella del problema (quota, certificato), poi scorre.
const allaScheda = (tasto: 'certificato' | 'quota') => {
  window.dispatchEvent(new CustomEvent(APRI_SCHEDA, { detail: schedaPerApertura(tasto) }))
  document.querySelector('.bn-persona')?.nextElementSibling?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/**
 * La scheda PERSONA de «Il Banco»: in cima quello che serve a chi sta al banco,
 * cioè cosa blocca questa persona, le presenze e la famiglia. Sotto c'è la
 * scheda di sempre, coi timbri del certificato, della quota e del documento e
 * tutto da fare e da cambiare: qui non si scrive niente e niente si ripete.
 */
export function PersonaBanco({ d, id, giro }: { d: DatiSegreteria; id: string; /** Sale a ogni modifica fatta nella scheda sotto: il riquadro rilegge, se no direbbe «tutto a posto» a chi non può entrare. */ giro: number }) {
  const persone = useCarica(() => d.persone(), [d, giro])
  const frequenze = useCarica(() => d.frequenze(), [d, giro])
  const p = persone.dato?.find((x) => x.id === id)
  if (persone.guaio) return <Guaio testo={`La scheda non si legge: ${persone.guaio}`} />
  if (!p) return null
  const oggi = chiaveGiorno(new Date())
  const blocca = cosaBlocca(p, oggi)
  const f = frequenze.dato?.get(p.id)
  // Il nucleo: il titolare e chi dipende da lui (vedi `nucleo.ts`); senza nucleo, nessuno.
  const titolare = p.nucleo ?? p.id
  const famiglia = persone.dato?.filter((x) => x.id !== p.id && (x.id === titolare || x.nucleo === titolare)) ?? []
  return (
    <section aria-label="Com'è messa questa persona" className="bn-persona">
      {blocca && (
        <div className="bn-blocca" data-blocca={blocca.blocca} role="status">
          <span className="ob bn-blocca-titolo">{blocca.titolo}</span>
          <span className="grow">{blocca.frase}</span>
          {/* Apre la scheda del problema e scorre: il certificato e la ricevuta si sistemano nella scheda, qui sotto. */}
          <button type="button" className="num sg-btn sg-btn-pieno" onClick={() => allaScheda(blocca.tasto)}>
            Vai alla scheda
          </button>
        </div>
      )}
      <p className="bn-famiglia">
        <span className="sg-etichetta">PRESENZE · ULTIMI 30 GIORNI</span> <span className="num" style={{ fontWeight: 700 }}>{f ? `${f.presenti} su ${f.dovute}` : '—'}</span>
      </p>
      {famiglia.length > 0 && (
        <p className="bn-famiglia">
          <span className="sg-etichetta">LA FAMIGLIA</span> {famiglia.map((x) => `${x.cognome} ${x.nome}`).join(' · ')}
        </p>
      )}
    </section>
  )
}
