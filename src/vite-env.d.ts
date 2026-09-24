/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** L'indirizzo del progetto Supabase. Assente = modalità prova. */
  readonly VITE_SUPABASE_URL?: string
  /**
   * La chiave pubblica del progetto. È pubblica di proposito e finisce nel
   * bundle: a proteggere i dati sono le policy RLS, non questa stringa.
   */
  readonly VITE_SUPABASE_ANON_KEY?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
