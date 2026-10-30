// Markdown engine modelled on Markdown Preview Enhanced (crossnote): markdown-it + the same plugin set.
// Loaded lazily by render.js; returns unsanitized HTML. Code blocks are colored by the `code`
// function passed to render (Shiki, prepared for this source's languages).
import katex from '@vscode/markdown-it-katex'
import tasks from '@hackmd/markdown-it-task-lists'
import MarkdownIt from 'markdown-it'
import abbr from 'markdown-it-abbr'
import anchor from 'markdown-it-anchor'
import deflist from 'markdown-it-deflist'
import { full as emoji } from 'markdown-it-emoji'
import footnote from 'markdown-it-footnote'
import alerts from 'markdown-it-github-alerts'
import mark from 'markdown-it-mark'
import sub from 'markdown-it-sub'
import sup from 'markdown-it-sup'
import toc from 'markdown-it-toc-done-right'
import YAML from 'yaml'
import admonition from './admonition.js'
import { esc, fmTable, splitFrontmatter } from './frontmatter.js'

const DIAGRAMS = { mermaid: 'mermaid', dot: 'graphviz', graphviz: 'graphviz', viz: 'graphviz' }

// set by render for the duration of one md.render call (markdown-it's highlight hook is synchronous)
let highlightCode = () => ''

// GitHub-style slugs, shared by heading ids and [TOC] links
const slugify = (s) => s.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-')

const md = new MarkdownIt({
  html: true, // sanitized by the caller
  linkify: true,
  typographer: true,
  highlight(code, info) {
    const lang = info.split(/[\s{]/)[0].toLowerCase()
    if (DIAGRAMS[lang]) return `<pre class="${DIAGRAMS[lang]}">${esc(code)}</pre>`
    return highlightCode(code, lang)
  },
})
  .use(footnote)
  .use(emoji)
  .use(sub)
  .use(sup)
  .use(mark)
  .use(abbr)
  .use(deflist)
  .use(tasks, { enabled: false, label: true })
  .use(katex.default ?? katex, { throwOnError: false })
  .use(alerts)
  .use(admonition)
  .use(anchor, { slugify })
  .use(toc, { slugify, listType: 'ul' }) // [TOC] or [[toc]]

// render turns markdown into HTML; code(code, lang) returns a highlighted block or '' for plain.
export function render(src, code = () => '') {
  highlightCode = code
  const [yaml, body] = splitFrontmatter(src)
  let fm = ''
  if (yaml?.trim()) {
    try {
      fm = `<div class="frontmatter">${fmTable(YAML.parse(yaml))}</div>`
    } catch (e) {
      fm = `<div class="frontmatter"><div class="fm-error">Invalid frontmatter: ${esc(e.message)}</div>${highlightCode(yaml, 'yaml')}</div>`
    }
  }
  return fm + md.render(body)
}
