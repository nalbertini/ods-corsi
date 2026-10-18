/**
 * L'orario delle pagine del sito dalle ricorrenze di CORSI (`orari_aperti()`, supabase/48-orari-aperti.sql):
 * giorno, ora e durata, mai sala, istruttore o posti. Lo usano il generatore del sito e il pannello SITO, così
 * l'anteprima dice quello che dirà il sito. Giorno 0 = domenica, come `getDay()`; le righe vanno da lunedì a domenica.
 * Le regole si provano in `scripts/prova-sito-orario.mjs`.
 */

export interface OrarioAperto {
  corsoId: string
  /** 0 = domenica, 1 = lunedì … 6 = sabato. */
  giorno: number
  /** `HH:MM`, o `HH:MM:SS` come lo dà il database. */
  ora: string
  durataMin: number
}

/** Una riga d'orario: i giorni (lunedì … domenica) in cui il corso comincia alla stessa ora e dura lo stesso. */
export interface RigaOrario {
  giorni: number[]
  /** Sempre `HH:MM`. */
  ora: string
  durataMin: number
}

/** Quello che il sito dice quando i corsi collegati non hanno nessun orario: mai gli orari di prima. */
export const IN_ARRIVO = 'Orario in arrivo'

/** Quello che dice il pannello quando il database non ha `67-sito-orario.sql` (il file sta in LEGGIMI, non qui: chi usa l'app non lo lancia). */
export const ORARIO_NON_ATTIVO = 'Qui l’orario dai corsi non è ancora attivo. Per ora l’orario resta quello scritto a mano.'

const GIORNI = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']
/** Il posto del giorno nella settimana che comincia di lunedì: la domenica (0) è l'ultima. */
const posto = (g: number) => (g + 6) % 7

const oraBreve = (ora: string) => ora.slice(0, 5)

/** Le righe d'orario di tutte le ricorrenze date: raggruppate per ora e durata, senza doppioni, da lunedì a domenica. */
export function righeOrario(orari: OrarioAperto[]): RigaOrario[] {
  const gruppi = new Map<string, RigaOrario>()
  for (const o of orari) {
    const ora = oraBreve(o.ora)
    const chiave = `${ora}|${o.durataMin}`
    const riga = gruppi.get(chiave) ?? { giorni: [], ora, durataMin: o.durataMin }
    if (!riga.giorni.includes(o.giorno)) riga.giorni.push(o.giorno)
    gruppi.set(chiave, riga)
  }
  return [...gruppi.values()]
    .map((r) => ({ ...r, giorni: [...r.giorni].sort((a, b) => posto(a) - posto(b)) }))
    .sort((a, b) => posto(a.giorni[0]) - posto(b.giorni[0]) || a.ora.localeCompare(b.ora))
}

/** Le righe dei soli corsi dati. */
export const orarioDeiCorsi = (corsi: string[], orari: OrarioAperto[]): RigaOrario[] => righeOrario(orari.filter((o) => corsi.includes(o.corsoId)))

const fine = (ora: string, durataMin: number) => {
  const minuti = (Number(ora.slice(0, 2)) * 60 + Number(ora.slice(3, 5)) + durataMin) % 1440
  return `${String(Math.floor(minuti / 60)).padStart(2, '0')}:${String(minuti % 60).padStart(2, '0')}`
}

/** «Lunedì, mercoledì e venerdì · 17:00–18:00». */
export function testoRiga(riga: RigaOrario): string {
  const nomi = riga.giorni.map((g, i) => (i === 0 ? GIORNI[g] : GIORNI[g].toLowerCase()))
  const giorni = nomi.length > 1 ? `${nomi.slice(0, -1).join(', ')} e ${nomi[nomi.length - 1]}` : nomi[0]
  return `${giorni} · ${riga.ora}–${fine(riga.ora, riga.durataMin)}`
}

/** Le righe scritte che il sito mostra per questi corsi, oppure «Orario in arrivo». */
export function testiOrario(corsi: string[], orari: OrarioAperto[]): string[] {
  const righe = orarioDeiCorsi(corsi, orari)
  return righe.length ? righe.map(testoRiga) : [IN_ARRIVO]
}

/** I corsi collegati che non hanno nessun orario, nell'ordine in cui sono collegati e una volta sola: la segreteria li deve sistemare in CORSI. */
export function corsiSenzaOrari(corsi: string[], orari: OrarioAperto[]): string[] {
  const conOrari = new Set(orari.map((o) => o.corsoId))
  return [...new Set(corsi)].filter((c) => !conOrari.has(c))
}

/** Vero se il database ha `67-sito-orario.sql`: la colonna c'è, anche vuota, in almeno una pagina. */
export const databaseConCorsi = (pagine: Array<{ corsiCollegati?: string[] }>): boolean => pagine.some((p) => p.corsiCollegati !== undefined)

/**
 * Le ricorrenze dei corsi attivi come `orari_aperti()` le dà al sito: il pannello SITO le legge dai corsi che ha già in mano.
 * Quelle con la fine passata (`al` prima di `oggi`, `AAAA-MM-GG`) non ci sono, come sul sito.
 */
export const orariDaiCorsi = (
  corsi: Array<{ id: string; attivo: boolean; ricorrenze: Array<{ giorno: number; ora: string; durata: number; al?: string }> }>,
  oggi: string,
): OrarioAperto[] =>
  corsi.filter((c) => c.attivo).flatMap((c) => c.ricorrenze.filter((r) => !r.al || r.al >= oggi).map((r) => ({ corsoId: c.id, giorno: r.giorno, ora: r.ora, durataMin: r.durata })))

/**
 * L'avviso del pannello per i corsi collegati senza orari (`vuoti`, fra i `collegati`), o `null` se non serve.
 * Titolo «Orario in arrivo» solo se la pagina resta senza orari; se ne mancano solo alcuni, il sito mostra gli altri.
 * Fra i `vuoti`, gli `archiviati` non si sistemano aggiungendo un giorno: si ripristinano o si scollegano.
 */
export function avvisoSenzaOrari(vuoti: string[], collegati: string[], nome: (id: string) => string = (id) => id, archiviati: string[] = []): { titolo: string; frase: string } | null {
  if (vuoti.length === 0) return null
  const elenco = (ids: string[]) => {
    const nomi = ids.map((id) => `«${nome(id)}»`)
    return nomi.length > 1 ? `${nomi.slice(0, -1).join(', ')} e ${nomi[nomi.length - 1]}` : nomi[0]
  }
  const archiviato = vuoti.filter((id) => archiviati.includes(id))
  const senzaGiorni = vuoti.filter((id) => !archiviati.includes(id))
  const tutti = vuoti.length === new Set(collegati).size
  const frasi: string[] = []
  if (senzaGiorni.length) {
    const chi = senzaGiorni.length === 1 ? `Il corso ${elenco(senzaGiorni)} non ha giorni in CORSI` : `I corsi ${elenco(senzaGiorni)} non hanno giorni in CORSI`
    frasi.push(`${chi}, oppure tutte le ${senzaGiorni.length === 1 ? 'sue' : 'loro'} ricorrenze hanno la data di fine passata.`)
  }
  if (archiviato.length) {
    frasi.push(`${archiviato.length === 1 ? `Il corso ${elenco(archiviato)} è archiviato` : `I corsi ${elenco(archiviato)} sono archiviati`}: ripristin${archiviato.length === 1 ? 'alo' : 'ali'} in CORSI (in fondo all’elenco, «corsi archiviati») oppure scolleg${archiviato.length === 1 ? 'alo' : 'ali'} da qui.`)
  }
  if (!tutti) frasi.push('Gli orari degli altri corsi collegati restano sul sito.')
  else if (!archiviato.length) frasi.push('Finché non ne aggiungi una, la pagina non ha orari.')
  const titolo = tutti ? `Il sito mostrerà «${IN_ARRIVO}»` : `Il sito non mostra orari per ${vuoti.length} ${vuoti.length === 1 ? 'corso' : 'corsi'}`
  return { titolo, frase: frasi.join(' ') }
}
