import { significato } from '../lib/kanji'

/**
 * Il kanji di un istruttore come un timbro: il segno rosso in un quadrato
 * rosso, come l'hanko con cui in Giappone si firma. Con più istruttori, un
 * timbro per ciascuno. Senza kanji non c'è niente.
 */
export function Kanji({ segni, grande }: { segni?: string; grande?: boolean }) {
  if (!segni) return null
  return (
    <span className="kanji-fila" aria-hidden="true">
      {Array.from(segni).map((s, i) => (
        <span key={i} className="kanji" data-grande={grande || undefined} title={significato(s)}>
          {s}
        </span>
      ))}
    </span>
  )
}
