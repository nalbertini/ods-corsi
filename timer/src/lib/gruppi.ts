import type { Mode, Workout } from '../types'
import type { Accesso } from './palestra'
import type { Lezione } from './lezione'
import { dellaDisciplina } from './discipline'

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
 * Le sezioni della lista, per disciplina se se ne sceglie una: i timer di quella
 * disciplina e quelli di «tutte». Le sezioni che il filtro svuota spariscono,
 * anche quelle con la frase «nessun timer»; l'ordine non cambia.
 */
export function gruppiDi(timer: Workout[], accesso: Accesso, lezione: Lezione | null, disciplina: string | null = null): Gruppo[] {
  if (disciplina === null) return sezioniDi(timer, accesso, lezione)
  return sezioniDi(dellaDisciplina(timer, disciplina), accesso, lezione).filter((g) => g.timer.length > 0)
}

/**
 * Le sezioni della lista. Senza database, o senza un accesso, è una sola,
 * com'è sempre stata. Con l'accesso i timer si dividono per dove stanno, e se
 * si arriva da una lezione in cima ci sono quelli del suo corso.
 */
function sezioniDi(timer: Workout[], accesso: Accesso, lezione: Lezione | null): Gruppo[] {
  const del = (f: (w: Workout) => boolean) => timer.filter(f).sort(piùRecenti)
  const gruppi: Gruppo[] = []
  // Il timer scelto per questa lezione sola viene prima di quelli del corso
  // (vedi `Workout.lezioni`). Senza, la sezione non si mostra.
  const perLezione = lezione?.lezioneId ? del((w) => !!w.lezioni?.includes(lezione.lezioneId!)) : []
  if (perLezione.length) gruppi.push({ chiave: 'lezione', titolo: 'DI QUESTA LEZIONE', timer: perLezione })
  // Senza accesso (in prova, o sul timer da solo) i corsi stanno sui timer
  // del dispositivo: la sezione si mostra solo se ce n'è qualcuno.
  // Chi sta già in una di queste sezioni non si ripete in quelle sotto: il
  // timer di un collega collegato al corso stava due volte, qui e fra i suoi.
  const giàQui = new Set(perLezione.map((w) => w.id))
  const delCorso = lezione ? del((w) => !giàQui.has(w.id) && !!w.corsi?.includes(lezione.corsoId)) : []
  for (const w of delCorso) giàQui.add(w.id)
  const altri = (f: (w: Workout) => boolean) => del((w) => !giàQui.has(w.id) && f(w))
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
    gruppi.push({
      chiave: 'tutti',
      titolo: 'I TUOI TIMER',
      timer: timer.filter((w) => !giàQui.has(w.id)),
      // Se i timer stanno tutti nelle sezioni sopra, questa semplicemente non c'è.
      vuota: giàQui.size ? undefined : 'Nessun timer di questo tipo. Creane uno con il pulsante qui sotto.',
    })
    return gruppi
  }
  if (accesso.chi === 'personale') gruppi.push({ chiave: 'miei', titolo: 'I MIEI', timer: altri((w) => w.dove === 'miei') })
  gruppi.push({ chiave: 'palestra', titolo: 'DELLA PALESTRA', timer: altri((w) => w.dove === 'palestra') })
  gruppi.push({
    chiave: 'collega',
    titolo: accesso.chi === 'personale' ? 'DEI COLLEGHI, NEI CORSI' : 'DEI CORSI',
    timer: altri((w) => w.dove === 'collega'),
  })
  // Quelli di sempre, sul dispositivo, restano in fondo: i timer di partenza e
  // quelli fatti prima dell'accesso. Non con l'ordine per data, che
  // mescolerebbe i timer di partenza ai propri.
  gruppi.push({
    chiave: 'qui',
    titolo: accesso.chi === 'sala' ? 'SU QUESTO TABLET' : 'SU QUESTO DISPOSITIVO',
    timer: timer.filter((w) => !w.dove && !giàQui.has(w.id)),
  })
  return gruppi
}

/**
 * Cronometro e conto alla rovescia, in lista accanto ai timer. Non sono
 * timer salvati (niente id, niente database): per questo non stanno nelle
 * sezioni di `gruppiDi`, da cui il tablet ricava i timer della lezione, ma in
 * una sezione loro, sempre in cima.
 */
export type Strumento = 'crono' | 'countdown'

export interface SchedaStrumento {
  chiave: Strumento
  /** L'etichetta di tipo, dove i timer hanno INTERVALLI, EMOM... */
  tipo: string
  nome: string
  riassunto: string
}

const STRUMENTI: SchedaStrumento[] = [
  { chiave: 'crono', tipo: 'CRONOMETRO', nome: 'CRONOMETRO', riassunto: 'conta in salita · segna i giri' },
  { chiave: 'countdown', tipo: 'ALLA ROVESCIA', nome: 'CONTO ALLA ROVESCIA', riassunto: '30″ – 3′ · scegli la durata' },
]

/** Con un filtro per tipo non compaiono: non hanno un tipo da filtrare. */
export const strumentiDa = (filtro: Mode | 'all'): SchedaStrumento[] => (filtro === 'all' ? STRUMENTI : [])

/** La barra laterale serve se ha più di una voce; sul tablet, con una sola, è vuota. */
export const conBarra = (incorporato: boolean, voci: number) => !incorporato || voci > 1

/** Lo strumento aperto prende lo schermo, ma solo nella scheda dei timer. */
export const aTuttoSchermo = (tab: string, strumento: Strumento | null) => tab === 'timer' && strumento !== null

/**
 * Cambiando scheda, lo strumento aperto: un tocco sulle schede del timer lo
 * chiude; la scheda chiesta da fuori (il tasto IMPOSTAZIONI dell'app
 * istruttori) no, perché un cronometro avviato deve restare quello che era.
 */
export const strumentoDopo = (aperto: Strumento | null, chi: 'tasto' | 'fuori'): Strumento | null => (chi === 'fuori' ? aperto : null)
