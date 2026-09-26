import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Il calendario si allunga da sé (`supabase/12-calendario-da-se.sql`): prima
 * di leggerlo si chiede al database di allungarlo, e il database lo fa solo
 * se alla fine manca meno di metà del periodo di REGOLE E PRIVACY.
 *
 * Una volta ogni qualche ora per client, non a ogni settimana sfogliata; e
 * non una volta sola, perché il tablet di sala resta aperto per settimane.
 * Se non riesce — senza rete, senza accesso, o su un database che non ha
 * ancora il file 12 — si legge il calendario com'è: non è un motivo per non
 * mostrarlo.
 */
const OGNI = 6 * 60 * 60_000

const ultima = new WeakMap<SupabaseClient, { quando: number; fatto: Promise<void> }>()

export function allungaCalendario(db: SupabaseClient): Promise<void> {
  const u = ultima.get(db)
  if (u && Date.now() - u.quando < OGNI) return u.fatto
  const fatto = Promise.resolve(db.rpc('allunga_calendario')).then(
    ({ error }) => {
      // PGRST202: la funzione non c'è, il file 12 non è ancora stato lanciato.
      if (error && error.code !== 'PGRST202') console.warn('Il calendario non si è allungato da sé:', error.message)
    },
    () => {
      // Senza rete: ci si riprova al prossimo giro.
    },
  )
  ultima.set(db, { quando: Date.now(), fatto })
  return fatto
}
