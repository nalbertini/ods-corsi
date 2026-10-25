import { normalizzaNome } from './movimentiPersona'

/**
 * Chi può aver pagato un movimento non identificato (banca o Satispay), con le stesse regole del database
 * (`supabase/120-abbina-cognome-nome-corso.sql`, che le applica senza mostrare a chi amministra codici, genitori e date):
 *  1. nome e cognome interi nel testo;
 *  2. se nessuno, nome e cognome del genitore nel testo: i suoi figli;
 *  3. se nessuno, un codice fiscale letto dalla causale: del genitore, o dell'adulto che paga per sé;
 *  4. se nessuno, l'importo: i corsi che costano quella cifra (`corsiConImporto`) e, fra i loro iscritti, chi ha nel testo
 *     il cognome suo o del genitore. Qui l'iscrizione è il segno a favore, non contro: «già iscritto» resta falso.
 *  5. se nessuno, il cognome suo o del genitore: se è di una persona sola, lei; se no chi di loro è iscritto il giorno del
 *     movimento, o (se nessuno) chi ha un'iscrizione in qualunque momento, con «già iscritto» falso come nella 4;
 *  6. se nessuno, il nome di battesimo e una parola del nome di un corso a cui è iscritto (prima alla data, se no in
 *     qualunque momento). Sui movimenti già collegati del database ha indovinato 4 volte su 6: si propone, ma non si preseleziona mai.
 * Chi è già iscritto il giorno del movimento si propone lo stesso (può pagare un altro corso) ma in fondo e col segno.
 */

export type ComeAbbinato = 'nome intero' | 'genitore' | 'codice fiscale' | 'corso e cognome' | 'cognome' | 'nome e corso'

export interface Abbinato {
  id: string
  nome: string
  cognome: string
  come: ComeAbbinato
  giaIscritto: boolean
}

export interface EsitoAbbinamento {
  candidati: Abbinato[]
  /** Solo con un candidato solo, non iscritto, non per «nome e corso»: negli altri casi sceglie chi amministra. */
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

/** I corsi del listino che costano `importo` (saldo, annuale o trimestre, di qualunque riga di prezzi). Senza `corsoId` non si sa quale. */
export function corsiConImporto(importo: number, voci: ReadonlyArray<{ corsoId?: string; prezzi: ReadonlyArray<{ saldo?: number; annuale?: number; trimestre?: number }> }>): string[] {
  if (!(importo > 0)) return []
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

/** Le parole di un corso che dicono quale: almeno tre lettere, non solo cifre («Judo 2» → judo). */
const senzaApostrofi = (w: string): string => w.replace(/^'+|'+$/g, '')
const paroleCorso = (nome: string): string[] => parole(nome).map(senzaApostrofi).filter((w) => w.length >= 3 && !/^[0-9]+$/.test(w))

/** Non iscritti prima (cognome e nome), iscritti in fondo; al massimo otto; preselezionato solo se uno, non iscritto, non per «nome e corso». */
export function ordinaAbbinati(abbinati: Abbinato[]): EsitoAbbinamento {
  const candidati = [...abbinati].sort((a, b) => Number(a.giaIscritto) - Number(b.giaIscritto) || ordine(a, b)).slice(0, MASSIMO_ABBINATI)
  const solo = abbinati.length === 1 ? abbinati[0] : null
  return { candidati, preselezionato: solo && !solo.giaIscritto && solo.come !== 'nome e corso' ? solo.id : null }
}

export function abbinaMovimento(movimento: { testo: string; data: string; codiciFiscali: string[]; corsiImporto?: string[] }, persone: PersonaDaAbbinare[]): EsitoAbbinamento {
  const nelle = new Set(parole(movimento.testo))
  const attive = persone.filter((p) => p.attiva)
  const allaData = (i: { dal: string; al: string | null }) => i.dal <= movimento.data && (i.al === null || movimento.data <= i.al)
  const come = (trovate: PersonaDaAbbinare[], c: ComeAbbinato, giaIscritto = (p: PersonaDaAbbinare) => p.iscrizioni.some(allaData)): Abbinato[] =>
    trovate.map((p) => ({ id: p.id, nome: p.nome, cognome: p.cognome, come: c, giaIscritto: giaIscritto(p) }))
  // Prima chi lo soddisfa il giorno del movimento; se nessuno, in qualunque momento (le iscrizioni vecchie non ci sono tutte).
  const ibrida = (trovate: PersonaDaAbbinare[], vale: (i: PersonaDaAbbinare['iscrizioni'][number]) => boolean) => {
    const allora = trovate.filter((p) => p.iscrizioni.some((i) => allaData(i) && vale(i)))
    return allora.length ? allora : trovate.filter((p) => p.iscrizioni.some(vale))
  }

  const perNome = attive.filter((p) => nelTesto(`${p.nome} ${p.cognome}`, nelle))
  if (perNome.length) return ordinaAbbinati(come(perNome, 'nome intero'))
  // Il nome del genitore vale solo intero: un nome o un cognome soli non dicono chi è.
  const perGenitore = attive.filter((p) => !!p.genitoreNome && !!p.genitoreCognome && nelTesto(`${p.genitoreNome} ${p.genitoreCognome}`, nelle))
  if (perGenitore.length) return ordinaAbbinati(come(perGenitore, 'genitore'))
  for (const cf of movimento.codiciFiscali) {
    const perCodice = attive.filter((p) => p.genitoreCodiceFiscale === cf || p.codiceFiscale === cf)
    if (perCodice.length) return ordinaAbbinati(come(perCodice, 'codice fiscale'))
  }
  const corsi = movimento.corsiImporto ?? []
  if (corsi.length) {
    const perCorso = attive.filter(
      (p) =>
        p.iscrizioni.some((i) => i.corsoId !== undefined && corsi.includes(i.corsoId) && i.dal <= movimento.data && (i.al === null || movimento.data <= i.al)) &&
        (nelTesto(p.cognome, nelle) || (!!p.genitoreCognome && nelTesto(p.genitoreCognome, nelle))),
    )
    if (perCorso.length) return ordinaAbbinati(come(perCorso, 'corso e cognome', () => false))
  }
  const perCognome = attive.filter((p) => nelTesto(p.cognome, nelle) || (!!p.genitoreCognome && nelTesto(p.genitoreCognome, nelle)))
  if (perCognome.length === 1) return ordinaAbbinati(come(perCognome, 'cognome'))
  const fraIscritti = ibrida(perCognome, () => true)
  if (fraIscritti.length) return ordinaAbbinati(come(fraIscritti, 'cognome', () => false))
  const testoCorsi = new Set([...nelle].map(senzaApostrofi))
  const perNomeCorso = ibrida(
    attive.filter((p) => nelTesto(p.nome, nelle)),
    (i) => paroleCorso(i.corso ?? '').some((w) => testoCorsi.has(w)),
  )
  if (perNomeCorso.length) return ordinaAbbinati(come(perNomeCorso, 'nome e corso', () => false))
  return { candidati: [], preselezionato: null }
}

/** Il database non ha ancora la funzione (file SQL non lanciato): si ricade sul solo nome, senza errore. */
export function funzioneAssente(e: unknown): boolean {
  const codice = typeof e === 'object' && e !== null && 'code' in e ? e.code : null
  return codice === 'PGRST202' || codice === '42883'
}
