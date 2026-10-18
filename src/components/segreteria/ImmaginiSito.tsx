import { useRef, useState } from 'react'
import type { DatiSegreteria } from '../../lib/segreteria'
import { controllaAlt, MASSIMO_BYTE, pagineCheUsano, pulisciAlt, TIPI_AMMESSI, type ImmagineSito } from '../../lib/sitoImmagini'
import type { PaginaSito } from '../../lib/sitoPagine'
import { Campo, Guaio, useAvviso, useCarica, useDialogo } from './comune'

/**
 * Le immagini delle pagine del sito: la libreria (SITO › IMMAGINI) e il pannello
 * che l'editor apre per metterne una nel testo. Le regole (tipi, peso, nome,
 * testo alternativo, in quali pagine è usata) stanno in `sitoImmagini.ts`.
 */

const DISCO = TIPI_AMMESSI.join(',')

/** Il tasto che sceglie dei file e li carica uno dopo l'altro; `dopo` rilegge l'elenco. */
function CaricaImmagini({ d, dopo, tratteggiato }: { d: DatiSegreteria; dopo: (nuove: ImmagineSito[]) => unknown; tratteggiato?: boolean }) {
  const campo = useRef<HTMLInputElement>(null)
  const { avviso, fai, lavora } = useAvviso()
  const manda = async (files: FileList | null) => {
    if (!files?.length) return
    const nuove: ImmagineSito[] = []
    await fai(
      async () => {
        try {
          for (const f of Array.from(files)) nuove.push(await d.caricaImmagineSito(f))
        } catch (e) {
          // Quelle già partite restano: l'elenco le deve vedere anche se una è stata rifiutata.
          if (nuove.length) await dopo(nuove)
          throw e
        }
      },
      files.length === 1 ? 'Immagine caricata' : 'Immagini caricate',
      () => dopo(nuove),
    )
    if (campo.current) campo.current.value = ''
  }
  return (
    <>
      <input ref={campo} type="file" accept={DISCO} multiple hidden aria-label="Scegli le immagini da caricare" onChange={(e) => void manda(e.target.files)} />
      <button type="button" className={tratteggiato ? 'sg-btn sg-btn-tratteggio' : 'sg-btn sg-btn-pieno'} disabled={lavora} onClick={() => campo.current?.click()}>
        {lavora ? 'CARICO…' : tratteggiato ? '+ CARICA UN’IMMAGINE NUOVA' : 'CARICA UN’IMMAGINE'}
      </button>
      {avviso}
    </>
  )
}

/** SITO › IMMAGINI: quelle caricate, dove sono usate, e il tasto per toglierle (solo se nessuna pagina le usa). */
export function Immagini({ d, pagine }: { d: DatiSegreteria; pagine: PaginaSito[] }) {
  const elenco = useCarica(() => d.sitoImmagini(), [d])
  const { avviso, fai, lavora } = useAvviso()
  if (elenco.guaio) return <Guaio testo={elenco.guaio} />
  if (!elenco.dato) return <span className="sg-sotto">Leggo le immagini…</span>
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <CaricaImmagini d={d} dopo={() => elenco.ricarica()} />
        <span className="sg-sotto">Vanno bene JPEG, PNG e WebP, fino a {MASSIMO_BYTE / 1_048_576} MB: le foto grandi si rimpiccioliscono da sole.</span>
      </div>
      <div className="sg-riquadro" data-tono="prova">
        <span className="sg-riquadro-titolo">Niente foto di persone senza il permesso</span>
        <span className="sg-sotto">Vale soprattutto per i minorenni: serve il consenso scritto di chi è nella foto o dei genitori. Le immagini sono pubbliche: chi conosce l’indirizzo le vede anche se la pagina è nascosta.</span>
      </div>
      {elenco.dato.length === 0 ? (
        <span className="sg-sotto">Non c’è ancora nessuna immagine.</span>
      ) : (
        <ul className="sito-immagini">
          {elenco.dato.map((im) => {
            const usata = pagineCheUsano(im.url, pagine)
            return (
              <li key={im.nome} className="sito-immagine">
                <img src={im.url} alt="" loading="lazy" />
                <span className="sg-sotto">{usata.length ? `Usata in: ${usata.join(', ')}` : 'Non è usata in nessuna pagina'}</span>
                {usata.length ? (
                  <span className="sg-tag">IN USO: NON SI CANCELLA</span>
                ) : (
                  <button type="button" className="sg-chip num" disabled={lavora} onClick={() => void fai(() => d.cancellaImmagineSito(im.nome), 'Immagine tolta', () => elenco.ricarica())}>
                    TOGLI
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {avviso}
    </div>
  )
}

/** Il pannello dell'editor: si sceglie un'immagine, si scrive cosa si vede (o si dice che è solo decorativa) e si inserisce. */
/** `perFoto`: la scelta è per un pezzo foto di una pagina a pezzi, non per il testo: cambiano le parole. */
export function ScegliImmagine({ d, onScelta, onChiudi, perFoto = false }: { d: DatiSegreteria; onScelta: (url: string, alt: string) => void; onChiudi: () => void; perFoto?: boolean }) {
  const ref = useDialogo<HTMLDivElement>(onChiudi)
  const elenco = useCarica(() => d.sitoImmagini(), [d])
  const [scelta, setScelta] = useState<string | null>(null)
  const [alt, setAlt] = useState('')
  const [decorativa, setDecorativa] = useState(false)
  const pulito = pulisciAlt(alt)
  const no = controllaAlt(pulito, decorativa)
  return (
    <>
      <button type="button" className="sg-velo" tabIndex={-1} aria-label="Lascia stare" onClick={onChiudi} />
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="sito-scegli-titolo" tabIndex={-1} className="sg-dialogo sito-scegli">
        <span id="sito-scegli-titolo" style={{ fontFamily: 'var(--cond)', fontStyle: 'oblique 9deg', fontSize: 26, fontWeight: 700, letterSpacing: '0.04em' }}>{perFoto ? 'SCEGLI LA FOTO' : 'METTI UN’IMMAGINE NEL TESTO'}</span>
        <span className="sg-sotto">{perFoto ? 'Scegli una di quelle già caricate. Sul sito andrà a tutta la larghezza.' : 'Scegli una di quelle già caricate. Nel testo andrà a tutta la larghezza.'}</span>
        {elenco.guaio ? (
          <Guaio testo={elenco.guaio} />
        ) : !elenco.dato ? (
          <span className="sg-sotto">Leggo le immagini…</span>
        ) : (
          <ul className="sito-immagini sito-immagini-scelta">
            {elenco.dato.map((im) => (
              <li key={im.nome}>
                <button type="button" className="sito-immagine" aria-pressed={scelta === im.url} onClick={() => setScelta(im.url)}>
                  <img src={im.url} alt="" loading="lazy" />
                  <span className="sg-sotto">{scelta === im.url ? 'Scelta' : 'Scegli'}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <CaricaImmagini d={d} tratteggiato dopo={async (nuove) => { await elenco.ricarica(); if (nuove.length) setScelta(nuove[nuove.length - 1].url) }} />
        <Campo id="sito-alt" etichetta="TESTO ALTERNATIVO" nota={{ guaio: false, testo: 'Descrivi l’immagine come a voce, per chi non la vede.' }}>
          <input id="sito-alt" className="sg-campo" value={alt} disabled={decorativa} onChange={(e) => setAlt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && scelta && !no) { e.preventDefault(); onScelta(scelta, pulito) } }} />
        </Campo>
        <label className="row" style={{ gap: 10, alignItems: 'center' }}>
          <input type="checkbox" checked={decorativa} onChange={(e) => { setDecorativa(e.target.checked); if (e.target.checked) setAlt('') }} />
          <span>Solo decorativa: non dice niente in più</span>
        </label>
        <div className="row" style={{ gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" className="sg-btn sg-btn-linea" onClick={onChiudi}>
            LASCIA STARE
          </button>
          <button type="button" className="sg-btn sg-btn-pieno" disabled={!scelta || !!no} title={!scelta ? 'Scegli prima un’immagine' : (no ?? undefined)} onClick={() => scelta && onScelta(scelta, pulito)}>
            INSERISCI
          </button>
        </div>
      </div>
    </>
  )
}
