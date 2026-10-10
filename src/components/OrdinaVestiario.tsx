import { type ReactNode, useEffect, useState } from 'react'
import { INDIRIZZO_VESTIARIO } from '../lib/cancelletti'
import { INFORMATIVA_PUBBLICA, PAGAMENTO } from '../lib/iscrizione'
import { CONTATTI, chiama } from '../lib/sito'
import { chiaveGiorno } from '../lib/sala'
import { indirizzo, INDIRIZZI } from '../lib/aree'
import { alGiorno, causaleVestiario, cosaNonVaOrdine, ilGiorno, inEuro, MAX_QUANTI, MAX_RIGHE, MAX_RIGHE_DETTO, nomeTipo, prezzoDi, riepilogoOrdine, totaleOrdine, type Capo, type Catalogo, type DatiVestiario, type Ordine, type RigaNuova, type Tabelle } from '../lib/vestiario'
import { applicaScelte, capiDelTipo, mancaNellOrdine, nomeGiaUsato, ordineAMeta, stessaPersona, passoDopoPerChi, ripresaDa, righePerPersona, rinomina, sceltePagina, statoPagina, tabelleDellaPagina, tipiDaMostrare, type Passo, type Ripresa, type Scelte } from '../lib/vestiarioPagina'
import { chiedi, useDialogo } from './segreteria/comune'
import { apertiLetti, datiVestiario } from '../lib/vestiarioDati'
import { BarraPasso, Campo, Dettaglio, type Nota, Etichetta, Riquadro, Tasti, Tasto, TitoloEsito, Titoletto } from './ds'

/**
 * La pagina degli ordini di vestiario, dal link COPIA LINK ORDINI
 * (`iscrizioni/#vestiario`), coi passi del modulo Google «ORDINI MIZUNO»: per
 * chi è, il tipo, i capi del tipo con foto e tabella delle taglie, ti serve
 * altro, chi ordina col riepilogo. Il totale resta in vista nella barra in
 * fondo. Con un capo senza tipo (o il database senza il 50) i capi stanno
 * tutti su una pagina sola.
 *
 * Mandato, l'ordine non si rilegge da qui: ORDINE ARRIVATO dice come pagare e
 * dà il riepilogo da condividere. Le regole (aperti o chiusi, cosa non va, il
 * totale) stanno in `vestiario.ts`; il totale vero lo fa il server.
 */

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
  perChi: 'Scrivi nome e cognome',
  capo: 'Questo capo non c’è più: toglilo',
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
      tabelle={catalogo.tabelle ?? {}}
      chiude={catalogo.chiude}
      onArrivato={(o) => {
        setArrivato(o)
        document.querySelector('.scroll')?.scrollTo(0, 0)
      }}
    />
  )
}

/** Quel che resta se si torna indietro o la pagina si ricarica: in questa scheda sola, fino a ORDINE ARRIVATO. */
const RIPRESA = 'ods-corsi:vestiario-scelte'

function leggiRipresa(): string | null {
  try {
    return sessionStorage.getItem(RIPRESA)
  } catch {
    return null
  }
}
function scriviRipresa(r: Ripresa | null) {
  try {
    if (r) sessionStorage.setItem(RIPRESA, JSON.stringify(r))
    else sessionStorage.removeItem(RIPRESA)
  } catch {
    /* senza sessionStorage le scelte restano finché la pagina è aperta */
  }
}

function Ordina({
  d,
  chi,
  onChi: setChi,
  capi,
  tabelle,
  chiude,
  onArrivato,
}: {
  d: DatiVestiario
  chi: typeof CHI_VUOTO
  onChi: (c: typeof CHI_VUOTO) => void
  capi: Capo[]
  tabelle: Tabelle
  chiude: string
  onArrivato: (o: Ordine) => void
}) {
  // L'id dell'ordine nasce una volta, e resta anche ricaricando: rimandato dopo un «Non c'è rete»
  // è lo stesso ordine, non un secondo. FAI UN ALTRO ORDINE riparte da capo e ne fa uno nuovo.
  const [r] = useState<Ripresa>(() => ripresaDa(leggiRipresa(), capi) ?? { id: crypto.randomUUID(), righe: [], storia: [{ a: 'perChi' }] })
  const [id, setId] = useState(r.id)
  const [righe, setRighe] = useState<RigaNuova[]>(r.righe)
  const [storia, setStoria] = useState<Passo[]>(r.storia)
  // Il nome scritto in PER CHI È, e quello di prima se ci si è tornati: cambiato, le sue righe lo seguono.
  const [nomeScritto, setNomeScritto] = useState('')
  const [vecchio, setVecchio] = useState('')
  const [inVolo, setInVolo] = useState(false)
  const [guaio, setGuaio] = useState<string | null>(null)
  const [provato, setProvato] = useState(false)
  const [grande, setGrande] = useState<{ url: string; nome: string } | null>(null)
  // Chi ordina torna con le scelte dopo una ricarica (lo tiene la pagina di sopra, per FAI UN ALTRO ORDINE).
  useEffect(() => {
    if (r.chi) setChi({ ...r.chi, email: r.chi.email ?? '' })
    // Una volta, all'apertura: dopo comanda quel che si scrive.
  }, [])
  useEffect(() => scriviRipresa({ id, righe, storia, chi }), [id, righe, storia, chi])

  const passo = storia[storia.length - 1]
  // Ogni passo porta la sua persona: INDIETRO fino ai passi di Luca rimette Luca, con le sue scelte.
  const perChi = 'perChi' in passo ? passo.perChi : ''
  const tipi = tipiDaMostrare(capi)
  const vaiA = (p: Passo) => {
    setGuaio(null)
    setProvato(false)
    setStoria((s) => [...s, p])
    document.querySelector('.scroll')?.scrollTo(0, 0)
  }
  const indietro =
    storia.length > 1
      ? () => {
          setGuaio(null)
          setProvato(false)
          const lasciato = storia[storia.length - 1]
          const torna = storia[storia.length - 2]
          // Tornando a PER CHI È il nome c'è ancora, ed è quello da seguire se si cambia.
          if (torna.a === 'perChi') {
            const nome = 'perChi' in lasciato ? lasciato.perChi : ''
            setNomeScritto(nome)
            setVecchio(nome)
          }
          setStoria(storia.slice(0, -1))
        }
      : undefined

  const ordine = { id, ...chi, righe }
  const totale = totaleOrdine(righe.map((x) => ({ quanti: x.quanti, prezzo: prezzoDi(capi, x.capo) })))
  // Con zero capi la riga del totale non dice niente: compare col primo capo scelto.
  const conto = righe.length ? { righe: capiDetti(contaCapi(righe)), totale: inEuro(totale) } : undefined
  const entro = ilGiorno(chiude)

  const vai = (chiave: string) => {
    const x = document.getElementById(`v-${chiave}`)
    x?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    x?.focus({ preventScroll: true })
  }
  /** Una foto o una tabella grande; il tasto indietro del telefono la chiude, non la pagina. */
  const apri = (url: string, nome: string) => {
    window.history.pushState({ fotoVestiario: true }, '')
    setGrande({ url, nome })
  }
  useEffect(() => {
    const chiudi = () => setGrande(null)
    window.addEventListener('popstate', chiudi)
    return () => window.removeEventListener('popstate', chiudi)
  }, [])
  const chiudiGrande = () => {
    // `history.state` è `any`: qui ci scrive solo `apri`.
    if ((window.history.state as { fotoVestiario?: boolean } | null)?.fotoVestiario) window.history.back()
    else setGrande(null)
  }

  const manda = async () => {
    if (inVolo) return
    setGuaio(null)
    setProvato(true)
    const manca = mancaNellOrdine(ordine, capi)
    if (manca[0]) return vai(manca[0].chiave)
    const no = cosaNonVaOrdine(ordine, capi)
    if (no) return setGuaio(no)
    // Il tasto si spegne finché il server non risponde: un secondo tocco non fa un secondo ordine.
    setInVolo(true)
    try {
      const fatto = await d.inviaOrdine(ordine)
      scriviRipresa(null)
      onArrivato(fatto)
    } catch (e) {
      // Le risposte restano: si riprova con lo stesso tasto.
      setGuaio(e instanceof Error ? e.message : 'Non è andata: riprova fra poco')
    } finally {
      setInVolo(false)
    }
  }

  const fondo = (barra: ReactNode) => (
    // L'errore sta col tasto, nel fondo che resta in vista: in fondo alla pagina non lo vedeva nessuno.
    <div className="vestiario-fondo">
      {guaio && (
        <div className="pad vestiario-guaio" role="alert">
          <Riquadro tono="guaio">{guaio}</Riquadro>
        </div>
      )}
      {barra}
    </div>
  )
  const foto = grande && <FotoGrande {...grande} onChiudi={chiudiGrande} />
  const perChiDetto = `PER ${perChi.toUpperCase()}`

  if (passo.a === 'perChi') {
    const nuovo = nomeScritto.trim()
    const vuoto = !nuovo
    // Lo stesso bambino scritto due volte farebbe due gruppi: chi si sta correggendo può tenere il suo nome.
    // Una persona nuova col nome di una che c'è già è quella: si continua con lei, scritta come la prima volta.
    // Si rifiuta solo correggendo un nome (tornati con INDIETRO) per farlo diventare quello di un'altra.
    const giaQui = righe.find((x) => stessaPersona(x.perChi, nuovo))?.perChi
    const doppio = vuoto || !vecchio ? null : nomeGiaUsato(righe, nuovo, vecchio)
    const notaNome = provato && vuoto ? 'Scrivi nome e cognome' : provato && doppio ? doppio : null
    const avanti = () => {
      setProvato(true)
      if (vuoto || doppio) return vai('perChi')
      if (vecchio && vecchio !== nuovo) setRighe(rinomina(righe, vecchio, nuovo))
      vaiA(passoDopoPerChi(capi, !vecchio && giaQui ? giaQui : nuovo))
    }
    // Riaperta la pagina con un ordine a metà: lo si dice, e si sceglie se riprenderlo o ricominciare.
    const aMeta = storia.length === 1 ? ordineAMeta(righe) : null
    const ricomincia = async () => {
      if (!(await chiedi('Ricominciare da capo? I capi scelti e chi ordina si perdono.', 'RICOMINCIA DA CAPO', { no: 'NO, TIENILI', pericolo: true }))) return
      scriviRipresa(null)
      setRighe([])
      setChi(CHI_VUOTO)
      setId(crypto.randomUUID())
      setNomeScritto('')
      setVecchio('')
      setProvato(false)
    }
    return (
      <div className="modulo stack vestiario">
        <Titoletto>ORDINA IL VESTIARIO</Titoletto>
        <div className="pad passo-dopo">
          <Riquadro tono="prova">
            <Etichetta>ORDINI APERTI {finoA(chiude).toUpperCase()}</Etichetta>
            <Dettaglio>
              Una persona alla volta: per chi è{Array.isArray(tipi) && tipi.length > 1 ? ', il tipo' : ''}, poi i capi con la taglia. Paghi dopo, con bonifico, Satispay o in segreteria: al fornitore va solo quello pagato entro {entro}.
            </Dettaglio>
          </Riquadro>
        </div>
        {aMeta && (
          <div className="pad passo-dopo">
            <Riquadro>
              <Etichetta>UN ORDINE A METÀ</Etichetta>
              <Dettaglio tono="testo">{aMeta}.</Dettaglio>
              <Tasti>
                <Tasto variante="principale" onClick={() => vaiA({ a: 'chiOrdina' })}>
                  VEDI IL RIEPILOGO
                </Tasto>
                <Tasto onClick={() => void ricomincia()}>RICOMINCIA DA CAPO</Tasto>
              </Tasti>
            </Riquadro>
          </div>
        )}
        <Titoletto>PER CHI È</Titoletto>
        <div className="pad stack passo-dopo">
          <Campo id="v-perChi" etichetta="NOME E COGNOME" nota={notaNome ? { testo: notaNome, guaio: true } : undefined}>
            <input
              id="v-perChi"
              className="campo"
              maxLength={160}
              placeholder="Nome e cognome"
              aria-invalid={!!notaNome}
              aria-describedby="v-perChi-dopo v-perChi-nota"
              value={nomeScritto}
              onChange={(e) => setNomeScritto(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && avanti()}
            />
            <span id="v-perChi-dopo" className="passo-dettaglio">
              Chi indossa i capi.{righe.length ? '' : ' Per un’altra persona te lo chiediamo dopo.'}
            </span>
          </Campo>
        </div>
        {fondo(<BarraPasso manca={notaNome ? [{ nome: vuoto ? 'Per chi è' : 'Un nome già nell’ordine', chiave: 'perChi' }] : []} totale={conto} onVai={vai} onAvanti={avanti} onIndietro={indietro} />)}
      </div>
    )
  }

  if (passo.a === 'tipo' && tipi !== 'pagina sola') {
    return (
      <div className="modulo stack vestiario">
        <Titoletto conto={perChiDetto}>IL TIPO</Titoletto>
        <div className="pad stack passo-dopo" style={{ gap: 8 }}>
          {/* Un tocco porta alla pagina del tipo: una scelta sola, senza AVANTI. */}
          {tipi.map((t) => {
            const suoi = capiDelTipo(capi, t)
            const prezzi = suoi.map((c) => c.prezzo)
            const da = Math.min(...prezzi)
            return (
              <button key={t} type="button" className="modulo-corso" onClick={() => vaiA({ a: 'pagina', perChi, tipo: t })}>
                <span className="stack modulo-corso-testo grow">
                  <span>{nomeTipo(t)}</span>
                  <span className="modulo-corso-riga">
                    {capiDetti(suoi.length)} · {prezzi.length > 1 && prezzi.some((p) => p !== da) ? `dai ${inEuro(da)}` : inEuro(da)}
                  </span>
                </span>
                <span aria-hidden>›</span>
              </button>
            )
          })}
        </div>
        {fondo(<BarraPasso totale={conto} onVai={vai} onIndietro={indietro} />)}
      </div>
    )
  }

  if (passo.a === 'pagina') {
    const deiCapi = capiDelTipo(capi, passo.tipo)
    const scelte = sceltePagina(righe, perChi, deiCapi)
    const scegli = (capo: string, s: Scelte[string] | null) => {
      const nuove = { ...scelte }
      if (s?.taglia) nuove[capo] = s
      else delete nuove[capo]
      try {
        setRighe(applicaScelte(righe, perChi, deiCapi, nuove))
        setGuaio(null)
      } catch (e) {
        setGuaio(e instanceof Error ? e.message : MAX_RIGHE_DETTO)
      }
    }
    // La pagina sola non ha un tipo: in cima vanno le tabelle dei tipi che le hanno.
    const tabelleQui = tabelleDellaPagina(tabelle, passo.tipo).map((t) => ({ tipo: t.tipo, url: d.urlFoto(t.nome) }))
    return (
      <div className="modulo stack vestiario">
        <Titoletto conto={perChiDetto}>{passo.tipo === 'pagina sola' ? 'I CAPI' : nomeTipo(passo.tipo)}</Titoletto>
        {tabelleQui.map((t) => (
          <div key={t.tipo} className="vestiario-tabella">
            {/* Con più tabelle (la pagina sola) ognuna dice di che tipo è. */}
            {tabelleQui.length > 1 && <span className="pad rule-label vestiario-tabella-tipo">{nomeTipo(t.tipo)}</span>}
            <Foto url={t.url} nome={`Tabella delle taglie · ${nomeTipo(t.tipo)}`} tabella onApri={apri} />
          </div>
        ))}
        <div className="pad stack passo-dopo" style={{ gap: 10 }}>
          {deiCapi.map((c) => (
            <SchedaCapo key={c.capo} c={c} url={c.foto ? d.urlFoto(c.foto) : ''} scelta={scelte[c.capo]} onScegli={(s) => scegli(c.capo, s)} onApri={apri} />
          ))}
        </div>
        {fondo(<BarraPasso totale={conto} onVai={vai} onAvanti={() => vaiA({ a: 'altro', perChi })} onIndietro={indietro} />)}
        {foto}
      </div>
    )
  }

  if (passo.a === 'altro') {
    const suoi = righe.filter((x) => x.perChi === perChi)
    const finito = () => {
      setProvato(true)
      if (righe.length) vaiA({ a: 'chiOrdina' })
    }
    return (
      <div className="modulo stack vestiario">
        <Titoletto>TI SERVE ALTRO?</Titoletto>
        <div className="pad passo-dopo">
          <Riquadro stretto>
            <Persona nome={perChi} />
            {suoi.length ? (
              <ul className="stack stima">
                {suoi.map((x) => (
                  <li key={x.capo} className="row stima-riga">
                    <span className="grow">
                      {x.capo} {x.taglia}
                      {x.quanti > 1 ? ` × ${x.quanti}` : ''}
                    </span>
                    <span className="num">{inEuro(x.quanti * prezzoDi(capi, x.capo))}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <Dettaglio>Per ora niente.</Dettaglio>
            )}
          </Riquadro>
        </div>
        {tipi !== 'pagina sola' && (
          <>
            <Titoletto>ANCORA {perChiDetto}</Titoletto>
            <div className="pad stack passo-dopo" style={{ gap: 8 }}>
              {tipi.map((t) => {
                const n = suoi.filter((x) => capiDelTipo(capi, t).some((c) => c.capo === x.capo)).length
                return (
                  <button key={t} type="button" className="btn btn-ghost vestiario-tasto" onClick={() => vaiA({ a: 'pagina', perChi, tipo: t })}>
                    {nomeTipo(t)}
                    {n ? ` · ${n} ${n === 1 ? 'SCELTO' : 'SCELTI'}` : ''}
                  </button>
                )
              })}
            </div>
          </>
        )}
        <Titoletto>PER UN’ALTRA PERSONA</Titoletto>
        <div className="pad stack passo-dopo">
          <button
            type="button"
            className="btn btn-dashed vestiario-tasto"
            disabled={righe.length >= MAX_RIGHE}
            onClick={() => {
              setNomeScritto('')
              setVecchio('')
              vaiA({ a: 'perChi' })
            }}
          >
            + PER UN’ALTRA PERSONA
          </button>
          {righe.length >= MAX_RIGHE && <Dettaglio tono="avviso">{MAX_RIGHE_DETTO}</Dettaglio>}
        </div>
        {fondo(
          <BarraPasso
            manca={provato && !righe.length ? [{ nome: 'Almeno un capo', chiave: 'perChi' }] : []}
            totale={conto}
            avanti="NO, HO FINITO"
            onVai={() => indietro?.()}
            onAvanti={finito}
            onIndietro={indietro}
          />,
        )}
      </div>
    )
  }

  // CHI ORDINA e IL RIEPILOGO, raggruppato per persona: taglia e quanti si cambiano qui.
  const manca = mancaNellOrdine(ordine, capi)
  /** Rosso e la nota, ma solo dopo aver provato a mandare: un modulo appena aperto non è sbagliato. */
  const nota = (chiave: string): Nota | undefined => {
    const m = provato ? manca.find((x) => x.chiave === chiave) : undefined
    if (!m) return undefined
    // Scritto male non è vuoto: la nota dice cosa non va, con le parole della barra.
    return { testo: m.scrittoMale ? m.nome : NOTE[chiave.replace(/^r\d+-/, '')], guaio: true }
  }
  const cambia = (i: number, x: Partial<RigaNuova>) => setRighe((rr) => rr.map((y, j) => (j === i ? { ...y, ...x } : y)))
  const conIndice = righe.map((x, i) => ({ ...x, i }))
  return (
    <div className="modulo stack vestiario">
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

      <Titoletto conto={capiDetti(contaCapi(righe)).toUpperCase()}>IL RIEPILOGO</Titoletto>
      <div className="pad stack passo-dopo" style={{ gap: 10 }}>
        {righePerPersona(conIndice).map((g) => (
          <div key={g.perChi} className="stack" style={{ gap: 8 }}>
            <Persona nome={g.perChi} />
            {g.righe.map((x) => (
              <RigaRiepilogo key={`${x.perChi}-${x.capo}`} r={x} capo={capi.find((c) => c.capo === x.capo)} nota={nota} onCambia={(y) => cambia(x.i, y)} onTogli={() => setRighe((rr) => rr.filter((_, j) => j !== x.i))} />
            ))}
          </div>
        ))}
        {!righe.length && <Dettaglio>Nessun capo: torna indietro e sceglilo.</Dettaglio>}
        <Riquadro stretto>
          <span className="row stima-riga stima-totale">
            <span className="grow">Totale</span>
            <span className="num">{inEuro(totale)}</span>
          </span>
          <Dettaglio>Paghi dopo l’invio: ti diciamo come nella pagina che segue. Va al fornitore solo quello pagato entro {entro}.</Dettaglio>
        </Riquadro>
      </div>

      {INFORMATIVA_PUBBLICA && (
        <p className="pad iscrizioni-nota">
          I tuoi dati li legge solo la segreteria della palestra:{' '}
          <a href={INFORMATIVA_PUBBLICA} target="_blank" rel="noreferrer" className="link-sec">
            l'informativa privacy
          </a>
          .
        </p>
      )}

      {fondo(
        <BarraPasso
          manca={manca}
          nota={manca.length ? undefined : 'Tutto pronto: puoi mandare l’ordine.'}
          totale={conto}
          avanti={inVolo ? 'MANDO…' : 'MANDA L’ORDINE'}
          tono="vai"
          occupato={inVolo}
          onVai={vai}
          onAvanti={() => void manda()}
          onIndietro={indietro}
        />,
      )}
    </div>
  )
}

/** Per chi è, in chiaro: l'etichetta PER e il nome come si scrive, non in maiuscolo spaziato. */
function Persona({ nome }: { nome: string }) {
  return (
    <span className="stack" style={{ gap: 2 }}>
      <span className="rule-label">PER</span>
      <span className="vestiario-persona">{nome}</span>
    </span>
  )
}

/**
 * La foto di un capo o una tabella delle taglie, che si apre grande. Senza
 * foto non c'è niente; una foto che non si carica lascia il nome, e si ordina
 * lo stesso.
 */
function Foto({ url, nome, tabella, onApri }: { url: string; nome: string; tabella?: boolean; onApri: (url: string, nome: string) => void }) {
  const [rotta, setRotta] = useState(false)
  if (!url) return null
  if (rotta)
    return (
      <span className="vestiario-foto" data-tabella={tabella || undefined}>
        <span className="vestiario-foto-nome">{nome}</span>
      </span>
    )
  return (
    <button type="button" className="vestiario-foto" data-tabella={tabella || undefined} onClick={() => onApri(url, nome)} aria-label={`Apri grande: ${nome}`}>
      <img src={url} alt={nome} onError={() => setRotta(true)} />
      <span className="vestiario-foto-apri" aria-hidden>
        ⤢
      </span>
    </button>
  )
}

/** La foto grande, a tutto schermo: si allarga con due dita (lo zoom del telefono), CHIUDI o indietro la chiude. */
function FotoGrande({ url, nome, onChiudi }: { url: string; nome: string; onChiudi: () => void }) {
  const ref = useDialogo<HTMLDivElement>(onChiudi)
  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label={nome} tabIndex={-1} className="vestiario-grande">
      <div className="pad vestiario-grande-testa">
        <span className="grow passo-titolo">{nome}</span>
        <button type="button" className="btn btn-ghost passo-btn" onClick={onChiudi}>
          CHIUDI ✕
        </button>
      </div>
      <span className="pad passo-dettaglio vestiario-grande-come">Allarga con due dita</span>
      <div className="vestiario-grande-zoom">
        <img src={url} alt={nome} />
      </div>
    </div>
  )
}

/** Un capo nella pagina del tipo: foto, nome, prezzo, nota, TAGLIA e QUANTI. Scelta una taglia è nell'ordine: bordo verde. */
function SchedaCapo({
  c,
  url,
  scelta,
  onScegli,
  onApri,
}: {
  c: Capo
  url: string
  scelta?: Scelte[string]
  onScegli: (s: Scelte[string] | null) => void
  onApri: (url: string, nome: string) => void
}) {
  const id = `v-c-${c.capo.replace(/\W+/g, '-')}`
  const quanti = scelta?.quanti ?? 1
  return (
    <div className="card stack riquadro vestiario-scheda" data-scelto={!!scelta?.taglia}>
      <Foto url={url} nome={c.capo} onApri={onApri} />
      <span className="row prova-testa">
        <span className="grow passo-titolo">{c.capo}</span>
        <span className="num cifra">{inEuro(c.prezzo)}</span>
      </span>
      {c.nota && <Dettaglio>{c.nota}</Dettaglio>}
      <div className="vestiario-due">
        <Campo id={`${id}-taglia`} etichetta="TAGLIA">
          {/* Scelta la taglia QUANTI parte da 1; «Scegli» toglie il capo dall'ordine. */}
          <select id={`${id}-taglia`} className="campo" value={scelta?.taglia ?? ''} onChange={(e) => onScegli(e.target.value ? { taglia: e.target.value, quanti } : null)}>
            <option value="">Scegli</option>
            {c.taglie.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id={`${id}-quanti`} etichetta="QUANTI">
          <select id={`${id}-quanti`} className="campo num" value={scelta?.taglia ? quanti : ''} disabled={!scelta?.taglia} onChange={(e) => scelta && onScegli({ ...scelta, quanti: Number(e.target.value) })}>
            {!scelta?.taglia && <option value="">—</option>}
            {Array.from({ length: MAX_QUANTI }, (_, n) => (
              <option key={n} value={n + 1}>
                {n + 1}
              </option>
            ))}
          </select>
        </Campo>
      </div>
      {scelta?.taglia && (
        <span className="row stima-riga stima-totale">
          <span className="grow passo-dettaglio">
            {quanti} × {inEuro(c.prezzo)}
          </span>
          <span className="num">{inEuro(quanti * c.prezzo)}</span>
        </span>
      )}
    </div>
  )
}

/** Una riga di IL RIEPILOGO: il capo, TAGLIA e QUANTI da cambiare qui, «Togli» e il conto. */
function RigaRiepilogo({
  r,
  capo,
  nota,
  onCambia,
  onTogli,
}: {
  r: RigaNuova & { i: number }
  capo?: Capo
  nota: (chiave: string) => Nota | undefined
  onCambia: (x: Partial<RigaNuova>) => void
  onTogli: () => void
}) {
  const id = (k: string) => `v-r${r.i}-${k}`
  const n = (k: string) => nota(`r${r.i}-${k}`)
  return (
    <div className="card stack riquadro">
      <span className="row" style={{ gap: 10 }}>
        <span className="grow passo-titolo">{r.capo}</span>
        <button type="button" className="vestiario-togli" onClick={onTogli} aria-label={`Togli ${r.capo} di ${r.perChi}`}>
          Togli
        </button>
      </span>
      <div className="vestiario-due">
        <Campo id={id('taglia')} etichetta="TAGLIA" nota={n('taglia')}>
          <select id={id('taglia')} className="campo" aria-invalid={!!n('taglia')} aria-describedby={`${id('taglia')}-nota`} value={r.taglia} onChange={(e) => onCambia({ taglia: e.target.value })}>
            {/* Per togliere una riga c'è Togli: qui la taglia si cambia, non si svuota. */}
            {capo?.taglie.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id={id('quanti')} etichetta="QUANTI">
          <select id={id('quanti')} className="campo num" value={r.quanti} onChange={(e) => onCambia({ quanti: Number(e.target.value) })}>
            {Array.from({ length: MAX_QUANTI }, (_, k) => (
              <option key={k} value={k + 1}>
                {k + 1}
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
