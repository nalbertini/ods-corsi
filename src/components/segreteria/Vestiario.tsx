import { useEffect, useMemo, useRef, useState } from 'react'
import { chiaveGiorno, oraDi } from '../../lib/sala'
import { indirizzo, INDIRIZZI } from '../../lib/aree'
import { INDIRIZZO_VESTIARIO } from '../../lib/cancelletti'
import {
  causaleVestiario,
  cosaNonVaOrdine,
  csvFornitore,
  csvPersone,
  MAX_CAPI,
  MAX_QUANTI,
  alGiorno,
  ilGiorno,
  mancanoOrdine,
  inEuro,
  MAX_RIGHE,
  MAX_RIGHE_DETTO,
  cosaNonVaRighe,
  numeriRaccolta,
  ordineConStessoTelefono,
  PAGAMENTI,
  stessoTelefono,
  type Pagamento,
  prezzoDi,
  statoOrdine,
  type Capo,
  type Catalogo,
  type DatiVestiario,
  type Ordine,
  type Raccolta,
  type Tabelle,
  TIPI,
  MANCA_FOTO,
  nomeTipo,
  type RigaCorretta,
  type StatoOrdine,
} from '../../lib/vestiario'
import { avvisoSaldato, doveSpostare, raccoltaAperta, tagliaDopo, type CosaManca, capiPerCorreggere, capiPerRiga, effettoSalvataggio, catalogoDaBozza, cercaOrdine, mancaNellOrdine, prezzoRiga, totaleCorretto, type BozzaCatalogo as BozzaScritta, capiSenzaTipo, cosaSiCancella, salvaConFoto } from '../../lib/vestiarioPagina'
import { datiVestiario, fotoAttive, FOTO_VESTIARIO } from '../../lib/vestiarioDati'
import { NON_SI_APRE, riduciFoto, TROPPO_GRANDE } from '../../lib/foto'
import { Numero } from './Presenze'
import { chiedi, Campo, lasciare, Guaio, Riga as Titolo, SchedaPiena, Testa, useAvviso, useBozza, useCarica, useOrdina } from './comune'

/**
 * VESTIARIO: gli ordini di judogi, costumini e felpe di una raccolta, il
 * catalogo con la data di chiusura, e gli ordini scritti dal banco.
 *
 * In cima la raccolta (la prima è quella di adesso) e i suoi numeri; sotto
 * l'elenco, con i filtri. Un ordine si apre a tutta pagina: le righe si
 * correggono in una bozza con SALVA, come il listino, e il pagamento è un
 * segno a mano. Le regole stanno in `vestiario.ts` e `vestiarioPagina.ts`.
 */

/** Il link degli ordini da mandare ai genitori: lo copia anche il menu (COPIA LINK ORDINI). */
export const LINK_ORDINI = indirizzo(INDIRIZZI.iscrizioni) + INDIRIZZO_VESTIARIO

type Filtro = 'tutti' | StatoOrdine
type Pagina = { a: 'elenco' } | { a: 'ordine'; id: string } | { a: 'nuovo' } | { a: 'catalogo' }

const SEGNO: Record<StatoOrdine, { testo: string; tono: string }> = {
  'da saldare': { testo: 'DA SALDARE', tono: 'rosso' },
  saldato: { testo: 'SALDATO', tono: 'verde' },
  annullato: { testo: 'ANNULLATO', tono: 'spento' },
}

/** DA SALDARE in rosso con la parola, SALDATO verde, ANNULLATO grigio: il colore non è l'unico segno. */
function Segno({ stato }: { stato: StatoOrdine }) {
  return (
    <span className="num sg-segno-regola" data-tono={SEGNO[stato].tono}>
      {SEGNO[stato].testo}
    </span>
  )
}

/** «Chiude il 31 ottobre 2026 · aperta»: la prima è quella in cui arrivano gli ordini. */
/** «l'8 ottobre 2026»: con l'anno, per riconoscere le raccolte di un anno e dell'altro. */
const conAnno = (g: string) => `${ilGiorno(g)} ${g.slice(0, 4)}`
const nomeRaccolta = (r: Raccolta, oggi: string) => `Chiude ${conAnno(r.chiude)} · ${raccoltaAperta(r, oggi) ? 'aperta' : 'chiusa'}`

/** «Luca: judogi 130 · Sara: costumino 8, felpa 8»: per nome di battesimo, come si dice al banco. */
function capiDi(o: Ordine) {
  const per = new Map<string, string[]>()
  for (const r of o.righe) {
    const chi = r.perChi.split(/\s+/)[0]
    per.set(chi, [...(per.get(chi) ?? []), `${r.capo} ${r.taglia}${r.quanti > 1 ? ` × ${r.quanti}` : ''}`])
  }
  return [...per].map(([chi, capi]) => `${chi}: ${capi.join(', ')}`).join(' · ')
}

/** «con bonifico», «in contanti»: come si dice com'è stato pagato. */
const PAGATO: Record<Pagamento, string> = { bonifico: 'con bonifico', satispay: 'con Satispay', contanti: 'in contanti' }

/** «Arrivato il 3 ottobre, 18:20 · dal link»: quando e da dove, per chi telefona a chiedere. */
const arrivo = (o: Ordine) => `Arrivato ${ilGiorno(chiaveGiorno(new Date(o.arrivato)))}, ${oraDi(o.arrivato)} · ${o.dalBanco ? 'dal banco' : 'dal link'}`

/** «Manca: la taglia della riga 2»; scritto male, la frase è già intera. */
const detto = (m: CosaManca) => (m.scrittoMale ? m.nome : `Manca: ${m.nome.charAt(0).toLowerCase()}${m.nome.slice(1)}`)

/** Come il CSV di PRESENZE: col BOM, così Excel legge gli accenti. */
function scarica(nome: string, testo: string) {
  const url = URL.createObjectURL(new Blob(['﻿' + testo], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  URL.revokeObjectURL(url)
}

export function Vestiario({ onCambiato }: { onCambiato: () => void }) {
  const dv = useCarica(() => datiVestiario(), [])
  const d = dv.dato
  const raccolte = useCarica(async () => (await datiVestiario()).raccolte(), [])
  // Incartato: `null` di useCarica vuol dire «sto leggendo», e un catalogo mai salvato è `null` anche lui.
  const catalogo = useCarica(async () => ({ c: await (await datiVestiario()).catalogo() }), [])
  const [scelta, setScelta] = useState<string | null>(null)
  const raccolta = raccolte.dato?.find((r) => r.id === scelta) ?? raccolte.dato?.[0]
  const ordini = useCarica(async () => (raccolta ? (await datiVestiario()).ordini(raccolta.id) : []), [raccolta?.id])
  const [pagina, setPagina] = useState<Pagina>({ a: 'elenco' })
  const [filtro, setFiltro] = useState<Filtro>('tutti')
  const [cerca, setCerca] = useState('')
  const { avviso, avvisa, fai, lavora } = useAvviso()
  const oggi = chiaveGiorno(new Date())
  const capi = catalogo.dato?.c?.capi ?? []

  const tutti = ordini.dato ?? []
  const n = numeriRaccolta(tutti)
  const annullati = tutti.filter((o) => o.annullato).length
  const quanti = (f: Filtro) => (f === 'tutti' ? tutti.length : tutti.filter((o) => statoOrdine(o) === f).length)
  const doppi = stessoTelefono(tutti)
  const lista = tutti.filter((o) => (filtro === 'tutti' || statoOrdine(o) === filtro) && cercaOrdine(o, cerca))
  const { ordina, colonna } = useOrdina<Ordine, 'chi' | 'stato' | 'totale'>({
    chi: (o) => `${o.cognome} ${o.nome}`,
    stato: (o) => ['da saldare', 'saldato', 'annullato'].indexOf(statoOrdine(o)),
    totale: (o) => o.totale,
  })

  /** Dopo ogni cambio: l'elenco, e il numero sul menu. */
  const dopo = async () => {
    await ordini.ricarica()
    onCambiato()
  }
  // Tornando all'elenco una bozza (righe, catalogo, ordine nuovo) non si perde senza chiedere.
  const torna = async () => {
    if (await lasciare()) setPagina({ a: 'elenco' })
  }
  const aperto = pagina.a === 'ordine' ? tutti.find((o) => o.id === pagina.id) : undefined
  const guaio = dv.guaio ?? raccolte.guaio ?? catalogo.guaio

  const vedi = (
    <a className="sg-btn sg-btn-linea" href={LINK_ORDINI} target="_blank" rel="noopener">
      VEDI LA PAGINA ↗
    </a>
  )

  return (
    <>
      {d && pagina.a === 'ordine' && aperto && raccolte.dato && (
        <SchedaPiena key={aperto.id} etichetta={`Ordine di ${aperto.nome} ${aperto.cognome}`} torna="GLI ORDINI" onTorna={() => void torna()} cornice={false}>
          <SchedaOrdine d={d} o={aperto} capi={capi} raccolte={raccolte.dato} oggi={oggi} fai={fai} lavora={lavora} onCambiato={dopo} onSpostato={() => setPagina({ a: 'elenco' })} />
        </SchedaPiena>
      )}
      {d && pagina.a === 'nuovo' && (
        <SchedaPiena etichetta="Nuovo ordine" torna="GLI ORDINI" onTorna={() => void torna()} cornice={false}>
          <NuovoOrdine
            d={d}
            capi={capi}
            raccolta={raccolte.dato?.[0]}
            fai={fai}
            lavora={lavora}
            onFatto={async () => {
              setScelta(null)
              setPagina({ a: 'elenco' })
              await dopo()
            }}
            onLascia={() => void torna()}
            onApri={(id) => {
              setScelta(null)
              setPagina({ a: 'ordine', id })
            }}
            onCatalogo={async () => {
              if (await lasciare()) setPagina({ a: 'catalogo' })
            }}
          />
        </SchedaPiena>
      )}
      {d && pagina.a === 'catalogo' && catalogo.dato && (
        <SchedaPiena etichetta="Catalogo e chiusura" torna="GLI ORDINI" onTorna={() => void torna()} cornice={false}>
          <CatalogoChiusura
            d={d}
            salvato={catalogo.dato.c}
            raccolta={raccolte.dato?.[0]}
            oggi={oggi}
            vedi={vedi}
            fai={fai}
            lavora={lavora}
            onSalvato={async () => {
              await Promise.all([catalogo.ricarica(), raccolte.ricarica()])
              setScelta(null)
              onCambiato()
            }}
          />
        </SchedaPiena>
      )}

      <div className="stack" style={{ gap: 18 }} hidden={pagina.a !== 'elenco'}>
        <Testa titolo="VESTIARIO" sotto="Judogi, costumini e felpe. I genitori ordinano dal link, la segreteria segna chi ha pagato; al fornitore va solo il saldato.">
          {vedi}
        </Testa>

        {guaio && <Guaio testo={guaio} />}
        {!guaio && raccolte.dato === null && <p className="sg-sotto">Un attimo…</p>}

        {raccolte.dato && (
          <div className="row sg-vestiario-testa">
            {raccolta && (
              <div style={{ width: 380, maxWidth: '100%' }}>
                <Campo id="ve-raccolta" etichetta="RACCOLTA">
                  <select id="ve-raccolta" className="sg-campo" value={raccolta.id} onChange={(e) => setScelta(e.target.value)}>
                    {raccolte.dato.map((r) => (
                      <option key={r.id} value={r.id}>
                        {nomeRaccolta(r, oggi)}
                      </option>
                    ))}
                  </select>
                </Campo>
              </div>
            )}
            <button type="button" className="sg-btn sg-btn-linea" disabled={!catalogo.dato} onClick={() => setPagina({ a: 'catalogo' })}>
              CATALOGO E CHIUSURA
            </button>
            <span className="grow" />
            <button type="button" className="sg-btn sg-btn-pieno" disabled={!raccolta} onClick={() => setPagina({ a: 'nuovo' })}>
              NUOVO ORDINE
            </button>
          </div>
        )}

        {raccolte.dato && !raccolta && <p className="sg-sotto">Non c’è ancora una raccolta: scrivi il catalogo e la data di chiusura da CATALOGO E CHIUSURA, poi copia il link degli ordini dal menu.</p>}

        {raccolta && (
          <>
            <p className="sg-sotto" style={{ margin: 0 }}>
              {raccolta !== raccolte.dato?.[0]
                ? `Una raccolta di prima, chiusa ${conAnno(raccolta.chiude)}: gli ordini nuovi arrivano nell’ultima.`
                : raccoltaAperta(raccolta, oggi)
                  ? capi.length
                    ? `Chiude ${ilGiorno(raccolta.chiude)}, ${giorniA(oggi, raccolta.chiude)}: fino ad allora la pagina accetta ordini.`
                    : `Chiude ${ilGiorno(raccolta.chiude)}, ma il catalogo è vuoto: la pagina resta chiusa finché non metti i capi.`
                  : `Chiusa ${ilGiorno(raccolta.chiude)}: la pagina non accetta più ordini. Dal banco si scrivono lo stesso.`}
            </p>

            <div className="sg-numeri" data-cinque>
              <Numero titolo="ORDINI" valore={n.ordini} sotto={annullati ? `${annullati === 1 ? '1 annullato' : `${annullati} annullati`} a parte` : 'nella raccolta'} />
              <Numero titolo="SALDATI" valore={n.saldati} sotto="vanno al fornitore" />
              <Numero titolo="DA SALDARE" valore={n.daSaldare} sotto="da chiamare" allarme={n.daSaldare > 0} />
              <Numero titolo="INCASSATO" valore={inEuro(n.incassato)} sotto="pagato finora" />
              <Numero titolo="MANCA" valore={inEuro(n.mancante)} sotto="dai da saldare" />
            </div>

            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <label htmlFor="ve-cerca" className="vh">
                Cerca un ordine
              </label>
              <input id="ve-cerca" className="sg-campo" type="search" placeholder="Cerca per nome o telefono" style={{ width: 320, maxWidth: '100%' }} value={cerca} onChange={(e) => setCerca(e.target.value)} />
              {(['tutti', 'da saldare', 'saldato', 'annullato'] as const).map((f) => (
                <button key={f} type="button" className="num sg-chip" aria-pressed={filtro === f} onClick={() => setFiltro(f)}>
                  {{ tutti: 'TUTTI', 'da saldare': 'DA SALDARE', saldato: 'SALDATI', annullato: 'ANNULLATI' }[f]}{' '}
                  <span className="num sg-tag" data-tipo={f === 'da saldare' && quanti(f) > 0 ? 'manca' : undefined}>
                    {quanti(f)}
                  </span>
                </button>
              ))}
            </div>

            {ordini.guaio && <Guaio testo={ordini.guaio} />}
            <div role="table" aria-label="Ordini" className="sg-tabella">
              <div role="row" className="sg-lista-testa sg-riga-iscritto sg-riga-vestiario">
                {colonna('chi', 'CHI ORDINA')}
                <span role="columnheader" className="sg-etichetta">
                  CAPI
                </span>
                <span role="columnheader" className="sg-etichetta">
                  TELEFONO
                </span>
                {colonna('stato', 'STATO')}
                {colonna('totale', 'TOTALE', { numeri: true, destra: true })}
              </div>
              <div className="sg-tabella-corpo">
                {ordini.dato === null && !ordini.guaio && <p className="sg-sotto" style={{ padding: '12px 14px' }}>Sto leggendo gli ordini…</p>}
                {ordini.dato && lista.length === 0 && (
                  <p className="sg-sotto" style={{ padding: '12px 14px' }}>
                    {tutti.length ? 'Nessun ordine con questo filtro.' : 'In questa raccolta non è ancora arrivato nessun ordine.'}
                  </p>
                )}
                {ordina(lista).map((o) => (
                  <div key={o.id} role="row" className="sg-riga-iscritto sg-riga-vestiario sg-iscritto" data-spento={o.annullato} onClick={() => setPagina({ a: 'ordine', id: o.id })}>
                    <span role="cell" style={{ fontSize: 15, fontWeight: 600 }}>
                      <button type="button" className="sg-riga-apri">
                        {o.cognome} {o.nome}
                      </button>
                      {doppi.has(o.id) && (
                        <>
                          {' '}
                          <span className="num sg-tag" data-tipo="presto">
                            STESSO TELEFONO
                          </span>
                        </>
                      )}
                      <span className="sg-vestiario-arrivo">{arrivo(o)}</span>
                    </span>
                    <span role="cell" style={{ fontSize: 13 }}>
                      {capiDi(o)}
                    </span>
                    <span role="cell" className="num" style={{ fontSize: 13 }}>
                      {o.telefono}
                    </span>
                    <span role="cell">
                      <Segno stato={statoOrdine(o)} />
                    </span>
                    <span role="cell" className="num" style={{ fontSize: 15, fontWeight: 700, textAlign: 'right' }}>
                      {inEuro(o.totale)}
                      {/* Chi ha già pagato una parte: in elenco quel che manca, da chiedere al telefono. */}
                      {o.pagato > 0 && mancanoOrdine(o) > 0 && <span className="sg-vestiario-manca">mancano {inEuro(mancanoOrdine(o))}</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <Titolo titolo="GLI ELENCHI" />
            <div className="sg-due">
              <div className="stack" style={{ gap: 8, alignItems: 'flex-start' }}>
                <button type="button" className="sg-btn sg-btn-linea" disabled={!ordini.dato} onClick={() => {
                    const nome = `vestiario-fornitore-${raccolta.chiude}.csv`
                    scarica(nome, csvFornitore(tutti, capi))
                    avvisa(`Elenco scaricato: ${nome}`)
                  }}>
                  ELENCO PER IL FORNITORE · CSV
                </button>
                <span className="sg-sotto">
                  Solo gli ordini saldati e non annullati, contati per capo e taglia.
                  {n.daSaldare > 0 && ` ${n.daSaldare === 1 ? 'Un ordine da saldare non c’è' : `${n.daSaldare} ordini da saldare non ci sono`}: ${inEuro(n.mancante)}.`}
                </span>
              </div>
              <div className="stack" style={{ gap: 8, alignItems: 'flex-start' }}>
                <button type="button" className="sg-btn sg-btn-linea" disabled={!ordini.dato} onClick={() => {
                    const nome = `vestiario-persone-${raccolta.chiude}.csv`
                    scarica(nome, csvPersone(tutti))
                    avvisa(`Elenco scaricato: ${nome}`)
                  }}>
                  ELENCO PER PERSONA · CSV
                </button>
                <span className="sg-sotto">Una riga per capo, con per chi è, chi l’ha ordinato e lo stato: per distribuire. Gli annullati non ci sono.</span>
              </div>
            </div>
          </>
        )}
      </div>
      {avviso}
    </>
  )
}

/** «fra 22 giorni», «oggi», «domani». */
function giorniA(oggi: string, giorno: string) {
  const n = Math.round((Date.parse(giorno) - Date.parse(oggi)) / 86_400_000)
  return n === 0 ? 'oggi' : n === 1 ? 'domani' : `fra ${n} giorni`
}

type Fai = ReturnType<typeof useAvviso>['fai']
type RigaScritta = RigaCorretta & { chiave: number }

let contatore = 0
const chiave = () => ++contatore
const rigaVuota = (perChi = ''): RigaScritta => ({ chiave: chiave(), perChi, capo: '', taglia: '', quanti: 1 })
const senzaChiave = (righe: RigaScritta[]): RigaCorretta[] => righe.map(({ chiave: _, ...r }) => r)

/**
 * Le righe di un ordine in una tabella, una riga per capo: per chi, capo,
 * taglia, quanti, prezzo. La usano la correzione e il NUOVO ORDINE.
 * `prezzi` dice il prezzo di ogni riga (quello di quando è arrivata, o di adesso).
 */
function RigheTabella({ righe, capi, prezzi, onCambia }: { righe: RigaScritta[]; capi: Capo[]; prezzi: number[]; onCambia: (righe: RigaScritta[]) => void }) {
  const cambia = (k: number, x: Partial<RigaCorretta>) => onCambia(righe.map((r) => (r.chiave === k ? { ...r, ...x } : r)))
  return (
    <>
      <div role="table" aria-label="Le righe" className="sg-tabella">
        <div role="row" className="sg-lista-testa sg-righe-vestiario">
          {['PER CHI', 'CAPO', 'TAGLIA', 'QUANTI', 'PREZZO'].map((t, i) => (
            <span key={t} role="columnheader" className="sg-etichetta" style={i === 4 ? { textAlign: 'right' } : undefined}>
              {t}
            </span>
          ))}
          <span role="columnheader" />
        </div>
        {righe.map((r, i) => {
          const capo = capi.find((c) => c.capo === r.capo)
          const id = (k: string) => `ve-r${r.chiave}-${k}`
          return (
            <div key={r.chiave} role="row" className="sg-righe-vestiario sg-riga-vestiario-campi">
              <span role="cell" className="stack sg-cella-riga">
                {/* L'etichetta si vede solo sotto i 1000px, dove la testata della tabella non c'è. */}
                <label htmlFor={id('chi')} className="sg-etichetta sg-etichetta-campo">
                  PER CHI
                  <span className="vh">, riga {i + 1}</span>
                </label>
                <input id={id('chi')} className="sg-campo" maxLength={160} placeholder="Nome e cognome" value={r.perChi} onChange={(e) => cambia(r.chiave, { perChi: e.target.value })} />
              </span>
              <span role="cell" className="stack sg-cella-riga">
                {/* L'etichetta si vede solo sotto i 1000px, dove la testata della tabella non c'è. */}
                <label htmlFor={id('capo')} className="sg-etichetta sg-etichetta-campo">
                  CAPO
                  <span className="vh">, riga {i + 1}</span>
                </label>
                <select
                  id={id('capo')}
                  className="sg-campo"
                  value={r.capo}
                  onChange={(e) => cambia(r.chiave, { capo: e.target.value, taglia: tagliaDopo(capi, e.target.value, r.taglia) })}
                >
                  <option value="">Scegli</option>
                  {capi.map((c) => (
                    <option key={c.capo} value={c.capo}>
                      {c.capo}
                    </option>
                  ))}
                </select>
              </span>
              <span role="cell" className="stack sg-cella-riga">
                {/* L'etichetta si vede solo sotto i 1000px, dove la testata della tabella non c'è. */}
                <label htmlFor={id('taglia')} className="sg-etichetta sg-etichetta-campo">
                  TAGLIA
                  <span className="vh">, riga {i + 1}</span>
                </label>
                <select id={id('taglia')} className="sg-campo" aria-invalid={!!capo && !capo.taglie.includes(r.taglia)} value={r.taglia} disabled={!capo} onChange={(e) => cambia(r.chiave, { taglia: e.target.value })}>
                  <option value="">Scegli</option>
                  {capo?.taglie.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </span>
              <span role="cell" className="stack sg-cella-riga">
                {/* L'etichetta si vede solo sotto i 1000px, dove la testata della tabella non c'è. */}
                <label htmlFor={id('quanti')} className="sg-etichetta sg-etichetta-campo">
                  QUANTI
                  <span className="vh">, riga {i + 1}</span>
                </label>
                <select id={id('quanti')} className="sg-campo num" value={r.quanti} onChange={(e) => cambia(r.chiave, { quanti: Number(e.target.value) })}>
                  {Array.from({ length: MAX_QUANTI }, (_, k) => (
                    <option key={k} value={k + 1}>
                      {k + 1}
                    </option>
                  ))}
                </select>
              </span>
              <span role="cell" className="num" style={{ fontSize: 16, fontWeight: 700, textAlign: 'right' }}>
                {capo ? inEuro(prezzi[i] * r.quanti) : '—'}
              </span>
              <span role="cell" style={{ textAlign: 'right' }}>
                {righe.length > 1 && (
                  <button type="button" className="sg-link sg-link-alto" aria-label={`Togli la riga ${i + 1}`} onClick={() => onCambia(righe.filter((x) => x.chiave !== r.chiave))}>
                    Togli
                  </button>
                )}
              </span>
            </div>
          )
        })}
      </div>
      <button type="button" className="sg-btn sg-btn-tratteggio" style={{ alignSelf: 'flex-start' }} disabled={righe.length >= MAX_RIGHE} onClick={() => onCambia([...righe, rigaVuota(righe[righe.length - 1]?.perChi)])}>
        + AGGIUNGI UNA RIGA
      </button>
      {righe.length >= MAX_RIGHE && <span className="sg-sotto">{MAX_RIGHE_DETTO}</span>}
    </>
  )
}

/** La riga del totale, con quello di prima barrato se è cambiato. */
function Totale({ totale, prima }: { totale: number; prima?: number }) {
  return (
    <div className="row sg-vestiario-totale">
      <span className="grow" style={{ fontSize: 17, fontWeight: 700 }}>
        Totale
      </span>
      {prima !== undefined && prima !== totale && (
        <span className="num" style={{ fontSize: 14, color: 'var(--dim)', textDecoration: 'line-through' }}>
          {inEuro(prima)}
        </span>
      )}
      <span className="num" style={{ fontSize: 26, fontWeight: 700 }}>
        {inEuro(totale)}
      </span>
    </div>
  )
}

/** Quel che manca nelle righe, in una frase: «Manca: la taglia della riga 2». */
const mancaNelleRighe = (righe: RigaCorretta[], capi: Capo[]) => {
  // Solo le righe: chi ordina qui non c'è, e un contatto finto non deve dire niente.
  const primo = mancaNellOrdine({ nome: '-', cognome: '-', telefono: '-', righe }, capi).find((m) => m.chiave.startsWith('r'))
  return primo ? detto(primo) : null
}

function SchedaOrdine({
  d,
  o,
  capi,
  raccolte,
  oggi,
  fai,
  lavora,
  onCambiato,
  onSpostato,
}: {
  d: DatiVestiario
  o: Ordine
  capi: Capo[]
  raccolte: Raccolta[]
  oggi: string
  fai: Fai
  lavora: boolean
  onCambiato: () => Promise<void>
  /** Spostato, l'ordine non è più nella raccolta aperta: si torna al suo elenco. */
  onSpostato: () => void
}) {
  const stato = statoOrdine(o)
  const chi = `${o.nome} ${o.cognome}`
  const base = useMemo(() => o.righe.map((r) => ({ ...r, chiave: chiave() })), [o.righe])
  const [bozza, setBozza] = useState<RigaScritta[] | null>(null)
  const righe = bozza ?? base
  const scelte = useMemo(() => capiPerCorreggere(capi, o.righe), [capi, o.righe])
  const prezzi = righe.map((r) => prezzoRiga(o.righe, r, capi))
  const totale = totaleCorretto(o.righe, senzaChiave(righe), capi)
  const giusta = (r: RigaCorretta) => JSON.stringify([r.id, r.perChi.trim(), r.capo, r.taglia, r.quanti])
  const cambiato = !!bozza && senzaChiave(bozza).map(giusta).join() !== o.righe.map(giusta).join()
  // Una riga che c'era e tiene capo e taglia vale anche se il catalogo non li ha più; le altre passano dal catalogo.
  const guaio = cambiato ? (mancaNelleRighe(senzaChiave(righe), scelte) ?? cosaNonVaRighe(senzaChiave(righe), capiPerRiga(o.righe, capi))) : null
  useBozza(cambiato, `L’ordine di ${chi}`)
  const raccolta = raccolte.find((r) => r.id === o.raccolta)
  // Prima le aperte, dove l'ordine può ancora partire; le chiuse dopo. Mai quella in cui sta già.
  const altre = doveSpostare(raccolte, o, oggi)
  const [dove, setDove] = useState(altre[0]?.id ?? '')

  const salva = async () => {
    // Un ordine saldato il cui totale sale: c'è una differenza da chiedere, e il segno va deciso prima.
    // Se scende resta saldato: la lib non avvisa.
    const avviso = avvisoSaldato(o, totale)
    const togli =
      !!avviso &&
      (await chiedi(`Togliere il segno di saldato? ${avviso} Togli il segno per chiedere la differenza; resta saldato se è già a posto.`, 'TOGLI IL SEGNO', {
        no: 'RESTA SALDATO',
      }))
    // Una chiamata sola: il già pagato resta il vecchio totale, da saldare c'è la differenza.
    void fai(
      () => d.correggiRighe(o.id, senzaChiave(righe), togli),
      togli ? `Righe salvate: il totale è ${inEuro(totale)}, da saldare` : `Righe salvate: il totale è ${inEuro(totale)}`,
      async () => {
        setBozza(null)
        await onCambiato()
      },
    )
  }
  const butta = async () => {
    if (await chiedi(`Buttare i cambi alle righe di ${chi}? L’ordine torna com’è salvato.`, 'BUTTA I CAMBI', { pericolo: true })) setBozza(null)
  }
  const annulla = async () => {
    if (
      !(await chiedi(
        `Annullare l’ordine di ${chi}? L’ordine resta nell’elenco, segnato ANNULLATO: non va al fornitore e non conta nei numeri. Se ha già pagato, il rimborso si fa a mano.`,
        'ANNULLA L’ORDINE',
        { no: 'LASCIA STARE' },
      ))
    )
      return
    void fai(() => d.annulla(o.id, true), 'Ordine annullato', onCambiato)
  }

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="stack" style={{ gap: 4 }}>
        <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
          <h1 className="ob sg-titolo" tabIndex={-1}>
            {chi.toUpperCase()}
          </h1>
          <Segno stato={stato} />
        </div>
        <span className="sg-sotto">
          {[arrivo(o), o.telefono, o.email, raccolta && `raccolta che chiude ${ilGiorno(raccolta.chiude)}`].filter(Boolean).join(' · ')}
        </span>
      </div>

      <div className="sg-vestiario-ordine">
        <section aria-label="Le righe" className="sg-riquadro">
          <span className="sg-etichetta">LE RIGHE · {righe.reduce((s, r) => s + r.quanti, 0)} CAPI</span>
          {o.annullato ? (
            <>
              {/* Annullato non si corregge: prima si rimette, così una correzione non finisce su un ordine che non parte. */}
              <ul className="stack sg-vestiario-sola-lettura">
                {o.righe.map((r) => (
                  <li key={r.id} className="row" style={{ gap: 12 }}>
                    <span className="grow">
                      {r.perChi} · {r.capo} {r.taglia}
                      {r.quanti > 1 ? ` × ${r.quanti}` : ''}
                    </span>
                    <span className="num">{inEuro(r.quanti * r.prezzo)}</span>
                  </li>
                ))}
              </ul>
              <span className="sg-sotto">Rimetti l’ordine per correggerlo.</span>
            </>
          ) : (
            <RigheTabella righe={righe} capi={scelte} prezzi={prezzi} onCambia={setBozza} />
          )}
          <Totale totale={totale} prima={cambiato ? o.totale : undefined} />
          <span className="sg-sotto">Ogni riga tiene il prezzo di quando è arrivata: se il catalogo cambia, l’ordine no. Una riga nuova prende il prezzo di adesso.</span>
          {cambiato && (
            <div className="sg-listino-salva">
              <span className="grow" style={{ fontSize: 14, color: guaio ? 'var(--rosso-testo)' : 'var(--sec)' }}>
                {guaio ??
                  `Righe cambiate: il totale ${totale === o.totale ? `resta ${inEuro(totale)}` : `passa da ${inEuro(o.totale)} a ${inEuro(totale)}`}. Fino a SALVA l’ordine resta com’era.`}
              </span>
              <button type="button" className="sg-btn sg-btn-linea" disabled={lavora} onClick={() => void butta()}>
                BUTTA I CAMBI
              </button>
              <button type="button" className="sg-btn sg-btn-pieno" disabled={!!guaio || lavora} onClick={() => void salva()}>
                SALVA
              </button>
            </div>
          )}
        </section>

        <div className="stack sg-vestiario-pagamento" style={{ gap: 20, minWidth: 0 }}>
          <section aria-label="Il pagamento" className="sg-riquadro" data-fatto={stato === 'saldato'}>
            <span className="sg-etichetta">IL PAGAMENTO</span>
            <div className="row" style={{ gap: 12, alignItems: 'baseline' }}>
              <Segno stato={stato} />
              <span className="num" style={{ fontSize: 26, fontWeight: 700 }}>
                {inEuro(o.totale)}
              </span>
            </div>
            {stato === 'da saldare' && (
              <>
                {o.pagato > 0 && (
                  <span className="num" style={{ fontSize: 15 }}>
                    Pagati {inEuro(o.pagato)} · mancano {inEuro(mancanoOrdine(o))}
                  </span>
                )}
                <span className="sg-sotto">Con bonifico (causale «{causaleVestiario(o)}»), Satispay o contanti. Il segno è a mano: niente ricevuta.</span>
                {/* Un tasto per modo: si segna com'è arrivato, senza un passo in più. */}
                <span className="sg-etichetta">SEGNA SALDATO</span>
                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  {PAGAMENTI.map((come) => (
                    <button key={come} type="button" className="sg-btn sg-btn-verde" disabled={lavora} onClick={() => void fai(() => d.segnaSaldato(o.id, come), `Segnato saldato ${PAGATO[come]}`, onCambiato)}>
                      {come.toUpperCase()}
                    </button>
                  ))}
                </div>
              </>
            )}
            {stato === 'saldato' && (
              <>
                <span className="sg-sotto">
                  Saldato{o.pagatoCon ? ` ${PAGATO[o.pagatoCon]}` : ''}
                  {o.pagatoIl ? ` ${ilGiorno(o.pagatoIl)}` : ''}. Va nell’elenco per il fornitore.
                </span>
                <button type="button" className="sg-link sg-link-alto" disabled={lavora} onClick={() => void fai(() => d.segnaSaldato(o.id, null), 'Tolto il segno: è di nuovo da saldare', onCambiato)}>
                  Togli il segno
                </button>
              </>
            )}
            {stato === 'annullato' && (
              <>
                <span className="sg-sotto">Resta qui, ma non va al fornitore e non conta nei numeri.</span>
                <button type="button" className="sg-link sg-link-alto" disabled={lavora} onClick={() => void fai(() => d.annulla(o.id, false), 'Ordine rimesso', onCambiato)}>
                  Rimetti l’ordine
                </button>
              </>
            )}
          </section>

          <section aria-label="Altro" className="sg-riquadro">
            <span className="sg-etichetta">ALTRO</span>
            {altre.length > 0 ? (
              <>
                <div className="row" style={{ gap: 10, alignItems: 'flex-end' }}>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <Campo id="ve-sposta" etichetta="SPOSTA A UN’ALTRA RACCOLTA">
                      <select id="ve-sposta" className="sg-campo" style={{ width: '100%' }} value={dove} onChange={(e) => setDove(e.target.value)}>
                        {altre.map((r) => (
                          <option key={r.id} value={r.id}>
                            {nomeRaccolta(r, oggi)}
                          </option>
                        ))}
                      </select>
                    </Campo>
                  </div>
                  <button type="button" className="sg-btn sg-btn-linea" disabled={lavora || !dove} onClick={() => void fai(() => d.sposta(o.id, dove), 'Ordine spostato: ora è nell’altra raccolta', async () => {
                      onSpostato()
                      await onCambiato()
                    })}>
                    SPOSTA
                  </button>
                </div>
                <span className="sg-sotto">Per chi paga dopo la chiusura: l’ordine passa alla raccolta scelta, coi suoi prezzi.</span>
              </>
            ) : (
              <span className="sg-sotto">Non ci sono altre raccolte a cui spostarlo.</span>
            )}
            {!o.annullato && (
              <button type="button" className="sg-btn sg-btn-linea" style={{ alignSelf: 'flex-start' }} disabled={lavora} onClick={() => void annulla()}>
                ANNULLA L’ORDINE
              </button>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function NuovoOrdine({
  d,
  capi,
  raccolta,
  fai,
  lavora,
  onFatto,
  onLascia,
  onCatalogo,
  onApri,
}: {
  d: DatiVestiario
  capi: Capo[]
  raccolta?: Raccolta
  fai: Fai
  lavora: boolean
  onFatto: () => Promise<void>
  onLascia: () => void
  onCatalogo: () => void
  onApri: (id: string) => void
}) {
  const [come, setCome] = useState<Pagamento>('contanti')
  // L'id nasce all'apertura: se la rete cade, SALVA rimanda lo stesso ordine, non un secondo.
  const [id, setId] = useState(() => crypto.randomUUID())
  const [chi, setChi] = useState({ nome: '', cognome: '', telefono: '', email: '' })
  const [righe, setRighe] = useState<RigaScritta[]>(() => [rigaVuota()])
  const toccato = !!(chi.nome || chi.cognome || chi.telefono || chi.email || righe.some((r) => r.perChi || r.capo))
  useBozza(toccato, 'Il nuovo ordine')
  const ordine = { id, ...chi, righe: senzaChiave(righe) }
  // Nell'ordine della pagina: prima chi ordina, poi le righe.
  const manca = mancaNellOrdine(ordine, capi)
  const primo = manca.find((m) => !m.chiave.startsWith('r')) ?? manca[0]
  // La barra del genitore dice «il tuo nome»; al banco chi scrive non è chi ordina.
  const guaio = primo ? detto(primo) : cosaNonVaOrdine(ordine, capi)
  const prezzi = righe.map((r) => prezzoDi(capi, r.capo))
  const totale = totaleCorretto([], ordine.righe, capi)
  const salva = async (pagato: Pagamento | null) => {
    // Lo stesso telefono nella raccolta: forse è lo stesso ordine, arrivato anche dal link.
    // Se gli ordini non si leggono, lo dice `fai` come ogni altro errore: meglio che salvare alla cieca.
    let gia: Ordine | undefined
    const letti = await fai(async () => {
      gia = raccolta ? ordineConStessoTelefono(await d.ordini(raccolta.id), chi.telefono, id) : undefined
    })
    if (!letti) return
    if (
      gia &&
      !(await chiedi(`C’è già un ordine di ${gia.nome} ${gia.cognome} con questo telefono, ${arrivo(gia).replace(/^Arrivato/, 'arrivato')}. Salvarne un altro?`, 'SALVA LO STESSO', { no: 'APRI QUELLO' }))
    )
      return onApri(gia.id)
    void fai(() => d.scriviOrdine(ordine, pagato), pagato ? `Ordine salvato, già saldato ${PAGATO[pagato]}` : 'Ordine salvato: è da saldare', async () => {
      setChi({ nome: '', cognome: '', telefono: '', email: '' })
      setRighe([rigaVuota()])
      setId(crypto.randomUUID())
      await onFatto()
    })
  }
  const campo = (k: keyof typeof chi, etichetta: string, tipo = 'text') => (
    <Campo id={`ve-${k}`} etichetta={etichetta}>
      <input id={`ve-${k}`} className="sg-campo" type={tipo} maxLength={k === 'email' ? 160 : k === 'telefono' ? 30 : 80} value={chi[k]} onChange={(e) => setChi({ ...chi, [k]: e.target.value })} />
    </Campo>
  )
  return (
    <div className="stack" style={{ gap: 18, maxWidth: 980 }}>
      <Testa titolo="NUOVO ORDINE" sotto="Dal banco, per chi non usa il link. Si può scrivere anche a raccolta chiusa." />
      <section aria-label="Chi ordina" className="sg-riquadro">
        <span className="ob sg-riquadro-titolo">CHI ORDINA</span>
        <div className="sg-due">
          {campo('nome', 'NOME')}
          {campo('cognome', 'COGNOME')}
          {campo('telefono', 'TELEFONO', 'tel')}
          {campo('email', 'EMAIL · FACOLTATIVA', 'email')}
        </div>
        {raccolta && <span className="sg-sotto">Va nella raccolta di adesso: {nomeRaccolta(raccolta, chiaveGiorno(new Date())).toLowerCase()}. Per un’altra, spostalo dopo dall’ordine.</span>}
      </section>
      <section aria-label="Le righe" className="sg-riquadro">
        <span className="ob sg-riquadro-titolo">LE RIGHE</span>
        {!capi.length && (
          <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
            <span className="grow" style={{ fontSize: 14, color: 'var(--rosso-testo)' }}>
              Prima metti i capi in CATALOGO E CHIUSURA.
            </span>
            <button type="button" className="sg-btn sg-btn-linea" onClick={onCatalogo}>
              CATALOGO E CHIUSURA
            </button>
          </div>
        )}
        <RigheTabella righe={righe} capi={capi} prezzi={prezzi} onCambia={setRighe} />
        <Totale totale={totale} />
      </section>
      {guaio && <span style={{ fontSize: 14, color: 'var(--rosso-testo)' }}>{guaio}</span>}
      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className="sg-btn sg-btn-pieno" disabled={!!guaio || lavora} onClick={() => void salva(null)}>
          SALVA L’ORDINE
        </button>
        <span className="row" style={{ gap: 6 }}>
          <button type="button" className="sg-btn sg-btn-verde" disabled={!!guaio || lavora} onClick={() => void salva(come)}>
            SALVA, GIÀ SALDATO
          </button>
          <label htmlFor="ve-come" className="vh">
            Come ha pagato
          </label>
          <select id="ve-come" className="sg-campo" value={come} onChange={(e) => setCome(PAGAMENTI.find((p) => p === e.target.value) ?? 'contanti')}>
            {PAGAMENTI.map((p) => (
              <option key={p} value={p}>
                {PAGATO[p]}
              </option>
            ))}
          </select>
        </span>
        <button type="button" className="sg-btn sg-btn-linea" onClick={onLascia}>
          LASCIA STARE
        </button>
      </div>
    </div>
  )
}

/** La bozza del catalogo di `vestiarioPagina.ts`, con una chiave per capo: per React e per CAMBIA. */
type CapoScritto = BozzaScritta['capi'][number] & {
  chiave: number
  /** La foto salvata, per dire «tolta: si cancella con SALVA». */
  fotoPrima?: string
}
type BozzaCatalogo = { chiude: string; capi: CapoScritto[]; tabelle: Tabelle }

const scritto = (n: number) => n.toLocaleString('it-IT', { maximumFractionDigits: 2, useGrouping: false })
const bozzaDa = (c: Catalogo | null): BozzaCatalogo => ({
  chiude: c?.chiude ?? '',
  capi: (c?.capi ?? []).map((x) => ({
    chiave: chiave(),
    capo: x.capo,
    prezzo: scritto(x.prezzo),
    taglie: x.taglie.join(', '),
    nota: x.nota ?? '',
    tipo: x.tipo ?? '',
    ...(x.foto && { foto: x.foto, fotoPrima: x.foto }),
  })),
  tabelle: { ...c?.tabelle },
})

/**
 * Una foto scelta e non ancora salvata: nella bozza c'è un nome finto
 * (`nuova-….jpg`, della stessa forma di un file vero, così le regole del
 * catalogo valgono uguali), e il file vero va sul server solo con SALVA.
 */
interface FotoNuova {
  blob: Blob
  /** `URL.createObjectURL`, rilasciato quando la foto si sostituisce, si toglie o si esce. */
  url: string
  nomeFile: string
}

/** La foto di un capo o la tabella di un tipo: miniatura, cosa c'è, CARICA FOTO / SOSTITUISCI e «Togli la foto». */
function CaricaFoto({
  id,
  etichetta,
  url,
  frase,
  nuova,
  cosa = 'FOTO',
  avviso,
  errore,
  onFile,
  onTogli,
}: {
  id: string
  etichetta: string
  /** La parola sui tasti e nel riquadro vuoto: FOTO per un capo, TABELLA per un tipo. */
  cosa?: 'FOTO' | 'TABELLA'
  url: string
  frase: string
  nuova: boolean
  avviso?: string
  errore?: string
  onFile: (f: File) => void
  onTogli?: () => void
}) {
  return (
    <div className="sg-carica-foto">
      <span className="sg-carica-foto-mini" data-vuota={!url || undefined}>
        {url ? <img src={url} alt="" /> : <span>NESSUNA {cosa}</span>}
        {nuova && <span className="num sg-carica-foto-nuova">NUOVA</span>}
      </span>
      <span className="stack grow" style={{ gap: 6, minWidth: 0 }}>
        <span className="sg-etichetta">{etichetta}</span>
        <span style={{ fontSize: 14, color: 'var(--sec)', overflowWrap: 'anywhere' }}>{frase}</span>
        <span className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
          <label className="sg-btn sg-btn-linea" htmlFor={id}>
            {url ? 'SOSTITUISCI' : cosa === 'FOTO' ? 'CARICA FOTO' : 'CARICA LA TABELLA'}
          </label>
          <input
            id={id}
            type="file"
            accept="image/*"
            className="vh"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) onFile(f)
            }}
          />
          {onTogli && (
            <button type="button" className="sg-link sg-link-alto" onClick={onTogli}>
              {cosa === 'FOTO' ? 'Togli la foto' : 'Togli la tabella'}
            </button>
          )}
        </span>
        {avviso && <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--giallo-testo)' }}>{avviso}</span>}
        {errore && <span style={{ fontSize: 14, color: 'var(--rosso-testo)' }}>{errore}</span>}
      </span>
    </div>
  )
}

/** Sotto CHIUDE IL: cosa farà SALVA alle raccolte, e poi cosa dirà la pagina con quella data. */
function notaChiude(cosa: 'solo capi' | 'proroga' | 'raccolta nuova', chiude: string | undefined, raccolta: Raccolta | undefined, conCapi: boolean, oggi: string) {
  const fa =
    cosa === 'proroga'
      ? `SALVA sposta la chiusura della raccolta di adesso: gli ordini arrivati restano dentro.`
      : cosa === 'raccolta nuova'
        ? `SALVA apre una raccolta nuova${raccolta ? ': gli ordini di prima restano nella loro' : ''}.`
        : raccolta
          ? `Cambia la data per prorogare o aprire una raccolta nuova; senza cambiarla SALVA cambia solo i capi (la raccolta chiude ${ilGiorno(raccolta.chiude)}).`
          : 'Senza data non si apre nessuna raccolta: la pagina resta chiusa.'
  const pagina = !chiude
    ? ''
    : !conCapi
      ? ' Senza capi la pagina resta chiusa: aggiungine almeno uno.'
      : chiude < oggi
        ? ` La data è passata: la pagina dice che gli ordini sono chiusi.`
        : ` Fino ${alGiorno(chiude)} compreso la pagina accetta ordini; dopo dice che sono chiusi.`
  return fa + pagina
}

function CatalogoChiusura({
  d,
  salvato,
  raccolta,
  oggi,
  vedi,
  fai,
  lavora,
  onSalvato,
}: {
  d: DatiVestiario
  salvato: Catalogo | null
  /** La raccolta di adesso: decide se SALVA proroga, ne apre una nuova o cambia solo i capi. */
  raccolta?: Raccolta
  oggi: string
  vedi: React.ReactNode
  fai: Fai
  lavora: boolean
  onSalvato: () => Promise<void>
}) {
  const base = useMemo(() => bozzaDa(salvato), [salvato])
  const [bozza, setBozza] = useState<BozzaCatalogo | null>(null)
  const [aperto, setAperto] = useState<number | null>(null)
  // Senza il 50 niente tipi né foto: il database li butterebbe via.
  const conFoto = fotoAttive() !== false
  const [nuove, setNuove] = useState<Record<string, FotoNuova>>({})
  const [guaiFoto, setGuaiFoto] = useState<Record<string, string>>({})
  const tutteLeNuove = useRef(nuove)
  tutteLeNuove.current = nuove
  // Uscendo dalla pagina le anteprime si rilasciano: il browser le terrebbe in memoria.
  useEffect(() => () => Object.values(tutteLeNuove.current).forEach((f) => URL.revokeObjectURL(f.url)), [])
  const b = bozza ?? base
  // Sulla bozza di adesso, non su quella di quando è partito il cambio: una foto entra dopo un'attesa.
  const cambia = (x: Partial<BozzaCatalogo> | ((b: BozzaCatalogo) => Partial<BozzaCatalogo>)) =>
    setBozza((ora) => {
      const di = ora ?? base
      return { ...di, ...(typeof x === 'function' ? x(di) : x) }
    })
  const cambiaCapo = (k: number, x: Partial<CapoScritto>) => cambia((di) => ({ capi: di.capi.map((c) => (c.chiave === k ? { ...c, ...x } : c)) }))
  const pronto = catalogoDaBozza(b)
  const guaio = 'guaio' in pronto ? pronto.guaio : null
  const senza = (x: BozzaCatalogo) => JSON.stringify({ ...x, capi: x.capi.map(({ chiave: _, ...c }) => c) })
  const cambiato = !!bozza && senza(bozza) !== senza(base)
  useBozza(cambiato, 'Catalogo del vestiario')
  const urlDi = (nome?: string) => (!nome ? '' : (nuove[nome]?.url ?? d.urlFoto(nome)))
  /** Le anteprime che la bozza non usa più si rilasciano; con `tutte` anche le altre (dopo SALVA o BUTTA). */
  const rilascia = (usati: Set<string>) => {
    const restano: Record<string, FotoNuova> = {}
    for (const [nome, f] of Object.entries(nuove)) {
      if (usati.has(nome)) restano[nome] = f
      else URL.revokeObjectURL(f.url)
    }
    setNuove(restano)
  }
  /**
   * Una foto scelta: si riduce subito (JPEG, lato 1600, 1 MB), così un'immagine che non si apre o resta
   * troppo grande lo dice sulla foto giusta; poi entra nella bozza col suo nome finto. Il server la vede solo con SALVA.
   */
  const scegliFoto = async (posto: string, scelta: File, metti: (nome: string | undefined) => void, prima?: string) => {
    let f: File
    try {
      f = await riduciFoto(scelta, FOTO_VESTIARIO)
    } catch (e) {
      return setGuaiFoto((g) => ({ ...g, [posto]: e instanceof Error && e.message === TROPPO_GRANDE ? TROPPO_GRANDE : NON_SI_APRE }))
    }
    const url = URL.createObjectURL(f)
    setGuaiFoto(({ [posto]: _, ...g }) => g)
    const nome = `nuova-${crypto.randomUUID()}.jpg`
    setNuove((n) => {
      // Una foto nuova al posto di un'altra nuova: la vecchia anteprima non serve più.
      if (prima && n[prima]) URL.revokeObjectURL(n[prima].url)
      const { [prima ?? '']: _, ...resto } = n
      return { ...resto, [nome]: { blob: f, url, nomeFile: scelta.name } }
    })
    metti(nome)
  }
  const togliNuova = (nome?: string) => {
    if (!nome || !nuove[nome]) return
    URL.revokeObjectURL(nuove[nome].url)
    setNuove(({ [nome]: _, ...resto }) => resto)
  }
  /** Cosa SALVA cancellerà, per nome: la segreteria lo sa prima. */
  const siCancella = 'catalogo' in pronto && salvato ? cosaSiCancella(salvato, pronto.catalogo) : ''
  // Non blocca SALVA: la segreteria può volere la pagina sola, ma deve saperlo prima.
  const senzaTipo = 'catalogo' in pronto ? capiSenzaTipo(pronto.catalogo.capi) : b.capi.filter((c) => !c.tipo && c.capo.trim()).map((c) => c.capo.trim())
  const sposta = (i: number, verso: -1 | 1) => {
    const capi = [...b.capi]
    ;[capi[i], capi[i + verso]] = [capi[i + verso], capi[i]]
    cambia({ capi })
  }
  const effetto = effettoSalvataggio(raccolta, b.chiude || null, oggi)
  const salva = async () => {
    if (!('catalogo' in pronto)) return
    const nuovo = pronto.catalogo
    if (effetto.avviso && !(await chiedi(`Salvare il catalogo? ${effetto.avviso}`, 'SALVA LO STESSO', { no: 'TORNA A CORREGGERE' }))) return
    // L'avviso dice cosa è successo alle raccolte, con la data: è lì che si sbaglia.
    const fatto =
      effetto.cosa === 'proroga' && nuovo.chiude
        ? `Catalogo salvato. Chiusura spostata ${alGiorno(nuovo.chiude)}`
        : effetto.cosa === 'raccolta nuova' && nuovo.chiude
          ? `Catalogo salvato. Raccolta nuova, chiude ${ilGiorno(nuovo.chiude)}`
          : 'Catalogo salvato'
    void fai(
      // Prima le foto nuove della bozza, poi il catalogo coi nomi veri, poi via i file di prima; se cade, via quelli appena caricati.
      () => salvaConFoto(d, nuovo, Object.fromEntries(Object.entries(nuove).map(([n, f]) => [n, f.blob])), salvato),
      fatto,
      async () => {
        await onSalvato()
        rilascia(new Set())
        setBozza(null)
        setAperto(null)
      },
    )
  }
  const butta = async () => {
    if (!(await chiedi('Buttare i cambi al catalogo? Torna com’è salvato, quello che vede la pagina degli ordini.', 'BUTTA I CAMBI', { pericolo: true }))) return
    rilascia(new Set())
    setGuaiFoto({})
    setBozza(null)
    setAperto(null)
  }

  return (
    <div className="stack" style={{ gap: 18 }}>
      <Testa titolo="CATALOGO E CHIUSURA" sotto="Quello che vede chi ordina dal link. Si cambia in una bozza e si salva tutto insieme, come il listino.">
        {vedi}
      </Testa>
      {cambiato && <span className="sg-sotto" style={{ color: 'var(--giallo-testo)' }}>VEDI LA PAGINA mostra quello salvato: i cambi e le foto nuove si vedono dopo SALVA.</span>}
      <div className="stack sg-listino" style={{ gap: 20 }}>
        {!conFoto && (
          <section aria-label="Tipi e foto" className="sg-riquadro">
            <span className="ob sg-riquadro-titolo">TIPI E FOTO</span>
            <span className="sg-sotto">{MANCA_FOTO}. Fino ad allora i capi stanno tutti su una pagina, senza foto.</span>
          </section>
        )}
        <section aria-label="La raccolta" className="sg-riquadro">
          <span className="ob sg-riquadro-titolo">LA RACCOLTA</span>
          <div style={{ width: 280, maxWidth: '100%' }}>
            <Campo id="ve-chiude" etichetta="CHIUDE IL">
              <input id="ve-chiude" className="sg-campo" type="date" value={b.chiude} onChange={(e) => cambia({ chiude: e.target.value })} />
            </Campo>
          </div>
          <span className="sg-sotto">
            {notaChiude(effetto.cosa, b.chiude || raccolta?.chiude, raccolta, b.capi.length > 0, oggi)}
          </span>
        </section>

        <section aria-label="I capi" className="sg-riquadro">
          <span className="ob sg-riquadro-titolo">I CAPI · {b.capi.length}</span>
          <span className="sg-sotto">
            In quest’ordine nella pagina. Un prezzo per capo, uguale per tutte le taglie: due prezzi sono due capi. Un prezzo cambiato vale per gli ordini nuovi.
            {conFoto && ' Il TIPO dice in che pagina sta il capo; se anche un capo solo è senza tipo, la pagina non chiede il tipo e mostra tutti i capi insieme.'}
          </span>
          {b.capi.map((c, i) => {
            const id = (k: string) => `vc-${c.chiave}-${k}`
            return aperto === c.chiave ? (
              <div key={c.chiave} className="stack sg-listino-corso">
                <div className="sg-vestiario-capo">
                  <Campo id={id('capo')} etichetta="CAPO">
                    <input id={id('capo')} className="sg-campo" maxLength={80} value={c.capo} onChange={(e) => cambiaCapo(c.chiave, { capo: e.target.value })} />
                  </Campo>
                  <Campo id={id('prezzo')} etichetta="PREZZO · €">
                    <input id={id('prezzo')} className="sg-campo num" inputMode="decimal" maxLength={10} value={c.prezzo} onChange={(e) => cambiaCapo(c.chiave, { prezzo: e.target.value })} />
                  </Campo>
                  {conFoto && (
                    <Campo id={id('tipo')} etichetta="TIPO · FACOLTATIVO">
                      <select id={id('tipo')} className="sg-campo" value={c.tipo ?? ''} onChange={(e) => cambiaCapo(c.chiave, { tipo: TIPI.find((t) => t.id === e.target.value)?.id ?? '' })}>
                        <option value="">Senza tipo</option>
                        {TIPI.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.nome}
                          </option>
                        ))}
                      </select>
                    </Campo>
                  )}
                </div>
                <Campo id={id('taglie')} etichetta="TAGLIE · SEPARATE DA VIRGOLA">
                  <input id={id('taglie')} className="sg-campo" maxLength={600} placeholder="110, 120, 130" value={c.taglie} onChange={(e) => cambiaCapo(c.chiave, { taglie: e.target.value })} />
                </Campo>
                <Campo id={id('nota')} etichetta="NOTA SULLE TAGLIE · FACOLTATIVA">
                  <input id={id('nota')} className="sg-campo" maxLength={300} placeholder="Altezza del bambino + 10 cm" value={c.nota} onChange={(e) => cambiaCapo(c.chiave, { nota: e.target.value })} />
                </Campo>
                {conFoto && (
                  <CaricaFoto
                    id={id('foto')}
                    etichetta="FOTO · FACOLTATIVA"
                    url={urlDi(c.foto)}
                    nuova={!!(c.foto && nuove[c.foto])}
                    frase={
                      c.foto && nuove[c.foto]
                        ? `${nuove[c.foto].nomeFile} · va sulla pagina con SALVA`
                        : c.foto
                          ? 'La foto che vede chi ordina'
                          : c.fotoPrima
                            ? 'Tolta: il file si cancella con SALVA'
                            : 'Nessuna foto'
                    }
                    avviso="Solo il capo, niente persone: la foto è pubblica"
                    errore={guaiFoto[`capo-${c.chiave}`]}
                    onFile={(f) => void scegliFoto(`capo-${c.chiave}`, f, (nome) => cambiaCapo(c.chiave, { foto: nome }), c.foto)}
                    onTogli={
                      c.foto
                        ? () => {
                            togliNuova(c.foto)
                            cambiaCapo(c.chiave, { foto: undefined })
                          }
                        : undefined
                    }
                  />
                )}
                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="num sg-chip" disabled={i === 0} onClick={() => sposta(i, -1)} aria-label="Più su">
                    ↑ SU
                  </button>
                  <button type="button" className="num sg-chip" disabled={i === b.capi.length - 1} onClick={() => sposta(i, 1)} aria-label="Più giù">
                    ↓ GIÙ
                  </button>
                  <button
                    type="button"
                    className="sg-link sg-link-alto"
                    onClick={async () => {
                      if (await chiedi(`Togliere «${c.capo || 'questo capo'}» dal catalogo? Gli ordini già fatti restano come sono.`, 'TOGLI DAL CATALOGO')) cambia({ capi: b.capi.filter((x) => x.chiave !== c.chiave) })
                    }}
                  >
                    Togli dal catalogo
                  </button>
                  <span className="grow" />
                  <button type="button" className="sg-btn sg-btn-linea" onClick={() => setAperto(null)}>
                    CHIUDI
                  </button>
                </div>
              </div>
            ) : (
              <div key={c.chiave} className="sg-voce-elenco">
                <span className="stack grow" style={{ minWidth: 0 }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>
                    {c.capo || 'Senza nome'}
                    {/* Basta un capo senza tipo e la pagina li mostra tutti insieme: si deve vedere senza aprirlo. */}
                    {conFoto && !c.tipo && (
                      <>
                        {' '}
                        <span className="num sg-tag" data-tipo="presto">
                          SENZA TIPO
                        </span>
                      </>
                    )}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--dim)' }}>
                    {[conFoto && c.tipo && nomeTipo(c.tipo), c.prezzo && `${c.prezzo} €`, c.taglie && `taglie ${c.taglie}`, c.nota, conFoto && (c.foto ? 'con foto' : 'senza foto')].filter(Boolean).join(' · ') ||
                      'Senza prezzo né taglie'}
                  </span>
                </span>
                <button type="button" className="num sg-chip" onClick={() => setAperto(c.chiave)}>
                  CAMBIA
                </button>
              </div>
            )
          })}
          <button
            type="button"
            className="sg-btn sg-btn-tratteggio"
            disabled={b.capi.length >= MAX_CAPI}
            onClick={() => {
              const nuovo: CapoScritto = { chiave: chiave(), capo: '', prezzo: '', taglie: '', nota: '' }
              cambia({ capi: [...b.capi, nuovo] })
              setAperto(nuovo.chiave)
            }}
          >
            + AGGIUNGI UN CAPO
          </button>
        </section>

        {conFoto && (
          <section aria-label="Le tabelle delle taglie" className="sg-riquadro">
            <span className="ob sg-riquadro-titolo">LE TABELLE DELLE TAGLIE</span>
            <span className="sg-sotto">Una per tipo, facoltativa: sta in cima alla pagina del tipo e chi ordina la apre grande. Anche la tabella è pubblica. Con la pagina sola sta in cima ai capi.</span>
            {TIPI.map((t) => {
              const file = b.tabelle[t.id]
              const prima = salvato?.tabelle?.[t.id]
              const metti = (nome: string | undefined) =>
                cambia((di) => {
                  const { [t.id]: _, ...resto } = di.tabelle
                  return { tabelle: nome ? { ...resto, [t.id]: nome } : resto }
                })
              return (
                <CaricaFoto
                  key={t.id}
                  id={`vt-${t.id}`}
                  etichetta={t.nome}
                  url={urlDi(file)}
                  nuova={!!(file && nuove[file])}
                  frase={file && nuove[file] ? `${nuove[file].nomeFile} · va sulla pagina con SALVA` : file ? 'La tabella che vede chi ordina' : prima ? 'Tolta: il file si cancella con SALVA' : 'Nessuna tabella'}
                  errore={guaiFoto[`tabella-${t.id}`]}
                  cosa="TABELLA"
                  onFile={(f) => void scegliFoto(`tabella-${t.id}`, f, metti, file)}
                  onTogli={
                    file
                      ? () => {
                          togliNuova(file)
                          metti(undefined)
                        }
                      : undefined
                  }
                />
              )
            })}
          </section>
        )}

        {cambiato && conFoto && senzaTipo.length > 0 && (
          <span className="sg-sotto" style={{ color: 'var(--giallo-testo)', fontWeight: 600 }}>
            Senza tipo: {senzaTipo.join(', ')}. La pagina mostrerà tutti i capi insieme.
          </span>
        )}
        {cambiato && (
          <div className="sg-listino-salva">
            <span className="grow" style={{ fontSize: 14, color: guaio ? 'var(--rosso-testo)' : 'var(--sec)' }}>
              {guaio ??
                `Ci sono cambi da salvare: fino ad allora la pagina degli ordini mostra il catalogo di prima.${siCancella ? ` ${siCancella}` : ''}`}
            </span>
            <button type="button" className="sg-btn sg-btn-linea" disabled={lavora} onClick={() => void butta()}>
              BUTTA I CAMBI
            </button>
            <button type="button" className="sg-btn sg-btn-pieno" disabled={!!guaio || lavora} onClick={() => void salva()}>
              SALVA
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
