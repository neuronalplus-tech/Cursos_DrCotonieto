import test from 'node:test'
import assert from 'node:assert/strict'
import { ANATOMIA_PASMU, aplicarPlantillaCita, enlaceWhatsAppCita, normalizarTelefonoMX, parsePadronClinico } from '../src/lib/anatomiaPasmu.js'
import { puedeEn } from '../src/lib/permisosPasmu.js'

test('anatomia clinica cubre expediente modular con permiso por seccion', () => {
  const claves = ANATOMIA_PASMU.map((s) => s.clave)
  for (const esperada of ['historia', 'examen_mental', 'notas', 'tareas', 'material', 'autoevaluaciones', 'asistencia', 'reportes', 'consentimientos']) {
    assert.ok(claves.includes(esperada), `falta seccion ${esperada}`)
  }
  assert.ok(ANATOMIA_PASMU.every((s) => s.permiso && s.seccion))
})

test('ambito nulo amplia y ambito concreto restringe como en Cursos', () => {
  const ind = { 'casos.ver': [{ unidad: null, programa: null }] }
  assert.equal(puedeEn(ind, 'casos.ver'), true)
  assert.equal(puedeEn(ind, 'casos.ver', { unidad: 1 }), true)
  const acotado = { 'casos.ver': [{ unidad: 2, programa: null }] }
  assert.equal(puedeEn(acotado, 'casos.ver', { unidad: 2 }), true)
  assert.equal(puedeEn(acotado, 'casos.ver', { unidad: 1 }), false)
})

test('padron clinico ancla por correo y no inventa cuentas', () => {
  const { filas, errores } = parsePadronClinico('Ana Ruiz\tana@ejemplo.mx\nsin-correo\nana@ejemplo.mx')
  assert.equal(filas.length, 1)
  assert.equal(filas[0].email, 'ana@ejemplo.mx')
  assert.ok(errores.length >= 1)
})

test('whatsapp normaliza MX y plantilla de cita sin PII clinica', () => {
  assert.equal(normalizarTelefonoMX('771 123 4567'), '527711234567')
  assert.equal(normalizarTelefonoMX('abc'), null)
  const link = enlaceWhatsAppCita('7711234567', 'Hola {{nombre}}')
  assert.ok(link.startsWith('https://wa.me/527711234567'))
  assert.equal(aplicarPlantillaCita('Hola {{nombre}} el {{fecha}} en {{unidad}}', { nombre: 'Ana', fecha: 'lunes 10:00', unidad: 'UAP' }), 'Hola Ana el lunes 10:00 en UAP')
})
