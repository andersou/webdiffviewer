import { createMemo, createSignal, For, Show } from 'solid-js'
import { createStore } from 'solid-js/store'
import { css } from 'styled-system/css'
import { badge, name, row } from '../styles/ui'

const chev = css({ w: '10px', color: '#999' })
const iconBox = css({ w: '16px', h: '16px', flex: 'none', '& img': { w: '16px', h: '16px' } })

// icon map + SVG URLs load in the background; rows render without icons until then
const [icons, setIcons] = createSignal()
import('./icons').then(setIcons)

// items: [{ path, ... }]; folders are derived from the paths and rendered lazily (only when expanded).
function build(items) {
  const root = { children: new Map() }
  for (const item of items) {
    const parts = item.path.split('/')
    let node = root
    for (let i = 0; i < parts.length - 1; i++) {
      let child = node.children.get(parts[i])
      if (!child) node.children.set(parts[i], (child = { name: parts[i], path: parts.slice(0, i + 1).join('/'), children: new Map() }))
      node = child
    }
    node.children.set(parts.at(-1), { name: parts.at(-1), item })
  }
  return root
}

const sorted = (node) =>
  [...node.children.values()].sort((a, b) => !a.children - !b.children || a.name.localeCompare(b.name))

export default function Tree(props) {
  const root = createMemo(() => build(props.items))
  // expansion state survives refreshes because it is keyed by folder path, not by node object
  const [open, setOpen] = createStore({})
  const isOpen = (path) => open[path] ?? props.defaultOpen

  const Node = (p) => (
    <Show
      when={p.node.children}
      fallback={
        <button
          class={row({ selected: props.selected === p.node.item.key })}
          style={{ 'padding-left': `${p.depth * 12 + 22}px` }}
          title={p.node.item.path}
          onClick={() => props.onSelect(p.node.item)}
        >
          <span class={iconBox}>
            <Show when={icons()}>{(m) => <img src={m().fileIcon(p.node.item.path)} alt="" />}</Show>
          </span>
          <span class={name}>{p.node.name}</span>
          <Show when={props.badge?.(p.node.item)}>
            {(b) => <span class={badge({ s: b()[0] })}>{b()}</span>}
          </Show>
        </button>
      }
    >
      <button class={row()} style={{ 'padding-left': `${p.depth * 12 + 6}px` }} onClick={() => setOpen(p.node.path, !isOpen(p.node.path))}>
        <span class={chev}>{isOpen(p.node.path) ? '▾' : '▸'}</span>
        <span class={iconBox}>
          <Show when={icons()}>{(m) => <img src={m().folderIcon(p.node.path, isOpen(p.node.path))} alt="" />}</Show>
        </span>
        <span class={name}>{p.node.name}</span>
      </button>
      <Show when={isOpen(p.node.path)}>
        <For each={sorted(p.node)}>{(c) => <Node node={c} depth={p.depth + 1} />}</For>
      </Show>
    </Show>
  )

  return <For each={sorted(root())}>{(c) => <Node node={c} depth={0} />}</For>
}
