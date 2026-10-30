// parseDiff turns a unified diff into display rows: hunk headers, plus context/added/removed
// lines with their old (o) and new (n) line numbers. The file header before the first hunk is dropped.
export function parseDiff(src) {
  const rows = []
  let o = 0
  let n = 0
  for (const line of src.split('\n')) {
    const m = /^@@ -(\d+)(?:,\d+)? \+(\d+)/.exec(line)
    if (m) {
      o = +m[1]
      n = +m[2]
      rows.push({ t: 'hunk', text: line })
    } else if (!rows.length) {
      continue // file header (diff --git, index, ---, +++)
    } else if (line[0] === '+') rows.push({ t: 'add', n: n++, text: line.slice(1) })
    else if (line[0] === '-') rows.push({ t: 'del', o: o++, text: line.slice(1) })
    else if (line[0] === ' ') rows.push({ t: 'ctx', o: o++, n: n++, text: line.slice(1) })
    else if (line[0] === '\\') rows.push({ t: 'hunk', text: line })
  }
  return rows
}
