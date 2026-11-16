import { test as base, expect } from '@playwright/test'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve, extname } from 'node:path'
import { catalog, assignedTitle } from '../e2e/fixtures.js'

const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const test = base.extend({
  site: async ({}, use) => {
    let available = true,
      current = catalog,
      rolledBack = false
    const server = createServer(async (request, response) => {
      // A real failed network connection also covers WebKit, whose setOffline
      // emulation rejects even service-worker responses (Playwright #42775).
      if (!available) {
        response.destroy()
        return
      }
      const path = new URL(request.url, 'http://localhost').pathname
      if (rolledBack && path === '/sw.js') {
        response.writeHead(404)
        response.end()
        return
      }
      if (rolledBack && path === '/') {
        response.setHeader('Content-Type', 'text/html')
        response.end('<h1>Earlier deployed app</h1>')
        return
      }
      if (path === '/api/catalog') {
        response.setHeader('Content-Type', 'application/json')
        response.end(JSON.stringify(current))
        return
      }
      if (path.startsWith('/api/')) {
        response.writeHead(404)
        response.end('{}')
        return
      }
      const file = resolve(dist, path === '/' ? 'index.html' : `.${path}`)
      if (!file.startsWith(dist)) {
        response.writeHead(404)
        response.end()
        return
      }
      try {
        const bytes = await readFile(file)
        response.setHeader(
          'Content-Type',
          {
            '.html': 'text/html',
            '.js': 'text/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.woff2': 'font/woff2',
            '.svg': 'image/svg+xml'
          }[extname(file)] || 'text/plain'
        )
        response.setHeader('Cache-Control', 'no-store')
        response.end(bytes)
      } catch {
        response.writeHead(404)
        response.end()
      }
    })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    await use({
      url: `http://127.0.0.1:${server.address().port}`,
      disconnect: () => {
        available = false
      },
      reconnect: () => {
        available = true
      },
      rollback: () => {
        rolledBack = true
      },
      update: () => {
        current = { ...catalog, revision: 'e2e-updated' }
      }
    })
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
  }
})

test('production shell reloads offline with saved work and reconnects without replacing that work', async ({
  page,
  context,
  browserName,
  site
}, testInfo) => {
  await page.goto(site.url)
  await expect(page.getByRole('heading', { name: assignedTitle, exact: true })).toBeVisible()
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.getByRole('button', { name: 'Start practice', exact: true }).click()
  await page.getByRole('button', { name: 'Back to practice, keeping your progress', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Resume practice', exact: true })).toBeVisible()
  const readActive = () =>
    page.evaluate(async () => {
      const db = await new Promise((resolve, reject) => {
        const r = indexedDB.open('quicktrack-training', 1)
        r.onsuccess = () => resolve(r.result)
        r.onerror = () => reject(r.error)
      })
      return new Promise((resolve) => {
        const r = db.transaction('progress').objectStore('progress').get('state')
        r.onsuccess = () => {
          db.close()
          resolve(r.result.activeSession)
        }
      })
    })
  await expect.poll(async () => (await readActive())?.practiceTimer?.paused).toBe(true)
  const before = await readActive()
  site.disconnect()
  if (browserName === 'chromium') await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Resume practice', exact: true })).toBeVisible()
  await expect(page.getByText('Using practices on this device', { exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('offline-resume.png'), fullPage: true })
  expect((await readActive()).assignment).toEqual(before.assignment)
  expect((await readActive()).id).toBe(before.id)
  await page.getByRole('button', { name: 'Resume practice', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Practice controls' })).toBeVisible()
  await page.getByRole('button', { name: 'Back to practice, keeping your progress', exact: true }).click()
  site.update()
  site.reconnect()
  if (browserName === 'chromium') await context.setOffline(false)
  else await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem('quicktrack-training:catalog-cache-v1')).catalog.revision)
    )
    .toBe('e2e-updated')
  await expect(page.getByRole('button', { name: 'Resume practice', exact: true })).toBeVisible()
  expect((await readActive()).assignment).toEqual(before.assignment)
  const cached = await page.evaluate(async () =>
    (
      await Promise.all(
        (await caches.keys()).map(async (name) =>
          (await (await caches.open(name)).keys()).map((r) => new URL(r.url).pathname)
        )
      )
    ).flat()
  )
  expect(cached.some((path) => path.startsWith('/api/') || path.startsWith('/media/'))).toBe(false)
})

test('damaged catalog cache recovers a saved practice when the server fails', async ({ page, site }) => {
  await page.goto(site.url)
  await expect(page.getByRole('heading', { name: assignedTitle, exact: true })).toBeVisible()
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.getByRole('button', { name: 'Save assigned practice', exact: true }).click()
  await page.evaluate(() => localStorage.setItem('quicktrack-training:catalog-cache-v1', '{damaged'))
  site.disconnect()
  await page.reload()
  await expect(page.getByText('Recovered from saved practices and progress;', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start practice', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Start practice', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Practice controls' })).toBeVisible()
})

test('online rollback retires the shell without clearing saved player data', async ({ page, site }) => {
  await page.goto(site.url)
  await expect(page.getByRole('heading', { name: assignedTitle, exact: true })).toBeVisible()
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await page.getByRole('button', { name: 'Save assigned practice', exact: true }).click()
  const saved = await page.evaluate(() => localStorage.getItem('quicktrack-training:saved-practices-v1'))
  expect(saved).toBeTruthy()
  site.rollback()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Earlier deployed app' })).toBeVisible()
  await expect
    .poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistration()) === undefined))
    .toBe(true)
  await expect
    .poll(() =>
      page.evaluate(
        async () => (await caches.keys()).filter((key) => key.startsWith('quicktrack-training-shell-')).length
      )
    )
    .toBe(0)
  expect(await page.evaluate(() => localStorage.getItem('quicktrack-training:saved-practices-v1'))).toBe(saved)
})
