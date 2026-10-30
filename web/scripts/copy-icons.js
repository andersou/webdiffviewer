// Copies Material Icon Theme SVGs to public/icons/<icon>.svg so the UI can build URLs
// from icon names alone (no URL table in the bundle). Runs on npm install (prepare).
import { cpSync, readdirSync, renameSync, rmSync } from 'node:fs'

const src = 'node_modules/material-icon-theme/icons'
const dst = 'public/icons'
rmSync(dst, { recursive: true, force: true })
cpSync(src, dst, { recursive: true })
// a few icons ship only as "<name>.clone.svg"; none collide with a plain "<name>.svg"
for (const f of readdirSync(dst)) if (f.endsWith('.clone.svg')) renameSync(`${dst}/${f}`, `${dst}/${f.replace('.clone.svg', '.svg')}`)
