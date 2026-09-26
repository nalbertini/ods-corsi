import { archivioClip } from '../../timer/src/lib/clipStore'
import type { FonteClip } from '../../timer/src/lib/voice'

/**
 * Le clip che la segreteria incide per i tablet, in prova: senza server
 * stanno in un archivio del browser tutto loro, che il tablet di prova sullo
 * stesso dispositivo legge come leggerebbe il contenitore `voce` di Supabase.
 */
export const clipProva = archivioClip('ods-prova-voce-sala')

export async function fonteClipProva(): Promise<FonteClip> {
  const chiavi = await clipProva.list()
  return { chiavi: new Set(chiavi), versione: [...chiavi].sort().join(), scarica: (k) => clipProva.get(k) }
}
