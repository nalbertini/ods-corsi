import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import type { DatiSegreteria } from '../../lib/segreteria'
import {
  bozzaCambiata,
  conteggio,
  controllaMenu,
  controllaSlug,
  LIMITE_DESCRIZIONE,
  LIMITE_TITOLO,
  PAROLE_STATO,
  pagineDiLeggeProtette,
  slugDaTitolo,
  spostaVoce,
  statoPagina,
  testoTroppoLungo,
  type PaginaSito,
  type StatoPagina,
  type VoceMenu,
} from '../../lib/sitoPagine'
import { pulisciTesto } from '../../lib/sitoTesto'
import { cosaNonVaPezzi, databaseConPezzi, cosaNonVaPortare, htmlInPezzi, pezziCambiati, pezziInHtml, pezziVuoti, portabileAiPezzi, type PezziPagina } from '../../lib/sitoPezzi'
import { Immagini } from './ImmaginiSito'
import { Campo, chiedi, Guaio, lasciare, Testa, useAvviso, useBozza, useCarica } from './comune'
import { Titoletto } from '../ds'

// L'editor porta con sé una libreria grossa: si scarica solo quando si apre una pagina da scrivere.
const EditorTesto = lazy(() => import('./EditorTesto').then((m) => ({ default: m.EditorTesto })))
// Anche l'editor a pezzi e l'anteprima vera (che porta il generatore del sito) si scaricano solo quando servono.
const EditorPezzi = lazy(() => import('./EditorPezzi'))
const AnteprimaPagina = lazy(() => import('./AnteprimaPagina'))

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

function Conto({ testo, limite }: { testo: string; limite: number }) {
  const { n, troppo } = conteggio(testo, limite)
  // Il rosso non basta da solo: oltre il limite lo dice anche a parole.
  return <span style={{ color: troppo ? 'var(--rosso-testo)' : 'var(--dim)' }}>{troppo ? `${n} SU ${limite} · TROPPO LUNGO` : `${n} SU ${limite}`}</span>
}

/**
 * La pagina del sito da scrivere. Salvare la bozza non cambia il sito:
 * solo PUBBLICA copia la bozza nel testo che il sito mostra.
 */
function Scrivi({ d, pagina, altri, onChiudi, ricarica }: { d: DatiSegreteria; pagina: PaginaSito; altri: string[]; onChiudi: () => void; ricarica: () => Promise<void> }) {
  const [titolo, setTitolo] = useState(pagina.titolo)
  const [descrizione, setDescrizione] = useState(pagina.descrizione)
  const [bozzaTesto, setBozza] = useState(pagina.bozza)
  // Una pagina a pezzi (`pagina.pezzi`) si scrive coi pezzi; una col vecchio editor, col testo.
  const [pezzi, setPezzi] = useState<PezziPagina>(pagina.pezzi ?? pezziVuoti())
  const aPezzi = !!pagina.pezzi
  const [slug, setSlug] = useState(pagina.slug)
  const [anteprima, setAnteprima] = useState(false)
  const { avviso, avvisa, fai, lavora } = useAvviso()
  // I pezzi si controllano e si traducono in testo solo quando cambiano, non a ogni tasto di un altro campo.
  const noPezzi = useMemo(() => (aPezzi ? cosaNonVaPezzi(pezzi) : null), [aPezzi, pezzi])
  const bozza = useMemo(() => (aPezzi && !noPezzi ? pezziInHtml(pezzi) : bozzaTesto), [aPezzi, noPezzi, pezzi, bozzaTesto])
  const pezziDiversi = useMemo(() => aPezzi && pezziCambiati(pezzi, pagina.pezzi), [aPezzi, pezzi, pagina.pezzi])
  const sporca = titolo.trim() !== pagina.titolo || descrizione.trim() !== pagina.descrizione || (aPezzi ? pezziDiversi : bozzaCambiata(bozza, pagina.bozza))
  useBozza(sporca, pagina.titolo)
  const noSlug = slug === pagina.slug ? null : controllaSlug(slug, altri)
  const noTitolo = !titolo.trim() ? 'Scrivi il titolo della pagina' : null
  const noTesto = noPezzi ?? testoTroppoLungo(bozza)
  const salvata = () =>
    aPezzi ? d.salvaBozzaPezziSito(pagina.id, pagina.versione, { titolo, descrizione, pezzi }) : d.salvaBozzaSito(pagina.id, pagina.versione, { titolo, descrizione, bozza: pulisciTesto(bozza) })

  const salva = () => fai(salvata, 'Bozza salvata. Il sito non è cambiato: serve PUBBLICA', ricarica)
  const pubblica = async () => {
    if (!(await chiedi(`Pubblicare «${titolo.trim() || pagina.titolo}»? Il sito mostrerà il testo nuovo al prossimo aggiornamento.`, 'PUBBLICA'))) return
    await fai(
      async () => {
        const versione = sporca ? await salvata() : pagina.versione
        try {
          await d.pubblicaPaginaSito(pagina.id, versione)
        } catch (e) {
          // La bozza è già salvata, la versione è salita: si rilegge, o il secondo tentativo litiga con noi.
          await ricarica()
          throw e
        }
      },
      'Pubblicata',
      ricarica,
    )
  }
  // Il testo di prima diventa pezzi senza cambiare una parola (`htmlInPezzi`); `Scrivi` non si rimonta dopo `ricarica`,
  // quindi i pezzi nuovi si danno anche allo stato locale, o l'editor si aprirebbe vuoto.
  const portaAiPezzi = async () => {
    const no = cosaNonVaPortare(pagina.bozza)
    if (no) return avvisa(no, true)
    if (!(await chiedi(`Portare «${pagina.titolo}» ai pezzi? Non si torna più al vecchio editor di testo. Il testo resta com’è e il sito non cambia finché non pubblichi.`, 'PORTA AI PEZZI', { no: 'LASCIA STARE' }))) return
    const nuovi = htmlInPezzi(pagina.bozza)
    await fai(
      async () => {
        await d.salvaBozzaPezziSito(pagina.id, pagina.versione, { titolo: pagina.titolo, descrizione: pagina.descrizione, pezzi: nuovi })
        setPezzi(nuovi)
      },
      'Pagina portata ai pezzi. Il sito non è cambiato',
      ricarica,
    )
  }
  const cambiaSlug = () => fai(() => d.cambiaIndirizzoSito(pagina.id, slug), 'Indirizzo cambiato', ricarica)
  const nascondi = async () => {
    if (!pagina.nascosta && !(await chiedi(`Nascondere «${pagina.titolo}»? Sparisce dal sito alla prossima pubblicazione, ma resta qui.`, 'NASCONDI', { pericolo: true }))) return
    await fai(() => d.nascondiPaginaSito(pagina.id, !pagina.nascosta), pagina.nascosta ? 'Di nuovo sul sito' : 'Nascosta', ricarica)
  }
  const cancella = async () => {
    if (!(await chiedi(`Cancellare «${pagina.titolo}»? Non si può rimettere.`, 'CANCELLA LA PAGINA', { pericolo: true }))) return
    await fai(() => d.cancellaPaginaSito(pagina.id), 'Pagina cancellata', async () => {
      await ricarica()
      onChiudi()
    })
  }

  return (
    <>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="sg-btn sg-btn-linea" onClick={async () => { if (sporca && !(await chiedi('Ci sono modifiche non salvate. Se torni alle pagine si perdono.', 'TORNA ALLE PAGINE', { no: 'RESTA QUI', restare: true }))) return; onChiudi() }}>
          ‹ TUTTE LE PAGINE
        </button>
        <Stato p={pagina} />
        {sporca && <span className="sg-tag" data-tipo="presto">DA SALVARE</span>}
        <span className="grow" />
        <button type="button" className="sg-btn sg-btn-verde" disabled={lavora || !!noTitolo || !!noSlug || !!noTesto || conteggio(titolo, LIMITE_TITOLO).troppo} onClick={() => void pubblica()}>
          PUBBLICA
        </button>
        <button type="button" className="sg-btn sg-btn-pieno" disabled={lavora || !sporca || !!noTitolo || !!noTesto} onClick={() => void salva()}>
          SALVA BOZZA
        </button>
        <button type="button" className="sg-btn sg-btn-linea" aria-pressed={anteprima} onClick={() => setAnteprima((x) => !x)}>
          {anteprima ? 'TORNA A SCRIVERE' : 'ANTEPRIMA'}
        </button>
      </div>

      <div className={aPezzi ? 'sito-due sito-due-pezzi' : 'sito-due'}>
        <div className="stack" style={{ gap: 10, minWidth: 0 }}>
          {anteprima && aPezzi ? (
            <Suspense fallback={<span className="sg-sotto">Apro l’anteprima…</span>}>
              <AnteprimaPagina slug={pagina.slug} titolo={titolo} descrizione={descrizione} testo={bozza} />
            </Suspense>
          ) : anteprima ? (
            // Sicuro: è il testo ripulito dalla stessa funzione che lo ripulisce per il sito (sitoTesto.ts).
            <div className="sito-testo sito-anteprima" aria-label="Com’è sul sito" dangerouslySetInnerHTML={{ __html: pulisciTesto(bozza) }} />
          ) : (
            <Suspense fallback={<span className="sg-sotto">Apro l’editor…</span>}>
              {aPezzi ? <EditorPezzi d={d} pezzi={pezzi} onCambia={setPezzi} /> : <EditorTesto valore={bozzaTesto} onCambia={setBozza} etichetta={`Testo di ${pagina.titolo}`} d={d} />}
            </Suspense>
          )}
          {noTesto && <Guaio testo={noTesto} />}
        </div>
        <div className="stack" style={{ gap: 14, minWidth: 0 }}>
          <Campo id="sito-titolo" etichetta="TITOLO PER GOOGLE" manca={!!noTitolo} nota={noTitolo ? { guaio: true, testo: noTitolo } : undefined}>
            <input id="sito-titolo" className="sg-campo" value={titolo} onChange={(e) => setTitolo(e.target.value)} />
            <Conto testo={titolo} limite={LIMITE_TITOLO} />
          </Campo>
          <Campo id="sito-descrizione" etichetta="DESCRIZIONE">
            <textarea id="sito-descrizione" className="sg-campo" rows={4} value={descrizione} onChange={(e) => setDescrizione(e.target.value)} />
            <Conto testo={descrizione} limite={LIMITE_DESCRIZIONE} />
          </Campo>
          <Campo id="sito-indirizzo" etichetta="INDIRIZZO DELLA PAGINA" nota={pagina.diLegge ? { guaio: false, testo: pagineDiLeggeProtette(pagina, 'indirizzo') ?? '' } : noSlug ? { guaio: true, testo: noSlug } : pagina.pubblicato !== null ? { guaio: false, testo: 'Se lo cambi, il vecchio indirizzo porta al nuovo.' } : undefined}>
            <input id="sito-indirizzo" className="sg-campo" value={slug} disabled={pagina.diLegge} onChange={(e) => setSlug(e.target.value.trim())} />
          </Campo>
          {slug !== pagina.slug && (
            <button type="button" className="sg-btn sg-btn-pieno" disabled={lavora || !!noSlug} onClick={() => void cambiaSlug()}>
              CAMBIA INDIRIZZO
            </button>
          )}
          {portabileAiPezzi(pagina) && (
            <div className="stack" style={{ gap: 10, paddingTop: 8, borderTop: '2px solid var(--line)' }}>
              <Titoletto>EDITOR A PEZZI</Titoletto>
              <button type="button" className="sg-btn sg-btn-linea" disabled={lavora || sporca} onClick={() => void portaAiPezzi()}>
                PORTA AI PEZZI
              </button>
              <span className="sg-sotto">{sporca ? 'Salva la bozza prima di passare ai pezzi.' : 'Il testo resta com’è: lo trovi in foto, testo e colonne da trascinare. Sul sito non cambia niente finché non pubblichi.'}</span>
            </div>
          )}
          <div className="stack" style={{ gap: 8 }}>
            {pagina.diLegge ? (
              <span className="sg-sotto">{pagineDiLeggeProtette(pagina, 'cancella')}</span>
            ) : (
              <>
                <button type="button" className="sg-btn sg-btn-tratteggio" disabled={lavora} onClick={() => void nascondi()}>
                  {pagina.nascosta ? 'MOSTRA SUL SITO' : 'NASCONDI DAL SITO'}
                </button>
                <button type="button" className="sg-btn sg-btn-linea" disabled={lavora} onClick={() => void cancella()}>
                  CANCELLA LA PAGINA
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      {avviso}
    </>
  )
}

/** `aPezzi`: la pagina nasce a pezzi (serve `62-sito-pezzi.sql`); senza, nasce col vecchio editor di testo. */
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
          CREA LA PAGINA
        </button>
        <button type="button" className="sg-btn sg-btn-linea" onClick={() => finita()}>
          ANNULLA
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
              <span className="sg-tag">DI LEGGE</span>
            ) : (
              <button type="button" className="sg-chip num" onClick={() => setModifica((m) => m.filter((_, j) => j !== i))}>TOGLI</button>
            )}
          </li>
        ))}
      </ul>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="sg-btn sg-btn-tratteggio" onClick={() => setModifica((m) => [...m, { etichetta: '', paginaId: pagine[0]?.id ?? null, indirizzo: pagine[0] ? null : '' }])}>
          + AGGIUNGI UNA VOCE
        </button>
      </div>
      {problemi.length > 0 && (
        <ul className="stack" role="alert" style={{ gap: 4, margin: 0, paddingLeft: 18, color: 'var(--rosso-testo)', fontSize: 14 }}>
          {problemi.map((p) => <li key={p}>{p}</li>)}
        </ul>
      )}
      {cambiata && (
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="sg-btn sg-btn-linea" onClick={() => setModifica(voci)}>BUTTA I CAMBI</button>
          <button type="button" className="sg-btn sg-btn-pieno" disabled={lavora || problemi.length > 0} onClick={() => void fai(() => d.salvaMenuSito(dove, modifica.map((v) => ({ ...v, etichetta: v.etichetta.trim() }))), `${titolo} salvato`, ricarica)}>SALVA</button>
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
            NUOVA PAGINA
          </button>
        )}
      </Testa>

      {lei ? (
        <Scrivi key={lei.id} d={d} pagina={lei} altri={tutte.filter((p) => p.id !== lei.id).map((p) => p.slug)} onChiudi={() => setAperta(null)} ricarica={ricarica} />
      ) : (
        <>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="sg-chip num" aria-pressed={scheda === 'pagine'} onClick={() => void cambiaScheda('pagine')}>PAGINE</button>
            <button type="button" className="sg-chip num" aria-pressed={scheda === 'menu'} onClick={() => void cambiaScheda('menu')}>MENU E FOOTER</button>
            <button type="button" className="sg-chip num" aria-pressed={scheda === 'immagini'} onClick={() => void cambiaScheda('immagini')}>IMMAGINI</button>
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
              <div className="stack" style={{ gap: 24, maxWidth: 960 }}>
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
