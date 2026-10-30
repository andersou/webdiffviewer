// Preview themes: GitHub markdown CSS + tokyo-night highlight.js CSS (light/dark to match), scoped to .markdown-body so the diff view keeps its own colors.
import dark from 'github-markdown-css/github-markdown-dark.css?inline'
import dimmed from 'github-markdown-css/github-markdown-dark-dimmed.css?inline'
import light from 'github-markdown-css/github-markdown-light.css?inline'
import hlDark from 'highlight.js/styles/tokyo-night-dark.css?inline'
import hlLight from 'highlight.js/styles/tokyo-night-light.css?inline'

const CSS = {
  'github-light': [light, hlLight],
  'github-dark': [dark, hlDark],
  'github-dark-dimmed': [dimmed, hlDark],
}

let style
export function applyTheme(name) {
  const [css, hl] = CSS[name] ?? CSS['github-light']
  style ??= document.head.appendChild(document.createElement('style'))
  style.textContent = `${css}\n.markdown-body { ${hl} }`
}
