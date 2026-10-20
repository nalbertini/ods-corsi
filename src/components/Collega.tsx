import { useEffect, useState } from 'react'
import { account, esci, serveAccesso, type Account } from '../lib/accesso'
import { autorizzazioneDa, chiChiede, puoCollegare, rispondi } from '../lib/collega'
import { Etichetta, Riquadro, Tasto, Titoletto } from './ds'
import { Accesso, ChiSei, UnAttimo } from './Porta'

/**
 * Dove Supabase manda chi collega Claude al suo account (Authentication → OAuth Server, «Authorization Path»
 * `collega/`): si entra, si legge cosa Claude potrà fare e si dice CONSENTI o NO, GRAZIE. Poi si torna a Claude.
 * Chi non ha l'amministrazione non può: Claude registra in CONTABILITÀ.
 */
export function Collega() {
  const id = autorizzazioneDa(window.location.search)
  const [chi, setChi] = useState<Account | null | undefined>(undefined)
  // Chi chiede, da Supabase: finché non si sa, «un attimo» e niente tasti.
  const [nome, setNome] = useState<string | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [aspetta, setAspetta] = useState(false)

  useEffect(() => {
    if (!serveAccesso) return
    account().then(setChi, () => setChi(null))
  }, [])

  // Chi ha già consentito torna subito a Claude.
  useEffect(() => {
    if (!id || !chi) return
    if (!puoCollegare(chi.persona)) return setNome('Claude')
    chiChiede(id).then(
      (r) => ('torna' in r ? window.location.replace(r.torna) : setNome(r.nome)),
      // `chiChiede` lancia solo messaggi per chi usa l'app.
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
      <div className="accesso pad" style={{ paddingTop: 20, paddingBottom: 20 }}>
        <Riquadro>
          <span style={{ fontSize: 15, lineHeight: 1.45 }}>
            Questa pagina si apre da Claude, quando lo colleghi a ODS Corsi dalle sue impostazioni (Connettori).
          </span>
        </Riquadro>
      </div>
    )
  if (chi === undefined) return <UnAttimo />
  if (!chi) return <Accesso collega onEntrato={() => void account().then(setChi, () => setChi(null))} />
  if (!nome && !errore) return <UnAttimo />
  const chiede = nome ?? 'Claude'

  return (
    <div className="accesso">
      {/* Uscendo si resta qui, con l'autorizzazione: chi è entrato con l'account sbagliato rientra con quello giusto. */}
      {chi.persona && <ChiSei chi={chi.persona} onEsci={() => void esci(`collega/${window.location.search}`)} />}
      <Titoletto>COLLEGARE {chiede.toUpperCase()}?</Titoletto>
      <div className="pad stack" style={{ gap: 14, paddingBottom: 20 }}>
        {puoCollegare(chi.persona) ? (
          <>
            <span className="passo-dettaglio" data-tono="testo" style={{ fontSize: 15 }}>
              <b>{chiede}</b> chiede di usare ODS Corsi con il tuo account, per registrare in CONTABILITÀ le fatture e gli
              scontrini che gli fotografi.
            </span>
            <Riquadro stretto>
              <span id="collega-potra"><Etichetta>POTRÀ</Etichetta></span>
              <ul className="collega-elenco" data-tono="si" aria-labelledby="collega-potra">
                <li>Leggere voci, totali, il saldo del Conto Corrente e le spese da classificare</li>
                <li>Registrare un’uscita o un’entrata, solo dopo il tuo «ok» in chat</li>
              </ul>
            </Riquadro>
            <Riquadro stretto>
              <span id="collega-non-potra"><Etichetta>NON POTRÀ</Etichetta></span>
              <ul className="collega-elenco" data-tono="no" aria-labelledby="collega-non-potra">
                <li>Vedere i nomi degli iscritti e il saldo della Cassa Contanti</li>
                <li>Annullare movimenti, fare giroconti, chiudere la cassa</li>
                <li>Cambiare voci e casse</li>
              </ul>
            </Riquadro>
            <span className="passo-dettaglio" style={{ fontSize: 14 }}>
              Le foto le vede {chiede}, non ODS: solo documenti di fornitori, niente compensi né ricevute di iscritti. Il
              collegamento si toglie da {chiede}, in Impostazioni → Connettori.
            </span>
            <Tasto variante="vai" disabled={aspetta || !nome} onClick={() => void decidi(true)}>
              {aspetta ? 'UN ATTIMO…' : 'CONSENTI'}
            </Tasto>
            <Tasto variante="linea" disabled={aspetta} onClick={() => void decidi(false)}>
              NO, GRAZIE
            </Tasto>
          </>
        ) : (
          <>
            <Riquadro tono="guaio">
              <Etichetta>NON SI PUÒ</Etichetta>
              <span style={{ fontSize: 15, lineHeight: 1.45 }}>
                {chiede} registra in CONTABILITÀ, e la contabilità la cura l’amministrazione: il tuo account non ce l’ha. Se
                serve, chiedi a chi cura l’app.
              </span>
            </Riquadro>
            <Tasto variante="linea" disabled={aspetta} onClick={() => void decidi(false)}>
              TORNA A {chiede.toUpperCase()}
            </Tasto>
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
