import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const raiz = path.dirname(fileURLToPath(import.meta.url))
// Con barras normales: en Windows Vite interpreta las rutas con `\` como
// relativas y rompe el alias.
const DOBLE = path.resolve(raiz, 'scripts/fake-supabase.js').replace(/\\/g, '/')

/**
 * Plugin SOLO para la prueba de render con datos.
 *
 * Redirige cualquier import que termine en `supabase` (es decir,
 * src/lib/supabase) hacia el doble, de modo que las consultas devuelvan filas
 * falsas y los componentes lleguen a la rama de "datos cargados".
 *
 * Se usa un plugin y no `resolve.alias` porque en Windows el `replacement`
 * absoluto con barras invertidas lo toma como ruta relativa.
 *
 * No toca el cliente real ni vite.config.js.
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
    ssr: 'scripts/smoke-datos.jsx',
    outDir: '.smoke-datos',
    emptyOutDir: true,
    minify: false,
  },
})

