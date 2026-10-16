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
// «Problemas contemporáneos»: el curso que tenía bloques escritos a mano.
// Sesión 4 ya está migrada (entregable y juego como materiales); la
// sesión 1 todavía no (debe seguir enseñando el bloque viejo).
const PROBLEMAS = { id: 20, titulo: 'Problemas contemporáneos de salud', descripcion: 'X', activo: true, gratuito: false, orden: 20, linea: 'Salud' }
const MODULOS_PROBLEMAS = [
  { id: 21, curso_id: 20, titulo: 'Sesión 4: cierre', descripcion: '', activo: true, grupo: null, disponible: true, orden: 4, botones_extra: [] },
  { id: 22, curso_id: 20, titulo: 'Sesión 1: inicio', descripcion: '', activo: true, grupo: null, disponible: true, orden: 1, botones_extra: [] },
]
const RECURSOS_MIGRADOS = [
  { id: 30, modulo_id: 21, tipo: 'enlace', categoria_material: 'entregable', titulo: 'Entregables / productos', descripcion: 'Súbelo aquí.', url: 'https://1drv.ms/f/x', contenido: '📤 Subir mi entregable a OneDrive', orden: 900 },
  { id: 31, modulo_id: 21, tipo: 'enlace', categoria_material: 'juego', titulo: 'Juego de la sesión 4', url: '/juegos/juego-s4.html', contenido: '', orden: 950 },
]

const CAPAS = [
  { id: 1, organizacion_id: null, clave: 'curso-pagina.ruta.Clínica.titulo@curso:1', valor: { texto: 'Ruta Clínica Avanzada' } },
  { id: 2, organizacion_id: null, clave: 'curso-pagina.foro.texto', valor: { texto: 'Texto del foro editado' } },
  { id: 3, organizacion_id: null, clave: 'curso-pagina.otros-modulos', valor: { visible: false } },
  { id: 4, organizacion_id: null, clave: 'modulo.contacto.whatsapp', valor: { mensaje: 'Duda sobre {modulo}' } },
  { id: 5, organizacion_id: null, clave: 'detalles.Clínica.nombre', valor: { texto: 'Ruta Clínica Pro' } },
  { id: 6, organizacion_id: null, clave: 'encabezado.menu.calendario', valor: { texto: 'Agenda' } },
  { id: 7, organizacion_id: null, clave: 'curso-pagina.aviso-sin-sesion', valor: { colorTexto: '#ff0000' } },
  // Página de detalles de un curso cualquiera (no el de duelo).
  { id: 8, organizacion_id: null, clave: 'detalles.1.secciones', valor: { items: [{ titulo: 'A quién va dirigido', texto: 'Psicólogos clínicos.\nY estudiantes.' }] } },
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
    cursos: [CURSO, ESPECIAL, PROBLEMAS],
    modulos: [...MODULOS_PROBLEMAS, ...MODULOS, { id: 9, curso_id: 1, titulo: 'Sin ruta', descripcion: '', activo: true, grupo: null, disponible: true, orden: 9 }],
    // El alumno es de la ruta del módulo 1; si no, el módulo es «privado».
    acceso: [{ usuario_id: 'u1', curso_id: 1, grupo: 'Acompañamiento' }],
    contenido_sitio: CAPAS,
    // Un enlace cerrado: el alumno no debe ni verlo («si no hay, no se despliega»).
    recursos: [
      { id: 1, modulo_id: 1, titulo: 'Presentacion', descripcion: 'PDF.', tipo: 'pdf', archivo: 'caso.pdf', orden: 1, url: null },
      { id: 2, modulo_id: 1, titulo: 'Video', descripcion: 'Video.', tipo: 'video', archivo: 'v.mp4', orden: 2, url: null },
      { id: 3, modulo_id: 1, titulo: 'Enlace cerrado', descripcion: '', tipo: 'enlace', url: 'https://x.mx', orden: 3, disponible: false },
      ...RECURSOS_MIGRADOS,
    ],
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
    const secciones = [...c.querySelectorAll('.material-seccion-titulo')].map(textoDe)
    comprobar('Materiales agrupados por sección, en orden fijo',
      secciones.length === 2 && secciones[0].includes('Materiales de lectura') && secciones[1].includes('Grabaciones y videos'), secciones.join(' | '))
    comprobar('El recurso cerrado no se le enseña al alumno', !c.textContent.includes('Enlace cerrado'))
    comprobar('Sin «Enlaces de interés» vacía', !c.textContent.includes('Enlaces de interés'))
    comprobar('Cada recurso lleva el color de su formato', !!c.querySelector('.recurso-item.formato-pdf') && !!c.querySelector('.recurso-item.formato-video'))
    await p.quitar()
  }

  console.log('\n2b. Foro: solo si tiene temas')
  {
    const alumno = { id: 'u1', email: 'a@b.mx' }
    let p = await montar('/curso/1', '/curso/:id', h(CursoView, { user: alumno }))
    comprobar('Con temas, el alumno ve el foro', p.caja.textContent.includes('Foro del curso'))
    await p.quitar()
    const antes = globalThis.__TABLAS__.foro_hilos
    globalThis.__TABLAS__.foro_hilos = []
    p = await montar('/curso/1', '/curso/:id', h(CursoView, { user: alumno }))
    comprobar('Sin temas, el foro no aparece', !p.caja.textContent.includes('Foro del curso'))
    if (antes === undefined) delete globalThis.__TABLAS__.foro_hilos; else globalThis.__TABLAS__.foro_hilos = antes
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

  alternarEdicion() // fuera del modo edición: la papelera no debe depender de él

  console.log('\n7. Eliminar de verdad el registro de un taller (🗑 junto al candado)')
  {
    const CursoCard = (await import('../src/components/CursoCard.jsx')).default
    const { limpiarEscritas, escrituras } = await import('./fake-supabase.js')
    globalThis.__TABLAS__ = { ...globalThis.__TABLAS__, admins: [{ email: 'jefe@b.mx', organizacion_id: null }] }
    window.confirm = () => true
    limpiarEscritas()
    const taller = { id: 8, titulo: 'Taller de prueba', gratuito: true, linea: 'Talleres', activo: true,
      link_registro: 'https://forms.example/registro', registro_texto: 'Registrarme', registro_activo: false }
    const p = await montar('/', '/', h(CursoCard, { curso: taller, user: { id: 'jefe', email: 'jefe@b.mx' }, tieneAcceso: false }))
    const papelera = p.caja.querySelector('.candado-toggle.borrar')
    comprobar('Hay papelera junto al candado, sin modo edición', !!papelera && !!p.caja.querySelector('.candado-toggle.cerrado'))
    await p.pulsar(papelera)
    const upd = escrituras().find((e) => e.tabla === 'cursos' && e.operacion === 'update')
    comprobar('Borra el enlace y el texto en la base', upd?.datos?.link_registro === null && upd?.datos?.registro_texto === null, JSON.stringify(upd?.datos))
    comprobar('El botón «Registro (oculto)» desaparece', !p.caja.textContent.includes('Registro'))
    await p.quitar()
  }

  console.log('\n7b. Bloques que antes eran especiales')
  {
    const jefe = { id: 'jefe', email: 'jefe@b.mx' }
    let p = await montar('/modulo/21', '/modulo/:id', h(ModuloView, { user: jefe }))
    let c = p.caja
    const secs = [...c.querySelectorAll('.material-seccion-titulo')].map(textoDe)
    comprobar('Migrado: secciones «Juegos» y «Entregables», en ese orden', secs.length === 2 &&
      secs[0].includes('Juegos e interactivos') && secs[1].includes('Entregables'), secs.join(' | '))
    comprobar('Migrado: ya no sale el bloque viejo de entregables', !c.querySelector('.entregables-bloque'))
    comprobar('Migrado: el juego sale una sola vez', [...c.querySelectorAll('a')].filter((a) => a.getAttribute('href') === '/juegos/juego-s4.html').length === 1)
    const juego = [...c.querySelectorAll('a')].find((a) => a.getAttribute('href') === '/juegos/juego-s4.html')
    comprobar('El botón dice lo que hace su sección («Abrir el juego»)', juego?.textContent.includes('Abrir el juego'), juego?.textContent)
    comprobar('El texto propio del recurso gana', [...c.querySelectorAll('a')].some((a) => a.textContent.includes('Subir mi entregable a OneDrive')))
    comprobar('La nota de la sección acompaña al botón', c.textContent.includes('Sube tu archivo con el nombre indicado'))
    await p.quitar()

    p = await montar('/modulo/22', '/modulo/:id', h(ModuloView, { user: jefe }))
    c = p.caja
    comprobar('Sin migrar: el bloque viejo de entregables sigue', !!c.querySelector('.entregables-bloque'))
    comprobar('Sin migrar: fuera de la sesión 4 no hay juego', !c.textContent.toLowerCase().includes('juego de la sesión 4'))
    await p.quitar()

    const CursoCard = (await import('../src/components/CursoCard.jsx')).default
    p = await montar('/', '/', h(CursoCard, { curso: CURSO, user: null, tieneAcceso: false }))
    comprobar('Un curso cualquiera con secciones de detalles enseña «Ver detalles»', p.caja.textContent.includes('Ver detalles'))
    await p.quitar()
    p = await montar('/', '/', h(CursoCard, { curso: PROBLEMAS, user: null, tieneAcceso: false }))
    comprobar('Sin secciones de detalles, no hay «Ver detalles»', !p.caja.textContent.includes('Ver detalles'))
    await p.quitar()
    p = await montar('/curso/1/detalles', '/curso/:id/detalles', h(CursoDetalle, { user: null }))
    c = p.caja
    comprobar('Detalles genéricos: título del curso y sus secciones',
      c.querySelector('h1')?.textContent.includes('Duelo y perdida') && c.textContent.includes('A quién va dirigido'))
    comprobar('Un párrafo por línea', [...c.querySelectorAll('.detalle-secciones p')].length === 2)
    comprobar('Botón de información con el nombre del curso', [...c.querySelectorAll('a[href^="https://wa.me/"]')].some((a) => waDe(a).includes('"Duelo y perdida: curso completo"')))
    await p.quitar()
  }

  console.log('\n8. Centro de gestión')
  {
    const CentroGestion = (await import('../src/components/CentroGestion.jsx')).default
    const GestionCurso = (await import('../src/components/GestionCurso.jsx')).default
    const jefe = { id: 'jefe', email: 'jefe@b.mx' }

    let p = await montar('/gestion', '/gestion', h(CentroGestion, { user: jefe }))
    await act(async () => { await asentar(80) })
    const tarjetas = p.caja.querySelectorAll('.gestion-tarjeta')
    comprobar('Una tarjeta por curso', tarjetas.length === 3, String(tarjetas.length))
    const t1 = [...tarjetas].find((t) => t.textContent.includes('curso completo'))
    comprobar('La tarjeta cuenta módulos y materiales', t1?.textContent.includes('3 módulos') && t1?.textContent.includes('3 materiales'), t1?.textContent)
    comprobar('«Ver como» con los cuatro perfiles', p.caja.querySelectorAll('.vercomo .linea-pill').length === 5)
    const busca = p.caja.querySelector('.gestion-filtros input')
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(busca, 'normativo')
      busca.dispatchEvent(new window.Event('input', { bubbles: true }))
    })
    comprobar('El buscador filtra las tarjetas', p.caja.querySelectorAll('.gestion-tarjeta').length === 1)
    await p.quitar()

    p = await montar('/gestion?ver=permisos', '/gestion', h(CentroGestion, { user: jefe }))
    await act(async () => { await asentar(60) })
    comprobar('Matriz de permisos con una fila por elemento', p.caja.querySelectorAll('.matriz-tabla tbody tr:not(.matriz-grupo)').length >= 20)
    comprobar('Sitio principal: aviso de que los roles son por organización, sin casillas',
      p.caja.textContent.includes('por organización') && !p.caja.querySelector('.matriz-tabla input[type="checkbox"]'))
    await p.quitar()

    p = await montar('/gestion/curso/1', '/gestion/curso/:id', h(GestionCurso, { user: jefe }))
    await act(async () => { await asentar(60) })
    const cabezas = [...p.caja.querySelectorAll('.gestion-seccion-cabeza')]
    comprobar('Nueve tarjetas, todas abiertas para administración', cabezas.length === 9 && cabezas.every((b) => !b.disabled))
    await p.pulsar(cabezas.find((b) => b.textContent.includes('Módulos y materiales')))
    const filas = p.caja.querySelectorAll('.gestion-modulo')
    comprobar('Lista los módulos del curso', filas.length === 3, String(filas.length))
    await p.pulsar(filas[0].querySelector('.gestion-fila-titulo'))
    const cats = [...p.caja.querySelectorAll('.gestion-cat')].map(textoDe)
    comprobar('Dentro del módulo, materiales por sección (también el cerrado, para ti)',
      cats.some((t) => t.includes('Materiales de lectura')) && cats.some((t) => t.includes('Enlaces de interés')), cats.join(' | '))
    comprobar('El cerrado sale marcado «Oculto para alumnos»', p.caja.textContent.includes('Oculto para alumnos'))
    const mapa = p.caja.querySelector('.gestion-mapa')
    comprobar('Mapa de la página: foro con temas aparece como lleno', !!mapa && [...mapa.querySelectorAll('li.lleno')].some((li) => li.textContent.includes('Foro')))
    await p.quitar()

    p = await montar('/gestion/curso/1?como=coordinacion', '/gestion/curso/:id', h(GestionCurso, { user: jefe }))
    await act(async () => { await asentar(60) })
    const sec = (t) => [...p.caja.querySelectorAll('.gestion-seccion')].find((x) => x.textContent.includes(t))
    comprobar('Ver como Coordinación: Módulos con candado y la razón',
      sec('Módulos y materiales')?.classList.contains('bloqueada') && sec('Módulos y materiales').textContent.includes('Coordinación no puede editar esto'))
    comprobar('Ver como Coordinación: Generaciones abierta', !sec('Generaciones')?.classList.contains('bloqueada'))
    comprobar('Ver como: aviso de vista previa', p.caja.querySelector('.vercomo.activa')?.textContent.includes('Vista previa como Coordinación'))
    await p.quitar()
  }

  console.log('\n9. Matriz con los roles de una organización')
  {
    const MatrizPermisos = (await import('../src/components/MatrizPermisos.jsx')).default
    const { limpiarEscritas, escrituras } = await import('./fake-supabase.js')
    limpiarEscritas()
    let avisos = 0
    window.confirm = (t) => { avisos++; globalThis.__ULTIMO_AVISO__ = t; return true }
    const rolesBD = { estado: 'ok', roles: [{ id: 1, nombre: 'Docente', permisos: ['cursos.ver'] }] }
    let recargas = 0
    const p = await montar('/', '/', h(MatrizPermisos, {
      orgId: 7, rolesBD, puedeEditar: true, onRecargar: async () => { recargas++ }, onVerComo: () => {},
    }))
    const casillas = p.caja.querySelectorAll('input[type="checkbox"]')
    comprobar('Solo el rol que existe tiene casillas', casillas.length > 0 &&
      [...casillas].every((c) => c.getAttribute('aria-label').startsWith('Docente:')))
    comprobar('Ofrece crear los roles que faltan', p.caja.textContent.includes('Crear los tres roles básicos'))
    comprobar('Los textos del sitio no tienen casilla (solo quien administra)',
      ![...casillas].some((c) => c.getAttribute('aria-label').includes('Textos, botones')))
    await p.pulsar([...casillas].find((c) => c.getAttribute('aria-label') === 'Docente: Abrir, cerrar y calificar temas del foro'))
    const ins = escrituras().find((e) => e.tabla === 'rol_permisos' && e.operacion === 'insert')
    comprobar('Marcar da el permiso al rol en la base', ins?.datos?.rol_id === 1 && ins?.datos?.permiso === 'foro.moderar', JSON.stringify(ins?.datos))
    comprobar('… y recarga la matriz', recargas === 1)
    await p.pulsar([...casillas].find((c) => c.getAttribute('aria-label') === 'Docente: Materiales: lecturas, grabaciones, actividades…'))
    comprobar('Avisa de lo demás que abre el mismo permiso', /Crear, ordenar, abrir y cerrar módulos/.test(globalThis.__ULTIMO_AVISO__ || ''))
    await p.quitar()
  }

  comprobar('Sin promesas rechazadas', rechazos.length === 0, rechazos.join(' | '))
  console.log(`\n${ok} comprobaciones bien · ${fallos.length} fallos`)
  process.exit(fallos.length ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
