import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { iconRules } from './iconRules.js'

const manifest = JSON.parse(readFileSync('node_modules/material-icon-theme/dist/material-icons.json', 'utf8'))
const { fileIcon, folderIcon } = iconRules(manifest)

test('files: exact name, longest extension, default', () => {
  assert.equal(fileIcon('package.json'), '/icons/nodejs.svg')
  assert.equal(fileIcon('Dockerfile'), '/icons/docker.svg')
  assert.equal(fileIcon('main.go'), '/icons/go.svg')
  assert.equal(fileIcon('App.test.ts'), `/icons/${manifest.fileExtensions['test.ts']}.svg`)
  assert.equal(fileIcon('no-extension-here'), '/icons/file.svg')
  assert.equal(fileIcon('PKGBUILD'), fileIcon('pkgbuild')) // case-insensitive like VS Code
  assert.equal(fileIcon('repo/.config/graphqlrc'), `/icons/${manifest.fileNames['.config/graphqlrc']}.svg`) // parent/name key
})

test('folders: named, open variant, default', () => {
  assert.equal(folderIcon('src', false), '/icons/folder-src.svg')
  assert.equal(folderIcon('SRC', true), '/icons/folder-src-open.svg')
  assert.equal(folderIcon('whatever', true), '/icons/folder-open.svg')
  assert.equal(folderIcon('repo/.github/workflows', false), `/icons/${manifest.folderNames['.github/workflows']}.svg`)
  for (const [name, icon] of Object.entries(manifest.folderNamesExpanded)) assert.equal(folderIcon(name, true), `/icons/${icon}.svg`)
})

test('every resolved icon exists after copy-icons', { skip: !existsSync('public/icons') }, () => {
  const icons = new Set([...Object.values(manifest.fileNames), ...Object.values(manifest.fileExtensions), ...Object.values(manifest.folderNamesExpanded), ...Object.values(manifest.folderNames), 'file', 'folder', 'folder-open'])
  for (const icon of icons) assert.ok(existsSync(`public/icons/${icon}.svg`), icon)
})
