import { test } from '@playwright/test'

/**
 * Screenshot capture utility for visual verification.
 * Run with: pnpm exec playwright test screenshot-capture --project=chromium
 *
 * Screenshots are saved to packages/ui/screenshots/ (gitignored)
 */

test.describe('Screenshot Capture', () => {
  test.beforeAll(async () => {
    // Ensure screenshots directory exists
    const fs = await import('fs')
    const path = await import('path')
    const screenshotsDir = path.join(process.cwd(), 'screenshots')
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true })
    }
  })

  test('capture login page', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-testid="login-form"]')

    await page.screenshot({
      path: 'screenshots/login-page.png',
      fullPage: true,
    })
  })

  test('capture bullets page (mocked auth)', async ({ page }) => {
    // Mock authenticated session
    await page.route('**/auth/v1/user', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-user-id',
          email: 'test@example.com',
          aud: 'authenticated',
          role: 'authenticated',
        }),
      })
    })

    // Mock bullets data
    await page.route('**/rest/v1/odie_bullets*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    await page.goto('/bullets')

    // Wait for page content
    await page.waitForTimeout(500)

    await page.screenshot({
      path: 'screenshots/bullets-page.png',
      fullPage: true,
    })
  })

  test('capture interview page (mocked auth)', async ({ page }) => {
    // Mock authenticated session
    await page.route('**/auth/v1/user', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-user-id',
          email: 'test@example.com',
          aud: 'authenticated',
          role: 'authenticated',
        }),
      })
    })

    await page.goto('/interview')

    // Wait for page content
    await page.waitForTimeout(500)

    await page.screenshot({
      path: 'screenshots/interview-page.png',
      fullPage: true,
    })
  })

  test('capture resumes page (mocked auth)', async ({ page }) => {
    // Mock authenticated session
    await page.route('**/auth/v1/user', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-user-id',
          email: 'test@example.com',
          aud: 'authenticated',
          role: 'authenticated',
        }),
      })
    })

    // Mock resumes data
    await page.route('**/rest/v1/odie_resumes*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    await page.goto('/resumes')

    // Wait for page content
    await page.waitForTimeout(500)

    await page.screenshot({
      path: 'screenshots/resumes-page.png',
      fullPage: true,
    })
  })
})
