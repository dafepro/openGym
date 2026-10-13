import { beforeEach, expect, it, vi } from 'vitest'

const native = vi.hoisted(() => ({
  downloadFile: vi.fn(),
  readFile: vi.fn(),
  addListener: vi.fn(),
  remove: vi.fn(),
  installApk: vi.fn()
}))
vi.mock('./mobile.js', () => ({ MOBILE: true }))
vi.mock('@capacitor/filesystem', () => ({
  Directory: { Cache: 'CACHE' },
  Encoding: { UTF8: 'utf8' },
  Filesystem: { downloadFile: native.downloadFile, readFile: native.readFile, addListener: native.addListener }
}))
vi.mock('@capacitor/core', () => ({ registerPlugin: () => ({ installApk: native.installApk }) }))
import { downloadAndInstall, fetchChecksum } from './update.js'

beforeEach(() => {
  vi.resetAllMocks()
  native.addListener.mockResolvedValue({ remove: native.remove })
})

it('streams the APK to disk and delegates hash verification to the native installer', async () => {
  const hash = 'AB'.repeat(32)
  await downloadAndInstall('https://github.com/dafepro/openGym/releases/download/v2/uplift.apk', hash, vi.fn())
  expect(native.downloadFile).toHaveBeenCalledWith({
    url: 'https://github.com/dafepro/openGym/releases/download/v2/uplift.apk',
    path: 'opengym-update.apk',
    directory: 'CACHE',
    progress: true
  })
  expect(native.readFile).not.toHaveBeenCalled()
  expect(native.installApk).toHaveBeenCalledWith({ fileName: 'opengym-update.apk', sha256: hash.toLowerCase() })
  expect(native.remove).toHaveBeenCalledOnce()
})

it('withholds installation after a failed download and removes its progress listener', async () => {
  native.downloadFile.mockRejectedValue(new Error('offline'))
  await expect(downloadAndInstall('https://example.test/uplift.apk', 'a'.repeat(64), vi.fn())).rejects.toThrow(
    'offline'
  )
  expect(native.installApk).not.toHaveBeenCalled()
  expect(native.remove).toHaveBeenCalledOnce()
})

it('requires a checksum before downloading', async () => {
  await expect(downloadAndInstall('https://example.test/uplift.apk', null)).rejects.toThrow('no checksum')
  expect(native.downloadFile).not.toHaveBeenCalled()
  expect(native.installApk).not.toHaveBeenCalled()
})

it('downloads and reads only the small checksum file through native filesystem APIs', async () => {
  native.readFile.mockResolvedValue({ data: 'CD'.repeat(32) + '  uplift.apk\n' })
  expect(await fetchChecksum('https://example.test/uplift.apk.sha256')).toBe('cd'.repeat(32))
  expect(native.readFile).toHaveBeenCalledWith({
    path: 'opengym-update.apk.sha256',
    directory: 'CACHE',
    encoding: 'utf8'
  })
})
