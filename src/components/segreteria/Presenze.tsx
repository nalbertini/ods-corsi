import { useEffect, useMemo, useRef, useState } from 'react'
import type { DatiSegreteria, ProvaSeg, RigaRegistro } from '../../lib/segreteria'
import { chiaveGiorno, giornoPerEsteso, oraDi } from '../../lib/sala'
import type { Destinazione, Voce } from './Segreteria'
import { Guaio, Riga, Testa, useCarica } from './comune'
import { mesi } from '../../lib/ore'

/** «Chi si sta perdendo»: tante assenze di fila, negli appelli fatti. */
const DI_FILA = 3

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
 * Le presenze: chi viene, chi si sta perdendo, quali appelli mancano, e
 * il registro del mese lezione per lezione, con i nomi.
 *
 * Tutto si conta dagli appelli fatti: una lezione passata senza appello non
 * dice che non è venuto nessuno, dice che nessuno ha segnato, e sta nel suo
 * riquadro invece di abbassare le medie.
 */
export function Presenze({ d, onVai, senzaAppello }: { d: DatiSegreteria; onVai: (v: Voce, dove?: Destinazione) => void; senzaAppello?: boolean }) {
  // In cima, gli ultimi 30 giorni: quelli che conta DA FARE, a cavallo di due mesi.
  const periodi = useMemo(() => {
    const adesso = new Date()
    return [{ chiave: '30', da: new Date(adesso.getTime() - 30 * 24 * 60 * 60_000), a: adesso, nome: 'Ultimi 30 giorni' }, ...mesi()]
  }, [])
  const [periodo, setPeriodo] = useState(senzaAppello ? '30' : periodi[1].chiave)

  const [corso, setCorso] = useState('')
  const [sopra, setSopra] = useState<string | null>(null)
  const p = periodi.find((x) => x.chiave === periodo) ?? periodi[0]

  const registro = useCarica(() => d.registro(p.da, p.a), [d, p])
  // Arrivati da DA FARE per gli appelli che mancano: la pagina si apre lì,
  // quando il registro è arrivato e sopra c'è già tutto quello che lo precede.
  const appelli = useRef<HTMLElement>(null)
  const arrivato = registro.dato !== null
  useEffect(() => {
    if (senzaAppello && arrivato) appelli.current?.scrollIntoView({ block: 'start' })
  }, [senzaAppello, arrivato])
  const prove = useCarica(() => d.prove(p.da, p.a), [d, p])
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
      <Testa titolo="PRESENZE" sotto="Chi viene, chi si sta perdendo, quali appelli mancano, chi c'era lezione per lezione.">
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
            {recenti.dato !== null && persi.length === 0 && <span style={{ fontSize: 14, color: 'var(--verde-testo)' }}>Nessuno: chi è iscritto viene.</span>}
            {persi.map((x) => (
              <div key={x.id} className="sg-voce-elenco">
                <span className="stack grow" style={{ minWidth: 0 }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{x.nome}</span>
                  <span style={{ fontSize: 12, color: 'var(--dim)' }}>
                    {x.corsi.join(', ')} · {x.ultima ? `l'ultima volta ${giornoPerEsteso(chiaveGiorno(new Date(x.ultima)))}` : 'mai negli ultimi due mesi'}
                  </span>
                </span>
                <span className="num" style={{ fontSize: 18, fontWeight: 700, color: 'var(--rosso-testo)' }}>{x.fila}</span>
                <button type="button" className="num sg-chip" onClick={() => onVai('iscritti', { persona: x.id })}>
                  SCHEDA
                </button>
              </div>
            ))}
          </section>

          <section ref={appelli} aria-label="Appelli mancanti" className="sg-riquadro">
            <Riga titolo="APPELLI MANCANTI" />
            {registro.dato !== null && mancanti.length === 0 && <span style={{ fontSize: 14, color: 'var(--verde-testo)' }}>Nessuno: tutte le lezioni passate hanno l'appello.</span>}
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

          <Prove prove={prove} corso={corso} onVai={onVai} />
        </div>
      </div>

      <Registro righe={fatte} caricato={registro.dato !== null} onVai={onVai} />
    </>
  )
}

const PER_ORDINE = (a: { cognome: string; nome: string }, b: { cognome: string; nome: string }) =>
  a.cognome.localeCompare(b.cognome, 'it') || a.nome.localeCompare(b.nome, 'it')

/**
 * Il registro del mese: le lezioni con l'appello, giorno per giorno dal più
 * recente, e per ognuna chi c'era. Si apre una lezione per vedere i nomi;
 * assenti e giustificati stanno sotto, più spenti. Per correggere un segno
 * si va alla lezione in settimana, che ha l'appello vero.
 */
function Registro({ righe, caricato, onVai }: { righe: RigaRegistro[]; caricato: boolean; onVai: (v: Voce, dove?: Destinazione) => void }) {
  const giorni = new Map<string, RigaRegistro[]>()
  for (const r of [...righe].sort((a, b) => b.inizio.localeCompare(a.inizio))) {
    const g = chiaveGiorno(new Date(r.inizio))
    giorni.set(g, [...(giorni.get(g) ?? []), r])
  }
  return (
    <section aria-label="Registro del mese" className="sg-riquadro" style={{ marginTop: 20 }}>
      <Riga titolo="REGISTRO DEL MESE">
        <span style={{ fontSize: 12, color: 'var(--dim)' }}>chi c'era, lezione per lezione</span>
      </Riga>
      {caricato && righe.length === 0 && <span className="sg-sotto">Nessun appello fatto in questo periodo.</span>}
      {[...giorni.entries()].map(([g, lezioni]) => (
        <div key={g} className="stack" style={{ gap: 6 }}>
          <span className="sg-etichetta" style={{ letterSpacing: '0.16em' }}>{giornoPerEsteso(g).toUpperCase()}</span>
          {lezioni.map((r) => {
            const presenti = r.appello.filter((p) => p.stato === 'presente').sort(PER_ORDINE)
            const altri = r.appello.filter((p) => p.stato !== 'presente').sort(PER_ORDINE)
            const dovute = r.appello.filter((p) => p.stato !== 'giustificato').length
            return (
              <details key={r.sessioneId} className="sg-registro">
                <summary className="sg-voce-elenco">
                  <span className="stack grow" style={{ minWidth: 0 }}>
                    <span className="ob" style={{ fontSize: 15, fontWeight: 700 }}>{r.corso.toUpperCase()}</span>
                    <span style={{ fontSize: 12, color: 'var(--dim)' }}>
                      {oraDi(r.inizio)}
                      {r.sala ? ` · ${r.sala}` : ''}
                      {r.istruttori ? ` · ${r.istruttori}` : ''}
                    </span>
                  </span>
                  <span className="num" style={{ fontSize: 16, fontWeight: 700, color: 'var(--verde-testo)', whiteSpace: 'nowrap' }}>
                    {presenti.length}/{dovute}
                  </span>
                </summary>
                <div className="sg-registro-nomi">
                  {presenti.length === 0 && <span className="sg-sotto">Nessun presente.</span>}
                  {presenti.map((p) => (
                    <span key={p.personaId} style={{ fontSize: 15 }}>
                      <span style={{ color: 'var(--verde-testo)', fontWeight: 700 }}>✓</span> {p.cognome} {p.nome}
                    </span>
                  ))}
                  {altri.map((p) => (
                    <span key={p.personaId} style={{ fontSize: 14, color: 'var(--dim)' }}>
                      {p.stato === 'assente' ? '✕' : p.stato === 'giustificato' ? 'G' : '·'} {p.cognome} {p.nome}
                      {p.stato === 'giustificato' ? ' · giustificato' : p.stato === null ? ' · non segnato' : ''}
                    </span>
                  ))}
                  <button
                    type="button"
                    className="num sg-chip"
                    style={{ alignSelf: 'flex-start', marginTop: 6 }}
                    onClick={() => onVai('settimana', { lezione: { id: r.sessioneId, inizio: r.inizio } })}
                  >
                    APRI LA LEZIONE
                  </button>
                </div>
              </details>
            )
          })}
        </div>
      ))}
    </section>
  )
}

/**
 * Chi è venuto a provare nel mese: l'hanno aggiunto all'appello gli
 * istruttori (o la segreteria), e da qui lo si richiama. Chi nel frattempo si
 * è iscritto lo dice, e non serve richiamarlo.
 */
function Prove({ prove, corso, onVai }: { prove: { dato: ProvaSeg[] | null; guaio: string | null }; corso: string; onVai: (v: Voce, dove?: Destinazione) => void }) {
  const tutte = prove.dato ?? []
  const qui = corso ? tutte.filter((x) => x.corsoId === corso) : tutte
  const persone = new Set(qui.map((x) => x.personaId)).size
  return (
    <section aria-label="Prove" className="sg-riquadro">
      <Riga titolo="PROVE">
        <span style={{ fontSize: 12, color: 'var(--dim)' }}>
          {prove.dato ? `${persone} ${persone === 1 ? 'persona' : 'persone'} in ${qui.length} ${qui.length === 1 ? 'lezione' : 'lezioni'}` : 'chi è venuto a provare'}
        </span>
      </Riga>
      {prove.guaio && <Guaio testo={prove.guaio} />}
      {prove.dato !== null && qui.length === 0 && <span className="sg-sotto">Nessuno è venuto a provare in questo periodo.</span>}
      {qui.slice(0, 40).map((x) => (
        <div key={`${x.sessioneId}:${x.personaId}`} className="sg-voce-elenco">
          <span className="stack grow" style={{ minWidth: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>
              {x.cognome} {x.nome}
            </span>
            <span style={{ fontSize: 12, color: 'var(--dim)' }}>
              {x.corso} · {giornoPerEsteso(chiaveGiorno(new Date(x.inizio)))} · {oraDi(x.inizio)}
              {x.da ? ` · aggiunta da ${x.da}` : ''}
            </span>
          </span>
          {x.telefono ? (
            <a className="num" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }} href={`tel:${x.telefono.replace(/[^\d+]/g, '')}`}>
              {x.telefono}
            </a>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--faint)' }}>senza telefono</span>
          )}
          {x.iscritto && <span className="num sg-chip" style={{ color: 'var(--verde-testo)', borderColor: 'var(--verde)', display: 'inline-flex', alignItems: 'center' }}>ISCRITTO</span>}
          <button type="button" className="num sg-chip" onClick={() => onVai('iscritti', { persona: x.personaId })}>
            SCHEDA
          </button>
        </div>
      ))}
      {qui.length > 40 && <span className="sg-sotto">…e altre {qui.length - 40}.</span>}
    </section>
  )
}

export function Numero({ titolo, valore, sotto, allarme }: { titolo: string; valore: number | string; sotto: string; allarme?: boolean }) {
  return (
    <div className="sg-numero" data-allarme={!!allarme}>
      <span className="sg-etichetta" style={{ letterSpacing: '0.2em', color: allarme ? 'var(--rosso-testo)' : undefined }}>{titolo}</span>
      <span className="num" style={{ fontSize: 44, fontWeight: 700, lineHeight: 0.95 }}>{valore}</span>
      <span style={{ fontSize: 13, color: 'var(--dim)' }}>{sotto}</span>
    </div>
  )
}
