import type { Voce } from './indirizzoSegreteria'
import { cosaBlocca } from './cosaBlocca'
import { giornoPerEsteso, oraDi } from './sala'
import type { LezioneSeg, PersonaSeg } from './segreteria'
import { comePaga, senzaCertificatoValido, statoCertificato } from './segreteria'

export type FiltroCoda = 'certificato' | 'scadenza' | 'arrivo' | 'pagare' | 'file-di-prima' | 'stampare' | 'fuori-regola' | 'senza-appello'

/** Una riga della coda «da fare al banco»: cosa, quanto preme, e dove porta il tasto. */
export interface RigaCoda {
  id: string
  /** `blocca`: è già un guaio (rosso). `presto`: aspetta una risposta (giallo). */
  livello: 'blocca' | 'presto'
  titolo: string
  sotto: string
  tasto: string
  vai: { voce: Voce; persona?: string; lezione?: { id: string; inizio: string }; filtro?: FiltroCoda }
}

/** Quante righe per tipo prima di «Altri N»: la coda deve restare una coda, non un elenco. */
const PER_TIPO = 3

const conNome = (p: PersonaSeg) => `${p.cognome} ${p.nome}`
const perNome = (a: PersonaSeg, b: PersonaSeg) => conNome(a).localeCompare(conNome(b), 'it')

export function codaBanco(i: { appelli: LezioneSeg[]; persone: PersonaSeg[]; richieste: number; istruttori: number; segnalate?: number }, oggi: string): RigaCoda[] {
  const righe: RigaCoda[] = []

  // Gli appelli: la lezione più recente prima.
  const appelli = [...i.appelli].sort((a, b) => b.inizio.localeCompare(a.inizio))
  for (const l of appelli.slice(0, PER_TIPO)) {
    righe.push({
      id: `appello-${l.id}`,
      livello: 'blocca',
      titolo: `${l.corso} · appello non fatto`,
      // Un appello di un altro giorno dice quale: due «Judo adulti» uguali non si distinguono dall'ora.
      sotto: `${l.inizio.slice(0, 10) === oggi ? 'Erano' : `${giornoPerEsteso(l.inizio.slice(0, 10))}, erano`} alle ${oraDi(l.inizio)}. ${l.iscritti} iscritti da segnare.`,
      tasto: "FAI L'APPELLO",
      // L'appello vero si fa dalla lezione in SETTIMANA, come da DA FARE: PRESENZE non apre una lezione sola.
      vai: { voce: 'settimana', lezione: { id: l.id, inizio: l.inizio } },
    })
  }
  if (appelli.length > PER_TIPO) {
    const n = appelli.length - PER_TIPO
    righe.push({ id: 'appelli-altri', livello: 'blocca', titolo: `Altri ${n} appelli non fatti`, sotto: 'Si aprono da PRESENZE, dal più recente.', tasto: 'VEDI TUTTI', vai: { voce: 'presenze', filtro: 'senza-appello' } })
  }

  const attive = i.persone.filter((p) => p.attiva)
  const senzaCert = attive.filter((p) => senzaCertificatoValido(p, oggi)).sort(perNome)
  for (const p of senzaCert.slice(0, PER_TIPO)) {
    righe.push({
      id: `certificato-${p.id}`,
      livello: 'blocca',
      titolo: `${conNome(p)} · certificato ${statoCertificato(p, oggi) === 'manca' ? 'mancante' : 'scaduto'}`,
      sotto: cosaBlocca(p, oggi)?.frase ?? '',
      tasto: 'APRI LA SCHEDA',
      vai: { voce: 'iscritti', persona: p.id },
    })
  }
  if (senzaCert.length > PER_TIPO) {
    righe.push({ id: 'certificati-altri', livello: 'blocca', titolo: `Altri ${senzaCert.length - PER_TIPO} senza certificato`, sotto: 'In sala non entrano.', tasto: 'VEDI CHI', vai: { voce: 'iscritti', filtro: 'certificato' } })
  }

  // Chi è già fra i certificati non si ripete: la scheda è la stessa. Per questo «Altri N» può
  // essere meno del filtro DA PAGARE che apre, che conta anche loro.
  const daPagare = attive.filter((p) => !senzaCertificatoValido(p, oggi) && comePaga(p, oggi) !== 'pagato').sort(perNome)
  for (const p of daPagare.slice(0, PER_TIPO)) {
    righe.push({
      id: `quota-${p.id}`,
      livello: 'blocca',
      titolo: `${conNome(p)} · quota non pagata`,
      sotto: cosaBlocca(p, oggi)?.frase ?? '',
      tasto: 'FAI LA RICEVUTA',
      vai: { voce: 'iscritti', persona: p.id },
    })
  }
  if (daPagare.length > PER_TIPO) {
    righe.push({ id: 'quote-altre', livello: 'blocca', titolo: `Altri ${daPagare.length - PER_TIPO} da pagare`, sotto: 'La quota non è in regola.', tasto: 'VEDI CHI', vai: { voce: 'iscritti', filtro: 'pagare' } })
  }

  if (i.richieste > 0) {
    righe.push({
      id: 'richieste',
      livello: 'presto',
      titolo: i.richieste === 1 ? '1 richiesta online nuova' : `${i.richieste} richieste online nuove`,
      sotto: 'Da accogliere o da rifiutare.',
      tasto: 'ACCOGLI',
      vai: { voce: 'richieste' },
    })
  }
  if (i.istruttori > 0) {
    righe.push({
      id: 'istruttori',
      livello: 'presto',
      titolo: i.istruttori === 1 ? '1 presenza istruttore da confermare' : `${i.istruttori} presenze istruttori da confermare`,
      sotto: 'Segnate da loro, da confermare.',
      tasto: 'CONFERMA',
      vai: { voce: 'istruttori' },
    })
  }
  if (i.segnalate && i.segnalate > 0) {
    righe.push({
      id: 'segnalate',
      livello: 'presto',
      titolo: i.segnalate === 1 ? '1 presenza segnalata da vedere' : `${i.segnalate} presenze segnalate da vedere`,
      sotto: 'Segnalate da chi viene a lezione.',
      tasto: 'VEDI',
      vai: { voce: 'segnalate' },
    })
  }
  return righe
}
