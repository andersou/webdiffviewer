let engine
const load = () =>
  (engine ??= Promise.all([import('./engine'), import('dompurify'), import('katex/dist/katex.min.css')]).then(([{ render }, { default: purify }]) => ({
    render,
    purify,
  })))

// repo markdown is untrusted: strip scripts/handlers before it touches the DOM
export async function renderMarkdown(src) {
  const { render, purify } = await load()
  return purify.sanitize(render(src))
}

let mermaid, viz
// renderDiagrams turns <pre class="mermaid|graphviz"> blocks inside el into SVG (libraries load only when used).
export async function renderDiagrams(el, dark) {
  const mer = el.querySelectorAll('pre.mermaid')
  if (mer.length) {
    const m = await (mermaid ??= import('mermaid').then((x) => x.default))
    m.initialize({ startOnLoad: false, theme: dark ? 'dark' : 'default', securityLevel: 'strict' })
    await m.run({ nodes: mer, suppressErrors: true })
  }
  const gv = el.querySelectorAll('pre.graphviz')
  if (gv.length) {
    const [v, { purify }] = await Promise.all([(viz ??= import('@viz-js/viz').then((x) => x.instance())), load()])
    for (const pre of gv) {
      try {
        // dot can carry URL attributes, so its SVG is sanitized too
        pre.outerHTML = `<div class="graphviz">${purify.sanitize(v.renderString(pre.textContent, { format: 'svg' }), { USE_PROFILES: { svg: true } })}</div>`
      } catch (e) {
        pre.textContent = `Graphviz error: ${e.message}`
      }
    }
  }
}
