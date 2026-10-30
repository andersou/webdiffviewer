import { createEffect, createMemo, createResource, createSignal, For, onCleanup, Show } from 'solid-js'
import { css, cva } from '../styled-system/css'
import { api, json } from './api'
import Commits from './Commits'
import Picker from './Picker'
import Tree from './Tree'
import { error, heading, muted, name, row, select } from './ui'
import Viewer from './Viewer'

const letter = (c) => (c === '?' ? 'U' : c)

// narrow screens show one pane at a time: the list, or (with .viewing on the root) the file
const app = css({ display: 'flex', h: '100%' })
const sidebar = css({
  w: '320px',
  minW: '200px',
  resize: 'horizontal',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  bg: 'ui.panel',
  borderRight: '1px solid token(colors.ui.border)',
  mdDown: { w: '100%', resize: 'none', borderRight: 0, '.viewing &': { display: 'none' } },
})
const main = css({ flex: 1, minW: 0, display: 'flex', flexDirection: 'column', mdDown: { display: 'none', '.viewing &': { display: 'flex' } } })
const rootBtn = css({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  w: '100%',
  px: '10px',
  py: '8px',
  borderBottom: '1px solid token(colors.ui.border)',
  bg: 'ui.raised',
  textAlign: 'left',
  fontWeight: 600,
  _hover: { bg: 'ui.raisedHover' },
})
const section = css({ borderBottom: '1px solid token(colors.ui.border)', pb: '4px', maxH: '35%', overflow: 'auto' })
// refresh: icon at the heading's text size; the clickable area stays larger (negative margins keep the row height)
const iconBtn = css({
  display: 'grid',
  placeItems: 'center',
  w: '20px',
  h: '20px',
  my: '-4px',
  mr: '-5px',
  borderRadius: '4px',
  color: 'ui.heading',
  '& svg': { w: '1.1em', h: '1.1em' },
  _hover: { bg: 'ui.hover', color: 'ui.fg' },
  mdDown: { w: '36px', h: '36px', my: '-12px', mr: '-12px' },
})
const branchBox = css({ px: '10px', py: '6px', '& label': { display: 'flex', my: '3px', gap: '8px', alignItems: 'center' } })
const grow = css({ flex: 1, mdDown: { fontSize: '16px' } }) // < 16px makes iOS zoom on focus
const cmp = css({ display: 'flex', gap: '10px', alignItems: 'center', '& > label:first-child': { flex: 1, minW: 0 } })
const wtLabel = css({ gap: '4px!', whiteSpace: 'nowrap', cursor: 'pointer' })
const switchCls = css({
  appearance: 'none',
  position: 'relative',
  w: '26px',
  h: '14px',
  m: 0,
  borderRadius: '7px',
  bg: 'ui.borderStrong',
  cursor: 'pointer',
  transition: 'background 0.15s',
  flex: 'none',
  _after: { content: '""', position: 'absolute', top: '2px', left: '2px', w: '10px', h: '10px', borderRadius: '50%', bg: '#ddd', transition: 'transform 0.15s' },
  _checked: { bg: 'ui.accent', _after: { transform: 'translateX(12px)', bg: '#fff' } },
  _focusVisible: { outline: '1px solid token(colors.ui.accent)', outlineOffset: '2px' },
})
const tabs = css({ display: 'flex', borderBottom: '1px solid token(colors.ui.border)' })
const tabBtn = cva({
  base: { flex: 1, p: '8px', borderBottom: '2px solid transparent' },
  variants: { active: { true: { borderColor: 'ui.accent', color: '#fff' } } },
})
const count = css({ bg: '#4d4d4d', borderRadius: '8px', px: '6px', fontSize: '11px' })
const treeBox = css({ flex: 1, overflow: 'auto', pb: '20px' })
// phones only: return to the open file from the list (same as swiping right-to-left)
const toFile = css({
  display: 'none',
  mdDown: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    w: '100%',
    px: '14px',
    py: '12px',
    borderTop: '1px solid token(colors.ui.border)',
    bg: 'ui.raised',
    textAlign: 'left',
  },
})

export default function App() {
  const [tick, setTick] = createSignal(0)
  const refresh = () => setTick((t) => t + 1)
  window.addEventListener('focus', refresh)
  onCleanup(() => window.removeEventListener('focus', refresh))

  // --parent-dir: the folder being browsed lives in ?root= so each tab can look at a different repo
  const [cfg] = createResource(() => json('config'))
  const [root, setRoot] = createSignal(new URLSearchParams(location.search).get('root') || '')
  const [picker, setPicker] = createSignal(false)
  const rootName = () => (root() || cfg()?.base || '').split(/[\\/]/).pop() // filesystem path: \ on Windows
  createEffect(() => (document.title = rootName() ? `${rootName()} · webdiffviewer` : 'webdiffviewer'))
  const onKey = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && cfg()?.parent) {
      e.preventDefault()
      setPicker(true)
    }
  }
  window.addEventListener('keydown', onKey)
  onCleanup(() => window.removeEventListener('keydown', onKey))

  const [repos] = createResource(
    () => [tick(), root()],
    ([, r]) => json('repos', r ? { root: r } : {}),
  )
  const [repo, setRepo] = createSignal()
  const [tab, setTab] = createSignal('changes')
  const [sel, setSel] = createSignal()
  // phones show one pane: the list, or the open file. "Back" only shows the list, so the file
  // stays open and a right-to-left swipe (or the button at the bottom) returns to it.
  const [showList, setShowList] = createSignal(true)
  const open = (item) => {
    setSel(item)
    setShowList(false)
  }
  let touch
  const onTouchStart = (e) => (touch = e.touches.length === 1 && { x: e.touches[0].clientX, y: e.touches[0].clientY })
  const onTouchEnd = (e) => {
    const t = e.changedTouches[0]
    // mostly horizontal, at least 60px, right-to-left
    if (touch && sel() && touch.x - t.clientX > 60 && Math.abs(t.clientY - touch.y) < 40) setShowList(false)
    touch = null
  }
  const [base, setBase] = createSignal('') // '' = working tree vs index/HEAD; else compare with this branch
  // in a branch comparison, also include uncommitted + untracked changes (default on, remembered)
  const [withWT, setWithWT] = createSignal(localStorage.getItem('compareWT') !== '0')
  const toggleWT = (on) => {
    localStorage.setItem('compareWT', on ? '1' : '0')
    setWithWT(on)
    setSel((s) => (s?.base ? { ...s, wt: on } : s)) // re-diff the open file in the new mode
  }
  // keep the selected repo valid: first repo on load, after opening another folder, or if it disappeared
  createEffect(() => {
    const list = repos.latest
    const known = list?.some((r) => r.path === repo() || r.worktrees.some((w) => w.path === repo()))
    if (list?.length && !known) pickRepo(list[0].path)
  })

  const openRoot = (path) => {
    const r = path === cfg()?.base ? '' : path
    history.replaceState(null, '', r ? `?root=${encodeURIComponent(r)}` : location.pathname)
    setRoot(r)
    setPicker(false)
  }

  const key = () => repo() && [repo(), tick()]
  const [branches] = createResource(key, ([r]) => json('branches', { repo: r }))
  const [files] = createResource(key, ([r]) => json('files', { repo: r }))
  const [status] = createResource(
    () => repo() && [repo(), tick(), base(), withWT()],
    ([r, , b, wt]) => json('status', b ? { repo: r, base: b, wt: wt ? 1 : 0 } : { repo: r }),
  )

  const fileItems = createMemo(() => (files.latest || []).map((path) => ({ path, key: 'f:' + path, kind: 'file' })))
  const changes = (staged) =>
    (status.latest || [])
      .filter((c) => (staged ? c.x !== ' ' && c.x !== '?' : c.y !== ' '))
      .map((c) => ({ ...c, key: (staged ? 's:' : 'w:') + c.path, kind: 'diff', staged, untracked: c.x === '?', status: letter(staged ? c.x : c.y) }))
  const stagedItems = createMemo(() => changes(true))
  const unstagedItems = createMemo(() => changes(false))
  const baseItems = createMemo(() =>
    (status.latest || []).map((c) => ({
      ...c,
      key: 'b:' + c.path,
      kind: 'diff',
      base: base(),
      wt: withWT(),
      untracked: c.x === '?',
      status: letter(c.x) + (c.dirty ? '•' : ''), // • = also has uncommitted changes
    })),
  )
  const statusByPath = createMemo(() => new Map((status.latest || []).map((c) => [c.path, letter(c.y !== ' ' ? c.y : c.x)])))

  const pickRepo = (path) => {
    setRepo(path)
    setSel()
    setBase('')
  }

  const checkout = async (e) => {
    const opt = e.target.selectedOptions[0]
    // remote "origin/feat" -> "feat": git switch creates the tracking branch
    const branch = opt.dataset.remote ? opt.value.slice(opt.value.indexOf('/') + 1) : opt.value
    try {
      await api('checkout', { repo: repo() }, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ branch }) })
    } catch (err) {
      alert(err.message)
    }
    refresh()
  }

  return (
    <div class={sel() && !showList() ? `${app} viewing` : app}>
      <aside class={sidebar} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <Show when={cfg()?.parent}>
          <button class={rootBtn} title="Open another repository (Ctrl/⌘+K)" onClick={() => setPicker(true)}>
            <span class={name}>📁 {rootName()}</span>
            <kbd>{/Mac|iP/.test(navigator.platform) ? '⌘K' : 'Ctrl+K'}</kbd>
          </button>
        </Show>
        <section class={section}>
          <h2 class={heading}>
            Repositories <button class={iconBtn} title="Refresh" aria-label="Refresh" onClick={refresh}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
            </button>
          </h2>
          <For each={repos.latest}>
            {(r) => (
              <>
                <button class={row({ selected: repo() === r.path })} title={r.path} onClick={() => pickRepo(r.path)}>
                  <span class={name}>{r.name}</span>
                  <span class={muted}>⎇ {r.branch}</span>
                </button>
                <For each={r.worktrees}>
                  {(w) => (
                    <button class={row({ selected: repo() === w.path, indent: true })} title={w.path} onClick={() => pickRepo(w.path)}>
                      <span class={name}>⑂ {w.path.split(/[\\/]/).pop()}</span>
                      <span class={muted}>⎇ {w.branch || w.head}</span>
                    </button>
                  )}
                </For>
              </>
            )}
          </For>
          <Show when={repos.error}>
            <div class={error}>{repos.error.message}</div>
          </Show>
        </section>

        <Show when={branches.latest}>
          {(b) => (
            <section class={`${section} ${branchBox}`}>
              <label>
                Branch
                <select class={`${select} ${grow}`} value={b().current} onChange={checkout}>
                  <Show when={!b().current}>
                    <option value="">(detached)</option>
                  </Show>
                  <optgroup label="Local">
                    <For each={b().local}>{(n) => <option value={n}>{n}</option>}</For>
                  </optgroup>
                  <optgroup label="Remote">
                    <For each={b().remote}>{(n) => <option value={n} data-remote="1">{n}</option>}</For>
                  </optgroup>
                </select>
              </label>
              <div class={cmp}>
                <label>
                  Compare
                  <select class={`${select} ${grow}`} value={base()} onChange={(e) => setBase(e.target.value)}>
                    <option value="">Working tree (uncommitted)</option>
                    <optgroup label="Local">
                      <For each={b().local}>{(n) => <option value={n}>{n}</option>}</For>
                    </optgroup>
                    <optgroup label="Remote">
                      <For each={b().remote}>{(n) => <option value={n}>{n}</option>}</For>
                    </optgroup>
                  </select>
                </label>
                <Show when={base()}>
                  <label class={wtLabel} title="Include uncommitted and untracked changes in the comparison">
                    <input type="checkbox" role="switch" class={switchCls} checked={withWT()} onChange={(e) => toggleWT(e.target.checked)} />
                    Working tree
                  </label>
                </Show>
              </div>
            </section>
          )}
        </Show>

        <nav class={tabs}>
          <button class={tabBtn({ active: tab() === 'changes' })} onClick={() => setTab('changes')}>
            Changes <span class={count}>{(status.latest || []).length}</span>
          </button>
          <button class={tabBtn({ active: tab() === 'files' })} onClick={() => setTab('files')}>
            Explorer
          </button>
          <button class={tabBtn({ active: tab() === 'commits' })} onClick={() => setTab('commits')}>
            Commits
          </button>
        </nav>

        <div class={treeBox}>
          <Show when={tab() === 'changes' && base()}>
            <h3 class={heading}>
              vs {base()} ({baseItems().length})
            </h3>
            <Tree items={baseItems()} defaultOpen selected={sel()?.key} onSelect={open} badge={(i) => i.status} />
          </Show>
          <Show when={tab() === 'changes' && !base()}>
            <Show when={stagedItems().length}>
              <h3 class={heading}>Staged Changes ({stagedItems().length})</h3>
              <Tree items={stagedItems()} defaultOpen selected={sel()?.key} onSelect={open} badge={(i) => i.status} />
            </Show>
            <h3 class={heading}>Changes ({unstagedItems().length})</h3>
            <Tree items={unstagedItems()} defaultOpen selected={sel()?.key} onSelect={open} badge={(i) => i.status} />
          </Show>
          <Show when={tab() === 'files'}>
            <Tree items={fileItems()} selected={sel()?.key} onSelect={open} badge={(i) => statusByPath().get(i.path)} />
          </Show>
          <Show when={tab() === 'commits'}>
            <Commits repo={repo()} tick={tick()} selected={sel()?.key} onSelect={open} />
          </Show>
          <Show when={status.error || files.error}>
            <div class={error}>{(status.error || files.error).message}</div>
          </Show>
        </div>
        <Show when={sel()}>
          <button class={toFile} onClick={() => setShowList(false)}>
            <span class={name}>↩ {sel().path.split('/').pop()}</span>
            <span class={muted}>swipe ←</span>
          </button>
        </Show>
      </aside>

      <Show when={picker()}>
        <Picker parent={cfg().parent} current={root() || cfg().base} onPick={openRoot} onClose={() => setPicker(false)} />
      </Show>
      <main class={main}>
        <Viewer repo={repo()} sel={sel()} tick={tick()} onBack={() => setShowList(true)} onOpen={(path) => setSel({ kind: 'file', path, key: 'f:' + path })} />
      </main>
    </div>
  )
}
