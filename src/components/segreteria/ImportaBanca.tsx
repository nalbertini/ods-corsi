import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { DatiSegreteria } from '../../lib/segreteria'
import { NOME_CASSA_CONTO, oggiARoma, vociOfferte, type Cassa, type RigaMovimento, type VoceContabile } from '../../lib/contabilita'
import { assegnaDaSoli, assegnaDopoIlCollegamento, euroAssegna } from '../../lib/assegna'
import { ChiEPerCosa } from './ChiEPerCosa'
import { abbinamentiImport, anteprimaBanca, contaRighe, copertiDaSalvare, datiImportBanca, filtraRighe, filtroIniziale, gruppiRighe, leggiBanca, PREFISSO_CHIAVE_BANCA, testoDaMostrare, MASSIMO_PER_IMPORTAZIONE, pianoDiAbbinamento, pianoDiAssegnazione, pianoDiClassificazione, ricevutaDellaPersona, sceltaDaFinestra, rigaComeMovimento, sceltaVuolePersona, scelteDaScrivere, segnaIncassiCoperti, ultimaImportazione, type AbbinamentoBanca, type FiltroRigheBanca, type GruppoRigheBanca, type LetturaBanca, type MovimentoBanca, type RigaAnteprima, type SceltaVoceBanca, type SegnoBanca } from '../../lib/importaBanca'
import { VOCE_DA_CLASSIFICARE } from '../../lib/importaPrimaNota'
import type { PersonaPerNome } from '../../lib/movimentiPersona'
import { parolaDelMovimento, suggerisciMovimento, type SuggerimentoMovimento } from '../../lib/suggerimentoMovimento'
import { useListino } from '../Costi'
import { erroreSegreteria } from '../../lib/chatSegreteria'
import { dataRicevuta, euro, type Ricevuta } from '../../lib/ricevute'
import { Icona } from '../Icons'
import { chiedi, Guaio, Segmenti, type useAvviso, Tasto, useBozza, useCarica } from './comune'

type Fai = ReturnType<typeof useAvviso>['fai']

const soldi = (c: number) => `${euro(c)} €`
const movimenti = (n: number) => (n === 1 ? '1 movimento' : `${n} movimenti`)

const SEGNI = [['entrambe', 'Entrambe'], ['entrate', 'Entrate'], ['uscite', 'Uscite']] as const satisfies readonly (readonly [SegnoBanca, string])[]
// «Da fare» per primo: è da lì che parte la pagina (vedi filtroIniziale).
const FILTRI: [FiltroRigheBanca, string, 'daFare' | 'duplicate' | 'scartate' | 'tutte'][] = [['da-fare', 'Da fare', 'daFare'], ['duplicate', 'Già nell’app', 'duplicate'], ['scartate', 'Scartate', 'scartate'], ['tutte', 'Tutte', 'tutte']]

/** Di un movimento già nell'app: quando, e il resto che la riga dice (la ricevuta, il tipo). */
// Un movimento importato prima ha come descrizione lo stesso testo della banca: ripeterlo non dice niente, si dicono la voce e da dove viene.
const daBanca = (v: RigaMovimento) => !!v.origineImport?.startsWith(PREFISSO_CHIAVE_BANCA)
const dettaglioVoce = (v: RigaMovimento) => [daBanca(v) ? 'importato dalla banca' : '', dataRicevuta(v.data), v.sotto].filter(Boolean).join(' · ')
const nomeVoce = (v: RigaMovimento) => (daBanca(v) ? v.voce : v.descrizione)

/**
 * «Importa dalla banca» in MOVIMENTI: si sceglie il CSV di BancoPosta, si guarda cosa entra senza che
 * niente si scriva, si decidono i casi dubbi, si sceglie la voce (e per quote e corsi la persona) e
 * solo dopo «Sì, importa» i movimenti vanno nel Conto Corrente. Le regole sono in `src/lib/importaBanca.ts`.
 */
export function ImportaBanca({ d, casse, voci, righe: tutte, fai, onRileggi, onVedi }: { d: DatiSegreteria; casse: Cassa[]; voci: VoceContabile[]; righe: RigaMovimento[]; fai: Fai; onRileggi: () => void; onVedi: () => void }) {
  // Le ricevute e i pagamenti a mano già coperti da una riga della banca non si propongono di nuovo
  // (prima del 114 la tabella non esiste: `bancaCoperti` dà null, e nell'oggetto non si confonde con «sto leggendo»).
  const coperti = useCarica(async () => ({ righe: await d.bancaCoperti() }), [d, tutte])
  const righe = useMemo(() => (coperti.dato ? segnaIncassiCoperti(tutte, coperti.dato.righe ?? []) : null), [tutte, coperti.dato])
  const [lettura, setLettura] = useState<LetturaBanca | null>(null)
  const [scelte, setScelte] = useState<Record<string, string>>({})
  const [scritti, setScritti] = useState<{ n: number; classificati: number; guasto: string | null; abbinati: string[]; nonAbbinati: string[]; senzaAbbinare: string | null; incassi: number; assegnati: number; daScegliere: number; senzaAssegnare: string | null } | null>(null)
  // Le ricevute libere a cui può andare un bonifico che entra con la persona; se non si leggono, si importa senza abbinare.
  const archivio = useCarica(async () => {
    const [ricevute, persone] = await Promise.all([d.ricevute(), d.persone()])
    return { ricevute, persone }
  }, [d, tutte])
  // Le righe a cui la segreteria ha tolto la ricevuta proposta: entrano senza, e restano in «Da assegnare».
  const [tolti, setTolti] = useState<Set<string>>(new Set())
  // Null finché la segreteria non sceglie: vale il filtro di partenza, che dipende dal file.
  const [filtro, setFiltro] = useState<FiltroRigheBanca | null>(null)
  const [segno, setSegno] = useState<SegnoBanca>('entrambe')
  // Le voci e le persone scelte a mano; senza, vale la proposta (sceltaProposta: la voce, e la persona se il nome nel testo è intero).
  const [vociScelte, setVociScelte] = useState<Record<string, SceltaVoceBanca>>({})
  // La riga di cui è aperta la finestra della persona.
  const [personaDi, setPersonaDi] = useState<string | null>(null)
  // Chi può aver pagato, dal solo nome nel testo: per parola cercata, perché più bonifici hanno lo stesso nome.
  const [pagatori, setPagatori] = useState<Record<string, PersonaPerNome[]>>({})
  const listino = useListino()
  const conto = casse.find((c) => c.nome === NOME_CASSA_CONTO)
  const ultima = useMemo(() => ultimaImportazione(tutte), [tutte])
  // Chi ha pagato lo dice il database (nome intero o genitore nel testo): una volta per movimento, poi si riordina.
  const [perGenitore, setPerGenitore] = useState<Record<string, string[]>>({})
  const chiesti = useRef(new Set<string>())
  const prima = useMemo(() => (lettura && conto && righe ? anteprimaBanca(lettura, righe, conto.id, oggiARoma(), scelte) : null), [lettura, righe, conto, scelte])
  useEffect(() => {
    // Ogni domanda consuma il tetto di ricerche del database (60 in 10 minuti, diviso col suggerimento in CONTABILITÀ): al massimo trenta per file, fra le due.
    for (const { movimento: m, candidati } of prima?.daDecidere ?? []) {
      if (chiesti.current.size >= 30) return
      if (chiesti.current.has(m.chiave) || m.tipo !== 'entrata') continue
      chiesti.current.add(m.chiave)
      d.abbinaTestoBanca(m.descrizione, candidati.map((c) => c.id))
        .then((r) => setPerGenitore((x) => ({ ...x, [m.chiave]: r.filter((y) => y.come === 'genitore').map((y) => y.movimentoId) })))
        // Senza risposta resta l'ordine per data: niente errore per un suggerimento.
        .catch(() => undefined)
    }
    for (const m of prima?.entrano ?? []) {
      if (chiesti.current.size >= 30 || !conto) return
      const parola = parolaDelMovimento(rigaComeMovimento(m, conto.id))
      if (!parola || chiesti.current.has(`nome:${parola}`)) continue
      chiesti.current.add(`nome:${parola}`)
      d.cercaPagatori(parola)
        .then((r) => setPagatori((x) => ({ ...x, [parola]: r })))
        // Senza risposta la persona si cerca a mano.
        .catch(() => undefined)
    }
  }, [d, prima, conto])
  const a = useMemo(() => (lettura && conto && righe ? anteprimaBanca(lettura, righe, conto.id, oggiARoma(), scelte, perGenitore) : null), [lettura, righe, conto, scelte, perGenitore])

  const proposte = useMemo(() => {
    const fuori: Record<string, SuggerimentoMovimento | null> = {}
    if (!a || !conto || !righe) return fuori
    for (const m of a.entrano) {
      const riga = rigaComeMovimento(m, conto.id)
      const parola = parolaDelMovimento(riga)
      fuori[m.chiave] = suggerisciMovimento(riga, righe, voci, parola ? pagatori[parola] ?? [] : [], listino?.listino)
    }
    return fuori
  }, [a, conto, righe, voci, pagatori, listino])
  const scelteValide = scelteDaScrivere(a?.entrano ?? [], vociScelte, proposte)
  const sceltaDi = (chiave: string): SceltaVoceBanca | null => scelteValide[chiave] ?? null
  // Prima di scrivere il piano si fa sulle chiavi: dice quante righe avranno la voce scelta.
  const previsto = a && conto ? pianoDiClassificazione(a.entrano, scelteValide, a.entrano.map((m) => ({ id: m.chiave, origineImport: m.chiave })), voci, conto.id) : null
  const classificate = previsto ? previsto.lotti.reduce((n, l) => n + l.ids.length, 0) : 0
  const ricevute = archivio.dato?.ricevute ?? []
  const persone = archivio.dato?.persone ?? []
  const abbinamenti = a && conto ? abbinamentiImport(a.entrano, scelteValide, ricevute, persone, voci, conto.id) : {}
  const conRicevuta = Object.entries(abbinamenti).filter(([k, x]) => x.esito === 'ricevuta' && !tolti.has(k)).length
  const ricevutaDi = (id: string) => ricevute.find((r) => r.id === id)
  const nomeDi = (id?: string) => {
    const p = persone.find((x) => x.id === id)
    return p ? `${p.nome} ${p.cognome}` : ''
  }
  useBozza(!!a && (Object.keys(vociScelte).length > 0 || Object.keys(scelte).length > 0), 'Importa dalla banca')
  const scegli = (chiave: string, x: Partial<SceltaVoceBanca>) => {
    const ora = sceltaDi(chiave)
    const voceId = x.voceId ?? ora?.voceId
    if (voceId) setVociScelte((s) => ({ ...s, [chiave]: { ...ora, ...x, voceId } }))
  }

  const scegliFile = async (file: File | undefined) => {
    if (!file) return
    setScelte({})
    setVociScelte({})
    setPersonaDi(null)
    setFiltro(null)
    setScritti(null)
    setTolti(new Set())
    // Un file che il browser non riesce a leggere si tratta come un file sbagliato: stesso messaggio, niente scritto.
    setLettura(leggiBanca(await file.text().catch(() => '')))
  }
  const importa = async () => {
    if (!a || !conto) return
    const dati = datiImportBanca(a)
    const conVoce = classificate ? `${classificate === dati.length ? 'tutti' : classificate} con la voce che hai scelto${classificate === dati.length ? '' : ', gli altri in «Da classificare»'}` : 'in «Da classificare»'
    const si = await chiedi(
      `Scrivo ${movimenti(dati.length)} nel Conto Corrente, ${conVoce}? ${a.daDecidere.length ? `I ${a.daDecidere.length} da decidere non entrano. ` : ''}Se cambi idea, «Annulla tutta l’importazione» li toglie in un colpo.`,
      `Sì, importa ${dati.length === 1 ? 'il movimento' : `i ${dati.length} movimenti`}`,
    )
    if (!si) return
    void fai(async () => {
      const n = await d.importaMovimentiBanca(dati)
      // I coperti si salvano dopo l'import: servono a ricontrollarli in «Cosa è entrato» con «Non è questo».
      try {
        await d.segnaCopertiBanca(copertiDaSalvare(a))
      } catch {
        // I nuovi sono già scritti: la pagina va riletta lo stesso, e rileggendo il file i già scritti tornano.
        setLettura(null)
        onRileggi()
        throw new Error(`${n === 1 ? "1 movimento importato" : `${n} movimenti importati`}, ma i già scritti non sono salvati: rileggi lo stesso file`)
      }
      // Le voci scelte si mettono dopo, sui movimenti appena scritti ritrovati dalla chiave: entrano tutti in «Da classificare» e poi si spostano.
      let classificati = 0
      let guasto: string | null = null
      const abbinati: string[] = []
      const nonAbbinati: string[] = []
      let senzaAbbinare: string | null = null
      let assegnati = 0
      let daScegliere = 0
      let senzaAssegnare: string | null = null
      if (classificate) {
        // Un lotto che non va resta in «Da classificare» e gli altri vanno avanti; il primo motivo si dice nel riepilogo.
        try {
          const scrittiOra = await d.movimenti()
          const piano = pianoDiClassificazione(a.entrano, scelteValide, scrittiOra, voci, conto.id)
          const messi = new Set<string>()
          for (const l of piano.lotti) {
            try {
              classificati += (await d.cambiaVoceMovimenti(l.ids, l.voceId, l.personaId)).cambiati
              l.ids.forEach((id) => messi.add(id))
            } catch (e) {
              guasto ??= erroreSegreteria(e)
            }
          }
          // Solo dopo la voce e la persona: l'abbinamento vuole il bonifico già collegato. Uno che non va non ferma gli altri.
          // Ricevute e persone rilette ora: una ricevuta fatta o legata altrove dopo l'anteprima cambia la proposta.
          let ora: { ricevute: Ricevuta[]; persone: typeof persone } | null = null
          try {
            const [r, p] = await Promise.all([d.ricevute(), d.persone()])
            ora = { ricevute: r, persone: p }
          } catch (e) {
            senzaAbbinare = erroreSegreteria(e)
          }
          const conRicevuta = new Set<string>()
          const oraAbbinamenti = ora ? abbinamentiImport(a.entrano, scelteValide, ora.ricevute, ora.persone, voci, conto.id) : {}
          for (const c of pianoDiAbbinamento(oraAbbinamenti, tolti, messi, scrittiOra)) {
            const r = ora?.ricevute.find((x) => x.id === c.ricevutaId)
            const mv = a.entrano.find((x) => x.chiave === c.chiave)
            if (!r || !mv) continue
            try {
              await d.abbinaRicevutaMovimento(c.movimentoId, c.ricevutaId)
              conRicevuta.add(c.movimentoId)
              abbinati.push(`n. ${r.numero}/${r.anno} di ${nomeDi(r.personaId)}`)
            } catch (e) {
              nonAbbinati.push(`${nomeDi(sceltaDi(c.chiave)?.personaId)}, ${soldi(mv.importo)} del ${dataRicevuta(mv.data)} (${erroreSegreteria(e)})`)
            }
          }
          // Quel che la finestra ha deciso si assegna così com'è; gli altri collegati senza ricevuta si assegnano da soli se è sicuro (sicuro.ts).
          const scelti = pianoDiAssegnazione(scelteValide, messi, conRicevuta, scrittiOra)
          const y = await assegnaDaSoli(d, scelti)
          if (y.errore) senzaAssegnare = y.errore
          const giaScelti = new Set(scelti.map((z) => z.movimentoId))
          const collegati = piano.lotti.filter((l) => !!l.personaId).flatMap((l) => l.ids).filter((id) => messi.has(id) && !conRicevuta.has(id) && !giaScelti.has(id))
          const x = await assegnaDopoIlCollegamento(d, collegati, oggiARoma())
          assegnati = y.chiavi.length + x.chiavi.length
          daScegliere = x.restano + (scelti.length - y.chiavi.length)
          if (x.errore) senzaAssegnare = x.errore
        } catch (e) {
          guasto ??= erroreSegreteria(e)
        }
      }
      setScritti({ n, classificati, guasto, abbinati, nonAbbinati, senzaAbbinare, incassi: a.entrano.filter((m) => m.tipo === 'entrata').length, assegnati, daScegliere, senzaAssegnare })
    }, undefined, () => {
      setLettura(null)
      onRileggi()
    })
  }
  const annullaLotto = async () => {
    if (!ultima) return
    const si = await chiedi(
      `Annullo i ${ultima.conteggio} movimenti importati dalla banca insieme? Li ritrovi in MOVIMENTI, in «Annullati». Rileggere il file non li riscrive.`,
      `Sì, annulla i ${ultima.conteggio}`,
      { pericolo: true },
    )
    if (!si) return
    void fai(async () => {
      const n = await d.annullaImportazioneBanca(ultima.creatoIl)
      setScritti(null)
      return n
    }, 'Importazione annullata', onRileggi)
  }

  const duplicate = a ? a.giaImportati.length + a.coperti.length : 0
  const conti = useMemo(() => contaRighe(a?.righe ?? [], segno), [a, segno])
  // Il filtro di partenza e «Niente di nuovo» guardano tutto il file: cambiando Entrate/Uscite la vista non salta da sola.
  const contiFile = useMemo(() => contaRighe(a?.righe ?? []), [a])
  const filtroVisto = filtro ?? filtroIniziale(contiFile)
  const gruppi = useMemo(() => gruppiRighe(filtraRighe(a?.righe ?? [], filtroVisto, segno)), [a, filtroVisto, segno])
  const nonLeggibile = lettura && lettura.movimenti.length === 0
  const troppi = !!a && a.entrano.length > MASSIMO_PER_IMPORTAZIONE
  const preselezionati = a ? a.daDecidere.filter((x) => x.preselezionato) : []
  const mvAperto = a?.entrano.find((m) => m.chiave === personaDi) ?? null

  return (
    <section aria-label="Importa dalla banca" className="stack" style={{ gap: 18 }}>
      {!conto && <p role="alert" style={{ color: 'var(--rosso-testo)' }}>Manca la cassa Conto Corrente: creala prima di importare.</p>}

      {scritti !== null && (
        <div className="sg-riquadro stack" role="status" style={{ gap: 12, padding: '18px 20px' }}>
          <span className="sg-etichetta">IMPORTAZIONE FATTA</span>
          <b style={{ fontSize: 20 }}>{movimenti(scritti.n).toUpperCase()} SCRITTI</b>
          <span style={{ fontSize: 15 }}>
            Sono nel <b>Conto Corrente</b>
            {scritti.classificati ? <>: <b>{scritti.classificati === 1 ? '1 ha' : `${scritti.classificati} hanno`} la voce che hai scelto</b>{scritti.n > scritti.classificati ? <>, {scritti.n - scritti.classificati === 1 ? 'l’altro è' : `gli altri ${scritti.n - scritti.classificati} sono`} in «Da classificare»: la voce la scegli dopo, con Cambia voce</> : ''}.</> : <>, in «Da classificare»: la voce la scegli dopo, con Cambia voce.</>}{' '}
            {scritti.senzaAbbinare ? null : scritti.abbinati.length ? <><b>{scritti.abbinati.length === 1 ? '1 bonifico è già con la sua ricevuta' : `${scritti.abbinati.length} bonifici sono già con la loro ricevuta`}</b> ({scritti.abbinati.join(', ')}){scritti.incassi > scritti.abbinati.length ? '; gli altri incassi non hanno ricevuta.' : '.'}</> : 'Gli incassi importati non hanno ricevuta.'}
          </span>
          {scritti.assegnati + scritti.daScegliere > 0 && (
            <span style={{ fontSize: 15 }}>
              {scritti.assegnati > 0 && <><b>{scritti.assegnati === 1 ? '1 bonifico è già assegnato' : `${scritti.assegnati} bonifici sono già assegnati`}</b> a quota e corsi, senza ricevuta: la ricevuta si fa dal movimento, quando serve. </>}
              {scritti.daScegliere > 0 && <>{scritti.daScegliere === 1 ? '1 bonifico con la persona resta' : `${scritti.daScegliere} bonifici con la persona restano`} in «Da assegnare»{scritti.senzaAssegnare ? '' : ': c’è da scegliere'}.</>}
            </span>
          )}
          {scritti.senzaAssegnare && (
            <span role="alert" className="sg-banca-avviso">
              <b>Non si sono assegnati da soli</b>: {scritti.senzaAssegnare}. Li trovi in «Da assegnare», dove si assegnano con un tocco.
            </span>
          )}
          {scritti.senzaAbbinare && (
            <span role="alert" className="sg-banca-avviso">
              <b>Le ricevute non si sono abbinate</b>: {scritti.senzaAbbinare}. I bonifici sono in «Da assegnare», con la persona: li abbini da lì.
            </span>
          )}
          {scritti.nonAbbinati.length > 0 && (
            <span role="alert" className="sg-banca-avviso">
              <b>{scritti.nonAbbinati.length === 1 ? '1 bonifico non si è abbinato' : `${scritti.nonAbbinati.length} bonifici non si sono abbinati`}</b>: {scritti.nonAbbinati.join('; ')}. {scritti.nonAbbinati.length === 1 ? 'È' : 'Sono'} in «Da assegnare».
            </span>
          )}
          {scritti.guasto && <span role="alert" style={{ fontSize: 15, color: 'var(--rosso-testo)' }}>Alcune voci non si sono messe: {scritti.guasto}</span>}
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <button type="button" className="sg-btn sg-btn-pieno" onClick={onVedi}>Guarda i movimenti</button>
          </div>
        </div>
      )}

      {ultima && (
        <div className="sg-riquadro" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: '10px 18px', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 15 }}>
            L’ultima importazione ha scritto <b>{movimenti(ultima.conteggio)}</b>, dal {dataRicevuta(ultima.dal)} al {dataRicevuta(ultima.al)}.
          </span>
          <Tasto tono="rosso" onClick={() => void annullaLotto()}>Annulla</Tasto>
        </div>
      )}

      <section aria-label="Il file" className="stack" style={{ gap: 12 }}>
        <div className="row" style={{ gap: 12, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <h2 className="sg-riquadro-titolo" style={{ margin: 0 }}>IL FILE DELLA BANCA</h2>
          {/* Prima del file è l'azione della pagina; dopo, il tasto principale è «Sì, importa». */}
          <label className={`sg-btn ${lettura ? 'sg-btn-linea' : 'sg-btn-pieno'}`} style={{ cursor: 'pointer' }}>
            Scegli file
            <input type="file" accept=".csv,.txt,text/csv,text/plain" className="vh" onChange={(e) => { void scegliFile(e.target.files?.[0]); e.target.value = '' }} />
          </label>
        </div>
        {a && lettura && !nonLeggibile && (
          <>
            <span style={{ fontSize: 15 }}>
              <b>{a.righe.length === 1 ? '1 riga' : `${a.righe.length} righe`}</b>{a.dal && a.al ? `, dal ${dataRicevuta(a.dal)} al ${dataRicevuta(a.al)}` : ''}:{' '}
              <b>{a.entrano.length} {a.entrano.length === 1 ? 'nuovo' : 'nuovi'}</b> + <b>{a.daDecidere.length} forse già nell’app</b> + <b>{duplicate} già nell’app</b> + <b>{a.scartate.length} {a.scartate.length === 1 ? 'scartata' : 'scartate'}</b>.
            </span>
            <div className="sg-saldi" role="group" aria-label="Totali di quello che entra">
              <Totale titolo="ENTRATE CHE ENTRANO" valore={`+ ${soldi(a.totali.entrate.importo)}`} sotto={movimenti(a.totali.entrate.conteggio)} />
              <Totale titolo="USCITE CHE ENTRANO" valore={`− ${soldi(a.totali.uscite.importo)}`} sotto={movimenti(a.totali.uscite.conteggio)} />
              <Totale titolo="DIFFERENZA" valore={`${a.totali.differenza < 0 ? '− ' : '+ '}${soldi(Math.abs(a.totali.differenza))}`} sotto="confrontala col saldo della banca" />
            </div>
            {a.avvisi.map((v) => (
              <span key={v.tipo} className="sg-banca-avviso">
                <b>{v.conteggio === 1 ? '1 versamento di contanti' : `${v.conteggio} versamenti di contanti`}</b> ({soldi(v.totale)}): controlla che non siano già nella cassa contanti.
              </span>
            ))}
          </>
        )}
        <span className="sg-sotto">CSV «Lista movimenti» di BancoPosta. Il file resta nel browser: arrivano solo i movimenti, senza IBAN né codice fiscale.</span>
      </section>

      {nonLeggibile && (
        <div role="alert" className="sg-riquadro stack" style={{ gap: 6, padding: '14px 18px', borderColor: 'var(--rosso-testo)' }}>
          <span className="sg-etichetta" style={{ color: 'var(--rosso-testo)' }}>QUESTO FILE NON È QUELLO GIUSTO</span>
          <span style={{ fontSize: 15 }}>{lettura.scartate[0]?.motivo ?? 'Non trovo movimenti nel file.'} Non è stato scritto niente.</span>
        </div>
      )}

      {lettura && !nonLeggibile && coperti.guaio && <Guaio testo={coperti.guaio} />}
      {lettura && !nonLeggibile && archivio.guaio && <Guaio testo={`Non riesco a leggere le ricevute: i bonifici entrano senza abbinarli. ${archivio.guaio}`} />}

      {a && lettura && !nonLeggibile && conto && (
        <>
          <section aria-label="Le righe del file" className="stack" style={{ gap: 12 }}>
            <h3 className="sg-riquadro-titolo" style={{ margin: 0 }}>LE RIGHE DEL FILE</h3>
            <div className="row" style={{ gap: 12, flexWrap: 'wrap', justifyContent: 'space-between' }}>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }} role="group" aria-label="Quali righe vedere">
                {FILTRI.map(([id, nome, n]) => (
                  <button key={id} type="button" className="num sg-chip" aria-pressed={filtroVisto === id} onClick={() => setFiltro(id)}>{nome} {conti[n]}</button>
                ))}
              </div>
              <Segmenti etichetta="Entrate o uscite" voci={SEGNI} scelta={segno} onScegli={setSegno} />
            </div>
            {contiFile.daFare === 0 && contiFile.duplicate > 0 && (
              <p role="status" className="sg-banca-avviso" data-tono="fatto" style={{ margin: 0 }}>
                <b>Niente di nuovo:</b> {contiFile.duplicate === 1 ? 'il movimento è già nell’app' : `i ${contiFile.duplicate} movimenti sono già nell’app`}. Li vedi qui sotto.
              </p>
            )}
            <div className="sg-banca-riga sg-banca-testa sg-etichetta" aria-hidden>
              <span>DATA</span>
              <span>DESCRIZIONE</span>
              <span>TIPOLOGIA</span>
              <span style={{ textAlign: 'right' }}>IMPORTO</span>
              <span>PERSONA</span>
            </div>
            {gruppi.map((g) => (
              <div key={g.gruppo} className="stack" role="group" aria-labelledby={`banca-gruppo-${g.gruppo}`}>
                <div className="sg-banca-gruppo" data-gruppo={g.gruppo}>
                  <b id={`banca-gruppo-${g.gruppo}`}>{NOME_GRUPPO[g.gruppo](g.righe.length).toUpperCase()}</b>
                  {g.gruppo === 'forse' && (
                    <span className="sg-banca-tasti">
                      {preselezionati.length > 0 && (
                        <Tasto tono="pieno" aria-label={`Conferma i ${preselezionati.length} dove nome e cognome sono nel testo`} onClick={() => setScelte((s) => ({ ...s, ...Object.fromEntries(preselezionati.flatMap((x) => (x.preselezionato ? [[x.movimento.chiave, x.preselezionato]] : []))) }))}>Conferma</Tasto>
                      )}
                      {g.righe.length > 1 && <Tasto aria-label={`Tutti nuovi: i ${g.righe.length} entrano come movimenti nuovi`} onClick={() => setScelte((s) => ({ ...s, ...Object.fromEntries(g.righe.flatMap((x) => (x.movimento ? [[x.movimento.chiave, 'nessuno']] : []))) }))}>Tutti nuovi</Tasto>}
                    </span>
                  )}
                </div>
                {g.righe.map((r) => (
                  <RigaBanca
                    key={`${r.riga}-${r.stato}`} r={r} voci={voci} contoId={conto.id} scelta={r.movimento ? sceltaDi(r.movimento.chiave) : null} sug={r.movimento ? proposte[r.movimento.chiave] ?? null : null}
                    abbina={r.movimento && abbinamenti[r.movimento.chiave] ? <Abbinamento a={abbinamenti[r.movimento.chiave]} tolto={tolti.has(r.movimento.chiave)} personaId={sceltaDi(r.movimento.chiave)?.personaId} ricevutaDi={ricevutaDi} nomeDi={nomeDi} dataDi={(k) => a.entrano.find((x) => x.chiave === k)?.data ?? ''}
                      onTogli={(via) => { const k = r.movimento!.chiave; setTolti((t) => { const n = new Set(t); if (via) n.add(k); else n.delete(k); return n }) }} /> : null}
                    onScegli={(x) => r.movimento && scegli(r.movimento.chiave, x)} onCollega={(id) => r.movimento && setScelte((s) => ({ ...s, [r.movimento!.chiave]: id }))} onPersona={() => r.movimento && setPersonaDi(r.movimento.chiave)}
                  />
                ))}
              </div>
            ))}
          </section>

          {troppi && <p role="alert" style={{ color: 'var(--rosso-testo)', margin: 0 }}>Sono più di {MASSIMO_PER_IMPORTAZIONE} movimenti nuovi: scarica dalla banca un periodo più corto e riprova.</p>}
          <div className="row" style={{ gap: 12, justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15 }} role="status">
              {a.entrano.length > 0 ? <><b>{classificate}</b> con la voce scelta · <b>{previsto?.restano ?? 0}</b> in «Da classificare»{conRicevuta > 0 && <> · <b>{conRicevuta}</b> con la ricevuta</>}</> : 'Niente da importare.'}
            </span>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <Tasto onClick={() => setLettura(null)}>Annulla</Tasto>
              <button type="button" className="sg-btn sg-btn-pieno" disabled={!a.entrano.length || troppi} onClick={() => void importa()}>
                {a.entrano.length === 1 ? 'Sì, importa il movimento' : a.entrano.length ? `Sì, importa i ${a.entrano.length} movimenti` : 'Sì, importa'}
              </button>
            </div>
          </div>
          {mvAperto && (
            <ChiEPerCosa
              d={d} data={mvAperto.data} testo={testoDaMostrare(mvAperto)} importo={mvAperto.importo}
              suggerite={(proposte[mvAperto.chiave]?.candidati ?? []).map((c) => ({ ...c, corsi: [] }))} personaIniziale={sceltaDi(mvAperto.chiave)?.personaId}
              ricevutaDi={(id) => ricevutaDi(ricevutaDellaPersona(mvAperto, id, ricevute, persone) ?? '')}
              onRicevuta={(_, p) => {
                const k = mvAperto.chiave
                setVociScelte((v) => ({ ...v, [k]: sceltaDaFinestra({ ...p, righe: [] }, voci, sceltaDi(k)?.voceId) }))
                setTolti((t) => { const n = new Set(t); n.delete(k); return n })
                setPersonaDi(null)
              }}
              onConferma={(x) => {
                const k = mvAperto.chiave
                setVociScelte((v) => ({ ...v, [k]: sceltaDaFinestra(x, voci, sceltaDi(k)?.voceId) }))
                // Ha diviso il bonifico: non va con una ricevuta già fatta.
                if (x.righe.length) setTolti((t) => new Set(t).add(k))
                setPersonaDi(null)
              }}
              onChiudi={() => setPersonaDi(null)}
            />
          )}
        </>
      )}
    </section>
  )
}

const NOME_GRUPPO: Record<GruppoRigheBanca, (n: number) => string> = {
  forse: (n) => `${n} forse già nell’app`,
  nuovi: (n) => (n === 1 ? '1 movimento nuovo' : `${n} movimenti nuovi`),
  gia: (n) => `${n} già nell’app`,
  scartate: (n) => (n === 1 ? '1 riga scartata' : `${n} righe scartate`),
}

/** La data e la descrizione come in pagina: il tipo d'operazione sopra, il testo senza codici. */
function Descrizione({ mv, nota }: { mv: MovimentoBanca; nota?: string }) {
  return (
    <span className="sg-banca-testo">
      {mv.operazione && <span className="sg-banca-operazione">{mv.operazione}</span>}
      {testoDaMostrare(mv)}
      {nota && <span className="sg-banca-nota">{nota}</span>}
    </span>
  )
}

/** Una riga del file: data, descrizione, poi secondo lo stato la tipologia e la persona, o il movimento dell'app che le corrisponde. I tasti sempre in fondo a destra. */
function RigaBanca({ r, voci, contoId, scelta, sug, abbina, onScegli, onCollega, onPersona }: {
  r: RigaAnteprima; voci: VoceContabile[]; contoId: string; scelta: SceltaVoceBanca | null; sug: SuggerimentoMovimento | null; abbina: ReactNode
  onScegli: (x: Partial<SceltaVoceBanca>) => void; onCollega: (id: string) => void; onPersona: () => void
}) {
  const mv = r.movimento
  const importo = <b className="num sg-banca-importo" data-tipo={mv?.tipo}>{mv ? `${mv.tipo === 'entrata' ? '+ ' : '− '}${soldi(mv.importo)}` : '—'}</b>
  if (!mv) {
    return (
      <div className="sg-banca-riga">
        <span className="num">Riga {r.riga}</span>
        <span className="sg-banca-testo">{r.motivo}<span className="sg-banca-nota" style={{ color: 'var(--dim)', overflowWrap: 'anywhere' }}>{r.testo}</span></span>
        <span />{importo}<span />
      </div>
    )
  }
  const data = <span className="num">{dataRicevuta(mv.data)}</span>
  if (r.stato === 'duplicata') {
    return (
      <div className="sg-banca-riga">
        {data}<Descrizione mv={mv} />
        <span className="sg-banca-voce">{r.voce && <><b>{nomeVoce(r.voce)}{r.voce.annullato ? ' (annullata)' : ''}</b><span className="sg-sotto">{dettaglioVoce(r.voce)}</span></>}</span>
        {importo}
        <span className="sg-banca-tasti">{r.rifiutabile && <Tasto aria-label={`Nuovo: ${testoDaMostrare(mv)} non è quello dell’app`} onClick={() => onCollega('nessuno')}>Nuovo</Tasto>}</span>
      </div>
    )
  }
  if (r.stato === 'da-decidere') {
    return (
      <div className="sg-banca-riga">
        {data}<Descrizione mv={mv} nota={r.motivo || undefined} />
        <span className="stack" style={{ gap: 8 }}>
          {r.candidati.map((c) => (
            <span key={c.id} className="sg-banca-voce sg-banca-alto"><b>{c.descrizione}</b><span className="sg-sotto">{dettaglioVoce(c)}</span></span>
          ))}
        </span>
        {importo}
        <span className="stack" style={{ gap: 8 }}>
          {r.candidati.map((c, i) => (
            <span key={c.id} className="sg-banca-tasti">
              <Tasto tono="pieno" aria-label={`Conferma: è ${c.descrizione}`} onClick={() => onCollega(c.id)}>Conferma</Tasto>
              {i === 0 ? <Tasto aria-label={`Nuovo: ${testoDaMostrare(mv)} non è già nell’app`} onClick={() => onCollega('nessuno')}>Nuovo</Tasto> : <span aria-hidden />}
            </span>
          ))}
        </span>
      </div>
    )
  }
  const offerte = vociOfferte(voci, mv.tipo)
  const voceId = scelta?.voceId ?? offerte.find((v) => v.nome === VOCE_DA_CLASSIFICARE)?.id ?? ''
  const voceOra = voci.find((v) => v.id === voceId)
  // Un'entrata da classificare può dire chi e per cosa: la tipologia viene da lì.
  const vuole = sceltaVuolePersona(mv, voceOra, contoId) || (mv.tipo === 'entrata' && voceOra?.nome === VOCE_DA_CLASSIFICARE)
  const candidato = sug?.candidati.find((c) => c.id === scelta?.personaId)
  const nome = scelta?.personaId ? scelta.nomePersona ?? (candidato ? `${candidato.nome} ${candidato.cognome}` : '') : ''
  return (
    <div className="sg-banca-riga">
      {data}
      <Descrizione mv={mv} nota={r.stato === 'da-controllare' ? 'Contanti: controlla che non siano già nella cassa contanti.' : undefined} />
      {scelta?.righe?.length ? (
        <span className="sg-sotto">{voceOra?.nome}</span>
      ) : (
        <select className="sg-campo" aria-label={`Tipologia di ${testoDaMostrare(mv)}`} value={voceId} onChange={(e) => onScegli({ voceId: e.target.value })}>
          {offerte.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
        </select>
      )}
      {importo}
      {vuole ? (
        <button type="button" className="sg-campo sg-banca-persona" data-manca={!nome} aria-haspopup="dialog" aria-label={nome ? `Persona: ${nome}, cambia` : `Chi ha pagato e per cosa: ${testoDaMostrare(mv)}`} onClick={onPersona}>
          <span className="stack" style={{ gap: 2, minWidth: 0 }}>
            <span>{nome || 'Chi e per cosa'}</span>
            {nome && scelta?.righe?.length ? <span className="sg-sotto">{scelta.righe.map((x) => `${x.voce} ${euroAssegna(x.importo)}`).join(' + ')}</span> : null}
          </span>
          <Icona nome="cerca" misura={16} />
        </button>
      ) : <span />}
      {abbina}
    </div>
  )
}

const dataBreve = (giorno: string) => dataRicevuta(giorno).slice(0, 5)

/** Sotto un bonifico che entra con la persona: la ricevuta già fatta a cui andrà, o perché non va a nessuna. */
function Abbinamento({ a, tolto, personaId, ricevutaDi, nomeDi, dataDi, onTogli }: {
  a: AbbinamentoBanca; tolto: boolean; personaId?: string; ricevutaDi: (id: string) => Ricevuta | undefined; nomeDi: (id?: string) => string; dataDi: (chiave: string) => string; onTogli: (via: boolean) => void
}) {
  const numeri = (ids: string[]) => ids.map((id) => ricevutaDi(id)).filter((r) => !!r)
  if (a.esito === 'piu') {
    const rr = numeri(a.ricevute).sort((x, y) => x.anno - y.anno || x.numero - y.numero)
    const n = rr.map((r) => `${r.numero}/${r.anno}`)
    return <><span className="sg-banca-abbina" data-tono="dubbio">{rr.length} ricevute possibili di {nomeDi(personaId)} (n. {n.slice(0, -1).join(', ')} e {n.at(-1)}): la scegli in «Da assegnare»</span><span /></>
  }
  if (a.esito === 'contesa') {
    const altro = a.con.length === 1 ? `il bonifico del ${dataBreve(dataDi(a.con[0]))}` : `altri ${a.con.length} bonifici`
    return <span className="sg-banca-abbina" data-tono="dubbio">Questo e {altro} vogliono la stessa ricevuta: la scegli in «Da assegnare»</span>
  }
  const r = ricevutaDi(a.ricevutaId)
  if (!r) return null
  const di = <>n. {r.numero}/{r.anno} di <b>{nomeDi(r.personaId)}</b>{r.personaId !== personaId ? ' (nucleo)' : ''}</>
  return (
    <>
      {tolto
        ? <span className="sg-banca-abbina" data-tono="tolto">Non la abbino: resta in «Da assegnare», ci pensi tu. (Ricevuta {di})</span>
        : <span className="sg-banca-abbina" data-tono="fatto">Va con la ricevuta {di}, {dataRicevuta(r.data)}, {soldi(r.pagato)}</span>}
      <span className="sg-banca-tasti">
        {tolto
          ? <Tasto aria-label={`Abbina alla ricevuta n. ${r.numero}/${r.anno}`} onClick={() => onTogli(false)}>Abbina</Tasto>
          : <Tasto tono="rosso" aria-label={`Togli la ricevuta n. ${r.numero}/${r.anno}`} onClick={() => onTogli(true)}>Togli</Tasto>}
      </span>
    </>
  )
}

function Totale({ titolo, valore, sotto }: { titolo: string; valore: string; sotto: string }) {
  return (
    <div className="sg-riquadro stack" style={{ gap: 2, padding: '12px 16px' }}>
      <span className="sg-etichetta">{titolo}</span>
      <b className="num" style={{ fontSize: 22 }}>{valore}</b>
      <span className="sg-sotto">{sotto}</span>
    </div>
  )
}
