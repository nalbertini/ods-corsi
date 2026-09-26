import { useEffect, useRef } from 'react'

type Sentinel = { released: boolean; release: () => Promise<void>; addEventListener: (t: string, f: () => void) => void }

/**
 * Tiene lo schermo acceso mentre il timer gira. Il lock cade quando la pagina
 * passa in background, quindi va riagganciato al ritorno.
 */
export function useWakeLock(active: boolean) {
  const ref = useRef<Sentinel | null>(null)

  useEffect(() => {
    const api = (navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<Sentinel> } }).wakeLock
    if (!api) return

    let cancelled = false

    const acquire = async () => {
      if (!active || cancelled || ref.current) return
      try {
        ref.current = await api.request('screen')
        ref.current.addEventListener('release', () => {
          ref.current = null
        })
      } catch {
        // Batteria scarica o permesso negato: si continua senza.
      }
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire()
    }

    void acquire()
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void ref.current?.release().catch(() => {})
      ref.current = null
    }
  }, [active])
}
