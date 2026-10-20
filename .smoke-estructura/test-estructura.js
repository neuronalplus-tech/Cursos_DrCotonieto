import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const ICONO_TIPO = { pdf: "📄", video: "🎬", word: "📝", enlace: "🔗", autoevaluacion: "✍️" };
const NOMBRE_TIPO = { pdf: "Documento", video: "Video", word: "Descargable", enlace: "Enlace", autoevaluacion: "Autoevaluación" };
const PERFILES = [
  {
    clave: "plataforma",
    nombre: "Administración global",
    rol: null,
    icono: "🌐",
    descripcion: "Todo, en todas las organizaciones: también los textos del sitio, las organizaciones y los planes."
  },
  {
    clave: "direccion",
    nombre: "Dirección",
    rol: "Dirección",
    icono: "🏛️",
    descripcion: "Mira, autoriza y se lleva los datos. No imparte ni califica."
  },
  {
    clave: "coordinacion",
    nombre: "Coordinación",
    rol: "Coordinación",
    icono: "🗂️",
    descripcion: "Arma grupos, inscribe, asigna docentes y genera documentos."
  },
  {
    clave: "docente",
    nombre: "Docente",
    rol: "Docente",
    icono: "🎓",
    descripcion: "Imparte: contenido, exámenes, foro, asistencia y calificaciones de sus cursos."
  }
];
const PERMISOS_BASE = {
  direccion: [
    "cursos.ver",
    "alumnos.ver",
    "calificaciones.ver",
    "indicadores.ver",
    "datos.exportar",
    "marca.editar",
    "documentos.generar",
    "documentos.plantillas",
    "facilitadores.asignar"
  ],
  coordinacion: [
    "cursos.ver",
    "alumnos.ver",
    "alumnos.inscribir",
    "facilitadores.asignar",
    "grupos.gestionar",
    "asistencia.justificar",
    "sedes.gestionar",
    "calificaciones.ver",
    "documentos.generar",
    "indicadores.ver"
  ],
  docente: [
    "cursos.ver",
    "cursos.editar",
    "examenes.editar",
    "foro.moderar",
    "alumnos.ver",
    "asistencia.pasar",
    "calificaciones.ver",
    "calificaciones.capturar",
    "documentos.generar"
  ]
};
const GRUPOS_ELEMENTOS = [
  ["Curso", [
    { clave: "curso.info", nombre: "Título, descripción e información", permiso: "cursos.editar", seccion: "info" },
    { clave: "curso.estado", nombre: "Publicar, «Próximamente» y archivar", permiso: "cursos.editar", seccion: "info" },
    { clave: "curso.botones", nombre: "Botones de las rutas", permiso: "cursos.editar", seccion: "botones" },
    { clave: "curso.constancia", nombre: "Constancia: texto, horas y publicación", permiso: "cursos.editar", seccion: "constancia" }
  ]],
  ["Módulos y materiales", [
    { clave: "modulos", nombre: "Crear, ordenar, abrir y cerrar módulos", permiso: "cursos.editar", seccion: "modulos" },
    { clave: "materiales", nombre: "Materiales: lecturas, grabaciones, actividades…", permiso: "cursos.editar", seccion: "modulos" },
    { clave: "modulo.botones", nombre: "Botones de cada módulo", permiso: "cursos.editar", seccion: "botones" }
  ]],
  ["Evaluación", [
    { clave: "examenes", nombre: "Exámenes y banco de preguntas", permiso: "examenes.editar", seccion: "examenes" },
    { clave: "tareas", nombre: "Crear y editar tareas", permiso: "cursos.editar", seccion: "tareas" },
    { clave: "calificar", nombre: "Calificar entregas y conceder prórrogas", permiso: "calificaciones.capturar", seccion: "tareas" },
    { clave: "calificaciones", nombre: "Ver calificaciones y avance del grupo", permiso: "calificaciones.ver", seccion: "avance" }
  ]],
  ["Comunidad", [
    { clave: "foro", nombre: "Abrir, cerrar y calificar temas del foro", permiso: "foro.moderar", seccion: "foro" }
  ]],
  ["Grupos y personas", [
    { clave: "generaciones", nombre: "Generaciones, cupos y sedes", permiso: "grupos.gestionar", seccion: "generaciones" },
    { clave: "participantes", nombre: "Ver participantes", permiso: "alumnos.ver", seccion: "participantes" },
    { clave: "inscribir", nombre: "Inscribir y dar de baja", permiso: "alumnos.inscribir", seccion: null },
    { clave: "asistencia", nombre: "Pasar lista", permiso: "asistencia.pasar", seccion: "generaciones" },
    { clave: "docentes", nombre: "Asignar docentes", permiso: "facilitadores.asignar", seccion: null }
  ]],
  ["Sitio e institución", [
    { clave: "sitio.textos", nombre: "Textos, botones y avisos de las páginas", permiso: "admin", seccion: null },
    { clave: "marca", nombre: "Nombre, logo y colores", permiso: "marca.editar", seccion: null },
    { clave: "plantillas", nombre: "Plantillas de documentos", permiso: "documentos.plantillas", seccion: null },
    { clave: "documentos", nombre: "Generar constancias y documentos", permiso: "documentos.generar", seccion: null },
    { clave: "indicadores", nombre: "Tablero e indicadores", permiso: "indicadores.ver", seccion: null },
    { clave: "organizaciones", nombre: "Organizaciones y planes", permiso: "plataforma", seccion: null }
  ]]
];
const ELEMENTOS = GRUPOS_ELEMENTOS.flatMap(([grupo, els]) => els.map((e) => ({ ...e, grupo })));
function permisosDePerfil(clavePerfil, rolesBD = []) {
  const perfil = PERFILES.find((p) => p.clave === clavePerfil);
  if (!(perfil == null ? void 0 : perfil.rol))
    return null;
  const enBase = rolesBD.find((r) => normalizar(r.nombre) === normalizar(perfil.rol));
  return new Set(enBase ? enBase.permisos : PERMISOS_BASE[clavePerfil] || []);
}
function permite(elemento, { permisos, esAdminOrg = false, esPlataforma = false }) {
  if (esPlataforma || permisos === null)
    return true;
  if (elemento.permiso === "plataforma")
    return false;
  if (elemento.permiso === "admin")
    return esAdminOrg;
  if (esAdminOrg)
    return true;
  return !!(permisos == null ? void 0 : permisos.has(elemento.permiso));
}
const CATEGORIAS_MATERIAL = [
  {
    clave: "sesion",
    nombre: "Sesiones en vivo",
    icono: "📡",
    accion: "Entrar a la sesión ↗",
    nota: "Se abre la videollamada en una pestaña nueva.",
    soloEnlace: true
  },
  { clave: "lectura", nombre: "Materiales de lectura", icono: "📖", accion: "Abrir la lectura ↗" },
  { clave: "grabacion", nombre: "Grabaciones y videos", icono: "🎬", accion: "Ver la grabación ↗" },
  { clave: "actividad", nombre: "Actividades", icono: "✍️", accion: "Ir a la actividad ↗" },
  {
    clave: "juego",
    nombre: "Juegos e interactivos",
    icono: "🎮",
    accion: "Abrir el juego ↗",
    nota: "Se abre en una pestaña nueva.",
    soloEnlace: true
  },
  { clave: "descargable", nombre: "Plantillas y descargables", icono: "📥", accion: "Abrir la plantilla ↗" },
  {
    clave: "entregable",
    nombre: "Entregables",
    icono: "📤",
    accion: "Subir mi entrega ↗",
    nota: "Se abre la carpeta compartida en una pestaña nueva. Sube tu archivo con el nombre indicado.",
    soloEnlace: true
  },
  { clave: "enlace", nombre: "Enlaces de interés", icono: "🔗", accion: "Abrir enlace →" }
];
const CATEGORIA_POR_FORMATO = {
  pdf: "lectura",
  video: "grabacion",
  autoevaluacion: "actividad",
  word: "descargable",
  enlace: "enlace"
};
function categoriaDe(recurso) {
  const propia = recurso == null ? void 0 : recurso.categoria_material;
  if (propia && CATEGORIAS_MATERIAL.some((c) => c.clave === propia))
    return propia;
  return CATEGORIA_POR_FORMATO[recurso == null ? void 0 : recurso.tipo] || "enlace";
}
function agruparPorCategoria(recursos) {
  return CATEGORIAS_MATERIAL.map((categoria) => ({ categoria, recursos: (recursos || []).filter((r) => categoriaDe(r) === categoria.clave) })).filter((g) => g.recursos.length > 0);
}
Object.fromEntries(
  Object.keys(CATEGORIA_POR_FORMATO).map((t) => [t, { icono: ICONO_TIPO[t], nombre: NOMBRE_TIPO[t], clase: `formato-${t}` }])
);
const ANATOMIA = {
  curso: [
    { clave: "encabezado", nombre: "Encabezado", contiene: "Título, fecha de inicio y descripción", seccion: "info" },
    { clave: "avance", nombre: "Tu avance", contiene: "Barra de progreso (solo con sesión)", seccion: null },
    { clave: "contenido", nombre: "Contenido del curso", contiene: "Rutas y módulos, en su orden", seccion: "modulos" },
    { clave: "botones", nombre: "Botones de ruta", contiene: "Enlaces extra de cada ruta", seccion: "botones" },
    { clave: "tareas", nombre: "Tareas", contiene: "Entregas del curso", seccion: "tareas" },
    { clave: "foro", nombre: "Foro", contiene: "Solo si hay al menos un tema publicado", seccion: "foro" },
    { clave: "detalles", nombre: "Página de detalles", contiene: "Temario ampliado; solo si tiene contenido", seccion: null }
  ],
  modulo: [
    { clave: "encabezado", nombre: "Encabezado", contiene: "Título, descripción y avance", seccion: "modulos" },
    { clave: "botones", nombre: "Botones del módulo", contiene: "Enlaces extra activos", seccion: "botones" },
    ...CATEGORIAS_MATERIAL.map((c) => ({ clave: `material.${c.clave}`, nombre: c.nombre, contiene: `${c.icono} Recursos de esta categoría`, seccion: "modulos" })),
    { clave: "examen", nombre: "Evaluación", contiene: "El examen del módulo", seccion: "examenes" },
    { clave: "tareas", nombre: "Tareas", contiene: "Entregas del módulo", seccion: "tareas" }
  ]
};
function estadoCurso(c) {
  if ((c == null ? void 0 : c.activo) === false)
    return "archivado";
  if (c == null ? void 0 : c.proximamente)
    return "proximamente";
  return "publicado";
}
function estadoModulo(m, ahora = Date.now()) {
  if ((m == null ? void 0 : m.disponible) === false)
    return "oculto";
  if ((m == null ? void 0 : m.abre_el) && new Date(m.abre_el).getTime() > ahora)
    return "programado";
  if ((m == null ? void 0 : m.cierra_el) && new Date(m.cierra_el).getTime() < ahora)
    return "cerrado";
  return "publicado";
}
function normalizar(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}
function filasFacilitadorNuevas(filas, existentes) {
  const clave = (f) => `${String(f.email || "").trim().toLowerCase()}|${Number(f.curso_id)}`;
  const ya = new Set((existentes || []).map(clave));
  const out = [];
  for (const f of filas || []) {
    const k = clave(f);
    if (ya.has(k))
      continue;
    ya.add(k);
    out.push({ ...f, email: String(f.email).trim().toLowerCase() });
  }
  return out;
}
function sumar(filas) {
  const t = {
    cursos: 0,
    alumnos: 0,
    nuevos: 0,
    activos_7: 0,
    activos_periodo: 0,
    terminados: 0,
    en_riesgo: 0,
    por_calificar: 0,
    calificadas: 0,
    horas_ponderadas: 0,
    calificadas_7d: 0,
    intentos: 0,
    aprobados: 0,
    asistencias: 0,
    presentes: 0,
    temas_foro: 0,
    respuestas_periodo: 0,
    constancias: 0,
    interesados: 0,
    avance_ponderado: 0,
    alumnos_con_avance: 0
  };
  for (const f of filas || []) {
    t.cursos++;
    for (const k of [
      "alumnos",
      "nuevos",
      "activos_7",
      "activos_periodo",
      "terminados",
      "en_riesgo",
      "por_calificar",
      "calificadas",
      "calificadas_7d",
      "intentos",
      "aprobados",
      "asistencias",
      "presentes",
      "temas_foro",
      "respuestas_periodo",
      "constancias",
      "interesados"
    ])
      t[k] += Number(f[k]) || 0;
    if (f.horas_calificar != null)
      t.horas_ponderadas += Number(f.horas_calificar) * (Number(f.calificadas) || 0);
    if (f.avance_medio != null) {
      t.avance_ponderado += Number(f.avance_medio) * (Number(f.alumnos) || 0);
      t.alumnos_con_avance += Number(f.alumnos) || 0;
    }
  }
  return t;
}
const pct = (a, b) => b > 0 ? Math.round(a / b * 1e3) / 10 : null;
const KPIS = [
  // APRENDIZAJE
  {
    clave: "avance",
    grupo: "Aprendizaje",
    nombre: "Avance medio",
    unidad: "%",
    sentido: "sube",
    meta: 60,
    perfiles: ["direccion", "coordinacion", "docente"],
    como: "Materiales vistos sobre los publicados, promedio por alumno (ponderado por curso).",
    calcular: (t) => t.alumnos_con_avance ? Math.round(t.avance_ponderado / t.alumnos_con_avance * 10) / 10 : null
  },
  {
    clave: "finalizacion",
    grupo: "Aprendizaje",
    nombre: "Tasa de finalización",
    unidad: "%",
    sentido: "sube",
    meta: 50,
    perfiles: ["direccion"],
    como: "Alumnos que vieron todos los materiales de su curso, sobre los inscritos.",
    calcular: (t) => pct(t.terminados, t.alumnos)
  },
  {
    clave: "aprobacion",
    grupo: "Aprendizaje",
    nombre: "Aprobación de exámenes",
    unidad: "%",
    sentido: "sube",
    meta: 80,
    perfiles: ["coordinacion"],
    como: "Intentos aprobados sobre intentos presentados en el periodo.",
    calcular: (t) => pct(t.aprobados, t.intentos)
  },
  {
    clave: "asistencia",
    grupo: "Aprendizaje",
    nombre: "Asistencia",
    unidad: "%",
    sentido: "sube",
    meta: 85,
    perfiles: ["coordinacion", "docente"],
    como: "Presente o retardo sobre los registros de asistencia del periodo.",
    calcular: (t) => pct(t.presentes, t.asistencias)
  },
  // ACTIVIDAD Y RETENCIÓN
  {
    clave: "activos",
    grupo: "Actividad",
    nombre: "Alumnos activos (periodo)",
    unidad: "%",
    sentido: "sube",
    meta: 60,
    perfiles: ["direccion", "coordinacion"],
    como: "Inscritos que abrieron algún material en el periodo, sobre los inscritos.",
    calcular: (t) => pct(t.activos_periodo, t.alumnos)
  },
  {
    clave: "activos7",
    grupo: "Actividad",
    nombre: "Activos en los últimos 7 días",
    unidad: "alumnos",
    sentido: "sube",
    meta: null,
    perfiles: [],
    como: "Inscritos con actividad en la última semana.",
    calcular: (t) => t.activos_7
  },
  {
    clave: "riesgo",
    grupo: "Actividad",
    nombre: "Alumnos en riesgo",
    unidad: "alumnos",
    sentido: "baja",
    meta: 0,
    perfiles: ["coordinacion", "docente"],
    como: "Inscritos hace más de 7 días, sin terminar y sin actividad en 14 días.",
    calcular: (t) => t.en_riesgo
  },
  // DOCENCIA (servicio al alumno)
  {
    clave: "por_calificar",
    grupo: "Docencia",
    nombre: "Entregas por calificar",
    unidad: "entregas",
    sentido: "baja",
    meta: 0,
    perfiles: ["docente", "coordinacion"],
    como: "Entregas recibidas que todavía no tienen calificación (a hoy).",
    calcular: (t) => t.por_calificar
  },
  {
    clave: "horas_calificar",
    grupo: "Docencia",
    nombre: "Tiempo medio para calificar",
    unidad: "h",
    sentido: "baja",
    meta: 72,
    perfiles: ["docente", "coordinacion", "direccion"],
    como: "Horas entre que el alumno entrega y recibe calificación, en lo calificado en el periodo.",
    calcular: (t) => t.calificadas ? Math.round(t.horas_ponderadas / t.calificadas * 10) / 10 : null
  },
  {
    clave: "a_tiempo",
    grupo: "Docencia",
    nombre: "Calificado en ≤ 7 días",
    unidad: "%",
    sentido: "sube",
    meta: 90,
    perfiles: ["coordinacion"],
    como: "Entregas calificadas en una semana o menos, sobre las calificadas en el periodo.",
    calcular: (t) => pct(t.calificadas_7d, t.calificadas)
  },
  {
    clave: "foro",
    grupo: "Docencia",
    nombre: "Respuestas en el foro",
    unidad: "respuestas",
    sentido: "sube",
    meta: null,
    perfiles: ["docente"],
    como: "Respuestas publicadas en los foros de tus cursos durante el periodo.",
    calcular: (t) => t.respuestas_periodo
  },
  // CRECIMIENTO
  {
    clave: "inscritos",
    grupo: "Crecimiento",
    nombre: "Inscritos",
    unidad: "alumnos",
    sentido: "sube",
    meta: null,
    perfiles: ["direccion"],
    como: "Inscripciones vigentes en los cursos a tu cargo.",
    calcular: (t) => t.alumnos
  },
  {
    clave: "nuevos",
    grupo: "Crecimiento",
    nombre: "Inscripciones nuevas",
    unidad: "alumnos",
    sentido: "sube",
    meta: null,
    perfiles: ["direccion"],
    como: "Inscripciones creadas en el periodo.",
    calcular: (t) => t.nuevos
  },
  {
    clave: "interesados",
    grupo: "Crecimiento",
    nombre: "Interesados (leads)",
    unidad: "personas",
    sentido: "sube",
    meta: null,
    perfiles: ["direccion"],
    como: "Correos dejados en talleres («quiero los materiales») en el periodo.",
    calcular: (t) => t.interesados
  },
  {
    clave: "constancias",
    grupo: "Crecimiento",
    nombre: "Constancias emitidas",
    unidad: "constancias",
    sentido: "sube",
    meta: null,
    perfiles: [],
    como: "Constancias con folio emitidas en el periodo.",
    calcular: (t) => t.constancias
  }
];
[...new Set(KPIS.map((k) => k.grupo))];
function semaforo(kpi2, valor, meta = kpi2.meta, tolerancia = 0.2) {
  if (valor == null || meta == null)
    return null;
  if (kpi2.sentido === "sube") {
    if (valor >= meta)
      return "verde";
    return valor >= meta * (1 - tolerancia) ? "ambar" : "rojo";
  }
  if (valor <= meta)
    return "verde";
  const margen = meta === 0 ? 3 : meta * tolerancia;
  return valor <= meta + margen ? "ambar" : "rojo";
}
function destacadosDe(perfil) {
  if (!perfil || perfil === "plataforma")
    return KPIS.filter((k) => k.perfiles.includes("direccion"));
  return KPIS.filter((k) => k.perfiles.includes(perfil));
}
function formato(valor, unidad) {
  if (valor == null)
    return "—";
  if (unidad === "%")
    return `${valor}%`;
  if (unidad === "h")
    return valor >= 48 ? `${Math.round(valor / 24 * 10) / 10} días` : `${valor} h`;
  return String(valor);
}
createClient(
  "https://ohhdnaewtjfqszxemrju.supabase.co",
  "sb_publishable_Xb5gmCnnq2VHL9XhHWnsjA_g-W87puK"
);
const SECCIONES_CURSO = [
  { clave: "info", nombre: "Información del curso", icono: "📝", ayuda: "Título, descripción y estado de publicación." },
  { clave: "modulos", nombre: "Módulos y materiales", icono: "📚", ayuda: "Estructura del curso y los materiales de cada módulo, por sección." },
  { clave: "botones", nombre: "Botones", icono: "🔗", ayuda: "Enlaces extra de cada ruta y de cada módulo." },
  { clave: "constancia", nombre: "Constancia", icono: "🎓", ayuda: "Qué dice, si lleva horas y cuándo la ven los participantes." },
  { clave: "examenes", nombre: "Exámenes", icono: "🧪", ayuda: "El examen del curso y los de cada módulo." },
  { clave: "tareas", nombre: "Tareas", icono: "📥", ayuda: "Entregas que el alumno sube y se califican aquí." },
  { clave: "foro", nombre: "Foro", icono: "💬", ayuda: "Temas de conversación. Sin temas, el alumno no ve el foro." },
  { clave: "generaciones", nombre: "Generaciones y asistencia", icono: "🗓️", ayuda: "Cada edición del curso, su cupo y su lista." },
  { clave: "participantes", nombre: "Participantes", icono: "👥", ayuda: "Quién está inscrito y cuándo entró por última vez." },
  { clave: "avance", nombre: "Avance y calificaciones", icono: "📊", ayuda: "Quién va atrasado y cómo salió en los exámenes." }
];
function contextoReal({ esPlataforma, esAdminOrg, permisosRol = [], esFacilitador = false }) {
  if (esPlataforma)
    return { permisos: null, esAdminOrg: true, esPlataforma: true };
  const permisos = new Set(permisosRol);
  if (esFacilitador)
    permisosDePerfil("docente").forEach((p) => permisos.add(p));
  return { permisos, esAdminOrg: !!esAdminOrg, esPlataforma: false };
}
function contextoSimulado(clavePerfil, rolesBD) {
  if (clavePerfil === "plataforma")
    return { permisos: null, esAdminOrg: true, esPlataforma: true };
  return { permisos: permisosDePerfil(clavePerfil, rolesBD), esAdminOrg: false, esPlataforma: false };
}
function seccionesPermitidas(ctx) {
  const abiertas = /* @__PURE__ */ new Set();
  for (const e of ELEMENTOS)
    if (e.seccion && permite(e, ctx))
      abiertas.add(e.seccion);
  return abiertas;
}
const elementosDeSeccion = (seccion, ctx) => ELEMENTOS.filter((e) => e.seccion === seccion).map((e) => ({ ...e, permitido: permite(e, ctx) }));
function llenadoPagina({ curso, modulos = [], recursos = [], temasForo = 0, tareas = 0, tieneDetalles = false }) {
  const botonesRuta = Object.values((curso == null ? void 0 : curso.rutas_botones) || {}).some((l) => (l || []).some((b) => b.activo !== false));
  const lleno = {
    encabezado: !!(curso == null ? void 0 : curso.titulo),
    avance: modulos.length > 0,
    contenido: modulos.length > 0,
    botones: botonesRuta,
    tareas: tareas > 0,
    foro: temasForo > 0,
    detalles: !!tieneDetalles
  };
  const curso_ = ANATOMIA.curso.map((s) => ({ ...s, lleno: !!lleno[s.clave] }));
  const categorias = new Set(recursos.filter((r) => r.disponible !== false).map(categoriaDe));
  const modulo = ANATOMIA.modulo.map((s) => {
    const cat = s.clave.startsWith("material.") ? s.clave.slice(9) : null;
    return { ...s, lleno: cat ? categorias.has(cat) : null };
  });
  return { curso: curso_, modulo };
}
function contarPorCurso(cursos, { modulos = [], recursos = [], examenes = [], tareas = [], hilos = [] }) {
  const r = {};
  for (const c of cursos)
    r[c.id] = { modulos: 0, materiales: 0, examenes: 0, tareas: 0, temas: 0 };
  const cursoDeModulo = {};
  for (const m of modulos) {
    cursoDeModulo[m.id] = m.curso_id;
    if (r[m.curso_id])
      r[m.curso_id].modulos++;
  }
  for (const x of recursos) {
    const c = cursoDeModulo[x.modulo_id];
    if (r[c])
      r[c].materiales++;
  }
  for (const e of examenes) {
    const c = e.curso_id ?? cursoDeModulo[e.modulo_id];
    if (r[c])
      r[c].examenes++;
  }
  for (const t of tareas) {
    const c = t.curso_id ?? cursoDeModulo[t.modulo_id];
    if (r[c])
      r[c].tareas++;
  }
  for (const h of hilos)
    if (r[h.curso_id])
      r[h.curso_id].temas++;
  return r;
}
let ok = 0;
const fallos = [];
const check = (n, c, d = "") => {
  if (c) {
    ok++;
    console.log("  OK   " + n);
  } else {
    fallos.push(n);
    console.log("  FALLA " + n + (d ? ": " + d : ""));
  }
};
const igualesConjunto = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
console.log("\n=== EL CÓDIGO Y LA BASE DICEN LO MISMO ===");
const sql = readFileSync(new URL("../supabase/ROLES_5_PERMISOS.sql", import.meta.url), "utf8");
const catalogo = [...sql.matchAll(/\(\s*'([a-z_]+\.[a-z_]+)'\s*,\s*'[^']+'/g)].map((m) => m[1]);
check("Se leyó el catálogo de permisos de ROLES_5", catalogo.length >= 15, String(catalogo.length));
const sembrados = {};
for (const m of sql.matchAll(/values \(p_org, '([^']+)'[\s\S]*?unnest\(array\[([\s\S]*?)\]\)/g)) {
  sembrados[m[1]] = [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}
for (const p of PERFILES.filter((x) => x.rol)) {
  check(
    `PERMISOS_BASE.${p.clave} = sembrar_roles_basicos('${p.rol}')`,
    igualesConjunto(PERMISOS_BASE[p.clave], sembrados[p.rol] || []),
    `código ${PERMISOS_BASE[p.clave]} vs base ${sembrados[p.rol]}`
  );
}
const raros = ELEMENTOS.filter((e) => !["admin", "plataforma"].includes(e.permiso) && !catalogo.includes(e.permiso));
check("Todo elemento nombra un permiso que existe en la base", raros.length === 0, raros.map((e) => e.permiso).join(", "));
const secciones = SECCIONES_CURSO.map((s) => s.clave);
const sinTarjeta = ELEMENTOS.filter((e) => e.seccion && !secciones.includes(e.seccion));
check("Toda sección de un elemento es una tarjeta del Centro", sinTarjeta.length === 0, sinTarjeta.map((e) => e.clave).join(", "));
check("Toda tarjeta del Centro la abre algún elemento", secciones.every((s) => ELEMENTOS.some((e) => e.seccion === s)));
check("Claves de elemento únicas", new Set(ELEMENTOS.map((e) => e.clave)).size === ELEMENTOS.length);
console.log("\n=== CATEGORÍAS DEL MATERIAL ===");
check("pdf sin categoría → lectura", categoriaDe({ tipo: "pdf" }) === "lectura");
check("video → grabación", categoriaDe({ tipo: "video" }) === "grabacion");
check("autoevaluación → actividad", categoriaDe({ tipo: "autoevaluacion" }) === "actividad");
check("La categoría elegida gana al formato", categoriaDe({ tipo: "pdf", categoria_material: "actividad" }) === "actividad");
check("Una categoría inválida cae a la del formato", categoriaDe({ tipo: "video", categoria_material: "xyz" }) === "grabacion");
const grupos = agruparPorCategoria([
  { id: 1, tipo: "enlace" },
  { id: 2, tipo: "pdf" },
  { id: 3, tipo: "video" },
  { id: 4, tipo: "pdf" }
]);
check(
  "Agrupa en el orden fijo y omite las vacías",
  grupos.map((x) => x.categoria.clave).join() === "lectura,grabacion,enlace",
  grupos.map((x) => x.categoria.clave).join()
);
check("Dentro de la sección respeta el orden recibido", grupos[0].recursos.map((r) => r.id).join() === "2,4");
check(
  "El módulo tiene una sección por categoría en su anatomía",
  CATEGORIAS_MATERIAL.every((c) => ANATOMIA.modulo.some((s) => s.clave === `material.${c.clave}`))
);
const sqlCat = readFileSync(new URL("../supabase/ESTRUCTURA_1_CATEGORIAS.sql", import.meta.url), "utf8");
const enCheck = [...(sqlCat.match(/categoria_material in\s*\(([\s\S]*?)\)\)/) || ["", ""])[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
check(
  "Las categorías del código = las que admite la base (ESTRUCTURA_1)",
  igualesConjunto(enCheck, CATEGORIAS_MATERIAL.map((c) => c.clave)),
  `base: ${enCheck}`
);
check(
  "Sesión, juego y entregable existen y son solo enlace",
  ["sesion", "juego", "entregable"].every((k) => {
    var _a;
    return (_a = CATEGORIAS_MATERIAL.find((c) => c.clave === k)) == null ? void 0 : _a.soloEnlace;
  })
);
check("Toda categoría dice qué hace su botón", CATEGORIAS_MATERIAL.every((c) => c.accion));
check("Un entregable migrado conserva su sección", categoriaDe({ tipo: "enlace", categoria_material: "entregable" }) === "entregable");
check("Las sesiones en vivo van primero en el módulo", CATEGORIAS_MATERIAL[0].clave === "sesion");
console.log("\n=== QUIÉN EDITA QUÉ ===");
const sec = (clave) => seccionesPermitidas(contextoSimulado(clave, []));
check("Administración global: todas las tarjetas", sec("plataforma").size === SECCIONES_CURSO.length);
check("Docente: contenido, exámenes, tareas y foro", ["modulos", "examenes", "tareas", "foro", "avance"].every((s) => sec("docente").has(s)));
const genDocente = elementosDeSeccion("generaciones", contextoSimulado("docente", []));
check(
  "Docente: en Generaciones solo pasa lista",
  genDocente.find((e) => e.clave === "asistencia").permitido && !genDocente.find((e) => e.clave === "generaciones").permitido
);
check("Coordinación: generaciones, participantes y avance", ["generaciones", "participantes", "avance"].every((s) => sec("coordinacion").has(s)));
check("Coordinación: no edita módulos ni exámenes", !sec("coordinacion").has("modulos") && !sec("coordinacion").has("examenes"));
check("Dirección: no edita contenido ni foro", !sec("direccion").has("modulos") && !sec("direccion").has("foro"));
const textos = ELEMENTOS.find((e) => e.clave === "sitio.textos");
check("Textos del sitio: solo quien administra", !permite(textos, contextoSimulado("docente", [])) && permite(textos, { permisos: /* @__PURE__ */ new Set(), esAdminOrg: true }));
const orgs = ELEMENTOS.find((e) => e.clave === "organizaciones");
check("Organizaciones: ni el admin de un cliente", !permite(orgs, { permisos: /* @__PURE__ */ new Set(), esAdminOrg: true }));
check(
  "Un rol cambiado en la base manda sobre el de nacimiento",
  permisosDePerfil("coordinacion", [{ nombre: "Coordinación", permisos: ["cursos.editar"] }]).has("cursos.editar") && !permisosDePerfil("coordinacion", [{ nombre: "coordinacion", permisos: [] }]).has("alumnos.ver")
);
check(
  "Quien facilita un curso gestiona como Docente",
  seccionesPermitidas(contextoReal({ esFacilitador: true })).has("modulos")
);
check("Sin rol ni curso no abre nada", seccionesPermitidas(contextoReal({})).size === 0);
console.log("\n=== ALTA DE FACILITADORES ===");
const nuevasF = filasFacilitadorNuevas(
  [{ email: "Ana@X.mx ", curso_id: 1 }, { email: "ana@x.mx", curso_id: 1 }, { email: "ana@x.mx", curso_id: 2 }, { email: "beto@x.mx", curso_id: 1 }],
  [{ email: "ANA@x.mx", curso_id: 2 }]
);
check(
  "Solo inserta lo que falta, sin repetir y con el correo en minúsculas",
  JSON.stringify(nuevasF) === JSON.stringify([{ email: "ana@x.mx", curso_id: 1 }, { email: "beto@x.mx", curso_id: 1 }]),
  JSON.stringify(nuevasF)
);
console.log("\n=== INDICADORES ===");
const tk = sumar([
  { alumnos: 10, activos_periodo: 5, avance_medio: 80, terminados: 2, calificadas: 4, horas_calificar: 10, intentos: 4, aprobados: 3, asistencias: 0, presentes: 0, por_calificar: 1 },
  { alumnos: 30, activos_periodo: 15, avance_medio: 40, terminados: 0, calificadas: 1, horas_calificar: 100, intentos: 0, aprobados: 0, asistencias: 10, presentes: 9, por_calificar: 0 }
]);
const kpi = (c) => KPIS.find((k) => k.clave === c);
check("Avance ponderado por alumnos (no promedio de promedios)", kpi("avance").calcular(tk) === 50, String(kpi("avance").calcular(tk)));
check("Horas para calificar ponderadas por entregas", kpi("horas_calificar").calcular(tk) === 28, String(kpi("horas_calificar").calcular(tk)));
check("Tasas desde conteos (aprobación 75%, asistencia 90%)", kpi("aprobacion").calcular(tk) === 75 && kpi("asistencia").calcular(tk) === 90);
check("Sin datos no hay tasa (no un falso 0%)", kpi("aprobacion").calcular(sumar([{ intentos: 0 }])) === null);
check("Semáforo «más es mejor»", semaforo(kpi("avance"), 60, 60) === "verde" && semaforo(kpi("avance"), 50, 60) === "ambar" && semaforo(kpi("avance"), 20, 60) === "rojo");
check("Semáforo «menos es mejor» con meta 0", semaforo(kpi("por_calificar"), 0) === "verde" && semaforo(kpi("por_calificar"), 2) === "ambar" && semaforo(kpi("por_calificar"), 9) === "rojo");
check("Sin meta no hay semáforo", semaforo(kpi("activos7"), 5) === null);
check("Cada perfil tiene sus destacados", ["direccion", "coordinacion", "docente"].every((p) => destacadosDe(p).length >= 3));
check("Al docente se le destaca lo que tiene por calificar", destacadosDe("docente").some((k) => k.clave === "por_calificar"));
check("Horas largas se leen en días", formato(72, "h") === "3 días" && formato(5, "h") === "5 h" && formato(null, "%") === "—");
check("Todo indicador explica cómo se calcula", KPIS.every((k) => k.como && k.calcular));
console.log("\n=== ESTADOS Y PÁGINA ===");
check("Curso archivado", estadoCurso({ activo: false, proximamente: true }) === "archivado");
check("Curso próximamente", estadoCurso({ proximamente: true }) === "proximamente");
check("Módulo oculto", estadoModulo({ disponible: false }) === "oculto");
check("Módulo programado", estadoModulo({ abre_el: "2999-01-01" }) === "programado");
check("Módulo cerrado", estadoModulo({ cierra_el: "2000-01-01" }) === "cerrado");
const pag = llenadoPagina({ curso: { titulo: "X", rutas_botones: {} }, modulos: [{ id: 1 }], recursos: [{ tipo: "pdf" }, { tipo: "video", disponible: false }], temasForo: 0 });
check("Foro sin temas: vacío (no se muestra)", pag.curso.find((s) => s.clave === "foro").lleno === false);
check("Contenido con módulos: lleno", pag.curso.find((s) => s.clave === "contenido").lleno === true);
check(
  "Lectura usada, grabación oculta no cuenta",
  pag.modulo.find((s) => s.clave === "material.lectura").lleno === true && pag.modulo.find((s) => s.clave === "material.grabacion").lleno === false
);
const cuenta = contarPorCurso([{ id: 1 }, { id: 2 }], {
  modulos: [{ id: 10, curso_id: 1 }],
  recursos: [{ modulo_id: 10 }, { modulo_id: 10 }],
  examenes: [{ curso_id: 2 }, { modulo_id: 10 }],
  tareas: [{ modulo_id: 10 }],
  hilos: [{ curso_id: 1 }]
});
check(
  "Cuenta por curso (también lo que cuelga de un módulo)",
  cuenta[1].modulos === 1 && cuenta[1].materiales === 2 && cuenta[1].examenes === 1 && cuenta[2].examenes === 1 && cuenta[1].tareas === 1 && cuenta[1].temas === 1,
  JSON.stringify(cuenta)
);
console.log("\n" + "─".repeat(56));
console.log(`  ${ok} pruebas OK / ${fallos.length} fallos`);
process.exit(fallos.length ? 1 : 0);
