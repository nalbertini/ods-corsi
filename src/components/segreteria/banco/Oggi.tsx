import { useEffect, useState, type CSSProperties } from 'react'
import type { DatiSegreteria, LezioneSeg } from '../../../lib/segreteria'
import { chiaveGiorno, oraDi } from '../../../lib/sala'
import { codaBanco } from '../../../lib/codaBanco'
import { fasciaDelleLezioni, ORA_PX, riepilogoGiornata, tabellone, type Blocco, type StatoBlocco } from '../../../lib/giornata'
import { Guaio, Testa, useCarica } from '../comune'
import { DaFare, type ContiDaFare } from '../DaFare'
import type { Destinazione, Voce } from '../Segreteria'

/** Uno stile con le variabili CSS (`--nome`) che il foglio di stile legge: React le accetta, i suoi tipi no. */
type ConVariabili = CSSProperties & Record<`--${string}`, string>

/** Le parole dello stato: il colore da solo non basta a leggerlo. */
const PAROLA: Record<StatoBlocco, string> = {
  fatto: '✓ FATTO',
  in_corso: 'ADESSO',
  appello_non_fatto: '✕ APPELLO NON FATTO',
  prossima: 'STA PER INIZIARE',
  annullata: 'ANNULLATA',
}

const ora = (n: number) => `${String(n).padStart(2, '0')}:00`

/** Un numero grande che apre l'elenco che lo ha prodotto. */
function Cifra({ titolo, valore, sotto, guaio, onClick }: { titolo: string; valore: number | null; sotto: string; guaio?: boolean; onClick?: () => void }) {
  const dentro = (
    <>
      <span className="sg-etichetta">{titolo}</span>
      <span className="num bn-cifra-n">{valore ?? '—'}</span>
      <span className="bn-cifra-sotto">{sotto}</span>
    </>
  )
  // Senza un posto dove andare non è un tasto: un lettore di schermo lo direbbe «non disponibile».
  return onClick ? (
    <button type="button" className="bn-cifra" data-guaio={guaio && !!valore} onClick={onClick}>
      {dentro}
    </button>
  ) : (
    <div className="bn-cifra" data-guaio={guaio && !!valore}>
      {dentro}
    </div>
  )
}

/**
 * OGGI de «Il Banco»: la giornata come tabellone sale × ore, e a destra la
 * coda di quello che aspetta il banco. Le regole (che lezione ha l'appello da
 * fare, chi sta in coda) stanno in `src/lib/giornata` e `src/lib/codaBanco`.
 */
export function Oggi({ d, conti, onVai, onRiprova }: { d: DatiSegreteria; conti: ContiDaFare; onVai: (v: Voce, dove?: Destinazione) => void; onRiprova: () => void }) {
  // La riga rossa si muove: un giro al minuto.
  const [adesso, setAdesso] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setAdesso(new Date()), 60_000)
    return () => window.clearInterval(t)
  }, [])
  const giorno = chiaveGiorno(adesso)
  const sale = useCarica(() => d.sale(), [d])
  const lezioni = useCarica(() => d.settimana(new Date(`${giorno}T00:00`), new Date(`${giorno}T23:59`)), [d, giorno])
  const persone = useCarica(() => d.persone(), [d])

  const l = lezioni.dato ?? []
  const { dalleOre: dalle, alleOre: alle } = fasciaDelleLezioni(l)
  const tab = tabellone(l, sale.dato ?? [], adesso, { dalleOre: dalle, alleOre: alle, oraPx: ORA_PX })
  const ore = Array.from({ length: alle - dalle }, (_, i) => dalle + i)
  const coda = codaBanco({ appelli: conti.appelli ?? [], persone: persone.dato ?? [], richieste: conti.richieste ?? 0, istruttori: conti.istruttori ?? 0, segnalate: conti.segnalate ?? undefined }, giorno)
  const { presenti, attesi, appelliDaFare: appelli } = riepilogoGiornata(l, adesso)

  const apri = (x: LezioneSeg) => onVai('settimana', { lezione: { id: x.id, inizio: x.inizio } })
  const guaio = lezioni.guaio ?? sale.guaio ?? persone.guaio

  return (
    <>
      <Testa titolo="OGGI" sotto={`${new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }).format(adesso)} · ${l.length} lezioni${appelli ? `, ${appelli} appello da fare` : ''}.`} />
      {guaio && <Guaio testo={`La giornata non si legge: ${guaio}`} />}
      <div className="bn-cifre">
        <Cifra titolo="SENZA CERTIFICATO" valore={conti.certificati} sotto="in sala non entrano" guaio onClick={() => onVai('iscritti', { filtro: 'certificato' })} />
        <Cifra titolo="DA PAGARE" valore={conti.pagare} sotto="quota non in regola" guaio onClick={() => onVai('dapagare')} />
        <Cifra titolo="RICHIESTE" valore={conti.richieste} sotto="dal modulo online" onClick={() => onVai('richieste')} />
        <Cifra titolo="PRESENTI OGGI" valore={lezioni.dato ? presenti : null} sotto={`su ${attesi} attesi`} />
      </div>
      <div className="bn-oggi">
        {lezioni.dato && l.length === 0 ? (
          <section aria-label="La giornata" className="bn-tabellone">
            <p className="sg-sotto">Nessuna lezione oggi. Il calendario della settimana è in SETTIMANA.</p>
          </section>
        ) : (
        <section aria-label="La giornata" className="bn-tabellone">
          <div className="bn-sale" style={{ gridTemplateColumns: `56px repeat(${Math.max(tab.colonne.length, 1)}, minmax(0, 1fr))` }}>
            <span />
            {tab.colonne.map((c) => (
              <span key={c.sala?.id ?? 'senza'} className="sg-etichetta">
                {(c.sala?.nome ?? 'SENZA SALA').toUpperCase()}
              </span>
            ))}
          </div>
          <div className="bn-griglia" style={{ height: ore.length * ORA_PX, gridTemplateColumns: `56px repeat(${Math.max(tab.colonne.length, 1)}, minmax(0, 1fr))`, '--ora-px': `${ORA_PX}px` } as ConVariabili}>
            <div className="bn-ore">
              {ore.map((h) => (
                <span key={h} style={{ height: ORA_PX }}>
                  {ora(h)}
                </span>
              ))}
            </div>
            {tab.colonne.map((c) => (
              <div key={c.sala?.id ?? 'senza'} className="bn-colonna">
                {c.blocchi.map((b: Blocco) => (
                  <button
                    key={b.lezione.id + b.lezione.inizio}
                    type="button"
                    className="bn-blocco"
                    data-stato={b.stato}
                    data-corto={b.altezza < 90}
                    style={{ top: b.top + 3, height: b.altezza - 6, '--tinta': b.lezione.colore ?? 'var(--line)' } as ConVariabili}
                    onClick={() => apri(b.lezione)}
                  >
                    <span className="bn-blocco-testa">
                      <span className="ob">{b.lezione.corso}</span>
                      <span className="num">{oraDi(b.lezione.inizio)}</span>
                    </span>
                    <span className="bn-blocco-sotto">
                      {b.lezione.istruttori || 'Senza istruttore'} · {b.lezione.iscritti} iscritti
                    </span>
                    <span className="num bn-blocco-stato">{b.stato === 'fatto' || b.stato === 'in_corso' ? `${PAROLA[b.stato]} · ${b.lezione.presenti} SU ${b.lezione.iscritti}` : PAROLA[b.stato]}</span>
                  </button>
                ))}
              </div>
            ))}
            {tab.adesso !== null && (
              <div className="bn-adesso" style={{ top: tab.adesso }} aria-hidden="true">
                <span className="num">{oraDi(adesso.toISOString())}</span>
              </div>
            )}
          </div>
        </section>
        )}
        <aside aria-label="Da fare al banco" className="bn-coda">
          <span className="sg-etichetta bn-coda-testa">DA FARE AL BANCO · IN ORDINE DI URGENZA</span>
          {coda.length === 0 && conti.contato && <p className="sg-sotto">Tutto a posto: niente aspetta il banco.</p>}
          {coda.length === 0 && !conti.contato && <p className="sg-sotto">Un attimo…</p>}
          {coda.map((r) => (
            <div key={r.id} className="bn-riga" data-livello={r.livello}>
              <span className="stack grow" style={{ gap: 2, minWidth: 0 }}>
                <span className="ob bn-riga-titolo">{r.titolo}</span>
                <span className="bn-riga-sotto">{r.sotto}</span>
              </span>
              <button type="button" className={`num sg-btn ${r.livello === 'blocca' && r.tasto === 'FAI LA RICEVUTA' ? 'sg-btn-rosso' : 'sg-btn-linea'}`} onClick={() => onVai(r.vai.voce, { persona: r.vai.persona, lezione: r.vai.lezione, filtro: r.vai.filtro })}>
                {r.tasto}
              </button>
            </div>
          ))}
        </aside>
      </div>
      {/* Quello che la coda non mostra (certificati in scadenza, da stampare, prezzi del listino) resta in DA FARE di sempre. */}
      <details className="bn-altro">
        <summary className="num sg-btn sg-btn-linea">TUTTO QUELLO CHE C'È DA FARE</summary>
        <DaFare conti={conti} onVai={onVai} onRiprova={onRiprova} />
      </details>
    </>
  )
}
