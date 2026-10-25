import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import type { DatiSegreteria } from '../../lib/segreteria'
import {
  controllaMenu,
  controllaSlug,
  PAROLE_STATO,
  slugDaTitolo,
  spostaVoce,
  statoPagina,
  type PaginaSito,
  type StatoPagina,
  type VoceMenu,
} from '../../lib/sitoPagine'
import { databaseConPezzi, FRASE_SENZA_PEZZI, pagineDaPulsante, pezziVuoti } from '../../lib/sitoPezzi'
import { Immagini } from './ImmaginiSito'
import { Campo, Guaio, lasciare, Testa, useAvviso, useBozza, useCarica } from './comune'

// L'editor (Puck, con l'anteprima che porta il generatore del sito) è grosso: si scarica solo quando si apre una pagina.
const EditorPuck = lazy(() => import('./EditorPuck'))

const TONO_STATO: Record<StatoPagina, string | undefined> = { pubblicata: 'fatto', modificata: 'presto', 'solo-bozza': undefined, nascosta: undefined }

const Stato = ({ p }: { p: PaginaSito }) => {
  const s = statoPagina(p)
  return (
    <span className="sg-tag" data-tipo={TONO_STATO[s]}>
      {PAROLE_STATO[s]}
    </span>
  )
}

/** «12 ott» o «oggi, 10:12»: quando una pagina è stata pubblicata l'ultima volta. */
const quandoPubblicata = (p: PaginaSito) => (p.pubblicataIl ? new Date(p.pubblicataIl).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) : '—')

/** `aPezzi`: la pagina nasce a pezzi (serve `62-sito-pezzi.sql`); senza, non si potrebbe scrivere (`FRASE_SENZA_PEZZI`). */
function NuovaPagina({ d, altri, aPezzi, finita }: { d: DatiSegreteria; altri: string[]; aPezzi: boolean; finita: (id?: string) => unknown }) {
  const [titolo, setTitolo] = useState('')
  const [slug, setSlug] = useState('')
  // L'indirizzo segue il titolo finché non lo si scrive a mano.
  const [aMano, setAMano] = useState(false)
  const indirizzo = aMano ? slug : slugDaTitolo(titolo)
  const no = titolo.trim() || indirizzo ? controllaSlug(indirizzo, altri) : null
  const { avviso, fai, lavora } = useAvviso()
  useBozza(!!titolo.trim() || !!slug, 'La pagina nuova')
  const crea = async () => {
    let id: string | undefined
    const riuscito = await fai(async () => {
      id = await d.nuovaPaginaSito(titolo, indirizzo, aPezzi ? pezziVuoti() : undefined)
    })
    if (riuscito) finita(id)
  }
  return (
    <div className="card stack" style={{ padding: 16, gap: 12, maxWidth: 560 }}>
      <Campo id="sito-nuova-titolo" etichetta="TITOLO">
        <input id="sito-nuova-titolo" className="sg-campo" value={titolo} autoFocus onChange={(e) => setTitolo(e.target.value)} />
      </Campo>
      <Campo id="sito-nuova-slug" etichetta="INDIRIZZO DELLA PAGINA" nota={no ? { guaio: true, testo: no } : undefined}>
        <input id="sito-nuova-slug" className="sg-campo" value={indirizzo} onChange={(e) => { setAMano(true); setSlug(e.target.value.trim()) }} />
      </Campo>
      <div className="row" style={{ gap: 8 }}>
        <button type="button" className="sg-btn sg-btn-pieno" disabled={lavora || !titolo.trim() || !!no} onClick={() => void crea()}>
          Crea la pagina
        </button>
        <button type="button" className="sg-btn sg-btn-linea" onClick={() => finita()}>
          Annulla
        </button>
      </div>
      {avviso}
    </div>
  )
}

/** Il menu in alto o il footer: voci con nome e destinazione, da riordinare. */
function ElencoVoci({ d, dove, titolo, voci, pagine, ricarica }: { d: DatiSegreteria; dove: 'menu' | 'footer'; titolo: string; voci: VoceMenu[]; pagine: PaginaSito[]; ricarica: () => Promise<void> }) {
  const [modifica, setModifica] = useState(voci)
  // Si riparte da quelle salvate solo se sono davvero cambiate: salvare il menu rilegge anche il footer, e non deve buttare quello a metà.
  const firma = JSON.stringify(voci)
  useEffect(() => setModifica(voci), [firma])
  const { avviso, fai, lavora } = useAvviso()
  const cambiata = JSON.stringify(modifica) !== JSON.stringify(voci)
  useBozza(cambiata, titolo)
  const problemi = useMemo(() => controllaMenu(dove, modifica, pagine), [dove, modifica, pagine])
  const cambia = (i: number, v: Partial<VoceMenu>) => setModifica((m) => m.map((x, j) => (j === i ? { ...x, ...v } : x)))
  const diLegge = (v: VoceMenu) => dove === 'footer' && pagine.some((p) => p.diLegge && p.id === v.paginaId)
  return (
    <section className="stack" aria-label={titolo} style={{ gap: 10 }}>
      <h2 className="sg-etichetta" style={{ margin: 0 }}>{titolo}</h2>
      <ul className="sito-voci">
        {modifica.map((v, i) => (
          <li key={i} className="sito-voce">
            <span className="num sito-voce-n">{i + 1}</span>
            <input className="sg-campo" aria-label={`Nome della voce ${i + 1}`} value={v.etichetta} onChange={(e) => cambia(i, { etichetta: e.target.value })} />
            <select
              className="sg-campo"
              aria-label={`Dove porta «${v.etichetta || `voce ${i + 1}`}»`}
              value={v.paginaId ?? ''}
              disabled={diLegge(v)}
              onChange={(e) => (e.target.value ? cambia(i, { paginaId: e.target.value, indirizzo: null }) : cambia(i, { paginaId: null, indirizzo: '' }))}
            >
              {pagine.map((p) => (
                <option key={p.id} value={p.id}>{`${p.titolo}${p.nascosta ? ' (nascosta)' : p.pubblicato === null ? ' (non pubblicata)' : ''}`}</option>
              ))}
              <option value="">Un indirizzo</option>
            </select>
            {v.paginaId === null && (
              <input className="sg-campo" aria-label={`Indirizzo di «${v.etichetta || `voce ${i + 1}`}»`} placeholder="https://… oppure /orari" value={v.indirizzo ?? ''} onChange={(e) => cambia(i, { indirizzo: e.target.value.trim() })} />
            )}
            <button type="button" className="sg-chip num sito-sposta" aria-label={`Sposta su «${v.etichetta}»`} disabled={i === 0} onClick={() => setModifica((m) => spostaVoce(m, i, i - 1))}>↑</button>
            <button type="button" className="sg-chip num sito-sposta" aria-label={`Sposta giù «${v.etichetta}»`} disabled={i === modifica.length - 1} onClick={() => setModifica((m) => spostaVoce(m, i, i + 1))}>↓</button>
            {diLegge(v) ? (
              <span className="sg-tag">Di legge</span>
            ) : (
              <button type="button" className="sg-chip num sg-pericolo" data-bozza onClick={() => setModifica((m) => m.filter((_, j) => j !== i))}>Togli</button>
            )}
          </li>
        ))}
      </ul>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="sg-btn sg-btn-tratteggio" onClick={() => setModifica((m) => [...m, { etichetta: '', paginaId: pagine[0]?.id ?? null, indirizzo: pagine[0] ? null : '' }])}>
          + Aggiungi una voce
        </button>
      </div>
      {problemi.length > 0 && (
        <ul className="stack" role="alert" style={{ gap: 4, margin: 0, paddingLeft: 18, color: 'var(--rosso-testo)', fontSize: 14 }}>
          {problemi.map((p) => <li key={p}>{p}</li>)}
        </ul>
      )}
      {cambiata && (
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="sg-btn sg-btn-linea" onClick={() => setModifica(voci)}>Butta i cambi</button>
          <button type="button" className="sg-btn sg-btn-pieno" disabled={lavora || problemi.length > 0} onClick={() => void fai(() => d.salvaMenuSito(dove, modifica.map((v) => ({ ...v, etichetta: v.etichetta.trim() }))), `${titolo} salvato`, ricarica)}>Salva</button>
        </div>
      )}
      {avviso}
    </section>
  )
}

/**
 * Il sito della palestra: le pagine, il menu in alto e il footer. La segreteria
 * scrive la bozza e pubblica; le regole (testo ripulito, pagine di legge sempre
 * sul sito, menu che non porta a pagine nascoste) stanno in `sitoPagine.ts`.
 */
export function Sito({ d }: { d: DatiSegreteria }) {
  const pagine = useCarica(() => d.sitoPagine(), [d])
  const menu = useCarica(() => d.sitoMenu(), [d])
  const [scheda, setScheda] = useState<'pagine' | 'menu' | 'immagini'>('pagine')
  const [aperta, setAperta] = useState<string | 'nuova' | null>(null)
  const tutte = pagine.dato ?? []
  const lei = tutte.find((p) => p.id === aperta)
  // Le pagine dei pulsanti, rifatte solo quando cambiano: una lista nuova a ogni disegno rifarebbe la config del nuovo editor, e Puck rimonterebbe i campi.
  const verso = useMemo(() => pagineDaPulsante((pagine.dato ?? []).filter((p) => p.id !== aperta)), [pagine.dato, aperta])

  // Cambiando scheda con voci a metà (menu o footer) si chiede prima, come cambiando voce del menu a sinistra.
  const cambiaScheda = async (dopo: 'pagine' | 'menu' | 'immagini') => {
    if (dopo === scheda || !(await lasciare())) return
    // IMMAGINI dice dove sono usate: le pagine si rileggono, o «in uso» resterebbe quello di prima.
    if (dopo === 'immagini') await pagine.ricarica()
    setScheda(dopo)
  }

  // Le pagine che cambiano (un salvataggio) cambiano anche cosa vede il menu: si rileggono insieme.
  const ricarica = async () => {
    await Promise.all([pagine.ricarica(), menu.ricarica()])
  }

  if (pagine.guaio) return <><Testa titolo="SITO" sotto="Le pagine del sito della palestra" /><Guaio testo={pagine.guaio} /></>
  if (!pagine.dato) return <><Testa titolo="SITO" sotto="Le pagine del sito della palestra" /><span className="sg-sotto">Leggo le pagine…</span></>

  return (
    <>
      <Testa titolo={lei ? lei.titolo.toUpperCase() : 'SITO'} sotto={lei ? 'SITO · PAGINE' : 'Le pagine del sito della palestra, il menu, il footer e le immagini'}>
        {!lei && scheda === 'pagine' && aperta !== 'nuova' && (
          <button type="button" className="sg-btn sg-btn-pieno" onClick={() => setAperta('nuova')}>
            Nuova pagina
          </button>
        )}
      </Testa>

      {lei ? (
        databaseConPezzi(tutte) ? (
          <Suspense fallback={<span className="sg-sotto">Apro l’editor…</span>}>
            <EditorPuck key={lei.id} d={d} pagina={lei} pagine={tutte} verso={verso} onChiudi={() => setAperta(null)} ricarica={ricarica} />
          </Suspense>
        ) : (
          <Guaio testo={FRASE_SENZA_PEZZI} />
        )
      ) : (
        <>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="sg-chip num" aria-pressed={scheda === 'pagine'} onClick={() => void cambiaScheda('pagine')}>Pagine</button>
            <button type="button" className="sg-chip num" aria-pressed={scheda === 'menu'} onClick={() => void cambiaScheda('menu')}>Menu e footer</button>
            <button type="button" className="sg-chip num" aria-pressed={scheda === 'immagini'} onClick={() => void cambiaScheda('immagini')}>Immagini</button>
          </div>

          {scheda === 'pagine' && aperta === 'nuova' && (
            <NuovaPagina d={d} altri={tutte.map((p) => p.slug)} aPezzi={databaseConPezzi(tutte)} finita={async (id) => { if (id) await pagine.ricarica(); setAperta(id ?? null) }} />
          )}

          {scheda === 'pagine' && aperta !== 'nuova' && (
            <>
              <ul className="sito-elenco">
                <li className="sito-riga sito-riga-testa" aria-hidden="true">
                  <span>PAGINA</span><span>INDIRIZZO</span><span>STATO</span><span>PUBBLICATA</span>
                </li>
                {tutte.map((p) => (
                  <li key={p.id}>
                    <button type="button" className="sito-riga" data-spenta={p.nascosta || undefined} onClick={() => setAperta(p.id)}>
                      <span className="sito-nome">{p.titolo}</span>
                      <span className="sg-sotto">{p.slug === 'home' ? '/' : `/${p.slug}`}</span>
                      <span><Stato p={p} /></span>
                      <span className="sg-sotto">{quandoPubblicata(p)}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <span className="sg-sotto">Le pagine di legge (privacy, cookie, contributi pubblici) non si possono nascondere né cancellare.</span>
            </>
          )}

          {scheda === 'immagini' && <Immagini d={d} pagine={tutte} />}

          {scheda === 'menu' && (
            menu.guaio ? <Guaio testo={menu.guaio} /> : menu.dato ? (
              <div className="stack" style={{ gap: 24 }}>
                <ElencoVoci d={d} dove="menu" titolo="MENU IN ALTO" voci={menu.dato.menu} pagine={tutte} ricarica={ricarica} />
                <ElencoVoci d={d} dove="footer" titolo="FOOTER" voci={menu.dato.footer} pagine={tutte} ricarica={ricarica} />
              </div>
            ) : <span className="sg-sotto">Leggo il menu…</span>
          )}
        </>
      )}
    </>
  )
}
