/**
 * Pruebas de los permisos por rol.
 *
 * El error que importa aquí tiene dos formas y las dos son caras:
 * enseñarle a alguien un botón que no le toca —y que al pulsarlo le
 * da un error feo, o peor, que la base le deja— o esconderle uno que
 * sí le toca, y entonces el rol no sirve para nada.
 *
 * El caso que más se descuida es el ámbito: un coordinador de UNA
 * sede no debe mandar en las demás, y la regla es fácil de invertir
 * sin notarlo.
 *
 * Uso: node supabase/test-roles.mjs
 */
const {
  indicePermisos, puede, puedeAlguno, porGrupo,
  resumenRol, rolVacio, ambitoDe, GRUPOS_PERMISO,
} = await import('../src/lib/roles.js')

let ok = 0
const fallos = []

function check(nombre, condicion, detalle = '') {
  if (condicion) {
    ok++
    console.log(`  OK   ${nombre}`)
  } else {
    fallos.push(`${nombre}${detalle ? ' → ' + detalle : ''}`)
    console.log(`  FALLA ${nombre}${detalle ? ' → ' + detalle : ''}`)
  }
}

console.log('\n=== LO BÁSICO ===')
{
  const i = indicePermisos([
    { permiso: 'alumnos.ver', sede_id: null, categoria_id: null },
    { permiso: 'asistencia.pasar', sede_id: null, categoria_id: null },
  ])
  check('tiene lo que se le dio', puede(i, 'alumnos.ver') === true)
  check('no tiene lo que no', puede(i, 'cursos.editar') === false)
  check('un índice vacío no concede nada', puede({}, 'alumnos.ver') === false)
  check('un índice nulo no truena', puede(null, 'alumnos.ver') === false)
  check('una lista nula da un índice vacío',
    Object.keys(indicePermisos(null)).length === 0)
}

console.log('\n=== EL ÁMBITO (lo que más se invierte) ===')
{
  // Coordinador de la sede 7, y de ninguna más.
  const i = indicePermisos([
    { permiso: 'grupos.gestionar', sede_id: 7, categoria_id: null },
  ])
  check('puede en SU sede',
    puede(i, 'grupos.gestionar', { sede: 7, categoria: null }) === true)
  check('NO puede en otra sede',
    puede(i, 'grupos.gestionar', { sede: 9, categoria: null }) === false)
  check('sin preguntar por el sitio, cuenta como que puede en alguno',
    puede(i, 'grupos.gestionar') === true)
}
{
  // Sin ámbito: vale en todas partes.
  const i = indicePermisos([
    { permiso: 'grupos.gestionar', sede_id: null, categoria_id: null },
  ])
  check('sin ámbito vale en cualquier sede',
    puede(i, 'grupos.gestionar', { sede: 9, categoria: 3 }) === true)
}
{
  // Dos asignaciones del mismo permiso, en dos sedes.
  const i = indicePermisos([
    { permiso: 'grupos.gestionar', sede_id: 7, categoria_id: null },
    { permiso: 'grupos.gestionar', sede_id: 9, categoria_id: null },
  ])
  check('vale en las dos sedes que le dieron',
    puede(i, 'grupos.gestionar', { sede: 7 }) &&
    puede(i, 'grupos.gestionar', { sede: 9 }))
  check('y no en una tercera',
    puede(i, 'grupos.gestionar', { sede: 11 }) === false)
}
{
  // Por categoría: jefatura de una carrera.
  const i = indicePermisos([
    { permiso: 'cursos.editar', sede_id: null, categoria_id: 4 },
  ])
  check('puede en su categoría',
    puede(i, 'cursos.editar', { sede: 1, categoria: 4 }) === true)
  check('no en otra categoría',
    puede(i, 'cursos.editar', { sede: 1, categoria: 5 }) === false)
}
{
  // Las dos a la vez: sede Y categoría tienen que encajar.
  const i = indicePermisos([
    { permiso: 'x', sede_id: 7, categoria_id: 4 },
  ])
  check('con las dos, encaja solo si encajan ambas',
    puede(i, 'x', { sede: 7, categoria: 4 }) === true)
  check('falla si la sede no es', puede(i, 'x', { sede: 8, categoria: 4 }) === false)
  check('falla si la categoría no es', puede(i, 'x', { sede: 7, categoria: 5 }) === false)
}

console.log('\n=== VARIOS PERMISOS ===')
{
  const i = indicePermisos([{ permiso: 'alumnos.ver', sede_id: null, categoria_id: null }])
  check('basta con uno de la lista',
    puedeAlguno(i, ['cursos.editar', 'alumnos.ver']) === true)
  check('ninguno de la lista, no',
    puedeAlguno(i, ['cursos.editar', 'foro.moderar']) === false)
  check('una lista vacía no concede nada', puedeAlguno(i, []) === false)
  check('una lista nula no truena', puedeAlguno(i, null) === false)
}

console.log('\n=== AGRUPAR EL CATÁLOGO ===')
{
  const catalogo = [
    { clave: 'a', grupo: 'Personas', orden: 20 },
    { clave: 'b', grupo: 'Contenido', orden: 10 },
    { clave: 'c', grupo: 'Personas', orden: 10 },
    { clave: 'd', grupo: 'Inventado', orden: 5 },
  ]
  const g = porGrupo(catalogo)
  check('Contenido va primero', g[0][0] === 'Contenido', g[0][0])
  check('dentro de un grupo, por orden',
    g.find(([n]) => n === 'Personas')[1].map(p => p.clave).join() === 'c,a')
  check('un grupo desconocido no se pierde',
    g.some(([n]) => n === 'Inventado'))
  check('y va al final', g[g.length - 1][0] === 'Inventado', g[g.length - 1][0])
  check('los grupos conocidos están documentados', GRUPOS_PERMISO.length === 6)
  check('un catálogo vacío no truena', porGrupo([]).length === 0)
}

console.log('\n=== RESUMEN DE UN ROL ===')
{
  const catalogo = [
    { clave: 'a', grupo: 'Personas' },
    { clave: 'b', grupo: 'Contenido' },
    { clave: 'c', grupo: 'Personas' },
  ]
  const r = resumenRol(['a', 'b', 'c'], catalogo)
  check('cuenta los permisos', r.total === 3)
  check('no repite los grupos', r.grupos.length === 2, r.grupos.join())
  const vacio = resumenRol([], catalogo)
  check('un rol sin permisos lo dice', vacio.texto === 'Sin permisos')
  check('una clave que no está en el catálogo no truena',
    resumenRol(['zzz'], catalogo).total === 1)
}
check('un rol sin permisos se detecta', rolVacio([]) === true)
check('y uno nulo también', rolVacio(null) === true)
check('uno con permisos, no', rolVacio(['a']) === false)

console.log('\n=== NOMBRE DEL ÁMBITO ===')
{
  const sedes = [{ id: 7, nombre: 'Plantel Norte' }]
  const cats = [{ id: 4, nombre: 'Clínica' }]
  check('sin ámbito lo dice claro',
    ambitoDe({ sede_id: null, categoria_id: null }, sedes, cats)
      === 'Toda la organización')
  check('nombra la sede',
    ambitoDe({ sede_id: 7 }, sedes, cats) === 'Plantel Norte')
  check('nombra la categoría',
    ambitoDe({ categoria_id: 4 }, sedes, cats) === 'Clínica')
  check('las dos juntas',
    ambitoDe({ sede_id: 7, categoria_id: 4 }, sedes, cats) === 'Plantel Norte · Clínica')
  check('una sede borrada no deja el renglón en blanco',
    ambitoDe({ sede_id: 99 }, sedes, cats) === 'una sede')
  check('una asignación nula no truena',
    ambitoDe(null, sedes, cats) === 'Toda la organización')
}

console.log('\n' + '─'.repeat(56))
console.log(`  ${ok} pruebas OK / ${fallos.length} fallos`)
for (const f of fallos) console.log(`  ✗ ${f}`)
process.exit(fallos.length ? 1 : 0)
