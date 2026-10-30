// Styles shared by several components (Panda extracts them at build time).
import { css, cva } from '../styled-system/css'

export const row = cva({
  base: {
    display: 'flex',
    w: '100%',
    alignItems: 'center',
    gap: '6px',
    h: '22px',
    px: '10px',
    textAlign: 'left',
    whiteSpace: 'nowrap',
    _hover: { bg: 'ui.hover' },
    mdDown: { h: '32px' },
  },
  variants: {
    selected: { true: { bg: 'ui.selected', _hover: { bg: 'ui.selected' } } },
    indent: { true: { pl: '24px' } },
  },
})

export const name = css({ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })
export const muted = css({ color: 'ui.muted', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis' })
export const error = css({ color: 'ui.error', px: '10px', py: '6px', whiteSpace: 'pre-wrap' })
export const empty = css({ m: 'auto', color: '#777', p: '20px', whiteSpace: 'pre-wrap' })
export const heading = css({
  m: 0,
  px: '10px',
  py: '6px',
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase',
  color: 'ui.heading',
  display: 'flex',
  justifyContent: 'space-between',
})
export const select = css({ minW: 0, bg: 'ui.input', color: 'ui.fg', border: '1px solid token(colors.ui.borderStrong)', borderRadius: '2px', p: '3px' })

// status letter of a change: M, A, U (untracked), D, R, C — "•" suffix allowed
export const badge = cva({
  base: { fontSize: '11px', fontWeight: 600, minW: '12px', textAlign: 'center' },
  variants: {
    s: {
      M: { color: 'status.modified' },
      A: { color: 'status.added' },
      U: { color: 'status.added' },
      D: { color: 'status.deleted' },
      R: { color: 'status.renamed' },
      C: { color: 'status.renamed' },
    },
  },
})
