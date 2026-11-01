import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import type { DatiSegreteria, ProvaSeg, RigaRegistro } from '../../lib/segreteria'
import { chiaveGiorno, giornoPerEsteso, oraDi } from '../../lib/sala'
import type { Destinazione, Voce } from './Segreteria'
import { FiltroMenu, Guaio, SegnoStato, Testa, useCarica, Tasto } from './comune'
import { Titoletto } from '../ds'
import { Icona } from '../Icons'
import { csvRegistro, nienteDaScaricare } from '../../lib/presenzeCsv'
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
 * dice che non è venuto nessuno, dice che nessuno ha segnato, e sta nella sua
 * sezione invece di abbassare le medie.
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
  const appelli = useRef<HTMLElement>(null)
  const arrivato = registro.dato !== null
  useEffect(() => {
    if (senzaAppello && arrivato) appelli.current?.scrollIntoView({ block: 'start' })
  }, [senzaAppello, arrivato])
  const prove = useCarica(() => d.prove(p.da, p.a), [d, p])
  // Chi si sta perdendo guarda più indietro del mese: le assenze di fila non si fermano al primo.
  const recenti = useCarica(() => d.registro(new Date(Date.now() - GIORNI_RECENTI * 24 * 60 * 60_000), new Date()), [d])

  const tutte = registro.dato ?? []
  const righe = tutte.filter((r) => !corso || r.corsoId === corso)
  const perche = nienteDaScaricare('presenze', p.nome, !!corso, { arrivato: arrivato && !registro.guaio, righe: righe.length })
  const svolte = righe.filter((r) => r.stato !== 'annullata')
  const fatte = svolte.filter(conAppello)
  const mancanti = svolte.filter((r) => !conAppello(r)).sort((a, b) => b.inizio.localeCompare(a.inizio))
  const corsi = [...new Map(tutte.map((r) => [r.corsoId, r.corso])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'it'))

  const persi = useMemo(() => chiSiStaPerdendo(recenti.dato ?? [], corso), [recenti.dato, corso])
  const { visibili: primiPersi, nascoste: restanoPersi } = accorcia(persi, PRIMI_PERSI, tuttiPersi)

  return (
    <>
      <Testa
        titolo="PRESENZE"
        sotto={
          <>
            Chi si sta perdendo, quali appelli mancano, chi c'era lezione per lezione.{' '}
            {/* Le barre per corso e i numeri del mese stanno già in STATISTICHE: un rimando nella frase, non un tasto in più. */}
            <button type="button" className="sg-link" onClick={() => onVai('statistiche')}>
              Statistiche del mese
            </button>
          </>
        }
      >
        {/* Spento, il tasto resta al suo posto e la riga sotto dice perché: così non si cerca il guasto. */}
        <span className="sg-tasto-perche">
          <Tasto icona="scarica" disabled={!righe.length} aria-describedby={perche ? 'csv-perche' : undefined} onClick={() => scaricaCsv(righe, p.nome)}>
            Scarica CSV
          </Tasto>
          {perche && <span id="csv-perche" className="sg-sotto">{perche}</span>}
        </span>
      </Testa>
      {schede}

      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        {/* Il mese in corso viene per primo: è quello da cui si parte, e la ✕ del filtro ci torna. */}
        <FiltroMenu
          id="periodo"
          nome="Mese"
          value={periodo}
          opzioni={[periodi[1], periodi[0], ...periodi.slice(2)].map((x) => [x.chiave, x.nome] as const)}
          onChange={(v) => {
            // Un corso scelto che nel mese nuovo non c'è sparirebbe dal menu
            // pur continuando a filtrare: si riparte da tutti.
            setPeriodo(v)
            setCorso('')
          }}
        />
        <FiltroMenu id="corso-p" nome="Corso" value={corso} opzioni={[['', 'Tutti'], ...corsi]} onChange={setCorso} />
      </div>

      {registro.guaio && <Guaio testo={registro.guaio} />}

      <div className="stack" style={{ gap: 20 }}>
          <section aria-label="Chi si sta perdendo" className="sg-elenco">
            <div className="sg-elenco-testa">
              <Titoletto dentro conto={persi.length}>CHI SI STA PERDENDO</Titoletto>
              <span className="sg-sotto">{DI_FILA} assenze di fila o più</span>
            </div>
            {recenti.dato !== null && persi.length === 0 && <p className="sg-elenco-vuoto" style={{ color: 'var(--verde-testo)' }}>Nessuno: chi è iscritto viene.</p>}
            {primiPersi.map((x) => (
              <RigaElenco
                key={x.id}
                titolo={x.nome}
                sotto={`${x.corsi.join(', ')} · ${x.ultima ? `l'ultima volta ${giornoPerEsteso(chiaveGiorno(new Date(x.ultima)))}` : 'mai negli ultimi due mesi'}`}
                onApri={() => onVai('iscritti', { persona: x.id })}
              >
                <span className="num sg-riga-elenco-cifra" style={{ color: 'var(--rosso-testo)' }}>{x.fila} assenze</span>
              </RigaElenco>
            ))}
            {(restanoPersi > 0 || tuttiPersi) && (
              <div className="sg-elenco-piede">
                <Tasto aria-expanded={tuttiPersi} onClick={() => setTuttiPersi(!tuttiPersi)}>
                  {tuttiPersi ? 'Mostra meno' : `Mostra tutti i ${persi.length} (altri ${restanoPersi})`}
                </Tasto>
              </div>
            )}
          </section>

          <section ref={appelli} aria-label="Appelli mancanti" className="sg-elenco" data-allarme={mancanti.length > 0}>
            <div className="sg-elenco-testa">
              <Titoletto dentro conto={mancanti.length}>APPELLI MANCANTI</Titoletto>
            </div>
            {registro.dato !== null && mancanti.length === 0 && <p className="sg-elenco-vuoto" style={{ color: 'var(--verde-testo)' }}>Nessuno: tutte le lezioni passate hanno l'appello.</p>}
            {mancanti.slice(0, 30).map((r) => (
              <RigaElenco
                key={r.sessioneId}
                titolo={`${r.corso} · ${giornoPerEsteso(chiaveGiorno(new Date(r.inizio)))}, ${oraDi(r.inizio)}`}
                sotto={r.istruttori ? `Istruttore: ${r.istruttori}` : 'Nessun istruttore segnato'}
                onApri={() => onVai('settimana', { lezione: { id: r.sessioneId, inizio: r.inizio } })}
              >
                <SegnoStato tono="rosso" parola="Appello non fatto" />
              </RigaElenco>
            ))}
            {mancanti.length > 30 && <p className="sg-elenco-vuoto">…e altre {mancanti.length - 30}.</p>}
          </section>

          <Prove prove={prove} corso={corso} onVai={onVai} />

          <Registro righe={fatte} caricato={registro.dato !== null} onVai={onVai} />
      </div>
    </>
  )
}

const PRIMI_PERSI = 5

/**
 * Una riga d'elenco che apre qualcosa: tutta la riga si clicca (il tasto la copre), la › dice che si apre.
 * Prende il posto della voce a riquadro con un tasto di riga ripetuto su ogni voce. `children` sono lo
 * stato o la cifra a destra; un link vero dentro (il telefono) resta sopra il tasto e si preme da solo.
 */
function RigaElenco({ titolo, sotto, onApri, children }: { titolo: string; sotto: string; onApri: () => void; children?: ReactNode }) {
  return (
    <div className="sg-riga-elenco">
      <button type="button" className="sg-riga-elenco-apri" onClick={onApri}>
        <span className="sg-riga-elenco-titolo">{titolo}</span>
        <span className="sg-riga-elenco-sotto">{sotto}</span>
      </button>
      {children}
      <span className="sg-riga-elenco-segue" aria-hidden="true">
        <Icona nome="avanti" />
      </span>
    </div>
  )
}

/**
 * Una sezione lunga chiusa, con il titolo e il conto in vista. `<details>`
 * perché la tastiera e chi legge lo schermo lo sanno già usare.
 */
function SezioneChiusa({ titolo, conto, nota, children }: { titolo: string; conto?: number; nota?: string; children: ReactNode }) {
  return (
    <details className="sg-elenco">
      <summary className="sg-elenco-testa">
        <Titoletto dentro conto={conto}>{titolo}</Titoletto>
        {nota && <span className="sg-sotto">{nota}</span>}
      </summary>
      {children}
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
    <SezioneChiusa titolo="REGISTRO DEL MESE" conto={caricato ? righe.length : undefined} nota={caricato ? `${righe.length === 1 ? 'lezione' : 'lezioni'} con l'appello, chi c'era lezione per lezione` : 'chi c\'era, lezione per lezione'}>
      {caricato && righe.length === 0 && <p className="sg-elenco-vuoto">Nessun appello fatto in questo periodo.</p>}
      {[...giorni.entries()].map(([g, lezioni]) => (
        <div key={g}>
          <span className="sg-etichetta sg-elenco-giorno">{giornoPerEsteso(g).toUpperCase()}</span>
          {lezioni.map((r) => {
            const presenti = r.appello.filter((p) => p.stato === 'presente').sort(PER_ORDINE)
            const altri = r.appello.filter((p) => p.stato !== 'presente').sort(PER_ORDINE)
            const dovute = r.appello.filter((p) => p.stato !== 'giustificato').length
            return (
              <details key={r.sessioneId} className="sg-registro">
                <summary className="sg-riga-elenco">
                  <span className="sg-riga-elenco-apri">
                    <span className="sg-riga-elenco-titolo">{r.corso}</span>
                    <span className="sg-riga-elenco-sotto">
                      {oraDi(r.inizio)}
                      {r.sala ? ` · ${r.sala}` : ''}
                      {r.istruttori ? ` · ${r.istruttori}` : ''}
                    </span>
                  </span>
                  <span className="num sg-riga-elenco-cifra" style={{ color: 'var(--verde-testo)' }}>
                    {presenti.length}/{dovute} presenti
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
    </SezioneChiusa>
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
    <SezioneChiusa
      titolo="PROVE"
      conto={prove.dato ? persone : undefined}
      nota={prove.dato ? `${persone === 1 ? 'persona' : 'persone'} in ${qui.length} ${qui.length === 1 ? 'lezione' : 'lezioni'}` : 'chi è venuto a provare'}
    >
      {prove.guaio && <Guaio testo={prove.guaio} />}
      {prove.dato !== null && qui.length === 0 && <p className="sg-elenco-vuoto">Nessuno è venuto a provare in questo periodo.</p>}
      {qui.slice(0, 40).map((x) => (
        <RigaElenco
          key={`${x.sessioneId}:${x.personaId}`}
          titolo={`${x.cognome} ${x.nome}`}
          sotto={`${x.corso} · ${giornoPerEsteso(chiaveGiorno(new Date(x.inizio)))} · ${oraDi(x.inizio)}${x.da ? ` · aggiunta da ${x.da}` : ''}`}
          onApri={() => onVai('iscritti', { persona: x.personaId })}
        >
          {x.iscritto && <SegnoStato tono="verde" parola="Iscritto" />}
          {x.telefono ? (
            <a className="num sg-riga-elenco-cifra" href={`tel:${x.telefono.replace(/[^\d+]/g, '')}`}>
              {x.telefono}
            </a>
          ) : (
            <span className="sg-riga-elenco-sotto">senza telefono</span>
          )}
        </RigaElenco>
      ))}
      {qui.length > 40 && <p className="sg-elenco-vuoto">…e altre {qui.length - 40}.</p>}
    </SezioneChiusa>
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
