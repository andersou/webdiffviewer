import { createResource, For, Show } from 'solid-js'
import { css, cva } from 'styled-system/css'
import { json, text } from '../lib/api/client.js'
import MarkdownPreview, { THEMES } from './MarkdownPreview.jsx'
import { empty, errorBox, muted } from './ui/styles.js'
import { createStoredSignal } from '../hooks/createStoredSignal.js'
import CodeView from './CodeView.jsx'
import { parseDiff } from '../lib/git/diff.js'
import { highlight } from '../lib/highlight/highlight.js'
import { isHtml, viewOf, views } from '../lib/utils/url.js'
import HtmlPreview from './HtmlPreview.jsx'

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
// right side of the bar: [Diff | File | Preview] (Blame on line icon) [Blame]
const bar = css({ float: 'right', ml: '10px', display: 'inline-flex', alignItems: 'center', gap: '10px', color: 'ui.muted', fontSize: '12px' })
const seg = css({ display: 'inline-flex', fontSize: '13px', color: 'ui.fg', border: '1px solid token(colors.ui.borderStrong)', borderRadius: '3px', overflow: 'hidden' })
const segBtn = cva({
  base: { px: '10px', py: '1px', _hover: { bg: '#333' }, '&:not(:first-child)': { borderLeft: '1px solid token(colors.ui.borderStrong)' } },
  variants: { active: { true: { bg: 'ui.accent', color: '#fff', _hover: { bg: 'ui.accent' } } } },
})
// Blame on line: an icon toggle, blue when on
const iconBtn = cva({
  base: { display: 'inline-flex', p: '2px', borderRadius: '3px', color: 'ui.muted', border: '1px solid transparent', _hover: { color: 'ui.fg', bg: '#333' } },
  variants: { on: { true: { color: '#fff', bg: 'rgba(0, 127, 212, 0.35)', borderColor: 'ui.accent', _hover: { color: '#fff', bg: 'rgba(0, 127, 212, 0.5)' } } } },
})
const LABELS = { diff: 'Diff', file: 'File', blame: 'Blame', preview: 'Preview' }

// version shown by File/Preview: the commit itself in the Commits tab, the branch viewed without
// checkout, the index for staged changes, HEAD for a branch comparison without the working tree,
// otherwise the file on disk
const rev = (s, ref) => s.commit || ref || (s.kind !== 'diff' ? '' : s.staged ? ':' : s.base && !s.wt ? 'HEAD' : '')

const where = (s, ref) =>
  s.kind === 'file' ? (ref ? ` (${ref})` : '') : ref && !s.commit ? ` (${ref} vs ${s.base})` : s.commit ? ` (commit ${s.commit.slice(0, 7)})` : s.base ? ` (vs ${s.base})` : s.staged ? ' (staged)' : s.untracked ? ' (untracked)' : ' (working tree)'

// Viewer shows the selected file or change as Diff, File or (markdown/HTML) Preview.
export default function Viewer(props) {
  const view = () => viewOf(props.sel, props.pref)
  const preview = () => !!props.sel && view() === 'preview'

  const [storedTheme, setTheme] = createStoredSignal('mdTheme', 'github-light')
  const theme = () => (THEMES[storedTheme()] ? storedTheme() : 'github-light') // ignore unknown saved values
  const [showToc, setShowToc] = createStoredSignal('mdToc', false)

  // Blame switch (File and Diff): a clicked line shows who last changed it. The blame is of the
  // version the File view shows, which is the new side of a diff.
  const [lineBlameOn, setLineBlame] = createStoredSignal('lineBlame', false)
  const canLineBlame = () => (view() === 'file' || view() === 'diff') && views(props.sel).includes('blame')
  const [lineBlame] = createResource(
    () => lineBlameOn() && props.sel && canLineBlame() && [props.repo, props.sel.path, rev(props.sel, props.gitRef), props.tick],
    ([repo, path, r]) => json('blame', { repo, path, rev: r }),
  )

  // a refresh (window focus) that fetches the same text returns the same rows, so nothing re-renders
  let last
  const [data] = createResource(
    () => props.sel && !preview() && [props.repo, props.sel, props.tick, view(), props.gitRef],
    async ([repo, s, , v, ref]) => {
      // blame comes as JSON (commits + lines); its text is the cache key like the other views
      const blame = v === 'blame' && (await json('blame', { repo, path: s.path, rev: rev(s, ref) }))
      const src = blame
        ? JSON.stringify(blame)
        : v === 'file'
          ? await text('file', { repo, path: s.path, rev: rev(s, ref) })
          : await text('diff', { repo, path: s.path, orig: s.orig || '', base: s.base || '', commit: s.commit || '', wt: s.wt ? 1 : 0, staged: s.staged ? 1 : 0, untracked: s.untracked ? 1 : 0, ref: (!s.commit && ref) || '' })
      const id = JSON.stringify([repo, s.key, s.base, s.wt, v, ref])
      if (last?.id === id && last.src === src) return last.rows
      let rows
      if (blame) {
        // c: the commit of the line, shown on the first line of each run from the same commit
        rows = blame.lines.map((l, i) => ({ t: 'ctx', n: i + 1, text: l.text, c: l.c, first: i === 0 || blame.lines[i - 1].c !== l.c }))
        rows.commits = blame.commits
        await highlight(s.path, rows)
      } else if (v === 'file') {
        rows = src.split('\n').map((t, i) => ({ t: 'ctx', n: i + 1, text: t }))
        await highlight(s.path, rows)
      } else {
        rows = parseDiff(src)
        // highlight each side as continuous code; context lines end up with the new side's tokens
        await highlight(s.path, rows.filter((r) => r.t === 'del' || r.t === 'ctx'))
        await highlight(s.path, rows.filter((r) => r.t === 'add' || r.t === 'ctx'))
        if (!rows.length) rows = [{ t: 'hunk', text: src.trim() || 'No changes' }] // binary/mode-only diffs
      }
      last = { id, src, rows }
      return rows
    },
  )

  const ViewBtn = (p) => (
    <button class={segBtn({ active: view() === p.v })} aria-pressed={view() === p.v} onClick={() => props.onPref({ ...props.pref, [props.sel.kind]: p.v })}>
      {LABELS[p.v]}
    </button>
  )

  return (
    <Show when={props.sel} fallback={<div class={empty}>Select a file or a change</div>}>
      <div class={head}>
        <button class={back} onClick={props.onBack} aria-label="Back to list">←</button>
        <Show when={views(props.sel).length > 1}>
          <span class={bar} role="group" aria-label="View">
            <span class={seg}>
              <For each={views(props.sel).filter((v) => v !== 'blame')}>{(v) => <ViewBtn v={v} />}</For>
            </span>
            <Show when={views(props.sel).includes('blame')}>
              <button
                class={iconBtn({ on: lineBlameOn() })}
                aria-pressed={lineBlameOn()}
                aria-label="Blame on line"
                title={`Blame on line: ${lineBlameOn() ? 'on' : 'off'}. In File and Diff, click a line to see who last changed it`}
                onClick={() => setLineBlame(!lineBlameOn())}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21c1-4.5 4.2-7 8-7s7 2.5 8 7" />
                </svg>
              </button>
              <span class={seg}>
                <ViewBtn v="blame" />
              </span>
            </Show>
          </span>
        </Show>
        <span>{props.sel.path}</span>
        <Show when={props.sel.orig}>
          <span class={muted}> ← {props.sel.orig}</span>
        </Show>
        <span class={muted}>{where(props.sel, props.gitRef)}</span>
      </div>
      <Show
        when={!preview()}
        fallback={
          <Show
            when={!isHtml(props.sel.path)}
            fallback={<HtmlPreview repo={props.repo} path={props.sel.path} rev={rev(props.sel, props.gitRef)} tick={props.tick} />}
          >
            <MarkdownPreview
              repo={props.repo}
              path={props.sel.path}
              rev={rev(props.sel, props.gitRef)}
              tick={props.tick}
              theme={theme()}
              onTheme={setTheme}
              showToc={showToc()}
              onToggleToc={() => setShowToc((on) => !on)}
              onCloseToc={() => setShowToc(false)}
              onOpen={props.onOpen}
            />
          </Show>
        }
      >
        <Show when={!data.error} fallback={<div class={errorBox}>{data.error?.message}</div>}>
          <Show when={data.latest}>{(rows) => <CodeView rows={rows()} line={props.sel.line} onCommit={props.onCommit} lineBlame={lineBlameOn() && canLineBlame() ? lineBlame.latest : undefined} />}</Show>
        </Show>
      </Show>
    </Show>
  )
}
