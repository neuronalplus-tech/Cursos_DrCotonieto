import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const webRoot = new URL('../', import.meta.url)

test('Cloudflare Pages build metadata and SPA routing are configured', async () => {
  const [packageJson, redirects, html] = await Promise.all([
    readFile(new URL('package.json', webRoot), 'utf8'),
    readFile(new URL('public/_redirects', webRoot), 'utf8'),
    readFile(new URL('index.html', webRoot), 'utf8')
  ])

  assert.equal(JSON.parse(packageJson).scripts.build, 'vite build')
  assert.match(redirects, /^\/\* \/index\.html 200\r?$/m)
  assert.match(html, /<html lang="es">/)
  assert.match(html, /<title>PASMU \| Acompañamiento universitario<\/title>/)
})

test('Cloudflare Pages sets baseline headers and safe cache behavior', async () => {
  const headers = await readFile(new URL('public/_headers', webRoot), 'utf8')

  for (const header of [
    'X-Content-Type-Options: nosniff',
    'Referrer-Policy: strict-origin-when-cross-origin',
    'X-Frame-Options: DENY',
    'Permissions-Policy: camera=(), microphone=(), geolocation=()',
    'Cache-Control: no-cache',
    'Cache-Control: public, max-age=31536000, immutable'
  ]) {
    assert.ok(headers.includes(header), `missing Cloudflare Pages header: ${header}`)
  }
  assert.doesNotMatch(headers, /Content-Security-Policy:/i)
})
