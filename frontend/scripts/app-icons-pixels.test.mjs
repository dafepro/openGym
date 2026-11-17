import { describe, expect, it } from 'vitest'
import { deflateSync } from 'node:zlib'
import { iconPixels, sameIconPixels } from './app-icons.mjs'

// Tiny independent PNG fixtures: no artwork files or generator changes needed.
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data])
  let crc = 0xffffffff
  for (const byte of body) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
  }
  const len = Buffer.alloc(4), sum = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  sum.writeUInt32BE((crc ^ 0xffffffff) >>> 0)
  return Buffer.concat([len, body, sum])
}
function fixture({ width = 2, height = 2, channels = 3, level = 9, pixels, raw, split = false,
  compressed, extra = Buffer.alloc(0), headerChange = () => {} } = {}) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = channels === 4 ? 6 : 2
  headerChange(header)
  const data = raw || Buffer.concat(Array.from({ length: height }, (_, y) => Buffer.concat([
    Buffer.from([0]), pixels ? pixels.subarray(y * width * channels, (y + 1) * width * channels) : Buffer.alloc(width * channels, 42)
  ])))
  const idat = compressed || deflateSync(data, { level })
  return Buffer.concat([signature, chunk('IHDR', header), ...(split
    ? [chunk('IDAT', idat.subarray(0, 3)), chunk('IDAT', idat.subarray(3))]
    : [chunk('IDAT', idat)]), extra, chunk('IEND', Buffer.alloc(0))])
}

describe('generated icon pixel equality', () => {
  it.each([3, 4])('accepts equal %i-channel pixels with different compression or IDAT boundaries', channels => {
    const a = fixture({ channels, level: 0 }), b = fixture({ channels, level: 9, split: true })
    expect(a.equals(b)).toBe(false)
    expect(sameIconPixels(a, b)).toBe(true)
    expect(iconPixels(a)).toEqual(iconPixels(b))
  })
  it('rejects one changed color or alpha byte', () => {
    for (const [channels, index] of [[3, 0], [4, 3]]) {
      const pixels = Buffer.alloc(4 * channels, 42)
      pixels[index]++
      expect(sameIconPixels(fixture({ channels }), fixture({ channels, pixels }))).toBe(false)
    }
  })
  it('rejects different dimensions even with the same pixel bytes, and alpha format changes', () => {
    expect(sameIconPixels(fixture(), fixture({ width: 1, height: 4 }))).toBe(false)
    expect(sameIconPixels(fixture(), fixture({ channels: 4 }))).toBe(false)
  })
  it('rejects corrupt or incomplete chunks, signature, CRC and trailing file bytes', () => {
    const good = fixture()
    const crc = Buffer.from(good); crc[29] ^= 1
    const sig = Buffer.from(good); sig[0] ^= 1
    const length = Buffer.from(good); length.writeUInt32BE(0xffffffff, 8)
    for (const bad of [Buffer.alloc(0), good.subarray(0, -1), good.subarray(0, -12), crc, sig, length, Buffer.concat([good, Buffer.from([0])])]) {
      expect(sameIconPixels(good, bad)).toBe(false)
      expect(sameIconPixels(bad, bad)).toBe(false)
    }
  })
  it('rejects invalid, short, oversized or trailing compressed data', () => {
    const raw = Buffer.alloc(14) // two RGB scanlines, filter byte plus six samples
    for (const bad of [fixture({ compressed: Buffer.from([1, 2, 3]) }), fixture({ raw: raw.subarray(0, -1) }),
      fixture({ raw: Buffer.alloc(1000) }), fixture({ compressed: Buffer.concat([deflateSync(raw), Buffer.from([0])]) })]) {
      expect(sameIconPixels(bad, bad)).toBe(false)
    }
  })
  it('rejects PNG features outside the generator contract instead of ignoring them', () => {
    for (const bad of [fixture({ raw: Buffer.from([1, ...Array(13).fill(0)]) }),
      fixture({ headerChange: h => { h[8] = 16 } }), fixture({ headerChange: h => { h[12] = 1 } }),
      fixture({ headerChange: h => { h.writeUInt32BE(0, 0) } }),
      fixture({ headerChange: h => { h.writeUInt32BE(4096, 0) } }),
      fixture({ extra: chunk('tRNS', Buffer.alloc(6)) }), fixture({ extra: chunk('IHDR', Buffer.alloc(13)) })]) {
      expect(sameIconPixels(bad, bad)).toBe(false)
    }
  })
})
