import { createEffect, createMemo, createSelector, createSignal, For, on, Show } from 'solid-js'
import { ago } from '../lib/utils/time.js'
import { css, cva } from 'styled-system/css'

const CHUNK = 200 // rows per block; off-screen blocks are skipped by content-visibility

// .hl: the line opened from Search, in blue so it can't be read as an added (green) or removed (red) line
const code = css({ flex: 1, overflow: 'auto', fontFamily: 'code', fontSize: '12px', lineHeight: '20px', '& .hl': { bg: 'rgba(0, 127, 212, 0.32)', boxShadow: 'inset 3px 0 token(colors.ui.accent)' } })
const picked = css({ bg: 'rgba(255, 255, 255, 0.06)' })
// the clicked line's blame, after its text like VS Code's inline blame
const inline = css({ ml: '28px', color: 'ui.muted', fontFamily: 'ui', fontSize: '11px', fontStyle: 'italic', cursor: 'pointer', userSelect: 'none', _hover: { color: 'ui.fg', textDecoration: 'underline' } })
const chunkCls = css({ contentVisibility: 'auto', minW: 'max-content' })
const ln = css({ w: '50px', flex: 'none', textAlign: 'right', pr: '8px', color: 'ui.faint', userSelect: 'none', mdDown: { w: '34px', pr: '4px' } })
const txt = css({ px: '12px' })
// blame column: who and when changed the line, on the first line of each run from one commit
const gut = css({
  w: '300px',
  flex: 'none',
  display: 'flex',
  gap: '8px',
  px: '8px',
  color: 'ui.muted',
  borderRight: '1px solid token(colors.ui.border)',
  overflow: 'hidden',
  fontFamily: 'ui',
  fontSize: '11px',
  userSelect: 'none',
  cursor: 'pointer',
  _hover: { color: 'ui.fg' },
  mdDown: { w: '150px' },
  '& b': { fontWeight: 'normal', flex: 'none', w: '28px', textAlign: 'right' },
  '& i': { fontStyle: 'normal', flex: 'none', maxW: '90px', overflow: 'hidden', textOverflow: 'ellipsis' },
  '& span': { overflow: 'hidden', textOverflow: 'ellipsis' },
})
const line = cva({
  base: { display: 'flex', h: '20px', whiteSpace: 'pre' },
  variants: {
    t: {
      ctx: {},
      // [data-text]: the line's text, which an inline blame may follow
      add: { bg: 'ui.add', '& > [data-text]::before': { content: '"+"', ml: '-10px', position: 'absolute' } },
      del: { bg: 'ui.del', '& > [data-text]::before': { content: '"-"', ml: '-10px', position: 'absolute' } },
      hunk: { color: 'ui.link', bg: 'ui.hunk', pl: 'calc(var(--ln-cols) * 50px + 16px)', mdDown: { pl: 'calc(var(--ln-cols) * 34px + 12px)' }, '& > :not([data-text])': { display: 'none' } },
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

const start = css({ boxShadow: 'inset 0 1px token(colors.ui.border)' }) // a faint line where each run begins

// Blame is a line's blame cell: age, author and summary on a run's first line (title: the details);
// a click opens what that commit changed in the file. Uncommitted lines say so and do nothing.
function Blame(p) {
  if (!p.first) return <span class={gut} style={{ cursor: 'default' }} />
  if (!p.sha) return <span class={`${gut} ${start}`} style={{ cursor: 'default' }}>Not committed yet</span>
  const date = new Date(p.c.time * 1000).toLocaleString()
  return (
    <span class={`${gut} ${start}`} title={`${p.sha.slice(0, 10)} · ${p.c.author} · ${date}\n${p.c.summary}`} onClick={() => p.onCommit?.(p.sha, p.c.path)}>
      <b>{ago(p.c.time)}</b>
      <i>{p.c.author}</i>
      <span>{p.c.summary}</span>
    </span>
  )
}

// LineBlame is the inline blame of line n (new side): author, age and summary; a click opens the commit
function LineBlame(p) {
  const sha = () => p.blame.lines[p.n - 1]?.c
  const c = () => p.blame.commits[sha()]
  return (
    <Show when={p.blame.lines[p.n - 1]}>
      <Show when={c()} fallback={<span class={inline}>Not committed yet</span>}>
        <span class={inline} title={`${sha().slice(0, 10)} · ${new Date(c().time * 1000).toLocaleString()}`} onClick={() => p.onCommit?.(sha(), c().path)}>
          {c().author}, {ago(c().time)} ago • {c().summary}
        </span>
      </Show>
    </Show>
  )
}

// CodeView renders file or diff rows ({ t, o, n, text, html }) with line numbers. With line (a
// line number on the new side), that row is marked and scrolled into view when it is shown.
export default function CodeView(props) {
  let el
  // the clicked line (with the Blame switch on); a selector so only the old and new rows re-render
  const [pick, setPick] = createSignal()
  const isPicked = createSelector(pick)
  createEffect(on(() => props.rows, () => setPick()))
  createEffect(() => {
    const rows = props.rows // re-run when another file's rows render
    const i = props.line ? rows.findIndex((r) => r.n === props.line && r.t !== 'del') : -1
    el.querySelector('.hl')?.classList.remove('hl')
    if (i < 0) return
    // rows sit in blocks of CHUNK; reaching the row directly avoids a reactive flag on every line
    const r = el.children[Math.floor(i / CHUNK)]?.children[i % CHUNK]
    r?.classList.add('hl')
    r?.scrollIntoView({ block: 'center' })
  })
  // a line-number column shows only if some row uses it: whole files and added files have
  // no old numbers, deleted files no new ones
  const showOld = createMemo(() => props.rows.some((r) => r.o != null))
  const showNew = createMemo(() => props.rows.some((r) => r.n != null))
  return (
    <div class={code} ref={el} style={{ '--ln-cols': (showOld() ? 1 : 0) + (showNew() ? 1 : 0) }}>
      <For each={chunks(props.rows)}>
        {(chunk) => (
          <div class={chunkCls} style={{ 'contain-intrinsic-size': `auto ${chunk.length * 20}px` }}>
            <For each={chunk}>
              {(r) => (
                <div class={LINE[r.t]} classList={{ [picked]: isPicked(r) }} onClick={() => props.lineBlame && r.n != null && r.t !== 'del' && setPick(r)}>
                  <Show when={props.rows.commits}>{(cs) => <Blame c={cs()[r.c]} sha={r.c} first={r.first} onCommit={props.onCommit} />}</Show>
                  <Show when={showOld()}>
                    <span class={ln}>{r.o}</span>
                  </Show>
                  <Show when={showNew()}>
                    <span class={ln}>{r.n}</span>
                  </Show>
                  {r.html != null ? <span class={txt} data-text innerHTML={r.html} /> : <span class={txt} data-text>{r.text}</span>}
                  <Show when={props.lineBlame && isPicked(r)}>
                    <LineBlame blame={props.lineBlame} n={r.n} onCommit={props.onCommit} />
                  </Show>
                </div>
              )}
            </For>
          </div>
        )}
      </For>
    </div>
  )
}
