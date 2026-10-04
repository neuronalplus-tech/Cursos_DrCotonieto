/**
 * Comprobador de dependencias por archivo.
 *
 * Por qué existe: Vite NO avisa si usas un componente que no importaste.
 * El build pasa igual y el error aparece en runtime, al entrar a la página.
 * Ya pasó una vez (TallerRecursos usaba <VideoPlayer> sin importarlo).
 *
 * Uso:  node scripts/check-imports.mjs
 *
 * Revisa, para cada archivo de src/:
 *   · Que todo componente JSX usado (<Algo />) esté definido o importado.
 *   · Que no queden imports sin usar (aviso, no error).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, extname } from 'node:path'

const RAIZ = 'src'

/** Componentes propios conocidos: van con PascalCase. */
const PROPIOS = new Set([
  'Fragment', 'Suspense', 'StrictMode', 'Profiler',
])

function listar(dir, acc = []) {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre)
    const info = statSync(ruta)
    if (info.isDirectory()) listar(ruta, acc)
    else if (['.jsx', '.js'].includes(extname(ruta))) acc.push(ruta)
  }
  return acc
}

/** Identificadores que el archivo declara (imports, funciones, const, etc.). */
function declarados(fuente) {
  const out = new Set()

  // Imports: una cláusula puede traer default + varios con llaves.
  //   import X from '...'          → X
  //   import { A, B as C } from    → A, C
  //   import X, { A } from         → X, A
  //   import * as N from           → N
  const reImport = /import\s+([^'"]+?)\s+from\s+['"][^'"]+['"]/g
  let mi
  while ((mi = reImport.exec(fuente)) !== null) {
    const clausula = mi[1]
    const llaves = clausula.match(/\{([^}]*)\}/)
    if (llaves) {
      for (const crudo of llaves[1].split(',')) {
        const partes = crudo.trim().split(/\s+as\s+/)
        const nombre = (partes[1] || partes[0] || '').trim()
        if (nombre) out.add(nombre)
      }
    }
    const fuera = clausula.replace(/\{[^}]*\}/g, '')
    const resto = fuera.replace(/,\s*$/, '').replace(/^\s*,/, '').trim()
    if (resto && !resto.includes('*')) out.add(resto)
    const ns = resto.match(/\*\s+as\s+([A-Za-z0-9_$]+)/)
    if (ns) out.add(ns[1])
  }

  for (const re of [
    /(?:function|class)\s+([A-Za-z0-9_$]+)/g,
    /(?:const|let|var)\s+([A-Za-z0-9_$]+)/g,
  ]) {
    let m
    while ((m = re.exec(fuente)) !== null) out.add(m[1])
  }
  return out
}

/** Nombres usados como componente JSX: <Algo /> o <Algo ...> */
function componentesUsados(fuente) {
  const usados = new Set()
  const re = /<([A-Z][A-Za-z0-9_$]*)\b/g
  let m
  while ((m = re.exec(fuente)) !== null) usados.add(m[1])
  return usados
}

/** Nombres que ya son globales del navegador o props implícitas. */
const GLOBALES = new Set(['React', 'Fragment'])

const archivos = listar(RAIZ)
let problemas = 0
let avisos = 0

for (const archivo of archivos) {
  const fuente = readFileSync(archivo, 'utf8')
  const decl = declarados(fuente)
  const usados = componentesUsados(fuente)

  const faltan = [...usados].filter(
    (n) => !decl.has(n) && !PROPIOS.has(n) && !GLOBALES.has(n),
  )

  if (faltan.length) {
    problemas += faltan.length
    console.log(`\n❌ ${relative('.', archivo)}`)
    for (const f of faltan) console.log(`     usa <${f}> pero no lo declara ni importa`)
  }

  // Imports sin usar (solo informativo).
  const sinUsar = []
  const reImp = /import\s+\{([^}]+)\}\s+from/g
  let m2
  while ((m2 = reImp.exec(fuente)) !== null) {
    for (const crudo of m2[1].split(',')) {
      const nombre = crudo.trim().split(/\s+as\s+/)[0].trim()
      if (!nombre) continue
      const usos = fuente.split(new RegExp(`\\b${nombre.replace(/\$/g, '\\$')}\\b`)).length - 1
      if (usos <= 1) sinUsar.push(nombre)
    }
  }
  if (sinUsar.length) {
    avisos += sinUsar.length
    console.log(`\n⚠️  ${relative('.', archivo)} — import sin usar: ${sinUsar.join(', ')}`)
  }
}

console.log('\n' + '─'.repeat(56))
if (problemas === 0 && avisos === 0) {
  console.log(`✅ ${archivos.length} archivos revisados. Sin dependencias rotas.`)
} else {
  console.log(`${archivos.length} archivos · ${problemas} dependencia(s) rota(s) · ${avisos} aviso(s)`)
}
process.exit(problemas > 0 ? 1 : 0)