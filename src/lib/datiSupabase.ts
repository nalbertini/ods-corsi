import type { SupabaseClient } from '@supabase/supabase-js'
import type { Dati } from './dati'
import type { DettaglioSessione, Persona, SessioneVista, StatoPresenza } from './sala'
import { giornoDi, perCognome, valeIl } from './sala'
import { Coda } from './coda'

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
  persone: { nome: string; cognome: string } | null
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

const SELEZIONE = `
  id, corso_id, inizio, fine, stato, note, istruttore_id,
  corsi ( nome, colore, capienza, istruttore_id, corsi_istruttori ( persona_id ) ),
  sale ( nome ),
  persone ( nome, cognome )
`

export function creaDatiSupabase(db: SupabaseClient): Dati {

  // Le scritture in coda si eseguono qui. Se il server rifiuta per davvero —
  // non per mancanza di rete — l'operazione resterebbe in coda per sempre: per
  // questo un errore di permesso o di dati si butta via invece di riprovarlo.
  const coda = new Coda(async (op) => {
    const [a, b, c] = op.args as [string, string, StatoPresenza | null]
    try {
      if (op.tipo === 'segna') await scriviPresenza(db, a, b, c)
      else if (op.tipo === 'segnaTutti') await scriviTutti(db, a, b as unknown as StatoPresenza)
      else if (op.tipo === 'chiudi') await chiudiSessione(db, a)
    } catch (e) {
      if (definitivo(e)) return // scartata: riprovarla non cambierebbe niente
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
      db.from('iscrizioni').select(ISCRIZIONE).in('corso_id', corsi.length ? corsi : ['-']),
      db.from('presenze').select('sessione_id, stato').in('sessione_id', ids.length ? ids : ['-']),
    ])
    if (e1) throw e1
    if (e2) throw e2
    const iscrizioni = (isc ?? []) as unknown as RigaIscrizione[]
    const presenti = new Map<string, number>()
    for (const r of pres ?? [])
      if (r.stato === 'presente') presenti.set(r.sessione_id, (presenti.get(r.sessione_id) ?? 0) + 1)

    return sessioni.map((s) => ({
      id: s.id,
      corsoId: s.corso_id,
      corso: s.corsi?.nome ?? 'Corso',
      colore: s.corsi?.colore ?? undefined,
      sala: s.sale?.nome,
      istruttore: s.persone ? `${s.persone.nome} ${s.persone.cognome}` : undefined,
      inizio: s.inizio,
      fine: s.fine,
      stato: s.stato,
      iscritti: iscrittiIl(iscrizioni, s.corso_id, giornoDi(s.inizio)).length,
      presenti: presenti.get(s.id) ?? 0,
      insegnanti: insegnantiDi(s),
    }))
  }

  return {
    modo: 'supabase',

    async calendario(da, a) {
      const fino = new Date(a)
      fino.setHours(23, 59, 59, 999)
      const { data, error } = await db
        .from('sessioni')
        .select(SELEZIONE)
        .gte('inizio', da.toISOString())
        .lte('inizio', fino.toISOString())
        .order('inizio')
      if (error) throw error
      return conta((data ?? []) as unknown as RigaSessione[])
    },

    async dettaglio(sessioneId) {
      const { data, error } = await db.from('sessioni').select(SELEZIONE).eq('id', sessioneId).single()
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
      const elenco = iscrittiIl((iscritti ?? []) as unknown as RigaIscrizione[], riga.corso_id, giornoDi(riga.inizio))
        .sort(perCognome)
        .map((p) => ({ ...p, stato: stati.get(p.id) ?? null }))

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

    guardaCoda: (f) => coda.guarda(f),
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
  const iscritti = iscrittiIl((righe ?? []) as unknown as RigaIscrizione[], sess.corso_id, giornoDi(sess.inizio))
  if (!iscritti.length) return
  const { error } = await db.from('presenze').upsert(
    iscritti.map((p) => ({ sessione_id: sessioneId, persona_id: p.id, stato })),
    { onConflict: 'sessione_id,persona_id' },
  )
  if (error) throw error
}

async function chiudiSessione(db: SupabaseClient, sessioneId: string) {
  const { error } = await db.from('sessioni').update({ stato: 'svolta' }).eq('id', sessioneId)
  if (error) throw error
}

