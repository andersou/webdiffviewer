// iconRules resolves Material Icon Theme names the way VS Code does, case-insensitively:
// "parent/name" keys first (e.g. .github/workflows), then the exact name, then (files) the
// longest dotted extension, then the default. Pure, so it can be tested against the real manifest.
export function iconRules({ fileNames, fileExtensions, folderNames }) {
  const lower = (map) => Object.fromEntries(Object.entries(map).map(([k, v]) => [k.toLowerCase(), v]))
  const files = lower(fileNames)
  const exts = lower(fileExtensions)
  const folders = lower(folderNames)
  const url = (icon) => `/icons/${icon}.svg`
  // path "a/b/c" -> ["b/c", "c"]
  const keys = (path) => {
    const parts = path.toLowerCase().split('/')
    return parts.length > 1 ? [parts.slice(-2).join('/'), parts.at(-1)] : parts
  }
  return {
    fileIcon(path) {
      for (const k of keys(path)) if (files[k]) return url(files[k])
      const name = path.toLowerCase().split('/').pop()
      // "a.spec.ts" tries "spec.ts", then "ts"
      for (let i = name.indexOf('.'); i !== -1; i = name.indexOf('.', i + 1)) {
        const icon = exts[name.slice(i + 1)]
        if (icon) return url(icon)
      }
      return url('file')
    },
    // open folders always use the closed icon + "-open" in this theme (checked against folderNamesExpanded)
    folderIcon(path, open) {
      const icon = keys(path).map((k) => folders[k]).find(Boolean) ?? 'folder'
      return url(icon + (open ? '-open' : ''))
    },
  }
}
