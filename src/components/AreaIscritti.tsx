import { useEffect, useMemo, useState } from 'react'
import {
  avvisi,
  contoPresenze,
  datiIscritto,
  iscrittoScelto,
  scegliIscritto,
  type AggiuntaNucleo,
  type DatiIscritto,
  type IscrittoDiProva,
  type MiaLezione,
  type MiaPresenza,
  type SchedaIscritto,
} from '../lib/iscritto'
import type { Segnalata } from '../lib/segnalate'
import { chiaveGiorno, giornoPerEsteso, oraDi } from '../lib/sala'
import { comeCertificato, comePaga, pagamentoDi } from '../lib/segreteria'
import { euro, nomeFileRicevuta, type Ricevuta } from '../lib/ricevute'
import { CONTATTI, chiama } from '../lib/sito'
import { abbonamentiDalleRicevute, doveVaLoSconto, SCONTO_FAMIGLIA } from '../lib/nucleo'
import { Dettaglio, Etichetta, Riquadro, Tasti, Tasto, Titoletto, TitoloEsito } from './ds'
import { ModuloIscrizione, type PerIlNucleo } from './ModuloIscrizione'

/**
 * L'area degli iscritti, dal telefono: le prossime lezioni dei suoi corsi,
 * le sue presenze, il certificato, la quota e le ricevute. Solo da leggere:
 * per cambiare qualcosa si passa in segreteria.
 *
 * È il pilota, e c'è solo in prova (vedi `iscritto.ts`): in cima si sceglie
 * quale iscritto inventato essere, per far vedere la pagina com'è per
 * ognuno. Col database vero, per ora, la pagina dice che non è ancora aperta.
 *
 * Il titolare di un nucleo familiare (vedi `nucleo.ts`) passa dalla sua
 * pagina a quella di ogni persona del nucleo, vede i pagamenti di tutti e
 * aggiunge una persona in più col modulo di iscrizione, che parte coi suoi
 * dati e dice quanto costa con lo sconto famiglia.
 */

/** Quanti giorni avanti si guardano le lezioni, e quanti indietro le presenze. */
const AVANTI = 14
const INDIETRO = 30

export function AreaIscritti() {
  const [d, setD] = useState<DatiIscritto | null>(null)
  const [guaio, setGuaio] = useState<string | null>(null)
  const [iscritti, setIscritti] = useState<IscrittoDiProva[] | null>(null)
  const [chi, setChi] = useState<string | null>(iscrittoScelto)

  useEffect(() => {
    let vivo = true
    datiIscritto()
      .then(async (x) => {
        const elenco = await x.iscritti()
        if (!vivo) return
        setD(x)
        setIscritti(elenco)
        // Il primo dell'elenco se non se n'è scelto nessuno, o quello scelto non c'è più.
        setChi((c) => (c && elenco.some((p) => p.id === c) ? c : (elenco[0]?.id ?? null)))
      })
      .catch((e: unknown) => vivo && setGuaio(e instanceof Error ? e.message : 'L’app non si è caricata'))
    return () => {
      vivo = false
    }
  }, [])

  const scegli = (id: string) => {
    scegliIscritto(id)
    setChi(id)
  }

  if (guaio) return <p className="pad" style={{ color: 'var(--dim)', paddingTop: 20 }}>{guaio}: controlla la connessione.</p>
  if (!d || !iscritti) return <p className="pad" style={{ color: 'var(--dim)', paddingTop: 20 }}>Un attimo…</p>

  return (
    <>
      <div className="nastro-prova">DATI DI PROVA · ORARIO VERO, ISCRITTI INVENTATI</div>
      <div className="mia-area">
        <div className="pad stack mia-chi">
          <label htmlFor="mia-chi" className="modulo-etichetta">
            IN PROVA SEI
          </label>
          <select id="mia-chi" className="campo" value={chi ?? ''} onChange={(e) => scegli(e.target.value)}>
            {iscritti.map((p) => (
              <option key={p.id} value={p.id}>
                {p.cognome} {p.nome}
              </option>
            ))}
          </select>
        </div>
        {chi ? <Account key={chi} dati={d} personaId={chi} /> : <p className="pad">Nessun iscritto in prova.</p>}
      </div>
    </>
  )
}

const suSubito = () => document.querySelector('.scroll')?.scrollTo(0, 0)

/**
 * Chi è entrato: la sua pagina, o quella di una persona del suo nucleo, e
 * sotto il nucleo coi pagamenti di tutti. Aggiungendo una persona la pagina
 * lascia il posto al modulo.
 */
function Account({ dati, personaId }: { dati: DatiIscritto; personaId: string }) {
  const [nucleo, setNucleo] = useState<SchedaIscritto[] | null>(null)
  const [titolare, setTitolare] = useState(false)
  const [aggiunte, setAggiunte] = useState<AggiuntaNucleo[]>([])
  const [ricevute, setRicevute] = useState<Ricevuta[]>([])
  const [di, setDi] = useState(personaId)
  const [modulo, setModulo] = useState<PerIlNucleo | null>(null)
  const [giro, setGiro] = useState(0)

  useEffect(() => {
    let vivo = true
    void Promise.all([dati.nucleo(personaId), dati.titolare(personaId), dati.aggiunte(personaId)]).then(async ([n, t, ag]) => {
      const r = (await Promise.all(n.map((p) => dati.ricevute(p.id)))).flat()
      if (!vivo) return
      setNucleo(n)
      setTitolare(t)
      setAggiunte(ag)
      setRicevute(r)
    })
    return () => {
      vivo = false
    }
  }, [dati, personaId, giro])

  if (!nucleo) return <p className="pad" style={{ color: 'var(--dim)' }}>Un attimo…</p>
  const io = nucleo[0]
  if (!io) return <p className="pad">Questa persona non è più fra gli iscritti.</p>
  const nomeDi = (id: string) => nucleo.find((p) => p.id === id)?.nome ?? ''

  if (modulo)
    return (
      <div className="iscrizioni-modulo">
        <Titoletto>UNA PERSONA IN PIÙ</Titoletto>
        <ModuloIscrizione
          nucleo={modulo}
          torna="TORNA ALLA TUA PAGINA"
          onChiudi={() => {
            setModulo(null)
            setGiro((g) => g + 1)
            suSubito()
          }}
        />
      </div>
    )

  const aggiungi = async () => {
    const d = await dati.datiDelNucleo(personaId)
    setModulo({ titolare: io.nome, dati: d, abbonamenti: abbonamentiDalleRicevute(ricevute, nomeDi) })
    suSubito()
  }
  const apri = (id: string) => {
    setDi(id)
    suSubito()
  }

  return (
    <>
      {nucleo.length > 1 && (
        <div className="pad row mie-chips mio-nucleo-scelta" role="group" aria-label="Di chi vedi la pagina">
          {nucleo.map((p) => (
            <button key={p.id} type="button" className="num mia-chip mia-chip-tasto" aria-pressed={p.id === di} onClick={() => apri(p.id)}>
              {p.id === personaId ? 'TU' : p.nome.toUpperCase()}
            </button>
          ))}
        </div>
      )}
      <Pagina key={di} dati={dati} personaId={di} tua={di === personaId} />
      {titolare && <Nucleo io={personaId} membri={nucleo} aggiunte={aggiunte} ricevute={ricevute} onApri={apri} onAggiungi={() => void aggiungi()} />}
      <div style={{ paddingBottom: 20 }}>
        <Segreteria />
      </div>
    </>
  )
}

/** La pagina di un iscritto: la propria, o (`tua` falso) di una persona del nucleo. */
function Pagina({ dati, personaId, tua }: { dati: DatiIscritto; personaId: string; tua: boolean }) {
  const [scheda, setScheda] = useState<SchedaIscritto | null | undefined>(undefined)
  const [lezioni, setLezioni] = useState<MiaLezione[]>([])
  const [presenze, setPresenze] = useState<MiaPresenza[]>([])
  const [ricevute, setRicevute] = useState<Ricevuta[]>([])

  useEffect(() => {
    let vivo = true
    const oggi = new Date()
    const fino = new Date(oggi)
    fino.setDate(fino.getDate() + AVANTI)
    void Promise.all([dati.scheda(personaId), dati.lezioni(personaId, oggi, fino), dati.presenze(personaId, INDIETRO), dati.ricevute(personaId)]).then(
      ([s, l, p, r]) => {
        if (!vivo) return
        setScheda(s)
        // Quelle già finite oggi non sono «prossime».
        setLezioni(l.filter((x) => new Date(x.fine).getTime() > Date.now()))
        setPresenze(p)
        setRicevute(r)
      },
    )
    return () => {
      vivo = false
    }
  }, [dati, personaId])

  if (scheda === undefined) return <p className="pad" style={{ color: 'var(--dim)' }}>Un attimo…</p>
  if (!scheda) return <p className="pad">Questa persona non è più fra gli iscritti.</p>

  return (
    <div className="stack">
      <Saluto scheda={scheda} tua={tua} />
      <Prossime lezioni={lezioni} />
      <Presenze dati={dati} personaId={personaId} presenze={presenze} tua={tua} />
      <InRegola scheda={scheda} />
      <Ricevute ricevute={ricevute} />
    </div>
  )
}

function Saluto({ scheda, tua }: { scheda: SchedaIscritto; tua: boolean }) {
  const oggi = chiaveGiorno(new Date())
  const x = avvisi(scheda, oggi)
  return (
    <section className="pad stack" style={{ gap: 10, paddingTop: 6 }}>
      <span className="ob mio-nome">{tua ? `Ciao ${scheda.nome}` : `${scheda.nome} ${scheda.cognome}`}</span>
      {!tua && <Dettaglio>Nel tuo nucleo familiare: vedi la sua pagina come la vede la segreteria.</Dettaglio>}
      {scheda.corsi.length > 0 ? (
        <span className="row mie-chips">
          {scheda.corsi.map((c) => (
            <span key={c.id} className="num mia-chip" style={{ ['--tinta' as string]: c.colore ?? 'var(--blu)' }}>
              {c.nome.toUpperCase()}
            </span>
          ))}
        </span>
      ) : (
        <Dettaglio>Oggi non risulta un’iscrizione a un corso.</Dettaglio>
      )}
      {x.length === 0 ? (
        <Riquadro stretto>
          <TitoloEsito tono="fatto">SEI IN REGOLA</TitoloEsito>
          <Dettaglio>Certificato medico valido e quota pagata.</Dettaglio>
        </Riquadro>
      ) : (
        x.map((a) => (
          <Riquadro key={a.testo} tono={a.tono === 'guaio' ? 'guaio' : 'prova'} stretto>
            <Dettaglio tono={a.tono === 'guaio' ? 'guaio' : 'testo'}>{a.testo}</Dettaglio>
          </Riquadro>
        ))
      )}
    </section>
  )
}

/** Le prossime due settimane, un gruppo per giorno; quello che è cambiato si legge sulla lezione. */
function Prossime({ lezioni }: { lezioni: MiaLezione[] }) {
  const oggi = chiaveGiorno(new Date())
  const perGiorno = useMemo(() => {
    const m = new Map<string, MiaLezione[]>()
    for (const l of lezioni) {
      const g = chiaveGiorno(new Date(l.inizio))
      m.set(g, [...(m.get(g) ?? []), l])
    }
    return [...m]
  }, [lezioni])
  const annullate = lezioni.filter((l) => l.stato === 'annullata').length

  return (
    <section>
      <Titoletto conto={annullate ? `${annullate} ANNULLATE` : lezioni.length}>PROSSIME LEZIONI</Titoletto>
      {lezioni.length === 0 && (
        <p className="pad" style={{ color: 'var(--dim)', margin: 0 }}>
          Nessuna lezione nelle prossime due settimane.
        </p>
      )}
      {perGiorno.map(([g, del]) => (
        <div key={g} className="stack" style={{ gap: 8, paddingBottom: 12 }}>
          <span className="pad rule-label" style={g === oggi ? { color: 'var(--giallo-testo)' } : undefined}>
            {(g === oggi ? `OGGI · ${giornoPerEsteso(g)}` : giornoPerEsteso(g)).toUpperCase()}
          </span>
          <div className="pad stack" style={{ gap: 8 }}>
            {del.map((l) => (
              <Lezione key={l.id} l={l} />
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}

function Lezione({ l }: { l: MiaLezione }) {
  const annullata = l.stato === 'annullata'
  const cosa = annullata
    ? 'ANNULLATA'
    : [l.straordinaria && 'IN PIÙ', l.sostituto && 'SOSTITUTO', l.altraSala && `IN ${l.sala?.toUpperCase()}`].filter(Boolean).join(' · ')
  return (
    <div className="card lezione mia-lezione" data-annullata={annullata || undefined} style={{ ['--tinta' as string]: l.colore ?? 'var(--blu)', cursor: 'default' }}>
      <span className="lezione-ora num">{oraDi(l.inizio)}</span>
      <span className="stack grow" style={{ gap: 3, minWidth: 0 }}>
        <span className="ob lezione-nome">{l.corso.toUpperCase()}</span>
        <span style={{ fontSize: 13, color: 'var(--dim)' }}>{[l.sala, l.istruttore].filter(Boolean).join(' · ')}</span>
      </span>
      {cosa && (
        <span className="num mia-lezione-cosa" data-tono={annullata ? 'guaio' : 'avviso'}>
          {cosa}
        </span>
      )}
    </div>
  )
}

const SEGNI: Record<string, [string, string]> = {
  presente: ['✓', 'PRESENTE'],
  assente: ['✗', 'ASSENTE'],
  giustificato: ['–', 'GIUSTIFICATO'],
}

/**
 * Le presenze degli ultimi trenta giorni. Dove non risulta presente (non
 * segnato, o assente) c'è SEGNALA: chi c'era lo dice, con una nota se vuole,
 * e la presenza la conferma l'istruttore o la segreteria (vedi `segnalate.ts`).
 */
function Presenze({ dati, personaId, presenze, tua }: { dati: DatiIscritto; personaId: string; presenze: MiaPresenza[]; tua: boolean }) {
  const [tutte, setTutte] = useState(false)
  const [segnalate, setSegnalate] = useState<Segnalata[]>([])
  const [aperta, setAperta] = useState<string | null>(null)
  const [nota, setNota] = useState('')
  const [guaio, setGuaio] = useState<string | null>(null)
  const [giro, setGiro] = useState(0)
  useEffect(() => {
    let vivo = true
    void dati.segnalate(personaId).then((x) => vivo && setSegnalate(x))
    return () => {
      vivo = false
    }
  }, [dati, personaId, giro])

  const c = contoPresenze(presenze)
  const viste = tutte ? presenze : presenze.slice(0, 5)
  const daVedere = segnalate.filter((x) => x.stato === 'da_vedere').length
  const manda = async (sessioneId: string) => {
    setGuaio(null)
    try {
      await dati.segnala(personaId, sessioneId, nota)
      setAperta(null)
      setNota('')
      setGiro((g) => g + 1)
    } catch (e) {
      setGuaio(e instanceof Error ? e.message : 'La segnalazione non è partita')
    }
  }
  return (
    <section>
      <Titoletto conto={c.dovute ? `${c.presenti}/${c.dovute}` : undefined}>{tua ? 'LE TUE PRESENZE' : 'PRESENZE'}</Titoletto>
      <div className="pad stack" style={{ gap: 8, paddingBottom: 12 }}>
        {presenze.length === 0 ? (
          <Dettaglio>Nessuna lezione negli ultimi {INDIETRO} giorni.</Dettaglio>
        ) : (
          <>
            <Dettaglio>
              Negli ultimi {INDIETRO} giorni: presente a {c.presenti} {c.presenti === 1 ? 'lezione' : 'lezioni'} su {c.dovute}. Se c’eri e non risulta,
              tocca SEGNALA: la conferma l’istruttore o la segreteria.
            </Dettaglio>
            {daVedere > 0 && (
              <Dettaglio tono="avviso">
                {daVedere === 1 ? 'Una presenza segnalata aspetta' : `${daVedere} presenze segnalate aspettano`} l’istruttore o la segreteria.
              </Dettaglio>
            )}
            <ul className="card stack mie-presenze">
              {viste.map((p) => {
                const s = segnalate.find((x) => x.sessioneId === p.sessioneId)
                const [segno, detto] = p.stato ? SEGNI[p.stato] : ['·', 'NON SEGNATO']
                const puo = !s && p.stato !== 'presente' && p.stato !== 'giustificato'
                return (
                  <li key={p.sessioneId} className="stack mia-presenza-voce">
                    <span className="row mia-presenza" data-stato={p.stato ?? 'nessuno'}>
                      <span className="num mia-presenza-segno" aria-hidden="true">
                        {segno}
                      </span>
                      <span className="stack grow" style={{ gap: 1, minWidth: 0 }}>
                        <span style={{ fontWeight: 600 }}>{p.corso}</span>
                        <span style={{ fontSize: 13, color: 'var(--dim)' }}>
                          {giornoPerEsteso(chiaveGiorno(new Date(p.inizio)))} · {oraDi(p.inizio)}
                        </span>
                      </span>
                      <span className="stack" style={{ gap: 4, alignItems: 'flex-end' }}>
                        <span className="num mia-presenza-detto">{detto}</span>
                        {s && s.stato !== 'accolta' && (
                          <span className="num mia-lezione-cosa mia-presenza-segnalata" data-tono={s.stato === 'rifiutata' ? 'guaio' : 'avviso'} title={s.stato === 'rifiutata' ? 'La segnalazione è stata rifiutata' : 'Segnalata: la conferma l’istruttore o la segreteria'}>
                            {s.stato === 'rifiutata' ? 'RIFIUTATA' : 'DA CONFERMARE'}
                          </span>
                        )}
                        {puo && aperta !== p.sessioneId && (
                          <button type="button" className="num mia-segnala" onClick={() => (setAperta(p.sessioneId), setNota(''), setGuaio(null))}>
                            SEGNALA
                          </button>
                        )}
                      </span>
                    </span>
                    {aperta === p.sessioneId && (
                      <span className="stack mia-segnala-modulo">
                        <label htmlFor={`nota-${p.sessioneId}`} className="modulo-etichetta">
                          C’ERI? UNA NOTA PER L’ISTRUTTORE · FACOLTATIVA
                        </label>
                        <textarea
                          id={`nota-${p.sessioneId}`}
                          className="campo campo-note"
                          rows={2}
                          maxLength={200}
                          placeholder="In ritardo, il tablet non mi trovava…"
                          value={nota}
                          onChange={(e) => setNota(e.target.value)}
                        />
                        {guaio && <Dettaglio tono="guaio">{guaio}</Dettaglio>}
                        <Tasti>
                          <Tasto variante="principale" onClick={() => void manda(p.sessioneId)}>
                            ERO PRESENTE
                          </Tasto>
                          <Tasto onClick={() => setAperta(null)}>LASCIA STARE</Tasto>
                        </Tasti>
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
            {presenze.length > viste.length && (
              <Tasti>
                <Tasto onClick={() => setTutte(true)}>TUTTE E {presenze.length}</Tasto>
              </Tasti>
            )}
          </>
        )}
      </div>
    </section>
  )
}

const data = (g: string) => g.split('-').reverse().join('/')

function InRegola({ scheda }: { scheda: SchedaIscritto }) {
  const oggi = chiaveGiorno(new Date())
  const cert = comeCertificato(scheda.certificato, oggi)
  const stato = pagamentoDi(scheda, oggi)
  const paga = stato.come
  const certTesto = {
    manca: 'Non risulta: senza, in sala non si entra.',
    scaduto: `Scaduto il ${data(scheda.certificato.scade ?? '')}.`,
    in_scadenza: `Vale fino al ${data(scheda.certificato.scade ?? '')}: scade fra poco.`,
    valido: `Vale fino al ${data(scheda.certificato.scade ?? '')}.`,
  }[cert]
  const pagaTesto = {
    da_pagare: 'Non risulta pagata.',
    in_parte: `Pagata in parte${stato.mancano ? `: mancano ${euro(stato.mancano)} €` : stato.nota ? `: ${stato.nota.toLowerCase()}` : ''}.`,
    pagato: stato.fino ? `Pagata fino al ${data(stato.fino)}.` : 'Pagata.',
    scaduto: `Valeva fino al ${data(stato.fino ?? '')}: è da rinnovare.`,
  }[paga]
  const tono = (bene: boolean, quasi: boolean) => (bene ? undefined : quasi ? 'avviso' : 'guaio')
  return (
    <section>
      <Titoletto>CERTIFICATO E QUOTA</Titoletto>
      <div className="pad mie-schede">
        <Riquadro stretto>
          <Etichetta>CERTIFICATO MEDICO</Etichetta>
          <Dettaglio tono={tono(cert === 'valido', cert === 'in_scadenza')}>{certTesto}</Dettaglio>
        </Riquadro>
        <Riquadro stretto>
          <Etichetta>QUOTA</Etichetta>
          <Dettaglio tono={tono(paga === 'pagato', paga === 'in_parte')}>{pagaTesto}</Dettaglio>
        </Riquadro>
      </div>
    </section>
  )
}

function Ricevute({ ricevute }: { ricevute: Ricevuta[] }) {
  const [guaio, setGuaio] = useState<string | null>(null)
  const scarica = (r: Ricevuta) => {
    setGuaio(null)
    // pdf-lib si carica solo qui: chi guarda le lezioni non lo scarica.
    void import('../lib/ricevutaPdf')
      .then((m) => m.scaricaRicevuta(r, nomeFileRicevuta(r)))
      .catch(() => setGuaio('Il PDF non si è fatto: riprova fra un attimo.'))
  }
  return (
    <section>
      <Titoletto conto={ricevute.length || undefined}>RICEVUTE</Titoletto>
      <div className="pad stack" style={{ gap: 8, paddingBottom: 12 }}>
        {ricevute.length === 0 && <Dettaglio>Nessuna ricevuta: quando paghi in segreteria, la trovi qui.</Dettaglio>}
        {ricevute.map((r) => (
          <div key={r.id} className="card row mia-ricevuta" data-annullata={!!r.annullataIl || undefined}>
            <span className="stack grow" style={{ gap: 2, minWidth: 0 }}>
              <span style={{ fontWeight: 600 }}>
                N. {r.numero}/{r.anno} · {data(r.data)}
              </span>
              <span style={{ fontSize: 13, color: 'var(--dim)' }}>
                {r.annullataIl ? 'Annullata' : r.voci.map((v) => v.descrizione.toLowerCase()).join(', ')}
              </span>
            </span>
            <span className="num mia-ricevuta-euro">{euro(r.pagato)} €</span>
            <Tasto onClick={() => scarica(r)}>PDF</Tasto>
          </div>
        ))}
        {guaio && <Dettaglio tono="guaio">{guaio}</Dettaglio>}
      </div>
    </section>
  )
}

/**
 * Il nucleo familiare, per il titolare: chi c'è, chi è in regola, chi
 * aspetta la segreteria, e i pagamenti di tutti con lo sconto famiglia.
 */
function Nucleo({
  io,
  membri,
  aggiunte,
  ricevute,
  onApri,
  onAggiungi,
}: {
  io: string
  membri: SchedaIscritto[]
  aggiunte: AggiuntaNucleo[]
  ricevute: Ricevuta[]
  onApri: (id: string) => void
  onAggiungi: () => void
}) {
  const oggi = chiaveGiorno(new Date())
  const valide = ricevute.filter((r) => !r.annullataIl)
  const pagatoDa = (id: string) => valide.filter((r) => r.personaId === id).reduce((s, r) => s + r.pagato, 0)
  const nomeDi = (id: string) => membri.find((p) => p.id === id)?.nome ?? ''
  const annuali = abbonamentiDalleRicevute(ricevute, nomeDi)
  const minimo = doveVaLoSconto([], annuali)
  const PAGA: Record<string, string> = { pagato: 'PAGATO', in_parte: 'IN PARTE', da_pagare: 'DA PAGARE', scaduto: 'DA RINNOVARE' }
  return (
    <>
      <section>
        <Titoletto conto={membri.length}>IL TUO NUCLEO</Titoletto>
        <div className="pad stack" style={{ gap: 8, paddingBottom: 12 }}>
          {membri.map((p) => {
            const guai = avvisi(p, oggi)
            return (
              <button key={p.id} type="button" className="card row mio-membro" onClick={() => onApri(p.id)}>
                <span className="stack grow" style={{ gap: 2, minWidth: 0, textAlign: 'left' }}>
                  <span style={{ fontWeight: 600 }}>
                    {p.nome} {p.cognome}
                    {p.id === io ? ' · tu' : ''}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--dim)' }}>{p.corsi.map((c) => c.nome).join(', ') || 'Nessun corso oggi'}</span>
                </span>
                <span className="num mia-lezione-cosa" data-tono={guai.some((g) => g.tono === 'guaio') ? 'guaio' : guai.length ? 'avviso' : 'fatto'}>
                  {guai.length ? 'DA SISTEMARE' : 'IN REGOLA'}
                </span>
              </button>
            )
          })}
          {aggiunte.map((x) => (
            <div key={x.id} className="card row mio-membro" data-attesa>
              <span className="stack grow" style={{ gap: 2, minWidth: 0 }}>
                <span style={{ fontWeight: 600 }}>
                  {x.nome} {x.cognome}
                </span>
                <span style={{ fontSize: 13, color: 'var(--dim)' }}>{x.corsi.join(', ')}</span>
              </span>
              <span className="num mia-lezione-cosa" data-tono={x.stato === 'rifiutata' ? 'guaio' : 'avviso'}>
                {x.stato === 'rifiutata' ? 'RIFIUTATA: CHIAMA LA SEGRETERIA' : 'LA GUARDA LA SEGRETERIA'}
              </span>
            </div>
          ))}
          <Dettaglio>Figli, coniuge, fratelli: il modulo parte coi tuoi dati, e la richiesta arriva in segreteria come le altre.</Dettaglio>
          <Tasti>
            <Tasto variante="principale" onClick={onAggiungi}>
              AGGIUNGI UNA PERSONA
            </Tasto>
          </Tasti>
        </div>
      </section>
      {membri.length > 1 && (
        <section>
          <Titoletto>PAGAMENTI DEL NUCLEO</Titoletto>
          <div className="pad stack" style={{ gap: 8, paddingBottom: 12 }}>
            <ul className="card stack mie-presenze">
              {membri.map((p) => {
                const come = comePaga(p, oggi)
                return (
                  <li key={p.id} className="row mia-presenza" data-stato={come === 'pagato' ? 'presente' : come === 'in_parte' ? 'nessuno' : 'assente'}>
                    <span className="stack grow" style={{ gap: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 600 }}>{p.nome}</span>
                      <span style={{ fontSize: 13, color: 'var(--dim)' }}>Pagati {euro(pagatoDa(p.id))} € nelle ricevute</span>
                    </span>
                    <span className="num mia-presenza-detto">{PAGA[come]}</span>
                  </li>
                )
              })}
              <li className="row mia-presenza">
                <span className="grow" style={{ fontWeight: 700 }}>
                  Tutto il nucleo
                </span>
                <span className="num mia-ricevuta-euro">{euro(valide.reduce((s, r) => s + r.pagato, 0))} €</span>
              </li>
            </ul>
            {minimo ? (
              <Dettaglio>
                {minimo.scontato
                  ? `Sconto famiglia: il ${Math.round(SCONTO_FAMIGLIA * 100)}% su ${minimo.corso} di ${minimo.chi}, cioè ${euro(Math.round(minimo.importo * SCONTO_FAMIGLIA))} €: è già nella sua ricevuta.`
                  : `Sconto famiglia: il ${Math.round(SCONTO_FAMIGLIA * 100)}% sull’annuale che costa meno, ${minimo.corso} di ${minimo.chi}, cioè ${euro(Math.round(minimo.importo * SCONTO_FAMIGLIA))} €. Se non l’hai avuto, chiedilo in segreteria.`}
              </Dettaglio>
            ) : (
              <Dettaglio>Con due annuali nel nucleo, quello che costa meno ha il {Math.round(SCONTO_FAMIGLIA * 100)}% di sconto (la quota associativa no).</Dettaglio>
            )}
          </div>
        </section>
      )}
    </>
  )
}

/** Quello che non si fa da qui: per cambiare qualcosa, la segreteria. */
function Segreteria() {
  return (
    <section className="pad" style={{ paddingTop: 4 }}>
      <Riquadro>
        <span className="passo-titolo">Qualcosa non torna?</span>
        <Dettaglio>
          Questa pagina mostra quello che sa la segreteria. Per un certificato nuovo, un pagamento o un cambio di corso passa in palestra o chiama il{' '}
          <span className="num testo-pieno">{CONTATTI.telefono}</span>.
        </Dettaglio>
        <Tasti>
          <Tasto href={chiama} qui>
            CHIAMA
          </Tasto>
        </Tasti>
      </Riquadro>
    </section>
  )
}

/**
 * Col database vero: l'area non è ancora aperta. La si vede in prova, dalla
 * porta o con `?prova` nell'indirizzo.
 */
export function IscrittiChiusa() {
  return (
    <section className="pad stack mia-area" style={{ gap: 12, paddingTop: 20 }}>
      <Riquadro tono="prova">
        <Etichetta>IN ARRIVO</Etichetta>
        <span className="passo-titolo">L’area per gli iscritti non è ancora aperta.</span>
        <Dettaglio>
          Ci troverai le prossime lezioni dei tuoi corsi, le presenze, il certificato medico, la quota e le ricevute. Intanto si può vedere com’è,
          con dati inventati.
        </Dettaglio>
        <Tasti>
          <Tasto variante="principale" href="?prova" qui>
            GUARDALA IN PROVA
          </Tasto>
        </Tasti>
      </Riquadro>
    </section>
  )
}
