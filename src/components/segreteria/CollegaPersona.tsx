import { useEffect, useRef, useState } from 'react'
import type { DatiSegreteria } from '../../lib/segreteria'
import { LIMITE_CAMBIO_VOCE, pacchetti, type RigaMovimento } from '../../lib/contabilita'
import { collegaTuttiISicuri, cosaNonVaCollegato, dividiStorico, type CandidatoPersona, type VoceStorico } from '../../lib/movimentiPersona'
import { dataRicevuta, euro } from '../../lib/ricevute'
import { bonificiDaAssegnare, euroAssegna } from '../../lib/assegna'
import { oggiARoma } from '../../lib/contabilita'
import { chiedi, dataLunga, Guaio, messaggio, useCarica, type useAvviso } from './comune'

type Fai = ReturnType<typeof useAvviso>['fai']
const soldi = (c: number) => `${euro(c)} €`

/**
 * Il collegamento dei casi sicuri dello storico (`70-movimenti-persona.sql`): il riepilogo, da confermare prima di
 * scrivere, poi i pacchetti da 500, e TOGLI QUESTO LOTTO. È solo un'etichetta: importi, casse e saldi non cambiano.
 */
export function CollegaSicuri({ d, onRileggi, onVediDaDecidere, onChiudi }: { d: DatiSegreteria; onRileggi: () => void; onVediDaDecidere: () => void; onChiudi: () => void }) {
  const riep = useCarica(() => d.riepilogoCollegamentiPersona(), [d])
  const [lavoro, setLavoro] = useState<number | null>(null)
  const [fermo, setFermo] = useState<string | null>(null)
  const [fatto, setFatto] = useState<{ collegati: number; lotto: string } | null>(null)
  const [tolti, setTolti] = useState<number | null>(null)
  const r = riep.dato
  const totale = r?.sicuri.movimenti ?? 0

  // Un lotto per riquadro: rifare il collegamento dopo un guaio resta nello stesso lotto, e TOGLI QUESTO LOTTO li toglie tutti.
  const lotto = useRef(crypto.randomUUID())
  const fatti = useRef(0)

  const collega = async () => {
    if (lavoro !== null || !r) return
    setFermo(null)
    setLavoro(fatti.current)
    const x = await collegaTuttiISicuri(d, lotto.current, totale, (n) => setLavoro(fatti.current + n))
    fatti.current += x.collegati
    setLavoro(null)
    onRileggi()
    void riep.ricarica()
    if (x.errore) setFermo(`Collegati ${fatti.current} su ${totale}. ${x.errore} Rifai il collegamento: quelli già fatti non si ripetono.`)
    // Anche a metà strada: quelli già collegati si possono togliere con il lotto.
    if (fatti.current > 0) setFatto({ collegati: fatti.current, lotto: lotto.current })
  }

  const rifai = () => {
    setFatto(null)
    void collega()
  }

  const togli = async () => {
    if (!fatto) return
    const si = await chiedi(
      `Togli il collegamento ai ${fatto.collegati} movimenti collegati poco fa? Quelli cambiati a mano dopo non si toccano. Importi e casse non cambiano.`,
      'Sì, togli questo lotto',
      { pericolo: true },
    )
    if (!si) return
    try {
      setTolti((await d.togliLottoCollegamenti(fatto.lotto)).tolti)
      onRileggi()
    } catch (e) {
      setFermo(messaggio(e, 'Non è cambiato niente: riprova.'))
    }
  }

  if (fatto)
    return (
      <section aria-label="Movimenti collegati" className="sg-riquadro">
        <span className="sg-etichetta" style={{ color: fermo && tolti === null ? 'var(--rosso-testo)' : undefined }}>
          {tolti !== null ? 'LOTTO TOLTO' : fermo ? 'NON È FINITO' : 'FATTO'}
        </span>
        <span className="sg-riquadro-titolo ob" role="status">
          {tolti === null ? `${fatto.collegati} COLLEGATI` : `${tolti} SCOLLEGATI`}
        </span>
        <span className="sg-sotto">
          {tolti === null
            ? 'I totali non sono cambiati. Ogni collegamento resta scritto: chi, quando, a quale persona.'
            : 'Sono tornati senza persona. Quelli collegati o cambiati a mano dopo sono rimasti dove sono.'}
        </span>
        {fermo && <div role="alert" className="sg-riquadro" style={{ borderColor: 'var(--rosso-testo)', fontSize: 15 }}>{fermo}</div>}
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          {tolti === null && fermo && <button type="button" className="sg-btn sg-btn-pieno" onClick={rifai}>Rifai il collegamento</button>}
          {tolti === null && !fermo && (r?.daDecidere.movimenti ?? 0) > 0 && (
            <button type="button" className="sg-btn sg-btn-pieno" onClick={onVediDaDecidere}>Vedi i da decidere · {r?.daDecidere.movimenti}</button>
          )}
          {tolti === null && <button type="button" className="sg-btn sg-btn-rosso" onClick={() => void togli()}>Togli questo lotto</button>}
          <button type="button" className="sg-btn sg-btn-linea" onClick={onChiudi}>Torna all’elenco</button>
        </div>
        {tolti === null && <span className="sg-sotto">TOGLI QUESTO LOTTO scollega solo i movimenti appena collegati. Quelli fatti a mano non si toccano.</span>}
      </section>
    )

  return (
    <section aria-label="Collega i casi sicuri" className="sg-riquadro">
      <span className="sg-etichetta">NIENTE SI SCRIVE FINCHÉ NON DICI SÌ</span>
      <span className="sg-riquadro-titolo ob">
        {!r
          ? 'COLLEGA I CASI SICURI'
          : totale === 0
            ? 'NIENTE DA COLLEGARE'
            : `COLLEGA ${totale} MOVIMENT${totale === 1 ? 'O' : 'I'} A ${r.sicuri.persone} PERSON${r.sicuri.persone === 1 ? 'A' : 'E'}`}
      </span>
      {riep.guaio && <Guaio testo={riep.guaio} />}
      {!r && !riep.guaio && <span className="sg-sotto">Sto contando…</span>}
      {r && totale === 0 && (
        <span className="sg-sotto" role="status">
          I movimenti col nome di una sola scheda sono già collegati{r.daDecidere.movimenti + r.senzaScheda.movimenti > 0 ? `; ne restano ${r.daDecidere.movimenti} da decidere e ${r.senzaScheda.movimenti} senza scheda` : ''}.
        </span>
      )}
      {r && totale > 0 && (
        <div className="stack" style={{ gap: 0 }}>
          {([
            ['MOVIMENTI', `${r.sicuri.movimenti} entrate dello storico · + ${soldi(r.sicuri.centesimi)}${r.sicuri.dal && r.sicuri.al ? ` · dal ${dataRicevuta(r.sicuri.dal)} al ${dataRicevuta(r.sicuri.al)}` : ''}`],
            ['COME', 'nome e cognome della causale uguali a quelli di una sola scheda, in qualunque ordine'],
            ...(r.campione.length ? [['UN CAMPIONE', r.campione.map((c) => `${c.causale.replace(/\s+/g, ' ').slice(0, 60)} → ${c.persona}`).join(' · ')] as const] : []),
            ['NON SI TOCCANO', `${r.daDecidere.movimenti} con più schede dello stesso nome (da decidere) · ${r.senzaScheda.movimenti} senza scheda · gli annullati${r.giaCollegati ? ` · ${r.giaCollegati} già collegati` : ''}`],
            ['CASSE E VOCI', 'non cambiano: saldi, bilancio e chiusure restano uguali'],
          ] as const).map(([k, v]) => (
            <div key={k} className="row" style={{ gap: 14, padding: '8px 0', borderBottom: '1px solid var(--line-soft)', alignItems: 'baseline' }}>
              <span className="sg-etichetta" style={{ width: 130, flexShrink: 0 }}>{k}</span>
              <span style={{ fontSize: 15, minWidth: 0, overflowWrap: 'anywhere' }}>{v}</span>
            </div>
          ))}
        </div>
      )}
      {totale > 0 && <span className="sg-sotto">È solo un’etichetta. Vanno a pacchetti da 500, ognuno tutto o niente. Se rifai il collegamento, i già collegati restano come sono. Un movimento già collegato a un’altra persona non si sposta da qui.</span>}
      {fermo && <div role="alert" className="sg-riquadro" style={{ borderColor: 'var(--rosso-testo)', fontSize: 15 }}>{fermo}</div>}
      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        {totale > 0 && (
          <button type="button" className="sg-btn sg-btn-pieno" disabled={lavoro !== null} onClick={() => void collega()}>
            {lavoro !== null ? `Collego… ${lavoro} su ${totale}` : `Sì, collega ${totale === 1 ? 'il movimento' : `i ${totale}`}`}
          </button>
        )}
        <button type="button" className="sg-btn sg-btn-linea" disabled={lavoro !== null} onClick={onChiudi}>
          {totale > 0 ? 'No, torna all’elenco' : 'Torna all’elenco'}
        </button>
      </div>
    </section>
  )
}

/** Una persona da scegliere: nome e cognome, e quel che distingue due omonimi. */
export function SchedaCandidata({ c, scelta, onScegli, nome = 'persona' }: { c: CandidatoPersona; scelta: boolean; onScegli: () => void; nome?: string }) {
  const dettagli = [
    c.annoNascita ? `nascita ${c.annoNascita}` : '',
    c.corsi.length ? c.corsi.join(', ') : '',
    c.iscrittoDal ? `iscrizione dal ${dataRicevuta(c.iscrittoDal)}` : '',
  ].filter(Boolean)
  return (
    <label className="sg-scelta-persona" data-scelta={scelta}>
      <input type="radio" name={nome} checked={scelta} onChange={onScegli} />
      <span className="stack" style={{ gap: 2, minWidth: 0 }}>
        <b style={{ fontSize: 16 }}>{c.cognome} {c.nome}</b>
        <span className="sg-sotto">{dettagli.length ? dettagli.join(' · ') : 'nessun dato in più sulla scheda'}</span>
      </span>
    </label>
  )
}

/** Le schede col nome scritto, da tre lettere: l'amministrazione non scorre le schede, ne cerca una. */
function useCercaPersone(d: DatiSegreteria, scritto: string): CandidatoPersona[] {
  const [trovati, setTrovati] = useState<CandidatoPersona[]>([])
  useEffect(() => {
    const t = scritto.trim()
    if (t.length < 3) {
      setTrovati([])
      return
    }
    let vivo = true
    const attesa = window.setTimeout(() => {
      d.cercaPagatori(t).then(
        (x) => vivo && setTrovati(x.map((p) => ({ ...p, corsi: [] }))),
        () => vivo && setTrovati([]),
      )
    }, 250)
    return () => {
      vivo = false
      window.clearTimeout(attesa)
    }
  }, [d, scritto])
  return trovati
}

/**
 * La persona di una quota o di un corso scritti a mano (nuovo movimento, cambio voce): si cerca per nome e se ne
 * sceglie una. La scelta resta in vista anche quando si cambia quel che si cerca.
 */
export function CampoPersona({ d, scelta, onScegli, manca }: { d: DatiSegreteria; scelta: CandidatoPersona | null; onScegli: (p: CandidatoPersona) => void; manca: string }) {
  const [scritto, setScritto] = useState('')
  const trovati = useCercaPersone(d, scritto)
  const offerte = scelta ? [scelta, ...trovati.filter((t) => t.id !== scelta.id)] : trovati
  return (
    <div className="stack" style={{ gap: 8 }}>
      <label className="stack" style={{ gap: 6 }}>
        <span className="sg-etichetta">PERSONA · DI CHI È</span>
        <input className="sg-campo" type="search" placeholder="Almeno tre lettere del nome o del cognome" value={scritto} onChange={(e) => setScritto(e.target.value)} />
      </label>
      {offerte.length > 0 && (
        <div className="stack" style={{ gap: 8 }} role="radiogroup" aria-label="Persona">
          {offerte.map((p) => <SchedaCandidata key={p.id} c={p} scelta={p.id === scelta?.id} onScegli={() => onScegli(p)} />)}
        </div>
      )}
      {scritto.trim().length >= 3 && trovati.length === 0 && !scelta && <span className="sg-sotto" role="status">Nessuna scheda con questo nome.</span>}
      {!scelta && <span style={{ fontSize: 14, color: 'var(--rosso-testo)' }}>{manca}</span>}
      <span className="sg-sotto">Si cerca da tre lettere. La quota va a chi frequenta, anche se ha pagato il genitore.</span>
    </div>
  )
}

/**
 * Collegare a mano uno o più movimenti scelti a una persona: per gli omonimi e per i movimenti che il blocco non ha preso.
 * Le persone offerte sono quelle col nome della causale del primo movimento; se non bastano, si cerca per nome.
 */
export function CollegaAPersona({ d, righe, fai, onFatto, onChiudi }: { d: DatiSegreteria; righe: RigaMovimento[]; fai: Fai; onFatto: () => void; onChiudi: () => void }) {
  const ids = righe.map((r) => r.id)
  const candidati = useCarica(() => d.candidatiPersonaMovimento(ids[0]), [d, ids[0]])
  const [scritto, setScritto] = useState('')
  const trovati = useCercaPersone(d, scritto)
  const [personaId, setPersonaId] = useState('')
  const [lavoro, setLavoro] = useState<number | null>(null)
  const guaio = righe.map((r) => cosaNonVaCollegato(r)).find(Boolean) ?? null
  const totale = righe.reduce((s, r) => s + r.importo, 0)

  const offerte = [...(candidati.dato ?? []), ...trovati.filter((t) => !(candidati.dato ?? []).some((c) => c.id === t.id))]
  const scelta = offerte.find((p) => p.id === personaId)
  const diAltri = righe.filter((r) => r.personaId && r.personaId !== personaId).length

  const collega = () => {
    if (!personaId || lavoro !== null) return
    let fatti = 0
    void fai(
      async () => {
        setLavoro(0)
        try {
          for (const lotto of pacchetti(ids)) {
            await d.collegaMovimentiPersona(lotto, personaId)
            fatti += lotto.length
            setLavoro(fatti)
          }
        } finally {
          setLavoro(null)
        }
      },
      `${ids.length === 1 ? 'Movimento collegato' : `${ids.length} movimenti collegati`} a ${scelta?.cognome ?? ''} ${scelta?.nome ?? ''}`.trim(),
      onFatto,
    )
  }

  return (
    <section aria-label="Collega a una persona" className="sg-riquadro">
      <span className="sg-etichetta">SCEGLI TU, L’APP NON INDOVINA</span>
      <span className="sg-riquadro-titolo ob">{ids.length} {ids.length === 1 ? 'MOVIMENTO' : 'MOVIMENTI'} · + {soldi(totale)}</span>
      {candidati.guaio && <Guaio testo={candidati.guaio} />}
      {offerte.length > 0 && (
        <div className="stack" style={{ gap: 8 }} role="radiogroup" aria-label="Persona">
          {offerte.map((p) => <SchedaCandidata key={p.id} c={p} scelta={p.id === personaId} onScegli={() => setPersonaId(p.id)} />)}
        </div>
      )}
      {candidati.dato && candidati.dato.length === 0 && <span className="sg-sotto">Nessuna scheda ha il nome della causale: cercala qui sotto.</span>}
      <label className="stack" style={{ gap: 6 }}>
        <span className="sg-etichetta">CERCA UN’ALTRA PERSONA</span>
        <input className="sg-campo" type="search" placeholder="Almeno tre lettere del nome o del cognome" value={scritto} onChange={(e) => setScritto(e.target.value)} />
      </label>
      <span className="sg-sotto">
        È solo un’etichetta: importo, data, cassa e voce non cambiano, anche nei giorni chiusi.
        {diAltri > 0 && personaId && ` ${diAltri} ${diAltri === 1 ? 'è già di un’altra persona e passa' : 'sono già di altre persone e passano'} a questa.`}
        {ids.length > LIMITE_CAMBIO_VOCE && ' Vanno a pacchetti da 500, ognuno tutto o niente.'}
      </span>
      {guaio && <span role="alert" style={{ fontSize: 14, color: 'var(--rosso-testo)' }}>{guaio}</span>}
      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className="sg-btn sg-btn-pieno" disabled={!personaId || !!guaio || lavoro !== null} onClick={collega}>
          {lavoro !== null ? `Collego… ${lavoro} su ${ids.length}` : `Collega${scelta ? ` a ${scelta.cognome} ${scelta.nome}` : ''}`}
        </button>
        <button type="button" className="sg-btn sg-btn-linea" disabled={lavoro !== null} onClick={onChiudi}>
          No, torna all’elenco
        </button>
      </div>
    </section>
  )
}

/**
 * Nella scheda di una persona: i movimenti di CONTABILITÀ a suo nome. Quelli scritti a mano (una quota, un corso)
 * stanno fra i pagamenti ma non si sommano: non sono ricevute, e la quota resta da pagare. Quelli del vecchio
 * programma stanno a parte: lo stesso incasso può comparire anche nei pagamenti dell'app, nei giorni in cui le due
 * cose si sono sovrapposte. Se non ce ne sono, il blocco non compare.
 */
const RIGHE_STORICO = 5
export function StoricoPersona({ d, personaId, onMovimento }: { d: DatiSegreteria; personaId: string; onMovimento?: (id: string) => void }) {
  const st = useCarica(() => d.storicoPersona(personaId), [d, personaId])
  const [tutte, setTutte] = useState(false)
  const { inContabilita, vecchioProgramma: righe } = dividiStorico(st.dato ?? [])
  // Pagamenti e ricevute di tutti (un bonifico si divide anche sui fratelli) si leggono solo se c'è un bonifico che può
  // averne bisogno: le schede senza bonifici non pagano la lettura.
  const oggi = oggiARoma()
  const candidati = bonificiDaAssegnare(st.dato ?? [], [], [], oggi).map((b) => b.movimentoId).join()
  const conti = useCarica(
    () => (candidati ? Promise.all([d.pagamentiDiretti(), d.ricevute()]) : Promise.resolve(null)),
    [d, candidati],
  )
  const daAssegnare = conti.dato ? bonificiDaAssegnare(st.dato ?? [], conti.dato[0], conti.dato[1], oggi) : []
  if (st.guaio) return <span className="sg-sotto" role="status">Lo storico dal vecchio programma non si legge: {st.guaio}</span>
  return (
    <>
      {conti.guaio && (
        <span className="sg-sotto" role="status">
          Non si riesce a controllare se ci sono bonifici da assegnare: {conti.guaio}
        </span>
      )}
      {daAssegnare.length > 0 && (
        <div className="sg-riquadro" data-avviso="true" role="note">
          {daAssegnare.map((x) => (
            <span key={x.movimentoId} className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: 14 }}>
              <span className="grow"><b className="num">{euroAssegna(x.daAssegnare)}</b> da assegnare dal bonifico del {dataRicevuta(x.data)}: finché non dici a cosa va, non conta come pagato.</span>
              {onMovimento && (
                <button type="button" className="num sg-chip" onClick={() => onMovimento(x.movimentoId)}>Assegna ›</button>
              )}
            </span>
          ))}
        </div>
      )}
      {inContabilita.length > 0 && (
        <section className="stack" style={{ gap: 8 }} aria-label="Scritti in contabilità">
          <span className="sg-etichetta" style={{ fontSize: 13, letterSpacing: '0.2em' }}>SCRITTI IN CONTABILITÀ · {inContabilita.length}</span>
          {inContabilita.map((r) => (
            <div key={r.id} className="sg-voce-elenco sg-pagamento" style={{ flexWrap: 'wrap' }}>
              <span className="stack grow" style={{ minWidth: 0, flex: '1 1 200px' }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{dataLunga(r.data)} · {r.cassa}</span>
                <span style={{ fontSize: 12, color: 'var(--dim)', overflowWrap: 'anywhere' }}>
                  {r.voce} · {r.descrizione}
                  <span className="num sg-tag" data-tipo="presto" style={{ marginLeft: 8 }}>Scritto in contabilità</span>
                </span>
              </span>
              <span className="num" style={{ fontSize: 18, fontWeight: 700, whiteSpace: 'nowrap', color: 'var(--verde-testo)' }}>{soldi(r.importo)}</span>
              {onMovimento && (
                <button type="button" className="num sg-chip" style={{ marginLeft: 'auto' }} onClick={() => onMovimento(r.id)}>
                  Apri in contabilità
                </button>
              )}
            </div>
          ))}
          <span className="sg-sotto">Non è una ricevuta. Un bonifico su quota o corsi conta per quello che resta da pagare solo quando lo assegni, dal movimento («Apri in contabilità»): da lì si fa anche la ricevuta.</span>
        </section>
      )}
      {righe.length > 0 && <StoricoVecchio righe={righe} tutte={tutte} onTutte={() => setTutte(!tutte)} />}
    </>
  )
}

function StoricoVecchio({ righe, tutte, onTutte }: { righe: VoceStorico[]; tutte: boolean; onTutte: () => void }) {
  // `storicoPersona` rende le righe dal più recente.
  const ultimo = righe[0].data
  const viste = tutte ? righe : righe.slice(0, RIGHE_STORICO)
  const totale = righe.reduce((s, r) => s + r.importo, 0)
  return (
    <section className="stack" style={{ gap: 8 }} aria-label="Dal vecchio programma">
      <span className="sg-etichetta" style={{ fontSize: 13, letterSpacing: '0.2em' }}>DAL VECCHIO PROGRAMMA · {righe.length}</span>
      <div role="note" className="sg-avviso-storico">
        <b>È lo storico fino al {dataRicevuta(ultimo)}.</b> Non è nei pagamenti qui sopra e non conta per «quota pagata» né per «pagato fino al». Se ha pagato anche nell’app negli stessi giorni, lo stesso incasso può comparire in tutti e due.
      </div>
      <div role="table" aria-label="Storico dal vecchio programma" className="sg-tabella">
        <div className="sg-tabella-corpo">
          {viste.map((r) => (
            <div key={r.id} role="row" className="sg-riga-storico">
              <span role="cell" className="sg-sotto">{dataRicevuta(r.data)}</span>
              <span role="cell" style={{ minWidth: 0, overflowWrap: 'anywhere', fontSize: 14, fontWeight: 600 }}>
                {r.descrizione}
                <span className="sg-sotto" style={{ display: 'block', fontWeight: 400 }}>{r.voce} · {r.cassa}</span>
              </span>
              <span role="cell" className="num" style={{ fontSize: 16, fontWeight: 700, textAlign: 'right' }}>{soldi(r.importo)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {righe.length > RIGHE_STORICO && (
          <button type="button" className="sg-btn sg-btn-linea" onClick={onTutte}>
            {tutte ? 'Mostra meno' : `Mostra altri ${righe.length - RIGHE_STORICO}`}
          </button>
        )}
        <span className="sg-sotto">versati in tutto {soldi(totale)} (solo storico)</span>
      </div>
    </section>
  )
}
