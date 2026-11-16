import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runInNewContext } from 'node:vm'
import { offlineWorker } from './offline-shell.mjs'

function worker({
  failInstall = false,
  network = () => {
    throw Error('offline')
  }
} = {}) {
  const handlers = {},
    deleted = [],
    fetched = []
  const cache = {
    addAll: async (paths) => {
      fetched.push(...paths.map((p) => p.url))
      if (failInstall) throw Error('offline')
    },
    match: async (path) => new Response(`cached:${path}`)
  }
  const self = {
    registration: {
      unregister: async () => {
        self.retired = true
      }
    },
    location: { origin: 'https://train.example' },
    addEventListener: (name, handler) => {
      handlers[name] = handler
    }
  }
  class RelativeRequest extends Request {
    constructor(path, options) {
      super(new URL(path, self.location.origin), options)
    }
  }
  runInNewContext(offlineWorker(['/index.html', '/assets/app.js'], 'new'), {
    self,
    URL,
    Request: RelativeRequest,
    fetch: network,
    AbortController,
    setTimeout,
    clearTimeout,
    caches: {
      open: async () => cache,
      keys: async () => ['quicktrack-training-shell-old', 'quicktrack-training-shell-new', 'other-app'],
      delete: async (key) => deleted.push(key)
    }
  })
  return { handlers, deleted, fetched, self }
}
test('online navigation honors deployment rollback and retires only obsolete shell caches', async () => {
  const w = worker({
    network: async (request) =>
      request === '/sw.js' ? new Response('', { status: 404 }) : new Response('deployed rollback')
  })
  let response, cleanup
  w.handlers.fetch({
    request: new Request('https://train.example/'),
    respondWith: (p) => {
      response = p
    },
    waitUntil: (p) => {
      cleanup = p
    }
  })
  assert.equal(await (await response).text(), 'deployed rollback')
  await cleanup
  assert.equal(w.self.retired, true)
  assert.deepEqual(w.deleted, ['quicktrack-training-shell-old', 'quicktrack-training-shell-new'])
})
test('temporary script endpoint failure does not retire a valid offline shell', async () => {
  const w = worker({
    network: async (request) =>
      request === '/sw.js' ? new Response('', { status: 503 }) : new Response('deployed app')
  })
  let response, cleanup
  w.handlers.fetch({
    request: new Request('https://train.example/'),
    respondWith: (p) => {
      response = p
    },
    waitUntil: (p) => {
      cleanup = p
    }
  })
  await response
  await cleanup
  assert.equal(w.self.retired, undefined)
  assert.deepEqual(w.deleted, [])
})
test('installs a complete shell, keeps other app caches, and never forces an update', async () => {
  const w = worker()
  let promise
  w.handlers.install({
    waitUntil: (p) => {
      promise = p
    }
  })
  await promise
  assert.equal(w.fetched.length, 2)
  w.handlers.activate({
    waitUntil: (p) => {
      promise = p
    }
  })
  await promise
  assert.deepEqual(w.deleted, ['quicktrack-training-shell-old'])
  assert.equal(w.handlers.message, undefined)
})
test('failed installation removes only the incomplete new shell', async () => {
  const w = worker({ failInstall: true })
  let promise
  w.handlers.install({
    waitUntil: (p) => {
      promise = p
    }
  })
  await assert.rejects(promise, /offline/)
  assert.deepEqual(w.deleted, ['quicktrack-training-shell-new'])
})
test('offline navigation uses the exact cached shell and never intercepts private APIs or media', async () => {
  const w = worker()
  let response
  w.handlers.fetch({
    request: new Request('https://train.example/'),
    respondWith: (p) => {
      response = p
    }
  })
  assert.equal(await (await response).text(), 'cached:/index.html')
  for (const path of [
    '/api/catalog',
    '/api/player/login',
    '/api/player/assignments',
    '/api/coach/assignments',
    '/media/video',
    '/?token=private',
    '/unknown'
  ]) {
    w.handlers.fetch({
      request: new Request(`https://train.example${path}`),
      respondWith() {
        assert.fail(`Intercepted ${path}`)
      }
    })
  }
  w.handlers.fetch({
    request: new Request('https://other.example/assets/app.js'),
    respondWith() {
      assert.fail('Cross-origin cache')
    }
  })
  w.handlers.fetch({
    request: new Request('https://train.example/', { method: 'POST' }),
    respondWith() {
      assert.fail('Mutation cached')
    }
  })
})
