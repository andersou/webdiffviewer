// The URL mirrors what is on screen (folder, repo, tab, base, open file, view), so links and
// reloads land on the same file. Preferences (themes, TOC, All branches) stay in localStorage.

const TABS = ['changes', 'files', 'commits']
const VIEWS = ['diff', 'file', 'preview']
const isMd = (path) => /\.(md|markdown|mdx)$/i.test(path || '')

// views lists what a selection can show: changes also offer the whole file; markdown adds a preview.
export const views = (sel) => [...(sel?.kind === 'diff' ? ['diff'] : []), 'file', ...(isMd(sel?.path) ? ['preview'] : [])]
// markdown opens as preview from the Explorer and as diff from Changes
export const DEFAULT_PREF = { file: 'preview', diff: 'diff' }
// viewOf is the view shown for sel, given the last choice per kind
export const viewOf = (sel, pref) => {
  const v = views(sel)
  return v.includes(pref[sel?.kind]) ? pref[sel?.kind] : v[0]
}

// relPath is `to` relative to `from` with "/" separators ("." when equal), so repo ids in the URL
// are short and don't expose the home folder. Another Windows drive keeps the absolute path.
export function relPath(from, to) {
  const a = from.split(/[\\/]+/).filter(Boolean)
  const b = to.split(/[\\/]+/).filter(Boolean)
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  if (i === 0 && /:$/.test(b[0] || '')) return to
  return [...Array(a.length - i).fill('..'), ...b.slice(i)].join('/') || '.'
}

// findRepo picks, from the server's list, the repo or worktree whose id is `id`
export function findRepo(repos, dir, id) {
  for (const r of repos) {
    for (const p of [r.path, ...r.worktrees.map((w) => w.path)]) if (relPath(dir, p) === id) return p
  }
}

// fromSearch decodes a query string; sel gets the same keys the sidebar lists use, so it is highlighted.
export function fromSearch(search) {
  const q = new URLSearchParams(search)
  const get = (k) => q.get(k) || ''
  const base = get('base')
  const wt = get('wt') !== '0'
  const commit = /^[0-9a-f]{7,64}$/i.test(get('commit')) ? get('commit') : ''
  const view = VIEWS.includes(get('view')) ? get('view') : ''
  let sel
  if (get('file')) sel = { kind: 'file', path: get('file'), key: 'f:' + get('file') }
  else if (get('diff')) {
    const path = get('diff')
    const orig = get('orig') || undefined
    const untracked = get('untracked') === '1'
    const staged = get('staged') === '1'
    sel = commit
      ? { kind: 'diff', path, orig, commit, key: `c:${commit}:${path}` }
      : base
        ? { kind: 'diff', path, orig, base, wt, untracked, key: 'b:' + path }
        : { kind: 'diff', path, orig, staged, untracked, key: (staged ? 's:' : 'w:') + path }
  }
  return { root: get('root'), repo: get('repo') || '.', tab: TABS.includes(get('tab')) ? get('tab') : 'changes', base, wt, commit, sel, view }
}

// toSearch encodes the state in a fixed order with defaults left out, so equal states give equal
// strings. The open commit is kept only without a file, or as the file's own commit.
export function toSearch(s) {
  const q = new URLSearchParams()
  const add = (k, v) => v && q.set(k, v === true ? '1' : v)
  add('root', s.root)
  add('repo', s.repo !== '.' && s.repo)
  add('tab', s.tab !== 'changes' && s.tab)
  add('base', s.base)
  if (s.base && !s.wt) q.set('wt', '0')
  const it = s.sel
  add('commit', it ? it.commit : s.commit)
  if (it) {
    add(it.kind === 'file' ? 'file' : 'diff', it.path)
    add('staged', it.staged)
    add('untracked', it.untracked)
    add('orig', it.orig)
  }
  add('view', s.view)
  const str = q.toString().replaceAll('%2F', '/') // "/" is valid in a query and keeps paths readable
  return str && '?' + str
}
