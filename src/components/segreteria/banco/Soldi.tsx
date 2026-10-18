import type { DatiSegreteria } from '../../../lib/segreteria'
import { chiaveGiorno } from '../../../lib/sala'
import { daPagareElenco, ricevuteElenco } from '../../../lib/elenchiSoldi'
import { euro, nomeFileRicevuta, type Ricevuta } from '../../../lib/ricevute'
import { dataLunga, Guaio, Testa, useCarica } from '../comune'
import type { Destinazione, Voce } from '../Segreteria'

type Vai = (v: Voce, dove?: Destinazione) => void

const QUANTO = (giorni: number | null) => (giorni === null ? '—' : giorni === 1 ? '1 GIORNO' : `${giorni} GIORNI`)
const COME = { da_pagare: 'Quota non pagata', in_parte: 'Quota pagata in parte', scaduto: 'Quota scaduta' } as const

/**
 * DA PAGARE: chi ha la quota non in regola, prima chi aspetta da più
 * tempo. Prima era un filtro di ISCRITTI; il tasto apre la scheda, dove si
 * fa la ricevuta come sempre.
 */
export function DaPagare({ d, onVai }: { d: DatiSegreteria; onVai: Vai }) {
  const persone = useCarica(() => d.persone(), [d])
  const righe = daPagareElenco(persone.dato ?? [], chiaveGiorno(new Date()))
  return (
    <>
      <Testa titolo="DA PAGARE" sotto={persone.dato ? (righe.length ? `${righe.length} persone con la quota non in regola. Prima chi aspetta da più tempo.` : 'Tutti in regola coi pagamenti.') : 'Un attimo…'} />
      {persone.guaio && <Guaio testo={`Gli iscritti non si leggono: ${persone.guaio}`} />}
      {righe.length > 0 && (
        <ul className="bn-tabella" aria-label="Da pagare">
          <li className="bn-tabella-testa sg-etichetta" aria-hidden="true" style={{ gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1.2fr) 130px 120px 190px' }}>
            <span>NOME</span>
            <span>QUOTA</span>
            <span>DA QUANTO</span>
            <span>MANCA</span>
            <span />
          </li>
          {righe.map((r) => (
            <li key={r.persona.id} className="bn-tabella-riga" style={{ gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1.2fr) 130px 120px 190px' }}>
              <span style={{ fontWeight: 600 }}>
                {r.persona.cognome} {r.persona.nome}
              </span>
              <span>{COME[r.come]}</span>
              <span className="num" style={{ fontWeight: 700, color: r.giorni !== null && r.giorni > 10 ? 'var(--rosso-testo)' : 'var(--text)' }}>
                {QUANTO(r.giorni)}
              </span>
              <span className="num">{r.mancano !== undefined ? `€ ${euro(r.mancano)}` : '—'}</span>
              <button type="button" className="num sg-btn sg-btn-linea" onClick={() => onVai('iscritti', { persona: r.persona.id })}>
                FAI LA RICEVUTA
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

const intestatario = (r: Ricevuta) => [r.intestatario.cognome, r.intestatario.nome].filter(Boolean).join(' ') || '—'

/** RICEVUTE: tutte quelle fatte, dall'ultima. Prima stavano solo nella scheda di ogni persona. */
export function RicevuteElenco({ d }: { d: DatiSegreteria }) {
  const ricevute = useCarica(() => d.ricevute(), [d])
  const righe = ricevuteElenco(ricevute.dato ?? [])
  return (
    <>
      <Testa titolo="RICEVUTE" sotto={ricevute.dato ? (righe.length ? 'Tutte le ricevute semplici dell’associazione, dall’ultima. Il numero va avanti da sé.' : 'Nessuna ricevuta ancora.') : 'Un attimo…'} />
      {ricevute.guaio && <Guaio testo={`Le ricevute non si leggono: ${ricevute.guaio}`} />}
      {righe.length > 0 && (
        <ul className="bn-tabella" aria-label="Ricevute">
          <li className="bn-tabella-testa sg-etichetta" aria-hidden="true" style={{ gridTemplateColumns: '90px 150px minmax(0,1.2fr) 120px 140px' }}>
            <span>N.</span>
            <span>DATA</span>
            <span>NOME</span>
            <span>IMPORTO</span>
            <span />
          </li>
          {righe.map((r) => (
            <li key={r.id} className="bn-tabella-riga" style={{ gridTemplateColumns: '90px 150px minmax(0,1.2fr) 120px 140px' }}>
              <span className="num" style={{ fontWeight: 700 }}>
                {String(r.numero).padStart(4, '0')}/{r.anno}
              </span>
              {/* `data` è il giorno scritto sulla ricevuta; `creataIl` è un istante UTC e a cavallo di mezzanotte darebbe il giorno prima. */}
              <span>{dataLunga(r.data)}</span>
              <span style={{ fontWeight: 600 }}>{intestatario(r)}</span>
              <span className="num">€ {euro(r.totale)}</span>
              {r.annullataIl ? (
                <span className="num sg-tag" data-tipo="spento">
                  ANNULLATA
                </span>
              ) : (
                <button type="button" className="num sg-btn sg-btn-linea" onClick={() => void import('../../../lib/ricevutaPdf').then((m) => m.scaricaRicevuta(r, nomeFileRicevuta(r)))}>
                  STAMPA
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
