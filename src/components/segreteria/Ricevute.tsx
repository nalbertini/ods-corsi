import { listinoUsabile, type CorsoRef } from '../../lib/listino'
import { useEffect, useState } from 'react'
import type { DatiSegreteria, PersonaSeg } from '../../lib/segreteria'
import { pagamentoDi, tastoPrincipale } from '../../lib/segreteria'
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

type Fai = ReturnType<typeof useAvviso>['fai']

/** Il PDF si fa solo quando serve: pdf-lib pesa, e l'elenco non ne ha bisogno. */
const scarica = async (r: Ricevuta) => (await import('../../lib/ricevutaPdf')).scaricaRicevuta(r, nomeFileRicevuta(r))

/**
 * Le ricevute di un iscritto, nella sua scheda: quelle fatte, da riscaricare
 * o annullare, e il tasto per registrare un pagamento nuovo.
 */
export function RicevuteIscritto({ d, p, fai, onNuova, onCambiato }: { d: DatiSegreteria; p: PersonaSeg; fai: Fai; onNuova: () => void; onCambiato: () => void }) {
  const ricevute = useCarica(() => d.ricevute(p.id), [d, p.id])
  // Annullata una ricevuta con la quota che nessun'altra copre: la quota torna da pagare, o era pagata fuori dall'app?
  const [scoperta, setScoperta] = useState<{ numero: string; al?: string } | null>(null)
  const annulla = async (r: Ricevuta) => {
    if (!(await chiedi(`Annullare la ricevuta ${r.numero}/${r.anno}? Resta in elenco col suo numero, e il PDF dirà ANNULLATA. Se copriva la quota, la quota torna da pagare.`, 'SÌ, ANNULLA LA RICEVUTA', { no: 'NO, LASCIALA', pericolo: true }))) return
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

  return (
    <div className="stack" style={{ gap: 8 }}>
      <Riga titolo="RICEVUTE" />
      {ricevute.guaio && <Guaio testo={ricevute.guaio} />}
      {ricevute.dato?.length === 0 && <span className="sg-sotto">Ancora nessuna ricevuta.</span>}
      {ricevute.dato?.map((r) => (
        <div key={r.id} className="sg-voce-elenco" style={{ flexWrap: 'wrap' }}>
          {/* Base zero: il testo lungo di una annullata non deve mandare a capo il PDF. */}
          <span className="stack grow" style={{ minWidth: 0, flexBasis: 0 }}>
            {/* Annullata è storia, non qualcosa che manca: barrata e in grigio, non in rosso. */}
            <span className="num" style={{ fontSize: 15, fontWeight: 700, textDecoration: r.annullataIl ? 'line-through' : undefined, color: r.annullataIl ? 'var(--dim)' : undefined }}>
              N. {r.numero}/{r.anno} · {euro(r.totale)} €
            </span>
            <span style={{ fontSize: 12, color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.annullataIl ? `Annullata il ${dataLunga(r.annullataIl.slice(0, 10))} · ` : ''}
              {dataLunga(r.data)} · {r.voci.map((v) => v.descrizione).join(', ')}
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
      ))}
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
      <div className="row">
        {/* Pieno se è la prima cosa da fare, o se è tutto a posto: la scheda si apre per incassare. */}
        <button type="button" className={tastoPrincipale(p, chiaveGiorno(new Date())) === 'quota' ? 'num sg-chip sg-chip-pieno' : 'num sg-chip'} data-primo onClick={onNuova}>
          + REGISTRA UN PAGAMENTO
        </button>
      </div>
    </div>
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
