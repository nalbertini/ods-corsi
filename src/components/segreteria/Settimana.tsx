import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { attivitaDelGiorno, COME_IL_GIORNO, NESSUNA_ATTIVITA, sceltaAttivitaLezione, vociAttivita, type DatiSegreteria, type LezioneSeg } from '../../lib/segreteria'
import type { DettaglioSessione, StatoPresenza, StatoSessione } from '../../lib/sala'
import { chiaveGiorno, giornoPerEsteso, lunedi, oraDi, perEsteso } from '../../lib/sala'
import { dati, type Dati } from '../../lib/dati'
import { Back, ICONE_MENU } from '../Icons'
import { datiGare } from '../../lib/gareDati'
import { gareDellaSettimana, type Gara } from '../../lib/gare'
import { useSchermo } from '../../lib/largo'
import type { ChiProva } from '../../lib/prove'
import { unaVolta } from '../../lib/prove'
import { MarchioProva, PannelloProve, TogliProva } from '../Prove'
import { settimanaDi, type Posto } from '../../lib/indirizzoSegreteria'
import { annuncio, chiSegnaTuttiPresenti, segnaNonSegnati, contiListe, dividiElenco, dopoIlTocco, LISTE, messaggioVuoto, nomeLista, parolaDiStato, serveConferma, statoDaTocco, tastoIniziale, type Azione, type Lista } from '../../lib/appelloListe'
import { finestraDelMese, giorniDellaSettimana, giorniStretti, meseDellaSettimana, nomeTitoloSettimana, postoDopoIlGiorno, titoloSettimana, type MeseDelCalendario } from '../../lib/calendarioSettimana'
import { etichetteLezione } from '../../lib/etichetteLezione'
import { CalendarioSettimana } from './CalendarioSettimana'
import { chiedi, Campo, dataLunga, Guaio, messaggio, Riga, Testa, useAvviso, useCarica, useDialogo } from './comune'

const CORTI = ['DOM', 'LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB']

const piu = (d: Date, giorni: number) => {
  const x = new Date(d)
  x.setDate(x.getDate() + giorni)
  return x
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
  onConti,
  onGara,
}: {
  d: DatiSegreteria
  /** Settimana, sala e lezione aperta stanno nell'indirizzo: le tiene la segreteria. */
  posto: Posto
  onPosto: (p: Omit<Posto, 'voce'>, passo: 'push' | 'replace') => void
  /** Un appello segnato o una lezione cambiata: i conti di COSA MANCA si rileggono. */
  onConti?: () => void
  /** Toccare una gara la apre in GARE. */
  onGara?: (id: string) => void
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

  const giorni = useMemo(() => giorniDellaSettimana(primo), [primo])
  const sett = useCarica(() => d.settimana(giorni[0], giorni[6]), [d, giorni])
  const sale = useCarica(() => d.sale(), [d])
  const pronto = useCarica(() => d.prontoFino(), [d])
  // Le gare non hanno un'ora: stanno in una riga loro, sui giorni che coprono. Se non si leggono
  // (prima di `117-gare.sql`) la riga non c'è: la settimana resta quella delle lezioni.
  const gare = useCarica(async () => {
    const { gare, atleti } = await (await datiGare()).leggi({ ruolo: 'staff', personaId: '', corsiInsegnati: [] })
    return gareDellaSettimana(gare.filter((g) => !g.annullata), primo).map((x) => ({ ...x, atleti: atleti.filter((a) => a.garaId === x.gara.id).length }))
  }, [primo])
  const gareSett = gare.dato ?? []

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
  const contiRef = useRef(onConti)
  contiRef.current = onConti
  useEffect(() => {
    let vivo = true
    let via: (() => void) | undefined
    void dati().then((x) => {
      if (!vivo) return
      let prima = 0
      via = x.guardaCoda?.((n) => {
        if (prima > 0 && n === 0) {
          void rileggi()
          contiRef.current?.()
        }
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
  const stretti = giorniStretti(giorni, sett.dato === null ? null : lezioni.map((l) => l.inizio), gareSett.flatMap((x) => x.giorni))
  const oggi = chiaveGiorno(new Date())
  const adesso = Date.now()
  const lezione = sett.dato?.find((l) => l.id === aperta?.id) ?? null

  // Sul telefono sette colonne non ci stanno: un giorno per volta, scelto
  // dalla striscia dei giorni; da sé oggi, se è in questa settimana.
  const telefono = useSchermo('(max-width: 767px)')
  const [giornoTel, setGiornoTel] = useState<string | null>(null)

  // Il calendario delle date: si apre sul mese della settimana in griglia; le frecce cambiano solo il mese che si vede.
  const tastoDate = useRef<HTMLButtonElement>(null)
  const [calAperto, setCalAperto] = useState(false)
  const [meseVisto, setMeseVisto] = useState<MeseDelCalendario>(() => meseDellaSettimana(primo))
  const apriCalendario = () => {
    if (!calAperto) setMeseVisto(meseDellaSettimana(primo))
    setCalAperto(!calAperto)
  }
  const chiudiCalendario = useCallback((fuoco: boolean) => {
    setCalAperto(false)
    if (fuoco) tastoDate.current?.focus()
  }, [])
  // Una lezione aperta (link, Indietro) ha il suo cassetto sopra: il calendario si chiude.
  useEffect(() => {
    if (aperta) setCalAperto(false)
  }, [aperta])
  // I giorni con lezioni, una lettura per mese: finché la griglia non cambia, riaprire o tornare a un mese già visto non rilegge.
  // Se la lettura fallisce restano i giorni senza quadratino, senza errori, e riaprendo si riprova.
  const [giorniMesi, setGiorniMesi] = useState<Record<string, Set<string>>>({})
  const inLettura = useRef(new Set<string>())
  // I giorni con lezioni cambiano solo quando cambiano le lezioni (una annullata, una straordinaria): `giroLezioni` svuota la
  // memoria dei mesi, e una lettura partita prima dello svuotamento non ci scrive i giorni vecchi.
  const [giroLezioni, setGiroLezioni] = useState(0)
  const generazione = useRef(0)
  const chiaveMese = `${meseVisto.anno}-${meseVisto.mese}`
  useEffect(() => {
    generazione.current += 1
    inLettura.current.clear()
    setGiorniMesi({})
  }, [giroLezioni])
  useEffect(() => {
    if (!calAperto || giorniMesi[chiaveMese] || inLettura.current.has(chiaveMese)) return
    inLettura.current.add(chiaveMese)
    const mia = generazione.current
    const { da, a } = finestraDelMese(meseVisto)
    d.giorniConLezioni(da, a)
      .then((l) => mia === generazione.current && setGiorniMesi((p) => ({ ...p, [chiaveMese]: new Set(l) })))
      .catch(() => undefined)
      .finally(() => mia === generazione.current && inLettura.current.delete(chiaveMese))
  }, [calAperto, chiaveMese, giorniMesi, d])
  const conLezioniDelMese = giorniMesi[chiaveMese] ?? null
  const chiavi = giorni.map(chiaveGiorno)
  const delGiorno = giornoTel && chiavi.includes(giornoTel) ? giornoTel : chiavi.includes(oggi) ? oggi : chiavi[0]
  const lezioniDelGiorno = lezioni.filter((l) => chiaveGiorno(new Date(l.inizio)) === delGiorno)
  const oreDelGiorno = [...new Set(lezioniDelGiorno.map((l) => oraDi(l.inizio)))].sort()

  return (
    <>
      <Testa
        titolo="SETTIMANA"
        sotto={`Le lezioni dell’orario dei corsi: aprine una per l’appello, il sostituto o per annullarla.${pronto.dato ? ` Calendario pronto fino al ${dataLunga(pronto.dato)}: si allunga da sé, e subito da IMPOSTAZIONI → LA STAGIONE.` : ''}`}
      >
        <button type="button" className="sg-btn sg-btn-linea" onClick={() => setNuova(true)}>
          + Lezione straordinaria
        </button>
      </Testa>

      <div className="row sg-sett-barra" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="icon-btn" aria-label="Settimana prima" onClick={() => sfoglia(piu(primo, -7))}>
          <Back />
        </button>
        <div className="sg-sett-titolo-box">
          <button
            ref={tastoDate}
            type="button"
            className="ob sg-sett-titolo"
            aria-haspopup="dialog"
            aria-expanded={calAperto}
            aria-label={nomeTitoloSettimana(primo)}
            onClick={apriCalendario}
          >
            {titoloSettimana(primo)}
            <span className="sg-sett-freccia" aria-hidden="true">
              ▾
            </span>
          </button>
          {calAperto && (
            <CalendarioSettimana
              mese={meseVisto}
              onMese={setMeseVisto}
              lunediScelto={primo}
              conLezioni={conLezioniDelMese}
              prontoFino={pronto.dato ?? null}
              titolo={tastoDate}
              onChiudi={chiudiCalendario}
              onScegli={(g) => {
                onPosto(postoDopoIlGiorno({ settimana: chiaveGiorno(primo), sala: sala || undefined, lezione: aperta }, g), 'replace')
                // Sul telefono il giorno toccato è anche il giorno della striscia.
                setGiornoTel(chiaveGiorno(g))
                chiudiCalendario(true)
              }}
            />
          )}
        </div>
        <button type="button" className="icon-btn" aria-label="Settimana dopo" onClick={() => sfoglia(piu(primo, 7))}>
          <span style={{ transform: 'scaleX(-1)', display: 'flex' }}>
            <Back />
          </span>
        </button>
        <button type="button" className="sg-chip" onClick={() => sfoglia(lunedi(new Date()))}>
          Oggi
        </button>
        <div className="grow" />
        {[{ id: '', nome: 'Tutte' }, ...(sale.dato ?? [])].map((s) => (
          <button key={s.id} type="button" className="num sg-chip" aria-pressed={sala === s.id} onClick={() => scegliSala(s.id)}>
            {s.nome}
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
          {gareSett
            .filter((x) => x.giorni.includes(delGiorno))
            .map((x) => (
              <TesseraGara key={x.gara.id} gara={x.gara} giorni={x.giorni} atleti={x.atleti} onApri={() => onGara?.(x.gara.id)} />
            ))}
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
          <div className="sg-griglia" style={{ gridTemplateColumns: `56px ${stretti.map((s) => (s ? '44px' : 'minmax(120px, 1fr)')).join(' ')}` }}>
            <span />
            {giorni.map((g) => {
              const k = chiaveGiorno(g)
              return (
                <div key={k} className="sg-giorno" data-oggi={k === oggi} data-stretto={stretti[giorni.indexOf(g)]}>
                  <span className="num" style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.14em' }}>{CORTI[g.getDay()]}</span>
                  <span className="num" style={{ fontSize: 20, fontWeight: 700 }}>{g.getDate()}</span>
                </div>
              )
            })}

            {gareSett.length > 0 && (
              <div className="sg-gare-sett">
                <span className="sg-gare-testa" style={{ gridRow: `1 / span ${gareSett.length}` }}>
                  <Coppa size={13} />
                  GARE
                </span>
                {gareSett.map((x, i) => (
                    <div key={x.gara.id} style={{ gridRow: i + 1, gridColumn: `${giorni.findIndex((g) => chiaveGiorno(g) === x.giorni[0]) + 2} / span ${x.giorni.length}` }}>
                      <TesseraGara gara={x.gara} giorni={x.giorni} atleti={x.atleti} onApri={() => onGara?.(x.gara.id)} />
                    </div>
                ))}
              </div>
            )}

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
          <span className="num" style={{ fontWeight: 700, color: 'var(--verde-testo)' }}>8/9</span>presenti su iscritti, appello fatto
        </span>
        <span className="row" style={{ gap: 6 }}>
          <span className="num" style={{ fontWeight: 700, color: 'var(--sec)' }}>14/16</span>iscritti su posti
        </span>
        <span className="row" style={{ gap: 6 }}>
          <span className="num sg-tag" data-tipo="manca">Senza appello</span>passata, nessuno ha segnato
        </span>
        <span className="row" style={{ gap: 6 }}>
          <span className="num sg-tag" data-tipo="fatto">Appello fatto</span>passata, e l’appello c’è
        </span>
        <span className="row" style={{ gap: 6 }}>
          <span className="num sg-tag" data-tipo="aspetta">Manca l’istruttore</span>la lezione non ne ha uno: si assegna in CORSI
        </span>
        <span className="row" style={{ gap: 6 }}>
          <span className="num sg-tag" data-tipo="sostituto">Sostituto</span>un altro istruttore, solo per quel giorno
        </span>
      </div>

      {lezione && (
        <Lezione
          d={d}
          l={lezione}
          sale={sale.dato ?? []}
          onCambiato={() => {
            void sett.ricarica()
            setGiroLezioni((g) => g + 1)
            onConti?.()
          }}
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
            setGiroLezioni((g) => g + 1)
          }}
        />
      )}
      {avviso}
    </>
  )
}

const Coppa = ICONE_MENU.gare
const giornoCorto = (k: string) => {
  const g = new Date(`${k}T12:00`)
  return `${CORTI[g.getDay()]} ${g.getDate()}`
}

function TesseraGara({ gara, giorni, atleti, onApri }: { gara: Gara; giorni: string[]; atleti: number; onApri: () => void }) {
  const quando = giorni.length > 1 ? `${giornoCorto(giorni[0])} – ${giornoCorto(giorni[giorni.length - 1])}` : giornoCorto(giorni[0])
  return (
    <button type="button" className="sg-gara-sett" onClick={onApri}>
      <span className="num sg-gara-sett-quando">
        <Coppa size={13} />
        Gara · {quando}
      </span>
      <span style={{ fontWeight: 700 }}>{gara.nome}</span>
      {gara.luogo && <span className="sg-gara-sett-dove">{gara.luogo}</span>}
      <span className="num sg-gara-sett-dove">
        {atleti} {atleti === 1 ? 'atleta' : 'atleti'}
      </span>
    </button>
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
  const etichette = etichetteLezione(l, passata)
  // Una regola sola per il tag e per il bordo: manca l'appello, o è fatto.
  const manca = etichette.some((e) => e.tipo === 'manca')
  // Passata e con l'appello fatto non chiede più niente: si fa da parte, e
  // nella settimana resta in vista solo quello che manca.
  const chiusa = etichette.some((e) => e.tipo === 'fatto')
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
      {/* Le lezioni della stessa fascia si impilano: senza l'orario sulla tessera non si capisce quando finiscono. */}
      <span className="num sg-lezione-orario">{oraDi(l.inizio)}–{oraDi(l.fine)}</span>
      <span className="ob sg-lezione-nome">{l.corso}</span>
      <span className="sg-lezione-dove">
        {[l.sala ?? <span key="s" className="sg-forse">sala?</span>, ...(l.istruttori ? [l.istruttori] : []), ...(l.attivita ? [l.attivita] : [])].map((x, i) => (
          <span key={i}>
            {i > 0 && ' · '}
            {x}
          </span>
        ))}
      </span>
      <span className="row" style={{ gap: 6, marginTop: 'auto', flexWrap: 'wrap' }}>
        <span className="num" style={{ fontSize: 14, fontWeight: 700, color: fatto ? 'var(--verde-testo)' : 'var(--sec)' }}>
          {fatto ? `${l.presenti}/${l.iscritti}` : l.capienza ? `${l.iscritti}/${l.capienza}` : l.iscritti}
        </span>
        {etichette.map((e) => (
          <span key={e.testo} className="num sg-tag" data-tipo={e.tipo} title={e.titolo}>
            {e.testo}
          </span>
        ))}
      </span>
    </button>
  )
}

type Fai = ReturnType<typeof useAvviso>['fai']

const STATI: Array<[StatoSessione, string]> = [
  ['prevista', 'Prevista'],
  ['svolta', 'Svolta'],
  ['annullata', 'Annullata'],
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
  const attivita = useCarica(() => d.attivita(), [d])
  const corsi = useCarica(() => d.corsi(), [d])
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
                      `Annullare ${l.corso} di ${giornoPerEsteso(chiaveGiorno(new Date(l.inizio))).toLowerCase()} alle ${oraDi(l.inizio)}? Calendario e tablet la mostrano annullata, ma gli iscritti non vengono avvisati: vanno chiamati o scritti. Si rimette con Prevista.`,
                      'Annulla la lezione',
                      { pericolo: true },
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

        {attivita.dato && !attivita.dato.manca && (
          <Attivita
            l={l}
            elenco={attivita.dato.elenco}
            giorno={corsi.dato ? attivitaDelGiorno(corsi.dato, l) : undefined}
            cambia={cambia}
            comeIlGiorno={() => void fai(() => d.attivitaComeIlGiorno(l.id), 'Attività come il giorno', onCambiato)}
          />
        )}

        <Appello key={l.id} l={l} onCambiato={onCambiato} />

        <div className="grow" />
        {l.straordinaria && (
          <button
            type="button"
            className="sg-btn sg-btn-linea sg-pericolo"
            onClick={async () => {
              if (!(await chiedi(`Togliere questa lezione straordinaria? Sparisce dal calendario e dal tablet.`, 'Togli la lezione', { pericolo: true }))) return
              void fai(() => d.togliLezione(l.id), 'Lezione tolta', () => {
                onChiudi()
                onCambiato()
              })
            }}
          >
            Togli questa lezione straordinaria
          </button>
        )}
        <button type="button" className="sg-btn sg-btn-pieno" onClick={onChiudi}>
          Fatto
        </button>
      </section>
    </>
  )
}

/** Cosa si fa in questa lezione: quella del giorno, che la segue da sola, o una scelta a mano solo per lei. */
function Attivita({
  l,
  elenco,
  giorno,
  cambia,
  comeIlGiorno,
}: {
  l: LezioneSeg
  elenco: Array<{ id: string; nome: string; attiva: boolean }>
  giorno?: string
  cambia: (cambi: { attivitaId: string | null }, detto: string) => void
  comeIlGiorno: () => void
}) {
  const { valore, segue, conGiorno } = sceltaAttivitaLezione(l)
  const voci = vociAttivita(elenco, l.attivitaId)
  return (
    <div className="stack" style={{ gap: 6 }}>
      <Campo id="z-att" etichetta="ATTIVITÀ">
        <select
          id="z-att"
          className="sg-campo"
          data-acceso={!segue && conGiorno}
          value={valore}
          onChange={(e) => {
            if (e.target.value === COME_IL_GIORNO) return comeIlGiorno()
            const id = e.target.value === NESSUNA_ATTIVITA ? null : e.target.value
            cambia({ attivitaId: id }, id ? `Attività: ${elenco.find((a) => a.id === id)?.nome}` : 'Nessuna attività')
          }}
        >
          {conGiorno && <option value={COME_IL_GIORNO}>Come il giorno{giorno ? ` (${giorno})` : ''}</option>}
          <option value={NESSUNA_ATTIVITA}>Nessuna attività</option>
          {voci.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nome}
              {a.fuoriUso ? ' (non più in uso)' : ''}
            </option>
          ))}
        </select>
      </Campo>
      {conGiorno && (
        <span className="row" style={{ gap: 10, flexWrap: 'wrap', fontSize: 13, color: segue ? 'var(--dim)' : 'var(--giallo-testo)' }}>
          {segue ? (
            <span>Si aggiorna da sola: se il giorno cambia attività, cambia anche questa lezione.</span>
          ) : (
            <>
              <span>Cambiata a mano. Solo per questa lezione: il giorno resta com'è.</span>
              <button type="button" className="num sg-chip" style={{ minHeight: 44 }} onClick={comeIlGiorno}>
                Come il giorno
              </button>
            </>
          )}
        </span>
      )}
    </div>
  )
}

/**
 * L'appello dalla segreteria, a tre tasti (DA SEGNARE, PRESENTI, ASSENTI): sotto
 * c'è una lista sola, quella del tasto premuto, e in DA SEGNARE ogni riga ha ✓ e ✕.
 * Serve a segnare al banco le presenze che l'istruttore ha preso su carta o a
 * correggere un tocco sbagliato (un tocco sul nome in PRESENTI o ASSENTI lo
 * rimette da segnare). Le regole stanno in `lib/appelloListe.ts`. Scrive con gli
 * stessi `dati` dell'appello, quindi anche da qui senza rete non si perde niente.
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
  // Il tasto premuto si decide quando l'elenco arriva e poi non cambia da solo: se
  // DA SEGNARE si svuota mentre si segna, non si passa a un'altra lista senza chiederlo.
  const [lista, setLista] = useState<Lista>('da_segnare')
  const [annunciato, setAnnunciato] = useState('')
  // Dove va il fuoco dopo un tocco: su una riga, o (id null) sul tasto premuto se la lista si è svuotata.
  const [fuoco, setFuoco] = useState<{ id: string | null } | null>(null)
  const tastiLista = useRef<HTMLDivElement>(null)
  // L'altezza della lista a ogni segno: la lista si accorcia, ma il cassetto non deve scorrere sotto il dito.
  const listaRef = useRef<HTMLDivElement>(null)
  const [altezzaLista, setAltezzaLista] = useState<number | null>(null)
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
        setLista(tastoIniziale(det?.elenco ?? []))
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
  // Solo chi non è segnato: le assenze già messe non si toccano.
  const tutti = () => {
    if (!strato || !elenco) return
    const chi = chiSegnaTuttiPresenti(elenco)
    if (chi.length === 0) return
    setElenco((v) => v && v.map((p) => (chi.includes(p.id) ? { ...p, stato: 'presente' } : p)))
    scritto(segnaNonSegnati(strato, l.id, elenco))
  }
  // ✓, ✕ o «rimetti da segnare»: la riga cambia lista, il fuoco va a quella che prende il suo posto.
  const segna = async (personaId: string, azione: Azione) => {
    if (!strato || !elenco) return
    const chi = elenco.find((p) => p.id === personaId)
    if (chi && serveConferma(chi, azione) && !(await chiedi(`Togliere la giustificazione di ${perEsteso(chi)}?`, 'Togli', { pericolo: true }))) return
    const r = dopoIlTocco(elenco, personaId, azione, lista)
    setAltezzaLista(listaRef.current?.offsetHeight ?? null)
    setElenco(r.elenco)
    setFuoco({ id: r.prossimoFuoco })
    if (chi) setAnnunciato(annuncio(chi, azione, contiListe(r.elenco).da_segnare))
    scritto(strato.segna(l.id, personaId, statoDaTocco(azione)))
  }
  useEffect(() => {
    if (fuoco === null) return
    const riga = fuoco.id ? document.querySelector<HTMLElement>(`[data-fuoco="${CSS.escape(fuoco.id)}"]`) : null
    // preventScroll: il fuoco non deve far scorrere il cassetto, se no il tocco dopo cade su un'altra riga.
    ;(riga ?? tastiLista.current?.querySelector<HTMLElement>('button[aria-pressed="true"]'))?.focus({ preventScroll: true })
    setFuoco(null)
  }, [fuoco])
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
  const conti = contiListe(elenco ?? [])
  const qui = dividiElenco(elenco ?? [])[lista]
  const prove = elenco?.filter((p) => p.prova) ?? []

  const azzera = async () => {
    if (!strato || !elenco) return
    if (segnati && !(await chiedi(`Togliere i ${segnati} segni di questa lezione?`, 'Togli i segni', { pericolo: true }))) return
    setElenco(elenco.map((p) => ({ ...p, stato: null })))
    // Senza segni la lista premuta (PRESENTI, ASSENTI) è vuota e non serve a niente: si torna a DA SEGNARE.
    setLista('da_segnare')
    setAltezzaLista(null)
    scritto(Promise.all(elenco.filter((p) => p.stato !== null).map((p) => strato.segna(l.id, p.id, null))).then(() => undefined))
  }

  return (
    <>
      <div className="sg-appello" data-manca={manca}>
        <div className="row" style={{ gap: 10, alignItems: 'baseline' }}>
          <span className="sg-etichetta grow">APPELLO</span>
          <span
            className="num"
            style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', color: segnati ? 'var(--verde-testo)' : manca ? 'var(--rosso-testo)' : 'var(--dim)' }}
          >
            {annullata ? 'Annullata' : !cominciata ? 'Non ancora' : segnati === quanti && quanti ? 'Fatto' : segnati ? `${quanti - segnati} da segnare` : 'Non fatto'}
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
              Tutti presenti
            </button>
            <button type="button" className="sg-btn sg-btn-linea sg-pericolo" onClick={azzera} disabled={!segnati}>
              Azzera
            </button>
          </div>
        )}
        {aperto && elenco && (
          <button type="button" className="sg-btn sg-btn-tratteggio" aria-expanded={conProve} disabled={!strato} onClick={() => setConProve((x) => !x)}>
            Prove
          </button>
        )}
      </div>

      {conProve && strato && elenco && (
        <PannelloProve
          stile="sg"
          cerca={unaVolta(() => strato.provati())}
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
        {iscritti && iscritti.length > 0 && !aperto && (
          <div className="sg-elenco-appello">
            {iscritti.map((p) => (
              <div key={p.id} className="riga-appello" data-stato={p.stato ?? 'niente'}>
                <span className="segno" aria-hidden="true">
                  {p.stato === 'presente' ? '✓' : p.stato === 'assente' ? '✕' : ''}
                </span>
                <span className="nome-appello grow">{perEsteso(p)}</span>
              </div>
            ))}
          </div>
        )}
        {iscritti && iscritti.length > 0 && aperto && elenco && (
          <>
            {/* conti e liste si calcolano una volta per disegno */}
            <div className="sg-liste" role="group" aria-label="Chi vedere" ref={tastiLista}>
              {LISTE.map((x) => {
                const n = conti[x]
                return (
                  <button key={x} type="button" className="sg-lista-tasto" data-lista={x} aria-pressed={lista === x} onClick={() => {
                      setLista(x)
                      setAltezzaLista(null)
                    }}>
                    <span className="sg-lista-segno" aria-hidden="true">
                      {x === 'da_segnare' ? '○' : x === 'presenti' ? '✓' : '✕'}
                    </span>
                    <span className="sg-lista-n">{n}</span>
                    <span className="sg-lista-nome">{nomeLista(x)}</span>
                  </button>
                )
              })}
            </div>
            <Riga titolo={nomeLista(lista)}>
              <span className="num" style={{ fontSize: 14, fontWeight: 700 }}>
                {conti[lista]}
              </span>
            </Riga>
            {qui.length === 0 && <span className="sg-sotto">{messaggioVuoto(lista)}</span>}
            <div className="sg-elenco-appello" ref={listaRef} style={altezzaLista ? { minHeight: altezzaLista } : undefined}>
              {qui.map((p) =>
                lista === 'da_segnare' ? (
                  <div key={p.id} className="riga-appello riga-segna" data-stato="niente">
                    <span className="segno" aria-hidden="true">
                      ○
                    </span>
                    <span className="nome-appello grow">{perEsteso(p)}</span>
                    <button type="button" className="sg-segna sg-segna-si" data-fuoco={p.id} onClick={() => segna(p.id, 'presente')} aria-label={`${perEsteso(p)}: presente`}>
                      ✓
                    </button>
                    <button type="button" className="sg-segna sg-segna-no" onClick={() => segna(p.id, 'assente')} aria-label={`${perEsteso(p)}: assente`}>
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    key={p.id}
                    type="button"
                    className="riga-appello"
                    data-stato={p.stato ?? 'niente'}
                    data-fuoco={p.id}
                    onClick={() => segna(p.id, 'rimetti')}
                    aria-label={`${perEsteso(p)}: ${parolaDiStato(p.stato).toLowerCase()}. Tocca per rimetterlo da segnare`}
                  >
                    <span className="segno" aria-hidden="true">
                      {p.stato === 'presente' ? '✓' : '✕'}
                    </span>
                    <span className="nome-appello grow">{perEsteso(p)}</span>
                    <span className="sg-parola-stato">{parolaDiStato(p.stato)}</span>
                  </button>
                ),
              )}
            </div>
            <span role="status" className="vh">
              {annunciato}
            </span>
          </>
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
                    onClick={() => tocca(p.id, p.stato === 'presente' ? 'assente' : 'presente')}
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
            Lascia stare
          </button>
          <button type="submit" className="sg-btn sg-btn-pieno grow" disabled={!scelto}>
            Aggiungi
          </button>
        </div>
      </form>
    </>
  )
}
