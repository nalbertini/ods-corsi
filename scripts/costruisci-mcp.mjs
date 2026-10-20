// Il server MCP (supabase/functions/mcp) usa le regole di src/lib, che sono scritte per Vite: import senza
// estensione e `import.meta.env`. Deno non le legge così, quindi prima di pubblicare si mettono in un file solo,
// `supabase/functions/mcp/regole.js` (non sta nel repository: si rifà a ogni pubblicazione).
//
//   node scripts/costruisci-mcp.mjs && supabase functions deploy mcp --no-verify-jwt --project-ref <id>
import { build } from 'esbuild'

const r = await build({
  entryPoints: ['src/lib/mcp.ts'],
  outfile: 'supabase/functions/mcp/regole.js',
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  // I pacchetti npm di src/lib servono all'app, non a queste regole: restano fuori, e se una regola ne usa uno ci si ferma.
  packages: 'external',
  target: 'es2022',
  // Le regole non leggono l'ambiente: senza questo, `import.meta.env` di dati.ts romperebbe Deno.
  define: { 'import.meta.env': '{}' },
  banner: { js: '// Generato da scripts/costruisci-mcp.mjs: non si modifica a mano.' },
  metafile: true,
  logLevel: 'warning',
})
const uscita = Object.values(r.metafile.outputs)[0]
if (uscita.imports.length) {
  console.error(`Le regole del server MCP usano pacchetti che Deno non ha: ${uscita.imports.map((i) => i.path).join(', ')}`)
  process.exit(1)
}
const kb = Math.round(uscita.bytes / 1024)
console.log(`supabase/functions/mcp/regole.js: ${kb} kB`)
