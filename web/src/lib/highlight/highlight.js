// Syntax highlighting entry points; the Shiki engine (shiki.js) loads on first use.
import { langFor } from './language.js'

const MAX = 512 * 1024 // bigger files stay plain text so the view opens instantly
export const CODE_THEME = 'tokyo-night' // diff and File views

let shiki
const load = () => (shiki ??= import('./shiki.js'))

// highlight sets row.html on each row, treating rows as one continuous source (so multi-line
// strings and comments color correctly); rows stay plain if the language is unknown.
export async function highlight(path, rows, theme = CODE_THEME) {
  const code = rows.map((r) => r.text).join('\n')
  if (!rows.length || code.length > MAX) return
  const s = await load()
  const lang = langFor(path, s.ids)
  if (!lang) return
  const h = await s.ready(lang, theme)
  const { tokens } = h.codeToTokens(code, { lang, theme })
  rows.forEach((r, i) => (r.html = s.lineHtml(tokens[i] ?? [])))
}

// codeBlocks prepares Shiki for the fenced code languages in a markdown source and returns a
// synchronous highlighter for markdown-it: (code, lang) => html, or '' to leave a block plain.
export async function codeBlocks(src, theme) {
  const s = await load()
  const wanted = new Set([...src.matchAll(/^[ \t]*(?:`{3,}|~{3,})[ \t]*([^\s`{]+)/gm)].map((m) => m[1].toLowerCase()))
  if (src.startsWith('---')) wanted.add('yaml') // invalid frontmatter is shown as highlighted YAML
  const known = [...wanted].filter((l) => s.ids.has(l))
  let h
  for (const lang of known.length ? known : [null]) h = await s.ready(lang, theme)
  return (code, lang) => (known.includes(lang) ? h.codeToHtml(code, { lang, theme }) : '')
}
