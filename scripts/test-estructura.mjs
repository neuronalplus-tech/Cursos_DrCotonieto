/* Pruebas de src/lib/estructura.js y src/lib/gestion.js (sin red).
   npm run test:estructura

   Además comprueba que el catálogo del código y el de la base no se
   separen: los permisos de nacimiento de cada rol (PERMISOS_BASE)
   deben ser los de sembrar_roles_basicos, y cada elemento editable
   debe nombrar un permiso que exista en el catálogo de ROLES_5. */
import { readFileSync } from 'node:fs'
import {
  PERFILES, PERMISOS_BASE, ELEMENTOS, CATEGORIAS_MATERIAL, categoriaDe, agruparPorCategoria,
  permite, permisosDePerfil, estadoCurso, estadoModulo, ANATOMIA,
} from '../src/lib/estructura'
import { filasFacilitadorNuevas } from '../src/lib/roles'
import {
  SECCIONES_CURSO, elementosDeSeccion, contextoReal, contextoSimulado, seccionesPermitidas, llenadoPagina, contarPorCurso,
} from '../src/lib/gestion'

let ok = 0
const fallos = []
const check = (n, c, d = '') => { if (c) { ok++; console.log('  OK   ' + n) } else { fallos.push(n); console.log('  FALLA ' + n + (d ? ': ' + d : '')) } }
const igualesConjunto = (a, b) => a.length === b.length && a.every((x) => b.includes(x))

console.log('\n=== EL CÓDIGO Y LA BASE DICEN LO MISMO ===')
const sql = readFileSync(new URL('../supabase/ROLES_5_PERMISOS.sql', import.meta.url), 'utf8')
const catalogo = [...sql.matchAll(/\(\s*'([a-z_]+\.[a-z_]+)'\s*,\s*'[^']+'/g)].map((m) => m[1])
check('Se leyó el catálogo de permisos de ROLES_5', catalogo.length >= 15, String(catalogo.length))
const sembrados = {}
for (const m of sql.matchAll(/values \(p_org, '([^']+)'[\s\S]*?unnest\(array\[([\s\S]*?)\]\)/g)) {
  sembrados[m[1]] = [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1])
}
for (const p of PERFILES.filter((x) => x.rol)) {
  check(`PERMISOS_BASE.${p.clave} = sembrar_roles_basicos('${p.rol}')`,
    igualesConjunto(PERMISOS_BASE[p.clave], sembrados[p.rol] || []),
    `código ${PERMISOS_BASE[p.clave]} vs base ${sembrados[p.rol]}`)
}
const raros = ELEMENTOS.filter((e) => !['admin', 'plataforma'].includes(e.permiso) && !catalogo.includes(e.permiso))
check('Todo elemento nombra un permiso que existe en la base', raros.length === 0, raros.map((e) => e.permiso).join(', '))
const secciones = SECCIONES_CURSO.map((s) => s.clave)
const sinTarjeta = ELEMENTOS.filter((e) => e.seccion && !secciones.includes(e.seccion))
check('Toda sección de un elemento es una tarjeta del Centro', sinTarjeta.length === 0, sinTarjeta.map((e) => e.clave).join(', '))
check('Toda tarjeta del Centro la abre algún elemento', secciones.every((s) => ELEMENTOS.some((e) => e.seccion === s)))
check('Claves de elemento únicas', new Set(ELEMENTOS.map((e) => e.clave)).size === ELEMENTOS.length)

console.log('\n=== CATEGORÍAS DEL MATERIAL ===')
check('pdf sin categoría → lectura', categoriaDe({ tipo: 'pdf' }) === 'lectura')
check('video → grabación', categoriaDe({ tipo: 'video' }) === 'grabacion')
check('autoevaluación → actividad', categoriaDe({ tipo: 'autoevaluacion' }) === 'actividad')
check('La categoría elegida gana al formato', categoriaDe({ tipo: 'pdf', categoria_material: 'actividad' }) === 'actividad')
check('Una categoría inválida cae a la del formato', categoriaDe({ tipo: 'video', categoria_material: 'xyz' }) === 'grabacion')
const grupos = agruparPorCategoria([
  { id: 1, tipo: 'enlace' }, { id: 2, tipo: 'pdf' }, { id: 3, tipo: 'video' }, { id: 4, tipo: 'pdf' },
])
check('Agrupa en el orden fijo y omite las vacías',
  grupos.map((x) => x.categoria.clave).join() === 'lectura,grabacion,enlace', grupos.map((x) => x.categoria.clave).join())
check('Dentro de la sección respeta el orden recibido', grupos[0].recursos.map((r) => r.id).join() === '2,4')
check('El módulo tiene una sección por categoría en su anatomía',
  CATEGORIAS_MATERIAL.every((c) => ANATOMIA.modulo.some((s) => s.clave === `material.${c.clave}`)))

const sqlCat = readFileSync(new URL('../supabase/ESTRUCTURA_1_CATEGORIAS.sql', import.meta.url), 'utf8')
const enCheck = [...(sqlCat.match(/categoria_material in\s*\(([\s\S]*?)\)\)/) || ['', ''])[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1])
check('Las categorías del código = las que admite la base (ESTRUCTURA_1)',
  igualesConjunto(enCheck, CATEGORIAS_MATERIAL.map((c) => c.clave)), `base: ${enCheck}`)
check('Sesión, juego y entregable existen y son solo enlace',
  ['sesion', 'juego', 'entregable'].every((k) => CATEGORIAS_MATERIAL.find((c) => c.clave === k)?.soloEnlace))
check('Toda categoría dice qué hace su botón', CATEGORIAS_MATERIAL.every((c) => c.accion))
check('Un entregable migrado conserva su sección', categoriaDe({ tipo: 'enlace', categoria_material: 'entregable' }) === 'entregable')
check('Las sesiones en vivo van primero en el módulo', CATEGORIAS_MATERIAL[0].clave === 'sesion')

console.log('\n=== QUIÉN EDITA QUÉ ===')
const sec = (clave) => seccionesPermitidas(contextoSimulado(clave, []))
check('Administración global: todas las tarjetas', sec('plataforma').size === SECCIONES_CURSO.length)
check('Docente: contenido, exámenes, tareas y foro', ['modulos', 'examenes', 'tareas', 'foro', 'avance'].every((s) => sec('docente').has(s)))
const genDocente = elementosDeSeccion('generaciones', contextoSimulado('docente', []))
check('Docente: en Generaciones solo pasa lista',
  genDocente.find((e) => e.clave === 'asistencia').permitido && !genDocente.find((e) => e.clave === 'generaciones').permitido)
check('Coordinación: generaciones, participantes y avance', ['generaciones', 'participantes', 'avance'].every((s) => sec('coordinacion').has(s)))
check('Coordinación: no edita módulos ni exámenes', !sec('coordinacion').has('modulos') && !sec('coordinacion').has('examenes'))
check('Dirección: no edita contenido ni foro', !sec('direccion').has('modulos') && !sec('direccion').has('foro'))
const textos = ELEMENTOS.find((e) => e.clave === 'sitio.textos')
check('Textos del sitio: solo quien administra', !permite(textos, contextoSimulado('docente', [])) && permite(textos, { permisos: new Set(), esAdminOrg: true }))
const orgs = ELEMENTOS.find((e) => e.clave === 'organizaciones')
check('Organizaciones: ni el admin de un cliente', !permite(orgs, { permisos: new Set(), esAdminOrg: true }))
check('Un rol cambiado en la base manda sobre el de nacimiento',
  permisosDePerfil('coordinacion', [{ nombre: 'Coordinación', permisos: ['cursos.editar'] }]).has('cursos.editar') &&
  !permisosDePerfil('coordinacion', [{ nombre: 'coordinacion', permisos: [] }]).has('alumnos.ver'))
check('Quien facilita un curso gestiona como Docente',
  seccionesPermitidas(contextoReal({ esFacilitador: true })).has('modulos'))
check('Sin rol ni curso no abre nada', seccionesPermitidas(contextoReal({})).size === 0)

console.log('\n=== ALTA DE FACILITADORES ===')
const nuevasF = filasFacilitadorNuevas(
  [{ email: 'Ana@X.mx ', curso_id: 1 }, { email: 'ana@x.mx', curso_id: 1 }, { email: 'ana@x.mx', curso_id: 2 }, { email: 'beto@x.mx', curso_id: 1 }],
  [{ email: 'ANA@x.mx', curso_id: 2 }])
check('Solo inserta lo que falta, sin repetir y con el correo en minúsculas',
  JSON.stringify(nuevasF) === JSON.stringify([{ email: 'ana@x.mx', curso_id: 1 }, { email: 'beto@x.mx', curso_id: 1 }]), JSON.stringify(nuevasF))

console.log('\n=== ESTADOS Y PÁGINA ===')
check('Curso archivado', estadoCurso({ activo: false, proximamente: true }) === 'archivado')
check('Curso próximamente', estadoCurso({ proximamente: true }) === 'proximamente')
check('Módulo oculto', estadoModulo({ disponible: false }) === 'oculto')
check('Módulo programado', estadoModulo({ abre_el: '2999-01-01' }) === 'programado')
check('Módulo cerrado', estadoModulo({ cierra_el: '2000-01-01' }) === 'cerrado')
const pag = llenadoPagina({ curso: { titulo: 'X', rutas_botones: {} }, modulos: [{ id: 1 }], recursos: [{ tipo: 'pdf' }, { tipo: 'video', disponible: false }], temasForo: 0 })
check('Foro sin temas: vacío (no se muestra)', pag.curso.find((s) => s.clave === 'foro').lleno === false)
check('Contenido con módulos: lleno', pag.curso.find((s) => s.clave === 'contenido').lleno === true)
check('Lectura usada, grabación oculta no cuenta',
  pag.modulo.find((s) => s.clave === 'material.lectura').lleno === true &&
  pag.modulo.find((s) => s.clave === 'material.grabacion').lleno === false)
const cuenta = contarPorCurso([{ id: 1 }, { id: 2 }], {
  modulos: [{ id: 10, curso_id: 1 }], recursos: [{ modulo_id: 10 }, { modulo_id: 10 }],
  examenes: [{ curso_id: 2 }, { modulo_id: 10 }], tareas: [{ modulo_id: 10 }], hilos: [{ curso_id: 1 }],
})
check('Cuenta por curso (también lo que cuelga de un módulo)',
  cuenta[1].modulos === 1 && cuenta[1].materiales === 2 && cuenta[1].examenes === 1 && cuenta[2].examenes === 1 &&
  cuenta[1].tareas === 1 && cuenta[1].temas === 1, JSON.stringify(cuenta))

console.log('\n' + '─'.repeat(56))
console.log(`  ${ok} pruebas OK / ${fallos.length} fallos`)
process.exit(fallos.length ? 1 : 0)
