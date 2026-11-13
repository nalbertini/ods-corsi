import { useMemo, useRef, useState } from 'react'
import { cercaCorsi, chiEPerCosa, euroAssegna, importoProposto, ordiniDelNucleo, righeDaCampi, tipologiaDaRighe, vociDaAggiungere, voceOrdine, type RigaAssegnata, type VoceDovuta } from '../../lib/assegna'
import type { Ordine } from '../../lib/vestiario'
import type { NomeIcona } from '../../lib/icone'
import { listinoUsabile } from '../../lib/listino'
import { VOCE_PIU_CORSI } from '../../lib/nucleo'
import type { CandidatoPersona } from '../../lib/movimentiPersona'
import type { PagamentoDiretto } from '../../lib/pagamenti'
import { centesimi, dataRicevuta, euro, type Ricevuta } from '../../lib/ricevute'
import type { DatiSegreteria, PersonaSeg } from '../../lib/segreteria'
import { oggiARoma } from '../../lib/contabilita'
import { Icona } from '../Icons'
import { CampoPersona, SchedaCandidata } from './CollegaPersona'
import { DITO, Guaio, Tag, Tasto, useBozza, useCarica, useDialogo } from './comune'

// Cognome e nome, come negli elenchi.
const nome = (p?: Pick<PersonaSeg, 'nome' | 'cognome'>) => (p ? `${p.cognome} ${p.nome}` : '…')
const chiaveDi = (x: { personaId: string; voce: string }) => `${x.personaId}\u0000${x.voce}`
const valoriDa = (righe: RigaAssegnata[]) => Object.fromEntries(righe.map((r) => [chiaveDi(r), euro(r.importo)]))

/** Quel che la finestra ha deciso: chi ha pagato e le righe (vuote con «Solo la persona»). */
export interface SceltaChiEPerCosa {
  personaId: string
  nomePersona: string
  righe: RigaAssegnata[]
  /** Una per apertura della finestra: riprovata dopo una rete caduta, l'assegnazione non si scrive due volte (136). */
  chiave: string
}

/**
 * CHI HA PAGATO E PER COSA?: la stessa finestra dall'import della banca, da MOVIMENTI e dal movimento. In alto chi ha
 * pagato (le schede del testo, la ricerca); scelta la persona, la sua situazione e quella del nucleo: cosa deve (gli
 * importi già proposti, pieni se c'è un solo modo di dividere), i pagamenti già fatti, e la ricevuta già fatta se ce
 * n'è una che può essere questa. Le regole sono in `chiEPerCosa` (assegna.ts); la tipologia la dice quel che paga.
 */
export function ChiEPerCosa({
  d, data, testo, importo, suggerite = [], personaIniziale, gia, ricevutaDi, conRicevuta = false, soloPersona = true, onConferma, onRicevuta, onChiudi,
}: {
  d: DatiSegreteria
  data: string
  testo: string
  /** In centesimi: quel che del bonifico resta da assegnare. */
  importo: number
  suggerite?: CandidatoPersona[]
  personaIniziale?: string
  /** Pagamenti e ricevute già letti da chi apre; se no si leggono qui. */
  gia?: { diretti: PagamentoDiretto[]; ricevute: Ricevuta[] }
  /** La ricevuta già fatta che può essere questo bonifico, per la persona scelta. */
  ricevutaDi?: (personaId: string) => Ricevuta | undefined
  /** Dal movimento: anche «Conferma e fai la ricevuta». */
  conRicevuta?: boolean
  soloPersona?: boolean
  onConferma: (s: SceltaChiEPerCosa, eRicevuta: boolean) => void
  onRicevuta?: (ricevutaId: string, s: Pick<SceltaChiEPerCosa, 'personaId' | 'nomePersona'>) => void
  onChiudi: () => void
}) {
  const ref = useDialogo<HTMLDivElement>(onChiudi)
  const oggi = oggiARoma()
  const dati = useCarica(async () => {
    const [persone, corsi, letto, diretti, ricevute, ordini] = await Promise.all([
      d.persone(), d.corsi(), d.listino(), gia ? Promise.resolve(gia.diretti) : d.pagamentiDiretti(), gia ? Promise.resolve(gia.ricevute) : d.ricevute(),
      // Senza gli ordini (rete, o il database senza il 157) la finestra va avanti: l'abbigliamento si mette a mano.
      d.ordiniVestiarioDaSaldare().catch(() => null),
    ])
    return { persone, corsi, listino: listinoUsabile(letto.listino, corsi), diretti, ricevute, ordini: ordini ?? [] }
  }, [d])
  const [qui, setQui] = useState<{ id: string; nome: string; cognome: string } | null>(() => {
    const s = suggerite.find((c) => c.id === personaIniziale)
    return s ?? null
  })
  // Chi parte già scelto ma non è fra le suggerite (il movimento collegato): si prende dalle schede appena lette.
  const iniziale = !qui && personaIniziale ? dati.dato?.persone.find((p) => p.id === personaIniziale) : undefined
  const chi = qui ?? (iniziale ? { id: iniziale.id, nome: iniziale.nome, cognome: iniziale.cognome } : null)
  const [questo, setQuesto] = useState<string[]>([])
  const [nonQuesto, setNonQuesto] = useState<string[]>([])
  const [nonLaRicevuta, setNonLaRicevuta] = useState(false)
  // PAGA ANCHE e gli ordini del vestiario: le voci scelte a mano, e la persona di cui è aperto «Altro corso…».
  const [aggiunte, setAggiunte] = useState<VoceDovuta[]>([])
  const [menuDi, setMenuDi] = useState<string | null>(null)
  const situazione = useMemo(
    () => (chi && dati.dato ? chiEPerCosa(chi.id, importo, { ...dati.dato, oggi }, questo, testo) : null),
    [chi?.id, dati.dato, importo, oggi, questo.join(), testo],
  )
  const [valori, setValori] = useState<Record<string, string> | null>(null)
  const mostrati = valori ?? valoriDa(situazione?.proposta ?? [])
  const scegli = (p: { id: string; nome: string; cognome: string }) => {
    setQui(p)
    setValori(null)
    setQuesto([])
    setNonQuesto([])
    setNonLaRicevuta(false)
    setAggiunte([])
    setMenuDi(null)
  }
  const ricevuta = chi && !nonLaRicevuta ? ricevutaDi?.(chi.id) : undefined

  const dovuti: VoceDovuta[] = situazione ? [...situazione.dovuti, ...aggiunte] : []
  const letti = dovuti.map((v) => {
    const t = mostrati[chiaveDi(v)] ?? ''
    return { v, testo: t, cent: t.trim() ? centesimi(t) : 0 }
  })
  const { righe, guaio } = righeDaCampi(dovuti, mostrati, importo)
  const totale = righe.reduce((s, r) => s + r.importo, 0)
  const chiave = useRef(crypto.randomUUID())
  useBozza(valori !== null, 'Chi ha pagato e per cosa')
  const tipologia = tipologiaDaRighe(righe)
  const daChiedere = (situazione?.daChiedere ?? []).filter((id) => !nonQuesto.includes(id))
  const aggiungi = (v: VoceDovuta) => {
    setAggiunte([...aggiunte, v])
    setValori({ ...mostrati, [chiaveDi(v)]: euro(importoProposto(v.manca, importo, totale)) })
    setMenuDi(null)
  }
  const togli = (v: VoceDovuta) => {
    setAggiunte(aggiunte.filter((x) => chiaveDi(x) !== chiaveDi(v)))
    setValori(Object.fromEntries(Object.entries(mostrati).filter(([k]) => k !== chiaveDi(v))))
  }
  const conferma = (eRicevuta: boolean) => chi && !guaio && righe.length && onConferma({ personaId: chi.id, nomePersona: nome(chi), righe, chiave: chiave.current }, eRicevuta)

  return (
    <>
      <button type="button" className="sg-velo" aria-label="Chiudi" onClick={onChiudi} />
      <div ref={ref} role="dialog" aria-modal="true" tabIndex={-1} aria-labelledby="chi-e-per-cosa" className="sg-dialogo" style={{ width: 'min(780px, calc(100% - 32px))', maxHeight: 'calc(100% - 32px)', overflowY: 'auto' }}>
        <div className="stack" style={{ gap: 4 }}>
          <h2 id="chi-e-per-cosa" className="ob" style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: '0.04em' }}>CHI HA PAGATO E PER COSA?</h2>
          <span className="sg-sotto">{dataRicevuta(data)} · {testo} · <b className="num">+ {euroAssegna(importo)}</b></span>
        </div>
        {suggerite.length > 0 && (
          <div className="stack" style={{ gap: 8 }} role="radiogroup" aria-label="Suggerite dal testo">
            <span className="sg-etichetta">SUGGERITE DAL TESTO</span>
            {suggerite.map((c) => <SchedaCandidata key={c.id} c={c} nome="chi-e-per-cosa" scelta={c.id === chi?.id} onScegli={() => scegli(c)} />)}
          </div>
        )}
        <CampoPersona d={d} scelta={chi && !suggerite.some((c) => c.id === chi.id) ? { ...chi, corsi: [] } : null} manca="" onScegli={scegli} />
        {dati.guaio && <Guaio testo={dati.guaio} />}
        {chi && !dati.dato && !dati.guaio && <span className="sg-sotto" role="status">Sto leggendo la situazione…</span>}

        {chi && ricevuta && (
          <div className="sg-riquadro stack" data-avviso="true" style={{ gap: 10 }}>
            <span className="sg-etichetta">C’È GIÀ LA RICEVUTA</span>
            <span style={{ fontSize: 15 }}>
              Ricevuta n. {ricevuta.numero}/{ricevuta.anno} del {dataRicevuta(ricevuta.data)} a <b>{nome(dati.dato?.persone.find((p) => p.id === ricevuta.personaId))}</b>, {euroAssegna(ricevuta.pagato)}, pagata con bonifico: è questa?
            </span>
            <span className="sg-sotto">Se è la stessa, il bonifico prende quella ricevuta e i soldi non si contano due volte.</span>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <Tasto tono="pieno" onClick={() => onRicevuta?.(ricevuta.id, { personaId: chi.id, nomePersona: nome(chi) })}>Sì, è questa</Tasto>
              <Tasto onClick={() => setNonLaRicevuta(true)}>No, dividi il bonifico</Tasto>
            </div>
          </div>
        )}

        {chi && situazione && !ricevuta && (
          <>
            {daChiedere.map((id) => {
              const p = situazione.nucleo.find((x) => x.persona.id === id)?.persona
              return (
                <div key={id} className="sg-riquadro stack" data-avviso="true" style={{ gap: 10 }}>
                  <span className="sg-etichetta">GIÀ PAGATO A MANO</span>
                  <span style={{ fontSize: 15 }}>{nome(p)} è segnato pagato a mano nella scheda, senza un pagamento nell’app. È questo bonifico?</span>
                  <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Tasto tono="pieno" onClick={() => { setQuesto([...questo, id]); setValori(null) }}>È questo bonifico</Tasto>
                    <button type="button" className="sg-link" style={DITO} onClick={() => setNonQuesto([...nonQuesto, id])}>Non è questo</button>
                  </div>
                </div>
              )
            })}
            {situazione.nucleo.map(({ persona: p, pagamenti }) => (
              <div key={p.id} className="sg-riquadro stack" style={{ gap: 8 }}>
                <span className="stack" style={{ gap: 2 }}>
                  <span className="sg-etichetta">{p.id === chi.id ? 'CHI HA PAGATO' : 'STESSA FAMIGLIA'}</span>
                  <b style={{ fontSize: 16 }}>{nome(p)}</b>
                </span>
                {!dovuti.some((v) => v.personaId === p.id) && <span className="sg-sotto">Niente da pagare: corsi e quota a posto.</span>}
                {letti.filter((x) => x.v.personaId === p.id).map(({ v, testo: t, cent }) => (
                  <RigaDovuta key={chiaveDi(v)} v={v} testo={t} cent={cent} nomePersona={p.nome} aMano={questo.includes(p.id)} onCambia={(x) => setValori({ ...mostrati, [chiaveDi(v)]: x })} onTogli={aggiunte.some((x) => chiaveDi(x) === chiaveDi(v)) ? () => togli(v) : undefined} />
                ))}
                {dati.dato && (
                  <PagaAnche
                    scelte={vociDaAggiungere(p, dati.dato.corsi, dati.dato.listino, oggi, dovuti.filter((v) => v.personaId === p.id).map((v) => v.voce), importo, dati.dato)}
                    ordini={ordiniDelNucleo(situazione.nucleo.map((x) => x.persona), dati.dato.ordini, aggiunte.flatMap((v) => (v.ordine ? [v.ordine.id] : [])))}
                    personaId={p.id}
                    cerca={menuDi === p.id}
                    onCerca={(si) => setMenuDi(si ? p.id : null)}
                    onScegli={aggiungi}
                  />
                )}
                {pagamenti.length > 0 && (
                  <>
                    <span className="sg-etichetta" style={{ paddingTop: 6 }}>PAGAMENTI · {pagamenti.length}</span>
                    {pagamenti.slice(0, 4).map((x, i) => (
                      <div key={i} className="row" style={{ gap: 12, alignItems: 'baseline', flexWrap: 'wrap', borderTop: '1px solid var(--line-soft)', paddingTop: 6, fontSize: 14 }}>
                        <span className="num" style={{ width: 90 }}>{dataRicevuta(x.data)}</span>
                        <span style={{ flex: '1 1 200px', minWidth: 0, overflowWrap: 'anywhere' }}>{x.voce} <span className="sg-sotto">· {x.ricevuta ? `ricevuta n. ${x.ricevuta.numero}/${x.ricevuta.anno}` : 'senza ricevuta'}</span></span>
                        <span className="num">{euroAssegna(x.importo)}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            ))}
            {dovuti.length > 0 && (
              <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
                <span className="num" role="status" style={{ fontSize: 15 }}>Assegnati {euroAssegna(totale)} di {euroAssegna(importo)} · {totale > importo ? `${euroAssegna(totale - importo)} più del bonifico` : `Da assegnare ${euroAssegna(importo - totale)}`}</span>
                {situazione.sicura && !valori && <span className="sg-sotto" data-tono="fatto">Un solo modo di dividere: già messo.</span>}
                <button type="button" className="sg-link sg-pericolo" style={DITO} data-bozza onClick={() => setValori({})}>Svuota tutto</button>
              </div>
            )}
            {guaio && <span role="alert" style={{ fontSize: 14, color: 'var(--rosso-testo)' }}>{guaio}</span>}
            {tipologia && <span className="sg-sotto">TIPOLOGIA: «{tipologia}», da quel che paga.</span>}
          </>
        )}

        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          {!ricevuta && (
            <Tasto tono="pieno" disabled={!chi || !!guaio || !righe.length} onClick={() => conferma(false)}>Conferma</Tasto>
          )}
          {!ricevuta && conRicevuta && (
            <Tasto disabled={!chi || !!guaio || !righe.length} onClick={() => conferma(true)}>Conferma e fai la ricevuta</Tasto>
          )}
          {soloPersona && !ricevuta && (
            <Tasto disabled={!chi} onClick={() => chi && onConferma({ personaId: chi.id, nomePersona: nome(chi), righe: [], chiave: chiave.current }, false)}>Solo la persona, decido dopo</Tasto>
          )}
          <Tasto onClick={onChiudi}>Annulla</Tasto>
        </div>
      </div>
    </>
  )
}

export function RigaDovuta({ v, testo, cent, nomePersona, aMano, onCambia, onTogli }: { v: VoceDovuta; testo: string; cent: number | null; nomePersona: string; aMano: boolean; onCambia: (t: string) => void; onTogli?: () => void }) {
  const id = `as-${chiaveDi(v).replace(/[^a-z0-9]/gi, '-')}`
  // L'abbigliamento a mano non ha un prezzo: il suo tetto è il bonifico, né saldo né parziale. Quello di un ordine sì.
  const libera = v.tipo === 'abbigliamento' && !v.ordine
  const saldo = !libera && cent !== null && cent >= v.manca
  const parziale = !libera && cent !== null && cent > 0 && cent < v.manca
  // La voce «più corsi» elenca tutti i corsi: in riga il nome breve, i corsi sotto.
  const corsi = v.corsi
  // Il numero solo da due corsi: «più corsi (1 corso)» si contraddice, e il corso è già scritto sotto.
  const nome = corsi && corsi.length > 1 ? `${VOCE_PIU_CORSI} (${corsi.length} corsi)` : corsi ? VOCE_PIU_CORSI : v.voce
  return (
    <div className="stack" style={{ gap: 4 }}>
      <div className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* «Togli» accanto al testo ma fuori dal label: il nome del campo resta la voce. */}
        <span style={{ fontSize: 15, flex: '1 1 200px', minWidth: 0 }}>
          <label htmlFor={id}>
            {nome} <span className="sg-sotto">· {libera ? 'a mano' : `${v.ordine ? `ordine di ${v.ordine.di} · manca` : v.aggiunta ? 'dal listino' : aMano ? `${v.tipo === 'quota' ? 'pagata' : 'pagato'} a mano,` : 'manca'} ${euroAssegna(v.manca)}`}</span>
          </label>
          {onTogli && <>{' '}<span className="sg-sotto">·</span>{' '}<button type="button" className="sg-link sg-pericolo" style={{ ...DITO, fontSize: 13 }} data-bozza aria-label={`Togli ${v.voce}`} onClick={onTogli}>Togli</button></>}
          {corsi && <span className="sg-sotto" style={{ display: 'block' }}>{corsi.join(' · ')}</span>}
        </span>
        <input id={id} className="sg-campo num" inputMode="decimal" style={{ width: 110 }} aria-invalid={testo.trim() !== '' && (cent === null || cent <= 0 || cent > v.manca)} value={testo} onChange={(e) => onCambia(e.target.value)} />
        {/* Un posto fisso per il tag: i campi delle righe restano in colonna. */}
        <span style={{ width: 90, display: 'flex' }}>
          {saldo && <Tag tipo="fatto">Saldo</Tag>}
          {parziale && <Tag tipo="aspetta">Parziale</Tag>}
        </span>
      </div>
      {v.ordine && saldo && <span className="sg-sotto">Con Conferma l’ordine di {v.ordine.di} in VESTIARIO diventa saldato, con bonifico.</span>}
      {v.ordine && parziale && <span className="sg-sotto">Copre solo una parte: l’ordine in VESTIARIO resta com’è, si segna lì.</span>}
      {!v.ordine && parziale && cent !== null && (
        <span className="sg-sotto">Resteranno {euroAssegna(v.manca - cent)} su «{corsi ? VOCE_PIU_CORSI : v.voce}»: si vedono nella scheda di {nomePersona}.</span>
      )}
      {v.aggiunta && !v.aggiunta.suo && <span className="sg-sotto">{nomePersona} non ha l’iscrizione a {v.aggiunta.corso}: si fa dalla scheda.</span>}
    </div>
  )
}

/** Una scelta da un tocco: il nome in chiaro, la formula in grassetto, il prezzo in grigio. */
function Scelta({ prima, forte, dopo, icona, onClick }: { prima?: string; forte: string; dopo?: string; icona?: NomeIcona; onClick: () => void }) {
  return (
    <Tasto icona={icona ?? null} data-bozza onClick={onClick}>
      <span>{prima && <>{prima} · </>}<b>{forte}</b>{dopo && <span className="sg-sotto num"> {dopo}</span>}</span>
    </Tasto>
  )
}

/**
 * Sotto ogni persona: ORDINI DEL VESTIARIO (solo se c'è un ordine da saldare del nucleo, `ordiniDelNucleo`) e PAGA
 * ANCHE, le scelte da un tocco di `vociDaAggiungere` (la quota, i suoi corsi, l'abbigliamento a mano) e «Altro corso…»,
 * che al suo posto apre la ricerca sugli altri corsi (`cercaCorsi`). Un tocco aggiunge la riga.
 */
function PagaAnche({ scelte, ordini, personaId, cerca, onCerca, onScegli }: {
  scelte: ReturnType<typeof vociDaAggiungere>
  ordini: Ordine[]
  personaId: string
  cerca: boolean
  onCerca: (si: boolean) => void
  onScegli: (v: VoceDovuta) => void
}) {
  const [testo, setTesto] = useState('')
  const trovati = cercaCorsi(scelte.altri, testo)
  const filetto = { borderTop: '1px solid var(--line-soft)', paddingTop: 10 }
  const chiudi = () => { setTesto(''); onCerca(false) }
  return (
    <>
      {ordini.length > 0 && (
        <div className="stack" style={{ gap: 8, ...filetto }}>
          <span className="sg-etichetta row" style={{ gap: 8, alignItems: 'center' }}><Icona nome="vestiario" />ORDINI DEL VESTIARIO · {ordini.length}</span>
          {ordini.map((o) => {
            const capi = [...new Set(o.righe.map((r) => `${r.capo} ${r.taglia}`))].join(', ')
            const per = [...new Set(o.righe.map((r) => r.perChi))].join(', ')
            const tel = o.telefono.replace(/\D/g, '').slice(-3)
            return (
              <div key={o.id} className="row" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="stack" style={{ gap: 2, flex: '1 1 260px', minWidth: 0 }}>
                  <span style={{ fontSize: 15 }}>Ordine di {o.cognome} {o.nome} <span className="sg-sotto">· per {per} · {dataRicevuta(o.arrivato.slice(0, 10))}</span></span>
                  <span className="sg-sotto">{capi}{tel && ` · tel. …${tel}`}</span>
                </span>
                <span className="stack" style={{ alignItems: 'flex-end' }}>
                  <span className="num" style={{ fontSize: 15, fontWeight: 600 }}>mancano {euroAssegna(Math.round((o.totale - o.pagato) * 100))}</span>
                  <span className="sg-sotto num">di {euroAssegna(Math.round(o.totale * 100))}</span>
                </span>
                <Tasto icona={null} data-bozza onClick={() => onScegli(voceOrdine(personaId, o))}>È questo ordine</Tasto>
              </div>
            )
          })}
        </div>
      )}
      <div className="stack" style={{ gap: 8, ...filetto }}>
        <span className="sg-etichetta">PAGA ANCHE</span>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {scelte.quota && <Scelta forte={scelte.quota.dovuta.voce} dopo={euroAssegna(scelte.quota.dovuta.manca)} onClick={() => scelte.quota && onScegli(scelte.quota.dovuta)} />}
          {scelte.suoi.map((v) => <Scelta key={v.dovuta.voce} prima={v.corso} forte={v.formula} dopo={euroAssegna(v.dovuta.manca)} onClick={() => onScegli(v.dovuta)} />)}
          {scelte.abbigliamento && <Scelta icona="vestiario" forte="Abbigliamento" dopo="a mano" onClick={() => scelte.abbigliamento && onScegli(scelte.abbigliamento)} />}
          {!cerca && scelte.altri.length > 0 && (
            <button type="button" className="sg-link" style={{ ...DITO, gap: 6, textDecoration: 'none' }} onClick={() => onCerca(true)}>
              <Icona nome="cerca" /><span style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>Altro corso…</span>
            </button>
          )}
        </div>
        {cerca && (
          <div className="stack" style={{ gap: 8, ...filetto }} onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), chiudi())}>
            <div className="row" style={{ gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <label className="stack" style={{ gap: 6, flex: '1 1 320px' }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>Altro corso</span>
                <input type="search" className="sg-campo" autoFocus value={testo} onChange={(e) => setTesto(e.target.value)} />
              </label>
              <button type="button" className="sg-link" style={DITO} onClick={chiudi}>Chiudi</button>
            </div>
            <span className="sg-sotto" role="status">{trovati.length ? (testo.trim() ? `${trovati.length === 1 ? '1 corso' : `${trovati.length} corsi`} con «${testo.trim()}»` : '') : `Nessun corso con «${testo.trim()}»`}</span>
            {trovati.map((g) => (
              <div key={g.corso} className="row" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--line-soft)', paddingTop: 8 }}>
                <span style={{ width: 150, fontSize: 15, fontWeight: 600 }}>{g.corso}</span>
                {g.voci.map((v) => <Scelta key={v.dovuta.voce} forte={v.formula} dopo={euroAssegna(v.dovuta.manca)} onClick={() => { onScegli(v.dovuta); chiudi() }} />)}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
