import { useEffect, useMemo, useState } from 'react'
import { oggiARoma } from '../../lib/contabilita'
import { datiGare } from '../../lib/gareDati'
import {
  avvisoCertificati,
  candidatiGara,
  certificatoAllaGara,
  contiGara,
  corsoDi,
  dateGara,
  eliminabile,
  garaDaBozza,
  indirizziGoogle,
  linkMappa,
  ordinaGare,
  pagamentoPerRicevuta,
  riepilogoCertificati,
  righeGara,
  scrittaCertificato,
  suggerimenti,
  totaleQuota,
  ultimoGiorno,
  type AtletaGara,
  type BozzaGara,
  type ChiGuarda,
  type Gara,
  type RigaAtletaGara,
} from '../../lib/gare'
import { METODI_A_MANO, type DatiPagamentoDiretto } from '../../lib/pagamenti'
import { nucleoPerRicevuta } from '../../lib/nucleo'
import { nuovoId } from '../../lib/prove'
import { centesimi, euro, euroBreve } from '../../lib/ricevute'
import { dataLunga } from '../../lib/sala'
import { inCorso, type CorsoSeg, type DatiSegreteria, type Istruttore, type PersonaSeg } from '../../lib/segreteria'
import { giorniA } from '../../lib/vestiario'
import { Riquadro } from '../ds'
import { Bozza, Campo, chiedi, chiediSpunta, Guaio, lasciare, Riga as Titolo, SchedaPiena, Segmenti, suCarta, Testa, useAvviso, useCarica } from './comune'
import { NuovaRicevuta } from './Ricevute'

/**
 * GARE: le gare a cui vanno gli atleti, chi ci va, il certificato alla data
 * della gara e la quota a voci. L'elenco si apre in una scheda a tutta pagina;
 * modificare, aggiungere atleti e incassare in una finestra sopra. Le regole
 * stanno in `gare.ts`, i dati in `gareDati.ts`.
 */

type Pagina = { a: 'elenco' } | { a: 'gara'; id: string }
type Cassetto = { a: 'modifica'; id?: string } | { a: 'aggiungi'; id: string } | { a: 'incassa'; id: string; personaId: string }
type Fai = ReturnType<typeof useAvviso>['fai']

const STAFF: ChiGuarda = { ruolo: 'staff', personaId: '', corsiInsegnati: [] }

/** «fra 12 giorni», «in corso», «Gara passata». */
const quando = (g: Gara, oggi: string) => (g.dal > oggi ? giorniA(oggi, g.dal) : ultimoGiorno(g) >= oggi ? 'in corso' : 'Gara passata')

export function Gare({ d, apri, onCambiato }: { d: DatiSegreteria; /** Arrivando dalla SETTIMANA: la gara toccata. */ apri?: string; onCambiato: () => void }) {
  const dati = useCarica(async () => (await datiGare()).leggi(STAFF), [])
  const persone = useCarica(() => d.persone(), [d])
  const corsi = useCarica(() => d.corsi(), [d])
  const istruttori = useCarica(() => d.istruttori(), [d])
  const [pagina, setPagina] = useState<Pagina>(apri ? { a: 'gara', id: apri } : { a: 'elenco' })
  const [cassetto, setCassetto] = useState<Cassetto | null>(null)
  const [ricevuta, setRicevuta] = useState<{
    p: PersonaSeg
    dp: DatiPagamentoDiretto
    gara: string
  } | null>(null)
  const { avviso, avvisa, fai, lavora } = useAvviso()
  const oggi = oggiARoma()

  const gare = dati.dato?.gare ?? []
  const atleti = dati.dato?.atleti ?? []
  const tutti = persone.dato ?? []
  const aperta = pagina.a === 'gara' ? gare.find((g) => g.id === pagina.id) : undefined
  const garaCassetto = cassetto && 'id' in cassetto ? gare.find((g) => g.id === cassetto.id) : undefined
  const guaio = dati.guaio ?? persone.guaio ?? corsi.guaio

  const dopo = async () => {
    await dati.ricarica()
    onCambiato()
  }
  const torna = async () => {
    if (await lasciare()) setPagina({ a: 'elenco' })
  }

  if (ricevuta) {
    const { p } = ricevuta
    const nucleo = nucleoPerRicevuta(p, tutti)
    const chiudi = () => setRicevuta(null)
    return (
      <SchedaPiena etichetta={`Ricevuta di ${p.nome} ${p.cognome}`} torna={ricevuta.gara} onTorna={() => void lasciare().then((si) => si && chiudi())}>
        <Bozza>
          <NuovaRicevuta
            key={ricevuta.dp.chiaveRicevuta}
            d={d}
            p={p}
            nucleo={nucleo}
            corsi={p.iscrizioni.filter((i) => inCorso(i, oggi)).flatMap((i) => corsi.dato?.filter((c) => c.id === i.corsoId).map((c) => ({ id: c.id, nome: c.nome })) ?? [])}
            fai={fai}
            avvisa={avvisa}
            daPagamento={ricevuta.dp}
            onLasciaStare={() => {
              chiudi()
              // Il pagamento c'è già: senza ricevuta resta in PAGAMENTI, da dove la si fa dopo.
              avvisa('Pagamento registrato senza ricevuta: la fai da PAGAMENTI della persona, con FANNE LA RICEVUTA.')
            }}
            onFatta={() => {
              chiudi()
              onCambiato()
            }}
          />
        </Bozza>
        {avviso}
      </SchedaPiena>
    )
  }

  return (
    <>
      {aperta && persone.dato && corsi.dato && (
        <SchedaPiena key={aperta.id} etichetta={aperta.nome} torna="Le gare" onTorna={() => void torna()}>
          <SchedaGara g={aperta} atleti={atleti} persone={persone.dato} corsi={corsi.dato} oggi={oggi} fai={fai} lavora={lavora} onCambiato={dopo} onCassetto={setCassetto} />
        </SchedaPiena>
      )}

      <div className="stack" style={{ gap: 18 }}>
        <Testa titolo="GARE" sotto="Le gare a cui vanno i nostri atleti. Il certificato si controlla alla data della gara, non a oggi.">
          <button type="button" className="sg-btn sg-btn-pieno" disabled={!dati.dato} onClick={() => setCassetto({ a: 'modifica' })}>
            Nuova gara
          </button>
        </Testa>
        {guaio && <Guaio testo={guaio} />}
        {!guaio && (dati.dato === null || persone.dato === null) && <p className="sg-sotto">Un attimo…</p>}
        {dati.dato && persone.dato && <Elenco gare={gare} atleti={atleti} persone={persone.dato} oggi={oggi} onApri={(id) => setPagina({ a: 'gara', id })} />}
      </div>

      {cassetto?.a === 'modifica' && dati.dato && (
        <ModificaGara
          key={`modifica-${cassetto.id ?? 'nuova'}`}
          g={cassetto.id ? garaCassetto : undefined}
          gare={gare}
          pagati={garaCassetto ? atleti.filter((a) => a.garaId === garaCassetto.id && a.pagamento).length : 0}
          istruttori={istruttori.dato ?? []}
          oggi={oggi}
          fai={fai}
          lavora={lavora}
          onChiudi={() => setCassetto(null)}
          onSalvata={async (id, nuova) => {
            setCassetto(null)
            await dopo()
            if (nuova) setPagina({ a: 'gara', id })
          }}
          onEliminata={async () => {
            setCassetto(null)
            setPagina({ a: 'elenco' })
            await dopo()
          }}
        />
      )}
      {cassetto?.a === 'aggiungi' && garaCassetto && persone.dato && corsi.dato && (
        <AggiungiAtleti
          g={garaCassetto}
          atleti={atleti.filter((a) => a.garaId === garaCassetto.id)}
          persone={persone.dato}
          corsi={corsi.dato}
          oggi={oggi}
          fai={fai}
          lavora={lavora}
          onChiudi={() => setCassetto(null)}
          onFatto={async () => {
            setCassetto(null)
            await dopo()
          }}
        />
      )}
      {cassetto?.a === 'incassa' && garaCassetto && (
        <Incassa
          g={garaCassetto}
          p={tutti.find((p) => p.id === cassetto.personaId)}
          oggi={oggi}
          fai={fai}
          lavora={lavora}
          onChiudi={() => setCassetto(null)}
          onIncassato={async (dp, conRicevuta) => {
            setCassetto(null)
            await dopo()
            const p = tutti.find((x) => x.id === dp.personaId)
            if (conRicevuta && p) setRicevuta({ p, dp, gara: garaCassetto.nome })
          }}
        />
      )}
      {avviso}
    </>
  )
}

function Elenco({ gare, atleti, persone, oggi, onApri }: { gare: Gara[]; atleti: AtletaGara[]; persone: PersonaSeg[]; oggi: string; onApri: (id: string) => void }) {
  const { prossime, passate } = ordinaGare(gare, oggi)
  if (!gare.length) return <p className="sg-sotto">Nessuna gara ancora: inizia da Nuova gara.</p>
  return (
    <>
      {[['IN ARRIVO', prossime, false] as const, ['PASSATE', passate, true] as const].map(([titolo, lista, passata]) =>
        lista.length ? (
          <div key={titolo} className="stack" style={{ gap: 10 }}>
            <Titolo titolo={`${titolo} (${lista.length})`} />
            <div role="table" aria-label={`Gare ${titolo.toLowerCase()}`} className="sg-tabella">
              <div role="row" className="sg-lista-testa sg-riga-iscritto sg-riga-gara">
                {['DATA', 'GARA', 'ATLETI', 'CERTIFICATI', 'QUOTE'].map((t) => (
                  <span key={t} role="columnheader" className="sg-etichetta">
                    {t}
                  </span>
                ))}
              </div>
              <div className="sg-tabella-corpo">
                {lista.map((g) => {
                  const righe = righeGara(g, atleti, persone)
                  const certificati = avvisoCertificati(righe)
                  const conti = contiGara(g, atleti)
                  return (
                    <div key={g.id} role="row" className="sg-riga-iscritto sg-riga-gara sg-iscritto" data-spento={passata || g.annullata} onClick={() => onApri(g.id)}>
                      <span role="cell" className="num" style={{ fontSize: 14, fontWeight: 700 }}>
                        {dataLunga(g.dal, passata)}
                      </span>
                      <span role="cell" style={{ fontSize: 15, fontWeight: 600, minWidth: 0 }}>
                        <button
                          type="button"
                          className="sg-riga-apri"
                          style={{
                            textDecoration: g.annullata ? 'line-through' : undefined,
                          }}
                        >
                          {g.nome}
                        </button>
                        {g.annullata && (
                          <>
                            {' '}
                            <span className="num sg-tag">Annullata</span>
                          </>
                        )}
                        {g.luogo && <span className="sg-vestiario-arrivo">{g.luogo}</span>}
                      </span>
                      <span role="cell" className="num" style={{ fontSize: 15 }}>
                        {righe.length}
                      </span>
                      <span role="cell">
                        {!righe.length ? (
                          <span className="sg-sotto">—</span>
                        ) : certificati ? (
                          <span className="num sg-tag" data-tipo="manca">
                            {certificati}
                          </span>
                        ) : (
                          <span className="num sg-tag" data-tipo="fatto">
                            Tutti validi
                          </span>
                        )}
                      </span>
                      <span role="cell">
                        {!conti.totale ? (
                          <span className="sg-sotto">Senza quota</span>
                        ) : conti.nonPagati && !g.annullata ? (
                          <span className="num sg-tag" data-tipo="manca">
                            {conti.nonPagati} da pagare · {euroBreve(conti.daPagare)}
                          </span>
                        ) : (
                          <span className="sg-sotto">{righe.length ? 'Tutte pagate' : euroBreve(conti.totale) + ' a atleta'}</span>
                        )}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ) : null,
      )}
    </>
  )
}

function SchedaGara({
  g,
  atleti,
  persone,
  corsi,
  oggi,
  fai,
  lavora,
  onCambiato,
  onCassetto,
}: {
  g: Gara
  atleti: AtletaGara[]
  persone: PersonaSeg[]
  corsi: CorsoSeg[]
  oggi: string
  fai: Fai
  lavora: boolean
  onCambiato: () => Promise<void>
  onCassetto: (c: Cassetto) => void
}) {
  const righe = useMemo(
    () =>
      righeGara(g, atleti, persone).map((r) => ({
        ...r,
        corso: corsoDi(
          persone.find((p) => p.id === r.personaId),
          corsi,
          oggi,
        ),
      })),
    [g, atleti, persone, corsi, oggi],
  )
  const conti = contiGara(g, atleti)
  const certificati = avvisoCertificati(righe)
  const riepilogo = riepilogoCertificati(righe)
  const mappa = linkMappa(g.indirizzo)
  const [nota, setNota] = useState<{ id: string; testo: string } | null>(null)
  const pagamento = (id: string) => atleti.find((a) => a.garaId === g.id && a.personaId === id)?.pagamento

  // Quando un'azione smonta o disabilita quel che teneva il focus, la tastiera ripartirebbe dall'inizio della pagina.
  const portaFocus = (id: string) => setTimeout(() => document.getElementById(id)?.focus(), 0)

  const stampa = async () => {
    await fai(() => suCarta(fai, (c) => import('../../lib/elencoGaraPdf').then((m) => m.scaricaElencoGara(g, righe, c))), 'Elenco scaricato')
    portaFocus('ga-stampa')
  }

  const togli = async (r: RigaAtletaGara) => {
    if (!(await chiedi(`Togliere ${r.nome} ${r.cognome} da ${g.nome}? Resta iscritto in palestra: esce solo da questa gara.`, 'Togli dalla gara', { pericolo: true }))) return
    await fai(async () => (await datiGare()).togli(g.id, r.personaId), `${r.nome} ${r.cognome} tolto dalla gara`, onCambiato)
    portaFocus('ga-titolo')
  }

  const salvaNota = async () => {
    if (!nota) return
    const { id, testo } = nota
    if (await fai(async () => (await datiGare()).scriviNota(g.id, id, testo), 'Nota salvata', onCambiato)) {
      setNota(null)
      portaFocus(`ga-nota-apri-${id}`)
    }
  }

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="stack" style={{ gap: 6, minWidth: 0 }}>
        <h1 id="ga-titolo" className="ob sg-titolo" tabIndex={-1} style={{ textDecoration: g.annullata ? 'line-through' : undefined }}>
          {g.nome.toUpperCase()}
        </h1>
        <span className="num" style={{ fontSize: 15, fontWeight: 700 }}>
          {dateGara(g)} · {g.annullata ? 'Annullata' : quando(g, oggi)}
        </span>
        {(g.luogo || g.organizzatore || g.note || mappa) && (
          <span className="sg-sotto">
            {[g.luogo, g.organizzatore && `organizza ${g.organizzatore}`, g.note].filter(Boolean).join(' · ')}
            {mappa && (
              <>
                {' · '}
                <a href={mappa} target="_blank" rel="noopener" className="link-alto">
                  {g.indirizzo} ↗
                </a>
              </>
            )}
          </span>
        )}
        {conti.totale > 0 && (
          <span className="sg-sotto">
            {g.voci.map((v) => `${v.voce} ${euroBreve(v.importo)}`).join(', ')}
          </span>
        )}
      </div>

      <div className="sg-gara-numeri">
        <NumeroGara etichetta="ATLETI">{riepilogo.atleti}</NumeroGara>
        <NumeroGara etichetta="CERTIFICATO A POSTO">
          {riepilogo.aPosto} <span className="sg-sotto">su {riepilogo.atleti}</span>
        </NumeroGara>
        {/* Una gara annullata non ha più niente da incassare, ma quanto è già entrato resta vero. */}
        {conti.totale > 0 && !g.annullata && (
          <NumeroGara etichetta={`DA INCASSARE (${euroBreve(conti.totale)} A TESTA)`} tono={conti.daPagare > 0 ? 'manca' : undefined}>
            {euroBreve(conti.daPagare)}
          </NumeroGara>
        )}
        {conti.totale > 0 && (
          <NumeroGara etichetta="INCASSATO" tono="fatto">
            {euroBreve(conti.incassato)}
          </NumeroGara>
        )}
      </div>

      {certificati && (
        <Riquadro tono="guaio" stretto>
          <span style={{ fontSize: 15, fontWeight: 700 }}>
            {certificati} al {dataLunga(ultimoGiorno(g))}.
          </span>
          <span className="sg-sotto">{riepilogo.senza.map((r) => `${r.cognome} ${r.nome}`).join(', ')}.</span>
          <span className="sg-sotto">L’app avvisa ma non blocca. Per una gara serve il certificato agonistico: controlla che lo sia.</span>
        </Riquadro>
      )}

      <Titolo titolo={`ATLETI (${righe.length})`} />
      {righe.length > 0 && <p className="sg-sotto" style={{ margin: 0 }}>Togli (✕) toglie dalla gara, non dalla palestra.</p>}
      <div role="list" aria-label="Atleti della gara" className="sg-tabella">
        {!righe.length && (
          <p className="sg-sotto" style={{ padding: '12px 14px' }}>
            {g.annullata ? 'Nessun atleta in questa gara.' : 'Nessun atleta ancora: aggiungili da Aggiungi atleti, partendo da un corso o dal nome.'}
          </p>
        )}
        {righe.map((r) => {
          const c = scrittaCertificato(r)
          const pag = pagamento(r.personaId)
          return (
            <div key={r.personaId} role="listitem" className="sg-gara-atleta">
              <div className="sg-gara-atleta-chi">
                <span style={{ fontSize: 15, fontWeight: 600 }}>
                  {r.cognome} {r.nome}
                </span>
                <span className="sg-sotto num">{[r.annoNascita, r.corso].filter(Boolean).join(' · ') || '—'}</span>
                <span className="sg-gara-atleta-stato">
                  <span className="num sg-tag" data-tipo={c.tipo}>
                    {c.testo}
                  </span>
                  {nota?.id === r.personaId ? (
                    <span className="row" style={{ gap: 6 }}>
                      <label htmlFor={`ga-nota-${r.personaId}`} className="vh">
                        Nota per {r.nome} {r.cognome}
                      </label>
                      <input
                        id={`ga-nota-${r.personaId}`}
                        className="sg-campo"
                        autoFocus
                        maxLength={300}
                        value={nota.testo}
                        onChange={(e) => setNota({ id: r.personaId, testo: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void salvaNota()
                          if (e.key === 'Escape') {
                            e.stopPropagation()
                            setNota(null)
                            portaFocus(`ga-nota-apri-${r.personaId}`)
                          }
                        }}
                      />
                      <button type="button" className="sg-btn sg-btn-linea" disabled={lavora} onClick={() => void salvaNota()}>
                        Salva
                      </button>
                    </span>
                  ) : (
                    <button type="button" id={`ga-nota-apri-${r.personaId}`} className="sg-riga-apri sg-gara-nota" onClick={() => setNota({ id: r.personaId, testo: r.nota ?? '' })}>
                      {r.nota || 'aggiungi nota'}
                    </button>
                  )}
                </span>
              </div>
              <div className="sg-gara-azioni">
                {conti.totale > 0 && (
                  <span className="sg-gara-quota">
                    {pag ? (
                      <span style={{ fontSize: 13 }}>
                        <span className="num sg-tag" data-tipo="fatto">
                          Pagata
                        </span>{' '}
                        {pag.metodo}, {dataLunga(pag.data, false)}
                      </span>
                    ) : g.annullata ? (
                      <span className="sg-sotto">Non pagata</span>
                    ) : (
                      <>
                        <span className="num" style={{ fontSize: 13, fontWeight: 700, color: 'var(--rosso-testo)' }}>
                          Da pagare · {euroBreve(conti.totale)}
                        </span>
                        <button type="button" className="sg-btn sg-btn-linea" disabled={lavora} onClick={() => onCassetto({ a: 'incassa', id: g.id, personaId: r.personaId })}>
                          Incassa
                        </button>
                      </>
                    )}
                  </span>
                )}
                {/* Chi ha pagato resta nella gara (117-gare.sql): se non ci va, lo dice la nota. */}
                {!r.pagata && (
                  <button type="button" className="sg-btn sg-btn-linea sg-pericolo sg-gara-togli" disabled={lavora} aria-label={`Togli ${r.nome} ${r.cognome} dalla gara`} onClick={() => void togli(r)}>
                    ✕
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="sg-gara-piede">
        <button type="button" className="sg-btn sg-btn-linea" onClick={() => onCassetto({ a: 'modifica', id: g.id })}>
          Modifica la gara
        </button>
        <button type="button" id="ga-stampa" className="sg-btn sg-btn-linea" disabled={!righe.length || lavora} onClick={() => void stampa()}>
          Stampa l’elenco
        </button>
        {!g.annullata && (
          <button type="button" className="sg-btn sg-btn-pieno sg-gara-piede-pieno" onClick={() => onCassetto({ a: 'aggiungi', id: g.id })}>
            Aggiungi atleti
          </button>
        )}
      </div>
    </div>
  )
}

/** Un numero della striscia in testa: l'etichetta piccola sopra, il valore sotto; il tono lo colora come i tag. */
function NumeroGara({ etichetta, tono, children }: { etichetta: string; tono?: 'manca' | 'fatto'; children: React.ReactNode }) {
  return (
    <div className="sg-gara-numero" data-tono={tono}>
      <span className="sg-etichetta">{etichetta}</span>
      <span className="num sg-gara-numero-valore">{children}</span>
    </div>
  )
}

/** La finestra al centro, come la scheda di un istruttore: un cassetto a destra era stretto per i campi della gara. */
function Cassetto({ titolo, sotto, torna, onChiudi, children }: { titolo: string; sotto?: string; torna: string; onChiudi: () => void; children: React.ReactNode }) {
  return (
    <SchedaPiena etichetta={titolo} torna={torna} onTorna={onChiudi}>
      <div className="stack" style={{ gap: 4, minWidth: 0 }}>
        <span className="ob" style={{ fontSize: 28, fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1 }}>
          {titolo}
        </span>
        {sotto && (
          <span className="num" style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.14em', color: 'var(--dim)' }}>
            {sotto}
          </span>
        )}
      </div>
      {children}
    </SchedaPiena>
  )
}

const CHIAVE_PLACES = import.meta.env.VITE_GOOGLE_PLACES_KEY

function ModificaGara({
  g,
  gare,
  pagati,
  istruttori,
  oggi,
  fai,
  lavora,
  onChiudi,
  onSalvata,
  onEliminata,
}: {
  g?: Gara
  gare: Gara[]
  pagati: number
  istruttori: Istruttore[]
  oggi: string
  fai: Fai
  lavora: boolean
  onChiudi: () => void
  onSalvata: (id: string, nuova: boolean) => Promise<void>
  onEliminata: () => Promise<void>
}) {
  const [b, setB] = useState<BozzaGara>(() => ({
    nome: g?.nome ?? '',
    dal: g?.dal ?? '',
    al: g?.al ?? '',
    luogo: g?.luogo ?? '',
    indirizzo: g?.indirizzo ?? '',
    organizzatore: g?.organizzatore ?? '',
    note: g?.note ?? '',
    voci: (g?.voci ?? []).map((v) => ({
      voce: v.voce,
      importo: euro(v.importo),
    })),
    accompagnatori: g?.accompagnatori ?? [],
  }))
  const [google, setGoogle] = useState<string[]>([])
  const cambia = (x: Partial<BozzaGara>) => setB((y) => ({ ...y, ...x }))
  const importi = b.voci.map((v) => centesimi(v.importo))
  const totale = importi.reduce<number>((s, x) => s + (x ?? 0), 0)

  // I suggerimenti di Google arrivano mentre si scrive, non a ogni tasto.
  useEffect(() => {
    if (!CHIAVE_PLACES) return
    const t = window.setTimeout(() => void indirizziGoogle(b.indirizzo, CHIAVE_PLACES).then((s) => setGoogle([...new Set(s)])), 300)
    return () => window.clearTimeout(t)
  }, [b.indirizzo])

  const chiudi = async () => {
    if (await lasciare()) onChiudi()
  }

  const salva = () => {
    const { gara, errore } = garaDaBozza(b, {
      id: g?.id,
      annullata: g?.annullata ?? false,
    })
    if (!gara)
      return void fai(async () => {
        throw new Error(errore)
      })
    let id = ''
    void fai(
      async () => {
        id = await (await datiGare()).salva(gara)
      },
      'Gara salvata',
      () => onSalvata(id, !g),
    )
  }

  const annulla = async () => {
    if (!g) return
    const domanda = g.annullata
      ? `Rimettere ${g.nome}? Torna una gara come le altre.`
      : `Annullare ${g.nome}? Resta nell’elenco barrata, con i suoi atleti e i pagamenti; gli atleti non vengono avvisati.`
    if (!(await chiedi(domanda, g.annullata ? 'Rimetti la gara' : 'Annulla la gara', { pericolo: !g.annullata }))) return
    // Dalla gara salvata, non dalla bozza: annullare non salva a metà quel che si sta scrivendo.
    await fai(
      async () => void (await datiGare()).salva({ ...g, annullata: !g.annullata }),
      g.annullata ? 'Gara rimessa' : 'Gara annullata',
      () => onSalvata(g.id, false),
    )
  }

  const elimina = async () => {
    if (!g || !(await chiedi(`Eliminare ${g.nome}? Spariscono la gara e il suo elenco di atleti. I pagamenti già fatti restano in PAGAMENTI e CONTABILITÀ.`, 'Elimina la gara', { pericolo: true })))
      return
    await fai(async () => (await datiGare()).elimina(g.id), 'Gara eliminata', onEliminata)
  }

  const testo = (campo: 'luogo' | 'organizzatore', etichetta: string) => (
    <Campo
      id={`ga-${campo}`}
      etichetta={etichetta}
      nota={{
        guaio: false,
        testo: 'Dalle gare già inserite. Se non c’è, si scrive e basta.',
      }}
    >
      <input id={`ga-${campo}`} className="sg-campo" list={`ga-${campo}-lista`} maxLength={200} value={b[campo]} onChange={(e) => cambia({ [campo]: e.target.value })} />
      <datalist id={`ga-${campo}-lista`}>
        {suggerimenti(gare, campo, b[campo])
          .slice(0, 8)
          .map((s) => (
            <option key={s} value={s} />
          ))}
      </datalist>
    </Campo>
  )

  return (
    <Cassetto titolo={g ? 'MODIFICA LA GARA' : 'NUOVA GARA'} sotto={g ? `${g.nome} · ${dateGara(g)}` : undefined} torna={g ? g.nome : 'Le gare'} onChiudi={() => void chiudi()}>
      <Bozza>
        <div className="stack" style={{ gap: 16 }}>
          <Campo id="ga-nome" etichetta="NOME">
            <input id="ga-nome" className="sg-campo" maxLength={120} value={b.nome} onChange={(e) => cambia({ nome: e.target.value })} />
          </Campo>
          <div className="sg-due">
            <Campo id="ga-dal" etichetta="DAL">
              <input id="ga-dal" type="date" className="sg-campo" value={b.dal} onChange={(e) => cambia({ dal: e.target.value })} />
            </Campo>
            <Campo
              id="ga-al"
              etichetta="AL · SE DURA PIÙ GIORNI"
              nota={{
                guaio: false,
                testo: 'Il certificato deve valere fino all’ultimo giorno.',
              }}
            >
              <input id="ga-al" type="date" className="sg-campo" min={b.dal || undefined} value={b.al} onChange={(e) => cambia({ al: e.target.value })} />
            </Campo>
          </div>

          <Campo etichetta="QUOTA A ATLETA · FACOLTATIVA">
            <div className="stack" style={{ gap: 8 }}>
              {b.voci.map((v, i) => (
                <div key={i} className="row" style={{ gap: 8 }}>
                  <label htmlFor={`ga-voce-${i}`} className="vh">
                    Voce {i + 1}
                  </label>
                  <input
                    id={`ga-voce-${i}`}
                    className="sg-campo grow"
                    placeholder="Voce"
                    maxLength={100}
                    value={v.voce}
                    onChange={(e) =>
                      cambia({
                        voci: b.voci.map((x, j) => (j === i ? { ...x, voce: e.target.value } : x)),
                      })
                    }
                  />
                  <label htmlFor={`ga-importo-${i}`} className="vh">
                    Importo della voce {i + 1}
                  </label>
                  <input
                    id={`ga-importo-${i}`}
                    className="sg-campo num"
                    inputMode="decimal"
                    placeholder="Importo"
                    style={{ width: 110 }}
                    value={v.importo}
                    onChange={(e) =>
                      cambia({
                        voci: b.voci.map((x, j) => (j === i ? { ...x, importo: e.target.value } : x)),
                      })
                    }
                  />
                  <button type="button" className="icon-btn sg-pericolo" data-bozza aria-label={`Togli la voce ${v.voce || i + 1}`} onClick={() => cambia({ voci: b.voci.filter((_, j) => j !== i) })}>
                    ×
                  </button>
                </div>
              ))}
              <button type="button" className="sg-btn sg-btn-linea" style={{ alignSelf: 'flex-start' }} onClick={() => cambia({ voci: [...b.voci, { voce: '', importo: '' }] })}>
                + Aggiungi una voce
              </button>
              {b.voci.length > 0 && (
                <span className="num" style={{ fontSize: 15, fontWeight: 700 }}>
                  Totale a atleta {euroBreve(totale)}
                </span>
              )}
              {pagati > 0 && <span className="sg-sotto">{pagati === 1 ? '1 atleta ha' : `${pagati} atleti hanno`} già pagato: per loro non cambia niente.</span>}
            </div>
          </Campo>

          {testo('luogo', 'LUOGO · FACOLTATIVO')}
          {testo('organizzatore', 'ORGANIZZATORE · FACOLTATIVO')}

          <Campo
            id="ga-indirizzo"
            etichetta="INDIRIZZO · FACOLTATIVO"
            nota={{
              guaio: false,
              testo: `${CHIAVE_PLACES ? 'Suggerimenti da Google Places, mentre si scrive. ' : ''}Se non c’è, si scrive e basta. Scelto l’indirizzo, la gara mostra il link alla mappa, anche all’istruttore e all’iscritto.`,
            }}
          >
            <input id="ga-indirizzo" className="sg-campo" list="ga-indirizzo-lista" maxLength={300} autoComplete="off" value={b.indirizzo} onChange={(e) => cambia({ indirizzo: e.target.value })} />
            <datalist id="ga-indirizzo-lista">
              {google.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Campo>

          <Campo
            etichetta="ISTRUTTORE CHE ACCOMPAGNA"
            nota={{
              guaio: false,
              testo: 'L’istruttore scelto vede questa gara anche se non insegna il corso degli atleti, e la trova nel suo elenco GARE. Si può scegliere più di uno.',
            }}
          >
            <div role="group" aria-label="Istruttore che accompagna" className="sg-spunte" style={{ gap: 2 }}>
              {istruttori.map((i) => (
                <label key={i.id} className="sg-elenco-casella">
                  <input
                    type="checkbox"
                    checked={b.accompagnatori.includes(i.id)}
                    onChange={(e) =>
                      cambia({
                        accompagnatori: e.target.checked ? [...b.accompagnatori, i.id] : b.accompagnatori.filter((x) => x !== i.id),
                      })
                    }
                  />
                  {i.nome}
                </label>
              ))}
            </div>
          </Campo>

          <Campo id="ga-note" etichetta="NOTE · FACOLTATIVE">
            <textarea id="ga-note" className="sg-campo" rows={3} maxLength={1000} value={b.note} onChange={(e) => cambia({ note: e.target.value })} />
          </Campo>

          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            {g && (
              <button type="button" className="sg-btn sg-btn-linea sg-pericolo" disabled={lavora} onClick={() => void annulla()}>
                {g.annullata ? 'Rimetti la gara' : 'Annulla la gara'}
              </button>
            )}
            {g && eliminabile(g, oggi) && (
              <button type="button" className="sg-btn sg-btn-linea sg-pericolo" disabled={lavora} onClick={() => void elimina()}>
                Elimina
              </button>
            )}
            <span className="grow" />
            <button type="button" className="sg-btn sg-btn-linea" onClick={() => void chiudi()}>
              Lascia stare
            </button>
            <button type="button" className="sg-btn sg-btn-pieno" disabled={lavora} onClick={() => salva()}>
              Salva
            </button>
          </div>
        </div>
      </Bozza>
    </Cassetto>
  )
}

function AggiungiAtleti({
  g,
  atleti,
  persone,
  corsi,
  oggi,
  fai,
  lavora,
  onChiudi,
  onFatto,
}: {
  g: Gara
  atleti: AtletaGara[]
  persone: PersonaSeg[]
  corsi: CorsoSeg[]
  oggi: string
  fai: Fai
  lavora: boolean
  onChiudi: () => void
  onFatto: () => Promise<void>
}) {
  const [corso, setCorso] = useState('')
  const [cerca, setCerca] = useState('')
  const [scelti, setScelti] = useState<string[]>([])
  const dentro = new Set(atleti.map((a) => a.personaId))
  const delCorso = (id: string) => persone.filter((p) => p.attiva && p.iscrizioni.some((i) => i.corsoId === id && inCorso(i, oggi)))
  const conIscritti = corsi.map((c) => ({ c, n: delCorso(c.id).length })).filter((x) => x.n > 0)
  const lista = cerca.trim()
    ? candidatiGara(persone, atleti, cerca).slice(0, 50)
    : corso
      ? delCorso(corso).map((persona) => ({
          persona,
          giaDentro: dentro.has(persona.id),
        }))
      : []
  const nomeCorso = corsi.find((c) => c.id === corso)?.nome
  const spunta = (ids: string[], si: boolean) => setScelti((s) => (si ? [...new Set([...s, ...ids])] : s.filter((x) => !ids.includes(x))))
  const liberi = lista.filter((x) => !x.giaDentro).map((x) => x.persona.id)

  const aggiungi = () => void fai(async () => (await datiGare()).aggiungi(g.id, scelti), scelti.length === 1 ? 'Atleta aggiunto' : `${scelti.length} atleti aggiunti`, onFatto)

  return (
    <Cassetto titolo="AGGIUNGI ATLETI" sotto={`${g.nome} · ${dateGara(g)}`} torna={g.nome} onChiudi={onChiudi}>
      <div className="stack" style={{ gap: 16 }}>
        <Campo id="ga-corso" etichetta="PARTI DA UN CORSO">
          <select
            id="ga-corso"
            className="sg-campo"
            value={corso}
            onChange={(e) => {
              setCorso(e.target.value)
              setCerca('')
              // Scelto un corso, partono spuntati tutti i suoi: di solito ci vanno quasi tutti.
              if (e.target.value)
                spunta(
                  delCorso(e.target.value)
                    .filter((p) => !dentro.has(p.id))
                    .map((p) => p.id),
                  true,
                )
            }}
          >
            <option value="">Scegli un corso</option>
            {conIscritti.map(({ c, n }) => (
              <option key={c.id} value={c.id}>
                {c.nome} · {n} iscritti
              </option>
            ))}
          </select>
        </Campo>
        <Campo id="ga-cerca" etichetta="O CERCA PER NOME">
          <input id="ga-cerca" className="sg-campo" type="search" placeholder="Cognome o nome" value={cerca} onChange={(e) => setCerca(e.target.value)} />
        </Campo>

        {(cerca.trim() || corso) && (
          <Titolo titolo={cerca.trim() ? 'TROVATI' : (nomeCorso ?? '').toUpperCase()}>
            {liberi.length > 0 && (
              <button type="button" className="sg-btn sg-btn-linea" onClick={() => spunta(liberi, !liberi.every((id) => scelti.includes(id)))}>
                {liberi.every((id) => scelti.includes(id)) ? 'Deseleziona' : 'Spunta tutti'}
              </button>
            )}
          </Titolo>
        )}
        {cerca.trim() && !lista.length && <p className="sg-sotto">Nessun iscritto attivo con questo nome.</p>}
        <div className="stack" style={{ gap: 2 }}>
          {lista.map(({ persona: p, giaDentro }) => {
            const c = scrittaCertificato({
              certificato: certificatoAllaGara(p, g),
              scade: p.certificato.scade,
              daConfermare: !!p.certificato.inAttesaIl,
            })
            return (
              <label key={p.id} className="sg-elenco-casella sg-gara-candidato" data-spento={giaDentro || undefined}>
                <input type="checkbox" disabled={giaDentro} checked={giaDentro || scelti.includes(p.id)} onChange={(e) => spunta([p.id], e.target.checked)} />
                <span className="stack grow" style={{ gap: 2, minWidth: 0 }}>
                  <span style={{ fontWeight: 600 }}>
                    {p.cognome} {p.nome}
                  </span>
                  <span className="sg-sotto" style={{ fontSize: 13 }}>
                    {giaDentro ? 'già in questa gara' : [p.natoIl && `nato/nata nel ${p.natoIl.slice(0, 4)}`, corsoDi(p, corsi, oggi)].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="num sg-tag" data-tipo={c.tipo}>
                  {c.testo}
                </span>
              </label>
            )
          })}
        </div>

        <div className="row" style={{ gap: 10 }}>
          <span className="grow" />
          <button type="button" className="sg-btn sg-btn-linea" onClick={onChiudi}>
            Lascia stare
          </button>
          <button type="button" className="sg-btn sg-btn-pieno" disabled={!scelti.length || lavora} onClick={aggiungi}>
            {scelti.length === 1 ? 'Aggiungi 1 atleta' : `Aggiungi ${scelti.length} atleti`}
          </button>
        </div>
      </div>
    </Cassetto>
  )
}

function Incassa({
  g,
  p,
  oggi,
  fai,
  lavora,
  onChiudi,
  onIncassato,
}: {
  g: Gara
  p?: PersonaSeg
  oggi: string
  fai: Fai
  lavora: boolean
  onChiudi: () => void
  onIncassato: (dp: DatiPagamentoDiretto, conRicevuta: boolean) => Promise<void>
}) {
  const [metodo, setMetodo] = useState(METODI_A_MANO[0])
  const totale = totaleQuota(g.voci)
  if (!p) return null

  const conferma = async () => {
    const { si, spuntata } = await chiediSpunta(
      `Registrare questo pagamento?\n${euro(totale)} € · ${metodo}\n${p.cognome} ${p.nome}\n${dataLunga(oggi)}\nGara · ${g.nome}, ${dateGara(g)}\n${g.voci.map((v) => `${v.voce} ${euroBreve(v.importo)}`).join(' · ')}\nEntra in CONTABILITÀ con la voce Gare`,
      'Sì, registra',
      { no: 'No, torna alla gara' },
      {
        testo: 'Fai anche la ricevuta',
        nota: (s) => (s ? 'Si apre FAI LA RICEVUTA già compilata. Il pagamento si registra lì, una volta sola.' : 'Senza ricevuta: la fai dopo da PAGAMENTI della persona.'),
        si: (s) => (s ? 'Sì, fai la ricevuta' : 'Sì, registra'),
      },
    )
    if (!si) return
    let pagamentoId = ''
    await fai(
      async () => {
        pagamentoId = await (await datiGare()).incassa(g.id, p.id, metodo, oggi)
      },
      spuntata ? undefined : 'Pagamento registrato',
      () => onIncassato(pagamentoPerRicevuta(g, p.id, { metodo, data: oggi }, pagamentoId, nuovoId()), spuntata),
    )
  }

  return (
    <Cassetto titolo="INCASSA" sotto={`${p.cognome} ${p.nome} · ${euroBreve(totale)}`} torna={g.nome} onChiudi={onChiudi}>
      <div className="stack" style={{ gap: 16 }}>
        <span className="sg-sotto">
          {g.nome}, {dateGara(g)}: {g.voci.map((v) => `${v.voce} ${euroBreve(v.importo)}`).join(' · ')}
        </span>
        <Campo etichetta="COME HA PAGATO">
          <Segmenti etichetta="Come ha pagato" voci={METODI_A_MANO.map((m) => [m, m] as const)} scelta={metodo} onScegli={setMetodo} />
        </Campo>
        <div className="row" style={{ gap: 10 }}>
          <span className="grow" />
          <button type="button" className="sg-btn sg-btn-linea" onClick={onChiudi}>
            Lascia stare
          </button>
          <button type="button" className="sg-btn sg-btn-pieno" disabled={lavora} onClick={() => void conferma()}>
            Incassa {euroBreve(totale)}
          </button>
        </div>
      </div>
    </Cassetto>
  )
}
