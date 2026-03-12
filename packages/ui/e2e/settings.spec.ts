import { test, expect } from './fixtures/auth'
import { mockAuthState } from './fixtures/auth'
import { setupApiMocks, TEST_USER } from './fixtures/mock-data'
import type { Page } from '@playwright/test'

// Re-export TEST_USER so it resolves from correct fixture
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
  // Mock candidate_profiles
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

test.describe('Settings page — Profile & Settings', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthState(page)
    await setupApiMocks(page)
    await setupSettingsMocks(page)
  })

  test('settings page is visible', async ({ page }) => {
    await page.goto('/settings')

    await expect(page.getByTestId('settings-page')).toBeVisible()
    await expect(page.getByText('Profile & Settings')).toBeVisible()
  })

  test('profile section is rendered', async ({ page }) => {
    await page.goto('/settings')

    await expect(page.getByTestId('settings-profile-section')).toBeVisible()
    await expect(page.getByTestId('settings-profile-section').getByRole('heading', { name: 'Profile', exact: true })).toBeVisible()
  })

  test('profile form loads with existing data', async ({ page }) => {
    await page.goto('/settings')

    await expect(page.getByTestId('profile-form')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('input-display-name')).toHaveValue('Test User')
  })

  test('danger zone is still rendered', async ({ page }) => {
    await page.goto('/settings')

    await expect(page.getByTestId('danger-zone')).toBeVisible()
  })

  test('settings profile edit persists', async ({ page }) => {
    // Track PATCH/POST calls to candidate_profiles
    const updateRequests: string[] = []
    await page.route('**/rest/v1/candidate_profiles*', async (route) => {
      const method = route.request().method()
      if (method === 'PATCH' || method === 'POST') {
        const body = route.request().postDataJSON() as Record<string, unknown>
        updateRequests.push(JSON.stringify(body))
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              user_id: TEST_USER.id,
              display_name: (body as { display_name?: string }).display_name ?? 'Test User',
              created_at: '2024-01-01T00:00:00Z',
              updated_at: new Date().toISOString(),
            },
          ]),
        })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              user_id: TEST_USER.id,
              display_name: 'Test User',
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
            },
          ]),
        })
      }
    })

    await page.goto('/settings')

    // Wait for the profile form to load
    await expect(page.getByTestId('profile-form')).toBeVisible({ timeout: 10000 })

    // Edit display name
    const displayNameInput = page.getByTestId('input-display-name')
    await displayNameInput.clear()
    await displayNameInput.fill('Updated Name')

    // Click save
    await page.getByTestId('btn-save-profile').click()

    // Verify the API call was made with updated name
    await expect
      .poll(() => updateRequests.some((r) => r.includes('Updated Name')), {
        timeout: 5000,
      })
      .toBe(true)

    // Take screenshot to verify final state
    await page.screenshot({
      path: 'test-results/settings-profile-edit.png',
      fullPage: false,
    })
  })
})
