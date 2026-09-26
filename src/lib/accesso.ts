import type { SupabaseClient } from '@supabase/supabase-js'
import type { Ruolo } from './sala'
import { haUnServer } from './dati'

/**
 * Chi sta usando l'app.
 *
 * Col database si entra con un link mandato per email: niente password da
 * ricordare, e chi non è in anagrafica come istruttore o segreteria non entra.
 * Al primo accesso `collega_utente()` (in `05-segreteria.sql`) lega l'account
 * alla persona che ha quell'email. In prova non c'è accesso: si è la
 * segreteria di prova, che vede tutto.
 */
export type Chi =
  | { stato: 'fuori' }
  /** Ha un account, ma nessuna persona in anagrafica con quell'email. */
  | { stato: 'sconosciuto'; email: string }
  | { stato: 'dentro'; personaId: string; nome: string; ruolo: Ruolo; prova: boolean }

export interface Accesso {
  chi(): Promise<Chi>
  /** Manda il link per entrare. */
  mandaLink(email: string): Promise<void>
  esci(): Promise<void>
  /** Avvisa quando si entra o si esce, anche aprendo il link in un'altra scheda. */
  guarda(f: () => void): () => void
}

let unico: Promise<Accesso> | null = null

export function accesso(): Promise<Accesso> {
  if (!unico) unico = haUnServer ? import('./supabase').then((s) => accessoSupabase(s.clientSupabase())) : Promise.resolve(accessoProva)
  return unico
}

const accessoProva: Accesso = {
  chi: async () => ({ stato: 'dentro', personaId: 'prova', nome: 'Segreteria di prova', ruolo: 'staff', prova: true }),
  mandaLink: async () => {},
  esci: async () => {},
  guarda: () => () => {},
}

function accessoSupabase(db: SupabaseClient): Accesso {
  return {
    async chi() {
      const { data } = await db.auth.getSession()
      const s = data.session
      if (!s) return { stato: 'fuori' }
      const { data: id } = await db.rpc('collega_utente')
      if (!id) return { stato: 'sconosciuto', email: s.user.email ?? '' }
      const { data: p } = await db.from('persone').select('nome, cognome, ruolo').eq('id', id as string).single()
      if (!p) return { stato: 'sconosciuto', email: s.user.email ?? '' }
      return { stato: 'dentro', personaId: id as string, nome: `${p.nome} ${p.cognome}`.trim(), ruolo: p.ruolo as Ruolo, prova: false }
    },

    async mandaLink(email) {
      const { error } = await db.auth.signInWithOtp({
        email,
        // Chi non c'è non si crea un account da sé: gli account li fa la segreteria.
        options: { shouldCreateUser: false, emailRedirectTo: window.location.origin + window.location.pathname },
      })
      if (error) throw new Error(error.status === 429 ? 'Troppi link in poco tempo: riprova fra un minuto' : 'Questa email non ha un accesso: chiedi alla segreteria')
    },

    async esci() {
      await db.auth.signOut()
    },

    guarda(f) {
      const { data } = db.auth.onAuthStateChange((evento) => {
        if (evento === 'SIGNED_IN' || evento === 'SIGNED_OUT') f()
      })
      return () => data.subscription.unsubscribe()
    },
  }
}
