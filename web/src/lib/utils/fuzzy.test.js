import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fuzzy, fuzzyPath, rank } from './fuzzy.js'

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

test('fuzzyPath prefers a match in the file name', () => {
  const paths = ['tests/repository/test_user_repository.py', 'src/cloud_backend/service/user.py', 'src/cloud_backend/core/security.py']
  const best = rank(paths, 'user.py', (x) => x, fuzzyPath)
  assert.deepEqual(best.map((r) => r.item).slice(0, 2), ['src/cloud_backend/service/user.py', 'tests/repository/test_user_repository.py'])
  assert.deepEqual(best[0].idx, [26, 27, 28, 29, 30, 31, 32]) // highlighted in the name, not over the folders
  assert.deepEqual(fuzzyPath('core/sec', 'src/cloud_backend/core/security.py').idx.length, 8) // with "/", the whole path
})
