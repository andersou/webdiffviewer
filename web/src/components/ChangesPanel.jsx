import { createMemo, Show } from 'solid-js'
import { baseItems, changeItems } from '../lib/git/changes.js'
import Tree from './Tree.jsx'
import { heading } from './ui/styles.js'

// ChangesPanel shows staged and unstaged changes, or with a Base branch the comparison with it.
export default function ChangesPanel(props) {
  const staged = createMemo(() => changeItems(props.status, true))
  const unstaged = createMemo(() => changeItems(props.status, false))
  const compared = createMemo(() => baseItems(props.status, props.base, props.withWorktree))
  // a component (not a function call) so items stay a reactive prop and folder state survives refreshes
  const Changes = (p) => <Tree items={p.items} defaultOpen selected={props.selected} onSelect={props.onSelect} badge={(i) => i.status} />
  return (
    <Show
      when={!props.base}
      fallback={
        <>
          <h3 class={heading}>
            vs {props.base} ({compared().length})
          </h3>
          <Changes items={compared()} />
        </>
      }
    >
      <Show when={staged().length}>
        <h3 class={heading}>Staged Changes ({staged().length})</h3>
        <Changes items={staged()} />
      </Show>
      <h3 class={heading}>Changes ({unstaged().length})</h3>
      <Changes items={unstaged()} />
    </Show>
  )
}
