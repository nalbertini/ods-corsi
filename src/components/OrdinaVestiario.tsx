import { useEffect, useState } from 'react'
import { INDIRIZZO_VESTIARIO } from '../lib/cancelletti'
import { INFORMATIVA_PUBBLICA, PAGAMENTO } from '../lib/iscrizione'
import { CONTATTI, chiama } from '../lib/sito'
import { chiaveGiorno } from '../lib/sala'
import { indirizzo, INDIRIZZI } from '../lib/aree'
import { alGiorno, causaleVestiario, cosaNonVaOrdine, ilGiorno, inEuro, MAX_QUANTI, MAX_RIGHE, MAX_RIGHE_DETTO, prezzoDi, riepilogoOrdine, totaleOrdine, type Capo, type Catalogo, type DatiVestiario, type Ordine, type RigaNuova } from '../lib/vestiario'
import { mancaNellOrdine, statoPagina, tagliaDopo } from '../lib/vestiarioPagina'
import { apertiLetti, datiVestiario } from '../lib/vestiarioDati'
import { BarraPasso, Campo, Dettaglio, type Nota, Etichetta, Riquadro, Tasti, Tasto, TitoloEsito, Titoletto } from './ds'

/**
 * La pagina degli ordini di vestiario, dal link COPIA LINK ORDINI
 * (`iscrizioni/#vestiario`): il catalogo da leggere, le righe dell'ordine (per
 * chi, capo, taglia, quanti), chi ordina e il totale in vista nella barra in
 * fondo. Una pagina sola, senza passi: è un ordine, non un'iscrizione.
 *
 * Mandato, l'ordine non si rilegge da qui: ORDINE ARRIVATO dice come pagare e
 * dà il riepilogo da condividere. Le regole (aperti o chiusi, cosa non va, il
 * totale) stanno in `vestiario.ts`; il totale vero lo fa il server.
 */

type RigaScritta = RigaNuova & { chiave: number }

let contatore = 0
const rigaVuota = (perChi = ''): RigaScritta => ({ chiave: ++contatore, perChi, capo: '', taglia: '', quanti: 1 })
const CHI_VUOTO = { nome: '', cognome: '', telefono: '', email: '' }

/** «fino al 31 ottobre», «fino all'8 ottobre». */
const finoA = (g: string) => `fino ${alGiorno(g)}`

const contaCapi = (righe: ReadonlyArray<{ quanti: number }>) => righe.reduce((s, r) => s + r.quanti, 0)
const capiDetti = (n: number) => (n === 1 ? '1 capo' : `${n} capi`)

/**
 * Copia negli appunti e dice per due secondi che è fatto. Senza appunti (una
 * pagina non sicura, un browser vecchio) o se li rifiutano, il testo si fa
 * vedere da copiare a mano, come COPIA LINK in segreteria.
 */
function useCopia() {
  const [copiato, setCopiato] = useState<string | null>(null)
  const copia = (cosa: string, testo: string) => {
    if (!navigator.clipboard) return void window.prompt('Da copiare:', testo)
    navigator.clipboard.writeText(testo).then(
      () => {
        setCopiato(cosa)
        setTimeout(() => setCopiato(null), 2000)
      },
      () => window.prompt('Da copiare:', testo),
    )
  }
  return { copiato, copia }
}

/** La nota rossa sotto un campo che manca, dopo il primo MANDA L'ORDINE: dice cosa fare. */
const NOTE: Record<string, string> = {
  perChi: 'Scrivi per chi è: nome e cognome',
  capo: 'Scegli il capo',
  taglia: 'Scegli la taglia',
  nome: 'Scrivi il nome di chi ordina',
  cognome: 'Scrivi il cognome di chi ordina',
  telefono: 'Serve un telefono: la segreteria chiama chi non ha saldato',
}

export function OrdinaVestiario() {
  const [d, setD] = useState<DatiVestiario | null>(null)
  // `undefined` mentre si legge, `null` se il catalogo non c'è mai stato.
  const [catalogo, setCatalogo] = useState<Catalogo | null | undefined>(undefined)
  const [guaioLettura, setGuaioLettura] = useState<string | null>(null)
  const [tentativo, setTentativo] = useState(0)
  const [arrivato, setArrivato] = useState<Ordine | null>(null)
  // Chi ordina resta per FAI UN ALTRO ORDINE: è sempre lo stesso genitore.
  const [chi, setChi] = useState(CHI_VUOTO)

  useEffect(() => {
    let vivo = true
    setGuaioLettura(null)
    datiVestiario()
      .then(async (x) => {
        const c = await x.catalogo()
        if (!vivo) return
        setD(x)
        setCatalogo(c)
      })
      // Un messaggio solo: chi apre il link dal telefono non deve leggere il testo del server.
      // I messaggi di vestiarioDati sono già per chi legge; un pezzo dell'app che non arriva è la rete.
      .catch((e: unknown) => vivo && setGuaioLettura(e instanceof Error && !/dynamically imported|import/i.test(e.message) ? e.message : 'Non c’è rete: riprova quando torna'))
    return () => {
      vivo = false
    }
  }, [tentativo])

  if (guaioLettura)
    return (
      <div className="pad stack esito">
        <Riquadro tono="guaio">La pagina degli ordini non si è caricata: {guaioLettura}</Riquadro>
        <Tasto variante="principale" onClick={() => setTentativo((t) => t + 1)}>
          RIPROVA
        </Tasto>
      </div>
    )
  if (catalogo === undefined || !d) return <p className="pad esito-testo">Un attimo…</p>

  if (arrivato && catalogo?.chiude)
    return (
      <Arrivato
        o={arrivato}
        chiude={catalogo.chiude}
        onAltro={() => {
          setArrivato(null)
          document.querySelector('.scroll')?.scrollTo(0, 0)
        }}
      />
    )
  const stato = statoPagina(catalogo, apertiLetti(), chiaveGiorno(new Date()))
  if (stato !== 'aperti' || !catalogo?.chiude) return <Chiusi chiuso={stato === 'chiusi' && catalogo?.chiude ? catalogo.chiude : null} />
  return (
    <Ordina
      d={d}
      chi={chi}
      onChi={setChi}
      capi={catalogo.capi}
      chiude={catalogo.chiude}
      onArrivato={(o) => {
        setArrivato(o)
        document.querySelector('.scroll')?.scrollTo(0, 0)
      }}
    />
  )
}

function Ordina({
  d,
  chi,
  onChi: setChi,
  capi,
  chiude,
  onArrivato,
}: {
  d: DatiVestiario
  chi: typeof CHI_VUOTO
  onChi: (c: typeof CHI_VUOTO) => void
  capi: Capo[]
  chiude: string
  onArrivato: (o: Ordine) => void
}) {
  const [righe, setRighe] = useState<RigaScritta[]>(() => [rigaVuota()])
  // L'id dell'ordine nasce qui, una volta: rimandato dopo un «Non c'è rete» è lo stesso
  // ordine, non un secondo. FAI UN ALTRO ORDINE rimonta il modulo e ne fa uno nuovo.
  const [id] = useState(() => crypto.randomUUID())
  const [inVolo, setInVolo] = useState(false)
  const [guaio, setGuaio] = useState<string | null>(null)
  const [provato, setProvato] = useState(false)

  const ordine = { id, ...chi, righe: righe.map(({ chiave: _, ...r }) => r) }
  // «Il nome di chi ordina»: più chiaro di «il tuo» quando ordina un nonno o una zia.
  const manca = mancaNellOrdine(ordine, capi)
  /** Rosso e la nota, ma solo dopo aver provato a mandare: un modulo appena aperto non è sbagliato. */
  const nota = (chiave: string): Nota | undefined => {
    const m = provato ? manca.find((x) => x.chiave === chiave) : undefined
    if (!m) return undefined
    // Scritto male non è vuoto: la nota dice cosa non va, con le parole della barra.
    return { testo: m.scrittoMale ? m.nome : NOTE[chiave.replace(/^r\d+-/, '')], guaio: true }
  }
  const scelte = righe.filter((r) => r.capo)
  const totale = totaleOrdine(scelte.map((r) => ({ quanti: r.quanti, prezzo: prezzoDi(capi, r.capo) })))
  const entro = ilGiorno(chiude)

  const vai = (chiave: string) => {
    const x = document.getElementById(`v-${chiave}`)
    x?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    x?.focus({ preventScroll: true })
  }
  const cambia = (chiave: number, x: Partial<RigaNuova>) => setRighe((rr) => rr.map((r) => (r.chiave === chiave ? { ...r, ...x } : r)))
  // Il campo da scrivere della riga nuova: il capo se il nome è già quello di sopra, se no il nome.
  const aggiungi = (perChi: string) => {
    const nuova = rigaVuota(perChi)
    setRighe((rr) => [...rr, nuova])
    setTimeout(() => vai(`r${righe.length}-${perChi ? 'capo' : 'perChi'}`), 0)
  }

  const manda = async () => {
    if (inVolo) return
    setGuaio(null)
    setProvato(true)
    if (manca[0]) return vai(manca[0].chiave)
    const no = cosaNonVaOrdine(ordine, capi)
    if (no) return setGuaio(no)
    // Il tasto si spegne finché il server non risponde: un secondo tocco non fa un secondo ordine.
    setInVolo(true)
    try {
      onArrivato(await d.inviaOrdine(ordine))
    } catch (e) {
      // Le risposte restano: si riprova con lo stesso tasto.
      setGuaio(e instanceof Error ? e.message : 'Non è andata: riprova fra poco')
    } finally {
      setInVolo(false)
    }
  }

  return (
    <div className="modulo stack vestiario">
      <Titoletto>ORDINA IL VESTIARIO</Titoletto>
      <div className="pad passo-dopo">
        <Riquadro tono="prova">
          <Etichetta>ORDINI APERTI {finoA(chiude).toUpperCase()}</Etichetta>
          <Dettaglio>
            Scegli i capi qui sotto, per uno o più figli. Paghi dopo, con bonifico, Satispay o in segreteria: al fornitore va solo quello pagato entro {entro}.
          </Dettaglio>
        </Riquadro>
      </div>

      <Titoletto conto={capiDetti(capi.length).toUpperCase()}>IL CATALOGO</Titoletto>
      <div className="pad stack passo-dopo" style={{ gap: 10 }}>
        {capi.map((c) => (
          <Riquadro key={c.capo} stretto>
            <span className="row prova-testa">
              <span className="grow passo-titolo">{c.capo}</span>
              <span className="num cifra">{inEuro(c.prezzo)}</span>
            </span>
            <Dettaglio>Taglie {c.taglie.join(', ')}.</Dettaglio>
            {c.nota && <Dettaglio>{c.nota}</Dettaglio>}
          </Riquadro>
        ))}
      </div>

      <Titoletto conto={capiDetti(contaCapi(scelte)).toUpperCase()}>IL TUO ORDINE</Titoletto>
      <div className="pad stack passo-dopo" style={{ gap: 10 }}>
        {righe.map((r, i) => (
          <RigaOrdine
            key={r.chiave}
            r={r}
            i={i}
            capi={capi}
            nota={nota}
            togli={righe.length > 1 ? () => setRighe((rr) => rr.filter((x) => x.chiave !== r.chiave)) : undefined}
            onCambia={(x) => cambia(r.chiave, x)}
          />
        ))}
        <button type="button" className="btn btn-dashed passo-btn" disabled={righe.length >= MAX_RIGHE} onClick={() => aggiungi(righe[righe.length - 1]?.perChi ?? '')}>
          + UN ALTRO CAPO
        </button>
        <button type="button" className="btn btn-dashed passo-btn" disabled={righe.length >= MAX_RIGHE} onClick={() => aggiungi('')}>
          + PER UN ALTRO FIGLIO
        </button>
        {righe.length >= MAX_RIGHE && <Dettaglio tono="avviso">{MAX_RIGHE_DETTO}</Dettaglio>}
      </div>

      <Titoletto>CHI ORDINA</Titoletto>
      <div className="pad modulo-griglia passo-dopo">
        <Campo id="v-nome" etichetta="NOME" nota={nota('nome')}>
          <input id="v-nome" className="campo" aria-invalid={!!nota('nome')} aria-describedby="v-nome-nota" autoComplete="given-name" maxLength={80} value={chi.nome} onChange={(e) => setChi({ ...chi, nome: e.target.value })} />
        </Campo>
        <Campo id="v-cognome" etichetta="COGNOME" nota={nota('cognome')}>
          <input id="v-cognome" className="campo" aria-invalid={!!nota('cognome')} aria-describedby="v-cognome-nota" autoComplete="family-name" maxLength={80} value={chi.cognome} onChange={(e) => setChi({ ...chi, cognome: e.target.value })} />
        </Campo>
        <Campo id="v-telefono" etichetta="TELEFONO" largo nota={nota('telefono')}>
          <input
            id="v-telefono"
            className="campo num"
            type="tel"
            autoComplete="tel"
            maxLength={30}
            aria-describedby="v-telefono-perche v-telefono-nota"
            aria-invalid={!!nota('telefono')}
            value={chi.telefono}
            onChange={(e) => setChi({ ...chi, telefono: e.target.value })}
          />
          {/* Perché serve, in grigio: è una spiegazione, non un avviso. */}
          <span id="v-telefono-perche" className="passo-dettaglio">
            La segreteria ti chiama se manca qualcosa o il pagamento non arriva.
          </span>
        </Campo>
        <Campo id="v-email" etichetta="EMAIL · FACOLTATIVA" largo nota={nota('email')}>
          <input id="v-email" className="campo" aria-invalid={!!nota('email')} aria-describedby="v-email-nota" type="email" autoComplete="email" maxLength={160} placeholder="nome@esempio.it" value={chi.email} onChange={(e) => setChi({ ...chi, email: e.target.value })} />
        </Campo>
      </div>

      {scelte.length > 0 && (
        <>
          <Titoletto conto={capiDetti(contaCapi(scelte)).toUpperCase()}>IL RIEPILOGO</Titoletto>
          <div className="pad passo-dopo">
            <Riquadro stretto>
              <ul className="stack stima">
                {scelte.map((r) => (
                  <li key={r.chiave} className="row stima-riga">
                    <span className="grow">
                      {r.perChi.trim() || 'Per chi?'} · {r.capo} {r.taglia}
                      {r.quanti > 1 ? ` × ${r.quanti}` : ''}
                    </span>
                    <span className="num">{inEuro(r.quanti * prezzoDi(capi, r.capo))}</span>
                  </li>
                ))}
                <li className="row stima-riga stima-totale">
                  <span className="grow">Totale</span>
                  <span className="num">{inEuro(totale)}</span>
                </li>
              </ul>
              <Dettaglio>Paghi dopo l’invio: ti diciamo come nella pagina che segue. Va al fornitore solo quello pagato entro {entro}.</Dettaglio>
            </Riquadro>
          </div>
        </>
      )}

      {INFORMATIVA_PUBBLICA && (
        <p className="pad iscrizioni-nota">
          I tuoi dati li legge solo la segreteria della palestra:{' '}
          <a href={INFORMATIVA_PUBBLICA} target="_blank" rel="noreferrer" className="link-sec">
            l'informativa privacy
          </a>
          .
        </p>
      )}

      {/* L'errore del server sta col tasto, nel fondo che resta in vista: in fondo alla pagina non lo vedeva nessuno. */}
      <div className="vestiario-fondo">
        {guaio && (
          <div className="pad vestiario-guaio" role="alert">
            <Riquadro tono="guaio">{guaio}</Riquadro>
          </div>
        )}
      <BarraPasso
        manca={manca}
        nota={manca.length ? undefined : 'Tutto pronto: puoi mandare l’ordine.'}
        // Con zero capi la riga del totale non dice niente: compare col primo capo scelto.
        totale={scelte.length ? { righe: capiDetti(contaCapi(scelte)), totale: inEuro(totale) } : undefined}
        avanti={inVolo ? 'MANDO…' : 'MANDA L’ORDINE'}
        tono="vai"
        occupato={inVolo}
        onVai={vai}
        onAvanti={() => void manda()}
      />
      </div>
    </div>
  )
}

/** Una riga dell'ordine, a campi uno sotto l'altro: col pollice, sul telefono. */
function RigaOrdine({
  r,
  i,
  capi,
  nota,
  togli,
  onCambia,
}: {
  r: RigaScritta
  i: number
  capi: Capo[]
  nota: (chiave: string) => Nota | undefined
  togli?: () => void
  onCambia: (x: Partial<RigaNuova>) => void
}) {
  const id = (k: string) => `v-r${i}-${k}`
  const n = (k: string) => nota(`r${i}-${k}`)
  const capo = capi.find((c) => c.capo === r.capo)
  return (
    <div className="card stack riquadro">
      <span className="row" style={{ gap: 10, minHeight: 24 }}>
        <span className="grow rule-label">RIGA {i + 1}</span>
        {togli && (
          <button type="button" className="vestiario-togli" onClick={togli} aria-label={`Togli la riga ${i + 1}`}>
            Togli
          </button>
        )}
      </span>
      <Campo id={id('perChi')} etichetta="PER CHI · NOME E COGNOME" nota={n('perChi')}>
        <input id={id('perChi')} className="campo" aria-invalid={!!n('perChi')} aria-describedby={`${id('perChi')}-nota`} maxLength={160} placeholder="Nome e cognome" value={r.perChi} onChange={(e) => onCambia({ perChi: e.target.value })} />
      </Campo>
      <Campo id={id('capo')} etichetta="CAPO" nota={n('capo')}>
        <select
          id={id('capo')}
          className="campo"
          aria-invalid={!!n('capo')}
          aria-describedby={`${id('capo')}-nota`}
          value={r.capo}
          // Un capo nuovo tiene la taglia solo se ce l'ha anche lui.
          onChange={(e) => onCambia({ capo: e.target.value, taglia: tagliaDopo(capi, e.target.value, r.taglia) })}
        >
          <option value="">Scegli il capo</option>
          {capi.map((c) => (
            <option key={c.capo} value={c.capo}>
              {c.capo} · {inEuro(c.prezzo)}
            </option>
          ))}
        </select>
      </Campo>
      <div className="vestiario-due">
        <Campo id={id('taglia')} etichetta="TAGLIA" nota={n('taglia')}>
          <select id={id('taglia')} className="campo" aria-invalid={!!n('taglia')} aria-describedby={`${id('taglia')}-nota`} value={r.taglia} disabled={!capo} onChange={(e) => onCambia({ taglia: e.target.value })}>
            <option value="">Scegli</option>
            {capo?.taglie.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id={id('quanti')} etichetta="QUANTI">
          <select id={id('quanti')} className="campo num" value={r.quanti} onChange={(e) => onCambia({ quanti: Number(e.target.value) })}>
            {Array.from({ length: MAX_QUANTI }, (_, n) => (
              <option key={n} value={n + 1}>
                {n + 1}
              </option>
            ))}
          </select>
        </Campo>
      </div>
      {capo && (
        <span className="row stima-riga stima-totale">
          <span className="grow passo-dettaglio">
            {r.quanti} × {inEuro(capo.prezzo)}
          </span>
          <span className="num">{inEuro(r.quanti * capo.prezzo)}</span>
        </span>
      )}
    </div>
  )
}

/** ORDINE ARRIVATO: le righe col totale del server, come pagare, la causale e il riepilogo da condividere. */
function Arrivato({ o, chiude, onAltro }: { o: Ordine; chiude: string; onAltro: () => void }) {
  const { copiato, copia } = useCopia()
  const causale = causaleVestiario(o)
  const entro = ilGiorno(chiude)
  const testo = riepilogoOrdine(o, chiude)
  const condividi = () => {
    // Il menu di condivisione del telefono; dove non c'è (il computer), il testo negli appunti.
    // Chiuso il menu senza scegliere (AbortError) non si fa altro; ogni altro rifiuto passa alla copia.
    if (navigator.share)
      return void navigator.share({ title: 'Ordine di vestiario', text: testo }).catch((e: unknown) => {
        if (!(e instanceof DOMException && e.name === 'AbortError')) copia('riepilogo', testo)
      })
    copia('riepilogo', testo)
  }
  return (
    <div className="pad stack esito vestiario-arrivato">
      <TitoloEsito tono="fatto">ORDINE ARRIVATO</TitoloEsito>
      <span className="esito-testo">
        Grazie, {o.nome}. La segreteria ha il tuo ordine: {capiDetti(contaCapi(o.righe))}, {inEuro(o.totale)}.
      </span>
      <span className="esito-testo">
        Va al fornitore solo quello pagato entro {entro}. Se il pagamento non arriva, la segreteria ti chiama al <span className="num testo-pieno">{o.telefono}</span>.
      </span>
      <div className="modulo-campo">
        <span className="modulo-etichetta">IL TUO ORDINE</span>
        <Riquadro stretto>
          <ul className="stack stima">
            {o.righe.map((r) => (
              <li key={r.id} className="row stima-riga">
                <span className="grow">
                  {r.perChi} · {r.capo} {r.taglia}
                  {r.quanti > 1 ? ` × ${r.quanti}` : ''}
                </span>
                <span className="num">{inEuro(r.quanti * r.prezzo)}</span>
              </li>
            ))}
            <li className="row stima-riga stima-totale">
              <span className="grow">Totale</span>
              <span className="num">{inEuro(o.totale)}</span>
            </li>
          </ul>
          <Dettaglio>
            Paga entro {entro} con un bonifico a {PAGAMENTO.intestatario}:
          </Dettaglio>
          <span className="num iban">{PAGAMENTO.iban}</span>
          <Dettaglio>
            Causale: <span className="testo-pieno">{causale}</span>
          </Dettaglio>
          <Tasti>
            {/* Senza spazi: è così che lo vogliono i campi delle app della banca. */}
            <Tasto onClick={() => copia('iban', PAGAMENTO.iban.replace(/\s/g, ''))}>{copiato === 'iban' ? 'COPIATO' : 'COPIA IBAN'}</Tasto>
            <Tasto onClick={() => copia('causale', causale)}>{copiato === 'causale' ? 'COPIATA' : 'COPIA CAUSALE'}</Tasto>
            {PAGAMENTO.satispay && <Tasto href={PAGAMENTO.satispay}>PAGA CON SATISPAY</Tasto>}
          </Tasti>
        </Riquadro>
      </div>
      <Dettaglio>Oppure in contanti, in segreteria.{PAGAMENTO.satispay ? ' Con Satispay scrivi la stessa causale nel messaggio.' : ''}</Dettaglio>
      <button type="button" className="btn btn-primary" onClick={condividi}>
        {copiato === 'riepilogo' ? 'RIEPILOGO COPIATO ✓' : 'CONDIVIDI IL RIEPILOGO'}
      </button>
      <Dettaglio>Mandalo a te o all’altro genitore: ci sono i capi, il totale, l’IBAN e la causale. Questa pagina non si riapre.</Dettaglio>
      <button type="button" className="btn btn-dashed passo-btn" onClick={onAltro}>
        FAI UN ALTRO ORDINE
      </button>
    </div>
  )
}

/** Dopo CHIUDE IL (`chiuso`), o senza data o senza catalogo (anche senza 47-vestiario.sql). */
function Chiusi({ chiuso }: { chiuso: string | null }) {
  return (
    <div className="pad stack esito">
      <TitoloEsito tono="avviso">{chiuso ? 'ORDINI CHIUSI' : 'ORDINI NON ANCORA APERTI'}</TitoloEsito>
      <span className="esito-testo">{chiuso ? `Gli ordini del vestiario si sono chiusi ${ilGiorno(chiuso)}.` : 'In questo momento non si ordina il vestiario.'}</span>
      <span className="esito-testo">{chiuso ? 'La prossima raccolta la annuncia la palestra.' : 'Quando si apre una raccolta, la palestra manda il link.'}</span>
      <Riquadro>
        <span className="passo-titolo">Ti serve un capo?</span>
        <Dettaglio>
          Chiama la segreteria al <span className="num testo-pieno">{CONTATTI.telefono}</span>, o passa in palestra.
        </Dettaglio>
        <Tasto href={chiama} qui>
          CHIAMA
        </Tasto>
      </Riquadro>
      <Tasto href={indirizzo(INDIRIZZI.iscrizioni)} qui>
        VAI ALLE ISCRIZIONI
      </Tasto>
    </div>
  )
}

/**
 * Nella pagina ISCRIZIONI, sotto, e non uno dei passi: il rimando agli ordini del vestiario,
 * solo mentre sono aperti. Se non si legge, non c'è: non ferma l'iscrizione.
 */
export function RiquadroVestiario() {
  const [chiude, setChiude] = useState<string | null>(null)
  useEffect(() => {
    let vivo = true
    datiVestiario()
      .then((d) => d.catalogo())
      .then(
        (c) => vivo && setChiude(c?.chiude && statoPagina(c, apertiLetti(), chiaveGiorno(new Date())) === 'aperti' ? c.chiude : null),
        () => {},
      )
    return () => {
      vivo = false
    }
  }, [])
  if (!chiude) return null
  return (
    <section className="pad iscrizioni-contatti">
      <Riquadro>
        <Etichetta>IL VESTIARIO</Etichetta>
        <span className="passo-titolo">Judogi, costumini e felpe della palestra</span>
        <Dettaglio>Ordini aperti {finoA(chiude)}. Li paghi dopo, con bonifico, Satispay o in segreteria.</Dettaglio>
        {/* Il cancelletto a mano: un href «#vestiario», con <base href="../">, porterebbe alla radice. */}
        <Tasto onClick={() => (window.location.hash = INDIRIZZO_VESTIARIO)}>
          ORDINA IL VESTIARIO
        </Tasto>
      </Riquadro>
    </section>
  )
}
