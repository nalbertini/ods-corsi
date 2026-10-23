import { useEffect, useState } from 'react'
import type { DatiIscritto, SchedaIscritto } from '../lib/iscritto'
import type { Ricevuta } from '../lib/ricevute'
import { chiaveGiorno } from '../lib/sala'
import { ERRORE_SATISPAY, soldi } from '../lib/satispay'
import { SALDO_PAGATO, SERVE_RETE, esitoSaldo, puoiPagareIlSaldo, type ChiPaga } from '../lib/saldoSatispay'
import { pagamentoDi } from '../lib/segreteria'
import { Dettaglio, Tasti, Tasto, TitoloEsito } from './ds'

/** Ogni quanto si richiede lo stato mentre il pagamento aspetta, e per quanto: poi lo si chiede col tasto. */
const OGNI = 4000
const VOLTE = 30

/** Dove Satispay riporta chi ha pagato il saldo: la ricevuta e la persona, nell'indirizzo (`iscritti/?saldo=…&persona=…`). */
export function ritornoDelSaldo(ricerca: string): { ricevuta: string; persona: string } | null {
  const u = new URLSearchParams(ricerca)
  const ricevuta = u.get('saldo')
  const persona = u.get('persona')
  return ricevuta && persona ? { ricevuta, persona } : null
}

/**
 * Il tasto PAGA del resto della quota associativa (`103-saldo-satispay.sql`),
 * per chi ha pagato in parte con una ricevuta: da sé, o il titolare del nucleo
 * per un familiare senza accesso suo. La regola sta in `puoiPagareIlSaldo`;
 * l'importo lo ricalcola il database. In prova Satispay non c'è: si chiede
 * conferma e il pagamento nasce già arrivato.
 */
export function PagaSaldo({ dati, scheda, io, ricevute }: { dati: DatiIscritto; scheda: SchedaIscritto; io: string; ricevute: Ricevuta[] }) {
  const [chi, setChi] = useState<Pick<ChiPaga, 'adulto' | 'haAccessoProprio' | 'comeTitolare'> | null>(null)
  const [attivo, setAttivo] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const [conferma, setConferma] = useState(false)
  const [vado, setVado] = useState(false)
  const [guaio, setGuaio] = useState<string | null>(null)
  const [giaPagato, setGiaPagato] = useState(false)
  const oggi = chiaveGiorno(new Date())
  // La ricevuta è «numero/anno»: l'id serve al database per ricalcolare quel che manca.
  const numero = pagamentoDi(scheda, oggi).ricevuta
  const ricevuta = ricevute.find((r) => !r.annullataIl && r.personaId === scheda.id && `${r.numero}/${r.anno}` === numero)

  // La scheda dice «mancano» finché la segreteria non fa la ricevuta del saldo: se è già arrivato, non si paga due volte.
  useEffect(() => {
    let vivo = true
    if (ricevuta) void dati.statoSaldo(scheda.id, ricevuta.id).then((s) => vivo && setGiaPagato(s?.stato === 'pagato'), () => undefined)
    return () => {
      vivo = false
    }
  }, [dati, scheda.id, ricevuta?.id])

  useEffect(() => {
    let vivo = true
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

  if (!chi) return null
  const puoi = puoiPagareIlSaldo(scheda, oggi, { ...chi, attivo, online, giaPagato })
  if ('perche' in puoi) {
    if (puoi.perche === SALDO_PAGATO) return <Dettaglio tono="fatto">{puoi.perche}</Dettaglio>
    return puoi.perche === SERVE_RETE ? <Dettaglio tono="avviso">{puoi.perche}. Riprova quando torni online.</Dettaglio> : null
  }
  if (!ricevuta) return null

  const paga = async () => {
    setGuaio(null)
    setVado(true)
    try {
      const r = await dati.pagaSaldo(scheda.id, ricevuta.id)
      if (r) return window.location.assign(r.link)
      // In prova il pagamento è già arrivato: si va alla pagina di ritorno, come dopo Satispay.
      const u = new URLSearchParams(window.location.search)
      u.set('saldo', ricevuta.id)
      u.set('persona', scheda.id)
      window.location.assign(`${window.location.pathname}?${u}`)
    } catch (e) {
      setGuaio(e instanceof Error ? e.message : ERRORE_SATISPAY)
      setConferma(false)
      setVado(false)
    }
  }
  const etichetta = chi.comeTitolare ? `PAGA ${soldi(puoi.mancano)} PER ${scheda.nome.toUpperCase()}` : `PAGA ${soldi(puoi.mancano)} CON SATISPAY`

  return (
    <div className="stack" style={{ gap: 8 }}>
      {conferma ? (
        <>
          <Dettaglio>In prova Satispay non si apre: il pagamento è finto e vale solo qui, nei dati inventati.</Dettaglio>
          <Tasti>
            <Tasto variante="principale" disabled={vado} onClick={() => void paga()}>
              {vado ? 'PAGO…' : 'CONFERMA'}
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

/**
 * Dopo Satispay (o dopo la conferma in prova): com'è andato il saldo e dove
 * tornare. Lo stato lo scrive la Edge Function dopo averlo chiesto a Satispay;
 * qui lo si rilegge finché è in attesa.
 */
export function RitornoSaldo({
  dati,
  persona,
  ricevuta,
  altri,
  onChiudi,
}: {
  dati: DatiIscritto
  persona: string
  ricevuta: string
  /** Gli altri del nucleo che sembrano avere ancora un resto: quelli già pagati con Satispay si tolgono qui. */
  altri: Array<{ persona: string; ricevuta: string; chi: string; mancano: number }>
  onChiudi: () => void
}) {
  const [p, setP] = useState<Awaited<ReturnType<DatiIscritto['statoSaldo']>> | undefined>(undefined)
  const [guaio, setGuaio] = useState<string | null>(null)
  const [vado, setVado] = useState(false)
  const [restano, setRestano] = useState<{ chi: string; mancano: number } | null>(null)

  useEffect(() => {
    let vivo = true
    void Promise.all(altri.map((x) => dati.statoSaldo(x.persona, x.ricevuta).catch(() => null))).then((st) => {
      if (vivo) setRestano(altri.find((_, i) => st[i]?.stato !== 'pagato') ?? null)
    })
    return () => {
      vivo = false
    }
    // `altri` si rifà a ogni giro: conta quando cambia davvero.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dati, altri.map((x) => x.ricevuta).join()])

  useEffect(() => {
    let vivo = true
    let volte = 0
    let timer: ReturnType<typeof setTimeout>
    const leggi = () =>
      dati.statoSaldo(persona, ricevuta).then(
        (s) => {
          if (!vivo) return
          setP(s)
          // Satispay avvisa il server, ma la callback può tardare: intanto si richiede, per un paio di minuti.
          if (s?.stato === 'attesa' && ++volte < VOLTE) timer = setTimeout(() => void leggi(), OGNI)
        },
        (e) => vivo && setGuaio(e instanceof Error ? e.message : ERRORE_SATISPAY),
      )
    void leggi()
    return () => {
      vivo = false
      clearTimeout(timer)
    }
  }, [dati, persona, ricevuta])

  const riprova = async () => {
    setGuaio(null)
    setVado(true)
    try {
      const r = await dati.pagaSaldo(persona, ricevuta)
      if (r) return window.location.assign(r.link)
    } catch (e) {
      setGuaio(e instanceof Error ? e.message : ERRORE_SATISPAY)
    }
    setVado(false)
  }

  if (p === undefined && !guaio) return <div className="pad stack esito"><Dettaglio>Guardo com’è andato il pagamento…</Dettaglio></div>
  const esito = p ? esitoSaldo(p, restano) : null
  return (
    <div className="pad stack esito">
      <TitoloEsito tono={esito?.tono ?? 'avviso'}>{esito?.titolo ?? 'PAGAMENTO'}</TitoloEsito>
      {(esito?.testi ?? ['Non trovo questo pagamento: chiedi alla segreteria.']).map((t) => (
        <span key={t} className="esito-testo">{t}</span>
      ))}
      {guaio && <Dettaglio tono="guaio">{guaio}</Dettaglio>}
      {p?.stato === 'non-andato' && (
        <Tasto variante="principale" disabled={vado} onClick={() => void riprova()}>
          {vado ? 'APRO SATISPAY…' : 'RIPROVA CON SATISPAY'}
        </Tasto>
      )}
      <Tasto onClick={onChiudi}>TORNA ALLA TUA PAGINA</Tasto>
    </div>
  )
}
