import { createEffect, createSignal, Show } from 'solid-js'
import { css } from 'styled-system/css'
import { rawUrl } from '../lib/api/client.js'
import { isVideo } from '../lib/utils/url.js'
import { errorBox } from './ui/styles.js'

// checkerboard behind the media so transparent images show their edges
const box = css({
  flex: 1,
  minH: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  p: '16px',
  overflow: 'auto',
  bgImage: 'conic-gradient(#2b2b2b 25%, #353535 0 50%, #2b2b2b 0 75%, #353535 0)',
  bgSize: '16px 16px',
})
const media = css({ maxW: '100%', maxH: '100%', objectFit: 'contain' })

// MediaPreview shows a repo image, SVG or video (at props.rev). SVG loads as an <img>, so its
// scripts never run.
export default function MediaPreview(props) {
  const [failed, setFailed] = createSignal(false)
  createEffect(() => (props.path, props.rev, setFailed(false)))
  // images reload on refresh (props.tick) to show edits; a video would restart, so it doesn't
  const src = () => rawUrl(props.repo, props.path, props.rev) + (isVideo(props.path) ? '' : `&t=${props.tick || 0}`)
  return (
    <Show when={!failed()} fallback={<div class={errorBox}>Cannot load {props.path}</div>}>
      <div class={box}>
        <Show when={isVideo(props.path)} fallback={<img class={media} src={src()} alt={props.path} onError={() => setFailed(true)} />}>
          <video class={media} src={src()} controls onError={() => setFailed(true)} />
        </Show>
      </div>
    </Show>
  )
}
