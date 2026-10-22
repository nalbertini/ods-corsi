import { useState } from 'react'
import { Titoletto } from '../ds'
import { stagioneDi } from '../../lib/costi'
import { frasePagatoPrima, NOTA_DI_DEFAULT, segnaPagatoPrima, type EsitoSegnatura, type PagatoNelVecchio, type RigaPagatoPrima } from '../../lib/pagatoPrima'
import type { DatiSegreteria, PersonaSeg } from '../../lib/segreteria'
import { chiaveGiorno } from '../../lib/sala'
import { Campo, useDialogo } from './comune'

/**
 * Il filtro «Pagato nel vecchio programma» dell'elenco ISCRITTI: chi ha un incasso dello storico nella stagione e nell'app
 * risulta ancora da pagare. Le righe con la casella si segnano insieme «pagata senza ricevuta dell'app»; le altre (solo
 * corsi, quota sotto i 50 €, incasso del genitore) si guardano dalla scheda, caso per caso. Lo storico non è un incasso:
 * finché non si segna, «Da pagare» e le statistiche restano quelle di prima.
 */
export function PagatoPrima({
  d,
  persone,
  gruppi,
  onApri,
  onCambiato,
  avvisa,
}: {
  d: Pick<DatiSegreteria, 'salvaPagamento'>
  persone: PersonaSeg[]
  /** Già ristretti a ricerca e corso scelti sopra. */
  gruppi: PagatoNelVecchio
  onApri: (id: string) => void
  onCambiato: () => void
  avvisa: (testo: string, guaio?: boolean) => void
}) {
  const nome = (id: string) => {
    const p = persone.find((x) => x.id === id)
    return p ? `${p.cognome} ${p.nome}` : ''
  }
  const [scelte, setScelte] = useState<Set<string>>(new Set())
  const [dialogo, setDialogo] = useState(false)
  const [esito, setEsito] = useState<EsitoSegnatura | null>(null)
  const da = new Set(gruppi.quota.map((r) => r.personaId))
  // Quelle scelte che sono ancora in elenco: dopo una segnatura le riuscite escono, le fallite restano scelte.
  const attuali = [...scelte].filter((id) => da.has(id))
  const perNome = (a: RigaPagatoPrima, b: RigaPagatoPrima) => nome(a.personaId).localeCompare(nome(b.personaId), 'it')
  const conQuota = [...gruppi.quota, ...gruppi.daGuardare.filter((r) => r.motivo !== 'solo-corsi')].sort(perNome)
  const soloCorsi = gruppi.daGuardare.filter((r) => r.motivo === 'solo-corsi').sort(perNome)
  const tutte = gruppi.quota.length + gruppi.daGuardare.length

  const alterna = (id: string) => {
    const dopo = new Set(scelte)
    if (!dopo.delete(id)) dopo.add(id)
    setScelte(dopo)
  }

  return (
    <div className="stack" style={{ gap: 18 }}>
      <p role="status" style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>
        {tutte === 0 ? (
          <b>Nessuno da segnare.</b>
        ) : (
          <>
            <b>{gruppi.quota.length} {gruppi.quota.length === 1 ? 'persona da segnare' : 'persone da segnare'}</b> · {gruppi.daGuardare.length} da guardare a mano.
          </>
        )}
        {gruppi.nonCollegati > 0 &&
          ` ${gruppi.nonCollegati} ${gruppi.nonCollegati === 1 ? 'incasso del vecchio programma non è collegato' : 'incassi del vecchio programma non sono collegati'} a nessuna scheda: li collega l’amministrazione, in CONTABILITÀ › MOVIMENTI.`}
      </p>

      {tutte > 0 && gruppi.quota.length === 0 && <p role="status" style={{ margin: 0, fontSize: 15 }}><b>Fatto: nessuno da segnare con la casella.</b> Le altre si guardano dalla scheda.</p>}

      {gruppi.quota.length > 0 && attuali.length === 0 && (
        <div>
          <button type="button" className="sg-btn sg-btn-linea" onClick={() => setScelte(new Set(gruppi.quota.map((r) => r.personaId)))}>
            {gruppi.quota.length === 1 ? 'Seleziona la persona' : `Seleziona tutte le ${gruppi.quota.length}`}
          </button>
        </div>
      )}

      {esito && esito.falliti.length > 0 && (
        <div role="alert" style={{ padding: '12px 14px', border: '2px solid var(--rosso-testo)', fontSize: 15, lineHeight: 1.5 }}>
          <b>Segnate {esito.riusciti.length}. {esito.falliti.length === 1 ? 'Una non è riuscita' : `${esito.falliti.length} non sono riuscite`}:</b> {esito.falliti.map((f) => f.nome).join(', ')}. Restano scelte: riprova, o aprile dalla scheda.
        </div>
      )}

      {conQuota.length > 0 && (
        <Gruppo titolo="HA PAGATO LA QUOTA" conto={conQuota.length} frase="Hanno pagato la quota associativa nel vecchio programma. Quelle con la casella si segnano insieme; le altre le guardi tu dalla scheda.">
          {conQuota.map((r) => (
            <Riga key={r.personaId} r={r} nome={nome} scelta={scelte.has(r.personaId)} onAlterna={() => alterna(r.personaId)} onApri={onApri} fallita={esito?.falliti.some((f) => f.id === r.personaId) ?? false} />
          ))}
        </Gruppo>
      )}
      {soloCorsi.length > 0 && (
        <Gruppo titolo="HA PAGATO SOLO CORSI" conto={soloCorsi.length} frase="Niente quota associativa nell’incasso: si decide dalla scheda, caso per caso.">
          {soloCorsi.map((r) => (
            <Riga key={r.personaId} r={r} nome={nome} scelta={false} onApri={onApri} fallita={false} />
          ))}
        </Gruppo>
      )}

      {attuali.length > 0 && (
        <div className="sg-barra-scelta" role="region" aria-label="Persone scelte">
          <span className="ob" style={{ fontSize: 22, fontWeight: 700 }}>{attuali.length} {attuali.length === 1 ? 'SCELTA' : 'SCELTE'}</span>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap', marginLeft: 'auto' }}>
            <button type="button" className="sg-btn sg-btn-linea" onClick={() => setScelte(new Set(gruppi.quota.map((r) => r.personaId)))} disabled={attuali.length === gruppi.quota.length}>
              Seleziona tutte
            </button>
            <button type="button" className="sg-btn sg-btn-linea" onClick={() => setScelte(new Set())} disabled={attuali.length === 0}>
              Deseleziona
            </button>
            <button type="button" className="sg-btn sg-btn-pieno" disabled={attuali.length === 0} onClick={() => setDialogo(true)}>
              {esito && esito.falliti.length > 0 && attuali.length === esito.falliti.length
                ? `Riprova le ${attuali.length}`
                : `Segna ${attuali.length} come ${attuali.length === 1 ? 'pagata' : 'pagate'} senza ricevuta dell’app`}
            </button>
          </div>
        </div>
      )}

      {dialogo && (
        <Conferma
          nomi={gruppi.quota.filter((r) => scelte.has(r.personaId)).map((r) => ({ id: r.personaId, nome: nome(r.personaId), frase: frasePagatoPrima(r) }))}
          onTogli={(id) => {
            const dopo = new Set(scelte)
            dopo.delete(id)
            setScelte(dopo)
            if (!attuali.some((x) => x !== id)) setDialogo(false)
          }}
          onChiudi={() => setDialogo(false)}
          onSegna={async (fino, nota) => {
            setDialogo(false)
            const chi = persone.filter((p) => attuali.includes(p.id))
            const e = await segnaPagatoPrima(d, chi, { fino, nota })
            setEsito(e)
            // Le fallite restano scelte; le riuscite escono da sole quando l'elenco si rilegge.
            setScelte(new Set(e.falliti.map((f) => f.id)))
            if (!e.falliti.length) avvisa(`Segnate ${e.riusciti.length}: ${e.riusciti.length === 1 ? 'esce' : 'escono'} dall’elenco e la quota risulta pagata.`)
            onCambiato()
          }}
        />
      )}
    </div>
  )
}

function Gruppo({ titolo, conto, frase, children }: { titolo: string; conto: number; frase: string; children: React.ReactNode }) {
  return (
    <div className="stack" style={{ gap: 6 }}>
      <Titoletto conto={conto}>{titolo}</Titoletto>
      <span className="sg-sotto">{frase}</span>
      <div role="table" aria-label={titolo} className="sg-tabella">
        {children}
      </div>
    </div>
  )
}

/** Perché la persona sta fra quelli da guardare a mano, detto a chi la guarda. */
const NOTE = {
  'solo-corsi': 'Ha pagato i corsi, non la quota: decide la segreteria.',
  'sotto-quota': 'L’importo è sotto i 50 €: guarda se manca il resto.',
  'altra-persona': 'Non si segna il figlio per un incasso del genitore.',
} as const

function Riga({
  r,
  nome,
  scelta,
  onAlterna,
  onApri,
  fallita,
}: {
  r: RigaPagatoPrima
  nome: (id: string) => string
  scelta: boolean
  onAlterna?: () => void
  onApri: (id: string) => void
  fallita: boolean
}) {
  const conCasella = !r.motivo
  const quota = r.scaduta ? 'SCADUTA' : 'DA PAGARE'
  return (
    <div role="row" className="sg-iscritto sg-riga-prima" data-scelta={scelta}>
      <div className="row" style={{ gap: '8px 14px', flexWrap: 'wrap', alignItems: 'center' }}>
        {conCasella ? (
          <span className="sg-scelta-riga">
            <input type="checkbox" checked={scelta} onChange={onAlterna} aria-label={`Scegli ${nome(r.personaId)}`} />
          </span>
        ) : (
          <span style={{ flex: 'none', width: 44 }} />
        )}
        <button type="button" className="sg-riga-apri grow" style={{ fontSize: 15, fontWeight: 600 }} onClick={() => onApri(r.personaId)}>
          {nome(r.personaId)}
        </button>
        <span className="num sg-segno-regola" data-tono={quota === 'SCADUTA' ? 'rosso' : 'giallo'}>{quota}</span>
      </div>
      <div className="row" style={{ gap: '6px 10px', flexWrap: 'wrap', alignItems: 'center', paddingLeft: 58 }}>
        <span className="num" style={{ fontSize: 14 }}>{frasePagatoPrima(r)}</span>
        {r.daPersonaId && <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--sec)' }}>incasso del genitore {nome(r.daPersonaId)}</span>}
        {r.motivo === 'sotto-quota' && <span className="num sg-segno-regola" data-tono="giallo">PARZIALE?</span>}
        {fallita && <span className="num sg-segno-regola" data-tono="rosso">NON RIUSCITA: riprova</span>}
      </div>
      {r.motivo && (
        <div className="row" style={{ gap: '4px 12px', flexWrap: 'wrap', alignItems: 'center', paddingLeft: 58 }}>
          <span className="sg-sotto">{NOTE[r.motivo]}</span>
          <button type="button" className="sg-link sg-link-alto" onClick={() => onApri(r.personaId)}>
            Apri la scheda ›
          </button>
        </div>
      )}
    </div>
  )
}

function Conferma({
  nomi,
  onTogli,
  onChiudi,
  onSegna,
}: {
  nomi: Array<{ id: string; nome: string; frase: string }>
  onTogli: (id: string) => void
  onChiudi: () => void
  onSegna: (fino: string, nota: string) => void
}) {
  const ref = useDialogo<HTMLFormElement>(onChiudi)
  const [fino, setFino] = useState<string>(() => stagioneDi(chiaveGiorno(new Date())).quota.al)
  const [nota, setNota] = useState(NOTA_DI_DEFAULT)
  return (
    <>
      <button type="button" className="sg-velo" aria-label="Chiudi" onClick={onChiudi} />
      <form
        ref={ref}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-label="Segna come pagate senza ricevuta dell’app"
        className="sg-dialogo"
        onSubmit={(e) => {
          e.preventDefault()
          if (fino) onSegna(fino, nota.trim())
        }}
      >
        <span className="ob" style={{ fontSize: 26, fontWeight: 700, letterSpacing: '0.04em' }}>
          SEGNA {nomi.length} {nomi.length === 1 ? 'PERSONA' : 'PERSONE'}
        </span>
        <span className="sg-sotto" style={{ lineHeight: 1.5 }}>
          La quota risulta pagata senza ricevuta dell’app, come col tasto della scheda. Non viene registrato nessun incasso: il pagamento resta nel vecchio programma.
        </span>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 280, overflowY: 'auto', border: '2px solid var(--line-soft)' }}>
          {nomi.map((x) => (
            <li key={x.id} className="row" style={{ gap: 10, minHeight: 52, padding: '4px 4px 4px 12px', borderBottom: '1px solid var(--line-soft)' }}>
              <span className="grow" style={{ fontSize: 15, fontWeight: 600 }}>
                {x.nome}
                <span className="num sg-sotto" style={{ display: 'block', fontSize: 13, fontWeight: 400 }}>{x.frase}</span>
              </span>
              <button type="button" className="sg-btn sg-btn-linea" onClick={() => onTogli(x.id)} aria-label={`Escludi ${x.nome}`}>
                ✕ Escludi
              </button>
            </li>
          ))}
        </ul>
        <div className="sg-due">
          <Campo id="p-fino" etichetta="VALE FINO AL" nota={{ testo: 'Fino a quando la quota risulta pagata.', guaio: false }}>
            <input id="p-fino" className="sg-campo" type="date" value={fino} onChange={(e) => setFino(e.target.value)} required />
          </Campo>
          <Campo id="p-nota" etichetta="NOTA">
            <input id="p-nota" className="sg-campo" type="text" maxLength={300} value={nota} onChange={(e) => setNota(e.target.value)} />
          </Campo>
        </div>
        {!fino && <span role="alert" className="sg-sotto" style={{ color: 'var(--rosso-testo)' }}>Metti la data fino a cui vale la quota.</span>}
        <span className="sg-sotto" style={{ lineHeight: 1.5 }}>
          Se la data non è giusta per qualcuno, si corregge persona per persona dalla scheda: QUOTA E PAGAMENTI › Segna come pagata.
        </span>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button type="button" className="sg-btn sg-btn-linea" onClick={onChiudi}>
            Annulla
          </button>
          <button type="submit" className="sg-btn sg-btn-pieno" disabled={!fino || nomi.length === 0}>
            Segna
          </button>
        </div>
      </form>
    </>
  )
}
