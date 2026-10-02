import { archivio } from './archivioProva'
import { comeE, iscrittiIl, memoria, trovaLezione } from './datiProva'
import { chiaveGiorno } from './sala'
import { cosaNonVaSegnalata, GIORNI_SEGNALA, type Segnalata, type SegnalataVista } from './segnalate'

/**
 * Le presenze segnalate senza server: stanno nell'archivio di prova, e le
 * leggono e cambiano l'area degli iscritti, l'appello e la segreteria (vedi
 * `segnalate.ts`). Accogliere scrive il segno nell'appello, come farebbe
 * l'istruttore toccando il nome.
 */

const unico = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
const tutte = () => archivio.dati.segnalate ?? []

/** La lezione così come la vede la regola: quando, se è annullata, e se la persona era iscritta. */
function lezioneDi(sessioneId: string, personaId: string) {
  const l = trovaLezione(sessioneId)
  if (!l) return { lezione: null, suo: false }
  return {
    l,
    lezione: { inizio: l.inizio.toISOString(), stato: comeE(l).stato },
    suo: iscrittiIl(l.corso.id, chiaveGiorno(l.inizio)).some((p) => p.id === personaId),
  }
}

export function segnalaProva(personaId: string, sessioneId: string, nota?: string): Segnalata {
  const { lezione, suo } = lezioneDi(sessioneId, personaId)
  const segno = memoria.segnate[sessioneId]?.[personaId] ?? null
  const gia = tutte().find((x) => x.sessioneId === sessioneId && x.personaId === personaId)
  const no = cosaNonVaSegnalata(lezione, suo, segno, gia, nota)
  if (no) throw new Error(no)
  const s: Segnalata = { id: `sg-${unico()}`, sessioneId, personaId, il: new Date().toISOString(), nota: nota?.trim() || undefined, stato: 'da_vedere' }
  archivio.dati.segnalate = [...tutte(), s]
  archivio.salva()
  return s
}

/** Quelle di una persona, per la sua pagina. */
export const segnalateDi = (personaId: string) => tutte().filter((x) => x.personaId === personaId)

/**
 * Da guardare e già gestite degli ultimi giorni, dalla più recente; con
 * `soloDi` solo quelle delle lezioni di quell'istruttore.
 */
export function segnalateProva(o: { soloDi?: string; giorni?: number } = {}): SegnalataVista[] {
  const limite = Date.now() - (o.giorni ?? GIORNI_SEGNALA * 2) * 24 * 60 * 60_000
  const persone = new Map(archivio.dati.persone.map((p) => [p.id, p]))
  return tutte()
    .flatMap((s): SegnalataVista[] => {
      const l = trovaLezione(s.sessioneId)
      const p = persone.get(s.personaId)
      if (!l || !p) return []
      const insegnanti = comeE(l).istruttori
      if (o.soloDi && !insegnanti.includes(o.soloDi)) return []
      if (s.stato !== 'da_vedere' && new Date(s.gestitaIl ?? s.il).getTime() < limite) return []
      return [
        {
          ...s,
          nome: p.nome,
          cognome: p.cognome,
          corso: l.corso.nome,
          colore: l.corso.colore,
          inizio: l.inizio.toISOString(),
          fine: l.fine.toISOString(),
          insegnanti,
          segno: memoria.segnate[s.sessioneId]?.[s.personaId] ?? null,
        },
      ]
    })
    .sort((x, y) => Number(y.stato === 'da_vedere') - Number(x.stato === 'da_vedere') || y.il.localeCompare(x.il))
}

/**
 * Accoglie o rifiuta. `da` è chi lo fa, da scrivere; con `soloDi` è un
 * istruttore, che lo può fare solo per le sue lezioni. Accolta, l'iscritto è
 * presente nell'appello.
 */
export function gestisciSegnalataProva(id: string, accogli: boolean, da: string, soloDi?: string) {
  const s = tutte().find((x) => x.id === id)
  if (!s) throw new Error('Segnalazione inesistente')
  if (s.stato !== 'da_vedere') throw new Error(`È già stata ${s.stato}`)
  const l = trovaLezione(s.sessioneId)
  if (soloDi && (!l || !comeE(l).istruttori.includes(soloDi))) throw new Error('Non è una tua lezione: la vede la segreteria')
  if (accogli) {
    memoria.segnate = { ...memoria.segnate, [s.sessioneId]: { ...(memoria.segnate[s.sessioneId] ?? {}), [s.personaId]: 'presente' } }
    memoria.salva()
  }
  archivio.dati.segnalate = tutte().map((x) => (x.id === id ? { ...x, stato: accogli ? 'accolta' : 'rifiutata', gestitaIl: new Date().toISOString(), gestitaDa: da } : x))
  archivio.salva()
}
