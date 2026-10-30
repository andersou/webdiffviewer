import assert from 'node:assert/strict'
import { test } from 'node:test'
import { baseItems, changeItems, statusByPath } from './changes.js'

const status = [
  { x: 'M', y: 'M', path: 'both.go' },
  { x: 'A', y: ' ', path: 'staged.go' },
  { x: ' ', y: 'D', path: 'gone.go' },
  { x: '?', y: '?', path: 'new.go' },
]

test('changeItems splits staged and unstaged columns', () => {
  assert.deepEqual(changeItems(status, true).map((i) => [i.path, i.status, i.key]), [['both.go', 'M', 's:both.go'], ['staged.go', 'A', 's:staged.go']])
  const unstaged = changeItems(status, false)
  assert.deepEqual(unstaged.map((i) => [i.path, i.status]), [['both.go', 'M'], ['gone.go', 'D'], ['new.go', 'U']])
  assert.equal(unstaged.find((i) => i.path === 'new.go').untracked, true)
})

test('baseItems marks dirty files and carries the comparison', () => {
  const [item] = baseItems([{ x: 'M', y: ' ', path: 'a.go', dirty: true }], 'main', true)
  assert.deepEqual([item.status, item.base, item.wt, item.key], ['M•', 'main', true, 'b:a.go'])
})

test('statusByPath prefers the worktree letter', () => {
  assert.deepEqual([...statusByPath(status)], [['both.go', 'M'], ['staged.go', 'A'], ['gone.go', 'D'], ['new.go', 'U']])
})
