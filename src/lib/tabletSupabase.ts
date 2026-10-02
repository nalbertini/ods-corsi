import type { SupabaseClient } from '@supabase/supabase-js'
import { allungaCalendario } from './allunga'
import type { DatiTablet, EsitoTocco, LezioneSala, NomeSala, Origine, PresenzaIstruttore, RigaAppelloTablet, StatoPresenzaIstruttore } from './tablet'
import type { StatoPresenza, StatoSessione } from './sala'
import { chiaveGiorno } from './sala'
import { leggiTimerSala, salvaTimerSala } from '../../timer/src/lib/impostazioniSala'
import { fonteClipSupabase } from '../../timer/src/lib/clipSala'
import type { GiaProvato } from './prove'
import { eGiaVenuto, nuovoId, pulisciProva } from './prove'

/**
 * Il tablet con il database vero: una chiamata per funzione di
 * `supabase/04-tablet.sql`, e niente altro.
 *
 * Il tablet non legge le tabelle: iscrizioni, presenze e anagrafica gli sono
 * chiuse dalle policy, e quello che gli serve lo danno le funzioni già
 * ritagliato (il nome e l'iniziale, mai il cognome). Qui non c'è la coda delle
 * scritture offline dell'appello: chi tocca il suo nome deve sapere subito se
 * è andata, e l'esito («già segnato», «l'ha già segnato l'istruttore») lo sa
 * solo il server.
 */

/** Il messaggio del server, che è già in italiano e dice cosa non va. */
function guaio(e: { message?: string } | null): Error {
  return new Error(e?.message || 'Il server non risponde')
}

export function creaTabletSupabase(db: SupabaseClient): DatiTablet {
  const rpc = async <T>(nome: string, args: Record<string, unknown>): Promise<T> => {
    const { data, error } = await db.rpc(nome, args)
    if (error) throw guaio(error)
    return data as T
  }

  return {
    modo: 'supabase',
    adesso: () => new Date(),

    async postazione() {
      const { data: s } = await db.auth.getSession()
      if (!s.session) return null
      // La policy lascia a un tablet la sua riga e basta.
      const { data, error } = await db
        .from('postazioni')
        .select('nome, attiva, sale ( nome )')
        .eq('utente_id', s.session.user.id)
        .maybeSingle()
      if (error) throw guaio(error)
      const riga = data as { nome: string; attiva: boolean; sale: { nome: string } | null } | null
      if (!riga || !riga.attiva) return null
      return { nome: riga.nome, sala: riga.sale?.nome ?? '' }
    },

    async scollega() {
      await db.auth.signOut()
    },

    async lezioni(da, a) {
      await allungaCalendario(db)
      const righe = await rpc<Array<{
        id: string; corso_id: string; corso: string; colore: string | null; descrizione: string | null
        istruttori: string | null; inizio: string; fine: string; stato: StatoSessione; iscritti: number; presenti: number
      }>>('lezioni_sala', { da_giorno: chiaveGiorno(da), a_giorno: chiaveGiorno(a) })
      return (righe ?? []).map((r): LezioneSala => ({
        id: r.id,
        corsoId: r.corso_id,
        corso: r.corso,
        colore: r.colore ?? undefined,
        descrizione: r.descrizione ?? undefined,
        istruttori: r.istruttori ?? undefined,
        inizio: r.inizio,
        fine: r.fine,
        stato: r.stato,
        iscritti: r.iscritti,
        presenti: r.presenti,
      }))
    },

    async elenco(sessioneId) {
      const righe = await rpc<Array<{ persona_id: string; nome: string; sigla: string; segnato: boolean }>>('elenco_sala', {
        sessione: sessioneId,
      })
      return (righe ?? []).map((r): NomeSala => ({ personaId: r.persona_id, nome: r.nome, sigla: r.sigla, segnato: r.segnato }))
    },

    segna: (sessioneId, personaId) => rpc<EsitoTocco>('segna_dal_tablet', { sessione: sessioneId, persona: personaId }),

    annulla: (sessioneId, personaId) => rpc<boolean>('annulla_dal_tablet', { sessione: sessioneId, persona: personaId }),

    async entraConPin(pin) {
      const righe = await rpc<Array<{ persona_id: string; nome: string }>>('entra_con_pin', { pin })
      const r = righe?.[0]
      if (!r) return null
      // La presenza dell'istruttore: se non si segna (la rete, o il database
      // senza 15-presenze-istruttori.sql) l'area istruttore si apre lo stesso.
      let presenze: PresenzaIstruttore[] = []
      try {
        const segnate = await rpc<Array<{ sessione_id: string; corso: string; stato: StatoPresenzaIstruttore }>>('presenza_con_pin', { pin })
        presenze = (segnate ?? []).map((x) => ({ sessioneId: x.sessione_id, corso: x.corso, stato: x.stato }))
      } catch {
        // Resta da segnare a mano in segreteria.
      }
      return { personaId: r.persona_id, nome: r.nome, presenze }
    },

    async verificaPin(pin) {
      const righe = await rpc<Array<{ persona_id: string; nome: string }>>('entra_con_pin', { pin })
      const r = righe?.[0]
      return r ? { personaId: r.persona_id, nome: r.nome } : null
    },

    async appello(pin, sessioneId) {
      type Riga = { persona_id: string; nome: string; cognome: string; stato: StatoPresenza | null; origine: Origine | null }
      const righe = await rpc<Riga[]>('appello_con_pin', { pin, sessione: sessioneId })
      // Le prove dopo gli iscritti. Senza 21-prove.sql non ce ne sono, e
      // l'appello resta quello di prima.
      let prove: Riga[] = []
      try {
        prove = (await rpc<Riga[]>('prove_con_pin', { pin, sessione: sessioneId })) ?? []
      } catch {
        // Niente prove: il tasto PROVE dice perché.
      }
      const iscritti = new Set((righe ?? []).map((r) => r.persona_id))
      const riga = (prova: boolean) => (r: Riga): RigaAppelloTablet => ({
        personaId: r.persona_id,
        nome: r.nome,
        cognome: r.cognome,
        stato: r.stato,
        origine: r.origine,
        ...(prova ? { prova } : {}),
      })
      return [...(righe ?? []).map(riga(false)), ...prove.filter((r) => !iscritti.has(r.persona_id)).map(riga(true))]
    },

    correggi: (pin, sessioneId, personaId, stato, prova) =>
      rpc<boolean>(prova ? 'segna_prova_con_pin' : 'segna_con_pin', { pin, sessione: sessioneId, persona: personaId, stato }),

    async provati(pin) {
      const { data, error } = await db.rpc('provati_con_pin', { pin })
      if (error) {
        throw new Error(error.code === 'PGRST202' ? 'Le prove non sono ancora attive: va lanciato supabase/21-prove.sql.' : error.message || 'Il server non risponde')
      }
      const righe = (data ?? []) as Array<{ persona_id: string; nome: string; cognome: string; corso: string; inizio: string }>
      // Un PIN che non va più non solleva e non restituisce nessuno: se ne
      // accorge l'aggiunta, che dice `false`.
      return righe
        .map((r): GiaProvato => ({ id: r.persona_id, nome: r.nome, cognome: r.cognome, corso: r.corso, inizio: r.inizio }))
        .sort((x, y) => y.inizio.localeCompare(x.inizio))
    },

    // Senza coda, come il resto del tablet: chi aggiunge deve sapere se è andata.
    aggiungiProva(pin, sessioneId, chi) {
      const n = eGiaVenuto(chi) ? null : pulisciProva(chi)
      return rpc<boolean>('aggiungi_prova_con_pin', {
        pin,
        sessione: sessioneId,
        persona: eGiaVenuto(chi) ? chi.id : nuovoId(),
        nome: n?.nome ?? null,
        cognome: n?.cognome ?? null,
        telefono: n?.telefono ?? null,
      })
    },

    togliProva: (pin, sessioneId, personaId) => rpc<boolean>('togli_prova_con_pin', { pin, sessione: sessioneId, persona: personaId }),

    async musica() {
      const righe = await rpc<Array<{ id: string; nome: string; link: string; sala_id: string | null }>>('musica_sala', {})
      return (righe ?? []).map((r) => ({ id: r.id, nome: r.nome, link: r.link, salaId: r.sala_id }))
    },

    // La riga delle impostazioni la legge chiunque abbia un accesso (05-segreteria.sql),
    // e le clip pure (13-voce-esercizi.sql).
    timerSala: () => leggiTimerSala(db),
    // La riga la cambia solo la segreteria: il tablet passa da `salva_timer_sala`
    // (14-timer-dal-tablet.sql), che gli lascia toccare il timer e basta.
    salvaTimerSala: (i) => salvaTimerSala(db, i),
    clipSala: () => fonteClipSupabase(db),
  }
}
