import { useMemo, useState } from 'react'
import type { DatiSegreteria } from '../../lib/segreteria'
import type { Prezzi, VoceCosto } from '../../lib/costi'
import { STAGIONE } from '../../lib/costi'
import { agganciaPerNome, anniDiNascita, annoScritto, cambiNellaBozza, corsiScegliibili, domandaButta, cosaNonVaListino, LIMITI, listinoCambiato, corsiSenzaPrezzo, segnalazioniListino, type CorsoRef, type Listino as DatiListino } from '../../lib/listino'
import { centesimi } from '../../lib/ricevute'
import { indirizzo, INDIRIZZI } from '../../lib/aree'
import { chiedi, Campo, dataLunga, Guaio, Testa, useAvviso, useBozza, useCarica } from './comune'

/*
 * Il listino si cambia in una bozza, tutto insieme, e si salva con un tasto
 * solo: un prezzo a metà (il saldo cambiato, l'annuale non ancora) non deve
 * finire sulla pagina di iscrizione. I prezzi nella bozza sono testo, come
 * si scrivono: «480», «12,50».
 */

interface BozzaPrezzi {
  etichetta: string
  saldo: string
  annuale: string
  trimestre: string
}

interface BozzaCorso {
  chiave: number
  corso: string
  /** Il corso di CORSI a cui appartiene; vuoto se ancora da agganciare. */
  corsoId: string
  eta: string
  /** Gli anni di nascita, scritti: vuoti vuol dire per tutti. */
  natiDal: string
  natiAl: string
  /** Uno per riga. */
  orari: string
  notaTrimestre: string
  nota: string
  prezzi: BozzaPrezzi[]
}

interface BozzaOfferta {
  chiave: number
  titolo: string
  testo: string
}

interface Bozza {
  quota: string
  saldoEntro: string
  corsi: BozzaCorso[]
  offerte: BozzaOfferta[]
  senzaPrezzoVaBene: string[]
}

let contatore = 0
const nuovaChiave = () => ++contatore

const scritto = (n?: number) => (n === undefined ? '' : n.toLocaleString('it-IT', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2, useGrouping: false }))

const bozzaPrezzi = (p: Prezzi): BozzaPrezzi => ({ etichetta: p.etichetta ?? '', saldo: scritto(p.saldo), annuale: scritto(p.annuale), trimestre: scritto(p.trimestre) })

const bozzaCorso = (c: VoceCosto): BozzaCorso => ({
  chiave: nuovaChiave(),
  corso: c.corso,
  corsoId: c.corsoId ?? '',
  eta: c.eta,
  natiDal: c.natiDal === undefined ? '' : String(c.natiDal),
  natiAl: c.natiAl === undefined ? '' : String(c.natiAl),
  orari: c.orari.join('\n'),
  notaTrimestre: c.notaTrimestre ?? '',
  nota: c.nota ?? '',
  prezzi: c.prezzi.map(bozzaPrezzi),
})

const bozzaDa = (l: DatiListino): Bozza => ({
  quota: scritto(l.quota),
  saldoEntro: l.saldoEntro,
  corsi: l.corsi.map(bozzaCorso),
  offerte: l.offerte.map((o) => ({ chiave: nuovaChiave(), ...o })),
  senzaPrezzoVaBene: l.senzaPrezzoVaBene ?? [],
})

const PREZZI_VUOTI: BozzaPrezzi = { etichetta: '', saldo: '', annuale: '', trimestre: '' }

/** Un prezzo scritto → euro; `undefined` se è vuoto, `null` se non si capisce. */
function inEuro(t: string): number | undefined | null {
  if (!t.trim()) return undefined
  const c = centesimi(t)
  return c === null ? null : c / 100
}

/** Dalla bozza al listino da salvare, o quello che non va. */
function daBozza(b: Bozza, corsi: ReadonlyArray<CorsoRef>): DatiListino | string {
  const quota = inEuro(b.quota)
  if (quota === undefined || quota === null) return 'La quota associativa non si capisce'
  const voci: VoceCosto[] = []
  for (const c of b.corsi) {
    const nome = c.corso.trim() || 'un corso senza nome'
    const prezzi: Prezzi[] = []
    for (const p of c.prezzi) {
      const x: Prezzi = {}
      for (const k of ['saldo', 'annuale', 'trimestre'] as const) {
        const n = inEuro(p[k])
        if (n === null) return `Un prezzo di «${nome}» non si capisce: «${p[k]}»`
        if (n !== undefined) x[k] = n
      }
      if (p.etichetta.trim()) x.etichetta = p.etichetta.trim().toUpperCase()
      prezzi.push(x)
    }
    const anni: Pick<VoceCosto, 'natiDal' | 'natiAl'> = {}
    for (const k of ['natiDal', 'natiAl'] as const) {
      const n = annoScritto(c[k])
      if (n === null) return `${k === 'natiDal' ? 'NATI DAL' : 'NATI AL'} di «${nome}» non va: «${c[k].trim()}». Scrivi un anno a quattro cifre, dal 1900 al 2100`
      if (n !== undefined) anni[k] = n
    }
    const v: VoceCosto = {
      ...anni,
      // Il nome è quello di CORSI: se il corso è stato rinominato, lo segue.
      corso: (c.corsoId && corsi.find((x) => x.id === c.corsoId)?.nome) || c.corso.trim(),
      ...(c.corsoId && { corsoId: c.corsoId }),
      eta: c.eta.trim(),
      orari: c.orari.split('\n').map((o) => o.trim()).filter(Boolean),
      prezzi,
    }
    if (c.notaTrimestre.trim()) v.notaTrimestre = c.notaTrimestre.trim()
    if (c.nota.trim()) v.nota = c.nota.trim()
    voci.push(v)
  }
  const l: DatiListino = {
    quota,
    saldoEntro: b.saldoEntro,
    corsi: voci,
    offerte: b.offerte.map((o) => ({ titolo: o.titolo.trim().toUpperCase(), testo: o.testo.trim() })),
    ...(b.senzaPrezzoVaBene.length && { senzaPrezzoVaBene: b.senzaPrezzoVaBene }),
  }
  return cosaNonVaListino(l, corsi) ?? l
}

/** Come si legge un corso chiuso: gli anni di nascita, poi i prezzi in fila. */
function riassunto(c: BozzaCorso) {
  // Senza anni il corso va bene per tutti: si vede senza aprirlo, se è una dimenticanza.
  return `${anniDiNascita({ natiDal: c.natiDal.trim(), natiAl: c.natiAl.trim() })} — ${c.prezzi
    .map((p) => {
      const pezzi = [p.saldo && `saldo ${p.saldo} €`, p.annuale && `annuale ${p.annuale} €`, p.trimestre && `trimestre ${p.trimestre} €`].filter(Boolean).join(' · ')
      return p.etichetta ? `${p.etichetta.toLowerCase()}: ${pezzi}` : pezzi
    })
    .join(' — ')}`
}

/**
 * Il listino della stagione: la quota, fino a quando vale il saldo, i corsi
 * coi loro prezzi e le offerte. È quello della pagina di iscrizione e delle
 * voci pronte delle ricevute; le ricevute già fatte restano come erano.
 */
export function Listino({ d }: { d: DatiSegreteria }) {
  const letto = useCarica(() => d.listino(), [d])
  const elenco = useCarica(() => d.corsi(), [d])
  const corsiDi = useMemo(() => (elenco.dato ?? []).map((c) => ({ id: c.id, nome: c.nome, attivo: c.attivo })), [elenco.dato])
  const { avviso, avvisa, fai, lavora } = useAvviso()
  const [bozza, setBozza] = useState<Bozza | null>(null)
  const [aperto, setAperto] = useState<number | null>(null)
  // Le chiavi della bozza di partenza restano le stesse fra un giro e l'altro: CAMBIA apre quella giusta.
  // Le voci vecchie si agganciano da sole per nome, come fa il salvataggio: così si vede subito quali restano da scegliere.
  const base = useMemo(() => (letto.dato && elenco.dato ? bozzaDa(agganciaPerNome(letto.dato.listino, corsiDi)) : null), [letto.dato, elenco.dato, corsiDi])
  const b = bozza ?? base
  const cambia = (x: Partial<Bozza>) => b && setBozza({ ...b, ...x })
  // Quel che non quadra, calcolato in src/lib sul listino com'è nella bozza (se si capisce).
  const voci = b ? daBozza(b, corsiDi) : null
  const senza = typeof voci === 'object' && voci ? segnalazioniListino(voci, corsiDi) : { senzaPrezzo: [], senzaCorso: [], tolti: [] }
  const cambiaCorso = (chiave: number, x: Partial<BozzaCorso>) => b && cambia({ corsi: b.corsi.map((c) => (c.chiave === chiave ? { ...c, ...x } : c)) })
  const sposta = (i: number, verso: -1 | 1) => {
    if (!b) return
    const corsi = [...b.corsi]
    const j = i + verso
    if (j < 0 || j >= corsi.length) return
    ;[corsi[i], corsi[j]] = [corsi[j], corsi[i]]
    cambia({ corsi })
  }

  const pronto = bozza ? daBozza(bozza, corsiDi) : null
  const guaio = typeof pronto === 'string' ? pronto : null
  // Una modifica rimessa com'era non è un cambio: niente barra «Ci sono cambi da salvare», niente domanda uscendo.
  const cambiato = !!pronto && !!base && listinoCambiato(daBozza(base, corsiDi), pronto)
  useBozza(cambiato, 'Listino')

  const salva = () => {
    if (!pronto || typeof pronto === 'string') return
    void fai(() => d.salvaListino(pronto), 'Listino salvato: la pagina di iscrizione e le ricevute usano questo', async () => {
      await letto.ricarica()
      setBozza(null)
      setAperto(null)
    })
  }

  const butta = async () => {
    if (!b || !base) return
    if (!(await chiedi(domandaButta(cambiNellaBozza(base, b)), 'BUTTA I CAMBI', { pericolo: true }))) return
    setBozza(null)
    setAperto(null)
    avvisa('Listino tornato com’è salvato')
    // La barra col tasto sparisce: il fuoco va sul titolo, non si perde sulla pagina.
    // Al giro dopo: chiudendosi, il dialogo lo rimette sul tasto che l'ha aperto.
    requestAnimationFrame(() => document.querySelector<HTMLElement>('.sg-titolo')?.focus())
  }

  const rimetti = async () => {
    if (!(await chiedi('Rimettere il listino del foglio originale? I cambi fatti qui si perdono.', 'RIMETTI IL LISTINO DEL FOGLIO', { pericolo: true }))) return
    void fai(() => d.salvaListino(null), 'Rimesso il listino del foglio', async () => {
      await letto.ricarica()
      setBozza(null)
      setAperto(null)
    })
  }

  return (
    <>
      <Testa titolo="LISTINO" sotto={`I costi della stagione ${STAGIONE}: quelli della pagina di iscrizione e delle voci pronte delle ricevute.`}>
        <a className="sg-btn sg-btn-linea" href={indirizzo(INDIRIZZI.iscrizioni)} target="_blank" rel="noopener">
          VEDI LA PAGINA ↗
        </a>
      </Testa>

      {letto.guaio && <Guaio testo={`Il listino non si legge: ${letto.guaio}`} />}
      {elenco.guaio && <Guaio testo={`I corsi non si leggono: ${elenco.guaio}`} />}
      {!b && !letto.guaio && !elenco.guaio && <p className="sg-sotto">Un attimo…</p>}

      {b && letto.dato && (
        <div className="stack sg-listino" style={{ gap: 20 }}>
          <section aria-label="La stagione" className="sg-riquadro">
            <span className="ob sg-riquadro-titolo">LA STAGIONE</span>
            <span className="sg-sotto">
              {letto.dato.cambiato
                ? 'Il listino è quello cambiato qui. La pagina di iscrizione non offre più il PDF del foglio, che direbbe prezzi vecchi.'
                : 'Il listino è quello del foglio originale, finché non si cambia qualcosa.'}
            </span>
            <div className="sg-due">
              <Campo id="li-quota" etichetta="QUOTA ASSOCIATIVA · €">
                <input id="li-quota" className="sg-campo num" inputMode="decimal" maxLength={10} value={b.quota} onChange={(e) => cambia({ quota: e.target.value })} />
              </Campo>
              <Campo id="li-saldo" etichetta="SALDO FINO AL">
                <input id="li-saldo" className="sg-campo" type="date" value={b.saldoEntro} onChange={(e) => cambia({ saldoEntro: e.target.value })} />
              </Campo>
            </div>
            <span className="sg-sotto">
              Fino al {/^\d{4}-\d{2}-\d{2}$/.test(b.saldoEntro) ? dataLunga(b.saldoEntro) : '…'} compreso la pagina mostra la colonna del saldo e le ricevute propongono
              l’annuale a saldo; dopo, sparisce.
            </span>
            {letto.dato.cambiato && !cambiato && (
              <button type="button" className="sg-link" style={{ alignSelf: 'flex-start' }} disabled={lavora} onClick={rimetti}>
                Rimetti il listino del foglio originale
              </button>
            )}
          </section>

          <section aria-label="I corsi" className="sg-riquadro">
            <span className="ob sg-riquadro-titolo">I CORSI · {b.corsi.length}</span>
            <span className="sg-sotto">
              In quest’ordine sulla pagina di iscrizione. Ogni voce è di un corso di CORSI, uno solo: se il corso cambia nome, il prezzo lo segue.
            </span>
            {typeof voci === 'object' && voci && <Segnalazioni l={voci} vaBene={b.senzaPrezzoVaBene} corsi={corsiDi} onCambia={(senzaPrezzoVaBene) => cambia({ senzaPrezzoVaBene })} />}
            {b.corsi.map((c, i) =>
              aperto === c.chiave ? (
                <SchedaCorso
                  key={c.chiave}
                  c={c}
                  scelta={corsiScegliibili(corsiDi.filter((x) => x.attivo || x.id === c.corsoId), b.corsi, c.corsoId)}
                  primo={i === 0}
                  ultimo={i === b.corsi.length - 1}
                  onCambia={(x) => cambiaCorso(c.chiave, x)}
                  onSposta={(v) => sposta(i, v)}
                  onTogli={async () => {
                    if ((await chiedi(`Togliere «${c.corso || 'questo corso'}» dal listino?`, 'TOGLI DAL LISTINO'))) cambia({ corsi: b.corsi.filter((x) => x.chiave !== c.chiave) })
                  }}
                  onChiudi={() => setAperto(null)}
                />
              ) : (
                <div key={c.chiave} className="sg-voce-elenco">
                  <span className="stack grow" style={{ minWidth: 0 }}>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>{(c.corsoId && corsiDi.find((x) => x.id === c.corsoId)?.nome) || c.corso || 'Senza nome'}</span>
                    {!c.corsoId && senza.senzaCorso.includes(c.corso) && <span style={{ fontSize: 14, color: 'var(--rosso-testo)' }}>Senza corso: scegli il corso da CAMBIA</span>}
                    <span style={{ fontSize: 12, color: 'var(--dim)' }}>{riassunto(c) || 'Nessun prezzo'}</span>
                  </span>
                  <button type="button" className="num sg-chip" onClick={() => setAperto(c.chiave)}>
                    CAMBIA
                  </button>
                </div>
              ),
            )}
            <button
              type="button"
              className="sg-btn sg-btn-tratteggio"
              disabled={b.corsi.length >= LIMITI.corsi}
              onClick={() => {
                const nuovo: BozzaCorso = { chiave: nuovaChiave(), corso: '', corsoId: '', eta: '', natiDal: '', natiAl: '', orari: '', notaTrimestre: '', nota: '', prezzi: [{ ...PREZZI_VUOTI }] }
                cambia({ corsi: [...b.corsi, nuovo] })
                setAperto(nuovo.chiave)
              }}
            >
              + AGGIUNGI UN CORSO
            </button>
          </section>

          <section aria-label="Le offerte" className="sg-riquadro">
            <span className="ob sg-riquadro-titolo">LE OFFERTE</span>
            <span className="sg-sotto">Sotto i corsi, nella pagina di iscrizione. Le ricevute calcolano da sé solo lo sconto famiglia (20%); le altre si scrivono a mano nel prezzo.</span>
            {b.offerte.map((o) => (
              <div key={o.chiave} className="stack" style={{ gap: 8, paddingBottom: 12, borderBottom: '2px solid var(--line-soft)' }}>
                <div className="row" style={{ gap: 8 }}>
                  <label htmlFor={`of-t-${o.chiave}`} className="vh">
                    Titolo
                  </label>
                  <input
                    id={`of-t-${o.chiave}`}
                    className="sg-campo grow"
                    placeholder="SCONTO FAMIGLIA"
                    maxLength={60}
                    value={o.titolo}
                    onChange={(e) => cambia({ offerte: b.offerte.map((x) => (x.chiave === o.chiave ? { ...x, titolo: e.target.value } : x)) })}
                  />
                  <button type="button" className="sg-link" onClick={() => cambia({ offerte: b.offerte.filter((x) => x.chiave !== o.chiave) })}>
                    Togli
                  </button>
                </div>
                <label htmlFor={`of-x-${o.chiave}`} className="vh">
                  Testo
                </label>
                <textarea
                  id={`of-x-${o.chiave}`}
                  className="sg-campo"
                  rows={2}
                  maxLength={400}
                  value={o.testo}
                  onChange={(e) => cambia({ offerte: b.offerte.map((x) => (x.chiave === o.chiave ? { ...x, testo: e.target.value } : x)) })}
                  style={{ minHeight: 56, paddingTop: 8 }}
                />
              </div>
            ))}
            <button
              type="button"
              className="sg-btn sg-btn-tratteggio"
              disabled={b.offerte.length >= LIMITI.offerte}
              onClick={() => cambia({ offerte: [...b.offerte, { chiave: nuovaChiave(), titolo: '', testo: '' }] })}
            >
              + AGGIUNGI UN’OFFERTA
            </button>
          </section>

          {cambiato && (
            <div className="sg-listino-salva">
              <span className="grow" style={{ fontSize: 14, color: guaio ? 'var(--rosso-testo)' : 'var(--sec)' }}>
                {guaio ?? 'Ci sono cambi da salvare: fino ad allora la pagina di iscrizione mostra quello di prima.'}
              </span>
              <button type="button" className="sg-btn sg-btn-linea" disabled={lavora} onClick={() => void butta()}>
                BUTTA I CAMBI
              </button>
              <button type="button" className="sg-btn sg-btn-pieno" disabled={!!guaio || lavora} onClick={salva}>
                SALVA
              </button>
            </div>
          )}
        </div>
      )}
      {avviso}
    </>
  )
}

/** Cosa non quadra fra CORSI e listino, in rosso e a parole. */
function Segnalazioni({ l, vaBene, corsi, onCambia }: { l: DatiListino; vaBene: string[]; corsi: Array<CorsoRef & { attivo: boolean }>; onCambia: (vaBene: string[]) => void }) {
  const mancano = corsiSenzaPrezzo(l, corsi)
  const tolti = segnalazioniListino(l, corsi).tolti
  const scelti = corsi.filter((c) => vaBene.includes(c.id))
  if (!mancano.length && !tolti.length && !scelti.length) return null
  return (
    <div className="stack" style={{ gap: 0 }}>
      {mancano.map((c) => (
        <span key={c.id} className="row" style={{ gap: 8, color: 'var(--rosso-testo)', fontSize: 14, minHeight: 44, alignItems: 'center' }}>
          <span className="grow">{c.nome}: senza prezzo nel listino</span>
          <button type="button" className="sg-link" onClick={() => onCambia([...vaBene, c.id])}>
            Va bene senza prezzo
          </button>
        </span>
      ))}
      {tolti.map((nome) => (
        <span key={nome} style={{ color: 'var(--rosso-testo)', fontSize: 14, minHeight: 44, display: 'flex', alignItems: 'center' }}>
          {nome}: il corso non c’è più in CORSI. Toglila da CAMBIA.
        </span>
      ))}
      {scelti.map((c) => (
        <span key={c.id} className="row" style={{ gap: 8, fontSize: 14, color: 'var(--sec)', minHeight: 44, alignItems: 'center' }}>
          <span className="grow">{c.nome}: senza prezzo, va bene così</span>
          <button type="button" className="sg-link" onClick={() => onCambia(vaBene.filter((i) => i !== c.id))}>
            Rimetti il rosso
          </button>
        </span>
      ))}
    </div>
  )
}

function SchedaCorso({
  c,
  scelta,
  primo,
  ultimo,
  onCambia,
  onSposta,
  onTogli,
  onChiudi,
}: {
  c: BozzaCorso
  scelta: CorsoRef[]
  primo: boolean
  ultimo: boolean
  onCambia: (x: Partial<BozzaCorso>) => void
  onSposta: (verso: -1 | 1) => void
  onTogli: () => void
  onChiudi: () => void
}) {
  const id = (k: string) => `lc-${c.chiave}-${k}`
  const testoCampo = (k: 'eta' | 'natiDal' | 'natiAl' | 'notaTrimestre' | 'nota', etichetta: string, max: number, largo = false, segnaposto = '', anno = false) => (
    <Campo id={id(k)} etichetta={etichetta} largo={largo}>
      <input
        id={id(k)}
        className={anno ? 'sg-campo num' : 'sg-campo'}
        inputMode={anno ? 'numeric' : undefined}
        aria-describedby={anno ? id('anni') : undefined}
        maxLength={max}
        placeholder={segnaposto}
        value={c[k]}
        onChange={(e) => onCambia({ [k]: e.target.value })}
      />
    </Campo>
  )
  const cambiaPrezzi = (i: number, x: Partial<BozzaPrezzi>) => onCambia({ prezzi: c.prezzi.map((p, j) => (j === i ? { ...p, ...x } : p)) })
  const piuRighe = c.prezzi.length > 1

  return (
    <div className="stack sg-listino-corso">
      <div className="sg-due">
        <Campo id={id('corso')} etichetta="CORSO" largo>
          <select
            id={id('corso')}
            className="sg-campo"
            aria-invalid={!c.corsoId}
            value={c.corsoId}
            onChange={(e) => onCambia({ corsoId: e.target.value, corso: scelta.find((x) => x.id === e.target.value)?.nome ?? c.corso })}
          >
            <option value="">Scegli il corso</option>
            {scelta.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nome}
              </option>
            ))}
          </select>
        </Campo>
        {testoCampo('eta', 'ETÀ', 120, true, 'nati 2019-2018-2017')}
        {testoCampo('natiDal', 'NATI DAL', 4, false, '', true)}
        {testoCampo('natiAl', 'NATI AL', 4, false, '', true)}
        <span id={id('anni')} className="sg-sotto" style={{ gridColumn: '1 / -1', marginBottom: 6 }}>
          Il corso va in cima per chi è nato in questi anni. Vuoti: sta a parte, «senza fascia d’età». Solo NATI AL: quell’anno e prima.
        </span>
        <Campo id={id('orari')} etichetta="ORARI · UNO PER RIGA" largo>
          <textarea
            id={id('orari')}
            className="sg-campo"
            rows={2}
            value={c.orari}
            placeholder="lunedì, mercoledì e venerdì 17.00-18.00"
            onChange={(e) => onCambia({ orari: e.target.value })}
            style={{ minHeight: 56, paddingTop: 8 }}
          />
        </Campo>
      </div>

      <span className="sg-etichetta">PREZZI · €</span>
      {c.prezzi.map((p, i) => (
        <div key={i} className="sg-listino-prezzi" data-etichette={piuRighe}>
          {piuRighe && (
            <Campo id={id(`e${i}`)} etichetta="RIGA">
              <input id={id(`e${i}`)} className="sg-campo" maxLength={40} placeholder="2 GIORNI" value={p.etichetta} onChange={(e) => cambiaPrezzi(i, { etichetta: e.target.value })} />
            </Campo>
          )}
          {(['saldo', 'annuale', 'trimestre'] as const).map((k) => (
            <Campo key={k} id={id(`${k}${i}`)} etichetta={k === 'saldo' ? 'A SALDO' : k.toUpperCase()}>
              <input id={id(`${k}${i}`)} className="sg-campo num" inputMode="decimal" maxLength={10} value={p[k]} onChange={(e) => cambiaPrezzi(i, { [k]: e.target.value })} />
            </Campo>
          ))}
          {piuRighe && (
            <button type="button" className="sg-link" style={{ alignSelf: 'end', paddingBottom: 12 }} onClick={() => onCambia({ prezzi: c.prezzi.filter((_, j) => j !== i) })}>
              Togli
            </button>
          )}
        </div>
      ))}
      <span className="sg-sotto">Un prezzo vuoto non c’è: la pagina scrive un trattino, e le ricevute non lo propongono.</span>
      {c.prezzi.length < LIMITI.prezzi && (
        <button type="button" className="sg-link" style={{ alignSelf: 'flex-start' }} onClick={() => onCambia({ prezzi: [...c.prezzi, { ...PREZZI_VUOTI }] })}>
          + Un’altra riga di prezzi (1 giorno, 2 giorni…)
        </button>
      )}

      <div className="sg-due">
        {testoCampo('notaTrimestre', 'COSA COPRE IL TRIMESTRE · FACOLTATIVO', 60, false, '10 lezioni')}
        {testoCampo('nota', 'NOTA · FACOLTATIVA', 300, false, 'Solo in aggiunta a Judo 3')}
      </div>

      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="num sg-chip" disabled={primo} onClick={() => onSposta(-1)} aria-label="Più su">
          ↑ SU
        </button>
        <button type="button" className="num sg-chip" disabled={ultimo} onClick={() => onSposta(1)} aria-label="Più giù">
          ↓ GIÙ
        </button>
        <button type="button" className="sg-link" onClick={onTogli}>
          Togli dal listino
        </button>
        <span className="grow" />
        <button type="button" className="sg-btn sg-btn-linea" onClick={onChiudi}>
          CHIUDI
        </button>
      </div>
    </div>
  )
}
