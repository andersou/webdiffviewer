// langFor picks the Shiki language for a file: exact file names first (Dockerfile, Makefile),
// then the longest dotted extension ("app.component.html" tries "component.html", then "html").
// ids maps every language id and alias to its id (see shiki.js); unknown files return null.

const NAMES = {
  dockerfile: 'docker',
  containerfile: 'docker',
  makefile: 'make',
  'cmakelists.txt': 'cmake',
  gemfile: 'ruby',
  rakefile: 'ruby',
  jenkinsfile: 'groovy',
  '.bashrc': 'shellscript',
  '.zshrc': 'shellscript',
  '.env': 'dotenv',
}

// extensions Shiki has no alias for
const EXTENSIONS = {
  'component.html': 'angular-html',
  'component.ts': 'angular-ts',
  h: 'c',
  hpp: 'cpp',
  hh: 'cpp',
  cc: 'cpp',
  env: 'dotenv',
  ex: 'elixir',
  exs: 'elixir',
  gradle: 'groovy',
  pl: 'perl',
  sol: 'solidity',
  svg: 'xml',
}

export function langFor(path, ids) {
  const name = path.split('/').pop().toLowerCase()
  if (NAMES[name]) return NAMES[name]
  for (let i = name.indexOf('.'); i !== -1; i = name.indexOf('.', i + 1)) {
    const ext = name.slice(i + 1)
    const id = EXTENSIONS[ext] ?? ids.get(ext)
    if (id) return id
  }
  return null
}
