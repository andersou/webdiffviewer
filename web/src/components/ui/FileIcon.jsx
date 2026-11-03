import { createSignal, Show } from 'solid-js'
import { css } from 'styled-system/css'

const box = css({ w: '16px', h: '16px', flex: 'none', '& img': { w: '16px', h: '16px' } })

// icon map + SVG URLs load in the background; rows render without icons until then
const [icons, setIcons] = createSignal()
import('../../lib/icons/icons.js').then(setIcons)

// FileIcon is a file's (or, with folder, a folder's) Material icon, sized for list rows.
export default function FileIcon(props) {
  return (
    <span class={box}>
      <Show when={icons()}>{(m) => <img src={props.folder ? m().folderIcon(props.path, props.open) : m().fileIcon(props.path)} alt="" />}</Show>
    </span>
  )
}
