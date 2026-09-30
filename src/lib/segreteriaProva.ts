import type { CorsoSeg, DatiSegreteria, FileSeg, LezioneSeg, PersonaSeg, PersonaleSeg, PresenzaIstruttoreSeg, RigaRegistro, StoricoSeg } from './segreteria'
import { insegna, type RuoloPersonale } from './ruoli'
import { ESTENSIONI, MASSIMO_FILE } from './richieste'
import { archivio, idRicorrenza, nomeDi, STAGIONE, type LezioneProva } from './archivioProva'
import { comeE, iscrittiIl, lezioniFra, nomeIstruttore, salaDelGiorno, trovaLezione, type LezioneTrovata } from './datiProva'
import { memoria } from './datiProva'
import { chiaveGiorno } from './sala'
import { PIN_PROVA } from './tabletProva'
import { richiesteDi } from './richiesteProva'
import { fonteDelLink, MAX_NOME_LISTA } from './musica'
import { eserciziDellaPalestra, voceDellaSala } from '../../timer/src/lib/impostazioniSala'
import { chiaveValida } from '../../timer/src/lib/clipSala'
import { loadHistory } from '../../timer/src/lib/storage'
import { clipProva } from './voceProva'
import { conti as contiRicevuta, cosaNonVa, ENTE_PREDEFINITO, intestatarioDaRichiesta, pulisciIntestatario, type Ricevuta } from './ricevute'

/**
 * La segreteria senza server: cambia l'archivio di prova sul dispositivo.
 *
 * Fa quello che fa il database, dove si può: un corso (o un suo giorno) che
 * cambia sala porta con sé le lezioni che non erano state spostate a mano,
 * togliere un giorno lo chiude a ieri invece di cancellarlo, archiviare un
 * corso lo toglie dal calendario. Una differenza: qui le lezioni non sono salvate una per una, si
 * calcolano dalle ricorrenze, quindi «rigenera» non ha niente da fare.
 */

const GIORNO = 24 * 60 * 60_000

/**
 * Un pezzo di id che non si ripete. L'ora da sola non basta: un import crea
 * dieci persone nello stesso millisecondo, e con lo stesso id diventavano una.
 */
/** Il ruolo da salvare, come `ruoloDaScrivere` di `segreteriaSupabase.ts`: il ruolo doppio solo se c'è in `r`. */
const ruoloDi = (r: RuoloPersonale) =>
  r.ancheIstruttore === undefined ? { ruolo: r.ruolo } : { ruolo: r.ruolo, ancheIstruttore: r.ruolo === 'staff' && r.ancheIstruttore }
const unico = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

/**
 * I file dei certificati: come quelli delle richieste, restano solo finché la
 * pagina è aperta, perché `localStorage` non li tiene. In archivio resta che
 * il file c'era.
 */
const certificati = new Map<string, FileSeg>()

export function creaSegreteriaProva(): DatiSegreteria {
  const a = () => archivio.dati
  const oggi = () => chiaveGiorno(new Date())
  const ieri = () => chiaveGiorno(new Date(Date.now() - GIORNO))
  const salva = () => archivio.salva()

  const corso = (id: string) => {
    const c = a().corsi.find((x) => x.id === id)
    if (!c) throw new Error('Corso inesistente')
    return c
  }
  const persona = (id: string) => {
    const p = a().persone.find((x) => x.id === id)
    if (!p) throw new Error('Persona inesistente')
    return p
  }
  const cambiaLezione = (id: string, f: (l: LezioneProva) => LezioneProva | null) => {
    const nuova = f({ ...(a().lezioni[id] ?? {}) })
    const lezioni = { ...a().lezioni }
    if (nuova && Object.keys(nuova).length) lezioni[id] = nuova
    else delete lezioni[id]
    a().lezioni = lezioni
  }

  /** Le presenze più vecchie del periodo scelto in REGOLE: coppie lezione, persona. */
  const scadute = () => {
    const mesi = a().impostazioni?.mesiPresenze ?? 24
    const limite = new Date()
    limite.setMonth(limite.getMonth() - mesi)
    return Object.entries(memoria.segnate).flatMap(([id, segni]) => {
      const l = trovaLezione(id)
      return l && l.inizio < limite ? Object.keys(segni).map((p) => [id, p] as const) : []
    })
  }

  const conti = (id: string) => {
    const segni = Object.values(memoria.segnate[id] ?? {})
    return { presenti: segni.filter((s) => s === 'presente').length, segnati: segni.length }
  }

  const vista = (l: LezioneTrovata): LezioneSeg => {
    const k = comeE(l)
    return {
      id: l.id,
      corsoId: l.corso.id,
      corso: l.corso.nome,
      colore: l.corso.colore,
      salaId: k.sala,
      sala: k.sala,
      sostitutoId: k.sostituto,
      istruttori: k.istruttori.map(nomeIstruttore).join(', '),
      inizio: l.inizio.toISOString(),
      fine: l.fine.toISOString(),
      stato: k.stato,
      straordinaria: l.straordinaria,
      iscritti: iscrittiIl(l.corso.id, chiaveGiorno(l.inizio)).length,
      capienza: l.corso.capienza,
      ...conti(l.id),
    }
  }

  return {
    modo: 'prova',

    async sale() {
      return a().sale.map((nome) => ({ id: nome, nome, capienza: a().capienzaSale?.[nome] }))
    },

    async istruttori() {
      return a()
        .persone.filter((p) => insegna(p) && p.attiva)
        .map((p) => ({ id: p.id, nome: nomeDi(p) }))
        .sort((x, y) => x.nome.localeCompare(y.nome, 'it'))
    },

    async settimana(da, fino) {
      return lezioniFra(da, fino).map(vista)
    },

    async aggiornaLezione(sessioneId, cambi) {
      const l = trovaLezione(sessioneId)
      if (!l) throw new Error('Lezione inesistente')
      cambiaLezione(sessioneId, (x) => {
        if (cambi.stato) x.stato = cambi.stato === 'prevista' ? undefined : cambi.stato
        // «Come da corso» vuol dire nessuna decisione a mano.
        if (cambi.sostitutoId !== undefined) x.istruttore = cambi.sostitutoId && !l.corso.istruttori.includes(cambi.sostitutoId) ? cambi.sostitutoId : undefined
        if (cambi.salaId !== undefined) x.sala = cambi.salaId && cambi.salaId !== salaDelGiorno(l) ? cambi.salaId : undefined
        for (const k of Object.keys(x) as Array<keyof LezioneProva>) if (x[k] === undefined) delete x[k]
        return x
      })
      salva()
    },

    async straordinaria(corsoId, inizio, durata) {
      corso(corsoId)
      const id = `x@${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
      cambiaLezione(id, () => ({ straordinaria: { corsoId, inizio: inizio.toISOString(), durata } }))
      salva()
    },

    async togliLezione(sessioneId) {
      if (!a().lezioni[sessioneId]?.straordinaria) throw new Error('Si tolgono solo le lezioni straordinarie: le altre si annullano')
      if (conti(sessioneId).segnati) throw new Error("Ha già un appello: si annulla invece di toglierla")
      cambiaLezione(sessioneId, () => null)
      salva()
    },

    async prontoFino() {
      const fini = a().corsi.filter((c) => c.attivo).flatMap((c) => c.ricorrenze.map((r) => r.al ?? STAGIONE.al))
      return fini.length ? fini.sort().at(-1)! : null
    },

    async rigenera() {
      return 0
    },

    async corsi() {
      const g = oggi()
      return a().corsi.map(
        (c): CorsoSeg => ({
          id: c.id,
          nome: c.nome,
          colore: c.colore,
          salaId: c.sala,
          sala: c.sala,
          istruttori: c.istruttori.map((id) => ({ id, nome: nomeIstruttore(id) })),
          capienza: c.capienza,
          attivo: c.attivo,
          ricorrenze: c.ricorrenze
            .filter((r) => !r.al || r.al >= g)
            .map(({ sala, ...r }) => ({ ...r, salaId: sala, sala }))
            .sort((x, y) => ((x.giorno + 6) % 7) - ((y.giorno + 6) % 7) || x.ora.localeCompare(y.ora)),
        }),
      )
    },

    async salvaCorso(dati) {
      if (!dati.nome.trim()) throw new Error('Il corso ha bisogno di un nome')
      if (!dati.id) {
        const base = dati.nome.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'corso'
        const id = a().corsi.some((c) => c.id === base) ? `${base}-${unico()}` : base
        a().corsi = [
          ...a().corsi,
          { id, nome: dati.nome.trim(), colore: dati.colore ?? '#1b8ac4', sala: dati.salaId ?? a().sale[0], istruttori: dati.istruttori, capienza: dati.capienza, attivo: true, ricorrenze: [] },
        ]
        salva()
        return id
      }
      const c = corso(dati.id)
      a().corsi = a().corsi.map((x) =>
        x.id === c.id
          ? {
              ...x,
              nome: dati.nome.trim(),
              sala: dati.salaId ?? x.sala,
              istruttori: dati.istruttori,
              capienza: dati.capienza,
              colore: dati.colore ?? x.colore,
              // Un giorno che ora sarebbe nella sala del corso torna a seguirlo, come nel database.
              ricorrenze: x.ricorrenze.map(({ sala, ...r }) => (sala && sala !== (dati.salaId ?? x.sala) ? { ...r, sala } : r)),
            }
          : x,
      )
      // Le lezioni che erano state spostate proprio nella sala in cui ora
      // andrebbero da sé, o date a chi ora insegna il corso, tornano «come da corso».
      for (const [id, l] of Object.entries(a().lezioni)) {
        if (!id.startsWith(`s@${c.id}@`) && l.straordinaria?.corsoId !== c.id) continue
        const t = trovaLezione(id)
        cambiaLezione(id, (x) => {
          if (t && x.sala === salaDelGiorno(t)) delete x.sala
          if (x.istruttore && dati.istruttori.includes(x.istruttore)) delete x.istruttore
          return x
        })
      }
      salva()
      return c.id
    },

    async archiviaCorso(corsoId, attivo) {
      corso(corsoId)
      a().corsi = a().corsi.map((c) => (c.id === corsoId ? { ...c, attivo } : c))
      salva()
    },

    async aggiungiRicorrenza(corsoId, r, _opzioni) {
      const c = corso(corsoId)
      if (c.ricorrenze.some((x) => x.giorno === r.giorno && x.ora === r.ora && (!x.al || x.al >= oggi()))) {
        throw new Error('Questo corso ha già una lezione quel giorno a quell’ora')
      }
      const base = idRicorrenza(c.id, r.giorno, r.ora)
      const id = c.ricorrenze.some((x) => x.id === base) ? `${base}~${unico()}` : base
      const dal = oggi() > STAGIONE.dal ? oggi() : STAGIONE.dal
      const nuova = { id, giorno: r.giorno, ora: r.ora, durata: r.durata, dal, al: STAGIONE.al, ...(r.salaId && r.salaId !== c.sala ? { sala: r.salaId } : {}) }
      a().corsi = a().corsi.map((x) => (x.id === c.id ? { ...x, ricorrenze: [...x.ricorrenze, nuova] } : x))
      salva()
    },

    async salaRicorrenza(ricorrenzaId, salaId) {
      const c = a().corsi.find((x) => x.ricorrenze.some((r) => r.id === ricorrenzaId))
      if (!c) throw new Error('Ricorrenza inesistente')
      if (salaId && !a().sale.includes(salaId)) throw new Error('Sala inesistente')
      // La sala del corso non si scrive sul giorno: così, se il corso cambia sala, il giorno lo segue.
      const sala = salaId && salaId !== c.sala ? salaId : undefined
      a().corsi = a().corsi.map((x) =>
        x.id !== c.id
          ? x
          : {
              ...x,
              ricorrenze: x.ricorrenze.map((r) => {
                if (r.id !== ricorrenzaId) return r
                const { sala: _vecchia, ...resto } = r
                return sala ? { ...resto, sala } : resto
              }),
            },
      )
      // Le lezioni future spostate a mano proprio nella sala nuova non sono più un'eccezione.
      const adesso = Date.now()
      for (const id of Object.keys(a().lezioni)) {
        const t = id.startsWith(`s@${c.id}@`) ? trovaLezione(id) : null
        if (!t || t.ricorrenza?.id !== ricorrenzaId || t.inizio.getTime() <= adesso) continue
        cambiaLezione(id, (x) => {
          if (x.sala === salaDelGiorno(t)) delete x.sala
          return x
        })
      }
      salva()
    },

    async togliRicorrenza(ricorrenzaId) {
      const c = a().corsi.find((x) => x.ricorrenze.some((r) => r.id === ricorrenzaId))
      if (!c) throw new Error('Ricorrenza inesistente')
      const g = oggi()
      a().corsi = a().corsi.map((x) =>
        x.id !== c.id
          ? x
          : {
              ...x,
              ricorrenze: x.ricorrenze
                // Non ancora cominciata: sparisce. Cominciata: si chiude a ieri.
                .filter((r) => r.id !== ricorrenzaId || r.dal < g)
                .map((r) => (r.id === ricorrenzaId ? { ...r, al: ieri() < r.dal ? r.dal : ieri() } : r)),
            },
      )
      salva()
    },

    async persone() {
      return a()
        .persone.filter((p) => p.ruolo === 'iscritto')
        .map(
          (p): PersonaSeg => ({
            id: p.id,
            nome: p.nome,
            cognome: p.cognome,
            email: p.email,
            telefono: p.telefono,
            attiva: p.attiva,
            creataIl: p.creataIl,
            iscrizioni: a()
              .iscrizioni.filter((i) => i.personaId === p.id)
              .map((i) => ({ corsoId: i.corsoId, dal: i.dal, al: i.al })),
            certificato: { scade: p.certificato?.scade, conFile: !!p.certificato?.file },
            pagamento: { stato: p.pagamento?.stato ?? 'da_pagare', fino: p.pagamento?.fino, nota: p.pagamento?.nota },
          }),
        )
    },

    async frequenze() {
      const adesso = Date.now()
      const f = new Map<string, { presenti: number; dovute: number }>()
      for (const l of lezioniFra(new Date(adesso - 30 * GIORNO), new Date(adesso))) {
        if (l.inizio.getTime() >= adesso || comeE(l).stato === 'annullata') continue
        const segni = memoria.segnate[l.id] ?? {}
        for (const p of iscrittiIl(l.corso.id, chiaveGiorno(l.inizio))) {
          const s = segni[p.id]
          if (s === 'giustificato') continue
          const x = f.get(p.id) ?? { presenti: 0, dovute: 0 }
          x.dovute++
          if (s === 'presente') x.presenti++
          f.set(p.id, x)
        }
      }
      return f
    },

    async storico(personaId, quante) {
      const adesso = Date.now()
      const corsi = new Set(a().iscrizioni.filter((i) => i.personaId === personaId).map((i) => i.corsoId))
      const x: StoricoSeg[] = []
      for (const l of lezioniFra(new Date(adesso - 120 * GIORNO), new Date(adesso))) {
        if (!corsi.has(l.corso.id) || l.inizio.getTime() >= adesso || comeE(l).stato === 'annullata') continue
        if (!iscrittiIl(l.corso.id, chiaveGiorno(l.inizio)).some((p) => p.id === personaId)) continue
        x.push({ sessioneId: l.id, inizio: l.inizio.toISOString(), corso: l.corso.nome, stato: memoria.segnate[l.id]?.[personaId] ?? null })
      }
      return x.slice(-quante)
    },

    async salvaPersona(dati) {
      const nome = dati.nome.trim()
      const cognome = dati.cognome.trim()
      if (!nome || !cognome) throw new Error('Servono nome e cognome')
      const email = dati.email?.trim() || undefined
      const telefono = dati.telefono?.trim() || undefined
      // Come l'indice unico del database: due persone, due email.
      const altro = email && a().persone.find((p) => p.id !== dati.id && p.email?.toLowerCase() === email.toLowerCase())
      if (altro) throw new Error(`Questa email è già di ${nomeDi(altro)}`)
      if (!dati.id) {
        const id = `p-nuovo-${unico()}`
        a().persone = [...a().persone, { id, nome, cognome, email, telefono, ruolo: 'iscritto', attiva: true, creataIl: oggi() }]
        salva()
        return id
      }
      persona(dati.id)
      a().persone = a().persone.map((p) => (p.id === dati.id ? { ...p, nome, cognome, email, telefono } : p))
      salva()
      return dati.id
    },

    async attivaPersona(personaId, attiva) {
      persona(personaId)
      a().persone = a().persone.map((p) => (p.id === personaId ? { ...p, attiva } : p))
      salva()
    },

    async salvaCertificato(personaId, scade, file) {
      persona(personaId)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(scade)) throw new Error('Serve la data di scadenza del certificato')
      let nome: string | undefined
      if (file) {
        const est = ESTENSIONI[file.type]
        if (!est) throw new Error('Questo tipo di file non va: serve una foto o un PDF')
        if (file.size > MASSIMO_FILE) throw new Error('Il file è troppo grande: al massimo 10 MB')
        nome = `certificato-${Date.now()}.${est}`
        const vecchio = certificati.get(personaId)
        if (vecchio && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(vecchio.url)
        const url = typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : ''
        if (url) certificati.set(personaId, { url, pdf: est === 'pdf' })
      }
      a().persone = a().persone.map((p) => (p.id === personaId ? { ...p, certificato: { scade, file: nome ?? p.certificato?.file } } : p))
      salva()
    },

    async togliCertificato(personaId) {
      persona(personaId)
      const vecchio = certificati.get(personaId)
      if (vecchio && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(vecchio.url)
      certificati.delete(personaId)
      a().persone = a().persone.map((p) => (p.id === personaId ? { ...p, certificato: undefined } : p))
      salva()
    },

    async apriCertificato(personaId) {
      persona(personaId)
      return certificati.get(personaId) ?? null
    },

    async salvaPagamento(personaId, dati) {
      persona(personaId)
      const nota = dati.nota?.trim() || undefined
      if (nota && nota.length > 300) throw new Error('La nota del pagamento è troppo lunga: al massimo 300 caratteri')
      a().persone = a().persone.map((p) => (p.id === personaId ? { ...p, pagamento: { stato: dati.stato, fino: dati.fino || undefined, nota } } : p))
      salva()
    },

    async ricevute(personaId) {
      return (a().ricevute ?? [])
        .filter((r) => !personaId || r.personaId === personaId)
        .sort((x, y) => y.data.localeCompare(x.data) || y.anno - x.anno || y.numero - x.numero)
    },

    async prossimoNumero(anno) {
      return Math.max(0, ...(a().ricevute ?? []).filter((r) => r.anno === anno).map((r) => r.numero)) + 1
    },

    async intestatarioDi(personaId) {
      const p = persona(personaId)
      const ultima = (a().ricevute ?? []).filter((r) => r.personaId === personaId).sort((x, y) => y.creataIl.localeCompare(x.creataIl))[0]
      if (ultima) return { ...ultima.intestatario, nome: p.nome, cognome: p.cognome }
      const richiesta = richiesteDi(personaId)
        .filter((r) => r.stato === 'accolta')
        .sort((x, y) => (y.gestitaIl ?? y.creataIl).localeCompare(x.gestitaIl ?? x.creataIl))[0]
      if (richiesta) return intestatarioDaRichiesta(richiesta)
      const an = a().anagrafiche?.[personaId]
      return an ? intestatarioDaRichiesta({ ...an, nome: p.nome, cognome: p.cognome }) : { nome: p.nome, cognome: p.cognome }
    },

    async anagraficaDi(personaId) {
      persona(personaId)
      const richiesta = richiesteDi(personaId)
        .filter((r) => r.stato === 'accolta')
        .sort((x, y) => (y.gestitaIl ?? y.creataIl).localeCompare(x.gestitaIl ?? x.creataIl))[0]
      if (richiesta) {
        const { natoIl, natoA, codiceFiscale, indirizzo, cap, comune, genitoreNome, genitoreCognome, genitoreCodiceFiscale } = richiesta
        const dati = Object.fromEntries(
          Object.entries({ natoIl, natoA, codiceFiscale, indirizzo, cap, comune, genitoreNome, genitoreCognome, genitoreCodiceFiscale }).filter(([, v]) => v),
        )
        return { dati, da: 'modulo' }
      }
      const an = a().anagrafiche?.[personaId]
      return an && Object.keys(an).length ? { dati: { ...an }, da: 'import' } : null
    },

    async salvaAnagrafica(personaId, dati) {
      persona(personaId)
      const nuovi = Object.fromEntries(Object.entries(dati).flatMap(([k, v]) => (typeof v === 'string' && v.trim() ? [[k, v.trim()]] : [])))
      if (Object.keys(nuovi).length === 0) return
      a().anagrafiche = { ...a().anagrafiche, [personaId]: { ...a().anagrafiche?.[personaId], ...nuovi } }
      salva()
    },

    async emettiRicevuta(dati) {
      if (dati.personaId) persona(dati.personaId)
      const r = { ...dati, intestatario: pulisciIntestatario(dati.intestatario), note: dati.note?.trim() || undefined }
      const no = cosaNonVa(r)
      if (no) throw new Error(no)
      if (r.note && r.note.length > 500) throw new Error('La nota è troppo lunga: al massimo 500 caratteri')
      const anno = Number(r.data.slice(0, 4))
      const tutte = a().ricevute ?? []
      // Come `emetti_ricevuta`: il numero dato, se è libero; se no il primo dopo l'ultimo.
      if (r.numero && tutte.some((x) => x.anno === anno && x.numero === r.numero))
        throw new Error(`La ricevuta numero ${r.numero} del ${anno} c’è già: lascia il numero vuoto per il primo libero`)
      const numero = r.numero ?? Math.max(0, ...tutte.filter((x) => x.anno === anno).map((x) => x.numero)) + 1
      const voci = r.voci.map((v) => ({ ...v, descrizione: v.descrizione.trim(), pagamenti: v.pagamenti.filter((p) => p.importo > 0) }))
      const c = contiRicevuta({ voci, anticipo: r.anticipo })
      const { numero: _n, ...resto } = r
      const nuova: Ricevuta = { ...resto, voci, id: `r-${unico()}`, anno, numero, totale: c.totale, pagato: c.pagato, creataIl: new Date().toISOString() }
      a().ricevute = [...tutte, nuova]
      salva()
      return nuova
    },

    async annullaRicevuta(id) {
      const r = (a().ricevute ?? []).find((x) => x.id === id)
      if (!r || r.annullataIl) throw new Error('Ricevuta inesistente o già annullata')
      a().ricevute = (a().ricevute ?? []).map((x) => (x.id === id ? { ...x, annullataIl: new Date().toISOString() } : x))
      salva()
    },

    async enteRicevute() {
      return { ...ENTE_PREDEFINITO, ...(a().enteRicevute ?? {}) }
    },

    async salvaEnteRicevute(e) {
      a().enteRicevute = e
      salva()
    },

    async iscrivi(personaId, corsoId) {
      persona(personaId)
      corso(corsoId)
      const g = oggi()
      const c = a().iscrizioni.find((i) => i.personaId === personaId && i.corsoId === corsoId)
      if (c && !c.al) return
      // Terminata oggi o più avanti: si toglie solo la fine (vedi Supabase).
      if (c && c.al && c.al >= g) {
        a().iscrizioni = a().iscrizioni.map((i) => (i === c ? { ...i, al: undefined } : i))
        salva()
        return
      }
      // Una sola iscrizione per corso, come nel database: chi torna riparte da oggi.
      a().iscrizioni = [...a().iscrizioni.filter((i) => i !== c), { corsoId, personaId, dal: g }]
      salva()
    },

    async termina(personaId, corsoId) {
      const g = oggi()
      a().iscrizioni = a().iscrizioni.map((i) =>
        i.personaId === personaId && i.corsoId === corsoId ? { ...i, al: i.dal > g ? i.dal : g } : i,
      )
      salva()
    },
    async registro(da, fino) {
      const adesso = Date.now()
      return lezioniFra(da, fino)
        .filter((l) => l.inizio.getTime() < adesso)
        .map((l): RigaRegistro => {
          const k = comeE(l)
          const segni = memoria.segnate[l.id] ?? {}
          return {
            sessioneId: l.id,
            corsoId: l.corso.id,
            corso: l.corso.nome,
            sala: k.sala,
            istruttori: k.istruttori.map(nomeIstruttore).join(', '),
            inizio: l.inizio.toISOString(),
            stato: k.stato,
            appello: iscrittiIl(l.corso.id, chiaveGiorno(l.inizio)).map((p) => ({ personaId: p.id, nome: p.nome, cognome: p.cognome, stato: segni[p.id] ?? null })),
          }
        })
    },

    async personale() {
      const pin = { ...Object.fromEntries(Object.values(PIN_PROVA).map((x) => [x.personaId, true])), ...a().pin }
      return a()
        .persone.filter((p) => p.ruolo !== 'iscritto')
        .map(
          (p): PersonaleSeg => ({
            id: p.id,
            nome: p.nome,
            cognome: p.cognome,
            email: p.email,
            ruolo: p.ruolo as 'istruttore' | 'staff',
            ancheIstruttore: p.ruolo === 'staff' && !!p.ancheIstruttore,
            attiva: p.attiva,
            // In prova è entrata solo la segreteria di prova: gli altri aspettano l'invito.
            collegato: p.id === 's-prova',
            haPin: !!pin[p.id],
            corsi: a().corsi.filter((c) => c.attivo && c.istruttori.includes(p.id)).map((c) => c.nome),
          }),
        )
    },

    async salvaPersonale(dati) {
      const nome = dati.nome.trim()
      const cognome = dati.cognome.trim()
      const email = dati.email?.trim() || undefined
      if (!nome) throw new Error('Serve almeno il nome')
      const altro = email && a().persone.find((p) => p.id !== dati.id && p.email?.toLowerCase() === email.toLowerCase())
      // Come nel database: un'iscritta con la stessa email diventa personale, non un doppione.
      if (altro && altro.ruolo !== 'iscritto') throw new Error(`Questa email è già di ${nomeDi(altro)}`)
      if (altro) {
        a().persone = a().persone.map((p) => (p.id === altro.id ? { ...p, ...ruoloDi(dati), attiva: true } : p))
        salva()
        return altro.id
      }
      // Già in elenco senza email (dall'import, per esempio): gliela si dà, invece di rifarla.
      const senza = !dati.id && a().persone.find((p) => p.ruolo !== 'iscritto' && !p.email && p.nome.toLowerCase() === nome.toLowerCase() && p.cognome.toLowerCase() === cognome.toLowerCase())
      if (senza) {
        a().persone = a().persone.map((p) => (p.id === senza.id ? { ...p, email, ...ruoloDi(dati), attiva: true } : p))
        salva()
        return senza.id
      }
      if (!dati.id) {
        const id = `i-${nome.toLowerCase().normalize('NFD').replace(/[^a-z]+/g, '')}-${unico()}`
        a().persone = [...a().persone, { id, nome, cognome, email, ...ruoloDi(dati), attiva: true, creataIl: oggi() }]
        salva()
        return id
      }
      persona(dati.id)
      a().persone = a().persone.map((p) => (p.id === dati.id ? { ...p, nome, cognome, email, ...ruoloDi(dati) } : p))
      salva()
      return dati.id
    },

    async impostaPin(personaId, pin) {
      if (!/^\d{4}$/.test(pin)) throw new Error('il PIN è di quattro cifre')
      const p = persona(personaId)
      if (p.ruolo === 'iscritto') throw new Error('il PIN è solo per istruttori e segreteria')
      const usati = { ...Object.fromEntries(Object.entries(PIN_PROVA).map(([k, v]) => [v.personaId, k])), ...a().pin }
      if (Object.entries(usati).some(([chi, x]) => chi !== personaId && x === pin)) throw new Error('questo PIN è già di un altro: scegline un altro')
      a().pin = { ...a().pin, [personaId]: pin }
      salva()
    },

    async invita(personaId) {
      // Come la funzione `invita`, ma nessuna email parte: in prova non c'è un server.
      const p = persona(personaId)
      if (p.ruolo === 'iscritto') throw new Error('Si invitano solo istruttori e segreteria')
      if (!p.attiva) throw new Error(`${p.nome} è senza accesso: prima va ridato`)
      if (!p.email) throw new Error(`${p.nome} non ha un’email`)
      if (p.id === 's-prova') throw new Error(`${p.nome} è già entrata: se ha perso la password, la chiede dalla porta con «password dimenticata»`)
      return 'invito'
    },

    async salvaSala(s) {
      const nome = s.nome.trim()
      if (!nome) throw new Error('La sala ha bisogno di un nome')
      if (a().sale.some((x) => x.toLowerCase() === nome.toLowerCase() && x !== s.id)) throw new Error('C’è già una sala con questo nome')
      const cap = { ...a().capienzaSale }
      if (s.id && s.id !== nome) {
        // Il nome è anche l'id, in prova: si rinomina ovunque.
        a().sale = a().sale.map((x) => (x === s.id ? nome : x))
        a().corsi = a().corsi.map((c) => ({
          ...c,
          sala: c.sala === s.id ? nome : c.sala,
          ricorrenze: c.ricorrenze.map((r) => (r.sala === s.id ? { ...r, sala: nome } : r)),
        }))
        a().lezioni = Object.fromEntries(Object.entries(a().lezioni).map(([k, l]) => [k, l.sala === s.id ? { ...l, sala: nome } : l]))
        a().musica = (a().musica ?? []).map((l) => (l.sala === s.id ? { ...l, sala: nome } : l))
        delete cap[s.id]
      } else if (!s.id) a().sale = [...a().sale, nome]
      if (s.capienza) cap[nome] = s.capienza
      else delete cap[nome]
      a().capienzaSale = cap
      salva()
      return nome
    },

    async listeMusica() {
      return (a().musica ?? []).map((l) => ({ id: l.id, nome: l.nome, link: l.link, salaId: l.sala }))
    },

    async salvaListaMusica(l) {
      const nome = l.nome.trim().slice(0, MAX_NOME_LISTA)
      const link = l.link.trim()
      if (!nome) throw new Error('La lista ha bisogno di un nome')
      if (!fonteDelLink(link)) throw new Error('Il link non è una playlist di YouTube o di Spotify')
      if (l.salaId && !a().sale.includes(l.salaId)) throw new Error('Sala inesistente')
      const id = l.id ?? `musica~${unico()}`
      const riga = { id, nome, link, sala: l.salaId }
      const prima = a().musica ?? []
      a().musica = l.id ? prima.map((x) => (x.id === l.id ? riga : x)) : [...prima, riga]
      salva()
      return id
    },

    async togliListaMusica(id) {
      a().musica = (a().musica ?? []).filter((x) => x.id !== id)
      salva()
    },

    async voceSale() {
      return voceDellaSala(a().voceSale)
    },

    async salvaVoceSale(nome) {
      a().voceSale = voceDellaSala(nome)
      salva()
    },

    clipSale: () => clipProva.list(),

    async salvaClip(chiave, clip) {
      if (!chiaveValida(chiave)) throw new Error('Questa frase non si può incidere')
      if ((await clipProva.put(chiave, clip)) === null) throw new Error('Questo browser non tiene le clip: in prova servono i dati del sito')
    },

    apriClip: (chiave) => clipProva.get(chiave),

    async togliClip(chiave) {
      await clipProva.delete(chiave)
    },

    async eserciziPalestra() {
      return eserciziDellaPalestra(a().eserciziSale)
    },

    async salvaEserciziPalestra(l) {
      a().eserciziSale = (eserciziDellaPalestra(l) ?? []).map(({ id, nome, categoria }) => ({ id, nome, categoria }))
      salva()
    },

    // In prova lo storico è quello del timer su questo dispositivo: il tablet
    // di prova non ha un server a cui mandarlo.
    async presenzeIstruttori(giorni) {
      const da = new Date(Date.now() - giorni * GIORNO).toISOString()
      return (a().presenzeIstruttori ?? [])
        .filter((x) => x.stato === 'da_confermare' || x.entratoIl >= da)
        .flatMap((x): PresenzaIstruttoreSeg[] => {
          const l = trovaLezione(x.sessioneId)
          if (!l) return []
          const chi = a().persone.find((p) => p.id === x.personaId)
          return [
            {
              id: x.id,
              sessioneId: x.sessioneId,
              corso: l.corso.nome,
              colore: l.corso.colore,
              inizio: l.inizio.toISOString(),
              fine: l.fine.toISOString(),
              personaId: x.personaId,
              nome: chi ? nomeDi(chi) : '—',
              previsti: comeE(l).istruttori.map(nomeIstruttore).join(', '),
              sala: x.sala,
              stato: x.stato,
              prevista: x.prevista,
              entratoIl: x.entratoIl,
              gestitaIl: x.gestitaIl,
              gestitaDa: x.gestitaDa,
            },
          ]
        })
        .sort((x, y) => y.entratoIl.localeCompare(x.entratoIl))
    },

    async gestisciPresenzaIstruttore(id, conferma) {
      const tutte = a().presenzeIstruttori ?? []
      if (!tutte.some((x) => x.id === id)) throw new Error('presenza inesistente')
      // In prova chi usa la segreteria è la segreteria di prova.
      a().presenzeIstruttori = tutte.map((x) =>
        x.id === id ? { ...x, stato: conferma ? 'confermata' : 'rifiutata', gestitaDa: 'Segreteria di prova', gestitaIl: new Date().toISOString() } : x,
      )
      salva()
    },

    async allenamenti(quanti) {
      return loadHistory()
        .slice()
        .sort((x, y) => y.finishedAt - x.finishedAt)
        .slice(0, quanti)
        .map((h) => ({
          id: h.id,
          nome: h.workoutName,
          finitoIl: new Date(h.finishedAt).toISOString(),
          secondi: h.seconds,
          completato: h.completed,
          chi: 'Questo dispositivo',
        }))
    },

    async impostazioni() {
      return a().impostazioni ?? { mesiPresenze: 24, giorniCalendario: 60 }
    },

    async salvaImpostazioni(i) {
      a().impostazioni = { ...(a().impostazioni ?? { mesiPresenze: 24, giorniCalendario: 60 }), ...i }
      salva()
    },

    async scadute() {
      return scadute().length
    },

    async pulisci() {
      const via = scadute()
      const segnate = { ...memoria.segnate }
      for (const [sessione, persona] of via) {
        const mie = { ...segnate[sessione] }
        delete mie[persona]
        segnate[sessione] = mie
      }
      memoria.segnate = segnate
      memoria.salva()
      return via.length
    },

    async esporta(personaId) {
      const p = persona(personaId)
      const presenze = Object.entries(memoria.segnate).flatMap(([id, segni]) => {
        const stato = segni[personaId]
        const l = stato && trovaLezione(id)
        return l ? [{ lezione: l.corso.nome, inizio: l.inizio.toISOString(), stato, origine: memoria.origini[id]?.[personaId]?.da ?? 'appello' }] : []
      })
      return {
        esportato_il: new Date().toISOString(),
        persona: { nome: p.nome, cognome: p.cognome, email: p.email ?? null, telefono: p.telefono ?? null, attiva: p.attiva, in_elenco_dal: p.creataIl },
        iscrizioni: a().iscrizioni.filter((i) => i.personaId === personaId).map((i) => ({ corso: corso(i.corsoId).nome, dal: i.dal, al: i.al ?? null })),
        presenze: presenze.sort((x, y) => x.inizio.localeCompare(y.inizio)),
        richieste_di_iscrizione: richiesteDi(personaId).map(({ id: _id, personaId: _p, ...r }) => r),
        certificato_e_pagamento: { certificato_scade: p.certificato?.scade ?? null, certificato_file: p.certificato?.file ?? null, ...(p.pagamento ?? { stato: 'da_pagare' }) },
        ricevute: (a().ricevute ?? []).filter((r) => r.personaId === personaId).map(({ id: _id, personaId: _p, ...r }) => r),
        dati_anagrafici: a().anagrafiche?.[personaId] ?? null,
      }
    },
  }
}
