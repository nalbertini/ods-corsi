/**
 * Le letture di una voce sono finite: ognuna è arrivata o ha dato un guaio. Finché non lo sono, la voce non mostra
 * l'elenco: una tabella che compare dopo i dati sposta tutto quello che ha sotto.
 */
export const lette = (...letture: { dato: unknown; guaio: string | null }[]) => letture.every((l) => l.dato !== null || l.guaio !== null)
