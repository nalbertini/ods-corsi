// Genera le icone PWA dal marchio a ingranaggi. Rilanciare con `npm run icons`
// dopo ogni modifica al disegno.
import { mkdir, writeFile } from 'node:fs/promises'
import sharp from 'sharp'

const GEARS = [
  [38, 40, '#1b8ac4'],
  [80, 40, '#f2f2f0'],
  [122, 40, '#e4292a'],
  [59, 74, '#f4c31b'],
  [101, 74, '#16a54a'],
]

/** `inset` lascia il margine che Android ritaglia dalle icone maskable. */
function svg(size, inset) {
  const art = size * (1 - inset * 2)
  const offset = size * inset
  const teeth = GEARS.map(([cx, cy, c]) => `<circle cx="${cx}" cy="${cy}" r="22" stroke="${c}"/>`).join('')
  const hubs = GEARS.map(([cx, cy, c]) => `<circle cx="${cx}" cy="${cy}" r="14" stroke="${c}"/>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#121212"/>
  <svg x="${offset}" y="${offset + (art * 110) / 160 * 0.07}" width="${art}" height="${(art * 110) / 160}" viewBox="0 0 160 110">
    <g fill="none" stroke-width="9" stroke-dasharray="6 7.82">${teeth}</g>
    <g fill="none" stroke-width="5">${hubs}</g>
  </svg>
</svg>`
}

const targets = [
  { file: 'icon-192.png', size: 192, inset: 0.08 },
  { file: 'icon-512.png', size: 512, inset: 0.08 },
  { file: 'maskable-512.png', size: 512, inset: 0.2 },
  { file: 'apple-touch-icon.png', size: 180, inset: 0.1 },
]

await mkdir('public/icons', { recursive: true })
await writeFile('public/icons/icon.svg', svg(512, 0.08))

for (const t of targets) {
  await sharp(Buffer.from(svg(t.size, t.inset))).png().toFile(`public/icons/${t.file}`)
  console.log(`public/icons/${t.file}  ${t.size}×${t.size}`)
}
