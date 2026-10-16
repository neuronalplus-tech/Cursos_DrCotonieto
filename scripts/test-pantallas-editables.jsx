/* ============================================================
   PANTALLAS EDITABLES: CURSO, MÓDULO, DETALLES Y ENCABEZADO
   ------------------------------------------------------------
   smoke-render.jsx renderiza en servidor, donde estas pantallas
   se quedan en «Cargando…»: no ve nada de lo editable. Aquí se
   montan en jsdom con datos del doble de Supabase y se comprueba:

   1. Sin ediciones se ve lo de siempre (mismos textos, mismos
      mensajes de WhatsApp) y no hay lápices.
   2. Las filas de `contenido_sitio` sobreescriben lo que dicen,
      incluido {ruta} en los mensajes y lo oculto al público.
   3. En modo edición hay lápices y ninguno queda dentro de otro
      botón o enlace (HTML inválido).
   4. Encabezado: el diálogo vive en un portal; ni cierra el menú
      de cuenta ni hace que el logo lleve al inicio.

   Uso: npm run test:pantallas
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
globalThis.KeyboardEvent = window.KeyboardEvent
globalThis.getComputedStyle = window.getComputedStyle.bind(window)
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0)
globalThis.cancelAnimationFrame = (id) => clearTimeout(id)
globalThis.IS_REACT_ACT_ENVIRONMENT = true
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true })
class ObservadorFalso { observe() {} unobserve() {} disconnect() {} takeRecords() { return [] } }
globalThis.ResizeObserver = ObservadorFalso
globalThis.IntersectionObserver = ObservadorFalso
window.ResizeObserver = ObservadorFalso
window.IntersectionObserver = ObservadorFalso
if (!window.Element.prototype.scrollIntoView) window.Element.prototype.scrollIntoView = function () {}

const rechazos = []
process.on('unhandledRejection', (e) => rechazos.push(String(e?.message || e).split('\n')[0]))

let ok = 0
const fallos = []
function comprobar(nombre, condicion, detalle = '') {
  if (condicion) { ok++; console.log(`  OK   ${nombre}`) } else {
    fallos.push([nombre, detalle]); console.log(`  FALLA ${nombre}${detalle ? ': ' + detalle : ''}`)
  }
}
const asentar = (ms = 30) => new Promise((r) => setTimeout(r, ms))
const textoDe = (n) => (n?.textContent || '').replace(/✏️/g, '').trim()
const waDe = (a) => decodeURIComponent((a?.getAttribute('href') || '').split('text=')[1] || '')
const enlaceCon = (raiz, texto) => [...raiz.querySelectorAll('a')].find((a) => a.textContent.includes(texto))
const anidados = (raiz) => raiz.querySelectorAll('button button, a button, button a, a a').length

// Datos: un curso con dos rutas, uno «especial» (detalles de duelo) y
// las ediciones que debe respetar cada pantalla.
const CURSO = { id: 1, titulo: 'Duelo y perdida: curso completo', descripcion: 'Descripcion.', activo: true, gratuito: false, orden: 1, constancia: true }
const ESPECIAL = { id: 5, titulo: 'Duelo normativo y prolongado', descripcion: 'Curso de duelo.', activo: true, gratuito: false, orden: 5 }
const MODULOS = [
  { id: 1, curso_id: 1, titulo: 'Modulo 1', descripcion: 'Contenido.', activo: true, grupo: 'Acompañamiento', disponible: true, orden: 1 },
  { id: 2, curso_id: 1, titulo: 'Modulo 2', descripcion: 'Contenido 2.', activo: true, grupo: 'Clínica', disponible: true, orden: 2 },
]
const CAPAS = [
  { id: 1, organizacion_id: null, clave: 'curso-pagina.ruta.Clínica.titulo@curso:1', valor: { texto: 'Ruta Clínica Avanzada' } },
  { id: 2, organizacion_id: null, clave: 'curso-pagina.foro.texto', valor: { texto: 'Texto del foro editado' } },
  { id: 3, organizacion_id: null, clave: 'curso-pagina.otros-modulos', valor: { visible: false } },
  { id: 4, organizacion_id: null, clave: 'modulo.contacto.whatsapp', valor: { mensaje: 'Duda sobre {modulo}' } },
  { id: 5, organizacion_id: null, clave: 'detalles.Clínica.nombre', valor: { texto: 'Ruta Clínica Pro' } },
  { id: 6, organizacion_id: null, clave: 'encabezado.menu.calendario', valor: { texto: 'Agenda' } },
  { id: 7, organizacion_id: null, clave: 'curso-pagina.aviso-sin-sesion', valor: { colorTexto: '#ff0000' } },
]

async function main() {
  const React = await import('react')
  const { createRoot } = await import('react-dom/client')
  const { MemoryRouter, Routes, Route, useLocation } = await import('react-router-dom')
  const act = React.act
  const h = React.createElement
  const CursoView = (await import('../src/components/CursoView.jsx')).default
  const ModuloView = (await import('../src/components/ModuloView.jsx')).default
  const CursoDetalle = (await import('../src/components/CursoDetalle.jsx')).default
  const Header = (await import('../src/components/Header.jsx')).default
  const { BotonEditable } = await import('../src/components/Editable.jsx')
  const { fijarPuedeEditar, alternarEdicion } = await import('../src/lib/contenido.js')

  globalThis.__ESCENARIO__ = 'completo'
  globalThis.__TABLAS__ = {
    cursos: [CURSO, ESPECIAL],
    modulos: [...MODULOS, { id: 9, curso_id: 1, titulo: 'Sin ruta', descripcion: '', activo: true, grupo: null, disponible: true, orden: 9 }],
    // El alumno es de la ruta del módulo 1; si no, el módulo es «privado».
    acceso: [{ usuario_id: 'u1', curso_id: 1, grupo: 'Acompañamiento' }],
    contenido_sitio: CAPAS,
    organizaciones: [],
  }

  let ubicacion = null
  function Espia() { ubicacion = useLocation().pathname; return null }

  const montar = async (ruta, patron, elemento) => {
    const caja = document.createElement('div')
    document.body.appendChild(caja)
    const root = createRoot(caja)
    await act(async () => {
      root.render(h(MemoryRouter, { initialEntries: [ruta] },
        h(Espia), h(Routes, null, h(Route, { path: patron, element: elemento }), h(Route, { path: '*', element: h('p', null, 'otra') }))))
    })
    await act(async () => { await asentar(60) })
    return {
      caja,
      async pulsar(n) { await act(async () => { n.dispatchEvent(new window.MouseEvent('click', { bubbles: true })) }); await act(async () => { await asentar() }) },
      async raton(n) { await act(async () => { n.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true })) }); await act(async () => { await asentar() }) },
      async quitar() {
        await act(async () => { root.unmount() }); caja.remove()
        for (const n of document.querySelectorAll('.modal-overlay')) n.remove()
      },
    }
  }

  /* --- 1-2. Página del curso, sin sesión ----------------------- */
  console.log('\n1. Página del curso: lo de siempre + ediciones')
  {
    const p = await montar('/curso/1', '/curso/:id', h(CursoView, { user: null }))
    const c = p.caja
    comprobar('Se pinta «Contenido del curso»', c.textContent.includes('Contenido del curso'))
    const aviso = c.querySelector('.admin-banner')
    comprobar('El aviso sin sesión conserva «inicia sesión» en negritas',
      aviso?.querySelector('strong')?.textContent === 'inicia sesión', aviso?.innerHTML)
    comprobar('… y no enseña los asteriscos', !aviso?.textContent.includes('**'))
    comprobar('… y aplica el color editado', aviso?.style.color === 'rgb(255, 0, 0)' || aviso?.style.color === '#ff0000', aviso?.style.color)
    const rutas = [...c.querySelectorAll('.ruta-section-header h2')].map(textoDe)
    comprobar('Ruta sin editar: «Ruta Acompañamiento»', rutas.includes('Ruta Acompañamiento'), rutas.join(' | '))
    comprobar('Ruta editada solo en este curso: «Ruta Clínica Avanzada»', rutas.includes('Ruta Clínica Avanzada'), rutas.join(' | '))
    const was = [...c.querySelectorAll('a[href^="https://wa.me/"]')].map(waDe)
    comprobar('Mensaje de la ruta sin editar, idéntico al de antes',
      was.includes('Hola, me interesa la Ruta Acompañamiento del curso "Duelo y perdida: curso completo". ¿Me compartes información e inscripción?'), was.join(' || '))
    comprobar('{ruta} usa el nombre editado', was.some((m) => m.includes('la Ruta Clínica Avanzada del curso')), was.join(' || '))
    comprobar('«Otros módulos» oculto al público', !c.textContent.includes('Otros módulos'))
    comprobar('Sin modo edición no hay lápices', !c.querySelector('.editable-lapiz'))
    comprobar('Botón «Ya estoy inscrito» presente', [...c.querySelectorAll('button')].some((b) => b.textContent === 'Ya estoy inscrito'))
    await p.quitar()
  }

  /* --- Módulo ------------------------------------------------- */
  console.log('\n2. Módulo')
  {
    const p = await montar('/modulo/1', '/modulo/:id', h(ModuloView, { user: { id: 'u1', email: 'a@b.mx' } }))
    const c = p.caja
    if (process.env.DEPURAR) console.log(c.textContent.slice(0, 400))
    comprobar('Avance «1 de 2 recursos revisados»', c.textContent.includes('1 de 2 recursos revisados'), c.querySelector('.modulo-avance')?.textContent)
    const wa = enlaceCon(c, 'Escríbeme')
    comprobar('WhatsApp de contacto con el mensaje editado y {modulo}', waDe(wa) === 'Duda sobre Modulo 1', waDe(wa))
    const correo = enlaceCon(c, 'Por correo')
    comprobar('«Por correo» sigue siendo mailto y sin pestaña nueva',
      correo?.getAttribute('href')?.startsWith('mailto:') && !correo.getAttribute('target'))
    comprobar('Atajo «Todo el curso» lleva al curso', enlaceCon(c, 'Todo el curso')?.getAttribute('href') === '/curso/1')
    await p.quitar()
  }

  /* --- Detalles ------------------------------------------------ */
  console.log('\n3. Detalles y rutas')
  {
    const p = await montar('/curso/5/detalles', '/curso/:id/detalles', h(CursoDetalle, { user: null }))
    const c = p.caja
    comprobar('Título de config', c.textContent.includes('Evaluación y acompañamiento en duelo normativo y prolongado'))
    const cols = [...c.querySelectorAll('.ruta-col h2')].map(textoDe)
    comprobar('Ruta editada «Ruta Clínica Pro» y la otra intacta',
      cols.includes('Ruta Clínica Pro') && cols.includes('Ruta Acompañamiento'), cols.join(' | '))
    comprobar('Los cuatro módulos de cada ruta', c.querySelectorAll('.ruta-modulos li').length === 8)
    const was = [...c.querySelectorAll('a[href^="https://wa.me/"]')].map(waDe)
    comprobar('{ruta} con el nombre editado en el detalle', was.some((m) => m.includes('la Ruta Clínica Pro del curso')), was.join(' || '))
    comprobar('Botón general «Quiero información e inscripción» con su mensaje',
      was.includes('Hola, me interesa el curso "Duelo normativo y prolongado". ¿Me compartes más información?'))
    await p.quitar()
  }

  /* --- Enlace a archivo estático ------------------------------ */
  console.log('\n4. Enlaces: ruta de la app vs. archivo estático')
  {
    const p = await montar('/', '/', h('div', null,
      h(BotonEditable, { clave: 'prueba.archivo', defecto: { texto: 'Juego', url: '/juegos/juego-s4.html' } }),
      h(BotonEditable, { clave: 'prueba.ruta', defecto: { texto: 'Ruta', url: '/curso/1' } })))
    const juego = enlaceCon(p.caja, 'Juego')
    comprobar('/juegos/x.html abre en pestaña nueva (no lo toma el router)', juego?.getAttribute('target') === '_blank')
    comprobar('/curso/1 sigue siendo ruta interna', !enlaceCon(p.caja, 'Ruta')?.getAttribute('target'))
    await p.quitar()
  }

  /* --- Modo edición ------------------------------------------- */
  fijarPuedeEditar(true)
  alternarEdicion()
  console.log('\n5. Modo edición: lápices válidos')
  for (const [nombre, ruta, patron, el] of [
    ['Curso', '/curso/1', '/curso/:id', h(CursoView, { user: null })],
    ['Módulo', '/modulo/1', '/modulo/:id', h(ModuloView, { user: { id: 'u1', email: 'a@b.mx' } })],
    ['Detalles', '/curso/5/detalles', '/curso/:id/detalles', h(CursoDetalle, { user: null })],
  ]) {
    const p = await montar(ruta, patron, el)
    const n = p.caja.querySelectorAll('.editable-lapiz').length
    comprobar(`${nombre}: hay lápices (${n})`, n > 5)
    comprobar(`${nombre}: ningún lápiz dentro de otro botón o enlace`, anidados(p.caja) === 0, `${anidados(p.caja)} anidados`)
    if (nombre === 'Curso') comprobar('Curso: «Otros módulos» se ve atenuado para editar', !!p.caja.querySelector('.editable-oculto'))
    await p.quitar()
  }

  console.log('\n6. Encabezado en modo edición')
  {
    const p = await montar('/curso/1', '*', h(Header, { user: { id: 'u1', email: 'a@b.mx' }, esAdmin: true, onLogout: () => {}, nombreUsuario: 'Prueba' }))
    const c = p.caja
    comprobar('Encabezado: ningún lápiz anidado', anidados(c) === 0)
    // Lápiz del nombre de la marca, dentro del logo (que lleva al inicio).
    await p.pulsar(c.querySelector('.logo-area .brand-name .editable-lapiz'))
    comprobar('El lápiz de la marca abre el diálogo sin ir al inicio', !!document.querySelector('.editor-capa') && ubicacion === '/curso/1', ubicacion)
    const input = document.querySelector('.editor-capa input')
    const espacio = new window.KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })
    await act(async () => { input.dispatchEvent(espacio) })
    comprobar('Se puede escribir un espacio en el diálogo', !espacio.defaultPrevented)
    await p.pulsar(document.querySelector('.editor-capa h3'))
    comprobar('Pulsar dentro del diálogo no lleva al inicio', ubicacion === '/curso/1', ubicacion)
    // El fondo oscuro cierra el diálogo y su clic sube (por React) hasta el logo.
    await p.pulsar(document.querySelector('.modal-overlay'))
    comprobar('Cerrar pulsando el fondo no lleva al inicio',
      !document.querySelector('.editor-capa') && ubicacion === '/curso/1', ubicacion)

    await p.pulsar(c.querySelector('.header-cuenta-btn'))
    const menu = c.querySelector('.header-menu')
    comprobar('Menú: «Calendario» editado a «Agenda»', menu?.textContent.includes('Agenda') && !menu.textContent.includes('Calendario'))
    comprobar('Menú: los elementos conservan role="menuitem"', menu?.querySelectorAll('[role="menuitem"]').length >= 7)
    const lapizPerfil = [...menu.querySelectorAll('.editable-lapiz')].find((b) => b.getAttribute('aria-label') === 'Editar: Mi perfil')
    await p.pulsar(lapizPerfil)
    await p.raton(document.querySelector('.editor-capa input'))
    comprobar('Pulsar en el diálogo no cierra el menú (ni el diálogo)',
      !!c.querySelector('.header-menu') && !!document.querySelector('.editor-capa'))
    await p.raton(document.body)
    comprobar('Pulsar fuera de verdad sí cierra el menú', !c.querySelector('.header-menu'))
    await p.quitar()
  }

  comprobar('Sin promesas rechazadas', rechazos.length === 0, rechazos.join(' | '))
  console.log(`\n${ok} comprobaciones bien · ${fallos.length} fallos`)
  process.exit(fallos.length ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
