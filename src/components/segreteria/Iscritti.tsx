import { useState } from 'react'
import type { CorsoSeg, DatiPersona, DatiSegreteria, Frequenza, PersonaSeg } from '../../lib/segreteria'
import { inCorso } from '../../lib/segreteria'
import { chiaveGiorno, giornoPerEsteso, oraDi } from '../../lib/sala'
import { Campo, dataLunga, Guaio, Riga, Testa, useAvviso, useCarica } from './comune'

/** «Viene poco»: meno di metà delle lezioni, su almeno tre che ha avuto. */
const vienePoco = (f?: Frequenza) => !!f && f.dovute >= 3 && f.presenti / f.dovute < 0.5

/**
 * Gli iscritti: chi c'è, a cosa è iscritto, come si raggiunge, se viene.
 *
 * Un nome in elenco non ha bisogno di un accesso: gli iscritti non entrano
 * nell'app. Qui la segreteria li aggiunge, li iscrive e li toglie dai corsi.
 */
export function Iscritti({ d, personaIniziale }: { d: DatiSegreteria; personaIniziale?: string }) {
  const persone = useCarica(() => d.persone(), [d])
  const corsi = useCarica(() => d.corsi(), [d])
  const freq = useCarica(() => d.frequenze(), [d])
  const [cerca, setCerca] = useState('')
  const [corso, setCorso] = useState('')
  const [senzaEmail, setSenzaEmail] = useState(false)
  const [poco, setPoco] = useState(false)
  const [scelta, setScelta] = useState<string | null>(personaIniziale ?? null)
  const [nuovo, setNuovo] = useState(false)
  const { avviso, fai } = useAvviso()
  const oggi = chiaveGiorno(new Date())

  const perId = new Map((corsi.dato ?? []).map((c) => [c.id, c]))
  const attivi = (corsi.dato ?? []).filter((c) => c.attivo).sort((a, b) => a.nome.localeCompare(b.nome, 'it'))
  const tutti = [...(persone.dato ?? [])].sort(
    (a, b) => Number(b.attiva) - Number(a.attiva) || a.cognome.localeCompare(b.cognome, 'it') || a.nome.localeCompare(b.nome, 'it'),
  )
  const ago = cerca.trim().toLowerCase()
  const trovati = tutti.filter(
    (p) =>
      (!ago || `${p.cognome} ${p.nome} ${p.nome} ${p.cognome} ${p.email ?? ''}`.toLowerCase().includes(ago)) &&
      (!corso || p.iscrizioni.some((i) => i.corsoId === corso && inCorso(i, oggi))) &&
      (!senzaEmail || !p.email) &&
      (!poco || vienePoco(freq.dato?.get(p.id))),
  )
  const persona = nuovo ? null : (tutti.find((p) => p.id === scelta) ?? null)
  const ricarica = () => Promise.all([persone.ricarica(), freq.ricarica()])

  return (
    <>
      <Testa titolo="ISCRITTI" sotto={`${tutti.filter((p) => p.attiva).length} persone attive. Un nome in elenco non ha bisogno di un accesso.`}>
        <button type="button" className="sg-btn sg-btn-rosso" onClick={() => setNuovo(true)}>
          + NUOVO ISCRITTO
        </button>
      </Testa>

      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <label htmlFor="cerca" className="vh">
          Cerca un iscritto
        </label>
        <input id="cerca" className="sg-campo" type="search" placeholder="Cerca per nome o email" style={{ width: 360, maxWidth: '100%' }} value={cerca} onChange={(e) => setCerca(e.target.value)} />
        <label htmlFor="filtro" className="vh">
          Corso
        </label>
        <select id="filtro" className="sg-campo" value={corso} onChange={(e) => setCorso(e.target.value)}>
          <option value="">Tutti i corsi</option>
          {attivi.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
        <button type="button" className="num sg-chip" aria-pressed={senzaEmail} onClick={() => setSenzaEmail(!senzaEmail)}>
          SOLO SENZA EMAIL
        </button>
        <button type="button" className="num sg-chip" aria-pressed={poco} onClick={() => setPoco(!poco)}>
          VENGONO POCO
        </button>
      </div>

      {persone.guaio && <Guaio testo={persone.guaio} />}

      <div className="sg-due-colonne sg-iscritti">
        <div role="table" aria-label="Iscritti" className="sg-tabella">
          <div role="row" className="sg-lista-testa sg-riga-iscritto">
            <span role="columnheader" className="sg-etichetta">NOME</span>
            <span role="columnheader" className="sg-etichetta">CORSI</span>
            <span role="columnheader" className="sg-etichetta">CONTATTO</span>
            <span role="columnheader" className="sg-etichetta" style={{ textAlign: 'right' }}>30 GIORNI</span>
          </div>
          <div className="sg-tabella-corpo">
            {persone.dato === null && !persone.guaio && <p className="sg-sotto" style={{ padding: '12px 14px' }}>Sto leggendo gli iscritti…</p>}
            {persone.dato !== null && trovati.length === 0 && <p className="sg-sotto" style={{ padding: '12px 14px' }}>Nessuno corrisponde alla ricerca.</p>}
            {trovati.map((p) => {
              const f = freq.dato?.get(p.id)
              const suoi = p.iscrizioni.filter((i) => inCorso(i, oggi)).map((i) => perId.get(i.corsoId)?.nome).filter(Boolean)
              return (
                <button
                  key={p.id}
                  type="button"
                  role="row"
                  className="sg-riga-iscritto sg-iscritto"
                  aria-pressed={!nuovo && scelta === p.id}
                  data-spento={!p.attiva}
                  onClick={() => {
                    setNuovo(false)
                    setScelta(p.id)
                  }}
                >
                  <span role="cell" style={{ fontSize: 15, fontWeight: 600 }}>
                    {p.cognome} {p.nome}
                  </span>
                  <span role="cell" style={{ fontSize: 13, color: 'var(--sec)' }}>{suoi.join(', ') || '—'}</span>
                  <span role="cell" style={{ fontSize: 13, color: p.email || p.telefono ? 'var(--sec)' : 'var(--rosso)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.email ?? p.telefono ?? 'nessun contatto'}
                  </span>
                  <span role="cell" className="num" style={{ fontSize: 16, fontWeight: 700, textAlign: 'right', color: vienePoco(f) ? 'var(--giallo)' : 'var(--text)' }}>
                    {f ? `${f.presenti}/${f.dovute}` : '—'}
                  </span>
                </button>
              )
            })}
          </div>
          <span className="sg-sotto" style={{ fontSize: 12, padding: '10px 14px 0' }}>
            {trovati.length === tutti.length ? `${tutti.length} in elenco` : `${trovati.length} di ${tutti.length}`}
            {' · '}
            30 GIORNI: presenze su lezioni avute, senza i giustificati
          </span>
        </div>

        <section aria-label="Scheda" className="sg-scheda sg-scheda-stretta">
          {nuovo ? (
            <Nuovo
              d={d}
              corsi={attivi}
              fai={fai}
              onLasciaStare={() => setNuovo(false)}
              onSalvato={(id) => {
                setNuovo(false)
                setScelta(id)
                void ricarica()
              }}
            />
          ) : persona ? (
            <Scheda key={persona.id} d={d} p={persona} corsi={perId} attivi={attivi} f={freq.dato?.get(persona.id)} fai={fai} onCambiato={() => void ricarica()} />
          ) : (
            <span className="sg-sotto">Tocca un nome per vedere la sua scheda.</span>
          )}
        </section>
      </div>
      {avviso}
    </>
  )
}

type Fai = ReturnType<typeof useAvviso>['fai']

function Nuovo({
  d,
  corsi,
  fai,
  onLasciaStare,
  onSalvato,
}: {
  d: DatiSegreteria
  corsi: CorsoSeg[]
  fai: Fai
  onLasciaStare: () => void
  onSalvato: (id: string) => void
}) {
  const [b, setB] = useState<DatiPersona & { corso: string }>({ nome: '', cognome: '', email: '', telefono: '', corso: '' })
  const salva = () => {
    let id = ''
    void fai(
      async () => {
        id = await d.salvaPersona(b)
        if (b.corso) await d.iscrivi(id, b.corso)
      },
      b.corso ? 'Scheda creata e iscrizione fatta' : 'Scheda creata',
      () => onSalvato(id),
    )
  }
  return (
    <>
      <span className="ob" style={{ fontSize: 24, fontWeight: 700, letterSpacing: '0.04em' }}>NUOVO ISCRITTO</span>
      <Campo id="n-nome" etichetta="NOME">
        <input id="n-nome" className="sg-campo" value={b.nome} onChange={(e) => setB({ ...b, nome: e.target.value })} />
      </Campo>
      <Campo id="n-cognome" etichetta="COGNOME">
        <input id="n-cognome" className="sg-campo" value={b.cognome} onChange={(e) => setB({ ...b, cognome: e.target.value })} />
      </Campo>
      <Campo id="n-email" etichetta="EMAIL · FACOLTATIVA">
        <input id="n-email" className="sg-campo" type="email" placeholder="nome@esempio.it" value={b.email} onChange={(e) => setB({ ...b, email: e.target.value })} />
      </Campo>
      <Campo id="n-tel" etichetta="TELEFONO · FACOLTATIVO">
        <input id="n-tel" className="sg-campo" type="tel" value={b.telefono} onChange={(e) => setB({ ...b, telefono: e.target.value })} />
      </Campo>
      <Campo id="n-corso" etichetta="ISCRIVI A">
        <select id="n-corso" className="sg-campo" value={b.corso} onChange={(e) => setB({ ...b, corso: e.target.value })}>
          <option value="">Nessun corso per ora</option>
          {corsi.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </Campo>
      <span style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--dim)' }}>L'email è l'unica cosa che distingue due omonimi.</span>
      <div className="grow" />
      <div className="row" style={{ gap: 8 }}>
        <button type="button" className="sg-btn sg-btn-linea grow" onClick={onLasciaStare}>
          LASCIA STARE
        </button>
        <button type="button" className="sg-btn sg-btn-rosso grow" disabled={!b.nome.trim() || !b.cognome.trim()} onClick={salva}>
          SALVA
        </button>
      </div>
    </>
  )
}

function Scheda({
  d,
  p,
  corsi,
  attivi,
  f,
  fai,
  onCambiato,
}: {
  d: DatiSegreteria
  p: PersonaSeg
  corsi: Map<string, CorsoSeg>
  attivi: CorsoSeg[]
  f?: Frequenza
  fai: Fai
  onCambiato: () => void
}) {
  const oggi = chiaveGiorno(new Date())
  const [modifica, setModifica] = useState<DatiPersona | null>(null)
  const [daAggiungere, setDaAggiungere] = useState('')
  const storico = useCarica(() => d.storico(p.id, 12), [d, p.id, p.iscrizioni.length])
  const correnti = p.iscrizioni.filter((i) => inCorso(i, oggi))
  const liberi = attivi.filter((c) => !correnti.some((i) => i.corsoId === c.id))
  const venuto = storico.dato?.filter((x) => x.stato === 'presente').length ?? 0

  return (
    <>
      <div className="stack" style={{ gap: 4 }}>
        <span className="ob" style={{ fontSize: 26, fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1 }}>
          {`${p.cognome} ${p.nome}`.toUpperCase()}
        </span>
        <span style={{ fontSize: 13, color: p.attiva ? 'var(--dim)' : 'var(--rosso)' }}>
          {p.attiva ? `In elenco dal ${dataLunga(p.creataIl)} · nessun accesso` : 'Scheda disattivata: non compare negli appelli'}
        </span>
      </div>

      {modifica ? (
        <div className="sg-due">
          <Campo id="m-nome" etichetta="NOME">
            <input id="m-nome" className="sg-campo" value={modifica.nome} onChange={(e) => setModifica({ ...modifica, nome: e.target.value })} />
          </Campo>
          <Campo id="m-cognome" etichetta="COGNOME">
            <input id="m-cognome" className="sg-campo" value={modifica.cognome} onChange={(e) => setModifica({ ...modifica, cognome: e.target.value })} />
          </Campo>
          <Campo id="m-email" etichetta="EMAIL">
            <input id="m-email" className="sg-campo" type="email" value={modifica.email ?? ''} onChange={(e) => setModifica({ ...modifica, email: e.target.value })} />
          </Campo>
          <Campo id="m-tel" etichetta="TELEFONO">
            <input id="m-tel" className="sg-campo" type="tel" value={modifica.telefono ?? ''} onChange={(e) => setModifica({ ...modifica, telefono: e.target.value })} />
          </Campo>
        </div>
      ) : (
        <div className="sg-due">
          <Campo etichetta="EMAIL">
            <span style={{ fontSize: 14, wordBreak: 'break-all', color: p.email ? 'var(--text)' : 'var(--dim)' }}>{p.email ?? '—'}</span>
          </Campo>
          <Campo etichetta="TELEFONO">
            <span style={{ fontSize: 14, color: p.telefono ? 'var(--text)' : 'var(--dim)' }}>{p.telefono ?? '—'}</span>
          </Campo>
        </div>
      )}

      <div className="stack" style={{ gap: 8 }}>
        <span className="sg-etichetta" style={{ fontSize: 13, letterSpacing: '0.2em' }}>ISCRIZIONI</span>
        {correnti.length === 0 && <span className="sg-sotto">Nessuna iscrizione in corso.</span>}
        {correnti.map((i) => {
          const c = corsi.get(i.corsoId)
          return (
            <div key={i.corsoId} className="sg-iscrizione">
              <span style={{ width: 10, height: 10, flexShrink: 0, background: c?.colore ?? 'var(--line)' }} />
              <span className="stack grow" style={{ minWidth: 0 }}>
                <span className="ob" style={{ fontSize: 15, fontWeight: 700 }}>{(c?.nome ?? 'Corso').toUpperCase()}</span>
                <span style={{ fontSize: 12, color: 'var(--dim)' }}>
                  dal {dataLunga(i.dal)}
                  {i.al ? ` · fino al ${dataLunga(i.al)}` : ''}
                </span>
              </span>
              {!i.al && (
                <button
                  type="button"
                  className="num sg-chip"
                  onClick={() => {
                    if (window.confirm(`${p.nome} smette di venire a ${c?.nome}? Da domani non è più nell'appello; il registro resta.`)) {
                      void fai(() => d.termina(p.id, i.corsoId), 'Iscrizione terminata', onCambiato)
                    }
                  }}
                >
                  TERMINA
                </button>
              )}
            </div>
          )
        })}
        <div className="row" style={{ gap: 8 }}>
          <label htmlFor="p-agg" className="vh">
            Corso da aggiungere
          </label>
          <select id="p-agg" className="sg-campo grow" style={{ borderStyle: 'dashed', minWidth: 0 }} value={daAggiungere} onChange={(e) => setDaAggiungere(e.target.value)}>
            <option value="">Iscrivi a un corso…</option>
            {liberi.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="num sg-chip sg-chip-pieno"
            disabled={!daAggiungere || !p.attiva}
            onClick={() =>
              void fai(() => d.iscrivi(p.id, daAggiungere), 'Iscrizione fatta', () => {
                setDaAggiungere('')
                onCambiato()
              })
            }
          >
            ISCRIVI
          </button>
        </div>
      </div>

      <div className="stack" style={{ gap: 8 }}>
        <Riga titolo="ULTIME 12 LEZIONI">
          <span className="num" style={{ fontSize: 15, fontWeight: 700 }}>
            {storico.dato ? `${venuto} / ${storico.dato.length}` : ''}
          </span>
        </Riga>
        {storico.dato?.length === 0 && <span className="sg-sotto">Ancora nessuna lezione.</span>}
        <div className="sg-storico">
          {storico.dato?.map((x) => (
            <div
              key={x.sessioneId}
              className="sg-quadretto"
              data-stato={x.stato ?? 'niente'}
              title={`${x.corso} · ${giornoPerEsteso(chiaveGiorno(new Date(x.inizio)))} ${oraDi(x.inizio)} · ${x.stato ?? 'non segnato'}`}
            />
          ))}
        </div>
        {f && (
          <span style={{ fontSize: 12, color: 'var(--dim)' }}>
            Negli ultimi 30 giorni: {f.presenti} su {f.dovute}.
          </span>
        )}
      </div>

      <div className="grow" />
      <div className="row" style={{ gap: 8 }}>
        {modifica ? (
          <>
            <button type="button" className="sg-btn sg-btn-linea grow" onClick={() => setModifica(null)}>
              LASCIA STARE
            </button>
            <button
              type="button"
              className="sg-btn sg-btn-rosso grow"
              disabled={!modifica.nome.trim() || !modifica.cognome.trim()}
              onClick={() =>
                void fai(() => d.salvaPersona(modifica), 'Scheda salvata', () => {
                  setModifica(null)
                  onCambiato()
                })
              }
            >
              SALVA
            </button>
          </>
        ) : (
          <>
            <button type="button" className="sg-btn sg-btn-linea grow" onClick={() => setModifica({ id: p.id, nome: p.nome, cognome: p.cognome, email: p.email, telefono: p.telefono })}>
              MODIFICA
            </button>
            <button
              type="button"
              className="sg-btn sg-btn-linea grow"
              onClick={() => {
                if (p.attiva && !window.confirm(`Disattivare ${p.nome} ${p.cognome}? Sparisce dagli appelli e dal tablet; si può riattivare.`)) return
                void fai(() => d.attivaPersona(p.id, !p.attiva), p.attiva ? 'Scheda disattivata' : 'Scheda riattivata', onCambiato)
              }}
            >
              {p.attiva ? 'DISATTIVA' : 'RIATTIVA'}
            </button>
          </>
        )}
      </div>
    </>
  )
}
