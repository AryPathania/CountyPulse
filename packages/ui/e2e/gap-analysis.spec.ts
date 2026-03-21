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

    // Mock match_items RPC — first requirement matches, others don't
    page.route('**/rest/v1/rpc/match_items*', async (route) => {
      // Return one match for the first call, empty for subsequent
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          id: 'bullet-3',
          source_type: 'bullet',
          content_text: 'Built React frontend for analytics dashboard with real-time updates',
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
    // Override match_items to return empty for all — creates gaps
    await page.route('**/rest/v1/rpc/match_items*', async (route) => {
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

  test('gap with skill match shows Partial badge', async ({ page }) => {
    await page.goto('/resumes/draft-1')

    await expect(page.getByTestId('gap-analysis')).toBeVisible({ timeout: 10000 })

    const gapItems = page.getByTestId('gap-item')
    await expect(gapItems).toHaveCount(2)

    // One gap should show "Partial" (the one with skillMatch)
    await expect(gapItems.filter({ hasText: 'Partial' })).toHaveCount(1)
    // One gap should show "Gap" (the one without skillMatch)
    await expect(gapItems.filter({ hasText: 'Gap' })).toHaveCount(1)
  })

  test('skill match label displays matching skill name', async ({ page }) => {
    await page.goto('/resumes/draft-1')

    await expect(page.getByTestId('gap-analysis')).toBeVisible({ timeout: 10000 })

    const skillMatch = page.getByTestId('skill-match')
    await expect(skillMatch).toBeVisible()
    await expect(skillMatch).toContainText('Skill match: Leadership')
  })

  test('uses match_items RPC and handles entry-type matches', async ({ page }) => {
    // Track RPC calls to verify match_items is used
    const rpcCalls: string[] = []

    // Override match_items to return an entry-type match
    await page.route('**/rest/v1/rpc/match_items*', async (route) => {
      rpcCalls.push('match_items')
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          id: 'entry-1',
          source_type: 'entry',
          content_text: 'B.S. Computer Science, Stanford University',
          category: 'education',
          similarity: 0.91,
        }]),
      })
    })

    // Also verify match_bullets is NOT called
    await page.route('**/rest/v1/rpc/match_bullets*', async (route) => {
      rpcCalls.push('match_bullets')
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    await page.goto('/resumes/draft-1')

    // Wait for gap analysis to render
    await expect(page.getByTestId('gap-analysis')).toBeVisible({ timeout: 10000 })

    // Verify match_items was called and match_bullets was NOT
    expect(rpcCalls).toContain('match_items')
    expect(rpcCalls).not.toContain('match_bullets')

    // The entry-based match should show as covered
    const coveredItems = page.getByTestId('covered-item')
    await expect(coveredItems.first()).toBeVisible()
  })
})
