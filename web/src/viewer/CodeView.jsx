import { createMemo, For, Show } from 'solid-js'
import { css, cva } from 'styled-system/css'

const CHUNK = 200 // rows per block; off-screen blocks are skipped by content-visibility

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
      hunk: { color: 'ui.link', bg: 'ui.hunk', pl: 'calc(var(--ln-cols) * 50px + 16px)', mdDown: { pl: 'calc(var(--ln-cols) * 34px + 12px)' }, '& > :not(:last-child)': { display: 'none' } },
    },
  },
})
// one class string per row type, computed once instead of per rendered line
const LINE = { ctx: line({ t: 'ctx' }), add: line({ t: 'add' }), del: line({ t: 'del' }), hunk: line({ t: 'hunk' }) }

const chunks = (rows) => {
  const out = []
  for (let i = 0; i < rows.length; i += CHUNK) out.push(rows.slice(i, i + CHUNK))
  return out
}

// CodeView renders file or diff rows ({ t, o, n, text, html }) with line numbers.
export default function CodeView(props) {
  // a line-number column shows only if some row uses it: whole files and added files have
  // no old numbers, deleted files no new ones
  const showOld = createMemo(() => props.rows.some((r) => r.o != null))
  const showNew = createMemo(() => props.rows.some((r) => r.n != null))
  return (
    <div class={code} style={{ '--ln-cols': (showOld() ? 1 : 0) + (showNew() ? 1 : 0) }}>
      <For each={chunks(props.rows)}>
        {(chunk) => (
          <div class={chunkCls} style={{ 'contain-intrinsic-size': `auto ${chunk.length * 20}px` }}>
            <For each={chunk}>
              {(r) => (
                <div class={LINE[r.t]}>
                  <Show when={showOld()}>
                    <span class={ln}>{r.o}</span>
                  </Show>
                  <Show when={showNew()}>
                    <span class={ln}>{r.n}</span>
                  </Show>
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
