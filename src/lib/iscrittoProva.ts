import type { AggiuntaNucleo, DatiIscritto, MiaLezione, MiaPresenza, SchedaIscritto } from './iscritto'
import { archivio, certificatiInAttesaProva, scordaInAttesa } from './archivioProva'
import { cosaNonVaFileMandato, ESTENSIONI_MANDATO } from './certificatoIscritto'
import { creaSegreteriaProva } from './segreteriaProva'
import { creaRichiesteProva, pagamentiSatispayProva, salvaSatispay } from './richiesteProva'
import { minorenne } from './richieste'
import { quoteDi } from './ricevute'
import { satispayPerPersona, saldoPerPersona } from './satispay'
import { LISTINO_PREDEFINITO, listinoDa, listinoProva } from './listino'
import { segnalaProva, segnalateDi } from './segnalateProva'
import { comeE, iscrittiIl, lezioniFra, memoria, nomeIstruttore, salaDelGiorno } from './datiProva'
import { chiaveGiorno, perCognome } from './sala'

/**
 * L'area degli iscritti senza server: legge l'archivio di prova, lo stesso
 * che cambiano la segreteria, l'appello e il tablet.
 *
 * Scrive solo le presenze segnalate (vedi `segnalateProva.ts`).
 *
 * Fa vedere a un iscritto solo quello che è suo, come faranno le funzioni
 * del database: le lezioni dei corsi a cui era iscritto quel giorno, i suoi
 * segni nell'appello, le sue ricevute. Il titolare di un nucleo familiare
 * vede anche le persone del suo nucleo (vedi `nucleo.ts`), una alla volta,
 * con le stesse chiamate: l'area chiede per ognuna.
 */

const GIORNO = 24 * 60 * 60_000

export function creaIscrittoProva(): DatiIscritto {
  const a = () => archivio.dati
  const persona = (id: string) => a().persone.find((p) => p.id === id && p.ruolo === 'iscritto' && p.attiva)
  /** Era iscritto a quel corso quel giorno: l'elenco dell'appello lo dice. */
  const suo = (personaId: string, corsoId: string, giorno: string) => iscrittiIl(corsoId, giorno).some((p) => p.id === personaId)

  const scheda = async (personaId: string): Promise<SchedaIscritto | null> => {
    const p = persona(personaId)
    if (!p) return null
    const oggi = chiaveGiorno(new Date())
    const corsi = a()
      .corsi.filter((c) => c.attivo && suo(personaId, c.id, oggi))
      .map((c) => ({ id: c.id, nome: c.nome, colore: c.colore }))
    return {
      id: p.id,
      nome: p.nome,
      cognome: p.cognome,
      corsi,
      certificato: { scade: p.certificato?.scade, inAttesaIl: p.certificato?.inAttesa?.il },
      // Senza `nota`, come col database: le note della segreteria non si vedono.
      pagamento: { stato: p.pagamento?.stato ?? 'da_pagare', fino: p.pagamento?.fino },
      quote: quoteDi((a().ricevute ?? []).filter((r) => r.personaId === p.id)),
      // Come la segreteria (`segreteriaProva`): quel che Satispay ha già incassato e non è ancora in una ricevuta.
      satispay: satispayPerPersona(pagamentiSatispayProva()).get(p.id),
      saldo: saldoPerPersona(pagamentiSatispayProva()).get(p.id),
      // Come la segreteria: l'età decide se il certificato serve.
      natoIl: (await creaSegreteriaProva().anagraficaDi(p.id))?.dati.natoIl,
      certificatoDaQui: true,
    }
  }
  const eTitolare = (personaId: string) => !!persona(personaId) && !persona(personaId)!.nucleo
  const nomeCorso = (id: string) => a().corsi.find((c) => c.id === id)?.nome ?? id

  return {
    modo: 'prova',

    async iscritti() {
      return a()
        .persone.filter((p) => p.ruolo === 'iscritto' && p.attiva)
        .map((p) => ({ id: p.id, nome: p.nome, cognome: p.cognome, ruolo: p.ruolo }))
        .sort(perCognome)
        .map(({ id, nome, cognome }) => ({ id, nome, cognome }))
    },

    async scheda(personaId) {
      return scheda(personaId)
    },

    async lezioni(personaId, da, fino) {
      if (!persona(personaId)) return []
      return lezioniFra(da, fino)
        .filter((l) => suo(personaId, l.corso.id, chiaveGiorno(l.inizio)))
        .map((l): MiaLezione => {
          const k = comeE(l)
          return {
            id: l.id,
            corso: l.corso.nome,
            colore: l.corso.colore,
            inizio: l.inizio.toISOString(),
            fine: l.fine.toISOString(),
            stato: k.stato,
            sala: k.sala,
            istruttore: k.istruttori.map(nomeIstruttore).join(', ') || undefined,
            sostituto: !!k.sostituto,
            altraSala: !l.straordinaria && k.sala !== salaDelGiorno(l),
            straordinaria: l.straordinaria,
          }
        })
    },

    async presenze(personaId, giorni) {
      if (!persona(personaId)) return []
      const adesso = Date.now()
      const x: MiaPresenza[] = []
      for (const l of lezioniFra(new Date(adesso - giorni * GIORNO), new Date(adesso))) {
        if (l.inizio.getTime() >= adesso || comeE(l).stato === 'annullata') continue
        if (!suo(personaId, l.corso.id, chiaveGiorno(l.inizio))) continue
        x.push({ sessioneId: l.id, inizio: l.inizio.toISOString(), corso: l.corso.nome, stato: memoria.segnate[l.id]?.[personaId] ?? null })
      }
      return x.reverse()
    },

    async ricevute(personaId) {
      if (!persona(personaId)) return []
      return (a().ricevute ?? [])
        .filter((r) => r.personaId === personaId)
        .sort((x, y) => y.data.localeCompare(x.data) || y.anno - x.anno || y.numero - x.numero)
    },

    async nucleo(personaId) {
      const io = await scheda(personaId)
      if (!io) return []
      if (!eTitolare(personaId)) return [io]
      const altri = (
        await Promise.all(
          a()
            .persone.filter((p) => p.nucleo === personaId && p.ruolo === 'iscritto' && p.attiva)
            .sort((x, y) => x.nome.localeCompare(y.nome, 'it'))
            .map((p) => scheda(p.id)),
        )
      ).filter((x): x is SchedaIscritto => !!x)
      return [io, ...altri]
    },

    async titolare(personaId) {
      return eTitolare(personaId)
    },

    async aggiunte(personaId) {
      if (!eTitolare(personaId)) return []
      const mese = Date.now() - 30 * GIORNO
      return (await creaRichiesteProva().richieste())
        .filter((r) => r.nucleoDi === personaId && (r.stato === 'nuova' || (r.stato === 'rifiutata' && new Date(r.gestitaIl ?? r.creataIl).getTime() > mese)))
        .map(
          (r): AggiuntaNucleo => ({
            id: r.id,
            nome: r.nome,
            cognome: r.cognome,
            corsi: r.corsi.map(nomeCorso),
            creataIl: r.creataIl,
            stato: r.stato as AggiuntaNucleo['stato'],
          }),
        )
    },

    async datiDelNucleo(personaId) {
      const p = persona(personaId)
      if (!p || !eTitolare(personaId)) return {}
      const an = (await creaSegreteriaProva().anagraficaDi(personaId))?.dati ?? {}
      // Da genitore solo se è maggiorenne, o se non si sa quando è nato.
      const adulto = !an.natoIl || !minorenne(an.natoIl)
      return {
        cognome: p.cognome,
        indirizzo: an.indirizzo ?? '',
        cap: an.cap ?? '',
        comune: an.comune ?? '',
        email: p.email ?? '',
        telefono: p.telefono ?? '',
        ...(adulto ? { genitoreNome: p.nome, genitoreCognome: p.cognome, genitoreCodiceFiscale: an.codiceFiscale ?? '' } : {}),
        nucleoDi: personaId,
      }
    },

    async segnala(personaId, sessioneId, nota) {
      if (!persona(personaId)) throw new Error('Questa persona non è più fra gli iscritti')
      segnalaProva(personaId, sessioneId, nota)
    },

    async segnalate(personaId) {
      return persona(personaId) ? segnalateDi(personaId) : []
    },

    async mandaCertificato(personaId, file) {
      const guasto = cosaNonVaFileMandato(file)
      if (guasto) throw new Error(guasto)
      if (!persona(personaId)) throw new Error('Questa persona non è più fra gli iscritti')
      // Un invio solo in attesa: il nuovo prende il posto del vecchio.
      scordaInAttesa(personaId)
      certificatiInAttesaProva.set(personaId, { url: typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : '', pdf: file.type === 'application/pdf' })
      a().persone = a().persone.map((p) =>
        p.id === personaId ? { ...p, certificato: { ...p.certificato, inAttesa: { file: `${personaId}/attesa-${Date.now()}.${ESTENSIONI_MANDATO[file.type]}`, il: chiaveGiorno(new Date()) } } } : p,
      )
      archivio.salva()
    },

    async saldoAttivo() {
      return true
    },

    async chiPaga(personaId, io) {
      if (!persona(personaId)) return null
      const nato = (await creaSegreteriaProva().anagraficaDi(personaId))?.dati.natoIl
      // In prova ha l'accesso solo chi si è scelto di essere: gli altri del nucleo no.
      return { adulto: !nato || !minorenne(nato), haAccessoProprio: personaId === io, comeTitolare: personaId !== io, importo: importoQuotaProva(personaId) }
    },

    async pagaSaldo(personaId, ricevutaId) {
      await pagaSaldoProva(personaId, ricevutaId)
      return null
    },

    async statoSaldo(personaId, ricevutaId) {
      const p = pagamentiSatispayProva()
        .filter((x) => x.personaId === personaId && x.saldoDi === ricevutaId)
        .sort((x, y) => y.creatoIl.localeCompare(x.creatoIl))[0]
      return p ? { stato: p.stato, importo: p.importo, pagatoIl: p.pagatoIl, chi: p.chi } : null
    },

    async pagaQuota(personaId) {
      await pagaQuotaProva(personaId)
      return null
    },

    async statoQuota(personaId) {
      const p = pagamentiSatispayProva()
        .filter((x) => x.personaId === personaId && x.voce === 'quota' && !x.ricevutaId)
        .sort((x, y) => y.creatoIl.localeCompare(x.creatoIl))[0]
      return p ? { stato: p.stato, importo: p.importo, pagatoIl: p.pagatoIl, chi: p.chi } : null
    },
  }
}

/**
 * Quanto costa la quota adesso, in centesimi, come `quota_importo`
 * (`105-paga-quota-satispay.sql`): la quota del listino, o il perché non si
 * paga online, con gli stessi testi del database.
 */
function quotaDaPagareProva(personaId: string): number {
  const oggi = chiaveGiorno(new Date())
  const p = archivio.dati.persone.find((x) => x.id === personaId)
  if (!p) throw new Error('Questa persona non è fra le tue')
  // `listinoDa` ripiega sul listino predefinito, che ha sempre la quota: il «non è nel listino» del database qui non può darsi.
  const q = (listinoDa(listinoProva()) ?? LISTINO_PREDEFINITO).quota
  const sue = (archivio.dati.ricevute ?? []).filter((r) => r.personaId === personaId && !r.annullataIl)
  if (quoteDi(sue).some((x) => (!x.dal || x.dal <= oggi) && (!x.al || x.al >= oggi))) throw new Error('La quota associativa ha già una ricevuta: per quel che manca c’è il saldo')
  if (p.pagamento && p.pagamento.stato !== 'da_pagare' && (p.pagamento.fino ?? '9999-01-01') >= oggi) throw new Error('La quota risulta già pagata fuori dall’app: chiedi alla segreteria')
  if (pagamentiSatispayProva().some((x) => x.personaId === personaId && x.stato === 'pagato' && !x.ricevutaId)) throw new Error('Hai già pagato con Satispay: la segreteria prepara la ricevuta')
  return Math.round(q * 100)
}

/** Come `quota_importo_o_null`: `null` se la quota non si paga adesso. */
function importoQuotaProva(personaId: string): number | null {
  try {
    return quotaDaPagareProva(personaId)
  } catch {
    return null
  }
}

/**
 * La quota intera con Satispay, in prova (`satispay_prepara_quota`): Satispay
 * non c'è, quindi il pagamento nasce già pagato, per la quota del listino.
 * Gli stessi rifiuti del database, con gli stessi testi.
 */
export async function pagaQuotaProva(personaId: string): Promise<void> {
  const importo = quotaDaPagareProva(personaId)
  const p = archivio.dati.persone.find((x) => x.id === personaId)
  const ora = new Date().toISOString()
  salvaSatispay([
    ...pagamentiSatispayProva(),
    { id: crypto.randomUUID(), chi: p ? `${p.cognome} ${p.nome}` : '', importo, stato: 'pagato', creatoIl: ora, pagatoIl: ora, personaId, voce: 'quota' },
  ])
}

/**
 * Il saldo della quota con Satispay, in prova (`satispay_prepara_saldo`,
 * `103-saldo-satispay.sql`): Satispay non c'è, quindi il pagamento nasce già
 * pagato, per quanto manca adesso. Un secondo tocco ritrova lo stesso. Gli
 * stessi rifiuti del database sulla ricevuta e sull'importo, con gli stessi
 * testi; chi può pagare per chi lo decide `chiPaga`, non qui.
 */
export async function pagaSaldoProva(personaId: string, ricevutaId: string): Promise<void> {
  const r = (archivio.dati.ricevute ?? []).find((x) => x.id === ricevutaId && x.personaId === personaId && !x.annullataIl)
  if (!r) throw new Error('Questa ricevuta non si può pagare: chiedi alla segreteria')
  const oggi = chiaveGiorno(new Date())
  const quota = quoteDi([r]).find((q) => (!q.dal || q.dal <= oggi) && (!q.al || q.al >= oggi))
  if (!quota) throw new Error('Qui non c’è una quota da pagare: chiedi alla segreteria')
  const pagamenti = pagamentiSatispayProva()
  const dei = pagamenti.filter((p) => p.personaId === personaId && p.saldoDi === ricevutaId)
  if (dei.some((p) => p.stato === 'attesa')) return
  // Come `saldo_mancano`: quel che è già arrivato e non è ancora in una ricevuta si toglie.
  const resto = quota.mancano - dei.filter((p) => p.stato === 'pagato' && !p.ricevutaId).reduce((t, p) => t + p.importo, 0)
  if (resto <= 0) throw new Error('Non resta niente da pagare su questa quota')
  const p = archivio.dati.persone.find((x) => x.id === personaId)
  const ora = new Date().toISOString()
  salvaSatispay([
    ...pagamenti,
    {
      id: crypto.randomUUID(),
      chi: p ? `${p.cognome} ${p.nome}` : '',
      importo: resto,
      stato: 'pagato',
      creatoIl: ora,
      pagatoIl: ora,
      personaId,
      saldoDi: ricevutaId,
    },
  ])
}
