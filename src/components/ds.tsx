import { type ReactNode, useEffect, useRef, useState } from 'react'

/**
 * I pezzi del design system ODS Corsi che servono alle iscrizioni: le stesse
 * forme e gli stessi nomi del design system (Titoletto, Tasto, Campo,
 * SceltaCorsi, CaricaFile, Costo), così una pagina si scrive con i pezzi e non
 * ricopiando classi e misure a mano. Le misure stanno in `styles.css`, qui c'è
 * solo quale pezzo e in che stato.
 */

/** L'etichetta spaziata con la riga che divide una pagina, e il conto a destra. */
export function Titoletto({ children, conto, dentro }: { children: ReactNode; conto?: ReactNode; dentro?: boolean }) {
  return (
    <div className={dentro ? 'rule rule-dentro' : 'rule'}>
      <span className="rule-label">{children}</span>
      <div className="rule-line" />
      {conto !== undefined && <span className="num rule-conto">{conto}</span>}
    </div>
  )
}

const VARIANTI = { principale: 'btn-primary', vai: 'btn-go', linea: 'btn-ghost' } as const
type Variante = keyof typeof VARIANTI

/** Le classi di un tasto, per quando il tasto è un `<label>` (vedi `CaricaFile`). */
export const classiTasto = (variante: Variante = 'linea') => `btn ${VARIANTI[variante]} passo-btn`

type PropTasto = {
  variante?: Variante
  children: ReactNode
  /** Un link: si apre in un'altra scheda, tranne `scarica` (lo scarica) e `qui` (un `tel:`, un'ancora). */
  href?: string
  scarica?: boolean
  qui?: boolean
  onClick?: () => void
  type?: 'button' | 'submit'
  disabled?: boolean
}

/** Il tasto: MAIUSCOLO e obliquo; `principale` rosso, `vai` verde, `linea` col bordo. */
export function Tasto({ variante = 'linea', children, href, scarica, qui, onClick, type = 'button', disabled }: PropTasto) {
  if (href) {
    const fuori = qui ? {} : scarica ? { download: true } : { target: '_blank', rel: 'noopener noreferrer' }
    return (
      <a className={classiTasto(variante)} href={href} {...fuori}>
        {children}
      </a>
    )
  }
  return (
    <button type={type} className={classiTasto(variante)} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}

/** Tasti uno accanto all'altro, che vanno a capo. */
export function Tasti({ children }: { children: ReactNode }) {
  return <span className="riga-tasti">{children}</span>
}

/**
 * Una scheda `surface` col bordo `line`. `tono`: `prova` ha il bordo giallo a
 * sinistra (sta prima dei passi e non è uno di loro), `guaio` il bordo rosso.
 */
export function Riquadro({ children, tono, stretto }: { children: ReactNode; tono?: 'prova' | 'guaio'; stretto?: boolean }) {
  return (
    <div className="card stack riquadro" data-tono={tono} data-stretto={stretto || undefined}>
      {children}
    </div>
  )
}

/** L'etichetta in cima a un riquadro: QUOTA ASSOCIATIVA, PRIMA DI ISCRIVERTI. */
export function Etichetta({ children }: { children: ReactNode }) {
  return <span className="rule-label etichetta-riquadro">{children}</span>
}

/**
 * Cosa si fa in una lezione (Karate, Fitness…), accanto all'orario: bordo,
 * MAIUSCOLO, al massimo due righe poi «…», col nome intero nel `title`.
 * Vuota non c'è: né etichetta né spazio. `grande` per il tablet, che si legge da due metri;
 * `intera` dove c'è posto per il nome tutto (la lezione aperta).
 */
export function EtichettaAttivita({ nome, grande, intera }: { nome?: string; grande?: boolean; intera?: boolean }) {
  if (!nome) return null
  return (
    <span className="attivita-et" data-grande={grande || undefined} data-intera={intera || undefined} title={nome}>
      {nome}
    </span>
  )
}

/** Un numero grande: un prezzo, una quota. */
export function Cifra({ children }: { children: ReactNode }) {
  return <span className="num cifra">{children}</span>
}

/** La frase sotto un titolo, in `dim`. `tono` la colora quando dice un guaio o un avviso. */
export function Dettaglio({ children, tono }: { children: ReactNode; tono?: 'testo' | 'guaio' | 'avviso' }) {
  return (
    <span className="passo-dettaglio" data-tono={tono}>
      {children}
    </span>
  )
}

/** Un bollino giallo pieno: DATI DI PROVA. */
export function Bollino({ children }: { children: ReactNode }) {
  return <span className="num sg-bollino">{children}</span>
}

/** Il titolo di un esito, grande e obliquo: verde se è andata, giallo se manca qualcosa. */
export function TitoloEsito({ children, tono }: { children: ReactNode; tono: 'fatto' | 'avviso' }) {
  return (
    <span className="ob esito-titolo" data-tono={tono}>
      {children}
    </span>
  )
}

export interface Nota {
  testo: string
  /** Un errore che ferma l'invio; altrimenti un avviso, da guardare. */
  guaio: boolean
}

/** Cosa non va, sotto un campo: rosso ferma l'invio, giallo è da guardare. */
export function NotaCampo({ id, nota }: { id: string; nota?: Nota }) {
  if (!nota) return null
  return (
    <span id={id} className="modulo-nota" data-avviso={!nota.guaio || undefined}>
      {nota.testo}
    </span>
  )
}

/** Un campo: l'etichetta sopra, il controllo, e sotto la nota. `largo` prende tutta la riga. */
export function Campo({ id, etichetta, children, largo, nota }: { id: string; etichetta: string; children: ReactNode; largo?: boolean; nota?: Nota }) {
  return (
    <div className={largo ? 'modulo-campo modulo-largo' : 'modulo-campo'}>
      <label htmlFor={id} className="modulo-etichetta">
        {etichetta}
      </label>
      {children}
      <NotaCampo id={`${id}-nota`} nota={nota} />
    </div>
  )
}

/**
 * Le scelte del modulo, col pollice: più di una (i corsi, due colonne, la
 * spunta) o una sola (`una`: come paghi, affiancate, il pallino).
 */
export function SceltaCorsi({
  id,
  etichetta,
  voci,
  scelti,
  onScegli,
  una,
  descritto,
}: {
  id: string
  etichetta: string
  /** `riga`: età e orari, sotto il nome. */
  voci: ReadonlyArray<{ id: string; testo: string; riga?: string }>
  scelti: readonly string[]
  onScegli: (id: string) => void
  una?: boolean
  descritto?: string
}) {
  return (
    <div
      id={id}
      tabIndex={-1}
      className={una ? 'modulo-scelte-una' : 'modulo-corsi'}
      role={una ? 'radiogroup' : 'group'}
      aria-label={etichetta}
      aria-describedby={descritto}
    >
      {voci.map((v) => {
        const on = scelti.includes(v.id)
        const stato = una ? { role: 'radio', 'aria-checked': on } : { 'aria-pressed': on }
        return (
          <button key={v.id} type="button" className="modulo-corso" {...stato} onClick={() => onScegli(v.id)}>
            {!una && (
              <span className="modulo-spunta" aria-hidden>
                {on ? '✓' : ''}
              </span>
            )}
            {v.riga ? (
              <span className="stack modulo-corso-testo">
                {v.testo}
                <span className="modulo-corso-riga">{v.riga}</span>
              </span>
            ) : (
              v.testo
            )}
          </button>
        )
      })}
    </div>
  )
}

/** Un file da caricare: da scegliere, caricato (verde) o con un errore sotto. Dal telefono apre la fotocamera o la galleria. */
export function CaricaFile({
  id,
  etichetta,
  dettaglio,
  seManca,
  file,
  errore,
  onFile,
}: {
  id: string
  etichetta: string
  /** Cosa caricare, o cosa sta succedendo («Preparo la foto…») */
  dettaglio: string
  /** Cosa dire accanto all'etichetta quando si può mandare senza («FACOLTATIVO») */
  seManca?: string
  file?: { nome: string; byte: number }
  errore?: string | null
  onFile: (f: File | undefined) => void
}) {
  return (
    <div className="modulo-largo card modulo-file" data-fatto={!!file}>
      <span className="stack grow modulo-file-testo">
        <span className="modulo-etichetta">
          {etichetta}
          {/* Si va a capo solo dopo il «·»: «PUOI PORTARLO DOPO» resta intero. */}
          {seManca && ` · ${seManca.replaceAll(' ', '\u00a0')}`}
        </span>
        {/* Il nome del file sta su una riga; la spiegazione no: a 65 anni serve intera. */}
        <span className={file ? 'passo-dettaglio una-riga' : 'passo-dettaglio'}>{file ? `${file.nome} · ${Math.max(1, Math.round(file.byte / 1024))} KB` : dettaglio}</span>
        {errore && <Dettaglio tono="guaio">{errore}</Dettaglio>}
      </span>
      <label htmlFor={id} className={`${classiTasto()} modulo-scegli`}>
        {file ? 'CAMBIA' : 'SCEGLI'}
      </label>
      <input
        id={id}
        className="vh"
        type="file"
        accept="image/*,application/pdf"
        onChange={(e) => {
          onFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}

export interface PrezziCosto {
  etichetta?: string
  saldo?: number
  annuale?: number
  trimestre?: number
}

const euro = (n?: number) => (n === undefined ? '—' : `${n.toLocaleString('it-IT', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })} €`)

/** `2026-08-31` → «31/8», come sul foglio. */
const giornoMese = (g: string) => {
  const [, m, d] = g.split('-').map(Number)
  return `${d}/${m}`
}

/** Un corso nel listino: età, orari, i prezzi in colonna (il saldo solo se `saldo`), la nota e il link al sito. */
export function Costo({
  corso,
  saldo = true,
  dataSaldo = '2026-08-31',
  frase,
  eta,
  orari,
  prezzi,
  notaTrimestre,
  nota,
  link,
}: {
  corso: string
  saldo?: boolean
  /** Fino a quando vale il saldo: va nella testa della colonna. */
  dataSaldo?: string
  frase?: string
  eta: string
  orari: readonly string[]
  prezzi: readonly PrezziCosto[]
  notaTrimestre?: string
  nota?: string
  link?: string
}) {
  const conEtichette = prezzi.some((p) => p.etichetta)
  return (
    <div className="card stack costo">
      <span className="ob lezione-nome">{corso.toUpperCase()}</span>
      {frase && <span className="costo-frase">{frase}</span>}
      <Dettaglio tono="testo">{eta}</Dettaglio>
      {orari.map((o) => (
        <Dettaglio key={o}>{o}</Dettaglio>
      ))}

      <div className="costo-griglia" data-etichette={conEtichette} data-saldo={saldo}>
        {conEtichette && <span />}
        {saldo && <span className="costo-testa">SALDO {giornoMese(dataSaldo)}</span>}
        <span className="costo-testa">ANNUALE</span>
        <span className="costo-testa">
          TRIMESTRE
          {notaTrimestre && (
            <>
              <br />
              {notaTrimestre.toUpperCase()}
            </>
          )}
        </span>
        {prezzi.map((p, i) => (
          <RigaPrezzi key={i} prezzi={p} conEtichette={conEtichette} saldo={saldo} />
        ))}
      </div>

      {nota && <Dettaglio tono="avviso">{nota}</Dettaglio>}

      {link && (
        <a className="costo-link" href={link} target="_blank" rel="noopener noreferrer">
          SCOPRI IL CORSO
        </a>
      )}
    </div>
  )
}

function RigaPrezzi({ prezzi, conEtichette, saldo }: { prezzi: PrezziCosto; conEtichette: boolean; saldo: boolean }) {
  return (
    <>
      {conEtichette && <span className="costo-testa costo-etichetta">{prezzi.etichetta}</span>}
      {(saldo ? [prezzi.saldo, prezzi.annuale, prezzi.trimestre] : [prezzi.annuale, prezzi.trimestre]).map((n, i) => (
        <span key={i} className="num costo-euro" data-vuoto={n === undefined}>
          {euro(n)}
        </span>
      ))}
    </>
  )
}

/**
 * Un tasto che, quando `chiede` c'è, vuole due tocchi: il primo mostra la
 * domanda, il secondo fa. Senza il secondo, dopo qualche secondo torna
 * com'era. Come TOGLI nelle prove: AZZERA accanto a TUTTI PRESENTI, con le
 * mani sudate, un tocco solo è troppo poco.
 */
export function DueTocchi({
  className,
  chiede,
  disabled,
  etichetta,
  onFai,
  children,
}: {
  className: string
  chiede?: string
  disabled?: boolean
  /** Per un tasto con un'icona: il nome da leggere finché non chiede. */
  etichetta?: string
  onFai: () => void
  children: ReactNode
}) {
  const [sicuro, setSicuro] = useState(false)
  // Il tocco che conferma vale solo se arriva dopo aver letto la domanda: un
  // doppio tocco veloce (le mani sudate, «l'ha preso?») altrimenti la salta.
  const chiestoIl = useRef(0)
  // Lo stesso per un tasto appena comparso al posto di un altro (CHIUDI ✓ al
  // posto di TUTTI PRESENTI): il secondo tocco del doppio tocco non è per lui.
  const natoIl = useRef(Date.now())
  useEffect(() => {
    if (!sicuro) return
    const t = window.setTimeout(() => setSicuro(false), 6000)
    return () => window.clearTimeout(t)
  }, [sicuro])
  // Se intanto non c'è più niente da chiedere, il tasto torna com'era: se no
  // restava vuoto, e il tocco dopo faceva senza domanda.
  useEffect(() => {
    if (!chiede) setSicuro(false)
  }, [chiede])
  return (
    <button
      type="button"
      className={className}
      data-sicuro={sicuro}
      disabled={disabled}
      aria-label={sicuro && chiede ? undefined : etichetta}
      onClick={() => {
        if (chiede && !sicuro) {
          chiestoIl.current = Date.now()
          return setSicuro(true)
        }
        if (Date.now() - natoIl.current < 500) return
        if (chiede && Date.now() - chiestoIl.current < 500) return
        setSicuro(false)
        onFai()
      }}
    >
      {sicuro && chiede ? <span className="due-tocchi-chiede">{chiede}</span> : children}
    </button>
  )
}

/**
 * Dove si è nel modulo a passi: un segmento per passo (fatti verdi, quello di
 * adesso in tinta testo, gli altri `line`), il numero grande e «DI N» col nome
 * del passo. Fonte: docs/design-canvas/ods-design-system/Avanzamento.dc.html.
 */
export function Avanzamento({ numero, totale, titolo }: { numero: number; totale: number; titolo: string }) {
  return (
    <div className="avanza" role="group" aria-label={`Passo ${numero} di ${totale}: ${titolo}`}>
      <div className="avanza-segmenti" aria-hidden>
        {Array.from({ length: totale }, (_, i) => (
          <div key={i} className="avanza-segmento" data-stato={i + 1 < numero ? 'fatto' : i + 1 === numero ? 'adesso' : undefined} />
        ))}
      </div>
      <div className="avanza-testa" aria-hidden>
        <span className="num ob avanza-numero">{numero}</span>
        <span className="avanza-nome">
          <span>DI {totale}</span>
          <span>{titolo}</span>
        </span>
      </div>
    </div>
  )
}

/**
 * Il fondo di ogni passo: cosa manca in una riga sola (quanti, il tasto VAI A la
 * prima voce, ▾ che apre l'elenco; ogni voce è un tasto che porta al campo) o la
 * nota verde, poi INDIETRO e AVANTI (`vai` verde, per l'ultimo, che manda).
 * INDIETRO è un DueTocchi: se `chiede` c'è, prende tutta la riga. Senza
 * `onIndietro` non c'è. `aperta` è lo stato iniziale dell'elenco.
 * Fonte: docs/design-canvas/ods-design-system/BarraPasso.dc.html.
 */
export function BarraPasso({
  manca = [],
  nota,
  avanti = 'AVANTI',
  tono = 'principale',
  occupato,
  chiede,
  aperta = false,
  totale,
  onVai,
  onAvanti,
  onIndietro,
}: {
  manca?: ReadonlyArray<{ nome: string; chiave: string }>
  nota?: string
  avanti?: string
  tono?: 'principale' | 'vai'
  occupato?: boolean
  chiede?: string
  aperta?: boolean
  /** Il totale della richiesta, sempre in vista nei passi del corso e dei documenti. */
  totale?: { righe: string; totale: string }
  onVai: (chiave: string) => void
  onAvanti: () => void
  onIndietro?: () => void
}) {
  const [elenco, setElenco] = useState(aperta)
  const prima = manca[0]
  return (
    <div className="barra-passo">
      {totale && (
        <div className="barra-totale">
          <span className="barra-totale-righe">{totale.righe}</span>
          <span className="barra-totale-cifra">{totale.totale}</span>
        </div>
      )}
      {prima && (
        <div className="barra-manca" role="alert">
          <div className="barra-manca-riga">
            <span className="barra-manca-titolo">{manca.length === 1 ? 'MANCA 1' : `MANCANO ${manca.length}`}</span>
            <button type="button" className="barra-manca-vai" aria-label={`Vai a: ${prima.nome}`} onClick={() => onVai(prima.chiave)}>
              <span className="barra-manca-nome">VAI A: {prima.nome}</span>
              <span aria-hidden>›</span>
            </button>
            {manca.length > 1 && (
              <button
                type="button"
                className="barra-manca-apri"
                aria-expanded={elenco}
                aria-label={elenco ? 'Chiudi l’elenco di quel che manca' : 'Apri l’elenco di quel che manca'}
                onClick={() => setElenco(!elenco)}
              >
                <span aria-hidden>{elenco ? '▴' : '▾'}</span>
              </button>
            )}
          </div>
          {elenco && manca.length > 1 && (
            <div className="barra-manca-elenco">
              {manca.map((m) => (
                <button
                  key={m.chiave}
                  type="button"
                  className="barra-manca-voce"
                  aria-label={`Vai a: ${m.nome}`}
                  onClick={() => {
                    setElenco(false)
                    onVai(m.chiave)
                  }}
                >
                  <span>{m.nome}</span>
                  <span aria-hidden>›</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {!prima && nota && (
        <div className="barra-nota">
          <span className="barra-nota-segno" aria-hidden>
            ✓
          </span>
          <span>{nota}</span>
        </div>
      )}
      <div className="barra-tasti">
        {onIndietro && (
          <DueTocchi className="btn btn-ghost barra-indietro" disabled={occupato} chiede={chiede} onFai={onIndietro}>
            INDIETRO
          </DueTocchi>
        )}
        <button type="button" className={`btn ${VARIANTI[tono]} barra-avanti`} disabled={occupato} onClick={onAvanti}>
          {avanti}
        </button>
      </div>
    </div>
  )
}

export interface RigaRiepilogo {
  /** `fatto` ✓ verde, `manca` – giallo (una cosa facoltativa non data; il trattino pesa più d'un punto, che si perdeva), `guaio` ! rosso; `numero` mostra la posizione (E ADESSO). */
  stato: 'fatto' | 'manca' | 'guaio' | 'numero'
  titolo: string
  dettaglio?: string
  /** MODIFICA, CARICA: da 44px. */
  tasto?: { testo: string; onFai: () => void }
}

/**
 * Il riepilogo prima di mandare: una riga per cosa, col tasto per cambiarla.
 * Fonte: docs/design-canvas/ods-design-system/Riepilogo.dc.html.
 */
export function Riepilogo({ righe }: { righe: readonly RigaRiepilogo[] }) {
  return (
    <ul className="card riepilogo">
      {righe.map((r, i) => (
        <li key={i} className="riepilogo-riga">
          <span className="num riepilogo-segno" data-stato={r.stato} aria-hidden>
            {r.stato === 'numero' ? i + 1 : r.stato === 'fatto' ? '✓' : r.stato === 'guaio' ? '!' : '–'}
          </span>
          <span className="riepilogo-testo">
            <span className="riepilogo-titolo">{r.titolo}</span>
            {r.dettaglio && <span className="riepilogo-dettaglio">{r.dettaglio}</span>}
          </span>
          {r.tasto && (
            <button type="button" className="riepilogo-tasto" onClick={r.tasto.onFai}>
              {r.tasto.testo}
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}
