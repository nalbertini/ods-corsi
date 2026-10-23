import type { SupabaseClient } from '@supabase/supabase-js'
import type { AggiuntaNucleo, DatiIscritto, IscrittoDiProva, MiaLezione, MiaPresenza, SchedaIscritto } from './iscritto'
import type { DatiRichiesta, StatoRichiesta } from './richieste'
import type { Segnalata, StatoSegnalata } from './segnalate'
import type { StatoPresenza, StatoSessione } from './sala'
import { chiaveGiorno } from './sala'
import { pagamentoDi, type StatoPagamento } from './segreteria'
import { chiamaSatispay } from './richiesteSupabase'
import { ERRORE_SATISPAY, type StatoSatispay } from './satispay'
import { SALDO_SPENTO } from './saldoSatispay'
import { QUOTA_SPENTA } from './quotaSatispay'
import { enteDa, type QuotaRicevuta, type Ricevuta } from './ricevute'
import { cosaNonVaFileMandato, ESTENSIONI_MANDATO, guaioMandaCertificato } from './certificatoIscritto'

/**
 * L'area degli iscritti col database vero: le funzioni `iscritto_*` di
 * `supabase/101-iscritto.sql`. Restituiscono solo le righe di chi chiama (o del
 * suo nucleo, se ne è il titolare), quindi qui non si filtra niente: si
 * traduce soltanto, dalle colonne del database ai tipi di `iscritto.ts`.
 *
 * Le mappature e i messaggi d'errore sono funzioni a parte, che si provano
 * senza rete (`scripts/prova-iscritto-supabase.mjs`).
 */

/** Una riga di `iscritto_scheda` / `iscritto_nucleo`. */
export interface RigaScheda {
  id: string
  nome: string
  cognome: string
  corsi: Array<{ id: string; nome: string; colore: string | null }> | null
  certificato_scade: string | null
  /** Arriva con 102-certificato-iscritto.sql. */
  certificato_in_attesa_il?: string | null
  pagamento: StatoPagamento
  pagato_fino: string | null
  quote: Array<{ anno: number; numero: number; dal: string | null; al: string | null; mancano: number }> | null
  nato_il: string | null
}

export function schedaDa(r: RigaScheda): SchedaIscritto {
  return {
    id: r.id,
    nome: r.nome,
    cognome: r.cognome,
    corsi: (r.corsi ?? []).map((c) => ({ id: c.id, nome: c.nome, colore: c.colore ?? undefined })),
    certificato: { scade: r.certificato_scade ?? undefined, inAttesaIl: r.certificato_in_attesa_il?.slice(0, 10) },
    pagamento: { stato: r.pagamento, fino: r.pagato_fino ?? undefined },
    quote: (r.quote ?? []).map((q): QuotaRicevuta => ({ anno: q.anno, numero: q.numero, dal: q.dal ?? undefined, al: q.al ?? undefined, mancano: q.mancano })),
    natoIl: r.nato_il ?? undefined,
    // Senza 102 la colonna non arriva (con 102 arriva anche vuota): così si sa se il tasto può esserci.
    ...('certificato_in_attesa_il' in r ? { certificatoDaQui: true } : {}),
  }
}

export interface RigaLezione {
  id: string
  corso: string
  colore: string | null
  inizio: string
  fine: string
  stato: StatoSessione
  sala: string | null
  istruttore: string | null
  sostituto: boolean
  altra_sala: boolean
  straordinaria: boolean
}

export const lezioneDa = (r: RigaLezione): MiaLezione => ({
  id: r.id,
  corso: r.corso,
  colore: r.colore ?? undefined,
  inizio: r.inizio,
  fine: r.fine,
  stato: r.stato,
  sala: r.sala ?? undefined,
  istruttore: r.istruttore ?? undefined,
  sostituto: r.sostituto,
  altraSala: r.altra_sala,
  straordinaria: r.straordinaria,
})

export interface RigaPresenza {
  sessione_id: string
  inizio: string
  corso: string
  stato: StatoPresenza | null
}

export const presenzaDa = (r: RigaPresenza): MiaPresenza => ({ sessioneId: r.sessione_id, inizio: r.inizio, corso: r.corso, stato: r.stato })

export interface RigaRicevuta {
  id: string
  anno: number
  numero: number
  data: string
  ente: Ricevuta['ente']
  intestatario: Ricevuta['intestatario']
  voci: Array<Omit<Ricevuta['voci'][number], 'dal' | 'al'> & { dal: string | null; al: string | null }>
  totale: number
  pagato: number
  anticipo: number
  creata_il: string
  annullata_il: string | null
}

export const ricevutaDa = (r: RigaRicevuta, personaId: string): Ricevuta => ({
  id: r.id,
  anno: r.anno,
  numero: r.numero,
  data: r.data,
  personaId,
  ente: enteDa(r.ente),
  intestatario: r.intestatario,
  voci: r.voci.map((v) => ({ ...v, dal: v.dal ?? undefined, al: v.al ?? undefined })),
  totale: r.totale,
  pagato: r.pagato,
  anticipo: r.anticipo,
  creataIl: r.creata_il,
  annullataIl: r.annullata_il ?? undefined,
})

export interface RigaAggiunta {
  id: string
  nome: string
  cognome: string
  corsi: string[] | null
  creata_il: string
  stato: StatoRichiesta
}

export const aggiuntaDa = (r: RigaAggiunta): AggiuntaNucleo => ({
  id: r.id,
  nome: r.nome,
  cognome: r.cognome,
  corsi: r.corsi ?? [],
  creataIl: r.creata_il,
  // Il cast regge perché la funzione SQL non restituisce le accolte (sono già nel nucleo).
  stato: r.stato as AggiuntaNucleo['stato'],
})

export interface RigaDatiNucleo {
  cognome: string
  indirizzo: string
  cap: string
  comune: string
  email: string
  telefono: string
  genitore_nome: string | null
  genitore_cognome: string | null
  genitore_codice_fiscale: string | null
  nucleo_di: string
}

export function datiNucleoDa(r: RigaDatiNucleo): Partial<DatiRichiesta> {
  return {
    cognome: r.cognome,
    indirizzo: r.indirizzo,
    cap: r.cap,
    comune: r.comune,
    email: r.email,
    telefono: r.telefono,
    // I dati da genitore ci sono solo se il titolare è maggiorenne (o non si sa).
    ...(r.genitore_nome === null
      ? {}
      : { genitoreNome: r.genitore_nome, genitoreCognome: r.genitore_cognome ?? '', genitoreCodiceFiscale: r.genitore_codice_fiscale ?? '' }),
    nucleoDi: r.nucleo_di,
  }
}

export interface RigaSegnalata {
  id: string
  sessione_id: string
  persona_id: string
  il: string
  nota: string | null
  stato: StatoSegnalata
  gestita_il: string | null
}

export const segnalataDa = (r: RigaSegnalata): Segnalata => ({
  id: r.id,
  sessioneId: r.sessione_id,
  personaId: r.persona_id,
  il: r.il,
  nota: r.nota ?? undefined,
  stato: r.stato,
  gestitaIl: r.gestita_il ?? undefined,
})

interface ErroreDb {
  message?: string
  code?: string
}

/**
 * Cosa dire a chi usa l'app quando il database non risponde come deve: mai il
 * testo grezzo dell'API. Le regole di `iscritto_segnala` (codice 22023) hanno
 * già le parole giuste e passano com'erano, quando `segnalando`.
 */
export function guaioIscritto(e: ErroreDb | null, segnalando = false): Error {
  const testo = e?.message ?? ''
  if (segnalando && (e?.code === '22023' || e?.code === '42501') && testo) return new Error(testo)
  if (e?.code === '42501') return new Error('Non puoi vedere questa persona: esci e rientra con la tua email')
  // PostgREST non trova la funzione: 101-iscritto.sql non è sul database.
  if (e?.code === 'PGRST202') return new Error('L’area degli iscritti non è ancora attiva: chiedi alla segreteria')
  if (/fetch|network|load failed/i.test(testo)) return new Error('Il server non risponde: c’è rete?')
  return new Error('Non riesco a leggere i tuoi dati: riprova fra poco')
}

/** Chi ha l'accesso adesso, come persona: `null` senza accesso o se l'account non è di un iscritto. */
export interface RigaIo {
  id: string
  nome: string
  cognome: string
  ruolo: string
  attiva: boolean
}

export const ioDa = (r: RigaIo | null): IscrittoDiProva | null => (r && r.ruolo === 'iscritto' && r.attiva ? { id: r.id, nome: r.nome, cognome: r.cognome } : null)

/** La riga di `persone` legata a questo account (la policy lascia a ognuno la propria), o `null`. */
export async function leggiIo(c: SupabaseClient, utente: string): Promise<RigaIo | null> {
  const { data, error } = await c.from('persone').select('id, nome, cognome, ruolo, attiva').eq('utente_id', utente).maybeSingle()
  if (error) throw guaioIscritto(error)
  return data as RigaIo | null // la libreria dà `any`: le colonne sono quelle del select
}

export function creaIscrittoSupabase(c: SupabaseClient): DatiIscritto {
  // La libreria dà `any` ai dati delle funzioni: il tipo lo dice chi chiama, che conosce la funzione.
  const chiama = async <T>(nome: string, args: Record<string, unknown>, segnalando = false): Promise<T> => {
    const { data, error } = await c.rpc(nome, args)
    if (error) throw guaioIscritto(error, segnalando)
    return data as T
  }
  // La quota pagata con Satispay e non ancora in una ricevuta: l'iscritto non legge `pagamenti_satispay`, la dice `satispay_quota_stato`
  // (105). Senza 105, o se non risponde, la scheda resta com'è: al peggio dice «da pagare» finché la segreteria non fa la ricevuta.
  const conQuota = async (s: SchedaIscritto): Promise<SchedaIscritto> => {
    if (!['da_pagare', 'scaduto'].includes(pagamentoDi(s, chiaveGiorno(new Date())).come)) return s
    const { data, error } = await c.rpc('satispay_quota_stato', { persona: s.id })
    // `as`: la forma è quella di `satispay_quota_stato` (105-paga-quota-satispay.sql).
    const p = data as { stato: StatoSatispay; importo: number } | null
    return !error && p?.stato === 'pagato' ? { ...s, satispay: p.importo } : s
  }
  const nucleo = async (persona: string) => Promise.all((await chiama<RigaScheda[] | null>('iscritto_nucleo', { persona }) ?? []).map((r) => conQuota(schedaDa(r))))

  return {
    modo: 'supabase',

    async iscritti() {
      const { data: s } = await c.auth.getSession()
      const utente = s.session?.user.id
      if (!utente) return []
      const io = ioDa(await leggiIo(c, utente))
      return io ? [io] : []
    },

    async scheda(persona) {
      const [riga] = (await chiama<RigaScheda[] | null>('iscritto_scheda', { persona })) ?? []
      return riga ? conQuota(schedaDa(riga)) : null
    },

    async lezioni(persona, da, a) {
      const righe = await chiama<RigaLezione[] | null>('iscritto_lezioni', { persona, da: chiaveGiorno(da), a: chiaveGiorno(a) })
      return (righe ?? []).map(lezioneDa)
    },

    async presenze(persona, giorni) {
      return ((await chiama<RigaPresenza[] | null>('iscritto_presenze', { persona, giorni })) ?? []).map(presenzaDa)
    },

    async ricevute(persona) {
      return ((await chiama<RigaRicevuta[] | null>('iscritto_ricevute', { persona })) ?? []).map((r) => ricevutaDa(r, persona))
    },

    nucleo,

    async titolare(persona) {
      return (await chiama<boolean | null>('iscritto_titolare', { persona })) === true
    },

    async aggiunte(persona) {
      return ((await chiama<RigaAggiunta[] | null>('iscritto_aggiunte', { persona })) ?? []).map(aggiuntaDa)
    },

    async datiDelNucleo(persona) {
      const [riga] = (await chiama<RigaDatiNucleo[] | null>('iscritto_dati_del_nucleo', { persona })) ?? []
      return riga ? datiNucleoDa(riga) : {}
    },

    async segnala(persona, sessione, nota) {
      await chiama('iscritto_segnala', { persona, sessione, nota: nota ?? null }, true)
    },

    async segnalate(persona) {
      return ((await chiama<RigaSegnalata[] | null>('iscritto_segnalate', { persona })) ?? []).map(segnalataDa)
    },

    async mandaCertificato(persona, file) {
      const guasto = cosaNonVaFileMandato(file)
      if (guasto) throw new Error(guasto)
      // Prima il file nella cartella della persona, poi la funzione che lo mette «in attesa»: se questa dice di no il file resta
      // orfano, e `pulisci_certificati` lo toglie con gli altri.
      const nome = `${persona}/attesa-${Date.now()}.${ESTENSIONI_MANDATO[file.type]}`
      const su = await c.storage.from('certificati').upload(nome, file, { contentType: file.type, upsert: false })
      if (su.error) throw guaioMandaCertificato(su.error)
      const r = await c.rpc('iscritto_manda_certificato', { persona, file: nome })
      if (r.error) throw guaioMandaCertificato(r.error)
    },

    async saldoAttivo() {
      try {
        return (await chiamaSatispay(c, { azione: 'saldo_attivo' })).attivo === true
      } catch {
        return false
      }
    },

    async chiPaga(persona) {
      // Senza `103-saldo-satispay.sql` (o senza rete) non si sa chi è: niente PAGA.
      const { data, error } = await c.rpc('satispay_saldo_chi', { persona })
      if (error) return null
      // `as`: la forma è quella di `satispay_saldo_chi` (103-saldo-satispay.sql).
      const r = data as { adulto: boolean; accesso_proprio: boolean; come_titolare: boolean } | null
      if (!r) return null
      // La quota intera: 105-paga-quota-satispay.sql. Senza il file (o senza listino) niente importo, e niente tasto.
      const q = await c.rpc('satispay_quota_chi', { persona })
      // `as`: la forma è quella di `satispay_quota_chi` (105-paga-quota-satispay.sql).
      const importo = q.error ? null : ((q.data as { importo: number | null } | null)?.importo ?? null)
      return { adulto: r.adulto, haAccessoProprio: r.accesso_proprio, comeTitolare: r.come_titolare, importo }
    },

    async pagaSaldo(persona, ricevuta) {
      const r = await chiamaSatispay(c, { azione: 'saldo', persona, ricevuta })
      if (r.attivo === false) throw new Error(SALDO_SPENTO)
      if (typeof r.link !== 'string') throw new Error(ERRORE_SATISPAY)
      return { link: r.link }
    },

    async statoSaldo(persona, ricevuta) {
      const r = await chiamaSatispay(c, { azione: 'saldo_stato', persona, ricevuta })
      if (r.attivo === false) throw new Error(SALDO_SPENTO)
      // `as`: la forma è quella di `satispay_saldo_stato` (103-saldo-satispay.sql), riletta dalla funzione.
      const p = r.pagamento as { stato: StatoSatispay; importo: number; pagato_il?: string | null; chi: string } | null | undefined
      return p ? { stato: p.stato, importo: p.importo, pagatoIl: p.pagato_il ?? undefined, chi: p.chi } : null
    },

    async pagaQuota(persona) {
      const r = await chiamaSatispay(c, { azione: 'quota', persona })
      if (r.attivo === false) throw new Error(QUOTA_SPENTA)
      if (typeof r.link !== 'string') throw new Error(ERRORE_SATISPAY)
      return { link: r.link }
    },

    async statoQuota(persona) {
      const r = await chiamaSatispay(c, { azione: 'quota_stato', persona })
      if (r.attivo === false) throw new Error(QUOTA_SPENTA)
      // `as`: la forma è quella di `satispay_quota_stato` (105-paga-quota-satispay.sql), riletta dalla funzione.
      const p = r.pagamento as { stato: StatoSatispay; importo: number; pagato_il?: string | null; chi: string } | null | undefined
      return p ? { stato: p.stato, importo: p.importo, pagatoIl: p.pagato_il ?? undefined, chi: p.chi } : null
    },
  }
}
