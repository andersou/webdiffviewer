import { css } from 'styled-system/css'

const label = css({ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', cursor: 'pointer' })
const input = css({
  appearance: 'none',
  position: 'relative',
  w: '26px',
  h: '14px',
  m: 0,
  borderRadius: '7px',
  bg: 'ui.borderStrong',
  cursor: 'pointer',
  transition: 'background 0.15s',
  flex: 'none',
  _after: { content: '""', position: 'absolute', top: '2px', left: '2px', w: '10px', h: '10px', borderRadius: '50%', bg: '#ddd', transition: 'transform 0.15s' },
  _checked: { bg: 'ui.accent', _after: { transform: 'translateX(12px)', bg: '#fff' } },
  _focusVisible: { outline: '1px solid token(colors.ui.accent)', outlineOffset: '2px' },
})

// Switch is a labelled on/off toggle (a checkbox with role="switch", so keyboards and screen readers work).
export default function Switch(props) {
  return (
    <label class={label} title={props.title}>
      <input type="checkbox" role="switch" class={input} checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} />
      {props.children}
    </label>
  )
}
