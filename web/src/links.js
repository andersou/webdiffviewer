// resolvePath turns a link/image href found in the markdown file `from` into a repo-relative path,
// or null for external URLs, anchors and paths that would leave the repo.
export function resolvePath(from, href) {
  if (!href || /^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(href)) return null
  let clean
  try {
    clean = decodeURIComponent(href.split(/[?#]/)[0])
  } catch {
    return null
  }
  if (!clean) return null
  const parts = clean.startsWith('/') ? [] : from.split('/').slice(0, -1)
  for (const seg of clean.split('/')) {
    if (seg === '..') {
      if (!parts.length) return null
      parts.pop()
    } else if (seg && seg !== '.') parts.push(seg)
  }
  return parts.join('/') || null
}
