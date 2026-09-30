import { useEffect, useState } from 'react'
import type { DatiSegreteria, PersonaSeg } from '../../lib/segreteria'
import {
  centesimi,
  conti,
  cosaNonVa,
  euro,
  METODI,
  nomeFileRicevuta,
  vociDelCorso,
  vociPronte,
  type DatiRicevuta,
  type EnteRicevuta,
  type IntestatarioRicevuta,
  type Ricevuta,
  type VoceRicevuta,
} from '../../lib/ricevute'
import { chiaveGiorno } from '../../lib/sala'
import { Campo, dataLunga, Guaio, Riga, useAvviso, useCarica } from './comune'

type Fai = ReturnType<typeof useAvviso>['fai']

/** Il PDF si fa solo quando serve: pdf-lib pesa, e l'elenco non ne ha bisogno. */
const scarica = async (r: Ricevuta) => (await import('../../lib/ricevutaPdf')).scaricaRicevuta(r, nomeFileRicevuta(r))

const QUOTA = 'QUOTA ASSOCIATIVA'

/**
 * Le ricevute di un iscritto, nella sua scheda: quelle fatte, da riscaricare
 * o annullare, e il tasto per registrare un pagamento nuovo.
 */
export function RicevuteIscritto({ d, p, fai, onNuova }: { d: DatiSegreteria; p: PersonaSeg; fai: Fai; onNuova: () => void }) {
  const ricevute = useCarica(() => d.ricevute(p.id), [d, p.id])

  return (
    <div className="stack" style={{ gap: 8 }}>
      <Riga titolo="RICEVUTE" />
      {ricevute.guaio && <Guaio testo={ricevute.guaio} />}
      {ricevute.dato?.length === 0 && <span className="sg-sotto">Ancora nessuna ricevuta.</span>}
      {ricevute.dato?.map((r) => (
        <div key={r.id} className="sg-voce-elenco">
          <span className="stack grow" style={{ minWidth: 0 }}>
            <span className="num" style={{ fontSize: 15, fontWeight: 700, textDecoration: r.annullataIl ? 'line-through' : undefined }}>
              N. {r.numero}/{r.anno} · {euro(r.totale)} €
            </span>
            <span style={{ fontSize: 12, color: r.annullataIl ? 'var(--rosso)' : 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.annullataIl ? `Annullata il ${dataLunga(r.annullataIl.slice(0, 10))} · ` : ''}
              {dataLunga(r.data)} · {r.voci.map((v) => v.descrizione).join(', ')}
            </span>
          </span>
          <button type="button" className="num sg-chip" onClick={() => void fai(() => scarica(r))}>
            PDF
          </button>
          {!r.annullataIl && (
            <button
              type="button"
              className="sg-link"
              onClick={() => {
                if (window.confirm(`Annullare la ricevuta ${r.numero}/${r.anno}? Resta in elenco col suo numero, e il PDF dirà ANNULLATA.`))
                  void fai(() => d.annullaRicevuta(r.id), 'Ricevuta annullata', ricevute.ricarica)
              }}
            >
              Annulla
            </button>
          )}
        </div>
      ))}
      <div className="row">
        <button type="button" className="num sg-chip sg-chip-pieno" onClick={onNuova}>
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
 * questa stagione non è ancora pagata, l'annuale dei corsi che fa. Tutto si
 * cambia prima di fare la ricevuta; dopo, la ricevuta non si cambia più.
 */
export function NuovaRicevuta({
  d,
  p,
  corsi,
  fai,
  onFatta,
  onLasciaStare,
}: {
  d: DatiSegreteria
  p: PersonaSeg
  /** I nomi dei corsi che fa adesso: le loro voci vengono prima. */
  corsi: string[]
  fai: Fai
  onFatta: () => void
  onLasciaStare: () => void
}) {
  const oggi = chiaveGiorno(new Date())
  const [data, setData] = useState(oggi)
  const anno = Number(data.slice(0, 4)) || Number(oggi.slice(0, 4))
  const prossimo = useCarica(() => d.prossimoNumero(anno), [d, anno])
  const partenza = useCarica(() => Promise.all([d.intestatarioDi(p.id), d.enteRicevute(), d.ricevute(p.id)]), [d, p.id])
  const [numero, setNumero] = useState('')
  const [metodo, setMetodo] = useState<string>(METODI[0])
  const [voci, setVoci] = useState<Bozza[] | null>(null)
  const [socio, setSocio] = useState<IntestatarioRicevuta | null>(null)
  const [ente, setEnte] = useState<EnteRicevuta | null>(null)
  const [anticipo, setAnticipo] = useState('')
  const [note, setNote] = useState('')
  const [segna, setSegna] = useState(true)
  const [aggiungi, setAggiungi] = useState('')

  const pronte = vociPronte(corsi, data)

  // La prima volta che arriva quello che si sa, si compila il modulo.
  useEffect(() => {
    if (!partenza.dato || voci) return
    const [intestatario, e, fatte] = partenza.dato
    setSocio(intestatario)
    setEnte(e)
    const quotaPagata = fatte.some((r) => !r.annullataIl && r.voci.some((v) => v.descrizione.toUpperCase() === QUOTA && (!v.al || v.al >= oggi)))
    setVoci([
      ...(quotaPagata ? [] : [bozzaDa(pronte[0].voce(oggi))]),
      ...corsi.flatMap((c) => vociDelCorso(c, data).slice(0, 1)).map((v) => bozzaDa(v.voce(oggi))),
    ])
  }, [partenza.dato])

  if (partenza.guaio) return <Guaio testo={`Non si riesce a preparare la ricevuta: ${partenza.guaio}`} />
  if (!voci || !socio || !ente) return <span className="sg-sotto">Un momento…</span>

  const cambia = (chiave: number, c: Partial<Bozza>) =>
    setVoci(
      voci.map((b) => {
        if (b.chiave !== chiave) return b
        const x = { ...b, ...c }
        // Il pagato segue prezzo e quantità, finché non lo si scrive a mano.
        if (!x.pagatoAMano && (c.prezzo !== undefined || c.quantita !== undefined)) {
          const pr = centesimi(x.prezzo)
          const q = Number(x.quantita)
          if (pr !== null && Number.isInteger(q)) x.pagato = euro(pr * q)
        }
        return x
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

  // In scheda: pagato fino all'ultima voce dei corsi (la quota da sola non basta).
  const corsiPagati = (dati?.voci ?? []).filter((v) => v.descrizione.toUpperCase() !== QUOTA)
  const fino = corsiPagati.map((v) => v.al ?? '').filter(Boolean).sort().pop()
  const statoScheda = c && c.netto > 0 ? 'in_parte' : 'pagato'
  const puoSegnare = corsiPagati.length > 0

  const campoSocio = (k: keyof IntestatarioRicevuta, etichetta: string, o: { tipo?: string; largo?: boolean; max?: number } = {}) => (
    <Campo id={`rs-${k}`} etichetta={etichetta} largo={o.largo}>
      <input
        id={`rs-${k}`}
        className="sg-campo"
        type={o.tipo ?? 'text'}
        maxLength={o.max ?? 120}
        value={socio[k] ?? ''}
        onChange={(e) => setSocio({ ...socio, [k]: e.target.value })}
      />
    </Campo>
  )

  const emetti = () => {
    if (!dati) return
    void fai(
      async () => {
        const r = await d.emettiRicevuta(dati)
        if (segna && puoSegnare && c) {
          await d.salvaPagamento(p.id, {
            stato: statoScheda,
            fino,
            nota: c.netto > 0 ? `Mancano ${euro(c.netto)} € (ricevuta ${r.numero}/${r.anno})` : undefined,
          })
        }
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
              <button type="button" className="sg-link" onClick={() => setVoci(voci.filter((x) => x.chiave !== b.chiave))}>
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
            <option value="mano">Una voce scritta a mano</option>
            {pronte.map((v) => (
              <option key={v.chiave} value={v.chiave}>
                {v.etichetta}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="num sg-chip sg-chip-pieno"
            disabled={!aggiungi || voci.length >= 20}
            onClick={() => {
              const v = aggiungi === 'mano' ? { descrizione: '', quantita: 1, prezzo: 0 } : pronte.find((x) => x.chiave === aggiungi)?.voce(data)
              if (v) setVoci([...voci, bozzaDa(v)])
              setAggiungi('')
            }}
          >
            AGGIUNGI
          </button>
        </div>
      </div>

      <details open={!socio.codiceFiscale || !socio.indirizzo}>
        <summary className="sg-etichetta" style={{ cursor: 'pointer' }}>
          DATI DEL SOCIO · {`${socio.cognome} ${socio.nome}`.toUpperCase()}
          {socio.codiceFiscale ? ` · ${socio.codiceFiscale}` : ' · manca il codice fiscale'}
        </summary>
        <div className="sg-due" style={{ marginTop: 12 }}>
          {campoSocio('nome', 'NOME', { max: 80 })}
          {campoSocio('cognome', 'COGNOME', { max: 80 })}
          {campoSocio('indirizzo', 'INDIRIZZO', { largo: true, max: 160 })}
          {campoSocio('cap', 'CAP', { max: 5 })}
          {campoSocio('comune', 'COMUNE', { max: 80 })}
          {campoSocio('provincia', 'PROVINCIA', { max: 2 })}
          {campoSocio('natoIl', 'NATO IL', { tipo: 'date' })}
          {campoSocio('codiceFiscale', 'CODICE FISCALE', { max: 16 })}
          {campoSocio('partitaIva', 'PARTITA IVA · FACOLTATIVA', { max: 11 })}
          {campoSocio('genitore', 'GENITORE · PER UN MINORE', { max: 160 })}
          {campoSocio('genitoreCodiceFiscale', 'C.F. DEL GENITORE', { max: 16 })}
        </div>
        <span style={{ fontSize: 12, color: 'var(--dim)' }}>
          Vengono dall’ultima ricevuta o dal modulo di iscrizione. Qui si correggono per questa ricevuta; la scheda della persona non cambia.
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
          <div className="row" style={{ justifyContent: 'space-between', color: c.netto > 0 ? 'var(--rosso)' : 'var(--sec)' }}>
            <span className="sg-etichetta">NETTO A PAGARE</span>
            <span className="num">{euro(c.netto)} €</span>
          </div>
        </div>
      )}

      {puoSegnare && (
        <label className="row" style={{ gap: 8, fontSize: 14, color: 'var(--sec)', cursor: 'pointer' }}>
          <input type="checkbox" checked={segna} onChange={(e) => setSegna(e.target.checked)} />
          Segna in scheda: {statoScheda === 'pagato' ? 'PAGATO' : 'PAGATO IN PARTE'}
          {fino ? ` fino al ${dataLunga(fino)}` : ''}
        </label>
      )}

      {guaio && <span style={{ fontSize: 13, color: 'var(--rosso)' }}>{guaio}</span>}
      {!guaio && <span style={{ fontSize: 12, color: 'var(--dim)' }}>Fatta la ricevuta, non si cambia più: se è sbagliata si annulla e se ne fa un’altra.</span>}

      <div className="sg-scheda-piede">
        <button type="button" className="sg-btn sg-btn-linea grow" onClick={onLasciaStare}>
          LASCIA STARE
        </button>
        <button type="button" className="sg-btn sg-btn-rosso grow" disabled={!!guaio || !dati} onClick={emetti}>
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

  const campo = (k: keyof EnteRicevuta, etichetta: string, max = 120, largo = false) => (
    <Campo id={`en-${k}`} etichetta={etichetta} largo={largo}>
      <input id={`en-${k}`} className="sg-campo" maxLength={max} value={e?.[k] ?? ''} disabled={!e} onChange={(x) => e && setB({ ...e, [k]: x.target.value })} />
    </Campo>
  )

  return (
    <section aria-label="Le ricevute" className="sg-riquadro">
      <span className="ob sg-riquadro-titolo">LE RICEVUTE</span>
      <span className="sg-sotto">Chi fa le ricevute: va in testa a ognuna. Quelle già fatte restano come erano.</span>
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
            className="sg-btn sg-btn-rosso grow"
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
