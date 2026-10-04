/**
 * Prueba de humo CON DATOS: monta la app real en un DOM y espera a que
 * terminen los efectos.
 *
 * smoke-render.jsx usa renderToString, que solo hace la primera pasada:
 * useEffect nunca corre, así que las vistas cargadas quedaban en el
 * "spinner" y su contenido jamás se ejecutaba. Eso escondía justo los
 * errores que buscamos (identificadores sin importar dentro del JSX de la
 * rama cargada).
 *
 * Aquí se usa jsdom + createRoot + act, y el doble de Supabase para que las
 * consultas respondan. Se monta <Root/> (la app entera, con sus rutas) en
 * cada ruta y se comprueba que el HTML crezca lo suficiente como para no ser
 * solo el estado de carga.
 *
 * Uso: npm run smoke:datos
 */
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body><div id="raiz"></div></body></html>', {
  url: 'https://prueba.local/',
  pretendToBeVisual: true,
})
const { window } = dom

globalThis.window = window
globalThis.document = window.document
globalThis.localStorage = window.localStorage
globalThis.HTMLElement = window.HTMLElement
globalThis.Element = window.Element
globalThis.Node = window.Node
globalThis.Event = window.Event
globalThis.getComputedStyle = window.getComputedStyle.bind(window)
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0)
globalThis.cancelAnimationFrame = (id) => clearTimeout(id)
globalThis.IS_REACT_ACT_ENVIRONMENT = true
// Node 21+ define navigator como solo-lectura: hay que redefinirlo.
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true })

// Algunos componentes esperan estos observadores en el navegador.
class ObservadorFalso {
  observe() {} unobserve() {} disconnect() {} takeRecords() { return [] }
}
globalThis.ResizeObserver = ObservadorFalso
globalThis.IntersectionObserver = ObservadorFalso
window.ResizeObserver = ObservadorFalso
window.IntersectionObserver = ObservadorFalso

// Un fallo dentro de un useEffect async llega como promesa rechazada suelta y
// tumba todo el proceso: se registraba un solo bug y no se veían los demás.
const rechazos = []
process.on('unhandledRejection', (e) => {
  rechazos.push(e?.message ? String(e.message).split('\n')[0] : String(e))
})
process.on('uncaughtException', (e) => {
  rechazos.push(e?.message ? String(e.message).split('\n')[0] : String(e))
})

// Las 9 rutas reales de src/App.jsx.
const RUTAS = [
  '/', '/acceso', '/perfil', '/admin',
  '/curso/1', '/curso/1/detalles', '/modulo/1',
  '/constancia/1', '/mensajes',
]

// Por debajo de esto es el spinner o una pantalla de error, no contenido.
const MINIMO = 400

// jsdom no implementa scrollIntoView (sí existe en navegadores). Sin este
// stub, MensajesInbox falla por el entorno y no por el código.
if (!window.Element.prototype.scrollIntoView) {
  window.Element.prototype.scrollIntoView = function () {}
}

async function main() {
  const { createRoot } = await import('react-dom/client')
  const { act } = await import('react-dom/test-utils')
  const React = await import('react')
  const Root = (await import('../src/App.jsx')).default

  let ok = 0
  const fallos = []

  for (const conSesion of [true, false]) {
    globalThis.__SESION__ = conSesion
    const etiqueta = conSesion ? 'con sesión' : 'sin sesión'

    for (const ruta of RUTAS) {
      const contenedor = document.createElement('div')
      document.body.appendChild(contenedor)
      window.history.pushState({}, '', ruta)

      try {
        const root = createRoot(contenedor)
        await act(async () => { root.render(React.createElement(Root)) })
        // Segundo turno: deja que las promesas de las consultas se vacíen.
        await act(async () => { await new Promise((r) => setTimeout(r, 5)) })

        const html = contenedor.innerHTML
        if (html.length < MINIMO) {
          fallos.push([`${ruta} (${etiqueta})`, `solo ${html.length} car., parece estado de carga`])
        } else {
          ok++
          console.log(`  OK   ${ruta.padEnd(20)} ${etiqueta.padEnd(11)} ${html.length} car.`)
        }
        await act(async () => { root.unmount() })
      } catch (e) {
        fallos.push([`${ruta} (${etiqueta})`, e.message.split('\n')[0]])
        console.log(`  FALLA ${ruta} (${etiqueta}): ${e.message.split('\n')[0]}`)
      }
      contenedor.remove()
    }
  }

  console.log('\n' + '─'.repeat(56))
  console.log(`${ok} rutas renderizan con datos · ${fallos.length} con error`)
  for (const [n, m] of fallos) console.log(`  ✗ ${n}: ${m}`)
  // Los rechazos sueltos son bugs igual de reales: los carga de datos que
  // se ejecutan sin catch y dejaban la vista a medias.
  const unicos = [...new Set(rechazos)]
  if (unicos.length) {
    console.log(`\n${unicos.length} fallo(s) en cargas de datos:`)
    for (const m of unicos) console.log(`  ✗ ${m}`)
  }
  process.exit(fallos.length || unicos.length ? 1 : 0)
}

main()
