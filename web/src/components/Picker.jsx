import { createEffect, createMemo, createSignal, For, on, onMount, Show } from 'solid-js'
import { css, cva } from 'styled-system/css'
import { fuzzyPath, rank } from '../lib/utils/fuzzy.js'
import FileIcon from './ui/FileIcon.jsx'
import { muted, name } from './ui/styles.js'

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
const groupTitle = css({ px: '14px', pt: '6px', pb: '2px', color: 'ui.muted', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' })
const fileName = css({ flex: 'none', maxW: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })
const dir = css({ flex: 1, minW: 0, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '12px' })
const msg = css({ px: '14px', py: '10px', color: 'ui.muted' })
const msgError = css({ px: '14px', py: '10px', color: 'ui.error' })
const foot = css({ px: '14px', py: '6px', borderTop: '1px solid token(colors.ui.border)', color: '#777', fontSize: '11px' })

// highlight wraps matched character runs of label[from:to] in <b> (idx are positions in label)
function highlight(label, idx, from = 0, to = label.length) {
  const hit = new Set(idx)
  const parts = []
  for (let i = from; i < to; ) {
    let j = i
    while (j < to && hit.has(j) === hit.has(i)) j++
    parts.push(hit.has(i) ? <b>{label.slice(i, j)}</b> : label.slice(i, j))
    i = j
  }
  return parts
}

// Label shows a path like VS Code (the name, then its folder dimmed); other labels as they are
function Label(p) {
  const cut = () => (p.file ? p.label.lastIndexOf('/') : -1)
  return (
    <>
      <span class={p.file ? fileName : name}>{highlight(p.label, p.idx, cut() + 1)}</span>
      <Show when={cut() > 0}>
        <span class={`${muted} ${dir}`}>{highlight(p.label, p.idx, 0, cut())}</span>
      </Show>
    </>
  )
}

// Picker is a quick-open dialog: fuzzy search over groups ({ title, items, limit }) of items with
// a label and an optional hint (file: the label is a path, shown with its icon); Enter or a click
// passes the item to onPick.
export default function Picker(props) {
  const [query, setQuery] = createSignal('')
  const [active, setActive] = createSignal(0)
  const groups = createMemo(() => {
    let start = 0 // index of the group's first option, for keyboard order across groups
    return (props.groups || [])
      .map((g) => ({ title: g.title, results: rank(g.items, query(), (it) => it.label, fuzzyPath).slice(0, g.limit || 200) }))
      .filter((g) => g.results.length)
      .map((g) => ((start += g.results.length), { ...g, start: start - g.results.length }))
  })
  const results = createMemo(() => groups().flatMap((g) => g.results))
  createEffect(on(query, () => setActive(0)))

  let input, list
  onMount(() => input.focus())
  createEffect(() => list?.querySelector(`#pick-${active()}`)?.scrollIntoView({ block: 'nearest' }))

  const pick = (r) => r && props.onPick(r.item)
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
      <div class={dialog} role="dialog" aria-modal="true" aria-label={props.label} onClick={(e) => e.stopPropagation()}>
        <input
          ref={input}
          class={search}
          role="combobox"
          aria-expanded="true"
          aria-controls="picker-list"
          aria-activedescendant={`pick-${active()}`}
          placeholder={props.placeholder}
          value={query()}
          onInput={(e) => setQuery(e.target.value)}
          onKeyDown={onKey}
        />
        <ul id="picker-list" class={listCls} role="listbox" ref={list}>
          <For each={groups()}>
            {(g) => (
              <li role="presentation">
                <Show when={props.groups.length > 1}>
                  <div class={groupTitle}>{g.title}</div>
                </Show>
                <ul role="group" aria-label={g.title} class={listCls}>
                  <For each={g.results}>
                    {(r, j) => {
                      const i = g.start + j()
                      return (
                        <li id={`pick-${i}`} role="option" aria-selected={i === active()} class={option({ active: i === active() })} onMouseMove={() => setActive(i)} onClick={() => pick(r)}>
                          <Show when={r.item.file}>
                            <FileIcon path={r.item.label} />
                          </Show>
                          <Label label={r.item.label} idx={r.idx} file={r.item.file} />
                          <Show when={r.item.hint}>
                            <span class={muted}>{r.item.hint}</span>
                          </Show>
                        </li>
                      )
                    }}
                  </For>
                </ul>
              </li>
            )}
          </For>
        </ul>
        <Show when={props.loading}>
          <div class={msg}>{props.loading}</div>
        </Show>
        <Show when={props.error}>
          <div class={msgError}>{props.error.message}</div>
        </Show>
        <Show when={!props.loading && !props.error && !results().length}>
          <div class={msg}>Nothing matches “{query()}”</div>
        </Show>
        <div class={foot}>↑↓ navigate · Enter open · Esc close</div>
      </div>
    </div>
  )
}
