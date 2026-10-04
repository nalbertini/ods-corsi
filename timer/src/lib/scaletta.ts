import type { Segment, SegmentKind } from '../types'

/** Una riga della scaletta: un passo dell'allenamento, il primo è quello in corso. */
export interface RigaScaletta {
  kind: SegmentKind
  nome: string
  durata: number
  corrente: boolean
}

/** Un blocco della linea del tempo, largo quanto la durata del passo. */
export interface BloccoLinea {
  kind: SegmentKind
  durata: number
  /** Quanto del passo è già passato, da 0 a 1. */
  riempito: number
}

/**
 * Il giro in più che Maurizio si inventa (`extra`) è una sorpresa: non si
 * mostra fra i prossimi passi e non sposta la linea. Si controlla con
 * `!== undefined` perché `extra` è l'indice di una frase, e lo zero è valido.
 */
const eExtra = (s: Segment) => s.extra !== undefined

/**
 * Le righe da mostrare: il passo in corso e i successivi, mai quelli già fatti.
 * `massimo` conta anche il corrente; i successivi che non entrano diventano
 * `altri`, con il tempo che portano via.
 */
export function righeScaletta(
  segments: Segment[],
  indice: number,
  massimo: number,
): { righe: RigaScaletta[]; altri: number; altriSecondi: number } {
  const dal = Math.max(indice, 0)
  if (dal >= segments.length) return { righe: [], altri: 0, altriSecondi: 0 }
  const tutti = [segments[dal], ...segments.slice(dal + 1).filter((s) => !eExtra(s))]
  const mostrati = tutti.slice(0, Math.max(massimo, 0))
  const restano = tutti.slice(mostrati.length)
  return {
    righe: mostrati.map((s, i) => ({
      kind: s.kind,
      nome: s.kind === 'work' && s.name ? s.name : s.label,
      durata: s.duration,
      corrente: i === 0,
    })),
    altri: restano.length,
    altriSecondi: restano.reduce((somma, s) => somma + s.duration, 0),
  }
}

/** Un blocco per passo: i fatti pieni, quello in corso a `progresso`, i prossimi vuoti. */
export function lineaDelTempo(segments: Segment[], indice: number, progresso: number): BloccoLinea[] {
  const quanto = Math.min(1, Math.max(0, progresso))
  const blocchi: BloccoLinea[] = []
  segments.forEach((s, i) => {
    if (eExtra(s)) return
    const riempito = i < indice ? 1 : i === indice ? quanto : 0
    blocchi.push({ kind: s.kind, durata: s.duration, riempito })
  })
  return blocchi
}

/** «GIRO 3 / 8»: nei preparati il giro è il primo. */
export function giroCorrente(seg: Segment | null): string {
  return seg ? `${seg.round || 1} / ${seg.rounds}` : '—'
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** A che ora finisce l'allenamento, se continua da adesso: ore e minuti, senza arrotondare. */
export function oraDiFine(adesso: number, restanti: number): string {
  const d = new Date(adesso + restanti * 1000)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/**
 * Quante righe di scaletta entrano. Le tre domande sono media query della
 * schermata: `poco` vale per un telefono girato di lato e per uno schermo
 * basso in verticale, dove la scaletta non c'è e resta la barra in fondo.
 */
export function righeDaMostrare({ verticale, poco, alto }: { verticale: boolean; poco: boolean; alto: boolean }): number {
  if (poco) return 0
  // In verticale il posto che avanza è di Maurizio, non di altre righe.
  if (verticale) return 2
  return alto ? 5 : 3
}
