import { useMemo, useState, type FormEvent } from 'react'
import type { DatiSegreteria, PersonaleSeg, PresenzaIstruttoreSeg } from '../../lib/segreteria'
import { personaCambiata } from '../../lib/segreteria'
import { daRuoloScelto, nomeDelRuolo, ruoloScelto, type RuoloScelto } from '../../lib/ruoli'
import { chiaveGiorno, giornoPerEsteso, oraDi } from '../../lib/sala'
import { chiedi, Campo, Guaio, lasciare, Riga, SchedaPiena, Testa, messaggio, useAvviso, useBozza, useCarica, useOrdina } from './comune'
import { Numero, mesi } from './Presenze'
import { Kanji } from '../Kanji'
import { KANJI, kanjiScritto, significato } from '../../lib/kanji'

/** Quello che ciascun ruolo può fare: è il riassunto delle policy di `02-policy.sql`. */
const PERMESSI: Array<[string, string]> = [
  ['Vedere il calendario e fare l’appello, anche da sostituto', 'SÌ'],
  ['Aprire l’area istruttore del tablet col PIN', 'SÌ'],
  ['Annullare o chiudere le lezioni dei suoi corsi', 'SÌ'],
  ['Cambiare corsi, orari e sale', 'NO'],
  ['Aggiungere e togliere iscritti', 'NO'],
  ['Vedere il resoconto delle presenze e le impostazioni', 'NO'],
]

/**
 * Chi entra nell'app e cosa può fare. Gli iscritti non sono qui: non hanno un
 * accesso.
 *
 * Una persona si aggiunge con la sua email, e le si manda l'invito: la mail
 * con il link per scegliere la password. L'account lo crea la funzione
 * `invita` sul server di Supabase, perché dal browser non si può, ed è giusto
 * così: la chiave che sta nell'app è pubblica. Al primo accesso l'account e la
 * scheda si legano da soli, per email.
 */
export function Personale({ d }: { d: DatiSegreteria }) {
  const lista = useCarica(() => d.personale(), [d])
  const { avviso, avvisa, fai } = useAvviso()
  const [scelta, setScelta] = useState<string | null>(null)
  const [nuovo, setNuovo] = useState(false)

  const persone = [...(lista.dato ?? [])].sort(
    (a, b) => Number(b.attiva) - Number(a.attiva) || a.ruolo.localeCompare(b.ruolo) || a.nome.localeCompare(b.nome, 'it'),
  )
  const persona = nuovo ? null : (persone.find((p) => p.id === scelta) ?? null)
  const { ordina, colonna } = useOrdina<PersonaleSeg, 'nome' | 'email' | 'ruolo' | 'accesso' | 'pin'>({
    nome: (p) => `${p.nome} ${p.cognome}`.trim(),
    email: (p) => p.email,
    ruolo: (p) => nomeDelRuolo(p),
    // Come dice la colonna: chi è entrato, chi non ancora, chi non può.
    accesso: (p) => (!p.attiva ? 2 : p.collegato ? 0 : 1),
    pin: (p) => (p.haPin ? 0 : 1),
  })
  // La segreteria può tutto: la sua colonna, tutta SÌ, non ha niente da ordinare.
  const permessi = useOrdina<(typeof PERMESSI)[number], 'cosa' | 'istruttore'>({
    cosa: ([cosa]) => cosa,
    istruttore: ([, i]) => (i === 'SÌ' ? 0 : 1),
  })
  const chiudi = () => {
    setNuovo(false)
    setScelta(null)
  }
  // ← ISTRUTTORI E ACCESSI con qualcosa scritto e non salvato: prima si chiede.
  const torna = async () => {
    if (await lasciare()) chiudi()
  }

  /** Com'è andato l'invito, detto a chi l'ha mandato. */
  const partito = (nome: string, come: 'invito' | 'password') =>
    d.modo === 'prova'
      ? `In prova nessuna email parte davvero: a ${nome} arriverebbe l’invito`
      : come === 'invito'
        ? `Invito mandato: ${nome} riceve la mail per scegliere la password`
        : `${nome} aveva già un account: riceve la mail per scegliere la password`

  return (
    <>
      {nuovo ? (
        <SchedaPiena etichetta="Aggiungi una persona" torna="ISTRUTTORI E ACCESSI" onTorna={() => void torna()}>
          <Aggiungi
            d={d}
            fai={fai}
            avvisa={avvisa}
            partito={partito}
            onLasciaStare={() => setNuovo(false)}
            onAggiunta={async (id) => {
              await lista.ricarica()
              setNuovo(false)
              setScelta(id)
            }}
          />
        </SchedaPiena>
      ) : persona ? (
        <SchedaPiena key={persona.id} etichetta={`Scheda di ${persona.nome} ${persona.cognome}`.trim()} torna="ISTRUTTORI E ACCESSI" onTorna={() => void torna()}>
          <Scheda
            d={d}
            p={persona}
            altri={persone.filter((x) => x.id !== persona.id)}
            fai={fai}
            avvisa={avvisa}
            partito={partito}
            onCambiato={lista.ricarica}
            onEliminata={async () => {
              chiudi()
              await lista.ricarica()
            }}
          />
        </SchedaPiena>
      ) : null}

      {/* L'elenco resta montato sotto la scheda: tornando, è dov'era. */}
      <div className="stack" style={{ gap: 18 }} hidden={!!(nuovo || persona)}>
        <Testa titolo="ISTRUTTORI E ACCESSI" sotto="Chi entra nell'app e cosa può fare. Gli iscritti non sono qui: non hanno un accesso.">
          <button type="button" className="sg-btn sg-btn-pieno" onClick={() => setNuovo(true)}>
            + AGGIUNGI UNA PERSONA
          </button>
        </Testa>

        <div role="table" aria-label="Personale" className="sg-tabella">
          <div role="row" className="sg-lista-testa sg-riga-personale">
            {colonna('nome', 'NOME')}
            {colonna('email', 'EMAIL')}
            {colonna('ruolo', 'RUOLO')}
            {colonna('accesso', 'ACCESSO')}
            {colonna('pin', 'PIN TABLET')}
          </div>
          {lista.dato === null && lista.guaio && <Guaio testo={lista.guaio} />}
          {lista.dato === null && !lista.guaio && <p className="sg-sotto" style={{ padding: '12px 14px' }}>Sto leggendo…</p>}
          {ordina(persone).map((p) => (
            <div key={p.id} role="row" className="sg-riga-personale sg-personale" data-spento={!p.attiva} onClick={() => setScelta(p.id)}>
              <span role="cell" className="stack" style={{ minWidth: 0 }}>
                <span className="chi-kanji" style={{ fontSize: 15, fontWeight: 600 }}>
                  <Kanji segni={p.kanji} />
                  <button type="button" className="sg-riga-apri sg-una-riga">
                    {`${p.nome} ${p.cognome}`.trim()}
                  </button>
                </span>
                <span className="sg-una-riga" style={{ fontSize: 12, color: 'var(--dim)' }} title={p.corsi.join(', ')}>
                  {p.corsi.join(', ') || (ruoloScelto(p) === 'staff' ? 'segreteria' : 'nessun corso')}
                </span>
              </span>
              <span role="cell" className="sg-una-riga" style={{ fontSize: 13, color: p.email ? 'var(--sec)' : 'var(--rosso)' }} title={p.email ?? 'Senza email non può entrare'}>
                {p.email ?? 'nessuna email'}
              </span>
              <span role="cell" style={{ fontSize: 14, color: 'var(--sec)' }}>
                {nomeDelRuolo(p)}
              </span>
              <span role="cell">
                <Accesso p={p} />
              </span>
              <span role="cell" className="num" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', color: p.haPin ? 'var(--text)' : 'var(--dim)' }}>
                <span className="sg-solo-stretto" style={{ color: 'var(--dim)' }}>PIN TABLET </span>
                {p.haPin ? 'IMPOSTATO' : 'NESSUNO'}
              </span>
            </div>
          ))}
        </div>

        <section aria-label="Cosa può fare ogni ruolo" className="sg-riquadro">
          <Riga titolo="COSA PUÒ FARE OGNI RUOLO" />
          <div role="table" className="sg-permessi">
            <div role="row" className="contents">
              {permessi.colonna('cosa', 'PERMESSO')}
              {permessi.colonna('istruttore', 'ISTRUTTORE')}
              <span role="columnheader" className="sg-etichetta">SEGRETERIA</span>
            </div>
            {permessi.ordina(PERMESSI).map(([cosa, i]) => (
              <div key={cosa} role="row" className="contents">
                <span role="cell" style={{ fontSize: 14, color: 'var(--sec)' }}>{cosa}</span>
                <span role="cell" className="num" style={{ fontWeight: 700, color: i === 'SÌ' ? 'var(--text)' : 'var(--dim)' }}>{i}</span>
                <span role="cell" className="num" style={{ fontWeight: 700 }}>SÌ</span>
              </div>
            ))}
          </div>
          <span style={{ fontSize: 14, color: 'var(--sec)' }}>
            Chi ha tutti e due i ruoli può quello che può la segreteria, gli si danno dei corsi come a un istruttore, e il
            PIN sul tablet gli segna la presenza. All’accesso sceglie dove andare: in segreteria o al calendario.
          </span>
        </section>
      </div>
      {avviso}
    </>
  )
}

type Fai = ReturnType<typeof useAvviso>['fai']
type Avvisa = ReturnType<typeof useAvviso>['avvisa']
type Partito = (nome: string, come: 'invito' | 'password') => string

function Accesso({ p }: { p: PersonaleSeg }) {
  return (
    <span className="num" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', color: !p.attiva ? 'var(--dim)' : p.collegato ? 'var(--verde)' : 'var(--giallo-testo)' }}>
      {!p.attiva ? 'SENZA ACCESSO' : p.collegato ? 'HA FATTO L’ACCESSO' : 'NON ANCORA ENTRATO'}
    </span>
  )
}

/** Il ruolo, anche doppio: la segreteria che insegna anche. */
function SceltaRuolo({ ruolo, onScegli }: { ruolo: RuoloScelto; onScegli: (r: RuoloScelto) => void }) {
  return (
    <div role="radiogroup" aria-label="Ruolo" className="sg-due" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
      {(
        [
          ['istruttore', 'ISTRUTTORE'],
          ['staff', 'SEGRETERIA'],
          ['entrambi', 'TUTTI E DUE'],
        ] as const
      ).map(([r, testo]) => (
        <button key={r} type="button" role="radio" aria-checked={ruolo === r} className="sg-btn sg-scelta" onClick={() => onScegli(r)}>
          {testo}
        </button>
      ))}
    </div>
  )
}

/** Il modulo appena aperto: diverso da questo, c'è da perdere qualcosa. */
const VUOTA = { nome: '', cognome: '', email: '', ruolo: 'istruttore' as RuoloScelto }

function Aggiungi({
  d,
  fai,
  avvisa,
  partito,
  onLasciaStare,
  onAggiunta,
}: {
  d: DatiSegreteria
  fai: Fai
  avvisa: Avvisa
  partito: Partito
  onLasciaStare: () => void
  onAggiunta: (id: string) => Promise<void>
}) {
  const [bozza, setBozza] = useState(VUOTA)
  const [invitaSubito, setInvitaSubito] = useState(true)
  useBozza(!!(bozza.nome.trim() || bozza.cognome.trim() || bozza.email.trim()) || bozza.ruolo !== VUOTA.ruolo, bozza.nome.trim() || undefined)

  const aggiungi = (e: FormEvent) => {
    e.preventDefault()
    const chi = bozza
    const invita = invitaSubito
    let id = ''
    let esito = `${chi.nome} è nell'elenco`
    let guaio = false
    void fai(
      async () => {
        const { ruolo, ancheIstruttore } = daRuoloScelto(chi.ruolo)
        id = await d.salvaPersonale({ ...chi, ruolo, ...(ancheIstruttore ? { ancheIstruttore } : {}) })
        if (!invita) return
        // La persona è salvata comunque: un invito non partito si rimanda dalla sua scheda.
        try {
          esito = `${chi.nome} è nell'elenco. ${partito(chi.nome, await d.invita(id))}`
        } catch (x) {
          esito = `${chi.nome} è nell'elenco, ma l’invito non è partito: ${messaggio(x)}`
          guaio = true
        }
      },
      undefined,
      async () => {
        await onAggiunta(id)
        avvisa(esito, guaio)
      },
    )
  }

  return (
    <form aria-label="Aggiungi una persona" className="stack" style={{ gap: 16 }} onSubmit={aggiungi}>
      <span className="ob" style={{ fontSize: 24, fontWeight: 700, letterSpacing: '0.04em' }}>AGGIUNGI UNA PERSONA</span>
      <div className="sg-due sg-scheda-campi">
        <Campo id="inv-nome" etichetta="NOME">
          <input id="inv-nome" className="sg-campo" required value={bozza.nome} onChange={(e) => setBozza({ ...bozza, nome: e.target.value })} />
        </Campo>
        <Campo id="inv-cognome" etichetta="COGNOME">
          <input id="inv-cognome" className="sg-campo" required value={bozza.cognome} onChange={(e) => setBozza({ ...bozza, cognome: e.target.value })} />
        </Campo>
        <Campo id="inv-email" etichetta="EMAIL" largo>
          <input id="inv-email" className="sg-campo" type="email" required placeholder="nome@esempio.it" value={bozza.email} onChange={(e) => setBozza({ ...bozza, email: e.target.value })} />
        </Campo>
        <div className="stack" style={{ gap: 6, gridColumn: 'span 2' }}>
          <span className="sg-etichetta">RUOLO</span>
          <SceltaRuolo ruolo={bozza.ruolo} onScegli={(ruolo) => setBozza({ ...bozza, ruolo })} />
        </div>
      </div>
      <label className="row" style={{ gap: 8, fontSize: 14, color: 'var(--sec)', cursor: 'pointer' }}>
        <input type="checkbox" checked={invitaSubito} onChange={(e) => setInvitaSubito(e.target.checked)} />
        Manda subito l’invito per email
      </label>
      <span className="sg-scheda-campi" style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--dim)' }}>
        {d.modo === 'prova'
          ? 'In prova l’account non serve e nessuna email parte: la persona compare subito negli istruttori dei corsi.'
          : 'Con l’invito le arriva una mail con un link: lo apre, sceglie la sua password ed entra. Il link scade dopo un’ora; se scade, «MANDA L’INVITO» nella sua scheda ne manda un altro. Se la persona è già in elenco come iscritta, diventa istruttore invece di un doppione.'}
      </span>
      <div className="sg-scheda-piede">
        <button type="button" className="sg-btn sg-btn-linea" onClick={onLasciaStare}>
          LASCIA STARE
        </button>
        <button type="submit" className="sg-btn sg-btn-pieno">
          AGGIUNGI
        </button>
      </div>
    </form>
  )
}

/** La scheda di un istruttore o di chi fa segreteria: i dati, il ruolo, l'accesso e il PIN del tablet. */
function Scheda({
  d,
  p,
  altri,
  fai,
  avvisa,
  partito,
  onCambiato,
  onEliminata,
}: {
  d: DatiSegreteria
  p: PersonaleSeg
  /** Gli altri del personale: un kanji già loro non si può scegliere. */
  altri: PersonaleSeg[]
  fai: Fai
  avvisa: Avvisa
  partito: Partito
  onCambiato: () => Promise<void>
  onEliminata: () => Promise<void>
}) {
  const [modifica, setModifica] = useState<{ nome: string; cognome: string; email: string } | null>(null)
  const [pin, setPin] = useState<string | null>(null)
  useBozza((!!modifica && personaCambiata(p, modifica)) || !!pin, `${p.nome} ${p.cognome}`.trim())
  // Il ruolo doppio si scrive solo se c'era o ci sarà: un database senza la
  // sua colonna salva lo stesso tutti gli altri (vedi `ruoloDaScrivere`).
  const dati = { id: p.id, nome: p.nome, cognome: p.cognome, email: p.email, ruolo: p.ruolo, ...(p.ancheIstruttore ? { ancheIstruttore: true } : {}) }
  const cambiaRuolo = (r: RuoloScelto) => {
    if (r === ruoloScelto(p)) return
    const nuovo = daRuoloScelto(r)
    const ruolo = nuovo.ancheIstruttore || p.ancheIstruttore ? nuovo : { ruolo: nuovo.ruolo }
    void fai(() => d.salvaPersonale({ ...dati, ...ruolo }), 'Ruolo cambiato', onCambiato)
  }

  const invita = () => void fai(async () => avvisa(partito(p.nome, await d.invita(p.id))))

  const elimina = async () => {
    if (!window.confirm(`Eliminare ${`${p.nome} ${p.cognome}`.trim()}? Spariscono la scheda e l'account, e non si torna indietro.`)) return
    const fatto = await fai(() => d.eliminaIstruttore(p.id), `${p.nome} è eliminato`, onEliminata)
    // Anche andata male la scheda può non esserci più: è l'account a non essersene andato.
    if (!fatto) await onCambiato()
  }

  return (
    <>
      <div className="row" style={{ gap: 14 }}>
        <Kanji segni={p.kanji} grande />
        <div className="stack" style={{ gap: 4, minWidth: 0 }}>
          <span className="ob" style={{ fontSize: 26, fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1 }}>
            {`${p.nome} ${p.cognome}`.trim().toUpperCase()}
          </span>
          <span style={{ fontSize: 13, color: p.attiva ? 'var(--dim)' : 'var(--rosso)' }}>
            {p.attiva ? nomeDelRuolo(p) : 'Accesso tolto: non entra nell’app né nell’area istruttore'}
          </span>
        </div>
      </div>

      <div className="sg-scheda-griglia">
        <div className="stack" style={{ gap: 20, minWidth: 0 }}>
          {modifica ? (
            <div className="sg-due">
              <Campo id="pe-nome" etichetta="NOME">
                <input id="pe-nome" className="sg-campo" value={modifica.nome} onChange={(e) => setModifica({ ...modifica, nome: e.target.value })} />
              </Campo>
              <Campo id="pe-cognome" etichetta="COGNOME">
                <input id="pe-cognome" className="sg-campo" value={modifica.cognome} onChange={(e) => setModifica({ ...modifica, cognome: e.target.value })} />
              </Campo>
              <Campo id="pe-email" etichetta={p.collegato ? 'EMAIL · È QUELLA CON CUI ENTRA' : 'EMAIL'} largo>
                <input
                  id="pe-email"
                  className="sg-campo"
                  type="email"
                  disabled={p.collegato}
                  placeholder="nome@esempio.it"
                  value={modifica.email}
                  onChange={(e) => setModifica({ ...modifica, email: e.target.value })}
                />
              </Campo>
              <div className="sg-scheda-piede" style={{ gridColumn: 'span 2' }}>
                <button type="button" className="sg-btn sg-btn-linea" onClick={() => setModifica(null)}>
                  LASCIA STARE
                </button>
                <button
                  type="button"
                  className="sg-btn sg-btn-pieno"
                  disabled={!modifica.nome.trim()}
                  onClick={() =>
                    void fai(() => d.salvaPersonale({ ...dati, ...modifica, email: p.collegato ? p.email : modifica.email }), 'Scheda salvata', async () => {
                      setModifica(null)
                      await onCambiato()
                    })
                  }
                >
                  SALVA
                </button>
              </div>
            </div>
          ) : (
            <div className="stack" style={{ gap: 12 }}>
              <div className="sg-due">
                <Campo etichetta="EMAIL">
                  <span style={{ fontSize: 14, overflowWrap: 'anywhere', color: p.email ? 'var(--text)' : 'var(--rosso)' }}>{p.email ?? 'nessuna email: non può entrare'}</span>
                </Campo>
                <Campo etichetta="CORSI">
                  <span style={{ fontSize: 14, color: p.corsi.length ? 'var(--text)' : 'var(--dim)' }}>{p.corsi.join(', ') || (ruoloScelto(p) === 'staff' ? 'segreteria' : 'nessun corso')}</span>
                </Campo>
              </div>
              <div className="row">
                <button type="button" className="num sg-chip" onClick={() => setModifica({ nome: p.nome, cognome: p.cognome, email: p.email ?? '' })}>
                  MODIFICA
                </button>
              </div>
            </div>
          )}

          <div className="stack" style={{ gap: 8 }}>
            <Riga titolo="RUOLO" />
            <SceltaRuolo ruolo={ruoloScelto(p)} onScegli={cambiaRuolo} />
          </div>

          <SceltaKanji d={d} p={p} altri={altri} fai={fai} onCambiato={onCambiato} />
        </div>

        <div className="stack" style={{ gap: 20, minWidth: 0 }}>
          <div className="stack" style={{ gap: 8 }}>
            <Riga titolo="ACCESSO">
              <Accesso p={p} />
            </Riga>
            <span style={{ fontSize: 14, color: 'var(--sec)' }}>
              {!p.attiva
                ? 'Non entra nell’app né nell’area istruttore del tablet. Le presenze che ha segnato restano nel registro.'
                : p.collegato
                  ? 'È entrata almeno una volta. Se perde la password la chiede da sé, dalla porta, con PASSWORD DIMENTICATA?'
                  : p.email
                    ? 'È in elenco ma non è mai entrata. Se l’invito non è arrivato o è scaduto, se ne manda un altro.'
                    : 'Senza email non può entrare: va aggiunta con MODIFICA.'}
            </span>
            {p.attiva && !p.collegato && p.email && (
              <div className="row">
                <button type="button" className="num sg-chip sg-chip-pieno" onClick={invita} title={`Manda a ${p.email} la mail per scegliere la password`}>
                  MANDA L’INVITO
                </button>
              </div>
            )}
          </div>

          <div className="stack" style={{ gap: 8 }}>
            <Riga titolo="PIN TABLET">
              <span className="num" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', color: p.haPin ? 'var(--text)' : 'var(--dim)' }}>
                {p.haPin ? 'IMPOSTATO' : 'NESSUNO'}
              </span>
            </Riga>
            <span style={{ fontSize: 14, color: 'var(--sec)' }}>Quattro cifre, per l’AREA ISTRUTTORE del tablet di sala. Due persone non possono avere lo stesso PIN.</span>
            {pin !== null ? (
              <form
                className="row"
                style={{ gap: 8 }}
                onSubmit={(e) => {
                  e.preventDefault()
                  void fai(() => d.impostaPin(p.id, pin), 'PIN impostato', async () => {
                    setPin(null)
                    await onCambiato()
                  })
                }}
              >
                <input
                  className="sg-campo num"
                  style={{ width: 100 }}
                  inputMode="numeric"
                  pattern="\d{4}"
                  maxLength={4}
                  aria-label={`Nuovo PIN di ${p.nome}`}
                  autoFocus
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                />
                <button type="submit" className="num sg-chip sg-chip-pieno" disabled={pin.length !== 4}>
                  OK
                </button>
                <button type="button" className="sg-link" onClick={() => setPin(null)}>
                  lascia stare
                </button>
              </form>
            ) : (
              <div className="row">
                <button type="button" className="num sg-chip" onClick={() => setPin('')}>
                  {p.haPin ? 'CAMBIA IL PIN' : 'IMPOSTA IL PIN'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <PresenzeDelMese d={d} p={p} />

      <div className="sg-scheda-piede">
        <button
          type="button"
          className="sg-btn sg-btn-linea"
          onClick={async () => {
            if (p.attiva && !(await chiedi(`Togliere l'accesso a ${p.nome}? Non entra più nell'app né nell'area istruttore; il registro resta.`, 'TOGLI L’ACCESSO'))) return
            void fai(() => d.attivaPersona(p.id, !p.attiva), p.attiva ? 'Accesso tolto' : 'Accesso ridato', onCambiato)
          }}
        >
          {p.attiva ? 'TOGLI L’ACCESSO' : 'RIDAI L’ACCESSO'}
        </button>
        {/* Solo chi insegna, anche col ruolo doppio: a chi è solo di segreteria si toglie l'accesso. Se ha corsi, lezioni o presenze il database dice di no, e perché. */}
        {ruoloScelto(p) !== 'staff' && (
          <button
            type="button"
            className="sg-btn sg-btn-linea"
            title="Solo per chi non ha mai insegnato: senza corsi, lezioni o presenze"
            onClick={() => void elimina()}
          >
            ELIMINA
          </button>
        )}
      </div>
    </>
  )
}

/**
 * Il kanji della persona, che la fa riconoscere a colpo d'occhio nel
 * calendario e nell'appello: uno della lista con un tocco, o un altro
 * scritto a mano. Quelli già di qualcun altro non si possono scegliere.
 */
function SceltaKanji({ d, p, altri, fai, onCambiato }: { d: DatiSegreteria; p: PersonaleSeg; altri: PersonaleSeg[]; fai: Fai; onCambiato: () => Promise<void> }) {
  const [aMano, setAMano] = useState<string | null>(null)
  useBozza(!!aMano?.trim(), `${p.nome} ${p.cognome}`.trim())
  const di = new Map(altri.filter((x) => x.kanji).map((x) => [x.kanji!, `${x.nome} ${x.cognome}`.trim()]))
  const scegli = (segno: string | null) => {
    if (segno === (p.kanji ?? null)) return
    void fai(() => d.salvaKanji(p.id, segno), segno ? `Il kanji di ${p.nome} è ${segno}` : 'Kanji tolto', async () => {
      setAMano(null)
      await onCambiato()
    })
  }
  const scritto = aMano === null ? null : kanjiScritto(aMano)
  const giaDi = scritto ? di.get(scritto) : undefined

  return (
    <div className="stack" style={{ gap: 8 }}>
      <Riga titolo="KANJI">
        <span className="num" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', color: p.kanji ? 'var(--text)' : 'var(--dim)' }}>
          {p.kanji ? `${p.kanji}${significato(p.kanji) ? ` · ${significato(p.kanji)!.toUpperCase()}` : ''}` : 'NESSUNO'}
        </span>
      </Riga>
      <span style={{ fontSize: 14, color: 'var(--sec)' }}>
        Un segno solo, accanto al nome nel calendario e nell’appello, per riconoscerlo a colpo d’occhio. Due persone non possono avere lo stesso.
      </span>
      <div role="radiogroup" aria-label={`Kanji di ${p.nome}`} className="sg-kanji-scelta">
        {KANJI.map((k) => {
          const chi = di.get(k.segno)
          return (
            <button
              key={k.segno}
              type="button"
              role="radio"
              aria-checked={p.kanji === k.segno}
              aria-label={`${k.segno}, ${k.vuol_dire}${chi ? `: già di ${chi}` : ''}`}
              title={chi ? `Già di ${chi}` : k.vuol_dire}
              disabled={!!chi}
              onClick={() => scegli(k.segno)}
            >
              <span className="kanji-segno" lang="ja">{k.segno}</span>
              <span className="kanji-dice">{k.vuol_dire}</span>
            </button>
          )
        })}
      </div>
      {aMano !== null ? (
        <form
          className="row"
          style={{ gap: 8, flexWrap: 'wrap' }}
          onSubmit={(e) => {
            e.preventDefault()
            if (scritto && !giaDi) scegli(scritto)
          }}
        >
          <input
            className="sg-campo"
            style={{ width: 80, fontSize: 22, textAlign: 'center' }}
            lang="ja"
            aria-label={`Un altro kanji per ${p.nome}`}
            autoFocus
            value={aMano}
            onChange={(e) => setAMano(e.target.value)}
          />
          <button type="submit" className="num sg-chip sg-chip-pieno" disabled={!scritto || !!giaDi}>
            OK
          </button>
          <button type="button" className="sg-link" onClick={() => setAMano(null)}>
            lascia stare
          </button>
          {aMano.trim() && (
            <span style={{ fontSize: 13, color: 'var(--rosso)' }}>{!scritto ? 'Un kanji solo, senza altro' : giaDi ? `${scritto} è già di ${giaDi}` : ''}</span>
          )}
        </form>
      ) : (
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="num sg-chip" onClick={() => setAMano('')}>
            UN ALTRO KANJI
          </button>
          {p.kanji && (
            <button type="button" className="num sg-chip" onClick={() => scegli(null)}>
              TOGLI IL KANJI
            </button>
          )}
        </div>
      )}
    </div>
  )
}

const minuti = (x: PresenzaIstruttoreSeg) => Math.round((Date.parse(x.fine) - Date.parse(x.inizio)) / 60_000)
/** In ore coi decimali, all'italiana: «1,5», per moltiplicarle per la paga oraria. */
const ore = (m: number) => (m / 60).toLocaleString('it-IT', { maximumFractionDigits: 2 })

/** Le lezioni confermate del mese in un foglio da aprire con Excel, come il registro delle presenze. */
function scaricaCsv(righe: PresenzaIstruttoreSeg[], chi: string, mese: string) {
  const q = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const testo = [
    ['data', 'inizio', 'fine', 'ore', 'corso', 'sala', 'previsto'].join(';'),
    ...righe.map((x) => [chiaveGiorno(new Date(x.inizio)), oraDi(x.inizio), oraDi(x.fine), ore(minuti(x)), x.corso, x.sala ?? '', x.prevista ? 'sì' : 'no'].map(q).join(';')),
  ].join('\r\n')
  const url = URL.createObjectURL(new Blob(['\ufeff' + testo], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `presenze-${chi}-${mese}.csv`.toLowerCase().replace(/\s+/g, '-')
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Le lezioni fatte da un istruttore in un mese, per calcolargli il compenso.
 * Contano solo le presenze confermate (dal PIN sul tablet, da sé o dalla
 * segreteria); quelle ancora da confermare si dicono a parte, perché vanno
 * decise prima di chiudere il mese.
 */
function PresenzeDelMese({ d, p }: { d: DatiSegreteria; p: PersonaleSeg }) {
  const periodi = useMemo(mesi, [])
  const [periodo, setPeriodo] = useState(periodi[0].chiave)
  const m = periodi.find((x) => x.chiave === periodo) ?? periodi[0]
  // Le presenze si leggono per giorni all'indietro: fino al primo del mese scelto, e un giorno in più.
  const giorni = Math.ceil((Date.now() - m.da.getTime()) / 86_400_000) + 1
  const elenco = useCarica(() => d.presenzeIstruttori(giorni), [d, giorni])
  // Le lezioni tenute in cui era previsto e non si è segnato: da decidere anche quelle.
  const proposte = useCarica(() => d.lezioniSenzaIstruttore().catch(() => []), [d])

  const da = chiaveGiorno(m.da)
  const a = chiaveGiorno(m.a)
  const del = (elenco.dato ?? [])
    .filter((x) => x.personaId === p.id && chiaveGiorno(new Date(x.inizio)) >= da && chiaveGiorno(new Date(x.inizio)) <= a)
    .sort((x, y) => x.inizio.localeCompare(y.inizio))
  const fatte = del.filter((x) => x.stato === 'confermata')
  const daConfermare =
    del.filter((x) => x.stato === 'da_confermare').length +
    (proposte.dato ?? []).filter((l) => {
      const g = chiaveGiorno(new Date(l.inizio))
      return g >= da && g <= a && l.previsti.some((x) => x.id === p.id && !x.stato)
    }).length
  const totale = fatte.reduce((t, x) => t + minuti(x), 0)
  const perCorso = [...new Set(fatte.map((x) => x.corso))]
    .map((corso) => {
      const xs = fatte.filter((x) => x.corso === corso)
      return { corso, xs, lezioni: xs.length, minuti: xs.reduce((t, x) => t + minuti(x), 0) }
    })
    .sort((x, y) => x.corso.localeCompare(y.corso, 'it'))
  const { ordina, colonna } = useOrdina<(typeof perCorso)[number], 'corso' | 'lezioni' | 'ore'>({
    corso: (c) => c.corso,
    lezioni: (c) => c.lezioni,
    ore: (c) => c.minuti,
  })

  return (
    <div className="stack" style={{ gap: 12 }}>
      <Riga titolo="PRESENZE">
        <label htmlFor="mese-istr" className="vh">
          Mese
        </label>
        <select id="mese-istr" className="sg-campo" value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
          {periodi.map((x) => (
            <option key={x.chiave} value={x.chiave}>
              {x.nome}
            </option>
          ))}
        </select>
        <button type="button" className="num sg-chip" disabled={!fatte.length} onClick={() => scaricaCsv(fatte, `${p.nome} ${p.cognome}`.trim(), m.nome)}>
          SCARICA
        </button>
      </Riga>
      <span style={{ fontSize: 14, color: 'var(--sec)' }}>
        Le lezioni in cui ha messo il PIN sul tablet di sala, confermate: sono quelle da pagare.
      </span>
      {elenco.guaio && <Guaio testo={elenco.guaio} />}
      <div className="sg-numeri">
        <Numero titolo="LEZIONI" valore={fatte.length} sotto={m.nome} />
        <Numero titolo="ORE" valore={ore(totale)} sotto="da orario delle lezioni" />
        <Numero titolo="DA CONFERMARE" valore={daConfermare} sotto={daConfermare ? 'in PRESENZE ISTRUTTORI' : 'niente in sospeso'} allarme={daConfermare > 0} />
      </div>
      {perCorso.length > 0 && (
        <div role="table" aria-label={`Lezioni di ${p.nome}, ${m.nome}`} className="sg-tabella">
          <div role="row" className="sg-lista-testa sg-riga-compenso">
            {colonna('corso', 'CORSO')}
            {colonna('lezioni', 'LEZIONI', { numeri: true })}
            {colonna('ore', 'ORE', { numeri: true })}
          </div>
          {ordina(perCorso).map((c) => (
            <details key={c.corso} className="sg-compenso">
              <summary role="row" className="sg-riga-compenso">
                <span role="cell" style={{ fontSize: 15, fontWeight: 600 }}>{c.corso}</span>
                <span role="cell" className="num">{c.lezioni}</span>
                <span role="cell" className="num">{ore(c.minuti)}</span>
              </summary>
              {c.xs.map((x) => (
                  <div key={x.id} style={{ fontSize: 13, color: 'var(--sec)', padding: '2px 14px 2px 28px' }}>
                    {giornoPerEsteso(chiaveGiorno(new Date(x.inizio)))}, {oraDi(x.inizio)}–{oraDi(x.fine)}
                    {x.prevista ? '' : ' · non era previsto'}
                  </div>
              ))}
            </details>
          ))}
        </div>
      )}
      {elenco.dato !== null && !del.length && <span style={{ fontSize: 14, color: 'var(--dim)' }}>Nessuna presenza in {m.nome.toLowerCase()}.</span>}
    </div>
  )
}
