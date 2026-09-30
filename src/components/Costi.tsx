import { COSTI, OFFERTE, saldoAperto, STAGIONE } from '../lib/costi'
import { LISTINO, PAGAMENTO } from '../lib/iscrizione'
import { chiaveGiorno } from '../lib/sala'
import { paginaSito, presentazione } from '../lib/sito'
import { Cifra, Costo, Dettaglio, Etichetta, Riquadro, Tasto, Titoletto } from './ds'

/**
 * Il listino della stagione, corso per corso.
 *
 * Una scheda per corso e non una tabella: sei colonne su un telefono non si
 * leggono, e chi guarda i prezzi cerca il suo corso, non confronta le righe.
 * Passato il 31 agosto la colonna del saldo sparisce: quel prezzo non vale più.
 */
export function Costi() {
  const saldo = saldoAperto(chiaveGiorno(new Date()))
  return (
    <section id="costi">
      <Titoletto>COSTI {STAGIONE}</Titoletto>

      <div className="pad stack costi">
        <Riquadro stretto>
          <Etichetta>QUOTA ASSOCIATIVA</Etichetta>
          <Cifra>{PAGAMENTO.quotaAssociativa}</Cifra>
          <Dettaglio>Una per stagione, valida fino a {PAGAMENTO.validaFino}. Si somma al corso.</Dettaglio>
        </Riquadro>

        {COSTI.map((v) => {
          const sito = presentazione(v.corso)
          return <Costo key={v.corso} {...v} saldo={saldo} frase={sito?.frase} link={sito && paginaSito(sito.pagina)} />
        })}

        <Titoletto dentro>OFFERTE</Titoletto>
        {OFFERTE.map((o) => (
          <Riquadro key={o.titolo} stretto>
            <span className="ob offerta-titolo">{o.titolo}</span>
            <Dettaglio>{o.testo}</Dettaglio>
          </Riquadro>
        ))}

        <Tasto href={LISTINO.file}>IL FOGLIO ORIGINALE</Tasto>
      </div>
    </section>
  )
}
