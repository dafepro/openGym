import { readFileSync } from 'node:fs'

// Original generated test pattern. This plugin is absent unless demo mode was
// explicitly selected at build/server startup; the fixture is never public/.
export function demoMedia() {
  const bytes = readFileSync(new URL('../fixtures/media/playback-test.mp4', import.meta.url))
  const serve = (req, res, next) => {
    if (req.url?.split('?')[0] !== '/media/sample-playback') return next()
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }); return res.end() }
    const headers = { 'Content-Type': 'video/mp4', 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes' }
    let start = 0
    let end = bytes.length - 1
    const range = req.headers.range
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range)
      if (match && (match[1] || match[2])) {
        start = match[1] ? Number(match[1]) : Math.max(0, bytes.length - Number(match[2]))
        end = match[1] && match[2] ? Math.min(Number(match[2]), bytes.length - 1) : bytes.length - 1
      } else start = bytes.length
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= bytes.length) {
        res.writeHead(416, { ...headers, 'Content-Range': `bytes */${bytes.length}` }); return res.end()
      }
      headers['Content-Range'] = `bytes ${start}-${end}/${bytes.length}`
    }
    headers['Content-Length'] = end - start + 1
    res.writeHead(range ? 206 : 200, headers)
    res.end(req.method === 'HEAD' ? undefined : bytes.subarray(start, end + 1))
  }
  return {
    name: 'explicit-demo-media',
    configureServer(server) { server.middlewares.use(serve) },
    configurePreviewServer(server) { server.middlewares.use(serve) },
    generateBundle() { this.emitFile({ type: 'asset', fileName: 'media/sample-playback', source: bytes }) }
  }
}
