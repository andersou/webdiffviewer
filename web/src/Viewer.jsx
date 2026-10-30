import { createEffect, createResource, createSignal, For, Show } from 'solid-js'
import { css, cva } from '../styled-system/css'
import { text } from './api'
import { highlight } from './highlight'
import { resolvePath } from './links'
import { renderDiagrams, renderMarkdown } from './markdown'
import 'highlight.js/styles/tokyo-night-dark.css'
import './markdown.css'
import { empty, muted } from './ui'

// preview themes; CSS lives in themes.js and loads with the first preview
const THEMES = {
  'github-light': { label: 'GitHub Light', bg: '#ffffff', dark: false },
  'github-dark': { label: 'GitHub Dark', bg: '#0d1117', dark: true },
  'github-dark-dimmed': { label: 'GitHub Dark Dimmed', bg: '#212830', dark: true },
}

const code = css({ flex: 1, overflow: 'auto', fontFamily: 'code', fontSize: '12px', lineHeight: '20px' })
const chunkCls = css({ contentVisibility: 'auto', minW: 'max-content' })
const ln = css({ w: '50px', flex: 'none', textAlign: 'right', pr: '8px', color: 'ui.faint', userSelect: 'none', mdDown: { w: '34px', pr: '4px' } })
const txt = css({ px: '12px' })
const line = cva({
  base: { display: 'flex', h: '20px', whiteSpace: 'pre' },
  variants: {
    t: {
      ctx: {},
      add: { bg: 'ui.add', '& > :last-child::before': { content: '"+"', ml: '-10px', position: 'absolute' } },
      del: { bg: 'ui.del', '& > :last-child::before': { content: '"-"', ml: '-10px', position: 'absolute' } },
      hunk: { color: 'ui.link', bg: 'ui.hunk', pl: '116px', mdDown: { pl: '80px' }, '& > :not(:last-child)': { display: 'none' } },
    },
  },
})
// one class string per row type, computed once instead of per rendered line
const LINE = { ctx: line({ t: 'ctx' }), add: line({ t: 'add' }), del: line({ t: 'del' }), hunk: line({ t: 'hunk' }) }

const head = css({
  px: '14px',
  py: '8px',
  borderBottom: '1px solid token(colors.ui.border)',
  bg: 'ui.panel',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  mdDown: { position: 'sticky', top: 0 },
})
const back = css({ display: 'none', pr: '10px', fontSize: '16px', mdDown: { display: 'inline' } })
const seg = css({ float: 'right', ml: '10px', display: 'inline-flex', border: '1px solid token(colors.ui.borderStrong)', borderRadius: '3px', overflow: 'hidden' })
const segBtn = cva({
  base: { px: '10px', py: '1px', _hover: { bg: '#333' }, '&:not(:first-child)': { borderLeft: '1px solid token(colors.ui.borderStrong)' } },
  variants: { active: { true: { bg: 'ui.accent', color: '#fff', _hover: { bg: 'ui.accent' } } } },
})
const LABELS = { diff: 'Diff', file: 'File', preview: 'Preview' }

// version shown by File/Preview: the index for staged changes, HEAD for a branch comparison
// without the working tree, otherwise the file on disk
const rev = (s) => (s.kind !== 'diff' ? '' : s.staged ? ':' : s.base && !s.wt ? 'HEAD' : '')
const themeSel = css({ float: 'right', ml: '10px', px: '4px', py: '1px', bg: 'ui.input', color: 'ui.fg', border: '1px solid token(colors.ui.borderStrong)', borderRadius: '3px' })
const errBox = css({ m: 'auto', p: '20px', color: 'ui.error', whiteSpace: 'pre-wrap' })
const mdScroll = css({ flex: 1, overflow: 'auto' })

const CHUNK = 200 // rows per block; off-screen blocks are skipped by content-visibility

function parseDiff(src) {
  const rows = []
  let o = 0, n = 0
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

const chunks = (rows) => {
  const out = []
  for (let i = 0; i < rows.length; i += CHUNK) out.push(rows.slice(i, i + CHUNK))
  return out
}

function Rows(props) {
  return (
    <div class={code}>
      <For each={chunks(props.rows)}>
        {(chunk) => (
          <div class={chunkCls} style={{ 'contain-intrinsic-size': `auto ${chunk.length * 20}px` }}>
            <For each={chunk}>
              {(r) => (
                <div class={LINE[r.t]}>
                  <span class={ln}>{r.o}</span>
                  <span class={ln}>{r.n}</span>
                  {r.html != null ? <span class={txt} innerHTML={r.html} /> : <span class={txt}>{r.text}</span>}
                </div>
              )}
            </For>
          </div>
        )}
      </For>
    </div>
  )
}

export default function Viewer(props) {
  const isMd = () => /\.(md|markdown|mdx)$/i.test(props.sel?.path || '')
  // what a selection can show: changes also offer the whole file; markdown adds a rendered preview
  const views = () => [...(props.sel?.kind === 'diff' ? ['diff'] : []), 'file', ...(isMd() ? ['preview'] : [])]
  // last choice per kind; markdown opens as preview from the Explorer and as diff from Changes
  const [pref, setPref] = createSignal({ file: 'preview', diff: 'diff' })
  const view = () => {
    const v = views()
    const p = pref()[props.sel?.kind]
    return v.includes(p) ? p : v[0]
  }
  const preview = () => !!props.sel && view() === 'preview'

  const stored = localStorage.getItem('mdTheme')
  const [theme, setTheme] = createSignal(THEMES[stored] ? stored : 'github-light')
  const meta = () => THEMES[theme()]
  createEffect(() => {
    localStorage.setItem('mdTheme', theme())
    if (preview()) import('./themes').then((m) => m.applyTheme(theme()))
  })

  // theme is in the key so diagrams re-render in matching colors
  const [md] = createResource(
    () => preview() && [props.repo, props.sel.path, props.tick, theme(), rev(props.sel)],
    async ([repo, path, , t, r]) => ({ repo, path, dark: THEMES[t].dark, html: await renderMarkdown(await text('file', { repo, path, rev: r })) }),
  )
  let mdEl
  createEffect(() => {
    const r = md.latest
    if (!r || !mdEl) return
    const { repo, path: from } = r
    mdEl.innerHTML = r.html // set here (not via JSX) so links/images below always start from fresh DOM
    for (const img of mdEl.querySelectorAll('img[src]')) {
      const p = resolvePath(from, img.getAttribute('src'))
      if (p) img.src = `/api/raw?${new URLSearchParams({ repo, path: p })}`
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
    renderDiagrams(mdEl, r.dark)
  })

  const [data] = createResource(
    () => props.sel && !preview() && [props.repo, props.sel, props.tick, view()],
    async ([repo, s, , v]) => {
      if (v === 'file') {
        const src = await text('file', { repo, path: s.path, rev: rev(s) })
        const rows = src.split('\n').map((t, i) => ({ t: 'ctx', n: i + 1, text: t }))
        await highlight(s.path, rows)
        return rows
      }
      const src = await text('diff', { repo, path: s.path, orig: s.orig || '', base: s.base || '', wt: s.wt ? 1 : 0, staged: s.staged ? 1 : 0, untracked: s.untracked ? 1 : 0 })
      const rows = parseDiff(src)
      // highlight each side as continuous code; context lines end up with the new side's tokens
      await highlight(s.path, rows.filter((r) => r.t === 'del' || r.t === 'ctx'))
      await highlight(s.path, rows.filter((r) => r.t === 'add' || r.t === 'ctx'))
      return rows.length ? rows : [{ t: 'hunk', text: src.trim() || 'No changes' }] // binary/mode-only diffs
    },
  )

  return (
    <Show when={props.sel} fallback={<div class={empty}>Select a file or a change</div>}>
      <div class={head}>
        <button class={back} onClick={props.onBack} aria-label="Back to list">←</button>
        <Show when={views().length > 1}>
          <span class={seg} role="group" aria-label="View">
            <For each={views()}>
              {(v) => (
                <button class={segBtn({ active: view() === v })} aria-pressed={view() === v} onClick={() => setPref((p) => ({ ...p, [props.sel.kind]: v }))}>
                  {LABELS[v]}
                </button>
              )}
            </For>
          </span>
        </Show>
        <Show when={preview()}>
          <select class={themeSel} aria-label="Preview theme" value={theme()} onChange={(e) => setTheme(e.target.value)}>
            <For each={Object.entries(THEMES)}>{([k, t]) => <option value={k}>{t.label}</option>}</For>
          </select>
        </Show>
        <span>{props.sel.path}</span>
        <Show when={props.sel.orig}>
          <span class={muted}> ← {props.sel.orig}</span>
        </Show>
        <span class={muted}>{props.sel.kind === 'file' ? '' : props.sel.base ? ` (vs ${props.sel.base})` : props.sel.staged ? ' (staged)' : props.sel.untracked ? ' (untracked)' : ' (working tree)'}</span>
      </div>
      <Show
        when={!preview()}
        fallback={
          <Show when={!md.error} fallback={<div class={errBox}>{md.error?.message}</div>}>
            <div class={mdScroll} style={{ background: meta().bg }}>
              <article class="markdown-body" ref={mdEl} />
            </div>
          </Show>
        }
      >
        <Show when={!data.error} fallback={<div class={errBox}>{data.error?.message}</div>}>
          <Show when={data.latest}>{(rows) => <Rows rows={rows()} />}</Show>
        </Show>
      </Show>
    </Show>
  )
}
