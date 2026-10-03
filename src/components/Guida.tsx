import { type ReactNode, useEffect, useRef, useState } from 'react'
import { eIndirizzoGuida, esistePagina, INDIRIZZO_GUIDA, leggiPagina, paginaDi, risolvi } from '../lib/guida'
import { Back } from './Icons'
import { useOrdina } from './segreteria/comune'

/**
 * La guida, dentro l'app: una pagina della cartella `guida/` per volta.
 *
 * I file sono Markdown e qui si leggono con un lettore piccolo, fatto per
 * quello che nelle guide si usa davvero — titoli, paragrafi, elenchi anche
 * uno dentro l'altro, tabelle, grassetto, corsivo, codice e collegamenti — e
 * che costruisce gli elementi uno per uno, senza mai mettere HTML preso dal
 * testo nella pagina. Una guida nuova che usa altro va vista qui prima.
 */
export function Guida() {
  const [pagina, setPagina] = useState(() => paginaDi(window.location.hash))
  const [testo, setTesto] = useState<string | null | undefined>(undefined)
  const corpo = useRef<HTMLElement>(null)

  useEffect(() => {
    const cambia = () => eIndirizzoGuida(window.location.hash) && setPagina(paginaDi(window.location.hash))
    window.addEventListener('hashchange', cambia)
    return () => window.removeEventListener('hashchange', cambia)
  }, [])

  useEffect(() => {
    let vivo = true
    setTesto(undefined)
    corpo.current?.scrollTo(0, 0)
    leggiPagina(pagina).then(
      (t) => vivo && setTesto(t),
      () => vivo && setTesto(null),
    )
    return () => {
      vivo = false
    }
  }, [pagina])

  const indietro = () => {
    // Si torna da dove si è venuti: un'altra pagina della guida, o l'app.
    if (window.history.length > 1) window.history.back()
    else window.location.hash = ''
  }

  return (
    <main className="scroll" ref={corpo}>
      <div className="pad row" style={{ gap: 10, paddingTop: 14 }}>
        <button type="button" className="icon-btn" aria-label="Indietro" onClick={indietro}>
          <Back />
        </button>
        <span className="grow" />
        {pagina !== '' && (
          <a className="btn btn-ghost" style={{ minHeight: 40, padding: '0 14px', fontSize: 14 }} href={INDIRIZZO_GUIDA}>
            GUIDA GENERALE
          </a>
        )}
      </div>
      <article className="pad guida">
        {testo === undefined && <p className="passo-dettaglio">Un attimo…</p>}
        {testo === null && (
          <>
            <h1>PAGINA NON TROVATA</h1>
            <p>
              {esistePagina(pagina) ? 'Questa pagina non si legge: riprova fra poco.' : 'Questa pagina della guida non c’è.'}{' '}
              <a href={INDIRIZZO_GUIDA}>Vai alla guida generale</a>.
            </p>
          </>
        )}
        {testo && blocchi(righe(testo), pagina)}
      </article>
    </main>
  )
}

// ---------------------------------------------------------------------------
// Il lettore di Markdown.
// ---------------------------------------------------------------------------

const righe = (t: string) => t.replace(/\r\n?/g, '\n').split('\n')

const rientro = (r: string) => r.length - r.trimStart().length
const vuota = (r: string) => r.trim() === ''
const MARCA = /^(\s*)([-*]|\d+\.)\s+/
const eTabella = (r: string) => r.trimStart().startsWith('|')

/** Le righe di un blocco, trasformate in elementi. */
function blocchi(rr: string[], pagina: string): ReactNode[] {
  const fuori: ReactNode[] = []
  let i = 0
  while (i < rr.length) {
    const r = rr[i]
    if (vuota(r)) {
      i++
      continue
    }

    const titolo = /^(#{1,4})\s+(.*)$/.exec(r)
    if (titolo) {
      const Liv = `h${titolo[1].length}` as 'h1'
      fuori.push(<Liv key={i}>{linea(titolo[2], pagina)}</Liv>)
      i++
      continue
    }

    if (eTabella(r)) {
      const inizio = i
      while (i < rr.length && eTabella(rr[i])) i++
      fuori.push(<Tabella key={inizio} rr={rr.slice(inizio, i)} pagina={pagina} />)
      continue
    }

    const marca = MARCA.exec(r)
    if (marca) {
      // L'elenco va avanti finché le righe sono voci, o il seguito rientrato
      // di una voce; una riga vuota lo chiude solo se dopo non c'è una voce.
      const base = marca[1].length
      const inizio = i
      i++
      while (i < rr.length) {
        if (vuota(rr[i])) {
          const dopo = rr.slice(i).find((x) => !vuota(x))
          if (!dopo || (rientro(dopo) <= base && !MARCA.test(dopo))) break
          i++
          continue
        }
        if (rientro(rr[i]) <= base && !MARCA.test(rr[i])) break
        i++
      }
      fuori.push(<Elenco key={inizio} rr={rr.slice(inizio, i)} base={base} pagina={pagina} />)
      continue
    }

    const inizio = i
    while (i < rr.length && !vuota(rr[i]) && !/^#{1,4}\s/.test(rr[i]) && !eTabella(rr[i]) && !MARCA.test(rr[i])) i++
    fuori.push(<p key={inizio}>{linea(rr.slice(inizio, i).map((x) => x.trim()).join(' '), pagina)}</p>)
  }
  return fuori
}

function Elenco({ rr, base, pagina }: { rr: string[]; base: number; pagina: string }) {
  const voci: string[][] = []
  for (const r of rr) {
    const m = MARCA.exec(r)
    if (m && m[1].length === base) voci.push([r.slice(m[0].length)])
    else voci.at(-1)?.push(r)
  }
  const numerato = /\d/.test(MARCA.exec(rr[0])![2])
  const Tag = numerato ? 'ol' : 'ul'
  return (
    <Tag>
      {voci.map(([prima, ...resto], k) => {
        // Il seguito di una voce perde il rientro della voce, e si legge
        // come un blocco a sé: un paragrafo, o un elenco dentro l'elenco.
        const dentro = Math.min(...resto.filter((x) => !vuota(x)).map(rientro), Infinity)
        const parti = blocchi([prima, ...resto.map((x) => x.slice(Number.isFinite(dentro) ? dentro : 0))], pagina)
        // Una voce di un paragrafo solo non si chiude in un <p>: resta stretta.
        const sola = parti.length === 1 ? (parti[0] as { props?: { children?: ReactNode }; type?: unknown }) : null
        return <li key={k}>{sola?.type === 'p' ? sola.props?.children : parti}</li>
      })}
    </Tag>
  )
}

function Tabella({ rr, pagina }: { rr: string[]; pagina: string }) {
  const celle = (r: string) =>
    r
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((c) => c.trim())
  const separa = rr.length > 1 && /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(rr[1])
  const testa = separa ? celle(rr[0]) : null
  const allinea = separa ? celle(rr[1]).map((c) => (c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : undefined)) : []
  const corpo = (separa ? rr.slice(2) : rr).map(celle)
  const vuoteInTesta = !!testa && testa.every((c) => !c)
  // Si ordina per il testo che si legge, senza i segni del Markdown.
  const { ordina, colonna } = useOrdina<string[], string>(
    Object.fromEntries((testa ?? []).map((_, k) => [String(k), (riga: string[]) => testoDi(riga[k] ?? '')])),
  )
  return (
    <div className="guida-tabella">
      <table>
        {testa && !vuoteInTesta && (
          <thead>
            <tr>
              {testa.map((c, k) =>
                // Non si ordina una colonna senza nome (non si saprebbe cosa si
                // tocca), né una con lo stesso testo in ogni riga, come «Apri».
                c && new Set(corpo.map((riga) => testoDi(riga[k] ?? ''))).size > 1 ? (
                  colonna(String(k), linea(c, pagina), { th: true, className: '', destra: allinea[k] === 'right' })
                ) : (
                  <th key={k} style={{ textAlign: allinea[k] }}>
                    {linea(c, pagina)}
                  </th>
                ),
              )}
            </tr>
          </thead>
        )}
        <tbody>
          {ordina(corpo).map((riga, j) => (
            <tr key={j}>
              {riga.map((c, k) => (
                <td key={k} style={{ textAlign: allinea[k] }}>
                  {linea(c, pagina)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Il testo di una cella come si legge: `codice`, **grassetto** e [collegamenti](x.md) senza i segni. */
const testoDi = (t: string) => t.replace(PEZZI, (_, codice, grassetto, corsivo, testo, _href, auto) => codice ?? grassetto ?? corsivo ?? testo ?? auto ?? '').replace(/\*\*|\*/g, '')

/**
 * Il testo dentro una riga: `codice`, **grassetto**, *corsivo*,
 * [collegamenti](file.md) e <https://indirizzi>. Il codice viene prima di
 * tutto, perché dentro non vale altro.
 */
const PEZZI = /`([^`]+)`|\*\*(.+?)\*\*|\*([^*\s][^*]*?)\*|\[([^\]]+)\]\(([^)\s]+)\)|<(https?:\/\/[^>\s]+)>/g

function linea(t: string, pagina: string): ReactNode[] {
  const fuori: ReactNode[] = []
  let ultimo = 0
  for (const m of t.matchAll(PEZZI)) {
    const k = m.index!
    if (k > ultimo) fuori.push(t.slice(ultimo, k))
    const [, codice, grassetto, corsivo, testo, href, auto] = m
    if (codice !== undefined) fuori.push(<code key={k}>{codice}</code>)
    else if (grassetto !== undefined) fuori.push(<strong key={k}>{linea(grassetto, pagina)}</strong>)
    else if (corsivo !== undefined) fuori.push(<em key={k}>{linea(corsivo, pagina)}</em>)
    else fuori.push(<Collegamento key={k} href={href ?? auto} pagina={pagina}>{testo !== undefined ? linea(testo, pagina) : auto}</Collegamento>)
    ultimo = k + m[0].length
  }
  if (ultimo < t.length) fuori.push(t.slice(ultimo))
  return fuori
}

function Collegamento({ href, pagina, children }: { href: string; pagina: string; children: ReactNode }) {
  const dove = risolvi(href, pagina)
  return dove.esterno ? (
    <a href={dove.href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ) : (
    <a href={dove.href}>{children}</a>
  )
}
