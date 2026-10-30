import { For } from 'solid-js'
import { css } from 'styled-system/css'

// px; taller rows on phones for touch. Read once: the SVG is drawn at this exact height (no stretching).
export const ROW = matchMedia('(width < 48rem)').matches ? 34 : 26
export const MAX_LANES = 6 // wider graphs are clipped so the sidebar keeps room for the message
const LANE = 12 // px between lanes
const PAD = 6 // px left of the first lane, so its dot isn't clipped
const COLORS = ['#4fc1ff', '#c586c0', '#dcdcaa', '#4ec9b0', '#ce9178', '#9cdcfe', '#d16969', '#b5cea8']
const color = (lane) => COLORS[lane % COLORS.length]

const svgCls = css({ flex: 'none', display: 'block' })

// CommitGraph draws one row of the lane graph (a row from lib/git/graph.js) as SVG.
export default function CommitGraph(props) {
  const x = (lane) => PAD + lane * LANE + LANE / 2
  const path = ([x1, y1, x2, y2]) => {
    const [ax, ay, bx, by] = [x(x1), y1 * ROW, x(x2), y2 * ROW]
    // forks/merges bend in the half-row they cross; straight lanes are plain lines
    return ax === bx ? `M${ax} ${ay}V${by}` : `M${ax} ${ay}C${ax} ${(ay + by) / 2} ${bx} ${(ay + by) / 2} ${bx} ${by}`
  }
  return (
    <svg class={svgCls} width={PAD + props.width * LANE + 4} height={ROW} aria-hidden="true">
      <For each={props.row.segs}>{(s) => <path d={path(s)} stroke={color(s[4])} stroke-width="2" fill="none" />}</For>
      <circle cx={x(props.row.col)} cy={ROW / 2} r={props.merge ? 3 : 4} fill={props.merge ? '#1e1e1e' : color(props.row.col)} stroke={color(props.row.col)} stroke-width="2" />
    </svg>
  )
}
