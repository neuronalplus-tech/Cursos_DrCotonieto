/* ============================================================
   PRUEBAS DE INTERACCIÓN DEL FORO
   ------------------------------------------------------------
   smoke-datos.jsx monta la app y comprueba que pinte contenido.
   Eso NO detecta el fallo que había: el modal de editar se abría,
   pero su botón de guardar quedaba fuera de la pantalla y el
   tema nunca se enviaba.

   Aquí se monta AdminForo y EditorForo de verdad en jsdom, se
   pulsa el botón como lo haría una persona y se comprueba que la
   escritura llega al doble de Supabase con los datos correctos.

   Uso: npm run test:foro-ui
   ============================================================ */
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
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
globalThis.MouseEvent = window.MouseEvent
globalThis.getComputedStyle = window.getComputedStyle.bind(window)
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0)
globalThis.cancelAnimationFrame = (id) => clearTimeout(id)
globalThis.IS_REACT_ACT_ENVIRONMENT = true
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true })
globalThis.DOMParser = window.DOMParser

class ObservadorFalso {
  observe() {} unobserve() {} disconnect() {} takeRecords() { return [] }
}
globalThis.ResizeObserver = ObservadorFalso
globalThis.IntersectionObserver = ObservadorFalso
window.ResizeObserver = ObservadorFalso
window.IntersectionObserver = ObservadorFalso

if (!window.Element.prototype.scrollIntoView) {
  window.Element.prototype.scrollIntoView = function () {}
}

const rechazos = []
process.on('unhandledRejection', (e) => rechazos.push(String(e?.message || e).split('\n')[0]))
process.on('uncaughtException', (e) => rechazos.push(String(e?.message || e).split('\n')[0]))

let ok = 0
const fallos = []

function comprobar(nombre, condicion, detalle = '') {
  if (condicion) {
    ok++
    console.log(`  OK   ${nombre}`)
  } else {
    fallos.push([nombre, detalle])
    console.log(`  FALLA ${nombre}${detalle ? ': ' + detalle : ''}`)
  }
}

/** Espera a que se vacíen las promesas pendientes. */
const asentar = async (ms = 25) => { await new Promise((r) => setTimeout(r, ms)) }

/** Busca un botón por su texto visible, ignorando emojis y símbolos. */
function boton(raiz, texto) {
  return [...raiz.querySelectorAll('button')].find((b) =>
    b.textContent.replace(/[^\p{L}\p{N} ]/gu, '').toLowerCase().includes(texto.toLowerCase())
  )
}

/** Escribe en un input controlado por React: hay que pasar por el setter nativo. */
function escribir(elemento, valor) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(elemento, valor)
  elemento.dispatchEvent(new window.Event('input', { bubbles: true }))
}
async function main() {
  const { createRoot } = await import('react-dom/client')
  const React = await import('react')
  // React.act va en el propio React; react-dom/test-utils está deprecado.
  const act = React.act
  const AdminForo = (await import('../src/components/AdminForo.jsx')).default
  const EditorForo = (await import('../src/components/EditorForo.jsx')).default
  const { limpiarEscritas, escrituras } = await import('./fake-supabase.js')

  globalThis.__ESCENARIO__ = 'completo'
  globalThis.__SESION__ = true

  const USER = { id: 'u1', email: 'admin@ejemplo.com' }

  // Los modales se dibujan con createPortal sobre document.body, así que
  // los modales NO están dentro del contenedor donde se montó el componente.
  // Por eso el alcance de las búsquedas es document y no `contenedor`.
  const montar = async (elemento) => {
    const contenedor = document.createElement('div')
    document.body.appendChild(contenedor)
    const root = createRoot(contenedor)
    await act(async () => { root.render(elemento) })
    await act(async () => { await asentar(40) })
    return {
      contenedor,
      raiz: document.body,
      async pulsar(nodo) {
        if (!nodo) throw new Error('se intentó pulsar un botón inexistente')
        await act(async () => { nodo.dispatchEvent(new window.MouseEvent('click', { bubbles: true })) })
        await act(async () => { await asentar(40) })
      },
      async escribir(tituloNuevo) {
        const input = document.querySelector('.modal-ancho input')
        if (!input) throw new Error('el modal de edición no tiene campo de título')
        await act(async () => { escribir(input, tituloNuevo) })
        await act(async () => { await asentar(15) })
      },
      async desmontar() {
        await act(async () => { root.unmount() })
        contenedor.remove()
        // Los portales viven en document.body: si se quedara alguno abierto,
        // el siguiente bloque encontraría botones de un componente ya desmontado.
        for (const nodo of document.querySelectorAll('.modal-overlay')) nodo.remove()
      },
    }
  }
  /* --- 1. El modal de edición tiene botón de guardado visible ---------- */
  console.log('\n1. El modal de edición ofrece un botón de guardado alcanzable')
  {
    limpiarEscritas()
    const app = await montar(React.createElement(AdminForo, { user: USER }))

    // Los botones de la lista sí están en el contenedor del componente
    // (solo el modal va al portal).
    const editar = boton(app.contenedor, 'Editar')
    comprobar('Se listan los temas del curso', !!editar, 'no aparece ningún botón Editar')

    await app.pulsar(editar)

    comprobar('El modal usa la clase .modal-ancho',
      !!document.querySelector('.modal-ancho'))
    // El fallo original: el CSS no definía .modal, así que el cuadro salía
    // sin fondo ni scroll y los botones quedaban fuera de la pantalla.
    comprobar('El modal usa .modal (la clase que el CSS sí define)',
      !!document.querySelector('.modal.modal-ancho'))

    const guardar = boton(document, 'Guardar cambios')
    comprobar('El botón "Guardar cambios" existe en el modal', !!guardar)

    const acciones = document.querySelector('.modal-botones')
    comprobar('Los botones están en la barra .modal-botones',
      !!acciones && !!guardar && acciones.contains(guardar))

    await app.desmontar()
  }

  /* --- 2. Guardar la edición llega a Supabase --------------------------- */
  console.log('\n2. Guardar una edición escribe en foro_hilos')
  {
    limpiarEscritas()
    const app = await montar(React.createElement(AdminForo, { user: USER }))
    await app.pulsar(boton(app.raiz, 'Editar'))
    await app.escribir('Título corregido')
    await app.pulsar(boton(document, 'Guardar cambios'))

    const upd = escrituras().find((e) => e.operacion === 'update' && e.tabla === 'foro_hilos')
    comprobar('Se ejecuta un UPDATE en foro_hilos', !!upd)
    comprobar('El título enviado es el nuevo', upd?.datos?.titulo === 'Título corregido',
      `llego: ${upd?.datos?.titulo}`)
    comprobar('El aviso confirma el guardado',
      /actualizado/i.test(document.body.textContent))
    comprobar('El modal se cierra tras guardar',
      !document.querySelector('.modal-ancho'))

    await app.desmontar()
  }
  /* --- 3. Publicar un tema lleva identidad real, no null ---------------- */
  console.log('\n3. Publicar un tema nuevo: autor_id de verdad, no null')
  {
    limpiarEscritas()
    const app = await montar(React.createElement(AdminForo, { user: USER }))
    await app.pulsar(boton(app.raiz, 'Nuevo tema'))
    comprobar('El modal de nuevo tema pide el título',
      !!document.querySelector('.modal-ancho input'))
    await app.escribir('Tema de prueba')
    await app.pulsar(boton(document, 'Publicar tema'))

    const ins = escrituras().find((e) => e.operacion === 'insert' && e.tabla === 'foro_hilos')
    comprobar('Se ejecuta un INSERT en foro_hilos', !!ins)
    // Fallo de datos: autor_id a null choca con el NOT NULL de la tabla.
    comprobar('El INSERT lleva el autor_id del admin', ins?.datos?.autor_id === USER.id,
      `llego: ${ins?.datos?.autor_id}`)
    comprobar('El INSERT nunca manda autor_id null', ins?.datos?.autor_id !== null)
    comprobar('El INSERT lleva el nombre del autor',
      typeof ins?.datos?.autor_nombre === 'string' && ins.datos.autor_nombre.length > 0,
      `llego: ${ins?.datos?.autor_nombre}`)
    comprobar('El INSERT lleva el correo del autor',
      ins?.datos?.autor_email === USER.email, `llego: ${ins?.datos?.autor_email}`)
    comprobar('El INSERT va al curso seleccionado', ins?.datos?.curso_id === 1)

    await app.desmontar()
  }

  /* --- 4. Sin título no se escribe nada --------------------------------- */
  console.log('\n4. Sin título no se inserta nada')
  {
    limpiarEscritas()
    const app = await montar(React.createElement(AdminForo, { user: USER }))
    await app.pulsar(boton(app.raiz, 'Nuevo tema'))
    await app.pulsar(boton(document, 'Publicar tema'))

    comprobar('Se avisa de que el título es obligatorio',
      /t.tulo es obligatorio/i.test(document.body.textContent))
    comprobar('No se inserta ningún tema',
      escrituras().filter((e) => e.operacion === 'insert').length === 0)
    comprobar('El modal sigue abierto para corregir',
      !!document.querySelector('.modal-ancho'))

    await app.desmontar()
  }

  /* --- 5. El editor HTML no se confunde con guardar el tema -------------- */
  console.log('\n5. El submodal de HTML no promete guardar cuando no debe')
  {
    limpiarEscritas()
    const app = await montar(
      React.createElement(EditorForo, { valor: '<p>Hola</p>', onChange: () => {}, onGuardar: null })
    )

    const btnHtml = boton(app.raiz, 'HTML')
    comprobar('El editor ofrece el modo HTML', !!btnHtml)
    await app.pulsar(btnHtml)

    const aplicar = boton(document, 'Aplicar')
    comprobar('Sin onGuardar el botón es "Aplicar al mensaje"', !!aplicar)
    comprobar('No dice "guardar" cuando no hay a quién avisar',
      !/guardar/i.test(aplicar?.textContent || ''))

    await app.pulsar(aplicar)
    comprobar('Aplicar no escribe en el foro por su cuenta',
      escrituras().filter((e) => e.tabla.startsWith('foro_')).length === 0)

    await app.desmontar()
  }

  console.log('\n' + '='.repeat(56))
  console.log(`${ok} comprobaciones OK · ${fallos.length} con error`)
  for (const [n, m] of fallos) console.log(`  x ${n}: ${m}`)

  const unicos = [...new Set(rechazos)]
  if (unicos.length) {
    console.log(`\n${unicos.length} error(es) en cargas de datos:`)
    for (const m of unicos) console.log(`  x ${m}`)
  }
  process.exit(fallos.length || unicos.length ? 1 : 0)
}

main()