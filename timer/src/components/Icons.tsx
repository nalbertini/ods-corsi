type P = { size?: number }
const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
})

export const Play = ({ size = 20 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <polygon points="6 3 21 12 6 21 6 3" />
  </svg>
)

export const Pause = ({ size = 20 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <rect x="6" y="4" width="4" height="16" />
    <rect x="14" y="4" width="4" height="16" />
  </svg>
)

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

export const Close = ({ size = 18 }: P) => (
  <svg {...base(size)} strokeWidth={2.5} aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

export const Back = ({ size = 18 }: P) => (
  <svg {...base(size)} strokeWidth={2.5} aria-hidden="true">
    <polyline points="15 18 9 12 15 6" />
  </svg>
)

export const Plus = ({ size = 18 }: P) => (
  <svg {...base(size)} strokeWidth={2.5} aria-hidden="true">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

export const Minus = ({ size = 18 }: P) => (
  <svg {...base(size)} strokeWidth={3} aria-hidden="true">
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

export const Chevron = ({ size = 16 }: P) => (
  <svg {...base(size)} strokeWidth={2.5} aria-hidden="true">
    <polyline points="9 6 15 12 9 18" />
  </svg>
)

export const Trash = ({ size = 18 }: P) => (
  <svg {...base(size)} aria-hidden="true">
    <polyline points="3 6 21 6" />
    <path d="M19 6l-1 14H6L5 6" />
    <path d="M10 11v5M14 11v5" />
    <path d="M9 6V4h6v2" />
  </svg>
)

export const Copy = ({ size = 18 }: P) => (
  <svg {...base(size)} aria-hidden="true">
    <rect x="9" y="9" width="12" height="12" />
    <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
  </svg>
)

export const Gear = ({ size = 20 }: P) => (
  <svg {...base(size)} aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)

export const TimerIcon = ({ size = 22 }: P) => (
  <svg {...base(size)} aria-hidden="true">
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l2 2" />
    <path d="M9 2h6" />
  </svg>
)

export const Library = ({ size = 22 }: P) => (
  <svg {...base(size)} aria-hidden="true">
    <path d="M4 4h5v16H4z" />
    <path d="M11 4h4v16h-4z" />
    <path d="M17 5l3 15" />
  </svg>
)

export const History = ({ size = 22 }: P) => (
  <svg {...base(size)} aria-hidden="true">
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5" />
    <path d="M12 8v4l3 2" />
  </svg>
)

/** Il cronometro: la corona sopra è quella del pulsante, il taglio è il quadrante. */
export const Crono = ({ size = 22 }: P) => (
  <svg {...base(size)} aria-hidden="true">
    <circle cx="12" cy="13.5" r="7.5" />
    <path d="M12 10v3.5h2.5" />
    <path d="M9.5 2.5h5" />
    <path d="M18.5 6.5l1.5-1.5" />
  </svg>
)

/** Una clessidra: il conto alla rovescia. */
export const Clessidra = ({ size = 22 }: P) => (
  <svg {...base(size)} aria-hidden="true">
    <path d="M6 3h12" />
    <path d="M6 21h12" />
    <path d="M7 3c0 4 5 5 5 9s-5 5-5 9" />
    <path d="M17 3c0 4-5 5-5 9s5 5 5 9" />
  </svg>
)

export const Drag = ({ size = 16 }: P) => (
  <svg {...base(size)} aria-hidden="true">
    <line x1="4" y1="8" x2="20" y2="8" />
    <line x1="4" y1="16" x2="20" y2="16" />
  </svg>
)

export const Edit = ({ size = 18 }: P) => (
  <svg {...base(size)} aria-hidden="true">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
  </svg>
)

/** Un manubrio: la sezione degli esercizi. */
export const Dumbbell = ({ size = 22 }: P) => (
  <svg {...base(size)} aria-hidden="true">
    <path d="M3 9v6" />
    <path d="M6 6v12" />
    <path d="M18 6v12" />
    <path d="M21 9v6" />
    <path d="M6 12h12" />
  </svg>
)

/** Freccetta per spostare una riga su o giù nell'elenco. */
export const Caret = ({ size = 14, verso = 'su' }: P & { verso?: 'su' | 'giu' }) => (
  <svg {...base(size)} strokeWidth={2.5} aria-hidden="true">
    <polyline points={verso === 'su' ? '6 15 12 9 18 15' : '6 9 12 15 18 9'} />
  </svg>
)

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
