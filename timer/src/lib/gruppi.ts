import type { Workout } from '../types'
import type { Accesso } from './palestra'
import type { Lezione } from './lezione'

/** Una sezione della lista dei timer. */
export interface Gruppo {
  chiave: string
  titolo: string
  timer: Workout[]
  /** Cosa dire quando è vuota; senza, una sezione vuota non si mostra. */
  vuota?: string
}

const piùRecenti = (a: Workout, b: Workout) => b.updatedAt - a.updatedAt

/**
 * Le sezioni della lista. Senza database, o senza un accesso, è una sola,
 * com'è sempre stata. Con l'accesso i timer si dividono per dove stanno, e se
 * si arriva da una lezione in cima ci sono quelli del suo corso.
 */
export function gruppiDi(timer: Workout[], accesso: Accesso, lezione: Lezione | null): Gruppo[] {
  const del = (f: (w: Workout) => boolean) => timer.filter(f).sort(piùRecenti)
  const gruppi: Gruppo[] = []
  // Il timer scelto per questa lezione sola viene prima di quelli del corso
  // (vedi `Workout.lezioni`). Senza, la sezione non si mostra.
  const perLezione = lezione?.lezioneId ? del((w) => !!w.lezioni?.includes(lezione.lezioneId!)) : []
  if (perLezione.length) gruppi.push({ chiave: 'lezione', titolo: 'DI QUESTA LEZIONE', timer: perLezione })
  // Senza accesso (in prova, o sul timer da solo) i corsi stanno sui timer
  // del dispositivo: la sezione si mostra solo se ce n'è qualcuno.
  const delCorso = lezione ? del((w) => !!w.corsi?.includes(lezione.corsoId)) : []
  if (lezione && accesso.chi === 'nessuno' && delCorso.length) gruppi.push({ chiave: 'corso', titolo: 'DEL CORSO', timer: delCorso })
  if (lezione && accesso.chi !== 'nessuno') {
    gruppi.push({
      chiave: 'corso',
      titolo: 'DEL CORSO',
      timer: delCorso,
      // Con un timer della lezione, un corso senza timer non ha niente da dire.
      vuota: perLezione.length
        ? undefined
        : accesso.chi === 'personale'
          ? 'Nessun timer è collegato a questo corso. Si collega dall’editor del timer, alla voce CORSI.'
          : 'Nessun timer è collegato a questo corso: lo collega un istruttore dal suo timer.',
    })
  }
  if (accesso.chi === 'nessuno') {
    gruppi.push({ chiave: 'tutti', titolo: 'I TUOI TIMER', timer, vuota: 'Nessun timer di questo tipo. Creane uno con il pulsante qui sotto.' })
    return gruppi
  }
  if (accesso.chi === 'personale') gruppi.push({ chiave: 'miei', titolo: 'I MIEI', timer: del((w) => w.dove === 'miei') })
  gruppi.push({ chiave: 'palestra', titolo: 'DELLA PALESTRA', timer: del((w) => w.dove === 'palestra') })
  gruppi.push({
    chiave: 'collega',
    titolo: accesso.chi === 'personale' ? 'DEI COLLEGHI, NEI CORSI' : 'DEI CORSI',
    timer: del((w) => w.dove === 'collega'),
  })
  // Quelli di sempre, sul dispositivo, restano in fondo: i timer di partenza e
  // quelli fatti prima dell'accesso. Non con l'ordine per data, che
  // mescolerebbe i timer di partenza ai propri.
  gruppi.push({
    chiave: 'qui',
    titolo: accesso.chi === 'sala' ? 'SU QUESTO TABLET' : 'SU QUESTO DISPOSITIVO',
    timer: timer.filter((w) => !w.dove),
  })
  return gruppi
}
