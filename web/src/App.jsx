import { batch, createEffect, createMemo, createResource, createSignal, For, Show } from 'solid-js'
import { css, cva } from 'styled-system/css'
import BranchBar from './components/BranchBar.jsx'
import ChangesPanel from './components/ChangesPanel.jsx'
import Commits from './components/Commits.jsx'
import Picker from './components/Picker.jsx'
import RepoList from './components/RepoList.jsx'
import SearchPanel from './components/SearchPanel.jsx'
import Tree from './components/Tree.jsx'
import { error, muted, name } from './components/ui/styles.js'
import TabIcon from './components/ui/TabIcon.jsx'
import Viewer from './components/Viewer.jsx'
import { createStoredSignal } from './hooks/createStoredSignal.js'
import { createSwipe } from './hooks/createSwipe.js'
import { createWindowEvent } from './hooks/createWindowEvent.js'
import { api, json } from './lib/api/client.js'
import { baseItems, changeItems, statusByPath } from './lib/git/changes.js'
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
  base: { position: 'relative', flex: 1, display: 'flex', justifyContent: 'center', p: '7px', color: 'ui.muted', borderBottom: '2px solid transparent', _hover: { color: 'ui.fg' } },
  variants: { active: { true: { borderColor: 'ui.accent', color: '#fff', _hover: { color: '#fff' } } } },
})
// the Changes count sits on the icon's corner, like VS Code's activity bar badge
const count = css({ position: 'absolute', top: '3px', left: 'calc(50% + 4px)', bg: 'ui.accent', color: '#fff', borderRadius: '8px', px: '5px', fontSize: '10px', lineHeight: '15px' })
const TABS = [
  ['changes', 'Changes'],
  ['files', 'Explorer'],
  ['search', 'Search'],
  ['commits', 'Commits'],
]
const treeBox = css({ flex: 1, overflow: 'auto', pb: '20px' })
// phones only: return to the open file from the list (same as swiping right-to-left)
const toFile = css({
  display: 'none',
  mdDown: { display: 'flex', alignItems: 'center', gap: '8px', w: '100%', px: '14px', py: '12px', borderTop: '1px solid token(colors.ui.border)', bg: 'ui.raised', textAlign: 'left' },
})

// last screen (the URL query) per repo path, restored when that repo is picked again
const lastScreens = () => {
  try {
    return JSON.parse(localStorage.getItem('lastScreens')) || {}
  } catch {
    return {}
  }
}
const saveScreen = (repo, search) => {
  const all = lastScreens()
  if (all[repo] !== search) localStorage.setItem('lastScreens', JSON.stringify({ ...all, [repo]: search }))
}

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
  const [picker, setPicker] = createSignal() // open quick-open dialog: 'folders' (Cmd+K) or 'files' (Cmd+P)
  const rootName = () => lastSegment(root() || cfg()?.base || '')
  createWindowEvent('keydown', (e) => {
    if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return
    const kind = { k: cfg()?.parent && 'folders', p: repo() && 'files' }[e.key.toLowerCase()]
    if (kind) {
      e.preventDefault() // Cmd+P would print
      setPicker(kind)
    }
  })
  // push keeps the current screen one Back away; the state change after it rewrites the new entry
  const push = () => history.pushState({}, '', location.href)
  const openRoot = (path) => {
    const r = path === cfg()?.base ? '' : path
    setPicker()
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
  // a branch viewed without checkout: Explorer, files, changes and commits read from it ('' = what is checked out)
  const [gitRef, setRef] = createSignal('')
  const [checkoutMode, setCheckoutMode] = createStoredSignal('checkoutMode', true) // off: picking a branch only views it
  // a viewed branch is compared with Base or, without one, with HEAD; the working tree doesn't apply
  const cmpBase = () => (gitRef() ? base() || 'HEAD' : base())
  const cmpWT = () => !gitRef() && withWT()
  // the branch whose changes are listed: the viewed one, else the checked-out one ("HEAD" when detached)
  const shownBranch = () => gitRef() || branches.latest?.current || 'HEAD'
  const [pref, setPref] = createSignal(DEFAULT_PREF) // last view (Diff/File/Preview) per kind
  const [textSearch, setTextSearch] = createSignal({ q: '', case: false, word: false, regex: false }) // Search tab, kept across tabs and repos
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
      setRef('')
      setOpenHash()
    })
  const pickRef = (b) => {
    push()
    batch(() => {
      setRef(b)
      setSel((s) => (s?.kind === 'diff' && !s.commit ? undefined : s)) // an open file stays open, now at b
    })
  }
  // back in a repo: its last screen (base, viewed branch, tab, open file), unless it was saved under another folder
  const pickRepo = (path) => {
    if (path === repo()) return
    push()
    const w = lastScreens()[path] !== undefined && fromSearch(lastScreens()[path])
    if (w && w.root === root()) setWant(w)
    else selectRepo(path)
  }
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
        setRef(w.ref)
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
      ref: gitRef(),
      commit: openHash(),
      sel: s,
      view: v !== viewOf({ ...s, view: undefined }, DEFAULT_PREF) && v, // against the default without the item's starting view
    })
  }
  // sync writes the state into the current history entry (keeping its state, e.g. the phone marker)
  const sync = () => {
    const s = search()
    if (s !== null && s !== location.search) history.replaceState(history.state, '', s || location.pathname)
  }
  createEffect(sync)
  createEffect(() => {
    const s = search()
    if (s !== null) saveScreen(repo(), s)
  })
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
    if (item.key === sel()?.key && item.line === sel()?.line) return showFile() // a search result may be another line of the open file
    if (!narrow()) push()
    setSel(item)
    showFile()
  }
  const swipe = createSwipe(() => sel() && showFile())

  const key = () => repo() && [repo(), tick()]
  const [branches] = createResource(key, ([r]) => json('branches', { repo: r }).then((b) => ({ ...b, repo: r })))
  const [files] = createResource(
    () => repo() && [repo(), tick(), gitRef()],
    ([r, , ref]) => json('files', ref ? { repo: r, ref } : { repo: r }),
  )
  const [status] = createResource(
    () => repo() && [repo(), tick(), cmpBase(), cmpWT(), gitRef()],
    ([r, , b, wt, ref]) => json('status', b ? { repo: r, base: b, wt: wt ? 1 : 0, ref } : { repo: r }),
  )
  const statusList = () => (status.error ? [] : status.latest || []) // .latest throws after an error (e.g. a deleted base)
  const fileItems = createMemo(() => {
    const f = (!files.error && files.latest) || { files: [], ignored: [] }
    return [...f.files.map((path) => ({ path, key: 'f:' + path, kind: 'file' })), ...f.ignored.map((path) => ({ path, key: 'f:' + path, kind: 'file', ignored: true }))]
  })
  const letters = createMemo(() => statusByPath(statusList()))
  // Cmd+P: the sidebar's changes (open as a diff) and the Explorer's files (open as the file)
  const changeList = createMemo(() =>
    cmpBase() ? baseItems(statusList(), cmpBase(), cmpWT()) : [...changeItems(statusList(), true), ...changeItems(statusList(), false)],
  )
  const [folders] = createResource(() => picker() === 'folders', () => json('folders'))
  // a search result opens as the file's text (not a preview), so it can scroll to the line
  // a blame cell: what that commit changed in the file (at its path then), with the commit open in the Commits tab
  const openCommit = (hash, path) => (setOpenHash(hash), open({ kind: 'diff', path, commit: hash, key: `c:${hash}:${path}`, view: 'diff' }))
  // a view button: the new choice for this kind, and the item's own starting view no longer applies
  const pickView = (p) => batch(() => (setPref(p), setSel((s) => (s?.view ? { ...s, view: undefined } : s))))
  // a search result opens at its line in the File view; a changed file opens as that change, so Diff
  // is one click away. Working-tree changes win over staged ones: git grep read the file on disk.
  const openLine = (it) => {
    const changes = changeList().filter((c) => c.path === it.path)
    const c = changes.find((x) => !x.staged) || changes[0]
    open({ ...(c || it), line: it.line, view: 'file' })
  }
  const quickOpen = (it) => {
    setPicker()
    if (it.kind === 'folder') return openRoot(it.path)
    if (it.kind === 'diff') setPref((p) => ({ ...p, diff: 'diff' })) // a change opens as its diff, even if File was last used
    open(it)
  }

  createEffect(() => {
    // .latest keeps the previous repo's list while this one loads: checking against it would drop a restored base
    const b = !branches.error && branches.latest?.repo === repo() && branches.latest
    const gone = (n) => n && !b.local.includes(n) && !b.remote.includes(n)
    if (b && gone(base())) batch(() => (setBase(''), setSel((s) => (s?.base ? undefined : s))))
    if (b && (gone(gitRef()) || gitRef() === b.current)) setRef('') // deleted, or checked out after all
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
          onPick={() => setPicker('folders')}
        />
        <Show when={branches.latest}>
          {(b) => <BranchBar
              branches={b()}
              onCheckout={checkout}
              gitRef={gitRef()}
              onView={pickRef}
              checkoutMode={checkoutMode()}
              onCheckoutMode={(on) => (setCheckoutMode(on), on && gitRef() && pickRef(''))}
              base={base()} onBase={pickBase} withWorktree={withWT()} onWithWorktree={toggleWT} />}
        </Show>

        <nav class={tabs}>
          <For each={TABS}>
            {([id, label]) => (
              <button class={tabBtn({ active: tab() === id })} title={label} aria-label={label} aria-pressed={tab() === id} onClick={() => setTab(id)}>
                <TabIcon name={id} />
                <Show when={id === 'changes' && statusList().length}>
                  <span class={count}>{statusList().length}</span>
                </Show>
              </button>
            )}
          </For>
        </nav>

        <div class={treeBox}>
          <Show when={tab() === 'changes'}>
            <ChangesPanel status={statusList()} branch={shownBranch()} base={cmpBase()} withWorktree={cmpWT()} selected={sel()?.key} onSelect={open} />
          </Show>
          <Show when={tab() === 'files'}>
            <Tree items={fileItems()} selected={sel()?.key} reveal={sel()?.kind === 'file' ? sel().path : undefined} onSelect={open} badge={(i) => letters().get(i.path)} />
          </Show>
          <Show when={tab() === 'search'}>
            <SearchPanel repo={repo()} gitRef={gitRef()} tick={tick()} search={textSearch()} onSearch={setTextSearch} selected={sel()} onOpen={openLine} />
          </Show>
          <Show when={tab() === 'commits'}>
            <Commits repo={repo()} gitRef={gitRef()} tick={tick()} selected={sel()?.key} onSelect={open} openHash={openHash()} onOpenHash={setOpenHash} />
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

      <Show when={picker() === 'folders'}>
        <Picker
          label="Open repository"
          placeholder={`Search repositories in ${cfg().parent}`}
          groups={[{ title: 'Repositories', items: (folders() || []).map((f) => ({ ...f, kind: 'folder', label: f.name, hint: f.path === (root() || cfg().base) && 'current' })) }]}
          loading={folders.loading && `Scanning ${cfg().parent}…`}
          error={folders.error}
          onPick={quickOpen}
          onClose={() => setPicker()}
        />
      </Show>
      <Show when={picker() === 'files'}>
        <Picker
          label="Open file"
          placeholder={`Search files in ${lastSegment(repo())}${gitRef() ? ` @ ${gitRef()}` : ''}`}
          groups={[
            { title: `Changes${cmpBase() ? ` ${shownBranch()} vs ${cmpBase()}` : ''}`, items: changeList().map((c) => ({ ...c, label: c.path, file: true, hint: c.staged ? `${c.status} staged` : c.status })), limit: 50 },
            { title: 'Files', items: fileItems().map((f) => ({ ...f, label: f.path, file: true })) },
          ]}
          loading={files.loading && !files.latest && 'Loading files…'}
          onPick={quickOpen}
          onClose={() => setPicker()}
        />
      </Show>
      <main class={main}>
        <Viewer repo={repo()} gitRef={gitRef()} sel={sel()} tick={tick()} pref={pref()} onPref={pickView} onBack={showListPane} onOpen={(path) => open({ kind: 'file', path, key: 'f:' + path })}
          onCommit={openCommit}
        />
      </main>
    </div>
  )
}
