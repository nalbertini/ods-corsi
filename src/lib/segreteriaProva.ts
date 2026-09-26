import type { CorsoSeg, DatiSegreteria, LezioneSeg, PersonaSeg, PersonaleSeg, RigaRegistro, StoricoSeg } from './segreteria'
import { archivio, idRicorrenza, nomeDi, STAGIONE, type LezioneProva } from './archivioProva'
import { comeE, iscrittiIl, lezioniFra, nomeIstruttore, trovaLezione, type LezioneTrovata } from './datiProva'
import { memoria } from './datiProva'
import { chiaveGiorno, perCognome, perEsteso } from './sala'
import { PIN_PROVA } from './tabletProva'

/**
 * La segreteria senza server: cambia l'archivio di prova sul dispositivo.
 *
 * Fa quello che fa il database, dove si può: un corso che cambia sala porta
 * con sé le lezioni che non erano state spostate a mano, togliere un giorno
 * lo chiude a ieri invece di cancellarlo, archiviare un corso lo toglie dal
 * calendario. Una differenza: qui le lezioni non sono salvate una per una, si
 * calcolano dalle ricorrenze, quindi «rigenera» non ha niente da fare.
 */

const GIORNO = 24 * 60 * 60_000

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
        .persone.filter((p) => p.ruolo === 'istruttore' && p.attiva)
        .map((p) => ({ id: p.id, nome: nomeDi(p) }))
        .sort((x, y) => x.nome.localeCompare(y.nome, 'it'))
    },

    async settimana(da, fino) {
      return lezioniFra(da, fino).map(vista)
    },

    async iscrittiLezione(sessioneId) {
      const l = trovaLezione(sessioneId)
      return l ? iscrittiIl(l.corso.id, chiaveGiorno(l.inizio)).sort(perCognome).map(perEsteso) : []
    },

    async aggiornaLezione(sessioneId, cambi) {
      const l = trovaLezione(sessioneId)
      if (!l) throw new Error('Lezione inesistente')
      cambiaLezione(sessioneId, (x) => {
        if (cambi.stato) x.stato = cambi.stato === 'prevista' ? undefined : cambi.stato
        // «Come da corso» vuol dire nessuna decisione a mano.
        if (cambi.sostitutoId !== undefined) x.istruttore = cambi.sostitutoId && !l.corso.istruttori.includes(cambi.sostitutoId) ? cambi.sostitutoId : undefined
        if (cambi.salaId !== undefined) x.sala = cambi.salaId && cambi.salaId !== l.corso.sala ? cambi.salaId : undefined
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

    async tuttiPresenti(sessioneId) {
      const l = trovaLezione(sessioneId)
      if (!l) return
      const mie = { ...(memoria.segnate[sessioneId] ?? {}) }
      for (const p of iscrittiIl(l.corso.id, chiaveGiorno(l.inizio))) mie[p.id] = 'presente'
      memoria.segnate = { ...memoria.segnate, [sessioneId]: mie }
      memoria.origini = { ...memoria.origini, [sessioneId]: {} }
      memoria.salva()
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
            .sort((x, y) => ((x.giorno + 6) % 7) - ((y.giorno + 6) % 7) || x.ora.localeCompare(y.ora)),
        }),
      )
    },

    async salvaCorso(dati) {
      if (!dati.nome.trim()) throw new Error('Il corso ha bisogno di un nome')
      if (!dati.id) {
        const base = dati.nome.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'corso'
        const id = a().corsi.some((c) => c.id === base) ? `${base}-${Date.now().toString(36)}` : base
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
          ? { ...x, nome: dati.nome.trim(), sala: dati.salaId ?? x.sala, istruttori: dati.istruttori, capienza: dati.capienza, colore: dati.colore ?? x.colore }
          : x,
      )
      // Le lezioni che erano state spostate proprio nella sala nuova, o date
      // a chi ora insegna il corso, tornano «come da corso».
      for (const [id, l] of Object.entries(a().lezioni)) {
        if (!id.startsWith(`s@${c.id}@`) && l.straordinaria?.corsoId !== c.id) continue
        cambiaLezione(id, (x) => {
          if (x.sala === dati.salaId) delete x.sala
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
      const id = c.ricorrenze.some((x) => x.id === base) ? `${base}~${Date.now().toString(36)}` : base
      const dal = oggi() > STAGIONE.dal ? oggi() : STAGIONE.dal
      a().corsi = a().corsi.map((x) => (x.id === c.id ? { ...x, ricorrenze: [...x.ricorrenze, { id, ...r, dal, al: STAGIONE.al }] } : x))
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
        const id = `p-nuovo-${Date.now().toString(36)}`
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

    async iscrivi(personaId, corsoId) {
      persona(personaId)
      corso(corsoId)
      const g = oggi()
      const c = a().iscrizioni.find((i) => i.personaId === personaId && i.corsoId === corsoId)
      if (c && (!c.al || c.al >= g)) return
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
        a().persone = a().persone.map((p) => (p.id === altro.id ? { ...p, ruolo: dati.ruolo, attiva: true } : p))
        salva()
        return altro.id
      }
      // Già in elenco senza email (dall'import, per esempio): gliela si dà, invece di rifarla.
      const senza = !dati.id && a().persone.find((p) => p.ruolo !== 'iscritto' && !p.email && p.nome.toLowerCase() === nome.toLowerCase() && p.cognome.toLowerCase() === cognome.toLowerCase())
      if (senza) {
        a().persone = a().persone.map((p) => (p.id === senza.id ? { ...p, email, ruolo: dati.ruolo, attiva: true } : p))
        salva()
        return senza.id
      }
      if (!dati.id) {
        const id = `i-${nome.toLowerCase().normalize('NFD').replace(/[^a-z]+/g, '')}-${Date.now().toString(36)}`
        a().persone = [...a().persone, { id, nome, cognome, email, ruolo: dati.ruolo, attiva: true, creataIl: oggi() }]
        salva()
        return id
      }
      persona(dati.id)
      a().persone = a().persone.map((p) => (p.id === dati.id ? { ...p, nome, cognome, email, ruolo: dati.ruolo } : p))
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

    async salvaSala(s) {
      const nome = s.nome.trim()
      if (!nome) throw new Error('La sala ha bisogno di un nome')
      if (a().sale.some((x) => x.toLowerCase() === nome.toLowerCase() && x !== s.id)) throw new Error('C’è già una sala con questo nome')
      const cap = { ...a().capienzaSale }
      if (s.id && s.id !== nome) {
        // Il nome è anche l'id, in prova: si rinomina ovunque.
        a().sale = a().sale.map((x) => (x === s.id ? nome : x))
        a().corsi = a().corsi.map((c) => (c.sala === s.id ? { ...c, sala: nome } : c))
        a().lezioni = Object.fromEntries(Object.entries(a().lezioni).map(([k, l]) => [k, l.sala === s.id ? { ...l, sala: nome } : l]))
        delete cap[s.id]
      } else if (!s.id) a().sale = [...a().sale, nome]
      if (s.capienza) cap[nome] = s.capienza
      else delete cap[nome]
      a().capienzaSale = cap
      salva()
      return nome
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
      }
    },
  }
}
