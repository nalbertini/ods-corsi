import { normalizzaNome } from './movimentiPersona'

/**
 * Chi può aver pagato un movimento non identificato (banca o Satispay), con le stesse regole del database
 * (`supabase/119-abbina-movimenti.sql`, che le applica senza mostrare a chi amministra codici, genitori e date):
 *  1. nome e cognome interi nel testo;
 *  2. se nessuno, nome e cognome del genitore nel testo: i suoi figli;
 *  3. se nessuno, un codice fiscale letto dalla causale: del genitore, o dell'adulto che paga per sé;
 *  4. se nessuno, l'importo: i corsi che costano quella cifra (`corsiConImporto`) e, fra i loro iscritti, chi ha nel testo
 *     il cognome suo o del genitore. Qui l'iscrizione è il segno a favore, non contro: «già iscritto» resta falso.
 * Chi è già iscritto il giorno del movimento si propone lo stesso (può pagare un altro corso) ma in fondo e col segno.
 */

export type ComeAbbinato = 'nome intero' | 'genitore' | 'codice fiscale' | 'corso e cognome'

export interface Abbinato {
  id: string
  nome: string
  cognome: string
  come: ComeAbbinato
  giaIscritto: boolean
}

export interface EsitoAbbinamento {
  candidati: Abbinato[]
  /** Solo con un candidato solo, non iscritto: negli altri casi sceglie chi amministra. */
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
  iscrizioni: Array<{ dal: string; al: string | null; corsoId?: string }>
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

/** Non iscritti prima (cognome e nome), iscritti in fondo; al massimo otto; preselezionato solo se uno e non iscritto. */
export function ordinaAbbinati(abbinati: Abbinato[]): EsitoAbbinamento {
  const candidati = [...abbinati].sort((a, b) => Number(a.giaIscritto) - Number(b.giaIscritto) || ordine(a, b)).slice(0, MASSIMO_ABBINATI)
  return { candidati, preselezionato: abbinati.length === 1 && !abbinati[0].giaIscritto ? abbinati[0].id : null }
}

export function abbinaMovimento(movimento: { testo: string; data: string; codiciFiscali: string[]; corsiImporto?: string[] }, persone: PersonaDaAbbinare[]): EsitoAbbinamento {
  const nelle = new Set(parole(movimento.testo))
  const attive = persone.filter((p) => p.attiva)
  const come = (trovate: PersonaDaAbbinare[], c: ComeAbbinato): Abbinato[] =>
    trovate.map((p) => ({ id: p.id, nome: p.nome, cognome: p.cognome, come: c, giaIscritto: p.iscrizioni.some((i) => i.dal <= movimento.data && (i.al === null || movimento.data <= i.al)) }))

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
    if (perCorso.length) return ordinaAbbinati(perCorso.map((p) => ({ id: p.id, nome: p.nome, cognome: p.cognome, come: 'corso e cognome', giaIscritto: false })))
  }
  return { candidati: [], preselezionato: null }
}

/** Il database non ha ancora la funzione (file SQL non lanciato): si ricade sul solo nome, senza errore. */
export function funzioneAssente(e: unknown): boolean {
  const codice = typeof e === 'object' && e !== null && 'code' in e ? e.code : null
  return codice === 'PGRST202' || codice === '42883'
}
