import assert from 'node:assert/strict'
import test from 'node:test'
import { sourceNotice, sourceNoticePlugin } from './source-notice.mjs'

test('release notice binds both source links to the exact immutable revision', () => {
  const sha = 'a'.repeat(40)
  const notice = sourceNotice(sha)
  assert.ok(notice.includes(`/tree/${sha}/training`))
  assert.ok(notice.includes(`/archive/${sha}.tar.gz`))
  assert.ok(notice.includes('/licenses/AGPL-3.0.txt'))
  let emitted
  sourceNoticePlugin(sha).generateBundle.call({ emitFile(asset) { emitted = asset } })
  assert.deepEqual(emitted, { type: 'asset', fileName: 'source.html', source: notice })
})

test('invalid environment input cannot inject markup into the source notice', () => {
  const notice = sourceNotice('<script>unsafe</script>')
  assert.ok(!notice.includes('<script>'))
  assert.ok(notice.includes('/tree/codex/quicktrack-training/training'))
})
