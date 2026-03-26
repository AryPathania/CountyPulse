import { test, expect } from './fixtures/auth'
import { mockAuthState } from './fixtures/auth'
import { setupApiMocks, TEST_USER } from './fixtures/mock-data'
import type { Page } from '@playwright/test'

const MOCK_CANDIDATE_PROFILE = {
  id: 'cp-1',
  user_id: TEST_USER.id,
  display_name: 'Test User',
  headline: 'Senior Software Engineer',
  summary: 'Experienced engineer',
  phone: '555-1234',
  location: 'San Francisco, CA',
  links: [],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

async function setupSettingsMocks(page: Page) {
  await page.route('**/rest/v1/candidate_profiles*', async (route) => {
    const method = route.request().method()
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([MOCK_CANDIDATE_PROFILE]),
      })
    } else if (method === 'POST' || method === 'PATCH') {
      const body = route.request().postDataJSON()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ ...MOCK_CANDIDATE_PROFILE, ...body }]),
      })
    } else {
      await route.continue()
    }
  })
}

test.describe('Settings page', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthState(page)
    await setupApiMocks(page)
    await setupSettingsMocks(page)
  })

  test('settings page is visible', async ({ page }) => {
    await page.goto('/settings')

    await expect(page.getByTestId('settings-page')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  })

  test('danger zone is rendered', async ({ page }) => {
    await page.goto('/settings')

    await expect(page.getByTestId('danger-zone')).toBeVisible()
  })

  test('reset account flow works', async ({ page }) => {
    let isReset = false

    await page.route('**/rest/v1/candidate_profiles*', async (route) => {
      const method = route.request().method()
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(isReset ? [] : [MOCK_CANDIDATE_PROFILE]),
        })
      } else {
        await route.continue()
      }
    })

    await page.route('**/rest/v1/rpc/reset_account_data*', async (route) => {
      isReset = true
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(null),
      })
    })

    await page.route('**/rest/v1/profile_entries*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    await page.goto('/settings')

    // Click "Reset Account Data" to expand confirmation panel
    const dangerZone = page.getByTestId('danger-zone')
    await expect(dangerZone).toBeVisible()
    await page.getByTestId('reset-account-button').click()

    // Type RESET in confirmation input
    await expect(page.getByTestId('reset-account-panel')).toBeVisible()
    await page.getByTestId('reset-confirm-input').fill('RESET')

    // Click Confirm Reset
    await page.getByTestId('reset-confirm-button').click()

    // After reset, the panel should collapse (confirm flow complete)
    await expect(page.getByTestId('reset-account-panel')).not.toBeVisible({ timeout: 10000 })
  })
})
