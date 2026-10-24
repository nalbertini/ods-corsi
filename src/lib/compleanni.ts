// Chi compie gli anni oggi: la stessa regola di `compleanni_sala` e
// `compleanni_lezione` (supabase/108-compleanni.sql), per la modalità prova che
// lavora su dati finti. Giorno e mese sono quelli di Roma; chi è nato il
// 29 febbraio festeggia il 1° marzo negli anni non bisestili.
// Una data che non torna dice «no»: l'avviso non deve mai rompere la schermata.

const FORMATO = /^(\d{4})-(\d{2})-(\d{2})$/

const bisestile = (anno: number) => (anno % 4 === 0 && anno % 100 !== 0) || anno % 400 === 0

/** Anno, mese e giorno di Roma di un istante. */
function aRoma(oggi: Date): { anno: number; mese: number; giorno: number } | null {
  if (Number.isNaN(oggi.getTime())) return null
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(oggi)
  const m = FORMATO.exec(p)
  return m ? { anno: +m[1], mese: +m[2], giorno: +m[3] } : null
}

/** `nato` è «AAAA-MM-GG» (la data della scheda); `oggi` l'istante di adesso. */
export function compleannoOggi(nato: string | null | undefined, oggi: Date): boolean {
  const m = nato ? FORMATO.exec(nato) : null
  const r = aRoma(oggi)
  if (!m || !r) return false
  const [anno, mese, giorno] = [+m[1], +m[2], +m[3]]
  // Una data che non esiste (30 febbraio, 29 febbraio di un anno non bisestile) non è un compleanno.
  if (mese < 1 || mese > 12 || giorno < 1) return false
  const giorniDelMese = [31, bisestile(anno) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mese - 1]
  if (giorno > giorniDelMese) return false
  if (mese === 2 && giorno === 29 && !bisestile(r.anno)) return r.mese === 3 && r.giorno === 1
  return r.mese === mese && r.giorno === giorno
}

/** Il giorno di nascita di chi oggi (a Roma) compie `anni` anni: per i dati di prova. */
export function nascitaOggi(anni: number, oggi: Date): string {
  const r = aRoma(oggi)
  if (!r) return ''
  return `${r.anno - anni}-${String(r.mese).padStart(2, '0')}-${String(r.giorno).padStart(2, '0')}`
}

/**
 * Gli id di chi festeggia, dalla risposta di `compleanni_sala` o `compleanni_lezione`
 * (`persona_id`), o delle lezioni con un istruttore in festa (`sessione_id`).
 * L'avviso è facoltativo: senza 108-compleanni.sql, con un errore o a rete rotta l'elenco è quello di prima.
 */
export async function festeggiatiDa(risposta: PromiseLike<{ data: unknown; error: unknown }>, campo: 'persona_id' | 'sessione_id' = 'persona_id'): Promise<string[]> {
  try {
    const r = await risposta
    if (r.error) return []
    // Il database restituisce righe con un solo campo (108-compleanni.sql): il tipo generato non le descrive.
    return ((r.data ?? []) as Array<Record<string, string>>).map((x) => x[campo])
  } catch {
    return []
  }
}
