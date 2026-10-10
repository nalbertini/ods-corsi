import type { SupabaseClient } from '@supabase/supabase-js'
import type { DatiRichieste, FileRichiesta, Richiesta, StatoRichiesta, TipoFile } from './richieste'
import { ESTENSIONI, MASSIMO_FILE } from './richieste'
import { tutteLeRighe } from './tutteLeRighe'

/**
 * Le richieste di iscrizione col database vero (`supabase/06-iscrizioni.sql`).
 *
 * Chi si iscrive non ha un accesso: parla solo con `corsi_aperti` e
 * `invia_iscrizione`, e carica i file nella cartella della sua richiesta, che
 * il server tiene aperta per un'ora. La segreteria legge la tabella e apre i
 * file con un link che scade dopo dieci minuti.
 */

const CONTENITORE = 'iscrizioni'
const DURATA_LINK = 600

interface Riga {
  id: string
  creata_il: string
  stato: StatoRichiesta
  nome: string
  cognome: string
  nato_il: string
  nato_a: string
  codice_fiscale: string
  indirizzo: string
  cap: string
  comune: string
  email: string
  telefono: string
  telefono_2: string | null
  genitore_nome: string | null
  genitore_cognome: string | null
  genitore_codice_fiscale: string | null
  corsi: string[]
  formula: 'annuale' | 'trimestre'
  note: string | null
  regolamento: boolean
  persona_id: string | null
  gestita_il: string | null
  gestore: { nome: string; cognome: string } | null
}

function guaio(e: { message?: string; code?: string } | null): Error {
  if (e?.code === '42501') return new Error('Non hai il permesso: serve un accesso da segreteria')
  // La funzione non c'è sul database: 06-iscrizioni.sql non è stato lanciato.
  if (e?.code === 'PGRST202')
    return new Error('Il modulo di iscrizione non è ancora attivo sul database: la segreteria deve lanciare 06-iscrizioni.sql')
  return new Error(e?.message || 'Il server non risponde')
}

function ok<T>(r: { data: T; error: { message?: string; code?: string } | null }): T {
  if (r.error) throw guaio(r.error)
  return r.data
}

/** Un errore dello Storage detto per chi sta caricando la foto di un documento. */
function guaioFile(e: { message?: string; statusCode?: string } | null): Error {
  const m = e?.message ?? ''
  if (/row-level security|unauthorized|403/i.test(m + (e?.statusCode ?? '')))
    return new Error('Il tempo per caricare i file è scaduto, o sono già arrivati tutti: scrivi alla segreteria')
  if (/exceeded|too large|413/i.test(m + (e?.statusCode ?? ''))) return new Error('Il file è troppo grande: al massimo 10 MB')
  if (/mime|type/i.test(m)) return new Error('Questo tipo di file non va: serve una foto o un PDF')
  if (/exists|duplicate/i.test(m)) return new Error('Questo file è già arrivato')
  return new Error(m || 'Il file non è partito: riprova')
}

export function creaRichiesteSupabase(db: SupabaseClient): DatiRichieste {
  const vista = (r: Riga): Richiesta => ({
    id: r.id,
    creataIl: r.creata_il,
    stato: r.stato,
    nome: r.nome,
    cognome: r.cognome,
    natoIl: r.nato_il,
    natoA: r.nato_a,
    codiceFiscale: r.codice_fiscale,
    indirizzo: r.indirizzo,
    cap: r.cap,
    comune: r.comune,
    email: r.email,
    telefono: r.telefono,
    telefono2: r.telefono_2 ?? undefined,
    genitoreNome: r.genitore_nome ?? undefined,
    genitoreCognome: r.genitore_cognome ?? undefined,
    genitoreCodiceFiscale: r.genitore_codice_fiscale ?? undefined,
    corsi: r.corsi,
    formula: r.formula,
    note: r.note ?? undefined,
    regolamento: r.regolamento,
    personaId: r.persona_id ?? undefined,
    gestitaIl: r.gestita_il ?? undefined,
    gestitaDa: r.gestore ? `${r.gestore.nome} ${r.gestore.cognome}`.trim() : undefined,
  })

  const nomi = async (richiestaId: string) => {
    const { data, error } = await db.storage.from(CONTENITORE).list(richiestaId)
    if (error) throw guaioFile(error)
    return (data ?? []).map((f) => `${richiestaId}/${f.name}`)
  }

  return {
    modo: 'supabase',

    async corsiAperti() {
      return ok(await db.rpc('corsi_aperti')) as Array<{ id: string; nome: string }>
    },

    async orariAperti() {
      // Prima di 48-orari-aperti.sql (o senza rete) non c'è «stessa ora»: il modulo va avanti lo stesso.
      try {
        const { data, error } = await db.rpc('orari_aperti')
        if (error || !Array.isArray(data)) return []
        // Le colonne di orari_aperti() in 48-orari-aperti.sql: il client non le conosce.
        return (data as Array<{ corso_id: string; giorno: number; ora: string; durata_min: number }>).map((r) => ({
          corsoId: r.corso_id,
          giorno: r.giorno,
          ora: r.ora.slice(0, 5),
          durata: r.durata_min,
        }))
      } catch {
        return []
      }
    },

    async invia(d) {
      return ok(
        await db.rpc('invia_iscrizione', {
          dati: {
            nome: d.nome,
            cognome: d.cognome,
            nato_il: d.natoIl,
            nato_a: d.natoA,
            codice_fiscale: d.codiceFiscale,
            indirizzo: d.indirizzo,
            cap: d.cap,
            comune: d.comune,
            email: d.email,
            telefono: d.telefono,
            telefono_2: d.telefono2,
            genitore_nome: d.genitoreNome,
            genitore_cognome: d.genitoreCognome,
            genitore_codice_fiscale: d.genitoreCodiceFiscale,
            corsi: d.corsi,
            formula: d.formula,
            note: d.note,
            regolamento: d.regolamento === true,
          },
        }),
      ) as string
    },

    async caricaFile(richiestaId, tipo, file) {
      const est = ESTENSIONI[file.type]
      if (!est) throw new Error('Questo tipo di file non va: serve una foto o un PDF')
      if (file.size > MASSIMO_FILE) throw new Error('Il file è troppo grande: al massimo 10 MB')
      const { error } = await db.storage.from(CONTENITORE).upload(`${richiestaId}/${tipo}.${est}`, file, { contentType: file.type, upsert: false })
      // «C'è già» vuol dire che il file era arrivato e si era persa solo la
      // risposta (una rete da telefono): per chi riprova è andata.
      if (error && /exists|duplicate/i.test(error.message ?? '')) return
      if (error) throw guaioFile(error)
    },

    async richieste() {
      const righe = ok(
        await tutteLeRighe((prima, ultima) =>
          db
            .from('richieste_iscrizione')
            .select('*, gestore:persone!gestita_da ( nome, cognome )')
            .order('creata_il', { ascending: false })
            .order('id')
            .range(prima, ultima),
        ),
      ) as unknown as Riga[]
      return righe.map(vista)
    },

    async file(richiestaId) {
      const tutti = await nomi(richiestaId)
      if (!tutti.length) return []
      const { data, error } = await db.storage.from(CONTENITORE).createSignedUrls(tutti, DURATA_LINK)
      if (error) throw guaioFile(error)
      return (data ?? []).flatMap((f): FileRichiesta[] => {
        const nome = f.path?.split('/')[1] ?? ''
        const tipo = nome.replace(/\.[a-z]+$/, '') as TipoFile
        return f.signedUrl ? [{ tipo, url: f.signedUrl, pdf: nome.endsWith('.pdf') }] : []
      })
    },

    async conDocumento() {
      const r = await db.rpc('richieste_con_documento')
      // Senza 06-iscrizioni.sql rilanciato la funzione non c'è: niente da segnalare, l'elenco si vede lo stesso.
      if (r.error?.code === 'PGRST202') return new Set<string>()
      return new Set((ok(r) as string[] | null) ?? [])
    },

    async eliminaFile(richiestaId, tipo) {
      const suoi = (await nomi(richiestaId)).filter((n) => n.split('/')[1]?.replace(/\.[a-z]+$/, '') === tipo)
      if (!suoi.length) return
      const { data, error } = await db.storage.from(CONTENITORE).remove(suoi)
      if (error) throw guaioFile(error)
      // Lo Storage non dice di no quando la policy non lascia cancellare: torna meno file.
      if ((data ?? []).length < suoi.length) throw new Error('Il file non si è cancellato: serve un accesso da segreteria')
    },

    async accogli(richiestaId, personaId) {
      // `persona` solo quando la sceglie la segreteria: finché `06-iscrizioni.sql`
      // non è rilanciato la funzione ha un argomento solo, e così accoglie lo stesso.
      return ok(await db.rpc('accogli_iscrizione', personaId ? { richiesta: richiestaId, persona: personaId } : { richiesta: richiestaId })) as string
    },

    async rifiuta(richiestaId) {
      ok(await db.rpc('rifiuta_iscrizione', { richiesta: richiestaId }))
    },

    async elimina(richiestaId) {
      // Prima i file: una riga senza file è innocua, un file senza riga resta
      // lì e nessuno lo ritrova più.
      const tutti = await nomi(richiestaId)
      if (tutti.length) {
        const { error } = await db.storage.from(CONTENITORE).remove(tutti)
        if (error) throw guaioFile(error)
      }
      ok(await db.from('richieste_iscrizione').delete().eq('id', richiestaId))
    },
  }
}
