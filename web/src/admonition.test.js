import assert from 'node:assert/strict'
import { test } from 'node:test'
import MarkdownIt from 'markdown-it'
import admonition from './admonition.js'

const md = new MarkdownIt().use(admonition)
const clean = (s) => s.replace(/\n/g, '')

test('indented body ends at the first unindented line', () => {
  assert.equal(
    clean(md.render('!!! tip Dica\n    corpo **forte**\n\n    - item\n\ndepois')),
    '<div class="admonition tip"><p class="admonition-title">Dica</p><p>corpo <strong>forte</strong></p><ul><li>item</li></ul></div><p>depois</p>',
  )
})

test('quoted, default and empty titles', () => {
  assert.match(md.render('!!! note "Olá mundo"\n    x'), /<p class="admonition-title">Olá mundo<\/p>/)
  assert.match(md.render('!!! warning\n    x'), /<p class="admonition-title">Warning<\/p>/)
  assert.doesNotMatch(md.render('!!! note ""\n    x'), /admonition-title/)
})

test('collapsible ??? and ???+', () => {
  assert.equal(clean(md.render('??? info Mais\n    oculto')), '<details class="admonition info"><summary class="admonition-title">Mais</summary><p>oculto</p></details>')
  assert.match(md.render('???+ info\n    x'), /<details class="admonition info" open="">/)
})
