/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** L'indirizzo del progetto Supabase. Assente = modalità prova. */
  readonly VITE_SUPABASE_URL?: string
  /**
   * La chiave pubblica del progetto. È pubblica di proposito e finisce nel
   * bundle: a proteggere i dati sono le policy RLS, non questa stringa.
   */
  readonly VITE_SUPABASE_ANON_KEY?: string
  /**
   * Il Client ID dell'app Spotify, lo stesso del timer: serve alla sala per
   * rinnovare il collegamento fatto dal timer. Facoltativo.
   */
  readonly VITE_SPOTIFY_CLIENT_ID?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** Il numero di versione di package.json, messo da vite.config.ts. */
declare const __VERSIONE__: string
/** Il commit da cui è compilata l'app, sette caratteri; vuoto se non si sa. */
declare const __COMMIT__: string
/** Quando è stata compilata, in ISO 8601. */
declare const __COMPILATA__: string
