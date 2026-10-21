import { useState } from 'react'
import type { Anagrafica, DatiSegreteria, PersonaleSeg } from '../../lib/segreteria'
import { conProvincia } from '../../lib/segreteria'
import { dataLunga } from '../../lib/sala'
import { centesimiDaEuro, cosaNonVaEuroOra, euroDaScrivere, euroOra, righeTariffe } from '../../lib/tariffe'
import { Campo, chiedi, Guaio, Riga, useAvviso, useCarica } from './comune'
import { ModificaAnagrafica, type CampoAnagrafica } from './Iscritti'

type Fai = ReturnType<typeof useAvviso>['fai']

/** Quelli che vanno sulla lettera d'incarico e sulla ricevuta del compenso, nell'ordine in cui si scrivono. */
const CAMPI_TECNICO: CampoAnagrafica[] = [
  { k: 'natoA', etichetta: 'Luogo di nascita', max: 80 },
  { k: 'provinciaNascita', etichetta: 'Provincia di nascita', codice: true, max: 4 },
  { k: 'natoIl', etichetta: 'Data di nascita', tipo: 'date', max: 10 },
  { k: 'codiceFiscale', etichetta: 'Codice fiscale', codice: true, max: 16 },
  { k: 'indirizzo', etichetta: 'Indirizzo', largo: true, max: 160 },
  { k: 'cap', etichetta: 'CAP', max: 5 },
  { k: 'comune', etichetta: 'Comune', max: 80 },
  { k: 'provincia', etichetta: 'Provincia', codice: true, max: 4 },
  // Con gli spazi a gruppi di quattro: l'app li toglie prima di salvare.
  { k: 'iban', etichetta: 'IBAN', codice: true, largo: true, max: 42 },
]


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
          <Campo etichetta="LUOGO DI NASCITA">{valore(conProvincia(x.natoA, x.provinciaNascita))}</Campo>
          <Campo etichetta="DATA DI NASCITA">{valore(x.natoIl && dataLunga(x.natoIl))}</Campo>
          <Campo etichetta="CODICE FISCALE" largo>{valore(x.codiceFiscale, true)}</Campo>
          <Campo etichetta="RESIDENZA" largo>{valore([x.indirizzo, conProvincia([x.cap, x.comune].filter(Boolean).join(' '), x.provincia)].filter(Boolean).join(' · '))}</Campo>
          {/* A gruppi di quattro, per controllarlo a voce: il dato salvato resta senza spazi. */}
          <Campo etichetta="IBAN" largo>{valore(x.iban?.replace(/(.{4})/g, '$1 ').trim(), true)}</Campo>
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
    // shortcut: legge le presenze di tutti per un anno solo per trovare i corsi fatti da sostituto; se pesa, una lettura per persona.
    const [tariffe, corsi, presenze] = await Promise.all([d.tariffe(p.id), d.corsi(), d.presenzeIstruttori(366).then((x) => x, () => null)])
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
  const righe = righeTariffe(p.id, p.corsi, presenze ?? [], tariffe, corsi)
  const centesimi = scrive && centesimiDaEuro(scrive.testo)

  const salva = (corsoId: string | undefined, c: number | null) => {
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
                {r.perche !== 'titolare' && <span style={{ fontSize: 13, color: 'var(--dim)' }}>{r.perche === 'sostituto' ? 'da sostituto' : 'non lo insegna più'}</span>}
              </span>
              {scrive?.corso === r.corso ? (
                <form
                  role="cell"
                  className="row"
                  style={{ gap: 8, flexWrap: 'wrap' }}
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (centesimi) salva(r.corsoId, centesimi)
                  }}
                >
                  <input
                    className="sg-campo num"
                    style={{ width: 100 }}
                    inputMode="decimal"
                    aria-label={`Euro l’ora per ${r.corso}`}
                    autoFocus
                    aria-invalid={!!cosaNonVaEuroOra(scrive.testo)}
                    aria-describedby={`tariffa-${r.corsoId ?? r.corso.replace(/\W/g, "")}`}
                    value={scrive.testo}
                    onChange={(e) => setScrive({ ...scrive, testo: e.target.value })}
                  />
                  <span style={{ fontSize: 14 }}>€ l’ora</span>
                  <button type="submit" className="num sg-chip sg-chip-pieno" disabled={!centesimi}>
                    OK
                  </button>
                  {r.centesimi !== undefined && (
                    <button
                      type="button"
                      className="sg-link sg-link-alto sg-pericolo" style={{ fontSize: 14 }}
                      onClick={async () => {
                        if (await chiedi(`Togliere la tariffa di ${r.corso}? Le ricevute già fatte non cambiano.`, 'Togli', { pericolo: true })) salva(r.corsoId, null)
                      }}
                    >
                      togli
                    </button>
                  )}
                  <button type="button" className="sg-link sg-link-alto" style={{ fontSize: 14 }} onClick={() => setScrive(null)}>
                    lascia stare
                  </button>
                  {cosaNonVaEuroOra(scrive.testo) && (
                    <span id={`tariffa-${r.corsoId ?? r.corso.replace(/\W/g, "")}`} role="alert" style={{ flexBasis: '100%', fontSize: 13, color: 'var(--rosso-testo)' }}>
                      {cosaNonVaEuroOra(scrive.testo)}.
                    </span>
                  )}
                </form>
              ) : (
                <span role="cell" className="row" style={{ gap: 12 }}>
                  {r.centesimi !== undefined ? (
                    <span className="num" style={{ fontSize: 15 }}>{euroOra(r.centesimi)}</span>
                  ) : (
                    <span className="sg-segno-regola" data-tono="rosso">SENZA TARIFFA</span>
                  )}
                  <button
                    type="button"
                    className="sg-link sg-link-alto" style={{ fontSize: 14 }}
                    disabled={!r.corsoId}
                    onClick={() => setScrive({ corso: r.corso, testo: r.centesimi === undefined ? '' : euroDaScrivere(r.centesimi) })}
                  >
                    {r.centesimi === undefined ? 'Scrivi' : 'Cambia'}
                  </button>
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      {presenze === null && <span className="sg-sotto">Le presenze non si sono lette: mancano i corsi fatti da sostituto. Riapri la scheda fra poco.</span>}
      <span className="sg-sotto">Un corso compare qui appena lo insegna, anche da sostituto. Cambiare una tariffa non tocca le ricevute già fatte.</span>
    </div>
  )
}
