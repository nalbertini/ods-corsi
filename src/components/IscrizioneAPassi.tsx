import { useEffect, useMemo, useRef, useState } from 'react'
import type { CampoModulo, CorsoAperto, DatiRichiesta, DatiRichieste, TipoFile } from '../lib/richieste'
import { anniScritti, dataDaCf, datiRichieste, domandaUscita, ESTENSIONI, ETICHETTA_FILE, FILE, FORMULE, MASSIMO_FILE, problemi, pulisciCf } from '../lib/richieste'
import { riduciFoto } from '../lib/foto'
import { caricaLuoghi, luogoDaCf, scriviLuogo, type Luoghi } from '../lib/codiceFiscale'
import { INFORMATIVA_PUBBLICA, MODULI, REGOLAMENTO, STAGIONE } from '../lib/iscrizione'
import { corsiPerEta, type CorsoPerEta, type Listino } from '../lib/listino'
import { euro } from '../lib/ricevute'
import { chiaveGiorno } from '../lib/sala'
import * as P from '../lib/passiIscrizione'
import { useListino } from './Costi'
import { Avanzamento, BarraPasso, Bollino, CaricaFile, Campo, Dettaglio, NotaCampo, Riepilogo, Riquadro, SceltaCorsi, Tasti, Tasto, TitoloEsito, Titoletto, type Nota, type RigaRiepilogo } from './ds'
import { Contatti, Prova } from './IscrizioniScreen'
import { Casella, QuantoCosta, SceltaFile } from './ModuloIscrizione'
import { firmaPng, firmaVera, TavolaFirma, type Tratto } from './TavolaFirma'

/**
 * Il modulo di iscrizione a passi, solo in prova (`iscrizioni/?prova#nuova`,
 * vedi `flussoNuovoAcceso`). Prima si sceglie chi si iscrive, poi un passo alla
 * volta: ogni AVANTI controlla solo il suo passo. Tutto quello che si scrive
 * resta in memoria finché si è qui: niente bozza sul telefono.
 *
 * Le regole (cosa manca, il controllo fra scelta e codice fiscale, i file da
 * chiedere, il conto di famiglia, l'invio) stanno in `passiIscrizione.ts`:
 * qui si mostra e si chiama. Il modulo di oggi (`ModuloIscrizione.tsx`) resta
 * com'è; ne prendiamo solo i pezzi che non cambiano.
 */

/** Un esito che si mostra: «fermo» no, torna al riepilogo col suo messaggio. */
type Arrivo = Exclude<P.Esito, { esito: 'fermo' }>

type Fase = { tipo: 'compila' } | { tipo: 'invio' } | { tipo: 'esito'; esito: Arrivo }

const vaiInCima = () => document.querySelector('.scroll')?.scrollTo(0, 0)

export function IscrizioneAPassi() {
  const [d, setD] = useState<DatiRichieste | null>(null)
  const [corsi, setCorsi] = useState<CorsoAperto[] | null>(null)
  const [guaioCorsi, setGuaioCorsi] = useState<string | null>(null)
  const [luoghi, setLuoghi] = useState<Luoghi | null>(null)
  const listino = useListino()?.listino
  // Da dove si parte: la scelta (null), o un flusso (`n` lo rimette a zero).
  const [avvio, setAvvio] = useState<{ chi: P.Chi; stato?: P.StatoPassi; n: number } | null>(null)

  useEffect(() => {
    let vivo = true
    void datiRichieste()
      .then((x) => {
        if (!vivo) return
        setD(x)
        return x.corsiAperti().then((c) => vivo && setCorsi(c))
      })
      .catch((e) => {
        // Chi usa l'app non legge il testo dell'errore: ci serve solo in console.
        console.error(e)
        if (vivo) setGuaioCorsi('riprova fra poco')
      })
    return () => {
      vivo = false
    }
  }, [])
  // Se l'elenco dei luoghi non arriva, il luogo di nascita si scrive a mano come nel modulo di oggi.
  useEffect(() => void caricaLuoghi().then(setLuoghi, () => {}), [])

  return (
    <div className="iscrizioni-modulo">
      <Titoletto>RICHIESTA DI ISCRIZIONE</Titoletto>
      {avvio ? (
        <Flusso
          key={avvio.n}
          chi={avvio.chi}
          iniziale={avvio.stato}
          d={d}
          corsi={corsi}
          guaioCorsi={guaioCorsi}
          luoghi={luoghi}
          listino={listino}
          onEsci={() => setAvvio(null)}
          onAltroFiglio={(s) => setAvvio({ chi: 'figlio', stato: P.perUnAltroFiglio(s), n: avvio.n + 1 })}
        />
      ) : (
        <Scelta prova={d?.modo === 'prova'} onScegli={(chi) => setAvvio({ chi, n: 1 })} />
      )}
    </div>
  )
}

/**
 * Come `SceltaFile` del modulo di oggi (che non si tocca), ma coi testi per il genitore
 * di chi iscrive il figlio: `etichetta` e `dettaglio` al posto di quelli di `FILE`.
 */
function SceltaFileGenitore({ tipo, file, onFile, etichetta, dettaglio }: { tipo: TipoFile; file?: File; onFile: (f: File | undefined) => void; etichetta: string; dettaglio: string }) {
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
      etichetta={etichetta}
      seManca={f.obbligatorio ? undefined : (f.seManca ?? 'FACOLTATIVO')}
      dettaglio={lavoro ? 'Preparo la foto…' : dettaglio}
      file={file && !lavoro ? { nome: file.name, byte: file.size } : undefined}
      errore={guaio}
      onFile={(x) => void scelto(x)}
    />
  )
}

function Scelta({ prova, onScegli }: { prova: boolean; onScegli: (chi: P.Chi) => void }) {
  return (
    <>
      <div className="stack pad scelta-chi">
        {prova && <Bollino>PROVA: RESTA SU QUESTO DISPOSITIVO</Bollino>}
        <Dettaglio tono="testo">Ci vogliono circa 5 minuti. Quello che scrivi non resta sul telefono: se esci prima di mandare la richiesta, le risposte si perdono.</Dettaglio>
        <span className="modulo-etichetta">CHI SI ISCRIVE?</span>
        <SceltaCorsi
          id="n-chi"
          etichetta="Chi si iscrive"
          una
          voci={[
            { id: 'adulto', testo: 'IO, SONO ADULTO', riga: 'Ti servono: il tuo codice fiscale e la tua carta d’identità. 4 passi.' },
            { id: 'figlio', testo: 'MIO FIGLIO O MIA FIGLIA', riga: 'Ti servono: il codice fiscale del bambino e il tuo, e la tua carta d’identità. 5 passi.' },
          ]}
          scelti={[]}
          onScegli={(c) => onScegli(c === 'figlio' ? 'figlio' : 'adulto')}
        />
        <Dettaglio>Il certificato medico si può caricare nell’ultimo passo, o portare in segreteria prima della prima lezione.</Dettaglio>
      </div>
      <Prova />
      <Contatti />
    </>
  )
}

/** Un elenco di corsi per età: quelli che vanno bene, poi gli altri, che si aprono a richiesta. */
function ElencoCorsi({
  id,
  perEta,
  scelti,
  onScegli,
  etaDi,
  nota,
  caricando,
}: {
  id: string
  perEta: { adatti: CorsoPerEta[]; senzaAnni: CorsoPerEta[]; altri: CorsoPerEta[] }
  scelti: readonly string[]
  onScegli: (id: string) => void
  etaDi: 'tua' | 'sua'
  nota?: Nota
  caricando?: string
}) {
  const [aperti, setAperti] = useState(false)
  const fuoriEta = perEta.altri.filter((c) => scelti.includes(c.id)).map((c) => c.nome)
  // Un corso fuori età già scelto non si nasconde: si vede cosa c'è nella richiesta.
  const mostraAltri = aperti || fuoriEta.length > 0
  const tasto = (c: CorsoPerEta) => ({ id: c.id, testo: c.nome, riga: [c.riga, c.prezzoDaConfermare && 'prezzo da confermare'].filter(Boolean).join(' · ') || undefined })
  const descritto = nota ? `${id}-nota` : undefined
  return (
    <div id={id} tabIndex={-1} className="modulo-campo modulo-largo modulo-corsi-tutti">
      <NotaCampo id={`${id}-nota`} nota={nota} />
      {caricando && <Dettaglio tono="guaio">{caricando}</Dettaglio>}
      {perEta.adatti.length > 0 && <span className="modulo-etichetta">PER LA {etaDi.toUpperCase()} ETÀ</span>}
      <SceltaCorsi id={`${id}-adatti`} etichetta="Corsi" voci={perEta.adatti.map(tasto)} scelti={scelti} onScegli={onScegli} descritto={descritto} />
      {perEta.senzaAnni.length > 0 && (
        <>
          <span className="modulo-etichetta modulo-altri">SENZA FASCIA D’ETÀ</span>
          <SceltaCorsi id={`${id}-senza-anni`} etichetta="Corsi senza fascia d’età" voci={perEta.senzaAnni.map(tasto)} scelti={scelti} onScegli={onScegli} descritto={descritto} />
        </>
      )}
      {perEta.altri.length > 0 &&
        (mostraAltri ? (
          <>
            <span className="modulo-etichetta modulo-altri">ALTRI CORSI</span>
            <SceltaCorsi id={`${id}-altri`} etichetta="Altri corsi" voci={perEta.altri.map(tasto)} scelti={scelti} onScegli={onScegli} descritto={descritto} />
          </>
        ) : (
          <button type="button" className="btn btn-dashed passo-btn" onClick={() => setAperti(true)}>
            + ALTRI {perEta.altri.length} CORSI, NON PER LA {etaDi.toUpperCase()} ETÀ
          </button>
        ))}
      <div aria-live="polite">
        {fuoriEta.length > 0 && (
          <Dettaglio tono="avviso">
            {fuoriEta.join(', ')} {fuoriEta.length > 1 ? 'non sono' : 'non è'} della {etaDi} età: la segreteria ti richiama.
          </Dettaglio>
        )}
      </div>
    </div>
  )
}

/** Il conto di una o più persone, dalle righe della stima: lo sconto in verde, il totale in fondo. */
function Conto({ righe, totale }: { righe: ReadonlyArray<{ testo: string; importo: number }>; totale: number }) {
  return (
    <ul className="stack stima">
      {righe.map((r, i) => (
        <li key={i} className="row stima-riga" data-sconto={r.importo < 0 || undefined}>
          <span className="grow">{r.testo}</span>
          <span className="num">
            {r.importo < 0 ? '−' : ''}
            {euro(Math.abs(r.importo))} €
          </span>
        </li>
      ))}
      <li className="row stima-riga stima-totale">
        <span className="grow">Totale</span>
        <span className="num">{euro(totale)} €</span>
      </li>
    </ul>
  )
}

type Suo = NonNullable<P.StatoPassi['suo']>
const SUO_VUOTO: Suo = { corsi: [], formula: 'trimestre', scelte: {} }

function Flusso({
  chi,
  iniziale,
  d,
  corsi,
  guaioCorsi,
  luoghi,
  listino,
  onEsci,
  onAltroFiglio,
}: {
  chi: P.Chi
  iniziale?: P.StatoPassi
  d: DatiRichieste | null
  corsi: CorsoAperto[] | null
  guaioCorsi: string | null
  luoghi: Luoghi | null
  listino?: Listino
  onEsci: () => void
  onAltroFiglio: (s: P.StatoPassi) => void
}) {
  const [grezzo, setGrezzo] = useState<P.StatoPassi>(() => iniziale ?? P.nuovoStato(chi))
  const [passo, setPasso] = useState(1)
  // I tratti servono per disegnare la firma; lo stato dei passi ne tiene il conto.
  const [tratti, setTratti] = useState<Tratto[]>([])
  const [come, setCome] = useState<'qui' | 'foto'>('qui')
  const [provincia, setProvincia] = useState('')
  const [guaioFirma, setGuaioFirma] = useState<string | null>(null)
  const [guaio, setGuaio] = useState<string | null>(null)
  const [fase, setFase] = useState<Fase>({ tipo: 'compila' })
  // I campi già lasciati, e se si è già provato ad andare avanti: prima, niente «manca».
  const [visti, setVisti] = useState<ReadonlySet<string>>(new Set())
  const [provato, setProvato] = useState(false)
  // Il blocco «sto inviando» vale subito: lo stato `fase` si aggiorna dopo il tocco, e due tocchi insieme manderebbero due richieste.
  const stoInviando = useRef(false)

  // Data e luogo di nascita li dice il codice fiscale: si calcolano a ogni disegno, non si scrivono.
  const v = useMemo<P.StatoPassi>(() => {
    const r = grezzo.risposte
    const natoIl = dataDaCf(r.codiceFiscale, '') ?? ''
    const luogo = luoghi && luogoDaCf(luoghi, pulisciCf(r.codiceFiscale), natoIl)
    const luogoG = luoghi && luogoDaCf(luoghi, pulisciCf(r.genitoreCodiceFiscale ?? ''))
    return {
      ...grezzo,
      risposte: { ...r, natoIl, natoA: luogo ? scriviLuogo(luogo) : r.natoA },
      natoAGenitore: luogoG?.nome ?? grezzo.natoAGenitore,
      // Con «Anche tu» il foglio si firma sempre qui.
      firmaInFoto: come === 'foto' && !grezzo.ancheTu,
    }
  }, [grezzo, luoghi, come])
  const r = v.risposte
  const figlio = v.chi === 'figlio'
  const ancheTu = !!v.ancheTu
  const luogoGenitore = luoghi && luogoDaCf(luoghi, pulisciCf(r.genitoreCodiceFiscale ?? ''))
  const provinciaGenitore = luogoGenitore?.sigla ?? provincia
  const natoIlGenitore = dataDaCf(r.genitoreCodiceFiscale ?? '', '') ?? ''

  const tipi = P.tipiDiPassi(v.chi, ancheTu)
  const nomiPassi = P.passiDi(v.chi, ancheTu)
  const tipo = tipi[passo - 1] ?? 'dati'
  const ultimo = passo === tipi.length
  const passoDi = (t: P.TipoPasso) => tipi.indexOf(t) + 1

  const errori = problemi(r)
  const nota = (k: CampoModulo): Nota | undefined => {
    const testo = P.notaSottoIlCampo(errori[k], provato, visti.has(k))
    return testo ? { testo, guaio: true } : undefined
  }
  const segna = (k: CampoModulo) => {
    const n = nota(k)
    return {
      onBlur: () => !visti.has(k) && setVisti(new Set(visti).add(k)),
      'aria-invalid': n?.guaio || undefined,
      'aria-describedby': n ? `n-${k}-nota` : undefined,
    }
  }
  const setR = (c: Partial<DatiRichiesta>) => setGrezzo((p) => ({ ...p, risposte: { ...p.risposte, ...c } }))
  const metti = (k: keyof DatiRichiesta) => (e: { target: { value: string } }) => setR({ [k]: e.target.value })
  const setSuo = (c: Partial<Suo>) => setGrezzo((p) => ({ ...p, suo: { ...(p.suo ?? SUO_VUOTO), ...c } }))
  const setFile = (tipoFile: TipoFile, f: File | undefined) => setGrezzo((p) => ({ ...p, file: { ...p.file, [tipoFile]: f } }))
  const scegliCorso = (id: string) => setR({ corsi: r.corsi.includes(id) ? r.corsi.filter((c) => c !== id) : [...r.corsi, id] })

  const nomiDei = (ids: readonly string[]) =>
    ids
      .map((id) => corsi?.find((c) => c.id === id)?.nome)
      .filter(Boolean)
      .join(', ')
  const refDei = (ids: readonly string[]) => (corsi ?? []).filter((c) => ids.includes(c.id))
  const perEta = (natoIl: string) => corsiPerEta(corsi ?? [], listino?.corsi ?? [], natoIl, listino?.senzaPrezzoVaBene)
  const paralleli = listino ? P.corsiParalleli(corsi ?? [], listino.corsi, natoIlGenitore, r.corsi) : []
  const suo = v.suo
  const daChiedere = P.fileDaChiedere(r.natoIl, refDei(r.corsi).map((c) => c.nome))
  const daChiedereSuo = P.fileDaChiedere(natoIlGenitore, refDei(suo?.corsi ?? []).map((c) => c.nome))
  // Con «Anche tu» il foglio è uno solo da firmare qui, per tutti e due i moduli.
  const comeEff = ancheTu ? 'qui' : come
  const nomeFirmatario = (figlio ? `${(r.genitoreNome ?? '').trim()} ${(r.genitoreCognome ?? '').trim()}` : `${r.nome.trim()} ${r.cognome.trim()}`).trim()
  const nomeBambino = r.nome.trim() || 'il bambino'

  const controllo = P.controlloScelta(v)
  const mancaOra = P.mancaNelPasso(v, passo)
  const manca = provato ? P.mancanti(v, passo) : []

  const vai = (p: number) => {
    setPasso(p)
    setProvato(false)
    setGuaio(null)
    vaiInCima()
  }
  const cambiaScelta = (a: P.Chi) => {
    setGrezzo(P.cambiaScelta(v, a))
    setTratti([])
    setCome('qui')
    setGuaioFirma(null)
    vai(1)
  }
  const focus = (chiave: string | undefined) => {
    if (!chiave) return
    setTimeout(() => {
      const el = document.getElementById(`n-${chiave}`) ?? document.getElementById(`m-file-${chiave}`)
      if (!el) return
      el.focus({ preventScroll: true })
      // Al centro: in cima starebbe sotto l'avanzamento, in fondo sotto la barra dei tasti.
      el.scrollIntoView({ block: 'center' })
    }, 0)
  }

  // --- il modulo firmato ------------------------------------------------------

  /** Il PDF del modulo, compilato coi dati di una persona e firmato. */
  const faiModulo = async (dati: DatiRichiesta, minore: boolean, scelte: P.StatoPassi['scelte'], natoA: string, prov: string): Promise<File> => {
    const [{ moduloFirmato }, originale, firma] = await Promise.all([
      import('../lib/firma'),
      fetch(MODULI[minore ? 1 : 0].file).then((x) => {
        if (!x.ok) throw new Error('Il modulo non si scarica')
        return x.arrayBuffer()
      }),
      firmaPng(tratti),
    ])
    const pdf = await moduloFirmato({
      dati,
      minore,
      scelte: { tesseramento: !!scelte.tesseramento, foto: !!scelte.foto },
      genitoreNatoA: natoA,
      genitoreProvincia: prov,
      firma,
      originale,
      stagione: STAGIONE,
    })
    return new File([new Uint8Array(pdf)], 'modulo-firmato.pdf', { type: 'application/pdf' })
  }

  /** Il modulo com'è venuto, in un'altra scheda, prima di mandarlo. */
  const guarda = async () => {
    const m = P.mancaPerFirmare(v)
    setGuaioFirma(m)
    if (m) return
    // La scheda si apre subito, al tocco: dopo un'attesa il telefono la bloccherebbe.
    const scheda = window.open('', '_blank')
    try {
      const url = URL.createObjectURL(await faiModulo(P.risposteDaiPassi(v), figlio, v.scelte, v.natoAGenitore, provinciaGenitore))
      if (scheda) scheda.location.href = url
      else window.location.assign(url)
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e) {
      // Chi usa l'app non legge il testo dell'errore: ci serve solo in console.
      console.error(e)
      scheda?.close()
      setGuaioFirma(P.moduloNonSiPrepara(!ancheTu))
    }
  }

  // --- l'invio ----------------------------------------------------------------

  const gestisci = (e: P.Esito, precedente?: Arrivo) => {
    // Un RIPROVA che non parte lascia l'esito di prima: quello che è già arrivato non si perde.
    if (e.esito === 'fermo' && precedente) {
      setFase({ tipo: 'esito', esito: precedente })
      return setGuaio(e.perche)
    }
    if (e.esito === 'fermo') {
      setFase({ tipo: 'compila' })
      return setGuaio(e.perche)
    }
    setFase({ tipo: 'esito', esito: e })
    vaiInCima()
  }

  const manda = async () => {
    if (!d || stoInviando.current) return
    stoInviando.current = true
    setGuaio(null)
    setFase({ tipo: 'invio' })
    const daMandare = P.richiesteDaMandare(v, provinciaGenitore, (c) => faiModulo(c.dati, c.minore, c.scelte, c.natoA, c.provincia))
    try {
      gestisci(await P.mandaRichieste(d, daMandare))
    } catch (e) {
      console.error(e)
      setFase({ tipo: 'compila' })
      setGuaio('Il server non risponde: riprova fra poco')
    } finally {
      stoInviando.current = false
    }
  }

  const riprova = async (e: Exclude<Arrivo, { esito: 'fatto' }>) => {
    if (stoInviando.current) return
    stoInviando.current = true
    setGuaio(null)
    setFase({ tipo: 'invio' })
    try {
      gestisci(await e.riprova(), e)
    } catch (x) {
      console.error(x)
      setFase({ tipo: 'esito', esito: e })
      setGuaio('Il server non risponde: riprova fra poco')
    } finally {
      stoInviando.current = false
    }
  }

  const avanti = () => {
    setProvato(true)
    const a = P.avanti(v, passo)
    if (a.manca.length) return focus(P.primoDaCorreggere(v, passo))
    if (ultimo) return void manda()
    vai(a.passo)
  }

  // --- gli esiti --------------------------------------------------------------

  if (fase.tipo === 'esito') {
    const e = fase.esito
    const due = e.esito === 'fatto' ? e.ids.length > 1 : !!suo
    const persone = figlio ? r.genitoreNome?.trim() || 'genitore' : r.nome.trim()
    if (e.esito === 'fatto') {
      const certificati = P.certificatiMancanti(v, corsi ?? []).map((x) => (x === 'chi' ? nomeBambino : r.genitoreNome?.trim() || 'il genitore'))
      const email = r.email.trim() || 'la tua email'
      const ultimaVolta = figlio ? 'ISCRIVI UN ALTRO FIGLIO' : 'ISCRIVI UN’ALTRA PERSONA'
      const righe: RigaRiepilogo[] = [
        { stato: 'numero', titolo: 'La segreteria ti scrive', dettaglio: `a ${email}, se manca qualcosa` },
        ...(certificati.length
          ? [{ stato: 'numero' as const, titolo: certificati.length > 1 ? 'Portate i certificati medici' : `Porti il certificato medico${figlio && !due ? ` di ${nomeBambino}` : ''}`, dettaglio: 'in segreteria, prima della prima lezione' }]
          : []),
        ...(!v.file.ricevuta
          ? [{ stato: 'numero' as const, titolo: due ? 'Pagate la quota e l’iscrizione' : 'Paghi la quota e l’iscrizione', dettaglio: due ? 'in segreteria, o mandate la ricevuta' : 'in segreteria, o mandi la ricevuta' }]
          : []),
      ]
      return (
        <div className="stack esito">
          <TitoloEsito tono="fatto">{due ? 'RICHIESTE ARRIVATE' : 'RICHIESTA ARRIVATA'}</TitoloEsito>
          <span className="esito-testo">
            Grazie, {persone}.{' '}
            {due
              ? `La segreteria ha ricevuto le iscrizioni di ${nomeBambino} (${nomiDei(r.corsi)}) e la tua (${nomiDei(suo?.corsi ?? [])}).`
              : figlio
                ? `La segreteria ha ricevuto l’iscrizione di ${nomeBambino} al corso di ${nomiDei(r.corsi)}, e controlla il modulo, il documento e il pagamento.`
                : `La segreteria ha ricevuto la tua richiesta per ${nomiDei(r.corsi)}, e controlla il modulo, il documento e il pagamento.`}
          </span>
          <span className="esito-testo">La segreteria ti scrive a {email} se manca qualcosa.</span>
          <Titoletto dentro>E ADESSO</Titoletto>
          <Riepilogo righe={righe} />
          <Tasto onClick={() => (figlio ? onAltroFiglio(v) : onEsci())}>{ultimaVolta}</Tasto>
          {figlio && <Dettaglio>I tuoi dati di genitore restano: non li riscrivi.</Dettaglio>}
          {figlio && <Tasto onClick={onEsci}>FINITO</Tasto>}
        </div>
      )
    }
    const nomeLui = r.genitoreNome?.trim() || 'il genitore'
    return (
      <div className="stack esito">
        {e.esito === 'secondaNo' ? (
          <>
            <TitoloEsito tono="avviso">MANCA UNA RICHIESTA</TitoloEsito>
            <span className="esito-testo">
              La richiesta di {nomeBambino} è arrivata. Quella di {nomeLui} no: {e.perche}
            </span>
          </>
        ) : (
          <>
            <TitoloEsito tono="avviso">MANCA QUALCHE FILE</TitoloEsito>
            <span className="esito-testo">
              Le risposte sono arrivate. Non è partito: {[...new Set(e.mancati.map((m) => ETICHETTA_FILE[m.tipo].toLowerCase()))].join(', ')}.
            </span>
            <Dettaglio tono="guaio">{e.perche}</Dettaglio>
          </>
        )}
        {guaio && (
          <div role="alert">
            <Riquadro tono="guaio">{guaio}</Riquadro>
          </div>
        )}
        <Tasto variante="principale" onClick={() => void riprova(e)}>
          RIPROVA
        </Tasto>
        {/* Le richieste al giorno hanno un limite: RIPROVA da solo non lascia una via d'uscita. */}
        {e.esito === 'secondaNo' && <Tasto onClick={onEsci}>FINITO</Tasto>}
        <Dettaglio>
          {e.esito === 'secondaNo'
            ? `Riprova rimanda solo quella di ${nomeLui}: quella di ${nomeBambino} è già arrivata e non si rimanda. Oppure chiama la segreteria.`
            : 'Si può riprovare per un’ora. Se non va, porta i fogli in segreteria.'}
        </Dettaglio>
      </div>
    )
  }

  // --- i passi ----------------------------------------------------------------

  const inVolo = fase.tipo === 'invio'
  const uscita = domandaUscita(P.perDomandaUscita(v))
  const ind = P.indietro(passo, uscita)
  const dueRichieste = figlio && !!suo

  const cf = (chiave: 'codiceFiscale' | 'genitoreCodiceFiscale', etichetta: string, nascita: string) => {
    const a = nascita ? `${anniScritti(nascita)}: lo dice il codice fiscale` : undefined
    const notaNascita = a ? { testo: a, guaio: false } : { testo: 'Compare dal codice fiscale', guaio: false }
    const valoreNascita = nascita ? nascita.split('-').reverse().join('/') : ''
    return (
      <>
        <Campo id={`n-${chiave}`} nota={chiave === 'codiceFiscale' && controllo && !errori[chiave] ? { testo: `Il codice torna, ma dice che è nato nel ${r.natoIl.slice(0, 4)}: è ${controllo.verdetto === 'minore' ? 'minorenne' : 'maggiorenne'}.`, guaio: false } : nota(chiave)} etichetta={etichetta} largo>
          <input
            id={`n-${chiave}`}
            {...segna(chiave)}
            className="campo num campo-codice"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={20}
            value={r[chiave] ?? ''}
            onChange={metti(chiave)}
          />
        </Campo>
        {/* La voce DATA DI NASCITA della barra (chiave natoIl) porta qui: la data la dice il codice fiscale di chi si iscrive. */}
        {chiave === 'codiceFiscale' ? (
          <Campo id="n-natoIl" etichetta="DATA DI NASCITA" nota={notaNascita}>
            <input id="n-natoIl" className="campo" readOnly value={valoreNascita} />
          </Campo>
        ) : (
          <Campo id="n-nascita-genitoreCodiceFiscale" etichetta="DATA DI NASCITA" nota={notaNascita}>
            <input id="n-nascita-genitoreCodiceFiscale" className="campo" readOnly value={valoreNascita} />
          </Campo>
        )}
        {chiave === 'codiceFiscale' ? (
          <Campo id="n-natoA" etichetta="LUOGO DI NASCITA" nota={nota('natoA')}>
            <input
              id="n-natoA"
              {...segna('natoA')}
              className="campo"
              readOnly={!!(luoghi && luogoDaCf(luoghi, pulisciCf(r.codiceFiscale), r.natoIl))}
              placeholder={luoghi ? 'Lo dice il codice fiscale' : undefined}
              value={r.natoA}
              onChange={metti('natoA')}
            />
          </Campo>
        ) : (
          <Campo id="n-luogo-genitore" etichetta="LUOGO DI NASCITA">
            <input id="n-luogo-genitore" className="campo" readOnly placeholder="Lo dice il codice fiscale" value={luogoGenitore ? scriviLuogo(luogoGenitore) : ''} />
          </Campo>
        )}
      </>
    )
  }

  const residenza = (titolo: string) => (
    <>
      <Titoletto>{titolo}</Titoletto>
      <div className="pad modulo-griglia">
        <Campo id="n-indirizzo" nota={nota('indirizzo')} etichetta="VIA E NUMERO" largo>
          <input id="n-indirizzo" maxLength={100} {...segna('indirizzo')} className="campo" autoComplete="street-address" value={r.indirizzo} onChange={metti('indirizzo')} />
        </Campo>
        <Campo id="n-cap" nota={nota('cap')} etichetta="CAP">
          <input id="n-cap" {...segna('cap')} className="campo num" inputMode="numeric" autoComplete="postal-code" maxLength={5} value={r.cap} onChange={metti('cap')} />
        </Campo>
        <Campo id="n-comune" nota={nota('comune')} etichetta="COMUNE">
          <input id="n-comune" maxLength={60} {...segna('comune')} className="campo" autoComplete="address-level2" value={r.comune} onChange={metti('comune')} />
        </Campo>
      </div>
    </>
  )

  const contatti = (
    <>
      <Titoletto>COME TI TROVIAMO</Titoletto>
      <div className="pad modulo-griglia">
        <Campo id="n-email" nota={nota('email')} etichetta="EMAIL" largo>
          <input id="n-email" maxLength={120} {...segna('email')} className="campo" type="email" autoComplete="email" value={r.email} onChange={metti('email')} />
        </Campo>
        <Campo id="n-telefono" nota={nota('telefono')} etichetta="TELEFONO">
          <input id="n-telefono" maxLength={20} {...segna('telefono')} className="campo" type="tel" autoComplete="tel" value={r.telefono} onChange={metti('telefono')} />
        </Campo>
        <Campo id="n-telefono2" nota={nota('telefono2')} etichetta="TELEFONO 2 · FACOLTATIVO">
          <input id="n-telefono2" maxLength={20} {...segna('telefono2')} className="campo" type="tel" value={r.telefono2 ?? ''} onChange={metti('telefono2')} />
        </Campo>
      </div>
    </>
  )

  /** Cosa chiedere in ogni passo. */
  const corpo = () => {
    if (tipo === 'dati') {
      return (
        <>
          <div className="pad modulo-griglia passo-prima">
            <Campo id="n-nome" nota={nota('nome')} etichetta="NOME">
              <input id="n-nome" maxLength={60} {...segna('nome')} className="campo" autoComplete="given-name" value={r.nome} onChange={metti('nome')} />
            </Campo>
            <Campo id="n-cognome" nota={nota('cognome')} etichetta="COGNOME">
              <input id="n-cognome" maxLength={60} {...segna('cognome')} className="campo" autoComplete="family-name" value={r.cognome} onChange={metti('cognome')} />
            </Campo>
            {cf('codiceFiscale', 'CODICE FISCALE', r.natoIl)}
            {controllo && (
              <div className="modulo-largo">
                <Riquadro tono="guaio">
                  <span className="passo-titolo">{controllo.domanda}</span>
                  <Dettaglio tono="testo">
                    {controllo.verdetto === 'minore'
                      ? 'Hai scelto «IO, SONO ADULTO», ma il codice fiscale è di un minorenne. Scegli «MIO FIGLIO O MIA FIGLIA»: ti chiediamo anche i tuoi dati di genitore.'
                      : 'Hai scelto «MIO FIGLIO O MIA FIGLIA», ma il codice fiscale è di un maggiorenne. Scegli «IO, SONO ADULTO»: i dati che hai scritto restano.'}
                  </Dettaglio>
                  <Tasti>
                    <Tasto onClick={() => cambiaScelta(controllo.verdetto === 'minore' ? 'figlio' : 'adulto')}>
                      {controllo.verdetto === 'minore' ? 'SCEGLI MIO FIGLIO O MIA FIGLIA' : 'SCEGLI IO, SONO ADULTO'}
                    </Tasto>
                    <Tasto onClick={() => document.getElementById('n-codiceFiscale')?.focus()}>CORREGGO IL CODICE</Tasto>
                  </Tasti>
                </Riquadro>
              </div>
            )}
          </div>
          {residenza(figlio ? 'DOVE ABITA' : 'DOVE ABITI')}
          {!figlio && contatti}
        </>
      )
    }

    if (tipo === 'genitore') {
      return (
        <>
          <div className="pad modulo-griglia passo-prima">
            <span className="modulo-largo">
              <Dettaglio tono="testo">Firma tu, che sei maggiorenne. I tuoi dati servono anche per il modulo.</Dettaglio>
            </span>
            <Campo id="n-genitoreNome" nota={nota('genitoreNome')} etichetta="NOME">
              <input id="n-genitoreNome" maxLength={60} {...segna('genitoreNome')} className="campo" value={r.genitoreNome ?? ''} onChange={metti('genitoreNome')} />
            </Campo>
            <Campo id="n-genitoreCognome" nota={nota('genitoreCognome')} etichetta="COGNOME">
              <input id="n-genitoreCognome" maxLength={60} {...segna('genitoreCognome')} className="campo" value={r.genitoreCognome ?? ''} onChange={metti('genitoreCognome')} />
            </Campo>
            {cf('genitoreCodiceFiscale', 'CODICE FISCALE DEL GENITORE', natoIlGenitore)}
            {P.luogoGenitoreDaChiedere(v, luoghi ?? undefined) && (
              <>
                <Campo id="n-natoAGenitore" etichetta="DOVE SEI NATO" nota={{ testo: 'Dal tuo codice fiscale non riusciamo a leggerlo: scrivilo tu.', guaio: false }}>
                  <input id="n-natoAGenitore" className="campo" value={v.natoAGenitore} onChange={(e) => setGrezzo((p) => ({ ...p, natoAGenitore: e.target.value }))} />
                </Campo>
                <Campo id="n-provincia" etichetta="PROVINCIA (ES. TO)">
                  <input id="n-provincia" className="campo campo-codice" autoCapitalize="characters" maxLength={2} value={provinciaGenitore} onChange={(e) => setProvincia(e.target.value.toUpperCase())} />
                </Campo>
              </>
            )}
          </div>
          {contatti}
        </>
      )
    }

    if (tipo === 'corso') {
      const ep = perEta(r.natoIl)
      const nome = r.nome.trim() || 'Chi si iscrive'
      // Alla famiglia si propone un corso parallelo per il genitore, con lo stesso orario.
      const conto = listino && paralleli[0] && r.corsi.length ? P.contoDelloStato(v, corsi ?? [], listino, chiaveGiorno(new Date()), paralleli[0]) : undefined
      return (
        <>
          <div className="pad modulo-griglia passo-prima">
            <ElencoCorsi
              id="n-corsi"
              perEta={ep}
              scelti={r.corsi}
              onScegli={scegliCorso}
              etaDi={figlio ? 'sua' : 'tua'}
              nota={nota('corsi')}
              caricando={guaioCorsi ? `I corsi non si leggono: ${guaioCorsi}` : !corsi ? 'Un attimo…' : undefined}
            />
          </div>
          {figlio && (
            <>
              <Titoletto>TI ISCRIVI ANCHE TU?</Titoletto>
              <div className="pad stack">
                <Riquadro tono="prova">
                  <span className="passo-titolo">{paralleli[0] ? `Mentre ${nome} fa ${nomiDei(r.corsi)}, tu puoi fare ${paralleli[0].nome}` : 'Ti iscrivi anche tu?'}</span>
                  <Dettaglio>
                    {paralleli[0]
                      ? `${paralleli[0].nome} è per la tua età. Stessa ora di ${nome}.`
                      : 'Se vuoi, scegli un corso anche per te: nello stesso modulo, con lo sconto famiglia sull’annuale.'}
                  </Dettaglio>
                  {conto && <Conto righe={conto.righe} totale={conto.totale} />}
                  {/* Sempre: chi sceglie il trimestre più sotto non deve aspettarsi lo sconto che vede qui. */}
                  {conto && <Dettaglio>Lo sconto famiglia vale sull’annuale: con il trimestre non c’è.</Dettaglio>}
                  <SceltaCorsi
                    id="n-ancheTu"
                    etichetta="Ti iscrivi anche tu"
                    una
                    voci={[
                      { id: 'si', testo: 'ISCRIVO ANCHE ME' },
                      { id: 'no', testo: `NO, SOLO ${nome.toUpperCase()}` },
                    ]}
                    scelti={v.ancheTu === undefined ? [] : [v.ancheTu ? 'si' : 'no']}
                    onScegli={(x) => {
                      if (x === 'si') {
                        setCome('qui')
                        setGrezzo((p) => ({ ...p, ancheTu: true, suo: p.suo ?? SUO_VUOTO, file: { ...p.file, modulo: undefined } }))
                      } else setGrezzo((p) => ({ ...p, ancheTu: false, suo: undefined }))
                    }}
                  />
                </Riquadro>
              </div>
            </>
          )}
          <Titoletto>{figlio ? 'COME PAGA' : 'COME PAGHI'}</Titoletto>
          <div className="pad stack passo-dopo">
            <SceltaCorsi
              id="n-formula"
              etichetta="Come paghi"
              una
              voci={FORMULE.map(([f, testo]) => ({ id: f, testo }))}
              scelti={[r.formula]}
              onScegli={(f) => setR({ formula: f === 'annuale' ? 'annuale' : 'trimestre' })}
            />
            <QuantoCosta nome={nome} cognome={r.cognome.trim()} corsi={refDei(r.corsi)} formula={r.formula} abbonamenti={[]} />
          </div>
          <Titoletto>LA RICEVUTA</Titoletto>
          <div className="pad stack passo-dopo">
            <SceltaFile tipo="ricevuta" file={v.file.ricevuta} onFile={(f) => setFile('ricevuta', f)} />
          </div>
        </>
      )
    }

    if (tipo === 'modulo') {
      const certificato = daChiedere.certificato
      return (
        <>
          <div className="pad modulo-griglia passo-prima">
            <div className="modulo-campo modulo-largo">
              <span className="modulo-etichetta">1 · LEGGI IL MODULO</span>
              <Dettaglio tono="testo">
                {figlio ? 'Le autorizzazioni per minori, che firma il genitore' : 'Sono le autorizzazioni della palestra'}: il tesseramento, le foto e la privacy.{' '}
                <a href={MODULI[figlio ? 1 : 0].file} target="_blank" rel="noreferrer" className="link-sec">
                  Leggi il modulo
                </a>
                .
              </Dettaglio>
            </div>
            {ancheTu && (
              <Dettaglio tono="testo">Il tuo corso lo scegli al passo {passoDi('anche')}.</Dettaglio>
            )}
            {!ancheTu && (
              <div className="modulo-campo modulo-largo">
                <span className="modulo-etichetta">2 · COME FIRMI?</span>
                <SceltaCorsi
                  id="n-come"
                  etichetta="Come firmi il modulo"
                  una
                  voci={[
                    { id: 'qui', testo: 'Firmo qui' },
                    { id: 'foto', testo: 'Ho il foglio firmato' },
                  ]}
                  scelti={[come]}
                  // Passando a «firmo qui» la foto del foglio non vale più: il PDF lo fa l'app.
                  onScegli={(c) => {
                    setCome(c === 'foto' ? 'foto' : 'qui')
                    if (c !== 'foto') setFile('modulo', undefined)
                  }}
                />
              </div>
            )}
            {comeEff === 'foto' ? (
              <SceltaFile tipo="modulo" file={v.file.modulo} onFile={(f) => setFile('modulo', f)} />
            ) : (
              <>
                <Casella
                  id="n-tesseramento"
                  etichetta="IL TESSERAMENTO ALLA FIJLKAM E/O FIPE"
                  dettaglio={`Per la stagione ${STAGIONE}.`}
                  si={figlio ? 'Autorizzo' : 'Acconsento'}
                  no={figlio ? 'Non autorizzo' : 'Non acconsento'}
                  scelta={v.scelte.tesseramento}
                  onScegli={(x) => setGrezzo((p) => ({ ...p, scelte: { ...p.scelte, tesseramento: x } }))}
                />
                <Casella
                  id="n-foto"
                  etichetta={figlio ? 'LE FOTO E I VIDEO DEL MINORE' : 'LE FOTO SUI SOCIAL'}
                  dettaglio={figlio ? 'Sui canali social della palestra e nei volantini e manifesti dei suoi eventi.' : 'Le foto che ti ritraggono, sui social della palestra.'}
                  si="Autorizzo"
                  no="Non autorizzo"
                  scelta={v.scelte.foto}
                  onScegli={(x) => setGrezzo((p) => ({ ...p, scelte: { ...p.scelte, foto: x } }))}
                />
                <div className="modulo-campo modulo-largo">
                  <label htmlFor="n-firma" className="modulo-etichetta">
                    {nomeFirmatario ? (
                      <>
                        LA FIRMA DI <span className="modulo-firmatario">{nomeFirmatario}</span>
                      </>
                    ) : figlio ? (
                      'LA FIRMA DEL GENITORE'
                    ) : (
                      'LA FIRMA'
                    )}
                  </label>
                  {/* Prima del riquadro vuoto: si legge perché è vuoto. */}
                  {v.avvisoFirma && <Dettaglio tono="avviso">{v.avvisoFirma}</Dettaglio>}
                  <TavolaFirma
                    id="n-firma"
                    tratti={tratti}
                    onTratti={(t) => {
                      setTratti(t)
                      // Una firma troppo piccola non conta: il conto dei passi resta a zero.
                      const vera = firmaVera(t)
                      setGuaioFirma(t.length && !vera ? 'La firma è troppo piccola: firma per bene nel riquadro' : null)
                      setGrezzo((p) => ({ ...p, tratti: vera ? t.length : 0, avvisoFirma: t.length ? undefined : p.avvisoFirma }))
                    }}
                    descritto="n-firma-nota"
                  />
                  <Dettaglio>
                    <span id="n-firma-nota">I dati delle domande, le caselle scelte, la data e la firma si scrivono sul modulo, e la firma va in ogni riga dove serve.</span>
                  </Dettaglio>
                  {guaioFirma && <Dettaglio tono="guaio">{guaioFirma}</Dettaglio>}
                  <Tasti>
                    <Tasto
                      onClick={() => {
                        setTratti([])
                        setGrezzo((p) => ({ ...p, tratti: 0 }))
                      }}
                      disabled={!tratti.length}
                    >
                      CANCELLA LA FIRMA
                    </Tasto>
                    <Tasto onClick={() => void guarda()}>GUARDA IL MODULO</Tasto>
                  </Tasti>
                </div>
              </>
            )}
          </div>
          <Titoletto>IL TUO OK</Titoletto>
          <div className="pad modulo-griglia modulo-consensi passo-dopo">
            <div className="modulo-largo">
              <label className="modulo-privacy">
                <input
                  id="n-regolamento"
                  type="checkbox"
                  checked={!!r.regolamento}
                  onChange={(e) => setR({ regolamento: e.target.checked })}
                  aria-describedby={nota('regolamento') ? 'n-regolamento-nota' : undefined}
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
                  dell’associazione.
                </span>
              </label>
              <NotaCampo id="n-regolamento-nota" nota={nota('regolamento')} />
            </div>
            <label className="modulo-largo modulo-privacy">
              <input id="n-privacy" type="checkbox" checked={v.privacy} onChange={(e) => setGrezzo((p) => ({ ...p, privacy: e.target.checked }))} />
              <span>
                Ho letto{' '}
                {INFORMATIVA_PUBBLICA ? (
                  <a href={INFORMATIVA_PUBBLICA} target="_blank" rel="noreferrer" className="link-sec">
                    l’informativa privacy
                  </a>
                ) : (
                  'l’informativa privacy'
                )}{' '}
                e so che questi dati li legge solo la segreteria della palestra.
              </span>
            </label>
          </div>
          <Titoletto>I FILE</Titoletto>
          <div className="pad modulo-griglia passo-dopo">
            {certificato !== 'nessuno' && (
              <div className="modulo-campo modulo-largo">
                <span className="modulo-etichetta">{figlio ? P.testoFile(v.chi, 'certificato', r.nome).etichetta : certificato === 'agonistico' ? 'IL CERTIFICATO MEDICO AGONISTICO' : 'IL CERTIFICATO MEDICO'}</span>
                <Dettaglio tono="avviso">
                  {certificato === 'agonistico' ? 'Per judo, aikido e lotta, dai 12 anni serve il certificato medico agonistico' : 'Dai 6 anni serve il certificato medico'} per partecipare alle lezioni.{' '}
                  {figlio ? P.testoFile(v.chi, 'certificato', r.nome).dettaglio : 'Se non ce l’hai ancora, lo porti in segreteria prima della prima lezione.'}
                </Dettaglio>
              </div>
            )}
            {daChiedere.file
              .filter((f) => f.tipo === 'documento' || f.tipo === 'documento-retro' || f.tipo === 'certificato')
              .map((f) => {
                const testi = P.testoFile(v.chi, f.tipo, r.nome)
                // Il perché del certificato è già detto sopra: qui solo cosa caricare.
                const dettaglio = f.tipo === 'certificato' ? 'Una foto o il PDF.' : testi.dettaglio
                return figlio ? (
                  <SceltaFileGenitore key={f.tipo} tipo={f.tipo} file={v.file[f.tipo]} onFile={(x) => setFile(f.tipo, x)} etichetta={testi.etichetta} dettaglio={dettaglio} />
                ) : (
                  <SceltaFile key={f.tipo} tipo={f.tipo} file={v.file[f.tipo]} onFile={(x) => setFile(f.tipo, x)} facoltativo={!f.obbligatorio} dettaglio={f.tipo === 'certificato' ? dettaglio : undefined} />
                )
              })}
          </div>
        </>
      )
    }

    if (tipo === 'anche') {
      const s = suo ?? SUO_VUOTO
      const ep = P.corsiPerEtaConStessaOra(corsi ?? [], listino, natoIlGenitore, r.corsi, nomeBambino)
      const nomeLui = `${(r.genitoreNome ?? '').trim()} ${(r.genitoreCognome ?? '').trim()}`.trim()
      return (
        <>
          <div className="pad modulo-griglia passo-prima">
            <span className="modulo-largo">
              <Dettaglio tono="testo">I tuoi dati li hai già scritti: ne mancano pochi. La carta d’identità e la firma valgono anche per te.</Dettaglio>
            </span>
            <div className="modulo-largo">
              <Riepilogo righe={[{ stato: 'fatto', titolo: nomeLui || 'Il genitore', dettaglio: 'nome, cognome, codice fiscale, residenza e contatti dei passi 2 e 1' }]} />
            </div>
            <div className="modulo-campo modulo-largo">
              <span className="modulo-etichetta">IL TUO CORSO</span>
              <Dettaglio>Corsi per la tua età.{paralleli.length ? ` Quello con la stessa ora di ${nomeBambino} è in cima.` : ''}</Dettaglio>
            </div>
            <ElencoCorsi
              id="n-suoCorsi"
              perEta={ep}
              scelti={s.corsi}
              onScegli={(id) => setSuo({ corsi: s.corsi.includes(id) ? s.corsi.filter((c) => c !== id) : [...s.corsi, id] })}
              etaDi="tua"
            />
            <div className="modulo-campo modulo-largo">
              <span className="modulo-etichetta">COME PAGHI</span>
              <SceltaCorsi
                id="n-suaFormula"
                etichetta="Come paghi"
                una
                voci={FORMULE.map(([f, testo]) => ({ id: f, testo }))}
                scelti={[s.formula]}
                onScegli={(f) => setSuo({ formula: f === 'annuale' ? 'annuale' : 'trimestre' })}
              />
            </div>
            <Casella
              id="n-suoTesseramento"
              etichetta="IL TESSERAMENTO ALLA FIJLKAM E/O FIPE"
              dettaglio={`Per la stagione ${STAGIONE}. Questa risposta è tua, non quella di ${nomeBambino}.`}
              si="Acconsento"
              no="Non acconsento"
              scelta={s.scelte.tesseramento}
              onScegli={(x) => setSuo({ scelte: { ...s.scelte, tesseramento: x } })}
            />
            <Casella
              id="n-suoFoto"
              etichetta="LE TUE FOTO E I TUOI VIDEO"
              dettaglio="Le foto che ti ritraggono, sui social della palestra."
              si="Autorizzo"
              no="Non autorizzo"
              scelta={s.scelte.foto}
              onScegli={(x) => setSuo({ scelte: { ...s.scelte, foto: x } })}
            />
            {daChiedereSuo.certificato !== 'nessuno' && (
              <SceltaFile tipo="certificato" file={s.certificato} onFile={(f) => setSuo({ certificato: f })} dettaglio="Se ce l’hai già: una foto o il PDF. Se no, lo porti in segreteria." facoltativo />
            )}
          </div>
        </>
      )
    }

    // riepilogo
    const righe = P.righeRiepilogo(v, corsi ?? [])
    const maiuscola = (t: string) => t.charAt(0) + t.slice(1).toLowerCase()
    const nomeLui = `${(r.genitoreNome ?? '').trim()} ${(r.genitoreCognome ?? '').trim()}`.trim()
    const conto = listino && dueRichieste ? P.contoDelloStato(v, corsi ?? [], listino, chiaveGiorno(new Date())) : undefined
    const modifica = (t: P.TipoPasso) => ({ testo: 'MODIFICA', onFai: () => vai(passoDi(t)) })
    const vistaDi = (x: (typeof righe)[number]): RigaRiepilogo => {
      const tasto = x.carica ? { testo: 'CARICA', onFai: () => vai(passoDi(x.passo)) } : modifica(x.passo)
      if (x.cosa === 'corso') return { stato: 'fatto', titolo: `${x.valore} · ${r.formula}`, dettaglio: 'Corso', tasto }
      if (x.cosa === 'genitore') return { stato: 'fatto', titolo: `Genitore: ${x.valore}`, dettaglio: `${r.telefono} · ${r.email}`, tasto }
      // Il certificato dice di chi è, quando le persone sono due.
      const di = x.cosa === 'certificato' && figlio ? ` di ${x.suo ? r.genitoreNome?.trim() || 'il genitore' : nomeBambino}` : ''
      const dettaglio = x.manca ? (x.carica === 'certificato' ? 'non caricato: lo porti in segreteria' : 'non caricata: paghi in segreteria') : x.valore
      return { stato: x.manca ? 'manca' : 'fatto', titolo: maiuscola(x.etichetta) + di, dettaglio, tasto }
    }
    const scelteDette = (sc: P.StatoPassi['scelte']) => `tesseramento: ${sc.tesseramento ? 'autorizzo' : 'non autorizzo'} · foto: ${sc.foto ? 'autorizzo' : 'non autorizzo'}`
    const righeVista: RigaRiepilogo[] = [
      { stato: 'fatto', titolo: `${r.nome.trim()} ${r.cognome.trim()}`, dettaglio: r.natoIl ? `nato il ${r.natoIl.split('-').reverse().join('/')} · ${anniScritti(r.natoIl)}` : undefined, tasto: modifica('dati') },
      ...righe.filter((x) => !x.manca && !x.suo && x.cosa !== 'ricevuta').map(vistaDi),
      ...(suo ? [{ stato: 'fatto' as const, titolo: nomeLui || 'Il genitore', dettaglio: `${nomiDei(suo.corsi)} · ${suo.formula} · ${scelteDette(suo.scelte)}`, tasto: modifica('anche') }] : []),
      { stato: 'fatto', titolo: figlio ? 'Firma del genitore' : 'Firma sul modulo', dettaglio: v.file.modulo ? 'foglio firmato, in foto' : scelteDette(v.scelte), tasto: modifica('modulo') },
      { stato: 'fatto', titolo: figlio ? 'Carta d’identità del genitore' : 'Carta d’identità', dettaglio: v.file.documento?.name, tasto: modifica('modulo') },
      ...righe.filter((x) => x.manca || x.suo || x.cosa === 'ricevuta').map(vistaDi),
    ]
    const senzaCertificato = righe.some((x) => x.carica === 'certificato')
    return (
      <div className="pad stack passo-prima">
        <Dettaglio tono="testo">{dueRichieste ? 'Due iscrizioni, due richieste.' : 'Ecco cosa stai mandando.'} Tocca MODIFICA per cambiare qualcosa.</Dettaglio>
        <Riepilogo righe={righeVista} />
        {conto && (
          <Riquadro>
            <span className="passo-titolo">Il conto</span>
            <Conto righe={conto.righe} totale={conto.totale} />
            <Dettaglio>È una stima: lo sconto lo conferma la segreteria. La quota associativa non ha sconti.</Dettaglio>
          </Riquadro>
        )}
        {senzaCertificato && <Dettaglio tono="avviso">Il certificato medico si porta in segreteria prima della prima lezione: senza non si partecipa.</Dettaglio>}
        <Campo id="n-note" etichetta="NOTE PER LA SEGRETERIA · FACOLTATIVE" largo>
          <textarea
            id="n-note"
            className="campo campo-note"
            rows={3}
            maxLength={P.MASSIMO_NOTE}
            placeholder="Niente dati sulla salute: quelli si portano in segreteria."
            value={r.note ?? ''}
            onChange={metti('note')}
          />
        </Campo>
        {guaio && (
          <div role="alert">
            <Riquadro tono="guaio">{guaio}</Riquadro>
          </div>
        )}
        <Dettaglio>{dueRichieste ? 'Mandale una volta sola' : 'Mandala una volta sola'}: ogni invio è una richiesta per la segreteria</Dettaglio>
      </div>
    )
  }

  return (
    <div className="modulo stack">
      {d?.modo === 'prova' && (
        <div className="pad modulo-testa">
          <Bollino>PROVA: RESTA SU QUESTO DISPOSITIVO</Bollino>
        </div>
      )}
      <Avanzamento numero={passo} totale={tipi.length} titolo={nomiPassi[passo - 1] ?? ''} />
      {corpo()}
      <BarraPasso
        // Un passo nuovo riparte con l'elenco chiuso.
        key={passo}
        manca={manca}
        onVai={focus}
        // Il «tutto a posto» solo se davvero non manca niente: a passo vuoto, prima di provare, non c'è né elenco né ✓.
        nota={mancaOra.length === 0 ? (ultimo ? undefined : 'Tutto a posto in questo passo.') : undefined}
        avanti={inVolo ? 'MANDO…' : ultimo ? (dueRichieste ? 'MANDA LE RICHIESTE' : 'MANDA LA RICHIESTA') : 'AVANTI'}
        tono={ultimo ? 'vai' : 'principale'}
        occupato={inVolo || (ultimo && !d)}
        chiede={ind.a === 'scelta' ? ind.chiede : undefined}
        onAvanti={avanti}
        onIndietro={() => (ind.a === 'passo' ? vai(ind.passo) : onEsci())}
      />
    </div>
  )
}
