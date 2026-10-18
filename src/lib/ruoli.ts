/**
 * I ruoli di chi lavora in palestra, e le aree in cui entra.
 *
 * Nel database il ruolo è `istruttore`, `staff` (la segreteria) o
 * `amministrazione` (chi cura i conti), e due segni dicono cosa fa anche:
 * `anche_istruttore` (insegna: vale per `staff` e per `amministrazione`) e
 * `anche_amministrazione` (la segreteria che cura anche i conti: vale solo per
 * `staff`), vedi `01-schema.sql` e `55-amministrazione.sql`. Chi ha più ruoli
 * può quello che può ciascuno, gli si danno dei corsi se insegna, e all'accesso
 * sceglie in che area andare.
 *
 * Sta qui da solo, senza import, perché lo chiedono la porta (`accesso.ts`)
 * e la segreteria, e le prove in `scripts/` lo leggono senza il resto dell'app.
 */

/** Le aree con un accesso: dove porta ogni tipo di account. */
export type AreaDiAccount = 'segreteria' | 'amministrazione' | 'istruttori' | 'sala'

/** Il ruolo come sta in `persone`. */
export interface RuoloPersonale {
  ruolo: 'istruttore' | 'staff' | 'amministrazione'
  /** Insegna anche: segreteria o amministrazione che hanno dei corsi. */
  ancheIstruttore?: boolean
  /** Cura anche i conti: solo per la segreteria. */
  ancheAmministrazione?: boolean
}

/** I ruoli di chi lavora in palestra, come stanno in `persone`: gli iscritti non ci sono. Per i filtri delle richieste. */
export const RUOLI_DEL_PERSONALE = ['istruttore', 'staff', 'amministrazione'] as const

/**
 * I segni dei ruoli doppi come valgono per un ruolo: `anche_istruttore` per la
 * segreteria e l'amministrazione, `anche_amministrazione` solo per la segreteria
 * (i vincoli di `55-amministrazione.sql`). Il dato sporco, da un archivio o un
 * database di prima, si pulisce qui, in un punto solo.
 */
export function segniDi(ruolo: string, ancheIstruttore?: boolean, ancheAmministrazione?: boolean): { ancheIstruttore: boolean; ancheAmministrazione: boolean } {
  return {
    ancheIstruttore: ruolo !== 'istruttore' && !!ancheIstruttore,
    ancheAmministrazione: ruolo === 'staff' && !!ancheAmministrazione,
  }
}

/** Sono le stesse spunte, in qualunque ordine? */
export const stesseSpunte = (a: readonly Spunta[], b: readonly Spunta[]) => a.length === b.length && a.every((x) => b.includes(x))

/** Le tre cose che una persona può fare in palestra: si scelgono, anche più d'una. */
export type Spunta = 'segreteria' | 'amministrazione' | 'istruttore'

const ORDINE: Spunta[] = ['segreteria', 'amministrazione', 'istruttore']

/**
 * Il ruolo come sta nel database, dalle spunte scelte. `undefined` se non ce n'è
 * nessuna: una persona deve fare almeno una cosa. Con la segreteria il ruolo è
 * `staff`; senza, l'amministrazione ha il suo; senza nessuna delle due, `istruttore`.
 */
export function daSpunte(spunte: readonly Spunta[]): Required<RuoloPersonale> | undefined {
  const segreteria = spunte.includes('segreteria')
  const amministrazione = spunte.includes('amministrazione')
  const istruttore = spunte.includes('istruttore')
  if (segreteria) return { ruolo: 'staff', ancheIstruttore: istruttore, ancheAmministrazione: amministrazione }
  if (amministrazione) return { ruolo: 'amministrazione', ancheIstruttore: istruttore, ancheAmministrazione: false }
  if (istruttore) return { ruolo: 'istruttore', ancheIstruttore: false, ancheAmministrazione: false }
  return undefined
}

/** Le spunte di una persona, nell'ordine di sempre. Un ruolo che l'app non conosce non ne ha. */
export function spunteDi(p: { ruolo: string; ancheIstruttore?: boolean; ancheAmministrazione?: boolean }): Spunta[] {
  const fa: Record<Spunta, boolean> = {
    segreteria: p.ruolo === 'staff',
    amministrazione: p.ruolo === 'amministrazione' || (p.ruolo === 'staff' && !!p.ancheAmministrazione),
    istruttore: p.ruolo === 'istruttore' || ((p.ruolo === 'staff' || p.ruolo === 'amministrazione') && !!p.ancheIstruttore),
  }
  return ORDINE.filter((s) => fa[s])
}

/** Insegna: un istruttore, o chi ha un altro ruolo e anche questo. Gli si danno i corsi. */
export const insegna = (p: { ruolo: string; ancheIstruttore?: boolean }) => spunteDi(p).includes('istruttore')

/** Le aree di una persona: una per cosa che fa, e nessuna per un ruolo che l'app non conosce. */
export function areeDi(p: { ruolo: string; ancheIstruttore?: boolean; ancheAmministrazione?: boolean }): AreaDiAccount[] {
  // Segreteria e amministrazione sono due autorizzazioni di uno stesso posto: un menu solo (`menuSegreteria.ts`).
  const area: Record<Spunta, AreaDiAccount> = { segreteria: 'segreteria', amministrazione: 'segreteria', istruttore: 'istruttori' }
  return [...new Set(spunteDi(p).map((s) => area[s]))]
}

/** Il ruolo detto per esteso, per mostrarlo: «Segreteria e amministrazione». */
export function nomeDelRuolo(p: { ruolo: string; ancheIstruttore?: boolean; ancheAmministrazione?: boolean }): string {
  const nomi = spunteDi(p)
  if (!nomi.length) return 'Ruolo sconosciuto'
  const testo = nomi.length === 1 ? nomi[0] : `${nomi.slice(0, -1).join(', ')} e ${nomi[nomi.length - 1]}`
  return testo[0].toUpperCase() + testo.slice(1)
}

/** Cosa si può chiedere di poter fare: la lista di «COSA PUÒ FARE OGNI RUOLO». Le stesse regole delle policy del database. */
export type Permesso =
  | 'ricevute' | 'pagamenti' | 'pagina-pagamenti' | 'listino' | 'contabilita' | 'emettere-ricevute'
  | 'persone' | 'schede' | 'certificati' | 'presenze' | 'iscritti' | 'corsi' | 'prove' | 'statistiche'
  | 'account' | 'ruoli' | 'invito' | 'backup' | 'appello' | 'pin'

const DEI_SOLDI: Permesso[] = ['ricevute', 'pagamenti', 'pagina-pagamenti', 'listino']
const DI_CHI_INSEGNA: Permesso[] = ['appello', 'pin']

/** Chi può cosa. Chi ha più ruoli può quello che può ciascuno; un ruolo sconosciuto, niente. */
export function puo(p: { ruolo: string; ancheIstruttore?: boolean; ancheAmministrazione?: boolean }, cosa: Permesso): boolean {
  const s = spunteDi(p)
  const della = (x: Spunta) => s.includes(x)
  // La segreteria fa tutto, la contabilità a parte: quella è solo di chi ha il ruolo di amministrazione.
  if (della('segreteria') && cosa !== 'contabilita') return true
  if (della('amministrazione') && (DEI_SOLDI.includes(cosa) || cosa === 'contabilita')) return true
  if (della('istruttore') && DI_CHI_INSEGNA.includes(cosa)) return true
  return false
}

/** Le aree dove una persona può andare dal menu di quella in cui è, senza uscire. */
export const altreAree = (p: { ruolo: string; ancheIstruttore?: boolean; ancheAmministrazione?: boolean }, qui: AreaDiAccount): AreaDiAccount[] => areeDi(p).filter((a) => a !== qui)
