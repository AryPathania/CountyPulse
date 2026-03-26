import { test, expect } from './fixtures/auth'
import { mockAuthState } from './fixtures/auth'
import { setupApiMocks } from './fixtures/mock-data'

test.describe('No Access page (non-beta user)', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthState(page)

    // Override beta access BEFORE setupApiMocks — Playwright matches last-registered handler,
    // so this false mock wins over the true one registered in mockAuthState.
    await page.route('**/rest/v1/rpc/check_beta_access*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(false),
      })
    })

    await setupApiMocks(page)
  })

  test('redirects non-beta user to /no-access page', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByTestId('no-access-page')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Access Limited' })).toBeVisible()
  })

  test('shows beta testers message', async ({ page }) => {
    await page.goto('/')

    await expect(
      page.getByText('Odie AI is currently available to beta testers only.'),
    ).toBeVisible()
  })

  test('shows user email', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByText('test@example.com')).toBeVisible()
    await expect(page.getByText('Signed in as')).toBeVisible()
  })

  test('shows sign out button', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByTestId('no-access-page')).toBeVisible()
    await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible()
  })

  test('non-beta user cannot access protected routes', async ({ page }) => {
    // Try /bullets
    await page.goto('/bullets')
    await expect(page.getByTestId('no-access-page')).toBeVisible()

    // Try /resumes
    await page.goto('/resumes')
    await expect(page.getByTestId('no-access-page')).toBeVisible()

    // Try /interview
    await page.goto('/interview')
    await expect(page.getByTestId('no-access-page')).toBeVisible()
  })

  test('navigating directly to /no-access renders the page (no redirect loop)', async ({ page }) => {
    await page.goto('/no-access')

    await expect(page.getByTestId('no-access-page')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Access Limited' })).toBeVisible()
  })
})
