import { expect, test } from '@playwright/test'

test('overview, focus, edit, export, and offline revisit', async ({ page, context }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Soul' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Active Frontier' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Professional autonomy/ })).toBeVisible()

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
