import { createEffect, createMemo, createResource, createSignal, For, on, onCleanup, Show } from 'solid-js'
import { createStore } from 'solid-js/store'
import { css, cva } from 'styled-system/css'
import { json } from '../lib/api/client.js'
import FileIcon from './ui/FileIcon.jsx'
import { error, muted, row } from './ui/styles.js'

const box = css({ display: 'flex', alignItems: 'center', m: '8px 10px 4px', bg: 'ui.input', border: '1px solid token(colors.ui.borderStrong)', borderRadius: '2px', _focusWithin: { borderColor: 'ui.accent' } })
const input = css({ flex: 1, minW: 0, px: '6px', py: '4px', bg: 'transparent', color: 'ui.fg', border: 0, outline: 'none', mdDown: { fontSize: '16px' } }) // < 16px makes iOS zoom on focus
const toggle = cva({
  base: { w: '22px', h: '20px', mr: '2px', borderRadius: '3px', fontSize: '11px', fontFamily: 'code', color: 'ui.muted', border: '1px solid transparent', _hover: { bg: 'ui.hover' } },
  variants: { on: { true: { color: '#fff', bg: 'rgba(0, 120, 212, 0.35)', borderColor: 'ui.accent' } } },
})
const count = css({ flex: 'none', bg: '#4d4d4d', borderRadius: '8px', px: '6px', fontSize: '11px' })
const summary = css({ px: '10px', py: '4px', color: 'ui.muted', fontSize: '12px' })
const chev = css({ w: '10px', color: '#999', flex: 'none' })
const fileName = css({ flex: 'none', overflow: 'hidden', textOverflow: 'ellipsis' })
const dir = css({ flex: 1, minW: 0 })
const lineText = css({ flex: 1, minW: 0, overflow: 'hidden', textOverflow: 'ellipsis', '& mark': { bg: 'rgba(234, 92, 0, 0.33)', color: 'inherit', borderRadius: '2px' } })

// matcher rebuilds git grep's match in JS to mark it in each line (ERE and JS regex agree on common patterns)
function matcher(o) {
  try {
    const src = o.regex ? o.q : o.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(o.word ? `\\b(?:${src})\\b` : src, o.case ? 'g' : 'gi')
  } catch {
    return null
  }
}

// marked splits text into plain and <mark> parts. Like VS Code, leading indentation is dropped and
// a long line starts shortly before its first match, so the match stays visible in the narrow list.
function marked(text, re) {
  let t = text.trimStart()
  if (!re) return t
  const first = t.search(re)
  if (first > 24) t = '…' + t.slice(first - 16)
  const parts = []
  let last = 0
  for (const m of t.matchAll(re)) {
    if (!m[0]) break // an empty match (e.g. "a*") would loop forever
    parts.push(t.slice(last, m.index), <mark>{m[0]}</mark>)
    last = m.index + m[0].length
  }
  parts.push(t.slice(last))
  return parts
}

// SearchPanel is the Search tab: text search over the repo's files (its submodules too, unless a
// branch is viewed), results grouped by file; a line opens the file there. The query lives in App
// (props.search / onSearch), so it survives switching tabs and repos.
export default function SearchPanel(props) {
  const o = () => props.search
  const set = (patch) => props.onSearch({ ...o(), ...patch })
  // wait for a pause in typing before running git grep
  const [ask, setAsk] = createSignal(o())
  createEffect(
    on(o, (v) => {
      const t = setTimeout(() => setAsk(v), 250)
      onCleanup(() => clearTimeout(t))
    }),
  )
  const [res] = createResource(
    () => props.repo && ask().q.trim() && [props.repo, props.gitRef, props.tick, ask()],
    ([repo, ref, , a]) => json('search', { repo, q: a.q, case: a.case ? 1 : 0, word: a.word ? 1 : 0, regex: a.regex ? 1 : 0, ...(ref && { ref }) }),
  )
  const re = createMemo(() => matcher(ask()))
  const files = () => (res.error || !ask().q.trim() ? [] : res.latest?.files || [])
  const total = createMemo(() => files().reduce((n, f) => n + f.lines.length, 0))
  const [closed, setClosed] = createStore({}) // collapsed files, by path

  const Toggle = (p) => (
    <button class={toggle({ on: !!o()[p.k] })} title={p.title} aria-label={p.title} aria-pressed={!!o()[p.k]} onClick={() => set({ [p.k]: !o()[p.k] })}>
      {p.children}
    </button>
  )

  return (
    <>
      <div class={box}>
        <input class={input} placeholder="Search" aria-label="Search text" value={o().q} onInput={(e) => set({ q: e.target.value })} ref={(el) => queueMicrotask(() => el.focus())} />
        <Toggle k="case" title="Match Case">
          Aa
        </Toggle>
        <Toggle k="word" title="Match Whole Word">
          ab
        </Toggle>
        <Toggle k="regex" title="Use Regular Expression">
          .*
        </Toggle>
      </div>
      <Show when={res.error}>
        <div class={error}>{res.error.message}</div>
      </Show>
      <Show when={ask().q.trim() && res.latest && !res.error}>
        <div class={summary}>
          {total() ? `${total()} result${total() > 1 ? 's' : ''} in ${files().length} file${files().length > 1 ? 's' : ''}` : 'No results'}
          {res.latest.truncated ? ' (showing the first ones; refine the search)' : ''}
          {res.loading ? ' …' : ''}
        </div>
      </Show>
      <For each={files()}>
        {(f) => {
          const cut = f.path.lastIndexOf('/')
          return (
            <>
              <button class={row()} title={f.path} onClick={() => setClosed(f.path, !closed[f.path])}>
                <span class={chev}>{closed[f.path] ? '▸' : '▾'}</span>
                <FileIcon path={f.path} />
                <span class={fileName}>{f.path.slice(cut + 1)}</span>
                <span class={`${muted} ${dir}`}>{cut > 0 ? f.path.slice(0, cut) : ''}</span>
                <span class={count}>{f.lines.length}</span>
              </button>
              <Show when={!closed[f.path]}>
                <For each={f.lines}>
                  {(l) => (
                    <button
                      class={row({ selected: props.selected?.key === 'f:' + f.path && props.selected?.line === l.n })}
                      style={{ 'padding-left': '38px' }}
                      title={`${f.path}:${l.n}`}
                      onClick={() => props.onOpen({ kind: 'file', path: f.path, key: 'f:' + f.path, line: l.n })}
                    >
                      <span class={lineText}>{marked(l.text, re())}</span>
                    </button>
                  )}
                </For>
              </Show>
            </>
          )
        }}
      </For>
    </>
  )
}
