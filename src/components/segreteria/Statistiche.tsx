import { useMemo, useState } from 'react'
import type { DatiSegreteria, LezioneStat, PersonaSeg, ProvaSeg } from '../../lib/segreteria'
import { comeCertificato, comePaga, inCorso } from '../../lib/segreteria'
import { chiaveGiorno, oraDi } from '../../lib/sala'
import type { Destinazione, Voce } from './Segreteria'
import { Guaio, Riga, Testa, useCarica } from './comune'
import { Numero } from './Presenze'

const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
const MESI_LUNGHI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
/** Da lunedì: la settimana della palestra. */
const GIORNI = [1, 2, 3, 4, 5, 6, 0]
const GIORNI_CORTI = ['DOM', 'LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB']

type Periodo = 'tre' | 'sei' | 'dodici' | 'stagione'
const PERIODI: Array<[Periodo, string]> = [
  ['tre', 'Ultimi 3 mesi'],
  ['sei', 'Ultimi 6 mesi'],
  ['dodici', 'Ultimi 12 mesi'],
  ['stagione', 'Da settembre'],
]

/** Dal primo del mese, così ogni colonna è un mese intero; fino a oggi. */
function inizioDi(p: Periodo, oggi = new Date()) {
  if (p === 'stagione') return new Date(oggi.getMonth() >= 8 ? oggi.getFullYear() : oggi.getFullYear() - 1, 8, 1)
  const n = p === 'tre' ? 3 : p === 'sei' ? 6 : 12
  return new Date(oggi.getFullYear(), oggi.getMonth() - n + 1, 1)
}

/** I mesi del periodo, `AAAA-MM`, dal più vecchio. */
function mesiFra(da: Date, a: Date) {
  const x: string[] = []
  for (let d = new Date(da.getFullYear(), da.getMonth(), 1); d <= a; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    x.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return x
}
const meseDi = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const nomeMese = (m: string, anno = false) => {
  const [a, n] = m.split('-').map(Number)
  return anno ? `${MESI_LUNGHI[n - 1]} ${a}` : MESI[n - 1]
}
/** L'ultimo giorno del mese, o oggi se il mese è questo. */
const fineMese = (m: string, oggi: string) => {
  const [a, n] = m.split('-').map(Number)
  const f = chiaveGiorno(new Date(a, n, 0))
  return f < oggi ? f : oggi
}

const conAppello = (l: LezioneStat) => l.presenti + l.assenti + l.giustificati > 0
const svolta = (l: LezioneStat) => l.stato !== 'annullata'
/**
 * I conti di PRESENZE: presenti su dovute, dove c'è l'appello; i giustificati
 * non contano né sopra né sotto. Le prove sono a parte, in sala c'erano.
 */
function conto(lezioni: LezioneStat[]) {
  let presenti = 0
  let dovute = 0
  let prove = 0
  let capienza = 0
  let pieni = 0
  let fatte = 0
  for (const l of lezioni) {
    if (!svolta(l) || !conAppello(l)) continue
    fatte++
    presenti += l.presenti
    dovute += l.iscritti - l.giustificati
    prove += l.prove
    if (l.capienza) {
      capienza += l.capienza
      pieni += l.presenti + l.prove
    }
  }
  return { fatte, presenti, dovute, prove, capienza, pieni }
}
const percento = (su: number, di: number) => (di ? Math.round((100 * su) / di) : null)
const media = (x: number, n: number) => (n ? (x / n).toLocaleString('it-IT', { maximumFractionDigits: 1 }) : '—')
const euro = (centesimi: number) => (centesimi / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const plurale = (n: number, uno: string, tanti: string) => `${n} ${n === 1 ? uno : tanti}`

/** I numeri di ogni lezione in un foglio da aprire con Excel, come il CSV di PRESENZE. */
function scaricaCsv(lezioni: LezioneStat[], nome: string) {
  const q = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const testo = [
    ['data', 'ora', 'corso', 'sala', 'istruttore', 'stato', 'iscritti', 'presenti', 'assenti', 'giustificati', 'prove', 'capienza'].join(';'),
    ...lezioni.map((l) =>
      [
        chiaveGiorno(new Date(l.inizio)), oraDi(l.inizio), l.corso, l.sala ?? '', l.istruttori.join(', '),
        l.stato === 'annullata' ? 'annullata' : conAppello(l) ? 'con appello' : 'senza appello',
        String(l.iscritti), String(l.presenti), String(l.assenti), String(l.giustificati), String(l.prove), l.capienza ? String(l.capienza) : '',
      ]
        .map(q)
        .join(';'),
    ),
  ].join('\r\n')
  const url = URL.createObjectURL(new Blob(['﻿' + testo], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `statistiche-${nome.toLowerCase().replace(/\s+/g, '-')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Le statistiche: come va la palestra mese per mese, a che ora si viene,
 * quali corsi si riempiono, chi insegna quanto, quanto entra.
 *
 * PRESENZE guarda un mese e le persone, per richiamarle; qui si guardano i
 * mesi insieme, in numeri. I conti sono gli stessi: si contano solo le
 * lezioni con l'appello, e i giustificati non pesano. Le lezioni le conta il
 * database (22-statistiche.sql), perché in un anno sono migliaia.
 */
export function Statistiche({ d, onVai }: { d: DatiSegreteria; onVai: (v: Voce, dove?: Destinazione) => void }) {
  const [periodo, setPeriodo] = useState<Periodo>('sei')
  const [corso, setCorso] = useState('')
  const oggi = useMemo(() => new Date(), [])
  const da = useMemo(() => inizioDi(periodo, oggi), [periodo, oggi])
  const mesi = useMemo(() => mesiFra(da, oggi), [da, oggi])
  const g = chiaveGiorno(oggi)

  const stat = useCarica(() => d.statistiche(da, oggi), [d, da, oggi])
  const persone = useCarica(() => d.persone(), [d])
  const prove = useCarica(() => d.prove(da, oggi), [d, da, oggi])

  const tutte = stat.dato?.lezioni ?? []
  const corsi = [...new Map(tutte.map((l) => [l.corsoId, l.corso])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'it'))
  const lezioni = corso ? tutte.filter((l) => l.corsoId === corso) : tutte
  const totale = conto(lezioni)
  const senzaAppello = lezioni.filter((l) => svolta(l) && !conAppello(l)).length

  const iscritti = useMemo(() => contaIscritti(persone.dato ?? [], corso, mesi, g, chiaveGiorno(da)), [persone.dato, corso, mesi, g, da])
  const provati = (prove.dato ?? []).filter((x) => !corso || x.corsoId === corso)
  const personeProva = new Map(provati.map((x) => [x.personaId, x.iscritto]))
  const convertiti = [...personeProva.values()].filter(Boolean).length

  const nomePeriodo = PERIODI.find((x) => x[0] === periodo)![1]
  const nomeCorso = corso ? corsi.find((c) => c[0] === corso)?.[1] : undefined

  return (
    <>
      <Testa titolo="STATISTICHE" sotto="Come va la palestra, mese per mese: chi viene, quando, in quali corsi, quanto entra.">
        <label htmlFor="periodo-s" className="vh">
          Periodo
        </label>
        <select id="periodo-s" className="sg-campo" value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)}>
          {PERIODI.map(([id, nome]) => (
            <option key={id} value={id}>
              {nome}
            </option>
          ))}
        </select>
        <label htmlFor="corso-s" className="vh">
          Corso
        </label>
        <select id="corso-s" className="sg-campo" value={corso} onChange={(e) => setCorso(e.target.value)}>
          <option value="">Tutti i corsi</option>
          {/* Un corso scelto resta nel menu anche in un periodo in cui non c'è: si vede che è vuoto. */}
          {corso && !corsi.some((c) => c[0] === corso) && <option value={corso}>{nomeCorso ?? 'Il corso scelto'}</option>}
          {corsi.map(([id, nome]) => (
            <option key={id} value={id}>
              {nome}
            </option>
          ))}
        </select>
        <button type="button" className="sg-btn sg-btn-linea" disabled={!lezioni.length} onClick={() => scaricaCsv(lezioni, `${nomeCorso ?? 'tutti'} ${nomePeriodo}`)}>
          SCARICA CSV
        </button>
      </Testa>

      {stat.guaio && <Guaio testo={stat.guaio} />}

      <div className="sg-numeri">
        <Numero
          titolo="ISCRITTI OGGI"
          valore={persone.dato ? iscritti.oggi : '—'}
          sotto={persone.dato ? `${plurale(iscritti.nuovi, 'nuovo', 'nuovi')} e ${plurale(iscritti.usciti, 'uscito', 'usciti')} nel periodo` : 'sto leggendo…'}
        />
        <Numero
          titolo="PRESENZE"
          valore={stat.dato ? totale.presenti + totale.prove : '—'}
          sotto={totale.fatte ? `${media(totale.presenti + totale.prove, totale.fatte)} a lezione, in ${plurale(totale.fatte, 'lezione', 'lezioni')} con l'appello` : 'nessun appello nel periodo'}
        />
        <Numero
          titolo="SUGLI ISCRITTI"
          valore={percento(totale.presenti, totale.dovute) === null ? '—' : `${percento(totale.presenti, totale.dovute)}%`}
          sotto={senzaAppello ? `${plurale(senzaAppello, 'lezione', 'lezioni')} senza appello non ${senzaAppello === 1 ? 'conta' : 'contano'}` : 'i giustificati non contano'}
        />
        <Numero
          titolo="PROVE → ISCRITTI"
          valore={personeProva.size ? `${percento(convertiti, personeProva.size)}%` : '—'}
          sotto={prove.guaio ? 'le prove non si leggono' : personeProva.size ? `${convertiti} su ${plurale(personeProva.size, 'persona venuta', 'persone venute')} a provare` : 'nessuno è venuto a provare'}
        />
      </div>

      {stat.dato === null && !stat.guaio && <span className="sg-sotto">Sto contando le lezioni…</span>}

      {stat.dato && (
        <>
          <div className="sg-stat-due">
            <section aria-label="Presenze mese per mese" className="sg-riquadro">
              <Riga titolo="PRESENZE MESE PER MESE">
                <span style={{ fontSize: 12, color: 'var(--dim)' }}>iscritti presenti e prove</span>
              </Riga>
              <Colonne
                nome="Presenze"
                colonne={mesi.map((m) => {
                  const c = conto(lezioni.filter((l) => meseDi(l.inizio) === m))
                  const pc = percento(c.presenti, c.dovute)
                  return {
                    chiave: m,
                    etichetta: nomeMese(m),
                    valore: c.presenti + c.prove,
                    dettaglio: [
                      nomeMese(m, true),
                      `${c.presenti + c.prove} presenze${c.prove ? `, di cui ${c.prove} in prova` : ''}`,
                      c.fatte ? `${media(c.presenti + c.prove, c.fatte)} a lezione · ${pc}% sugli iscritti` : 'nessun appello',
                    ],
                  }
                })}
              />
            </section>

            <section aria-label="Iscritti mese per mese" className="sg-riquadro">
              <Riga titolo="ISCRITTI MESE PER MESE">
                <span style={{ fontSize: 12, color: 'var(--dim)' }}>a fine mese, con almeno un corso</span>
              </Riga>
              {persone.guaio && <Guaio testo={persone.guaio} />}
              {persone.dato && (
                <Colonne
                  nome="Iscritti"
                  colonne={iscritti.mesi.map((x) => ({
                    chiave: x.mese,
                    etichetta: nomeMese(x.mese),
                    valore: x.iscritti,
                    dettaglio: [nomeMese(x.mese, true), `${x.iscritti} iscritti`, `${plurale(x.nuovi, 'nuovo', 'nuovi')} · ${plurale(x.usciti, 'uscito', 'usciti')}`],
                  }))}
                />
              )}
            </section>
          </div>

          <section aria-label="Quando si viene" className="sg-riquadro">
            <Riga titolo="QUANDO SI VIENE">
              <span style={{ fontSize: 12, color: 'var(--dim)' }}>presenti a lezione, in media, per giorno e ora d'inizio</span>
            </Riga>
            <Orari lezioni={lezioni} />
          </section>

          <section aria-label="Corsi" className="sg-riquadro">
            <Riga titolo="CORSI">
              <span style={{ fontSize: 12, color: 'var(--dim)' }}>un tocco sul nome per guardare solo quello</span>
            </Riga>
            <TabellaCorsi lezioni={tutte} scelto={corso} onScegli={(id) => setCorso(corso === id ? '' : id)} onVai={onVai} />
          </section>

          <div className="sg-stat-due">
            <section aria-label="Istruttori" className="sg-riquadro">
              <Riga titolo="ISTRUTTORI">
                <span style={{ fontSize: 12, color: 'var(--dim)' }}>le lezioni svolte, da titolare o da sostituto</span>
              </Riga>
              <TabellaIstruttori lezioni={lezioni} />
            </section>

            <section aria-label="Iscritti oggi" className="sg-riquadro">
              <Riga titolo="IN REGOLA OGGI">
                <span style={{ fontSize: 12, color: 'var(--dim)' }}>chi è iscritto{nomeCorso ? ` a ${nomeCorso}` : ''}</span>
              </Riga>
              {persone.dato && <InRegola persone={iscritti.attivi} oggi={g} onVai={onVai} />}
            </section>
          </div>

          <section aria-label="Prove mese per mese" className="sg-riquadro">
            <Riga titolo="PROVE MESE PER MESE">
              <span style={{ fontSize: 12, color: 'var(--dim)' }}>chi è venuto a provare, nel mese della prima prova, e quanti oggi sono iscritti</span>
            </Riga>
            {prove.guaio ? <Guaio testo={prove.guaio} /> : prove.dato && <ProveMese mesi={mesi} prove={provati} />}
          </section>

          <section aria-label="Incassi mese per mese" className="sg-riquadro">
            <Riga titolo="INCASSI MESE PER MESE">
              <span style={{ fontSize: 12, color: 'var(--dim)' }}>quanto è stato pagato con le ricevute, tutti i corsi insieme</span>
            </Riga>
            {stat.dato.incassi === null ? (
              <span className="sg-sotto">Le ricevute non sono ancora attive sul database: va lanciato 16-ricevute.sql.</span>
            ) : (
              <Incassi mesi={mesi} incassi={stat.dato.incassi} />
            )}
          </section>
        </>
      )}
    </>
  )
}

/** Quanti iscritti oggi e a fine di ogni mese, chi è entrato e chi è uscito. */
function contaIscritti(persone: PersonaSeg[], corso: string, mesi: string[], oggi: string, dal: string) {
  // Le iscrizioni che contano: a quel corso, o a tutti.
  const di = (p: PersonaSeg) => (corso ? p.iscrizioni.filter((i) => i.corsoId === corso) : p.iscrizioni)
  const vale = (p: PersonaSeg, giorno: string) => p.attiva && di(p).some((i) => inCorso(i, giorno))
  const primo = (p: PersonaSeg) => di(p).reduce<string | null>((m, i) => (m === null || i.dal < m ? i.dal : m), null)
  /** L'ultimo giorno da iscritto, per chi ha smesso: `null` per chi c'è ancora. */
  const ultimo = (p: PersonaSeg) => (di(p).some((i) => !i.al) ? null : di(p).reduce<string | null>((m, i) => (m === null || i.al! > m ? i.al! : m), null))
  const attivi = persone.filter((p) => vale(p, oggi))
  const nuoviFra = (a: string, b: string) => persone.filter((p) => p.attiva && (primo(p) ?? '') >= a && (primo(p) ?? '') <= b).length
  const uscitiFra = (a: string, b: string) => persone.filter((p) => {
    const u = ultimo(p)
    return u !== null && u >= a && u <= b && !vale(p, oggi)
  }).length
  return {
    oggi: attivi.length,
    attivi,
    nuovi: nuoviFra(dal, oggi),
    usciti: uscitiFra(dal, oggi),
    mesi: mesi.map((m) => {
      const fine = fineMese(m, oggi)
      return { mese: m, iscritti: persone.filter((p) => vale(p, fine)).length, nuovi: nuoviFra(`${m}-01`, fine), usciti: uscitiFra(`${m}-01`, fine) }
    }),
  }
}

interface Colonna {
  chiave: string
  etichetta: string
  valore: number
  dettaglio: string[]
}

/** Un numero più tondo sopra il massimo, per la scala: 0, metà, tutto. */
function tetto(x: number) {
  if (x <= 0) return 1
  // Con pochi (le prove, un corso piccolo) un numero pari: la metà resta una persona intera.
  if (x <= 10) return Math.max(2, Math.ceil(x / 2) * 2)
  const p = 10 ** Math.floor(Math.log10(x))
  return ([1, 2, 2.5, 5, 10].map((k) => k * p).find((k) => k >= x) ?? 10 * p)
}

/**
 * Le colonne di un valore solo, mese per mese: una tinta sola, la scala a
 * sinistra, il numero esatto sotto il dito o il mouse. Il mese in corso non è
 * finito, e si vede: è tratteggiato.
 */
function Colonne({ nome, colonne, formato = (n: number) => n.toLocaleString('it-IT') }: { nome: string; colonne: Colonna[]; formato?: (n: number) => string }) {
  const [sopra, setSopra] = useState<string | null>(null)
  const max = tetto(Math.max(0, ...colonne.map((c) => c.valore)))
  if (colonne.every((c) => c.valore === 0)) return <span className="sg-sotto">Niente da contare in questo periodo.</span>
  return (
    <div className="sg-colonne" role="group" aria-label={nome}>
      <div className="sg-colonne-scala num" aria-hidden="true">
        <span>{formato(max)}</span>
        <span>{formato(max / 2)}</span>
        <span>0</span>
      </div>
      <div className="sg-colonne-piano" style={{ gridTemplateColumns: `repeat(${colonne.length}, minmax(0, 1fr))` }}>
        {colonne.map((c, i) => (
          <button
            key={c.chiave}
            type="button"
            className="sg-colonna"
            aria-label={c.dettaglio.join(', ')}
            data-in-corso={i === colonne.length - 1}
            onMouseEnter={() => setSopra(c.chiave)}
            onMouseLeave={() => setSopra(null)}
            onFocus={() => setSopra(c.chiave)}
            onBlur={() => setSopra(null)}
          >
            <span className="sg-colonna-binario">
              {c.valore > 0 && <span className="sg-colonna-pieno" style={{ height: `${(100 * c.valore) / max}%` }} />}
              {sopra === c.chiave && (
                <span className="sg-colonna-suggerimento" role="tooltip" data-lato={i >= colonne.length / 2 ? 'destra' : 'sinistra'}>
                  {c.dettaglio.map((t, k) => (
                    <span key={k} style={k === 0 ? { fontWeight: 700 } : undefined}>
                      {t}
                    </span>
                  ))}
                </span>
              )}
            </span>
            <span className="sg-colonna-etichetta num">{c.etichetta.toUpperCase()}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** Giorni e ore: in ogni casella quanti vengono in media, più scura dove sono di più. */
function Orari({ lezioni }: { lezioni: LezioneStat[] }) {
  const [sopra, setSopra] = useState<string | null>(null)
  const caselle = new Map<string, { lezioni: number; presenti: number; corsi: Set<string> }>()
  for (const l of lezioni) {
    if (!svolta(l) || !conAppello(l)) continue
    const d = new Date(l.inizio)
    const k = `${d.getDay()}:${d.getHours()}`
    const c = caselle.get(k) ?? { lezioni: 0, presenti: 0, corsi: new Set<string>() }
    c.lezioni++
    c.presenti += l.presenti + l.prove
    c.corsi.add(l.corso)
    caselle.set(k, c)
  }
  if (!caselle.size) return <span className="sg-sotto">Nessun appello fatto in questo periodo.</span>
  const ore = [...new Set([...caselle.keys()].map((k) => Number(k.split(':')[1])))].sort((a, b) => a - b)
  const giorni = GIORNI.filter((gg) => ore.some((o) => caselle.has(`${gg}:${o}`)))
  const max = Math.max(...[...caselle.values()].map((c) => c.presenti / c.lezioni))
  return (
    <div className="sg-orari-scorre">
      <table className="sg-orari">
        <thead>
          <tr>
            <th />
            {ore.map((o) => (
              <th key={o} scope="col" className="num">
                {String(o).padStart(2, '0')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {giorni.map((gg) => (
            <tr key={gg}>
              <th scope="row" className="num">
                {GIORNI_CORTI[gg]}
              </th>
              {ore.map((o) => {
                const k = `${gg}:${o}`
                const c = caselle.get(k)
                if (!c) return <td key={o} />
                const m = c.presenti / c.lezioni
                // Cinque gradini di un blu solo: dal fondo al pieno.
                const gradino = Math.min(4, Math.floor((5 * m) / (max || 1)))
                return (
                  <td key={o}>
                    <button
                      type="button"
                      className="sg-orario num"
                      data-gradino={gradino}
                      aria-label={`${GIORNI_CORTI[gg]} alle ${o}: ${media(c.presenti, c.lezioni)} a lezione in ${plurale(c.lezioni, 'lezione', 'lezioni')}, ${[...c.corsi].join(', ')}`}
                      onMouseEnter={() => setSopra(k)}
                      onMouseLeave={() => setSopra(null)}
                      onFocus={() => setSopra(k)}
                      onBlur={() => setSopra(null)}
                    >
                      {media(c.presenti, c.lezioni)}
                      {sopra === k && (
                        <span className="sg-colonna-suggerimento" role="tooltip" data-lato={ore.indexOf(o) >= ore.length / 2 ? 'destra' : 'sinistra'}>
                          <span style={{ fontWeight: 700 }}>
                            {GIORNI_CORTI[gg]} · {String(o).padStart(2, '0')}:00
                          </span>
                          <span>
                            {media(c.presenti, c.lezioni)} a lezione · {plurale(c.lezioni, 'lezione', 'lezioni')}
                          </span>
                          <span>{[...c.corsi].sort((a, b) => a.localeCompare(b, 'it')).join(', ')}</span>
                        </span>
                      )}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Una barra dentro una cella: quanto, accanto al numero esatto. */
function Barretta({ pc }: { pc: number | null }) {
  if (pc === null) return <span style={{ color: 'var(--faint)' }}>—</span>
  return (
    <span className="sg-barretta">
      <span className="sg-barra-binario">
        <span className="sg-barra-pieno" style={{ width: `${Math.min(100, pc)}%` }} />
      </span>
      <span className="num">{pc}%</span>
    </span>
  )
}

function TabellaCorsi({ lezioni, scelto, onScegli, onVai }: { lezioni: LezioneStat[]; scelto: string; onScegli: (id: string) => void; onVai: (v: Voce, dove?: Destinazione) => void }) {
  const righe = [...new Map(lezioni.map((l) => [l.corsoId, l])).values()]
    .map((x) => {
      const qui = lezioni.filter((l) => l.corsoId === x.corsoId)
      const c = conto(qui)
      return {
        id: x.corsoId,
        nome: x.corso,
        colore: x.colore,
        ...c,
        annullate: qui.filter((l) => !svolta(l)).length,
        senza: qui.filter((l) => svolta(l) && !conAppello(l)).length,
        pc: percento(c.presenti, c.dovute),
        pieno: percento(c.pieni, c.capienza),
      }
    })
    .sort((a, b) => b.presenti + b.prove - (a.presenti + a.prove) || a.nome.localeCompare(b.nome, 'it'))
  if (!righe.length) return <span className="sg-sotto">Nessuna lezione in questo periodo.</span>
  return (
    <div className="sg-orari-scorre">
      <table className="sg-stat-tabella">
        <thead>
          <tr>
            <th scope="col">CORSO</th>
            <th scope="col" className="num-col">LEZIONI</th>
            <th scope="col" className="num-col">A LEZIONE</th>
            <th scope="col">SUGLI ISCRITTI</th>
            <th scope="col">SUI POSTI</th>
            <th scope="col" className="num-col">PROVE</th>
            <th scope="col" className="num-col">ANNULLATE</th>
            <th scope="col" className="num-col">SENZA APPELLO</th>
          </tr>
        </thead>
        <tbody>
          {righe.map((r) => (
            <tr key={r.id} data-spenta={!!scelto && scelto !== r.id}>
              <th scope="row">
                <button type="button" className="sg-stat-corso ob" aria-pressed={scelto === r.id} style={{ ['--tinta' as string]: r.colore ?? 'var(--line)' }} onClick={() => onScegli(r.id)}>
                  {r.nome.toUpperCase()}
                </button>
              </th>
              <td className="num num-col">{r.fatte}</td>
              <td className="num num-col">{media(r.presenti + r.prove, r.fatte)}</td>
              <td>
                <Barretta pc={r.pc} />
              </td>
              <td>
                <Barretta pc={r.pieno} />
              </td>
              <td className="num num-col">{r.prove || '—'}</td>
              <td className="num num-col">{r.annullate || '—'}</td>
              <td className="num num-col">
                {r.senza ? (
                  <button type="button" className="sg-link" style={{ color: 'var(--rosso)' }} onClick={() => onVai('presenze')} title="Le trovi in PRESENZE, mese per mese">
                    {r.senza}
                  </button>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <span className="sg-sotto" style={{ fontSize: 12 }}>
        A lezione: iscritti presenti e prove, dove c'è l'appello. Sui posti: rispetto ai posti del corso, quando sono scritti.
      </span>
    </div>
  )
}

function TabellaIstruttori({ lezioni }: { lezioni: LezioneStat[] }) {
  const per = new Map<string, LezioneStat[]>()
  for (const l of lezioni) {
    if (!svolta(l)) continue
    for (const n of l.istruttori) per.set(n, [...(per.get(n) ?? []), l])
  }
  const righe = [...per.entries()]
    .map(([nome, qui]) => {
      const c = conto(qui)
      return { nome, lezioni: qui.length, sostituto: qui.filter((l) => l.sostituto).length, ...c, pc: percento(c.presenti, c.dovute) }
    })
    .sort((a, b) => b.lezioni - a.lezioni || a.nome.localeCompare(b.nome, 'it'))
  if (!righe.length) return <span className="sg-sotto">Nessuna lezione svolta in questo periodo.</span>
  return (
    <div className="sg-orari-scorre">
      <table className="sg-stat-tabella">
        <thead>
          <tr>
            <th scope="col">ISTRUTTORE</th>
            <th scope="col" className="num-col">LEZIONI</th>
            <th scope="col" className="num-col">DA SOSTITUTO</th>
            <th scope="col" className="num-col">A LEZIONE</th>
            <th scope="col">SUGLI ISCRITTI</th>
          </tr>
        </thead>
        <tbody>
          {righe.map((r) => (
            <tr key={r.nome}>
              <th scope="row" style={{ fontWeight: 600 }}>
                {r.nome}
              </th>
              <td className="num num-col">{r.lezioni}</td>
              <td className="num num-col">{r.sostituto || '—'}</td>
              <td className="num num-col">{media(r.presenti + r.prove, r.fatte)}</td>
              <td>
                <Barretta pc={r.pc} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

type Tono = 'verde' | 'giallo' | 'rosso' | 'spento'

/** Una barra divisa in parti, ognuna col suo nome e il suo numero: il colore non è mai da solo. */
function Parti({ titolo, parti }: { titolo: string; parti: Array<{ nome: string; n: number; tono: Tono }> }) {
  const tot = parti.reduce((s, p) => s + p.n, 0)
  return (
    <div className="stack" style={{ gap: 8 }}>
      <span className="sg-etichetta">{titolo}</span>
      <div className="sg-parti" role="img" aria-label={`${titolo}: ${parti.map((p) => `${p.nome} ${p.n}`).join(', ')}`}>
        {parti
          .filter((p) => p.n > 0)
          .map((p) => (
            <span key={p.nome} className="sg-parte" data-tono={p.tono} style={{ flexGrow: p.n }} />
          ))}
      </div>
      <div className="sg-parti-legenda">
        {parti.map((p) => (
          <span key={p.nome} className="sg-parti-voce">
            <span className="sg-parte-segno" data-tono={p.tono} />
            {p.nome} <span className="num" style={{ fontWeight: 700, color: 'var(--text)' }}>{p.n}</span>
            {tot > 0 && <span style={{ color: 'var(--faint)' }}>{Math.round((100 * p.n) / tot)}%</span>}
          </span>
        ))}
      </div>
    </div>
  )
}

function InRegola({ persone, oggi, onVai }: { persone: PersonaSeg[]; oggi: string; onVai: (v: Voce, dove?: Destinazione) => void }) {
  if (!persone.length) return <span className="sg-sotto">Nessuno è iscritto oggi.</span>
  const cert = { valido: 0, in_scadenza: 0, scaduto: 0, manca: 0 }
  const paga = { pagato: 0, in_parte: 0, da_pagare: 0, scaduto: 0 }
  for (const p of persone) {
    cert[comeCertificato(p.certificato, oggi)]++
    paga[comePaga(p.pagamento, oggi)]++
  }
  return (
    <div className="stack" style={{ gap: 18 }}>
      <Parti
        titolo="CERTIFICATO MEDICO"
        parti={[
          { nome: 'Valido', n: cert.valido, tono: 'verde' },
          { nome: 'In scadenza', n: cert.in_scadenza, tono: 'giallo' },
          { nome: 'Scaduto', n: cert.scaduto, tono: 'rosso' },
          { nome: 'Manca', n: cert.manca, tono: 'spento' },
        ]}
      />
      <Parti
        titolo="PAGAMENTO"
        parti={[
          { nome: 'Pagato', n: paga.pagato, tono: 'verde' },
          { nome: 'In parte', n: paga.in_parte, tono: 'giallo' },
          { nome: 'Scaduto', n: paga.scaduto, tono: 'rosso' },
          { nome: 'Da pagare', n: paga.da_pagare, tono: 'spento' },
        ]}
      />
      <button type="button" className="sg-btn sg-btn-linea" style={{ alignSelf: 'flex-start' }} onClick={() => onVai('iscritti')}>
        CHI NON È IN REGOLA
      </button>
    </div>
  )
}

/**
 * Le prove mese per mese: ognuno conta una volta, nel mese in cui è venuto
 * la prima volta nel periodo, anche se poi ha provato altre lezioni (la
 * settimana di prova). Oggi iscritto vuol dire iscritto a un corso qualunque.
 */
function ProveMese({ mesi, prove }: { mesi: string[]; prove: ProvaSeg[] }) {
  const prima = new Map<string, ProvaSeg>()
  for (const x of prove) {
    const p = prima.get(x.personaId)
    if (!p || x.inizio < p.inizio) prima.set(x.personaId, x)
  }
  const lezioni = new Map<string, number>()
  for (const x of prove) lezioni.set(meseDi(x.inizio), (lezioni.get(meseDi(x.inizio)) ?? 0) + 1)
  const per = new Map<string, { persone: number; iscritti: number }>()
  for (const x of prima.values()) {
    const m = per.get(meseDi(x.inizio)) ?? { persone: 0, iscritti: 0 }
    m.persone++
    if (x.iscritto) m.iscritti++
    per.set(meseDi(x.inizio), m)
  }
  return (
    <Colonne
      nome="Prove"
      colonne={mesi.map((m) => {
        const x = per.get(m) ?? { persone: 0, iscritti: 0 }
        const l = lezioni.get(m) ?? 0
        return {
          chiave: m,
          etichetta: nomeMese(m),
          valore: x.persone,
          dettaglio: [
            nomeMese(m, true),
            `${plurale(x.persone, 'persona nuova', 'persone nuove')} a provare`,
            ...(l ? [`${plurale(l, 'lezione', 'lezioni')} di prova nel mese`] : []),
            ...(x.persone ? [`${x.iscritti} oggi ${x.iscritti === 1 ? 'iscritta' : 'iscritte'} · ${percento(x.iscritti, x.persone)}%`] : []),
          ],
        }
      })}
    />
  )
}

function Incassi({ mesi, incassi }: { mesi: string[]; incassi: Array<{ mese: string; ricevute: number; totale: number; pagato: number }> }) {
  const per = new Map(incassi.map((x) => [x.mese, x]))
  const pagato = incassi.reduce((s, x) => s + x.pagato, 0)
  const ricevute = incassi.reduce((s, x) => s + x.ricevute, 0)
  return (
    <div className="stack" style={{ gap: 12 }}>
      <span style={{ fontSize: 14, color: 'var(--sec)' }}>
        <span className="num" style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{euro(pagato)}</span> in {plurale(ricevute, 'ricevuta', 'ricevute')} nel periodo
      </span>
      <Colonne
        nome="Incassi"
        formato={euro}
        colonne={mesi.map((m) => {
          const x = per.get(m)
          return {
            chiave: m,
            etichetta: nomeMese(m),
            valore: x?.pagato ?? 0,
            dettaglio: [
              nomeMese(m, true),
              x ? `${euro(x.pagato)} pagati in ${plurale(x.ricevute, 'ricevuta', 'ricevute')}` : 'nessuna ricevuta',
            ],
          }
        })}
      />
    </div>
  )
}
