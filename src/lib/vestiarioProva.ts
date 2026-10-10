import { NON_SI_APRE, riduciFoto } from './foto'
import { chiaveGiorno } from './sala'
import { capiPerRiga, effettoSalvataggio, prezzoRiga } from './vestiarioPagina'
import {
  CHIUSI,
  cifreTelefono,
  NON_SI_RIMANDA,
  PAGAMENTO_SBAGLIATO,
  RACCOLTA_SPARITA,
  pagamentoGiusto,
  RIMETTI_PRIMA,
  ORDINE_SPARITO,
  cosaNonVaCatalogo,
  cosaNonVaOrdine,
  cosaNonVaRighe,
  emailDi,
  ordiniAperti,
  prezzoDi,
  pulisciCatalogo,
  totaleOrdine,
  type Capo,
  type Tabelle,
  type Catalogo,
  type DatiVestiario,
  type Ordine,
  type OrdineNuovo,
  type Pagamento,
  type Raccolta,
  type Riga,
} from './vestiario'

/**
 * Gli ordini di vestiario senza server: sul dispositivo, in `localStorage`,
 * come le richieste di prova. Fa quello che fa `supabase/47-vestiario.sql`,
 * con gli stessi messaggi: aperti fino alla data della raccolta compresa,
 * capi e taglie del catalogo, il totale coi prezzi del catalogo, la proroga
 * che tiene la raccolta e la data nuova a raccolta chiusa che ne apre
 * un'altra.
 *
 * Due regole del database qui non ci sono, e va bene così:
 * - il limite di 60 ordini all'ora e quello per telefono servono contro chi
 *   riempie il server di ordini da un programma; in prova non c'è un server;
 * - il prezzo storto nel catalogo (`non ha un prezzo giusto`) il database lo
 *   controlla perché la segreteria può cambiarlo a mano saltando
 *   `salva_vestiario()`; qui il catalogo passa sempre da `salvaCatalogo`.
 */

const DOVE = 'ods-corsi:prova-vestiario'   // vedi la nota in coda.ts
/**
 * Le foto di prova, a parte: nome del file → data URL. Nel catalogo resta un
 * nome di file, come col database, così le stesse regole valgono uguali.
 */
const FOTO = 'ods-corsi:prova-vestiario-foto'
/** Più piccole che sul server: `localStorage` tiene pochi MB in tutto. */
const FOTO_PROVA = { lato: 600, basta: 100_000, sempreJpeg: true }

/** Salvare senza spazio non deve dire «fatto»: la prova si svuota da lì. */
export const SPAZIO_PIENO = "Lo spazio della prova su questo dispositivo è pieno: premi Riparti dall'orario vero"

function leggiFoto(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(FOTO) ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
}
function scriviFoto(f: Record<string, string>) {
  try {
    localStorage.setItem(FOTO, JSON.stringify(f))
  } catch {
    throw new Error(SPAZIO_PIENO)
  }
}

const comeDataUrl = (b: Blob) =>
  new Promise<string>((ok, no) => {
    const r = new FileReader()
    r.onload = () => ok(String(r.result))
    r.onerror = () => no(new Error(NON_SI_APRE))
    r.readAsDataURL(b)
  })

/** Per «Riparti dall'orario vero»: catalogo, raccolte e ordini fatti in prova. */
export function scordaVestiarioProva() {
  try {
    localStorage.removeItem(DOVE)
    localStorage.removeItem(FOTO)
  } catch {
    /* pazienza */
  }
}

interface Stato {
  /** I capi del catalogo; `null` se non è mai stato salvato. La data sta nella raccolta. */
  capi: Capo[] | null
  tabelle?: Tabelle
  /** La più recente in fondo: è quella in cui arrivano gli ordini. */
  raccolte: Raccolta[]
  ordini: Ordine[]
}

function leggi(): Stato {
  try {
    const s = JSON.parse(localStorage.getItem(DOVE) ?? 'null') as Partial<Stato> | null
    return { capi: s?.capi ?? null, tabelle: s?.tabelle, raccolte: s?.raccolte ?? [], ordini: s?.ordini ?? [] }
  } catch {
    return { capi: null, raccolte: [], ordini: [] }
  }
}

const nuovoId = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

/** Una riga come la scrive il database: per chi, capo e taglia senza spazi intorno. */
const riga = (r: OrdineNuovo['righe'][number], prezzo: number, id = nuovoId('rv')): Riga => ({
  id,
  perChi: r.perChi.trim(),
  capo: r.capo.trim(),
  taglia: r.taglia.trim(),
  quanti: r.quanti,
  prezzo,
})

/** `oggi` si passa per provare le date senza aspettarle. */
export function creaVestiarioProva(oggi: () => string = () => chiaveGiorno(new Date())): DatiVestiario {
  // Si rilegge a ogni operazione, come richiesteProva: due schede aperte sullo stesso
  // dispositivo scrivono nello stesso posto, e una non deve cancellare quel che ha scritto l'altra.
  let s = leggi()
  const salva = () => {
    try {
      localStorage.setItem(DOVE, JSON.stringify(s))
    } catch {
      throw new Error(SPAZIO_PIENO)
    }
  }
  const uno = (id: string) => {
    const o = s.ordini.find((x) => x.id === id)
    if (!o) throw new Error(ORDINE_SPARITO)
    return o
  }
  const ultima = (): Raccolta | undefined => s.raccolte[s.raccolte.length - 1]
  const capi = () => s.capi ?? []
  // Come `vestiario()`: la data è quella della raccolta di adesso.
  const catalogo = (): Catalogo | null => (s.capi ? { chiude: ultima()?.chiude ?? null, capi: s.capi, ...(s.tabelle && { tabelle: s.tabelle }) } : null)

  /** Come il database: niente codice fiscale né altro che non serve, e i prezzi del catalogo. */
  const entra = (o: OrdineNuovo, come: Pagamento | null, dalBanco: boolean): Ordine => {
    if (!pagamentoGiusto(come)) throw new Error(PAGAMENTO_SBAGLIATO)
    const raccolta = ultima()
    if (!raccolta) throw new Error("Non c'è ancora una raccolta: salva prima il catalogo con la data di chiusura")
    const guaio = cosaNonVaOrdine(o, capi())
    if (guaio) throw new Error(guaio)
    const righe = o.righe.map((r) => riga(r, prezzoDi(capi(), r.capo)))
    const totale = totaleOrdine(righe)
    const ordine: Ordine = {
      id: o.id || nuovoId('ov'),
      raccolta: raccolta.id,
      nome: o.nome.trim(),
      cognome: o.cognome.trim(),
      telefono: o.telefono.trim(),
      email: emailDi(o),
      righe,
      totale,
      annullato: false,
      ...pagamento(come, totale),
      arrivato: new Date().toISOString(),
      dalBanco,
    }
    s.ordini.push(ordine)
    salva()
    return ordine
  }
  /** Saldato con `come` (pagato il totale, oggi), o da saldare con niente pagato. */
  const pagamento = (come: Pagamento | null, totale: number) =>
    come ? { saldato: true, pagato: totale, pagatoCon: come, pagatoIl: oggi() } : { saldato: false, pagato: 0, pagatoCon: null, pagatoIl: null }

  /** Lo stesso ordine rimandato (la risposta si era persa): quello salvato, senza cambiarlo; un altro telefono no. */
  const giaMandato = (o: OrdineNuovo): Ordine | undefined => {
    const gia = o.id ? s.ordini.find((x) => x.id === o.id) : undefined
    if (gia && cifreTelefono(gia.telefono) !== cifreTelefono(o.telefono ?? '')) throw new Error(NON_SI_RIMANDA)
    return gia
  }
  const cambia = (id: string, cambi: Partial<Ordine>) => {
    Object.assign(uno(id), cambi)
    salva()
  }

  return {
    async caricaFoto(file) {
      const ridotta = await riduciFoto(new File([file], 'foto', { type: file.type }), FOTO_PROVA)
      const nome = `${crypto.randomUUID()}.jpg`
      scriviFoto({ ...leggiFoto(), [nome]: await comeDataUrl(ridotta) })
      return nome
    },

    async togliFoto(nomi) {
      try {
        const f = leggiFoto()
        for (const n of nomi) delete f[n]
        scriviFoto(f)
      } catch {
        /* una foto rimasta non rompe niente */
      }
    },

    urlFoto(nome) {
      return leggiFoto()[nome] ?? ''
    },

    fotoAttive: () => true,

    async catalogo() {
      s = leggi()
      return catalogo()
    },

    async salvaCatalogo(c) {
      s = leggi()
      const guaio = cosaNonVaCatalogo(c)
      if (guaio) throw new Error(guaio)
      const pulito = pulisciCatalogo(c)
      s.capi = pulito.capi
      // Senza la chiave le tabelle restano com'erano: chi salva solo i capi non le cancella.
      if ('tabelle' in c) s.tabelle = pulito.tabelle
      const r = ultima()
      // La stessa regola che la segreteria legge prima di SALVA.
      const { cosa } = effettoSalvataggio(r, c.chiude, oggi())
      if (cosa === 'proroga' && r && c.chiude) r.chiude = c.chiude
      if (cosa === 'raccolta nuova' && c.chiude) s.raccolte.push({ id: nuovoId('rc'), chiude: c.chiude })
      salva()
    },

    async inviaOrdine(o) {
      s = leggi()
      // Prima della chiusura, come nel database: l'ordine era arrivato in tempo, anche se la risposta no.
      const gia = giaMandato(o)
      if (gia) return gia
      if (!ordiniAperti(catalogo(), oggi())) throw new Error(CHIUSI)
      return entra(o, null, false)
    },

    async scriviOrdine(o, come = null) {
      s = leggi()
      return (giaMandato(o) ?? entra(o, come, true)).id
    },

    async raccolte() {
      s = leggi()
      return [...s.raccolte].reverse()
    },

    async ordini(raccolta) {
      s = leggi()
      // Dal più recente: arrivano in fondo.
      return s.ordini.filter((o) => o.raccolta === raccolta).reverse()
    },

    async segnaSaldato(id, come, tieniPagato = false) {
      s = leggi()
      const o = uno(id)
      if (!pagamentoGiusto(come)) throw new Error(PAGAMENTO_SBAGLIATO)
      if (o.annullato) throw new Error(RIMETTI_PRIMA)
      // TOGLI IL SEGNO dopo una correzione: il pagato di prima resta, con come e quando.
      cambia(id, come || !tieniPagato ? pagamento(come, o.totale) : { saldato: false })
    },

    async annulla(id, annullato) {
      s = leggi()
      cambia(id, { annullato })
    },

    async sposta(id, raccolta) {
      s = leggi()
      if (!s.raccolte.some((r) => r.id === raccolta)) throw new Error(RACCOLTA_SPARITA)
      cambia(id, { raccolta })
    },

    async correggiRighe(id, nuove, togliSegno = false) {
      s = leggi()
      const o = uno(id)
      if (nuove.some((r) => r.id && !o.righe.some((x) => x.id === r.id))) throw new Error("Una riga non è di quest'ordine: ricarica la pagina")
      const guaio = cosaNonVaRighe(nuove, capiPerRiga(o.righe, capi()))
      if (guaio) throw new Error(guaio)
      const righe = nuove.map((r) => riga(r, prezzoRiga(o.righe, r, capi()), r.id || undefined))
      const totale = totaleOrdine(righe)
      // Un saldato resta saldato e il pagato segue il totale; con TOGLI IL SEGNO, se il totale
      // sale, torna da saldare col pagato di prima (come e quando restano). Se scende non c'è da chiedere.
      const toglie = o.saldato && togliSegno && totale > o.totale
      cambia(id, { righe, totale, ...(toglie ? { saldato: false } : o.saldato && { pagato: totale }) })
    },
  }
}
