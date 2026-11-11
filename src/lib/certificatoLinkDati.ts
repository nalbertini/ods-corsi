import { FunctionsHttpError } from '@supabase/supabase-js'
import { haUnServer } from './dati'
import type { InfoLink } from './certificatoLink'

/**
 * La pagina `certificato/` e la Edge Function `certificato`: senza accesso,
 * col solo codice del link. In prova il link è finto e vale sempre (Marco R.).
 */
export type AperturaLink = ({ stato: 'valido' } & InfoLink) | { stato: 'arrivato'; nome?: string } | { stato: 'non_vale' }

export interface DatiLink {
  apri(codice: string): Promise<AperturaLink>
  /** `ricevuto`, o com'è il link se nel frattempo non vale più; gli altri guai sono un Error col testo per chi carica. */
  manda(codice: string, file: File, scade: string): Promise<'ricevuto' | AperturaLink>
}

const NON_PARTITO = 'Non è partito: controlla la connessione e riprova.'

async function letto(error: unknown): Promise<{ stato: number; corpo: Record<string, unknown> } | null> {
  if (!(error instanceof FunctionsHttpError)) return null
  const corpo: unknown = await error.context.json().catch(() => null)
  // `as`: il JSON della funzione (supabase/functions/certificato), letto campo per campo.
  return { stato: error.context.status, corpo: (typeof corpo === 'object' && corpo !== null ? corpo : {}) as Record<string, unknown> }
}

// `as`: la funzione rende `stato` e i campi della pagina; un valore che non conosce vale come «non vale».
const apertura = (x: Record<string, unknown>): AperturaLink =>
  x.stato === 'valido' && typeof x.nome === 'string'
    ? { stato: 'valido', nome: x.nome, iniziale: String(x.iniziale ?? ''), tipo: x.tipo === 'agonistico' ? 'agonistico' : 'normale', ...(typeof x.entro === 'string' ? { entro: x.entro } : {}) }
    : x.stato === 'arrivato'
      ? { stato: 'arrivato', ...(typeof x.nome === 'string' ? { nome: x.nome } : {}) }
      : { stato: 'non_vale' }

function datiVeri(): DatiLink {
  const client = () => import('./supabase').then((s) => s.clientSupabase())
  return {
    async apri(codice) {
      const { data, error } = await (await client()).functions.invoke(`certificato?l=${encodeURIComponent(codice)}`, { method: 'GET' })
      if (error) {
        const e = await letto(error)
        // La funzione non c'è ancora sul progetto: per chi apre è un link che non vale.
        if (e?.stato === 404) return { stato: 'non_vale' }
        throw new Error('La pagina non si è aperta: controlla la connessione e riprova.')
      }
      // `as`: il JSON della funzione.
      return apertura((data ?? {}) as Record<string, unknown>)
    },
    async manda(codice, file, scade) {
      const corpo = new FormData()
      corpo.set('l', codice)
      corpo.set('scade', scade)
      corpo.set('file', file)
      const { error } = await (await client()).functions.invoke('certificato', { body: corpo })
      if (!error) return 'ricevuto'
      const e = await letto(error)
      if (!e) throw new Error(NON_PARTITO)
      if (e.stato === 410) return apertura(e.corpo)
      throw new Error(typeof e.corpo.guaio === 'string' ? e.corpo.guaio : NON_PARTITO)
    },
  }
}

const datiProva: DatiLink = {
  async apri() {
    return { stato: 'valido', nome: 'Marco', iniziale: 'R', tipo: 'normale', entro: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10) }
  },
  async manda() {
    return 'ricevuto'
  },
}

export const datiLink = (): DatiLink => (haUnServer ? datiVeri() : datiProva)
