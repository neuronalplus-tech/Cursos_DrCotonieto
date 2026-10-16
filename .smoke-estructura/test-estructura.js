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
    { clave: "curso.botones", nombre: "Botones de las rutas", permiso: "cursos.editar", seccion: "botones" }
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
  { clave: "lectura", nombre: "Materiales de lectura", icono: "📖" },
  { clave: "grabacion", nombre: "Grabaciones y videos", icono: "🎬" },
  { clave: "actividad", nombre: "Actividades", icono: "✍️" },
  { clave: "descargable", nombre: "Plantillas y descargables", icono: "📥" },
  { clave: "enlace", nombre: "Enlaces de interés", icono: "🔗" }
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
    { clave: "foro", nombre: "Foro", contiene: "Solo si hay al menos un tema publicado", seccion: "foro" }
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
createClient(
  "https://ohhdnaewtjfqszxemrju.supabase.co",
  "sb_publishable_Xb5gmCnnq2VHL9XhHWnsjA_g-W87puK"
);
const SECCIONES_CURSO = [
  { clave: "info", nombre: "Información del curso", icono: "📝", ayuda: "Título, descripción y estado de publicación." },
  { clave: "modulos", nombre: "Módulos y materiales", icono: "📚", ayuda: "Estructura del curso y los materiales de cada módulo, por sección." },
  { clave: "botones", nombre: "Botones", icono: "🔗", ayuda: "Enlaces extra de cada ruta y de cada módulo." },
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
function llenadoPagina({ curso, modulos = [], recursos = [], temasForo = 0, tareas = 0 }) {
  const botonesRuta = Object.values((curso == null ? void 0 : curso.rutas_botones) || {}).some((l) => (l || []).some((b) => b.activo !== false));
  const lleno = {
    encabezado: !!(curso == null ? void 0 : curso.titulo),
    avance: modulos.length > 0,
    contenido: modulos.length > 0,
    botones: botonesRuta,
    tareas: tareas > 0,
    foro: temasForo > 0
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
