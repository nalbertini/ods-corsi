import { useEffect, useState } from 'react'
import type { DatiIscritto, SchedaIscritto } from '../lib/iscritto'
import type { Ricevuta } from '../lib/ricevute'
import { chiaveGiorno } from '../lib/sala'
import { ERRORE_SATISPAY, soldi } from '../lib/satispay'
import { DA_PAGARE, esitoCorso, puoiPagareIlCorso, statoCorsiDi, type ChiPagaCorsi, type Formula } from '../lib/corsoSatispay'
import type { StatoCorso } from '../lib/corsiDaPagare'
import { Dettaglio, Etichetta, Riquadro, Tasti, Tasto, Titoletto, TitoloEsito } from './ds'

/** Ogni quanto si richiede lo stato mentre il pagamento aspetta, e per quanto: poi lo si chiede col tasto CONTROLLA ORA. */
const OGNI = 4000
const VOLTE = 30
const NON_CONTROLLO = 'Non riesco a controllare il pagamento. Se hai già pagato, non pagare di nuovo.'

const FORMULA: Record<Formula, string> = { annuale: 'ANNUALE', trimestre: 'TRIMESTRE' }

/**
 * La sezione CORSI della pagina «in regola» (`106-paga-corso-satispay.sql`): un
 * riquadro per ogni corso in corso non ancora pagato, col tasto PAGA se il
 * corso è semplice (una sola riga di prezzo). Se non c'è nulla da pagare, o la
 * pagina non sa ancora i prezzi, non compare. La regola sta in
 * `puoiPagareIlCorso`, le cifre le dà il database.
 */
export function CorsiDaPagare({ dati, scheda, io, ricevute }: { dati: DatiIscritto; scheda: SchedaIscritto; io: string; ricevute: Ricevuta[] }) {
  const [chi, setChi] = useState<ChiPagaCorsi | null>(null)
  const [attivo, setAttivo] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const oggi = chiaveGiorno(new Date())

  useEffect(() => {
    let vivo = true
    void Promise.all([dati.saldoAttivo(), dati.chiPagaCorsi(scheda.id, io)]).then(
      ([a, c]) => {
        if (!vivo) return
        setAttivo(a)
        setChi(c)
      },
      () => undefined,
    )
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
  const righe = statoCorsiDi(scheda, ricevute, chi, oggi).filter((s) => DA_PAGARE.includes(s.come))
  if (!righe.length) return null
  return (
    <section>
      <Titoletto conto={righe.length}>CORSI</Titoletto>
      <div className="pad mie-schede">
        {righe.map((s) => (
          <PagaCorso key={s.corsoId} dati={dati} scheda={scheda} stato={s} chi={chi} attivo={attivo} online={online} />
        ))}
      </div>
    </section>
  )
}

function PagaCorso({ dati, scheda, stato, chi, attivo, online }: { dati: DatiIscritto; scheda: SchedaIscritto; stato: StatoCorso; chi: ChiPagaCorsi; attivo: boolean; online: boolean }) {
  const [conferma, setConferma] = useState(false)
  const [vado, setVado] = useState(false)
  const [guaio, setGuaio] = useState<string | null>(null)
  const prezzi = chi.corsi.find((c) => c.corsoId === stato.corsoId)
  const puoi = puoiPagareIlCorso(stato, { ...chi, attivo, online, giaPagato: prezzi?.pagato ?? false, prezzi, segreteria: prezzi?.segreteria })
  const formula = 'formula' in puoi ? puoi.formula : stato.formula

  const paga = async () => {
    if (!('formula' in puoi)) return
    setGuaio(null)
    setVado(true)
    try {
      const r = await dati.pagaCorso(scheda.id, stato.corsoId, puoi.formula)
      if (r) return window.location.assign(r.link)
      // In prova il pagamento è già arrivato: si va alla pagina di ritorno, come dopo Satispay.
      const u = new URLSearchParams(window.location.search)
      u.set('corso', stato.corsoId)
      u.set('persona', scheda.id)
      window.location.assign(`${window.location.pathname}?${u}`)
    } catch (e) {
      setGuaio(e instanceof Error ? e.message : ERRORE_SATISPAY)
      setConferma(false)
      setVado(false)
    }
  }

  const titolo = `${stato.corso.toUpperCase()} · ${prezzi?.segreteria ? 'PIÙ CORSI' : formula ? FORMULA[formula] : 'DA PAGARE'}`
  return (
    <Riquadro tono={'formula' in puoi ? 'prova' : undefined} stretto>
      <Etichetta>{titolo}</Etichetta>
      {'formula' in puoi ? (
        <>
          <span className="num cifra">{soldi(puoi.importo)}</span>
          <Dettaglio tono="avviso">{stato.come === 'da_pagare' ? 'Non hai ancora pagato il corso per quest’anno.' : 'Il corso è finito: è da rinnovare.'}</Dettaglio>
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
                {vado ? 'APRO SATISPAY…' : chi.comeTitolare ? `PAGA ${soldi(puoi.importo)} PER ${scheda.nome.toUpperCase()}` : `PAGA ${soldi(puoi.importo)} CON SATISPAY`}
              </Tasto>
            </Tasti>
          )}
        </>
      ) : prezzi?.segreteria ? (
        <>
          <Dettaglio tono="avviso">Qui c’è uno sconto o più corsi insieme: il prezzo lo fa la segreteria.</Dettaglio>
          <Dettaglio>Chiedi alla segreteria o pagala in palestra.</Dettaglio>
        </>
      ) : (
        <Dettaglio tono={puoi.motivo === 'pagato' ? 'fatto' : 'avviso'}>{puoi.motivo === 'rete' ? `${puoi.perche}. Riprova quando torni online.` : puoi.perche}</Dettaglio>
      )}
      {guaio && <Dettaglio tono="guaio">{guaio}</Dettaglio>}
    </Riquadro>
  )
}

/** Dopo Satispay (o dopo la conferma in prova): com'è andato il corso e dove tornare. */
export function RitornoCorso({ dati, persona, corso, onChiudi }: { dati: DatiIscritto; persona: string; corso: string; onChiudi: () => void }) {
  const [p, setP] = useState<Awaited<ReturnType<DatiIscritto['statoCorso']>> | undefined>(undefined)
  const [nome, setNome] = useState('il corso')
  const [guaio, setGuaio] = useState<string | null>(null)
  // Dopo i giri automatici, o dopo un errore, si ricontrolla col tasto: il giro riparte da capo.
  const [giro, setGiro] = useState(0)
  const [finito, setFinito] = useState(false)

  useEffect(() => {
    let vivo = true
    void dati.scheda(persona).then((s) => vivo && setNome(s?.corsi.find((c) => c.id === corso)?.nome ?? 'il corso'), () => undefined)
    return () => {
      vivo = false
    }
  }, [dati, persona, corso])

  useEffect(() => {
    let vivo = true
    let volte = 0
    let timer: ReturnType<typeof setTimeout>
    setFinito(false)
    const leggi = () =>
      dati.statoCorso(persona, corso).then(
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
  }, [dati, persona, corso, giro])

  if (p === undefined && !guaio) return <div className="pad stack esito"><Dettaglio>Guardo com’è andato il pagamento…</Dettaglio></div>
  const esito = p ? esitoCorso({ ...p, corso: nome }) : null
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
      {p?.stato === 'non-andato' && <Dettaglio>Per riprovare torna alla tua pagina e paga di nuovo il corso.</Dettaglio>}
      <Tasto onClick={onChiudi}>TORNA ALLA TUA PAGINA</Tasto>
    </div>
  )
}
