import { useEffect, useState } from 'react'
import { saldoAperto, STAGIONE } from '../lib/costi'
import { LISTINO, PAGAMENTO } from '../lib/iscrizione'
import { caricaListino, type ListinoLetto } from '../lib/listino'
import { chiaveGiorno } from '../lib/sala'
import { inEuro } from '../lib/vestiario'
import { paginaSito, presentazione } from '../lib/sito'
import { Cifra, Costo, Dettaglio, Etichetta, Riquadro, Tasto, Titoletto } from './ds'

/** Il listino che vale, letto una volta per pagina; `null` finché non arriva. */
export function useListino(): ListinoLetto | null {
  const [letto, setLetto] = useState<ListinoLetto | null>(null)
  useEffect(() => {
    let vivo = true
    void caricaListino().then((l) => vivo && setLetto(l))
    return () => {
      vivo = false
    }
  }, [])
  return letto
}

// «50 €», «12,50 €»: uno solo per tutta l'app, e chi lo prendeva da qui continua a trovarlo.
export { inEuro }

/**
 * Il listino della stagione, corso per corso.
 *
 * Una scheda per corso e non una tabella: sei colonne su un telefono non si
 * leggono, e chi guarda i prezzi cerca il suo corso, non confronta le righe.
 * Passata la data del saldo la colonna del saldo sparisce: quel prezzo non
 * vale più. Il foglio originale si offre solo finché il listino è quello: se
 * la segreteria l'ha cambiato, il PDF direbbe prezzi vecchi.
 */
export function Costi() {
  const letto = useListino()
  if (!letto) {
    return (
      <section id="costi">
        <Titoletto>COSTI {STAGIONE}</Titoletto>
        <div className="pad stack costi">
          <Dettaglio>Un attimo…</Dettaglio>
        </div>
      </section>
    )
  }
  const { listino, cambiato } = letto
  const saldo = saldoAperto(chiaveGiorno(new Date()), listino.saldoEntro)
  return (
    <section id="costi">
      <Titoletto>COSTI {STAGIONE}</Titoletto>

      <div className="pad stack costi">
        <Riquadro stretto>
          <Etichetta>QUOTA ASSOCIATIVA</Etichetta>
          <Cifra>{inEuro(listino.quota)}</Cifra>
          <Dettaglio>Una per stagione, valida fino a {PAGAMENTO.validaFino}. Si somma al corso.</Dettaglio>
        </Riquadro>

        {listino.corsi.map((v) => {
          const sito = presentazione(v.corso)
          return <Costo key={v.corso} {...v} saldo={saldo} dataSaldo={listino.saldoEntro} frase={sito?.frase} link={sito && paginaSito(sito.pagina)} />
        })}

        {listino.offerte.length > 0 && <Titoletto dentro>OFFERTE</Titoletto>}
        {listino.offerte.map((o) => (
          <Riquadro key={o.titolo} stretto>
            <span className="ob offerta-titolo">{o.titolo}</span>
            <Dettaglio>{o.testo}</Dettaglio>
          </Riquadro>
        ))}

        {!cambiato && <Tasto href={LISTINO.file}>IL FOGLIO ORIGINALE</Tasto>}
      </div>
    </section>
  )
}
