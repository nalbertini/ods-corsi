import { useMemo, useState } from 'react'
import type { DatiSegreteria, Tariffa } from '../../lib/segreteria'
import { NOME_CASSA_CONTO, oggiARoma, type Cassa, type ChiusuraCassa } from '../../lib/contabilita'
import { insegna } from '../../lib/ruoli'
import { chiaveGiorno, dataLunga } from '../../lib/sala'
import { euro } from '../../lib/ricevute'
import { mesi, oreItaliane as ore } from '../../lib/ore'
import { euroOra, euroDaScrivere } from '../../lib/tariffe'
import { centesimiDaImporto, cosaNonVaCompenso, cosaNonVaImportoScritto, datiPerRicevuta, cosaNonVaPagamento, descrizionePagamento, esitoDelMese, pagabili, VOCE_COMPENSI, mancaPerRicevuta, primoDelMese, righeCompensi, type ContoCompenso, type RicevutaCompenso, type StatoCompenso } from '../../lib/compensi'
import { chiedi, Guaio, Testa, useAvviso, useCarica } from './comune'
import { Numero } from './Presenze'

type Fai = ReturnType<typeof useAvviso>['fai']
type Persona = { id: string; nome: string; cognome: string }

const NOME_STATO: Record<StatoCompenso, { testo: string; tono: 'rosso' | 'giallo' | 'neutro' | 'verde' }> = {
  'da-confermare': { testo: 'PRESENZE DA CONFERMARE', tono: 'rosso' },
  'senza-tariffa': { testo: 'SENZA TARIFFA', tono: 'rosso' },
  'senza-dati': { testo: 'MANCANO I DATI', tono: 'rosso' },
  'da-fare': { testo: 'RICEVUTA DA FARE', tono: 'neutro' },
  fatta: { testo: 'FATTA · DA PAGARE', tono: 'giallo' },
  pagata: { testo: 'PAGATA', tono: 'verde' },
  'non-torna': { testo: 'NON TORNA PIÙ', tono: 'rosso' },
}

/** Il tono del segno di uno stato: rosso quando si è fermi, e allora anche il riquadro. */
export const tonoCompenso = (stato: StatoCompenso) => NOME_STATO[stato].tono

const nomeDi = (p: Persona) => `${p.cognome} ${p.nome}`.trim()
const saltato = (r: { persona: Persona; stato: StatoCompenso }) => `${nomeDi(r.persona)} (${NOME_STATO[r.stato].testo.toLowerCase()})`
const maiuscola = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const quante = (n: number, uno: string, tanti: string) => `${n} ${n === 1 ? uno : tanti}`
const quanteOre = (minuti: number) => `${ore(minuti)} ${minuti === 60 ? 'ora' : 'ore'}`
const scarica = async (rs: RicevutaCompenso[]) => (await import('../../lib/ricevutaCompensoPdf')).scaricaRicevuteCompensi(rs)

/**
 * Fa la ricevuta del mese di un tecnico: legge i suoi dati e le sue lettere,
 * li copia dentro e la salva. Senza codice fiscale, residenza o IBAN non si fa.
 */
async function faiRicevuta(d: DatiSegreteria, p: Persona, conto: ContoCompenso, mese: string, cambiato?: { importo: number; motivo: string }) {
  const [an, lettere] = await Promise.all([d.anagraficaDi(p.id), d.lettere(p.id)])
  const manca = mancaPerRicevuta(an?.dati ?? null)
  if (manca) throw new Error(`${nomeDi(p)}: ${manca.charAt(0).toLowerCase()}${manca.slice(1)}`)
  return d.faiRicevutaCompenso(datiPerRicevuta(p, an?.dati ?? null, conto, mese, lettere, chiaveGiorno(new Date()), cambiato))
}

/**
 * I tasti della ricevuta di un mese, gli stessi nella pagina COMPENSI e nella
 * scheda del tecnico: prepararla (anche col compenso cambiato a mano e il
 * perché), ristamparla, spuntarla firmata, annullarla.
 */
export function AzioniRicevuta({
  d,
  p,
  conto,
  ricevuta,
  stato,
  mese,
  fai,
  onCambiato,
  inScheda,
  onPaga,
}: {
  d: DatiSegreteria
  p: Persona
  conto: ContoCompenso
  ricevuta?: RicevutaCompenso
  stato: StatoCompenso
  mese: string
  fai: Fai
  onCambiato: () => Promise<unknown>
  /** Nella scheda del tecnico: tariffe e dati sono già lì sopra, non serve il collegamento. */
  inScheda?: boolean
  /** Per chi cura anche la contabilità: apre il pannello SEGNA PAGATO di questo tecnico. */
  onPaga?: () => void
}) {
  const [cambia, setCambia] = useState<{ testo: string; motivo: string } | null>(null)
  // Mentre prepara o annulla i tasti sono spenti: un doppio clic non fa due cose.
  const [occupato, setOccupato] = useState(false)
  const prepara = async (cambiato?: { importo: number; motivo: string }) => {
    setOccupato(true)
    try {
      await preparaOra(cambiato)
    } finally {
      setOccupato(false)
    }
  }
  const preparaOra = async (cambiato?: { importo: number; motivo: string }) => {
    const fatta: { r?: RicevutaCompenso } = {}
    const ok = await fai(async () => (fatta.r = await faiRicevuta(d, p, conto, mese, cambiato)), 'Ricevuta fatta', async () => {
      setCambia(null)
      await onCambiato()
    })
    // Prima si salva, poi si scarica: se il PDF non esce, la ricevuta c'è già e si ristampa.
    const r = fatta.r
    if (ok && r) void fai(() => scarica([r]))
  }
  const annulla = async () => {
    if (!ricevuta) return
    // Il secondo clic di un doppio clic su «Prepara» finisce qui, appena la ricevuta c'è: non vale.
    if (Date.now() - Date.parse(ricevuta.creataIl) < 1500) return
    const rifai = stato === 'non-torna'
    const domanda = rifai
      ? `Annullare la ricevuta di ${nomeDi(p)} e farne una nuova coi conti di adesso? Quella di prima resta nel registro, annullata.`
      : `Annullare la ricevuta di ${nomeDi(p)}? Resta nel registro, annullata; poi se ne fa una nuova.`
    if (!(await chiedi(domanda, rifai ? 'Annulla e rifai' : 'Annulla la ricevuta', { pericolo: true }))) return
    setOccupato(true)
    try {
      const ok = await fai(() => d.annullaRicevutaCompenso(ricevuta.id), 'Ricevuta annullata', rifai ? undefined : onCambiato)
      // «Annulla e rifai»: annullata quella vecchia, si fa subito la nuova.
      if (ok && rifai) await preparaOra()
    } finally {
      setOccupato(false)
    }
  }

  if (cambia) {
    const importo = centesimiDaImporto(cambia.testo) ?? 0
    const no = cosaNonVaImportoScritto(cambia.testo) ?? cosaNonVaCompenso({ importo, calcolato: conto.calcolato, motivo: cambia.motivo })
    return (
      <div className="stack" style={{ gap: 10, padding: '14px 16px', border: '2px solid var(--text)', flexBasis: '100%' }}>
        <span className="sg-etichetta">MODIFICA IL COMPENSO</span>
        <div className="sg-due sg-scheda-campi">
          <label className="stack" style={{ gap: 6 }}>
            <span className="sg-etichetta">COMPENSO (€)</span>
            <input className="sg-campo num" inputMode="decimal" value={cambia.testo} onChange={(e) => setCambia({ ...cambia, testo: e.target.value })} />
            <span style={{ fontSize: 13, color: 'var(--giallo-testo)' }}>Calcolato dalle lezioni: {euro(conto.calcolato)} €.</span>
          </label>
          <label className="stack" style={{ gap: 6 }}>
            <span className="sg-etichetta">PERCHÉ</span>
            <input className="sg-campo" maxLength={200} value={cambia.motivo} onChange={(e) => setCambia({ ...cambia, motivo: e.target.value })} />
            <span style={{ fontSize: 13, color: 'var(--giallo-testo)' }}>Obbligatorio se il compenso cambia: resta scritto sulla ricevuta in segreteria.</span>
          </label>
        </div>
        {no && (
          <span role="alert" style={{ fontSize: 13, color: 'var(--rosso-testo)' }}>
            {no}.
          </span>
        )}
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="sg-btn sg-btn-linea" onClick={() => setCambia(null)}>
            Lascia stare
          </button>
          <button type="button" className="sg-btn sg-btn-pieno" disabled={!!no || occupato} onClick={() => void prepara({ importo, motivo: cambia.motivo })}>
            Prepara la ricevuta
          </button>
        </div>
      </div>
    )
  }

  if (ricevuta)
    return (
      <span className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <label className="row" style={{ gap: 8, minHeight: 44, fontSize: 14, fontWeight: 600 }}>
          <input
            type="checkbox"
            style={{ width: 24, height: 24, margin: 0, accentColor: 'var(--text)' }}
            checked={ricevuta.firmata}
            onChange={(e) => void fai(() => d.segnaFirmataCompenso(ricevuta.id, e.target.checked), e.target.checked ? 'Segnata firmata' : 'Tolta la spunta', onCambiato)}
          />
          Firmata
        </label>
        <button type="button" className="sg-btn sg-btn-linea" onClick={() => void fai(() => scarica([ricevuta]))}>
          Ristampa
        </button>
        {!ricevuta.pagataIl && onPaga && (
          <button type="button" className="sg-btn sg-btn-pieno" disabled={occupato} onClick={onPaga}>
            Segna pagato
          </button>
        )}
        {/* Annulla su una riga sua: sul telefono un dito sbagliato accanto a Ristampa annullerebbe. Una pagata non si annulla da qui. */}
        {!ricevuta.pagataIl && (
          <span style={{ flexBasis: '100%', display: 'flex' }}>
            <button type="button" className="sg-btn sg-btn-linea sg-pericolo" disabled={occupato} onClick={() => void annulla()}>
              {stato === 'non-torna' ? 'Annulla e rifai' : 'Annulla'}
            </button>
          </span>
        )}
      </span>
    )

  if (stato === 'da-fare')
    return (
      <span className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className="sg-btn sg-btn-linea" disabled={occupato} onClick={() => setCambia({ testo: euroDaScrivere(conto.calcolato), motivo: '' })}>
          Modifica il compenso
        </button>
        <button type="button" className="sg-btn sg-btn-pieno" disabled={occupato} onClick={() => void prepara()}>
          Prepara la ricevuta
        </button>
      </span>
    )
  // Chi è fermo ha dove andare a sistemare.
  if (stato === 'da-confermare')
    return (
      <a className="sg-link sg-link-alto" style={{ fontSize: 14 }} href="#istruttori">
        Conferma in Presenze istruttori ›
      </a>
    )
  if ((stato === 'senza-tariffa' || stato === 'senza-dati') && !inScheda)
    return (
      <a className="sg-link sg-link-alto" style={{ fontSize: 14 }} href="#personale">
        {stato === 'senza-tariffa' ? 'Scrivi la tariffa' : 'Scrivi i dati'} in Istruttori e accessi ›
      </a>
    )
  return null
}

/** Il segno dello stato, in parole e col colore, e sotto cosa fare. */
export function SegnoCompenso({ stato, conto, ricevuta, manca, inScheda }: { stato: StatoCompenso; conto: ContoCompenso; ricevuta?: RicevutaCompenso; manca?: string | null; inScheda?: boolean }) {
  const s = NOME_STATO[stato]
  const frase =
    stato === 'da-confermare'
      ? `${conto.daConfermare} da confermare in PRESENZE ISTRUTTORI: prima si decidono, poi si fa la ricevuta.`
      : stato === 'senza-tariffa'
        ? `${conto.senzaTariffa.join(', ')} senza tariffa: si scrive ${inScheda ? 'qui sopra, in TARIFFE' : 'nella scheda, in ISTRUTTORI E ACCESSI'}.`
        : stato === 'senza-dati'
          ? `${maiuscola((manca ?? '').replace(/^Mancano i dati per la ricevuta: /, '') || 'I dati')}: si scrivono ${inScheda ? 'qui sopra, in DATI PER LETTERA E RICEVUTE' : 'nella scheda, in ISTRUTTORI E ACCESSI'}.`
          : stato === 'non-torna' && ricevuta
          ? `Ricevuta di ${euro(ricevuta.importo)} €: dopo è cambiata una presenza e il mese ora fa ${euro(conto.calcolato)} €.${ricevuta.firmata ? ' Era firmata.' : ''}`
          : stato === 'pagata' && ricevuta?.pagataIl
            ? `Pagata il ${dataLunga(ricevuta.pagataIl)}${ricevuta.motivo ? ` · cambiata a mano: ${ricevuta.motivo}` : ''}. Per annullarla, prima si annulla il pagamento in CONTABILITÀ.`
            : ricevuta
            ? `Fatta il ${dataLunga(ricevuta.data)}${ricevuta.motivo ? ` · cambiata a mano: ${ricevuta.motivo}` : ''}`
            : ''
  return (
    <span className="stack" style={{ gap: 4, minWidth: 0, alignItems: 'flex-start' }}>
      <span className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        <span className="sg-segno-regola" data-tono={s.tono}>
          {s.testo}
        </span>
        {ricevuta && !ricevuta.firmata && (
          <span className="sg-segno-regola" data-tono="giallo">
            DA RIPORTARE FIRMATA
          </span>
        )}
      </span>
      {frase && <span style={{ fontSize: 13, color: 'var(--sec)' }}>{frase}</span>}
    </span>
  )
}

type Filtro = 'tutti' | 'da-fare' | 'da-pagare' | 'da-firmare'

/**
 * COMPENSI: il mese di tutti i tecnici. Una riga per chi ha lezioni
 * confermate, da confermare o una ricevuta di quel mese: per ogni corso le
 * ore per la tariffa, a che punto è, e i tasti. Le ricevute pronte si
 * preparano tutte insieme, in un PDF solo; chi non è pronto si salta e si dice
 * perché.
 */
export function Compensi({ d, puoPagare }: { d: DatiSegreteria; puoPagare: boolean }) {
  const periodi = useMemo(mesi, [])
  const [periodo, setPeriodo] = useState(periodi[1]?.chiave ?? periodi[0].chiave)
  const [filtro, setFiltro] = useState<Filtro>('tutti')
  const [tutte, setTutte] = useState(false)
  const [paga, setPaga] = useState<Persona | null>(null)
  const m = periodi.find((x) => x.chiave === periodo) ?? periodi[0]
  const mese = primoDelMese(m.da)
  const giorni = Math.ceil((Date.now() - m.da.getTime()) / 86_400_000) + 1
  const { avviso, avvisa, fai } = useAvviso()
  const dati = useCarica(async () => {
    const [personale, presenze, senzaIstruttore, ricevute] = await Promise.all([d.personale(), d.presenzeIstruttori(giorni), d.lezioniSenzaIstruttore(), d.ricevuteCompensi()])
    const tecnici = personale.filter(insegna)
    const [tariffe, mancano] = await Promise.all([
      Promise.all(tecnici.map(async (t) => [t.id, await d.tariffe(t.id)] as const)).then((x): Record<string, Tariffa[]> => Object.fromEntries(x)),
      Promise.all(tecnici.map(async (t) => [t.id, mancaPerRicevuta((await d.anagraficaDi(t.id))?.dati ?? null)] as const)).then((x): Record<string, string | null> => Object.fromEntries(x)),
    ])
    // Le casse le legge solo chi cura la contabilità: serve per pagare.
    const [casse, chiusure] = puoPagare ? await Promise.all([d.casse(), d.chiusure()]) : [[], []]
    return { tecnici, presenze, senzaIstruttore, ricevute, tariffe, mancano, casse, chiusure }
  }, [d, giorni])

  const righe = dati.dato ? righeCompensi({ ...dati.dato, mese: m }) : []
  const daFare = righe.filter((r) => r.stato === 'da-fare')
  const fermi = righe.filter((r) => r.stato === 'da-confermare' || r.stato === 'senza-tariffa' || r.stato === 'senza-dati' || r.stato === 'non-torna')
  const daFirmare = righe.filter((r) => r.ricevuta && !r.ricevuta.firmata)
  const daPagare = righe.filter((r) => r.stato === 'fatta' || r.stato === 'non-torna')
  const visibili = filtro === 'da-fare' ? daFare : filtro === 'da-firmare' ? daFirmare : filtro === 'da-pagare' ? daPagare : righe

  const preparaTutte = async () => {
    const fatte: RicevutaCompenso[] = []
    const saltati: string[] = fermi.map(saltato)
    setTutte(true)
    await fai(async () => {
      for (const r of daFare) {
        try {
          fatte.push(await faiRicevuta(d, r.persona, r.conto, mese))
        } catch (e) {
          saltati.push(e instanceof Error ? e.message : nomeDi(r.persona))
        }
      }
      if (fatte.length) await scarica(fatte)
      const esito = esitoDelMese(fatte.length, saltati)
      if (esito.guaio) throw new Error(esito.testo)
      avvisa(esito.testo)
    })
    setTutte(false)
    await dati.ricarica()
  }

  return (
    <div className="stack" style={{ gap: 18 }}>
      <Testa titolo="COMPENSI" sotto="Le ricevute dei tecnici, mese per mese: per ogni corso, ore confermate × la sua tariffa. Si stampano, si fanno firmare, si spunta «Firmata» quando tornano." />
      {avviso}
      <label className="stack" style={{ gap: 6, maxWidth: 240 }}>
        <span className="sg-etichetta">MESE</span>
        <select className="sg-campo" value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
          {periodi.map((x) => (
            <option key={x.chiave} value={x.chiave}>
              {x.nome}
            </option>
          ))}
        </select>
      </label>
      {dati.guaio && <Guaio testo={dati.guaio} />}
      {dati.dato && (
        <>
          {/* Sul telefono solo DA FARE e FERMI, affiancati: l'elenco comincia prima. */}
          <div className="sg-numeri" data-telefono-due>
            <Numero titolo="TECNICI" valore={righe.length} sotto="nel mese" />
            <Numero titolo="DA FARE" valore={daFare.length} sotto={`${euro(daFare.reduce((s, r) => s + r.conto.calcolato, 0))} €`} />
            <Numero titolo="FERMI" valore={fermi.length} sotto="da sistemare prima" allarme={fermi.length > 0} />
            <Numero titolo="DA PAGARE" valore={daPagare.length} sotto={`${euro(daPagare.reduce((s, r) => s + (r.ricevuta?.importo ?? 0), 0))} €`} />
          </div>
          {daFare.length > 0 && (
            <div className="row" style={{ gap: 14, flexWrap: 'wrap', alignItems: 'center', padding: '14px 16px', border: '2px solid var(--line-soft)' }}>
              <button type="button" className="sg-btn sg-btn-pieno" disabled={tutte} onClick={() => void preparaTutte()}>
                Prepara e stampa le ricevute ({daFare.length})
              </button>
              <span className="sg-sotto" style={{ flex: 1, minWidth: 240 }}>
                Un PDF solo con quelle da fare.
                {fermi.length > 0 && ` Salta ${fermi.map(saltato).join(', ')}.`}
              </span>
            </div>
          )}
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            {(
              [
                ['tutti', 'Tutti', righe.length],
                ['da-fare', 'Da fare', daFare.length],
                ['da-pagare', 'Da pagare', daPagare.length],
                ['da-firmare', 'Da riportare firmate', daFirmare.length],
              ] as const
            ).map(([id, testo, n]) => (
              <button key={id} type="button" className="num sg-chip" aria-pressed={filtro === id} onClick={() => setFiltro(id)}>
                {testo} {id !== 'tutti' && n > 0 ? `(${n})` : ''}
              </button>
            ))}
          </div>
          {visibili.length === 0 && <span className="sg-sotto">{righe.length ? 'Nessuno con questo filtro.' : `Nessun tecnico con lezioni in ${m.nome.toLowerCase()}.`}</span>}
          <div className="stack" style={{ gap: 0 }}>
            {visibili.map((r) => (
              <div key={r.persona.id} className="stack" style={{ gap: 4, borderBottom: '1px solid var(--line-soft)', padding: '10px 0' }}>
                <div className="row sg-compenso-riga" style={{ gap: 14, flexWrap: 'wrap', alignItems: 'center', minHeight: 48 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, minWidth: 160 }}>{nomeDi(r.persona)}</span>
                  <span className="num" style={{ fontSize: 15, fontWeight: 700, minWidth: 90 }}>{r.ricevuta || r.conto.calcolato ? `${euro(r.ricevuta?.importo ?? r.conto.calcolato)} €` : '—'}</span>
                  <span className="num" style={{ fontSize: 14, color: 'var(--sec)' }}>
                    {quante(r.conto.lezioni, 'lezione', 'lezioni')} · {quanteOre(r.conto.minuti)}
                  </span>
                  <span style={{ flex: 1, minWidth: 200 }}>
                    <SegnoCompenso stato={r.stato} conto={r.conto} ricevuta={r.ricevuta} manca={r.manca} />
                  </span>
                  {/* I tasti stanno fuori dal dettaglio: un clic su un tasto non apre né chiude i corsi. */}
                  <AzioniRicevuta d={d} p={r.persona} conto={r.conto} ricevuta={r.ricevuta} stato={r.stato} mese={mese} fai={fai} onCambiato={dati.ricarica} onPaga={puoPagare ? () => setPaga(r.persona) : undefined} />
                </div>
                {r.conto.righe.length > 0 && (
                  <details className="sg-compenso sg-compenso-per-corso">
                    <summary style={{ fontSize: 13, color: 'var(--sec)', minHeight: 44, display: 'flex', alignItems: 'center' }}>Per corso</summary>
                    {r.conto.righe.map((x) => (
                      <div key={x.corso} className="sg-compenso-corso" style={{ fontSize: 13, color: 'var(--sec)', padding: '2px 0 2px 16px' }}>
                        <span>{x.corso}</span>
                        <span className="num">{quanteOre(x.minuti)}</span>
                        {x.centesimiOra ? (
                          <span className="num">{euroOra(x.centesimiOra)}</span>
                        ) : (
                          <span className="sg-segno-regola" data-tono="rosso">
                            SENZA TARIFFA
                          </span>
                        )}
                        <span className="num" style={{ fontWeight: 700 }}>{x.importo !== undefined ? `${euro(x.importo)} €` : '—'}</span>
                      </div>
                    ))}
                  </details>
                )}
              </div>
            ))}
          </div>
          {paga && dati.dato && (
            <PannelloPaga
              key={paga.id}
              d={d}
              p={paga}
              ricevute={pagabili(dati.dato.ricevute, paga.id)}
              casse={dati.dato.casse}
              chiusure={dati.dato.chiusure}
              fai={fai}
              onFatto={async () => {
                setPaga(null)
                await dati.ricarica()
              }}
            />
          )}
          <span className="sg-sotto">Chi non ha lezioni confermate nel mese non c’è. Le lezioni da sostituto si pagano a chi c’era, con la sua tariffa per quel corso.</span>
        </>
      )}
    </div>
  )
}

/**
 * SEGNA PAGATO: una o più ricevute fatte e non pagate dello stesso tecnico,
 * il giorno e la cassa; diventano un'uscita sola in CONTABILITÀ con la voce
 * «Compensi istruttori». Prima di scrivere si vede il riepilogo.
 */
function PannelloPaga({
  d,
  p,
  ricevute,
  casse,
  chiusure,
  fai,
  onFatto,
}: {
  d: DatiSegreteria
  p: Persona
  ricevute: RicevutaCompenso[]
  casse: Cassa[]
  chiusure: ChiusuraCassa[]
  fai: Fai
  onFatto: () => Promise<void>
}) {
  const [scelte, setScelte] = useState<string[]>(ricevute.map((r) => r.id))
  const oggi = oggiARoma()
  const [data, setData] = useState(oggi)
  const conto = casse.find((c) => c.nome === NOME_CASSA_CONTO)
  const [cassaId, setCassaId] = useState(conto?.id ?? casse[0]?.id ?? '')
  const pagate = ricevute.filter((r) => scelte.includes(r.id))
  const totale = pagate.reduce((s, r) => s + r.importo, 0)
  const cassa = casse.find((c) => c.id === cassaId)
  const no = cosaNonVaPagamento({ ricevute: pagate, data, cassaId, casse, chiusure, oggi })
  return (
    <section className="stack" style={{ gap: 14, maxWidth: 820, padding: '22px 24px', border: '2px solid var(--text)' }} aria-label={`Segna pagato ${nomeDi(p)}`}>
      <span className="sg-etichetta" style={{ fontSize: 15 }}>
        SEGNA PAGATO · {nomeDi(p).toUpperCase()}
      </span>
      <span className="sg-etichetta">LE RICEVUTE CHE PAGHI</span>
      {ricevute.map((r) => (
        <label key={r.id} className="row" style={{ gap: 12, minHeight: 44, fontSize: 15 }}>
          <input
            type="checkbox"
            style={{ width: 24, height: 24, margin: 0, accentColor: 'var(--text)' }}
            checked={scelte.includes(r.id)}
            onChange={(e) => setScelte(e.target.checked ? [...scelte, r.id] : scelte.filter((x) => x !== r.id))}
          />
          <span style={{ flex: 1 }}>
            {dataLunga(r.mese).replace(/^1 /, '')} · fatta il {dataLunga(r.data)}
          </span>
          <span className="num" style={{ fontWeight: 700 }}>{euro(r.importo)} €</span>
        </label>
      ))}
      <span className="sg-sotto">Solo le sue ricevute fatte e non ancora pagate. Un bonifico che paga più mesi è un movimento solo.</span>
      <div className="sg-due sg-scheda-campi">
        <label className="stack" style={{ gap: 6 }}>
          <span className="sg-etichetta">DATA DEL PAGAMENTO</span>
          <input type="date" className="sg-campo" value={data} max={oggi} onChange={(e) => setData(e.target.value)} />
        </label>
        <div className="stack" style={{ gap: 6 }}>
          <span className="sg-etichetta">CASSA</span>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {casse.map((c) => (
              <button key={c.id} type="button" className="num sg-chip" aria-pressed={c.id === cassaId} onClick={() => setCassaId(c.id)}>
                {c.nome}
              </button>
            ))}
          </div>
        </div>
      </div>
      {pagate.length > 0 && cassa && (
        <div className="sg-due" style={{ padding: '14px 16px', border: '2px solid var(--line-soft)' }}>
          <span className="stack" style={{ gap: 2 }}>
            <span className="sg-etichetta">TIPO</span>Uscita
          </span>
          <span className="stack" style={{ gap: 2 }}>
            <span className="sg-etichetta">CASSA</span>
            {cassa.nome}
          </span>
          <span className="stack" style={{ gap: 2 }}>
            <span className="sg-etichetta">VOCE</span>
            {VOCE_COMPENSI}
          </span>
          <span className="stack" style={{ gap: 2 }}>
            <span className="sg-etichetta">IMPORTO</span>
            {euro(totale)} €
          </span>
          <span className="stack" style={{ gap: 2, gridColumn: 'span 2' }}>
            <span className="sg-etichetta">DESCRIZIONE</span>
            {descrizionePagamento(p.nome, p.cognome, pagate.map((r) => r.mese))}
          </span>
        </div>
      )}
      <span className="sg-sotto">Si scrive in CONTABILITÀ → MOVIMENTI collegato al tecnico, senza codice fiscale né IBAN. Se va annullato, si annulla da lì e le ricevute tornano da pagare.</span>
      {no && (
        <span role="alert" style={{ fontSize: 13, color: 'var(--rosso-testo)' }}>
          {no}.
        </span>
      )}
      <div className="row" style={{ gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <button type="button" className="sg-btn sg-btn-linea" onClick={() => void onFatto()}>
          Lascia stare
        </button>
        <button type="button" className="sg-btn sg-btn-pieno" disabled={!!no} onClick={() => void fai(() => d.pagaCompensi(pagate.map((r) => r.id), data, cassaId), `Pagato: ${euro(totale)} € in CONTABILITÀ`, onFatto)}>
          Segna pagato {euro(totale)} €
        </button>
      </div>
    </section>
  )
}
