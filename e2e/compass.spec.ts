import { expect, test } from '@playwright/test'

test('overview, focus, edit, export, and offline revisit', async ({ page, context }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Soul' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Active Frontier' })).toBeVisible()
  await expect(page.locator('.frontier-section').getByRole('button', { name: /Professional autonomy/ })).toBeVisible()

  await page.locator('.cluster-open', { hasText: 'Create & Be Free' }).click()
  await page.getByRole('button', { name: /Professional autonomy/ }).click()
  await expect(page.getByRole('heading', { name: 'Professional autonomy' })).toBeVisible()

  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByRole('button', { name: 'Edit goal' }).click()
  await page.getByLabel('Name').fill('Professional freedom')
  await page.getByRole('button', { name: 'Add routine' }).click()
  await page.getByRole('textbox', { name: 'Routine title 1' }).fill('Review opportunities')
  await page.getByRole('textbox', { name: 'Routine cadence 1' }).fill('Weekly')
  await page.getByRole('button', { name: 'Save goal' }).click()
  await expect(page.getByRole('heading', { name: 'Professional freedom' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Routine for Professional freedom' })).toContainText('Review opportunities')

  await page.getByRole('button', { name: 'More options' }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export JSON' }).click()
  expect((await download).suggestedFilename()).toBe('soul-map.json')

  await page.evaluate(() => navigator.serviceWorker.ready)
  await context.setOffline(true)
  await page.reload()
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
    return Boolean(directions && frontier && frontier.compareDocumentPosition(directions) & Node.DOCUMENT_POSITION_FOLLOWING)
  })
  expect(ordering).toBe(true)
  await expect(page.locator('.cluster-card').first().getByRole('region', { name: 'Routine for Understand & Express' })).toContainText('Read Bible')
})

test('shows the Primary goal without scrolling on desktop and phone', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'This test sets its own viewports')
  for (const [width, height] of [[1440, 900], [1280, 720], [390, 844]]) {
    await page.setViewportSize({ width, height })
    await page.goto('/')
    const lead = page.locator('.frontier-lead')
    await expect(lead).toContainText('Professional autonomy')
    await expect(page.getByText('Unity with God. Life in the Holy Spirit, truth and conscience.')).toBeVisible()
    const bounds = await lead.boundingBox()
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(height)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
})
