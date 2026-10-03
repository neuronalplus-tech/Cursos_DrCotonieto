/* ============================================================
   LÓGICA DE EXÁMENES — funciones puras (sin React ni Supabase)

   Tipos de pregunta soportados:
     · opcion    → opciones[] con { texto, correcta }
     · vf        → Verdadero / Falso (2 opciones automáticas)
     · corta     → respuesta esperada; acepta variantes con "|" o ";"
     · emparejar → pares[] con { id, premisa, respuesta }

   Compatibilidad: las preguntas viejas (sin `tipo`) siguen siendo
   tipo "opcion", igual que antes del refactor.
   ============================================================ */

export const TIPOS_EXAMEN = ['opcion', 'vf', 'corta', 'emparejar']

export const ETIQUETA_TIPO = {
  opcion: 'Opción múltiple',
  vf: 'Verdadero / Falso',
  corta: 'Respuesta corta',
  emparejar: 'Emparejar',
}

/** Deduce el tipo de una pregunta. Si no viene `tipo`, usa heurística (V/F o opción múltiple). */
export const tipoDe = (p) => {
  if (p?.tipo) return p.tipo
  return (p?.opciones?.length === 2 &&
    p.opciones.every(o => /^(verdadero|falso|v|f)$/i.test((o.texto || '').trim())))
    ? 'vf' : 'opcion'
}

/** ¿La respuesta dada es correcta? `r` es lo que el alumno eligió/respondió. */
export const esCorrecta = (p, r) => {
  if (r == null || r === '') return false
  const tipo = tipoDe(p)
  if (tipo === 'vf' || tipo === 'opcion') {
    const idx = typeof r === 'number' ? r : parseInt(r, 10)
    return !!(p.opciones?.[idx]?.correcta)
  }
  if (tipo === 'corta') {
    const esperado = (p.respuesta || '').trim().toLowerCase()
    const dada = String(r).trim().toLowerCase()
    if (!esperado) return false
    if (dada === esperado) return true
    // Acepta variantes separadas por "|" o ";" (ej. "TEPT|trastorno de estrés postraumático")
    return esperado.split(/[|;]/).map(s => s.trim()).filter(Boolean).includes(dada)
  }
  if (tipo === 'emparejar') {
    const pares = p.pares || []
    if (!pares.length || typeof r !== 'object') return false
    return pares.every(par => String(r[par.id] ?? '').trim() === String(par.respuesta ?? '').trim())
  }
  return false
}

/** Califica el examen completo. */
export const calificar = (preguntas, respuestas, umbral) => {
  const lista = preguntas || []
  let correctas = 0
  lista.forEach(p => { if (esCorrecta(p, respuestas?.[p.id])) correctas++ })
  const calificacion = lista.length ? Math.round((correctas / lista.length) * 100) : 0
  return { calificacion, aprobado: calificacion >= (umbral ?? 0), correctas, total: lista.length }
}

/* ------------------------------------------------------------
   IMPORTADOR / EXPORTADOR desde Excel o Google Sheets
   ------------------------------------------------------------ */

/** Columnas, en orden. Deben coincidir con la plantilla. */
export const COLUMNAS_EXAMEN = [
  'tipo', 'pregunta', 'op1', 'op2', 'op3', 'op4', 'op5',
  'correcta', 'respuesta', 'pares',
]

/** Encabezados legibles para mostrar en la interfaz. */
export const ENCABEZADOS_EXAMEN = [
  'tipo', 'pregunta', 'opción 1', 'opción 2', 'opción 3', 'opción 4', 'opción 5',
  'correcta', 'respuesta', 'pares',
]

/** Texto de ejemplo que se puede pegar en la interfaz o guardar como .tsv */
export const PLANTILLA_TSV = [
  COLUMNAS_EXAMEN.join('\t'),
  ['opcion', '¿Cuál de estos NO es un criterio del duelo normativo?',
    'Perder a la persona querible', 'Que la tristeza disminuya en 6 meses',
    'Que el vínculo con la persona falleada se reorganice', '', '', '2', '', ''].join('\t'),
  ['vf', 'El duelo normativo se distingue del prolongado por su intensidad, no por su duración.',
    '', '', '', '', '', '1', '', ''].join('\t'),
  ['corta', '¿Qué siglas tiene el trastorno de estrés postraumático?',
    '', '', '', '', '', '', 'TEPT|trastorno de estrés postraumático', ''].join('\t'),
  ['emparejar', 'Relaciona cada enfoque con su objetivo',
    '', '', '', '', '', '', '', 'ACT=Aceptar; DBT=Regular; Proceso Dual=Restaurar'].join('\t'),
].join('\n')

/** Divide una línea de texto en celdas: respeta comillas dobles (CSV estándar). */
export function separarLinea(linea, sep) {
  const out = []
  let cur = ''
  let enComillas = false
  for (let i = 0; i < linea.length; i++) {
    const ch = linea[i]
    if (ch === '"') {
      if (enComillas && linea[i + 1] === '"') { cur += '"'; i++ }
      else enComillas = !enComillas
    } else if (ch === sep && !enComillas) {
      out.push(cur); cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out
}

/** Detecta el separador del texto pegado: tabulador (Excel/Sheets) o coma (CSV). */
export function detectarSeparador(texto) {
  const muestra = texto.split(/\r?\n/).slice(0, 5).join('\n')
  const tabs = (muestra.match(/\t/g) || []).length
  const commas = (muestra.match(/,/g) || []).length
  return tabs >= commas ? '\t' : ','
}

/** Normaliza un encabezado: minúsculas, sin acentos, solo letras y números. */
export const normalizarEncabezado = (s) => String(s || '')
  .toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]/g, '')

/** Traduce un encabezado a una de nuestras columnas, o null si no se reconoce. */
export function columnaDesdeEncabezado(k) {
  if (k === 'tipo' || k === 'tipodepregunta') return 'tipo'
  if (k === 'pregunta' || k === 'enunciado') return 'pregunta'
  // op1..op5 / opcion1..opcion5 / "Opción 3"
  const m = k.match(/^op(?:cion)?([1-5])$/)
  if (m) return 'op' + m[1]
  // A..E (encabezado típico de hoja de cálculo)
  const letra = k.match(/^([a-e])$/)
  if (letra) return 'op' + String(letra[1].charCodeAt(0) - 96)
  if (k === 'correcta' || k === 'correcto' || k === 'respuestacorrecta') return 'correcta'
  if (k === 'respuesta') return 'respuesta'
  if (k === 'pares') return 'pares'
  return null
}

/**
 * Convierte texto pegado (TSV o CSV) en filas de objetos.
 * · Si la primera línea trae encabezados reconocibles, mapea POR NOMBRE
 *   (acepta "Opción 2", "Correcta", "Respuesta correcta", etc.), aunque
 *   la tabla tenga menos de 10 columnas.
 * · Si no hay encabezado, asume el orden fijo de COLUMNAS_EXAMEN.
 */
export function parseTabla(texto) {
  if (!texto || !texto.trim()) return []
  const sep = detectarSeparador(texto)
  const lineas = texto.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    .split('\n').filter(l => l.trim() !== '')

  const celdas = lineas.map(l => separarLinea(l, sep).map(c => c.trim()))

  // Mapear por nombre de encabezado
  const mapa = {}
  ;(celdas[0] || []).forEach((c, i) => {
    const col = columnaDesdeEncabezado(normalizarEncabezado(c))
    if (col && mapa[col] == null) mapa[col] = i
  })

  const columnas = Object.keys(mapa)
  const cuerpo = columnas.length >= 3 ? celdas.slice(1) : celdas

  return cuerpo
    .filter(c => (c[1] || '').trim() !== '' || (c[0] || '').trim() !== '')
    .map(c => {
      const fila = {}
      COLUMNAS_EXAMEN.forEach(col => {
        fila[col] = columnas.length >= 3 && mapa[col] != null ? (c[mapa[col]] ?? '') : (c[COLUMNAS_EXAMEN.indexOf(col)] ?? '')
      })
      return fila
    })
}

/** Convierte "ACT=Aceptar; DBT=Regular" en [{id,premisa,respuesta}] */
export function parsePares(texto) {
  return String(texto || '')
    .split(/[;\n]/)
    .map(s => s.trim())
    .filter(Boolean)
    .map((s, i) => {
      const pos = s.indexOf('=')
      const premisa = (pos === -1 ? s : s.slice(0, pos)).trim()
      const respuesta = (pos === -1 ? '' : s.slice(pos + 1)).trim()
      return { id: `p${i + 1}`, premisa, respuesta }
    })
    .filter(p => p.premisa && p.respuesta)
}

/**
 * Convierte filas (TSV/CSV) en preguntas normalizadas.
 * @returns {{ preguntas: Array, errores: string[] }}
 */
export function filasAPreguntas(filas) {
  const preguntas = []
  const errores = []
  let n = 0

  filas.forEach((f, i) => {
    const fila = i + 1
    const texto = String(f.pregunta || '').trim()
    if (!texto) return // fila vacía → se ignora sin quejarse

    const tipoRaw = String(f.tipo || '').trim().toLowerCase()
    const tipo = TIPOS_EXAMEN.includes(tipoRaw) ? tipoRaw : 'opcion'
    n++

    if (tipo === 'opcion') {
      const ops = ['op1', 'op2', 'op3', 'op4', 'op5']
        .map(k => String(f[k] || '').trim()).filter(Boolean)
      if (ops.length < 2) {
        errores.push(`Fila ${fila}: "opcion" necesita al menos 2 opciones.`)
        return
      }
      const c = String(f.correcta || '').trim()
      let idx = -1
      if (/^\d+$/.test(c)) {
        const i2 = parseInt(c, 10) - 1
        if (ops[i2] != null) idx = i2
      } else {
        idx = ops.findIndex(o => o.toLowerCase() === c.toLowerCase())
      }
      if (idx < 0) {
        errores.push(`Fila ${fila}: no encontré la opción correcta ("${c}"). Escribe el número (1–${ops.length}) o el texto exacto.`)
        return
      }
      preguntas.push({
        id: `p${n}`, tipo, pregunta: texto,
        opciones: ops.map((t, i) => ({ texto: t, correcta: i === idx })),
      })
      return
    }

    if (tipo === 'vf') {
      const c = String(f.correcta || '').trim().toLowerCase()
      const esV = /^(1|v|verdader[oa]|true|si|sí)$/.test(c)
      const esF = /^(0|f|falso|false|no)$/.test(c)
      if (!esV && !esF) {
        errores.push(`Fila ${fila}: en "vf" la columna correcta debe ser 1 (Verdadero) o 0 (Falso).`)
        return
      }
      preguntas.push({
        id: `p${n}`, tipo, pregunta: texto,
        opciones: [{ texto: 'Verdadero', correcta: esV }, { texto: 'Falso', correcta: !esV }],
      })
      return
    }

    if (tipo === 'corta') {
      const r = String(f.respuesta || '').trim()
      if (!r) {
        errores.push(`Fila ${fila}: "corta" necesita la columna "respuesta".`)
        return
      }
      preguntas.push({ id: `p${n}`, tipo, pregunta: texto, respuesta: r })
      return
    }

    // emparejar
    const pares = parsePares(f.pares)
    if (pares.length < 2) {
      errores.push(`Fila ${fila}: "emparejar" necesita al menos 2 pares con el formato premisa=respuesta; premisa2=respuesta2`)
      return
    }
    preguntas.push({ id: `p${n}`, tipo, pregunta: texto, pares })
  })

  return { preguntas, errores }
}

/** Convierte preguntas de vuelta a TSV (para editar en Excel o respaldar). */
export function preguntasATSV(preguntas) {
  const filas = [COLUMNAS_EXAMEN.join('\t')]
  ;(preguntas || []).forEach(p => {
    const tipo = tipoDe(p)
    const f = Object.fromEntries(COLUMNAS_EXAMEN.map(c => [c, '']))
    f.tipo = tipo
    f.pregunta = p.pregunta || ''
    if (tipo === 'opcion') {
      ;(p.opciones || []).slice(0, 5).forEach((o, i) => { f[`op${i + 1}`] = o.texto || '' })
      const idx = (p.opciones || []).findIndex(o => o.correcta)
      if (idx >= 0) f.correcta = String(idx + 1)
    } else if (tipo === 'vf') {
      const idx = (p.opciones || []).findIndex(o => o.correcta)
      f.correcta = idx === 0 ? '1' : '0'
    } else if (tipo === 'corta') {
      f.respuesta = p.respuesta || ''
    } else if (tipo === 'emparejar') {
      f.pares = (p.pares || []).map(x => `${x.premisa}=${x.respuesta}`).join('; ')
    }
    filas.push(COLUMNAS_EXAMEN.map(c => String(f[c] ?? '').replace(/[\t\n]/g, ' ')).join('\t'))
  })
  return filas.join('\n')
}

/** Descarga un texto como archivo .tsv (Excel lo abre directo). */
export function descargarTSV(texto, nombreArchivo = 'examen.tsv') {
  const blob = new Blob(['﻿' + texto], { type: 'text/tab-separated-values;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/* ------------------------------------------------------------
   VALIDACIÓN Y LÍMITE DE INTENTOS
   ------------------------------------------------------------ */

/**
 * Valida una pregunta escrita a mano.
 * @returns {string|null} mensaje de error, o null si está bien.
 */
export function validarPregunta(p) {
  if (!p) return 'La pregunta está vacía.'
  if (!String(p.pregunta || '').trim()) return 'Falta escribir la pregunta.'

  const tipo = tipoDe(p)
  if (tipo === 'opcion') {
    const ops = (p.opciones || []).filter(o => String(o.texto || '').trim())
    if (ops.length < 2) return 'Necesitas al menos 2 opciones con texto.'
    if (ops.filter(o => o.correcta).length !== 1) return 'Marca exactamente una opción como correcta.'
    return null
  }
  if (tipo === 'vf') {
    if ((p.opciones || []).filter(o => o.correcta).length !== 1) return 'Marca si la respuesta correcta es Verdadero o Falso.'
    return null
  }
  if (tipo === 'corta') {
    if (!String(p.respuesta || '').trim()) return 'Falta escribir la respuesta esperada.'
    return null
  }
  // emparejar
  const pares = (p.pares || []).filter(x => String(x.premisa || '').trim() && String(x.respuesta || '').trim())
  if (pares.length < 2) return 'Necesitas al menos 2 pares completos (premisa y respuesta).'
  return null
}

/** Crea una pregunta en blanco del tipo pedido, lista para editar a mano. */
export function crearPreguntaVacia(tipo = 'opcion', n = 1) {
  const id = `p${n}`
  if (tipo === 'vf') {
    return {
      id, tipo: 'vf', pregunta: '',
      opciones: [{ texto: 'Verdadero', correcta: true }, { texto: 'Falso', correcta: false }],
    }
  }
  if (tipo === 'corta') return { id, tipo: 'corta', pregunta: '', respuesta: '' }
  if (tipo === 'emparejar') {
    return {
      id, tipo: 'emparejar', pregunta: '',
      pares: [
        { id: `${id}a`, premisa: '', respuesta: '' },
        { id: `${id}b`, premisa: '', respuesta: '' },
      ],
    }
  }
  return {
    id, tipo: 'opcion', pregunta: '',
    opciones: [
      { texto: '', correcta: true }, { texto: '', correcta: false },
      { texto: '', correcta: false }, { texto: '', correcta: false },
    ],
  }
}

/**
 * ¿El alumno todavía puede responder?
 * @param {Array} intentos  intentos ya registrados
 * @param {number} max      máximo permitido (null/0 = ilimitado)
 */
export function puedeIntentar(intentos, max) {
  const limite = parseInt(max, 10)
  if (!limite || limite <= 0) return true           // 0 o null = ilimitado
  return (intentos || []).length < limite
}

/** Mejor calificación entre los intentos. */
export const mejorCalificacion = (intentos) =>
  (intentos || []).reduce((m, i) => Math.max(m, Number(i.calificacion) || 0), 0)

/** Resumen para mostrarle al alumno: cuántos intentos lleva y cuál es su mejor nota. */
export function resumenIntentos(intentos, max) {
  const n = (intentos || []).length
  const limite = parseInt(max, 10)
  const ilimitado = !limite || limite <= 0
  return {
    usados: n,
    restantes: ilimitado ? Infinity : Math.max(0, limite - n),
    limite: ilimitado ? null : limite,
    mejor: mejorCalificacion(intentos),
    aprobado: (intentos || []).some(i => i.aprobado),
  }
}


