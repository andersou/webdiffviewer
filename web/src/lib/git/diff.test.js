import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseDiff } from './diff.js'

test('parseDiff numbers both sides and drops the file header', () => {
  const src = 'diff --git a/x b/x\nindex 1..2 100644\n--- a/x\n+++ b/x\n@@ -3,3 +3,3 @@ fn\n a\n-b\n+B\n\\ No newline at end of file\n'
  assert.deepEqual(parseDiff(src), [
    { t: 'hunk', text: '@@ -3,3 +3,3 @@ fn' },
    { t: 'ctx', o: 3, n: 3, text: 'a' },
    { t: 'del', o: 4, text: 'b' },
    { t: 'add', n: 4, text: 'B' },
    { t: 'hunk', text: '\\ No newline at end of file' },
  ])
})

test('parseDiff returns no rows for binary or mode-only diffs', () => {
  assert.deepEqual(parseDiff('diff --git a/x b/x\nBinary files a/x and b/x differ\n'), [])
})
