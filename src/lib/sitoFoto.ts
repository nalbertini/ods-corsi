/**
 * Dove stanno le persone in ogni foto del sito: un punto `x, y` in percentuale (come `object-position`).
 *
 * Le foto sono ritagliate (`object-fit:cover`) in riquadri di forme diverse, sul computer e sul telefono:
 * il punto resta dentro il ritaglio, così non si perdono teste e mani. È per foto, non per riquadro, e vale
 * in ogni pagina. Lo sceglie la segreteria (SITO › Immagini) e sta nel database (`sito_punti`,
 * 138-sito-punti.sql); una foto senza punto resta col ritaglio del suo riquadro.
 */
export interface Punto {
  x: number
  y: number
}

/** Il nome di un file del contenitore «sito» (58-sito-immagini.sql): solo questi entrano nel CSS, tra virgolette. */
const NOME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/

/** Il messaggio quando un punto non è buono: in pratica succede solo se la pagina è rimasta indietro. */
export const PUNTO_FUORI = 'Il punto deve stare dentro la foto: spostalo e salva di nuovo.'

/** Il messaggio quando il nome non è di una foto del contenitore: la pagina mostra una foto che non c'è più. */
export const FOTO_NON_DEL_SITO = 'Questa foto non è più nel sito: ricarica la pagina.'

/** Vero se è il nome di un file del contenitore, lo stesso controllo della tabella `sito_punti`. */
export const nomeValido = (nome: string) => NOME.test(nome)

const dentro = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 100

/** Vero se è un punto che il database accetta: due interi da 0 a 100. */
export function puntoValido(p: unknown): p is Punto {
  return typeof p === 'object' && p !== null && 'x' in p && 'y' in p && dentro(p.x) && dentro(p.y)
}

/**
 * Le regole CSS dei punti, una per foto. `!important` perché i riquadri hanno il loro ritaglio (testata, fila,
 * ritratto) e il punto della foto deve vincere su tutti. Un nome o un punto strani si saltano.
 * `*=` e non `$=`: le foto escono da /render/image, con `?width=…` dopo il nome.
 */
export function cssPunti(punti: Record<string, Punto>): string {
  return Object.entries(punti)
    .filter(([nome, p]) => NOME.test(nome) && puntoValido(p))
    .map(([nome, p]) => `img[src*="${nome}"]{object-position:${p.x}% ${p.y}%!important}`)
    .join('\n')
}

const limita = (n: number) => Math.min(100, Math.max(0, Math.round(n)))

/** Il punto dove si è cliccato (o trascinato) sulla foto, in percentuale; fuori dalla foto finisce sul bordo. */
export function puntoDaClic(cx: number, cy: number, r: { left: number; top: number; width: number; height: number }): Punto {
  return { x: limita(((cx - r.left) / r.width) * 100), y: limita(((cy - r.top) / r.height) * 100) }
}

const FRECCE: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }

/** Il punto spostato da una freccia (di 1, di 10 con `grande`); `null` per ogni altro tasto. */
export function spostaPunto(p: Punto, tasto: string, grande = false): Punto | null {
  const f = FRECCE[tasto]
  if (!f) return null
  const passo = grande ? 10 : 1
  return { x: limita(p.x + f[0] * passo), y: limita(p.y + f[1] * passo) }
}

/** Le righe di `sito_punti_pubblici()` come servono al generatore; quelle fuori forma si saltano. */
export function puntiDaRighe(righe: unknown[]): Record<string, Punto> {
  const punti: Record<string, Punto> = {}
  for (const r of righe) {
    if (typeof r !== 'object' || r === null) continue
    const { nome, x, y } = r as { nome?: unknown; x?: unknown; y?: unknown } // le righe arrivano dal database senza tipo
    if (typeof nome === 'string' && NOME.test(nome) && dentro(x) && dentro(y)) punti[nome] = { x, y }
  }
  return punti
}
