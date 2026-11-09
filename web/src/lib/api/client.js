export async function api(path, params = {}, init) {
  const r = await fetch(`/api/${path}?${new URLSearchParams(params)}`, init)
  if (!r.ok) throw new Error(await r.text())
  return r
}

export const json = (path, params) => api(path, params).then((r) => r.json())
export const text = (path, params) => api(path, params).then((r) => r.text())
// rawUrl is a repo file served as-is, at rev (the working tree when empty)
export const rawUrl = (repo, path, rev) => `/api/raw?${new URLSearchParams(rev ? { repo, path, rev } : { repo, path })}`
