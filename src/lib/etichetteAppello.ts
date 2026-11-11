/**
 * Le parole di stato dell'appello e del calendario. Il segno davanti (… ✕ ✓)
 * dice lo stato anche a chi non distingue i colori: il colore da solo non basta.
 * Il `tono` sceglie il colore nel CSS; senza tono la parola non è uno stato.
 */
export type Tono = 'aspetta' | 'manca' | 'fatto'

export const NON_ANCORA_COMINCIATA = '… NON ANCORA COMINCIATA'

export function statoAppello(a: {
  soloLettura: boolean
  tuttiSegnati: boolean
  tuttiAssenti: boolean
  mancano: number
  proveMancano: number
  /** La lezione non è ancora cominciata: si può segnare, ma lo si dice. */
  futura: boolean
}): { testo: string; tono: Tono } {
  // Niente più «CHIUDI IN FONDO ↓»: la barra per chiudere è ferma in fondo, sempre in vista.
  if (a.soloLettura) return { testo: '… SOLO LETTURA', tono: 'aspetta' }
  if (a.tuttiAssenti) return { testo: '✕ TUTTI ASSENTI', tono: 'manca' }
  if (a.tuttiSegnati) return { testo: '✓ TUTTI SEGNATI', tono: 'fatto' }
  if (a.futura) return { testo: NON_ANCORA_COMINCIATA, tono: 'aspetta' }
  return { testo: a.mancano ? `… ${a.mancano} DA SEGNARE` : `… ${a.proveMancano} PROVA DA SEGNARE`, tono: 'aspetta' }
}

/** Vuota senza coda: la testa dell'appello non cambia altezza. «Da inviare» il cliente non lo capiva. */
export const codaAppello = (n: number): string => (n <= 0 ? '' : n === 1 ? '… 1 NON ANCORA INVIATA' : `… ${n} NON ANCORA INVIATE`)

/**
 * Il tasto giallo in testa ha sempre la stessa parola: un altro comparso al suo
 * posto prenderebbe il secondo tocco. La riga sotto dice chi tocca.
 */
export function tastoAppello(a: { nonSegnati: number; tuttiAssenti: boolean; tuttiSegnati: boolean }): { testo: string; sotto?: string; spento: boolean } {
  if (a.tuttiSegnati && !a.tuttiAssenti) return { testo: '✓ TUTTI SEGNATI', spento: true }
  // Tutti assenti è l'appello chiuso per sbaglio: il tasto li rimette tutti presenti, senza «i non segnati».
  if (a.tuttiAssenti) return { testo: 'TUTTI PRESENTI', spento: false }
  return { testo: 'TUTTI PRESENTI', sotto: a.nonSegnati === 1 ? 'chi non è segnato' : `i ${a.nonSegnati} non segnati`, spento: false }
}

/** La barra ferma in fondo: la frase dice cosa succede chiudendo, il giallo solo quando non si perde niente. */
export function chiudiAppello(a: { nonSegnati: number; chiede: boolean; tuttiAssenti?: boolean }): { frase: string; tasto: string; pieno: boolean } {
  const n = a.nonSegnati
  if (a.chiede)
    return {
      frase: 'Sicuro? Tocca di nuovo per chiudere.',
      tasto: n === 0 ? 'SÌ, CHIUDI L’APPELLO' : `SÌ, CHIUDI · ${n === 1 ? 'UN ASSENTE' : `${n} ASSENTI`}`,
      pieno: false,
    }
  // Tutti assenti è di solito l'appello chiuso per sbaglio: il giallo resta sul TUTTI PRESENTI in testa, CHIUDI non spinge.
  if (a.tuttiAssenti) return { frase: 'Sono tutti assenti: chiudi solo se è giusto.', tasto: 'CHIUDI L’APPELLO', pieno: false }
  if (n === 0) return { frase: 'Tutti segnati: chiudi e torna al calendario.', tasto: '✓ CHIUDI L’APPELLO', pieno: true }
  return { frase: n === 1 ? 'Chi non è segnato diventerà assente.' : `${n} non segnati diventeranno assenti.`, tasto: 'CHIUDI L’APPELLO', pieno: false }
}

/** Chiudere vuole il secondo tocco quando è probabilmente uno sbaglio: nessuno segnato, lezione futura, più di metà assenti. */
export function chiedeDiChiudere(a: { segnati: number; tuttiSegnati: boolean; futura: boolean; mancano: number; iscritti: number }): boolean {
  return (a.segnati === 0 && !a.tuttiSegnati) || a.futura || a.mancano * 2 > a.iscritti
}

/** La frase «Un tocco sul nome…» serve a chi comincia: dopo tre appelli è rumore sopra la lista. */
export const mostraAiuto = (volte: number): boolean => volte < 3

export function statoLezione(l: { manca: boolean; iniziato: boolean; fatto: boolean; presentiIscritti: number }): { testo: string; tono?: Tono } {
  if (l.manca) return { testo: '✕ DA CHIUDERE', tono: 'manca' }
  if (!l.iniziato) return { testo: 'ISCRITTI' }
  if (l.fatto) return l.presentiIscritti > 0 ? { testo: '✓ FATTO', tono: 'fatto' } : { testo: '… NESSUN PRESENTE', tono: 'aspetta' }
  return { testo: '… IN CORSO', tono: 'aspetta' }
}

export const proveInPiu = (n: number): string => `+${n} PROVA`

/**
 * I conti dell'appello da cui partono le parole e il secondo tocco per chiudere.
 * Chi prova conta nei segnati e nei non segnati (chiudendo diventa assente anche
 * lui), non in «tutti assenti» né nella metà che fa chiedere il secondo tocco.
 */
export function quadroAppello(a: { elenco: { stato: string | null; prova?: boolean }[]; inizio: string; adesso: number }) {
  const iscritti = a.elenco.filter((p) => !p.prova)
  const segnati = a.elenco.filter((p) => p.stato !== null).length
  const tuttiSegnati = segnati === a.elenco.length
  const mancano = iscritti.filter((p) => p.stato === null).length
  const futura = new Date(a.inizio).getTime() > a.adesso
  return {
    segnati,
    nonSegnati: a.elenco.length - segnati,
    tuttiSegnati,
    tuttiAssenti: iscritti.length > 0 && iscritti.every((p) => p.stato === 'assente'),
    mancano,
    proveMancano: a.elenco.filter((p) => p.prova && p.stato === null).length,
    futura,
    chiede: chiedeDiChiudere({ segnati, tuttiSegnati, futura, mancano, iscritti: iscritti.length }),
  }
}

/**
 * Conta un'apertura dell'appello e dice se mostrare l'aiuto. La memoria arriva
 * da fuori per provarla senza browser; se non c'è (navigazione privata) l'aiuto
 * si mostra sempre.
 */
export function aiutoAppello(memoria: Pick<Storage, 'getItem' | 'setItem'>): boolean {
  try {
    const volte = Number(memoria.getItem('ods-appello-aiuto') ?? 0) || 0
    memoria.setItem('ods-appello-aiuto', String(volte + 1))
    return mostraAiuto(volte)
  } catch {
    return true
  }
}

export const fraseAzzera = (chiede: boolean): string => (chiede ? 'Tocca di nuovo: tutti tornano da segnare.' : 'Toglie tutti i segni. Chiede un secondo tocco.')

/** Sotto la ricerca: quanti ne restano, o cosa fare se non ne resta nessuno. */
export function contoRicerca(a: { iscrittiTrovati: number; iscritti: number; proveTrovate: number }): string {
  if (a.iscrittiTrovati + a.proveTrovate === 0) return 'Nessuno si chiama così: controlla come è scritto.'
  return `${a.iscrittiTrovati} su ${a.iscritti} iscritti${a.proveTrovate ? ` · ${a.proveTrovate} in prova` : ''}`
}
