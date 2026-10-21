import { useState } from 'react'
import type { Anagrafica, DatiSegreteria, PersonaleSeg } from '../../lib/segreteria'
import { conProvincia } from '../../lib/segreteria'
import { dataLunga } from '../../lib/sala'
import { centesimiDaEuro, cosaNonVaEuroOra, euroDaScrivere, euroOra, righeTariffe } from '../../lib/tariffe'
import { cosaNonVaLettera, datiPerLettera, lettereDellaScheda, importoInLettere, propostaLettera, QUALIFICHE, stagioneDi, type DatiLettera, type Lettera, type ScelteLettera } from '../../lib/lettere'
import { euro } from '../../lib/ricevute'
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

const oggi = () => new Date().toLocaleDateString('sv-SE')

/**
 * La lettera d'incarico della stagione: si prepara qui, si stampa e si fa
 * firmare; quando il foglio firmato torna, si spunta «Firmata». Correggerla ne
 * fa una nuova: la vecchia resta, sostituita, e si può ristampare.
 */
export function LetteraIncarico({ d, p, fai }: { d: DatiSegreteria; p: PersonaleSeg; fai: Fai }) {
  const stagione = stagioneDi(oggi())
  const dati = useCarica(async () => {
    const [lettere, an, tariffe] = await Promise.all([d.lettere(p.id), d.anagraficaDi(p.id), d.tariffe(p.id)])
    return { lettere, an: an?.dati ?? null, tariffe }
  }, [d, p.id])
  const [scelte, setScelte] = useState<ScelteLettera | null>(null)

  if (dati.guaio)
    return (
      <div className="stack" style={{ gap: 8 }}>
        <Riga titolo="LETTERA D’INCARICO" />
        <Guaio testo={dati.guaio} />
      </div>
    )
  if (!dati.dato) return null
  const { lettere, an, tariffe } = dati.dato
  const { valida, altre } = lettereDellaScheda(lettere, stagione)
  const stampa = (l: DatiLettera) => void fai(async () => (await import('../../lib/letteraPdf')).scaricaLettera(l))

  if (scelte) {
    const nuova = datiPerLettera(p, an, tariffe, scelte)
    const no = cosaNonVaLettera(nuova)
    return (
      <div className="stack" style={{ gap: 12 }}>
        <Riga titolo={`LETTERA D’INCARICO · ${scelte.stagione}`} />
        <div className="sg-due">
          <Campo id="li-dal" etichetta="DAL">
            <input id="li-dal" type="date" className="sg-campo" value={scelte.dal} onChange={(e) => setScelte({ ...scelte, dal: e.target.value })} />
          </Campo>
          <Campo id="li-al" etichetta="AL">
            <input id="li-al" type="date" className="sg-campo" value={scelte.al} onChange={(e) => setScelte({ ...scelte, al: e.target.value })} />
          </Campo>
          <Campo id="li-qualifica" etichetta="QUALIFICA">
            <select id="li-qualifica" className="sg-campo" value={scelte.qualifica} onChange={(e) => setScelte({ ...scelte, qualifica: e.target.value })}>
              {QUALIFICHE.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </Campo>
          <Campo id="li-giorni" etichetta="GIORNI PREFERITI">
            <input id="li-giorni" className="sg-campo" maxLength={80} placeholder="venerdì" value={scelte.giorni} onChange={(e) => setScelte({ ...scelte, giorni: e.target.value })} />
          </Campo>
          <Campo id="li-data" etichetta="DATA DELLA LETTERA">
            <input id="li-data" type="date" className="sg-campo" value={scelte.data} onChange={(e) => setScelte({ ...scelte, data: e.target.value })} />
          </Campo>
        </div>
        <span className="sg-sotto">Proposto da settembre a luglio: per chi arriva dopo, cambia la data di inizio.</span>
        <div className="stack" style={{ gap: 4 }}>
          <span className="sg-etichetta">IL COMPENSO, SULLA LETTERA</span>
          {nuova.tariffe.length ? (
            nuova.tariffe.map((t) => (
              <span key={t.corso} style={{ fontSize: 15 }}>
                € {euro(t.centesimi)} ({importoInLettere(t.centesimi)}) l’ora per il corso {t.corso}
              </span>
            ))
          ) : (
            <span style={{ fontSize: 15, color: 'var(--dim)' }}>Nessuna tariffa.</span>
          )}
          <span className="sg-sotto">Dalle TARIFFE qui sopra: per cambiarle, lascia stare e cambiale lì.</span>
        </div>
        {no && (
          <span role="alert" style={{ fontSize: 13, color: 'var(--rosso-testo)' }}>
            {no}.
          </span>
        )}
        <span className="sg-sotto">Esce la lettera da stampare con tre firme a mano: il Presidente, «per accettazione» e l’approvazione dei punti 4 e 5.</span>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="sg-btn sg-btn-linea" onClick={() => setScelte(null)}>
            Lascia stare
          </button>
          <button type="button" className="sg-btn sg-btn-linea" disabled={!!no} onClick={() => stampa(nuova)}>
            Vedi il PDF
          </button>
          <button
            type="button"
            className="sg-btn sg-btn-pieno"
            disabled={!!no}
            onClick={() =>
              void fai(async () => {
                const fatta = await d.faiLettera(nuova)
                await (await import('../../lib/letteraPdf')).scaricaLettera(fatta)
              }, valida ? 'Lettera corretta: quella di prima resta, sostituita' : 'Lettera fatta', async () => {
                setScelte(null)
                await dati.ricarica()
              })
            }
          >
            Salva e stampa
          </button>
        </div>
      </div>
    )
  }

  // Tariffe e dati si rileggono: possono essere appena cambiati qui sopra.
  const prepara = () => void dati.ricarica().then(() => setScelte(valida ? { stagione, dal: valida.dal, al: valida.al, qualifica: valida.qualifica, giorni: valida.giorni, data: valida.data } : { stagione, ...propostaLettera(stagione), qualifica: 'Allenatore', giorni: '' }))
  const quando = (l: Lettera) => `lettera del ${dataLunga(l.data)}`

  return (
    <div className="stack" style={{ gap: 8 }}>
      <Riga titolo={`LETTERA D’INCARICO · ${stagione}`} />
      {valida ? (
        <div className="stack" style={{ gap: 10, padding: '14px 16px', border: '2px solid var(--line-soft)' }}>
          <span className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
            <span className="sg-segno-regola" data-tono="verde">VALIDA</span>
            <span style={{ fontSize: 15, fontWeight: 600 }}>
              dal {dataLunga(valida.dal)} al {dataLunga(valida.al)} · {valida.qualifica}
            </span>
          </span>
          <span className="sg-sotto">
            {[valida.giorni, valida.tariffe.map((t) => `${euroOra(t.centesimi)} per ${t.corso}`).join(', '), quando(valida)].filter(Boolean).join(' · ')}
          </span>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" className="sg-btn sg-btn-linea" onClick={() => stampa(valida)}>
              Stampa la lettera
            </button>
            <button type="button" className="sg-btn sg-btn-linea" onClick={prepara}>
              Correggi
            </button>
            <label className="row" style={{ gap: 8, minHeight: 44, fontSize: 14, fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={valida.firmata}
                onChange={(e) => void fai(() => d.segnaFirmata(valida.id, e.target.checked), e.target.checked ? 'Segnata firmata' : 'Tolta la spunta', dati.ricarica)}
              />
              Firmata
            </label>
          </div>
        </div>
      ) : (
        <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="sg-sotto">Nessuna lettera per la stagione {stagione}.</span>
          <button type="button" className="sg-btn sg-btn-pieno" onClick={prepara}>
            Prepara la lettera
          </button>
        </div>
      )}
      {altre.map((l) => (
        <span key={l.id} className="row" style={{ gap: 12, flexWrap: 'wrap', fontSize: 13, color: 'var(--dim)' }}>
          {l.sostituitaIl ? `Sostituita · ${l.stagione} · ${quando(l)} · sostituita il ${dataLunga(l.sostituitaIl.slice(0, 10))}` : `${l.stagione} · ${quando(l)}${l.firmata ? ' · firmata' : ''}`}
          <button type="button" className="sg-link sg-link-alto" style={{ fontSize: 13 }} onClick={() => stampa(l)}>
            Stampa
          </button>
        </span>
      ))}
    </div>
  )
}
