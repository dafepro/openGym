import { expect, it, vi } from 'vitest'
import { driveFileId, readDriveImport } from './drive-import.js'
const id = 'abcdefghijklmno'
const auth = { token: 'test-only', expiresAt: Date.now() + 3600000 }
it('accepts canonical Drive file links and refuses arbitrary origins or credentials', () => {
  expect(driveFileId('https://drive.google.com/file/d/' + id + '/view')).toBe(id)
  for (const url of ['http://drive.google.com/file/d/' + id, 'https://evil.test/file/d/' + id, 'https://user@drive.google.com/file/d/' + id, 'javascript:alert(1)']) expect(() => driveFileId(url)).toThrow()
})
it('reads one selected file at fixed Google endpoints without cookies or redirects', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ id, name: 'plan.json', mimeType: 'application/json', size: '2' }))).mockResolvedValueOnce(new Response('{}'))
  const file = await readDriveImport(id, auth, { fetcher })
  expect(file.name).toBe('plan.json'); expect(fetcher).toHaveBeenCalledTimes(2)
  for (const [url, options] of fetcher.mock.calls) { expect(url).toMatch(/^https:\/\/www.googleapis.com\/drive\/v3\/files\//); expect(options.credentials).toBe('omit'); expect(options.redirect).toBe('error') }
})
it('refuses oversized data and native sheets rather than importing only their first tab', async () => {
  for (const metadata of [{ id, size: '6000000' }, { id, mimeType: 'application/vnd.google-apps.spreadsheet' }]) {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(metadata)))
    await expect(readDriveImport(id, auth, { fetcher })).rejects.toThrow(); expect(fetcher).toHaveBeenCalledTimes(1)
  }
})
