import { useRef, useState } from 'react'
import type { Anagrafica, ComeCertificato, ComePaga, CorsoSeg, DatiPersona, DatiSegreteria, Frequenza, PagamentoSeg, PersonaSeg } from '../../lib/segreteria'
import { comeCertificato, comePaga, cosaNonVaAnagrafica, inCorso, PAGAMENTI, pulisciAnagrafica } from '../../lib/segreteria'
import { cfTornaColNome, cfTornaConLaData, cfValido } from '../../lib/codiceFiscale'
import { ESTENSIONI, MASSIMO_FILE } from '../../lib/richieste'
import { chiaveGiorno, giornoPerEsteso, oraDi } from '../../lib/sala'
import { Campo, dataLunga, Guaio, messaggio, Riga, SchedaPiena, Testa, useAvviso, useCarica } from './comune'
import { NuovaRicevuta, RicevuteIscritto } from './Ricevute'

/** «Viene poco»: meno di metà delle lezioni, su almeno tre che ha avuto. */
const vienePoco = (f?: Frequenza) => !!f && f.dovute >= 3 && f.presenti / f.dovute < 0.5

/** Il certificato da sistemare: manca, è scaduto o scade entro un mese. */
const certificatoDaSistemare = (p: PersonaSeg, oggi: string) => comeCertificato(p.certificato, oggi) !== 'valido'
const daPagare = (p: PersonaSeg, oggi: string) => comePaga(p.pagamento, oggi) !== 'pagato'

const TONO_CERTIFICATO: Record<ComeCertificato, 'rosso' | 'giallo' | 'verde'> = { manca: 'rosso', scaduto: 'rosso', in_scadenza: 'giallo', valido: 'verde' }
const TONO_PAGA: Record<ComePaga, 'rosso' | 'giallo' | 'verde'> = { da_pagare: 'rosso', scaduto: 'rosso', in_parte: 'giallo', pagato: 'verde' }
const PAROLA_PAGA: Record<ComePaga, string> = { da_pagare: 'DA PAGARE', in_parte: 'PAGATO IN PARTE', pagato: 'PAGATO', scaduto: 'PAGAMENTO SCADUTO' }

function Bollino({ tono, children }: { tono: 'rosso' | 'giallo' | 'verde'; children: string }) {
  return (
    <span className="num sg-segno-regola" data-tono={tono}>
      {children}
    </span>
  )
}

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
  const [certificato, setCertificato] = useState(false)
  const [pagare, setPagare] = useState(false)
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
      (!poco || vienePoco(freq.dato?.get(p.id))) &&
      (!certificato || certificatoDaSistemare(p, oggi)) &&
      (!pagare || daPagare(p, oggi)),
  )
  const attiveOra = tutti.filter((p) => p.attiva)
  const senzaCertificato = attiveOra.filter((p) => ['manca', 'scaduto'].includes(comeCertificato(p.certificato, oggi))).length
  const nonPagato = attiveOra.filter((p) => daPagare(p, oggi)).length
  const persona = nuovo ? null : (tutti.find((p) => p.id === scelta) ?? null)
  const ricarica = () => Promise.all([persone.ricarica(), freq.ricarica()])

  const chiudi = () => {
    setNuovo(false)
    setScelta(null)
  }

  return (
    <>
      {nuovo ? (
        <SchedaPiena etichetta="Nuovo iscritto" torna="ISCRITTI" onTorna={chiudi}>
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
        </SchedaPiena>
      ) : persona ? (
        <SchedaPiena key={persona.id} etichetta={`Scheda di ${persona.nome} ${persona.cognome}`} torna="ISCRITTI" onTorna={chiudi}>
          <Scheda d={d} p={persona} corsi={perId} attivi={attivi} f={freq.dato?.get(persona.id)} fai={fai} onCambiato={() => void ricarica()} />
        </SchedaPiena>
      ) : null}

      {/* L'elenco resta montato sotto la scheda, con la ricerca e i filtri di prima. */}
      <div className="stack" style={{ gap: 18 }} hidden={!!(nuovo || persona)}>
        <Testa
          titolo="ISCRITTI"
          sotto={`${attiveOra.length} persone attive · ${senzaCertificato ? `${senzaCertificato} senza certificato valido` : 'tutti col certificato'} · ${nonPagato ? `${nonPagato} da pagare` : 'tutti in regola coi pagamenti'}.`}
        >
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
          <button type="button" className="num sg-chip" aria-pressed={certificato} onClick={() => setCertificato(!certificato)}>
            CERTIFICATO DA SISTEMARE
          </button>
          <button type="button" className="num sg-chip" aria-pressed={pagare} onClick={() => setPagare(!pagare)}>
            DA PAGARE
          </button>
        </div>

        {persone.guaio && <Guaio testo={persone.guaio} />}

        <div role="table" aria-label="Iscritti" className="sg-tabella">
          <div role="row" className="sg-lista-testa sg-riga-iscritto">
            <span role="columnheader" className="sg-etichetta">NOME</span>
            <span role="columnheader" className="sg-etichetta">CORSI</span>
            <span role="columnheader" className="sg-etichetta">CONTATTO</span>
            <span role="columnheader" className="sg-etichetta">IN REGOLA</span>
            <span role="columnheader" className="sg-etichetta" style={{ textAlign: 'right' }}>30 GIORNI</span>
          </div>
          <div className="sg-tabella-corpo">
            {persone.dato === null && !persone.guaio && <p className="sg-sotto" style={{ padding: '12px 14px' }}>Sto leggendo gli iscritti…</p>}
            {persone.dato !== null && trovati.length === 0 && <p className="sg-sotto" style={{ padding: '12px 14px' }}>Nessuno corrisponde alla ricerca.</p>}
            {trovati.map((p) => {
              const f = freq.dato?.get(p.id)
              const suoi = p.iscrizioni.filter((i) => inCorso(i, oggi)).map((i) => perId.get(i.corsoId)?.nome).filter(Boolean)
              const cert = comeCertificato(p.certificato, oggi)
              const paga = comePaga(p.pagamento, oggi)
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
                  <span role="cell" className="sg-in-regola">
                    {cert === 'valido' && paga === 'pagato' ? (
                      <Bollino tono="verde">IN REGOLA</Bollino>
                    ) : (
                      <>
                        {cert !== 'valido' && (
                          <Bollino tono={TONO_CERTIFICATO[cert]}>
                            {cert === 'manca' ? 'NO CERTIFICATO' : cert === 'scaduto' ? 'CERT. SCADUTO' : `CERT. ${dataCorta(p.certificato.scade!)}`}
                          </Bollino>
                        )}
                        {paga !== 'pagato' && <Bollino tono={TONO_PAGA[paga]}>{paga === 'in_parte' ? 'IN PARTE' : paga === 'scaduto' ? 'QUOTA SCADUTA' : 'DA PAGARE'}</Bollino>}
                      </>
                    )}
                  </span>
                  <span role="cell" className="num" style={{ fontSize: 16, fontWeight: 700, textAlign: 'right', color: vienePoco(f) ? 'var(--giallo-testo)' : 'var(--text)' }}>
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
        if (!b.corso) return
        try {
          await d.iscrivi(id, b.corso)
        } catch (e) {
          // La scheda c'è: si apre, così un secondo SALVA non ne crea un'altra.
          onSalvato(id)
          throw new Error(`Scheda creata, ma l'iscrizione non è andata: ${messaggio(e)}`)
        }
      },
      b.corso ? 'Scheda creata e iscrizione fatta' : 'Scheda creata',
      () => onSalvato(id),
    )
  }
  return (
    <>
      <span className="ob" style={{ fontSize: 24, fontWeight: 700, letterSpacing: '0.04em' }}>NUOVO ISCRITTO</span>
      <div className="sg-due sg-scheda-campi">
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
        <Campo id="n-corso" etichetta="ISCRIVI A" largo>
          <select id="n-corso" className="sg-campo" value={b.corso} onChange={(e) => setB({ ...b, corso: e.target.value })}>
            <option value="">Nessun corso per ora</option>
            {corsi.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </Campo>
      </div>
      <span style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--dim)' }}>L'email è l'unica cosa che distingue due omonimi.</span>
      <div className="sg-scheda-piede">
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
  const [pagando, setPagando] = useState(false)
  // Dopo una ricevuta nuova l'elenco delle ricevute si rilegge da capo.
  const [giroRicevute, setGiroRicevute] = useState(0)
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

      {pagando ? (
        <NuovaRicevuta
          d={d}
          p={p}
          corsi={correnti.map((i) => corsi.get(i.corsoId)?.nome ?? '').filter(Boolean)}
          fai={fai}
          onLasciaStare={() => setPagando(false)}
          onFatta={() => {
            setPagando(false)
            setGiroRicevute((g) => g + 1)
            onCambiato()
          }}
        />
      ) : (
      <>
      <div className="sg-scheda-griglia">
        <div className="stack" style={{ gap: 20, minWidth: 0 }}>
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

          <DatiAnagrafici key={`a-${p.id}`} d={d} p={p} fai={fai} />
          <Certificato key={`c-${p.id}`} d={d} p={p} fai={fai} onCambiato={onCambiato} />
          <Pagamento key={`p-${p.id}-${p.pagamento.stato}-${p.pagamento.fino ?? ''}-${p.pagamento.nota ?? ''}`} d={d} p={p} fai={fai} onCambiato={onCambiato} />
          <RicevuteIscritto key={`r-${p.id}-${giroRicevute}`} d={d} p={p} fai={fai} onNuova={() => setPagando(true)} />
        </div>

        <div className="stack" style={{ gap: 20, minWidth: 0 }}>
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
        </div>
      </div>

      <div className="sg-scheda-piede">
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
      )}
    </>
  )
}

/**
 * Nascita, residenza e genitore: dal modulo di iscrizione dell'app o
 * dall'import delle risposte del modulo Google. Sono quelli che vanno sulle
 * ricevute: MODIFICA li corregge, e da lì valgono i nuovi.
 */
function DatiAnagrafici({ d, p, fai }: { d: DatiSegreteria; p: PersonaSeg; fai: Fai }) {
  // In una scatola: `null` vuol dire «ancora da leggere», `{ di: null }` «non ce ne sono».
  const an = useCarica(async () => ({ di: await d.anagraficaDi(p.id) }), [d, p.id])
  const [modifica, setModifica] = useState<Anagrafica | null>(null)
  const x = an.dato?.di?.dati
  const valore = (testo?: string) => <span style={{ fontSize: 14, color: testo ? 'var(--text)' : 'var(--dim)', overflowWrap: 'anywhere' }}>{testo || '—'}</span>
  const codice = (testo?: string) => (
    <span className="num" style={{ fontSize: 14, color: testo ? 'var(--text)' : 'var(--dim)', letterSpacing: '0.04em' }}>{testo ?? '—'}</span>
  )
  const residenza = x && [x.indirizzo, [x.cap, x.comune].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  const genitore = x && [x.genitoreCognome, x.genitoreNome].filter(Boolean).join(' ')

  if (modifica) return <ModificaAnagrafica d={d} p={p} fai={fai} dati={modifica} onCambia={setModifica} onFatto={() => { setModifica(null); void an.ricarica() }} />

  return (
    <div className="stack" style={{ gap: 8 }}>
      <Riga titolo="DATI ANAGRAFICI">
        {an.dato?.di && <span style={{ fontSize: 12, color: 'var(--dim)' }}>{an.dato.di.da === 'modulo' ? 'dal modulo di iscrizione' : 'dall’import o dalla segreteria'}</span>}
        {an.dato && (
          <button type="button" className="num sg-chip" onClick={() => setModifica({ ...(an.dato?.di?.dati ?? {}) })}>
            {an.dato.di ? 'MODIFICA' : 'AGGIUNGI'}
          </button>
        )}
      </Riga>
      {an.guaio && <Guaio testo={an.guaio} />}
      {an.dato && !an.dato.di && <span className="sg-sotto">Nessun dato: arrivano dal modulo di iscrizione o dall'import delle risposte del modulo Google.</span>}
      {x && (
        <div className="sg-due">
          <Campo etichetta="NATO IL">{valore(x.natoIl && dataLunga(x.natoIl))}</Campo>
          <Campo etichetta="A">{valore(x.natoA)}</Campo>
          <Campo etichetta="CODICE FISCALE">{codice(x.codiceFiscale)}</Campo>
          <Campo etichetta="RESIDENZA">{valore(residenza)}</Campo>
          {(genitore || x.genitoreCodiceFiscale || x.genitoreNato) && (
            <>
              <Campo etichetta="GENITORE">{valore(genitore)}</Campo>
              <Campo etichetta="CODICE FISCALE DEL GENITORE">{codice(x.genitoreCodiceFiscale)}</Campo>
              {x.genitoreNato && <Campo etichetta="IL GENITORE È NATO" largo>{valore(x.genitoreNato)}</Campo>}
            </>
          )}
        </div>
      )}
    </div>
  )
}

/** I campi della MODIFICA, nell'ordine in cui si scrivono. */
const CAMPI_ANAGRAFICA: Array<{ k: keyof Anagrafica; etichetta: string; tipo?: 'date'; codice?: boolean; largo?: boolean; max: number }> = [
  { k: 'natoIl', etichetta: 'NATO IL', tipo: 'date', max: 10 },
  { k: 'natoA', etichetta: 'A', max: 80 },
  { k: 'codiceFiscale', etichetta: 'CODICE FISCALE', codice: true, largo: true, max: 16 },
  { k: 'indirizzo', etichetta: 'INDIRIZZO', largo: true, max: 160 },
  { k: 'cap', etichetta: 'CAP', max: 5 },
  { k: 'comune', etichetta: 'COMUNE', max: 80 },
  { k: 'genitoreNome', etichetta: 'NOME DEL GENITORE', max: 80 },
  { k: 'genitoreCognome', etichetta: 'COGNOME DEL GENITORE', max: 80 },
  { k: 'genitoreCodiceFiscale', etichetta: 'CODICE FISCALE DEL GENITORE', codice: true, largo: true, max: 16 },
  { k: 'genitoreNato', etichetta: 'LUOGO E DATA DI NASCITA DEL GENITORE', largo: true, max: 120 },
]

/**
 * Correggere i dati anagrafici: si salvano in segreteria e da lì valgono,
 * anche sulla ricevuta dopo. Un campo vuoto si cancella. Un codice fiscale
 * scritto giusto ma che non torna con la persona si dice, e si salva lo
 * stesso: a volte è il dato vecchio a essere sbagliato.
 */
function ModificaAnagrafica({
  d,
  p,
  fai,
  dati,
  onCambia,
  onFatto,
}: {
  d: DatiSegreteria
  p: PersonaSeg
  fai: Fai
  dati: Anagrafica
  onCambia: (a: Anagrafica) => void
  onFatto: () => void
}) {
  const pulita = pulisciAnagrafica(dati)
  const no = cosaNonVaAnagrafica(pulita)
  const cf = pulita.codiceFiscale
  const avviso =
    cf && cf.length === 16 && !no
      ? !cfValido(cf)
        ? "L'ultimo carattere del codice fiscale non torna: forse c'è una lettera sbagliata."
        : !cfTornaColNome(cf, p.nome, p.cognome)
          ? `Il codice fiscale non torna con ${p.nome} ${p.cognome}: è il suo?`
          : pulita.natoIl && !cfTornaConLaData(cf, pulita.natoIl)
            ? 'Il codice fiscale e la data di nascita non dicono lo stesso giorno.'
            : null
      : null
  return (
    <div className="stack" style={{ gap: 12 }}>
      <Riga titolo="DATI ANAGRAFICI" />
      <div className="sg-due">
        {CAMPI_ANAGRAFICA.map((c) => (
          <Campo key={c.k} id={`an-${c.k}`} etichetta={c.etichetta} largo={c.largo}>
            <input
              id={`an-${c.k}`}
              className={c.codice ? 'sg-campo num' : 'sg-campo'}
              type={c.tipo ?? 'text'}
              maxLength={c.tipo ? undefined : c.max}
              inputMode={c.k === 'cap' ? 'numeric' : undefined}
              autoCapitalize={c.codice ? 'characters' : undefined}
              value={dati[c.k] ?? ''}
              onChange={(e) => onCambia({ ...dati, [c.k]: c.codice ? e.target.value.toUpperCase() : e.target.value })}
            />
          </Campo>
        ))}
      </div>
      {no && <span style={{ fontSize: 13, color: 'var(--rosso)' }}>{no}.</span>}
      {avviso && <span style={{ fontSize: 13, color: 'var(--giallo-testo)' }}>{avviso} Si può salvare lo stesso.</span>}
      <span className="sg-sotto">Un campo lasciato vuoto si cancella. Le ricevute già fatte restano com'erano; le nuove prendono questi.</span>
      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className="sg-btn sg-btn-linea" onClick={onFatto}>
          LASCIA STARE
        </button>
        <button type="button" className="sg-btn sg-btn-rosso" disabled={!!no} onClick={() => void fai(() => d.salvaAnagrafica(p.id, pulita, true), 'Dati anagrafici salvati', onFatto)}>
          SALVA
        </button>
      </div>
    </div>
  )
}

/** «12/10», da una data `AAAA-MM-GG`: per il bollino in elenco. */
const dataCorta = (g: string) => `${g.slice(8, 10)}/${g.slice(5, 7)}`

/** Quanti giorni da oggi a una data `AAAA-MM-GG`. */
const giorniA = (g: string, oggi: string) => Math.round((Date.parse(g) - Date.parse(oggi)) / 86_400_000)

/**
 * Il certificato medico: fino a quando vale e il file. Senza, in sala non si
 * entra: in elenco si vede in rosso, e un mese prima della scadenza in giallo.
 */
function Certificato({ d, p, fai, onCambiato }: { d: DatiSegreteria; p: PersonaSeg; fai: Fai; onCambiato: () => void }) {
  const oggi = chiaveGiorno(new Date())
  const [bozza, setBozza] = useState<{ scade: string; file?: File } | null>(null)
  const [guaioFile, setGuaioFile] = useState<string | null>(null)
  const scegli = useRef<HTMLInputElement>(null)
  const c = p.certificato
  const come = comeCertificato(c, oggi)
  const fra = c.scade ? giorniA(c.scade, oggi) : 0

  const stato =
    come === 'manca'
      ? c.scade
        ? `Manca il file. La scadenza scritta è il ${dataLunga(c.scade)}.`
        : 'Nessun certificato: senza, in sala non si entra.'
      : come === 'scaduto'
        ? `Scaduto il ${dataLunga(c.scade!)}: va rinnovato prima di tornare in sala.`
        : come === 'in_scadenza'
          ? `Scade il ${dataLunga(c.scade!)}, ${fra === 0 ? 'oggi' : fra === 1 ? 'domani' : `fra ${fra} giorni`}.`
          : `Valido fino al ${dataLunga(c.scade!)}.`

  const apri = () => {
    // La finestra si apre subito, col clic: dopo l'attesa del link il browser la bloccherebbe.
    const w = window.open('', '_blank')
    void fai(async () => {
      const f = await d.apriCertificato(p.id).catch((e: unknown) => {
        w?.close()
        throw e
      })
      if (!f) {
        w?.close()
        throw new Error(d.modo === 'prova' ? 'In prova il file resta solo finché la pagina è aperta: questo non c’è più' : 'Il file non si trova')
      }
      if (w) w.location.href = f.url
      else window.location.href = f.url
    })
  }

  const scelto = (f?: File) => {
    setGuaioFile(null)
    if (!f || !bozza) return
    if (!ESTENSIONI[f.type]) return setGuaioFile('Questo tipo di file non va: serve una foto o un PDF')
    if (f.size > MASSIMO_FILE) return setGuaioFile('Il file è troppo grande: al massimo 10 MB')
    setBozza({ ...bozza, file: f })
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      <Riga titolo="CERTIFICATO MEDICO">
        <Bollino tono={TONO_CERTIFICATO[come]}>{come === 'manca' ? 'MANCA' : come === 'scaduto' ? 'SCADUTO' : come === 'in_scadenza' ? 'IN SCADENZA' : 'VALIDO'}</Bollino>
      </Riga>
      {!bozza && <span style={{ fontSize: 14, color: come === 'valido' ? 'var(--sec)' : come === 'in_scadenza' ? 'var(--giallo-testo)' : 'var(--rosso)' }}>{stato}</span>}

      {bozza ? (
        <>
          <Campo id="c-scade" etichetta="VALIDO FINO AL">
            <input id="c-scade" className="sg-campo" type="date" value={bozza.scade} onChange={(e) => setBozza({ ...bozza, scade: e.target.value })} />
          </Campo>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <button type="button" className="num sg-chip" onClick={() => scegli.current?.click()}>
              {bozza.file ? 'CAMBIA FILE' : c.conFile ? 'FILE NUOVO' : 'SCEGLI IL FILE'}
            </button>
            <span style={{ fontSize: 13, color: bozza.file ? 'var(--text)' : 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
              {bozza.file ? bozza.file.name : c.conFile ? 'resta il file di prima' : 'foto o PDF, fino a 10 MB'}
            </span>
            <input
              ref={scegli}
              className="vh"
              type="file"
              accept="image/*,application/pdf"
              aria-label="File del certificato"
              onChange={(e) => {
                scelto(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </div>
          {guaioFile && <span style={{ fontSize: 13, color: 'var(--rosso)' }}>{guaioFile}</span>}
          {bozza.scade && bozza.scade < oggi && <span style={{ fontSize: 13, color: 'var(--giallo-testo)' }}>Questa data è già passata: il certificato risulterà scaduto.</span>}
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="sg-btn sg-btn-linea grow" onClick={() => setBozza(null)}>
              LASCIA STARE
            </button>
            <button
              type="button"
              className="sg-btn sg-btn-rosso grow"
              disabled={!bozza.scade || (!bozza.file && !c.conFile)}
              onClick={() =>
                void fai(() => d.salvaCertificato(p.id, bozza.scade, bozza.file), bozza.file ? 'Certificato caricato' : 'Scadenza cambiata', () => {
                  setBozza(null)
                  onCambiato()
                })
              }
            >
              SALVA
            </button>
          </div>
        </>
      ) : (
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" className="num sg-chip sg-chip-pieno" onClick={() => setBozza({ scade: c.conFile && c.scade && c.scade >= oggi ? c.scade : '' })}>
            {c.conFile ? 'RINNOVA O CORREGGI' : 'CARICA IL CERTIFICATO'}
          </button>
          {c.conFile && (
            <button type="button" className="num sg-chip" onClick={apri}>
              APRI IL FILE
            </button>
          )}
          <div className="grow" />
          {(c.conFile || c.scade) && (
            <button
              type="button"
              className="sg-link"
              onClick={() => {
                if (window.confirm(`Togliere il certificato di ${p.nome} ${p.cognome}? Il file si cancella per sempre.`))
                  void fai(() => d.togliCertificato(p.id), 'Certificato tolto', onCambiato)
              }}
            >
              Togli
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Il pagamento: da pagare, in parte o pagato, e per chi paga il trimestre fino
 * a quando. Passata quella data torna da pagare da sé.
 */
function Pagamento({ d, p, fai, onCambiato }: { d: DatiSegreteria; p: PersonaSeg; fai: Fai; onCambiato: () => void }) {
  const oggi = chiaveGiorno(new Date())
  const [b, setB] = useState<PagamentoSeg>({ stato: p.pagamento.stato, fino: p.pagamento.fino ?? '', nota: p.pagamento.nota ?? '' })
  const come = comePaga(p.pagamento, oggi)
  const cambiato = b.stato !== p.pagamento.stato || (b.fino || '') !== (p.pagamento.fino ?? '') || (b.nota ?? '').trim() !== (p.pagamento.nota ?? '')

  return (
    <div className="stack" style={{ gap: 8 }}>
      <Riga titolo="PAGAMENTO">
        <Bollino tono={TONO_PAGA[come]}>{PAROLA_PAGA[come]}</Bollino>
      </Riga>
      {come === 'scaduto' && <span style={{ fontSize: 14, color: 'var(--rosso)' }}>Pagato fino al {dataLunga(p.pagamento.fino!)}: ora è da pagare di nuovo.</span>}
      {come === 'pagato' && p.pagamento.fino && <span style={{ fontSize: 14, color: 'var(--sec)' }}>Pagato fino al {dataLunga(p.pagamento.fino)}.</span>}
      <div role="radiogroup" aria-label="Stato del pagamento" className="sg-tre">
        {PAGAMENTI.map(([s, testo]) => (
          <button key={s} type="button" role="radio" aria-checked={b.stato === s} className="sg-btn sg-scelta" style={{ fontSize: 13, padding: '0 6px', whiteSpace: 'nowrap' }} onClick={() => setB({ ...b, stato: s })}>
            {testo}
          </button>
        ))}
      </div>
      <div className="sg-due">
        <Campo id="pg-fino" etichetta="FINO AL · FACOLTATIVO">
          <input id="pg-fino" className="sg-campo" type="date" value={b.fino ?? ''} onChange={(e) => setB({ ...b, fino: e.target.value })} />
        </Campo>
        <Campo id="pg-nota" etichetta="NOTA">
          <input id="pg-nota" className="sg-campo" maxLength={300} placeholder="Manca il saldo…" value={b.nota ?? ''} onChange={(e) => setB({ ...b, nota: e.target.value })} />
        </Campo>
      </div>
      <span style={{ fontSize: 12, color: 'var(--dim)' }}>«Fino al» serve per il trimestre: passata la data, torna da pagare.</span>
      {cambiato && (
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="sg-btn sg-btn-linea grow" onClick={() => setB({ stato: p.pagamento.stato, fino: p.pagamento.fino ?? '', nota: p.pagamento.nota ?? '' })}>
            LASCIA STARE
          </button>
          <button type="button" className="sg-btn sg-btn-rosso grow" onClick={() => void fai(() => d.salvaPagamento(p.id, b), 'Pagamento segnato', onCambiato)}>
            SALVA
          </button>
        </div>
      )}
    </div>
  )
}
