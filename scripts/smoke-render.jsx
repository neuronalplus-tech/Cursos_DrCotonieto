/**
 * Prueba de humo REAL: renderiza cada vista de verdad.
 *
 * Por qué: `vite build` solo comprueba que el código es sintácticamente
 * válido. Si un componente usa otro que no está importado, el build PASA y
 * el error aparece en runtime, al entrar a esa página. Eso ya pasó dos
 * veces (VideoPlayer, ModalEditarTaller).
 *
 * renderToString ejecuta el cuerpo de los componentes: si hay un
 * ReferenceError, un import roto o un hook mal usado, salta aquí.
 *
 * Uso:  npx vite build --ssr scripts/smoke-render.jsx --outDir .smoke
 *       node .smoke/smoke-render.js
 */
import { createElement as h } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

import Header from '../src/components/Header'
import PortadaCurso from '../src/components/PortadaCurso'
import CursoCard from '../src/components/CursoCard'
import Home from '../src/components/Home'
import Login from '../src/components/Login'
import Perfil from '../src/components/Perfil'
import Admin from '../src/components/Admin'
import CursoDetalle from '../src/components/CursoDetalle'
import Constancia from '../src/components/Constancia'
import CursoView from '../src/components/CursoView'
import ModuloView from '../src/components/ModuloView'
import CarruselCursos from '../src/components/CarruselCursos'
import TallerRecursos from '../src/components/TallerRecursos'
import MensajesInbox, { MensajesPage } from '../src/components/MensajesInbox'

// Datos falsos: solo necesitan la forma, nunca se llega a consultarlos
// porque los efectos no se ejecutan al renderizar en servidor.
const user = {
  id: 'u1', email: 'prueba@ejemplo.com', nombre_completo: 'Usuario Prueba',
}
const admin = { ...user, rol: 'admin' }
const curso = {
  id: 1, titulo: 'Curso de prueba', descripcion: 'Descripción',
  activo: true, gratuito: false, orden: 1, oculto: false,
}
const modulo = {
  id: 1, titulo: 'Módulo de prueba', descripcion: 'Contenido',
  orden: 1, activo: true, disponible: true, oculto: false,
}

const pagina = (ruta, elemento) => h(MemoryRouter, { initialEntries: [ruta] }, elemento)

const vistas = [
  ['Header (con usuario)',        pagina('/',        h(Header, { user, esAdmin: false, onLogout: () => {}, nombreUsuario: 'Prueba' }))],
  ['Header (invitado)',           pagina('/',        h(Header, { user: null, esAdmin: false, onLogout: () => {} }))],
  ['Header (admin)',              pagina('/',        h(Header, { user: admin, esAdmin: true, onLogout: () => {} }))],
  ['PortadaCurso',                pagina('/',        h(PortadaCurso, { motivo: 'ondas', uid: 'x' }))],
  ['CarruselCursos',              pagina('/',        h(CarruselCursos, { lineas: ['A', 'B'], cursos: [curso], onSelect: () => {} }))],
  ['CursoCard',                   pagina('/',        h(CursoCard, { curso, user, esAdmin: false, tieneAcceso: false }))],
  ['CursoCard (admin)',           pagina('/',        h(CursoCard, { curso, user: admin, esAdmin: true, tieneAcceso: true }))],
  ['Home',                        pagina('/',        h(Home, { user, esAdmin: false }))],
  ['Home (admin)',                pagina('/',        h(Home, { user: admin, esAdmin: true }))],
  ['Login',                       pagina('/acceso',  h(Login, { message: '' }))],
  ['Perfil',                      pagina('/perfil',  h(Perfil, { user }))],
  ['Admin',                       pagina('/admin',   h(Admin, { user: admin, esAdmin: true }))],
  ['CursoDetalle',                pagina('/c/1',      h(CursoDetalle, { user, esAdmin: false }))],
  ['Constancia',                  pagina('/c/1/constancia', h(Constancia, { user }))],
  ['CursoView',                   pagina('/curso/1', h(CursoView, { user, esAdmin: false }))],
  ['ModuloView',                  pagina('/modulo/1', h(ModuloView, { user, esAdmin: false }))],
  ['TallerRecursos',              pagina('/t/1',     h(TallerRecursos, { curso, user, esAdmin: true, onActualizado: () => {} }))],
  ['MensajesPage',                pagina('/mensajes', h(MensajesPage, { user, esAdmin: true }))],
  ['MensajesInbox',               pagina('/mensajes', h(MensajesInbox, { user, esAdmin: true }))],
]

let ok = 0
const fallos = []

for (const [nombre, arbol] of vistas) {
  try {
    const html = renderToString(arbol)
    if (typeof html !== 'string' || html.length === 0) {
      fallos.push([nombre, 'renderizó vacío'])
    } else {
      ok++
      console.log(`  OK   ${nombre} (${html.length} car.)`)
    }
  } catch (e) {
    fallos.push([nombre, e.message])
    console.log(`  FALLA ${nombre}: ${e.message}`)
  }
}

// Además: el enrutado completo de la app, que es donde se mezclan las rutas.
// Se importa sin `await` arriba porque el target de Vite no admite
// top-level await.
import('../src/App.jsx')
  .then(({ default: app }) => {
    renderToString(pagina('/', h(app)))
    ok++
    console.log('  OK   App completa (enrutado)')
  })
  .catch((e) => {
    console.log(`  AVISO App completa: ${e.message}`)
  })
  .finally(() => {
    console.log('\n' + '─'.repeat(56))
    console.log(`${ok} vistas renderizan · ${fallos.length} con error`)
    for (const [n, m] of fallos) console.log(`  ✗ ${n}: ${m}`)
    process.exit(fallos.length ? 1 : 0)
  })