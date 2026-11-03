import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { DatiSegreteria } from '../../lib/segreteria'
import { controllaAlt, MASSIMO_BYTE, pagineCheUsano, pulisciAlt, TIPI_AMMESSI, type ImmagineSito } from '../../lib/sitoImmagini'
import { puntoDaClic, spostaPunto, type Punto } from '../../lib/sitoFoto'
import type { PaginaSito } from '../../lib/sitoPagine'
import { Campo, chiedi, Guaio, Tasto, useAvviso, useCarica, useDialogo } from './comune'

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
        {lavora ? 'Carico…' : tratteggiato ? '+ Carica un’immagine nuova' : 'Carica un’immagine'}
      </button>
      {avviso}
    </>
  )
}

const MEZZO: Punto = { x: 50, y: 50 }
const posizione = (p: Punto) => `${p.x}% ${p.y}%`

/**
 * Dove stanno le persone in una foto: si trascina (o si tocca) il punto sulla foto intera, o lo si sposta con le frecce,
 * e accanto si vedono i tagli del sito con quel punto. Il punto vale ovunque la foto compare (`sitoFoto.ts`).
 */
function DoveStannoLePersone({ im, salvato, usata, onSalva, onChiudi }: { im: ImmagineSito; salvato: Punto | undefined; usata: string[]; onSalva: (p: Punto) => Promise<unknown>; onChiudi: () => void }) {
  const ref = useDialogo<HTMLDivElement>(onChiudi)
  const prima = salvato ?? MEZZO
  const [p, setP] = useState(prima)
  const foto = useRef<HTMLDivElement>(null)
  const { avviso, fai, lavora } = useAvviso()
  const tocca = (e: PointerEvent<HTMLDivElement>) => setP(puntoDaClic(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect()))
  const tasto = (e: KeyboardEvent<HTMLDivElement>) => {
    const dopo = spostaPunto(p, e.key, e.shiftKey)
    if (!dopo) return
    e.preventDefault()
    setP(dopo)
  }
  const anteprima = (etichetta: string, sotto: string, classe: string) => (
    <div className="stack" style={{ gap: 6 }}>
      <span className="sg-etichetta">{etichetta} <span className="sg-sotto">· {sotto}</span></span>
      <img className={`sito-punto-taglio ${classe}`} src={im.url} alt="" style={{ objectPosition: posizione(p) }} />
    </div>
  )
  const cambiato = p.x !== prima.x || p.y !== prima.y
  return (
    <>
      <button type="button" className="sg-velo" tabIndex={-1} aria-label="Annulla" onClick={onChiudi} />
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="sito-punto-titolo" tabIndex={-1} className="sg-dialogo sito-punto">
        <span id="sito-punto-titolo" style={{ fontFamily: 'var(--cond)', fontStyle: 'oblique 9deg', fontSize: 26, fontWeight: 700, letterSpacing: '0.04em' }}>DOVE STANNO LE PERSONE</span>
        <span className="sg-sotto">Trascina il punto su chi deve vedersi. Il sito taglia la foto intorno a questo punto, su computer e su telefono.</span>
        <div className="sito-punto-corpo">
          <div className="stack" style={{ gap: 8 }}>
            <div
              ref={foto} className="sito-punto-foto" tabIndex={0} role="group" aria-label={`Il punto: ${p.x}% da sinistra, ${p.y}% dall’alto`} aria-describedby="sito-punto-tasti"
              onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); tocca(e) }}
              onPointerMove={(e) => { if (e.buttons) tocca(e) }}
              onKeyDown={tasto}
            >
              <img src={im.url} alt="" draggable={false} />
              <span className="sito-punto-riga" style={{ top: `${p.y}%` }} />
              <span className="sito-punto-colonna" style={{ left: `${p.x}%` }} />
              <span className="sito-punto-cerchio" style={{ left: `${p.x}%`, top: `${p.y}%` }} />
            </div>
            <span id="sito-punto-tasti" className="sg-sotto">Anche con la tastiera: le frecce spostano il punto.</span>
          </div>
          <div className="stack" style={{ gap: 16, minWidth: 0 }}>
            <div className="row" style={{ gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              {anteprima('COMPUTER', 'foto grande di una pagina', 'sito-punto-computer')}
              {anteprima('TELEFONO', 'la stessa foto', 'sito-punto-telefono')}
            </div>
            {anteprima('STRISCIA DEI CORSI', 'Home, alta 150 px', 'sito-punto-striscia')}
            <span className="sg-sotto">La striscia è bassa: qualcosa resta tagliato con qualsiasi punto.</span>
          </div>
        </div>
        {usata.length > 0 && (
          <div className="stack" style={{ gap: 2 }}>
            <span className="sg-etichetta">DOVE SI USA</span>
            {usata.map((t) => (
              <div key={t} className="sito-punto-uso">
                <b>{t}</b>
                <span className="sg-tag" data-tipo="fatto">Segue il punto</span>
              </div>
            ))}
          </div>
        )}
        {/* In fondo e sempre visibile: a telefono la finestra è più alta dello schermo, e l'avviso sta dentro, non sopra Salva. */}
        <div className="sito-punto-piede">
          <span className="sg-sotto sito-punto-nota">Si vedrà sul sito entro qualche minuto.</span>
          {/* Il tasto si spegne appena cliccato: il fuoco torna sulla foto, se no cadrebbe sul fondo della pagina. */}
          <Tasto className="sito-punto-torna" disabled={!cambiato || lavora} onClick={() => { setP(prima); foto.current?.focus() }}>Torna come prima</Tasto>
          <Tasto className="sito-punto-annulla" onClick={onChiudi}>Annulla</Tasto>
          <Tasto className="sito-punto-salva" tono="pieno" disabled={lavora} onClick={() => void fai(() => onSalva(p), 'Punto salvato', onChiudi)}>
            {lavora ? 'Salvo…' : 'Salva il punto'}
          </Tasto>
          {avviso}
        </div>
      </div>
    </>
  )
}

/** SITO › IMMAGINI: quelle caricate, dove sono usate, dove stanno le persone, e il tasto per toglierle (solo se nessuna pagina le usa). */
export function Immagini({ d, pagine }: { d: DatiSegreteria; pagine: PaginaSito[] }) {
  const elenco = useCarica(() => d.sitoImmagini(), [d])
  const punti = useCarica(() => d.sitoPunti(), [d])
  const [aperta, setAperta] = useState<ImmagineSito | null>(null)
  // Chiusa la finestra, il fuoco torna sul tasto della foto da cui era partita: si cerca di nuovo, perché
  // salvando l'elenco si rilegge e il tasto di prima (quello che ricorda useDialogo) può non esserci più.
  const ultima = useRef<string | null>(null)
  useEffect(() => {
    if (aperta) ultima.current = aperta.nome
    else if (ultima.current) document.querySelector<HTMLButtonElement>(`[data-punto="${CSS.escape(ultima.current)}"]`)?.focus()
  }, [aperta])
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
      {punti.guaio && <Guaio testo={punti.guaio} />}
      {elenco.dato.length === 0 ? (
        <span className="sg-sotto">Non c’è ancora nessuna immagine.</span>
      ) : (
        <ul className="sito-immagini">
          {elenco.dato.map((im) => {
            const usata = pagineCheUsano(im.url, pagine)
            const punto = punti.dato?.[im.nome]
            return (
              <li key={im.nome} className="sito-immagine">
                <span className="sito-immagine-miniatura">
                  <img src={im.url} alt="" loading="lazy" style={{ objectPosition: posizione(punto ?? MEZZO) }} />
                  {punto && <span className="sito-punto-puntino" style={{ left: `${punto.x}%`, top: `${punto.y}%` }} />}
                </span>
                {punti.dato && (punto ? <span className="sg-tag" data-tipo="fatto">Persone a posto</span> : <span className="sg-sotto">Tagliata al centro</span>)}
                <span className="sg-sotto">{usata.length ? `Usata in: ${usata.join(', ')}` : 'Non è usata in nessuna pagina'}</span>
                {punti.dato && (
                  <Tasto data-punto={im.nome} onClick={() => setAperta(im)}>Dove stanno le persone</Tasto>
                )}
                {usata.length ? (
                  <span className="sg-tag">In uso: non si cancella</span>
                ) : (
                  <button type="button" className="sg-chip num sg-pericolo" disabled={lavora}
                    onClick={async () => {
                      if (!(await chiedi('Togliere questa immagine? Non si può rimettere: andrà caricata di nuovo. Con lei va via anche il punto delle persone: se carichi una foto al suo posto, il punto va scelto da capo.', 'Togli l’immagine', { pericolo: true, no: 'Lascia stare' }))) return
                      void fai(() => d.cancellaImmagineSito(im.nome), 'Immagine tolta', () => Promise.all([elenco.ricarica(), punti.ricarica()]))
                    }}
                  >
                    Togli
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {avviso}
      {aperta && (
        <DoveStannoLePersone
          im={aperta} salvato={punti.dato?.[aperta.nome]} usata={pagineCheUsano(aperta.url, pagine)} onChiudi={() => setAperta(null)}
          onSalva={async (p) => { await d.salvaPuntoSito(aperta.nome, p); await punti.ricarica() }}
        />
      )}
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
            Lascia stare
          </button>
          <button type="button" className="sg-btn sg-btn-pieno" disabled={!scelta || !!no} title={!scelta ? 'Scegli prima un’immagine' : (no ?? undefined)} onClick={() => scelta && onScelta(scelta, pulito)}>
            Inserisci
          </button>
        </div>
      </div>
    </>
  )
}
