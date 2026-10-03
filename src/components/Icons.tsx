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

export const Persone = ({ size = 20 }: P) => (
  <svg {...base(size)} aria-hidden="true">
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
    <circle cx="17" cy="9" r="2.8" />
    <path d="M17 14c2.8 0 4.8 2 4.8 5" />
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

export const Sole = ({ size = 20 }: P) => (
  <svg {...base(size)} aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
)

export const Luna = ({ size = 20 }: P) => (
  <svg {...base(size)} aria-hidden="true">
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
)
