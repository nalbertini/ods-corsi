import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { CampoModulo, CorsoAperto, DatiRichiesta, DatiRichieste, TipoFile } from '../lib/richieste'
import { certificatoDaPortare, controlla, datiRichieste, ESTENSIONI, FILE, FORMULE, MASSIMO_FILE, minorenne, problemi, pulisciCf } from '../lib/richieste'
import { caricaLuoghi, luogoDaCf, scriviLuogo, type Luoghi } from '../lib/codiceFiscale'
import { riduciFoto } from '../lib/foto'
import { INFORMATIVA_PUBBLICA, MODULI, PAGAMENTO, REGOLAMENTO, STAGIONE } from '../lib/iscrizione'
import { causale, stimaIscrizione, type Abbonamento } from '../lib/nucleo'
import { euro } from '../lib/ricevute'
import { chiaveGiorno } from '../lib/sala'
import { useListino } from './Costi'
import type { SceltaModulo } from '../lib/firma'
import { Bollino, Campo, CaricaFile, Dettaglio, NotaCampo, Riquadro, SceltaCorsi, Tasti, Tasto, TitoloEsito, Titoletto, type Nota } from './ds'
import { firmaPng, firmaVera, TavolaFirma, type Tratto } from './TavolaFirma'

/**
 * Il modulo di iscrizione: le domande che prima stavano su Google Form, e i
 * file da caricare.
 *
 * Si manda in due tempi: prima le risposte, che il server controlla e da cui
 * nasce la richiesta, poi i file uno alla volta nella sua cartella. Se un
 * file non parte (la rete, una foto troppo grande) le risposte sono già
 * arrivate, e si riprova solo quello, entro un'ora.
 *
 * Cosa non va si scrive sotto il campo: quando lo si lascia, se è scritto
 * male, e tutto insieme quando si prova a mandare, anche quello che manca.
 *
 * Il modulo delle autorizzazioni si firma qui col dito: si scelgono le
 * caselle del foglio, si firma, e al momento di mandare se ne fa il PDF
 * compilato coi dati delle domande (`src/lib/firma.ts`), che parte come
 * MODULO FIRMATO al posto della foto. Chi ha già il foglio firmato a mano ne
 * carica la foto come prima.
 *
 * Con `nucleo` è una persona in più nel nucleo familiare di un iscritto,
 * dalla sua area (vedi `nucleo.ts`): il modulo parte coi dati che il titolare
 * ha già dato (cognome, residenza, contatti, e lui come genitore), dice
 * quanto costa con lo sconto famiglia e come pagarlo, e per un minore il
 * documento del genitore non serve: la segreteria ha già il suo.
 *
 * Il documento d'identità e il certificato medico si caricano qui, per
 * comodità: la segreteria li stampa, li tiene su carta e li cancella
 * dall'app. Il certificato, se non c'è ancora, si può anche portare dopo.
 */

/** Una persona in più nel nucleo: chi la aggiunge, cosa si sa già, e gli annuali che il nucleo paga. */
export interface PerIlNucleo {
  titolare: string
  dati: Partial<DatiRichiesta>
  abbonamenti: Abbonamento[]
}

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
  telefono2: '',
  genitoreNome: '',
  genitoreCognome: '',
  genitoreCodiceFiscale: '',
  corsi: [],
  formula: 'trimestre',
  note: '',
  regolamento: false,
}

/** Il campo da cui si comincia a correggere, nell'ordine in cui si compila. */
const ID: Record<CampoModulo, string> = {
  nome: 'm-nome',
  cognome: 'm-cognome',
  natoIl: 'm-nato-il',
  natoA: 'm-nato-a',
  codiceFiscale: 'm-cf',
  genitoreNome: 'm-g-nome',
  genitoreCognome: 'm-g-cognome',
  genitoreCodiceFiscale: 'm-g-cf',
  indirizzo: 'm-indirizzo',
  cap: 'm-cap',
  comune: 'm-comune',
  email: 'm-email',
  telefono: 'm-tel',
  telefono2: 'm-tel2',
  corsi: 'm-corsi',
  formula: 'm-formula',
  regolamento: 'm-regolamento',
}

/** Le caselle del foglio: finché non si sceglie, nessuna. */
type Scelte = { [K in keyof SceltaModulo]?: boolean }

type Fase = { tipo: 'compila' } | { tipo: 'invio'; passo: string } | { tipo: 'file'; id: string; mancati: TipoFile[]; perche: string } | { tipo: 'fatto' }

export function ModuloIscrizione({ onChiudi, nucleo, torna = 'TORNA ALLE ISCRIZIONI' }: { onChiudi: () => void; nucleo?: PerIlNucleo; torna?: string }) {
  const [d, setD] = useState<DatiRichieste | null>(null)
  const [corsi, setCorsi] = useState<CorsoAperto[] | null>(null)
  const [guaioCorsi, setGuaioCorsi] = useState<string | null>(null)
  const [b, setB] = useState<DatiRichiesta>(() => ({ ...VUOTO, ...nucleo?.dati }))
  const [file, setFile] = useState<Partial<Record<TipoFile, File>>>({})
  const [privacy, setPrivacy] = useState(false)
  // Il modulo: firmato qui, o la foto del foglio firmato a mano.
  const [come, setCome] = useState<'qui' | 'foto'>('qui')
  const [scelte, setScelte] = useState<Scelte>({})
  const [tratti, setTratti] = useState<Tratto[]>([])
  const [genitoreNatoA, setGenitoreNatoA] = useState('')
  const [genitoreProvincia, setGenitoreProvincia] = useState('')
  const [luoghi, setLuoghi] = useState<Luoghi | null>(null)
  const [guaioFirma, setGuaioFirma] = useState<string | null>(null)
  // Un campo che una persona non vede e un programma riempie.
  const [trappola, setTrappola] = useState('')
  const [guaio, setGuaio] = useState<string | null>(null)
  const [fase, setFase] = useState<Fase>({ tipo: 'compila' })
  // I campi già lasciati, e se si è già provato a mandare: prima, niente rosso.
  const [visti, setVisti] = useState<ReadonlySet<CampoModulo>>(new Set())
  const [provato, setProvato] = useState(false)

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

  // Se l'elenco non arriva, il luogo si scrive a mano come prima.
  useEffect(() => void caricaLuoghi().then(setLuoghi, () => {}), [])
  // Il luogo di nascita lo dice il codice fiscale: quando lo si trova, non si scrive.
  const luogo = luoghi && luogoDaCf(luoghi, pulisciCf(b.codiceFiscale), b.natoIl)
  const luogoGenitore = luoghi && luogoDaCf(luoghi, pulisciCf(b.genitoreCodiceFiscale ?? ''))
  const natoAGenitore = luogoGenitore?.nome ?? genitoreNatoA
  const provinciaGenitore = luogoGenitore?.sigla ?? genitoreProvincia

  const minore = !!b.natoIl && minorenne(b.natoIl)
  const pronta: DatiRichiesta = {
    ...b,
    natoA: luogo ? scriviLuogo(luogo) : b.natoA,
    genitoreNome: minore ? b.genitoreNome : '',
    genitoreCognome: minore ? b.genitoreCognome : '',
    genitoreCodiceFiscale: minore ? b.genitoreCodiceFiscale : '',
  }
  // Se chi firma cambia (la data di nascita dice minore, o non più), la firma
  // di prima non è la sua.
  useEffect(() => setTratti([]), [minore])
  const firmatario = minore ? `${(b.genitoreNome ?? '').trim()} ${(b.genitoreCognome ?? '').trim()}`.trim() : `${b.nome.trim()} ${b.cognome.trim()}`.trim()
  const foglio = MODULI[minore ? 1 : 0]
  const certificato = certificatoDaPortare(
    b.natoIl,
    (corsi ?? []).filter((c) => b.corsi.includes(c.id)).map((c) => c.nome),
  )

  /** Per un minore del nucleo il documento è quello del genitore, che la segreteria ha già. */
  const documento = !(nucleo && minore)
  /** I file da chiedere: il documento solo se serve, il certificato solo dai 6 anni. */
  const daChiedere = FILE.filter((f) => (documento || !f.tipo.startsWith('documento')) && (certificato !== 'nessuno' || f.tipo !== 'certificato'))
  const obbligatorio = (t: TipoFile) => daChiedere.some((f) => f.tipo === t && f.obbligatorio)

  const errori = problemi(pronta)
  /** Cosa scrivere sotto un campo: «Manca» solo dopo aver provato a mandare. */
  const nota = (k: CampoModulo): Nota | undefined => {
    const e = errori[k]
    if (e && (provato || (visti.has(k) && e !== 'Manca'))) return { testo: e, guaio: true }
  }
  /** Le proprietà che legano un campo alla sua nota. */
  const segna = (k: CampoModulo) => {
    const n = nota(k)
    return {
      onBlur: () => !visti.has(k) && setVisti(new Set(visti).add(k)),
      'aria-invalid': n?.guaio || undefined,
      'aria-describedby': n ? `${ID[k]}-nota` : undefined,
    }
  }
  const metti = (k: keyof DatiRichiesta) => (e: { target: { value: string } }) => setB({ ...b, [k]: e.target.value })
  const scegli = (id: string) => setB({ ...b, corsi: b.corsi.includes(id) ? b.corsi.filter((c) => c !== id) : [...b.corsi, id] })

  /** Cosa manca per fare il modulo firmato; `null` se si può. */
  const mancaPerFirmare = (): string | null => {
    if (scelte.tesseramento === undefined) return 'Nel modulo: scegli se acconsenti al tesseramento alla FIJLKAM e/o FIPE'
    if (scelte.foto === undefined) return 'Nel modulo: scegli se autorizzi le foto'
    if (minore && !natoAGenitore.trim()) return 'Nel modulo: manca dove è nato il genitore'
    if (!firmaVera(tratti)) return tratti.length ? 'La firma è troppo piccola: firma per bene nel riquadro' : 'Manca la firma sul modulo'
    return null
  }

  /** Il PDF del modulo, compilato coi dati di adesso e firmato. */
  const faiModulo = async (): Promise<File> => {
    const [{ moduloFirmato }, originale, firma] = await Promise.all([
      import('../lib/firma'),
      fetch(foglio.file).then((r) => {
        if (!r.ok) throw new Error('Il modulo non si scarica')
        return r.arrayBuffer()
      }),
      firmaPng(tratti),
    ])
    const pdf = await moduloFirmato({
      dati: pronta,
      minore,
      scelte: { tesseramento: !!scelte.tesseramento, foto: !!scelte.foto },
      genitoreNatoA: natoAGenitore,
      genitoreProvincia: provinciaGenitore,
      firma,
      originale,
      stagione: STAGIONE,
    })
    return new File([new Uint8Array(pdf)], 'modulo-firmato.pdf', { type: 'application/pdf' })
  }

  /** Il modulo com'è venuto, in un'altra scheda, prima di mandarlo. */
  const guarda = async () => {
    const manca = mancaPerFirmare()
    setGuaioFirma(manca)
    if (manca) return
    // La scheda si apre subito, al tocco: dopo un'attesa il telefono la bloccherebbe.
    const scheda = window.open('', '_blank')
    try {
      const url = URL.createObjectURL(await faiModulo())
      if (scheda) scheda.location.href = url
      else window.location.assign(url)
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e) {
      scheda?.close()
      setGuaioFirma(`Il modulo non si prepara: ${e instanceof Error ? e.message : 'riprova'}`)
    }
  }

  const carica = async (id: string, quali: TipoFile[], tutti = file) => {
    const mancati: TipoFile[] = []
    let perche = ''
    for (const tipo of quali) {
      const f = tutti[tipo]
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
    setProvato(true)
    const primo = (Object.keys(ID) as CampoModulo[]).find((k) => errori[k])
    if (primo) setTimeout(() => document.getElementById(ID[primo])?.focus(), 0)
    const manca =
      controlla(pronta) ??
      (come === 'qui' ? mancaPerFirmare() : null) ??
      FILE.filter((f) => obbligatorio(f.tipo) && !file[f.tipo] && !(f.tipo === 'modulo' && come === 'qui')).map((f) => `Manca: ${f.etichetta.toLowerCase()}`)[0]
    if (manca) return setGuaio(manca)
    if (!privacy) return setGuaio("Serve la conferma di aver letto l'informativa privacy")
    // Il modulo firmato si fa prima di mandare le risposte: se non viene, non
    // nasce una richiesta senza modulo.
    let tutti = file
    if (come === 'qui') {
      setFase({ tipo: 'invio', passo: 'Preparo il modulo firmato…' })
      try {
        tutti = { ...file, modulo: await faiModulo() }
      } catch (e) {
        setFase({ tipo: 'compila' })
        return setGuaio(`Il modulo firmato non si prepara (${e instanceof Error ? e.message : 'riprova'}): riprova, o caricane la foto`)
      }
      setFile(tutti)
    }
    setFase({ tipo: 'invio', passo: 'Mando le risposte…' })
    let id: string
    try {
      id = await d!.invia(pronta)
    } catch (e) {
      setFase({ tipo: 'compila' })
      return setGuaio(e instanceof Error ? e.message : 'Il server non risponde: riprova fra poco')
    }
    await carica(id, daChiedere.map((f) => f.tipo), tutti)
  }

  if (fase.tipo === 'fatto') {
    return (
      <div className="pad stack esito">
        <TitoloEsito tono="fatto">RICHIESTA ARRIVATA</TitoloEsito>
        <span className="esito-testo">
          Grazie. La segreteria controlla il modulo, il documento e il pagamento, e ti scrive a {b.email.trim() || 'la tua email'} se manca qualcosa.
        </span>
        {certificato !== 'nessuno' && !file.certificato && (
          <span className="esito-testo">
            Ricorda di consegnare in segreteria il certificato medico{certificato === 'agonistico' ? ' agonistico' : ''}: senza non si partecipa alle lezioni.
          </span>
        )}
        {!file.ricevuta && <span className="esito-testo">Non hai caricato la ricevuta: paga in segreteria, o portala lì se hai già pagato.</span>}
        <Tasto onClick={onChiudi}>{torna}</Tasto>
      </div>
    )
  }

  if (fase.tipo === 'file') {
    return (
      <div className="pad stack esito">
        <TitoloEsito tono="avviso">MANCA QUALCHE FILE</TitoloEsito>
        <span className="esito-testo">
          Le risposte sono arrivate. Non è partito: {fase.mancati.map((t) => FILE.find((f) => f.tipo === t)!.etichetta.toLowerCase()).join(', ')}.
        </span>
        <Dettaglio tono="guaio">{fase.perche}</Dettaglio>
        {fase.mancati.map((t) => (
          <SceltaFile key={t} tipo={t} file={file[t]} onFile={(f) => setFile((p) => ({ ...p, [t]: f }))} />
        ))}
        <Tasto variante="principale" onClick={() => void carica(fase.id, fase.mancati)}>
          RIPROVA
        </Tasto>
        <Dettaglio>Si può riprovare per un'ora. Se non va, porta i fogli in segreteria.</Dettaglio>
      </div>
    )
  }

  const inVolo = fase.tipo === 'invio'
  return (
    <form className="stack modulo" onSubmit={(e) => void manda(e)} noValidate>
      <div className="pad row modulo-testa">
        <Tasto onClick={onChiudi} disabled={inVolo}>
          ← INDIETRO
        </Tasto>
        {d?.modo === 'prova' && <Bollino>PROVA: RESTA SU QUESTO DISPOSITIVO</Bollino>}
      </div>

      {nucleo && (
        <div className="pad">
          <Riquadro tono="prova">
            <span className="passo-titolo">Una persona in più nel nucleo di {nucleo.titolare}</span>
            <Dettaglio>
              Cognome, residenza e contatti sono quelli che la segreteria ha già, e per un minore il genitore sei tu: cambia quello che non va. La
              richiesta arriva in segreteria come le altre, e accolta la trovi nella tua pagina.
            </Dettaglio>
          </Riquadro>
        </div>
      )}

      <Sezione titolo="CHI SI ISCRIVE">
        <Campo id="m-nome" nota={nota('nome')} etichetta="NOME">
          <input id="m-nome" {...segna('nome')} className="campo" autoComplete="given-name" value={b.nome} onChange={metti('nome')} />
        </Campo>
        <Campo id="m-cognome" nota={nota('cognome')} etichetta="COGNOME">
          <input id="m-cognome" {...segna('cognome')} className="campo" autoComplete="family-name" value={b.cognome} onChange={metti('cognome')} />
        </Campo>
        <Campo id="m-nato-il" nota={nota('natoIl')} etichetta="DATA DI NASCITA">
          <input id="m-nato-il" {...segna('natoIl')} className="campo" type="date" value={b.natoIl} onChange={metti('natoIl')} />
        </Campo>
        <Campo id="m-cf" nota={nota('codiceFiscale')} etichetta="CODICE FISCALE" largo>
          <input id="m-cf" {...segna('codiceFiscale')} className="campo num campo-codice" autoCapitalize="characters" spellCheck={false} maxLength={20} value={b.codiceFiscale} onChange={metti('codiceFiscale')} />
        </Campo>
        <Campo id="m-nato-a" nota={nota('natoA')} etichetta="LUOGO DI NASCITA">
          <input
            id="m-nato-a"
            {...segna('natoA')}
            className="campo"
            readOnly={!!luogo}
            placeholder={luoghi ? 'Lo dice il codice fiscale' : undefined}
            value={pronta.natoA}
            onChange={metti('natoA')}
          />
        </Campo>
        {minore && (
          <span className="modulo-largo">
            <Dettaglio tono="avviso">È minorenne: servono i dati del genitore qui sotto, e il modulo per minori, che firma il genitore.</Dettaglio>
          </span>
        )}
      </Sezione>

      {minore && (
        <Sezione titolo="IL GENITORE">
          <Campo id="m-g-nome" nota={nota('genitoreNome')} etichetta="NOME">
            <input id="m-g-nome" {...segna('genitoreNome')} className="campo" value={b.genitoreNome} onChange={metti('genitoreNome')} />
          </Campo>
          <Campo id="m-g-cognome" nota={nota('genitoreCognome')} etichetta="COGNOME">
            <input id="m-g-cognome" {...segna('genitoreCognome')} className="campo" value={b.genitoreCognome} onChange={metti('genitoreCognome')} />
          </Campo>
          <Campo id="m-g-cf" nota={nota('genitoreCodiceFiscale')} etichetta="CODICE FISCALE DEL GENITORE" largo>
            <input id="m-g-cf" {...segna('genitoreCodiceFiscale')} className="campo num campo-codice" autoCapitalize="characters" spellCheck={false} maxLength={20} value={b.genitoreCodiceFiscale} onChange={metti('genitoreCodiceFiscale')} />
          </Campo>
        </Sezione>
      )}

      <Sezione titolo="RESIDENZA">
        <Campo id="m-indirizzo" nota={nota('indirizzo')} etichetta="VIA E NUMERO" largo>
          <input id="m-indirizzo" {...segna('indirizzo')} className="campo" autoComplete="street-address" value={b.indirizzo} onChange={metti('indirizzo')} />
        </Campo>
        <Campo id="m-cap" nota={nota('cap')} etichetta="CAP">
          <input id="m-cap" {...segna('cap')} className="campo num" inputMode="numeric" autoComplete="postal-code" maxLength={5} value={b.cap} onChange={metti('cap')} />
        </Campo>
        <Campo id="m-comune" nota={nota('comune')} etichetta="COMUNE">
          <input id="m-comune" {...segna('comune')} className="campo" autoComplete="address-level2" value={b.comune} onChange={metti('comune')} />
        </Campo>
      </Sezione>

      <Sezione titolo={minore ? 'COME RAGGIUNGERE IL GENITORE' : 'COME RAGGIUNGERTI'}>
        <Campo id="m-email" nota={nota('email')} etichetta="EMAIL">
          <input id="m-email" {...segna('email')} className="campo" type="email" autoComplete="email" value={b.email} onChange={metti('email')} />
        </Campo>
        <Campo id="m-tel" nota={nota('telefono')} etichetta="TELEFONO">
          <input id="m-tel" {...segna('telefono')} className="campo" type="tel" autoComplete="tel" value={b.telefono} onChange={metti('telefono')} />
        </Campo>
        <Campo id="m-tel2" nota={nota('telefono2')} etichetta="TELEFONO 2 · FACOLTATIVO">
          <input id="m-tel2" {...segna('telefono2')} className="campo" type="tel" value={b.telefono2} onChange={metti('telefono2')} />
        </Campo>
      </Sezione>

      <Sezione titolo="I CORSI">
        <div className="modulo-campo modulo-largo">
          {guaioCorsi && <Dettaglio tono="guaio">I corsi non si leggono: {guaioCorsi}</Dettaglio>}
          {!corsi && !guaioCorsi && <Dettaglio>Un attimo…</Dettaglio>}
          <SceltaCorsi
            id="m-corsi"
            etichetta="Corsi"
            voci={(corsi ?? []).map((c) => ({ id: c.id, testo: c.nome }))}
            scelti={b.corsi}
            onScegli={scegli}
            descritto={nota('corsi') ? 'm-corsi-nota' : undefined}
          />
          <NotaCampo id="m-corsi-nota" nota={nota('corsi')} />
        </div>
        <div className="modulo-campo modulo-largo">
          <span className="modulo-etichetta">COME PAGHI</span>
          <SceltaCorsi
            id="m-formula"
            etichetta="Come paghi"
            una
            voci={FORMULE.map(([f, testo]) => ({ id: f, testo }))}
            scelti={[b.formula]}
            onScegli={(f) => setB({ ...b, formula: f as DatiRichiesta['formula'] })}
          />
        </div>
        {nucleo && (
          <QuantoCosta
            nome={b.nome.trim() || 'Chi si iscrive'}
            cognome={b.cognome.trim()}
            corsi={(corsi ?? []).filter((c) => b.corsi.includes(c.id)).map((c) => c.nome)}
            formula={b.formula}
            abbonamenti={nucleo.abbonamenti}
          />
        )}
      </Sezione>

      <Sezione titolo="IL MODULO">
        <div className="modulo-campo modulo-largo">
          <Dettaglio tono="testo">
            Le autorizzazioni {minore ? 'per minori, che firma il genitore' : 'per maggiorenni'}: il tesseramento, le foto e la privacy.{' '}
            <a href={foglio.file} target="_blank" rel="noreferrer" className="link-sec">
              Leggi il modulo
            </a>
            .
          </Dettaglio>
          <SceltaCorsi
            id="m-come"
            etichetta="Come firmi il modulo"
            una
            voci={[
              { id: 'qui', testo: 'Firmo qui' },
              { id: 'foto', testo: 'Ho il foglio firmato' },
            ]}
            scelti={[come]}
            onScegli={(c) => setCome(c as 'qui' | 'foto')}
          />
        </div>
        {come === 'foto' ? (
          <SceltaFile tipo="modulo" file={file.modulo} onFile={(x) => setFile((p) => ({ ...p, modulo: x }))} />
        ) : (
          <>
            <Casella
              id="m-tesseramento"
              etichetta="IL TESSERAMENTO ALLA FIJLKAM E/O FIPE"
              dettaglio={`Per la stagione ${STAGIONE}.`}
              si={minore ? 'Autorizzo' : 'Acconsento'}
              no={minore ? 'Non autorizzo' : 'Non acconsento'}
              scelta={scelte.tesseramento}
              onScegli={(x) => setScelte({ ...scelte, tesseramento: x })}
            />
            <Casella
              id="m-foto"
              etichetta={minore ? 'LE FOTO E I VIDEO DEL MINORE' : 'LE FOTO SUI SOCIAL'}
              dettaglio={minore ? 'Sui canali social della palestra e nei volantini e manifesti dei suoi eventi.' : 'Le foto che ti ritraggono, sui social della palestra.'}
              si="Autorizzo"
              no="Non autorizzo"
              scelta={scelte.foto}
              onScegli={(x) => setScelte({ ...scelte, foto: x })}
            />
            {minore && (
              <>
                <Campo id="m-g-nato-a" etichetta="DOVE È NATO IL GENITORE">
                  <input id="m-g-nato-a" className="campo" readOnly={!!luogoGenitore} value={natoAGenitore} onChange={(e) => setGenitoreNatoA(e.target.value)} />
                </Campo>
                <Campo id="m-g-prov" etichetta="PROVINCIA · SIGLA">
                  <input
                    id="m-g-prov"
                    className="campo campo-codice"
                    autoCapitalize="characters"
                    maxLength={2}
                    readOnly={!!luogoGenitore}
                    value={provinciaGenitore}
                    onChange={(e) => setGenitoreProvincia(e.target.value.toUpperCase())}
                  />
                </Campo>
              </>
            )}
            <div className="modulo-campo modulo-largo">
              <label htmlFor="m-firma" className="modulo-etichetta">
                {firmatario ? (
                  <>
                    LA FIRMA DI <span className="modulo-firmatario">{firmatario}</span>
                  </>
                ) : minore ? (
                  'LA FIRMA DEL GENITORE'
                ) : (
                  'LA FIRMA'
                )}
              </label>
              <TavolaFirma
                id="m-firma"
                tratti={tratti}
                onTratti={(t) => {
                  setTratti(t)
                  setGuaioFirma(null)
                }}
                descritto="m-firma-nota"
              />
              <Dettaglio>
                <span id="m-firma-nota">
                  I dati delle domande, le caselle scelte, la data e la firma si scrivono sul modulo, e la firma va in ogni riga dove serve.
                </span>
              </Dettaglio>
              {guaioFirma && <Dettaglio tono="guaio">{guaioFirma}</Dettaglio>}
              <Tasti>
                <Tasto onClick={() => setTratti([])} disabled={!tratti.length}>
                  CANCELLA LA FIRMA
                </Tasto>
                <Tasto onClick={() => void guarda()}>GUARDA IL MODULO</Tasto>
              </Tasti>
            </div>
          </>
        )}
      </Sezione>

      <Sezione titolo="I FILE">
        {certificato !== 'nessuno' && (
          <div className="modulo-campo modulo-largo">
            <span className="modulo-etichetta">{certificato === 'agonistico' ? 'IL CERTIFICATO MEDICO AGONISTICO' : 'IL CERTIFICATO MEDICO'}</span>
            <Dettaglio tono="avviso">
              {certificato === 'agonistico'
                ? 'Per judo, aikido e lotta, dai 12 anni serve il certificato medico agonistico.'
                : 'Dai 6 anni il certificato medico è obbligatorio.'}{' '}
              Caricalo qui sotto, o consegnalo in segreteria: senza non si partecipa alle lezioni.
            </Dettaglio>
          </div>
        )}
        {daChiedere.filter((f) => f.tipo !== 'modulo').map((f) => (
          <SceltaFile
            key={f.tipo}
            tipo={f.tipo}
            file={file[f.tipo]}
            onFile={(x) => setFile((p) => ({ ...p, [f.tipo]: x }))}
            facoltativo={!obbligatorio(f.tipo)}
          />
        ))}
      </Sezione>

      <Sezione titolo="ALTRO">
        <Campo id="m-note" etichetta="NOTE PER LA SEGRETERIA · FACOLTATIVE" largo>
          <textarea id="m-note" className="campo campo-note" rows={3} maxLength={1000} placeholder="Niente dati sulla salute: quelli si portano in segreteria." value={b.note} onChange={metti('note')} />
        </Campo>
        <div className="vh" aria-hidden>
          <label htmlFor="m-sito">Non compilare</label>
          <input id="m-sito" tabIndex={-1} autoComplete="off" value={trappola} onChange={(e) => setTrappola(e.target.value)} />
        </div>
        <div className="modulo-largo">
          <label className="modulo-privacy">
            <input
              id="m-regolamento"
              type="checkbox"
              checked={!!b.regolamento}
              onChange={(e) => setB({ ...b, regolamento: e.target.checked })}
              aria-describedby={nota('regolamento') ? 'm-regolamento-nota' : undefined}
            />
            <span>
              Accetto il{' '}
              {REGOLAMENTO ? (
                <a href={REGOLAMENTO} target="_blank" rel="noreferrer" className="link-sec">
                  Regolamento Sociale
                </a>
              ) : (
                'Regolamento Sociale'
              )}{' '}
              dell'associazione.
            </span>
          </label>
          <NotaCampo id="m-regolamento-nota" nota={nota('regolamento')} />
        </div>
        <label className="modulo-largo modulo-privacy">
          <input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} />
          <span>
            Ho letto{' '}
            {INFORMATIVA_PUBBLICA ? (
              <a href={INFORMATIVA_PUBBLICA} target="_blank" rel="noreferrer" className="link-sec">
                l'informativa privacy
              </a>
            ) : (
              "l'informativa privacy"
            )}{' '}
            e so che questi dati li legge solo la segreteria della palestra.
          </span>
        </label>
      </Sezione>

      <div className="pad stack modulo-piede">
        {guaio && (
          <div role="alert">
            <Riquadro tono="guaio">{guaio}</Riquadro>
          </div>
        )}
        <Tasto variante="principale" type="submit" disabled={inVolo || !d}>
          {inVolo ? fase.passo.toUpperCase() : 'MANDA LA RICHIESTA'}
        </Tasto>
      </div>
    </form>
  )
}

function Sezione({ titolo, children }: { titolo: string; children: ReactNode }) {
  return (
    <section>
      <Titoletto>{titolo}</Titoletto>
      <div className="pad modulo-griglia">{children}</div>
    </section>
  )
}

/** Una casella del modulo: sì o no, e finché non si sceglie nessuna delle due. */
function Casella({
  id,
  etichetta,
  dettaglio,
  si,
  no,
  scelta,
  onScegli,
}: {
  id: string
  etichetta: string
  dettaglio: string
  si: string
  no: string
  scelta?: boolean
  onScegli: (x: boolean) => void
}) {
  return (
    <div className="modulo-campo modulo-largo">
      <span className="modulo-etichetta">{etichetta}</span>
      <Dettaglio>{dettaglio}</Dettaglio>
      <SceltaCorsi
        id={id}
        etichetta={etichetta.toLowerCase()}
        una
        voci={[
          { id: 'si', testo: si },
          { id: 'no', testo: no },
        ]}
        scelti={scelta === undefined ? [] : [scelta ? 'si' : 'no']}
        onScegli={(x) => onScegli(x === 'si')}
      />
    </div>
  )
}

/** Un file da scegliere: controlla il tipo, rimpicciolisce la foto, e la passa su. */
function SceltaFile({
  tipo,
  file,
  onFile,
  facoltativo,
  dettaglio,
}: {
  tipo: TipoFile
  file?: File
  onFile: (f: File | undefined) => void
  facoltativo?: boolean
  dettaglio?: string
}) {
  const f = FILE.find((x) => x.tipo === tipo)!
  const [guaio, setGuaio] = useState<string | null>(null)
  const [lavoro, setLavoro] = useState(false)
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
    <CaricaFile
      id={`m-file-${tipo}`}
      etichetta={f.etichetta}
      seManca={(facoltativo ?? !f.obbligatorio) ? (f.seManca ?? 'FACOLTATIVO') : undefined}
      dettaglio={lavoro ? 'Preparo la foto…' : (dettaglio ?? f.dettaglio)}
      file={file && !lavoro ? { nome: file.name, byte: file.size } : undefined}
      errore={guaio}
      onFile={(x) => void scelto(x)}
    />
  )
}

/**
 * Quanto costa una persona in più nel nucleo, con lo sconto famiglia, e come
 * pagarlo: l'IBAN e la causale col suo nome, da copiare. La ricevuta del
 * bonifico si carica qui sotto, fra i file, se si paga prima.
 */
function QuantoCosta({ nome, cognome, corsi, formula, abbonamenti }: { nome: string; cognome: string; corsi: string[]; formula: DatiRichiesta['formula']; abbonamenti: Abbonamento[] }) {
  const letto = useListino()
  const [copiato, setCopiato] = useState<string | null>(null)
  if (!letto) return null
  const s = stimaIscrizione({ chi: nome, corsi, formula }, abbonamenti, chiaveGiorno(new Date()), letto.listino)
  const testo = causale(nome, cognome, corsi)
  const copia = (cosa: string, valore: string) =>
    navigator.clipboard?.writeText(valore).then(
      () => {
        setCopiato(cosa)
        setTimeout(() => setCopiato(null), 2000)
      },
      () => {},
    )
  return (
    <div className="modulo-campo modulo-largo">
      <span className="modulo-etichetta">QUANTO COSTA</span>
      <Riquadro stretto>
        {corsi.length === 0 && <Dettaglio>Scegli i corsi per vedere quanto costa.</Dettaglio>}
        <ul className="stack stima">
          {s.righe.map((r) => (
            <li key={r.testo} className="row stima-riga" data-sconto={r.importo < 0 || undefined}>
              <span className="grow">{r.testo}</span>
              <span className="num">{r.importo < 0 ? '−' : ''}{euro(Math.abs(r.importo))} €</span>
            </li>
          ))}
          <li className="row stima-riga stima-totale">
            <span className="grow">Totale</span>
            <span className="num">{euro(s.totale)} €</span>
          </li>
        </ul>
        {s.sconto && !s.sconto.qui && (
          <Dettaglio>
            Lo sconto famiglia va sull’annuale che costa meno nel nucleo: {s.sconto.corso} di {s.sconto.chi}, che l’ha già avuto o lo avrà in segreteria.
          </Dettaglio>
        )}
        {formula === 'trimestre' && abbonamenti.length > 0 && <Dettaglio>Lo sconto famiglia vale sugli annuali, non sul trimestre.</Dettaglio>}
        {s.senzaPrezzo.length > 0 && <Dettaglio tono="avviso">Senza prezzo nel listino: {s.senzaPrezzo.join(', ')}. Lo dice la segreteria.</Dettaglio>}
        <Dettaglio>
          È una stima dal listino: le altre offerte e l’importo giusto li conferma la segreteria. Bonifico a {PAGAMENTO.intestatario}:
        </Dettaglio>
        <span className="num iban">{PAGAMENTO.iban}</span>
        <Dettaglio>
          Causale: <span className="testo-pieno">{testo}</span>
        </Dettaglio>
        <Tasti>
          <Tasto onClick={() => void copia('iban', PAGAMENTO.iban.replace(/\s/g, ''))}>{copiato === 'iban' ? 'COPIATO' : 'COPIA IBAN'}</Tasto>
          <Tasto onClick={() => void copia('causale', testo)}>{copiato === 'causale' ? 'COPIATA' : 'COPIA CAUSALE'}</Tasto>
          {PAGAMENTO.satispay && <Tasto href={PAGAMENTO.satispay}>PAGA CON SATISPAY</Tasto>}
        </Tasti>
      </Riquadro>
    </div>
  )
}
