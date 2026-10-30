// Turns /api/status entries ({ x, y, path, orig, dirty }) into tree items for the sidebar.

// statusLetter shows untracked ("?") as U, like VS Code
export const statusLetter = (c) => (c === '?' ? 'U' : c)

// changeItems lists staged (index column) or unstaged (worktree column) changes.
export const changeItems = (status, staged) =>
  status
    .filter((c) => (staged ? c.x !== ' ' && c.x !== '?' : c.y !== ' '))
    .map((c) => ({ ...c, key: (staged ? 's:' : 'w:') + c.path, kind: 'diff', staged, untracked: c.x === '?', status: statusLetter(staged ? c.x : c.y) }))

// baseItems lists a branch comparison; "•" marks files that also have uncommitted changes.
export const baseItems = (status, base, wt) =>
  status.map((c) => ({ ...c, key: 'b:' + c.path, kind: 'diff', base, wt, untracked: c.x === '?', status: statusLetter(c.x) + (c.dirty ? '•' : '') }))

// statusByPath gives each changed file one letter for the Explorer (worktree status wins).
export const statusByPath = (status) => new Map(status.map((c) => [c.path, statusLetter(c.y !== ' ' ? c.y : c.x)]))
