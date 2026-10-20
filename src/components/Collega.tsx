import { useEffect, useState } from 'react'
import { account, serveAccesso, type Account } from '../lib/accesso'
import { autorizzazioneDa, chiChiede, puoCollegare, rispondi } from '../lib/collega'
import { Riquadro, Titoletto } from './ds'
import { Accesso, ChiSei, UnAttimo } from './Porta'

/**
 * Dove Supabase manda chi collega Claude al suo account (Authentication → OAuth Server, «Authorization Path»
 * `collega/`): si entra, si legge cosa Claude potrà fare e si dice CONSENTI o NO, GRAZIE. Poi si torna a Claude.
 * Chi non ha l'amministrazione non può: Claude registra in CONTABILITÀ.
 */
export function Collega() {
  const id = autorizzazioneDa(window.location.search)
  const [chi, setChi] = useState<Account | null | undefined>(undefined)
  const [nome, setNome] = useState('Claude')
  const [errore, setErrore] = useState<string | null>(null)
  const [aspetta, setAspetta] = useState(false)

  useEffect(() => {
    if (!serveAccesso) return
    account().then(setChi, () => setChi(null))
  }, [])

  // Chi ha già consentito torna subito a Claude.
  useEffect(() => {
    if (!id || !chi || !puoCollegare(chi.persona)) return
    chiChiede(id).then(
      (r) => ('torna' in r ? window.location.replace(r.torna) : setNome(r.nome)),
      (x: Error) => setErrore(x.message),
    )
  }, [id, chi])

  const decidi = async (consenti: boolean) => {
    if (!id) return
    setAspetta(true)
    setErrore(null)
    try {
      window.location.replace(await rispondi(id, consenti))
    } catch (x) {
      setErrore(x instanceof Error ? x.message : 'Il collegamento non è riuscito')
      setAspetta(false)
    }
  }

  if (!serveAccesso || !id)
    return (
      <div className="pad" style={{ paddingTop: 20 }}>
        <Riquadro tono="guaio">
          <span style={{ fontSize: 15, lineHeight: 1.45 }}>
            Questa pagina si apre da Claude, quando lo colleghi a ODS Corsi dalle sue impostazioni (Connettori).
          </span>
        </Riquadro>
      </div>
    )
  if (chi === undefined) return <UnAttimo />
  if (!chi) return <Accesso collega onEntrato={() => void account().then(setChi, () => setChi(null))} />

  return (
    <div className="accesso">
      {chi.persona && <ChiSei chi={chi.persona} />}
      <Titoletto>COLLEGARE {nome.toUpperCase()}?</Titoletto>
      <div className="pad stack" style={{ gap: 14, paddingBottom: 20 }}>
        {puoCollegare(chi.persona) ? (
          <>
            <span className="passo-dettaglio" style={{ fontSize: 15 }}>
              <b>{nome}</b> chiede di usare ODS Corsi con il tuo account, per registrare in CONTABILITÀ le fatture e gli
              scontrini che gli fotografi.
            </span>
            <span className="modulo-etichetta">POTRÀ</span>
            <ul className="collega-elenco" data-tono="si">
              <li>Leggere le voci, le casse e i movimenti che somigliano a quello nuovo</li>
              <li>Registrare un’uscita o un’entrata, solo dopo il tuo «ok» in chat</li>
            </ul>
            <span className="modulo-etichetta">NON POTRÀ</span>
            <ul className="collega-elenco" data-tono="no">
              <li>Vedere iscritti, pagamenti e ricevute</li>
              <li>Annullare movimenti, fare giroconti, chiudere la cassa</li>
              <li>Cambiare voci e casse</li>
            </ul>
            <span className="passo-dettaglio" style={{ fontSize: 14 }}>
              Le foto le vede {nome}, non ODS: solo documenti di fornitori, niente compensi né ricevute di iscritti. Il
              collegamento si toglie da {nome}, in Impostazioni → Connettori.
            </span>
            <button type="button" className="btn btn-go" disabled={aspetta} onClick={() => void decidi(true)}>
              {aspetta ? 'UN ATTIMO…' : 'CONSENTI'}
            </button>
            <button type="button" className="btn btn-ghost" disabled={aspetta} onClick={() => void decidi(false)}>
              NO, GRAZIE
            </button>
          </>
        ) : (
          <>
            <Riquadro tono="guaio">
              <span className="modulo-etichetta">NON SI PUÒ</span>
              <span style={{ fontSize: 15, lineHeight: 1.45 }}>
                {nome} registra in CONTABILITÀ, e la contabilità la cura l’amministrazione: il tuo account non ce l’ha. Se
                serve, chiedi a chi cura l’app.
              </span>
            </Riquadro>
            <button type="button" className="btn btn-ghost" disabled={aspetta} onClick={() => void decidi(false)}>
              TORNA A {nome.toUpperCase()}
            </button>
          </>
        )}
        {errore && (
          <span role="alert" style={{ fontSize: 15, fontWeight: 600, color: 'var(--rosso-testo)', lineHeight: 1.4 }}>
            {errore}
          </span>
        )}
      </div>
    </div>
  )
}
