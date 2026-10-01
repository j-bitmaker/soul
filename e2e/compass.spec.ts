import { expect, test } from '@playwright/test'

test('overview, focus, edit, export, and offline revisit', async ({ page, context }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Soul' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Three directions' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Active Frontier|Queue/ })).toHaveCount(0)

  await page.locator('.cluster-open', { hasText: 'Practical Agency' }).click()
  await page.getByRole('button', { name: /Professional autonomy/ }).click()
  await expect(page.getByRole('heading', { name: 'Professional autonomy' })).toBeVisible()

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
  expect(await page.getByText('In focus now').count()).toBe(0)
  await expect(page.getByRole('heading', { name: /Active Frontier|Queue/ })).toHaveCount(0)
  await expect(page.locator('.cluster-card').first().locator('.cluster-labels')).toContainText('Read Bible · Daily')
  // goals that wait in the Queue are not on the overview; active ones are
  await expect(page.locator('.cluster-card').first()).not.toContainText('Theology / Scripture')
  await expect(page.locator('.cluster-card').first().locator('.cluster-goal', { hasText: 'Launch Blog' })).toBeVisible()
  expect(await page.locator('.frontier-status').count()).toBe(0)
})

test('shows what Soul means and the Primary goal without overflow on desktop and phone', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'This test sets its own viewports')
  for (const [width, height] of [[1440, 900], [1280, 720], [390, 844]]) {
    await page.setViewportSize({ width, height })
    await page.goto('/')
    await expect(page.locator('.cluster-card').first()).toBeVisible()
    await expect(page.getByText('Unity with God. Life in the Holy Spirit, truth and conscience.')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
})

test('the back gesture steps back one page instead of leaving the app', async ({ page }) => {
  await page.goto('/')
  await page.locator('.cluster-open', { hasText: 'Practical Agency' }).click()
  await page.getByRole('button', { name: /Professional autonomy/ }).click()
  await expect(page.getByRole('heading', { name: 'Professional autonomy', level: 1 })).toBeVisible()
  expect(page.url()).toMatch(/#\/goal\/professional-autonomy$/)

  await page.goBack()
  await expect(page.getByRole('heading', { name: 'Practical Agency', level: 1 })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('heading', { name: 'Three directions' })).toBeVisible()
  expect(page.url()).toMatch(/\/soul\/$/)

  await page.goForward()
  await expect(page.getByRole('heading', { name: 'Practical Agency', level: 1 })).toBeVisible()
})

test('opens a goal from a link and starts each page at the top', async ({ page }) => {
  await page.goto('/#/goal/launch-blog')
  await expect(page.getByRole('heading', { name: 'Launch Blog', level: 1 })).toBeVisible()

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Three directions' })).toBeVisible()
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  await page.locator('.cluster-goal', { hasText: 'Philosophy / humanities' }).click()
  await expect(page.getByRole('heading', { name: 'Philosophy / humanities', level: 1 })).toBeVisible()
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
})

test('adds a goal right on a direction card and deletes it with one tap on its row', async ({ page }) => {
  await page.goto('/')
  const card = page.locator('.cluster-card[data-tone="freedom"]')
  await card.getByLabel('New goal in Practical Agency').fill('A goal to remove')
  await card.getByRole('button', { name: 'Add goal to Practical Agency' }).click()
  const goal = card.getByRole('button', { name: /^A goal to remove/ })
  await expect(goal).toBeVisible()

  await card.getByRole('button', { name: 'Delete A goal to remove' }).click()
  await expect(page.getByRole('dialog', { name: 'Delete goal' })).toContainText('cannot be undone')
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(goal).toBeVisible()

  await card.getByRole('button', { name: 'Delete A goal to remove' }).click()
  await page.getByRole('button', { name: 'Delete permanently' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(goal).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Three directions' })).toBeVisible()
  expect(page.url()).toMatch(/\/soul\/$/)
  await page.reload()
  await expect(card.getByRole('button', { name: /A goal to remove/ })).toHaveCount(0)
})

test('deletes a goal from its own page too, and returns to its direction', async ({ page }) => {
  await page.goto('/')
  const card = page.locator('.cluster-card[data-tone="freedom"]')
  await card.getByLabel('New goal in Practical Agency').fill('Second goal to remove')
  await card.getByRole('button', { name: 'Add goal to Practical Agency' }).click()
  await card.getByRole('button', { name: /^Second goal to remove/ }).click()
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('heading', { name: 'Second goal to remove', level: 1 })).toBeVisible()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await page.getByRole('button', { name: 'Delete permanently' }).click()
  await expect(page.getByRole('heading', { name: 'Practical Agency', level: 1 })).toBeVisible()
  await expect(page.getByRole('button', { name: /Second goal to remove/ })).toHaveCount(0)
})

test('changes priority from the menu on a card: reorder, put in focus, send to the Queue', async ({ page }) => {
  await page.goto('/')
  const card = page.locator('.cluster-card[data-tone="expression"]')
  const titles = () => card.locator('.cluster-goal > span:first-child').allInnerTexts()
  expect(await titles()).toEqual(['Launch Blog', 'English C1', 'Clear speech / writing', 'Philosophy / humanities'])

  await card.getByRole('button', { name: 'Priority of English C1' }).click()
  await expect(page.getByRole('menuitem', { name: /Move down/ })).toBeDisabled()
  await page.getByRole('menuitem', { name: /Move up/ }).click()
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect.poll(titles).toEqual(['English C1', 'Launch Blog', 'Clear speech / writing', 'Philosophy / humanities'])

  await card.getByRole('button', { name: 'Priority of Philosophy / humanities' }).click()
  await page.getByRole('menuitem', { name: /Put in focus/ }).click()
  await expect(card.getByRole('button', { name: 'Priority of Philosophy / humanities' }).locator('.lane-mark')).toHaveAttribute('data-lane', 'active')
  await expect.poll(titles).toEqual(['English C1', 'Launch Blog', 'Philosophy / humanities', 'Clear speech / writing'])

  // the choice survives a reload (the preview keeps the map in this browser)
  await page.reload()
  await expect.poll(titles).toEqual(['English C1', 'Launch Blog', 'Philosophy / humanities', 'Clear speech / writing'])

  // keyboard: open with Enter, move with the arrow keys, close with Escape
  await card.getByRole('button', { name: 'Priority of Clear speech / writing' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('menuitem', { name: /Put in focus/ })).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('menuitem', { name: /Move up/ })).toBeDisabled()
  await expect(page.getByRole('menuitem', { name: /Move down/ })).toBeDisabled()
  await expect(page.getByRole('menuitem', { name: /Move to the Queue/ })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toHaveCount(0)

  // queued goals leave the overview and wait on the direction's page, below the rest
  await card.getByRole('button', { name: 'Priority of Clear speech / writing' }).click()
  await page.getByRole('menuitem', { name: /Move to the Queue/ }).click()
  await expect.poll(titles).toEqual(['English C1', 'Launch Blog', 'Philosophy / humanities'])
  await card.locator('.cluster-open').click()
  await expect(page.locator('.goal-queue')).toContainText('Clear speech / writing')
})

test('puts labels on Soul in the hero, and keeps them across a reload', async ({ page }) => {
  await page.goto('/')
  const hero = page.locator('.orientation')
  await hero.getByRole('button', { name: 'Add label to Soul' }).click()
  await page.getByRole('textbox', { name: 'New label for Soul' }).fill('Seek first')
  await page.keyboard.press('Enter')
  await page.getByRole('textbox', { name: 'New label for Soul' }).fill('Begin small')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Escape')
  await expect(hero.locator('.soul-labels .label-pill')).toHaveText(['Seek first', 'Begin small'])
  await page.reload()
  await expect(hero.locator('.soul-labels .label-pill')).toHaveText(['Seek first', 'Begin small'])
  const box = (await hero.locator('.soul-labels').boundingBox())!
  const viewport = page.viewportSize()!
  expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThan(24) // centred under the subtitle
  await hero.getByRole('button', { name: 'Edit label Begin small of Soul' }).click()
  await page.getByRole('textbox', { name: 'Rename label Begin small of Soul' }).fill('Begin with one thing')
  await page.keyboard.press('Enter')
  await expect(hero.locator('.soul-labels .label-pill').nth(1)).toContainText('Begin with one thing')
  await hero.getByRole('button', { name: 'Remove label Seek first from Soul' }).click()
  await expect(hero.locator('.soul-labels .label-pill')).toHaveCount(1)
})

test('the owner\'s tools never get in the way of scrolling', async ({ page, context }, testInfo) => {
  await page.setViewportSize(testInfo.project.name === 'mobile' ? { width: 412, height: 700 } : { width: 1280, height: 500 })
  await page.goto('/')
  await expect(page.locator('.cluster-card').first()).toBeVisible()
  expect(await page.evaluate(() => [...document.querySelectorAll('*')].filter((element) => getComputedStyle(element).touchAction === 'none').length)).toBe(0)
  expect(await page.evaluate(() => [...document.querySelectorAll('.cluster-card *, .orientation *')]
    .filter((element) => ['fixed', 'sticky'].includes(getComputedStyle(element).position)).length)).toBe(0)
  const buttons = ['Delete Launch Blog', 'Priority of English C1', 'Add label to Launch Blog']
  const client = testInfo.project.name === 'mobile' ? await context.newCDPSession(page) : null
  for (const name of buttons) {
    await page.evaluate(() => window.scrollTo(0, 0))
    const box = (await page.getByRole('button', { name }).boundingBox())!
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    if (client) {
      // a swipe that starts on one of the small buttons still scrolls the page
      const touch = (type: string, point?: { x: number; y: number }) =>
        client.send('Input.dispatchTouchEvent', { type, touchPoints: point ? [point] : [] } as never)
      await touch('touchStart', { x, y })
      for (let step = 1; step <= 20; step += 1) {
        await touch('touchMove', { x, y: y - step * 14 })
        await page.waitForTimeout(16)
      }
      await touch('touchEnd')
    } else {
      await page.mouse.move(x, y)
      await page.mouse.wheel(0, 300)
    }
    await expect.poll(() => page.evaluate(() => window.scrollY), { message: name }).toBeGreaterThan(100)
  }
})

test('shows and edits labels right on the overview, and keeps them across a reload', async ({ page }) => {
  await page.goto('/')
  const card = page.locator('.cluster-card[data-tone="expression"]')
  await expect(card.locator('.cluster-labels')).toContainText('Read Bible · Daily')

  await card.getByRole('button', { name: 'Add label to Clear speech / writing' }).click()
  await page.getByRole('textbox', { name: 'New label for Clear speech / writing' }).fill('Speak aloud · Daily')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Escape')
  await expect(card.locator('.cluster-goals li', { hasText: 'Clear speech / writing' }).locator('.label-pill')).toContainText('Speak aloud · Daily')

  await page.reload()
  await expect(card.locator('.cluster-goals li', { hasText: 'Clear speech / writing' }).locator('.label-pill')).toContainText('Speak aloud · Daily')

  await card.getByRole('button', { name: 'Edit label Speak aloud · Daily of Clear speech / writing' }).click()
  await page.getByRole('textbox', { name: 'Rename label Speak aloud · Daily of Clear speech / writing' }).fill('Speak aloud · Weekly')
  await page.keyboard.press('Enter')
  await expect(card.locator('.label-pill', { hasText: 'Speak aloud · Weekly' })).toBeVisible()
  await card.getByRole('button', { name: 'Remove label Speak aloud · Weekly from Clear speech / writing' }).click()
  await expect(card.locator('.label-pill', { hasText: 'Speak aloud' })).toHaveCount(0)

  await card.getByRole('button', { name: 'Remove label Read Bible · Daily from Understand & Express' }).click()
  await expect(card.locator('.cluster-labels .label-pill')).toHaveCount(0)
  await card.getByRole('button', { name: 'Add label to Understand & Express' }).click()
  await page.getByRole('textbox', { name: 'New label for Understand & Express' }).fill('Pray daily')
  await page.keyboard.press('Enter')
  await expect(card.locator('.cluster-labels .label-pill', { hasText: 'Pray daily' })).toBeVisible()
})

test('keeps the overview inside the screen on phones, with the owner\'s small controls and an open label field', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'This test sets its own viewports')
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/')
    await expect(page.locator('.cluster-card').first()).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.getByRole('button', { name: 'Add label to Launch Blog' }).click()
    await expect(page.getByRole('textbox', { name: 'New label for Launch Blog' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Priority of Launch Blog' }).click()
    await expect(page.getByRole('menu')).toBeVisible()
    const menu = (await page.getByRole('menu').boundingBox())!
    expect(menu.x).toBeGreaterThanOrEqual(0)
    expect(menu.x + menu.width).toBeLessThanOrEqual(width)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.keyboard.press('Escape')
    // the title text always stops before the row's small buttons
    const overlaps = await page.evaluate(() => [...document.querySelectorAll('.cluster-goals li')].flatMap((row) => {
      const text = row.querySelector('.cluster-goal > span:first-child')!.firstChild as Text
      const range = document.createRange()
      range.selectNodeContents(text)
      const words = [...range.getClientRects()]
      const buttons = [...row.querySelectorAll('.cluster-goal-delete, .priority-marker, .cluster-goal-labels.is-empty .label-add')]
        .map((button) => button.getBoundingClientRect())
      return words.flatMap((word) => buttons.filter((box) => word.right > box.left + 1 && word.left < box.right - 1
        && word.bottom > box.top + 1 && word.top < box.bottom - 1).map(() => text.textContent))
    }))
    expect(overlaps).toEqual([])
  }
})

test('edits a goal in place, with no Edit switch: name, labels, milestones, and a new goal', async ({ page }) => {
  await page.goto('/#/goal/english-c1')
  await expect(page.getByRole('heading', { name: 'English C1', level: 1 })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Edit goal' })).toBeVisible()

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

test('shows the directions in a circle around Soul and remembers the choice', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.cluster-grid')).toBeVisible()
  await expect(page.locator('.orbit')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Cards' })).toHaveAttribute('aria-pressed', 'true')

  await page.getByRole('button', { name: 'Orbit' }).click()
  const orbit = page.locator('.orbit')
  await expect(orbit).toBeVisible()
  await expect(page.locator('.cluster-grid')).toHaveCount(0)
  await expect(orbit.locator('.orbit-soul')).toContainText('Soul')
  await expect(orbit.locator('.orbit-spoke')).toHaveCount(3)
  await expect(orbit.locator('.orbit-arc')).toHaveCount(3)

  const stage = (await orbit.boundingBox())!
  const boxes = []
  for (const name of ['Understand & Express', 'Practical Agency', 'Self-Mastery']) {
    const box = (await orbit.getByRole('button', { name }).boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(stage.x - 1)
    expect(box.x + box.width).toBeLessThanOrEqual(stage.x + stage.width + 1)
    expect(box.y).toBeGreaterThanOrEqual(stage.y - 1)
    expect(box.y + box.height).toBeLessThanOrEqual(stage.y + stage.height + 1)
    boxes.push(box)
  }
  const apart = (a: typeof boxes[number], b: typeof boxes[number]) =>
    a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y
  expect(apart(boxes[0], boxes[1]) && apart(boxes[0], boxes[2]) && apart(boxes[1], boxes[2])).toBe(true)

  await orbit.getByRole('button', { name: 'Practical Agency' }).hover()
  await expect(orbit.locator('.orbit-link.is-lit')).toHaveCount(3)

  await page.reload()
  await expect(page.locator('.orbit')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Orbit' })).toHaveAttribute('aria-pressed', 'true')

  await page.locator('.orbit').getByRole('button', { name: 'Practical Agency' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Practical Agency' })).toBeVisible()
  await page.goBack()
  await expect(page.locator('.orbit')).toBeVisible()

  await page.getByRole('button', { name: 'Cards' }).click()
  await expect(page.locator('.cluster-grid')).toBeVisible()
  await page.reload()
  await expect(page.locator('.cluster-grid')).toBeVisible()
})

test('keeps the orbit inside the screen and readable from phone to desktop', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'This test sets its own viewports')
  for (const [width, height] of [[320, 700], [390, 844], [768, 900], [1280, 720]]) {
    await page.setViewportSize({ width, height })
    await page.goto('/')
    if (await page.getByRole('button', { name: 'Orbit' }).getAttribute('aria-pressed') !== 'true') await page.getByRole('button', { name: 'Orbit' }).click()
    await expect(page.locator('.orbit')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    for (const name of ['Understand & Express', 'Practical Agency', 'Self-Mastery']) {
      const box = (await page.locator('.orbit').getByRole('button', { name }).boundingBox())!
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(width)
      expect(box.height).toBeGreaterThanOrEqual(24)
    }
  }
})
