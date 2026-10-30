import { createEffect, createMemo, createResource, createSignal, Show } from 'solid-js'
import { css, cva } from 'styled-system/css'
import BranchBar from './components/BranchBar.jsx'
import ChangesPanel from './components/ChangesPanel.jsx'
import Commits from './components/Commits.jsx'
import Picker from './components/Picker.jsx'
import RepoList from './components/RepoList.jsx'
import Tree from './components/Tree.jsx'
import { error, muted, name } from './components/ui/styles.js'
import Viewer from './components/Viewer.jsx'
import { createStoredSignal } from './hooks/createStoredSignal.js'
import { createSwipe } from './hooks/createSwipe.js'
import { createWindowEvent } from './hooks/createWindowEvent.js'
import { api, json } from './lib/api/client.js'
import { statusByPath } from './lib/git/changes.js'

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
  mdDown: { display: 'flex', alignItems: 'center', gap: '8px', w: '100%', px: '14px', py: '12px', borderTop: '1px solid token(colors.ui.border)', bg: 'ui.raised', textAlign: 'left' },
})

// App holds the selection state (folder, repo, base branch, open file) and lays out sidebar + viewer.
export default function App() {
  const [tick, setTick] = createSignal(0)
  const refresh = () => setTick((t) => t + 1)
  createWindowEvent('focus', refresh)

  // --parent-dir: the folder being browsed lives in ?root= so each tab can look at a different repo
  const [cfg] = createResource(() => json('config'))
  const [root, setRoot] = createSignal(new URLSearchParams(location.search).get('root') || '')
  const [picker, setPicker] = createSignal(false)
  const rootName = () => (root() || cfg()?.base || '').split(/[\\/]/).pop() // filesystem path: \ on Windows
  createEffect(() => (document.title = rootName() ? `${rootName()} · webdiffviewer` : 'webdiffviewer'))
  createWindowEvent('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && cfg()?.parent) {
      e.preventDefault()
      setPicker(true)
    }
  })
  const openRoot = (path) => {
    const r = path === cfg()?.base ? '' : path
    history.replaceState(null, '', r ? `?root=${encodeURIComponent(r)}` : location.pathname)
    setRoot(r)
    setPicker(false)
  }

  const [repos] = createResource(
    () => [tick(), root()],
    ([, r]) => json('repos', r ? { root: r } : {}),
  )
  const [repo, setRepo] = createSignal()
  const [tab, setTab] = createSignal('changes')
  const [sel, setSel] = createSignal()
  const [base, setBase] = createSignal('') // '' = working tree vs index/HEAD; else compare with this branch
  // in a branch comparison, also include uncommitted + untracked changes
  const [withWT, setWithWT] = createStoredSignal('compareWT', true)
  const toggleWT = (on) => {
    setWithWT(on)
    setSel((s) => (s?.base ? { ...s, wt: on } : s)) // re-diff the open file in the new mode
  }
  const pickRepo = (path) => {
    setRepo(path)
    setSel()
    setBase('')
  }
  // keep the selected repo valid: first repo on load, after opening another folder, or if it disappeared
  createEffect(() => {
    const list = repos.latest
    const known = list?.some((r) => r.path === repo() || r.worktrees.some((w) => w.path === repo()))
    if (list?.length && !known) pickRepo(list[0].path)
  })

  // phones show one pane: the list, or the open file. "Back" only shows the list, so the file
  // stays open and a right-to-left swipe (or the button at the bottom) returns to it.
  const [showList, setShowList] = createSignal(true)
  // On phones the file view gets its own browser history entry, so the system back gesture or
  // button returns to the list (state intact) instead of leaving the page. Desktop shows both
  // panes, so it doesn't touch history.
  const narrow = () => matchMedia('(width < 48rem)').matches
  const showFile = () => {
    if (!showList()) return
    setShowList(false)
    if (narrow()) history.pushState({ wdvFile: true }, '')
  }
  const showListPane = () => (narrow() && history.state?.wdvFile ? history.back() : setShowList(true)) // back() lands in popstate
  createWindowEvent('popstate', (e) => setShowList(!(e.state?.wdvFile && sel())))
  const open = (item) => {
    setSel(item)
    showFile()
  }
  const swipe = createSwipe(() => sel() && showFile())

  const key = () => repo() && [repo(), tick()]
  const [branches] = createResource(key, ([r]) => json('branches', { repo: r }))
  const [files] = createResource(key, ([r]) => json('files', { repo: r }))
  const [status] = createResource(
    () => repo() && [repo(), tick(), base(), withWT()],
    ([r, , b, wt]) => json('status', b ? { repo: r, base: b, wt: wt ? 1 : 0 } : { repo: r }),
  )
  const statusList = () => status.latest || []
  const fileItems = createMemo(() => (files.latest || []).map((path) => ({ path, key: 'f:' + path, kind: 'file' })))
  const letters = createMemo(() => statusByPath(statusList()))

  const checkout = async (branch) => {
    try {
      await api('checkout', { repo: repo() }, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ branch }) })
    } catch (err) {
      alert(err.message)
    }
    refresh()
  }

  return (
    <div class={sel() && !showList() ? `${app} viewing` : app}>
      <aside class={sidebar} onTouchStart={swipe.onTouchStart} onTouchEnd={swipe.onTouchEnd}>
        <RepoList
          repos={repos.latest}
          error={repos.error}
          selected={repo()}
          onSelect={pickRepo}
          onRefresh={refresh}
          canPick={cfg()?.parent}
          rootName={rootName()}
          onPick={() => setPicker(true)}
        />
        <Show when={branches.latest}>
          {(b) => <BranchBar branches={b()} onCheckout={checkout} base={base()} onBase={setBase} withWorktree={withWT()} onWithWorktree={toggleWT} />}
        </Show>

        <nav class={tabs}>
          <button class={tabBtn({ active: tab() === 'changes' })} onClick={() => setTab('changes')}>
            Changes <span class={count}>{statusList().length}</span>
          </button>
          <button class={tabBtn({ active: tab() === 'files' })} onClick={() => setTab('files')}>
            Explorer
          </button>
          <button class={tabBtn({ active: tab() === 'commits' })} onClick={() => setTab('commits')}>
            Commits
          </button>
        </nav>

        <div class={treeBox}>
          <Show when={tab() === 'changes'}>
            <ChangesPanel status={statusList()} base={base()} withWorktree={withWT()} selected={sel()?.key} onSelect={open} />
          </Show>
          <Show when={tab() === 'files'}>
            <Tree items={fileItems()} selected={sel()?.key} onSelect={open} badge={(i) => letters().get(i.path)} />
          </Show>
          <Show when={tab() === 'commits'}>
            <Commits repo={repo()} tick={tick()} selected={sel()?.key} onSelect={open} />
          </Show>
          <Show when={status.error || files.error}>
            <div class={error}>{(status.error || files.error).message}</div>
          </Show>
        </div>
        <Show when={sel()}>
          <button class={toFile} onClick={showFile}>
            <span class={name}>↩ {sel().path.split('/').pop()}</span>
            <span class={muted}>swipe ←</span>
          </button>
        </Show>
      </aside>

      <Show when={picker()}>
        <Picker parent={cfg().parent} current={root() || cfg().base} onPick={openRoot} onClose={() => setPicker(false)} />
      </Show>
      <main class={main}>
        <Viewer repo={repo()} sel={sel()} tick={tick()} onBack={showListPane} onOpen={(path) => setSel({ kind: 'file', path, key: 'f:' + path })} />
      </main>
    </div>
  )
}
