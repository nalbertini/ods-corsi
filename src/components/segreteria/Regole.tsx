import { useState } from 'react'
import type { DatiSegreteria, Sala } from '../../lib/segreteria'
import { INFORMATIVA, INFORMATIVA_BOZZA } from '../../lib/iscrizione'
import { Spunta } from '../Icons'
import { dataLunga, Testa, useAvviso, useCarica } from './comune'

/**
 * Le scelte che spettano alla palestra, non al codice: per quanto si tengono
 * le presenze, fin dove si prepara il calendario, le sale, la privacy.
 */
export function Regole({ d }: { d: DatiSegreteria }) {
  const imp = useCarica(() => d.impostazioni(), [d])
  const scadute = useCarica(() => d.scadute(), [d, imp.dato?.mesiPresenze])
  const pronto = useCarica(() => d.prontoFino(), [d])
  const sale = useCarica(() => d.sale(), [d])
  const persone = useCarica(() => d.persone(), [d])
  const { avviso, fai } = useAvviso()
  const [sala, setSala] = useState<{ id?: string; nome: string; capienza?: number } | null>(null)
  const [chi, setChi] = useState('')

  const esporta = async () => {
    const p = persone.dato?.find((x) => x.id === chi)
    if (!p) return
    const dati = await d.esporta(chi)
    const url = URL.createObjectURL(new Blob([JSON.stringify(dati, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `dati-${p.cognome}-${p.nome}.json`.toLowerCase().replace(/\s+/g, '-')
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <Testa titolo="REGOLE E PRIVACY" sotto="Le scelte che spettano alla palestra, non al codice." />

      <div className="sg-regole">
        <section aria-label="Per quanto si tengono le presenze" className="sg-riquadro">
          <span className="ob sg-riquadro-titolo">PER QUANTO SI TENGONO LE PRESENZE</span>
          <div className="row" style={{ gap: 12 }}>
            <label htmlFor="mesi" className="vh">
              Mesi
            </label>
            <select
              id="mesi"
              className="sg-campo"
              value={imp.dato?.mesiPresenze ?? 24}
              onChange={(e) => void fai(() => d.salvaImpostazioni({ mesiPresenze: Number(e.target.value) }), 'Periodo cambiato', imp.ricarica)}
            >
              {[12, 24, 36, 60].map((m) => (
                <option key={m} value={m}>
                  {m} mesi
                </option>
              ))}
            </select>
            <span className="sg-sotto">dopo, si cancellano</span>
          </div>
          <div className="row sg-voce-elenco" style={{ gap: 12 }}>
            <span className="stack grow">
              <span style={{ fontSize: 15, fontWeight: 600 }}>
                {scadute.dato === null ? '…' : scadute.dato === 0 ? 'Nessuna presenza scaduta' : `${scadute.dato} presenze scadute`}
              </span>
              <span style={{ fontSize: 12, color: 'var(--dim)' }}>
                {d.modo === 'prova' ? 'In prova si cancellano da qui.' : 'Si cancellano col job mensile (vedi supabase/LEGGIMI.md), o da qui.'}
              </span>
            </span>
            <button
              type="button"
              className="num sg-chip"
              disabled={!scadute.dato}
              onClick={() => {
                if (window.confirm(`Cancellare ${scadute.dato} presenze più vecchie di ${imp.dato?.mesiPresenze ?? 24} mesi? Non si recuperano.`)) {
                  void fai(() => d.pulisci(), 'Presenze scadute cancellate', scadute.ricarica)
                }
              }}
            >
              CANCELLA ORA
            </button>
          </div>
          <span style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--dim)' }}>
            Ventiquattro mesi è il valore di partenza, non una regola di legge: la scelta è della palestra, titolare del trattamento, e va scritta
            nell'informativa.
          </span>
        </section>

        <section aria-label="Il calendario" className="sg-riquadro">
          <span className="ob sg-riquadro-titolo">IL CALENDARIO</span>
          <div className="sg-due">
            <div className="sg-numero">
              <span className="sg-etichetta">PRONTO FINO AL</span>
              <span className="num" style={{ fontSize: 26, fontWeight: 700 }}>{pronto.dato ? dataLunga(pronto.dato).toUpperCase() : '—'}</span>
            </div>
            <div className="sg-numero">
              <span className="sg-etichetta">SI ALLUNGA</span>
              <span className="num" style={{ fontSize: 26, fontWeight: 700 }}>{d.modo === 'prova' ? 'DA SÉ' : 'OGNI LUNEDÌ'}</span>
            </div>
          </div>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <label htmlFor="avanti" style={{ fontSize: 14, color: 'var(--sec)' }}>
              Genera le lezioni per i prossimi
            </label>
            <select
              id="avanti"
              className="sg-campo"
              value={imp.dato?.giorniCalendario ?? 60}
              onChange={(e) => void fai(() => d.salvaImpostazioni({ giorniCalendario: Number(e.target.value) }), 'Cambiato: vale dal prossimo RIGENERA', imp.ricarica)}
            >
              {[30, 60, 90, 180].map((g) => (
                <option key={g} value={g}>
                  {g} giorni
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="sg-btn sg-btn-linea"
            style={{ alignSelf: 'flex-start' }}
            onClick={() =>
              void fai(
                () => d.rigenera(),
                d.modo === 'prova' ? 'In prova le lezioni si calcolano dalle ricorrenze: sono già tutte lì.' : 'Calendario allungato',
                pronto.ricarica,
              )
            }
          >
            RIGENERA ADESSO
          </button>
          <span style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--dim)' }}>
            Rigenerare non duplica e non tocca le lezioni che hanno già un appello, anche a cavallo del cambio d'ora.
          </span>
        </section>

        <section aria-label="Le sale" className="sg-riquadro">
          <span className="ob sg-riquadro-titolo">LE SALE</span>
          {(sale.dato ?? []).map((s: Sala) =>
            sala?.id === s.id ? (
              <FormSala key={s.id} sala={sala} setSala={setSala} onSalva={() => void fai(() => d.salvaSala(sala), 'Sala salvata', async () => {
                setSala(null)
                await sale.ricarica()
              })} />
            ) : (
              <div key={s.id} className="row sg-voce-elenco" style={{ gap: 12 }}>
                <span className="grow" style={{ fontSize: 15, fontWeight: 600 }}>{s.nome}</span>
                <span className="num" style={{ fontSize: 14, color: 'var(--sec)' }}>{s.capienza ? `${s.capienza} posti` : 'posti non detti'}</span>
                <button type="button" className="num sg-chip" style={{ minHeight: 36 }} onClick={() => setSala({ id: s.id, nome: s.nome, capienza: s.capienza })}>
                  CAMBIA
                </button>
              </div>
            ),
          )}
          {sala && !sala.id ? (
            <FormSala sala={sala} setSala={setSala} onSalva={() => void fai(() => d.salvaSala(sala), 'Sala aggiunta', async () => {
              setSala(null)
              await sale.ricarica()
            })} />
          ) : (
            <button type="button" className="sg-btn sg-btn-tratteggio" onClick={() => setSala({ nome: '' })}>
              + AGGIUNGI UNA SALA
            </button>
          )}
        </section>

        <section aria-label="Privacy" className="sg-riquadro">
          <div className="row" style={{ gap: 10 }}>
            <span className="ob sg-riquadro-titolo grow">PRIVACY</span>
            <span className="num sg-tag" data-tipo={INFORMATIVA && !INFORMATIVA_BOZZA ? undefined : 'manca'} style={{ fontSize: 11, padding: '2px 6px' }}>
              {!INFORMATIVA ? 'DA FARE PRIMA DI PARTIRE' : INFORMATIVA_BOZZA ? 'BOZZA DA APPROVARE' : 'INFORMATIVA COLLEGATA'}
            </span>
          </div>
          <div className="stack" style={{ gap: 6 }}>
            <span className="sg-etichetta">L'INFORMATIVA</span>
            {INFORMATIVA ? (
              <>
                <a href={INFORMATIVA} target="_blank" rel="noreferrer" style={{ fontSize: 14, color: 'var(--sec)', wordBreak: 'break-all' }}>
                  {INFORMATIVA_BOZZA ? 'Leggi la bozza' : "Apri l'informativa"}
                </a>
                {INFORMATIVA_BOZZA && (
                  <span style={{ fontSize: 14, color: 'var(--sec)', lineHeight: 1.5 }}>
                    Scritta insieme all'app, non ancora approvata: la palestra, che è titolare del trattamento, la deve leggere e fare sua, e
                    decidere i punti in giallo (per quanto si tengono richieste, documenti e ricevute, dove si pubblica l'app). Poi si toglie il
                    riquadro BOZZA dalla pagina e <code>INFORMATIVA_BOZZA</code> in <code>src/lib/iscrizione.ts</code>. Fino ad allora, col database
                    vero, il pubblico non la vede e il modulo di iscrizione resta spento.
                  </span>
                )}
              </>
            ) : (
              <span style={{ fontSize: 14, color: 'var(--sec)', lineHeight: 1.5 }}>
                Non c'è ancora. Il link va messo in <code>src/lib/iscrizione.ts</code>, accanto a quello del modulo di iscrizione: si vede in fondo alla scheda
                ISCRIZIONI, a tutti. Finché manca, col database vero il modulo di iscrizione dell'app resta spento e il passo porta ancora al modulo Google:
                chiede codici fiscali e documenti, e prima va detto come si trattano.
              </span>
            )}
          </div>
          <div className="stack" style={{ gap: 6 }}>
            <span className="sg-etichetta" style={{ color: 'var(--giallo-testo)' }}>NIENTE DATI SANITARI</span>
            <span style={{ fontSize: 14, color: 'var(--sec)', lineHeight: 1.5 }}>
              Certificati medici, patologie e simili sono un'altra categoria di dati, con altri obblighi. In nessun campo, nemmeno nelle note.
            </span>
          </div>
          <div className="stack" style={{ gap: 6 }}>
            <label htmlFor="esporta" className="sg-etichetta">
              ESPORTA I DATI DI UNA PERSONA
            </label>
            <div className="row" style={{ gap: 8 }}>
              <select id="esporta" className="sg-campo grow" value={chi} onChange={(e) => setChi(e.target.value)}>
                <option value="">Chi li ha chiesti…</option>
                {[...(persone.dato ?? [])]
                  .sort((a, b) => a.cognome.localeCompare(b.cognome, 'it') || a.nome.localeCompare(b.nome, 'it'))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.cognome} {p.nome}
                    </option>
                  ))}
              </select>
              <button type="button" className="num sg-chip sg-chip-pieno" disabled={!chi} onClick={() => void fai(esporta, 'File scaricato')}>
                ESPORTA
              </button>
            </div>
            <span style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.5 }}>
              Un file con anagrafica, iscrizioni e presenze: è quello che una persona ha diritto di chiedere.
            </span>
          </div>
        </section>
      </div>
      {avviso}
    </>
  )
}

function FormSala({
  sala,
  setSala,
  onSalva,
}: {
  sala: { id?: string; nome: string; capienza?: number }
  setSala: (s: { id?: string; nome: string; capienza?: number } | null) => void
  onSalva: () => void
}) {
  return (
    <form
      className="row sg-voce-elenco"
      style={{ gap: 8, borderColor: 'var(--text)' }}
      onSubmit={(e) => {
        e.preventDefault()
        onSalva()
      }}
    >
      <input className="sg-campo grow" aria-label="Nome della sala" required autoFocus value={sala.nome} onChange={(e) => setSala({ ...sala, nome: e.target.value })} />
      <input
        className="sg-campo"
        style={{ width: 90 }}
        aria-label="Posti"
        type="number"
        min={1}
        placeholder="posti"
        value={sala.capienza ?? ''}
        onChange={(e) => setSala({ ...sala, capienza: e.target.value ? Number(e.target.value) : undefined })}
      />
      <button type="button" className="num sg-chip" style={{ minHeight: 44 }} onClick={() => setSala(null)}>
        LASCIA STARE
      </button>
      <button type="submit" className="num sg-chip sg-chip-pieno" style={{ minHeight: 44 }} aria-label="Salva la sala">
        <Spunta size={18} />
      </button>
    </form>
  )
}
