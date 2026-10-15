import { REGOLE } from './tablet'

/**
 * Quando un istruttore può toccare le presenze di una lezione: da 30 minuti
 * prima dell'inizio a 14 giorni dopo. Sono le regole di `tablet_regole()` e il
 * trigger `presenze_a_finestra` di `supabase/52-presenze-finestra.sql`; qui
 * servono a disegnare l'appello giusto, ma l'ultima parola è del server. La
 * segreteria (ruolo doppio compreso) non ha limiti.
 */
export type Finestra = 'aperta' | 'vecchia' | 'lontana'

const MIN = 60_000
const GIORNO = 24 * 60 * MIN

export function appelloAperto(inizio: string | number | Date, senzaLimiti: boolean, adesso: number = Date.now()): Finestra {
  if (senzaLimiti) return 'aperta'
  const t = new Date(inizio).getTime()
  if (t < adesso - REGOLE.recuperoGiorni * GIORNO) return 'vecchia'
  if (t > adesso + REGOLE.primaMin * MIN) return 'lontana'
  return 'aperta'
}

/** L'appello accredita l'ora dell'istruttore solo se la lezione comincia fra non più di mezz'ora (`istruttore_dall_appello`). */
export const accreditaOraIstruttore = (inizio: string | number | Date, adesso: number = Date.now()) =>
  new Date(inizio).getTime() <= adesso + REGOLE.primaMin * MIN

/** Il messaggio del server (e della modalità prova) per una lezione fuori finestra. */
const TESTO_FUORI_FINESTRA = 'troppo vecchia o troppo lontana per cambiare le presenze'
export const MESSAGGIO_FUORI_FINESTRA = `La lezione è ${TESTO_FUORI_FINESTRA}: scrivete alla segreteria`

/** L'errore del trigger `presenze_a_finestra`: 42501 con quella frase, non un permesso negato qualunque. */
export const eFuoriFinestra = (e: unknown) => {
  const x = e as { code?: string; message?: string } | null
  return x?.code === '42501' && (x.message ?? '').includes(TESTO_FUORI_FINESTRA)
}

/**
 * La frase per chi apre una lezione fuori finestra. Con `aperta` è il server
 * che ha detto no mentre per l'orologio di questo telefono si poteva.
 */
export const fraseFuoriFinestra = (f: Finestra) =>
  f === 'vecchia'
    ? 'Questa lezione è troppo vecchia per cambiare le presenze: scrivete alla segreteria.'
    : f === 'lontana'
      ? 'Questa lezione comincia fra troppo tempo: le presenze si segnano da mezz’ora prima dell’inizio. Per cambiarle prima, scrivete alla segreteria.'
      : 'Il server non accetta più cambi alle presenze di questa lezione: sono tornate com’erano. Scrivete alla segreteria.'

/** Il titolo del riquadro che accompagna la frase. */
export const etichettaFuoriFinestra = (f: Finestra) =>
  f === 'vecchia' ? 'LEZIONE TROPPO VECCHIA' : f === 'lontana' ? 'LEZIONE TROPPO LONTANA' : 'IL SERVER NON ACCETTA CAMBI'
