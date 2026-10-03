import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { DatiSegreteria, LezioneSeg } from '../../lib/segreteria'
import type { DettaglioSessione, StatoPresenza, StatoSessione } from '../../lib/sala'
import { chiaveGiorno, giornoPerEsteso, lunedi, oraDi, perEsteso } from '../../lib/sala'
import { dati, type Dati } from '../../lib/dati'
import { Back } from '../Icons'
import { useSchermo } from '../../lib/largo'
import type { ChiProva } from '../../lib/prove'
import { MarchioProva, PannelloProve, TogliProva } from '../Prove'
import { settimanaDi, type Posto } from '../../lib/indirizzoSegreteria'
import { chiedi, Campo, dataLunga, Guaio, messaggio, Riga, Testa, useAvviso, useCarica, useDialogo } from './comune'

const CORTI = ['DOM', 'LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB']
const MESI_CORTI = ['GEN', 'FEB', 'MAR', 'APR', 'MAG', 'GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV', 'DIC']

const piu = (d: Date, giorni: number) => {
  const x = new Date(d)
  x.setDate(x.getDate() + giorni)
  return x
}

/** «21 – 27 SETTEMBRE», o «28 SET – 4 OTTOBRE» quando cambia il mese. */
function titolo(primo: Date) {
  const ultimo = piu(primo, 6)
  const mese = (d: Date) => giornoPerEsteso(chiaveGiorno(d)).split(' ').at(-1)!.toUpperCase()
  return primo.getMonth() === ultimo.getMonth()
    ? `${primo.getDate()} – ${ultimo.getDate()} ${mese(ultimo)}`
    : `${primo.getDate()} ${MESI_CORTI[primo.getMonth()]} – ${ultimo.getDate()} ${mese(ultimo)}`
}

/**
 * La settimana: sette colonne, una riga per orario, e in ogni casella le
 * lezioni che cominciano lì. È la vista da cui la segreteria vede in un colpo
 * solo cosa c'è, dove, e quali appelli mancano.
 */
export function Settimana({
  d,
  posto,
  onPosto,
}: {
  d: DatiSegreteria
  /** Settimana, sala e lezione aperta stanno nell'indirizzo: le tiene la segreteria. */
  posto: Posto
  onPosto: (p: Omit<Posto, 'voce'>, passo: 'push' | 'replace') => void
}) {
  const { lezione: aperta, sala = '' } = posto
  // Una chiave e non la data: la stessa settimana a ogni giro non rilegge la griglia.
  const chiave = chiaveGiorno(settimanaDi(posto, new Date()))
  const primo = useMemo(() => new Date(`${chiave}T00:00`), [chiave])
  const vai = (cambi: Omit<Posto, 'voce'>, passo: 'push' | 'replace') =>
    onPosto({ settimana: chiaveGiorno(primo), sala: sala || undefined, lezione: aperta, ...cambi }, passo)
  // Sfogliare e cambiare sala non sono passi: Indietro torna alla voce di prima, non sei settimane fa.
  const sfoglia = (x: Date) => vai({ settimana: chiaveGiorno(x) }, 'replace')
  const scegliSala = (id: string) => vai({ sala: id || undefined }, 'replace')
  const [nuova, setNuova] = useState(false)
  const { avviso, avvisa, fai } = useAvviso()

  const giorni = useMemo(() => Array.from({ length: 7 }, (_, i) => piu(primo, i)), [primo])
  const sett = useCarica(() => d.settimana(giorni[0], giorni[6]), [d, giorni])
  const sale = useCarica(() => d.sale(), [d])
  const pronto = useCarica(() => d.prontoFino(), [d])

  // Una lezione che non c'è più (un link vecchio, una straordinaria tolta):
  // si resta sulla sua settimana e lo si dice. Solo quando la settimana
  // arriva: col cambio di settimana, per un giro, c'è ancora quella di prima.
  useEffect(() => {
    if (!aperta || !sett.dato || sett.dato.some((l) => l.id === aperta.id)) return
    avvisa('Quella lezione non c’è più')
    vai({ lezione: undefined }, 'replace')
    // Solo all'arrivo della settimana: aprire una lezione non è un motivo per guardare.
  }, [sett.dato])

  // Una sala che non c'è più (rinominata o tolta, in un link vecchio): la
  // griglia la filtrerebbe vuota. Si tolgono sala e filtro e lo si dice.
  useEffect(() => {
    if (!sala || !sale.dato || sale.dato.some((s) => s.id === sala)) return
    avvisa('Quella sala non c’è più')
    vai({ sala: undefined }, 'replace')
    // Solo all'arrivo delle sale, come per la lezione.
  }, [sale.dato])

  // Le presenze segnate dal cassetto viaggiano nella coda dell'appello: la
  // griglia si rilegge quando la coda si svuota, cioè quando sono arrivate.
  const rileggi = sett.ricarica
  useEffect(() => {
    let vivo = true
    let via: (() => void) | undefined
    void dati().then((x) => {
      if (!vivo) return
      let prima = 0
      via = x.guardaCoda?.((n) => {
        if (prima > 0 && n === 0) void rileggi()
        prima = n
      })
    })
    return () => {
      vivo = false
      via?.()
    }
  }, [rileggi])

  const lezioni = (sett.dato ?? []).filter((l) => !sala || l.salaId === sala)
  const ore = [...new Set(lezioni.map((l) => oraDi(l.inizio)))].sort()
  const oggi = chiaveGiorno(new Date())
  const adesso = Date.now()
  const lezione = sett.dato?.find((l) => l.id === aperta?.id) ?? null

  // Sul telefono sette colonne non ci stanno: un giorno per volta, scelto
  // dalla striscia dei giorni; da sé oggi, se è in questa settimana.
  const telefono = useSchermo('(max-width: 767px)')
  const [giornoTel, setGiornoTel] = useState<string | null>(null)
  const chiavi = giorni.map(chiaveGiorno)
  const delGiorno = giornoTel && chiavi.includes(giornoTel) ? giornoTel : chiavi.includes(oggi) ? oggi : chiavi[0]
  const lezioniDelGiorno = lezioni.filter((l) => chiaveGiorno(new Date(l.inizio)) === delGiorno)
  const oreDelGiorno = [...new Set(lezioniDelGiorno.map((l) => oraDi(l.inizio)))].sort()

  return (
    <>
      <Testa
        titolo="SETTIMANA"
        sotto={`Le lezioni dell’orario dei corsi: aprine una per l’appello, il sostituto o per annullarla.${pronto.dato ? ` Calendario pronto fino al ${dataLunga(pronto.dato)}: si allunga da sé, e subito da IMPOSTAZIONI → IL CALENDARIO.` : ''}`}
      >
        <button type="button" className="sg-btn sg-btn-linea" onClick={() => setNuova(true)}>
          + LEZIONE STRAORDINARIA
        </button>
      </Testa>

      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="icon-btn" aria-label="Settimana prima" onClick={() => sfoglia(piu(primo, -7))}>
          <Back />
        </button>
        <span className="ob sg-sett-titolo">{titolo(primo)}</span>
        <button type="button" className="icon-btn" aria-label="Settimana dopo" onClick={() => sfoglia(piu(primo, 7))}>
          <span style={{ transform: 'scaleX(-1)', display: 'flex' }}>
            <Back />
          </span>
        </button>
        <button type="button" className="sg-chip" onClick={() => sfoglia(lunedi(new Date()))}>
          OGGI
        </button>
        <div className="grow" />
        {[{ id: '', nome: 'TUTTE' }, ...(sale.dato ?? [])].map((s) => (
          <button key={s.id} type="button" className="num sg-chip" aria-pressed={sala === s.id} onClick={() => scegliSala(s.id)}>
            {s.nome.toUpperCase()}
          </button>
        ))}
      </div>

      {sett.guaio && <Guaio testo={sett.guaio} />}

      {telefono ? (
        <>
          <div className="sg-giorni-tel" role="group" aria-label="Giorno">
            {giorni.map((g) => {
              const k = chiaveGiorno(g)
              return (
                <button key={k} type="button" className="sg-giorno-tel" aria-pressed={k === delGiorno} data-oggi={k === oggi} onClick={() => setGiornoTel(k)}>
                  <span className="num" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em' }}>{CORTI[g.getDay()]}</span>
                  <span className="num" style={{ fontSize: 20, fontWeight: 700 }}>{g.getDate()}</span>
                </button>
              )
            })}
          </div>
          {sett.dato === null && !sett.guaio && <p className="sg-sotto">Sto leggendo la settimana…</p>}
          {sett.dato !== null && oreDelGiorno.length === 0 && (
            <p className="sg-sotto">Nessuna lezione {sala ? 'in questa sala ' : ''}in questo giorno.</p>
          )}
          <div className="sg-giorno-lista">
            {oreDelGiorno.map((ora) => (
              <Fila key={ora} ora={ora}>
                <div className="sg-casella">
                  {lezioniDelGiorno
                    .filter((l) => oraDi(l.inizio) === ora)
                    .map((l) => (
                      <Tessera key={l.id} l={l} passata={Date.parse(l.fine) < adesso} onApri={() => vai({ lezione: { id: l.id, inizio: l.inizio } }, 'push')} />
                    ))}
                </div>
              </Fila>
            ))}
          </div>
        </>
      ) : (
        <div className="sg-griglia-scorre">
          <div className="sg-griglia">
            <span />
            {giorni.map((g) => {
              const k = chiaveGiorno(g)
              return (
                <div key={k} className="sg-giorno" data-oggi={k === oggi}>
                  <span className="num" style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.14em' }}>{CORTI[g.getDay()]}</span>
                  <span className="num" style={{ fontSize: 20, fontWeight: 700 }}>{g.getDate()}</span>
                </div>
              )
            })}

            {sett.dato === null && !sett.guaio && <p className="sg-sotto" style={{ gridColumn: '2 / -1' }}>Sto leggendo la settimana…</p>}
            {sett.dato !== null && ore.length === 0 && (
              <p className="sg-sotto" style={{ gridColumn: '2 / -1' }}>
                Nessuna lezione {sala ? 'in questa sala, ' : ''}in questa settimana.
              </p>
            )}

            {ore.map((ora) => (
              <Fila key={ora} ora={ora}>
                {giorni.map((g) => {
                  const k = chiaveGiorno(g)
                  const qui = lezioni.filter((l) => chiaveGiorno(new Date(l.inizio)) === k && oraDi(l.inizio) === ora)
                  return (
                    <div key={k} className="sg-casella" data-vuota={qui.length === 0}>
                      {qui.map((l) => (
                        <Tessera key={l.id} l={l} passata={Date.parse(l.fine) < adesso} onApri={() => vai({ lezione: { id: l.id, inizio: l.inizio } }, 'push')} />
                      ))}
                    </div>
                  )
                })}
              </Fila>
            ))}
          </div>
        </div>
      )}

      <div className="row sg-legenda">
        <span className="row" style={{ gap: 6 }}>
          <span className="num" style={{ fontWeight: 700, color: 'var(--verde)' }}>8/9</span>presenti su iscritti, appello fatto
        </span>
        <span className="row" style={{ gap: 6 }}>
          <span className="num" style={{ fontWeight: 700, color: 'var(--sec)' }}>14/16</span>iscritti su posti
        </span>
        <span className="row" style={{ gap: 6 }}>
          <span className="num sg-tag" data-tipo="manca">SENZA APPELLO</span>passata, nessuno ha segnato
        </span>
        <span className="row" style={{ gap: 6 }}>
          <span className="num sg-tag" data-tipo="sostituto">SOSTITUTO</span>un altro istruttore, solo per quel giorno
        </span>
        <span className="row" style={{ gap: 6 }}>
          <span className="sg-forse">istruttore?</span>il corso non ne ha uno: si assegna in CORSI
        </span>
      </div>

      {lezione && (
        <Lezione
          d={d}
          l={lezione}
          sale={sale.dato ?? []}
          onCambiato={() => void sett.ricarica()}
          onChiudi={() => vai({ lezione: undefined }, 'push')}
          fai={fai}
        />
      )}
      {nuova && (
        <Straordinaria
          d={d}
          giorno={chiaveGiorno(giorni.some((g) => chiaveGiorno(g) === oggi) ? new Date() : giorni[0])}
          onChiudi={() => setNuova(false)}
          fai={fai}
          onFatto={(inizio) => {
            setNuova(false)
            sfoglia(lunedi(inizio))
            void sett.ricarica()
          }}
        />
      )}
      {avviso}
    </>
  )
}

function Fila({ ora, children }: { ora: string; children: React.ReactNode }) {
  return (
    <>
      <span className="num sg-ora">{ora}</span>
      {children}
    </>
  )
}

function Tessera({ l, passata, onApri }: { l: LezioneSeg; passata: boolean; onApri: () => void }) {
  const annullata = l.stato === 'annullata'
  const fatto = l.segnati > 0
  const manca = passata && !annullata && !fatto
  // Passata e con l'appello fatto non chiede più niente: si fa da parte, e
  // nella settimana resta in vista solo quello che manca.
  const chiusa = passata && !annullata && fatto
  return (
    <button
      type="button"
      className="sg-lezione"
      data-annullata={annullata}
      data-manca={manca}
      data-chiusa={chiusa}
      style={{ ['--tinta' as string]: l.colore ?? 'var(--blu)' }}
      onClick={onApri}
    >
      <span className="ob sg-lezione-nome">{l.corso.toUpperCase()}</span>
      <span className="sg-lezione-dove">
        {[l.sala ?? <span key="s" className="sg-forse">sala?</span>, l.istruttori || <span key="i" className="sg-forse">istruttore?</span>].map((x, i) => (
          <span key={i}>
            {i > 0 && ' · '}
            {x}
          </span>
        ))}
      </span>
      <span className="row" style={{ gap: 6, marginTop: 'auto', flexWrap: 'wrap' }}>
        <span className="num" style={{ fontSize: 14, fontWeight: 700, color: fatto ? 'var(--verde)' : 'var(--sec)' }}>
          {fatto ? `${l.presenti}/${l.iscritti}` : l.capienza ? `${l.iscritti}/${l.capienza}` : l.iscritti}
        </span>
        {annullata && <span className="num sg-tag">ANNULLATA</span>}
        {manca && (
          <span className="num sg-tag" data-tipo="manca">
            SENZA APPELLO
          </span>
        )}
        {l.sostitutoId && (
          <span className="num sg-tag" data-tipo="sostituto">
            SOSTITUTO
          </span>
        )}
        {l.straordinaria && <span className="num sg-tag">STRAORDINARIA</span>}
      </span>
    </button>
  )
}

type Fai = ReturnType<typeof useAvviso>['fai']

const STATI: Array<[StatoSessione, string]> = [
  ['prevista', 'PREVISTA'],
  ['svolta', 'SVOLTA'],
  ['annullata', 'ANNULLATA'],
]

/** Una lezione aperta: stato, sostituto, sala, appello. Ogni cambio si salva subito. */
function Lezione({
  d,
  l,
  sale,
  onCambiato,
  onChiudi,
  fai,
}: {
  d: DatiSegreteria
  l: LezioneSeg
  sale: Array<{ id: string; nome: string }>
  onCambiato: () => void
  onChiudi: () => void
  fai: Fai
}) {
  const istruttori = useCarica(() => d.istruttori(), [d])
  const cassetto = useDialogo<HTMLElement>(onChiudi)

  const cambia = (cambi: Parameters<DatiSegreteria['aggiornaLezione']>[1], detto: string) =>
    void fai(() => d.aggiornaLezione(l.id, cambi), detto, onCambiato)

  return (
    <>
      <button type="button" className="sg-velo" aria-label="Chiudi la lezione" onClick={onChiudi} />
      <section ref={cassetto} role="dialog" aria-modal="true" tabIndex={-1} aria-label={l.corso} className="sg-cassetto" style={{ ['--tinta' as string]: l.colore ?? 'var(--blu)' }}>
        <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
          <div className="stack grow" style={{ gap: 4 }}>
            <span className="ob" style={{ fontSize: 28, fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1 }}>{l.corso.toUpperCase()}</span>
            <span className="num" style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.14em', color: 'var(--dim)' }}>
              {giornoPerEsteso(chiaveGiorno(new Date(l.inizio))).toUpperCase()} · {oraDi(l.inizio)}–{oraDi(l.fine)}
            </span>
          </div>
          <button type="button" className="icon-btn" aria-label="Chiudi" onClick={onChiudi}>
            ✕
          </button>
        </div>

        <Campo etichetta="STATO">
          <div role="radiogroup" aria-label="Stato della lezione" className="sg-tre">
            {STATI.map(([s, testo]) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={l.stato === s}
                className="sg-btn sg-scelta"
                onClick={async () => {
                  if (l.stato === s) return
                  // Annullarla tocca chi deve venire, che dall'app non viene avvisato: lo si dice prima, non dopo.
                  if (
                    s === 'annullata' &&
                    !(await chiedi(
                      `Annullare ${l.corso} di ${giornoPerEsteso(chiaveGiorno(new Date(l.inizio))).toLowerCase()} alle ${oraDi(l.inizio)}? Calendario e tablet la mostrano annullata, ma gli iscritti non vengono avvisati: vanno chiamati o scritti. Si rimette con PREVISTA.`,
                      'ANNULLA LA LEZIONE',
                    ))
                  )
                    return
                  cambia({ stato: s }, s === 'annullata' ? 'Lezione annullata: ricordati di avvisare gli iscritti.' : s === 'svolta' ? 'Lezione segnata come svolta' : 'Lezione di nuovo prevista')
                }}
              >
                {testo}
              </button>
            ))}
          </div>
        </Campo>

        <div className="sg-due">
          <Campo id="z-istr" etichetta="ISTRUTTORE">
            <select
              id="z-istr"
              className="sg-campo"
              data-acceso={!!l.sostitutoId}
              value={l.sostitutoId ?? ''}
              onChange={(e) => {
                const scelto = istruttori.dato?.find((i) => i.id === e.target.value)
                // Chi insegna già il corso non è un sostituto: la lezione torna come da corso.
                const suo = !!scelto && l.istruttori.split(', ').includes(scelto.nome) && !l.sostitutoId
                // E si salva così: un secondo istruttore del corso messo come
                // sostituto comparirebbe da solo, col segno di sostituzione.
                cambia({ sostitutoId: e.target.value && !suo ? e.target.value : null }, e.target.value && !suo ? `Sostituto: ${scelto?.nome}` : 'Come da corso')
              }}
            >
              <option value="">Come da corso{!l.sostitutoId && l.istruttori ? ` (${l.istruttori})` : ''}</option>
              {(istruttori.dato ?? []).map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo id="z-sala" etichetta="SALA">
            <select id="z-sala" className="sg-campo" value={l.salaId ?? ''} onChange={(e) => cambia({ salaId: e.target.value || null }, 'Sala cambiata')}>
              {!l.salaId && <option value="">Nessuna sala</option>}
              {sale.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        {l.sostitutoId && <span style={{ fontSize: 13, color: 'var(--giallo-testo)' }}>Sostituzione solo per questa lezione: il corso resta com'è.</span>}

        <Appello key={l.id} l={l} onCambiato={onCambiato} />

        <div className="grow" />
        {l.straordinaria && (
          <button
            type="button"
            className="sg-btn sg-btn-linea"
            style={{ borderColor: 'var(--rosso)' }}
            onClick={() =>
              void fai(() => d.togliLezione(l.id), 'Lezione tolta', () => {
                onChiudi()
                onCambiato()
              })
            }
          >
            TOGLI QUESTA LEZIONE STRAORDINARIA
          </button>
        )}
        <button type="button" className="sg-btn sg-btn-pieno" onClick={onChiudi}>
          FATTO
        </button>
      </section>
    </>
  )
}

// presente → assente → non segnato, e si ricomincia: come nell'appello.
const prossimo = (s: StatoPresenza | null): StatoPresenza | null => (s === null ? 'presente' : s === 'presente' ? 'assente' : null)

/**
 * L'appello dalla segreteria: lo stesso dell'app, un tocco per riga, per
 * segnare al banco le presenze che l'istruttore ha preso su carta o
 * correggere un tocco sbagliato. Scrive con gli stessi `dati` dell'appello,
 * quindi anche da qui senza rete non si perde niente.
 *
 * Si apre quando la lezione è cominciata: prima non c'è niente da segnare,
 * e una presenza messa in anticipo sporcherebbe le medie. Da lì c'è anche il
 * tasto PROVE, per chi è venuto a provare (vedi `Prove.tsx`).
 */
function Appello({ l, onCambiato }: { l: LezioneSeg; onCambiato: () => void }) {
  const [strato, setStrato] = useState<Dati | null>(null)
  const [elenco, setElenco] = useState<DettaglioSessione['elenco'] | null>(null)
  const [guaio, setGuaio] = useState<string | null>(null)
  const [conProve, setConProve] = useState(false)
  const cominciata = Date.parse(l.inizio) <= Date.now()
  const annullata = l.stato === 'annullata'
  const aperto = cominciata && !annullata

  useEffect(() => {
    let vivo = true
    dati()
      .then(async (x) => {
        const det = await x.dettaglio(l.id)
        if (!vivo) return
        setStrato(x)
        setElenco(det?.elenco ?? [])
      })
      .catch((e: unknown) => vivo && setGuaio(messaggio(e, 'Non riesco a leggere l\'appello')))
    return () => {
      vivo = false
    }
  }, [l.id])

  const segnati = elenco?.filter((p) => p.stato !== null).length ?? l.segnati
  const presenti = elenco?.filter((p) => p.stato === 'presente').length ?? l.presenti
  const quanti = elenco?.length ?? l.iscritti
  const manca = cominciata && !annullata && segnati === 0

  // In prova la scrittura è già fatta quando torna; col database va in coda,
  // e la griglia si rilegge quando la coda si svuota (vedi `Settimana`).
  const scritto = (p: Promise<void>) => void p.then(() => strato?.modo === 'prova' && onCambiato())

  const tocca = (personaId: string, stato: StatoPresenza | null) => {
    if (!strato) return
    setElenco((v) => v && v.map((p) => (p.id === personaId ? { ...p, stato } : p)))
    scritto(strato.segna(l.id, personaId, stato))
  }
  const tutti = () => {
    if (!strato) return
    setElenco((v) => v && v.map((p) => ({ ...p, stato: 'presente' })))
    scritto(strato.segnaTutti(l.id, 'presente'))
  }
  const aggiungiProva = async (chi: ChiProva) => {
    if (!strato) return
    const p = await strato.aggiungiProva(l.id, chi)
    setElenco((v) => v && (v.some((x) => x.id === p.id) ? v : [...v, { ...p, stato: 'presente', prova: true }]))
    if (strato.modo === 'prova') onCambiato()
  }
  const togliProva = (personaId: string) => {
    if (!strato) return
    setElenco((v) => v && v.filter((p) => p.id !== personaId))
    scritto(strato.togliProva(l.id, personaId))
  }
  const iscritti = elenco?.filter((p) => !p.prova)
  const prove = elenco?.filter((p) => p.prova) ?? []

  const azzera = async () => {
    if (!strato || !elenco) return
    if (segnati && !(await chiedi(`Togliere i ${segnati} segni di questa lezione?`, 'TOGLI I SEGNI', { pericolo: true }))) return
    setElenco(elenco.map((p) => ({ ...p, stato: null })))
    scritto(Promise.all(elenco.filter((p) => p.stato !== null).map((p) => strato.segna(l.id, p.id, null))).then(() => undefined))
  }

  return (
    <>
      <div className="sg-appello" data-manca={manca}>
        <div className="row" style={{ gap: 10, alignItems: 'baseline' }}>
          <span className="sg-etichetta grow">APPELLO</span>
          <span
            className="num"
            style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', color: segnati ? 'var(--verde)' : manca ? 'var(--rosso)' : 'var(--dim)' }}
          >
            {annullata ? 'ANNULLATA' : !cominciata ? 'NON ANCORA' : segnati === quanti && quanti ? 'FATTO' : segnati ? `${quanti - segnati} DA SEGNARE` : 'NON FATTO'}
          </span>
        </div>
        <span className="num" style={{ fontSize: 40, fontWeight: 700, lineHeight: 1 }}>
          {presenti}/{quanti}
        </span>
        {manca && <span style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--dim)' }}>Nessuno l'ha fatto. Segnalo da qui, un nome alla volta o tutti insieme.</span>}
        {!cominciata && !annullata && <span style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--dim)' }}>Si segna quando la lezione è cominciata.</span>}
        {aperto && elenco && elenco.length > 0 && (
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="sg-btn sg-btn-verde grow" onClick={tutti}>
              TUTTI PRESENTI
            </button>
            <button type="button" className="sg-btn sg-btn-linea" onClick={azzera} disabled={!segnati}>
              AZZERA
            </button>
          </div>
        )}
        {aperto && elenco && (
          <button type="button" className="sg-btn sg-btn-tratteggio" aria-expanded={conProve} disabled={!strato} onClick={() => setConProve((x) => !x)}>
            PROVE
          </button>
        )}
      </div>

      {conProve && strato && elenco && (
        <PannelloProve
          stile="sg"
          cerca={() => strato.provati()}
          giaQui={new Set(elenco.map((p) => p.id))}
          onAggiungi={aggiungiProva}
          onChiudi={() => setConProve(false)}
        />
      )}

      <div className="stack" style={{ gap: 8 }}>
        <Riga titolo="ISCRITTI">
          <span className="num" style={{ fontSize: 14, fontWeight: 700 }}>
            {l.capienza ? `${iscritti?.length ?? quanti}/${l.capienza}` : (iscritti?.length ?? quanti)}
          </span>
        </Riga>
        {guaio && <Guaio testo={guaio} />}
        {!elenco && !guaio && <span className="sg-sotto">Sto leggendo l'appello…</span>}
        {iscritti && iscritti.length === 0 && <span className="sg-sotto">Nessun iscritto.</span>}
        {iscritti && iscritti.length > 0 && (
          <div className="sg-elenco-appello">
            {iscritti.map((p) => (
              <button
                key={p.id}
                type="button"
                className="riga-appello"
                data-stato={p.stato ?? 'niente'}
                disabled={!aperto}
                onClick={() => tocca(p.id, prossimo(p.stato))}
                aria-label={`${perEsteso(p)}: ${p.stato ?? 'non segnato'}`}
              >
                <span className="segno" aria-hidden="true">
                  {p.stato === 'presente' ? '✓' : p.stato === 'assente' ? '✕' : ''}
                </span>
                <span className="nome-appello grow">{perEsteso(p)}</span>
              </button>
            ))}
          </div>
        )}
        {prove.length > 0 && (
          <>
            <Riga titolo="PROVE">
              <span className="num" style={{ fontSize: 14, fontWeight: 700 }}>
                {prove.length}
              </span>
            </Riga>
            <div className="sg-elenco-appello">
              {prove.map((p) => (
                <div key={p.id} className="riga-prova">
                  <button
                    type="button"
                    className="riga-appello"
                    data-stato={p.stato ?? 'niente'}
                    disabled={!aperto}
                    onClick={() => tocca(p.id, prossimo(p.stato))}
                    aria-label={`${perEsteso(p)}, in prova: ${p.stato ?? 'non segnato'}`}
                  >
                    <span className="segno" aria-hidden="true">
                      {p.stato === 'presente' ? '✓' : p.stato === 'assente' ? '✕' : ''}
                    </span>
                    <span className="nome-appello grow">{perEsteso(p)}</span>
                    <MarchioProva />
                  </button>
                  {aperto && <TogliProva chi={perEsteso(p)} onTogli={() => togliProva(p.id)} />}
                </div>
              ))}
            </div>
          </>
        )}
        {aperto && elenco && elenco.length > 0 && (
          <span style={{ fontSize: 12, color: 'var(--faint)' }}>Un clic: presente, due: assente, tre: non segnato.</span>
        )}
      </div>
    </>
  )
}

/** Una lezione in più: un recupero, un evento, una prova aperta. */
function Straordinaria({
  d,
  giorno,
  onChiudi,
  onFatto,
  fai,
}: {
  d: DatiSegreteria
  giorno: string
  onChiudi: () => void
  onFatto: (inizio: Date) => void
  fai: Fai
}) {
  const corsi = useCarica(() => d.corsi(), [d])
  const attivi = (corsi.dato ?? []).filter((c) => c.attivo)
  const [corso, setCorso] = useState('')
  const [data, setData] = useState(giorno)
  const [ora, setOra] = useState('17:00')
  const [durata, setDurata] = useState(60)
  const scelto = corso || attivi[0]?.id || ''
  const dialogo = useDialogo<HTMLFormElement>(onChiudi)

  const aggiungi = async (e: FormEvent) => {
    e.preventDefault()
    const [a, m, g] = data.split('-').map(Number)
    const [h, min] = ora.split(':').map(Number)
    const inizio = new Date(a, m - 1, g, h, min)
    await fai(() => d.straordinaria(scelto, inizio, durata), 'Lezione aggiunta', () => onFatto(inizio))
  }

  return (
    <>
      <button type="button" className="sg-velo" aria-label="Chiudi" onClick={onChiudi} />
      <form ref={dialogo} role="dialog" aria-modal="true" tabIndex={-1} aria-label="Lezione straordinaria" className="sg-dialogo" onSubmit={(e) => void aggiungi(e)}>
        <span className="ob" style={{ fontSize: 26, fontWeight: 700, letterSpacing: '0.04em' }}>LEZIONE STRAORDINARIA</span>
        <span className="sg-sotto" style={{ lineHeight: 1.5 }}>
          Una lezione in più, fuori dalle ricorrenze: un recupero, un evento, una prova aperta. Gli iscritti del corso sono già nell'appello.
        </span>
        <Campo id="s-corso" etichetta="CORSO">
          <select id="s-corso" className="sg-campo" value={scelto} onChange={(e) => setCorso(e.target.value)} required>
            {attivi.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </Campo>
        <div className="sg-tre">
          <Campo id="s-giorno" etichetta="GIORNO">
            <input id="s-giorno" className="sg-campo" type="date" value={data} onChange={(e) => setData(e.target.value)} required />
          </Campo>
          <Campo id="s-ora" etichetta="ORA">
            <input id="s-ora" className="sg-campo" type="time" value={ora} onChange={(e) => setOra(e.target.value)} required />
          </Campo>
          <Campo id="s-durata" etichetta="MINUTI">
            <input
              id="s-durata"
              className="sg-campo"
              type="number"
              min={5}
              max={480}
              value={durata}
              onChange={(e) => setDurata(Number(e.target.value))}
              required
            />
          </Campo>
        </div>
        <div className="row" style={{ gap: 10, paddingTop: 6 }}>
          <button type="button" className="sg-btn sg-btn-linea grow" onClick={onChiudi}>
            LASCIA STARE
          </button>
          <button type="submit" className="sg-btn sg-btn-pieno grow" disabled={!scelto}>
            AGGIUNGI
          </button>
        </div>
      </form>
    </>
  )
}
