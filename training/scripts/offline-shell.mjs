import { createHash } from 'node:crypto'

export function offlineWorker(paths, version) {
  return `const CACHE = ${JSON.stringify(`quicktrack-training-shell-${version}`)};
const PATHS = ${JSON.stringify(paths)};
async function retireIfRemoved() {
  const abort = new AbortController(), timeout = setTimeout(() => abort.abort(), 3000);
  try {
    const response = await fetch('/sw.js', { cache: 'no-store', credentials: 'omit', signal: abort.signal });
    if (response.status === 404 || response.status === 410) {
      await self.registration.unregister();
      await Promise.all((await caches.keys()).filter(key => key.startsWith('quicktrack-training-shell-')).map(key => caches.delete(key)));
    }
  } catch { /* A connection failure is not evidence of a rollback. */ }
  finally { clearTimeout(timeout); }
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try {
      await cache.addAll(PATHS.map(path => new Request(path, { cache: 'reload', credentials: 'omit' })));
    } catch (error) { await caches.delete(CACHE); throw error; }
  })());
});
// No skipWaiting or clients.claim: an update never replaces an open practice.
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('quicktrack-training-shell-') && key !== CACHE).map(key => caches.delete(key)))));
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  const path = url.pathname === '/' ? '/index.html' : url.pathname;
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.search || !PATHS.includes(path)) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    if (path === '/index.html') {
      const abort = new AbortController(), timeout = setTimeout(() => abort.abort(), 3000);
      try {
        const response = await fetch(request, { signal: abort.signal });
        if (response.ok && !response.redirected) { event.waitUntil(retireIfRemoved()); return response; }
      } catch { /* Reopen the complete last-installed shell when the network fails. */ }
      finally { clearTimeout(timeout); }
    }
    return (await cache.match(path)) || fetch(request);
  }));
});
`
}

export function offlineShellPlugin(enabled) {
  return {
    name: 'training-offline-shell',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      if (!enabled) return
      const entries = Object.entries(bundle).filter(
        ([name]) =>
          name === 'index.html' ||
          name === 'source.html' ||
          /^assets\/[a-zA-Z0-9_-]+\.(js|css|woff2|svg|png)$/.test(name)
      )
      const paths = [
        ...entries.map(([name]) => `/${name}`),
        '/fonts/barlow-condensed-latin-600.woff2',
        '/fonts/OFL.txt',
        '/licenses/AGPL-3.0.txt'
      ].sort()
      const hash = createHash('sha256').update(offlineWorker.toString())
      for (const [name, entry] of entries.sort(([a], [b]) => a.localeCompare(b)))
        hash.update(name).update(entry.type === 'chunk' ? entry.code : entry.source)
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: offlineWorker(paths, hash.digest('hex').slice(0, 20)) })
    }
  }
}
