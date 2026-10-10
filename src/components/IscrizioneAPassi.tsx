import { useEffect, useMemo, useRef, useState } from 'react'
import { chiama } from '../lib/sito'
import type { CampoModulo, CorsoAperto, DatiRichiesta, DatiRichieste, OrarioAperto, TipoFile } from '../lib/richieste'
import { anniScritti, dataDaCf, datiRichieste, ESTENSIONI, ETICHETTA_FILE, FILE, FORMULE, MASSIMO_FILE, problemi, pulisciCf } from '../lib/richieste'
import { riduciFoto } from '../lib/foto'
import { caricaLuoghi, cfValido, luogoDaCf, scriviLuogo, type Luoghi } from '../lib/codiceFiscale'
import { INFORMATIVA_PUBBLICA, MODULI, PAGAMENTO, REGOLAMENTO, STAGIONE } from '../lib/iscrizione'
import { corsiAmmessi, type CorsoPerEta, type Listino } from '../lib/listino'
import { elenco, euro } from '../lib/ricevute'
import { chiaveGiorno } from '../lib/sala'
import * as P from '../lib/passiIscrizione'
import { useListino } from './Costi'
import { Avanzamento, BarraPasso, Bollino, CaricaFile, Campo, Chip, Dettaglio, NotaCampo, Riepilogo, Riquadro, SceltaCorsi, Tasti, Tasto, TitoloEsito, Titoletto, type Nota, type RigaRiepilogo } from './ds'
import { Contatti, Prova } from './IscrizioniScreen'
import { useDialogo } from './segreteria/comune'
import { Casella, QuantoCosta, SceltaFile } from './ModuloIscrizione'
import { comuneDalCap, conIlComune, etichettaTendina, fraseDellaScelta } from '../lib/comuneDalCap'
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
  const [orari, setOrari] = useState<OrarioAperto[]>([])
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
        // Gli orari non fermano niente: senza, nessuna «stessa ora» (orariAperti non rifiuta mai).
        void x.orariAperti().then((o) => vivo && setOrari(o))
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
          orari={orari}
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
 * Da cancellare quando il modulo vecchio sparisce: `SceltaFile` prenderà etichetta e dettaglio.
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

/** L'IBAN, la causale di tutto il modulo e i tasti per copiarli (e Satispay): il bonifico di QUANTO PAGHI. */
function ComePagare({ causale }: { causale: string }) {
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
      <span className="num iban iban-riga">{PAGAMENTO.iban}</span>
      <Dettaglio>
        Causale: <span className="testo-pieno">{causale}</span>
      </Dettaglio>
      <Tasti>
        <Tasto onClick={() => void copia('iban', PAGAMENTO.iban.replace(/\s/g, ''))}>{copiato === 'iban' ? 'COPIATO' : 'COPIA IBAN'}</Tasto>
        <Tasto onClick={() => void copia('causale', causale)}>{copiato === 'causale' ? 'COPIATA' : 'COPIA CAUSALE'}</Tasto>
        {PAGAMENTO.satispay && <Tasto href={PAGAMENTO.satispay}>PAGA CON SATISPAY</Tasto>}
      </Tasti>
    </>
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
            { id: 'adulto', testo: 'IO, SONO ADULTO', riga: `Ti servono: il tuo codice fiscale e la tua carta d’identità. ${P.passiDi('adulto').length} passi.` },
            { id: 'figlio', testo: 'MIO FIGLIO O MIA FIGLIA', riga: `Ti servono: il codice fiscale del bambino e il tuo, e la tua carta d’identità. ${P.passiDi('figlio').length} passi.` },
          ]}
          scelti={[]}
          onScegli={(c) => onScegli(c === 'figlio' ? 'figlio' : 'adulto')}
        />
        <Dettaglio>Il certificato medico si può caricare nel passo dei documenti, o portare in segreteria prima della prima lezione.</Dettaglio>
      </div>
      <Prova />
      <Contatti />
    </>
  )
}

/**
 * Il COMUNE coi suggerimenti del CAP (`comuneDalCap`): sotto il campo la nota quando il comune è quello del CAP,
 * o i comuni del CAP da scegliere, coi tasti o, se sono tanti, con la tendina. Il campo resta scrivibile.
 */
function CampoComune({ id, cap, comune, nota, segna, onComune }: { id: string; cap: string; comune: string; nota?: Nota; segna: object; onComune: (c: string) => void }) {
  const dal = comuneDalCap(cap, comune)
  return (
    <>
      <Campo id={id} nota={nota ?? (dal.nota ? { testo: dal.nota, guaio: false } : undefined)} etichetta="COMUNE">
        <input id={id} maxLength={60} {...segna} className="campo" autoComplete="address-level2" value={comune} onChange={(e) => onComune(e.target.value)} />
      </Campo>
      {dal.scelte.length > 0 &&
        (dal.tendina ? (
          <Campo id={`${id}-tendina`} etichetta={etichettaTendina(cap, dal.scelte.length)} largo>
            <select id={`${id}-tendina`} className="campo" value="" onChange={(e) => e.target.value && onComune(e.target.value)}>
              <option value="">Scegli il tuo comune</option>
              {dal.scelte.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Campo>
        ) : (
          <div className="modulo-campo modulo-largo">
            <Dettaglio>{fraseDellaScelta(cap, dal.scelte.length)}</Dettaglio>
            <SceltaCorsi id={`${id}-tasti`} etichetta="Il tuo comune" una voci={dal.scelte.map((c) => ({ id: c, testo: c }))} scelti={[]} onScegli={onComune} />
          </div>
        ))}
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
  di,
  nota,
  caricando,
  stessaOraDi,
}: {
  id: string
  /** `stessaOra`: i corsi di un familiare alla stessa ora della persona 0, in un gruppo loro in cima. */
  perEta: { stessaOra?: CorsoPerEta[]; adatti: CorsoPerEta[]; senzaAnni: CorsoPerEta[]; altri: CorsoPerEta[] }
  scelti: readonly string[]
  onScegli: (id: string) => void
  etaDi: 'tua' | 'sua'
  /** In famiglia: di chi sono i corsi che si stanno scegliendo. */
  di?: string
  nota?: Nota
  caricando?: string
  stessaOraDi?: string
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
      {!!perEta.stessaOra?.length && (
        <>
          <span className="modulo-etichetta modulo-etichetta-stessa-ora">{stessaOraDi ? `ALLA STESSA ORA DI ${stessaOraDi.toUpperCase()}` : 'ALLA STESSA ORA'}</span>
          <SceltaCorsi id={`${id}-stessa-ora`} etichetta={stessaOraDi ? `Corsi alla stessa ora di ${stessaOraDi}` : 'Corsi alla stessa ora'} voci={perEta.stessaOra.map(tasto)} scelti={scelti} onScegli={onScegli} descritto={descritto} />
        </>
      )}
      {perEta.adatti.length > 0 && <span className={perEta.stessaOra?.length ? 'modulo-etichetta modulo-altri' : 'modulo-etichetta'}>{`${perEta.stessaOra?.length ? 'GLI ALTRI CORSI ' : ''}PER LA ${etaDi.toUpperCase()} ETÀ${di ? ` · ${di.toUpperCase()}` : ''}`}</span>}
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

/**
 * Il foglio di AGGIUNGI, quando c'è da scegliere: per un adulto chi è (IO, PAOLA o UN ALTRO ADULTO, `scelteAdulto`),
 * per un bambino chi firma per lui. Sta sopra il passo, sotto un velo: ANNULLA (o fuori, o Esc) e non cambia niente.
 */
function FoglioFamiliare({
  chi,
  primo,
  scelte,
  firmano,
  onAggiungi,
  onChiudi,
}: {
  chi: P.Chi
  primo: string
  scelte: Array<{ io: boolean; testo: string }>
  firmano: Array<{ indice: number; nome: string }>
  onAggiungi: (firma: number, io: boolean) => void
  onChiudi: () => void
}) {
  const ref = useDialogo<HTMLDivElement>(onChiudi)
  const [io, setIo] = useState(chi === 'adulto' && !!scelte[0]?.io)
  const [firma, setFirma] = useState(firmano[0]?.indice ?? 0)
  return (
    <>
      <button type="button" className="sg-velo" tabIndex={-1} aria-label="ANNULLA" onClick={onChiudi} />
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="foglio-titolo" tabIndex={-1} className="foglio">
        <span id="foglio-titolo" className="ob foglio-titolo">
          {chi === 'adulto' ? 'CHI AGGIUNGI?' : 'CHI FIRMA PER LUI?'}
        </span>
        {chi === 'adulto' ? (
          <SceltaCorsi id="n-chi-aggiungi" etichetta="Chi aggiungi" una voci={scelte.map((x) => ({ id: x.io ? 'io' : 'altro', testo: x.testo }))} scelti={[io ? 'io' : 'altro']} onScegli={(x) => setIo(x === 'io')} />
        ) : (
          <SceltaCorsi id="n-chi-firma" etichetta="Chi firma per lui" una voci={firmano.map((f) => ({ id: String(f.indice), testo: f.nome.toUpperCase() }))} scelti={[String(firma)]} onScegli={(i) => setFirma(Number(i))} />
        )}
        <Dettaglio>
          {io
            ? `Nome, codice fiscale, carta d’identità e firma sono quelli che hai scritto per ${primo}: scegli solo il tuo corso.`
            : `Indirizzo, telefono ed email restano quelli di ${primo}: li cambi dopo, se serve. Quello che hai scritto finora non si perde.`}
        </Dettaglio>
        <Tasto variante="principale" onClick={() => onAggiungi(firma, io)}>
          AGGIUNGI
        </Tasto>
        <Tasto onClick={onChiudi}>ANNULLA</Tasto>
      </div>
    </>
  )
}

function Flusso({
  chi,
  iniziale,
  d,
  corsi,
  guaioCorsi,
  orari,
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
  orari: OrarioAperto[]
  luoghi: Luoghi | null
  listino?: Listino
  onEsci: () => void
  onAltroFiglio: (s: P.StatoPassi) => void
}) {
  // La famiglia: ogni persona ha il suo stato, il suo passo e la sua firma; `attivo` è quella che si sta scrivendo.
  // Con una persona sola è il flusso di sempre.
  const [persone, setPersone] = useState<P.StatoPassi[]>(() => [iniziale ?? P.nuovoStato(chi)])
  const [attivo, setAttivo] = useState(0)
  const [passi, setPassi] = useState([1])
  // I tratti servono per disegnare la firma; lo stato dei passi ne tiene il conto.
  const [trattiDi, setTrattiDi] = useState<Tratto[][]>([[]])
  // Il foglio di AGGIUNGI aperto da una carta di LA FAMIGLIA: per un adulto o per un bambino.
  const [foglio, setFoglio] = useState<P.Chi | null>(null)
  const passo = passi[attivo]
  const tratti = trattiDi[attivo]
  const famiglia = persone.length > 1
  const setGrezzo = (cambia: (p: P.StatoPassi) => P.StatoPassi) => setPersone((ps) => ps.map((p, i) => (i === attivo ? cambia(p) : p)))
  const setPasso = (n: number) => setPassi((a) => a.map((x, i) => (i === attivo ? n : x)))
  const setTratti = (t: Tratto[]) => setTrattiDi((a) => a.map((x, i) => (i === attivo ? t : x)))
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

  // Data e luogo di nascita li dice il codice fiscale: si calcolano a ogni disegno, non si scrivono. Così i dati
  // che un familiare prende da chi firma e dalla prima persona sono sempre quelli di adesso.
  const tutte = useMemo<P.StatoPassi[]>(
    () =>
      P.conDatiDellaFamiglia(persone).map((grezzo) => {
      const r = grezzo.risposte
      const natoIl = dataDaCf(r.codiceFiscale, '') ?? ''
      const luogo = luoghi && luogoDaCf(luoghi, pulisciCf(r.codiceFiscale), natoIl)
      const luogoG = luoghi && luogoDaCf(luoghi, pulisciCf(r.genitoreCodiceFiscale ?? ''))
      return {
        ...grezzo,
        // Un corso «dai N anni» scelto prima di correggere la data non parte con la richiesta.
        risposte: { ...r, natoIl, natoA: luogo ? scriviLuogo(luogo) : r.natoA, corsi: listino && corsi ? corsiAmmessi(r.corsi, corsi, listino.corsi, natoIl) : r.corsi },
        natoAGenitore: luogoG?.nome ?? grezzo.natoAGenitore,
        firmaInFoto: P.firmaInFoto(grezzo, come === 'foto', persone.length),
      }
      }),
    [persone, luoghi, come, corsi, listino],
  )
  const v = tutte[attivo]
  const r = v.risposte
  const figlio = v.chi === 'figlio'
  const luogoGenitore = luoghi && luogoDaCf(luoghi, pulisciCf(r.genitoreCodiceFiscale ?? ''))
  const provinciaGenitore = P.siglaDelGenitore(v, luoghi, provincia)
  const natoIlGenitore = dataDaCf(r.genitoreCodiceFiscale ?? '', '') ?? ''

  const tipi = P.tipiDiPassi(v.chi)
  const nomiPassi = P.nomiDeiPassi(v, attivo)
  const tipo = tipi[passo - 1] ?? 'dati'
  const ultimo = passo === tipi.length
  // AGGIUNGI sta in LA FAMIGLIA; in famiglia le pastiglie in ogni passo.
  const vistaFamiglia = P.famigliaNelPasso({ tipo, quante: persone.length })
  const passoDi = (t: P.TipoPasso) => tipi.indexOf(t) + 1
  // Il bambino 0, per l'io: i suoi dati, la sua firma e la sua carta sono anche dell'io.
  const delBambino = P.nomeDellaPersona(tutte[0], 0)

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
  const setFile = (tipoFile: TipoFile, f: File | undefined) => setGrezzo((p) => ({ ...p, file: { ...p.file, [tipoFile]: f } }))
  const scegliCorso = (id: string) => setR({ corsi: r.corsi.includes(id) ? r.corsi.filter((c) => c !== id) : [...r.corsi, id] })

  const nomiDei = (ids: readonly string[]) =>
    ids
      .map((id) => corsi?.find((c) => c.id === id)?.nome)
      .filter(Boolean)
      .join(', ')
  const refDei = (ids: readonly string[]) => (corsi ?? []).filter((c) => ids.includes(c.id))
  const daChiedere = P.fileDaChiedere(r.natoIl, refDei(r.corsi).map((c) => c.nome))
  // In famiglia ogni modulo si firma qui.
  const comeEff = famiglia ? 'qui' : come
  const nomeFirmatario = (figlio ? `${(r.genitoreNome ?? '').trim()} ${(r.genitoreCognome ?? '').trim()}` : `${r.nome.trim()} ${r.cognome.trim()}`).trim()
  const nomeBambino = r.nome.trim() || 'il bambino'
  // In famiglia chi firma può non essere chi compila: allora il suo nome, non «tu».
  const altroFirma = P.chiFirma(tutte, attivo)

  const controllo = P.controlloScelta(v)
  const mancaOra = P.mancaNelPasso(v, passo)
  const manca = provato ? (ultimo && famiglia ? P.mancantiFamiglia(tutte) : P.mancanti(v, passo)) : []

  // Chi esce (o ricarica) con risposte già scritte lo sente dal browser. Solo dopo una richiesta arrivata non c'è più niente da perdere:
  // negli esiti con qualcosa da rimandare (secondaNo, file) la richiesta è ancora in memoria.
  const perdibile = !(fase.tipo === 'esito' && fase.esito.esito === 'fatto') && tutte.some((p) => P.rispostePerdibili(p))
  useEffect(() => {
    if (!perdibile) return
    const avvisa = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // Safari e i browser meno nuovi aprono l'avviso solo se returnValue è scritto.
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', avvisa)
    return () => window.removeEventListener('beforeunload', avvisa)
  }, [perdibile])

  // A ogni cambio di passo il fuoco va al titolo (e lo screen reader legge «Passo N di N»); non alla prima apertura, né a ogni lettera.
  const titoloRef = useRef<HTMLDivElement>(null)
  const primoDisegno = useRef(true)
  useEffect(() => {
    if (primoDisegno.current) {
      primoDisegno.current = false
      return
    }
    titoloRef.current?.focus({ preventScroll: true })
  }, [passo])

  // Il corso alla stessa ora si spunta una volta sola, quando il familiare arriva la prima volta al suo passo del
  // corso: se poi lo toglie, resta tolto.
  const proposti = useRef(new Set<number>())
  const spunta = (i: number, p: number) => {
    // Chi è appena aggiunto non c'è ancora in `persone`: parte dal passo 1, non dal corso.
    const lui = persone[i]
    if (i === 0 || !lui || proposti.current.has(i) || P.tipiDiPassi(lui.chi)[p - 1] !== 'corso') return
    proposti.current.add(i)
    const ids = P.corsiGiaScelti(persone, i, corsi ?? [], listino, orari)
    if (ids.length) setPersone((ps) => ps.map((x, k) => (k === i ? { ...x, risposte: { ...x.risposte, corsi: ids } } : x)))
  }
  const vai = (p: number) => {
    spunta(attivo, p)
    setPasso(p)
    setProvato(false)
    setGuaio(null)
    vaiInCima()
  }
  const cambiaScelta = (a: P.Chi) => {
    // Si parte da quello che la persona ha scritto, non dai dati presi dagli altri.
    setGrezzo((p) => P.cambiaScelta(p, a))
    setTratti([])
    setCome('qui')
    setGuaioFirma(null)
    vai(1)
  }
  /** Da un'altra persona, al passo `p`: la sua pastiglia, MODIFICA o VAI A nell'ultimo passo. */
  const vaiA = (i: number, p: number, dopoIlTentativo = false) => {
    spunta(i, p)
    setAttivo(i)
    setPassi((a) => a.map((x, k) => (k === i ? p : x)))
    setVisti(new Set())
    setProvato(dopoIlTentativo)
    setGuaio(null)
    setGuaioFirma(null)
    vaiInCima()
  }
  const aggiungi = (chiNuovo: P.Chi, firma: number, io = false) => {
    setFoglio(null)
    let nuove: P.StatoPassi[]
    try {
      nuove = P.aggiungiFamiliare(persone, chiNuovo, firma, io)
    } catch (e) {
      // Le frasi di aggiungiFamiliare sono per chi usa l'app.
      return setGuaio(e instanceof Error ? e.message : 'Non riesco ad aggiungerlo: chiama la segreteria.')
    }
    setPersone(nuove)
    setPassi((a) => [...a, 1])
    setTrattiDi((a) => [...a, []])
    setCome('qui')
    vaiA(nuove.length - 1, 1)
  }
  // Le carte di LA FAMIGLIA: il foglio solo se c'è da scegliere (chi è l'adulto, chi firma per il bambino).
  const aggiungiAdulto = () => (P.scelteAdulto(tutte).length > 1 ? setFoglio('adulto') : aggiungi('adulto', 0))
  const aggiungiBambino = () => {
    const firmano = P.firmatariPossibili(tutte)
    return firmano.length > 1 ? setFoglio('figlio') : aggiungi('figlio', firmano[0]?.indice ?? 0)
  }
  const focus = (voce: string | undefined) => {
    if (!voce) return
    // In famiglia la voce comincia dal posto di chi è («2:firma»): prima si va da lei, al suo passo.
    const dellaPersona = /^(\d+):(.+)$/.exec(voce)
    const chiave = dellaPersona ? dellaPersona[2] : voce
    if (dellaPersona) vaiA(Number(dellaPersona[1]), P.passoDelCampo(tutte[Number(dellaPersona[1])], chiave) ?? 1, true)
    setTimeout(() => {
      const el = document.getElementById(`n-${chiave}`) ?? document.getElementById(`m-file-${chiave}`)
      if (!el) return
      el.focus({ preventScroll: true })
      // Al centro: in cima starebbe sotto l'avanzamento, in fondo sotto la barra dei tasti.
      // Un elenco più alto di mezzo schermo (i corsi del genitore) al centro perderebbe la sua cima: si vede da dove comincia.
      el.scrollIntoView({ block: el.getBoundingClientRect().height > window.innerHeight / 2 ? 'start' : 'center' })
    }, 0)
  }

  // --- il modulo firmato ------------------------------------------------------

  /** Il PDF del modulo, compilato coi dati di una persona e firmato. */
  const faiModulo = async (dati: DatiRichiesta, minore: boolean, scelte: P.StatoPassi['scelte'], natoA: string, prov: string, firmaDi = tratti): Promise<File> => {
    const [{ moduloFirmato }, originale, firma] = await Promise.all([
      import('../lib/firma'),
      fetch(MODULI[minore ? 1 : 0].file).then((x) => {
        if (!x.ok) throw new Error('Il modulo non si scarica')
        return x.arrayBuffer()
      }),
      firmaPng(firmaDi),
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
      setGuaioFirma(P.moduloNonSiPrepara(!famiglia))
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
    // Ogni persona ha la sua richiesta, e il suo modulo con la sua firma: quella dell'io è la firma data per il bambino 0.
    // La ricevuta è una per tutto il modulo: richiesteDelModulo la mette in ogni richiesta.
    const daMandare = P.richiesteDelModulo(tutte, (p, i) =>
      P.richiesteDaMandare(p, P.siglaDelGenitore(p, luoghi, provincia), (c) => faiModulo(c.dati, c.minore, c.scelte, c.natoA, c.provincia, trattiDi[p.io ? 0 : i])),
    )
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
    if (ultimo && famiglia) {
      const fermo = P.fermoDellaFamiglia(tutte)
      if (fermo) return setGuaio(fermo)
      const tutteLeMancanze = P.mancantiFamiglia(tutte)
      return tutteLeMancanze.length ? focus(tutteLeMancanze[0].chiave) : void manda()
    }
    const a = P.avanti(v, passo)
    if (a.manca.length) return focus(P.primoDaCorreggere(v, passo))
    if (ultimo) return void manda()
    vai(a.passo)
  }

  // --- gli esiti --------------------------------------------------------------

  if (fase.tipo === 'esito') {
    const e = fase.esito
    const due = famiglia
    // Con la famiglia la prima persona è quella da cui si è partiti, non quella aperta adesso.
    const prima = tutte[0]
    const aChi = prima.chi === 'figlio' ? prima.risposte.genitoreNome?.trim() || 'genitore' : prima.risposte.nome.trim()
    const nomiFamiglia = tutte.map((p, i) => P.nomeDellaPersona(p, i))
    if (e.esito === 'fatto') {
      const certificati = famiglia
        ? tutte.flatMap((p, i) => (P.certificatiMancanti(p, corsi ?? []).includes('chi') ? [nomiFamiglia[i]] : []))
        : P.certificatiMancanti(v, corsi ?? []).map(() => nomeBambino)
      const riassunto = P.riassuntoEsito(famiglia ? prima : v, corsi ?? [], listino, chiaveGiorno(new Date()), famiglia ? tutte : undefined)
      const frase = P.fraseContatti(riassunto.contatti.email, riassunto.contatti.telefono)
      const ultimaVolta = figlio ? 'ISCRIVI UN ALTRO FIGLIO' : 'ISCRIVI UN’ALTRA PERSONA'
      const righe: RigaRiepilogo[] = [
        ...(certificati.length
          ? [{ stato: 'numero' as const, titolo: certificati.length > 1 ? 'Portate i certificati medici' : `Porti il certificato medico${famiglia ? ` di ${certificati[0]}` : figlio ? ` di ${nomeBambino}` : ''}`, dettaglio: 'in segreteria, prima della prima lezione' }]
          : []),
      ]
      return (
        <div className="stack esito">
          <TitoloEsito tono="fatto">{due ? 'RICHIESTE ARRIVATE' : 'RICHIESTA ARRIVATA'}</TitoloEsito>
          <span className="esito-testo">
            Grazie, {aChi}.{' '}
            {famiglia
              ? `La segreteria ha ricevuto le iscrizioni di ${elenco(tutte.map((p, i) => `${nomiFamiglia[i]} (${nomiDei(p.risposte.corsi)})`))}.`
              : figlio
                ? `La segreteria ha ricevuto l’iscrizione di ${nomeBambino} al corso di ${nomiDei(r.corsi)}, e controlla il modulo, il documento e il pagamento.`
                : `La segreteria ha ricevuto la tua richiesta per ${nomiDei(r.corsi)}, e controlla il modulo, il documento e il pagamento.`}
          </span>
          {frase && <span className="esito-testo">{frase}</span>}
          {riassunto.pagamento === 'ricevuta' ? (
            <Dettaglio>La segreteria controlla il pagamento.</Dettaglio>
          ) : (
            <>
              <Titoletto dentro>DA PAGARE</Titoletto>
              {riassunto.pagamento === 'importo' && !riassunto.famiglia ? (
                <QuantoCosta nome={r.nome.trim()} cognome={r.cognome.trim()} corsi={refDei(r.corsi)} formula={r.formula} abbonamenti={[]} />
              ) : (
                <>
                  <span className="esito-testo esito-importo">
                    {riassunto.importo ? `In tutto ${riassunto.importo}${riassunto.conSconto ? ', con lo sconto famiglia' : ''}. ` : ''}
                    Paghi in segreteria, oppure con un bonifico a {PAGAMENTO.intestatario}; poi mandi la ricevuta.
                  </span>
                  {/* La stessa causale di QUANTO PAGHI: con più persone ha i nomi di tutti. */}
                  <ComePagare causale={P.causaleDelModulo(tutte, corsi ?? [])} />
                </>
              )}
              {riassunto.famiglia && riassunto.senzaPrezzo.length > 0 && <Dettaglio tono="avviso">{riassunto.senzaPrezzo.join(', ')}: prezzo da confermare, lo dice la segreteria.</Dettaglio>}
            </>
          )}
          <Titoletto dentro>E ADESSO</Titoletto>
          <Riepilogo righe={righe} />
          <Tasto href={chiama} qui>
            CHIAMA LA SEGRETERIA
          </Tasto>
          {!famiglia && <Tasto onClick={() => (figlio ? onAltroFiglio(v) : onEsci())}>{ultimaVolta}</Tasto>}
          {figlio && !famiglia && <Dettaglio>I tuoi dati di genitore restano: non li riscrivi.</Dettaglio>}
          {(figlio || famiglia) && <Tasto onClick={onEsci}>FINITO</Tasto>}
        </div>
      )
    }
    if (e.esito === 'aMeta') {
      // Le richieste partono nell'ordine delle persone: chi è arrivato sono le prime.
      const f = P.fraseAMeta(e.arrivati, e.mancanti)
      return (
        <div className="stack esito">
          <TitoloEsito tono="avviso">{f.titolo}</TitoloEsito>
          <span className="esito-testo">{f.arrivate}</span>
          <span className="esito-testo">{f.mancano}</span>
          <Dettaglio tono="guaio">{e.perche}</Dettaglio>
          <Riepilogo
            righe={[...e.arrivati, ...e.mancanti].map((nome, i) => {
              const arrivata = i < e.arrivati.length
              return { stato: arrivata ? 'fatto' : 'guaio', titolo: nome, dettaglio: `${nomiDei(tutte[i].risposte.corsi)} · ${arrivata ? 'ARRIVATA' : 'NON È PARTITA'}` }
            })}
          />
          {guaio && (
            <div role="alert">
              <Riquadro tono="guaio">{guaio}</Riquadro>
            </div>
          )}
          <Tasto variante="principale" onClick={() => void riprova(e)}>
            {P.etichettaRiprova(e.mancanti)}
          </Tasto>
          <Tasto href={chiama} qui>
            CHIAMA LA SEGRETERIA
          </Tasto>
        </div>
      )
    }
    // Due richieste: le prime due persone della famiglia.
    const nomeLui = nomiFamiglia[1] ?? ''
    const nomePrima = nomiFamiglia[0]
    return (
      <div className="stack esito">
        {e.esito === 'secondaNo' ? (
          <>
            <TitoloEsito tono="avviso">MANCA UNA RICHIESTA</TitoloEsito>
            <span className="esito-testo">
              La richiesta di {nomePrima} è arrivata. Quella di {nomeLui} no: {e.perche}
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
            ? `Riprova rimanda solo quella di ${nomeLui}: quella di ${nomePrima} è già arrivata e non si rimanda. Oppure chiama la segreteria.`
            : 'Si può riprovare per un’ora. Se non va, porta i fogli in segreteria.'}
        </Dettaglio>
      </div>
    )
  }

  // --- i passi ----------------------------------------------------------------

  const inVolo = fase.tipo === 'invio'
  const uscita = P.uscitaDellaFamiglia(tutte)
  const ind = P.indietro(passo, uscita)

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
          <input id="n-cap" {...segna('cap')} className="campo num" inputMode="numeric" autoComplete="postal-code" maxLength={5} value={r.cap} onChange={(e) => setR(conIlComune(r, e.target.value))} />
        </Campo>
        <CampoComune id="n-comune" cap={r.cap} comune={r.comune} nota={nota('comune')} segna={segna('comune')} onComune={(comune) => setR({ comune })} />
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

  // Una riga per persona (LA FAMIGLIA e il riepilogo): MODIFICA porta da lei, e se le manca qualcosa VAI A porta a quella cosa.
  const righePersone = (): RigaRiepilogo[] =>
    P.righeDellaFamiglia(tutte, corsi ?? []).map((x, i) => ({
      stato: x.manca ? 'manca' : 'fatto',
      titolo: x.titolo,
      dettaglio: x.dettaglio,
      tasto: { testo: x.manca ? 'VAI A' : 'MODIFICA', onFai: () => vaiA(i, x.passo, x.manca) },
    }))

  /** Cosa chiedere in ogni passo. */
  const corpo = () => {
    // L'io (chi compila il bambino 0 e si iscrive anche lui): dati, firma e carta sono quelli scritti per il bambino.
    if (v.io && tipo === 'dati') {
      const alGenitore = P.tipiDiPassi(tutte[0].chi).indexOf('genitore') + 1 || 1
      return (
        <div className="pad stack passo-prima">
          <Dettaglio tono="testo">Sei tu, che iscrivi {delBambino}: i tuoi dati li hai già scritti.</Dettaglio>
          <Riepilogo
            righe={[
              {
                stato: 'fatto',
                titolo: `${r.nome.trim()} ${r.cognome.trim()}`.trim() || 'Il genitore',
                dettaglio: [r.codiceFiscale, r.comune, r.email].filter((x) => x.trim()).join(' · ') || undefined,
                tasto: { testo: 'MODIFICA', onFai: () => vaiA(0, alGenitore) },
              },
            ]}
          />
        </div>
      )
    }
    if (v.io && tipo === 'modulo') {
      return (
        <div className="pad modulo-griglia passo-prima">
          <span className="modulo-largo">
            <Dettaglio tono="testo">La firma, il regolamento e la privacy sono quelli che hai dato per {delBambino}: valgono anche per te. Qui le tue risposte.</Dettaglio>
          </span>
          <Casella
            id="n-tesseramento"
            etichetta="IL TESSERAMENTO ALLA FIJLKAM E/O FIPE"
            dettaglio={`Per la stagione ${STAGIONE}. Questa risposta è tua, non quella di ${delBambino}.`}
            si="Acconsento"
            no="Non acconsento"
            scelta={v.scelte.tesseramento}
            onScegli={(x) => setGrezzo((p) => ({ ...p, scelte: { ...p.scelte, tesseramento: x } }))}
          />
          <Casella
            id="n-foto"
            etichetta={P.etichettaSueFoto(r.nome)}
            dettaglio="Le foto che ti ritraggono, sui social della palestra."
            si="Autorizzo"
            no="Non autorizzo"
            scelta={v.scelte.foto}
            onScegli={(x) => setGrezzo((p) => ({ ...p, scelte: { ...p.scelte, foto: x } }))}
          />
        </div>
      )
    }
    if (v.io && tipo === 'documenti') {
      return (
        <>
          <Titoletto>I DOCUMENTI</Titoletto>
          <div className="pad modulo-griglia passo-dopo">
            <span className="modulo-largo">
              <Dettaglio tono="testo">La carta d’identità è quella che hai caricato per {delBambino}: vale anche per te.</Dettaglio>
            </span>
            {daChiedere.certificato !== 'nessuno' && (
              <SceltaFile tipo="certificato" file={v.file.certificato} onFile={(f) => setFile('certificato', f)} dettaglio="Se ce l’hai già: una foto o il PDF. Se no, lo porti in segreteria." facoltativo />
            )}
          </div>
        </>
      )
    }

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
              <Dettaglio tono="testo">{P.fraseDelGenitore(altroFirma)}</Dettaglio>
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
                <Campo id="n-natoAGenitore" etichetta="DOVE SEI NATO">
                  <input id="n-natoAGenitore" className="campo" placeholder="Comune" value={v.natoAGenitore} onChange={(e) => setGrezzo((p) => ({ ...p, natoAGenitore: e.target.value }))} />
                </Campo>
                <Campo id="n-provincia" etichetta="PROVINCIA" nota={cfValido(pulisciCf(r.genitoreCodiceFiscale ?? '')) ? { testo: 'Non lo ricaviamo dal tuo codice fiscale: scrivilo tu.', guaio: false } : undefined}>
                  <input id="n-provincia" className="campo campo-codice" autoCapitalize="characters" maxLength={2} placeholder="ES. TO" value={provinciaGenitore} onChange={(e) => setProvincia(e.target.value.toUpperCase())} />
                </Campo>
              </>
            )}
          </div>
          {contatti}
        </>
      )
    }

    if (tipo === 'corso') {
      // In famiglia, per chi si aggiunge, in cima i corsi alla stessa ora della persona 0.
      const ep = P.corsiDelFamiliare(persone, attivo, corsi ?? [], listino, orari)
      const fraseNascosti = figlio ? P.fraseCorsiNascosti(ep.nascosti, r.nome) : undefined
      return (
        <>
          <div className="pad modulo-griglia passo-prima">
            <ElencoCorsi
              id="n-corsi"
              perEta={ep}
              scelti={r.corsi}
              onScegli={scegliCorso}
              etaDi={figlio ? 'sua' : 'tua'}
              di={famiglia ? P.nomeDellaPersona(v, attivo) : undefined}
              nota={nota('corsi')}
              caricando={guaioCorsi ? `I corsi non si leggono: ${guaioCorsi}` : !corsi ? 'Un attimo…' : undefined}
              stessaOraDi={attivo > 0 ? P.nomeDellaPersona(tutte[0], 0) : undefined}
            />
            {fraseNascosti && <Dettaglio>{fraseNascosti}</Dettaglio>}
          </div>
          <Titoletto>{famiglia ? `QUANDO PAGA ${P.nomeDellaPersona(v, attivo).toUpperCase()}` : figlio ? 'QUANDO PAGA' : 'QUANDO PAGHI'}</Titoletto>
          <div className="pad stack passo-dopo">
            <SceltaCorsi
              id="n-formula"
              etichetta="Come paghi"
              una
              voci={FORMULE.map(([f, testo]) => ({ id: f, testo }))}
              scelti={[r.formula]}
              onScegli={(f) => setR({ formula: f === 'annuale' ? 'annuale' : 'trimestre' })}
            />
          </div>
        </>
      )
    }

    if (tipo === 'modulo') {
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
            {!famiglia && (
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
          <Titoletto>{P.titoloDellOk(altroFirma)}</Titoletto>
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
        </>
      )
    }

    if (tipo === 'documenti') {
      const certificato = daChiedere.certificato
      return (
        <>
          <Titoletto>I DOCUMENTI</Titoletto>
          <div className="pad modulo-griglia passo-dopo">
            {certificato !== 'nessuno' && !figlio && (
              <div className="modulo-campo modulo-largo">
                <span className="modulo-etichetta">{figlio ? P.testoFile(v.chi, 'certificato', r.nome, r.genitoreNome).etichetta : certificato === 'agonistico' ? 'IL CERTIFICATO MEDICO AGONISTICO' : 'IL CERTIFICATO MEDICO'}</span>
                <Dettaglio tono="avviso">
                  {certificato === 'agonistico' ? 'Per judo, aikido e lotta, dai 12 anni serve il certificato medico agonistico' : 'Dai 6 anni serve il certificato medico'} per partecipare alle lezioni.{' '}
                  {figlio ? P.testoFile(v.chi, 'certificato', r.nome, r.genitoreNome).dettaglio : 'Se non ce l’hai ancora, lo porti in segreteria prima della prima lezione.'}
                </Dettaglio>
              </div>
            )}
            {daChiedere.file
              .filter((f) => f.tipo === 'documento' || f.tipo === 'documento-retro' || f.tipo === 'certificato')
              .map((f) => {
                const testi = P.testoFile(v.chi, f.tipo, r.nome, r.genitoreNome)
                // Il perché del certificato è già detto sopra: qui solo cosa caricare.
                const dettaglio = testi.dettaglio
                return figlio ? (
                  <SceltaFileGenitore key={f.tipo} tipo={f.tipo} file={v.file[f.tipo]} onFile={(x) => setFile(f.tipo, x)} etichetta={testi.etichetta} dettaglio={dettaglio} />
                ) : (
                  <SceltaFile key={f.tipo} tipo={f.tipo} file={v.file[f.tipo]} onFile={(x) => setFile(f.tipo, x)} facoltativo={!f.obbligatorio} dettaglio={f.tipo === 'certificato' ? 'Una foto o il PDF.' : undefined} />
                )
              })}
          </div>
        </>
      )
    }

    if (tipo === 'pagamento') {
      const conto = P.contoDelModulo(tutte, corsi ?? [], listino, chiaveGiorno(new Date()))
      const insieme = P.insieme(tutte)
      const avviso = P.avvisoRicevuta(tutte, conto?.totale)
      return (
        <>
          <div className="pad stack passo-prima">
            <Dettaglio tono="testo">
              {insieme ? 'Un pagamento solo per tutti. ' : ''}Pagare in segreteria va benissimo: non serve il bonifico né caricare niente.
            </Dettaglio>
            <div className="modulo-campo modulo-largo">
              <span className="modulo-etichetta">{insieme ? 'IL CONTO DELLA FAMIGLIA' : 'IL CONTO'}</span>
              <Riquadro stretto>
                {conto ? (
                  <>
                    <Conto righe={conto.righe} totale={conto.totale} />
                    {conto.senzaPrezzo.length > 0 && <Dettaglio tono="avviso">Senza prezzo nel listino: {conto.senzaPrezzo.join(', ')}. Lo dice la segreteria.</Dettaglio>}
                    <Dettaglio>
                      Paga questo totale{conto.conSconto ? ': lo sconto è già dentro' : ''}. Se la segreteria trova una differenza, te lo dice lei. Bonifico a {PAGAMENTO.intestatario}:
                    </Dettaglio>
                  </>
                ) : (
                  <Dettaglio>L’importo te lo conferma la segreteria. Bonifico a {PAGAMENTO.intestatario}:</Dettaglio>
                )}
                <ComePagare causale={P.causaleDelModulo(tutte, corsi ?? [])} />
              </Riquadro>
            </div>
          </div>
          <Titoletto>LA RICEVUTA · FACOLTATIVA</Titoletto>
          <div className="pad stack passo-dopo">
            <SceltaFile
              tipo="ricevuta"
              file={P.ricevutaDelModulo(tutte)}
              onFile={(f) => setPersone((ps) => P.conLaRicevuta(ps, f, conto?.totale))}
              dettaglio={insieme ? 'Una sola, per tutta la famiglia. Una foto o il PDF.' : undefined}
            />
            {avviso && <Dettaglio tono="avviso">{avviso}</Dettaglio>}
          </div>
        </>
      )
    }

    if (tipo === 'famiglia') {
      const frasi = P.frasiDellaFamiglia(tutte[0])
      return (
        <div className="pad stack passo-prima">
          <span className="passo-titolo">{frasi.domanda}</span>
          <div className="card famiglia-sconto">
            <span className="famiglia-sconto-cifra">−20%</span>
            <span className="stack">
              <span className="famiglia-sconto-titolo">SCONTO FAMIGLIA</span>
              <span className="famiglia-sconto-testo">{frasi.sconto}</span>
            </span>
          </div>
          {vistaFamiglia.aggiungi ? (
            P.carteDellaFamiglia(tutte, corsi ?? [], listino, orari, chiaveGiorno(new Date())).map((c) => (
              <Riquadro key={c.chi}>
                <span className="famiglia-carta-titolo">{c.titolo}</span>
                <Dettaglio tono="testo">{c.frase}</Dettaglio>
                {c.stessaOra && (
                  <span className="famiglia-carta-ora">
                    <span className="famiglia-carta-tag">STESSA ORA</span>
                    {c.stessaOra}
                  </span>
                )}
                {c.risparmio && <span className="famiglia-carta-risparmio">{c.risparmio}</span>}
                <button type="button" className="btn btn-dashed passo-btn" onClick={c.chi === 'adulto' ? aggiungiAdulto : aggiungiBambino}>
                  {c.tasto}
                </button>
              </Riquadro>
            ))
          ) : (
            <Riquadro tono="prova">
              <span className="modulo-etichetta">{P.frasiDelMassimo.etichetta}</span>
              <span className="passo-titolo">{P.frasiDelMassimo.titolo}</span>
              <Dettaglio>{P.frasiDelMassimo.testo}</Dettaglio>
              <Tasti>
                <Tasto variante="principale" href={chiama} qui>
                  CHIAMA
                </Tasto>
              </Tasti>
            </Riquadro>
          )}
          {famiglia && (
            <>
              <span className="modulo-etichetta">NEL MODULO</span>
              <Riepilogo righe={righePersone()} />
            </>
          )}
          {guaio && (
            <div role="alert">
              <Riquadro tono="guaio">{guaio}</Riquadro>
            </div>
          )}
        </div>
      )
    }

    // riepilogo
    const righe = P.righeRiepilogo(v, corsi ?? [])
    const maiuscola = (t: string) => t.charAt(0) + t.slice(1).toLowerCase()
    const conto = famiglia ? P.contoDellaFamiglia(tutte, corsi ?? [], listino, chiaveGiorno(new Date())) : undefined
    const modifica = (t: P.TipoPasso) => ({ testo: 'MODIFICA', onFai: () => vai(passoDi(t)) })
    const vistaDi = (x: (typeof righe)[number]): RigaRiepilogo => {
      const tasto = x.carica ? { testo: 'CARICA', onFai: () => vai(passoDi(x.passo)) } : modifica(x.passo)
      if (x.cosa === 'corso') return { stato: 'fatto', titolo: `${x.valore} · ${r.formula}`, dettaglio: 'Corso', tasto }
      if (x.cosa === 'genitore') return { stato: 'fatto', titolo: `Genitore: ${x.valore}`, dettaglio: `${r.telefono} · ${r.email}`, tasto }
      // Il certificato del bambino dice di chi è: il genitore legge la riga.
      const di = x.cosa === 'certificato' && figlio ? ` di ${nomeBambino}` : ''
      const dettaglio = x.manca ? (x.carica === 'certificato' ? 'non caricato: lo porti in segreteria' : 'non caricata: paghi in segreteria') : x.valore
      return { stato: x.manca ? 'manca' : 'fatto', titolo: maiuscola(x.etichetta) + di, dettaglio, tasto }
    }
    const scelteDette = (sc: P.StatoPassi['scelte']) => `tesseramento: ${sc.tesseramento ? 'autorizzo' : 'non autorizzo'} · foto: ${sc.foto ? 'autorizzo' : 'non autorizzo'}`
    // La ricevuta è una per tutto il modulo (sta nella prima persona): in famiglia una riga sola, sotto le persone.
    const rigaRicevuta = [vistaDi(P.rigaDellaRicevuta(tutte))]
    const righeVista: RigaRiepilogo[] = famiglia ? [...righePersone(), ...rigaRicevuta] : [
      { stato: 'fatto', titolo: `${r.nome.trim()} ${r.cognome.trim()}`, dettaglio: r.natoIl ? `nato il ${r.natoIl.split('-').reverse().join('/')} · ${anniScritti(r.natoIl)}` : undefined, tasto: modifica('dati') },
      ...righe.filter((x) => !x.manca && x.cosa !== 'ricevuta').map(vistaDi),
      { stato: 'fatto', titolo: figlio ? 'Firma del genitore' : 'Firma sul modulo', dettaglio: v.file.modulo ? 'foglio firmato, in foto' : scelteDette(v.scelte), tasto: modifica(P.passoDelRiepilogo('firma')) },
      { stato: 'fatto', titolo: P.cartaNelRiepilogo(v.chi, r.genitoreNome), dettaglio: v.file.documento?.name, tasto: modifica(P.passoDelRiepilogo('carta')) },
      ...righe.filter((x) => x.manca || x.cosa === 'ricevuta').map(vistaDi),
    ]
    const senzaCertificato = famiglia ? tutte.some((p) => P.certificatiMancanti(p, corsi ?? []).includes('chi')) : righe.some((x) => x.carica === 'certificato')
    return (
      <div className="pad stack passo-prima">
        <Dettaglio tono="testo">{famiglia ? `${tutte.length} iscrizioni, ${tutte.length} richieste.` : 'Ecco cosa stai mandando.'} Tocca MODIFICA per cambiare qualcosa.</Dettaglio>
        <Riepilogo righe={righeVista} />
        {conto && (
          <Riquadro>
            <span className="passo-titolo">{famiglia ? 'Il conto della famiglia' : 'Il conto'}</span>
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
        <Dettaglio>{famiglia ? 'Mandale una volta sola' : 'Mandala una volta sola'}: ogni invio è una richiesta per la segreteria</Dettaglio>
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
      <Avanzamento rif={titoloRef} numero={passo} totale={tipi.length} titolo={nomiPassi[passo - 1] ?? ''} />
      <div className="pad passo-chiama">
        <span className="passo-chiama-testo">Un dubbio? Chiama la segreteria.</span>
        <Tasto href={chiama} qui>
          CHIAMA
        </Tasto>
      </div>
      {vistaFamiglia.pastiglie && (
        <>
          <Titoletto conto={persone.length}>LA FAMIGLIA</Titoletto>
          <div className="pad stack passo-famiglia">
            <div className="famiglia-chip">
              {tutte.map((p, i) => {
                const nome = P.nomeDellaPersona(p, i).toUpperCase()
                const mancano = i === attivo ? 0 : P.quantoManca(p)
                return (
                  <Chip key={i} acceso={i === attivo} numero={mancano} etichetta={P.etichettaPastiglia(nome, mancano)} onClick={() => i !== attivo && vaiA(i, passi[i])}>
                    {nome}
                  </Chip>
                )
              })}
            </div>
          </div>
        </>
      )}
      {corpo()}
      {foglio && (
        <FoglioFamiliare
          chi={foglio}
          primo={delBambino}
          scelte={P.scelteAdulto(tutte)}
          firmano={P.firmatariPossibili(tutte)}
          onAggiungi={(firma, io) => aggiungi(foglio, firma, io)}
          onChiudi={() => setFoglio(null)}
        />
      )}
      <BarraPasso
        // Un passo nuovo riparte con l'elenco chiuso.
        key={passo}
        manca={manca}
        totale={P.totaleDellaFamiglia(tutte, attivo, passo, corsi ?? [], listino, chiaveGiorno(new Date()))}
        onVai={focus}
        // Il «tutto a posto» solo se davvero non manca niente: a passo vuoto, prima di provare, non c'è né elenco né ✓.
        nota={mancaOra.length === 0 ? (ultimo ? undefined : tipo === 'famiglia' ? 'Nessuno da aggiungere? Vai avanti.' : 'Tutto a posto in questo passo.') : undefined}
        // Da solo AVANTI a LA FAMIGLIA vuol dire «nessun altro»: lo dice chi si iscrive da adulto; per il bambino resta AVANTI.
        avanti={inVolo ? 'MANDO…' : ultimo ? (famiglia ? 'MANDA LA RICHIESTA PER TUTTI' : 'MANDA LA RICHIESTA') : tipo === 'famiglia' && !famiglia && !figlio ? 'AVANTI, SOLO IO' : 'AVANTI'}
        tono={ultimo ? 'vai' : 'principale'}
        occupato={inVolo || (ultimo && !d)}
        chiede={ind.a === 'scelta' ? ind.chiede : undefined}
        onAvanti={avanti}
        onIndietro={() => (ind.a === 'passo' ? vai(ind.passo) : onEsci())}
      />
    </div>
  )
}
