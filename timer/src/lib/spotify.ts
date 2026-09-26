/**
 * La musica della sala, comandata da Spotify.
 *
 * Una pagina web non può toccare il lettore di un'altra app: non c'è
 * un'interfaccia del sistema per mettere in pausa «quello che sta suonando»,
 * e non ci sarà. Spotify però ha la sua, aperta a chi entra col proprio
 * account: da qui si mette in pausa, si salta un brano e si cambia il volume
 * del dispositivo su cui Spotify sta suonando — il telefono, il tablet, la
 * cassa collegata con Spotify Connect. Il timer non suona niente lui: dice a
 * Spotify cosa fare, e Spotify lo fa dove sta già suonando.
 *
 * Tre condizioni, che valgono la pena sapere prima di cercare il guasto:
 * - l'account deve essere **Premium**: con quello gratuito Spotify risponde di no;
 * - qualcuno deve aver **registrato l'app** su developer.spotify.com, una volta
 *   sola, per avere il Client ID (vedi la guida);
 * - Spotify deve essere **aperto su un dispositivo**: senza, non c'è niente da
 *   comandare.
 *
 * L'accesso è il flusso «PKCE», quello pensato per le app senza server: niente
 * segreti nel codice, e il gettone resta nel browser di questo dispositivo.
 */

const CHIAVE_GETTONE = 'ods-timer:spotify'
const CHIAVE_PKCE = 'ods-timer:spotify-pkce'
const CHIAVE_CLIENT = 'ods-timer:spotify-client'

const AUTORIZZA = 'https://accounts.spotify.com/authorize'
const GETTONE = 'https://accounts.spotify.com/api/token'
const API = 'https://api.spotify.com/v1'
const PERMESSI = 'user-read-playback-state user-modify-playback-state'

/** Ogni quanto si chiede a Spotify cosa sta suonando, finché qualcuno guarda. */
const OGNI = 5000

interface Gettone {
  accesso: string
  rinnovo: string
  /** Istante (ms) oltre cui il gettone di accesso non vale più. */
  scade: number
}

export interface Lettore {
  inRiproduzione: boolean
  titolo: string
  artista: string
  copertina: string | null
  /** 0–100, o null quando il dispositivo non lascia cambiare il volume da fuori. */
  volume: number | null
  dispositivo: string
}

export interface StatoMusica {
  /** C'è un Client ID: si può almeno provare a collegarsi. */
  configurato: boolean
  collegato: boolean
  /** Null: Spotify non sta suonando su nessun dispositivo. */
  lettore: Lettore | null
  /** L'ultima cosa andata storta, detta in modo che si capisca cosa fare. */
  errore: string | null
}

/* ---------- memoria ---------- */

function leggi<T>(chiave: string): T | null {
  try {
    const grezzo = localStorage.getItem(chiave)
    return grezzo ? (JSON.parse(grezzo) as T) : null
  } catch {
    return null
  }
}

function scrivi(chiave: string, valore: unknown) {
  try {
    if (valore === null) localStorage.removeItem(chiave)
    else localStorage.setItem(chiave, JSON.stringify(valore))
  } catch {
    // Storage negato: il collegamento vale finché la pagina resta aperta.
  }
}

/**
 * Il Client ID dell'app registrata su Spotify.
 *
 * Quello scritto nelle impostazioni vince su quello messo in compilazione: si
 * può provare un'app registrata al volo senza ripubblicare il sito. Non è un
 * segreto — il flusso PKCE è fatto apposta per stare in chiaro in una pagina.
 */
export function clientId(): string {
  return leggi<string>(CHIAVE_CLIENT) || (import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? '').trim()
}

export const clientIdDaCompilazione = () => Boolean((import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? '').trim())

export function impostaClientId(id: string) {
  const pulito = id.trim()
  scrivi(CHIAVE_CLIENT, pulito || null)
  aggiorna({ configurato: Boolean(clientId()) })
}

/**
 * L'indirizzo a cui Spotify rimanda dopo l'accesso.
 *
 * Va scritto **identico** fra i Redirect URI dell'app su developer.spotify.com,
 * barra finale compresa: le impostazioni lo mostrano apposta, da copiare.
 */
export function indirizzoRitorno(): string {
  const u = new URL(window.location.href)
  u.search = ''
  u.hash = ''
  u.pathname = u.pathname.replace(/index\.html$/, '')
  return u.toString()
}

/* ---------- lo stato, per chi lo mostra ---------- */

let stato: StatoMusica = {
  configurato: Boolean(clientId()),
  collegato: Boolean(leggi<Gettone>(CHIAVE_GETTONE)),
  lettore: null,
  errore: null,
}
const ascoltatori = new Set<() => void>()

function aggiorna(patch: Partial<StatoMusica>) {
  stato = { ...stato, ...patch }
  ascoltatori.forEach((f) => f())
}

export const statoMusica = () => stato

export function ascolta(f: () => void) {
  ascoltatori.add(f)
  return () => {
    ascoltatori.delete(f)
  }
}

/* ---------- accesso ---------- */

function casuale(lunghezza: number): string {
  const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const byte = crypto.getRandomValues(new Uint8Array(lunghezza))
  return Array.from(byte, (b) => alfabeto[b % alfabeto.length]).join('')
}

async function sfida(verificatore: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verificatore))
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/** Porta alla pagina di accesso di Spotify. Si torna qui da soli, a cose fatte. */
export async function collega() {
  const id = clientId()
  if (!id) {
    aggiorna({ errore: 'Manca il Client ID dell’app Spotify.' })
    return
  }
  if (!crypto.subtle) {
    aggiorna({ errore: 'Il collegamento a Spotify vuole una pagina https.' })
    return
  }
  const verificatore = casuale(64)
  const controllo = casuale(16)
  scrivi(CHIAVE_PKCE, { verificatore, controllo })
  const q = new URLSearchParams({
    client_id: id,
    response_type: 'code',
    redirect_uri: indirizzoRitorno(),
    code_challenge_method: 'S256',
    code_challenge: await sfida(verificatore),
    scope: PERMESSI,
    state: controllo,
  })
  window.location.assign(`${AUTORIZZA}?${q}`)
}

export function scollega() {
  scrivi(CHIAVE_GETTONE, null)
  abbassata = null
  aggiorna({ collegato: false, lettore: null, errore: null })
}

async function chiediGettone(corpo: Record<string, string>): Promise<Gettone | null> {
  try {
    const r = await fetch(GETTONE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId(), ...corpo }),
    })
    if (!r.ok) return null
    const j = (await r.json()) as { access_token: string; refresh_token?: string; expires_in: number }
    const g: Gettone = {
      accesso: j.access_token,
      // Spotify a volte ne dà uno nuovo, a volte tiene quello di prima.
      rinnovo: j.refresh_token ?? corpo.refresh_token ?? '',
      scade: Date.now() + (j.expires_in - 60) * 1000,
    }
    scrivi(CHIAVE_GETTONE, g)
    return g
  } catch {
    return null
  }
}

/**
 * Il ritorno da Spotify, se questa apertura lo è.
 *
 * Si chiama una volta all'avvio: se nell'indirizzo c'è la risposta
 * dell'accesso, la si scambia col gettone e si ripulisce l'indirizzo. Dice
 * com'è andata, o null se non era un ritorno da Spotify.
 */
export async function completaAccesso(): Promise<'collegato' | 'rifiutato' | null> {
  const q = new URLSearchParams(window.location.search)
  const codice = q.get('code')
  const rifiuto = q.get('error')
  if (!codice && !rifiuto) return null
  const attesa = leggi<{ verificatore: string; controllo: string }>(CHIAVE_PKCE)
  if (!attesa || q.get('state') !== attesa.controllo) return null
  scrivi(CHIAVE_PKCE, null)
  // Un ricarica non deve riprovare a scambiare un codice già usato.
  window.history.replaceState(null, '', indirizzoRitorno() + window.location.hash)
  if (rifiuto || !codice) {
    aggiorna({ errore: 'Accesso a Spotify annullato.' })
    return 'rifiutato'
  }
  const g = await chiediGettone({
    grant_type: 'authorization_code',
    code: codice,
    redirect_uri: indirizzoRitorno(),
    code_verifier: attesa.verificatore,
  })
  if (!g) {
    aggiorna({ errore: 'Spotify non ha dato l’accesso. Controlla Client ID e indirizzo di ritorno.' })
    return 'rifiutato'
  }
  aggiorna({ collegato: true, errore: null })
  void leggiLettore()
  return 'collegato'
}

let rinnovoInCorso: Promise<Gettone | null> | null = null

async function gettoneValido(): Promise<string | null> {
  const g = leggi<Gettone>(CHIAVE_GETTONE)
  if (!g) return null
  if (Date.now() < g.scade) return g.accesso
  // Due richieste insieme non devono rinnovare due volte: la seconda
  // invaliderebbe il gettone appena ottenuto dalla prima.
  rinnovoInCorso ??= chiediGettone({ grant_type: 'refresh_token', refresh_token: g.rinnovo }).finally(() => {
    rinnovoInCorso = null
  })
  const nuovo = await rinnovoInCorso
  if (!nuovo) {
    scollega()
    aggiorna({ errore: 'Il collegamento a Spotify è scaduto: ricollegalo dalle impostazioni.' })
    return null
  }
  return nuovo.accesso
}

/* ---------- le richieste ---------- */

class ErroreSpotify extends Error {
  constructor(
    readonly stato: number,
    readonly motivo: string,
  ) {
    super(motivo)
  }
}

/** Una chiamata all'API, col gettone rinnovato se serve. */
async function api(metodo: string, percorso: string, corpo?: unknown): Promise<unknown> {
  const accesso = await gettoneValido()
  if (!accesso) throw new ErroreSpotify(401, 'NON_COLLEGATO')
  const r = await fetch(`${API}${percorso}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${accesso}`,
      ...(corpo === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  })
  if (r.status === 204) return null
  const testo = await r.text()
  if (!r.ok) {
    let motivo = ''
    try {
      const j = JSON.parse(testo) as { error?: { reason?: string; message?: string } }
      motivo = j.error?.reason ?? j.error?.message ?? ''
    } catch {
      // Risposta non in JSON: resta lo stato.
    }
    if (r.status === 401) {
      // Gettone rifiutato prima della scadenza: lo si butta e al prossimo giro si rinnova.
      const g = leggi<Gettone>(CHIAVE_GETTONE)
      if (g) scrivi(CHIAVE_GETTONE, { ...g, scade: 0 })
    }
    throw new ErroreSpotify(r.status, motivo)
  }
  if (!testo) return null
  try {
    return JSON.parse(testo)
  } catch {
    return null
  }
}

function spiega(e: unknown): string {
  if (!(e instanceof ErroreSpotify)) return 'Spotify non risponde: controlla la rete.'
  if (e.motivo === 'NON_COLLEGATO') return 'Spotify non è collegato.'
  if (e.motivo === 'PREMIUM_REQUIRED') return 'Per comandare la musica Spotify vuole un account Premium.'
  if (e.motivo === 'NO_ACTIVE_DEVICE' || e.stato === 404)
    return 'Spotify non sta suonando su nessun dispositivo: aprilo e fai partire un brano.'
  if (e.motivo === 'VOLUME_CONTROL_DISALLOW') return 'Questo dispositivo non lascia cambiare il volume da fuori.'
  if (e.stato === 429) return 'Troppe richieste a Spotify: riprova fra qualche secondo.'
  if (e.stato === 403) return 'Spotify ha rifiutato il comando.'
  return 'Spotify non ha eseguito il comando.'
}

interface RispostaLettore {
  is_playing: boolean
  device?: { name: string; volume_percent: number | null; supports_volume?: boolean }
  item?: {
    name: string
    artists?: Array<{ name: string }>
    show?: { name: string }
    album?: { images?: Array<{ url: string; width: number }> }
    images?: Array<{ url: string; width: number }>
  } | null
}

/** Chiede a Spotify cosa sta suonando, e dove. */
export async function leggiLettore(): Promise<Lettore | null> {
  if (!stato.collegato) return null
  try {
    const r = (await api('GET', '/me/player')) as RispostaLettore | null
    if (!r || !r.device) {
      aggiorna({ lettore: null })
      return null
    }
    const immagini = r.item?.album?.images ?? r.item?.images ?? []
    // La più piccola che basti: sul timer la copertina è un francobollo.
    const copertina = [...immagini].sort((a, b) => a.width - b.width).find((i) => i.width >= 64) ?? immagini[0]
    const lettore: Lettore = {
      inRiproduzione: r.is_playing,
      titolo: r.item?.name ?? '',
      artista: r.item?.artists?.map((a) => a.name).join(', ') ?? r.item?.show?.name ?? '',
      copertina: copertina?.url ?? null,
      volume: r.device.supports_volume === false ? null : r.device.volume_percent,
      dispositivo: r.device.name,
    }
    aggiorna({ lettore, errore: null })
    return lettore
  } catch (e) {
    if (e instanceof ErroreSpotify && e.stato === 401) return null
    aggiorna({ errore: spiega(e) })
    return null
  }
}

/**
 * Tiene aggiornato lo stato finché qualcuno lo guarda.
 *
 * Più schermate possono chiederlo insieme: si interroga Spotify una volta sola,
 * e solo con la pagina in primo piano — un tablet lasciato acceso di notte non
 * deve fare una richiesta ogni cinque secondi per ore.
 */
let osservatori = 0
let giro: number | undefined
let ferma = () => {}
export function osserva(): () => void {
  osservatori++
  if (osservatori === 1) {
    const tocca = () => {
      if (document.visibilityState === 'visible') void leggiLettore()
    }
    tocca()
    giro = window.setInterval(tocca, OGNI)
    document.addEventListener('visibilitychange', tocca)
    ferma = () => {
      window.clearInterval(giro)
      document.removeEventListener('visibilitychange', tocca)
    }
  }
  return () => {
    osservatori--
    if (osservatori === 0) ferma()
  }
}

/**
 * Esegue un comando e poi rilegge lo stato.
 *
 * Lo stato si aggiorna subito con quel che ci si aspetta, perché il tasto deve
 * cambiare sotto il dito; poi Spotify, che ci mette qualche decimo, conferma.
 */
async function comando(fai: () => Promise<unknown>, previsto?: Partial<Lettore>): Promise<boolean> {
  if (!stato.collegato) return false
  if (previsto && stato.lettore) aggiorna({ lettore: { ...stato.lettore, ...previsto } })
  try {
    await fai()
    window.setTimeout(() => void leggiLettore(), 600)
    return true
  } catch (e) {
    aggiorna({ errore: spiega(e) })
    void leggiLettore()
    return false
  }
}

export function suona() {
  return comando(async () => {
    try {
      await api('PUT', '/me/player/play')
    } catch (e) {
      if (!(e instanceof ErroreSpotify) || e.stato !== 404) throw e
      // Nessun dispositivo attivo, ma magari Spotify è aperto e fermo da un
      // po': lo si risveglia passandogli la riproduzione.
      const r = (await api('GET', '/me/player/devices')) as { devices?: Array<{ id: string | null }> } | null
      const primo = r?.devices?.find((d) => d.id)
      if (!primo?.id) throw e
      await api('PUT', '/me/player', { device_ids: [primo.id], play: true })
    }
  }, { inRiproduzione: true })
}

export const pausa = () => comando(() => api('PUT', '/me/player/pause'), { inRiproduzione: false })
export const avanti = () => comando(() => api('POST', '/me/player/next'))
export const indietro = () => comando(() => api('POST', '/me/player/previous'))

export function volume(percento: number) {
  const v = Math.round(Math.min(100, Math.max(0, percento)))
  return comando(() => api('PUT', `/me/player/volume?volume_percent=${v}`), { volume: v })
}

/* ---------- la musica che segue il timer ---------- */

/** Il volume da rimettere quando finisce il recupero, se l'abbiamo abbassato noi. */
let abbassata: number | null = null

/** Nel recupero la musica scende a `percento`, se era più alta. */
export async function abbassa(percento: number) {
  if (abbassata !== null) return
  const v = stato.lettore?.volume
  if (v == null || !stato.lettore?.inRiproduzione || v <= percento) return
  abbassata = v
  await volume(percento)
}

/** Finito il recupero, il volume torna quello di prima. */
export async function rialza() {
  if (abbassata === null) return
  const v = abbassata
  abbassata = null
  await volume(v)
}
