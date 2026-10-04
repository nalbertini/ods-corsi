import type { Settings } from '../types'

/**
 * La musica è attiva se è accesa nelle impostazioni e c'è qualcosa da
 * comandare. Spenta, non compare niente e non parte niente, anche con Spotify
 * collegato: l'interruttore decide, non il collegamento.
 *
 * `musica` manca nei salvataggi scritti prima dell'interruttore: lì resta accesa.
 */
export function musicaAttiva(settings: Partial<Pick<Settings, 'musica'>>, daComandare: boolean): boolean {
  return settings.musica !== false && daComandare
}
