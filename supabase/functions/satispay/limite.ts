// ---------------------------------------------------------------------------
// Il limite alle richieste a raffica dei pagamenti online (168-limite-frequenza.sql).
//
// La funzione `satispay` è aperta e ogni chiamata costa una chiamata al
// provider: il conto sta nel database, perché in memoria ogni istanza della
// funzione avrebbe il suo.
//
// Il limite protegge il provider, non deve mai fermare chi paga: se il
// database non risponde, o 168 non c'è ancora, la richiesta passa.
// ---------------------------------------------------------------------------

export const TROPPE = 'Troppe richieste: riprova fra qualche minuto'

type Rpc = { rpc: (nome: string, argomenti: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> }

/** Conta la richiesta nell'ambito e dice se passa. */
export async function passa(admin: Rpc, ambito: string, chiave: string, massimo: number, secondi: number) {
  try {
    const { data, error } = await admin.rpc('limite_frequenza', { ambito, chiave, massimo, secondi })
    if (!error) return data !== false
    // Nel log l'ambito e il codice, mai la chiave: è l'impronta di un IP o l'id di un pagamento.
    // `as`: l'errore di supabase-js ha `code`, ma il tipo Rpc lo lascia `unknown` per le prove.
    console.warn(`limite ${ambito}: ${(error as { code?: string }).code ?? 'errore'}`)
    return true
  } catch {
    console.warn(`limite ${ambito}: database non raggiunto`)
    return true
  }
}

/**
 * Come `passa`, con chiave l'IP di chi chiama. L'IP è un dato personale: nel
 * database va solo la sua impronta (HMAC con un segreto, così non si risale
 * all'IP provando tutti gli indirizzi), e non si scrive mai nei log.
 * Senza IP non si conta: meglio un buco nel limite che un pagamento fermato.
 */
export async function perIp(admin: Rpc, req: Request, ambito: string, massimo: number, secondi: number) {
  // Solo cf-connecting-ip, che mette il proxy: x-forwarded-for lo scrive chi chiama,
  // e cambiandolo a ogni richiesta il limite non scatterebbe mai.
  const ip = req.headers.get('cf-connecting-ip')?.trim() || ''
  if (!ip) return true
  // Senza un segreto suo se ne deriva uno dalla chiave di servizio, che sta solo qui.
  const segreto = Deno.env.get('LIMITE_SEGRETO') || `${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''}:limite`
  let chiave: string
  try {
    const testo = new TextEncoder()
    const k = await crypto.subtle.importKey('raw', testo.encode(segreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const impronta = new Uint8Array(await crypto.subtle.sign('HMAC', k, testo.encode(ip)))
    chiave = [...impronta].map((b) => b.toString(16).padStart(2, '0')).join('')
  } catch {
    console.warn(`limite ${ambito}: impronta non calcolata`)
    return true
  }
  return passa(admin, ambito, chiave, massimo, secondi)
}
