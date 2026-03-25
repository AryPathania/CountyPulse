import { test } from '@playwright/test'
import { mockAuthState, TEST_USER } from './fixtures/auth'
import { setupApiMocks, MOCK_GAP_ANALYSIS_RICH, MOCK_BULLETS_WITH_POSITIONS, MOCK_RESUMES } from './fixtures/mock-data'

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

  test('capture resume builder edit page (mocked auth)', async ({ page }) => {
    await mockAuthState(page)
    await setupApiMocks(page)

    await page.goto(`/resumes/${MOCK_RESUMES[0].id}/edit`)
    await page.waitForSelector('[data-testid="resume-builder"]', { timeout: 15000 })
    await page.waitForTimeout(500)

    await page.screenshot({
      path: 'screenshots/resume-builder.png',
      fullPage: true,
    })
  })

  test('capture resume print preview (mocked auth)', async ({ page }) => {
    await mockAuthState(page)
    await setupApiMocks(page)

    await page.goto(`/resumes/${MOCK_RESUMES[0].id}/edit`)
    await page.waitForSelector('[data-testid="resume-builder"]', { timeout: 15000 })
    await page.waitForTimeout(500)

    // Emulate print media to see what the PDF export looks like
    await page.emulateMedia({ media: 'print' })
    await page.waitForTimeout(300)

    await page.screenshot({
      path: 'screenshots/resume-print-preview.png',
      fullPage: true,
    })
  })

  test('capture gap analysis page (mocked auth)', async ({ page }) => {
    await mockAuthState(page)

    // Mock draft with rich gap analysis (partials, gaps, covered)
    await page.route('**/rest/v1/job_drafts*', async (route) => {
      const method = route.request().method()
      if (method === 'PATCH') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'draft-1',
            user_id: TEST_USER.id,
            job_title: 'Senior Full Stack Engineer',
            company: 'Acme Corp',
            jd_text: 'We need a senior full stack engineer with React, TypeScript, Kubernetes...',
            jd_embedding: null,
            parsed_requirements: null,
            gap_analysis: MOCK_GAP_ANALYSIS_RICH,
            selected_bullet_ids: null,
            retrieved_bullet_ids: null,
            created_at: '2024-01-15T00:00:00Z',
            updated_at: '2024-01-15T00:00:00Z',
            bullets: MOCK_BULLETS_WITH_POSITIONS.slice(0, 3),
          }),
        })
      }
    })

    await page.route('**/rest/v1/bullets*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_BULLETS_WITH_POSITIONS) })
    })

    await page.route('**/rest/v1/resumes*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    })

    await page.route('**/rest/v1/candidate_profiles*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          user_id: TEST_USER.id,
          display_name: 'Test User',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        }]),
      })
    })

    await page.route('**/rest/v1/profile_entries*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    })

    await page.route('**/rest/v1/uploaded_resumes*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    })

    await page.route('**/rest/v1/positions*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    })

    await page.goto('/resumes/draft-1')
    await page.waitForSelector('[data-testid="gap-analysis"]', { timeout: 15000 })

    // Wait for render to settle
    await page.waitForTimeout(500)

    await page.screenshot({
      path: 'screenshots/gap-analysis.png',
      fullPage: true,
    })
  })
})
