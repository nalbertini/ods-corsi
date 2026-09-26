export const pad = (n: number) => String(Math.max(0, Math.floor(n))).padStart(2, '0')

/** mm:ss, oppure h:mm:ss oltre l'ora. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}

/** Forma compatta per le liste: 12:30, 1h05. */
export function compact(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  if (s >= 3600) return `${Math.floor(s / 3600)}h${pad(Math.floor((s % 3600) / 60))}`
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`
}

export const uid = () => Math.random().toString(36).slice(2, 10)
