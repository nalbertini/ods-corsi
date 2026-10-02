import { useEffect, useMemo, useState } from 'react'
import {
  avvisi,
  contoPresenze,
  datiIscritto,
  iscrittoScelto,
  scegliIscritto,
  type DatiIscritto,
  type IscrittoDiProva,
  type MiaLezione,
  type MiaPresenza,
  type SchedaIscritto,
} from '../lib/iscritto'
import { chiaveGiorno, giornoPerEsteso, oraDi } from '../lib/sala'
import { comeCertificato, comePaga } from '../lib/segreteria'
import { euro, nomeFileRicevuta, type Ricevuta } from '../lib/ricevute'
import { CONTATTI, chiama } from '../lib/sito'
import { Dettaglio, Etichetta, Riquadro, Tasti, Tasto, Titoletto, TitoloEsito } from './ds'

/**
 * L'area degli iscritti, dal telefono: le prossime lezioni dei suoi corsi,
 * le sue presenze, il certificato, la quota e le ricevute. Solo da leggere:
 * per cambiare qualcosa si passa in segreteria.
 *
 * È il pilota, e c'è solo in prova (vedi `iscritto.ts`): in cima si sceglie
 * quale iscritto inventato essere, per far vedere la pagina com'è per
 * ognuno. Col database vero, per ora, la pagina dice che non è ancora aperta.
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
        {chi ? <Pagina key={chi} dati={d} personaId={chi} /> : <p className="pad">Nessun iscritto in prova.</p>}
      </div>
    </>
  )
}

/** La pagina di un iscritto. */
function Pagina({ dati, personaId }: { dati: DatiIscritto; personaId: string }) {
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
    <div className="stack" style={{ paddingBottom: 20 }}>
      <Saluto scheda={scheda} />
      <Prossime lezioni={lezioni} />
      <Presenze presenze={presenze} />
      <InRegola scheda={scheda} />
      <Ricevute ricevute={ricevute} />
      <Segreteria />
    </div>
  )
}

function Saluto({ scheda }: { scheda: SchedaIscritto }) {
  const oggi = chiaveGiorno(new Date())
  const x = avvisi(scheda, oggi)
  return (
    <section className="pad stack" style={{ gap: 10, paddingTop: 6 }}>
      <span className="ob mio-nome">Ciao {scheda.nome}</span>
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

function Presenze({ presenze }: { presenze: MiaPresenza[] }) {
  const [tutte, setTutte] = useState(false)
  const c = contoPresenze(presenze)
  const viste = tutte ? presenze : presenze.slice(0, 5)
  return (
    <section>
      <Titoletto conto={c.dovute ? `${c.presenti}/${c.dovute}` : undefined}>LE TUE PRESENZE</Titoletto>
      <div className="pad stack" style={{ gap: 8, paddingBottom: 12 }}>
        {presenze.length === 0 ? (
          <Dettaglio>Nessuna lezione negli ultimi {INDIETRO} giorni.</Dettaglio>
        ) : (
          <>
            <Dettaglio>
              Negli ultimi {INDIETRO} giorni: presente a {c.presenti} {c.presenti === 1 ? 'lezione' : 'lezioni'} su {c.dovute}.
            </Dettaglio>
            <ul className="card stack mie-presenze">
              {viste.map((p) => {
                const [segno, detto] = p.stato ? SEGNI[p.stato] : ['·', 'NON SEGNATO']
                return (
                  <li key={p.sessioneId} className="row mia-presenza" data-stato={p.stato ?? 'nessuno'}>
                    <span className="num mia-presenza-segno" aria-hidden="true">
                      {segno}
                    </span>
                    <span className="stack grow" style={{ gap: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 600 }}>{p.corso}</span>
                      <span style={{ fontSize: 13, color: 'var(--dim)' }}>
                        {giornoPerEsteso(chiaveGiorno(new Date(p.inizio)))} · {oraDi(p.inizio)}
                      </span>
                    </span>
                    <span className="num mia-presenza-detto">{detto}</span>
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
  const paga = comePaga(scheda.pagamento, oggi)
  const certTesto = {
    manca: 'Non risulta: senza, in sala non si entra.',
    scaduto: `Scaduto il ${data(scheda.certificato.scade ?? '')}.`,
    in_scadenza: `Vale fino al ${data(scheda.certificato.scade ?? '')}: scade fra poco.`,
    valido: `Vale fino al ${data(scheda.certificato.scade ?? '')}.`,
  }[cert]
  const pagaTesto = {
    da_pagare: 'Non risulta pagata.',
    in_parte: `Pagata in parte${scheda.pagamento.nota ? `: ${scheda.pagamento.nota.toLowerCase()}` : ''}.`,
    pagato: scheda.pagamento.fino ? `Pagata fino al ${data(scheda.pagamento.fino)}.` : 'Pagata.',
    scaduto: `Valeva fino al ${data(scheda.pagamento.fino ?? '')}: è da rinnovare.`,
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
