/* Prueba rápida del saneador de comunicados con jsdom:
   - conserva estilos inline seguros (colores, tipografía, márgenes)
   - tira url()/expression()/javascript: y las propiedades fuera de lista
   Uso: node scripts\probar-saneado.mjs */
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body></body></html>')
globalThis.DOMParser = dom.window.DOMParser
globalThis.document = dom.window.document

const { sanearDocumento, sanear } = await import('../src/lib/foro.js')

const casos = [
  {
    nombre: 'conserva color, fuente y márgenes inline',
    entrada: '<p style="color: #33414A; font-size: 15px; line-height: 1.65; margin: 0 0 12px;">Hola</p>',
    debeIncluir: ['color: #33414A', 'font-size: 15px', 'line-height: 1.65', 'margin: 0 0 12px'],
    debeExcluir: [],
  },
  {
    nombre: 'conserva título con marca',
    entrada: '<h2 style="color: #1B3A4B; font-family: Georgia, serif; font-size: 20px;">Tema</h2>',
    debeIncluir: ['color: #1B3A4B', 'font-family: Georgia, serif'],
    debeExcluir: [],
  },
  {
    nombre: 'tira url() y expression()',
    entrada: '<div style="background: url(javascript:alert(1)); width: expression(alert(2)); color: red;">x</div>',
    debeIncluir: ['color: red'],
    debeExcluir: ['url(', 'expression'],
  },
  {
    nombre: 'tira javascript: y position/z-index',
    entrada: '<span style="position: absolute; z-index: 9; behavior: url(x); color: blue">x</span>',
    debeIncluir: ['color: blue'],
    debeExcluir: ['position', 'z-index', 'behavior'],
  },
  {
    nombre: 'tira @import y -moz-binding',
    entrada: '<p style="background: @import url(evil); color: green; -moz-binding: url(x)">x</p>',
    debeIncluir: ['color: green'],
    debeExcluir: ['moz-binding', 'import'],
  },
  {
    nombre: 'conserva rgba() pero no calc()/var()',
    entrada: '<p style="color: rgba(27, 58, 75, 1); background-color: calc(100% - 10px)">x</p>',
    debeIncluir: ['rgba(27, 58, 75, 1)'],
    debeExcluir: ['calc('],
  },
  {
    nombre: 'quita <script> y onerror',
    entrada: '<p onclick="hack()" style="color: red">ok<script>alert(1)</scr' + 'ipt><img src="/logo.png" onerror="hack()"></p>',
    debeIncluir: ['color: red'],
    debeExcluir: ['<script', 'onclick', 'onerror'],
  },
  {
    nombre: 'font de Word: conserva color válido',
    entrada: '<font color="#C17A5E" face="Arial">texto</font>',
    debeIncluir: ['color="#C17A5E"'],
    debeExcluir: [],
  },
  {
    nombre: 'foro (sanear) NO admite style',
    entrada: '<p style="color: red">hola</p>',
    soloForo: true,
    debeIncluir: ['hola'],
    debeExcluir: ['style'],
  },
]

let fallos = 0
for (const c of casos) {
  const salida = c.soloForo ? sanear(c.entrada) : sanearDocumento(c.entrada)
  const problemas = []
  for (const s of c.debeIncluir) if (!salida.includes(s)) problemas.push(`falta "${s}"`)
  for (const s of c.debeExcluir) if (salida.includes(s)) problemas.push(`sobra "${s}"`)
  if (problemas.length) {
    fallos++
    console.log(`✗ ${c.nombre}: ${problemas.join('; ')}`)
    console.log(`   salida: ${salida}`)
  } else {
    console.log(`✓ ${c.nombre}`)
  }
}

console.log(fallos ? `\n${fallos} caso(s) fallaron` : '\nTodos los casos pasaron')
process.exit(fallos ? 1 : 0)