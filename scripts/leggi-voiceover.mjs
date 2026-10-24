// Fa leggere a VoiceOver (in Safari) ogni pagina della sitemap del sito pubblico e salva
// ciò che dice, riga per riga. Non è una prova che passa o fallisce: una persona rilegge
// il file e dice se ha senso. Serve solo su macOS, dopo `npx @guidepup/setup setup` e
// `npx @guidepup/setup install voiceover`; durante la lettura non si tocca il Mac.
//
//   node scripts/leggi-voiceover.mjs [file-di-uscita] [sito]
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { voiceOver } from '@guidepup/guidepup'

const uscita = process.argv[2] ?? 'docs/qa/voiceover-sito.txt'
const sito = process.argv[3] ?? 'https://www.officinedellosport.it'
const MAX_FRASI = 250

const sitemap = await (await fetch(`${sito}/sitemap.xml`)).text()
const pagine = process.env.PAGINE ? process.env.PAGINE.split(",") : [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])

const pausa = (ms) => new Promise((r) => setTimeout(r, ms))
const righe = []

await voiceOver.start()
try {
  for (const url of pagine) {
    execFileSync('open', ['-a', 'Safari', url])
    // Senza questo il fuoco di VoiceOver può restare sull'app che ha lanciato lo script.
    execFileSync('osascript', ['-e', 'tell application "Safari" to activate'])
    await pausa(Number(process.env.PAUSA ?? 4000))
    await voiceOver.interact()
    righe.push(`\n=== ${url}`)
    let ultima = ''
    let ripetute = 0
    for (let i = 0; i < MAX_FRASI && ripetute < 3; i++) {
      await voiceOver.next()
      const frase = (await voiceOver.lastSpokenPhrase()).trim()
      ripetute = frase === ultima ? ripetute + 1 : 0
      if (ripetute === 0) righe.push(frase)
      ultima = frase
    }
    await voiceOver.stopInteracting()
  }
} finally {
  await voiceOver.stop()
  writeFileSync(uscita, righe.join('\n') + '\n')
}
console.log(`${pagine.length} pagine lette, salvate in ${uscita}`)
