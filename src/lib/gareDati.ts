import type { SupabaseClient } from '@supabase/supabase-js'
import { oggiARoma } from './contabilita'
import { haUnServer } from './dati'
import { aggiungiAtleti, atletiVisibili, cosaNonVaGara, cosaNonVaNota, eliminabile, gareVisibili, pagaGara, totaleQuota, type AtletaGara, type ChiGuarda, type Gara, type VoceGara } from './gare'
import { sembraItaliano } from './importa'
import { nuovoId } from './prove'

/**
 * Le gare col database vero (`supabase/117-gare.sql`) o con l'archivio di
 * prova, come il vestiario. Chi vede cosa lo dicono le RLS; in prova
 * `gareVisibili`, con le stesse regole.
 *
 * Gli `as` sulle risposte: supabase-js qui non conosce lo schema (non ci sono
 * tipi generati), e i tipi scritti sotto sono quelli di 117-gare.sql.
 */

export const MANCA_GARE = 'Le gare non sono ancora disponibili: riprova più tardi'
const CHI_HA_PAGATO = 'Chi ha pagato resta nella gara: se non ci va, scrivilo nella sua nota'

export interface DatiGare {
  /** Le gare che chi guarda può vedere, e gli atleti che può vedere (l'iscritto solo i suoi; l'istruttore senza i pagamenti). */
  leggi(chi: ChiGuarda): Promise<{ gare: Gara[]; atleti: AtletaGara[] }>
  /** Una gara nuova (senza id) o cambiata, con le sue voci e i suoi accompagnatori; torna l'id. */
  salva(g: Omit<Gara, 'id'> & { id?: string }): Promise<string>
  elimina(id: string): Promise<void>
  aggiungi(garaId: string, personaIds: string[]): Promise<void>
  togli(garaId: string, personaId: string): Promise<void>
  scriviNota(garaId: string, personaId: string, nota: string): Promise<void>
  /** Incassa la quota di un atleta: torna l'id del pagamento a mano «Gare», da cui si fa la ricevuta. */
  incassa(garaId: string, personaId: string, metodo: string, data: string): Promise<string>
}

type ErroreDb = { message?: string; code?: string } | null

// La tabella, la colonna o la funzione che mancano: il file 114 non è stato lanciato.
const manca = (e: ErroreDb) => ['PGRST202', 'PGRST205', '42883', '42P01', 'PGRST200'].includes(e?.code ?? '') && /gar[ae]/.test(e?.message ?? '')

/** Un errore del database detto per chi usa l'app, come in vestiarioDati.ts. */
export function guaio(e: ErroreDb): Error {
  if (manca(e)) return new Error(MANCA_GARE)
  const m = e?.message ?? ''
  if (m && (e?.code === 'P0001' || (['22023', '54000'].includes(e?.code ?? '') && sembraItaliano(m)))) return new Error(m)
  if (e?.code === '42501') return new Error('Non hai il permesso: le gare le scrive la segreteria')
  if (e?.code === '23503') return new Error('Questa gara non c’è più: ricarica la pagina')
  if (m) console.error(m)
  return new Error(/failed to fetch|networkerror|load failed/i.test(m) ? 'Non c’è rete: riprova quando torna' : 'Non è andata: riprova fra poco')
}

function ok<T>(r: { data: T; error: ErroreDb }): T {
  if (r.error) throw guaio(r.error)
  return r.data
}

interface GaraDb {
  id: string
  nome: string
  dal: string
  al: string | null
  luogo: string | null
  indirizzo: string | null
  organizzatore: string | null
  note: string | null
  annullata: boolean
  gare_voci: { voce: string; importo: number }[]
  gare_accompagnatori: { persona_id: string }[]
}

interface AtletaDb {
  gara_id: string
  persona_id: string
  nota: string | null
}

/** Da `gare_pagamenti()`: le righe col pagamento che chi guarda può leggere. */
interface PagamentoDb extends AtletaDb {
  pagato_il: string | null
  pagato_importo: number | null
  pagato_metodo: string | null
  pagato_voci: VoceGara[] | null
}

const gara = (g: GaraDb): Gara => ({
  id: g.id,
  nome: g.nome,
  dal: g.dal,
  al: g.al ?? undefined,
  luogo: g.luogo ?? undefined,
  indirizzo: g.indirizzo ?? undefined,
  organizzatore: g.organizzatore ?? undefined,
  note: g.note ?? undefined,
  annullata: g.annullata,
  voci: [...g.gare_voci].sort((a, b) => a.voce.localeCompare(b.voce)),
  accompagnatori: g.gare_accompagnatori.map((a) => a.persona_id),
})

const atleta = (a: AtletaDb, p?: PagamentoDb): AtletaGara => ({
  garaId: a.gara_id,
  personaId: a.persona_id,
  nota: a.nota ?? undefined,
  ...(p?.pagato_il && { pagamento: { importo: p.pagato_importo ?? 0, voci: p.pagato_voci ?? [], metodo: p.pagato_metodo ?? '', data: p.pagato_il } }),
})

const vuotoNullo = (s?: string) => s?.trim() || null

export function creaGareSupabase(db: SupabaseClient): DatiGare {
  return {
    async leggi() {
      // Le righe le sceglie il database: l'istruttore e l'iscritto vedono solo le loro,
      // e i pagamenti arrivano da `gare_pagamenti()`, che all'istruttore non ne dà.
      const [g, a, p] = await Promise.all([
        db.from('gare').select('id, nome, dal, al, luogo, indirizzo, organizzatore, note, annullata, gare_voci ( voce, importo ), gare_accompagnatori ( persona_id )'),
        db.from('gare_atleti').select('gara_id, persona_id, nota'),
        db.rpc('gare_pagamenti').select('gara_id, persona_id, nota, pagato_il, pagato_importo, pagato_metodo, pagato_voci'),
      ])
      const pagamenti = new Map((ok(p) as PagamentoDb[]).map((x) => [`${x.gara_id}/${x.persona_id}`, x]))
      return { gare: (ok(g) as GaraDb[]).map(gara), atleti: (ok(a) as AtletaDb[]).map((x) => atleta(x, pagamenti.get(`${x.gara_id}/${x.persona_id}`))) }
    },

    async salva(g) {
      const riga = { nome: g.nome.trim(), dal: g.dal, al: g.al || null, luogo: vuotoNullo(g.luogo), indirizzo: vuotoNullo(g.indirizzo), organizzatore: vuotoNullo(g.organizzatore), note: vuotoNullo(g.note), annullata: g.annullata }
      const scritta = g.id ? await db.from('gare').update(riga).eq('id', g.id).select('id') : await db.from('gare').insert(riga).select('id')
      const id = (ok(scritta) as { id: string }[])[0]?.id
      if (!id) throw new Error('Questa gara non c’è più: ricarica la pagina')
      // Prima le voci nuove, poi via le vecchie: se a metà manca la rete, la quota non resta vuota.
      const vecchie = (ok(await db.from('gare_voci').select('id').eq('gara_id', id)) as { id: string }[]).map((v) => v.id)
      if (g.voci.length) ok(await db.from('gare_voci').insert(g.voci.map((v) => ({ gara_id: id, voce: v.voce.trim(), importo: v.importo }))))
      if (vecchie.length) ok(await db.from('gare_voci').delete().in('id', vecchie))
      if (g.accompagnatori.length)
        ok(await db.from('gare_accompagnatori').upsert(g.accompagnatori.map((persona_id) => ({ gara_id: id, persona_id })), { onConflict: 'gara_id,persona_id', ignoreDuplicates: true }))
      const via = db.from('gare_accompagnatori').delete().eq('gara_id', id)
      ok(await (g.accompagnatori.length ? via.not('persona_id', 'in', `(${g.accompagnatori.join(',')})`) : via))
      return id
    },

    async elimina(id) {
      ok(await db.from('gare').delete().eq('id', id))
    },

    async aggiungi(garaId, personaIds) {
      if (!personaIds.length) return
      ok(await db.from('gare_atleti').upsert(personaIds.map((persona_id) => ({ gara_id: garaId, persona_id })), { onConflict: 'gara_id,persona_id', ignoreDuplicates: true }))
    },

    async togli(garaId, personaId) {
      // La policy scarta in silenzio la riga di chi ha pagato: niente righe tolte, si dice perché.
      const via = ok(await db.from('gare_atleti').delete().eq('gara_id', garaId).eq('persona_id', personaId).select('id')) as unknown[]
      if (!via.length) throw new Error(CHI_HA_PAGATO)
    },

    async scriviNota(garaId, personaId, nota) {
      const no = cosaNonVaNota(nota)
      if (no) throw new Error(no)
      ok(await db.from('gare_atleti').update({ nota: vuotoNullo(nota) }).eq('gara_id', garaId).eq('persona_id', personaId))
    },

    async incassa(garaId, personaId, metodo, data) {
      const righe = ok(await db.from('gare_atleti').select('id').eq('gara_id', garaId).eq('persona_id', personaId)) as { id: string }[]
      if (!righe[0]) throw new Error('Questo atleta non è più nella gara')
      const r = ok(await db.rpc('incassa_gara', { atleta: righe[0].id, metodo, data })) as { pagamento_id: string }
      return r.pagamento_id
    },
  }
}

/** Le stesse regole sull'archivio di prova: i vincoli e le funzioni di 117-gare.sql rifatti qui. */
export async function creaGareProva(): Promise<DatiGare> {
  const { archivio } = await import('./archivioProva')
  const { creaSegreteriaProva } = await import('./segreteriaProva')
  const seg = creaSegreteriaProva()
  const a = () => archivio.dati
  const gare = () => a().gare ?? []
  const atleti = () => a().gareAtleti ?? []
  const salva = () => archivio.salva()
  const trova = (id: string) => {
    const g = gare().find((x) => x.id === id)
    if (!g) throw new Error('Questa gara non c’è più: ricarica la pagina')
    return g
  }
  return {
    async leggi(chi) {
      const persone = chi.ruolo === 'staff' ? [] : await seg.persone()
      const viste = gareVisibili(chi, gare(), atleti(), persone)
      return { gare: viste, atleti: atletiVisibili(chi, viste, atleti(), persone) }
    },

    async salva(g) {
      const no = cosaNonVaGara(g)
      if (no) throw new Error(no)
      const id = g.id ?? nuovoId()
      if (g.id) trova(g.id)
      const pulita: Gara = { ...g, id, nome: g.nome.trim(), voci: g.voci.map((v) => ({ voce: v.voce.trim(), importo: v.importo })) }
      a().gare = g.id ? gare().map((x) => (x.id === id ? pulita : x)) : [...gare(), pulita]
      salva()
      return id
    },

    async elimina(id) {
      if (!eliminabile(trova(id), oggiARoma())) throw new Error('Una gara passata non si cancella: si può annullare')
      if (atleti().some((x) => x.garaId === id && x.pagamento)) throw new Error('Qualcuno ha già pagato questa gara: non si cancella, si può annullare')
      a().gare = gare().filter((x) => x.id !== id)
      a().gareAtleti = atleti().filter((x) => x.garaId !== id)
      salva()
    },

    async aggiungi(garaId, personaIds) {
      trova(garaId)
      a().gareAtleti = aggiungiAtleti(atleti(), garaId, personaIds, await seg.persone())
      salva()
    },

    async togli(garaId, personaId) {
      if (atleti().some((x) => x.garaId === garaId && x.personaId === personaId && x.pagamento)) throw new Error(CHI_HA_PAGATO)
      a().gareAtleti = atleti().filter((x) => !(x.garaId === garaId && x.personaId === personaId))
      salva()
    },

    async scriviNota(garaId, personaId, nota) {
      const no = cosaNonVaNota(nota)
      if (no) throw new Error(no)
      a().gareAtleti = atleti().map((x) => (x.garaId === garaId && x.personaId === personaId ? { ...x, nota: nota.trim() || undefined } : x))
      salva()
    },

    async incassa(garaId, personaId, metodo, data) {
      const g = trova(garaId)
      const x = atleti().find((y) => y.garaId === garaId && y.personaId === personaId)
      if (!x) throw new Error('Questo atleta non è più nella gara')
      if (x.pagamento) throw new Error('Questo atleta ha già pagato la gara')
      if (g.annullata) throw new Error('La gara è annullata: non si incassa')
      if (!totaleQuota(g.voci)) throw new Error('La gara non ha una quota: aggiungi le voci prima di incassare')
      // Il pagamento a mano porta i controlli dell'88 (data, importo, metodo), come `incassa_gara`.
      const pag = pagaGara(g, { metodo: metodo.trim(), data })
      const pd = await seg.registraPagamentoDiretto({ personaId, data, importo: pag.importo, metodo: metodo.trim(), voce: 'Gare', nota: g.nome.slice(0, 300) })
      // Riletta dopo l'attesa: intanto la riga può essere cambiata (una nota).
      a().gareAtleti = atleti().map((y) => (y.garaId === garaId && y.personaId === personaId ? { ...y, pagamento: pag } : y))
      salva()
      return pd.id
    },
  }
}

let unico: Promise<DatiGare> | null = null

export function datiGare(): Promise<DatiGare> {
  if (!unico) {
    unico = (haUnServer ? import('./supabase').then((s) => creaGareSupabase(s.clientSupabase())) : creaGareProva())
      // Se il pezzo non arriva, la volta dopo si riprova invece di restare rotti.
      .catch((e: unknown) => {
        unico = null
        throw e
      })
  }
  return unico
}
