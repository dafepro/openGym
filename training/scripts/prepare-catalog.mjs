import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { access, chmod, copyFile, mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { validateCatalog } from '../src/domain/content.js'

const MAX_INPUT = 2 * 1024 * 1024
const MAX_MEDIA = 2 * 1024 * 1024 * 1024
async function outsideRepository(path) {
  let cursor = await realpath(path)
  if (!(await stat(cursor)).isDirectory()) cursor = dirname(cursor)
  for (;;) {
    try { await access(join(cursor, '.git')); throw new Error('Private input and output must stay outside Git checkouts') }
    catch (error) { if (error.code !== 'ENOENT') throw error }
    const parent = dirname(cursor)
    if (parent === cursor) break
    cursor = parent
  }
}
async function hashFile(path) {
  const hash = createHash('sha256')
  for await (const bytes of createReadStream(path)) hash.update(bytes)
  return hash.digest('hex')
}
function probe(path) {
  let data
  try {
    data = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', path], { encoding: 'utf8', maxBuffer: MAX_INPUT, timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'] }))
  } catch { throw new Error('Media inspection failed; install FFmpeg/ffprobe and supply a valid MP4') }
  const streams = data.streams || []
  const video = streams.filter(item => item.codec_type === 'video')
  if (!data.format?.format_name?.split(',').includes('mp4') || video.length !== 1 || video[0].codec_name !== 'h264' || video[0].pix_fmt !== 'yuv420p' || streams.some(item => item.codec_type === 'audio' && item.codec_name !== 'aac') || streams.some(item => !['video', 'audio'].includes(item.codec_type))) {
    throw new Error('Media needs one H.264/yuv420p video stream and optional AAC audio in MP4; prepare a compatible derivative')
  }
  const durationSec = Number(data.format.duration)
  if (!(durationSec > 0) || !Number.isFinite(durationSec)) throw new Error('Media duration is invalid')
  return { durationSec, width: video[0].width, height: video[0].height }
}
export async function prepareCatalog(inputPath, outputPath) {
  const input = await realpath(resolve(inputPath))
  const output = resolve(outputPath)
  await outsideRepository(input)
  await outsideRepository(dirname(output))
  if ((await stat(input)).size > MAX_INPUT) throw new Error('Private input exceeds 2 MiB')
  const data = JSON.parse(await readFile(input, 'utf8'))
  const catalog = validateCatalog(data.catalog)
  if (!Array.isArray(data.media)) throw new Error('Private input needs a media inventory')
  const approved = new Set(catalog.assignments.flatMap(a => a.drills.filter(d => d.media.status === 'approved').map(d => d.media.id)))
  if (data.media.length !== approved.size || new Set(data.media.map(item => item.id)).size !== data.media.length || data.media.some(item => !approved.has(item.id))) throw new Error('Inventory must contain each approved catalog media ID exactly once')
  const sources = []
  for (const media of data.media) {
    if (media.permission?.status !== 'approved' || typeof media.permission.reference !== 'string' || !media.permission.reference.trim()) throw new Error('Every media item needs recorded permission for the intended hosting audience')
    if (typeof media.file !== 'string') throw new Error('Every media item needs a local file')
    const source = await realpath(resolve(dirname(input), media.file))
    await outsideRepository(source)
    const info = await stat(source)
    if (!info.isFile() || info.size < 1 || info.size > MAX_MEDIA) throw new Error('Media file must contain 1 byte to 2 GiB')
    sources.push({ ...media, source })
  }
  // Exclusive creation prevents overwriting a prepared edition. On failure the
  // incomplete directory is retained for inspection and must not be published.
  await mkdir(output, { mode: 0o700 })
  await mkdir(join(output, 'media'), { mode: 0o700 })
  await mkdir(join(output, 'catalogs'), { mode: 0o700 })
  const registry = []
  const privateEvidence = []
  for (const media of sources) {
    const staged = join(output, 'media', media.id)
    await copyFile(media.source, staged, constants.COPYFILE_EXCL)
    await chmod(staged, 0o600)
    const inspection = probe(staged)
    const byteLength = (await stat(staged)).size
    if (byteLength < 1 || byteLength > MAX_MEDIA) throw new Error('Staged media size is invalid')
    const sha256 = await hashFile(staged)
    registry.push({ id: media.id, sha256, byteLength, contentType: 'video/mp4' })
    privateEvidence.push({ id: media.id, permissionReference: media.permission.reference, ...inspection })
  }
  const envelope = { schemaVersion: 1, revision: catalog.revision, catalog, media: registry }
  const bytes = JSON.stringify(envelope) + '\n'
  if (Buffer.byteLength(bytes) > MAX_INPUT) throw new Error('Prepared catalog exceeds 2 MiB')
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  await writeFile(join(output, 'catalogs', `${catalog.revision}.json`), bytes, { mode: 0o600, flag: 'wx' })
  const receipt = { schemaVersion: 1, status: 'prepared-not-published', catalogRevision: catalog.revision, catalogSha256: sha256, media: registry, privateEvidence }
  await writeFile(join(output, 'publication-report.json'), JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600, flag: 'wx' })
  return { revision: catalog.revision, sha256, mediaCount: registry.length }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4) {
    console.error(`Usage: node ${basename(process.argv[1])} <private-input.json> <new-private-output-directory>`)
    process.exitCode = 1
  } else {
    try {
      const result = await prepareCatalog(process.argv[2], process.argv[3])
      console.log(`Prepared ${result.mediaCount} media object(s). No upload or release selection performed.\nCATALOG_REVISION=${result.revision}\nCATALOG_SHA256=${result.sha256}`)
    } catch (error) { console.error(`Preparation failed: ${error.message}`); process.exitCode = 1 }
  }
}
