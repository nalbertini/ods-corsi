// Il bonifico collegato a una persona, in CONTABILITÀ: a cosa va (quota, corsi, anche dei fratelli), come saldo o
// parziale, e dal bonifico la ricevuta, una per persona. Le regole stanno in `src/lib/assegna.ts`: qui si mostrano.
import { useMemo, useRef, useState } from 'react'
import {
  abbinamentiProposti,
  conAssegnazioni,
  cosaNonVaAssegnazione,
  cosaNonVaMovimentoDaAssegnare,
  daAssegnare,
  dovutiDi,
  elencoDaAssegnare,
  euroAssegna,
  personeDelNucleo,
  proponiRipartizione,
  type RigaAssegnata,
  type VoceDovuta,
} from '../../lib/assegna'
import { oggiARoma, type Cassa, type MovimentoManuale, type VoceContabile } from '../../lib/contabilita'
import { listinoUsabile } from '../../lib/listino'
import { nucleoPerRicevuta } from '../../lib/nucleo'
import type { PagamentoDiretto } from '../../lib/pagamenti'
import { centesimi, dataRicevuta, euro, type Ricevuta } from '../../lib/ricevute'
import { inCorso, type DatiSegreteria, type PersonaSeg } from '../../lib/segreteria'
import { Bozza, chiedi, DITO, Guaio, lasciare, SchedaPiena, suCarta, Tag, Tasto, useAvviso, useBozza, useCarica } from './comune'
import { NuovaRicevuta, scarica } from './Ricevute'

type Fai = ReturnType<typeof useAvviso>['fai']
type Avvisa = ReturnType<typeof useAvviso>['avvisa']
/** Quel che serve del movimento: è una riga a mano di CONTABILITÀ. */
type Movimento = Pick<MovimentoManuale, 'id' | 'data' | 'importo' | 'personaId'>

const nome = (p?: Pick<PersonaSeg, 'nome' | 'cognome'>) => (p ? `${p.nome} ${p.cognome}` : '…')
const chiaveDi = (x: { personaId: string; voce: string }) => `${x.personaId}\u0000${x.voce}`
const delMovimento = (id: string) => (x: { movimentoId?: string }) => x.movimentoId === id

/** Persone, corsi e listino: servono al dialogo e alla ricevuta, e si leggono solo quando il bonifico si apre. */
function useAnagrafe(d: DatiSegreteria) {
  return useCarica(async () => {
    const [persone, corsi, letto] = await Promise.all([d.persone(), d.corsi(), d.listino()])
    return { persone, corsi, listino: listinoUsabile(letto.listino, corsi) }
  }, [d])
}
type Anagrafe = NonNullable<ReturnType<typeof useAnagrafe>['dato']>

/** I corsi che la persona fa adesso, come li vuole la ricevuta. */
const corsiDi = (p: PersonaSeg, a: Anagrafe, oggi: string) =>
  p.iscrizioni.filter((i) => inCorso(i, oggi)).flatMap((i) => a.corsi.filter((c) => c.id === i.corsoId).map((c) => ({ id: c.id, nome: c.nome })))

/**
 * Dentro il movimento aperto: quel che del bonifico è assegnato, le ricevute fatte da lì e quel che resta da
 * assegnare. Si mostra solo per le entrate che `cosaNonVaMovimentoDaAssegnare` lascia passare.
 */
export function AssegnaMovimento({ d, m, diretti, ricevute, fai, avvisa, onFatto, onRileggi }: { d: DatiSegreteria; m: Movimento; diretti: PagamentoDiretto[]; ricevute: Ricevuta[]; fai: Fai; avvisa: Avvisa; onFatto: () => void; onRileggi: () => void }) {
  const oggi = oggiARoma()
  const anagrafe = useAnagrafe(d)
  const [assegnando, setAssegnando] = useState(false)
  // Le persone a cui fare la ricevuta, una dopo l'altra, con le assegnazioni lette dopo «Assegna».
  const [coda, setCoda] = useState<{ chi: string[]; diretti: PagamentoDiretto[] } | null>(null)
  const resta = daAssegnare(m, diretti, ricevute)
  const righe = diretti.filter(delMovimento(m.id)).filter((x) => !x.annullatoIl)
  const fatte = ricevute.filter(delMovimento(m.id)).filter((r) => !r.annullataIl)
  const persone = anagrafe.dato?.persone ?? []
  const personaDi = (id: string) => persone.find((p) => p.id === id)
  const senzaRicevuta = [...new Set(righe.map((x) => x.personaId))]

  const ricevuta = (chi: string[], sue: PagamentoDiretto[]) => setCoda({ chi, diretti: sue })
  const dopoAssegna = async (conRicevuta: boolean) => {
    setAssegnando(false)
    // Con la ricevuta il movimento resta aperto: chiuderlo chiuderebbe anche la coda delle ricevute da fare.
    if (!conRicevuta) return onFatto()
    onRileggi()
    const tutti = (await d.pagamentiDiretti()).filter(delMovimento(m.id)).filter((x) => !x.annullatoIl)
    const chi = [...new Set(tutti.map((x) => x.personaId))]
    if (chi.length) ricevuta(chi, tutti)
  }

  if (coda && anagrafe.dato) {
    const p = personaDi(coda.chi[0])
    if (p) {
      const sue = coda.diretti.filter((x) => x.personaId === p.id)
      // Dopo l'ultima ricevuta si chiude il movimento, come dopo «Assegna»; prima si rilegge e si passa alla persona dopo.
      const avanti = () => {
        if (coda.chi.length > 1) {
          onRileggi()
          setCoda({ ...coda, chi: coda.chi.slice(1) })
        } else {
          setCoda(null)
          onFatto()
        }
      }
      return (
        <SchedaPiena etichetta={`Ricevuta di ${nome(p)}`} torna="Il movimento" onTorna={() => void lasciare().then((si) => si && setCoda(null))}>
          <Bozza>
            <NuovaRicevuta
              key={p.id}
              d={d}
              p={p}
              nucleo={nucleoPerRicevuta(p, persone)}
              corsi={corsiDi(p, anagrafe.dato, oggi)}
              fai={fai}
              avvisa={avvisa}
              daMovimento={{ movimentoId: m.id, data: m.data, sue }}
              onFatta={avanti}
              onLasciaStare={() => {
                setCoda(null)
                avvisa('Assegnato senza ricevuta: la fai dopo da qui, con «Fai la ricevuta».')
              }}
            />
          </Bozza>
        </SchedaPiena>
      )
    }
  }

  return (
    <div className="stack" style={{ gap: 10, padding: '8px 0', borderBottom: '1px solid var(--line-soft)' }}>
      {anagrafe.guaio && <Guaio testo={`Non si leggono le persone a cui assegnarlo: ${anagrafe.guaio}`} />}
      {(righe.length > 0 || fatte.length > 0) && (
        <div className="stack" style={{ gap: 6 }}>
          <span className="sg-etichetta">ASSEGNATO A</span>
          {righe.map((x) => (
            <div key={x.id} className="row" style={{ gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 15, flex: '1 1 200px', minWidth: 0 }}>
                {x.voce} <span className="sg-sotto">· {nome(personaDi(x.personaId))}</span>
              </span>
              <span className="num" style={{ fontSize: 15 }}>{euroAssegna(x.importo)}</span>
              <Tag tipo="aspetta">Senza ricevuta</Tag>
            </div>
          ))}
          {fatte.map((r) => (
            <div key={r.id} className="row" style={{ gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 15, flex: '1 1 200px', minWidth: 0 }}>
                Ricevuta n. {r.numero}/{r.anno} <span className="sg-sotto">· intestata a {nome(r.personaId ? personaDi(r.personaId) : undefined)}</span>
              </span>
              <span className="num" style={{ fontSize: 15 }}>{euroAssegna(r.pagato)}</span>
              <button type="button" className="sg-link" style={DITO} onClick={() => void fai(() => suCarta(fai, (c) => scarica(r, c)), 'PDF scaricato')}>PDF</button>
            </div>
          ))}
          {anagrafe.dato && senzaRicevuta.length > 0 && (
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              {senzaRicevuta.map((id) => (
                <Tasto key={id} onClick={() => ricevuta([id], righe)}>
                  Fai la ricevuta{senzaRicevuta.length > 1 ? ` di ${personaDi(id)?.nome ?? ''}` : ''}
                </Tasto>
              ))}
            </div>
          )}
        </div>
      )}
      {resta > 0 && (
        <div className="sg-riquadro" data-avviso="true">
          <span className="sg-etichetta" style={{ color: 'var(--giallo-testo)' }}>DA ASSEGNARE: {euroAssegna(resta)}</span>
          <span style={{ fontSize: 14 }}>Di’ a cosa va: la quota, un annuale, un trimestre. Finché non lo dici, non conta come pagato.</span>
          <div>
            <Tasto tono="pieno" disabled={!anagrafe.dato} onClick={() => setAssegnando(true)}>Assegna a quota e corsi</Tasto>
          </div>
        </div>
      )}
      {assegnando && anagrafe.dato && (
        <DialogoAssegna d={d} m={m} resta={resta} diretti={diretti} anagrafe={anagrafe.dato} oggi={oggi} fai={fai} onChiudi={() => setAssegnando(false)} onFatto={(si) => void dopoAssegna(si)} />
      )}
    </div>
  )
}

/** ASSEGNA IL BONIFICO: le cose da pagare del nucleo, già ripartite, da correggere a mano. */
function DialogoAssegna({ d, m, resta, diretti, anagrafe, oggi, fai, onChiudi, onFatto }: { d: DatiSegreteria; m: Movimento; resta: number; diretti: PagamentoDiretto[]; anagrafe: Anagrafe; oggi: string; fai: Fai; onChiudi: () => void; onFatto: (conRicevuta: boolean) => void }) {
  const titolare = m.personaId ?? ''
  const chi = personeDelNucleo(titolare, anagrafe.persone)
    .map((id) => anagrafe.persone.find((p) => p.id === id))
    .filter((p): p is PersonaSeg => !!p)
  const dovuti = useMemo(
    () => chi.flatMap((p) => dovutiDi(conAssegnazioni(p, diretti, anagrafe.listino, oggi), anagrafe.corsi, anagrafe.listino, oggi)),
    [chi.map((p) => p.id).join(), diretti, anagrafe, oggi],
  )
  const [valori, setValori] = useState<Record<string, string>>(() =>
    Object.fromEntries(proponiRipartizione(resta, dovuti).righe.map((r) => [chiaveDi(r), euro(r.importo)])),
  )
  useBozza(true, 'L’assegnazione')
  // Una chiave per apertura: se la rete cade dopo la scrittura e si riprova, il database non assegna due volte.
  const chiave = useRef(crypto.randomUUID())
  const [scrivendo, setScrivendo] = useState(false)

  const letti = dovuti.map((v) => ({ v, testo: valori[chiaveDi(v)] ?? '', cent: (valori[chiaveDi(v)] ?? '').trim() ? centesimi(valori[chiaveDi(v)] ?? '') : 0 }))
  const nonSiCapisce = letti.find((x) => x.cent === null)
  const righe: RigaAssegnata[] = letti.filter((x) => (x.cent ?? 0) > 0).map((x) => ({ personaId: x.v.personaId, voce: x.v.voce, importo: x.cent ?? 0 }))
  const totale = righe.reduce((s, r) => s + r.importo, 0)
  const guaio = nonSiCapisce ? `L’importo di «${nonSiCapisce.v.voce}» non si capisce.` : cosaNonVaAssegnazione(righe, resta, dovuti)
  const conRighe = [...new Set(righe.map((r) => r.personaId))]
  const nomiRicevute = conRighe.map((id) => nome(chi.find((p) => p.id === id))).join(', ')

  const assegna = (conRicevuta: boolean) => {
    if (guaio || scrivendo) return
    setScrivendo(true)
    void fai(() => d.assegnaMovimento(m.id, righe, chiave.current), conRicevuta ? undefined : 'Bonifico assegnato', () => onFatto(conRicevuta)).finally(() => setScrivendo(false))
  }
  const lasciaStare = async () => {
    if (await chiedi('Lasciare stare l’assegnazione? Il bonifico resta da assegnare.', 'Sì, lascia stare', { no: 'No, resto' })) onChiudi()
  }

  return (
    <SchedaPiena etichetta={`Assegna il bonifico del ${dataRicevuta(m.data)}`} torna="Il movimento" onTorna={() => void lasciaStare()}>
      <div className="stack" style={{ gap: 16 }}>
        <span className="sg-sotto">
          Il bonifico è di {euroAssegna(m.importo)}, da assegnare {euroAssegna(resta)}. Ogni importo diventa un pagamento della persona: un saldo se copre quel che manca, se no un parziale.
        </span>
        {!dovuti.length && <span style={{ fontSize: 15 }}>Nel nucleo non c’è niente da pagare: il bonifico resta da assegnare.</span>}
        {chi.map((p) => {
          const suoi = letti.filter((x) => x.v.personaId === p.id)
          if (!suoi.length) return null
          return (
            <div key={p.id} className="sg-riquadro stack" style={{ gap: 10 }}>
              <span className="sg-etichetta">
                {nome(p).toUpperCase()} · {p.id === titolare ? 'collegato al bonifico' : 'stessa famiglia'}
              </span>
              {suoi.map(({ v, testo, cent }) => (
                <RigaDovuta key={chiaveDi(v)} v={v} testo={testo} cent={cent} nomePersona={p.nome} onCambia={(t) => setValori({ ...valori, [chiaveDi(v)]: t })} />
              ))}
            </div>
          )
        })}
        {dovuti.length > 0 && (
          <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
            <span className="num" style={{ fontSize: 15 }}>
              Assegnati {euroAssegna(totale)} di {euroAssegna(resta)} · Da assegnare {euroAssegna(Math.max(0, resta - totale))}
            </span>
            <button type="button" className="sg-link sg-pericolo" style={DITO} data-bozza onClick={() => setValori({})}>Svuota tutto</button>
          </div>
        )}
        {!guaio && totale < resta && totale > 0 && (
          <span className="sg-riquadro" data-avviso="true" style={{ fontSize: 14 }}>
            Restano {euroAssegna(resta - totale)} da assegnare: li trovi nella scheda «Da assegnare» di CONTABILITÀ.
          </span>
        )}
        {conRighe.length > 0 && !guaio && (
          <span className="sg-sotto">
            RICEVUTE {conRighe.length}{conRighe.length > 1 ? ', una per persona' : ''}: intestate a {nomiRicevute}.
          </span>
        )}
        {guaio && dovuti.length > 0 && <span role="alert" style={{ fontSize: 14, color: 'var(--rosso-testo)' }}>{guaio}</span>}
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <Tasto tono="pieno" disabled={!!guaio || scrivendo} onClick={() => assegna(true)}>
            {conRighe.length > 1 ? `Assegna e fai le ${conRighe.length} ricevute` : 'Assegna e fai la ricevuta'}
          </Tasto>
          <Tasto disabled={!!guaio || scrivendo} onClick={() => assegna(false)}>Assegna senza ricevuta</Tasto>
          <Tasto onClick={() => void lasciaStare()}>Lascia stare</Tasto>
        </div>
      </div>
    </SchedaPiena>
  )
}

function RigaDovuta({ v, testo, cent, nomePersona, onCambia }: { v: VoceDovuta; testo: string; cent: number | null; nomePersona: string; onCambia: (t: string) => void }) {
  const id = `as-${chiaveDi(v).replace(/[^a-z0-9]/gi, '-')}`
  const saldo = cent !== null && cent >= v.manca
  const parziale = cent !== null && cent > 0 && cent < v.manca
  return (
    <div className="stack" style={{ gap: 4 }}>
      <div className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <label htmlFor={id} style={{ fontSize: 15, flex: '1 1 200px', minWidth: 0 }}>
          {v.voce} <span className="sg-sotto">· manca {euroAssegna(v.manca)}</span>
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

/**
 * La scheda DA ASSEGNARE di CONTABILITÀ: le entrate collegate che hanno ancora soldi senza una voce, e sopra i
 * bonifici collegati prima di questo cambio che hanno già la loro ricevuta, da abbinare con un sì.
 */
export function DaAssegnare({ d, manuali, diretti, ricevute, casse, voci, fai, onApri, onCambiato }: { d: DatiSegreteria; manuali: MovimentoManuale[]; diretti: PagamentoDiretto[]; ricevute: Ricevuta[]; casse: Cassa[]; voci: VoceContabile[]; fai: Fai; onApri: (movimentoId: string) => void; onCambiato: () => void }) {
  const oggi = oggiARoma()
  const { righe, totale } = elencoDaAssegnare(manuali, diretti, ricevute, casse, voci, oggi)
  const ids = [...new Set(righe.map((r) => r.personaId))].sort().join(',')
  const nomi = useCarica(() => (ids ? d.nomiPersone(ids.split(',')) : Promise.resolve([])), [d, ids])
  const nomeDi = (id: string) => {
    const p = nomi.dato?.find((x) => x.id === id)
    return p ? `${p.cognome} ${p.nome}` : '…'
  }
  const [scartati, setScartati] = useState<string[]>([])
  // Solo i bonifici che non hanno ancora niente assegnato: abbinare una ricevuta a uno già diviso conterebbe due volte.
  const liberi = manuali.filter((m) => cosaNonVaMovimentoDaAssegnare(m, casse, voci, oggi) === null && daAssegnare(m, diretti, ricevute) === m.importo)
  const proposti = abbinamentiProposti(liberi, ricevute).filter((x) => !scartati.includes(`${x.movimentoId}|${x.ricevutaId}`))
  const movimento = (id: string) => manuali.find((m) => m.id === id)
  const ricevuta = (id: string) => ricevute.find((r) => r.id === id)
  const abbina = (xs: typeof proposti) =>
    void fai(async () => {
      for (const x of xs) await d.abbinaRicevutaMovimento(x.movimentoId, x.ricevutaId)
    }, xs.length > 1 ? `${xs.length} bonifici abbinati` : 'Bonifico abbinato', onCambiato)

  return (
    <div className="stack" style={{ gap: 18 }}>
      {proposti.length > 0 && (
        <div className="sg-riquadro stack" style={{ gap: 10 }}>
          <span className="sg-etichetta">COLLEGATI PRIMA · {proposti.length}</span>
          <span style={{ fontSize: 14 }}>Questi bonifici erano già collegati e la ricevuta l’hai fatta a parte. Se è la stessa, abbinala: così i soldi non si contano due volte.</span>
          {proposti.map((x) => {
            const mv = movimento(x.movimentoId)
            const r = ricevuta(x.ricevutaId)
            if (!mv || !r) return null
            return (
              <div key={`${x.movimentoId}|${x.ricevutaId}`} className="row" style={{ gap: 10, alignItems: 'baseline', flexWrap: 'wrap', borderTop: '1px solid var(--line-soft)', paddingTop: 8 }}>
                <span style={{ fontSize: 15, flex: '1 1 260px', minWidth: 0 }}>
                  Bonifico del {dataRicevuta(mv.data)} <span className="sg-sotto">· {mv.descrizione}</span> → ricevuta n. {r.numero}/{r.anno} del {dataRicevuta(r.data)}
                </span>
                <span className="num" style={{ fontSize: 15 }}>{euroAssegna(mv.importo)}</span>
                <Tasto onClick={() => abbina([x])}>Abbina</Tasto>
                <button type="button" className="sg-link" style={DITO} onClick={() => setScartati([...scartati, `${x.movimentoId}|${x.ricevutaId}`])}>Non è questa</button>
              </div>
            )
          })}
          {proposti.length > 1 && (
            <div>
              <Tasto tono="pieno" onClick={() => abbina(proposti)}>Abbina tutti e {proposti.length}</Tasto>
            </div>
          )}
        </div>
      )}
      <div className="stack" style={{ gap: 6 }}>
        <span className="sg-etichetta">
          DA ASSEGNARE · {righe.length} {righe.length === 1 ? 'ENTRATA' : 'ENTRATE'} · {euroAssegna(totale)}
        </span>
        {!righe.length && <span className="sg-sotto">Niente da assegnare: ogni entrata collegata su quota e corsi dice a cosa va.</span>}
        {righe.map((r) => {
          const mv = movimento(r.movimentoId)
          const cassa = casse.find((c) => c.id === mv?.cassaId)?.nome ?? ''
          return (
            <div key={r.movimentoId} className="row" style={{ gap: 12, alignItems: 'baseline', flexWrap: 'wrap', borderTop: '1px solid var(--line-soft)', paddingTop: 8 }}>
              <span className="num" style={{ fontSize: 15, width: 90 }}>{dataRicevuta(r.data)}</span>
              <span style={{ fontSize: 15, flex: '1 1 220px', minWidth: 0, overflowWrap: 'anywhere' }}>
                {nomeDi(r.personaId)} <span className="sg-sotto">· {mv?.descrizione}</span>
              </span>
              <span className="sg-sotto">{cassa}</span>
              <span className="num" style={{ fontSize: 15 }}>{r.daAssegnare === r.importo ? `${euroAssegna(r.importo)} · tutto` : `${euroAssegna(r.daAssegnare)} di ${euroAssegna(r.importo)}`}</span>
              <Tasto onClick={() => onApri(r.movimentoId)}>Assegna</Tasto>
            </div>
          )
        })}
      </div>
    </div>
  )
}
