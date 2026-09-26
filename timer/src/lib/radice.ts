/**
 * Dove stanno i file del timer — la voce incisa, le illustrazioni, la guida —
 * rispetto alla pagina aperta.
 *
 * Il timer da solo è la pagina, e i percorsi relativi valgono così come sono.
 * Montato dentro il tablet di sala di ODS Corsi la pagina è quella di ODS
 * Corsi, e i file del timer stanno un piano sotto, in `timer/`. Lo dice la
 * compilazione: `define` nei due `vite.config.ts`.
 */
export const RADICE: string = __TIMER_RADICE__

export const daRadice = (percorso: string) => `${RADICE}${percorso}`
