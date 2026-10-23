import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import {
  avvisi,
  datiIscritto,
  iscrittoScelto,
  scegliIscritto,
  type AggiuntaNucleo,
  type DatiIscritto,
  type IscrittoDiProva,
  type MiaLezione,
  type MiaPresenza,
  type SchedaIscritto,
} from '../lib/iscritto'
import type { Segnalata } from '../lib/segnalate'
import { boxCertificato } from '../lib/certificatoIscritto'
import { chiaveGiorno, giornoPerEsteso, oraDi } from '../lib/sala'
import { comePaga, dalCertificato, pagamentoDi, statoCertificato } from '../lib/segreteria'
import { euro, nomeFileRicevuta, type Ricevuta } from '../lib/ricevute'
import { indirizzoPagina } from '../lib/guida'
import { cartaSePuoi } from '../lib/cartaPdf'
import { abbonamentiDalleRicevute, doveVaLoSconto, SCONTO_FAMIGLIA } from '../lib/nucleo'
import { Cifra, Dettaglio, Etichetta, Riquadro, Tasti, Tasto, Titoletto } from './ds'
import { AccessoIscritto } from './AccessoIscritto'
import { riprendiDaGoogle, urlPulito } from '../lib/accessoIscritto'
import { esci } from '../lib/accesso'
import { INDIRIZZI } from '../lib/aree'
import {
  TAB_INIZIALE,
  cosaCambia,
  elencoLezioni,
  lezioniViste,
  contoAnnullate,
  puoSegnalare,
  etichettaTab,
  fraQuanto,
  gruppiContatti,
  tabAperto,
  idPannelloTab,
  idTab,
  segnoInRegola,
  quandoBreve,
  segnoPresenza,
  sottoLezione,
  tabArea,
  tastoTabArea,
  ultimePresenze,
  type IconaCosa,
  type IconaPresenza,
  type IdTabArea,
  type VoceContatti,
} from '../lib/areaTab'
import { ModuloIscrizione, type PerIlNucleo } from './ModuloIscrizione'
import { PagaSaldo, RitornoSaldo } from './PagaSaldo'
import { PagaQuota, RitornoQuota } from './PagaQuota'
import { ritornoDellaQuota } from '../lib/quotaSatispay'
import { altriConResto, ritornoDelSaldo } from '../lib/saldoSatispay'
import { VERSIONE, VERSIONE_ESTESA } from '../lib/versione'

/**
 * L'area degli iscritti, dal telefono: le prossime lezioni dei suoi corsi,
 * le sue presenze, il certificato, la quota e le ricevute. Solo da leggere:
 * per cambiare qualcosa si passa in segreteria.
 *
 * Col database vero si entra con l'email e un codice (`AccessoIscritto`) e si
 * vede solo quel che è proprio. In prova (`?prova`, vedi `iscritto.ts`) in
 * cima si sceglie quale iscritto inventato essere, per far vedere la pagina
 * com'è per ognuno.
 *
 * Il titolare di un nucleo familiare (vedi `nucleo.ts`) passa dalla sua
 * pagina a quella di ogni persona del nucleo, vede i pagamenti di tutti e
 * aggiunge una persona in più col modulo di iscrizione, che parte coi suoi
 * dati e dice quanto costa con lo sconto famiglia.
 */

/** Quanti giorni avanti si guardano le lezioni, e quanti indietro le presenze. */
// L'indirizzo con cui si è arrivati, letto prima che nasca il client: da Google si torna con l'esito nell'indirizzo.
const ARRIVO = window.location.href

const AVANTI = 7
const INDIETRO = 7

export function AreaIscritti() {
  const [d, setD] = useState<DatiIscritto | null>(null)
  const [guaio, setGuaio] = useState<string | null>(null)
  const [iscritti, setIscritti] = useState<IscrittoDiProva[] | null>(null)
  const [chi, setChi] = useState<string | null>(iscrittoScelto)
  // Com'è finito il ritorno da Google, se è da dire a chi non è entrato.
  const [avviso, setAvviso] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    datiIscritto()
      .then(async (x) => {
        if (x.modo === 'supabase') {
          const ritorno = await riprendiDaGoogle(ARRIVO)
          if (ritorno) history.replaceState(null, '', urlPulito(window.location.href))
          if (ritorno && 'errore' in ritorno && vivo) setAvviso(ritorno.errore)
        }
        const elenco = await x.iscritti()
        if (!vivo) return
        setD(x)
        setIscritti(elenco)
        // Il primo dell'elenco se non se n'è scelto nessuno, o quello scelto non c'è più.
        // In prova la scelta si ricorda; col database vero c'è solo chi è entrato.
        setChi((c) => (c && elenco.some((p) => p.id === c) ? c : (elenco[0]?.id ?? null)))
      })
      .catch((e: unknown) => vivo && setGuaio(e instanceof Error ? e.message : 'L’app non si è caricata'))
    return () => {
      vivo = false
    }
  }, [])

  const scegli = (id: string) => {
    scegliIscritto(id)
    setChi(id)
  }

  if (guaio) return <p className="pad" style={{ color: 'var(--dim)', paddingTop: 20 }}>{guaio}: controlla la connessione.</p>
  if (!d || !iscritti) return <p className="pad" style={{ color: 'var(--dim)', paddingTop: 20 }}>Un attimo…</p>

  if (d.modo === 'supabase') {
    // Nessuno è entrato: l'accesso con il codice. Entrato, la sua pagina.
    if (!chi) return <AccessoIscritto avviso={avviso} onEntrato={(io) => { setIscritti([io]); setChi(io.id) }} />
    return (
      <div className="mia-area">
        <Account key={chi} dati={d} personaId={chi} conEsci />
      </div>
    )
  }

  return (
    <>
      <div className="nastro-prova">DATI DI PROVA · ORARIO VERO, ISCRITTI INVENTATI</div>
      <div className="mia-area">
        <div className="pad stack mia-chi">
          <label htmlFor="mia-chi" className="modulo-etichetta">
            IN PROVA SEI
          </label>
          <select id="mia-chi" className="campo" value={chi ?? ''} onChange={(e) => scegli(e.target.value)}>
            {iscritti.map((p) => (
              <option key={p.id} value={p.id}>
                {p.cognome} {p.nome}
              </option>
            ))}
          </select>
        </div>
        {chi ? <Account key={chi} dati={d} personaId={chi} /> : <p className="pad">Nessun iscritto in prova.</p>}
      </div>
    </>
  )
}

const suSubito = () => document.querySelector('.scroll')?.scrollTo(0, 0)

/**
 * Chi è entrato: la sua pagina, o quella di una persona del suo nucleo, e
 * sotto il nucleo coi pagamenti di tutti. Aggiungendo una persona la pagina
 * lascia il posto al modulo.
 */
function Account({ dati, personaId, conEsci }: { dati: DatiIscritto; personaId: string; conEsci?: boolean }) {
  const [nucleo, setNucleo] = useState<SchedaIscritto[] | null>(null)
  const [titolare, setTitolare] = useState(false)
  const [aggiunte, setAggiunte] = useState<AggiuntaNucleo[]>([])
  const [ricevute, setRicevute] = useState<Ricevuta[]>([])
  const [di, setDi] = useState(personaId)
  const [modulo, setModulo] = useState<PerIlNucleo | null>(null)
  const [giro, setGiro] = useState(0)
  // Qui e non in `Pagina`: cambiando persona o tornando dal modulo si resta sul tab in cui si era.
  const [tab, setTab] = useState<IdTabArea>(TAB_INIZIALE)
  // Il ritorno da Satispay dopo il saldo della quota (`iscritti/?saldo=…&persona=…`).
  const [ritorno, setRitorno] = useState(() => ritornoDelSaldo(window.location.search))
  // …e dopo la quota intera (`iscritti/?quota=1&persona=…`).
  const [ritornoQuota, setRitornoQuota] = useState(() => ritornoDellaQuota(window.location.search))

  useEffect(() => {
    let vivo = true
    void Promise.all([dati.nucleo(personaId), dati.titolare(personaId), dati.aggiunte(personaId)]).then(async ([n, t, ag]) => {
      const r = (await Promise.all(n.map((p) => dati.ricevute(p.id)))).flat()
      if (!vivo) return
      setNucleo(n)
      setTitolare(t)
      setAggiunte(ag)
      setRicevute(r)
    })
    return () => {
      vivo = false
    }
  }, [dati, personaId, giro])

  if (!nucleo) return <p className="pad" style={{ color: 'var(--dim)' }}>Un attimo…</p>
  const io = nucleo[0]
  if (!io) return <p className="pad">Questa persona non è più fra gli iscritti.</p>
  const nomeDi = (id: string) => nucleo.find((p) => p.id === id)?.nome ?? ''

  if (ritornoQuota)
    return (
      <div className="iscrizioni-modulo">
        <Titoletto>QUOTA ASSOCIATIVA</Titoletto>
        <RitornoQuota
          dati={dati}
          persona={ritornoQuota.persona}
          onChiudi={() => {
            const u = new URLSearchParams(window.location.search)
            u.delete('quota')
            u.delete('persona')
            history.replaceState(null, '', window.location.pathname + (u.size ? `?${u}` : ''))
            setRitornoQuota(null)
            setGiro((g) => g + 1)
            suSubito()
          }}
        />
      </div>
    )

  if (ritorno) {
    const oggi = chiaveGiorno(new Date())
    const altri = altriConResto(nucleo, ricevute, oggi, ritorno.persona)
    return (
      <div className="iscrizioni-modulo">
        <Titoletto>QUOTA ASSOCIATIVA</Titoletto>
        <RitornoSaldo dati={dati} persona={ritorno.persona} ricevuta={ritorno.ricevuta} altri={altri}
          onChiudi={() => {
            // Via dall'indirizzo il ritorno: la pagina si rilegge e il resto pagato non c'è più.
            const u = new URLSearchParams(window.location.search)
            u.delete('saldo')
            u.delete('persona')
            history.replaceState(null, '', window.location.pathname + (u.size ? `?${u}` : ''))
            setRitorno(null)
            setGiro((g) => g + 1)
            suSubito()
          }}
        />
      </div>
    )
  }

  if (modulo)
    return (
      <div className="iscrizioni-modulo">
        <Titoletto>UNA PERSONA IN PIÙ</Titoletto>
        <ModuloIscrizione
          nucleo={modulo}
          torna="TORNA ALLA TUA PAGINA"
          onChiudi={() => {
            setModulo(null)
            setGiro((g) => g + 1)
            suSubito()
          }}
        />
      </div>
    )

  const aggiungi = async () => {
    const d = await dati.datiDelNucleo(personaId)
    setModulo({
      titolare: io.nome,
      dati: d,
      abbonamenti: abbonamentiDalleRicevute(ricevute, nomeDi, chiaveGiorno(new Date())),
    })
    suSubito()
  }
  const apri = (id: string) => {
    setDi(id)
    suSubito()
  }

  return (
    <>
      <Pagina
        key={di}
        dati={dati}
        personaId={di}
        io={personaId}
        tua={di === personaId}
        membri={nucleo}
        onCambia={apri}
        conEsci={conEsci === true}
        tab={tab}
        onTab={setTab}
        nucleo={titolare ? <Nucleo dati={dati} io={personaId} membri={nucleo} aggiunte={aggiunte} ricevute={ricevute} onApri={apri} onAggiungi={() => void aggiungi()} /> : null}
      />
    </>
  )
}

/** Le icone a linea delle voci della barra (stesse del design, BarraNavigazione). */
const ICONE_TAB: Record<IdTabArea, string[]> = {
  lezioni: ['M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z', 'M4 10h16', 'M8 3v4M16 3v4'],
  regola: ['M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z', 'M8.5 12l2.5 2.5L15.5 9.5'],
  nucleo: ['M9 11a3 3 0 1 0 0-6a3 3 0 0 0 0 6z', 'M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6', 'M16 5.5a3 3 0 0 1 0 5.5M18 14.5c1.8.8 3 2.6 3 5.5'],
  contatti: ['M5 4h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-7l-4 4v-4H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z', 'M8 9h8M8 12h5'],
}

/** Le icone a linea di LEZIONI (stesse del design, MiaLezione e MiaPresenzaPiccola): accompagnano le parole, non le sostituiscono. */
const CERCHIO = 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18z'
const ICONE_LEZIONE: Record<IconaCosa | IconaPresenza | 'istruttore' | 'giorno', string[]> = {
  istruttore: ['M12 4a4 4 0 1 0 0 8a4 4 0 0 0 0-8z', 'M4 21a8 8 0 0 1 16 0'],
  giorno: ['M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z', 'M4 10h16M8 3v4M16 3v4'],
  sala: ['M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z', 'M12 7.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 0 0 0-5z'],
  annullata: [CERCHIO, 'M5.6 5.6l12.8 12.8'],
  sostituto: ['M7 7h13l-3-3', 'M17 17H4l3 3'],
  piu: [CERCHIO, 'M12 8v8M8 12h8'],
  presente: [CERCHIO, 'M8 12.5l3 3l5-6'],
  assente: [CERCHIO, 'M9 9l6 6M15 9l-6 6'],
  giustificato: [CERCHIO, 'M8.5 12h7'],
  niente: [CERCHIO],
}

function Icona({ nome, misura = 16 }: { nome: keyof typeof ICONE_LEZIONE; misura?: number }) {
  return (
    <svg width={misura} height={misura} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mia-icona">
      {ICONE_LEZIONE[nome].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}

/** La pagina di un iscritto: la propria, o (`tua` falso) di una persona del nucleo. */
function Pagina({
  dati,
  personaId,
  io,
  tua,
  tab: scelto,
  onTab,
  nucleo,
  membri,
  onCambia,
  conEsci,
}: {
  dati: DatiIscritto
  personaId: string
  /** Chi è entrato: il titolare, se `personaId` è un familiare. */
  io: string
  tua: boolean
  tab: IdTabArea
  onTab: (t: IdTabArea) => void
  /** Il nucleo, solo per il titolare: c'è il tab FAMIGLIA se c'è questo. */
  nucleo: ReactNode
  /** Chi c'è nel nucleo (anche chi è entrato): con più di uno, il nome nel saluto si cambia. */
  membri: SchedaIscritto[]
  onCambia: (id: string) => void
  /** ESCI c'è solo con l'accesso vero. */
  conEsci: boolean
}) {
  const [scheda, setScheda] = useState<SchedaIscritto | null | undefined>(undefined)
  const [lezioni, setLezioni] = useState<MiaLezione[]>([])
  const [presenze, setPresenze] = useState<MiaPresenza[]>([])
  const [ricevute, setRicevute] = useState<Ricevuta[]>([])

  useEffect(() => {
    let vivo = true
    const oggi = new Date()
    const fino = new Date(oggi)
    fino.setDate(fino.getDate() + AVANTI)
    void Promise.all([dati.scheda(personaId), dati.lezioni(personaId, oggi, fino), dati.presenze(personaId, INDIETRO), dati.ricevute(personaId)]).then(
      ([s, l, p, r]) => {
        if (!vivo) return
        setScheda(s)
        // Quelle già finite oggi non sono «prossime».
        setLezioni(l.filter((x) => new Date(x.fine).getTime() > Date.now()))
        setPresenze(p)
        setRicevute(r)
      },
    )
    return () => {
      vivo = false
    }
  }, [dati, personaId])

  if (scheda === undefined) return <p className="pad" style={{ color: 'var(--dim)' }}>Un attimo…</p>
  if (!scheda) return <p className="pad">Questa persona non è più fra gli iscritti.</p>

  const ordine = tabArea(nucleo !== null)
  const tab = tabAperto(ordine, scelto)
  const oggi = chiaveGiorno(new Date())
  const segno = segnoInRegola(statoCertificato(scheda, oggi), pagamentoDi(scheda, oggi).come)
  const tastiera = (e: KeyboardEvent) => {
    const dove = tastoTabArea(ordine, tab, e)
    if (!dove) return
    e.preventDefault()
    onTab(dove)
    // Il fuoco segue il tab: la prossima Tab entra nel suo pannello.
    document.getElementById(idTab(dove))?.focus()
  }
  // I tab lasciati si nascondono, non si smontano: le presenze aperte restano come stavano.
  const pannello = (id: IdTabArea, corpo: ReactNode) => (
    <div role="tabpanel" id={idPannelloTab(id)} aria-labelledby={idTab(id)} hidden={tab !== id} className="stack">
      {corpo}
    </div>
  )

  return (
    <div className="stack">
      <Saluto scheda={scheda} tua={tua} io={io} membri={membri} onCambia={onCambia} />
      {pannello(
        'lezioni',
        <>
          <Presenze dati={dati} personaId={personaId} presenze={presenze} />
          <Prossime lezioni={lezioni} />
        </>,
      )}
      {pannello(
        'regola',
        <>
          <InRegola scheda={scheda} dati={dati} personaId={personaId} io={io} ricevute={ricevute} onMandato={() => dati.scheda(personaId).then(setScheda)} />
          <Ricevute ricevute={ricevute} />
        </>,
      )}
      {nucleo !== null && pannello('nucleo', nucleo)}
      {pannello('contatti', <Contatti conEsci={conEsci} />)}
      <nav className="barra-nav mia-barra" role="tablist" aria-label="Parti della pagina" onKeyDown={tastiera}>
        {ordine.map((id) => {
          const s = id === 'regola' ? segno : null
          return (
            <button
              key={id}
              type="button"
              role="tab"
              id={idTab(id)}
              aria-controls={idPannelloTab(id)}
              aria-selected={tab === id}
              aria-current={tab === id ? 'page' : undefined}
              // Il segno a voce: lo span dentro è aria-hidden.
              aria-label={s ? `${etichettaTab(id)}, ${s.parola.toLowerCase()}` : etichettaTab(id)}
              tabIndex={tab === id ? 0 : -1}
              className="barra-voce"
              onClick={() => onTab(id)}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {ICONE_TAB[id].map((d) => (
                  <path key={d} d={d} />
                ))}
              </svg>
              <span className="num" aria-hidden="true">
                {etichettaTab(id)}
                {s && <span className="mia-barra-segno" data-tono={s.tono}> ●</span>}
              </span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

function Saluto({ scheda, tua, io, membri, onCambia }: { scheda: SchedaIscritto; tua: boolean; io: string; membri: SchedaIscritto[]; onCambia: (id: string) => void }) {
  const oggi = chiaveGiorno(new Date())
  const x = avvisi(scheda, oggi)
  return (
    <section className="pad stack" style={{ gap: 10, paddingTop: 6 }}>
      {membri.length > 1 ? (
        // Il nome è il campo: il select vero ci sta sopra, trasparente, e il telefono apre il suo elenco.
        <label className="mio-nome-scelta">
          <span className="ob mio-nome">{tua ? `Ciao ${scheda.nome}` : `${scheda.nome} ${scheda.cognome}`}</span>
          <span aria-hidden="true" className="mio-nome-freccia">▾</span>
          <select aria-label="Di chi vedi la pagina" value={scheda.id} onChange={(e) => onCambia(e.target.value)}>
            {membri.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id === io ? `${p.nome} (tu)` : p.nome}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <span className="ob mio-nome">{tua ? `Ciao ${scheda.nome}` : `${scheda.nome} ${scheda.cognome}`}</span>
      )}
      {membri.length > 1 && <Dettaglio>Tocca il nome per vedere un altro membro del nucleo.</Dettaglio>}
      {!tua && <Dettaglio>Nel tuo nucleo familiare: vedi la sua pagina come la vede la segreteria.</Dettaglio>}
      {scheda.corsi.length === 0 && <Dettaglio>Oggi non risulta un’iscrizione a un corso.</Dettaglio>}
      {/* Se è tutto a posto non c'è niente da dire: il segno sul tab DOCUMENTI avvisa quando serve. */}
      {x.map((a) => (
        <Riquadro key={a.testo} tono={a.tono === 'guaio' ? 'guaio' : 'prova'} stretto>
          <Dettaglio tono={a.tono === 'guaio' ? 'guaio' : 'testo'}>{a.testo}</Dettaglio>
        </Riquadro>
      ))}
    </section>
  )
}

/** La prossima lezione in evidenza, poi le altre della prossima settimana in ordine di data. */
function Prossime({ lezioni }: { lezioni: MiaLezione[] }) {
  const [tutte, setTutte] = useState(false)
  const el = useMemo(() => elencoLezioni(lezioni), [lezioni])
  const annullate = el.seguenti.filter((l) => l.stato === 'annullata').length
  const p = el.prossima
  const cambia = p && cosaCambia(p)
  const { viste, piu } = lezioniViste(el.seguenti, tutte)

  return (
    <>
      {p && (
        <section>
          <Titoletto>LA PROSSIMA LEZIONE</Titoletto>
          <div className="pad">
            <div className="mia-prossima">
              <Riquadro>
                <Etichetta>{`${giornoPerEsteso(chiaveGiorno(new Date(p.inizio)))} · ${oraDi(p.inizio)}`.toUpperCase()}</Etichetta>
                <span className="ob lezione-nome">{p.corso.toUpperCase()}</span>
                <Cifra>{fraQuanto(p.inizio, new Date())}</Cifra>
                <Dettaglio>
                  <span className="mia-sotto">
                    {p.istruttore && (
                      <>
                        <Icona nome="istruttore" />
                        {p.istruttore}
                      </>
                    )}
                    {cambia && (
                      <>
                        <Icona nome={cambia.icona} />
                        {cambia.frase}
                      </>
                    )}
                  </span>
                </Dettaglio>
              </Riquadro>
            </div>
          </div>
        </section>
      )}
      <section>
        <Titoletto
          conto={
            piu ? (
              <button type="button" className="mia-vedi-tutte" aria-expanded={tutte} onClick={() => setTutte(!tutte)}>
                {tutte ? 'MENO' : 'VEDI TUTTE'}
              </button>
            ) : annullate ? (
              contoAnnullate(annullate)
            ) : undefined
          }
        >
          LE TUE LEZIONI
        </Titoletto>
        {viste.length === 0 && (
          <p className="pad" style={{ color: 'var(--dim)', margin: 0 }}>
            {p ? 'Nessun’altra lezione nella prossima settimana.' : 'Nessuna lezione nella prossima settimana.'}
          </p>
        )}
        <div className="pad stack" style={{ gap: 8, paddingBottom: 12 }}>
          {viste.map((l) => (
            <Lezione key={l.id} l={l} />
          ))}
        </div>
      </section>
    </>
  )
}

function Lezione({ l }: { l: MiaLezione }) {
  const annullata = l.stato === 'annullata'
  const cosa = cosaCambia(l)
  const sotto = sottoLezione(l)
  return (
    <div
      className="card lezione mia-lezione"
      data-annullata={annullata || undefined}
      style={{
        ['--tinta' as string]: l.colore ?? 'var(--blu)',
        cursor: 'default',
      }}
    >
      <span className="lezione-ora num">{oraDi(l.inizio)}</span>
      <span className="stack grow" style={{ gap: 3, minWidth: 0 }}>
        <span className="ob lezione-nome">{l.corso.toUpperCase()}</span>
        <span className="mia-sotto">
          <Icona nome={sotto.icona} />
          <span style={{ minWidth: 0 }}>{sotto.pezzi.join(' · ')}</span>
        </span>
      </span>
      {cosa && (
        <span className="num mia-lezione-cosa" data-tono={cosa.tono}>
          <Icona nome={cosa.icona} misura={18} />
          {cosa.testo}
        </span>
      )}
    </div>
  )
}

/**
 * Le ultime tre presenze in piccolo; VEDI TUTTE apre l'elenco dell’ultima
 * settimana. Dove non risulta presente (non segnato, o assente) nell'elenco c'è SEGNALA: chi c'era lo dice, con una nota se vuole,
 * e la presenza la conferma l'istruttore o la segreteria (vedi `segnalate.ts`).
 */
function Presenze({ dati, personaId, presenze }: { dati: DatiIscritto; personaId: string; presenze: MiaPresenza[] }) {
  const [tutte, setTutte] = useState(false)
  const [segnalate, setSegnalate] = useState<Segnalata[]>([])
  const [aperta, setAperta] = useState<string | null>(null)
  const [nota, setNota] = useState('')
  const [guaio, setGuaio] = useState<string | null>(null)
  const [giro, setGiro] = useState(0)
  useEffect(() => {
    let vivo = true
    void dati.segnalate(personaId).then((x) => vivo && setSegnalate(x))
    return () => {
      vivo = false
    }
  }, [dati, personaId, giro])

  const daVedere = segnalate.filter((x) => x.stato === 'da_vedere').length
  const manda = async (sessioneId: string) => {
    setGuaio(null)
    try {
      await dati.segnala(personaId, sessioneId, nota)
      setAperta(null)
      setNota('')
      setGiro((g) => g + 1)
    } catch (e) {
      setGuaio(e instanceof Error ? e.message : 'La segnalazione non è partita')
    }
  }
  return (
    <section>
      <Titoletto
        conto={
          presenze.length > 0 && (
            <button type="button" className="mia-vedi-tutte" aria-expanded={tutte} onClick={() => setTutte(!tutte)}>
              {tutte ? 'MENO' : 'VEDI TUTTE'}
            </button>
          )
        }
      >
        LE ULTIME PRESENZE
      </Titoletto>
      <div className="pad stack" style={{ gap: 8, paddingBottom: 12 }}>
        {presenze.length === 0 ? (
          <Dettaglio>Nessuna lezione negli ultimi {INDIETRO} giorni.</Dettaglio>
        ) : (
          <>
            {daVedere > 0 && <Dettaglio tono="avviso">{daVedere === 1 ? 'Una presenza segnalata aspetta' : `${daVedere} presenze segnalate aspettano`} l’istruttore o la segreteria.</Dettaglio>}
            {!tutte && (
              <ul className="mie-presenze-piccole">
                {ultimePresenze(presenze).map((p) => {
                  const s = segnalate.find((x) => x.sessioneId === p.sessioneId)
                  const segno = segnoPresenza(p.stato, s?.stato)
                  return (
                    <li key={p.sessioneId} className="card mia-presenza-piccola" data-tono={segno.tono}>
                      <Icona nome={segno.icona} misura={22} />
                      <span className="mia-presenza-piccola-quando">{quandoBreve(p.inizio)}</span>
                      <span className="num mia-presenza-detto">{segno.parola}</span>
                    </li>
                  )
                })}
              </ul>
            )}
            {tutte && (
              <ul className="stack mie-presenze">
                {presenze.map((p) => {
                  const s = segnalate.find((x) => x.sessioneId === p.sessioneId)
                  const { icona, parola: detto } = segnoPresenza(p.stato)
                  const puo = puoSegnalare(p.stato, s?.stato)
                  return (
                    <li key={p.sessioneId} className="card stack mia-presenza-voce">
                      <span className="row mia-presenza" data-stato={p.stato ?? 'nessuno'}>
                        <span className="mia-presenza-segno">
                          <Icona nome={icona} misura={22} />
                        </span>
                        <span className="stack grow" style={{ gap: 1, minWidth: 0 }}>
                          <span style={{ fontWeight: 600 }}>{p.corso}</span>
                          <span style={{ fontSize: 13, color: 'var(--dim)' }}>
                            {giornoPerEsteso(chiaveGiorno(new Date(p.inizio)))} · {oraDi(p.inizio)}
                          </span>
                        </span>
                        <span className="stack" style={{ gap: 4, alignItems: 'flex-end' }}>
                          {!(puo && aperta !== p.sessioneId) && <span className="num mia-presenza-detto">{detto}</span>}
                          {s && s.stato !== 'accolta' && (
                            <span
                              className="num mia-lezione-cosa mia-presenza-segnalata"
                              data-tono={s.stato === 'rifiutata' ? 'guaio' : 'avviso'}
                              title={s.stato === 'rifiutata' ? 'La segnalazione è stata rifiutata' : 'Segnalata: la conferma l’istruttore o la segreteria'}
                            >
                              {s.stato === 'rifiutata' ? 'RIFIUTATA' : 'DA CONFERMARE'}
                            </span>
                          )}
                          {puo && aperta !== p.sessioneId && (
                            <button type="button" className="num mia-segnala" onClick={() => (setAperta(p.sessioneId), setNota(''), setGuaio(null))}>
                              SEGNALA
                            </button>
                          )}
                        </span>
                      </span>
                      {aperta === p.sessioneId && (
                        <span className="stack mia-segnala-modulo">
                          <label htmlFor={`nota-${p.sessioneId}`} className="modulo-etichetta">
                            C’ERI? UNA NOTA PER L’ISTRUTTORE · FACOLTATIVA
                          </label>
                          <textarea
                            id={`nota-${p.sessioneId}`}
                            className="campo campo-note"
                            rows={2}
                            maxLength={200}
                            placeholder="In ritardo, il tablet non mi trovava…"
                            value={nota}
                            onChange={(e) => setNota(e.target.value)}
                          />
                          {guaio && <Dettaglio tono="guaio">{guaio}</Dettaglio>}
                          <Tasti>
                            <Tasto variante="principale" onClick={() => void manda(p.sessioneId)}>
                              ERO PRESENTE
                            </Tasto>
                            <Tasto onClick={() => setAperta(null)}>LASCIA STARE</Tasto>
                          </Tasti>
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  )
}

const data = (g: string) => g.split('-').reverse().join('/')

function InRegola({ scheda, dati, personaId, io, ricevute, onMandato }: { scheda: SchedaIscritto; dati: DatiIscritto; personaId: string; io: string; ricevute: Ricevuta[]; onMandato: () => Promise<void> }) {
  const oggi = chiaveGiorno(new Date())
  const cert = statoCertificato(scheda, oggi)
  const stato = pagamentoDi(scheda, oggi)
  const paga = stato.come
  const certTesto = {
    manca: 'Non risulta: senza, in sala non si entra.',
    scaduto: `Scaduto il ${data(scheda.certificato.scade ?? '')}.`,
    in_scadenza: `Vale fino al ${data(scheda.certificato.scade ?? '')}: scade fra poco.`,
    valido: `Vale fino al ${data(scheda.certificato.scade ?? '')}.`,
    non_serve: 'Sotto i 6 anni non serve.',
    in_arrivo: `Dal ${data(dalCertificato(scheda.natoIl ?? ''))}, a 6 anni, serve: portalo in segreteria.`,
  }[cert]
  const mandare = boxCertificato(scheda, oggi, scheda.certificatoDaQui ?? false)
  const pagaTesto = {
    da_pagare: 'Non risulta pagata.',
    in_parte: `Pagata in parte${stato.mancano ? `: mancano ${euro(stato.mancano)} €` : stato.nota ? `: ${stato.nota.toLowerCase()}` : ''}.`,
    pagato: stato.fino ? `Pagata fino al ${data(stato.fino)}.` : 'Pagata.',
    scaduto: `Valeva fino al ${data(stato.fino ?? '')}: è da rinnovare.`,
  }[paga]
  const tono = (bene: boolean, quasi: boolean) => (bene ? undefined : quasi ? 'avviso' : 'guaio')
  return (
    <section>
      <Titoletto>CERTIFICATO E QUOTA</Titoletto>
      <div className="pad mie-schede">
        <Riquadro stretto>
          <Etichetta>CERTIFICATO MEDICO</Etichetta>
          <Dettaglio tono={tono(cert === 'valido' || cert === 'non_serve', cert === 'in_scadenza' || cert === 'in_arrivo')}>{certTesto}</Dettaglio>
          {mandare.tasto && <MandaCertificato box={mandare} dati={dati} personaId={personaId} onMandato={onMandato} />}
        </Riquadro>
        <Riquadro stretto>
          <Etichetta>QUOTA</Etichetta>
          <Dettaglio tono={tono(paga === 'pagato', paga === 'in_parte')}>{pagaTesto}</Dettaglio>
          <PagaSaldo dati={dati} scheda={scheda} io={io} ricevute={ricevute} />
          <PagaQuota dati={dati} scheda={scheda} io={io} />
        </Riquadro>
      </div>
    </section>
  )
}

/** Il tasto che sceglie il file e lo manda subito: la segreteria lo vede in DA FARE. */
function MandaCertificato({ box, dati, personaId, onMandato }: { box: ReturnType<typeof boxCertificato>; dati: DatiIscritto; personaId: string; onMandato: () => Promise<void> }) {
  const campo = useRef<HTMLInputElement>(null)
  const [guaio, setGuaio] = useState<string | null>(null)
  const [invio, setInvio] = useState(false)
  const manda = (file: File | undefined) => {
    if (!file) return
    setGuaio(null)
    setInvio(true)
    dati
      .mandaCertificato(personaId, file)
      // Il file è partito: se la scheda non si ricarica non è colpa dell'invio, e non si dice «non è partito».
      .then(() => onMandato().catch(() => setGuaio('Il certificato è partito, ma la pagina non si è aggiornata: ricaricala')))
      .catch((e: unknown) => setGuaio(e instanceof Error ? e.message : 'Il certificato non è partito: riprova fra poco'))
      .finally(() => {
        setInvio(false)
        // Lo stesso file, scelto di nuovo, deve far scattare ancora il change.
        if (campo.current) campo.current.value = ''
      })
  }
  return (
    <>
      <Dettaglio>{box.testo}</Dettaglio>
      <input ref={campo} type="file" accept="application/pdf,image/jpeg,image/png" hidden onChange={(e) => manda(e.target.files?.[0])} />
      <Tasti>
        <Tasto variante={box.tasto === 'manda-altro' ? 'linea' : 'principale'} disabled={invio} onClick={() => campo.current?.click()}>
          {invio ? 'STO MANDANDO…' : box.tasto === 'manda-altro' ? 'MANDA UN ALTRO FILE' : 'MANDA IL CERTIFICATO'}
        </Tasto>
      </Tasti>
      {guaio && <Dettaglio tono="guaio">{guaio}</Dettaglio>}
    </>
  )
}

function Ricevute({ ricevute }: { ricevute: Ricevuta[] }) {
  const [guaio, setGuaio] = useState<string | null>(null)
  const scarica = (r: Ricevuta) => {
    setGuaio(null)
    // pdf-lib si carica solo qui: chi guarda le lezioni non lo scarica.
    void import('../lib/ricevutaPdf')
      // Qui non c'è nessuno a cui chiedere: con la carta se arriva, se no senza.
      .then(async (m) => m.scaricaRicevuta(r, nomeFileRicevuta(r), await cartaSePuoi()))
      .catch(() => setGuaio('Il PDF non si è fatto: riprova fra un attimo.'))
  }
  return (
    <section>
      <Titoletto conto={ricevute.length || undefined}>RICEVUTE</Titoletto>
      <div className="pad stack" style={{ gap: 8, paddingBottom: 12 }}>
        {ricevute.length === 0 && <Dettaglio>Nessuna ricevuta: quando paghi in segreteria, la trovi qui.</Dettaglio>}
        {ricevute.map((r) => (
          <div key={r.id} className="card row mia-ricevuta" data-annullata={!!r.annullataIl || undefined}>
            <span className="stack grow" style={{ gap: 2, minWidth: 0 }}>
              <span style={{ fontWeight: 600 }}>
                N. {r.numero}/{r.anno} · {data(r.data)}
              </span>
              <span style={{ fontSize: 13, color: 'var(--dim)' }}>
                {r.annullataIl ? 'Annullata' : r.voci.map((v) => v.descrizione.toLowerCase()).join(', ')}
              </span>
            </span>
            <span className="num mia-ricevuta-euro">{euro(r.pagato)} €</span>
            <Tasto onClick={() => scarica(r)}>PDF</Tasto>
          </div>
        ))}
        {guaio && <Dettaglio tono="guaio">{guaio}</Dettaglio>}
      </div>
    </section>
  )
}

/**
 * Il nucleo familiare, per il titolare: chi c'è, chi è in regola, chi
 * aspetta la segreteria, e i pagamenti di tutti con lo sconto famiglia.
 */
function Nucleo({
  dati,
  io,
  membri,
  aggiunte,
  ricevute,
  onApri,
  onAggiungi,
}: {
  dati: DatiIscritto
  io: string
  membri: SchedaIscritto[]
  aggiunte: AggiuntaNucleo[]
  ricevute: Ricevuta[]
  onApri: (id: string) => void
  onAggiungi: () => void
}) {
  const oggi = chiaveGiorno(new Date())
  const valide = ricevute.filter((r) => !r.annullataIl)
  const pagatoDa = (id: string) => valide.filter((r) => r.personaId === id).reduce((s, r) => s + r.pagato, 0)
  const nomeDi = (id: string) => membri.find((p) => p.id === id)?.nome ?? ''
  const annuali = abbonamentiDalleRicevute(ricevute, nomeDi, oggi)
  const minimo = doveVaLoSconto([], annuali)
  const PAGA: Record<string, string> = {
    pagato: 'PAGATO',
    in_parte: 'IN PARTE',
    da_pagare: 'DA PAGARE',
    scaduto: 'DA RINNOVARE',
  }
  return (
    <>
      <section>
        <Titoletto conto={membri.length}>IL TUO NUCLEO</Titoletto>
        <div className="pad stack" style={{ gap: 8, paddingBottom: 12 }}>
          {membri.map((p) => {
            const guai = avvisi(p, oggi)
            return (
              <button key={p.id} type="button" className="card row mio-membro" onClick={() => onApri(p.id)}>
                <span className="stack grow" style={{ gap: 2, minWidth: 0, textAlign: 'left' }}>
                  <span style={{ fontWeight: 600 }}>
                    {p.nome} {p.cognome}
                    {p.id === io ? ' · tu' : ''}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--dim)' }}>{p.corsi.map((c) => c.nome).join(', ') || 'Nessun corso oggi'}</span>
                </span>
                <span className="num mia-lezione-cosa" data-tono={guai.some((g) => g.tono === 'guaio') ? 'guaio' : guai.length ? 'avviso' : 'fatto'}>
                  {guai.length ? 'DA SISTEMARE' : 'IN REGOLA'}
                </span>
              </button>
            )
          })}
          {aggiunte.map((x) => (
            <div key={x.id} className="card row mio-membro" data-attesa>
              <span className="stack grow" style={{ gap: 2, minWidth: 0 }}>
                <span style={{ fontWeight: 600 }}>
                  {x.nome} {x.cognome}
                </span>
                <span style={{ fontSize: 13, color: 'var(--dim)' }}>{x.corsi.join(', ')}</span>
              </span>
              <span className="num mia-lezione-cosa" data-tono={x.stato === 'rifiutata' ? 'guaio' : 'avviso'}>
                {x.stato === 'rifiutata' ? 'RIFIUTATA: CHIAMA LA SEGRETERIA' : 'LA GUARDA LA SEGRETERIA'}
              </span>
            </div>
          ))}
          <Dettaglio>Figli, coniuge, fratelli: il modulo parte coi tuoi dati, e la richiesta arriva in segreteria come le altre.</Dettaglio>
          <Tasti>
            <Tasto variante="principale" onClick={onAggiungi}>
              AGGIUNGI UNA PERSONA
            </Tasto>
          </Tasti>
        </div>
      </section>
      {membri.length > 1 && (
        <section>
          <Titoletto>PAGAMENTI DEL NUCLEO</Titoletto>
          <div className="pad stack" style={{ gap: 8, paddingBottom: 12 }}>
            <ul className="card stack mie-presenze">
              {membri.map((p) => {
                const come = comePaga(p, oggi)
                return (
                  <li key={p.id} className="row mia-presenza" data-stato={come === 'pagato' ? 'presente' : come === 'in_parte' ? 'nessuno' : 'assente'}>
                    <span className="stack grow" style={{ gap: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 600 }}>{p.nome}</span>
                      <span style={{ fontSize: 13, color: 'var(--dim)' }}>Pagati {euro(pagatoDa(p.id))} € nelle ricevute</span>
                      <PagaSaldo dati={dati} scheda={p} io={io} ricevute={ricevute} />
                      <PagaQuota dati={dati} scheda={p} io={io} />
                    </span>
                    <span className="num mia-presenza-detto">{PAGA[come]}</span>
                  </li>
                )
              })}
              <li className="row mia-presenza">
                <span className="grow" style={{ fontWeight: 700 }}>
                  Tutto il nucleo
                </span>
                <span className="num mia-ricevuta-euro">{euro(valide.reduce((s, r) => s + r.pagato, 0))} €</span>
              </li>
            </ul>
            {minimo ? (
              <Dettaglio>
                {minimo.scontato
                  ? `Sconto famiglia: il ${Math.round(SCONTO_FAMIGLIA * 100)}% su ${minimo.corso} di ${minimo.chi}, cioè ${euro(Math.round(minimo.importo * SCONTO_FAMIGLIA))} €: è già nella sua ricevuta.`
                  : `Sconto famiglia: il ${Math.round(SCONTO_FAMIGLIA * 100)}% sull’annuale che costa meno, ${minimo.corso} di ${minimo.chi}, cioè ${euro(Math.round(minimo.importo * SCONTO_FAMIGLIA))} €. Se non l’hai avuto, chiedilo in segreteria.`}
              </Dettaglio>
            ) : (
              <Dettaglio>Con due annuali nel nucleo, quello che costa meno ha il {Math.round(SCONTO_FAMIGLIA * 100)}% di sconto (la quota associativa no).</Dettaglio>
            )}
          </div>
        </section>
      )}
    </>
  )
}

/** Le icone a linea delle righe di CONTATTI. */
const ICONE_RIGA: Record<string, string[]> = {
  CHIAMA: ['M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A15 15 0 0 1 4 5a1 1 0 0 1 1-1z'],
  WHATSAPP: ['M5 4h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-7l-4 4v-4H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z'],
  'COME ARRIVARE': ['M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z', 'M10 10a2 2 0 1 0 4 0a2 2 0 1 0-4 0'],
  INSTAGRAM: ['M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z', 'M8.5 12a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0', 'M16.5 7.5h.01'],
  FACEBOOK: ['M14 4h3v3.5h-3a1 1 0 0 0-1 1V11h4l-.5 3.5H13V21h-3.5v-6.5H7V11h2.5V8.5A4.5 4.5 0 0 1 14 4z'],
  GUIDA: ['M5 4h9a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4z', 'M9 9h5'],
  ESCI: ['M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5', 'M15 8l4 4-4 4', 'M19 12H9'],
}

/** Il tab CONTATTI: per parlare con la palestra, in righe da toccare. */
function Contatti({ conEsci }: { conEsci: boolean }) {
  const riga = (v: VoceContatti) => {
    const dentro = (
      <>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {(ICONE_RIGA[v.nome] ?? []).map((d) => (
            <path key={d} d={d} />
          ))}
        </svg>
        <span className="ob mia-riga-nome">{v.nome}</span>
        {v.nota && <span className="num mia-riga-nota">{v.nota}</span>}
        <span aria-hidden="true" className="mia-riga-vai">›</span>
      </>
    )
    if (v.esci)
      return (
        <button key={v.nome} type="button" className="mia-riga" onClick={() => void esci(INDIRIZZI.iscritti)}>
          {dentro}
        </button>
      )
    const tel = v.href?.startsWith('tel:')
    return (
      <a key={v.nome} className="mia-riga" href={v.href} {...(tel ? {} : { target: '_blank', rel: 'noopener noreferrer' })}>
        {dentro}
      </a>
    )
  }
  return (
    <div className="stack" style={{ gap: 0 }}>
      {gruppiContatti({ guida: indirizzoPagina('iscritti'), conEsci }).map((g) => (
        <section key={g.titolo}>
          <Titoletto>{g.titolo}</Titoletto>
          <div className="pad">
            <div className="mia-scheda-righe">{g.voci.map(riga)}</div>
          </div>
        </section>
      ))}
      {/* In piccolo e in fondo: serve a chi segnala un problema, per dire che versione ha. */}
      <p className="num mia-versione" title={VERSIONE_ESTESA}>{VERSIONE}</p>
    </div>
  )
}
