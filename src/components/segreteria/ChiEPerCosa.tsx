import { useMemo, useState } from 'react'
import { chiEPerCosa, cosaNonVaAssegnazione, euroAssegna, tipologiaDaRighe, type RigaAssegnata, type VoceDovuta } from '../../lib/assegna'
import { listinoUsabile } from '../../lib/listino'
import type { CandidatoPersona } from '../../lib/movimentiPersona'
import type { PagamentoDiretto } from '../../lib/pagamenti'
import { centesimi, dataRicevuta, euro, type Ricevuta } from '../../lib/ricevute'
import type { DatiSegreteria, PersonaSeg } from '../../lib/segreteria'
import { oggiARoma } from '../../lib/contabilita'
import { CampoPersona, SchedaCandidata } from './CollegaPersona'
import { DITO, Guaio, Tag, Tasto, useCarica, useDialogo } from './comune'

const nome = (p?: Pick<PersonaSeg, 'nome' | 'cognome'>) => (p ? `${p.nome} ${p.cognome}` : '…')
const chiaveDi = (x: { personaId: string; voce: string }) => `${x.personaId}\u0000${x.voce}`
const valoriDa = (righe: RigaAssegnata[]) => Object.fromEntries(righe.map((r) => [chiaveDi(r), euro(r.importo)]))

/** Quel che la finestra ha deciso: chi ha pagato e le righe (vuote con «Solo la persona»). */
export interface SceltaChiEPerCosa {
  personaId: string
  nomePersona: string
  righe: RigaAssegnata[]
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
  onRicevuta?: (ricevutaId: string, s: Omit<SceltaChiEPerCosa, 'righe'>) => void
  onChiudi: () => void
}) {
  const ref = useDialogo<HTMLDivElement>(onChiudi)
  const oggi = oggiARoma()
  const dati = useCarica(async () => {
    const [persone, corsi, letto, diretti, ricevute] = await Promise.all([
      d.persone(), d.corsi(), d.listino(), gia ? Promise.resolve(gia.diretti) : d.pagamentiDiretti(), gia ? Promise.resolve(gia.ricevute) : d.ricevute(),
    ])
    return { persone, corsi, listino: listinoUsabile(letto.listino, corsi), diretti, ricevute }
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
  const situazione = useMemo(
    () => (chi && dati.dato ? chiEPerCosa(chi.id, importo, { ...dati.dato, oggi }, questo) : null),
    [chi?.id, dati.dato, importo, oggi, questo.join()],
  )
  const [valori, setValori] = useState<Record<string, string> | null>(null)
  const mostrati = valori ?? valoriDa(situazione?.proposta ?? [])
  const scegli = (p: { id: string; nome: string; cognome: string }) => {
    setQui(p)
    setValori(null)
    setQuesto([])
    setNonQuesto([])
    setNonLaRicevuta(false)
  }
  const ricevuta = chi && !nonLaRicevuta ? ricevutaDi?.(chi.id) : undefined

  const dovuti: VoceDovuta[] = situazione?.dovuti ?? []
  const letti = dovuti.map((v) => {
    const t = mostrati[chiaveDi(v)] ?? ''
    return { v, testo: t, cent: t.trim() ? centesimi(t) : 0 }
  })
  const nonSiCapisce = letti.find((x) => x.cent === null)
  const righe: RigaAssegnata[] = letti.filter((x) => (x.cent ?? 0) > 0).map((x) => ({ personaId: x.v.personaId, voce: x.v.voce, importo: x.cent ?? 0 }))
  const totale = righe.reduce((s, r) => s + r.importo, 0)
  const guaio = nonSiCapisce ? `L’importo di «${nonSiCapisce.v.voce}» non si capisce.` : righe.length ? cosaNonVaAssegnazione(righe, importo, dovuti) : null
  const tipologia = tipologiaDaRighe(righe)
  const daChiedere = (situazione?.daChiedere ?? []).filter((id) => !nonQuesto.includes(id))
  const conferma = (eRicevuta: boolean) => chi && !guaio && righe.length && onConferma({ personaId: chi.id, nomePersona: nome(chi), righe }, eRicevuta)

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
        {chi && !dati.dato && !dati.guaio && <span className="sg-sotto">Sto leggendo la situazione…</span>}

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
                  <span className="sg-etichetta">Già pagato a mano</span>
                  <span style={{ fontSize: 15 }}>{nome(p)} è segnato pagato a mano nella scheda, senza un pagamento nell’app. È questo bonifico?</span>
                  <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Tasto tono="pieno" onClick={() => { setQuesto([...questo, id]); setValori(null) }}>È questo bonifico</Tasto>
                    <button type="button" className="sg-link" style={DITO} onClick={() => setNonQuesto([...nonQuesto, id])}>Non è questo</button>
                  </div>
                </div>
              )
            })}
            {situazione.nucleo.map(({ persona: p, dovuti: suoi, pagamenti }) => (
              <div key={p.id} className="sg-riquadro stack" style={{ gap: 8 }}>
                <span className="sg-etichetta">{nome(p).toUpperCase()} · {p.id === chi.id ? 'CHI HA PAGATO' : 'STESSA FAMIGLIA'}</span>
                {!suoi.length && <span className="sg-sotto">Niente da pagare: corsi e quota a posto.</span>}
                {letti.filter((x) => x.v.personaId === p.id).map(({ v, testo: t, cent }) => (
                  <RigaDovuta key={chiaveDi(v)} v={v} testo={t} cent={cent} nomePersona={p.nome} aMano={questo.includes(p.id)} onCambia={(x) => setValori({ ...mostrati, [chiaveDi(v)]: x })} />
                ))}
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
                <span className="num" style={{ fontSize: 15 }}>Assegnati {euroAssegna(totale)} di {euroAssegna(importo)} · Da assegnare {euroAssegna(Math.max(0, importo - totale))}</span>
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
            <Tasto disabled={!chi} onClick={() => chi && onConferma({ personaId: chi.id, nomePersona: nome(chi), righe: [] }, false)}>Solo la persona, decido dopo</Tasto>
          )}
          <Tasto onClick={onChiudi}>Annulla</Tasto>
        </div>
      </div>
    </>
  )
}

export function RigaDovuta({ v, testo, cent, nomePersona, aMano, onCambia }: { v: VoceDovuta; testo: string; cent: number | null; nomePersona: string; aMano: boolean; onCambia: (t: string) => void }) {
  const id = `as-${chiaveDi(v).replace(/[^a-z0-9]/gi, '-')}`
  const saldo = cent !== null && cent >= v.manca
  const parziale = cent !== null && cent > 0 && cent < v.manca
  return (
    <div className="stack" style={{ gap: 4 }}>
      <div className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <label htmlFor={id} style={{ fontSize: 15, flex: '1 1 200px', minWidth: 0 }}>
          {v.voce} <span className="sg-sotto">· {aMano ? `${v.tipo === 'quota' ? 'pagata' : 'pagato'} a mano,` : 'manca'} {euroAssegna(v.manca)}</span>
        </label>
        <input id={id} className="sg-campo num" inputMode="decimal" style={{ width: 110 }} aria-invalid={testo.trim() !== '' && (cent === null || cent <= 0 || cent > v.manca)} value={testo} onChange={(e) => onCambia(e.target.value)} />
        {saldo && <Tag tipo="fatto">Saldo</Tag>}
        {parziale && <Tag tipo="aspetta">Parziale</Tag>}
      </div>
      {parziale && cent !== null && (
        <span className="sg-sotto">Resteranno {euroAssegna(v.manca - cent)} su «{v.voce}»: si vedono nella scheda di {nomePersona}.</span>
      )}
    </div>
  )
}
