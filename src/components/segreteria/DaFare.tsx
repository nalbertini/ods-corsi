import { useEffect, useRef, useState } from 'react'
import type { DatiSegreteria, LezioneSeg } from '../../lib/segreteria'
import { certificatoDaStampare, certificatoInArrivo, certificatoInScadenza } from '../../lib/segreteria'
import { datiRichieste } from '../../lib/richieste'
import { prezziMancanti, prezziMancantiInBreve } from '../../lib/listino'
import { chiaveGiorno, giornoPerEsteso, oraDi } from '../../lib/sala'
import { contaTessere, conTessere, incrocioDaMostrare } from '../../lib/tessere'
import { appelliSenzaSegni, certificatiDaSistemare, contiDaRileggere, contiDellaStriscia, GIORNI_APPELLI, mantieniIPrecedenti, pagamentiNonInRegola, type ContiCosaManca } from '../../lib/cosaManca'
import { corsiScaduti } from '../../lib/corsiDaPagare'
import { TESTI_DA_FARE, type ChiaveDaFare } from '../../lib/daFareTesti'
import { chiArrivo, chiCertificati, chiCertificatiRicevuti, chiCorsi, chiListino, chiPagare, chiRichieste, chiScadenza, COLONNE_DA_FARE, primiDaFare, TASTO_DA_FARE, type VoceChi } from '../../lib/daFareChi'
import { dataLunga, Testa } from './comune'
import type { Destinazione, Voce } from './Segreteria'

/**
 * Quello che aspetta la segreteria, contato. `null` finché non si sa, o se
 * non si è riusciti a contarlo. `segnalate` non c'è col database vero.
 */
export interface ContiDaFare {
  appelli: LezioneSeg[] | null
  richieste: number | null
  istruttori: number | null
  segnalate?: number | null
  /** Fra chi è attivo, come la testata e i filtri di ISCRITTI: certificato mancante o scaduto. */
  certificati: number | null
  /** Mandati dall'iscritto dall'area iscritti, in attesa che la segreteria scriva la scadenza. */
  certificatiRicevuti: number | null
  /** …e in scadenza entro un mese. */
  scadenza: number | null
  /** …e compie 6 anni entro un mese, senza certificato: da avvisare la famiglia. */
  arrivo: number | null
  pagare: number | null
  /** Iscritti attivi con un trimestre o un annuale finito: undefined se le ricevute non si sono lette (la riga non c'è). */
  corsi?: number | null
  /** Iscritti a un corso che chiede la tessera, senza una valida: come il filtro SENZA TESSERA di ISCRITTI. */
  tessere: number | null
  certificatiDaStampare: number | null
  documentiDaStampare: number | null
  /** I corsi attivi a cui manca un prezzo nel listino, con cosa manca: nel modulo escono «prezzo da confermare». */
  listino: Array<{ id: string; nome: string; frase: string }> | null
  /** Chi c'è dietro i numeri, letto insieme a loro: l'elenco intero e in ordine, DA FARE ne mostra i primi. */
  chi: Partial<Record<ChiaveDaFare, VoceChi[] | null>>
  /** Contato tutto almeno una volta: da qui un `null` vuol dire che non si è riusciti, non che si aspetta. */
  contato: boolean
  /** I cinque conti della striscia COSA MANCA, con l'ultimo numero buono se una lettura fallisce. */
  striscia: ContiCosaManca
}

const VUOTI: ContiDaFare = {
  contato: false,
  appelli: null,
  richieste: null,
  istruttori: null,
  certificati: null,
  certificatiRicevuti: null,
  scadenza: null,
  arrivo: null,
  pagare: null,
  tessere: null,
  certificatiDaStampare: null,
  documentiDaStampare: null,
  listino: null,
  chi: {},
  striscia: { appelli: null, certificati: null, pagamenti: null, tessere: null, richieste: null, contato: false },
}

const oppure = <T,>(p: Promise<T>): Promise<T | null> => p.then((x) => x, () => null)

/**
 * I conti di DA FARE. Quelli del menu (richieste, istruttori, segnalate) si
 * contano sempre. Quelli che leggono iscritti e lezioni (appelli, certificati,
 * pagamenti: anche la striscia COSA MANCA) si contano con DA FARE aperta, a ogni
 * `forza` (un cambiamento, RICONTA) e cambiando voce solo se l'ultima lettura è
 * vecchia (`contiDaRileggere`): leggere tutte le persone a ogni tocco sul menu è
 * troppo. Quelli di DA FARE soltanto (listino, documenti) solo con `tutto`.
 * Si rileggono a ogni `giro`.
 */
export function useDaFare(d: DatiSegreteria | null, tutto: boolean, giro: unknown, forza = 0): ContiDaFare {
  const [conti, setConti] = useState<ContiDaFare>(VUOTI)
  const ultimaLettura = useRef<number | undefined>(undefined)
  const forzaPrima = useRef(forza)
  // Una lettura forzata (un appello segnato, RICONTA) resta da fare finché non ne finisce una pesante: se prima arriva un
  // cambio di voce e la lettura viene annullata, la prossima la rifà.
  const daRileggere = useRef(false)
  // I nomi dei corsi delle richieste: si leggono coi conti pesanti, le richieste anche senza.
  const nomiCorsi = useRef<ReadonlyMap<string, string>>(new Map())
  useEffect(() => {
    if (!d) return
    let vivo = true
    if (forza !== forzaPrima.current) {
      forzaPrima.current = forza
      daRileggere.current = true
    }
    const pesante = tutto || daRileggere.current || contiDaRileggere(ultimaLettura.current, Date.now(), 'voce')
    const adesso = Date.now()
    const oggi = chiaveGiorno(new Date())
    // Le lezioni tenute senza istruttore contano anche loro; se il database
    // non le ha ancora (23-istruttori-dalle-lezioni.sql), solo le presenze.
    const istruttori = Promise.all([d.presenzeIstruttori(0), d.lezioniSenzaIstruttore().catch(() => [])]).then(
      ([l, lezioni]) => l.filter((x) => x.stato === 'da_confermare').length + lezioni.length,
    )
    const richieste = datiRichieste().then(async (r) => ({ tutte: await r.richieste(), conDocumento: tutto ? await r.conDocumento() : null }))
    const persone = pesante ? d.persone() : Promise.resolve(null)
    // Le tessere si leggono con le persone: senza `61-tessere.sql` (manca) il conto resta «non so».
    const tessere = pesante ? Promise.all([d.tessere(), d.corsi()]) : Promise.resolve(null)
    // I corsi scaduti chiedono il listino: quali corsi si pagano e con che nome.
    const corsiListino = pesante ? Promise.all([d.corsi(), d.listino()]) : Promise.resolve(null)
    const lezioni = pesante ? d.settimana(new Date(adesso - GIORNI_APPELLI * 24 * 60 * 60_000), new Date(adesso)) : Promise.resolve(null)
    const listino = tutto ? Promise.all([d.listino(), d.corsi()]).then(([l, corsi]) => prezziMancanti(l.listino, corsi, oggi)) : Promise.resolve(null)
    void Promise.all([oppure(istruttori), oppure(richieste), oppure(persone), oppure(lezioni), d.segnalate ? oppure(d.segnalate()) : null, oppure(listino), oppure(tessere), oppure(corsiListino)]).then(
      ([istr, ric, pers, lez, segn, list, tess, cl]) => {
        if (!vivo) return
        const attive = pers?.filter((p) => p.attiva) ?? null
        const appelliMancanti = lez ? appelliSenzaSegni(lez, adesso) : null
        const richiesteNuove = ric ? ric.tutte.filter((x) => x.stato === 'nuova').length : null
        const contoTessere = pers && tess && !tess[0].manca ? contaTessere(incrocioDaMostrare(conTessere(pers, tess[0].elenco), tess[1], oggi)) : null
        const contoCorsi = pers && cl ? corsiScaduti(pers, cl[0], cl[1].listino, oggi) : null
        if (cl) nomiCorsi.current = new Map(cl[0].map((c) => [c.id, c.nome]))
        const nuova = Date.now()
        // Pesante finita bene (tutte e due le letture): da qui i conti sono freschi.
        if (pesante && pers && lez) {
          ultimaLettura.current = nuova
          daRileggere.current = false
        }
        setConti((prima) => ({
          contato: prima.contato || tutto,
          // La striscia: gli stessi numeri di DA FARE; senza lettura pesante cambiano solo le richieste.
          striscia: pesante
            ? mantieniIPrecedenti(
                prima.striscia,
                contiDellaStriscia({ persone: pers, lezioni: lez, richieste: richiesteNuove, tessere: contoTessere, corsi: contoCorsi }, adesso, oggi),
                nuova,
              )
            : { ...prima.striscia, richieste: richiesteNuove ?? prima.striscia.richieste },
          istruttori: istr,
          richieste: richiesteNuove,
          segnalate: d.segnalate ? (segn ? segn.filter((x) => x.stato === 'da_vedere').length : null) : undefined,
          // Senza `tutto` restano i conti di prima: tornando a DA FARE non lampeggiano.
          appelli: pesante ? appelliMancanti : prima.appelli,
          // Contati come i filtri di ISCRITTI che apre «Vedi chi»: il numero è quello delle righe che si vedono.
          certificati: pesante ? (pers ? certificatiDaSistemare(pers, oggi) : null) : prima.certificati,
          certificatiRicevuti: pesante ? (pers ? chiCertificatiRicevuti(pers).length : null) : prima.certificatiRicevuti,
          scadenza: pesante ? (attive ? attive.filter((p) => certificatoInScadenza(p, oggi)).length : null) : prima.scadenza,
          arrivo: pesante ? (attive ? attive.filter((p) => certificatoInArrivo(p, oggi)).length : null) : prima.arrivo,
          pagare: pesante ? (pers ? pagamentiNonInRegola(pers, oggi) : null) : prima.pagare,
          corsi: pesante ? contoCorsi : prima.corsi,
          tessere: pesante ? contoTessere : prima.tessere,
          certificatiDaStampare: pesante ? (pers ? pers.filter((p) => certificatoDaStampare(p.certificato)).length : null) : prima.certificatiDaStampare,
          documentiDaStampare: tutto ? (ric?.conDocumento ? ric.conDocumento.size : null) : prima.documentiDaStampare,
          listino: tutto ? list : prima.listino,
          chi: {
            ...(pesante
              ? {
                  certificati: pers && chiCertificati(pers, oggi),
                  'certificati-ricevuti': pers && chiCertificatiRicevuti(pers),
                  scadenza: pers && chiScadenza(pers, oggi),
                  arrivo: pers && chiArrivo(pers, oggi),
                  pagare: pers && chiPagare(pers, oggi),
                  corsi: pers && cl ? chiCorsi(pers, cl[0], cl[1].listino, oggi) : null,
                }
              : prima.chi),
            richieste: ric && chiRichieste(ric.tutte, oggi, nomiCorsi.current),
            listino: tutto ? list && chiListino(list) : prima.chi.listino,
          },
        }))
      },
    )
    return () => {
      vivo = false
    }
  }, [d, tutto, giro, forza])
  return conti
}

interface Cosa {
  chiave: ChiaveDaFare
  n: number | null
  titolo: (n: number) => string
  sotto: string
  /** Detto quando non c'è niente, nell'elenco di quello che è a posto. */
  aPosto: string
  voce: Voce
  dove?: Destinazione
  /** Dove porta toccare un nome dell'elenco: la scheda, la richiesta, il listino. */
  apri?: (id: string) => [Voce, Destinazione?]
}

/**
 * Quanto preme. `blocca`: è già un guaio (una lezione senza appello, chi entra
 * in sala senza certificato o senza quota), in rosso. `presto`: aspetta una
 * risposta o scade fra poco, in giallo. `faccenda`: da fare quando c'è un
 * momento (le stampe), in una riga sola in fondo. Il rosso resta raro, e
 * quindi si vede.
 */
type Livello = 'blocca' | 'presto' | 'faccenda'
const LIVELLO: Record<string, Livello> = {
  appelli: 'blocca',
  certificati: 'blocca',
  pagare: 'blocca',
  corsi: 'blocca',
  richieste: 'presto',
  istruttori: 'presto',
  segnalate: 'presto',
  'certificati-ricevuti': 'presto',
  scadenza: 'presto',
  arrivo: 'presto',
  listino: 'presto',
  'file-di-prima': 'faccenda',
  'documenti-stampa': 'faccenda',
}
// Un nome di un iscritto apre la sua scheda.
const apriScheda = (id: string): [Voce, Destinazione?] => ['iscritti', { persona: id }]
const ORDINE: Record<Livello, number> = { blocca: 0, presto: 1, faccenda: 2 }

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
      titolo: (n) => uno(n, TESTI_DA_FARE.appelli.singolare, TESTI_DA_FARE.appelli.plurale),
      sotto: `Negli ultimi ${GIORNI_APPELLI} giorni: passate, e nessuno ha segnato. Si apre la lezione e si fa l’appello, o si annulla se non c’è stata.`,
      aPosto: 'appelli',
      voce: 'presenze',
      dove: { filtro: 'senza-appello' },
    },
    {
      chiave: 'richieste',
      n: conti.richieste,
      titolo: (n) => uno(n, TESTI_DA_FARE.richieste.singolare, TESTI_DA_FARE.richieste.plurale),
      sotto: 'Iscrizioni arrivate dal modulo, da accogliere o rifiutare.',
      aPosto: 'richieste online',
      voce: 'richieste',
      apri: (id) => ['richieste', { richiesta: id }],
    },
    {
      chiave: 'istruttori',
      n: conti.istruttori,
      titolo: (n) => uno(n, TESTI_DA_FARE.istruttori.singolare, TESTI_DA_FARE.istruttori.plurale),
      sotto: 'Istruttori segnati dove non erano previsti, e lezioni tenute in cui scegliere chi c’era.',
      aPosto: 'presenze istruttori',
      voce: 'istruttori',
    },
    ...(conti.segnalate !== undefined
      ? [
          {
            chiave: 'segnalate',
            n: conti.segnalate,
            titolo: (n: number) => uno(n, TESTI_DA_FARE.segnalate.singolare, TESTI_DA_FARE.segnalate.plurale),
            sotto: 'Iscritti che dicono di esserci stati e nell’appello non risultano.',
            aPosto: 'presenze segnalate',
            voce: 'segnalate',
          } satisfies Cosa,
        ]
      : []),
    {
      chiave: 'certificati',
      n: conti.certificati,
      titolo: (n) => uno(n, TESTI_DA_FARE.certificati.singolare, TESTI_DA_FARE.certificati.plurale),
      sotto: 'Il certificato medico manca o è scaduto: senza, in sala non si entra. Sotto i 6 anni non serve.',
      aPosto: 'certificati',
      voce: 'iscritti',
      dove: { filtro: 'certificato' },
      apri: apriScheda,
    },
    {
      chiave: 'certificati-ricevuti',
      n: conti.certificatiRicevuti,
      titolo: (n) => uno(n, TESTI_DA_FARE['certificati-ricevuti'].singolare, TESTI_DA_FARE['certificati-ricevuti'].plurale),
      sotto: 'L’iscritto l’ha mandato dall’area iscritti: si apre il file, si scrive la scadenza o si rifiuta.',
      aPosto: 'certificati mandati',
      voce: 'iscritti',
      apri: apriScheda,
    },
    {
      chiave: 'scadenza',
      n: conti.scadenza,
      titolo: (n) => uno(n, TESTI_DA_FARE.scadenza.singolare, TESTI_DA_FARE.scadenza.plurale),
      sotto: 'Scadono entro un mese: da ricordare prima che scadano.',
      aPosto: 'certificati in scadenza',
      voce: 'iscritti',
      dove: { filtro: 'scadenza' },
      apri: apriScheda,
    },
    {
      chiave: 'arrivo',
      n: conti.arrivo,
      titolo: (n) => uno(n, TESTI_DA_FARE.arrivo.singolare, TESTI_DA_FARE.arrivo.plurale),
      sotto: 'Dal compleanno il certificato serve: nel prossimo mese, da avvisare alla famiglia.',
      aPosto: 'compleanni dei 6 anni',
      voce: 'iscritti',
      dove: { filtro: 'arrivo' },
      apri: apriScheda,
    },
    {
      chiave: 'pagare',
      n: conti.pagare,
      titolo: (n) => uno(n, TESTI_DA_FARE.pagare.singolare, TESTI_DA_FARE.pagare.plurale),
      sotto: 'Da pagare, pagato in parte, o pagato fino a una data passata.',
      aPosto: 'pagamenti',
      voce: 'iscritti',
      dove: { filtro: 'pagare' },
      apri: apriScheda,
    },
    ...(conti.corsi !== undefined
      ? [
          {
            chiave: 'corsi',
            n: conti.corsi,
            titolo: (n: number) => uno(n, TESTI_DA_FARE.corsi.singolare, TESTI_DA_FARE.corsi.plurale),
            sotto: 'Il trimestre o l’annuale di un corso è finito, o non è pagato del tutto. In sala si entra lo stesso.',
            aPosto: 'corsi',
            voce: 'iscritti',
            dove: { filtro: 'corsi-scaduti' },
            apri: apriScheda,
          } satisfies Cosa,
        ]
      : []),
    {
      chiave: 'listino',
      n: conti.listino ? conti.listino.length : null,
      titolo: (n) => uno(n, TESTI_DA_FARE.listino.singolare, TESTI_DA_FARE.listino.plurale),
      sotto: `${prezziMancantiInBreve(conti.listino ?? [])} Nel conto del modulo il prezzo resta da confermare.`,
      aPosto: 'listino',
      voce: 'listino',
      apri: () => ['listino'],
    },
    {
      chiave: 'file-di-prima',
      n: conti.certificatiDaStampare,
      titolo: (n) => uno(n, TESTI_DA_FARE['file-di-prima'].singolare, TESTI_DA_FARE['file-di-prima'].plurale),
      sotto: 'Caricati nell’app prima della nuova gestione: si aprono dalla scheda come gli altri, e si cancellano da soli 30 giorni dopo la scadenza.',
      aPosto: 'certificati non archiviati',
      voce: 'iscritti',
      dove: { filtro: 'file-di-prima' },
    },
    {
      chiave: 'documenti-stampa',
      n: conti.documentiDaStampare,
      titolo: (n) => uno(n, TESTI_DA_FARE['documenti-stampa'].singolare, TESTI_DA_FARE['documenti-stampa'].plurale),
      sotto: 'Documento d’identità arrivato col modulo: accolta la richiesta, si stampa e si cancella.',
      aPosto: 'richieste da stampare',
      voce: 'richieste',
      dove: { filtro: 'stampare' },
    },
  ]
  const aperte = cose
    .filter((c) => c.n !== null && c.n > 0)
    .sort((a, b) => ORDINE[LIVELLO[a.chiave]] - ORDINE[LIVELLO[b.chiave]])
  const daFare = aperte.filter((c) => LIVELLO[c.chiave] !== 'faccenda')
  const faccende = aperte.filter((c) => LIVELLO[c.chiave] === 'faccenda')
  const aPosto = cose.filter((c) => c.n === 0)
  const nonSo = cose.filter((c) => c.n === null)
  const tuttoContato = nonSo.length === 0

  return (
    <div className="stack" style={{ gap: 18 }}>
      <Testa
        titolo="DA FARE"
        sotto={`${giornoPerEsteso(chiaveGiorno(new Date()))} ${new Date().getFullYear()}. Quello che aspetta la segreteria: si riconta ogni volta che torni qui.`}
      />

      {!conti.contato && <span className="sg-sotto">Sto contando…</span>}

      {conti.contato && tuttoContato && daFare.length === 0 && (
        <div className="sg-dafare-fatto">
          <span className="ob">NIENTE IN SOSPESO</span>
          <span className="sg-sotto">
            Appelli fatti, richieste e presenze guardate, certificati e pagamenti in regola{faccende.length ? '; in fondo, solo qualche faccenda' : ''}.
          </span>
        </div>
      )}

      {daFare.length > 0 && (
        <ul className="sg-dafare" aria-label="Da fare">
          {daFare.map(({ apri, ...c }) => (
            <li key={c.chiave} className="sg-dafare-riga" data-livello={LIVELLO[c.chiave]}>
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
                {apri && <ChiDaFare voci={conti.chi[c.chiave]} colonne={COLONNE_DA_FARE[c.chiave] ?? 1} apri={(id) => onVai(...apri(id))} />}
              </div>
              <button type="button" className="sg-btn sg-btn-linea sg-dafare-tasto" aria-label={`${TASTO_DA_FARE}: ${c.titolo(c.n ?? 0)}`} onClick={() => onVai(c.voce, c.dove)}>
                {TASTO_DA_FARE}
              </button>
            </li>
          ))}
        </ul>
      )}

      {faccende.length > 0 && (
        <p className="sg-dafare-faccende">
          <span className="sg-etichetta">QUANDO C’È UN MOMENTO</span>{' '}
          {faccende.map((c, i) => (
            <span key={c.chiave}>
              {i > 0 && ' · '}
              <button type="button" className="sg-link" onClick={() => onVai(c.voce, c.dove)}>
                {/* In mezzo alla frase: «18 certificati non archiviati», senza l'iniziale maiuscola del titolo di riga. */}
                {c.n} {c.titolo(c.n!).toLowerCase()}
              </button>
            </span>
          ))}
        </p>
      )}

      {aPosto.length > 0 && daFare.length > 0 && (
        <p className="sg-dafare-aposto">
          <span className="sg-etichetta" style={{ color: 'var(--verde-testo)' }}>A POSTO</span> {aPosto.map((c) => c.aPosto).join(' · ')}
        </p>
      )}

      {conti.contato && !tuttoContato && (
        <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
          <span className="sg-sotto">Non si è riusciti a contare: {nonSo.map((c) => c.aPosto).join(', ')}.</span>
          <button type="button" className="sg-link" onClick={onRiprova}>
            Riconta
          </button>
        </div>
      )}
    </div>
  )
}

/** I primi nomi sotto una riga, col perché: ognuno apre dove si sistema. Gli altri li mostra «Vedi tutti». */
function ChiDaFare({ voci, colonne, apri }: { voci: VoceChi[] | null | undefined; colonne: 1 | 2; apri: (id: string) => void }) {
  if (!voci?.length) return null
  return (
    <ul className="sg-dafare-chi" data-colonne={colonne}>
      {primiDaFare(voci).map((v) => (
        <li key={v.id}>
          <button type="button" className="sg-dafare-chi-nome" onClick={() => apri(v.id)}>
            {v.nome}
          </button>
          <span className="sg-dafare-chi-perche" data-rosso={v.rosso || undefined}>
            {v.perche}
          </span>
        </li>
      ))}
    </ul>
  )
}
