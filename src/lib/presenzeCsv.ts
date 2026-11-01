import { csv } from './vestiario'
import { chiaveGiorno, oraDi } from './sala'
import type { RigaRegistro } from './segreteria'

/**
 * Il registro del mese in righe per il foglio: una per iscritto di ogni
 * lezione. Passa da `csv()`, che neutralizza i nomi che Excel leggerebbe
 * come formula (il nome lo scrive chi si iscrive dal modulo pubblico).
 */
export const csvRegistro = (righe: RigaRegistro[]) =>
  csv([
    ['data', 'ora', 'corso', 'sala', 'istruttore', 'cognome', 'nome', 'stato'],
    ...righe.flatMap((r) =>
      r.appello.map((p) => [
        chiaveGiorno(new Date(r.inizio)),
        oraDi(r.inizio),
        r.corso,
        r.sala ?? '',
        r.istruttori,
        p.cognome,
        p.nome,
        r.stato === 'annullata' ? 'lezione annullata' : (p.stato ?? ''),
      ]),
    ),
  ])

/**
 * La riga sotto «Scarica CSV» spento: il periodo scelto è vuoto, e lo si
 * dice, così non si cerca il guasto. Il `quando` lo porta il periodo, già
 * scritto («a ottobre 2026», «negli ultimi 30 giorni», «da settembre»): dal
 * nome del menu la grammatica si indovinerebbe, e un periodo nuovo la sbaglia.
 * Vuota se c'è da scaricare, o se i dati non sono arrivati (carica, o la
 * lettura non è riuscita): lì non si sa se il periodo è vuoto.
 */
export function nienteDaScaricare(cosa: 'presenze' | 'lezioni', quando: string, conCorso: boolean, dati: { arrivato: boolean; righe: number }) {
  if (!dati.arrivato || dati.righe > 0) return ''
  return `${cosa === 'presenze' ? 'Nessuna presenza' : 'Nessuna lezione'} ${quando}${conCorso ? ' per questo corso' : ''}: niente da scaricare.`
}
