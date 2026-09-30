import { expect, test, type Locator, type Page } from '@playwright/test'

async function drag(page: Page, from: Locator, to: Locator): Promise<void> {
  const start = (await from.boundingBox())!
  const end = (await to.boundingBox())!
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
  await page.mouse.down()
  await page.mouse.move(start.x + start.width / 2 + 12, start.y + start.height / 2 + 12, { steps: 4 })
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 14 })
  await page.mouse.up()
}

const savedFrontier = (page: Page) => page.evaluate(() =>
  (JSON.parse(localStorage.getItem('soul-compass-preview') as string).frontier as { nodeId: string; status: string }[])
    .map((entry) => `${entry.nodeId}:${entry.status}`))

test('overview, focus, edit, export, and offline revisit', async ({ page, context }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Soul' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Active Frontier' })).toBeVisible()
  await expect(page.locator('.frontier-lead')).toContainText('Professional autonomy')

  await page.locator('.cluster-open', { hasText: 'Create & Be Free' }).click()
  await page.getByRole('button', { name: /Professional autonomy/ }).click()
  await expect(page.getByRole('heading', { name: 'Professional autonomy' })).toBeVisible()

  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByRole('button', { name: 'Edit goal' }).click()
  await page.getByLabel('Name').fill('Professional freedom')
  await page.getByRole('dialog').getByRole('button', { name: 'Add label' }).click()
  await page.getByRole('textbox', { name: 'Label 1' }).fill('Review opportunities · Weekly')
  await page.getByRole('button', { name: 'Save goal' }).click()
  await expect(page.getByRole('heading', { name: 'Professional freedom' })).toBeVisible()
  await expect(page.locator('.focus-meta .label-pill', { hasText: 'Review opportunities · Weekly' })).toBeVisible()

  await page.getByRole('button', { name: 'More options' }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export JSON' }).click()
  expect((await download).suggestedFilename()).toBe('soul-map.json')

  await page.evaluate(() => navigator.serviceWorker.ready)
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Professional freedom', level: 1 })).toBeVisible()
  await page.getByRole('button', { name: 'Soul, return to overview' }).click()
  await expect(page.getByRole('heading', { name: 'Soul' })).toBeVisible()
})

test('uses modern type and gives each direction room at narrow widths', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'This test checks desktop and narrow widths directly')
  await page.setViewportSize({ width: 1092, height: 900 })
  await page.goto('/')
  const typography = await page.locator('.soul-title').evaluate((element) => getComputedStyle(element).fontFamily)
  expect(typography).toMatch(/Manrope/)
  const gap = await page.locator('.cluster-grid').evaluate((element) => parseFloat(getComputedStyle(element).columnGap))
  expect(gap).toBeGreaterThanOrEqual(18)

  for (const width of [546, 390]) {
    await page.setViewportSize({ width, height: 900 })
    const layout = await page.evaluate(() => ({
      viewport: innerWidth,
      document: document.documentElement.scrollWidth,
      columns: getComputedStyle(document.querySelector('.cluster-grid')!).gridTemplateColumns.split(' ').length,
      cards: [...document.querySelectorAll('.cluster-card')].map((card) => {
        const bounds = card.getBoundingClientRect()
        return { left: bounds.left, right: bounds.right }
      }),
    }))
    expect(layout.document).toBeLessThanOrEqual(layout.viewport)
    expect(layout.columns).toBe(1)
    layout.cards.forEach(({ left, right }) => {
      expect(left).toBeGreaterThanOrEqual(0)
      expect(right).toBeLessThanOrEqual(layout.viewport)
    })
  }

  await page.setViewportSize({ width: 320, height: 700 })
  expect(await page.getByRole('heading', { name: 'Active Frontier' }).count()).toBe(1)
  expect(await page.getByText('In focus now').count()).toBe(0)
  const ordering = await page.evaluate(() => {
    const directions = document.querySelector('.cluster-grid')
    const frontier = document.querySelector('.frontier-section')
    return Boolean(directions && frontier && directions.compareDocumentPosition(frontier) & Node.DOCUMENT_POSITION_FOLLOWING)
  })
  expect(ordering).toBe(true)
  await expect(page.locator('.cluster-card').first().locator('.cluster-labels')).toContainText('Read Bible · Daily')
  await expect(page.locator('.queue-section')).toContainText('Theology / Scripture')
  expect(await page.locator('.frontier-status').count()).toBe(0)
})

test('shows what Soul means and the Primary goal without overflow on desktop and phone', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'This test sets its own viewports')
  for (const [width, height] of [[1440, 900], [1280, 720], [390, 844]]) {
    await page.setViewportSize({ width, height })
    await page.goto('/')
    await expect(page.locator('.frontier-lead')).toContainText('Professional autonomy')
    await expect(page.getByText('Unity with God. Life in the Holy Spirit, truth and conscience.')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
})

test('the back gesture steps back one page instead of leaving the app', async ({ page }) => {
  await page.goto('/')
  await page.locator('.cluster-open', { hasText: 'Create & Be Free' }).click()
  await page.getByRole('button', { name: /Professional autonomy/ }).click()
  await expect(page.getByRole('heading', { name: 'Professional autonomy', level: 1 })).toBeVisible()
  expect(page.url()).toMatch(/#\/goal\/professional-autonomy$/)

  await page.goBack()
  await expect(page.getByRole('heading', { name: 'Create & Be Free', level: 1 })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('heading', { name: 'Active Frontier' })).toBeVisible()
  expect(page.url()).toMatch(/\/soul\/$/)

  await page.goForward()
  await expect(page.getByRole('heading', { name: 'Create & Be Free', level: 1 })).toBeVisible()
})

test('opens a goal from a link and starts each page at the top', async ({ page }) => {
  await page.goto('/#/goal/launch-blog')
  await expect(page.getByRole('heading', { name: 'Launch Blog', level: 1 })).toBeVisible()

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Active Frontier' })).toBeVisible()
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  await page.locator('.cluster-goal', { hasText: 'Philosophy / humanities' }).click()
  await expect(page.getByRole('heading', { name: 'Philosophy / humanities', level: 1 })).toBeVisible()
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
})

test('adds a goal to the queue and deletes it explicitly', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByLabel('Add to the queue').fill('A goal to remove')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  const row = page.locator('.queue-section .frontier-row', { hasText: 'A goal to remove' })
  await expect(row).toBeVisible()

  await page.getByRole('button', { name: 'Delete A goal to remove' }).click()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(row).toBeVisible()

  await page.getByRole('button', { name: 'Delete A goal to remove' }).click()
  await expect(page.getByRole('dialog', { name: 'Delete goal' })).toContainText('cannot be undone')
  await page.getByRole('button', { name: 'Delete permanently' }).click()
  await expect(row).toHaveCount(0)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('drags goals between Active and the Queue and reorders them', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Mouse dragging is checked on desktop; touch needs a real device')
  await page.setViewportSize({ width: 1280, height: 1800 })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Drag Launch Blog' })).toBeVisible()

  // Active -> Queue, in front of the goal it is dropped on
  await drag(page, page.getByRole('button', { name: 'Drag Launch Blog' }), page.locator('.queue-section .frontier-row', { hasText: 'Theology / Scripture' }))
  await expect(page.locator('.queue-section .frontier-open').first()).toContainText('Launch Blog')
  expect(await savedFrontier(page)).toEqual([
    'professional-autonomy:active', 'english-c1:active', 'launch-blog:queued', 'theology-scripture:queued', 'software-ai:queued',
  ])

  // Queue -> top of Active: it becomes the lead card
  await drag(page, page.getByRole('button', { name: 'Drag Software / AI Engineering' }), page.locator('.frontier-lead-wrap'))
  await expect(page.locator('.frontier-lead')).toContainText('Software / AI Engineering')
  expect(await savedFrontier(page)).toEqual([
    'software-ai:active', 'professional-autonomy:active', 'english-c1:active', 'launch-blog:queued', 'theology-scripture:queued',
  ])

  // Within Active: swap the lead with the goal below it
  await drag(page, page.getByRole('button', { name: 'Drag Software / AI Engineering' }), page.locator('.frontier-list .frontier-row', { hasText: 'English C1' }))
  expect((await savedFrontier(page))[0]).toBe('professional-autonomy:active')
  await expect(page.locator('.frontier-lead')).toContainText('Professional autonomy')
})

test('keeps the Frontier inside the screen on phones, also in edit mode', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'This test sets its own viewports')
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/')
    await expect(page.locator('.frontier-lead')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Move Launch Blog down in Active' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
})

test('drags a goal with a finger: press the handle, then move', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Touch dragging is emulated on the phone project')
  await page.setViewportSize({ width: 412, height: 2600 })
  await page.goto('/')
  const client = await context.newCDPSession(page)
  const centre = async (locator: Locator) => { const box = (await locator.boundingBox())!; return { x: box.x + box.width / 2, y: box.y + box.height / 2 } }
  const from = await centre(page.getByRole('button', { name: 'Drag Launch Blog' }))
  const to = await centre(page.locator('.queue-section .frontier-row', { hasText: 'Theology / Scripture' }))
  const touch = (type: string, point?: { x: number; y: number }) =>
    client.send('Input.dispatchTouchEvent', { type, touchPoints: point ? [point] : [] } as never)
  await touch('touchStart', from)
  await page.waitForTimeout(260)
  for (let step = 1; step <= 16; step += 1) {
    await touch('touchMove', { x: from.x + (to.x - from.x) * step / 16, y: from.y + (to.y - from.y) * step / 16 })
    await page.waitForTimeout(16)
  }
  await touch('touchEnd')
  await expect(page.locator('.queue-section .frontier-open').first()).toContainText('Launch Blog')
  expect(await savedFrontier(page)).toEqual([
    'professional-autonomy:active', 'english-c1:active', 'launch-blog:queued', 'theology-scripture:queued', 'software-ai:queued',
  ])
})

test('edits a goal in place without edit mode: name, labels, milestones, and a new goal', async ({ page }) => {
  await page.goto('/#/goal/english-c1')
  await expect(page.getByRole('heading', { name: 'English C1', level: 1 })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()

  await page.getByRole('heading', { level: 1 }).getByRole('button').click()
  await page.getByLabel('Edit name').fill('English C1 fluency')
  await page.getByLabel('Edit name').press('Enter')
  await expect(page.getByRole('heading', { name: 'English C1 fluency', level: 1 })).toBeVisible()

  await page.getByRole('button', { name: 'Add label' }).click()
  await page.getByLabel('New label').fill('Reading')
  await page.getByLabel('New label').press('Enter')
  await page.getByLabel('New label').fill('Listening')
  await page.getByLabel('New label').press('Enter')
  await page.getByLabel('New label').press('Escape')
  await expect(page.locator('.focus-meta .label-pill', { hasText: 'Reading' })).toBeVisible()
  await page.getByRole('button', { name: 'Remove label Listening' }).click()
  await expect(page.locator('.focus-meta .label-pill', { hasText: 'Listening' })).toHaveCount(0)

  await page.getByLabel('New milestone').fill('Read a novel')
  await page.getByLabel('New milestone').press('Enter')
  await page.getByRole('button', { name: 'Read a novel: mark done' }).click()
  await expect(page.getByRole('button', { name: 'Read a novel: mark not done' })).toHaveAttribute('aria-pressed', 'true')

  await page.getByLabel('New goal').fill('Vocabulary')
  await page.getByLabel('New goal').press('Enter')
  await expect(page.locator('.goal-list .goal-row', { hasText: 'Vocabulary' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'English C1 fluency', level: 1 })).toBeVisible()
  await expect(page.locator('.focus-meta .label-pill', { hasText: 'Reading' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Read a novel: mark not done' })).toBeVisible()
  await expect(page.locator('.goal-list .goal-row', { hasText: 'Vocabulary' })).toBeVisible()
})

test('shows one scrolling list per page with the Queue and then the Archive below', async ({ page }) => {
  await page.goto('/#/goal/understand')
  await expect(page.getByRole('heading', { name: 'Understand & Express', level: 1 })).toBeVisible()
  expect(await page.getByRole('button', { name: /page/i }).count()).toBe(0)
  await expect(page.locator('.goal-queue')).toContainText('Theology / Scripture')
  const queueBelow = await page.evaluate(() => {
    const list = document.querySelector('.content-section > .goal-list')!.getBoundingClientRect()
    const queue = document.querySelector('.goal-queue')!.getBoundingClientRect()
    return queue.top > list.bottom
  })
  expect(queueBelow).toBe(true)
})

test('keeps a goal page inside the screen on phones', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'This test sets its own viewports')
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/#/goal/english-c1')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.getByRole('button', { name: 'Add label' }).click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
})
