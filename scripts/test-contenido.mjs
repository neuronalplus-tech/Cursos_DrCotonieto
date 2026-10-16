/* Pruebas de src/lib/contenido.js con una base simulada (sin red).
   npm run test:contenido */
import { supabase } from '../src/lib/supabase'
import {
  resolver, tieneCapa, rellenar, enlaceDe, explicarError,
  guardarCapa, restablecerCapa,
} from '../src/lib/contenido'

let ok = 0
const fallos = []
const check = (n, c) => { if (c) { ok++; console.log('  OK   ' + n) } else { fallos.push(n); console.log('  FALLA ' + n) } }

/* --- Base simulada: una tabla en memoria con la API de PostgREST
   que usa contenido.js (select/eq/is/maybeSingle/insert/update/delete). */
let filas = [
  { id: 1, clave: 'curso.inscribirme', valor: { texto: 'Inscríbeme' }, organizacion_id: 7 },
  { id: 2, clave: 'curso.inscribirme@curso:3', valor: { estilo: 'azul' }, organizacion_id: 7 },
  { id: 3, clave: 'perfil.nombre', valor: { texto: 'Otro cliente' }, organizacion_id: 99 },
]
let sigId = 10
let modoFallo = null
function consulta() {
  const f = []; let op = 'select'; let datos = null
  const q = {
    select() { return q },
    eq(c, v) { f.push((r) => String(r[c]) === String(v)); return q },
    is(c) { f.push((r) => r[c] == null); return q },
    insert(d) { op = 'insert'; datos = d; return q },
    update(d) { op = 'update'; datos = d; return q },
    delete() { op = 'delete'; return q },
    maybeSingle() { return q.then((r) => ({ ...r, data: Array.isArray(r.data) ? r.data[0] ?? null : r.data })) },
    then(res, rej) {
      let r
      if (modoFallo) r = { data: null, error: modoFallo }
      else if (op === 'select') r = { data: filas.filter((x) => f.every((p) => p(x))), error: null }
      else if (op === 'insert') { const n = { id: sigId++, ...datos }; filas.push(n); r = { data: [n], error: null } }
      else if (op === 'update') { const m = filas.filter((x) => f.every((p) => p(x))); m.forEach((x) => Object.assign(x, datos)); r = { data: m, error: null } }
      else { filas = filas.filter((x) => !f.every((p) => p(x))); r = { data: null, error: null } }
      return Promise.resolve(r).then(res, rej)
    },
  }
  return q
}
supabase.from = () => consulta()

async function main() {
const esperar = () => new Promise((r) => setTimeout(r, 0))

console.log('\n=== MARCADORES Y ENLACES ===')
check('rellenar {titulo}', rellenar('Curso "{titulo}"', { titulo: 'Duelo' }) === 'Curso "Duelo"')
check('marcador desconocido se queda', rellenar('{otro}', {}) === '{otro}')
check('WhatsApp con mensaje', enlaceDe({ mensaje: 'Hola {titulo}' }, { titulo: 'X' }).startsWith('https://wa.me/') &&
  enlaceDe({ mensaje: 'Hola {titulo}' }, { titulo: 'X' }).includes(encodeURIComponent('Hola X')))
check('número propio limpia símbolos', enlaceDe({ mensaje: 'a', whatsapp: '+52 1 55-1234' }).startsWith('https://wa.me/521551234?'))
check('URL gana sobre mensaje', enlaceDe({ url: 'https://a.mx', mensaje: 'x' }) === 'https://a.mx')
check('sin enlace ni mensaje = null', enlaceDe({ texto: 'x' }) === null)

console.log('\n=== GUARDAR, MEZCLAR, RESTABLECER ===')
await guardarCapa('portada.agendar', { texto: 'Agenda ya' }, 7, 'yo@x.mx')
await esperar()
check('guardar crea la fila en la organización', filas.some((r) => r.clave === 'portada.agendar' && r.organizacion_id === 7))
check('resolver usa lo guardado', resolver('portada.agendar', { texto: 'Original', estilo: 'whatsapp' }).texto === 'Agenda ya')
check('resolver conserva campos no tocados', resolver('portada.agendar', { texto: 'Original', estilo: 'whatsapp' }).estilo === 'whatsapp')
check('sin capa = valor del código', resolver('nada.aqui', { texto: 'Igual' }).texto === 'Igual')
await guardarCapa('portada.agendar', { texto: 'Agenda hoy' }, 7)
check('guardar dos veces actualiza, no duplica', filas.filter((r) => r.clave === 'portada.agendar').length === 1 &&
  resolver('portada.agendar', {}).texto === 'Agenda hoy')
await guardarCapa('curso.x', { texto: 'General' }, 7)
await guardarCapa('curso.x@curso:3', { estilo: 'azul' }, 7)
const r3 = resolver('curso.x', { texto: 'Código', estilo: 'whatsapp' }, 'curso:3')
check('específico gana campo por campo', r3.texto === 'General' && r3.estilo === 'azul')
const r4 = resolver('curso.x', { texto: 'Código', estilo: 'whatsapp' }, 'curso:4')
check('otro curso solo ve lo general', r4.texto === 'General' && r4.estilo === 'whatsapp')
check('tieneCapa general', tieneCapa('curso.x'))
await restablecerCapa('curso.x', 7)
check('restablecer borra la fila', !filas.some((r) => r.clave === 'curso.x'))
check('tras restablecer vuelve el código', resolver('curso.x', { texto: 'Código' }, 'curso:4').texto === 'Código')
check('la otra organización no se mezcla', resolver('perfil.nombre', { texto: 'Dr.' }).texto === 'Dr.')

console.log('\n=== POR QUÉ NO SE PUEDE (mensajes) ===')
check('falta tabla -> nombra el SQL', /CONTENIDO_1_EDITABLE\.sql/.test(explicarError({ code: 'PGRST205', message: 'Could not find the table' })))
check('RLS -> nombra la política', /es_admin_de/.test(explicarError({ code: '42501', message: 'new row violates row-level security policy' })))
modoFallo = { code: 'PGRST205', message: "Could not find the table 'public.contenido_sitio'" }
let msg = ''
try { await guardarCapa('a', { texto: 'b' }, 7) } catch (e) { msg = e.message }
check('guardar sin tabla avisa del SQL', /CONTENIDO_1_EDITABLE\.sql/.test(msg))
modoFallo = null
// RLS que filtra en silencio: update no toca filas y no da error.
const fromOriginal = supabase.from
supabase.from = () => {
  const q = consulta()
  const upd = q.update
  q.update = (d) => { upd(d); q.then = (res) => Promise.resolve({ data: [], error: null }).then(res); return q }
  return q
}
msg = ''
try { await guardarCapa('portada.agendar', { texto: 'z' }, 7) } catch (e) { msg = e.message }
check('update filtrado por RLS no pasa por bueno', /permisos/.test(msg))
supabase.from = fromOriginal

console.log('\n' + '─'.repeat(56))
console.log(`  ${ok} pruebas OK / ${fallos.length} fallos`)
process.exit(fallos.length ? 1 : 0)
}
main()
