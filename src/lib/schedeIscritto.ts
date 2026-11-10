// Le schede DOCUMENTI, QUOTA E PAGAMENTI e CORSI dell'iscritto: ogni cosa è un
// riquadro con lo stato in grande, il dettaglio sotto e i tasti a destra. Qui
// le parole dei riquadri, perché si provano senza browser.
import { riassunto, type PagamentoDiretto } from './pagamenti'
import { dettaglioCorso, type StatoCorso } from './corsiDaPagare'
import { stagioneDi } from './costi'
import { euro, type Ricevuta } from './ricevute'
import { dataLunga } from './sala'
import { soldi } from './satispay'
import { inCorso, pagamentoDi, presentaCertificato, statoCertificato, timbriScheda, timbroDocumento, type CertificatoSeg, type IscrizioneSeg, type PersonaSeg, type StatoPaga, type Tono } from './segreteria'

export interface Riquadro {
  nome: string
  sotto: string
  tono: Tono
}

const giorni = (dal: string, al: string) => Math.round((Date.parse(al) - Date.parse(dal)) / 86_400_000)

/** Da dove viene la data: il file, un file che non c'è più, o la segreteria che l'ha scritta a mano. */
const doveFile = (c: CertificatoSeg) =>
  c.conFile ? (c.caricatoIl ? `file caricato il ${dataLunga(c.caricatoIl.slice(0, 10))}` : 'file caricato') : c.caricatoIl ? 'file cancellato' : 'data scritta dalla segreteria, senza file'

/** Il tasto del termine: «Dai una data» a chi non ne ha una scritta (le schede di prima, il rinnovo passato). */
export type TastoTermine = 'Cambia la data' | 'Dai una data'

export function riquadroCertificato(c: CertificatoSeg, natoIl: string | undefined, oggi: string, attiva = true): Riquadro & { tasto?: TastoTermine } {
  const x = presentaCertificato(c, natoIl, oggi, attiva)
  const data = c.scade ? dataLunga(c.scade).toUpperCase() : ''
  const fra = c.scade ? giorni(oggi, c.scade) : 0
  const stato = statoCertificato({ certificato: c, natoIl }, oggi)
  const rosso = stato === 'manca' || stato === 'scaduto'
  // Nel termine col file mandato: lo conferma la segreteria, non serve spostare la data.
  const tasto: TastoTermine | undefined = !attiva || c.inAttesaIl ? undefined : c.entroScritto && (rosso || stato === 'atteso') ? 'Cambia la data' : rosso ? 'Dai una data' : undefined
  const conTasto = (r: Riquadro) => (tasto ? { ...r, tasto } : r)
  if (stato === 'atteso' && c.entro) {
    const entro = dataLunga(c.entro).toUpperCase()
    const mancano = giorni(oggi, c.entro)
    const quando = mancano === 0 ? 'oggi' : mancano === 1 ? 'domani' : `fra ${mancano} giorni`
    const sotto = c.inAttesaIl
      ? `caricato il ${dataLunga(c.inAttesaIl)}, da confermare: finché non lo confermi non vale`
      : c.scade
        ? `${quando} · il nuovo va portato entro ${giorni(c.scade, c.entro)} giorni dalla scadenza`
        : `${quando} · ${c.spostatoDa && c.spostatoIl ? `data spostata da ${c.spostatoDa} il ${dataLunga(c.spostatoIl)}` : 'iscritto senza certificato'}`
    return conTasto({ nome: c.scade ? `SCADUTO IL ${data} · DA PORTARE ENTRO IL ${entro}` : `DA PORTARE ENTRO IL ${entro}`, sotto, tono: 'giallo' })
  }
  if (stato === 'manca' && !c.conFile) {
    if (!c.entro) return conTasto({ nome: 'CERTIFICATO NON ARRIVATO', sotto: 'iscritto prima di questa regola, senza termine · la presenza si segna', tono: 'rosso' })
    const da = giorni(c.entro, oggi)
    return conTasto({ nome: `DOVEVA PORTARLO ENTRO IL ${dataLunga(c.entro).toUpperCase()}`, sotto: `${da === 1 ? 'da ieri' : `da ${da} giorni`} · la presenza si segna, ma va sollecitato`, tono: 'rosso' })
  }
  const [nome, sotto] =
    x.parola === 'VALIDO'
      ? [`VALIDO FINO AL ${data}`, doveFile(c)]
      : x.parola === 'IN SCADENZA'
        ? [`SCADE IL ${data}`, `${fra === 0 ? 'oggi' : fra === 1 ? 'domani' : `fra ${fra} giorni`} · ${doveFile(c)}`]
        : x.parola === 'SCADUTO'
          ? [`SCADUTO IL ${data}`, `${fra === -1 ? 'ieri' : `${-fra} giorni fa`} · ${doveFile(c)}`]
          : x.parola === 'MANCA'
            ? ['MANCA', c.conFile ? 'il file c’è, manca la data: scrivila leggendo il foglio' : 'nessun file e nessuna data']
            : x.parola === 'NON SERVE'
              ? ['NON SERVE', 'sotto i 6 anni non è obbligatorio']
              : [x.parola, x.frase]
  return conTasto({ nome, sotto, tono: x.tono })
}

export function riquadroDocumento(documento: boolean, minore: boolean): Riquadro & { tasto: string } {
  const { parola: nome, tono } = timbroDocumento(documento)
  return documento
    ? { nome, sotto: minore ? 'copia del genitore, in segreteria' : 'copia in segreteria', tono, tasto: 'Non c’è più' }
    : { nome, sotto: minore ? 'va mostrato in segreteria, quello del genitore' : 'va mostrato in segreteria', tono, tasto: 'La copia è in segreteria' }
}

/** La quota in una frase, per il caso che è: le date ci sono solo dove servono. */
export function fraseQuota(s: StatoPaga): string {
  const fino = s.fino ? dataLunga(s.fino) : ''
  if (s.come === 'pagato')
    return s.fonte === 'ricevuta'
      ? `Pagata${fino ? ` fino al ${fino}` : ''}${s.ricevuta ? ` · ricevuta ${s.ricevuta}` : ''}.`
      : s.fonte === 'satispay'
        ? `Pagata con Satispay dal modulo (${soldi(s.importo ?? 0)}): manca la ricevuta, con PAGATO CON «Satispay».`
        : `Pagata fuori dall’app${fino ? `, fino al ${fino}` : ''}.`
  if (s.come === 'in_parte')
    return s.fonte === 'ricevuta' ? `Mancano ${euro(s.mancano ?? 0)} € della quota${s.ricevuta ? ` · ricevuta ${s.ricevuta}` : ''}.` : `Pagata in parte fuori dall’app${fino ? `, fino al ${fino}` : ''}.`
  return s.come === 'scaduto' ? `Valeva fino al ${fino}: è da pagare di nuovo.` : 'Nessuna ricevuta con la quota di questa stagione.'
}

export function riquadroQuota(p: Pick<PersonaSeg, 'attiva' | 'certificato' | 'documento' | 'pagamento' | 'quote' | 'satispay' | 'natoIl'>, oggi: string): Riquadro {
  const t = timbriScheda(p, oggi).quota
  const s = pagamentoDi(p, oggi)
  // La nota la scrive la segreteria quando segna la quota pagata fuori dall'app: è il perché, va accanto.
  return { nome: `QUOTA ASSOCIATIVA · ${t.parola}`, sotto: `${fraseQuota(s)}${s.fonte === 'fuori_app' && s.nota ? ` ${s.nota}` : ''}`, tono: t.tono }
}

const BOLLINI: Record<StatoCorso['come'], [string, 'verde' | 'rosso' | 'giallo']> = {
  pagato: ['PAGATO', 'verde'],
  fuori_app: ['PAGATO FUORI APP', 'verde'],
  satispay: ['PAGATO CON SATISPAY', 'verde'],
  in_parte: ['PAGATO IN PARTE', 'giallo'],
  da_controllare: ['DA CONTROLLARE', 'giallo'],
  scaduto: ['DA PAGARE', 'rosso'],
  fuori_scaduto: ['DA PAGARE', 'rosso'],
  da_pagare: ['DA PAGARE', 'rosso'],
}

export function bollinoCorso(s: StatoCorso): { parola: string; tono: 'verde' | 'rosso' | 'giallo' } {
  const [parola, tono] = BOLLINI[s.come]
  return { parola, tono }
}

export function riquadroCorso(s: StatoCorso): Riquadro {
  const b = bollinoCorso(s)
  // «da pagare» ripeterebbe il nome: il riquadro resta con lo stato solo.
  return { nome: `${s.corso.toUpperCase()} · ${b.parola}`, sotto: s.come === 'da_pagare' ? '' : dettaglioCorso(s).testo, tono: b.tono }
}

export type RigaStorico = { tipo: 'ricevuta'; r: Ricevuta } | { tipo: 'diretto'; x: PagamentoDiretto }

/** Ricevute e incassi senza ricevuta in un elenco solo, dal più recente: a pari giorno prima le ricevute, la più nuova in cima. */
export function storicoPagamenti(ricevute: Ricevuta[], diretti: PagamentoDiretto[]): RigaStorico[] {
  const righe: RigaStorico[] = [...ricevute.map((r) => ({ tipo: 'ricevuta' as const, r })), ...diretti.map((x) => ({ tipo: 'diretto' as const, x }))]
  const data = (a: RigaStorico) => (a.tipo === 'ricevuta' ? a.r.data : a.x.data)
  const dopo = (a: RigaStorico) => (a.tipo === 'ricevuta' ? `1${String(a.r.anno)}${String(a.r.numero).padStart(8, '0')}` : `0${a.x.creatoIl}`)
  return righe.sort((a, b) => data(b).localeCompare(data(a)) || dopo(b).localeCompare(dopo(a)))
}

/** Un elenco lungo si apre a richiesta: le prime `n`, e quante restano. */
export function primeRighe<T>(lista: T[], tutte: boolean, n = 5): { righe: T[]; altre: number } {
  return tutte || lista.length <= n ? { righe: lista, altre: 0 } : { righe: lista.slice(0, n), altre: lista.length - n }
}

/** Quanto è entrato nella stagione di oggi, tra ricevute e incassi: le annullate non contano. */
export function pagatoNellaStagione(ricevute: Ricevuta[], diretti: PagamentoDiretto[], oggi: string): number {
  const { dal, al } = stagioneDi(oggi)
  const dentro = (g: string) => g >= dal && g <= al
  return riassunto(ricevute.filter((r) => dentro(r.data)), diretti.filter((x) => dentro(x.data))).pagato
}

export function iscrizioniDellaScheda(iscrizioni: IscrizioneSeg[], oggi: string): { correnti: IscrizioneSeg[]; terminate: IscrizioneSeg[] } {
  return {
    correnti: iscrizioni.filter((i) => inCorso(i, oggi)),
    terminate: iscrizioni.filter((i) => !!i.al && i.al < oggi).sort((a, b) => (b.al ?? '').localeCompare(a.al ?? '')),
  }
}
