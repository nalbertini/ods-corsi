import { eUnId } from './palestra'

/**
 * La lezione da cui si arriva.
 *
 * Il tasto TIMER del tablet di sala e dell'appello, in ODS Corsi, apre il
 * timer con la lezione nell'indirizzo: `?corso=…&lezione=…&nome=…`. Il timer
 * mette in cima i timer di quel corso, e lo storico si ricorda in che lezione
 * sono partiti. Nella query e non nel frammento, che è già dei timer mandati
 * col QR (`condivisione.ts`).
 */
export interface Lezione {
  /**
   * Il corso. Col database è un identificativo vero; in prova quello dei
   * dati inventati di ODS Corsi, che serve solo al titolo.
   */
  corsoId: string
  /** La lezione del calendario, se si arriva da una: la scrive lo storico. */
  sessioneId: string | null
  /**
   * La lezione così come la chiama ODS Corsi, anche in prova, dove non è un
   * identificativo del database: serve a trovare i timer legati a lei sola.
   */
  lezioneId: string | null
  nome: string
}

export function lezioneDaIndirizzo(href = location.href): Lezione | null {
  try {
    const q = new URL(href).searchParams
    const corsoId = q.get('corso')
    if (!corsoId || !/^[\w~.:-]{1,80}$/.test(corsoId)) return null
    const sessione = q.get('lezione')
    const nome = (q.get('nome') ?? '').trim().slice(0, 80)
    const lezioneId = sessione && /^[\w~.:@-]{1,120}$/.test(sessione) ? sessione : null
    return { corsoId, sessioneId: eUnId(sessione) ? sessione : null, lezioneId, nome }
  } catch {
    return null
  }
}
