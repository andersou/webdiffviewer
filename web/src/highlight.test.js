import assert from 'node:assert/strict'
import { test } from 'node:test'
import { splitLines } from './highlight.js'

test('splitLines balances spans across newlines', () => {
  const html = 'a <span class="c">/* x\ny */</span> b\n<span class="s">"q"</span>'
  assert.deepEqual(splitLines(html), [
    'a <span class="c">/* x</span>',
    '<span class="c">y */</span> b',
    '<span class="s">"q"</span>',
  ])
})
