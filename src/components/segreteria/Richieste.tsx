import { useState, type ReactNode } from 'react'
import type { DatiSegreteria } from '../../lib/segreteria'
import type { DatiRichieste, FileRichiesta, Richiesta, StatoRichiesta } from '../../lib/richieste'
import { datiRichieste, ETICHETTA_FILE, FILE, minorenne } from '../../lib/richieste'
import { chiaveGiorno, oraDi } from '../../lib/sala'
import { dataLunga, Guaio, Riga, Testa, useAvviso, useCarica } from './comune'
import type { Destinazione, Voce } from './Segreteria'

const STATI: Record<StatoRichiesta, string> = { nuova: 'NUOVA', accolta: 'ACCOLTA', rifiutata: 'RIFIUTATA' }
const quando = (iso: string) => `${dataLunga(chiaveGiorno(new Date(iso)))}, ${oraDi(iso)}`

/**
 * Le richieste arrivate dal modulo di iscrizione.
 *
 * Una richiesta non è ancora un iscritto: la segreteria guarda il modulo
 * firmato, il documento e la ricevuta, e poi la accoglie — la persona entra
 * in elenco, iscritta ai corsi che ha scelto — o la rifiuta. Accolta o
 * rifiutata resta qui con quello che diceva, finché non la si elimina.
 *
 * Una richiesta mandata dall'area degli iscritti per il nucleo familiare di
 * qualcuno lo dice (NUCLEO): accolta, la persona entra nel suo nucleo, e per
 * un minore il documento è quello del genitore, che la segreteria ha già.
 */
export function Richieste({ d, onVai }: { d: DatiSegreteria; onVai: (v: Voce, d?: Destinazione) => void }) {
  const [r, setR] = useState<DatiRichieste | null>(null)
  const elenco = useCarica(async () => {
    const x = await datiRichieste()
    setR(x)
    return x.richieste()
  }, [])
  const corsi = useCarica(() => d.corsi(), [d])
  const persone = useCarica(() => d.persone(), [d])
  const [tutte, setTutte] = useState(false)
  const [scelta, setScelta] = useState<string | null>(null)
  const { avviso, fai } = useAvviso()

  const nomi = new Map((corsi.dato ?? []).map((c) => [c.id, c.nome]))
  const chi = new Map((persone.dato ?? []).map((p) => [p.id, `${p.nome} ${p.cognome}`]))
  const lista = (elenco.dato ?? []).filter((x) => tutte || x.stato === 'nuova')
  const nuove = (elenco.dato ?? []).filter((x) => x.stato === 'nuova').length
  const richiesta = (elenco.dato ?? []).find((x) => x.id === scelta) ?? null

  return (
    <>
      <Testa
        titolo="RICHIESTE ONLINE"
        sotto={nuove === 1 ? 'Una richiesta da guardare.' : nuove ? `${nuove} richieste da guardare.` : 'Nessuna richiesta da guardare.'}
      >
        <button type="button" className="num sg-chip" aria-pressed={tutte} onClick={() => setTutte(!tutte)}>
          ANCHE QUELLE GIÀ GESTITE
        </button>
      </Testa>

      {elenco.guaio && <Guaio testo={elenco.guaio} />}

      <div className="sg-due-colonne sg-iscritti">
        <div role="table" aria-label="Richieste" className="sg-tabella">
          <div role="row" className="sg-lista-testa sg-riga-iscritto">
            <span role="columnheader" className="sg-etichetta">NOME</span>
            <span role="columnheader" className="sg-etichetta">CORSI</span>
            <span role="columnheader" className="sg-etichetta">ARRIVATA</span>
            <span role="columnheader" className="sg-etichetta" style={{ textAlign: 'right' }}>STATO</span>
          </div>
          <div className="sg-tabella-corpo">
            {elenco.dato === null && !elenco.guaio && <p className="sg-sotto" style={{ padding: '12px 14px' }}>Sto leggendo le richieste…</p>}
            {elenco.dato !== null && lista.length === 0 && (
              <p className="sg-sotto" style={{ padding: '12px 14px' }}>
                {tutte ? 'Non è ancora arrivata nessuna richiesta.' : 'Nessuna richiesta nuova. Le altre si vedono con «anche quelle già gestite».'}
              </p>
            )}
            {lista.map((x) => (
              <button
                key={x.id}
                type="button"
                role="row"
                className="sg-riga-iscritto sg-iscritto"
                aria-pressed={scelta === x.id}
                data-spento={x.stato === 'rifiutata'}
                onClick={() => setScelta(x.id)}
              >
                <span role="cell" style={{ fontSize: 15, fontWeight: 600 }}>
                  {x.cognome} {x.nome}
                  {minorenne(x.natoIl) && <span className="num sg-tag" style={{ marginLeft: 8 }}>MINORE</span>}
                  {x.nucleoDi && <span className="num sg-tag" style={{ marginLeft: 8 }}>NUCLEO</span>}
                </span>
                <span role="cell" style={{ fontSize: 13, color: 'var(--sec)' }}>{x.corsi.map((c) => nomi.get(c) ?? '?').join(', ')}</span>
                <span role="cell" style={{ fontSize: 13, color: 'var(--sec)' }}>{quando(x.creataIl)}</span>
                <span role="cell" className="num" style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', textAlign: 'right', color: x.stato === 'nuova' ? 'var(--giallo-testo)' : x.stato === 'accolta' ? 'var(--verde)' : 'var(--dim)' }}>
                  {STATI[x.stato]}
                </span>
              </button>
            ))}
          </div>
        </div>

        <section aria-label="Richiesta" className="sg-scheda" style={{ maxWidth: 560 }}>
          {richiesta && r ? (
            <Scheda
              key={richiesta.id}
              r={r}
              x={richiesta}
              nomi={nomi}
              titolare={richiesta.nucleoDi ? (chi.get(richiesta.nucleoDi) ?? 'un iscritto') : undefined}
              fai={fai}
              onCambiato={() => void elenco.ricarica()}
              onEliminata={() => {
                setScelta(null)
                void elenco.ricarica()
              }}
              onApri={(persona) => onVai('iscritti', { persona })}
            />
          ) : (
            <span className="sg-sotto">Tocca una richiesta per vedere le risposte e i file.</span>
          )}
        </section>
      </div>
      {avviso}
    </>
  )
}

type Fai = ReturnType<typeof useAvviso>['fai']

function Scheda({
  r,
  x,
  nomi,
  titolare,
  fai,
  onCambiato,
  onEliminata,
  onApri,
}: {
  r: DatiRichieste
  x: Richiesta
  nomi: Map<string, string>
  /** Il titolare del nucleo da cui arriva, se arriva dall'area degli iscritti. */
  titolare?: string
  fai: Fai
  onCambiato: () => void
  onEliminata: () => void
  onApri: (personaId: string) => void
}) {
  const file = useCarica(() => r.file(x.id), [r, x.id])
  const minore = minorenne(x.natoIl)
  const arrivati = new Map((file.dato ?? []).map((f) => [f.tipo, f]))
  const mancanti = FILE.filter((f) => f.obbligatorio && !arrivati.has(f.tipo) && !(f.tipo === 'documento' && titolare && minore))

  return (
    <>
      <div className="stack" style={{ gap: 4 }}>
        <span className="ob" style={{ fontSize: 26, fontWeight: 700, letterSpacing: '0.04em' }}>
          {x.nome.toUpperCase()} {x.cognome.toUpperCase()}
        </span>
        <span className="sg-sotto">
          Arrivata il {quando(x.creataIl)}
          {x.gestitaIl && ` · ${x.stato} il ${quando(x.gestitaIl)}${x.gestitaDa ? ` da ${x.gestitaDa}` : ''}`}
        </span>
      </div>

      <div className="sg-dati">
        {titolare && x.nucleoDi && (
          <Dato etichetta="NUCLEO">
            Aggiunto da{' '}
            <button type="button" className="sg-link" onClick={() => onApri(x.nucleoDi!)}>
              {titolare}
            </button>{' '}
            dalla sua area: accolto, entra nel suo nucleo.{minore && ' Il documento è quello del genitore, già in segreteria.'}
          </Dato>
        )}
        <Dato etichetta="NATO IL">{dataLunga(x.natoIl)}{minore && ' · minorenne'}</Dato>
        <Dato etichetta="A">{x.natoA}</Dato>
        <Dato etichetta="CODICE FISCALE" num>{x.codiceFiscale}</Dato>
        <Dato etichetta="RESIDENZA">{x.indirizzo}, {x.cap} {x.comune}</Dato>
        {minore && (
          <>
            <Dato etichetta="GENITORE">{x.genitoreNome} {x.genitoreCognome}</Dato>
            <Dato etichetta="CF DEL GENITORE" num>{x.genitoreCodiceFiscale}</Dato>
          </>
        )}
        <Dato etichetta={minore ? 'EMAIL DEL GENITORE' : 'EMAIL'}>
          <a href={`mailto:${x.email}`} style={{ color: 'var(--sec)' }}>{x.email}</a>
        </Dato>
        <Dato etichetta="TELEFONO">
          <a href={`tel:${x.telefono.replace(/[^\d+]/g, '')}`} style={{ color: 'var(--sec)' }}>{x.telefono}</a>
        </Dato>
        {x.telefono2 && (
          <Dato etichetta="TELEFONO 2">
            <a href={`tel:${x.telefono2.replace(/[^\d+]/g, '')}`} style={{ color: 'var(--sec)' }}>{x.telefono2}</a>
          </Dato>
        )}
        <Dato etichetta="CORSI">{x.corsi.map((c) => nomi.get(c) ?? 'un corso che non c’è più').join(', ')}</Dato>
        <Dato etichetta="PAGA">{x.formula === 'annuale' ? 'L’annuale' : 'Il trimestre'}</Dato>
        {x.note && <Dato etichetta="NOTE">{x.note}</Dato>}
        <Dato etichetta="REGOLAMENTO">{x.regolamento ? 'Accettato' : 'Non accettato (richiesta di prima della casella)'}</Dato>
      </div>

      <Riga titolo="I FILE" />
      {file.guaio && <Guaio testo={file.guaio} />}
      {file.dato === null && !file.guaio && <span className="sg-sotto">Sto cercando i file…</span>}
      {file.dato && (
        <div className="stack" style={{ gap: 8 }}>
          {file.dato.length === 0 && (
            <span className="sg-sotto">{r.modo === 'prova' ? 'Nessun file: in prova restano solo finché la pagina è aperta.' : 'Nessun file arrivato.'}</span>
          )}
          {FILE.filter((f) => arrivati.has(f.tipo)).map((f) => (
            <Anteprima key={f.tipo} f={arrivati.get(f.tipo)!} />
          ))}
          {mancanti.length > 0 && file.dato.length > 0 && (
            <span className="sg-sotto" style={{ color: 'var(--rosso)' }}>Manca: {mancanti.map((f) => f.etichetta.toLowerCase()).join(', ')}.</span>
          )}
          {file.dato.length > 0 && <span className="sg-sotto" style={{ fontSize: 12 }}>I link valgono dieci minuti: se non si aprono più, riapri la richiesta.</span>}
        </div>
      )}

      <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
        {x.stato === 'nuova' && (
          <>
            <button
              type="button"
              className="sg-btn sg-btn-verde"
              onClick={() => {
                void fai(() => r.accogli(x.id), 'Accolta: ora è in elenco e iscritta ai suoi corsi', onCambiato)
              }}
            >
              ACCOGLI
            </button>
            <button
              type="button"
              className="sg-btn sg-btn-linea"
              onClick={() => {
                if (window.confirm(`Rifiutare la richiesta di ${x.nome} ${x.cognome}? Chi l'ha mandata non viene avvisato: va chiamato o scritto a mano.`))
                  void fai(() => r.rifiuta(x.id), 'Richiesta rifiutata', onCambiato)
              }}
            >
              RIFIUTA
            </button>
          </>
        )}
        {x.personaId && (
          <button type="button" className="sg-btn sg-btn-linea" onClick={() => onApri(x.personaId!)}>
            APRI LA SCHEDA
          </button>
        )}
        <div className="grow" />
        <button
          type="button"
          className="sg-link"
          onClick={() => {
            if (window.confirm(`Eliminare per sempre la richiesta di ${x.nome} ${x.cognome}, con il documento e gli altri file? La scheda in elenco, se c'è, resta.`))
              void fai(() => r.elimina(x.id), 'Richiesta eliminata', onEliminata)
          }}
        >
          Elimina richiesta e file
        </button>
      </div>
    </>
  )
}

function Dato({ etichetta, children, num }: { etichetta: string; children: ReactNode; num?: boolean }) {
  return (
    <>
      <span className="sg-etichetta">{etichetta}</span>
      <span className={num ? 'num' : undefined} style={{ fontSize: 15, letterSpacing: num ? '0.06em' : undefined, overflowWrap: 'anywhere' }}>
        {children}
      </span>
    </>
  )
}

function Anteprima({ f }: { f: FileRichiesta }) {
  return (
    <a href={f.url} target="_blank" rel="noreferrer" className="sg-file">
      {f.pdf ? <span className="num sg-file-pdf">PDF</span> : <img src={f.url} alt="" className="sg-file-img" />}
      <span className="sg-etichetta" style={{ color: 'var(--sec)' }}>{ETICHETTA_FILE[f.tipo] ?? f.tipo.toUpperCase()}</span>
      <span className="grow" />
      <span className="sg-link">Apri</span>
    </a>
  )
}
