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

  /* --- 6. sanear() no se cuelga con HTML pesado tipo Word --------------- */
  console.log('\n6. sanear() con HTML pegado de Word no congela la vista')
  {
    const { sanear } = await import('../src/lib/foro.js')

    // Lo que pega Word/Docs: cientos de etiquetas no permitidas anidadas.
    let pesado = '<p>Inicio del tema.</p>'
    for (let i = 0; i < 400; i++) {
      pesado += `<font face="Arial"><span style="mso-bidi-font-weight:bold"><o:p>${i}</o:p> texto <b>con</b> formato <table><tr><td>celda</td></tr></table></span></font>`
    }
    pesado += '<p>Fin del tema.</p>'

    const t0 = Date.now()
    const limpio = sanear(pesado)
    const ms = Date.now() - t0

    comprobar('sanear() termina con HTML pesado (no congela)', limpio.includes('Fin del tema'), `tardo ${ms} ms`)
    comprobar('sanear() termina rápido (< 2 s)', ms < 2000, `tardo ${ms} ms`)
    comprobar('sanear() conserva el texto útil', limpio.includes('Inicio del tema'))
    comprobar('sanear() quita las etiquetas de Word', !/<(font|o:)/i.test(limpio))
    // Las anidadas se desenvuelven sin perder el contenido ni dejar scripts.
    comprobar('sanear() anidado: <div><font><span>x</span></font></div> conserva x',
      sanear('<div><font><span>x</span></font></div>').includes('x'))
    comprobar('sanear() no deja pasar script anidado',
      !/script/i.test(sanear('<div><font><script>alert(1)</scr' + 'ipt></font></div>')))
  }

  /* --- 7. El foro del alumno: entrar al tema no tumba la pantalla ------ */
  console.log('\n7. El foro del alumno se abre y se puede entrar al tema')
  {
    // Reproduce el fallo reportado: la pantalla quedaba en blanco al entrar
    // al foro cuando YA había un tema publicado (con la lista vacía el canal
    // de Realtime nunca se creaba, y por eso no se veía en las pruebas).
    globalThis.__ESCENARIO__ = 'completo'
    const { MemoryRouter, Routes, Route } = await import('react-router-dom')
    const ForoCurso = (await import('../src/components/ForoCurso.jsx')).default
    const { canalesFalsos } = await import('./fake-supabase.js')

    const ALUMNO = { id: 'u1', email: 'alumno@ejemplo.com' }
    const contenedor = document.createElement('div')
    document.body.appendChild(contenedor)
    const raiz = createRoot(contenedor)

    const vista = (u) => React.createElement(
      MemoryRouter,
      { initialEntries: ['/foro/1'] },
      React.createElement(
        Routes,
        null,
        React.createElement(Route, {
          path: '/foro/:cursoId',
          element: React.createElement(ForoCurso, { user: u, esAdmin: false }),
        }),
      ),
    )

    await act(async () => { raiz.render(vista(ALUMNO)) })
    await act(async () => { await asentar(60) })

    comprobar('El foro lista el tema publicado',
      contenedor.textContent.includes('Bienvenida al foro'),
      `texto: ${contenedor.textContent.slice(0, 80)}`)
    comprobar('Se abre un canal de Realtime para el curso',
      [...canalesFalsos().keys()].some((t) => t === `foro-1` || t.startsWith('foro-1-')),
      `canales: ${[...canalesFalsos().keys()].join(', ') || '(ninguno)'}`)

    // El disparador real del fallo: supabase emite un token refrescado y la
    // app entrega un objeto `user` NUEVO con el MISMO id. Con las
    // dependencias antiguas ([user, ...]) el efecto se repetía,
    // `channel('foro-' + cursoId)` devolvía el canal todavía suscrito y
    // `.on()` lanzaba:
    //   "cannot add `postgres_changes` callbacks ... after `subscribe()`"
    // Un error dentro de un useEffect no se recupera: React desmonta toda la
    // app y la persona ve una pantalla blanca, sin menú ni pistas.
    await act(async () => { raiz.render(vista({ ...ALUMNO })) })
    await act(async () => { await asentar(40) })

    comprobar('Un `user` nuevo con el mismo id no deja la pantalla en blanco',
      contenedor.innerHTML.length > 400, `solo ${contenedor.innerHTML.length} car.`)
    comprobar('No se apilan canales de Realtime para el mismo curso',
      [...canalesFalsos().keys()].filter((t) => t === 'foro-1' || t.startsWith('foro-1-')).length <= 1,
      `canales: ${[...canalesFalsos().keys()].join(', ') || '(ninguno)'}`)

    // Entrar al tema: es lo que congelaba la vista.
    const tema = [...contenedor.querySelectorAll('button')]
      .find((b) => b.textContent.includes('Bienvenida al foro'))
    await act(async () => { tema.dispatchEvent(new window.MouseEvent('click', { bubbles: true })) })
    await act(async () => { await asentar(40) })

    comprobar('Se puede abrir el tema', !!contenedor.querySelector('.foro-hilo-principal'))
    comprobar('El editor de respuesta aparece', !!contenedor.querySelector('.editor-foro-cuerpo'))
    comprobar('Se listan las respuestas del tema',
      contenedor.querySelectorAll('.foro-respuesta').length === 1,
      `encontradas: ${contenedor.querySelectorAll('.foro-respuesta').length}`)

    await act(async () => { raiz.unmount() })
    contenedor.remove()
  }

  /* --- 8. El doble de canales imita al cliente real -------------------- */
  console.log('\n8. El doble de Realtime se comporta como el cliente real')
  {
    // Sin esto, la prueba anterior no podría ver este fallo: el doble
    // devolvía un canal nuevo e inocente en cada llamada.
    const { supabase } = await import('./fake-supabase.js')

    const c1 = supabase.channel('tema-de-prueba')
    c1.on('postgres_changes', { event: '*' }, () => {}).subscribe()
    comprobar('channel() reutiliza el canal del mismo tema',
      supabase.channel('tema-de-prueba') === c1)

    let lanzo = false
    try {
      supabase.channel('tema-de-prueba').on('postgres_changes', { event: '*' }, () => {})
    } catch { lanzo = true }
    comprobar('.on() lanza si el canal ya está suscrito (como el cliente real)', lanzo)

    await supabase.removeChannel(c1)
    comprobar('removeChannel libera el tema', supabase.channel('tema-de-prueba') !== c1)
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