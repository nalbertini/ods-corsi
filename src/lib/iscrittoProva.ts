import type { DatiIscritto, MiaLezione, MiaPresenza } from './iscritto'
import { archivio } from './archivioProva'
import { comeE, iscrittiIl, lezioniFra, memoria, nomeIstruttore, salaDelGiorno } from './datiProva'
import { chiaveGiorno, perCognome } from './sala'

/**
 * L'area degli iscritti senza server: legge l'archivio di prova, lo stesso
 * che cambiano la segreteria, l'appello e il tablet. Non scrive niente.
 *
 * Fa vedere a un iscritto solo quello che è suo, come faranno le funzioni
 * del database: le lezioni dei corsi a cui era iscritto quel giorno, i suoi
 * segni nell'appello, le sue ricevute.
 */

const GIORNO = 24 * 60 * 60_000

export function creaIscrittoProva(): DatiIscritto {
  const a = () => archivio.dati
  const persona = (id: string) => a().persone.find((p) => p.id === id && p.ruolo === 'iscritto' && p.attiva)
  /** Era iscritto a quel corso quel giorno: l'elenco dell'appello lo dice. */
  const suo = (personaId: string, corsoId: string, giorno: string) => iscrittiIl(corsoId, giorno).some((p) => p.id === personaId)

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
        certificato: { scade: p.certificato?.scade, conFile: !!p.certificato?.file },
        pagamento: { stato: p.pagamento?.stato ?? 'da_pagare', fino: p.pagamento?.fino, nota: p.pagamento?.nota },
      }
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
  }
}
