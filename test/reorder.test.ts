import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isNoop, transfer } from '../src/reorder.ts'

test('transfer reorders within one list', () => {
  const a = ['a', 'b', 'c', 'd']
  transfer(a, 0, a, 3); assert.deepEqual(a, ['b', 'c', 'a', 'd']) // before 'd'
  transfer(a, 2, a, 0); assert.deepEqual(a, ['a', 'b', 'c', 'd'])
  transfer(a, 1, a, 4); assert.deepEqual(a, ['a', 'c', 'd', 'b']) // append
})

test('transfer moves across lists, including into an empty one', () => {
  const a = ['a', 'b'], b: string[] = []
  transfer(a, 1, b, 0); assert.deepEqual([a, b], [['a'], ['b']])
  transfer(a, 0, b, 1); assert.deepEqual([a, b], [[], ['b', 'a']])
  transfer(b, 1, a, 0); assert.deepEqual([a, b], [['a'], ['b']])
})

test('drops next to the dragged item are no-ops only in the same list', () => {
  assert.equal(isNoop(true, 2, 2), true)
  assert.equal(isNoop(true, 2, 3), true)
  assert.equal(isNoop(true, 2, 1), false)
  assert.equal(isNoop(false, 2, 2), false)
})
