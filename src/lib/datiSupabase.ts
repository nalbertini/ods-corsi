import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Dati } from './dati'
import type { DettaglioSessione, Persona, SessioneVista, StatoPresenza } from './sala'
import { perCognome } from './sala'
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
  corsi: { nome: string; colore: string | null; capienza: number | null } | null
  sale: { nome: string } | null
  persone: { nome: string; cognome: string } | null
}

const SELEZIONE = `
  id, corso_id, inizio, fine, stato, note,
  corsi ( nome, colore, capienza ),
  sale ( nome ),
  persone ( nome, cognome )
`

export function creaDatiSupabase(url: string, chiave: string): Dati {
  const db: SupabaseClient = createClient(url, chiave, {
    auth: { persistSession: true, autoRefreshToken: true },
  })

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
   * — quello è proprio il caso per cui la coda esiste.
   */
  const definitivo = (e: unknown) => {
    const codice = (e as { code?: string })?.code ?? ''
    return /^(42|23|PGRST)/.test(codice)
  }

  const conta = async (sessioni: RigaSessione[]): Promise<SessioneVista[]> => {
    const corsi = [...new Set(sessioni.map((s) => s.corso_id))]
    const ids = sessioni.map((s) => s.id)
    const [{ data: isc }, { data: pres }] = await Promise.all([
      db.from('iscrizioni').select('corso_id').in('corso_id', corsi.length ? corsi : ['-']),
      db.from('presenze').select('sessione_id, stato').in('sessione_id', ids.length ? ids : ['-']),
    ])
    const periscritti = new Map<string, number>()
    for (const r of isc ?? []) periscritti.set(r.corso_id, (periscritti.get(r.corso_id) ?? 0) + 1)
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
      iscritti: periscritti.get(s.corso_id) ?? 0,
      presenti: presenti.get(s.id) ?? 0,
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
      if (error || !data) return null
      const riga = data as unknown as RigaSessione
      const [viste] = await conta([riga])

      const [{ data: iscritti }, { data: presenze }] = await Promise.all([
        db.from('iscrizioni').select('persone ( id, nome, cognome, ruolo )').eq('corso_id', riga.corso_id),
        db.from('presenze').select('persona_id, stato').eq('sessione_id', sessioneId),
      ])
      const stati = new Map((presenze ?? []).map((p) => [p.persona_id, p.stato as StatoPresenza]))
      const elenco = (iscritti ?? [])
        .map((r) => (r as unknown as { persone: Persona }).persone)
        .filter(Boolean)
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
  const { data: sess } = await db.from('sessioni').select('corso_id').eq('id', sessioneId).single()
  if (!sess) return
  const { data: iscritti } = await db.from('iscrizioni').select('persona_id').eq('corso_id', sess.corso_id)
  if (!iscritti?.length) return
  const { error } = await db.from('presenze').upsert(
    iscritti.map((i) => ({ sessione_id: sessioneId, persona_id: i.persona_id, stato })),
    { onConflict: 'sessione_id,persona_id' },
  )
  if (error) throw error
}

async function chiudiSessione(db: SupabaseClient, sessioneId: string) {
  const { error } = await db.from('sessioni').update({ stato: 'svolta' }).eq('id', sessioneId)
  if (error) throw error
}

