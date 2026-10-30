import { createReadStream, existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { dirname, extname, isAbsolute, relative, resolve } from 'node:path'
import { validateCatalog } from '../src/domain/content.js'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])
const LOCAL_PEERS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])
const fail = message => { throw new Error(`Private training preview: ${message}`) }
const object = (value, fields) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => fields.includes(key))
const inside = (parent, child) => { const path = relative(parent, child); return path !== '..' && !path.startsWith('../') && !isAbsolute(path) }
function outsideGit(path) {
  for (let directory = dirname(path); ; directory = dirname(directory)) {
    if (existsSync(resolve(directory, '.git'))) fail('bundle files must remain outside Git checkouts')
    if (dirname(directory) === directory) return
  }
}
function privateFile(directory, file, extension) {
  if (typeof file !== 'string' || !file || isAbsolute(file)) fail('manifest files must use relative contained paths')
  const target = realpathSync(resolve(directory, file))
  if (!inside(directory, target)) fail('a manifest file escapes its bundle directory')
  outsideGit(target)
  const stat = statSync(target)
  if (!stat.isFile() || !stat.size || extension && extname(target).toLowerCase() !== extension) fail('a manifest file has an unsupported type')
  return { path: target, size: stat.size }
}
export function loadPrivatePreview(path) {
  try {
    if (!isAbsolute(path)) fail('TRAINING_PREVIEW_BUNDLE must be an absolute manifest path')
    outsideGit(path)
    const manifestPath = realpathSync(path)
    outsideGit(manifestPath)
    const directory = dirname(manifestPath)
    if (statSync(manifestPath).size > 1024 * 1024) fail('manifest is too large')
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    if (!object(manifest, ['schemaVersion', 'catalogFile', 'media']) || manifest.schemaVersion !== 1 || !Array.isArray(manifest.media) || manifest.media.length > 1000) fail('unsupported manifest')
    const catalogFile = privateFile(directory, manifest.catalogFile, '.json')
    if (catalogFile.size > 10 * 1024 * 1024) fail('catalog is too large')
    const catalog = validateCatalog(JSON.parse(readFileSync(catalogFile.path, 'utf8')))
    const approved = new Set(catalog.assignments.flatMap(assignment => assignment.drills.filter(drill => drill.media.status === 'approved').map(drill => drill.media.id)))
    const media = new Map()
    for (const entry of manifest.media) {
      if (!object(entry, ['id', 'file']) || typeof entry.id !== 'string' || !approved.has(entry.id) || media.has(entry.id)) fail('media must exactly match approved catalog identities')
      media.set(entry.id, privateFile(directory, entry.file, '.mp4'))
    }
    if (media.size !== approved.size) fail('an approved catalog video is missing from the manifest')
    return { catalog, media }
  } catch (error) {
    if (error.message.startsWith('Private training preview:')) throw error
    // Filesystem/JSON/schema diagnostics can include private paths or content. Keep startup output generic.
    fail('bundle could not be validated; check its files and child-safe schema locally')
  }
}
export function assertPrivatePreviewMode({ bundlePath, command, isPreview = false, demo = false }) {
  if (!bundlePath) return
  if (command !== 'serve' || isPreview) fail('private bundles are development-only and cannot enter a build or static preview')
  if (demo) fail('select either the synthetic demo or a private preview bundle')
}
function localRequest(req) {
  if (!LOCAL_PEERS.has(req.socket.remoteAddress)) return false
  try {
    const target = new URL(`http://${req.headers.host}`)
    if (!LOCAL_HOSTS.has(target.hostname) || target.username || target.password) return false
    if (req.headers.origin && new URL(req.headers.origin).origin !== target.origin) return false
    return !req.headers['sec-fetch-site'] || ['same-origin', 'none'].includes(req.headers['sec-fetch-site'])
  } catch { return false }
}
function rangeOf(value, size) {
  if (!value) return { start: 0, end: size - 1 }
  const match = /^bytes=(\d*)-(\d*)$/.exec(value)
  if (!match || !match[1] && !match[2]) return null
  const suffix = !match[1]
  const first = Number(suffix ? match[2] : match[1])
  if (!Number.isSafeInteger(first) || suffix && first === 0) return null
  const start = suffix ? Math.max(0, size - first) : first
  const requestedEnd = match[1] && match[2] ? Number(match[2]) : size - 1
  const end = Math.min(requestedEnd, size - 1)
  return Number.isSafeInteger(requestedEnd) && start <= end && start < size ? { start, end } : null
}
export function privatePreviewMiddleware(bundle) {
  const catalog = Buffer.from(JSON.stringify(bundle.catalog))
  return (req, res, next) => {
    const path = req.url?.split('?')[0]
    if (path !== '/__training-preview/catalog' && !path?.startsWith('/media/')) return next()
    const base = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'same-origin' }
    if (!localRequest(req)) { res.writeHead(403, base); return res.end() }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { ...base, Allow: 'GET, HEAD' }); return res.end() }
    if (path === '/__training-preview/catalog') {
      res.writeHead(200, { ...base, 'Content-Type': 'application/json', 'Content-Length': catalog.length })
      return res.end(req.method === 'HEAD' ? undefined : catalog)
    }
    const entry = bundle.media.get(path.slice('/media/'.length))
    if (!entry) { res.writeHead(404, base); return res.end() }
    const headers = { ...base, 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes' }
    const range = rangeOf(req.headers.range, entry.size)
    if (!range) { res.writeHead(416, { ...headers, 'Content-Range': `bytes */${entry.size}` }); return res.end() }
    if (req.headers.range) headers['Content-Range'] = `bytes ${range.start}-${range.end}/${entry.size}`
    res.writeHead(req.headers.range ? 206 : 200, { ...headers, 'Content-Length': range.end - range.start + 1 })
    if (req.method === 'HEAD') return res.end()
    const stream = createReadStream(entry.path, range)
    stream.on('error', () => res.destroy())
    res.on('close', () => stream.destroy())
    stream.pipe(res)
  }
}
export function privateTrainingPreview(bundlePath) {
  const bundle = loadPrivatePreview(bundlePath)
  return {
    name: 'explicit-private-local-preview',
    apply: 'serve',
    configureServer(server) {
      if (!['127.0.0.1', 'localhost', '::1'].includes(server.config.server.host)) fail('development server must bind a loopback host')
      server.middlewares.use(privatePreviewMiddleware(bundle))
    },
  }
}
