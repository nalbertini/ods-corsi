import { useEffect, useState } from 'react'
import { datiRichieste, type DatiRichieste } from '../lib/richieste'
import { ERRORE_SATISPAY, esitoPagamento, soldi, type StatoSatispay } from '../lib/satispay'
import { Dettaglio, Tasto, TitoloEsito } from './ds'

/**
 * Il promemoria della pagina finale, tenuto per la scheda mentre si va
 * nell'app Satispay e si torna: la pagina di ritorno non ha più il modulo.
 */
const PROMEMORIA = (id: string) => `ods-corsi:promemoria-pagamento:${id}`
export function ricordaPromemoria(richiestaId: string, testi: string[]) {
  try {
    if (testi.length) sessionStorage.setItem(PROMEMORIA(richiestaId), JSON.stringify(testi))
  } catch {
    /* senza, al ritorno non si ripete: l'avviso c'era già nel modulo */
  }
}
function promemoriaRicordato(richiestaId: string): string[] {
  try {
    const x: unknown = JSON.parse(sessionStorage.getItem(PROMEMORIA(richiestaId)) ?? '[]')
    return Array.isArray(x) ? x.filter((t): t is string => typeof t === 'string') : []
  } catch {
    return []
  }
}

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
export function PagamentoOnline({
  richiestaId,
  chi,
  guaioIniziale,
  promemoria = [],
  onChiudi,
}: {
  richiestaId: string
  chi?: string
  guaioIniziale?: string
  /** Quello che la pagina RICHIESTA ARRIVATA ricorda anche senza Satispay: il certificato da portare. */
  promemoria?: string[]
  onChiudi: () => void
}) {
  const [d, setD] = useState<DatiRichieste | null>(null)
  const [p, setP] = useState<{ stato: StatoSatispay; importo: number; pagatoIl?: string } | null | undefined>(undefined)
  const [guaio, setGuaio] = useState<string | null>(guaioIniziale ?? null)
  const [vado, setVado] = useState(false)
  const [ricordati] = useState(() => (promemoria.length ? promemoria : promemoriaRicordato(richiestaId)))

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

  const esito = p ? esitoPagamento({ ...p, chi }) : null
  return (
    <div className="pad stack esito">
      {/* Senza pagamento e senza il modulo appena mandato (un link vecchio o sbagliato) non si sa se la richiesta c'è. */}
      <TitoloEsito tono={esito?.tono ?? 'avviso'}>{esito?.titolo ?? (chi ? 'RICHIESTA ARRIVATA' : 'PAGAMENTO')}</TitoloEsito>
      {(esito?.testi ?? ['Il pagamento con Satispay non è ancora partito.']).map((t) => (
        <span key={t} className="esito-testo">{t}</span>
      ))}
      {guaio && <Dettaglio tono="guaio">{guaio}</Dettaglio>}
      {ricordati.map((t) => (
        <span key={t} className="esito-testo">{t}</span>
      ))}
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
