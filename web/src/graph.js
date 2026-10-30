// graph lays out a commit list (topo order: children before parents) into lanes for drawing.
// Each row gets the commit's column and line segments [x1, y1, x2, y2, lane] in lane units,
// with y in row units: 0 = top edge, 0.5 = the commit dot, 1 = bottom edge.
// Lanes keep their column while they live, so lines only bend at merges and forks.
export function graph(commits) {
  const lanes = [] // lane -> hash it is waiting for (null = free)
  const free = () => {
    const i = lanes.indexOf(null)
    return i === -1 ? lanes.length : i
  }
  return commits.map((c) => {
    const before = lanes.slice()
    let col = lanes.indexOf(c.hash)
    if (col === -1) col = free() // branch tip: nothing above it
    const segs = []
    before.forEach((h, j) => {
      if (h === c.hash) segs.push([j, 0, col, 0.5, j]) // this lane (or a merging one) ends at the dot
      else if (h !== null) segs.push([j, 0, j, 1, j]) // passes through
    })
    for (let i = 0; i < lanes.length; i++) if (lanes[i] === c.hash) lanes[i] = null
    const [first, ...rest] = c.parents
    if (first !== undefined) {
      const k = lanes.indexOf(first)
      if (k === -1) {
        lanes[col] = first
        segs.push([col, 0.5, col, 1, col])
      } else if (k > col) {
        // parent already awaited further right: pull that lane into this one, so the
        // leftmost line (usually the main branch) stays straight
        lanes[k] = null
        lanes[col] = first
        segs[segs.findIndex((g) => g[0] === k && g[1] === 0)] = [k, 0, col, 1, k]
        segs.push([col, 0.5, col, 1, col])
      } else {
        segs.push([col, 0.5, k, 1, k]) // awaited further left: join it
      }
    }
    for (const p of rest) {
      let k = lanes.indexOf(p)
      if (k === -1) lanes[(k = free())] = p
      segs.push([col, 0.5, k, 1, k])
    }
    while (lanes.length && lanes.at(-1) === null) lanes.pop()
    return { col, segs, width: Math.max(before.length, lanes.length, col + 1) }
  })
}
