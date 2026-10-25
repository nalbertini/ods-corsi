import { useEffect, useRef, useState, type FocusEvent, type FormEvent, type ReactNode } from 'react'
import type { CampoModulo, CorsoAperto, DatiRichiesta, DatiRichieste, TipoFile } from '../lib/richieste'
import { anniScritti, avvisoCertificato, certificatoDaPortare, aiutoScelta, chiFirma, daSelezionare, dataDaCf, datiRichieste, DETTAGLIO_RICEVUTA, domandaUscita, ESTENSIONI, FILE, fileObbligatori, firmaDaRifare, FORMULE, mancaPerInviare, MANCA_SCELTA, MASSIMO_FILE, NOTA_SCELTA, problemi, pulisciCf, sceltaMancante, tipiDaChiedere } from '../lib/richieste'
import { caricaLuoghi, luogoDaCf, scriviLuogo, type Luoghi } from '../lib/codiceFiscale'
import { apriAspettoModulo } from '../lib/aspettoModulo'
import { CONOSCIUTO, domandaConosciuto, origineDellaRichiesta, pulisciConosciuto, SCEGLI_SE_VUOI, type Conosciuto } from '../lib/provenienza'
import { riduciFoto } from '../lib/foto'
import { INFORMATIVA_PUBBLICA, MODULI, PAGAMENTO, REGOLAMENTO } from '../lib/iscrizione'
import { stagioneDi } from '../lib/costi'
import { altriAperti, corsiPerEta, testoAltriCorsi, type CorsoPerEta, type CorsoRef } from '../lib/listino'
import { causale, stimaIscrizione, type Abbonamento, type Stima } from '../lib/nucleo'
import { euro } from '../lib/ricevute'
import { chiaveGiorno } from '../lib/sala'
import { useListino } from './Costi'
import type { SceltaModulo } from '../lib/firma'
import { haUnServer } from '../lib/dati'
import { contaIscrizione, EVENTI_ISCRIZIONE } from '../lib/contaIscrizione'
import { CampiCarta } from './CampiCarta'
import { Bollino, Campo, CaricaFile, classiTasto, DueTocchi, Dettaglio, NotaCampo, Riquadro, SceltaCorsi, Tasti, Tasto, TitoloEsito, Titoletto, type Nota } from './ds'
import { firmaPng, firmaVera, TavolaFirma, type Tratto } from './TavolaFirma'
import { chiaveDelBrowser, chiavePreparo, chiedeRicevuta, comePuoiPagare, cosaNonVaModo, ERRORE_CARTA, ERRORE_SATISPAY, esitoPagamento, modoPagamento, nonSemplice, pagamentoDaMandare, senzaVoceDelCorso, soldi, statoRiquadroPaga, type PagamentoPrima, type Pago } from '../lib/satispay'

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
 * quanto costa con lo sconto famiglia e come pagarlo.
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
  codiceFiscale: 'm-cf',
  natoIl: 'm-nato-il',
  natoA: 'm-nato-a',
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

/** Ogni quanto si chiede a Satispay com'è andata, dopo aver aperto il pagamento. */
const OGNI = 4000

export function ModuloIscrizione({ onChiudi, nucleo, torna = 'TORNA ALLE ISCRIZIONI' }: { onChiudi: () => void; nucleo?: PerIlNucleo; torna?: string }) {
  const [d, setD] = useState<DatiRichieste | null>(null)
  const [corsi, setCorsi] = useState<CorsoAperto[] | null>(null)
  // Gli «altri corsi» (non per la sua età) si aprono con un tasto.
  const [altriApertiAMano, setAltriApertiAMano] = useState(false)
  const [guaioCorsi, setGuaioCorsi] = useState<string | null>(null)
  // Com'era all'apertura: INDIETRO chiede solo se c'è qualcosa di nuovo.
  const [inizio] = useState<DatiRichiesta>(() => ({ ...VUOTO, ...nucleo?.dati }))
  const [b, setB] = useState<DatiRichiesta>(inizio)
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
  // Perché firma e caselle sono sparite, finché non si firma di nuovo.
  const [daRifare, setDaRifare] = useState<string>()
  // Un campo che una persona non vede e un programma riempie.
  const [trappola, setTrappola] = useState('')
  const [guaio, setGuaio] = useState<string | null>(null)
  const [fase, setFase] = useState<Fase>({ tipo: 'compila' })
  // I campi già lasciati, e se si è già provato a mandare: prima, niente rosso.
  const [visti, setVisti] = useState<ReadonlySet<CampoModulo>>(new Set())
  const [provato, setProvato] = useState(false)
  const [pago, setPago] = useState<Pago | null>(null)
  const [satispayAttivo, setSatispayAttivo] = useState(false)
  // Con Satispay si paga in fondo al modulo, prima di mandare: il pagamento preparato, e se lo si è aperto.
  const [sp, setSp] = useState<PagamentoPrima | null>(null)
  const [aperto, setAperto] = useState(false)
  const [preparo, setPreparo] = useState(false)
  const [guaioSp, setGuaioSp] = useState<string | null>(null)
  // La carta: acceso solo col servizio PayPal, e se i suoi campi sono aperti sotto il riquadro.
  const [carta, setCarta] = useState<{ clientId: string; sandbox: boolean } | null>(null)
  const [campiCarta, setCampiCarta] = useState(false)
  const apriCarta = useRef<HTMLSpanElement>(null)
  // Quanti controlli dello stato di fila non hanno risposto: dopo qualche giro lo si dice.
  const erroriStato = useRef(0)

  // Finché il modulo è aperto ha l'aspetto del sito.
  useEffect(() => apriAspettoModulo(), [])

  // Si contano solo le richieste vere dalla pagina pubblica: né la prova né l'area degli iscritti (`nucleo`).
  const contare = haUnServer && !nucleo
  useEffect(() => {
    if (contare) void contaIscrizione(EVENTI_ISCRIZIONE.aperto)
  }, [contare])

  useEffect(() => {
    let vivo = true
    void datiRichieste()
      .then((x) => {
        if (!vivo) return
        setD(x)
        // Dal nucleo di un iscritto si paga come prima: Satispay è del modulo pubblico.
        if (!nucleo) void x.satispayAttivo().then((a) => vivo && setSatispayAttivo(a))
        if (!nucleo) void x.cartaAttiva().then((c) => vivo && setCarta(c))
        return x.corsiAperti().then((c) => vivo && setCorsi(c))
      })
      .catch((e) => vivo && setGuaioCorsi(e instanceof Error ? e.message : 'Il server non risponde'))
    return () => {
      vivo = false
    }
  }, [])

  // La data di nascita la dice il codice fiscale, come il luogo: quella scritta a
  // mano non si cancella, e torna se il codice smette di essere valido.
  const dalCf = dataDaCf(b.codiceFiscale, b.natoIl)
  const natoIl = dalCf ?? b.natoIl
  // Se l'elenco non arriva, il luogo si scrive a mano come prima.
  useEffect(() => void caricaLuoghi().then(setLuoghi, () => {}), [])
  // Il luogo di nascita lo dice il codice fiscale: quando lo si trova, non si scrive.
  const luogo = luoghi && luogoDaCf(luoghi, pulisciCf(b.codiceFiscale), natoIl)
  const luogoGenitore = luoghi && luogoDaCf(luoghi, pulisciCf(b.genitoreCodiceFiscale ?? ''))
  const natoAGenitore = luogoGenitore?.nome ?? genitoreNatoA
  const provinciaGenitore = luogoGenitore?.sigla ?? genitoreProvincia

  // Chi firmava fino a ora: una data a metà non lo cambia (`chiFirma`).
  const minorePrima = useRef<boolean>()
  const minore = chiFirma(natoIl, minorePrima.current)
  const pronta: DatiRichiesta = {
    ...b,
    natoIl,
    natoA: luogo ? scriviLuogo(luogo) : b.natoA,
    genitoreNome: minore ? b.genitoreNome : '',
    genitoreCognome: minore ? b.genitoreCognome : '',
    genitoreCodiceFiscale: minore ? b.genitoreCodiceFiscale : '',
  }
  // Se chi firma cambia (la data di nascita dice minore, o non più), il foglio
  // è un altro: firma, caselle e foto del foglio di prima non sono le sue.
  useEffect(() => {
    const prima = minorePrima.current
    minorePrima.current = minore
    if (prima === undefined || prima === minore) return
    setDaRifare((avviso) => firmaDaRifare(minore, { tratti: tratti.length, scelte: Object.keys(scelte).length, foto: !!file.modulo, avvisato: !!avviso }))
    setTratti([])
    setScelte({})
    setFile((p) => ({ ...p, modulo: undefined }))
    // Solo quando cambia chi firma: tratti, scelte e file si leggono com'erano in quel momento.
  }, [minore])
  const firmatario = minore ? `${(b.genitoreNome ?? '').trim()} ${(b.genitoreCognome ?? '').trim()}`.trim() : `${b.nome.trim()} ${b.cognome.trim()}`.trim()
  const foglio = MODULI[minore ? 1 : 0]
  // I corsi giusti per l'anno di nascita prima, gli altri dopo: si sceglie senza tornare al listino.
  const letto = useListino()
  const listino = letto?.listino
  const perEta = corsiPerEta(corsi ?? [], listino?.corsi ?? [], natoIl, listino?.senzaPrezzoVaBene)
  const fuoriEta = perEta.altri.filter((c) => b.corsi.includes(c.id)).map((c) => c.nome)
  const altriVisibili = altriAperti(altriApertiAMano, perEta.altri, b.corsi)
  // Aperto da un corso fuori età scelto, resta aperto anche se lo si toglie: l'elenco non si richiude sotto il dito.
  useEffect(() => {
    if (altriVisibili) setAltriApertiAMano(true)
  }, [altriVisibili])
  const tasto = (c: CorsoPerEta) => ({ id: c.id, testo: c.nome, riga: [c.riga, c.prezzoDaConfermare && 'prezzo da confermare'].filter(Boolean).join(' · ') || undefined })
  const certificato = certificatoDaPortare(
    natoIl,
    (corsi ?? []).filter((c) => b.corsi.includes(c.id)).map((c) => c.nome),
  )

  /** I file da chiedere: la carta d'identità e il certificato solo dai 6 anni. */
  const tipiChiesti = tipiDaChiedere(
    natoIl,
    (corsi ?? []).filter((c) => b.corsi.includes(c.id)).map((c) => c.nome),
  )
  const scelti = (corsi ?? []).filter((c) => b.corsi.includes(c.id))
  // Quanto si paga, come lo calcolerà il database (`importo_iscrizione`): la stessa regola, lo stesso listino.
  const stima = listino && !nucleo ? stimaIscrizione({ chi: b.nome, corsi: scelti, formula: b.formula }, [], chiaveGiorno(new Date()), listino) : null
  // Satispay solo col listino della segreteria: con quello del foglio il database non ha un prezzo da chiedere.
  const senzaPrezzo = stima && listino ? [...new Set([...stima.senzaPrezzo, ...senzaVoceDelCorso(scelti, listino)])] : []
  const attivo = satispayAttivo && !!stima && !!letto?.cambiato
  const complicato = attivo && listino && !senzaPrezzo.length ? nonSemplice(scelti, listino, fuoriEta) : null
  const puoi = complicato ? ({ satispay: false, perche: complicato } as const) : comePuoiPagare(senzaPrezzo, attivo)
  // La carta negli stessi casi di Satispay, e solo col suo servizio acceso.
  const cartaPuoi = puoi.satispay && !!carta
  const modo = modoPagamento(pago, { ...puoi, carta: cartaPuoi }, !!nucleo)
  const daChiedere = FILE.filter((f) => tipiChiesti.includes(f.tipo) && (f.tipo !== 'ricevuta' || chiedeRicevuta(modo, !!nucleo)))
  // I file di I FILE: il modulo ha la sua sezione, e la ricevuta del bonifico sta in IL PAGAMENTO (dal nucleo, qui come prima).
  const fileQui = daChiedere.filter((f) => f.tipo !== 'modulo' && (f.tipo !== 'ricevuta' || !!nucleo))
  // Col bonifico la ricevuta è obbligatoria (con Satispay non si chiede): come vuole anche `fileObbligatori` per la pagina pubblica.
  const obbligatori = fileObbligatori(daChiedere, modo === 'bonifico')

  // La scelta per cui si paga e chi paga: con Satispay o la carta sempre un corso solo (`nonSemplice`).
  const metodo: 'carta' | undefined = modo === 'carta' ? 'carta' : undefined
  const scelta = (modo === 'satispay' || modo === 'carta') && scelti.length === 1 ? { corso: scelti[0].id, formula: b.formula, nome: b.nome, cognome: b.cognome, email: b.email, chiave: metodo && chiaveDelBrowser() } : null

  const errori = problemi(pronta)

  /** Il pagamento Satispay per la scelta di adesso: quello vivo, o uno nuovo. Il link arriva prima del tocco. */
  const prepara = async () => {
    if (!d || !scelta) return
    setPreparo(true)
    setGuaioSp(null)
    try {
      const p = await d.prepara(scelta, metodo)
      setSp({ ...p, corsoId: scelta.corso, formula: scelta.formula, nome: scelta.nome, cognome: scelta.cognome, email: scelta.email, circuito: metodo })
      setAperto(false)
      setCampiCarta(false)
    } catch (e) {
      setGuaioSp(e instanceof Error ? e.message : metodo ? ERRORE_CARTA : ERRORE_SATISPAY)
    }
    setPreparo(false)
  }

  // Aperto Satispay, si chiede com'è andata: quando la pagina torna visibile, e intanto ogni pochi secondi.
  useEffect(() => {
    if (!d || !sp || sp.stato !== 'attesa' || !aperto) return
    let vivo = true
    erroriStato.current = 0
    const leggi = () =>
      document.visibilityState === 'visible' &&
      void d.statoSatispay(sp.id).then(
        (s) => {
          erroriStato.current = 0
          if (vivo && s && s.stato !== 'attesa') setSp((p) => (p && p.id === sp.id ? { ...p, ...s } : p))
        },
        // Una volta può capitare (la rete del telefono); tre di fila vuol dire che Satispay non risponde.
        () => vivo && ++erroriStato.current >= 3 && setGuaioSp(ERRORE_SATISPAY),
      )
    const timer = setInterval(leggi, OGNI)
    document.addEventListener('visibilitychange', leggi)
    return () => {
      vivo = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', leggi)
    }
  }, [d, sp?.id, sp?.stato, aperto])
  /** Cosa scrivere sotto un campo: «Manca» solo dopo aver provato a mandare. */
  const nota = (k: CampoModulo): Nota | undefined => {
    const e = errori[k]
    if (e && (provato || (visti.has(k) && e !== 'Manca'))) return { testo: e, guaio: true }
  }
  /** Dopo la conferma nei campi carta: il server incassa, e il riquadro dice com'è andata. */
  // Chiusi i campi, il fuoco torna sul tasto che li apre (ricompare al giro dopo).
  const annullaCarta = () => {
    setCampiCarta(false)
    requestAnimationFrame(() => apriCarta.current?.querySelector('button')?.focus())
  }
  const pagaCarta = async () => {
    if (!d || !sp) return
    const r = await d.pagaCarta(sp.id)
    setSp((p) => (p && p.id === sp.id ? { ...p, ...r } : p))
    if (r.stato !== 'attesa') setCampiCarta(false)
  }
  /** Le proprietà che legano un campo alla sua nota. */
  const segna = (k: CampoModulo) => {
    const n = nota(k)
    return {
      // Con un po' di ritardo: sul telefono il tocco mette il cursore dopo il fuoco e annullerebbe la selezione.
      onFocus: (e: FocusEvent<HTMLInputElement>) => {
        const campo = e.currentTarget
        const iniziale = String(inizio[k] ?? '')
        // Si riguarda il valore a tempo scaduto: se nel frattempo si è già scritto, non si cancella niente.
        setTimeout(() => daSelezionare(campo.value, iniziale) && campo.select(), 0)
      },
      onBlur: () => !visti.has(k) && setVisti(new Set(visti).add(k)),
      'aria-invalid': n?.guaio || undefined,
      'aria-describedby': n ? `${ID[k]}-nota` : undefined,
    }
  }
  const metti = (k: keyof DatiRichiesta) => (e: { target: { value: string } }) => setB({ ...b, [k]: e.target.value })
  const scegli = (id: string) => setB({ ...b, corsi: b.corsi.includes(id) ? b.corsi.filter((c) => c !== id) : [...b.corsi, id] })

  /** Cosa manca per fare il modulo firmato; `null` se si può. */
  const mancaPerFirmare = (): string | null => {
    const manca = sceltaMancante(scelte)
    if (manca) return MANCA_SCELTA[manca]
    if (minore && !natoAGenitore.trim()) return 'Nel modulo: manca dove è nato il genitore'
    if (!firmaVera(tratti)) return tratti.length ? 'La firma è troppo piccola: firma per bene nel riquadro' : 'Manca la firma sul modulo'
    return null
  }

  /** Cosa manca al modulo, a parte come si paga: con Satispay si paga solo col modulo a posto. */
  const mancaModulo = mancaPerInviare({
    dati: pronta,
    privacy,
    come,
    firma: mancaPerFirmare(),
    file,
    obbligatori,
  })
  const riquadroPaga = scelta && stima ? statoRiquadroPaga(scelta, sp, { stima: stima.totale, corso: scelti[0].nome, manca: mancaModulo, preparo, guaio: guaioSp, metodo }) : null
  /** Cosa blocca l'invio adesso; il riquadro in fondo lo mostra dopo il primo tentativo e lo segue a ogni modifica. */
  const blocco =
    mancaModulo ??
    (stima && scelti.length ? cosaNonVaModo(modo, !!nucleo, !!file.ricevuta, { pronto: riquadroPaga?.cosa === 'pagato', giaPagato: sp?.stato === 'pagato', circuito: sp?.circuito }, cartaPuoi) : null)

  // Si prepara da solo col modulo a posto, dopo un attimo senza modifiche (l'email non a metà), e di nuovo se cambiano
  // la scelta o chi paga. Dopo un errore si riprova col tasto, non a ogni lettera.
  // Col modo nella chiave: passare da Satispay alla carta prepara un pagamento dell'altro circuito.
  const k = chiavePreparo(scelta, mancaModulo)
  const chiave = k && `${modo}|${k}`
  const preparato = useRef('')
  useEffect(() => {
    if (!chiave || riquadroPaga?.cosa !== 'prepara' || preparato.current === chiave) return
    const t = setTimeout(() => {
      preparato.current = chiave
      void prepara()
    }, 800)
    return () => clearTimeout(t)
    // Solo quando cambiano scelta e persona, o il pagamento non serve più: `prepara` legge i dati di adesso.
  }, [chiave, riquadroPaga?.cosa])
  /** Le note sotto le scelte: dopo un tentativo di mandare, o di guardare il modulo. */
  const provatoFirma = provato || guaioFirma !== null
  const riquadro = provato ? blocco ?? guaio : null

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
      stagione: stagioneDi(chiaveGiorno(new Date())).etichetta,
    })
    return new File([new Uint8Array(pdf)], 'modulo-firmato.pdf', { type: 'application/pdf' })
  }

  /** Il modulo com'è venuto, in un'altra scheda, prima di mandarlo. */
  const guarda = async () => {
    const manca = mancaPerFirmare()
    setGuaioFirma(manca)
    const mancata = sceltaMancante(scelte)
    if (mancata) setTimeout(() => document.getElementById(`m-${mancata}`)?.focus(), 0)
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
    return !mancati.length
  }

  const manda = async (e: FormEvent) => {
    e.preventDefault()
    setGuaio(null)
    if (trappola) return setFase({ tipo: 'fatto' })
    setProvato(true)
    const primo = (Object.keys(ID) as CampoModulo[]).find((k) => errori[k])
    if (primo) setTimeout(() => document.getElementById(ID[primo])?.focus(), 0)
    // Se i campi sono a posto e manca una scelta del modulo, lo schermo va lì, non in fondo al riquadro.
    const mancata = sceltaMancante(scelte)
    if (!primo && come === 'qui' && mancata) setTimeout(() => document.getElementById(`m-${mancata}`)?.focus(), 0)
    if (blocco) return
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
      // Da dove arriva: l'etichetta del link della visita e la risposta; dall'area iscritti «area-iscritti», senza domanda.
      const { conosciuto, ...risposte } = pronta
      // Con Satispay la richiesta prende con sé il pagamento già fatto: senza, il database la rifiuta.
      id = await d!.invia({ ...risposte, ...origineDellaRichiesta(!!nucleo, conosciuto), pagamentoSatispay: pagamentoDaMandare(modo, sp) })
    } catch (e) {
      setFase({ tipo: 'compila' })
      return setGuaio(e instanceof Error ? e.message : 'Il server non risponde: riprova fra poco')
    }
    if (contare) void contaIscrizione(EVENTI_ISCRIZIONE.fatta)
    await carica(id, daChiedere.map((f) => f.tipo), tutti)
  }

  // Il certificato da portare: lo dice la pagina finale, con o senza Satispay.
  const promemoriaCertificato =
    certificato !== 'nessuno' && !file.certificato
      ? `Ricorda di consegnare in segreteria il certificato medico${certificato === 'agonistico' ? ' agonistico' : ''}: senza non si partecipa alle lezioni.`
      : null

  if (fase.tipo === 'fatto') {
    // Pagata con Satispay prima di mandare: lo dice la pagina finale.
    const pagata = (modo === 'satispay' || modo === 'carta') && sp?.stato === 'pagato' ? esitoPagamento(sp) : null
    return (
      <div className="pad stack esito">
        <TitoloEsito tono="fatto">{pagata?.titolo ?? 'RICHIESTA ARRIVATA'}</TitoloEsito>
        {pagata?.testi.map((t) => (
          <span key={t} className="esito-testo">{t}</span>
        ))}
        {pagata ? (
          <span className="esito-testo">La segreteria controlla la richiesta e ti scrive se manca qualcosa. La ricevuta della palestra te la dà la segreteria.</span>
        ) : (
          <span className="esito-testo">
            Grazie. La segreteria controlla il modulo, il documento e il pagamento, e ti scrive a {b.email.trim() || 'la tua email'} se manca qualcosa.
          </span>
        )}
        {promemoriaCertificato && <span className="esito-testo">{promemoriaCertificato}</span>}
        {!file.ricevuta && !modo && <span className="esito-testo">Non hai caricato la ricevuta: paga in segreteria, o portala lì se hai già pagato.</span>}
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
        <Dettaglio>Si può riprovare per un'ora. Se non va, {nucleo ? 'porta i fogli in segreteria' : 'chiama la segreteria'}.</Dettaglio>
      </div>
    )
  }

  const inVolo = fase.tipo === 'invio'
  return (
    <form className="stack modulo" onSubmit={(e) => void manda(e)} noValidate>
      <div className="pad row modulo-testa">
        <DueTocchi
          className={classiTasto()}
          disabled={inVolo}
          chiede={domandaUscita({
            risposte: b,
            inizio,
            file: Object.values(file).filter(Boolean).length,
            scelte: Object.keys(scelte).length,
            tratti: tratti.length,
            privacy,
            luogoGenitore: genitoreNatoA + genitoreProvincia,
          })}
          onFai={onChiudi}
        >
          ← INDIETRO
        </DueTocchi>
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
          <input id="m-nome" {...segna('nome')} className="campo" autoComplete="given-name" maxLength={80} value={b.nome} onChange={metti('nome')} />
        </Campo>
        <Campo id="m-cognome" nota={nota('cognome')} etichetta="COGNOME">
          <input id="m-cognome" {...segna('cognome')} className="campo" autoComplete="family-name" maxLength={80} value={b.cognome} onChange={metti('cognome')} />
        </Campo>
        <Campo id="m-cf" nota={nota('codiceFiscale')} etichetta="CODICE FISCALE" largo>
          <input id="m-cf" {...segna('codiceFiscale')} className="campo num campo-codice" autoCapitalize="characters" spellCheck={false} maxLength={20} value={b.codiceFiscale} onChange={metti('codiceFiscale')} />
        </Campo>
        {/* Gli anni accanto alla data: il codice del genitore al posto di quello del figlio si vede subito. */}
        <Campo
          id="m-nato-il"
          nota={nota('natoIl') ?? (dalCf ? { testo: `${anniScritti(dalCf)}: lo dice il codice fiscale`, guaio: false } : undefined)}
          etichetta="DATA DI NASCITA"
        >
          <input
            id="m-nato-il"
            {...segna('natoIl')}
            {...(dalCf && { 'aria-describedby': 'm-nato-il-nota' })}
            className="campo"
            type="date"
            readOnly={!!dalCf}
            value={natoIl}
            onChange={metti('natoIl')}
          />
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
        {daRifare && (
          <span className="modulo-largo">
            <Dettaglio tono="avviso">{daRifare}</Dettaglio>
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
        {/* Un errore sui corsi porta qui, dove la nota si legge prima dei due gruppi, che possono essere lunghi. */}
        <div id="m-corsi" tabIndex={-1} className="modulo-campo modulo-largo modulo-corsi-tutti">
          <NotaCampo id="m-corsi-nota" nota={nota('corsi')} />
          {guaioCorsi && <Dettaglio tono="guaio">I corsi non si leggono: {guaioCorsi}</Dettaglio>}
          {!corsi && !guaioCorsi && <Dettaglio>Un attimo…</Dettaglio>}
          {/* Il titolo serve solo se sotto c'è un altro gruppo: senza data i corsi sono in un elenco solo. */}
          {perEta.adatti.length > 0 && (perEta.senzaAnni.length > 0 || perEta.altri.length > 0) && <span className="modulo-etichetta">PER LA SUA ETÀ</span>}
          <SceltaCorsi
            id="m-corsi-adatti"
            etichetta="Corsi"
            voci={perEta.adatti.map(tasto)}
            scelti={b.corsi}
            onScegli={scegli}
            descritto={nota('corsi') ? 'm-corsi-nota' : undefined}
          />
          {perEta.senzaAnni.length > 0 && (
            <>
              <span className="modulo-etichetta modulo-altri">SENZA FASCIA D’ETÀ</span>
              <SceltaCorsi
                id="m-corsi-senza-anni"
                etichetta="Corsi senza fascia d’età"
                voci={perEta.senzaAnni.map(tasto)}
                scelti={b.corsi}
                onScegli={scegli}
                descritto={nota('corsi') ? 'm-corsi-nota' : undefined}
              />
            </>
          )}
          {perEta.altri.length > 0 &&
            (altriVisibili ? (
              <>
                <span className="modulo-etichetta modulo-altri">ALTRI CORSI</span>
                <SceltaCorsi
                  id="m-corsi-altri"
                  etichetta="Altri corsi"
                  voci={perEta.altri.map(tasto)}
                  scelti={b.corsi}
                  onScegli={scegli}
                  descritto={nota('corsi') ? 'm-corsi-nota' : undefined}
                />
              </>
            ) : (
              <button type="button" className="btn btn-dashed passo-btn" onClick={() => setAltriApertiAMano(true)}>
                {testoAltriCorsi(perEta.altri.length, 'sua')}
              </button>
            ))}
          {/* Sotto il gruppo da cui nasce, così il tasto appena toccato non scende sotto il dito; letto da chi usa un lettore di schermo. */}
          <div aria-live="polite">{fuoriEta.length > 0 && (
              <Dettaglio tono="avviso">
                {fuoriEta.join(', ')} {fuoriEta.length > 1 ? 'non sono' : 'non è'} della sua età: la segreteria ti richiama.
              </Dettaglio>
            )}</div>
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
        {/* Sulla pagina pubblica quanto e come pagare stanno in IL PAGAMENTO; dal nucleo, qui come prima. */}
        {nucleo && (
          <QuantoCosta
            nome={b.nome.trim()}
            cognome={b.cognome.trim()}
            corsi={(corsi ?? []).filter((c) => b.corsi.includes(c.id))}
            formula={b.formula}
            abbonamenti={nucleo.abbonamenti}
          />
        )}
      </Sezione>

      {!nucleo && stima && scelti.length > 0 && (
        <Sezione titolo="IL PAGAMENTO">
          <IlPagamento
            stima={stima}
            modo={modo}
            puoi={puoi}
            carta={cartaPuoi}
            onModo={setPago}
            causale={causale(b.nome.trim(), b.cognome.trim(), scelti.map((c) => c.nome))}
            ricevuta={
              <SceltaFile
                tipo="ricevuta"
                file={file.ricevuta}
                dettaglio="Una foto, lo screenshot o il PDF."
                onFile={(x) => setFile((p) => ({ ...p, ricevuta: x }))}
                facoltativo={false}
              />
            }
          />
        </Sezione>
      )}

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
          <Dettaglio>Firmi qui col dito, oppure carichi la foto del foglio già firmato.</Dettaglio>
        </div>
        {come === 'foto' ? (
          <SceltaFile
            tipo="modulo"
            file={file.modulo}
            onFile={(x) => {
              // Una foto ancora in preparazione quando cambia chi firma è del foglio di prima.
              if (minorePrima.current !== minore) return
              setFile((p) => ({ ...p, modulo: x }))
              if (x) setDaRifare(undefined)
            }}
          />
        ) : (
          <>
            <Casella
              id="m-tesseramento"
              etichetta="IL TESSERAMENTO ALLA FIJLKAM E/O FIPE"
              dettaglio={`Per la stagione ${stagioneDi(chiaveGiorno(new Date())).etichetta}. ${aiutoScelta('tesseramento', minore)}`}
              nota={provatoFirma && scelte.tesseramento === undefined ? NOTA_SCELTA.tesseramento : undefined}
              si={minore ? 'Autorizzo' : 'Acconsento'}
              no={minore ? 'Non autorizzo' : 'Non acconsento'}
              scelta={scelte.tesseramento}
              onScegli={(x) => {
                setScelte({ ...scelte, tesseramento: x })
                setGuaioFirma(null)
              }}
            />
            <Casella
              id="m-foto"
              etichetta={minore ? 'LE FOTO E I VIDEO DEL MINORE' : 'LE FOTO SUI SOCIAL'}
              dettaglio={`${minore ? 'Sui canali social della palestra e nei volantini e manifesti dei suoi eventi.' : 'Le foto che ti ritraggono, sui social della palestra.'} ${aiutoScelta('foto', minore)}`}
              nota={provatoFirma && scelte.foto === undefined ? NOTA_SCELTA.foto : undefined}
              si="Autorizzo"
              no="Non autorizzo"
              scelta={scelte.foto}
              onScegli={(x) => {
                setScelte({ ...scelte, foto: x })
                setGuaioFirma(null)
              }}
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
              {/* Prima del riquadro vuoto: si legge perché è vuoto. */}
              {daRifare && <Dettaglio tono="avviso">{daRifare}</Dettaglio>}
              <TavolaFirma
                id="m-firma"
                tratti={tratti}
                onTratti={(t) => {
                  setTratti(t)
                  setGuaioFirma(null)
                  if (t.length) setDaRifare(undefined)
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

      {fileQui.length > 0 || certificato !== 'nessuno' ? (
      <Sezione titolo="I FILE">
        {certificato !== 'nessuno' && (
          <div className="modulo-campo modulo-largo">
            <Dettaglio tono="avviso">{avvisoCertificato(certificato)}</Dettaglio>
          </div>
        )}
        {fileQui.map((f) => (
          <SceltaFile
            key={f.tipo}
            tipo={f.tipo}
            file={file[f.tipo]}
            onFile={(x) => setFile((p) => ({ ...p, [f.tipo]: x }))}
            facoltativo={!obbligatori.includes(f.tipo)}
            dettaglio={f.tipo === 'ricevuta' && obbligatori.includes('ricevuta') ? DETTAGLIO_RICEVUTA : undefined}
          />
        ))}
      </Sezione>
      ) : null}

      <Sezione titolo="ALTRO">
        {/* Dall'area iscritti no: la palestra la conoscono già. */}
        {!nucleo && <ComeCiHaiConosciuto id="m-conosciuto" valore={b.conosciuto} onScegli={(conosciuto) => setB({ ...b, conosciuto })} />}
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

      {riquadroPaga && (
        <Sezione titolo="PAGA">
          <div className="modulo-campo modulo-largo paga-riquadro" data-bordo={riquadroPaga.bordo}>
            <Riquadro stretto>
              <span className="num paga-cifra">{soldi(riquadroPaga.importo)}</span>
              <Dettaglio tono="testo">{riquadroPaga.riga}</Dettaglio>
              <Dettaglio tono={riquadroPaga.tonoTesto}>{riquadroPaga.testo}</Dettaglio>
              {guaioSp && guaioSp !== riquadroPaga.testo && <Dettaglio tono="guaio">{guaioSp}</Dettaglio>}
            </Riquadro>
          </div>
          {campiCarta && carta && riquadroPaga.azione === 'carta' && sp?.ordine && (
            <CampiCarta clientId={carta.clientId} sandbox={carta.sandbox} ordine={sp.ordine} importo={sp.importo} onPaga={pagaCarta} onAnnulla={annullaCarta} />
          )}
        </Sezione>
      )}

      <div className="pad stack modulo-piede">
        {riquadro && (
          <div role="alert">
            <Riquadro tono="guaio">{riquadro}</Riquadro>
          </div>
        )}
        {/* Con Satispay il tasto giallo è prima il pagamento, un link già pronto che si apre al tocco, e poi l'invio: lo decide statoRiquadroPaga. */}
        {riquadroPaga?.link ? (
          <Tasto variante="principale" href={riquadroPaga.link} qui={riquadroPaga.azione === 'chiama'} onClick={riquadroPaga.azione === 'link' ? () => setAperto(true) : undefined}>
            {riquadroPaga.tasto}
          </Tasto>
        ) : riquadroPaga?.azione === 'carta' ? (
          // A campi aperti il tasto per pagare è il loro.
          !campiCarta && (
            <span ref={apriCarta} style={{ display: 'contents' }}>
              <Tasto variante="principale" onClick={() => setCampiCarta(true)}>
                {riquadroPaga.tasto}
              </Tasto>
            </span>
          )
        ) : riquadroPaga && riquadroPaga.azione !== 'manda' ? (
          riquadroPaga.tasto && (
            <Tasto variante="principale" disabled={riquadroPaga.spento || riquadroPaga.azione !== 'prepara'} onClick={() => void prepara()}>
              {riquadroPaga.tasto}
            </Tasto>
          )
        ) : (
          <Tasto variante="principale" type="submit" disabled={inVolo || !d}>
            {inVolo ? fase.passo.toUpperCase() : 'MANDA LA RICHIESTA'}
          </Tasto>
        )}
        {riquadroPaga?.sotto && !(campiCarta && riquadroPaga.azione === 'carta') && <Dettaglio>{riquadroPaga.sotto}</Dettaglio>}
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
export function Casella({
  id,
  etichetta,
  dettaglio,
  si,
  no,
  scelta,
  nota,
  onScegli,
}: {
  id: string
  etichetta: string
  dettaglio: string
  /** Cosa manca, se si è già provato a mandare. */
  nota?: string
  si: string
  no: string
  scelta?: boolean
  onScegli: (x: boolean) => void
}) {
  return (
    <div className="modulo-campo modulo-largo">
      <span className="modulo-etichetta">{etichetta}</span>
      <Dettaglio>{dettaglio}</Dettaglio>
      {nota && <Dettaglio tono="guaio">{nota}</Dettaglio>}
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
export function SceltaFile({
  tipo,
  file,
  onFile,
  facoltativo,
  dettaglio,
  seManca,
}: {
  tipo: TipoFile
  file?: File
  onFile: (f: File | undefined) => void
  facoltativo?: boolean
  dettaglio?: string
  /** La parola accanto all'etichetta quando il file è facoltativo, se quella della lista non va qui. */
  seManca?: string
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
      seManca={(facoltativo ?? !f.obbligatorio) ? (seManca ?? f.seManca ?? 'FACOLTATIVO') : undefined}
      dettaglio={lavoro ? 'Preparo la foto…' : (dettaglio ?? f.dettaglio)}
      file={file && !lavoro ? { nome: file.name, byte: file.size } : undefined}
      errore={guaio}
      onFile={(x) => void scelto(x)}
    />
  )
}

/**
 * Quanto costa una persona in più nel nucleo, con lo sconto famiglia, o chi si
 * iscrive dalla pagina pubblica, e come pagarlo: l'IBAN e la causale col suo
 * nome, da copiare. La ricevuta si carica qui sotto, fra i file: dalla pagina
 * pubblica è obbligatoria, dal nucleo no.
 */
export function QuantoCosta({ nome, cognome, corsi, formula, abbonamenti }: { nome: string; cognome: string; corsi: CorsoRef[]; formula: DatiRichiesta['formula']; abbonamenti: Abbonamento[] }) {
  const letto = useListino()
  if (!letto) return null
  const s = stimaIscrizione({ chi: nome || 'Chi si iscrive', corsi, formula }, abbonamenti, chiaveGiorno(new Date()), letto.listino)
  return (
    <div className="modulo-campo modulo-largo">
      <span className="modulo-etichetta">QUANTO COSTA</span>
      <Riquadro stretto>
        {corsi.length === 0 && <Dettaglio>Scegli i corsi per vedere quanto costa.</Dettaglio>}
        <Conto s={s} />
        {s.sconto && !s.sconto.qui && (
          <Dettaglio>
            Lo sconto famiglia va sull’annuale che costa meno nel nucleo: {s.sconto.corso} di {s.sconto.chi}, che l’ha già avuto o lo avrà in segreteria.
          </Dettaglio>
        )}
        {formula === 'trimestre' && abbonamenti.length > 0 && <Dettaglio>Lo sconto famiglia vale sugli annuali, non sul trimestre.</Dettaglio>}
        {s.senzaPrezzo.length > 0 && <Dettaglio tono="avviso">Senza prezzo nel listino: {s.senzaPrezzo.join(', ')}. Lo dice la segreteria.</Dettaglio>}
        <Dettaglio>È una stima dal listino: le altre offerte e l’importo giusto li conferma la segreteria.</Dettaglio>
        {/* Senza nome il bonifico arriverebbe senza: la causale aspetta che lo si scriva. */}
        <Bonifico causale={nome && cognome ? causale(nome, cognome, corsi.map((c) => c.nome)) : null} satispay />
      </Riquadro>
    </div>
  )
}

/** Le righe del conto e il totale. */
function Conto({ s }: { s: Stima }) {
  return (
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
  )
}

/** L'IBAN e la causale col nome, da copiare; col link fisso di Satispay dove il pagamento non si segna da solo. */
function Bonifico({ causale: testo, satispay }: { causale: string | null; satispay?: boolean }) {
  const [copiato, setCopiato] = useState<string | null>(null)
  const copia = (cosa: string, valore: string) =>
    navigator.clipboard?.writeText(valore).then(
      () => {
        setCopiato(cosa)
        setTimeout(() => setCopiato(null), 2000)
      },
      () => {},
    )
  return (
    <>
      <Dettaglio>Bonifico a {PAGAMENTO.intestatario}:</Dettaglio>
      <span className="num iban">{PAGAMENTO.iban}</span>
      {testo ? (
        <Dettaglio>
          Causale: <span className="testo-pieno">{testo}</span>
        </Dettaglio>
      ) : (
        <Dettaglio tono="avviso">Scrivi nome e cognome per la causale.</Dettaglio>
      )}
      <Tasti>
        <Tasto onClick={() => void copia('iban', PAGAMENTO.iban.replace(/\s/g, ''))}>{copiato === 'iban' ? 'COPIATO' : 'COPIA IBAN'}</Tasto>
        {testo && <Tasto onClick={() => void copia('causale', testo)}>{copiato === 'causale' ? 'COPIATA' : 'COPIA CAUSALE'}</Tasto>}
        {satispay && PAGAMENTO.satispay && <Tasto href={PAGAMENTO.satispay}>PAGA CON SATISPAY</Tasto>}
      </Tasti>
    </>
  )
}

const MODI: Array<{ id: Pago; testo: string; riga: string }> = [
  { id: 'satispay', testo: 'Satispay', riga: 'Paghi subito, dall’app: l’importo è già scritto' },
  { id: 'carta', testo: 'Carta di credito o di debito', riga: 'Paghi subito qui, senza app e senza aprire conti' },
  { id: 'bonifico', testo: 'Bonifico', riga: 'Carichi la ricevuta del bonifico' },
]

/**
 * Il modulo pubblico: quanto si paga e come. Con Satispay l'importo è quello
 * che calcola il database, e si paga in fondo al modulo prima di mandare; col
 * bonifico IBAN, causale e la sua ricevuta stanno qui insieme.
 */
function IlPagamento({ stima, modo, puoi, carta, onModo, causale: testo, ricevuta }: { stima: Stima; modo: Pago | null; puoi: ReturnType<typeof comePuoiPagare>; carta: boolean; onModo: (m: Pago) => void; causale: string; ricevuta: ReactNode }) {
  return (
    <>
      <div className="modulo-campo modulo-largo">
        <span className="modulo-etichetta">QUANTO PAGHI</span>
        <Riquadro stretto>
          <Conto s={stima} />
          {stima.senzaPrezzo.length > 0 && <Dettaglio tono="avviso">Senza prezzo nel listino: {stima.senzaPrezzo.join(', ')}. Lo dice la segreteria.</Dettaglio>}
        </Riquadro>
      </div>
      <div className="modulo-campo modulo-largo">
        <span className="modulo-etichetta">PAGHI CON</span>
        <div className="scelta-pago">
          <SceltaCorsi
            id="m-pago"
            etichetta="Paghi con"
            una
            voci={MODI.filter((m) => (m.id === 'satispay' ? puoi.satispay : m.id === 'carta' ? carta : true))}
            scelti={modo ? [modo] : []}
            // `as`: SceltaCorsi rende l'id di una delle voci date, cioè un modo di MODI.
            onScegli={(m) => onModo(m as Pago)}
          />
        </div>
        {!puoi.satispay && puoi.perche && <Dettaglio>{puoi.perche}.</Dettaglio>}
        {(modo === 'satispay' || modo === 'carta') && (
          <Dettaglio>
            Paghi in fondo al modulo, prima di mandare la richiesta: {soldi(stima.totale)} {modo === 'carta' ? 'con la carta' : 'con Satispay'}.
          </Dettaglio>
        )}
      </div>
      {modo === 'bonifico' && (
        <>
          <div className="modulo-campo modulo-largo">
            <Bonifico causale={testo} />
          </div>
          {ricevuta}
        </>
      )}
    </>
  )
}

/**
 * «Come ci hai conosciuto?»: una tendina facoltativa, otto scelte chiuse e nessun testo libero (`provenienza.ts`).
 * La prima voce è vuota: lasciata lì, non si manda niente. Con più persone la domanda dice «avete».
 */
export function ComeCiHaiConosciuto({ id, valore, onScegli, famiglia = false }: { id: string; valore: Conosciuto | undefined; onScegli: (c: Conosciuto | undefined) => void; famiglia?: boolean }) {
  return (
    <Campo id={id} etichetta={domandaConosciuto(famiglia)} largo>
      <select id={id} className="campo" value={valore ?? ''} onChange={(e) => onScegli(pulisciConosciuto(e.target.value))}>
        <option value="">{SCEGLI_SE_VUOI}</option>
        {CONOSCIUTO.map((c) => (
          <option key={c.chiave} value={c.chiave}>
            {c.nome}
          </option>
        ))}
      </select>
    </Campo>
  )
}
