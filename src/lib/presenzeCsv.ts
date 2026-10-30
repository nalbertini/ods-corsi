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
