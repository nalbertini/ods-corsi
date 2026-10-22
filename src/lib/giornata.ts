import type { LezioneSeg, Sala } from './segreteria'

/**
 * Il tabellone sale × ore di OGGI: una colonna per sala, le lezioni come
 * blocchi con la posizione già in pixel. Il disegno sta nel componente; qui
 * stanno le regole, così si provano senza browser.
 */
export type StatoBlocco = 'fatto' | 'in_corso' | 'appello_non_fatto' | 'prossima' | 'annullata'

export interface Blocco {
  lezione: LezioneSeg
  stato: StatoBlocco
  top: number
  altezza: number
}

export interface Colonna {
  /** `null`: le lezioni senza una sala che si conosce. */
  sala: Sala | null
  blocchi: Blocco[]
}

export interface Tabellone {
  dalleOre: number
  alleOre: number
  colonne: Colonna[]
  /** Dove sta la riga rossa dell'ora, in pixel; `null` fuori dalla fascia. */
  adesso: number | null
}

/** La fascia di partenza e l'altezza di un'ora, in pixel: una volta sola, qui e nel tabellone. */
export const FASCIA = { dalleOre: 16, alleOre: 21 }
export const ORA_PX = 96

const minuti = (d: Date) => d.getHours() * 60 + d.getMinutes()

/** Come DA FARE: fine passata, non annullata e nessun segno = appello non fatto. */
function statoDi(l: LezioneSeg, adesso: Date): StatoBlocco {
  if (l.stato === 'annullata') return 'annullata'
  if (Date.parse(l.fine) < adesso.getTime()) return l.segnati === 0 ? 'appello_non_fatto' : 'fatto'
  return Date.parse(l.inizio) <= adesso.getTime() ? 'in_corso' : 'prossima'
}

export function tabellone(lezioni: LezioneSeg[], sale: Sala[], adesso: Date, o: { dalleOre?: number; alleOre?: number; oraPx?: number } = {}): Tabellone {
  const dalleOre = o.dalleOre ?? FASCIA.dalleOre
  const alleOre = o.alleOre ?? FASCIA.alleOre
  const oraPx = o.oraPx ?? ORA_PX
  const px = (min: number) => ((min - dalleOre * 60) / 60) * oraPx
  const blocco = (l: LezioneSeg): Blocco => {
    const inizio = new Date(l.inizio)
    const durata = (Date.parse(l.fine) - Date.parse(l.inizio)) / 60_000
    // Fuori fascia la lezione resta, con la posizione vera (anche negativa): non si perde di vista.
    return { lezione: l, stato: statoDi(l, adesso), top: px(minuti(inizio)), altezza: (durata / 60) * oraPx }
  }
  const perInizio = (a: LezioneSeg, b: LezioneSeg) => a.inizio.localeCompare(b.inizio)
  const conosciute = new Set(sale.map((s) => s.id))
  const colonne: Colonna[] = sale.map((sala) => ({ sala, blocchi: lezioni.filter((l) => l.salaId === sala.id).sort(perInizio).map(blocco) }))
  const orfane = lezioni.filter((l) => !l.salaId || !conosciute.has(l.salaId)).sort(perInizio)
  if (orfane.length) colonne.push({ sala: null, blocchi: orfane.map(blocco) })
  const ora = minuti(adesso)
  return { dalleOre, alleOre, colonne, adesso: ora >= dalleOre * 60 && ora <= alleOre * 60 ? px(ora) : null }
}

/**
 * Le ore che il tabellone mostra: 16–21, allargate da una lezione che sta
 * fuori, così non esce dalla griglia. Una lezione che finisce a mezzanotte
 * finisce «il giorno dopo»: l'ora locale è 0, ma per la fascia vale 24.
 */
export function fasciaDelleLezioni(lezioni: LezioneSeg[], base = FASCIA): { dalleOre: number; alleOre: number } {
  let { dalleOre, alleOre } = base
  for (const l of lezioni) {
    const inizio = new Date(l.inizio)
    const fine = new Date(l.fine)
    dalleOre = Math.min(dalleOre, inizio.getHours())
    const oreFine = fine.toDateString() === inizio.toDateString() ? fine.getHours() + fine.getMinutes() / 60 : 24
    alleOre = Math.max(alleOre, Math.ceil(oreFine))
  }
  return { dalleOre, alleOre }
}

/** Quanti ci sono, quanti ne aspettiamo e quanti appelli mancano, sulle lezioni non annullate: stessa regola dei blocchi. */
/**
 * La riga sotto OGGI: la data, le lezioni, gli appelli da fare e i presenti. I presenti stanno qui e non fra le cifre,
 * che dicono solo cose da sistemare. `r` nullo: le lezioni non si sono ancora lette, e si dice solo la data.
 */
export function sottotitoloOggi(data: string, lezioni: number, r: ReturnType<typeof riepilogoGiornata> | null): string {
  if (!r) return `${data}.`
  if (lezioni === 0) return `${data} · nessuna lezione.`
  const appelli = r.appelliDaFare === 0 ? '' : r.appelliDaFare === 1 ? ', 1 appello da fare' : `, ${r.appelliDaFare} appelli da fare`
  return `${data} · ${lezioni === 1 ? '1 lezione' : `${lezioni} lezioni`}${appelli} · ${r.presenti} presenti su ${r.attesi} attesi.`
}

export function riepilogoGiornata(lezioni: LezioneSeg[], adesso: Date): { presenti: number; attesi: number; appelliDaFare: number } {
  const valide = lezioni.filter((l) => l.stato !== 'annullata')
  return {
    presenti: valide.reduce((n, l) => n + l.presenti, 0),
    attesi: valide.reduce((n, l) => n + l.iscritti, 0),
    appelliDaFare: valide.filter((l) => statoDi(l, adesso) === 'appello_non_fatto').length,
  }
}
