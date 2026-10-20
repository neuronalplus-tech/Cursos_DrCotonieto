import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migrationUrl = new URL('../../sql/09_gobierno_configuracion.sql', import.meta.url)
const verifierUrl = new URL('../../sql/08_verificar_rls.sql', import.meta.url)

test('configuration migration persists versioned requests with append-only review evidence', async () => {
  const sql = await readFile(migrationUrl, 'utf8')

  for (const table of [
    'solicitudes_cambio_configuracion',
    'revisiones_cambio_configuracion',
    'eventos_cambio_configuracion'
  ]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`))
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`))
  }

  assert.match(sql, /unique \(cambio_id, version\)/)
  assert.match(sql, /sustituye_id/)
  assert.match(sql, /v_request\.creada_por = v_actor/)
  assert.match(sql, /configuracion\.aprobar_alto_riesgo/)
  assert.match(sql, /revisiones_cambio_configuracion \(/)
  assert.match(sql, /eventos_cambio_configuracion \(/)
  assert.match(sql, /configuracion\.ver', v_previous\.unidad_id/)
  assert.match(sql, /unidad_id bigint not null references public\.unidades/)
  assert.match(sql, /if _unidad_id is null then/)
  assert.match(sql, /if not found\s+or v_actor is null\s+or not private\.pasmu_has_permission\('configuracion\.proponer'/)
  for (const key of ['description', 'scope', 'impact', 'rollbackPlan', 'validationEvidence']) {
    assert.ok(sql.includes(`propuesta->'${key}'`), `database contract must validate ${key}`)
    assert.match(sql, new RegExp(`jsonb_typeof\\(propuesta->'${key}'\\) is not distinct from 'string'`))
  }
})

test('configuration migration exposes no direct client DML or active-publication function', async () => {
  const sql = await readFile(migrationUrl, 'utf8')

  assert.match(sql, /revoke all on table[\s\S]*from public, anon, authenticated/)
  assert.match(sql, /grant select \([\s\S]*\) on table public\.solicitudes_cambio_configuracion to authenticated/)
  assert.match(sql, /revoke all on function private\.pasmu_configuracion_decidir_revision[\s\S]*from public, anon/)
  assert.match(sql, /grant execute on function private\.pasmu_configuracion_decidir_revision[\s\S]*to authenticated/)
  assert.match(sql, /create or replace function public\.pasmu_configuration_create_draft/)
  assert.match(sql, /create or replace function public\.pasmu_configuration_submit_review/)
  assert.match(sql, /create or replace function public\.pasmu_configuration_review/)
  assert.match(sql, /set search_path = ''/)
  assert.doesNotMatch(sql, /create\s+(?:or\s+replace\s+)?function\s+private\.pasmu_configuracion_(?:publicar|activar)/i)
  assert.doesNotMatch(sql, /insert into public\.rol_permisos/i)
})

test('RLS verifier includes the new configuration tables and policy allowlist', async () => {
  const sql = await readFile(verifierUrl, 'utf8')

  for (const token of [
    'solicitudes_cambio_configuracion',
    'revisiones_cambio_configuracion',
    'eventos_cambio_configuracion',
    'private.pasmu_configuracion_crear_borrador(text,bigint,text,text,jsonb,uuid)',
    'solicitudes_cambio_configuracion_read',
    'revisiones_cambio_configuracion_read',
    'eventos_cambio_configuracion_read',
    'public.pasmu_configuration_create_draft(text,bigint,text,text,jsonb,uuid)',
    'public.pasmu_configuration_submit_review(uuid)',
    'public.pasmu_configuration_review(uuid,text,text)'
  ]) {
    assert.ok(sql.includes(token), `expected verifier to include ${token}`)
  }

  for (const table of [
    'solicitudes_cambio_configuracion',
    'revisiones_cambio_configuracion',
    'eventos_cambio_configuracion'
  ]) {
    assert.equal(
      [...sql.matchAll(new RegExp(`\\('${table}'\\)`, 'g'))].length,
      3,
      `expected ${table} exactly once in each expected-table allowlist`
    )
  }
})
