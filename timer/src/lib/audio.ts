/**
 * Segnali acustici sintetizzati al volo: nessun file audio da scaricare, quindi
 * funzionano anche al primo avvio offline.
 */
/**
 * La nota dello scadere: frequenza, durata, volume, forma d'onda, tenuta.
 *
 * Quasi due secondi, e tenuti: chi è sotto sforzo non conta i millisecondi,
 * riconosce che è finito perché il suono <em>non smette</em>. Un colpo secco
 * si confonde con un bip del conto; questo no. Stava in due copie — una per
 * il suono immediato, una per quello messo in coda — ed erano già diverse
 * fra loro: da qui in avanti è una sola.
 */
const SCADENZA = [1175, 1800, 0.9, 'square', true] as const

export class Cues {
  private ctx: AudioContext | null = null
  /** Il fruscìo che tiene sveglio l'altoparlante bluetooth. Vedi `tieniSveglio`. */
  private sveglia: AudioBufferSourceNode | null = null
  private vuoleSveglia = false
  private inAscolto = false
  /** I suoni consegnati all'orologio audio, con l'istante in cui partono. */
  private programmati: Array<{ nodo: OscillatorNode; quando: number }> = []
  volume = 0.8

  /** I browser creano il contesto audio sospeso finché non c'è un gesto dell'utente. */
  unlock() {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return
      try {
        this.ctx = new Ctor()
      } catch {
        return
      }
      this.ascolta()
    }
    void this.risveglia()
  }

  /**
   * Il contesto audio non resta sveglio da solo.
   *
   * Quando cambia l'uscita — si collega un altoparlante bluetooth, si infila
   * un paio di cuffie, arriva una telefonata — il sistema lo **interrompe**, e
   * da quel momento resta sospeso finché qualcuno non lo risveglia. Nessuno lo
   * faceva: si sbloccava una volta all'avvio del timer e mai più, quindi
   * collegare la cassa a lezione iniziata ammutoliva l'app per il resto
   * dell'allenamento. Questi tre eventi sono i momenti in cui può essere
   * successo, e a ognuno si riprova.
   */
  private ascolta() {
    if (this.inAscolto || !this.ctx) return
    this.inAscolto = true
    // Solo a pagina visibile: in secondo piano è il browser che lo sospende
    // apposta, e insistere sarebbe una gara persa e batteria buttata.
    this.ctx.addEventListener('statechange', () => {
      if (!document.hidden && this.ctx && this.ctx.state !== 'running') void this.risveglia()
    })
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) void this.risveglia()
    })
    try {
      navigator.mediaDevices?.addEventListener?.('devicechange', () => void this.risveglia())
    } catch {
      // Niente `mediaDevices`: restano gli altri due.
    }
  }

  /** Riporta il contesto in marcia. Vero se ci è riuscita. */
  private async risveglia(): Promise<boolean> {
    const c = this.ctx
    if (!c) return false
    if (c.state !== 'running') {
      try {
        await c.resume()
      } catch {
        return false
      }
    }
    if (c.state !== 'running') return false
    if (this.vuoleSveglia && !this.sveglia) this.accendiSveglia()
    return true
  }

  /**
   * Tiene aperta la connessione bluetooth finché il timer gira.
   *
   * Un altoparlante bluetooth che non riceve niente va in standby dopo pochi
   * secondi, e al suono successivo si risveglia mangiandosene l'inizio. I bip
   * qui durano 140 millisecondi: se lo mangia tutto, e in sala non si sente
   * niente. Mandargli un fruscìo a un decimillesimo di ampiezza — inudibile su
   * qualunque cassa — lo tiene sveglio e fa arrivare i bip interi.
   *
   * Solo mentre il timer gira: a riposo l'app non deve tenersi la cassa
   * occupata.
   */
  tieniSveglio(acceso: boolean) {
    this.vuoleSveglia = acceso
    sessioneAudio(acceso)
    if (!acceso) {
      this.spegniSveglia()
      return
    }
    if (!this.ctx) return
    void this.risveglia()
  }

  private accendiSveglia() {
    const c = this.ctx
    if (!c || this.sveglia || c.state !== 'running') return
    try {
      const buffer = c.createBuffer(1, c.sampleRate, c.sampleRate)
      const dati = buffer.getChannelData(0)
      for (let i = 0; i < dati.length; i++) dati[i] = (Math.random() * 2 - 1) * 1e-4
      const src = c.createBufferSource()
      src.buffer = buffer
      src.loop = true
      src.connect(c.destination)
      src.start()
      this.sveglia = src
    } catch {
      // Se non parte, si perde solo il primo bip dopo uno standby.
    }
  }

  private spegniSveglia() {
    const s = this.sveglia
    this.sveglia = null
    if (!s) return
    try {
      s.stop()
      s.disconnect()
    } catch {
      // Già ferma.
    }
  }

  private tone(freq: number, ms: number, gain: number, type: OscillatorType = 'sine', tenuta = false) {
    const c = this.ctx
    if (!c) return
    if (c.state === 'running') {
      this.emetti(freq, ms, gain, type, 0, tenuta)
      return
    }
    // Un bip in ritardo di un attimo è comunque meglio del silenzio: si
    // risveglia il contesto e lo si suona appena torna, invece di buttarlo.
    void this.risveglia().then((ok) => {
      if (ok) this.emetti(freq, ms, gain, type, 0, tenuta)
    })
  }

  /**
   * Un suono fissato a un istante futuro dell'orologio audio.
   *
   * È la differenza fra un bip che arriva e uno che sparisce. Suonare «adesso»
   * vuol dire dipendere dal fatto che il thread JavaScript giri in quel
   * preciso momento — e in secondo piano, o a telefono bloccato, non gira:
   * misurato, cinque secondi di thread fermo costavano cinque bip su cinque.
   * Consegnato invece all'orologio audio, il suono è già in coda sul thread
   * dell'audio e parte puntuale anche se il resto dell'app è fermo.
   */
  private programma(fra: number, freq: number, ms: number, gain: number, type: OscillatorType, tenuta = false) {
    const c = this.ctx
    if (!c) return
    if (c.state !== 'running') {
      void this.risveglia().then((ok) => ok && this.emetti(freq, ms, gain, type, fra, tenuta))
      return
    }
    this.emetti(freq, ms, gain, type, fra, tenuta)
  }

  /**
   * Il bip del conto alla rovescia, fra `fra` secondi.
   *
   * Più forte e più lungo di com'era: in sala non si sentiva. Centoquaranta
   * millisecondi a metà volume sono un tic da scrivania, non un segnale che
   * deve arrivare in fondo a una palestra sopra la musica.
   *
   * `ultimo` è il bip a un secondo dallo scadere: dura il doppio, così la
   * sequenza ha una fine riconoscibile e non cinque colpi tutti uguali.
   */
  programmaBip(fra: number, ultimo = false) {
    if (ultimo) this.programma(fra, 880, 440, 0.8, 'square')
    else this.programma(fra, 880, 220, 0.75, 'square')
  }

  /** Il suono del segmento che comincia, fra `fra` secondi. */
  programmaCambio(fra: number, lavoro: boolean) {
    if (lavoro) this.programma(fra, 1320, 520, 0.85, 'square')
    else this.programma(fra, 600, 420, 0.7, 'sine')
  }

  /** La nota lunga dello scadere, fra `fra` secondi. */
  programmaScadenza(fra: number) {
    this.programma(fra, SCADENZA[0], SCADENZA[1], SCADENZA[2], SCADENZA[3], SCADENZA[4])
  }

  /** Le tre note di fine allenamento, fra `fra` secondi. */
  programmaFine(fra: number) {
    this.programma(fra, 660, 220, 0.5, 'sine')
    this.programma(fra + 0.2, 880, 220, 0.5, 'sine')
    this.programma(fra + 0.4, 1320, 520, 0.55, 'sine')
  }

  /**
   * Butta via ciò che è in coda e **non è ancora partito**. Serve a ogni
   * pausa, salto o «+30″»: da lì in poi il programma non è più quello.
   *
   * Un suono già cominciato si lascia finire. Fermarlo lo taglia a metà: allo
   * scadere del conto alla rovescia la nota lunga partiva e veniva troncata
   * dopo un'ottantina di millisecondi dal riassetto che segue lo zero, e
   * invece di una nota si sentiva un colpo.
   */
  annullaProgrammati() {
    const ora = this.ctx?.currentTime ?? 0
    const restano: Array<{ nodo: OscillatorNode; quando: number }> = []
    for (const p of this.programmati) {
      /* Un quarto di secondo di grazia e non un millesimo: l'orologio audio e
         quello della pagina non sono allineati al millisecondo, e allo scadere
         la nota risultava «qualche millesimo nel futuro» e veniva annullata
         proprio mentre stava per partire. Ciò che sta per suonare conta come
         già partito. */
      if (p.quando <= ora + 0.25) {
        restano.push(p)
        continue
      }
      try {
        p.nodo.stop()
      } catch {
        // Già fermato.
      }
    }
    this.programmati = restano
  }

  private emetti(freq: number, ms: number, gain: number, type: OscillatorType, fra = 0, tenuta = false) {
    const c = this.ctx
    if (!c || c.state !== 'running') return
    const now = c.currentTime + Math.max(0, fra)
    const dur = ms / 1000
    const picco = gain * this.volume
    const osc = c.createOscillator()
    const amp = c.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, now)
    // Attacco e rilascio morbidi: un gain a gradino produce un click udibile.
    amp.gain.setValueAtTime(0, now)
    amp.gain.linearRampToValueAtTime(picco, now + 0.012)
    // Senza tenuta la nota scende per tutta la sua durata: per un bip corto va
    // bene, ma su una nota lunga vuol dire che la metà finale è già quasi
    // silenzio, e da lontano dura meno di quanto è scritto. Con la tenuta il
    // livello resta pieno fin quasi alla fine e solo l'ultimo pezzo sfuma.
    if (tenuta && dur > 0.35) amp.gain.setValueAtTime(picco, now + dur - 0.2)
    amp.gain.exponentialRampToValueAtTime(0.0001, now + dur)
    osc.connect(amp).connect(c.destination)
    osc.start(now)
    osc.stop(now + dur + 0.02)
    if (fra > 0.02) {
      const voce = { nodo: osc, quando: now }
      this.programmati.push(voce)
      osc.onended = () => {
        this.programmati = this.programmati.filter((x) => x !== voce)
      }
    }
  }

  /**
   * Il ticchettio dell'orologio: un secondo, un tic.
   *
   * Non è un bip corto — un'onda pura di venti millisecondi resta un bip, e a
   * sessanta al minuto diventa insopportabile. Un tic vero è uno schiocco: una
   * manciata di millisecondi di rumore, tagliato stretto attorno a una
   * frequenza. E come in un orologio vero i due mezzi secondi non suonano
   * uguali — tic più alto, tac più basso — che è ciò che lo fa sentire come un
   * ritmo invece che come un allarme che si ripete.
   */
  tick(basso = false) {
    const c = this.ctx
    if (!c) return
    if (c.state !== 'running') {
      void this.risveglia().then((ok) => ok && this.schiocco(basso))
      return
    }
    this.schiocco(basso)
  }

  private schiocco(basso: boolean) {
    const c = this.ctx
    if (!c || c.state !== 'running') return
    try {
      const durata = 0.035
      const campioni = Math.max(1, Math.floor(c.sampleRate * durata))
      const buffer = c.createBuffer(1, campioni, c.sampleRate)
      const dati = buffer.getChannelData(0)
      for (let i = 0; i < campioni; i++) {
        // Decadimento molto rapido: è quello che distingue uno schiocco da un suono.
        dati[i] = (Math.random() * 2 - 1) * Math.exp((-i / campioni) * 9)
      }
      const src = c.createBufferSource()
      src.buffer = buffer
      const filtro = c.createBiquadFilter()
      filtro.type = 'bandpass'
      filtro.frequency.value = basso ? 1500 : 2300
      filtro.Q.value = 6
      const amp = c.createGain()
      // Molto sotto i bip: il ticchettio accompagna, non annuncia.
      amp.gain.value = 0.22 * this.volume
      src.connect(filtro).connect(amp).connect(c.destination)
      src.start()
    } catch {
      // Un tic perso non è un problema: il prossimo arriva fra un secondo.
    }
  }

  /** Uno dei bip che precedono un cambio di stato. */
  countdown() {
    this.tone(880, 220, 0.75, 'square')
  }

  /** Inizio di un intervallo di lavoro: acuto e deciso. */
  work() {
    this.tone(1320, 520, 0.85, 'square')
  }

  /** Inizio di un recupero: più basso e corto. */
  rest() {
    this.tone(600, 420, 0.7, 'sine')
  }

  /**
   * Il tempo è scaduto: una nota sola, molto lunga, più acuta dei bip.
   *
   * È la seconda metà della partenza di una gara — dei corti, poi uno lungo e
   * diverso — e la differenza sta lì: i bip dicono «ci siamo», questo dice
   * «adesso». Una fanfara di tre note, che è quel che c'era prima, dice invece
   * «bravi»: giusta a fine allenamento, sbagliata per un conto che scade e a
   * cui di solito segue subito altro lavoro.
   */
  scadenza() {
    this.tone(...SCADENZA)
  }

  /** Fine allenamento: tre note in salita. */
  finish() {
    this.tone(660, 220, 0.5)
    window.setTimeout(() => this.tone(880, 220, 0.5), 200)
    window.setTimeout(() => this.tone(1320, 520, 0.55), 400)
  }
}

/**
 * La musica della sala, mentre il timer gira.
 *
 * Nessuna pagina web può comandare il lettore musicale di qualcun altro: non
 * esiste un'interfaccia per mettere in pausa Spotify, e non è una svista di
 * questa app. Quello che si può dichiarare è **che tipo di audio** siamo, e da
 * lì il sistema decide come mescolarci alla musica già in corso.
 *
 * `transient` vuol dire «suoni brevi che devono passare sopra»: il sistema
 * abbassa la musica per la durata del bip e la rialza subito dopo, che è
 * esattamente quello che serve a un timer da palestra — prima i bip si
 * mescolavano alla musica e sotto cassa non si sentivano. Finito l'allenamento
 * si torna ad `auto` e la musica si riprende tutto il volume.
 *
 * Oggi la conosce Safari su iPhone e iPad. Dove non c'è, questa funzione non
 * fa niente e non rompe niente: è un miglioramento dove c'è, non un requisito.
 */
function sessioneAudio(inCorso: boolean) {
  try {
    const s = (navigator as unknown as { audioSession?: { type: string } }).audioSession
    if (s) s.type = inCorso ? 'transient' : 'auto'
  } catch {
    // Non supportata, o valore rifiutato: la musica resta com'era.
  }
}

let voices: SpeechSynthesisVoice[] = []
const loadVoices = () => {
  if ('speechSynthesis' in window) voices = window.speechSynthesis.getVoices()
}
if ('speechSynthesis' in window) {
  loadVoices()
  window.speechSynthesis.addEventListener('voiceschanged', loadVoices)
}

/**
 * Quasi tutti i sistemi espongono più voci italiane, e la prima dell'elenco è
 * di norma la più metallica. Questo punteggio preferisce le versioni
 * «enhanced»/«premium» e quelle servite dalla rete, che suonano molto più
 * naturali di quelle compatte installate di serie.
 */
function rank(v: SpeechSynthesisVoice): number {
  const n = v.name.toLowerCase()
  let score = 0
  if (/(enhanced|premium|neural|natural|siri)/.test(n)) score += 6
  if (/(alice|federica|luca|emma|elsa|carla)/.test(n)) score += 3
  if (v.localService === false) score += 2
  if (n.includes('google')) score += 2
  if (/(compact|compatta|eloquence)/.test(n)) score -= 4
  if (v.default) score += 1
  return score
}

/** Le voci italiane disponibili, dalla più naturale alla più sintetica. */
export function italianVoices(): SpeechSynthesisVoice[] {
  return voices.filter((v) => v.lang?.toLowerCase().startsWith('it')).sort((a, b) => rank(b) - rank(a))
}

function pickVoice(voiceURI: string | null): SpeechSynthesisVoice | undefined {
  const list = italianVoices()
  if (voiceURI) {
    const chosen = list.find((v) => v.voiceURI === voiceURI)
    if (chosen) return chosen
  }
  return list[0]
}

let ultima = { testo: '', quando: -1e9 }

export function speak(text: string, volume: number, voiceURI: string | null = null) {
  if (!('speechSynthesis' in window) || !text) return
  const ora = performance.now()
  // Una stessa frase ripetuta a un attimo di distanza non è mai voluta: è il
  // doppione che alcuni browser producono da soli. Si scarta.
  if (text === ultima.testo && ora - ultima.quando < 900) return
  ultima = { testo: text, quando: ora }
  try {
    const sintesi = window.speechSynthesis
    // Una coda di annunci arretrati è peggio del silenzio: l'ultimo vince. Ma
    // cancel() va chiamato solo se c'è davvero qualcosa da fermare: a vuoto,
    // seguito subito da speak(), su Safari e su alcune build Android fa
    // pronunciare la frase due volte.
    if (sintesi.speaking || sintesi.pending) sintesi.cancel()
    const u = new SpeechSynthesisUtterance(text)
    const v = pickVoice(voiceURI)
    if (v) u.voice = v
    u.lang = v?.lang ?? 'it-IT'
    // Ritmo naturale: sopra 1.05 il parlato inizia a suonare meccanico.
    u.rate = 1
    u.pitch = 1
    u.volume = volume
    sintesi.speak(u)
  } catch {
    // Sintesi vocale non disponibile: i bip restano.
  }
}

export function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // Niente vibrazione su desktop.
  }
}
