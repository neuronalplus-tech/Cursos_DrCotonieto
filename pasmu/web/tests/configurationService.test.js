import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('configuration draft service requires an active unit and never sends a null scope', async () => {
  const service = await readFile(new URL('../src/services/pasmuService.js', import.meta.url), 'utf8')
  const start = service.indexOf('export async function createConfigurationChange')
  const end = service.indexOf('export async function submitConfigurationChange', start)

  assert.notEqual(start, -1, 'configuration draft service must be defined')
  assert.notEqual(end, -1, 'configuration submission service must follow draft creation')
  const createDraft = service.slice(start, end)
  assert.match(createDraft, /if \(!user\.unitId\) throw new Error\(/)
  assert.match(createDraft, /_unidad_id: user\.unitId,/)
  assert.doesNotMatch(createDraft, /_unidad_id: user\.unitId \?\? null/)
})
