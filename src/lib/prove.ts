/**
 * Le prove: chi viene a provare una lezione prima di iscriversi.
 *
 * Entra nell'appello di quella lezione senza esserne iscritto, già presente,
 * e lo aggiunge chi fa l'appello: l'istruttore dall'app o dal tablet col
 * PIN, la segreteria dalla lezione aperta nella settimana. Chi è già venuto
 * a provare si ritrova per nome, ed è come si fa una settimana di prova.
 * Le regole vere sono in `supabase/21-prove.sql`; qui ci sono quelle che
 * servono a dire subito cosa non va, prima di mandare.
 */

import { nomeProprio, paroleCercate, somiglia } from './nomi'

/** Chi è già venuto a provare, con l'ultima lezione provata. */
export interface GiaProvato {
  id: string
  nome: string
  cognome: string
  /** Non sul tablet: lo schermo è in sala. */
  telefono?: string
  /** Solo sul tablet: «Marco N.», il cognome intero non si mostra in sala (`sigleDeiProvati`). */
  sigla?: string
  corso: string
  inizio: string
}

/** Chi viene a provare per la prima volta. */
export interface NuovaProva {
  nome: string
  cognome: string
  telefono?: string
}

/** Chi si aggiunge: uno già venuto, per id, o uno nuovo. */
export type ChiProva = { id: string; nome: string; cognome: string } | NuovaProva

export const eGiaVenuto = (c: ChiProva): c is { id: string; nome: string; cognome: string } => 'id' in c

/**
 * Chi è scritto nel pannello e non ancora aggiunto, come lo dice il tasto
 * che avvisa prima di perderlo: «Marco R.», non in maiuscolo come il resto del
 * tasto perché è il nome di una persona (DESIGN.md). `null` se non c'è scritto
 * niente; il telefono da solo non conta, senza nome non si sa chi sia.
 */
export function provaScritta(n: { nome: string; cognome: string }): string | null {
  const nome = n.nome.trim()
  const cognome = n.cognome.trim()
  const primo = nome || cognome
  if (!primo) return null
  // Il tasto sta accanto al titolo del corso: un nome lungo lo spingerebbe fuori.
  const corto = primo.length > 14 ? `${primo.slice(0, 13)}…` : primo
  return nome && cognome ? `${corto} ${cognome[0].toUpperCase()}.` : corto
}

/** Come i controlli di `metti_prova`. */
export function cosaNonVaProva(n: NuovaProva): string | null {
  if (!n.nome.trim() || !n.cognome.trim()) return 'Servono nome e cognome.'
  if (n.nome.trim().length > 80 || n.cognome.trim().length > 80) return 'Nome o cognome troppo lungo.'
  const t = n.telefono?.trim()
  if (t && !/^\+?[0-9 ./-]{6,20}$/.test(t)) return 'Il telefono non sembra un numero.'
  return null
}

/**
 * Nome, cognome e telefono come li salva il server: scritti come tutti gli
 * altri nomi (`nomi.ts`, 20-nomi.sql), il telefono vuoto non c'è.
 */
export const pulisciProva = (n: NuovaProva): NuovaProva => ({
  nome: nomeProprio(n.nome),
  cognome: nomeProprio(n.cognome),
  telefono: n.telefono?.trim() || undefined,
})

/**
 * Si cerca quando una parola ha almeno tre lettere (apostrofi e trattini non
 * contano): tre lettere sparse, «d d d», troverebbero quasi tutti.
 */
export const bastaPerCercare = (scritto: string) => paroleCercate(scritto).some((w) => w.length >= 3)

/**
 * Chi, fra quelli già venuti, somiglia a quello che si sta scrivendo
 * (`somiglia`). Senza una parola di almeno tre lettere (`bastaPerCercare`),
 * nessuno: un elenco già pronto mostrerebbe a chi passa i nomi di chi è
 * venuto, spesso bambini.
 */
export function somiglianti(tutti: GiaProvato[], scritto: string, quanti = 6): GiaProvato[] {
  if (!bastaPerCercare(scritto)) return []
  const parole = paroleCercate(scritto)
  return tutti.filter((p) => somiglia(p, parole)).slice(0, quanti)
}

/**
 * Per chi legge già tutta l'anagrafica (l'app e la segreteria): l'elenco si
 * legge una volta sola, la prima volta che si cerca, e da lì in poi si cerca
 * in quello, anche senza rete. Se la lettura fallisce, la ricerca dopo riprova.
 */
export function unaVolta<T>(leggi: () => Promise<T>): (scritto: string) => Promise<T> {
  let letto: Promise<T> | null = null
  return () => {
    letto ??= leggi().catch((e: unknown) => {
      letto = null
      throw e
    })
    return letto
  }
}

/** Lo dice `provati_con_pin` (34-prove-per-nome.sql), e la modalità prova con le stesse parole. */
export const TROPPE_RICERCHE = 'troppe ricerche: riprova fra qualche minuto'

/**
 * Cosa mostra il pannello PROVE mentre si scrive. `venuti` è la risposta per
 * questo testo, se è arrivata; intanto `ultimi`, l'ultima arrivata, filtrata
 * con quello scritto adesso: sullo schermo solo chi somiglia a questo testo.
 * Finché non c'è nessuno da proporre, una riga dice se cerca o se non c'è
 * nessuno. `guaio` è l'errore dell'ultima ricerca.
 */
export function daMostrare(o: {
  testo: string
  venuti?: GiaProvato[]
  ultimi: GiaProvato[]
  giaQui: ReadonlySet<string>
  guaio: unknown
}): { proposti: GiaProvato[]; stato: string | null; avviso: string | null } {
  const letti = o.venuti ?? o.ultimi
  const proposti = somiglianti(letti.filter((p) => !o.giaQui.has(p.id)), o.testo)
  // «Nessuno» sarebbe falso se chi somiglia è già qui: farebbe aggiungere un doppione.
  const giaQuiDentro = somiglianti(letti.filter((p) => o.giaQui.has(p.id)), o.testo).length > 0
  const avviso = !o.guaio
    ? null
    : o.guaio instanceof Error && o.guaio.message === TROPPE_RICERCHE
      ? 'Troppe ricerche da questo tablet: per qualche minuto scrivete nome e cognome.'
      : 'Senza rete non vedo chi è già venuto: scrivi nome e cognome.'
  const stato =
    !avviso && bastaPerCercare(o.testo) && proposti.length === 0
      ? giaQuiDentro
        ? 'È già in questo appello.'
        : o.venuti
          ? 'Nessuno è già venuto con questo nome.'
          : 'Cerco chi è già venuto…'
      : null
  return { proposti, stato, avviso }
}

/** Un id nuovo per una persona nuova: lo decide chi la aggiunge, così anche senza rete sa come chiamarla. */
export function nuovoId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/**
 * Chi è già nell'appello, per non riproporlo fra i già venuti. Sul tablet,
 * quando la rilettura non riesce, l'elenco si nasconde ma questo resta:
 * riaggiungere chi c'è già non cambia il suo segno, e il pannello direbbe
 * «segnato presente» anche a chi è assente.
 */
export function giaNellAppello(
  prima: ReadonlySet<string>,
  cambio: { letti: string[] } | { aggiunto: string } | { tolto: string },
): Set<string> {
  if ('letti' in cambio) return new Set(cambio.letti)
  const dopo = new Set(prima)
  if ('aggiunto' in cambio) dopo.add(cambio.aggiunto)
  else dopo.delete(cambio.tolto)
  return dopo
}
