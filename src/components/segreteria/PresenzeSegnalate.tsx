import { useState } from 'react'
import type { DatiSegreteria } from '../../lib/segreteria'
import type { SegnalataVista } from '../../lib/segnalate'
import { chiaveGiorno, giornoPerEsteso, oraDi } from '../../lib/sala'
import { Guaio, Testa, useAvviso, useCarica, useOrdina } from './comune'
import type { Destinazione, Voce } from './Segreteria'

/** Per ordinare per stato: prima quelle da vedere. */
const ORDINE_STATI: Record<SegnalataVista['stato'], number> = { da_vedere: 0, accolta: 1, rifiutata: 2 }
const quando = (iso: string) => `${giornoPerEsteso(chiaveGiorno(new Date(iso)))}, ${oraDi(iso)}`

/**
 * Le presenze segnalate dagli iscritti dalla loro pagina (vedi
 * `segnalate.ts`): chi dice di esserci stato e nell'appello non risulta. La
 * segreteria le accoglie (l'iscritto diventa presente) o le rifiuta; le può
 * vedere anche l'istruttore della lezione, dall'appello. Per ora solo in prova.
 */
export function PresenzeSegnalate({ d, onCambiato, onVai }: { d: DatiSegreteria; onCambiato?: () => void; onVai: (v: Voce, d?: Destinazione) => void }) {
  const elenco = useCarica(() => d.segnalate?.() ?? Promise.resolve([]), [d])
  const [tutte, setTutte] = useState(false)
  const { avviso, fai, lavora } = useAvviso()

  const daVedere = (elenco.dato ?? []).filter((x) => x.stato === 'da_vedere')
  const lista = tutte ? (elenco.dato ?? []) : daVedere
  const { ordina, colonna } = useOrdina<SegnalataVista, 'iscritto' | 'lezione' | 'nota' | 'segnalata' | 'stato'>({
    iscritto: (x) => `${x.cognome} ${x.nome}`,
    lezione: (x) => x.inizio,
    nota: (x) => x.nota,
    segnalata: (x) => x.il,
    stato: (x) => ORDINE_STATI[x.stato],
  })

  const gestisci = (x: SegnalataVista, accogli: boolean) =>
    void fai(
      () => d.gestisciSegnalata!(x.id, accogli),
      accogli ? `${x.nome} è presente` : `Segnalazione di ${x.nome} rifiutata`,
      async () => {
        await elenco.ricarica()
        onCambiato?.()
      },
    )

  return (
    <>
      <Testa
        titolo="PRESENZE SEGNALATE"
        sotto={daVedere.length === 1 ? 'Una da vedere.' : daVedere.length ? `${daVedere.length} da vedere.` : 'Nessuna da vedere.'}
      >
        <button type="button" className="num sg-chip" aria-pressed={tutte} onClick={() => setTutte(!tutte)}>
          ANCHE QUELLE GIÀ GESTITE
        </button>
      </Testa>

      <p className="sg-sotto" style={{ maxWidth: 760, margin: 0 }}>
        Un iscritto che c’era e nell’appello non risulta lo segnala dalla sua pagina. Accolta, risulta presente; rifiutata, resta com’era. Le vede anche
        l’istruttore della lezione, nel suo appello: le gestisce chi arriva prima.
      </p>

      {elenco.guaio && <Guaio testo={elenco.guaio} />}

      <div role="table" aria-label="Presenze segnalate" className="sg-tabella">
        <div role="row" className="sg-lista-testa sg-riga-presenza-istr">
          {colonna('iscritto', 'ISCRITTO')}
          {colonna('lezione', 'LEZIONE', { numeri: true })}
          {colonna('nota', 'NOTA')}
          {colonna('segnalata', 'SEGNALATA', { numeri: true })}
          {colonna('stato', 'STATO', { destra: true })}
        </div>
        <div className="sg-tabella-corpo">
          {elenco.dato === null && !elenco.guaio && <p className="sg-sotto" style={{ padding: '12px 14px' }}>Sto leggendo le segnalazioni…</p>}
          {elenco.dato !== null && lista.length === 0 && (
            <p className="sg-sotto" style={{ padding: '12px 14px' }}>
              {tutte ? 'Nessuna presenza segnalata.' : 'Niente da vedere. Le altre si vedono con «anche quelle già gestite».'}
            </p>
          )}
          {ordina(lista).map((x) => (
            <div key={x.id} role="row" className="sg-riga-presenza-istr sg-presenza-istr" data-spento={x.stato === 'rifiutata'} style={{ ['--tinta' as string]: x.colore ?? 'var(--line)' }}>
              <span role="cell">
                <button type="button" className="sg-link" style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }} onClick={() => onVai('iscritti', { persona: x.personaId })}>
                  {x.cognome} {x.nome}
                </button>
              </span>
              <span role="cell" className="stack" style={{ gap: 2 }}>
                <button type="button" className="sg-link" style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }} onClick={() => onVai('settimana', { lezione: { id: x.sessioneId, inizio: x.inizio } })}>
                  {x.corso}
                </button>
                <span style={{ fontSize: 13, color: 'var(--sec)' }}>
                  {giornoPerEsteso(chiaveGiorno(new Date(x.inizio)))}, {oraDi(x.inizio)}–{oraDi(x.fine)} · {x.segno === 'presente' ? 'ora presente' : x.segno === 'assente' ? 'era assente' : 'non segnato'}
                </span>
              </span>
              <span role="cell" style={{ fontSize: 13, color: x.nota ? 'var(--sec)' : 'var(--dim)' }}>{x.nota ?? '—'}</span>
              <span role="cell" style={{ fontSize: 13, color: 'var(--sec)' }}>{quando(x.il)}</span>
              <span role="cell" className="sg-presenza-istr-fine">
                {x.stato === 'da_vedere' ? (
                  <>
                    <button type="button" className="sg-btn sg-btn-verde" disabled={lavora} onClick={() => gestisci(x, true)}>
                      PRESENTE
                    </button>
                    <button type="button" className="sg-btn sg-btn-linea" disabled={lavora} onClick={() => gestisci(x, false)}>
                      RIFIUTA
                    </button>
                  </>
                ) : (
                  <span className="stack" style={{ gap: 2 }}>
                    <span className="num" style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', color: x.stato === 'accolta' ? 'var(--verde-testo)' : 'var(--rosso-testo)' }}>
                      {x.stato === 'accolta' ? 'ACCOLTA' : 'RIFIUTATA'}
                    </span>
                    {x.gestitaIl && (
                      <span style={{ fontSize: 12, color: 'var(--dim)' }}>
                        {x.gestitaDa ? `da ${x.gestitaDa}, ` : ''}
                        {quando(x.gestitaIl)}
                      </span>
                    )}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
      {avviso}
    </>
  )
}
