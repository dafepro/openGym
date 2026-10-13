import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules() })
it('the branded Worker build cannot request built-in licensed media or a CDN fallback', async () => {
  vi.stubEnv('VITE_NO_MEDIA', '1')
  vi.stubEnv('VITE_IMG_BASE', 'https://invalid.test/images/')
  vi.stubEnv('VITE_GIF_BASE', 'https://invalid.test/clips/')
  vi.resetModules()
  const { imgSrc, gifSrc } = await import('./exercises.js')
  const exercise = { img: 'test.webp', gif: 'test.mp4', fv: 'female-test' }
  expect(imgSrc(exercise, 'female')).toBeNull()
  expect(gifSrc(exercise, 'male')).toBeNull()
})
