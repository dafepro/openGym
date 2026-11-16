import { test, expect, assignedTitle, firstTitle, repsTitle } from './fixtures.js'

// Observe real rendered CSS on animation frames. No clock mocking, frozen
// animations, fixed sleeps or programmatic clicks: the user controls drive it.
async function observeMotion(page) {
  await page.evaluate(() => {
    const originalNav = document.querySelector('[aria-label="Main navigation"]')
    const originalDock = document.querySelector('.qt-workout-controls:not([data-motion-snapshot])')
    const frames = []
    let running = true, frame
    const translation = style => style.transform === 'none' ? 0 : new DOMMatrixReadOnly(style.transform).m42
    const sample = () => {
      const nav = document.querySelector('[aria-label="Main navigation"]')
      const dock = document.querySelector('.qt-workout-controls:not([data-motion-snapshot])')
      const card = document.querySelector('#training-main .qt-drill-card')
      const navStyle = getComputedStyle(nav)
      const cardStyle = card && getComputedStyle(card)
      const mainStyle = getComputedStyle(document.querySelector('#training-main'))
      const snapshots = [...document.querySelectorAll('[data-motion-snapshot]')].map(element => {
        const style = getComputedStyle(element)
        return {
          inert: element.inert, hidden: element.getAttribute('aria-hidden') === 'true', pointerEvents: style.pointerEvents,
          unsafeDescendants: !!element.querySelector('[id],dialog,video[src],audio[src],source[src]'),
          card: element.classList.contains('qt-drill-card'), opacity: Number(style.opacity), x: parseFloat(style.translate) || 0,
        }
      })
      frames.push({
        navSame: nav === originalNav && nav.isConnected, navY: translation(navStyle), navHeight: nav.getBoundingClientRect().height,
        navVisibility: navStyle.visibility, navState: nav.dataset.visible, navInert: nav.inert,
        navTransition: navStyle.transitionDuration, navOpacity:Number(navStyle.opacity), dockSame: dock === originalDock && !!dock?.isConnected,
        dockOpacity: dock ? Number(getComputedStyle(dock).opacity) : null,
        cardOpacity: cardStyle ? Number(cardStyle.opacity) : null, cardX: cardStyle ? parseFloat(cardStyle.translate) || 0 : null,
        cardAnimation: cardStyle?.animationName || null, direction: document.documentElement.dataset.motion,
        mainStable: mainStyle.transform === 'none' && (mainStyle.translate === 'none' || (parseFloat(mainStyle.translate) || 0) === 0),
        snapshots,
      })
      if (running) frame = requestAnimationFrame(sample)
    }
    sample()
    window.__playbookMotionProbe = () => { running = false; cancelAnimationFrame(frame); sample(); return frames }
  })
}

async function finishObservation(page, testInfo, name) {
  const frames = await page.evaluate(() => window.__playbookMotionProbe())
  await testInfo.attach(name, { body: JSON.stringify(frames, null, 2), contentType: 'application/json' })
  expect(frames.every(frame => frame.navSame && frame.mainStable), 'Persistent navigation/main never remount or become transformed').toBe(true)
  expect(frames.flatMap(frame => frame.snapshots).every(snapshot => snapshot.inert && snapshot.hidden && snapshot.pointerEvents === 'none' && !snapshot.unsafeDescendants), 'Outgoing visuals cannot capture focus/taps, duplicate IDs, keep dialogs open or play media').toBe(true)
  return frames
}

async function expectMotionCleaned(page) {
  await expect(page.locator('[data-motion-snapshot]')).toHaveCount(0)
  await expect(page.locator('.qt-content-enter, .qt-dock-enter')).toHaveCount(0)
}

test('header fades and collapses for active work, then restores profile access', async ({ page }, testInfo) => {
  const reduced = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const nav = page.locator('[aria-label="Main navigation"]')
  await expect(nav).toHaveCSS('visibility', 'visible')
  await observeMotion(page)
  await page.getByRole('button', { name: 'Start practice', exact: true }).click()
  await expect(page.getByRole('heading', { name: firstTitle, exact: true })).toBeVisible()
  await expect(nav).toHaveCSS('visibility', 'hidden')
  await expectMotionCleaned(page)
  const exit = await finishObservation(page, testInfo, 'navigation-exit-frames')
  expect(exit.filter(frame => frame.navState === 'false').every(frame => frame.navInert), 'Departing navigation stops accepting actions immediately').toBe(true)
  expect(exit.at(-1).navHeight).toBe(0)
  if (reduced) {
    expect(exit.every(frame => frame.navTransition.split(',').every(value=>value.trim()==='0s') && !frame.snapshots.length)).toBe(true)
  } else {
    // The destination includes the clearance below the bar, not just its height.
    // Fast easing can traverse the height before the first sampled WebKit frame.
    expect(exit.some(frame => frame.navOpacity > 0 && frame.navOpacity < 1), 'Header fades before hiding').toBe(true)
  }

  await observeMotion(page)
  await page.getByRole('button', { name: 'Back to practice, keeping your progress', exact: true }).click()
  await expect(page.getByRole('heading', { name: assignedTitle, exact: true })).toBeVisible()
  await expect(nav).toHaveCSS('visibility', 'visible')
  await expect(nav).toHaveCSS('opacity','1')
  await expectMotionCleaned(page)
  const entry = await finishObservation(page, testInfo, 'navigation-entry-frames')
  expect(entry.at(-1)).toMatchObject({ navState: 'true', navInert: false, navY: 0 })
  if (reduced) {
    expect(entry.every(frame => frame.navTransition.split(',').every(value=>value.trim()==='0s') && !frame.snapshots.length)).toBe(true)
  } else {
    expect(entry.some(frame => frame.navState === 'true' && frame.navOpacity > 0 && frame.navOpacity < 1), 'Header fades in through intermediate frames').toBe(true)
  }
  await nav.getByRole('button', { name: 'Me', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Me', exact: true })).toBeVisible()
})

test('forward and backward drill transitions overlap continuously and clean up without moving the dock', async ({ page }, testInfo) => {
  const reduced = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  await page.getByRole('button', { name: 'Start practice', exact: true }).click()
  await expect(page.getByRole('heading', { name: firstTitle, exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Practice controls' })).toHaveAttribute('data-phase', 'working')
  await expect(page.locator('[aria-label="Main navigation"]')).toHaveCSS('visibility', 'hidden')
  await expectMotionCleaned(page)
  const journeys = [
    { action: 'Next drill', title: repsTitle, direction: 'forward', sign: 1 },
    { action: 'Undo last set', title: firstTitle, direction: 'back', sign: -1 },
  ]
  for (const journey of journeys) {
    await observeMotion(page)
    await page.getByRole('button', { name: journey.action, exact: true }).click()
    await expect(page.getByRole('heading', { name: journey.title, exact: true })).toBeVisible()
    await expectMotionCleaned(page)
    const frames = await finishObservation(page, testInfo, `drill-${journey.direction}-frames`)
    expect(frames.every(frame => frame.dockSame && frame.dockOpacity === 1), 'Work controls stay mounted and opaque while the drill changes').toBe(true)
    expect(frames.every(frame => frame.navState === 'false' && frame.navInert)).toBe(true)
    expect(frames.at(-1)).toMatchObject({ direction: journey.direction, cardOpacity: 1, cardX: 0 })
    if (reduced) {
      expect(frames.every(frame => !frame.snapshots.length && frame.cardAnimation === 'none' && frame.cardX === 0 && frame.cardOpacity === 1)).toBe(true)
    } else {
      expect(frames.some(frame => frame.cardX * journey.sign > 0.1 && frame.cardOpacity > 0 && frame.cardOpacity < 1), 'The incoming drill traverses intermediate opacity and direction').toBe(true)
      expect(frames.some(frame => frame.snapshots.some(snapshot => snapshot.card && snapshot.x * journey.sign < -0.1 && snapshot.opacity > 0 && snapshot.opacity < 1)), 'The outgoing drill moves in the opposite direction').toBe(true)
      expect(frames.every(frame => frame.cardOpacity + Math.max(0, ...frame.snapshots.filter(snapshot => snapshot.card).map(snapshot => snapshot.opacity)) >= 0.9), 'There is no blank frame between outgoing and incoming content').toBe(true)
    }
  }
  await page.getByRole('button', { name: 'Start drill', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Practice controls' })).toHaveAttribute('data-phase', 'working')
})

test('profile and practice keep the same fully visible header throughout navigation',async({page},testInfo)=>{
  await observeMotion(page)
  await page.getByRole('button',{name:'Me',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Me',exact:true})).toBeVisible()
  await expectMotionCleaned(page)
  await page.getByRole('button',{name:'Practice',exact:true}).click()
  await expect(page.getByRole('heading',{name:'My practices',exact:true})).toBeVisible()
  await expectMotionCleaned(page)
  const frames=await finishObservation(page,testInfo,'persistent-profile-header')
  expect(frames.every(frame=>frame.navVisibility==='visible' && frame.navOpacity===1 && frame.navHeight>0 && !frame.navInert)).toBe(true)
})

test('repeat controls expand and collapse without remounting or blinking the video',async({page},testInfo)=>{
  const reduced=await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches)
  await page.getByText('See the 2 drills',{exact:true}).click()
  await page.getByRole('button',{name:`Watch ${firstTitle}`,exact:true}).click()
  const dialog=page.getByRole('dialog'),video=dialog.locator('video')
  await expect.poll(()=>video.evaluate(el=>el.readyState>=2 && !el.paused)).toBe(true)
  await dialog.getByRole('button',{name:'Pause video',exact:true}).click()
  const settle=()=>page.evaluate(()=>Promise.all(document.getAnimations().filter(animation=>animation.effect?.getTiming().iterations!==Infinity).map(animation=>animation.finished.catch(()=>{}))))
  await settle()
  await page.evaluate(()=>{
    const original=document.querySelector('dialog video'),frames=[]
    let active=true,frame
    const sample=()=>{
      const video=document.querySelector('dialog video'),reveal=document.querySelector('dialog .qt-loop-reveal')
      const style=getComputedStyle(video),rect=video.getBoundingClientRect()
      frames.push({same:video===original && video.isConnected,width:rect.width,height:rect.height,opacity:Number(style.opacity),visibility:style.visibility,open:reveal.dataset.open,detailHeight:reveal.getBoundingClientRect().height,inert:reveal.inert})
      if(active)frame=requestAnimationFrame(sample)
    }
    sample();window.__repeatMotion=()=>{active=false;cancelAnimationFrame(frame);sample();return frames}
  })
  await dialog.getByRole('button',{name:'Repeat section',exact:true}).click()
  await settle()
  await expect(dialog.getByRole('slider',{name:'Repeat start',exact:true})).toBeVisible()
  await dialog.getByRole('button',{name:'Repeat section',exact:true}).click()
  await settle()
  const frames=await page.evaluate(()=>window.__repeatMotion())
  await testInfo.attach('repeat-open-close-frames',{body:JSON.stringify(frames),contentType:'application/json'})
  expect(frames.every(frame=>frame.same && frame.width>40 && frame.height>40 && frame.opacity===1 && frame.visibility==='visible')).toBe(true)
  expect(frames.at(-1)).toMatchObject({open:'false',detailHeight:0,inert:true})
  if(!reduced){
    const max=Math.max(...frames.map(frame=>frame.detailHeight))
    expect(frames.some(frame=>frame.open==='true' && frame.detailHeight>1 && frame.detailHeight<max-1)).toBe(true)
    expect(frames.some(frame=>frame.open==='false' && frame.detailHeight>1 && frame.detailHeight<max-1)).toBe(true)
  }
})
