import { useState } from 'react'
import type { Anagrafica, DatiSegreteria, PersonaleSeg } from '../../lib/segreteria'
import { dataLunga } from '../../lib/sala'
import { centesimiDaEuro, euroOra, righeTariffe } from '../../lib/tariffe'
import { Campo, Guaio, Riga, useAvviso, useCarica } from './comune'
import { ModificaAnagrafica, type CampoAnagrafica } from './Iscritti'

type Fai = ReturnType<typeof useAvviso>['fai']

/** Quelli che vanno sulla lettera d'incarico e sulla ricevuta del compenso, nell'ordine in cui si scrivono. */
const CAMPI_TECNICO: CampoAnagrafica[] = [
  { k: 'natoA', etichetta: 'Nato a', max: 80 },
  { k: 'provinciaNascita', etichetta: 'Provincia di nascita', codice: true, max: 2 },
  { k: 'natoIl', etichetta: 'Data di nascita', tipo: 'date', max: 10 },
  { k: 'codiceFiscale', etichetta: 'Codice fiscale', codice: true, max: 16 },
  { k: 'indirizzo', etichetta: 'Indirizzo', largo: true, max: 160 },
  { k: 'cap', etichetta: 'CAP', max: 5 },
  { k: 'comune', etichetta: 'Comune', max: 80 },
  { k: 'provincia', etichetta: 'Provincia', codice: true, max: 2 },
  { k: 'iban', etichetta: 'IBAN', codice: true, largo: true, max: 34 },
]

const conProvincia = (luogo?: string, provincia?: string) => [luogo, provincia && `(${provincia})`].filter(Boolean).join(' ')

/**
 * Nascita, residenza e IBAN del tecnico: vanno sulla lettera d'incarico e su
 * ogni ricevuta del compenso. Sono la stessa anagrafica degli iscritti, e come
 * quella li vede solo la segreteria.
 */
export function DatiTecnico({ d, p, fai }: { d: DatiSegreteria; p: PersonaleSeg; fai: Fai }) {
  const an = useCarica(async () => ({ di: await d.anagraficaDi(p.id) }), [d, p.id])
  const [modifica, setModifica] = useState<Anagrafica | null>(null)
  const x = an.dato?.di?.dati
  const valore = (testo?: string, codice = false) => (
    <span className={codice ? 'num sg-valore' : 'sg-valore'} style={{ color: testo ? 'var(--text)' : 'var(--dim)', overflowWrap: 'anywhere', letterSpacing: codice ? '0.04em' : undefined }}>
      {testo || '—'}
    </span>
  )

  if (modifica)
    return (
      <ModificaAnagrafica
        d={d}
        p={p}
        fai={fai}
        dati={modifica}
        onCambia={setModifica}
        campi={CAMPI_TECNICO}
        titolo="DATI PER LETTERA E RICEVUTE"
        onFatto={() => {
          setModifica(null)
          void an.ricarica()
        }}
      />
    )

  return (
    <div className="stack" style={{ gap: 8 }}>
      <Riga titolo="DATI PER LETTERA E RICEVUTE">
        {an.dato && (
          <button type="button" className="num sg-chip" onClick={() => setModifica({ ...(an.dato?.di?.dati ?? {}) })}>
            {an.dato.di ? 'Modifica i dati' : 'Aggiungi i dati'}
          </button>
        )}
      </Riga>
      {an.guaio && <Guaio testo={an.guaio} />}
      {x ? (
        <div className="sg-due">
          <Campo etichetta="NATO A">{valore(conProvincia(x.natoA, x.provinciaNascita))}</Campo>
          <Campo etichetta="DATA DI NASCITA">{valore(x.natoIl && dataLunga(x.natoIl))}</Campo>
          <Campo etichetta="CODICE FISCALE">{valore(x.codiceFiscale, true)}</Campo>
          <Campo etichetta="RESIDENZA">{valore([x.indirizzo, conProvincia([x.cap, x.comune].filter(Boolean).join(' '), x.provincia)].filter(Boolean).join(' · '))}</Campo>
          <Campo etichetta="IBAN" largo>{valore(x.iban, true)}</Campo>
        </div>
      ) : (
        an.dato && <span className="sg-sotto">Nessun dato: servono per la lettera d’incarico e le ricevute dei compensi.</span>
      )}
      <span className="sg-sotto">Li vede solo la segreteria.</span>
    </div>
  )
}

/**
 * Quanto prende per un'ora di lezione, corso per corso: quelli di cui è
 * titolare e quelli in cui ha fatto lezione nell'ultimo anno, anche da
 * sostituto. Una tariffa cambiata vale per le ricevute che si fanno dopo.
 */
export function Tariffe({ d, p, fai }: { d: DatiSegreteria; p: PersonaleSeg; fai: Fai }) {
  const dati = useCarica(async () => {
    const [tariffe, corsi, presenze] = await Promise.all([d.tariffe(p.id), d.corsi(), d.presenzeIstruttori(366).catch(() => [])])
    return { tariffe, corsi, presenze }
  }, [d, p.id])
  const [scrive, setScrive] = useState<{ corso: string; testo: string } | null>(null)
  if (dati.guaio) return (
    <div className="stack" style={{ gap: 8 }}>
      <Riga titolo="TARIFFE" />
      <Guaio testo={dati.guaio} />
    </div>
  )
  if (!dati.dato) return null
  const { tariffe, corsi, presenze } = dati.dato
  const fatti = presenze.filter((x) => x.personaId === p.id && x.stato === 'confermata').map((x) => x.corso)
  const righe = righeTariffe(p.corsi, fatti, tariffe)
  const idDi = (corso: string) => tariffe.find((t) => t.corso === corso)?.corsoId ?? corsi.find((c) => c.nome === corso)?.id
  const centesimi = scrive && centesimiDaEuro(scrive.testo)

  const salva = (corso: string, c: number | null) => {
    const corsoId = idDi(corso)
    if (!corsoId) return
    void fai(() => d.salvaTariffa(p.id, corsoId, c), c === null ? 'Tariffa tolta' : 'Tariffa salvata', async () => {
      setScrive(null)
      await dati.ricarica()
    })
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      <Riga titolo="TARIFFE" />
      {righe.length === 0 && <span className="sg-sotto">Nessun corso: le tariffe si scrivono per i corsi che insegna.</span>}
      {righe.length > 0 && (
        <div role="table" aria-label={`Tariffe di ${p.nome}`} className="sg-tabella">
          {righe.map((r) => (
            <div key={r.corso} role="row" className="row" style={{ gap: 12, justifyContent: 'space-between', flexWrap: 'wrap', padding: '8px 14px', minHeight: 48, borderBottom: '1px solid var(--line-soft)' }}>
              <span role="cell" className="stack" style={{ gap: 2 }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{r.corso}</span>
                {r.daSostituto && <span style={{ fontSize: 13, color: 'var(--dim)' }}>{fatti.includes(r.corso) ? 'da sostituto' : 'non lo insegna più'}</span>}
              </span>
              {scrive?.corso === r.corso ? (
                <form
                  role="cell"
                  className="row"
                  style={{ gap: 8 }}
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (centesimi) salva(r.corso, centesimi)
                  }}
                >
                  <input
                    className="sg-campo num"
                    style={{ width: 100 }}
                    inputMode="decimal"
                    aria-label={`Euro l’ora per ${r.corso}`}
                    autoFocus
                    value={scrive.testo}
                    onChange={(e) => setScrive({ ...scrive, testo: e.target.value })}
                  />
                  <span style={{ fontSize: 14 }}>€ l’ora</span>
                  <button type="submit" className="num sg-chip sg-chip-pieno" disabled={!centesimi}>
                    OK
                  </button>
                  {r.centesimi !== undefined && (
                    <button type="button" className="sg-link" onClick={() => salva(r.corso, null)}>
                      togli
                    </button>
                  )}
                  <button type="button" className="sg-link" onClick={() => setScrive(null)}>
                    lascia stare
                  </button>
                </form>
              ) : (
                <span role="cell" className="row" style={{ gap: 12 }}>
                  {r.centesimi !== undefined ? (
                    <span className="num" style={{ fontSize: 15 }}>{euroOra(r.centesimi)}</span>
                  ) : (
                    <span className="num" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--rosso-testo)' }}>✕ SENZA TARIFFA</span>
                  )}
                  <button
                    type="button"
                    className="sg-link"
                    disabled={!idDi(r.corso)}
                    onClick={() => setScrive({ corso: r.corso, testo: r.centesimi === undefined ? '' : String(r.centesimi / 100).replace('.', ',') })}
                  >
                    {r.centesimi === undefined ? 'Scrivi' : 'Cambia'}
                  </button>
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      <span className="sg-sotto">Un corso compare qui appena lo insegna, anche da sostituto.</span>
    </div>
  )
}
