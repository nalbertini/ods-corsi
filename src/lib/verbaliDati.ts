import type { SupabaseClient } from '@supabase/supabase-js'
import { haUnServer } from './dati'
import { sembraItaliano } from './importa'
import { cosaNonVaFile, cosaNonVaRettifica, cosaNonVaSostituzione, type Allegato, type Argomento, type Carica, type DatiVerbali, type Delibera, type FilePdf, type TipoAllegato, type TipoVerbale, type Verbale } from './verbali'
import { creaVerbaliProva } from './verbaliProva'

/**
 * I verbali col database vero (`supabase/127-verbali.sql`) o con l'archivio di
 * prova. Chi può cosa lo dicono le RLS e le funzioni del file; in prova
 * `verbaliProva.ts`, con le stesse regole.
 *
 * Gli `as` sulle risposte: supabase-js qui non conosce lo schema (non ci sono
 * tipi generati), e i tipi scritti sotto sono quelli di 127-verbali.sql.
 */

export const MANCA_VERBALI = 'I verbali non sono ancora disponibili: riprova più tardi'
const CONTENITORE = 'verbali'
const DURATA_LINK = 600
const NON_C_E = 'Questo verbale non c’è più: ricarica la pagina'

type ErroreDb = { message?: string; code?: string } | null

// La tabella, la funzione o il contenitore che mancano: il file 127 non è stato lanciato.
const manca = (e: ErroreDb) => ['PGRST202', 'PGRST205', '42883', '42P01', 'PGRST200'].includes(e?.code ?? '') && /verbal/.test(e?.message ?? '')

/** Un errore del database detto per chi usa l'app, come in gareDati.ts. */
export function guaio(e: ErroreDb): Error {
  if (manca(e)) return new Error(MANCA_VERBALI)
  const m = e?.message ?? ''
  if (e?.code === '23505') return new Error(/firmato_in_vigore/.test(m) ? 'C’è già un PDF firmato in vigore: per cambiarlo si sostituisce, dicendo perché' : 'Questo numero di verbale esiste già in quell’anno: scegli il prossimo libero')
  if (e?.code === 'P0002') return new Error(NON_C_E)
  if (m && (e?.code === 'P0001' || (['22023', '54000'].includes(e?.code ?? '') && sembraItaliano(m)))) return new Error(m)
  if (e?.code === '42501') return new Error('Non hai il permesso, o il verbale è già firmato: un firmato non si cambia, si rettifica')
  if (e?.code === '23503') return new Error('Una persona scelta non c’è più: ricarica la pagina')
  if (m) console.error(m)
  return new Error(/failed to fetch|networkerror|load failed/i.test(m) ? 'Non c’è rete: riprova quando torna' : 'Non è andata: riprova fra poco')
}

function ok<T>(r: { data: T; error: ErroreDb }): T {
  if (r.error) throw guaio(r.error)
  return r.data
}

interface VerbaleDb {
  id: string
  anno: number
  numero: number
  tipo: TipoVerbale
  data: string
  ora_inizio: string | null
  ora_fine: string | null
  luogo: string | null
  odg: string[]
  presidente_id: string | null
  segretario_id: string | null
  aventi_diritto: number | null
  presenti: number | null
  deleghe: number | null
  testo: string | null
  stato: 'bozza' | 'firmato'
  firmato_il: string | null
  storico: boolean
  verbali_delibere: { id: string; posizione: number; titolo: string; argomento: Argomento; esito: Delibera['esito'] | null; come_votato: string | null; anno_rif: number | null; bilancio_tipo: Delibera['bilancioTipo'] | null; note: string | null }[]
  verbali_cariche: { carica: string; persona_id: string | null; dal: string | null; al: string | null }[]
  verbali_allegati: { id: string; tipo: TipoAllegato; nome: string; percorso: string; peso: number | null; caricato_il: string; convocazione_inviata_il: string | null; sostituito_il: string | null; motivo_sostituzione: string | null }[]
  verbali_rettifiche: { data: string; motivo: string; testo: string }[]
}

const SELEZIONE =
  'id, anno, numero, tipo, data, ora_inizio, ora_fine, luogo, odg, presidente_id, segretario_id, aventi_diritto, presenti, deleghe, testo, stato, firmato_il, storico, ' +
  'verbali_delibere ( id, posizione, titolo, argomento, esito, come_votato, anno_rif, bilancio_tipo, note ), verbali_cariche ( carica, persona_id, dal, al ), ' +
  'verbali_allegati ( id, tipo, nome, percorso, peso, caricato_il, convocazione_inviata_il, sostituito_il, motivo_sostituzione ), verbali_rettifiche ( data, motivo, testo )'

const ora = (t: string | null) => t?.slice(0, 5) // `time` arriva come HH:MM:SS
const vuotoNullo = (s?: string) => s?.trim() || null

const verbale = (v: VerbaleDb): Verbale => ({
  id: v.id,
  anno: v.anno,
  numero: v.numero,
  tipo: v.tipo,
  data: v.data,
  oraInizio: ora(v.ora_inizio),
  oraFine: ora(v.ora_fine),
  luogo: v.luogo ?? undefined,
  odg: v.odg,
  presidenteId: v.presidente_id ?? undefined,
  segretarioId: v.segretario_id ?? undefined,
  aventiDiritto: v.aventi_diritto ?? undefined,
  presenti: v.presenti ?? undefined,
  deleghe: v.deleghe ?? undefined,
  testo: v.testo ?? undefined,
  stato: v.stato,
  firmatoIl: v.firmato_il ?? undefined,
  storico: v.storico,
  delibere: [...v.verbali_delibere]
    .sort((a, b) => a.posizione - b.posizione)
    .map((d) => ({ id: d.id, titolo: d.titolo, argomento: d.argomento, esito: d.esito ?? undefined, comeVotato: d.come_votato ?? undefined, annoRif: d.anno_rif ?? undefined, bilancioTipo: d.bilancio_tipo ?? undefined, note: d.note ?? undefined })),
  cariche: v.verbali_cariche.flatMap((c): Carica[] => (c.persona_id ? [{ carica: c.carica, personaId: c.persona_id, dal: c.dal ?? undefined, al: c.al ?? undefined }] : [])),
  allegati: v.verbali_allegati.map(
    (a): Allegato => ({
      id: a.id,
      tipo: a.tipo,
      nome: a.nome,
      peso: a.peso ?? 0,
      percorso: a.percorso,
      caricatoIl: a.caricato_il.slice(0, 10),
      convocazioneInviataIl: a.convocazione_inviata_il ?? undefined,
      sostituitoIl: a.sostituito_il?.slice(0, 10),
      motivoSostituzione: a.motivo_sostituzione ?? undefined,
    }),
  ),
  rettifiche: v.verbali_rettifiche,
})

/** Il nome nello Storage: niente barre, e un prefisso che lo rende unico anche se si ricarica lo stesso file. */
const percorsoDi = (verbaleId: string, nome: string) => `${verbaleId}/${Date.now()}-${nome.replace(/[/\\\s]+/g, '_').slice(-150)}`

export function creaVerbaliSupabase(db: SupabaseClient): DatiVerbali {
  /** Il file nello Storage e la sua riga; se la riga non entra, il file si toglie. Torna l'id dell'allegato. */
  const allega = async (verbaleId: string, file: FilePdf, tipo: TipoAllegato): Promise<{ id: string; percorso: string }> => {
    const no = cosaNonVaFile({ nome: file.nome, tipo: file.contenuto?.type ?? 'application/pdf', peso: file.peso })
    if (no) throw new Error(no)
    if (!file.contenuto) throw new Error('Il file non è arrivato: sceglilo di nuovo')
    const percorso = percorsoDi(verbaleId, file.nome)
    const su = await db.storage.from(CONTENITORE).upload(percorso, file.contenuto, { contentType: 'application/pdf', upsert: false })
    if (su.error) {
      if (/bucket not found/i.test(su.error.message ?? '')) throw new Error(MANCA_VERBALI)
      throw guaio(su.error as ErroreDb)
    }
    const riga = await db.from('verbali_allegati').insert({ verbale_id: verbaleId, tipo, nome: file.nome.trim().slice(0, 200), percorso, peso: file.peso }).select('id')
    if (riga.error) {
      await db.storage.from(CONTENITORE).remove([percorso])
      throw guaio(riga.error)
    }
    return { id: (riga.data as { id: string }[])[0].id, percorso }
  }

  return {
    async leggi() {
      return (ok(await db.from('verbali').select(SELEZIONE)) as unknown as VerbaleDb[]).map(verbale)
    },

    async salva(v) {
      const riga = {
        anno: v.anno,
        numero: v.numero,
        tipo: v.tipo,
        data: v.data,
        ora_inizio: v.oraInizio || null,
        ora_fine: v.oraFine || null,
        luogo: vuotoNullo(v.luogo),
        odg: v.odg.map((r) => r.trim()).filter(Boolean),
        presidente_id: v.presidenteId || null,
        segretario_id: v.segretarioId || null,
        aventi_diritto: v.aventiDiritto ?? null,
        presenti: v.presenti ?? null,
        deleghe: v.deleghe ?? null,
        testo: vuotoNullo(v.testo),
        storico: v.storico,
      }
      // La policy scarta in silenzio un verbale firmato: nessuna riga tornata = non si cambia.
      const scritta = v.id ? await db.from('verbali').update(riga).eq('id', v.id).select('id') : await db.from('verbali').insert(riga).select('id')
      const id = (ok(scritta) as { id: string }[])[0]?.id
      if (!id) throw new Error('Un verbale firmato non si modifica: si rettifica con una nota')
      // Prima le righe nuove, poi via le vecchie: se a metà manca la rete, le delibere non restano vuote.
      const vecchieDelibere = (ok(await db.from('verbali_delibere').select('id').eq('verbale_id', id)) as { id: string }[]).map((x) => x.id)
      if (v.delibere.length)
        ok(await db.from('verbali_delibere').insert(v.delibere.map((d, posizione) => ({ verbale_id: id, posizione, titolo: d.titolo.trim(), argomento: d.argomento, esito: d.esito ?? null, come_votato: vuotoNullo(d.comeVotato), anno_rif: d.annoRif ?? null, bilancio_tipo: d.argomento === 'bilancio' ? (d.bilancioTipo ?? null) : null, note: vuotoNullo(d.note) }))))
      if (vecchieDelibere.length) ok(await db.from('verbali_delibere').delete().in('id', vecchieDelibere))
      const vecchieCariche = (ok(await db.from('verbali_cariche').select('id').eq('verbale_id', id)) as { id: string }[]).map((x) => x.id)
      if (v.cariche.length) ok(await db.from('verbali_cariche').insert(v.cariche.map((c) => ({ verbale_id: id, carica: c.carica.trim(), persona_id: c.personaId, dal: c.dal || null, al: c.al || null }))))
      if (vecchieCariche.length) ok(await db.from('verbali_cariche').delete().in('id', vecchieCariche))
      return id
    },

    async elimina(id) {
      const file = (ok(await db.from('verbali_allegati').select('percorso').eq('verbale_id', id)) as { percorso: string }[]).map((a) => a.percorso)
      // La policy scarta in silenzio un verbale firmato: nessuna riga tolta = resta in archivio.
      const via = ok(await db.from('verbali').delete().eq('id', id).select('id')) as unknown[]
      if (!via.length) throw new Error('Si elimina solo una bozza: un verbale firmato resta in archivio')
      if (file.length) await db.storage.from(CONTENITORE).remove(file)
    },

    async caricaPdf(id, file) {
      const stato = (ok(await db.from('verbali').select('stato').eq('id', id)) as { stato: string }[])[0]?.stato
      if (stato !== 'bozza') throw new Error('Il verbale è già firmato: per cambiare il PDF si sostituisce, dicendo perché')
      const vecchi = ok(await db.from('verbali_allegati').select('nome, percorso, peso').eq('verbale_id', id).eq('tipo', 'firmato').is('sostituito_il', null)) as { nome: string; percorso: string; peso: number | null }[]
      // L'indice unico vuole un solo firmato in vigore: via le righe vecchie (i file restano finché il nuovo non è entrato).
      if (vecchi.length) ok(await db.from('verbali_allegati').delete().eq('verbale_id', id).eq('tipo', 'firmato').is('sostituito_il', null))
      try {
        await allega(id, file, 'firmato')
      } catch (e) {
        if (vecchi.length) await db.from('verbali_allegati').insert(vecchi.map((v) => ({ verbale_id: id, tipo: 'firmato', nome: v.nome, percorso: v.percorso, peso: v.peso })))
        throw e
      }
      if (vecchi.length) await db.storage.from(CONTENITORE).remove(vecchi.map((v) => v.percorso))
    },

    async firma(id, data) {
      ok(await db.rpc('firma_verbale', { verbale: id, data }))
    },

    async rettifica(id, r) {
      const no = cosaNonVaRettifica(r)
      if (no) throw new Error(no)
      ok(await db.from('verbali_rettifiche').insert({ verbale_id: id, data: r.data, motivo: r.motivo.trim(), testo: r.testo.trim() }))
    },

    async sostituisciPdf(id, file, motivo) {
      const no = cosaNonVaSostituzione(motivo)
      if (no) throw new Error(no)
      const nuovo = await allega(id, file, 'altro')
      try {
        ok(await db.rpc('sostituisci_pdf_firmato', { verbale: id, nuovo_allegato: nuovo.id, motivo: motivo.trim() }))
      } catch (e) {
        // La funzione non l'ha preso: il file e la riga appena caricati non devono restare orfani.
        await db.from('verbali_allegati').delete().eq('id', nuovo.id)
        await db.storage.from(CONTENITORE).remove([nuovo.percorso])
        throw e
      }
    },

    async linkPdf(a) {
      if (!a.percorso) return ''
      const { data, error } = await db.storage.from(CONTENITORE).createSignedUrl(a.percorso, DURATA_LINK)
      if (error || !data) throw new Error('Il PDF non si apre: riprova fra poco')
      return data.signedUrl
    },

    async leggiSegretari() {
      return (ok(await db.from('verbali_segretari').select('persona_id')) as { persona_id: string }[]).map((x) => x.persona_id)
    },

    async salvaSegretari(personaIds) {
      const ids = [...new Set(personaIds)]
      if (ids.length) ok(await db.from('verbali_segretari').upsert(ids.map((persona_id) => ({ persona_id })), { onConflict: 'persona_id', ignoreDuplicates: true }))
      const via = db.from('verbali_segretari').delete()
      ok(await (ids.length ? via.not('persona_id', 'in', `(${ids.join(',')})`) : via.not('persona_id', 'is', null)))
    },
  }
}

let unico: Promise<DatiVerbali> | null = null

export function datiVerbali(): Promise<DatiVerbali> {
  if (!unico) {
    unico = (haUnServer ? import('./supabase').then((s) => creaVerbaliSupabase(s.clientSupabase())) : creaVerbaliProva())
      // Se il pezzo non arriva, la volta dopo si riprova invece di restare rotti.
      .catch((e: unknown) => {
        unico = null
        throw e
      })
  }
  return unico
}

