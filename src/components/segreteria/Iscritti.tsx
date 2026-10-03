import { useEffect, useState } from 'react'
import type { Destinazione } from './Segreteria'
import type { Anagrafica, ComeCertificato, ComePaga, CorsoSeg, DatiPersona, DatiSegreteria, Frequenza, PersonaSeg, Timbro, Tono } from '../../lib/segreteria'
import { comeCertificato, comePaga, cosaNonVaAnagrafica, inCorso, pagamentoDi, paroleInRegola, pulisciAnagrafica, tastoPrincipale, timbriScheda } from '../../lib/segreteria'
import { VALIDITA } from '../../lib/costi'
import { cfTornaColNome, cfTornaConLaData, cfValido } from '../../lib/codiceFiscale'
import { chiaveGiorno, giornoPerEsteso, oraDi } from '../../lib/sala'
import { Bozza, chiedi, Campo, useBozza, dataLunga, Guaio, lasciare, messaggio, Riga, SchedaPiena, Testa, useAvviso, useCarica, useOrdina } from './comune'
import { NuovaRicevuta, RicevuteIscritto } from './Ricevute'
import { abbonamentiDalleRicevute, doveVaLoSconto, cosaNonVaNucleo, SCONTO_FAMIGLIA } from '../../lib/nucleo'
import { euro, QUOTA } from '../../lib/ricevute'
import { altraDellaCoppia, campiDiversi, coppieDoppioni, possibiliDoppioni, segnateCon, stessoCognome, type IndiziDoppioni } from '../../lib/doppioni'

/** «Viene poco»: meno di metà delle lezioni, su almeno tre che ha avuto. */
const vienePoco = (f?: Frequenza) => !!f && f.dovute >= 3 && f.presenti / f.dovute < 0.5

/** Il certificato da sistemare: manca, è scaduto o scade entro un mese. */
// Certificato e quota si cercano fra chi è attivo: chi ha smesso non li deve portare. Gli stessi conti di DA FARE.
const senzaCertificatoValido = (p: PersonaSeg, oggi: string) => p.attiva && ['manca', 'scaduto'].includes(comeCertificato(p.certificato, oggi))
const certificatoInScadenza = (p: PersonaSeg, oggi: string) => p.attiva && comeCertificato(p.certificato, oggi) === 'in_scadenza'
const daPagare = (p: PersonaSeg, oggi: string) => p.attiva && comePaga(p, oggi) !== 'pagato'
/** Quanto non è in regola, per ordinare: i guai più grossi prima. */
const GUAIO_CERTIFICATO: Record<ComeCertificato, number> = { manca: 2, scaduto: 2, in_scadenza: 1, valido: 0 }
const GUAIO_PAGA: Record<ComePaga, number> = { da_pagare: 2, scaduto: 2, in_parte: 1, pagato: 0 }

function Bollino({ tono, children }: { tono: Tono; children: string }) {
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
export function Iscritti({
  d,
  scelta,
  nuovo = false,
  onScelta,
  onNuovo,
  filtroIniziale,
}: {
  d: DatiSegreteria
  /** La scheda aperta: sta nell'indirizzo, e la apre e chiude la segreteria. */
  scelta?: string
  /** Il modulo del nuovo iscritto: sta nell'indirizzo anche lui, così Indietro lo chiude. */
  nuovo?: boolean
  /** `push` è un passo per Indietro, `replace` corregge l'indirizzo di adesso. */
  onScelta: (id: string | null, passo: 'push' | 'replace') => void
  onNuovo: () => void
  filtroIniziale?: Destinazione['filtro']
}) {
  const persone = useCarica(() => d.persone(), [d])
  const corsi = useCarica(() => d.corsi(), [d])
  const freq = useCarica(() => d.frequenze(), [d])
  const indizi = useCarica(() => d.indiziDoppioni(), [d])
  const [cerca, setCerca] = useState('')
  const [corso, setCorso] = useState('')
  const [senzaEmail, setSenzaEmail] = useState(false)
  const [poco, setPoco] = useState(false)
  const [certificato, setCertificato] = useState(filtroIniziale === 'certificato')
  const [scadenza, setScadenza] = useState(filtroIniziale === 'scadenza')
  const [pagare, setPagare] = useState(filtroIniziale === 'pagare')
  const [senzaDocumento, setSenzaDocumento] = useState(false)
  const [daStampare, setDaStampare] = useState(filtroIniziale === 'stampare')
  const [doppi, setDoppi] = useState(false)
  // Da una coppia di possibili doppioni: la scheda si apre con UNISCI già sull'altra.
  const [unisciCon, setUnisciCon] = useState<string | null>(null)
  const { avviso, avvisa, fai } = useAvviso()
  const oggi = chiaveGiorno(new Date())

  const perId = new Map((corsi.dato ?? []).map((c) => [c.id, c]))
  const attivi = (corsi.dato ?? []).filter((c) => c.attivo).sort((a, b) => a.nome.localeCompare(b.nome, 'it'))
  const tutti = [...(persone.dato ?? [])].sort(
    (a, b) => Number(b.attiva) - Number(a.attiva) || a.cognome.localeCompare(b.cognome, 'it') || a.nome.localeCompare(b.nome, 'it'),
  )
  const ago = cerca.trim().toLowerCase()
  const stampare = tutti.filter((p) => p.certificato.conFile).length
  // Stampati tutti, il filtro si spegne da sé.
  const soloStampare = daStampare && stampare > 0
  const coppie = indizi.dato ? coppieDoppioni(tutti, indizi.dato) : []
  // Unite o segnate tutte, il filtro si spegne da sé.
  const soloDoppi = doppi && coppie.length > 0
  const trovati = tutti.filter(
    (p) =>
      (!ago || `${p.cognome} ${p.nome} ${p.nome} ${p.cognome} ${p.email ?? ''}`.toLowerCase().includes(ago)) &&
      (!corso || p.iscrizioni.some((i) => i.corsoId === corso && inCorso(i, oggi))) &&
      (!senzaEmail || !p.email) &&
      (!poco || vienePoco(freq.dato?.get(p.id))) &&
      (!certificato || senzaCertificatoValido(p, oggi)) &&
      (!scadenza || certificatoInScadenza(p, oggi)) &&
      (!pagare || daPagare(p, oggi)) &&
      (!senzaDocumento || !p.documento) &&
      (!soloStampare || p.certificato.conFile),
  )
  const suoiCorsi = (p: PersonaSeg) => p.iscrizioni.filter((i) => inCorso(i, oggi)).map((i) => perId.get(i.corsoId)?.nome).filter(Boolean)
  const { ordina, colonna } = useOrdina<PersonaSeg, 'nome' | 'corsi' | 'contatto' | 'regola' | 'frequenza'>({
    nome: (p) => `${p.cognome} ${p.nome}`,
    corsi: (p) => suoiCorsi(p).join(', '),
    contatto: (p) => p.telefono ?? p.email,
    regola: (p) => GUAIO_CERTIFICATO[comeCertificato(p.certificato, oggi)] + GUAIO_PAGA[comePaga(p, oggi)],
    frequenza: (p) => {
      const f = freq.dato?.get(p.id)
      return f && f.dovute ? f.presenti / f.dovute : null
    },
  })
  const attiveOra = tutti.filter((p) => p.attiva)
  const senzaCertificato = attiveOra.filter((p) => senzaCertificatoValido(p, oggi)).length
  const inScadenza = attiveOra.filter((p) => certificatoInScadenza(p, oggi)).length
  const nonPagato = attiveOra.filter((p) => daPagare(p, oggi)).length
  const persona = nuovo ? null : (tutti.find((p) => p.id === scelta) ?? null)
  const ricarica = () => Promise.all([persone.ricarica(), freq.ricarica(), indizi.ricarica()])

  const chiudi = () => {
    setUnisciCon(null)
    if (scelta || nuovo) onScelta(null, 'push')
  }
  // ← ISCRITTI con un iscritto nuovo o una ricevuta a metà: la stessa domanda del menu e di Indietro.
  const torna = async () => {
    if (await lasciare()) chiudi()
  }

  // Una scheda di qualcuno che non c'è più (un link vecchio, un'altra
  // finestra): si torna all'elenco e lo si dice. Solo quando l'elenco arriva:
  // un iscritto appena salvato non è ancora in quello di prima.
  useEffect(() => {
    if (!scelta || !persone.dato || persone.dato.some((p) => p.id === scelta)) return
    avvisa('Quell’iscritto non c’è più')
    onScelta(null, 'replace')
    // Solo all'arrivo dell'elenco: aprire una scheda non è un motivo per guardare.
  }, [persone.dato])

  return (
    <>
      {nuovo ? (
        <SchedaPiena etichetta="Nuovo iscritto" torna="ISCRITTI" onTorna={torna}>
          <Bozza>
          <Nuovo
            d={d}
            corsi={attivi}
            fai={fai}
            onLasciaStare={chiudi}
            onSalvato={(id) => {
              // Al posto del modulo: Indietro dalla scheda nuova torna all'elenco, non a un modulo vuoto.
              onScelta(id, 'replace')
              void ricarica()
            }}
          />
          </Bozza>
        </SchedaPiena>
      ) : persona ? (
        <SchedaPiena key={persona.id} etichetta={`Scheda di ${persona.nome} ${persona.cognome}`} torna="ISCRITTI" onTorna={torna}>
          <Scheda
            d={d}
            p={persona}
            tutti={tutti}
            corsi={perId}
            attivi={attivi}
            f={freq.dato?.get(persona.id)}
            fai={fai}
            onCambiato={() => void ricarica()}
            onApri={(id) => {
              setUnisciCon(null)
              onScelta(id, 'push')
            }}
            unisciCon={unisciCon ?? undefined}
            doppio={altraDellaCoppia(coppie, persona.id)}
            nonDoppioni={indizi.dato ? segnateCon(indizi.dato, persona.id, tutti) : []}
          />
        </SchedaPiena>
      ) : null}

      {/* L'elenco resta montato sotto la scheda, con la ricerca e i filtri di prima. */}
      <div className="stack" style={{ gap: 18 }} hidden={!!(nuovo || persona)}>
        <Testa
          titolo="ISCRITTI"
          sotto={`${attiveOra.length} persone attive · ${senzaCertificato ? `${senzaCertificato} senza certificato valido` : 'tutti col certificato'}${inScadenza ? ` · ${inScadenza} in scadenza` : ''} · ${nonPagato ? `${nonPagato} da pagare` : 'tutti in regola coi pagamenti'}.${
            stampare === 1 ? ' Un certificato caricato nell’app da stampare e cancellare.' : stampare ? ` ${stampare} certificati caricati nell’app da stampare e cancellare.` : ''
          }`}
        >
          <button type="button" className="sg-btn sg-btn-pieno" onClick={onNuovo}>
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
            SENZA CERTIFICATO VALIDO
          </button>
          <button type="button" className="num sg-chip" aria-pressed={scadenza} onClick={() => setScadenza(!scadenza)}>
            CERTIFICATO IN SCADENZA
          </button>
          <button type="button" className="num sg-chip" aria-pressed={pagare} onClick={() => setPagare(!pagare)}>
            DA PAGARE
          </button>
          <button type="button" className="num sg-chip" aria-pressed={senzaDocumento} onClick={() => setSenzaDocumento(!senzaDocumento)}>
            SENZA DOCUMENTO
          </button>
          {stampare > 0 && (
            <button type="button" className="num sg-chip" aria-pressed={soloStampare} onClick={() => setDaStampare(!soloStampare)}>
              CERTIFICATI DA STAMPARE
            </button>
          )}
          {coppie.length > 0 && (
            <button type="button" className="num sg-chip" aria-pressed={soloDoppi} onClick={() => setDoppi(!soloDoppi)}>
              POSSIBILI DOPPIONI {coppie.length}
            </button>
          )}
        </div>

        {persone.guaio && <Guaio testo={persone.guaio} />}

        {soloDoppi && indizi.dato ? (
          <CoppieDoppioni
            // Ricerca e filtri valgono anche qui: resta una coppia se una delle due passa.
            coppie={coppie.filter((c) => c.some((x) => trovati.includes(x)))}
            indizi={indizi.dato}
            suoiCorsi={suoiCorsi}
            onUnisci={(a, b) => {
              setUnisciCon(b)
              onScelta(a, 'push')
            }}
            onNonDoppioni={async (a, b) => {
              const nome = (id: string) => {
                const x = tutti.find((y) => y.id === id)
                return x ? `${x.cognome} ${x.nome}` : ''
              }
              if (!(await chiedi(`${nome(a)} e ${nome(b)} non sono la stessa persona? La coppia non compare più fra i possibili doppioni.`, 'SÌ, NON SONO DOPPIONI'))) return
              // Toccato per sbaglio ce se ne accorge subito: ANNULLA nell'avviso, senza aprire la scheda.
              void fai(
                () => d.segnaNonDoppioni(a, b),
                undefined,
                async () => {
                  await indizi.ricarica()
                  avvisa('Segnati: non sono doppioni', false, {
                    etichetta: 'ANNULLA',
                    fa: () => void fai(() => d.togliNonDoppioni(a, b), 'Tornati fra i possibili doppioni', () => indizi.ricarica()),
                  })
                },
              )
            }}
          />
        ) : (
        <div role="table" aria-label="Iscritti" className="sg-tabella">
          <div role="row" className="sg-lista-testa sg-riga-iscritto">
            {colonna('nome', 'NOME')}
            {colonna('corsi', 'CORSI')}
            {colonna('contatto', 'CONTATTO')}
            {colonna('regola', 'IN REGOLA', { numeri: true })}
            {colonna('frequenza', '30 GIORNI', { numeri: true, destra: true })}
          </div>
          <div className="sg-tabella-corpo">
            {persone.dato === null && !persone.guaio && <p className="sg-sotto" style={{ padding: '12px 14px' }}>Sto leggendo gli iscritti…</p>}
            {persone.dato !== null && trovati.length === 0 && <p className="sg-sotto" style={{ padding: '12px 14px' }}>Nessuno corrisponde alla ricerca.</p>}
            {ordina(trovati).map((p) => {
              const f = freq.dato?.get(p.id)
              const suoi = suoiCorsi(p)
              return (
                // Una riga vera della tabella, che si clicca tutta; dalla tastiera e per chi legge lo schermo c'è il tasto sul nome.
                <div
                  key={p.id}
                  role="row"
                  className="sg-riga-iscritto sg-iscritto"
                  data-scelto={!nuovo && scelta === p.id}
                  data-spento={!p.attiva}
                  onClick={() => {
                    setUnisciCon(null)
                    onScelta(p.id, 'push')
                  }}
                >
                  <span role="cell" style={{ fontSize: 15, fontWeight: 600 }}>
                    <button type="button" className="sg-riga-apri" aria-current={!nuovo && scelta === p.id ? 'true' : undefined}>
                      {p.cognome} {p.nome}
                    </button>
                    {p.certificato.conFile && <span className="num sg-tag" style={{ marginLeft: 8 }}>DA STAMPARE</span>}
                  </span>
                  <span role="cell" style={{ fontSize: 13, color: 'var(--sec)' }}>{suoi.join(', ') || '—'}</span>
                  <span role="cell" style={{ fontSize: 13, color: p.email || p.telefono ? 'var(--sec)' : 'var(--rosso-testo)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.telefono ?? p.email ?? 'nessun contatto'}
                  </span>
                  <span role="cell" className="sg-in-regola">
                    {paroleInRegola(p, oggi).map((b) => (
                      <Bollino key={b.parola} tono={b.tono}>{b.parola}</Bollino>
                    ))}
                  </span>
                  <span role="cell" className="num" style={{ fontSize: 16, fontWeight: 700, textAlign: 'right', color: vienePoco(f) ? 'var(--giallo-testo)' : 'var(--text)' }}>
                    {f ? `${f.presenti}/${f.dovute}` : '—'}
                  </span>
                </div>
              )
            })}
          </div>
          <span className="sg-sotto" style={{ fontSize: 12, padding: '10px 14px 0' }}>
            {trovati.length === tutti.length ? `${tutti.length} in elenco` : `${trovati.length} di ${tutti.length}`}
            {' · '}
            30 GIORNI: presenze su lezioni avute, senza i giustificati
          </span>
        </div>
        )}

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
        <button type="button" className="sg-btn sg-btn-pieno grow" disabled={!b.nome.trim() || !b.cognome.trim()} onClick={salva}>
          SALVA
        </button>
      </div>
    </>
  )
}

function Scheda({
  d,
  p,
  tutti,
  corsi,
  attivi,
  f,
  fai,
  onCambiato,
  onApri,
  unisciCon,
  doppio,
  nonDoppioni,
}: {
  d: DatiSegreteria
  p: PersonaSeg
  /** Tutti gli iscritti, per il nucleo familiare. */
  tutti: PersonaSeg[]
  corsi: Map<string, CorsoSeg>
  attivi: CorsoSeg[]
  f?: Frequenza
  fai: Fai
  onCambiato: () => void
  /** Apre la scheda di un'altra persona: una del nucleo. */
  onApri: (personaId: string) => void
  /** Aperta da una coppia di possibili doppioni: UNISCI già aperto su quest'altra. */
  unisciCon?: string
  /** L'altra scheda, se questa è in una sola coppia di possibili doppioni. */
  doppio?: string
  /** Le schede segnate «non sono doppioni» con questa: si tolgono da qui, se segnate per sbaglio. */
  nonDoppioni: PersonaSeg[]
}) {
  const oggi = chiaveGiorno(new Date())
  const [modifica, setModifica] = useState<DatiPersona | null>(null)
  // Aperta la modifica, uscire dal menu chiede prima di perderla.
  useBozza(!!modifica)
  const [daAggiungere, setDaAggiungere] = useState('')
  const [pagando, setPagando] = useState(false)
  const [unendo, setUnendo] = useState(!!unisciCon)
  const [togliendo, setTogliendo] = useState(false)
  // Dopo una ricevuta nuova l'elenco delle ricevute si rilegge da capo.
  const [giroRicevute, setGiroRicevute] = useState(0)
  const storico = useCarica(() => d.storico(p.id, 12), [d, p.id, p.iscrizioni.length])
  const correnti = p.iscrizioni.filter((i) => inCorso(i, oggi))
  const liberi = attivi.filter((c) => !correnti.some((i) => i.corsoId === c.id))
  const venuto = storico.dato?.filter((x) => x.stato === 'presente').length ?? 0
  // Gli altri del nucleo familiare, per lo sconto famiglia della ricevuta.
  const titolare = p.nucleo ? tutti.find((x) => x.id === p.nucleo) : p
  const nucleo = titolare ? [titolare, ...tutti.filter((x) => x.nucleo === titolare.id && x.attiva)].filter((x) => x.id !== p.id) : []

  return (
    <>
      <div className="stack" style={{ gap: 4 }}>
        <h2 className="ob" style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1 }}>
          {`${p.cognome} ${p.nome}`.toUpperCase()}
        </h2>
        <span style={{ fontSize: 13, color: 'var(--dim)' }}>{`In elenco dal ${dataLunga(p.creataIl)} · nessun accesso`}</span>
      </div>
      {/* Mentre si unisce o si fa una ricevuta le sezioni non ci sono: i timbri porterebbero a niente. */}
      {!unendo && !pagando && <Timbri p={p} oggi={oggi} />}

      {unendo ? (
        <UnisciDoppione
          d={d}
          p={p}
          tutti={tutti}
          altraIniziale={unisciCon ?? doppio}
          fai={fai}
          onLasciaStare={() => setUnendo(false)}
          onUnite={(resta) => {
            setUnendo(false)
            onCambiato()
            onApri(resta)
          }}
        />
      ) : pagando ? (
        <Bozza>
        <NuovaRicevuta
          d={d}
          p={p}
          nucleo={nucleo}
          corsi={correnti.flatMap((i) => { const c = corsi.get(i.corsoId); return c ? [{ id: c.id, nome: c.nome }] : [] })}
          fai={fai}
          onLasciaStare={() => setPagando(false)}
          onFatta={() => {
            setPagando(false)
            setGiroRicevute((g) => g + 1)
            onCambiato()
          }}
        />
        </Bozza>
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

          <DatiAnagrafici key={`a-${p.id}`} d={d} p={p} fai={fai} onCambiato={onCambiato} />
          <div id="sez-certificato">
            <Certificato key={`c-${p.id}`} d={d} p={p} fai={fai} onCambiato={onCambiato} />
          </div>
          <div id="sez-documento">
            <Documento d={d} p={p} fai={fai} onCambiato={onCambiato} />
          </div>
          <div id="sez-quota" className="stack" style={{ gap: 20 }}>
            <Pagamento key={`p-${p.id}-${p.pagamento.stato}-${p.pagamento.fino ?? ''}-${giroRicevute}-${(p.quote ?? []).length}`} d={d} p={p} fai={fai} onCambiato={onCambiato} />
            <RicevuteIscritto key={`r-${p.id}-${giroRicevute}`} d={d} p={p} fai={fai} onNuova={() => setPagando(true)} onCambiato={onCambiato} />
          </div>
          {d.modo === 'prova' && <NucleoFamiliare d={d} p={p} tutti={tutti} fai={fai} onCambiato={onCambiato} onApri={onApri} />}
          {nonDoppioni.length > 0 && (
            <div className="stack" style={{ gap: 8 }}>
              <Riga titolo="NON SONO DOPPIONI" />
              <span className="sg-sotto">Non è la stessa persona di queste schede. Segnato per sbaglio? TOGLI, e se sembrano la stessa persona tornano fra i possibili doppioni.</span>
              {nonDoppioni.map((x) => (
                <div key={x.id} className="sg-iscrizione">
                  <span className="stack grow" style={{ minWidth: 0 }}>
                    <button type="button" className="sg-link" style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', textAlign: 'left' }} onClick={() => onApri(x.id)}>
                      {x.cognome} {x.nome}
                    </button>
                    <span style={{ fontSize: 12, color: 'var(--dim)' }}>{[x.telefono ?? x.email, x.attiva ? '' : 'disattivata'].filter(Boolean).join(' · ') || 'nessun contatto'}</span>
                  </span>
                  <button
                    type="button"
                    className="sg-btn sg-btn-linea"
                    aria-label={`Togli il segno «non sono doppioni» con ${x.cognome} ${x.nome}`}
                    disabled={togliendo}
                    onClick={async () => {
                      // Fermo finché la scheda non si rilegge: tolta la riga, il secondo clic di un doppio clic finirebbe su MODIFICA.
                      setTogliendo(true)
                      await fai(() => d.togliNonDoppioni(p.id, x.id), 'Tolto: se sembrano la stessa persona tornano fra i possibili doppioni', onCambiato)
                      setTimeout(() => setTogliendo(false), 400)
                    }}
                  >
                    TOGLI
                  </button>
                </div>
              ))}
            </div>
          )}
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
                      onClick={async () => {
                        if ((await chiedi(`${p.nome} smette di venire a ${c?.nome}? Da domani non è più nell'appello; il registro resta.`, 'TERMINA L’ISCRIZIONE'))) {
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
            {/* Il segno dentro, non solo il colore: ✓ presente, ✕ assente, G giustificato. Per chi legge lo schermo, la frase intera. */}
            <ul className="sg-storico" aria-label="Ultime 12 lezioni">
              {storico.dato?.map((x) => {
                const detto = `${x.corso} · ${giornoPerEsteso(chiaveGiorno(new Date(x.inizio)))} ${oraDi(x.inizio)} · ${x.stato ?? 'non segnato'}`
                return (
                  <li key={x.sessioneId} className="sg-quadretto" data-stato={x.stato ?? 'niente'} title={detto}>
                    <span aria-hidden="true">{x.stato === 'presente' ? '✓' : x.stato === 'assente' ? '✕' : x.stato === 'giustificato' ? 'G' : ''}</span>
                    <span className="vh">{detto}</span>
                  </li>
                )
              })}
            </ul>
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
              className="sg-btn sg-btn-pieno grow"
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
              onClick={async () => {
                if (p.attiva && !(await chiedi(`Disattivare ${p.nome} ${p.cognome}? Sparisce dagli appelli e dal tablet; si può riattivare.`, 'DISATTIVA LA SCHEDA'))) return
                void fai(() => d.attivaPersona(p.id, !p.attiva), p.attiva ? 'Scheda disattivata' : 'Scheda riattivata', onCambiato)
              }}
            >
              {p.attiva ? 'DISATTIVA' : 'RIATTIVA'}
            </button>
            <button type="button" className="sg-btn sg-btn-linea grow" onClick={() => setUnendo(true)}>
              UNISCI…
            </button>
          </>
        )}
      </div>
      </>
      )}
    </>
  )
}

/** Va alla sua sezione e mette il fuoco sul tasto che serve, o sul titolo. */
function vaiA(id: string) {
  const sez = document.getElementById(id)
  if (!sez) return
  const h = sez.querySelector<HTMLElement>('h3')
  h?.setAttribute('tabindex', '-1')
  const dove = sez.querySelector<HTMLElement>('[data-primo]:not(:disabled)') ?? h
  sez.scrollIntoView({ block: 'start' })
  dove?.focus({ preventScroll: true })
}

/**
 * In cima alla scheda: certificato, quota e documento in un colpo d'occhio,
 * con le parole dell'elenco (`timbriScheda`). Ognuno porta alla sua sezione.
 */
function Timbri({ p, oggi }: { p: PersonaSeg; oggi: string }) {
  const t = timbriScheda(p, oggi)
  const uno = (titolo: string, x: Timbro, id: string, piccolo?: boolean) => (
    <button type="button" className="sg-timbro" data-tono={x.tono} data-piccolo={piccolo} onClick={() => vaiA(id)}>
      <span className="sg-timbro-titolo">{titolo}</span>
      <span className="sg-timbro-parola">{x.parola}</span>
      {x.righe.map((r) => (
        <span key={r.testo} className="sg-timbro-riga" data-tono={r.tono}>
          {r.testo}
        </span>
      ))}
    </button>
  )
  return (
    <div className="stack" style={{ gap: 12 }}>
      {t.disattivata && (
        <p className="sg-timbri-spenta">
          <strong>DISATTIVATA</strong> Non è negli appelli né sul tablet. Per rimetterla: RIATTIVA, in fondo alla scheda.
        </p>
      )}
      <div className="sg-timbri">
        {uno('CERTIFICATO MEDICO', t.certificato, 'sez-certificato')}
        {uno('QUOTA', t.quota, 'sez-quota')}
        {uno('DOCUMENTO D’IDENTITÀ', t.documento, 'sez-documento', true)}
      </div>
    </div>
  )
}

/**
 * I possibili doppioni (`coppieDoppioni`): ogni coppia con quello che serve
 * per decidere senza aprire le schede, UNISCI… e NON SONO DOPPIONI.
 */
function CoppieDoppioni({
  coppie,
  indizi,
  suoiCorsi,
  onUnisci,
  onNonDoppioni,
}: {
  coppie: [PersonaSeg, PersonaSeg][]
  indizi: IndiziDoppioni
  suoiCorsi: (p: PersonaSeg) => (string | undefined)[]
  onUnisci: (a: string, b: string) => void
  onNonDoppioni: (a: string, b: string) => void
}) {
  const riga = (x: PersonaSeg) => (
    <div className="stack" style={{ gap: 2, minWidth: 0 }}>
      <span style={{ fontSize: 15, fontWeight: 600 }}>
        {x.cognome} {x.nome}
        {!x.attiva && <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--dim)' }}> · disattivata</span>}
      </span>
      <span style={{ fontSize: 13, color: 'var(--dim)' }}>
        {[
          indizi.nascite[x.id] && `nascita ${dataLunga(indizi.nascite[x.id])}`,
          indizi.codiciFiscali[x.id],
          x.telefono ?? x.email,
          suoiCorsi(x).join(', '),
        ]
          .filter(Boolean)
          .join(' · ') || 'nessun altro dato'}
      </span>
    </div>
  )
  return (
    <div className="stack" style={{ gap: 12 }}>
      <span className="sg-sotto">Schede che sembrano la stessa persona: lo stesso nome scritto in un altro modo, o lo stesso codice fiscale.</span>
      {coppie.length === 0 && <p className="sg-sotto">Nessuna coppia corrisponde alla ricerca.</p>}
      {coppie.map(([a, b]) => (
        <div key={`${a.id}-${b.id}`} className="card stack" style={{ padding: 14, gap: 10 }}>
          {riga(a)}
          <div style={{ borderTop: '2px solid var(--line)', paddingTop: 10 }}>{riga(b)}</div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="sg-btn sg-btn-pieno" onClick={() => onUnisci(a.id, b.id)}>
              UNISCI…
            </button>
            <button type="button" className="sg-btn sg-btn-linea" onClick={() => onNonDoppioni(a.id, b.id)}>
              NON SONO DOPPIONI
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Unire un doppione (`doppioni.ts`, `29-unisci-doppioni.sql`): si sceglie
 * l'altra scheda, si vede cosa passa e cosa non torna, si sceglie quale
 * resta, e una conferma. Non si torna indietro.
 */
function UnisciDoppione({
  d,
  p,
  tutti,
  altraIniziale,
  fai,
  onLasciaStare,
  onUnite,
}: {
  d: DatiSegreteria
  p: PersonaSeg
  tutti: PersonaSeg[]
  /** L'altra già scelta: un possibile doppione. */
  altraIniziale?: string
  fai: Fai
  onLasciaStare: () => void
  onUnite: (resta: string) => void
}) {
  const [altra, setAltra] = useState(altraIniziale ?? '')
  const [scambiate, setScambiate] = useState(false)
  const candidati = possibiliDoppioni(p, tutti)
  const lei = tutti.find((x) => x.id === altra)
  const [resta, via] = lei && scambiate ? [lei, p] : [p, lei]
  const passa = useCarica(async () => (resta && via ? d.anteprimaUnione(resta.id, via.id) : null), [d, resta?.id, via?.id])
  const nome = (x: PersonaSeg) => `${x.cognome} ${x.nome}`
  const quanto = (n: { presenze: number; prove: number; iscrizioni: number; ricevute: number }) => {
    const tutte: [number, string, string][] = [
      [n.presenze, 'presenza', 'presenze'],
      [n.prove, 'prova', 'prove'],
      [n.iscrizioni, 'iscrizione', 'iscrizioni'],
      [n.ricevute, 'ricevuta', 'ricevute'],
    ]
    const voci = tutte
      .filter(([q]) => q > 0)
      .map(([q, uno, tanti]) => `${q} ${q === 1 ? uno : tanti}`)
    return voci.length ? `Passano ${voci.join(', ')}.` : 'L’altra scheda non ha presenze, prove, iscrizioni né ricevute.'
  }
  const colonna = (t: string, x: PersonaSeg) => (
    <div className="stack" style={{ gap: 2, minWidth: 0 }}>
      <span className="sg-etichetta">{t}</span>
      <span style={{ fontSize: 15, fontWeight: 600 }}>{nome(x)}</span>
      <span style={{ fontSize: 12, color: 'var(--dim)' }}>{x.attiva ? 'Attiva' : 'Disattivata'}</span>
    </div>
  )
  const dove = (x: PersonaSeg) => [x.email, x.telefono, x.attiva ? '' : 'disattivata'].filter(Boolean).join(' · ')

  return (
    <div className="stack" style={{ gap: 16, maxWidth: 640 }}>
      <Riga titolo="UNISCI UN DOPPIONE" />
      <span className="sg-sotto">Due schede della stessa persona diventano una: tutto passa a quella che resta.</span>
      <span className="sg-sotto">Unisci dopo gli appelli di oggi: uno fatto senza rete, arrivato tardi, si perderebbe.</span>
      <Campo id="u-altra" etichetta="L’ALTRA SCHEDA">
        <select id="u-altra" className="sg-campo" value={altra} onChange={(e) => {
            setAltra(e.target.value)
            setScambiate(false)
          }}>
          <option value="">Scegli…</option>
          {[
            ['STESSO COGNOME', candidati.filter((x) => stessoCognome(x, p))],
            ['TUTTI GLI ALTRI', candidati.filter((x) => !stessoCognome(x, p))],
          ].map(([gruppo, chi]) =>
            typeof gruppo === 'string' && Array.isArray(chi) && chi.length > 0 ? (
              <optgroup key={gruppo} label={gruppo}>
                {chi.map((x) => (
                  <option key={x.id} value={x.id}>
                    {nome(x)}
                    {dove(x) && ` · ${dove(x)}`}
                  </option>
                ))}
              </optgroup>
            ) : null,
          )}
        </select>
      </Campo>

      {resta && via && (
        <>
          <div className="sg-due">
            {colonna('RESTA', resta)}
            {colonna('SE NE VA', via)}
          </div>
          <button type="button" className="sg-btn sg-btn-linea" style={{ alignSelf: 'flex-start' }} onClick={() => setScambiate((v) => !v)}>
            TIENI L’ALTRA
          </button>
          {campiDiversi(resta, via).map((c) => (
            <span key={c.campo} style={{ fontSize: 14 }}>
              {c.campo}: <b>{c.resta || c.via}</b>
              {c.resta && c.via && <span style={{ color: 'var(--dim)' }}> (non «{c.via}»)</span>}
              {!c.resta && <span style={{ color: 'var(--dim)' }}> (dall’altra)</span>}
            </span>
          ))}
          {passa.guaio ? (
            <span style={{ fontSize: 14, color: 'var(--rosso-testo)' }}>{passa.guaio}</span>
          ) : !passa.dato ? (
            <span className="sg-sotto">Conto cosa passa…</span>
          ) : (
            (
              <span className="sg-sotto">
                {quanto(passa.dato)} Una presenza per lezione e un’iscrizione per corso; del certificato e della quota, la scadenza più lontana. Resta attiva
                se una delle due lo era.
              </span>
            )
          )}
        </>
      )}

      <div className="sg-scheda-piede">
        <button type="button" className="sg-btn sg-btn-linea grow" onClick={onLasciaStare}>
          LASCIA STARE
        </button>
        <button
          type="button"
          className="sg-btn sg-btn-rosso grow"
          disabled={!resta || !via || !passa.dato}
          onClick={async () => {
            if (!resta || !via) return
            if (!(await chiedi(`Unire ${nome(via)} in ${nome(resta)}? La scheda di ${nome(via)} se ne va, e non si torna indietro.`, 'UNISCI', { pericolo: true }))) return
            void fai(() => d.unisciPersone(resta.id, via.id), 'Schede unite', () => onUnite(resta.id))
          }}
        >
          UNISCI
        </button>
      </div>
    </div>
  )
}

/**
 * Il nucleo familiare (vedi `nucleo.ts`): di chi è, chi c'è, e dove va lo
 * sconto famiglia, dalle ricevute del nucleo. Dalla scheda del titolare (o di
 * chi non è in un nucleo) si aggiunge una persona; da quella di un'altra la
 * si toglie, o la si fa titolare. Per ora solo in prova: il database non lo
 * tiene ancora, e la sezione non c'è.
 */
function NucleoFamiliare({
  d,
  p,
  tutti,
  fai,
  onCambiato,
  onApri,
}: {
  d: DatiSegreteria
  p: PersonaSeg
  tutti: PersonaSeg[]
  fai: Fai
  onCambiato: () => void
  onApri: (personaId: string) => void
}) {
  const [daAggiungere, setDaAggiungere] = useState('')
  const titolare = p.nucleo ? tutti.find((x) => x.id === p.nucleo) : p
  const membri = titolare ? tutti.filter((x) => x.nucleo === titolare.id && x.attiva) : []
  const nucleo = titolare ? [titolare, ...membri] : [p]
  const ids = nucleo.map((x) => x.id).join()
  const ricevute = useCarica(async () => (await Promise.all(nucleo.map((x) => d.ricevute(x.id)))).flat(), [d, ids])
  const nomeDi = (id: string) => {
    const x = tutti.find((y) => y.id === id)
    return x ? `${x.nome} ${x.cognome}` : ''
  }
  const annuali = abbonamentiDalleRicevute(ricevute.dato ?? [], nomeDi)
  const minimo = doveVaLoSconto([], annuali)
  // Chi si può aggiungere: chi può entrare secondo le regole, prima chi ha lo stesso cognome.
  const candidati = p.nucleo
    ? []
    : tutti
        .filter((x) => !cosaNonVaNucleo(tutti, x.id, p.id))
        .sort((x, y) => Number(y.cognome === p.cognome) - Number(x.cognome === p.cognome) || x.cognome.localeCompare(y.cognome, 'it') || x.nome.localeCompare(y.nome, 'it'))
  const persona = (x: PersonaSeg, ruolo: string) => (
    <div key={x.id} className="sg-iscrizione">
      <span className="stack grow" style={{ minWidth: 0 }}>
        <button type="button" className="sg-link" style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }} onClick={() => onApri(x.id)} disabled={x.id === p.id}>
          {x.nome} {x.cognome}
        </button>
        <span style={{ fontSize: 12, color: 'var(--dim)' }}>{x.id === p.id ? `${ruolo} · questa scheda` : ruolo}</span>
      </span>
      {x.nucleo && (
        <>
          <button type="button" className="num sg-chip" onClick={() => void fai(() => d.rendiTitolare(x.id), `${x.nome} è titolare del nucleo`, onCambiato)}>
            TITOLARE
          </button>
          <button
            type="button"
            className="num sg-chip"
            onClick={async () => {
              if ((await chiedi(`Togliere ${x.nome} ${x.cognome} dal nucleo? Resta iscritto, ma il titolare non lo vede più nella sua pagina.`, 'TOGLI DAL NUCLEO')))
                void fai(() => d.togliDalNucleo(x.id), 'Tolto dal nucleo', onCambiato)
            }}
          >
            TOGLI
          </button>
        </>
      )}
    </div>
  )

  return (
    <div className="stack" style={{ gap: 8 }}>
      <Riga titolo="NUCLEO FAMILIARE">
        <span className="num sg-bollino">PROVA</span>
      </Riga>
      {!p.nucleo && membri.length === 0 ? (
        <span className="sg-sotto">Non è in un nucleo. Aggiungi qualcuno qui sotto, e ne diventa titolare: vedrà nella sua pagina anche le persone del nucleo.</span>
      ) : !titolare ? (
        <span className="sg-sotto">Il titolare del nucleo non c’è più: toglilo dal nucleo.</span>
      ) : (
        <>
          {persona(titolare, 'Titolare: vede tutto il nucleo nella sua pagina')}
          {membri.map((x) => persona(x, 'Nel nucleo'))}
        </>
      )}
      {!p.nucleo && (
        <div className="row" style={{ gap: 8 }}>
          <label htmlFor="n-agg" className="vh">
            Persona da aggiungere al nucleo
          </label>
          <select id="n-agg" className="sg-campo grow" style={{ borderStyle: 'dashed', minWidth: 0 }} value={daAggiungere} onChange={(e) => setDaAggiungere(e.target.value)}>
            <option value="">Aggiungi al nucleo…</option>
            {candidati.map((x) => (
              <option key={x.id} value={x.id}>
                {x.cognome} {x.nome}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="num sg-chip sg-chip-pieno"
            disabled={!daAggiungere}
            onClick={() =>
              void fai(() => d.mettiNelNucleo(daAggiungere, p.id), 'Aggiunto al nucleo', () => {
                setDaAggiungere('')
                onCambiato()
              })
            }
          >
            AGGIUNGI
          </button>
        </div>
      )}
      {p.nucleo && titolare && <span className="sg-sotto">Per aggiungere qualcuno, apri la scheda del titolare.</span>}
      {minimo ? (
        <span style={{ fontSize: 12, color: 'var(--sec)' }}>
          {minimo.scontato
            ? `Sconto famiglia: il ${Math.round(SCONTO_FAMIGLIA * 100)}% su ${minimo.corso} di ${minimo.chi}, cioè ${euro(Math.round(minimo.importo * SCONTO_FAMIGLIA))} €, già sulla sua ricevuta.`
            : `Sconto famiglia: il ${Math.round(SCONTO_FAMIGLIA * 100)}% sull’annuale che costa meno, ${minimo.corso} di ${minimo.chi}, cioè ${euro(Math.round(minimo.importo * SCONTO_FAMIGLIA))} €. Se è già pagato senza, si rende a parte; se no lo mette la ricevuta.`}
        </span>
      ) : (
        nucleo.length > 1 && (
          <span style={{ fontSize: 12, color: 'var(--dim)' }}>Sconto famiglia: con due annuali nelle ricevute del nucleo, il {Math.round(SCONTO_FAMIGLIA * 100)}% su quello che costa meno.</span>
        )
      )}
    </div>
  )
}

/**
 * Nascita, residenza e genitore: dal modulo di iscrizione dell'app o
 * dall'import delle risposte del modulo Google. Sono quelli che vanno sulle
 * ricevute: MODIFICA li corregge, e da lì valgono i nuovi.
 */
/** `onCambiato`: codice fiscale e nascita decidono i possibili doppioni dell'elenco. */
function DatiAnagrafici({ d, p, fai, onCambiato }: { d: DatiSegreteria; p: PersonaSeg; fai: Fai; onCambiato: () => void }) {
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

  if (modifica) return <ModificaAnagrafica d={d} p={p} fai={fai} dati={modifica} onCambia={setModifica} onFatto={() => { setModifica(null); void an.ricarica(); onCambiato() }} />

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
      {no && <span style={{ fontSize: 13, color: 'var(--rosso-testo)' }}>{no}.</span>}
      {avviso && <span style={{ fontSize: 13, color: 'var(--giallo-testo)' }}>{avviso} Si può salvare lo stesso.</span>}
      <span className="sg-sotto">Un campo lasciato vuoto si cancella. Le ricevute già fatte restano com'erano; le nuove prendono questi.</span>
      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className="sg-btn sg-btn-linea" onClick={onFatto}>
          LASCIA STARE
        </button>
        <button type="button" className="sg-btn sg-btn-pieno" disabled={!!no} onClick={() => void fai(() => d.salvaAnagrafica(p.id, pulita, true), 'Dati anagrafici salvati', onFatto)}>
          SALVA
        </button>
      </div>
    </div>
  )
}

/** Quanti giorni da oggi a una data `AAAA-MM-GG`. */
const giorniA = (g: string, oggi: string) => Math.round((Date.parse(g) - Date.parse(oggi)) / 86_400_000)

/**
 * Il certificato medico: fino a quando vale. Il foglio sta su carta, nella
 * cartellina della segreteria: qui si scrive solo la scadenza. Senza, in sala
 * non si entra: in elenco si vede in rosso, e un mese prima della scadenza in
 * giallo.
 *
 * Un certificato caricato nell'app prima della carta ha ancora il file: si
 * apre, si stampa e si cancella da qui.
 */
function Certificato({ d, p, fai, onCambiato }: { d: DatiSegreteria; p: PersonaSeg; fai: Fai; onCambiato: () => void }) {
  const oggi = chiaveGiorno(new Date())
  const [bozza, setBozza] = useState<{ scade: string } | null>(null)
  const c = p.certificato
  const come = comeCertificato(c, oggi)
  const t = timbriScheda(p, oggi).certificato
  const fra = c.scade ? giorniA(c.scade, oggi) : 0

  const stato =
    come === 'manca'
      ? 'Nessun certificato in segreteria: senza, in sala non si entra.'
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
        throw new Error(d.modo === 'prova' ? 'In prova il file resta solo finché la pagina è aperta: questo non c’è più, si può cancellare' : 'Il file non si trova')
      }
      if (w) w.location.href = f.url
      else window.location.href = f.url
    })
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      <Riga titolo="CERTIFICATO MEDICO">
        <Bollino tono={t.tono}>{t.parola}</Bollino>
      </Riga>
      {!bozza && <span style={{ fontSize: 14, color: come === 'valido' ? 'var(--sec)' : come === 'in_scadenza' ? 'var(--giallo-testo)' : 'var(--rosso-testo)' }}>{stato}</span>}

      {c.conFile && (
        <div className="stack" style={{ gap: 8, padding: '10px 12px', border: '1px solid var(--giallo-testo)', borderRadius: 6 }}>
          <span style={{ fontSize: 14, color: 'var(--giallo-testo)' }}>
            Questo certificato è ancora caricato nell’app: aprilo, stampalo, mettilo nella cartellina e cancellalo da qui. La scadenza resta.
          </span>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="num sg-chip" data-primo onClick={apri}>
              APRI PER STAMPARE
            </button>
            <button
              type="button"
              className="num sg-chip"
              onClick={async () => {
                if ((await chiedi(`Il certificato di ${p.nome} ${p.cognome} è stampato e nella cartellina? Dall'app si cancella per sempre.`, 'SÌ, CANCELLA IL FILE', { pericolo: true })))
                  void fai(() => d.cancellaFileCertificato(p.id), 'File cancellato: il certificato ora è solo su carta', onCambiato)
              }}
            >
              STAMPATO, CANCELLALO
            </button>
          </div>
        </div>
      )}

      {bozza ? (
        <>
          <Campo id="c-scade" etichetta="VALIDO FINO AL">
            <input id="c-scade" className="sg-campo" type="date" value={bozza.scade} onChange={(e) => setBozza({ scade: e.target.value })} />
          </Campo>
          <span style={{ fontSize: 13, color: 'var(--dim)' }}>
            Il foglio va nella cartellina, e quello vecchio si distrugge. Se è arrivato per email o WhatsApp: stampalo e cancellalo da lì.
          </span>
          {bozza.scade && bozza.scade < oggi && <span style={{ fontSize: 13, color: 'var(--giallo-testo)' }}>Questa data è già passata: il certificato risulterà scaduto.</span>}
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="sg-btn sg-btn-linea grow" onClick={() => setBozza(null)}>
              LASCIA STARE
            </button>
            <button
              type="button"
              className="sg-btn sg-btn-pieno grow"
              disabled={!bozza.scade}
              onClick={() =>
                void fai(() => d.salvaCertificato(p.id, bozza.scade), c.scade ? 'Scadenza cambiata' : 'Certificato segnato', () => {
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
          {/* Col file da stampare, il timbro porta prima lì (APRI PER STAMPARE). */}
          {/* Pieno solo se è la prima cosa da fare (`tastoPrincipale`): in scheda un tasto pieno alla volta. */}
          <button type="button" className={tastoPrincipale(p, oggi) === 'certificato' ? 'num sg-chip sg-chip-pieno' : 'num sg-chip'} data-primo={c.conFile ? undefined : true} onClick={() => setBozza({ scade: c.scade && c.scade >= oggi ? c.scade : '' })}>
            {c.scade ? 'RINNOVA O CORREGGI' : 'SEGNA IL CERTIFICATO'}
          </button>
          <div className="grow" />
          {(c.conFile || c.scade) && (
            <button
              type="button"
              className="sg-btn sg-btn-linea"
              onClick={async () => {
                if ((await chiedi(`Togliere il certificato di ${p.nome} ${p.cognome}?${c.conFile ? ' Il file caricato nell’app si cancella per sempre.' : ''} Senza certificato non entra in sala finché non se ne segna uno nuovo. Il foglio in segreteria va distrutto a mano.`, 'TOGLI IL CERTIFICATO', { pericolo: true })))
                  void fai(() => d.togliCertificato(p.id), 'Certificato tolto', onCambiato)
              }}
            >
              TOGLI IL CERTIFICATO
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Il documento d'identità: la copia sta su carta, in segreteria, e qui si
 * segna solo che c'è. Per un minore è quello del genitore.
 */
function Documento({ d, p, fai, onCambiato }: { d: DatiSegreteria; p: PersonaSeg; fai: Fai; onCambiato: () => void }) {
  const t = timbriScheda(p, chiaveGiorno(new Date())).documento
  return (
    <div className="stack" style={{ gap: 8 }}>
      <Riga titolo="DOCUMENTO D’IDENTITÀ">
        <Bollino tono={t.tono}>{t.parola}</Bollino>
      </Riga>
      <span style={{ fontSize: 14, color: p.documento ? 'var(--sec)' : 'var(--giallo-testo)' }}>
        {p.documento ? 'La copia è nella cartellina.' : 'Manca la copia: va mostrato in segreteria (per un minore, quello del genitore).'}
      </span>
      <div className="row">
        <button
          type="button"
          className="num sg-chip"
          data-primo={p.documento ? undefined : true}
          onClick={() =>
            void fai(() => d.salvaDocumento(p.id, !p.documento), p.documento ? 'Documento tolto: ora è DA PORTARE. Se era uno sbaglio, LA COPIA È IN SEGRETERIA lo rimette' : 'Documento segnato in segreteria', onCambiato)
          }
        >
          {p.documento ? 'LA COPIA NON C’È PIÙ' : 'LA COPIA È IN SEGRETERIA'}
        </button>
      </div>
    </div>
  )
}

/**
 * La quota: se ha pagato lo dicono le ricevute (la QUOTA ASSOCIATIVA che vale
 * oggi, vedi `pagamentoDi`). Per chi ha pagato fuori dall'app, prima dell'app
 * o con una ricevuta di carta, c'è l'eccezione scritta a mano, fino a una
 * data. Sotto, fin quando sono pagati i corsi: si guardano, non contano.
 */
function Pagamento({ d, p, fai, onCambiato }: { d: DatiSegreteria; p: PersonaSeg; fai: Fai; onCambiato: () => void }) {
  const oggi = chiaveGiorno(new Date())
  const s = pagamentoDi(p, oggi)
  const t = timbriScheda(p, oggi).quota
  const eccezione = p.pagamento.stato !== 'da_pagare'
  const [scrivi, setScrivi] = useState(false)
  const [b, setB] = useState({ fino: VALIDITA.quota.al, nota: '' })
  const ricevute = useCarica(() => d.ricevute(p.id), [d, p.id])
  // Per ogni corso pagato, l'ultima data fin cui vale.
  const corsi = new Map<string, string>()
  for (const r of ricevute.dato ?? []) {
    if (r.annullataIl) continue
    for (const v of r.voci) {
      if (!v.al || v.descrizione.trim().toUpperCase() === QUOTA) continue
      if ((corsi.get(v.descrizione) ?? '') < v.al) corsi.set(v.descrizione, v.al)
    }
  }
  const fino = s.fino ? dataLunga(s.fino) : ''
  // Una frase sola, per il caso che è: le date ci sono solo dove servono.
  const detto =
    s.come === 'pagato'
      ? s.fonte === 'ricevuta'
        ? `Pagata${fino ? ` fino al ${fino}` : ''} · ricevuta ${s.ricevuta}.`
        : `Pagata fuori dall’app${fino ? `, fino al ${fino}` : ''}.`
      : s.come === 'in_parte'
        ? s.fonte === 'ricevuta'
          ? `Mancano ${euro(s.mancano ?? 0)} € della quota · ricevuta ${s.ricevuta}.`
          : `Pagata in parte fuori dall’app${fino ? `, fino al ${fino}` : ''}.`
        : s.come === 'scaduto'
          ? `Valeva fino al ${fino}: è da pagare di nuovo.`
          : 'Nessuna ricevuta con la quota di questa stagione.'

  return (
    <div className="stack" style={{ gap: 8 }}>
      <Riga titolo="QUOTA">
        <Bollino tono={t.tono}>{t.parola}</Bollino>
        {s.fonte === 'fuori_app' && <Bollino tono="spento">FUORI APP</Bollino>}
      </Riga>
      <span style={{ fontSize: 14, color: s.come === 'pagato' ? 'var(--sec)' : s.come === 'in_parte' ? 'var(--giallo-testo)' : 'var(--rosso-testo)' }}>{detto}</span>
      {s.fonte === 'fuori_app' && s.nota && <span style={{ fontSize: 14, color: 'var(--sec)' }}>{s.nota}</span>}
      {corsi.size > 0 && (
        <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 2, fontSize: 13, color: 'var(--sec)' }}>
          {[...corsi].map(([corso, al]) => (
            <li key={corso}>
              {corso}: {al >= oggi ? `pagato fino al ${dataLunga(al)}` : <span style={{ color: 'var(--dim)' }}>valeva fino al {dataLunga(al)}</span>}
            </li>
          ))}
        </ul>
      )}

      {scrivi ? (
        <div className="stack" style={{ gap: 8, padding: '12px 14px', border: '2px dashed var(--tratteggio)' }}>
          <span style={{ fontSize: 14, color: 'var(--sec)' }}>Per chi ha pagato la quota senza una ricevuta dell’app: prima dell’app, o con una ricevuta di carta.</span>
          <div className="sg-due">
            <Campo id="pg-fino" etichetta="VALE FINO AL">
              <input id="pg-fino" className="sg-campo" type="date" value={b.fino} onChange={(e) => setB({ ...b, fino: e.target.value })} />
            </Campo>
            <Campo id="pg-nota" etichetta="NOTA · FACOLTATIVA">
              <input id="pg-nota" className="sg-campo" maxLength={300} placeholder="Ricevuta di carta n. 12…" value={b.nota} onChange={(e) => setB({ ...b, nota: e.target.value })} />
            </Campo>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="sg-btn sg-btn-linea grow" onClick={() => setScrivi(false)}>
              LASCIA STARE
            </button>
            <button
              type="button"
              className="sg-btn sg-btn-pieno grow"
              disabled={!b.fino || b.fino < oggi}
              onClick={() =>
                void fai(() => d.salvaPagamento(p.id, { stato: 'pagato', fino: b.fino, nota: b.nota.trim() || undefined }), 'Quota segnata pagata fuori dall’app', () => {
                  setScrivi(false)
                  onCambiato()
                })
              }
            >
              SEGNA PAGATA
            </button>
          </div>
        </div>
      ) : eccezione ? (
        <button
          type="button"
          className="sg-link"
          style={{ alignSelf: 'flex-start' }}
          onClick={async () => {
            if ((await chiedi(`Togliere «pagata fuori dall’app» a ${p.nome} ${p.cognome}? Resta quello che dicono le ricevute.`, 'TOGLI L’ECCEZIONE')))
              void fai(() => d.salvaPagamento(p.id, { stato: 'da_pagare' }), 'Tolta: ora contano solo le ricevute', onCambiato)
          }}
        >
          {s.fonte === 'ricevuta' ? 'C’è anche «pagata fuori dall’app»: non serve più, toglila' : 'Togli «pagata fuori dall’app»'}
        </button>
      ) : (
        s.come !== 'pagato' && (
          <button type="button" className="num sg-chip" style={{ alignSelf: 'flex-start' }} onClick={() => setScrivi(true)}>
            PAGATA SENZA RICEVUTA DELL’APP
          </button>
        )
      )}
    </div>
  )
}
