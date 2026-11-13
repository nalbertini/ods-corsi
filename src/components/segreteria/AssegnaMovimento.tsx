// Il bonifico collegato a una persona, in CONTABILITÀ: a cosa va (quota, corsi, anche dei fratelli), come saldo o
// parziale, e dal bonifico la ricevuta, una per persona. Le regole stanno in `src/lib/assegna.ts`: qui si mostrano.
import { useState } from 'react'
import {
  assegnaDaSoli,
  collegatiPrima,
  conGenitori,
  daSoli,
  daClassificareDaAbbinare,
  daAssegnare,
  elencoDaAssegnare,
  euroAssegna,
  movimentoDaClassificareAbbinabile,
  ricevutaGiaFatta,
  scriviChiEPerCosa,
  type RigaAssegnata,
  togliLottoAssegnazioni,
  voceDaRicevuta,
} from '../../lib/assegna'
import { oggiARoma, type Cassa, type MovimentoManuale, type VoceContabile } from '../../lib/contabilita'
import { listinoUsabile } from '../../lib/listino'
import { nucleoPerRicevuta } from '../../lib/nucleo'
import type { PagamentoDiretto } from '../../lib/pagamenti'
import { dataRicevuta, type Ricevuta } from '../../lib/ricevute'
import { inCorso, type DatiSegreteria, type PersonaSeg } from '../../lib/segreteria'
import { ChiEPerCosa } from './ChiEPerCosa'
import { Bozza, chiedi, DITO, Guaio, lasciare, messaggio, SchedaPiena, suCarta, Tag, Tasto, useAvviso, useCarica } from './comune'
import { NuovaRicevuta, scarica } from './Ricevute'

type Fai = ReturnType<typeof useAvviso>['fai']
type Avvisa = ReturnType<typeof useAvviso>['avvisa']
/** Quel che serve del movimento: è una riga a mano di CONTABILITÀ. */
type Movimento = Pick<MovimentoManuale, 'id' | 'data' | 'importo' | 'personaId' | 'voceId' | 'descrizione'>

const nome = (p?: Pick<PersonaSeg, 'nome' | 'cognome'>) => (p ? `${p.nome} ${p.cognome}` : '…')
const delMovimento = (id: string) => (x: { movimentoId?: string }) => x.movimentoId === id

/** Persone, corsi e listino: servono al dialogo e alla ricevuta, e si leggono solo quando il bonifico si apre. */
function useAnagrafe(d: DatiSegreteria) {
  return useCarica(async () => {
    const [persone, corsi, letto] = await Promise.all([d.persone(), d.corsi(), d.listino()])
    return { persone, corsi, listino: listinoUsabile(letto.listino, corsi) }
  }, [d])
}
type Anagrafe = NonNullable<ReturnType<typeof useAnagrafe>['dato']>

/** I corsi che la persona fa adesso, come li vuole la ricevuta; con l'archiviazione, che ferma i conti del corso. */
const corsiDi = (p: PersonaSeg, a: Anagrafe, oggi: string) =>
  p.iscrizioni.filter((i) => inCorso(i, oggi)).flatMap((i) => a.corsi.filter((c) => c.id === i.corsoId).map((c) => ({ id: c.id, nome: c.nome, attivo: c.attivo, archiviatoIl: c.archiviatoIl })))

/**
 * Dentro il movimento aperto: quel che del bonifico è assegnato, le ricevute fatte da lì e quel che resta da
 * assegnare. Si mostra solo per le entrate che `cosaNonVaMovimentoDaAssegnare` lascia passare.
 */
export function AssegnaMovimento({ d, m, manuali, casse, voci, diretti, ricevute, fai, avvisa, onFatto, onRileggi }: { d: DatiSegreteria; m: Movimento; manuali: MovimentoManuale[]; casse: Cassa[]; voci: VoceContabile[]; diretti: PagamentoDiretto[]; ricevute: Ricevuta[]; fai: Fai; avvisa: Avvisa; onFatto: () => void; onRileggi: () => void }) {
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
  // La ricevuta già fatta a parte che è di questo bonifico, come in «Collegati prima»: se la si abbina, non si assegna due volte.
  const [nonEQuesta, setNonEQuesta] = useState(false)
  const giaFatta = nonEQuesta ? undefined : ricevute.find((r) => r.id === ricevutaGiaFatta(m.id, manuali, diretti, ricevute, casse, voci, oggi, persone))

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

  // Sta dentro la card della persona, sotto una linea: senza niente da dire non c'è, nemmeno la linea.
  if (!anagrafe.guaio && !righe.length && !fatte.length && resta <= 0 && !assegnando) return null
  return (
    <div className="stack" style={{ gap: 12, paddingTop: 14, borderTop: '1px solid var(--line-soft)' }}>
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
      {giaFatta && (
        <div className="stack" style={{ gap: 6 }}>
          <span className="sg-etichetta" style={{ color: 'var(--giallo-testo)' }}>C’È GIÀ LA RICEVUTA</span>
          <span style={{ fontSize: 15 }}>
            C’è già la ricevuta n. {giaFatta.numero}/{giaFatta.anno} del {dataRicevuta(giaFatta.data).slice(0, 5)} da {euroAssegna(giaFatta.pagato)}
            {giaFatta.personaId !== m.personaId ? `, intestata a ${nome(personaDi(giaFatta.personaId ?? ''))}` : ''}: è questa?
          </span>
          <span className="sg-sotto">Se è la stessa, abbinala: il bonifico prende quella ricevuta e i soldi non si contano due volte.</span>
          <div className="row" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap', paddingTop: 4 }}>
            <Tasto tono="pieno" onClick={() => void fai(() => d.abbinaRicevutaMovimento(m.id, giaFatta.id), 'Bonifico abbinato', onRileggi)}>Abbina</Tasto>
            <button type="button" className="sg-link" style={{ ...DITO, color: 'var(--text)', fontWeight: 600 }} onClick={() => setNonEQuesta(true)}>Non è questa</button>
          </div>
        </div>
      )}
      {resta > 0 && !giaFatta && (
        <div className="stack" style={{ gap: 6 }}>
          <span className="sg-etichetta" style={{ color: 'var(--giallo-testo)' }}>DA ASSEGNARE: {euroAssegna(resta)}</span>
          <span style={{ fontSize: 14 }}>Di’ a cosa va: la quota, un annuale, un trimestre. Finché non lo dici, non conta come pagato.</span>
          <div style={{ paddingTop: 4 }}>
            <Tasto tono="pieno" disabled={!anagrafe.dato} onClick={() => setAssegnando(true)}>Assegna a quota e corsi</Tasto>
          </div>
        </div>
      )}
      {assegnando && anagrafe.dato && (
        <ChiEPerCosa
          d={d} data={m.data} testo={m.descrizione} importo={resta} personaIniziale={m.personaId} gia={{ diretti, ricevute }} conRicevuta soloPersona={false}
          ricevutaDi={(id) => (giaFatta && id === m.personaId ? giaFatta : undefined)}
          onRicevuta={(id) => void fai(() => d.abbinaRicevutaMovimento(m.id, id), 'Bonifico abbinato', () => { setAssegnando(false); onRileggi() })}
          onConferma={(s, eRicevuta) => void fai(() => scriviChiEPerCosa(d, m, s, voci), eRicevuta ? undefined : 'Bonifico assegnato', () => dopoAssegna(eRicevuta))}
          onChiudi={() => setAssegnando(false)}
        />
      )}
    </div>
  )
}

/**
 * Da assegnare, in MOVIMENTI col filtro «Da assegnare» (`soloRiquadri`): le entrate collegate che hanno ancora soldi senza una voce, e sopra i
 * bonifici collegati prima di questo cambio che hanno già la loro ricevuta, da abbinare con un sì.
 */
export function DaAssegnare({ d, manuali, diretti, ricevute, casse, voci, fai, onApri, onCambiato, soloRiquadri = false }: { d: DatiSegreteria; manuali: MovimentoManuale[]; diretti: PagamentoDiretto[]; ricevute: Ricevuta[]; casse: Cassa[]; voci: VoceContabile[]; fai: Fai; onApri: (movimentoId: string) => void; onCambiato: () => void; soloRiquadri?: boolean }) {
  const oggi = oggiARoma()
  const { righe } = elencoDaAssegnare(manuali, diretti, ricevute, casse, voci, oggi)
  const ids = [...new Set(righe.map((r) => r.personaId))].sort().join(',')
  const nomi = useCarica(() => (ids ? d.nomiPersone(ids.split(',')) : Promise.resolve([])), [d, ids])
  const nomeDi = (id: string) => {
    const p = nomi.dato?.find((x) => x.id === id)
    return p ? `${p.cognome} ${p.nome}` : '…'
  }
  const [scartati, setScartati] = useState<string[]>([])
  const anagrafe = useAnagrafe(d)
  // Il genitore serve a riconoscere la causale dei Da classificare; se non si legge, si propone solo col nome intero.
  const genitori = useCarica(() => d.genitori().catch(() => new Map()), [d])
  const persone = conGenitori(anagrafe.dato?.persone ?? [], genitori.dato ?? new Map())
  const chi = (id?: string) => {
    const p = persone.find((x) => x.id === id)
    return p ? `${p.cognome} ${p.nome}` : '…'
  }
  const fuori = (movimentoId: string, ricevutaId: string) => scartati.includes(`${movimentoId}|${ricevutaId}`)
  const proposti = collegatiPrima(manuali, diretti, ricevute, casse, voci, oggi, persone).filter((x) => !fuori(x.movimentoId, x.ricevutaId))
  // Solo i bonifici che non hanno ancora niente assegnato: abbinare una ricevuta a uno già diviso conterebbe due volte.
  const interi = manuali.filter((m) => daAssegnare(m, diretti, ricevute) === m.importo)
  // I Da classificare (151): le ricevute possibili tutte, dalla più vicina; una già proposta sopra non torna qui.
  const daClassificare = interi.filter((m) => movimentoDaClassificareAbbinabile(m, casse, voci, oggi))
  const scelte = daClassificareDaAbbinare(daClassificare, ricevute, new Set(proposti.map((x) => x.ricevutaId)), persone)
    .map((x) => ({ ...x, ricevute: x.ricevute.filter((r) => !fuori(x.movimentoId, r)) }))
    .filter((x) => x.ricevute.length > 0)
  const movimento = (id: string) => manuali.find((m) => m.id === id)
  const ricevuta = (id: string) => ricevute.find((r) => r.id === id)
  // I bonifici con un solo modo di dividerli si assegnano da soli (sicuro.ts); gli altri dicono perché no.
  const da = anagrafe.dato
    ? daSoli({ manuali, diretti, ricevute, casse, voci, persone: anagrafe.dato.persone, corsi: anagrafe.dato.corsi, listino: anagrafe.dato.listino, oggi })
    : { pronti: [], perche: {} as Record<string, string> }
  const pronti = new Set(da.pronti.map((x) => x.movimentoId))
  const restano = righe.filter((r) => !pronti.has(r.movimentoId))
  const [lavoro, setLavoro] = useState<number | null>(null)
  const [lotto, setLotto] = useState<{ chiavi: string[]; tolti?: number; errore?: string } | null>(null)
  const sommaPronti = da.pronti.reduce((s, x) => s + x.importo, 0)
  const aCosa = (x: { personaId: string; righe: RigaAssegnata[] }) => x.righe.map((r) => (r.personaId === x.personaId ? r.voce : `${r.voce} (${chi(r.personaId)})`)).join(' + ')
  const assegnaTutti = async () => {
    const n = da.pronti.length
    const si = await chiedi(`Assegnare ${n === 1 ? 'il bonifico' : `i ${n} bonifici`} (${euroAssegna(sommaPronti)}) come nel riquadro, persona per persona? Senza ricevuta: la fai dal movimento quando serve.`, n === 1 ? 'Sì, assegna' : `Sì, assegna i ${n}`)
    if (!si) return
    setLavoro(0)
    const x = await assegnaDaSoli(d, da.pronti, setLavoro)
    setLavoro(null)
    setLotto({ chiavi: [...(lotto && lotto.tolti === undefined ? lotto.chiavi : []), ...x.chiavi], errore: x.errore })
    onCambiato()
  }
  const togliLotto = async () => {
    if (!lotto) return
    const si = await chiedi(`Togli le assegnazioni dei ${lotto.chiavi.length} bonifici appena assegnati? Tornano in «Da assegnare». Quelli già diventati ricevuta non si toccano.`, 'Sì, togli questo lotto', { pericolo: true })
    if (!si) return
    try {
      setLotto({ chiavi: lotto.chiavi, tolti: (await togliLottoAssegnazioni(d, lotto.chiavi)).tolti })
    } catch (e) {
      setLotto({ ...lotto, errore: messaggio(e, 'Non è cambiato niente: riprova.') })
    }
    onCambiato()
  }
  const abbina = (xs: Array<{ movimentoId: string; ricevutaId: string }>) =>
    void fai(async () => {
      for (const x of xs) await d.abbinaRicevutaMovimento(x.movimentoId, x.ricevutaId)
    }, xs.length > 1 ? `${xs.length} bonifici abbinati` : 'Bonifico abbinato', onCambiato)
  const scarta = (movimentoId: string, ids: string[]) => setScartati([...scartati, ...ids.map((r) => `${movimentoId}|${r}`)])
  const dopo = (mv: MovimentoManuale, r: Ricevuta) => {
    const n = Math.round(Math.abs(Date.parse(`${r.data}T12:00:00Z`) - Date.parse(`${mv.data}T12:00:00Z`)) / 86_400_000)
    return n === 0 ? 'lo stesso giorno' : `${n} ${n === 1 ? 'giorno' : 'giorni'} ${r.data > mv.data ? 'dopo' : 'prima'}`
  }
  const bonifico = (mv: MovimentoManuale) => (
    <span style={{ fontSize: 15 }}>
      <b>Bonifico del {dataRicevuta(mv.data)}</b> <span className="sg-sotto">· {mv.personaId ? chi(mv.personaId) : 'Da classificare'} · {mv.descrizione}</span>
    </span>
  )
  const nonEQuesta = (movimentoId: string, ids: string[], testo = 'Non è questa') => (
    <button type="button" className="sg-link" style={{ ...DITO, color: 'var(--text)', fontWeight: 600 }} onClick={() => scarta(movimentoId, ids)}>{testo}</button>
  )

  return (
    <div className="stack" style={{ gap: 18 }}>
      {proposti.length + scelte.length > 0 && (
        <div className="sg-riquadro stack" style={{ gap: 10 }}>
          <span className="sg-etichetta">C’È GIÀ LA RICEVUTA · {proposti.length + scelte.length}</span>
          <span style={{ fontSize: 14 }}>Questi bonifici sono già nel Conto Corrente e la ricevuta in Bonifico l’hai fatta a parte. Se è la stessa, abbinala: così i soldi non si contano due volte.</span>
          {proposti.map((x) => {
            const mv = movimento(x.movimentoId)
            const r = ricevuta(x.ricevutaId)
            if (!mv || !r) return null
            return (
              <div key={`${x.movimentoId}|${x.ricevutaId}`} className="row" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--line-soft)', paddingTop: 10 }}>
                <span className="stack" style={{ gap: 2, flex: '1 1 380px', minWidth: 0, overflowWrap: 'anywhere' }}>
                  {bonifico(mv)}
                  <span style={{ fontSize: 15 }}>
                    → ricevuta n. {r.numero}/{r.anno} del {dataRicevuta(r.data)} · <b>{chi(r.personaId)}</b>
                    {r.personaId !== mv.personaId && <span className="sg-sotto"> · della famiglia di {chi(mv.personaId)}</span>}
                  </span>
                </span>
                <span className="num" style={{ fontSize: 15, fontWeight: 700 }}>{euroAssegna(mv.importo)}</span>
                <Tasto onClick={() => abbina([x])}>Abbina</Tasto>
                {nonEQuesta(x.movimentoId, [x.ricevutaId])}
              </div>
            )
          })}
          {scelte.map((x) => {
            const mv = movimento(x.movimentoId)
            const rr = x.ricevute.map(ricevuta).filter((r): r is Ricevuta => !!r)
            if (!mv || !rr.length) return null
            const una = rr.length === 1
            return (
              <div key={x.movimentoId} className="stack" style={{ gap: 8, borderTop: '1px solid var(--line-soft)', paddingTop: 10 }}>
                <span className="row" style={{ gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <span style={{ flex: '1 1 380px', minWidth: 0, overflowWrap: 'anywhere' }}>{bonifico(mv)}</span>
                  <span className="num" style={{ fontSize: 15, fontWeight: 700 }}>{euroAssegna(mv.importo)}</span>
                </span>
                {una ? (
                  <span className="sg-sotto" data-tono="aspetta">Abbinando, il bonifico va a {chi(rr[0].personaId)} su «{voceDaRicevuta(rr[0])}».</span>
                ) : (
                  <span className="sg-sotto" data-tono="aspetta">{rr.length} ricevute possono essere questa: scegli quella giusta. Abbinando, il bonifico va alla persona della ricevuta.</span>
                )}
                {rr.map((r) => (
                  <div key={r.id} className="row" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap', paddingLeft: 16 }}>
                    <span style={{ fontSize: 15, flex: '1 1 360px', minWidth: 0, overflowWrap: 'anywhere' }}>
                      ricevuta n. {r.numero}/{r.anno} del {dataRicevuta(r.data)} · <b>{chi(r.personaId)}</b> <span className="sg-sotto">· {dopo(mv, r)}</span>
                    </span>
                    <Tasto onClick={() => abbina([{ movimentoId: x.movimentoId, ricevutaId: r.id }])}>{una ? 'Abbina' : 'È questa'}</Tasto>
                    {una && nonEQuesta(x.movimentoId, [r.id])}
                  </div>
                ))}
                {!una && <div style={{ paddingLeft: 16 }}>{nonEQuesta(x.movimentoId, rr.map((r) => r.id), 'Nessuna di queste')}</div>}
              </div>
            )
          })}
          {proposti.length > 1 && (
            <div>
              <Tasto tono="pieno" onClick={() => abbina(proposti)}>{scelte.length ? `Abbina i ${proposti.length} già collegati` : `Abbina tutti e ${proposti.length}`}</Tasto>
            </div>
          )}
        </div>
      )}
      {(da.pronti.length > 0 || lotto) && (
        <section aria-label="Si assegnano da soli" className="sg-riquadro stack" style={{ gap: 10 }}>
          <span className="sg-etichetta">{da.pronti.length ? `SI ASSEGNANO DA SOLI · ${da.pronti.length} ${da.pronti.length === 1 ? 'BONIFICO' : 'BONIFICI'} · ${euroAssegna(sommaPronti)}` : 'ASSEGNATI DA SOLI'}</span>
          {da.pronti.length > 0 && (
            <span style={{ fontSize: 14 }}>
              Per questi la persona è sicura e l’importo è esattamente quel che deve: niente resto, niente corso pagato a metà, niente annuale o trimestre da scegliere, un solo modo di dividere. Si assegnano senza ricevuta, come «Assegna senza ricevuta».
            </span>
          )}
          {da.pronti.map((x) => (
            <div key={x.movimentoId} className="row" style={{ gap: 12, alignItems: 'baseline', flexWrap: 'wrap', borderTop: '1px solid var(--line-soft)', paddingTop: 8, fontSize: 15 }}>
              <span className="num" style={{ width: 90 }}>{dataRicevuta(x.data)}</span>
              <span style={{ flex: '1 1 320px', minWidth: 0, overflowWrap: 'anywhere' }}><b>{chi(x.personaId)}</b> <span className="sg-sotto">· {x.descrizione}</span></span>
              <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>→ {aCosa(x)}</span>
              <span className="num" style={{ fontWeight: 700, width: 100, textAlign: 'right' }}>{euroAssegna(x.importo)}</span>
            </div>
          ))}
          {lotto && (lotto.tolti === undefined || !da.pronti.length) && (
            <span role="status" style={{ fontSize: 15 }}>
              {lotto.tolti !== undefined ? `Tolto il lotto: ${lotto.chiavi.length === 1 ? 'il bonifico è tornato' : `i ${lotto.chiavi.length} bonifici sono tornati`} da assegnare.` : `Assegnati ${lotto.chiavi.length} ${lotto.chiavi.length === 1 ? 'bonifico' : 'bonifici'}: la ricevuta si fa dal movimento, quando serve.`}
            </span>
          )}
          {lotto?.errore && <div role="alert" className="sg-riquadro" style={{ borderColor: 'var(--rosso-testo)', fontSize: 15 }}>{lotto.errore} Riprova: quelli già assegnati non si ripetono.</div>}
          <div className="row" aria-live="polite" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap', paddingTop: 4 }}>
            {da.pronti.length > 0 && (
              <Tasto tono="pieno" disabled={lavoro !== null} onClick={() => void assegnaTutti()}>
                {lavoro !== null ? `Assegno… ${lavoro} su ${da.pronti.length}` : da.pronti.length === 1 ? 'Assegna' : `Assegna i ${da.pronti.length}`}
              </Tasto>
            )}
            {lotto && lotto.tolti === undefined && lotto.chiavi.length > 0 && (
              <Tasto className="sg-pericolo" onClick={() => void togliLotto()}>Togli questo lotto</Tasto>
            )}
            {lotto && lotto.tolti === undefined && lotto.chiavi.length > 0 && <span className="sg-sotto">«Togli questo lotto» li rimette tutti in Da assegnare; uno solo si annulla anche dal movimento.</span>}
          </div>
        </section>
      )}
      {!soloRiquadri && <div className="stack" style={{ gap: 6 }}>
        <span className="sg-etichetta">
          DA ASSEGNARE · {restano.length} {restano.length === 1 ? 'ENTRATA' : 'ENTRATE'} · {euroAssegna(restano.reduce((s, r) => s + r.daAssegnare, 0))}
        </span>
        {!restano.length && <span className="sg-sotto">{righe.length ? 'Gli altri si assegnano da soli, qui sopra.' : 'Niente da assegnare: ogni entrata collegata su quota e corsi dice a cosa va.'}</span>}
        {restano.map((r) => {
          const mv = movimento(r.movimentoId)
          const cassa = casse.find((c) => c.id === mv?.cassaId)?.nome ?? ''
          return (
            <div key={r.movimentoId} className="row" style={{ gap: 12, alignItems: 'baseline', flexWrap: 'wrap', borderTop: '1px solid var(--line-soft)', paddingTop: 8 }}>
              <span className="num" style={{ fontSize: 15, width: 90 }}>{dataRicevuta(r.data)}</span>
              <span className="stack" style={{ gap: 2, fontSize: 15, flex: '1 1 220px', minWidth: 0, overflowWrap: 'anywhere' }}>
                <span>{nomeDi(r.personaId)} <span className="sg-sotto">· {mv?.descrizione}</span></span>
                {da.perche[r.movimentoId] && <span className="sg-sotto" data-tono="aspetta">{da.perche[r.movimentoId]}</span>}
              </span>
              <span className="sg-sotto">{cassa}</span>
              <span className="num" style={{ fontSize: 15 }}>{r.daAssegnare === r.importo ? `${euroAssegna(r.importo)} · tutto` : `${euroAssegna(r.daAssegnare)} di ${euroAssegna(r.importo)}`}</span>
              <Tasto onClick={() => onApri(r.movimentoId)}>Assegna</Tasto>
            </div>
          )
        })}
      </div>}
    </div>
  )
}
