import { createEffect, createResource, createSignal, For, onCleanup, Show } from 'solid-js'
import { css, cva } from 'styled-system/css'
import { text } from '../lib/api/client.js'
import { resolvePath } from '../lib/utils/links.js'
import { errorBox } from './ui/styles.js'
import { renderDiagrams, renderMarkdown } from '../lib/markdown/render.js'
import './MarkdownPreview.css'

// preview themes; their CSS lives in themes.js and loads with the first preview. `code` is the
// Shiki theme for code blocks: Shiki has no light Tokyo Night, so the light preview uses GitHub's.
export const THEMES = {
  'github-light': { label: 'GitHub Light', bg: '#ffffff', fg: '#1f2328', border: '#d1d9e0', dark: false, code: 'github-light' },
  'github-dark': { label: 'GitHub Dark', bg: '#0d1117', fg: '#f0f6fc', border: '#3d444d', dark: true, code: 'tokyo-night' },
  'github-dark-dimmed': { label: 'GitHub Dark Dimmed', bg: '#212830', fg: '#d1d7e0', border: '#3d444d', dark: true, code: 'tokyo-night' },
}

const wrap = css({ flex: 1, minH: 0, display: 'flex', position: 'relative' })
const pane = css({ flex: 1, minW: 0, display: 'flex', position: 'relative' })
const scroller = css({ flex: 1, overflow: 'auto' })
// floats over the text's top-right corner, clear of the scrollbar, in the theme's own colors
const themeBtn = css({
  position: 'absolute',
  top: '10px',
  right: '22px',
  zIndex: 2,
  display: 'grid',
  placeItems: 'center',
  w: '30px',
  h: '30px',
  border: '1px solid',
  borderRadius: '6px',
  opacity: 0.75,
  _hover: { opacity: 1 },
  '& svg': { w: '16px', h: '16px' },
})
const ORDER = Object.keys(THEMES)
// sun for light, moon for dark, half-filled moon for dimmed
const ICONS = {
  'github-light': () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  ),
  'github-dark': () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  ),
  'github-dark-dimmed': () => (
    <svg viewBox="0 0 24 24" fill="currentColor" fill-opacity="0.45" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  ),
}
// table of contents beside the preview; on phones it overlays the text
const tocPanel = css({
  w: '260px',
  flex: 'none',
  overflow: 'auto',
  bg: 'ui.panel',
  borderLeft: '1px solid token(colors.ui.border)',
  py: '8px',
  mdDown: { position: 'absolute', top: 0, right: 0, bottom: 0, w: '80%', zIndex: 5, boxShadow: '-8px 0 24px rgba(0, 0, 0, 0.5)' },
})
const tocItem = cva({
  base: { display: 'block', w: '100%', py: '3px', pr: '10px', textAlign: 'left', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', _hover: { bg: 'ui.hover' }, mdDown: { py: '7px', fontSize: '14px' } },
  variants: { active: { true: { color: 'ui.link', bg: 'ui.selected', _hover: { bg: 'ui.selected' } } } },
})

// MarkdownPreview renders a repo markdown file (at props.rev) with diagrams, repo-relative links
// and images, and an optional TOC panel with scrollspy. Headings are reported via onHeadings.
export default function MarkdownPreview(props) {
  createEffect(() => {
    const t = props.theme // read before the await, so the effect re-runs when the theme changes
    import('../lib/markdown/themes.js').then((m) => m.applyTheme(t))
  })
  const next = () => ORDER[(ORDER.indexOf(props.theme) + 1) % ORDER.length]

  // theme is in the key so diagrams re-render in matching colors
  // a refresh (window focus) with unchanged text returns the same object, so the HTML and
  // diagrams aren't rebuilt
  let last
  const [md] = createResource(
    () => [props.repo, props.path, props.tick, props.theme, props.rev],
    async ([repo, path, , t, rev]) => {
      const src = await text('file', { repo, path, rev })
      const id = JSON.stringify([repo, path, t, rev])
      if (last?.id === id && last.src === src) return last.result
      last = { id, src, result: { repo, path, dark: THEMES[t].dark, html: await renderMarkdown(src, THEMES[t].code) } }
      return last.result
    },
  )
  let mdEl, scrollEl
  const [headings, setHeadings] = createSignal([])
  const [activeId, setActiveId] = createSignal('')
  const jump = (id) => {
    mdEl.querySelector(`[id="${CSS.escape(id)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    if (matchMedia('(width < 48rem)').matches) props.onCloseToc() // the overlay covers the text on phones
  }
  // scrollspy: the active heading is the last one above the top of the preview
  let frame
  const spy = () => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      const top = scrollEl.getBoundingClientRect().top + 80
      let id = headings()[0]?.id || ''
      for (const h of headings()) {
        const el = mdEl.querySelector(`[id="${CSS.escape(h.id)}"]`)
        if (el && el.getBoundingClientRect().top <= top) id = h.id
        else if (el) break
      }
      // at the very bottom the last headings can never reach the top: pick the last one
      if (scrollEl.scrollTop > 0 && scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 2) id = headings().at(-1)?.id || id
      setActiveId(id)
    })
  }
  onCleanup(() => cancelAnimationFrame(frame))

  createEffect(() => {
    const r = md.latest
    if (!r || !mdEl) return
    const { repo, path: from } = r
    mdEl.innerHTML = r.html // set here (not via JSX) so links/images below always start from fresh DOM
    for (const img of mdEl.querySelectorAll('img[src]')) {
      const p = resolvePath(from, img.getAttribute('src'))
      if (p) img.src = `/api/raw?${new URLSearchParams({ repo, path: p })}`
    }
    // in-page links ([TOC], footnotes) scroll here; letting the browser change the hash would add a
    // history entry, and going back over it would close the file on phones
    for (const a of mdEl.querySelectorAll('a[href^="#"]')) {
      a.onclick = (e) => {
        e.preventDefault()
        mdEl.querySelector(`[id="${CSS.escape(decodeURIComponent(a.getAttribute('href').slice(1)))}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
    for (const a of mdEl.querySelectorAll('a[href]:not([href^="#"])')) {
      const p = resolvePath(from, a.getAttribute('href'))
      if (p) {
        a.onclick = (e) => {
          e.preventDefault()
          props.onOpen(p)
        }
      } else {
        a.target = '_blank'
        a.rel = 'noopener noreferrer'
      }
    }
    const list = [...mdEl.querySelectorAll('h1[id], h2[id], h3[id], h4[id]')].map((h) => ({ id: h.id, text: h.textContent, level: +h.tagName[1] }))
    setHeadings(list)
    props.onHeadings?.(list)
    spy()
    renderDiagrams(mdEl, r.dark)
  })

  return (
    <Show when={!md.error} fallback={<div class={errorBox}>{md.error?.message}</div>}>
      <div class={wrap}>
        <div class={pane}>
          <div class={scroller} ref={scrollEl} style={{ background: THEMES[props.theme].bg }} onScroll={spy}>
            <article class="markdown-body" ref={mdEl} />
          </div>
          <button
            class={themeBtn}
            style={{ background: THEMES[props.theme].bg, color: THEMES[props.theme].fg, 'border-color': THEMES[props.theme].border }}
            title={`Theme: ${THEMES[props.theme].label} (click for ${THEMES[next()].label})`}
            aria-label={`Preview theme: ${THEMES[props.theme].label}. Switch to ${THEMES[next()].label}`}
            onClick={() => props.onTheme(next())}
          >
            {ICONS[props.theme]()}
          </button>
        </div>
        <Show when={props.showToc && headings().length}>
          <nav id="md-toc" class={tocPanel} aria-label="Table of contents">
            <For each={headings()}>
              {(h) => (
                <button
                  class={tocItem({ active: activeId() === h.id })}
                  style={{ 'padding-left': `${(h.level - 1) * 12 + 14}px` }}
                  aria-current={activeId() === h.id ? 'location' : undefined}
                  title={h.text}
                  onClick={() => jump(h.id)}
                >
                  {h.text}
                </button>
              )}
            </For>
          </nav>
        </Show>
      </div>
    </Show>
  )
}
