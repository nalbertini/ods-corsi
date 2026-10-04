import { contoSala, fase } from '../../lib/tablet'
import type { DatiTablet, LezioneSala } from '../../lib/tablet'
import { chiaveGiorno, giornoPerEsteso } from '../../lib/sala'
import { Spunta } from '../Icons'
import { EtichettaAttivita } from '../ds'
import { Guaio, Indietro, orario } from './comune'
import { FasciaTocco, useTocchi } from './tocchi'
import { Kanji } from '../Kanji'

/**
 * I nomi da toccare.
 *
 * Il tocco segna subito, senza domande: chi arriva ha la borsa in mano e dieci
 * persone dietro (vedi `useTocchi`: ANNULLA, la coda senza rete).
 */
export function TabletPresenza({
  d,
  lezione,
  adesso,
  onIndietro,
  onCambiato,
}: {
  d: DatiTablet
  lezione: LezioneSala
  adesso: Date
  onIndietro: () => void
  /** Un tocco o un annullo è arrivato al server: il conto nella barra in basso va riletto. */
  onCambiato?: () => void
}) {
  const { nomi, guaio, fascia, attesa, tocca, annulla, chiudi } = useTocchi(d, lezione, onCambiato)

  const passata = fase(lezione, adesso) !== 'aperta'
  const presenti = nomi?.filter((p) => p.segnato || attesa.has(p.personaId)).length ?? contoSala(lezione).presenti
  const giorno = giornoPerEsteso(chiaveGiorno(new Date(lezione.inizio)))

  return (
    <div className="tb-corpo tb-pila">
      <div className="tb-barra">
        <Indietro onClick={onIndietro} />
        <div className="stack grow" style={{ gap: 2, minWidth: 0 }}>
          <span className="ob tb-titolo">{lezione.corso.toUpperCase()}</span>
          <span className="num tb-quando chi-kanji" style={{ gap: 8 }}>
            <Kanji segni={lezione.kanji} />
            <span>
              {passata ? `${giorno.toUpperCase()} · ${orario(lezione)}` : orario(lezione)}
              {/* Il nome di chi la fa non si spazia: è il nome di una persona. */}
              {lezione.istruttori && <span style={{ letterSpacing: 0 }}> · {lezione.istruttori}</span>}
            </span>
            <EtichettaAttivita nome={lezione.attivita} grande />
          </span>
        </div>
        {passata && <span className="num tb-bollino" style={{ background: 'var(--giallo)' }}>LEZIONE PASSATA</span>}
        <span className="row" style={{ alignItems: 'baseline', gap: 8 }}>
          <span className="num" style={{ fontSize: 48, fontWeight: 700, lineHeight: 1 }}>{presenti}</span>
          <span className="num" style={{ fontSize: 22, color: 'var(--dim)' }}>/ {nomi?.length ?? lezione.iscritti}</span>
        </span>
      </div>

      <span className="ob tb-invito">{passata ? 'ERI A QUESTA LEZIONE? TOCCA IL TUO NOME' : 'TOCCA IL TUO NOME'}</span>

      {guaio && <Guaio titolo="ELENCO NON LETTO" testo={guaio} />}
      {!guaio && nomi === null && <p className="tb-nota">Sto leggendo gli iscritti…</p>}
      {nomi !== null && nomi.length === 0 && <p className="tb-nota">Questo corso non ha ancora iscritti.</p>}

      <div className="tb-tessere">
        {nomi?.map((p) => {
          const inCoda = attesa.has(p.personaId)
          const fatto = p.segnato || inCoda
          return (
            <button
              key={p.personaId}
              type="button"
              className="tb-tessera"
              data-fatto={fatto}
              data-attesa={inCoda || undefined}
              onClick={() => tocca(p)}
              aria-label={`${p.nome} ${p.sigla}${inCoda ? ': segnato, in attesa di rete' : fatto ? ': già segnato' : ''}`}
            >
              <span className="stack grow" style={{ gap: 2 }}>
                <span>
                  {p.nome} {p.sigla}
                </span>
                {inCoda && <span className="num tb-tessera-attesa">IN ATTESA DI RETE</span>}
              </span>
              {fatto && <Spunta size={26} />}
            </button>
          )
        })}
      </div>

      <div className="grow" />
      <span className="tb-nota">Non trovi il tuo nome? Chiedi all'istruttore: qui ci sono solo gli iscritti a questo corso.</span>

      {fascia && <FasciaTocco fascia={fascia} passata={passata} giorno={giorno} onAnnulla={annulla} onChiudi={chiudi} />}
    </div>
  )
}
