import {
  test,
  expect,
  catalog,
  firstTitle,
  capture,
  noHorizontalOverflow,
} from './fixtures.js'

async function youtubeFixture(page, failOnce = false, clip = {}) {
  const withVideo = structuredClone(catalog)
  withVideo.assignments[0].drills[0].media = {
    id: 'youtube-QKz7fDjPnvg',
    provider: 'youtube',
    youtubeId: 'QKz7fDjPnvg',
    portrait: true,
    status: 'approved',
    ...clip,
  }
  await page.route('**/api/catalog', (route) =>
    route.fulfill({ json: withVideo }),
  )
  await page.route('https://www.youtube-nocookie.com/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<html><body style="margin:0;background:#253227;color:#fff;display:grid;place-items:center;height:100vh;font-family:sans-serif">Synthetic video surface</body></html>',
    }),
  )
  await page.route('https://www.youtube.com/iframe_api', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: `
    window.__ytCreated = 0; window.__ytDestroyed = 0;
    window.YT = { Player: class {
      constructor(frame, options) { this.frame=frame; this.events=options.events; this.time=0; this.state=2; this.muted=false; this.rate=1; window.__ytPlayer=this; window.__ytCreated++;
        setTimeout(()=>{ if (${failOnce} && window.__ytCreated===1) this.events.onError({data:150}); else this.events.onReady(); }, 20);
      }
      getIframe(){return this.frame} getCurrentTime(){return this.time} getDuration(){return 42} getPlayerState(){return this.state}
      mute(){this.muted=true} unMute(){this.muted=false} getPlaybackRate(){return this.rate} setPlaybackRate(value){this.rate=value}
      playVideo(){this.state=1;this.events.onStateChange({data:1})} pauseVideo(){this.state=2;this.events.onStateChange({data:2})}
      seekTo(value){this.time=value} loadVideoById(){this.playVideo()} destroy(){window.__ytDestroyed++;this.frame.remove()}
    }}; window.onYouTubeIframeAPIReady();
  `,
    }),
  )
  await page.reload()
}
test('YouTube demonstrations open muted with custom controls and release the iframe on close', async ({
  page,
}, testInfo) => {
  await youtubeFixture(page)
  expect(await page.locator('iframe').count()).toBe(0)
  await page
    .getByRole('button', { name: 'Start practice', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Watch demonstration', exact: true })
    .click()
  const dialog = page.getByRole('dialog', { name: firstTitle, exact: true })
  await expect(
    dialog.getByRole('button', { name: 'Pause video', exact: true }),
  ).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => window.__ytPlayer.muted))
    .toBe(true)
  await expect(dialog.locator('iframe')).toHaveAttribute(
    'referrerpolicy',
    'strict-origin-when-cross-origin',
  )
  await dialog.getByRole('button', { name: 'Pause video', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.__ytPlayer.state)).toBe(2)
  await dialog.getByRole('button', { name: 'Play video', exact: true }).click()
  await dialog
    .getByRole('button', { name: 'Unmute video', exact: true })
    .click()
  await expect
    .poll(() => page.evaluate(() => window.__ytPlayer.muted))
    .toBe(false)
  await dialog
    .getByRole('combobox', { name: 'Playback speed' })
    .selectOption('0.5')
  await expect.poll(() => page.evaluate(() => window.__ytPlayer.rate)).toBe(0.5)
  await dialog
    .getByRole('button', { name: 'Repeat section', exact: true })
    .click()
  await expect(dialog.getByRole('img', { name: /Full video/ })).toBeVisible()
  await page.evaluate(() => {
    window.__ytPlayer.time = 20
  })
  await expect.poll(() => page.evaluate(() => window.__ytPlayer.time)).toBe(0)
  await noHorizontalOverflow(page)
  await capture(page, testInfo, 'youtube-custom-controls')
  await dialog
    .getByRole('button', { name: 'Close dialog', exact: true })
    .click()
  await expect(dialog).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => window.__ytDestroyed)).toBe(1)
  await expect(
    page.getByRole('button', { name: 'Resume practice timer', exact: true }),
  ).toBeVisible()
})
test('a blocked embedded video can retry without losing the active practice', async ({
  page,
}) => {
  await youtubeFixture(page, true)
  await page
    .getByRole('button', { name: 'Start practice', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Watch demonstration', exact: true })
    .click()
  const dialog = page.getByRole('dialog')
  await expect(
    dialog.getByText('Video could not play', { exact: true }),
  ).toBeVisible()
  await dialog.getByRole('button', { name: 'Retry video', exact: true }).click()
  await expect(
    dialog.getByRole('button', { name: 'Pause video', exact: true }),
  ).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => window.__ytPlayer.muted))
    .toBe(true)
  await dialog
    .getByRole('button', { name: 'Close dialog', exact: true })
    .click()
  await expect(dialog).toHaveCount(0)
  await expect(
    page.getByRole('heading', { name: firstTitle, exact: true }),
  ).toBeVisible()
})

test('a prescribed excerpt starts, stops and replays within its bounds', async ({
  page,
}, testInfo) => {
  await youtubeFixture(page, false, { clipStartSec: 10, clipEndSec: 20 })
  await page
    .getByRole('button', { name: 'Start practice', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Watch demonstration', exact: true })
    .click()
  const dialog = page.getByRole('dialog')
  await expect.poll(() => page.evaluate(() => window.__ytPlayer?.time)).toBe(10)
  await expect(dialog.locator('iframe')).toHaveAttribute(
    'src',
    /start=10&end=20/,
  )
  await page.evaluate(() => {
    window.__ytPlayer.time = 20
  })
  await expect.poll(() => page.evaluate(() => window.__ytPlayer.state)).toBe(2)
  await dialog.getByRole('button', { name: 'Play video', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.__ytPlayer.time)).toBe(10)
  await expect.poll(() => page.evaluate(() => window.__ytPlayer.state)).toBe(1)
  await capture(page, testInfo, 'youtube-prescribed-excerpt')
})
