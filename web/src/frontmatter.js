export const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

const FM = /^---\r?\n(?:([\s\S]*?)\r?\n)?(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/

// splitFrontmatter returns [yamlText, body]; yamlText is null when the file has no leading --- block.
export function splitFrontmatter(src) {
  const m = FM.exec(src)
  return m ? [m[1] ?? '', src.slice(m[0].length)] : [null, src]
}

// fmTable renders parsed YAML: objects as key/value tables (nested), scalar arrays as chips.
export function fmTable(v) {
  if (Array.isArray(v)) {
    if (v.every((x) => x === null || typeof x !== 'object')) return `<ul class="fm-list">${v.map((x) => `<li>${fmTable(x)}</li>`).join('')}</ul>`
    return v.map(fmTable).join('')
  }
  if (v instanceof Date) return esc(v.toISOString())
  if (v && typeof v === 'object')
    return `<table class="fm"><tbody>${Object.entries(v).map(([k, x]) => `<tr><th>${esc(k)}</th><td>${fmTable(x)}</td></tr>`).join('')}</tbody></table>`
  return v === null ? '<span class="fm-null">null</span>' : esc(String(v))
}
