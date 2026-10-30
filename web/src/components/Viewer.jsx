import { createResource, createSignal, For, Show } from 'solid-js'
import { css, cva } from 'styled-system/css'
import { text } from '../lib/api/client.js'
import MarkdownPreview, { THEMES } from './MarkdownPreview.jsx'
import { empty, errorBox, muted } from './ui/styles.js'
import { createStoredSignal } from '../hooks/createStoredSignal.js'
import CodeView from './CodeView.jsx'
import { parseDiff } from '../lib/git/diff.js'
import { highlight } from '../lib/highlight/highlight.js'
import { viewOf, views } from '../lib/utils/url.js'

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
const themeSel = css({ float: 'right', ml: '10px', px: '4px', py: '1px', bg: 'ui.input', color: 'ui.fg', border: '1px solid token(colors.ui.borderStrong)', borderRadius: '3px' })
const LABELS = { diff: 'Diff', file: 'File', preview: 'Preview' }

// version shown by File/Preview: the commit itself in the Commits tab, the index for staged
// changes, HEAD for a branch comparison without the working tree, otherwise the file on disk
const rev = (s) => (s.kind !== 'diff' ? '' : s.commit || (s.staged ? ':' : s.base && !s.wt ? 'HEAD' : ''))

const where = (s) =>
  s.kind === 'file' ? '' : s.commit ? ` (commit ${s.commit.slice(0, 7)})` : s.base ? ` (vs ${s.base})` : s.staged ? ' (staged)' : s.untracked ? ' (untracked)' : ' (working tree)'

// Viewer shows the selected file or change as Diff, File or (markdown) Preview.
export default function Viewer(props) {
  const view = () => viewOf(props.sel, props.pref)
  const preview = () => !!props.sel && view() === 'preview'

  const [storedTheme, setTheme] = createStoredSignal('mdTheme', 'github-light')
  const theme = () => (THEMES[storedTheme()] ? storedTheme() : 'github-light') // ignore unknown saved values
  const [showToc, setShowToc] = createStoredSignal('mdToc', false)
  const toggleToc = () => setShowToc((on) => !on)
  const [headingCount, setHeadingCount] = createSignal(0)

  // a refresh (window focus) that fetches the same text returns the same rows, so nothing re-renders
  let last
  const [data] = createResource(
    () => props.sel && !preview() && [props.repo, props.sel, props.tick, view()],
    async ([repo, s, , v]) => {
      const src =
        v === 'file'
          ? await text('file', { repo, path: s.path, rev: rev(s) })
          : await text('diff', { repo, path: s.path, orig: s.orig || '', base: s.base || '', commit: s.commit || '', wt: s.wt ? 1 : 0, staged: s.staged ? 1 : 0, untracked: s.untracked ? 1 : 0 })
      const id = JSON.stringify([repo, s.key, s.base, s.wt, v])
      if (last?.id === id && last.src === src) return last.rows
      let rows
      if (v === 'file') {
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

  return (
    <Show when={props.sel} fallback={<div class={empty}>Select a file or a change</div>}>
      <div class={head}>
        <button class={back} onClick={props.onBack} aria-label="Back to list">←</button>
        <Show when={views(props.sel).length > 1}>
          <span class={seg} role="group" aria-label="View">
            <For each={views(props.sel)}>
              {(v) => (
                <button class={segBtn({ active: view() === v })} aria-pressed={view() === v} onClick={() => props.onPref({ ...props.pref, [props.sel.kind]: v })}>
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
        <Show when={preview() && headingCount()}>
          <span class={seg}>
            <button class={segBtn({ active: showToc() })} aria-pressed={showToc()} aria-controls="md-toc" title="Table of contents" onClick={toggleToc}>
              TOC
            </button>
          </span>
        </Show>
        <span>{props.sel.path}</span>
        <Show when={props.sel.orig}>
          <span class={muted}> ← {props.sel.orig}</span>
        </Show>
        <span class={muted}>{where(props.sel)}</span>
      </div>
      <Show
        when={!preview()}
        fallback={
          <MarkdownPreview
            repo={props.repo}
            path={props.sel.path}
            rev={rev(props.sel)}
            tick={props.tick}
            theme={theme()}
            showToc={showToc()}
            onCloseToc={() => setShowToc(false)}
            onHeadings={(list) => setHeadingCount(list.length)}
            onOpen={props.onOpen}
          />
        }
      >
        <Show when={!data.error} fallback={<div class={errorBox}>{data.error?.message}</div>}>
          <Show when={data.latest}>{(rows) => <CodeView rows={rows()} />}</Show>
        </Show>
      </Show>
    </Show>
  )
}
