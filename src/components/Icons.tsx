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
