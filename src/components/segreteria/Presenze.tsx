import { useMemo, useState } from 'react'
import type { DatiSegreteria, RigaRegistro } from '../../lib/segreteria'
import { chiaveGiorno, giornoPerEsteso, oraDi } from '../../lib/sala'
import type { Destinazione, Voce } from './Segreteria'
import { Guaio, Riga, Testa, useCarica } from './comune'

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']
/** «Chi si sta perdendo»: tante assenze di fila, negli appelli fatti. */
const DI_FILA = 3

/** I dodici mesi fino a questo, dal più recente. */
function mesi() {
  const oggi = new Date()
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(oggi.getFullYear(), oggi.getMonth() - i, 1)
    return { chiave: `${d.getFullYear()}-${d.getMonth()}`, da: d, a: new Date(d.getFullYear(), d.getMonth() + 1, 0), nome: `${MESI[d.getMonth()]} ${d.getFullYear()}` }
  })
}

const conAppello = (r: RigaRegistro) => r.appello.some((p) => p.stato !== null)
/** Presenti su lezioni dovute: i giustificati non contano né sopra né sotto. */
function conto(righe: RigaRegistro[]) {
  let presenti = 0
  let dovute = 0
  for (const r of righe) {
    if (r.stato === 'annullata' || !conAppello(r)) continue
    for (const p of r.appello) {
      if (p.stato === 'giustificato') continue
      dovute++
      if (p.stato === 'presente') presenti++
    }
  }
  return { presenti, dovute }
}
const percento = (x: { presenti: number; dovute: number }) => (x.dovute ? Math.round((100 * x.presenti) / x.dovute) : null)

/** Il registro del mese in un foglio da aprire con Excel: punto e virgola e BOM, come i fogli che si importano. */
function scaricaCsv(righe: RigaRegistro[], nome: string) {
  const q = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const testo = [
    ['data', 'ora', 'corso', 'sala', 'istruttore', 'cognome', 'nome', 'stato'].join(';'),
    ...righe.flatMap((r) =>
      r.appello.map((p) =>
        [chiaveGiorno(new Date(r.inizio)), oraDi(r.inizio), r.corso, r.sala ?? '', r.istruttori, p.cognome, p.nome, r.stato === 'annullata' ? 'lezione annullata' : (p.stato ?? '')]
          .map(q)
          .join(';'),
      ),
    ),
  ].join('\r\n')
  const url = URL.createObjectURL(new Blob(['﻿' + testo], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `presenze-${nome.toLowerCase().replace(/\s+/g, '-')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Le presenze: chi viene, chi si sta perdendo, quali appelli mancano.
 *
 * Tutto si conta dagli appelli fatti: una lezione passata senza appello non
 * dice che non è venuto nessuno, dice che nessuno ha segnato, e sta nel suo
 * riquadro invece di abbassare le medie.
 */
export function Presenze({ d, onVai }: { d: DatiSegreteria; onVai: (v: Voce, dove?: Destinazione) => void }) {
  const periodi = useMemo(mesi, [])
  const [periodo, setPeriodo] = useState(periodi[0].chiave)
  const [corso, setCorso] = useState('')
  const [sopra, setSopra] = useState<string | null>(null)
  const p = periodi.find((x) => x.chiave === periodo) ?? periodi[0]

  const registro = useCarica(() => d.registro(p.da, p.a), [d, p])
  // Chi si sta perdendo guarda più indietro del mese: le assenze di fila non si fermano al primo.
  const recenti = useCarica(() => d.registro(new Date(Date.now() - 60 * 24 * 60 * 60_000), new Date()), [d])

  const tutte = registro.dato ?? []
  const righe = tutte.filter((r) => !corso || r.corsoId === corso)
  const svolte = righe.filter((r) => r.stato !== 'annullata')
  const annullate = righe.length - svolte.length
  const fatte = svolte.filter(conAppello)
  const mancanti = svolte.filter((r) => !conAppello(r)).sort((a, b) => b.inizio.localeCompare(a.inizio))
  const totale = conto(righe)
  const corsi = [...new Map(tutte.map((r) => [r.corsoId, r.corso])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'it'))

  const barre = corsi
    .map(([id, nome]) => {
      const qui = tutte.filter((r) => r.corsoId === id)
      const c = conto(qui)
      return { id, nome, ...c, lezioni: qui.filter((r) => r.stato !== 'annullata' && conAppello(r)).length, pc: percento(c) }
    })
    .filter((b) => b.pc !== null)
    .sort((a, b) => b.pc! - a.pc! || a.nome.localeCompare(b.nome, 'it'))

  const persi = useMemo(() => {
    const perPersona = new Map<string, { nome: string; segni: Array<{ stato: string | null; corso: string; inizio: string }> }>()
    for (const r of [...(recenti.dato ?? [])].sort((a, b) => a.inizio.localeCompare(b.inizio))) {
      if (r.stato === 'annullata' || !conAppello(r)) continue
      if (corso && r.corsoId !== corso) continue
      for (const x of r.appello) {
        if (x.stato === 'giustificato') continue
        const v = perPersona.get(x.personaId) ?? { nome: `${x.cognome} ${x.nome}`, segni: [] }
        v.segni.push({ stato: x.stato, corso: r.corso, inizio: r.inizio })
        perPersona.set(x.personaId, v)
      }
    }
    return [...perPersona.entries()]
      .map(([id, v]) => {
        let fila = 0
        for (let i = v.segni.length - 1; i >= 0 && v.segni[i].stato !== 'presente'; i--) fila++
        const ultima = [...v.segni].reverse().find((s) => s.stato === 'presente')
        return { id, nome: v.nome, fila, corsi: [...new Set(v.segni.slice(-fila).map((s) => s.corso))], ultima: ultima?.inizio }
      })
      .filter((x) => x.fila >= DI_FILA)
      .sort((a, b) => b.fila - a.fila || a.nome.localeCompare(b.nome, 'it'))
  }, [recenti.dato, corso])

  return (
    <>
      <Testa titolo="PRESENZE" sotto="Chi viene, chi si sta perdendo, quali appelli mancano.">
        <label htmlFor="periodo" className="vh">
          Periodo
        </label>
        <select id="periodo" className="sg-campo" value={periodo} onChange={(e) => {
            // Un corso scelto che nel mese nuovo non c'è sparirebbe dal menu
            // pur continuando a filtrare: si riparte da tutti.
            setPeriodo(e.target.value)
            setCorso('')
          }}>
          {periodi.map((x) => (
            <option key={x.chiave} value={x.chiave}>
              {x.nome}
            </option>
          ))}
        </select>
        <label htmlFor="corso-p" className="vh">
          Corso
        </label>
        <select id="corso-p" className="sg-campo" value={corso} onChange={(e) => setCorso(e.target.value)}>
          <option value="">Tutti i corsi</option>
          {corsi.map(([id, nome]) => (
            <option key={id} value={id}>
              {nome}
            </option>
          ))}
        </select>
        <button type="button" className="sg-btn sg-btn-linea" disabled={!righe.length} onClick={() => scaricaCsv(righe, p.nome)}>
          SCARICA CSV
        </button>
      </Testa>

      {registro.guaio && <Guaio testo={registro.guaio} />}

      <div className="sg-numeri">
        <Numero titolo="LEZIONI SVOLTE" valore={svolte.length} sotto={annullate ? `${annullate} ${annullate === 1 ? 'annullata' : 'annullate'}` : 'nessuna annullata'} />
        <Numero
          titolo="PRESENZE"
          valore={totale.presenti}
          sotto={fatte.length ? `${(totale.presenti / fatte.length).toLocaleString('it-IT', { maximumFractionDigits: 1 })} a lezione, dove c'è l'appello` : 'nessun appello'}
        />
        <Numero titolo="SUGLI ISCRITTI" valore={percento(totale) === null ? '—' : `${percento(totale)}%`} sotto="i giustificati non contano" />
        <Numero titolo="SENZA APPELLO" valore={mancanti.length} sotto="lezioni passate, nessuno ha segnato" allarme={mancanti.length > 0} />
      </div>

      <div className="sg-presenze">
        <section aria-label="Presenza media per corso" className="sg-riquadro">
          <Riga titolo="PRESENZA MEDIA PER CORSO">
            <span style={{ fontSize: 12, color: 'var(--dim)' }}>presenti su iscritti, dove c'è l'appello</span>
          </Riga>
          {registro.dato === null && !registro.guaio && <span className="sg-sotto">Sto leggendo il registro…</span>}
          {registro.dato !== null && barre.length === 0 && <span className="sg-sotto">Nessun appello fatto in questo periodo.</span>}
          <div className="stack" style={{ gap: 10 }}>
            {barre.map((b) => (
              <button
                key={b.id}
                type="button"
                className="sg-barra"
                aria-pressed={corso === b.id}
                data-spenta={!!corso && corso !== b.id}
                aria-label={`${b.nome}: ${b.pc}%, ${b.presenti} presenze su ${b.dovute} in ${b.lezioni} lezioni`}
                onClick={() => setCorso(corso === b.id ? '' : b.id)}
                onMouseEnter={() => setSopra(b.id)}
                onMouseLeave={() => setSopra(null)}
                onFocus={() => setSopra(b.id)}
                onBlur={() => setSopra(null)}
              >
                <span className="ob sg-barra-nome">{b.nome.toUpperCase()}</span>
                <span className="sg-barra-binario">
                  <span className="sg-barra-pieno" style={{ width: `${b.pc}%` }} />
                  {sopra === b.id && (
                    <span className="sg-barra-suggerimento" role="tooltip">
                      {b.presenti} presenze su {b.dovute} · {b.lezioni} {b.lezioni === 1 ? 'lezione' : 'lezioni'}
                    </span>
                  )}
                </span>
                <span className="num" style={{ fontSize: 16, fontWeight: 700, textAlign: 'right' }}>{b.pc}%</span>
              </button>
            ))}
          </div>
          {barre.length > 0 && (
            <div className="sg-barra-scala num">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          )}
        </section>

        <div className="stack" style={{ gap: 20, minWidth: 0 }}>
          <section aria-label="Chi si sta perdendo" className="sg-riquadro">
            <Riga titolo="CHI SI STA PERDENDO">
              <span style={{ fontSize: 12, color: 'var(--dim)' }}>{DI_FILA} assenze di fila o più</span>
            </Riga>
            {recenti.dato !== null && persi.length === 0 && <span style={{ fontSize: 14, color: 'var(--verde)' }}>Nessuno: chi è iscritto viene.</span>}
            {persi.map((x) => (
              <div key={x.id} className="sg-voce-elenco">
                <span className="stack grow" style={{ minWidth: 0 }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{x.nome}</span>
                  <span style={{ fontSize: 12, color: 'var(--dim)' }}>
                    {x.corsi.join(', ')} · {x.ultima ? `l'ultima volta ${giornoPerEsteso(chiaveGiorno(new Date(x.ultima)))}` : 'mai negli ultimi due mesi'}
                  </span>
                </span>
                <span className="num" style={{ fontSize: 18, fontWeight: 700, color: 'var(--rosso)' }}>{x.fila}</span>
                <button type="button" className="num sg-chip" onClick={() => onVai('iscritti', { persona: x.id })}>
                  SCHEDA
                </button>
              </div>
            ))}
          </section>

          <section aria-label="Appelli mancanti" className="sg-riquadro">
            <Riga titolo="APPELLI MANCANTI" />
            {registro.dato !== null && mancanti.length === 0 && <span style={{ fontSize: 14, color: 'var(--verde)' }}>Nessuno: tutte le lezioni passate hanno l'appello.</span>}
            {mancanti.slice(0, 30).map((r) => (
              <div key={r.sessioneId} className="sg-voce-elenco" style={{ borderColor: 'var(--rosso)' }}>
                <span className="stack grow" style={{ minWidth: 0 }}>
                  <span className="ob" style={{ fontSize: 15, fontWeight: 700 }}>{r.corso.toUpperCase()}</span>
                  <span style={{ fontSize: 12, color: 'var(--dim)' }}>
                    {giornoPerEsteso(chiaveGiorno(new Date(r.inizio)))} · {oraDi(r.inizio)}
                    {r.istruttori ? ` · ${r.istruttori}` : ''}
                  </span>
                </span>
                <button type="button" className="num sg-chip" onClick={() => onVai('settimana', { lezione: { id: r.sessioneId, inizio: r.inizio } })}>
                  FALLO ORA
                </button>
              </div>
            ))}
            {mancanti.length > 30 && <span className="sg-sotto">…e altre {mancanti.length - 30}.</span>}
          </section>
        </div>
      </div>
    </>
  )
}

function Numero({ titolo, valore, sotto, allarme }: { titolo: string; valore: number | string; sotto: string; allarme?: boolean }) {
  return (
    <div className="sg-numero" data-allarme={!!allarme}>
      <span className="sg-etichetta" style={{ letterSpacing: '0.2em', color: allarme ? 'var(--rosso)' : undefined }}>{titolo}</span>
      <span className="num" style={{ fontSize: 44, fontWeight: 700, lineHeight: 0.95 }}>{valore}</span>
      <span style={{ fontSize: 13, color: 'var(--dim)' }}>{sotto}</span>
    </div>
  )
}
