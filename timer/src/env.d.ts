/// <reference types="vite/client" />

/** Sostituita in compilazione: vedi `define` in vite.config.ts. */
declare const __BUILD_DATE__: string
declare const __APP_VERSION__: string
declare const __APP_COMMIT__: string

interface ImportMetaEnv {
  /** Il database di ODS Corsi: senza, il timer tiene tutto sul dispositivo. */
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}
