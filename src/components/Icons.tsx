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

export const Back = ({ size = 18 }: P) => (
  <svg {...base(size)} strokeWidth={2.5} aria-hidden="true">
    <polyline points="15 18 9 12 15 6" />
  </svg>
)

export const Recupero = ({ size = 20 }: P) => (
  <svg {...base(size)} aria-hidden="true">
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <polyline points="3 4 3 9 8 9" />
    <polyline points="12 7 12 12 15 14" />
  </svg>
)

export const Lucchetto = ({ size = 20 }: P) => (
  <svg {...base(size)} aria-hidden="true">
    <rect x="5" y="11" width="14" height="10" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
)

export const Cronometro = ({ size = 20 }: P) => (
  <svg {...base(size)} aria-hidden="true">
    <circle cx="12" cy="13" r="8" />
    <polyline points="12 9 12 13 15 15" />
    <line x1="10" y1="2" x2="14" y2="2" />
  </svg>
)

export const Spunta = ({ size = 24 }: P) => (
  <svg {...base(size)} strokeWidth={3} aria-hidden="true">
    <polyline points="4 12 10 18 20 6" />
  </svg>
)

export const Croce = ({ size = 20 }: P) => (
  <svg {...base(size)} strokeWidth={3} aria-hidden="true">
    <line x1="5" y1="5" x2="19" y2="19" />
    <line x1="19" y1="5" x2="5" y2="19" />
  </svg>
)
