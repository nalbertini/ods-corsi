import { useEffect, useState } from 'react'
import type { DatiSegreteria, LezioneSeg } from '../../lib/segreteria'
import { comeCertificato, comePaga } from '../../lib/segreteria'
import { datiRichieste } from '../../lib/richieste'
import { chiaveGiorno, giornoPerEsteso, oraDi } from '../../lib/sala'
import { dataLunga, Testa } from './comune'
import type { Destinazione, Voce } from './Segreteria'

/** Fin dove si guarda indietro per gli appelli che mancano. */
const GIORNI_APPELLI = 30

/**
 * Quello che aspetta la segreteria, contato. `null` finché non si sa, o se
 * non si è riusciti a contarlo. `segnalate` non c'è col database vero.
 */
export interface ContiDaFare {
  appelli: LezioneSeg[] | null
  richieste: number | null
  istruttori: number | null
  segnalate?: number | null
  certificati: number | null
  pagare: number | null
  certificatiDaStampare: number | null
  documentiDaStampare: number | null
}

const VUOTI: ContiDaFare = {
  appelli: null,
  richieste: null,
  istruttori: null,
  certificati: null,
  pagare: null,
  certificatiDaStampare: null,
  documentiDaStampare: null,
}

const oppure = <T,>(p: Promise<T>): Promise<T | null> => p.then((x) => x, () => null)

/**
 * I conti di DA FARE. Quelli del menu (richieste, istruttori, segnalate) si
 * contano sempre; gli altri, che leggono iscritti e lezioni, solo con `tutto`,
 * cioè quando DA FARE è aperta. Si rileggono a ogni `giro`.
 */
export function useDaFare(d: DatiSegreteria | null, tutto: boolean, giro: unknown): ContiDaFare {
  const [conti, setConti] = useState<ContiDaFare>(VUOTI)
  useEffect(() => {
    if (!d) return
    let vivo = true
    const adesso = Date.now()
    const oggi = chiaveGiorno(new Date())
    // Le lezioni tenute senza istruttore contano anche loro; se il database
    // non le ha ancora (23-istruttori-dalle-lezioni.sql), solo le presenze.
    const istruttori = Promise.all([d.presenzeIstruttori(0), d.lezioniSenzaIstruttore().catch(() => [])]).then(
      ([l, lezioni]) => l.filter((x) => x.stato === 'da_confermare').length + lezioni.length,
    )
    const richieste = datiRichieste().then(async (r) => ({ tutte: await r.richieste(), conDocumento: tutto ? await r.conDocumento() : null }))
    const persone = tutto ? d.persone() : Promise.resolve(null)
    const lezioni = tutto ? d.settimana(new Date(adesso - GIORNI_APPELLI * 24 * 60 * 60_000), new Date(adesso)) : Promise.resolve(null)
    void Promise.all([oppure(istruttori), oppure(richieste), oppure(persone), oppure(lezioni), d.segnalate ? oppure(d.segnalate()) : null]).then(
      ([istr, ric, pers, lez, segn]) => {
        if (!vivo) return
        setConti((prima) => ({
          istruttori: istr,
          richieste: ric ? ric.tutte.filter((x) => x.stato === 'nuova').length : null,
          segnalate: d.segnalate ? (segn ? segn.filter((x) => x.stato === 'da_vedere').length : null) : undefined,
          // Senza `tutto` restano i conti di prima: tornando a DA FARE non lampeggiano.
          appelli: tutto
            ? lez
              ? lez.filter((l) => Date.parse(l.fine) < adesso && l.stato !== 'annullata' && l.segnati === 0).sort((a, b) => b.inizio.localeCompare(a.inizio))
              : null
            : prima.appelli,
          // Contati come i filtri di ISCRITTI che apre VEDI CHI: il numero è quello delle righe che si vedono.
          certificati: tutto ? (pers ? pers.filter((p) => comeCertificato(p.certificato, oggi) !== 'valido').length : null) : prima.certificati,
          pagare: tutto ? (pers ? pers.filter((p) => comePaga(p, oggi) !== 'pagato').length : null) : prima.pagare,
          certificatiDaStampare: tutto ? (pers ? pers.filter((p) => p.certificato.conFile).length : null) : prima.certificatiDaStampare,
          documentiDaStampare: tutto ? (ric?.conDocumento ? ric.conDocumento.size : null) : prima.documentiDaStampare,
        }))
      },
    )
    return () => {
      vivo = false
    }
  }, [d, tutto, giro])
  return conti
}

interface Cosa {
  chiave: string
  n: number | null
  titolo: (n: number) => string
  sotto: string
  /** Detto quando non c'è niente, nell'elenco di quello che è a posto. */
  aPosto: string
  tasto: string
  voce: Voce
  dove?: Destinazione
}

// Il numero è già grande accanto: il titolo dice solo di cosa.
const uno = (n: number, singolare: string, plurale: string) => (n === 1 ? singolare : plurale)

/**
 * DA FARE: la prima cosa che vede la segreteria. Una riga per ogni cosa che
 * aspetta, col numero grande e il tasto che porta dove si sistema; sotto, in
 * una riga, quello che è a posto. Le lezioni senza appello si aprono da qui.
 */
export function DaFare({ conti, onVai, onRiprova }: { conti: ContiDaFare; onVai: (v: Voce, d?: Destinazione) => void; onRiprova: () => void }) {
  const appelli = conti.appelli
  const cose: Cosa[] = [
    {
      chiave: 'appelli',
      n: appelli ? appelli.length : null,
      titolo: (n) => uno(n, 'lezione senza appello', 'lezioni senza appello'),
      sotto: `Negli ultimi ${GIORNI_APPELLI} giorni: passate, e nessuno ha segnato. Si apre la lezione e si fa l’appello, o si annulla se non c’è stata.`,
      aPosto: 'appelli',
      tasto: 'TUTTE IN PRESENZE',
      voce: 'presenze',
    },
    {
      chiave: 'richieste',
      n: conti.richieste,
      titolo: (n) => uno(n, 'richiesta online nuova', 'richieste online nuove'),
      sotto: 'Iscrizioni arrivate dal modulo, da accogliere o rifiutare.',
      aPosto: 'richieste online',
      tasto: 'APRI LE RICHIESTE',
      voce: 'richieste',
    },
    {
      chiave: 'istruttori',
      n: conti.istruttori,
      titolo: (n) => uno(n, 'presenza istruttore da confermare', 'presenze istruttori da confermare'),
      sotto: 'Istruttori segnati dove non erano previsti, e lezioni tenute in cui scegliere chi c’era.',
      aPosto: 'presenze istruttori',
      tasto: 'APRI LE PRESENZE ISTRUTTORI',
      voce: 'istruttori',
    },
    ...(conti.segnalate !== undefined
      ? [
          {
            chiave: 'segnalate',
            n: conti.segnalate,
            titolo: (n: number) => uno(n, 'presenza segnalata da vedere', 'presenze segnalate da vedere'),
            sotto: 'Iscritti che dicono di esserci stati e nell’appello non risultano.',
            aPosto: 'presenze segnalate',
            tasto: 'APRI LE SEGNALATE',
            voce: 'segnalate' as Voce,
          },
        ]
      : []),
    {
      chiave: 'certificati',
      n: conti.certificati,
      titolo: (n) => uno(n, 'certificato da sistemare', 'certificati da sistemare'),
      sotto: 'Il certificato medico manca, è scaduto o scade entro un mese: senza, in sala non si entra.',
      aPosto: 'certificati',
      tasto: 'VEDI CHI',
      voce: 'iscritti',
      dove: { filtro: 'certificato' },
    },
    {
      chiave: 'pagare',
      n: conti.pagare,
      titolo: (n) => uno(n, 'iscritto da pagare', 'iscritti da pagare'),
      sotto: 'Da pagare, pagato in parte, o pagato fino a una data passata.',
      aPosto: 'pagamenti',
      tasto: 'VEDI CHI',
      voce: 'iscritti',
      dove: { filtro: 'pagare' },
    },
    {
      chiave: 'certificati-stampa',
      n: conti.certificatiDaStampare,
      titolo: (n) => uno(n, 'certificato da stampare', 'certificati da stampare'),
      sotto: 'Caricati nell’app: si stampano, si mettono nella cartellina e si cancellano da qui.',
      aPosto: 'certificati da stampare',
      tasto: 'VEDI QUALI',
      voce: 'iscritti',
      dove: { filtro: 'stampare' },
    },
    {
      chiave: 'documenti-stampa',
      n: conti.documentiDaStampare,
      titolo: (n) => uno(n, 'documento d’identità da stampare', 'documenti d’identità da stampare'),
      sotto: 'Arrivati con una richiesta di quando il modulo li chiedeva: si stampano e si cancellano.',
      aPosto: 'documenti da stampare',
      tasto: 'VEDI QUALI',
      voce: 'richieste',
      dove: { filtro: 'stampare' },
    },
  ]
  const daFare = cose.filter((c) => c.n !== null && c.n > 0)
  const aPosto = cose.filter((c) => c.n === 0)
  const nonSo = cose.filter((c) => c.n === null)
  const tuttoContato = nonSo.length === 0

  return (
    <div className="stack" style={{ gap: 18, maxWidth: 1080 }}>
      <Testa
        titolo="DA FARE"
        sotto={`${giornoPerEsteso(chiaveGiorno(new Date()))} ${new Date().getFullYear()}. Quello che aspetta la segreteria: si riconta ogni volta che torni qui.`}
      />

      {!tuttoContato && daFare.length === 0 && aPosto.length === 0 && <span className="sg-sotto">Sto contando…</span>}

      {tuttoContato && daFare.length === 0 && (
        <div className="sg-dafare-fatto">
          <span className="ob">NIENTE IN SOSPESO</span>
          <span className="sg-sotto">Appelli fatti, richieste e presenze guardate, certificati e pagamenti in regola.</span>
        </div>
      )}

      {daFare.length > 0 && (
        <ul className="sg-dafare" aria-label="Da fare">
          {daFare.map((c) => (
            <li key={c.chiave} className="sg-dafare-riga">
              <span className="num sg-dafare-n">{c.n}</span>
              <div className="stack grow" style={{ gap: 4, minWidth: 0 }}>
                <span className="sg-dafare-titolo">{c.titolo(c.n!)}</span>
                <span className="sg-sotto">{c.sotto}</span>
                {c.chiave === 'appelli' && appelli && (
                  <div className="sg-dafare-lezioni">
                    {appelli.slice(0, 6).map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        className="sg-dafare-lezione"
                        style={{ ['--tinta' as string]: l.colore ?? 'var(--blu)' }}
                        onClick={() => onVai('settimana', { lezione: { id: l.id, inizio: l.inizio } })}
                      >
                        <span className="sg-dafare-lezione-nome">{l.corso.toUpperCase()}</span>
                        <span className="num">
                          {giornoPerEsteso(chiaveGiorno(new Date(l.inizio))).slice(0, 3).toLowerCase()} {dataLunga(chiaveGiorno(new Date(l.inizio)), false)} · {oraDi(l.inizio)}
                        </span>
                      </button>
                    ))}
                    {appelli.length > 6 && <span className="sg-sotto" style={{ alignSelf: 'center' }}>e altre {appelli.length - 6}</span>}
                  </div>
                )}
              </div>
              <button type="button" className="sg-btn sg-btn-linea sg-dafare-tasto" onClick={() => onVai(c.voce, c.dove)}>
                {c.tasto}
              </button>
            </li>
          ))}
        </ul>
      )}

      {aPosto.length > 0 && daFare.length > 0 && (
        <p className="sg-dafare-aposto">
          <span className="sg-etichetta" style={{ color: 'var(--verde)' }}>A POSTO</span> {aPosto.map((c) => c.aPosto).join(' · ')}
        </p>
      )}

      {tuttoContato || nonSo.length === cose.length ? null : (
        <span className="sg-sotto">Sto contando: {nonSo.map((c) => c.aPosto).join(', ')}…</span>
      )}
      {tuttoContato || (
        <button type="button" className="sg-link" style={{ alignSelf: 'flex-start' }} onClick={onRiprova}>
          Non arriva? Riconta
        </button>
      )}
    </div>
  )
}
