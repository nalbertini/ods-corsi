/// <reference types="vite/client" />

/** Sostituita in compilazione: vedi `define` in vite.config.ts. */
declare const __BUILD_DATE__: string
declare const __APP_VERSION__: string
declare const __APP_COMMIT__: string
/** Dove stanno i file del timer rispetto alla pagina: vuoto da solo, `timer/` dentro il tablet. */
declare const __TIMER_RADICE__: string

interface ImportMetaEnv {
  /** Il Client ID dell'app registrata su developer.spotify.com. Facoltativo. */
  readonly VITE_SPOTIFY_CLIENT_ID?: string
  /** Il database di ODS Corsi: senza, il timer tiene tutto sul dispositivo. */
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}
