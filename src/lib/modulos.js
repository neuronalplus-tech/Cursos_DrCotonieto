/* ============================================================
   MÓDULOS ACTIVABLES
   ------------------------------------------------------------
   Qué partes de la plataforma tiene contratadas una institución.
   Decide qué secciones se enseñan; no borra nada ni impide nada en
   la base. Apagar un módulo esconde sus pantallas, y los datos
   siguen donde estaban por si vuelve a contratarlo.

   POR QUÉ ESCONDER Y NO BLOQUEAR
   Porque esto no es seguridad: es alcance comercial. Quien no
   contrató el control escolar no está intentando colarse, es que no
   le sirve. Lo que SÍ protege son los permisos (roles.js) y las
   políticas de la base.
   ============================================================ */

/** Qué módulo necesita cada sección del panel. */
export const MODULO_DE_SECCION = {
  cursos: 'aula',
  examenes: 'aula',
  foro: 'aula',
  inscripciones: 'aula',
  usuarios: 'aula',
  facilitadores: 'aula',
  metricas: 'aula',

  mensajes: 'mensajeria',
  comunicados: 'mensajeria',

  banco: 'evaluacion',

  plantillas: 'documentos',

  roles: 'roles',

  tablero: 'indicadores',
}

/**
 * Las secciones que no cuelgan de ningún módulo contratable: son de
 * la plataforma y solo las ve quien la administra.
 */
export const SECCIONES_PLATAFORMA = ['organizaciones', 'suscripciones', 'bitacora']

/** Convierte la respuesta de `modulos_activos` en algo consultable. */
export const conjuntoModulos = (filas) =>
  new Set((filas || [])
    // `f?.modulo` y no `f.modulo`: una lista con un hueco la devuelve
    // la base cuando algo sale mal, y reventar aquí dejaría el panel
    // entero en blanco por un dato que sobraba.
    .map(f => (typeof f === 'string' ? f : f?.modulo))
    .filter(Boolean))

/**
 * ¿Se enseña esta sección?
 *
 * Sin módulos cargados todavía se contesta que SÍ. Es deliberado: si
 * la consulta falla o va lenta, es mejor enseñar de más un instante
 * que parpadear escondiendo medio panel. Lo que de verdad protege no
 * es esta función.
 */
export function seccionVisible(seccion, modulos) {
  if (!modulos || modulos.size === 0) return true
  const necesita = MODULO_DE_SECCION[seccion]
  if (!necesita) return true
  return modulos.has(necesita)
}

/** Para la ficha del cliente: qué tiene y qué no, en orden. */
export function estadoModulos(catalogo, activos) {
  const set = conjuntoModulos(activos)
  return (catalogo || [])
    .slice()
    .sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999))
    .map(m => ({ ...m, activo: m.esencial || set.has(m.clave) }))
}

/**
 * Lo que un cliente tendría de más si subiera a otro plan.
 * Es el argumento de venta, y conviene que salga solo en vez de
 * tener que compararlo a mano cada vez.
 */
export function ganariaCon(actuales, delPlan, catalogo) {
  const tiene = conjuntoModulos(actuales)
  const nuevo = conjuntoModulos(delPlan)
  const porNombre = Object.fromEntries((catalogo || []).map(m => [m.clave, m.nombre]))
  return [...nuevo]
    .filter(c => !tiene.has(c))
    .map(c => porNombre[c] || c)
}

/** Un plan sin módulos no vende nada: avisa al configurarlo. */
export const planSinModulos = (claves) => !claves || claves.length === 0
