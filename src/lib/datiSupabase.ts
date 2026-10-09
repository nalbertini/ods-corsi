import type { SupabaseClient } from '@supabase/supabase-js'
import { allungaCalendario } from './allunga'
import type { Dati, IstruttoreLezione } from './dati'
import { daSenzaIstruttore, type MiaPresenza } from './ore'
import type { DettaglioSessione, Persona, SessioneVista, StatoPresenza } from './sala'
import { attivitaPerMenu, mancaAttivita, type ComePresenzaIstruttore } from './segreteria'
import type { StatoPresenzaIstruttore } from './tablet'
import { contiDellAppello, giornoDi, perCognome, valeIl } from './sala'
import { Coda } from './coda'
import { tutteLeRighe } from './tutteLeRighe'
import { disciplineDa, ripulisciDisciplina } from '../../timer/src/lib/discipline'
import type { GiaProvato, NuovaProva, PersonaTrovata } from './prove'
import { bastaPerCercare, eGiaVenuto, nuovoId, pulisciProva, RICERCA_NON_ATTIVA } from './prove'

/**
 * La sala corsi con il database vero.
 *
 * Le letture vanno dirette: se la rete non c'è, non c'è niente da mostrare e
 * fingere non aiuterebbe. Le scritture no — quelle passano dalla coda, perché
 * una presenza segnata in fondo a una sala senza campo non si può perdere
 * (vedi `coda.ts`).
 *
 * Qui non c'è nessun controllo di chi può fare cosa, di proposito: sta tutto
 * nelle policy in `supabase/02-policy.sql`. Un controllo scritto anche qui
 * darebbe l'illusione di proteggere qualcosa e prima o poi divergerebbe da
 * quello vero.
 */

/** Le righe come escono dalla query con le join, prima di diventare `SessioneVista`. */
interface RigaSessione {
  id: string
  corso_id: string
  inizio: string
  fine: string
  stato: SessioneVista['stato']
  note: string | null
  istruttore_id: string | null
  corsi: {
    nome: string
    colore: string | null
    capienza: number | null
    istruttore_id: string | null
    corsi_istruttori: Array<{ persona_id: string }> | null
  } | null
  sale: { nome: string } | null
  persone: { nome: string; cognome: string; kanji?: string | null } | null
  /** Cosa si fa in quella lezione, che arriva con 41-attivita.sql. */
  attivita?: { nome: string } | null
}

/**
 * Chi fa la lezione quel giorno. Se sulla lezione c'è un altro istruttore da
 * quello del corso è un sostituto, e la lezione è solo sua; altrimenti è di
 * tutti quelli che tengono il corso (`corsi_istruttori`), come nella policy
 * delle lezioni e nella prova.
 */
function insegnantiDi(s: RigaSessione): string[] {
  const delCorso = s.corsi?.istruttore_id ?? null
  if (s.istruttore_id && s.istruttore_id !== delCorso) return [s.istruttore_id]
  const tutti = [delCorso, s.istruttore_id, ...(s.corsi?.corsi_istruttori ?? []).map((r) => r.persona_id)]
  return [...new Set(tutti.filter((x): x is string => Boolean(x)))]
}

/**
 * Un'iscrizione con la persona, per decidere chi sta nell'appello di una
 * lezione: chi era iscritto quel giorno ed è ancora attivo, come nella
 * versione di prova (`iscrittiIl`) e in segreteria.
 */
interface RigaIscrizione {
  corso_id: string
  dal: string
  al: string | null
  persone: (Persona & { attiva: boolean }) | null
}

const ISCRIZIONE = 'corso_id, dal, al, persone ( id, nome, cognome, ruolo, attiva )'

/** Chi, fra queste iscrizioni, è nell'appello del corso quel giorno. */
const iscrittiIl = (righe: RigaIscrizione[], corsoId: string, giorno: string): Persona[] =>
  righe
    .filter((r) => r.corso_id === corsoId && r.persone?.attiva && valeIl(r, giorno))
    .map((r) => {
      const { attiva: _, ...p } = r.persone!
      return p
    })

const SELEZIONE_BASE = `
  id, corso_id, inizio, fine, stato, note, istruttore_id,
  corsi ( nome, colore, capienza, istruttore_id, corsi_istruttori ( persona_id ) ),
  sale ( nome ),
  persone ( nome, cognome__KANJI__ )__ATTIVITA__
`
/** Le due colonne facoltative: il kanji dell'istruttore (24-kanji.sql) e l'attività della lezione (41-attivita.sql). */
const selezione = (kanji: boolean, attivita: boolean) =>
  SELEZIONE_BASE.replace('__KANJI__', kanji ? ', kanji' : '').replace('__ATTIVITA__', attivita ? ',\n  attivita ( nome )' : '')

export function creaDatiSupabase(db: SupabaseClient): Dati {
  // Senza uno dei due file la colonna non c'è: si legge come prima, senza. Ognuno
  // si toglie solo quando è lui a mancare, così uno non nasconde l'altro.
  let conKanji = true
  let conAttivita = true
  const leggiSessioni = async <T,>(q: (sel: string) => PromiseLike<{ data: T; error: { code?: string; message?: string } | null }>) => {
    for (;;) {
      const r = await q(selezione(conKanji, conAttivita))
      if (conKanji && r.error?.code === '42703' && /kanji/.test(r.error.message ?? '')) conKanji = false
      else if (conAttivita && mancaAttivita(r.error)) conAttivita = false
      else return r
    }
  }

  // Le scritture in coda si eseguono qui. Se il server rifiuta per davvero —
  // non per mancanza di rete — l'operazione resterebbe in coda per sempre: per
  // questo un errore di permesso o di dati si butta via invece di riprovarlo.
  // Le scritture buttate perché il server non le accetterà mai: chi ha fatto
  // l'appello lo deve sapere, se no la coda vuota direbbe «arrivato».
  let scartate = 0
  const chiScarta = new Set<(n: number) => void>()
  const coda = new Coda(async (op) => {
    const [a, b, c] = op.args as [string, string, StatoPresenza | null]
    try {
      if (op.tipo === 'segna') await scriviPresenza(db, a, b, c)
      else if (op.tipo === 'segnaTutti') await scriviTutti(db, a, b as unknown as StatoPresenza)
      else if (op.tipo === 'chiudi') await chiudiSessione(db, a)
      else if (op.tipo === 'prova') await scriviProva(db, a, b, op.args[2] as NuovaProva | null)
      else if (op.tipo === 'togliProva') await togliProva(db, a, b)
      // Per 'collega' il terzo argomento è `presente`, non uno stato.
      else if (op.tipo === 'collega') await scriviCollega(db, a, b, op.args[2] as boolean)
    } catch (e) {
      if (definitivo(e)) {
        // Scartata: riprovarla non cambierebbe niente.
        scartate++
        for (const f of chiScarta) f(scartate)
        return
      }
      throw e
    }
  })

  /**
   * Un errore è definitivo quando riprovare darebbe di nuovo lo stesso esito:
   * permesso negato, dati non validi, riga che non esiste. Un errore di rete no
   * — quello è proprio il caso per cui la coda esiste. Nemmeno i PGRST0xx
   * (database irraggiungibile, riavvio) e PGRST3xx (accesso scaduto, si
   * rinnova da solo): quelli passano, e buttarli perderebbe le presenze.
   */
  const definitivo = (e: unknown) => {
    const codice = (e as { code?: string })?.code ?? ''
    return /^(42|23|22)/.test(codice) || /^PGRST[12]/.test(codice)
  }

  const conta = async (sessioni: RigaSessione[]): Promise<SessioneVista[]> => {
    const corsi = [...new Set(sessioni.map((s) => s.corso_id))]
    const ids = sessioni.map((s) => s.id)
    const [{ data: isc, error: e1 }, { data: pres, error: e2 }] = await Promise.all([
      tutteLeRighe((prima, ultima) => db.from('iscrizioni').select(ISCRIZIONE).in('corso_id', corsi.length ? corsi : ['-']).order('id').range(prima, ultima)),
      tutteLeRighe((da, a) => db.from('presenze').select('sessione_id, persona_id, stato').in('sessione_id', ids.length ? ids : ['-']).order('id').range(da, a)),
    ])
    if (e1) throw e1
    if (e2) throw e2
    const iscrizioni = (isc ?? []) as unknown as RigaIscrizione[]
    const presenti = new Map<string, number>()
    const segnate = new Map<string, Map<string, string>>()
    for (const r of pres ?? []) {
      if (r.stato === 'presente') presenti.set(r.sessione_id, (presenti.get(r.sessione_id) ?? 0) + 1)
      if (!segnate.has(r.sessione_id)) segnate.set(r.sessione_id, new Map())
      segnate.get(r.sessione_id)!.set(r.persona_id, r.stato)
    }

    return sessioni.map((s) => {
      const delCorso = iscrittiIl(iscrizioni, s.corso_id, giornoDi(s.inizio))
      return {
        id: s.id,
        corsoId: s.corso_id,
        corso: s.corsi?.nome ?? 'Corso',
        colore: s.corsi?.colore ?? undefined,
        sala: s.sale?.nome,
        istruttore: s.persone ? `${s.persone.nome} ${s.persone.cognome}` : undefined,
        kanji: s.persone?.kanji ?? undefined,
        attivita: s.attivita?.nome,
        inizio: s.inizio,
        fine: s.fine,
        stato: s.stato,
        iscritti: delCorso.length,
        presenti: presenti.get(s.id) ?? 0,
        insegnanti: insegnantiDi(s),
        ...contiDellAppello(delCorso, segnate.get(s.id)),
      }
    })
  }

  return {
    modo: 'supabase',

    async mieOre(personaId, da, a) {
      const fino = new Date(a)
      fino.setHours(23, 59, 59, 999)
      const [presenze, senza] = await Promise.all([
        // `!inner`: il mese è quello della lezione, e si filtra sulla lezione.
        db
          .from('presenze_istruttori')
          .select('id, sessione_id, persona_id, stato, prevista, gestita_il, gestore:persone!gestita_da ( nome, cognome ), sessioni!inner ( inizio, fine, corsi ( nome ) )')
          .eq('persona_id', personaId)
          .gte('sessioni.inizio', da.toISOString())
          .lte('sessioni.inizio', fino.toISOString()),
        db.rpc('lezioni_senza_istruttore'),
      ])
      if (presenze.error) throw presenze.error
      // La forma la dice la select con le lezioni dentro: il client non ha tipi generati.
      const righe = (presenze.data ?? []) as unknown as Array<{
        id: string
        sessione_id: string
        persona_id: string
        stato: MiaPresenza['stato']
        prevista: boolean
        gestita_il: string | null
        gestore: { nome: string; cognome: string } | null
        sessioni: { inizio: string; fine: string; corsi: { nome: string } | null }
      }>
      return {
        presenze: righe.map((r) => ({
          id: r.id,
          sessioneId: r.sessione_id,
          personaId: r.persona_id,
          stato: r.stato,
          prevista: r.prevista,
          gestitaIl: r.gestita_il ?? undefined,
          gestitaDa: r.gestore ? `${r.gestore.nome} ${r.gestore.cognome}`.trim() : undefined,
          corso: r.sessioni.corsi?.nome ?? 'Corso',
          inizio: r.sessioni.inizio,
          fine: r.sessioni.fine,
        })),
        senzaIstruttore: daSenzaIstruttore(senza, personaId),
      }
    },

    async calendario(da, a) {
      await allungaCalendario(db)
      const fino = new Date(a)
      fino.setHours(23, 59, 59, 999)
      const { data, error } = await leggiSessioni((sel) =>
        tutteLeRighe((prima, ultima) => db.from('sessioni').select(sel).gte('inizio', da.toISOString()).lte('inizio', fino.toISOString()).order('inizio').order('id').range(prima, ultima)),
      )
      if (error) throw error
      return conta((data ?? []) as unknown as RigaSessione[])
    },

    async attivita() {
      const { data, error } = await db.from('attivita').select('id, nome, attiva')
      // Senza 41-attivita.sql non c'è niente da scegliere.
      if (mancaAttivita(error)) return []
      if (error) throw error
      return attivitaPerMenu((data ?? []) as Array<{ id: string; nome: string; attiva: boolean }>).map(({ id, nome }) => ({ id, nome }))
    },

    async listeMusica() {
      type Riga = { id: string; nome: string; link: string; sala_id: string | null; disciplina?: string | null }
      // Senza 40-discipline.sql la colonna non c'è: le liste si leggono senza categoria.
      const con = await db.from('musica_sale').select('id, nome, link, sala_id, disciplina').order('ordine').order('nome')
      const r = con.error?.code === '42703' ? await db.from('musica_sale').select('id, nome, link, sala_id').order('ordine').order('nome') : con
      // Senza 09-musica.sql non ci sono liste: resta la musica delle impostazioni del timer.
      if (r.error?.code === '42P01' || r.error?.code === 'PGRST205') return []
      if (r.error) throw r.error
      const d = await db.from('impostazioni').select('discipline').maybeSingle()
      // Senza i tipi generati di supabase-js le righe arrivano senza forma: la si dice qui, come nel resto del file.
      const discipline = disciplineDa(d.error ? null : (d.data as { discipline?: unknown } | null)?.discipline)
      return ((r.data ?? []) as Riga[]).map((x) => {
        const disciplina = ripulisciDisciplina(x.disciplina, discipline)
        return { id: x.id, nome: x.nome, link: x.link, salaId: x.sala_id, ...(disciplina ? { disciplina } : {}) }
      })
    },

    async cambiaAttivita(sessioneId, attivitaId) {
      // Subito, non in coda: è una scelta fatta davanti a uno schermo con la rete, e senza risposta non si sa se è passata.
      const { data, error } = await db.from('sessioni').update({ attivita_id: attivitaId }).eq('id', sessioneId).select('id')
      if (error) throw new Error(error.code === 'PGRST204' || mancaAttivita(error) ? 'Le attività non sono ancora attive: chiedi alla segreteria' : 'Non è andata: riprova fra poco')
      // La policy lascia cambiare solo le proprie lezioni, e dice di no non dando righe.
      if (!data?.length) throw new Error('Puoi cambiare l’attività solo delle tue lezioni')
    },

    async dettaglio(sessioneId) {
      const { data, error } = await leggiSessioni((sel) => db.from('sessioni').select(sel).eq('id', sessioneId).single())
      // Solo «non c'è» vuol dire null: un errore di rete detto come «nessun
      // iscritto» farebbe credere vuoto un corso che non lo è.
      if (error && error.code !== 'PGRST116') throw error
      if (!data) return null
      const riga = data as unknown as RigaSessione
      const [viste] = await conta([riga])

      const [{ data: iscritti, error: e1 }, { data: presenze, error: e2 }] = await Promise.all([
        db.from('iscrizioni').select(ISCRIZIONE).eq('corso_id', riga.corso_id),
        db.from('presenze').select('persona_id, stato').eq('sessione_id', sessioneId),
      ])
      if (e1) throw e1
      if (e2) throw e2
      const stati = new Map((presenze ?? []).map((p) => [p.persona_id, p.stato as StatoPresenza]))
      const delCorso = iscrittiIl((iscritti ?? []) as unknown as RigaIscrizione[], riga.corso_id, giornoDi(riga.inizio)).sort(perCognome)
      const prove = new Map((await proveDi(db, sessioneId)).map((p) => [p.id, p]))

      // Quello che è ancora in coda: senza, una prova aggiunta senza rete
      // sparirebbe dall'appello riaprendolo, finché non arriva al server.
      for (const op of coda.operazioni) {
        const [s, chi] = op.args as [string, string]
        if (s !== sessioneId) continue
        if (op.tipo === 'prova') {
          const { nome, cognome } = op.args[3] as { nome: string; cognome: string }
          prove.set(chi, { id: chi, nome, cognome, ruolo: 'iscritto' })
          if (!stati.has(chi)) stati.set(chi, 'presente')
        } else if (op.tipo === 'togliProva') prove.delete(chi)
        else if (op.tipo === 'segna') {
          const stato = op.args[2] as StatoPresenza | null
          if (stato) stati.set(chi, stato)
          else stati.delete(chi)
        }
      }

      const iscrittiQui = new Set(delCorso.map((p) => p.id))
      const elenco = [
        ...delCorso.map((p) => ({ ...p, stato: stati.get(p.id) ?? null })),
        ...[...prove.values()]
          .filter((p) => !iscrittiQui.has(p.id))
          .sort(perCognome)
          .map((p) => ({ ...p, stato: stati.get(p.id) ?? null, prova: true })),
      ]

      return { sessione: viste, note: riga.note ?? undefined, elenco } as DettaglioSessione
    },

    async segna(sessioneId, personaId, stato) {
      coda.accoda(`segna:${sessioneId}:${personaId}`, 'segna', [sessioneId, personaId, stato])
    },

    async segnaTutti(sessioneId, stato) {
      coda.accoda(`tutti:${sessioneId}`, 'segnaTutti', [sessioneId, stato])
    },

    async chiudi(sessioneId) {
      coda.accoda(`chiudi:${sessioneId}`, 'chiudi', [sessioneId])
    },

    // Le letture vanno dirette, come le altre: è anche il modo in cui il
    // tasto PROVE scopre che manca 21-prove.sql, prima di mettere in coda una
    // prova che il server butterebbe via.
    async provati() {
      const { data, error } = await db.rpc('prove_recenti')
      if (error) throw manca20(error)
      return (data ?? []).map(daRiga).sort((x: GiaProvato, y: GiaProvato) => y.inizio.localeCompare(x.inizio))
    },

    // Dal server solo chi somiglia, dalla terza lettera: sotto quella soglia
    // la risposta sarebbe vuota, e non si chiama. Se manca 43-cerca-persone.sql
    // l'errore lo dice, e chi aggiunge scrive il nome a mano.
    async cercaPersone(scritto): Promise<PersonaTrovata[]> {
      if (!bastaPerCercare(scritto)) return []
      const { data, error } = await db.rpc('cerca_persone', { scritto })
      if (error) throw manca43(error)
      // supabase-js non conosce il tipo di ritorno della funzione: lo dice questa riga.
      return ((data ?? []) as Array<{ persona_id: string; nome: string; cognome: string; corsi: string[] | null }>).map((r) => ({
        id: r.persona_id,
        nome: r.nome,
        cognome: r.cognome,
        corsi: r.corsi ?? [],
      }))
    },

    // Le scritture passano dalla coda, come le presenze: una prova aggiunta
    // in fondo alla sala senza campo non si perde. L'id lo decide l'app, così
    // un tocco sul nome dopo sa già a chi va.
    async aggiungiProva(sessioneId, chi) {
      const n = eGiaVenuto(chi) ? null : pulisciProva(chi)
      const id = eGiaVenuto(chi) ? chi.id : nuovoId()
      const nome = n?.nome ?? chi.nome
      const cognome = n?.cognome ?? chi.cognome
      coda.accoda(`prova:${sessioneId}:${id}`, 'prova', [sessioneId, id, n, { nome, cognome }])
      return { id, nome, cognome, ruolo: 'iscritto' }
    },

    async togliProva(sessioneId, personaId) {
      // Stessa chiave dell'aggiunta: una prova aggiunta e tolta senza rete non parte nemmeno.
      coda.accoda(`prova:${sessioneId}:${personaId}`, 'togliProva', [sessioneId, personaId])
      // Il segno in coda per lei non serve più: il server lo toglie con la prova.
      coda.accoda(`segna:${sessioneId}:${personaId}`, 'segna', [sessioneId, personaId, null])
    },

    async istruttoriLezione(sessioneId) {
      const { data, error } = await db.rpc('istruttori_lezione', { sessione: sessioneId })
      // Senza 46-istruttore-collega.sql la parte ISTRUTTORI non c'è, e l'appello va come prima.
      if (error && (error.code === 'PGRST202' || error.code === '42883')) return []
      if (error) throw error
      // supabase-js non conosce il tipo di ritorno della funzione: lo dice questa riga.
      const righe = (data ?? []) as Array<{ persona_id: string; nome: string; cognome: string; stato: StatoPresenzaIstruttore | null; come: ComePresenzaIstruttore | null; segnata_da: string | null; gestita?: boolean | null }>
      const elenco: IstruttoreLezione[] = righe.map((r) => ({
        id: r.persona_id,
        nome: `${r.nome} ${r.cognome}`.trim(),
        stato: r.stato ?? undefined,
        come: r.come ?? undefined,
        segnataDa: r.segnata_da ?? undefined,
        gestita: r.gestita ?? undefined,
      }))
      // Quello ancora in coda, come per gli iscritti: un collega segnato senza rete resta segnato riaprendo.
      for (const op of coda.operazioni) {
        if (op.tipo !== 'collega') continue
        // La coda tiene gli argomenti come `unknown[]`: per 'collega' sono lezione, persona e presente.
        const [s, chi, presente] = op.args as [string, string, boolean]
        const x = s === sessioneId ? elenco.find((i) => i.id === chi) : undefined
        if (!x || (x.come && x.come !== 'collega')) continue
        Object.assign(x, presente ? { stato: 'confermata', come: 'collega', daInviare: true } : { stato: undefined, come: undefined, segnataDa: undefined, daInviare: undefined })
      }
      return elenco
    },

    async segnaCollega(sessioneId, personaId, presente) {
      // Una chiave per lezione e persona: segnato e tolto senza rete diventa una scrittura sola.
      coda.accoda(`collega:${sessioneId}:${personaId}`, 'collega', [sessioneId, personaId, presente])
    },

    guardaCoda: (f) => coda.guarda(f),
    guardaScartate: (f) => {
      chiScarta.add(f)
      f(scartate)
      return () => void chiScarta.delete(f)
    },
  }
}

async function scriviPresenza(
  db: SupabaseClient,
  sessioneId: string,
  personaId: string,
  stato: StatoPresenza | null,
) {
  if (stato === null) {
    const { error } = await db.from('presenze').delete().match({ sessione_id: sessioneId, persona_id: personaId })
    if (error) throw error
    return
  }
  // `upsert` sul vincolo unico: è quello che fa convergere due tablet sulla
  // stessa lezione invece di creare due righe per la stessa persona.
  const { error } = await db
    .from('presenze')
    .upsert({ sessione_id: sessioneId, persona_id: personaId, stato }, { onConflict: 'sessione_id,persona_id' })
  if (error) throw error
}

async function scriviTutti(db: SupabaseClient, sessioneId: string, stato: StatoPresenza) {
  // Senza rete postgrest non solleva, restituisce l'errore: va rilanciato, se
  // no la coda crede fatta un'operazione che non è mai arrivata.
  const { data: sess, error: s } = await db.from('sessioni').select('corso_id, inizio').eq('id', sessioneId).single()
  if (s) throw s
  if (!sess) return
  // Solo chi è nell'appello di quel giorno: un ex iscritto o una persona
  // disattivata non si segna presente, neanche con TUTTI PRESENTI.
  const { data: righe, error: e } = await db.from('iscrizioni').select(ISCRIZIONE).eq('corso_id', sess.corso_id)
  if (e) throw e
  const iscritti = [...iscrittiIl((righe ?? []) as unknown as RigaIscrizione[], sess.corso_id, giornoDi(sess.inizio)), ...(await proveDi(db, sessioneId))]
  if (!iscritti.length) return
  const { error } = await db.from('presenze').upsert(
    iscritti.map((p) => ({ sessione_id: sessioneId, persona_id: p.id, stato })),
    { onConflict: 'sessione_id,persona_id' },
  )
  if (error) throw error
}

/** Segna o toglie il collega: «gia» (aveva già una presenza) non è un errore, e non va fra le rifiutate. */
async function scriviCollega(db: SupabaseClient, sessioneId: string, personaId: string, presente: boolean) {
  const { error } = await db.rpc(presente ? 'segna_collega' : 'togli_collega', { sessione: sessioneId, persona: personaId })
  if (error) throw error
}

/** Chi è venuto a provare una lezione. Senza 21-prove.sql non c'è nessuno, e l'appello resta quello di prima. */
async function proveDi(db: SupabaseClient, sessioneId: string): Promise<Persona[]> {
  const { data, error } = await db
    .from('prove')
    // Due legami con `persone` (chi prova e chi l'ha aggiunta): si dice quale.
    .select('persone!prove_persona_id_fkey ( id, nome, cognome, ruolo, attiva )')
    .eq('sessione_id', sessioneId)
  if (error) return []
  return ((data ?? []) as unknown as Array<{ persone: (Persona & { attiva: boolean }) | null }>)
    .filter((r) => r.persone?.attiva)
    .map((r) => {
      const { attiva: _, ...p } = r.persone!
      return p
    })
}

const daRiga = (r: { persona_id: string; nome: string; cognome: string; telefono: string | null; corso: string; inizio: string }): GiaProvato => ({
  id: r.persona_id,
  nome: r.nome,
  cognome: r.cognome,
  telefono: r.telefono ?? undefined,
  corso: r.corso,
  inizio: r.inizio,
})

/** Il file che crea le prove non è stato lanciato: lo si dice, invece del messaggio dell'API. */
function manca20(e: { code?: string; message?: string }): Error {
  if (e.code === 'PGRST202' || e.code === '42883' || e.code === '42P01') {
    return new Error('Le prove non sono ancora attive: va lanciato supabase/21-prove.sql.')
  }
  return new Error(e.message || 'Il server non risponde')
}

/** Il file che crea la ricerca fra tutti non è stato lanciato: `trovateDa` lo dice a chi usa l'app. */
function manca43(e: { code?: string; message?: string }): Error {
  if (e.code === 'PGRST202' || e.code === '42883') return new Error(RICERCA_NON_ATTIVA)
  return new Error(e.message || 'Il server non risponde')
}

async function scriviProva(db: SupabaseClient, sessioneId: string, personaId: string, n: NuovaProva | null) {
  const { error } = await db.rpc('aggiungi_prova', {
    sessione: sessioneId,
    persona: personaId,
    nome: n?.nome ?? null,
    cognome: n?.cognome ?? null,
    telefono: n?.telefono ?? null,
  })
  if (error) throw error
}

async function togliProva(db: SupabaseClient, sessioneId: string, personaId: string) {
  const { error } = await db.rpc('togli_prova', { sessione: sessioneId, persona: personaId })
  if (error) throw error
}

async function chiudiSessione(db: SupabaseClient, sessioneId: string) {
  const { error } = await db.from('sessioni').update({ stato: 'svolta' }).eq('id', sessioneId)
  if (error) throw error
}

