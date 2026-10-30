import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fuzzy, rank } from './fuzzy.js'

test('fuzzy matches subsequences and reports positions', () => {
  assert.deepEqual(fuzzy('acb', 'acme-cloud-backend').idx, [0, 1, 11])
  assert.equal(fuzzy('xyz', 'acme-cloud-backend'), null)
  assert.deepEqual(fuzzy('A C', 'acme-cloud').idx, [0, 1]) // case and spaces ignored
})

test('rank prefers word starts and consecutive runs', () => {
  const names = ['acme-cloud-frontend', 'acme-cloud-backend', 'slides-bmad', 'acme-cloud-bmad']
  assert.equal(rank(names, 'bmad')[0].item, 'slides-bmad') // shorter of the two exact segment hits
  assert.equal(rank(names, 'acbmad')[0].item, 'acme-cloud-bmad')
  assert.equal(rank(names, 'back')[0].item, 'acme-cloud-backend')
  assert.equal(rank(names, '').length, 4)
})
