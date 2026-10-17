import { listinoUsabile, type CorsoRef } from '../../lib/listino'
import { useEffect, useRef, useState } from 'react'
import type { DatiSegreteria, PersonaSeg } from '../../lib/segreteria'
import { etichettaQuota, pagamentoDi, tastoPrincipale } from '../../lib/segreteria'
import { cosaNonVaDiretto, domandaAnnullaPagamento, domandaAnnullaRicevuta, importoNonVa, METODI_A_MANO, righeDaRicevute, righeDirette, riassunto, vociSuggerite, type PagamentoDiretto, type RigaPagamento } from '../../lib/pagamenti'
import {
  centesimi,
  conti,
  cosaNonVa,
  enteCambiato,
  euro,
  METODI,
  nomeFileRicevuta,
  mancanoDatiSocio,
  domandaRicevuta,
  motivoBlocca,
  ricevutaPer,
  QUOTA,
  quoteDi,
  vociDelCorso,
  vociInDueGruppi,
  type DatiRicevuta,
  type EnteRicevuta,
  type IntestatarioRicevuta,
  type Ricevuta,
  type VoceRicevuta,
} from '../../lib/ricevute'
import { abbonamentiDalleRicevute, descrizioneScontata, doveVaLoSconto, importoSconto, scontoDellaVoce, SCONTO_FAMIGLIA, type Abbonamento } from '../../lib/nucleo'
import { chiaveGiorno } from '../../lib/sala'
import { chiedi, Campo, dataLunga, Guaio, Riga, useAvviso, useBozza, useCarica } from './comune'
import { Numero } from './Presenze'

type Fai = ReturnType<typeof useAvviso>['fai']

/** Il PDF si fa solo quando serve: pdf-lib pesa, e l'elenco non ne ha bisogno. */
const scarica = async (r: Ricevuta) => (await import('../../lib/ricevutaPdf')).scaricaRicevuta(r, nomeFileRicevuta(r))

/**
 * Lo storico dei pagamenti di un iscritto, nella sua scheda: ogni ricevuta con
 * i suoi pagamenti sotto, poi quelli registrati a mano senza ricevuta. Le
 * ricevute si riscaricano e si annullano da qui, e da qui si fa la ricevuta
 * nuova o si registra un pagamento fatto a mano.
 */
export function StoricoIscritto({ d, p, corsi, fai, onNuova, onCambiato }: { d: DatiSegreteria; p: PersonaSeg; corsi: string[]; fai: Fai; onNuova: () => void; onCambiato: () => void }) {
  const ricevute = useCarica(() => d.ricevute(p.id), [d, p.id])
  // Senza 54-pagamenti-diretti.sql le ricevute si vedono lo stesso: il guaio si dice, ma non ferma lo storico.
  const diretti = useCarica(() => d.pagamentiDiretti(p.id), [d, p.id])
  const [registrando, setRegistrando] = useState(false)
  // Aperto il modulo, si porta in vista: sul telefono sta sotto lo schermo.
  const modulo = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (registrando) modulo.current?.scrollIntoView({ block: 'center' })
  }, [registrando])
  // Annullata una ricevuta con la quota che nessun'altra copre: la quota torna da pagare, o era pagata fuori dall'app?
  const [scoperta, setScoperta] = useState<{ numero: string; al?: string } | null>(null)
  const annulla = async (r: Ricevuta) => {
    if (!(await chiedi(domandaAnnullaRicevuta(r), 'SÌ, ANNULLA LA RICEVUTA', { no: 'NO, LASCIALA', pericolo: true }))) return
    const oggi = chiaveGiorno(new Date())
    const altre = (ricevute.dato ?? []).filter((x) => x.id !== r.id)
    const quota = quoteDi([r]).find((q) => (!q.dal || q.dal <= oggi) && (!q.al || q.al >= oggi))
    const dopo = pagamentoDi({ pagamento: p.pagamento, quote: quoteDi(altre) }, oggi)
    void fai(() => d.annullaRicevuta(r.id), 'Ricevuta annullata', async () => {
      await ricevute.ricarica()
      onCambiato()
      if (quota && dopo.come !== 'pagato') setScoperta({ numero: `${r.numero}/${r.anno}`, al: quota.al })
    })
  }
  const annullaPagamento = async (x: PagamentoDiretto) => {
    if (!(await chiedi(domandaAnnullaPagamento(x), 'SÌ, ANNULLA IL PAGAMENTO', { no: 'NO, LASCIALO', pericolo: true }))) return
    void fai(() => d.annullaPagamentoDiretto(x.id), 'Pagamento annullato', () => diretti.ricarica())
  }

  const oggi = chiaveGiorno(new Date())
  const tutteRicevute = ricevute.dato ?? []
  const aMano = diretti.dato ?? []
  const somma = riassunto(tutteRicevute, aMano)
  const stato = pagamentoDi(p, oggi)
  const vuoto = ricevute.dato !== null && tutteRicevute.length === 0 && aMano.length === 0

  return (
    <div className="stack" style={{ gap: 8 }}>
      <Riga titolo="PAGAMENTI" />
      {ricevute.guaio && <Guaio testo={ricevute.guaio} />}
      {diretti.guaio && <Guaio testo={diretti.guaio} />}
      {!vuoto && ricevute.dato && (
        <div className="sg-numeri-tre">
          <Numero titolo="PAGATO" valore={`${euro(somma.pagato)} €`} sotto="ricevute e pagamenti a mano" />
          <Numero titolo="MANCA" valore={`${euro(somma.manca)} €`} sotto={somma.manca ? 'sulle ricevute non saldate: un pagamento a mano non la riduce' : 'niente da incassare'} allarme={somma.manca > 0} />
          <Numero titolo="QUOTA" valore={etichettaQuota(stato.come)} sotto={stato.fino ? `fino al ${dataLunga(stato.fino)}` : 'ricevute e pagamenti a mano non cambiano la quota'} />
        </div>
      )}
      {vuoto && <span className="sg-sotto">Nessun pagamento registrato. Fai la ricevuta quando paga, o registra un pagamento già fatto: lo trovi qui.</span>}
      {tutteRicevute.map((r) => {
        const manca = r.annullataIl ? 0 : conti(r).netto
        const righe = righeDaRicevute([r])
        return (
          <div key={r.id} className="stack" style={{ gap: 6 }}>
            <div className="sg-voce-elenco" style={{ flexWrap: 'wrap' }}>
              {/* Base zero: il testo lungo di una annullata non deve mandare a capo il PDF. */}
              <span className="stack grow" style={{ minWidth: 0, flexBasis: 0 }}>
                {/* Annullata è storia, non qualcosa che manca: barrata e in grigio, non in rosso. */}
                <span style={{ fontSize: 15, fontWeight: 700, textDecoration: r.annullataIl ? 'line-through' : undefined, color: r.annullataIl ? 'var(--dim)' : undefined }}>
                  N. {r.numero}/{r.anno} · {dataLunga(r.data)}
                  {manca > 0 && <span className="num sg-tag" data-tipo="presto" style={{ marginLeft: 8, textDecoration: 'none' }}>MANCA {euro(manca)} €</span>}
                  {r.annullataIl && <span className="num sg-tag" data-tipo="manca" style={{ marginLeft: 8, textDecoration: 'none' }}>ANNULLATA</span>}
                </span>
                <span style={{ fontSize: 12, color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.annullataIl ? `Annullata il ${dataLunga(r.annullataIl.slice(0, 10))} · ` : ''}
                  {r.voci.map((v) => v.descrizione).join(', ')} · totale {euro(r.totale)} €{r.anticipo > 0 ? ` · anticipo ${euro(r.anticipo)} €` : ''}
                </span>
              </span>
              <button type="button" className="num sg-chip" onClick={() => void fai(() => scarica(r))}>
                PDF
              </button>
              {/* Raro e senza ritorno: su una riga sua, a destra, e non più grande del PDF che si preme ogni giorno. */}
              {!r.annullataIl && (
                <div className="row" style={{ flexBasis: '100%', justifyContent: 'flex-end' }}>
                  <button type="button" className="num sg-chip" onClick={() => annulla(r)}>
                    ANNULLA RICEVUTA
                  </button>
                </div>
              )}
            </div>
            {righe.map((x) => (
              <RigaDelloStorico key={x.id} riga={x} />
            ))}
          </div>
        )
      })}
      {aMano.length > 0 && <Riga titolo="SENZA RICEVUTA" />}
      {righeDirette(aMano, () => `${p.cognome} ${p.nome}`).map((x) => {
        const suo = aMano.find((y) => y.id === x.direttoId)
        return <RigaDelloStorico key={x.id} riga={x} aMano onAnnulla={x.annullato || !suo ? undefined : () => annullaPagamento(suo)} />
      })}
      {scoperta && (
        <div className="sg-prima">
          <span className="sg-etichetta" data-manca>LA QUOTA NON È PIÙ PAGATA</span>
          <span style={{ fontSize: 15, lineHeight: 1.4 }}>
            La ricevuta {scoperta.numero} aveva la quota associativa, e nessun’altra ricevuta la copre: per l’app {p.nome} torna da pagare.
          </span>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="sg-btn sg-btn-linea" onClick={() => setScoperta(null)}>
              RESTA DA PAGARE
            </button>
            <button
              type="button"
              className="sg-btn sg-btn-linea"
              onClick={() =>
                void fai(
                  () => d.salvaPagamento(p.id, { stato: 'pagato', fino: scoperta.al, nota: `Pagata: la ricevuta ${scoperta.numero} è stata annullata` }),
                  'Quota segnata pagata fuori dall’app',
                  () => {
                    setScoperta(null)
                    onCambiato()
                  },
                )
              }
            >
              ERA PAGATA FUORI DALL’APP
            </button>
          </div>
          <span className="sg-sotto">Se ne fai subito un’altra giusta, scegli RESTA DA PAGARE: la nuova ricevuta la rimette pagata.</span>
        </div>
      )}
      {registrando ? (
        <div ref={modulo}>
        <RegistraPagamento
          d={d}
          p={p}
          corsi={corsi}
          fai={fai}
          onFatto={() => {
            setRegistrando(false)
            void diretti.ricarica()
          }}
          onChiudi={() => setRegistrando(false)}
        />
        </div>
      ) : (
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          {/* Pieno se è la prima cosa da fare, o se è tutto a posto: la scheda si apre per incassare. */}
          <button type="button" className={tastoPrincipale(p, oggi) === 'quota' ? 'num sg-chip sg-chip-pieno' : 'num sg-chip'} data-primo onClick={onNuova}>
            + FAI LA RICEVUTA
          </button>
          <button type="button" className="num sg-chip" onClick={() => setRegistrando(true)}>
            + REGISTRA UN PAGAMENTO
          </button>
        </div>
      )}
    </div>
  )
}

/** Un pagamento nello storico: la data e come, a cosa serve, l'importo. */
function RigaDelloStorico({ riga, aMano, onAnnulla }: { riga: RigaPagamento; aMano?: boolean; onAnnulla?: () => void }) {
  const barrato = riga.annullato ? 'line-through' : undefined
  return (
    <div className="sg-voce-elenco sg-pagamento" data-amano={aMano || undefined} data-annullato={riga.annullato || undefined} style={{ flexWrap: 'wrap' }}>
      {/* Base 200: sul telefono il testo non si schiaccia accanto all'importo. */}
      <span className="stack grow" style={{ minWidth: 0, flex: '1 1 200px' }}>
        <span style={{ fontSize: 15, fontWeight: 600, textDecoration: barrato, color: riga.annullato ? 'var(--dim)' : undefined }}>
          {dataLunga(riga.data)} · {riga.metodo}
        </span>
        <span style={{ fontSize: 12, color: 'var(--dim)', overflowWrap: 'anywhere' }}>
          {[riga.voce, riga.nota].filter(Boolean).join(' · ')}
          {aMano && <span className="num sg-tag" data-tipo={riga.annullato ? 'manca' : undefined} style={{ marginLeft: 8 }}>{riga.annullato ? 'ANNULLATO' : 'SENZA RICEVUTA'}</span>}
        </span>
      </span>
      <span className="num" style={{ fontSize: 18, fontWeight: 700, whiteSpace: 'nowrap', textDecoration: barrato, color: riga.annullato ? 'var(--dim)' : 'var(--verde-testo)' }}>
        {euro(riga.importo)} €
      </span>
      {onAnnulla && (
        <div className="row" style={{ flexBasis: '100%', justifyContent: 'flex-end' }}>
          <button type="button" className="num sg-chip" onClick={onAnnulla}>
            ANNULLA PAGAMENTO
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Un pagamento già avvenuto senza ricevuta (in palestra, in contanti, prima
 * dell'app). Resta nello storico, SENZA RICEVUTA, e non cambia se è in regola.
 * La persona serve solo per registrare: il modulo va anche senza la sua scheda
 * (l'amministrazione).
 */
export function RegistraPagamento({ d, p, corsi, fai, onFatto, onChiudi }: { d: DatiSegreteria; p: { id: string; nome: string; cognome: string }; corsi: string[]; fai: Fai; onFatto: () => void; onChiudi: () => void }) {
  const [data, setData] = useState(chiaveGiorno(new Date()))
  const [importo, setImporto] = useState('')
  const [metodo, setMetodo] = useState(METODI_A_MANO[0])
  const [voce, setVoce] = useState('')
  const [nota, setNota] = useState('')
  // Lasciarlo a metà chiede prima di perderlo, come il resto della scheda.
  useBozza(importo !== '' || nota !== '', 'Il pagamento a mano')
  const cent = centesimi(importo)
  const guaio = importo === '' ? null : cent === null ? 'L’importo non si capisce: scrivi un numero, per esempio 40,00.' : cosaNonVaDiretto({ personaId: p.id, data, importo: cent, metodo, voce, nota })
  const manca = cent === null || !!guaio || !voce.trim()
  return (
    <section aria-label="Pagamento fatto a mano" className="sg-riquadro">
      <span className="sg-etichetta">PAGAMENTO FATTO A MANO</span>
      <span className="sg-riquadro-titolo ob">{p.cognome} {p.nome}</span>
      <span className="sg-sotto">Per un pagamento già avvenuto senza ricevuta: in palestra, in contanti, prima dell’app. Resta nello storico e si può annullare.</span>
      <div className="sg-due sg-scheda-campi">
        <Campo id="pd-data" etichetta="DATA">
          <input id="pd-data" className="sg-campo" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </Campo>
        <Campo id="pd-importo" etichetta="IMPORTO" manca={importo === ''}>
          <input id="pd-importo" className="sg-campo" inputMode="decimal" placeholder="40,00" value={importo} onChange={(e) => setImporto(e.target.value)} aria-invalid={(cent === null || importoNonVa({ personaId: p.id, data, importo: cent, metodo, voce, nota })) || undefined} />
        </Campo>
        <Campo id="pd-metodo" etichetta="COME HA PAGATO">
          <select id="pd-metodo" className="sg-campo" value={metodo} onChange={(e) => setMetodo(e.target.value)}>
            {METODI_A_MANO.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Campo>
        <Campo id="pd-voce" etichetta="A COSA SERVE" manca={voce.trim() === ''}>
          <input id="pd-voce" className="sg-campo" list="pd-voci" placeholder="Quota, annuale, trimestre…" value={voce} onChange={(e) => setVoce(e.target.value)} />
          <datalist id="pd-voci">
            {vociSuggerite(corsi).map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </Campo>
        <Campo id="pd-nota" etichetta="NOTA · FACOLTATIVA" largo>
          <textarea id="pd-nota" className="sg-campo" rows={2} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Pagato direttamente in palestra" />
        </Campo>
      </div>
      {guaio && <span role="alert" style={{ fontSize: 14, color: 'var(--rosso-testo)' }}>{guaio}</span>}
      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="sg-btn sg-btn-pieno"
          disabled={manca}
          onClick={() => {
            if (cent === null) return
            void fai(() => d.registraPagamentoDiretto({ personaId: p.id, data, importo: cent, metodo, voce: voce.trim(), nota: nota.trim() || undefined }), 'Pagamento registrato', onFatto)
          }}
        >
          REGISTRA IL PAGAMENTO
        </button>
        <button type="button" className="sg-btn sg-btn-linea" onClick={onChiudi}>
          NO, TORNA INDIETRO
        </button>
      </div>
    </section>
  )
}

/** Una voce mentre la si scrive: gli importi come li batte la segreteria. */
interface Bozza {
  chiave: number
  descrizione: string
  quantita: string
  prezzo: string
  dal: string
  al: string
  pagato: string
  /** Finché nessuno lo tocca, il pagato segue il prezzo. */
  pagatoAMano: boolean
  /** Lo sconto famiglia messo dall'app: il prezzo pieno, in centesimi. */
  pieno?: number
}

let prossimaChiave = 1
const bozzaDa = (v: Omit<VoceRicevuta, 'pagamenti'>): Bozza => ({
  chiave: prossimaChiave++,
  descrizione: v.descrizione,
  quantita: String(v.quantita),
  prezzo: euro(v.prezzo),
  dal: v.dal ?? '',
  al: v.al ?? '',
  pagato: euro(v.prezzo * v.quantita),
  pagatoAMano: false,
})

/** Il pagato di una voce dopo un cambio di prezzo: lo segue, se non è scritto a mano. */
const seguePagato = (b: Bozza): Bozza => {
  const pr = centesimi(b.prezzo)
  const q = Number(b.quantita)
  return !b.pagatoAMano && pr !== null && Number.isInteger(q) ? { ...b, pagato: euro(pr * q) } : b
}

/** Una voce senza lo sconto famiglia messo dall'app: descrizione e prezzo pieni. */
const senzaScontoApp = (b: Bozza): Bozza => {
  if (b.pieno === undefined) return b
  const { pieno, ...x } = b
  return seguePagato({ ...x, descrizione: scontoDellaVoce(b.descrizione)?.descrizione ?? b.descrizione, prezzo: euro(pieno) })
}

/** Un annuale della ricevuta, per il conto dello sconto; quello scontato a mano conta come già scontato. */
type AnnualeQui = Abbonamento & { chiave: number }
function annualiQui(voci: Bozza[], chi: string): AnnualeQui[] {
  return voci.flatMap((b): AnnualeQui[] => {
    const prezzo = centesimi(b.prezzo)
    const q = Number(b.quantita)
    if (!/^annuale /i.test(b.descrizione.trim()) || prezzo === null || q !== 1) return []
    const s = scontoDellaVoce(b.descrizione.trim())
    const corso = (s?.descrizione ?? b.descrizione.trim()).replace(/^annuale /i, '')
    return [s ? { chiave: b.chiave, chi, corso, importo: s.pieno, scontato: true } : { chiave: b.chiave, chi, corso, importo: prezzo }]
  })
}

/**
 * Le voci con lo sconto famiglia dove va (vedi `doveVaLoSconto`): sull'annuale
 * di questa ricevuta che costa meno nel nucleo, se non l'ha già avuto un altro.
 * Il prezzo della voce scende del 20%, e la descrizione dice su quanto.
 */
function conSconto(voci: Bozza[], altri: Abbonamento[], chi: string, si: boolean): Bozza[] {
  const pulite = voci.map(senzaScontoApp)
  if (!si) return pulite
  const qui = annualiQui(pulite, chi)
  const dove = doveVaLoSconto(qui, altri)
  const voce = qui.find((a) => a === dove)
  if (!voce || voce.scontato) return pulite
  return pulite.map((b) =>
    b.chiave === voce.chiave
      ? seguePagato({ ...b, pieno: voce.importo, descrizione: descrizioneScontata(b.descrizione.trim(), voce.importo), prezzo: euro(voce.importo - importoSconto(voce.importo)) })
      : b,
  )
}

/** Da quello che si vede a quello che si salva; `null` dove un importo non si capisce. */
function daBozze(voci: Bozza[], data: string, metodo: string): VoceRicevuta[] | string {
  const fatte: VoceRicevuta[] = []
  for (const b of voci) {
    const nome = b.descrizione.trim() || 'una voce'
    const prezzo = centesimi(b.prezzo)
    if (prezzo === null) return `Il prezzo di «${nome}» non si capisce`
    const pagato = b.pagato.trim() ? centesimi(b.pagato) : 0
    if (pagato === null) return `Il pagato di «${nome}» non si capisce`
    const quantita = Number(b.quantita)
    fatte.push({
      descrizione: b.descrizione.trim(),
      quantita: Number.isInteger(quantita) ? quantita : NaN,
      prezzo,
      dal: b.dal || undefined,
      al: b.al || undefined,
      pagamenti: pagato ? [{ data, importo: pagato, metodo }] : [],
    })
  }
  return fatte
}

/**
 * Un pagamento nuovo, e la sua ricevuta. Si parte da quello che si sa: i dati
 * del socio dell'ultima ricevuta o del modulo di iscrizione, la quota se in
 * questa stagione non è ancora pagata, l'annuale dei corsi che fa, e lo
 * sconto famiglia se tocca a uno di questi annuali (lo si può togliere). Tutto
 * si cambia prima di fare la ricevuta; dopo, la ricevuta non si cambia più.
 */
export function NuovaRicevuta({
  d,
  p,
  nucleo = [],
  corsi,
  fai,
  onFatta,
  onLasciaStare,
}: {
  d: DatiSegreteria
  p: PersonaSeg
  /** Gli altri del suo nucleo familiare: dalle loro ricevute, lo sconto famiglia. */
  nucleo?: PersonaSeg[]
  /** I corsi che fa adesso: le loro voci vengono prima. */
  corsi: CorsoRef[]
  fai: Fai
  onFatta: () => void
  onLasciaStare: () => void
}) {
  const oggi = chiaveGiorno(new Date())
  const [data, setData] = useState(oggi)
  const anno = Number(data.slice(0, 4)) || Number(oggi.slice(0, 4))
  const prossimo = useCarica(() => d.prossimoNumero(anno), [d, anno])
  const partenza = useCarica(
    () => Promise.all([d.intestatarioDi(p.id), d.enteRicevute(), d.ricevute(p.id), d.listino().then(async (x) => ({ ...x, listino: listinoUsabile(x.listino, await d.corsi()) })), Promise.all(nucleo.map((x) => d.ricevute(x.id)))]),
    [d, p.id, nucleo.map((x) => x.id).join()],
  )
  const [numero, setNumero] = useState('')
  const [metodo, setMetodo] = useState<string>(METODI[0])
  const [voci, setVoci] = useState<Bozza[] | null>(null)
  const [socio, setSocio] = useState<IntestatarioRicevuta | null>(null)
  const [ente, setEnte] = useState<EnteRicevuta | null>(null)
  const [anticipo, setAnticipo] = useState('')
  const [note, setNote] = useState('')
  const [aggiungi, setAggiungi] = useState('')
  const [scontoSi, setScontoSi] = useState(true)
  // I DATI DEL SOCIO aperti o chiusi si decide una volta, quando arrivano: poi
  // li apre e chiude chi scrive. Se si chiudessero da sé appena è tutto a
  // posto, si chiuderebbero sotto le dita, col fuoco e le lettere dopo persi.
  const [socioAperto, setSocioAperto] = useState(false)

  const listino = partenza.dato?.[3].listino
  const gruppi = listino ? vociInDueGruppi(corsi, data, listino) : { primi: [], altri: [] }
  const pronte = [...gruppi.primi, ...gruppi.altri]

  // Gli annuali che il nucleo ha già pagato, questa persona compresa.
  const chi = `${p.nome} ${p.cognome}`
  const nomeDi = (id: string) => {
    const x = [p, ...nucleo].find((y) => y.id === id)
    return x ? `${x.nome} ${x.cognome}` : ''
  }
  const altri = partenza.dato ? abbonamentiDalleRicevute([...partenza.dato[2], ...partenza.dato[4].flat()], nomeDi) : []
  const metti = (v: Bozza[], si = scontoSi) => setVoci(conSconto(v, altri, chi, si))

  // La prima volta che arriva quello che si sa, si compila il modulo.
  useEffect(() => {
    if (!partenza.dato || voci) return
    const [intestatario, e, fatte, { listino: l }] = partenza.dato
    setSocio(intestatario)
    const prima = mancanoDatiSocio(intestatario, new Date(data || oggi))
    setSocioAperto(prima.blocca.length + prima.avvisa.length > 0)
    setEnte(e)
    const quotaPagata = fatte.some((r) => !r.annullataIl && r.voci.some((v) => v.descrizione.toUpperCase() === QUOTA && (!v.al || v.al >= oggi)))
    metti([
      ...(quotaPagata ? [] : [bozzaDa(pronte[0].voce(oggi))]),
      ...corsi.flatMap((c) => vociDelCorso(c, data, l).slice(0, 1)).map((v) => bozzaDa(v.voce(oggi))),
    ])
  }, [partenza.dato])

  if (partenza.guaio) return <Guaio testo={`Non si riesce a preparare la ricevuta: ${partenza.guaio}`} />
  if (!voci || !socio || !ente) return <span className="sg-sotto">Un momento…</span>

  const cambia = (chiave: number, c: Partial<Bozza>) =>
    setVoci(
      voci.map((b) => {
        if (b.chiave !== chiave) return b
        const x = { ...b, ...c }
        // Cambiata a mano, lo sconto di questa voce è di chi l'ha cambiata.
        if (c.prezzo !== undefined || c.quantita !== undefined || c.descrizione !== undefined) delete x.pieno
        // Il pagato segue prezzo e quantità, finché non lo si scrive a mano.
        return c.prezzo !== undefined || c.quantita !== undefined ? seguePagato(x) : x
      }),
    )

  const fatte = daBozze(voci, data, metodo)
  const anticipoCent = anticipo.trim() ? centesimi(anticipo) : 0
  const n = numero.trim() ? Number(numero) : undefined
  const dati: DatiRicevuta | null =
    typeof fatte === 'string' || anticipoCent === null
      ? null
      : { data, personaId: p.id, numero: n, ente, intestatario: socio, voci: fatte, anticipo: anticipoCent, note: note.trim() || undefined }
  const guaio = typeof fatte === 'string' ? fatte : anticipoCent === null ? 'L’anticipo non si capisce' : dati ? cosaNonVa(dati) : null
  const c = dati ? conti(dati) : null

  // Lo sconto famiglia: dove è, o perché non è qui.
  const scontata = voci.find((b) => b.pieno !== undefined)
  const dove = doveVaLoSconto(annualiQui(voci.map(senzaScontoApp), chi), altri)
  const percento = Math.round(SCONTO_FAMIGLIA * 100)

  // Se ha pagato lo dice la quota nella ricevuta (`pagamentoDi`): la scheda non si segna più a mano.
  const conQuota = (dati?.voci ?? []).some((v) => v.descrizione.trim().toUpperCase() === QUOTA)

  // Senza il codice fiscale di chi riceve la ricevuta non si fa; senza l'indirizzo sì, ma lo si dice.
  // Minore o no alla data della ricevuta: una fatta oggi con la data di ieri vale per ieri.
  const { minore, blocca, avvisa } = mancanoDatiSocio(socio, new Date(data || oggi))
  const manca = new Set(blocca.map((x) => x.campo))
  const attenzione = new Set(avvisa.map((x) => x.campo))
  const elenco = (x: Array<{ testo: string }>) => x.map((y) => y.testo).join(', ').replace(/, ([^,]*)$/, ' e $1')
  const bloccaTesto = motivoBlocca(blocca)
  const avvisaTesto = `Sulla ricevuta ${avvisa.length > 1 ? 'mancano' : 'manca'} ${elenco(avvisa)}`
  const campoSocio = (k: keyof IntestatarioRicevuta, etichetta: string, o: { tipo?: string; largo?: boolean; max?: number; num?: boolean } = {}) => (
    <Campo id={`rs-${k}`} etichetta={etichetta} largo={o.largo} manca={manca.has(k)}>
      <input
        id={`rs-${k}`}
        // Il carattere stretto: a metà riga sul telefono i sedici del codice fiscale ci stanno tutti.
        className={o.num ? 'sg-campo num' : 'sg-campo'}
        type={o.tipo ?? 'text'}
        maxLength={o.max ?? 120}
        value={socio[k] ?? ''}
        aria-invalid={manca.has(k) || undefined}
        data-acceso={attenzione.has(k) || undefined}
        onChange={(e) => setSocio({ ...socio, [k]: e.target.value })}
      />
    </Campo>
  )

  const emetti = async () => {
    if (!dati || !c) return
    // La ricevuta ha un numero e non si cambia più: prima di farla, si rilegge.
    const quale = n ? `n. ${n}/${anno}` : prossimo.dato ? `n. ${prossimo.dato}/${anno}` : `col prossimo numero del ${anno}`
    const righe = [
      domandaRicevuta(quale, socio, minore, c),
      avvisa.length ? `\n${avvisaTesto}.` : '',
      '\nFatta, non si cambia più: se è sbagliata si annulla e se ne fa un’altra.',
    ]
    if (!(await chiedi(righe.join('\n'), 'FAI LA RICEVUTA', { no: 'TORNA A CORREGGERE', pericolo: true }))) return
    void fai(
      async () => {
        const r = await d.emettiRicevuta(dati)
        await scarica(r)
        return r
      },
      'Ricevuta fatta: il PDF è scaricato',
      onFatta,
    )
  }

  return (
    <div className="stack" style={{ gap: 20 }}>
      <Riga titolo="NUOVO PAGAMENTO · RICEVUTA" />

      <div className="sg-tre">
        <Campo id="rc-data" etichetta="DATA">
          <input id="rc-data" className="sg-campo" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </Campo>
        <Campo id="rc-numero" etichetta="NUMERO">
          <input
            id="rc-numero"
            className="sg-campo num"
            inputMode="numeric"
            placeholder={prossimo.dato ? `${prossimo.dato} (il prossimo)` : '…'}
            value={numero}
            onChange={(e) => setNumero(e.target.value.replace(/\D/g, ''))}
          />
        </Campo>
        <Campo id="rc-metodo" etichetta="PAGATO CON">
          <select id="rc-metodo" className="sg-campo" value={metodo} onChange={(e) => setMetodo(e.target.value)}>
            {METODI.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Campo>
      </div>
      <span style={{ fontSize: 12, color: 'var(--dim)', marginTop: -12 }}>
        Il numero si lascia vuoto: prende il primo libero del {anno}. Si scrive solo per continuare la numerazione di un altro programma.
      </span>

      <div className="stack" style={{ gap: 10 }}>
        <span className="sg-etichetta">VOCI</span>
        {voci.length === 0 && <span className="sg-sotto">Nessuna voce: aggiungine una qui sotto.</span>}
        {voci.map((b) => (
          <div key={b.chiave} className="sg-riquadro" style={{ padding: '12px 14px', gap: 10 }}>
            <div className="row" style={{ gap: 8 }}>
              <label htmlFor={`rv-d-${b.chiave}`} className="vh">
                Descrizione
              </label>
              <input id={`rv-d-${b.chiave}`} className="sg-campo grow" maxLength={120} value={b.descrizione} onChange={(e) => cambia(b.chiave, { descrizione: e.target.value })} style={{ minWidth: 0 }} />
              <button type="button" className="sg-link" onClick={() => metti(voci.filter((x) => x.chiave !== b.chiave))}>
                Togli
              </button>
            </div>
            <div className="sg-ricevuta-voce">
              <Campo id={`rv-q-${b.chiave}`} etichetta="Q">
                <input id={`rv-q-${b.chiave}`} className="sg-campo num" inputMode="numeric" value={b.quantita} onChange={(e) => cambia(b.chiave, { quantita: e.target.value.replace(/\D/g, '') })} />
              </Campo>
              <Campo id={`rv-p-${b.chiave}`} etichetta="PREZZO €">
                <input id={`rv-p-${b.chiave}`} className="sg-campo num" inputMode="decimal" value={b.prezzo} onChange={(e) => cambia(b.chiave, { prezzo: e.target.value })} />
              </Campo>
              <Campo id={`rv-dal-${b.chiave}`} etichetta="VALE DAL">
                <input id={`rv-dal-${b.chiave}`} className="sg-campo" type="date" value={b.dal} onChange={(e) => cambia(b.chiave, { dal: e.target.value })} />
              </Campo>
              <Campo id={`rv-al-${b.chiave}`} etichetta="AL">
                <input id={`rv-al-${b.chiave}`} className="sg-campo" type="date" value={b.al} onChange={(e) => cambia(b.chiave, { al: e.target.value })} />
              </Campo>
              <Campo id={`rv-pg-${b.chiave}`} etichetta="PAGATO ORA €">
                <input
                  id={`rv-pg-${b.chiave}`}
                  className="sg-campo num"
                  inputMode="decimal"
                  value={b.pagato}
                  onChange={(e) => cambia(b.chiave, { pagato: e.target.value, pagatoAMano: true })}
                />
              </Campo>
            </div>
          </div>
        ))}
        <div className="row" style={{ gap: 8 }}>
          <label htmlFor="rc-aggiungi" className="vh">
            Voce da aggiungere
          </label>
          <select id="rc-aggiungi" className="sg-campo grow" style={{ borderStyle: 'dashed', minWidth: 0 }} value={aggiungi} onChange={(e) => setAggiungi(e.target.value)}>
            <option value="">Aggiungi una voce…</option>
            {gruppi.primi.map((v) => (
              <option key={v.chiave} value={v.chiave}>
                {v.etichetta}
              </option>
            ))}
            {gruppi.altri.length > 0 && (
              <optgroup label="Il resto del listino…">
                {gruppi.altri.map((v) => (
                  <option key={v.chiave} value={v.chiave}>
                    {v.etichetta}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          <button
            type="button"
            className="num sg-chip sg-chip-pieno"
            disabled={!aggiungi || voci.length >= 20}
            onClick={() => {
              const v = pronte.find((x) => x.chiave === aggiungi)?.voce(data)
              if (v) metti([...voci, bozzaDa(v)])
              setAggiungi('')
            }}
          >
            AGGIUNGI
          </button>
        </div>
        {scontata ? (
          <span className="row" style={{ gap: 8, fontSize: 12, color: 'var(--sec)', flexWrap: 'wrap' }}>
            Sconto famiglia: {percento}% su {scontoDellaVoce(scontata.descrizione)?.descrizione ?? scontata.descrizione}, cioè −{euro(importoSconto(scontata.pieno!))} €.
            <button type="button" className="sg-link" onClick={() => { setScontoSi(false); metti(voci, false) }}>
              Togli lo sconto
            </button>
          </span>
        ) : dove && 'chiave' in dove && !dove.scontato ? (
          <span className="row" style={{ gap: 8, fontSize: 12, color: 'var(--dim)', flexWrap: 'wrap' }}>
            Lo sconto famiglia ({percento}%) va su Annuale {dove.corso}.
            <button type="button" className="sg-link" onClick={() => { setScontoSi(true); metti(voci, true) }}>
              Metti lo sconto
            </button>
          </span>
        ) : (
          dove && (
            <span style={{ fontSize: 12, color: 'var(--dim)' }}>
              {dove.scontato
                ? `Sconto famiglia: l’ha già avuto ${dove.chi}, su ${dove.corso}.`
                : `Sconto famiglia: va sull’annuale che costa meno nel nucleo, ${dove.corso} di ${dove.chi}, già pagato.`}
            </span>
          )
        )}
      </div>

      <details open={socioAperto}>
        {/* Chiusi, i dati del socio dicono a chi va la ricevuta: per un minore, al genitore che paga oggi. */}
        <summary className="sg-etichetta sg-socio">DATI DEL SOCIO · {ricevutaPer(socio, minore)}</summary>
        <div className="sg-due" style={{ marginTop: 12 }}>
          {campoSocio('nome', 'NOME', { max: 80 })}
          {campoSocio('cognome', 'COGNOME', { max: 80 })}
          {campoSocio('indirizzo', 'INDIRIZZO', { largo: true, max: 160 })}
          {campoSocio('cap', 'CAP', { max: 5 })}
          {campoSocio('comune', 'COMUNE', { max: 80 })}
          {campoSocio('provincia', 'PROVINCIA', { max: 2 })}
          {campoSocio('natoIl', 'NATO IL', { tipo: 'date' })}
          {campoSocio('codiceFiscale', 'CODICE FISCALE', { max: 16, num: true })}
          {campoSocio('partitaIva', 'PARTITA IVA · FACOLTATIVA', { max: 11 })}
          {campoSocio('genitore', 'GENITORE · PER UN MINORE', { max: 160 })}
          {campoSocio('genitoreCodiceFiscale', 'C.F. DEL GENITORE', { max: 16, num: true })}
        </div>
        <span style={{ fontSize: 12, color: 'var(--dim)' }}>
          Vengono dall’ultima ricevuta e, dove lì sono vuoti, dai DATI ANAGRAFICI della scheda. Qui si correggono per questa ricevuta; la scheda della persona non cambia.
        </span>
      </details>

      <div className="sg-due">
        <Campo id="rc-anticipo" etichetta="ANTICIPO € · GIÀ DATO PRIMA">
          <input id="rc-anticipo" className="sg-campo num" inputMode="decimal" placeholder="0,00" value={anticipo} onChange={(e) => setAnticipo(e.target.value)} />
        </Campo>
        <Campo id="rc-note" etichetta="NOTE · FACOLTATIVE">
          <input id="rc-note" className="sg-campo" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </Campo>
      </div>

      {c && (
        <div className="sg-riquadro" style={{ gap: 6 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="sg-etichetta">TOTALE DOCUMENTO</span>
            <span className="num" style={{ fontSize: 18, fontWeight: 700 }}>{euro(c.totale)} €</span>
          </div>
          <div className="row" style={{ justifyContent: 'space-between', color: 'var(--sec)' }}>
            <span className="sg-etichetta">PAGATO ORA</span>
            <span className="num">{euro(c.pagato)} €</span>
          </div>
          {/* Quel che resta da pagare non è un errore: un acconto si fa apposta. */}
          <div className="row" style={{ justifyContent: 'space-between', color: c.netto > 0 ? 'var(--text)' : 'var(--sec)' }}>
            <span className="sg-etichetta">NETTO A PAGARE</span>
            <span className="num">{euro(c.netto)} €</span>
          </div>
        </div>
      )}

      {!conQuota && (
        <span style={{ fontSize: 14, color: 'var(--sec)' }}>Senza la QUOTA ASSOCIATIVA questa ricevuta non cambia se è in regola: conta solo la quota.</span>
      )}

      {guaio && <span style={{ fontSize: 13, color: 'var(--rosso-testo)' }}>{guaio}</span>}
      {avvisa.length > 0 && (
        <span style={{ fontSize: 15, color: 'var(--giallo-testo)' }}>
          {avvisaTesto}: si può fare lo stesso, ma {avvisa.length > 1 ? 'resteranno vuoti' : 'resterà vuoto'}.
        </span>
      )}
      {bloccaTesto && (
        <span id="rc-motivo" style={{ fontSize: 15, color: 'var(--rosso-testo)' }}>
          {bloccaTesto}.
        </span>
      )}
      {!guaio && !bloccaTesto && <span style={{ fontSize: 15, color: 'var(--sec)' }}>Fatta la ricevuta, non si cambia più: se è sbagliata si annulla e se ne fa un’altra.</span>}

      <div className="sg-scheda-piede">
        <button type="button" className="sg-btn sg-btn-linea grow" onClick={onLasciaStare}>
          LASCIA STARE
        </button>
        <button type="button" className="sg-btn sg-btn-rosso grow" disabled={!!guaio || !dati || !!bloccaTesto} aria-describedby={bloccaTesto ? 'rc-motivo' : undefined} onClick={emetti}>
          FAI LA RICEVUTA
        </button>
      </div>
    </div>
  )
}

/** I dati dell'associazione in testa alle ricevute, e la dicitura: da IMPOSTAZIONI. */
export function EnteRicevute({ d }: { d: DatiSegreteria }) {
  const ente = useCarica(() => d.enteRicevute(), [d])
  const { avviso, fai } = useAvviso()
  const [b, setB] = useState<EnteRicevuta | null>(null)
  const e = b ?? ente.dato
  useBozza(!!b && !!ente.dato && enteCambiato(ente.dato, b), 'Chi fa le ricevute')

  const campo = (k: keyof EnteRicevuta, etichetta: string, max = 120, largo = false) => (
    <Campo id={`en-${k}`} etichetta={etichetta} largo={largo}>
      <input id={`en-${k}`} className="sg-campo" maxLength={max} value={e?.[k] ?? ''} disabled={!e} onChange={(x) => e && setB({ ...e, [k]: x.target.value })} />
    </Campo>
  )

  return (
    <section aria-label="Chi fa le ricevute" className="sg-riquadro">
      <span className="ob sg-riquadro-titolo">CHI FA LE RICEVUTE</span>
      <span className="sg-sotto">Va in testa a ognuna. Quelle già fatte restano come erano.</span>
      {ente.guaio && <Guaio testo={ente.guaio} />}
      <div className="sg-due">
        {campo('nome', 'ASSOCIAZIONE', 120, true)}
        {campo('indirizzo', 'INDIRIZZO', 160, true)}
        {campo('cap', 'CAP', 5)}
        {campo('comune', 'COMUNE', 80)}
        {campo('codiceFiscale', 'CODICE FISCALE', 16)}
        {campo('partitaIva', 'PARTITA IVA · FACOLTATIVA', 11)}
        {campo('rasd', 'NUMERO RASD · FACOLTATIVO', 20)}
      </div>
      <Campo id="en-dicitura" etichetta="DICITURA IN FONDO">
        <textarea id="en-dicitura" className="sg-campo" rows={3} maxLength={600} value={e?.dicitura ?? ''} disabled={!e} onChange={(x) => e && setB({ ...e, dicitura: x.target.value })} style={{ minHeight: 72, paddingTop: 8 }} />
      </Campo>
      {b && (
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="sg-btn sg-btn-linea grow" onClick={() => setB(null)}>
            LASCIA STARE
          </button>
          <button
            type="button"
            className="sg-btn sg-btn-pieno grow"
            disabled={!b.nome.trim() || !b.codiceFiscale.trim()}
            onClick={() =>
              void fai(
                () =>
                  d.salvaEnteRicevute(
                    Object.fromEntries(Object.entries(b).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]).filter(([, v]) => v)) as unknown as EnteRicevuta,
                  ),
                'Dati delle ricevute salvati',
                async () => {
                  await ente.ricarica()
                  setB(null)
                },
              )
            }
          >
            SALVA
          </button>
        </div>
      )}
      {avviso}
    </section>
  )
}
