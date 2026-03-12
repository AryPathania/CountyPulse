import { test, expect } from '@playwright/test'
import { test as authTest, expect as authExpect, mockAuthState } from './fixtures/auth'
import { setupApiMocks } from './fixtures/mock-data'

test.describe('CompleteProfile - Unauthenticated', () => {
  test('redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/complete-profile')
    await expect(page.getByTestId('login-form')).toBeVisible()
  })
})

authTest.describe('CompleteProfile - Onboarding Flow', () => {
  authTest.beforeEach(async ({ page }) => {
    await mockAuthState(page)
    await setupApiMocks(page)

    // Override candidate_profiles to return no existing profile so we start in create mode
    await page.route('**/rest/v1/candidate_profiles*', async (route) => {
      const method = route.request().method()
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        })
      } else if (method === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              user_id: 'e2e-test-user-id',
              display_name: 'E2E Test User',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ]),
        })
      } else {
        await route.continue()
      }
    })
  })

  authTest('renders the complete profile form', async ({ page }) => {
    await page.goto('/complete-profile')

    await authExpect(page.getByTestId('input-display-name')).toBeVisible()
    await authExpect(page.getByTestId('input-phone')).toBeVisible()
    await authExpect(page.getByTestId('input-location')).toBeVisible()
    await authExpect(page.getByTestId('btn-add-link-LinkedIn')).toBeVisible()
    await authExpect(page.getByRole('heading', { name: 'Complete Your Profile' })).toBeVisible()
  })

  authTest('save button is disabled when display name is empty', async ({ page }) => {
    await page.goto('/complete-profile')

    await authExpect(page.getByTestId('btn-save-profile')).toBeDisabled()
  })

  authTest('save button is enabled after entering display name', async ({ page }) => {
    await page.goto('/complete-profile')

    await page.getByTestId('input-display-name').fill('Test User')
    await authExpect(page.getByTestId('btn-save-profile')).toBeEnabled()
  })

  authTest('completes onboarding: fill form, add LinkedIn link, submit, redirect to /', async ({ page }) => {
    await page.goto('/complete-profile')

    // Fill in display name (required)
    await page.getByTestId('input-display-name').fill('E2E Test User')

    // Add a LinkedIn link via quick-add button
    await page.getByTestId('btn-add-link-LinkedIn').click()
    await authExpect(page.getByTestId('input-link-label-0')).toHaveValue('LinkedIn')
    await page.getByTestId('input-link-url-0').fill('https://linkedin.com/in/e2etestuser')

    // Screenshot before submit
    await page.screenshot({ path: 'packages/ui/e2e/screenshots/complete-profile-before-submit.png' })

    // Submit the form
    await page.getByTestId('btn-save-profile').click()

    // Should redirect to /
    await authExpect(page).toHaveURL('/', { timeout: 10000 })
  })

  authTest('can add and remove links', async ({ page }) => {
    await page.goto('/complete-profile')

    // Add LinkedIn and GitHub via quick-add
    await page.getByTestId('btn-add-link-LinkedIn').click()
    await page.getByTestId('btn-add-link-GitHub').click()

    await authExpect(page.getByTestId('input-link-label-0')).toBeVisible()
    await authExpect(page.getByTestId('input-link-label-1')).toBeVisible()

    // Remove the first link
    await page.getByTestId('btn-remove-link-0').click()
    await authExpect(page.getByTestId('input-link-label-0')).toBeVisible()
    await authExpect(page.getByTestId('input-link-label-1')).not.toBeVisible()
  })

  authTest('shows email field (read-only)', async ({ page }) => {
    await page.goto('/complete-profile')

    const emailInput = page.getByTestId('input-email')
    await authExpect(emailInput).toBeVisible()
    await authExpect(emailInput).toHaveAttribute('readonly')
    await authExpect(emailInput).toHaveValue('test@example.com')
  })
})

authTest.describe('CompleteProfile - Update Mode', () => {
  authTest.beforeEach(async ({ page }) => {
    await mockAuthState(page)
    await setupApiMocks(page)

    // Return an existing candidate_profiles so we start in update mode
    await page.route('**/rest/v1/candidate_profiles*', async (route) => {
      const method = route.request().method()
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              user_id: 'e2e-test-user-id',
              display_name: 'Existing User',
              phone: '(555) 000-0000',
              location: 'San Francisco, CA',
              links: [],
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
            },
          ]),
        })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{}]),
        })
      }
    })
  })

  authTest('shows Update Profile heading and pre-fills data', async ({ page }) => {
    await page.goto('/complete-profile')

    await authExpect(page.getByRole('heading', { name: 'Update Profile' })).toBeVisible()
    await authExpect(page.getByTestId('input-display-name')).toHaveValue('Existing User')
    await authExpect(page.getByTestId('input-phone')).toHaveValue('(555) 000-0000')
    await authExpect(page.getByTestId('input-location')).toHaveValue('San Francisco, CA')

    // Screenshot for visual verification
    await page.screenshot({ path: 'packages/ui/e2e/screenshots/complete-profile-update-mode.png' })
  })
})
