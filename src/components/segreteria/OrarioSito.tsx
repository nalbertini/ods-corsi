import { useMemo } from 'react'
import type { DatiSegreteria } from '../../lib/segreteria'
import { indirizzoCompleto } from '../../lib/indirizzoSegreteria'
import { chiaveGiorno } from '../../lib/sala'
import { avvisoSenzaOrari, corsiSenzaOrari, databaseConCorsi, ORARIO_NON_ATTIVO, orarioDeiCorsi, orariDaiCorsi, testiOrario } from '../../lib/sitoOrario'
import type { PaginaSito } from '../../lib/sitoPagine'
import { Campo, Guaio, useCarica } from './comune'

/**
 * L'orario della pagina viene da CORSI: la pagina si collega a uno o più corsi e il sito ne scrive le righe
 * (giorno, ora e durata) da solo. Le regole stanno in `sitoOrario.ts`; qui si sceglie e si mostra l'anteprima.
 * Il collegamento si salva subito (non è un cambio di testo): `onCambia` lo manda al database.
 */
export function OrarioSito({ d, pagina, lavora, onCambia }: { d: DatiSegreteria; pagina: PaginaSito; lavora: boolean; onCambia: (corsi: string[]) => void }) {
  const corsi = useCarica(() => d.corsi(), [d])
  const orari = useMemo(() => orariDaiCorsi(corsi.dato ?? [], chiaveGiorno(new Date())), [corsi.dato])
  if (!databaseConCorsi([pagina])) return <span className="sg-sotto">{ORARIO_NON_ATTIVO}</span>
  if (corsi.guaio) return <Guaio testo={corsi.guaio} />
  if (!corsi.dato) return <span className="sg-sotto">Leggo i corsi…</span>

  const collegati = pagina.corsiCollegati ?? []
  const tutti = corsi.dato
  const nome = (id: string) => tutti.find((c) => c.id === id)?.nome ?? 'Un corso che non c’è più'
  const scelte = tutti.filter((c) => c.attivo && !collegati.includes(c.id))
  const vuoti = corsiSenzaOrari(collegati, orari)
  const archiviati = collegati.filter((id) => tutti.some((c) => c.id === id && !c.attivo))
  const avviso = avvisoSenzaOrari(vuoti, collegati, nome, archiviati)
  // Con percorso e query: le pagine delle aree hanno <base href="../">, e un «#…» da solo porterebbe via dalla segreteria.
  const verso = (corso?: string) => indirizzoCompleto(window.location, { voce: 'corsi', ...(corso && { corso }) })
  // Un corso archiviato non si apre da solo (l'indirizzo torna all'elenco): si porta all'elenco, dove sta in fondo.
  const daAprire = vuoti.filter((id) => !archiviati.includes(id))
  const quanti = (id: string) => orarioDeiCorsi([id], orari).length
  const righe = testiOrario(collegati, orari)

  return (
    <div className="stack" style={{ gap: 12 }}>
      {avviso && (
        <div className="avviso-rete" role="alert">
          <span className="avviso-rete-titolo"><span aria-hidden="true">! </span>{avviso.titolo.toUpperCase()}</span>
          <span>{avviso.frase}</span>
          <span className="sg-sotto">Mai orari vecchi: un corso archiviato, senza giorni o con tutte le ricorrenze finite non mostra orari vecchi.</span>
          <span className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {daAprire.map((id) => (
              <a key={id} className="sg-btn sg-btn-linea" href={verso(id)}>
                {vuoti.length === 1 ? 'Apri il corso in CORSI ›' : `Apri «${nome(id)}» in CORSI ›`}
              </a>
            ))}
            {archiviati.length > 0 && <a className="sg-btn sg-btn-linea" href={verso()}>Apri l’elenco di CORSI ›</a>}
          </span>
        </div>
      )}

      <Campo etichetta={collegati.length >= 2 ? 'COLLEGATA AI CORSI' : 'COLLEGATA AL CORSO'}>
        {collegati.length === 0 ? (
          <span className="sg-sotto">Nessuno: l’orario resta quello scritto a mano, come oggi. Scegli un corso di CORSI per farlo venire da lì.</span>
        ) : (
          <ul className="row" style={{ gap: 8, flexWrap: 'wrap', listStyle: 'none', margin: 0, padding: 0 }}>
            {collegati.map((id) => (
              <li key={id} className="sito-corso-chip">
                <span>{nome(id)}</span>
                <span className="sg-sotto">· {archiviati.includes(id) ? 'archiviato' : quanti(id) === 0 ? 'senza giorni' : quanti(id) === 1 ? '1 orario' : `${quanti(id)} orari`}</span>
                <button type="button" className="sito-chip-x" aria-label={`Scollega ${nome(id)}`} disabled={lavora} onClick={() => onCambia(collegati.filter((x) => x !== id))}>
                  <span aria-hidden="true">✕</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {scelte.length > 0 && (
          <select
            className="sg-campo"
            aria-label={collegati.length === 0 ? 'Scegli un corso' : 'Un altro corso'}
            value=""
            disabled={lavora}
            onChange={(e) => e.target.value && onCambia([...collegati, e.target.value])}
          >
            <option value="">{collegati.length === 0 ? 'Scegli un corso' : '+ Un altro corso'}</option>
            {scelte.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        )}
      </Campo>

      {collegati.length > 0 ? (
        <>
          <Campo etichetta="ORARIO SUL SITO">
            <div className="sg-campo sito-spento" aria-disabled="true">Ora vale CORSI · {righe.join(' / ')}</div>
          </Campo>
          <span className="sg-sotto">Viene dai corsi. L’orario scritto a mano resta salvato nella pagina: se scolleghi i corsi lo ritrovi.</span>
          <Campo etichetta="COSÌ LO VEDE IL SITO">
            <ul className="stack sito-orario-righe" style={{ gap: 6 }} aria-label="Orario sul sito">
              {righe.map((t) => {
                const [giorni, ora] = t.split(' · ')
                return (
                  <li key={t} className="sito-orario-riga">
                    <span>{giorni}</span>
                    {ora && <span className="sito-orario-ora">{ora}</span>}
                  </li>
                )
              })}
            </ul>
            <span className="sg-sotto">Giorno, ora e durata. Mai sala, istruttore o posti.</span>
          </Campo>
          <span className="sg-sotto">Si aggiorna da solo: un cambio in CORSI arriva sul sito entro 5 minuti, senza premere Pubblica.</span>
          <span style={{ fontSize: 14, lineHeight: 1.4 }}>
            <b>Controlla a mano:</b> l’età e il testo. Frasi come «il martedì alle 18» scritte nel testo non le cambia nessuno.
          </span>
        </>
      ) : (
        <span className="sg-sotto">Si cambia a mano nel testo della pagina e va pubblicato, come oggi.</span>
      )}
    </div>
  )
}
