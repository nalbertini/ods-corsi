import type { SupabaseClient } from '@supabase/supabase-js'
import type { CorsoSeg, DatiSegreteria, Impostazioni, LezioneSeg, PersonaSeg, PersonaleSeg, RigaRegistro, StoricoSeg } from './segreteria'
import type { StatoPresenza, StatoSessione } from './sala'
import { chiaveGiorno, perCognome, perEsteso } from './sala'

/**
 * La segreteria col database vero.
 *
 * Scrive direttamente sulle tabelle: le policy di `02-policy.sql` lasciano
 * scrivere solo chi ha il ruolo `staff`, e i trigger di `05-segreteria.sql`
 * fanno seguire alle lezioni future i cambi di un corso. Qui non ci sono
 * controlli di permesso: se non si può, il server risponde di no e la
 * schermata lo dice.
 */

interface RigaSessione {
  id: string
  corso_id: string
  ricorrenza_id: string | null
  inizio: string
  fine: string
  stato: StatoSessione
  sala_id: string | null
  istruttore_id: string | null
  corsi: { nome: string; colore: string | null; capienza: number | null; sala_id: string | null; istruttore_id: string | null } | null
  sale: { nome: string } | null
  persone: { nome: string; cognome: string } | null
}

type Iscrizione = { corso_id: string; persona_id: string; dal: string; al: string | null }

const nome = (p: { nome: string; cognome: string } | null | undefined) => (p ? `${p.nome} ${p.cognome}`.trim() : '')
const giornoDi = (iso: string) => chiaveGiorno(new Date(iso))
const valeIl = (i: { dal: string; al: string | null }, g: string) => i.dal <= g && (!i.al || i.al >= g)

/** Un errore del database detto in modo che la segreteria lo capisca. */
function guaio(e: { message?: string; code?: string } | null): Error {
  if (e?.code === '23505') return new Error('C’è già: due righe uguali non si possono avere (un’email già usata, un corso già iscritto)')
  if (e?.code === '42501') return new Error('Non hai il permesso: serve un accesso da segreteria')
  return new Error(e?.message || 'Il server non risponde')
}

export function creaSegreteriaSupabase(db: SupabaseClient): DatiSegreteria {
  const ok = <T>(r: { data: T; error: { message?: string; code?: string } | null }): T => {
    if (r.error) throw guaio(r.error)
    return r.data
  }
  const oggi = () => chiaveGiorno(new Date())

  /** Chi insegna ogni corso, per nome, col primo di riferimento davanti. */
  const insegnanti = async (corsi: string[]) => {
    const righe = ok(
      await db.from('corsi_istruttori').select('corso_id, persona_id, persone ( nome, cognome )').in('corso_id', corsi.length ? corsi : ['00000000-0000-0000-0000-000000000000']),
    ) as unknown as Array<{ corso_id: string; persona_id: string; persone: { nome: string; cognome: string } | null }>
    const m = new Map<string, Array<{ id: string; nome: string }>>()
    for (const r of righe) m.set(r.corso_id, [...(m.get(r.corso_id) ?? []), { id: r.persona_id, nome: nome(r.persone) }])
    return m
  }

  const impostazioni = async (): Promise<Impostazioni> => {
    const r = ok(await db.from('impostazioni').select('mesi_presenze, giorni_calendario').maybeSingle()) as {
      mesi_presenze: number; giorni_calendario: number
    } | null
    return { mesiPresenze: r?.mesi_presenze ?? 24, giorniCalendario: r?.giorni_calendario ?? 60 }
  }

  /** Allunga il calendario fino ai giorni scelti in REGOLE, senza mai accorciarlo. */
  const rigenera = async () => {
    const [pronto, { giorniCalendario }] = await Promise.all([db.rpc('calendario_pronto_fino').then(ok) as Promise<string | null>, impostazioni()])
    const fino = chiaveGiorno(new Date(Date.now() + giorniCalendario * 24 * 60 * 60_000))
    return ok(await db.rpc('materializza_sessioni', { da_giorno: oggi(), a_giorno: pronto && pronto > fino ? pronto : fino })) as number
  }

  return {
    modo: 'supabase',

    async sale() {
      const righe = ok(await db.from('sale').select('id, nome, capienza').order('nome')) as Array<{ id: string; nome: string; capienza: number | null }>
      return righe.map((r) => ({ id: r.id, nome: r.nome, capienza: r.capienza ?? undefined }))
    },

    async istruttori() {
      const righe = ok(await db.from('persone').select('id, nome, cognome').eq('ruolo', 'istruttore').eq('attiva', true).order('nome')) as Array<{
        id: string; nome: string; cognome: string
      }>
      return righe.map((r) => ({ id: r.id, nome: nome(r) }))
    },

    async settimana(da, a) {
      const fino = new Date(a)
      fino.setHours(23, 59, 59, 999)
      const sessioni = ok(
        await db
          .from('sessioni')
          .select('id, corso_id, ricorrenza_id, inizio, fine, stato, sala_id, istruttore_id, corsi ( nome, colore, capienza, sala_id, istruttore_id ), sale ( nome ), persone ( nome, cognome )')
          .gte('inizio', da.toISOString())
          .lte('inizio', fino.toISOString())
          .order('inizio'),
      ) as unknown as RigaSessione[]
      const corsi = [...new Set(sessioni.map((s) => s.corso_id))]
      const ids = sessioni.map((s) => s.id)
      const vuoto = ['00000000-0000-0000-0000-000000000000']
      const [isc, pres, chi] = await Promise.all([
        db.from('iscrizioni').select('corso_id, persona_id, dal, al').in('corso_id', corsi.length ? corsi : vuoto),
        db.from('presenze').select('sessione_id, stato').in('sessione_id', ids.length ? ids : vuoto),
        insegnanti(corsi),
      ])
      const iscrizioni = ok(isc) as Iscrizione[]
      const presenze = ok(pres) as Array<{ sessione_id: string; stato: StatoPresenza }>
      return sessioni.map((s): LezioneSeg => {
        const g = giornoDi(s.inizio)
        const segni = presenze.filter((p) => p.sessione_id === s.id)
        const sostituto = s.istruttore_id && s.istruttore_id !== s.corsi?.istruttore_id ? s.istruttore_id : undefined
        return {
          id: s.id,
          corsoId: s.corso_id,
          corso: s.corsi?.nome ?? 'Corso',
          colore: s.corsi?.colore ?? undefined,
          salaId: s.sala_id ?? s.corsi?.sala_id ?? undefined,
          sala: s.sale?.nome,
          sostitutoId: sostituto,
          istruttori: sostituto ? nome(s.persone) : (chi.get(s.corso_id) ?? []).map((x) => x.nome).join(', ') || nome(s.persone),
          inizio: s.inizio,
          fine: s.fine,
          stato: s.stato,
          straordinaria: !s.ricorrenza_id,
          iscritti: iscrizioni.filter((i) => i.corso_id === s.corso_id && valeIl(i, g)).length,
          capienza: s.corsi?.capienza ?? undefined,
          presenti: segni.filter((p) => p.stato === 'presente').length,
          segnati: segni.length,
        }
      })
    },

    async iscrittiLezione(sessioneId) {
      const s = ok(await db.from('sessioni').select('corso_id, inizio').eq('id', sessioneId).single()) as { corso_id: string; inizio: string }
      const righe = ok(await db.from('iscrizioni').select('dal, al, persone ( nome, cognome, attiva )').eq('corso_id', s.corso_id)) as unknown as Array<{
        dal: string; al: string | null; persone: { nome: string; cognome: string; attiva: boolean } | null
      }>
      const g = giornoDi(s.inizio)
      return righe
        .filter((r) => r.persone?.attiva && valeIl(r, g))
        .map((r) => ({ id: '', ruolo: 'iscritto' as const, nome: r.persone!.nome, cognome: r.persone!.cognome }))
        .sort(perCognome)
        .map(perEsteso)
    },

    async aggiornaLezione(sessioneId, cambi) {
      const s = ok(await db.from('sessioni').select('corsi ( sala_id, istruttore_id )').eq('id', sessioneId).single()) as unknown as {
        corsi: { sala_id: string | null; istruttore_id: string | null } | null
      }
      const riga: Record<string, unknown> = {}
      if (cambi.stato) riga.stato = cambi.stato
      // «Come da corso» è il valore del corso: così la lezione torna a seguirlo.
      if (cambi.sostitutoId !== undefined) riga.istruttore_id = cambi.sostitutoId ?? s.corsi?.istruttore_id ?? null
      if (cambi.salaId !== undefined) riga.sala_id = cambi.salaId ?? s.corsi?.sala_id ?? null
      ok(await db.from('sessioni').update(riga).eq('id', sessioneId))
    },

    async straordinaria(corsoId, inizio, durata) {
      const c = ok(await db.from('corsi').select('sala_id, istruttore_id').eq('id', corsoId).single()) as { sala_id: string | null; istruttore_id: string | null }
      ok(
        await db.from('sessioni').insert({
          corso_id: corsoId,
          inizio: inizio.toISOString(),
          fine: new Date(inizio.getTime() + durata * 60_000).toISOString(),
          sala_id: c.sala_id,
          istruttore_id: c.istruttore_id,
        }),
      )
    },

    async togliLezione(sessioneId) {
      const { count } = await db.from('presenze').select('id', { count: 'exact', head: true }).eq('sessione_id', sessioneId)
      if (count) throw new Error('Ha già un appello: si annulla invece di toglierla')
      ok(await db.from('sessioni').delete().eq('id', sessioneId).is('ricorrenza_id', null))
    },

    async tuttiPresenti(sessioneId) {
      const s = ok(await db.from('sessioni').select('corso_id, inizio').eq('id', sessioneId).single()) as { corso_id: string; inizio: string }
      const isc = (ok(await db.from('iscrizioni').select('corso_id, persona_id, dal, al').eq('corso_id', s.corso_id)) as Iscrizione[]).filter((i) =>
        valeIl(i, giornoDi(s.inizio)),
      )
      if (!isc.length) return
      ok(
        await db
          .from('presenze')
          .upsert(isc.map((i) => ({ sessione_id: sessioneId, persona_id: i.persona_id, stato: 'presente' })), { onConflict: 'sessione_id,persona_id' }),
      )
    },

    async prontoFino() {
      return ok(await db.rpc('calendario_pronto_fino')) as string | null
    },

    rigenera,

    async corsi() {
      const righe = ok(
        await db.from('corsi').select('id, nome, colore, capienza, attivo, sala_id, istruttore_id, sale ( nome ), ricorrenze ( id, giorno, ora, durata_min, dal, al )').order('nome'),
      ) as unknown as Array<{
        id: string; nome: string; colore: string | null; capienza: number | null; attivo: boolean; sala_id: string | null; istruttore_id: string | null
        sale: { nome: string } | null
        ricorrenze: Array<{ id: string; giorno: number; ora: string; durata_min: number; dal: string; al: string | null }>
      }>
      const chi = await insegnanti(righe.map((r) => r.id))
      const g = oggi()
      return righe.map(
        (r): CorsoSeg => ({
          id: r.id,
          nome: r.nome,
          colore: r.colore ?? undefined,
          salaId: r.sala_id ?? undefined,
          sala: r.sale?.nome,
          istruttori: [...(chi.get(r.id) ?? [])].sort((x, y) => Number(y.id === r.istruttore_id) - Number(x.id === r.istruttore_id)),
          capienza: r.capienza ?? undefined,
          attivo: r.attivo,
          ricorrenze: r.ricorrenze
            .filter((x) => !x.al || x.al >= g)
            .map((x) => ({ id: x.id, giorno: x.giorno, ora: x.ora.slice(0, 5), durata: x.durata_min, dal: x.dal, al: x.al ?? undefined }))
            .sort((x, y) => ((x.giorno + 6) % 7) - ((y.giorno + 6) % 7) || x.ora.localeCompare(y.ora)),
        }),
      )
    },

    async salvaCorso(c) {
      if (!c.nome.trim()) throw new Error('Il corso ha bisogno di un nome')
      const riga = {
        nome: c.nome.trim(),
        sala_id: c.salaId ?? null,
        istruttore_id: c.istruttori[0] ?? null,
        capienza: c.capienza ?? null,
        colore: c.colore ?? null,
      }
      const id = c.id
        ? (ok(await db.from('corsi').update(riga).eq('id', c.id)), c.id)
        : (ok(await db.from('corsi').insert(riga).select('id').single()) as { id: string }).id
      // Chi insegna: si tolgono quelli che non ci sono più e si aggiungono i nuovi.
      const prima = (ok(await db.from('corsi_istruttori').select('persona_id').eq('corso_id', id)) as Array<{ persona_id: string }>).map((r) => r.persona_id)
      const via = prima.filter((p) => !c.istruttori.includes(p))
      const nuovi = c.istruttori.filter((p) => !prima.includes(p))
      if (via.length) ok(await db.from('corsi_istruttori').delete().eq('corso_id', id).in('persona_id', via))
      if (nuovi.length) ok(await db.from('corsi_istruttori').insert(nuovi.map((persona_id) => ({ corso_id: id, persona_id }))))
      return id
    },

    async archiviaCorso(corsoId, attivo) {
      ok(await db.from('corsi').update({ attivo }).eq('id', corsoId))
      if (attivo) await rigenera()
    },

    async aggiungiRicorrenza(corsoId, r, opzioni) {
      ok(await db.from('ricorrenze').insert({ corso_id: corsoId, giorno: r.giorno, ora: r.ora, durata_min: r.durata, dal: oggi() }))
      if (opzioni?.rigenera !== false) await rigenera()
    },

    async togliRicorrenza(ricorrenzaId) {
      ok(await db.rpc('chiudi_ricorrenza', { ricorrenza: ricorrenzaId }))
    },

    async persone() {
      const righe = ok(
        await db.from('persone').select('id, nome, cognome, email, telefono, attiva, creata_il, iscrizioni ( corso_id, dal, al )').eq('ruolo', 'iscritto').order('cognome'),
      ) as unknown as Array<{
        id: string; nome: string; cognome: string; email: string | null; telefono: string | null; attiva: boolean; creata_il: string
        iscrizioni: Array<{ corso_id: string; dal: string; al: string | null }>
      }>
      return righe.map(
        (r): PersonaSeg => ({
          id: r.id,
          nome: r.nome,
          cognome: r.cognome,
          email: r.email ?? undefined,
          telefono: r.telefono ?? undefined,
          attiva: r.attiva,
          creataIl: r.creata_il.slice(0, 10),
          iscrizioni: r.iscrizioni.map((i) => ({ corsoId: i.corso_id, dal: i.dal, al: i.al ?? undefined })),
        }),
      )
    },

    async frequenze() {
      const righe = ok(await db.rpc('frequenze', { giorni: 30 })) as Array<{ persona_id: string; presenti: number; dovute: number }>
      return new Map(righe.map((r) => [r.persona_id, { presenti: r.presenti, dovute: r.dovute }]))
    },

    async storico(personaId, quante) {
      const isc = ok(await db.from('iscrizioni').select('corso_id, persona_id, dal, al').eq('persona_id', personaId)) as Iscrizione[]
      if (!isc.length) return []
      const sessioni = ok(
        await db
          .from('sessioni')
          .select('id, corso_id, inizio, corsi ( nome )')
          .in('corso_id', isc.map((i) => i.corso_id))
          .neq('stato', 'annullata')
          .lt('inizio', new Date().toISOString())
          .order('inizio', { ascending: false })
          .limit(quante * 4),
      ) as unknown as Array<{ id: string; corso_id: string; inizio: string; corsi: { nome: string } | null }>
      const sue = sessioni.filter((s) => isc.some((i) => i.corso_id === s.corso_id && valeIl(i, giornoDi(s.inizio)))).slice(0, quante)
      const pres = ok(
        await db.from('presenze').select('sessione_id, stato').eq('persona_id', personaId).in('sessione_id', sue.length ? sue.map((s) => s.id) : ['00000000-0000-0000-0000-000000000000']),
      ) as Array<{ sessione_id: string; stato: StatoPresenza }>
      return sue
        .map((s): StoricoSeg => ({ sessioneId: s.id, inizio: s.inizio, corso: s.corsi?.nome ?? '', stato: pres.find((p) => p.sessione_id === s.id)?.stato ?? null }))
        .reverse()
    },

    async salvaPersona(p) {
      if (!p.nome.trim() || !p.cognome.trim()) throw new Error('Servono nome e cognome')
      const riga = { nome: p.nome.trim(), cognome: p.cognome.trim(), email: p.email?.trim() || null, telefono: p.telefono?.trim() || null }
      if (p.id) {
        ok(await db.from('persone').update(riga).eq('id', p.id))
        return p.id
      }
      return (ok(await db.from('persone').insert({ ...riga, ruolo: 'iscritto' }).select('id').single()) as { id: string }).id
    },

    async attivaPersona(personaId, attiva) {
      ok(await db.from('persone').update({ attiva }).eq('id', personaId))
    },

    async iscrivi(personaId, corsoId) {
      const g = oggi()
      const c = ok(await db.from('iscrizioni').select('dal, al').eq('persona_id', personaId).eq('corso_id', corsoId).maybeSingle()) as {
        dal: string; al: string | null
      } | null
      if (c && (!c.al || c.al >= g)) return
      // Una riga per persona e corso: chi torna riparte da oggi.
      ok(await db.from('iscrizioni').upsert({ persona_id: personaId, corso_id: corsoId, dal: g, al: null }, { onConflict: 'corso_id,persona_id' }))
    },

    async termina(personaId, corsoId) {
      ok(await db.from('iscrizioni').update({ al: oggi() }).eq('persona_id', personaId).eq('corso_id', corsoId))
    },
    async registro(da, a) {
      const fino = new Date(a)
      fino.setHours(23, 59, 59, 999)
      const adesso = new Date()
      const sessioni = ok(
        await db
          .from('sessioni')
          .select('id, corso_id, inizio, stato, istruttore_id, corsi ( nome, istruttore_id ), sale ( nome ), persone ( nome, cognome )')
          .gte('inizio', da.toISOString())
          .lte('inizio', (fino < adesso ? fino : adesso).toISOString())
          .order('inizio'),
      ) as unknown as Array<{
        id: string; corso_id: string; inizio: string; stato: RigaRegistro['stato']; istruttore_id: string | null
        corsi: { nome: string; istruttore_id: string | null } | null; sale: { nome: string } | null; persone: { nome: string; cognome: string } | null
      }>
      const corsi = [...new Set(sessioni.map((x) => x.corso_id))]
      const vuoto = ['00000000-0000-0000-0000-000000000000']
      const [isc, pres, chi] = await Promise.all([
        db.from('iscrizioni').select('corso_id, persona_id, dal, al, persone ( nome, cognome, attiva )').in('corso_id', corsi.length ? corsi : vuoto),
        db.from('presenze').select('sessione_id, persona_id, stato').in('sessione_id', sessioni.length ? sessioni.map((x) => x.id) : vuoto),
        insegnanti(corsi),
      ])
      const iscrizioni = ok(isc) as unknown as Array<Iscrizione & { persone: { nome: string; cognome: string; attiva: boolean } | null }>
      const presenze = ok(pres) as Array<{ sessione_id: string; persona_id: string; stato: StatoPresenza }>
      return sessioni.map((x): RigaRegistro => {
        const g = giornoDi(x.inizio)
        const segni = new Map(presenze.filter((p) => p.sessione_id === x.id).map((p) => [p.persona_id, p.stato]))
        const sostituto = x.istruttore_id && x.istruttore_id !== x.corsi?.istruttore_id
        return {
          sessioneId: x.id,
          corsoId: x.corso_id,
          corso: x.corsi?.nome ?? 'Corso',
          sala: x.sale?.nome,
          istruttori: sostituto ? nome(x.persone) : (chi.get(x.corso_id) ?? []).map((i) => i.nome).join(', ') || nome(x.persone),
          inizio: x.inizio,
          stato: x.stato,
          appello: iscrizioni
            .filter((i) => i.corso_id === x.corso_id && i.persone?.attiva && valeIl(i, g))
            .map((i) => ({ personaId: i.persona_id, nome: i.persone!.nome, cognome: i.persone!.cognome, stato: segni.get(i.persona_id) ?? null })),
        }
      })
    },

    async personale() {
      const [righe, legami, pin] = await Promise.all([
        db.from('persone').select('id, nome, cognome, email, ruolo, attiva, utente_id').in('ruolo', ['istruttore', 'staff']).order('nome'),
        db.from('corsi_istruttori').select('persona_id, corsi ( nome, attivo )'),
        db.rpc('pin_impostati'),
      ])
      const persone = ok(righe) as Array<{ id: string; nome: string; cognome: string; email: string | null; ruolo: 'istruttore' | 'staff'; attiva: boolean; utente_id: string | null }>
      const corsi = ok(legami) as unknown as Array<{ persona_id: string; corsi: { nome: string; attivo: boolean } | null }>
      const conPin = new Set((ok(pin) as Array<{ persona_id: string }>).map((r) => r.persona_id))
      return persone.map(
        (p): PersonaleSeg => ({
          id: p.id,
          nome: p.nome,
          cognome: p.cognome,
          email: p.email ?? undefined,
          ruolo: p.ruolo,
          attiva: p.attiva,
          collegato: !!p.utente_id,
          haPin: conPin.has(p.id),
          corsi: corsi.filter((c) => c.persona_id === p.id && c.corsi?.attivo).map((c) => c.corsi!.nome),
        }),
      )
    },

    async salvaPersonale(p) {
      if (!p.nome.trim()) throw new Error('Serve almeno il nome')
      const email = p.email?.trim() || null
      const riga = { nome: p.nome.trim(), cognome: p.cognome.trim() || '—', email, ruolo: p.ruolo }
      if (p.id) {
        ok(await db.from('persone').update(riga).eq('id', p.id))
        return p.id
      }
      // Un'iscritta con la stessa email diventa personale, invece di un doppione.
      if (email) {
        const c = ok(await db.from('persone').select('id, ruolo').eq('email', email).maybeSingle()) as { id: string; ruolo: string } | null
        if (c && c.ruolo !== 'iscritto') throw new Error('Questa email è già di un istruttore o della segreteria')
        if (c) {
          ok(await db.from('persone').update({ ruolo: p.ruolo, attiva: true }).eq('id', c.id))
          return c.id
        }
      }
      // Già in elenco senza email (dall'import, per esempio): gliela si dà, invece di rifarla.
      const senza = ok(
        await db.from('persone').select('id').in('ruolo', ['istruttore', 'staff']).is('email', null).ilike('nome', riga.nome).ilike('cognome', riga.cognome).limit(1),
      ) as Array<{ id: string }>
      if (senza[0]) {
        ok(await db.from('persone').update({ email, ruolo: p.ruolo, attiva: true }).eq('id', senza[0].id))
        return senza[0].id
      }
      return (ok(await db.from('persone').insert(riga).select('id').single()) as { id: string }).id
    },

    async impostaPin(personaId, pin) {
      ok(await db.rpc('imposta_pin', { persona: personaId, pin }))
    },

    async salvaSala(sala) {
      if (!sala.nome.trim()) throw new Error('La sala ha bisogno di un nome')
      const riga = { nome: sala.nome.trim(), capienza: sala.capienza ?? null }
      if (sala.id) {
        ok(await db.from('sale').update(riga).eq('id', sala.id))
        return sala.id
      }
      return (ok(await db.from('sale').insert(riga).select('id').single()) as { id: string }).id
    },

    impostazioni,

    async salvaImpostazioni(i) {
      const riga: Record<string, number> = {}
      if (i.mesiPresenze !== undefined) riga.mesi_presenze = i.mesiPresenze
      if (i.giorniCalendario !== undefined) riga.giorni_calendario = i.giorniCalendario
      ok(await db.from('impostazioni').update(riga).eq('id', true))
    },

    async scadute() {
      const { count, error } = await db.from('presenze_scadute').select('id', { count: 'exact', head: true })
      if (error) throw guaio(error)
      return count ?? 0
    },

    async pulisci() {
      return ok(await db.rpc('pulisci_presenze')) as number
    },

    async esporta(personaId) {
      const [persona, isc, pres, rich] = await Promise.all([
        db.from('persone').select('nome, cognome, email, telefono, ruolo, attiva, creata_il').eq('id', personaId).single(),
        db.from('iscrizioni').select('dal, al, corsi ( nome )').eq('persona_id', personaId),
        db.from('presenze').select('stato, origine, segnata_il, sessioni ( inizio, corsi ( nome ) )').eq('persona_id', personaId),
        // Le richieste dal modulo di iscrizione: i file restano nello Storage, qui c'è quali sono.
        db.from('richieste_iscrizione').select('creata_il, stato, nome, cognome, nato_il, nato_a, codice_fiscale, indirizzo, cap, comune, email, telefono, genitore_nome, genitore_cognome, genitore_codice_fiscale, corsi, formula, note, gestita_il').eq('persona_id', personaId),
      ])
      return {
        esportato_il: new Date().toISOString(),
        persona: ok(persona),
        iscrizioni: ok(isc),
        presenze: ok(pres),
        richieste_di_iscrizione: ok(rich),
      }
    },
  }
}
