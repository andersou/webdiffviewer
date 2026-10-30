import { For, Show } from 'solid-js'
import { css } from 'styled-system/css'
import { error, heading, muted, name, row, section } from './ui/styles.js'

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
const lastSegment = (p) => p.split(/[\\/]/).pop() // filesystem path: \ on Windows

// RepoList shows the open folder (with the --parent-dir picker button), its repos and their worktrees.
export default function RepoList(props) {
  return (
    <>
      <Show when={props.canPick}>
        <button class={rootBtn} title="Open another repository (Ctrl/⌘+K)" onClick={props.onPick}>
          <span class={name}>📁 {props.rootName}</span>
          <kbd>{/Mac|iP/.test(navigator.platform) ? '⌘K' : 'Ctrl+K'}</kbd>
        </button>
      </Show>
      <section class={section}>
        <h2 class={heading}>
          Repositories
          <button class={iconBtn} title="Refresh" aria-label="Refresh" onClick={props.onRefresh}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
          </button>
        </h2>
        <For each={props.repos}>
          {(r) => (
            <>
              <button class={row({ selected: props.selected === r.path })} title={r.path} onClick={() => props.onSelect(r.path)}>
                <span class={name}>{r.name}</span>
                <span class={muted}>⎇ {r.branch}</span>
              </button>
              <For each={r.worktrees}>
                {(w) => (
                  <button class={row({ selected: props.selected === w.path, indent: true })} title={w.path} onClick={() => props.onSelect(w.path)}>
                    <span class={name}>⑂ {lastSegment(w.path)}</span>
                    <span class={muted}>⎇ {w.branch || w.head}</span>
                  </button>
                )}
              </For>
            </>
          )}
        </For>
        <Show when={props.error}>
          <div class={error}>{props.error.message}</div>
        </Show>
      </section>
    </>
  )
}
