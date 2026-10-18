import { useEffect, useRef, useState } from 'react'
import type { DatiSegreteria } from '../../lib/segreteria'
import { bastaPerCercare, comeSiAnnulla, domandaAnnullaPagamento, domandaAnnullaRicevuta, MASSIMO_PAGATORI, type RigaPagamento } from '../../lib/pagamenti'
import { avvisoCassaChiusa } from '../../lib/contabilita'
import { dataRicevuta, euro } from '../../lib/ricevute'
import { chiedi, messaggio, Riga, type useAvviso } from './comune'
import { RegistraPagamento } from './Ricevute'

type Fai = ReturnType<typeof useAvviso>['fai']

/**
 * Per chi segue i conti senza vedere le persone (l'amministrazione): il
 * pagamento di una riga di PAGAMENTI, con il tasto per annullarlo. Un pagamento
 * di una ricevuta non si annulla da solo: si annulla la ricevuta intera, che
 * resta in elenco col suo numero. Uno fatto a mano si annulla da solo.
 */
export function PagamentoAperto({ d, riga, fai, onChiudi, onFatto }: { d: DatiSegreteria; riga: RigaPagamento; fai: Fai; onChiudi: () => void; onFatto: () => void }) {
  const qui = useRef<HTMLElement>(null)
  // Aperto, si porta in vista: sul telefono sta sotto lo schermo.
  useEffect(() => {
    qui.current?.scrollIntoView({ block: 'center' })
  }, [riga.id])
  const come = comeSiAnnulla(riga)
  const annullaRicevuta = async () => {
    const r = riga.ricevuta
    if (!r) return
    // Dell'intera ricevuta si conosce qui solo questa riga; chi non vede le chiusure (la segreteria) non ha l'avviso.
    const avviso = avvisoCassaChiusa([riga], await d.chiusure().catch(() => []))
    if (!(await chiedi(`${domandaAnnullaRicevuta(r)}${avviso ? ` ${avviso}` : ''}`, 'Sì, annulla la ricevuta', { no: 'No, lasciala', pericolo: true }))) return
    void fai(() => d.annullaRicevuta(r.id), 'Ricevuta annullata', onFatto)
  }
  const annullaPagamento = async () => {
    const id = riga.direttoId
    if (!id) return
    const avviso = avvisoCassaChiusa([riga], await d.chiusure().catch(() => []))
    if (!(await chiedi(`${domandaAnnullaPagamento(riga)}${avviso ? ` ${avviso}` : ''}`, 'Sì, annulla il pagamento', { no: 'No, lascialo', pericolo: true }))) return
    void fai(() => d.annullaPagamentoDiretto(id), 'Pagamento annullato', onFatto)
  }
  const dettaglio: Array<[string, string]> = [
    ['CHI', riga.chi],
    ['DATA', dataRicevuta(riga.data)],
    ['A COSA SERVE', riga.voce],
    ['COME', riga.metodo],
    ['RICEVUTA', riga.ricevuta ? `${riga.ricevuta.numero}/${riga.ricevuta.anno}` : 'SENZA RICEVUTA'],
    ['IMPORTO', `${euro(riga.importo)} €`],
  ]
  if (riga.nota) dettaglio.push(['NOTA', riga.nota])
  return (
    <section ref={qui} aria-label="Il pagamento" className="sg-riquadro">
      <span className="sg-etichetta">IL PAGAMENTO</span>
      <span className="sg-riquadro-titolo ob">{riga.chi}</span>
      <div className="stack" style={{ gap: 0 }}>
        {dettaglio.map(([k, v]) => (
          <div key={k} className="row" style={{ gap: 14, padding: '8px 0', borderBottom: '1px solid var(--line-soft)', alignItems: 'baseline' }}>
            <span className="sg-etichetta" style={{ width: 130, flexShrink: 0 }}>{k}</span>
            <span style={{ fontSize: 15, fontWeight: k === 'CHI' || k === 'IMPORTO' ? 700 : undefined, minWidth: 0, overflowWrap: 'anywhere' }}>{v}</span>
          </div>
        ))}
      </div>
      {riga.annullato ? (
        <span className="sg-sotto">
          <span className="num sg-tag" data-tipo="manca">Annullato</span> Resta in elenco e non si conta più.
        </span>
      ) : riga.ricevuta ? (
        <span className="sg-sotto">Il pagamento sta nella ricevuta {riga.ricevuta.numero}/{riga.ricevuta.anno}. Non si annulla da solo: si annulla la ricevuta intera, che resta in elenco col suo numero e dice «Annullata».</span>
      ) : (
        <span className="sg-sotto">Pagamento fatto a mano, senza ricevuta. Annullato, resta in elenco e non si conta più.</span>
      )}
      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        {come === 'ricevuta' && riga.ricevuta && (
          <button type="button" className="sg-btn sg-btn-rosso" onClick={() => void annullaRicevuta()}>
            Annulla la ricevuta {riga.ricevuta.numero}/{riga.ricevuta.anno}
          </button>
        )}
        {come === 'pagamento' && (
          <button type="button" className="sg-btn sg-btn-rosso" onClick={() => void annullaPagamento()}>
            Annulla il pagamento
          </button>
        )}
        <button type="button" className="sg-btn sg-btn-linea" onClick={onChiudi}>
          Chiudi
        </button>
      </div>
    </section>
  )
}

/**
 * REGISTRA UN PAGAMENTO senza la scheda: prima chi (si cerca per nome, ne escono
 * al massimo otto, solo nome e cognome), poi il modulo di sempre.
 */
export function RegistraDaPagamenti({ d, fai, onFatto, onChiudi }: { d: DatiSegreteria; fai: Fai; onFatto: () => void; onChiudi: () => void }) {
  const [scritto, setScritto] = useState('')
  const [trovati, setTrovati] = useState<Array<{ id: string; nome: string; cognome: string }>>([])
  const [guaio, setGuaio] = useState<string | null>(null)
  // Cosa è stato cercato davvero: finché non risponde, «nessuno corrisponde» sarebbe una bugia.
  const [cercato, setCercato] = useState('')
  const [scelto, setScelto] = useState<{ id: string; nome: string; cognome: string } | null>(null)
  useEffect(() => {
    if (scelto) return
    setGuaio(null)
    // Sotto le tre lettere il database risponde sempre «nessuno»: non si chiede nemmeno.
    if (!bastaPerCercare(scritto)) {
      setTrovati([])
      setCercato(scritto)
      return
    }
    let vivo = true
    const t = window.setTimeout(() => {
      d.cercaPagatori(scritto).then(
        (x) => vivo && (setTrovati(x), setCercato(scritto)),
        // Senza risposta non restano i nomi di prima: non corrispondono più a quel che si è scritto.
        (e) => vivo && (setTrovati([]), setGuaio(messaggio(e, 'La ricerca non è partita: controlla la connessione e riprova.'))),
      )
    }, 250)
    return () => {
      vivo = false
      window.clearTimeout(t)
    }
  }, [d, scritto, scelto])

  if (scelto) {
    return (
      <div className="stack" style={{ gap: 8 }}>
        {/* Senza i corsi della persona (non li vede): «a cosa serve» si scrive, senza suggerimenti. */}
        <RegistraPagamento d={d} p={scelto} corsi={[]} fai={fai} onFatto={onFatto} onChiudi={onChiudi} />
        <div className="row">
          <button type="button" className="sg-btn sg-btn-linea" onClick={() => setScelto(null)}>
            Non è {scelto.cognome.toUpperCase()} {scelto.nome.toUpperCase()}: scegli un’altra persona
          </button>
        </div>
      </div>
    )
  }
  return (
    <section aria-label="Pagamento fatto a mano" className="sg-riquadro">
      <span className="sg-etichetta">PAGAMENTO FATTO A MANO</span>
      <Riga titolo="CHI HA PAGATO?" />
      <span className="sg-sotto">Si cerca per nome: escono solo nome e cognome, senza telefono né altro.</span>
      <label htmlFor="cerca-pagatore" className="vh">Cerca chi ha pagato per nome</label>
      <input id="cerca-pagatore" className="sg-campo" type="search" autoFocus placeholder="Almeno tre lettere" value={scritto} onChange={(e) => setScritto(e.target.value)} />
      {guaio && <span role="alert" style={{ fontSize: 14, color: 'var(--rosso-testo)' }}>{guaio}</span>}
      <ul className="stack" style={{ gap: 6, margin: 0, padding: 0, listStyle: 'none' }} aria-label="Chi corrisponde">
        {trovati.map((p) => (
          <li key={p.id}>
            <button type="button" className="sg-btn sg-scelta" style={{ justifyContent: 'flex-start', width: '100%' }} onClick={() => setScelto(p)}>
              {p.cognome} {p.nome}
            </button>
          </li>
        ))}
      </ul>
      <span className="sg-sotto" role="status">
        {!bastaPerCercare(scritto) ? 'Scrivi almeno tre lettere.' : cercato !== scritto ? ' ' : trovati.length === 0 ? 'Nessuno corrisponde: controlla come è scritto, o scrivi di più.' : trovati.length >= MASSIMO_PAGATORI ? `Ne escono al massimo ${MASSIMO_PAGATORI}: se non c’è, scrivi di più.` : ' '}
      </span>
      <div className="row">
        <button type="button" className="sg-btn sg-btn-linea" onClick={onChiudi}>
          No, torna indietro
        </button>
      </div>
    </section>
  )
}
