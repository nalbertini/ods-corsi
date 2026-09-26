/**
 * Il marchio a ingranaggi, ridisegnato in SVG senza i pittogrammi interni:
 * sotto i 60px sarebbero macchie. Da sostituire con il file originale del logo.
 */
export function Logo({ width = 58 }: { width?: number }) {
  const gears: Array<[number, number, string]> = [
    [38, 40, '#1b8ac4'],
    // L'ingranaggio bianco è il colore del testo: sul tema bianco diventa nero.
    [80, 40, 'var(--text)'],
    [122, 40, '#e4292a'],
    [59, 74, '#f4c31b'],
    [101, 74, '#16a54a'],
  ]
  return (
    <svg width={width} height={(width / 160) * 110} viewBox="0 0 160 110" role="img" aria-label="Officine Dello Sport">
      <g fill="none" strokeWidth="9" strokeDasharray="6 7.82">
        {gears.map(([cx, cy, c]) => (
          <circle key={`t${cx}${cy}`} cx={cx} cy={cy} r="22" stroke={c} />
        ))}
      </g>
      <g fill="none" strokeWidth="5">
        {gears.map(([cx, cy, c]) => (
          <circle key={`i${cx}${cy}`} cx={cx} cy={cy} r="14" stroke={c} />
        ))}
      </g>
    </svg>
  )
}
