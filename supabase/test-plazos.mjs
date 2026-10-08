/**
 * Pruebas de los plazos.
 *
 * Equivocarse aquí tiene dos formas, y las dos son malas: dejar
 * entregar a quien ya no debía —y entonces la fecha no significaba
 * nada— o cerrarle la puerta a quien sí estaba a tiempo, que es peor
 * porque le cuesta la calificación a alguien que cumplió.
 *
 * El caso que más se descuida es la prórroga: tiene que ampliar
 * siempre, nunca acortar, ni aunque se teclee mal.
 *
 * Uso: node supabase/test-plazos.mjs
 */
const {
  estadoPlazo, masTarde, enPalabras, aCampoLocal, deCampoLocal,
  indicePorActividad, prorrogaDe, AVISO_HORAS,
} = await import('../src/lib/plazos.js')

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

const AHORA = Date.parse('2026-06-15T12:00:00Z')
const enHoras = (h) => new Date(AHORA + h * 3600000).toISOString()
const act = (extra) => ({ fecha_limite: null, cierra_al_vencer: true, ...extra })

console.log('\n=== SIN FECHA, TODO ABIERTO ===')
{
  const e = estadoPlazo(act(), null, AHORA)
  check('sin fecha no hay plazo', e.clave === 'sin_plazo')
  check('y está abierto', e.abierto === true)
  check('no marca como tarde', e.tarde === false)
}
check('una actividad nula no truena', estadoPlazo(null, null, AHORA).abierto === true)

console.log('\n=== ABIERTO Y POR VENCER ===')
{
  const e = estadoPlazo(act({ fecha_limite: enHoras(240) }), null, AHORA)
  check('con tiempo de sobra está abierto', e.clave === 'abierto')
  check('en verde', e.tono === 'ok')
}
{
  const e = estadoPlazo(act({ fecha_limite: enHoras(5) }), null, AHORA)
  check('con pocas horas avisa', e.clave === 'por_vencer', e.clave)
  check('en ámbar', e.tono === 'aviso')
  check('pero sigue abierto', e.abierto === true)
}
check(`el umbral del aviso son ${AVISO_HORAS} h`,
  estadoPlazo(act({ fecha_limite: enHoras(AVISO_HORAS - 1) }), null, AHORA).clave === 'por_vencer' &&
  estadoPlazo(act({ fecha_limite: enHoras(AVISO_HORAS + 1) }), null, AHORA).clave === 'abierto')
{
  // El minuto exacto del cierre todavía cuenta como dentro.
  const e = estadoPlazo(act({ fecha_limite: new Date(AHORA).toISOString() }), null, AHORA)
  check('justo en la fecha aún se admite', e.abierto === true, e.clave)
}

console.log('\n=== VENCIDO: CERRAR O ADMITIR TARDE ===')
{
  const e = estadoPlazo(act({ fecha_limite: enHoras(-3) }), null, AHORA)
  check('con cierre, cerrado', e.clave === 'cerrado')
  check('y no se puede entregar', e.abierto === false)
  check('en rojo', e.tono === 'alerta')
}
{
  const e = estadoPlazo(act({ fecha_limite: enHoras(-3), cierra_al_vencer: false }), null, AHORA)
  check('sin cierre, se admite tarde', e.clave === 'tarde')
  check('sigue abierto', e.abierto === true)
  check('pero marcado como tardío', e.tarde === true)
  check('y se dice en el texto', /tarde/i.test(e.etiqueta), e.etiqueta)
}

console.log('\n=== PRÓRROGAS ===')
{
  const a = act({ fecha_limite: enHoras(-3) })
  check('sin prórroga, cerrado', estadoPlazo(a, null, AHORA).abierto === false)
  const e = estadoPlazo(a, enHoras(24), AHORA)
  check('con prórroga, vuelve a abrir', e.abierto === true, e.clave)
  check('y la fecha que manda es la de la prórroga',
    e.fecha === enHoras(24), String(e.fecha))
}
{
  // Lo más importante de este archivo.
  const a = act({ fecha_limite: enHoras(48) })
  const e = estadoPlazo(a, enHoras(2), AHORA)
  check('una prórroga ANTERIOR no acorta el plazo',
    e.fecha === enHoras(48), String(e.fecha))
}
check('masTarde con uno nulo devuelve el otro',
  masTarde(null, enHoras(5)) === enHoras(5) && masTarde(enHoras(5), null) === enHoras(5))
check('masTarde con los dos nulos devuelve null', masTarde(null, null) === null)
{
  const a = act({ fecha_limite: null })
  check('sin fecha base, la prórroga manda igual',
    estadoPlazo(a, enHoras(10), AHORA).fecha === enHoras(10))
}

console.log('\n=== EN PALABRAS ===')
check('futuro cercano', enPalabras(2 * 3600000) === 'en 2 horas')
check('futuro en días', enPalabras(3 * 86400000) === 'en 3 días')
check('singular sin ese', enPalabras(86400000) === 'en 1 día')
check('pasado', enPalabras(-2 * 3600000) === 'hace 2 horas')
check('minutos', enPalabras(5 * 60000) === 'en 5 minutos')
check('menos de un minuto no dice "en 0 minutos"',
  enPalabras(30000) === 'en menos de un minuto')
check('un momento, hacia atrás', enPalabras(-30000) === 'hace un momento')
check('meses para lo muy lejano', /mes/.test(enPalabras(90 * 86400000)))

console.log('\n=== EL CAMPO DE FECHA DEL NAVEGADOR ===')
{
  // `toISOString` daría UTC y la hora saldría corrida al abrir el
  // editor. Se comprueba contra la hora local, que es lo que ve quien
  // edita.
  const d = new Date(2026, 5, 15, 9, 30)
  const campo = aCampoLocal(d.toISOString())
  check('conserva la hora local', campo === '2026-06-15T09:30', campo)
  check('ida y vuelta no mueve la fecha',
    new Date(deCampoLocal(campo)).getTime() === d.getTime())
}
check('un campo vacío da null', deCampoLocal('') === null)
check('una fecha inválida da null', deCampoLocal('no soy fecha') === null)
check('un valor nulo da cadena vacía', aCampoLocal(null) === '')
check('una fecha corrupta no truena', aCampoLocal('xxx') === '')

console.log('\n=== ÍNDICE DE PRÓRROGAS ===')
{
  const idx = indicePorActividad([
    { tipo: 'tarea', actividad_id: 7, nueva_fecha: enHoras(10) },
    { tipo: 'tarea', actividad_id: 7, nueva_fecha: enHoras(30) },
    { tipo: 'examen', actividad_id: 7, nueva_fecha: enHoras(5) },
  ])
  check('entre dos del mismo, manda la más tardía',
    prorrogaDe(idx, 'tarea', 7) === enHoras(30), String(prorrogaDe(idx, 'tarea', 7)))
  check('no confunde tipos con el mismo id',
    prorrogaDe(idx, 'examen', 7) === enHoras(5))
  check('lo que no tiene prórroga da null',
    prorrogaDe(idx, 'foro', 7) === null)
  check('un índice vacío no truena', prorrogaDe({}, 'tarea', 1) === null)
  check('una lista nula no truena',
    Object.keys(indicePorActividad(null)).length === 0)
}

console.log('\n' + '─'.repeat(56))
console.log(`  ${ok} pruebas OK / ${fallos.length} fallos`)
for (const f of fallos) console.log(`  ✗ ${f}`)
process.exit(fallos.length ? 1 : 0)
