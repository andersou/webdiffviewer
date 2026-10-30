const MAX = 512 * 1024 // bigger files stay plain text so the view opens instantly

let hljs
const load = () => (hljs ??= import('highlight.js/lib/common').then((m) => m.default))

// splitLines cuts highlighted HTML at newlines, closing and reopening spans so every line is valid HTML.
export function splitLines(html) {
  const out = []
  const open = []
  let cur = ''
  for (const tok of html.match(/<span[^>]*>|<\/span>|\n|[^<\n]+/g) || []) {
    if (tok === '\n') {
      out.push(cur + '</span>'.repeat(open.length))
      cur = open.join('')
    } else {
      if (tok.startsWith('<span')) open.push(tok)
      else if (tok === '</span>') open.pop()
      cur += tok
    }
  }
  out.push(cur + '</span>'.repeat(open.length))
  return out
}

// highlight sets row.html on each row in rows, treated as one continuous source; leaves rows untouched if the language is unknown.
export async function highlight(path, rows) {
  const code = rows.map((r) => r.text).join('\n')
  if (!rows.length || code.length > MAX) return
  const h = await load()
  const name = path.split('/').pop().toLowerCase()
  const lang = [name.split('.').pop(), name].find((l) => h.getLanguage(l))
  if (!lang) return
  const lines = splitLines(h.highlight(code, { language: lang, ignoreIllegals: true }).value)
  rows.forEach((r, i) => (r.html = lines[i]))
}
