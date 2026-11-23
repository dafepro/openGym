import http from 'node:http'
import { Readable } from 'node:stream'

export function createCoachServer(handler) {
  // Node limits incoming headers and body here. The provider has its own reply deadline.
  const server = http.createServer(
    { maxHeaderSize: 16384, requestTimeout: 20000, headersTimeout: 10000, connectionsCheckingInterval: 1000 },
    async (req, res) => {
      try {
        const init = { method: req.method, headers: req.headers }
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
  return server
}
