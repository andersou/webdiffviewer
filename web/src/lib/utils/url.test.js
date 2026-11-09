import assert from 'node:assert/strict'
import { test } from 'node:test'
import { baseItems, changeItems } from '../git/changes.js'
import { findRepo, fromSearch, relPath, toSearch, viewOf, views } from './url.js'

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
    '?tab=files&ref=origin/feat&file=a.go',
    '?ref=feat&diff=a.go',
    '?ref=feat&base=main&diff=a.go',
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
  // a viewed branch without Base compares with HEAD, so its diffs are branch-comparison items
  assert.deepEqual(fromSearch('?ref=feat&diff=a.go').sel, { kind: 'diff', path: 'a.go', orig: undefined, base: 'HEAD', wt: true, untracked: false, key: 'b:a.go' })
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

test('an item opened with a view keeps it until a view is picked', () => {
  const pref = { file: 'preview', diff: 'diff' }
  assert.equal(viewOf({ kind: 'diff', path: 'a.py', view: 'file' }, pref), 'file') // a search result in a changed file
  assert.equal(viewOf({ kind: 'diff', path: 'a.py' }, pref), 'diff')
  assert.equal(viewOf({ kind: 'file', path: 'a.md', view: 'file' }, pref), 'file')
  assert.equal(viewOf({ kind: 'file', path: 'a.py', view: 'diff' }, pref), 'file') // a view the item can't show is ignored
})

test('blame is offered for files with history only', () => {
  assert.deepEqual(views({ kind: 'diff', path: 'a.py' }), ['diff', 'file', 'blame'])
  assert.deepEqual(views({ kind: 'file', path: 'a.md' }), ['file', 'blame', 'preview'])
  assert.deepEqual(views({ kind: 'diff', path: 'n.py', untracked: true }), ['diff', 'file'])
  assert.deepEqual(views({ kind: 'diff', path: 'gone.py', status: 'D•' }), ['diff', 'file'])
  assert.deepEqual(views({ kind: 'diff', path: 'a.PNG' }), ['preview'])
  assert.deepEqual(views({ kind: 'file', path: 'clip.mp4' }), ['preview'])
  assert.deepEqual(views({ kind: 'diff', path: 'gone.jpg', status: 'D' }), ['diff'])
  assert.deepEqual(views({ kind: 'file', path: 'logo.svg' }), ['file', 'blame', 'preview'])
  assert.deepEqual(views({ kind: 'file', path: 'out/log.txt', ignored: true }), ['file'])
})
