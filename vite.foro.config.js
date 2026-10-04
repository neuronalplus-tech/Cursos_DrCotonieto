import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const raiz = path.dirname(fileURLToPath(import.meta.url))
const DOBLE = path.resolve(raiz, 'scripts/fake-supabase.js').replace(/\\/g, '/')

/**
 * Igual que vite.smoke.config.js pero para las pruebas de INTERACCIÓN del
 * foro: montan los componentes, pulsan botones de verdad y comprueban que
 * la escritura llega a Supabase.
 *
 * Se separa en su propio config (y su propia carpeta de salida) para que
 * una prueba no pise el resultado de la otra.
 */
function dobleSupabase() {
  return {
    name: 'doble-supabase',
    enforce: 'pre',
    resolveId(source) {
      if (/supabase$/.test(source)) return DOBLE
      return null
    },
  }
}

export default defineConfig({
  plugins: [dobleSupabase(), react()],
  build: {
    ssr: 'scripts/test-foro-ui.jsx',
    outDir: '.smoke-foro-ui',
    emptyOutDir: true,
    minify: false,
  },
})