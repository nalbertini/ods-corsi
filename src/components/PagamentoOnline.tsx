import { useEffect, useState } from 'react'
import { datiRichieste, type DatiRichieste } from '../lib/richieste'
import { ERRORE_SATISPAY, esitoPagamento, soldi, type StatoSatispay } from '../lib/satispay'
import { Dettaglio, Tasto, TitoloEsito } from './ds'

/** Ogni quanto si richiede lo stato mentre il pagamento aspetta, e per quanto: poi lo si chiede col tasto. */
const OGNI = 4000
const VOLTE = 30

/**
 * Dopo MANDA E PAGA CON SATISPAY, e al ritorno dall'app Satispay
 * (`iscrizioni/?pagamento=<richiesta>`): com'è andato il pagamento, e il tasto
 * per riaprirlo o riprovare. La pagina ha l'indirizzo suo: chi la chiude può
 * tornarci e pagare dopo. Lo stato lo scrive la Edge Function dopo averlo
 * chiesto a Satispay, non questa pagina.
 */
export function PagamentoOnline({ richiestaId, chi, onChiudi }: { richiestaId: string; chi?: string; onChiudi: () => void }) {
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
    void datiRichieste().then((x) => {
      if (!vivo) return
      setD(x)
      void leggi(x)
    })
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
      if (r?.link) return window.location.assign(r.link)
      setP(await d.statoPagamento(richiestaId))
    } catch (e) {
      setGuaio(e instanceof Error ? e.message : ERRORE_SATISPAY)
    }
    setVado(false)
  }

  if (p === undefined && !guaio) return <div className="pad stack esito"><Dettaglio>Guardo com’è andato il pagamento…</Dettaglio></div>

  const esito = p ? esitoPagamento({ ...p, chi }) : null
  return (
    <div className="pad stack esito">
      {esito ? <TitoloEsito tono={esito.tono}>{esito.titolo}</TitoloEsito> : <TitoloEsito tono="avviso">RICHIESTA ARRIVATA</TitoloEsito>}
      {(esito?.testi ?? ['Il pagamento con Satispay non è ancora partito.']).map((t) => (
        <span key={t} className="esito-testo">{t}</span>
      ))}
      {guaio && <Dettaglio tono="guaio">{guaio}</Dettaglio>}
      {p?.stato === 'pagato' ? (
        <>
          <span className="esito-testo">La segreteria controlla il modulo e il documento, e ti scrive se manca qualcosa. La ricevuta della palestra te la dà la segreteria.</span>
          <Tasto onClick={onChiudi}>TORNA ALLE ISCRIZIONI</Tasto>
        </>
      ) : (
        <>
          <Tasto variante="principale" disabled={vado || !d} onClick={() => void paga()}>
            {vado ? 'APRO SATISPAY…' : p?.stato === 'non-andato' ? 'RIPROVA CON SATISPAY' : p ? `PAGA ${soldi(p.importo)} CON SATISPAY` : 'PAGA CON SATISPAY'}
          </Tasto>
          {p?.stato === 'non-andato' ? (
            <Tasto onClick={onChiudi}>PAGO IN SEGRETERIA</Tasto>
          ) : (
            <Dettaglio>Puoi pagare anche più tardi da questa pagina: salva il link o tienila aperta. Oppure paga in segreteria.</Dettaglio>
          )}
        </>
      )}
    </div>
  )
}
