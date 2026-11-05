import { defineConfig, devices } from '@playwright/test'
import { fileURLToPath } from 'node:url'

// Isolated synthetic catalog and first-party playback fixture. No production API.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 3,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  outputDir: './.playwright/results',
  reporter: [['list'], ['html', { outputFolder: './.playwright/report', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4188',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'], browserName: 'chromium' } },
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
    { name: 'reduced-motion', use: { ...devices['Pixel 7'], browserName: 'chromium', reducedMotion: 'reduce' } },
    { name: 'compact-mobile', use: { ...devices['Pixel 7'], browserName: 'chromium', viewport: { width: 320, height: 740 }, screen: { width: 320, height: 740 } } },
    { name: 'short-landscape', use: { ...devices['Pixel 7'], browserName: 'chromium', viewport: { width: 844, height: 390 }, screen: { width: 844, height: 390 } } },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4188',
    cwd: fileURLToPath(new URL('.', import.meta.url)),
    url: 'http://127.0.0.1:4188',
    reuseExistingServer: false,
    env: { VITE_TRAINING_DEMO: '', TRAINING_PREVIEW_BUNDLE: '' },
  },
})
