import { VOCE_DA_CLASSIFICARE } from './importaPrimaNota'
import type { RigaMovimento } from './contabilita'

export type FonteDaClassificare = 'Satispay' | 'Banca' | 'A mano' | 'Storico'
export type RigaDaClassificare = RigaMovimento & { fonte: FonteDaClassificare }
type Totale = { conteggio: number; importo: number }

export const FONTI_DA_CLASSIFICARE: FonteDaClassificare[] = ['Satispay', 'Banca', 'A mano', 'Storico']

function fonteDi(r: RigaMovimento): FonteDaClassificare {
  if (r.satispayId) return 'Satispay'
  if (r.origineImport?.startsWith('banca:')) return 'Banca'
  if (r.origineImport?.startsWith('prima-nota:')) return 'Storico'
  return 'A mano'
}

/**
 * Le voci già in contabilità ma senza una voce vera, di qualunque fonte, dalla più vecchia: le stesse righe
 * di MOVIMENTI con la voce «Da classificare». Escono da sole quando le classifichi.
 */
export function daClassificare(righe: RigaMovimento[]): { righe: RigaDaClassificare[]; entrate: Totale; uscite: Totale } {
  const lista = righe
    .filter((r) => r.origine === 'movimento' && !r.annullato && r.tipo !== 'giroconto' && r.voce === VOCE_DA_CLASSIFICARE)
    .map((r): RigaDaClassificare => ({ ...r, fonte: fonteDi(r) }))
    .sort((a, b) => a.data.localeCompare(b.data) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const totale = (tipo: RigaMovimento['tipo']): Totale => {
    const x = lista.filter((r) => r.tipo === tipo)
    return { conteggio: x.length, importo: x.reduce((s, r) => s + r.importo, 0) }
  }
  return { righe: lista, entrate: totale('entrata'), uscite: totale('uscita') }
}

/** Il filtro per fonte della lista; vuoto: tutte. */
export const filtraDaClassificare = (righe: RigaDaClassificare[], fonte: '' | FonteDaClassificare): RigaDaClassificare[] =>
  fonte ? righe.filter((r) => r.fonte === fonte) : righe

/**
 * Quel che la lista mostra: le righe della fonte scelta, le prime `quante`. Se la fonte scelta non ha più
 * voci (le hai classificate tutte) si torna su «Tutte», se no la tabella resterebbe vuota senza spiegazione.
 */
export function vistaDaClassificare(righe: RigaDaClassificare[], fonte: '' | FonteDaClassificare, quante: number) {
  const attiva = righe.some((r) => r.fonte === fonte) ? fonte : ''
  const elenco = filtraDaClassificare(righe, attiva)
  const restano = Math.max(0, elenco.length - quante)
  return { fonte: attiva, visibili: elenco.slice(0, quante), restano, prossime: Math.min(restano, quante) }
}
