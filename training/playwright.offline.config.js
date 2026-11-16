import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './offline-e2e',
  workers: 1,
  retries: 0,
  timeout: 45000,
  outputDir: '.playwright/offline-results',
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4189', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Pixel 7'], browserName: 'chromium' } },
    { name: 'webkit', use: { ...devices['iPhone 13'], browserName: 'webkit' } }
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4189',
    url: 'http://127.0.0.1:4189',
    reuseExistingServer: false,
    env: { VITE_TRAINING_DEMO: '', TRAINING_PREVIEW_BUNDLE: '' }
  }
})
