import { useEffect, useMemo, useRef, useState } from 'react'
import type { DatiSegreteria } from '../../lib/segreteria'
import { NOME_CASSA_CONTO, oggiARoma, vociOfferte, type Cassa, type RigaMovimento, type VoceContabile } from '../../lib/contabilita'
import { anteprimaBanca, contaRighe, copertiDaSalvare, datiImportBanca, filtraRighe, leggiBanca, MASSIMO_PER_IMPORTAZIONE, pianoDiClassificazione, rigaComeMovimento, sceltaProposta, sceltaVuolePersona, scelteDaScrivere, ultimaImportazione, type FiltroRigheBanca, type LetturaBanca, type MovimentoBanca, type SceltaVoceBanca, type SegnoBanca, type StatoRigaBanca } from '../../lib/importaBanca'
import { VOCE_DA_CLASSIFICARE } from '../../lib/importaPrimaNota'
import type { PersonaPerNome } from '../../lib/movimentiPersona'
import { parolaDelMovimento, suggerisciMovimento, type SuggerimentoMovimento } from '../../lib/suggerimentoMovimento'
import { useListino } from '../Costi'
import { erroreSegreteria } from '../../lib/chatSegreteria'
import { CampoPersona, SchedaCandidata } from './CollegaPersona'
import { dataRicevuta, euro } from '../../lib/ricevute'
import { Icona } from '../Icons'
import type { NomeIcona } from '../../lib/icone'
import { chiedi, Segmenti, Tag, type useAvviso, Tasto, useBozza } from './comune'

type Fai = ReturnType<typeof useAvviso>['fai']

const soldi = (c: number) => `${euro(c)} €`
const movimenti = (n: number) => (n === 1 ? '1 movimento' : `${n} movimenti`)

const NOME_STATO: Record<StatoRigaBanca, string> = { nuova: 'NUOVA', 'da-controllare': 'DA CONTROLLARE', duplicata: 'DUPLICATA', 'da-decidere': 'DA DECIDERE', scartata: 'SCARTATA' }
const TONO_STATO: Record<StatoRigaBanca, 'manca' | 'aspetta' | 'fatto' | undefined> = { nuova: 'fatto', 'da-controllare': 'aspetta', duplicata: undefined, 'da-decidere': 'aspetta', scartata: 'manca' }
const SEGNI = [['entrambe', 'Entrambe'], ['entrate', 'Entrate'], ['uscite', 'Uscite']] as const satisfies readonly (readonly [SegnoBanca, string])[]
const FILTRI: [FiltroRigheBanca, string, 'tutte' | 'nuove' | 'duplicate' | 'daDecidere' | 'scartate'][] = [['tutte', 'Tutte', 'tutte'], ['nuove', 'Nuove', 'nuove'], ['duplicate', 'Duplicate', 'duplicate'], ['da-decidere', 'Da decidere', 'daDecidere'], ['scartate', 'Scartate', 'scartate']]

/** Di una voce già presente: quando, in che cassa, e il resto che la riga dice (la ricevuta, il tipo). */
const dettaglioVoce = (v: RigaMovimento, casse: Cassa[]) => ['·', dataRicevuta(v.data), casse.find((c) => c.id === v.cassaId)?.nome, v.sotto].filter(Boolean).join(' · ').replace('· · ', '· ')

/** Il tasto quadrato di 44 punti con la spunta verde: «È questa». */
function TastoIcona({ icona, nome, onClick }: { icona: NomeIcona; nome: string; onClick: () => void }) {
  const colore = 'var(--verde-testo)'
  return (
    <button type="button" aria-label={nome} title={nome} onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, flex: 'none', padding: 0, background: 'var(--bg)', border: `2px solid ${colore}`, borderRadius: 6, color: colore, cursor: 'pointer' }}>
      <Icona nome={icona} misura={20} tratto={2.5} />
    </button>
  )
}

/**
 * «Importa dalla banca» in MOVIMENTI: si sceglie il CSV di BancoPosta, si guarda cosa entra senza che
 * niente si scriva, si decidono i casi dubbi, si sceglie la voce (e per quote e corsi la persona) e
 * solo dopo «Sì, importa» i movimenti vanno nel Conto Corrente. Le regole sono in `src/lib/importaBanca.ts`.
 */
export function ImportaBanca({ d, casse, voci, righe, fai, onRileggi, onVedi }: { d: DatiSegreteria; casse: Cassa[]; voci: VoceContabile[]; righe: RigaMovimento[]; fai: Fai; onRileggi: () => void; onVedi: () => void }) {
  const [lettura, setLettura] = useState<LetturaBanca | null>(null)
  const [scelte, setScelte] = useState<Record<string, string>>({})
  const [scritti, setScritti] = useState<{ n: number; classificati: number; guasto: string | null } | null>(null)
  const [filtro, setFiltro] = useState<FiltroRigheBanca>('tutte')
  const [segno, setSegno] = useState<SegnoBanca>('entrambe')
  // Le voci e le persone scelte a mano; senza, vale il suggerimento (la voce sì, la persona solo confermata).
  const [vociScelte, setVociScelte] = useState<Record<string, SceltaVoceBanca>>({})
  const [aperta, setAperta] = useState<string | null>(null)
  // Chi può aver pagato, dal solo nome nel testo: per parola cercata, perché più bonifici hanno lo stesso nome.
  const [pagatori, setPagatori] = useState<Record<string, PersonaPerNome[]>>({})
  const listino = useListino()
  const conto = casse.find((c) => c.nome === NOME_CASSA_CONTO)
  const ultima = useMemo(() => ultimaImportazione(righe), [righe])
  // Chi ha pagato lo dice il database (nome intero o genitore nel testo): una volta per movimento, poi si riordina.
  const [perGenitore, setPerGenitore] = useState<Record<string, string[]>>({})
  const chiesti = useRef(new Set<string>())
  const prima = useMemo(() => (lettura && conto ? anteprimaBanca(lettura, righe, conto.id, oggiARoma(), scelte) : null), [lettura, righe, conto, scelte])
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
  const a = useMemo(() => (lettura && conto ? anteprimaBanca(lettura, righe, conto.id, oggiARoma(), scelte, perGenitore) : null), [lettura, righe, conto, scelte, perGenitore])

  const proposte = useMemo(() => {
    const fuori: Record<string, SuggerimentoMovimento | null> = {}
    if (!a || !conto) return fuori
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
    setAperta(null)
    setFiltro('tutte')
    setScritti(null)
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
      if (classificate) {
        // Un lotto che non va resta in «Da classificare» e gli altri vanno avanti; il primo motivo si dice nel riepilogo.
        try {
          const piano = pianoDiClassificazione(a.entrano, scelteValide, await d.movimenti(), voci, conto.id)
          for (const l of piano.lotti) {
            try {
              classificati += (await d.cambiaVoceMovimenti(l.ids, l.voceId, l.personaId)).cambiati
            } catch (e) {
              guasto ??= erroreSegreteria(e)
            }
          }
        } catch (e) {
          guasto ??= erroreSegreteria(e)
        }
      }
      setScritti({ n, classificati, guasto })
    }, undefined, () => {
      setLettura(null)
      onRileggi()
    })
  }
  const annullaLotto = async () => {
    if (!ultima) return
    const si = await chiedi(
      `Annullo i ${ultima.conteggio} movimenti importati dalla banca insieme? Li ritrovi in «Mostra annullati». Rileggere il file non li riscrive.`,
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
  const nonLeggibile = lettura && lettura.movimenti.length === 0
  const troppi = !!a && a.entrano.length > MASSIMO_PER_IMPORTAZIONE

  return (
    <section aria-label="Importa dalla banca" className="stack" style={{ gap: 18 }}>
      {scritti === null && <span className="sg-etichetta">NIENTE SI SCRIVE FINCHÉ NON DICI SÌ</span>}
      <h2 className="sg-riquadro-titolo" style={{ margin: 0 }}>IL FILE DELLA BANCA</h2>
      {!conto && <p role="alert" style={{ color: 'var(--rosso-testo)' }}>Manca la cassa Conto Corrente: creala prima di importare.</p>}

      {scritti !== null && (
        <div className="sg-riquadro stack" role="status" style={{ gap: 12, padding: '18px 20px' }}>
          <span className="sg-etichetta">IMPORTAZIONE FATTA</span>
          <b style={{ fontSize: 20 }}>{movimenti(scritti.n).toUpperCase()} SCRITTI</b>
          <span style={{ fontSize: 15 }}>
            Sono nel <b>Conto Corrente</b>
            {scritti.classificati ? <>: <b>{scritti.classificati === 1 ? '1 ha' : `${scritti.classificati} hanno`} la voce che hai scelto</b>{scritti.n > scritti.classificati ? <>, {scritti.n - scritti.classificati === 1 ? 'l’altro è' : `gli altri ${scritti.n - scritti.classificati} sono`} in «Da classificare»: la voce la scegli dopo, con Cambia voce</> : ''}.</> : <>, in «Da classificare»: la voce la scegli dopo, con Cambia voce.</>}{' '}
            Gli incassi importati non hanno ricevuta.
          </span>
          {scritti.guasto && <span role="alert" style={{ fontSize: 15, color: 'var(--rosso-testo)' }}>Alcune voci non si sono messe: {scritti.guasto}</span>}
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <button type="button" className="sg-btn sg-btn-pieno" onClick={onVedi}>Guarda i movimenti</button>
          </div>
        </div>
      )}

      {ultima && (
        <div className="sg-riquadro stack" style={{ gap: 10, padding: '14px 18px' }}>
          <span style={{ fontSize: 15 }}>
            L’ultima importazione ha scritto <b>{movimenti(ultima.conteggio)}</b>, dal {dataRicevuta(ultima.dal)} al {dataRicevuta(ultima.al)}.
          </span>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <Tasto tono="rosso" onClick={() => void annullaLotto()}>Annulla tutta l’importazione</Tasto>
          </div>
        </div>
      )}

      <div className="stack" style={{ gap: 8 }}>
        <label className="sg-btn sg-btn-pieno" style={{ alignSelf: 'flex-start', cursor: 'pointer' }}>
          {lettura ? 'Scegli un altro file' : 'Scegli il file della banca'}
          <input type="file" accept=".csv,.txt,text/csv,text/plain" className="vh" onChange={(e) => { void scegliFile(e.target.files?.[0]); e.target.value = '' }} />
        </label>
        <span className="sg-sotto">Dall’home banking di BancoPosta scarica «Lista movimenti» in formato CSV. Il file resta nel tuo browser: arrivano al database solo i movimenti, senza IBAN né codice fiscale.</span>
      </div>

      {nonLeggibile && (
        <div role="alert" className="sg-riquadro stack" style={{ gap: 6, padding: '14px 18px', borderColor: 'var(--rosso-testo)' }}>
          <span className="sg-etichetta" style={{ color: 'var(--rosso-testo)' }}>QUESTO FILE NON È QUELLO GIUSTO</span>
          <span style={{ fontSize: 15 }}>{lettura.scartate[0]?.motivo ?? 'Non trovo movimenti nel file.'} Non è stato scritto niente.</span>
        </div>
      )}

      {a && lettura && !nonLeggibile && (
        <>
          <span style={{ fontSize: 15 }}>
            Il file ha <b>{movimenti(a.lette)}</b>{a.dal && a.al ? `, dal ${dataRicevuta(a.dal)} al ${dataRicevuta(a.al)}` : ''}.{' '}
            <b>{a.entrano.length === 1 ? '1 entra' : `${a.entrano.length} entrano`}</b>, <b>{duplicate === 1 ? '1 è duplicata' : duplicate === 0 ? 'nessuna è duplicata' : `${duplicate} sono duplicate`}</b>
            {a.daDecidere.length > 0 && <>, <b>{a.daDecidere.length === 1 ? 'uno lo decidi tu' : `${a.daDecidere.length} li decidi tu`}</b></>}. Entrano nel Conto Corrente, in «Da classificare».
          </span>
          <div className="sg-saldi" role="group" aria-label="Totali di quello che entra">
            <Totale titolo="ENTRATE CHE ENTRANO" valore={`+ ${soldi(a.totali.entrate.importo)}`} sotto={movimenti(a.totali.entrate.conteggio)} />
            <Totale titolo="USCITE CHE ENTRANO" valore={`− ${soldi(a.totali.uscite.importo)}`} sotto={movimenti(a.totali.uscite.conteggio)} />
            <Totale titolo="DIFFERENZA" valore={`${a.totali.differenza < 0 ? '− ' : '+ '}${soldi(Math.abs(a.totali.differenza))}`} sotto="confrontala col saldo della banca" />
          </div>

          {a.avvisi.length > 0 && (
            <section aria-label="Avvisi" className="sg-riquadro stack" style={{ gap: 8, padding: '14px 18px' }}>
              <span className="sg-etichetta" style={{ color: 'var(--giallo-testo)' }}>AVVISI · ENTRANO, MA CONTROLLALI</span>
              {a.avvisi.map((v) => (
                <span key={v.tipo} style={{ fontSize: 15 }}>
                  <b>{v.conteggio === 1 ? '1 versamento di contanti' : `${v.conteggio} versamenti di contanti`}</b> ({soldi(v.totale)}): controlla che non siano già nella cassa contanti.
                </span>
              ))}
            </section>
          )}

          <section aria-label="Le righe del file" className="stack" style={{ gap: 10 }}>
            <h3 className="sg-riquadro-titolo" style={{ margin: 0 }}>LE RIGHE DEL FILE</h3>
            <span style={{ fontSize: 15 }}>
              Ogni riga del file, nell’ordine del file. La tipologia parte dal suggerimento o da «Da classificare»; la persona serve a quote e corsi, si propone dal nome nel testo e la confermi tu.
            </span>
            <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }} role="group" aria-label="Quali righe vedere">
                {FILTRI.map(([id, nome, n]) => (
                  <button key={id} type="button" className="num sg-chip" aria-pressed={filtro === id} onClick={() => setFiltro(id)}>{nome} · {conti[n]}</button>
                ))}
              </div>
              <Segmenti etichetta="Entrate o uscite" voci={SEGNI} scelta={segno} onScegli={setSegno} />
            </div>
            <div className="sg-banca-riga sg-banca-testa sg-etichetta" aria-hidden>
              <span>COSA SUCCEDE</span>
              <span>DATA</span>
              <span>NEL FILE</span>
              <span>TIPOLOGIA</span>
              <span>PERSONA</span>
              <span style={{ textAlign: 'right' }}>IMPORTO</span>
            </div>
            {filtraRighe(a.righe, filtro, segno).map((r) => {
              const mv = r.movimento
              const nuova = mv && (r.stato === 'nuova' || r.stato === 'da-controllare')
              return (
              <div key={`${r.riga}-${r.stato}`} className="sg-banca-riga">
                <span><Tag tipo={TONO_STATO[r.stato]}>{NOME_STATO[r.stato]}</Tag></span>
                <span className="num">{mv ? dataRicevuta(mv.data) : `Riga ${r.riga}`}</span>
                <span style={{ overflowWrap: 'anywhere', minWidth: 0 }}>{mv ? mv.descrizione : <>{r.motivo} <span className="sg-sotto">({r.testo})</span></>}</span>
                {nuova && conto ? (
                  <VoceEPersona
                    mv={mv} contoId={conto.id} voci={voci} scelta={sceltaDi(mv.chiave)} sug={proposte[mv.chiave] ?? null}
                    aperta={aperta === mv.chiave} onApri={(si) => setAperta(si ? mv.chiave : null)} onScegli={(x) => scegli(mv.chiave, x)}
                  />
                ) : (
                  <div className="sg-banca-oltre stack" style={{ gap: 8 }}>
                    {r.stato === 'duplicata' && r.voce && mv && (
                      <div className="row" style={{ gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="stack" style={{ gap: 2, minWidth: 0 }}>
                          <span className="sg-etichetta">GIÀ SCRITTA COME</span>
                          <span><b>{r.voce.descrizione}</b>{r.voce.annullato ? ' (annullata)' : ''} <span className="sg-sotto">{dettaglioVoce(r.voce, casse)}</span></span>
                        </span>
                        {r.rifiutabile && <Tasto onClick={() => setScelte((s) => ({ ...s, [mv.chiave]: 'nessuno' }))}>È nuova</Tasto>}
                      </div>
                    )}
                    {r.stato === 'da-decidere' && mv && (
                      <>
                        {r.candidati.map((c) => (
                          <div key={c.id} className="row" style={{ gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="stack" style={{ gap: 2, minWidth: 0 }}>
                              <span className="sg-etichetta">POTREBBE ESSERE</span>
                              <span><b>{c.descrizione}</b> <span className="sg-sotto">{dettaglioVoce(c, casse)}{c.id === r.preselezionato ? ` · sembra questa: ${r.come[c.id] === 'genitore' ? 'il genitore ha il nome che c’è nel testo' : 'nome e cognome sono nel testo'}` : ''}</span></span>
                            </span>
                            <TastoIcona icona="conferma" nome={`È questa: collega il movimento a ${c.descrizione}`} onClick={() => setScelte((s) => ({ ...s, [mv.chiave]: c.id }))} />
                          </div>
                        ))}
                        <div><Tasto onClick={() => setScelte((s) => ({ ...s, [mv.chiave]: 'nessuno' }))}>È nuova</Tasto></div>
                      </>
                    )}
                  </div>
                )}
                <b className="num sg-banca-importo" style={{ textAlign: 'right' }}>{mv ? `${mv.tipo === 'entrata' ? '+ ' : '− '}${soldi(mv.importo)}` : '—'}</b>
                {nuova && conto && aperta === mv.chiave && (
                  <div className="sg-banca-aperta sg-riquadro stack" style={{ gap: 12, padding: '14px 16px' }}>
                    {(proposte[mv.chiave]?.candidati.length ?? 0) > 1 && (
                      <div className="stack" style={{ gap: 8 }} role="radiogroup" aria-label="Le schede col nome del testo">
                        {proposte[mv.chiave]?.candidati.map((c) => (
                          <SchedaCandidata key={c.id} c={{ ...c, corsi: [] }} nome={`banca-${mv.chiave}`} scelta={c.id === sceltaDi(mv.chiave)?.personaId} onScegli={() => { scegli(mv.chiave, { personaId: c.id, nomePersona: `${c.nome} ${c.cognome}` }); setAperta(null) }} />
                        ))}
                      </div>
                    )}
                    <CampoPersona d={d} scelta={null} manca="" onScegli={(p) => { scegli(mv.chiave, { personaId: p.id, nomePersona: `${p.nome} ${p.cognome}` }); setAperta(null) }} />
                    <div><Tasto onClick={() => setAperta(null)}>Chiudi</Tasto></div>
                  </div>
                )}
              </div>
            )})}
          </section>

          {a.daDecidere.length > 0 && (
            <section aria-label="Conferma" className="stack" style={{ gap: 10 }}>
              <span className="sg-etichetta" style={{ color: 'var(--giallo-testo)' }}>{a.daDecidere.length} DA DECIDERE · NON ENTRANO FINCHÉ NON SCEGLI</span>
              <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
                {a.daDecidere.some((x) => x.preselezionato) && (
                  <button type="button" className="sg-btn sg-btn-pieno" onClick={() => setScelte((s) => ({ ...s, ...Object.fromEntries(a.daDecidere.flatMap((x) => (x.preselezionato ? [[x.movimento.chiave, x.preselezionato]] : []))) }))}>Conferma quelli che sembrano giusti ({a.daDecidere.filter((x) => x.preselezionato).length})</button>
                )}
                {a.daDecidere.length > 1 && (
                  <button type="button" className="sg-btn sg-btn-linea" onClick={() => setScelte((s) => ({ ...s, ...Object.fromEntries(a.daDecidere.map((x) => [x.movimento.chiave, 'nessuno'])) }))}>Nessuno è già scritto: scrivili tutti e {a.daDecidere.length}</button>
                )}
              </div>
            </section>
          )}

          <div className="stack" style={{ gap: 8 }}>
            {a.entrano.length > 0 && (
              <span style={{ fontSize: 15 }} role="status">
                <b>{classificate === 1 ? '1 riga ha' : `${classificate} righe hanno`}</b> la voce scelta (e la persona, dove serve); <b>{previsto?.restano === 1 ? '1 resta' : `${previsto?.restano ?? 0} restano`} in «Da classificare»</b>: le sistemi dopo, con Cambia voce.
              </span>
            )}
            {troppi && <p role="alert" style={{ color: 'var(--rosso-testo)' }}>Sono più di {MASSIMO_PER_IMPORTAZIONE} movimenti nuovi: scarica dalla banca un periodo più corto e riprova.</p>}
            <span className="sg-sotto">Se rileggi lo stesso file, i movimenti già importati non si scrivono di nuovo.</span>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <button type="button" className="sg-btn sg-btn-pieno" disabled={!a.entrano.length || troppi} onClick={() => void importa()}>
                {a.entrano.length === 1 ? 'Sì, importa il movimento' : `Sì, importa i ${a.entrano.length} movimenti`}
              </button>
              <Tasto onClick={() => setLettura(null)}>Annulla</Tasto>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

/** La tipologia e, per una quota o un corso, la persona di una riga nuova. */
function VoceEPersona({ mv, contoId, voci, scelta, sug, aperta, onApri, onScegli }: {
  mv: MovimentoBanca; contoId: string; voci: VoceContabile[]; scelta: SceltaVoceBanca | null; sug: SuggerimentoMovimento | null
  aperta: boolean; onApri: (si: boolean) => void; onScegli: (x: Partial<SceltaVoceBanca>) => void
}) {
  const offerte = vociOfferte(voci, mv.tipo)
  const daClassificare = offerte.find((v) => v.nome === VOCE_DA_CLASSIFICARE)
  const voceId = scelta?.voceId ?? daClassificare?.id ?? ''
  const voce = voci.find((v) => v.id === voceId)
  const vuole = sceltaVuolePersona(mv, voce, contoId)
  const proposta = sceltaProposta(sug)?.personaId
  const candidato = sug?.candidati.find((c) => c.id === proposta)
  const quanti = sug?.candidati.length ?? 0
  return (
    <>
      <select className="sg-campo" aria-label={`Tipologia di ${mv.descrizione}`} value={voceId} onChange={(e) => onScegli({ voceId: e.target.value })}>
        {offerte.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
      </select>
      {!vuole ? <span /> : (
        <div className="row" style={{ gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
          {scelta?.personaId ? (
            <>
              <b style={{ fontSize: 14 }}>{scelta.nomePersona ?? `${candidato?.nome ?? ''} ${candidato?.cognome ?? ''}`}</b>
              <Tasto onClick={() => onApri(!aperta)}>Cambia</Tasto>
            </>
          ) : candidato ? (
            <>
              <b style={{ fontSize: 14 }}>{candidato.nome} {candidato.cognome}</b>
              <span className="row" style={{ gap: 6 }}>
                <TastoIcona icona="conferma" nome={`È questa: collega il movimento a ${candidato.nome} ${candidato.cognome}`} onClick={() => onScegli({ personaId: candidato.id, nomePersona: `${candidato.nome} ${candidato.cognome}` })} />
                <Tasto onClick={() => onApri(!aperta)}>Cambia</Tasto>
              </span>
            </>
          ) : (
            <>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--giallo-testo)' }}>{quanti > 1 ? `${quanti} schede possibili` : 'Manca la persona'}</span>
              <Tasto onClick={() => onApri(!aperta)}>{quanti > 1 ? 'Scegli' : 'Cerca'}</Tasto>
            </>
          )}
        </div>
      )}
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
