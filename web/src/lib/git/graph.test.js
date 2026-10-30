import assert from 'node:assert/strict'
import { test } from 'node:test'
import { graph } from './graph.js'

const c = (hash, ...parents) => ({ hash, parents })

test('linear history stays in one lane', () => {
  const rows = graph([c('c', 'b'), c('b', 'a'), c('a')])
  assert.deepEqual(rows.map((r) => r.col), [0, 0, 0])
  assert.deepEqual(rows[0].segs, [[0, 0.5, 0, 1, 0]]) // tip: no line above
  assert.deepEqual(rows[1].segs, [[0, 0, 0, 0.5, 0], [0, 0.5, 0, 1, 0]])
  assert.deepEqual(rows[2].segs, [[0, 0, 0, 0.5, 0]]) // root: no line below
})

test('branch and merge', () => {
  // d -> m (merge of e and f); e and f both come from r
  const rows = graph([c('d', 'm'), c('m', 'e', 'f'), c('f', 'r'), c('e', 'r'), c('r')])
  assert.deepEqual(rows.map((r) => r.col), [0, 0, 1, 0, 0]) // the main line stays in lane 0
  assert.deepEqual(rows[1].segs, [[0, 0, 0, 0.5, 0], [0, 0.5, 0, 1, 0], [0, 0.5, 1, 1, 1]]) // fork to f's lane
  assert.deepEqual(rows[3].segs, [[0, 0, 0, 0.5, 0], [1, 0, 0, 1, 1], [0, 0.5, 0, 1, 0]]) // f's lane folds back into lane 0
  assert.deepEqual(rows[4].segs, [[0, 0, 0, 0.5, 0]])
  assert.equal(Math.max(...rows.map((r) => r.width)), 2)
})

test('two branch tips get separate lanes and free lanes are reused', () => {
  const rows = graph([c('x', 'a'), c('y', 'b'), c('b', 'a'), c('a'), c('z')])
  assert.deepEqual(rows.map((r) => r.col), [0, 1, 1, 0, 0])
})
