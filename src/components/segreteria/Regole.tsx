import { useEffect, useRef, useState, type ReactNode } from 'react'
import { confermaDateCorsi, confermaMesiPresenze, cosaNonVaAttivita, motivoAttivitaUsata, testoDateSalvate, type AttivitaSeg, type DatiSegreteria, type Impostazioni, type ListaMusica, type Sala } from '../../lib/segreteria'
import { erroreDelLink, fonteDelLink, MAX_NOME_LISTA } from '../../lib/musica'
import { INFORMATIVA, INFORMATIVA_BOZZA } from '../../lib/iscrizione'
import { Spunta } from '../Icons'
import { chiedi, Campo, ComeFunziona, dataLunga, Guaio, Testa, useAvviso, useBozza, useCarica } from './comune'
import { StoricoTimer, VoceSale } from './TimerPalestra'
import { EnteRicevute } from './Ricevute'
import { Importa } from './Importa'
import type { Destinazione, Voce } from './Segreteria'
import { type Disciplina, nomeDisciplina } from '../../../timer/src/lib/discipline'
import { SelectDisciplina } from './TimerPalestra'

/** I gruppi della pagina, da quello che si tocca a inizio stagione a quello che si tocca quasi mai. */
const GRUPPI = {
  'imp-stagione': 'LA STAGIONE',
  'imp-sale': 'LE SALE E I TABLET',
  'imp-ricevute': 'LE RICEVUTE',
  'imp-importa': 'IMPORTA DA EXCEL',
  'imp-dati': 'DATI E PRIVACY',
} as const

type IdGruppo = keyof typeof GRUPPI

/** Dall'indice al gruppo: la pagina scorre e il fuoco va sul titolo, così la tastiera riparte da lì. */
function vaiAlGruppo(id: IdGruppo) {
  const titolo = document.getElementById(id)
  titolo?.scrollIntoView({ block: 'start' })
  titolo?.focus({ preventScroll: true })
}

function Gruppo({ id, children }: { id: IdGruppo; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="sg-regole-gruppo">
      <h2 id={id} tabIndex={-1} className="ob sg-regole-titolo">
        {GRUPPI[id]}
      </h2>
      <div className="sg-regole">{children}</div>
    </section>
  )
}

/**
 * Le impostazioni: le scelte che spettano alla palestra, non al programma. La
 * stagione; le sale con la loro musica, la voce e lo storico dei timer; chi
 * fa le ricevute; per quanto si tengono le presenze, il backup, la privacy.
 */
export function Regole({ d, onVai }: { d: DatiSegreteria; onVai: (v: Voce, dove?: Destinazione) => void }) {
  const imp = useCarica(() => d.impostazioni(), [d])
  const scadute = useCarica(() => d.scadute(), [d, imp.dato?.mesiPresenze])
  const pronto = useCarica(() => d.prontoFino(), [d])
  const sale = useCarica(() => d.sale(), [d])
  const persone = useCarica(() => d.persone(), [d])
  const musica = useCarica(() => d.listeMusica(), [d])
  const discipline = useCarica(() => d.discipline(), [d])
  const { avviso, avvisa, fai } = useAvviso()
  const [sala, setSala] = useState<{ id?: string; nome: string; capienza?: number } | null>(null)
  // Una sala aperta e cambiata (o una nuova con qualcosa scritto) non si perde uscendo.
  const salaPrima = sale.dato?.find((s) => s.id === sala?.id)
  useBozza(!!sala && (sala.nome.trim() !== (salaPrima?.nome ?? '') || sala.capienza !== salaPrima?.capienza), salaPrima?.nome)
  // I mesi scelti nella tendina mentre si aspetta il sì: lasciando stare, torna a quelli salvati.
  const [mesiScelti, setMesiScelti] = useState<number | null>(null)
  const cambiaMesi = async (dopo: number) => {
    const prima = imp.dato?.mesiPresenze ?? 24
    setMesiScelti(dopo)
    const conto = dopo < prima ? await d.scadute(dopo).catch(() => null) : null
    const domanda = confermaMesiPresenze({ prima, dopo, scadute: conto, modo: d.modo })
    if (domanda && !(await chiedi(domanda.testo, domanda.tasto, { pericolo: true }))) return setMesiScelti(null)
    await fai(() => d.salvaImpostazioni({ mesiPresenze: dopo }), 'Periodo cambiato', imp.ricarica)
    setMesiScelti(null)
  }
  const [chi, setChi] = useState('')

  const esporta = async () => {
    const p = persone.dato?.find((x) => x.id === chi)
    if (!p) return
    const dati = await d.esporta(chi)
    const url = URL.createObjectURL(new Blob([JSON.stringify(dati, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `dati-${p.cognome}-${p.nome}.json`.toLowerCase().replace(/\s+/g, '-')
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <Testa titolo="IMPOSTAZIONI" sotto="Le scelte che spettano alla palestra, non al programma." />

      {/* Tasti e non link «#…»: con <base href="../"> delle pagine delle aree, l'ancora porterebbe via dalla segreteria. */}
      <nav aria-label="In questa pagina" className="row sg-indice">
        {/* Object.keys dà string[]: le chiavi sono proprio quelle di GRUPPI, scritte qui sopra. */}
        {(Object.keys(GRUPPI) as IdGruppo[]).map((id) => (
          <button key={id} type="button" className="num sg-chip" onClick={() => vaiAlGruppo(id)}>
            {GRUPPI[id]}
          </button>
        ))}
      </nav>
      {imp.guaio && <Guaio testo={`Le impostazioni non si leggono: ${imp.guaio}`} />}

      <Gruppo id="imp-stagione">
        <section aria-label="Il calendario" className="sg-riquadro">
          <span className="ob sg-riquadro-titolo">IL CALENDARIO</span>
          <div className="sg-due">
            <div className="sg-numero">
              <span className="sg-etichetta">PRONTO FINO AL</span>
              <span className="num" style={{ fontSize: 26, fontWeight: 700 }}>{pronto.dato ? dataLunga(pronto.dato).toUpperCase() : '—'}</span>
            </div>
            <div className="sg-numero">
              <span className="sg-etichetta">SI ALLUNGA</span>
              <span className="num" style={{ fontSize: 26, fontWeight: 700 }}>DA SÉ</span>
            </div>
          </div>
          <Stagione
            d={d}
            imp={imp.dato}
            avvisa={avvisa}
            fai={fai}
            poi={async () => {
              await imp.ricarica()
              await pronto.ricarica()
            }}
          />
          {!imp.dato?.fineCorsi && (
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <label htmlFor="avanti" style={{ fontSize: 14, color: 'var(--sec)' }}>
                Senza la fine dei corsi, genera le lezioni per i prossimi
              </label>
              <select
                id="avanti"
                className="sg-campo"
                value={imp.dato?.giorniCalendario ?? 60}
                disabled={!imp.dato}
                onChange={(e) => void fai(() => d.salvaImpostazioni({ giorniCalendario: Number(e.target.value) }), 'Cambiato: vale dal prossimo RIGENERA', imp.ricarica)}
              >
                {[30, 60, 90, 180].map((g) => (
                  <option key={g} value={g}>
                    {g} giorni
                  </option>
                ))}
              </select>
            </div>
          )}
          <button
            type="button"
            className="sg-btn sg-btn-linea"
            style={{ alignSelf: 'flex-start' }}
            onClick={() =>
              void fai(
                () => d.rigenera(),
                d.modo === 'prova' ? 'In prova le lezioni si calcolano dalle ricorrenze: sono già tutte lì.' : 'Calendario allungato',
                pronto.ricarica,
              )
            }
          >
            RIGENERA ADESSO
          </button>
          <ComeFunziona>
            Prima dell'inizio non nascono lezioni. Le date sono facoltative. SALVA LE DATE toglie le lezioni da domani in poi fuori dalle date, tranne quelle con l’appello o una prova. Rigenerare non duplica e non
            tocca le lezioni che hanno già un appello, anche a cavallo del cambio d'ora.
          </ComeFunziona>
        </section>
      </Gruppo>

      <Gruppo id="imp-sale">
        <section aria-label="Le sale" className="sg-riquadro">
          <span className="ob sg-riquadro-titolo">LE SALE</span>
          {(sale.dato ?? []).map((s: Sala) =>
            sala?.id === s.id ? (
              <FormSala key={s.id} sala={sala} setSala={setSala} onSalva={() => void fai(() => d.salvaSala(sala), 'Sala salvata', async () => {
                setSala(null)
                await sale.ricarica()
              })} />
            ) : (
              <div key={s.id} className="row sg-voce-elenco" style={{ gap: 12 }}>
                <span className="grow" style={{ fontSize: 15, fontWeight: 600 }}>{s.nome}</span>
                <span className="num" style={{ fontSize: 14, color: 'var(--sec)' }}>{s.capienza ? `${s.capienza} posti` : 'posti non detti'}</span>
                <button type="button" className="num sg-chip" onClick={() => setSala({ id: s.id, nome: s.nome, capienza: s.capienza })}>
                  CAMBIA
                </button>
              </div>
            ),
          )}
          {sala && !sala.id ? (
            <FormSala sala={sala} setSala={setSala} onSalva={() => void fai(() => d.salvaSala(sala), 'Sala aggiunta', async () => {
              setSala(null)
              await sale.ricarica()
            })} />
          ) : (
            <button type="button" className="sg-btn sg-btn-tratteggio" onClick={() => setSala({ nome: '' })}>
              + AGGIUNGI UNA SALA
            </button>
          )}
        </section>

        <ElencoAttivita d={d} fai={fai} />

        <MusicaSale d={d} sale={sale.dato ?? []} discipline={discipline.dato ?? []} liste={musica.dato} guaio={musica.guaio} ricarica={musica.ricarica} fai={fai} />

        <VoceSale d={d} fai={fai} />

        <StoricoTimer d={d} />
      </Gruppo>

      <Gruppo id="imp-ricevute">
        <EnteRicevute d={d} />
      </Gruppo>

      <Gruppo id="imp-importa">
        <Importa d={d} onVai={onVai} />
      </Gruppo>

      <Gruppo id="imp-dati">
        <section aria-label="Per quanto si tengono le presenze" className="sg-riquadro">
          <span className="ob sg-riquadro-titolo">PER QUANTO SI TENGONO LE PRESENZE</span>
          <div className="row" style={{ gap: 12 }}>
            <label htmlFor="mesi" className="vh">
              Mesi
            </label>
            <select
              id="mesi"
              className="sg-campo"
              value={mesiScelti ?? imp.dato?.mesiPresenze ?? 24}
              disabled={!imp.dato || mesiScelti !== null}
              onChange={(e) => void cambiaMesi(Number(e.target.value))}
            >
              {[12, 24, 36, 60].map((m) => (
                <option key={m} value={m}>
                  {m} mesi
                </option>
              ))}
            </select>
            <span className="sg-sotto">dopo, si cancellano</span>
          </div>
          <div className="row sg-voce-elenco" style={{ gap: 12 }}>
            <span className="stack grow">
              <span style={{ fontSize: 15, fontWeight: 600 }}>
                {scadute.guaio ? 'Non si riesce a contarle' : scadute.dato === null ? '…' : scadute.dato === 0 ? 'Nessuna presenza scaduta' : scadute.dato === 1 ? '1 presenza scaduta' : `${scadute.dato} presenze scadute`}
              </span>
              <span style={{ fontSize: 12, color: 'var(--dim)' }}>
                {d.modo === 'prova' ? 'In prova si cancellano da qui.' : 'Si cancellano da sé il primo del mese, o da qui.'}
              </span>
            </span>
            <button
              type="button"
              className="num sg-chip"
              disabled={!scadute.dato || !imp.dato}
              onClick={async () => {
                if ((await chiedi(`Cancellare ${scadute.dato === 1 ? '1 presenza più vecchia' : `${scadute.dato} presenze più vecchie`} di ${imp.dato?.mesiPresenze ?? 24} mesi? Non si recuperano.`, 'CANCELLA LE PRESENZE', { pericolo: true }))) {
                  void fai(() => d.pulisci(), 'Presenze scadute cancellate', scadute.ricarica)
                }
              }}
            >
              CANCELLA ORA
            </button>
          </div>
          <ComeFunziona>
            Ventiquattro mesi è il valore di partenza, non una regola di legge: la scelta è della palestra, titolare del trattamento, e
            l'informativa la riporta da sé.
          </ComeFunziona>
        </section>

        <Backup d={d} fai={fai} />

        <section aria-label="Privacy" className="sg-riquadro">
          <div className="row" style={{ gap: 10 }}>
            <span className="ob sg-riquadro-titolo grow">PRIVACY</span>
            <span className="num sg-tag" data-tipo={INFORMATIVA && !INFORMATIVA_BOZZA ? undefined : 'manca'} style={{ fontSize: 11, padding: '2px 6px' }}>
              {!INFORMATIVA ? 'DA FARE PRIMA DI PARTIRE' : INFORMATIVA_BOZZA ? 'BOZZA DA APPROVARE' : 'INFORMATIVA COLLEGATA'}
            </span>
          </div>
          <div className="stack" style={{ gap: 6 }}>
            <span className="sg-etichetta">L'INFORMATIVA</span>
            {INFORMATIVA ? (
              <>
                <a href={INFORMATIVA} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', alignSelf: 'flex-start', minHeight: 44, fontSize: 14, color: 'var(--sec)', wordBreak: 'break-all' }}>
                  {INFORMATIVA_BOZZA ? 'Leggi la bozza' : "Apri l'informativa"}
                </a>
                {INFORMATIVA_BOZZA && (
                  <span style={{ fontSize: 14, color: 'var(--sec)', lineHeight: 1.5 }}>
                    Scritta insieme all'app, non ancora approvata: la palestra, che è titolare del trattamento, la deve leggere e fare sua, e
                    decidere i punti in giallo (per quanto si tengono richieste, documenti e ricevute, dove si pubblica l'app). Poi chi cura l'app la
                    segna come approvata. Fino ad allora, col database vero, il pubblico non la vede e il modulo di iscrizione resta spento.
                  </span>
                )}
              </>
            ) : (
              <span style={{ fontSize: 14, color: 'var(--sec)', lineHeight: 1.5 }}>
                Non c'è ancora: va scritta e collegata all'app, e si vedrà in fondo alla scheda ISCRIZIONI, a tutti. Finché manca, col database vero il modulo di iscrizione dell'app resta spento e il passo porta ancora al modulo Google:
                chiede codici fiscali e documenti, e prima va detto come si trattano.
              </span>
            )}
          </div>
          <div className="stack" style={{ gap: 6 }}>
            <span className="sg-etichetta" style={{ color: 'var(--giallo-testo)' }}>DATI SANITARI: SOLO IL CERTIFICATO</span>
            <span style={{ fontSize: 14, color: 'var(--sec)' }}>Patologie e allergie: in nessun campo, nemmeno nelle note.</span>
            <ComeFunziona>
              Il certificato medico è un dato sulla salute, con altri obblighi: il file sta nell'app, nella scheda dell'iscritto, e lo vede solo la
              segreteria (un link che dura 10 minuti). Si cancella da solo 30 giorni dopo la scadenza, e subito se la persona viene disattivata; la data
              di scadenza resta. Sotto i 6 anni non si chiede. La copia del documento d'identità invece sta su carta, in un armadio chiuso: se arriva
              col modulo si stampa e si cancella dalla richiesta; per email o WhatsApp, da lì. Patologie, allergie e simili non vanno scritte in nessun campo, nemmeno nelle note.
            </ComeFunziona>
          </div>
          <div className="stack" style={{ gap: 6 }}>
            <label htmlFor="esporta" className="sg-etichetta">
              ESPORTA I DATI DI UNA PERSONA
            </label>
            <div className="row" style={{ gap: 8 }}>
              <select id="esporta" className="sg-campo grow" value={chi} onChange={(e) => setChi(e.target.value)}>
                <option value="">Chi li ha chiesti…</option>
                {[...(persone.dato ?? [])]
                  .sort((a, b) => a.cognome.localeCompare(b.cognome, 'it') || a.nome.localeCompare(b.nome, 'it'))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.cognome} {p.nome}
                    </option>
                  ))}
              </select>
              <button type="button" className="num sg-chip sg-chip-pieno" disabled={!chi} onClick={() => void fai(esporta, 'File scaricato')}>
                ESPORTA
              </button>
            </div>
            <span style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.5 }}>
              Un file con anagrafica, iscrizioni e presenze: è quello che una persona ha diritto di chiedere.
            </span>
          </div>
        </section>
      </Gruppo>
      {avviso}
    </>
  )
}

function FormSala({
  sala,
  setSala,
  onSalva,
}: {
  sala: { id?: string; nome: string; capienza?: number }
  setSala: (s: { id?: string; nome: string; capienza?: number } | null) => void
  onSalva: () => void
}) {
  return (
    <form
      className="row sg-voce-elenco"
      style={{ gap: 8, borderColor: 'var(--text)' }}
      onSubmit={(e) => {
        e.preventDefault()
        onSalva()
      }}
    >
      <input className="sg-campo grow" aria-label="Nome della sala" required autoFocus value={sala.nome} onChange={(e) => setSala({ ...sala, nome: e.target.value })} />
      <input
        className="sg-campo"
        style={{ width: 90 }}
        aria-label="Posti"
        type="number"
        min={1}
        placeholder="posti"
        value={sala.capienza ?? ''}
        onChange={(e) => setSala({ ...sala, capienza: e.target.value ? Number(e.target.value) : undefined })}
      />
      <button type="button" className="num sg-chip" style={{ minHeight: 44 }} onClick={() => setSala(null)}>
        LASCIA STARE
      </button>
      <button type="submit" className="num sg-chip sg-chip-pieno" style={{ minHeight: 44 }} aria-label="Salva la sala">
        <Spunta size={18} />
      </button>
    </form>
  )
}

type Fai = (op: () => Promise<unknown>, riuscito?: string, poi?: () => unknown) => Promise<unknown>

/**
 * Le attività che si scelgono per un giorno e per una lezione (Karate, Fitness…):
 * l'elenco lo scrive la segreteria, parte vuoto. Una in uso non si elimina: si mette
 * NON PIÙ IN USO, e resta dov'è ma non si offre più.
 */
function ElencoAttivita({ d, fai }: { d: DatiSegreteria; fai: Fai }) {
  const att = useCarica(() => d.attivita(), [d])
  const elenco = att.dato?.elenco ?? []
  const manca = att.dato?.manca
  const [bozza, setBozza] = useState<{ id?: string; nome: string } | null>(null)
  const campo = useRef<HTMLInputElement>(null)
  // Un nome cambiato (o nuovo con qualcosa scritto) non si perde uscendo.
  const prima = elenco.find((a) => a.id === bozza?.id)
  useBozza(!!bozza && bozza.nome.trim() !== (prima?.nome ?? ''), prima?.nome)
  const salva = (b: { id?: string; nome: string }, nuova: boolean) => void fai(() => d.salvaAttivita(b), nuova ? 'Attività aggiunta' : 'Attività salvata', async () => {
    // Una nuova lascia il campo aperto e vuoto per la successiva; se intanto si è
    // già scritto altro, quel testo resta.
    setBozza((c) => (nuova && c && c.nome === b.nome ? { nome: '' } : nuova ? c : null))
    if (nuova) campo.current?.focus()
    await att.ricarica()
  })
  const form = (b: { id?: string; nome: string }) => {
    const errore = b.nome.trim() ? cosaNonVaAttivita(b.nome, elenco, b.id) : null
    return (
      <form
        className="stack sg-voce-elenco"
        style={{ gap: 6, borderColor: 'var(--text)', alignItems: 'stretch' }}
        onSubmit={(e) => {
          e.preventDefault()
          if (!errore) salva(b, !b.id)
        }}
      >
        <div className="row" style={{ gap: 8 }}>
          <input
            ref={campo}
            className="sg-campo grow"
            aria-label="Nome dell'attività"
            required
            autoFocus
            maxLength={40}
            value={b.nome}
            onChange={(e) => setBozza({ ...b, nome: e.target.value })}
            onKeyDown={(e) => e.key === 'Escape' && setBozza(null)}
            onBlur={() => !b.id && !b.nome && setBozza(null)}
          />
          <button type="button" className="num sg-chip" style={{ minHeight: 44 }} onClick={() => setBozza(null)}>
            LASCIA STARE
          </button>
          <button type="submit" className="num sg-chip sg-chip-pieno" style={{ minHeight: 44 }} aria-label="Salva l'attività" disabled={!!errore}>
            <Spunta size={18} />
          </button>
        </div>
        {errore && <span className="sg-manca" style={{ fontSize: 14 }}>{errore}</span>}
      </form>
    )
  }
  return (
    <section aria-label="Le attività" className="sg-riquadro">
      <span className="ob sg-riquadro-titolo">LE ATTIVITÀ</span>
      {manca && <span className="sg-manca" style={{ fontSize: 14 }}>Le attività non sono ancora attive sul database. Va lanciato l'aggiornamento 41.</span>}
      {att.guaio && <Guaio testo={`Le attività non si leggono: ${att.guaio}`} />}
      {elenco.map((a: AttivitaSeg) => {
        if (bozza?.id === a.id) return <div key={a.id}>{form(bozza)}</div>
        const motivo = motivoAttivitaUsata(a.giorni, a.lezioni)
        return (
          <div key={a.id} className="stack sg-voce-elenco" style={{ gap: 4, alignItems: 'stretch' }}>
            <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
              <span className="grow" style={{ fontSize: 15, fontWeight: 600, minWidth: 0, overflowWrap: 'anywhere', opacity: a.attiva ? 1 : 0.6 }}>{a.nome}</span>
              {!a.attiva && <span className="num sg-tag" style={{ fontSize: 11, padding: '2px 6px' }}>NON PIÙ IN USO</span>}
              <button type="button" className="num sg-chip" onClick={() => setBozza({ id: a.id, nome: a.nome })}>
                CAMBIA
              </button>
              <button type="button" className="num sg-chip" onClick={() => void fai(() => d.attivaAttivita(a.id, !a.attiva), a.attiva ? 'Non più in uso' : 'Rimessa in uso', att.ricarica)}>
                {a.attiva ? 'NON PIÙ IN USO' : 'RIMETTI IN USO'}
              </button>
              {!motivo && (
                <button
                  type="button"
                  className="num sg-chip"
                  onClick={async () => {
                    if (await chiedi(`Eliminare l'attività «${a.nome}»?`, 'ELIMINA', { pericolo: true })) void fai(() => d.eliminaAttivita(a.id), 'Attività eliminata', att.ricarica)
                  }}
                >
                  ELIMINA
                </button>
              )}
            </div>
            {motivo && <span className="sg-sotto">{motivo}</span>}
          </div>
        )
      })}
      {att.dato && elenco.length === 0 && !bozza && !manca && <span className="sg-sotto">Nessuna attività: aggiungile, poi si scelgono per ogni giorno di un corso.</span>}
      {bozza && !bozza.id ? (
        form(bozza)
      ) : (
        <button type="button" className="sg-btn sg-btn-tratteggio" disabled={!att.dato || !!manca} onClick={() => setBozza({ nome: '' })}>
          + AGGIUNGI UN'ATTIVITÀ
        </button>
      )}
      <ComeFunziona>
        Cosa si fa in una lezione: Karate, Fitness, Open mat. Si sceglie per ogni giorno di un corso (da CORSI) e il tablet di sala la scrive accanto
        all'orario. Una lezione può averne una diversa solo per quel giorno. Cambiare il nome qui lo cambia dappertutto.
      </ComeFunziona>
    </section>
  )
}
type Bozza = { id?: string; nome: string; link: string; salaId: string | null; disciplina?: string }

const FONTE = { youtube: 'YOUTUBE', spotify: 'SPOTIFY', radio: 'RADIO' } as const

/**
 * Le liste della musica che il tablet di ogni sala fa partire dalla sua barra
 * in basso: un nome e il link a una playlist di YouTube o di Spotify.
 */
function MusicaSale({
  d,
  sale,
  discipline,
  liste,
  guaio,
  ricarica,
  fai,
}: {
  d: DatiSegreteria
  sale: Sala[]
  discipline: Disciplina[]
  liste: ListaMusica[] | null
  guaio: string | null
  ricarica: () => Promise<unknown>
  fai: Fai
}) {
  const [bozza, setBozza] = useState<Bozza | null>(null)
  const prima = liste?.find((l) => l.id === bozza?.id)
  useBozza(
    !!bozza && (bozza.nome.trim() !== (prima?.nome ?? '') || bozza.link.trim() !== (prima?.link ?? '') || bozza.salaId !== (prima?.salaId ?? null) || bozza.disciplina !== prima?.disciplina),
    prima?.nome,
  )
  const nomeSala = (id: string | null) => (id ? (sale.find((s) => s.id === id)?.nome ?? 'sala tolta') : 'Tutte le sale')
  const salva = () => {
    if (!bozza) return
    // La disciplina si manda solo se è cambiata: così una lista si salva anche su un database senza 40-discipline.sql.
    const { disciplina, ...senza } = bozza
    const cambiata = disciplina !== prima?.disciplina
    void fai(() => d.salvaListaMusica(cambiata ? { ...senza, disciplina: disciplina ?? null } : senza), bozza.id ? 'Lista salvata' : 'Lista aggiunta', async () => {
      setBozza(null)
      await ricarica()
    })
  }

  return (
    <section aria-label="La musica delle sale" className="sg-riquadro">
      <span className="ob sg-riquadro-titolo">LA MUSICA DELLE SALE</span>
      {guaio && <Guaio testo={`Le liste non si leggono: ${guaio}`} />}
      {(liste ?? []).map((l) =>
        bozza?.id === l.id ? (
          <FormLista key={l.id} bozza={bozza} sale={sale} discipline={discipline} setBozza={setBozza} onSalva={salva} />
        ) : (
          <div key={l.id} className="row sg-voce-elenco" style={{ gap: 12, flexWrap: 'wrap' }}>
            <span className="stack grow" style={{ minWidth: 0 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{l.nome}</span>
              <span style={{ fontSize: 12, color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.link}</span>
            </span>
            <span className="num sg-tag" style={{ fontSize: 11, padding: '2px 6px' }}>
              {FONTE[fonteDelLink(l.link) ?? 'youtube']}
            </span>
            <span className="num" style={{ fontSize: 14, color: 'var(--sec)', whiteSpace: 'nowrap' }}>
              {[nomeSala(l.salaId), nomeDisciplina(l.disciplina, discipline)].filter(Boolean).join(' · ')}
            </span>
            <button type="button" className="num sg-chip" onClick={() => setBozza({ ...l })}>
              CAMBIA
            </button>
            <button
              type="button"
              className="num sg-chip"
              onClick={async () => {
                if ((await chiedi(`Togliere «${l.nome}» dalla musica ${l.salaId ? `della sala ${nomeSala(l.salaId)}` : 'di tutte le sale'}?`, 'TOGLI LA LISTA'))) {
                  void fai(() => d.togliListaMusica(l.id), 'Lista tolta', ricarica)
                }
              }}
            >
              TOGLI
            </button>
          </div>
        ),
      )}
      {liste && liste.length === 0 && !bozza && <span className="sg-sotto">Nessuna lista: il tablet suona quella scelta nelle impostazioni del timer.</span>}
      {bozza && !bozza.id ? (
        <FormLista bozza={bozza} sale={sale} discipline={discipline} setBozza={setBozza} onSalva={salva} />
      ) : (
        <button type="button" className="sg-btn sg-btn-tratteggio" disabled={!liste} onClick={() => setBozza({ nome: '', link: '', salaId: null })}>
          + AGGIUNGI UNA LISTA
        </button>
      )}
      <ComeFunziona>
        Le liste che il tablet di sala fa partire dalla sua barra in basso, sempre a portata di mano: un nome e il link a una playlist di YouTube o di
        Spotify, oppure l'indirizzo di una radio (comincia con https). Il tablet le sceglie e basta. Per Spotify serve che sul tablet sia collegato un account Premium, dalle impostazioni del timer.
      </ComeFunziona>
    </section>
  )
}

function FormLista({
  bozza,
  sale,
  discipline,
  setBozza,
  onSalva,
}: {
  bozza: Bozza
  sale: Sala[]
  discipline: Disciplina[]
  setBozza: (b: Bozza | null) => void
  onSalva: () => void
}) {
  const fonte = fonteDelLink(bozza.link)
  const scritto = bozza.link.trim().length > 0
  return (
    <form
      className="stack sg-voce-elenco"
      style={{ gap: 8, borderColor: 'var(--text)', alignItems: 'stretch' }}
      onSubmit={(e) => {
        e.preventDefault()
        if (fonte) onSalva()
      }}
    >
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <input
          className="sg-campo grow"
          aria-label="Nome della lista"
          placeholder="nome, per esempio Riscaldamento"
          required
          autoFocus
          maxLength={MAX_NOME_LISTA}
          value={bozza.nome}
          onChange={(e) => setBozza({ ...bozza, nome: e.target.value })}
        />
        <select className="sg-campo" aria-label="Sala" value={bozza.salaId ?? ''} onChange={(e) => setBozza({ ...bozza, salaId: e.target.value || null })}>
          <option value="">Tutte le sale</option>
          {sale.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nome}
            </option>
          ))}
        </select>
        <SelectDisciplina discipline={discipline} valore={bozza.disciplina} etichetta="Categoria della lista" onCambia={(x) => setBozza({ ...bozza, disciplina: x })} />
      </div>
      <input
        className="sg-campo"
        aria-label="Link alla playlist"
        placeholder="link di YouTube, Spotify o radio"
        required
        inputMode="url"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={bozza.link}
        onChange={(e) => setBozza({ ...bozza, link: e.target.value })}
      />
      <div className="row" style={{ gap: 8 }}>
        <span className="grow" style={{ fontSize: 13, color: scritto && !fonte ? 'var(--rosso-testo)' : 'var(--dim)' }}>
          {!scritto
            ? 'Da YouTube o da Spotify: Condividi › Copia link. Una radio: l’indirizzo con https.'
            : fonte === 'radio'
              ? 'Una radio: con lei i tasti brano restano spenti.'
              : fonte
                ? `Una playlist di ${fonte === 'youtube' ? 'YouTube' : 'Spotify'}.`
                : (erroreDelLink(bozza.link) ?? 'Questo link non è di YouTube né di Spotify, e non sembra l’indirizzo di una radio.')}
        </span>
        <button type="button" className="num sg-chip" style={{ minHeight: 44 }} onClick={() => setBozza(null)}>
          LASCIA STARE
        </button>
        <button type="submit" className="num sg-chip sg-chip-pieno" style={{ minHeight: 44 }} disabled={!fonte} aria-label="Salva la lista">
          <Spunta size={18} />
        </button>
      </div>
    </form>
  )
}

/**
 * Il primo e l'ultimo giorno dei corsi. Con la fine, il calendario si prepara
 * tutto fino a lì; salvate le date, si allunga subito.
 */
function Stagione({ d, imp, avvisa, fai, poi }: {
  d: DatiSegreteria
  imp: Impostazioni | null | undefined
  avvisa: ReturnType<typeof useAvviso>['avvisa']
  fai: ReturnType<typeof useAvviso>['fai']
  poi: () => Promise<void>
}) {
  const [bozza, setBozza] = useState<{ inizio: string; fine: string } | null>(null)
  const inizio = bozza?.inizio ?? imp?.inizioCorsi ?? ''
  const fine = bozza?.fine ?? imp?.fineCorsi ?? ''
  const cambiate = inizio !== (imp?.inizioCorsi ?? '') || fine !== (imp?.fineCorsi ?? '')
  useBozza(cambiate, 'Inizio e fine dei corsi')
  // Il database senza le colonne: si dice cosa manca invece di un errore al salvataggio.
  if (imp && imp.inizioCorsi === undefined) {
    return (
      <span style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--dim)' }}>
        Per scrivere l'inizio e la fine dei corsi va rilanciato <code>12-calendario-da-se.sql</code>.
      </span>
    )
  }
  const salva = async () => {
    if (inizio && fine && fine < inizio) return avvisa('La fine dei corsi viene prima dell’inizio', true)
    // Il database ne tiene al massimo 400 giorni: un anno, con margine.
    if (inizio && fine && fine > `${Number(inizio.slice(0, 4)) + 1}${inizio.slice(4)}`) return avvisa('Fra inizio e fine dei corsi ci sta al massimo un anno', true)
    // Prima si dice quante lezioni se ne vanno: una data sbagliata ne toglierebbe mesi.
    const domanda = confermaDateCorsi(await d.contaDateCorsi(inizio || null, fine || null).catch(() => null))
    if (domanda && !(await chiedi(domanda.testo, domanda.tasto, { pericolo: true }))) return
    await fai(
      async () => {
        const esito = await d.salvaDateCorsi(inizio || null, fine || null)
        await d.rigenera()
        avvisa(testoDateSalvate(esito))
      },
      undefined,
      async () => {
        setBozza(null)
        await poi()
      },
    )
  }
  return (
    <>
      <div className="sg-due">
        <Campo id="inizio-corsi" etichetta="INIZIO CORSI">
          <input id="inizio-corsi" className="sg-campo" type="date" value={inizio} disabled={!imp} onChange={(e) => setBozza({ inizio: e.target.value, fine })} />
        </Campo>
        <Campo id="fine-corsi" etichetta="FINE CORSI">
          <input id="fine-corsi" className="sg-campo" type="date" value={fine} min={inizio || undefined} disabled={!imp} onChange={(e) => setBozza({ inizio, fine: e.target.value })} />
        </Campo>
      </div>
      {cambiate && (
        <button type="button" className="sg-btn" style={{ alignSelf: 'flex-start' }} onClick={() => void salva()}>
          SALVA LE DATE
        </button>
      )}
      <span style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--dim)' }}>
        {fine
          ? `Le lezioni si preparano tutte fino al ${/^\d{4}-\d{2}-\d{2}$/.test(fine) ? dataLunga(fine) : '…'}, e oltre non ne nascono.`
          : 'Senza la fine, il calendario si prepara per i giorni scelti qui sotto e si allunga da sé.'}
      </span>
    </>
  )
}

/** «lunedì 5 ottobre, 3:20» da un istante ISO. */
const quando = (iso: string) =>
  new Date(iso).toLocaleString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })

const STATO_BACKUP = { in_corso: 'IN CORSO', riuscito: 'RIUSCITO', fallito: 'NON RIUSCITO' } as const

/**
 * Il backup del database: lo fa GitHub ogni lunedì, e da qui quando serve.
 * Ogni copia si scarica per metterla su Drive: uno zip con dentro il file
 * cifrato, che si apre solo con la password del backup.
 */
function Backup({ d, fai }: { d: DatiSegreteria; fai: Fai }) {
  const stato = useCarica(() => d.backup(), [d])
  const inCorso = stato.dato?.ultimo?.stato === 'in_corso'
  // Mentre GitHub copia, l'elenco si rilegge da sé: la copia nuova arriva in un paio di minuti.
  useEffect(() => {
    if (!inCorso) return
    const t = window.setInterval(() => void stato.ricarica(), 20_000)
    return () => window.clearInterval(t)
  }, [inCorso, stato.ricarica])

  const scarica = async (id: number) => {
    const { link, nome } = await d.scaricaBackup(id)
    const a = document.createElement('a')
    a.href = link
    a.download = nome
    a.click()
  }

  const ultimo = stato.dato?.ultimo
  return (
    <section aria-label="Il backup" className="sg-riquadro">
      <div className="row" style={{ gap: 10 }}>
        <span className="ob sg-riquadro-titolo grow">IL BACKUP</span>
        {ultimo && (
          <a href={ultimo.link} target="_blank" rel="noreferrer" className="num sg-tag" data-tipo={ultimo.stato === 'fallito' ? 'manca' : undefined} style={{ fontSize: 11, padding: '2px 6px' }}>
            {STATO_BACKUP[ultimo.stato]}
          </a>
        )}
      </div>
      {stato.guaio && <Guaio testo={`Le copie non si leggono: ${stato.guaio}`} />}
      {ultimo && (
        <span style={{ fontSize: 14, color: 'var(--sec)' }}>
          Ultimo backup {ultimo.stato === 'in_corso' ? 'partito' : ultimo.stato === 'riuscito' ? 'riuscito' : 'non riuscito'} {quando(ultimo.quando)}
          {ultimo.stato === 'in_corso' && ': fra un paio di minuti è qui sotto.'}
        </span>
      )}
      {(stato.dato?.copie ?? []).map((c) => (
        <div key={c.id} className="row sg-voce-elenco" style={{ gap: 12 }}>
          <span className="grow" style={{ fontSize: 15, fontWeight: 600 }}>
            {/^\d{4}-\d{2}-\d{2}$/.test(c.giorno) ? dataLunga(c.giorno) : c.giorno}
          </span>
          <span className="num" style={{ fontSize: 14, color: 'var(--sec)', whiteSpace: 'nowrap' }}>
            {c.byte < 1_000_000 ? `${Math.max(1, Math.round(c.byte / 1000))} kB` : `${(c.byte / 1_000_000).toFixed(1).replace('.', ',')} MB`}
          </span>
          <button type="button" className="num sg-chip" onClick={() => void fai(() => scarica(c.id), 'Copia scaricata: si mette su Drive così com’è')}>
            SCARICA
          </button>
        </div>
      ))}
      {stato.dato && stato.dato.copie.length === 0 && <span className="sg-sotto">Nessuna copia, per ora.</span>}
      <button
        type="button"
        className="sg-btn sg-btn-linea"
        style={{ alignSelf: 'flex-start' }}
        disabled={!stato.dato || inCorso}
        onClick={() =>
          void fai(() => d.avviaBackup(), 'Backup partito: fra un paio di minuti è nell’elenco', async () => {
            // GitHub mette in fila il lancio dopo qualche secondo.
            await new Promise((r) => window.setTimeout(r, 4000))
            await stato.ricarica()
          })
        }
      >
        {inCorso ? 'BACKUP IN CORSO…' : 'FAI UN BACKUP ORA'}
      </button>
      <ComeFunziona>
        Una copia di tutto il database si fa da sé ogni lunedì notte, e da qui quando serve: prima di un cambiamento grosso, o per averne una da mettere su
        Drive. GitHub tiene le copie novanta giorni. Il file è cifrato: senza la password del backup non lo apre nessuno, quindi su Drive può stare anche
        in una cartella condivisa. La password va tenuta da parte, fuori da qui: per rimettere a posto una copia serve, insieme al file.
      </ComeFunziona>
    </section>
  )
}
