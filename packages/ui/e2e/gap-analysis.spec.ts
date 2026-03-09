import { test, expect, mockAuthState } from './fixtures/auth'
import { MOCK_JOB_DRAFTS, MOCK_BULLETS_WITH_POSITIONS } from './fixtures/mock-data'

const MOCK_REQUIREMENTS = [
  { description: 'React experience required', category: 'technical', importance: 'must_have' },
  { description: 'Team leadership skills', category: 'soft_skill', importance: 'must_have' },
  { description: 'GraphQL knowledge', category: 'technical', importance: 'nice_to_have' },
]

function setupGapAnalysisMocks(page: import('@playwright/test').Page) {
  return Promise.all([
    // Mock job draft with JD text
    page.route('**/rest/v1/job_drafts*', async (route) => {
      const method = route.request().method()
      if (method === 'PATCH') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_JOB_DRAFTS[0]) })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ...MOCK_JOB_DRAFTS[0],
            jd_text: 'We need a React engineer with leadership skills and GraphQL knowledge.',
            bullets: MOCK_BULLETS_WITH_POSITIONS.slice(0, 2),
          }),
        })
      }
    }),

    page.route('**/rest/v1/bullets*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_BULLETS_WITH_POSITIONS) })
    }),

    page.route('**/rest/v1/resumes*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    }),

    // Mock parse-jd edge function
    page.route('**/functions/v1/parse-jd', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          jobTitle: 'Frontend Engineer',
          company: 'New Company',
          requirements: MOCK_REQUIREMENTS,
        }),
      })
    }),

    // Mock embed edge function
    page.route('**/functions/v1/embed', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          embeddings: MOCK_REQUIREMENTS.map(() => Array(1536).fill(0.01)),
        }),
      })
    }),

    // Mock match_bullets RPC — first requirement matches, others don't
    page.route('**/rest/v1/rpc/match_bullets*', async (route) => {
      // Return one match for the first call, empty for subsequent
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          id: 'bullet-3',
          current_text: 'Built React frontend for analytics dashboard with real-time updates',
          category: 'Technical',
          similarity: 0.89,
        }]),
      })
    }),
  ])
}

test.describe('Gap Analysis on Draft Page', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthState(page)
    await setupGapAnalysisMocks(page)
  })

  test('renders gap analysis after draft loads', async ({ page }) => {
    await page.goto('/resumes/draft-1')

    await expect(page.getByTestId('draft-page')).toBeVisible()
    await expect(page.getByTestId('gap-analysis')).toBeVisible({ timeout: 10000 })
  })

  test('shows requirements summary', async ({ page }) => {
    await page.goto('/resumes/draft-1')

    await expect(page.getByTestId('gap-summary')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('gap-summary')).toContainText('requirements covered')
  })

  test('displays covered items with badge', async ({ page }) => {
    await page.goto('/resumes/draft-1')

    await expect(page.getByTestId('gap-analysis')).toBeVisible({ timeout: 10000 })
    const coveredItems = page.getByTestId('covered-item')
    await expect(coveredItems.first()).toBeVisible()
    await expect(coveredItems.first()).toContainText('Covered')
  })

  test('interview for gaps button navigates to interview', async ({ page }) => {
    // Override match_bullets to return empty for all — creates gaps
    await page.route('**/rest/v1/rpc/match_bullets*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    await page.goto('/resumes/draft-1')

    const interviewBtn = page.getByTestId('interview-for-gaps')
    await expect(interviewBtn).toBeVisible({ timeout: 10000 })
    await expect(interviewBtn).toContainText('Interview for Gaps')

    await interviewBtn.click()
    await expect(page).toHaveURL('/interview')
  })

  test('create resume button is visible alongside gap analysis', async ({ page }) => {
    await page.goto('/resumes/draft-1')

    await expect(page.getByTestId('gap-analysis')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('create-resume-btn')).toBeVisible()
  })

  test('shows job title and company', async ({ page }) => {
    await page.goto('/resumes/draft-1')

    await expect(page.getByRole('heading', { name: MOCK_JOB_DRAFTS[0].job_title, level: 1 })).toBeVisible()
    await expect(page.getByText(MOCK_JOB_DRAFTS[0].company).first()).toBeVisible()
  })
})
