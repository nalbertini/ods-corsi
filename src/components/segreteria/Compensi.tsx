import { useMemo, useState } from 'react'
import type { DatiSegreteria, Tariffa } from '../../lib/segreteria'
import { insegna } from '../../lib/ruoli'
import { chiaveGiorno, dataLunga } from '../../lib/sala'
import { euro } from '../../lib/ricevute'
import { mesi, oreItaliane as ore } from '../../lib/ore'
import { euroOra, centesimiDaEuro, euroDaScrivere } from '../../lib/tariffe'
import { cosaNonVaCompenso, datiPerRicevuta, mancaPerRicevuta, primoDelMese, righeCompensi, type ContoCompenso, type RicevutaCompenso, type StatoCompenso } from '../../lib/compensi'
import { chiedi, Guaio, Testa, useAvviso, useCarica } from './comune'
import { Numero } from './Presenze'

type Fai = ReturnType<typeof useAvviso>['fai']
type Persona = { id: string; nome: string; cognome: string }

const NOME_STATO: Record<StatoCompenso, { testo: string; tono: 'rosso' | 'giallo' | 'neutro' | 'verde' }> = {
  'da-confermare': { testo: 'PRESENZE DA CONFERMARE', tono: 'rosso' },
  'senza-tariffa': { testo: 'SENZA TARIFFA', tono: 'rosso' },
  'da-fare': { testo: 'RICEVUTA DA FARE', tono: 'neutro' },
  fatta: { testo: 'FATTA', tono: 'verde' },
  'non-torna': { testo: 'NON TORNA PIÙ', tono: 'rosso' },
}

const nomeDi = (p: Persona) => `${p.cognome} ${p.nome}`.trim()
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
}: {
  d: DatiSegreteria
  p: Persona
  conto: ContoCompenso
  ricevuta?: RicevutaCompenso
  stato: StatoCompenso
  mese: string
  fai: Fai
  onCambiato: () => Promise<unknown>
}) {
  const [cambia, setCambia] = useState<{ testo: string; motivo: string } | null>(null)
  const prepara = async (cambiato?: { importo: number; motivo: string }) => {
    const fatta: { r?: RicevutaCompenso } = {}
    const ok = await fai(async () => (fatta.r = await faiRicevuta(d, p, conto, mese, cambiato)), 'Ricevuta fatta', async () => {
      setCambia(null)
      await onCambiato()
    })
    // Prima si salva, poi si scarica: se il PDF non esce, la ricevuta c'è già e si ristampa.
    if (ok && fatta.r) void fai(() => scarica([fatta.r!]))
  }
  const annulla = async () => {
    if (!ricevuta) return
    if (!(await chiedi(`Annullare la ricevuta di ${nomeDi(p)}? Resta nel registro, annullata; poi se ne fa una nuova.`, 'Annulla la ricevuta', { pericolo: true }))) return
    void fai(() => d.annullaRicevutaCompenso(ricevuta.id), 'Ricevuta annullata', onCambiato)
  }

  if (cambia) {
    const importo = centesimiDaEuro(cambia.testo) ?? 0
    const no = cosaNonVaCompenso({ importo, calcolato: conto.calcolato, motivo: cambia.motivo })
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
          <button type="button" className="sg-btn sg-btn-pieno" disabled={!!no} onClick={() => void prepara({ importo, motivo: cambia.motivo })}>
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
        <button type="button" className="sg-btn sg-btn-linea sg-pericolo" onClick={() => void annulla()}>
          {stato === 'non-torna' ? 'Annulla e rifai' : 'Annulla'}
        </button>
      </span>
    )

  if (stato === 'da-fare')
    return (
      <span className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className="sg-btn sg-btn-linea" onClick={() => setCambia({ testo: euroDaScrivere(conto.calcolato), motivo: '' })}>
          Modifica il compenso
        </button>
        <button type="button" className="sg-btn sg-btn-pieno" onClick={() => void prepara()}>
          Prepara la ricevuta
        </button>
      </span>
    )
  return null
}

/** Il segno dello stato, in parole e col colore, e sotto cosa fare. */
export function SegnoCompenso({ stato, conto, ricevuta }: { stato: StatoCompenso; conto: ContoCompenso; ricevuta?: RicevutaCompenso }) {
  const s = NOME_STATO[stato]
  const frase =
    stato === 'da-confermare'
      ? `${conto.daConfermare} da confermare in PRESENZE ISTRUTTORI: prima si decidono, poi si fa la ricevuta.`
      : stato === 'senza-tariffa'
        ? `${conto.senzaTariffa.join(', ')} senza tariffa: si scrive nella scheda, in ISTRUTTORI E ACCESSI.`
        : stato === 'non-torna' && ricevuta
          ? `Ricevuta di ${euro(ricevuta.importo)} €: dopo è cambiata una presenza e il mese ora fa ${euro(conto.calcolato)} €.`
          : ricevuta
            ? `Fatta il ${dataLunga(ricevuta.data)}${ricevuta.motivo ? ` · cambiata a mano: ${ricevuta.motivo}` : ''}${ricevuta.firmata ? '' : ' · da riportare firmata'}`
            : ''
  return (
    <span className="stack" style={{ gap: 4, minWidth: 0 }}>
      <span className="sg-segno-regola" data-tono={s.tono}>
        {s.testo}
      </span>
      {frase && <span style={{ fontSize: 13, color: 'var(--sec)' }}>{frase}</span>}
    </span>
  )
}

type Filtro = 'tutti' | 'da-fare' | 'da-firmare'

/**
 * COMPENSI: il mese di tutti i tecnici. Una riga per chi ha lezioni
 * confermate, da confermare o una ricevuta di quel mese: per ogni corso le
 * ore per la tariffa, a che punto è, e i tasti. Le ricevute pronte si
 * preparano tutte insieme, in un PDF solo; chi non è pronto si salta e si dice
 * perché.
 */
export function Compensi({ d }: { d: DatiSegreteria }) {
  const periodi = useMemo(mesi, [])
  const [periodo, setPeriodo] = useState(periodi[1]?.chiave ?? periodi[0].chiave)
  const [filtro, setFiltro] = useState<Filtro>('tutti')
  const m = periodi.find((x) => x.chiave === periodo) ?? periodi[0]
  const mese = primoDelMese(m.da)
  const giorni = Math.ceil((Date.now() - m.da.getTime()) / 86_400_000) + 1
  const { avviso, fai } = useAvviso()
  const dati = useCarica(async () => {
    const [personale, presenze, senzaIstruttore, ricevute] = await Promise.all([d.personale(), d.presenzeIstruttori(giorni), d.lezioniSenzaIstruttore().catch(() => []), d.ricevuteCompensi()])
    const tecnici = personale.filter(insegna)
    const tariffe: Record<string, Tariffa[]> = Object.fromEntries(await Promise.all(tecnici.map(async (t) => [t.id, await d.tariffe(t.id)] as const)))
    return { tecnici, presenze, senzaIstruttore, ricevute, tariffe }
  }, [d, giorni])

  const righe = dati.dato ? righeCompensi({ ...dati.dato, mese: m }) : []
  const daFare = righe.filter((r) => r.stato === 'da-fare')
  const fermi = righe.filter((r) => r.stato === 'da-confermare' || r.stato === 'senza-tariffa' || r.stato === 'non-torna')
  const daFirmare = righe.filter((r) => r.ricevuta && !r.ricevuta.firmata)
  const visibili = filtro === 'da-fare' ? daFare : filtro === 'da-firmare' ? daFirmare : righe

  const preparaTutte = async () => {
    const fatte: RicevutaCompenso[] = []
    const saltati: string[] = fermi.map((r) => `${nomeDi(r.persona)} (${NOME_STATO[r.stato].testo.toLowerCase()})`)
    await fai(async () => {
      for (const r of daFare) {
        try {
          fatte.push(await faiRicevuta(d, r.persona, r.conto, mese))
        } catch (e) {
          saltati.push(e instanceof Error ? e.message : nomeDi(r.persona))
        }
      }
      if (fatte.length) await scarica(fatte)
      if (saltati.length) throw new Error(`${fatte.length ? `Fatte ${fatte.length}. ` : ''}Saltati: ${saltati.join('; ')}`)
    }, `Fatte ${daFare.length} ricevute`)
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
          <div className="sg-numeri">
            <Numero titolo="TECNICI" valore={righe.length} sotto="con lezioni nel mese" />
            <Numero titolo="DA FARE" valore={daFare.length} sotto={`${euro(daFare.reduce((s, r) => s + r.conto.calcolato, 0))} €`} />
            <Numero titolo="FERMI" valore={fermi.length} sotto="da sistemare prima" allarme={fermi.length > 0} />
            <Numero titolo="DA RIPORTARE" valore={daFirmare.length} sotto="firmate" />
          </div>
          {daFare.length > 0 && (
            <div className="row" style={{ gap: 14, flexWrap: 'wrap', alignItems: 'center', padding: '14px 16px', border: '2px solid var(--line-soft)' }}>
              <button type="button" className="sg-btn sg-btn-pieno" onClick={() => void preparaTutte()}>
                Prepara e stampa le ricevute ({daFare.length})
              </button>
              <span className="sg-sotto" style={{ flex: 1, minWidth: 240 }}>
                Un PDF solo con quelle da fare.
                {fermi.length > 0 && ` Salta ${fermi.map((r) => `${nomeDi(r.persona)} (${NOME_STATO[r.stato].testo.toLowerCase()})`).join(', ')}.`}
              </span>
            </div>
          )}
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            {(
              [
                ['tutti', 'Tutti', righe.length],
                ['da-fare', 'Da fare', daFare.length],
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
                <div className="row" style={{ gap: 14, flexWrap: 'wrap', alignItems: 'center', minHeight: 48 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, minWidth: 160 }}>{nomeDi(r.persona)}</span>
                  <span className="num" style={{ fontSize: 14, color: 'var(--sec)' }}>
                    {r.conto.lezioni} lezioni · {ore(r.conto.minuti)} ore
                  </span>
                  <span className="num" style={{ fontSize: 15, fontWeight: 700, minWidth: 90 }}>{r.ricevuta || r.conto.calcolato ? `${euro(r.ricevuta?.importo ?? r.conto.calcolato)} €` : '—'}</span>
                  <span style={{ flex: 1, minWidth: 200 }}>
                    <SegnoCompenso stato={r.stato} conto={r.conto} ricevuta={r.ricevuta} />
                  </span>
                  {/* I tasti stanno fuori dal dettaglio: un clic su un tasto non apre né chiude i corsi. */}
                  <AzioniRicevuta d={d} p={r.persona} conto={r.conto} ricevuta={r.ricevuta} stato={r.stato} mese={mese} fai={fai} onCambiato={dati.ricarica} />
                </div>
                {r.conto.righe.length > 0 && (
                  <details className="sg-compenso">
                    <summary style={{ fontSize: 13, color: 'var(--sec)', minHeight: 32 }}>Per corso</summary>
                    {r.conto.righe.map((x) => (
                      <div key={x.corso} className="row" style={{ gap: 14, fontSize: 13, color: 'var(--sec)', padding: '2px 0 2px 16px', flexWrap: 'wrap' }}>
                        <span style={{ minWidth: 160 }}>{x.corso}</span>
                        <span className="num">{ore(x.minuti)} ore</span>
                        <span className="num">{x.centesimiOra ? euroOra(x.centesimiOra) : 'SENZA TARIFFA'}</span>
                        <span className="num" style={{ fontWeight: 700 }}>{x.importo !== undefined ? `${euro(x.importo)} €` : '—'}</span>
                      </div>
                    ))}
                  </details>
                )}
              </div>
            ))}
          </div>
          <span className="sg-sotto">Chi non ha lezioni confermate nel mese non c’è. Le lezioni da sostituto si pagano a chi c’era, con la sua tariffa per quel corso.</span>
        </>
      )}
    </div>
  )
}
