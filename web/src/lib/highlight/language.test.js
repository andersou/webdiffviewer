import assert from 'node:assert/strict'
import { test } from 'node:test'
import { bundledLanguagesInfo } from 'shiki/langs'
import { langFor } from './language.js'

const ids = new Map(bundledLanguagesInfo.flatMap((l) => [[l.id, l.id], ...(l.aliases ?? []).map((a) => [a, l.id])]))
const known = new Set(bundledLanguagesInfo.map((l) => l.id))

test('langFor resolves frameworks, names and extensions to real Shiki languages', () => {
  const cases = {
    'src/App.vue': 'vue',
    'app/home/home.component.html': 'angular-html',
    'app/home/home.component.ts': 'angular-ts',
    'src/routes/+page.svelte': 'svelte',
    'src/pages/index.astro': 'astro',
    'docs/intro.mdx': 'mdx',
    'types/env.d.ts': 'typescript',
    'web/App.test.jsx': 'jsx',
    'Dockerfile': 'docker',
    'Makefile': 'make',
    'main.go': 'go',
    'infra/main.tf': 'terraform',
    'schema.prisma': 'prisma',
    '.env': 'dotenv',
    'native/lib.h': 'c',
    'ci.yml': 'yaml',
    'README.md': 'markdown',
  }
  for (const [path, lang] of Object.entries(cases)) {
    assert.equal(langFor(path, ids), lang, path)
    assert.ok(known.has(lang), `${lang} must be a bundled Shiki language`)
  }
  assert.equal(langFor('LICENSE', ids), null)
  assert.equal(langFor('notes.unknownext', ids), null)
})
