// Le icone del timer vengono dall'elenco unico dell'app (src/lib/icone): solo i dati, perché il
// timer ha il suo React. Prev, Next e Share non hanno ancora un nome lì e restano disegnate qui.
import { ICONE, TRATTO, type NomeIcona } from '../../../src/lib/icone'

type P = { size?: number }
const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: TRATTO,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
})

const svg = (nome: NomeIcona, size: number) => (
  <svg {...base(size)} aria-hidden="true">
    {ICONE[nome].map((d) => <path key={d} d={d} />)}
  </svg>
)
const disegna =
  (nome: NomeIcona, misura: number) =>
  ({ size = misura }: P) =>
    svg(nome, size)

export const Play = disegna('play', 20)
export const Pause = disegna('pausa', 20)
export const Close = disegna('chiudi', 18)
export const Back = disegna('indietro', 18)
export const Plus = disegna('aggiungi', 18)
export const Minus = disegna('meno', 18)
export const Chevron = disegna('avanti', 16)
export const Trash = disegna('elimina', 18)
export const Copy = disegna('copia', 18)
export const Gear = disegna('impostazioni', 20)
export const TimerIcon = disegna('cronometro', 22)
export const Edit = disegna('modifica', 18)
const Su = disegna('crescente', 14)
const Giu = disegna('decrescente', 14)

export const Prev = ({ size = 22 }: P) => (
  <svg {...base(size)} aria-hidden="true">
    <polygon points="19 20 9 12 19 4 19 20" />
    <line x1="5" y1="19" x2="5" y2="5" />
  </svg>
)

export const Next = ({ size = 22 }: P) => (
  <svg {...base(size)} aria-hidden="true">
    <polygon points="5 4 15 12 5 20 5 4" />
    <line x1="19" y1="5" x2="19" y2="19" />
  </svg>
)

/** Freccetta per spostare una riga su o giù nell'elenco. */
export const Caret = ({ size = 14, verso = 'su' }: P & { verso?: 'su' | 'giu' }) => (verso === 'su' ? <Su size={size} /> : <Giu size={size} />)

/** Mandare un allenamento a un altro dispositivo: il QR è la strada corta. */
export const Share = ({ size = 18 }: P) => (
  <svg {...base(size)} aria-hidden="true">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
    <path d="M14 14h3v3h-3z" />
    <path d="M20 14v3M17 20h4M14 20v1" />
  </svg>
)

/** Un'icona dell'elenco unico per nome, accanto alla parola di un tasto o di un titolo. */
export const Icona = ({ nome, size = 18 }: P & { nome: NomeIcona }) => svg(nome, size)
