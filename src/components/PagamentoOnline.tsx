import { useEffect, useState } from 'react'
import { datiRichieste, type DatiRichieste } from '../lib/richieste'
import { ERRORE_SATISPAY, esitoPagamento, ritornoSatispay, soldi, type StatoSatispay } from '../lib/satispay'
import { Dettaglio, Tasto, TitoloEsito } from './ds'

/** Ogni quanto si richiede lo stato mentre il pagamento aspetta, e per quanto: poi lo si chiede col tasto. */
const OGNI = 4000
const VOLTE = 30

/**
 * Il pagamento del flusso di prima, quando la richiesta partiva prima di
 * pagare: al ritorno dall'app Satispay o dal link salvato
 * (`iscrizioni/?pagamento=<richiesta>`): com'è andato il pagamento, e il tasto
 * per riaprirlo o riprovare. La pagina ha l'indirizzo suo: chi la chiude può
 * tornarci e pagare dopo. Lo stato lo scrive la Edge Function dopo averlo
 * chiesto a Satispay, non questa pagina.
 */
export function PagamentoOnline({ richiestaId, onChiudi }: { richiestaId: string; onChiudi: () => void }) {
  const [d, setD] = useState<DatiRichieste | null>(null)
  const [p, setP] = useState<{ stato: StatoSatispay; importo: number; pagatoIl?: string } | null | undefined>(undefined)
  const [guaio, setGuaio] = useState<string | null>(null)
  const [vado, setVado] = useState(false)

  useEffect(() => {
    let vivo = true
    let volte = 0
    let timer: ReturnType<typeof setTimeout>
    const leggi = (x: DatiRichieste) =>
      x.statoPagamento(richiestaId).then(
        (s) => {
          if (!vivo) return
          setP(s)
          // Satispay avvisa il server, ma la callback può tardare: intanto si richiede, per un paio di minuti.
          if (s?.stato === 'attesa' && ++volte < VOLTE) timer = setTimeout(() => void leggi(x), OGNI)
        },
        (e) => vivo && setGuaio(e instanceof Error ? e.message : ERRORE_SATISPAY),
      )
    void datiRichieste().then(
      (x) => {
        if (!vivo) return
        setD(x)
        void leggi(x)
      },
      () => vivo && setGuaio(ERRORE_SATISPAY),
    )
    return () => {
      vivo = false
      clearTimeout(timer)
    }
  }, [richiestaId])

  const paga = async () => {
    if (!d) return
    setGuaio(null)
    setVado(true)
    try {
      const r = await d.paga(richiestaId)
      if (r && 'link' in r) return window.location.assign(r.link)
      setP(await d.statoPagamento(richiestaId))
    } catch (e) {
      setGuaio(e instanceof Error ? e.message : ERRORE_SATISPAY)
    }
    setVado(false)
  }

  if (p === undefined && !guaio) return <div className="pad stack esito"><Dettaglio>Guardo com’è andato il pagamento…</Dettaglio></div>

  const esito = p ? esitoPagamento(p) : null
  return (
    <div className="pad stack esito">
      {/* Senza pagamento (un link vecchio o sbagliato) non si sa se la richiesta c'è. */}
      <TitoloEsito tono={esito?.tono ?? 'avviso'}>{esito?.titolo ?? 'PAGAMENTO'}</TitoloEsito>
      {(esito?.testi ?? ['Il pagamento con Satispay non è ancora partito.']).map((t) => (
        <span key={t} className="esito-testo">{t}</span>
      ))}
      {guaio && <Dettaglio tono="guaio">{guaio}</Dettaglio>}
      {p?.stato === 'pagato' ? (
        <>
          <span className="esito-testo">La segreteria controlla la richiesta e ti scrive se manca qualcosa. La ricevuta della palestra te la dà la segreteria.</span>
          <Tasto onClick={onChiudi}>TORNA ALLE ISCRIZIONI</Tasto>
        </>
      ) : (
        <>
          <Tasto variante="principale" disabled={vado || !d} onClick={() => void paga()}>
            {vado ? 'APRO SATISPAY…' : p?.stato === 'non-andato' ? 'RIPROVA CON SATISPAY' : p ? `PAGA ${soldi(p.importo)} CON SATISPAY` : 'PAGA CON SATISPAY'}
          </Tasto>
          {p?.stato !== 'non-andato' && <Dettaglio>Puoi pagare anche più tardi da questa pagina: salva il link o tienila aperta.</Dettaglio>}
        </>
      )}
    </div>
  )
}

/**
 * Dove Satispay riporta chi ha pagato in fondo al modulo
 * (`iscrizioni/?satispay=<pagamento>`): com'è andato e dove tornare. Il
 * modulo, rimasto aperto nell'altra scheda, si aggiorna da solo e manda la
 * richiesta.
 */
export function RitornoDalPagamento({ pagamentoId, onChiudi }: { pagamentoId: string; onChiudi: () => void }) {
  const [p, setP] = useState<{ stato: StatoSatispay; importo: number; collegato?: boolean } | null | undefined>(undefined)
  useEffect(() => {
    let vivo = true
    void datiRichieste()
      .then(async (x) => {
        // In prova Satispay non c'è: arrivare qui è come aver confermato nell'app.
        if (x.modo === 'prova') (await import('../lib/richiesteProva')).pagaSatispayProva(pagamentoId)
        return x.statoSatispay(pagamentoId)
      })
      .then(
        (s) => vivo && setP(s),
        () => vivo && setP(null),
      )
    return () => {
      vivo = false
    }
  }, [pagamentoId])
  if (p === undefined) return <div className="pad stack esito"><Dettaglio>Guardo com’è andato il pagamento…</Dettaglio></div>
  const e = ritornoSatispay(p)
  return (
    <div className="pad stack esito">
      <TitoloEsito tono={e.tono}>{e.titolo}</TitoloEsito>
      {e.testi.map((t) => (
        <span key={t} className="esito-testo">{t}</span>
      ))}
      {/* Prima della richiesta nessun tasto: porterebbe a un modulo nuovo, e chi lo ricompila paga di nuovo. */}
      {p?.collegato && <Tasto onClick={onChiudi}>TORNA ALLE ISCRIZIONI</Tasto>}
    </div>
  )
}
