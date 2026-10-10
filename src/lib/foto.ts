/**
 * Una foto dal telefono pesa 4-8 MB, e per leggere un documento ne bastano
 * poche centinaia di KB: si rimpicciolisce prima di mandarla, così parte
 * anche con una rete da spogliatoio e sta sotto il limite di 10 MB.
 *
 * Solo le foto che il browser sa aprire: un PDF resta com'è, e anche una foto
 * HEIC su un browser che non la legge (Safari la converte già da sé).
 */

const LATO = 2000
const QUALITA = 0.85
const BASTA = 1_500_000

export interface ComeRidurre {
  /** Il lato più lungo, in pixel. */
  lato?: number
  /** Sotto questo peso una foto resta com'è; con `sempreJpeg` è il peso massimo. */
  basta?: number
  /**
   * Sempre un JPEG sotto `basta`, o un errore: per il contenitore del
   * vestiario, che prende solo JPEG, PNG e WebP fino a 1 MB, e per le foto
   * HEIC dell'iPhone.
   */
  sempreJpeg?: boolean
}

export const NON_SI_APRE = 'Questa immagine non si apre: prova con una foto JPEG o PNG'
export const TROPPO_GRANDE = 'La foto resta troppo grande anche rimpicciolita: prova con una foto più piccola'

export async function riduciFoto(file: File, { lato = LATO, basta = BASTA, sempreJpeg = false }: ComeRidurre = {}): Promise<File> {
  if (!sempreJpeg && (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type) || file.size <= basta)) return file
  try {
    const img = await createImageBitmap(file)
    const scala = Math.min(1, lato / Math.max(img.width, img.height))
    const tela = document.createElement('canvas')
    tela.width = Math.round(img.width * scala)
    tela.height = Math.round(img.height * scala)
    tela.getContext('2d')!.drawImage(img, 0, 0, tela.width, tela.height)
    img.close()
    const nome = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    // Con sempreJpeg si scende di qualità finché sta sotto il peso massimo.
    for (const qualita of sempreJpeg ? [QUALITA, 0.7, 0.55] : [QUALITA]) {
      const blob = await new Promise<Blob | null>((ok) => tela.toBlob(ok, 'image/jpeg', qualita))
      // Una tela che non dà niente: l'immagine non si è aperta davvero.
      if (!blob) {
        if (sempreJpeg) throw new Error(NON_SI_APRE)
        break
      }
      if (!sempreJpeg) return blob.size >= file.size ? file : new File([blob], nome, { type: 'image/jpeg' })
      if (blob.size <= basta) return new File([blob], nome, { type: 'image/jpeg' })
    }
    if (sempreJpeg) throw new Error(TROPPO_GRANDE)
    return file
  } catch (e) {
    if (!sempreJpeg) return file
    throw e instanceof Error && e.message === TROPPO_GRANDE ? e : new Error(NON_SI_APRE)
  }
}
