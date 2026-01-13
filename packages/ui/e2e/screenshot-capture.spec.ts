import { test } from '@playwright/test'
import { mockAuthState } from './fixtures/auth'
import { setupApiMocks } from './fixtures/mock-data'

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
    await mockAuthState(page)
    await setupApiMocks(page)

    await page.goto('/bullets')
    await page.waitForSelector('[data-testid="bullets-page"]')

    await page.screenshot({
      path: 'screenshots/bullets-page.png',
      fullPage: true,
    })
  })

  test('capture interview page (mocked auth)', async ({ page }) => {
    await mockAuthState(page)

    await page.goto('/interview')
    await page.waitForSelector('[data-testid="interview-page"]')

    // Wait for initial render to settle (no scroll animations)
    await page.waitForTimeout(500)

    await page.screenshot({
      path: 'screenshots/interview-page.png',
      fullPage: true,
    })
  })

  test('capture resumes page (mocked auth)', async ({ page }) => {
    await mockAuthState(page)
    await setupApiMocks(page)

    await page.goto('/resumes')
    await page.waitForSelector('[data-testid="resumes-page"]')

    await page.screenshot({
      path: 'screenshots/resumes-page.png',
      fullPage: true,
    })
  })
})
