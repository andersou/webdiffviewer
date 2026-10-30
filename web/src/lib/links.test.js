import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolvePath } from './links.js'

test('resolvePath', () => {
  assert.equal(resolvePath('docs/a/README.md', 'img/x.png'), 'docs/a/img/x.png')
  assert.equal(resolvePath('docs/a/README.md', '../b.md#sec'), 'docs/b.md')
  assert.equal(resolvePath('docs/a/README.md', '/top.md'), 'top.md')
  assert.equal(resolvePath('docs/a/README.md', 'my%20file.md'), 'docs/a/my file.md')
  assert.equal(resolvePath('README.md', '../../etc/passwd'), null)
  assert.equal(resolvePath('README.md', 'https://x.com/a.png'), null)
  assert.equal(resolvePath('README.md', 'javascript:alert(1)'), null)
  assert.equal(resolvePath('README.md', '#anchor'), null)
  assert.equal(resolvePath('README.md', '%E0%A4%A'), null)
})
