import assert from 'node:assert/strict'
import { test } from 'node:test'
import { clampZoom, stepZoom } from '../src/usePanZoom.ts'

test('zoom buttons step between stops and clamp at the ends', () => {
  assert.equal(stepZoom(1, 1), 1.25)
  assert.equal(stepZoom(1, -1), 0.75)
  assert.equal(stepZoom(1.1, 1), 1.25) // after a wheel zoom, snap to the next stop
  assert.equal(stepZoom(1.1, -1), 1)
  assert.equal(stepZoom(3, 1), 3)
  assert.equal(stepZoom(0.5, -1), 0.5)
  assert.equal(clampZoom(9), 3)
  assert.equal(clampZoom(0.1), 0.5)
})
