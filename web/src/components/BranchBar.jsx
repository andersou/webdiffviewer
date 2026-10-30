import { For, Show } from 'solid-js'
import { css } from 'styled-system/css'
import Switch from './ui/Switch.jsx'
import { section, select } from './ui/styles.js'

const box = css({ px: '10px', py: '6px', '& > label, & > div > label:first-child': { display: 'flex', my: '3px', gap: '8px', alignItems: 'center' } })
// same width for both labels, so the Branch and Base selects line up
const fieldLabel = css({ w: '46px', flex: 'none' })
const grow = css({ flex: 1, mdDown: { fontSize: '16px' } }) // < 16px makes iOS zoom on focus
const baseRow = css({ display: 'flex', gap: '10px', alignItems: 'center', '& > label:first-child': { flex: 1, minW: 0 } })

const BranchOptions = (props) => (
  <>
    <optgroup label="Local">
      <For each={props.branches.local}>{(n) => <option value={n}>{n}</option>}</For>
    </optgroup>
    <optgroup label="Remote">
      <For each={props.branches.remote}>{(n) => <option value={n} data-remote={props.markRemote ? '1' : undefined}>{n}</option>}</For>
    </optgroup>
  </>
)

// BranchBar switches the current branch and picks the Base branch the changes are compared with.
export default function BranchBar(props) {
  const checkout = (e) => {
    const opt = e.target.selectedOptions[0]
    // remote "origin/feat" -> "feat": git switch creates the tracking branch
    props.onCheckout(opt.dataset.remote ? opt.value.slice(opt.value.indexOf('/') + 1) : opt.value)
  }
  return (
    <section class={`${section} ${box}`}>
      <label>
        <span class={fieldLabel}>Branch</span>
        <select class={`${select} ${grow}`} value={props.branches.current} onChange={checkout}>
          <Show when={!props.branches.current}>
            <option value="">(detached)</option>
          </Show>
          <BranchOptions branches={props.branches} markRemote />
        </select>
      </label>
      <div class={baseRow}>
        <label>
          <span class={fieldLabel}>Base</span>
          <select class={`${select} ${grow}`} value={props.base} onChange={(e) => props.onBase(e.target.value)}>
            <option value="">Working tree (uncommitted)</option>
            <BranchOptions branches={props.branches} />
          </select>
        </label>
        <Show when={props.base}>
          <Switch checked={props.withWorktree} onChange={props.onWithWorktree} title="Include uncommitted and untracked changes in the comparison">
            Working tree
          </Switch>
        </Show>
      </div>
    </section>
  )
}
