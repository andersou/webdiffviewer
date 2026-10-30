import { json } from '../lib/api/client.js'

// createCommitDetails returns load(hash) for /api/commit. Commits never change, so results are
// cached by repo+hash (call load early, e.g. on hover, to prefetch). File icons are warmed at the
// same time so the tree appears complete. Failed loads are dropped from the cache and retried.
export function createCommitDetails(repo) {
  const cache = new Map()
  return (hash) => {
    const key = `${repo()}\0${hash}`
    if (!cache.has(key)) {
      const p = json('commit', { repo: repo(), hash })
      p.then((d) =>
        import('../lib/icons/icons.js').then(({ fileIcon, folderIcon }) => {
          const urls = new Set()
          for (const f of d.files) {
            urls.add(fileIcon(f.path))
            const parts = f.path.split('/')
            for (let i = 1; i < parts.length; i++) urls.add(folderIcon(parts.slice(0, i).join('/'), true))
          }
          for (const u of urls) new Image().src = u
        }),
      ).catch(() => cache.delete(key))
      cache.set(key, p)
    }
    return cache.get(key)
  }
}
