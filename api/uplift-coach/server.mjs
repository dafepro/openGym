import http from 'node:http'
import { Readable } from 'node:stream'
import { counters, createCoach } from './service.mjs'
const handler = createCoach(process.env, counters('/data/quota.sqlite'))
const server = http.createServer(
  { maxHeaderSize: 16384, requestTimeout: 20000, headersTimeout: 10000 },
  async (req, res) => {
    try {
      const controller = new AbortController()
      req.setTimeout(15000, () => {
        if (!req.complete) req.destroy()
      })
      const init = { method: req.method, headers: req.headers, signal: controller.signal }
      if (req.method === 'POST') Object.assign(init, { body: Readable.toWeb(req), duplex: 'half' })
      const response = await handler(new Request('http://localhost' + req.url, init))
      res.writeHead(response.status, Object.fromEntries(response.headers))
      res.end(Buffer.from(await response.arrayBuffer()))
    } catch {
      res.writeHead(400, { 'cache-control': 'no-store' })
      res.end()
    }
  }
)
server.maxConnections = 24
server.listen(8787, '0.0.0.0')
