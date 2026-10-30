import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { demoMedia } from './scripts/demo-media.mjs'
import { assertPrivatePreviewMode, privateTrainingPreview } from './scripts/private-preview.mjs'
import { sourceNoticePlugin } from './scripts/source-notice.mjs'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig(({ command, isPreview }) => {
  const bundlePath = process.env.TRAINING_PREVIEW_BUNDLE
  const demo = process.env.VITE_TRAINING_DEMO === '1'
  assertPrivatePreviewMode({ bundlePath, command, isPreview, demo })
  return {
  root,
  plugins: [react(), sourceNoticePlugin(process.env.APP_BUILD), ...(demo ? [demoMedia()] : []), ...(bundlePath ? [privateTrainingPreview(bundlePath)] : [])],
  define: {
    __TRAINING_DEMO__: process.env.VITE_TRAINING_DEMO === '1',
    __TRAINING_PRIVATE_PREVIEW__: !!bundlePath,
    __TRAINING_BUILD__: JSON.stringify(process.env.APP_BUILD || 'local')
  },
  server: { host: '127.0.0.1', port: 4173, strictPort: true, fs: { strict: true, allow: [root] } },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true, sourcemap: false },
  test: { environment: 'node', include: ['src/**/*.test.{js,jsx}'], clearMocks: true }
  }
})
