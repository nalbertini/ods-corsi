import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { CorsoAperto, DatiRichiesta, DatiRichieste, TipoFile } from '../lib/richieste'
import { controlla, datiRichieste, ESTENSIONI, FILE, FORMULE, MASSIMO_FILE, minorenne } from '../lib/richieste'
import { riduciFoto } from '../lib/foto'
import { INFORMATIVA_PUBBLICA } from '../lib/iscrizione'

/**
 * Il modulo di iscrizione: le domande che prima stavano su Google Form, e i
 * file da caricare.
 *
 * Si manda in due tempi: prima le risposte, che il server controlla e da cui
 * nasce la richiesta, poi i file uno alla volta nella sua cartella. Se un
 * file non parte (la rete, una foto troppo grande) le risposte sono già
 * arrivate, e si riprova solo quello, entro un'ora.
 */

const VUOTO: DatiRichiesta = {
  nome: '',
  cognome: '',
  natoIl: '',
  natoA: '',
  codiceFiscale: '',
  indirizzo: '',
  cap: '',
  comune: '',
  email: '',
  telefono: '',
  genitoreNome: '',
  genitoreCognome: '',
  genitoreCodiceFiscale: '',
  corsi: [],
  formula: 'trimestre',
  note: '',
}

type Fase = { tipo: 'compila' } | { tipo: 'invio'; passo: string } | { tipo: 'file'; id: string; mancati: TipoFile[]; perche: string } | { tipo: 'fatto' }

export function ModuloIscrizione({ onChiudi }: { onChiudi: () => void }) {
  const [d, setD] = useState<DatiRichieste | null>(null)
  const [corsi, setCorsi] = useState<CorsoAperto[] | null>(null)
  const [guaioCorsi, setGuaioCorsi] = useState<string | null>(null)
  const [b, setB] = useState<DatiRichiesta>(VUOTO)
  const [file, setFile] = useState<Partial<Record<TipoFile, File>>>({})
  const [privacy, setPrivacy] = useState(false)
  // Un campo che una persona non vede e un programma riempie.
  const [trappola, setTrappola] = useState('')
  const [guaio, setGuaio] = useState<string | null>(null)
  const [fase, setFase] = useState<Fase>({ tipo: 'compila' })

  useEffect(() => {
    let vivo = true
    void datiRichieste()
      .then((x) => {
        if (!vivo) return
        setD(x)
        return x.corsiAperti().then((c) => vivo && setCorsi(c))
      })
      .catch((e) => vivo && setGuaioCorsi(e instanceof Error ? e.message : 'Il server non risponde'))
    return () => {
      vivo = false
    }
  }, [])

  const minore = !!b.natoIl && minorenne(b.natoIl)
  const metti = (k: keyof DatiRichiesta) => (e: { target: { value: string } }) => setB({ ...b, [k]: e.target.value })
  const scegli = (id: string) => setB({ ...b, corsi: b.corsi.includes(id) ? b.corsi.filter((c) => c !== id) : [...b.corsi, id] })

  const carica = async (id: string, quali: TipoFile[]) => {
    const mancati: TipoFile[] = []
    let perche = ''
    for (const tipo of quali) {
      const f = file[tipo]
      if (!f) continue
      setFase({ tipo: 'invio', passo: `Carico ${FILE.find((x) => x.tipo === tipo)!.etichetta.toLowerCase()}…` })
      try {
        await d!.caricaFile(id, tipo, f)
      } catch (e) {
        mancati.push(tipo)
        perche = e instanceof Error ? e.message : 'Il file non è partito'
      }
    }
    setFase(mancati.length ? { tipo: 'file', id, mancati, perche } : { tipo: 'fatto' })
  }

  const manda = async (e: FormEvent) => {
    e.preventDefault()
    setGuaio(null)
    if (trappola) return setFase({ tipo: 'fatto' })
    const pronta = { ...b, genitoreNome: minore ? b.genitoreNome : '', genitoreCognome: minore ? b.genitoreCognome : '', genitoreCodiceFiscale: minore ? b.genitoreCodiceFiscale : '' }
    const manca = controlla(pronta) ?? FILE.filter((f) => f.obbligatorio && !file[f.tipo]).map((f) => `Manca: ${f.etichetta.toLowerCase()}`)[0]
    if (manca) return setGuaio(manca)
    if (!privacy) return setGuaio("Serve la conferma di aver letto l'informativa privacy")
    setFase({ tipo: 'invio', passo: 'Mando le risposte…' })
    let id: string
    try {
      id = await d!.invia(pronta)
    } catch (e) {
      setFase({ tipo: 'compila' })
      return setGuaio(e instanceof Error ? e.message : 'Il server non risponde: riprova fra poco')
    }
    await carica(id, FILE.map((f) => f.tipo))
  }

  if (fase.tipo === 'fatto') {
    return (
      <div className="pad stack" style={{ gap: 14, padding: '20px 20px 28px' }}>
        <span className="ob" style={{ fontSize: 30, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--verde)' }}>RICHIESTA ARRIVATA</span>
        <span className="passo-dettaglio" style={{ fontSize: 16 }}>
          Grazie. La segreteria controlla il modulo, il documento e il pagamento, e ti scrive a {b.email.trim() || 'la tua email'} se manca qualcosa.
        </span>
        <button type="button" className="btn btn-ghost passo-btn" onClick={onChiudi}>
          TORNA ALLE ISCRIZIONI
        </button>
      </div>
    )
  }

  if (fase.tipo === 'file') {
    return (
      <div className="pad stack" style={{ gap: 14, padding: '20px 20px 28px' }}>
        <span className="ob" style={{ fontSize: 26, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--giallo)' }}>MANCA QUALCHE FILE</span>
        <span className="passo-dettaglio" style={{ fontSize: 16 }}>
          Le risposte sono arrivate. Non è partito: {fase.mancati.map((t) => FILE.find((f) => f.tipo === t)!.etichetta.toLowerCase()).join(', ')}.
        </span>
        <span className="passo-dettaglio" style={{ color: 'var(--rosso)' }}>{fase.perche}</span>
        {fase.mancati.map((t) => (
          <SceltaFile key={t} tipo={t} file={file[t]} onFile={(f) => setFile({ ...file, [t]: f })} />
        ))}
        <button type="button" className="btn btn-primary passo-btn" onClick={() => void carica(fase.id, fase.mancati)}>
          RIPROVA
        </button>
        <span className="passo-dettaglio">Si può riprovare per un'ora. Se non va, porta i fogli in segreteria.</span>
      </div>
    )
  }

  const inVolo = fase.tipo === 'invio'
  return (
    <form className="stack modulo" onSubmit={(e) => void manda(e)} noValidate>
      <div className="pad row" style={{ gap: 10, paddingTop: 14 }}>
        <button type="button" className="btn btn-ghost passo-btn" onClick={onChiudi} disabled={inVolo}>
          ← INDIETRO
        </button>
        {d?.modo === 'prova' && <span className="num sg-bollino">PROVA: RESTA SU QUESTO DISPOSITIVO</span>}
      </div>

      <Sezione titolo="CHI SI ISCRIVE">
        <Campo id="m-nome" etichetta="NOME">
          <input id="m-nome" className="campo" autoComplete="given-name" value={b.nome} onChange={metti('nome')} />
        </Campo>
        <Campo id="m-cognome" etichetta="COGNOME">
          <input id="m-cognome" className="campo" autoComplete="family-name" value={b.cognome} onChange={metti('cognome')} />
        </Campo>
        <Campo id="m-nato-il" etichetta="DATA DI NASCITA">
          <input id="m-nato-il" className="campo" type="date" value={b.natoIl} onChange={metti('natoIl')} />
        </Campo>
        <Campo id="m-nato-a" etichetta="LUOGO DI NASCITA">
          <input id="m-nato-a" className="campo" value={b.natoA} onChange={metti('natoA')} />
        </Campo>
        <Campo id="m-cf" etichetta="CODICE FISCALE" largo>
          <input id="m-cf" className="campo num" autoCapitalize="characters" spellCheck={false} maxLength={20} value={b.codiceFiscale} onChange={metti('codiceFiscale')} style={{ letterSpacing: '0.08em' }} />
        </Campo>
        {minore && <span className="passo-dettaglio modulo-largo" style={{ color: 'var(--giallo)' }}>È minorenne: servono i dati del genitore qui sotto, e il modulo per minori firmato da lui.</span>}
      </Sezione>

      {minore && (
        <Sezione titolo="IL GENITORE">
          <Campo id="m-g-nome" etichetta="NOME">
            <input id="m-g-nome" className="campo" value={b.genitoreNome} onChange={metti('genitoreNome')} />
          </Campo>
          <Campo id="m-g-cognome" etichetta="COGNOME">
            <input id="m-g-cognome" className="campo" value={b.genitoreCognome} onChange={metti('genitoreCognome')} />
          </Campo>
          <Campo id="m-g-cf" etichetta="CODICE FISCALE DEL GENITORE" largo>
            <input id="m-g-cf" className="campo num" autoCapitalize="characters" spellCheck={false} maxLength={20} value={b.genitoreCodiceFiscale} onChange={metti('genitoreCodiceFiscale')} style={{ letterSpacing: '0.08em' }} />
          </Campo>
        </Sezione>
      )}

      <Sezione titolo="RESIDENZA">
        <Campo id="m-indirizzo" etichetta="VIA E NUMERO" largo>
          <input id="m-indirizzo" className="campo" autoComplete="street-address" value={b.indirizzo} onChange={metti('indirizzo')} />
        </Campo>
        <Campo id="m-cap" etichetta="CAP">
          <input id="m-cap" className="campo num" inputMode="numeric" autoComplete="postal-code" maxLength={5} value={b.cap} onChange={metti('cap')} />
        </Campo>
        <Campo id="m-comune" etichetta="COMUNE">
          <input id="m-comune" className="campo" autoComplete="address-level2" value={b.comune} onChange={metti('comune')} />
        </Campo>
      </Sezione>

      <Sezione titolo={minore ? 'COME RAGGIUNGERE IL GENITORE' : 'COME RAGGIUNGERTI'}>
        <Campo id="m-email" etichetta="EMAIL">
          <input id="m-email" className="campo" type="email" autoComplete="email" value={b.email} onChange={metti('email')} />
        </Campo>
        <Campo id="m-tel" etichetta="TELEFONO">
          <input id="m-tel" className="campo" type="tel" autoComplete="tel" value={b.telefono} onChange={metti('telefono')} />
        </Campo>
      </Sezione>

      <Sezione titolo="I CORSI">
        <div className="modulo-largo stack" style={{ gap: 6 }}>
          {guaioCorsi && <span className="passo-dettaglio" style={{ color: 'var(--rosso)' }}>I corsi non si leggono: {guaioCorsi}</span>}
          {!corsi && !guaioCorsi && <span className="passo-dettaglio">Un attimo…</span>}
          <div className="modulo-corsi" role="group" aria-label="Corsi">
            {corsi?.map((c) => (
              <button key={c.id} type="button" className="modulo-corso" aria-pressed={b.corsi.includes(c.id)} onClick={() => scegli(c.id)}>
                <span className="modulo-spunta" aria-hidden>{b.corsi.includes(c.id) ? '✓' : ''}</span>
                {c.nome}
              </button>
            ))}
          </div>
        </div>
        <div className="modulo-largo stack" style={{ gap: 6 }}>
          <span className="modulo-etichetta">COME PAGHI</span>
          <div className="row" style={{ gap: 8 }} role="radiogroup" aria-label="Come paghi">
            {FORMULE.map(([f, testo]) => (
              <button key={f} type="button" role="radio" aria-checked={b.formula === f} className="modulo-corso" style={{ flex: 1 }} onClick={() => setB({ ...b, formula: f })}>
                <span className="modulo-spunta" aria-hidden>{b.formula === f ? '●' : ''}</span>
                {testo}
              </button>
            ))}
          </div>
        </div>
      </Sezione>

      <Sezione titolo="I FILE">
        {FILE.map((f) => (
          <SceltaFile key={f.tipo} tipo={f.tipo} file={file[f.tipo]} onFile={(x) => setFile({ ...file, [f.tipo]: x })} />
        ))}
      </Sezione>

      <Sezione titolo="ALTRO">
        <Campo id="m-note" etichetta="NOTE PER LA SEGRETERIA · FACOLTATIVE" largo>
          <textarea id="m-note" className="campo" rows={3} maxLength={1000} placeholder="Niente dati sulla salute: quelli si portano in segreteria." value={b.note} onChange={metti('note')} style={{ paddingTop: 12, resize: 'vertical' }} />
        </Campo>
        <div className="vh" aria-hidden>
          <label htmlFor="m-sito">Non compilare</label>
          <input id="m-sito" tabIndex={-1} autoComplete="off" value={trappola} onChange={(e) => setTrappola(e.target.value)} />
        </div>
        <label className="modulo-largo modulo-privacy">
          <input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} />
          <span>
            Ho letto{' '}
            {INFORMATIVA_PUBBLICA ? (
              <a href={INFORMATIVA_PUBBLICA} target="_blank" rel="noreferrer" style={{ color: 'var(--sec)' }}>
                l'informativa privacy
              </a>
            ) : (
              "l'informativa privacy"
            )}{' '}
            e so che questi dati li legge solo la segreteria della palestra.
          </span>
        </label>
      </Sezione>

      <div className="pad stack" style={{ gap: 10, paddingBottom: 28 }}>
        {guaio && (
          <div role="alert" className="card" style={{ padding: 14, borderColor: 'var(--rosso)', color: 'var(--text)', fontSize: 15 }}>
            {guaio}
          </div>
        )}
        <button type="submit" className="btn btn-primary passo-btn" disabled={inVolo || !d}>
          {inVolo ? fase.passo.toUpperCase() : 'MANDA LA RICHIESTA'}
        </button>
      </div>
    </form>
  )
}

function Sezione({ titolo, children }: { titolo: string; children: ReactNode }) {
  return (
    <section>
      <div className="rule">
        <span className="rule-label">{titolo}</span>
        <div className="rule-line" />
      </div>
      <div className="pad modulo-griglia">{children}</div>
    </section>
  )
}

function Campo({ id, etichetta, children, largo }: { id: string; etichetta: string; children: ReactNode; largo?: boolean }) {
  return (
    <div className={`stack${largo ? ' modulo-largo' : ''}`} style={{ gap: 6, minWidth: 0 }}>
      <label htmlFor={id} className="modulo-etichetta">
        {etichetta}
      </label>
      {children}
    </div>
  )
}

/** Un file da scegliere: dal telefono apre la fotocamera o la galleria. */
function SceltaFile({ tipo, file, onFile }: { tipo: TipoFile; file?: File; onFile: (f: File | undefined) => void }) {
  const f = FILE.find((x) => x.tipo === tipo)!
  const [guaio, setGuaio] = useState<string | null>(null)
  const [lavoro, setLavoro] = useState(false)
  const id = `m-file-${tipo}`
  const scelto = async (x: File | undefined) => {
    setGuaio(null)
    if (!x) return onFile(undefined)
    if (!ESTENSIONI[x.type]) return setGuaio('Serve una foto (JPG, PNG, HEIC) o un PDF')
    setLavoro(true)
    const ridotto = await riduciFoto(x)
    setLavoro(false)
    if (ridotto.size > MASSIMO_FILE) return setGuaio('Il file è troppo grande: al massimo 10 MB')
    onFile(ridotto)
  }
  return (
    <div className="modulo-largo card modulo-file" data-fatto={!!file}>
      <span className="stack grow" style={{ gap: 3, minWidth: 0 }}>
        <span className="modulo-etichetta" style={{ color: file ? 'var(--verde)' : undefined }}>
          {f.etichetta}
          {!f.obbligatorio && ' · FACOLTATIVO'}
        </span>
        <span className="passo-dettaglio" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {lavoro ? 'Preparo la foto…' : file ? `${file.name} · ${Math.max(1, Math.round(file.size / 1024))} KB` : f.dettaglio}
        </span>
        {guaio && <span className="passo-dettaglio" style={{ color: 'var(--rosso)' }}>{guaio}</span>}
      </span>
      <label htmlFor={id} className="btn btn-ghost passo-btn modulo-scegli">
        {file ? 'CAMBIA' : 'SCEGLI'}
      </label>
      <input
        id={id}
        className="vh"
        type="file"
        accept="image/*,application/pdf"
        onChange={(e) => {
          void scelto(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
