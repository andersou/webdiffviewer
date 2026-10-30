import { createMemo, createResource, createSignal, For, Show } from 'solid-js'
import { css, cva } from '../styled-system/css'
import { json } from './api'
import { graph } from './graph'
import Tree from './Tree'
import { error, muted, name } from './ui'

// px; taller rows on phones for touch. Read once: the SVG is drawn at this exact height (no stretching).
const ROW = matchMedia('(width < 48rem)').matches ? 34 : 26
const LANE = 12 // px between lanes
const PAD = 6 // px left of the first lane, so its dot isn't clipped
const MAX_LANES = 6 // wider graphs are clipped so the sidebar keeps room for the message
const COLORS = ['#4fc1ff', '#c586c0', '#dcdcaa', '#4ec9b0', '#ce9178', '#9cdcfe', '#d16969', '#b5cea8']
const color = (lane) => COLORS[lane % COLORS.length]

const toolbar = css({ display: 'flex', alignItems: 'center', gap: '6px', px: '10px', py: '6px', fontSize: '12px', color: 'ui.muted', cursor: 'pointer' })
const commitRow = cva({
  base: { display: 'flex', alignItems: 'center', w: '100%', pr: '10px', textAlign: 'left', whiteSpace: 'nowrap', _hover: { bg: 'ui.hover' } },
  variants: { open: { true: { bg: 'ui.selected', _hover: { bg: 'ui.selected' } } } },
})
const svgCls = css({ flex: 'none', display: 'block' })
const refCls = cva({
  base: { flex: 'none', fontSize: '10px', lineHeight: '15px', px: '5px', mr: '5px', borderRadius: '3px', border: '1px solid', maxW: '90px', overflow: 'hidden', textOverflow: 'ellipsis' },
  variants: {
    kind: {
      head: { color: '#fff', bg: 'ui.accent', borderColor: 'ui.accent' },
      tag: { color: 'status.modified', borderColor: 'status.modified' },
      branch: { color: 'ui.link', borderColor: 'ui.link' },
    },
  },
})
const details = css({ borderTop: '1px solid token(colors.ui.border)', borderBottom: '1px solid token(colors.ui.border)', bg: 'ui.raised', pb: '6px' })
const message = css({ px: '12px', py: '8px', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: '12px', lineHeight: '1.5' })
const meta = css({ px: '12px', pb: '6px', fontSize: '11px', color: 'ui.muted', display: 'flex', flexWrap: 'wrap', gap: '4px 10px' })
const moreBtn = css({ w: '100%', py: '8px', color: 'ui.link', _hover: { bg: 'ui.hover' } })

// compact age for the narrow sidebar ("31m", "2h", "6d"); the full date is in the row's title
function ago(seconds) {
  const s = Math.max(0, Date.now() / 1000 - seconds)
  for (const [unit, n] of [['y', 31536000], ['mo', 2592000], ['w', 604800], ['d', 86400], ['h', 3600], ['m', 60]]) {
    if (s >= n) return Math.floor(s / n) + unit
  }
  return 'now'
}

// "HEAD -> main", "origin/main", "tag: v1" from git's %D
const refKind = (r) => (r.startsWith('HEAD') ? 'head' : r.startsWith('tag: ') ? 'tag' : 'branch')
const refLabel = (r) => r.replace(/^HEAD -> /, '').replace(/^tag: /, '')

function Graph(props) {
  const x = (lane) => PAD + lane * LANE + LANE / 2
  const path = ([x1, y1, x2, y2]) => {
    const [ax, ay, bx, by] = [x(x1), y1 * ROW, x(x2), y2 * ROW]
    // forks/merges bend in the half-row they cross; straight lanes are plain lines
    return ax === bx ? `M${ax} ${ay}V${by}` : `M${ax} ${ay}C${ax} ${(ay + by) / 2} ${bx} ${(ay + by) / 2} ${bx} ${by}`
  }
  return (
    <svg class={svgCls} width={PAD + props.width * LANE + 4} height={ROW} aria-hidden="true">
      <For each={props.row.segs}>{(s) => <path d={path(s)} stroke={color(s[4])} stroke-width="2" fill="none" />}</For>
      <circle cx={x(props.row.col)} cy={ROW / 2} r={props.merge ? 3 : 4} fill={props.merge ? '#1e1e1e' : color(props.row.col)} stroke={color(props.row.col)} stroke-width="2" />
    </svg>
  )
}

// Commits lists history with a lane graph; opening a commit shows its message and changed files.
export default function Commits(props) {
  const [all, setAll] = createSignal(localStorage.getItem('commitsAll') === '1')
  const [openHash, setOpenHash] = createSignal()
  const [extra, setExtra] = createSignal([]) // pages loaded with "Load more"
  const [loadingMore, setLoadingMore] = createSignal(false)
  const [done, setDone] = createSignal(false)
  const [first] = createResource(
    () => props.repo && [props.repo, props.tick, all()],
    ([repo, , a]) => {
      setExtra([])
      return json('log', { repo, all: a ? 1 : 0 }).then((list) => (setDone(list.length < 300), list))
    },
  )
  const commits = createMemo(() => [...(first.latest || []), ...extra()])
  const rows = createMemo(() => graph(commits()))
  const width = createMemo(() => Math.min(MAX_LANES, Math.max(1, ...rows().map((r) => r.width))))

  const more = async () => {
    setLoadingMore(true)
    const page = await json('log', { repo: props.repo, all: all() ? 1 : 0, skip: commits().length }).finally(() => setLoadingMore(false))
    setExtra((e) => [...e, ...page])
    setDone(page.length < 300)
  }
  const toggleAll = (on) => {
    localStorage.setItem('commitsAll', on ? '1' : '0')
    setAll(on)
  }

  const [detail] = createResource(
    () => openHash() && [props.repo, openHash()],
    ([repo, hash]) => json('commit', { repo, hash }),
  )
  const fileItems = createMemo(() =>
    (detail.latest?.files || []).map((f) => ({ ...f, key: `c:${openHash()}:${f.path}`, kind: 'diff', commit: openHash(), status: f.x })),
  )

  return (
    <>
      <label class={toolbar}>
        <input type="checkbox" checked={all()} onChange={(e) => toggleAll(e.target.checked)} />
        All branches
      </label>
      <For each={commits()}>
        {(c, i) => (
          <>
            <button
              class={commitRow({ open: openHash() === c.hash })}
              style={{ height: `${ROW}px` }}
              aria-expanded={openHash() === c.hash}
              title={`${c.hash.slice(0, 10)} · ${c.author} · ${new Date(c.time * 1000).toLocaleString()}${c.refs.length ? ' · ' + c.refs.join(', ') : ''}`}
              onClick={() => setOpenHash(openHash() === c.hash ? undefined : c.hash)}
            >
              <Graph row={rows()[i()]} width={width()} merge={c.parents.length > 1} />
              <For each={c.refs.slice(0, 2)}>{(r) => <span class={refCls({ kind: refKind(r) })}>{refLabel(r)}</span>}</For>
              <Show when={c.refs.length > 2}>
                <span class={refCls({ kind: 'branch' })}>+{c.refs.length - 2}</span>
              </Show>
              <span class={name}>{c.subject}</span>
              <span class={muted} style={{ 'padding-left': '6px' }}>{ago(c.time)}</span>
            </button>
            <Show when={openHash() === c.hash}>
              <div class={details}>
                <Show when={detail.latest?.commit.hash === c.hash} fallback={<div class={meta}>Loading…</div>}>
                  <div class={message}>
                    <strong>{detail.latest.commit.subject}</strong>
                    <Show when={detail.latest.commit.body}>{'\n\n' + detail.latest.commit.body}</Show>
                  </div>
                  <div class={meta}>
                    <span>{detail.latest.commit.author} &lt;{detail.latest.commit.email}&gt;</span>
                    <span>{new Date(detail.latest.commit.time * 1000).toLocaleString()}</span>
                    <span>{c.hash.slice(0, 10)}</span>
                    <Show when={c.parents.length > 1}>
                      <span>merge · changes vs first parent</span>
                    </Show>
                  </div>
                  <Tree items={fileItems()} defaultOpen selected={props.selected} onSelect={props.onSelect} badge={(f) => f.status} />
                </Show>
                <Show when={detail.error}>
                  <div class={error}>{detail.error.message}</div>
                </Show>
              </div>
            </Show>
          </>
        )}
      </For>
      <Show when={first.error}>
        <div class={error}>{first.error.message}</div>
      </Show>
      <Show when={commits().length && !done()}>
        <button class={moreBtn} disabled={loadingMore()} onClick={more}>
          {loadingMore() ? 'Loading…' : 'Load more'}
        </button>
      </Show>
    </>
  )
}
