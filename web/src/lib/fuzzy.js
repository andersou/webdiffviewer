// fuzzy matches query as a subsequence of text (case-insensitive, spaces ignored).
// Returns { score, idx } with the matched character positions, or null. Consecutive
// characters and starts of path segments/words score higher; shorter texts win ties.
export function fuzzy(query, text) {
  const t = text.toLowerCase()
  const idx = []
  let score = 0
  let from = 0
  for (const ch of query.toLowerCase()) {
    if (ch === ' ') continue
    const i = t.indexOf(ch, from)
    if (i < 0) return null
    if (i === idx.at(-1) + 1) score += 5
    if (i === 0 || '/-_. '.includes(t[i - 1])) score += 3
    score += 1
    idx.push(i)
    from = i + 1
  }
  return { score: score - t.length / 100, idx }
}

// rank returns items whose key matches query, best first, each with its match positions.
export function rank(items, query, key = (x) => x) {
  if (!query.trim()) return items.map((item) => ({ item, idx: [] }))
  const out = []
  for (const item of items) {
    const m = fuzzy(query, key(item))
    if (m) out.push({ item, idx: m.idx, score: m.score })
  }
  return out.sort((a, b) => b.score - a.score)
}
