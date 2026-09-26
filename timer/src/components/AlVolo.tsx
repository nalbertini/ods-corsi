import { useEffect, useRef, useState } from 'react'
import type { Settings } from '../types'
import { Cues } from '../lib/audio'
import { useWakeLock } from '../lib/wakeLock'
import { apriSessione, chiudiSessione } from '../lib/mediaSession'
import { pad } from '../lib/format'
import { Pause, Play } from './Icons'
import { DentroAnello, Digits, Ring } from './Quadrante'
import { FINALE, a_caso } from '../lib/adesivi'
import { CONTO_ALLA_ROVESCIA, FINALE_LINES } from '../lib/engine'
import { say } from '../lib/voice'
import { TEMPO_CLIP, finaleClip } from '../lib/voiceClips'

/**
 * I due strumenti che non hanno bisogno di un allenamento scritto.
 *
 * In lezione capita in continuazione: «novanta secondi e si riparte», oppure
 * «vediamo quanto ci metti». Per tutte e due le cose bisognava costruire un
 * timer e salvarlo, cioè fermarsi a fare l'editor davanti a venti persone
 * ferme. Questi due partono con un tocco e non lasciano niente dietro.
 *
 * Hanno l'impaginazione del timer degli allenamenti e non una loro: stessa
 * intestazione, stesso anello, stesse cifre, stessi comandi in fondo. Sono tre
 * schermate che contano il tempo, e chi le usa non deve impararle tre volte.
 *
 * Il tempo arriva sempre dall'orologio e mai sommato un pezzo alla volta: è la
 * stessa regola del timer degli allenamenti, e serve perché un telefono che
 * mette in pausa la pagina non faccia restare indietro il conto.
 */

/** Le durate che si chiedono davvero in sala, in secondi. */
export const DURATE_AL_VOLO = [30, 45, 60, 90, 120, 180]

export const etichettaDurata = (s: number) =>
  s < 60 ? `${s}″` : s % 60 === 0 ? `${s / 60}′` : `${Math.floor(s / 60)}′${s % 60}`

const centesimi = (ms: number) => Math.floor((ms % 1000) / 10)
const minutiSecondi = (ms: number) => {
  const s = Math.floor(ms / 1000)
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`
}
const conCentesimi = (ms: number) => `${minutiSecondi(ms)}.${pad(centesimi(ms))}`

/* ------------------------------------------------------------------ *
 * Cronometro
 * ------------------------------------------------------------------ */

export function CronometroScreen({ settings }: { settings: Settings }) {
  // `partito` è l'istante in cui è ripartito, `banca` quello già accumulato
  // prima dell'ultima pausa: il tempo mostrato è sempre la somma dei due letta
  // adesso, mai un contatore incrementato a ogni tick.
  const [partito, setPartito] = useState<number | null>(null)
  const [banca, setBanca] = useState(0)
  const [ora, setOra] = useState(0)
  const [giri, setGiri] = useState<number[]>([])

  const trascorso = banca + (partito === null ? 0 : ora - partito)
  const inCorso = partito !== null

  useEffect(() => {
    if (!inCorso) return
    let vivo = true
    const tic = () => {
      if (!vivo) return
      setOra(performance.now())
      requestAnimationFrame(tic)
    }
    requestAnimationFrame(tic)
    return () => {
      vivo = false
    }
  }, [inCorso])

  useWakeLock(settings.keepAwake && inCorso)

  const avviaOFerma = () => {
    if (inCorso) {
      setBanca(trascorso)
      setPartito(null)
    } else {
      const t = performance.now()
      setOra(t)
      setPartito(t)
    }
  }

  const azzera = () => {
    setPartito(null)
    setBanca(0)
    setGiri([])
  }

  /** Un giro segna il tempo di adesso: la lista tiene i totali, gli scarti si ricavano. */
  const segnaGiro = () => setGiri((g) => [...g, trascorso])

  const precedente = (i: number) => (i === 0 ? 0 : giri[i - 1])
  const scarti = giri.map((g, i) => g - precedente(i))
  const inTesta = scarti.length > 1 ? Math.min(...scarti) : null
  const giroCorrente = trascorso - (giri.length ? giri[giri.length - 1] : 0)

  return (
    <div className="timer" data-attrezzo="true" style={{ ['--state' as string]: 'var(--blu)' }}>
      <div className="row timer-top">
        <div className="stack grow" style={{ gap: 1, minWidth: 0 }}>
          <span className="ob titolo-timer">CRONOMETRO</span>
          <span className="sottotitolo-timer" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.18em', color: 'var(--dim)' }}>
            CONTA IN SALITA
          </span>
        </div>
        <button className="icon-btn testo" onClick={azzera} aria-label="Azzera il cronometro">
          <span className="cond" style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.1em' }}>
            AZZERA
          </span>
        </button>
      </div>

      <div className="timer-main">
        {/* L'anello fa da lancetta dei secondi — un giro al minuto — e dentro
            tiene il giro in corso, come nel timer tiene il round. */}
        <div className="anello">
          <Ring progress={(trascorso % 60000) / 60000} color="var(--blu)" />
          <DentroAnello
            etichetta="GIRO"
            numero={String(giri.length + 1)}
            sotto={giri.length ? conCentesimi(giroCorrente) : undefined}
            colore="var(--blu)"
          />
        </div>

        <div className="timer-col" style={{ alignItems: 'center', gap: 4 }}>
          <span className="state-label">{inCorso ? 'IN CORSA' : trascorso > 0 ? 'FERMO' : 'PRONTO'}</span>
          {/* I minuti restano della misura delle cifre del timer e i centesimi
              stanno accanto, un terzo: da lontano si legge il minuto, in mano
              il centesimo. */}
          <div className="crono-cifre">
            <Digits value={minutiSecondi(trascorso)} className="digits digits-crono" />
            <span className="crono-centesimi num">.{pad(centesimi(trascorso))}</span>
          </div>
          <span className="exercise">{giri.length ? `${giri.length} giri segnati` : 'Segna i giri con GIRO'}</span>
        </div>
      </div>

      {giri.length > 0 && (
        <div className="crono-giri" aria-label="Giri segnati">
          {giri
            .map((tot, i) => ({ n: i + 1, tot, scarto: scarti[i] }))
            .reverse()
            .map((g) => (
              <div key={g.n} className="crono-giro">
                <span className="cond crono-giro-n">GIRO {pad(g.n)}</span>
                <span
                  className="num crono-giro-scarto"
                  style={{ color: inTesta !== null && g.scarto === inTesta ? 'var(--verde)' : 'var(--text)' }}
                >
                  {conCentesimi(g.scarto)}
                </span>
                <span className="num crono-giro-tot">{conCentesimi(g.tot)}</span>
              </div>
            ))}
        </div>
      )}

      <div className="row timer-controlli">
        <button className="btn btn-ghost tasto-giro" onClick={segnaGiro} disabled={!inCorso} aria-label="Segna un giro">
          <span style={{ fontSize: 18 }}>GIRO</span>
        </button>
        <button
          className="btn grow tasto-avvia"
          style={{ background: 'var(--blu)', color: 'var(--su-colore)' }}
          onClick={avviaOFerma}
        >
          {inCorso ? <Pause size={22} /> : <Play size={22} />}
          <span style={{ fontSize: 22 }}>{inCorso ? 'FERMA' : trascorso > 0 ? 'RIPRENDI' : 'AVVIA'}</span>
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Conto alla rovescia
 * ------------------------------------------------------------------ */

/**
 * La scheda apre direttamente sul conto, fermo.
 *
 * Prima c'era una schermata di sole durate, e toccarne una faceva partire il
 * conto: due cose sbagliate insieme. Una schermata che serve solo a scegliere
 * un numero è un passaggio in più fra te e lo strumento — le sei durate stanno
 * già dentro il conto, sotto le cifre — e far partire il tempo mentre si guarda
 * lo schermo non è mai quello che si vuole: si sceglie la durata, si guarda la
 * sala, e si dà il via quando la sala è pronta. Quindi scegliere prepara e
 * basta; a far partire è AVVIA.
 */
export function CountdownTab({ settings }: { settings: Settings }) {
  return <ContaAllaRovescia settings={settings} />
}

function ContaAllaRovescia({ settings }: { settings: Settings }) {
  const [durata, setDurata] = useState(DURATE_AL_VOLO[0])
  const [fine, setFine] = useState<number | null>(null)
  const [restoInPausa, setRestoInPausa] = useState(DURATE_AL_VOLO[0] * 1000)
  const [ora, setOra] = useState(() => performance.now())
  /* Estratti allo scadere e tenuti da parte: se li si scegliesse al volo dentro
     il render, illustrazione e frase cambierebbero a ogni battito. */
  const [complimento, setComplimento] = useState<{ src: string; frase: string; i: number } | null>(null)
  const cues = useRef(new Cues())
  const ultimoTic = useRef<number | null>(null)
  const finito = useRef(false)

  const resto = fine === null ? restoInPausa : Math.max(0, fine - ora)
  const inCorso = fine !== null && resto > 0
  const aZero = resto <= 0
  const svolti = durata * 1000 - resto
  cues.current.volume = settings.volume

  useEffect(() => {
    if (fine === null) return
    const id = window.setInterval(() => setOra(performance.now()), 80)
    return () => window.clearInterval(id)
  }, [fine])

  /* I suoni si consegnano all'orologio audio appena si sa quando scade, invece
     di farli suonare dal battito: il battito si ferma quando il telefono va in
     tasca, l'orologio audio no. `fine` cambia a ogni avvio, pausa, «+30″» o
     cambio di durata, e ogni volta la coda si rifà da capo. */
  useEffect(() => {
    const c = cues.current
    c.annullaProgrammati()
    if (fine === null || !settings.countdownBeep) return
    const resto = (fine - performance.now()) / 1000
    for (let k = CONTO_ALLA_ROVESCIA; k >= 1; k--) {
      const fra = resto - k
      if (fra > 0.02) c.programmaBip(fra, k === 1)
    }
    if (resto > 0.02) c.programmaScadenza(resto)
    return () => c.annullaProgrammati()
  }, [fine, settings.countdownBeep])

  /* Il contesto audio non veniva mai sbloccato qui: `new Cues()` c'era,
     `unlock()` no, e senza contesto i bip finali e il segnale di fine non
     venivano nemmeno creati — muti su qualunque dispositivo. E finché il conto
     gira, il fruscìo che tiene sveglia la cassa bluetooth. */
  useEffect(() => {
    const c = cues.current
    c.unlock()
    c.tieniSveglio(inCorso)
    return () => c.tieniSveglio(false)
  }, [inCorso])

  // Bip degli ultimi cinque secondi e segnale di fine: attaccati al secondo
  // mostrato, così suonano una volta sola anche se il tick passa più spesso.
  useEffect(() => {
    if (fine === null) return
    const s = Math.ceil(resto / 1000)
    if (s > 0 && ultimoTic.current !== s) {
      ultimoTic.current = s
      if (settings.ticchettio) cues.current.tick(s % 2 === 0)
    }
    // I bip e la nota dello scadere sono già in coda sull'orologio audio.
    if (resto <= 0 && !finito.current) {
      finito.current = true
      const i = Math.floor(Math.random() * FINALE_LINES.length)
      const complimenti = settings.coach !== 'off'
      setComplimento({ src: a_caso(FINALE), frase: FINALE_LINES[i], i })
      /* Passa dal sistema delle clip invece che dalla sintesi secca: così con
         la voce incisa «Tempo» è la voce vera, e se Maurizio è acceso dice
         anche lui la sua. Senza le clip parla la sintesi, con la frase intera. */
      if (settings.voice) {
        say(
          complimenti ? [TEMPO_CLIP, finaleClip(i)] : [TEMPO_CLIP],
          complimenti ? `Tempo. ${FINALE_LINES[i]}` : 'Tempo',
          { volume: settings.volume, voiceURI: settings.voiceURI, useRecorded: settings.recordedVoice },
        )
      }
      setFine(null)
      setRestoInPausa(0)
    }
  }, [resto, fine, settings.countdownBeep, settings.voice, settings.volume, settings.voiceURI, settings.recordedVoice, settings.coach, settings.ticchettio])

  useWakeLock(settings.keepAwake && inCorso)

  /* Scegliere una durata la carica e lascia il conto fermo: il via lo dà AVVIA,
     quando la sala è pronta e non quando il dito tocca il numero. */
  const prepara = (da: number) => {
    finito.current = false
    ultimoTic.current = null
    setComplimento(null)
    setDurata(da)
    setRestoInPausa(da * 1000)
    setFine(null)
  }

  const riparti = (da: number) => {
    finito.current = false
    ultimoTic.current = null
    setComplimento(null)
    setDurata(da)
    setRestoInPausa(da * 1000)
    setFine(performance.now() + da * 1000)
    setOra(performance.now())
  }

  const pausaOAvvia = () => {
    cues.current.unlock()
    if (inCorso) {
      setRestoInPausa(resto)
      setFine(null)
    } else if (aZero) riparti(durata)
    else {
      setFine(performance.now() + restoInPausa)
      setOra(performance.now())
    }
  }

  const allunga = () => {
    finito.current = false
    ultimoTic.current = null
    setComplimento(null)
    setDurata((d) => d + 30)
    if (fine === null) setRestoInPausa((r) => r + 30000)
    else setFine((f) => (f ?? performance.now()) + 30000)
  }


  /* Il conto alla rovescia è un blocco di lavoro della durata scelta, non un
     recupero: mentre gira porta il rosso del lavoro, e allo zero passa al
     verde, che in quest'app vuol dire finito — è lo stesso verde con cui il
     timer degli allenamenti scrive COMPLETATO. Il cambio di colore allo zero
     resta, ribaltato: da rosso a verde. */
  /* Caricato e mai fatto partire: non è una pausa, è un timer pronto — e il
     tasto grande deve dire AVVIA, non RIPRENDI. */
  const intatto = fine === null && !aZero && restoInPausa === durata * 1000

  /* La schermata di blocco, ma solo se il conto è stato davvero avviato.
     Questa scheda resta montata anche quando guardi altrove — serve a farla
     continuare a contare — e senza questa condizione si prendeva il «in
     riproduzione» del telefono all'apertura dell'app, con il conto ancora
     fermo su PRONTO: cioè toglieva il posto al lettore musicale senza che
     nessuno avesse chiesto niente. */
  const inSessione = !aZero && !intatto
  useEffect(() => {
    if (!inSessione) {
      chiudiSessione()
      return
    }
    apriSessione(
      {
        titolo: `${etichettaDurata(durata)} · ${inCorso ? 'in corso' : 'in pausa'}`,
        sottotitolo: 'Conto alla rovescia',
        inCorso,
        durata,
        posizione: Math.min(durata, svolti / 1000),
      },
      { avvia: pausaOAvvia, pausa: pausaOAvvia },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inSessione, inCorso, durata])

  useEffect(() => () => chiudiSessione(), [])

  const tinta = aZero ? 'var(--verde)' : 'var(--rosso)'
  const mostrato = Math.ceil(resto / 1000)
  const avanzamento = durata > 0 ? Math.min(1, svolti / (durata * 1000)) : 0

  return (
    <div className="timer" data-attrezzo="true" style={{ ['--state' as string]: tinta }}>
      <div className="row timer-top">
        <div className="stack grow" style={{ gap: 1, minWidth: 0 }}>
          <span className="ob titolo-timer">CONTO ALLA ROVESCIA</span>
          <span className="sottotitolo-timer" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.18em', color: 'var(--dim)' }}>
            {etichettaDurata(durata)} IN TUTTO
          </span>
        </div>
        <button className="icon-btn testo" onClick={() => riparti(durata)} aria-label="Ricomincia">
          <span className="cond" style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.1em' }}>
            RIFAI
          </span>
        </button>
      </div>

      <div className="timer-main">
        {/* Allo zero Maurizio si prende il posto dell'anello — non quello delle
            cifre, che restano il contenuto — e fa i complimenti a chi ha appena
            finito. È lo stesso posto e la stessa misura che occupa quando lo
            becchi a sbagliare il conto nel timer degli allenamenti. */}
        {aZero && complimento && settings.coach !== 'off' ? (
          <div className="beccato">
            <img src={complimento.src} alt="" />
            <span className="beccato-frase">{complimento.frase}</span>
          </div>
        ) : (
          <div className="anello">
            <Ring progress={avanzamento} color={tinta} />
            <DentroAnello
              etichetta="IN TUTTO"
              numero={etichettaDurata(durata)}
              sotto={`SVOLTI ${minutiSecondi(svolti)}`}
              colore={tinta}
            />
          </div>
        )}

        <div className="timer-col" style={{ alignItems: 'center', gap: 4 }}>
          <span className="state-label">
            {aZero ? 'TEMPO' : inCorso ? 'LAVORO' : intatto ? 'PRONTO' : 'IN PAUSA'}
          </span>
          <Digits value={`${pad(Math.floor(mostrato / 60))}:${pad(mostrato % 60)}`} />
          <span className="exercise">
            {aZero ? 'Tempo scaduto' : intatto ? 'Scegli la durata, poi AVVIA' : 'Si lavora fino a zero'}
          </span>
        </div>
      </div>

      <div style={{ height: 10, background: 'var(--surface-2)' }}>
        <div style={{ height: '100%', width: `${avanzamento * 100}%`, background: tinta }} />
      </div>

      {/* Cambiare durata senza uscire: è il gesto che si fa quando la sala
          risponde meglio o peggio del previsto. */}
      <div className="al-volo-scelte">
        {DURATE_AL_VOLO.map((s) => (
          <button key={s} className="chip" data-on={durata === s} onClick={() => prepara(s)}>
            {etichettaDurata(s)}
          </button>
        ))}
      </div>

      <div className="row timer-controlli">
        <button className="btn-piu" onClick={allunga} aria-label="Aggiungi trenta secondi">
          +30&Prime;
        </button>
        <button className="btn grow tasto-avvia" style={{ background: tinta, color: 'var(--su-colore)' }} onClick={pausaOAvvia}>
          {inCorso ? <Pause size={22} /> : <Play size={22} />}
          <span style={{ fontSize: 22 }}>
            {inCorso ? 'PAUSA' : aZero ? 'RIFAI' : intatto ? 'AVVIA' : 'RIPRENDI'}
          </span>
        </button>
      </div>
    </div>
  )
}
