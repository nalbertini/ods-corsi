import type { DatiSegreteria, PersonaSeg, UltimoSollecito } from '../../lib/segreteria'
import { fraseCorta, sollecitoDi, type StatoCella, type Sollecito } from '../../lib/sollecito'
import { voceQuota } from '../../lib/ricevute'
import type { StatoCorso } from '../../lib/corsiDaPagare'
import { useCarica, type useAvviso } from './comune'

/**
 * Il sollecito di una scheda: cosa manca, il messaggio già scritto e l'ultimo
 * segnato. null finché si legge, e quando non c'è niente da sollecitare: il
 * tasto in testata allora non c'è.
 */
export function useSollecito({ d, p, oggi, giro, giroSolleciti, quotaNelVecchio, titolari, corsi }: {
  d: DatiSegreteria
  p: PersonaSeg
  oggi: string
  /** Cambia quando si salvano i DATI ANAGRAFICI: si rilegge il genitore. */
  giro: number
  /** Cambia quando un sollecito si segna o si toglie dall'elenco: si rilegge l'ultimo. */
  giroSolleciti: number
  quotaNelVecchio: boolean
  titolari?: ReadonlySet<string>
  /** I corsi della persona (`statoCorsi`): il sollecito nomina quelli scaduti. */
  corsi?: StatoCorso[]
}) {
  const dati = useCarica(
    async () => {
      // L'anagrafica serve solo per il genitore: se non si legge, il sollecito resta, scritto alla persona.
      const [listino, an] = await Promise.all([d.listino(), d.anagraficaDi(p.id).catch(() => null)])
      return { quota: voceQuota(listino.listino).voce(oggi).prezzo, anagrafica: an?.dati }
    },
    [d, p.id, oggi, giro],
  )
  const ultimo = useCarica(() => d.ultimoSollecito(p.id), [d, p.id, giroSolleciti])
  const s = dati.dato ? sollecitoDi(p, dati.dato.anagrafica, dati.dato.quota, oggi, { quotaNelVecchio, titolari, corsi }) : null
  return { s, guaio: dati.guaio, ultimo: ultimo.dato }
}

/**
 * Il riquadro del sollecito, sotto la testata: cosa manca, il messaggio e il
 * tasto che apre WhatsApp. L'app non manda niente; premere il tasto segna
 * «Sollecitato il … da …» (85-solleciti.sql).
 */
export function SollecitoWhatsApp({ d, p, s, onSollecitato, avvisa, onPersona }: {
  d: DatiSegreteria
  p: PersonaSeg
  s: Sollecito
  /** Dopo il tasto o «Annulla»: l'elenco rilegge i suoi. */
  onSollecitato: () => void
  avvisa: ReturnType<typeof useAvviso>['avvisa']
  /** Porta a PERSONA, dove si aggiunge il telefono. */
  onPersona: () => void
}) {
  // Il giro dell'elenco fa rileggere anche qui.
  const segna = () => segnaSollecito(d, p, avvisa, onSollecitato)

  return (
    <section id="sg-sollecito" className="sg-riquadro sg-sollecito" aria-label="Sollecito su WhatsApp">
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
    </section>
  )
}

/**
 * Il tasto premuto: WhatsApp si apre comunque (è il link), qui si segna
 * soltanto. L'avviso ha «Annulla», per un tasto premuto per sbaglio o un
 * messaggio che non è partito (87-solleciti-elenco.sql).
 */
export function segnaSollecito(d: DatiSegreteria, p: PersonaSeg, avvisa: ReturnType<typeof useAvviso>['avvisa'], dopo: () => void) {
  // Un doppio tocco apre WhatsApp due volte, ma segna una volta sola: se no «Annulla» ne toglierebbe uno e l'altro resterebbe.
  if (inCorso.has(p.id)) return
  inCorso.add(p.id)
  d.segnaSollecito(p.id).finally(() => inCorso.delete(p.id)).then(
    (quando) => {
      dopo()
      // Senza 85-solleciti.sql non si segna niente: niente avviso «segnato».
      if (!quando) return
      avvisa(`Sollecito di ${p.cognome} ${p.nome} segnato. Il messaggio non è partito?`, false, {
        etichetta: 'Annulla',
        fa: () =>
          d.togliSollecito(p.id).then(
            (tolto) => {
              dopo()
              avvisa(tolto ? 'Sollecito tolto.' : 'Il sollecito non si toglie più: è passato più di un quarto d’ora, o l’ha segnato un’altra persona.', !tolto)
            },
            (e: unknown) => avvisa(e instanceof Error && e.message.includes('87-') ? e.message : 'Il sollecito non si è tolto: controlla la connessione e riprova.', true),
          ),
      })
    },
    () => avvisa('WhatsApp si è aperto, ma il sollecito non è stato segnato: controlla la connessione. Il messaggio non serve rimandarlo.', true),
  )
}

const inCorso = new Set<string>()

// Il perché sotto (o al posto del) tasto, col suo tono: ogni stato nuovo va scritto qui.
const NOTA_CELLA: Record<StatoCella, { testo: string; tono: 'rosso' | 'giallo' | 'spento' } | null> = {
  tasto: null,
  fisso: { testo: 'Sembra un fisso', tono: 'giallo' },
  manca: { testo: 'Manca il telefono', tono: 'rosso' },
  sbagliato: { testo: 'Telefono da correggere', tono: 'rosso' },
  tessera: { testo: 'Solo la tessera: non si sollecita qui', tono: 'spento' },
  vecchio: { testo: 'Quota pagata nel vecchio programma: da segnare', tono: 'giallo' },
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
    <span role="cell" className="sg-cella-sollecito">
      {link && (
        <a
          className="sg-btn sg-btn-linea"
          href={link}
          target="_blank"
          rel="noreferrer"
          aria-label={`Sollecita ${p.cognome} ${p.nome} su WhatsApp`}
          onClick={(e) => {
            // La riga si clicca tutta e apre la scheda: il tasto no.
            e.stopPropagation()
            segnaSollecito(d, p, avvisa, dopo)
          }}
        >
          WhatsApp
        </a>
      )}
      {nota && <span className="sg-cella-sollecito-nota" data-tono={nota.tono}>{nota.testo}</span>}
      {ultimo && <span className="sg-cella-sollecito-ultimo">{fraseCorta(ultimo)}</span>}
    </span>
  )
}
