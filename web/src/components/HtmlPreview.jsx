import { createResource, Show } from 'solid-js'
import { css } from 'styled-system/css'
import { text } from '../lib/api/client.js'
import { resolvePath } from '../lib/utils/links.js'
import { errorBox } from './ui/styles.js'

const frame = css({ flex: 1, minH: 0, w: '100%', border: 0, bg: '#fff' })
// attributes that load a file; relative ones are pointed at /api/raw so the page's images and CSS show
const ASSETS = [['img', 'src'], ['source', 'src'], ['video', 'src'], ['video', 'poster'], ['audio', 'src'], ['link', 'href']]

// page prepares the repo HTML file `path` for the frame: repo-relative assets load from /api/raw and
// links open in a new tab (inside the frame they would point nowhere).
function page(src, repo, path) {
  const doc = new DOMParser().parseFromString(src, 'text/html')
  for (const [tag, attr] of ASSETS) {
    for (const el of doc.querySelectorAll(`${tag}[${attr}]`)) {
      const p = resolvePath(path, el.getAttribute(attr))
      if (p) el.setAttribute(attr, `/api/raw?${new URLSearchParams({ repo, path: p })}`)
    }
  }
  doc.head.prepend(Object.assign(doc.createElement('base'), { target: '_blank' }))
  return '<!doctype html>' + doc.documentElement.outerHTML
}

// HtmlPreview renders a repo HTML file (at props.rev). Repo HTML is untrusted, so the frame is
// sandboxed: no scripts, no forms, and an opaque origin that can't reach this app or its API.
export default function HtmlPreview(props) {
  const [html] = createResource(
    () => [props.repo, props.path, props.tick, props.rev],
    ([repo, path, , rev]) => text('file', { repo, path, rev }).then((src) => page(src, repo, path)),
  )
  return (
    <Show when={!html.error} fallback={<div class={errorBox}>{html.error?.message}</div>}>
      <iframe class={frame} title={`Preview of ${props.path}`} sandbox="allow-popups allow-popups-to-escape-sandbox" srcdoc={html.latest || ''} />
    </Show>
  )
}
