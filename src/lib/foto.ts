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

export async function riduciFoto(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type) || file.size <= BASTA) return file
  try {
    const img = await createImageBitmap(file)
    const scala = Math.min(1, LATO / Math.max(img.width, img.height))
    const tela = document.createElement('canvas')
    tela.width = Math.round(img.width * scala)
    tela.height = Math.round(img.height * scala)
    tela.getContext('2d')!.drawImage(img, 0, 0, tela.width, tela.height)
    img.close()
    const blob = await new Promise<Blob | null>((ok) => tela.toBlob(ok, 'image/jpeg', QUALITA))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    return file
  }
}
