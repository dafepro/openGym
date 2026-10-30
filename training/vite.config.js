import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  root,
  plugins: [react()],
  define: {
    __TRAINING_DEMO__: process.env.VITE_TRAINING_DEMO === '1',
    __TRAINING_BUILD__: JSON.stringify(process.env.APP_BUILD || 'local')
  },
  server: { host: '127.0.0.1', port: 4173, strictPort: true, fs: { strict: true, allow: [root] } },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true, sourcemap: false },
  test: { environment: 'node', include: ['src/**/*.test.{js,jsx}'], clearMocks: true }
})
