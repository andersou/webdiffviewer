import assert from 'node:assert/strict'
import { test } from 'node:test'
import { baseItems, changeItems } from '../git/changes.js'
import { findRepo, fromSearch, relPath, toSearch } from './url.js'

const H = 'cfcbd348'.padEnd(40, '0')

test('every URL shape survives decode + encode unchanged', () => {
  for (const u of [
    '',
    '?diff=web/src/App.jsx',
    '?diff=web/src/App.jsx&staged=1',
    '?diff=notes.md&untracked=1',
    '?diff=web/src/new.js&orig=web/src/old.js',
    '?base=main&diff=web/src/App.jsx',
    '?base=feat/x&wt=0&diff=web/src/App.jsx',
    '?tab=files&file=internal/api/router.go',
    '?diff=README.md&view=preview',
    `?tab=commits&commit=${H}`,
    `?tab=commits&commit=${H}&diff=web/src/App.jsx`,
    '?repo=../wdv-feature&diff=a.go',
    '?root=/Users/dev/git/acme&repo=packages/ui&tab=files',
    '?file=a+b/%23c%26d%25.md',
    '?file=%C3%A1rvore+%E2%9C%93.txt',
  ]) {
    assert.equal(toSearch(fromSearch(u)), u, u)
  }
})

test('decoded selections match the sidebar keys', () => {
  const status = [{ x: 'M', y: 'M', path: 'a.go' }, { x: '?', y: '?', path: 'n.go' }]
  for (const it of [...changeItems(status, true), ...changeItems(status, false)]) {
    const q = toSearch({ repo: '.', tab: 'changes', sel: it })
    assert.equal(fromSearch(q).sel.key, it.key, q)
  }
  for (const it of baseItems(status, 'main', false)) assert.equal(fromSearch(toSearch({ repo: '.', tab: 'changes', base: 'main', wt: false, sel: it })).sel.key, it.key)
  assert.equal(fromSearch(`?commit=${H}&diff=x.go`).sel.key, `c:${H}:x.go`)
})

test('invalid values are ignored', () => {
  const w = fromSearch('?tab=nope&view=evil&commit=HEAD~1')
  assert.deepEqual([w.tab, w.view, w.commit, w.repo], ['changes', '', '', '.'])
})

test('relPath and findRepo', () => {
  assert.equal(relPath('/u/git/app', '/u/git/app'), '.')
  assert.equal(relPath('/u/git/app', '/u/git/app/vendor/lib'), 'vendor/lib')
  assert.equal(relPath('/u/git/app', '/u/git/app-feature'), '../app-feature')
  assert.equal(relPath('C:\\git\\app', 'C:\\git\\app\\sub'), 'sub')
  assert.equal(relPath('C:\\git\\app', 'D:\\other'), 'D:\\other')
  const repos = [{ path: '/u/git/app', worktrees: [{ path: '/u/git/app-feature' }] }]
  assert.equal(findRepo(repos, '/u/git/app', '../app-feature'), '/u/git/app-feature')
  assert.equal(findRepo(repos, '/u/git/app', '.'), '/u/git/app')
  assert.equal(findRepo(repos, '/u/git/app', 'gone'), undefined)
})
