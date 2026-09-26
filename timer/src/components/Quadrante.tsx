/**
 * I due pezzi del quadrante, condivisi da tutto ciò che conta il tempo.
 *
 * Stavano dentro la schermata dell'allenamento, e cronometro e conto alla
 * rovescia si erano costruiti i loro: tre schermate che contano il tempo e
 * tre impaginazioni diverse. Da qui in poi l'anello è un anello solo e le
 * cifre sono le stesse cifre.
 */

export function Ring({ progress, color }: { progress: number; color: string }) {
  const r = 43
  const circumference = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="9" strokeDasharray="9 10.4" />
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="9"
        strokeDasharray={`${(circumference * progress).toFixed(2)} ${circumference.toFixed(2)}`}
      />
    </svg>
  )
}

/**
 * Ogni cifra occupa esattamente la larghezza dello zero del font corrente (1ch).
 * `tabular-nums` da solo non basta: vale solo se il font espone la feature
 * `tnum`, altrimenti i numeri cambiano larghezza a ogni secondo e il blocco,
 * essendo centrato, balla da destra a sinistra.
 */
export function Digits({ value, className = 'digits' }: { value: string; className?: string }) {
  return (
    <div className={className} role="timer" aria-label={value}>
      {value.split('').map((ch, i) =>
        ch >= '0' && ch <= '9' ? (
          <span key={i} aria-hidden="true" style={{ display: 'inline-block', width: '1ch', textAlign: 'center' }}>
            {ch}
          </span>
        ) : (
          <span key={i} aria-hidden="true">
            {ch}
          </span>
        ),
      )}
    </div>
  )
}

/**
 * Le tre scritte dentro l'anello: un'etichetta, un numero grande, una riga
 * sotto. È la stessa forma per tutti — «GIRO 2/8, resta 12:59» nel timer,
 * il giro in corso nel cronometro, il totale nel conto alla rovescia.
 */
export function DentroAnello({
  etichetta,
  numero,
  sotto,
  colore,
}: {
  etichetta: string
  numero: string
  sotto?: string
  colore: string
}) {
  return (
    <div
      className="stack"
      style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', gap: 2 }}
    >
      <span className="cond anello-etichetta">{etichetta}</span>
      <span className="num anello-giro" style={{ color: colore }}>
        {numero}
      </span>
      {sotto && <span className="cond anello-etichetta anello-resta">{sotto}</span>}
    </div>
  )
}
