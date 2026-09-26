/**
 * L'arrivo da un link di Supabase: l'invito della segreteria (vedi
 * `supabase/functions/invita`) o «password dimenticata».
 *
 * Supabase rimanda alla pagina con il suo frammento, `#access_token=…&type=invite`
 * (o `type=recovery`), oppure `#error=…` se il link è scaduto o già usato. Il
 * frammento è anche quello delle aree (`#segreteria`, `#sala`…), e l'app non
 * lo riconoscerebbe: lo si legge qui, una volta, all'apertura. Va letto
 * prima che nasca il client di Supabase, che lo consuma e lo toglie
 * dall'indirizzo quando ne ricava la sessione.
 */
export type Arrivo = { tipo: 'invito' | 'password' } | { tipo: 'scaduto'; testo: string }

export function arrivoDalLink(hash: string): Arrivo | null {
  if (!hash.startsWith('#')) return null
  const q = new URLSearchParams(hash.slice(1))
  if (q.has('error') || q.has('error_code')) {
    const codice = q.get('error_code') ?? ''
    return {
      tipo: 'scaduto',
      testo:
        codice === 'otp_expired'
          ? 'Il link è scaduto o è già stato usato.'
          : `Il link non vale${q.get('error_description') ? `: ${q.get('error_description')}` : '.'}`,
    }
  }
  if (!q.has('access_token')) return null
  const tipo = q.get('type')
  if (tipo === 'invite' || tipo === 'signup') return { tipo: 'invito' }
  if (tipo === 'recovery') return { tipo: 'password' }
  return null
}

/** Com'è stata aperta la pagina: si legge all'import, prima di tutto il resto. */
export const ARRIVO: Arrivo | null = typeof window === 'undefined' ? null : arrivoDalLink(window.location.hash)

/** Dove fanno tornare i link di Supabase: questa pagina, senza frammento. Va fra i Redirect URLs del progetto. */
export const indirizzoDiRitorno = () => window.location.origin + window.location.pathname
