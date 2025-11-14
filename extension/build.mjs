import { build } from 'esbuild'
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'fs'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const outdir = __dirname + '/dist'
mkdirSync(outdir, { recursive: true })

await build({
  entryPoints: [__dirname + '/src/content.ts'],
  outfile: outdir + '/content.js',
  bundle: true,
  minify: false,
  sourcemap: true,
  format: 'iife',
  target: ['chrome120'],
  loader: {
    '.css': 'text'
  }
})

// copy manifest, popup assets, and icons
for (const asset of ['manifest.json', 'popup.html', 'popup.js']) {
  copyFileSync(__dirname + `/${asset}`, outdir + `/${asset}`)
}
for (const size of [16, 48, 128]) {
  copyFileSync(__dirname + `/icon${size}.png`, outdir + `/icon${size}.png`)
}
