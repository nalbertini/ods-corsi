import type { DatiSegreteria, PersonaSeg } from '../../lib/segreteria'
import { fraseSollecitato, sollecitoDi } from '../../lib/sollecito'
import { voceQuota } from '../../lib/ricevute'
import { Guaio, useCarica, type useAvviso } from './comune'

/**
 * Il sollecito su WhatsApp, sotto i timbri della scheda: cosa manca, il
 * messaggio già scritto e il tasto che apre WhatsApp. L'app non manda
 * niente; premere il tasto segna «Sollecitato il … da …» (85-solleciti.sql).
 */
export function SollecitoWhatsApp({ d, p, oggi, giro, avvisa, onPersona }: {
  d: DatiSegreteria
  p: PersonaSeg
  oggi: string
  /** Cambia quando si salvano i DATI ANAGRAFICI: si rilegge il genitore. */
  giro: number
  avvisa: ReturnType<typeof useAvviso>['avvisa']
  /** Porta a PERSONA, dove si aggiunge il telefono. */
  onPersona: () => void
}) {
  const dati = useCarica(
    async () => {
      // L'anagrafica serve solo per il genitore: se non si legge, il sollecito resta, scritto alla persona.
      const [listino, an] = await Promise.all([d.listino(), d.anagraficaDi(p.id).catch(() => null)])
      return { quota: voceQuota(listino.listino).voce(oggi).prezzo, anagrafica: an?.dati }
    },
    [d, p.id, oggi, giro],
  )
  const ultimo = useCarica(() => d.ultimoSollecito(p.id), [d, p.id])
  if (dati.guaio) return <Guaio titolo="SOLLECITO SU WHATSAPP" testo={dati.guaio} />
  if (!dati.dato) return null
  const s = sollecitoDi(p, dati.dato.anagrafica, dati.dato.quota, oggi)
  if (!s) return null

  const segna = () => {
    // WhatsApp si apre comunque (è il link): qui si segna soltanto.
    d.segnaSollecito(p.id).then(
      () => void ultimo.ricarica(),
      () => avvisa('WhatsApp si è aperto, ma il sollecito non è stato segnato: controlla la connessione. Il messaggio non serve rimandarlo.', true),
    )
  }
  const u = ultimo.dato

  return (
    <section className="sg-riquadro sg-sollecito" aria-label="Sollecito su WhatsApp">
      <span className="sg-etichetta">SOLLECITO SU WHATSAPP</span>
      <ul className="sg-sollecito-motivi">
        {s.motivi.map((m) => (
          <li key={m.testo} data-tono={m.tono}>
            {m.testo}
          </li>
        ))}
      </ul>
      {s.link ? (
        <>
          <p className="sg-sollecito-testo">{s.testo}</p>
          <div className="sg-sollecito-tasto">
            <a className="sg-btn sg-btn-pieno" href={s.link} target="_blank" rel="noreferrer" onClick={segna}>
              Apri WhatsApp
            </a>
            <span>{`A ${s.a} · ${p.telefono}`}</span>
          </div>
          {s.fisso && <p className="sg-sollecito-avviso">Sembra un numero fisso: su WhatsApp di solito non c’è. Se hai un cellulare, aggiungilo in PERSONA.</p>}
        </>
      ) : (
        <>
          <p className="sg-sollecito-avviso" data-tono="rosso">
            {s.telefono === 'sbagliato'
              ? `Il telefono «${p.telefono}» non va bene per WhatsApp: correggilo in PERSONA → Modifica, solo cifre, poi torna qui.`
              : 'Manca il telefono: aggiungilo in PERSONA → Modifica, poi torna qui.'}
          </p>
          <div>
            <button type="button" className="sg-btn sg-btn-linea" onClick={onPersona}>
              Vai a PERSONA
            </button>
          </div>
        </>
      )}
      {u && <p className="sg-sollecito-ultimo">{fraseSollecitato(u)}</p>}
    </section>
  )
}
