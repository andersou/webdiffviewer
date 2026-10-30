export async function api(path, params = {}, init) {
  const r = await fetch(`/api/${path}?${new URLSearchParams(params)}`, init)
  if (!r.ok) throw new Error(await r.text())
  return r
}

export const json = (path, params) => api(path, params).then((r) => r.json())
export const text = (path, params) => api(path, params).then((r) => r.text())
