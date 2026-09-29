import { expect, test } from '@playwright/test'

test('overview, focus, edit, export, and offline revisit', async ({ page, context }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Soul' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Active Frontier' })).toBeVisible()
  await expect(page.locator('.frontier-section').getByRole('button', { name: /Professional autonomy/ })).toBeVisible()

  await page.getByRole('button', { name: /Create & Be Free/ }).first().click()
  await page.getByRole('button', { name: /Professional autonomy/ }).click()
  await expect(page.getByRole('heading', { name: 'Professional autonomy' })).toBeVisible()

  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByRole('button', { name: 'Edit goal' }).click()
  await page.getByLabel('Name').fill('Professional freedom')
  await page.getByRole('button', { name: 'Save goal' }).click()
  await expect(page.getByRole('heading', { name: 'Professional freedom' })).toBeVisible()

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
  const focus = page.locator('.frontier-peek')
  await expect(focus).toBeVisible()
  await expect(focus.getByText('Professional autonomy')).toBeVisible()
  await expect(focus.getByText('Launch Blog')).toBeVisible()
  await expect(focus.getByText('English C1')).toBeVisible()
  const focusBounds = await focus.boundingBox()
  expect(focusBounds!.y + focusBounds!.height).toBeLessThanOrEqual(700)
})
