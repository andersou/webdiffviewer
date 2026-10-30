import { batch, createEffect, createMemo, createResource, createSignal, Show } from 'solid-js'
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
import { lastSegment } from './lib/utils/paths.js'
import { DEFAULT_PREF, findRepo, fromSearch, relPath, toSearch, viewOf } from './lib/utils/url.js'

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

  // The URL holds what is on screen (lib/utils/url.js). `want` is a decoded URL waiting for its
  // folder's repo list: the server only accepts repos that /api/repos has listed.
  const [want, setWant] = createSignal(fromSearch(location.search))
  // --parent-dir: the folder being browsed (?root=), so each tab can look at a different repo
  const [cfg] = createResource(() => json('config'))
  const [root, setRoot] = createSignal(want().root)
  const [picker, setPicker] = createSignal(false)
  const rootName = () => lastSegment(root() || cfg()?.base || '')
  createWindowEvent('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && cfg()?.parent) {
      e.preventDefault()
      setPicker(true)
    }
  })
  // push keeps the current screen one Back away; the state change after it rewrites the new entry
  const push = () => history.pushState({}, '', location.href)
  const openRoot = (path) => {
    const r = path === cfg()?.base ? '' : path
    setPicker(false)
    if (r === root()) return
    push()
    batch(() => {
      setRoot(r)
      setWant(fromSearch(r ? '?' + new URLSearchParams({ root: r }) : ''))
    })
  }

  const [repos] = createResource(
    () => [tick(), root()],
    ([, r]) => json('repos', r ? { root: r } : {}).then((list) => ({ root: r, list })),
  )
  const [repo, setRepo] = createSignal()
  const [tab, setTab] = createSignal('changes')
  const [sel, setSel] = createSignal()
  const [base, setBase] = createSignal('') // '' = working tree vs index/HEAD; else compare with this branch
  // in a branch comparison, also include uncommitted + untracked changes
  const [withWT, setWithWT, setWithWTOnce] = createStoredSignal('compareWT', true)
  const [pref, setPref] = createSignal(DEFAULT_PREF) // last view (Diff/File/Preview) per kind
  const [openHash, setOpenHash] = createSignal() // commit expanded in the Commits tab
  const toggleWT = (on) => {
    setWithWT(on)
    setSel((s) => (s?.base ? { ...s, wt: on } : s)) // re-diff the open file in the new mode
  }
  const selectRepo = (path) =>
    batch(() => {
      setRepo(path)
      setSel()
      setBase('')
      setOpenHash()
    })
  const pickRepo = (path) => path !== repo() && (push(), selectRepo(path))
  const pickBase = (b) => {
    push()
    batch(() => {
      setBase(b)
      setSel((s) => (s?.kind === 'diff' && !s.commit ? undefined : s)) // that diff belongs to the old mode
    })
  }
  // apply a pending URL once its folder's repos are listed; otherwise keep the selected repo valid
  // (first repo on load, or if it disappeared)
  createEffect(() => {
    const r = repos.latest
    if (!r || !cfg()) return
    const w = want()
    if (w) {
      if (w.root !== r.root) return // still the previous folder's list
      const path = findRepo(r.list, r.root || cfg().base, w.repo)
      batch(() => {
        setWant()
        setTab(w.tab)
        if (!path) return r.list.length && selectRepo(r.list[0].path)
        setRepo(path)
        setBase(w.base)
        if (w.base) setWithWTOnce(w.wt)
        setOpenHash(w.commit || undefined)
        setSel(w.sel)
        if (w.sel && w.view) setPref((p) => ({ ...p, [w.sel.kind]: w.view }))
      })
      // a fresh link to a file on a phone: open it with the list one Back away, as if tapped
      if (path && w.sel && narrow() && history.state === null) showFile()
      else if (path && w.sel && history.state?.wdvFile) setShowList(false) // reload on the file pane
      return
    }
    const known = r.list.some((x) => x.path === repo() || x.worktrees.some((wt) => wt.path === repo()))
    if (r.list.length && !known) selectRepo(r.list[0].path)
  })

  const search = () => {
    if (want() || !cfg() || !repo()) return null
    const s = sel()
    const v = s && viewOf(s, pref())
    return toSearch({
      root: root(),
      repo: relPath(root() || cfg().base, repo()),
      tab: tab(),
      base: base(),
      wt: withWT(),
      commit: openHash(),
      sel: s,
      view: v !== viewOf(s, DEFAULT_PREF) && v,
    })
  }
  // sync writes the state into the current history entry (keeping its state, e.g. the phone marker)
  const sync = () => {
    const s = search()
    if (s !== null && s !== location.search) history.replaceState(history.state, '', s || location.pathname)
  }
  createEffect(sync)
  createEffect(() => {
    const name = rootName() ? `${rootName()} · webdiffviewer` : 'webdiffviewer'
    document.title = sel() ? `${lastSegment(sel().path)} · ${name}` : name // names entries in the Back menu
  })

  // phones show one pane: the list, or the open file. "Back" only shows the list, so the file
  // stays open and a right-to-left swipe (or the button at the bottom) returns to it.
  const [showList, setShowList] = createSignal(true)
  // On phones the file view gets its own history entry ({wdvFile}), so the system back gesture
  // returns to the list (state intact) instead of the previous file or page. The list entry is
  // marked {} so a reload can tell it apart from a fresh link (state null).
  const narrow = () => matchMedia('(width < 48rem)').matches
  const showFile = () => {
    if (!showList()) return
    setShowList(false)
    if (narrow()) {
      sync()
      history.replaceState({}, '')
      history.pushState({ wdvFile: true }, '')
    }
  }
  const showListPane = () => (narrow() && history.state?.wdvFile ? history.back() : setShowList(true)) // back() lands in popstate
  createWindowEvent('popstate', (e) => {
    // phone, file -> list: only the pane changes; the list entry takes the current state
    if (narrow() && !e.state?.wdvFile && !showList()) return setShowList(true), sync()
    const w = fromSearch(location.search)
    setShowList(!(e.state?.wdvFile && w.sel))
    if (search() === location.search) return // same screen (phone, list -> file)
    batch(() => {
      setRoot(w.root)
      setWant(w)
    })
  })
  // desktop: each file opened is one Back away; phones push only list -> file (showFile)
  const open = (item) => {
    if (item.key === sel()?.key) return showFile()
    if (!narrow()) push()
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
  const statusList = () => (status.error ? [] : status.latest || []) // .latest throws after an error (e.g. a deleted base)
  const fileItems = createMemo(() => (files.error ? [] : files.latest || []).map((path) => ({ path, key: 'f:' + path, kind: 'file' })))
  const letters = createMemo(() => statusByPath(statusList()))

  createEffect(() => {
    const b = !branches.error && branches.latest
    if (b && base() && !b.local.includes(base()) && !b.remote.includes(base())) batch(() => (setBase(''), setSel((s) => (s?.base ? undefined : s))))
  })

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
          repos={repos.error ? undefined : repos.latest?.list}
          error={repos.error}
          selected={repo()}
          onSelect={pickRepo}
          onRefresh={refresh}
          canPick={cfg()?.parent}
          rootName={rootName()}
          onPick={() => setPicker(true)}
        />
        <Show when={branches.latest}>
          {(b) => <BranchBar branches={b()} onCheckout={checkout} base={base()} onBase={pickBase} withWorktree={withWT()} onWithWorktree={toggleWT} />}
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
            <Tree items={fileItems()} selected={sel()?.key} reveal={sel()?.kind === 'file' ? sel().path : undefined} onSelect={open} badge={(i) => letters().get(i.path)} />
          </Show>
          <Show when={tab() === 'commits'}>
            <Commits repo={repo()} tick={tick()} selected={sel()?.key} onSelect={open} openHash={openHash()} onOpenHash={setOpenHash} />
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
        <Viewer repo={repo()} sel={sel()} tick={tick()} pref={pref()} onPref={setPref} onBack={showListPane} onOpen={(path) => open({ kind: 'file', path, key: 'f:' + path })} />
      </main>
    </div>
  )
}
