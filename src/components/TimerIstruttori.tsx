import { lazy, type ReactNode, Suspense, useEffect, useMemo, useState } from 'react'
import type { Incorporato, StatoTimer } from '../../timer/src/lib/incorporato'
import type { Settings } from '../../timer/src/types'
import { loadSettings } from '../../timer/src/lib/storage'
import { loadDiscipline } from '../../timer/src/lib/discipline'
import { useMusica, useSpotify, type Musica } from '../../timer/src/lib/useMusica'
import { leggiLinkSpotify, suonaLista } from '../../timer/src/lib/spotify'
import { PlayerYoutube, PostoPlayer } from '../../timer/src/components/PlayerYoutube'
import { PlayerAudio } from '../../timer/src/components/PlayerAudio'
import type { Dati } from '../lib/dati'
import { azioneMusica, fonteDelLink, listaRicordata, musicaScelta, type AzioneMusica, ricordaLista, ricordaSpenta, spentaRicordata, statoMusica, type ListaMusica, type StatoMusica } from '../lib/musica'
import { avvisoSenzaRete, lettoreYoutube, statoStriscia, type PaginaIstruttori } from '../lib/timerIstruttori'
import { MusicaSala } from './tablet/MusicaSala'
import { Back, Nota } from './Icons'
import { Gear, Pause, Play } from '../../timer/src/components/Icons'

/**
 * Il timer dentro l'app degli istruttori: la navigazione, la striscia
 * dell'allenamento in corso e la pagina TIMER. Le regole stanno in
 * `lib/timerIstruttori.ts`; qui si mostra e si chiama.
 */

/** Il timer pesa quanto il resto dell'app: si scarica solo alla prima visita. */
const TimerSala = lazy(() => import('./tablet/TimerSala').then((m) => ({ default: m.TimerSala })))

/** Le icone a linea delle voci, come nel design (BarraNavigazione). */
const ICONE: Record<PaginaIstruttori, string[]> = {
  calendario: ['M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z', 'M4 10h16', 'M8 3v4M16 3v4'],
  timer: ['M4 13a8 8 0 1 0 16 0a8 8 0 1 0-16 0', 'M12 9v4l2.5 2', 'M9.5 2.5h5M12 2.5V5'],
  mieiTimer: ['M7 3h10a1 1 0 0 1 1 1v17l-6-4-6 4V4a1 1 0 0 1 1-1z'],
  ore: ['M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z', 'M9 8h6M9 12h6', 'M9 16h3'],
}

/**
 * La barra in basso del telefono. La voce di dove si è si legge anche senza
 * colore: la barra alta sopra, il fondo e il testo pieno.
 */
export function BarraNavigazione({
  voci,
  attiva,
  onPagina,
}: {
  voci: { pagina: PaginaIstruttori; nome: string }[]
  attiva: PaginaIstruttori
  onPagina: (p: PaginaIstruttori) => void
}) {
  return (
    <nav className="barra-nav" aria-label="Pagine">
      {voci.map((v) => (
        <button key={v.pagina} type="button" className="barra-voce" aria-current={attiva === v.pagina ? 'page' : undefined} onClick={() => onPagina(v.pagina)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {ICONE[v.pagina].map((d) => (
              <path key={d} d={d} />
            ))}
          </svg>
          <span className="num">{v.nome}</span>
        </button>
      ))}
    </nav>
  )
}

/**
 * L'allenamento in corso, da ogni pagina tranne il timer. Il tempo si ricalcola
 * dall'orologio a ogni giro: una scheda rimasta in secondo piano lo mostra giusto.
 * Toccarla riporta al timer; STOP (OK a fine allenamento) lo ferma senza aprirlo.
 */
export function StrisciaTimer({ stato, onApri, onFerma }: { stato: StatoTimer; onApri: () => void; onFerma: () => void }) {
  const [ora, setOra] = useState(() => Date.now())
  useEffect(() => {
    const i = window.setInterval(() => setOra(Date.now()), 500)
    return () => window.clearInterval(i)
  }, [])
  const s = statoStriscia(stato, ora)
  const finito = stato.status === 'done'
  // In pausa il colore dell'intervallo lascia il posto al grigio, come nel design.
  const colori = stato.status === 'paused' ? { background: 'var(--surface-2)', borderColor: 'var(--line)', color: 'var(--text)' } : { background: s.colore, borderColor: s.colore, color: 'var(--su-colore)' }
  return (
    <div className="striscia-timer" style={colori}>
      <button type="button" className="striscia-apri" onClick={onApri} aria-label={`Torna al timer: ${s.testo} ${s.tempo}`}>
        <span className="stack" style={{ gap: 2, minWidth: 0 }}>
          <span className="ob striscia-testo">{s.testo}</span>
          <span className="striscia-nome">{finito ? 'Tocca per tornare al timer' : stato.nome}</span>
        </span>
        <span className="grow" />
        <span className="num striscia-tempo">{s.tempo}</span>
      </button>
      <button type="button" className="striscia-stop" onClick={onFerma}>
        {finito ? 'OK' : 'STOP'}
      </button>
    </div>
  )
}

/** Se c'è rete: l'avviso di SENZA RETE compare e sparisce da solo. */
function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const su = () => setOnline(true)
    const giu = () => setOnline(false)
    window.addEventListener('online', su)
    window.addEventListener('offline', giu)
    return () => {
      window.removeEventListener('online', su)
      window.removeEventListener('offline', giu)
    }
  }, [])
  return online
}

/**
 * La pagina TIMER: il timer del tablet di sala (`TimerSala`), lo stesso
 * componente, senza la sua testata. Resta montato anche nascosto: un
 * allenamento avviato continua mentre si guardano le altre pagine.
 */
export function PaginaTimer({
  incorporato,
  visibile,
  indietro,
  onIndietro,
  conMusica = false,
  musica,
  impostazioni,
  onImpostazioni,
}: {
  incorporato: Incorporato
  visibile: boolean
  indietro: boolean
  onIndietro: () => void
  conMusica?: boolean
  /** La barra della musica, in fondo alla pagina. */
  musica?: ReactNode
  /**
   * Le impostazioni del timer (Spotify, i file della musica), che restano su
   * questo telefono: aperte o no, e il tasto per aprirle (null: niente tasto,
   * c'è un allenamento aperto).
   */
  impostazioni: boolean
  onImpostazioni: ((aperte: boolean) => void) | null
}) {
  const avviso = avvisoSenzaRete(useOnline(), conMusica)
  const conScheda = useMemo<Incorporato>(() => ({ ...incorporato, scheda: impostazioni ? 'impostazioni' : 'timer' }), [incorporato, impostazioni])
  return (
    <div className="faccia-timer" hidden={!visibile}>
      <div className="row pad" style={{ gap: 10, paddingTop: 16, paddingBottom: 6 }}>
        {/* Aperte le impostazioni, l'unico ritorno è ‹ TIMER: due «indietro» affiancati confondono. */}
        {indietro && !impostazioni && (
          <button type="button" className="icon-btn testo" onClick={onIndietro} style={{ gap: 6 }}>
            <Back />
            <span className="num" style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.12em' }}>APPELLO</span>
          </button>
        )}
        <h1 className="ob appello-titolo grow" style={{ margin: 0 }}>
          {impostazioni ? 'IMPOSTAZIONI' : 'TIMER'}
        </h1>
        {onImpostazioni && (
          <button
            type="button"
            className="icon-btn testo"
            onClick={() => onImpostazioni(!impostazioni)}
            aria-pressed={impostazioni}
            aria-label={impostazioni ? 'Torna al timer' : 'Impostazioni del timer'}
            style={{ gap: 6 }}
          >
            {impostazioni ? <Back /> : <Gear />}
            <span className="num tasto-impostazioni-testo">{impostazioni ? 'TIMER' : 'IMPOSTAZIONI'}</span>
          </button>
        )}
      </div>
      {avviso && (
        <div className="pad" style={{ paddingBottom: 8 }}>
          <div className="avviso-rete" role="status">
            <span className="num avviso-rete-titolo">SENZA RETE</span>
            <span>{avviso}</span>
          </div>
        </div>
      )}
      <Suspense fallback={<p className="pad" style={{ color: 'var(--dim)' }}>Un attimo…</p>}>
        <TimerSala incorporato={conScheda} visibile={visibile} />
      </Suspense>
      {musica}
    </div>
  )
}

/** La lista scelta, lo «spenta» e il lettore della musica del telefono. */
export interface MusicaTelefono {
  musica: Musica
  stato: StatoMusica
  /** Fonte e link per il timer: la lista scelta o le impostazioni, `musica: false` se spenta. */
  perIlTimer: Incorporato['musica']
  liste: ListaMusica[]
  scelta: string | null
  spotifyCollegato: boolean
  attiva: boolean
  scegli: (l: ListaMusica | null) => void
  accendi: () => void
  spegni: () => void
  /** All'uscita dall'app: la musica si ferma, anche quella che suona nell'app di Spotify. */
  ferma: () => void
  /** I lettori, fermi alla radice: YouTube solo dove serve (vedi `lettoreYoutube`). */
  lettori: (pagina: PaginaIstruttori) => ReactNode
  conYoutube: boolean
  /** Il timer ha cambiato le sue impostazioni (la musica compresa): restano su questo telefono. */
  onSettings: (s: Settings) => void
}

/**
 * La musica nel timer del telefono: come quella del tablet di sala (stesse
 * liste della segreteria, stessa barra), ma ricordata a parte, e spenta finché
 * chi insegna non la accende. Le liste sono tutte: il telefono non sta in una sala.
 */
export function useMusicaTelefono(d: Dati | null): MusicaTelefono {
  const [liste, setListe] = useState<ListaMusica[]>([])
  useEffect(() => {
    if (!d) return
    // Senza rete restano quelle che c'erano (la musica delle impostazioni c'è sempre):
    // si rileggono quando la rete torna o il telefono torna in primo piano.
    const leggi = () => void d.listeMusica().then(setListe, () => {})
    const torna = () => {
      if (document.visibilityState === 'visible') leggi()
    }
    leggi()
    window.addEventListener('online', leggi)
    document.addEventListener('visibilitychange', torna)
    return () => {
      window.removeEventListener('online', leggi)
      document.removeEventListener('visibilitychange', torna)
    }
  }, [d])
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  // Le impostazioni cambiano nella scheda IMPOSTAZIONI del timer (arrivano da `onSettings`), o nell'altra app sullo stesso telefono.
  useEffect(() => {
    const rileggi = () => setSettings(loadSettings())
    const siCambia = (e: StorageEvent) => {
      if (e.key === null || e.key === 'ods-timer:settings') rileggi()
    }
    const torna = () => {
      if (document.visibilityState === 'visible') rileggi()
    }
    window.addEventListener('storage', siCambia)
    document.addEventListener('visibilitychange', torna)
    return () => {
      window.removeEventListener('storage', siCambia)
      document.removeEventListener('visibilitychange', torna)
    }
  }, [])
  const [sceltaId, setSceltaId] = useState<string | null>(() => listaRicordata('telefono'))
  const [spenta, setSpenta] = useState(() => spentaRicordata('telefono'))
  // Partita: un ▶ o una lista toccata da quando la pagina è aperta. Prima la musica è ferma.
  const [parti, setParti] = useState(false)
  const lista = liste.find((l) => l.id === sceltaId) ?? null
  const perIlTimer = useMemo(() => musicaScelta(lista, settings, spenta), [lista, settings, spenta])
  const conScelta = useMemo(() => ({ ...settings, ...perIlTimer }), [settings, perIlTimer])
  const musica = useMusica(conScelta)
  const spotify = useSpotify()
  const suonando = musica.lettore?.inRiproduzione ?? false
  // I tasti dicono cosa ricordare e se la musica è partita (vedi `azioneMusica`).
  const fa = (a: AzioneMusica) => {
    const r = azioneMusica(a)
    if (r.pausa) void musica.comandi.pausa()
    if (r.spenta !== undefined) {
      ricordaSpenta('telefono', r.spenta)
      setSpenta(r.spenta)
    }
    setParti(r.parti)
  }
  useEffect(() => {
    if (suonando) setParti(azioneMusica('suona').parti)
  }, [suonando])
  const stato = statoMusica({ spenta, partita: parti, inRiproduzione: suonando })
  const conYoutube = musica.fonte === 'youtube' && musica.attiva
  const fonteAudio = musica.fonte === 'file' || musica.fonte === 'radio' ? musica.fonte : null
  const fonteLista = lista ? fonteDelLink(lista.link) : null
  return {
    musica,
    stato,
    perIlTimer,
    liste,
    scelta: lista ? lista.id : null,
    spotifyCollegato: spotify.collegato,
    attiva: settings.musica,
    scegli: (l) => {
      setSceltaId(l?.id ?? null)
      ricordaLista('telefono', l?.id ?? null)
      const uri = l ? leggiLinkSpotify(l.link) : null
      if (uri) void suonaLista(uri)
      fa('scegli')
    },
    accendi: () => fa('accendi'),
    spegni: () => fa('spegni'),
    ferma: () => fa('ferma'),
    conYoutube,
    onSettings: setSettings,
    // Uno solo e fermo alla radice: cambiando pagina non si ricarica.
    lettori: (pagina) => (
      <>
        {conYoutube && lettoreYoutube({ stato, pagina, youtube: true }) && <PlayerYoutube link={perIlTimer.youtube} parti={parti} />}
        {fonteAudio && musica.attiva && <PlayerAudio fonte={fonteAudio} link={perIlTimer.radio} nome={lista && fonteLista === 'radio' ? lista.nome : ''} parti={parti} />}
      </>
    ),
  }
}

/**
 * La musica in fondo alla pagina TIMER del telefono: spenta resta solo
 * ACCENDI LA MUSICA; accesa la barra del tablet su due righe, e sopra il
 * riquadro di YouTube, che vuole che il video si veda.
 */
export function BarraMusicaTelefono({ m }: { m: MusicaTelefono }) {
  // Le categorie come le ha viste il timer di questo telefono: servono solo al filtro delle liste.
  const discipline = useMemo(loadDiscipline, [])
  if (!m.attiva) return null
  return (
    <div className="musica-telefono">
      {m.stato === 'spenta' ? (
        <button
          type="button"
          className="btn btn-ghost musica-accendi"
          onClick={m.accendi}
        >
          <Nota size={22} />
          <span className="ob">ACCENDI LA MUSICA</span>
        </button>
      ) : (
        <MusicaSala
          musica={m.musica}
          liste={m.liste}
          scelta={m.scelta}
          spotifyCollegato={m.spotifyCollegato}
          onScegli={m.scegli}
          onSpegni={m.spegni}
          discipline={discipline}
          dispositivo="telefono"
          stato={m.stato}
          video={m.conYoutube ? <PostoPlayer /> : undefined}
        />
      )}
    </div>
  )
}

/**
 * La barra piccola della musica fuori dalla pagina TIMER, sopra la barra delle
 * pagine: il titolo, MUSICA scritto, e ⏸/▶. Il resto porta al TIMER.
 */
export function MusicaMini({ m, onApri }: { m: MusicaTelefono; onApri: () => void }) {
  const l = m.musica.lettore
  const suona = m.stato === 'suona'
  const titolo = l?.titolo || m.liste.find((x) => x.id === m.scelta)?.nome || 'Musica'
  return (
    <div className="musica-mini">
      <button type="button" className="musica-mini-apri" onClick={onApri} aria-label={`Torna al timer: musica, ${titolo}`}>
        <Nota size={22} />
        <span className="stack" style={{ gap: 1, minWidth: 0 }}>
          <span className="musica-mini-titolo">{titolo}</span>
          <span className="num musica-mini-stato">{suona ? 'MUSICA' : 'MUSICA IN PAUSA'}</span>
        </span>
      </button>
      <button
        type="button"
        className="musica-mini-tasto"
        onClick={() => void (suona ? m.musica.comandi.pausa() : m.musica.comandi.suona())}
        aria-label={suona ? 'Metti in pausa la musica' : 'Fai partire la musica'}
      >
        {suona ? <Pause size={18} /> : <Play size={18} />}
      </button>
    </div>
  )
}
