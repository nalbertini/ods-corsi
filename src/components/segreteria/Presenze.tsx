import { type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from 'react'
import type { DatiSegreteria, ProvaSeg, RigaRegistro } from '../../lib/segreteria'
import { chiaveGiorno, giornoPerEsteso, oraDi } from '../../lib/sala'
import type { Destinazione, Voce } from './Segreteria'
import { Guaio, Riga, Testa, useCarica, Tasto } from './comune'
import { csvRegistro } from '../../lib/presenzeCsv'
import { mesi } from '../../lib/ore'
import { accorcia, chiSiStaPerdendo, conAppello, DI_FILA, GIORNI_RECENTI } from '../../lib/frequenza'

/** Il registro del mese in un foglio da aprire con Excel: punto e virgola e BOM, come i fogli che si importano. */
function scaricaCsv(righe: RigaRegistro[], nome: string) {
  const testo = csvRegistro(righe)
  const url = URL.createObjectURL(new Blob(['﻿' + testo], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `presenze-${nome.toLowerCase().replace(/\s+/g, '-')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Le presenze: chi viene, chi si sta perdendo, quali appelli mancano, e
 * il registro del mese lezione per lezione, con i nomi.
 *
 * Tutto si conta dagli appelli fatti: una lezione passata senza appello non
 * dice che non è venuto nessuno, dice che nessuno ha segnato, e sta nel suo
 * riquadro invece di abbassare le medie.
 */
export function Presenze({ d, onVai, senzaAppello, schede }: { d: DatiSegreteria; onVai: (v: Voce, dove?: Destinazione) => void; senzaAppello?: boolean; schede?: ReactNode }) {
  // In cima, gli ultimi 30 giorni: quelli che conta DA FARE, a cavallo di due mesi.
  const periodi = useMemo(() => {
    const adesso = new Date()
    return [{ chiave: '30', da: new Date(adesso.getTime() - 30 * 24 * 60 * 60_000), a: adesso, nome: 'Ultimi 30 giorni' }, ...mesi()]
  }, [])
  const [periodo, setPeriodo] = useState(senzaAppello ? '30' : periodi[1].chiave)

  const [corso, setCorso] = useState('')
  const [tuttiPersi, setTuttiPersi] = useState(false)
  const p = periodi.find((x) => x.chiave === periodo) ?? periodi[0]

  const registro = useCarica(() => d.registro(p.da, p.a), [d, p])
  // Arrivati da DA FARE per gli appelli che mancano: la pagina si apre lì,
  // quando il registro è arrivato e sopra c'è già tutto quello che lo precede.
  const appelli = useRef<HTMLDetailsElement>(null)
  const arrivato = registro.dato !== null
  useEffect(() => {
    if (senzaAppello && arrivato) appelli.current?.scrollIntoView({ block: 'start' })
  }, [senzaAppello, arrivato])
  const prove = useCarica(() => d.prove(p.da, p.a), [d, p])
  // Chi si sta perdendo guarda più indietro del mese: le assenze di fila non si fermano al primo.
  const recenti = useCarica(() => d.registro(new Date(Date.now() - GIORNI_RECENTI * 24 * 60 * 60_000), new Date()), [d])

  const tutte = registro.dato ?? []
  const righe = tutte.filter((r) => !corso || r.corsoId === corso)
  const svolte = righe.filter((r) => r.stato !== 'annullata')
  const fatte = svolte.filter(conAppello)
  const mancanti = svolte.filter((r) => !conAppello(r)).sort((a, b) => b.inizio.localeCompare(a.inizio))
  const corsi = [...new Map(tutte.map((r) => [r.corsoId, r.corso])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'it'))

  const persi = useMemo(() => chiSiStaPerdendo(recenti.dato ?? [], corso), [recenti.dato, corso])
  const { visibili: primiPersi, nascoste: restanoPersi } = accorcia(persi, PRIMI_PERSI, tuttiPersi)

  return (
    <>
      <Testa titolo="PRESENZE" sotto="Chi si sta perdendo, quali appelli mancano, chi c'era lezione per lezione.">
        <label htmlFor="periodo" className="vh">
          Periodo
        </label>
        <select id="periodo" className="sg-campo" value={periodo} onChange={(e) => {
            // Un corso scelto che nel mese nuovo non c'è sparirebbe dal menu
            // pur continuando a filtrare: si riparte da tutti.
            setPeriodo(e.target.value)
            setCorso('')
          }}>
          {periodi.map((x) => (
            <option key={x.chiave} value={x.chiave}>
              {x.nome}
            </option>
          ))}
        </select>
        <label htmlFor="corso-p" className="vh">
          Corso
        </label>
        <select id="corso-p" className="sg-campo" value={corso} onChange={(e) => setCorso(e.target.value)}>
          <option value="">Tutti i corsi</option>
          {corsi.map(([id, nome]) => (
            <option key={id} value={id}>
              {nome}
            </option>
          ))}
        </select>
        <Tasto disabled={!righe.length} onClick={() => scaricaCsv(righe, p.nome)}>
          Scarica CSV
        </Tasto>
      </Testa>
      {schede}

      {registro.guaio && <Guaio testo={registro.guaio} />}

      {/* Le barre per corso e i numeri del mese stanno già in STATISTICHE. */}
      <button type="button" className="sg-btn sg-btn-linea" style={{ alignSelf: 'flex-start' }} onClick={() => onVai('statistiche')}>
        Com'è andato il mese: presenze per corso e per giorno → Statistiche
      </button>

      <div className="stack" style={{ gap: 20 }}>
          <section aria-label="Chi si sta perdendo" className="sg-riquadro">
            <Riga titolo={`CHI SI STA PERDENDO · ${persi.length}`}>
              <span style={{ fontSize: 12, color: 'var(--dim)' }}>{DI_FILA} assenze di fila o più</span>
            </Riga>
            {recenti.dato !== null && persi.length === 0 && <span style={{ fontSize: 14, color: 'var(--verde-testo)' }}>Nessuno: chi è iscritto viene.</span>}
            {primiPersi.map((x) => (
              <div key={x.id} className="sg-voce-elenco">
                <span className="stack grow" style={{ minWidth: 0 }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{x.nome}</span>
                  <span style={{ fontSize: 12, color: 'var(--dim)' }}>
                    {x.corsi.join(', ')} · {x.ultima ? `l'ultima volta ${giornoPerEsteso(chiaveGiorno(new Date(x.ultima)))}` : 'mai negli ultimi due mesi'}
                  </span>
                </span>
                <span className="num" style={{ fontSize: 18, fontWeight: 700, color: 'var(--rosso-testo)' }}>{x.fila}</span>
                <button type="button" className="num sg-chip" onClick={() => onVai('iscritti', { persona: x.id })}>
                  Apri la scheda
                </button>
              </div>
            ))}
            {(restanoPersi > 0 || tuttiPersi) && (
              <button type="button" className="sg-btn sg-btn-linea" style={{ alignSelf: 'flex-start' }} aria-expanded={tuttiPersi} onClick={() => setTuttiPersi(!tuttiPersi)}>
                {tuttiPersi ? 'Mostra meno' : `Mostra tutti i ${persi.length} (altri ${restanoPersi})`}
              </button>
            )}
          </section>

          <Chiudibile rif={appelli} titolo={`APPELLI MANCANTI${mancanti.length ? ` · ${mancanti.length}` : ''}`} aperta={mancanti.length > 0 || !!senzaAppello} allarme={mancanti.length > 0}>
            {registro.dato !== null && mancanti.length === 0 && <span style={{ fontSize: 14, color: 'var(--verde-testo)' }}>Nessuno: tutte le lezioni passate hanno l'appello.</span>}
            {mancanti.slice(0, 30).map((r) => (
              <div key={r.sessioneId} className="sg-voce-elenco" style={{ borderColor: 'var(--rosso)' }}>
                <span className="stack grow" style={{ minWidth: 0 }}>
                  <span className="ob" style={{ fontSize: 15, fontWeight: 700 }}>{r.corso.toUpperCase()}</span>
                  <span style={{ fontSize: 12, color: 'var(--dim)' }}>
                    {giornoPerEsteso(chiaveGiorno(new Date(r.inizio)))} · {oraDi(r.inizio)}
                    {r.istruttori ? ` · ${r.istruttori}` : ''}
                  </span>
                </span>
                <button type="button" className="num sg-chip" onClick={() => onVai('settimana', { lezione: { id: r.sessioneId, inizio: r.inizio } })}>
                  Fai l’appello ora
                </button>
              </div>
            ))}
            {mancanti.length > 30 && <span className="sg-sotto">…e altre {mancanti.length - 30}.</span>}
          </Chiudibile>

          <Prove prove={prove} corso={corso} onVai={onVai} />

          <Registro righe={fatte} caricato={registro.dato !== null} onVai={onVai} />
      </div>
    </>
  )
}

const PRIMI_PERSI = 5

/**
 * Una sezione lunga chiusa, con il titolo e il conto in vista: si apre da sola
 * solo quando c'è qualcosa da fare (`aperta`). `<details>` perché la tastiera e
 * chi legge lo schermo lo sanno già usare.
 */
function Chiudibile({ titolo, nota, aperta, allarme, rif, children }: { titolo: string; nota?: string; aperta?: boolean; allarme?: boolean; rif?: RefObject<HTMLDetailsElement>; children: ReactNode }) {
  // Lo stato è qui perché `open` controllato da React rimetterebbe a posto ogni apertura o chiusura a mano.
  const [apertoOra, setApertoOra] = useState(!!aperta)
  useEffect(() => setApertoOra(!!aperta), [aperta])
  return (
    <details ref={rif} className="sg-riquadro sg-chiudibile" data-allarme={!!allarme} open={apertoOra} onToggle={(e) => setApertoOra(e.currentTarget.open)}>
      <summary>
        <Riga titolo={titolo}>{nota && <span style={{ fontSize: 12, color: 'var(--dim)' }}>{nota}</span>}</Riga>
      </summary>
      <div className="stack" style={{ gap: 10 }}>
        {children}
      </div>
    </details>
  )
}

const PER_ORDINE = (a: { cognome: string; nome: string }, b: { cognome: string; nome: string }) =>
  a.cognome.localeCompare(b.cognome, 'it') || a.nome.localeCompare(b.nome, 'it')

/**
 * Il registro del mese: le lezioni con l'appello, giorno per giorno dal più
 * recente, e per ognuna chi c'era. Si apre una lezione per vedere i nomi;
 * assenti e giustificati stanno sotto, più spenti. Per correggere un segno
 * si va alla lezione in settimana, che ha l'appello vero.
 */
function Registro({ righe, caricato, onVai }: { righe: RigaRegistro[]; caricato: boolean; onVai: (v: Voce, dove?: Destinazione) => void }) {
  const giorni = new Map<string, RigaRegistro[]>()
  for (const r of [...righe].sort((a, b) => b.inizio.localeCompare(a.inizio))) {
    const g = chiaveGiorno(new Date(r.inizio))
    giorni.set(g, [...(giorni.get(g) ?? []), r])
  }
  return (
    <Chiudibile titolo="REGISTRO DEL MESE" nota={caricato ? `${righe.length} ${righe.length === 1 ? 'lezione' : 'lezioni'} con l'appello, chi c'era lezione per lezione` : 'chi c\'era, lezione per lezione'}>
      {caricato && righe.length === 0 && <span className="sg-sotto">Nessun appello fatto in questo periodo.</span>}
      {[...giorni.entries()].map(([g, lezioni]) => (
        <div key={g} className="stack" style={{ gap: 6 }}>
          <span className="sg-etichetta" style={{ letterSpacing: '0.16em' }}>{giornoPerEsteso(g).toUpperCase()}</span>
          {lezioni.map((r) => {
            const presenti = r.appello.filter((p) => p.stato === 'presente').sort(PER_ORDINE)
            const altri = r.appello.filter((p) => p.stato !== 'presente').sort(PER_ORDINE)
            const dovute = r.appello.filter((p) => p.stato !== 'giustificato').length
            return (
              <details key={r.sessioneId} className="sg-registro">
                <summary className="sg-voce-elenco">
                  <span className="stack grow" style={{ minWidth: 0 }}>
                    <span className="ob" style={{ fontSize: 15, fontWeight: 700 }}>{r.corso.toUpperCase()}</span>
                    <span style={{ fontSize: 12, color: 'var(--dim)' }}>
                      {oraDi(r.inizio)}
                      {r.sala ? ` · ${r.sala}` : ''}
                      {r.istruttori ? ` · ${r.istruttori}` : ''}
                    </span>
                  </span>
                  <span className="num" style={{ fontSize: 16, fontWeight: 700, color: 'var(--verde-testo)', whiteSpace: 'nowrap' }}>
                    {presenti.length}/{dovute}
                  </span>
                </summary>
                <div className="sg-registro-nomi">
                  {presenti.length === 0 && <span className="sg-sotto">Nessun presente.</span>}
                  {presenti.map((p) => (
                    <span key={p.personaId} style={{ fontSize: 15 }}>
                      <span style={{ color: 'var(--verde-testo)', fontWeight: 700 }}>✓</span> {p.cognome} {p.nome}
                    </span>
                  ))}
                  {altri.map((p) => (
                    <span key={p.personaId} style={{ fontSize: 14, color: 'var(--dim)' }}>
                      {p.stato === 'assente' ? '✕' : p.stato === 'giustificato' ? 'G' : '·'} {p.cognome} {p.nome}
                      {p.stato === 'giustificato' ? ' · giustificato' : p.stato === null ? ' · non segnato' : ''}
                    </span>
                  ))}
                  <button
                    type="button"
                    className="num sg-chip"
                    style={{ alignSelf: 'flex-start', marginTop: 6 }}
                    onClick={() => onVai('settimana', { lezione: { id: r.sessioneId, inizio: r.inizio } })}
                  >
                    Apri la lezione
                  </button>
                </div>
              </details>
            )
          })}
        </div>
      ))}
    </Chiudibile>
  )
}

/**
 * Chi è venuto a provare nel mese: l'hanno aggiunto all'appello gli
 * istruttori (o la segreteria), e da qui lo si richiama. Chi nel frattempo si
 * è iscritto lo dice, e non serve richiamarlo.
 */
function Prove({ prove, corso, onVai }: { prove: { dato: ProvaSeg[] | null; guaio: string | null }; corso: string; onVai: (v: Voce, dove?: Destinazione) => void }) {
  const tutte = prove.dato ?? []
  const qui = corso ? tutte.filter((x) => x.corsoId === corso) : tutte
  const persone = new Set(qui.map((x) => x.personaId)).size
  return (
    <Chiudibile
      titolo="PROVE"
      nota={prove.dato ? `${persone} ${persone === 1 ? 'persona' : 'persone'} in ${qui.length} ${qui.length === 1 ? 'lezione' : 'lezioni'}` : 'chi è venuto a provare'}
    >
      {prove.guaio && <Guaio testo={prove.guaio} />}
      {prove.dato !== null && qui.length === 0 && <span className="sg-sotto">Nessuno è venuto a provare in questo periodo.</span>}
      {qui.slice(0, 40).map((x) => (
        <div key={`${x.sessioneId}:${x.personaId}`} className="sg-voce-elenco">
          <span className="stack grow" style={{ minWidth: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>
              {x.cognome} {x.nome}
            </span>
            <span style={{ fontSize: 12, color: 'var(--dim)' }}>
              {x.corso} · {giornoPerEsteso(chiaveGiorno(new Date(x.inizio)))} · {oraDi(x.inizio)}
              {x.da ? ` · aggiunta da ${x.da}` : ''}
            </span>
          </span>
          {x.telefono ? (
            <a className="num" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }} href={`tel:${x.telefono.replace(/[^\d+]/g, '')}`}>
              {x.telefono}
            </a>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--faint)' }}>senza telefono</span>
          )}
          {x.iscritto && <span className="num sg-chip" style={{ color: 'var(--verde-testo)', borderColor: 'var(--verde)', display: 'inline-flex', alignItems: 'center' }}>Iscritto</span>}
          <button type="button" className="num sg-chip" onClick={() => onVai('iscritti', { persona: x.personaId })}>
            Apri la scheda
          </button>
        </div>
      ))}
      {qui.length > 40 && <span className="sg-sotto">…e altre {qui.length - 40}.</span>}
    </Chiudibile>
  )
}

export function Numero({ titolo, valore, sotto, allarme }: { titolo: string; valore: number | string; sotto: string; allarme?: boolean }) {
  return (
    <div className="sg-numero" data-allarme={!!allarme}>
      <span className="sg-etichetta" style={{ letterSpacing: '0.2em', color: allarme ? 'var(--rosso-testo)' : undefined }}>{titolo}</span>
      <span className="num" style={{ fontSize: 44, fontWeight: 700, lineHeight: 0.95 }}>{valore}</span>
      <span style={{ fontSize: 13, color: 'var(--dim)' }}>{sotto}</span>
    </div>
  )
}
