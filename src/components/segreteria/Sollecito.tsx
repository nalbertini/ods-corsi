import type { DatiSegreteria, PersonaSeg, UltimoSollecito } from '../../lib/segreteria'
import { fraseCorta, fraseSollecitato, sollecitoDi, type StatoCella, type Sollecito } from '../../lib/sollecito'
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

  const segna = () => segnaSollecito(d, p, avvisa, () => void ultimo.ricarica())
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

/**
 * Il tasto premuto: WhatsApp si apre comunque (è il link), qui si segna
 * soltanto. L'avviso ha «Annulla», per un tasto premuto per sbaglio o un
 * messaggio che non è partito (86-solleciti-elenco.sql).
 */
export function segnaSollecito(d: DatiSegreteria, p: PersonaSeg, avvisa: ReturnType<typeof useAvviso>['avvisa'], dopo: () => void) {
  d.segnaSollecito(p.id).then(
    () => {
      dopo()
      avvisa(`Sollecito di ${p.cognome} ${p.nome} segnato. Il messaggio non è partito?`, false, {
        etichetta: 'Annulla',
        fa: () =>
          d.togliSollecito(p.id).then(
            (tolto) => {
              dopo()
              avvisa(tolto ? 'Sollecito tolto.' : 'Il sollecito non si toglie più: è passato più di un quarto d’ora, o l’ha segnato un’altra persona.', !tolto)
            },
            () => avvisa('Il sollecito non si è tolto: controlla la connessione e riprova.', true),
          ),
      })
    },
    () => avvisa('WhatsApp si è aperto, ma il sollecito non è stato segnato: controlla la connessione. Il messaggio non serve rimandarlo.', true),
  )
}

const NOTA_CELLA: Partial<Record<StatoCella, string>> = {
  fisso: 'Sembra un fisso',
  manca: 'Manca il telefono',
  sbagliato: 'Telefono da correggere',
  tessera: 'Solo la tessera: non si sollecita qui',
  vecchio: 'Pagato nel vecchio programma: segnalo prima',
}

/** La cella WHATSAPP di una riga dell'elenco ISCRITTI filtrato: il tasto non apre la scheda. */
export function CellaSollecito({ d, p, cella, ultimo, avvisa, dopo }: {
  d: DatiSegreteria
  p: PersonaSeg
  cella: { stato: StatoCella; sollecito: Sollecito | null } | null
  ultimo?: UltimoSollecito
  avvisa: ReturnType<typeof useAvviso>['avvisa']
  /** Dopo il tasto o «Annulla»: si rilegge chi è sollecitato, senza ricaricare l'elenco. */
  dopo: () => void
}) {
  const link = cella?.sollecito?.link
  const nota = cella ? NOTA_CELLA[cella.stato] : undefined
  return (
    <span role="cell" className="sg-cella-sollecito" onClick={(e) => link && e.stopPropagation()}>
      {link && (
        <a className="sg-btn sg-btn-linea" href={link} target="_blank" rel="noreferrer" aria-label={`Sollecita ${p.cognome} ${p.nome} su WhatsApp`} onClick={() => segnaSollecito(d, p, avvisa, dopo)}>
          WhatsApp
        </a>
      )}
      {nota && <span className="sg-cella-sollecito-nota" data-tono={cella?.stato === 'fisso' ? 'giallo' : cella?.stato === 'tessera' ? 'spento' : 'rosso'}>{nota}</span>}
      {ultimo && <span className="sg-cella-sollecito-ultimo">{fraseCorta(ultimo)}</span>}
    </span>
  )
}
