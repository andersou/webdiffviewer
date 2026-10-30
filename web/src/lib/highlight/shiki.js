// Shiki highlighter (VS Code's TextMate grammars). This module is loaded lazily, and each
// grammar and theme is fetched only the first time it is used. The pure-JS regex engine avoids
// shipping Oniguruma's WASM; "forgiving" skips the few patterns it can't run instead of failing.
import { createHighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import { bundledLanguagesInfo } from 'shiki/langs'

const langs = new Map(bundledLanguagesInfo.map((l) => [l.id, l]))
// only the themes the app uses, so the other ~60 bundled themes don't ship in the binary
const themes = {
  'tokyo-night': () => import('@shikijs/themes/tokyo-night'),
  'github-light': () => import('@shikijs/themes/github-light'),
}

// every language id and alias -> id, for langFor
export const ids = new Map(bundledLanguagesInfo.flatMap((l) => [[l.id, l.id], ...(l.aliases ?? []).map((a) => [a, l.id])]))

let core
// ready returns the highlighter with lang (an id or alias, may be null) and theme loaded.
export async function ready(lang, theme) {
  const h = await (core ??= createHighlighterCore({ themes: [], langs: [], engine: createJavaScriptRegexEngine({ forgiving: true }) }))
  const id = ids.get(lang)
  if (id && !h.getLoadedLanguages().includes(id)) await h.loadLanguage(langs.get(id).import())
  if (!h.getLoadedThemes().includes(theme)) await h.loadTheme(themes[theme]())
  return h
}

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

// lineHtml renders one line of Shiki tokens as colored spans
export const lineHtml = (tokens) =>
  tokens
    .map((t) => {
      const style = (t.color ? `color:${t.color};` : '') + (t.fontStyle & 1 ? 'font-style:italic;' : '') + (t.fontStyle & 2 ? 'font-weight:bold;' : '')
      return style ? `<span style="${style}">${esc(t.content)}</span>` : esc(t.content)
    })
    .join('')
