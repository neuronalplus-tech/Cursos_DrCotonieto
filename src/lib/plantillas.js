/* ============================================================
   PLANTILLAS DE DOCUMENTOS
   ------------------------------------------------------------
   Actas, constancias, listas de asistencia e informes. Cada
   institución pide el suyo con su formato, su logo y su redacción,
   así que la plantilla la configura el cliente y aquí solo se
   rellena.

   CÓMO SE ESCRIBE UNA PLANTILLA
   Texto normal con marcadores entre llaves dobles:

       La institución {{institucion.nombre}} hace constar que
       {{alumno.nombre}} acreditó {{curso.titulo}} con un promedio
       de {{calificacion.final}}.

   Y bloques que se repiten, para las tablas:

       {{#modulos}}
       <tr><td>{{titulo}}</td><td>{{calificacion}}</td></tr>
       {{/modulos}}

   POR QUÉ UN MOTOR PROPIO Y NO UNA LIBRERÍA
   Porque las de plantillas traen ejecución de código, y aquí la
   plantilla la escribe el cliente: sería dejarle ejecutar lo que
   quiera dentro de la sesión de sus propios alumnos. Esto solo
   sustituye texto y repite bloques. No evalúa nada.

   LO QUE NO SE ENCUENTRA SE DEJA MARCADO
   Un marcador sin dato no desaparece: queda como «⟨sin dato⟩». Un
   hueco en blanco en un acta pasa desapercibido hasta que alguien
   la firma; uno marcado, no.
   ============================================================ */

/** Lo que el cliente puede usar, para enseñárselo en el editor. */
export const MARCADORES = [
  ['institucion.nombre', 'Nombre de la institución'],
  ['institucion.contacto', 'Correo de contacto'],
  ['curso.titulo', 'Nombre del curso o programa'],
  ['grupo.nombre', 'Generación o grupo'],
  ['grupo.modalidad', 'En línea / Presencial / Mixta'],
  ['grupo.inicio', 'Fecha de inicio'],
  ['grupo.fin', 'Fecha de término'],
  ['sede.nombre', 'Sede o plantel'],
  ['alumno.nombre', 'Nombre del alumno'],
  ['alumno.profesion', 'Profesión del alumno'],
  ['calificacion.final', 'Calificación final'],
  ['calificacion.letra', 'La calificación con letra'],
  ['calificacion.tipo', 'Ponderada o promedio simple'],
  ['asistencia.porcentaje', 'Porcentaje de asistencia'],
  ['asistencia.sesiones', 'Sesiones del grupo'],
  ['asistencia.faltas', 'Faltas del alumno'],
  ['docente.nombre', 'Quien imparte'],
  ['fecha.hoy', 'Fecha de emisión, con letra'],
  ['fecha.lugar', 'Ciudad de la sede'],
]

/** Bloques que se repiten. */
export const BLOQUES = [
  ['modulos', 'Un renglón por módulo, con su calificación'],
  ['alumnos', 'Un renglón por alumno del grupo'],
  ['sesiones', 'Un renglón por sesión, para la lista de asistencia'],
]

export const SIN_DATO = '⟨sin dato⟩'

/* Escapar es obligatorio: el nombre de un alumno puede traer `&` o
   `<`, y sin escapar rompería el HTML del documento o, peor, metería
   etiquetas donde no debe. */
export function escapar(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Busca `a.b.c` dentro del objeto de datos. */
function valorDe(datos, ruta) {
  let v = datos
  for (const parte of String(ruta).split('.')) {
    if (v == null || typeof v !== 'object') return undefined
    v = v[parte]
  }
  return v
}

/**
 * Rellena una plantilla.
 *
 * @param plantilla  el texto con marcadores
 * @param datos      { institucion: {...}, alumno: {...}, modulos: [...] }
 * @param opciones   { escaparHtml = true }
 */
export function rellenar(plantilla, datos, opciones = {}) {
  const esc = opciones.escaparHtml === false ? (x) => String(x ?? '') : escapar
  let texto = String(plantilla || '')

  // 1) Bloques repetidos. Van primero: dentro de un bloque hay
  //    marcadores que solo tienen sentido con la fila delante.
  texto = texto.replace(
    /\{\{#([a-z_]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g,
    (_, nombre, cuerpo) => {
      const filas = datos?.[nombre]
      if (!Array.isArray(filas) || !filas.length) return ''
      return filas.map((fila, i) => {
        // Dentro del bloque, `{{campo}}` es de la fila; si no está
        // ahí, se busca en los datos generales, que es lo que permite
        // poner el nombre de la institución dentro de la tabla.
        //
        // `{{indice}}` es el número de renglón. Se llamó `{{indice}}`
        // en el primer intento y chocaba con la sintaxis de bloques:
        // la almohadilla ABRE un bloque, así que `{{indice}}` se leía
        // como un bloque «indice» sin cerrar.
        return cuerpo.replace(/\{\{\s*([a-z_.]+)\s*\}\}/gi, (m2, clave) => {
          if (clave === 'indice') return String(i + 1)
          const v = valorDe(fila, clave) ?? valorDe(datos, clave)
          return v == null || v === '' ? SIN_DATO : esc(v)
        })
      }).join('')
    },
  )

  // 2) Marcadores sueltos.
  texto = texto.replace(/\{\{\s*([a-z_.]+)\s*\}\}/gi, (m, clave) => {
    const v = valorDe(datos, clave)
    return v == null || v === '' ? SIN_DATO : esc(v)
  })

  return texto
}

/** Los marcadores que una plantilla usa y no existen en el catálogo. */
export function marcadoresDesconocidos(plantilla) {
  const validos = new Set(MARCADORES.map(([k]) => k))
  const bloques = new Set(BLOQUES.map(([k]) => k))
  const texto = String(plantilla || '')

  // Lo que está dentro de un bloque se resuelve contra la fila, así
  // que no se puede validar contra el catálogo: se quita antes.
  const fuera = texto.replace(/\{\{#([a-z_]+)\}\}[\s\S]*?\{\{\/\1\}\}/g, '')

  const vistos = new Set()
  for (const m of fuera.matchAll(/\{\{\s*([a-z_.]+)\s*\}\}/gi)) {
    const clave = m[1]
    if (!validos.has(clave) && !bloques.has(clave)) vistos.add(clave)
  }
  return [...vistos]
}

/** Bloques abiertos y sin cerrar: el error de tecleo más común. */
export function bloquesSinCerrar(plantilla) {
  const texto = String(plantilla || '')
  const abiertos = [...texto.matchAll(/\{\{#([a-z_]+)\}\}/g)].map(m => m[1])
  const cerrados = [...texto.matchAll(/\{\{\/([a-z_]+)\}\}/g)].map(m => m[1])
  const falta = []
  for (const a of abiertos) {
    const i = cerrados.indexOf(a)
    if (i === -1) falta.push(a)
    else cerrados.splice(i, 1)
  }
  return falta
}

/* ------------------------------------------------------------
   LA CALIFICACIÓN CON LETRA
   ------------------------------------------------------------
   Un acta suele pedirla escrita además de en número, porque un `8`
   se altera con un trazo y «OCHO» no.
   ------------------------------------------------------------ */
const UNIDADES = ['CERO', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO',
  'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE',
  'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO',
  'DIECINUEVE', 'VEINTE']
const DECENAS = ['', '', 'VEINTI', 'TREINTA', 'CUARENTA', 'CINCUENTA',
  'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA']

function enteroConLetra(n) {
  if (n <= 20) return UNIDADES[n]
  if (n === 100) return 'CIEN'
  if (n < 100) {
    const d = Math.floor(n / 10)
    const u = n % 10
    if (d === 2) return u ? DECENAS[2] + UNIDADES[u] : 'VEINTE'
    return u ? `${DECENAS[d]} Y ${UNIDADES[u]}` : DECENAS[d]
  }
  return String(n)
}

/** 87.5 -> «OCHENTA Y SIETE PUNTO CINCO». */
export function conLetra(valor) {
  if (valor == null || valor === '') return ''
  const n = Number(valor)
  if (!Number.isFinite(n)) return ''
  const entero = Math.floor(n)
  const decimal = Math.round((n - entero) * 10)
  const base = enteroConLetra(entero)
  return decimal ? `${base} PUNTO ${UNIDADES[decimal]}` : base
}

/** «8 de octubre de 2026», que es como se escribe en un documento. */
export function fechaConLetra(fecha = new Date()) {
  const d = fecha instanceof Date ? fecha : new Date(fecha)
  if (Number.isNaN(d.getTime())) return ''
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`
}

/* ------------------------------------------------------------
   PLANTILLAS DE ARRANQUE
   ------------------------------------------------------------
   Para que nadie empiece con una hoja en blanco. Se copian y se
   editan; no son lo que ninguna institución va a usar tal cual.
   ------------------------------------------------------------ */
export const EJEMPLOS = {
  constancia: `<h1>CONSTANCIA</h1>
<p>{{institucion.nombre}} hace constar que</p>
<h2>{{alumno.nombre}}</h2>
<p>acreditó <strong>{{curso.titulo}}</strong>, impartido en la modalidad
{{grupo.modalidad}} del {{grupo.inicio}} al {{grupo.fin}},
con una calificación final de <strong>{{calificacion.final}}</strong>
({{calificacion.letra}}) y {{asistencia.porcentaje}}% de asistencia.</p>
<p>{{fecha.lugar}}, a {{fecha.hoy}}.</p>`,

  acta: `<h1>ACTA DE CALIFICACIONES</h1>
<p><strong>{{curso.titulo}}</strong> · Grupo {{grupo.nombre}} · {{sede.nombre}}</p>
<p>Imparte: {{docente.nombre}}</p>
<table>
  <thead><tr><th>#</th><th>Alumno</th><th>Calificación</th><th>Asistencia</th></tr></thead>
  <tbody>
{{#alumnos}}
    <tr><td>{{indice}}</td><td>{{nombre}}</td><td>{{calificacion}}</td><td>{{asistencia}}%</td></tr>
{{/alumnos}}
  </tbody>
</table>
<p>{{fecha.lugar}}, a {{fecha.hoy}}.</p>`,

  lista: `<h1>LISTA DE ASISTENCIA</h1>
<p><strong>{{curso.titulo}}</strong> · Grupo {{grupo.nombre}} · {{sede.nombre}}</p>
<table>
  <thead><tr><th>#</th><th>Alumno</th><th>Asistencia</th><th>Faltas</th></tr></thead>
  <tbody>
{{#alumnos}}
    <tr><td>{{indice}}</td><td>{{nombre}}</td><td>{{asistencia}}%</td><td>{{faltas}}</td></tr>
{{/alumnos}}
  </tbody>
</table>
<p>Sesiones impartidas: {{asistencia.sesiones}}</p>`,
}
