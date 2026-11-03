// ago is a compact age ("31m", "2h", "6d") for narrow columns; callers put the full date in a title
export function ago(seconds) {
  const s = Math.max(0, Date.now() / 1000 - seconds)
  for (const [unit, n] of [['y', 31536000], ['mo', 2592000], ['w', 604800], ['d', 86400], ['h', 3600], ['m', 60]]) {
    if (s >= n) return Math.floor(s / n) + unit
  }
  return 'now'
}
