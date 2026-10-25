import { normalizzaNome } from './movimentiPersona'

/**
 * Chi può aver pagato un movimento non identificato (banca o Satispay), con le stesse regole del database
 * (`supabase/121-punteggio-movimenti.sql`, che le applica senza mostrare a chi amministra codici, genitori, date e
 * punteggi). Ogni persona attiva prende i punti dei suoi segnali, sommati:
 *  - nome e cognome interi nel testo, 4; un codice fiscale letto dalla causale (suo o del genitore), 4;
 *  - nome e cognome interi del genitore nel testo, 3; lo storico, 3: un altro movimento con le stesse parole (le cifre
 *    no) già collegato a lei;
 *  - iscritta a uno dei corsi che costano l'importo (`corsiConImporto`) col cognome nel testo, 2;
 *  - il nome di battesimo intero e una parola del nome di un corso a cui è iscritta (prima alla data, se no in
 *    qualunque momento), 2: da solo non arriva mai a «sicuro»;
 *  - il cognome suo o del genitore nel testo, 1. Da solo la propone se nessuno ha di più e il cognome è di una persona
 *    sola, o fra chi lo ha è lei l'iscritta il giorno del movimento (se nessuno, in qualunque momento); se no pesa solo
 *    contro il primo.
 * In ordine di punteggio, a pari prima chi non è iscritto il giorno del movimento. Il primo è «sicuro», e l'app lo
 * preseleziona, se ha almeno 4, almeno 2 più del secondo e non è già iscritto (l'iscrizione che l'ha fatta trovare è
 * a favore, non conta). I pesi vengono dalla misura sui movimenti già collegati.
 */

export type ComeAbbinato = 'nome intero' | 'genitore' | 'codice fiscale' | 'storico' | 'corso e cognome' | 'nome e corso' | 'cognome'

export interface Abbinato {
  id: string
  nome: string
  cognome: string
  /** Il segnale più forte. */
  come: ComeAbbinato
  giaIscritto: boolean
  /** Solo il primo, alto e staccato dal secondo: si preseleziona. */
  sicuro: boolean
}

export interface EsitoAbbinamento {
  candidati: Abbinato[]
  /** Solo il primo «sicuro»: negli altri casi sceglie chi amministra. */
  preselezionato: string | null
}

/** Una persona come la vede la modalità prova (ha tutto); il database ne rende solo `Abbinato`. */
export interface PersonaDaAbbinare {
  id: string
  nome: string
  cognome: string
  attiva: boolean
  codiceFiscale: string | null
  genitoreNome: string | null
  genitoreCognome: string | null
  genitoreCodiceFiscale: string | null
  iscrizioni: Array<{ dal: string; al: string | null; corsoId?: string; corso?: string }>
}

const MASSIMO_ABBINATI = 8

/** I corsi del listino che costano l'importo del movimento, in `centesimi` (saldo, annuale o trimestre, di qualunque riga di prezzi). Senza `corsoId` non si sa quale. */
export function corsiConImporto(centesimi: number, voci: ReadonlyArray<{ corsoId?: string; prezzi: ReadonlyArray<{ saldo?: number; annuale?: number; trimestre?: number }> }>): string[] {
  if (!(centesimi > 0)) return []
  // il movimento è in centesimi, il listino in euro
  const importo = centesimi / 100
  const ids = voci.filter((v) => v.corsoId && v.prezzi.some((p) => [p.saldo, p.annuale, p.trimestre].includes(importo))).map((v) => v.corsoId as string) // as: filtrato sopra
  return [...new Set(ids)]
}

const parole = (s: string): string[] => normalizzaNome(s).split(/[^\p{L}0-9']+/u).filter(Boolean)

/** Tutte le parole di `nome` stanno nel testo, in qualunque ordine. Un nome vuoto non c'è mai. */
const nelTesto = (nome: string, nelle: Set<string>): boolean => {
  const p = parole(nome)
  return p.length > 0 && p.every((w) => nelle.has(w))
}

const ordine = (a: Abbinato, b: Abbinato) => `${a.cognome} ${a.nome}`.localeCompare(`${b.cognome} ${b.nome}`, 'it') || a.id.localeCompare(b.id)

/** Le righe del database, già in ordine: al massimo otto, preselezionato il primo se «sicuro». */
export function ordinaAbbinati(abbinati: Abbinato[]): EsitoAbbinamento {
  const candidati = abbinati.slice(0, MASSIMO_ABBINATI)
  return { candidati, preselezionato: candidati[0]?.sicuro && candidati[0].come !== 'nome e corso' ? candidati[0].id : null }
}

/** Le parole di un corso che dicono quale: almeno tre lettere, non solo cifre («Judo 2» → judo). */
const senzaApostrofi = (w: string): string => w.replace(/^'+|'+$/g, '')
const paroleCorso = (nome: string): string[] => parole(nome).map(senzaApostrofi).filter((w) => w.length >= 3 && !/^[0-9]+$/.test(w))

/** Le parole senza cifre (TRN, date, numeri di ricevuta cambiano da un bonifico all'altro dello stesso conto), in ordine. */
const firma = (testo: string): string => [...new Set(parole(testo).filter((w) => !/[0-9]/.test(w)))].sort().join(' ')

/** Nome e cognome interi, o quelli del genitore, nel testo: lo usa anche «Importa banca». Il genitore vale solo intero. */
export function nomeOGenitore(p: Pick<PersonaDaAbbinare, 'nome' | 'cognome' | 'genitoreNome' | 'genitoreCognome'>, testo: string): 'nome intero' | 'genitore' | null {
  const nelle = new Set(parole(testo))
  if (nelTesto(`${p.nome} ${p.cognome}`, nelle)) return 'nome intero'
  if (p.genitoreNome && p.genitoreCognome && nelTesto(`${p.genitoreNome} ${p.genitoreCognome}`, nelle)) return 'genitore'
  return null
}

export function abbinaMovimento(
  movimento: { testo: string; data: string; codiciFiscali: string[]; corsiImporto?: string[]; precedenti?: Array<{ testo: string; personaId: string }> },
  persone: PersonaDaAbbinare[],
): EsitoAbbinamento {
  const nelle = new Set(parole(movimento.testo))
  const iscritta = (i: { dal: string; al: string | null }) => i.dal <= movimento.data && (i.al === null || movimento.data <= i.al)
  const corsi = movimento.corsiImporto ?? []
  const f = firma(movimento.testo)
  const storici = new Set(f ? (movimento.precedenti ?? []).filter((x) => firma(x.testo) === f).map((x) => x.personaId) : [])
  const attive = persone.filter((p) => p.attiva)
  // Prima chi lo soddisfa il giorno del movimento; se nessuno, in qualunque momento (le iscrizioni vecchie non ci sono tutte).
  const ibrida = (trovate: PersonaDaAbbinare[], vale: (i: PersonaDaAbbinare['iscrizioni'][number]) => boolean) => {
    const allora = trovate.filter((p) => p.iscrizioni.some((i) => iscritta(i) && vale(i)))
    return new Set(allora.length ? allora : trovate.filter((p) => p.iscrizioni.some(vale)))
  }
  const conCognome = attive.filter((p) => nelTesto(p.cognome, nelle) || (!!p.genitoreCognome && nelTesto(p.genitoreCognome, nelle)))
  const cognomeUnico = conCognome.length === 1 ? conCognome[0] : null
  const cognomeIscritti = cognomeUnico ? new Set<PersonaDaAbbinare>() : ibrida(conCognome, () => true)
  const testoCorsi = new Set([...nelle].map(senzaApostrofi))
  const nomeCorso = ibrida(
    attive.filter((p) => nelTesto(p.nome, nelle)),
    (i) => paroleCorso(i.corso ?? '').some((w) => testoCorsi.has(w)),
  )
  const punti = attive.map((p) => {
    const n = nelTesto(`${p.nome} ${p.cognome}`, nelle)
    const g = !!p.genitoreNome && !!p.genitoreCognome && nelTesto(`${p.genitoreNome} ${p.genitoreCognome}`, nelle)
    const cf = movimento.codiciFiscali.some((c) => c === p.codiceFiscale || c === p.genitoreCodiceFiscale)
    const s = storici.has(p.id)
    const c = p.iscrizioni.some((i) => i.corsoId !== undefined && corsi.includes(i.corsoId) && iscritta(i))
    const k = conCognome.includes(p)
    const nc = nomeCorso.has(p)
    const v = 4 * +n + 4 * +cf + 3 * +g + 3 * +s + 2 * +(c && k) + 2 * +nc + +k
    const come: ComeAbbinato = n ? 'nome intero' : cf ? 'codice fiscale' : g ? 'genitore' : s ? 'storico' : c && k ? 'corso e cognome' : nc ? 'nome e corso' : 'cognome'
    // l'iscrizione che l'ha fatta trovare è a favore: il corso dell'importo, o (se è il segnale più forte) quella del nome e corso o del cognome
    const aFavore = c || come === 'nome e corso' || (come === 'cognome' && cognomeIscritti.has(p))
    const forte = n || g || cf || s || (c && k) || nc
    return { v, forte, elencato: forte || p === cognomeUnico || cognomeIscritti.has(p), a: { id: p.id, nome: p.nome, cognome: p.cognome, come, giaIscritto: !aFavore && p.iscrizioni.some(iscritta), sicuro: false } }
  }).filter((x) => x.v > 0)
  // il solo cognome si propone solo se nessuno ha di più: accanto a un nome intero sarebbero solo omonimi
  const soloForti = punti.some((x) => x.forte)
  const elencati = punti.filter((x) => (soloForti ? x.forte : x.elencato)).sort((x, y) => y.v - x.v || Number(x.a.giaIscritto) - Number(y.a.giaIscritto) || ordine(x.a, y.a))
  const primo = elencati[0]
  if (primo) {
    const secondo = Math.max(0, ...punti.filter((x) => x !== primo).map((x) => x.v))
    primo.a.sicuro = primo.v >= 4 && primo.v - secondo >= 2 && !primo.a.giaIscritto
  }
  return ordinaAbbinati(elencati.map((x) => x.a))
}

/** Il database non ha ancora la funzione (file SQL non lanciato): si ricade sul solo nome, senza errore. */
export function funzioneAssente(e: unknown): boolean {
  const codice = typeof e === 'object' && e !== null && 'code' in e ? e.code : null
  return codice === 'PGRST202' || codice === '42883'
}
