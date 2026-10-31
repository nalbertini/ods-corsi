import { archivio } from './archivioProva'
import { oggiARoma } from './contabilita'
import { nuovoId } from './prove'
import { cosaNonVaDataFirma, cosaNonVaFile, cosaNonVaRettifica, cosaNonVaSostituzione, cosaNonVaVerbale, numeroDi, pdfInVigore, puoEliminare, puoModificare, puoRettificare, puoSostituirePdf, type DatiVerbali, type Verbale } from './verbali'

const NON_C_E = 'Questo verbale non c’è più: ricarica la pagina'

/** Quattro verbali finti: una bozza di quest'anno e tre firmati dell'anno scorso, uno rettificato. */
export function verbaliDiProva(oggi: string): Verbale[] {
  const anno = Number(oggi.slice(0, 4))
  const scorso = anno - 1
  const completo = (id: string, numero: number, tipo: Verbale['tipo'], data: string): Verbale => ({
    id, anno: scorso, numero, tipo, data, oraInizio: '18:30', oraFine: '20:00', luogo: 'Sede della società', odg: ['Approvazione del verbale precedente', 'Varie ed eventuali'],
    presidenteId: 'i-maurizio', segretarioId: 'i-maura', aventiDiritto: 40, presenti: 22, deleghe: 3, stato: 'firmato', firmatoIl: `${scorso}-${data.slice(5, 7)}-28`, storico: false,
    delibere: [], cariche: [], rettifiche: [],
    allegati: [{ id: `${id}-pdf`, tipo: 'firmato', nome: `verbale-${numero}-${scorso}.pdf`, peso: 480000, caricatoIl: `${scorso}-${data.slice(5, 7)}-28` }],
  })
  const soci = completo('verbale-soci', 1, 'soci', `${scorso}-03-12`)
  soci.delibere = [
    { id: 'd-consuntivo', titolo: 'Approvazione del bilancio consuntivo', argomento: 'bilancio', bilancioTipo: 'consuntivo', annoRif: scorso - 1, esito: 'approvata', comeVotato: 'all’unanimità' },
    { id: 'd-quote', titolo: 'Quote della nuova stagione', argomento: 'quote', esito: 'approvata', comeVotato: 'a maggioranza' },
  ]
  const direttivo = completo('verbale-direttivo', 2, 'direttivo', `${scorso}-06-05`)
  direttivo.delibere = [{ id: 'd-affitto', titolo: 'Rinnovo del contratto della sede', argomento: 'sede_affitto', esito: 'approvata' }]
  const elettiva = completo('verbale-elettiva', 3, 'elettiva', `${scorso}-09-20`)
  elettiva.delibere = [{ id: 'd-elezioni', titolo: 'Elezione del direttivo', argomento: 'elezioni', esito: 'approvata', comeVotato: 'per scrutinio' }]
  elettiva.cariche = [
    { carica: 'Presidente', personaId: 'i-maurizio', dal: elettiva.data },
    { carica: 'Segretario', personaId: 'i-maura', dal: elettiva.data },
  ]
  elettiva.rettifiche = [{ data: `${scorso}-10-15`, motivo: 'Errore di battitura', testo: 'I presenti erano 22, non 21.' }]
  const bozza: Verbale = {
    id: 'verbale-bozza', anno, numero: 1, tipo: 'direttivo', data: oggi, odg: ['Andamento dei corsi'], stato: 'bozza', storico: false,
    delibere: [], cariche: [], allegati: [], rettifiche: [],
  }
  return [bozza, soci, direttivo, elettiva]
}

/** Le stesse regole sull'archivio di prova: i vincoli e le funzioni di 127-verbali.sql rifatti qui. */
export async function creaVerbaliProva(): Promise<DatiVerbali> {
  const a = () => archivio.dati
  const lista = () => {
    a().verbali ??= verbaliDiProva(oggiARoma())
    return a().verbali ?? []
  }
  const trova = (id: string) => {
    const v = lista().find((x) => x.id === id)
    if (!v) throw new Error(NON_C_E)
    return v
  }
  const sostituisci = (v: Verbale) => {
    a().verbali = lista().map((x) => (x.id === v.id ? v : x))
    archivio.salva()
  }
  const nuovoAllegato = (f: { nome: string; peso: number }) => {
    const no = cosaNonVaFile({ ...f, tipo: 'application/pdf' })
    if (no) throw new Error(no)
    return { id: nuovoId(), tipo: 'firmato' as const, nome: f.nome.trim(), peso: f.peso, caricatoIl: oggiARoma() }
  }
  return {
    async leggi() {
      return lista().map((v) => ({ ...v }))
    },

    async salva(v) {
      const no = cosaNonVaVerbale({ ...v, id: v.id ?? '' })
      if (no) throw new Error(no)
      const prima = v.id ? trova(v.id) : undefined
      if (prima && !puoModificare(prima)) throw new Error('Un verbale firmato non si modifica: si rettifica con una nota')
      const id = v.id ?? nuovoId()
      if (lista().some((x) => x.id !== id && x.anno === v.anno && x.numero === v.numero)) throw new Error(`Il numero ${numeroDi(v)} esiste già: scegli il prossimo libero`)
      const nuovo: Verbale = { ...v, id, stato: 'bozza', firmatoIl: undefined, allegati: prima?.allegati ?? [], rettifiche: [] }
      a().verbali = prima ? lista().map((x) => (x.id === id ? nuovo : x)) : [...lista(), nuovo]
      archivio.salva()
      return id
    },

    async elimina(id) {
      if (!puoEliminare(trova(id))) throw new Error('Si elimina solo una bozza: un verbale firmato resta in archivio')
      a().verbali = lista().filter((x) => x.id !== id)
      archivio.salva()
    },

    async caricaPdf(id, file) {
      const v = trova(id)
      if (!puoModificare(v)) throw new Error('Il verbale è già firmato: per cambiare il PDF si sostituisce, dicendo perché')
      const nuovo = nuovoAllegato(file)
      sostituisci({ ...v, allegati: [...v.allegati.filter((x) => x.tipo !== 'firmato'), nuovo] })
    },

    async firma(id, data) {
      const v = trova(id)
      if (v.stato !== 'bozza') throw new Error('Questo verbale è già firmato')
      const no = cosaNonVaDataFirma(v, data, oggiARoma()) ?? cosaNonVaVerbale(v, { staFirmando: true })
      if (no) throw new Error(no)
      sostituisci({ ...v, stato: 'firmato', firmatoIl: data })
    },

    async rettifica(id, r) {
      const v = trova(id)
      if (!puoRettificare(v)) throw new Error('Si rettifica solo un verbale già firmato')
      const no = cosaNonVaRettifica(r)
      if (no) throw new Error(no)
      sostituisci({ ...v, rettifiche: [...v.rettifiche, { data: r.data, motivo: r.motivo.trim(), testo: r.testo.trim() }] })
    },

    async sostituisciPdf(id, file, motivo) {
      const v = trova(id)
      if (!puoSostituirePdf(v)) throw new Error('Il PDF si sostituisce solo su un verbale già firmato')
      const no = cosaNonVaSostituzione(motivo)
      if (no) throw new Error(no)
      const nuovo = nuovoAllegato(file)
      const vecchio = pdfInVigore(v)
      const allegati = v.allegati.map((x) => (x === vecchio ? { ...x, sostituitoIl: oggiARoma(), motivoSostituzione: motivo.trim() } : x))
      sostituisci({ ...v, allegati: [...allegati, nuovo] })
    },

    async linkPdf() {
      return ''
    },

    async leggiSegretari() {
      return a().verbaliSegretari ?? []
    },

    async salvaSegretari(personaIds) {
      a().verbaliSegretari = [...new Set(personaIds)]
      archivio.salva()
    },
  }
}
