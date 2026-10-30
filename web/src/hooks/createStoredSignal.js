import { createSignal } from 'solid-js'

// createStoredSignal is a signal remembered in localStorage. Booleans are stored as "1"/"0",
// strings as-is (the formats earlier versions used, so saved preferences keep working).
// The third value sets without saving (a value from a link must not change the preference).
export function createStoredSignal(key, fallback) {
  const bool = typeof fallback === 'boolean'
  const raw = localStorage.getItem(key)
  const [get, set] = createSignal(raw === null ? fallback : bool ? raw === '1' : raw)
  const store = (value) => {
    const next = typeof value === 'function' ? value(get()) : value
    localStorage.setItem(key, bool ? (next ? '1' : '0') : next)
    set(() => next)
  }
  return [get, store, set]
}
