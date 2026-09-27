import { useState } from 'react'
import type { DatiSegreteria, ListaMusica, Sala } from '../../lib/segreteria'
import { fonteDelLink, MAX_NOME_LISTA } from '../../lib/musica'
import { INFORMATIVA, INFORMATIVA_BOZZA } from '../../lib/iscrizione'
import { Spunta } from '../Icons'
import { dataLunga, Guaio, Testa, useAvviso, useCarica } from './comune'
import { StoricoTimer, VoceSale } from './TimerPalestra'

/**
 * Le impostazioni: le scelte che spettano alla palestra, non al codice. Per
 * quanto si tengono le presenze, fin dove si prepara il calendario, le sale
 * con la loro musica e il loro timer (con la voce), lo storico
 * dei timer, la privacy.
 */
export function Regole({ d }: { d: DatiSegreteria }) {
  const imp = useCarica(() => d.impostazioni(), [d])
  const scadute = useCarica(() => d.scadute(), [d, imp.dato?.mesiPresenze])
  const pronto = useCarica(() => d.prontoFino(), [d])
  const sale = useCarica(() => d.sale(), [d])
  const persone = useCarica(() => d.persone(), [d])
  const musica = useCarica(() => d.listeMusica(), [d])
  const { avviso, fai } = useAvviso()
  const [sala, setSala] = useState<{ id?: string; nome: string; capienza?: number } | null>(null)
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
      <Testa titolo="IMPOSTAZIONI" sotto="Le scelte che spettano alla palestra, non al codice." />

      <div className="sg-regole">
        {imp.guaio && <Guaio testo={`Le impostazioni non si leggono: ${imp.guaio}`} />}
        <section aria-label="Per quanto si tengono le presenze" className="sg-riquadro">
          <span className="ob sg-riquadro-titolo">PER QUANTO SI TENGONO LE PRESENZE</span>
          <div className="row" style={{ gap: 12 }}>
            <label htmlFor="mesi" className="vh">
              Mesi
            </label>
            <select
              id="mesi"
              className="sg-campo"
              value={imp.dato?.mesiPresenze ?? 24}
              disabled={!imp.dato}
              onChange={(e) => void fai(() => d.salvaImpostazioni({ mesiPresenze: Number(e.target.value) }), 'Periodo cambiato', imp.ricarica)}
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
                {scadute.guaio ? 'Non si riesce a contarle' : scadute.dato === null ? '…' : scadute.dato === 0 ? 'Nessuna presenza scaduta' : `${scadute.dato} presenze scadute`}
              </span>
              <span style={{ fontSize: 12, color: 'var(--dim)' }}>
                {d.modo === 'prova' ? 'In prova si cancellano da qui.' : 'Si cancellano col job mensile (vedi supabase/LEGGIMI.md), o da qui.'}
              </span>
            </span>
            <button
              type="button"
              className="num sg-chip"
              disabled={!scadute.dato || !imp.dato}
              onClick={() => {
                if (window.confirm(`Cancellare ${scadute.dato} presenze più vecchie di ${imp.dato?.mesiPresenze ?? 24} mesi? Non si recuperano.`)) {
                  void fai(() => d.pulisci(), 'Presenze scadute cancellate', scadute.ricarica)
                }
              }}
            >
              CANCELLA ORA
            </button>
          </div>
          <span style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--dim)' }}>
            Ventiquattro mesi è il valore di partenza, non una regola di legge: la scelta è della palestra, titolare del trattamento, e va scritta
            nell'informativa.
          </span>
        </section>

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
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <label htmlFor="avanti" style={{ fontSize: 14, color: 'var(--sec)' }}>
              Genera le lezioni per i prossimi
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
          <span style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--dim)' }}>
            Rigenerare non duplica e non tocca le lezioni che hanno già un appello, anche a cavallo del cambio d'ora.
          </span>
        </section>

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
                <button type="button" className="num sg-chip" style={{ minHeight: 36 }} onClick={() => setSala({ id: s.id, nome: s.nome, capienza: s.capienza })}>
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

        <MusicaSale d={d} sale={sale.dato ?? []} liste={musica.dato} guaio={musica.guaio} ricarica={musica.ricarica} fai={fai} />

        <VoceSale d={d} fai={fai} />

        <StoricoTimer d={d} />

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
                <a href={INFORMATIVA} target="_blank" rel="noreferrer" style={{ fontSize: 14, color: 'var(--sec)', wordBreak: 'break-all' }}>
                  {INFORMATIVA_BOZZA ? 'Leggi la bozza' : "Apri l'informativa"}
                </a>
                {INFORMATIVA_BOZZA && (
                  <span style={{ fontSize: 14, color: 'var(--sec)', lineHeight: 1.5 }}>
                    Scritta insieme all'app, non ancora approvata: la palestra, che è titolare del trattamento, la deve leggere e fare sua, e
                    decidere i punti in giallo (per quanto si tengono richieste, documenti e ricevute, dove si pubblica l'app). Poi si toglie il
                    riquadro BOZZA dalla pagina e <code>INFORMATIVA_BOZZA</code> in <code>src/lib/iscrizione.ts</code>. Fino ad allora, col database
                    vero, il pubblico non la vede e il modulo di iscrizione resta spento.
                  </span>
                )}
              </>
            ) : (
              <span style={{ fontSize: 14, color: 'var(--sec)', lineHeight: 1.5 }}>
                Non c'è ancora. Il link va messo in <code>src/lib/iscrizione.ts</code>, accanto a quello del modulo di iscrizione: si vede in fondo alla scheda
                ISCRIZIONI, a tutti. Finché manca, col database vero il modulo di iscrizione dell'app resta spento e il passo porta ancora al modulo Google:
                chiede codici fiscali e documenti, e prima va detto come si trattano.
              </span>
            )}
          </div>
          <div className="stack" style={{ gap: 6 }}>
            <span className="sg-etichetta" style={{ color: 'var(--giallo-testo)' }}>DATI SANITARI: SOLO IL CERTIFICATO</span>
            <span style={{ fontSize: 14, color: 'var(--sec)', lineHeight: 1.5 }}>
              Il certificato medico è un dato sulla salute, con altri obblighi: si carica solo nella scheda dell'iscritto, dove lo vede la segreteria e
              nessun altro. Patologie, allergie e simili non vanno scritte in nessun campo, nemmeno nelle note.
            </span>
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
      </div>
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
type Bozza = { id?: string; nome: string; link: string; salaId: string | null }

const FONTE = { youtube: 'YOUTUBE', spotify: 'SPOTIFY' } as const

/**
 * Le liste della musica che il tablet di ogni sala fa partire dalla sua barra
 * in basso: un nome e il link a una playlist di YouTube o di Spotify.
 */
function MusicaSale({
  d,
  sale,
  liste,
  guaio,
  ricarica,
  fai,
}: {
  d: DatiSegreteria
  sale: Sala[]
  liste: ListaMusica[] | null
  guaio: string | null
  ricarica: () => Promise<unknown>
  fai: Fai
}) {
  const [bozza, setBozza] = useState<Bozza | null>(null)
  const nomeSala = (id: string | null) => (id ? (sale.find((s) => s.id === id)?.nome ?? 'sala tolta') : 'Tutte le sale')
  const salva = () => {
    if (!bozza) return
    void fai(() => d.salvaListaMusica(bozza), bozza.id ? 'Lista salvata' : 'Lista aggiunta', async () => {
      setBozza(null)
      await ricarica()
    })
  }

  return (
    <section aria-label="La musica delle sale" className="sg-riquadro">
      <span className="ob sg-riquadro-titolo">LA MUSICA DELLE SALE</span>
      <span style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--dim)' }}>
        Le liste che il tablet di sala fa partire dalla sua barra in basso, sempre a portata di mano: un nome e il link a una playlist di YouTube o di
        Spotify. Il tablet le sceglie e basta. Per Spotify serve che sul tablet sia collegato un account Premium, dalle impostazioni del timer.
      </span>
      {guaio && <Guaio testo={`Le liste non si leggono: ${guaio}`} />}
      {(liste ?? []).map((l) =>
        bozza?.id === l.id ? (
          <FormLista key={l.id} bozza={bozza} sale={sale} setBozza={setBozza} onSalva={salva} />
        ) : (
          <div key={l.id} className="row sg-voce-elenco" style={{ gap: 12 }}>
            <span className="stack grow" style={{ minWidth: 0 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{l.nome}</span>
              <span style={{ fontSize: 12, color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.link}</span>
            </span>
            <span className="num sg-tag" style={{ fontSize: 11, padding: '2px 6px' }}>
              {FONTE[fonteDelLink(l.link) ?? 'youtube']}
            </span>
            <span className="num" style={{ fontSize: 14, color: 'var(--sec)', whiteSpace: 'nowrap' }}>{nomeSala(l.salaId)}</span>
            <button type="button" className="num sg-chip" style={{ minHeight: 36 }} onClick={() => setBozza({ ...l })}>
              CAMBIA
            </button>
            <button
              type="button"
              className="num sg-chip"
              style={{ minHeight: 36 }}
              onClick={() => {
                if (window.confirm(`Togliere «${l.nome}» dalla musica ${l.salaId ? `della sala ${nomeSala(l.salaId)}` : 'di tutte le sale'}?`)) {
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
        <FormLista bozza={bozza} sale={sale} setBozza={setBozza} onSalva={salva} />
      ) : (
        <button type="button" className="sg-btn sg-btn-tratteggio" disabled={!liste} onClick={() => setBozza({ nome: '', link: '', salaId: null })}>
          + AGGIUNGI UNA LISTA
        </button>
      )}
    </section>
  )
}

function FormLista({
  bozza,
  sale,
  setBozza,
  onSalva,
}: {
  bozza: Bozza
  sale: Sala[]
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
      </div>
      <input
        className="sg-campo"
        aria-label="Link alla playlist"
        placeholder="link a una playlist di YouTube o di Spotify"
        required
        inputMode="url"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={bozza.link}
        onChange={(e) => setBozza({ ...bozza, link: e.target.value })}
      />
      <div className="row" style={{ gap: 8 }}>
        <span className="grow" style={{ fontSize: 13, color: scritto && !fonte ? 'var(--rosso)' : 'var(--dim)' }}>
          {!scritto
            ? 'Da YouTube o da Spotify: Condividi › Copia link.'
            : fonte
              ? `Una playlist di ${fonte === 'youtube' ? 'YouTube' : 'Spotify'}.`
              : 'Questo link non è di YouTube né di Spotify.'}
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
