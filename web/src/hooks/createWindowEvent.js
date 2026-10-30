import { onCleanup } from 'solid-js'

// createWindowEvent listens on window for as long as the calling component lives.
export function createWindowEvent(type, handler) {
  window.addEventListener(type, handler)
  onCleanup(() => window.removeEventListener(type, handler))
}
