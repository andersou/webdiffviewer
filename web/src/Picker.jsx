import { createEffect, createMemo, createResource, createSignal, For, on, onMount, Show } from 'solid-js'
import { css, cva } from '../styled-system/css'
import { json } from './api'
import { rank } from './fuzzy'
import { muted, name } from './ui'

const backdrop = css({ position: 'fixed', inset: 0, zIndex: 10, bg: 'rgba(0, 0, 0, 0.45)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', pt: '12vh', mdDown: { pt: '4vh' } })
const dialog = css({
  w: 'min(640px, 92vw)',
  maxH: '70vh',
  display: 'flex',
  flexDirection: 'column',
  bg: 'ui.panel',
  border: '1px solid #454545',
  borderRadius: '6px',
  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
  overflow: 'hidden',
})
const search = css({
  m: '8px',
  px: '10px',
  py: '7px',
  fontSize: '14px',
  color: '#ddd',
  bg: 'ui.input',
  border: '1px solid token(colors.ui.accent)',
  borderRadius: '3px',
  outline: 'none',
  mdDown: { fontSize: '16px' }, // < 16px makes iOS zoom on focus
})
const listCls = css({ listStyle: 'none', m: 0, pb: '4px', overflow: 'auto' })
const option = cva({
  base: { display: 'flex', gap: '8px', px: '14px', py: '5px', cursor: 'pointer', whiteSpace: 'nowrap', '& b': { color: 'ui.link', fontWeight: 600 } },
  variants: { active: { true: { bg: 'ui.selected' } } },
})
const msg = css({ px: '14px', py: '10px', color: 'ui.muted' })
const msgError = css({ px: '14px', py: '10px', color: 'ui.error' })
const foot = css({ px: '14px', py: '6px', borderTop: '1px solid token(colors.ui.border)', color: '#777', fontSize: '11px' })

// highlight wraps matched character runs of label in <b>
function highlight(label, idx) {
  const hit = new Set(idx)
  const parts = []
  for (let i = 0; i < label.length; ) {
    let j = i
    while (j < label.length && hit.has(j) === hit.has(i)) j++
    parts.push(hit.has(i) ? <b>{label.slice(i, j)}</b> : label.slice(i, j))
    i = j
  }
  return parts
}

// Picker is a quick-open dialog over the git repos under --parent-dir.
export default function Picker(props) {
  const [folders] = createResource(() => json('folders'))
  const [query, setQuery] = createSignal('')
  const [active, setActive] = createSignal(0)
  const results = createMemo(() => rank(folders() || [], query(), (f) => f.name).slice(0, 200))
  createEffect(on(query, () => setActive(0)))

  let input, list
  onMount(() => input.focus())
  createEffect(() => list?.children[active()]?.scrollIntoView({ block: 'nearest' }))

  const pick = (r) => r && props.onPick(r.item.path)
  const onKey = (e) => {
    const move = { ArrowDown: 1, ArrowUp: -1 }[e.key]
    if (move) {
      e.preventDefault()
      setActive((i) => Math.max(0, Math.min(results().length - 1, i + move)))
    } else if (e.key === 'Enter') pick(results()[active()])
    else if (e.key === 'Escape') props.onClose()
  }

  return (
    <div class={backdrop} onClick={props.onClose}>
      <div class={dialog} role="dialog" aria-modal="true" aria-label="Open repository" onClick={(e) => e.stopPropagation()}>
        <input
          ref={input}
          class={search}
          role="combobox"
          aria-expanded="true"
          aria-controls="picker-list"
          aria-activedescendant={`pick-${active()}`}
          placeholder={`Search repositories in ${props.parent}`}
          value={query()}
          onInput={(e) => setQuery(e.target.value)}
          onKeyDown={onKey}
        />
        <ul id="picker-list" class={listCls} role="listbox" ref={list}>
          <For each={results()}>
            {(r, i) => (
              <li
                id={`pick-${i()}`}
                role="option"
                aria-selected={i() === active()}
                class={option({ active: i() === active() })}
                onMouseMove={() => setActive(i())}
                onClick={() => pick(r)}
              >
                <span class={name}>{highlight(r.item.name, r.idx)}</span>
                <Show when={r.item.path === props.current}>
                  <span class={muted}>current</span>
                </Show>
              </li>
            )}
          </For>
        </ul>
        <Show when={folders.loading}>
          <div class={msg}>Scanning {props.parent}…</div>
        </Show>
        <Show when={folders.error}>
          <div class={msgError}>{folders.error.message}</div>
        </Show>
        <Show when={folders() && !results().length}>
          <div class={msg}>No repository matches “{query()}”</div>
        </Show>
        <div class={foot}>↑↓ navigate · Enter open · Esc close</div>
      </div>
    </div>
  )
}
