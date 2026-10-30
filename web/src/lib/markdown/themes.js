// Preview themes: GitHub markdown CSS, injected on first use. Code blocks get their colors
// inline from Shiki (see MarkdownPreview's THEMES[...].code).
import dark from 'github-markdown-css/github-markdown-dark.css?inline'
import dimmed from 'github-markdown-css/github-markdown-dark-dimmed.css?inline'
import light from 'github-markdown-css/github-markdown-light.css?inline'

const CSS = { 'github-light': light, 'github-dark': dark, 'github-dark-dimmed': dimmed }

let style
export function applyTheme(name) {
  style ??= document.head.appendChild(document.createElement('style'))
  style.textContent = CSS[name] ?? CSS['github-light']
}
