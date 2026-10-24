/**
 * Le frecce di un gruppo di radio: destra e giù vanno alla voce dopo, sinistra e
 * su a quella prima (in giro), Home e End agli estremi. Per ogni altro tasto
 * `null`: il browser fa quello che sa fare.
 */
export function prossimoRadio(tasto: string, indice: number, quante: number): number | null {
  if (tasto === 'ArrowRight' || tasto === 'ArrowDown') return (indice + 1) % quante
  if (tasto === 'ArrowLeft' || tasto === 'ArrowUp') return (indice - 1 + quante) % quante
  if (tasto === 'Home') return 0
  if (tasto === 'End') return quante - 1
  return null
}

/** Un solo tab stop per gruppo: la voce scelta, o la prima se nessuna lo è (`scelta` -1). */
export const tabIndexRadio = (indice: number, scelta: number): 0 | -1 => (indice === (scelta < 0 ? 0 : scelta) ? 0 : -1)

/**
 * Cosa fa una freccia su un radio: dove va il focus e se la scelta lo segue. Senza una scelta già fatta
 * (il comune dal CAP) solo il focus, perché scegliere nasconde l'elenco e il focus andrebbe perso; con una
 * voce sola la scelta non si tocca, perché chi sceglie fa da interruttore e la toglierebbe.
 */
export function frecciaRadio(tasto: string, indice: number, quante: number, haScelta: boolean): { focus: number; scegli: boolean } | null {
  const focus = prossimoRadio(tasto, indice, quante)
  return focus === null ? null : { focus, scegli: haScelta && focus !== indice }
}
