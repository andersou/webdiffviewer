import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fmTable, splitFrontmatter } from './frontmatter.js'

test('splitFrontmatter', () => {
  assert.deepEqual(splitFrontmatter('---\ntitle: a\n---\n# B'), ['title: a', '# B'])
  assert.deepEqual(splitFrontmatter('---\n---\nx'), ['', 'x'])
  assert.deepEqual(splitFrontmatter('# no fm\n---\n'), [null, '# no fm\n---\n'])
})

test('fmTable nests and escapes', () => {
  assert.equal(
    fmTable({ t: '<b>', tags: ['a', 1], o: { k: null } }),
    '<table class="fm"><tbody><tr><th>t</th><td>&lt;b&gt;</td></tr><tr><th>tags</th><td><ul class="fm-list"><li>a</li><li>1</li></ul></td></tr><tr><th>o</th><td><table class="fm"><tbody><tr><th>k</th><td><span class="fm-null">null</span></td></tr></tbody></table></td></tr></tbody></table>',
  )
})
