import { useEffect, useState } from 'react'
import type { DatiIscritto, SchedaIscritto } from '../lib/iscritto'
import { chiaveGiorno } from '../lib/sala'
import { ERRORE_SATISPAY, soldi } from '../lib/satispay'
import type { ChiPaga } from '../lib/saldoSatispay'
import { esitoQuota, puoiPagareLaQuota } from '../lib/quotaSatispay'
import { Dettaglio, Tasti, Tasto, TitoloEsito } from './ds'

/** Ogni quanto si richiede lo stato mentre il pagamento aspetta, e per quanto: poi lo si chiede col tasto CONTROLLA ORA. */
const OGNI = 4000
const VOLTE = 30
const NON_CONTROLLO = 'Non riesco a controllare il pagamento. Se hai già pagato, non pagare di nuovo.'

/**
 * Il tasto PAGA della quota associativa intera (`105-paga-quota-satispay.sql`),
 * per chi non ce l'ha o ce l'ha scaduta: da sé, o il titolare del nucleo per un
 * familiare senza accesso suo. La regola sta in `puoiPagareLaQuota`; l'importo
 * lo dà il database. In prova Satispay non c'è: si chiede conferma e il
 * pagamento nasce già arrivato.
 */
export function PagaQuota({ dati, scheda, io }: { dati: DatiIscritto; scheda: SchedaIscritto; io: string }) {
  const [chi, setChi] = useState<Pick<ChiPaga, 'adulto' | 'haAccessoProprio' | 'comeTitolare' | 'importo'> | null>(null)
  const [attivo, setAttivo] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const [conferma, setConferma] = useState(false)
  const [vado, setVado] = useState(false)
  const [guaio, setGuaio] = useState<string | null>(null)
  // `undefined`: non lo so ancora; senza saperlo non si offre di pagare.
  const [giaPagato, setGiaPagato] = useState<boolean | undefined>(undefined)
  const oggi = chiaveGiorno(new Date())

  useEffect(() => {
    let vivo = true
    void dati.statoQuota(scheda.id).then((s) => vivo && setGiaPagato(s?.stato === 'pagato'), () => undefined)
    void Promise.all([dati.saldoAttivo(), dati.chiPaga(scheda.id, io)]).then(([a, c]) => {
      if (!vivo) return
      setAttivo(a)
      setChi(c)
    })
    const su = () => setOnline(true)
    const giu = () => setOnline(false)
    window.addEventListener('online', su)
    window.addEventListener('offline', giu)
    return () => {
      vivo = false
      window.removeEventListener('online', su)
      window.removeEventListener('offline', giu)
    }
  }, [dati, scheda.id, io])

  if (!chi || giaPagato === undefined) return null
  const puoi = puoiPagareLaQuota(scheda, oggi, { ...chi, attivo, online, giaPagato })
  if ('perche' in puoi) {
    if (puoi.motivo === 'pagato') return <Dettaglio tono="fatto">{puoi.perche}</Dettaglio>
    return puoi.motivo === 'rete' ? <Dettaglio tono="avviso">{puoi.perche}. Riprova quando torni online.</Dettaglio> : null
  }

  const paga = async () => {
    setGuaio(null)
    setVado(true)
    try {
      const r = await dati.pagaQuota(scheda.id)
      if (r) return window.location.assign(r.link)
      // In prova il pagamento è già arrivato: si va alla pagina di ritorno, come dopo Satispay.
      const u = new URLSearchParams(window.location.search)
      u.set('quota', '1')
      u.set('persona', scheda.id)
      window.location.assign(`${window.location.pathname}?${u}`)
    } catch (e) {
      setGuaio(e instanceof Error ? e.message : ERRORE_SATISPAY)
      setConferma(false)
      setVado(false)
    }
  }
  const etichetta = chi.comeTitolare ? `PAGA LA QUOTA ${soldi(puoi.importo)} PER ${scheda.nome.toUpperCase()}` : `PAGA LA QUOTA ${soldi(puoi.importo)} CON SATISPAY`

  return (
    <div className="stack" style={{ gap: 8 }}>
      {conferma ? (
        <>
          <Dettaglio>In prova Satispay non si apre: il pagamento è finto e vale solo qui, nei dati inventati.</Dettaglio>
          <Tasti>
            <Tasto variante="principale" disabled={vado} onClick={() => void paga()}>
              {vado ? 'PAGO…' : `CONFERMA ${soldi(puoi.importo)}`}
            </Tasto>
            <Tasto onClick={() => setConferma(false)}>LASCIA STARE</Tasto>
          </Tasti>
        </>
      ) : (
        <Tasti>
          <Tasto variante="principale" disabled={vado} onClick={() => (dati.modo === 'prova' ? setConferma(true) : void paga())}>
            {vado ? 'APRO SATISPAY…' : etichetta}
          </Tasto>
        </Tasti>
      )}
      {guaio && <Dettaglio tono="guaio">{guaio}</Dettaglio>}
    </div>
  )
}

/** Dopo Satispay (o dopo la conferma in prova): com'è andata la quota e dove tornare. */
export function RitornoQuota({ dati, persona, onChiudi }: { dati: DatiIscritto; persona: string; onChiudi: () => void }) {
  const [p, setP] = useState<Awaited<ReturnType<DatiIscritto['statoQuota']>> | undefined>(undefined)
  const [guaio, setGuaio] = useState<string | null>(null)
  const [vado, setVado] = useState(false)
  // Dopo i giri automatici, o dopo un errore, si ricontrolla col tasto: il giro riparte da capo.
  const [giro, setGiro] = useState(0)
  const [finito, setFinito] = useState(false)

  useEffect(() => {
    let vivo = true
    let volte = 0
    let timer: ReturnType<typeof setTimeout>
    setFinito(false)
    const leggi = () =>
      dati.statoQuota(persona).then(
        (s) => {
          if (!vivo) return
          setGuaio(null)
          setP(s)
          // Satispay avvisa il server, ma la callback può tardare: intanto si richiede, per un paio di minuti.
          if (s?.stato !== 'attesa') return
          if (++volte < VOLTE) timer = setTimeout(() => void leggi(), OGNI)
          else setFinito(true)
        },
        () => vivo && setGuaio(NON_CONTROLLO),
      )
    void leggi()
    return () => {
      vivo = false
      clearTimeout(timer)
    }
  }, [dati, persona, giro])

  const riprova = async () => {
    setGuaio(null)
    setVado(true)
    try {
      const r = await dati.pagaQuota(persona)
      if (r) return window.location.assign(r.link)
    } catch (e) {
      setGuaio(e instanceof Error ? e.message : ERRORE_SATISPAY)
    }
    setVado(false)
  }

  if (p === undefined && !guaio) return <div className="pad stack esito"><Dettaglio>Guardo com’è andato il pagamento…</Dettaglio></div>
  const esito = p ? esitoQuota(p) : null
  return (
    <div className="pad stack esito">
      <TitoloEsito tono={esito?.tono ?? 'avviso'}>{esito?.titolo ?? 'PAGAMENTO'}</TitoloEsito>
      {(esito?.testi ?? (p === null ? ['Non trovo questo pagamento: chiedi alla segreteria.'] : [])).map((t) => (
        <span key={t} className="esito-testo">{t}</span>
      ))}
      {guaio && <Dettaglio tono="guaio">{guaio}</Dettaglio>}
      {(guaio || finito) && (
        <Tasto variante="principale" onClick={() => setGiro((g) => g + 1)}>
          {guaio ? 'RIPROVA A CONTROLLARE' : 'CONTROLLA ORA'}
        </Tasto>
      )}
      {p?.stato === 'non-andato' && (
        <Tasto variante="principale" disabled={vado} onClick={() => void riprova()}>
          {vado ? 'APRO SATISPAY…' : 'RIPROVA CON SATISPAY'}
        </Tasto>
      )}
      <Tasto onClick={onChiudi}>TORNA ALLA TUA PAGINA</Tasto>
    </div>
  )
}
