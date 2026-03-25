import { test, expect } from './fixtures/auth'
import { mockAuthState } from './fixtures/auth'
import {
  setupApiMocks,
  MOCK_JOB_DRAFTS,
  MOCK_BULLETS_WITH_POSITIONS,
  MOCK_GAP_ANALYSIS,
} from './fixtures/mock-data'

test.describe('JD to Draft Flow', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthState(page)
    await setupApiMocks(page)
  })

  test('home page shows JD input form', async ({ page }) => {
    await page.goto('/')

    // Should see home page with JD input
    await expect(page.getByTestId('home-page')).toBeVisible()
    await expect(page.getByTestId('jd-input')).toBeVisible()
    await expect(page.getByTestId('jd-submit')).toBeVisible()
  })

  test('submit button is disabled when JD is empty', async ({ page }) => {
    await page.goto('/')

    const submitBtn = page.getByTestId('jd-submit')
    await expect(submitBtn).toBeDisabled()
  })

  test('submit button is enabled when JD is entered', async ({ page }) => {
    await page.goto('/')

    const jdInput = page.getByTestId('jd-input')
    await jdInput.fill('We are looking for a software engineer with React experience...')

    const submitBtn = page.getByTestId('jd-submit')
    await expect(submitBtn).toBeEnabled()
  })

  test('shows quick action buttons', async ({ page }) => {
    await page.goto('/')

    // Start Interview button
    await expect(page.getByTestId('start-interview')).toBeVisible()
    await expect(page.getByTestId('start-interview')).toContainText('Start Interview')

    // View Bullets button
    await expect(page.getByTestId('view-bullets')).toBeVisible()
    await expect(page.getByTestId('view-bullets')).toContainText('View Bullets Library')
  })

  test('Start Interview button navigates to interview page', async ({ page }) => {
    await page.goto('/')

    await page.getByTestId('start-interview').click()

    await expect(page).toHaveURL('/interview')
  })

  test('View Bullets button navigates to bullets page', async ({ page }) => {
    await page.goto('/')

    await page.getByTestId('view-bullets').click()

    await expect(page).toHaveURL('/bullets')
  })

  test('submitting JD navigates to draft page', async ({ page }) => {
    // processJobDescription creates a draft via Supabase REST API (POST /rest/v1/job_drafts)
    // which is already mocked by setupApiMocks

    await page.goto('/')

    const jdInput = page.getByTestId('jd-input')
    await jdInput.fill('We are looking for a software engineer with React experience...')

    const submitBtn = page.getByTestId('jd-submit')
    await submitBtn.click()

    // Should navigate to draft page
    await expect(page).toHaveURL(/\/resumes\//)
  })
})

test.describe('Draft Resume View', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthState(page)

    // Set up mock for draft with bullets (include gap_analysis to avoid spinner)
    const draftWithBullets = {
      ...MOCK_JOB_DRAFTS[0],
      gap_analysis: MOCK_GAP_ANALYSIS,
      bullets: MOCK_BULLETS_WITH_POSITIONS.slice(0, 2),
    }

    await page.route('**/rest/v1/job_drafts*', async (route) => {
      const url = route.request().url()

      if (url.includes('id=eq.draft-1') || url.includes('select=*,bullets')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(draftWithBullets),
        })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_JOB_DRAFTS),
        })
      }
    })

    await page.route('**/rest/v1/bullets*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_BULLETS_WITH_POSITIONS),
      })
    })

    await page.route('**/rest/v1/resumes*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })
  })

  test('shows draft page with matched bullets', async ({ page }) => {
    await page.goto('/resumes/draft-1')

    // Should see draft page
    await expect(page.getByTestId('draft-page')).toBeVisible()
  })

  test('shows job title from draft', async ({ page }) => {
    await page.goto('/resumes/draft-1')

    // Should show job title in the page h1 (not the gap analysis heading)
    await expect(page.locator('h1.draft-page__title')).toContainText(MOCK_JOB_DRAFTS[0].job_title)
  })

  test('shows company from draft', async ({ page }) => {
    await page.goto('/resumes/draft-1')

    // Should show company in the page header
    await expect(page.locator('.draft-page__company')).toContainText(MOCK_JOB_DRAFTS[0].company)
  })

  test('shows create resume button', async ({ page }) => {
    await page.goto('/resumes/draft-1')

    const createBtn = page.getByTestId('create-resume-btn')
    await expect(createBtn).toBeVisible()
    await expect(createBtn).toContainText('Create Resume')
  })

  test('shows error for non-existent draft', async ({ page }) => {
    // Override to return null
    await page.route('**/rest/v1/job_drafts*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(null),
      })
    })

    await page.goto('/resumes/non-existent-draft')

    await expect(page.getByTestId('draft-error')).toBeVisible()
  })

  test('shows no bullets message when draft has no matches', async ({ page }) => {
    // Override to return draft with no bullets
    await page.route('**/rest/v1/job_drafts*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...MOCK_JOB_DRAFTS[0],
          gap_analysis: MOCK_GAP_ANALYSIS,
          bullets: [],
        }),
      })
    })

    await page.goto('/resumes/draft-1')

    await expect(page.getByTestId('no-bullets')).toBeVisible()
    await expect(page.getByText('No matching bullets found')).toBeVisible()
  })

  test('shows gap analysis with coverage data', async ({ page }) => {
    await page.goto('/resumes/draft-1')
    await expect(page.getByTestId('gap-analysis')).toBeVisible()
    await expect(page.getByTestId('gap-summary')).toContainText('1/3 requirements covered')
    await expect(page.getByTestId('gap-item').first()).toBeVisible()
    await expect(page.getByText('GraphQL knowledge')).toBeVisible()
    await expect(page.getByTestId('covered-item')).toBeVisible()
    await expect(page.getByText('React experience required')).toBeVisible()
  })

  test('shows Interview for Gaps button when gaps exist', async ({ page }) => {
    await page.goto('/resumes/draft-1')
    await expect(page.getByTestId('interview-for-gaps')).toBeVisible()
  })
})

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthState(page)
    await setupApiMocks(page)
  })

  test('shows navigation bar on home page', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByTestId('navigation')).toBeVisible()
  })

  test('navigation has home link', async ({ page }) => {
    // Start from resumes page which has navigation
    await page.goto('/resumes')

    const homeLink = page.getByTestId('nav-link-home')
    await expect(homeLink).toBeVisible()

    await homeLink.click()
    await expect(page).toHaveURL('/')
  })

  test('navigation has bullets link', async ({ page }) => {
    await page.goto('/')

    const bulletsLink = page.getByTestId('nav-link-bullets')
    await expect(bulletsLink).toBeVisible()

    await bulletsLink.click()
    await expect(page).toHaveURL('/bullets')
  })

  test('navigation has resumes link', async ({ page }) => {
    await page.goto('/')

    const resumesLink = page.getByTestId('nav-link-resumes')
    await expect(resumesLink).toBeVisible()

    await resumesLink.click()
    await expect(page).toHaveURL('/resumes')
  })

  test('navigation shows user email', async ({ page }) => {
    await page.goto('/')

    const emailDisplay = page.getByTestId('nav-email')
    await expect(emailDisplay).toBeVisible()
    await expect(emailDisplay).toContainText('test@example.com')
  })

  test('navigation has settings link', async ({ page }) => {
    await page.goto('/')

    const settingsLink = page.getByTestId('nav-settings')
    await expect(settingsLink).toBeVisible()
  })
})
